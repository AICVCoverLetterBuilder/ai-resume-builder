/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { translations } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { getLatestSummaryAiDiagnostic } from '@/lib/cv-summary-ai-diagnostics';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

const cv: CVData = {
  id: 'ui', personal: { fullName: 'UI', email: 'ui@example.com', phone: '', address: '', jobTitle: 'Graphiste', gender: 'female' },
  summary: "Je dispose d'environ sept ans d'expérience. Je travaille actuellement comme Graphiste chez Rewitu Current Test, où je prépare les concepts visuels etles maquettes pour les supports numériques, retouche les graphiques etles images pour différents projets et coordonne les ébauches etles modifications avec les membres de l'équipe de projet. Auparavant, j'ai travaillé comme Graphiste chez TestWerk GmbH, où je Créais des contenus graphiques pour les supports imprimés et numériques, Développais des concepts de design visuel en fonction des besoins des clients et Examinais les projets de design et vérifiais la qualité des rendus finaux. Auparavant, j'ai travaillé comme Graphiste chez Rewitu, où j'ai préparé les concepts visuels et les maquettes pour les supports numériques, retouché les illustrations et les images pour différents projets et coordonné les ébauches et les modifications avec les membres de l'équipe de projet.",
  experience: [
    { id: '90ceb215', position: 'Graphiste', company: 'Rewitu Current Test', startDate: '2024-01', endDate: '', isPresent: true, description: 'prépare les concepts visuels et les maquettes pour les supports numériques\nretouche les graphiques et les images pour différents projets\ncoordonne les ébauches et les modifications avec les membres de l\'équipe de projet', canonicalDescription: 'prépare les concepts visuels et les maquettes pour les supports numériques\nretouche les graphiques et les images pour différents projets\ncoordonne les ébauches et les modifications avec les membres de l\'équipe de projet', generatedLocale: 'fr' },
    { id: 'be5c794b', position: 'Graphiste', company: 'TestWerk GmbH', startDate: '2021-01', endDate: '2024-01', isPresent: false, description: 'créais des contenus graphiques pour les supports imprimés et numériques\ndéveloppais des concepts de design visuel en fonction des besoins des clients\nexaminais les projets de design et vérifiais la qualité des livrables finaux', canonicalDescription: 'créais des contenus graphiques pour les supports imprimés et numériques\ndéveloppais des concepts de design visuel en fonction des besoins des clients\nexaminais les projets de design et vérifiais la qualité des livrables finaux', generatedLocale: 'fr' },
    { id: 'a221433', position: 'Graphiste', company: 'Rewitu', startDate: '2019-01', endDate: '2020-09', isPresent: false, description: 'préparais les concepts visuels et les maquettes pour les supports numériques\nretouchais les illustrations et les images pour différents projets\ncoordonnais les ébauches et les modifications avec les membres de l\'équipe de projet', canonicalDescription: 'préparais les concepts visuels et les maquettes pour les supports numériques\nretouchais les illustrations et les images pour différents projets\ncoordonnais les ébauches et les modifications avec les membres de l\'équipe de projet', generatedLocale: 'fr' },
  ], education: [], skills: [], languages: [], certifications: [], projects: [], templateId: 'modern', contentLocale: 'fr', summaryOrigin: 'ai_generated',
} as unknown as CVData;

const appState = { currentCv: cv, usage: 29, writes: [] as CVData[] };

vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale: 'fr', t: translations.fr }) }));
vi.mock('@/lib/store', () => ({ checkProAccess: () => 'allowed', useApp: () => ({ currentCv: appState.currentCv, setCurrentCv: (next: CVData) => { appState.writes.push(next); appState.currentCv = next; }, persistCurrentCvTransactionally: (next: CVData) => { appState.writes.push(next); appState.currentCv = next; return true; }, isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(), recordProAiSuccess: () => { appState.usage += 1; }, getProAiUsageCount: () => appState.usage, lastCvSavedAt: 0, getAiGate: () => ({ status: 'ready', token: 'test-token' }) }) }));
vi.mock('@/lib/api', async () => { const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api'); return { ...actual, apiFetch: vi.fn(async () => ({ data: { result: 'BAD_PROVIDER_CANDIDATE' }, response: { ok: true, status: 200 } })) }; });
vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));

