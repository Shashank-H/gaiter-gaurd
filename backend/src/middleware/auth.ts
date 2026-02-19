// Authentication middleware for protected routes

import { verifyAccessToken } from '@/utils/jwt';

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
