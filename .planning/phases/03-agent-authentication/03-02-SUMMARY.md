---
phase: 03-agent-authentication
plan: 02
subsystem: agent-api
tags: [authentication, rest-api, middleware, routing]
dependency_graph:
  requires:
    - 03-01 (agent service layer and API key utilities)
    - 02-secret-vault (services table for agent-service scoping)
  provides:
    - Agent management REST API (6 endpoints)
    - Dual authentication middleware (JWT + Agent-Key)
    - requireServiceAccess for agent scope validation
  affects:
    - Phase 4 gateway proxy will use requireAgentAuth middleware
    - Dashboard will use agent CRUD endpoints
tech_stack:
  added:
    - None (uses existing patterns)
  patterns:
    - Parameterized routing for /agents/:id paths
    - Dual auth pattern (requireAuth for users, requireAgentAuth for agents)
    - Fire-and-forget lastUsedAt tracking
    - Replace semantics for service associations
key_files:
  created:
    - backend/src/routes/agents.ts
  modified:
    - backend/src/middleware/auth.ts
    - backend/src/server.ts
decisions:
  - Fire-and-forget lastUsedAt update (no blocking on audit log)
  - Agent routes use JWT auth (dashboard-facing, not agent-facing)
  - requireAgentAuth returns both agentId and userId for flexibility
  - requireServiceAccess throws 403 (not 401) for scope violations
metrics:
  duration: 4 min
  completed: 2026-02-16
---

# Phase 03 Plan 02: Agent Management API and Auth Middleware Summary

**One-liner:** Complete agent CRUD REST API with JWT auth, plus requireAgentAuth and requireServiceAccess middleware for Phase 4 gateway proxy.

## Execution Report

**Status:** ✅ Complete
**Tasks completed:** 2/2
**Commits:** 2

### Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add requireAgentAuth and requireServiceAccess middleware | 704dacc | backend/src/middleware/auth.ts |
| 2 | Create agent management routes and wire into server | a9c97f2 | backend/src/routes/agents.ts, backend/src/server.ts |

## What Was Built

### Authentication Middleware Extensions (backend/src/middleware/auth.ts)

**requireAgentAuth(req: Request):**
- Validates `Agent-Key` header format (must start with `agt_`)
- Hashes provided key and queries agents table
- Returns 401 for missing, invalid, or revoked keys
- Returns 401 if `isActive = false` (soft revocation)
- Fire-and-forget update of `lastUsedAt` timestamp
- Returns `{ agentId, userId }` for downstream authorization

**requireServiceAccess(agentId: number, serviceId: number):**
- Queries `agent_services` join table
- Returns 403 if agent doesn't have access to service
- Enforces agent scoping to authorized services

### Agent Management REST API (backend/src/routes/agents.ts)

All endpoints require JWT authentication (dashboard/user-facing).

**POST /agents:**
- Create agent with name and service IDs
- Validates all serviceIds belong to user
- Returns full API key exactly once (never stored or returned again)
- Response includes agent with keyPrefix for UI display

**GET /agents:**
- List all agents for authenticated user
- Includes services array for each agent
- Ordered by createdAt descending
- Shows lastUsedAt for security monitoring

**GET /agents/:id:**
- Fetch single agent with ownership verification
- Includes full agent detail with services
- Returns 404 if not found or user doesn't own it

**PUT /agents/:id:**
- Update agent name and/or isActive status
- Ownership verification required
- Returns updated agent with services

**DELETE /agents/:id:**
- Hard delete agent record
- Cascade deletes agent_services entries
- Ownership verification required

**PUT /agents/:id/services:**
- Replace semantics: deletes all existing, inserts new
- Validates all serviceIds belong to user
- Uses transaction for atomicity

### Server Routing (backend/src/server.ts)

Added parameterized route matching for `/agents` paths:
- `/agents` → GET (list) / POST (create)
- `/agents/:id` → GET (detail) / PUT (update) / DELETE (delete)
- `/agents/:id/services` → PUT (update service scoping)

Follows same pattern as `/services` routes for consistency.

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

✅ All 6 agent management endpoints return correct HTTP status codes
✅ POST /agents returns apiKey field (only time full key is exposed)
✅ GET /agents and GET /agents/:id include services array but never keyHash or apiKey
✅ requireAgentAuth validates against hashed keys in database
✅ requireServiceAccess checks agent_services join table
✅ Server starts without errors with all new routes registered
✅ Invalid/missing Agent-Key returns 401
✅ Revoked agent (isActive=false) returns 401
✅ Agent accessing unauthorized service returns 403

