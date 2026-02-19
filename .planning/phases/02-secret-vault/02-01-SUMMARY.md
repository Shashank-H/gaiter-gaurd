---
phase: 02-secret-vault
plan: 01
subsystem: database, security
tags: [encryption, validation, schema]
dependency_graph:
  requires: [01-01, 01-02]
  provides: [db-schema, encryption-service, validation-middleware]
  affects: [all-vault-operations]
tech_stack:
  added: [zod, crypto-module-aes-gcm]
  patterns: [scrypt-key-derivation, application-level-encryption, zod-validation]
key_files:
  created:
    - backend/src/services/encryption.service.ts
    - backend/src/middleware/validation.ts
    - backend/src/db/migrations/0001_awesome_blonde_phantom.sql
  modified:
    - backend/src/db/schema.ts
    - backend/src/config/env.ts
    - backend/src/server.ts
    - backend/package.json
decisions:
  - Application-level encryption over pgcrypto for key rotation flexibility
  - AES-256-GCM with scrypt key derivation for credential encryption
  - Zod for request validation with TypeScript inference
  - Cascade deletes on credentials/documentation when service deleted
metrics:
  duration: 216
  completed: 2026-02-15
---

# Phase 02 Plan 01: Database Schema and Encryption Foundation Summary

**One-liner:** AES-256-GCM encryption service with scrypt key derivation, three database tables (services, credentials, documentation), and Zod validation middleware.

## Objective Achieved

Established the data layer and security primitives for the secret vault system. Created database schema for services/credentials/documentation with proper foreign keys and cascade deletes, implemented AES-256-GCM encryption service with unique IVs, and added Zod-based validation middleware.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Database schema and environment config | 3699c14 | schema.ts, env.ts, migration SQL, package.json |
| 2 | Encryption service and validation middleware | 12184d7 | encryption.service.ts, validation.ts, server.ts |

## Implementation Details

### Database Schema

Created three new tables in PostgreSQL:

**services table:**
- Stores API service configurations (name, baseUrl, authType)
- Foreign key to users.id
- Index on userId for query performance

**credentials table:**
- Stores encrypted API credentials in key-value format
- Foreign key to services.id with CASCADE delete
- encryptedValue stores format: `iv:authTag:ciphertext` (all hex)
- Index on serviceId for query performance

**documentation table:**
- Stores API documentation (OpenAPI, markdown, or URL)
- Foreign key to services.id with CASCADE delete
- Supports multiple documentation types per service
- Index on serviceId for query performance

All tables include createdAt/updatedAt timestamps with default now().

### Encryption Service

**Algorithm:** AES-256-GCM (authenticated encryption)

**Key Derivation:**
- Uses scrypt (memory-hard KDF) with ENCRYPTION_SECRET and ENCRYPTION_SALT
- Derives 32-byte (256-bit) key at server startup via initEncryption()
- Key stored in module-level variable, never exposed

**encrypt() function:**
- Generates unique random 16-byte IV for each operation (NEVER reuses IVs)
- Encrypts plaintext using AES-256-GCM
- Returns format: `${iv}:${authTag}:${ciphertext}` (all hex-encoded)
- Throws if encryption not initialized

**decrypt() function:**
- Parses iv:authTag:ciphertext format
- Verifies authentication tag (detects tampering)
- Returns original plaintext or throws on corruption/tampering
- Throws if encryption not initialized or invalid format

**Security properties verified:**
- Unique IVs per encryption (same input → different output)
- Authentication tag prevents tampering
- Clear error messages on invalid format or tampering
- Encryption key never logged or exposed

### Validation Middleware

**validateBody() function:**
- Accepts any Zod schema
- Parses request JSON body
- Returns typed data with full TypeScript inference
- Throws ValidationError with formatted issues on failure

**ValidationError class:**
- Extends Error with statusCode: 400
- Contains formatted Zod issues array
- First error message used as main message
- Structured for API error responses

### Environment Configuration

Added to env.ts:
- **ENCRYPTION_SECRET:** Required, minimum 32 characters, validated at startup
- **ENCRYPTION_SALT:** Optional, defaults to 'gaiter-guard-salt-v1'

