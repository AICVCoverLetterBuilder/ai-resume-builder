/**
 * @vitest-environment jsdom
 *
 * AAB-330 — German-visible → Spanish Experience cross-locale:
 * unedited German AI textarea + English pre_ai fact authority must accept a
 * valid Spanish 3/3 deterministic fallback without false degradation / empty
 * degradationKinds / provider no-op contamination.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  SPANISH_CV_AI_305_REVISION,
  validateSpanishWarehouseExperienceCoverage,
  scanSpanishWarehousePredicates,
  buildSpanishWarehouseExperienceFallback,
} from '@/lib/cv-spanish-experience-grounding';
import {
  buildGermanWarehouseExperienceFallback,
  scanGermanWarehousePredicates,
  validateGermanWarehouseExperienceCoverage,
} from '@/lib/cv-german-experience-grounding';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { decideSpanishExperienceFinalCandidate } from '@/lib/cv-experience-canonical-finalization';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { countTranslatedFactUnits } from '@/lib/cv-cross-locale-experience';

const REF = '2026-07-25';

/** Original pre-AI English warehouse duties (fact authority). */
const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

/** Previous unedited German Stronger AI output in the textarea. */
const DE_AI_UNEDITED = [
  'Prüft eingehende Waren.',
  'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
  'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
].join('\n');

/** Provider returns English / no-op equivalent (wrong locale for Spanish). */
const EN_PROVIDER_NOOP = EN_ORIGINAL;

function atlasDeVisibleEsTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: DE_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'de',
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
    description: DE_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'de',
    generatedDescription: DE_AI_UNEDITED,
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
    id: 'cv-de-es-330',
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
    // Document-level locale may remain EN while entry generatedLocale is DE.
    contentLocale: 'en',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

