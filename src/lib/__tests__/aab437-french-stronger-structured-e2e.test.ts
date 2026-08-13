import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import { persistProAiRecord, recordProAiUserActionSuccess, getProAiUsageCount, AI_USAGE_SCHEMA_VERSION, PRO_AI_SAFETY_CAP } from '@/lib/ai-usage-policy';
import { evaluateSummaryV2StyleFulfillment } from '@/lib/cv-summary-v2/rewrite-style';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { validateSummaryV2AgainstManifest } from '@/lib/cv-summary-v2/validator';
import { auditSummaryV2MaterialClaims } from '@/lib/cv-summary-v2/material-claims';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';

const REF = '2026-07-20';

beforeEach(() => {
  setSummaryV2EnabledForTests(true);
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count: 0,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
});

afterEach(() => {
  setSummaryV2EnabledForTests(null);
});

function deviceEquivalentFrenchCv(summary = ''): CVData {
  const duty = (lines: string[]) => lines.join('\n');
  return {
    personal: {
      fullName: 'Device Equivalent', email: 'device@example.com', phone: '', location: '',
      jobTitle: 'Graphiste', gender: 'female',
    },
    summary,
    contentLocale: 'fr', summaryOrigin: 'ai_generated',
    experience: [
      {
        id: '90ceb215', position: 'Graphiste', company: 'Rewitu Current Test',
        startDate: '2024-01', endDate: '', isPresent: true,
        description: duty([
          'prépare les concepts visuels et les maquettes pour les supports numériques',
          'retouche les graphiques et les images pour différents projets',
          "coordonne les ébauches et les modifications avec les membres de l'équipe de projet",
        ]), canonicalDescription: duty([
          'prépare les concepts visuels et les maquettes pour les supports numériques',
          'retouche les graphiques et les images pour différents projets',
          "coordonne les ébauches et les modifications avec les membres de l'équipe de projet",
        ]), descriptionOrigin: 'user', generatedLocale: 'fr',
      },
      {
        id: 'be5c794b', position: 'Graphiste', company: 'TestWerk GmbH',
        startDate: '2021-01', endDate: '2024-01', isPresent: false,
        description: duty([
          'créais des contenus graphiques pour les supports imprimés et numériques',
          'développais des concepts de design visuel en fonction des besoins des clients',
          'examinais les projets de design et vérifiais la qualité des livrables finaux',
        ]), canonicalDescription: duty([
          'créais des contenus graphiques pour les supports imprimés et numériques',
          'développais des concepts de design visuel en fonction des besoins des clients',
          'examinais les projets de design et vérifiais la qualité des livrables finaux',
        ]), descriptionOrigin: 'user', generatedLocale: 'fr',
      },
      {
        id: 'a221433', position: 'Graphiste', company: 'Rewitu',
        startDate: '2019-01', endDate: '2020-09', isPresent: false,
        description: duty([
          'préparais les concepts visuels et les maquettes pour les supports numériques',
          'retouchais les illustrations et les images pour différents projets',
          "coordonnais les ébauches et les modifications avec les membres de l'équipe de projet",
        ]), canonicalDescription: duty([
          'préparais les concepts visuels et les maquettes pour les supports numériques',
          'retouchais les illustrations et les images pour différents projets',
          "coordonnais les ébauches et les modifications avec les membres de l'équipe de projet",
        ]), descriptionOrigin: 'user', generatedLocale: 'fr',
      },
    ],
    education: [], skills: [], languages: [],
  } as unknown as CVData;
}

