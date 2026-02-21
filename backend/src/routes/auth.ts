// Authentication route handlers

import { registerUser, loginUser, refreshAccessToken } from '@/services/auth.service';
import { requireAuth, AuthError } from '@/middleware/auth';
import { jsonResponse, errorResponse } from '@/utils/responses';
import { db } from '@/config/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/utils/logger';

/**
 * POST /auth/register - Register a new user
 */
export async function handleRegister(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as any;
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const user = await registerUser(email, password);
    logger.info(`User registered: ${email} (id: ${user.id})`);

    return jsonResponse(
      {
        message: 'User registered',
        user,
      },
      201
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User with this email already exists') {
        return errorResponse(error.message, 409);
      }
      if (
        error.message.includes('Invalid email') ||
        error.message.includes('Password must')
      ) {
        return errorResponse(error.message, 400);
      }
    }
    logger.error('Registration failed:', error);
    return errorResponse('Registration failed', 500);
  }
}

/**
 * POST /auth/login - Login with email and password
 */
export async function handleLogin(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as any;
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const result = await loginUser(email, password);
    logger.info(`User logged in: ${email} (id: ${result.user.id})`);

    return jsonResponse({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid credentials') {
      return errorResponse('Invalid credentials', 401);
    }
    logger.error('Login failed:', error);
    return errorResponse('Login failed', 500);
  }
}

/**
 * POST /auth/refresh - Refresh access token
 */
export async function handleRefresh(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as any;
    const { refreshToken } = body;

    if (!refreshToken) {
      return errorResponse('Refresh token is required', 400);
    }

    const result = await refreshAccessToken(refreshToken);

    return jsonResponse({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    logger.error('Token refresh failed:', error);
    return errorResponse('Invalid refresh token', 401);
  }
}

/**
 * GET /auth/me - Get current user info (protected route)
 */
export async function handleMe(req: Request): Promise<Response> {
  try {
    // Authenticate request
    const { userId } = await requireAuth(req);

    // Fetch user from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return jsonResponse({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('Failed to get user info:', error);
    return errorResponse('Failed to get user info', 500);
  }
}
