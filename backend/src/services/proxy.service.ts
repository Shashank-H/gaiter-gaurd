// Core proxy service: URL validation, credential injection, request forwarding
// Orchestrates the full proxy request lifecycle with SSRF prevention and idempotency

import { z } from 'zod';
import { db } from '@/config/db';
import { services, credentials, agentServices, proxyRequests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/services/encryption.service';
import { checkIdempotency, completeIdempotency, failIdempotency } from '@/services/idempotency.service';
import { createHash } from 'node:crypto';

/**
 * Custom error classes for proxy operations
 */
export class ProxyError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Zod schema for proxy request validation
 */
export const proxyRequestSchema = z.object({
  targetUrl: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().nullable().optional(),
  intent: z.string().min(1).max(500),
  idempotencyKey: z.string().min(1).max(255).optional(),
}).refine(
  (data) => {
    // Idempotency key required for POST and PATCH
    if ((data.method === 'POST' || data.method === 'PATCH') && !data.idempotencyKey) {
      return false;
    }
    return true;
  },
  { message: 'idempotencyKey is required for POST and PATCH requests' }
);

export type ProxyRequestData = z.infer<typeof proxyRequestSchema>;

/**
 * Validate target URL against service baseUrl to prevent SSRF
 * 
 * Checks:
 * - Target hostname matches service baseUrl hostname
 * - Target URL starts with service baseUrl path
 * - Block private IP ranges (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, fc00:, fe80:)
 * - Only allow http/https protocols
 * 
 * @param targetUrl - The URL the agent wants to call
 * @param serviceBaseUrl - The registered service baseUrl
 * @throws ProxyError if validation fails
 */
export function validateTargetUrl(targetUrl: string, serviceBaseUrl: string): void {
  let target: URL;
  let base: URL;

  try {
    target = new URL(targetUrl);
    base = new URL(serviceBaseUrl);
  } catch (error) {
    throw new ProxyError('Invalid URL format', 400);
  }

  // Only allow http/https
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new ProxyError('Only HTTP and HTTPS protocols are allowed', 400);
  }

  // Hostname must match
  if (target.hostname !== base.hostname) {
    throw new ProxyError(
      `Target hostname (${target.hostname}) does not match service baseUrl (${base.hostname})`,
      403
    );
  }

  // Target path must start with base path
  if (!target.pathname.startsWith(base.pathname)) {
    throw new ProxyError(
      `Target path must start with service baseUrl path (${base.pathname})`,
      403
    );
  }

  // Block private IP ranges
  const hostname = target.hostname.toLowerCase();

  // IPv4 private ranges
  if (
    hostname.startsWith('127.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.')
  ) {
    throw new ProxyError('Access to private IP ranges is forbidden', 403);
  }

  // 172.16.0.0 - 172.31.255.255
  const ipMatch = hostname.match(/^172\.(\d+)\./);
  if (ipMatch) {
    const octet = parseInt(ipMatch[1], 10);
    if (octet >= 16 && octet <= 31) {
      throw new ProxyError('Access to private IP ranges is forbidden', 403);
    }
  }

  // IPv6 private ranges
  if (hostname === '::1' || hostname.startsWith('fc00:') || hostname.startsWith('fe80:')) {
    throw new ProxyError('Access to private IP ranges is forbidden', 403);
  }

  // Block localhost
  if (hostname === 'localhost') {
    throw new ProxyError('Access to localhost is forbidden', 403);
  }
}

/**
 * Resolve service from target URL with agent access check
 * Queries services table joined with agent_services
 * 
 * @param targetUrl - The URL the agent wants to call
 * @param agentId - The agent ID
 * @returns Service record
 * @throws NotFoundError if no matching service or agent doesn't have access
 */
export async function resolveService(targetUrl: string, agentId: number) {
  const url = new URL(targetUrl);
  const origin = url.origin; // e.g., "https://api.github.com"

  // Find service where baseUrl matches the origin (or is a prefix of the target)
  const result = await db
    .select({ service: services })
    .from(services)
    .innerJoin(agentServices, eq(agentServices.serviceId, services.id))
    .where(and(eq(agentServices.agentId, agentId)))
    .execute();

  // Filter in memory for baseUrl match (more flexible than SQL LIKE)
  const matchingService = result.find((row) => {
    const baseUrl = row.service.baseUrl;
    return targetUrl.startsWith(baseUrl);
  });

  if (!matchingService) {
    throw new NotFoundError(
      'No service found matching target URL or agent does not have access'
    );
  }

  return matchingService.service;
}

