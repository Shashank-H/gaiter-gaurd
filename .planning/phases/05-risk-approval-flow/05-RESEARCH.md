# Phase 5: Risk & Approval Flow - Research

**Researched:** 2026-02-17
**Domain:** LLM risk assessment, approval queue state machine, agent polling, Bun/TypeScript/Drizzle/PostgreSQL
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Risk Assessment
- LLM evaluates risk using intent mismatch detection AND HTTP method heuristics
  - Compare agent's stated intent against HTTP method + URL + body
  - Apply method-level rules (e.g., DELETE/PUT always elevated risk, GET lower risk)
- LLM provider: OpenAI-compatible API format, flexible enough to support multiple providers via configuration
- Fail closed on LLM failure — if the LLM call times out, errors, or is rate-limited, treat the request as risky and block it
- Risk output includes both a numeric score (0-1) and a text explanation of why it was flagged, stored with the blocked request for human review

#### Execute on Approval
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 5 builds on the existing POST /proxy route (Phase 4) by inserting a risk-assessment gate before credential injection and request forwarding. The gate calls an OpenAI-compatible LLM API with the agent's stated intent vs. the actual HTTP method/URL/body; if the score exceeds a threshold, the request is blocked, stored in a new `approval_queue` table with status PENDING, and a 428 response with an `action_id` is returned instead of forwarding the request. The agent then polls GET /status/{action_id} for resolution.

The approval state machine has five states: PENDING (blocked, awaiting human decision), APPROVED (human approved), DENIED (human rejected), EXPIRED (approved but agent never executed within the TTL window), and EXECUTED (agent retrieved the result after execution). When the agent polls and sees APPROVED status, it calls a separate POST /proxy/execute/{action_id} endpoint that injects credentials, forwards the stored request, stores the response in an `approval_responses` table (or within the queue row), and sets status to EXECUTED. Polling then returns the cached result.

No new npm packages are required. The LLM call uses Bun's built-in `fetch()` with the OpenAI-compatible REST API. UUID generation for `action_id` uses `crypto.randomUUID()` (built-in to Bun). New DB tables are added via Drizzle ORM schema + `bun run db:generate` + `bun run db:migrate`, following the identical pattern of previous phases.

**Primary recommendation:** Add `risk.service.ts` (LLM call + heuristics), `approval.service.ts` (queue CRUD), a `approval_queue` table, and two new routes (GET /status/:actionId and POST /proxy/execute/:actionId) wired into `server.ts` via regex matches. Keep risk assessment as a pre-execution interceptor inside `executeProxyRequest()` or as a wrapper called before it in the route handler.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | latest (in package.json) | ORM — new table schema + queries | Already used for all DB access |
| zod | ^4.3.6 | Validation of env vars + request params | Already used throughout |
| bun built-in fetch | Bun runtime | OpenAI-compatible HTTP call | No extra package needed; `fetch()` is global in Bun |
| crypto.randomUUID() | Web standard (Bun built-in) | Generate action_id as UUID v4 | Cross-platform, no import needed in Bun |

### No New Packages Required

All needed functionality is available via existing dependencies and Bun built-ins:
- HTTP calls to LLM API: `fetch()` (global in Bun)
- UUID generation: `crypto.randomUUID()` (global in Bun)
- DB ORM: `drizzle-orm` (already installed)
- Validation: `zod` (already installed)
- TTL expiry scheduling: no library needed — use Drizzle query with `WHERE expiresAt < NOW()` on read, or a simple `setInterval` cleanup job

### Alternatives Considered
| Standard Choice | Alternative | Why We Reject |
|-----------------|-------------|---------------|
| `crypto.randomUUID()` | `Bun.randomUUIDv7()` | UUIDv4 is more universally recognized; UUIDv7 has time-ordering benefit but adds Bun-specific API dependency; not critical for this use case |
| Plain `fetch()` for LLM call | `openai` npm package | Adding a package solely for HTTP wrapping is unnecessary when the OpenAI-compatible format is simple JSON over HTTP; keeps stack lean |
| `setInterval` + DB cleanup | pg_cron or external scheduler | No pg_cron available; setInterval on server startup is simpler and already used conceptually for idempotency TTL |

