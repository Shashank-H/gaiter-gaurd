# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Agents never touch production credentials and cannot execute high-impact actions without explicit human approval — the trust boundary is enforced by the gateway, not by the agent.
**Current focus:** Phase 5 - Risk Approval Flow

## Current Position

Phase: 5 of 6 (Risk Approval Flow)
Plan: 1 of 2 in current phase
Status: In Progress
Last activity: 2026-02-17 — Completed 05-01: Approval Queue Schema + Risk Service

Progress: [████████░░] 75% (9/12 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 4 min
- Total execution time: 0.53 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 8 min | 4 min |
| 02-secret-vault | 2 | 10 min | 5 min |
| 03-agent-authentication | 2 | 6 min | 3 min |
| 04-gateway-proxy-core | 2 | 6 min | 3 min |
| 05-risk-approval-flow | 1 | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: 03-02 (4 min), 04-01 (5 min), 04-02 (1 min), 05-01 (2 min)
- Trend: Stable (last plan: 2 min)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Bun.js for backend runtime — TypeScript native, fast runtime, user preference
- Secret vault as v1 foundation — Credential isolation is the core trust boundary
- Dashboard-only approvals for v1 — Reduces scope, push notifications deferred to v2
- Polling-based async resolution — Simpler than WebSockets for v1
- Use pathname-based routing instead of Bun routes object API — More portable across Bun versions (01-01)
- Separate health and ready endpoints — Kubernetes best practices for liveness/readiness (01-01)
- Add userId index on refresh_tokens — Per research, critical for token lookup performance (01-01)
- Use jose library for JWT operations — Well-maintained, TypeScript-native, follows modern standards (01-02)
- Implement refresh token rotation — Security best practice, prevents token reuse attacks (01-02)
- Store only hashed refresh tokens — Defense in depth, database compromise doesn't expose usable tokens (01-02)
- Return generic "Invalid credentials" for all login failures — Prevents user enumeration attacks (01-02)
- Application-level encryption over pgcrypto — Enables key rotation without database dependency (02-01)
- AES-256-GCM with scrypt key derivation — Industry standard authenticated encryption (02-01)
- Cascade deletes on credentials/documentation — Prevents orphaned data when services deleted (02-01)
- Zod for request validation — Best TypeScript inference, modern API, 2026 ecosystem standard (02-01)
- [Phase 02-secret-vault]: Parameterized routing pattern for /services/:id paths
- [Phase 02-secret-vault]: API responses show credential key names but never values
- [Phase 02-secret-vault]: Replace semantics for credential updates (delete all, insert new)
- [Phase 03-agent-authentication]: Use agt_ prefix for agent API keys (vs service-specific prefixes)
- [Phase 03-agent-authentication]: Store only key hash, return full key once on creation
- [Phase 03-agent-authentication]: Use keyPrefix (12 chars) for safe display in UI
- [Phase 03-agent-authentication]: Soft delete via isActive flag (vs hard delete)
- [Phase 03-agent-authentication]: Track lastUsedAt for security monitoring
- [Phase 03-agent-authentication]: Fire-and-forget lastUsedAt update (no blocking on audit log)
- [Phase 03-agent-authentication]: Agent routes use JWT auth (dashboard-facing, not agent-facing)
- [Phase 03-agent-authentication]: requireAgentAuth returns both agentId and userId for flexibility
- [Phase 03-agent-authentication]: requireServiceAccess throws 403 (not 401) for scope violations
- [Phase 04-gateway-proxy-core]: 24 hour TTL for idempotency keys (balance replay protection and storage)
- [Phase 04-gateway-proxy-core]: Fire-and-forget audit logging to proxy_requests table
- [Phase 04-gateway-proxy-core]: SHA-256 request hashing for duplicate detection (method+url+body)
- [Phase 04-gateway-proxy-core]: 30s timeout and 10MB size limit for proxied requests
- [Phase 04-gateway-proxy-core]: Manual editing of Drizzle migrations when regenerating full schema
- [Phase 04-gateway-proxy-core]: Header takes precedence over body for Idempotency-Key (04-02)
- [Phase 04-gateway-proxy-core]: X-Proxy-Status and X-Idempotency-Status headers for response metadata (04-02)
- [Phase 04-gateway-proxy-core]: Content-Type passthrough from target response (04-02)
- [Phase 05-risk-approval-flow]: LLM score weighted 0.7, method heuristic 0.3 — LLM intent analysis more informative than HTTP method alone (05-01)
- [Phase 05-risk-approval-flow]: Fail-closed on LLM error: escalated heuristic = min(1, heuristicScore + 0.3) — LLM unavailability never silently passes risky requests (05-01)
- [Phase 05-risk-approval-flow]: AbortController timeout for LLM (default 10s) separate from 30s proxy timeout to prevent latency budget conflicts (05-01)
- [Phase 05-risk-approval-flow]: Conditional transitionStatus (WHERE status = fromStatus) prevents TOCTOU race conditions in approval state machine (05-01)

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 05-01-PLAN.md — Approval Queue Schema + Risk Service
Resume file: None
