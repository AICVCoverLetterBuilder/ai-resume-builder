/**
 * M8 Experience V3 Generate deadline contract.
 *
 * These tests are deliberately offline. They exercise the shared provider
 * deadline with deterministic fake timers and verify the production route's
 * wiring without contacting Anthropic or Vercel.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { ExperienceFactManifest } from '../contracts';
import {
  executeExperienceV3GenerateServer,
  EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
  type ExperienceV3EvaluatorResponse,
} from '../experience-generate-server';
import {
  EXPERIENCE_V3_GENERATE_ACTION,
  mapExperienceV3GenerateResultToErrorCode,
} from '../experience-generate';
import {
  AI_PROVIDER_CALL_TIMEOUT_MS,
  EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
  EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS,
  callProviderWithDeadline,
  computeExperienceV3Deadline,
  computeExperienceV3EnhanceDeadline,
  readProviderTimingEvidence,
} from '@/lib/ai-request-timing';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const START = 1_700_000_000_000;

function manifest(): ExperienceFactManifest {
  return {
    operationId: 'm8-generate-deadline',
    operationKind: 'experience_generate',
    mode: 'generate',
    entryId: 'entry-deadline',
    locale: 'en',
    roleTitle: 'Support Specialist',
    company: 'Example Company',
    employmentState: 'present',
    dates: { start: { year: 2024, month: 1 }, end: null },
    industry: 'customer-service',
    level: 'mid',
    exactSourceText: '',
    facts: [],
    snapshotHash: 'snapshot-deadline',
  };
}

function writerJson(value: ExperienceFactManifest): string {
  return JSON.stringify({
    operationId: value.operationId,
    entryId: value.entryId,
    snapshotHash: value.snapshotHash,
    locale: value.locale,
    bullets: [
      'Supports routine customer requests in line with the supplied role context.',
      'Coordinates daily work with colleagues and follows established workplace guidance.',
      'Maintains clear records for ordinary tasks within the assigned area of responsibility.',
    ],
  });
}

function evaluatorResponse(value: ExperienceFactManifest): ExperienceV3EvaluatorResponse {
  return {
    stopReason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
      input: {
        operationId: value.operationId,
        entryId: value.entryId,
        snapshotHash: value.snapshotHash,
        locale: value.locale,
        phases: {
          semantic: { status: 'passed', violations: [] },
          language_quality: { status: 'passed', violations: [] },
        },
      },
    }],
  };
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function timedProvider(
  configuredTimeoutMs: number,
  delayMs: number,
  timeoutStage: 'provider' | 'verifier',
) {
  return callProviderWithDeadline(
    async () => new Promise<string>((resolve) => {
      setTimeout(() => resolve('ok'), delayMs);
    }),
    START + EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS,
    configuredTimeoutMs,
    timeoutStage,
  );
}

async function runCoreWithEvaluatorTimeout() {
  const value = manifest();
  return executeExperienceV3GenerateServer({ manifest: value }, {
    generate: async () => writerJson(value),
    evaluate: async () => {
      await callProviderWithDeadline(
        async () => new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
        }),
        computeExperienceV3Deadline(START),
        EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
        'verifier',
      );
      return evaluatorResponse(value);
    },
  });
}

describe('M8 Experience V3 Generate deadline ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
    anthropicCreateMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses one shared 15s stage and 36s two-stage route budget for Generate and Enhance', () => {
    const route = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    expect(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS).toBe(15_000);
    expect(EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS).toBe(36_000);
    expect(computeExperienceV3Deadline(START)).toBe(START + 36_000);
    expect(computeExperienceV3EnhanceDeadline(START)).toBe(computeExperienceV3Deadline(START));
    expect(route).toContain('deadlineAt = computeExperienceV3Deadline(serverReceivedAt)');
    const generateStart = route.indexOf("if (action === EXPERIENCE_V3_GENERATE_ACTION)");
    const generateEnd = route.indexOf("if (action === 'cover-letter')", generateStart);
    const generate = route.slice(generateStart, generateEnd);
    expect(generate).toMatch(/EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,\s*'provider'/u);
    expect(generate).toMatch(/EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,\s*'verifier'/u);
  });

  it('A. retires the old 8000ms writer boundary while the same 8001ms call succeeds at 15s', async () => {
    const oldPending = timedProvider(AI_PROVIDER_CALL_TIMEOUT_MS, AI_PROVIDER_CALL_TIMEOUT_MS + 1, 'provider');
    const oldRejection = expect(oldPending).rejects.toMatchObject({ configuredTimeoutMs: AI_PROVIDER_CALL_TIMEOUT_MS });
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 2);
    await oldRejection;
    vi.setSystemTime(START);
    const newPending = timedProvider(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, AI_PROVIDER_CALL_TIMEOUT_MS + 1, 'provider');
    const newResolution = expect(newPending).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 2);
    await newResolution;
  });

  it('B. retires the old 8000ms evaluator boundary while the same 8001ms call succeeds at 15s', async () => {
    const oldPending = timedProvider(AI_PROVIDER_CALL_TIMEOUT_MS, AI_PROVIDER_CALL_TIMEOUT_MS + 1, 'verifier');
    const oldRejection = expect(oldPending).rejects.toMatchObject({ deadlineOwner: 'verifier_transport' });
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 2);
    await oldRejection;
    vi.setSystemTime(START);
    const newPending = timedProvider(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, AI_PROVIDER_CALL_TIMEOUT_MS + 1, 'verifier');
    const newResolution = expect(newPending).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 2);
    await newResolution;
  });

  it('C. maps a provider call beyond 15s to a timeout owned by the provider stage', async () => {
    const pending = timedProvider(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1, 'provider');
    const rejection = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      deadlineOwner: 'provider_transport',
      configuredTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      effectiveTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    await rejection;
  });

  it('D/E. evaluator timeout remains terminal, observable, and fail closed after a valid writer', async () => {
    const pending = runCoreWithEvaluatorTimeout();
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, typedReason: 'evaluator_timeout' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnosticEvidence).toMatchObject({
        candidatePresent: true,
        providerFailureStage: 'sdk_request',
        providerErrorType: 'timeout',
        providerRetryable: false,
      });
      expect(mapExperienceV3GenerateResultToErrorCode({
        kind: 'handled_failure',
        typedReason: result.typedReason,
        diagnostic: {
          providerErrorType: 'timeout',
          finalDecision: 'transport_failure',
          routeHttpStatus: 504,
        },
      } as never)).toBe('request_timeout');
    }
  });

  it('F. keeps timeout timing evidence finite and free of raw provider details', async () => {
    const pending = timedProvider(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1, 'verifier');
    const rejection = pending.catch((caught) => caught);
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    const error = await rejection;
    const evidence = readProviderTimingEvidence(error);
    expect(evidence).toMatchObject({
      deadlineOwner: 'verifier_transport',
      configuredTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      effectiveTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
    });
    expect(JSON.stringify(evidence)).not.toMatch(/api[_ -]?key|token|prompt|candidate|cv/i);
  });

  it('G. preserves validation rejection as generation_validation_failed', async () => {
    const value = manifest();
    const rejected = await executeExperienceV3GenerateServer({ manifest: value }, {
      generate: async () => writerJson(value),
      evaluate: async () => ({
        stopReason: 'tool_use',
        content: [{
          type: 'tool_use',
          name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
          input: {
            operationId: value.operationId,
            entryId: value.entryId,
            snapshotHash: value.snapshotHash,
            locale: value.locale,
            phases: {
              semantic: {
                status: 'failed',
                violations: [{ code: 'unsupported_claim', category: 'semantic', detail: 'unsupported claim' }],
              },
              language_quality: { status: 'passed', violations: [] },
            },
          },
        }],
      }),
    });
    expect(rejected.ok).toBe(false);
    expect(mapExperienceV3GenerateResultToErrorCode({
      kind: 'handled_failure',
      typedReason: 'validation_rejected',
      diagnostic: {
        providerErrorType: null,
        finalDecision: 'reject',
        routeHttpStatus: 422,
      },
    } as never)).toBe('generation_validation_failed');
  });

  it('H. successful Generate still reaches the accepted result boundary', async () => {
    const value = manifest();
    const result = await executeExperienceV3GenerateServer({ manifest: value }, {
      generate: async () => writerJson(value),
      evaluate: async () => evaluatorResponse(value),
    });
    expect(result).toMatchObject({ ok: true, action: EXPERIENCE_V3_GENERATE_ACTION });
  });

  it('routes both provider calls through the shared 15s transport options without retries', async () => {
    vi.useRealTimers();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    vi.stubEnv('AI_CORE_V3_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_AI_CORE_V3_ENABLED', '');
    vi.resetModules();
    const value = manifest();
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: writerJson(value) }] })
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: evaluatorResponse(value).content,
      });
    const { POST } = await import('@/app/api/generate/route');
    const response = await POST(makeRequest({ action: EXPERIENCE_V3_GENERATE_ACTION, manifest: value }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    expect(anthropicCreateMock.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ timeout: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, maxRetries: 0 }),
      expect.objectContaining({ timeout: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, maxRetries: 0 }),
    ]);
  });
});
