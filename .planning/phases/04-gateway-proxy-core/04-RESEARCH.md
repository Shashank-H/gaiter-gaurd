# Phase 4: Gateway Proxy Core - Research

**Researched:** 2026-02-16
**Domain:** HTTP proxy server with credential injection and idempotency
**Confidence:** HIGH

## Summary

Phase 4 implements a credential-injecting HTTP proxy that allows AI agents to call external APIs through the gateway. The proxy intercepts requests, injects stored credentials from the vault, and forwards requests to target services. Idempotency keys prevent duplicate execution of non-safe operations.

The core architecture is straightforward: agents send POST /proxy requests with target URL, method, headers, body, and idempotency key. The gateway validates the request, retrieves encrypted credentials, injects them based on the service's auth type, forwards the request using Bun's native fetch API, and returns the target service's response.

**Primary recommendation:** Use Bun's native fetch with manual header/body forwarding, implement database-backed idempotency with READ COMMITTED isolation, classify operations by HTTP method safety/idempotency properties, and enforce strict URL validation to prevent SSRF attacks.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun fetch | Native (1.0+) | HTTP client for proxying | Built-in, high performance, supports proxy options |
| Zod | 3.x | Request validation | Already in use, type-safe schema validation |
| Drizzle ORM | Current | Database operations | Already in use for all data access |
| PostgreSQL | Current | Transaction isolation for idempotency | Already in use, supports READ COMMITTED isolation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | Native | AES-256-GCM encryption | Already in use via encryption.service.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun fetch | node-fetch, axios | No advantage - Bun fetch is native and performant |
| Database idempotency | Redis/in-memory | Database provides transactions, persistence, existing pattern |
| Manual header injection | HTTP proxy middleware | More complexity, not needed for simple forwarding |

**Installation:**
No new dependencies required - all using existing stack.

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── services/
│   ├── proxy.service.ts         # Core proxy logic (credential injection, forwarding)
│   └── idempotency.service.ts   # Idempotency key management
├── routes/
│   └── proxy.ts                 # POST /proxy endpoint
├── middleware/
│   └── auth.ts                  # requireAgentAuth (already exists)
└── db/
    └── schema.ts                # New tables: proxy_requests, idempotency_keys
```

### Pattern 1: Request Proxying with Credential Injection
**What:** Intercept agent request, inject credentials based on auth type, forward to target
**When to use:** Every proxy request through the gateway
**Example:**
```typescript
// Source: Bun official docs - https://bun.com/docs/guides/http/proxy
async function forwardRequest(
  targetUrl: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  credentials: Record<string, string>,
  authType: string
): Promise<Response> {
  // Inject credentials based on auth type
  const injectedHeaders = injectCredentials(headers, credentials, authType);

  // Forward request using Bun's fetch
  return await fetch(targetUrl, {
    method,
    headers: injectedHeaders,
    body: body ? body : undefined,
  });
}

