import { describe, expect, it } from 'vitest';
import type { CVData } from '../../types';
import {
  captureExperienceV3OperationSnapshot,
  mapExperienceV3GenerateResultToErrorCode,
  runExperienceV3GenerateAdapter,
  type ExperienceV3AdapterInput,
  type ExperienceV3AdapterResult,
} from '../experience-generate';
import {
  EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
  executeExperienceV3GenerateServer,
  type ExperienceV3EvaluatorResponse,
} from '../experience-generate-server';

const BULLETS = [
  'Supports routine customer requests within the assigned role context.',
  'Coordinates daily work with colleagues and follows established guidance.',
  'Maintains clear records for ordinary tasks in the assigned area.',
] as const;

class APIConnectionTimeoutError extends Error {
  constructor() {
    super('provider deadline exceeded');
    this.name = 'APIConnectionTimeoutError';
  }
}

function makeCv(): CVData {
  return {
    id: 'm8-generate-observability',
    name: 'Generate observability fixture',
    personal: {
      fullName: 'Candidate', email: '', phone: '', address: '',
      jobTitle: 'Support Specialist', gender: 'female',
    },
    summary: '',
    contentLocale: 'en',
    experience: [{
      id: 'exp-target', company: 'Example Company', position: 'Support Specialist',
      startDate: '2024-01', endDate: '', isPresent: true, description: '',
    }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-09-15T00:00:00.000Z', updatedAt: '2026-09-15T00:00:00.000Z',
  };
}

function makeInput(overrides: Partial<ExperienceV3AdapterInput> = {}): ExperienceV3AdapterInput {
  return {
    enabled: true,
    operationKind: 'experience_generate',
    operationId: 'm8-generate-observability-operation',
    entryId: 'exp-target',
    entryIndexDiagnostic: 0,
    cv: makeCv(),
    industry: 'customer-service',
    level: 'mid',
    diagnosticIndustry: 'customer-service',
    diagnosticLevel: 'mid',
    gender: 'female',
    requestedLocale: 'en',
    uiLocale: 'en',
    storedContentLocale: 'en',
    exactVisibleDescription: '',
    usageCountBefore: 4,
    ...overrides,
  };
}

function writerJson(manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest']): string {
  return JSON.stringify({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    bullets: BULLETS,
  });
}

function evaluatorResponse(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  semantic: 'passed' | 'failed' = 'passed',
): ExperienceV3EvaluatorResponse {
  return {
    stopReason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
      input: {
        operationId: manifest.operationId,
        entryId: manifest.entryId,
        snapshotHash: manifest.snapshotHash,
        locale: manifest.locale,
        phases: {
          semantic: {
            status: semantic,
            violations: semantic === 'passed' ? [] : [{
              code: 'unsupported_claim', category: 'semantic', detail: 'Unsupported claim.',
              entryIds: [manifest.entryId],
            }],
          },
          language_quality: { status: 'passed', violations: [] },
        },
      },
    }],
  };
}

async function serverFor(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  mode: 'success' | 'writer_timeout' | 'writer_error' | 'evaluator_timeout' | 'evaluator_error' | 'validation',
) {
  return executeExperienceV3GenerateServer({ manifest }, {
    generate: async () => {
      if (mode === 'writer_timeout') throw new APIConnectionTimeoutError();
      if (mode === 'writer_error') throw Object.assign(new Error('upstream unavailable'), {
        status: 503,
        requestID: 'req-generate-safe',
        error: { code: 'overloaded' },
      });
      return writerJson(manifest);
    },
    evaluate: async () => {
      if (mode === 'evaluator_timeout') throw new APIConnectionTimeoutError();
      if (mode === 'evaluator_error') throw Object.assign(new Error('verifier unavailable'), {
        status: 503,
        requestID: 'req-evaluator-safe',
        error: { code: 'internal_server_error' },
      });
      return evaluatorResponse(manifest, mode === 'validation' ? 'failed' : 'passed');
    },
  });
}

