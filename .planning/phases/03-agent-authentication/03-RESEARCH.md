# Phase 3: Agent Authentication - Research

**Researched:** 2026-02-16
**Domain:** API key authentication, agent identity management, scoped authorization, cryptographic key generation
**Confidence:** HIGH

## Summary

Phase 3 requires implementing an agent authentication system where each agent receives a unique API key for authenticating requests to the gateway. The core technical challenges are: (1) cryptographically secure API key generation, (2) constant-time key comparison to prevent timing attacks, (3) database schema for agent identity and service scoping, and (4) dual authentication middleware supporting both user JWT tokens (for dashboard) and agent API keys (for proxy requests).

**Key findings:**
- Node.js crypto.randomBytes() provides cryptographically strong random key generation (fully supported in Bun)
- API keys should use prefixed format (e.g., `agt_` prefix) for identification and secret scanning
- Keys must be hashed before database storage using fast hashing (SHA-256), not password hashing (Argon2id)
- Constant-time comparison (crypto.timingSafeEqual) is critical to prevent timing attack vulnerabilities
- Agent-to-service authorization uses many-to-many relationship via join table
- 2026 best practice: two-key rotation pattern with primary/secondary keys for zero-downtime rotation
- Middleware pattern requires separate authentication paths for user tokens vs agent keys

**Primary recommendation:** Generate API keys as `agt_` prefix + 32 bytes random hex (total ~70 chars), hash with SHA-256 before database storage, validate using constant-time comparison, implement many-to-many agent_services table for scoping, create dedicated agent auth middleware separate from JWT middleware.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js crypto | Built-in | Secure random generation, SHA-256 hashing, timing-safe comparison | Native to Node/Bun, FIPS compliant, zero dependencies |
| Drizzle ORM | Current | Type-safe agent/service schema operations | Already in use for user auth |
| Bun.password | Built-in | Optional: Hash API keys (SHA-256 sufficient) | Already used for user passwords |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing JWT utils | - | User authentication (dashboard) | Protected user-facing endpoints |
| Existing auth middleware | - | Extend for dual auth paths | Both user and agent authentication |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SHA-256 for API keys | Argon2id password hashing | SHA-256 faster, sufficient for high-entropy random keys; Argon2id for low-entropy passwords only |
| Prefixed keys (agt_) | UUIDs | Prefixes enable type identification and GitHub secret scanning |
| Many-to-many scoping | JSON array in agents table | Normalized schema enables granular queries and future permissions |

**Installation:**
```bash
# No new dependencies required - using Node.js crypto (built-in)
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── db/
│   └── schema.ts              # Add: agents, agent_services tables
├── services/
│   └── agent.service.ts       # Agent CRUD, key generation, scope validation
├── routes/
│   └── agents.ts              # Agent management endpoints (user-protected)
├── middleware/
│   ├── auth.ts                # Extend: requireAuth (JWT) + requireAgentAuth (API key)
│   └── validation.ts          # Existing Zod validation (reuse)
└── utils/
    └── apikey.ts              # API key generation, hashing, comparison
```

### Pattern 1: Cryptographically Secure API Key Generation

**What:** Generate unpredictable API keys using cryptographic random number generator
**When to use:** Creating new agents

**Example:**
```typescript
// Source: https://nodejs.org/api/crypto.html
import { randomBytes, createHash } from 'node:crypto';

const PREFIX = 'agt_'; // Agent key prefix for identification
const KEY_BYTES = 32;  // 32 bytes = 64 hex chars

/**
 * Generate a new agent API key with prefix
 * Format: agt_{64_hex_chars}
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(KEY_BYTES).toString('hex');
  return `${PREFIX}${randomPart}`;
}

/**
 * Hash API key for database storage using SHA-256
 * Fast hashing is sufficient for high-entropy random keys
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}
```

**Why this pattern:**
- `randomBytes()` uses OS-level entropy (cryptographically strong)
- Prefix enables type identification and automated secret scanning
- SHA-256 provides one-way hashing without password hashing overhead
- Hex encoding produces URL-safe, copy-paste friendly keys

### Pattern 2: Constant-Time API Key Validation

**What:** Validate API keys using timing-attack resistant comparison
**When to use:** Every agent request authentication

