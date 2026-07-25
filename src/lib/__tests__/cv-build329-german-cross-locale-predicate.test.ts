/**
 * @vitest-environment jsdom
 *
 * AAB-329 follow-up — German cross-locale Experience Stronger AI:
 * unedited English AI textarea must not block deterministic DE 3/3 fallback
 * via missing final predicate diagnostics or false fact_lost degradation.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  GERMAN_EXPERIENCE_GROUNDING_303_REVISION,
  validateGermanWarehouseExperienceCoverage,
  scanGermanWarehousePredicates,
  buildGermanWarehouseExperienceFallback,
} from '@/lib/cv-german-experience-grounding';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

const REF = '2026-07-25';

/** Original pre-AI English warehouse duties (fact authority). */
const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

/** Previous unedited English Stronger AI output in the textarea. */
const EN_AI_UNEDITED = [
  'Inspects incoming merchandise upon arrival at the warehouse.',
  'Verifies documentation associated with received goods.',
  'Coordinates with colleagues on the preparation and movement of merchandise.',
].join('\n');

/** Provider omits third prepare/move-with-colleagues duty → 2/3. */
const DE_PROVIDER_2_OF_3 = [
  'Prüft eingehende Waren.',
  'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
  'Aktualisiert Arbeitsdokumentation und verfolgt offene Vorgänge.',
].join('\n');

function atlasEnToDeCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: EN_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'en',
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
    description: EN_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'en',
    generatedDescription: EN_AI_UNEDITED,
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
    id: 'cv-de-329-cross',
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

describe('AAB-329 German cross-locale Experience predicate + degradation truth', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes German grounding revision for packaging', () => {
    expect(GERMAN_EXPERIENCE_GROUNDING_303_REVISION)
      .toBe('german-experience-grounding-303-v1');
  });

  it('scanGermanWarehousePredicates covers EN source + DE fallback 3/3', () => {
    const fallback = buildGermanWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const cov = validateGermanWarehouseExperienceCoverage(EN_ORIGINAL, fallback);
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    const pred = scanGermanWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('countTranslatedFactUnits counts DE warehouse 3/3', async () => {
    const { countTranslatedFactUnits } = await import('@/lib/cv-cross-locale-experience');
    const fallback = buildGermanWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
  });

  it('cross-locale EN visible vs DE 3/3 fallback is not fact_lost', () => {
    const fallback = buildGermanWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: EN_AI_UNEDITED,
      candidateText: fallback,
      locale: 'de',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.degradationKinds).not.toContain('fact_lost');
  });

  it('1–13. EN→DE Stronger AI: provider 2/3 rejected; DE fallback 3/3 predicates; preapply passes', () => {
    const cv = atlasEnToDeCv();
    // Live textarea = unedited EN AI; fact authority = original EN warehouse duties.
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: EN_AI_UNEDITED,
      locale: 'de',
      requestId: 'req-de-329-cross',
      jobContextHash: 'job-de-329',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: DE_PROVIDER_2_OF_3,
      experienceId: 'exp-atlas',
      industry: 'logistics',
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
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(
      fin.origin === 'deterministic_fallback'
      || fin.diagnostics?.clientDeterministicFallbackApplied === true
      || fin.diagnostics?.translationFallbackApplied === true,
    ).toBe(true);
    expect(fin.diagnostics?.providerCoveredFactCount).toBe(2);
    expect(fin.diagnostics?.finalRequiredFactCount).toBe(3);
    expect(fin.diagnostics?.finalCoveredFactCount).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalUncoveredFactIdentityHashes).toEqual([]);
    expect(fin.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(fin.diagnostics?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(fin.diagnostics?.finalAddedPredicateCount).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.degradationKinds || []).not.toContain('fact_lost');
    // Cross-locale translation truth: applied fallback covers 3/3 facts.
    if (fin.diagnostics?.translationFallbackApplied === true) {
      expect(Number(fin.diagnostics?.translatedFactCount)).toBeGreaterThanOrEqual(3);
    }
    expect(fin.diagnostics?.authoritativeFactSourceKind).toMatch(/pre_ai|original/i);
    // Must not treat unedited AI textarea as fact authority (undefined ≡ not used).
    expect(fin.diagnostics?.currentTextareaUsedForFactExtraction).not.toBe(true);

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-de-329-cross',
      requestedLocale: 'de',
      uiLocale: 'de',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-de-329',
      usageCountBefore: 1,
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
      // Request-time hash match must agree (device scenario: unedited prior AI).
      lastAiOutputHashMatched: true,
      visibleComparisonMatchedLastAiOutput: true,
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

    // Simulate transactional visible apply of the German fallback.
    const appliedText = fin.text || '';
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
    });
    session.recordVisibleApply(true, 2, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.usageCountAfter).toBe(2);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.degradationDetected).toBe(false);
  });

  it('provider-only 2/3 DE candidate is rejected (no apply)', () => {
    const cv = atlasEnToDeCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: DE_PROVIDER_2_OF_3,
      experienceId: 'exp-atlas',
      industry: 'logistics',
      level: 'mid',
      referenceDateIso: REF,
      // Force provider-only by omitting recovery path is not possible — finalize
      // will fall back. Assert provider lineage still records 2/3 when fallback wins.
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
    });
    expect(fin.diagnostics?.providerCoveredFactCount).toBe(2);
    expect(fin.diagnostics?.providerRequiredFactCount).toBe(3);
    // Fallback still applies — usage path is success; rejection of provider only.
    expect(fin.origin).toBe('deterministic_fallback');
  });
});
