import { describe, expect, it, vi } from 'vitest';
import type { ContentLocalizeM6Snapshot } from '../content-localize-m6';
import type {
  ContentLocalizeM6ServerFailureReason,
  ContentLocalizeM6ServerResult,
} from '../content-localize-m6-server';
import {
  createEmptyContentLocalizeV3ServerDiagnostic,
  type ContentLocalizeV3DiagnosticPhase,
  type ContentLocalizeV3ServerDiagnostic,
} from '../content-localize-v3-terminal-diagnostics';
import {
  CONTENT_LOCALIZE_V3_TERMINAL_PHASES,
  createContentLocalizeV3ProductionTerminalEvent,
  emitContentLocalizeV3ProductionTerminalEvent,
} from '../content-localize-v3-production-observability';

type FailureResult = Extract<ContentLocalizeM6ServerResult, { status: 'handled_failure' }>;

function phase(
  result: ContentLocalizeV3DiagnosticPhase['result'],
  attempted = true,
): ContentLocalizeV3DiagnosticPhase {
  return {
    attempted,
    result,
    stopReason: null,
    contentBlockCount: null,
    textBlockCount: null,
    toolBlockCount: null,
    expectedToolCount: null,
    toolNameMatched: null,
    toolInputObject: null,
    toolInputSchemaPassed: null,
    identityPassed: null,
  };
}

function diagnostic(
  overrides: Partial<ContentLocalizeV3ServerDiagnostic> = {},
): ContentLocalizeV3ServerDiagnostic {
  return { ...createEmptyContentLocalizeV3ServerDiagnostic(), ...overrides };
}

function failure(
  reason: ContentLocalizeM6ServerFailureReason,
  serverDiagnostic: ContentLocalizeV3ServerDiagnostic,
): FailureResult {
  return { status: 'handled_failure', reason, diagnostic: serverDiagnostic };
}

const snapshot: ContentLocalizeM6Snapshot = {
  operationId: 'operation-safe',
  requestId: 'request-safe',
  kind: 'experience_description',
  experienceEntryId: 'entry-safe',
  sourceLocale: 'en',
  targetLocale: 'de',
  sourceText: 'PRIVATE DESCRIPTION',
  sourceTextHash: 'PRIVATE HASH',
};

