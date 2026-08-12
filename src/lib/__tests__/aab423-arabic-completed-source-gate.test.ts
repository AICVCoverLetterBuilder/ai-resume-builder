/**
 * @vitest-environment jsdom
 *
 * AAB-423 source gate only: real-device-equivalent Arabic completed-role
 * validation and the shared semantic-noop/material-improvement contract.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import {
  detectArabicExperiencePersonMode,
  validateArabicExperienceEmploymentTense,
} from '@/lib/cv-arabic-experience-tense';
import { validateExperienceCvPerspective } from '@/lib/cv-experience-perspective';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import {
  decideExperienceCanonicalPreapply,
  evaluateExperienceVisibleComparison,
} from '@/lib/cv-experience-visible-noop-authority';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { hashExperienceEntryId } from '@/lib/cv-experience-entry-isolation';
import {
  AI_USAGE_STORAGE_KEY,
  getProAiUsageCount,
  recordProAiUserActionSuccess,
} from '@/lib/ai-usage-policy';

const ENTRY_ID = 'a221-ar-completed';
const SOURCE_SR = [
  'Izrađivala sam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređivala sam grafike i fotografije za različite projekte.',
  'Usaglašavala sam nacrte i izmene sa članovima projektnog tima.',
].join('\n');
const SOURCE_SR_CURRENT = [
  'Priprema vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređuje grafiku i fotografije za različite projekte.',
  'Koordiniše nacrte i izmene sa članovima projektnog tima.',
].join('\n');
const bullets = (lines: string[]) => lines.map((line) => `• ${line}`).join('\n');
const VISIBLE_COMPLETED = bullets([
  'أعدّتْ المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'حرّرتْ الرسومات والصور لمختلف المشاريع.',
  'نسّقتْ المسودات والتعديلات مع أعضاء فريق المشروع.',
]);
const COMPLETED_NO_MARKS = bullets([
  'أعدت المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'حررت الرسومات والصور لمختلف المشاريع.',
  'نسقت المسودات والتعديلات مع أعضاء فريق المشروع.',
]);
const COMPLETED_MALE = bullets([
  'صمم واجهات بصرية للمنتج.',
  'حرر الرسومات والصور للمشروع.',
  'نسق المسودات مع فريق المشروع.',
]);
const CURRENT_FEMALE = bullets([
  'تكتب واجهات برمجية لخدمات المنتج.',
  'تختبر المكونات باستخدام اختبارات آلية.',
  'توثق قرارات التنفيذ لفريق الهندسة.',
]);
const CURRENT_MALE = bullets([
  'يكتب واجهات برمجية لخدمات المنتج.',
  'يختبر المكونات باستخدام اختبارات آلية.',
  'يوثق قرارات التنفيذ لفريق الهندسة.',
]);
const FALLBACK_COMPLETED = bullets([
  'أعدّت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
  'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
  'أعدّت ملفات التصميم النهائية وضبطت الصيغ لشاشات مختلفة.',
]);

function seedUsage(count = 12): void {
  localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    count,
    windowStart: Date.now(),
    policyLimit: 150,
  }));
}

function fixture(options?: {
  id?: string;
  source?: string;
  visible?: string;
  isPresent?: boolean;
  withOtherEntry?: boolean;
}): { cv: CVData; experience: WorkExperience } {
  const id = options?.id || ENTRY_ID;
  const source = options?.source ?? SOURCE_SR;
  const visible = options?.visible ?? VISIBLE_COMPLETED;
  const isPresent = options?.isPresent === true;
  const provenance = visible ? buildExperienceAiOutputProvenance({
    experienceEntryId: id,
    appliedOutput: visible,
    preAiFactText: source,
    sourceLocale: 'sr',
    targetLocale: 'ar',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'pre_ai_snapshot',
  }) : undefined;
  const experience = {
    id,
    company: 'Rewitu',
    position: 'Grafička dizajnerka',
    startDate: '2019-06',
    endDate: isPresent ? '' : '2023-12',
    isPresent,
    description: visible,
    originalUserDescription: source,
    canonicalDescription: source,
    generatedDescription: visible,
    descriptionOrigin: visible ? 'ai_generated' : 'user',
    contentLocale: visible ? 'ar' : 'sr',
    generatedLocale: visible ? 'ar' : undefined,
    aiOutputProvenance: provenance,
  } as unknown as WorkExperience;
  const other = {
    id: 'other-entry-stable',
    company: 'Atlas',
    position: 'Laboratorijska tehničarka',
    startDate: '2017-01',
    endDate: '2018-01',
    isPresent: false,
    description: 'Pripremala sam uzorke.\nBeležila sam rezultate.',
    originalUserDescription: 'Pripremala sam uzorke.\nBeležila sam rezultate.',
    descriptionOrigin: 'user',
  } as WorkExperience;
  return {
    experience,
    cv: {
      id: 'cv-aab423',
      name: 'AAB 423 source gate',
      personal: {
        fullName: 'Test User',
        email: 'test@example.com',
        phone: '',
        address: '',
        jobTitle: 'Grafička dizajnerka',
        gender: 'female',
      },
      summary: '',
      experience: options?.withOtherEntry ? [experience, other] : [experience],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
      contentLocale: visible ? 'ar' : 'sr',
    } as unknown as CVData,
  };
}

function snapshot(exp: WorkExperience, source: string, requestId: string) {
  return createExperienceAiOperationSnapshot({
    liveText: exp.description || '',
    authoritativeTextOverride: source,
    provenanceOriginOverride: source ? 'originalUserDescription' : undefined,
    locale: 'ar',
    requestId,
    jobContextHash: 'aab423-arabic-completed',
    experienceEntryId: exp.id,
  });
}

function finalize(options?: {
  source?: string;
  visible?: string;
  candidate?: string;
  isPresent?: boolean;
  id?: string;
  withOtherEntry?: boolean;
}) {
  const source = options?.source ?? SOURCE_SR;
  const { cv, experience } = fixture({
    id: options?.id,
    source,
    visible: options?.visible,
    isPresent: options?.isPresent,
    withOtherEntry: options?.withOtherEntry,
  });
  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'ar',
    sourceLocale: source ? 'sr' : undefined,
    gender: 'female',
    experienceId: experience.id,
    candidate: options?.candidate ?? VISIBLE_COMPLETED,
    cv,
    operationSnapshot: snapshot(experience, source, `aab423-${experience.id}`),
  });
  return { cv, experience, finalized };
}

describe('AAB-423 Arabic completed Experience source gate A–O', () => {
  beforeEach(() => {
    localStorage.clear();
    seedUsage();
  });

  it('A — recognizes arbitrary diacritized feminine completed predicates', () => {
    expect(validateArabicExperienceEmploymentTense(VISIBLE_COMPLETED, {
      isPresent: false,
      gender: 'female',
    })).toMatchObject({ finalTensePassed: true, finalGenderAgreementPassed: true });
    expect(detectArabicExperiencePersonMode(VISIBLE_COMPLETED, { isPresent: false }))
      .toBe('third_singular');
  });

  it('B — recognizes the same feminine completed morphology without optional marks', () => {
    expect(validateArabicExperienceEmploymentTense(COMPLETED_NO_MARKS, {
      isPresent: false,
      gender: 'female',
    })).toMatchObject({ finalTensePassed: true, finalGenderAgreementPassed: true });
    expect(validateExperienceCvPerspective(COMPLETED_NO_MARKS, 'ar', { isPresent: false }).ok)
      .toBe(true);
  });

  it('C — recognizes arbitrary masculine completed predicates', () => {
    expect(validateArabicExperienceEmploymentTense(COMPLETED_MALE, {
      isPresent: false,
      gender: 'male',
    })).toMatchObject({ finalTensePassed: true, finalGenderAgreementPassed: true });
  });

  it('D — preserves feminine and masculine current-role recognition', () => {
    expect(validateArabicExperienceEmploymentTense(CURRENT_FEMALE, {
      isPresent: true,
      gender: 'female',
    }).finalTensePassed).toBe(true);
    expect(validateArabicExperienceEmploymentTense(CURRENT_MALE, {
      isPresent: true,
      gender: 'male',
    }).finalTensePassed).toBe(true);
  });

  it('E — rejects present-only morphology for a completed role', () => {
    expect(validateArabicExperienceEmploymentTense(CURRENT_FEMALE, {
      isPresent: false,
      gender: 'female',
    })).toMatchObject({
      finalTensePassed: false,
      reason: 'arabic_completed_role_present_tense',
    });
  });

  it('F — rejects past-only morphology for a current role', () => {
    expect(validateArabicExperienceEmploymentTense(COMPLETED_NO_MARKS, {
      isPresent: true,
      gender: 'female',
    })).toMatchObject({
      finalTensePassed: false,
      reason: 'arabic_employment_tense_mismatch',
    });
  });

  it('G — maps Serbian actions to Arabic completed predicates 3/3 with zero additions', () => {
    const scan = scanGenericExperiencePredicates(SOURCE_SR, FALLBACK_COMPLETED, {
      allowValidatedCrossScriptBridge: true,
    });
    expect(scan).toMatchObject({
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
      reason: null,
    });
  });

  it('H — still rejects a genuine fourth Arabic action', () => {
    const scan = scanGenericExperiencePredicates(
      SOURCE_SR,
      `${FALLBACK_COMPLETED}\n• أدارتْ ميزانية المشروع.`,
    );
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(scan.candidateAddedPredicateCount).toBeGreaterThan(0);
    expect(scan.reason).toBe('generic_experience_predicate_added_action');
    const replacement = scanGenericExperiencePredicates(SOURCE_SR, bullets([
      'أعدّت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
      'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
      'أدارتْ ميزانية المشروع.',
    ]));
    expect(replacement.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(replacement.candidateAddedPredicateCount).toBeGreaterThan(0);
  });

  it('I — exact a221-equivalent valid unedited completed output is independently validated no-op +0', () => {
    const { cv, finalized } = finalize({ withOtherEntry: true });
    const d = finalized.diagnostics || {};
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.text).toBe(VISIBLE_COMPLETED);
    expect(d).toMatchObject({
      uneditedRerunDetected: true,
      earlyNoOpPreflightPassed: true,
      visibleRequiredFactCount: 3,
      visibleCoveredFactCount: 3,
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
      tenseValidationPassed: true,
      finalEmploymentState: 'completed',
      finalPersonMode: 'third_singular',
      perspectiveValidationPassed: true,
      targetLocalePurityPassed: true,
      unsupportedClaimCount: 0,
      crossEntryLeakageDetected: false,
      semanticNoOpDetected: true,
      finalDecisionKind: 'semantic_noop',
      shouldApply: false,
      shouldIncrementUsage: false,
    });
    expect(applyFinalizedBulletsToCv(cv, 'ar', ENTRY_ID, finalized)).toBe(cv);
    expect(getProAiUsageCount()).toBe(12);
  });

  it('J — a real completed-role missing-duty restoration applies once and bills +1', () => {
    const incomplete = bullets([
      'أعدّتْ المفاهيم البصرية والتخطيطات للمواد الرقمية.',
      'حرّرتْ الرسومات والصور لمختلف المشاريع.',
    ]);
    const evaluation = evaluateExperienceVisibleComparison({
      factAuthorityText: SOURCE_SR,
      visibleComparisonText: incomplete,
      candidateText: VISIBLE_COMPLETED,
      locale: 'ar',
      isPresent: false,
      visibleComparisonProvenance: 'ai_generated_unedited',
      matchedLastAiOutput: true,
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
    });
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: true,
      semanticNoOpDetected: evaluation.semanticNoOpDetected,
      materialImprovementDetected: evaluation.materialImprovementDetected,
      materialImprovementKinds: evaluation.materialImprovementKinds,
    });
    expect(decision.finalDecisionKind).toBe('material_improvement');
    expect(decision.shouldApply).toBe(true);
    expect(decision.shouldIncrementUsage).toBe(true);
    const { cv, finalized } = finalize({
      visible: incomplete,
      candidate: VISIBLE_COMPLETED,
    });
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.diagnostics?.finalDecisionKind).toBe('material_improvement');
    expect(finalized.diagnostics?.canonicalExperienceDecisionAllowsApply).toBe(true);
    const applied = applyFinalizedBulletsToCv(cv, 'ar', ENTRY_ID, finalized);
    expect(applied).not.toBe(cv);
    expect(applied.experience[0]?.description).toBe(VISIBLE_COMPLETED);
    if (finalized.countedAsSuccess) recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(13);
  });

  it('K — empty-source Arabic completed generation remains a +1 material operation', () => {
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: false,
      semanticNoOpDetected: false,
      materialImprovementDetected: false,
      materialImprovementKinds: [],
      allowMaterialApplyWithoutVisibleComparison: true,
    });
    expect(validateArabicExperienceEmploymentTense(COMPLETED_NO_MARKS, {
      isPresent: false,
      gender: 'female',
    }).finalTensePassed).toBe(true);
    expect(decision).toMatchObject({
      finalDecisionKind: 'material_improvement',
      shouldApply: true,
      shouldIncrementUsage: true,
    });
  });

  it.each([
    ['provider', VISIBLE_COMPLETED, false],
    ['repair', COMPLETED_NO_MARKS, false],
    ['deterministic fallback', FALLBACK_COMPLETED, true],
  ] as const)('L — %s uses the same completed tense/predicate contract', (
    _stage,
    candidate,
    deterministic,
  ) => {
    const tense = validateArabicExperienceEmploymentTense(candidate, {
      isPresent: false,
      gender: 'female',
    });
    const predicate = scanGenericExperiencePredicates(SOURCE_SR, candidate, {
      allowValidatedCrossScriptBridge: deterministic,
    });
    expect(tense.finalTensePassed).toBe(true);
    expect(predicate.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(predicate.candidateAddedPredicateCount).toBe(0);
  });

  it('M — the AAB-422 90ceb current-role semantic no-op remains +0', () => {
    const currentVisible = bullets([
      'تُعِدّ المفاهيم البصرية والتخطيطات للمواد الرقمية.',
      'تُحرِّر الرسومات والصور لمختلف المشاريع.',
      'تُنسِّق المسودات والتعديلات مع أعضاء فريق المشروع.',
    ]);
    const { finalized } = finalize({
      id: 'exp-aab421-258601',
      source: SOURCE_SR_CURRENT,
      visible: currentVisible,
      candidate: currentVisible,
      isPresent: true,
    });
    expect(hashExperienceEntryId('exp-aab421-258601'))
      .toBe('fnv1a_90ceb7d_l17_b101_e49');
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.diagnostics?.finalDecisionKind).toBe('semantic_noop');
    expect(finalized.diagnostics?.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(getProAiUsageCount()).toBe(12);
  });

  it('N — stable entry targeting preserves the non-target entry and no-op performs no write', () => {
    const { cv, experience, finalized } = finalize({ withOtherEntry: true });
    const otherBefore = cv.experience[1]!.description;
    expect(finalized.diagnostics?.selectedExperienceEntryIdHash)
      .toBe(hashExperienceEntryId(experience.id));
    const after = applyFinalizedBulletsToCv(cv, 'ar', experience.id, finalized);
    expect(after).toBe(cv);
    expect(after.experience[1]!.description).toBe(otherBefore);
    expect(getProAiUsageCount()).toBe(12);
  });

  it.each([
    ['software', bullets(['طورت خدمات التطبيق.', 'اختبرت واجهات النظام.', 'وثقت قرارات التنفيذ.'])],
    ['healthcare', bullets(['فحصت سجلات المرضى.', 'راجعت خطط الرعاية.', 'نسقت المواعيد الطبية.'])],
    ['operations', bullets(['حللت بيانات التشغيل.', 'راجعت تقارير الأداء.', 'نسقت أنشطة الفريق.'])],
  ])('O — %s completed morphology is occupation-agnostic', (_occupation, text) => {
    expect(validateArabicExperienceEmploymentTense(text, {
      isPresent: false,
      gender: 'female',
    }).finalTensePassed).toBe(true);
    expect(validateExperienceCvPerspective(text, 'ar', { isPresent: false }).ok)
      .toBe(true);
  });
});
