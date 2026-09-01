/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations, type Locale } from '../../i18n/translations';
import type { CVData } from '../../types';
import { SUMMARY_AI_DIAG_STORAGE_KEY } from '../../cv-summary-ai-diagnostics';
import {
  AI_CLIENT_TIMEOUT_MS,
  AI_PLATFORM_MAX_DURATION_S,
  AI_PROVIDER_CALL_TIMEOUT_MS,
  callProviderWithDeadline,
} from '../../ai-request-timing';
import {
  SUMMARY_V3_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_GENERATE_ACTION,
  SUMMARY_V3_WRITER_TOOL,
  SUMMARY_V3_WRITER_TOOL_NAME,
  SUMMARY_V3_WRITER_UNIT_CONTRACT,
  SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS,
  SUMMARY_V3_POST_PROCESSING_HEADROOM_MS,
  SUMMARY_V3_SERVER_BUDGET_MS,
  computeSummaryV3ServerDeadline,
  captureSummaryV3GenerateOperationSnapshot,
  classifySummaryV3GenerateRouting,
  type SummaryV3GenerateAdapterInput,
  type SummaryV3Manifest,
} from '..';

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

function installMocks(): void {
  vi.doMock('@/lib/ai-core-v3', async () => {
    const actual = await vi.importActual<typeof import('..')>('@/lib/ai-core-v3');
    return { ...actual, runSummaryV3GenerateAdapter: m4Adapter,
      runExperienceV3GenerateAdapter: m2Adapter, runExperienceV3EnhanceAdapter: m3Adapter };
  });
  vi.doMock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale: testLocale, t: translations[testLocale] }) }));
  vi.doMock('@/lib/store', () => ({
    checkProAccess: () => 'allowed',
    useApp: () => ({
      currentCv: runtimeCv,
      setCurrentCv: (next: CVData) => { runtimeCv = next; writes.push(next); },
      persistCurrentCvTransactionally: (next: CVData) => { runtimeCv = next; writes.push(next); return true; },
      isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(),
      recordProAiSuccess: usageIncrement, getProAiUsageCount: () => 5, lastCvSavedAt: 0,
      getAiGate: () => ({ status: 'ready', token: 'm4-page-token' }),
    }),
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

async function actualGeneralSummaryFlow(options: {
  enabled?: boolean; kind?: AdapterKind; summary?: string; locale?: Locale; contentLocale?: Locale;
} = {}) {
  const environmentKeys = ['NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'AI_CORE_V3_ENABLED'] as const;
  const saved = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  const scroll = HTMLElement.prototype.scrollIntoView;
  cleanup(); localStorage.clear(); sessionStorage.clear();
  testLocale = options.locale ?? 'en'; runtimeCv = pageCv(options.summary ?? '', options.contentLocale ?? 'en'); writes = [];
  const kind = options.kind ?? 'handled_failure';
  let toastSawSummaryRecord = false;
  m4Adapter.mockReset().mockResolvedValue(kind === 'handled_failure'
    ? { kind, typedReason: 'page_m4_rejected' } : { kind });
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
  try {
    const core = await import('..'); core.resetAiCoreV3TestOverride();
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
      await waitFor(() => expect(kind === 'handled_success' ? toastSuccess : toastError).toHaveBeenCalled());
    }
    return {
      adapterCalls: m4Adapter.mock.calls.length,
      adapterInput: m4Adapter.mock.calls[0]?.[0] as SummaryV3GenerateAdapterInput | undefined,
      legacyCalls: legacyRequest.mock.calls.length,
      usageCalls: usageIncrement.mock.calls.length,
      writes: writes.length,
      visible: editor.value,
      toastSawSummaryRecord,
    };
  } finally {
    cleanup();
    const core = await import('..'); core.resetAiCoreV3TestOverride();
    for (const key of environmentKeys) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
    if (scroll === undefined) delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    else Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    vi.doUnmock('@/lib/ai-core-v3'); vi.doUnmock('@/lib/i18n/context'); vi.doUnmock('@/lib/store');
    vi.doUnmock('@/lib/api'); vi.doUnmock('@/components/Header'); vi.doUnmock('@/components/Footer'); vi.doUnmock('sonner');
    vi.clearAllMocks(); vi.resetModules(); localStorage.clear(); sessionStorage.clear();
  }
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
  const checks = ['factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
    'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected', 'targetLanguageAndScript',
    'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense', 'grammarAndClarity',
    'duplicationAndDegradationAbsent', 'completeSummaryUsable'];
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
      const rejected = options.forceRepair === true && evaluatorCalls === 1;
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_EVALUATOR_TOOL_NAME, input: {
        operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
        phases: { semantic: rejected
          ? { status: 'failed', violations: [{ code: 'repair_required', category: 'semantic', detail: 'bounded repair evidence' }] }
          : { status: 'passed', violations: [] }, language_quality: { status: 'passed', violations: [] } },
        checks: Object.fromEntries(checks.map((check) => [check, !rejected])),
      } }] };
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
    const { POST } = await import('@/app/api/generate/route');
    const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), requests };
  } finally {
    vi.restoreAllMocks(); vi.doUnmock('@anthropic-ai/sdk'); vi.doUnmock('@/lib/pro-token'); vi.resetModules();
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

afterEach(() => { cleanup(); });

describe('M4 actual page routing and direct server gate', () => {
  it('1. flag false bypasses the M4 page adapter', async () => {
    const run = await actualGeneralSummaryFlow({ enabled: false }); expect(run.adapterCalls).toBe(0);
  });
  it('2. flag false keeps empty Summary on V2', async () => {
    const run = await actualGeneralSummaryFlow({ enabled: false }); expect(run.legacyCalls).toBe(1); expect(run.visible).toBe('');
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
  it('8. flag true plus non-empty Summary is classified outside M4', () => {
    const data = pageCv('Existing'); expect(classifySummaryV3GenerateRouting({ enabled: true, operationKind: 'summary_generate', cv: data,
      requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: 'Existing',
      referenceDateIso: '2026-08-28', jobContextHash: 'context' })).toBe('not_applicable');
  });
  it('9. non-empty Summary positive control reaches V2 exactly once', async () => {
    const run = await actualGeneralSummaryFlow({ summary: 'Existing', kind: 'not_applicable' }); expect(run.legacyCalls).toBe(1);
  });
  it('10. cross-locale Summary returns not_applicable and reaches legacy V2', async () => {
    const run = await actualGeneralSummaryFlow({ locale: 'de', contentLocale: 'en', kind: 'not_applicable' });
    expect(run.adapterInput?.uiLocale).toBe('de'); expect(run.legacyCalls).toBe(1);
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
  it('14. M4 handled_failure terminates actual page flow before V2 and preserves empty Summary', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_failure' }); expect(run.legacyCalls).toBe(0); expect(run.visible).toBe('');
  });
  it('15. M4 handled_success terminates actual page flow before V2', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_success' }); expect(run.legacyCalls).toBe(0);
  });
  it('15b. M4 failure persists the Summary terminal record before the toast', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'handled_failure' });
    expect(run.toastSawSummaryRecord).toBe(true);
  });
  it('16. only not_applicable reaches the real legacy continuation seam exactly once', async () => {
    const run = await actualGeneralSummaryFlow({ kind: 'not_applicable' }); expect(run.adapterCalls).toBe(1); expect(run.legacyCalls).toBe(1);
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
    expect(run.legacyCalls).toBe(0); expect(run.usageCalls).toBe(0); expect(run.visible).toBe('');
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

describe('M4 initial-writer timeout budget closure', () => {
  it('proves the approved authorities and complete deadline ordering arithmetically', () => {
    expect(SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS).toBe(11_500);
    expect(SUMMARY_V3_SERVER_BUDGET_MS).toBe(27_000);
    expect(SUMMARY_V3_POST_PROCESSING_HEADROOM_MS).toBe(3_000);
    expect(computeSummaryV3ServerDeadline(1_000)).toBe(28_000);
    expect(SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS + AI_PROVIDER_CALL_TIMEOUT_MS
      + SUMMARY_V3_POST_PROCESSING_HEADROOM_MS).toBeLessThanOrEqual(SUMMARY_V3_SERVER_BUDGET_MS);
    expect(SUMMARY_V3_SERVER_BUDGET_MS).toBeLessThan(AI_PLATFORM_MAX_DURATION_S * 1_000);
    expect(AI_PLATFORM_MAX_DURATION_S * 1_000).toBeLessThan(AI_CLIENT_TIMEOUT_MS);
  });

  it('keeps the historical 8000ms seam timed out for the identical valid forced-tool response at 8001ms', async () => {
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
        return validForcedWriterResponse(manifest);
      });
      const pending = callProviderWithDeadline(create, null, AI_PROVIDER_CALL_TIMEOUT_MS, 'provider');
      const rejected = expect(pending).rejects.toMatchObject({
        deadlineOwner: 'provider_transport', configuredTimeoutMs: 8_000, effectiveTimeoutMs: 8_000,
      });
      await vi.advanceTimersByTimeAsync(8_001);
      await rejected;
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the actual production initial-writer seam accept the valid forced tool at 8001ms', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      let started!: () => void;
      const writerStarted = new Promise<void>((resolve) => { started = resolve; });
      const pending = forcedToolDirectRoute({ initialWriterDelayMs: 8_001, onInitialWriterStarted: started });
      await writerStarted;
      await vi.advanceTimersByTimeAsync(8_001);
      const run = await pending;
      expect(run.response.status).toBe(200);
      expect(run.requests).toHaveLength(2);
      expect(run.requests[0].requestOptions).toMatchObject({ timeout: 11_500, maxRetries: 0 });
      expect(run.requests[1].requestOptions).toMatchObject({ timeout: 8_000, maxRetries: 0 });
      expect(run.body.providerOutput).toBeDefined();
      expect(run.body.candidate).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still fails closed beyond 11500ms before evaluator, candidate, or provider status exists', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      let started!: () => void;
      const writerStarted = new Promise<void>((resolve) => { started = resolve; });
      const pending = forcedToolDirectRoute({ initialWriterDelayMs: 11_501, onInitialWriterStarted: started });
      await writerStarted;
      await vi.advanceTimersByTimeAsync(11_501);
      const run = await pending;
      expect(run.response.status).toBe(502);
      expect(run.requests).toHaveLength(1);
      expect(run.requests[0].requestOptions).toMatchObject({ timeout: 11_500, maxRetries: 0 });
      expect(run.body).toMatchObject({ ok: false, typedReason: 'provider_request_failed',
        m4ProviderFailure: { phase: 'initial_writer', failureStage: 'sdk_request',
          providerErrorType: 'timeout', providerRetryable: false, providerHttpStatus: null } });
      expect(run.body.candidate).toBeUndefined();
      expect(run.body.repairAttempted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps evaluator and repair phases on their unchanged 8000ms authorities', async () => {
    const run = await forcedToolDirectRoute({ forceRepair: true });
    expect(run.response.status).toBe(200);
    expect(run.requests).toHaveLength(4);
    expect(run.requests.map((request) => request.requestOptions?.timeout)).toEqual([11_500, 8_000, 8_000, 8_000]);
    expect(run.requests.every((request) => request.requestOptions?.maxRetries === 0)).toBe(true);
  });

  it('uses the M4-specific 27000ms outer budget from route entry', async () => {
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
        initialEvaluatorDelayMs: 7_999,
        onInitialWriterStarted: writerStartedResolve,
        onInitialEvaluatorStarted: evaluatorStartedResolve,
      });
      await writerStarted;
      await vi.advanceTimersByTimeAsync(8_001);
      await evaluatorStarted;
      await vi.advanceTimersByTimeAsync(7_999);
      const run = await pending;
      expect(run.response.status).toBe(200);
      expect(Date.now()).toBe(22_000);
      expect(run.requests.map((request) => request.requestOptions?.timeout)).toEqual([11_500, 8_000]);
    } finally {
      vi.useRealTimers();
    }
  });
});
