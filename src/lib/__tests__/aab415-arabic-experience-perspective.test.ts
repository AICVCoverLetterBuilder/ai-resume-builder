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