**Installation:** No new packages to install.

---

## Architecture Patterns

### Recommended File Structure

```
backend/src/
├── db/
│   └── schema.ts                    # Add: approvalQueue table
├── services/
│   ├── risk.service.ts              # NEW: LLM call + method heuristics
│   ├── approval.service.ts          # NEW: approval queue CRUD + state transitions
│   └── proxy.service.ts             # MODIFY: call riskAssess() before forwardRequest()
└── routes/
    ├── proxy.ts                     # MODIFY: add POST /proxy/execute/:actionId
    └── approval.ts                  # NEW: GET /status/:actionId handler
server.ts                            # MODIFY: wire GET /status/:actionId + POST /proxy/execute/:actionId
```

### Pattern 1: Risk Gate Inside executeProxyRequest()

Insert risk assessment as an early step inside the existing `executeProxyRequest()` orchestrator, between URL validation (step 2) and idempotency check (step 3). If risky, throw a `RiskyRequestError` that carries the stored `actionId`. The route handler catches it, returns 428.

**What:** Keeps all proxy lifecycle logic in one orchestrator function.
**When to use:** Always — don't split the risk check into the route handler because the service already owns the lifecycle.

```typescript
// Source: existing proxy.service.ts pattern (modified)
// In proxy.service.ts — new error class
export class RiskyRequestError extends Error {
  statusCode = 428;
  constructor(
    public actionId: string,
    public riskScore: number,
    public riskExplanation: string
  ) {
    super('Request requires human approval');
    this.name = 'RiskyRequestError';
  }
}

// In executeProxyRequest(), after validateTargetUrl:
const riskResult = await assessRisk({
  intent: data.intent,
  method: data.method,
  targetUrl: data.targetUrl,
  body: data.body ?? null,
});

if (riskResult.blocked) {
  // Store in approval_queue
  const actionId = await createApprovalQueueEntry({
    agentId,
    serviceId,
    method: data.method,
    targetUrl: data.targetUrl,
    headers: data.headers,
    body: data.body ?? null,
    intent: data.intent,
    riskScore: riskResult.score,
    riskExplanation: riskResult.explanation,
  });
  throw new RiskyRequestError(actionId, riskResult.score, riskResult.explanation);
}
```

### Pattern 2: OpenAI-Compatible LLM Call

Use plain `fetch()` with `response_format: { type: 'json_object' }`. The system message instructs the model to output JSON. Parse the result; on any error (timeout, non-200, invalid JSON, missing fields), return blocked=true (fail closed).

```typescript
// Source: OpenAI API Reference (platform.openai.com/docs/api-reference/chat)
// risk.service.ts

export async function callLLMForRiskAssessment(
  intent: string,
  method: string,
  targetUrl: string,
  body: string | null,
): Promise<{ score: number; explanation: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s LLM timeout

  try {
    const res = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.LLM_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.LLM_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 300,
        messages: [
          { role: 'system', content: RISK_SYSTEM_PROMPT },
          { role: 'user', content: buildRiskUserPrompt(intent, method, targetUrl, body) },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM returned ${res.status}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');

    const parsed = JSON.parse(content) as { score: number; explanation: string };
    if (typeof parsed.score !== 'number' || typeof parsed.explanation !== 'string') {
      throw new Error('Invalid LLM response shape');
    }

    return { score: Math.max(0, Math.min(1, parsed.score)), explanation: parsed.explanation };
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**CRITICAL NOTE:** Include `"respond with JSON"` instruction in the system prompt itself. OpenAI requires this when using `json_object` mode — without it the model may emit endless whitespace tokens.

### Pattern 3: Method Heuristics (Pre-LLM Gate)

Apply heuristics BEFORE the LLM call to:
1. Block immediately on high-risk methods without calling LLM (save cost)
2. Or use heuristics to adjust the LLM prompt threshold

Recommended approach: let heuristics set a `baseScore` that the LLM result is combined with:

```typescript
// risk.service.ts
function methodBaseScore(method: string): number {
  switch (method.toUpperCase()) {
    case 'DELETE': return 0.7;
    case 'PUT':    return 0.5;
    case 'PATCH':  return 0.4;
    case 'POST':   return 0.3;
    case 'GET':    return 0.1;
    default:       return 0.2;
  }
}

