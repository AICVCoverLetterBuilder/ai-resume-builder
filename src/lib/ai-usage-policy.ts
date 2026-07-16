/**
 * Authoritative Pro AI usage + transient failure state machine.
 *
 * - Pro safety cap: 50 successful *user-visible AI actions* per 30-day window
 *   (localStorage `cvpro-ai-usage`). Public Pro UI remains “Unlimited”; this is
 *   internal abuse protection only.
 * - Boundary: counts 0–49 allow; after the 50th success count=50 and further
 *   actions are blocked until the rolling window expires.
 * - Schema v2 migrates build-223 `{ count, windowStart }` (limit 20) in place:
 *   preserve count + windowStart, raise policyLimit to 50, recompute blocked.
 * - Only real AI API successes count (summary / rewrite / bullets / cover-letter).
 * - Local Job Analyzer / template recommend must NOT increment this counter.
 * - Repair / fallback / automatic retries must NOT count as extra user actions.
 * - Circuit breaker is transient (sessionStorage) with real expiry — never permanent.
 */
import type { AiErrorCode, AiErrorPayload } from './ai-error-codes';
import { aiErrorMessage } from './ai-error-codes';
import type { Locale } from './i18n/translations';

/** Authoritative hidden Pro safety cap (abuse protection; public UI says Unlimited). */
export const PRO_AI_SAFETY_CAP = 50;
/** Legacy build-223 (and earlier) client cap — used only for migration detection. */
export const PRO_AI_LEGACY_SAFETY_CAP = 20;
export const PRO_AI_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const AI_USAGE_STORAGE_KEY = 'cvpro-ai-usage';
export const AI_CIRCUIT_STORAGE_KEY = 'cvpro-ai-circuit';
/** Persisted usage-policy schema version (build-223 was unversioned / implicit v1). */
export const AI_USAGE_SCHEMA_VERSION = 2;

/** Default cooldown when provider/server signals unavailability without Retry-After. */
export const AI_CIRCUIT_DEFAULT_COOLDOWN_MS = 60_000;
export const AI_CIRCUIT_MAX_COOLDOWN_MS = 5 * 60_000;

/** Actions that consume one Pro safety-cap unit on successful user-visible completion. */
export const PRO_AI_COUNTED_ACTIONS = [
  'summary',
  'rewrite',
  'bullets',
  'cover-letter-gen',
  'cover-letter-regen',
  'cover-letter',
] as const;

export type ProAiCountedAction = (typeof PRO_AI_COUNTED_ACTIONS)[number];

export interface ProAiRecord {
  count: number;
  windowStart: number;
  schemaVersion?: number;
  policyLimit?: number;
}

interface PersistedProAiRecord {
  schemaVersion?: number;
  count?: number;
  windowStart?: number;
  windowStartedAt?: number | string;
  policyLimit?: number;
  /** Legacy aliases / accidental fields — ignored for blocking after migration. */
  blocked?: boolean;
  limitReached?: boolean;
  oldLimit?: number;
}

export interface AiCircuitState {
  openUntil: number;
  failureCount: number;
  lastCode: AiErrorCode | null;
}

export interface AiRequestDiagnostics {
  requestId: string;
  timestamp: number;
  operation: string;
  requestedLocale: string;
  httpStatus: number | null;
  applicationErrorCode: AiErrorCode | null;
  providerStatus: number | string | null;
  retryAfterSec: number | null;
  isProVerified: boolean;
  usageBucket: 'pro_safety' | 'free' | 'none';
  countBefore: number | null;
  countAfter: number | null;
  limiterKeyType: 'pro_token_hash' | 'ip' | 'none' | 'client_usage' | 'client_circuit';
  circuitOpen: boolean;
  cooldownExpiry: number | null;
  automaticRepairCount: number;
  fallbackUsed: boolean;
  responseSource: 'provider' | 'repair' | 'deterministic_fallback' | 'blocked' | 'n/a';
}

export function createAiRequestId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `ai_${Date.now().toString(36)}_${rand}`;
}

