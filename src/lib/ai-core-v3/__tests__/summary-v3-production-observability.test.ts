import { describe, expect, it, vi } from 'vitest';
import type {
  SummaryV3GenerateFailureResponse,
  SummaryV3ProviderFailureEnvelope,
} from '../summary-generate';
import type {
  SummaryV3StyleEvidence,
  SummaryV3StyleFailureReason,
  SummaryV3StyleResult,
} from '../summary-style-m5';
import { createSummaryV3StyleM5RouteFailure } from '../summary-style-m5-transport';
import {
  createSummaryV3TerminalDiagnostic,
  emitSummaryV3TerminalDiagnostic,
  createSummaryStrongerTerminalDiagnostic,
  emitSummaryStrongerTerminalDiagnostic,
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

function styleEvidence(overrides: Partial<SummaryV3StyleEvidence> = {}): SummaryV3StyleEvidence {
  return {
    writerAttempts: 0,
    evaluatorAttempts: 0,
    repairWriterAttempts: 0,
    repairEvaluatorAttempts: 0,
    phaseStatuses: {
      structural: 'not_evaluated',
      semantic_grounding: 'not_evaluated',
      language_native_quality: 'not_evaluated',
      style_fulfillment: 'not_evaluated',
    },
    candidateHash: null,
    candidateNormalizedLength: null,
    candidateUnitCount: null,
    candidateClauseCount: null,
    requiredFactCount: 0,
    coveredFactCount: 0,
    missingFactCount: 0,
    unsupportedClaimCount: 0,
    styleFulfilled: null,
    styleEvidence: null,
    meaningfulChangeDetected: false,
    noOpDetected: false,
    unsupportedClaimCategory: null,
    sourceFloorMismatchClass: null,
    employmentStateContradictionClass: null,
    employmentOppositeFrameDetected: false,
    evaluatorNoOpClaimed: false,
    writerOutputContractFailureClass: null,
    evaluatorOutputContractFailureClass: null,
    writerCandidateReachedValidation: false,
    evaluatorReached: false,
    safeNoOpConsidered: false,
    safeNoOpSelected: false,
    safeNoOpEligibilityReason: 'not_applicable',
    roleIdentityResolution: 'not_required',
    m5ProviderFailure: null,
    sourceSummaryHash: 'source-hash-not-emitted',
    manifestHash: 'manifest-hash-not-emitted',
    snapshotHash: 'snapshot-hash-not-emitted',
    retries: 0,
    fallbacks: 0,
    v2Fallthrough: 0,
    ...overrides,
  } as SummaryV3StyleEvidence;
}

function styleFailure(
  typedReason: SummaryV3StyleFailureReason,
  evidence: Partial<SummaryV3StyleEvidence> = {},
): SummaryV3StyleResult {
  return {
    kind: 'handled_failure',
    style: 'stronger',
    mode: 'enhance_existing_content',
    typedReason,
    evidence: styleEvidence(evidence),
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

  it('projects every decisive Stronger branch with finite layer/reason and unchanged result', () => {
    const cases: Array<{
      result: SummaryV3StyleResult;
      layer: string;
      reason: string;
      writerResult: string;
      usageDecision: string;
    }> = [
      {
        result: styleFailure('candidate_malformed', { writerAttempts: 1 }),
        layer: 'writer_output', reason: 'candidate_malformed', writerResult: 'rejected', usageDecision: 'no_increment',
      },
      {
        result: styleFailure('lost_source_fact', { writerAttempts: 1 }),
        layer: 'writer_output', reason: 'lost_source_fact', writerResult: 'rejected', usageDecision: 'no_increment',
      },
      {
        result: styleFailure('unsupported_claim', { writerAttempts: 1 }),
        layer: 'writer_output', reason: 'unsupported_claim', writerResult: 'rejected', usageDecision: 'no_increment',
      },
      {
        result: styleFailure('writer_transport_malformed', {
          writerAttempts: 1,
          m5ProviderFailure: providerFailure({ failureStage: 'tool_validation', providerErrorType: null }),
        }),
        layer: 'provider_transport', reason: 'writer_transport_malformed', writerResult: 'error', usageDecision: 'no_increment',
      },
      {
        result: styleFailure('style_not_fulfilled', {
          writerAttempts: 1, evaluatorAttempts: 1, writerCandidateReachedValidation: true, evaluatorReached: true,
        }),
        layer: 'evaluator_validation', reason: 'style_not_fulfilled', writerResult: 'accepted', usageDecision: 'no_increment',
      },
      {
        result: styleFailure('evaluator_rejected', {
          writerAttempts: 1, evaluatorAttempts: 1, writerCandidateReachedValidation: true, evaluatorReached: true,
        }),
        layer: 'evaluator_validation', reason: 'evaluator_rejected', writerResult: 'accepted', usageDecision: 'no_increment',
      },
      {
        result: styleFailure('repair_rejected', {
          writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1, repairEvaluatorAttempts: 1,
          writerCandidateReachedValidation: true, evaluatorReached: true,
        }),
        layer: 'repair_validation', reason: 'repair_rejected', writerResult: 'accepted', usageDecision: 'no_increment',
      },
      {
        result: {
          kind: 'safe_no_op', style: 'stronger', mode: 'enhance_existing_content', typedReason: 'safe_no_op',
          evidence: styleEvidence({ writerAttempts: 1, evaluatorAttempts: 1, writerCandidateReachedValidation: true, evaluatorReached: true, safeNoOpSelected: true, noOpDetected: true }),
        },
        layer: 'terminal_success', reason: 'safe_no_op', writerResult: 'accepted', usageDecision: 'no_increment',
      },
      {
        result: {
          kind: 'candidate_ready', style: 'stronger', mode: 'enhance_existing_content',
          candidate: {} as never,
          evidence: styleEvidence({ writerAttempts: 1, evaluatorAttempts: 1, writerCandidateReachedValidation: true, evaluatorReached: true, meaningfulChangeDetected: true }),
        },
        layer: 'terminal_success', reason: 'candidate_ready', writerResult: 'accepted', usageDecision: 'increment',
      },
    ];

    for (const testCase of cases) {
      const before = JSON.stringify(testCase.result);
      const event = createSummaryStrongerTerminalDiagnostic({
        requestId: 'safe-correlation-id', requestedLocale: 'sr', mode: 'enhance_existing_content',
        httpStatus: testCase.result.kind === 'candidate_ready' || testCase.result.kind === 'safe_no_op' ? 200 : 422,
        result: testCase.result,
      });
      expect(event).toMatchObject({
        event: 'summary_stronger_terminal', operation: 'summary_style', style: 'stronger',
        requestedLocale: 'sr', terminalLayer: testCase.layer, terminalReason: testCase.reason,
        writerResult: testCase.writerResult, usageDecision: testCase.usageDecision,
      });
      expect(JSON.stringify(testCase.result)).toBe(before);
    }
  });

  it('emits exactly once, retains provider/evaluator stage truth, and has no content fingerprint surface', () => {
    const source = styleFailure('unsupported_claim', {
      writerAttempts: 1,
      evaluatorAttempts: 1,
      repairWriterAttempts: 1,
      repairEvaluatorAttempts: 1,
      writerCandidateReachedValidation: true,
      evaluatorReached: true,
      sourceSummaryHash: 'private-content-derived-hash',
      candidateHash: 'private-candidate-hash',
    });
    const before = JSON.stringify(source);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const event = emitSummaryStrongerTerminalDiagnostic({
      requestId: 'iad1::safe-correlation-id', requestedLocale: 'en', mode: 'enhance_existing_content',
      httpStatus: 422, result: source,
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(JSON.stringify(event));
    expect(event).toMatchObject({
      writerAttempted: true, writerResult: 'accepted', writerOutputPresent: true,
      evaluatorAttempted: true, repairAttempted: true, repairProviderRequestAttempted: true,
      finalApplyEligible: false, usageDecision: 'no_increment',
    });
    expect(JSON.stringify(event)).not.toContain('private-content-derived-hash');
    expect(JSON.stringify(event)).not.toContain('private-candidate-hash');
    expect(JSON.stringify(event)).not.toContain('Summary');
    expect(JSON.stringify(source)).toBe(before);
    info.mockRestore();
  });

  it('defines writer result and writer output fields from bounded stage evidence', () => {
    const notAttempted = createSummaryStrongerTerminalDiagnostic({
      requestId: 'not-attempted', requestedLocale: 'en', mode: 'generate_from_context', httpStatus: 422,
      result: styleFailure('insufficient_context'),
    });
    const rejected = createSummaryStrongerTerminalDiagnostic({
      requestId: 'rejected', requestedLocale: 'en', mode: 'enhance_existing_content', httpStatus: 422,
      result: styleFailure('candidate_malformed', { writerAttempts: 1 }),
    });
    const errored = createSummaryStrongerTerminalDiagnostic({
      requestId: 'errored', requestedLocale: 'en', mode: 'enhance_existing_content', httpStatus: 502,
      result: styleFailure('writer_request_failed', {
        writerAttempts: 1,
        m5ProviderFailure: providerFailure({ failureStage: 'sdk_request' }),
      }),
    });
    const accepted = createSummaryStrongerTerminalDiagnostic({
      requestId: 'accepted', requestedLocale: 'en', mode: 'enhance_existing_content', httpStatus: 422,
      result: styleFailure('style_not_fulfilled', {
        writerAttempts: 1, writerCandidateReachedValidation: true,
      }),
    });

    expect(notAttempted).toMatchObject({ writerResult: 'not_attempted', writerOutputPresent: false });
    expect(rejected).toMatchObject({ writerResult: 'rejected', writerOutputPresent: false });
    expect(errored).toMatchObject({ writerResult: 'error', writerOutputPresent: false });
    expect(accepted).toMatchObject({ writerResult: 'accepted', writerOutputPresent: true });
    expect('applicationCode' in accepted).toBe(false);
    expect('elapsedMs' in accepted).toBe(false);
  });

  it('keeps true route gates distinct from route failures carrying provider evidence', () => {
    const gate = createSummaryStrongerTerminalDiagnostic({
      requestId: 'route-gate', requestedLocale: 'en', mode: 'generate_from_context', httpStatus: 409,
      result: createSummaryV3StyleM5RouteFailure('v3_feature_disabled'),
    });
    const providerRouteFailureEvent = createSummaryStrongerTerminalDiagnostic({
      requestId: 'provider-route-failure', requestedLocale: 'en', mode: 'enhance_existing_content', httpStatus: 502,
      result: createSummaryV3StyleM5RouteFailure('generation_validation_failed', {
        ...styleEvidence({
          m5ProviderFailure: providerFailure({ phase: 'initial_writer', failureStage: 'sdk_request' }),
        }),
      }),
    });

    expect(gate).toMatchObject({
      terminalLayer: 'route_gate', writerAttempted: false, writerResult: 'not_attempted',
      writerOutputPresent: false, usageDecision: 'not_applicable',
    });
    expect(providerRouteFailureEvent).toMatchObject({
      terminalLayer: 'provider_transport', writerAttempted: true, writerResult: 'error',
      writerOutputPresent: false, evaluatorAttempted: false, repairAttempted: false,
      repairProviderRequestAttempted: false, finalApplyEligible: false, usageDecision: 'no_increment',
    });
  });

  it('keeps the returned event when terminal logging fails', () => {
    const source = styleFailure('unsupported_claim', { writerAttempts: 1 });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {
      throw new Error('logging unavailable');
    });

    expect(() => emitSummaryStrongerTerminalDiagnostic({
      requestId: 'logging-failure', requestedLocale: 'en', mode: 'enhance_existing_content',
      httpStatus: 422, result: source,
    })).not.toThrow();
    const event = emitSummaryStrongerTerminalDiagnostic({
      requestId: 'logging-failure-2', requestedLocale: 'en', mode: 'enhance_existing_content',
      httpStatus: 422, result: source,
    });
    expect(event.terminalReason).toBe('unsupported_claim');
    expect(event.finalApplyEligible).toBe(false);
    info.mockRestore();
  });

  it('keeps route response compatibility and usage decisions explicit for success versus rejection', () => {
    const rejected = styleFailure('style_not_fulfilled', { writerAttempts: 1, evaluatorAttempts: 1, writerCandidateReachedValidation: true, evaluatorReached: true });
    const accepted: SummaryV3StyleResult = {
      kind: 'candidate_ready', style: 'stronger', mode: 'enhance_existing_content', candidate: {} as never,
      evidence: styleEvidence({ writerAttempts: 1, evaluatorAttempts: 1, writerCandidateReachedValidation: true, evaluatorReached: true }),
    };
    expect(createSummaryStrongerTerminalDiagnostic({ requestId: 'reject', requestedLocale: 'en', mode: 'enhance_existing_content', httpStatus: 422, result: rejected })).toMatchObject({
      httpStatus: 422, finalApplyEligible: false, usageDecision: 'no_increment',
    });
    expect(createSummaryStrongerTerminalDiagnostic({ requestId: 'accept', requestedLocale: 'en', mode: accepted.mode, httpStatus: 200, result: accepted })).toMatchObject({
      httpStatus: 200, finalApplyEligible: true, usageDecision: 'increment',
    });
  });
});
