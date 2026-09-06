/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TargetContentLocaleDialog } from '@/components/ai/TargetContentLocaleDialog';
import { createEmptyCv } from '@/lib/cv-defaults';
import { hashSummarySourceLocaleText } from '@/lib/cv-summary-source-locale';
import { I18nProvider } from '@/lib/i18n/context';
import { languages, translations, type Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { createContentLocalizeM6Operation, type ContentLocalizeM6SummarySnapshot } from '../content-localize-m6';
import { runContentLocalizeV3ClientOperation, type ContentLocalizeV3ClientOutcome } from '../content-localize-v3-client';
import { hashSummaryV3Value, type SummaryV3CommitReceipt, type SummaryV3CommitRequest,
  type SummaryV3GenerateAdapterDependencies, type SummaryV3GenerateAdapterInput,
  type SummaryV3GenerateRoutingResult } from '../summary-generate';
import { createSummaryV3StyleCandidate, createSummaryV3StyleOperationSnapshot, hashSummaryV3StyleValue,
  type SummaryV3Style, type SummaryV3StyleCandidateUnit } from '../summary-style-m5';
import { normalizeSummaryV3StyleRouteRequest, type SummaryV3StyleRouteAction, type SummaryV3StyleRouteParams } from '../summary-style-m5-provider';

const pageClientTrace = vi.hoisted(() => ({ outcome: null as ContentLocalizeV3ClientOutcome | null }));

vi.mock('@/lib/ai-core-v3/content-localize-v3-client', async () => {
  const actual = await vi.importActual<typeof import('../content-localize-v3-client')>('../content-localize-v3-client');
  return {
    ...actual,
    runContentLocalizeV3ClientOperation: vi.fn(async (...args: Parameters<typeof actual.runContentLocalizeV3ClientOperation>) => {
      const outcome = await actual.runContentLocalizeV3ClientOperation(...args);
      pageClientTrace.outcome = outcome;
      return outcome;
    }),
  };
});

function cvForSummaryLocale(sourceLocale: Locale = 'de'): CVData {
  const cv = createEmptyCv();
  cv.summary = 'Deutsche aktuelle Zusammenfassung.';
  cv.summaryOrigin = 'ai_generated';
  cv.summaryGeneratedLocale = sourceLocale;
  cv.summarySourceLocale = sourceLocale;
  cv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(cv.summary);
  cv.contentLocale = 'sr';
  cv.canonicalSummary = 'Canonical English grounding.';
  return cv;
}

function snapshotFor(cv: CVData, targetLocale = 'fr'): ContentLocalizeM6SummarySnapshot {
  const result = createContentLocalizeM6Operation({
    operationId: 'op-summary-1', requestId: 'op-summary-1', kind: 'summary', targetLocale, confirmed: true, cv,
  });
  if (result.status !== 'request_ready' || result.snapshot.kind !== 'summary') throw new Error('fixture request was not ready');
  return result.snapshot;
}

function candidateReady(snapshot: ContentLocalizeM6SummarySnapshot, translatedText = 'Résumé français actuel.'): unknown {
  return {
    status: 'candidate_ready',
    receipt: {
      operationId: snapshot.operationId,
      requestId: snapshot.requestId,
      kind: 'summary',
      sourceLocale: snapshot.sourceLocale,
      targetLocale: snapshot.targetLocale,
      sourceTextHash: snapshot.sourceTextHash,
      translatedText,
      candidateTextHash: hashSummarySourceLocaleText(translatedText),
      candidateOrigin: 'primary',
    },
  };
}

function committedReceipt(request: SummaryV3CommitRequest): Extract<SummaryV3CommitReceipt, { kind: 'committed' }> {
  return {
    kind: 'committed', operationId: request.operationId, requestId: request.requestId,
    canonicalAccepted: true, intendedCandidateHash: request.candidateHash,
    committedSummaryHash: request.candidateHash, committedContentLocale: request.nextCv.contentLocale ?? null,
    candidateMatched: true, persistenceAttempted: true, persistenceResult: 'passed',
    canonicalApplyAttempted: true, canonicalApplyResult: 'passed', usageAttempted: true, usageResult: 'passed',
    usageForwardWriteResult: 'succeeded', usageVerificationResult: 'passed', usageRollbackAttempted: false,
    usageRollbackResult: 'not_required', actualUsageBefore: request.usageCountBefore,
    actualUsageAfter: request.usageCountBefore + 1, actualUsageDelta: 1, rollbackAttempted: false,
    rollbackResult: 'not_required',
  };
}

describe('M6.5 content-localize client and target dialog', () => {
  afterEach(() => cleanup());

  it('uses the frozen target list, keeps source read-only/disabled, and requires explicit selection', () => {
    const onTarget = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <I18nProvider>
        <TargetContentLocaleDialog open sourceLocale="de" targetLocale={null} onTargetLocaleChange={onTarget} onConfirm={onConfirm} onCancel={onCancel} />
      </I18nProvider>,
    );
    const source = screen.getByLabelText(translations.en.common.sourceLanguage) as HTMLInputElement;
    const target = screen.getByLabelText(translations.en.common.targetLanguage) as HTMLSelectElement;
    expect(source.readOnly).toBe(true);
    expect(source.value).toContain('Deutsch');
    expect(target.options).toHaveLength(13);
    expect([...target.options].find((option) => option.value === 'de')?.disabled).toBe(true);
    expect((document.querySelector('[data-content-localize-confirm]') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(target, { target: { value: 'fr' } });
    expect(onTarget).toHaveBeenCalledWith('fr');
    fireEvent.click(screen.getByText(translations.en.common.cancel));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fails closed on non-200, malformed, and identity-drifted responses without a commit', async () => {
    const cv = cvForSummaryLocale();
    const snapshot = snapshotFor(cv);
    const commitCandidate = vi.fn();
    const invalidResponses = [
      { status: 502, data: { status: 'handled_failure', reason: 'writer_failed' } },
      { status: 200, data: { status: 'candidate_ready', receipt: {} } },
      { status: 200, data: { ...candidateReady(snapshot) as Record<string, unknown>, receipt: { ...(candidateReady(snapshot) as { receipt: Record<string, unknown> }).receipt, requestId: 'wrong' } } },
    ];
    const outcomes = [];
    for (const response of invalidResponses) {
      const outcome = await runContentLocalizeV3ClientOperation({ snapshot, cv, proToken: 'test', usageCountBefore: 4 }, {
        request: async () => response,
        getLiveCv: () => cv,
        getActiveOperationId: () => snapshot.operationId,
        commitCandidate,
      });
      expect(outcome.kind).toBe('terminal');
      outcomes.push(outcome);
    }
    expect(outcomes[0]).toMatchObject({ kind: 'terminal', status: 502, reason: 'writer_failed' });
    expect(commitCandidate).not.toHaveBeenCalled();
  });

  it('validates the receipt then preserves document/canonical/Experience fields in the one atomic commit input', async () => {
    const cv = cvForSummaryLocale();
    const snapshot = snapshotFor(cv);
    const originalExperience = cv.experience;
    let received: SummaryV3CommitRequest | null = null;
    const outcome = await runContentLocalizeV3ClientOperation({ snapshot, cv, proToken: 'test', usageCountBefore: 4 }, {
      request: async () => ({ status: 200, data: candidateReady(snapshot) }),
      getLiveCv: () => cv,
      getActiveOperationId: () => snapshot.operationId,
      commitCandidate: (request) => { received = request; return committedReceipt(request); },
    });
    expect(outcome.kind).toBe('committed');
    const committedRequest = received as unknown as SummaryV3CommitRequest;
    expect(committedRequest.nextCv.summary).toBe('Résumé français actuel.');
    expect(committedRequest.nextCv.summaryOrigin).toBe('ai_generated');
    expect(committedRequest.nextCv.summaryGeneratedLocale).toBe('fr');
    expect(committedRequest.nextCv.summarySourceLocale).toBe('fr');
    expect(committedRequest.nextCv.summarySourceLocaleTextHash).toBe(hashSummarySourceLocaleText('Résumé français actuel.'));
    expect(committedRequest.nextCv.contentLocale).toBe('sr');
    expect(committedRequest.nextCv.canonicalSummary).toBe('Canonical English grounding.');
    expect(committedRequest.nextCv.canonicalSnapshot).toBe(cv.canonicalSnapshot);
    expect(committedRequest.nextCv.experience).toBe(originalExperience);
  });
});

const pageApiFetch = vi.hoisted(() => vi.fn());
const pageM4Adapter = vi.hoisted(() => vi.fn());
const pageToastSuccess = vi.hoisted(() => vi.fn());
const pageToastError = vi.hoisted(() => vi.fn());
let pageCv: CVData;
let pageWrites = 0;
let pageUsage = 0;
let pagePersistCalls = 0;
let pagePersistedValues: CVData[] = [];
let pagePersistMode: 'success' | 'first_write_fail' | 'rollback_fail' = 'success';
let pageUsageMode: 'success' | 'fail' = 'success';
const initialPublicV3Flag = process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
const initialServerV3Flag = process.env.AI_CORE_V3_ENABLED;

function installPageMocks(): void {
  vi.doMock('@/lib/ai-core-v3', async () => {
    const actual = await vi.importActual<typeof import('..')>('@/lib/ai-core-v3');
    return { ...actual, runSummaryV3GenerateAdapter: pageM4Adapter };
  });
  vi.doMock('@/lib/i18n/context', () => ({
    useI18n: () => ({ locale: 'sr', t: translations.sr, languages }),
  }));
  vi.doMock('@/lib/store', () => ({
    checkProAccess: () => 'allowed',
    useApp: () => ({
      currentCv: pageCv,
      setCurrentCv: (next: CVData) => { pageCv = next; },
      persistCurrentCvTransactionally: (next: CVData) => {
        pageWrites += 1;
        pagePersistCalls += 1;
        pagePersistedValues.push(next);
        if (pagePersistMode === 'first_write_fail' && pagePersistCalls === 1) return false;
        if (pagePersistMode === 'rollback_fail' && pagePersistCalls >= 2) return false;
        pageCv = next;
        return true;
      },
      isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(), recordProAiSuccess: vi.fn(),
      commitProAiSuccess: () => {
        if (pageUsageMode === 'fail') return {
          ok: false, attempted: true, reason: 'usage_accounting_failed', before: pageUsage, after: pageUsage, delta: 0,
          forwardWriteResult: 'failed', verificationResult: 'failed', rollbackAttempted: false, rollbackResult: 'not_required',
        };
        pageUsage += 1;
        return { ok: true, attempted: true, before: pageUsage - 1, after: pageUsage, delta: 1, forwardWriteResult: 'succeeded', verificationResult: 'passed', rollbackAttempted: false, rollbackResult: 'not_required' };
      },
      getProAiUsageCount: () => pageUsage, lastCvSavedAt: 0, getAiGate: () => ({ status: 'ready', token: 'page-token' }),
    }),
  }));
  vi.doMock('@/lib/api', () => ({ apiFetch: pageApiFetch }));
  vi.doMock('@/components/Header', () => ({ default: () => null }));
  vi.doMock('@/components/Footer', () => ({ default: () => null }));
  vi.doMock('sonner', () => ({ toast: { success: pageToastSuccess, error: pageToastError } }));
}

function cvForM4Summary(): CVData {
  const cv = createEmptyCv('sr');
  cv.personal.jobTitle = 'Software Engineer';
  cv.experience = [{
    id: 'm4-current', company: 'Nova', position: 'Software Engineer', startDate: '2020-01', endDate: '', isPresent: true,
    description: 'Builds reliable APIs and reviews production changes.',
  }];
  return cv;
}

function commitPageM4Candidate(
  input: SummaryV3GenerateAdapterInput,
  dependencies: SummaryV3GenerateAdapterDependencies,
): SummaryV3GenerateRoutingResult {
  if (dependencies.getActiveOperationId() !== input.operationId) {
    return { kind: 'handled_failure', typedReason: 'operation_superseded' };
  }
  const before = dependencies.getLiveState().cv;
  const text = 'M4 rendered Generate result.';
  const next = {
    ...before,
    summary: text,
    summaryOrigin: 'ai_generated' as const,
    summaryGeneratedLocale: input.requestedLocale as CVData['contentLocale'],
    summarySourceLocale: input.requestedLocale,
    summarySourceLocaleTextHash: hashSummarySourceLocaleText(text),
    summaryGenerationContextKey: input.jobContextHash,
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

function pageStyleCandidate(body: Record<string, unknown>, text: string): Record<string, unknown> {
  const action = String(body.action || '') as SummaryV3StyleRouteAction;
  const normalized = normalizeSummaryV3StyleRouteRequest(action, body as unknown as SummaryV3StyleRouteParams, 2000);
  const snapshot = createSummaryV3StyleOperationSnapshot(normalized);
  const style = action === 'summary_shorter' ? 'shorter' : action === 'summary_professional' ? 'professional' : 'stronger' as SummaryV3Style;
  const units: readonly SummaryV3StyleCandidateUnit[] = [{
    unitId: `unit-${hashSummaryV3StyleValue(text)}`,
    text,
    factIds: [`fact-${hashSummaryV3StyleValue(text)}`],
  }];
  const candidate = createSummaryV3StyleCandidate(snapshot, units);
  return {
    kind: 'candidate_ready', style, mode: snapshot.mode,
    candidate: { ...candidate, style, locale: snapshot.requestedLocale },
    evidence: { snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash, candidateHash: candidate.hash, retries: 0, fallbacks: 0, v2Fallthrough: 0 },
  };
}

async function renderSummaryPage(options: { readonly m4?: boolean } = {}): Promise<void> {
  void options;
  pageClientTrace.outcome = null;
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
  process.env.AI_CORE_V3_ENABLED = 'true';
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.resetModules();
  installPageMocks();
  const core = await import('..');
  core.resetAiCoreV3TestOverride();
  const Page = (await import('@/app/cv-builder/page')).default;
  render(<Page />);
  fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
}

describe('M6.5 rendered Summary Translate integration', () => {
  afterEach(() => {
    cleanup();
    vi.doUnmock('@/lib/i18n/context'); vi.doUnmock('@/lib/store'); vi.doUnmock('@/lib/api');
    vi.doUnmock('@/lib/ai-core-v3');
    vi.doUnmock('@/components/Header'); vi.doUnmock('@/components/Footer'); vi.doUnmock('sonner');
    vi.resetModules(); vi.restoreAllMocks();
    if (initialPublicV3Flag === undefined) delete process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
    else process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = initialPublicV3Flag;
    if (initialServerV3Flag === undefined) delete process.env.AI_CORE_V3_ENABLED;
    else process.env.AI_CORE_V3_ENABLED = initialServerV3Flag;
  });

  it('uses source de rather than UI sr and durably applies only the accepted fr candidate', async () => {
    pageCv = cvForSummaryLocale('de'); pageWrites = 0; pageUsage = 0;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    vi.resetModules();
    installPageMocks();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(pageApiFetch).toHaveBeenCalledTimes(1));
    const body = pageApiFetch.mock.calls[0]?.[1]?.body as Record<string, unknown>;
    const snapshot = body.snapshot as ContentLocalizeM6SummarySnapshot;
    expect(body.action).toBe('content-localize-v3');
    expect(snapshot.sourceLocale).toBe('de');
    expect(snapshot.targetLocale).toBe('fr');
    expect(snapshot.sourceText).toBe('Deutsche aktuelle Zusammenfassung.');
    expect(pageCv.summary).toBe('Résumé français actuel.');
    expect(pageCv.contentLocale).toBe('sr');
    expect(pageCv.canonicalSummary).toBe('Canonical English grounding.');
    expect(pageWrites).toBe(1);
    expect(pageUsage).toBe(1);
  });

  it('keeps cancel and a stale manually edited dialog free of route, write, and usage effects', async () => {
    pageCv = cvForSummaryLocale('de'); pageWrites = 0; pageUsage = 0;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    pageApiFetch.mockReset().mockResolvedValue({ data: {}, response: { status: 200, ok: true, headers: { get: () => null } } });
    vi.resetModules();
    installPageMocks();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));

    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.click(screen.getByText(translations.sr.common.cancel));
    expect(pageApiFetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(document.querySelector('[data-summary-v3-editor]')!, { target: { value: 'Manual current summary.' } });
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(screen.queryByLabelText(translations.sr.common.targetLanguage)).toBeNull());
    expect(pageApiFetch).not.toHaveBeenCalled();
    expect(pageWrites).toBe(0);
    expect(pageUsage).toBe(0);
  });

  it('uses the first accepted translation as the exact second-operation source for en-to-de-to-fr', async () => {
    pageCv = cvForSummaryLocale('en');
    pageCv.summary = 'Current English summary.';
    pageCv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(pageCv.summary);
    pageWrites = 0; pageUsage = 0;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    const snapshots: ContentLocalizeM6SummarySnapshot[] = [];
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      snapshots.push(snapshot);
      return {
        data: candidateReady(snapshot, snapshot.targetLocale === 'de' ? 'Aktuelle deutsche Zusammenfassung.' : 'Résumé français actuel.'),
        response: { status: 200, ok: true, headers: { get: () => null } },
      };
    });
    vi.resetModules();
    installPageMocks();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    const translateTo = async (targetLocale: 'de' | 'fr') => {
      fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
      fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: targetLocale } });
      fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
      await waitFor(() => expect(snapshots).toHaveLength(targetLocale === 'de' ? 1 : 2));
    };
    await translateTo('de');
    await waitFor(() => expect(pageCv.summary).toBe('Aktuelle deutsche Zusammenfassung.'));
    await translateTo('fr');
    await waitFor(() => expect(pageCv.summary).toBe('Résumé français actuel.'));
    expect(snapshots[0]).toMatchObject({ sourceLocale: 'en', targetLocale: 'de', sourceText: 'Current English summary.' });
    expect(snapshots[1]).toMatchObject({ sourceLocale: 'de', targetLocale: 'fr', sourceText: 'Aktuelle deutsche Zusammenfassung.' });
    expect(pageCv.contentLocale).toBe('sr');
    expect(pageCv.canonicalSummary).toBe('Canonical English grounding.');
    expect(pageCv.summarySourceLocale).toBe('fr');
    expect(pageCv.summarySourceLocaleTextHash).toBe(hashSummarySourceLocaleText('Résumé français actuel.'));
    expect(pageWrites).toBe(2);
    expect(pageUsage).toBe(2);
  });

  it('uses the rendered page shared Summary race owner so Translate B supersedes late Translate A', async () => {
    pageCv = cvForSummaryLocale('de'); pageWrites = 0; pageUsage = 0;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    let releaseFirst!: () => void;
    const firstResponse = new Promise<{ data: unknown; response: { status: number; ok: boolean; headers: { get: () => null } } }>((resolve) => { releaseFirst = () => resolve({
      data: candidateReady(firstSnapshot!, 'Résumé français tardif.'), response: { status: 200, ok: true, headers: { get: () => null } },
    }); });
    let firstSnapshot: ContentLocalizeM6SummarySnapshot | null = null;
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      if (!firstSnapshot) { firstSnapshot = snapshot; return firstResponse; }
      return { data: candidateReady(snapshot, 'Resumen español actual.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    vi.resetModules();
    installPageMocks();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    const authorize = async (target: string) => {
      fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
      fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: target } });
      fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
      await waitFor(() => expect(pageApiFetch).toHaveBeenCalledTimes(target === 'fr' ? 1 : 2));
    };
    await authorize('fr');
    await authorize('es');
    await waitFor(() => expect(pageCv.summary).toBe('Resumen español actual.'));
    releaseFirst();
    await waitFor(() => expect(pageWrites).toBe(1));
    expect(pageUsage).toBe(1);
    expect(pageCv.summaryGeneratedLocale).toBe('es');
    expect(pageCv.summarySourceLocale).toBe('es');
  });

  it('executes the rendered Translate-to-Generate race and blocks the late Translate commit', async () => {
    pageCv = cvForM4Summary();
    pageCv.summary = 'Deutsche aktuelle Zusammenfassung.';
    pageCv.summaryOrigin = 'ai_generated';
    pageCv.summaryGeneratedLocale = 'de';
    pageCv.summarySourceLocale = 'de';
    pageCv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(pageCv.summary);
    pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistedValues = []; pagePersistMode = 'success'; pageUsageMode = 'success';
    let releaseTranslate!: () => void;
    let translateSnapshot: ContentLocalizeM6SummarySnapshot | null = null;
    let translateStarted!: () => void;
    let generateStarted!: () => void;
    let releaseGenerate!: () => void;
    let generateOutcome: SummaryV3GenerateRoutingResult | null = null;
    const translateGate = new Promise<void>((resolve) => { releaseTranslate = resolve; });
    const translateHasStarted = new Promise<void>((resolve) => { translateStarted = resolve; });
    const generateGate = new Promise<void>((resolve) => { releaseGenerate = resolve; });
    const generateHasStarted = new Promise<void>((resolve) => { generateStarted = resolve; });
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      translateSnapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      translateStarted();
      await translateGate;
      return { data: candidateReady(translateSnapshot!, 'Late Translate must not win.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    pageM4Adapter.mockReset().mockImplementation(async (input: SummaryV3GenerateAdapterInput, dependencies: SummaryV3GenerateAdapterDependencies) => {
      generateStarted();
      await generateGate;
      generateOutcome = commitPageM4Candidate(input, dependencies);
      return generateOutcome;
    });
    process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true'; process.env.AI_CORE_V3_ENABLED = 'true';
    await renderSummaryPage({ m4: true });
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    await waitFor(() => expect(screen.getByLabelText(translations.sr.common.targetLanguage)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await translateStarted;
    // M4 owns only an empty visible Summary. Clear the editor through the real page handler before Generate.
    fireEvent.change(document.querySelector('[data-summary-v3-editor]')!, { target: { value: '' } });
    const generateButton = screen.getAllByRole('button').find((button) => button.textContent?.includes(translations.sr.cv.generateSubtext));
    expect(generateButton).toBeDefined();
    fireEvent.click(generateButton!);
    await generateHasStarted;
    releaseGenerate();
    await waitFor(() => expect(pageCv.summary).toBe('M4 rendered Generate result.'));
    const toastCountAfterGenerate = pageToastSuccess.mock.calls.length;
    const errorToastCountAfterGenerate = pageToastError.mock.calls.length;
    const writesAfterGenerate = pageWrites;
    const usageAfterGenerate = pageUsage;
    releaseTranslate();
    await waitFor(() => expect(pageClientTrace.outcome).toMatchObject({ kind: 'terminal', status: 409, reason: 'operation_superseded' }));
    expect(generateOutcome).toMatchObject({ kind: 'handled_success' });
    expect(pageCv.summary).toBe('M4 rendered Generate result.');
    expect(pageWrites).toBe(writesAfterGenerate);
    expect(pageUsage).toBe(usageAfterGenerate);
    expect(pageToastSuccess.mock.calls.length).toBe(toastCountAfterGenerate);
    expect(pageToastError.mock.calls.length).toBe(errorToastCountAfterGenerate);
    expect(pageApiFetch).toHaveBeenCalledTimes(1);
  });

  it('executes the rendered Generate-to-Translate race and preserves the translated Summary', async () => {
    pageCv = cvForM4Summary(); pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistedValues = []; pagePersistMode = 'success'; pageUsageMode = 'success';
    let releaseGenerate!: () => void;
    let generateStarted!: () => void;
    let releaseTranslate!: () => void;
    let translateStarted!: () => void;
    let generateOutcome: SummaryV3GenerateRoutingResult | null = null;
    const generateGate = new Promise<void>((resolve) => { releaseGenerate = resolve; });
    const generateHasStarted = new Promise<void>((resolve) => { generateStarted = resolve; });
    const translateGate = new Promise<void>((resolve) => { releaseTranslate = resolve; });
    const translateHasStarted = new Promise<void>((resolve) => { translateStarted = resolve; });
    pageM4Adapter.mockReset().mockImplementation(async (input: SummaryV3GenerateAdapterInput, dependencies: SummaryV3GenerateAdapterDependencies) => {
      generateStarted();
      await generateGate;
      generateOutcome = commitPageM4Candidate(input, dependencies);
      return generateOutcome;
    });
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      translateStarted();
      await translateGate;
      return { data: candidateReady(snapshot, 'German translation wins.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true'; process.env.AI_CORE_V3_ENABLED = 'true';
    await renderSummaryPage({ m4: true });
    const generateButton = screen.getAllByRole('button').find((button) => button.textContent?.includes(translations.sr.cv.generateSubtext));
    expect(generateButton).toBeDefined();
    fireEvent.click(generateButton!);
    await generateStarted;
    // The real editor supplies a source before the explicit Translate interaction.
    fireEvent.change(document.querySelector('[data-summary-v3-editor]')!, { target: { value: 'Current source for translation.' } });
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'de' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await translateHasStarted;
    releaseGenerate();
    await waitFor(() => expect(generateOutcome).toMatchObject({ kind: 'handled_failure', typedReason: 'operation_superseded' }));
    expect(pageWrites).toBe(0);
    expect(pageUsage).toBe(0);
    releaseTranslate();
    await waitFor(() => expect(pageClientTrace.outcome).toMatchObject({ kind: 'committed', status: 200 }));
    await waitFor(() => expect(pageCv.summary).toBe('German translation wins.'));
    await waitFor(() => expect(pageWrites).toBe(1));
    expect(pageCv.summary).toBe('German translation wins.');
    expect(pageCv.summaryGeneratedLocale).toBe('de');
    expect(pageCv.summarySourceLocale).toBe('de');
    expect(pageCv.contentLocale).toBe('sr');
    expect(pageCv.canonicalSummary).toBe('Current source for translation.');
    expect(pageUsage).toBe(1);
  });

  it('executes the rendered Translate-to-M5 race and blocks the late Translate commit', async () => {
    pageCv = cvForM4Summary();
    pageCv.summary = 'Deutsche aktuelle Zusammenfassung.';
    pageCv.summaryOrigin = 'ai_generated';
    pageCv.summaryGeneratedLocale = 'de';
    pageCv.summarySourceLocale = 'de';
    pageCv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(pageCv.summary);
    pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistedValues = []; pagePersistMode = 'success'; pageUsageMode = 'success';
    let releaseTranslate!: () => void;
    let translateSnapshot: ContentLocalizeM6SummarySnapshot | null = null;
    let translateStarted!: () => void;
    let releaseM5!: () => void;
    let m5Started!: () => void;
    const translateGate = new Promise<void>((resolve) => { releaseTranslate = resolve; });
    const translateHasStarted = new Promise<void>((resolve) => { translateStarted = resolve; });
    const m5Gate = new Promise<void>((resolve) => { releaseM5 = resolve; });
    const m5HasStarted = new Promise<void>((resolve) => { m5Started = resolve; });
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const body = options.body;
      if (body.action === 'content-localize-v3') {
        translateSnapshot = body.snapshot as ContentLocalizeM6SummarySnapshot;
        translateStarted();
        await translateGate;
        return { data: candidateReady(translateSnapshot!, 'Late Translate must not win M5.'), response: { status: 200, ok: true, headers: { get: () => null } } };
      }
      m5Started();
      await m5Gate;
      return { data: pageStyleCandidate(body, 'M5 Stronger wins.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderSummaryPage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await translateHasStarted;
    const strongerButton = screen.getAllByRole('button').find((button) => button.textContent?.includes(translations.sr.cv.strongerSubtext));
    expect(strongerButton).toBeDefined();
    fireEvent.click(strongerButton!);
    await m5HasStarted;
    expect(pageApiFetch).toHaveBeenCalledTimes(2);
    expect(pageCv.summary).toBe('Deutsche aktuelle Zusammenfassung.');
    const toastCountBeforeLateTranslate = pageToastSuccess.mock.calls.length;
    const errorToastCountBeforeLateTranslate = pageToastError.mock.calls.length;
    releaseTranslate();
    await waitFor(() => expect(pageClientTrace.outcome).toMatchObject({ kind: 'terminal', status: 409, reason: 'operation_superseded' }));
    expect(pageWrites).toBe(0);
    expect(pageUsage).toBe(0);
    expect(pageToastSuccess.mock.calls.length).toBe(toastCountBeforeLateTranslate);
    expect(pageToastError.mock.calls.length).toBe(errorToastCountBeforeLateTranslate);
    releaseM5();
    await waitFor(() => expect(pageCv.summary).toBe('M5 Stronger wins.'));
    await waitFor(() => expect(pageWrites).toBe(1));
    expect(pageCv.summary).toBe('M5 Stronger wins.');
    expect(pageUsage).toBe(1);
    expect(pageToastSuccess.mock.calls.length).toBe(toastCountBeforeLateTranslate + 1);
  });

  it('blocks a rendered Translate candidate released after a manual edit made in flight', async () => {
    pageCv = cvForSummaryLocale('de'); pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistMode = 'success'; pageUsageMode = 'success';
    let releaseTranslate!: () => void;
    let translateSnapshot: ContentLocalizeM6SummarySnapshot | null = null;
    const translateGate = new Promise<void>((resolve) => { releaseTranslate = resolve; });
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      translateSnapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      return translateGate.then(() => ({ data: candidateReady(translateSnapshot!, 'Must be rejected after manual edit.'), response: { status: 200, ok: true, headers: { get: () => null } } }));
    });
    await renderSummaryPage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(pageApiFetch).toHaveBeenCalledTimes(1));
    fireEvent.change(document.querySelector('[data-summary-v3-editor]')!, { target: { value: 'Manual edit while translation is running.' } });
    releaseTranslate();
    await waitFor(() => expect(pageCv.summary).toBe('Deutsche aktuelle Zusammenfassung.'));
    expect((document.querySelector('[data-summary-v3-editor]') as HTMLTextAreaElement).value).toBe('Manual edit while translation is running.');
    expect(pageWrites).toBe(0);
    expect(pageUsage).toBe(0);
    expect(pageToastSuccess).not.toHaveBeenCalled();
    expect(pageClientTrace.outcome).toMatchObject({ kind: 'terminal', status: 409, reason: 'stale_snapshot' });
  });

  it('returns the exact persistence_failed receipt through the rendered atomic Translate owner', async () => {
    pageCv = cvForSummaryLocale('de'); pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistedValues = []; pagePersistMode = 'first_write_fail'; pageUsageMode = 'success';
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      return { data: candidateReady(snapshot, 'Persistence must fail.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderSummaryPage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(pageWrites).toBe(1));
    expect(pageCv.summary).toBe('Deutsche aktuelle Zusammenfassung.');
    expect(pageUsage).toBe(0);
    expect(pageToastSuccess).not.toHaveBeenCalled();
    expect(pageToastError).toHaveBeenCalledTimes(1);
    expect(pageClientTrace.outcome).toMatchObject({ kind: 'terminal', status: 500, reason: 'persistence_failed' });
  });

  it('returns rollback_failed when the rendered atomic Translate owner cannot restore the previous CV', async () => {
    pageCv = cvForSummaryLocale('de'); pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistedValues = []; pagePersistMode = 'rollback_fail'; pageUsageMode = 'fail';
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      return { data: candidateReady(snapshot, 'Rollback must fail.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderSummaryPage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(pageWrites).toBe(2));
    expect(pageUsage).toBe(0);
    expect(pageToastSuccess).not.toHaveBeenCalled();
    expect(pageToastError).toHaveBeenCalledTimes(1);
    expect(pageClientTrace.outcome).toMatchObject({ kind: 'terminal', status: 500, reason: 'rollback_failed' });
  });

  it('returns usage_accounting_failed after a successful candidate write and successful rollback', async () => {
    pageCv = cvForSummaryLocale('de');
    const previousState = {
      summary: pageCv.summary,
      contentLocale: pageCv.contentLocale,
      summarySourceLocale: pageCv.summarySourceLocale,
      summaryGeneratedLocale: pageCv.summaryGeneratedLocale,
      summaryOrigin: pageCv.summaryOrigin,
    };
    pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistedValues = []; pagePersistMode = 'success'; pageUsageMode = 'fail';
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      return { data: candidateReady(snapshot, 'Candidate must roll back.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderSummaryPage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(pageClientTrace.outcome).toMatchObject({ kind: 'terminal', status: 500, reason: 'usage_accounting_failed' }));
    expect(pagePersistCalls).toBe(2);
    expect(pagePersistedValues).toHaveLength(2);
    expect(pagePersistedValues[0]?.summary).toBe('Candidate must roll back.');
    expect(pagePersistedValues[1]).toMatchObject(previousState);
    expect(pageCv).toMatchObject(previousState);
    expect(pageCv.summary).not.toBe('Candidate must roll back.');
    expect(pageUsage).toBe(0);
    expect(pageToastSuccess).not.toHaveBeenCalled();
    expect(pageToastError).toHaveBeenCalledTimes(1);
  });

  it('launches exactly one request for two rapid confirmations of the same rendered dialog', async () => {
    pageCv = cvForSummaryLocale('de'); pageWrites = 0; pageUsage = 0; pagePersistCalls = 0; pagePersistedValues = []; pagePersistMode = 'success'; pageUsageMode = 'success';
    pageApiFetch.mockReset().mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot;
      return { data: candidateReady(snapshot, 'One confirmation only.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderSummaryPage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    const confirm = document.querySelector('[data-content-localize-confirm]')!;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(pageApiFetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pageWrites).toBe(1));
    expect(pageUsage).toBe(1);
  });
});
