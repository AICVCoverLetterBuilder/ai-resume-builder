/**
 * Deadline-aware budget for CV AI generation requests (Professional Summary,
 * Bullets, Rewrite) and dev/test-only timing diagnostics.
 *
 * ROOT CAUSE (Android build 229 "first Hindi request times out, retry
 * succeeds"): the server recovery chain (provider attempt -> repair attempt
 * -> deterministic fallback) had no shared deadline. Each provider call used
 * a 25s Anthropic SDK timeout AND was retried once even when the failure WAS
 * that same timeout (up to 50s for a single logical attempt), so a request
 * that needed both an initial attempt and a repair attempt could take up to
 * ~100s server-side while the client aborted at a fixed 30s — regardless of
 * locale. Hindi hits the repair path far more often than sr/en (its
 * validators — script, duration placement, tense — are the strictest of the
 * 12 locales), so it was disproportionately likely to need two sequential
 * provider round-trips and blow the client deadline on the very first
 * attempt. A same-locale retry then either got a directly-valid provider
 * response or simply drew a faster network round-trip and finished in time —
 * explaining the "intermittent, fixed by retrying" symptom without any
 * state, cache, or initialization-order involvement.
 *
 * FIX: one authoritative, bounded deadline budget shared by every stage:
 *  - new clients wait `AI_CLIENT_TIMEOUT_MS` (40s); the server budget is kept
 *    under the legacy Android-229 client abort of 30s as well, so a
 *    Production Vercel deploy alone unblocks already-shipped builds;
 *  - the server tracks remaining budget and skips the repair round-trip
 *    entirely (going straight to the fast local fallback) once there is not
 *    enough time left for it to plausibly finish before the shared deadline;
 *  - a provider call that itself times out is never retried (a retry with
 *    the same timeout can only make the deadline worse, never better) —
 *    only genuinely fast-failing transient errors (5xx/ECONNRESET/overload)
 *    get a single bounded retry.
 */

/**
 * Client-side AbortController deadline for one CV AI request (summary/bullets/rewrite).
 * New Android/web builds ship this value. Android build 229 (and earlier) still
 * abort at the previous hard-coded 30_000ms — see `AI_LEGACY_CLIENT_TIMEOUT_MS`.
 */
export const AI_CLIENT_TIMEOUT_MS = 40_000;

/** Guarantees a finite, positive AbortController delay (never 0 / NaN / negative). */
export function resolveClientAbortTimeoutMs(value: number = AI_CLIENT_TIMEOUT_MS): number {
  return Number.isFinite(value) && value >= 1_000 ? value : AI_CLIENT_TIMEOUT_MS;
}

/**
 * Hard-coded AbortController deadline that shipped in Android build 229 (and
 * earlier). The server budget below is intentionally kept under this value so
 * a Production Vercel deploy alone can still finish — and return a valid
 * deterministic fallback — before those already-shipped clients abort. New
 * Android builds that pick up `AI_CLIENT_TIMEOUT_MS` get additional margin.
 */
export const AI_LEGACY_CLIENT_TIMEOUT_MS = 30_000;

/**
 * Server-side wall-clock budget for the full recovery chain (initial provider
 * attempt + optional repair attempt + local deterministic fallback). Kept
 * under BOTH `AI_LEGACY_CLIENT_TIMEOUT_MS` (so already-shipped Android 229
 * clients stop timing out) and `AI_CLIENT_TIMEOUT_MS` (new builds), leaving
 * margin for request/response network transfer, Vercel cold start, and
 * hosting-platform routing overhead.
 */
export const AI_SERVER_BUDGET_MS = 26_000;

/**
 * Single Anthropic call deadline. No automatic retry-on-timeout (see
 * `isRetryableProviderError`) — retrying an already-timed-out call can only
 * make the deadline worse, never better.
 */
export const AI_PROVIDER_CALL_TIMEOUT_MS = 11_000;

/**
 * Minimum remaining server budget required to even START a repair call. One
 * more provider round-trip can take up to `AI_PROVIDER_CALL_TIMEOUT_MS`; the
 * margin covers validation/serialization overhead. Below this threshold,
 * repair is skipped and the deterministic fallback (fast, local, no network
 * call) is used immediately instead.
 */
export const AI_MIN_REPAIR_BUDGET_MS = AI_PROVIDER_CALL_TIMEOUT_MS + 2_000;

export function computeServerDeadline(requestStartedAt: number): number {
  return requestStartedAt + AI_SERVER_BUDGET_MS;
}

export function remainingBudgetMs(deadlineAt: number, now = Date.now()): number {
  return deadlineAt - now;
}