function injectCredentials(
  headers: Record<string, string>,
  credentials: Record<string, string>,
  authType: string
): Record<string, string> {
  const result = { ...headers };

  switch (authType) {
    case 'bearer':
      result['Authorization'] = `Bearer ${credentials.token}`;
      break;
    case 'api_key':
      // API key can go in header or query param
      result[credentials.header_name || 'X-API-Key'] = credentials.api_key;
      break;
    case 'basic':
      const encoded = btoa(`${credentials.username}:${credentials.password}`);
      result['Authorization'] = `Basic ${encoded}`;
      break;
    case 'oauth2':
      result['Authorization'] = `Bearer ${credentials.access_token}`;
      break;
  }

  return result;
}
```

### Pattern 2: Database-Backed Idempotency
**What:** Store idempotency key with request metadata, return cached response on duplicate
**When to use:** All non-safe HTTP methods (POST, PUT, DELETE, PATCH)
**Example:**
```typescript
// Source: Stripe's idempotency implementation - https://brandur.org/idempotency-keys
async function checkIdempotency(
  agentId: number,
  idempotencyKey: string,
  requestHash: string
): Promise<{ exists: boolean; response?: string }> {
  const result = await db.transaction(async (tx) => {
    // Check for existing key (scoped to agent)
    const existing = await tx
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.agentId, agentId),
          eq(idempotencyKeys.key, idempotencyKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const record = existing[0];

      // If still processing, return 409 Conflict
      if (record.status === 'processing') {
        return { exists: true, status: 'processing' };
      }

      // If completed, return cached response
      if (record.status === 'completed') {
        return { exists: true, response: record.responseBody, status: 'completed' };
      }
    }

    // Create new idempotency record in "processing" state
    await tx.insert(idempotencyKeys).values({
      agentId,
      key: idempotencyKey,
      requestHash,
      status: 'processing',
      createdAt: new Date(),
    });

    return { exists: false };
  }, {
    isolationLevel: 'read committed',
  });

  return result;
}
```

### Pattern 3: Request Classification by Risk
**What:** Classify HTTP methods as safe (GET, HEAD) or unsafe (POST, PUT, DELETE, PATCH)
**When to use:** Determine if request needs approval or can be auto-forwarded
**Example:**
```typescript
// Source: MDN HTTP Methods - https://developer.mozilla.org/en-US/docs/Glossary/Safe/HTTP
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE']);

function classifyRequest(method: string): {
  isSafe: boolean;
  isIdempotent: boolean;
  requiresIdempotencyKey: boolean;
} {
  const upperMethod = method.toUpperCase();

  return {
    isSafe: SAFE_METHODS.has(upperMethod),
    isIdempotent: IDEMPOTENT_METHODS.has(upperMethod),
    // POST and PATCH are non-idempotent and require idempotency keys
    requiresIdempotencyKey: !IDEMPOTENT_METHODS.has(upperMethod),
  };
}
```

### Pattern 4: SSRF Prevention with URL Validation
**What:** Validate target URLs to prevent Server-Side Request Forgery attacks
**When to use:** Before proxying any request
**Example:**
```typescript
// Source: OWASP SSRF Prevention - https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
import { URL } from 'node:url';

// Private IP ranges to block
const PRIVATE_IP_PATTERNS = [
  /^127\./,           // 127.0.0.0/8 (loopback)
  /^10\./,            // 10.0.0.0/8 (private)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (private)
  /^192\.168\./,      // 192.168.0.0/16 (private)
  /^169\.254\./,      // 169.254.0.0/16 (link-local)
  /^::1$/,            // IPv6 loopback
  /^fc00:/,           // IPv6 private
  /^fe80:/,           // IPv6 link-local
];

function isPrivateIP(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname));
}