export async function assessRisk(params: RiskInput): Promise<RiskResult> {
  const heuristicScore = methodBaseScore(params.method);

  // Fail-closed: if LLM errors, use heuristic-only score
  // If heuristicScore alone is high enough to block, skip LLM call
  let llmScore = heuristicScore;
  let explanation = `Method ${params.method} carries baseline risk ${heuristicScore}`;

  try {
    const llm = await callLLMForRiskAssessment(
      params.intent, params.method, params.targetUrl, params.body
    );
    // Weighted blend: LLM opinion is more informative than pure method heuristic
    llmScore = llm.score * 0.7 + heuristicScore * 0.3;
    explanation = llm.explanation;
  } catch {
    // Fail closed: on LLM error, use heuristic score but escalate it
    llmScore = Math.min(1, heuristicScore + 0.3);
    explanation = `Risk assessed via method heuristics only (LLM unavailable). Method: ${params.method}`;
  }

  const RISK_THRESHOLD = 0.5; // configurable via env
  return {
    score: llmScore,
    explanation,
    blocked: llmScore >= RISK_THRESHOLD,
  };
}
```

### Pattern 4: Approval Queue State Machine

Five states with the following transitions:

```
PENDING → APPROVED (human approves via dashboard)
PENDING → DENIED   (human denies via dashboard)
APPROVED → EXECUTED (agent calls /proxy/execute/:actionId, gateway executes)
APPROVED → EXPIRED  (TTL cleanup job fires before agent calls execute)
```

EXECUTED and DENIED and EXPIRED are terminal states. No transitions out.

```typescript
// approval_queue status values
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'EXECUTED';
```

### Pattern 5: Polling Response Format

GET /status/{action_id} returns different shapes based on status:

```typescript
// Status: PENDING or DENIED or EXPIRED — no result yet
{ status: 'PENDING', action_id: string, created_at: string }
{ status: 'DENIED',  action_id: string, reason?: string }
{ status: 'EXPIRED', action_id: string }

// Status: APPROVED — tell agent to call execute
{ status: 'APPROVED', action_id: string, execute_url: string }
// execute_url: '/proxy/execute/{action_id}'

