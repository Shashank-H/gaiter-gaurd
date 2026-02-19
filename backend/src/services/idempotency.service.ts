// Idempotency key management service for proxy requests
// Provides check, complete, and fail operations with transaction isolation

import { db } from '@/config/db';
import { idempotencyKeys, type IdempotencyKey, type InsertIdempotencyKey } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Result types for idempotency checks
 */
export type IdempotencyResult =
  | { status: 'new'; idempotencyKeyId: number }
  | { status: 'processing' }
  | { status: 'completed'; responseStatus: number; responseHeaders: string; responseBody: string };

/**
 * Check idempotency status for a request
 * Uses READ COMMITTED transaction isolation
 * 
 * Logic:
 * - If key not found: create new record with status='processing', return 'new'
 * - If found with status='processing': return 'processing' (409 to caller)
 * - If found with status='completed': return cached response
 * - If found with status='failed': delete old record, create new one, return 'new' (retry)
 * 
 * @param agentId - The agent making the request
 * @param key - The idempotency key value
 * @param requestHash - SHA-256 hex of method+url+body for mismatch detection
 * @returns IdempotencyResult indicating what to do
 */
export async function checkIdempotency(
  agentId: number,
  key: string,
  requestHash: string
): Promise<IdempotencyResult> {
  return await db.transaction(async (tx) => {
    // Look up existing record by (agentId, key)
    const [existing] = await tx
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.agentId, agentId), eq(idempotencyKeys.key, key)))
      .limit(1);

    if (!existing) {
      // No existing key, create new record
      const [record] = await tx
        .insert(idempotencyKeys)
        .values({
          agentId,
          key,
          requestHash,
          status: 'processing',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        })
        .returning();

      return { status: 'new', idempotencyKeyId: record.id };
    }

    // Record exists, check status
    if (existing.status === 'processing') {
      // Request still in flight
      return { status: 'processing' };
    }

    if (existing.status === 'completed') {
      // Request completed, return cached response
      return {
        status: 'completed',
        responseStatus: existing.responseStatus!,
        responseHeaders: existing.responseHeaders!,
        responseBody: existing.responseBody!,
      };
    }

    // Status is 'failed', allow retry by deleting old record and creating new one
    await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.id, existing.id));

    const [record] = await tx
      .insert(idempotencyKeys)
      .values({
        agentId,
        key,
        requestHash,
        status: 'processing',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();

    return { status: 'new', idempotencyKeyId: record.id };
  });
}

/**
 * Mark an idempotency key as completed with cached response
 * 
 * @param id - The idempotency key record ID
 * @param responseStatus - HTTP status code
 * @param responseHeaders - Serialized response headers (JSON string)
 * @param responseBody - Response body text
 */
export async function completeIdempotency(
  id: number,
  responseStatus: number,
  responseHeaders: string,
  responseBody: string
): Promise<void> {
  await db
    .update(idempotencyKeys)
    .set({
      status: 'completed',
      responseStatus,
      responseHeaders,
      responseBody,
      completedAt: new Date(),
    })
    .where(eq(idempotencyKeys.id, id));
}

/**
 * Mark an idempotency key as failed
 * Failed keys can be retried (deleted and recreated on next attempt)
 * 
 * @param id - The idempotency key record ID
 * @param errorMessage - Error message (not stored, just for logging)
 */
export async function failIdempotency(id: number, errorMessage: string): Promise<void> {
  await db
    .update(idempotencyKeys)
    .set({
      status: 'failed',
      completedAt: new Date(),
    })
    .where(eq(idempotencyKeys.id, id));
}
