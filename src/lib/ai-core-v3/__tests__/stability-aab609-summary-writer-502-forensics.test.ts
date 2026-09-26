import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '../../types';
import {
  SUMMARY_V3_GENERATE_ACTION,
  SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS,
  SUMMARY_V3_WRITER_TOOL_NAME,
  SUMMARY_V3_EVALUATOR_TOOL_NAME,
  captureSummaryV3GenerateOperationSnapshot,
  type SummaryV3Manifest,
} from '..';

const providerCreate = vi.hoisted(() => vi.fn());
const verifyProToken = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    readonly messages = { create: providerCreate };
  }
  return { default: MockAnthropic };
});

vi.mock('@/lib/pro-token', () => ({ verifyProToken }));

type FailureKind = 'network' | 'provider_503' | 'sdk_timeout' | 'application_abort' | 'unknown' | null;

let activeManifest: SummaryV3Manifest;
let failureKind: FailureKind;
let writerDelayMs: number;
let routeEntryElapsedMs: number;
let writerStarted: (() => void) | null;
let writerCalls: number;
let evaluatorCalls: number;

const sdkErrorClasses = {
  APIConnectionError: class APIConnectionError {},
  APIConnectionTimeoutError: class APIConnectionTimeoutError {},
  APIUserAbortError: class APIUserAbortError {},
} as const;

function sdkNamedError(
  className: keyof typeof sdkErrorClasses,
  message: string,
): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'constructor', {
    value: sdkErrorClasses[className],
    enumerable: false,
  });
  return error;
}

function cv(): CVData {
  return {
    id: 'aab609-forensics',
    name: 'AAB609 Forensics',
    personal: { fullName: 'Test Candidate', email: 'test@example.com', phone: '', address: '', jobTitle: 'Engineer', gender: 'female' },
    summary: '',
    contentLocale: 'en',
    experience: [{
      id: 'current-entry', company: 'Test Company', position: 'Engineer', startDate: '2024-01', endDate: '',
      isPresent: true, description: 'Designs systems.',
    }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
  };
}

function writerResponse(manifest: SummaryV3Manifest) {
  return {
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: SUMMARY_V3_WRITER_TOOL_NAME,
      input: {
        operationId: manifest.operationId,
        snapshotHash: manifest.sourceSnapshotHash,
        locale: manifest.targetLocale,
        units: [
          { slot: 'duration', entryId: null, factIds: [], text: 'I have professional experience.' },
          ...manifest.selectedEntries.map((entry) => ({
            slot: 'experience',
            entryId: entry.entryId,
            factIds: entry.facts.map((fact) => fact.factId),
            text: `I work as ${entry.roleTitle} at ${entry.employer}.`,
          })),
        ],
      },
    }],
  };
}

const evaluatorChecks = [
  'factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
  'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected',
  'targetLanguageAndScript', 'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense',
  'grammarAndClarity', 'duplicationAndDegradationAbsent', 'completeSummaryUsable',
] as const;

function evaluatorResponse(manifest: SummaryV3Manifest) {
  return {
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: SUMMARY_V3_EVALUATOR_TOOL_NAME,
      input: {
        operationId: manifest.operationId,
        snapshotHash: manifest.sourceSnapshotHash,
        locale: manifest.targetLocale,
        phases: {
          semantic: { status: 'passed', violations: [] },
          language_quality: { status: 'passed', violations: [] },
        },
        checks: Object.fromEntries(evaluatorChecks.map((check) => [check, true])),
      },
    }],
  };
}

