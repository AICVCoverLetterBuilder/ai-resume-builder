/** @vitest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '@/lib/cv-defaults';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import { hashSummarySourceLocaleText } from '@/lib/cv-summary-source-locale';
import { languages, translations } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import {
  createContentLocalizeM6Operation,
  type ContentLocalizeM6ExperienceSnapshot,
  type ContentLocalizeM6SummarySnapshot,
} from '../content-localize-m6';
import {
  runContentLocalizeV3ExperienceClientOperation,
  type ContentLocalizeV3ExperienceCommitRequest,
} from '../content-localize-v3-client';
import {
  captureExperienceV3OperationSnapshot,
  runExperienceV3GenerateAdapter,
  type ExperienceV3AdapterInput,
} from '../experience-generate';
import {
  captureExperienceV3EnhanceOperationSnapshot,
  runExperienceV3EnhanceAdapter,
  type ExperienceV3EnhanceAdapterInput,
} from '../experience-enhance';
import {
  hashSummaryV3Value,
  type SummaryV3CommitReceipt,
  type SummaryV3GenerateAdapterDependencies,
  type SummaryV3GenerateAdapterInput,
  type SummaryV3GenerateRoutingResult,
} from '../summary-generate';
import {
  createSummaryV3StyleCandidate,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  type SummaryV3Style,
  type SummaryV3StyleCandidateUnit,
} from '../summary-style-m5';
import {
  normalizeSummaryV3StyleRouteRequest,
  type SummaryV3StyleRouteAction,
  type SummaryV3StyleRouteParams,
} from '../summary-style-m5-provider';

function cvForExperience(): CVData {
  const cv = createEmptyCv('sr');
  const source = 'Deutsche APIs koordinieren und Produktionsänderungen prüfen.';
  cv.experience = [
    {
      id: 'experience-one', company: 'Nova', position: 'Engineer', startDate: '2020-01', endDate: '', isPresent: true,
      description: source, originalUserDescription: source, canonicalDescription: source,
      descriptionOrigin: 'user', descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(source),
    },
    {
      id: 'experience-two', company: 'Other', position: 'Analyst', startDate: '2018-01', endDate: '2019-12', isPresent: false,
      description: 'Second entry remains unchanged.', originalUserDescription: 'Second entry remains unchanged.',
      canonicalDescription: 'Second entry remains unchanged.', descriptionOrigin: 'user',
      descriptionSourceLocale: 'en',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText('Second entry remains unchanged.'),
    },
  ];
  cv.summary = 'Stable summary.';
  cv.contentLocale = 'sr';
  cv.canonicalSummary = 'Canonical summary.';
  cv.runtimeMigrationVersion = 3;
  return cv;
}

function cvForGenerateExperience(): CVData {
  const cv = cvForExperience();
  cv.experience[0] = {
    ...cv.experience[0],
    description: '',
    originalUserDescription: '',
    canonicalDescription: '',
    descriptionOrigin: 'user',
    descriptionSourceLocale: undefined,
    descriptionSourceLocaleTextHash: undefined,
  };
  return cv;
}

function snapshotFor(cv: CVData, targetLocale: 'fr' | 'de' = 'fr'): ContentLocalizeM6ExperienceSnapshot {
  const result = createContentLocalizeM6Operation({
    operationId: 'experience-operation', requestId: 'experience-operation', kind: 'experience_description',
    experienceEntryId: 'experience-one', targetLocale, confirmed: true, cv,
  });
  if (result.status !== 'request_ready' || result.snapshot.kind !== 'experience_description') {
    throw new Error('experience fixture was not request-ready');
  }
  return result.snapshot;
}

function candidateReady(snapshot: ContentLocalizeM6ExperienceSnapshot, translatedText = 'Coordonner les API allemandes et vérifier les changements.') {
  return {
    status: 'candidate_ready',
    receipt: {
      operationId: snapshot.operationId, requestId: snapshot.requestId, kind: 'experience_description',
      experienceEntryId: snapshot.experienceEntryId, sourceLocale: snapshot.sourceLocale,
      targetLocale: snapshot.targetLocale, sourceTextHash: snapshot.sourceTextHash,
      translatedText, candidateTextHash: hashExperienceSourceLocaleText(translatedText), candidateOrigin: 'primary',
    },
  };
}

function summaryCandidateReady(snapshot: ContentLocalizeM6SummarySnapshot, translatedText = 'Résumé français actuel.') {
  return {
    status: 'candidate_ready',
    receipt: {
      operationId: snapshot.operationId, requestId: snapshot.requestId, kind: 'summary',
      sourceLocale: snapshot.sourceLocale, targetLocale: snapshot.targetLocale,
      sourceTextHash: snapshot.sourceTextHash, translatedText,
      candidateTextHash: hashSummarySourceLocaleText(translatedText), candidateOrigin: 'primary',
    },
  };
}

describe('M6.6 Experience client fail-closed boundary', () => {
  it.each([
    ['wrong entry', { experienceEntryId: 'other' }],
    ['wrong source locale', { sourceLocale: 'en' }],
    ['wrong target locale', { targetLocale: 'de' }],
    ['wrong source hash', { sourceTextHash: 'wrong' }],
    ['wrong operation', { operationId: 'wrong' }],
    ['wrong request', { requestId: 'wrong' }],
    ['wrong candidate hash', { candidateTextHash: 'wrong' }],
  ])('rejects %s without committing', async (_label, drift) => {
    const cv = cvForExperience();
    const snapshot = snapshotFor(cv);
    const response = candidateReady(snapshot);
    Object.assign(response.receipt, drift);
    const commit = vi.fn();
    const outcome = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv, proToken: 'token', usageCountBefore: 0 }, {
      request: async () => ({ status: 200, data: response }),
      getLiveCv: () => cv,
      getActiveOperationId: () => snapshot.operationId,
      commitCandidate: commit,
    });
    expect(outcome).toMatchObject({ kind: 'terminal', status: 422, reason: 'candidate_identity_mismatch' });
    expect(commit).not.toHaveBeenCalled();
  });

  it('rejects missing entry identity and unknown receipt keys', async () => {
    const cv = cvForExperience();
    const snapshot = snapshotFor(cv);
    const response = candidateReady(snapshot) as { receipt: Record<string, unknown>; status: string };
    delete response.receipt.experienceEntryId;
    const extra = { ...candidateReady(snapshot), receipt: { ...candidateReady(snapshot).receipt, unexpected: true } };
    for (const data of [response, extra]) {
      const commit = vi.fn();
      const outcome = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv, proToken: 'token', usageCountBefore: 0 }, {
        request: async () => ({ status: 200, data }), getLiveCv: () => cv,
        getActiveOperationId: () => snapshot.operationId, commitCandidate: commit,
      });
      expect(outcome).toMatchObject({ kind: 'terminal', reason: 'candidate_identity_mismatch' });
      expect(commit).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['provider failure', { status: 502, data: { status: 'handled_failure', reason: 'writer_failed' } }],
    ['deadline', { status: 504, data: { status: 'handled_failure', reason: 'deadline_exceeded' } }],
    ['malformed 200', { status: 200, data: { status: 'candidate_ready', receipt: {} } }],
  ])('rejects %s without mutation', async (_label, response) => {
    const cv = cvForExperience();
    const snapshot = snapshotFor(cv);
    const commit = vi.fn();
    const outcome = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv, proToken: 'token', usageCountBefore: 0 }, {
      request: async () => response, getLiveCv: () => cv,
      getActiveOperationId: () => snapshot.operationId, commitCandidate: commit,
    });
    expect(outcome.kind).toBe('terminal');
    expect(commit).not.toHaveBeenCalled();
  });

  it('rejects a superseded operation, missing entry, stale source, and request failure', async () => {
    const cv = cvForExperience();
    const snapshot = snapshotFor(cv);
    const commit = vi.fn();
    const superseded = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv, proToken: 'token', usageCountBefore: 0 }, {
      request: async () => ({ status: 200, data: candidateReady(snapshot) }), getLiveCv: () => cv,
      getActiveOperationId: () => 'newer', commitCandidate: commit,
    });
    expect(superseded).toMatchObject({ reason: 'operation_superseded' });
    const missingCv = { ...cv, experience: cv.experience.filter((entry) => entry.id !== snapshot.experienceEntryId) };
    const missing = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv: missingCv, proToken: 'token', usageCountBefore: 0 }, {
      request: async () => ({ status: 200, data: candidateReady(snapshot) }), getLiveCv: () => missingCv,
      getActiveOperationId: () => snapshot.operationId, commitCandidate: commit,
    });
    expect(missing).toMatchObject({ reason: 'experience_entry_missing' });
    const staleCv = { ...cv, experience: cv.experience.map((entry) => entry.id === snapshot.experienceEntryId ? { ...entry, description: 'manual edit' } : entry) };
    const stale = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv: staleCv, proToken: 'token', usageCountBefore: 0 }, {
      request: async () => ({ status: 200, data: candidateReady(snapshot) }), getLiveCv: () => staleCv,
      getActiveOperationId: () => snapshot.operationId, commitCandidate: commit,
    });
    expect(stale).toMatchObject({ reason: 'stale_snapshot' });
    const failed = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv, proToken: 'token', usageCountBefore: 0 }, {
      request: async () => { throw new Error('network'); }, getLiveCv: () => cv,
      getActiveOperationId: () => snapshot.operationId, commitCandidate: commit,
    });
    expect(failed).toMatchObject({ reason: 'route_request_failed' });
  });

  it('passes only the exact accepted candidate to the existing transaction owner', async () => {
    const cv = cvForExperience();
    const snapshot = snapshotFor(cv);
    let received: ContentLocalizeV3ExperienceCommitRequest | null = null;
    const outcome = await runContentLocalizeV3ExperienceClientOperation({ snapshot, cv, proToken: 'token', usageCountBefore: 3 }, {
      request: async () => ({ status: 200, data: candidateReady(snapshot) }), getLiveCv: () => cv,
      getActiveOperationId: () => snapshot.operationId,
      commitCandidate: (request) => { received = request; return { kind: 'committed', operationId: request.operationId, requestId: request.requestId, experienceEntryId: request.experienceEntryId, candidateTextHash: request.candidateTextHash }; },
    });
    expect(outcome.kind).toBe('committed');
    expect(received).toMatchObject({ experienceEntryId: 'experience-one', sourceLocale: 'de', targetLocale: 'fr', usageCountBefore: 3 });
    const committedRequest = received as unknown as ContentLocalizeV3ExperienceCommitRequest;
    expect(committedRequest.sourceText).toBe(cv.experience[0].description);
  });
});

const page = vi.hoisted(() => ({
  cv: null as CVData | null,
  incomingCvOverride: null as CVData | null,
  apiFetch: vi.fn(),
  m4Adapter: vi.fn(),
  m2Adapter: vi.fn(),
  m3Adapter: vi.fn(),
  outcomes: [] as unknown[],
  usage: 0,
  writes: 0,
  persistCalls: 0,
  failNextPersist: false,
  persistMode: 'success' as 'success' | 'candidate_fail' | 'rollback_fail',
  usageMode: 'success' as 'success' | 'fail',
  adapterOutcomes: [] as unknown[],
  persistedSnapshots: [] as CVData[],
  postWriteDrift: null as ((next: CVData) => CVData) | null,
  postWriteDriftCount: 0,
  incomingCurrentCvSyncCalls: [] as Array<{ incomingCv: CVData; pendingLocalCv: CVData | null }>,
  rerenderPage: null as (() => void) | null,
}));

const toastSpy = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'sr', t: translations.sr, languages }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: page.incomingCvOverride || page.cv,
    setCurrentCv: (next: CVData) => { page.cv = next; },
    persistCurrentCvTransactionally: (next: CVData) => {
      page.persistCalls += 1;
      if (page.failNextPersist) {
        page.failNextPersist = false;
        return false;
      }
      if (page.persistMode === 'candidate_fail' && page.persistCalls === 1) return false;
      if (page.persistMode === 'rollback_fail' && page.persistCalls >= 2) return false;
      page.writes += 1;
      page.persistedSnapshots.push(next);
      page.cv = next;
      return true;
    },
    isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(), recordProAiSuccess: () => { page.usage += 1; },
    commitProAiSuccess: () => {
      const before = page.usage;
      if (page.usageMode === 'fail') return { ok: false, attempted: true, before, after: before, delta: 0, forwardWriteResult: 'succeeded', verificationResult: 'passed', rollbackAttempted: true, rollbackResult: 'not_required' };
      page.usage += 1;
      return { ok: true, attempted: true, before, after: page.usage, delta: 1, forwardWriteResult: 'succeeded', verificationResult: 'passed', rollbackAttempted: false, rollbackResult: 'not_required' };
    },
    getProAiUsageCount: () => page.usage, lastCvSavedAt: 0, getAiGate: () => ({ status: 'ready', token: 'page-token' }),
  }),
}));
vi.mock('@/lib/api', () => ({ apiFetch: page.apiFetch }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: toastSpy }));

describe('M6.6 rendered Experience Translate integration', () => {
  beforeEach(() => {
    page.apiFetch.mockReset();
    page.m4Adapter.mockReset().mockResolvedValue({ kind: 'not_applicable' });
    page.m2Adapter.mockReset().mockResolvedValue({ kind: 'not_applicable' });
    page.m3Adapter.mockReset().mockResolvedValue({ kind: 'not_applicable' });
    page.outcomes = [];
    page.usage = 0;
    page.writes = 0;
    page.persistCalls = 0;
    page.failNextPersist = false;
    page.persistMode = 'success';
    page.usageMode = 'success';
    page.adapterOutcomes = [];
    page.incomingCvOverride = null;
    page.persistedSnapshots = [];
    page.postWriteDrift = null;
    page.postWriteDriftCount = 0;
    page.incomingCurrentCvSyncCalls = [];
    page.rerenderPage = null;
    toastSpy.success.mockReset();
    toastSpy.error.mockReset();
  });

  afterEach(() => {
    cleanup();
    delete process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED;
    delete process.env.AI_CORE_V3_ENABLED;
    vi.doUnmock('@/lib/ai-core-v3');
    vi.doUnmock('@/lib/ai-core-v3/content-localize-v3-client');
    vi.doUnmock('@/lib/cv-experience-transactional-apply');
    vi.doUnmock('@/lib/cv-current-state-sync');
    vi.resetModules();
  });

  async function renderExperiencePage(): Promise<void> {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    vi.doMock('@/lib/ai-core-v3', async () => {
      const actual = await vi.importActual<typeof import('@/lib/ai-core-v3')>('@/lib/ai-core-v3');
      return {
        ...actual,
        runSummaryV3GenerateAdapter: page.m4Adapter,
        runExperienceV3GenerateAdapter: page.m2Adapter,
        runExperienceV3EnhanceAdapter: page.m3Adapter,
      };
    });
    vi.doMock('@/lib/ai-core-v3/content-localize-v3-client', async () => {
      const actual = await vi.importActual<typeof import('../content-localize-v3-client')>('@/lib/ai-core-v3/content-localize-v3-client');
      return {
        ...actual,
        runContentLocalizeV3ExperienceClientOperation: async (...args: Parameters<typeof actual.runContentLocalizeV3ExperienceClientOperation>) => {
          const outcome = await actual.runContentLocalizeV3ExperienceClientOperation(...args);
          page.outcomes.push(outcome);
          return outcome;
        },
      };
    });
    vi.doMock('@/lib/cv-experience-transactional-apply', async () => {
      const actual = await vi.importActual<typeof import('@/lib/cv-experience-transactional-apply')>(
        '@/lib/cv-experience-transactional-apply',
      );
      return {
        ...actual,
        commitExperienceApplyTransactionally: (
          ...args: Parameters<typeof actual.commitExperienceApplyTransactionally>
        ) => {
          const transaction = actual.commitExperienceApplyTransactionally(...args);
          if (transaction.ok && page.postWriteDrift) {
            page.postWriteDriftCount += 1;
            args[0].cvRef.current = page.postWriteDrift(args[0].cvRef.current);
          }
          return transaction;
        },
      };
    });
    vi.doMock('@/lib/cv-current-state-sync', async () => {
      const actual = await vi.importActual<typeof import('@/lib/cv-current-state-sync')>(
        '@/lib/cv-current-state-sync',
      );
      return {
        ...actual,
        shouldAcceptIncomingCurrentCv: (options: Parameters<typeof actual.shouldAcceptIncomingCurrentCv>[0]) => {
          page.incomingCurrentCvSyncCalls.push({
            incomingCv: options.incomingCv,
            pendingLocalCv: options.pendingLocalCv,
          });
          return actual.shouldAcceptIncomingCurrentCv(options);
        },
      };
    });
    const Page = (await import('@/app/cv-builder/page')).default;
    const rendered = render(<Page />);
    page.rerenderPage = () => rendered.rerender(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.experience }));
  }

  function experienceAiButton(): HTMLButtonElement {
    const button = screen.getAllByRole('button').find((candidate) => (
      candidate.textContent || '').includes(translations.sr.cv.aiBullets));
    if (!button) throw new Error('Experience AI button not found');
    return button as HTMLButtonElement;
  }

  function experienceRemoveButton(id: string): HTMLButtonElement {
    const textarea = screen.getByDisplayValue(
      page.cv?.experience.find((entry) => entry.id === id)?.description || '',
    ) as HTMLTextAreaElement;
    const card = textarea.closest('div.rounded-lg');
    const button = card?.querySelector('button');
    if (!button) throw new Error(`Experience remove button not found for ${id}`);
    return button as HTMLButtonElement;
  }

  async function startExperienceTranslate(id: string, target: string): Promise<void> {
    fireEvent.click(screen.getByTestId(`experience-translate-${id}`));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: target } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
  }

  function reorderRenderedExperience(idFirst: string, idSecond: string): void {
    const current = page.cv!;
    page.cv = {
      ...current,
      experience: [
        current.experience.find((entry) => entry.id === idFirst)!,
        current.experience.find((entry) => entry.id === idSecond)!,
      ],
    };
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.experience }));
  }

  function enableRenderedV3(): void {
    process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
    process.env.AI_CORE_V3_ENABLED = 'true';
  }

  function generateResponse(manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest']) {
    const bullets = ['Razvija pouzdane API-je.', 'Koordinira dnevni rad sa timom.', 'Održava jasne tehničke evidencije.'];
    const text = bullets.map((bullet) => `• ${bullet}`).join('\n');
    return {
      ok: true,
      action: 'experience_v3_generate',
      providerOutput: { operationId: manifest.operationId, entryId: manifest.entryId, snapshotHash: manifest.snapshotHash, locale: manifest.locale, bullets },
      candidate: {
        operationId: manifest.operationId,
        candidateId: `candidate-${manifest.operationId}`,
        operationKind: 'experience_generate',
        targetLocale: manifest.locale,
        sourceSnapshotHash: manifest.snapshotHash,
        text,
        units: bullets.map((unitText, index) => ({ unitId: `unit-${index}`, entryId: manifest.entryId, text: unitText })),
      },
      validation: {
        decision: 'accept',
        phases: {
          structural: { status: 'passed', violations: [] },
          semantic: { status: 'passed', violations: [] },
          language_quality: { status: 'passed', violations: [] },
        },
      },
    };
  }

  function enhanceResponse(manifest: ReturnType<typeof captureExperienceV3EnhanceOperationSnapshot>['manifest']) {
    const units = manifest.facts.map((fact, index) => ({ factId: fact.factId, text: `Napredna stavka ${index + 1}.` }));
    const text = units.map((unit) => `• ${unit.text}`).join('\n');
    return {
      ok: true,
      action: 'experience_v3_enhance',
      providerOutput: { operationId: manifest.operationId, entryId: manifest.entryId, snapshotHash: manifest.snapshotHash, locale: manifest.locale, units },
      candidate: {
        operationId: manifest.operationId,
        candidateId: `candidate-${manifest.operationId}`,
        operationKind: 'experience_enhance',
        targetLocale: manifest.locale,
        sourceSnapshotHash: manifest.snapshotHash,
        text,
        units: units.map((unit, index) => ({ unitId: `unit-${index}`, entryId: manifest.entryId, factIds: [unit.factId], text: unit.text })),
      },
      validation: {
        decision: 'accept',
        phases: {
          structural: { status: 'passed', violations: [] },
          semantic: { status: 'passed', violations: [] },
          language_quality: { status: 'passed', violations: [] },
        },
      },
      materiality: { status: 'material', kind: 'clarity_improvement', sourceEquivalent: false, degradationDetected: false },
    };
  }

  function configureRealV3AdapterGates(options: {
    generate?: { started: () => void; release: Promise<void> };
    enhance?: { started: () => void; release: Promise<void> };
  } = {}): void {
    page.m2Adapter.mockImplementation(async (input: ExperienceV3AdapterInput, dependencies: Parameters<typeof runExperienceV3GenerateAdapter>[1]) => {
      options.generate?.started();
      if (options.generate) await options.generate.release;
      const outcome = await runExperienceV3GenerateAdapter(input, {
        ...dependencies,
        request: async ({ manifest }) => generateResponse(manifest),
      });
      page.adapterOutcomes.push(outcome);
      return outcome;
    });
    page.m3Adapter.mockImplementation(async (input: ExperienceV3EnhanceAdapterInput, dependencies: Parameters<typeof runExperienceV3EnhanceAdapter>[1]) => {
      options.enhance?.started();
      if (options.enhance) await options.enhance.release;
      const outcome = await runExperienceV3EnhanceAdapter(input, {
        ...dependencies,
        request: async ({ manifest }) => enhanceResponse(manifest),
      });
      page.adapterOutcomes.push(outcome);
      return outcome;
    });
  }

  function commitSummaryM4Candidate(
    input: SummaryV3GenerateAdapterInput,
    dependencies: SummaryV3GenerateAdapterDependencies,
    text = 'M4 cross-domain Summary result.',
  ): SummaryV3GenerateRoutingResult {
    if (dependencies.getActiveOperationId() !== input.operationId) {
      return { kind: 'handled_failure', typedReason: 'operation_superseded' };
    }
    const before = dependencies.getLiveState().cv;
    const next: CVData = {
      ...before,
      summary: text,
      summaryOrigin: 'ai_generated',
      summaryGeneratedLocale: input.requestedLocale as CVData['contentLocale'],
      summarySourceLocale: input.requestedLocale,
      summarySourceLocaleTextHash: hashSummarySourceLocaleText(text),
      summaryGenerationContextKey: input.jobContextHash,
      contentLocale: input.requestedLocale as CVData['contentLocale'],
    };
    const receipt: SummaryV3CommitReceipt = dependencies.commitCandidate({
      operationId: input.operationId,
      requestId: input.requestId,
      previousCvHash: hashSummaryV3Value(before),
      candidateHash: hashSummaryV3Value(text),
      requestedLocale: input.requestedLocale,
      usageCountBefore: input.usageCountBefore,
      previousCv: before,
      nextCv: next,
    });
    return receipt.kind === 'committed'
      ? { kind: 'handled_success' }
      : { kind: 'handled_failure', typedReason: receipt.reason };
  }

  function summaryStyleCandidate(body: Record<string, unknown>, text: string): Record<string, unknown> {
    const action = String(body.action || '') as SummaryV3StyleRouteAction;
    const normalized = normalizeSummaryV3StyleRouteRequest(
      action,
      body as unknown as SummaryV3StyleRouteParams,
      2000,
    );
    const snapshot = createSummaryV3StyleOperationSnapshot(normalized);
    const style: SummaryV3Style = action === 'summary_shorter'
      ? 'shorter'
      : action === 'summary_professional' ? 'professional' : 'stronger';
    const units: readonly SummaryV3StyleCandidateUnit[] = [{
      unitId: `unit-${hashSummaryV3StyleValue(text)}`,
      text,
      factIds: [`fact-${hashSummaryV3StyleValue(text)}`],
    }];
    const candidate = createSummaryV3StyleCandidate(snapshot, units);
    return {
      kind: 'candidate_ready',
      style,
      mode: snapshot.mode,
      candidate: { ...candidate, style, locale: snapshot.requestedLocale },
      evidence: {
        snapshotHash: snapshot.snapshotHash,
        manifestHash: snapshot.manifestHash,
        candidateHash: candidate.hash,
        retries: 0,
        fallbacks: 0,
        v2Fallthrough: 0,
      },
    };
  }

  type SummaryCrossDomainKind = 'm4' | 'm5' | 'm65';
  type ExperienceCrossDomainKind = 'm2' | 'm3' | 'm66';

  async function runCrossDomainRenderedCase(options: {
    readonly summary: SummaryCrossDomainKind;
    readonly experience: ExperienceCrossDomainKind;
    readonly summaryFirst: boolean;
  }): Promise<void> {
    const summaryText = options.summary === 'm4'
      ? 'M4 cross-domain Summary result.'
      : options.summary === 'm5'
        ? 'M5 cross-domain style result.'
        : 'M6.5 cross-domain Summary translation.';
    const experienceText = 'M6.6 cross-domain Experience translation.';
    page.cv = options.experience === 'm2' ? cvForGenerateExperience() : cvForExperience();
    page.cv.summary = options.summary === 'm4' ? '' : 'Stable summary before cross-domain operation.';
    page.cv.summaryOrigin = 'ai_generated';
    page.cv.summaryGeneratedLocale = 'de';
    page.cv.summarySourceLocale = 'de';
    page.cv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(page.cv.summary);
    page.usage = 0;
    page.writes = 0;
    page.apiFetch.mockReset();
    enableRenderedV3();

    let releaseSummary!: () => void;
    let releaseExperience!: () => void;
    let markSummaryStarted!: () => void;
    let markExperienceStarted!: () => void;
    const summaryGate = new Promise<void>((resolve) => { releaseSummary = resolve; });
    const experienceGate = new Promise<void>((resolve) => { releaseExperience = resolve; });
    const summaryStarted = new Promise<void>((resolve) => { markSummaryStarted = resolve; });
    const experienceStarted = new Promise<void>((resolve) => { markExperienceStarted = resolve; });

    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const body = options.body;
      const action = String(body.action || '');
      if (action.startsWith('summary_')) {
        markSummaryStarted();
        await summaryGate;
        return {
          data: summaryStyleCandidate(body, summaryText),
          response: { status: 200, ok: true, headers: { get: () => null } },
        };
      }
      if (action === 'content-localize-v3') {
        const snapshot = body.snapshot as ContentLocalizeM6SummarySnapshot | ContentLocalizeM6ExperienceSnapshot;
        if (snapshot.kind === 'summary') {
          markSummaryStarted();
          await summaryGate;
          return {
            data: summaryCandidateReady(snapshot, summaryText),
            response: { status: 200, ok: true, headers: { get: () => null } },
          };
        }
        markExperienceStarted();
        await experienceGate;
        return {
          data: candidateReady(snapshot, experienceText),
          response: { status: 200, ok: true, headers: { get: () => null } },
        };
      }
      throw new Error(`unexpected cross-domain action: ${action}`);
    });

    page.m4Adapter.mockImplementation(async (
      input: SummaryV3GenerateAdapterInput,
      dependencies: SummaryV3GenerateAdapterDependencies,
    ) => {
      markSummaryStarted();
      await summaryGate;
      return commitSummaryM4Candidate(input, dependencies, summaryText);
    });

    const experienceGateOptions = options.experience === 'm2'
      ? { generate: { started: markExperienceStarted, release: experienceGate } }
      : options.experience === 'm3'
        ? { enhance: { started: markExperienceStarted, release: experienceGate } }
        : {};
    configureRealV3AdapterGates(experienceGateOptions);
    await renderExperiencePage();

    const startSummary = async (): Promise<void> => {
      fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
      if (options.summary === 'm4') {
        const editor = document.querySelector('[data-summary-v3-editor]') as HTMLTextAreaElement | null;
        if (!editor) throw new Error('Summary editor not found');
        if (editor.value !== '') fireEvent.change(editor, { target: { value: '' } });
        const button = screen.getAllByRole('button').find((candidate) => (
          candidate.textContent || '').includes(translations.sr.cv.generateSubtext));
        if (!button) throw new Error('Summary Generate button not found');
        fireEvent.click(button);
      } else if (options.summary === 'm5') {
        const button = screen.getAllByRole('button').find((candidate) => (
          candidate.textContent || '').includes(translations.sr.cv.strongerSubtext));
        if (!button) throw new Error('Summary style button not found');
        fireEvent.click(button);
      } else {
        fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
        fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
        fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
      }
    };

    const startExperience = async (): Promise<void> => {
      fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.experience }));
      if (options.experience === 'm66') {
        await startExperienceTranslate('experience-one', 'fr');
        return;
      }
      if (options.experience === 'm2') {
        const source = screen.queryByDisplayValue('Deutsche APIs koordinieren und Produktionsänderungen prüfen.') as HTMLTextAreaElement | null;
        if (source) fireEvent.change(source, { target: { value: '' } });
      }
      fireEvent.click(experienceAiButton());
    };

    if (options.summaryFirst) {
      await startSummary();
      await summaryStarted;
      await startExperience();
      await experienceStarted;
      releaseSummary();
      await waitFor(() => expect(page.cv?.summary).toBe(summaryText));
      releaseExperience();
    } else {
      await startExperience();
      await experienceStarted;
      await startSummary();
      await summaryStarted;
      releaseExperience();
      const expectedExperience = options.experience === 'm2'
        ? '• Razvija pouzdane API-je.\n• Koordinira dnevni rad sa timom.\n• Održava jasne tehničke evidencije.'
        : options.experience === 'm3'
          ? '• Napredna stavka 1.'
          : experienceText;
      await waitFor(() => expect(page.cv?.experience[0]?.description).toBe(expectedExperience));
      releaseSummary();
    }
    await waitFor(() => expect(page.cv?.summary).toBe(summaryText));
    const expectedExperience = options.experience === 'm2'
      ? '• Razvija pouzdane API-je.\n• Koordinira dnevni rad sa timom.\n• Održava jasne tehničke evidencije.'
      : options.experience === 'm3'
        ? '• Napredna stavka 1.'
        : experienceText;
    await waitFor(() => expect(page.cv?.experience[0]?.description).toBe(expectedExperience));
    expect(page.cv?.experience[1]?.description).toBe('Second entry remains unchanged.');
    expect(page.usage).toBe(2);
    expect(page.writes).toBe(2);
  }

  it('opens the stable entry dialog with read-only source and source-disabled target', async () => {
    page.cv = cvForExperience(); page.usage = 0; page.writes = 0; page.apiFetch.mockReset();
    await renderExperiencePage();
    fireEvent.click(screen.getByTestId('experience-translate-experience-one'));
    const source = screen.getByLabelText(translations.sr.common.sourceLanguage) as HTMLInputElement;
    const target = screen.getByLabelText(translations.sr.common.targetLanguage) as HTMLSelectElement;
    expect(source.readOnly).toBe(true);
    expect(source.value).toContain('Deutsch');
    expect([...target.options].find((option) => option.value === 'de')?.disabled).toBe(true);
  });

  it('cancel, blank source, stale dialog, unsupported and same-locale choices have zero effects', async () => {
    page.cv = cvForExperience(); page.usage = 0; page.writes = 0; page.apiFetch.mockReset();
    await renderExperiencePage();
    fireEvent.click(screen.getByTestId('experience-translate-experience-one'));
    fireEvent.click(screen.getByText(translations.sr.common.cancel));
    expect(page.apiFetch).not.toHaveBeenCalled();
    const field = screen.getByDisplayValue('Deutsche APIs koordinieren und Produktionsänderungen prüfen.') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: '' } });
    expect(screen.queryByTestId('experience-translate-experience-one')).not.toBeNull();
    fireEvent.click(screen.getByTestId('experience-translate-experience-one'));
    expect(screen.queryByLabelText(translations.sr.common.targetLanguage)).toBeNull();
    expect(page.usage).toBe(0);
  });

  it('sends the frozen Experience snapshot and durably changes only the selected description', async () => {
    page.cv = cvForExperience(); page.usage = 0; page.writes = 0; page.apiFetch.mockReset();
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    fireEvent.click(screen.getByTestId('experience-translate-experience-one'));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    const body = page.apiFetch.mock.calls[0][1].body as Record<string, unknown>;
    const snapshot = body.snapshot as ContentLocalizeM6ExperienceSnapshot;
    expect(body.action).toBe('content-localize-v3');
    expect(snapshot.kind).toBe('experience_description');
    expect(snapshot.experienceEntryId).toBe('experience-one');
    expect(snapshot.sourceLocale).toBe('de');
    expect(snapshot.targetLocale).toBe('fr');
    expect(snapshot.sourceText).toContain('Deutsche APIs');
    const translated = page.cv?.experience.find((entry) => entry.id === 'experience-one');
    expect(translated?.description).toContain('Coordonner');
    expect(translated?.position).toBe('Engineer');
    expect(translated?.company).toBe('Nova');
    expect(translated?.descriptionSourceLocale).toBe('fr');
    expect(translated?.generatedLocale).toBe('fr');
    expect(translated?.aiOutputProvenance?.sourceLocale).toBe('de');
    expect(translated?.aiOutputProvenance?.targetLocale).toBe('fr');
    expect(translated?.aiOutputProvenance?.operationMode).toBe('translate');
    expect(page.cv?.experience[1].description).toBe('Second entry remains unchanged.');
    expect(page.cv?.summary).toBe('Stable summary.');
    expect(page.cv?.contentLocale).toBe('sr');
    expect(page.cv?.canonicalSummary).toBe('Canonical summary.');
    expect(page.usage).toBe(1);
    expect(page.writes).toBe(1);
  });

  it('rejects a manual edit made while the response is in flight', async () => {
    page.cv = cvForExperience(); page.usage = 0; page.writes = 0; page.apiFetch.mockReset();
    let release: (value?: unknown) => void = () => undefined;
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return new Promise((resolve) => { release = () => resolve({ data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } }); });
    });
    await renderExperiencePage();
    fireEvent.click(screen.getByTestId('experience-translate-experience-one'));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    const field = screen.getByDisplayValue('Deutsche APIs koordinieren und Produktionsänderungen prüfen.') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'New user-authored text.' } });
    release?.(null);
    await waitFor(() => expect(page.usage).toBe(0));
    expect((screen.getByDisplayValue('New user-authored text.') as HTMLTextAreaElement).value).toBe('New user-authored text.');
  });

  it('R1 stale dialog before confirm makes zero route, write, usage, or ownership effects', async () => {
    page.cv = cvForExperience();
    await renderExperiencePage();
    fireEvent.click(screen.getByTestId('experience-translate-experience-one'));
    fireEvent.change(
      screen.getByDisplayValue('Deutsche APIs koordinieren und Produktionsänderungen prüfen.'),
      { target: { value: 'Fresh user edit before authorization.' } },
    );
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(screen.queryByLabelText(translations.sr.common.targetLanguage)).toBeNull());
    expect(page.apiFetch).not.toHaveBeenCalled();
    expect(page.writes).toBe(0);
    expect(page.usage).toBe(0);
    expect(screen.getByDisplayValue('Fresh user edit before authorization.')).toBeTruthy();
  });

  it('R2 delete during in-flight Translate invalidates the same latest-entry authority', async () => {
    page.cv = cvForExperience();
    let release!: (value: unknown) => void;
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return new Promise((resolve) => { release = () => resolve({ data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } }); });
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-two', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(experienceRemoveButton('experience-two'));
    expect(screen.queryByDisplayValue('Second entry remains unchanged.')).toBeNull();
    release(null);
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'operation_superseded' }));
    expect(page.usage).toBe(0);
    expect(page.writes).toBe(0);
    expect(screen.queryByDisplayValue('Coordonner les API allemandes et vérifier les changements.')).toBeNull();
  });

  it('R3 reordered in-flight Translate commits the stable target ID, not its former index', async () => {
    page.cv = cvForExperience();
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return new Promise((resolve) => {
        setTimeout(() => resolve({ data: candidateReady(snapshot, 'Zweite Übersetzung.'), response: { status: 200, ok: true, headers: { get: () => null } } }), 0);
      });
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-two', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    reorderRenderedExperience('experience-two', 'experience-one');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' }));
    expect(page.cv?.experience.find((entry) => entry.id === 'experience-two')?.description).toBe('Zweite Übersetzung.');
    expect(page.cv?.experience.find((entry) => entry.id === 'experience-one')?.description).toBe('Deutsche APIs koordinieren und Produktionsänderungen prüfen.');
    expect(page.usage).toBe(1);
  });

  it('O1 one live same-entry authority is the shared latest request path', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).not.toContain('experienceApplyOwnershipRef');
    expect(source.match(/latestBulletsRequestIdRef\s*=\s*useRef/g) || []).toHaveLength(1);
  });

  it('O2 Generate supersedes Translate through the shared entry authority', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain('latestBulletsRequestIdRef.current = { ...latestBulletsRequestIdRef.current, [clickedExperienceEntryId]: reqCtx.requestId }');
  });

  it('O3 Translate supersedes Generate through the shared entry authority', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain('latestBulletsRequestIdRef.current[request.experienceEntryId] !== request.operationId');
  });

  it('O4 Enhance supersedes Translate without a second persistent owner', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain('runExperienceV3EnhanceAdapter');
    expect(source).not.toContain('translationOwnershipRef');
  });

  it('O5 Translate supersedes Enhance through the same latest-entry map', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain('getActiveOperationId: () => (');
    expect(source).toContain('latestBulletsRequestIdRef.current[clickedExperienceEntryId] || \'\'');
  });

  it('O6 unrelated Experience entries retain independent latest-entry keys', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain('latestBulletsRequestIdRef.current = { ...latestBulletsRequestIdRef.current, [id]: \'\' }');
  });

  it('O7 manual edit invalidates the current same-entry operation', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain("invalidateExperienceOperation(id);\n    commitCvUpdate((prev) => applyCanonicalExperienceEdit");
  });

  it('O8 deletion invalidates the current same-entry operation before removal', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain("invalidateExperienceOperation(id);\n    commitCvUpdate(prev => ({ ...prev, experience: prev.experience.filter");
  });

  it('R4 TRANSLATE_TO_GENERATE_TRANSITION_PROVEN: source edit is required and the late Translate has apply +0 / usage +0', async () => {
    page.cv = cvForExperience();
    let releaseTranslate!: () => void;
    let releaseGenerate!: () => void;
    let generateStarted!: () => void;
    const translateGate = new Promise<void>((resolve) => { releaseTranslate = resolve; });
    const generateGate = new Promise<void>((resolve) => { releaseGenerate = resolve; });
    const generateHasStarted = new Promise<void>((resolve) => { generateStarted = resolve; });
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      await translateGate;
      return { data: candidateReady(snapshot, 'Kasni prevod ne sme pobediti.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    enableRenderedV3();
    configureRealV3AdapterGates({ generate: { started: () => generateStarted(), release: generateGate } });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByDisplayValue('Deutsche APIs koordinieren und Produktionsänderungen prüfen.'), { target: { value: '' } });
    fireEvent.click(experienceAiButton());
    await generateHasStarted;
    releaseGenerate();
    await waitFor(() => expect(page.adapterOutcomes.at(-1)).toMatchObject({ kind: 'handled_success' }));
    const generatedText = page.cv?.experience[0].description;
    releaseTranslate();
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'operation_superseded' }));
    expect(page.cv?.experience[0].description).toBe(generatedText);
    expect(page.adapterOutcomes.at(-1)).toMatchObject({ kind: 'handled_success' });
    expect(page.usage).toBe(1);
  });

  it('R5 GENERATE_TO_TRANSLATE_TRANSITION_PROVEN: source edit is required and the late Generate has apply +0 / usage +0', async () => {
    page.cv = cvForGenerateExperience();
    let releaseGenerate!: () => void;
    let generateStarted!: () => void;
    const generateGate = new Promise<void>((resolve) => { releaseGenerate = resolve; });
    const generateHasStarted = new Promise<void>((resolve) => { generateStarted = resolve; });
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    enableRenderedV3();
    configureRealV3AdapterGates({ generate: { started: () => generateStarted(), release: generateGate } });
    await renderExperiencePage();
    fireEvent.click(experienceAiButton());
    await generateHasStarted;
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'Nova ručno potvrđena tekstualna činjenica.' } });
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' }));
    const translatedText = page.cv?.experience[0].description;
    releaseGenerate();
    await waitFor(() => expect(page.adapterOutcomes.at(-1)).toMatchObject({ kind: 'handled_failure', typedReason: 'stale_snapshot' }));
    expect(page.cv?.experience[0].description).toBe(translatedText);
    expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' });
    expect(page.usage).toBe(1);
  });

  it('R6 Translate → Enhance keeps the newer Enhance result and rejects the late Translate', async () => {
    page.cv = cvForExperience();
    let releaseTranslate!: () => void;
    let releaseEnhance!: () => void;
    let enhanceStarted!: () => void;
    const translateGate = new Promise<void>((resolve) => { releaseTranslate = resolve; });
    const enhanceGate = new Promise<void>((resolve) => { releaseEnhance = resolve; });
    const enhanceHasStarted = new Promise<void>((resolve) => { enhanceStarted = resolve; });
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      await translateGate;
      return { data: candidateReady(snapshot, 'Kasni prevod ne sme pobediti.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    enableRenderedV3();
    configureRealV3AdapterGates({ enhance: { started: () => enhanceStarted(), release: enhanceGate } });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(experienceAiButton());
    await enhanceHasStarted;
    releaseEnhance();
    await waitFor(() => expect(page.adapterOutcomes.at(-1)).toMatchObject({ kind: 'handled_success' }));
    const enhancedText = page.cv?.experience[0].description;
    releaseTranslate();
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'operation_superseded' }));
    expect(page.cv?.experience[0].description).toBe(enhancedText);
    expect(page.usage).toBe(1);
  });

  it('R7 Enhance → Translate keeps the newer Translate result and rejects the late Enhance', async () => {
    page.cv = cvForExperience();
    let releaseEnhance!: () => void;
    let enhanceStarted!: () => void;
    const enhanceGate = new Promise<void>((resolve) => { releaseEnhance = resolve; });
    const enhanceHasStarted = new Promise<void>((resolve) => { enhanceStarted = resolve; });
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot, 'Prevod pobjeđuje kasni Enhance.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    enableRenderedV3();
    configureRealV3AdapterGates({ enhance: { started: () => enhanceStarted(), release: enhanceGate } });
    await renderExperiencePage();
    fireEvent.click(experienceAiButton());
    await enhanceHasStarted;
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' }));
    const translatedText = page.cv?.experience[0].description;
    releaseEnhance();
    await waitFor(() => expect(page.adapterOutcomes.at(-1)).toMatchObject({ kind: 'handled_failure', typedReason: 'operation_superseded' }));
    expect(page.cv?.experience[0].description).toBe(translatedText);
    expect(page.usage).toBe(1);
  });

  it('R8 Translate → Translate commits only the newest same-entry request', async () => {
    page.cv = cvForExperience();
    const releases: Array<() => void> = [];
    let call = 0;
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      const current = call++;
      await new Promise<void>((resolve) => { releases[current] = resolve; });
      return { data: candidateReady(snapshot, current === 0 ? 'Stariji rezultat.' : 'Najnoviji rezultat.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    await startExperienceTranslate('experience-one', 'es');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(2));
    releases[1]();
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' }));
    releases[0]();
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'operation_superseded' }));
    expect(page.cv?.experience[0].description).toBe('Najnoviji rezultat.');
    expect(page.usage).toBe(1);
  });

  it('R9 different Experience entries remain independent under concurrent Translate', async () => {
    page.cv = cvForExperience();
    const releases: Array<() => void> = [];
    let call = 0;
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      const current = call++;
      await new Promise<void>((resolve) => { releases[current] = resolve; });
      return { data: candidateReady(snapshot, snapshot.experienceEntryId === 'experience-one' ? 'Prvi rezultat.' : 'Drugi rezultat.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    await startExperienceTranslate('experience-two', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(2));
    releases[1](); releases[0]();
    await waitFor(() => expect(page.usage).toBe(2));
    expect(page.cv?.experience.find((entry) => entry.id === 'experience-one')?.description).toBe('Prvi rezultat.');
    expect(page.cv?.experience.find((entry) => entry.id === 'experience-two')?.description).toBe('Drugi rezultat.');
  });

  it('R10 duplicate Confirm launches one request, write, persistence, usage increment, and toast', async () => {
    page.cv = cvForExperience();
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    fireEvent.click(screen.getByTestId('experience-translate-experience-one'));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    const confirm = document.querySelector('[data-content-localize-confirm]')!;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' }));
    expect(page.apiFetch).toHaveBeenCalledTimes(1);
    expect(page.persistCalls).toBe(1);
    expect(page.usage).toBe(1);
    await startExperienceTranslate('experience-one', 'es');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(2));
  });

  it('R11 persistence failure restores the previous CV and keeps usage at zero', async () => {
    page.cv = cvForExperience();
    page.persistMode = 'candidate_fail';
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'persistence_failed' }));
    expect(page.cv?.experience[0].description).toBe('Deutsche APIs koordinieren und Produktionsänderungen prüfen.');
    expect(page.persistCalls).toBe(2);
    expect(page.usage).toBe(0);
  });

  it('R12_TRANSLATE_PATH=YES: authoritative Translate readback drift rolls back before persistence success or usage', async () => {
    const before = cvForExperience();
    page.cv = before;
    page.postWriteDrift = (next) => ({
      ...next,
      experience: next.experience.map((entry) => (
        entry.id === 'experience-one'
          ? { ...entry, description: 'tampered post-write authority' }
          : entry
      )),
    });
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'readback_failed' }));
    expect(page.postWriteDriftCount).toBe(1);
    // The candidate write was scheduled, but only the restored previous CV is
    // acknowledged by persistence after authoritative readback rejects it.
    expect(page.persistCalls).toBe(1);
    expect(page.persistedSnapshots).toEqual([before]);
    expect(page.cv).toEqual(before);
    expect(page.usage).toBe(0);
    expect(toastSpy.success).not.toHaveBeenCalled();
  });

  it('R13 rollback failure reports rollback_failed truthfully', async () => {
    page.cv = cvForExperience();
    page.persistMode = 'rollback_fail';
    page.usageMode = 'fail';
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'rollback_failed' }));
    expect(page.usage).toBe(0);
    expect(page.persistCalls).toBe(2);
  });

  it('R14 usage accounting failure rolls back the durable candidate', async () => {
    page.cv = cvForExperience();
    page.usageMode = 'fail';
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'usage_accounting_failed' }));
    expect(page.cv?.experience[0].description).toBe('Deutsche APIs koordinieren und Produktionsänderungen prüfen.');
    expect(page.persistCalls).toBe(2);
    expect(page.usage).toBe(0);
  });

  it('R15 repeated en→de→fr uses the exact current translated text as the second source', async () => {
    const cv = cvForExperience();
    const english = 'Coordinate English APIs and verify production changes.';
    cv.experience[0] = { ...cv.experience[0], description: english, originalUserDescription: english, canonicalDescription: english, descriptionSourceLocale: 'en', descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(english) };
    page.cv = cv;
    const snapshots: ContentLocalizeM6ExperienceSnapshot[] = [];
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      snapshots.push(snapshot);
      const translated = snapshot.targetLocale === 'de' ? 'Deutsche APIs koordinieren.' : 'Coordonner les API allemandes.';
      return { data: candidateReady(snapshot, translated), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'de');
    await waitFor(() => expect(page.usage).toBe(1));
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.usage).toBe(2));
    expect(snapshots[0]).toMatchObject({ sourceLocale: 'en', sourceText: english, targetLocale: 'de' });
    expect(snapshots[1]).toMatchObject({ sourceLocale: 'de', sourceText: 'Deutsche APIs koordinieren.', targetLocale: 'fr' });
    expect(page.cv?.experience[0].description).toBe('Coordonner les API allemandes.');
    expect(page.cv?.experience[0].originalUserDescription).toBe(english);
    expect(page.cv?.experience[0].canonicalDescription).toBe(english);
  });

  it('R16 manual edit after translation is owned by existing applyCanonicalExperienceEdit', async () => {
    page.cv = cvForExperience();
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6ExperienceSnapshot;
      return { data: candidateReady(snapshot), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.usage).toBe(1));
    const edited = 'Manual facts added after translation.';
    fireEvent.change(screen.getByDisplayValue('Coordonner les API allemandes et vérifier les changements.'), { target: { value: edited } });
    await waitFor(() => expect(screen.getByDisplayValue(edited)).toBeTruthy());
    expect(screen.getByDisplayValue(edited)).toBeTruthy();
    expect(page.usage).toBe(1);
  });

  it('R17 Summary and Experience Translate remain independent domain owners', async () => {
    page.cv = cvForExperience();
    page.cv.summary = 'Deutsche Zusammenfassung.';
    page.cv.summaryOrigin = 'ai_generated';
    page.cv.summaryGeneratedLocale = 'de';
    page.cv.summarySourceLocale = 'de';
    page.cv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(page.cv.summary);
    const releases: Array<() => void> = [];
    let call = 0;
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot | ContentLocalizeM6ExperienceSnapshot;
      const current = call++;
      await new Promise<void>((resolve) => { releases[current] = resolve; });
      const data = snapshot.kind === 'summary'
        ? summaryCandidateReady(snapshot, 'Sažetak nezavisno preveden.')
        : candidateReady(snapshot, 'Iskustvo nezavisno prevedeno.');
      return { data, response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.experience }));
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.apiFetch).toHaveBeenCalledTimes(2));
    releases[1](); releases[0]();
    await waitFor(() => expect(page.usage).toBe(2));
    expect(page.cv?.summary).toBe('Sažetak nezavisno preveden.');
    expect(page.cv?.experience[0].description).toBe('Iskustvo nezavisno prevedeno.');
  });

  it('R18_CURRENTCV_EFFECT_OBSERVED=YES: a rerendered stale incoming snapshot cannot overwrite newer local Experience state', async () => {
    page.cv = cvForExperience();
    await renderExperiencePage();
    const localText = 'Lokalno potvrđena činjenica.';
    fireEvent.change(
      screen.getByDisplayValue('Deutsche APIs koordinieren und Produktionsänderungen prüfen.'),
      { target: { value: localText } },
    );
    await waitFor(() => expect(screen.getByDisplayValue(localText)).toBeTruthy());
    const staleIncoming = cvForExperience();
    const staleHash = hashExperienceSourceLocaleText(staleIncoming.experience[0]!.description);
    const localHashBefore = hashExperienceSourceLocaleText(localText);
    page.incomingCvOverride = staleIncoming;
    page.rerenderPage?.();
    await waitFor(() => expect(
      page.incomingCurrentCvSyncCalls.some((call) => call.incomingCv === staleIncoming),
    ).toBe(true));
    const visibleAfter = (screen.getByDisplayValue(localText) as HTMLTextAreaElement).value;
    const localHashAfter = hashExperienceSourceLocaleText(visibleAfter);
    expect(localHashAfter).toBe(localHashBefore);
    expect(localHashAfter).not.toBe(staleHash);
  });

  it('M6.7 currentCv sync accepts the exact local acknowledgement, clears pending state, and later accepts a legitimate store update', async () => {
    page.cv = cvForExperience();
    await renderExperiencePage();
    const localText = 'Lokalno potvrđena činjenica za potvrdu stanja.';
    fireEvent.change(
      screen.getByDisplayValue('Deutsche APIs koordinieren und Produktionsänderungen prüfen.'),
      { target: { value: localText } },
    );
    await waitFor(() => expect(screen.getByDisplayValue(localText)).toBeTruthy());
    const staleIncoming = cvForExperience();
    page.incomingCvOverride = staleIncoming;
    page.rerenderPage?.();
    await waitFor(() => expect(
      page.incomingCurrentCvSyncCalls.some((call) => call.incomingCv === staleIncoming),
    ).toBe(true));
    expect((screen.getByDisplayValue(localText) as HTMLTextAreaElement).value).toBe(localText);

    const pendingLocalSnapshot = page.incomingCurrentCvSyncCalls.find(
      (call) => call.incomingCv === staleIncoming,
    )?.pendingLocalCv;
    if (!pendingLocalSnapshot) throw new Error('Expected a pending local CV snapshot.');

    page.incomingCvOverride = pendingLocalSnapshot;
    page.rerenderPage?.();
    await waitFor(() => expect(
      page.incomingCurrentCvSyncCalls.some((call) => call.incomingCv === pendingLocalSnapshot),
    ).toBe(true));
    expect((screen.getByDisplayValue(localText) as HTMLTextAreaElement).value).toBe(localText);

    const laterStoreSnapshot: CVData = {
      ...pendingLocalSnapshot!,
      experience: pendingLocalSnapshot!.experience.map((entry) => entry.id === 'experience-one'
        ? { ...entry, description: 'Kasnija legitimna objava iz store-a.' }
        : entry),
    };
    page.incomingCvOverride = laterStoreSnapshot;
    page.rerenderPage?.();
    await waitFor(() => expect(
      (screen.getByDisplayValue('Kasnija legitimna objava iz store-a.') as HTMLTextAreaElement).value,
    ).toBe('Kasnija legitimna objava iz store-a.'));
  });

  it.each([
    ['A M4 Summary Generate ↔ M6.6 Experience Translate', 'm4', 'm66'],
    ['B M5 Summary style ↔ M6.6 Experience Translate', 'm5', 'm66'],
    ['C M6.5 Summary Translate ↔ M2 Generate', 'm65', 'm2'],
    ['D M6.5 Summary Translate ↔ M3 Enhance', 'm65', 'm3'],
    ['E M6.5 Summary Translate ↔ M6.6 Experience Translate', 'm65', 'm66'],
  ] as const)('%s preserves both domains when Summary completes first', async (_label, summary, experience) => {
    await runCrossDomainRenderedCase({ summary, experience, summaryFirst: true });
  });

  it.each([
    ['A M4 Summary Generate ↔ M6.6 Experience Translate', 'm4', 'm66'],
    ['B M5 Summary style ↔ M6.6 Experience Translate', 'm5', 'm66'],
    ['C M6.5 Summary Translate ↔ M2 Generate', 'm65', 'm2'],
    ['D M6.5 Summary Translate ↔ M3 Enhance', 'm65', 'm3'],
    ['E M6.5 Summary Translate ↔ M6.6 Experience Translate', 'm65', 'm66'],
  ] as const)('%s preserves both domains when Experience completes first', async (_label, summary, experience) => {
    await runCrossDomainRenderedCase({ summary, experience, summaryFirst: false });
  });

  it('M6.7 failure isolation: a rejected Experience Translate cannot roll back a committed Summary Translate', async () => {
    page.cv = cvForExperience();
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot | ContentLocalizeM6ExperienceSnapshot;
      if (snapshot.kind === 'summary') {
        return { data: summaryCandidateReady(snapshot, 'Summary survives Experience failure.'), response: { status: 200, ok: true, headers: { get: () => null } } };
      }
      return { data: { status: 'handled_failure', reason: 'writer_failed' }, response: { status: 502, ok: false, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    await waitFor(() => expect(page.cv?.summary).toBe('Summary survives Experience failure.'));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.experience }));
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal' }));
    expect(page.cv?.summary).toBe('Summary survives Experience failure.');
    expect(page.cv?.experience[0]?.description).toBe('Deutsche APIs koordinieren und Produktionsänderungen prüfen.');
    expect(page.usage).toBe(1);
  });

  it('M6.7 failure isolation: a rejected Summary Translate cannot roll back a committed Experience Translate', async () => {
    page.cv = cvForExperience();
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot | ContentLocalizeM6ExperienceSnapshot;
      if (snapshot.kind === 'summary') {
        return { data: { status: 'handled_failure', reason: 'provider_failed' }, response: { status: 502, ok: false, headers: { get: () => null } } };
      }
      return { data: candidateReady(snapshot, 'Experience survives Summary failure.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.cv?.experience[0]?.description).toBe('Experience survives Summary failure.'));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' });
    expect(page.cv?.experience[0]?.description).toBe('Experience survives Summary failure.');
    expect(page.cv?.summary).toBe('Stable summary.');
    expect(page.usage).toBe(1);
  });

  it('M6.7 usage and rollback isolation: usage failure restores only the Summary candidate', async () => {
    page.cv = cvForExperience();
    page.apiFetch.mockImplementation(async (_url: string, options: { body: Record<string, unknown> }) => {
      const snapshot = options.body.snapshot as ContentLocalizeM6SummarySnapshot | ContentLocalizeM6ExperienceSnapshot;
      return snapshot.kind === 'summary'
        ? { data: summaryCandidateReady(snapshot, 'Rejected Summary candidate.'), response: { status: 200, ok: true, headers: { get: () => null } } }
        : { data: candidateReady(snapshot, 'Durable Experience candidate.'), response: { status: 200, ok: true, headers: { get: () => null } } };
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.cv?.experience[0]?.description).toBe('Durable Experience candidate.'));
    page.usageMode = 'fail';
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.summary }));
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.translate }));
    fireEvent.change(screen.getByLabelText(translations.sr.common.targetLanguage), { target: { value: 'fr' } });
    fireEvent.click(document.querySelector('[data-content-localize-confirm]')!);
    expect(page.outcomes.at(-1)).toMatchObject({ kind: 'committed' });
    expect(page.cv?.summary).toBe('Stable summary.');
    expect(page.cv?.experience[0]?.description).toBe('Durable Experience candidate.');
    expect(page.usage).toBe(1);
  });

  it('M6.7 privacy and diagnostics: terminal outcomes expose typed reason without source or candidate prose', async () => {
    const privateSummary = 'PRIVATE-SUMMARY-DO-NOT-LOG';
    const privateExperience = 'PRIVATE-EXPERIENCE-DO-NOT-LOG';
    page.cv = cvForExperience();
    page.cv.summary = privateSummary;
    page.cv.experience[0] = {
      ...page.cv.experience[0],
      description: privateExperience,
      originalUserDescription: privateExperience,
      canonicalDescription: privateExperience,
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(privateExperience),
    };
    page.apiFetch.mockResolvedValue({
      data: { status: 'handled_failure', reason: 'provider_failed' },
      response: { status: 502, ok: false, headers: { get: () => null } },
    });
    await renderExperiencePage();
    await startExperienceTranslate('experience-one', 'fr');
    await waitFor(() => expect(page.outcomes.at(-1)).toMatchObject({ kind: 'terminal', reason: 'provider_failed' }));
    const serialized = JSON.stringify(page.outcomes.at(-1));
    expect(serialized).not.toContain(privateSummary);
    expect(serialized).not.toContain(privateExperience);
    expect(serialized).toContain('provider_failed');
  });
});
