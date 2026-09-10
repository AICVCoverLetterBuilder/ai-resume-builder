/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '@/lib/cv-defaults';
import { resolveSummaryCurrentRole } from '@/lib/cv-summary-current-role';
import { hashSummarySourceLocaleText } from '@/lib/cv-summary-source-locale';
import {
  clearSummaryAiDiagnosticsForTests,
  SUMMARY_AI_DIAG_STORAGE_KEY,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  getCvAiDiagnosticHistory,
  type CvAiDiagnosticHistoryItem,
} from '@/lib/cv-ai-diagnostics-contract';
import { CV_AI_DIAGNOSTICS_CHANGED_EVENT } from '@/lib/cv-ai-diagnostics-lifecycle';
import { translations, type Locale } from '@/lib/i18n/translations';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import type { CVData } from '@/lib/types';
import {
  canonicalSummaryV3StyleLocale,
  createSummaryV3StyleCandidate,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3Style,
  type SummaryV3StyleCandidateUnit,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleRoute,
  normalizeSummaryV3StyleRouteRequest,
  type SummaryV3StyleProviderInvocation,
  type SummaryV3StyleRouteAction,
  type SummaryV3StyleRouteParams,
} from '../summary-style-m5-provider';
import type {
  SummaryV3StyleEvaluatorInput,
  SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';
import { runSummaryV3StyleClientOperation, SUMMARY_V3_STYLE_M5_ACTION } from '../summary-style-m5-client';
import {
  SUMMARY_V3_STYLE_M5_CLIENT_ABORT_TIMEOUT_MS,
  resolveSummaryV3StyleM5ClientAbortTimeoutMs,
} from '../summary-style-m5-timeout-policy';
import {
  hashSummaryV3Value,
  type SummaryV3CommitReceipt,
  type SummaryV3CommitRequest,
  type SummaryV3GenerateAdapterDependencies,
  type SummaryV3GenerateAdapterInput,
  type SummaryV3GenerateRoutingResult,
} from '../summary-generate';

const require = createRequire(import.meta.url);
const androidInternalV3RoutingContract = require('../../../../scripts/android-internal-v3-routing-contract.js') as {
  enforceAndroidInternalV3RoutingContract: (environment: Record<string, string | undefined>) => {
    summaryStyleOwner: 'm5';
  };
};

const localeFixtures: Record<string, { role: string; fact: string; employer: string }> = {
  en: { role: 'Engineer', fact: 'builds APIs', employer: 'Nova' },
  de: { role: 'Ingenieurin', fact: 'entwickelt APIs', employer: 'Nova' },
  sr: { role: 'Inženjerka', fact: 'gradi API-je', employer: 'Nova' },
  hi: { role: 'इंजीनियर', fact: 'एपीआई बनाती हैं', employer: 'नोवा' },
  ar: { role: 'مهندسة', fact: 'تبني واجهات', employer: 'نوفا' },
  ja: { role: 'エンジニア', fact: 'APIを構築', employer: 'ノヴァ' },
  fr: { role: 'Ingénieure', fact: 'construit des API', employer: 'Nova' },
  es: { role: 'Ingeniera', fact: 'construye API', employer: 'Nova' },
  it: { role: 'Ingegnera', fact: 'costruisce API', employer: 'Nova' },
  hr: { role: 'Inženjerka', fact: 'gradi API-je', employer: 'Nova' },
  'pt-BR': { role: 'Engenheira', fact: 'cria APIs', employer: 'Nova' },
  ru: { role: 'Инженер', fact: 'создаёт API', employer: 'Нова' },
};

const pageApiFetch = vi.hoisted(() => vi.fn());
const pageM4Adapter = vi.hoisted(() => vi.fn());
const pageToastSuccess = vi.hoisted(() => vi.fn());
const pageToastError = vi.hoisted(() => vi.fn());
let pageRuntimeCv: CVData;
let pageUiLocale: Locale = 'en';
let pageRequests: Array<Record<string, unknown>> = [];
let pageLegacyRequests: Array<Record<string, unknown>> = [];
let pageCommitCalls = 0;
let pageUsageCalls = 0;
let pageUsageCount = 0;

type StoredSummaryDiagnostic = {
  readonly m5Operation?: 'summary_style';
  readonly rewriteStyle?: string | null;
  readonly operationMode?: string | null;
  readonly finalCandidateSource?: string | null;
  readonly providerCandidatePresent?: boolean | null;
  readonly deterministicCandidatePresent?: boolean | null;
  readonly grammarValidationPassed?: boolean | null;
  readonly groundingValidationPassed?: boolean | null;
  readonly durationValidationPassed?: boolean | null;
  readonly apiResponseKind?: string | null;
  readonly serverFallbackUsed?: boolean | null;
  readonly clientFallbackUsed?: boolean | null;
  readonly diagnosticCompletenessPassed?: boolean;
  readonly diagnosticInvariantCheckPassed?: boolean;
  readonly missingRequiredDiagnosticFields?: readonly string[];
  readonly nullRequiredDiagnosticFields?: readonly string[];
  readonly notApplicableDiagnosticFieldViolations?: readonly string[];
  readonly countedAsSuccess?: boolean;
  readonly visibleApplySucceeded?: boolean;
  readonly rejectionStage?: string | null;
  readonly finalTypedFailureReason?: string | null;
  readonly usageCountBefore?: number;
  readonly usageCountAfter?: number;
  readonly unsupportedClaimCategory?: string | null;
  readonly writerCandidateReachedValidation?: boolean;
  readonly evaluatorReached?: boolean;
  readonly safeNoOpConsidered?: boolean;
  readonly safeNoOpSelected?: boolean;
  readonly safeNoOpEligibilityReason?: string;
  readonly roleIdentityResolution?: string;
  readonly m5FailureStage?: string | null;
  readonly m5CanonicalFailureCause?: string | null;
  readonly providerHttpStatus?: number | null;
  readonly stages?: readonly Readonly<{ name: string; status: string; reason?: string }>[];
};

function readStoredSummaryDiagnostic(): StoredSummaryDiagnostic | null {
  const raw = localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY);
  return raw ? JSON.parse(raw) as StoredSummaryDiagnostic : null;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function installPageMocks(): void {
  vi.doMock('@/lib/ai-core-v3', async () => {
    const actual = await vi.importActual<typeof import('..')>('@/lib/ai-core-v3');
    return { ...actual, runSummaryV3GenerateAdapter: pageM4Adapter };
  });
  vi.doMock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale: pageUiLocale, t: translations[pageUiLocale] }) }));
  vi.doMock('@/lib/store', () => ({
    checkProAccess: () => 'allowed',
    useApp: () => ({
      currentCv: pageRuntimeCv,
      setCurrentCv: (next: CVData) => { pageRuntimeCv = next; },
      persistCurrentCvTransactionally: (next: CVData) => { pageCommitCalls += 1; pageRuntimeCv = next; return true; },
      isPro: true,
      canDownload: () => true,
      incrementDownloads: vi.fn(),
      markAiRecommendUsed: vi.fn(),
      recordProAiSuccess: vi.fn(),
      commitProAiSuccess: () => {
        const before = pageUsageCount;
        pageUsageCalls += 1;
        pageUsageCount += 1;
        return { ok: true, attempted: true, before, after: pageUsageCount, delta: 1,
        forwardWriteResult: 'succeeded', verificationResult: 'passed', rollbackAttempted: false,
        rollbackResult: 'not_required', record: { count: pageUsageCount, windowStart: 0, schemaVersion: 2, policyLimit: 50 } };
      },
      getProAiUsageCount: () => pageUsageCount,
      lastCvSavedAt: 0,
      getAiGate: () => ({ status: 'ready', token: 'm5-page-token' }),
    }),
  }));
  vi.doMock('@/lib/api', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
    return { ...actual, apiFetch: pageApiFetch };
  });
  vi.doMock('@/components/Header', () => ({ default: () => null }));
  vi.doMock('@/components/Footer', () => ({ default: () => null }));
  vi.doMock('sonner', () => ({ toast: { success: pageToastSuccess, error: pageToastError } }));
}