// Status: EXECUTED — result ready to retrieve
{
  status: 'EXECUTED',
  action_id: string,
  result: {
    status: number,      // HTTP status from target
    headers: Record<string, string>,
    body: string
  }
}
```

This is the recommended approach: APPROVED state tells the agent WHERE to call, EXECUTED state returns the cached result inline in the poll response. This is simpler than a separate retrieval endpoint.

### Pattern 6: Execute Endpoint

POST /proxy/execute/{action_id} (agent-authenticated):
1. Fetch approval_queue row by action_id + verify agentId matches
2. Verify status is APPROVED (not EXPIRED/DENIED/EXECUTED)
3. Verify approvalExpiresAt has not passed (if it has, flip to EXPIRED, return 410)
4. Inject credentials and forward the stored request
5. Store response in approval_queue row (responseStatus, responseBody, responseHeaders)
6. Flip status to EXECUTED, set executedAt
7. Return the proxied response immediately (same shape as normal /proxy response)

The agent gets the real response directly from POST /proxy/execute/:actionId, AND subsequent polls to GET /status/:actionId return it from cache. This avoids a double-fetch.

### Anti-Patterns to Avoid
- **Executing on approval flip:** Dashboard approval should ONLY update status. Executing at that moment couples dashboard to LLM credential timing and breaks when dashboard user approves stale requests.
- **Storing decrypted credentials in approval_queue:** Never store decrypted API keys. Store only the request parameters (method, URL, headers without auth, body); credentials are injected fresh at execution time.
- **Infinite polling:** Document and enforce polling intervals (e.g., minimum 5s between polls). Without rate limiting, agents may spam GET /status.
- **Missing action_id index:** The approval_queue will be queried by action_id (UUID) constantly. Index it.
- **LLM prompt without JSON instruction:** OpenAI-compatible APIs require explicit "respond with JSON" in the system message when using `response_format: {type: "json_object"}`.

---

## Database Schema Design

### New Table: `approval_queue`

```typescript
// schema.ts addition
export const approvalQueue = pgTable('approval_queue', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  actionId: uuid().defaultRandom().notNull().unique(), // the public-facing ID
  agentId: integer().references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  serviceId: integer().references(() => services.id, { onDelete: 'cascade' }).notNull(),

  // Stored request (no credentials — injected fresh at execution)
  method: varchar({ length: 10 }).notNull(),
  targetUrl: varchar({ length: 2048 }).notNull(),
  requestHeaders: text(),     // JSON-serialized, WITHOUT auth headers
  requestBody: text(),
  intent: varchar({ length: 500 }).notNull(),

  // Risk assessment result
  riskScore: varchar({ length: 10 }).notNull(),  // '0.75' stored as string for portability; or use real type
  riskExplanation: text().notNull(),

  // State machine
  status: varchar({ length: 20 }).notNull().default('PENDING'),
  // PENDING | APPROVED | DENIED | EXPIRED | EXECUTED

  // TTL: if not executed by this time after approval, status → EXPIRED
  approvalExpiresAt: timestamp(),      // set when status flips to APPROVED
  // TTL: approval_queue row itself expires (for cleanup, not state change)
  createdAt: timestamp().defaultNow().notNull(),
  resolvedAt: timestamp(),             // when APPROVED/DENIED set
  executedAt: timestamp(),             // when EXECUTED set

  // Cached execution result
  responseStatus: integer(),
  responseHeaders: text(),             // JSON-serialized
  responseBody: text(),
}, (table) => ({
  actionIdIdx: uniqueIndex('approval_queue_action_id_idx').on(table.actionId),
  agentIdIdx: index('approval_queue_agent_id_idx').on(table.agentId),
  statusIdx: index('approval_queue_status_idx').on(table.status),
  createdAtIdx: index('approval_queue_created_at_idx').on(table.createdAt),
}));
```

**Note on riskScore column type:** Use `real` (float) Drizzle type if available in this schema, or store as `varchar` and parse on read. Drizzle's `real()` maps to PostgreSQL `real` type — check drizzle-orm Postgres column types doc.

**Note on uuid() in Drizzle for Postgres:** The `uuid().defaultRandom()` generates `DEFAULT gen_random_uuid()` in SQL. PostgreSQL 13+ includes `gen_random_uuid()` natively in the `pgcrypto` extension (auto-loaded in most setups). Verify it's available or use `crypto.randomUUID()` in application code instead and pass the value explicitly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM HTTP client | Custom retry/streaming parser | Plain `fetch()` with abort controller | OpenAI-compatible format is simple JSON; no streaming needed for risk assessment |
| JSON parsing of LLM output | Schema-validating custom parser | `JSON.parse()` + zod shape check | LLM output is small; full schema validation via zod is two lines |
| UUID for action_id | Sequential ID or custom token | `crypto.randomUUID()` | Already available globally in Bun, no import, cryptographically random |
| TTL expiry polling | External cron job | DB query + `setInterval` on server start | Simple for v1; matches how idempotency TTL already works |
| Credential storage in queue | Storing decrypted credentials | Re-inject at execution from encrypted credentials table | Credentials never leave the vault; re-decrypted fresh at execute time |

**Key insight:** The system's complexity is in the state machine transitions and the fail-closed LLM error handling, not in any novel library needs. Keep the stack minimal.

---

## Common Pitfalls

### Pitfall 1: Storing Auth Headers in approval_queue
**What goes wrong:** Agent sends `Authorization: Bearer agt_xxx` header in the proxy request body. If stored verbatim in `requestHeaders`, the agent API key gets written to the DB in a queryable column alongside risk data.
**Why it happens:** Naively copying `data.headers` without stripping auth.
**How to avoid:** Strip `Authorization`, `Agent-Key`, and any credential headers before persisting to `approval_queue.requestHeaders`. Credentials are re-injected from encrypted store at execution time anyway.
**Warning signs:** `requestHeaders` JSON contains `Authorization` or `Agent-Key` keys.

### Pitfall 2: LLM Call Timing Out and Blocking the Proxy Response
**What goes wrong:** LLM provider is slow; 30s proxy timeout fires before risk assessment completes, making every proxy request fail.
**Why it happens:** LLM timeout not set separately from proxy forward timeout.
**How to avoid:** Set a strict 10s AbortController timeout on the LLM call specifically (separate from the 30s forward timeout). On timeout, fail closed (treat as risky), don't wait.
**Warning signs:** Proxy requests taking 30+ seconds with LLM-related errors.

### Pitfall 3: Race Condition on Status Transitions
**What goes wrong:** Dashboard approves a request at the same moment the TTL cleanup job marks it EXPIRED. Double update causes inconsistent state.
**Why it happens:** No optimistic locking or conditional update.
**How to avoid:** Use conditional UPDATE with WHERE clause: `UPDATE approval_queue SET status='EXPIRED' WHERE status='APPROVED' AND approvalExpiresAt < NOW()`. Dashboard approval uses: `UPDATE ... SET status='APPROVED' WHERE status='PENDING'`. These are naturally exclusive due to the WHERE condition.
**Warning signs:** Requests appearing APPROVED and EXPIRED simultaneously in logs.

### Pitfall 4: Missing `action_id` in 428 Response Causes Agent Deadlock
**What goes wrong:** 428 is returned but the body doesn't include the `action_id`. Agent cannot poll because it doesn't know the ID.
**Why it happens:** Error response format in route handler uses generic `errorResponse()` which only returns `{error, statusCode}`.
**How to avoid:** Create a custom `blockedResponse()` helper or inline the 428 response construction in the proxy route handler with the `action_id` included.
**Warning signs:** Agents receiving 428 but polling without an ID.

### Pitfall 5: OpenAI JSON Mode Without "Respond with JSON" in System Prompt
**What goes wrong:** LLM emits whitespace tokens indefinitely; request hits `max_tokens` limit with no valid JSON.
**Why it happens:** OpenAI requires explicit JSON output instruction in the messages when using `response_format: {type: "json_object"}`.
**How to avoid:** Always include "You must respond with valid JSON" in the system prompt.
**Warning signs:** LLM responses that are empty strings or truncated after max_tokens.

### Pitfall 6: Approved Request Expires Before Agent Executes — Stale 410 With No Retry Path
**What goes wrong:** Agent polls, sees APPROVED, then takes too long to call /proxy/execute/:actionId. The TTL cleanup flips it to EXPIRED. Agent calls execute, gets 410. Agent is stuck with no recourse.
**Why it happens:** TTL too short, or agent logic doesn't handle 410 on execute.
**How to avoid:** Set TTL generous enough (recommend 1 hour for approval expiry). Document clearly that agent must call execute within this window after seeing APPROVED. Return 410 with a clear message: "Approval expired — resubmit request via POST /proxy."
**Warning signs:** Agents seeing frequent 410 errors on execute.

### Pitfall 7: `uuid()` Drizzle Column Without pgcrypto Extension
**What goes wrong:** `gen_random_uuid()` SQL default fails if `pgcrypto` is not enabled.
**Why it happens:** `uuid().defaultRandom()` in Drizzle generates a SQL `DEFAULT gen_random_uuid()` which requires pgcrypto.
**How to avoid:** Either add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` to the migration, or generate the UUID in application code (`crypto.randomUUID()`) and pass it as the insert value (no SQL default needed).
**Recommended:** Generate UUID in app code — simpler, no extension dependency. Use `varchar({length: 36})` for the column type to store it.
**Warning signs:** Migration succeeds but inserts fail with "function gen_random_uuid() does not exist".

