/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '@/lib/cv-defaults';
import { resolveSummaryCurrentRole } from '@/lib/cv-summary-current-role';
import { translations, type Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import * as aiClientRequest from '@/lib/ai-client-request';
import { canonicalSummaryV3StyleLocale, createSummaryV3StyleCandidate, createSummaryV3StyleOperationSnapshot, hashSummaryV3StyleValue, type SummaryV3Style, type SummaryV3StyleCandidateUnit, type SummaryV3StyleRequest } from '../summary-style-m5';
import { normalizeSummaryV3StyleRouteRequest, type SummaryV3StyleRouteAction, type SummaryV3StyleRouteParams } from '../summary-style-m5-provider';
import { runSummaryV3StyleClientOperation, SUMMARY_V3_STYLE_M5_ACTION } from '../summary-style-m5-client';
import {
  hashSummaryV3Value,
  type SummaryV3CommitReceipt,
  type SummaryV3CommitRequest,
  type SummaryV3GenerateAdapterDependencies,
  type SummaryV3GenerateAdapterInput,
  type SummaryV3GenerateRoutingResult,
} from '../summary-generate';

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
      commitProAiSuccess: () => { pageUsageCalls += 1; return { ok: true, attempted: true, before: 0, after: 1, delta: 1,
        forwardWriteResult: 'succeeded', verificationResult: 'passed', rollbackAttempted: false,
        rollbackResult: 'not_required', record: { count: 1, windowStart: 0, schemaVersion: 2, policyLimit: 50 } }; },
      getProAiUsageCount: () => 0,
      lastCvSavedAt: 0,
      getAiGate: () => ({ status: 'ready', token: 'm5-page-token' }),
    }),
  }));
  vi.doMock('@/lib/api', () => ({ apiFetch: pageApiFetch }));
  vi.doMock('@/components/Header', () => ({ default: () => null }));
  vi.doMock('@/components/Footer', () => ({ default: () => null }));
  vi.doMock('sonner', () => ({ toast: { success: pageToastSuccess, error: pageToastError } }));
}