async function runClient(mode: Parameters<typeof serverFor>[1]): Promise<{
  result: ExperienceV3AdapterResult;
  usage: number;
  writes: number;
  persists: number;
}> {
  const input = makeInput();
  const snapshot = captureExperienceV3OperationSnapshot(input);
  let cv = input.cv;
  let usage = input.usageCountBefore;
  let routeStatus: number | null = null;
  let writes = 0;
  let persists = 0;
  const result = await runExperienceV3GenerateAdapter(input, {
    request: async () => {
      const response = await serverFor(snapshot.manifest, mode);
      routeStatus = response.ok
        ? 200
        : response.typedReason === 'writer_timeout' || response.typedReason === 'evaluator_timeout'
          ? 504
          : response.typedReason.includes('request_failed') ? 502 : 422;
      return response;
    },
    getLiveState: () => ({
      cv,
      requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en',
      exactVisibleDescription: '', industry: 'customer-service', level: 'mid',
    }),
    writeCv: (next) => { writes += 1; cv = next; },
    persistCv: () => { persists += 1; return true; },
    incrementUsage: () => { usage += 1; },
    getUsageCount: () => usage,
    getRouteHttpStatus: () => routeStatus,
  });
  return { result, usage, writes, persists };
}

describe('M8 Generate provider-error observability contract', () => {
  it('A. writer timeout is typed and exposes only safe timeout evidence', async () => {
    const input = makeInput();
    const result = await serverFor(captureExperienceV3OperationSnapshot(input).manifest, 'writer_timeout');
    expect(result).toMatchObject({ ok: false, typedReason: 'writer_timeout' });
    expect(result.diagnosticEvidence).toMatchObject({
      providerFailureStage: 'sdk_request', providerErrorType: 'timeout',
      providerErrorClass: 'APIConnectionTimeoutError', providerRetryable: false,
    });
    expect(result.diagnosticEvidence).not.toHaveProperty('providerMessage');
  });

  it('B. writer non-timeout transport is typed separately from timeout', async () => {
    const input = makeInput();
    const result = await serverFor(captureExperienceV3OperationSnapshot(input).manifest, 'writer_error');
    expect(result).toMatchObject({ ok: false, typedReason: 'writer_request_failed' });
    expect(result.diagnosticEvidence).toMatchObject({
      providerFailureStage: 'provider_response', providerErrorType: 'provider_5xx',
      providerHttpStatus: 503, providerErrorCode: 'overloaded', providerRetryable: true,
    });
  });

  it('C. evaluator timeout fails closed with timeout evidence and no candidate apply', async () => {
    const run = await runClient('evaluator_timeout');
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_timeout' });
    expect(run.result.kind === 'handled_failure' && run.result.diagnostic).toMatchObject({
      finalDecision: 'transport_failure', applyCommitted: false, usageDelta: 0,
      providerErrorType: 'timeout', providerFailureStage: 'sdk_request',
    });
    expect([run.writes, run.persists, run.usage]).toEqual([0, 0, 4]);
  });

  it('D. evaluator non-timeout transport fails closed with safe provider evidence', async () => {
    const run = await runClient('evaluator_error');
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_request_failed' });
    expect(run.result.kind === 'handled_failure' && run.result.diagnostic).toMatchObject({
      finalDecision: 'transport_failure', applyCommitted: false,
      providerErrorType: 'provider_5xx', providerHttpStatus: 503,
      providerErrorCode: 'internal_server_error',
    });
    expect([run.writes, run.persists, run.usage]).toEqual([0, 0, 4]);
  });

  it('E. genuine evaluator validation rejection remains validation UX', async () => {
    const run = await runClient('validation');
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'validation_rejected' });
    expect(mapExperienceV3GenerateResultToErrorCode(run.result)).toBe('generation_validation_failed');
  });

  it('F. timeout terminal maps to the existing localized timeout UX', async () => {
    const run = await runClient('writer_timeout');
    expect(run.result.kind).toBe('handled_failure');
    expect(mapExperienceV3GenerateResultToErrorCode(run.result)).toBe('request_timeout');
  });

  it('G. generic transport terminal maps to provider-unavailable, never validation UX', async () => {
    const run = await runClient('writer_error');
    expect(run.result.kind).toBe('handled_failure');
    expect(run.result.kind === 'handled_failure' && run.result.diagnostic).toMatchObject({
      providerFailureStage: 'provider_response',
      providerErrorType: 'provider_5xx',
      providerHttpStatus: 503,
      providerErrorCode: 'overloaded',
    });
    expect(mapExperienceV3GenerateResultToErrorCode(run.result)).toBe('provider_temporarily_unavailable');
  });

  it('H. accepted success applies, persists, and increments usage exactly once', async () => {
    const run = await runClient('success');
    expect(run.result).toMatchObject({ kind: 'handled_success' });
    expect([run.writes, run.persists, run.usage]).toEqual([1, 1, 5]);
  });
});
