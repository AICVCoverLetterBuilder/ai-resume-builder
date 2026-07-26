/**
 * @vitest-environment jsdom
 *
 * AAB-338 — Russian-visible → Hindi Experience cross-locale:
 * EN pre_ai fact authority + unedited Russian AI textarea + hi target must
 * reject the merged soft Devanagari provider/server-fallback (2 real duties),
 * select a hard Hindi 3/3 warehouse fallback, pass preapply predicates,
 * freeze provider rejection evidence, and commit once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  HINDI_EXPERIENCE_GROUNDING_338_REVISION,
  validateHindiWarehouseExperienceCoverage,
  scanHindiWarehousePredicates,
  buildHindiWarehouseExperienceFallback,
  hindiWarehouseFactDiagId,
  sourceRequiresHindiWarehouseFactCoverage,
} from '@/lib/cv-hindi-experience-grounding';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { countTranslatedFactUnits } from '@/lib/cv-cross-locale-experience';
import { buildExperienceSelectedFinalCandidateSnapshot } from '@/lib/cv-experience-phased-apply-329';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { resolveExperienceAiAuthoritativeSource } from '@/lib/cv-experience-provenance';

const REF = '2026-07-26';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const RU_AI_UNEDITED = [
  'Проверяет поступающие на склад товары.',
  'Проверяет документацию, связанную с полученными товарами.',
  'Координирует с коллегами подготовку и перемещение товаров.',
].join('\n');

/** Device-equivalent soft HI provider/server-fallback triad. */
const DEVICE_SOFT_HI_PROVIDER = [
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
].join('\n');

const EXPECTED_HI_HARD_TRIAD = [
  'गोदाम में आने वाले माल की जाँच करती हैं।',
  'प्राप्त माल से संबंधित दस्तावेज़ों की जाँच करती हैं।',
  'माल की तैयारी और स्थानांतरण के लिए सहकर्मियों के साथ समन्वय करती हैं।',
];

function atlasRuVisibleHiTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: RU_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'ru',
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
    description: RU_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'ru',
    generatedDescription: RU_AI_UNEDITED,
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
    id: 'cv-ru-hi-338',
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

