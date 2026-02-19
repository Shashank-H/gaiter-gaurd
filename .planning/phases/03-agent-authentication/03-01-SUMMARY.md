---
phase: 03-agent-authentication
plan: 01
subsystem: agent-identity
tags: [schema, authentication, api-keys, cryptography]
dependency_graph:
  requires:
    - 02-secret-vault (services table for agent-service scoping)
  provides:
    - agents table with hashed API key storage
    - agent_services join table for scoping
    - API key utilities (generate, hash, validate)
    - Agent CRUD service layer
  affects:
    - Future agent authentication middleware will use validateApiKey
    - Future agent routes will use agent.service.ts operations
tech_stack:
  added:
    - node:crypto (randomBytes, createHash, timingSafeEqual)
  patterns:
    - SHA-256 hashing for API key storage
    - Constant-time comparison for key validation
    - API key prefix display (agt_{12_chars}...)
    - Soft revocation via isActive boolean
    - Last-used tracking via lastUsedAt timestamp
key_files:
  created:
    - backend/src/utils/apikey.ts
    - backend/src/services/agent.service.ts
  modified:
    - backend/src/db/schema.ts
decisions:
  - Use agt_ prefix for agent API keys (vs service-specific prefixes)
  - Store only key hash, return full key once on creation
  - Use keyPrefix (12 chars) for safe display in UI
  - Soft delete via isActive flag (vs hard delete)
  - Track lastUsedAt for security monitoring (updated by future middleware)
metrics:
  duration: 2 min
  completed: 2026-02-16
---

# Phase 03 Plan 01: Agent Identity Schema and Service Layer Summary

**One-liner:** Agent schema with SHA-256 hashed API keys, service scoping via join table, and complete CRUD service layer using node:crypto utilities.

## Execution Report

**Status:** ✅ Complete
**Tasks completed:** 2/2
**Commits:** 2

### Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add agents schema and API key utilities | 6a43937 | backend/src/db/schema.ts, backend/src/utils/apikey.ts |
| 2 | Create agent service layer with CRUD operations | 22c61f9 | backend/src/services/agent.service.ts |

## What Was Built

### Database Schema

**agents table:**
- Stores agent identities with hashed API keys
- Columns: id, userId, name, keyHash (unique), keyPrefix, isActive, lastUsedAt, createdAt, updatedAt
- Indexes: userId index, unique index on keyHash

**agent_services table:**
- Many-to-many join between agents and services
- Enforces agent scoping to specific services
- Columns: id, agentId, serviceId, createdAt
- Indexes: agentId, serviceId, unique pair constraint

### API Key Utilities (backend/src/utils/apikey.ts)

**generateApiKey():**
- Generates 32 random bytes (64 hex chars) with `agt_` prefix
- Total length: 68 chars (`agt_` + 64 hex)

**hashApiKey(apiKey):**
- SHA-256 hashing using node:crypto
- Returns 64-character hex digest

**validateApiKey(providedKey, storedHash):**
- Constant-time comparison using `timingSafeEqual`
- Prevents timing attacks on key validation
- Returns false on any error (invalid buffer, length mismatch)

### Agent Service Layer (backend/src/services/agent.service.ts)

**createAgent(userId, { name, serviceIds }):**
- Generates API key and hashes it
- Verifies all serviceIds belong to user
- Uses transaction to atomically create agent + service associations
- Returns full API key **exactly once** (never stored or returned again)
- Returns agent with keyPrefix for UI display

**getAgentsByUser(userId):**
- Lists all agents for user with service details
- Ordered by createdAt descending
- Includes lastUsedAt for security monitoring

**getAgentById(agentId, userId):**
- Fetches single agent with ownership verification
- Includes associated services via join

**updateAgent(agentId, userId, { name?, isActive? }):**
- Updates agent metadata
- Ownership verification required
- Sets updatedAt timestamp

**deleteAgent(agentId, userId):**
- Hard deletes agent record
- Cascade deletes agent_services entries
- Ownership verification required

**updateAgentServices(agentId, userId, { serviceIds }):**
- Replace semantics: deletes all existing associations, inserts new ones
- Verifies all serviceIds belong to user
- Uses transaction for atomicity

### Validation Schemas

- `createAgentSchema`: name (3-100 chars), serviceIds (min 1)
- `updateAgentSchema`: name or isActive (at least one required)
- `updateAgentServicesSchema`: serviceIds (min 1)

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

✅ agents and agent_services tables exist in database with correct columns, indexes, and foreign keys
✅ generateApiKey() produces unique, prefixed keys (verified: agt_prefix, 68 chars total)
✅ hashApiKey() produces deterministic SHA-256 hashes (verified: 64 hex chars, consistent)
✅ validateApiKey() uses constant-time comparison (timingSafeEqual from node:crypto)
✅ createAgent() returns full key exactly once, stores only hash
✅ All CRUD operations enforce user ownership via userId checks

## Self-Check

**Files created:**
```bash
$ ls backend/src/utils/apikey.ts
backend/src/utils/apikey.ts

$ ls backend/src/services/agent.service.ts
backend/src/services/agent.service.ts
```

**Schema changes applied:**
```bash
$ bunx drizzle-kit push
✓ Changes applied
```

**Commits verified:**
```bash
$ git log --oneline -2
22c61f9 feat(03-agent-authentication): add agent service with CRUD operations
6a43937 feat(03-agent-authentication): add agents schema and API key utilities
```

## Self-Check: PASSED

All files created, schema applied, commits exist. Verification tests confirm:
- API key generation produces `agt_` prefixed keys
- Hashing produces 64-char SHA-256 hex
- Validation uses constant-time comparison
- Service layer compiles without errors

## Next Steps

Phase 03 Plan 02 will build on this foundation to:
- Add agent authentication middleware using validateApiKey
- Create agent API routes (POST /agents, GET /agents, etc.)
- Implement lastUsedAt tracking in middleware
- Add agent-scoped request context

## Technical Notes

**Security considerations:**
- API keys never stored in plaintext (only SHA-256 hash)
- Constant-time comparison prevents timing attacks
- keyPrefix allows safe UI display without exposing full key
- isActive flag enables soft revocation without deleting records
- lastUsedAt enables detection of compromised/stale keys

**Design patterns:**
- Transaction usage ensures atomic agent+scope creation
- Ownership verification on all operations prevents privilege escalation
- Replace semantics for service associations (simplifies UI logic)
- Zod schemas provide runtime validation + TypeScript inference
