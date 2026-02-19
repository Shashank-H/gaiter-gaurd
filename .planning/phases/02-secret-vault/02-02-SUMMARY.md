---
phase: 02-secret-vault
plan: 02
subsystem: api, security
tags: [rest-api, encryption, authentication, crud]
dependency_graph:
  requires: [02-01]
  provides: [service-crud-api, credential-management]
  affects: [future-proxy-requests]
tech_stack:
  added: []
  patterns: [parameterized-routing, ownership-enforcement, credential-isolation]
key_files:
  created:
    - backend/src/services/service.service.ts
    - backend/src/utils/masking.ts
    - backend/src/routes/services.ts
    - backend/scripts/test-services.ts
  modified:
    - backend/src/server.ts
    - backend/src/utils/responses.ts
decisions:
  - Parameterized routing pattern for /services/:id paths
  - API responses show credential key names but never values
  - Replace semantics for credential updates (delete all, insert new)
  - Return 404 (not 403) for unauthorized access to prevent existence leakage
metrics:
  duration: 393
  completed: 2026-02-15
---

# Phase 02 Plan 02: Service CRUD API Summary

**One-liner:** Full REST API for service management with encrypted credential storage, ownership enforcement, and complete isolation of credential values from all API responses.

## Objective Achieved

Implemented complete service CRUD operations via REST API with transparent encryption of credentials. Users can register services, store encrypted API keys, and manage service configurations without ever exposing credential values in API responses. All operations enforce ownership and require JWT authentication.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Service service layer and masking utility | 3b1aa82 | service.service.ts, masking.ts |
| 2 | Service routes and server wiring | 0997af8 | services.ts, server.ts, test-services.ts |

## Implementation Details

### Service Layer (service.service.ts)

**Zod Validation Schemas:**
- `createServiceSchema`: Validates name, baseUrl (URL format), authType (enum), credentials (non-empty record)
- `updateServiceSchema`: Partial update with at least one field required
- `credentialsSchema`: Non-empty record of credential key-value pairs

**CRUD Functions:**

1. **createService(userId, data)**: Transactionally inserts service and encrypts all credentials
2. **getServicesByUser(userId)**: Returns all user's services with credential key names (no values)
3. **getServiceById(serviceId, userId)**: Ownership-checked single service fetch
4. **updateService(serviceId, userId, data)**: Updates service metadata, sets updatedAt
5. **deleteService(serviceId, userId)**: Cascade-deletes service, credentials, and documentation
6. **upsertCredentials(serviceId, userId, credentials)**: Replace semantics - deletes all existing credentials then inserts new ones

**Security Properties:**
- NO calls to decrypt() anywhere in the service layer - credentials stay encrypted
- All functions verify ownership via userId parameter
- Transactional credential operations ensure consistency
- NotFoundError thrown for missing/unauthorized access (404, not 403)

### Masking Utility (masking.ts)

**maskCredential(value)**: For internal/admin use only - returns "***" for short values, "abcd***efgh" for longer ones. NOT used in API responses.

**formatServiceResponse(service, credentialKeys)**: Transforms service object to replace credentials with metadata:
```json
{
  "credentials": {
    "keys": ["api_key", "secret"],
    "count": 2
  }
}
```

Shows WHICH credential keys exist, but never their values.

### Route Handlers (services.ts)

All handlers follow consistent pattern:
1. Authenticate with `requireAuth()`
2. Validate request body with Zod schemas
3. Call service layer function
4. Format response with `formatServiceResponse()`
5. Catch and return appropriate errors (AuthError → 401, ValidationError → 400, NotFoundError → 404)

**Endpoints:**

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | /services | Create service with credentials | 201 |
| GET | /services | List user's services | 200 |
| GET | /services/:id | Get single service | 200 |
| PUT | /services/:id | Update service details | 200 |
| DELETE | /services/:id | Delete service | 200 |
| POST | /services/:id/credentials | Replace all credentials | 200 |

Error handling: Never logs full error objects (could contain credentials), only error.message.

### Server Routing (server.ts)

