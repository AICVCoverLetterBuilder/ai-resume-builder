import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2StyledDeterministicText } from '@/lib/cv-summary-v2/rewrite-style';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { applyApproximateDurationPolicy } from '@/lib/cv-experience-duration';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  commitSummaryApplyTransactionally,
  createSummaryApplyOwnershipState,
} from '@/lib/cv-summary-transactional-apply';

const REF = '2026-07-20';

function deviceParityCv(): CVData {
  const duty = (lines: string[]) => lines.join('\n');
  return {
    personal: {
      fullName: 'Device Parity', email: 'device@example.com', phone: '', location: '',
      jobTitle: 'Graphiste', gender: 'female',
    },
    summary: '', contentLocale: 'fr', summaryOrigin: 'ai_generated',
    experience: [
      {
        id: '90ceb215', position: 'Graphiste', company: 'Rewitu Current Test',
        startDate: '2024-01', endDate: '', isPresent: true,
        description: duty([
          'pr\u00e9pare les concepts visuels et les maquettes pour les supports num\u00e9riques',
          'retouche les graphiques et les images pour diff\u00e9rents projets',
          "coordonne les \u00e9bauches et les modifications avec les membres de l'\u00e9quipe de projet",
        ]), canonicalDescription: duty([
          'pr\u00e9pare les concepts visuels et les maquettes pour les supports num\u00e9riques',
          'retouche les graphiques et les images pour diff\u00e9rents projets',
          "coordonne les \u00e9bauches et les modifications avec les membres de l'\u00e9quipe de projet",
        ]), descriptionOrigin: 'user', generatedLocale: 'fr',
      },
      {
        id: 'be5c794b', position: 'Graphiste', company: 'TestWerk GmbH',
        startDate: '2021-01', endDate: '2024-01', isPresent: false,
        description: duty([
          'cr\u00e9ais des contenus graphiques pour les supports imprim\u00e9s et num\u00e9riques',
          'd\u00e9veloppais des concepts de design visuel en fonction des besoins des clients',
          'examinais les projets de design et v\u00e9rifiais la qualit\u00e9 des livrables finaux',
        ]), canonicalDescription: duty([
          'cr\u00e9ais des contenus graphiques pour les supports imprim\u00e9s et num\u00e9riques',
          'd\u00e9veloppais des concepts de design visuel en fonction des besoins des clients',
          'examinais les projets de design et v\u00e9rifiais la qualit\u00e9 des livrables finaux',
        ]), descriptionOrigin: 'user', generatedLocale: 'fr',
      },
      {
        id: 'a221433', position: 'Graphiste', company: 'Rewitu',
        startDate: '2019-01', endDate: '2020-09', isPresent: false,
        description: duty([
          'pr\u00e9parais les concepts visuels et les maquettes pour les supports num\u00e9riques',
          'retouchais les illustrations et les images pour diff\u00e9rents projets',
          "coordonnais les \u00e9bauches et les modifications avec les membres de l'\u00e9quipe de projet",
        ]), canonicalDescription: duty([
          'pr\u00e9parais les concepts visuels et les maquettes pour les supports num\u00e9riques',
          'retouchais les illustrations et les images pour diff\u00e9rents projets',
          "coordonnais les \u00e9bauches et les modifications avec les membres de l'\u00e9quipe de projet",
        ]), descriptionOrigin: 'user', generatedLocale: 'fr',
      },
    ],
    education: [], skills: [], languages: [],
  } as unknown as CVData;
}

beforeEach(() => {
  setSummaryV2EnabledForTests(true);
});

