/** AAB465 — Serbian completed cross-locale predicate recovery. */
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
  buildCrossLocaleExperienceFallback,
  validateCrossLocaleSemanticCoverage,
} from '@/lib/cv-cross-locale-experience';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import { hashExperienceEntryId } from '@/lib/cv-experience-entry-isolation';
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
vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'sr', t: translations.sr }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: state.currentCv,
    setCurrentCv: (next: CVData) => { state.currentCv = next; state.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => {
      state.currentCv = next;
      state.writes.push(next);
      return true;
    },
    isPro: true,
    canDownload: () => true,
    incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: () => { state.usage += 1; },
    getProAiUsageCount: () => state.usage,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab465-token' }),
  }),
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(async (_path: string, options: { body?: unknown }) => {
      const response = await routePost(options.body);
      return {
        data: await response.json(),
        response: { ok: response.ok, status: response.status, headers: { get: () => null } },
      };
    }),
  };
});

const ENTRY_ID = 'be5c794b';
const ENTRY_HASH = hashExperienceEntryId(ENTRY_ID);
const SOURCE_HASH = 'fnv1a_431c4554_l204_b2346_e2404';

function exactHindiSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(([\s\S]*?)\);/)?.[1];
  if (!body) throw new Error('AAB465 exact Hindi source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets(${body});`)(formatExperienceBullets) as string;
}

const EXPECTED_SERBIAN = formatExperienceBullets([
  'Kreirala je grafičke materijale za štampane i digitalne medije.',
  'Razvijala je koncepte vizuelnog dizajna prema potrebama klijenata.',
  'Pregledala je projekte dizajna i proveravala kvalitet finalnih rezultata.',
]);

const state: { currentCv: CVData; usage: number; writes: CVData[] } = {
  currentCv: undefined as unknown as CVData,
  usage: 20,
  writes: [],
};

function fixtureCv(): CVData {
  const source = exactHindiSource();
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: ENTRY_ID,
    appliedOutput: '• Provider output was rejected.',
    preAiFactText: source,
    sourceLocale: 'hi',
    targetLocale: 'sr',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'original_user',
  });
  return {
    id: 'aab465-serbian-device-path',
    personal: {
      fullName: 'AAB465', email: '', phone: '', address: '',
      jobTitle: 'Free-text creative role', gender: 'female',
    },
    summary: '',
    experience: [{
      id: ENTRY_ID,
      position: 'Free-text creative role',
      company: 'TestWerk',
      startDate: '2024-01',
      endDate: '2026-02',
      isPresent: false,
      description: '• Provider output was rejected.',
      originalUserDescription: source,
      canonicalDescription: source,
      generatedDescription: '• Provider output was rejected.',
      generatedLocale: 'fr',
      descriptionOrigin: 'ai_generated',
      aiOutputProvenance: provenance,
    }, {
      id: 'other-entry-stable',
      position: 'Warehouse clerk', company: 'Other Entry',
      startDate: '2018-01', endDate: '2020-01', isPresent: false,
      description: '• Proveravala sam prijem robe.',
      originalUserDescription: '• Proveravala sam prijem robe.',
      descriptionOrigin: 'user',
    }],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern-minimal', region: 'EU', contentLocale: 'sr',
    runtimeMigrationVersion: 3,
  } as unknown as CVData;
}

describe('AAB465 Serbian completed cross-locale predicate recovery', () => {
  beforeEach(async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    const { POST } = await import('@/app/api/generate/route');
    routePost.mockImplementation((body: unknown) => POST(new Request(
      'https://cvproai.test/api/generate',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    ) as never));
    anthropicCreateMock.mockReset();
    anthropicCreateMock.mockImplementation(async () => ({
      content: [{ type: 'text', text: '• Vodila sam tim i upravljala budžetom.' }],
    }));
    state.currentCv = fixtureCv();
    state.usage = 20;
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

  it('replays the Serbian UI path, accepts 3/3 inflected predicates, and no-ops on rerun', async () => {
    const source = exactHindiSource();
    expect(fingerprintText(normalizeExperienceAiSourceText(source))).toBe(SOURCE_HASH);
    // The device's fnv1a_be5c794b_l36_b100_e52 value is the entry-content
    // fingerprint; runtime diagnostics intentionally expose the stable ID hash.
    expect(ENTRY_HASH).toBe(hashExperienceEntryId(ENTRY_ID));

    const projected = buildCrossLocaleExperienceFallback({
      sourceDescription: source,
      sourceLocale: 'hi',
      targetLocale: 'sr',
      gender: 'female',
      isPresent: false,
      position: 'Free-text creative role',
    });
    expect(projected).toBe(EXPECTED_SERBIAN);
    expect(scanGenericExperiencePredicates(source, projected, {
      allowValidatedCrossScriptBridge: true,
    })).toMatchObject({
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
    });
    expect(validateCrossLocaleSemanticCoverage(source, projected)).toMatchObject({
      requiredCount: 3,
      coveredCount: 3,
      addedSemanticArgumentCount: 0,
      ok: true,
    });

    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.sr.cv.experience }));
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(translations.sr.cv.aiBullets, 'i') })[0]!);
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 30000 });

    const selected = state.currentCv.experience[0]?.description || '';
    const diag = getLatestExperienceAiDiagnostic();
    expect(selected).toBe(EXPECTED_SERBIAN);
    expect(selected).toMatch(/Kreirala je|Razvijala je|Pregledala je|proveravala/iu);
    expect(selected).not.toMatch(/\p{Script=Devanagari}/u);
    expect(diag?.selectedExperienceEntryIdHash).toBe(ENTRY_HASH);
    expect(diag?.sourceFactsEntryIdHash).toBe(ENTRY_HASH);
    expect(diag?.finalRequiredFactCount).toBe(3);
    expect(diag?.finalCoveredFactCount).toBe(3);
    expect(diag?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(diag?.finalAddedPredicateCount).toBe(0);
    expect(diag?.targetLocalePurityPassed).toBe(true);
    expect(diag?.expectedEmploymentTense).toBe('past');
    expect(diag?.tenseValidationPassed).toBe(true);
    expect(diag?.visibleApplySucceeded).toBe(true);
    expect(diag?.countedAsSuccess).toBe(true);
    expect(state.usage).toBe(21);
    expect(state.writes).toHaveLength(1);

    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(translations.sr.cv.aiBullets, 'i') })[0]!);
    await waitFor(() => expect(getLatestExperienceAiDiagnostic()?.semanticNoOpDetected).toBe(true));
    expect(routePost).toHaveBeenCalledTimes(1);
    expect(state.writes).toHaveLength(1);
    expect(state.usage).toBe(21);
  }, 40000);

  it('rejects a genuinely unrelated Serbian action', () => {
    const source = exactHindiSource();
    const candidate = `${EXPECTED_SERBIAN}\n• Vodila sam tim i upravljala budžetom.`;
    const scan = scanGenericExperiencePredicates(source, candidate, {
      allowValidatedCrossScriptBridge: true,
    });
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(scan.reason).toBe('generic_experience_predicate_added_action');
    expect(scan.candidateAddedPredicateCount).toBeGreaterThan(0);
  });
});