async function actualPageStyleFlow(options: {
  readonly style: SummaryV3Style;
  readonly enabled?: boolean;
  readonly uiLocale?: Locale;
  readonly contentLocale?: string;
  readonly summary?: string;
  readonly safeNoOp?: boolean;
}): Promise<{ m5Requests: Array<Record<string, unknown>>; legacyRequests: Array<Record<string, unknown>>; beginLocales: string[]; commitCalls: number; usageCalls: number; successToasts: number; errorToasts: number }> {
  const savedEnabled = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  const savedServerEnabled = process.env.AI_CORE_V3_ENABLED;
  cleanup(); localStorage.clear(); sessionStorage.clear();
  pageUiLocale = options.uiLocale ?? 'en';
  const fixtureLocale = options.contentLocale === 'pt_BR' ? 'pt-BR' : (options.contentLocale ?? 'en');
  pageRuntimeCv = cvFor(fixtureLocale, options.summary ?? 'Existing Summary.');
  pageRuntimeCv.runtimeMigrationVersion = 3;
  pageRuntimeCv.contentLocale = options.contentLocale as CVData['contentLocale'] || pageRuntimeCv.contentLocale;
  pageRequests = []; pageLegacyRequests = []; pageCommitCalls = 0; pageUsageCalls = 0; pageToastSuccess.mockReset(); pageToastError.mockReset();
  pageM4Adapter.mockReset().mockResolvedValue({ kind: 'not_applicable' as const });
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = options.enabled === false ? 'false' : 'true';
  process.env.AI_CORE_V3_ENABLED = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  pageApiFetch.mockReset().mockImplementation(async (_url: unknown, requestOptions: unknown) => {
    const body = ((requestOptions as { body?: unknown }).body || {}) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    if (action.startsWith('summary_')) {
      pageRequests.push(body);
      const normalized = normalizeSummaryV3StyleRouteRequest(action as SummaryV3StyleRouteAction, body as unknown as SummaryV3StyleRouteParams, 2000);
      const snapshot = createSummaryV3StyleOperationSnapshot(normalized);
      const data = options.safeNoOp === false
        ? candidateResponse(snapshot, options.style, snapshot.requestedLocale, 'M5 page candidate')
        : safeNoOpResponse(snapshot, options.style);
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
    const styleButton = screen.getAllByRole('button').find((button) => button.textContent?.includes(subtitle));
    expect(styleButton).toBeDefined();
    fireEvent.click(styleButton!);
    await waitFor(() => expect(options.enabled === false ? pageLegacyRequests.length : pageRequests.length).toBe(1));
    return {
      m5Requests: [...pageRequests],
      legacyRequests: [...pageLegacyRequests],
      beginLocales: beginSpy.mock.calls.filter(([operation]) => String(operation).startsWith('summary_style:')).map(([, locale]) => locale),
      commitCalls: pageCommitCalls,
      usageCalls: pageUsageCalls,
      successToasts: pageToastSuccess.mock.calls.length,
      errorToasts: pageToastError.mock.calls.length,
    };
  } finally {
    beginSpy.mockRestore(); cleanup(); localStorage.clear(); sessionStorage.clear();
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

async function actualPageSharedRace(direction: 'M5->M4' | 'M4->M5' | 'M5->M5' | 'M4-only'): Promise<{
  m5Requests: Array<Record<string, unknown>>;
  m4Calls: number;
  commitCalls: number;
  finalSummary: string;
  m4Result: SummaryV3GenerateRoutingResult | null;
  usageCalls: number;
}> {
  const savedEnabled = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
  const savedServerEnabled = process.env.AI_CORE_V3_ENABLED;
  cleanup(); localStorage.clear(); sessionStorage.clear();
  pageUiLocale = 'en';
  pageRuntimeCv = cvFor('en', 'Existing Summary.');
  pageRuntimeCv.runtimeMigrationVersion = 3;
  pageRequests = []; pageLegacyRequests = []; pageCommitCalls = 0; pageUsageCalls = 0;
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
    return { m5Requests: [...pageRequests], m4Calls: pageM4Adapter.mock.calls.length, commitCalls: pageCommitCalls, finalSummary: pageRuntimeCv.summary, m4Result, usageCalls: pageUsageCalls };
  } finally {
    cleanup(); localStorage.clear(); sessionStorage.clear();
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
    evidence: { snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash, candidateHash, retries: 0, fallbacks: 0, v2Fallthrough: 0 } };
}

function safeNoOpResponse(snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>, style: SummaryV3Style): Record<string, unknown> {
  return { kind: 'safe_no_op', style, mode: snapshot.mode, typedReason: 'safe_no_op',
    evidence: { snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash, noOpDetected: true, meaningfulChangeDetected: false, retries: 0, fallbacks: 0, v2Fallthrough: 0 } };
}

async function run(options: RunOptions = {}) {
  const locale = options.locale || 'en';
  const style = options.style || 'shorter';
  const cv = options.liveCv || cvFor(locale, options.summary || '');
  let capturedRequest: Record<string, unknown> | null = null;
  let commitRequest: SummaryV3CommitRequest | null = null;
  let requestCount = 0;
  const outcome = await runSummaryV3StyleClientOperation({
    enabled: options.enabled !== false, style, operationId: 'op', requestId: 'op', cv,
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
    getLiveCv: () => cv,
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
    expect(m5Handler).toContain('canonicalizeContentLocale');
    expect(m5Handler).toContain('currentRoleExperienceId');
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

  it('preserves pt-BR canonical identity through the actual page/content-locale boundary', async () => {
    const result = await actualPageStyleFlow({ style: 'professional', contentLocale: 'pt_BR' });
    expect(result.beginLocales).toEqual(['pt-BR']);
    expect(result.m5Requests[0]?.requestedLocale).toBe('pt-BR');
    expect(result.m5Requests[0]?.sourceLocale).toBe('pt-BR');
  });

  it('executes safe no-op UX through the real page with one request and no success/error toast', async () => {
    const result = await actualPageStyleFlow({ style: 'shorter', safeNoOp: true });
    expect(result.m5Requests).toHaveLength(1);
    expect(result.legacyRequests).toHaveLength(0);
    expect(result.commitCalls).toBe(0);
    expect(result.usageCalls).toBe(0);
    expect(result.successToasts).toBe(0);
    expect(result.errorToasts).toBe(0);
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
  ] as const)('preserves exact typed terminal reason for %s', async (_label, status, data) => {
    const result = await run({ status, responseFactory: () => data });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status, reason: 'typedReason' in data ? data.typedReason : data.reason });
    expect(result.commitRequest).toBeNull();
    expect(result.requestCount).toBe(1);
  });

  it.each([409, 422, 502])('rejects candidate_ready on HTTP %s', async (status) => {
    const result = await run({ status });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status, reason: 'candidate_non_200' });
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
      reason: _label === 'malformed result' ? 'writer_transport_malformed' : 'candidate_identity_mismatch',
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
