// Proxy endpoint: agent-facing POST /proxy for secure request forwarding
// Handles Agent-Key authentication, validation, delegation, and response proxying

import { requireAgentAuth, AuthError } from '@/middleware/auth';
import { validateBody, ValidationError } from '@/middleware/validation';
import {
  executeProxyRequest,
  proxyRequestSchema,
  ProxyError,
  NotFoundError,
  ForbiddenError,
  RiskyRequestError,
  injectCredentials,
  forwardRequest,
} from '@/services/proxy.service';
import { getApprovalQueueEntry, markExecuted, transitionStatus } from '@/services/approval.service';
import { db } from '@/config/db';
import { services } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/utils/responses';

/**
 * POST /proxy
 * Main proxy endpoint for agents to forward requests through the gateway
 *
 * Flow:
 * 1. Authenticate via Agent-Key header
 * 2. Validate request body with proxyRequestSchema
 * 3. Extract Idempotency-Key header (header takes precedence over body field)
 * 4. Execute proxy request via proxy service
 * 5. Return target response with proxy metadata headers
 *
 * Response headers:
 * - X-Proxy-Status: forwarded (indicates request went through gateway)
 * - X-Idempotency-Status: hit|miss (if idempotency key was used)
 */
export async function handleProxy(req: Request): Promise<Response> {
  try {
    // Step 1: Authenticate agent via Agent-Key header
    const { agentId, userId } = await requireAgentAuth(req);

    // Step 2: Validate request body
    const data = await validateBody(proxyRequestSchema)(req);

    // Step 3: Extract Idempotency-Key header
    // Header takes precedence over body field if both present
    const idempotencyKeyHeader = req.headers.get('Idempotency-Key');
    if (idempotencyKeyHeader) {
      data.idempotencyKey = idempotencyKeyHeader;
    }

    // Step 4: Execute proxy request
    const result = await executeProxyRequest(agentId, userId, data);

    // Step 5: Construct response with target's data + proxy metadata
    const responseHeaders = new Headers();

    // Parse target response headers
    let targetHeaders: Record<string, string> = {};
    try {
      targetHeaders = JSON.parse(result.headers);
    } catch {
      // If headers can't be parsed, ignore silently
    }

    // Set Content-Type from target (default to application/json)
    const contentType = targetHeaders['content-type'] || 'application/json';
    responseHeaders.set('Content-Type', contentType);

    // Add proxy metadata headers
    responseHeaders.set('X-Proxy-Status', 'forwarded');

    // Add idempotency status if key was used
    if (data.idempotencyKey) {
      // Check if this was a cached response (status will be 200 but came from idempotency cache)
      // We can infer this by checking if the response was very fast, but simpler is to check
      // if idempotencyKey was provided - if yes, mark as potential hit
      // For now, mark as 'processed' to indicate idempotency was used
      responseHeaders.set('X-Idempotency-Status', 'processed');
    }

    return new Response(result.body, {
      status: result.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // Handle specific error types
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ValidationError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ForbiddenError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof RiskyRequestError) {
      return Response.json(
        {
          error: 'Request requires human approval',
          action_id: error.actionId,
          risk_score: error.riskScore,
          risk_explanation: error.riskExplanation,
          status_url: `/status/${error.actionId}`,
        },
        { status: 428 }
      );
    }
    if (error instanceof ProxyError) {
      return errorResponse(error.message, error.statusCode);
    }

    // Unknown error
    console.error('Proxy handler error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /proxy/execute/:actionId
 * Execute an approved request from the approval queue.
 *
 * Flow:
 * 1. Authenticate agent via Agent-Key header
 * 2. Fetch the approval queue entry by actionId
 * 3. Ownership check (same pattern as handleApprovalStatus)
 * 4. Verify status is APPROVED
 * 5. Check TTL — if approvalExpiresAt has passed, transition to EXPIRED and return 410
 * 6. Look up the service record for fresh credential injection
 * 7. Parse stored headers, inject credentials fresh from encrypted store
 * 8. Forward the stored request to the target
 * 9. Mark as EXECUTED and cache the response
 * 10. Return the response with X-Proxy-Status: executed-approved
 */
export async function handleProxyExecute(
  req: Request,
  params: { actionId: string }
): Promise<Response> {
  try {
    // Step 1: Authenticate agent via Agent-Key header
    const { agentId } = await requireAgentAuth(req);

    // Step 2: Fetch the approval queue entry
    const row = await getApprovalQueueEntry(params.actionId);

    // Step 3: Ownership check (404 to avoid revealing existence to other agents)
    if (!row) {
      return errorResponse('Action not found', 404);
    }
    if (row.agentId !== agentId) {
      return errorResponse('Action not found', 404);
    }

    // Step 4: Verify status is APPROVED
    if (row.status !== 'APPROVED') {
      return errorResponse(`Cannot execute action with status ${row.status}`, 409);
    }

    // Step 5: Check TTL — if approvalExpiresAt has passed, expire and return 410
    if (row.approvalExpiresAt && row.approvalExpiresAt < new Date()) {
      // Fire-and-forget race-safe transition to EXPIRED
      transitionStatus(params.actionId, 'APPROVED', 'EXPIRED').catch(() => {});
      return errorResponse('Approval has expired — resubmit request via POST /proxy', 410);
    }

    // Step 6: Look up the service record for authType
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, row.serviceId))
      .limit(1);

    if (!service) {
      return errorResponse('Service no longer exists', 410);
    }

    // Step 7: Parse stored headers and inject fresh credentials from vault
    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(row.requestHeaders || '{}');
    } catch {
      // Use empty headers if stored headers can't be parsed
    }

    const headersWithCreds = await injectCredentials(parsedHeaders, row.serviceId, service.authType);

    // Step 8: Forward the stored request to the target
    const response = await forwardRequest(
      row.targetUrl,
      row.method,
      headersWithCreds,
      row.requestBody
    );

    // Step 9: Mark as EXECUTED and cache the response (fire-and-forget — don't block)
    markExecuted(params.actionId, response.status, response.headers, response.body).catch(() => {});

    // Step 10: Return the response with proxy metadata
    const responseHeaders = new Headers();

    // Parse target response headers for Content-Type passthrough
    let targetHeaders: Record<string, string> = {};
    try {
      targetHeaders = JSON.parse(response.headers);
    } catch {
      // If headers can't be parsed, ignore silently
    }

    const contentType = targetHeaders['content-type'] || 'application/json';
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('X-Proxy-Status', 'executed-approved');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ProxyError) {
      return errorResponse(error.message, error.statusCode);
    }

    console.error('Proxy execute handler error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}