describe('AAB438 real UI probe', () => {
  it('renders the actual page', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-20T00:00:00.000Z'));
    setSummaryV2EnabledForTests(true);
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.summary }));
    const textarea = screen.getAllByRole('textbox').find((node) => (node as HTMLTextAreaElement).value.length === 929) as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    expect(textarea.value.length).toBe(929);
    appState.writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.strong, 'i') }));
    await waitFor(() => expect(appState.writes).toHaveLength(1), { timeout: 15000 });
    expect(textarea.value).not.toContain('etles');
    expect(appState.usage).toBe(30);
    const applied = getLatestSummaryAiDiagnostic();
    expect(applied?.rewriteStyle).toBe('stronger');
    expect(applied?.summarySourceHash).toBe('fnv1a_bf524458_l929_b74_e46');
    expect(applied?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fingerprintText(textarea.value)).toBe(applied?.finalNormalizedHash);
    expect(applied?.evaluatedUnitRoleSlots).toEqual(['duration', 'current_role', 'prior_role', 'prior_role']);
    expect(applied?.finalUnitSemanticRolesByUnit).toEqual([
      ['total_duration'],
      ['current_role_intro', 'current_role_duties'],
      ['prior_role_intro', 'prior_role_duties'],
      ['prior_role_intro', 'prior_role_duties'],
    ]);
    expect(applied?.finalSentenceSemanticRolesBySentence).toEqual([
      ['total_duration'],
      ['current_role_intro', 'current_role_duties'],
      ['prior_role_intro', 'prior_role_duties'],
      ['prior_role_intro', 'prior_role_duties'],
    ]);
    const predicateRecords = applied?.frenchPredicateEvidence ?? [];
    expect(predicateRecords).toHaveLength(9);
    expect(predicateRecords.every((record) => (
      typeof record.owningEntryHash === 'string'
      && typeof record.sourceFactHash === 'string'
      && typeof record.employmentState === 'string'
      && typeof record.expectedTense === 'string'
      && typeof record.realizedTense === 'string'
      && typeof record.sourceActionCategory === 'string'
      && typeof record.transformedActionCategory === 'string'
      && record.actionIdentityPreserved === true
      && record.responsibilityTierPreserved === true
      && record.objectScopePreserved === true
      && record.accepted === true
      && record.rejectionReason === null
    ))).toBe(true);
    expect(applied?.tenseValidationPassed).toBe(true);
    expect(applied?.groundingValidationPassed).toBe(true);
    expect(applied?.frenchPredicateEvidence).toHaveLength(9);
    expect(applied?.grammarValidationPassed).toBe(true);
    expect(applied?.visibleGrammarValidationPassed).toBe(true);
    expect(applied?.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(applied?.visibleFinalPostconditionsPassed).toBe(true);
    expect(applied?.visibleSummaryMatchesFinalHash).toBe(true);
    expect(applied?.diagnosticInvariantCheckPassed).toBe(true);
    expect(applied?.diagnosticCompletenessPassed).toBe(true);
    expect(applied?.privacyCheckPassed).toBe(true);
    expect(applied?.visibleApplySucceeded).toBe(true);
    expect(applied?.countedAsSuccess).toBe(true);
    expect(applied?.usageCountBefore).toBe(29);
    expect(applied?.usageCountAfter).toBe(30);
    expect(applied?.structuredDurationMonths).toBe(86);
    expect(applied?.finalRenderedDurationSemanticMonths).toBe(84);
    expect(applied?.visibleRenderedDurationSemanticMonths).toBe(84);
    expect(applied?.finalDurationSemanticAgreementPassed).toBe(true);
    expect(applied?.visibleDurationSemanticAgreementPassed).toBe(true);
    expect(applied?.durationRepresentationAgreement).toBe(true);
    expect(applied?.durationClaimCountAfterFinalize).toBe(1);
    expect(applied?.independentFinalDurationClaimCount).toBe(1);
    expect(applied?.visibleDurationClaimCountAfterApply).toBe(1);
    expect(applied?.durationInsertedExactlyOnce).toBe(true);
    expect(applied?.durationFinalizerIdempotent).toBe(true);
    expect(textarea.value).toContain("environ sept ans d'expérience");
    expect(textarea.value).toContain('supports imprimés et numériques');
    expect(textarea.value).toContain('besoins des clients');
    expect(textarea.value).toMatch(/(?:rendus|livrables) finaux/iu);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.strong, 'i') }));
    await waitFor(() => expect(appState.usage).toBe(30), { timeout: 15000 });
    expect(appState.writes).toHaveLength(1);
    await waitFor(() => expect(getLatestSummaryAiDiagnostic()?.countedAsSuccess).toBe(false), { timeout: 15000 });
    const noop = getLatestSummaryAiDiagnostic();
    expect(noop?.finalCandidateSource).toBe('none');
    expect(noop?.visibleApplySucceeded).toBe(false);
    expect(noop?.diagnosticInvariantCheckPassed).toBe(true);
    expect(noop?.diagnosticCompletenessPassed).toBe(true);
    expect(noop?.privacyCheckPassed).toBe(true);
    expect(noop?.usageCountBefore).toBe(30);
    expect(noop?.usageCountAfter).toBe(30);
    cleanup();
    vi.useRealTimers();
  });
});
