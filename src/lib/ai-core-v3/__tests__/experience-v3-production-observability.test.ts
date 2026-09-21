import { describe, expect, it, vi } from 'vitest';
import type { ExperienceV3EnhanceFailureResponse } from '../experience-enhance';
import { unavailableExperienceV3DiagnosticEvidence } from '../experience-generate';
import {
  createExperienceV3TerminalDiagnostic,
  emitExperienceV3TerminalDiagnostic,
  rememberExperienceV3ProviderDeadlineOwner,
} from '../experience-v3-production-observability';

function failure(
  typedReason: string,
  evidence: Record<string, unknown> = {},
): ExperienceV3EnhanceFailureResponse {
  const { providerDeadlineOwner, ...safeEvidence } = evidence;
  const result = {
    ok: false,
    action: 'experience_v3_enhance',
    typedReason,
    diagnosticEvidence: {
      ...unavailableExperienceV3DiagnosticEvidence(),
      ...safeEvidence,
    },
  } as ExperienceV3EnhanceFailureResponse;
  if (providerDeadlineOwner && result.diagnosticEvidence) {
    rememberExperienceV3ProviderDeadlineOwner(result.diagnosticEvidence, providerDeadlineOwner as 'provider_transport' | 'verifier_transport' | 'route_deadline' | 'client_abort');
  }
  return result;
}

