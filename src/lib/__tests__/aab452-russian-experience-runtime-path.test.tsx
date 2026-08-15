/** AAB452: real route -> selected Russian fallback -> preapply -> visible commit. */
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
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { normalizeExperienceAiSourceText } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildRussianDesignSemanticFallback,
  validateRussianDesignSemanticProjection,
} from '@/lib/cv-russian-experience-semantic-grounding';
import { validateRussianExperienceEmploymentTense } from '@/lib/cv-russian-experience-tense';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { textMatchesRequestedFieldLocale } from '@/lib/cv-field-locale-integrity';
import { validateExperienceCvPerspective } from '@/lib/cv-experience-perspective';
import {
  clearExperienceAiDiagnosticsForTests,
  getLatestExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';

const anthropicCreateMock = vi.hoisted(() => vi.fn());
const routePost = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic { messages = { create: anthropicCreateMock }; },
}));

vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));

const ENTRY_ID = 'be5c794b';
const ENTRY_HASH = 'fnv1a_be5c794b_l36_b100_e52';
const SOURCE_HASH = 'fnv1a_431c4554_l204_b2346_e2404';
const KNOWN_BAD_DETERMINISTIC_HASH = 'fnv1a_3446e785_l255_b8226_e46';
const KNOWN_BAD_FINAL_HASH = 'fnv1a_39013811_l255_b8226_e46';

function exactHindiSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(([\s\S]*?)\);/)?.[1];
  if (!body) throw new Error('AAB452 exact Hindi source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets(${body});`)(formatExperienceBullets) as string;
}

const JAPANESE_UNEDITED_AI = formatExperienceBullets([
  '\u30c7\u30b8\u30bf\u30eb\u88fd\u54c1\u3068\u30d7\u30e9\u30c3\u30c8\u30d5\u30a9\u30fc\u30e0\u5411\u3051\u306e\u7d20\u6750\u3092\u4f5c\u6210\u3057\u305f\u3002',
  '\u30c7\u30b6\u30a4\u30f3\u30de\u30c6\u30ea\u30a2\u30eb\u3092\u78ba\u8a8d\u3057\u3066\u8abf\u6574\u3057\u305f\u3002',
  '\u7570\u306a\u308b\u753b\u9762\u5411\u3051\u306b\u6700\u7d42\u30d5\u30a1\u30a4\u30eb\u3092\u6e96\u5099\u3057\u305f\u3002',
]);

const BAD_RUSSIAN_PROVIDER = formatExperienceBullets([
  '\u0421\u043e\u0437\u0434\u0430\u0432\u0430\u043b\u0430 \u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b \u0434\u043b\u044f \u043f\u0435\u0447\u0430\u0442\u043d\u044b\u0445 \u0438 \u0446\u0438\u0444\u0440\u043e\u0432\u044b\u0445 \u043c\u0435\u0434\u0438\u0430.',
  '\u0420\u0430\u0437\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u043b\u0430 \u043a\u043e\u043d\u0446\u0435\u043f\u0446\u0438\u0438 \u0432\u0438\u0437\u0443\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u0434\u0438\u0437\u0430\u0439\u043d\u0430 \u0432 \u0441\u043e\u043e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u043f\u043e\u0442\u0440\u0435\u0431\u043d\u043e\u0441\u0442\u044f\u043c\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432.',
  '\u041f\u043e\u0434\u0433\u043e\u0442\u0430\u0432\u043b\u0438\u0432\u0430\u043b\u0430 \u0444\u0438\u043d\u0430\u043b\u044c\u043d\u044b\u0435 \u0434\u0438\u0437\u0430\u0439\u043d-\u0444\u0430\u0439\u043b\u044b.',
]);

const state: { currentCv: CVData; usage: number; writes: CVData[] } = {
  currentCv: undefined as unknown as CVData,
  usage: 34,
  writes: [],
};

function fixtureCv(): CVData {
  const source = exactHindiSource();
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: ENTRY_ID,
    appliedOutput: JAPANESE_UNEDITED_AI,
    preAiFactText: source,
    sourceLocale: 'hi',
    targetLocale: 'ru',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'original_user',
  });
  return {
    id: 'aab452-russian-device-path',
    personal: { fullName: 'AAB452', email: '', phone: '', address: '', jobTitle: 'Free-text creative role', gender: 'female' },
    summary: '',
    experience: [{
      id: ENTRY_ID, position: 'Free-text creative role', company: 'TestWerk',
      startDate: '2024-01', endDate: '2026-02', isPresent: false,
      description: JAPANESE_UNEDITED_AI,
      originalUserDescription: source,
      canonicalDescription: source,
      generatedDescription: JAPANESE_UNEDITED_AI,
      generatedLocale: 'ja',
      descriptionOrigin: 'ai_generated',
      aiOutputProvenance: provenance,
    }],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern-minimal', region: 'EU', contentLocale: 'ru', runtimeMigrationVersion: 3,
  } as unknown as CVData;
}

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'ru', t: translations.ru }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: state.currentCv,
    setCurrentCv: (next: CVData) => { state.currentCv = next; state.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => { state.currentCv = next; state.writes.push(next); return true; },
    isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: () => { state.usage += 1; }, getProAiUsageCount: () => state.usage, lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab452-token' }),
  }),
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(async (_path: string, options: { body?: unknown }) => {
      const response = await routePost(options.body);
      return { data: await response.json(), response: { ok: response.ok, status: response.status, headers: { get: () => null } } };
    }),
  };
});