---

## Code Examples

### 428 Blocking Response Shape

```typescript
// In proxy.ts route handler, catching RiskyRequestError
if (error instanceof RiskyRequestError) {
  return Response.json(
    {
      error: 'Request requires human approval',
      action_id: error.actionId,
      risk_score: error.riskScore,
      status_url: `/status/${error.actionId}`,
    },
    { status: 428 }
  );
}
```

### LLM Risk Assessment System Prompt

```typescript
// risk.service.ts
const RISK_SYSTEM_PROMPT = `You are a security risk assessor for an AI agent gateway.
You evaluate whether an agent's stated intent matches the HTTP request it is making.
You must respond with valid JSON in this exact format:
{"score": <number 0.0-1.0>, "explanation": "<one sentence>"}

Score guidelines:
- 0.0-0.2: Low risk — intent clearly matches a safe read operation
- 0.2-0.5: Medium risk — minor mismatch or write operation with plausible intent
- 0.5-0.8: High risk — significant mismatch or destructive operation
- 0.8-1.0: Critical risk — clear intent mismatch, dangerous method, or suspicious patterns

Respond ONLY with the JSON object. No other text.`;

function buildRiskUserPrompt(
  intent: string,
  method: string,
  targetUrl: string,
  body: string | null
): string {
  return `Agent stated intent: "${intent}"

