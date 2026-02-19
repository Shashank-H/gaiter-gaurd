---
phase: 01-foundation
plan: 02
subsystem: authentication
tags: [auth, jwt, argon2id, token-rotation, jose]
dependency_graph:
  requires:
    - http-server
    - database-connection
    - users-table
    - refresh-tokens-table
  provides:
    - user-registration
    - user-login
    - jwt-authentication
    - token-refresh
    - protected-routes
  affects: []
tech_stack:
  added:
    - jose (JWT library for token creation and verification)
  patterns:
    - JWT access tokens with 15-minute expiry
    - Refresh token rotation (single-use tokens)
    - Argon2id password hashing
    - Bearer token authentication
    - Custom AuthError class for auth failures
key_files:
  created:
    - src/utils/jwt.ts
    - src/services/auth.service.ts
    - src/routes/auth.ts
    - src/middleware/auth.ts
  modified:
    - src/server.ts
decisions:
  - decision: Use jose library for JWT operations
    rationale: Per 01-RESEARCH.md recommendation - well-maintained, TypeScript-native, follows modern standards
    impact: HS256 algorithm with configurable expiry durations
  - decision: Implement refresh token rotation
    rationale: Security best practice - each refresh invalidates the previous token
    impact: Prevents token reuse attacks, requires database lookup on refresh
  - decision: Store only hashed refresh tokens in database
    rationale: Defense in depth - even if database is compromised, tokens cannot be reused
    impact: Requires Bun.password.verify for token matching
  - decision: Return generic "Invalid credentials" for all login failures
    rationale: Security - don't leak whether email exists in database
    impact: Prevents user enumeration attacks
metrics:
  duration_minutes: 3
  tasks_completed: 2
  files_created: 4
  commits: 2
  completed_date: 2026-02-15
---

# Phase 01 Plan 02: Authentication System Summary

JWT auth with refresh rotation using jose library, Argon2id password hashing, and protected route middleware.

## What Was Built

### JWT Infrastructure
- **Token creation** using jose library with HS256 algorithm
- **Access tokens** with 15-minute expiry (configurable via JWT_ACCESS_EXPIRY)
- **Refresh tokens** with 7-day expiry (configurable via JWT_REFRESH_EXPIRY)
- **Token verification** with error handling for invalid/expired tokens
- **Duration parser** supporting s/m/h/d units (e.g., "15m", "7d")

### Authentication Service
Three core functions in `src/services/auth.service.ts`:

1. **registerUser(email, password)**
   - Email format validation (basic regex)
   - Password length validation (minimum 8 characters)
   - Duplicate email detection (returns 409)
   - Argon2id password hashing (memoryCost: 65536, timeCost: 2)
   - Returns user object without password hash

2. **loginUser(email, password)**
   - Credential verification with Bun.password.verify
   - Generic "Invalid credentials" message (prevents user enumeration)
   - JWT token pair generation (access + refresh)
   - Refresh token hashing and database storage
   - Returns tokens and user object

3. **refreshAccessToken(refreshToken)**
   - JWT signature verification first
   - Database lookup for matching hashed token
   - Token rotation - old token deleted, new pair issued
   - Returns new access token and refresh token

### Authentication Middleware
- **requireAuth(req)** function for protecting routes
- Bearer token extraction from Authorization header
- JWT verification with descriptive error messages
- Custom **AuthError** class with statusCode property
- Returns userId for use in route handlers

### API Endpoints
Four new endpoints in `src/routes/auth.ts`:

1. **POST /auth/register**
   - Body: `{ email, password }`
   - Success: 201 with `{ message, user }`
   - Duplicate: 409 with error message
   - Validation failure: 400 with error message

2. **POST /auth/login**
   - Body: `{ email, password }`
   - Success: 200 with `{ accessToken, refreshToken, user }`
   - Invalid credentials: 401

3. **POST /auth/refresh**
   - Body: `{ refreshToken }`
   - Success: 200 with new `{ accessToken, refreshToken }`
   - Invalid/reused token: 401

4. **GET /auth/me** (protected)
   - Header: `Authorization: Bearer <token>`
   - Success: 200 with `{ user: { id, email, createdAt } }`
   - Missing/invalid token: 401

### Server Updates
- Added auth route handlers to routing table
- Updated handler signature to accept Request object
- Added try/catch wrapper for internal error handling
- Maintained existing health endpoint functionality
- Method validation for all routes (405 on wrong method)

## Tasks Completed

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1 | JWT utilities and auth service | 806c7df | src/utils/jwt.ts, src/services/auth.service.ts |
| 2 | Auth routes, middleware, and server integration | de7fbfb | src/routes/auth.ts, src/middleware/auth.ts, src/server.ts |

## Verification Results

All success criteria met:

**Full Auth Flow:**
- ✅ User can register with email/password (201 response)
- ✅ Duplicate registration returns 409
- ✅ User can login and receive JWT token pair
- ✅ Invalid credentials return 401 without leaking email existence
- ✅ Protected route (/auth/me) accessible with valid token
- ✅ Protected route returns 401 without token
- ✅ Refresh token generates new token pair
- ✅ Old refresh token invalidated (401 on reuse)
- ✅ New access token from refresh works for protected routes

**Security Features:**
- ✅ Passwords stored as Argon2id hashes
- ✅ Refresh tokens stored as hashes in database
- ✅ No raw passwords or tokens in responses
- ✅ Generic error messages prevent user enumeration
- ✅ Token rotation prevents reuse attacks

**System Health:**
- ✅ Health endpoints still functional (/health, /ready)
- ✅ All responses use consistent JSON structure
- ✅ Global error handler catches unexpected errors

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### Password Hashing
Using Bun's built-in Argon2id implementation with strong parameters:
- Memory cost: 65536 (64 MB)
- Time cost: 2 iterations
- Algorithm: argon2id (resistant to both GPU and side-channel attacks)

### Token Storage
Refresh tokens are hashed before storage using Bun.password.hash (same Argon2id algorithm). This means:
- Database compromise doesn't expose usable tokens
- Token matching requires iterating through user's tokens with verify()
- Trade-off: slight performance cost on refresh for significant security gain

### Token Rotation
Each refresh operation:
1. Verifies JWT signature (ensures token was issued by us)
2. Finds matching hash in database
3. Deletes old token
4. Issues new token pair
5. Stores new token hash

This prevents token reuse attacks even if a token is intercepted.

### Duration Parsing
Custom parser converts human-readable durations (15m, 7d) to seconds for JWT expiry. Supports:
- s (seconds)
- m (minutes)
- h (hours)
- d (days)

### Error Handling
Three-tier error handling:
1. **Route level**: Catches service errors and returns appropriate HTTP status
2. **Middleware level**: AuthError with statusCode for auth failures
3. **Server level**: Global try/catch returns 500 for unexpected errors

## Dependencies for Next Plan

This plan completes Phase 1 (Foundation). All Phase 1 success criteria met:
- ✅ Bun.js HTTP server running with health checks
- ✅ PostgreSQL database with migration system
- ✅ User authentication system (email/password, JWT)
- ✅ Protected routes requiring authentication

Ready for Phase 2 (Secret Vault) which will use the auth system to protect vault operations.

## Self-Check: PASSED

All created files verified:
- FOUND: src/utils/jwt.ts
- FOUND: src/services/auth.service.ts
- FOUND: src/routes/auth.ts
- FOUND: src/middleware/auth.ts

All commits verified:
- FOUND: commit 806c7df (Task 1)
- FOUND: commit de7fbfb (Task 2)
