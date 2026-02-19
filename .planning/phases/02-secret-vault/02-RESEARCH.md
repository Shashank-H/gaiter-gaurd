# Phase 2: Secret Vault - Research

**Researched:** 2026-02-15
**Domain:** Encryption at rest, secret management, credential storage, API documentation management
**Confidence:** HIGH

## Summary

Phase 2 requires implementing a secure service registry where users can store API credentials encrypted at rest, upload API documentation, and manage service configurations. The core technical challenge is application-level encryption using Node.js crypto APIs with proper key management, combined with secure CRUD operations in PostgreSQL via Drizzle ORM.

**Key findings:**
- Drizzle ORM does not have built-in encrypted column support; encryption must be handled at the application layer
- Node.js crypto module (fully supported by Bun) provides AES-256-GCM for authenticated encryption
- Encryption keys should be derived from environment variables using proper key derivation, stored separately from data
- API documentation can be stored as text/varchar (for URLs), text (for markdown), or text (for OpenAPI JSON/YAML)
- Bun's native FormData API handles multipart uploads for documentation files

**Primary recommendation:** Implement application-level AES-256-GCM encryption with a service-layer abstraction that encrypts before database writes and decrypts after reads. Store encryption keys in environment variables, use text columns in PostgreSQL for encrypted data, and leverage Drizzle transactions for atomic operations involving credentials.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js crypto | Built-in | AES-256-GCM encryption/decryption | Native to Node/Bun, FIPS compliant, battle-tested |
| Drizzle ORM | Current | Type-safe database operations | Already in use, supports transactions |
| Zod | Latest | Runtime schema validation | TypeScript-first, auto-infers types, 2026 standard |
| Bun FormData | Built-in | Multipart file upload handling | Native Web API, zero dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @scalar/openapi-parser | Latest | OpenAPI spec validation | When validating uploaded OpenAPI specs |
| @readme/openapi-parser | Latest | Alternative OpenAPI parser | If need better error messages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node.js crypto | Dedicated library (sodium) | Crypto module sufficient for AES-GCM, no added deps |
| Application-level encryption | PostgreSQL pgcrypto | App-level gives key rotation flexibility, pgcrypto ties to DB |
| Zod | Joi, Yup | Zod has better TypeScript inference, cleaner API |

**Installation:**
```bash
cd backend
bun add zod @scalar/openapi-parser
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── db/
│   └── schema.ts              # Add services, credentials, documentation tables
├── services/
│   ├── encryption.service.ts  # AES-256-GCM encrypt/decrypt logic
│   ├── service.service.ts     # Service CRUD with auto-encrypt credentials
│   └── documentation.service.ts # Documentation upload/storage
├── routes/
│   ├── services.ts            # REST endpoints for service management
│   └── documentation.ts       # Documentation upload endpoints
├── middleware/
│   ├── auth.ts                # Existing JWT auth (reuse)
│   └── validation.ts          # Zod schema validation middleware
└── utils/
    └── masking.ts             # Credential masking for logs/responses
```

### Pattern 1: Encryption Service Layer

**What:** Service abstraction that encrypts data before database writes and decrypts after reads
**When to use:** Any time credentials are stored or retrieved

**Example:**
```typescript
// Source: https://nodejs.org/api/crypto.html + research findings
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;

// Derive encryption key from environment variable (do once at startup)
const ENCRYPTION_KEY = scryptSync(
  process.env.ENCRYPTION_SECRET!,
  process.env.ENCRYPTION_SALT || 'default-salt',
  KEY_LENGTH
);

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Pattern 2: Database Schema for Services

**What:** Table structure for services, credentials, and documentation
**When to use:** Phase 2 database migrations

**Example:**
```typescript
// Source: https://orm.drizzle.team/docs/column-types/pg
import { pgTable, integer, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';

export const services = pgTable('services', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer()
    .references(() => users.id)
    .notNull(),
  name: varchar({ length: 255 }).notNull(),
  baseUrl: varchar({ length: 512 }).notNull(),
  authType: varchar({ length: 50 }).notNull(), // 'api_key', 'bearer', 'basic', etc.
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('services_user_id_idx').on(table.userId),
}));