async function actualPageStyleFlow(options: {
  readonly style: SummaryV3Style;
  readonly enabled?: boolean;
  readonly compiledPublicV3Flag?: string;
  readonly uiLocale?: Locale;
  readonly contentLocale?: string;
  readonly summary?: string;
  readonly summarySourceLocale?: string;
  readonly candidateText?: string;
  readonly safeNoOp?: boolean;
  readonly safeNoOpUnsupportedClaimCategory?: string | null;
  readonly safeNoOpEvaluatorReached?: boolean;
  readonly terminalResponse?: Readonly<{ status: number; data: unknown }>;
  readonly requestError?: Error;
  readonly awaitDiagnostic?: boolean;
  readonly seedOldGenerateTrace?: boolean;
  readonly holdTransport?: boolean;
  readonly mutateLiveSummaryWhilePending?: boolean;
  readonly cv?: CVData;
  readonly routeProviderMode?: 'safe_rewrite' | 'unsafe_result' | 'unsafe_metric' | 'provider_no_op'
    | 'invalid_existing_source' | 'role_contradiction' | 'role_unresolved';
}): Promise<{
  m5Requests: Array<Record<string, unknown>>;
  legacyRequests: Array<Record<string, unknown>>;
  beginLocales: string[];
  commitCalls: number;
  usageCalls: number;
  successToasts: number;
  errorToasts: number;
  finalCv: CVData;
  latestDiagnostic: StoredSummaryDiagnostic | null;
  diagnosticStorageWrites: number;
  diagnosticHistoryEntries: number;
  diagnosticCommitEvents: number;
}> {
  const savedEnabled = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  const savedServerEnabled = process.env.AI_CORE_V3_ENABLED;
  cleanup(); localStorage.clear(); sessionStorage.clear();
  clearSummaryAiDiagnosticsForTests();
  clearCvAiDiagnosticHistory();
  pageUiLocale = options.uiLocale ?? 'en';
  const fixtureLocale = options.contentLocale === 'pt_BR' ? 'pt-BR' : (options.contentLocale ?? 'en');
  pageRuntimeCv = options.cv
    ? JSON.parse(JSON.stringify(options.cv)) as CVData
    : cvFor(fixtureLocale, options.summary ?? 'Existing Summary.');
  pageRuntimeCv.runtimeMigrationVersion = 3;
  pageRuntimeCv.contentLocale = options.contentLocale as CVData['contentLocale'] || pageRuntimeCv.contentLocale;
  if (options.summarySourceLocale) {
    pageRuntimeCv.summarySourceLocale = options.summarySourceLocale;
    pageRuntimeCv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(pageRuntimeCv.summary);
    pageRuntimeCv.summaryGeneratedLocale = options.summarySourceLocale;
  }
  pageRequests = []; pageLegacyRequests = []; pageCommitCalls = 0; pageUsageCalls = 0; pageUsageCount = 0; pageToastSuccess.mockReset(); pageToastError.mockReset();
  pageM4Adapter.mockReset().mockResolvedValue({ kind: 'not_applicable' as const });
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = options.compiledPublicV3Flag
    ?? (options.enabled === false ? 'false' : 'true');
  process.env.AI_CORE_V3_ENABLED = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  if (options.seedOldGenerateTrace) {
    const old = new SummaryAiDiagnosticSession({
      uiLocale: pageUiLocale,
      requestedLocale: pageUiLocale,
      contentLocale: pageUiLocale,
      templateId: 'physical-aab561-old-generate',
      requestId: 'old-generate-trace',
      usageCountBefore: 1,
      operationMode: 'generate_from_context',
    });
    old.patch({
      finalPostconditionsPassed: true,
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountAfter: 2,
    });
    old.commit();
    clearCvAiDiagnosticHistory();
  }
  const storageWrites = vi.spyOn(Storage.prototype, 'setItem');
  const commitEvents: Event[] = [];
  let releaseTransport: (() => void) | null = null;
  const transportGate = options.holdTransport
    ? new Promise<void>((resolve) => { releaseTransport = resolve; })
    : null;
  const onDiagnosticCommit = (event: Event) => {
    const detail = (event as CustomEvent<{ kind?: string; action?: string }>).detail;
    if (event.type === CV_AI_DIAGNOSTICS_CHANGED_EVENT
      && detail?.kind === 'summary' && detail.action === 'commit') {
      commitEvents.push(event);
    }
  };
  window.addEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onDiagnosticCommit);
  pageApiFetch.mockReset().mockImplementation(async (_url: unknown, requestOptions: unknown) => {
    const body = ((requestOptions as { body?: unknown }).body || {}) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    if (action.startsWith('summary_')) {
      pageRequests.push(body);
      if (options.requestError) throw options.requestError;
      if (options.terminalResponse) {
        return {
          data: options.terminalResponse.data,
          response: {
            ok: options.terminalResponse.status >= 200 && options.terminalResponse.status < 300,
            status: options.terminalResponse.status,
            headers: { get: () => null },
          },
        };
      }
      if (transportGate) await transportGate;
      const normalized = normalizeSummaryV3StyleRouteRequest(action as SummaryV3StyleRouteAction, body as unknown as SummaryV3StyleRouteParams, 2000);
      if (options.routeProviderMode) {
        const data = await executeSummaryV3StyleRoute(normalized, {
          timeoutForPhase: () => 1_000,
          invoke: async (invocation) => pageRouteProviderMessage(invocation, options.routeProviderMode!),
        });
        const status = data.kind === 'candidate_ready' || data.kind === 'safe_no_op' ? 200 : 422;
        return { data, response: { ok: status === 200, status, headers: { get: () => null } } };
      }
      const snapshot = createSummaryV3StyleOperationSnapshot(normalized);
      const data = options.safeNoOp === false
        ? candidateResponse(snapshot, options.style, snapshot.requestedLocale, options.candidateText || 'M5 page candidate')
        : safeNoOpResponse(
          snapshot,
          options.style,
          options.safeNoOpUnsupportedClaimCategory ?? null,
          options.safeNoOpEvaluatorReached ?? true,
        );
      return { data, response: { ok: true, status: 200, headers: { get: () => null } } };
    }
    pageLegacyRequests.push(body);
    return { data: { error: 'legacy_v2_control', code: 'provider_temporarily_unavailable' }, response: { ok: false, status: 502, headers: { get: () => null } } };
  });
  vi.resetModules(); installPageMocks();
  const core = await import('..'); core.resetAiCoreV3TestOverride();
  const aiRequest = await import('@/lib/ai-client-request');
  const beginSpy = vi.spyOn(aiRequest, 'beginAiClientRequest');
  try {
    const Page = (await import('@/app/cv-builder/page')).default;
    render(React.createElement(Page));
    fireEvent.click(screen.getByRole('button', { name: translations[pageUiLocale].cv.summary }));
    const subtitle = options.style === 'shorter' ? translations[pageUiLocale].cv.shorterSubtext
      : options.style === 'stronger' ? translations[pageUiLocale].cv.strongerSubtext : translations[pageUiLocale].cv.professionalSubtext;
    const findStyleButton = () => screen.getAllByRole('button').find((button) => button.textContent?.includes(subtitle));
    await waitFor(() => {
      const button = findStyleButton();
      expect(button).toBeDefined();
      expect(button?.disabled).toBe(false);
    });
    const styleButton = findStyleButton();
    expect(styleButton).toBeDefined();
    fireEvent.click(styleButton!);
    await waitFor(() => expect(options.enabled === false ? pageLegacyRequests.length : pageRequests.length).toBe(1));
    if (options.mutateLiveSummaryWhilePending) {
      const editor = document.querySelector('[data-summary-v3-editor]') as HTMLTextAreaElement | null;
      expect(editor).not.toBeNull();
      fireEvent.change(editor!, { target: { value: 'User edited Summary while Stronger is pending.' } });
      await waitFor(() => expect(pageRuntimeCv.summary).toBe('User edited Summary while Stronger is pending.'));
    }
    releaseTransport?.();
    if (options.terminalResponse || options.awaitDiagnostic) {
      await waitFor(() => expect(readStoredSummaryDiagnostic()?.rewriteStyle).toBe(options.style));
    }
    return {
      m5Requests: [...pageRequests],
      legacyRequests: [...pageLegacyRequests],
      beginLocales: beginSpy.mock.calls.filter(([operation]) => String(operation).startsWith('summary_style:')).map(([, locale]) => locale),
      commitCalls: pageCommitCalls,
      usageCalls: pageUsageCalls,
      successToasts: pageToastSuccess.mock.calls.length,
      errorToasts: pageToastError.mock.calls.length,
      finalCv: pageRuntimeCv,
      latestDiagnostic: readStoredSummaryDiagnostic(),
      diagnosticStorageWrites: storageWrites.mock.calls.filter(([key]) => key === SUMMARY_AI_DIAG_STORAGE_KEY).length,
      diagnosticHistoryEntries: getCvAiDiagnosticHistory('summary').length,
      diagnosticCommitEvents: commitEvents.length,
    };
  } finally {
    releaseTransport?.();
    window.removeEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onDiagnosticCommit);
    beginSpy.mockRestore(); cleanup(); localStorage.clear(); sessionStorage.clear();
    clearSummaryAiDiagnosticsForTests(); clearCvAiDiagnosticHistory();
    vi.doUnmock('@/lib/i18n/context'); vi.doUnmock('@/lib/store'); vi.doUnmock('@/lib/api');
    vi.doUnmock('@/lib/ai-core-v3');
    vi.doUnmock('@/components/Header'); vi.doUnmock('@/components/Footer'); vi.doUnmock('sonner');
    vi.resetModules(); core.resetAiCoreV3TestOverride();
    if (savedEnabled === undefined) delete process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED; else process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = savedEnabled;
    if (savedServerEnabled === undefined) delete process.env.AI_CORE_V3_ENABLED; else process.env.AI_CORE_V3_ENABLED = savedServerEnabled;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: previousScrollIntoView });
  }
}

function commitPageM4Candidate(
  input: SummaryV3GenerateAdapterInput,
  dependencies: SummaryV3GenerateAdapterDependencies,
): SummaryV3GenerateRoutingResult {
  if (dependencies.getActiveOperationId() !== input.operationId) {
    return { kind: 'handled_failure', typedReason: 'operation_superseded' };
  }
  const before = dependencies.getLiveState().cv;
  const text = 'M4 page race candidate';
  const next = {
    ...before,
    summary: text,
    summaryOrigin: 'ai_generated' as const,
    summaryGeneratedLocale: input.requestedLocale as CVData['contentLocale'],
    summarySourceLocale: input.requestedLocale,
    summarySourceLocaleTextHash: hashSummarySourceLocaleText(text),
    summaryGenerationContextKey: input.jobContextHash,
    contentLocale: input.requestedLocale as CVData['contentLocale'],
  };
  const receipt = dependencies.commitCandidate({
    operationId: input.operationId,
    requestId: input.requestId,
    previousCvHash: hashSummaryV3Value(before),
    candidateHash: hashSummaryV3Value(text),
    requestedLocale: input.requestedLocale,
    usageCountBefore: input.usageCountBefore,
    previousCv: before,
    nextCv: next,
  });
  return receipt.kind === 'committed' ? { kind: 'handled_success' } : { kind: 'handled_failure', typedReason: receipt.reason };
}