async function runRoute() {
  const terminalEvents: Array<Record<string, unknown>> = [];
  const consoleSpy = vi.spyOn(console, 'info').mockImplementation((message: unknown) => {
    if (typeof message !== 'string') return;
    try {
      const parsed = JSON.parse(message) as Record<string, unknown>;
      if (parsed.event === 'summary_v3_terminal') terminalEvents.push(parsed);
    } catch {
      // Other console messages are outside this focused terminal assertion.
    }
  });
  activeManifest = captureSummaryV3GenerateOperationSnapshot({
    enabled: true,
    operationKind: 'summary_generate',
    operationId: 'aab609-forensics-operation',
    requestId: 'aab609-forensics-request',
    cv: cv(),
    requestedLocale: 'en',
    uiLocale: 'en',
    storedContentLocale: 'en',
    exactVisibleSummary: '',
    referenceDateIso: '2026-09-26',
    jobContextHash: 'aab609-forensics-context',
    usageCountBefore: 0,
  }).manifest;
  const request = new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: SUMMARY_V3_GENERATE_ACTION,
      proToken: 'deterministic-token',
      requestId: 'aab609-forensics-request',
      manifest: activeManifest,
    }),
  });
  try {
    const { POST } = await import('@/app/api/generate/route');
    const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), terminalEvents };
  } finally {
    consoleSpy.mockRestore();
  }
}

function expectInitialWriterFailure(
  run: Awaited<ReturnType<typeof runRoute>>,
  expected: {
    providerErrorType: string | null;
    timeoutPhase: 'initial_writer' | null;
    providerDeadlineOwner?: string | null;
    providerResponseReceived?: boolean | null;
    providerCalls: number;
    transportTerminationKind: string;
  },
): void {
  expect(run.response.status).toBe(502);
  expect(writerCalls).toBe(expected.providerCalls);
  expect(evaluatorCalls).toBe(0);
  expect(run.body).toMatchObject({
    ok: false,
    typedReason: 'provider_request_failed',
    m4ProviderFailure: {
      phase: 'initial_writer',
      failureStage: 'sdk_request',
      providerErrorType: expected.providerErrorType,
      providerDeadlineOwner: expected.providerDeadlineOwner ?? null,
      providerHttpResponseReceived: expected.providerResponseReceived ?? null,
    },
    repairAttempted: false,
  });
  expect(run.terminalEvents).toEqual([expect.objectContaining({
    httpStatus: 502,
    phase: 'initial_writer',
    typedFailureCode: 'provider_request_failed',
    failureFamily: 'provider_transport',
    timeoutPhase: expected.timeoutPhase,
    transportTerminationKind: expected.transportTerminationKind,
    writerReached: true,
    evaluatorReached: false,
    validatorReached: false,
    finalizerReached: false,
    usageCommitted: false,
  })]);
}