describe('AAB-437 exact French Stronger structured device-equivalent path', () => {
  it('builds Stronger from owned facts and preserves all nine fact relations', () => {
    const cv = deviceEquivalentFrenchCv();
    const sourceSnapshot = captureSummaryV2Snapshot({ cv, locale: 'fr', gender: 'female', referenceDateIso: REF });
    const sourceManifest = buildSummaryV2SelectionManifest(sourceSnapshot);
    cv.summary = buildSummaryV2DeterministicText(sourceManifest);
    const result = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'fr',
      gender: 'female',
      cv,
      candidate: 'BAD_PROVIDER_CANDIDATE',
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });
    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    expect(result.origin).toBe('deterministic_fallback');
    expect(result.diagnostics?.rewriteStylePropagatedToDeterministic).toBe(true);
    expect(result.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(result.diagnostics?.strongerStyleFulfilled).toBe(true);
    expect(result.diagnostics?.styleMaterialityPassed).toBe(true);
    expect(result.diagnostics?.semanticStyleOperationsApplied).toContain('duty_predicate_strengthen');
    expect(result.diagnostics?.strongerVerbTransformationCount).toBeGreaterThan(0);
    expect(result.diagnostics?.grammarValidationPassed).toBe(true);
    expect(result.diagnostics?.finalPostconditionsPassed).toBe(true);
    expect(result.text).not.toMatch(/etles|j'a\b|ainsi que je les modifications/iu);
    expect(result.text).toMatch(/supports imprimés et numériques/iu);
    expect(result.text).toMatch(/en fonction des besoins des clients/iu);
    expect(result.text).toMatch(/qualité des livrables finaux/iu);
    expect(result.text).toMatch(/supports numériques/iu);
    expect(result.text).toMatch(/différents projets/iu);
    expect(result.text).toMatch(/membres de l'équipe de projet/iu);

    const snapshot = captureSummaryV2Snapshot({ cv, locale: 'fr', gender: 'female', referenceDateIso: REF });
    const manifest = buildSummaryV2SelectionManifest(snapshot);
    expect(manifest.totalDurationMonths).toBe(86);
    const validation = validateSummaryV2AgainstManifest(result.text, manifest, {
      trustedConstructionAuthority: true,
      preserveConstructionOrder: true,
    });
    expect(validation.ok).toBe(true);
    expect(validation.coveredCurrentFactCount).toBe(3);
    expect(validation.coveredPriorFactCount).toBe(6);
    expect(validation.requiredCurrentFactCount).toBe(3);
    expect(validation.requiredPriorFactCount).toBe(6);

    const source = buildSummaryV2DeterministicText(manifest);
    const style = evaluateSummaryV2StyleFulfillment({
      style: 'stronger', sourceText: source, candidateText: result.text, locale: 'fr',
    });
    expect(style.strongerStyleFulfilled).toBe(true);
    expect(style.semanticStyleOperationsApplied).toContain('duty_predicate_strengthen');
    expect(style.nativeSurfaceValidationPassed).toBe(true);

    const material = auditSummaryV2MaterialClaims(result.text, manifest);
    expect(material.invariantPassed).toBe(true);
    expect(material.printClaimDetected).toBe(true);
    expect(material.unsupportedPrintClaimCount).toBe(0);
    expect(material.unsupportedMaterialClaimCount).toBe(0);
    expect(result.diagnostics?.nativeSurfaceValidationPassed).toBe(true);

    const stateCv = applyFinalizedSummaryToCv(cv, 'fr', result);
    expect(stateCv.summary).toBe(result.text);
    const usageBefore = getProAiUsageCount();
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'fr', requestedLocale: 'fr', contentLocale: 'fr', templateId: 'modern-minimal',
      gender: 'female', requestId: 'aab437-french-stronger-e2e', usageCountBefore: usageBefore,
      operationMode: 'enhance_existing_content',
    });
    session.recordCvSnapshot(cv, cv.summary || '');
    session.recordFinalizeResult(result);
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    session.recordVisibleApply(true, usageBefore, result.text);
    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: usageBefore + 1 });
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.visibleGrammarValidationPassed).toBe(true);
    expect(trace.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(trace.visibleFinalPostconditionsPassed).toBe(true);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(trace.visibleCandidateHashAfterApply).toBeTruthy();
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(0);
    expect(trace.usageCountAfter).toBe(1);

    const rerun = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'fr',
      gender: 'female',
      cv: stateCv,
      candidate: stateCv.summary || '',
      referenceDateIso: REF,
      rewriteStyle: 'stronger',
    });
    expect(rerun.blocked).toBe(true);
    expect(rerun.countedAsSuccess).toBe(false);
    expect(['style_no_safe_material_change', 'summary_noop_after_normalization'])
      .toContain(rerun.reason);
    expect(rerun.diagnostics?.noOpDetected).toBe(true);
  });

  it('rejects false-green French tense/action provider candidates before fallback selection', () => {
    const cv = deviceEquivalentFrenchCv();
    const sourceSnapshot = captureSummaryV2Snapshot({ cv, locale: 'fr', gender: 'female', referenceDateIso: REF });
    const sourceManifest = buildSummaryV2SelectionManifest(sourceSnapshot);
    cv.summary = buildSummaryV2DeterministicText(sourceManifest);
    const safe = finalizeCvAiFieldForApply({
      action: 'summary_stronger', field: 'summary', requestedLocale: 'fr', gender: 'female', cv,
      candidate: 'BAD_PROVIDER_CANDIDATE', referenceDateIso: REF, rewriteStyle: 'stronger',
    });
    expect(safe.blocked).toBe(false);
    const cases = [
      {
        name: 'completed present tense',
        candidate: safe.text.replace("où j'élaborais les concepts visuels", "où j'élabore les concepts visuels"),
      },
      {
        name: 'edit-to-improve and coordinate-to-orchestrate escalation',
        candidate: safe.text
          .replace('retouchais les illustrations', 'améliorais les illustrations')
          .replace('coordonnais les ébauches', 'orchestrais les ébauches'),
      },
      { name: 'safe equivalent', candidate: safe.text },
    ];
    for (const entry of cases) {
      const result = finalizeCvAiFieldForApply({
        action: 'summary_stronger', field: 'summary', requestedLocale: 'fr', gender: 'female', cv,
        candidate: entry.candidate, referenceDateIso: REF, rewriteStyle: 'stronger',
      });
      expect(result.blocked, entry.name).toBe(false);
      expect(result.countedAsSuccess, entry.name).toBe(true);
      expect(result.diagnostics?.providerAccepted, entry.name).toBe(false);
      expect(result.diagnostics?.finalCandidateSource, entry.name).toBe('deterministic_fallback');
      expect(result.text, entry.name).toBe(safe.text);
      expect(result.text, entry.name).not.toMatch(/j'élabore les concepts visuels[^.]*Auparavant/iu);
      expect(result.text, entry.name).not.toMatch(/améliorais|orchestrais/iu);
    }
  });
});
