# Roadmap: GaiterGuard

## Overview

GaiterGuard delivers an intercepting API gateway that enforces human-in-the-loop authorization for AI agents. This roadmap begins with foundational infrastructure, builds the secure vault for credentials, enables agent authentication, implements transparent proxying with credential injection, adds risk assessment and approval workflows, and completes with a dashboard for human oversight.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Project scaffolding, database schema, authentication framework ✓ (2026-02-15)
- [ ] **Phase 2: Secret Vault** - Service registration, credential storage, API documentation uploads
- [ ] **Phase 3: Agent Authentication** - Agent key generation and validation system
- [ ] **Phase 4: Gateway Proxy Core** - Request proxying, credential injection, transparent forwarding
- [ ] **Phase 5: Risk & Approval Flow** - Risk assessment, action blocking, approval queue
- [ ] **Phase 6: Dashboard** - Approval UI and service management interface

## Phase Details

### Phase 1: Foundation
**Goal**: Development environment is operational with database, API server, and authentication framework ready
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure foundation)
**Success Criteria** (what must be TRUE):
  1. Bun.js server runs and responds to health check requests
  2. PostgreSQL database is provisioned with migrations system in place
  3. User authentication (email/password) works for dashboard access
  4. API endpoints return structured JSON responses with proper error handling
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Project scaffolding, Bun server, DB schema, health endpoints
- [ ] 01-02-PLAN.md — User authentication (register, login, JWT, refresh token rotation)

### Phase 2: Secret Vault
**Goal**: Users can securely register services, store encrypted credentials, and upload API documentation
**Depends on**: Phase 1
**Requirements**: VAULT-01, VAULT-02, VAULT-03, VAULT-04
**Success Criteria** (what must be TRUE):
  1. User can register a service with name, base URL, and authentication configuration
  2. User can inject API keys that are encrypted at rest in the database
  3. User can upload API documentation (OpenAPI specs, markdown, or URLs) for registered services
  4. User can edit service details or delete services and their associated credentials
  5. API keys are never exposed in API responses or logs
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

### Phase 3: Agent Authentication
**Goal**: Agents can authenticate with unique keys and all requests are validated against service scope
**Depends on**: Phase 2
**Requirements**: AGENT-01, PROXY-02
**Success Criteria** (what must be TRUE):
  1. System generates a unique Agent-Key when a new agent is created
  2. Agent requests with valid Agent-Key are accepted
  3. Agent requests with invalid or missing Agent-Key are rejected with 401
  4. Agent-Key scope validation ensures agents can only access their authorized services
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

### Phase 4: Gateway Proxy Core
**Goal**: Agents can proxy requests through the gateway with automatic credential injection for non-risky operations
**Depends on**: Phase 3
**Requirements**: PROXY-01, PROXY-03, PROXY-04
**Success Criteria** (what must be TRUE):
  1. Agent can call POST /proxy with target URL, method, headers, body, intent, Agent-Key, and Idempotency-Key
  2. Gateway injects real API credentials from the vault into the outbound request
  3. Non-risky requests are forwarded to target service and return 200 with full response
  4. Idempotency-Key prevents duplicate execution of the same request
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

### Phase 5: Risk & Approval Flow
**Goal**: Risky requests are blocked with 428 status, stored in approval queue, and agents can poll for resolution
**Depends on**: Phase 4
**Requirements**: RISK-02, PROXY-05, APPR-01, APPR-02, APPR-03
**Success Criteria** (what must be TRUE):
  1. LLM compares agent's stated intent against actual request payload to detect mismatches
  2. Risky requests return 428 status with an action_id instead of executing
  3. Blocked requests are stored with full context (URL, method, headers, body, intent, risk assessment)
  4. Agent can poll GET /status/{action_id} and receive PENDING, APPROVED, DENIED, or REVOKED
  5. When approved, gateway executes the stored request with real credentials and caches response for retrieval
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

### Phase 6: Dashboard
**Goal**: Users can view pending actions and approve or deny them, plus manage services through web UI
**Depends on**: Phase 5
**Requirements**: DASH-01, DASH-02
**Success Criteria** (what must be TRUE):
  1. User can view pending actions with full request context in a web dashboard
  2. User can approve pending actions, which triggers execution and returns response to polling agent
  3. User can deny pending actions, which returns DENIED status to polling agent
  4. User can register, edit, and delete services with their API keys through the dashboard UI
**Plans**: TBD

Plans:
- TBD (will be defined during phase planning)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | ✓ Complete | 2026-02-15 |
| 2. Secret Vault | 0/TBD | Not started | - |
| 3. Agent Authentication | 0/TBD | Not started | - |
| 4. Gateway Proxy Core | 0/TBD | Not started | - |
| 5. Risk & Approval Flow | 0/TBD | Not started | - |
| 6. Dashboard | 0/TBD | Not started | - |
