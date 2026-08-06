/**
 * Deadline-aware budget for CV AI generation requests (Professional Summary,
 * Bullets, Rewrite) and dev/test-only timing diagnostics.
 *
 * ROOT CAUSE (Android build 231 "~32s then Mrežna greška"):
 *   Vercel `maxDuration` for `/api/generate` is ~31s. The Anthropic SDK's
 *   client-level `timeout` is retried by default (`maxRetries`), so a single
 *   logical provider attempt can wait far longer than `AI_PROVIDER_CALL_TIMEOUT_MS`
 *   and hold the serverless invocation open until the platform terminates the
 *   connection — which Android then surfaces as `network_error` (Failed to
 *   fetch / connection closed), ~1s after the 31s platform limit, while the
 *   client AbortController is still at 40s.
 *
 * FIX:
 *  - Application response budget well under the platform limit (~22s vs ~30s).
 *  - Every provider call uses `maxRetries: 0` + AbortSignal hard-cancel so the
 *    underlying HTTP request is terminated when its slice expires.
 *  - Repair is skipped when remaining budget cannot cover another call.
 *  - Deterministic local fallback returns before the platform can kill us.
 */

/** Client-side AbortController deadline (Android build 230+). */
export const AI_CLIENT_TIMEOUT_MS = 40_000;

/** Guarantees a finite, positive AbortController delay (never 0 / NaN / negative). */
export function resolveClientAbortTimeoutMs(value: number = AI_CLIENT_TIMEOUT_MS): number {
  return Number.isFinite(value) && value >= 1_000 ? value : AI_CLIENT_TIMEOUT_MS;
}

/** Hard-coded AbortController deadline that shipped in Android build 229. */
export const AI_LEGACY_CLIENT_TIMEOUT_MS = 30_000;

/**
 * Vercel/Next.js route `maxDuration` (seconds) for `/api/generate`.
 * Kept as a named constant for tests; the route file must repeat the literal
 * because Next.js requires a static numeric export.
 */
export const AI_PLATFORM_MAX_DURATION_S = 30;

/**
 * Application wall-clock budget for the full recovery chain, measured from
 * the earliest route entry. Must finish — and begin returning JSON — several
 * seconds before the platform limit so cold-start, validation and response
 * serialization cannot push us into a Vercel kill.
 */
export const AI_SERVER_BUDGET_MS = 22_000;

/**
 * Single provider-call slice. Used both as the SDK `timeout` and as the
 * AbortSignal timer. Combined with `maxRetries: 0` so the SDK cannot silently
 * stack multiple full timeouts.
 */
export const AI_PROVIDER_CALL_TIMEOUT_MS = 8_000;

/**
 * Experience export localization is one request containing two sequential,
 * independently validated provider calls. These dedicated bounds leave the
 * existing Summary/Bullets recovery contract unchanged.
 */
export const EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS = 11_500;
export const EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS = 11_500;
export const EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS = 27_000;
export const EXPERIENCE_LOCALIZATION_CLIENT_TIMEOUT_MS = 29_000;
/**
 * One export-localization operation may span several bounded server requests,
 * but it must never scale its wall-clock deadline without limit. Four complete
 * 29-second client windows plus a 4-second orchestration guard yield a fixed,
 * retryable two-minute operation budget independent of record count.
 */
export const EXPERIENCE_LOCALIZATION_OPERATION_DEADLINE_MS = 120_000;
export const EXPERIENCE_EXPORT_PREPARATION_TIMEOUT_MS = 29_000;

export function computeExperienceLocalizationDeadline(requestStartedAt: number): number {
  return requestStartedAt + EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS;
}

export function computeExperienceLocalizationOperationDeadline(startedAt: number): number {
  return startedAt + EXPERIENCE_LOCALIZATION_OPERATION_DEADLINE_MS;
}

/**
 * Minimum remaining application budget required to START a repair call.
 * Below this, skip repair and return the local deterministic fallback.
 */
export const AI_MIN_REPAIR_BUDGET_MS = AI_PROVIDER_CALL_TIMEOUT_MS + 2_000;

/**
 * Final response-guard margin: if less than this remains before the
 * application deadline, skip further awaitable work and return whatever safe
 * result is already available (or a structured timeout error).
 */
export const AI_RESPONSE_GUARD_MS = 2_000;

/** Safety margin between application budget and platform maxDuration. */
export const AI_PLATFORM_SAFETY_MARGIN_MS =
  AI_PLATFORM_MAX_DURATION_S * 1000 - AI_SERVER_BUDGET_MS;

export function computeServerDeadline(requestStartedAt: number): number {
  return requestStartedAt + AI_SERVER_BUDGET_MS;
}