describe('AAB-438 French Stronger device-runtime parity', () => {
  it('rebuilds stale AAB436 visible text from manifest authority and preserves lineage', () => {
    const cv = deviceParityCv();
    const snapshot = captureSummaryV2Snapshot({ cv, locale: 'fr', gender: 'female', referenceDateIso: REF });
    const manifest = buildSummaryV2SelectionManifest(snapshot);
    const canonical = buildSummaryV2DeterministicText(manifest);
    expect(canonical).toContain("environ sept ans d'expérience");
    // Exact AAB436 stored device Summary source (929 chars).
    cv.summary = "Je dispose d'environ sept ans d'expérience. Je travaille actuellement comme Graphiste chez Rewitu Current Test, où je prépare les concepts visuels etles maquettes pour les supports numériques, retouche les graphiques etles images pour différents projets et coordonne les ébauches etles modifications avec les membres de l'équipe de projet. Auparavant, j'ai travaillé comme Graphiste chez TestWerk GmbH, où je Créais des contenus graphiques pour les supports imprimés et numériques, Développais des concepts de design visuel en fonction des besoins des clients et Examinais les projets de design et vérifiais la qualité des rendus finaux. Auparavant, j'ai travaillé comme Graphiste chez Rewitu, où j'ai préparé les concepts visuels et les maquettes pour les supports numériques, retouché les illustrations et les images pour différents projets et coordonné les ébauches et les modifications avec les membres de l'équipe de projet.";
    expect(cv.summary.length).toBe(929);
    expect(fingerprintText(cv.summary)).toBe('fnv1a_bf524458_l929_b74_e46');

    const result = finalizeCvAiFieldForApply({
      action: 'summary_stronger', field: 'summary', requestedLocale: 'fr',
      gender: 'female', cv, candidate: 'BAD_PROVIDER_CANDIDATE',
      referenceDateIso: REF, rewriteStyle: 'stronger', originHint: 'ai_repaired',
    });

    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    expect(result.origin).toBe('deterministic_fallback');
    expect(result.text).not.toMatch(/etles/iu);
    expect(result.diagnostics?.grammarValidationPassed).toBe(true);
    expect(result.diagnostics?.groundingValidationPassed).toBe(true);
    expect(result.diagnostics?.evaluatedUnitRoleSlots).toEqual([
      'duration', 'current_role', 'prior_role', 'prior_role',
    ]);
    expect(result.diagnostics?.evaluatedSentenceSemanticRolesBySentence).toEqual([
      ['total_duration'],
      ['current_role_intro', 'current_role_duties'],
      ['prior_role_intro', 'prior_role_duties'],
      ['prior_role_intro', 'prior_role_duties'],
    ]);
    expect(result.diagnostics?.frenchStrongerSemanticValidationPassed).toBe(true);
    expect(result.diagnostics?.frenchStrongerSemanticRejectionReasons).toEqual([]);

    const usageBefore = 29;
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'fr', requestedLocale: 'fr', contentLocale: 'fr',
      templateId: 'modern', gender: 'female', requestId: 'aab438-exact-ui',
      usageCountBefore: usageBefore, operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, cv.summary);
    session.recordFinalizeResult(result);
    const preApply = session.evaluatePreApplyDecisionGates();
    expect(preApply.passed).toBe(true);

    const cvRef = { current: { ...cv } };
    const persisted: CVData[] = [];
    const applyCommit = commitSummaryApplyTransactionally({
      cvRef,
      ownership: createSummaryApplyOwnershipState(),
      locale: 'fr',
      finalized: result,
      operationSourceText: cv.summary,
      operationId: 'aab438-exact-ui',
      scheduleReactCv: (next) => { cvRef.current = next; },
      persistCv: (next) => { persisted.push(next); },
    });
    expect(applyCommit.ok).toBe(true);
    session.patch({ ...applyCommit.lifecycle });
    const visibleText = resolveAuthoritativeVisibleSummaryText({
      operationOwnedSummary: applyCommit.writtenSummary,
      staleReactSummary: '',
    });
    session.recordVisibleApply(true, usageBefore, visibleText);
    session.patch({ usageCountAfter: usageBefore + 1 });
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.visibleGrammarValidationPassed).toBe(true);
    expect(trace.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(trace.visibleFinalPostconditionsPassed).toBe(true);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);
    expect(persisted).toHaveLength(1);

    const rerun = finalizeCvAiFieldForApply({
      action: 'summary_stronger', field: 'summary', requestedLocale: 'fr',
      gender: 'female', cv: cvRef.current, candidate: 'BAD_PROVIDER_CANDIDATE',
      referenceDateIso: REF, rewriteStyle: 'stronger', originHint: 'ai_repaired',
    });
    expect(rerun.blocked).toBe(true);
    expect(rerun.countedAsSuccess).toBe(false);
    expect(rerun.reason).toBe('style_no_safe_material_change');
  });

  it('uses one structured duration policy across Generate and all rewrite styles', () => {
    const cv = deviceParityCv();
    const snapshot = captureSummaryV2Snapshot({ cv, locale: 'fr', gender: 'female', referenceDateIso: REF });
    const manifest = buildSummaryV2SelectionManifest(snapshot);
    expect(snapshot.totalDurationMonths).toBe(86);
    expect(snapshot.durationPhrase).toContain('sept ans');
    expect(snapshot.durationPhrase).not.toContain('et demi');

    const generated = buildSummaryV2DeterministicText(manifest);
    const styled = (['stronger', 'shorter', 'professional'] as const).map((style) => (
      buildSummaryV2StyledDeterministicText(manifest, style)
    ));
    for (const text of [generated, ...styled]) {
      expect(text).toContain("environ sept ans d'expérience");
      expect(text).not.toContain('et demi');
    }

    const expectedBuckets: Array<[number, number, 'years' | 'months']> = [
      [11, 0, 'months'], [12, 1, 'years'], [14, 1, 'years'],
      [15, 1.5, 'years'], [17, 1.5, 'years'], [20, 1.5, 'years'],
      [21, 2, 'years'], [23, 2, 'years'], [24, 2, 'years'],
      [30, 2.5, 'years'],
    ];
    for (const [months, approxYears, unit] of expectedBuckets) {
      const duration = applyApproximateDurationPolicy(months);
      expect(duration.approxYears, `${months} months`).toBe(approxYears);
      expect(duration.unit, `${months} months`).toBe(unit);
    }
  });
});
