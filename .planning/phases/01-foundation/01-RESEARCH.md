# Phase 1: Foundation - Research

**Researched:** 2026-02-15
**Domain:** Bun.js runtime, PostgreSQL database, Drizzle ORM, REST API architecture
**Confidence:** MEDIUM-HIGH

## Summary

Phase 1 establishes the foundational infrastructure for the application: a Bun.js HTTP server with PostgreSQL database and authentication system. The research confirms that the chosen stack (Bun + Drizzle ORM + PostgreSQL) is well-supported and follows current best practices as of early 2026.

**Key findings:**
- Bun.js provides native TypeScript support and built-in password hashing (Argon2id), eliminating need for external packages like bcrypt
- Drizzle ORM has embraced PostgreSQL's identity columns (replacing serial types) as the 2025+ standard
- The ecosystem recommends `postgres.js` driver over `node-postgres` for Bun environments due to better performance
- JWT authentication with refresh token rotation requires database-backed token storage for security

**Primary recommendation:** Use Bun's built-in features (password hashing, TypeScript execution) wherever possible to minimize dependencies, and adopt Drizzle Kit's "generate & migrate" workflow for team-friendly migration management.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun | latest (1.2.3+) | Runtime & HTTP server | Native TypeScript, built-in crypto, 2.5x faster than Node.js |
| drizzle-orm | latest | ORM for database queries | Lightweight (~7.4kb), zero dependencies, type-safe SQL |
| drizzle-kit | latest | Migration management CLI | Official migration tooling from Drizzle team |
| postgres | latest (postgres.js) | PostgreSQL driver | Recommended for Bun, uses prepared statements by default |
| @types/pg | latest | TypeScript types | Type definitions if using node-postgres alternative |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg-native | latest | Performance boost | Optional: 10% speed increase with node-postgres driver |
| jose | latest | JWT operations | If using custom JWT; Bun has built-in crypto |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| postgres.js | node-postgres | node-postgres more mature but slower; use if existing ecosystem deps |
| Drizzle ORM | Prisma | Prisma heavier (code generation), better for large teams unfamiliar with SQL |
| Argon2id (Bun built-in) | bcrypt package | bcrypt proven but older standard; Argon2 is NIST-recommended 2025+ |

**Installation:**
```bash
bun add drizzle-orm postgres
bun add -D drizzle-kit
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── server.ts           # Bun.serve() entry point
├── config/             # Database connection, env vars
│   └── db.ts
├── db/                 # Drizzle schema and migrations
│   ├── schema.ts       # Table definitions
│   └── migrations/     # Generated SQL files
├── routes/             # API route handlers
│   ├── auth.ts         # /auth/* endpoints
│   └── health.ts       # /health, /ready endpoints
├── services/           # Business logic (auth, user management)
│   └── auth.service.ts
├── middleware/         # JWT validation, error handling
│   └── auth.middleware.ts
└── utils/              # Shared utilities
    └── responses.ts    # Standardized JSON response helpers
```

**Rationale:** Feature-first is emerging for 2026, but for a foundational phase with limited features, the traditional layered approach (routes/services/middleware) provides clear separation and is easier to onboard with.

### Pattern 1: Bun.serve() with Route Handlers
**What:** Use Bun's built-in `routes` object (v1.2.3+) for declarative routing
**When to use:** All HTTP endpoints; replaces Express-style middleware chains
**Example:**
```typescript
// Source: https://bun.com/docs/runtime/http/server
Bun.serve({
  port: process.env.PORT || 3000,
  routes: {
    "/health": new Response("OK"),
    "/api/users/:id": {
      GET: (req) => {
        const userId = req.params.id;
        return Response.json({ userId });
      },
    },
  },
  error(error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  },
});
```