async function actualPageSharedRace(direction: 'M5->M4' | 'M5->M4-newest-completes-first' | 'M4->M5' | 'M5->M5' | 'M4-only'): Promise<{
  m5Requests: Array<Record<string, unknown>>;
  m4Calls: number;
  commitCalls: number;
  finalSummary: string;
  m4Result: SummaryV3GenerateRoutingResult | null;
  usageCalls: number;
  latestDiagnostic: StoredSummaryDiagnostic | null;
  diagnosticHistory: CvAiDiagnosticHistoryItem[];
}> {
  const savedEnabled = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  const savedServerEnabled = process.env.AI_CORE_V3_ENABLED;
  cleanup(); localStorage.clear(); sessionStorage.clear();
  clearSummaryAiDiagnosticsForTests(); clearCvAiDiagnosticHistory();
  pageUiLocale = 'en';
  pageRuntimeCv = cvFor('en', 'Existing Summary.');
  pageRuntimeCv.runtimeMigrationVersion = 3;
  pageRequests = []; pageLegacyRequests = []; pageCommitCalls = 0; pageUsageCalls = 0; pageUsageCount = 0;
  pageToastSuccess.mockReset(); pageToastError.mockReset();
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
  process.env.AI_CORE_V3_ENABLED = 'true';
  let releaseM5!: () => void;
  let m5Started!: () => void;
  let releaseM4!: () => void;
  let m4Started!: () => void;
  let m5Body: Record<string, unknown> | null = null;
  let m4Result: SummaryV3GenerateRoutingResult | null = null;
  const m5Gate = new Promise<void>((resolve) => { releaseM5 = resolve; });
  const m5HasStarted = new Promise<void>((resolve) => { m5Started = resolve; });
  const m4Gate = new Promise<void>((resolve) => { releaseM4 = resolve; });
  const m4HasStarted = new Promise<void>((resolve) => { m4Started = resolve; });
  const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  pageM4Adapter.mockReset().mockImplementation(async (
    input: SummaryV3GenerateAdapterInput,
    dependencies: SummaryV3GenerateAdapterDependencies,
  ) => {
    m4Started();
    await m4Gate;
    m4Result = commitPageM4Candidate(input, dependencies);
    return m4Result;
  });
  pageApiFetch.mockReset().mockImplementation(async (_url: unknown, requestOptions: unknown) => {
    const body = ((requestOptions as { body?: unknown }).body || {}) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    if (action.startsWith('summary_')) {
      pageRequests.push(body); m5Body = body; m5Started();
      await m5Gate;
      const normalized = normalizeSummaryV3StyleRouteRequest(action as SummaryV3StyleRouteAction, body as unknown as SummaryV3StyleRouteParams, 2000);
      const snapshot = createSummaryV3StyleOperationSnapshot(normalized);
      return { data: candidateResponse(snapshot, 'shorter', snapshot.requestedLocale, 'M5 page race candidate'), response: { ok: true, status: 200, headers: { get: () => null } } };
    }
    pageLegacyRequests.push(body);
    return { data: { error: 'legacy_v2_control', code: 'provider_temporarily_unavailable' }, response: { ok: false, status: 502, headers: { get: () => null } } };
  });
  vi.resetModules(); installPageMocks();
  const core = await import('..'); core.resetAiCoreV3TestOverride();
  try {
    const Page = (await import('@/app/cv-builder/page')).default;
    render(React.createElement(Page));
    fireEvent.click(screen.getByRole('button', { name: translations.en.cv.summary }));
    const styleButton = screen.getAllByRole('button').find((button) => button.textContent?.includes(translations.en.cv.shorterSubtext));
    const generateButton = screen.getAllByRole('button').find((button) => button.textContent?.includes(translations.en.cv.generateSubtext));
    expect(styleButton).toBeDefined(); expect(generateButton).toBeDefined();
    if (direction === 'M5->M4') {
      fireEvent.click(styleButton!);
      await m5HasStarted;
      fireEvent.click(generateButton!);
      await m4HasStarted;
      releaseM5();
      await waitFor(() => expect(pageRequests).toHaveLength(1));
      releaseM4();
    } else if (direction === 'M5->M4-newest-completes-first') {
      fireEvent.click(styleButton!);
      await m5HasStarted;
      fireEvent.click(generateButton!);
      await m4HasStarted;
      releaseM4();
      await waitFor(() => expect(pageCommitCalls).toBe(1));
      await waitFor(() => expect(readStoredSummaryDiagnostic()?.rewriteStyle).toBeNull());
      releaseM5();
    } else if (direction === 'M4->M5') {
      fireEvent.click(generateButton!);
      await m4HasStarted;
      fireEvent.click(styleButton!);
      await m5HasStarted;
      releaseM4();
      await waitFor(() => expect(pageM4Adapter).toHaveBeenCalledTimes(1));
      releaseM5();
    } else if (direction === 'M4-only') {
      fireEvent.click(generateButton!);
      await m4HasStarted;
      releaseM4();
    } else {
      fireEvent.click(styleButton!);
      await m5HasStarted;
      fireEvent.click(styleButton!);
      expect(pageRequests).toHaveLength(1);
      releaseM5();
    }
    await waitFor(() => expect(pageCommitCalls).toBe(1));
    if (direction !== 'M4-only') expect(m5Body).not.toBeNull();
    if (direction === 'M5->M4-newest-completes-first') {
      await waitFor(() => expect(getCvAiDiagnosticHistory('summary').some((item) =>
        item.operationMode === 'enhance_existing_content'
        && item.finalTypedFailureReason === 'operation_superseded')).toBe(true));
    }
    return {
      m5Requests: [...pageRequests],
      m4Calls: pageM4Adapter.mock.calls.length,
      commitCalls: pageCommitCalls,
      finalSummary: pageRuntimeCv.summary,
      m4Result,
      usageCalls: pageUsageCalls,
      latestDiagnostic: readStoredSummaryDiagnostic(),
      diagnosticHistory: getCvAiDiagnosticHistory('summary'),
    };
  } finally {
    cleanup(); localStorage.clear(); sessionStorage.clear();
    clearSummaryAiDiagnosticsForTests(); clearCvAiDiagnosticHistory();
    vi.doUnmock('@/lib/i18n/context'); vi.doUnmock('@/lib/store'); vi.doUnmock('@/lib/api');
    vi.doUnmock('@/lib/ai-core-v3');
    vi.doUnmock('@/components/Header'); vi.doUnmock('@/components/Footer'); vi.doUnmock('sonner');
    vi.resetModules(); core.resetAiCoreV3TestOverride();
    if (savedEnabled === undefined) delete process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED; else process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = savedEnabled;
    if (savedServerEnabled === undefined) delete process.env.AI_CORE_V3_ENABLED; else process.env.AI_CORE_V3_ENABLED = savedServerEnabled;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: previousScrollIntoView });
  }
}

function cvFor(locale: string, summary = ''): CVData {
  const fixture = localeFixtures[locale]!;
  const cv = createEmptyCv();
  cv.contentLocale = locale as CVData['contentLocale'];
  cv.personal.fullName = 'Ava Patel';
  cv.personal.jobTitle = fixture.role;
  cv.experience = [{
    id: 'experience-current', company: fixture.employer, position: fixture.role,
    startDate: '2020-01', endDate: '', isPresent: true,
    description: fixture.fact,
  }];
  cv.summary = summary;
  return cv;
}

function committedReceipt(): SummaryV3CommitReceipt {
  return {
    kind: 'committed', operationId: 'op', requestId: 'op', canonicalAccepted: true,
    intendedCandidateHash: 'pending', committedSummaryHash: 'pending', committedContentLocale: 'en', candidateMatched: true,
    persistenceAttempted: true, persistenceResult: 'passed', canonicalApplyAttempted: true, canonicalApplyResult: 'passed',
    usageAttempted: true, usageResult: 'passed', usageForwardWriteResult: 'succeeded', usageVerificationResult: 'passed',
    usageRollbackAttempted: false, usageRollbackResult: 'not_required', actualUsageBefore: 0, actualUsageAfter: 1, actualUsageDelta: 1,
    rollbackAttempted: false, rollbackResult: 'not_required',
} as SummaryV3CommitReceipt;
}

type ResponseFactory = (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => unknown;
interface RunOptions {
  readonly locale?: string;
  readonly requestedLocale?: string;
  readonly sourceLocale?: string;
  readonly summary?: string;
  readonly style?: SummaryV3Style;
  readonly enabled?: boolean;
  readonly serverReceivedAt?: number;
  readonly status?: number;
  readonly responseFactory?: ResponseFactory;
  readonly activeOperationId?: string;
  readonly liveCv?: CVData;
  readonly requestError?: Error;
  readonly commitResult?: SummaryV3CommitReceipt;
  readonly currentRoleExperienceId?: string | null;
  readonly responseStatus?: number;
  readonly initialCv?: CVData;
}

function candidateResponse(snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>, style: SummaryV3Style, locale: string, text: string): Record<string, unknown> {
  const units: readonly SummaryV3StyleCandidateUnit[] = [{
    unitId: `unit-${hashSummaryV3StyleValue(text)}`,
    text,
    factIds: [`fact-${hashSummaryV3StyleValue(text)}`],
  }];
  const candidate = createSummaryV3StyleCandidate(snapshot, units);
  const candidateHash = candidate.hash;
  return { kind: 'candidate_ready', style, mode: snapshot.mode,
    candidate: { ...candidate, style, locale: canonicalSummaryV3StyleLocale(locale) },
    evidence: {
      snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash, candidateHash,
      retries: 0, fallbacks: 0, v2Fallthrough: 0,
      unsupportedClaimCategory: null, writerCandidateReachedValidation: true, evaluatorReached: true,
      safeNoOpConsidered: false, safeNoOpSelected: false, safeNoOpEligibilityReason: 'eligible',
      roleIdentityResolution: 'not_required',
    } };
}

function safeNoOpResponse(
  snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>,
  style: SummaryV3Style,
  unsupportedClaimCategory: string | null = null,
  evaluatorReached = true,
): Record<string, unknown> {
  return { kind: 'safe_no_op', style, mode: snapshot.mode, typedReason: 'safe_no_op',
    evidence: {
      snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash,
      noOpDetected: true, meaningfulChangeDetected: false, retries: 0, fallbacks: 0, v2Fallthrough: 0,
      unsupportedClaimCategory, writerCandidateReachedValidation: true, evaluatorReached,
      safeNoOpConsidered: true, safeNoOpSelected: true, safeNoOpEligibilityReason: 'eligible',
      roleIdentityResolution: 'not_required',
  } };
}

const physicalMixedLocaleSummary = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';

function physicalMixedLocaleCv(summary = physicalMixedLocaleSummary): CVData {
  const cv = createEmptyCv('en');
  cv.contentLocale = 'en';
  cv.personal.jobTitle = 'Electrical Service Technician';
  cv.experience = [{
    id: '8a9b0c1d-2e3f-4a5b-8c9d-0e1f2a3b4c5d',
    company: 'NordWerk Elektroservice Test',
    position: 'Electrical Service Technician',
    startDate: '2023-09',
    endDate: '',
    isPresent: true,
    description: [
      'Wartung elektrischer Anlagen',
      'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen',
      'Unterstützung bei der Installation elektrischer Komponenten',
    ].join('\n'),
    canonicalDescription: [
      'Wartung elektrischer Anlagen',
      'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen',
      'Unterstützung bei der Installation elektrischer Komponenten',
    ].join('\n'),
    descriptionSourceLocale: 'de',
  }];
  cv.summary = summary;
  cv.summarySourceLocale = 'en';
  cv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(summary);
  cv.summaryGeneratedLocale = 'en';
  return cv;
}

/** AAB566 correction: the selected Experience title is German while the
 * existing visible Summary remains the English source text. */
function physicalGermanPositionMixedLocaleCv(
  summary = physicalMixedLocaleSummary,
  personalJobTitle = 'Servicetechniker Elektrotechnik',
): CVData {
  const cv = createEmptyCv('en');
  cv.contentLocale = 'en';
  cv.personal.jobTitle = personalJobTitle;
  cv.experience = [{
    id: 'm8-aab566-experience-current',
    company: 'NordWerk Elektroservice Test',
    position: 'Servicetechniker Elektrotechnik',
    startDate: '2023-08',
    endDate: '',
    isPresent: true,
    description: [
      'Wartung elektrischer Anlagen',
      'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen',
      'Unterstützung bei der Installation elektrischer Komponenten',
    ].join('\n'),
    canonicalDescription: [
      'Wartung elektrischer Anlagen',
      'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen',
      'Unterstützung bei der Installation elektrischer Komponenten',
    ].join('\n'),
    descriptionSourceLocale: 'de',
  }];
  cv.summary = summary;
  cv.summarySourceLocale = 'en';
  cv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(summary);
  cv.summaryGeneratedLocale = 'en';
  return cv;
}

function pageRouteProviderMessage(
  invocation: SummaryV3StyleProviderInvocation,
  mode: NonNullable<Parameters<typeof actualPageStyleFlow>[0]['routeProviderMode']>,
): unknown {
  if (invocation.role === 'writer') {
    const input = invocation.input as SummaryV3StyleWriterInput;
    const sourceText = input.sourceText;
    const text = mode === 'safe_rewrite'
      ? 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I reliably maintain electrical systems, diagnose and resolve electrical faults, and support the installation of electrical components.'
      : mode === 'role_contradiction' || mode === 'role_unresolved'
        ? sourceText.replace('where I carry out', 'where I reliably carry out')
      : mode === 'unsafe_result'
        ? `${sourceText} This work improves operational efficiency and saves the company money.`
        : mode === 'unsafe_metric'
          ? `${sourceText} This work reduced downtime by 30%.`
          : sourceText;
    return {
      content: [{
        type: 'tool_use',
        name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
        input: {
          operationId: input.operationId,
          snapshotHash: input.snapshotHash,
          manifestHash: input.manifestHash,
          style: input.style,
          locale: input.locale,
          units: [{ unitId: 'physical-page-unit', text, factIds: input.requiredFacts.map((fact) => fact.id) }],
        },
      }],
    };
  }
  const input = invocation.input as SummaryV3StyleEvaluatorInput;
  const noOpDetected = mode === 'provider_no_op';
  return {
    content: [{
      type: 'tool_use',
      name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
      input: {
        operationId: input.operationId,
        snapshotHash: input.snapshotHash,
        manifestHash: input.manifestHash,
        style: input.style,
        locale: input.locale,
        candidateHash: input.candidate.hash,
        candidateUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
        phases: {
          structural: { status: 'passed', violations: [] },
          semantic_grounding: { status: 'passed', violations: [] },
          language_native_quality: { status: 'passed', violations: [] },
          style_fulfillment: { status: 'passed', violations: [] },
        },
        representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash),
        missingFactIdHashes: [],
        roleIdentityResolution: mode === 'role_contradiction' ? 'contradiction'
          : mode === 'role_unresolved' ? 'unresolved'
            : input.roleIdentity.status === 'unresolved' ? 'equivalent' : 'not_required',
        styleEvidence: {
          style: 'stronger',
          strongerPredicateTransformations: noOpDetected ? 0 : 1,
          structuralStrengtheningCount: noOpDetected ? 0 : 1,
          modifierOnlyTransformationDetected: false,
          repeatedStyleModifierCount: 0,
          stackedModifierDetected: false,
          unsupportedAuthorityDetected: false,
          strongerFulfilled: true,
          noOpDetected,
        },
      },
    }],
  };
}

