// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  normalizeArabicExperienceEmploymentGrammar,
  normalizeArabicExperienceEmploymentGrammarWithEvidence,
  validateArabicExperienceEmploymentTense,
  validateArabicExperienceNativeMorphology,
} from '@/lib/cv-arabic-experience-tense';
import {
  normalizeExperienceBulletsPerspective,
  validateExperienceCvPerspective,
} from '@/lib/cv-experience-perspective';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { validateVisibleExperienceCoverage } from '@/lib/cv-experience-phased-apply-329';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  AI_USAGE_STORAGE_KEY,
  getProAiUsageCount,
  recordProAiUserActionSuccess,
} from '@/lib/ai-usage-policy';

const bullets = (lines: string[]) => lines.map((line) => `• ${line}`).join('\n');

const SOURCE_SR = [
  'Izrađivala sam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređivala sam grafike i fotografije za različite projekte.',
  'Usaglašavala sam nacrte i izmene sa članovima projektnog tima.',
].join('\n');

const VALID_DEVICE = bullets([
  'طوّرتْ المفاهيم البصرية وصمّمتْ التخطيطات الخاصة بالمواد الرقمية.',
  'أجرتْ تعديلات على الرسومات والصور لخدمة متطلبات المشاريع المختلفة.',
  'تعاونتْ مع أعضاء فريق المشروع في مراجعة المسودات وإدخال التعديلات اللازمة عليها.',
]);

const MALFORMED_DEVICE = bullets([
  'طوّرتْ المفاهيم البصرية وصمّمتْ التخطيطات الخاصة بالمواد الرقمية.',
  'أجريتْ تعديلات على الرسومات والصور لخدمة متطلبات المشاريع المختلفة.',
  'تعاونتْ مع أعضاء فريق المشروع في مراجعة المسودات وإدخال التعديلات اللازمة عليها.',
]);

const CURRENT_FEMALE = bullets([
  'تطوّر المفاهيم البصرية للمواد الرقمية.',
  'تحرّر الرسومات والصور للمشاريع.',
  'تنسّق المسودات مع فريق المشروع.',
]);

const SOUND_1SG = bullets([
  'طوّرتُ المفاهيم البصرية للمواد الرقمية.',
  'حرّرتُ الرسومات والصور للمشاريع.',
  'نسّقتُ المسودات مع فريق المشروع.',
]);

const SOUND_3FS = bullets([
  'طوّرتْ المفاهيم البصرية للمواد الرقمية.',
  'حرّرتْ الرسومات والصور للمشاريع.',
  'نسّقتْ المسودات مع فريق المشروع.',
]);

const SOURCE_CURRENT_SR = [
  'Priprema vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređuje grafiku i fotografije za različite projekte.',
  'Koordiniše nacrte i izmene sa članovima projektnog tima.',
].join('\n');

function seedUsage(count = 12): void {
  localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    count,
    windowStart: Date.now(),
    policyLimit: 150,
  }));
}

function fixture(options?: { current?: boolean; visible?: string }) {
  const current = options?.current === true;
  const source = current ? SOURCE_CURRENT_SR : SOURCE_SR;
  const experience = {
    id: current ? 'exp-aab421-258601' : 'a221-ar-completed',
    company: 'Rewitu',
    position: 'Grafička dizajnerka',
    startDate: '2019-06',
    endDate: current ? '' : '2023-12',
    isPresent: current,
    description: options?.visible || '',
    originalUserDescription: source,
    canonicalDescription: source,
    descriptionOrigin: 'user',
  } as unknown as WorkExperience;
  const other = {
    id: 'stable-other-entry',
    company: 'Atlas',
    position: 'Laboratorijska tehničarka',
    startDate: '2017-01',
    endDate: '2018-01',
    isPresent: false,
    description: 'Pripremala sam uzorke.\nBeležila sam rezultate.',
  } as WorkExperience;
  const cv = {
    id: 'cv-aab424',
    name: 'AAB 424 morphology source gate',
    personal: {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '',
      address: '',
      jobTitle: 'Grafička dizajnerka',
      gender: 'female',
    },
    summary: '',
    experience: [experience, other],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    contentLocale: options?.visible ? 'ar' : 'sr',
  } as unknown as CVData;
  const operationSnapshot = createExperienceAiOperationSnapshot({
    liveText: experience.description || source,
    authoritativeTextOverride: source,
    provenanceOriginOverride: 'originalUserDescription',
    locale: 'ar',
    requestId: 'req-aab424-ar-morphology',
    jobContextHash: 'job-aab424-ar-morphology',
    experienceEntryId: experience.id,
  });
  return { cv, experience, source, operationSnapshot };
}