export const credentials = pgTable('credentials', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  key: varchar({ length: 255 }).notNull(), // e.g., 'api_key', 'username'
  encryptedValue: text().notNull(), // Stores: iv:authTag:ciphertext
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  serviceIdIdx: index('credentials_service_id_idx').on(table.serviceId),
}));

export const documentation = pgTable('documentation', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  serviceId: integer()
    .references(() => services.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar({ length: 50 }).notNull(), // 'openapi', 'markdown', 'url'
  content: text().notNull(), // JSON for OpenAPI, markdown text, or URL string
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => ({
  serviceIdIdx: index('documentation_service_id_idx').on(table.serviceId),
}));
```

### Pattern 3: Service Layer with Auto-Encryption

**What:** CRUD operations that transparently encrypt credentials on write, decrypt on read
**When to use:** All credential operations

**Example:**
```typescript
// Source: Research findings + https://orm.drizzle.team/docs/transactions
import { db } from '@/config/db';
import { services, credentials } from '@/db/schema';
import { encrypt, decrypt } from '@/services/encryption.service';
import { eq } from 'drizzle-orm';

export async function createService(
  userId: number,
  data: {
    name: string;
    baseUrl: string;
    authType: string;
    credentials: Record<string, string>; // e.g., { api_key: 'sk-...' }
  }
) {
  return await db.transaction(async (tx) => {
    // Create service
    const [service] = await tx.insert(services).values({
      userId,
      name: data.name,
      baseUrl: data.baseUrl,
      authType: data.authType,
    }).returning();

    // Encrypt and store credentials
    const credentialEntries = Object.entries(data.credentials).map(([key, value]) => ({
      serviceId: service.id,
      key,
      encryptedValue: encrypt(value),
    }));

    await tx.insert(credentials).values(credentialEntries);

    return service;
  });
}

export async function getServiceCredentials(serviceId: number) {
  const creds = await db.select()
    .from(credentials)
    .where(eq(credentials.serviceId, serviceId));

  // Decrypt credentials
  return creds.reduce((acc, cred) => {
    acc[cred.key] = decrypt(cred.encryptedValue);
    return acc;
  }, {} as Record<string, string>);
}
```

### Pattern 4: Credential Masking

**What:** Never expose secrets in API responses or logs
**When to use:** All API responses, all logging statements

**Example:**
```typescript
// Source: https://betterstack.com/community/guides/logging/sensitive-data/
export function maskCredential(value: string): string {
  if (value.length <= 8) return '***';
  return value.slice(0, 4) + '***' + value.slice(-4);
}

export function maskServiceResponse(service: any) {
  return {
    ...service,
    // NEVER return actual credentials in API responses
    hasCredentials: true, // Just indicate presence
  };
}

// In routes
app.get('/api/services/:id', async (req) => {
  const service = await getService(id);
  return jsonResponse(maskServiceResponse(service));
});
```

### Pattern 5: Zod Validation Middleware

**What:** Type-safe request validation before route handlers
**When to use:** All POST/PUT endpoints

**Example:**
```typescript
// Source: https://zod.dev/
import { z } from 'zod';

const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  baseUrl: z.string().url().max(512),
  authType: z.enum(['api_key', 'bearer', 'basic', 'oauth2']),
  credentials: z.record(z.string(), z.string()).refine(
    (obj) => Object.keys(obj).length > 0,
    { message: 'At least one credential required' }
  ),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export function validateRequest<T extends z.ZodSchema>(schema: T) {
  return async (req: Request) => {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(result.error.format());
    }

    return result.data as z.infer<T>;
  };
}

