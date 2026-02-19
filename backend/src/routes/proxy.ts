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
} from '@/services/proxy.service';
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