### Pattern 2: Drizzle Schema with Identity Columns
**What:** Use PostgreSQL `GENERATED ALWAYS AS IDENTITY` instead of `serial` types
**When to use:** All auto-incrementing primary keys (2025+ PostgreSQL standard)
**Example:**
```typescript
// Source: https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717
import { pgTable, integer, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Pattern 3: Drizzle Database Connection with Pool
**What:** Initialize Drizzle with postgres.js client and connection pool configuration
**When to use:** Application startup in `config/db.ts`
**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/get-started-postgresql
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const queryClient = postgres(process.env.DATABASE_URL!, { max: 10 });
export const db = drizzle({ client: queryClient });
```

### Pattern 4: Password Hashing with Bun
**What:** Use Bun's built-in `Bun.password.hash()` and `Bun.password.verify()`
**When to use:** User registration and login (replaces bcrypt/argon2 packages)
**Example:**
```typescript
// Source: https://bun.com/docs/guides/util/hash-a-password
// Registration
const hashedPassword = await Bun.password.hash(userPassword, {
  algorithm: "argon2id", // default
  memoryCost: 65536,
  timeCost: 2,
});

// Login
const isValid = await Bun.password.verify(userPassword, hashedPassword);
```

### Pattern 5: Migration Workflow
**What:** Generate SQL migrations from schema changes, apply via Drizzle Kit
**When to use:** All schema changes after initial setup
**Example:**
```bash
# Source: https://orm.drizzle.team/docs/migrations

# 1. Update src/db/schema.ts with changes
# 2. Generate migration SQL
bun drizzle-kit generate

# 3. Apply migrations to database
bun drizzle-kit migrate
```

