// API key generation, hashing, and validation utilities for agent authentication

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Generate a new API key with agt_ prefix
 *
 * @returns API key in format: agt_{64_hex_chars}
 */
export function generateApiKey(): string {
  const randomHex = randomBytes(32).toString('hex');
  return `agt_${randomHex}`;
}

/**
 * Hash an API key using SHA-256
 *
 * @param apiKey - The API key to hash
 * @returns SHA-256 hex digest (64 chars)
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Validate an API key against a stored hash using constant-time comparison
 *
 * @param providedKey - The API key provided by the client
 * @param storedHash - The stored hash to compare against
 * @returns true if the key matches, false otherwise
 */
export function validateApiKey(providedKey: string, storedHash: string): boolean {
  try {
    // Hash the provided key
    const providedHash = hashApiKey(providedKey);

    // Convert both to buffers for constant-time comparison
    const providedBuffer = Buffer.from(providedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');

    // Check length mismatch before comparison
    if (providedBuffer.length !== storedBuffer.length) {
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return timingSafeEqual(providedBuffer, storedBuffer);
  } catch (error) {
    // Return false on any error (e.g., invalid buffer conversion)
    return false;
  }
}