Server fails immediately if ENCRYPTION_SECRET missing or too short.

## Verification Results

All verification criteria passed:

1. ✓ Server starts without errors (ENCRYPTION_SECRET validated)
2. ✓ Three database tables created with correct columns
3. ✓ Foreign keys with CASCADE delete configured
4. ✓ Indexes on userId and serviceId foreign keys
5. ✓ Encryption round-trip works (encrypt → decrypt = original)
6. ✓ Unique IVs per encryption (same input → different ciphertext)
7. ✓ Tampered ciphertext throws clear error
8. ✓ Invalid format detection works
9. ✓ Zod validation middleware ready for use

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **Application-level encryption over pgcrypto**
   - Rationale: Enables key rotation without database dependency, better cloud-native compatibility
   - Impact: Encryption/decryption happens in application layer, not database
   - Alternative considered: PostgreSQL pgcrypto extension

2. **scrypt for key derivation**
   - Rationale: Memory-hard KDF resistant to GPU attacks, industry standard
   - Impact: Key derivation happens once at startup, ~100ms overhead acceptable
   - Alternative considered: PBKDF2 (less memory-hard)

3. **Cascade deletes on credentials/documentation**
   - Rationale: Prevents orphaned data, simplifies service deletion
   - Impact: Deleting a service automatically removes all associated credentials/docs
   - Alternative considered: Manual cleanup (rejected - error-prone)

4. **Zod over alternatives (Joi, Yup)**
   - Rationale: Best TypeScript inference, modern API, 2026 ecosystem standard
   - Impact: Full type safety from validation to handler
   - Alternative considered: Joi (less TypeScript-native)

## Dependencies

**Requires:**
- Phase 01 Plan 01 (database connection, Drizzle ORM setup)
- Phase 01 Plan 02 (env.ts pattern for configuration)

**Provides for:**
- Phase 02 Plan 02 (service CRUD operations)
- Phase 02 Plan 03 (credential management)
- All future vault operations depend on this encryption service

**Affects:**
- All credential storage and retrieval operations
- All API request validation in vault endpoints

## Technical Debt / Future Work

None identified. Implementation follows best practices:
- ✓ Cryptographically secure random IV generation
- ✓ Authenticated encryption (GCM mode)
- ✓ Proper key derivation (scrypt)
- ✓ Clear error handling
- ✓ Type-safe validation
- ✓ Database schema normalization

Potential future enhancements (not blockers):
- Key rotation strategy (version multiple keys)
- Credential masking utilities for logs/responses
- OpenAPI spec validation (@scalar/openapi-parser)
- Database triggers for updatedAt auto-update

## Self-Check: PASSED

**Files created:**
- ✓ /home/shashank/personal/gaiter-gaurd/backend/src/services/encryption.service.ts (exists)
- ✓ /home/shashank/personal/gaiter-gaurd/backend/src/middleware/validation.ts (exists)
- ✓ /home/shashank/personal/gaiter-gaurd/backend/src/db/migrations/0001_awesome_blonde_phantom.sql (exists)

**Files modified:**
- ✓ /home/shashank/personal/gaiter-gaurd/backend/src/db/schema.ts (updated)
- ✓ /home/shashank/personal/gaiter-gaurd/backend/src/config/env.ts (updated)
- ✓ /home/shashank/personal/gaiter-gaurd/backend/src/server.ts (updated)
- ✓ /home/shashank/personal/gaiter-gaurd/backend/package.json (updated)

**Commits:**
- ✓ 3699c14: feat(02-01): add database schema for secret vault (exists)
- ✓ 12184d7: feat(02-01): add encryption service and validation middleware (exists)

**Database verification:**
- ✓ services table exists with correct columns
- ✓ credentials table exists with correct columns
- ✓ documentation table exists with correct columns
- ✓ Foreign keys configured correctly
- ✓ Cascade deletes working

**Functional verification:**
- ✓ Server starts successfully
- ✓ Encryption initialized at startup
- ✓ Round-trip encryption works
- ✓ Unique IVs verified
- ✓ Tamper detection works
- ✓ ENCRYPTION_SECRET validation works