**Configuration (drizzle.config.ts):**
```typescript
// Source: https://orm.drizzle.team/docs/kit-overview
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Pattern 6: Structured JSON Error Responses
**What:** Centralized error handler returning consistent JSON format
**When to use:** Global error boundary in `Bun.serve({ error })`
**Example:**
```typescript
// Source: https://bun.com/docs/runtime/http/error-handling
Bun.serve({
  fetch(req) {
    // ... routes
  },
  error(error) {
    return Response.json(
      {
        error: error.message,
        statusCode: error.statusCode || 500
      },
      { status: error.statusCode || 500 }
    );
  },
});
```

### Pattern 7: JWT Refresh Token Rotation with Database Storage
**What:** Store refresh tokens in PostgreSQL, rotate on each use, track token families
**When to use:** Authentication system requiring logout/revocation capabilities
**Example:**
```typescript
// Source: https://jsschools.com/web_dev/jwt-authentication-security-guide-refresh-token/
// Schema
export const refreshTokens = pgTable('refresh_tokens', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Token rotation logic
async function rotateRefreshToken(oldToken: string) {
  // 1. Verify old token and get userId
  // 2. Invalidate old token in DB
  // 3. Generate new access + refresh tokens
  // 4. Store new refresh token hash in DB
  // 5. Return both tokens
}
```

### Anti-Patterns to Avoid
- **Don't use serial types:** PostgreSQL deprecated `serial` in favor of `GENERATED ALWAYS AS IDENTITY` (2025+ standard)
- **Don't store JWTs in localStorage:** Use HTTP-only cookies to prevent XSS token theft
- **Don't manually edit migration files:** Always generate migrations via `drizzle-kit generate` to maintain snapshots
- **Don't use global process.env directly:** Centralize in `config/` with validation (prevents runtime failures from missing vars)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom crypto implementation | `Bun.password.hash()` | Built-in Argon2id is NIST-recommended, handles salt/params automatically |
| JWT creation/verification | Custom signing logic | Bun's Web Crypto API or `jose` | Timing attacks, algorithm confusion, key management complexity |
| SQL migration diffing | Manual ALTER TABLE scripts | `drizzle-kit generate` | Tracks schema snapshots, handles column renames, prevents conflicts |
| Connection pooling | Custom pool manager | postgres.js config (`{ max: 10 }`) | Connection leaks, timeout handling, health checks |
| Request validation | String parsing/regex | Validation library (zod, yup) | Type coercion, nested object validation, error messages |

**Key insight:** Bun consolidates features that typically require external packages (bcrypt, ts-node, nodemon). Always check Bun's built-in APIs before adding dependencies.

## Common Pitfalls

### Pitfall 1: Using `drizzle-kit migrate` in Production Runtime
**What goes wrong:** Running migrations during app startup can cause race conditions in multi-instance deployments, leading to duplicate migration attempts or connection pool exhaustion.
**Why it happens:** Documentation shows runtime migration examples (`migrate()` function), which work for local development but fail under load.
**How to avoid:** Use `drizzle-kit migrate` as a pre-deployment step in CI/CD pipeline, never in application startup code.
**Warning signs:** "Migration already applied" errors, connection timeouts during deployment, multiple instances hitting database simultaneously.

### Pitfall 2: Forgetting `drizzle.config.ts` for Team Collaboration
**What goes wrong:** Team members can't generate consistent migrations because config is missing or uses hardcoded values.
**Why it happens:** Drizzle works without config file for simple cases, leading developers to skip it initially.
**How to avoid:** Create `drizzle.config.ts` immediately after `bun add drizzle-kit`, use environment variables for credentials.
**Warning signs:** Git conflicts in migration files, migrations that work locally but fail in CI/CD.

### Pitfall 3: Not Configuring Connection Pool Limits
**What goes wrong:** Database runs out of connections under load, causing "remaining connection slots are reserved for non-replication superuser connections" errors.
**Why it happens:** postgres.js defaults to unlimited connections; PostgreSQL defaults to 100 max connections.
**How to avoid:** Set `{ max: 10 }` when initializing postgres client (adjust based on instance count × max per instance < DB limit).
**Warning signs:** Intermittent connection failures, errors mentioning "max_connections", database refusing new connections.

### Pitfall 4: Storing Refresh Tokens as Plain JWTs
**What goes wrong:** Cannot revoke refresh tokens on logout/compromise; users remain authenticated indefinitely.
**Why it happens:** Tutorials show stateless JWT-only auth, developers assume refresh tokens work the same way.
**How to avoid:** Store refresh token hashes in PostgreSQL `refresh_tokens` table, implement rotation and family tracking.
**Warning signs:** Feature request for "force logout all devices", inability to revoke access after password change.

### Pitfall 5: Missing Index on Foreign Keys
**What goes wrong:** Queries with JOINs become slow as tables grow; `WHERE user_id = ?` scans entire table.
**Why it happens:** Drizzle creates foreign key constraints but doesn't automatically index them (unlike some ORMs).
**How to avoid:** Explicitly add `.index()` to foreign key columns in schema definition.
**Warning signs:** Queries fast with 100 rows, slow with 10,000+ rows; `EXPLAIN` shows sequential scans on FK columns.
**Example:**
```typescript
export const posts = pgTable('posts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
}, (table) => ({
  userIdIdx: index('user_id_idx').on(table.userId), // Add this!
}));
```

### Pitfall 6: Using `drizzle-kit push` Beyond Prototyping
**What goes wrong:** No migration history for rollbacks, team members have schema drift, production changes can't be audited.
**Why it happens:** `push` is faster (no SQL files), works great for solo rapid development.
**How to avoid:** Switch to `generate` + `migrate` workflow before adding second team member or deploying to staging.
**Warning signs:** "My local DB schema doesn't match yours", inability to roll back breaking changes, compliance/audit failures.

### Pitfall 7: Not Implementing Health Check Database Pings
**What goes wrong:** Load balancers/orchestrators route traffic to instances with dead database connections.
**Why it happens:** `/health` endpoint returns 200 OK without checking database connectivity.
**How to avoid:** Implement `/ready` endpoint that executes `db.execute('SELECT 1')` before returning success.
**Warning signs:** "Service is up but returning 500 errors", Kubernetes restart loops due to failed liveness probes.

## Code Examples

Verified patterns from official sources:

### Health Check Endpoints with Database Verification
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-31-bun-production-deployment/view
import { db } from './config/db';

Bun.serve({
  routes: {
    "/health": new Response("OK"), // Liveness probe (fast)

    "/ready": {
      GET: async () => {
        try {
          await db.execute('SELECT 1'); // Check DB connection
          return Response.json({ status: "ready", database: "connected" });
        } catch (error) {
          return Response.json(
            { status: "not ready", database: "disconnected" },
            { status: 503 }
          );
        }
      }
    },
  },
});
```

