/** AAB459: exact Italian provider/recovery failure -> deterministic fallback. */
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
const EXPECTED_ITALIAN = formatExperienceBullets([
  'Ha creato materiali grafici per supporti stampati e digitali.',
  'Ha sviluppato concetti di design visivo in base alle esigenze dei clienti.',
  'Ha revisionato progetti di design e verificato la qualità dei risultati finali.',
]);

function exactSource(): string {
  const fixture = fs.readFileSync(
    path.resolve(__dirname, 'aab432-hindi-experience-noop-fallback-grounding.test.ts'),
    'utf8',
  );
  const body = fixture.match(/const EXACT_BE5C_SOURCE = formatExperienceBullets\(\[([\s\S]*?)\]\);/)?.[1];
  if (!body) throw new Error('AAB432 exact source fixture not found');
  return Function('formatExperienceBullets', `return formatExperienceBullets([${body}]);`)(formatExperienceBullets) as string;
}

const SOURCE = exactSource();

type AppState = { currentCv: CVData; usage: number; writes: CVData[] };
const state: AppState = { currentCv: undefined as unknown as CVData, usage: 10, writes: [] };

function makeCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: ENTRY_ID,
    appliedOutput: VISIBLE_PRIOR_AI,
    preAiFactText: SOURCE,
    sourceLocale: 'hi',
    targetLocale: 'it',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'original_user',
  });
  return {
    id: 'aab459-italian-route',
    personal: { fullName: 'AAB459', email: 'aab459@example.com', phone: '', address: '', jobTitle: 'Graphic Designer', gender: 'female' },
    summary: '',
    experience: [{
      id: ENTRY_ID, position: 'Graphic Designer', company: 'TestWerk GmbH', startDate: '2024-01', endDate: '2026-02', isPresent: false,
      description: VISIBLE_PRIOR_AI, originalUserDescription: SOURCE, canonicalDescription: SOURCE,
      descriptionOrigin: 'ai_generated', generatedDescription: VISIBLE_PRIOR_AI, generatedLocale: 'pt-BR', aiOutputProvenance: provenance,
    }],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern-minimal', region: 'EU', contentLocale: 'it', runtimeMigrationVersion: 3,
  } as unknown as CVData;
}

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'it', t: translations.it }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: state.currentCv,
    setCurrentCv: (next: CVData) => { state.currentCv = next; state.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => { state.currentCv = next; state.writes.push(next); return true; },
    isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: () => { state.usage += 1; }, getProAiUsageCount: () => state.usage, lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab459-token' }),
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

describe('AAB459 Italian real UI/route fallback', () => {
  beforeEach(async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    const { POST } = await import('@/app/api/generate/route');
    routePost.mockImplementation((body: unknown) => {
      const baseBody = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      return POST(new Request('https://cvproai.test/api/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...baseBody, noopRepair: true }),
      }) as never);
    });
    anthropicCreateMock.mockReset();
    anthropicCreateMock.mockResolvedValue({ content: [{ type: 'text', text: 'invalid provider output' }] });
    state.currentCv = makeCv();
    state.usage = 10;
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

  it('routes provider 422 + recovery 422 through deterministic Italian fallback and applies once', async () => {
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    const sourceHash = fingerprintText(normalizeExperienceAiSourceText(SOURCE));
    expect(sourceHash).toBe(SOURCE_HASH);
    expect(ENTRY_HASH).toBe('fnv1a_be5c794b_l36_b100_e52');
    fireEvent.click(screen.getByRole('button', { name: translations.it.cv.experience }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.it.cv.aiBullets, 'i') }));
    await waitFor(() => expect(routePost).toHaveBeenCalledTimes(2), { timeout: 20000 });
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 20000 });
    const diag = getLatestExperienceAiDiagnostic();
    expect(state.currentCv.experience[0]?.description).toBe(EXPECTED_ITALIAN);
    expect(state.usage).toBe(11);
    expect(diag?.providerHttpStatus).toBe(422);
    expect(diag?.recoveryAttempted).toBe(true);
    expect(diag?.recoveryHttpStatus).toBe(422);
    expect(diag?.clientDeterministicFallbackApplied).toBe(true);
    expect(diag?.finalCandidateSource).toBe('deterministic_fallback');
    expect(diag?.finalRequiredFactCount).toBe(3);
    expect(diag?.finalCoveredFactCount).toBe(3);
    expect(diag?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(diag?.finalAddedPredicateCount).toBe(0);
    expect(diag?.finalUnsupportedClaimCount).toBe(0);
    expect(diag?.targetLocalePurityPassed).toBe(true);
    expect(diag?.expectedEmploymentTense).toBe('past');
    expect(diag?.tenseValidationPassed).toBe(true);
    expect(diag?.visibleApplySucceeded).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsApply).toBe(true);
    expect(diag?.canonicalExperienceDecisionAllowsUsage).toBe(true);
    expect(diag?.diagnosticInvariantCheckPassed).toBe(true);
    expect(diag?.diagnosticCompletenessPassed).toBe(true);
    expect(diag?.privacyCheckPassed).toBe(true);
  }, 30000);
});
