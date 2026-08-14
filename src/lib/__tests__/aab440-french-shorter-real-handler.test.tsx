/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { translations } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { getLatestSummaryAiDiagnostic } from '@/lib/cv-summary-ai-diagnostics';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

const source = "Je dispose d'environ sept ans d'expérience. Je travaille actuellement comme Graphiste chez Rewitu Current Test, où j'élabore avec rigueur les concepts visuels et les maquettes pour les supports numériques, retouche les graphiques et les images pour différents projets et coordonne les ébauches et les modifications avec les membres de l'équipe de projet. Auparavant, j'ai travaillé comme Graphiste chez TestWerk GmbH, où je créais des contenus graphiques pour les supports imprimés et numériques, ainsi que je développais des concepts de design visuel en fonction des besoins des clients, ainsi que j'examinais les projets de design et vérifiais la qualité des livrables finaux. Auparavant, j'ai travaillé comme Graphiste chez Rewitu, où j'ai préparé les concepts visuels et les maquettes pour les supports numériques, retouché les illustrations et les images pour différents projets et coordonné les ébauches et les modifications avec les membres de l'équipe de projet.";
const cv: CVData = {
  id: 'aab440', personal: { fullName: 'UI', email: 'ui@example.com', phone: '', address: '', jobTitle: 'Graphiste', gender: 'female' }, summary: source,
  experience: [
    { id: '90ceb215', position: 'Graphiste', company: 'Rewitu Current Test', startDate: '2024-01', endDate: '', isPresent: true, description: 'prépare les concepts visuels et les maquettes pour les supports numériques\nretouche les graphiques et les images pour différents projets\ncoordonne les ébauches et les modifications avec les membres de l\'équipe de projet', canonicalDescription: '', generatedLocale: 'fr' },
    { id: 'be5c794b', position: 'Graphiste', company: 'TestWerk GmbH', startDate: '2021-01', endDate: '2024-01', isPresent: false, description: 'créais des contenus graphiques pour les supports imprimés et numériques\ndéveloppais des concepts de design visuel en fonction des besoins des clients\nexaminais les projets de design et vérifiais la qualité des livrables finaux', canonicalDescription: '', generatedLocale: 'fr' },
    { id: 'a221433', position: 'Graphiste', company: 'Rewitu', startDate: '2019-01', endDate: '2020-09', isPresent: false, description: 'préparais les concepts visuels et les maquettes pour les supports numériques\nretouchais les illustrations et les images pour différents projets\ncoordonnais les ébauches et les modifications avec les membres de l\'équipe de projet', canonicalDescription: '', generatedLocale: 'fr' },
  ], education: [], skills: [], languages: [], certifications: [], projects: [], templateId: 'modern', contentLocale: 'fr', summaryOrigin: 'ai_generated',
} as unknown as CVData;
const state = { currentCv: cv, usage: 30, writes: [] as CVData[] };

vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale: 'fr', t: translations.fr }) }));
vi.mock('@/lib/store', () => ({ checkProAccess: () => 'allowed', useApp: () => ({ currentCv: state.currentCv, setCurrentCv: (next: CVData) => { state.writes.push(next); state.currentCv = next; }, persistCurrentCvTransactionally: (next: CVData) => { state.writes.push(next); state.currentCv = next; return true; }, isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(), recordProAiSuccess: () => { state.usage += 1; }, getProAiUsageCount: () => state.usage, lastCvSavedAt: 0, getAiGate: () => ({ status: 'ready', token: 'test-token' }) }) }));
vi.mock('@/lib/api', async () => { const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api'); return { ...actual, apiFetch: vi.fn(async () => ({ data: { result: 'BAD_PROVIDER_CANDIDATE' }, response: { ok: true, status: 200 } })) }; });
vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));

describe('AAB440 French Shorter real handler', () => {
  it('uses the actual Summary Plus court action and fails closed on invalid tense', async () => {
    expect(source.length).toBe(970); expect(fingerprintText(source)).toBe('fnv1a_7fc5ab73_l970_b74_e46');
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-07-20T00:00:00.000Z')); setSummaryV2EnabledForTests(true); HTMLElement.prototype.scrollIntoView = vi.fn();
    const Page = (await import('@/app/cv-builder/page')).default; render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: translations.fr.cv.summary }));
    const textarea = screen.getAllByRole('textbox').find((node) => (node as HTMLTextAreaElement).value.includes('TestWerk')) as HTMLTextAreaElement;
    expect(textarea).toBeDefined(); state.writes.length = 0;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.short, 'i') }));
    await waitFor(() => expect(state.writes).toHaveLength(1), { timeout: 15000 });
    const diag = getLatestSummaryAiDiagnostic();
    expect(textarea.value.length).toBeLessThan(970); expect(textarea.value).toContain('où je'); expect(textarea.value).toContain('supports imprimés et numériques'); expect(textarea.value).toContain('besoins des clients'); expect(textarea.value).toMatch(/(?:rendus|livrables) finaux/iu); expect(fingerprintText(textarea.value)).toBe(diag?.finalNormalizedHash);
    expect(diag?.tenseValidationPassed).toBe(true); expect(diag?.grammarValidationPassed).toBe(true); expect(diag?.groundingValidationPassed).toBe(true); expect(diag?.visibleGrammarValidationPassed).toBe(true); expect(diag?.visibleNativeSurfaceValidationPassed).toBe(true); expect(diag?.visibleFinalPostconditionsPassed).toBe(true); expect(diag?.visibleApplySucceeded).toBe(true); expect(diag?.countedAsSuccess).toBe(true); expect(diag?.usageCountBefore).toBe(30); expect(diag?.usageCountAfter).toBe(31); expect(state.writes).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(translations.fr.cv.short, 'i') })); await waitFor(() => expect(getLatestSummaryAiDiagnostic()?.countedAsSuccess).toBe(false), { timeout: 15000 }); expect(state.usage).toBe(31); expect(state.writes).toHaveLength(1); cleanup(); vi.useRealTimers();
  });
});
