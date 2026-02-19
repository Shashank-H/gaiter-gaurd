---
name: gaiterguard-gateway
description: >
  Complete integration guide for AI agents making HTTP requests through the GaiterGuard API gateway.
  Use this skill whenever an agent needs to proxy requests to external/registered services via GaiterGuard.
  Covers Agent-Key authentication, constructing POST /proxy requests, handling risk-blocked 428 responses
  with a procedural polling loop, executing approved requests, and all response shapes.
  Trigger on: "call an API through the gateway", "proxy a request via GaiterGuard", "use Agent-Key",
  "POST /proxy", approval polling workflows, or any task requiring external API calls through the gateway.
---

# GaiterGuard Gateway — Agent Integration

GaiterGuard is a human-in-the-loop API gateway. Every agent request is risk-assessed by an LLM.
Low-risk requests are forwarded transparently. High-risk requests (score ≥ threshold) return HTTP 428
and enter an approval queue. A human approves or denies. The agent polls for the decision, then
triggers execution.

## Environment variables required

```
GATEWAY_URL=<base URL, e.g. http://localhost:3000>
AGENT_KEY=agt_<64 hex chars>
```

## Authentication

Every agent endpoint requires:

```
Agent-Key: {AGENT_KEY}
```

Do **not** include `Authorization` or credential headers — the gateway injects real credentials from
the encrypted vault automatically.

---

## Workflow overview

```
POST /proxy
  → 2xx   — request forwarded, done
  → 428   — risk-blocked: write + run polling script (see below)
               ↓
       GET /status/{action_id}   poll every 5–10s
               ↓ APPROVED
       POST /proxy/execute/{action_id}   execute & get result
               ↓ DENIED / EXPIRED
       handle gracefully (log, notify, retry if applicable)
```

---

## Step 1: Submit a proxy request

```http
POST {GATEWAY_URL}/proxy
Agent-Key: {AGENT_KEY}
Idempotency-Key: {unique-key}
Content-Type: application/json

{
  "targetUrl":      "https://api.example.com/v1/items",
  "method":         "POST",
  "headers":        { "Content-Type": "application/json" },
  "body":           "{\"name\": \"widget\"}",
  "intent":         "Create a new item for the nightly sync job",
  "idempotencyKey": "{unique-key}"
}
```

**Field rules:**
| Field | Required | Notes |
|-------|----------|-------|
| `targetUrl` | Yes | Must start with the baseUrl of a service the agent is scoped to |
| `method` | Yes | GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS |
| `headers` | No | Merged with gateway-injected credentials |
| `body` | No | JSON-stringified string; null/omit for GET, HEAD, DELETE |
| `intent` | Yes | Plain English — LLM compares this against the actual request |
| `idempotencyKey` | POST/PATCH only | Header `Idempotency-Key` takes precedence if both sent |

**Success response:** upstream service response, plus:
- `X-Proxy-Status: forwarded`
- `X-Idempotency-Status: processed` (when idempotency key used)

---

## Step 2: Handle a 428 risk-blocked response

```json
{
  "error": "Request requires human approval",
  "action_id": "550e8400-e29b-41d4-a716-446655440000",
  "risk_score": 0.82,
  "risk_explanation": "DELETE operation with high destructive potential",
  "status_url": "/status/550e8400-e29b-41d4-a716-446655440000"
}
```

**When 428 is received, write and execute a polling script** that:
1. Polls `GET /status/{action_id}` until a terminal status (APPROVED, DENIED, EXPIRED, EXECUTED)
2. On APPROVED: calls `POST /proxy/execute/{action_id}` to execute the stored request
3. On EXECUTED (if already done): reads the cached result from the status response
4. Re-invokes the original agent/process with the final result

See `references/polling-script.md` for a complete copy-paste template.

---

## Step 3: Poll approval status

```http
GET {GATEWAY_URL}/status/{action_id}
Agent-Key: {AGENT_KEY}
```

Response shapes by status:

| Status | Body shape |
|--------|-----------|
| `PENDING` | `{ status, action_id, created_at }` |
| `APPROVED` | `{ status, action_id, execute_url: "/proxy/execute/{action_id}" }` |
| `DENIED` | `{ status, action_id, resolved_at }` |
| `EXPIRED` | `{ status, action_id }` |
| `EXECUTED` | `{ status, action_id, result: { status, headers, body } }` |

---

## Step 4: Execute an approved request

```http
POST {GATEWAY_URL}/proxy/execute/{action_id}
Agent-Key: {AGENT_KEY}
```

No body needed. The gateway re-injects fresh credentials and forwards the original stored request.

Response: upstream service response with `X-Proxy-Status: executed-approved`

**Errors:**
- `409` — action is not APPROVED (check current status first)
- `410` — approval expired; resubmit via POST /proxy

---

## Error code reference

| Code | Meaning |
|------|---------|
| 401 | Missing/invalid Agent-Key, or agent revoked |
| 403 | Agent not scoped to the target service |
| 404 | Service not found, or action not found |
| 409 | Idempotency conflict (still processing) |
| 410 | Approval expired — resubmit request |
| 428 | Risk-blocked — enter polling flow |
| 502 | Upstream service returned an error |
| 504 | Upstream timed out (30s limit) |

---

## Writing good intent strings

The `intent` field is the most critical input for risk scoring. The LLM compares it against the
actual HTTP method, URL, and body to detect mismatches.

- **Good:** `"Fetch the latest 10 orders for daily reporting"`
- **Bad:** `"get data"` — too vague, LLM flags as suspicious
- **Bad:** `"Read orders"` for a DELETE call — mismatch → guaranteed 428

**Method baseline risk scores** (always applied regardless of intent):
| Method | Risk |
|--------|------|
| GET, HEAD | Low (0.05–0.1) — usually passes |
| POST | Medium (0.3) — usually passes with clear intent |
| PATCH | Medium-high (0.4) |
| PUT | High (0.5) — expect 428 |
| DELETE | Very high (0.7) — almost always 428 |

---

## Polling script

Read `references/polling-script.md` when writing the procedural polling script after a 428.
