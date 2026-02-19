// Authentication service: registration, login, and token refresh

import { eq, gt } from 'drizzle-orm';
import { db } from '@/config/db';
import { users, refreshTokens, type User } from '@/db/schema';
import { signAccessToken, signRefreshToken } from '@/utils/jwt';

/**
 * Validates email format using basic regex
 */
function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
}

/**
 * Validates password meets minimum requirements
 */
function validatePassword(password: string): void {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
}

/**
 * Registers a new user with email and password
 * @param email - User's email address
 * @param password - User's password (will be hashed)
 * @returns User object without password hash
 * @throws Error if validation fails or email already exists
 */
export async function registerUser(
  email: string,
  password: string
): Promise<{ id: number; email: string }> {
  // Validate inputs
  validateEmail(email);
  validatePassword(password);

  // Check if user already exists
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error('User with this email already exists');
  }

  // Hash password with Argon2id
  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536,
    timeCost: 2,
  });

  // Insert user into database
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
    })
    .returning({ id: users.id, email: users.email });

  return newUser;
}

/**
 * Authenticates a user and returns tokens
 * @param email - User's email address
 * @param password - User's password
 * @returns Access token, refresh token, and user object
 * @throws Error if credentials are invalid
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { id: number; email: string };
}> {
  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await Bun.password.verify(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Generate tokens
  const accessToken = await signAccessToken(user.id);
  const refreshToken = await signRefreshToken(user.id);

  // Hash and store refresh token
  const tokenHash = await Bun.password.hash(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

/**
 * Refreshes access token using a valid refresh token
 * Implements token rotation - old refresh token is invalidated
 * @param refreshToken - The refresh token to exchange
 * @returns New access token and refresh token pair
 * @throws Error if refresh token is invalid or expired
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  // First verify the JWT signature and extract userId
  const { jwtVerify } = await import('jose');
  const secretKey = new TextEncoder().encode(process.env.JWT_SECRET!);

  let userId: number;
  try {
    const { payload } = await jwtVerify(refreshToken, secretKey);
    if (!payload.sub || payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    userId = parseInt(payload.sub, 10);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }

  // Fetch all non-expired refresh tokens for this user
  const now = new Date();
  const storedTokens = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, userId))
    .where(gt(refreshTokens.expiresAt, now));

  // Find the matching token by comparing hashes
  let matchedToken = null;
  for (const stored of storedTokens) {
    const isMatch = await Bun.password.verify(refreshToken, stored.tokenHash);
    if (isMatch) {
      matchedToken = stored;
      break;
    }
  }

  if (!matchedToken) {
    throw new Error('Invalid refresh token');
  }

  // Delete the used refresh token (rotation)
  await db.delete(refreshTokens).where(eq(refreshTokens.id, matchedToken.id));

  // Generate new token pair
  const newAccessToken = await signAccessToken(userId);
  const newRefreshToken = await signRefreshToken(userId);

  // Store new refresh token
  const tokenHash = await Bun.password.hash(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}