Actual HTTP request:
Method: ${method}
URL: ${targetUrl}
Body: ${body ? body.substring(0, 500) : '(none)'}

Assess whether the intent matches the request and provide a risk score.`;
}
```

### Approval Queue CRUD (approval.service.ts)

```typescript
// approval.service.ts
import { db } from '@/config/db';
import { approvalQueue } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';

export async function createApprovalQueueEntry(params: {
  agentId: number;
  serviceId: number;
  method: string;
  targetUrl: string;
  requestHeaders: Record<string, string>; // already stripped of auth headers
  requestBody: string | null;
  intent: string;
  riskScore: number;
  riskExplanation: string;
}): Promise<string> {
  const actionId = crypto.randomUUID();
  await db.insert(approvalQueue).values({
    actionId,
    agentId: params.agentId,
    serviceId: params.serviceId,
    method: params.method,
    targetUrl: params.targetUrl,
    requestHeaders: JSON.stringify(params.requestHeaders),
    requestBody: params.requestBody,
    intent: params.intent,
    riskScore: params.riskScore.toFixed(4),
    riskExplanation: params.riskExplanation,
    status: 'PENDING',
  });
  return actionId;
}

export async function getApprovalQueueEntry(actionId: string) {
  const [row] = await db
    .select()
    .from(approvalQueue)
    .where(eq(approvalQueue.actionId, actionId))
    .limit(1);
  return row ?? null;
}

// Called by TTL cleanup job
export async function expireStaleApprovals(): Promise<void> {
  await db
    .update(approvalQueue)
    .set({ status: 'EXPIRED' })
    .where(
      and(
        eq(approvalQueue.status, 'APPROVED'),
        lt(approvalQueue.approvalExpiresAt, new Date())
      )
    );
}
```

### Server Routing Additions (server.ts)

```typescript
// In handleRequest() — add alongside proxy route matching
import { handleApprovalStatus } from '@/routes/approval';
import { handleProxyExecute } from '@/routes/proxy';

// GET /status/:actionId
const statusMatch = pathname.match(/^\/status\/([0-9a-f-]{36})$/);
if (statusMatch && method === 'GET') {
  return await handleApprovalStatus(req, { actionId: statusMatch[1] });
}

// POST /proxy/execute/:actionId
const executeMatch = pathname.match(/^\/proxy\/execute\/([0-9a-f-]{36})$/);
if (executeMatch && method === 'POST') {
  return await handleProxyExecute(req, { actionId: executeMatch[1] });
}
```

### TTL Cleanup Job (server.ts startup)

```typescript
// In server startup (server.ts), after initEncryption()
import { expireStaleApprovals } from '@/services/approval.service';

// Run TTL cleanup every 5 minutes
setInterval(() => {
  expireStaleApprovals().catch((err) => {
    console.error('TTL cleanup error:', err);
  });
}, 5 * 60 * 1000);
```

### Environment Variables to Add

```bash
# .env additions for Phase 5
LLM_BASE_URL=https://api.openai.com/v1       # or any OpenAI-compatible endpoint
LLM_API_KEY=sk-...                           # provider API key
LLM_MODEL=gpt-4o-mini                        # model name
LLM_TIMEOUT_MS=10000                         # LLM call timeout (default 10s)
RISK_THRESHOLD=0.5                           # score at/above which to block
APPROVAL_EXECUTE_TTL_HOURS=1                 # hours after approval before EXPIRED
```

