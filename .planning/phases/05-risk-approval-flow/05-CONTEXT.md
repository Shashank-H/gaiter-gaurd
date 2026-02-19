# Phase 5: Risk & Approval Flow - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

LLM-based risk assessment of agent proxy requests, blocking risky ones with 428 status into an approval queue, agent polling for resolution, and executing approved requests with real credentials. Dashboard approval UI is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Risk Assessment
- LLM evaluates risk using intent mismatch detection AND HTTP method heuristics
  - Compare agent's stated intent against HTTP method + URL + body
  - Apply method-level rules (e.g., DELETE/PUT always elevated risk, GET lower risk)
- LLM provider: OpenAI-compatible API format, flexible enough to support multiple providers via configuration
- Fail closed on LLM failure — if the LLM call times out, errors, or is rate-limited, treat the request as risky and block it
- Risk output includes both a numeric score (0-1) and a text explanation of why it was flagged, stored with the blocked request for human review

### Execute on Approval
- Approval just flips the status in the database — does NOT execute the request immediately
- Agent triggers execution separately (Claude's discretion on mechanism: status endpoint trigger, separate execute endpoint, or re-submit to /proxy)
- Cached responses from executed approved requests use TTL-based expiry (e.g., 24h), then cleaned up
- Approved requests have a TTL — if not executed within a time window, status changes to EXPIRED (prevents stale credential concerns)

### Claude's Discretion
- Blocking response shape (428 response body format, action_id format)
- Approval queue data model and status transitions
- Polling behavior and response format for GET /status/{action_id}
- Exact mechanism for agent to trigger execution of approved requests
- TTL durations for approval expiry and response cache expiry
- Risk assessment prompt engineering (LLM system/user prompts)

</decisions>

<specifics>
## Specific Ideas

- Risk score (0-1) + explanation stored together — helps human reviewer in dashboard make informed decisions
- OpenAI-compatible format chosen for broad provider support (OpenAI, Anthropic via proxy, local models, etc.)
- Fail-closed philosophy aligns with project core value: "agents cannot execute high-impact actions without explicit human approval"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-risk-approval-flow*
*Context gathered: 2026-02-17*
