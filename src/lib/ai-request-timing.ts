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
 *  - Application response budgets remain below the platform limit with a
 *    dedicated serialization cushion.
 *  - Every provider call uses `maxRetries: 0` + AbortSignal hard-cancel so the
 *    underlying HTTP request is terminated when its slice expires.
 *  - Repair is skipped when remaining budget cannot cover another call.
 *  - Deterministic local fallback returns before the platform can kill us.
 */

import { SUMMARY_V3_STYLE_M5_ROUTE_MAX_DURATION_S } from './ai-core-v3/summary-style-m5-timeout-policy';

/** Client-side AbortController deadline for existing AI operations. */
export const AI_CLIENT_TIMEOUT_MS = 40_000;

/**
 * Summary M4 has one writer plus one independently validated evaluator under
 * its own route deadline. Keep this longer client guard local to that M4
 * button path; all existing AI operations continue to use AI_CLIENT_TIMEOUT_MS.
 */
export const SUMMARY_V3_M4_CLIENT_TIMEOUT_MS = 60_000;

/** Resolves only the Summary M4 button's single client abort deadline. */
export function resolveSummaryM4ClientAbortTimeoutMs(): number {
  return resolveClientAbortTimeoutMs(SUMMARY_V3_M4_CLIENT_TIMEOUT_MS);
}

/** Schedules one AbortController guard and returns its existing cleanup handle. */
export function scheduleClientAbort(controller: AbortController, timeoutMs: number): ReturnType<typeof setTimeout> {
  return setTimeout(() => controller.abort(), timeoutMs);
}

/** Guarantees a finite, positive AbortController delay (never 0 / NaN / negative). */
export function resolveClientAbortTimeoutMs(value: number = AI_CLIENT_TIMEOUT_MS): number {
  return Number.isFinite(value) && value >= 1_000 ? value : AI_CLIENT_TIMEOUT_MS;
}

/** Hard-coded AbortController deadline that shipped in Android build 229. */
export const AI_LEGACY_CLIENT_TIMEOUT_MS = 30_000;

/**
 * Historical conservative generic application envelope (seconds), retained
 * for non-M4 operations. The active Next route export is declared separately
 * as the required static literal in `src/app/api/generate/route.ts`.
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
 * Content-localize-v3 owns four independently bounded provider phases. Keep
 * these slices separate from the legacy/global timeout so unrelated AI
 * operations retain their shipped timing contract.
 */
export const CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS = 15_000;
export const CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS = 20_000;
export const CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS = 15_000;
export const CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS = 20_000;

export type ContentLocalizeV3ProviderPhase =
  | 'writer'
  | 'evaluator'
  | 'repair_writer'
  | 'repair_evaluator';

const CONTENT_LOCALIZE_V3_PROVIDER_TIMEOUTS: Readonly<Record<ContentLocalizeV3ProviderPhase, number>> = Object.freeze({
  writer: CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS,
  evaluator: CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS,
  repair_writer: CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS,
  repair_evaluator: CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS,
});

/** Single phase-to-timeout authority for content-localize-v3 provider calls. */
export function contentLocalizeV3ProviderTimeoutMs(phase: ContentLocalizeV3ProviderPhase): number {
  return CONTENT_LOCALIZE_V3_PROVIDER_TIMEOUTS[phase];
}

/**
 * Content-localize-v3 owns a four-phase recovery chain. Its route budget is
 * intentionally separate from the legacy 22-second envelope used by the
 * other AI operations: four phase-specific provider slices plus the response
 * guard must fit before the platform limit, while both clients share one
 * operation deadline.
 */
export const CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS = 78_000;
export const CONTENT_LOCALIZE_V3_CLIENT_TIMEOUT_MS = 84_000;
/**
 * Bounded cap for the initial Content Localize evaluator. The cap is below
 * the 41-second fast-writer safe envelope (78s route budget minus 15s repair
 * writer, 20s repair evaluator and 2s response guard), while still allowing
 * the physically proven ~30s evaluator path to finish when the writer releases
 * enough budget.
 */
export const CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS = 30_000;
export const CONTENT_LOCALIZE_V3_OTHER_REQUIRED_RESERVE_MS = 0;
export const CONTENT_LOCALIZE_V3_FOUR_PHASE_TOTAL_MS =
  CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS
  + CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS
  + CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS
  + CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS;

export function computeContentLocalizeV3Deadline(requestStartedAt: number): number {
  return requestStartedAt + CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS;
}

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
 * Experience V3 Enhance has two sequential provider stages (writer then
 * evaluator). Keep one explicit stage authority and a bounded orchestration
 * reserve so both stages can complete without approaching the platform cap.
 * The 15-second slice is the smallest rounded increase above the repeated
 * 11.5-second physical failures that still fits the existing 40-second client
 * guard when paired with the fixed six-second application reserve.
 */