export function remainingBudgetMs(deadlineAt: number, now = Date.now()): number {
  return deadlineAt - now;
}

/** True when there is enough remaining budget to attempt one more provider round-trip (repair). */
export function hasRepairBudget(deadlineAt: number | null | undefined, now = Date.now()): boolean {
  if (deadlineAt == null) return true;
  return remainingBudgetMs(deadlineAt, now) >= AI_MIN_REPAIR_BUDGET_MS;
}

/** True when enough time remains to start *any* provider call. */
export function hasProviderBudget(deadlineAt: number | null | undefined, now = Date.now()): boolean {
  if (deadlineAt == null) return true;
  return remainingBudgetMs(deadlineAt, now) >= Math.min(AI_PROVIDER_CALL_TIMEOUT_MS, AI_RESPONSE_GUARD_MS + 1_000);
}

/** True when the route should stop awaiting and return immediately. */
export function shouldForceRespond(deadlineAt: number | null | undefined, now = Date.now()): boolean {
  if (deadlineAt == null) return false;
  return remainingBudgetMs(deadlineAt, now) <= AI_RESPONSE_GUARD_MS;
}

/**
 * Per-call timeout clamped to the remaining application budget (minus a small
 * serialization cushion) so a provider call can never run into the platform kill.
 */
export function providerCallTimeoutMs(deadlineAt: number | null | undefined, now = Date.now()): number {
  if (deadlineAt == null) return AI_PROVIDER_CALL_TIMEOUT_MS;
  const remaining = remainingBudgetMs(deadlineAt, now) - 500;
  return Math.max(1_000, Math.min(AI_PROVIDER_CALL_TIMEOUT_MS, remaining));
}

/**
 * Errors worth a single fast retry. Timeout / abort are deliberately EXCLUDED —
 * retrying an already-timed-out call can only make the shared deadline worse.
 */
export function isRetryableProviderError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes('timeout')
    || lower.includes('aborted')
    || lower.includes('abort')
    || (err instanceof Error && err.name === 'AbortError')
  ) {
    return false;
  }
  return (
    msg.includes('ECONNRESET')
    || msg.includes('overloaded')
    || msg.includes('529')
    || msg.includes('503')
    || msg.includes('502')
    || msg.includes('500')
  );
}

export function isProviderAbortOrTimeoutError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const name = err instanceof Error ? err.name : '';
  return (
    name === 'AbortError'
    || name === 'APIUserAbortError'
    || name === 'APIConnectionTimeoutError'
    || msg.includes('timeout')
    || msg.includes('aborted')
    || msg.includes('abort')
  );
}

/**
 * Options passed to a provider `messages.create`-compatible function.
 * Matches the Anthropic SDK RequestOptions subset we rely on.
 */
export interface ProviderCallOptions {
  signal?: AbortSignal;
  timeout?: number;
  maxRetries?: number;
}

export type ProviderDeadlineOwner =
  | 'provider_transport'
  | 'translation_transport'
  | 'verifier_transport'
  | 'route_deadline'
  | 'client_abort';

export type ProviderDeadlineError = Error & {
  deadlineOwner: ProviderDeadlineOwner;
  configuredTimeoutMs: number;
  effectiveTimeoutMs: number;
};

function deadlineError(
  message: string,
  owner: ProviderDeadlineOwner,
  configuredTimeoutMs: number,
  effectiveTimeoutMs: number,
): ProviderDeadlineError {
  return Object.assign(new Error(message), {
    name: 'AbortError',
    deadlineOwner: owner,
    configuredTimeoutMs,
    effectiveTimeoutMs,
  }) as ProviderDeadlineError;
}

/**
 * Runs one provider call under a hard AbortSignal + timeout, with SDK retries
 * disabled. The underlying request is cancelled when the slice expires so the
 * serverless function can continue to deterministic fallback immediately.
 */
