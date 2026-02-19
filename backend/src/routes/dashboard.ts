// Dashboard-facing approval endpoints: list pending, approve, deny
// All routes use JWT auth (requireAuth), not Agent-Key auth
// These endpoints allow the human dashboard to manage approval requests

import { requireAuth, AuthError } from '@/middleware/auth';
import {
  listPendingForUser,
  getApprovalQueueEntry,
  transitionStatus,
} from '@/services/approval.service';
import { db } from '@/config/db';
import { agents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '@/config/env';
import { errorResponse } from '@/utils/responses';

/**
 * GET /approvals/pending
 * Dashboard lists all PENDING approval requests for the authenticated user.
 *
 * Returns every pending action queued by agents belonging to this user.
 * Joins approvalQueue with agents on userId — users only see their own agents' actions.
 */
export async function handleListPendingApprovals(req: Request): Promise<Response> {
  try {
    const { userId } = await requireAuth(req);

    const rows = await listPendingForUser(userId);

    const approvals = rows.map((row) => {
      let requestHeaders: Record<string, string> = {};
      try {
        requestHeaders = JSON.parse(row.requestHeaders ?? '{}');
      } catch {
        // If headers can't be parsed, return empty object
      }

      return {
        action_id: row.actionId,
        agent_name: row.agentName,
        service_id: row.serviceId,
        method: row.method,
        target_url: row.targetUrl,
        intent: row.intent,
        risk_score: row.riskScore,
        risk_explanation: row.riskExplanation,
        request_headers: requestHeaders,
        request_body: row.requestBody,
        created_at: row.createdAt.toISOString(),
      };
    });

    return Response.json({ approvals });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }

    console.error('List pending approvals error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * Ownership check: verify the approval queue entry belongs to the requesting user.
 * Returns the row if ownership is confirmed, or null if not found / wrong user.
 */
async function getOwnedEntry(actionId: string, userId: number) {
  const row = await getApprovalQueueEntry(actionId);
  if (!row) return null;

  // Verify agent belongs to requesting user
  const [agent] = await db
    .select({ userId: agents.userId })
    .from(agents)
    .where(eq(agents.id, row.agentId))
    .limit(1);

  if (!agent || agent.userId !== userId) return null;

  return row;
}

/**
 * PATCH /approvals/:actionId/approve
 * Dashboard approves a PENDING action, transitioning it to APPROVED.
 *
 * Sets approvalExpiresAt based on APPROVAL_EXECUTE_TTL_HOURS env var.
 * Returns 409 if the action is already resolved (race condition protection).
 * Returns 404 if actionId not found or belongs to a different user.
 */
export async function handleApproveAction(
  req: Request,
  params: { actionId: string }
): Promise<Response> {
  try {
    const { userId } = await requireAuth(req);

    const row = await getOwnedEntry(params.actionId, userId);
    if (!row) {
      return errorResponse('Action not found', 404);
    }

    const approvalExpiresAt = new Date(
      Date.now() + env.APPROVAL_EXECUTE_TTL_HOURS * 3600000
    );

    const transitioned = await transitionStatus(
      params.actionId,
      'PENDING',
      'APPROVED',
      {
        resolvedAt: new Date(),
        approvalExpiresAt,
      }
    );

    if (!transitioned) {
      return errorResponse('Action already resolved', 409);
    }

    return Response.json({ status: 'APPROVED', action_id: params.actionId });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }

    console.error('Approve action error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PATCH /approvals/:actionId/deny
 * Dashboard denies a PENDING action, transitioning it to DENIED.
 *
 * Returns 409 if the action is already resolved.
 * Returns 404 if actionId not found or belongs to a different user.
 */
export async function handleDenyAction(
  req: Request,
  params: { actionId: string }
): Promise<Response> {
  try {
    const { userId } = await requireAuth(req);

    const row = await getOwnedEntry(params.actionId, userId);
    if (!row) {
      return errorResponse('Action not found', 404);
    }

    const transitioned = await transitionStatus(
      params.actionId,
      'PENDING',
      'DENIED',
      {
        resolvedAt: new Date(),
      }
    );

    if (!transitioned) {
      return errorResponse('Action already resolved', 409);
    }

    return Response.json({ status: 'DENIED', action_id: params.actionId });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }

    console.error('Deny action error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}