### Authentication Registration Flow
```typescript
// Source: Composite from https://bun.com/docs/guides/util/hash-a-password
// and https://orm.drizzle.team/docs/get-started-postgresql
import { db } from '../config/db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function registerUser(email: string, password: string) {
  // Check if user exists
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    throw new Error('User already exists');
  }

  // Hash password with Bun built-in (Argon2id)
  const passwordHash = await Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 2,
  });

  // Insert user
  const [newUser] = await db.insert(users).values({
    email,
    passwordHash,
  }).returning();

  return { id: newUser.id, email: newUser.email };
}
```

### Authentication Login Flow with JWT
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-31-bun-jwt-authentication/view
import { db } from '../config/db';
import { users, refreshTokens } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function loginUser(email: string, password: string) {
  // Find user
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValid = await Bun.password.verify(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  // Generate tokens (using Bun's Web Crypto API)
  const accessToken = await generateAccessToken(user.id); // 15 min expiry
  const refreshToken = await generateRefreshToken(); // Random secure token

  // Store refresh token hash
  const refreshTokenHash = await Bun.password.hash(refreshToken);
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  return { accessToken, refreshToken };
}

async function generateAccessToken(userId: number): Promise<string> {
  // Use jose or Bun's Web Crypto for JWT signing
  // Implementation depends on choice of library
  // Return signed JWT with { userId, exp: 15min }
}

async function generateRefreshToken(): Promise<string> {
  // Generate cryptographically secure random token
  return crypto.randomUUID();
}
```

### Drizzle Migration Application Script
```typescript
// Source: https://orm.drizzle.team/docs/migrations
// scripts/migrate.ts - Run as: bun run scripts/migrate.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function runMigrations() {
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(migrationClient);

  await migrate(db, { migrationsFolder: './src/db/migrations' });

  await migrationClient.end();
  console.log('Migrations complete');
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

### Standardized JSON Response Utilities
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-31-bun-rest-api/view
// utils/responses.ts
export function jsonResponse<T>(
  data: T,
  status: number = 200
): Response {
  return Response.json(data, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(
  message: string,
  statusCode: number = 500
): Response {
  return Response.json(
    { error: message, statusCode },
    { status: statusCode }
  );
}

// Usage in routes
Bun.serve({
  routes: {
    "/api/users/:id": {
      GET: async (req) => {
        try {
          const userId = parseInt(req.params.id);
          const user = await getUserById(userId);
          return jsonResponse(user);
        } catch (error) {
          return errorResponse('User not found', 404);
        }
      },
    },
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt for passwords | Argon2id (Bun built-in) | 2025+ | NIST-recommended, Bun native support |
| `serial` primary keys | `GENERATED ALWAYS AS IDENTITY` | 2025+ | PostgreSQL official recommendation |
| node-postgres as default | postgres.js for Bun | 2024+ | Better performance, prepared statements |
| ts-node for TypeScript | Bun native execution | 2023+ | No transpilation step, faster startup |
| Stateless JWT-only auth | JWT + DB-backed refresh tokens | Ongoing | Enables logout/revocation capabilities |
| Organizing by type (MVC) | Feature-first architecture | 2026 emerging | Better for large codebases; overkill for Phase 1 |

**Deprecated/outdated:**
- **serial/bigserial types**: Use `integer().generatedAlwaysAsIdentity()` instead
- **bcrypt npm package**: Bun's `Bun.password.hash()` is built-in and uses Argon2id
- **ts-node/tsx for running TypeScript**: Bun executes `.ts` files natively
- **nodemon for hot reload**: Bun has `--watch` flag built-in (`bun --watch src/server.ts`)
- **dotenv package**: Bun loads `.env` files automatically

## Open Questions

1. **JWT Library Choice**
   - What we know: Bun has Web Crypto API; `jose` is the standard library that works with Bun
   - What's unclear: Performance comparison between Bun's built-in crypto vs jose for JWT operations
   - Recommendation: Start with `jose` (proven, widely documented), profile later if performance becomes concern

2. **Development Database Management**
   - What we know: Docker is common for local PostgreSQL, but Bun docs don't specify tooling preferences
   - What's unclear: Whether to use Docker Compose, local PostgreSQL install, or cloud dev database
   - Recommendation: Use existing localhost:5432 setup per requirements; document setup in README for team onboarding

3. **Password Reset Token Storage**
   - What we know: Refresh tokens should be in database; password reset is similar use case
   - What's unclear: Separate table vs reusing refresh_tokens table with type discriminator
   - Recommendation: Separate `password_reset_tokens` table (clearer intent, different expiry rules, simpler cleanup queries)

4. **API Versioning Strategy**
   - What we know: Foundation phase establishes patterns; versioning adds complexity
   - What's unclear: Whether to implement `/v1/` prefix now or add when needed
   - Recommendation: Skip for Phase 1 (only internal dashboard client); add before external API consumers in later phase

## Sources

### Primary (HIGH confidence)
- [Bun.js Official Server Docs](https://bun.com/docs/runtime/http/server) - HTTP server API, routing, lifecycle
- [Bun.js Password Hashing Guide](https://bun.com/docs/guides/util/hash-a-password) - Built-in Argon2id/bcrypt implementation
- [Drizzle ORM PostgreSQL Setup](https://orm.drizzle.team/docs/get-started-postgresql) - Installation, connection patterns
- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations) - Migration workflow strategies
- [Drizzle ORM Kit Overview](https://orm.drizzle.team/docs/kit-overview) - Drizzle Kit vs Drizzle ORM distinction

### Secondary (MEDIUM confidence)
- [Drizzle PostgreSQL Best Practices (2025 Gist)](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) - Community guide on identity columns, patterns
- [How to Build REST APIs with Bun (2026)](https://oneuptime.com/blog/post/2026-01-31-bun-rest-api/view) - Error handling patterns
- [How to Implement JWT Authentication with Bun (2026)](https://oneuptime.com/blog/post/2026-01-31-bun-jwt-authentication/view) - Auth patterns
- [Bun PostgreSQL Connection Guide (2026)](https://oneuptime.com/blog/post/2026-01-31-bun-postgresql/view) - Built-in Postgres client in Bun 1.2
- [JWT Security Guide with Refresh Tokens (2026)](https://jsschools.com/web_dev/jwt-authentication-security-guide-refresh-token/) - Token rotation architecture
- [Password Hashing Guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) - Argon2 vs bcrypt comparison
- [3 Biggest Mistakes with Drizzle ORM](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff) - Common pitfalls

### Tertiary (LOW confidence - marked for validation)
- WebSearch results on Bun.js microservices patterns - architectural guidance needs project-specific validation
- WebSearch results on TypeScript project structure debates (2026) - feature-first vs layered is context-dependent

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - Official documentation confirms all library choices, versions current
- Architecture: **MEDIUM-HIGH** - Patterns verified from official docs; project structure is conventional wisdom
- Pitfalls: **MEDIUM** - Mix of official docs (migration issues) and community experiences (FK indexes, token storage)

**Research date:** 2026-02-15
**Valid until:** ~2026-03-15 (30 days - stack is relatively stable, but Bun updates frequently)

**Notes:**
- Bun 1.2+ required for `routes` feature; verify Bun version during setup
- Drizzle ecosystem actively evolving; monitor for breaking changes in drizzle-kit
- JWT/auth patterns stable; refresh token rotation is industry standard as of 2026