describe('AAB452 Russian actual fallback selection', () => {
  beforeEach(async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    const { POST } = await import('@/app/api/generate/route');
    routePost.mockImplementation((body: unknown) => POST(new Request('https://cvproai.test/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never));
    anthropicCreateMock.mockReset();
    state.currentCv = fixtureCv();
    state.usage = 34;
    state.writes = [];
    clearExperienceAiDiagnosticsForTests();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup(); routePost.mockReset(); vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks();
  });

  it('proves the source-owned Russian projector satisfies the route-level non-legacy gates', () => {
    const projection = buildRussianDesignSemanticFallback({
      sourceDescription: exactHindiSource(), gender: 'female', isPresent: false,
    });
    expect(validateRussianDesignSemanticProjection(exactHindiSource(), projection).ok).toBe(true);
    expect(validateRussianExperienceEmploymentTense(projection, {
      gender: 'female', isPresent: false,
    })).toMatchObject({ finalTensePassed: true, finalGenderAgreementPassed: true });
    expect(validateAiUnitLocalePurity(projection, 'ru', {
      kind: 'experience_bullet', requireUnits: true,
    }).ok).toBe(true);
    expect(textMatchesRequestedFieldLocale(projection, 'ru', 'experience_bullet')).toBe(true);
    expect(validateExperienceCvPerspective(projection, 'ru', { isPresent: false }).ok).toBe(true);
  });

  it('selects the source-owned Russian projection after the real route rejects the provider and repair', async () => {
    expect(fingerprintText(normalizeExperienceAiSourceText(exactHindiSource()))).toBe(SOURCE_HASH);
    expect(ENTRY_HASH).toBe('fnv1a_be5c794b_l36_b100_e52');
    anthropicCreateMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: BAD_RUSSIAN_PROVIDER }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: BAD_RUSSIAN_PROVIDER }] });
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.ru.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.ru.cv.aiBullets, 'i') }));
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 30000 });
    const diag = getLatestExperienceAiDiagnostic();
    const selected = state.currentCv.experience[0]?.description || '';
    expect(routePost).toHaveBeenCalledTimes(1);
    expect(state.usage).toBe(35);
    expect(selected).toContain('\u043f\u0435\u0447\u0430\u0442\u043d\u044b\u0445 \u0438 \u0446\u0438\u0444\u0440\u043e\u0432\u044b\u0445 \u043c\u0435\u0434\u0438\u0430');
    expect(selected).toContain('\u043f\u043e\u0442\u0440\u0435\u0431\u043d\u043e\u0441\u0442\u044f\u043c\u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432');
    expect(selected).toContain('\u043a\u0430\u0447\u0435\u0441\u0442\u0432\u043e \u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0445 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u043e\u0432');
    expect(selected).not.toMatch(/\u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c|\u044d\u043a\u0440\u0430\u043d|\u0444\u043e\u0440\u043c\u0430\u0442|\u0444\u0430\u0439\u043b|\u0442\u0440\u0435\u0431\u043e\u0432\u0430\u043d\u0438\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u0430/u);
    expect(diag?.finalNormalizedHash).not.toBe(KNOWN_BAD_FINAL_HASH);
    expect((diag as unknown as { deterministicCandidateHash?: string })?.deterministicCandidateHash)
      .not.toBe(KNOWN_BAD_DETERMINISTIC_HASH);
    expect(diag?.providerAccepted).toBe(false);
    expect(diag?.providerCandidateValidationAccepted).toBe(false);
    expect(diag?.providerRequiredFactCount).toBe(3);
    expect(diag?.providerCoveredFactCount).toBe(2);
    expect(diag?.providerUncoveredFactCount).toBe(1);
    expect(diag?.providerCandidateAddedPredicateCount).toBeGreaterThan(0);
    expect(diag?.finalCandidateValidationAccepted).toBe(true);
    expect(diag?.russianSourceOwnedProjectionAttempted).toBe(true);
    expect(diag?.russianSourceOwnedSemanticFactCount).toBe(3);
    expect(diag?.russianSourceOwnedProjectionValidationPassed).toBe(true);
    expect(diag?.russianSourceOwnedProjectionSelected).toBe(true);
    expect(diag?.russianSourceOwnedProjectionHash).toBe(diag?.russianFallbackHashEnteringFinalizer);
    expect(diag?.russianPostNormalizationHash).toBe(diag?.russianFinalSelectedHash);
    expect(diag?.russianFinalSelectedHash).toBe(diag?.finalNormalizedHash);
    expect(diag?.finalCandidateSource).toMatch(/deterministic_fallback|server_fallback/);
    expect(diag?.finalRequiredFactCount).toBe(3);
    expect(diag?.finalCoveredFactCount).toBe(3);
    expect(diag?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(diag?.finalAddedPredicateCount).toBe(0);
    expect(diag?.targetLocalePurityPassed).toBe(true);
    expect(diag?.expectedEmploymentTense).toBe('past');
    expect(diag?.tenseValidationPassed).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(true);
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
    expect(diag?.visibleTextareaMatchesFinalNormalizedHash).toBe(true);

    // The committed output is an unedited AI result in the requested locale;
    // the second click must terminate before any provider or fallback work.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.ru.cv.aiBullets, 'i') }));
    await waitFor(() => {
      const rerun = getLatestExperienceAiDiagnostic();
      expect(rerun?.semanticNoOpDetected).toBe(true);
      expect(rerun?.earlyNoOpPreflightPassed).toBe(true);
    });
    expect(routePost).toHaveBeenCalledTimes(1);
    expect(state.writes).toHaveLength(1);
    expect(state.usage).toBe(35);
  }, 40000);
});
