import { describe, expect, it, vi } from 'vitest';
import type {
  SummaryV3GenerateFailureResponse,
  SummaryV3ProviderFailureEnvelope,
} from '../summary-generate';
import {
  createSummaryV3TerminalDiagnostic,
  emitSummaryV3TerminalDiagnostic,
} from '../summary-v3-production-observability';

function providerFailure(
  overrides: Partial<SummaryV3ProviderFailureEnvelope> = {},
): SummaryV3ProviderFailureEnvelope {
  return {
    phase: 'initial_writer',
    failureStage: 'sdk_request',
    errorClass: 'Error',
    providerHttpStatus: null,
    providerErrorType: 'timeout',
    providerErrorCode: null,
    providerRequestIdHash: null,
    providerRetryable: false,
    providerMessageFingerprint: null,
    providerStructuralFieldPath: null,
    providerHttpResponseReceived: null,
    providerDeadlineOwner: 'provider_transport',
    providerConfiguredTimeoutMs: 13_000,
    providerEffectiveTimeoutMs: 13_000,
    providerElapsedMs: 13_000,
    providerOuterBudgetRemainingAtStartMs: 37_000,
    ...overrides,
  };
}

function failure(
  typedReason: string,
  overrides: Partial<SummaryV3GenerateFailureResponse> = {},
): SummaryV3GenerateFailureResponse {
  return {
    ok: false,
    action: 'summary_v3_generate',
    typedReason,
    ...overrides,
  };
}

describe('Summary V3 production terminal observability', () => {
  it('emits exactly one structured terminal event for a typed 502 without changing its source response', () => {
    const source = failure('provider_request_failed', {
      repairAttempted: false,
      m4ProviderFailure: providerFailure(),
    });
    const before = JSON.stringify(source);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const event = emitSummaryV3TerminalDiagnostic({
      requestId: 'iad1::safe-request-id',
      httpStatus: 502,
      elapsedMs: 13_028,
      result: source,
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(JSON.stringify(event));
    expect(event).toMatchObject({
      event: 'summary_v3_terminal', requestId: 'iad1::safe-request-id',
      action: 'summary_v3_generate', httpStatus: 502, phase: 'initial_writer',
      typedFailureCode: 'provider_request_failed', failureFamily: 'provider_transport',
      timeoutPhase: 'initial_writer', transportTerminationKind: 'application_slice_timeout',
      finalizerReached: false, usageCommitted: false,
    });
    expect(JSON.stringify(source)).toBe(before);
    info.mockRestore();
  });

  it('keeps primary and repair semantic rejection as distinct typed 422 phases', () => {
    const primary = createSummaryV3TerminalDiagnostic({
      requestId: 'primary-reject', httpStatus: 422, elapsedMs: 40,
      result: failure('validation_rejected', { repairAttempted: false }),
    });
    const repair = createSummaryV3TerminalDiagnostic({
      requestId: 'repair-reject', httpStatus: 422, elapsedMs: 80,
      result: failure('repair_validation_rejected', { repairAttempted: true }),
    });

    expect(primary).toMatchObject({
      httpStatus: 422, phase: 'primary_validation', typedFailureCode: 'validation_rejected',
      failureFamily: 'semantic_validation', validationRejected: true,
      repairValidationRejected: false, providerAttemptCount: 2,
    });
    expect(repair).toMatchObject({
      httpStatus: 422, phase: 'repair_validation', typedFailureCode: 'repair_validation_rejected',
      failureFamily: 'semantic_validation', validationRejected: true,
      repairValidationRejected: true, providerAttemptCount: 4,
    });
  });

  it('uses the typed timeout classification and never guesses from elapsed time', () => {
    const slowRateLimit = createSummaryV3TerminalDiagnostic({
      requestId: 'slow-rate-limit', httpStatus: 502, elapsedMs: 99_999,
      result: failure('provider_request_failed', {
        m4ProviderFailure: providerFailure({
          providerErrorType: 'rate_limit', providerDeadlineOwner: null,
          providerHttpStatus: 429, providerHttpResponseReceived: true,
        }),
      }),
    });
    const typedTimeout = createSummaryV3TerminalDiagnostic({
      requestId: 'fast-typed-timeout', httpStatus: 502, elapsedMs: 1,
      result: failure('validator_exception', {
        m4ProviderFailure: providerFailure({ phase: 'initial_evaluator', providerErrorType: 'timeout' }),
      }),
    });

    expect(slowRateLimit.timeoutPhase).toBeNull();
    expect(slowRateLimit.transportTerminationKind).toBe('provider_http_error');
    expect(typedTimeout.timeoutPhase).toBe('initial_evaluator');
    expect(typedTimeout.transportTerminationKind).toBe('application_slice_timeout');
  });

  it('projects a fixed allowlist and cannot serialize CV, provider, auth, or secret material', () => {
    const unsafeRuntimeObject = {
      ...failure('writer_tool_missing', {
        m4ProviderFailure: providerFailure({
          failureStage: 'tool_validation', providerErrorType: null,
          providerErrorCode: 'top_level_keys', providerHttpResponseReceived: true,
        }),
      }),
      candidate: 'PRIVATE CV CANDIDATE',
      source: 'PRIVATE EXPERIENCE SOURCE',
      providerRawOutput: 'PRIVATE PROVIDER OUTPUT',
      prompt: 'PRIVATE PROMPT',
      proToken: 'PRIVATE PRO TOKEN',
      revenueCatUserId: 'PRIVATE REVENUECAT ID',
      authorization: 'PRIVATE AUTH HEADER',
      apiKey: 'PRIVATE API KEY',
    } as unknown as SummaryV3GenerateFailureResponse;
    const event = createSummaryV3TerminalDiagnostic({
      requestId: 'bad id with spaces and private@example.com',
      httpStatus: 502,
      elapsedMs: 10,
      result: unsafeRuntimeObject,
    });
    const serialized = JSON.stringify(event);

    expect(event.requestId).toBeNull();
    expect(event.outputContractFailureClass).toBe('top_level_keys');
    expect(event.transportTerminationKind).toBe('unknown');
    for (const forbidden of [
      'PRIVATE CV CANDIDATE', 'PRIVATE EXPERIENCE SOURCE', 'PRIVATE PROVIDER OUTPUT',
      'PRIVATE PROMPT', 'PRIVATE PRO TOKEN', 'PRIVATE REVENUECAT ID',
      'PRIVATE AUTH HEADER', 'PRIVATE API KEY', 'private@example.com',
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('keeps unknown provider dispatch counts nullable instead of fabricating attempts', () => {
    const sdkFailure = createSummaryV3TerminalDiagnostic({
      requestId: 'attempt-unknown', httpStatus: 502, elapsedMs: 100,
      result: failure('provider_request_failed', {
        m4ProviderFailure: providerFailure({ failureStage: 'sdk_request' }),
      }),
    });
    const outputFailure = createSummaryV3TerminalDiagnostic({
      requestId: 'attempt-known', httpStatus: 502, elapsedMs: 100,
      result: failure('writer_tool_missing', {
        m4ProviderFailure: providerFailure({
          failureStage: 'tool_validation', providerErrorType: null,
          providerHttpResponseReceived: true,
        }),
      }),
    });

    expect(sdkFailure.providerAttemptCount).toBeNull();
    expect(sdkFailure.providerReached).toBeNull();
    expect(sdkFailure.providerResponseReceived).toBeNull();
    expect(outputFailure.providerAttemptCount).toBe(1);
    expect(outputFailure.providerReached).toBe(true);
  });
});