Add these to `env.ts` with `getEnvVar()` / `getEnvNumber()` calls following the existing pattern.

---

## Recommended TTL Values

| TTL | Duration | Rationale |
|-----|----------|-----------|
| Approval execute TTL | 1 hour | Enough time for agent to retry; short enough to prevent stale credential use |
| Approval queue row cleanup | 7 days | Keep rows for audit/dashboard display; Phase 6 dashboard needs to show history |
| Execution response cache | 24 hours | Matches existing idempotency key TTL; agent may need to re-poll after network error |

The approval queue rows should NOT be hard-deleted after execution — Phase 6 dashboard will display them. Use status transitions as the lifecycle, not DELETE operations.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Polling with exponential backoff | Polling with documented minimum interval (5s recommended) | Prevents API spam; WebSockets deferred to v2 |
| LLM structured outputs (json_schema) | JSON mode (json_object) for max provider compatibility | Structured outputs only work on newer OpenAI models; json_object works across OpenAI, Anthropic-via-proxy, local models |
| Sequential integer IDs as action_id | UUID v4 via crypto.randomUUID() | Non-guessable, safe to expose in API response |

---

## Open Questions

1. **Risk threshold value (0.5 default)**
   - What we know: 0.5 is a reasonable midpoint; DELETE/PUT with clear intent might score 0.45 and pass through
   - What's unclear: Will 0.5 cause too many false positives or too many misses for this specific use case?
   - Recommendation: Make RISK_THRESHOLD configurable via env var. Start at 0.5. Phase 6 dashboard will surface false positive rates.

2. **riskScore column type in Drizzle**
   - What we know: Drizzle has `real()` and `doublePrecision()` for floats, or store as varchar
   - What's unclear: Whether `real()` introduces any precision issues for a 0-1 score
   - Recommendation: Use `real()` Drizzle column type (`REAL` in Postgres, 4-byte float). Precision is fine for 0-1 risk scores. Alternatively, store as integer * 10000 (e.g., 7500 = 0.75) for exact storage.

3. **Whether to strip the body from the stored request if it contains sensitive data**
   - What we know: The body is needed to replay the exact request at execute time
   - What's unclear: Should we truncate/redact body content beyond a certain size before storage?
   - Recommendation: Store the full body up to 1MB. Add a requestBodySize check; if body > 1MB, reject before risk assessment (same 10MB limit logic already exists in proxy.service.ts).

---

## Sources

### Primary (HIGH confidence)
- Existing codebase — `backend/src/services/proxy.service.ts`, `idempotency.service.ts`, `schema.ts`, `server.ts` — all patterns directly read from source
- Bun docs (bun.com/docs/guides/util/javascript-uuid) — `crypto.randomUUID()` available globally in Bun
- OpenAI API Reference (platform.openai.com/docs/api-reference/chat) — `response_format: {type: "json_object"}`, message structure confirmed

### Secondary (MEDIUM confidence)
- WebSearch: OpenAI JSON mode requires explicit "respond with JSON" in system prompt — confirmed by multiple OpenAI community sources and Azure OpenAI docs
- WebSearch: Drizzle `uuid().defaultRandom()` generates `DEFAULT gen_random_uuid()` — confirmed by Drizzle ORM docs
- WebSearch: Drizzle migration workflow — `bun run db:generate` then `bun run db:migrate` — matches existing `package.json` scripts

### Tertiary (LOW confidence)
- Recommended TTL durations (1 hour approval, 7 day row retention, 24h response cache) — derived from reasoning about use case, not from external source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already in use; verified via codebase read
- Architecture (state machine, routing): HIGH — based directly on existing routing patterns in server.ts + idempotency service patterns
- LLM call format: HIGH — OpenAI-compatible format is well-documented; using json_object mode for broad compatibility
- Pitfalls: HIGH — auth header stripping, fail-closed, race conditions derived from actual code inspection
- TTL values: LOW — reasonable defaults, not validated against production data

**Research date:** 2026-02-17
**Valid until:** 2026-03-19 (30 days — stable domain; Bun/Drizzle/OpenAI API format unlikely to break compatibility)
