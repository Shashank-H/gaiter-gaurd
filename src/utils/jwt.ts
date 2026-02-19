// JWT token creation and verification using jose library

import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/config/env';

// Create secret key from environment variable
const secretKey = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Parse duration string (e.g., "15m", "7d") to seconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * multipliers[unit];
}

/**
 * Creates a JWT access token for the given user ID
 * @param userId - The user's database ID
 * @returns Signed JWT token string
 */
export async function signAccessToken(userId: number): Promise<string> {
  const expirySeconds = parseDuration(env.JWT_ACCESS_EXPIRY);

  return await new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds)
    .sign(secretKey);
}

/**
 * Creates a JWT refresh token for the given user ID
 * @param userId - The user's database ID
 * @returns Signed JWT refresh token string
 */
export async function signRefreshToken(userId: number): Promise<string> {
  const expirySeconds = parseDuration(env.JWT_REFRESH_EXPIRY);

  return await new SignJWT({
    sub: String(userId),
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds)
    .sign(secretKey);
}

/**
 * Verifies a JWT access token and returns the user ID
 * @param token - The JWT token to verify
 * @returns Object containing the user ID
 * @throws Error if token is invalid or expired
 */
export async function verifyAccessToken(token: string): Promise<{ userId: number }> {
  try {
    const { payload } = await jwtVerify(token, secretKey);

    if (!payload.sub) {
      throw new Error('Token missing subject claim');
    }

    const userId = parseInt(payload.sub, 10);
    if (isNaN(userId)) {
      throw new Error('Invalid user ID in token');
    }

    return { userId };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
    throw new Error('Token verification failed');
  }
}
