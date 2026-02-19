// Approval status route: agent-facing GET /status/:actionId for polling approval state
// Returns different shapes based on current state of the approval queue entry

import { requireAgentAuth, AuthError } from '@/middleware/auth';
import { getApprovalQueueEntry } from '@/services/approval.service';
import { errorResponse } from '@/utils/responses';

/**
 * GET /status/:actionId
 * Agent polls this endpoint to learn the current approval state of a risk-blocked request.
 *
 * Response shapes by status (per research Pattern 5):
 * - PENDING:  { status, action_id, created_at }
 * - APPROVED: { status, action_id, execute_url }
 * - DENIED:   { status, action_id, resolved_at }
 * - EXPIRED:  { status, action_id }
 * - EXECUTED: { status, action_id, result: { status, headers, body } }
 *
 * Ownership check: returns 404 for both not-found and wrong-agent — avoids revealing existence.
 */
export async function handleApprovalStatus(
  req: Request,
  params: { actionId: string }
): Promise<Response> {
  try {
    // Authenticate agent via Agent-Key header
    const { agentId } = await requireAgentAuth(req);

    // Fetch the approval queue entry
    const row = await getApprovalQueueEntry(params.actionId);

    // Return 404 if not found (don't reveal existence to other agents)
    if (!row) {
      return errorResponse('Action not found', 404);
    }

    // Ownership check: only the requesting agent may see their own entries
    if (row.agentId !== agentId) {
      return errorResponse('Action not found', 404);
    }

    const action_id = row.actionId;

    // Return status-appropriate response shape
    switch (row.status) {
      case 'PENDING':
        return Response.json({
          status: 'PENDING',
          action_id,
          created_at: row.createdAt.toISOString(),
        });

      case 'APPROVED':
        return Response.json({
          status: 'APPROVED',
          action_id,
          execute_url: `/proxy/execute/${action_id}`,
        });

      case 'DENIED':
        return Response.json({
          status: 'DENIED',
          action_id,
          resolved_at: row.resolvedAt?.toISOString() ?? null,
        });

      case 'EXPIRED':
        return Response.json({
          status: 'EXPIRED',
          action_id,
        });

      case 'EXECUTED': {
        let parsedHeaders: Record<string, string> = {};
        try {
          parsedHeaders = JSON.parse(row.responseHeaders || '{}');
        } catch {
          // If headers can't be parsed, return empty object
        }
        return Response.json({
          status: 'EXECUTED',
          action_id,
          result: {
            status: row.responseStatus,
            headers: parsedHeaders,
            body: row.responseBody,
          },
        });
      }

      default:
        // Unknown status — treat as internal error
        return errorResponse(`Unknown action status: ${row.status}`, 500);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }

    console.error('Approval status handler error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}
