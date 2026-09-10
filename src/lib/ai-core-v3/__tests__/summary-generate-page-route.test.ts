/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations, type Locale } from '../../i18n/translations';
import type { CVData } from '../../types';
import { SUMMARY_AI_DIAG_STORAGE_KEY } from '../../cv-summary-ai-diagnostics';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import {
  AI_CLIENT_TIMEOUT_MS,
  AI_PLATFORM_MAX_DURATION_S,
  AI_PROVIDER_CALL_TIMEOUT_MS,
  SUMMARY_V3_M4_CLIENT_TIMEOUT_MS,
  callProviderWithDeadline,
} from '../../ai-request-timing';
import {
  SUMMARY_V3_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_GENERATE_ACTION,
  SUMMARY_V3_WRITER_TOOL,
  SUMMARY_V3_WRITER_TOOL_NAME,
  SUMMARY_V3_WRITER_UNIT_CONTRACT,
  SUMMARY_V3_INITIAL_EVALUATOR_TIMEOUT_MS,
  SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS,
  SUMMARY_V3_POST_PROCESSING_HEADROOM_MS,
  SUMMARY_V3_ROUTE_MAX_DURATION_S,
  SUMMARY_V3_SERVER_BUDGET_MS,
  computeSummaryV3ServerDeadline,
  captureSummaryV3GenerateOperationSnapshot,
  classifySummaryV3GenerateRouting,
  hashSummaryV3Value,
  type SummaryV3GenerateAdapterDependencies,
  type SummaryV3GenerateAdapterInput,
  type SummaryV3Manifest,
} from '..';
import { SUMMARY_V3_STYLE_M5_ROUTE_MAX_DURATION_S } from '../summary-style-m5-timeout-policy';

const m4Adapter = vi.hoisted(() => vi.fn());
const m2Adapter = vi.hoisted(() => vi.fn());
const m3Adapter = vi.hoisted(() => vi.fn());
const legacyRequest = vi.hoisted(() => vi.fn());
const usageIncrement = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
let testLocale: Locale = 'en';
let runtimeCv: CVData;
let writes: CVData[] = [];
let persistenceSucceeds = true;
let usageAccountingSucceeds = true;
let usageFailureMode: 'verified_rollback' | 'rollback_failed' | null = null;

function pageCv(summary = '', contentLocale: Locale = 'en'): CVData {
  return {
    id: 'm4-page-cv', name: 'M4 Page CV',
    personal: { fullName: 'Page Candidate', email: 'page@example.com', phone: '', address: '', jobTitle: 'Engineer', gender: 'female' },
    summary, contentLocale,
    experience: [
      { id: 'page-prior', company: 'Prior Co', position: 'Analyst', startDate: '2020-01', endDate: '2023-01', isPresent: false,
        description: 'Analyzed operational records.' },
      { id: 'page-current', company: 'Current Co', position: 'Engineer', startDate: '2023-02', endDate: '', isPresent: true,
        description: 'Designs reliable systems.' },
    ],
    education: [], skills: ['TypeScript'], certifications: [], languages: [{ name: 'English', level: 'fluent' }],
    templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
  };
}

function validForcedWriterResponse(manifest: SummaryV3Manifest) {
  return { stop_reason: 'tool_use', content: [{
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
  }] };
}

const summaryEvaluatorChecks = [
  'factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
  'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected', 'targetLanguageAndScript',
  'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense', 'grammarAndClarity',
  'duplicationAndDegradationAbsent', 'completeSummaryUsable',
] as const;

function validForcedEvaluatorResponse(manifest: SummaryV3Manifest, rejected = false) {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_EVALUATOR_TOOL_NAME, input: {
    operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
    phases: { semantic: rejected
      ? { status: 'failed', violations: [{ code: 'repair_required', category: 'semantic', detail: 'bounded repair evidence' }] }
      : { status: 'passed', violations: [] }, language_quality: { status: 'passed', violations: [] } },
    checks: Object.fromEntries(summaryEvaluatorChecks.map((check) => [check, !rejected])),
  } }] };
}

