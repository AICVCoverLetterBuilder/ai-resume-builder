/**
 * @vitest-environment jsdom
 *
 * AAB415: shared Experience person ownership with Arabic locale realization.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import {
  detectExperiencePersonMode,
  normalizeExperienceBulletsPerspective,
  normalizeExperienceBulletPerspective,
  validateExperienceCvPerspective,
} from '@/lib/cv-experience-perspective';
import {
  normalizeArabicExperienceEmploymentGrammar,
  validateArabicExperienceEmploymentTense,
} from '@/lib/cv-arabic-experience-tense';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceAiOutputProvenance,
  resolveExperienceTextareaProvenance,
} from '@/lib/cv-experience-ai-output-provenance';
import {
  buildExperienceJobContext,
  resolveExperienceAiGrounding,
} from '@/lib/cv-experience-job-context';
import { freezeExperienceAiDescription } from '@/lib/cv-canonical-facts';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import { validateVisibleExperienceCoverage } from '@/lib/cv-experience-phased-apply-329';
import {
  commitExperienceApplyTransactionally,
  createExperienceApplyOwnershipState,
  hashExperienceTextForApply,
} from '@/lib/cv-experience-transactional-apply';
import {
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  checkExperienceDiagnosticCompleteness,
  checkExperienceDiagnosticInvariants,
} from '@/lib/cv-ai-diagnostics-contract';

const DEVICE_ID = 'exp-aab415-design';
const DEVICE_SOURCE = [
  'Izrađivala sam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređivala sam grafike i fotografije za različite projekte.',
  'Usaglašavala sam nacrte i izmene sa članovima projektnog tima.',
].join('\n');

const DEVICE_PROVIDER_1SG = [
  'أعددتُ المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'حرّرتُ الرسومات والصور لمختلف المشاريع.',
  'نسّقتُ المسودات والتعديلات مع أعضاء فريق المشروع.',
].join('\n');

const DEVICE_EXPECTED_3SG_F = [
  'أعدّتْ المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'حرّرتْ الرسومات والصور لمختلف المشاريع.',
  'نسّقتْ المسودات والتعديلات مع أعضاء فريق المشروع.',
].join('\n');

const VALID_COMPLETED_3SG_F = [
  'أعدّت المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'حرّرت الرسومات والصور لمختلف المشاريع.',
  'نسّقت المسودات والتعديلات مع أعضاء فريق المشروع.',
].join('\n');

const ARBITRARY_CURRENT_1SG = [
  'أكتب واجهات برمجية لخدمات المنتج.',
  'أختبر المكونات باستخدام اختبارات آلية.',
  'أوثق قرارات التنفيذ لفريق الهندسة.',
].join('\n');

const ARBITRARY_CURRENT_3SG_F = [
  'تكتب واجهات برمجية لخدمات المنتج.',
  'تختبر المكونات باستخدام اختبارات آلية.',
  'توثق قرارات التنفيذ لفريق الهندسة.',
].join('\n');

const asFormattedBullets = (text: string) => text
  .split('\n')
  .map((line) => `• ${line}`)
  .join('\n');

function deviceCv(secondEntry = true): CVData {
  const target: WorkExperience = {
    id: DEVICE_ID,
    company: 'Studio',
    position: 'Grafička dizajnerka',
    startDate: '2021-01',
    endDate: '2024-12',
    isPresent: false,
    description: DEVICE_SOURCE,
    originalUserDescription: DEVICE_SOURCE,
    canonicalDescription: DEVICE_SOURCE,
    descriptionOrigin: 'user',
  };
  const other: WorkExperience = {
    id: 'exp-aab415-other',
    company: 'Other',
    position: 'Laboratorijska tehničarka',
    startDate: '2019-01',
    endDate: '2020-12',
    isPresent: false,
    description: 'Pripremala sam uzorke.\nBeležila sam rezultate.',
    originalUserDescription: 'Pripremala sam uzorke.\nBeležila sam rezultate.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-aab415',
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '',
      address: '',
      jobTitle: 'Grafička dizajnerka',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'sr',
    experience: secondEntry ? [target, other] : [target],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

function finalizeDevice() {
  const cv = deviceCv();
  const operationSnapshot = createExperienceAiOperationSnapshot({
    liveText: DEVICE_SOURCE,
    authoritativeTextOverride: DEVICE_SOURCE,
    provenanceOriginOverride: 'originalUserDescription',
    locale: 'ar',
    requestId: 'req-aab415-ar',
    jobContextHash: 'job-aab415-ar',
    experienceEntryId: DEVICE_ID,
  });
  const result = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'ar',
    sourceLocale: 'sr',
    gender: 'female',
    cv,
    candidate: DEVICE_PROVIDER_1SG,
    originHint: 'ai_generated',
    experienceId: DEVICE_ID,
    industry: 'general',
    level: 'mid',
    operationSnapshot,
  });
  return { cv, operationSnapshot, result };
}

function resolveDeviceGrounding(exp: WorkExperience) {
  return resolveExperienceAiGrounding(
    exp,
    buildExperienceJobContext({
      position: exp.position,
      industry: 'general',
      locale: 'ar',
      level: 'mid',
    }),
    freezeExperienceAiDescription,
  );
}

describe('AAB415 shared Experience Arabic person/perspective contract', () => {
  beforeEach(() => {
    localStorage.clear();
    clearExperienceAiDiagnosticsForTests();
  });

  it('classifies the exact device provider as first-person before normalization', () => {
    expect(detectExperiencePersonMode(DEVICE_PROVIDER_1SG, 'ar', { isPresent: false }))
      .toBe('first_singular');
    expect(validateExperienceCvPerspective(DEVICE_PROVIDER_1SG, 'ar', { isPresent: false }))
      .toMatchObject({ ok: false, finalPersonMode: 'first_singular' });
    expect(validateArabicExperienceEmploymentTense(DEVICE_PROVIDER_1SG, {
      isPresent: false,
      gender: 'female',
    })).toMatchObject({
      finalTensePassed: false,
      finalEmploymentState: 'completed',
    });
  });

  it('normalizes the exact device provider to completed third-person feminine without fact changes', () => {
    const normalized = normalizeExperienceBulletsPerspective(DEVICE_PROVIDER_1SG, {
      locale: 'ar',
      sourceLocale: 'sr',
      sourceDescription: DEVICE_SOURCE,
      isPresent: false,
      gender: 'female',
    });
    expect(normalized.text).toBe(asFormattedBullets(DEVICE_EXPECTED_3SG_F));
    expect(normalized.sourcePersonMode).toBe('first_singular');
    expect(normalized.providerPersonMode).toBe('first_singular');
    expect(normalized.normalizedPersonMode).toBe('third_singular');
    expect(normalized.perspectiveNormalizationAttempted).toBe(true);
    expect(normalized.perspectiveNormalizationApplied).toBe(true);
    expect(normalized.perspectiveValidationPassed).toBe(true);
    const predicates = scanGenericExperiencePredicates(DEVICE_SOURCE, normalized.text);
    expect(predicates.sourcePredicateIdentityCount).toBe(3);
    expect(predicates.candidatePredicateIdentityCount).toBe(3);
    expect(predicates.candidateAddedPredicateCount).toBe(0);
    expect(predicates.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('applies the exact normalized device result once with truthful final and visible diagnostics', () => {
    const { cv, operationSnapshot, result } = finalizeDevice();
    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    expect(result.text).toBe(asFormattedBullets(DEVICE_EXPECTED_3SG_F));
    expect(result.diagnostics).toMatchObject({
      sourcePersonMode: 'first_singular',
      providerPersonMode: 'first_singular',
      normalizedPersonMode: 'third_singular',
      finalPersonMode: 'third_singular',
      perspectiveNormalizationAttempted: true,
      perspectiveNormalizationApplied: true,
      perspectiveValidationPassed: true,
      finalRequiredFactCount: 3,
      finalCoveredFactCount: 3,
      finalAddedPredicateCount: 0,
      finalUnsupportedClaimCount: 0,
    });

    const otherBefore = cv.experience[1]!.description;
    const cvRef = { current: cv };
    const ownership = createExperienceApplyOwnershipState();
    let usage = 0;
    const tx = commitExperienceApplyTransactionally({
      cvRef,
      ownership,
      locale: 'ar',
      experienceId: DEVICE_ID,
      finalized: result,
      operationSourceText: operationSnapshot.visibleComparisonRawText,
      currentVisibleText: DEVICE_SOURCE,
      operationId: operationSnapshot.requestId,
      scheduleReactCv: () => undefined,
    });
    const visible = validateVisibleExperienceCoverage({
      sourceDescription: DEVICE_SOURCE,
      visibleText: tx.writtenDescription,
      targetLocale: 'ar',
      finalNormalizedHash: hashExperienceTextForApply(result.text),
      isPresent: false,
    });
    if (tx.ok && visible.visiblePerspectiveValidationPassed) usage += 1;

    expect(tx.ok).toBe(true);
    expect(visible).toMatchObject({
      visibleFactCoveragePassed: true,
      visiblePredicateCoveragePassed: true,
      visiblePersonMode: 'third_singular',
      visiblePerspectiveValidationPassed: true,
      visibleDescriptionMatchesFinalHash: true,
    });
    expect(cvRef.current.experience[1]!.description).toBe(otherBefore);
    expect(usage).toBe(1);

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-aab415-diag',
      requestedLocale: 'ar',
      uiLocale: 'ar',
      templateId: 'modern',
      jobContextHash: 'job-aab415-ar',
      usageCountBefore: 0,
    });
    session.recordFinalizeResult(result);
    session.patch({
      visiblePersonMode: visible.visiblePersonMode,
      visiblePerspectiveValidationPassed: visible.visiblePerspectiveValidationPassed,
    });
    const trace = session.commit();
    expect(trace).toMatchObject({
      sourcePerspectiveMode: 'first_singular',
      targetPerspectiveMode: 'third_singular',
      sourcePersonMode: 'first_singular',
      providerPersonMode: 'first_singular',
      normalizedPersonMode: 'third_singular',
      finalPersonMode: 'third_singular',
      perspectiveValidationPassed: true,
      visiblePersonMode: 'third_singular',
      visiblePerspectiveValidationPassed: true,
    });
  });

  it('keeps the exact immediate unedited Arabic rerun rejected while terminal diagnostics stay phase-owned', () => {
    const { cv, operationSnapshot, result: first } = finalizeDevice();
    expect(first).toMatchObject({ blocked: false, countedAsSuccess: true });

    const cvRef = { current: cv };
    let usage = 4;
    const firstApply = commitExperienceApplyTransactionally({
      cvRef,
      ownership: createExperienceApplyOwnershipState(),
      locale: 'ar',
      experienceId: DEVICE_ID,
      finalized: first,
      operationSourceText: operationSnapshot.visibleComparisonRawText,
      currentVisibleText: DEVICE_SOURCE,
      operationId: operationSnapshot.requestId,
      scheduleReactCv: () => undefined,
    });
    if (firstApply.ok) usage += 1;
    expect(firstApply.ok).toBe(true);
    expect(usage).toBe(5);

    const appliedEntry = cvRef.current.experience[0]!;
    appliedEntry.description = first.text;
    appliedEntry.generatedDescription = first.text;
    appliedEntry.descriptionOrigin = 'ai_generated';
    (appliedEntry as WorkExperience & { generatedLocale?: string }).generatedLocale = 'ar';
    appliedEntry.aiOutputProvenance = buildExperienceAiOutputProvenance({
      experienceEntryId: DEVICE_ID,
      appliedOutput: first.text,
      preAiFactText: DEVICE_SOURCE,
      sourceLocale: 'sr',
      targetLocale: 'ar',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'pre_ai_snapshot',
    });
    const provenance = resolveExperienceTextareaProvenance(appliedEntry);
    expect(provenance).toMatchObject({
      currentTextareaProvenance: 'ai_generated_unedited',
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
    });

    const visibleBeforeSecond = appliedEntry.description;
    const secondSnapshot = createExperienceAiOperationSnapshot({
      liveText: visibleBeforeSecond,
      authoritativeTextOverride: DEVICE_SOURCE,
      provenanceOriginOverride: 'originalUserDescription',
      locale: 'ar',
      requestId: 'req-aab416-ar-rerun',
      jobContextHash: 'job-aab416-ar-rerun',
      experienceEntryId: DEVICE_ID,
    });
    const second = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      sourceLocale: 'sr',
      gender: 'female',
      cv: cvRef.current,
      candidate: visibleBeforeSecond,
      originHint: 'ai_generated',
      experienceId: DEVICE_ID,
      industry: 'general',
      level: 'mid',
      operationSnapshot: secondSnapshot,
      jobContextHash: 'job-aab416-ar-rerun',
      currentTextareaProvenance: provenance.currentTextareaProvenance,
      currentTextareaUsedForFactExtraction: provenance.currentTextareaUsedForFactExtraction,
      authoritativeFactSourceKind: provenance.authoritativeFactSourceKind,
      lastAiOutputHashMatched: provenance.lastAiOutputHashMatched,
      materialUserEditDetected: provenance.materialUserEditDetected,
      staleGeneratedDescriptionIgnored: provenance.staleGeneratedDescriptionIgnored,
    });

    expect(second).toMatchObject({
      blocked: true,
      countedAsSuccess: false,
      diagnostics: { finalDecisionKind: 'semantic_noop' },
    });
    expect(second.diagnostics).toMatchObject({
      uneditedRerunDetected: true,
      earlyNoOpPreflightPassed: false,
      semanticNoOpDetected: true,
      materialImprovementDetected: false,
      providerCandidateValidationAccepted: false,
      finalVisibleDecisionAcceptedForApply: false,
      canonicalExperienceDecisionAllowsApply: false,
      canonicalExperienceDecisionAllowsUsage: false,
    });

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-aab416-ar-rerun',
      requestedLocale: 'ar',
      uiLocale: 'ar',
      contentLocale: 'ar',
      templateId: 'modern',
      gender: 'female',
      industryNorm: 'general',
      levelNorm: 'mid',
      jobContextHash: 'job-aab416-ar-rerun',
      usageCountBefore: usage,
    });
    session.recordLiveExperience(appliedEntry, false);
    session.recordSourceSelection(appliedEntry, resolveDeviceGrounding(appliedEntry), {
      requestedLocale: 'ar',
      operationalContentLocale: 'ar',
      currentTextareaProvenance: provenance.currentTextareaProvenance,
      authoritativeFactSourceKind: provenance.authoritativeFactSourceKind,
      currentTextareaUsedForFactExtraction: provenance.currentTextareaUsedForFactExtraction,
      lastAiOutputHashMatched: provenance.lastAiOutputHashMatched,
      materialUserEditDetected: provenance.materialUserEditDetected,
      staleGeneratedDescriptionIgnored: provenance.staleGeneratedDescriptionIgnored,
    });
    session.recordApiResponse({ httpStatus: 200, resultText: visibleBeforeSecond });
    session.recordFinalizeResult(second);
    session.recordVisibleApply(false, usage);
    const trace = session.commit();

    expect(appliedEntry.description).toBe(visibleBeforeSecond);
    expect(usage).toBe(5);
    expect(trace).toMatchObject({
      currentTextareaProvenance: 'ai_generated_unedited',
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      uneditedRerunDetected: true,
      earlyNoOpPreflightPassed: false,
      finalCandidatePresent: false,
      finalCandidateSource: 'none',
      finalNormalizedHash: null,
      finalBulletCount: 0,
      finalPersonMode: null,
      finalRequiredFactCount: null,
      finalCoveredFactCount: null,
      finalAddedPredicateCount: 0,
      finalSourceUnitPredicateCoveragePassed: null,
      requiredFactCount: 0,
      coveredFactCount: 0,
      uncoveredFactIdentityHashes: [],
      diagnosticInvariantCheckPassed: true,
      diagnosticInvariantFailures: [],
      diagnosticCompletenessPassed: true,
      privacyCheckPassed: true,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 5,
      usageCountAfter: 5,
    });
    expect(checkExperienceDiagnosticInvariants(trace).failures).toEqual([]);
    expect(checkExperienceDiagnosticCompleteness(trace).passed).toBe(true);
  });

  it.each([
    {
      label: 'provider rejected without fallback selection',
      fallback: false,
    },
    {
      label: 'provider and fallback both rejected',
      fallback: true,
    },
  ])('serializes no selected-final truth when $label', ({ fallback }) => {
    const session = new ExperienceAiDiagnosticSession({
      requestId: `req-aab416-matrix-${fallback ? 'fallback' : 'provider'}`,
      requestedLocale: 'ar',
      uiLocale: 'ar',
      contentLocale: 'ar',
      templateId: 'modern',
      jobContextHash: 'job-aab416-matrix',
      usageCountBefore: 5,
    });
    session.patch({
      currentTextareaProvenance: 'ai_generated_unedited',
      visibleComparisonProvenance: 'ai_generated_unedited',
      lastAiOutputHashMatched: true,
      visibleComparisonMatchedLastAiOutput: true,
      materialUserEditDetected: false,
      sourceFactCount: 3,
      sourceFactIdentityCount: 3,
    });
    session.recordApiResponse({
      httpStatus: 200,
      resultText: asFormattedBullets(DEVICE_EXPECTED_3SG_F),
    });
    session.recordFinalizeResult({
      blocked: true,
      reason: fallback
        ? 'experience_material_fact_coverage_incomplete'
        : 'experience_cv_perspective_unproven',
      text: asFormattedBullets(DEVICE_EXPECTED_3SG_F),
      origin: 'user',
      roleDutyConflict: false,
      countedAsSuccess: false,
      diagnostics: {
        earlyNoOpPreflightEvaluated: true,
        earlyNoOpPreflightPassed: false,
        providerAttempted: true,
        providerAccepted: false,
        providerRequiredFactCount: 3,
        providerCoveredFactCount: 2,
        providerUncoveredFactIdentityHashes: ['provider-fact-3'],
        providerRejectionStage: 'provider:arabic_employment_tense',
        providerRejectionReason: 'arabic_employment_tense_mismatch',
        requiredFactCount: 3,
        coveredFactCount: 2,
        uncoveredFactIdentityHashes: [],
        candidatePredicateIdentityCount: 3,
        candidateAddedPredicateCount: 2,
        sourceUnitPredicateCoveragePassed: false,
        finalCandidatePresent: false,
        finalCandidateSource: 'none',
        finalNormalizedHash: null,
        finalPersonMode: 'third_singular',
        finalRequiredFactCount: 3,
        finalCoveredFactCount: 2,
        finalAddedPredicateCount: 2,
        finalSourceUnitPredicateCoveragePassed: false,
        finalBulletCount: 0,
        finalBulletScripts: [],
        finalDecisionKind: 'invalid_candidate_rejected',
        rejectionStage: fallback ? 'fallback:material_coverage' : 'final_selected:perspective',
        typedFailureReason: fallback
          ? 'experience_material_fact_coverage_incomplete'
          : 'experience_cv_perspective_unproven',
        clientDeterministicFallbackAttempted: fallback,
        clientDeterministicFallbackReason: fallback
          ? 'fallback_material_coverage_incomplete'
          : undefined,
        clientDeterministicFallbackBulletCount: fallback ? 3 : 0,
        clientDeterministicFallbackRequiredFactCount: fallback ? 3 : 0,
        clientDeterministicFallbackCoveredFactCount: fallback ? 2 : 0,
        clientDeterministicFallbackUncoveredFactIds: fallback ? ['fallback-fact-3'] : [],
        clientDeterministicFallbackApplied: false,
        countedAsSuccess: false,
      },
    });
    session.recordVisibleApply(false, 5);
    const trace = session.commit();
    const providerLineage = trace.candidateLineage?.find(
      (candidate) => candidate.candidateKind === 'provider',
    );

    expect(trace).toMatchObject({
      uneditedRerunDetected: true,
      earlyNoOpPreflightPassed: false,
      requiredFactCount: 0,
      coveredFactCount: 0,
      uncoveredFactIdentityHashes: [],
      providerRequiredFactCount: 3,
      providerCoveredFactCount: 2,
      providerUncoveredFactIdentityHashes: ['provider-fact-3'],
      providerRejectionStage: 'provider:arabic_employment_tense',
      providerRejectionReasons: ['arabic_employment_tense_mismatch'],
      finalCandidatePresent: false,
      finalCandidateSource: 'none',
      finalNormalizedHash: null,
      finalPersonMode: null,
      finalCandidatePredicateIdentityCount: 0,
      finalAddedPredicateCount: 0,
      finalSourceUnitPredicateCoveragePassed: null,
      finalRequiredFactCount: null,
      finalCoveredFactCount: null,
      finalUncoveredFactIdentityHashes: [],
      finalFactCoveragePassed: null,
      finalBulletCount: 0,
      diagnosticInvariantCheckPassed: true,
      diagnosticInvariantFailures: [],
    });
    expect(providerLineage).toMatchObject({
      rejectionStage: 'provider:arabic_employment_tense',
      rejectionReasons: ['arabic_employment_tense_mismatch'],
      coverageRequiredCount: 3,
      coverageCoveredCount: 2,
      uncoveredFactIdentityHashes: ['provider-fact-3'],
    });
  });

  it('does not classify a materially user-edited prior AI output as an unedited rerun', () => {
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-aab416-user-edited',
      requestedLocale: 'ar',
      uiLocale: 'ar',
      contentLocale: 'ar',
      templateId: 'modern',
      jobContextHash: 'job-aab416-user-edited',
      usageCountBefore: 5,
    });
    session.patch({
      currentTextareaProvenance: 'ai_generated_user_edited',
      visibleComparisonProvenance: 'ai_generated_user_edited',
      lastAiOutputHashMatched: false,
      visibleComparisonMatchedLastAiOutput: false,
      materialUserEditDetected: true,
    });
    session.recordFinalizeResult({
      blocked: true,
      reason: 'experience_material_fact_coverage_incomplete',
      text: '',
      origin: 'user',
      roleDutyConflict: false,
      countedAsSuccess: false,
      diagnostics: {
        earlyNoOpPreflightEvaluated: true,
        earlyNoOpPreflightPassed: false,
        uneditedRerunDetected: true,
        finalCandidatePresent: false,
        finalCandidateSource: 'none',
        finalBulletCount: 0,
        finalBulletScripts: [],
        countedAsSuccess: false,
      },
    });
    session.recordVisibleApply(false, 5);
    const trace = session.commit();
    expect(trace.currentTextareaProvenance).toBe('ai_generated_user_edited');
    expect(trace.materialUserEditDetected).toBe(true);
    expect(trace.uneditedRerunDetected).toBe(false);
  });

  it('accepts valid completed third-person feminine without rewriting it', () => {
    const normalized = normalizeArabicExperienceEmploymentGrammar(VALID_COMPLETED_3SG_F, {
      isPresent: false,
      gender: 'female',
    });
    expect(normalized).toBe(VALID_COMPLETED_3SG_F);
    expect(detectExperiencePersonMode(normalized, 'ar', { isPresent: false }))
      .toBe('third_singular');
    expect(validateExperienceCvPerspective(normalized, 'ar', { isPresent: false }).ok)
      .toBe(true);
  });

  it('projects an arbitrary completed Arabic fallback through the same shared boundary', () => {
    const fallbackLemma = [
      'أراجع تقارير الميدان الواردة وأعلّم الإدخالات غير المكتملة.',
      'أحدث الجدول المشترك بأحدث حالة.',
      'أنسق مع قسمين داخليين عندما تكون المعلومات ناقصة.',
    ].join('\n');
    const normalized = normalizeExperienceBulletsPerspective(fallbackLemma, {
      locale: 'ar',
      sourceLocale: 'ar',
      sourceDescription: fallbackLemma,
      isPresent: false,
      gender: 'female',
    });
    expect(normalized.text).toMatch(/راجعت|حدّثت|نسّقت/u);
    expect(normalized.normalizedPersonMode).toBe('third_singular');
    expect(normalized.perspectiveValidationPassed).toBe(true);
  });

  it('normalizes arbitrary current-role first-person predicates through the shared contract', () => {
    expect(detectExperiencePersonMode(ARBITRARY_CURRENT_1SG, 'ar', { isPresent: true }))
      .toBe('first_singular');
    const normalized = normalizeExperienceBulletsPerspective(ARBITRARY_CURRENT_1SG, {
      locale: 'ar',
      sourceLocale: 'ar',
      sourceDescription: ARBITRARY_CURRENT_1SG,
      isPresent: true,
      gender: 'female',
    });
    expect(normalized.text).toBe(asFormattedBullets(ARBITRARY_CURRENT_3SG_F));
    expect(normalized.normalizedPersonMode).toBe('third_singular');
    expect(normalized.perspectiveValidationPassed).toBe(true);
    expect(validateArabicExperienceEmploymentTense(normalized.text, {
      isPresent: true,
      gender: 'female',
    })).toMatchObject({
      finalTensePassed: true,
      finalGenderAgreementPassed: true,
    });
  });

  it('accepts valid current third-person Arabic unchanged', () => {
    const normalized = normalizeExperienceBulletsPerspective(ARBITRARY_CURRENT_3SG_F, {
      locale: 'ar',
      sourceLocale: 'ar',
      sourceDescription: ARBITRARY_CURRENT_3SG_F,
      isPresent: true,
      gender: 'female',
    });
    expect(normalized.text).toBe(asFormattedBullets(ARBITRARY_CURRENT_3SG_F));
    expect(normalized.normalizedPersonMode).toBe('third_singular');
    expect(normalized.changed).toBe(false);
    expect(validateArabicExperienceEmploymentTense(normalized.text, {
      isPresent: true,
      gender: 'female',
    }).finalTensePassed).toBe(true);
  });

  it('does not let a first-person diacritic suffix satisfy a third-person substring', () => {
    const first = 'نسّقتُ المسودات مع الفريق.';
    expect(detectExperiencePersonMode(first, 'ar', { isPresent: false }))
      .toBe('first_singular');
    expect(validateArabicExperienceEmploymentTense(first, {
      isPresent: false,
      gender: 'female',
    }).finalTensePassed).toBe(false);
  });

  it('keeps genuinely ambiguous unvocalized Arabic neutral rather than inventing third-person proof', () => {
    const ambiguous = 'راجعت المواد مع الفريق.';
    expect(detectExperiencePersonMode(ambiguous, 'ar', { isPresent: false }))
      .toBe('neutral');
    expect(validateExperienceCvPerspective(ambiguous, 'ar', { isPresent: false }))
      .toMatchObject({
        ok: false,
        finalPersonMode: 'neutral',
        reason: 'experience_cv_perspective_unproven',
      });
  });

  it('keeps Hindi normalization and English pronoun-free CV style intact', () => {
    const hindi = 'मैं आने वाले माल की जाँच करती हूँ।';
    const hindiNormalized = normalizeExperienceBulletPerspective(hindi, {
      locale: 'hi',
      isPresent: true,
      gender: 'female',
    });
    expect(detectExperiencePersonMode(hindi, 'hi')).toBe('first_singular');
    expect(detectExperiencePersonMode(hindiNormalized, 'hi')).toBe('third_singular');
    expect(hindiNormalized).not.toMatch(/मैं|हूँ/u);

    const english = normalizeExperienceBulletPerspective(
      'I review application changes and document implementation details.',
      { locale: 'en', isPresent: true },
    );
    expect(english).toMatch(/^Review/u);
    expect(validateExperienceCvPerspective(english, 'en').ok).toBe(true);
  });

  it('rejects residual visible first-person before commit and billing', () => {
    const visible = validateVisibleExperienceCoverage({
      sourceDescription: DEVICE_SOURCE,
      visibleText: DEVICE_PROVIDER_1SG,
      targetLocale: 'ar',
      finalNormalizedHash: hashExperienceTextForApply(DEVICE_PROVIDER_1SG),
      isPresent: false,
    });
    let applied = false;
    let usage = 0;
    if (visible.visiblePerspectiveValidationPassed) {
      applied = true;
      usage += 1;
    }
    expect(visible.visiblePersonMode).toBe('first_singular');
    expect(visible.visiblePerspectiveValidationPassed).toBe(false);
    expect(applied).toBe(false);
    expect(usage).toBe(0);
  });
});