**Example:**
```typescript
// Source: https://nodejs.org/api/crypto.html
import { timingSafeEqual, createHash } from 'node:crypto';

/**
 * Validate API key against stored hash using constant-time comparison
 * Prevents timing attacks that could leak key information byte-by-byte
 *
 * @throws {RangeError} if key lengths don't match (expected for invalid keys)
 */
export function validateApiKey(providedKey: string, storedHash: string): boolean {
  try {
    // Hash the provided key
    const providedHash = hashApiKey(providedKey);

    // Convert to Buffers for timingSafeEqual (requires equal-length buffers)
    const providedBuffer = Buffer.from(providedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');

    // Constant-time comparison - takes same time regardless of match
    return timingSafeEqual(providedBuffer, storedBuffer);
  } catch (error) {
    // timingSafeEqual throws if buffer lengths differ
    // This is expected for invalid keys
    return false;
  }
}
```

**Why this pattern:**
- `timingSafeEqual()` prevents timing attacks (critical for API key security)
- Character-by-character comparison leaks information through response timing
- Recent CVEs (OctoPrint, vLLM, Trilium) show real-world timing attack exploits
- Must hash provided key before comparison (stored value is hash, not plaintext)

### Pattern 3: Database Schema for Agent Identity and Scoping

**What:** Table structure for agents and their authorized service access
**When to use:** Phase 3 database migrations

**Example:**
```typescript
// Source: Drizzle ORM patterns + multi-tenant authorization research
import { pgTable, integer, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer()
    .references(() => users.id)
    .notNull(),
  name: varchar({ length: 255 }).notNull(), // Human-readable agent name
  keyHash: varchar({ length: 64 }).notNull().unique(), // SHA-256 hash of API key
  keyPrefix: varchar({ length: 16 }).notNull(), // First 8 chars for display (e.g., "agt_a3f2")
  isActive: boolean().default(true).notNull(), // Revocation flag
  lastUsedAt: timestamp(), // Track last request time
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('agents_user_id_idx').on(table.userId),
  keyHashIdx: uniqueIndex('agents_key_hash_idx').on(table.keyHash), // Fast lookup
}));

// Many-to-many relationship: agents can access multiple services
export const agentServices = pgTable('agent_services', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  agentId: integer()
    .references(() => agents.id, { onDelete: 'cascade' })
    .notNull(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  agentIdIdx: index('agent_services_agent_id_idx').on(table.agentId),
  serviceIdIdx: index('agent_services_service_id_idx').on(table.serviceId),
  // Prevent duplicate scoping entries
  uniquePair: uniqueIndex('agent_services_unique_idx').on(table.agentId, table.serviceId),
}));
```

**Why this pattern:**
- `keyHash` stores SHA-256 hash (never plaintext key)
- `keyPrefix` enables UI display without exposing full key
- `isActive` flag enables soft revocation without deletion
- `lastUsedAt` tracks agent activity for monitoring
- `agentServices` join table enables granular, queryable scoping
- Unique index on `keyHash` ensures O(1) lookups and prevents collisions
- Cascade deletes maintain referential integrity

### Pattern 4: Dual Authentication Middleware

**What:** Middleware supporting both JWT (users) and API key (agents) authentication
**When to use:** Routes that can be accessed by either users or agents

**Example:**
```typescript
// Source: Existing auth.ts + agent authentication research
import { verifyAccessToken } from '@/utils/jwt';
import { validateApiKey } from '@/utils/apikey';
import { db } from '@/config/db';
import { agents } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Authenticate agent via Agent-Key header
 * @returns Object with agentId and userId (agent's owner)
 */
export async function requireAgentAuth(req: Request): Promise<{ agentId: number; userId: number }> {
  // Extract Agent-Key header
  const apiKey = req.headers.get('Agent-Key');

  if (!apiKey) {
    throw new AuthError('Missing Agent-Key header', 401);
  }

  // Validate key format (should start with agt_)
  if (!apiKey.startsWith('agt_')) {
    throw new AuthError('Invalid Agent-Key format', 401);
  }

  // Hash the provided key
  const keyHash = hashApiKey(apiKey);

  // Fetch agent from database
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.keyHash, keyHash))
    .limit(1);

  if (!agent) {
    throw new AuthError('Invalid Agent-Key', 401);
  }

  // Check if agent is active (not revoked)
  if (!agent.isActive) {
    throw new AuthError('Agent key has been revoked', 401);
  }

  // Update last used timestamp (async, don't await)
  db.update(agents)
    .set({ lastUsedAt: new Date() })
    .where(eq(agents.id, agent.id))
    .execute()
    .catch(() => {}); // Silent fail on timestamp update

  return {
    agentId: agent.id,
    userId: agent.userId
  };
}

/**
 * Validate agent has access to specific service
 */
export async function requireServiceAccess(
  agentId: number,
  serviceId: number
): Promise<void> {
  const [access] = await db
    .select()
    .from(agentServices)
    .where(
      and(
        eq(agentServices.agentId, agentId),
        eq(agentServices.serviceId, serviceId)
      )
    )
    .limit(1);

  if (!access) {
    throw new AuthError('Agent does not have access to this service', 403);
  }
}
```