function finalizeCandidate(candidate: string, options?: {
  current?: boolean;
  visible?: string;
  originHint?: 'ai_generated' | 'ai_repaired';
  noOpRepairAttempted?: boolean;
}) {
  const f = fixture({ current: options?.current, visible: options?.visible });
  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'ar',
    sourceLocale: 'sr',
    gender: 'female',
    experienceId: f.experience.id,
    candidate,
    originHint: options?.originHint || 'ai_generated',
    noOpRepairAttempted: options?.noOpRepairAttempted,
    cv: f.cv,
    operationSnapshot: f.operationSnapshot,
  });
  return { ...f, finalized };
}

describe('AAB-424 Arabic completed native morphology source gate', () => {
  beforeEach(() => {
    localStorage.clear();
    seedUsage();
  });

  it('accepts regular/sound feminine completed normalization', () => {
    const normalized = normalizeExperienceBulletsPerspective(SOUND_1SG, {
      locale: 'ar', isPresent: false, gender: 'female', sourceDescription: SOURCE_SR,
      sourceLocale: 'sr',
    });
    expect(normalized.text).toBe(SOUND_3FS);
    expect(normalized.arabicNativeMorphologyValidationPassed).toBe(true);
    expect(normalized.arabicMorphologyTransformationClasses).toContain('sound');
  });

  it('accepts correct weak/stem-changing feminine target forms', () => {
    expect(validateArabicExperienceNativeMorphology(VALID_DEVICE, {
      isPresent: false, gender: 'female',
    })).toMatchObject({ ok: true, morphologyValidationPassed: true });
    expect(validateArabicExperienceEmploymentTense(VALID_DEVICE, {
      isPresent: false, gender: 'female',
    }).finalTensePassed).toBe(true);
  });

  it('never synthesizes أجريتْ from أجريتُ', () => {
    const result = normalizeArabicExperienceEmploymentGrammarWithEvidence(
      'أجريتُ تعديلات على الرسومات.',
      { isPresent: false, gender: 'female' },
    );
    expect(result.text).toContain('أجريتُ');
    expect(result.text).not.toContain('أجريتْ');
    expect(result).toMatchObject({
      morphologyValidationPassed: false,
      transformationApplied: false,
      reason: 'arabic_past_morphology_transformation_unproven',
    });
    expect(result.transformationClasses).toContain('weak_final_unproven');
  });

  it.each([
    ['قلتُ الملاحظات.', 'قلتْ', 'hollow_or_irregular_unproven'],
    ['كنتُ أراجع المسودات.', 'كنتْ', 'hollow_or_irregular_unproven'],
  ] as const)('fails closed instead of mechanically producing %s → %s', (
    source,
    malformed,
    transformationClass,
  ) => {
    const result = normalizeArabicExperienceEmploymentGrammarWithEvidence(source, {
      isPresent: false, gender: 'female',
    });
    expect(result.text).toContain(source.split(/\s/u)[0]);
    expect(result.text).not.toContain(malformed);
    expect(result.morphologyValidationPassed).toBe(false);
    expect(result.transformationClasses).toContain(transformationClass);
  });

  it('accepts valid masculine weak/hollow/irregular completed surfaces', () => {
    const male = bullets([
      'أجرى تعديلات على الرسومات.',
      'قال الملاحظات للفريق.',
      'كان مسؤولاً عن مراجعة المسودات.',
    ]);
    expect(validateArabicExperienceNativeMorphology(male, {
      isPresent: false, gender: 'male',
    }).ok).toBe(true);
    expect(validateExperienceCvPerspective(male, 'ar', { isPresent: false }).ok).toBe(true);
  });

  it('keeps strict current-role present morphology unchanged', () => {
    expect(normalizeArabicExperienceEmploymentGrammar(CURRENT_FEMALE, {
      isPresent: true, gender: 'female',
    })).toBe(CURRENT_FEMALE);
    expect(validateArabicExperienceEmploymentTense(CURRENT_FEMALE, {
      isPresent: true, gender: 'female',
    }).finalTensePassed).toBe(true);
  });

  it('keeps present/past employment negative controls strict', () => {
    expect(validateArabicExperienceEmploymentTense(CURRENT_FEMALE, {
      isPresent: false, gender: 'female',
    }).finalTensePassed).toBe(false);
    expect(validateArabicExperienceEmploymentTense(SOUND_3FS, {
      isPresent: true, gender: 'female',
    }).finalTensePassed).toBe(false);
  });

  it('treats optional marks consistently for safe sound morphology', () => {
    const marked = normalizeArabicExperienceEmploymentGrammar('كتبتُ الملاحظات.', {
      isPresent: false, gender: 'female',
    });
    const unmarked = normalizeArabicExperienceEmploymentGrammar('كتبت الملاحظات.', {
      isPresent: false, gender: 'female',
    });
    expect(marked).toBe('كتبتْ الملاحظات.');
    expect(unmarked).toBe('كتبت الملاحظات.');
    expect(validateArabicExperienceNativeMorphology(marked, {
      isPresent: false, gender: 'female',
    }).ok).toBe(true);
    expect(validateArabicExperienceNativeMorphology(unmarked, {
      isPresent: false, gender: 'female',
    }).ok).toBe(true);
  });

  it.each(['ai_generated', 'ai_repaired'] as const)(
    'rejects malformed %s candidate at the shared Arabic native morphology boundary',
    (originHint) => {
      const { finalized } = finalizeCandidate(MALFORMED_DEVICE, {
        originHint,
        noOpRepairAttempted: originHint === 'ai_repaired',
      });
      expect(finalized.text).not.toContain('أجريتْ');
      if (finalized.countedAsSuccess) {
        expect(validateArabicExperienceNativeMorphology(finalized.text, {
          isPresent: false, gender: 'female',
        }).ok).toBe(true);
      }
      expect(JSON.stringify(finalized.diagnostics)).toContain('arabic_native');
      expect(finalized.diagnostics).toMatchObject({
        targetPersonMode: 'third_singular',
        targetGender: 'female',
        providerRejectionStage: 'provider:arabic_native_morphology',
        providerRejectionReason: 'arabic_native_past_surface_unproven',
      });
      if (originHint === 'ai_repaired') {
        expect(finalized.diagnostics?.noOpRepairAttempted).toBe(true);
        expect(finalized.diagnostics?.noOpRepairApplied).not.toBe(true);
      }
    },
  );

  it('accepts a correct deterministic/final-selected Arabic candidate', () => {
    const normalized = normalizeExperienceBulletsPerspective(VALID_DEVICE, {
      locale: 'ar', isPresent: false, gender: 'female', sourceDescription: SOURCE_SR,
      sourceLocale: 'sr',
    });
    expect(normalized.arabicNativeMorphologyValidationPassed).toBe(true);
    expect(normalized.perspectiveValidationPassed).toBe(true);
    expect(validateArabicExperienceNativeMorphology(normalized.text, {
      isPresent: false, gender: 'female',
    }).ok).toBe(true);
  });

  it.each([
    'provider',
    'no_op_repair',
    'unsupported_claim_repair',
    'deterministic_fallback',
    'final_selected',
  ])('applies the same native morphology rejection to %s candidates', () => {
    expect(validateArabicExperienceNativeMorphology(MALFORMED_DEVICE, {
      isPresent: false,
      gender: 'female',
    })).toMatchObject({
      ok: false,
      morphologyValidationPassed: false,
      reason: 'arabic_native_past_surface_unproven',
    });
  });

  it('rejects the exact malformed visible post-write surface independently', () => {
    const visible = validateVisibleExperienceCoverage({
      sourceDescription: SOURCE_SR,
      visibleText: MALFORMED_DEVICE,
      targetLocale: 'ar',
      finalNormalizedHash: 'not-the-visible-hash',
      isPresent: false,
    });
    expect(visible.visibleNativeMorphologyValidationPassed).toBe(false);
    expect(visible.visiblePerspectiveValidationPassed).toBe(false);
  });

  it('keeps malformed morphology non-billable and non-applicable', () => {
    const f = fixture();
    const blocked = {
      blocked: true,
      reason: 'arabic_native_past_surface_unproven',
      text: MALFORMED_DEVICE,
      origin: 'ai_repaired' as const,
      roleDutyConflict: false,
      countedAsSuccess: false,
      diagnostics: {
        arabicNativeMorphologyValidationPassed: false,
        canonicalExperienceDecisionAllowsApply: false,
        canonicalExperienceDecisionAllowsUsage: false,
      },
    };
    const after = applyFinalizedBulletsToCv(f.cv, 'ar', f.experience.id, blocked);
    expect(after).toBe(f.cv);
    expect(getProAiUsageCount()).toBe(12);
  });

  it('allows one genuine grounded, grammatically valid material improvement', () => {
    const incomplete = bullets([
      'طوّرتْ المفاهيم البصرية وصمّمتْ التخطيطات الخاصة بالمواد الرقمية.',
      'أجرتْ تعديلات على الرسومات والصور لخدمة متطلبات المشاريع المختلفة.',
    ]);
    const { cv, experience, finalized } = finalizeCandidate(VALID_DEVICE, {
      visible: incomplete,
    });
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.diagnostics).toMatchObject({
      finalDecisionKind: 'material_improvement',
      materialImprovementDetected: true,
      canonicalExperienceDecisionAllowsApply: true,
      canonicalExperienceDecisionAllowsUsage: true,
      arabicNativeMorphologyValidationPassed: true,
    });
    const after = applyFinalizedBulletsToCv(cv, 'ar', experience.id, finalized);
    expect(after).not.toBe(cv);
    if (finalized.countedAsSuccess) recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(13);
  });

  it('preserves the AAB-423 a221 3/3 predicate bridge with zero added actions', () => {
    const scan = scanGenericExperiencePredicates(SOURCE_SR, VALID_DEVICE, {
      allowValidatedCrossScriptBridge: true,
    });
    expect(scan).toMatchObject({
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
    });
  });

  it('preserves the AAB-422 current semantic no-op as +0', () => {
    const { finalized } = finalizeCandidate(CURRENT_FEMALE, {
      current: true,
      visible: CURRENT_FEMALE,
    });
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.diagnostics?.finalDecisionKind).toBe('semantic_noop');
    expect(finalized.diagnostics?.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(getProAiUsageCount()).toBe(12);
  });

  it('preserves stable entry targeting and transactional no-write behavior', () => {
    const { cv, experience } = fixture();
    const otherBefore = cv.experience[1]!.description;
    const after = applyFinalizedBulletsToCv(cv, 'ar', experience.id, {
      blocked: true,
      reason: 'arabic_native_past_surface_unproven',
      text: MALFORMED_DEVICE,
      origin: 'ai_repaired',
      roleDutyConflict: false,
      countedAsSuccess: false,
    });
    expect(after).toBe(cv);
    expect(after.experience[1]!.description).toBe(otherBefore);
    expect(getProAiUsageCount()).toBe(12);
  });
});