// Usage in routes
const data = await validateRequest(createServiceSchema)(req);
```

### Pattern 6: File Upload for Documentation

**What:** Handle multipart form data for OpenAPI/markdown file uploads
**When to use:** Documentation upload endpoints

**Example:**
```typescript
// Source: https://bun.com/docs/guides/http/file-uploads
export async function handleDocumentationUpload(req: Request) {
  const formData = await req.formData();

  const serviceId = formData.get('serviceId') as string;
  const type = formData.get('type') as string; // 'openapi' | 'markdown'
  const file = formData.get('file') as Blob;

  if (!file) {
    throw new Error('No file uploaded');
  }

  const content = await file.text();

  // For OpenAPI, validate spec
  if (type === 'openapi') {
    // Will use @scalar/openapi-parser for validation
    const isValid = await validateOpenAPISpec(content);
    if (!isValid) {
      throw new Error('Invalid OpenAPI specification');
    }
  }

  // Store in database
  await db.insert(documentation).values({
    serviceId: parseInt(serviceId),
    type,
    content,
  });
}
```

### Anti-Patterns to Avoid

- **Storing plaintext credentials:** ALWAYS encrypt before database write
- **Reusing IVs:** ALWAYS generate new random IV for each encryption operation
- **Logging credentials:** NEVER log decrypted credentials, mask them first
- **Returning credentials in API responses:** NEVER expose encrypted or decrypted credentials to frontend
- **Hardcoding encryption keys:** ALWAYS use environment variables
- **Skipping auth tag verification:** ALWAYS use authenticated encryption (GCM mode)
- **Global transactions:** NEVER use long-running transactions, keep them short and focused

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom object validators | Zod | Type inference, error formatting, composition |
| OpenAPI parsing | Custom JSON parser | @scalar/openapi-parser | Handles $ref resolution, validation, versions 2.0-3.1 |
| Encryption | Custom cipher implementation | Node.js crypto module | FIPS compliance, constant-time operations, audited |
| Random IV generation | Math.random() | crypto.randomBytes() | Cryptographically secure, prevents pattern attacks |
| Password-based key derivation | Simple hashing | scrypt/pbkdf2 | Memory-hard, configurable cost, salt handling |
| JWT validation | String manipulation | jose (already in use) | Timing-safe comparison, algorithm validation |

**Key insight:** Cryptography and validation are domains where subtle mistakes lead to catastrophic security failures. Use well-audited, standard libraries rather than custom implementations.

## Common Pitfalls

### Pitfall 1: Reusing Initialization Vectors
**What goes wrong:** Using the same IV for multiple encryption operations leaks information about plaintext patterns
**Why it happens:** Developers store IV as constant or reuse first-generated value for performance
**How to avoid:** Generate new random IV for EVERY encryption operation using crypto.randomBytes(16)
**Warning signs:** Encrypted values for same plaintext are identical

### Pitfall 2: Not Verifying Authentication Tag
**What goes wrong:** Encrypted data could be tampered with without detection
**Why it happens:** Forgetting to call decipher.setAuthTag() before decipher.final() in GCM mode
**How to avoid:** ALWAYS set auth tag before final(), handle decryption errors as tampering
**Warning signs:** Decryption succeeds for corrupted/modified ciphertext

### Pitfall 3: Exposing Credentials in Logs
**What goes wrong:** Credentials end up in application logs, accessible to anyone with log access
**Why it happens:** Logging request/response bodies without sanitization
**How to avoid:** Implement masking layer, NEVER log objects containing credential fields
**Warning signs:** Grep logs for 'api_key', 'secret', 'password' and find actual values

### Pitfall 4: Weak Key Derivation
**What goes wrong:** Encryption key derived from weak password/salt becomes guessable
**Why it happens:** Using simple hashing instead of proper KDF, weak salt, low iteration count
**How to avoid:** Use scrypt with 32-byte output, random salt stored in env, strong base secret
**Warning signs:** Key derivation happens in milliseconds (should take 100ms+)

### Pitfall 5: Reading Hex Buffers Incorrectly
**What goes wrong:** Encryption key becomes half its intended size, drastically weakening security
**Why it happens:** Using Buffer.from(key) instead of Buffer.from(key, 'hex') for hex strings
**How to avoid:** Always specify encoding when converting strings to buffers
**Warning signs:** 64-char hex string produces 32-byte buffer instead of 32-byte buffer

### Pitfall 6: Missing Cascade Deletes
**What goes wrong:** Orphaned credentials/documentation remain after service deletion
**Why it happens:** Not setting onDelete: 'cascade' in foreign key references
**How to avoid:** Use { onDelete: 'cascade' } in Drizzle foreign key definitions
**Warning signs:** Credential count grows without bound, manual cleanup scripts needed

### Pitfall 7: Transaction Timeout
**What goes wrong:** Long-running transaction locks database, causing timeouts
**Why it happens:** Performing encryption, file I/O, or validation inside transaction
**How to avoid:** Prepare/validate data BEFORE starting transaction, keep tx minimal
**Warning signs:** Database lock errors, increased query latency under load

### Pitfall 8: Forgetting updatedAt Triggers
**What goes wrong:** updatedAt timestamp never changes after creation
**Why it happens:** Drizzle doesn't auto-update timestamps on row modification
**How to avoid:** Explicitly set updatedAt in UPDATE queries OR use database triggers
**Warning signs:** updatedAt equals createdAt for edited records

## Code Examples

Verified patterns from official sources:

### Complete Encryption/Decryption with Error Handling
```typescript
// Source: https://nodejs.org/api/crypto.html
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function initEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  const salt = process.env.ENCRYPTION_SALT || 'gaiter-guard-salt-v1';

  if (!secret || secret.length < 32) {
    throw new Error('ENCRYPTION_SECRET must be at least 32 characters');
  }

  return scryptSync(secret, salt, 32);
}

