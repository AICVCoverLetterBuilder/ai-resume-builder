/**
 * Shared client helpers for CV / Cover Letter AI request handling.
 */
import {
  classifyAiFailure,
  createAiRequestId,
  getAiCircuitState,
  isAiCircuitOpen,
  logAiDiagnostics,
  logProAiUsageDiagnostics,
  noteAiRequestFailure,
  noteAiRequestSuccess,
  parseRetryAfterSeconds,
  toastMessageForAiError,
  type AiRequestDiagnostics,
} from './ai-usage-policy';
import type { AiErrorPayload } from './ai-error-codes';
import type { Locale } from './i18n/translations';

export function beginAiClientRequest(operation: string, locale: string): {
  requestId: string;
  startedAt: number;
  operation: string;
  locale: string;
} {
  return {
    requestId: createAiRequestId(),
    startedAt: Date.now(),
    operation,
    locale,
  };
}

export function precheckAiCircuit(_locale: Locale | string): AiErrorPayload | null {
  if (!isAiCircuitOpen()) return null;
  const circuit = getAiCircuitState();
  const retryAfterSec = Math.max(1, Math.ceil((circuit.openUntil - Date.now()) / 1000));
  return {
    code: 'circuit_breaker_open',
    httpStatus: 429,
    retryAfterSec,
  };
}

export function resolveAiHttpFailure(opts: {
  response: Response | null;
  body?: { error?: string; code?: string; retryAfter?: number } | null;
  error?: unknown;
}): AiErrorPayload {
  const retryAfterSec = parseRetryAfterSeconds(opts.response) ??
    (typeof opts.body?.retryAfter === 'number' ? opts.body.retryAfter : null);
  return classifyAiFailure({
    httpStatus: opts.response?.status ?? null,
    body: opts.body,
    retryAfterSec,
    error: opts.error,
  });
}

export function finishAiClientRequest(opts: {
  ctx: { requestId: string; operation: string; locale: string };
  isProVerified: boolean;
  countBefore: number | null;
  countAfter: number | null;
  httpStatus: number | null;
  error: AiErrorPayload | null;
  automaticRepairCount?: number;
  fallbackUsed?: boolean;
  responseSource?: AiRequestDiagnostics['responseSource'];
  limiterKeyType?: AiRequestDiagnostics['limiterKeyType'];
}): string | null {
  const circuit = getAiCircuitState();
  const diag: AiRequestDiagnostics = {
    requestId: opts.ctx.requestId,
    timestamp: Date.now(),
    operation: opts.ctx.operation,
    requestedLocale: opts.ctx.locale,
    httpStatus: opts.httpStatus,
    applicationErrorCode: opts.error?.code ?? null,
    providerStatus: opts.error?.providerStatus ?? null,
    retryAfterSec: opts.error?.retryAfterSec ?? null,
    isProVerified: opts.isProVerified,
    usageBucket: opts.isProVerified ? 'pro_safety' : 'free',
    countBefore: opts.countBefore,
    countAfter: opts.countAfter,
    limiterKeyType: opts.limiterKeyType ?? (opts.error?.code === 'circuit_breaker_open' ? 'client_circuit' : 'client_usage'),
    circuitOpen: circuit.openUntil > Date.now(),
    cooldownExpiry: circuit.openUntil > Date.now() ? circuit.openUntil : null,
    automaticRepairCount: opts.automaticRepairCount ?? 0,
    fallbackUsed: opts.fallbackUsed ?? false,
    responseSource: opts.responseSource ?? (opts.error ? 'blocked' : 'provider'),
  };
  logAiDiagnostics(diag);
  logProAiUsageDiagnostics({
    before: opts.countBefore,
    after: opts.countAfter,
    action: opts.ctx.operation,
    origin: diag.responseSource,
    applied: !opts.error,
    requestId: opts.ctx.requestId,
    reason: opts.error?.code ?? null,
  });

  if (opts.error) {
    noteAiRequestFailure(opts.error);
    return toastMessageForAiError(opts.error, opts.ctx.locale);
  }
  noteAiRequestSuccess();
  return null;
}