async function run(options: RunOptions = {}) {
  const locale = options.locale || 'en';
  const style = options.style || 'shorter';
  const initialCv = options.initialCv || options.liveCv || cvFor(locale, options.summary || '');
  const liveCv = options.liveCv || initialCv;
  let capturedRequest: Record<string, unknown> | null = null;
  let commitRequest: SummaryV3CommitRequest | null = null;
  let requestCount = 0;
  const outcome = await runSummaryV3StyleClientOperation({
    enabled: options.enabled !== false, style, operationId: 'op', requestId: 'op', cv: initialCv,
    currentRoleExperienceId: options.currentRoleExperienceId === undefined ? 'experience-current' : options.currentRoleExperienceId,
    requestedLocale: options.requestedLocale || locale, sourceLocale: options.sourceLocale || locale, jobContextKey: 'job-context', referenceDateIso: '2026-09-01', usageCountBefore: 0, proToken: 'test-token', createdAt: 1000,
  }, {
    request: async (body) => {
      requestCount += 1;
      capturedRequest = body;
      if (options.requestError) throw options.requestError;
      const action = body.action;
      if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call({ summary_shorter: true, summary_stronger: true, summary_professional: true }, action)) throw new Error('invalid action');
      const normalized = normalizeSummaryV3StyleRouteRequest(action as SummaryV3StyleRouteAction, body as unknown as SummaryV3StyleRouteParams, options.serverReceivedAt || 2000);
      const snapshot = createSummaryV3StyleOperationSnapshot(normalized);
      const data = options.responseFactory ? options.responseFactory(snapshot) : candidateResponse(snapshot, style, locale, options.summary ? `${options.summary} improved` : `${locale} candidate`);
      return { status: options.status ?? options.responseStatus ?? 200, data };
    },
    getLiveCv: () => liveCv,
    getActiveOperationId: () => options.activeOperationId || 'op',
    commitCandidate: (request) => { commitRequest = request; return options.commitResult || committedReceipt(); },
  });
  return { outcome, capturedRequest, commitRequest, requestCount };
}

async function realSharedOperationRace(): Promise<{ first: Awaited<ReturnType<typeof runSummaryV3StyleClientOperation>>; second: Awaited<ReturnType<typeof runSummaryV3StyleClientOperation>>; commits: number }> {
  const cv = cvFor('en', 'Engineer builds APIs.');
  let activeOperationId = 'first';
  let releaseFirst!: () => void;
  let firstStarted!: () => void;
  const firstHasStarted = new Promise<void>((resolve) => { firstStarted = resolve; });
  const firstMayFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let commits = 0;
  const operation = (operationId: string, waitForRelease: boolean) => runSummaryV3StyleClientOperation({
    enabled: true, style: 'shorter', operationId, requestId: operationId, cv,
    currentRoleExperienceId: 'experience-current', requestedLocale: 'en', sourceLocale: 'en',
    jobContextKey: 'ctx', referenceDateIso: '2026-09-01', usageCountBefore: 0, proToken: 'x', createdAt: 1,
  }, {
    request: async (body) => {
      if (waitForRelease) firstStarted();
      if (waitForRelease) await firstMayFinish;
      const normalized = normalizeSummaryV3StyleRouteRequest('summary_shorter', body as unknown as SummaryV3StyleRouteParams, 2000);
      return { status: 200, data: candidateResponse(createSummaryV3StyleOperationSnapshot(normalized), 'shorter', 'en', `candidate-${operationId}`) };
    },
    getLiveCv: () => cv,
    getActiveOperationId: () => activeOperationId,
    commitCandidate: () => { commits += 1; return committedReceipt(); },
  });
  const firstPromise = operation('first', true);
  await firstHasStarted;
  activeOperationId = 'second';
  const secondPromise = operation('second', false);
  const second = await secondPromise;
  releaseFirst();
  const first = await firstPromise;
  return { first, second, commits };
}