function validateProxyUrl(targetUrl: string, allowedBaseUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  // Must match service's registered base URL
  const baseUrl = new URL(allowedBaseUrl);
  if (parsed.hostname !== baseUrl.hostname) {
    throw new Error('Target URL must match service base URL');
  }

  // Block private/internal IPs
  if (isPrivateIP(parsed.hostname)) {
    throw new Error('Requests to private IP addresses are not allowed');
  }
}
```

### Anti-Patterns to Avoid
- **Accepting arbitrary URLs:** Always validate against service's registered baseUrl to prevent SSRF
- **Following redirects:** Disable redirect following to prevent redirect-based SSRF attacks
- **Returning full error details to agents:** Sanitize error messages to avoid leaking internal information
- **Storing plaintext credentials in proxy logs:** Only log request metadata, never credential values

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL validation | Custom URL parser | Node's URL class + baseUrl matching | URL parsing has many edge cases, DNS rebinding attacks |
| Request forwarding | Custom HTTP client | Bun's native fetch | Handles timeouts, connection pooling, HTTP/2 automatically |
| Idempotency | In-memory cache | Database with transactions | Needs persistence, race condition protection, TTL cleanup |
| Credential encryption | Custom crypto | Existing encryption.service.ts | Already implements AES-256-GCM with scrypt |
| Auth type injection | String concatenation | Structured credential injection by type | Different APIs use different auth patterns |

**Key insight:** HTTP proxying seems simple but has many security edge cases (SSRF, credential leakage, redirect attacks, header injection). Use battle-tested patterns and strict validation rather than custom solutions.

## Common Pitfalls

### Pitfall 1: SSRF via URL Validation Bypass
**What goes wrong:** Attacker provides URL that bypasses validation (e.g., http://service.com@internal.local or DNS rebinding)
**Why it happens:** URL parsing is complex with many bypass techniques
**How to avoid:**
- Always parse URL with standard library (Node's URL class)
- Validate hostname matches service's registered baseUrl
- Block private IP ranges explicitly
- Disable HTTP redirect following
**Warning signs:** Requests to 127.0.0.1, 169.254.x.x, or internal hostnames in logs

### Pitfall 2: Idempotency Race Conditions
**What goes wrong:** Two concurrent requests with same idempotency key both execute
**Why it happens:** Check-then-insert pattern without transaction isolation
**How to avoid:**
- Use database transaction with READ COMMITTED isolation
- Insert idempotency record in "processing" state before executing request
- Return 409 Conflict if key exists and is still processing
- Update to "completed" with response after successful execution
**Warning signs:** Duplicate records created for same idempotency key

### Pitfall 3: Credential Leakage in Logs
**What goes wrong:** Authorization headers or credentials logged in proxy request logs
**Why it happens:** Logging entire request/response for debugging
**How to avoid:**
- Never log Authorization header values
- Redact sensitive headers before logging (Authorization, X-API-Key, etc.)
- Only log request metadata: timestamp, method, target hostname, status code
- Store full response only in idempotency table, not general logs
**Warning signs:** Grep for 'Bearer', 'Basic', 'api_key' in log files

### Pitfall 4: Response Body Memory Exhaustion
**What goes wrong:** Large response bodies (multi-GB files) cause memory overflow
**Why it happens:** Buffering entire response in memory before returning
**How to avoid:**
- Stream response bodies when possible
- Set maximum response size limit (e.g., 10MB for JSON APIs)
- For large files, reject and suggest direct URL access
- Use Bun's streaming response handling
**Warning signs:** High memory usage, OOM crashes on large responses

### Pitfall 5: Timeout Handling
**What goes wrong:** Proxy request hangs indefinitely if target service doesn't respond
**Why it happens:** No timeout configuration on fetch call
**How to avoid:**
- Set AbortController with timeout (e.g., 30 seconds)
- Return 504 Gateway Timeout to agent if target times out
- Log timeout events for monitoring
**Warning signs:** Requests stuck in "processing" state, never completing

### Pitfall 6: Authentication Type Mismatch
**What goes wrong:** Injecting Bearer token when API expects API key in query param
**Why it happens:** Assuming all APIs use same auth pattern
**How to avoid:**
- Store authType with service configuration
- Implement separate injection logic for each auth type
- Support multiple credential fields (e.g., username + password for basic auth)
- Validate required credential keys exist before injection
**Warning signs:** 401/403 errors despite valid credentials

## Code Examples

Verified patterns from official sources:

### Bun Fetch for Proxying
```typescript
// Source: https://bun.com/docs/guides/http/proxy
// Forward request with timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

