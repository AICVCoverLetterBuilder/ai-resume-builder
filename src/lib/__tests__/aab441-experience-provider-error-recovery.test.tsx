/** @vitest-environment jsdom */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { translations } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { normalizeExperienceAiSourceText } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  clearExperienceAiDiagnosticsForTests,
  getLatestExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';

const ENTRY_ID = 'be5c794b';
const ENTRY_HASH = 'fnv1a_be5c794b_l36_b100_e52';
const SOURCE_HASH = 'fnv1a_431c4554_l204_b2346_e2404';
const VISIBLE_PRIOR_AI = formatExperienceBullets(['Provider output not validated']);

type MockApiResponse = {
  data: { result?: string; error?: string; code?: string };
  response: { ok: boolean; status: number; headers: { get: () => null } };
};

const apiResponseQueue = vi.hoisted(() => [] as MockApiResponse[]);

function provider422(): MockApiResponse {
  return {
    data: { error: 'generation_validation_failed', code: 'generation_validation_failed' },
    response: { ok: false, status: 422, headers: { get: () => null } },
  };
}

function recoveryResponse(result: string): MockApiResponse {
  return {
    data: { result },
    response: { ok: true, status: 200, headers: { get: () => null } },
  };
}

function recoveryError(status = 422): MockApiResponse {
  return {
    data: { error: 'generation_validation_failed', code: 'generation_validation_failed' },
    response: { ok: false, status, headers: { get: () => null } },
  };
}

const SAFE_FRENCH_RECOVERY = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques.',
  'Développait des concepts de design visuel selon les besoins des clients.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);

const UNSAFE_FRENCH_RECOVERY = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques et utilisait Salesforce pour suivre les KPI et augmenter les ventes de 40%.',
  'Développait des concepts de design visuel selon les besoins des clients et les exigences du projet.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);

function exactBe5cSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(\[([\s\S]*?)\]\);/)?.[1];
  if (!body) throw new Error('AAB432 exact source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets([${body}]);`)(formatExperienceBullets) as string;
}

const state: { currentCv: CVData; usage: number; writes: CVData[] } = {
  currentCv: undefined as unknown as CVData,
  usage: 34,
  writes: [],
};

function makeCv(): CVData {
  const source = exactBe5cSource();
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: ENTRY_ID,
    appliedOutput: VISIBLE_PRIOR_AI,
    preAiFactText: source,
    sourceLocale: 'hi',
    targetLocale: 'fr',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'original_user',
  });
  return {
    id: 'aab441-device',
    personal: {
      fullName: 'AAB441', email: 'aab441@example.com', phone: '', address: '',
      jobTitle: 'Graphic Designer', gender: 'female',
    },
    summary: '',
    experience: [{
      id: ENTRY_ID, position: 'Graphic Designer', company: 'TestWerk GmbH',
      startDate: '2024-01', endDate: '2026-02', isPresent: false,
      description: VISIBLE_PRIOR_AI,
      originalUserDescription: source,
      canonicalDescription: source,
      descriptionOrigin: 'ai_generated',
      generatedDescription: VISIBLE_PRIOR_AI,
      generatedLocale: 'fr',
      aiOutputProvenance: provenance,
    }],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern-minimal', region: 'EU', contentLocale: 'fr', runtimeMigrationVersion: 3,
  } as unknown as CVData;
}

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'fr', t: translations.fr }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: state.currentCv,
    setCurrentCv: (next: CVData) => { state.currentCv = next; state.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => { state.currentCv = next; state.writes.push(next); return true; },
    isPro: true, canDownload: () => true, incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(), recordProAiSuccess: () => { state.usage += 1; },
    getProAiUsageCount: () => state.usage, lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab441-token' }),
  }),
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(async () => apiResponseQueue.shift() || provider422()),
  };
});
vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));

