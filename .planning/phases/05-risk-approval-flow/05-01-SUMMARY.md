---
phase: 05-risk-approval-flow
plan: 01
subsystem: api
tags: [llm, risk-assessment, approval-queue, drizzle, postgres, openai]

# Dependency graph
requires:
  - phase: 04-gateway-proxy-core
    provides: proxy.service.ts and proxy_requests table that approval flow integrates with
provides:
  - approval_queue table with 5-state machine (PENDING/APPROVED/DENIED/EXPIRED/EXECUTED)
  - LLM env var validation (LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_TIMEOUT_MS, RISK_THRESHOLD, APPROVAL_EXECUTE_TTL_HOURS)
  - approval.service.ts with CRUD and conditional state transitions
  - risk.service.ts with LLM intent analysis and HTTP method heuristics, fail-closed behavior
affects:
  - 05-risk-approval-flow plan 02 (wires these services into proxy flow and new routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LLM OpenAI-compatible API call with AbortController timeout separate from proxy timeout
    - Fail-closed risk assessment (LLM error escalates score, never silently passes)
    - Score blending: LLM score * 0.7 + method heuristic * 0.3
    - Conditional state transitions (WHERE status = fromStatus) for race safety
    - crypto.randomUUID() for action IDs (avoids pgcrypto dependency)

key-files:
  created:
    - backend/src/services/approval.service.ts
    - backend/src/services/risk.service.ts
    - backend/src/db/migrations/0004_approval_queue.sql
  modified:
    - backend/src/db/schema.ts
    - backend/src/config/env.ts

key-decisions:
  - "LLM score weighted 0.7, method heuristic 0.3 — LLM opinion more informative than pure method"
  - "Fail-closed on LLM error: escalated heuristic = min(1, heuristicScore + 0.3)"
  - "AbortController timeout for LLM (env.LLM_TIMEOUT_MS, default 10s) separate from 30s proxy timeout"
  - "Conditional transitionStatus (WHERE status = fromStatus) prevents race conditions in approval state machine"
  - "crypto.randomUUID() for actionId generation (avoids pgcrypto dependency per Phase 04 pattern)"

patterns-established:
  - "Race-safe state transitions: UPDATE WHERE actionId AND status = fromStatus, check rowCount > 0"
  - "LLM fail-closed: any error (timeout, non-200, invalid JSON) escalates risk score, never passes through"
  - "OpenAI json_object mode requires explicit JSON instruction in system prompt to avoid whitespace token exhaustion"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 5 Plan 01: Approval Queue DB + Risk Service Summary

**Approval queue table with 5-state machine, LLM risk assessment blending intent analysis with HTTP method heuristics, and fail-closed behavior on any LLM error**

## Performance

- **Duration:** ~2 min (continuation from prior session — Task 1 was pre-committed)
- **Started:** 2026-02-17T09:26:46Z
- **Completed:** 2026-02-17T09:26:46Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- approval_queue table in PostgreSQL with all columns, 5-state machine, and 4 indexes (actionId unique, agentId, status, createdAt)
- LLM environment variables validated at startup: LLM_BASE_URL (required), LLM_API_KEY (required), LLM_MODEL (default gpt-4o-mini), LLM_TIMEOUT_MS (default 10000), RISK_THRESHOLD (validated 0-1 float, default 0.5), APPROVAL_EXECUTE_TTL_HOURS (default 1)
- approval.service.ts: createApprovalQueueEntry, getApprovalQueueEntry, transitionStatus (race-safe conditional update), expireStaleApprovals, markExecuted
- risk.service.ts: assessRisk with blended LLM + method heuristic score, AbortController timeout, fail-closed on any LLM failure

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval queue schema, env vars, and approval service** - `4fe7439` (feat)
2. **Task 2: Risk assessment service with LLM call and method heuristics** - `00f6914` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/src/db/schema.ts` - Added approvalQueue table with 17 columns and 4 indexes
- `backend/src/config/env.ts` - Added 6 LLM and risk threshold env vars with validation
- `backend/src/services/approval.service.ts` - Approval queue CRUD and 5-state machine transitions
- `backend/src/services/risk.service.ts` - LLM risk assessment with method heuristics and fail-closed fallback
- `backend/src/db/migrations/0004_approval_queue.sql` - Migration creating approval_queue table

## Decisions Made
- LLM opinion weighted higher (0.7) than method heuristic (0.3): intent mismatch is more informative than HTTP method alone
- Fail-closed on LLM failure: uses `min(1, heuristicScore + 0.3)` — LLM unavailability never silently permits risky requests
- Separate AbortController timeout for LLM (10s) from proxy timeout (30s): prevents LLM latency from consuming proxy timeout budget
- Conditional transitionStatus (`WHERE status = fromStatus`) prevents TOCTOU race conditions in multi-agent scenarios
- crypto.randomUUID() for actionId avoids pgcrypto database dependency (consistent with Phase 04 decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

The following environment variables must be added to `.env` before running the risk/approval flow:

```
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=10000
RISK_THRESHOLD=0.5
APPROVAL_EXECUTE_TTL_HOURS=1
```

## Next Phase Readiness
- approval.service.ts and risk.service.ts are ready for Plan 02 to wire into the proxy flow
- Plan 02 will add the risk check before forwarding, create the approval routes, and handle the PENDING/APPROVED/DENIED response cases
- No blockers

---
*Phase: 05-risk-approval-flow*
*Completed: 2026-02-17*