function resolveWindowStart(raw: PersistedProAiRecord, now: number): number | null {
  if (typeof raw.windowStart === 'number' && Number.isFinite(raw.windowStart)) {
    return raw.windowStart;
  }
  if (typeof raw.windowStartedAt === 'number' && Number.isFinite(raw.windowStartedAt)) {
    return raw.windowStartedAt;
  }
  if (typeof raw.windowStartedAt === 'string') {
    const parsed = Date.parse(raw.windowStartedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * Normalize + migrate any persisted build-223 / legacy usage blob to schema v2.
 * Preserves count and original window start; raises policyLimit to 50.
 * Does not reset usage. Blocked state is never persisted — always recomputed.
 */
export function migrateProAiRecord(
  raw: PersistedProAiRecord | null | undefined,
  now = Date.now(),
): ProAiRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      schemaVersion: AI_USAGE_SCHEMA_VERSION,
      count: 0,
      windowStart: now,
      policyLimit: PRO_AI_SAFETY_CAP,
    };
  }

  const windowStart = resolveWindowStart(raw, now) ?? now;
  const count = typeof raw.count === 'number' && Number.isFinite(raw.count)
    ? Math.max(0, Math.floor(raw.count))
    : 0;

  if (now - windowStart >= PRO_AI_WINDOW_MS) {
    return {
      schemaVersion: AI_USAGE_SCHEMA_VERSION,
      count: 0,
      windowStart: now,
      policyLimit: PRO_AI_SAFETY_CAP,
    };
  }

  return {
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart,
    policyLimit: PRO_AI_SAFETY_CAP,
  };
}

function needsPersistUpgrade(raw: PersistedProAiRecord | null, migrated: ProAiRecord): boolean {
  if (!raw) return true;
  if (raw.schemaVersion !== AI_USAGE_SCHEMA_VERSION) return true;
  if (raw.policyLimit !== PRO_AI_SAFETY_CAP) return true;
  if (typeof raw.blocked === 'boolean' || typeof raw.limitReached === 'boolean') return true;
  if (raw.count !== migrated.count || raw.windowStart !== migrated.windowStart) return true;
  return false;
}

export function loadProAiRecord(now = Date.now()): ProAiRecord {
  if (typeof window === 'undefined') {
    return {
      schemaVersion: AI_USAGE_SCHEMA_VERSION,
      count: 0,
      windowStart: now,
      policyLimit: PRO_AI_SAFETY_CAP,
    };
  }
  try {
    const stored = localStorage.getItem(AI_USAGE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PersistedProAiRecord;
      const migrated = migrateProAiRecord(parsed, now);
      if (needsPersistUpgrade(parsed, migrated)) {
        persistProAiRecord(migrated);
      }
      return migrated;
    }
  } catch {
    /* ignore */
  }
  return {
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count: 0,
    windowStart: now,
    policyLimit: PRO_AI_SAFETY_CAP,
  };
}

export function persistProAiRecord(record: ProAiRecord): void {
  if (typeof window === 'undefined') return;
  const toStore: ProAiRecord = {
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count: Math.max(0, record.count),
    windowStart: record.windowStart,
    policyLimit: PRO_AI_SAFETY_CAP,
  };
  localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify(toStore));
}

export function getProAiUsageCount(now = Date.now()): number {
  return loadProAiRecord(now).count;
}

export function isProAiSafetyBlocked(record: ProAiRecord, now = Date.now()): boolean {
  if (now - record.windowStart >= PRO_AI_WINDOW_MS) return false;
  const limit = record.policyLimit ?? PRO_AI_SAFETY_CAP;
  return record.count >= limit;
}

export function canUseProAiSafety(isProReady: boolean, record?: ProAiRecord, now = Date.now()): boolean {
  if (!isProReady) return false;
  const fresh = record ?? loadProAiRecord(now);
  if (now - fresh.windowStart >= PRO_AI_WINDOW_MS) return true;
  return !isProAiSafetyBlocked(fresh, now);
}