export async function callProviderWithDeadline<T>(
  create: (options: ProviderCallOptions) => Promise<T>,
  deadlineAt?: number | null,
  configuredTimeoutMs: number = AI_PROVIDER_CALL_TIMEOUT_MS,
  timeoutStage: 'provider' | 'translation' | 'verifier' = 'provider',
  cancellationSignal?: AbortSignal | null,
): Promise<T> {
  if (cancellationSignal?.aborted) {
    throw deadlineError('client_abort before provider dispatch', 'client_abort', configuredTimeoutMs, 0);
  }
  if (!hasProviderBudget(deadlineAt)) {
    throw deadlineError(
      'route_deadline_insufficient before provider dispatch',
      'route_deadline',
      configuredTimeoutMs,
      Math.max(0, deadlineAt == null ? 0 : remainingBudgetMs(deadlineAt)),
    );
  }

  const timeoutMs = deadlineAt == null
    ? configuredTimeoutMs
    : Math.max(1_000, Math.min(configuredTimeoutMs, remainingBudgetMs(deadlineAt) - 500));
  // Clamp further when the shared application deadline is closer than the slice.
  const effectiveMs = deadlineAt == null
    ? timeoutMs
    : Math.max(1_000, Math.min(timeoutMs, remainingBudgetMs(deadlineAt) - AI_RESPONSE_GUARD_MS));
  const controller = new AbortController();
  let sliceTimer: ReturnType<typeof setTimeout> | undefined;
  let clientAborted = false;
  let rejectClientAbort: ((reason: ProviderDeadlineError) => void) | undefined;
  const clientAbortPromise = new Promise<never>((_, reject) => {
    rejectClientAbort = reject;
  });
  const abortFromClient = () => {
    clientAborted = true;
    controller.abort();
    rejectClientAbort?.(deadlineError(
      'client_abort during provider transport',
      'client_abort',
      configuredTimeoutMs,
      effectiveMs,
    ));
  };
  cancellationSignal?.addEventListener('abort', abortFromClient, { once: true });
  const abort = () => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  };

  const timeoutError = () => {
    const routeOwned = deadlineAt != null && effectiveMs < configuredTimeoutMs;
    const owner: ProviderDeadlineOwner = routeOwned
      ? 'route_deadline'
      : timeoutStage === 'verifier'
        ? 'verifier_transport'
        : timeoutStage === 'translation' ? 'translation_transport' : 'provider_transport';
    return deadlineError(
      routeOwned
        ? `route_deadline_exceeded after ${effectiveMs}ms`
        : `${timeoutStage}_transport_timeout after ${effectiveMs}ms`,
      owner,
      configuredTimeoutMs,
      effectiveMs,
    );
  };

  // Race the provider call against an explicit timer. AbortSignal cancels the
  // underlying HTTP request; the race guarantees we regain control even if the
  // SDK is slow to surface the abort (build 231: wrapper rejection alone left
  // the serverless invocation open until Vercel killed it).
  const slicePromise = new Promise<never>((_, reject) => {
    sliceTimer = setTimeout(() => {
      abort();
      reject(timeoutError());
    }, effectiveMs);
  });

  const createPromise = create({
    signal: controller.signal,
    timeout: effectiveMs,
    maxRetries: 0,
  });

  try {
    return await Promise.race([createPromise, slicePromise, clientAbortPromise]);
  } catch (err) {
    // Swallow late provider completion so it cannot apply content, increment
    // usage, or keep the route awaiting an unresolved promise.
    void createPromise.then(() => undefined, () => undefined);
    if (clientAborted) {
      throw deadlineError('client_abort during provider transport', 'client_abort', configuredTimeoutMs, effectiveMs);
    }
    throw err;
  } finally {
    if (sliceTimer) clearTimeout(sliceTimer);
    cancellationSignal?.removeEventListener('abort', abortFromClient);
  }
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
  providerAborted?: boolean;
  providerFailureReason?: 'provider_attempt_timeout' | null;
  repairFailureReason?: 'repair_attempt_timeout' | null;
}

/**
 * Structured timing metadata for Vercel/server logs.
 * Never logs CV content or personal data — timestamps and stage outcomes only.
 * Enabled in development, on Vercel, or when AI_TIMING_LOGS=1.
 */
export function logAiServerRequestTiming(t: AiServerRequestTiming): void {
  if (typeof console === 'undefined' || !console.info) return;
  const onVercel = process.env.VERCEL === '1';
  const forced = process.env.AI_TIMING_LOGS === '1';
  if (process.env.NODE_ENV === 'production' && !onVercel && !forced) return;
  const providerDurationMs = t.providerStartedAt != null && t.providerFinishedAt != null
    ? t.providerFinishedAt - t.providerStartedAt
    : null;
  const repairDurationMs = t.repairStartedAt != null && t.repairFinishedAt != null
    ? t.repairFinishedAt - t.repairStartedAt
    : null;
  const fallbackDurationMs = t.fallbackStartedAt != null && t.fallbackFinishedAt != null
    ? t.fallbackFinishedAt - t.fallbackStartedAt
    : null;
  console.info([
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
    `providerAborted=${Boolean(t.providerAborted)}`,
    `providerFailureReason=${t.providerFailureReason ?? 'n/a'}`,
    `repairAttempted=${Boolean(t.repairAttempted)}`,
    `repairFailureReason=${t.repairFailureReason ?? 'n/a'}`,
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
    `budgetMs=${AI_SERVER_BUDGET_MS}`,
    `platformMaxDurationS=${AI_PLATFORM_MAX_DURATION_S}`,
  ].join('\n'));
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