export const EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS = 15_000;
export const EXPERIENCE_V3_ROUTE_OVERHEAD_MS = 6_000;
export const EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS =
  EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS * 2 + EXPERIENCE_V3_ROUTE_OVERHEAD_MS;
export const EXPERIENCE_V3_EVALUATOR_DISPATCH_SAFETY_MS = 500;
export const EXPERIENCE_V3_POST_EVALUATOR_RESERVE_MS =
  EXPERIENCE_V3_ROUTE_OVERHEAD_MS - EXPERIENCE_V3_EVALUATOR_DISPATCH_SAFETY_MS;
export const EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS =
  EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS - EXPERIENCE_V3_ROUTE_OVERHEAD_MS;
export const EXPERIENCE_V3_ENHANCE_DISPATCH_SAFETY_MS =
  EXPERIENCE_V3_EVALUATOR_DISPATCH_SAFETY_MS;
export const EXPERIENCE_V3_ENHANCE_POST_EVALUATOR_RESERVE_MS =
  EXPERIENCE_V3_POST_EVALUATOR_RESERVE_MS;
export const EXPERIENCE_V3_ENHANCE_EVALUATOR_MAX_TIMEOUT_MS =
  EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS;

/** Shared application deadline for the two-stage Experience V3 operations. */
export function computeExperienceV3Deadline(requestStartedAt: number): number {
  return requestStartedAt + EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS;
}

/** Backward-compatible name retained for existing Enhance callers and tests. */
export const computeExperienceV3EnhanceDeadline = computeExperienceV3Deadline;

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
const AI_PROVIDER_MINIMUM_TIMEOUT_MS = 1_000;

/**
 * Sole dynamic timeout owner for the initial Content Localize evaluator.
 * Remaining outer budget is reduced by the unchanged repair and response
 * reserves, then bounded by the local evaluator cap. A late writer therefore
 * releases less evaluator time, while a fast writer may release more than the
 * old fixed 20-second slice without borrowing from downstream work.
 */
export function computeContentLocalizeV3InitialEvaluatorTimeoutMs(
  deadlineAt: number,
  now = Date.now(),
): number {
  const remaining = Math.max(0, remainingBudgetMs(deadlineAt, now));
  const downstreamReserve = CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS
    + CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS
    + AI_RESPONSE_GUARD_MS
    + CONTENT_LOCALIZE_V3_OTHER_REQUIRED_RESERVE_MS;
  const available = Math.floor(remaining - downstreamReserve);
  if (available < AI_PROVIDER_MINIMUM_TIMEOUT_MS) {
    throw deadlineError(
      'route_deadline_insufficient before Content Localize evaluator dispatch',
      'route_deadline',
      CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS,
      Math.max(0, available),
      0,
      remaining,
      'route_budget',
      'evaluator',
    );
  }
  return Math.min(CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS, available);
}

export const CONTENT_LOCALIZE_V3_RESERVED_WITH_RESPONSE_GUARD_MS =
  CONTENT_LOCALIZE_V3_FOUR_PHASE_TOTAL_MS + AI_RESPONSE_GUARD_MS;
export const CONTENT_LOCALIZE_V3_ROUTE_HEADROOM_AFTER_GUARD_MS =
  CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS - CONTENT_LOCALIZE_V3_RESERVED_WITH_RESPONSE_GUARD_MS;
export const CONTENT_LOCALIZE_V3_CLIENT_HEADROOM_AFTER_ROUTE_MS =
  CONTENT_LOCALIZE_V3_CLIENT_TIMEOUT_MS - CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS;