/** True when there is enough remaining budget to attempt one more provider round-trip (repair). */
export function hasRepairBudget(deadlineAt: number | null | undefined, now = Date.now()): boolean {
  if (deadlineAt == null) return true; // No deadline configured (e.g. legacy callers/tests) — behave as before.
  return remainingBudgetMs(deadlineAt, now) >= AI_MIN_REPAIR_BUDGET_MS;
}

/**
 * Errors worth a single fast retry. Timeout is deliberately EXCLUDED — see
 * module docstring: retrying a call that already consumed its full timeout
 * budget cannot help and only risks blowing the shared deadline further.
 */
export function isRetryableProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('ECONNRESET')
    || msg.includes('overloaded')
    || msg.includes('529')
    || msg.includes('503')
    || msg.includes('502')
    || msg.includes('500')
  );
}

export interface AiServerRequestTiming {
  requestId?: string | null;
  action: string;
  requestedLocale: string;
  sourceLocale?: string | null;
  serverReceivedAt: number;
  providerStartedAt?: number | null;
  providerFinishedAt?: number | null;
  providerValid?: boolean | null;
  repairAttempted?: boolean;
  repairSkippedReason?: string | null;
  repairStartedAt?: number | null;
  repairFinishedAt?: number | null;
  fallbackStartedAt?: number | null;
  fallbackFinishedAt?: number | null;
  serverRespondedAt: number;
  deadlineAt?: number | null;
}

/** Dev/test-only. Never logs CV content or personal data — timestamps and stage outcomes only. */
export function logAiServerRequestTiming(t: AiServerRequestTiming): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof console === 'undefined' || !console.info) return;
  const providerDurationMs = t.providerStartedAt != null && t.providerFinishedAt != null
    ? t.providerFinishedAt - t.providerStartedAt
    : null;
  const repairDurationMs = t.repairStartedAt != null && t.repairFinishedAt != null
    ? t.repairFinishedAt - t.repairStartedAt
    : null;
  const fallbackDurationMs = t.fallbackStartedAt != null && t.fallbackFinishedAt != null
    ? t.fallbackFinishedAt - t.fallbackStartedAt
    : null;
  const lines = [
    'AI_REQUEST_TIMING',
    `requestId=${t.requestId ?? 'n/a'}`,
    `action=${t.action}`,
    `requestedLocale=${t.requestedLocale}`,
    `sourceLocale=${t.sourceLocale ?? 'n/a'}`,
    `serverReceivedAt=${t.serverReceivedAt}`,
    `providerStartedAt=${t.providerStartedAt ?? 'n/a'}`,
    `providerFinishedAt=${t.providerFinishedAt ?? 'n/a'}`,
    `providerDurationMs=${providerDurationMs ?? 'n/a'}`,
    `providerValid=${t.providerValid ?? 'n/a'}`,
    `repairAttempted=${Boolean(t.repairAttempted)}`,
    `repairSkippedReason=${t.repairSkippedReason ?? 'n/a'}`,
    `repairStartedAt=${t.repairStartedAt ?? 'n/a'}`,
    `repairFinishedAt=${t.repairFinishedAt ?? 'n/a'}`,
    `repairDurationMs=${repairDurationMs ?? 'n/a'}`,
    `fallbackStartedAt=${t.fallbackStartedAt ?? 'n/a'}`,
    `fallbackFinishedAt=${t.fallbackFinishedAt ?? 'n/a'}`,
    `fallbackDurationMs=${fallbackDurationMs ?? 'n/a'}`,
    `serverRespondedAt=${t.serverRespondedAt}`,
    `serverTotalMs=${t.serverRespondedAt - t.serverReceivedAt}`,
    `deadlineAt=${t.deadlineAt ?? 'n/a'}`,
  ];
  console.info(lines.join('\n'));
}

/** Dev/test-only. Never logs CV content or personal data — timestamps and stage outcomes only. */
export function logAiClientRequestTiming(input: {
  requestId: string;
  action: string;
  requestedLocale: string;
  clientStartedAt: number;
  clientTimeoutMs: number;
  clientFinishedAt?: number;
  clientAborted: boolean;
  applied: boolean;
  reason?: string | null;
}): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof console === 'undefined' || !console.debug) return;
  const finishedAt = input.clientFinishedAt ?? Date.now();
  const lines = [
    'AI_CLIENT_REQUEST_TIMING',
    `requestId=${input.requestId}`,
    `action=${input.action}`,
    `requestedLocale=${input.requestedLocale}`,
    `clientStartedAt=${input.clientStartedAt}`,
    `clientTimeoutMs=${input.clientTimeoutMs}`,
    `clientDurationMs=${finishedAt - input.clientStartedAt}`,
    `clientAborted=${input.clientAborted}`,
    `applied=${input.applied}`,
  ];
  if (input.reason) lines.push(`reason=${input.reason}`);
  console.debug(lines.join('\n'));
}
