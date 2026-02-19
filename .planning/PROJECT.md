# GaiterGuard

## What This Is

GaiterGuard is an intercepting API Gateway that enforces human-in-the-loop (HITL) authorization for autonomous AI agents. It acts as a Secret Vault and Risk Auditor — agents never hold production credentials, and high-impact actions require explicit human approval through an out-of-band dashboard. Users register services, upload API documentation, and provision agent keys; the gateway intercepts all outbound calls, injects credentials, assesses risk via LLM, and blocks risky actions until a human approves or denies.

## Core Value

Agents never touch production credentials and cannot execute high-impact actions without explicit human approval — the trust boundary is enforced by the gateway, not by the agent.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Users can register services and securely store API keys (Secret Vault)
- [ ] Agents authenticate via Agent-Key and call POST /proxy with intent
- [ ] Gateway injects real credentials and proxies non-risky requests transparently
- [ ] LLM-based risk auditor evaluates requests using uploaded API docs, known doc sites, user-provided doc URLs, and user-defined rules
- [ ] Risky actions return 428 with action_id and enter approval queue
- [ ] Agents poll GET /status/{action_id} for async resolution
- [ ] Dashboard shows approval queue with approve/deny actions
- [ ] Dashboard provides service registration and agent management UI
- [ ] Users can trigger Global Block (kill switch) to terminate an agent session
- [ ] POST /dry-run endpoint for risk assessment without creating pending records
- [ ] Request integrity check — LLM compares stated intent vs actual payload

### Out of Scope

- Push notifications (Slack, email, webhook) — v2, dashboard-only for v1
- OAuth/SSO for dashboard login — email/password sufficient for v1
- Multi-tenancy / team management — single-user first
- Rate limiting / usage billing — defer to SaaS phase
- Mobile app — web dashboard only

## Context

- **Architecture pattern:** Synchronous Halt with Asynchronous Resolution — agent sends request, gateway may block it, agent polls for resolution, human approves/denies out-of-band
- **Agent-facing API:** Three endpoints — POST /proxy (execute), GET /status/{action_id} (poll), POST /dry-run (optional risk check)
- **Risk assessment approach:** LLM reads relevant sections from uploaded API docs (OpenAPI specs or markdown), known documentation sites, or user-provided doc URLs. Docs are extracted and provisioned to the LLM in real-time by the gateway. User-defined rules layer on top (e.g., "any Stripe charge > $100 needs approval")
- **Agent provisioning:** Each agent gets a unique Agent-Key scoped to specific registered services. All requests require Agent-Key + Idempotency-Key
- **Deployment target:** Self-hosted (Docker) first, hosted SaaS later

## Constraints

- **Tech stack**: Bun.js backend, React frontend (Bun or Vite), PostgreSQL database, Drizzle ORM
- **Database**: PostgreSQL on localhost:5432, user `pglocal`, password `pglocal-pass`
- **Security**: API keys encrypted at rest in vault, never exposed to agents, approval actions restricted to authenticated dashboard
- **Agent protocol**: All agent requests must include Agent-Key and Idempotency-Key headers

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bun.js for backend runtime | User preference, fast runtime, TypeScript native | — Pending |
| Secret vault as v1 foundation | Credential isolation is the core trust boundary — risk auditing layers on top | — Pending |
| Dashboard-only approvals for v1 | Reduces scope; push notifications (Slack, email) deferred to v2 | — Pending |
| LLM + user rules + docs for risk | Combines semantic understanding from docs with explicit user-defined thresholds | — Pending |
| Self-hosted first, SaaS later | Lets users control their own credential storage initially | — Pending |
| Polling-based async resolution | Simpler than WebSockets for v1; agent polls GET /status/{action_id} | — Pending |
| Drizzle ORM | User preference for type-safe, lightweight ORM | — Pending |

---
*Last updated: 2026-02-15 after roadmap creation*
