# GaiterGuard

<p align="center">
  <img src="./icon.png" alt="GaiterGuard" width="120" />
</p>

**An intercepting API gateway that enforces human-in-the-loop (HITL) authorization for autonomous AI agents.**

Agents never hold production credentials. High-impact actions require explicit human approval through an out-of-band dashboard. The trust boundary is enforced by the gateway — not by the agent.

---

## How It Works
--
Adding Soon
--

1. **Register services** — add a target API, upload its docs (OpenAPI, markdown, or URL), and store its credentials in the vault
2. **Provision agents** — create an Agent-Key scoped to specific services; the agent never sees real credentials
3. **Proxy requests** — agents call `POST /proxy` with their intent; the gateway injects credentials and forwards the request
4. **Risk gate** — an LLM reads the API docs and your rules to assess risk; risky requests are blocked with `428` instead of executed
5. **Human approval** — blocked actions sit in a queue; you approve or deny from the dashboard; the agent polls and proceeds

---

## Features

- **Secret Vault** — credentials encrypted at rest (AES-256-GCM), never returned in API responses
- **Agent-Key authentication** — scoped, revocable keys; one key per agent
- **Transparent proxying** — non-risky requests pass through without latency overhead
- **LLM risk assessor** — evaluates requests against API docs + user-defined rules (e.g. "any Stripe charge > $100 requires approval")
- **Intent integrity check** — LLM compares agent's stated intent against actual payload to detect mismatches
- **Approval queue** — dashboard shows full request context; one click to approve or deny
- **Global kill switch** — block an entire agent session instantly
- **Idempotency** — duplicate requests are deduplicated via `Idempotency-Key`
- **TTL cleanup** — approved-but-unexecuted requests expire automatically

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | [Bun](https://bun.sh) |
| Backend framework | `Bun.serve()` (no Express) |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Auth | JWT (access + refresh tokens) |
| Encryption | AES-256-GCM via Web Crypto |
| Risk assessment | OpenAI-compatible LLM (configurable) |
| Frontend | React 19 + TanStack Router + Vite |
| Containerization | Docker + Docker Compose |

---

## Quick Start (Docker)

**Prerequisites:** Docker and Docker Compose installed.

```bash
git clone https://github.com/your-username/gaiter-guard.git
cd gaiter-guard
```

Copy and edit the environment file:

```bash
cp backend/.env.example backend/.env
```

Set the required values in `backend/.env`:

```env
DATABASE_URL=postgres://pglocal:pglocal-pass@db:5432/gaiterguard
PORT=3000
JWT_SECRET=your-secret-here           # use a long random string
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
ENCRYPTION_SECRET=                    # minimum 32 chars
ENCRYPTION_SALT=gaiter-guard-salt-v1
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...                    # your LLM API key
LLM_MODEL=gpt-4o-mini
RISK_THRESHOLD=0.5                    # 0.0–1.0; requests above this are blocked
APPROVAL_EXECUTE_TTL_HOURS=1
```

Start all services:

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Frontend dashboard | http://localhost:4173 |

---

## Local Development

**Prerequisites:** [Bun](https://bun.sh) v1.x, PostgreSQL running locally.

```bash
# Install dependencies
cd backend && bun install
cd ../frontend && bun install

# Run database migrations
cd backend && bun run db:migrate

# Start backend (with hot reload)
bun run dev          # from backend/
# or from project root:
bun run dev:backend

# Start frontend
cd frontend && bun run dev
```

---

## API Reference

### Agent-Facing Endpoints

All agent requests require the headers:
- `Agent-Key: <your-agent-key>`
- `Idempotency-Key: <unique-request-id>`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/proxy` | Submit a request to proxy through the gateway |
| `GET` | `/status/:actionId` | Poll for approval status of a blocked request |
| `POST` | `/proxy/execute/:actionId` | Execute a previously approved request |

#### POST /proxy — Request body

```json
{
  "service_id": 1,
  "method": "POST",
  "path": "/charges",
  "headers": { "Content-Type": "application/json" },
  "body": { "amount": 500, "currency": "usd" },
  "intent": "Charge customer $5 for subscription renewal"
}
```

#### GET /status/:actionId — Response

```json
{
  "status": "PENDING" | "APPROVED" | "DENIED" | "REVOKED" | "EXPIRED"
}
```

### Dashboard Endpoints

All dashboard endpoints require `Authorization: Bearer <jwt>`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive JWT |
| `POST` | `/auth/refresh` | Refresh access token |
| `GET` | `/auth/me` | Get current user |
| `GET` | `/services` | List registered services |
| `POST` | `/services` | Register a new service |
| `PUT` | `/services/:id` | Update service |
| `DELETE` | `/services/:id` | Delete service |
| `POST` | `/services/:id/credentials` | Store/update credentials |
| `GET` | `/agents` | List agents |
| `POST` | `/agents` | Create agent |
| `PUT` | `/agents/:id` | Update agent |
| `DELETE` | `/agents/:id` | Delete agent |
| `PUT` | `/agents/:id/services` | Update agent service scope |
| `GET` | `/approvals/pending` | List pending approval actions |
| `PATCH` | `/approvals/:actionId/approve` | Approve a pending action |
| `PATCH` | `/approvals/:actionId/deny` | Deny a pending action |

---

## Architecture

```
gaiter-guard/
├── backend/
│   ├── src/
│   │   ├── config/       # Environment validation
│   │   ├── db/           # Drizzle schema and client
│   │   ├── routes/       # Route handlers (auth, services, agents, proxy, approval, dashboard)
│   │   ├── services/     # Business logic (encryption, risk, approval, proxy, idempotency)
│   │   ├── middleware/   # Auth and agent-key validation
│   │   └── utils/        # Response helpers, validation
│   └── scripts/          # DB migration, test utilities
├── frontend/
│   └── src/
│       ├── routes/       # TanStack Router pages
│       └── components/   # UI components
├── skill/
│   └── gaiterguard-gateway/       # Agent skill for gateway integration
└── docker-compose.yaml
```

---

## Agent Skill

If you're building AI agents that call external APIs through GaiterGuard, an agent skill is bundled in this repo. It gives the agent full knowledge of the gateway protocol — `POST /proxy`, 428 handling, polling, and execution — so you don't have to explain it each session.

**Install:**

```bash
cp -r skill/gaiterguard-gateway ~/.claude/skills/
```

The skill covers:
- Constructing `POST /proxy` requests with proper `Agent-Key` and `Idempotency-Key` headers
- Handling `428` risk-blocked responses with a full polling loop template (Python + bash)
- Re-invoking the agent with the execution result **and the original blocked request context**
- All response shapes for `/status/:id` and `/proxy/execute/:id`
- Error codes and risk scoring reference