function installMocks(): void {
  vi.doMock('@/lib/ai-core-v3', async () => {
    const actual = await vi.importActual<typeof import('..')>('@/lib/ai-core-v3');
    return { ...actual, runSummaryV3GenerateAdapter: m4Adapter,
      runExperienceV3GenerateAdapter: m2Adapter, runExperienceV3EnhanceAdapter: m3Adapter };
  });
  vi.doMock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale: testLocale, t: translations[testLocale] }) }));
  vi.doMock('@/lib/store', () => ({
    checkProAccess: () => 'allowed',
    useApp: () => {
      const commitProAiSuccess = () => {
        if (usageFailureMode === 'verified_rollback') {
          usageIncrement();
          return { ok: false as const, attempted: true as const, before: 5, after: 5, delta: 0 as const,
            forwardWriteResult: 'succeeded' as const, verificationResult: 'unknown' as const,
            rollbackAttempted: true as const, rollbackResult: 'succeeded' as const,
            record: { count: 5, windowStart: 0, schemaVersion: 2, policyLimit: 50 }, reason: 'usage_verification_failed' as const };
        }
        if (usageFailureMode === 'rollback_failed') {
          usageIncrement();
          return { ok: false as const, attempted: true as const, before: 5, after: 6, delta: 1 as const,
            forwardWriteResult: 'succeeded' as const, verificationResult: 'unknown' as const,
            rollbackAttempted: true as const, rollbackResult: 'failed' as const,
            record: { count: 6, windowStart: 0, schemaVersion: 2, policyLimit: 50 }, reason: 'usage_rollback_failed' as const };
        }
        if (!usageAccountingSucceeds) {
          return { ok: false as const, attempted: false as const, before: 5, after: 5, delta: 0 as const,
            forwardWriteResult: 'not_attempted' as const, verificationResult: 'not_attempted' as const,
            rollbackAttempted: false as const, rollbackResult: 'not_required' as const,
            record: { count: 5, windowStart: 0, schemaVersion: 2, policyLimit: 50 }, reason: 'ai_gate_not_ready' as const };
        }
        usageIncrement();
        return { ok: true as const, attempted: true as const, before: 5, after: 6, delta: 1 as const,
          forwardWriteResult: 'succeeded' as const, verificationResult: 'passed' as const,
          rollbackAttempted: false as const, rollbackResult: 'not_required' as const,
          record: { count: 6, windowStart: 0, schemaVersion: 2, policyLimit: 50 } };
      };
      return ({
      currentCv: runtimeCv,
      setCurrentCv: (next: CVData) => { runtimeCv = next; writes.push(next); },
      persistCurrentCvTransactionally: (next: CVData) => {
        if (!persistenceSucceeds) return false;
        runtimeCv = next; writes.push(next); return true;
      },
      isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(),
      recordProAiSuccess: () => { void commitProAiSuccess(); },
      commitProAiSuccess, getProAiUsageCount: () => 5, lastCvSavedAt: 0,
      getAiGate: () => ({ status: 'ready', token: 'm4-page-token' }),
      });
    },
  }));
  vi.doMock('@/lib/api', async () => {
    const actual = await vi.importActual<typeof import('../../api')>('@/lib/api');
    return { ...actual, apiFetch: legacyRequest };
  });
  vi.doMock('@/components/Header', () => ({ default: () => null }));
  vi.doMock('@/components/Footer', () => ({ default: () => null }));
  vi.doMock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
}

type AdapterKind = 'handled_failure' | 'handled_success' | 'not_applicable';

type ClientAbortSpy = {
  mock: { calls: [AbortController, number][] };
  mockRestore: () => void;
};

type ClientTimerClearSpy = {
  mock: { calls: [ReturnType<typeof setTimeout>][] };
  mockRestore: () => void;
};

