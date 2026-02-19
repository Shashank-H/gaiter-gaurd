// Approval queue service: CRUD operations and state machine transitions
// State machine: PENDING → APPROVED | DENIED; APPROVED → EXECUTED | EXPIRED

import { db } from '@/config/db';
import { approvalQueue } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';

/**
 * Create a new approval queue entry for a risk-blocked request.
 *
 * Auth headers must be stripped from requestHeaders before calling this function.
 * Credentials are re-injected fresh from encrypted store at execution time.
 *
 * @returns actionId - UUID v4 string identifying this approval request
 */
export async function createApprovalQueueEntry(params: {
  agentId: number;
  serviceId: number;
  method: string;
  targetUrl: string;
  requestHeaders: Record<string, string>; // auth headers already stripped
  requestBody: string | null;
  intent: string;
  riskScore: number;
  riskExplanation: string;
}): Promise<string> {
  const actionId = crypto.randomUUID();

  await db.insert(approvalQueue).values({
    actionId,
    agentId: params.agentId,
    serviceId: params.serviceId,
    method: params.method,
    targetUrl: params.targetUrl,
    requestHeaders: JSON.stringify(params.requestHeaders),
    requestBody: params.requestBody,
    intent: params.intent,
    riskScore: params.riskScore,
    riskExplanation: params.riskExplanation,
    status: 'PENDING',
  });

  return actionId;
}

/**
 * Retrieve a single approval queue entry by its actionId.
 *
 * @returns The approval queue row, or null if not found
 */
export async function getApprovalQueueEntry(actionId: string) {
  const [row] = await db
    .select()
    .from(approvalQueue)
    .where(eq(approvalQueue.actionId, actionId))
    .limit(1);

  return row ?? null;
}

/**
 * Conditionally transition an approval queue entry from one status to another.
 *
 * Uses WHERE status = fromStatus for race-safe transitions (per research pitfall #3).
 * If the row is already in a different status (e.g., concurrently EXPIRED), the
 * update will match 0 rows and return false.
 *
 * @param actionId - The UUID of the approval queue entry
 * @param fromStatus - The expected current status (transition only applies if matched)
 * @param toStatus - The target status
 * @param extras - Optional additional fields to update (timestamps, response data, etc.)
 * @returns true if the row was updated (status matched), false if no match (race condition)
 */
export async function transitionStatus(
  actionId: string,
  fromStatus: string,
  toStatus: string,
  extras?: {
    resolvedAt?: Date;
    executedAt?: Date;
    approvalExpiresAt?: Date;
    responseStatus?: number;
    responseHeaders?: string;
    responseBody?: string;
  }
): Promise<boolean> {
  const result = await db
    .update(approvalQueue)
    .set({
      status: toStatus,
      ...(extras ?? {}),
    })
    .where(
      and(
        eq(approvalQueue.actionId, actionId),
        eq(approvalQueue.status, fromStatus)
      )
    )
    .returning({ id: approvalQueue.id });

  return result.length > 0;
}

/**
 * Expire all APPROVED entries whose approvalExpiresAt has passed.
 *
 * Uses conditional WHERE for race safety (per research pitfall #3):
 * - Only updates rows that are still APPROVED
 * - Only updates rows where the expiry time has passed
 * This ensures concurrent dashboard approvals cannot race with the cleanup job.
 *
 * Called by a setInterval cleanup job in server startup.
 */
export async function expireStaleApprovals(): Promise<void> {
  await db
    .update(approvalQueue)
    .set({ status: 'EXPIRED' })
    .where(
      and(
        eq(approvalQueue.status, 'APPROVED'),
        lt(approvalQueue.approvalExpiresAt, new Date())
      )
    );
}

/**
 * Mark an approval queue entry as EXECUTED after the request was forwarded.
 *
 * Stores the cached response (status, headers, body) in the row so subsequent
 * GET /status/:actionId polls can return the result without re-executing.
 *
 * @param actionId - The UUID of the approval queue entry
 * @param responseStatus - HTTP status code from the forwarded request
 * @param responseHeaders - JSON-serialized response headers
 * @param responseBody - Response body text
 * @returns true if the transition succeeded (was APPROVED), false if race condition
 */
export async function markExecuted(
  actionId: string,
  responseStatus: number,
  responseHeaders: string,
  responseBody: string
): Promise<boolean> {
  return transitionStatus(actionId, 'APPROVED', 'EXECUTED', {
    executedAt: new Date(),
    responseStatus,
    responseHeaders,
    responseBody,
  });
}