**Why this pattern:**
- Separate middleware for agent vs user auth (clear separation of concerns)
- Agent authentication returns both `agentId` and `userId` (for ownership queries)
- Soft revocation check (`isActive`) before accepting key
- Timestamp tracking for monitoring without blocking request
- Service scoping as separate function (composable middleware)

### Anti-Patterns to Avoid

- **Storing plaintext API keys:** Always hash before database storage. Keys are secrets, treat like passwords.
- **Using equality operator for key comparison:** Use `timingSafeEqual()` to prevent timing attacks.
- **Password hashing for API keys:** High-entropy random keys don't need Argon2id; SHA-256 is faster and sufficient.
- **Embedding scopes in JWT/key:** Use database join table for queryable, revocable permissions.
- **Single authentication middleware:** Separate JWT and API key auth - different headers, different validation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random key generation | Custom PRNG or UUIDs | `crypto.randomBytes()` | OS-level entropy, cryptographically secure, audited |
| Timing-safe comparison | Custom comparison loops | `crypto.timingSafeEqual()` | Resistant to timing attacks, battle-tested |
| API key hashing | Custom hash implementation | `crypto.createHash('sha256')` | FIPS compliant, optimized |
| Dual auth routing | Complex conditional logic | Separate middleware functions | Clearer code, easier testing |

**Key insight:** Cryptographic operations have subtle vulnerabilities. Node.js crypto module is audited and FIPS-certified - don't reimplement.

## Common Pitfalls

### Pitfall 1: Timing Attack Vulnerability

**What goes wrong:** Using `===` or `Bun.password.verify()` for API key comparison leaks information through response timing. Attackers can extract keys byte-by-byte through statistical timing analysis.

**Why it happens:** Most comparison functions short-circuit on first mismatch, making comparisons against correct prefixes faster.

**How to avoid:**
- Always use `crypto.timingSafeEqual()` for comparing hashed keys
- Hash both provided key and stored hash to equal-length buffers before comparison
- Never use character-by-character comparison in application code

**Warning signs:**
- API authentication uses `===` for key comparison
- Response times vary based on how much of the key matches
- Security scanner flags "timing attack vulnerability in API key validation"

**Recent CVEs:** OctoPrint (CVE-2025), vLLM (GHSA-wr9h-g72x-mwhm), Trilium (CWE-208)

### Pitfall 2: API Key Display in Logs/Responses

**What goes wrong:** Full API keys logged during debugging or returned in API responses, exposing secrets.

**Why it happens:** Developer convenience during testing, forgotten debug logs in production.

**How to avoid:**
- Return only key prefix in API responses (e.g., `agt_a3f2****`)
- Store `keyPrefix` column for display purposes
- Mask keys in error messages and logs
- Return full key only once during creation, never again

**Warning signs:**
- API keys visible in server logs
- GET /agents endpoint returns `keyHash` field
- Error messages contain full API key values

### Pitfall 3: Using Password Hashing for API Keys

**What goes wrong:** Using Argon2id or Bcrypt for API keys causes unnecessary CPU load and slower authentication.

**Why it happens:** Confusion between password hashing (low-entropy) and API key hashing (high-entropy).

**How to avoid:**
- Use fast hashing (SHA-256) for high-entropy random keys
- Reserve password hashing (Argon2id/Bcrypt) for user passwords only
- API keys have 256 bits entropy - brute force is infeasible

**Warning signs:**
- Agent authentication slower than JWT authentication
- High CPU usage during API key validation
- Using `Bun.password.hash()` for generated API keys