async function actualGeneralSummaryFlow(options: {
  enabled?: boolean; kind?: AdapterKind; summary?: string; locale?: Locale; contentLocale?: Locale; experienceDescription?: string;
  noCurrentRole?: boolean; captureClientTimer?: boolean; persist?: boolean; usageFailure?: boolean;
  usageFailureMode?: 'verified_rollback' | 'rollback_failed';
} = {}) {
  const environmentKeys = ['NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'AI_CORE_V3_ENABLED'] as const;
  const saved = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  const scroll = HTMLElement.prototype.scrollIntoView;
  cleanup(); localStorage.clear(); sessionStorage.clear();
  testLocale = options.locale ?? 'en'; runtimeCv = pageCv(options.summary ?? '', options.contentLocale ?? 'en'); writes = [];
  persistenceSucceeds = options.persist !== false;
  usageAccountingSucceeds = options.usageFailure !== true;
  usageFailureMode = options.usageFailureMode ?? null;
  if (options.experienceDescription) {
    runtimeCv = {
      ...runtimeCv,
      experience: runtimeCv.experience.map((entry) => ({ ...entry, description: options.experienceDescription! })),
    };
  }
  if (options.noCurrentRole) {
    runtimeCv = {
      ...runtimeCv,
      experience: runtimeCv.experience.map((entry) => ({ ...entry, isPresent: false, endDate: entry.endDate || '2024-01' })),
    };
  }
  const kind = options.kind ?? 'handled_failure';
  let toastSawSummaryRecord = false;
  m4Adapter.mockReset().mockImplementation(async (
    adapterInput: SummaryV3GenerateAdapterInput,
    dependencies: SummaryV3GenerateAdapterDependencies,
  ) => {
    if (kind === 'handled_success') {
      const previous = runtimeCv;
      const candidate = 'M4 generated summary.';
      const next = {
        ...previous,
        summary: candidate,
        summaryOrigin: 'ai_generated' as const,
        summaryGeneratedLocale: adapterInput.requestedLocale as Locale,
        summarySourceLocale: adapterInput.requestedLocale,
        summarySourceLocaleTextHash: hashSummarySourceLocaleText(candidate),
        summaryGenerationContextKey: adapterInput.jobContextHash,
      };
      const receipt = dependencies.commitCandidate({
        operationId: adapterInput.operationId,
        requestId: adapterInput.requestId,
        previousCvHash: hashSummaryV3Value(previous),
        candidateHash: hashSummaryV3Value(candidate),
        requestedLocale: adapterInput.requestedLocale,
        usageCountBefore: adapterInput.usageCountBefore,
        previousCv: previous,
        nextCv: next,
      });
      return receipt.kind === 'committed'
        ? { kind }
        : { kind: 'handled_failure', typedReason: receipt.reason };
    }
    return kind === 'handled_failure' ? { kind, typedReason: 'page_m4_rejected' } : { kind };
  });
  m2Adapter.mockReset().mockResolvedValue({ kind: 'not_applicable' });
  m3Adapter.mockReset().mockResolvedValue({ kind: 'not_applicable' });
  legacyRequest.mockReset().mockResolvedValue({
    data: { error: 'legacy_v2_positive_control', code: 'provider_temporarily_unavailable' },
    response: { ok: false, status: 502, headers: { get: () => null } },
  });
  usageIncrement.mockReset(); toastSuccess.mockReset(); toastError.mockReset();
  toastError.mockImplementation(() => {
    toastSawSummaryRecord = Boolean(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY));
  });
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = options.enabled === false ? 'false' : 'true';
  process.env.AI_CORE_V3_ENABLED = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.resetModules(); installMocks();
  let scheduleClientAbortSpy: ClientAbortSpy | undefined;
  let clearTimeoutSpy: ClientTimerClearSpy | undefined;
  const clientTimerHandle = {} as ReturnType<typeof setTimeout>;
  try {
    const core = await import('..'); core.resetAiCoreV3TestOverride();
    if (options.captureClientTimer) {
      const timing = await import('@/lib/ai-request-timing');
      scheduleClientAbortSpy = vi.spyOn(timing, 'scheduleClientAbort')
        .mockReturnValue(clientTimerHandle) as unknown as ClientAbortSpy;
      clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout') as unknown as ClientTimerClearSpy;
    }
    const Page = (await import('@/app/cv-builder/page')).default;
    render(React.createElement(Page));
    fireEvent.click(screen.getByRole('button', { name: translations[testLocale].cv.summary }));
    const editor = document.querySelector('[data-summary-v3-editor]') as HTMLTextAreaElement;
    expect(editor).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations[testLocale].cv.generate, 'i') }));
    if (options.enabled === false || kind === 'not_applicable') {
      await waitFor(() => expect(legacyRequest).toHaveBeenCalled());
    } else {
      await waitFor(() => expect(m4Adapter).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(
        kind === 'handled_success' && options.persist !== false && options.usageFailure !== true && !options.usageFailureMode
          ? toastSuccess
          : toastError,
      ).toHaveBeenCalled());
    }
    return {
      adapterCalls: m4Adapter.mock.calls.length,
      adapterInput: m4Adapter.mock.calls[0]?.[0] as SummaryV3GenerateAdapterInput | undefined,
      legacyCalls: legacyRequest.mock.calls.length,
      usageCalls: usageIncrement.mock.calls.length,
      writes: writes.length,
      visible: editor.value,
      toastSawSummaryRecord,
      toastSuccessCalls: toastSuccess.mock.calls.length,
      toastErrorCalls: toastError.mock.calls.length,
      terminalTrace: JSON.parse(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY) || 'null'),
      scheduleClientAbortCalls: scheduleClientAbortSpy?.mock.calls.length ?? 0,
      scheduledClientTimeoutMs: scheduleClientAbortSpy?.mock.calls[0]?.[1] as number | undefined,
      scheduledController: scheduleClientAbortSpy?.mock.calls[0]?.[0],
      clientTimerCleanupCalls: clearTimeoutSpy?.mock.calls
        .filter(([handle]) => handle === clientTimerHandle).length ?? 0,
    };
  } finally {
    scheduleClientAbortSpy?.mockRestore();
    clearTimeoutSpy?.mockRestore();
    cleanup();
    const core = await import('..'); core.resetAiCoreV3TestOverride();
    for (const key of environmentKeys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
    if (scroll === undefined) delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    else Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    vi.doUnmock('@/lib/ai-core-v3'); vi.doUnmock('@/lib/i18n/context'); vi.doUnmock('@/lib/store');
    vi.doUnmock('@/lib/api'); vi.doUnmock('@/components/Header'); vi.doUnmock('@/components/Footer'); vi.doUnmock('sonner');
    usageAccountingSucceeds = true;
    usageFailureMode = null;
    vi.clearAllMocks(); vi.resetModules(); localStorage.clear(); sessionStorage.clear();
  }
}

function expectOneClientTimer(
  run: Awaited<ReturnType<typeof actualGeneralSummaryFlow>>,
  timeoutMs: number,
): void {
  expect(run.scheduleClientAbortCalls).toBe(1);
  expect(run.scheduledController).toBeInstanceOf(AbortController);
  expect(run.scheduledClientTimeoutMs).toBe(timeoutMs);
  expect(run.clientTimerCleanupCalls).toBe(1);
}