describe('AAB441 Experience provider-validation-error recovery', () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    state.currentCv = makeCv();
    state.usage = 34;
    state.writes = [];
    apiResponseQueue.length = 0;
    apiResponseQueue.push(provider422(), recoveryError());
    clearExperienceAiDiagnosticsForTests();
  });
  afterEach(() => cleanup());

  it('routes the real AI Improvements click through safe recovery and fails closed with truthful N/A provider coverage when no French fallback is safe', async () => {
    const source = exactBe5cSource();
    expect(fingerprintText(normalizeExperienceAiSourceText(source))).toBe(SOURCE_HASH);
    expect(ENTRY_HASH).toBe('fnv1a_be5c794b_l36_b100_e52');
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    state.writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.providerHttpStatus).toBe(422), { timeout: 15000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.writes).toHaveLength(0);
    expect(state.usage).toBe(34);
    expect(diag?.providerResponseKind).toBe('error');
    expect(diag?.apiResponseKind).toBe('error');
    expect(diag?.providerRejectionStage).toBe('api_response_received');
    expect(diag?.recoveryAttempted).toBe(true);
    expect(diag?.recoveryHttpStatus).toBe(422);
    expect(diag?.recoveryCandidatePresent).toBe(false);
    expect(diag?.recoveryAccepted).toBe(false);
    expect(diag?.recoverySelected).toBe(false);
    expect(diag?.recoveryRejectionReasons).toContain('generation_validation_failed');
    expect(diag?.providerRequiredFactCount).toBeNull();
    expect(diag?.providerCoveredFactCount).toBeNull();
    expect(diag?.providerUncoveredFactIdentityHashes).toEqual([]);
    expect(diag?.factAuthorityKind).toMatch(/original_user|pre_ai_snapshot/);
    expect(diag?.factAuthorityHash).toBe(SOURCE_HASH);
    expect(diag?.factAuthorityUnitCount).toBe(3);
    expect(diag?.visibleComparisonProvenance).toBe('ai_generated_unedited');
    expect(diag?.visibleComparisonCapturedAtRequest).toBe(true);
    expect(diag?.countedAsSuccess).toBe(false);
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(diag?.diagnosticInvariantFailures || []).not.toContainEqual(
      expect.objectContaining({ invariantCode: 'incomplete_coverage_with_empty_uncovered_hashes' }),
    );
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
  });

  it('routes a recoverable 422 through the real handler fallback and applies one safe French candidate', async () => {
    state.currentCv = makeCv();
    state.usage = 34;
    state.writes = [];
    apiResponseQueue.length = 0;
    apiResponseQueue.push(provider422(), recoveryResponse(SAFE_FRENCH_RECOVERY));
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    state.writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    const textarea = document.querySelector(`[data-experience-description-id="${ENTRY_ID}"]`) as HTMLTextAreaElement;
    expect(textarea.value).toContain('Provider output');
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.countedAsSuccess).toBe(true), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(diag?.applyWriteSucceeded).toBe(true);
    expect(diag?.applyAttempted).toBe(true);
    expect(textarea.value).not.toContain('Provider output');
    expect(state.usage).toBe(35);
    expect(textarea.value).toBe(SAFE_FRENCH_RECOVERY);
    expect(diag?.providerResponseKind).toBe('error');
    expect(diag?.providerPredicateValidationApplicable).toBeNull();
    expect(diag?.providerCoverageCount).toBeNull();
    expect(diag?.providerRequiredFactCount).toBeNull();
    expect(diag?.providerCoveredFactCount).toBeNull();
    expect(diag?.factAuthorityKind).toMatch(/original_user|pre_ai_snapshot/);
    expect(diag?.factAuthorityHash).toBe(SOURCE_HASH);
    expect(diag?.factAuthorityUnitCount).toBe(3);
    expect(diag?.visibleComparisonProvenance).toBe('ai_generated_unedited');
    expect(diag?.finalCandidateSource).toBe('server_repair');
    expect(diag?.finalDecisionKind).toBe('material_improvement');
    expect(diag?.finalRequiredFactCount).toBe(3);
    expect(diag?.finalCoveredFactCount).toBe(3);
    expect(diag?.finalUncoveredFactIdentityHashes).toEqual([]);
    expect(diag?.selectedExperienceEntryIdHash).toBeTruthy();
    expect(diag?.sourceFactsEntryIdHash).toBe(diag?.selectedExperienceEntryIdHash);
    expect(diag?.expectedEmploymentTense).toBe('past');
    expect(diag?.tenseValidationPassed).toBe(true);
    expect(diag?.finalFactCoveragePassed).toBe(true);
    expect(diag?.finalUnsupportedClaimCount).toBe(0);
    expect(diag?.unsupportedClaimCount).toBe(0);
    expect(diag?.finalAddedPredicateCount).toBe(0);
    expect(diag?.targetLocalePurityPassed).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(true);
    expect(diag?.visibleApplySucceeded).toBe(true);
    expect(diag?.stableEntryIdentityMatched).toBe(true);
    expect(diag?.targetEntryStillExists).toBe(true);
    expect(diag?.entryContextMatchedAtApply).toBe(true);
    expect(diag?.responseRejectedForEntryMismatch).toBe(false);
    expect(diag?.crossEntryLeakageDetected).toBe(false);
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
    expect(diag?.recoveryAttempted).toBe(true);
    expect(diag?.recoveryHttpStatus).toBe(200);
    expect(diag?.recoveryCandidatePresent).toBe(true);
    expect(diag?.recoveryAccepted).toBe(true);
    expect(diag?.recoverySelected).toBe(true);
    expect(diag?.recoveryRejectionReasons).toEqual([]);
    expect(diag?.providerRejectionStage).toBe('api_response_received');
    expect(diag?.providerAccepted).toBe(false);
    expect(diag?.expectedEmploymentTense).toBe('past');
    expect(diag?.finalMatchesVisibleComparisonAfterNormalization).toBe(false);
    expect(diag?.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    expect(diag?.visibleDescriptionMatchesFinalHash).toBe(true);
    expect(textarea.value).toMatch(/médias imprimés et numériques/);
    expect(textarea.value).toMatch(/besoins des clients/);
    expect(textarea.value).toMatch(/qualité des rendus finaux/);
    expect(textarea.value).not.toMatch(/Salesforce|KPI|40%|dirige|universel/i);
  });

  it('rejects an unsafe recovered candidate without a write or usage increment', async () => {
    state.currentCv = makeCv();
    apiResponseQueue.length = 0;
    apiResponseQueue.push(provider422(), recoveryResponse(UNSAFE_FRENCH_RECOVERY));
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    state.writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.countedAsSuccess).toBe(false), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.writes).toHaveLength(0);
    expect(state.usage).toBe(34);
    expect(diag?.recoveryAttempted).toBe(true);
    expect(diag?.recoveryCandidatePresent).toBe(true);
    expect(diag?.recoveryAccepted).toBe(false);
    expect(diag?.recoverySelected).toBe(false);
    expect(diag?.recoveryRejectionReasons?.length).toBeGreaterThan(0);
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
  }, 20000);

  it('fails closed when recovery returns an error or empty result', async () => {
    state.currentCv = makeCv();
    apiResponseQueue.length = 0;
    apiResponseQueue.push(provider422(), recoveryError(500));
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    state.writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.recoveryAttempted).toBe(true), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.writes).toHaveLength(0);
    expect(state.usage).toBe(34);
    expect(diag?.recoveryHttpStatus).toBe(500);
    expect(diag?.recoveryCandidatePresent).toBe(false);
    expect(diag?.recoveryAccepted).toBe(false);
    expect(diag?.recoverySelected).toBe(false);
    expect(diag?.finalCandidateSource).toBe('none');
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
  });

  it('treats an immediate unedited rerun of recovered output as an early semantic no-op', async () => {
    state.currentCv = makeCv();
    apiResponseQueue.length = 0;
    apiResponseQueue.push(provider422(), recoveryResponse(SAFE_FRENCH_RECOVERY));
    const Page = (await import('@/app/cv-builder/page')).default;
    const { rerender } = render(<Page />);
    state.writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.countedAsSuccess).toBe(true), { timeout: 20000 });
    const writesAfterRecovery = state.writes.length;
    const usageAfterRecovery = state.usage;
    const { apiFetch } = await import('@/lib/api');
    const fetchMock = apiFetch as unknown as { mock: { calls: unknown[][] } };
    const callsAfterRecovery = fetchMock.mock.calls.length;
    // The real store update re-renders the page with the committed generated
    // provenance before the second user click. The test double exposes that
    // same transaction boundary explicitly.
    rerender(<Page />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.finalDecisionKind).toBe('semantic_noop'), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(fetchMock.mock.calls.length).toBe(callsAfterRecovery);
    expect(state.writes).toHaveLength(writesAfterRecovery);
    expect(state.usage).toBe(usageAfterRecovery);
    expect(diag?.providerAttempted).toBe(false);
    expect(diag?.semanticNoOpDetected).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(false);
  }, 20000);
});
