// Risk assessment service: LLM intent analysis + HTTP method heuristics
// Fail-closed: LLM errors result in elevated risk score (never silently pass through)

import { env } from '@/config/env';

/**
 * Input to the risk assessment function.
 */
export interface RiskInput {
  intent: string;     // agent's stated purpose for the request
  method: string;     // HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
  targetUrl: string;  // target URL being proxied
  body: string | null; // request body (may be null for GET/DELETE/HEAD)
}

/**
 * Result of the risk assessment.
 */
export interface RiskResult {
  score: number;       // 0-1 composite risk score (LLM + heuristic blend)
  explanation: string; // human-readable explanation for dashboard display
  blocked: boolean;    // true if score >= RISK_THRESHOLD (fail closed on LLM error)
}

/**
 * System prompt for LLM risk assessment.
 *
 * CRITICAL: Must include "respond with valid JSON" instruction — OpenAI json_object
 * mode requires explicit JSON instruction in the system prompt (pitfall #5 from research).
 * Without it, the model may emit whitespace tokens until max_tokens is exhausted.
 */
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

/**
 * Baseline risk scores by HTTP method (method heuristics).
 *
 * These reflect the inherent risk of each HTTP method regardless of intent.
 * Used as one component of the final blended score.
 */
function methodBaseScore(method: string): number {
  switch (method.toUpperCase()) {
    case 'DELETE':  return 0.7;
    case 'PUT':     return 0.5;
    case 'PATCH':   return 0.4;
    case 'POST':    return 0.3;
    case 'GET':     return 0.1;
    case 'HEAD':
    case 'OPTIONS': return 0.05;
    default:        return 0.2;
  }
}

/**
 * Build the user message for the LLM risk assessment prompt.
 *
 * Truncates body to first 500 characters to control token usage.
 */
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

/**
 * Call an OpenAI-compatible LLM API to assess risk.
 *
 * Uses AbortController with env.LLM_TIMEOUT_MS timeout (default 10s), separate from
 * the 30s proxy forward timeout (pitfall #2 from research).
 *
 * On ANY failure (timeout, non-200, invalid JSON, missing fields): throws an error.
 * The caller (assessRisk) handles failures with fail-closed behavior.
 *
 * @throws Error on any failure — caller must handle with fail-closed logic
 */
async function callLLMForRiskAssessment(
  intent: string,
  method: string,
  targetUrl: string,
  body: string | null
): Promise<{ score: number; explanation: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);

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
      throw new Error(`LLM API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM returned empty response content');
    }

    const parsed = JSON.parse(content) as { score: unknown; explanation: unknown };

    if (typeof parsed.score !== 'number' || typeof parsed.explanation !== 'string') {
      throw new Error('LLM response has invalid shape (expected {score: number, explanation: string})');
    }

    // Clamp score to valid [0, 1] range in case LLM returns out-of-range value
    return {
      score: Math.max(0, Math.min(1, parsed.score)),
      explanation: parsed.explanation,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Assess the risk of a proxy request using LLM intent analysis and HTTP method heuristics.
 *
 * Scoring strategy (per user decision):
 * - LLM evaluates intent mismatch AND method appropriateness
 * - On success: blended score = llmScore * 0.7 + heuristicScore * 0.3 (LLM weighted higher)
 * - On LLM failure: FAIL CLOSED — escalated heuristic score = min(1, heuristicScore + 0.3)
 *
 * The fail-closed behavior ensures LLM unavailability never silently permits risky requests
 * (per user constraint and research pitfall #2).
 *
 * @param params - Request details for risk evaluation
 * @returns RiskResult with composite score, explanation, and blocked flag
 */
export async function assessRisk(params: RiskInput): Promise<RiskResult> {
  const heuristicScore = methodBaseScore(params.method);

  let finalScore: number;
  let explanation: string;

  try {
    const llmResult = await callLLMForRiskAssessment(
      params.intent,
      params.method,
      params.targetUrl,
      params.body
    );
    // Weighted blend: LLM opinion is more informative than pure method heuristic
    finalScore = llmResult.score * 0.7 + heuristicScore * 0.3;
    explanation = llmResult.explanation;
  } catch {
    // FAIL CLOSED: on any LLM error, escalate the heuristic score
    // This ensures LLM unavailability never silently passes through risky requests
    finalScore = Math.min(1, heuristicScore + 0.3);
    explanation = `Risk assessed via method heuristics only (LLM unavailable). Method: ${params.method}`;
  }

  return {
    score: finalScore,
    explanation,
    blocked: finalScore >= env.RISK_THRESHOLD,
  };
}
