// Authentication middleware for protected routes

import { verifyAccessToken } from '@/utils/jwt';
import { hashApiKey } from '@/utils/apikey';
import { db } from '@/config/db';
import { agents, agentServices } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Custom error class for authentication failures
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Middleware to require valid JWT authentication
 * Extracts and verifies Bearer token from Authorization header
 * @param req - The incoming request
 * @returns Object containing the authenticated user's ID
 * @throws AuthError if authentication fails
 */
export async function requireAuth(req: Request): Promise<{ userId: number }> {
  // Extract Authorization header
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    throw new AuthError('Missing authorization header', 401);
  }

  // Check Bearer format
  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthError('Invalid authorization header format', 401);
  }

  // Extract token
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  if (!token) {
    throw new AuthError('Missing token', 401);
  }

  // Verify token
  try {
    const { userId } = await verifyAccessToken(token);
    return { userId };
  } catch (error) {
    throw new AuthError('Invalid or expired token', 401);
  }
}

/**
 * Middleware to require valid Agent-Key authentication
 * Extracts and validates Agent-Key header
 * @param req - The incoming request
 * @returns Object containing the authenticated agent's ID and user ID
 * @throws AuthError if authentication fails
 */
export async function requireAgentAuth(req: Request): Promise<{ agentId: number; userId: number }> {
  // Extract Agent-Key header
  const agentKey = req.headers.get('Agent-Key');

  if (!agentKey) {
    throw new AuthError('Missing Agent-Key header', 401);
  }

  // Validate format (must start with 'agt_')
  if (!agentKey.startsWith('agt_')) {
    throw new AuthError('Invalid Agent-Key format', 401);
  }

  // Hash the provided key
  const keyHash = hashApiKey(agentKey);

  // Query agents table for matching key hash
  const result = await db.select().from(agents).where(eq(agents.keyHash, keyHash)).limit(1);

  if (result.length === 0) {
    throw new AuthError('Invalid Agent-Key', 401);
  }

  const agent = result[0];

  // Check if agent is active
  if (!agent.isActive) {
    throw new AuthError('Agent key has been revoked', 401);
  }

  // Fire-and-forget update of lastUsedAt
  db.update(agents)
    .set({ lastUsedAt: new Date() })
    .where(eq(agents.id, agent.id))
    .execute()
    .catch(() => {});

  return { agentId: agent.id, userId: agent.userId };
}

/**
 * Middleware to require agent access to a specific service
 * Checks agent_services join table for authorization
 * @param agentId - The agent's ID
 * @param serviceId - The service ID to check access for
 * @throws AuthError if agent doesn't have access
 */
export async function requireServiceAccess(agentId: number, serviceId: number): Promise<void> {
  // Query agent_services for the relationship
  const result = await db
    .select()
    .from(agentServices)
    .where(and(eq(agentServices.agentId, agentId), eq(agentServices.serviceId, serviceId)))
    .limit(1);

  if (result.length === 0) {
    throw new AuthError('Agent does not have access to this service', 403);
  }
}
