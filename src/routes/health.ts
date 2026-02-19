// Health check endpoints

import { sql } from 'drizzle-orm';
import { db } from '@/config/db';
import { jsonResponse, errorResponse } from '@/utils/responses';

/**
 * Basic liveness check - returns OK without database check
 */
export function healthHandler(): Response {
  return jsonResponse({ status: 'ok' });
}

/**
 * Readiness check - verifies database connectivity
 */
export async function readyHandler(): Promise<Response> {
  try {
    // Execute a simple query to verify database connection
    await db.execute(sql`SELECT 1`);

    return jsonResponse({
      status: 'ready',
      database: 'connected',
    });
  } catch (error) {
    return errorResponse('Database connection failed', 503);
  }
}
