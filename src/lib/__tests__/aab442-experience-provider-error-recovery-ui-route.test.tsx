/** AAB442: real UI handler -> real /api/generate route recovery sequence. */
/** @vitest-environment jsdom */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { translations } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { normalizeExperienceAiSourceText } from '@/lib/cv-experience-ai-operation-snapshot';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import {
  clearExperienceAiDiagnosticsForTests,
  getLatestExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';

const anthropicCreateMock = vi.hoisted(() => vi.fn());
const routePost = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const ENTRY_ID = 'be5c794b';
const ENTRY_HASH = 'fnv1a_be5c794b_l36_b100_e52';
const SOURCE_HASH = 'fnv1a_431c4554_l204_b2346_e2404';
const VISIBLE_PRIOR_AI = formatExperienceBullets(['Provider output not validated']);

function exactSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(([\s\S]*?)\);/)?.[1];
  if (!body) throw new Error('AAB432 exact source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets(${body});`)(formatExperienceBullets) as string;
}

const SAFE_FRENCH = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques.',
  'Développait des concepts de design visuel selon les besoins des clients.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);
const UNSAFE_FRENCH = formatExperienceBullets([
  'Créait des supports graphiques pour les médias imprimés et numériques et utilisait Salesforce pour suivre les KPI et augmenter les ventes de 40%.',
  'Développait des concepts de design visuel selon les besoins des clients et les exigences du projet.',
  'Examinait les matériaux de design et les projets de design, puis vérifiait la qualité des rendus finaux.',
]);
const INVALID_LOCALE = formatExperienceBullets([
  'Created visual materials for print and digital media.',
  'Developed visual design concepts according to client needs.',
  'Reviewed design projects and checked final-output quality.',
]);
const EXTRA_PROJECT_REQUIREMENTS = SAFE_FRENCH.replace(
  'selon les besoins des clients.',
  'selon les besoins des clients et les exigences du projet.',
);
const EXTRA_STANDARDS_CRITERION = SAFE_FRENCH.replace(
  'qualité des rendus finaux.',
  'qualité des rendus finaux selon des normes établies.',
);
const EXTRA_UNIVERSAL_SCOPE = SAFE_FRENCH.replace(
  'Créait des supports graphiques pour les médias imprimés et numériques.',
  'Créait des supports graphiques pour les médias imprimés et numériques pour tous les projets.',
);
const EXTRA_FOREIGN_TEAM_ARGUMENT = SAFE_FRENCH.replace(
  'selon les besoins des clients.',
  'selon les besoins des clients avec les membres de l’équipe de projet.',
);

const state: { currentCv: CVData; usage: number; writes: CVData[] } = {
  currentCv: undefined as unknown as CVData,
  usage: 34,
  writes: [],
};

function makeCv(): CVData {
  const source = exactSource();
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
    id: 'aab442-route-ui',
    personal: { fullName: 'AAB442', email: 'aab442@example.com', phone: '', address: '', jobTitle: 'Graphic Designer', gender: 'female' },
    summary: '',
    experience: [{
      id: ENTRY_ID, position: 'Graphic Designer', company: 'TestWerk GmbH', startDate: '2024-01', endDate: '2026-02', isPresent: false,
      description: VISIBLE_PRIOR_AI, originalUserDescription: source, canonicalDescription: source,
      descriptionOrigin: 'ai_generated', generatedDescription: VISIBLE_PRIOR_AI, generatedLocale: 'fr', aiOutputProvenance: provenance,
    }],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern-minimal', region: 'EU', contentLocale: 'fr', runtimeMigrationVersion: 3,
  } as unknown as CVData;
}

vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale: 'fr', t: translations.fr }) }));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: state.currentCv,
    setCurrentCv: (next: CVData) => { state.currentCv = next; state.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => { state.currentCv = next; state.writes.push(next); return true; },
    isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: () => { state.usage += 1; }, getProAiUsageCount: () => state.usage, lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab442-token' }),
  }),
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(async (_path: string, options: { body?: unknown }) => {
      const response = await routePost(options.body);
      const data = await response.json();
      return { data, response: { ok: response.ok, status: response.status, headers: { get: () => null } } };
    }),
  };
});
vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));

