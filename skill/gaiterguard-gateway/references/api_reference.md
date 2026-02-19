# GaiterGuard API Reference — Agent Endpoints

All agent endpoints require `Agent-Key: {your agt_... key}` header.
Base URL is configured via `GATEWAY_URL` environment variable.

---

## POST /proxy

Submit a request to be proxied through the gateway with automatic credential injection.

### Request

```
POST {GATEWAY_URL}/proxy
Agent-Key: {AGENT_KEY}
Idempotency-Key: {string}    # required for POST and PATCH
Content-Type: application/json
```

**Body:**
```json
{
  "targetUrl":      "https://api.example.com/v1/resource",
  "method":         "POST",
  "headers":        { "Content-Type": "application/json" },
  "body":           "{\"key\": \"value\"}",
  "intent":         "Plain English description of what this request does",
  "idempotencyKey": "unique-key-for-this-operation"
}
```

**Validation rules:**
- `targetUrl` must be http/https, must match the baseUrl of an agent-scoped service
- `method` must be one of: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS
- `intent` must be 1–500 characters
- `idempotencyKey` is required for POST and PATCH; 1–255 chars; `Idempotency-Key` header overrides body field
- Private IPs (127.x, 10.x, 192.168.x, 172.16-31.x, ::1, localhost) are blocked

### Responses

**200–299** — Request forwarded successfully. Returns the upstream service's status code and body verbatim.

Headers added by gateway:
- `X-Proxy-Status: forwarded`
- `X-Idempotency-Status: processed` (if idempotency key was provided)

**428 Precondition Required** — Risk assessment blocked the request:
```json
{
  "error": "Request requires human approval",
  "action_id": "550e8400-e29b-41d4-a716-446655440000",
  "risk_score": 0.82,
  "risk_explanation": "High-risk DELETE operation; intent does not justify method.",
  "status_url": "/status/550e8400-e29b-41d4-a716-446655440000"
}
```

**401** — Missing, invalid, or revoked Agent-Key
**403** — Agent is not scoped to the target service
**400** — Validation error (malformed body or idempotencyKey missing for POST/PATCH)
**409** — Another request with the same idempotency key is still processing
**404** — No service found matching target URL

---

## GET /status/{action_id}

Poll the approval status of a risk-blocked request.

### Request

```
GET {GATEWAY_URL}/status/{action_id}
Agent-Key: {AGENT_KEY}
```

`action_id` is a UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`).

### Response shapes

**PENDING** — waiting for human decision:
```json
{ "status": "PENDING", "action_id": "...", "created_at": "2026-02-17T10:00:00.000Z" }
```

**APPROVED** — human approved, agent must call execute:
```json
{ "status": "APPROVED", "action_id": "...", "execute_url": "/proxy/execute/..." }
```

**DENIED** — human denied the request:
```json
{ "status": "DENIED", "action_id": "...", "resolved_at": "2026-02-17T10:05:00.000Z" }
```

**EXPIRED** — approval window closed before execution:
```json
{ "status": "EXPIRED", "action_id": "..." }
```

**EXECUTED** — request was forwarded; cached result available:
```json
{
  "status": "EXECUTED",
  "action_id": "...",
  "result": {
    "status": 200,
    "headers": { "content-type": "application/json" },
    "body": "{\"id\": 42, \"name\": \"widget\"}"
  }
}
```

**401** — invalid Agent-Key
**404** — action not found or belongs to a different agent

---

## POST /proxy/execute/{action_id}

Execute a request that has been approved by a human reviewer.

### Request

```
POST {GATEWAY_URL}/proxy/execute/{action_id}
Agent-Key: {AGENT_KEY}
```

No body required. The gateway re-fetches fresh credentials from the vault and forwards the
stored request exactly as submitted.

### Responses

**200–299** — Request forwarded. Returns upstream status code and body with:
- `X-Proxy-Status: executed-approved`

**401** — invalid Agent-Key
**404** — action not found
**409** — action is not in APPROVED status (check current status first)
**410** — approval has expired; resubmit via `POST /proxy`

---

## Risk scoring reference

The gateway uses a blended score: `(LLM score × 0.7) + (method heuristic × 0.3)`.
Requests are blocked if the final score is ≥ `RISK_THRESHOLD` (server env var, typically 0.6).

If the LLM is unavailable, the gateway **fails closed** — method heuristic score is escalated
by +0.3, meaning DELETE/PUT are almost always blocked, POST/PATCH frequently blocked.

| Method | Heuristic base | Typical outcome |
|--------|---------------|-----------------|
| GET, HEAD | 0.05–0.1 | Passes through |
| OPTIONS | 0.05 | Passes through |
| POST | 0.3 | Passes if intent is clear |
| PATCH | 0.4 | May require approval |
| PUT | 0.5 | Likely requires approval |
| DELETE | 0.7 | Almost always requires approval |
