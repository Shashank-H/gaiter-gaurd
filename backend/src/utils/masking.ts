// Credential masking utilities for safe API responses
// IMPORTANT: These masked values are for internal/admin use only
// API responses should NEVER contain even masked credential values

import type { Service } from '@/db/schema';

/**
 * Masks a credential value for internal display.
 * WARNING: This is NOT for API responses - API should only show key names, not values.
 *
 * @param value - The credential value to mask
 * @returns Masked string (e.g., "abcd***efgh" or "***")
 */
export function maskCredential(value: string): string {
  if (value.length <= 8) {
    return '***';
  }

  const first4 = value.slice(0, 4);
  const last4 = value.slice(-4);
  return `${first4}***${last4}`;
}

/**
 * Format a service object for API response.
 * Replaces credential values with metadata about which keys exist.
 *
 * @param service - The service object from database
 * @param credentialKeys - Optional array of credential key names (e.g., ['api_key', 'secret'])
 * @returns Service object safe for API response (no credential values)
 */
export function formatServiceResponse(
  service: Service,
  credentialKeys?: string[]
): Omit<Service, 'credentials'> & { credentials: { keys: string[]; count: number } } {
  const keys = credentialKeys || [];

  return {
    ...service,
    credentials: {
      keys,
      count: keys.length,
    },
  };
}