describe('AAB-330 German-visible → Spanish Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Spanish grounding revision for packaging', () => {
    expect(SPANISH_CV_AI_305_REVISION).toBe('spanish-cv-ai-305-v1');
  });

  it('scanSpanishWarehousePredicates covers EN authority + ES fallback 3/3', () => {
    const fallback = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const cov = validateSpanishWarehouseExperienceCoverage(EN_ORIGINAL, fallback);
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    const pred = scanSpanishWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('countTranslatedFactUnits counts ES warehouse 3/3', () => {
    const fallback = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
  });

  it('cross-locale DE visible vs ES 3/3 fallback is not fact_lost / empty degradation', () => {
    const fallback = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: DE_AI_UNEDITED,
      candidateText: fallback,
      locale: 'es',
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

    // Invariant: degradationDetected ⇒ non-empty kinds
    if (evalVis.degradationDetected) {
      expect(evalVis.degradationKinds.length).toBeGreaterThan(0);
    }
  });

  it('decideSpanish accepts cross-locale warehouse fallback', () => {
    const fallback = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const decide = decideSpanishExperienceFinalCandidate({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: DE_AI_UNEDITED,
      candidateText: fallback,
      candidateOrigin: 'deterministic_fallback',
      isPresent: true,
      crossLocaleOperation: true,
    });
    expect(decide.shouldApply).toBe(true);
    expect(decide.degradation).toBe(false);
    expect(decide.degradationKinds).toEqual([]);
    expect(decide.finalDecisionKind).toBe('material_improvement');
  });

  it('invariant: empty degradationKinds cannot authorize experience_ai_degradation', () => {
    const decide = decideSpanishExperienceFinalCandidate({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: DE_AI_UNEDITED,
      candidateText: buildSpanishWarehouseExperienceFallback({
        sourceDescription: EN_ORIGINAL,
        isPresent: true,
      }),
      candidateOrigin: 'deterministic_fallback',
      isPresent: true,
      crossLocaleOperation: true,
    });
    expect(decide.degradation).toBe(false);
    expect(decide.degradationKinds).toEqual([]);
    // If a reject path ever claims degradation, kinds must be concrete.
    if (decide.finalTypedReason === 'experience_ai_degradation') {
      expect(decide.degradationKinds.length).toBeGreaterThan(0);
    }
  });

  it('1–22. DE-visible → ES Stronger AI: provider wrong-locale rejected; ES fallback 3/3 selected + committed', () => {
    const cv = atlasDeVisibleEsTargetCv();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: DE_AI_UNEDITED,
      locale: 'es',
      requestId: 'req-de-es-330',
      jobContextHash: 'job-de-es-330',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
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
    expect(fin.diagnostics?.requestedTargetLocale || 'es').toMatch(/^es/);
    expect(String(fin.diagnostics?.visibleTextareaLocale || '')).toMatch(/^de/);
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(fin.diagnostics?.crossLocaleOperation).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidatePresent).toBe(true);
    expect(fin.diagnostics?.finalRequiredFactCount).toBe(3);
    expect(fin.diagnostics?.finalCoveredFactCount).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalUncoveredFactIdentityHashes || []).toEqual([]);
    expect(fin.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(fin.diagnostics?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(fin.diagnostics?.finalAddedPredicateCount).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalUnsupportedClaimCount || 0).toBe(0);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.degradationKinds || []).toEqual([]);
    expect(fin.diagnostics?.materialImprovementDetected).toBe(true);
    expect(fin.diagnostics?.semanticNoOpDetected).toBe(false);
    expect(fin.diagnostics?.translationFallbackAttempted).toBe(true);
    expect(fin.diagnostics?.translationFallbackSelected).toBe(true);
    // Applied only after transactional visible commit.
    expect(fin.diagnostics?.translationFallbackApplied).toBe(false);
    expect(Number(fin.diagnostics?.translatedFactCount)).toBeGreaterThanOrEqual(3);
    expect(fin.diagnostics?.authoritativeFactSourceKind).toMatch(/pre_ai|original/i);
    expect(fin.diagnostics?.currentTextareaUsedForFactExtraction).not.toBe(true);
    expect(fin.diagnostics?.currentTextareaProvenance || 'ai_generated_unedited')
      .toMatch(/ai_generated_unedited/);

    const appliedText = (fin.text || '').trim();
    expect(appliedText.length).toBeGreaterThan(40);
    expect(/[\u00C0-\u024F]|mercanc|documentaci|compa[nñ]er/iu.test(appliedText)).toBe(true);
    expect(/prüft|kontrolliert|koordiniert/iu.test(appliedText)).toBe(false);
    expect(/\b(checks?|works? with colleagues)\b/iu.test(appliedText)).toBe(false);

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-de-es-330',
      requestedLocale: 'es',
      uiLocale: 'es',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-de-es-330',
      usageCountBefore: 2,
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
      visibleTextareaLocale: 'de',
      requestedTargetLocale: 'es',
      entryGeneratedLocaleBeforeApply: 'de',
      contentLocaleDocument: 'en',
      // Pre-commit: must not claim applied locale yet.
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
    expect(Number(draft.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(draft.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(draft.degradationDetected).toBe(false);
    expect(draft.degradationKinds || []).toEqual([]);

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
      postapplyDiagnosticCompletenessPassed: true,
      postapplyDiagnosticInvariantCheckPassed: true,
      preapplyDiagnosticCompletenessPassed: true,
      preapplyDiagnosticInvariantCheckPassed: true,
      appliedVisibleContentLocale: 'es',
    });
    session.recordVisibleApply(true, 3, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyAuthorized).toBe(true);
    expect(trace.applyWriteSucceeded).toBe(true);
    expect(trace.visibleFactCoveragePassed).toBe(true);
    expect(trace.visiblePredicateCoveragePassed).toBe(true);
    expect(trace.visibleLocaleValidationPassed).toBe(true);
    expect(trace.visibleTenseValidationPassed).toBe(true);
    expect(trace.visibleDescriptionMatchesFinalHash).toBe(true);
    expect(trace.visibleValidationPassed).toBe(true);
    expect(trace.applyCommitted).toBe(true);
    expect(trace.targetContentApplied).toBe(true);
    expect(trace.contentLocaleUpdatedAfterApply).toBe(true);
    expect(trace.translationFallbackApplied).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(2);
    expect(trace.usageCountAfter).toBe(3);
    expect(trace.degradationDetected).toBe(false);
    expect(trace.degradationKinds || []).toEqual([]);
  });
});

describe('AAB-330 shared three-locale warehouse Experience coverage', () => {
  it('EN authority → DE / ES / EN warehouse scanners all cover 3/3 without surface-key comparison', () => {
    const de = buildGermanWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const es = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });

    expect(validateGermanWarehouseExperienceCoverage(EN_ORIGINAL, de).covered.length).toBe(3);
    expect(scanGermanWarehousePredicates(EN_ORIGINAL, de).candidatePredicateIdentityCount).toBe(3);
    expect(validateSpanishWarehouseExperienceCoverage(EN_ORIGINAL, es).covered.length).toBe(3);
    expect(scanSpanishWarehousePredicates(EN_ORIGINAL, es).candidatePredicateIdentityCount).toBe(3);

    for (const [locale, candidate, visible] of [
      ['de', de, EN_ORIGINAL],
      ['es', es, DE_AI_UNEDITED],
      ['es', es, EN_ORIGINAL],
    ] as const) {
      const evalVis = evaluateExperienceVisibleComparison({
        factAuthorityText: EN_ORIGINAL,
        visibleComparisonText: visible,
        candidateText: candidate,
        locale,
        crossLocaleOperation: true,
        useVisibleForNoOp: true,
        isPresent: true,
      });
      expect(evalVis.degradationDetected).toBe(false);
      expect(evalVis.degradationKinds).toEqual([]);
      expect(evalVis.materialImprovementKinds).toContain('wrong_locale_fixed');
    }
  });
});