Extended server.ts to support parameterized routes while maintaining backward compatibility with exact-match routes.

**Routing strategy:**
1. Try exact match first (existing routes like /health, /auth/*)
2. Pattern match for /services paths using regex:
   - `/services` → list/create handlers
   - `/services/(\d+)` → get/update/delete handlers with params
   - `/services/(\d+)/credentials` → credential upsert handler
3. Fall back to 404 if no match

Added imports for all service handlers and ParamRouteHandler type.

### Testing (test-services.ts)

Comprehensive end-to-end test suite covering:

**CRUD Tests:**
- Create service with credentials
- List services
- Get single service
- Update service metadata
- Update credentials (replace semantics)
- Delete service
- Verify deletion (404)

**Validation Tests:**
- Missing required fields
- Invalid URL format

**Security Tests:**
- Credential values never in responses
- No encryptedValue in responses

**Test Results:** ✅ All 13 tests passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed import path for database**
- **Found during:** Task 1 - TypeScript compilation
- **Issue:** service.service.ts imported `@/db` but correct path is `@/config/db`
- **Fix:** Changed import from `@/db` to `@/config/db` to match existing codebase pattern
- **Files modified:** backend/src/services/service.service.ts
- **Commit:** Included in 0997af8

**2. [Rule 3 - Blocking] Added missing successResponse utility**
- **Found during:** Task 2 - Server startup
- **Issue:** routes/services.ts imported `successResponse` but it didn't exist in utils/responses.ts
- **Fix:** Added successResponse as alias for jsonResponse with default 200 status
- **Files modified:** backend/src/utils/responses.ts
- **Commit:** Included in 0997af8

**3. [Rule 2 - Missing Critical] Added comprehensive test suite**
- **Found during:** Task 2 - Verification planning
- **Issue:** Plan specified manual curl tests, but automated tests are critical for verification
- **Fix:** Created test-services.ts with 13 automated tests covering CRUD, validation, and security
- **Files created:** backend/scripts/test-services.ts
- **Commit:** Included in 0997af8

## Verification Results

All success criteria met:

✅ Full service CRUD via REST API
✅ All endpoints require JWT authentication
✅ Credentials encrypted with AES-256-GCM before storage
✅ Credential values never appear in any API response
✅ Ownership enforced: users can only access their own services
✅ Cascade delete removes credentials when service is deleted
✅ Database inspection confirms iv:authTag:ciphertext format
✅ All 13 automated tests passing

**Database Verification:**
```
Sample credentials in database:
  Key: api_key
  Encrypted: eb6dd588ff01b235ce66950858b92206:5ec2ccc4bcd4fd8ebf73a12371e...
  Format check: ✓ (has iv:authTag:ciphertext)
```

## Key Technical Decisions

**Parameterized Routing Implementation:**
Chose simple regex-based pattern matching over adding a full router library. Keeps dependencies minimal and provides exactly what's needed for /services/:id patterns. Falls back cleanly to exact-match routes for backward compatibility.

**Replace Semantics for Credentials:**
Implemented credential updates as "delete all, insert new" (upsert with replace semantics) per research recommendation. Simpler than partial updates and prevents orphaned credentials. Transaction ensures atomicity.

**404 for Unauthorized Access:**
Returns 404 (not 403) when user tries to access another user's service. Prevents information leakage about which service IDs exist in the system.

**No Decrypt in Response Path:**
Architectural rule enforced: decrypt() function is NEVER called in any service layer or route handler that returns data to users. Credentials stay encrypted end-to-end. Decryption will only happen in Phase 4 when injecting credentials into outbound proxy requests.

## Self-Check

Verifying claimed artifacts exist:

✅ backend/src/services/service.service.ts exists
✅ backend/src/utils/masking.ts exists
✅ backend/src/routes/services.ts exists
✅ backend/scripts/test-services.ts exists
✅ backend/src/server.ts modified
✅ backend/src/utils/responses.ts modified
✅ Commit 3b1aa82 exists (Task 1)
✅ Commit 0997af8 exists (Task 2)

## Self-Check: PASSED