async function actualStyleFlow(style: 'shorter' | 'stronger' | 'professional') {
  cleanup(); localStorage.clear(); sessionStorage.clear(); testLocale = 'en'; runtimeCv = pageCv('Existing Summary.'); writes = [];
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  m4Adapter.mockReset(); m2Adapter.mockReset(); m3Adapter.mockReset(); usageIncrement.mockReset();
  legacyRequest.mockReset().mockResolvedValue({ data: { error: 'style_v2_control' }, response: { ok: false, status: 502, headers: { get: () => null } } });
  vi.resetModules(); installMocks();
  const Page = (await import('@/app/cv-builder/page')).default; render(React.createElement(Page));
  fireEvent.click(screen.getByRole('button', { name: translations.en.cv.summary }));
  const label = style === 'shorter' ? translations.en.cv.short : style === 'stronger' ? translations.en.cv.strong : translations.en.cv.professional;
  const subtitle = style === 'shorter' ? translations.en.cv.shorterSubtext
    : style === 'stronger' ? translations.en.cv.strongerSubtext : translations.en.cv.professionalSubtext;
  const styleButton = screen.getAllByRole('button').find((button) => button.textContent?.includes(subtitle));
  expect(styleButton).toBeDefined();
  fireEvent.click(styleButton!);
  await waitFor(() => expect(legacyRequest).toHaveBeenCalled());
  return { adapterCalls: m4Adapter.mock.calls.length, legacyCalls: legacyRequest.mock.calls.length };
}