let ENCRYPTION_KEY: Buffer;

export function initEncryption() {
  ENCRYPTION_KEY = initEncryptionKey();
}

export function encrypt(plaintext: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption not initialized');
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption not initialized');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
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
```

### Drizzle Transaction with Rollback
```typescript
// Source: https://orm.drizzle.team/docs/transactions
import { db } from '@/config/db';

export async function deleteServiceWithCredentials(serviceId: number, userId: number) {
  return await db.transaction(async (tx) => {
    // Verify ownership
    const [service] = await tx.select()
      .from(services)
      .where(eq(services.id, serviceId))
      .limit(1);

    if (!service) {
      tx.rollback(); // Explicit rollback
      throw new Error('Service not found');
    }

    if (service.userId !== userId) {
      tx.rollback();
      throw new Error('Unauthorized');
    }

    // Delete service (cascade will delete credentials/docs)
    await tx.delete(services).where(eq(services.id, serviceId));

    return { deleted: true };
  });
}
```

### Zod Schema with Refinements
```typescript
// Source: https://zod.dev/
import { z } from 'zod';

export const createServiceSchema = z.object({
  name: z.string().min(1, 'Name required').max(255, 'Name too long'),
  baseUrl: z.string().url('Invalid URL').max(512),
  authType: z.enum(['api_key', 'bearer', 'basic', 'oauth2']),
  credentials: z.record(z.string(), z.string())
    .refine(
      (creds) => Object.keys(creds).length > 0,
      { message: 'At least one credential required' }
    )
    .refine(
      (creds) => Object.values(creds).every(v => v.length > 0),
      { message: 'Credential values cannot be empty' }
    ),
});

export const updateServiceSchema = createServiceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be updated' }
);
```

### REST API Route Handler Pattern
```typescript
// Source: Research findings + existing backend/src/routes/auth.ts
import { requireAuth } from '@/middleware/auth';
import { jsonResponse, errorResponse } from '@/utils/responses';
import { createService } from '@/services/service.service';
import { validateRequest } from '@/middleware/validation';
import { createServiceSchema } from '@/schemas/service.schema';

