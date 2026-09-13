import { describe, expect, it, vi } from 'vitest';
import type { CVData } from '../../types';
import {
  captureSummaryV3GenerateOperationSnapshot,
  computeSummaryV3EvaluatorTimeoutMs,
  SUMMARY_V3_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_GENERATE_ACTION,
  SUMMARY_V3_INITIAL_EVALUATOR_HARD_MAX_MS,
  SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS,
  SUMMARY_V3_SERVER_BUDGET_MS,
  SUMMARY_V3_WRITER_TOOL_NAME,
  type SummaryV3Manifest,
} from '..';

const EVALUATOR_CHECKS = [
  'factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
  'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected',
  'targetLanguageAndScript', 'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense',
  'grammarAndClarity', 'duplicationAndDegradationAbsent', 'completeSummaryUsable',
] as const;

function testCv(): CVData {
  return {
    id: 'aab583-repair', name: 'AAB583 Repair',
    personal: { fullName: 'AAB583 Candidate', email: 'aab583@example.com', phone: '', address: '', jobTitle: 'Engineer', gender: 'female' },
    summary: '', contentLocale: 'en',
    experience: [{ id: 'aab583-current', company: 'Current Co', position: 'Engineer', startDate: '2023-02', endDate: '', isPresent: true,
      description: 'Designs reliable systems.' }],
    education: [], skills: ['TypeScript'], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
  };
}

function writerResponse(manifest: SummaryV3Manifest) {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_WRITER_TOOL_NAME, input: {
    operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
    units: [{ slot: 'duration', entryId: null, factIds: [], text: 'I have professional experience.' },
      ...manifest.selectedEntries.map((entry) => ({ slot: 'experience', entryId: entry.entryId,
        factIds: entry.facts.map((fact) => fact.factId), text: `I work as ${entry.roleTitle} at ${entry.employer}.` }))],
  } }] };
}

function evaluatorResponse(manifest: SummaryV3Manifest, rejected: boolean) {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_EVALUATOR_TOOL_NAME, input: {
    operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
    phases: {
      semantic: rejected ? { status: 'failed', violations: [{ code: 'repair_required', category: 'semantic', detail: 'bounded repair evidence' }] } : { status: 'passed', violations: [] },
      language_quality: rejected ? { status: 'failed', violations: [{ code: 'language_repair_required', category: 'language_quality', detail: 'bounded repair evidence' }] } : { status: 'passed', violations: [] },
    },
    checks: Object.fromEntries(EVALUATOR_CHECKS.map((check) => [check, !rejected])),
  } }] };
}

type RepairPathOptions = {
  readonly initialWriterDelayMs?: number;
  readonly initialEvaluatorDelayMs?: number;
  readonly repairWriterDelayMs?: number;
  readonly repairEvaluatorDelayMs?: number;
  readonly onPhaseStarted?: (phase: 'initial_writer' | 'initial_evaluator' | 'repair_writer' | 'post_repair_evaluator') => void;
};

async function runRepairPath(options: RepairPathOptions = {}) {
  const saved = {
    AI_CORE_V3_ENABLED: process.env.AI_CORE_V3_ENABLED,
    NEXT_PUBLIC_AI_CORE_V3_ENABLED: process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
  };
  const requests: Array<{ phase: string; timeout?: number; maxRetries?: number }> = [];
  let writerCalls = 0;
  let evaluatorCalls = 0;
  process.env.AI_CORE_V3_ENABLED = 'true';
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
  process.env.ANTHROPIC_API_KEY = 'aab583-test-key';
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  const manifest = captureSummaryV3GenerateOperationSnapshot({
    enabled: true, operationKind: 'summary_generate', operationId: 'aab583-operation', requestId: 'aab583-request',
    cv: testCv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
    referenceDateIso: '2026-09-13', jobContextHash: 'aab583-context', usageCountBefore: 6,
  }).manifest;
  try {
    vi.resetModules();
    const create = vi.fn(async (
      params: { tool_choice?: { name?: string } },
      requestOptions?: { timeout?: number; maxRetries?: number },
    ) => {
      const tool = params.tool_choice?.name;
      const phase = tool === SUMMARY_V3_WRITER_TOOL_NAME
        ? (writerCalls === 0 ? 'initial_writer' : 'repair_writer')
        : (evaluatorCalls === 0 ? 'initial_evaluator' : 'post_repair_evaluator');
      requests.push({ phase, timeout: requestOptions?.timeout, maxRetries: requestOptions?.maxRetries });
      options.onPhaseStarted?.(phase);
      const delayMs = phase === 'initial_writer' ? options.initialWriterDelayMs
        : phase === 'initial_evaluator' ? options.initialEvaluatorDelayMs
          : phase === 'repair_writer' ? options.repairWriterDelayMs : options.repairEvaluatorDelayMs;
      if (tool === SUMMARY_V3_WRITER_TOOL_NAME) writerCalls += 1;
      else evaluatorCalls += 1;
      if (delayMs && delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      if (tool === SUMMARY_V3_WRITER_TOOL_NAME) {
        return writerResponse(manifest);
      }
      return evaluatorResponse(manifest, evaluatorCalls === 1);
    });
    vi.doMock('@anthropic-ai/sdk', () => { class MockAnthropic { readonly messages = { create }; } return { default: MockAnthropic }; });
    vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => ({ subject: 'aab583' })) }));
    const { POST } = await import('@/app/api/generate/route');
    const request = new Request('http://localhost/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: SUMMARY_V3_GENERATE_ACTION, proToken: 'token', requestId: 'aab583-request', manifest }),
    });
    const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), requests, writerCalls, evaluatorCalls };
  } finally {
    vi.doUnmock('@anthropic-ai/sdk');
    vi.doUnmock('@/lib/pro-token');
    vi.resetModules();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key as keyof typeof saved];
      else process.env[key as keyof typeof saved] = value;
    }
  }
}