async function disabledDirectRoute() {
  const keys = ['AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const writer = vi.fn(() => { throw new Error('writer disabled'); });
  const evaluator = vi.fn(() => { throw new Error('evaluator disabled'); });
  const create = vi.fn((params: { system?: unknown }) => String(params.system).includes('prose writer') ? writer() : evaluator());
  try {
    process.env.AI_CORE_V3_ENABLED = 'false'; process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'false';
    process.env.ANTHROPIC_API_KEY = 'm4-disabled-key'; delete process.env.ANTHROPIC_AUTH_TOKEN;
    vi.resetModules();
    vi.doMock('@anthropic-ai/sdk', () => { class MockAnthropic { readonly messages = { create }; } return { default: MockAnthropic }; });
    vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => ({ subject: 'm4' })) }));
    const core = await import('..'); core.resetAiCoreV3TestOverride();
    const manifest = captureSummaryV3GenerateOperationSnapshot({
      enabled: true, operationKind: 'summary_generate', operationId: 'route-m4', requestId: 'route-m4', cv: pageCv(),
      requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
      referenceDateIso: '2026-08-28', jobContextHash: 'route-context', usageCountBefore: 0,
    }).manifest;
    const request = new Request('http://localhost/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: SUMMARY_V3_GENERATE_ACTION, proToken: 'token', requestId: 'route-m4', manifest }) });
    const { POST } = await import('@/app/api/generate/route'); const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), writer, evaluator, create };
  } finally {
    vi.restoreAllMocks(); vi.doUnmock('@anthropic-ai/sdk'); vi.doUnmock('@/lib/pro-token'); vi.resetModules();
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

async function forcedToolDirectRoute(options: {
  malformedWriter?: boolean;
  transportFailure?: boolean;
  forceRepair?: boolean;
  routeEntryElapsedMs?: number;
  initialWriterDelayMs?: number;
  initialEvaluatorDelayMs?: number;
  onInitialWriterStarted?: () => void;
  onInitialEvaluatorStarted?: () => void;
} = {}) {
  const keys = ['AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const requests: Array<{
    tools?: unknown[];
    tool_choice?: unknown;
    system?: unknown;
    messages?: Array<{ role?: string; content?: unknown }>;
    requestOptions?: { timeout?: number; maxRetries?: number; signal?: AbortSignal };
  }> = [];
  let writerCalls = 0;
  let evaluatorCalls = 0;
  try {
    process.env.AI_CORE_V3_ENABLED = 'true'; process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
    process.env.ANTHROPIC_API_KEY = 'm4-route-key'; delete process.env.ANTHROPIC_AUTH_TOKEN;
    vi.resetModules();
    const create = vi.fn(async (
      params: { tools?: unknown[]; tool_choice?: unknown; system?: unknown; messages?: Array<{ role?: string; content?: unknown }> },
      requestOptions?: { timeout?: number; maxRetries?: number; signal?: AbortSignal },
    ) => {
      requests.push({ ...params, requestOptions });
      const choice = params.tool_choice as { name?: string } | undefined;
      if (choice?.name === SUMMARY_V3_WRITER_TOOL_NAME) {
        writerCalls += 1;
        if (writerCalls === 1) {
          options.onInitialWriterStarted?.();
          if (options.initialWriterDelayMs) {
            await new Promise((resolve) => setTimeout(resolve, options.initialWriterDelayMs));
          }
        }
        if (options.transportFailure) {
          const error = new Error('raw route provider message') as Error & Record<string, unknown>;
          error.status = 429; error.requestID = 'raw-route-request-id'; error.error = { code: 'rate_limit_error' };
          throw error;
        }
        if (options.malformedWriter) return { stop_reason: 'tool_use', content: [] };
        return validForcedWriterResponse(manifest);
      }
      evaluatorCalls += 1;
      if (evaluatorCalls === 1) {
        options.onInitialEvaluatorStarted?.();
        if (options.initialEvaluatorDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.initialEvaluatorDelayMs));
        }
      }
      return validForcedEvaluatorResponse(manifest, options.forceRepair === true && evaluatorCalls === 1);
    });
    vi.doMock('@anthropic-ai/sdk', () => { class MockAnthropic { readonly messages = { create }; } return { default: MockAnthropic }; });
    vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => {
      if (options.routeEntryElapsedMs) vi.setSystemTime(Date.now() + options.routeEntryElapsedMs);
      return { subject: 'm4' };
    }) }));
    const core = await import('..'); core.resetAiCoreV3TestOverride();
    const manifest = core.captureSummaryV3GenerateOperationSnapshot({
      enabled: true, operationKind: 'summary_generate', operationId: 'route-m4', requestId: 'route-m4', cv: pageCv(),
      requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
      referenceDateIso: '2026-08-28', jobContextHash: 'route-context', usageCountBefore: 0,
    }).manifest;
    const request = new Request('http://localhost/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: SUMMARY_V3_GENERATE_ACTION, proToken: 'token', requestId: 'route-m4', manifest }) });
    const { POST, maxDuration } = await import('@/app/api/generate/route');
    const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), requests, maxDuration };
  } finally {
    vi.restoreAllMocks(); vi.doUnmock('@anthropic-ai/sdk'); vi.doUnmock('@/lib/pro-token'); vi.resetModules();
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

afterEach(() => { cleanup(); });

describe('M4 actual page routing and direct server gate', () => {
  it('1. V3-disabled Generate schedules one generic 40000ms timer and bypasses the M4 adapter', async () => {
    const run = await actualGeneralSummaryFlow({ enabled: false, captureClientTimer: true });
    expectOneClientTimer(run, AI_CLIENT_TIMEOUT_MS);
    expect(run.adapterCalls).toBe(0); expect(run.legacyCalls).toBe(1); expect(run.visible).toBe('');
  });
  it('2. V3-disabled Generate preserves the existing single legacy/V2 continuation', async () => {
    const run = await actualGeneralSummaryFlow({ enabled: false, captureClientTimer: true });
    expectOneClientTimer(run, AI_CLIENT_TIMEOUT_MS);
    expect(run.legacyCalls).toBe(1); expect(run.writes).toBe(1); expect(run.usageCalls).toBe(0);
  });
  it('3. direct disabled M4 API call returns exact typed 409', async () => {
    const run = await disabledDirectRoute(); expect(run.response.status).toBe(409);
    expect(run.body).toEqual({ ok: false, action: SUMMARY_V3_GENERATE_ACTION, typedReason: 'v3_feature_disabled' });
  });
  it('4. disabled direct call invokes primary and repair writer zero times', async () => {
    const run = await disabledDirectRoute(); expect(run.writer).not.toHaveBeenCalled(); expect(run.create).not.toHaveBeenCalled();
  });
  it('5. disabled direct call invokes primary and repair evaluator zero times', async () => {
    const run = await disabledDirectRoute(); expect(run.evaluator).not.toHaveBeenCalled(); expect(run.create).not.toHaveBeenCalled();
  });
  it('6. disabled response exposes no candidate, apply, persistence, or usage authority', async () => {
    const run = await disabledDirectRoute(); expect(run.body.candidate).toBeUndefined(); expect(run.body.apply).toBeUndefined();
    expect(run.body.incrementUsage).toBeUndefined(); expect(run.body.persist).toBeUndefined();
  });
  it('7. flag true plus empty same-locale Summary invokes M4 with exact empty bytes', async () => {
    const run = await actualGeneralSummaryFlow(); expect(run.adapterCalls).toBe(1); expect(run.adapterInput?.exactVisibleSummary).toBe('');
  });
  it('7b. the actual Summary M4 button selects the isolated 60000ms abort guard', async () => {
    const run = await actualGeneralSummaryFlow({ captureClientTimer: true });
    expect(run.adapterCalls).toBe(1);
    expectOneClientTimer(run, SUMMARY_V3_M4_CLIENT_TIMEOUT_MS);
    expect(Object.isFrozen(run.adapterInput)).toBe(true);
    expect(classifySummaryV3GenerateRouting(run.adapterInput!)).toBe('owned');
    expect(SUMMARY_V3_M4_CLIENT_TIMEOUT_MS).toBe(60_000);
    expect(AI_CLIENT_TIMEOUT_MS).toBe(40_000);
  });
  it('8. flag true plus non-empty Summary is classified outside M4', () => {
    const data = pageCv('Existing'); expect(classifySummaryV3GenerateRouting({ enabled: true, operationKind: 'summary_generate', cv: data,
      requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: 'Existing',
      referenceDateIso: '2026-08-28', jobContextHash: 'context' })).toBe('not_applicable');
  });
  it('9. non-empty Summary is truthfully outside M4 and schedules one generic 40000ms timer', async () => {
    const run = await actualGeneralSummaryFlow({ summary: 'Existing', kind: 'not_applicable', captureClientTimer: true });
    expectOneClientTimer(run, AI_CLIENT_TIMEOUT_MS);
    expect(classifySummaryV3GenerateRouting(run.adapterInput!)).toBe('not_applicable');
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(1); expect(run.writes).toBe(1);
  });
  it('10. a production-classifier not_applicable no-current-role state schedules one generic 40000ms timer', async () => {
    const run = await actualGeneralSummaryFlow({
      kind: 'not_applicable', captureClientTimer: true, noCurrentRole: true,
    });
    expectOneClientTimer(run, AI_CLIENT_TIMEOUT_MS);
    expect(classifySummaryV3GenerateRouting(run.adapterInput!)).toBe('not_applicable');
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(1); expect(run.writes).toBe(1);
  });
  it('11. Stronger bypasses M4 and invokes its existing V2 flow', async () => {
    const run = await actualStyleFlow('stronger'); expect(run.adapterCalls).toBe(0); expect(run.legacyCalls).toBe(1);
  });
  it('12. Professional bypasses M4 and invokes its existing V2 flow', async () => {
    const run = await actualStyleFlow('professional'); expect(run.adapterCalls).toBe(0); expect(run.legacyCalls).toBe(1);
  });
  it('13. Shorter bypasses M4 and invokes its existing V2 flow', async () => {
    const run = await actualStyleFlow('shorter'); expect(run.adapterCalls).toBe(0); expect(run.legacyCalls).toBe(1);
  });
  it('14. M4 handled_failure retains 60000ms, one timer, and no V2 fallthrough', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_failure', captureClientTimer: true });
    expectOneClientTimer(run, SUMMARY_V3_M4_CLIENT_TIMEOUT_MS);
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(0); expect(run.visible).toBe('');
    expect(run.writes).toBe(1); expect(run.usageCalls).toBe(0);
  });
  it('15. M4 handled_success retains 60000ms, one timer, and no V2 fallthrough', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_success', captureClientTimer: true });
    expectOneClientTimer(run, SUMMARY_V3_M4_CLIENT_TIMEOUT_MS);
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(0); expect(run.visible).toBe('M4 generated summary.');
    expect(run.writes).toBe(2); expect(run.usageCalls).toBe(1);
  });
  it('15b. M4 failure persists the Summary terminal record before the toast', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_failure' });
    expect(run.toastSawSummaryRecord).toBe(true);
  });
  it('15c. page-owned persistence failure leaves canonical and rendered Summary empty with zero usage', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_success', persist: false });
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(0);
    expect(run.visible).toBe(''); expect(run.usageCalls).toBe(0); expect(run.writes).toBe(1);
    expect(run.toastErrorCalls).toBe(1); expect(run.toastSuccessCalls).toBe(0);
  });
  it('15d. page-owned usage rejection rolls the CV back and cannot produce a success terminal or toast', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_success', usageFailure: true });
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(0);
    expect(run.visible).toBe(''); expect(run.usageCalls).toBe(0); expect(run.writes).toBe(3);
    expect(run.toastErrorCalls).toBe(1); expect(run.toastSuccessCalls).toBe(0);
  });
  it.each([
    ['verified usage rollback', 'verified_rollback'],
    ['failed usage rollback', 'rollback_failed'],
  ] as const)('15e. page terminalizes %s without a hidden success or V2 fallthrough', async (
    _label,
    usageFailureMode,
  ) => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_success', usageFailureMode });
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(0);
    expect(run.visible).toBe(''); expect(run.writes).toBe(3); expect(run.usageCalls).toBe(1);
    expect(run.toastErrorCalls).toBe(1); expect(run.toastSuccessCalls).toBe(0);
    expect(run.terminalTrace).toMatchObject({
      countedAsSuccess: false, visibleApplySucceeded: false,
    });
  });
  it('16. a classifier-compatible not_applicable adapter continuation keeps 40000ms and has no duplicate operation', async () => {
    const run = await actualGeneralSummaryFlow({ summary: 'Existing', kind: 'not_applicable', captureClientTimer: true });
    expectOneClientTimer(run, AI_CLIENT_TIMEOUT_MS);
    expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(1); expect(run.writes).toBe(1); expect(run.usageCalls).toBe(0);
  });
  it('17. stable selected Experience IDs and exact current sources reach M4', async () => {
    const run = await actualGeneralSummaryFlow(); expect(run.adapterInput?.cv.experience.map((entry) => entry.id)).toEqual(['page-prior', 'page-current']);
    expect(run.adapterInput?.cv.experience[1].description).toBe('Designs reliable systems.');
  });
  it('18. actual current-role ID and structured duration are captured from page input', async () => {
    const run = await actualGeneralSummaryFlow(); const captured = captureSummaryV3GenerateOperationSnapshot(run.adapterInput!);
    expect(captured.currentRoleEntryId).toBe('page-current'); expect(captured.structuredTotalDurationMonths).toBeGreaterThan(70);
  });
  it('19. handled success causes no duplicate legacy usage or page-side apply', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_success' });
    expect(run.legacyCalls).toBe(0); expect(run.usageCalls).toBe(1); expect(run.writes).toBe(2);
    expect(run.visible).toBe('M4 generated summary.');
  });
  it('20. every Experience operation remains on existing M2/M3 routing', () => {
    const data = pageCv();
    for (const operationKind of ['experience_generate', 'experience_enhance']) {
      expect(classifySummaryV3GenerateRouting({ enabled: true, operationKind, cv: data, requestedLocale: 'en', uiLocale: 'en',
        storedContentLocale: 'en', exactVisibleSummary: '', referenceDateIso: '2026-08-28', jobContextHash: 'context' })).toBe('not_applicable');
    }
  });

  it('21. enabled M4 route sends exactly one forced writer and evaluator tool', async () => {
    const run = await forcedToolDirectRoute();
    expect(run.response.status).toBe(200);
    expect(run.requests).toHaveLength(2);
    expect(run.requests[0].tools).toHaveLength(1);
    expect(run.requests[0].tool_choice).toEqual({ type: 'tool', name: SUMMARY_V3_WRITER_TOOL_NAME, disable_parallel_tool_use: true });
    expect(run.requests[1].tools).toHaveLength(1);
    expect(run.requests[1].tool_choice).toEqual({ type: 'tool', name: SUMMARY_V3_EVALUATOR_TOOL_NAME, disable_parallel_tool_use: true });
    expect(run.body.providerOutput).toBeDefined();
  });

  it('21b. initial and repair route requests send the identical revised duration contract', async () => {
    const run = await forcedToolDirectRoute({ forceRepair: true });
    expect(run.response.status).toBe(200);
    const writers = run.requests.filter((request) =>
      (request.tool_choice as { name?: string } | undefined)?.name === SUMMARY_V3_WRITER_TOOL_NAME);
    expect(writers).toHaveLength(2);
    expect(writers[0].tools).toEqual(writers[1].tools);
    for (const request of writers) {
      expect(request.tool_choice).toEqual({
        type: 'tool', name: SUMMARY_V3_WRITER_TOOL_NAME, disable_parallel_tool_use: true,
      });
      const tool = request.tools?.[0] as { description?: string; input_schema?: unknown };
      expect(tool.description).toContain(SUMMARY_V3_WRITER_UNIT_CONTRACT);
      expect(tool.input_schema).toEqual(SUMMARY_V3_WRITER_TOOL.input_schema);
      expect(JSON.stringify(tool.input_schema)).not.toContain('"const":[]');
      expect(String(request.messages?.[0]?.content)).toContain(SUMMARY_V3_WRITER_UNIT_CONTRACT);
    }
  });

  it('22. forced writer transport rejection retains the application 502 boundary', async () => {
    const run = await forcedToolDirectRoute({ malformedWriter: true });
    expect(run.response.status).toBe(502);
    expect(run.body).toMatchObject({ ok: false, typedReason: 'writer_tool_missing' });
    expect(run.requests).toHaveLength(1);
  });

  it('23. route transport catch returns safe phase evidence without raw SDK details', async () => {
    const run = await forcedToolDirectRoute({ transportFailure: true });
    expect(run.response.status).toBe(502);
    expect(run.body).toMatchObject({ ok: false, typedReason: 'provider_request_failed',
      m4ProviderFailure: { phase: 'initial_writer', failureStage: 'sdk_request', providerHttpStatus: 429,
        providerErrorType: 'rate_limit', providerErrorCode: 'rate_limit_error' } });
    expect(JSON.stringify(run.body)).not.toContain('raw route provider message');
    expect(JSON.stringify(run.body)).not.toContain('raw-route-request-id');
    expect(run.requests).toHaveLength(1);
  });
});