export async function handleCreateService(req: Request): Promise<Response> {
  try {
    // Authenticate
    const { userId } = await requireAuth(req);

    // Validate
    const data = await validateRequest(createServiceSchema)(req);

    // Execute
    const service = await createService(userId, data);

    // Mask response (NEVER return credentials)
    return jsonResponse({
      id: service.id,
      name: service.name,
      baseUrl: service.baseUrl,
      authType: service.authType,
      createdAt: service.createdAt,
    }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ValidationError) {
      return errorResponse(error.message, 400);
    }
    // NEVER log the error object if it might contain credentials
    console.error('Service creation failed:', error.message);
    return errorResponse('Service creation failed', 500);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| express-validator | Zod schema validation | 2024-2025 | Better TypeScript inference, cleaner API |
| @apidevtools/swagger-parser | @scalar/openapi-parser | 2025 | Modern TypeScript, better OpenAPI 3.1 support |
| serial columns | generatedAlwaysAsIdentity() | PostgreSQL 10+/Drizzle 2024+ | More SQL standard compliant |
| pgcrypto for encryption | Application-level with crypto module | Ongoing | Better key rotation, cloud-native compatibility |
| Environment variable strings | Zod-validated env with env.ts | 2024+ | Type safety for configuration |

**Deprecated/outdated:**
- **crypto.createCipher()**: Deprecated in favor of createCipheriv() (requires explicit IV)
- **serial/bigserial**: Use generatedAlwaysAsIdentity() for PostgreSQL identity columns
- **@apidevtools/swagger-parser**: Use @scalar/openapi-parser for new projects (more maintained)

## Open Questions

1. **Key Rotation Strategy**
   - What we know: Encryption keys should rotate every 1-2 years per best practices
   - What's unclear: How to re-encrypt existing credentials without downtime
   - Recommendation: Start with single key (v1), plan key versioning system for Phase 3+

2. **File Size Limits for Documentation**
   - What we know: Bun supports FormData, can store in text columns
   - What's unclear: Recommended max size for OpenAPI specs stored as text
   - Recommendation: Start with 1MB limit, use file storage if specs exceed this

3. **Credential Update Pattern**
   - What we know: Need to handle partial updates to credentials
   - What's unclear: Should update replace all credentials or merge with existing?
   - Recommendation: Replace semantics (explicit delete if key not in update payload)

4. **Multi-Credential Services**
   - What we know: Some services need multiple keys (API key + secret)
   - What's unclear: Best UX for managing related credential pairs
   - Recommendation: Use key-value pairs in credentials table, group by serviceId

## Sources

### Primary (HIGH confidence)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html) - AES-256-GCM API, best practices
- [Bun Crypto API Reference](https://bun.com/reference/node/crypto) - Bun compatibility with Node crypto
- [Bun File Uploads Guide](https://bun.com/docs/guides/http/file-uploads) - FormData handling
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions) - Transaction patterns
- [Drizzle ORM PostgreSQL Types](https://orm.drizzle.team/docs/column-types/pg) - Column types
- [Zod Documentation](https://zod.dev/) - Schema validation patterns

### Secondary (MEDIUM confidence)
- [PostgreSQL Encryption Options](https://www.postgresql.org/docs/current/encryption-options.html) - Official encryption guidance
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) - Security best practices
- [Better Stack: Logging Sensitive Data](https://betterstack.com/community/guides/logging/sensitive-data/) - Log masking patterns
- [REST API Naming Conventions](https://restfulapi.net/resource-naming/) - Endpoint design
- [Drizzle ORM Best Practices Gist](https://gist.github.com/productdevbook/7c9ce3bbeb96b3fabc3c7c2aa2abc717) - Community patterns

### Tertiary (LOW confidence - needs validation)
- [Drizzle Encrypted Columns Issue #2098](https://github.com/drizzle-team/drizzle-orm/issues/2098) - Feature request for native encryption (not implemented)
- [Bun Multipart Issue #19097](https://github.com/oven-sh/bun/issues/19097) - Known FormData intermittent failures (monitor)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Node.js crypto and Drizzle patterns are well-documented and verified
- Architecture: HIGH - Encryption service layer is industry standard, verified via official docs
- Pitfalls: HIGH - Sourced from official security guides and Node.js documentation
- OpenAPI parsing: MEDIUM - Multiple library options, @scalar/openapi-parser is newer
- File uploads: MEDIUM - Bun FormData support verified but has reported issues in some versions

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - stable technologies)

**Notes:**
- No CONTEXT.md existed, full research discretion applied
- Focused on application-level encryption over database-level (pgcrypto) for key rotation flexibility
- Recommended Zod over alternatives based on 2026 ecosystem trends toward TypeScript-first validation
- Bun FormData has some reported issues but is official approach, alternative parsers available if needed