beforeEach(() => {
  process.env.AI_CORE_V3_ENABLED = 'true';
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
  process.env.ANTHROPIC_API_KEY = 'deterministic-test-key';
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  failureKind = null;
  writerDelayMs = 0;
  routeEntryElapsedMs = 0;
  writerStarted = null;
  writerCalls = 0;
  evaluatorCalls = 0;
  verifyProToken.mockReset().mockImplementation(async () => {
    if (routeEntryElapsedMs) vi.setSystemTime(Date.now() + routeEntryElapsedMs);
    return { subject: 'aab609-forensics' };
  });
  providerCreate.mockReset().mockImplementation(async (
    params: { tool_choice?: { name?: string } },
  ) => {
    if (params.tool_choice?.name === SUMMARY_V3_WRITER_TOOL_NAME) {
      writerCalls += 1;
      writerStarted?.();
      if (writerDelayMs) await new Promise((resolve) => setTimeout(resolve, writerDelayMs));
      if (failureKind === 'network') throw sdkNamedError('APIConnectionError', 'deterministic network failure');
      if (failureKind === 'provider_503') {
        const error = new Error('deterministic provider 503') as Error & Record<string, unknown>;
        error.status = 503;
        error.error = { code: 'overloaded_error' };
        throw error;
      }
      if (failureKind === 'sdk_timeout') throw sdkNamedError('APIConnectionTimeoutError', 'deterministic SDK timeout');
      if (failureKind === 'application_abort') throw sdkNamedError('APIUserAbortError', 'deterministic application abort');
      if (failureKind === 'unknown') throw new Error('PRIVATE_SENTINEL_PROMPT_RESPONSE_CV_STACK');
      return writerResponse(activeManifest);
    }
    evaluatorCalls += 1;
    return evaluatorResponse(activeManifest);
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.AI_CORE_V3_ENABLED;
  delete process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});

describe('AAB609 Summary V3 initial-writer 502 forensic matrix', () => {
  it('A. succeeds before the writer deadline and reaches the evaluator once', async () => {
    const run = await runRoute();
    expect(run.response.status).toBe(200);
    expect(writerCalls).toBe(1);
    expect(evaluatorCalls).toBe(1);
    expect(run.body).toMatchObject({ ok: true, repairAttempted: false });
    expect(run.terminalEvents).toHaveLength(0);
  });

  it('B. maps application writer deadline expiry to the accepted physical 502 shape', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    writerDelayMs = SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS + 1;
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    writerStarted = started;
    const pending = runRoute();
    await startedPromise;
    await vi.advanceTimersByTimeAsync(writerDelayMs);
    const run = await pending;
    expectInitialWriterFailure(run, {
      providerErrorType: 'timeout',
      timeoutPhase: 'initial_writer',
      providerDeadlineOwner: 'provider_transport',
      providerCalls: 1,
      transportTerminationKind: 'application_slice_timeout',
    });
    expect(run.body.m4ProviderFailure).toMatchObject({
      providerConfiguredTimeoutMs: 13_000,
      providerEffectiveTimeoutMs: 13_000,
    });
  });

  it('C. keeps a network exception distinct from the physical timeout class', async () => {
    failureKind = 'network';
    const run = await runRoute();
    expectInitialWriterFailure(run, {
      providerErrorType: 'connection/network',
      timeoutPhase: null,
      providerCalls: 1,
      transportTerminationKind: 'network_error',
    });
  });

  it('D. keeps provider HTTP 503 distinct and proves that a response existed', async () => {
    failureKind = 'provider_503';
    const run = await runRoute();
    expectInitialWriterFailure(run, {
      providerErrorType: 'provider_5xx',
      timeoutPhase: null,
      providerResponseReceived: true,
      providerCalls: 1,
      transportTerminationKind: 'provider_http_error',
    });
  });

  it('E. attributes an SDK abort as client_abort without changing the 502 boundary', async () => {
    failureKind = 'application_abort';
    const run = await runRoute();
    expectInitialWriterFailure(run, {
      providerErrorType: 'timeout',
      timeoutPhase: 'initial_writer',
      providerCalls: 1,
      transportTerminationKind: 'client_abort',
    });
  });

  it('F. attributes route-budget exhaustion without dispatch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    routeEntryElapsedMs = 45_000;
    const run = await runRoute();
    expectInitialWriterFailure(run, {
      providerErrorType: 'timeout',
      timeoutPhase: 'initial_writer',
      providerDeadlineOwner: 'route_deadline',
      providerCalls: 0,
      transportTerminationKind: 'route_budget_timeout',
    });
  });

  it('G. distinguishes SDK timeout from application slice expiry', async () => {
    failureKind = 'sdk_timeout';
    const run = await runRoute();
    expectInitialWriterFailure(run, {
      providerErrorType: 'timeout',
      timeoutPhase: 'initial_writer',
      providerCalls: 1,
      transportTerminationKind: 'sdk_timeout',
    });
  });

  it('H. maps unclassified transport termination to unknown without leaking private error material', async () => {
    failureKind = 'unknown';
    const run = await runRoute();
    expectInitialWriterFailure(run, {
      providerErrorType: null,
      timeoutPhase: null,
      providerCalls: 1,
      transportTerminationKind: 'unknown',
    });
    expect(JSON.stringify(run.terminalEvents[0])).not.toContain('PRIVATE_SENTINEL');
    expect(JSON.stringify(run.terminalEvents[0])).not.toContain('PROMPT_RESPONSE_CV_STACK');
  });
});
