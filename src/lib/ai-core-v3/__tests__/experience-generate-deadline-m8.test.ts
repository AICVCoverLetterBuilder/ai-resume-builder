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
  runExperienceV3GenerateAdapter,
  type ExperienceV3AdapterInput,
} from '../experience-generate';
import {
  AI_PROVIDER_CALL_TIMEOUT_MS,
  EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS,
  EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
  EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS,
  callProviderWithDeadline,
  computeExperienceV3Deadline,
  computeExperienceV3EvaluatorTimeoutMs,
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

async function runCoreWithEvaluatorTimeout(writerDelayMs = 0) {
  const value = manifest();
  return executeExperienceV3GenerateServer({ manifest: value }, {
    generate: async () => new Promise<string>((resolve) => {
      setTimeout(() => resolve(writerJson(value)), writerDelayMs);
    }),
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

  it('uses a 15s writer cap and one shared 36s route budget for Generate and Enhance', () => {
    const route = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    expect(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS).toBe(15_000);
    expect(EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS).toBe(36_000);
    expect(EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS).toBe(30_000);
    expect(computeExperienceV3Deadline(START)).toBe(START + 36_000);
    expect(computeExperienceV3EnhanceDeadline(START)).toBe(computeExperienceV3Deadline(START));
    expect(route).toContain('deadlineAt = computeExperienceV3Deadline(serverReceivedAt)');
    const generateStart = route.indexOf("if (action === EXPERIENCE_V3_GENERATE_ACTION)");
    const generateEnd = route.indexOf("if (action === 'cover-letter')", generateStart);
    const generate = route.slice(generateStart, generateEnd);
    expect(generate).toMatch(/EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,\s*'provider'/u);
    expect(generate).toMatch(/computeExperienceV3EvaluatorTimeoutMs\(deadlineAt\),\s*'verifier'/u);
    expect(computeExperienceV3EvaluatorTimeoutMs(START + 36_000, START + 3_920)).toBe(26_080);
    expect(computeExperienceV3EvaluatorTimeoutMs(START + 36_000, START + 23_000)).toBe(7_000);
  });

  it('A. reproduces the old 18.92s timeout: a 3.92s writer followed by a fixed 15s evaluator cap', async () => {
    const pending = runCoreWithEvaluatorTimeout(3_920);
    await vi.advanceTimersByTimeAsync(18_920);
    const result = await pending;
    expect(Date.now() - START).toBe(18_920);
    expect(result).toMatchObject({ ok: false, typedReason: 'evaluator_timeout' });
    expect(mapExperienceV3GenerateResultToErrorCode({
      kind: 'handled_failure',
      typedReason: 'evaluator_timeout',
      diagnostic: {
        providerErrorType: 'timeout',
        finalDecision: 'transport_failure',
        routeHttpStatus: 504,
      },
    } as never)).toBe('request_timeout');
    const route = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    const generate = route.slice(
      route.indexOf("if (action === EXPERIENCE_V3_GENERATE_ACTION)"),
      route.indexOf("if (action === 'cover-letter')"),
    );
    expect(generate).toMatch(/result\.typedReason === 'writer_timeout' \|\| result\.typedReason === 'evaluator_timeout'[\s\S]*?\? 504/u);
  });

  it('B. lets a slow evaluator use unused writer time and complete within the unchanged parent deadline', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    vi.stubEnv('AI_CORE_V3_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'true');
    vi.resetModules();
    const value = manifest();
    anthropicCreateMock
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve({ content: [{ type: 'text', text: writerJson(value) }] }), 3_920);
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve({
          stop_reason: 'tool_use',
          content: evaluatorResponse(value).content,
        }), 18_000);
      }));
    const { POST } = await import('@/app/api/generate/route');
    const pending = POST(makeRequest({ action: EXPERIENCE_V3_GENERATE_ACTION, manifest: value }) as never);
    for (let turn = 0; turn < 20 && anthropicCreateMock.mock.calls.length < 1; turn += 1) {
      await Promise.resolve();
    }
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_920);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(18_000);
    const response = await pending;
    expect(Date.now() - START).toBe(21_920);
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
  });

  it('C. fails closed before the parent deadline when two individually-fast calls plus orchestration exceed 36s', async () => {
    const deadlineAt = START + EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS;
    const requests: number[] = [];
    const writer = callProviderWithDeadline(
      async () => new Promise<string>((resolve) => {
        requests.push(1);
        setTimeout(() => resolve('writer'), 14_000);
      }),
      deadlineAt,
      EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      'provider',
    );
    await vi.advanceTimersByTimeAsync(14_000);
    await expect(writer).resolves.toBe('writer');
    vi.setSystemTime(START + 23_000); // 9s synthetic orchestration / validation before evaluator dispatch.
    const evaluator = callProviderWithDeadline(
      async () => new Promise<string>((resolve) => {
        requests.push(2);
        setTimeout(() => resolve('evaluator'), 14_000);
      }),
      deadlineAt,
      computeExperienceV3EvaluatorTimeoutMs(deadlineAt),
      'verifier',
    );
    const terminal = evaluator.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(7_000);
    const error = await terminal;
    expect(requests).toEqual([1, 2]);
    expect(error).toMatchObject({
      deadlineOwner: 'verifier_transport',
      configuredTimeoutMs: 7_000,
      effectiveTimeoutMs: 7_000,
    });
    expect(Date.now() - START).toBe(30_000);
    expect(Date.now()).toBeLessThan(deadlineAt);
    await vi.advanceTimersByTimeAsync(7_000); // The second mocked provider response arrives after the timeout.
    expect(requests).toEqual([1, 2]);
  });

  it('D. maps the bounded evaluator timeout to HTTP 504 while remaining below Vercel maxDuration', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    vi.stubEnv('AI_CORE_V3_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'true');
    vi.resetModules();
    const value = manifest();
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: writerJson(value) }] })
      .mockImplementationOnce(() => new Promise(() => undefined));
    const { POST, maxDuration } = await import('@/app/api/generate/route');
    const pending = POST(makeRequest({ action: EXPERIENCE_V3_GENERATE_ACTION, manifest: value }) as never);
    for (let turn = 0; turn < 20 && anthropicCreateMock.mock.calls.length < 2; turn += 1) {
      await Promise.resolve();
    }
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS);
    const response = await pending;
    expect(maxDuration).toBe(90);
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ ok: false, typedReason: 'evaluator_timeout' });
    expect(Date.now() - START).toBe(EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS);
    expect(Date.now() - START).toBeLessThan(maxDuration * 1_000);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
  });

  it('E. retires the old 8000ms writer boundary while the same 8001ms call succeeds at 15s', async () => {
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

  it('F. retires the old 8000ms evaluator boundary while the same 8001ms call succeeds at 15s', async () => {
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

  it('G. maps a provider call beyond the 15s writer cap to a timeout owned by the provider stage', async () => {
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

  it('H. evaluator timeout remains terminal, observable, and fail closed after a valid writer', async () => {
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

  it('I. keeps timeout timing evidence finite and free of raw provider details', async () => {
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

  it('J. preserves validation rejection as generation_validation_failed', async () => {
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

  it('K. successful Generate still reaches the accepted result boundary', async () => {
    const value = manifest();
    const result = await executeExperienceV3GenerateServer({ manifest: value }, {
      generate: async () => writerJson(value),
      evaluate: async () => evaluatorResponse(value),
    });
    expect(result).toMatchObject({ ok: true, action: EXPERIENCE_V3_GENERATE_ACTION });
  });

  it('L. does not apply timed-out content or increment usage', async () => {
    const cv = {
      id: 'synthetic-cv',
      name: 'Synthetic',
      personal: { fullName: 'Synthetic', email: '', phone: '', address: '', jobTitle: 'Support Specialist' },
      summary: '',
      contentLocale: 'en',
      experience: [{
        id: 'entry-deadline',
        company: 'Example Company',
        position: 'Support Specialist',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: '',
      }],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      templateId: 'modern-minimal',
      region: 'EU',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as unknown as ExperienceV3AdapterInput['cv'];
    const input: ExperienceV3AdapterInput = {
      enabled: true,
      operationKind: 'experience_generate',
      operationId: 'synthetic-timeout-operation',
      entryId: 'entry-deadline',
      entryIndexDiagnostic: 0,
      cv,
      industry: 'customer-service',
      level: 'mid',
      gender: 'prefer_not_to_say',
      requestedLocale: 'en',
      uiLocale: 'en',
      storedContentLocale: 'en',
      exactVisibleDescription: '',
      usageCountBefore: 4,
    };
    const getLiveState = vi.fn(() => ({
      cv,
      requestedLocale: 'en',
      uiLocale: 'en',
      storedContentLocale: 'en',
      exactVisibleDescription: '',
      industry: 'customer-service',
      level: 'mid',
    }));
    const writeCv = vi.fn();
    const persistCv = vi.fn(() => true);
    const incrementUsage = vi.fn();
    const result = await runExperienceV3GenerateAdapter(input, {
      request: async () => ({ ok: false, typedReason: 'evaluator_timeout' }),
      getLiveState,
      writeCv,
      persistCv,
      incrementUsage,
      getUsageCount: () => 4,
      getRouteHttpStatus: () => 504,
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'evaluator_timeout',
      diagnostic: {
        routeHttpStatus: 504,
        usageBefore: 4,
        usageAfter: 4,
        usageDelta: 0,
        applyCommitted: false,
      },
    });
    expect(writeCv).not.toHaveBeenCalled();
    expect(persistCv).not.toHaveBeenCalled();
    expect(incrementUsage).not.toHaveBeenCalled();
  });

  it('routes both provider calls with bounded evaluator time and no SDK retries', async () => {
    vi.useRealTimers();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    vi.stubEnv('AI_CORE_V3_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'true');
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
    const options = anthropicCreateMock.mock.calls.map((call) => call[1]);
    expect(options[0]).toMatchObject({ timeout: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, maxRetries: 0 });
    expect(options[1]?.timeout).toBeGreaterThan(0);
    expect(options[1]?.timeout).toBeLessThanOrEqual(EXPERIENCE_V3_EVALUATOR_MAX_TIMEOUT_MS);
    expect(options[1]?.maxRetries).toBe(0);
  });
});