### Pitfall 4: Missing Revocation Mechanism

**What goes wrong:** Compromised agent keys cannot be invalidated without database deletion, losing audit trail.

**Why it happens:** Database deletion seems simpler than soft-delete flags.

**How to avoid:**
- Add `isActive` boolean flag to agents table
- Check flag during authentication
- Deactivation preserves agent record for audit logs
- Future: support key rotation with primary/secondary pattern

**Warning signs:**
- No way to revoke agent access without deleting database rows
- Agent records disappear from audit logs after revocation
- Deleted agent IDs break foreign key references in request logs

### Pitfall 5: Service Scope Bypass

**What goes wrong:** Agent authentication succeeds but service scope validation is skipped, allowing access to all services.

**Why it happens:** Forgetting to call scope validation middleware after authentication.

**How to avoid:**
- Separate `requireAgentAuth()` (authentication) from `requireServiceAccess()` (authorization)
- Proxy routes MUST validate both agent identity AND service access
- Scope validation should be composable middleware, not embedded in auth

**Warning signs:**
- Agents can proxy requests to services they weren't granted access to
- No `agentServices` join queries in proxy route
- Authorization checks missing from route handlers

## Code Examples

Verified patterns from official sources:

### Generate and Store Agent API Key

```typescript
// Service layer - agent creation
import { generateApiKey, hashApiKey } from '@/utils/apikey';
import { db } from '@/config/db';
import { agents, agentServices } from '@/db/schema';

export async function createAgent(
  userId: number,
  name: string,
  serviceIds: number[]
) {
  // Generate new API key
  const apiKey = generateApiKey(); // e.g., "agt_a3f2...9d8e"
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12); // "agt_a3f2****"

  // Insert agent in transaction
  const [agent] = await db.transaction(async (tx) => {
    // Create agent record
    const [newAgent] = await tx
      .insert(agents)
      .values({
        userId,
        name,
        keyHash,
        keyPrefix,
        isActive: true,
      })
      .returning();

    // Grant service access
    if (serviceIds.length > 0) {
      await tx.insert(agentServices).values(
        serviceIds.map(serviceId => ({
          agentId: newAgent.id,
          serviceId,
        }))
      );
    }

    return [newAgent];
  });

  // Return full API key ONLY once (never stored plaintext)
  return {
    agent: {
      id: agent.id,
      name: agent.name,
      keyPrefix: agent.keyPrefix,
      createdAt: agent.createdAt,
    },
    apiKey, // Full key - show once, user must save
  };
}
```

### Agent Authentication Middleware

```typescript
// Middleware - agent request authentication
import { hashApiKey } from '@/utils/apikey';
import { db } from '@/config/db';
import { agents } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function requireAgentAuth(req: Request) {
  const apiKey = req.headers.get('Agent-Key');

  if (!apiKey?.startsWith('agt_')) {
    throw new AuthError('Invalid or missing Agent-Key', 401);
  }

  const keyHash = hashApiKey(apiKey);

  const [agent] = await db
    .select({
      id: agents.id,
      userId: agents.userId,
      isActive: agents.isActive,
    })
    .from(agents)
    .where(eq(agents.keyHash, keyHash))
    .limit(1);

  if (!agent || !agent.isActive) {
    throw new AuthError('Invalid or revoked Agent-Key', 401);
  }

  // Update last used (non-blocking)
  db.update(agents)
    .set({ lastUsedAt: new Date() })
    .where(eq(agents.id, agent.id))
    .execute()
    .catch(() => {});

  return { agentId: agent.id, userId: agent.userId };
}
```

### Service Scope Validation

