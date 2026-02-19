# Requirements: GaiterGuard

**Defined:** 2026-02-15
**Core Value:** Agents never touch production credentials and cannot execute high-impact actions without explicit human approval

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Secret Vault

- [ ] **VAULT-01**: User can register a service with name, base URL, and auth configuration
- [ ] **VAULT-02**: User can inject API keys that are encrypted at rest and never exposed to agents
- [ ] **VAULT-03**: User can upload API documentation (OpenAPI specs, markdown, or doc URL) for a registered service
- [ ] **VAULT-04**: User can edit or delete registered services and their credentials

### Agent Provisioning

- [ ] **AGENT-01**: System generates a unique Agent-Key when user creates an agent

### Gateway Proxy

- [ ] **PROXY-01**: Agent can call POST /proxy with target URL, method, headers, body, intent, Agent-Key, and Idempotency-Key
- [ ] **PROXY-02**: Gateway validates Agent-Key and service scope before processing
- [ ] **PROXY-03**: Gateway injects real API credentials into the request before forwarding to target service
- [ ] **PROXY-04**: Non-risky requests return 200 with the full target service response
- [ ] **PROXY-05**: Risky requests return 428 with an action_id and enter the approval queue

### Risk Auditing

- [ ] **RISK-02**: Gateway LLM compares agent's stated intent against the actual request payload

### Approval Queue

- [ ] **APPR-01**: Blocked requests are stored with full context (URL, method, headers, body, intent, risk assessment)
- [ ] **APPR-02**: Agent can poll GET /status/{action_id} returning PENDING, APPROVED, DENIED, or REVOKED
- [ ] **APPR-03**: On approval, gateway executes the stored request with real credentials and caches the response for agent retrieval

### Dashboard

- [ ] **DASH-01**: User can view pending actions with full request context and approve or deny them
- [ ] **DASH-02**: User can register, edit, and delete services with their API keys through the UI

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Risk Auditing

- **RISK-01**: User can define custom risk rules (thresholds, endpoint patterns, HTTP methods)
- **RISK-03**: LLM-based risk evaluation using provisioned API documentation in real-time
- **RISK-04**: Real-time doc extraction from uploads, known doc sites, and user-provided URLs

### Agent Provisioning

- **AGENT-02**: User can scope agents to specific registered services
- **AGENT-03**: User can revoke or rotate Agent-Keys

### Dashboard

- **DASH-03**: Agent management UI (create agents, view keys, manage scopes)
- **DASH-04**: Global Block (kill switch) to terminate agent sessions

### Notifications

- **NOTF-01**: Slack webhook/bot notifications with approve/deny buttons
- **NOTF-02**: Email notifications with action links
- **NOTF-03**: Generic webhook for custom integrations

### Dry Run

- **DRY-01**: POST /dry-run endpoint for risk assessment without creating pending records

## Out of Scope

| Feature | Reason |
|---------|--------|
| OAuth/SSO for dashboard | Email/password sufficient for v1 |
| Multi-tenancy / team management | Single-user first |
| Rate limiting / usage billing | Defer to SaaS phase |
| Mobile app | Web dashboard only |
| WebSocket-based resolution | Polling simpler for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAULT-01 | Phase 2 | Pending |
| VAULT-02 | Phase 2 | Pending |
| VAULT-03 | Phase 2 | Pending |
| VAULT-04 | Phase 2 | Pending |
| AGENT-01 | Phase 3 | Pending |
| PROXY-01 | Phase 4 | Pending |
| PROXY-02 | Phase 3 | Pending |
| PROXY-03 | Phase 4 | Pending |
| PROXY-04 | Phase 4 | Pending |
| PROXY-05 | Phase 5 | Pending |
| RISK-02 | Phase 5 | Pending |
| APPR-01 | Phase 5 | Pending |
| APPR-02 | Phase 5 | Pending |
| APPR-03 | Phase 5 | Pending |
| DASH-01 | Phase 6 | Pending |
| DASH-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after roadmap creation*