describe('Content Localize V3 production terminal observability', () => {
  it('emits exactly one typed writer timeout from existing provider-owned timing evidence', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const result = failure('deadline_exceeded', diagnostic({
      writer: phase('failed'),
      finalDecision: 'deadline_exceeded',
      deadlineExceeded: true,
      deadlineOwner: 'provider_call',
      deadlinePhase: 'writer',
      providerFailureStage: 'writer_transport',
      providerErrorType: 'AbortError',
    }));
    const event = emitContentLocalizeV3ProductionTerminalEvent({
      requestId: '2ph24-safe-id', snapshot, httpStatus: 504, elapsedMs: 15_003, result,
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(JSON.stringify(event));
    expect(event).toMatchObject({
      event: 'content_localize_v3_terminal', action: 'content-localize-v3',
      snapshotKind: 'experience_description', sourceLocale: 'en', targetLocale: 'de',
      phase: 'initial_writer', typedFailureCode: 'deadline_exceeded', failureFamily: 'timeout',
      timeoutPhase: 'initial_writer', timeoutOwner: 'provider',
      providerAttemptCount: 1, writerReached: true, evaluatorReached: false,
    });
    info.mockRestore();
  });

  it('projects a typed evaluator route-budget timeout without using elapsed time', () => {
    const event = createContentLocalizeV3ProductionTerminalEvent({
      requestId: 'evaluator-timeout', snapshot, httpStatus: 504, elapsedMs: 1,
      result: failure('deadline_exceeded', diagnostic({
        writer: phase('succeeded'),
        primaryEvaluator: phase('failed'),
        finalDecision: 'deadline_exceeded',
        deadlineExceeded: true,
        deadlineOwner: 'route_budget',
        deadlinePhase: 'evaluator',
        providerFailureStage: 'primary_evaluator_transport',
        providerErrorType: 'AbortError',
      })),
    });

    expect(event).toMatchObject({
      phase: 'route_deadline', timeoutPhase: 'initial_evaluator', timeoutOwner: 'server',
      providerAttemptCount: 2, writerReached: true, evaluatorReached: true,
      repairWriterReached: false, repairEvaluatorReached: false,
    });
  });

  it('does not classify a slow non-timeout 504-shaped failure as a timeout', () => {
    const event = createContentLocalizeV3ProductionTerminalEvent({
      requestId: 'slow-runtime', snapshot, httpStatus: 504, elapsedMs: 99_999,
      result: failure('writer_failed', diagnostic({
        writer: phase('failed'),
        providerFailureStage: 'writer_transport',
        providerErrorType: 'Error',
      })),
    });

    expect(event).toMatchObject({
      phase: 'initial_writer', failureFamily: 'provider_transport',
      timeoutPhase: null, timeoutOwner: null,
    });
  });

  it('preserves a null timeout owner when typed deadline ownership is unknown', () => {
    const event = createContentLocalizeV3ProductionTerminalEvent({
      requestId: 'unknown-owner', snapshot, httpStatus: 504, elapsedMs: 12,
      result: failure('deadline_exceeded', diagnostic({
        writer: phase('succeeded'),
        primaryEvaluator: phase('failed'),
        finalDecision: 'deadline_exceeded',
        deadlineExceeded: true,
        deadlineOwner: 'unknown',
        deadlinePhase: 'evaluator',
      })),
    });

    expect(event).toMatchObject({
      phase: 'initial_evaluator', timeoutPhase: 'initial_evaluator', timeoutOwner: null,
    });
  });

  it('uses only finite current control-flow phases and exposes repair reach truth', () => {
    const event = createContentLocalizeV3ProductionTerminalEvent({
      requestId: 'repair-reject', snapshot, httpStatus: 422, elapsedMs: 42,
      result: failure('candidate_rejected', diagnostic({
        writer: phase('succeeded'),
        primaryEvaluator: phase('succeeded'),
        repair: phase('succeeded'),
        repairEvaluator: phase('succeeded'),
        finalDecision: 'rejected',
      })),
    });

    expect(CONTENT_LOCALIZE_V3_TERMINAL_PHASES).toContain(event.phase);
    expect(event).toMatchObject({
      phase: 'validation', failureFamily: 'validation',
      providerAttemptCount: 4, providerReached: true, providerResponseReceived: true,
      writerReached: true, evaluatorReached: true,
      repairWriterReached: true, repairEvaluatorReached: true, validatorReached: true,
      validationFailureClass: 'candidate_rejected', usageCommitted: false,
    });
  });

  it('keeps malformed output separate from provider transport', () => {
    const event = createContentLocalizeV3ProductionTerminalEvent({
      requestId: 'malformed-output', snapshot, httpStatus: 502, elapsedMs: 2,
      result: failure('evaluator_failed', diagnostic({
        writer: phase('succeeded'),
        primaryEvaluator: phase('malformed'),
      })),
    });

    expect(event).toMatchObject({
      phase: 'initial_evaluator', failureFamily: 'output_contract',
      outputContractFailureClass: 'evaluator_failed', providerResponseReceived: true,
      validatorReached: true,
    });
  });

  it('projects route-owned failures without claiming provider execution', () => {
    const event = createContentLocalizeV3ProductionTerminalEvent({
      requestId: 'route-auth', snapshot, httpStatus: 403, elapsedMs: 3,
      routeFailure: {
        phase: 'route_auth', typedFailureCode: 'invalid_pro_token', failureFamily: 'auth',
      },
    });

    expect(event).toMatchObject({
      phase: 'route_auth', typedFailureCode: 'invalid_pro_token', failureFamily: 'auth',
      providerAttemptCount: 0, providerReached: false, providerResponseReceived: false,
      writerReached: false, evaluatorReached: false,
      repairWriterReached: false, repairEvaluatorReached: false, validatorReached: false,
    });
  });

  it('uses a fixed projection that excludes CV, provider, prompt, validator, auth, and secret material', () => {
    const unsafeSnapshot = {
      ...snapshot,
      sourceText: 'PRIVATE CV DESCRIPTION',
      name: 'PRIVATE NAME',
      company: 'PRIVATE COMPANY',
      role: 'PRIVATE ROLE',
      email: 'private@example.com',
      prompt: 'PRIVATE PROMPT',
      authorization: 'PRIVATE AUTH HEADER',
      apiKey: 'PRIVATE API KEY',
      revenueCatKey: 'PRIVATE REVENUECAT KEY',
    };
    const unsafeResult = {
      ...failure('writer_failed', diagnostic({
        writer: phase('failed'), providerFailureStage: 'writer_transport', providerErrorType: 'Error',
      })),
      candidate: 'PRIVATE CANDIDATE',
      providerOutput: 'PRIVATE PROVIDER OUTPUT',
      validatorDetail: 'PRIVATE VALIDATOR DETAIL',
      token: 'PRIVATE TOKEN',
    } as unknown as FailureResult;
    const event = createContentLocalizeV3ProductionTerminalEvent({
      requestId: 'bad id private@example.com', snapshot: unsafeSnapshot,
      httpStatus: 502, elapsedMs: 5, result: unsafeResult,
    });
    const serialized = JSON.stringify(event);

    expect(event.requestId).toBeNull();
    for (const forbidden of [
      'PRIVATE CV DESCRIPTION', 'PRIVATE NAME', 'PRIVATE COMPANY', 'PRIVATE ROLE',
      'private@example.com', 'PRIVATE PROMPT', 'PRIVATE AUTH HEADER', 'PRIVATE API KEY',
      'PRIVATE REVENUECAT KEY', 'PRIVATE CANDIDATE', 'PRIVATE PROVIDER OUTPUT',
      'PRIVATE VALIDATOR DETAIL', 'PRIVATE TOKEN', 'PRIVATE HASH',
    ]) expect(serialized).not.toContain(forbidden);
  });
});