describe('AAB-338 Russian-visible → Hindi Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Hindi grounding revision for packaging', () => {
    expect(HINDI_EXPERIENCE_GROUNDING_338_REVISION).toBe(
      'hindi-experience-grounding-338-v1',
    );
  });

  it('A. Hindi fact separation: three independent required identities', () => {
    expect(sourceRequiresHindiWarehouseFactCoverage(EN_ORIGINAL)).toBe(true);
    const soft = validateHindiWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_HI_PROVIDER);
    expect(soft.required.length).toBe(3);
    expect(soft.required).toEqual([
      'incoming_goods_check',
      'document_check',
      'goods_prep_movement_colleagues',
    ]);
    expect(soft.ok).toBe(false);
    expect(soft.covered.length).toBeLessThan(3);
    expect(soft.uncovered.length).toBeGreaterThan(0);
    const hashes = soft.uncovered.map((id) => hindiWarehouseFactDiagId(id));
    expect(hashes.every((h) => h.startsWith('hi_wh_'))).toBe(true);

    const hard = buildHindiWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    for (const line of EXPECTED_HI_HARD_TRIAD) {
      expect(hard).toContain(line);
    }
    const hardCov = validateHindiWarehouseExperienceCoverage(EN_ORIGINAL, hard);
    expect(hardCov.ok).toBe(true);
    expect(hardCov.covered.length).toBe(3);
  });

  it('B. Predicate completeness: 3/3 and true, never 0/null', () => {
    const fallback = buildHindiWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    const pred = scanHindiWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);

    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: fallback,
      sourceDescription: EN_ORIGINAL,
      candidateKind: 'deterministic_fallback',
      source: 'deterministic_fallback',
      targetLocale: 'hi',
      employmentState: 'current',
      meaningfulChangeDetected: true,
    });
    expect(snap.requiredFactCount).toBe(3);
    expect(snap.coveredFactCount).toBe(3);
    expect(snap.sourcePredicateIdentityCount).toBe(3);
    expect(snap.candidatePredicateIdentityCount).toBe(3);
    expect(snap.predicateCoveragePassed).toBe(true);
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
  });

  it('C. Provider with three Hindi bullets but only two real duties is rejected', () => {
    const purity = validateAiUnitLocalePurity(DEVICE_SOFT_HI_PROVIDER, 'hi', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.detectedLocaleByUnit).toEqual(['hi', 'hi', 'hi']);
    const cov = validateHindiWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_HI_PROVIDER);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBeLessThan(3);
    expect(cov.uncovered.map((id) => hindiWarehouseFactDiagId(id)).length).toBeGreaterThan(0);
    const pred = scanHindiWarehousePredicates(EN_ORIGINAL, DEVICE_SOFT_HI_PROVIDER);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
  });

  it('D. Hindi fallback recovery: invalid provider selects hard HI 3/3', () => {
    const cv = atlasRuVisibleHiTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_HI_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: RU_AI_UNEDITED,
        locale: 'hi',
        requestId: 'req-ru-hi-338-d',
        jobContextHash: 'job-ru-hi-338-d',
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
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    for (const line of EXPECTED_HI_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
  });

  it('E. RU 3/3 → HI 3/3 visible comparison: wrong_locale_fixed only', () => {
    const fallback = buildHindiWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: RU_AI_UNEDITED,
      candidateText: fallback,
      locale: 'hi',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.materialImprovementDetected).toBe(true);
    expect(evalVis.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(evalVis.materialImprovementKinds).not.toContain('missing_fact_restored');
    expect(evalVis.semanticNoOpDetected).toBe(false);
  });

  it('F. Provider rejection evidence remains frozen after fallback selection', () => {
    const cv = atlasRuVisibleHiTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_HI_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: RU_AI_UNEDITED,
        locale: 'hi',
        requestId: 'req-ru-hi-338-f',
        jobContextHash: 'job-ru-hi-338-f',
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
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(Number(fin.diagnostics?.providerRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerCoveredFactCount)).toBeLessThan(3);
    const uncovered = fin.diagnostics?.providerUncoveredFactIdentityHashes || [];
    expect(uncovered.length).toBeGreaterThan(0);
    expect(uncovered.every((h: string) => String(h).startsWith('hi_wh_'))).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
  });

  it('G. Source-authority truth: stale Russian visible AI is not authoritative', () => {
    const cv = atlasRuVisibleHiTargetCv();
    const auth = resolveExperienceAiAuthoritativeSource(cv.experience![0]!, {
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      authoritativeFactText: EN_ORIGINAL,
      currentTextareaUsedForFactExtraction: false,
      currentTextareaIgnoredOrOverridden: true,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      staleGeneratedDescriptionIgnored: true,
      generatedDescriptionPreexisted: true,
      formattingOnlyDifference: false,
      revision: 'experience-ai-output-provenance-304-v1',
    } as never);
    expect(auth.kind).toBe('originalUserDescription');
    expect(auth.staleForeignLocaleSourceAuthoritative).toBe(false);
    expect(auth.englishSourceStillAuthoritative).toBe(true);
    expect(auth.text).toContain('Checks incoming goods');
  });

  it('H. Rejection safety: incomplete Hindi diagnostics preserve Russian text', () => {
    const cv = atlasRuVisibleHiTargetCv();
    const rejectedFinalize = {
      blocked: true,
      countedAsSuccess: false,
      text: '',
      origin: 'ai_generated' as const,
      diagnostics: {
        applyCommitted: false,
        visibleApplySucceeded: false,
        targetContentApplied: false,
        contentLocaleUpdatedAfterApply: false,
        appliedVisibleContentLocale: null,
        translationFallbackApplied: false,
        clientDeterministicFallbackApplied: false,
        countedAsSuccess: false,
      },
    };
    const beforeDesc = cv.experience![0]!.description;
    const beforeGen = (cv.experience![0] as WorkExperience & { generatedLocale?: string })
      .generatedLocale;
    const applied = applyFinalizedBulletsToCv(cv, 'hi', 'exp-atlas', rejectedFinalize as never);
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
    expect(applied.experience![0]!.description).toContain('Проверяет поступающие');
  });

  it('1–22. RU-visible → hi Stronger AI: soft provider rejected; HI hard 3/3 applied', () => {
    const cv = atlasRuVisibleHiTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_HI_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: RU_AI_UNEDITED,
        locale: 'hi',
        requestId: 'req-ru-hi-338',
        jobContextHash: 'job-ru-hi-338',
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

    expect(fin.countedAsSuccess).toBe(true);
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^ru/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^ru/);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toBe('hi');
    expect(fin.diagnostics?.staleForeignLocaleSourceAuthoritative).toBe(false);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.requiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.translatedFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount)).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.detectedLocaleByBullet).toEqual(['hi', 'hi', 'hi']);
    expect(fin.diagnostics?.detectedScriptByBullet).toEqual([
      'devanagari',
      'devanagari',
      'devanagari',
    ]);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    const uncovered = fin.diagnostics?.providerUncoveredFactIdentityHashes || [];
    expect(uncovered.length).toBeGreaterThan(0);

    for (const line of EXPECTED_HI_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
    expect(/Проверяет|Координирует/u.test(fin.text || '')).toBe(false);
    expect(/सही रिकॉर्ड|अद्यतन|व्यवस्थित/u.test(fin.text || '')).toBe(false);
    const appliedText = (fin.text || '').trim();

    const usageBefore = 13;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-ru-hi-338-apply',
      requestedLocale: 'hi',
      uiLocale: 'hi',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-ru-hi-338',
      usageCountBefore: usageBefore,
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
      visibleTextareaLocale: 'ru',
      visibleTextareaLocaleBeforeApply: 'ru',
      requestedTargetLocale: 'hi',
      entryGeneratedLocaleBeforeApply: 'ru',
      contentLocaleDocument: 'en',
      appliedVisibleContentLocale: null,
      staleForeignLocaleSourceAuthoritative: false,
      englishSourceStillAuthoritative: true,
      visibleLocaleMetadataMismatchRecorded: false,
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
      clientDeterministicFallbackSelected: true,
      clientDeterministicFallbackUsedForFinalCandidate: true,
      clientDeterministicFallbackApplied: false,
      staleForeignLocaleSourceAuthoritative: false,
      currentTextareaUsedForFactExtraction: false,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    expect(gate.diagnosticCompletenessPassed).toBe(true);
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.preapplyDiagnosticCompletenessPassed).toBe(true);
    expect(draft.applyAuthorized).toBe(true);
    expect(draft.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(draft.staleForeignLocaleSourceAuthoritative).toBe(false);

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
      contentLocaleDocument: 'hi',
      appliedVisibleContentLocale: 'hi',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(true);
    expect(trace.appliedVisibleContentLocale).toBe('hi');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'hi', 'exp-atlas', fin);
    expect(write.experience![0]!.description).toContain(EXPECTED_HI_HARD_TRIAD[0]!);
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('hi');
    expect(write.contentLocale).toBe('hi');
    expect(write.experience![1]!.description).toContain('administrative');
  });
});