describe('M4 Summary timeout budget closure', () => {
  it('proves the approved authorities and complete deadline ordering arithmetically', () => {
    expect(SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS).toBe(11_500);
    expect(SUMMARY_V3_INITIAL_EVALUATOR_TIMEOUT_MS).toBe(20_000);
    expect(AI_PROVIDER_CALL_TIMEOUT_MS).toBe(8_000);
    expect(SUMMARY_V3_SERVER_BUDGET_MS).toBe(38_000);
    expect(SUMMARY_V3_POST_PROCESSING_HEADROOM_MS).toBe(4_000);
    expect(SUMMARY_V3_ROUTE_MAX_DURATION_S).toBe(45);
    expect(computeSummaryV3ServerDeadline(1_000)).toBe(39_000);
    expect(SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS + SUMMARY_V3_INITIAL_EVALUATOR_TIMEOUT_MS
      + SUMMARY_V3_POST_PROCESSING_HEADROOM_MS).toBe(35_500);
    expect(35_500).toBeLessThan(SUMMARY_V3_SERVER_BUDGET_MS);
    expect(SUMMARY_V3_ROUTE_MAX_DURATION_S * 1_000 - SUMMARY_V3_SERVER_BUDGET_MS).toBeGreaterThanOrEqual(5_000);
    expect(SUMMARY_V3_M4_CLIENT_TIMEOUT_MS - SUMMARY_V3_ROUTE_MAX_DURATION_S * 1_000).toBeGreaterThanOrEqual(10_000);
    expect(AI_PLATFORM_MAX_DURATION_S).toBe(30);
    expect(AI_CLIENT_TIMEOUT_MS).toBe(40_000);
  });

  it('keeps the historical evaluator 8000ms seam timed out for the identical valid forced-tool response at 8001ms', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const manifest = captureSummaryV3GenerateOperationSnapshot({
        enabled: true, operationKind: 'summary_generate', operationId: 'historical-m4', requestId: 'historical-m4',
        cv: pageCv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
        referenceDateIso: '2026-08-28', jobContextHash: 'route-context', usageCountBefore: 0,
      }).manifest;
      const create = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 8_001));
        return validForcedEvaluatorResponse(manifest);
      });
      const pending = callProviderWithDeadline(create, null, AI_PROVIDER_CALL_TIMEOUT_MS, 'verifier');
      const rejected = expect(pending).rejects.toMatchObject({
        deadlineOwner: 'verifier_transport', configuredTimeoutMs: 8_000, effectiveTimeoutMs: 8_000,
      });
      await vi.advanceTimersByTimeAsync(8_001);
      await rejected;
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the actual production initial-evaluator seam parse and accept valid forced tools at 11501ms, 15000ms, and 19999ms', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      for (const delayMs of [11_501, 15_000, 19_999]) {
        let started!: () => void;
        const evaluatorStarted = new Promise<void>((resolve) => { started = resolve; });
        const pending = forcedToolDirectRoute({ initialEvaluatorDelayMs: delayMs, onInitialEvaluatorStarted: started });
        await evaluatorStarted;
        await vi.advanceTimersByTimeAsync(delayMs);
        const run = await pending;
        expect(run.response.status).toBe(200);
        expect(run.requests).toHaveLength(2);
        expect(run.requests[0].requestOptions).toMatchObject({ timeout: 11_500, maxRetries: 0 });
        expect(run.requests[1].requestOptions).toMatchObject({ timeout: 20_000, maxRetries: 0 });
        expect(run.body.providerOutput).toBeDefined();
        expect(run.body.candidate).toBeDefined();
        expect(run.body.validation).toMatchObject({ decision: 'accept', phases: {
          structural: { status: 'passed' }, semantic: { status: 'passed' }, language_quality: { status: 'passed' },
        } });
        expect(run.body.repairAttempted).toBe(false);
        expect(run.maxDuration).toBe(SUMMARY_V3_STYLE_M5_ROUTE_MAX_DURATION_S);
        expect(run.maxDuration).toBeGreaterThan(SUMMARY_V3_ROUTE_MAX_DURATION_S);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed when the initial evaluator exceeds 20000ms without repair, retry, or candidate authority', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      let started!: () => void;
      const evaluatorStarted = new Promise<void>((resolve) => { started = resolve; });
      const pending = forcedToolDirectRoute({ initialEvaluatorDelayMs: 20_001, onInitialEvaluatorStarted: started });
      await evaluatorStarted;
      await vi.advanceTimersByTimeAsync(20_001);
      const run = await pending;
      expect(run.response.status).toBe(502);
      expect(run.requests).toHaveLength(2);
      expect(run.requests.map((request) => request.requestOptions?.timeout)).toEqual([11_500, 20_000]);
      expect(run.body).toMatchObject({ ok: false, typedReason: 'validator_exception', repairAttempted: false,
        m4ProviderFailure: { phase: 'initial_evaluator', failureStage: 'sdk_request',
          providerErrorType: 'timeout', providerRetryable: false, providerHttpStatus: null,
          providerHttpResponseReceived: null } });
      expect(run.body.candidate).toBeUndefined();
      expect(run.body.providerOutput).toBeUndefined();
      expect(run.body.apply).toBeUndefined();
      expect(run.body.persistence).toBeUndefined();
      expect(run.body.incrementUsage).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('changes only the initial evaluator while repair phases remain on their 8000ms authorities', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const run = await forcedToolDirectRoute({ forceRepair: true });
      expect(run.response.status).toBe(200);
      expect(run.requests).toHaveLength(4);
      expect(run.requests.map((request) => request.requestOptions?.timeout)).toEqual([11_500, 20_000, 8_000, 8_000]);
      expect(run.requests.every((request) => request.requestOptions?.maxRetries === 0)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the M4-specific 38000ms outer budget from route entry without introducing a second deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      let writerStartedResolve!: () => void;
      let evaluatorStartedResolve!: () => void;
      const writerStarted = new Promise<void>((resolve) => { writerStartedResolve = resolve; });
      const evaluatorStarted = new Promise<void>((resolve) => { evaluatorStartedResolve = resolve; });
      const pending = forcedToolDirectRoute({
        routeEntryElapsedMs: 6_000,
        initialWriterDelayMs: 8_001,
        initialEvaluatorDelayMs: 19_999,
        onInitialWriterStarted: writerStartedResolve,
        onInitialEvaluatorStarted: evaluatorStartedResolve,
      });
      await writerStarted;
      await vi.advanceTimersByTimeAsync(8_001);
      await evaluatorStarted;
      await vi.advanceTimersByTimeAsync(19_999);
      const run = await pending;
      expect(run.response.status).toBe(200);
      expect(Date.now()).toBe(34_000);
      expect(run.requests.map((request) => request.requestOptions?.timeout)).toEqual([11_500, 20_000]);
    } finally {
      vi.useRealTimers();
    }
  });
});