describe('Experience V3 production terminal observability', () => {
  it('emits exactly one typed initial-writer timeout event', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const event = emitExperienceV3TerminalDiagnostic({
      requestId: 'iad1::experience-request',
      httpStatus: 502,
      elapsedMs: 15_001,
      result: failure('writer_request_failed', {
        providerFailureStage: 'sdk_request',
        providerErrorType: 'timeout',
        providerDeadlineOwner: 'provider_transport',
      }),
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(event).toMatchObject({
      event: 'experience_v3_terminal', action: 'experience_v3_enhance',
      phase: 'initial_writer', typedFailureCode: 'writer_request_failed',
      timeoutPhase: 'initial_writer', timeoutOwner: 'provider',
      serverOuterDeadlineReached: false, writerReached: true,
      evaluatorReached: false, validatorReached: false,
    });
    info.mockRestore();
  });

  it('distinguishes an initial-evaluator timeout and a server-owned deadline', () => {
    const event = createExperienceV3TerminalDiagnostic({
      requestId: 'experience-evaluator-timeout',
      httpStatus: 502,
      elapsedMs: 36_001,
      result: failure('evaluator_timeout', {
        providerFailureStage: 'sdk_request',
        providerErrorType: 'timeout',
        providerDeadlineOwner: 'route_deadline',
      }),
    });

    expect(event).toMatchObject({
      phase: 'server_deadline', timeoutPhase: 'initial_evaluator', timeoutOwner: 'server',
      serverOuterDeadlineReached: true, writerReached: true,
      evaluatorReached: true, validatorReached: false,
    });
  });

  it('keeps writer and evaluator non-timeout transport failures distinct', () => {
    const writer = createExperienceV3TerminalDiagnostic({
      requestId: 'writer-transport', httpStatus: 502, elapsedMs: 10,
      result: failure('writer_request_failed', {
        providerFailureStage: 'sdk_request', providerErrorType: 'connection/network',
        providerDeadlineOwner: 'provider_transport',
      }),
    });
    const evaluator = createExperienceV3TerminalDiagnostic({
      requestId: 'evaluator-transport', httpStatus: 502, elapsedMs: 10,
      result: failure('evaluator_request_failed', {
        providerFailureStage: 'provider_response', providerErrorType: 'provider_5xx',
        providerDeadlineOwner: 'verifier_transport',
      }),
    });

    expect(writer).toMatchObject({ phase: 'initial_writer', failureFamily: 'provider_transport', timeoutPhase: null });
    expect(evaluator).toMatchObject({ phase: 'initial_evaluator', failureFamily: 'provider_transport', timeoutPhase: null });
  });

  it('keeps output-contract failures separate from transport and validation failures', () => {
    const output = createExperienceV3TerminalDiagnostic({
      requestId: 'output-contract', httpStatus: 502, elapsedMs: 2,
      result: failure('writer_tool_missing'),
    });
    const structural = createExperienceV3TerminalDiagnostic({
      requestId: 'structural-validation', httpStatus: 422, elapsedMs: 2,
      result: failure('structural_validation_failed'),
    });
    const semantic = createExperienceV3TerminalDiagnostic({
      requestId: 'semantic-validation', httpStatus: 422, elapsedMs: 2,
      result: failure('validation_rejected'),
    });

    expect(output).toMatchObject({ phase: 'initial_writer', failureFamily: 'output_contract', outputContractFailureClass: 'writer_tool_missing' });
    expect(structural).toMatchObject({ phase: 'validation', failureFamily: 'validation', validationRejected: true });
    expect(semantic).toMatchObject({ phase: 'validation', failureFamily: 'validation', validationRejected: true });
  });

  it('classifies forced-tool response extraction as output-contract evidence', () => {
    const event = createExperienceV3TerminalDiagnostic({
      requestId: 'forced-tool-extraction', httpStatus: 502, elapsedMs: 2,
      result: failure('evaluator_request_failed', {
        providerFailureStage: 'response_extraction', providerErrorType: 'response_extraction',
      }),
    });

    expect(event).toMatchObject({
      phase: 'initial_evaluator', failureFamily: 'output_contract',
      outputContractFailureClass: 'response_extraction', providerResponseReceived: true,
    });
  });

  it('projects route failures without claiming provider work', () => {
    const event = createExperienceV3TerminalDiagnostic({
      requestId: 'route-auth', httpStatus: 403, elapsedMs: 4,
      routeFailure: { phase: 'route_auth', typedFailureCode: 'invalid_pro_token', failureFamily: 'auth' },
    });

    expect(event).toMatchObject({
      action: 'experience_v3_enhance', phase: 'route_auth', failureFamily: 'auth',
      providerReached: false, providerAttemptCount: 0, providerResponseReceived: false,
      writerReached: false, evaluatorReached: false, validatorReached: false,
      usageCommitted: false,
    });
  });

  it('does not use elapsed time to invent a timeout and sanitizes correlation IDs', () => {
    const slowRateLimit = createExperienceV3TerminalDiagnostic({
      requestId: 'bad id with spaces', httpStatus: 502, elapsedMs: 99_999,
      result: failure('writer_request_failed', {
        providerFailureStage: 'provider_response', providerErrorType: 'rate_limit',
      }),
    });

    expect(slowRateLimit.requestId).toBeNull();
    expect(slowRateLimit.timeoutPhase).toBeNull();
    expect(slowRateLimit.timeoutOwner).toBeNull();
    expect(slowRateLimit.serverOuterDeadlineReached).toBeNull();
  });

  it('uses a fixed allowlist and excludes CV, provider, prompt, auth, and secret material', () => {
    const event = createExperienceV3TerminalDiagnostic({
      requestId: 'safe-id', httpStatus: 502, elapsedMs: 1,
      result: {
        ...failure('writer_request_failed', {
          providerFailureStage: 'sdk_request', providerErrorType: 'connection/network',
        }),
        position: 'PRIVATE POSITION', company: 'PRIVATE COMPANY', description: 'PRIVATE DESCRIPTION',
        providerRawOutput: 'PRIVATE PROVIDER OUTPUT', prompt: 'PRIVATE PROMPT',
        proToken: 'PRIVATE PRO TOKEN', authorization: 'PRIVATE AUTH HEADER',
        revenueCatKey: 'PRIVATE REVENUECAT KEY', apiKey: 'PRIVATE API KEY',
      } as unknown as ExperienceV3EnhanceFailureResponse,
    });
    const serialized = JSON.stringify(event);

    for (const forbidden of [
      'PRIVATE POSITION', 'PRIVATE COMPANY', 'PRIVATE DESCRIPTION', 'PRIVATE PROVIDER OUTPUT',
      'PRIVATE PROMPT', 'PRIVATE PRO TOKEN', 'PRIVATE AUTH HEADER', 'PRIVATE REVENUECAT KEY',
      'PRIVATE API KEY',
    ]) expect(serialized).not.toContain(forbidden);
    expect(event).toMatchObject({ event: 'experience_v3_terminal', action: 'experience_v3_enhance' });
  });

  it('preserves the source response, status facts, attempts, and usage ownership', () => {
    const source = failure('evaluator_timeout', {
      providerFailureStage: 'sdk_request', providerErrorType: 'timeout',
      providerDeadlineOwner: 'verifier_transport',
    });
    const before = JSON.stringify(source);
    const event = createExperienceV3TerminalDiagnostic({
      requestId: 'non-interfering', httpStatus: 502, elapsedMs: 12, result: source,
    });

    expect(JSON.stringify(source)).toBe(before);
    expect(event.httpStatus).toBe(502);
    expect(event.providerAttemptCount).toBeNull();
    expect(event.usageCommitted).toBe(false);
  });

  it('emits no failure event for a successful Enhance response', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const successfulResponse = {
      ok: true,
      action: 'experience_v3_enhance',
      providerOutput: { operationId: 'op', entryId: 'entry', snapshotHash: 'hash', locale: 'en', units: [] },
    };

    expect(successfulResponse.ok).toBe(true);
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