describe('M5.3 Summary style client/page boundary', () => {
  it('uses one feature-gated client owner and never imports provider/server/V2 code at runtime', () => {
    const client = readFileSync(resolve(process.cwd(), 'src/lib/ai-core-v3/summary-style-m5-client.ts'), 'utf8');
    const page = readFileSync(resolve(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(client).not.toMatch(/summary-style-m5-(server|provider)|anthropic|cv-summary-v2/u);
    expect(page).toContain('isAiCoreV3Enabled');
    expect(page).toContain('runSummaryV3StyleClientOperation');
    const m5Handler = page.slice(page.indexOf('const handleSummaryV3Style'), page.indexOf('const handleRewrite'));
    expect(m5Handler).not.toContain('document.querySelector');
    expect(m5Handler).toContain('canonicalizeSummarySourceLocale');
    expect(m5Handler).toContain('currentRoleExperienceId');
    expect(m5Handler).toContain('resolveSummaryV3StyleM5ClientAbortTimeoutMs()');
    expect(resolveSummaryV3StyleM5ClientAbortTimeoutMs()).toBe(85_000);
    expect(SUMMARY_V3_STYLE_M5_CLIENT_ABORT_TIMEOUT_MS).toBe(85_000);
  });

  it('keeps terminal Summary diagnostic persistence idempotent', () => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
    const storageWrites = vi.spyOn(Storage.prototype, 'setItem');
    const commits: Event[] = [];
    const onCommit = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; action?: string }>).detail;
      if (event.type === CV_AI_DIAGNOSTICS_CHANGED_EVENT
        && detail?.kind === 'summary' && detail.action === 'commit') commits.push(event);
    };
    window.addEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onCommit);
    try {
      const diagnostic = new SummaryAiDiagnosticSession({
        uiLocale: 'en', requestedLocale: 'en', contentLocale: 'en',
        templateId: 'idempotence', requestId: 'm8-summary-diagnostic-idempotence',
        usageCountBefore: 0, operationMode: 'enhance_existing_content', rewriteStyle: 'shorter',
      });
      diagnostic.recordPreCandidateTerminalFailure({
        stage: 'api_response', reason: 'generation_validation_failed', usageAfter: 0,
      });

      const first = diagnostic.commit();
      const second = diagnostic.commit();

      expect(second).toBe(first);
      expect(storageWrites.mock.calls.filter(([key]) => key === SUMMARY_AI_DIAG_STORAGE_KEY)).toHaveLength(1);
      expect(getCvAiDiagnosticHistory('summary')).toHaveLength(1);
      expect(commits).toHaveLength(1);
    } finally {
      window.removeEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onCommit);
      localStorage.clear();
      clearSummaryAiDiagnosticsForTests();
      clearCvAiDiagnosticHistory();
    }
  });

  it.each(Object.keys(localeFixtures))('routes same-locale %s through one action contract', async (locale) => {
    const { outcome, capturedRequest } = await run({ locale });
    expect(SUMMARY_V3_STYLE_M5_ACTION.shorter).toBe('summary_shorter');
    expect((capturedRequest as unknown as Record<string, unknown> | null)?.action).toBe('summary_shorter');
    expect(outcome.kind).toBe('committed');
  });

  it.each([
    ['shorter', 'summary_shorter'],
    ['stronger', 'summary_stronger'],
    ['professional', 'summary_professional'],
  ] as const)('executes the real V3-enabled page path for %s exactly once', async (style, action) => {
    const result = await actualPageStyleFlow({ style });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.m5Requests[0]?.action).toBe(action);
    expect(result.legacyRequests).toHaveLength(0);
  });

  it('routes an AAB562-equivalent omitted-flag internal Stronger click to one fresh M5 owner', async () => {
    const internalBuildEnvironment: Record<string, string | undefined> = {};
    const contract = androidInternalV3RoutingContract
      .enforceAndroidInternalV3RoutingContract(internalBuildEnvironment);
    const result = await actualPageStyleFlow({
      style: 'stronger',
      compiledPublicV3Flag: internalBuildEnvironment.NEXT_PUBLIC_AI_CORE_V3_ENABLED,
      summary: 'I have approximately three years of experience and maintain electrical systems.',
      candidateText: 'I bring approximately three years of experience and reliably maintain electrical systems.',
      safeNoOp: false,
      awaitDiagnostic: true,
      seedOldGenerateTrace: true,
    });

    expect(contract.summaryStyleOwner).toBe('m5');
    expect(result.m5Requests).toHaveLength(1);
    expect(result.m5Requests[0]?.action).toBe('summary_stronger');
    expect(result.legacyRequests).toHaveLength(0);
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'stronger',
      operationMode: 'enhance_existing_content',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      missingRequiredDiagnosticFields: [],
      nullRequiredDiagnosticFields: [],
      notApplicableDiagnosticFieldViolations: [],
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 0,
      usageCountAfter: 1,
    });
    for (const legacyField of [
      'summaryV2FactIdPathActive',
      'candidateTransformationKind',
      'candidateLineage',
      'fallbackAttempted',
      'fallbackApplied',
      'deterministicAccepted',
      'm4Operation',
    ]) {
      expect(result.latestDiagnostic).not.toHaveProperty(legacyField);
    }
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
  });

  it.each([
    ['safe rewrite', 'safe_rewrite', 'committed', 1, false],
    ['unsafe business result', 'unsafe_result', 'safe_no_op', 0, false],
    ['unsafe metric', 'unsafe_metric', 'safe_no_op', 0, false],
    ['provider no-op', 'provider_no_op', 'safe_no_op', 0, false],
    ['invalid existing source', 'invalid_existing_source', 'terminal', 0, true],
  ] as const)('runs the physical mixed-locale rendered Stronger path for %s', async (
    _label,
    routeProviderMode,
    expectedTerminal,
    expectedUsage,
    expectsError,
  ) => {
    const invalidExisting = routeProviderMode === 'invalid_existing_source';
    const summary = invalidExisting
      ? `${physicalMixedLocaleSummary} This work reduced downtime by 30%.`
      : physicalMixedLocaleSummary;
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalMixedLocaleCv(summary),
      routeProviderMode,
      awaitDiagnostic: true,
    });

    expect(result.m5Requests).toHaveLength(1);
    expect(result.legacyRequests).toHaveLength(0);
    const request = result.m5Requests[0] as SummaryV3StyleRouteParams;
    expect(request).toMatchObject({
      action: 'summary_stronger',
      requestedLocale: 'en',
      sourceLocale: 'en',
      visibleSummary: summary,
    });
    expect(request.manifest).toMatchObject({ sourceLocale: 'en' });
    const manifest = request.manifest as { entries: unknown[]; currentRoleEntryId: string | null };
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.currentRoleEntryId).toBe(`entry-${hashSummaryV3StyleValue('8a9b0c1d-2e3f-4a5b-8c9d-0e1f2a3b4c5d')}`);
    expect((manifest.entries[0] as { facts: unknown[] }).facts).toHaveLength(3);
    expect(request.visibleSummaryFacts).toBeUndefined();
    expect(result.usageCalls).toBe(expectedUsage);
    expect(result.commitCalls).toBe(expectedUsage);
    expect(result.errorToasts).toBe(expectsError ? 1 : 0);
    if (expectedTerminal === 'committed') {
      expect(result.finalCv.summary).not.toBe(summary);
      expect(result.latestDiagnostic).toMatchObject({
        visibleApplySucceeded: true,
        countedAsSuccess: true,
        usageCountBefore: 0,
        usageCountAfter: 1,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'eligible',
      });
    } else if (expectedTerminal === 'safe_no_op') {
      expect(result.finalCv.summary).toBe(summary);
      expect(result.latestDiagnostic).toMatchObject({
        visibleApplySucceeded: false,
        countedAsSuccess: false,
        usageCountBefore: 0,
        usageCountAfter: 0,
        safeNoOpConsidered: true,
        safeNoOpSelected: true,
        safeNoOpEligibilityReason: 'eligible',
      });
    } else {
      expect(result.finalCv.summary).toBe(summary);
      expect(result.latestDiagnostic).toMatchObject({
        visibleApplySucceeded: false,
        countedAsSuccess: false,
        usageCountBefore: 0,
        usageCountAfter: 0,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'source_inconsistency',
      });
    }
    expect(result.latestDiagnostic?.diagnosticCompletenessPassed).toBe(true);
    expect(result.latestDiagnostic?.diagnosticInvariantCheckPassed).toBe(true);
  });

  it('runs the corrected AAB566 German-position fixture through the rendered page/request-builder/route/server path', async () => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(),
      routeProviderMode: 'safe_rewrite',
      awaitDiagnostic: true,
    });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.legacyRequests).toHaveLength(0);
    const request = result.m5Requests[0] as SummaryV3StyleRouteParams;
    expect(request).toMatchObject({
      action: 'summary_stronger',
      requestedLocale: 'en',
      sourceLocale: 'en',
      visibleSummary: physicalMixedLocaleSummary,
    });
    const manifest = request.manifest as unknown as { entries: unknown[] };
    const entry = manifest.entries[0] as Record<string, unknown>;
    expect(entry).toMatchObject({
      role: 'Servicetechniker Elektrotechnik',
      employer: 'NordWerk Elektroservice Test',
      roleSourceLocale: 'de',
      rolePresentation: undefined,
      durationMonths: 37,
    });
    expect(result.finalCv.summary).not.toBe(physicalMixedLocaleSummary);
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'stronger',
      operationMode: 'enhance_existing_content',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 0,
      usageCountAfter: 1,
      roleIdentityResolution: 'equivalent',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      missingRequiredDiagnosticFields: [],
      nullRequiredDiagnosticFields: [],
      notApplicableDiagnosticFieldViolations: [],
    });
  });

  it.each([
    ['empty', ''],
    ['unrelated', 'Unrelated Personal Header Title'],
  ])('keeps the selected Experience role authoritative when personal.jobTitle is %s', async (_label, personalJobTitle) => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(physicalMixedLocaleSummary, personalJobTitle),
      routeProviderMode: 'safe_rewrite',
      awaitDiagnostic: true,
    });
    const request = result.m5Requests[0] as SummaryV3StyleRouteParams;
    const manifest = request.manifest as unknown as { currentRoleEntryId: string | null; entries: Array<Record<string, unknown>> };
    expect(manifest.currentRoleEntryId).toBe(`entry-${hashSummaryV3StyleValue('m8-aab566-experience-current')}`);
    expect(manifest.entries[0]).toMatchObject({
      role: 'Servicetechniker Elektrotechnik',
      employer: 'NordWerk Elektroservice Test',
      roleSourceLocale: 'de',
    });
    expect(manifest.entries[0]?.role).not.toBe(personalJobTitle || undefined);
    expect(result).toMatchObject({ commitCalls: 1, usageCalls: 1, errorToasts: 0 });
    expect(result.latestDiagnostic).toMatchObject({
      roleIdentityResolution: 'equivalent',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 0,
      usageCountAfter: 1,
    });
  });

  it('rejects a different English role at the same employer without apply or usage', async () => {
    const wrongRoleSummary = physicalMixedLocaleSummary.replace('Electrical Service Technician', 'Software Engineer');
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(wrongRoleSummary, 'Unrelated Personal Header Title'),
      routeProviderMode: 'role_contradiction',
      awaitDiagnostic: true,
    });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.legacyRequests).toHaveLength(0);
    expect(result.finalCv.summary).toBe(wrongRoleSummary);
    expect(result).toMatchObject({ commitCalls: 0, usageCalls: 0, errorToasts: 1 });
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      finalTypedFailureReason: 'unsupported_claim',
      unsupportedClaimCategory: 'source_floor_mismatch',
      roleIdentityResolution: 'contradiction',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      safeNoOpSelected: false,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
  });

  it('keeps a corrected German-position source floor from turning an invented metric into a successful or safe-no-op rewrite', async () => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(),
      routeProviderMode: 'unsafe_metric',
      awaitDiagnostic: true,
    });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.finalCv.summary).toBe(physicalMixedLocaleSummary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.errorToasts).toBe(1);
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'stronger',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      safeNoOpSelected: false,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
  });

  it('replaces an old Generate trace with one fresh Stronger terminal diagnostic for the physical 422 error shape', async () => {
    const physicalSummary = 'I have approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, and assist with the installation of electrical components.';
    const result = await actualPageStyleFlow({
      style: 'stronger',
      summary: physicalSummary,
      seedOldGenerateTrace: true,
      terminalResponse: {
        status: 422,
        data: {
          error: 'synthetic safe validation rejection',
          code: 'generation_validation_failed',
        },
      },
    });

    expect(result.m5Requests).toHaveLength(1);
    expect(result.m5Requests[0]?.action).toBe('summary_stronger');
    expect(result.legacyRequests).toHaveLength(0);
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      rejectionStage: 'api_response',
      finalTypedFailureReason: 'generation_validation_failed',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      usageCountBefore: 0,
      usageCountAfter: 0,
      notApplicableDiagnosticFieldViolations: [],
    });
    expect(result.latestDiagnostic?.missingRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.nullRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.stages).toContainEqual({
      name: 'api_response',
      status: 'fail',
      reason: 'generation_validation_failed',
    });
    expect(result.finalCv.summary).toBe(physicalSummary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.errorToasts).toBe(1);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
    for (const legacyField of [
      'summaryV2FactIdPathActive',
      'candidateTransformationKind',
      'candidateLineage',
      'fallbackAttempted',
      'fallbackApplied',
      'deterministicAccepted',
      'm4Operation',
    ]) {
      expect(result.latestDiagnostic).not.toHaveProperty(legacyField);
    }
  });

  it('preserves the exact AAB567 M5 feature-gate 409 reason in the rendered-page diagnostic', async () => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(),
      seedOldGenerateTrace: true,
      terminalResponse: {
        status: 409,
        data: {
          ok: false,
          action: 'summary_stronger',
          typedReason: 'v3_feature_disabled',
        },
      },
    });

    expect(result.m5Requests).toHaveLength(1);
    expect(result.legacyRequests).toHaveLength(0);
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      rejectionStage: 'api_response',
      finalTypedFailureReason: 'v3_feature_disabled',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      usageCountBefore: 0,
      usageCountAfter: 0,
    });
    expect(result.latestDiagnostic?.missingRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.nullRequiredDiagnosticFields).toEqual([]);
    expect(result.finalCv.summary).toBe(physicalMixedLocaleSummary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.errorToasts).toBe(1);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
  });

  it('preserves only approved M5 evidence through a typed 422 error envelope', async () => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      summary: physicalMixedLocaleSummary,
      terminalResponse: {
        status: 422,
        data: {
          kind: 'handled_failure',
          typedReason: 'unsupported_claim',
          // Deliberately prove that arbitrary response text is not projected
          // into a persisted M5 diagnostic.
          candidateText: 'must not persist',
          evidence: {
            unsupportedClaimCategory: 'source_floor_mismatch',
            writerCandidateReachedValidation: false,
            evaluatorReached: false,
            safeNoOpConsidered: false,
            safeNoOpSelected: false,
            safeNoOpEligibilityReason: 'role_employer_frame_inconsistency',
            roleIdentityResolution: 'contradiction',
          },
        },
      },
    });

    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      finalTypedFailureReason: 'unsupported_claim',
      unsupportedClaimCategory: 'source_floor_mismatch',
      writerCandidateReachedValidation: false,
      evaluatorReached: false,
      safeNoOpConsidered: false,
      safeNoOpSelected: false,
      safeNoOpEligibilityReason: 'role_employer_frame_inconsistency',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    expect(result.latestDiagnostic).not.toHaveProperty('candidateText');
    expect(result.finalCv.summary).toBe(physicalMixedLocaleSummary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
  });

  it('persists a known SDK failure cause and actual upstream status without raw provider data', async () => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(),
      terminalResponse: {
        status: 429,
        data: {
          kind: 'handled_failure',
          typedReason: 'writer_request_failed',
          evidence: {
            unsupportedClaimCategory: null,
            writerCandidateReachedValidation: false,
            evaluatorReached: false,
            safeNoOpConsidered: false,
            safeNoOpSelected: false,
            safeNoOpEligibilityReason: 'source_inconsistency',
            roleIdentityResolution: 'unresolved',
            m5ProviderFailure: {
              phase: 'initial_writer',
              failureStage: 'sdk_request',
              errorClass: 'RateLimitError',
              providerHttpStatus: 429,
              providerErrorType: 'rate_limit',
              providerErrorCode: 'rate_limit_error',
              providerRequestIdHash: null,
              providerRetryable: true,
              providerMessageFingerprint: null,
              providerStructuralFieldPath: null,
              providerHttpResponseReceived: true,
              providerDeadlineOwner: null,
              providerConfiguredTimeoutMs: null,
              providerEffectiveTimeoutMs: null,
              providerElapsedMs: null,
              providerOuterBudgetRemainingAtStartMs: null,
            },
          },
        },
      },
    });
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      finalTypedFailureReason: 'writer_request_failed',
      rejectionStage: 'api_response',
      providerHttpStatus: 429,
      m5FailureStage: 'sdk_request',
      m5CanonicalFailureCause: 'rate_limit',
      roleIdentityResolution: 'unresolved',
      safeNoOpEligibilityReason: 'source_inconsistency',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    expect(result.latestDiagnostic).not.toHaveProperty('m5ProviderFailure');
    expect(result.finalCv.summary).toBe(physicalMixedLocaleSummary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
  });

  it('routes the typed AAB570 writer timeout to the existing localized timeout toast without usage', async () => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(),
      terminalResponse: {
        status: 504,
        data: {
          kind: 'handled_failure',
          typedReason: 'writer_request_failed',
          evidence: {
            unsupportedClaimCategory: null,
            writerCandidateReachedValidation: false,
            evaluatorReached: false,
            safeNoOpConsidered: false,
            safeNoOpSelected: false,
            safeNoOpEligibilityReason: 'source_inconsistency',
            roleIdentityResolution: 'unresolved',
            m5ProviderFailure: {
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
              providerConfiguredTimeoutMs: 30_000,
              providerEffectiveTimeoutMs: 30_000,
              providerElapsedMs: 30_000,
              providerOuterBudgetRemainingAtStartMs: 75_000,
            },
          },
        },
      },
    });
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'stronger',
      finalTypedFailureReason: 'writer_request_failed',
      m5FailureStage: 'sdk_request',
      m5CanonicalFailureCause: 'timeout',
      providerHttpStatus: null,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    expect(result.errorToasts).toBe(1);
    expect(pageToastError).toHaveBeenLastCalledWith(aiErrorMessage('request_timeout', 'en'));
    expect(result.finalCv.summary).toBe(physicalMixedLocaleSummary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
  });

  it.each([
    ['handled failure', 422, { kind: 'handled_failure', typedReason: 'unsupported_claim' }, 'unsupported_claim'],
    ['not applicable', 422, { kind: 'not_applicable', reason: 'cross_locale' }, 'cross_locale'],
    ['malformed writer', 502, { kind: 'handled_failure', typedReason: 'writer_transport_malformed' }, 'writer_transport_malformed'],
    ['malformed evaluator', 502, { kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' }, 'evaluator_transport_malformed'],
    ['provider exception', 503, {
      kind: 'route_failure',
      typedReason: 'provider_temporarily_unavailable',
      evidence: {
        unsupportedClaimCategory: null,
        writerCandidateReachedValidation: false,
        evaluatorReached: false,
        safeNoOpConsidered: false,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'not_applicable',
        roleIdentityResolution: 'not_required',
      },
    }, 'provider_temporarily_unavailable'],
    ['unknown result', 409, { kind: 'future_terminal', typedReason: 'v3_feature_disabled' }, 'unclassified_transport_response'],
  ] as const)('keeps rendered-page transport matrix case %s terminal and usage-neutral', async (
    _label,
    status,
    data,
    reason,
  ) => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      cv: physicalGermanPositionMixedLocaleCv(),
      terminalResponse: { status, data },
    });
    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'stronger',
      finalTypedFailureReason: reason,
      rejectionStage: 'api_response',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    expect(result.finalCv.summary).toBe(physicalMixedLocaleSummary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
  });

  it('publishes a same-operation stale snapshot as the latest diagnostic and preserves the user edit', async () => {
    const result = await actualPageStyleFlow({
      style: 'stronger',
      summary: 'Ava Patel builds APIs.',
      seedOldGenerateTrace: true,
      holdTransport: true,
      mutateLiveSummaryWhilePending: true,
      awaitDiagnostic: true,
      safeNoOp: false,
    });

    expect(result.latestDiagnostic).toMatchObject({
      rewriteStyle: 'stronger',
      operationMode: 'enhance_existing_content',
      rejectionStage: 'race_guard',
      finalTypedFailureReason: 'stale_snapshot',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
    });
    expect(result.latestDiagnostic?.missingRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.nullRequiredDiagnosticFields).toEqual([]);
    expect(result.finalCv.summary).toBe('User edited Summary while Stronger is pending.');
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
  });

  it('persists a terminal diagnostic for an HTTP 200 error body without applying or consuming usage', async () => {
    const summary = 'Engineer builds APIs.';
    const result = await actualPageStyleFlow({
      style: 'professional',
      summary,
      terminalResponse: {
        status: 200,
        data: { error: 'synthetic safe rate-limit response', code: 'server_rate_limited' },
      },
    });

    expect(result.latestDiagnostic).toMatchObject({
      rewriteStyle: 'professional',
      operationMode: 'enhance_existing_content',
      finalTypedFailureReason: 'server_rate_limited',
      rejectionStage: 'api_response',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      usageCountBefore: 0,
      usageCountAfter: 0,
    });
    expect(result.latestDiagnostic?.missingRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.nullRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.stages).toContainEqual({
      name: 'api_response', status: 'fail', reason: 'server_rate_limited',
    });
    expect(result.finalCv.summary).toBe(summary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
  });

  it('persists a network terminal diagnostic without applying or consuming usage', async () => {
    const summary = 'Engineer builds APIs.';
    const result = await actualPageStyleFlow({
      style: 'shorter',
      summary,
      requestError: new Error('synthetic transport failure'),
      awaitDiagnostic: true,
    });

    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'shorter',
      finalTypedFailureReason: 'network_error',
      rejectionStage: 'api_response',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      usageCountBefore: 0,
      usageCountAfter: 0,
    });
    expect(result.latestDiagnostic?.missingRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.nullRequiredDiagnosticFields).toEqual([]);
    expect(result.finalCv.summary).toBe(summary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
  });

  it.each(['shorter', 'stronger', 'professional'] as const)('derives %s source/requested locale from actual mixed-locale page state and commits atomically', async (style) => {
    const summary = 'Prüft Prozesse und koordiniert Termine.';
    const candidate = 'Prüft Prozesse und koordiniert Termine zuverlässig.';
    const result = await actualPageStyleFlow({
      style,
      uiLocale: 'fr',
      contentLocale: 'en',
      summary,
      summarySourceLocale: 'de',
      candidateText: candidate,
      safeNoOp: false,
    });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.m5Requests[0]?.requestedLocale).toBe('de');
    expect(result.m5Requests[0]?.sourceLocale).toBe('de');
    expect(result.m5Requests[0]?.visibleSummary).toBe(summary);
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
    expect(result.finalCv.contentLocale).toBe('en');
    expect(result.finalCv.summary).toBe(candidate);
    expect(result.finalCv.summarySourceLocale).toBe('de');
    expect(result.finalCv.summarySourceLocaleTextHash).toBe(hashSummarySourceLocaleText(candidate));
  });

  it.each(['shorter', 'stronger', 'professional'] as const)('executes the existing legacy path when V3 is disabled for %s', async (style) => {
    const result = await actualPageStyleFlow({ style, enabled: false });
    expect(result.m5Requests).toHaveLength(0);
    expect(result.legacyRequests.length).toBeGreaterThan(0);
    expect(result.legacyRequests.every((body) => !String(body.action || '').startsWith('summary_'))).toBe(true);
    expect(result.beginLocales).toHaveLength(0);
  });

  it('uses the real CV content locale for the M5 request context and body', async () => {
    const result = await actualPageStyleFlow({ style: 'shorter', uiLocale: 'de', contentLocale: 'en' });
    expect(result.beginLocales).toEqual(['en']);
    expect(result.m5Requests[0]?.requestedLocale).toBe('en');
    expect(result.m5Requests[0]?.sourceLocale).toBe('en');
  });

  it('uses a valid current-text Summary binding for a mixed-locale M5 style request', async () => {
    const summary = 'Prüft Prozesse und koordiniert Termine.';
    const mixed = cvFor('de', summary);
    mixed.contentLocale = 'en';
    mixed.summarySourceLocale = 'de';
    mixed.summarySourceLocaleTextHash = hashSummarySourceLocaleText(summary);
    const { capturedRequest, commitRequest, outcome } = await run({
      liveCv: mixed,
      locale: 'de',
      requestedLocale: 'de',
      sourceLocale: 'de',
      style: 'shorter',
    });
    expect(outcome.kind).toBe('committed');
    expect(capturedRequest?.requestedLocale).toBe('de');
    expect(capturedRequest?.sourceLocale).toBe('de');
    expect(commitRequest?.nextCv.contentLocale).toBe('en');
    expect(commitRequest?.nextCv.summarySourceLocale).toBe('de');
    expect(commitRequest?.nextCv.summarySourceLocaleTextHash).toBe(
      hashSummarySourceLocaleText(commitRequest?.nextCv.summary || ''),
    );
  });

  it('preserves pt-BR canonical identity through the actual page/content-locale boundary', async () => {
    const result = await actualPageStyleFlow({ style: 'professional', contentLocale: 'pt_BR' });
    expect(result.beginLocales).toEqual(['pt-BR']);
    expect(result.m5Requests[0]?.requestedLocale).toBe('pt-BR');
    expect(result.m5Requests[0]?.sourceLocale).toBe('pt-BR');
  });

  it('executes safe no-op UX through the real page with one request and no success/error toast', async () => {
    const result = await actualPageStyleFlow({ style: 'shorter', safeNoOp: true, awaitDiagnostic: true });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.legacyRequests).toHaveLength(0);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.successToasts).toBe(0);
    expect(result.errorToasts).toBe(0);
    expect(result.latestDiagnostic).toMatchObject({
      rewriteStyle: 'shorter',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      rejectionStage: null,
      finalCandidateSource: 'none',
      providerCandidatePresent: true,
      apiResponseKind: 'provider',
      serverFallbackUsed: false,
      clientFallbackUsed: false,
      unsupportedClaimCategory: null,
      writerCandidateReachedValidation: true,
      evaluatorReached: true,
      safeNoOpConsidered: true,
      safeNoOpSelected: true,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      usageCountBefore: 0,
      usageCountAfter: 0,
    });
    expect(result.latestDiagnostic?.missingRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.nullRequiredDiagnosticFields).toEqual([]);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
  });

  it('persists a privacy-safe Stronger source-retention no-op after an unsafe writer candidate', async () => {
    const summary = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';
    const result = await actualPageStyleFlow({
      style: 'stronger',
      summary,
      safeNoOp: true,
      safeNoOpUnsupportedClaimCategory: 'unsupported_result_relation',
      safeNoOpEvaluatorReached: false,
      awaitDiagnostic: true,
    });

    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'stronger',
      providerCandidatePresent: true,
      unsupportedClaimCategory: 'unsupported_result_relation',
      writerCandidateReachedValidation: true,
      evaluatorReached: false,
      safeNoOpConsidered: true,
      safeNoOpSelected: true,
      noOpDetected: true,
      visibleApplySucceeded: false,
      countedAsSuccess: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    expect(result.finalCv.summary).toBe(summary);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.successToasts).toBe(0);
    expect(result.errorToasts).toBe(0);
  });

  it('persists one successful applied rewrite diagnostic with exactly one usage increment', async () => {
    const result = await actualPageStyleFlow({
      style: 'shorter',
      summary: 'Engineer builds APIs.',
      candidateText: 'Engineer builds APIs efficiently.',
      safeNoOp: false,
      awaitDiagnostic: true,
    });

    expect(result.latestDiagnostic).toMatchObject({
      m5Operation: 'summary_style',
      rewriteStyle: 'shorter',
      operationMode: 'enhance_existing_content',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      rejectionStage: null,
      usageCountBefore: 0,
      usageCountAfter: 1,
      apiResponseKind: 'provider',
      serverFallbackUsed: false,
      clientFallbackUsed: false,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    expect(result.latestDiagnostic?.missingRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.nullRequiredDiagnosticFields).toEqual([]);
    expect(result.latestDiagnostic?.notApplicableDiagnosticFieldViolations).toEqual([]);
    expect(result.latestDiagnostic).not.toHaveProperty('finalUnitRoleSlots');
    expect(result.latestDiagnostic).not.toHaveProperty('finalUnitSemanticRolesByUnit');
    expect(result.latestDiagnostic).not.toHaveProperty('finalDurationOwnerDetected');
    expect(result.latestDiagnostic).not.toHaveProperty('currentRoleConcreteFactCoverage');
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
    expect(result.diagnosticStorageWrites).toBe(1);
    expect(result.diagnosticHistoryEntries).toBe(1);
    expect(result.diagnosticCommitEvents).toBe(1);
  });

  it('transports the exact visible Summary string through the real page', async () => {
    const summary = '  Engineer builds APIs.  ';
    const result = await actualPageStyleFlow({ style: 'professional', summary });
    expect(result.m5Requests[0]?.visibleSummary).toBe(summary);
  });

  it('keeps empty Summary generation in M5 generate_from_context mode without a legacy bridge', async () => {
    const result = await actualPageStyleFlow({ style: 'shorter', summary: '' });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.legacyRequests).toHaveLength(0);
    const normalized = normalizeSummaryV3StyleRouteRequest('summary_shorter', result.m5Requests[0] as unknown as SummaryV3StyleRouteParams, 2000);
    expect(createSummaryV3StyleOperationSnapshot(normalized).mode).toBe('generate_from_context');
  });

  it('accepts server-owned createdAt while local preflight createdAt differs', async () => {
    let serverSnapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot> | null = null;
    const { outcome, capturedRequest, commitRequest } = await run({
      serverReceivedAt: 2000,
      responseFactory: (snapshot) => {
        serverSnapshot = snapshot;
        return candidateResponse(snapshot, 'shorter', 'en', 'server-owned candidate');
      },
    });
    const localSnapshot = createSummaryV3StyleOperationSnapshot(normalizeSummaryV3StyleRouteRequest(
      'summary_shorter',
      capturedRequest as unknown as SummaryV3StyleRouteParams,
      1000,
    ));
    const observedServerSnapshot = serverSnapshot as unknown as ReturnType<typeof createSummaryV3StyleOperationSnapshot>;
    const observedCommitRequest = commitRequest as unknown as SummaryV3CommitRequest;
    expect(outcome.kind).toBe('committed');
    expect((capturedRequest as unknown as Record<string, unknown> | null)?.createdAt).toBe(1000);
    expect(localSnapshot.snapshotHash).not.toBe(observedServerSnapshot.snapshotHash);
    expect(localSnapshot.manifestHash).toBe(observedServerSnapshot.manifestHash);
    expect(observedCommitRequest.candidateHash).toBe(hashSummaryV3Value('server-owned candidate'));
  });

  it('uses CV content locale when UI locale differs', async () => {
    const uiLocale = 'de';
    const { capturedRequest, outcome } = await run({ locale: 'en' });
    expect(uiLocale).toBe('de');
    expect((capturedRequest as unknown as Record<string, unknown> | null)?.requestedLocale).toBe('en');
    expect((capturedRequest as unknown as Record<string, unknown> | null)?.sourceLocale).toBe('en');
    expect(outcome.kind).toBe('committed');
  });

  it('preserves exact visible Summary text and keeps empty generation inside M5', async () => {
    const summary = '  Ava Patel builds APIs.  ';
    const { outcome, commitRequest } = await run({ summary, style: 'professional' });
    expect(outcome.kind).toBe('committed');
    expect((commitRequest as unknown as SummaryV3CommitRequest | null)?.nextCv.summary).toBe(`${summary.trimStart()} improved`);
    expect(((await run({ summary, style: 'professional' })).capturedRequest as unknown as Record<string, unknown> | null)?.visibleSummaryFacts).toBeUndefined();
    expect(((await run()).capturedRequest as unknown as Record<string, unknown> | null)?.visibleSummaryFacts).toBeUndefined();
    expect((await run()).outcome.kind).toBe('committed');
  });

  it('passes the page-resolved current role identity without a local ranking engine', async () => {
    const cv = cvFor('en');
    cv.experience.unshift({ id: 'experience-older', company: 'Old', position: 'Former', startDate: '2018-01', endDate: '2019-01', isPresent: false, description: 'maintains systems' });
    const resolved = resolveSummaryCurrentRole(cv.experience);
    expect(resolved?.id).toBe('experience-current');
    const { capturedRequest } = await run({ currentRoleExperienceId: resolved?.id, liveCv: cv });
    const manifest = (capturedRequest as unknown as Record<string, unknown>).manifest as SummaryV3StyleRequest['manifest'];
    expect(manifest.currentRoleEntryId).toBe(`entry-${hashSummaryV3StyleValue('experience-current')}`);
  });

  it('adds grounded stronger-duty evidence without requiring a name prefix', async () => {
    const { capturedRequest } = await run({ style: 'stronger', summary: 'Lead Engineer builds APIs. Acme teams.' });
    const facts = (capturedRequest as unknown as Record<string, unknown>).visibleSummaryFacts as Array<Record<string, unknown>>;
    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({ text: 'builds APIs', semanticKind: 'duty', transformableDuty: { predicateAnchor: 'builds', sourcePredicate: 'builds' } });
  });

  it.each([
    ['absent duty', 'Engineer leads teams.', 'builds APIs'],
    ['duplicate duty', 'Engineer builds APIs. Engineer builds APIs.', 'builds APIs'],
    ['two eligible duties', 'Engineer builds APIs, leads teams.', 'builds APIs\nleads teams'],
    ['numeric anchor', 'Engineer 20% growth.', '20% growth'],
  ])('does not annotate stronger provenance for %s', async (_label, summary, description) => {
    const cv = cvFor('en', summary);
    cv.experience[0]!.description = description;
    const { capturedRequest } = await run({ style: 'stronger', summary, liveCv: cv });
    const facts = (capturedRequest as unknown as Record<string, unknown>).visibleSummaryFacts as Array<Record<string, unknown>> | undefined;
    expect(facts).toBeUndefined();
  });

  it.each(['shorter', 'professional'] as const)('does not duplicate M5.1 visible facts for %s', async (style) => {
    const result = await run({ style, summary: 'Engineer builds APIs.' });
    expect((result.capturedRequest as unknown as Record<string, unknown> | null)?.visibleSummaryFacts).toBeUndefined();
  });

  it('returns a validated safe_no_op without commit or generic failure', async () => {
    const result = await run({ summary: 'Engineer builds APIs.', responseFactory: (snapshot) => safeNoOpResponse(snapshot, 'shorter') });
    expect(result.outcome).toMatchObject({ kind: 'safe_no_op', status: 200, reason: 'safe_no_op' });
    expect(result.commitRequest).toBeNull();
    expect(result.requestCount).toBe(1);
  });

  it('rejects a safe_no_op on non-200 without generic writer failure', async () => {
    const result = await run({ status: 422, responseFactory: (snapshot) => safeNoOpResponse(snapshot, 'shorter') });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 422, reason: 'safe_no_op_non_200' });
    expect(result.commitRequest).toBeNull();
    expect(result.requestCount).toBe(1);
  });

  it.each([
    ['handled failure 422', 422, { kind: 'handled_failure', typedReason: 'provider_schema_rejected' }],
    ['handled failure 502', 502, { kind: 'handled_failure', typedReason: 'provider_transport_failed' }],
    ['not applicable 422', 422, { kind: 'not_applicable', reason: 'summary_not_applicable' }],
    ['malformed writer 502', 502, { kind: 'handled_failure', typedReason: 'writer_transport_malformed' }],
    ['malformed evaluator 502', 502, { kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' }],
    ['provider exception 503', 503, { kind: 'route_failure', typedReason: 'provider_temporarily_unavailable' }],
  ] as const)('preserves exact typed terminal reason for %s', async (_label, status, data) => {
    const result = await run({ status, responseFactory: () => data });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status, reason: 'typedReason' in data ? data.typedReason : data.reason });
    expect(result.commitRequest).toBeNull();
    expect(result.requestCount).toBe(1);
  });

  it('preserves the exact legacy M5 feature-gate envelope instead of blaming writer transport', async () => {
    const result = await run({
      status: 409,
      responseFactory: () => ({
        ok: false,
        action: 'summary_stronger',
        typedReason: 'v3_feature_disabled',
      }),
    });
    expect(result.outcome).toMatchObject({
      kind: 'terminal',
      status: 409,
      reason: 'v3_feature_disabled',
    });
    expect(result.commitRequest).toBeNull();
    expect(result.requestCount).toBe(1);
  });

  it.each([409, 422, 502])('rejects candidate_ready on HTTP %s', async (status) => {
    const result = await run({ status });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status, reason: 'candidate_non_200' });
    expect(result.commitRequest).toBeNull();
  });

  it.each([
    ['unknown kind', { kind: 'future_terminal', typedReason: 'v3_feature_disabled' }],
    ['non-string kind', { kind: 42, typedReason: 'v3_feature_disabled' }],
    ['unknown legacy code', { code: 'invented_transport_reason' }],
    ['conflicting finite reasons', { typedReason: 'v3_feature_disabled', code: 'server_rate_limited' }],
  ] as const)('fails closed on %s without blaming the writer parser', async (_label, response) => {
    const result = await run({ status: 409, responseFactory: () => response });
    expect(result.outcome).toMatchObject({
      kind: 'terminal',
      status: 409,
      reason: 'unclassified_transport_response',
    });
    expect(result.commitRequest).toBeNull();
  });

  it.each([
    ['malformed result', () => ({ prose: 'free text' })],
    ['snapshot mismatch', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => ({ ...candidateResponse(snapshot, 'shorter', 'en', 'candidate'), evidence: { snapshotHash: 'm5_wrong', manifestHash: snapshot.manifestHash, candidateHash: hashSummaryV3StyleValue('candidate'), retries: 0, fallbacks: 0, v2Fallthrough: 0 } })],
    ['manifest mismatch', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => ({ ...candidateResponse(snapshot, 'shorter', 'en', 'candidate'), evidence: { snapshotHash: snapshot.snapshotHash, manifestHash: 'm5_wrong', candidateHash: hashSummaryV3StyleValue('candidate'), retries: 0, fallbacks: 0, v2Fallthrough: 0 } })],
    ['candidate hash mismatch', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => ({ ...candidateResponse(snapshot, 'shorter', 'en', 'candidate'), evidence: { snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash, candidateHash: 'm5_wrong', retries: 0, fallbacks: 0, v2Fallthrough: 0 } })],
    ['old text-hash candidate contract', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => {
      const response = candidateResponse(snapshot, 'shorter', 'en', 'candidate');
      const candidate = response.candidate as Record<string, unknown>;
      const wrongHash = hashSummaryV3StyleValue(candidate.text as string);
      return { ...response, candidate: { ...candidate, hash: wrongHash }, evidence: { snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash, candidateHash: wrongHash, retries: 0, fallbacks: 0, v2Fallthrough: 0 } };
    }],
    ['candidate text does not match units', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => {
      const response = candidateResponse(snapshot, 'shorter', 'en', 'candidate');
      return { ...response, candidate: { ...(response.candidate as Record<string, unknown>), text: 'tampered text' } };
    }],
    ['candidate unit hash mismatch', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => {
      const response = candidateResponse(snapshot, 'shorter', 'en', 'candidate');
      const candidate = response.candidate as Record<string, unknown>;
      const units = candidate.units as Array<Record<string, unknown>>;
      return { ...response, candidate: { ...candidate, units: [{ ...units[0], text: 'tampered unit text' }] } };
    }],
    ['missing candidate units', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => {
      const response = candidateResponse(snapshot, 'shorter', 'en', 'candidate');
      return { ...response, candidate: { ...(response.candidate as Record<string, unknown>), units: undefined } };
    }],
    ['malformed candidate unit', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => {
      const response = candidateResponse(snapshot, 'shorter', 'en', 'candidate');
      const candidate = response.candidate as Record<string, unknown>;
      const units = candidate.units as Array<Record<string, unknown>>;
      return { ...response, candidate: { ...candidate, units: [{ ...units[0], unitId: ' ', factIds: [42] }] } };
    }],
    ['missing candidate and evidence hashes', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => ({ ...candidateResponse(snapshot, 'shorter', 'en', 'candidate'), candidate: { ...(candidateResponse(snapshot, 'shorter', 'en', 'candidate').candidate as Record<string, unknown>), hash: undefined }, evidence: { snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash, candidateHash: undefined, retries: 0, fallbacks: 0, v2Fallthrough: 0 } })],
  ] as const)('rejects %s without commit', async (_label, factory) => {
    const result = await run({ responseFactory: (snapshot) => factory(snapshot) });
    expect(result.outcome).toMatchObject({
      kind: 'terminal',
      reason: _label === 'malformed result' ? 'unclassified_transport_response' : 'candidate_identity_mismatch',
    });
    expect(result.commitRequest).toBeNull();
  });

  it('accepts the real M5.1 structured candidate while keeping atomic commit hash separate', async () => {
    const text = 'candidate';
    let structuredCandidateHash = '';
    const result = await run({ responseFactory: (snapshot) => {
      const response = candidateResponse(snapshot, 'shorter', 'en', text);
      structuredCandidateHash = (response.candidate as Record<string, unknown>).hash as string;
      return response;
    } });
    const observedCommitRequest = result.commitRequest as unknown as SummaryV3CommitRequest;
    expect(result.outcome.kind).toBe('committed');
    const expectedUnits = [{ unitId: `unit-${hashSummaryV3StyleValue(text)}`, text, factIds: [`fact-${hashSummaryV3StyleValue(text)}`] }];
    expect(structuredCandidateHash).toBe(hashSummaryV3StyleValue(JSON.stringify(expectedUnits.map((unit) => [unit.unitId, unit.text, unit.factIds]))));
    expect(structuredCandidateHash).not.toBe(hashSummaryV3StyleValue(text));
    expect(observedCommitRequest.candidateHash).toBe(hashSummaryV3Value(text));
    expect(result.requestCount).toBe(1);
  });

  it.each([
    ['style mismatch', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => ({ ...candidateResponse(snapshot, 'shorter', 'en', 'candidate'), style: 'professional' })],
    ['mode mismatch', (snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>) => ({ ...candidateResponse(snapshot, 'shorter', 'en', 'candidate'), mode: 'generate_from_context' })],
  ] as const)('rejects %s without a commit', async (_label, factory) => {
    const result = await run({ summary: 'Engineer builds APIs.', responseFactory: (snapshot) => factory(snapshot) });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'candidate_identity_mismatch' });
    expect(result.commitRequest).toBeNull();
  });

  it('keeps the structured candidate hash separate from the committed text hash', async () => {
    let responseCandidateHash = '';
    const result = await run({ summary: 'Engineer builds APIs.', responseFactory: (snapshot) => {
      const response = candidateResponse(snapshot, 'shorter', 'en', 'candidate');
      responseCandidateHash = ((response.candidate as Record<string, unknown>).hash as string);
      return response;
    } });
    const expectedUnits = [{ unitId: `unit-${hashSummaryV3StyleValue('candidate')}`, text: 'candidate', factIds: [`fact-${hashSummaryV3StyleValue('candidate')}`] }];
    expect(responseCandidateHash).toBe(hashSummaryV3StyleValue(JSON.stringify(expectedUnits.map((unit) => [unit.unitId, unit.text, unit.factIds]))));
    expect(responseCandidateHash).not.toBe(hashSummaryV3Value('candidate'));
    expect((result.commitRequest as unknown as SummaryV3CommitRequest | null)?.candidateHash).toBe(hashSummaryV3Value('candidate'));
  });

  it('proves actual rendered-page M5->M4 shared ownership', async () => {
    const result = await actualPageSharedRace('M5->M4');
    expect(result.m5Requests).toHaveLength(1);
    expect(result.m4Calls).toBe(1);
    expect(result.m4Result).toEqual({ kind: 'handled_success' });
    expect(result.finalSummary).toBe('M4 page race candidate');
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
  });

  it('does not let an older M5 terminal trace replace a newer successful M4 trace', async () => {
    const result = await actualPageSharedRace('M5->M4-newest-completes-first');
    expect(result.m4Result).toEqual({ kind: 'handled_success' });
    expect(result.finalSummary).toBe('M4 page race candidate');
    expect(result.latestDiagnostic).toMatchObject({
      rewriteStyle: null,
      operationMode: 'enhance_existing_content',
      countedAsSuccess: true,
    });
    expect(result.diagnosticHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        operationMode: 'enhance_existing_content',
        finalTypedFailureReason: 'operation_superseded',
        success: false,
      }),
    ]));
  });

  it('proves actual rendered-page M4->M5 shared ownership', async () => {
    const result = await actualPageSharedRace('M4->M5');
    expect(result.m5Requests).toHaveLength(1);
    expect(result.m4Calls).toBe(1);
    expect(result.m4Result).toEqual({ kind: 'handled_failure', typedReason: 'operation_superseded' });
    expect(result.finalSummary).toBe('M5 page race candidate');
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
  });

  it('proves actual rendered-page M5->M5 blocks a second style click while pending', async () => {
    const result = await actualPageSharedRace('M5->M5');
    expect(result.m5Requests).toHaveLength(1);
    expect(result.m4Calls).toBe(0);
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
  });

  it('keeps actual page Generate M4-owned with zero M5 style actions', async () => {
    const result = await actualPageSharedRace('M4-only');
    expect(result.m4Calls).toBe(1);
    expect(result.m5Requests).toHaveLength(0);
    expect(result.finalSummary).toBe('M4 page race candidate');
    expect(result.commitCalls).toBe(1);
    expect(result.usageCalls).toBe(1);
  });

  it('protects real delayed shared-operation races with only the newest commit', async () => {
    const result = await realSharedOperationRace();
    expect(result.first).toMatchObject({ kind: 'terminal', status: 409, reason: 'operation_superseded' });
    expect(result.second.kind).toBe('committed');
    expect(result.commits).toBe(1);
  });

  it('rejects a CV edit while pending and does not overwrite live state', async () => {
    const original = cvFor('en');
    const edited = { ...original, summary: 'edited while pending' };
    const result = await runSummaryV3StyleClientOperation({ enabled: true, style: 'shorter', operationId: 'op', requestId: 'op', cv: original, currentRoleExperienceId: 'experience-current', requestedLocale: 'en', sourceLocale: 'en', jobContextKey: 'ctx', referenceDateIso: '2026-09-01', usageCountBefore: 0, proToken: 'x', createdAt: 1 }, {
      request: async (body) => {
        const normalized = normalizeSummaryV3StyleRouteRequest('summary_shorter', body as unknown as SummaryV3StyleRouteParams, 2000);
        const snapshot = createSummaryV3StyleOperationSnapshot(normalized);
        return { status: 200, data: candidateResponse(snapshot, 'shorter', 'en', 'candidate') };
      }, getLiveCv: () => edited, getActiveOperationId: () => 'op', commitCandidate: () => { throw new Error('must not commit'); },
    });
    expect(result).toMatchObject({ kind: 'terminal', reason: 'stale_snapshot' });
  });

  it.each(['shorter', 'stronger', 'professional'] as const)(
    'keeps non-empty %s M5 current after an Experience-only display/provenance commit',
    async (style) => {
      const initial = cvFor('en', 'Ava Patel builds APIs.');
      const live = {
        ...initial,
        experience: initial.experience.map((entry) => ({
          ...entry,
          description: 'Ingenieur entwickelt zuverlässige APIs.',
          descriptionOrigin: 'ai_generated' as const,
          generatedDescription: 'Ingenieur entwickelt zuverlässige APIs.',
          generatedLocale: 'de',
          descriptionSourceLocale: 'de',
          descriptionSourceLocaleTextHash: hashSummaryV3StyleValue('Ingenieur entwickelt zuverlässige APIs.'),
      })),
      };
      const result = await run({ initialCv: initial, liveCv: live, style, summary: initial.summary });
      expect(result.outcome).toMatchObject({ kind: 'committed' });
      expect((result.commitRequest as SummaryV3CommitRequest | null)?.previousCv).toBe(live);
      expect(result.requestCount).toBe(1);
    },
  );

  it('fails closed for empty Summary M5 when an Experience translation changes manifest grounding', async () => {
    const initial = cvFor('en', '');
    const live = {
      ...initial,
      experience: initial.experience.map((entry) => ({
        ...entry,
        description: 'Engineer delivers a materially different current duty.',
        descriptionOrigin: 'ai_generated' as const,
        generatedDescription: 'Engineer delivers a materially different current duty.',
        generatedLocale: 'en',
      })),
    };
    const result = await run({ initialCv: initial, liveCv: live, style: 'professional' });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 409, reason: 'stale_snapshot' });
    expect(result.commitRequest).toBeNull();
    // The M5 manifest is built from the live Experience description, so this
    // M6.6-style display translation is source-relevant in empty mode.
    expect(result.requestCount).toBe(1);
  });

  it('reports commit failure, abort, unsupported/cross locale, and disabled gate as terminal', async () => {
    expect((await run({ commitResult: { kind: 'failed', reason: 'persistence_failed' } as SummaryV3CommitReceipt })).outcome).toMatchObject({ kind: 'terminal', reason: 'persistence_failed' });
    expect((await run({ requestError: Object.assign(new Error('aborted'), { name: 'AbortError' }) })).outcome).toMatchObject({ kind: 'terminal', status: 499, reason: 'aborted' });
    expect((await run({ requestedLocale: 'xx' })).outcome).toMatchObject({ kind: 'terminal', reason: 'unsupported_or_cross_locale' });
    const cv = cvFor('en');
    const cross = await runSummaryV3StyleClientOperation({ enabled: true, style: 'shorter', operationId: 'op', requestId: 'op', cv, currentRoleExperienceId: 'experience-current', requestedLocale: 'de', sourceLocale: 'en', jobContextKey: 'ctx', referenceDateIso: '2026-09-01', usageCountBefore: 0, proToken: 'x', createdAt: 1 }, {
      request: async () => { throw new Error('must not request'); }, getLiveCv: () => cv, getActiveOperationId: () => 'op', commitCandidate: () => committedReceipt(),
    });
    expect(cross).toMatchObject({ kind: 'terminal', reason: 'unsupported_or_cross_locale' });
    expect((await run({ enabled: false })).outcome).toMatchObject({ kind: 'terminal', status: 404, reason: 'feature_disabled' });
  });

  it.each(['canonical_apply_failed', 'usage_rollback_failed'] as const)('keeps %s commit receipts terminal with no fallback', async (reason) => {
    const result = await run({ commitResult: { kind: 'failed', reason } as SummaryV3CommitReceipt });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason });
    expect(result.requestCount).toBe(1);
  });
});