export function recordProAiUserActionSuccess(
  prev?: ProAiRecord,
  now = Date.now(),
): ProAiRecord {
  const base = prev ?? loadProAiRecord(now);
  const windowBase =
    now - base.windowStart >= PRO_AI_WINDOW_MS
      ? {
          schemaVersion: AI_USAGE_SCHEMA_VERSION,
          count: 0,
          windowStart: now,
          policyLimit: PRO_AI_SAFETY_CAP,
        }
      : {
          schemaVersion: AI_USAGE_SCHEMA_VERSION,
          count: base.count,
          windowStart: base.windowStart,
          policyLimit: PRO_AI_SAFETY_CAP,
        };
  const updated: ProAiRecord = {
    ...windowBase,
    count: windowBase.count + 1,
  };
  persistProAiRecord(updated);
  return updated;
}

function readCircuitRaw(): AiCircuitState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AI_CIRCUIT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiCircuitState;
    if (typeof parsed.openUntil !== 'number') return null;
    return {
      openUntil: parsed.openUntil,
      failureCount: typeof parsed.failureCount === 'number' ? parsed.failureCount : 0,
      lastCode: parsed.lastCode ?? null,
    };
  } catch {
    return null;
  }
}

function writeCircuit(state: AiCircuitState | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!state || state.openUntil <= Date.now()) {
      sessionStorage.removeItem(AI_CIRCUIT_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(AI_CIRCUIT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Returns open circuit only while cooldown has not expired. */
export function getAiCircuitState(now = Date.now()): AiCircuitState {
  const stored = readCircuitRaw();
  if (!stored || stored.openUntil <= now) {
    if (stored && stored.openUntil <= now) writeCircuit(null);
    return { openUntil: 0, failureCount: 0, lastCode: null };
  }
  return stored;
}

export function isAiCircuitOpen(now = Date.now()): boolean {
  return getAiCircuitState(now).openUntil > now;
}

export function clearAiCircuit(): void {
  writeCircuit(null);
}

export function openAiCircuit(
  code: AiErrorCode,
  retryAfterSec?: number | null,
  now = Date.now(),
): AiCircuitState {
  const prev = getAiCircuitState(now);
  const fromHeader = retryAfterSec != null && retryAfterSec > 0
    ? Math.min(AI_CIRCUIT_MAX_COOLDOWN_MS, retryAfterSec * 1000)
    : AI_CIRCUIT_DEFAULT_COOLDOWN_MS;
  // Bounded growth with jitter — never permanent.
  const backoff = Math.min(
    AI_CIRCUIT_MAX_COOLDOWN_MS,
    fromHeader * Math.min(4, 1 + prev.failureCount * 0.5),
  );
  const jitter = Math.floor(Math.random() * 500);
  const state: AiCircuitState = {
    openUntil: now + backoff + jitter,
    failureCount: prev.failureCount + 1,
    lastCode: code,
  };
  writeCircuit(state);
  return state;
}

/** Successful AI request resets transient failure / circuit state. */
export function noteAiRequestSuccess(): void {
  clearAiCircuit();
}

export function parseRetryAfterSeconds(res: Response | null | undefined): number | null {
  if (!res) return null;
  const raw = res.headers.get('Retry-After');
  if (!raw) return null;
  const asInt = parseInt(raw, 10);
  if (!Number.isNaN(asInt) && asInt >= 0) return asInt;
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  return null;
}

export interface ClassifyAiFailureInput {
  httpStatus?: number | null;
  body?: { error?: string; code?: string; retryAfter?: number } | null;
  retryAfterSec?: number | null;
  error?: unknown;
  circuitOpen?: boolean;
  circuitRetrySec?: number | null;
}

export function classifyAiFailure(input: ClassifyAiFailureInput): AiErrorPayload {
  if (input.circuitOpen) {
    return {
      code: 'circuit_breaker_open',
      httpStatus: 429,
      retryAfterSec: input.circuitRetrySec ?? 30,
    };
  }

  const status = input.httpStatus ?? null;
  const bodyCode = typeof input.body?.code === 'string' ? input.body.code : null;
  const msg = `${input.body?.error ?? ''} ${input.error instanceof Error ? input.error.message : String(input.error ?? '')}`.toLowerCase();
  const retryAfter =
    input.retryAfterSec ??
    (typeof input.body?.retryAfter === 'number' ? input.body.retryAfter : null);

  if (bodyCode && (AI_ERROR_CODE_SET as Set<string>).has(bodyCode)) {
    return {
      code: bodyCode as AiErrorCode,
      httpStatus: status ?? undefined,
      retryAfterSec: retryAfter,
      message: input.body?.error,
      providerStatus: status,
    };
  }

  if (status === 403) {
    if (msg.includes('pro access') || msg.includes('free')) {
      return { code: 'free_ai_limit_reached', httpStatus: 403, retryAfterSec: null };
    }
    return { code: 'invalid_pro_token', httpStatus: 403, retryAfterSec: null };
  }

  if (status === 429) {
    if (msg.includes('provider') || bodyCode === 'provider_rate_limited') {
      return { code: 'provider_rate_limited', httpStatus: 429, retryAfterSec: retryAfter ?? 60, providerStatus: 429 };
    }
    return { code: 'server_rate_limited', httpStatus: 429, retryAfterSec: retryAfter ?? 60 };
  }

  if (status === 401 || msg.includes('authentication') || msg.includes('invalid api key') || msg.includes('unauthorized')) {
    return { code: 'provider_auth_error', httpStatus: status ?? 401, providerStatus: status };
  }

  if (msg.includes('credit') || msg.includes('billing') || msg.includes('quota') || status === 402) {
    return { code: 'provider_credit_exhausted', httpStatus: status ?? 402, providerStatus: status };
  }

  if (status === 529 || status === 503 || status === 502) {
    return {
      code: 'provider_temporarily_unavailable',
      httpStatus: status,
      providerStatus: status,
      retryAfterSec: retryAfter ?? 60,
    };
  }

  if (status === 422) {
    return { code: 'generation_validation_failed', httpStatus: 422 };
  }

  const errName = input.error instanceof Error ? input.error.name : '';
  if (errName === 'AbortError' || msg.includes('timeout') || msg.includes('aborted')) {
    return { code: 'request_timeout', httpStatus: status ?? undefined };
  }

  if (msg.includes('failed to fetch') || msg.includes('network') || errName === 'TypeError') {
    return { code: 'network_error', httpStatus: status ?? undefined };
  }

  if (status && status >= 500) {
    return {
      code: 'provider_temporarily_unavailable',
      httpStatus: status,
      providerStatus: status,
      retryAfterSec: retryAfter ?? 60,
    };
  }

  return {
    code: 'provider_temporarily_unavailable',
    httpStatus: status ?? undefined,
    retryAfterSec: retryAfter,
  };
}

const AI_ERROR_CODE_SET = new Set<string>([
  'free_ai_limit_reached',
  'pro_safety_limit_reached',
  'client_rate_limited',
  'server_rate_limited',
  'provider_rate_limited',
  'provider_temporarily_unavailable',
  'provider_auth_error',
  'provider_credit_exhausted',
  'network_error',
  'request_timeout',
  'invalid_pro_token',
  'circuit_breaker_open',
  'generation_validation_failed',
]);

/** Apply failure side-effects: open circuit for transient provider/server limits. */
export function noteAiRequestFailure(payload: AiErrorPayload): void {
  const transient: AiErrorCode[] = [
    'server_rate_limited',
    'provider_rate_limited',
    'provider_temporarily_unavailable',
    'client_rate_limited',
  ];
  if (transient.includes(payload.code)) {
    openAiCircuit(payload.code, payload.retryAfterSec);
  }
}

export function toastMessageForAiError(
  payload: AiErrorPayload,
  locale: Locale | string,
): string {
  return aiErrorMessage(payload.code, locale, payload.retryAfterSec);
}

/**
 * Development/test-only trace of the Pro AI safety-cap counter around a single
 * user-facing action. Never runs in production (no internal cap value, request
 * shape, or CV text is ever exposed to end users) and never logs CV content —
 * only the numeric before/after count, the action name, the content origin,
 * whether the action actually applied a visible result, and (when rejected)
 * the reason. Intended to answer "did this button press increment the Pro
 * usage counter, and why/why not" during investigation, e.g.:
 *   PRO_AI_USAGE before=47 after=48 action=summary_stronger origin=ai_repaired applied=true requestId=...
 *   PRO_AI_USAGE before=47 after=47 action=summary_generate origin=none applied=false reason=locale_validation_failed
 */
export function logProAiUsageDiagnostics(input: {
  before: number | null;
  after: number | null;
  action: string;
  origin?: string | null;
  applied: boolean;
  requestId?: string | null;
  reason?: string | null;
}): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof console === 'undefined' || !console.debug) return;
  const parts = [
    `PRO_AI_USAGE before=${input.before ?? 'n/a'}`,
    `after=${input.after ?? 'n/a'}`,
    `action=${input.action}`,
    `origin=${input.origin ?? 'none'}`,
    `applied=${input.applied}`,
  ];
  if (input.requestId) parts.push(`requestId=${input.requestId}`);
  if (!input.applied && input.reason) parts.push(`reason=${input.reason}`);
  console.debug(parts.join(' '));
}

/**
 * Dev/test-only trace of a single AI action's locale values from button-press
 * through final apply. Used to diagnose "first request after a language
 * switch" style regressions without ever logging CV text or PII.
 * Disabled/no-op in production.
 */
export function logAiLocaleTransitionDiagnostics(input: {
  requestId: string;
  action: string;
  /** Live UI locale re-read at the moment the outcome is logged (may differ from requestedLocale if the user switched again mid-flight). */
  uiLocale: string;
  /** Immutable locale captured at button-press time — used for the whole request lifecycle. */
  requestedLocale: string;
  /** Best-available locale of the content that was active before this request (e.g. canonicalSnapshot.canonicalLocale). */
  previousContentLocale?: string | null;
  /** Locale actually sent to /api/generate. */
  apiLocale: string;
  /** Locale used for the final client-side validation/guard decision. */
  finalValidationLocale: string;
  applied: boolean;
  newContentLocale?: string | null;
  reason?: string | null;
}): void {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof console === 'undefined' || !console.debug) return;
  const lines = [
    'AI_LOCALE_REQUEST',
    `requestId=${input.requestId}`,
    `action=${input.action}`,
    `uiLocale=${input.uiLocale}`,
    `requestedLocale=${input.requestedLocale}`,
    `previousContentLocale=${input.previousContentLocale ?? 'n/a'}`,
    `apiLocale=${input.apiLocale}`,
    `finalValidationLocale=${input.finalValidationLocale}`,
    `applied=${input.applied}`,
  ];
  if (input.applied) lines.push(`newContentLocale=${input.newContentLocale ?? 'n/a'}`);
  else if (input.reason) lines.push(`reason=${input.reason}`);
  console.debug(lines.join('\n'));
}

export function logAiDiagnostics(diag: AiRequestDiagnostics): void {
  // Safe structured log — no CV text, emails, tokens, or API keys.
  const safe = {
    ...diag,
    // Explicitly omit any accidental sensitive fields
  };
  if (typeof console !== 'undefined' && console.info) {
    console.info('[ai-diagnostics]', JSON.stringify(safe));
  }
}

/** Clear only transient session circuit (Android lifecycle: clear session, keep usage). */
export function clearTransientAiSessionState(): void {
  clearAiCircuit();
}

/** Simulate reinstall: wipe usage + circuit (test helper). */
export function simulateReinstallAiState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AI_USAGE_STORAGE_KEY);
    sessionStorage.removeItem(AI_CIRCUIT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