try {
  const response = await fetch(targetUrl, {
    method,
    headers: injectedHeaders,
    body: requestBody,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  return response;
} catch (error) {
  clearTimeout(timeoutId);

  if (error.name === 'AbortError') {
    return new Response('Gateway Timeout', { status: 504 });
  }

  throw error;
}
```

### Idempotency Key Validation Schema
```typescript
// Source: Project pattern from validation.ts + Zod docs
import { z } from 'zod';

export const proxyRequestSchema = z.object({
  targetUrl: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  headers: z.record(z.string(), z.string()).optional().default({}),
  body: z.string().nullable().optional(),
  intent: z.string().min(1).max(500), // Human-readable description
  idempotencyKey: z.string().min(1).max(255).optional(),
}).refine(
  (data) => {
    // Require idempotency key for non-idempotent methods
    const method = data.method.toUpperCase();
    const needsKey = method === 'POST' || method === 'PATCH';
    return !needsKey || !!data.idempotencyKey;
  },
  {
    message: 'idempotencyKey is required for POST and PATCH requests',
    path: ['idempotencyKey'],
  }
);
```

### Database Schema for Proxy Tables
```typescript
// Source: Existing schema.ts pattern
import { pgTable, integer, varchar, timestamp, text, index, uniqueIndex } from 'drizzle-orm/pg-core';

// Idempotency keys table
export const idempotencyKeys = pgTable('idempotency_keys', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  agentId: integer()
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  key: varchar({ length: 255 }).notNull(),
  requestHash: varchar({ length: 64 }).notNull(), // SHA-256 of request
  status: varchar({ length: 20 }).notNull(), // 'processing', 'completed', 'failed'
  responseStatus: integer(), // HTTP status code
  responseBody: text(), // Cached response
  createdAt: timestamp().defaultNow().notNull(),
  completedAt: timestamp(),
  expiresAt: timestamp().notNull(), // TTL for cleanup (24-48 hours)
}, (table) => ({
  agentIdKeyIdx: uniqueIndex('idempotency_keys_agent_key_idx').on(table.agentId, table.key),
  expiresAtIdx: index('idempotency_keys_expires_at_idx').on(table.expiresAt),
}));

// Proxy request audit log
export const proxyRequests = pgTable('proxy_requests', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  agentId: integer()
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  idempotencyKeyId: integer()
    .references(() => idempotencyKeys.id)
    .nullable(),
  method: varchar({ length: 10 }).notNull(),
  targetUrl: varchar({ length: 512 }).notNull(),
  intent: varchar({ length: 500 }).notNull(),
  requestedAt: timestamp().defaultNow().notNull(),
  completedAt: timestamp(),
  statusCode: integer(), // Response status
  errorMessage: text(), // If request failed
}, (table) => ({
  agentIdIdx: index('proxy_requests_agent_id_idx').on(table.agentId),
  serviceIdIdx: index('proxy_requests_service_id_idx').on(table.serviceId),
  requestedAtIdx: index('proxy_requests_requested_at_idx').on(table.requestedAt),
}));
```

### Error Response Sanitization
```typescript
// Source: Security best practices - don't leak internal errors
function sanitizeErrorForAgent(error: unknown, targetUrl: string): Response {
  // Never expose internal error details to agents
  const url = new URL(targetUrl);
  const hostname = url.hostname; // Safe to include

  if (error instanceof Error) {
    // Network errors
    if (error.name === 'AbortError') {
      return Response.json({
        error: 'Gateway Timeout',
        message: `Request to ${hostname} timed out`,
      }, { status: 504 });
    }

    // Generic network error
    return Response.json({
      error: 'Bad Gateway',
      message: `Failed to connect to ${hostname}`,
    }, { status: 502 });
  }

  // Unknown error - don't leak details
  return Response.json({
    error: 'Internal Server Error',
    message: 'Proxy request failed',
  }, { status: 500 });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTTP proxy middleware (http-proxy) | Native fetch with manual forwarding | Bun 1.0 (2023) | Simpler, better performance, no middleware needed |
| Express-style route handlers | Bun.serve pathname routing | Bun 1.0 (2023) | Already adopted in codebase |
| In-memory idempotency (Redis) | Database with transactions | Postgres maturity | Better consistency, no separate Redis instance |
| Allowlist domains | Allowlist baseUrl per service | OWASP SSRF 2024 | More granular, matches service model |
| Global auth header injection | Per-service authType | Modern API diversity | Supports bearer, basic, API key, OAuth2 |

**Deprecated/outdated:**
- **node-http-proxy:** Bun's native fetch is simpler and more performant
- **Full URL allowlisting:** Too rigid, use baseUrl matching per service instead
- **Synchronous idempotency checks:** Race conditions, use transactions

## Open Questions

1. **Response body size limits**
   - What we know: Large responses can exhaust memory
   - What's unclear: Reasonable limit for JSON API responses (10MB? 50MB?)
   - Recommendation: Start with 10MB limit, make configurable per service

2. **Idempotency key TTL**
   - What we know: Industry standard is 24-48 hours
   - What's unclear: User preference for retention period
   - Recommendation: Default 24 hours, add cleanup job for expired keys

3. **Query parameter credential injection**
   - What we know: Some APIs use API keys in query params (e.g., ?api_key=xxx)
   - What's unclear: How to store query param vs header preference
   - Recommendation: Add credential.location field ('header' | 'query') to credentials table

4. **Intent parsing and validation**
   - What we know: Intent is required but not currently validated
   - What's unclear: Whether to enforce intent format or allow free text
   - Recommendation: Free text for Phase 4, structured in future phase

5. **Concurrent request handling**
   - What we know: Same idempotency key from same agent should be serialized
   - What's unclear: Should we queue or reject with 409?
   - Recommendation: Return 409 Conflict for concurrent requests (simpler)

## Sources

### Primary (HIGH confidence)
- [Bun HTTP Proxy Documentation](https://bun.com/docs/guides/http/proxy) - Official Bun proxy implementation
- [Bun HTTP API Documentation](https://bun.com/docs/api/http) - Bun.serve() and fetch details
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) - SSRF security controls
- [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) - READ COMMITTED guarantees
- [MDN Safe HTTP Methods](https://developer.mozilla.org/en-US/docs/Glossary/Safe/HTTP) - Safe and idempotent method definitions
- [MDN Idempotent Methods](https://developer.mozilla.org/en-US/docs/Glossary/Idempotent) - HTTP method idempotency
- [MDN Authorization Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Authorization) - Auth header formats

### Secondary (MEDIUM confidence)
- [Brandur.org - Stripe Idempotency Keys](https://brandur.org/idempotency-keys) - Production idempotency implementation
- [Stitch Fix Idempotency Pattern](https://multithreaded.stitchfix.com/blog/2017/06/26/patterns-of-soa-idempotency-key/) - SOA idempotency patterns
- [Understanding Idempotency in API Design](https://medium.com/@lelianto.eko/understanding-idempotency-in-api-design-use-cases-and-implementation-3d143aac9dd7) - Implementation guide
- [HTTP Methods Idempotency and Safety](https://www.mscharhag.com/api-design/http-idempotent-safe) - Method classification
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) - Input sanitization
- [MDN Bearer Authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Authorization) - Bearer token format
- [API Gateway Authentication Patterns](https://api7.ai/blog/api-gateway-policies) - Gateway authorization workflows

### Tertiary (LOW confidence)
- [Proxy Server Security Guidelines](https://www.watchguard.com/help/docs/help-center/en-US/Content/en-US/Fireware/proxies/http/http_proxy_bestpractices_c.html) - General proxy security (not specific to implementation)
- [HTTP Proxy Error Codes](https://oxylabs.io/blog/fix-proxy-error-codes) - Error handling patterns (general guidance)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All using existing codebase stack (Bun, Drizzle, Postgres, Zod)
- Architecture: HIGH - Bun official docs, OWASP, PostgreSQL official docs, MDN
- Pitfalls: HIGH - Based on OWASP SSRF prevention, Stripe's production patterns, PostgreSQL isolation docs
- Idempotency pattern: HIGH - Multiple authoritative sources (Stripe, Stitch Fix, official docs)
- Security controls: HIGH - OWASP official cheat sheet, MDN specifications

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - stable technology, official documentation)
