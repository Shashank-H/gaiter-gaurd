// AES-256-GCM encryption service for credential storage
// Uses scrypt key derivation from ENCRYPTION_SECRET environment variable

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '@/config/env';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

let ENCRYPTION_KEY: Buffer | null = null;

/**
 * Initialize encryption key from environment variables.
 * MUST be called once at server startup before any encrypt/decrypt operations.
 */
export function initEncryption(): void {
  if (ENCRYPTION_KEY) {
    console.warn('Encryption already initialized, skipping re-initialization');
    return;
  }

  ENCRYPTION_KEY = scryptSync(
    env.ENCRYPTION_SECRET,
    env.ENCRYPTION_SALT,
    KEY_LENGTH
  );

  console.log('Encryption service initialized successfully');
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all hex-encoded)
 *
 * @throws {Error} If encryption not initialized
 */
export function encrypt(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption not initialized - call initEncryption() first');
  }

  // Generate random IV for this encryption operation (NEVER reuse IVs)
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt ciphertext that was encrypted with encrypt().
 * Verifies authentication tag to detect tampering.
 *
 * @throws {Error} If encryption not initialized
 * @throws {Error} If ciphertext format is invalid
 * @throws {Error} If decryption fails (corruption/tampering)
 */
export function decrypt(ciphertext: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption not initialized - call initEncryption() first');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format - expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: data may be corrupted or tampered');
  }
}