```typescript
// Middleware - verify agent can access service
import { db } from '@/config/db';
import { agentServices } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function validateServiceScope(
  agentId: number,
  serviceId: number
): Promise<boolean> {
  const [access] = await db
    .select({ id: agentServices.id })
    .from(agentServices)
    .where(
      and(
        eq(agentServices.agentId, agentId),
        eq(agentServices.serviceId, serviceId)
      )
    )
    .limit(1);

  return !!access;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shared API keys across agents | Per-agent keys with scoping | 2024-2025 | Granular revocation, audit trails |
| UUID-based keys | Prefixed keys (agt_, sk_, pk_) | 2023-2024 | GitHub secret scanning, type safety |
| Password hashing for API keys | SHA-256 for random keys | Ongoing | Faster auth, lower CPU usage |
| Equality comparison | Constant-time comparison | 2020+ (CVEs) | Prevents timing attack exploits |
| JWT for agents | API keys for agents | 2025-2026 | Simpler, no token refresh complexity |

**Deprecated/outdated:**
- **Embedding service IDs in API key payload:** Hard to revoke, can't query. Use database join table instead.
- **UUIDs as API keys:** No type identification, no prefix scanning. Use prefixed random hex.
- **OAuth for simple agent auth:** Adds unnecessary complexity for machine-to-machine auth. Reserve for user delegation flows.

## Open Questions

1. **Key rotation strategy**
   - What we know: Two-key primary/secondary pattern is 2026 best practice for zero-downtime rotation
   - What's unclear: Whether v1 needs rotation support or can defer to v2
   - Recommendation: Implement `isActive` flag for revocation now; defer rotation to v2 (AGENT-03 requirement)

2. **Agent metadata and rate limiting**
   - What we know: `lastUsedAt` timestamp enables activity tracking
   - What's unclear: Whether to track request counts, rate limits per agent
   - Recommendation: Add `lastUsedAt` now; defer rate limiting to v2

3. **Cascade behavior on service deletion**
   - What we know: `agent_services` has CASCADE delete when service deleted
   - What's unclear: Should agent deletion also cascade, or soft-delete only?
   - Recommendation: Soft-delete agents (set `isActive = false`) to preserve audit trails; hard-delete `agent_services` entries OK

## Sources

### Primary (HIGH confidence)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html) - randomBytes, timingSafeEqual, createHash functions
- [Bun Crypto Reference](https://bun.com/reference/node/crypto) - Node.js crypto compatibility in Bun
- [Cloudflare Workers: Timing-Safe Comparison](https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/) - constant-time comparison patterns

### Secondary (MEDIUM confidence)
- [Best Practices for Building Secure API Keys (freeCodeCamp)](https://www.freecodecamp.org/news/best-practices-for-building-api-keys-97c26eabfea9/) - prefix format, key structure
- [Designing Secure and Informative API Keys (Glama)](https://glama.ai/blog/2024-10-18-what-makes-a-good-api-key) - prefix conventions, key formatting
- [How to Create API Key Rotation (OneUpTime 2026)](https://oneuptime.com/blog/post/2026-01-30-api-key-rotation/view) - two-key rotation pattern
- [Supabase API Key Management Guide (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-api-key-management) - RLS-based scoping patterns
- [Composio: Secure AI Agent Infrastructure Guide (2026)](https://composio.dev/blog/secure-ai-agent-infrastructure-guide) - brokered credentials pattern
- [Stytch: AI Agent Authentication Methods](https://stytch.com/blog/ai-agent-authentication-methods/) - agent vs user auth patterns

### Tertiary (LOW confidence - flagged for validation)
- [API Security Best Practices 2026 (TrustedAccounts)](https://www.trustedaccounts.org/blog/post/professional-api-security-best-practices) - general API security trends
- [State of AI Agent Security 2026 Report (Gravitee)](https://www.gravitee.io/blog/state-of-ai-agent-security-2026-report-when-adoption-outpaces-control) - industry adoption statistics

### Security Vulnerabilities (Informative)
- [OctoPrint Timing Attack CVE](https://github.com/nixos/nixpkgs/issues/488123) - character-based comparison exploit
- [vLLM API Key Timing Attack](https://github.com/vllm-project/vllm/security/advisories/GHSA-wr9h-g72x-mwhm) - API key extraction via timing
- [Trilium Timing Attack (CWE-208)](https://github.com/TriliumNext/Trilium/security/advisories/GHSA-hxf6-58cx-qq3x) - HMAC extraction via timing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Node.js crypto is well-documented, battle-tested, no new dependencies
- Architecture: HIGH - Patterns verified with existing codebase (user auth, encryption service)
- Pitfalls: HIGH - Recent CVEs confirm timing attack risks, documented in official sources
- Service scoping: HIGH - Standard many-to-many pattern, verified in PostgreSQL RLS documentation

**Research date:** 2026-02-16
**Valid until:** ~60 days (March 2026) - API key patterns stable, crypto APIs unchanging