export const CONTENT_LOCALIZE_V3_PLATFORM_HEADROOM_AFTER_CLIENT_MS =
  SUMMARY_V3_STYLE_M5_ROUTE_MAX_DURATION_S * 1000 - CONTENT_LOCALIZE_V3_CLIENT_TIMEOUT_MS;

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
export function hasProviderBudget(
  deadlineAt: number | null | undefined,
  now = Date.now(),
  configuredTimeoutMs: number = AI_PROVIDER_CALL_TIMEOUT_MS,
): boolean {
  if (deadlineAt == null) return true;
  return remainingBudgetMs(deadlineAt, now) >= Math.min(
    configuredTimeoutMs,
    AI_RESPONSE_GUARD_MS + AI_PROVIDER_MINIMUM_TIMEOUT_MS,
  );
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

/** Canonical local ownership for content-localize-v3 deadline decisions. */
export type LocalDeadlineOwner = 'provider_call' | 'route_budget' | 'none' | 'unknown';
export type LocalDeadlinePhase = 'writer' | 'evaluator' | 'repair_writer' | 'repair_evaluator' | null;

export interface LocalDeadlineProvenance {
  readonly deadlineExceeded: boolean;
  readonly deadlineOwner: LocalDeadlineOwner;
  readonly deadlinePhase: LocalDeadlinePhase;
  readonly configuredTimeoutMs: number | null;
  readonly effectiveTimeoutMs: number | null;
  readonly elapsedMs: number | null;
  readonly routeElapsedMs: number | null;
}

/** Finite, non-sensitive timing evidence attached in memory to every provider failure. */
export interface ProviderTimingEvidence {
  readonly deadlineOwner: ProviderDeadlineOwner | null;
  readonly configuredTimeoutMs: number;
  readonly effectiveTimeoutMs: number;
  readonly elapsedMs: number;
  readonly outerBudgetRemainingAtStartMs: number | null;
}

type CanonicalProviderTimingEvidence = ProviderTimingEvidence & {
  readonly localDeadline: LocalDeadlineProvenance;
};

// One in-memory authority stores both the legacy transport view and the
// canonical local deadline decision. Compatibility readers below only project
// this same record; they never create another owner or decision store.
const providerTimingEvidence = new WeakMap<object, CanonicalProviderTimingEvidence>();

function finiteTimingInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function rememberProviderTimingEvidence<T>(
  error: T,
  evidence: ProviderTimingEvidence,
  localDeadline: LocalDeadlineProvenance,
): T {
  if ((typeof error === 'object' && error !== null) || typeof error === 'function') {
    providerTimingEvidence.set(error as object, Object.freeze({
      ...evidence,
      localDeadline: Object.freeze({ ...localDeadline }),
    }));
  }
  return error;
}

/** Read timing evidence without serializing or mutating the original SDK error. */
export function readProviderTimingEvidence(error: unknown): ProviderTimingEvidence | null {
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') return null;
  const evidence = providerTimingEvidence.get(error as object);
  if (!evidence) return null;
  const { localDeadline: _localDeadline, ...legacyEvidence } = evidence;
  return legacyEvidence;
}

/**
 * Read the one canonical deadline-owner decision used by content-localize-v3.
 * This view is separate from the legacy transport timing shape so existing
 * M4/M5 consumers retain their stable serialized evidence contract.
 */
export function readLocalDeadlineProvenance(error: unknown): LocalDeadlineProvenance | null {
  if ((typeof error !== 'object' || error === null) && typeof error !== 'function') return null;
  return providerTimingEvidence.get(error as object)?.localDeadline ?? null;
}

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
  elapsedMs: number,
  outerBudgetRemainingAtStartMs: number | null,
  localOwner: LocalDeadlineOwner = 'unknown',
  localPhase: LocalDeadlinePhase = null,
): ProviderDeadlineError {
  const error = Object.assign(new Error(message), {
    name: 'AbortError',
    deadlineOwner: owner,
    configuredTimeoutMs,
    effectiveTimeoutMs,
  }) as ProviderDeadlineError;
  const localDeadline: LocalDeadlineProvenance = {
    deadlineExceeded: localOwner === 'provider_call' || localOwner === 'route_budget',
    deadlineOwner: localOwner,
    deadlinePhase: localPhase,
    configuredTimeoutMs: finiteTimingInteger(configuredTimeoutMs),
    effectiveTimeoutMs: finiteTimingInteger(effectiveTimeoutMs),
    elapsedMs: finiteTimingInteger(elapsedMs),
    routeElapsedMs: null,
  };
  return rememberProviderTimingEvidence(error, {
    deadlineOwner: owner,
    configuredTimeoutMs: finiteTimingInteger(configuredTimeoutMs),
    effectiveTimeoutMs: finiteTimingInteger(effectiveTimeoutMs),
    elapsedMs: finiteTimingInteger(elapsedMs),
    outerBudgetRemainingAtStartMs: outerBudgetRemainingAtStartMs === null
      ? null : finiteTimingInteger(outerBudgetRemainingAtStartMs),
  }, localDeadline);
}

/**
 * Gives the Experience V3 evaluator the writer's unused portion of the
 * existing 36-second route budget. The writer cap and outer deadline stay
 * unchanged, while the six-second orchestration reserve remains unavailable
 * to the provider call (5.5 seconds after evaluation plus 0.5 seconds before
 * dispatch). A late evaluator start fails before provider dispatch instead of
 * borrowing from that reserve.
 */