describe('AAB442 real UI route recovery', () => {
  beforeEach(async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    const { POST } = await import('@/app/api/generate/route');
    routePost.mockImplementation((body: unknown) => POST(new Request('https://cvproai.test/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never));
    anthropicCreateMock.mockReset();
    state.currentCv = makeCv();
    state.usage = 34;
    state.writes = [];
    clearExperienceAiDiagnosticsForTests();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    routePost.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('uses the typed cross-locale bridge for canonical preapply rather than foreign surface predicates', () => {
    const comparison = evaluateExperienceVisibleComparison({
      factAuthorityText: exactSource(),
      // The request-time visible textarea is deliberately a foreign-language
      // prior AI snapshot. It remains a no-op comparison baseline only.
      visibleComparisonText: exactSource(),
      candidateText: SAFE_FRENCH,
      locale: 'fr',
      isPresent: false,
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
    });

    expect(comparison.degradationDetected).toBe(false);
    expect(comparison.degradationKinds).not.toContain('unsupported_predicate_added');
    expect(comparison.materialImprovementDetected).toBe(true);
    expect(comparison.materialImprovementKinds).toContain('wrong_locale_fixed');
  });

  it('routes initial 422 and recovery through the real route and applies once', async () => {
    const source = exactSource();
    expect(fingerprintText(normalizeExperienceAiSourceText(source))).toBe(SOURCE_HASH);
    expect(ENTRY_HASH).toBe('fnv1a_be5c794b_l36_b100_e52');
    // The initial unsafe response is rejected by the real route (and its
    // bounded repair is also unsafe); only the recovery request receives the
    // safe candidate.
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: SAFE_FRENCH }] });
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(routePost).toHaveBeenCalledTimes(2), { timeout: 20000 });
    expect(routePost).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.usage).toBe(35);
    expect(state.writes[0]?.experience[0]?.description).toBe(SAFE_FRENCH);
    expect(diag?.providerHttpStatus).toBe(422);
    expect(diag?.providerRejectionStage).toBe('api_response_received');
    expect(diag?.providerRequiredFactCount).toBeNull();
    expect(diag?.providerCoveredFactCount).toBeNull();
    expect(diag?.providerUncoveredFactIdentityHashes).toEqual([]);
    const primaryRejected = diag?.candidateLineage?.find((item) => (
      item.candidateKind === 'server_provider_raw'
    ));
    expect(primaryRejected).toMatchObject({
      present: true,
      accepted: false,
      rejectionStage: 'server_validation_repair',
    });
    const selectedRecovery = diag?.candidateLineage?.find((item) => (
      item.candidateKind === 'server_repair'
    ));
    expect(selectedRecovery?.present).toBe(true);
    expect(selectedRecovery?.accepted).toBe(true);
    expect(selectedRecovery?.unitCount).toBe(3);
    expect(selectedRecovery?.normalizedHash).toBe(diag?.finalNormalizedHash);
    expect(selectedRecovery?.rejectionReasons).toEqual([]);
    expect(diag?.recoveryAttempted).toBe(true);
    expect(diag?.recoveryHttpStatus).toBe(200);
    expect(diag?.recoveryCandidatePresent).toBe(true);
    expect(diag?.recoveryCandidateHash).toBe(diag?.finalNormalizedHash);
    expect(diag?.recoveryCandidateUnitCount).toBe(3);
    expect(diag?.recoveryCandidateUnitHashes).toHaveLength(3);
    expect(diag?.recoveryAccepted).toBe(true);
    expect(diag?.recoverySelected).toBe(true);
    expect(diag?.finalCandidateSource).toBe('server_repair');
    expect(diag?.finalRequiredFactCount).toBe(3);
    expect(diag?.finalCoveredFactCount).toBe(3);
    expect(diag?.finalBulletCount).toBe(3);
    expect(diag?.finalUncoveredFactIdentityHashes).toEqual([]);
    expect(diag?.finalAddedPredicateCount).toBe(0);
    expect(diag?.finalUnsupportedClaimCount).toBe(0);
    expect(diag?.crossEntryLeakageDetected).toBe(false);
    expect(diag?.sourceLanguageLeakageDetected).toBe(false);
    expect(diag?.detectedLocaleByBullet).toEqual(['fr', 'fr', 'fr']);
    expect(diag?.finalBulletScripts).toEqual(['latin', 'latin', 'latin']);
    expect(diag?.targetLocalePurityPassed).toBe(true);
    expect(diag?.expectedEmploymentTense).toBe('past');
    expect(diag?.tenseValidationPassed).toBe(true);
    expect(diag?.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    expect(diag?.providerTargetEntryIdHash).toBe('fnv1a_d20146ea_l8_b98_e98');
    expect(diag?.sourceFactsEntryIdHash).toBe('fnv1a_d20146ea_l8_b98_e98');
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(true);
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
    expect(diag?.factAuthorityKind).toMatch(/original_user|pre_ai_snapshot/);
    expect(diag?.factAuthorityHash).toBe(SOURCE_HASH);
    expect(diag?.factAuthorityUnitCount).toBe(3);
    expect(diag?.visibleComparisonProvenance).toBe('ai_generated_unedited');
    expect(diag?.visibleComparisonCapturedAtRequest).toBe(true);
    expect(JSON.stringify(diag?.candidateLineage || [])).not.toMatch(/Salesforce|KPI|40%/i);
  }, 30000);

  it.each([
    ['unsupported-claim', UNSAFE_FRENCH],
    ['extra-project-requirements', EXTRA_PROJECT_REQUIREMENTS],
    ['extra-standards-criterion', EXTRA_STANDARDS_CRITERION],
    ['extra-universal-scope', EXTRA_UNIVERSAL_SCOPE],
    ['foreign-team-argument', EXTRA_FOREIGN_TEAM_ARGUMENT],
    ['wrong-locale', INVALID_LOCALE],
    ['empty', ''],
  ] as const)('real route recovery fails closed for %s', async (_kind, recoveryText) => {
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: recoveryText }] });
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(routePost).toHaveBeenCalledTimes(2), { timeout: 20000 });
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.recoveryAttempted).toBe(true), {
      timeout: 20000,
    });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.writes).toHaveLength(0);
    expect(state.usage).toBe(34);
    expect(diag?.recoveryCandidatePresent).toBe(false);
    expect(diag?.recoveryAccepted).toBe(false);
    expect(diag?.recoverySelected).toBe(false);
    expect(diag?.finalCandidateSource).toBe('none');
    expect(diag?.providerRequiredFactCount).toBeNull();
    expect(diag?.providerCoveredFactCount).toBeNull();
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
    expect(JSON.stringify(diag?.candidateLineage || [])).not.toMatch(/Salesforce|KPI|40%/i);
  }, 30000);

  it('fails closed when the bounded recovery route returns a provider 503', async () => {
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockRejectedValueOnce(new Error('provider unavailable'));
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(routePost).toHaveBeenCalledTimes(2), { timeout: 20000 });
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.recoveryAttempted).toBe(true), {
      timeout: 20000,
    });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.writes).toHaveLength(0);
    expect(state.usage).toBe(34);
    expect(diag?.recoveryHttpStatus).toBe(503);
    expect(diag?.recoveryCandidatePresent).toBe(false);
    expect(diag?.recoveryAccepted).toBe(false);
    expect(diag?.recoverySelected).toBe(false);
    expect(diag?.finalCandidateSource).toBe('none');
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
    expect(JSON.stringify(diag?.candidateLineage || [])).not.toMatch(/provider unavailable/i);
  }, 30000);

  it('does not call provider or recovery on an immediate unedited rerun', async () => {
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: UNSAFE_FRENCH }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: SAFE_FRENCH }] });
    const Page = (await import('@/app/cv-builder/page')).default;
    const { rerender } = render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 20000 });
    const callsAfterRecovery = routePost.mock.calls.length;
    const usageAfterRecovery = state.usage;
    rerender(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.finalDecisionKind).toBe('semantic_noop'), {
      timeout: 20000,
    });
    const diag = getLatestExperienceAiDiagnostic();
    expect(routePost.mock.calls.length).toBe(callsAfterRecovery);
    expect(state.writes).toHaveLength(1);
    expect(state.usage).toBe(usageAfterRecovery);
    expect(diag?.providerAttempted).toBe(false);
    expect(diag?.recoveryAttempted).toBe(false);
    expect(diag?.semanticNoOpDetected).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(false);
  }, 30000);

  it('routes a parsed HTTP-200 provider candidate rejected by strict validation through one recovery', async () => {
    const rejectedProvider = EXTRA_PROJECT_REQUIREMENTS;
    const recovery = SAFE_FRENCH;
    const responses = [
      { data: { result: rejectedProvider }, response: { ok: true, status: 200, headers: { get: () => null } } },
      { data: { result: recovery }, response: { ok: true, status: 200, headers: { get: () => null } } },
    ];
    // The UI handler remains real; this isolates the HTTP-200 provider
    // rejection response at the API boundary while exercising the shared
    // finalizer, recovery, diagnostics and transactional apply path.
    routePost.mockReset();
    routePost.mockImplementation(async () => {
      const next = responses.shift();
      if (!next) throw new Error('unexpected provider/recovery request');
      return new Response(JSON.stringify(next.data), { status: next.response.status });
    });
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(routePost).toHaveBeenCalledTimes(2), { timeout: 20000 });
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.usage).toBe(35);
    expect(diag?.providerHttpStatus).toBe(200);
    expect(diag?.providerAccepted).toBe(false);
    expect(diag?.providerRejectionStage).toMatch(/provider|validation/);
    expect(diag?.recoveryAttempted).toBe(true);
    expect(diag?.recoveryHttpStatus).toBe(200);
    expect(diag?.recoveryAccepted).toBe(true);
    expect(diag?.recoverySelected).toBe(true);
    expect(diag?.finalCandidateSource).toBe('server_repair');
    expect(diag?.finalRequiredFactCount).toBe(3);
    expect(diag?.finalCoveredFactCount).toBe(3);
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
    expect(diag?.providerCoveredFactCount).toBe(3);
    expect(routePost).toHaveBeenCalledTimes(2);
  }, 30000);

  it('keeps a rejected HTTP-200 provider phase internally consistent before selecting recovery', async () => {
    const partialProvider = formatExperienceBullets([
      'CrÃ©ait des supports graphiques pour les mÃ©dias imprimÃ©s et numÃ©riques.',
      'DÃ©veloppait des concepts de design visuel selon les besoins des clients.',
    ]);
    const responses = [
      { data: { result: partialProvider }, response: { status: 200 } },
      { data: { result: SAFE_FRENCH }, response: { status: 200 } },
    ];
    routePost.mockReset();
    routePost.mockImplementation(async () => {
      const next = responses.shift();
      if (!next) throw new Error('unexpected provider/recovery request');
      return new Response(JSON.stringify(next.data), { status: next.response.status });
    });
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.aiBullets, 'i') }));
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(diag?.providerAccepted).toBe(false);
    expect(diag?.providerRequiredFactCount).toBe(3);
    expect(diag?.providerCoveredFactCount).toBe(2);
    expect(diag?.providerUncoveredFactCount).toBe(1);
    expect(diag?.providerUncoveredFactIdentityHashes).toHaveLength(1);
    expect(diag?.providerPrimaryCandidateValidationAccepted).toBe(false);
    expect(diag?.recoverySelected).toBe(true);
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
  }, 30000);
});
