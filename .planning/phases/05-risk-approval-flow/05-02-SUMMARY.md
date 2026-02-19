---
phase: 05-risk-approval-flow
plan: 02
subsystem: api
tags: [risk-assessment, approval-queue, proxy, polling, ttl-cleanup, postgres]

# Dependency graph
requires:
  - phase: 05-risk-approval-flow
    plan: 01
    provides: approval.service.ts, risk.service.ts, approval_queue table, and LLM env vars
  - phase: 04-gateway-proxy-core
    provides: executeProxyRequest, injectCredentials, forwardRequest in proxy.service.ts

provides:
  - Risk gate wired into executeProxyRequest — risky requests throw RiskyRequestError (428)
  - RiskyRequestError class with actionId, riskScore, riskExplanation fields
  - GET /status/:actionId endpoint returning PENDING/APPROVED/DENIED/EXPIRED/EXECUTED shapes
  - POST /proxy/execute/:actionId endpoint with TTL check, fresh credential injection, result caching
  - 5-minute setInterval TTL cleanup for stale APPROVED entries
  - Full risk-to-execution flow complete

affects:
  - Phase 06 (dashboard) — approval UI will call GET /status and trigger APPROVED/DENIED transitions

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Strip auth headers before storing in approval_queue (credentials never persisted, re-injected at execute time)
    - Ownership enforcement: 404 for both not-found and wrong-agent (avoids revealing entry existence)
    - TTL check at execute time: transitionStatus(APPROVED→EXPIRED) fire-and-forget on stale request
    - markExecuted fire-and-forget: response cached but doesn't block the caller's response
    - Risk gate positioned after URL validation, before idempotency (risky requests never touch idempotency store)

key-files:
  created:
    - backend/src/routes/approval.ts
  modified:
    - backend/src/services/proxy.service.ts
    - backend/src/routes/proxy.ts
    - backend/src/server.ts

key-decisions:
  - "Risk gate positioned before idempotency check: risky requests blocked regardless of cached state, idempotency store stays clean"
  - "Ownership check returns 404 (not 403) for wrong agent: prevents enumeration of other agents' action IDs"
  - "markExecuted fire-and-forget: response stored asynchronously, doesn't add latency to execute response"
  - "Auth headers stripped at gate (before storage), credentials injected fresh at execution time from encrypted vault"

patterns-established:
  - "Auth header stripping before approval_queue storage: delete Authorization, authorization, Agent-Key, agent-key variants"
  - "Status polling response shapes: PENDING shows created_at, APPROVED shows execute_url, EXECUTED shows full result"
  - "TTL check at execute endpoint (not just cleanup job): defense in depth against expired approvals being executed"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-02-17
---

# Phase 5 Plan 02: Risk Gate, Status Polling, and Execute Endpoint Summary

**End-to-end risk-approval flow: risky proxy requests blocked with 428 + actionId, status polling with 5-state JSON shapes, approved requests executed with fresh credential injection and response caching**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-17T09:29:02Z
- **Completed:** 2026-02-17T09:32:00Z
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Risk assessment gate wired into `executeProxyRequest()` between URL validation and idempotency check — `assessRisk()` called, blocked requests stored in `approval_queue` with auth headers stripped, `RiskyRequestError` thrown
- `handleProxy` catches `RiskyRequestError` and returns 428 with `action_id`, `risk_score`, `risk_explanation`, `status_url` so agents know exactly where to poll
- `GET /status/:actionId` handler returns 5 distinct JSON shapes based on current state — ownership enforced via 404-on-wrong-agent to avoid enumeration
- `POST /proxy/execute/:actionId` verifies ownership + APPROVED status + TTL, injects credentials fresh from vault, forwards stored request, caches response in `approval_queue`, returns with `X-Proxy-Status: executed-approved`
- 5-minute `setInterval` TTL cleanup registered at server startup using `expireStaleApprovals()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate risk gate into proxy service and route handler** - `601b3bf` (feat)
2. **Task 2: Status polling route, execute route, and server wiring** - `7d701d1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/src/services/proxy.service.ts` - Added RiskyRequestError class, assessRisk import, createApprovalQueueEntry import, and risk gate step 2.5 in executeProxyRequest
- `backend/src/routes/proxy.ts` - Added RiskyRequestError handler in handleProxy catch block; added handleProxyExecute handler with full approve-execute lifecycle
- `backend/src/routes/approval.ts` - New file: GET /status/:actionId handler with 5-state response shapes and ownership check
- `backend/src/server.ts` - Added handleApprovalStatus + handleProxyExecute imports, route matches for /status/:actionId and /proxy/execute/:actionId, 5-minute TTL cleanup interval

## Decisions Made
- Risk gate positioned before idempotency check: risky requests should be blocked regardless of whether an idempotency key exists — keeps the idempotency store clean and prevents idempotency from bypassing risk assessment
- Ownership check returns 404 (not 403) for wrong-agent: prevents an agent from enumerating other agents' action IDs by detecting 403 vs 404 differences
- `markExecuted` is fire-and-forget: response caching is asynchronous so it doesn't add latency to the execute response path
- Auth header stripping at gate time: both `Authorization` and `Agent-Key` variants (case-sensitive and lowercase) deleted before storage to ensure credentials never persist in the approval_queue table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript TS2322 on regex match group in server.ts**
- **Found during:** Task 2 (server.ts route wiring)
- **Issue:** `RegExpMatchArray[N]` is typed as `string | undefined` — TypeScript 5.x requires explicit narrowing when passing to `string` parameter
- **Fix:** Added `as string` type assertion after the truthy null-check guard (`if (statusMatch && ...)`)
- **Files modified:** `backend/src/server.ts`
- **Verification:** `bunx tsc --noEmit` shows zero new errors in src/routes/approval.ts, src/routes/proxy.ts, src/server.ts
- **Committed in:** `7d701d1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Minimal — type narrowing fix was one-line per route, no behavior change.

## Issues Encountered

Pre-existing TypeScript errors in the codebase (src/middleware/auth.ts, src/routes/auth.ts, src/server.ts route table types, src/services/agent.service.ts, src/services/auth.service.ts) were not introduced by this plan's changes and were not modified. Verified via `git stash` comparison.

## Next Phase Readiness
- Full risk-approval agent flow complete: POST /proxy → 428 → poll GET /status → POST /proxy/execute → result
- Phase 6 (dashboard) can now add UI to list PENDING approval_queue entries, approve/deny them (via transitionStatus), and display the execution result
- No blockers

---
*Phase: 05-risk-approval-flow*
*Completed: 2026-02-17*

## Self-Check: PASSED

All claims verified:
- Files exist: backend/src/routes/approval.ts, backend/src/services/proxy.service.ts, backend/src/routes/proxy.ts, backend/src/server.ts, 05-02-SUMMARY.md
- Commits exist: 601b3bf (Task 1), 7d701d1 (Task 2)
- RiskyRequestError exports with statusCode 428
- handleApprovalStatus and handleProxyExecute export as functions
- assessRisk and createApprovalQueueEntry present in proxy.service.ts
- expireStaleApprovals, handleApprovalStatus, handleProxyExecute, setInterval present in server.ts