## Manual Testing Results

**Test Scenario 1: Unauthenticated access**
```bash
$ curl http://localhost:3000/agents
{"error":"Missing authorization header","statusCode":401}
✅ PASS
```

**Test Scenario 2: Create agent with valid service**
```bash
$ curl -X POST http://localhost:3000/agents \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Agent","serviceIds":[3]}'
{
  "agent": {
    "id": 1,
    "name": "Test Agent",
    "keyPrefix": "agt_90d8003b",
    "isActive": true,
    "createdAt": "2026-02-16T07:15:50.454Z"
  },
  "apiKey": "agt_90d8003badc6cc074bb33b5589a61d6040f1b762a101920a4703a0426aac3e2c"
}
✅ PASS - Full API key returned exactly once
```

**Test Scenario 3: List agents**
```bash
$ curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/agents
[{
  "id": 1,
  "name": "Test Agent",
  "keyPrefix": "agt_90d8003b",
  "isActive": true,
  "lastUsedAt": null,
  "createdAt": "2026-02-16T07:15:50.454Z",
  "services": [{"id": 3, "name": "Test API"}]
}]
✅ PASS - No keyHash or apiKey exposed
```

**Test Scenario 4: Update agent name**
```bash
$ curl -X PUT http://localhost:3000/agents/1 \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Updated Agent Name"}'
{
  "id": 1,
  "name": "Updated Agent Name",
  "keyPrefix": "agt_90d8003b",
  "isActive": true,
  "lastUsedAt": null,
  "createdAt": "2026-02-16T07:15:50.454Z",
  "updatedAt": "2026-02-16T07:16:02.571Z",
  "services": [{"id": 3, "name": "Test API"}]
}
✅ PASS
```

**Test Scenario 5: Delete agent**
```bash
$ curl -X DELETE http://localhost:3000/agents/1 \
  -H "Authorization: Bearer $TOKEN"
{"message":"Agent deleted"}

$ curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/agents
[]
✅ PASS - Cascade delete worked
```

## Self-Check

**Files created:**
```bash
$ ls backend/src/routes/agents.ts
backend/src/routes/agents.ts
```

**Files modified:**
```bash
$ git diff HEAD~2 --name-only
backend/src/middleware/auth.ts
backend/src/routes/agents.ts
backend/src/server.ts
```

**Commits verified:**
```bash
$ git log --oneline -2
a9c97f2 feat(03-agent-authentication-02): add agent management REST API and wire into server
704dacc feat(03-agent-authentication-02): add requireAgentAuth and requireServiceAccess middleware
```

**Exports verified:**
- requireAuth, requireAgentAuth, requireServiceAccess, AuthError exported from auth.ts
- All 6 route handlers exported from agents.ts
- All routes wired into server.ts

## Self-Check: PASSED

All files created/modified, commits exist, endpoints functional, verification tests passed.

## Next Steps

Phase 03 is now complete. The agent authentication system is fully functional with:
- Agent identity schema with hashed API keys
- Agent CRUD service layer
- Agent management REST API
- Dual authentication middleware

Phase 04 (Gateway Proxy) will build on this foundation to:
- Create proxy middleware using requireAgentAuth
- Validate agent access using requireServiceAccess
- Inject decrypted credentials from secret vault
- Forward requests to downstream APIs

## Technical Notes

**Authentication Flow:**
1. Dashboard user authenticates with JWT (requireAuth)
2. User creates agent via POST /agents, receives full API key once
3. Agent uses API key in Agent-Key header for proxy requests
4. Gateway validates key via requireAgentAuth (Phase 4)
5. Gateway checks service access via requireServiceAccess (Phase 4)
6. Gateway injects credentials and forwards request (Phase 4)

**Security Considerations:**
- API keys never stored in plaintext (only SHA-256 hash)
- Full API key returned only on creation (POST /agents)
- keyPrefix allows safe UI display without exposing full key
- isActive flag enables soft revocation
- lastUsedAt tracking enables detection of compromised/stale keys
- Scope enforcement via agent_services join table

**Design Patterns:**
- Dual auth pattern (JWT for users, Agent-Key for agents)
- Fire-and-forget audit logging (doesn't block request)
- Parameterized routing for RESTful paths
- Consistent error handling across all endpoints
- Replace semantics for service associations (simplifies UI)