function computeExperienceV3EvaluatorTimeoutMsForOwner(
  deadlineAt: number,
  now: number,
  ownerLabel: string,
): number {
  const outerBudgetRemainingAtStartMs = Math.max(0, remainingBudgetMs(deadlineAt, now));
  const availableEvaluatorMs = Math.floor(
    outerBudgetRemainingAtStartMs
      - EXPERIENCE_V3_POST_EVALUATOR_RESERVE_MS
      - EXPERIENCE_V3_EVALUATOR_DISPATCH_SAFETY_MS,
  );
  if (availableEvaluatorMs < AI_PROVIDER_MINIMUM_TIMEOUT_MS) {
    throw deadlineError(
      'route_deadline_insufficient before ' + ownerLabel + ' evaluator dispatch',
      'route_deadline',
      EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS,
      Math.max(0, availableEvaluatorMs),
      0,
      outerBudgetRemainingAtStartMs,
      'route_budget',
      'evaluator',
    );
  }
  return Math.min(EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS, availableEvaluatorMs);
}

/** Shared Generate/Enhance evaluator timeout that spends only unused route slack. */
export function computeExperienceV3EvaluatorTimeoutMs(
  deadlineAt: number,
  now = Date.now(),
): number {
  return computeExperienceV3EvaluatorTimeoutMsForOwner(deadlineAt, now, 'Experience V3');
}

/** Backward-compatible Enhance name and diagnostic wording retained for callers. */
export function computeExperienceV3EnhanceEvaluatorTimeoutMs(
  deadlineAt: number,
  now = Date.now(),
): number {
  return computeExperienceV3EvaluatorTimeoutMsForOwner(deadlineAt, now, 'Experience Enhance');
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
  const callStartedAt = Date.now();
  const outerBudgetRemainingAtStartMs = deadlineAt == null
    ? null
    : Math.max(0, remainingBudgetMs(deadlineAt, callStartedAt));
  const elapsedMs = () => Math.max(0, Date.now() - callStartedAt);
  if (cancellationSignal?.aborted) {
    throw deadlineError('client_abort before provider dispatch', 'client_abort', configuredTimeoutMs, 0,
      elapsedMs(), outerBudgetRemainingAtStartMs, 'unknown');
  }
  if (!hasProviderBudget(deadlineAt, callStartedAt, configuredTimeoutMs)) {
    throw deadlineError(
      'route_deadline_insufficient before provider dispatch',
      'route_deadline',
      configuredTimeoutMs,
      Math.max(0, deadlineAt == null ? 0 : remainingBudgetMs(deadlineAt)),
      elapsedMs(),
      outerBudgetRemainingAtStartMs,
      'route_budget',
    );
  }

  const timeoutMs = deadlineAt == null
    ? configuredTimeoutMs
    : Math.max(
      AI_PROVIDER_MINIMUM_TIMEOUT_MS,
      Math.min(configuredTimeoutMs, remainingBudgetMs(deadlineAt) - 500),
    );
  // Clamp further when the shared application deadline is closer than the slice.
  const effectiveMs = deadlineAt == null
    ? timeoutMs
    : Math.max(
      AI_PROVIDER_MINIMUM_TIMEOUT_MS,
      Math.min(timeoutMs, remainingBudgetMs(deadlineAt) - AI_RESPONSE_GUARD_MS),
    );
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
      elapsedMs(),
      outerBudgetRemainingAtStartMs,
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
      elapsedMs(),
      outerBudgetRemainingAtStartMs,
      routeOwned ? 'route_budget' : 'provider_call',
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
      throw deadlineError('client_abort during provider transport', 'client_abort', configuredTimeoutMs, effectiveMs,
        elapsedMs(), outerBudgetRemainingAtStartMs, 'unknown');
    }
    const existing = readProviderTimingEvidence(err);
    if (existing) throw err;
    if ((typeof err === 'object' && err !== null) || typeof err === 'function') {
      const localDeadline: LocalDeadlineProvenance = {
        deadlineExceeded: false,
        deadlineOwner: 'unknown',
        deadlinePhase: null,
        configuredTimeoutMs: finiteTimingInteger(configuredTimeoutMs),
        effectiveTimeoutMs: finiteTimingInteger(effectiveMs),
        elapsedMs: finiteTimingInteger(elapsedMs()),
        routeElapsedMs: null,
      };
      throw rememberProviderTimingEvidence(err, {
        deadlineOwner: null,
        configuredTimeoutMs: finiteTimingInteger(configuredTimeoutMs),
        effectiveTimeoutMs: finiteTimingInteger(effectiveMs),
        elapsedMs: finiteTimingInteger(elapsedMs()),
        outerBudgetRemainingAtStartMs: outerBudgetRemainingAtStartMs === null
          ? null : finiteTimingInteger(outerBudgetRemainingAtStartMs),
      }, localDeadline);
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