/**
 * Inject credentials into request headers based on authType
 * Retrieves and decrypts credentials for the service
 * 
 * AuthType handling:
 * - bearer: Authorization: Bearer {token}
 * - api_key: {header_name || 'X-API-Key'}: {api_key}
 * - basic: Authorization: Basic {base64(username:password)}
 * - oauth2: Authorization: Bearer {access_token}
 * 
 * @param headers - Existing headers (will be modified)
 * @param serviceId - The service ID
 * @param authType - The authentication type
 * @returns Modified headers object
 * @throws ProxyError if credentials not found or malformed
 */
export async function injectCredentials(
  headers: Record<string, string>,
  serviceId: number,
  authType: string
): Promise<Record<string, string>> {
  // Fetch credentials for this service
  const creds = await db
    .select()
    .from(credentials)
    .where(eq(credentials.serviceId, serviceId))
    .execute();

  if (creds.length === 0) {
    throw new ProxyError('No credentials found for service', 500);
  }

  // Decrypt credentials
  const decryptedCreds: Record<string, string> = {};
  for (const cred of creds) {
    try {
      decryptedCreds[cred.key] = decrypt(cred.encryptedValue);
    } catch (error) {
      throw new ProxyError('Failed to decrypt credentials', 500);
    }
  }

  // Inject based on authType
  switch (authType) {
    case 'bearer':
      if (!decryptedCreds.token) {
        throw new ProxyError('Bearer token not found in credentials', 500);
      }
      headers['Authorization'] = `Bearer ${decryptedCreds.token}`;
      break;

    case 'api_key':
      // Use credential key name as header name, or default to X-API-Key
      const apiKeyHeader = Object.keys(decryptedCreds).find((k) => k !== 'api_key')
        ? Object.keys(decryptedCreds)[0]
        : 'X-API-Key';
      const apiKeyValue = decryptedCreds[apiKeyHeader] || decryptedCreds.api_key;
      if (!apiKeyValue) {
        throw new ProxyError('API key not found in credentials', 500);
      }
      headers[apiKeyHeader === 'api_key' ? 'X-API-Key' : apiKeyHeader] = apiKeyValue;
      break;

    case 'basic':
      if (!decryptedCreds.username || !decryptedCreds.password) {
        throw new ProxyError('Username or password not found in credentials', 500);
      }
      const basicAuth = Buffer.from(
        `${decryptedCreds.username}:${decryptedCreds.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
      break;

    case 'oauth2':
      if (!decryptedCreds.access_token) {
        throw new ProxyError('OAuth2 access_token not found in credentials', 500);
      }
      headers['Authorization'] = `Bearer ${decryptedCreds.access_token}`;
      break;

    default:
      throw new ProxyError(`Unsupported authType: ${authType}`, 500);
  }

  return headers;
}

/**
 * Forward request to target service with timeout and size limits
 * 
 * Features:
 * - 30 second timeout
 * - 10MB response size limit
 * - Manual redirect handling (disabled)
 * 
 * @param targetUrl - The target URL
 * @param method - HTTP method
 * @param headers - Request headers (with credentials injected)
 * @param body - Request body (nullable)
 * @returns Object with status, headers, and body
 * @throws ProxyError on timeout, size limit, or fetch failure
 */
export async function forwardRequest(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body: string | null
): Promise<{ status: number; headers: string; body: string }> {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body: body || undefined,
      signal: controller.signal,
      redirect: 'manual', // Disable automatic redirects
    });

    // Check Content-Length header for size limit (10MB = 10 * 1024 * 1024 bytes)
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      throw new ProxyError('Response size exceeds 10MB limit', 413);
    }

    // Read response body as text
    const responseBody = await response.text();

    // Enforce size limit on actual body (in case Content-Length was missing)
    if (responseBody.length > 10 * 1024 * 1024) {
      throw new ProxyError('Response size exceeds 10MB limit', 413);
    }

    // Serialize response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      headers: JSON.stringify(responseHeaders),
      body: responseBody,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new ProxyError('Request timeout (30s limit exceeded)', 504);
    }
    if (error instanceof ProxyError) {
      throw error;
    }
    // Sanitize error message - include only safe information
    const url = new URL(targetUrl);
    throw new ProxyError(
      `Failed to forward request to ${url.hostname}: ${error.message || 'Unknown error'}`,
      502
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Main orchestrator: Execute proxy request with full lifecycle
 * 
 * Flow:
 * 1. Resolve service (validates agent access)
 * 2. Validate target URL (SSRF prevention)
 * 3. Check idempotency (if key provided)
 * 4. Inject credentials
 * 5. Forward request
 * 6. Log to proxy_requests (fire-and-forget)
 * 7. Complete/fail idempotency (if key provided)
 * 8. Return response
 * 
 * @param agentId - The agent making the request
 * @param userId - The user ID (owner of agent)
 * @param data - Validated proxy request data
 * @returns Response object with status, headers, body
 */
export async function executeProxyRequest(
  agentId: number,
  userId: number,
  data: ProxyRequestData
): Promise<{ status: number; headers: string; body: string }> {
  let idempotencyKeyId: number | undefined;
  let serviceId: number;

  try {
    // Step 1: Resolve service (validates agent access + finds service)
    const service = await resolveService(data.targetUrl, agentId);
    serviceId = service.id;

    // Step 2: Validate target URL (SSRF check)
    validateTargetUrl(data.targetUrl, service.baseUrl);

    // Step 3: Check idempotency (if key provided)
    if (data.idempotencyKey) {
      const requestHash = createHash('sha256')
        .update(`${data.method}:${data.targetUrl}:${data.body || ''}`)
        .digest('hex');

      const idempotencyResult = await checkIdempotency(agentId, data.idempotencyKey, requestHash);

      if (idempotencyResult.status === 'completed') {
        // Return cached response
        return {
          status: idempotencyResult.responseStatus,
          headers: idempotencyResult.responseHeaders,
          body: idempotencyResult.responseBody,
        };
      }

      if (idempotencyResult.status === 'processing') {
        // Request already in flight
        throw new ProxyError('Request with this idempotency key is already being processed', 409);
      }

      // Status is 'new', record the ID for later
      idempotencyKeyId = idempotencyResult.idempotencyKeyId;
    }

    // Step 4: Inject credentials
    const headersWithCreds = await injectCredentials({ ...data.headers }, service.id, service.authType);

    // Step 5: Forward request
    const response = await forwardRequest(
      data.targetUrl,
      data.method,
      headersWithCreds,
      data.body || null
    );

    // Step 6: Log to proxy_requests (fire-and-forget)
    db.insert(proxyRequests)
      .values({
        agentId,
        serviceId: service.id,
        idempotencyKeyId: idempotencyKeyId || null,
        method: data.method,
        targetUrl: data.targetUrl,
        intent: data.intent,
        completedAt: new Date(),
        statusCode: response.status,
        errorMessage: null,
      })
      .execute()
      .catch(() => {}); // Ignore audit log failures

    // Step 7: Complete idempotency (if key provided)
    if (idempotencyKeyId) {
      await completeIdempotency(
        idempotencyKeyId,
        response.status,
        response.headers,
        response.body
      );
    }

    // Step 8: Return response
    return response;
  } catch (error: any) {
    // Log failure to audit log (fire-and-forget)
    if (serviceId!) {
      db.insert(proxyRequests)
        .values({
          agentId,
          serviceId: serviceId!,
          idempotencyKeyId: idempotencyKeyId || null,
          method: data.method,
          targetUrl: data.targetUrl,
          intent: data.intent,
          completedAt: new Date(),
          statusCode: null,
          errorMessage: error.message || 'Unknown error',
        })
        .execute()
        .catch(() => {});
    }

    // Fail idempotency (if key provided)
    if (idempotencyKeyId) {
      await failIdempotency(idempotencyKeyId, error.message || 'Unknown error');
    }

    // Re-throw the error to caller
    throw error;
  }
}
