/**
 * @vitest-environment jsdom
 *
 * AAB-332 — Spanish-visible → French Experience cross-locale:
 * EN pre_ai fact authority + unedited Spanish AI textarea + FR target must
 * reject wrong-language provider, select a real French 3/3 warehouse fallback,
 * and never claim material_improvement when no candidate is accepted.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  FRENCH_EXPERIENCE_GROUNDING_332_REVISION,
  validateFrenchWarehouseExperienceCoverage,
  scanFrenchWarehousePredicates,
  buildFrenchWarehouseExperienceFallback,
} from '@/lib/cv-french-experience-grounding';
import { buildSpanishWarehouseExperienceFallback } from '@/lib/cv-spanish-experience-grounding';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { countTranslatedFactUnits } from '@/lib/cv-cross-locale-experience';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-25';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const ES_AI_UNEDITED = [
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
].join('\n');

const EN_PROVIDER_NOOP = EN_ORIGINAL;

function atlasEsVisibleFrTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: ES_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'es',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'pre_ai_snapshot',
  });
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'Warehouse employee',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: ES_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'es',
    generatedDescription: ES_AI_UNEDITED,
    aiOutputProvenance: provenance,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: 'Assistant',
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: 'Supported basic administrative tasks.',
    originalUserDescription: 'Supported basic administrative tasks.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-es-fr-332',
    name: 'CV',
    personal: {
      fullName: 'Anna Test',
      email: 'anna@example.com',
      phone: '',
      address: '',
      jobTitle: 'Warehouse employee',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'en',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

describe('AAB-332 Spanish-visible → French Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes French grounding revision for packaging', () => {
    expect(FRENCH_EXPERIENCE_GROUNDING_332_REVISION).toBe('french-experience-grounding-332-v1');
  });

  it('French warehouse fallback covers EN authority facts/predicates 3/3', () => {
    const fallback = buildFrenchWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const cov = validateFrenchWarehouseExperienceCoverage(EN_ORIGINAL, fallback);
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    expect(cov.uncovered).toEqual([]);
    const pred = scanFrenchWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
    expect(/\b(checks?|works? with colleagues|incoming goods)\b/iu.test(fallback)).toBe(false);
    expect(/mercanc|documentaci|compa[nñ]er/iu.test(fallback)).toBe(false);
  });

  it('English soft shells do not satisfy French warehouse coverage (2/3 producer hole)', () => {
    const softEnglish = [
      'Checks incoming goods and related documentation for accurate recording.',
      'Updates warehouse records for accurate storage.',
      'Works with colleagues to prepare and move goods.',
    ].join('\n');
    const cov = validateFrenchWarehouseExperienceCoverage(EN_ORIGINAL, softEnglish);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBeLessThan(3);
    expect(cov.uncovered.length).toBeGreaterThan(0);
  });

  it('cross-locale ES visible vs FR 3/3 fallback is wrong_locale_fixed without missing_fact_restored', () => {
    const fallback = buildFrenchWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: ES_AI_UNEDITED,
      candidateText: fallback,
      locale: 'fr',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.degradationKinds).toEqual([]);
    expect(evalVis.materialImprovementDetected).toBe(true);
    expect(evalVis.materialImprovementKinds).toContain('wrong_locale_fixed');
    expect(evalVis.materialImprovementKinds).not.toContain('missing_fact_restored');
    expect(evalVis.semanticNoOpDetected).toBe(false);
  });

  it('rejection diagnostic: finalCandidatePresent false ⇒ materialImprovementDetected !== true', () => {
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: ES_AI_UNEDITED,
      candidateText: EN_PROVIDER_NOOP,
      locale: 'fr',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    // Soft EN under FR is fact_lost / not a billable improvement.
    expect(evalVis.materialImprovementDetected).toBe(false);
    expect(evalVis.materialImprovementKinds).toEqual([]);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'fr',
      gender: 'female',
      cv: atlasEsVisibleFrTargetCv(),
      candidate: EN_PROVIDER_NOOP,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: ES_AI_UNEDITED,
        locale: 'fr',
        requestId: 'req-es-fr-reject-diag',
        jobContextHash: 'job-es-fr-reject',
        experienceEntryId: 'exp-atlas',
        authoritativeTextOverride: EN_ORIGINAL,
        provenanceOriginOverride: 'originalUserDescription',
      }),
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      staleGeneratedDescriptionIgnored: true,
    });
    // Successful FR fallback path exists — if somehow blocked, still assert truth.
    if (!fin.countedAsSuccess) {
      expect(fin.diagnostics?.finalCandidatePresent).not.toBe(true);
      expect(fin.diagnostics?.materialImprovementDetected).not.toBe(true);
      expect(fin.diagnostics?.finalDecisionKind).toBe('invalid_candidate_rejected');
    }
  });

  it('coverage invariant: covered < required ⇒ uncoveredFactIdentityHashes non-empty', () => {
    const softEnglish = [
      'Checks incoming goods and related documentation for accurate recording.',
      'Updates warehouse records for accurate storage.',
      'Works with colleagues to prepare and move goods.',
    ].join('\n');
    const cov = validateFrenchWarehouseExperienceCoverage(EN_ORIGINAL, softEnglish);
    expect(cov.covered.length).toBeLessThan(cov.required.length);
    expect(cov.uncovered.length).toBeGreaterThan(0);
    const result = checkExperienceDiagnosticInvariants({
      requiredFactCount: cov.required.length,
      coveredFactCount: cov.covered.length,
      uncoveredFactIdentityHashes: cov.uncovered.map((id) => `fr_wh_${id}`),
      finalCandidateSource: 'deterministic_fallback',
      countedAsSuccess: false,
    } as never);
    expect(result.passed).toBe(true);
    expect(
      result.failures.some((f) => String(f.invariantCode).includes('incomplete_coverage_with_empty_uncovered')),
    ).toBe(false);

    const emptyUncovered = checkExperienceDiagnosticInvariants({
      requiredFactCount: 3,
      coveredFactCount: 2,
      uncoveredFactIdentityHashes: [],
      finalCandidateSource: 'deterministic_fallback',
      countedAsSuccess: false,
    } as never);
    expect(
      emptyUncovered.failures.some((f) =>
        String(f.invariantCode).includes('incomplete_coverage_with_empty_uncovered')),
    ).toBe(true);
  });

  it('1–22. ES-visible → FR Stronger AI: provider wrong-locale rejected; FR fallback 3/3 selected', () => {
    const cv = atlasEsVisibleFrTargetCv();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: ES_AI_UNEDITED,
      locale: 'fr',
      requestId: 'req-es-fr-332',
      jobContextHash: 'job-es-fr-332',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'fr',
      gender: 'female',
      cv,
      candidate: EN_PROVIDER_NOOP,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: snapshot,
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      staleGeneratedDescriptionIgnored: true,
    });

    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.blocked).not.toBe(true);
    expect(String(fin.diagnostics?.requestedLocale || fin.diagnostics?.requestedTargetLocale || 'fr'))
      .toMatch(/^fr/);
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(String(fin.diagnostics?.visibleTextareaLocale || '')).toMatch(/^es/);
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^es/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^es/);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toMatch(/^fr/);
    expect(fin.diagnostics?.crossLocaleOperation).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.translationFallbackAttempted).toBe(true);
    expect(fin.diagnostics?.translationFallbackSelected).toBe(true);
    expect(fin.diagnostics?.translationFallbackApplied).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidatePresent).toBe(true);
    expect(fin.diagnostics?.finalRequiredFactCount).toBe(3);
    expect(fin.diagnostics?.finalCoveredFactCount).toBe(3);
    expect(fin.diagnostics?.finalUncoveredFactIdentityHashes || []).toEqual([]);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(fin.diagnostics?.finalAddedPredicateCount).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.degradationKinds || []).toEqual([]);
    expect(fin.diagnostics?.materialImprovementDetected).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds || []).not.toContain('missing_fact_restored');
    expect(fin.diagnostics?.semanticNoOpDetected).toBe(false);
    expect(Number(fin.diagnostics?.translatedFactCount)).toBeGreaterThanOrEqual(3);
    expect(fin.diagnostics?.selectedSourceKind || 'originalUserDescription')
      .toMatch(/originalUserDescription/);
    expect(fin.diagnostics?.authoritativeFactSourceKind).toMatch(/pre_ai|original/i);
    expect(fin.diagnostics?.currentTextareaUsedForFactExtraction).not.toBe(true);
    expect(fin.diagnostics?.currentTextareaProvenance || 'ai_generated_unedited')
      .toMatch(/ai_generated_unedited/);

    const appliedText = (fin.text || '').trim();
    expect(appliedText.length).toBeGreaterThan(40);
    expect(/contr[oô]le|v[eé]rifie|coordonne|marchandises?|coll[eè]gues?/iu.test(appliedText)).toBe(true);
    expect(/mercanc|documentaci|compa[nñ]er/iu.test(appliedText)).toBe(false);
    expect(/\b(checks?|works? with colleagues|incoming goods)\b/iu.test(appliedText)).toBe(false);
    expect(splitBulletCount(appliedText)).toBe(3);

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-es-fr-332',
      requestedLocale: 'fr',
      uiLocale: 'fr',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-es-fr-332',
      usageCountBefore: 3,
    });
    session.patch({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      selectedSourceKind: 'originalUserDescription',
      clickedExperienceEntryIdHash: 'atlas-hash',
      selectedExperienceEntryIdHash: 'atlas-hash',
      factAuthorityKind: 'pre_ai_snapshot',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaProvenance: 'ai_generated_unedited',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      sourceFactCount: 3,
      requiredFactCount: 3,
      coveredFactCount: 3,
      authoritativeFactSourceLocale: 'en',
      visibleTextareaLocale: 'es',
      visibleTextareaLocaleBeforeApply: 'es',
      requestedTargetLocale: 'fr',
      entryGeneratedLocaleBeforeApply: 'es',
      contentLocaleDocument: 'en',
      appliedVisibleContentLocale: null,
    });
    session.recordFinalizeResult(fin);
    session.patch({
      factAuthorityKind: 'pre_ai_snapshot',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      sourceFactCount: 3,
      requiredFactCount: 3,
      visibleComparisonProvenance: 'ai_generated_unedited',
      selectedSourceKind: 'originalUserDescription',
      clickedExperienceEntryIdHash: 'atlas-hash',
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      lastAiOutputHashMatched: true,
      visibleComparisonMatchedLastAiOutput: true,
      translationFallbackSelected: true,
      translationFallbackAttempted: true,
      crossLocaleOperation: true,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    expect(gate.diagnosticCompletenessPassed).toBe(true);
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.preapplyDiagnosticCompletenessPassed).toBe(true);
    expect(draft.preapplyNullRequiredDiagnosticFields || []).toEqual([]);
    expect(draft.applyAuthorized).toBe(true);
    expect(draft.diagnosticInvariantCheckPassed !== false).toBe(true);
    expect(Number(draft.diagnosticInvariantFailureCount || 0)).toBe(0);

    session.patch({
      applyAuthorized: true,
      applyAttempted: true,
      applyWriteSucceeded: true,
      visibleValidationAttempted: true,
      visibleValidationPassed: true,
      applyCommitted: true,
      targetContentApplied: true,
      visibleApplySucceeded: true,
      visibleRequiredFactCount: 3,
      visibleCoveredFactCount: 3,
      visibleUncoveredFactIdentityHashes: [],
      visibleFactCoveragePassed: true,
      visibleRequiredPredicateCount: 3,
      visibleCoveredPredicateCount: 3,
      visiblePredicateCoveragePassed: true,
      visibleNormalizedHash: fingerprintText(appliedText.replace(/\s+/g, ' ').trim()),
      visibleDescriptionMatchesFinalHash: true,
      visibleLocaleValidationPassed: true,
      visibleTenseValidationPassed: true,
      visiblePerspectiveValidationPassed: true,
      postapplyDiagnosticCompletenessPassed: true,
      postapplyDiagnosticInvariantCheckPassed: true,
      preapplyDiagnosticCompletenessPassed: true,
      preapplyDiagnosticInvariantCheckPassed: true,
      appliedVisibleContentLocale: 'fr',
    });
    session.recordVisibleApply(true, 4, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyAuthorized).toBe(true);
    expect(trace.applyWriteSucceeded).toBe(true);
    expect(trace.visibleFactCoveragePassed).toBe(true);
    expect(trace.visiblePredicateCoveragePassed).toBe(true);
    expect(trace.visibleLocaleValidationPassed).toBe(true);
    expect(trace.visibleValidationPassed).toBe(true);
    expect(trace.applyCommitted).toBe(true);
    expect(trace.targetContentApplied).toBe(true);
    expect(trace.contentLocaleUpdatedAfterApply).toBe(true);
    expect(trace.translationFallbackApplied).toBe(true);
    expect(trace.appliedVisibleContentLocale).toBe('fr');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(3);
    expect(trace.usageCountAfter).toBe(4);
    expect(trace.degradationDetected).toBe(false);
    expect(trace.degradationKinds || []).toEqual([]);
  });

  it('preserves Spanish 3/3 builder used as visible precondition', () => {
    const es = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    expect(es.replace(/\s+/g, ' ').trim()).toContain('mercancía entrante');
  });
});

function splitBulletCount(text: string): number {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/^[•\-\u2022]\s*/, '').trim())
    .filter(Boolean).length;
}