describe('M8 AAB583 Generate repair-path evaluator timeout ownership', () => {
  it('uses one evaluator authority and leaves the repair writer independently at 8000ms', () => {
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 24_409)).toBe(9_590);
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 0)).toBe(SUMMARY_V3_INITIAL_EVALUATOR_HARD_MAX_MS);
    expect(SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS).toBe(13_000);
  });

  it('accepts a physical-like repair path with an 8001ms post-repair evaluator', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const starts: string[] = [];
      const phaseResolvers = new Map<string, () => void>();
      const phasePromises = new Map(['initial_writer', 'initial_evaluator', 'repair_writer', 'post_repair_evaluator']
        .map((phase) => [phase, new Promise<void>((resolve) => { phaseResolvers.set(phase, resolve); })] as const));
      const pending = runRepairPath({
        initialWriterDelayMs: 12_000, initialEvaluatorDelayMs: 8_000, repairWriterDelayMs: 4_409, repairEvaluatorDelayMs: 8_001,
        onPhaseStarted: (phase) => { starts.push(`${phase}@${Date.now()}`); phaseResolvers.get(phase)?.(); },
      });
      await phasePromises.get('initial_writer');
      await vi.advanceTimersByTimeAsync(12_000);
      await phasePromises.get('initial_evaluator');
      await vi.advanceTimersByTimeAsync(8_000);
      await phasePromises.get('repair_writer');
      await vi.advanceTimersByTimeAsync(4_409);
      await phasePromises.get('post_repair_evaluator');
      await vi.advanceTimersByTimeAsync(8_001);
      const run = await pending;
      expect(run.response.status).toBe(200);
      expect(run.body).toMatchObject({ ok: true, repairAttempted: true });
      expect(starts.map((value) => value.split('@')[0])).toEqual(['initial_writer', 'initial_evaluator', 'repair_writer', 'post_repair_evaluator']);
      expect(run.requests.map((request) => request.timeout)).toEqual([13_000, 21_999, 8_000, 9_590]);
      expect(run.requests.every((request) => request.maxRetries === 0)).toBe(true);
      expect(run.writerCalls).toBe(2);
      expect(run.evaluatorCalls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a true post-repair overrun typed and side-effect free with one call and no retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const phaseResolvers = new Map<string, () => void>();
      const phasePromises = new Map(['initial_writer', 'initial_evaluator', 'repair_writer', 'post_repair_evaluator']
        .map((phase) => [phase, new Promise<void>((resolve) => { phaseResolvers.set(phase, resolve); })] as const));
      const pending = runRepairPath({
        initialWriterDelayMs: 12_000, initialEvaluatorDelayMs: 8_000, repairWriterDelayMs: 4_409, repairEvaluatorDelayMs: 9_591,
        onPhaseStarted: (phase) => { phaseResolvers.get(phase)?.(); },
      });
      await phasePromises.get('initial_writer');
      await vi.advanceTimersByTimeAsync(12_000);
      await phasePromises.get('initial_evaluator');
      await vi.advanceTimersByTimeAsync(8_000);
      await phasePromises.get('repair_writer');
      await vi.advanceTimersByTimeAsync(4_409);
      await phasePromises.get('post_repair_evaluator');
      await vi.advanceTimersByTimeAsync(9_591);
      const run = await pending;
      expect(run.response.status).toBe(502);
      expect(run.body).toMatchObject({ ok: false, typedReason: 'repair_validator_exception', repairAttempted: true,
        m4ProviderFailure: { phase: 'post_repair_evaluator', providerErrorType: 'timeout', providerDeadlineOwner: 'verifier_transport',
          providerConfiguredTimeoutMs: 9_590, providerEffectiveTimeoutMs: 9_590 } });
      expect(run.writerCalls).toBe(2);
      expect(run.evaluatorCalls).toBe(2);
      expect(run.requests.map((request) => request.timeout)).toEqual([13_000, 21_999, 8_000, 9_590]);
      expect(run.requests.every((request) => request.maxRetries === 0)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed without dispatch when the terminal reserve leaves no evaluator window', () => {
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 37_000)).toBeNull();
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 37_001)).toBeNull();
  });
});
