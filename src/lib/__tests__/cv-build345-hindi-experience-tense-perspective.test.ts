/**
 * @vitest-environment jsdom
 *
 * AAB-345 follow-up: Hindi Experience present-tense + CV perspective contract.
 * Device regression: first-person हूँ must not pass as neutral; past थी for
 * current employment must not be accepted as ai_generated.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  detectHindiExperiencePersonMode,
  detectExperiencePersonMode,
  normalizeHindiExperiencePerspective,
} from '@/lib/cv-experience-perspective';
import {
  buildHindiCookingExperienceFallback,
  HINDI_COOKING_EXPERIENCE_FALLBACK_344_REVISION,
  sourceRequiresHindiWarehouseFactCoverage,
} from '@/lib/cv-hindi-experience-grounding';
import { sourceHasWarehouseDomainApplicability } from '@/lib/cv-warehouse-domain-applicability';
import { validateCurrentRoleTenseMix } from '@/lib/cv-semantic-fidelity';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';

const REF = '2026-07-20T12:00:00.000Z';

export const DEVICE_COOK_EN_UNITS = [
  'Prepares meals and dishes.',
  'Maintains hygiene and cleanliness in the kitchen.',
  'Coordinates with kitchen colleagues during food preparation.',
] as const;

export const DEVICE_COOK_EN = DEVICE_COOK_EN_UNITS.join('\n');

/** Exact AAB 345 accepted provider (first-person singular present). */
export const DEVICE_COOK_HI_1SG_PROVIDER_UNITS = [
  'भोजन और व्यंजन तैयार करती हूँ।',
  'रसोई में स्वच्छता और साफ-सफाई बनाए रखती हूँ।',
  'खाना बनाने के दौरान रसोई के सहयोगियों के साथ समन्वय करती हूँ।',
] as const;

export const DEVICE_COOK_HI_1SG_PROVIDER = formatExperienceBullets([
  ...DEVICE_COOK_HI_1SG_PROVIDER_UNITS,
]);

export const DEVICE_COOK_HI_FEMALE_CURRENT_UNITS = [
  'भोजन और व्यंजन तैयार करती हैं।',
  'रसोई में स्वच्छता और साफ-सफाई बनाए रखती हैं।',
  'भोजन की तैयारी के दौरान रसोई के सहकर्मियों के साथ समन्वय करती हैं।',
] as const;

export const DEVICE_COOK_HI_FEMALE_CURRENT = formatExperienceBullets([
  ...DEVICE_COOK_HI_FEMALE_CURRENT_UNITS,
]);

const DEVICE_COOK_HI_MALE_CURRENT = formatExperienceBullets([
  'भोजन और व्यंजन तैयार करते हैं।',
  'रसोई में स्वच्छता और साफ-सफाई बनाए रखते हैं।',
  'भोजन की तैयारी के दौरान रसोई के सहकर्मियों के साथ समन्वय करते हैं।',
]);

const DEVICE_COOK_HI_PAST_FEMALE = formatExperienceBullets([
  'भोजन और व्यंजन तैयार करती थी।',
  'रसोई में स्वच्छता और साफ-सफाई बनाए रखती थी।',
  'भोजन की तैयारी के दौरान रसोई के सहकर्मियों के साथ समन्वय करती थी।',
]);

const DEVICE_COOK_HI_PAST_MALE = formatExperienceBullets([
  'भोजन और व्यंजन तैयार करता था।',
  'रसोई में स्वच्छता और साफ-सफाई बनाए रखता था।',
  'भोजन की तैयारी के दौरान रसोई के सहकर्मियों के साथ समन्वय करता था।',
]);

const ATLAS_WAREHOUSE_EN = [
  'Checks incoming goods.',
  'Checks related documents.',
  'Coordinates preparation and movement of goods with colleagues.',
].join('\n');

const DESIGN_EN = [
  'Creates visual materials and graphic elements.',
  'Reviews and adapts design materials.',
  'Coordinates design handoffs with colleagues during preparation.',
].join('\n');

const FREE_TEXT_OCCUPATION_EN = [
  'Answers customer questions by phone.',
  'Resolves complaints according to internal procedures.',
  'Coordinates with other teams to escalate requests.',
].join('\n');

function cookCurrentCv(options?: {
  description?: string;
  gender?: string;
  isPresent?: boolean;
  endDate?: string;
}): CVData {
  const description = options?.description ?? DEVICE_COOK_EN;
  const isPresent = options?.isPresent !== false;
  const cook: WorkExperience = {
    id: 'exp-cook-2',
    company: 'Test Kitchen',
    position: 'Cook',
    startDate: '2022-03',
    endDate: isPresent ? '' : (options?.endDate || '2024-06'),
    isPresent,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'structured_canonical',
  };
  const prior: WorkExperience = {
    id: 'exp-prior-0',
    company: 'Prior Co',
    position: 'Assistant',
    startDate: '2018-01',
    endDate: '2020-01',
    isPresent: false,
    description: 'Supported daily operations.',
  };
  const mid: WorkExperience = {
    id: 'exp-mid-1',
    company: 'Mid Co',
    position: 'Helper',
    startDate: '2020-02',
    endDate: '2022-02',
    isPresent: false,
    description: 'Assisted with service tasks.',
  };
  return {
    personal: {
      fullName: 'Device Cook',
      email: 'cook@example.com',
      phone: '',
      location: '',
      jobTitle: 'Cook',
      gender: options?.gender ?? 'female',
    },
    summary: '',
    experience: [prior, mid, cook],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
    sectionOrder: [],
    theme: 'classic',
    locale: 'hi',
  } as unknown as CVData;
}

function finalizeCookHi(
  candidate: string,
  extras?: {
    gender?: string;
    isPresent?: boolean;
    description?: string;
    experienceId?: string;
  },
) {
  const cv = cookCurrentCv({
    gender: extras?.gender,
    isPresent: extras?.isPresent,
    description: extras?.description,
  });
  const experienceId = extras?.experienceId ?? 'exp-cook-2';
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'hi',
    gender: (extras?.gender as 'female' | 'male' | 'unspecified') || 'female',
    cv,
    candidate,
    experienceId,
    industry: 'hospitality',
    level: 'mid',
    referenceDateIso: REF,
    operationSnapshot: createExperienceAiOperationSnapshot({
      liveText: extras?.description ?? DEVICE_COOK_EN,
      locale: 'hi',
      requestId: 'req-cook-345',
      jobContextHash: 'job-cook-345',
      experienceEntryId: experienceId,
      authoritativeTextOverride: extras?.description ?? DEVICE_COOK_EN,
      provenanceOriginOverride: 'currentTextarea',
    }),
    currentTextareaProvenance: 'structured_canonical',
    authoritativeFactSourceKind: 'canonical',
    currentTextareaUsedForFactExtraction: true,
    lastAiOutputHashMatched: false,
    materialUserEditDetected: false,
  });
}

function finalizeRoleHi(options: {
  description: string;
  candidate: string;
  position: string;
  industry?: string;
  gender?: string;
  isPresent?: boolean;
  experienceId?: string;
}) {
  const isPresent = options.isPresent !== false;
  const id = options.experienceId ?? 'exp-role-0';
  const entry: WorkExperience = {
    id,
    company: 'Employer',
    position: options.position,
    startDate: '2021-01',
    endDate: isPresent ? '' : '2024-01',
    isPresent,
    description: options.description,
    originalUserDescription: options.description,
    canonicalDescription: options.description,
    descriptionOrigin: 'structured_canonical',
  };
  const cv = {
    personal: {
      fullName: 'Role Worker',
      email: 'r@example.com',
      phone: '',
      location: '',
      jobTitle: options.position,
      gender: options.gender ?? 'female',
    },
    summary: '',
    experience: [entry],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    locale: 'hi',
  } as unknown as CVData;
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'hi',
    gender: (options.gender as 'female' | 'male' | 'unspecified') || 'female',
    cv,
    candidate: options.candidate,
    experienceId: id,
    industry: options.industry,
    level: 'mid',
    referenceDateIso: REF,
    operationSnapshot: createExperienceAiOperationSnapshot({
      liveText: options.description,
      locale: 'hi',
      requestId: `req-345-${options.position}`,
      jobContextHash: `job-345-${options.position}`,
      experienceEntryId: id,
      authoritativeTextOverride: options.description,
      provenanceOriginOverride: 'currentTextarea',
    }),
    currentTextareaProvenance: 'structured_canonical',
    authoritativeFactSourceKind: 'canonical',
    currentTextareaUsedForFactExtraction: true,
    lastAiOutputHashMatched: false,
    materialUserEditDetected: false,
  });
}

beforeEach(() => {
  clearExperienceAiDiagnosticsForTests();
  localStorage.clear();
});

describe('AAB-345 Hindi person-mode detector + normalization', () => {
  it('A–C. detects 1sg हूँ and normalizes to honorific हैं', () => {
    expect(detectHindiExperiencePersonMode(DEVICE_COOK_HI_1SG_PROVIDER)).toBe('first_singular');
    expect(detectExperiencePersonMode(DEVICE_COOK_HI_1SG_PROVIDER, 'hi')).toBe('first_singular');
    const normalized = normalizeHindiExperiencePerspective(DEVICE_COOK_HI_1SG_PROVIDER);
    expect(normalized).toMatch(/तैयार करती हैं/);
    expect(normalized).toMatch(/बनाए रखती हैं/);
    expect(normalized).toMatch(/समन्वय करती हैं/);
    expect(normalized).not.toMatch(/हूँ|हूं/);
    expect(detectHindiExperiencePersonMode(normalized)).toBe('third_singular');
  });

  it('detects third-person/honorific present and past auxiliaries', () => {
    expect(detectHindiExperiencePersonMode(DEVICE_COOK_HI_FEMALE_CURRENT)).toBe('third_singular');
    expect(detectHindiExperiencePersonMode(DEVICE_COOK_HI_PAST_FEMALE)).not.toBe('first_singular');
    expect(validateCurrentRoleTenseMix(DEVICE_COOK_HI_PAST_FEMALE, 'hi', true).length).toBeGreaterThan(0);
    expect(validateCurrentRoleTenseMix(DEVICE_COOK_HI_FEMALE_CURRENT, 'hi', true)).toEqual([]);
  });
});

describe('AAB-345 Cook 1sg provider → normalize → commit', () => {
  it('A–H, M–P. normalizes provider, keeps 3/3, no missing_fact_restored, usage +1', () => {
    expect(HINDI_COOKING_EXPERIENCE_FALLBACK_344_REVISION).toBe(
      'hindi-cooking-experience-fallback-344-v1',
    );
    expect(sourceHasWarehouseDomainApplicability(DEVICE_COOK_EN, {
      position: 'Cook',
      industry: 'hospitality',
    })).toBe(false);
    expect(sourceRequiresHindiWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);

    const fin = finalizeCookHi(DEVICE_COOK_HI_1SG_PROVIDER);
    expect(fin.blocked).toBe(false);
    expect(fin.diagnostics?.providerPersonMode).toBe('first_singular');
    expect(fin.diagnostics?.normalizedPersonMode).toBe('third_singular');
    expect(fin.diagnostics?.finalPersonMode).toBe('third_singular');
    expect(fin.diagnostics?.perspectiveMode).toBe('cv_third_person');
    expect(fin.diagnostics?.perspectiveNormalizationAttempted).toBe(true);
    expect(fin.diagnostics?.perspectiveNormalizationApplied).toBe(true);
    expect(fin.diagnostics?.perspectiveValidationPassed).toBe(true);
    expect(fin.diagnostics?.normalizedBulletsUsedForApply).toBe(true);
    expect(fin.diagnostics?.finalMatchesProviderOutput).toBe(false);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount ?? 0)).toBe(0);
    expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
    expect(fin.diagnostics?.expectedEmploymentTense).toBe('present');
    expect(fin.text).toMatch(/तैयार करती हैं/);
    expect(fin.text).toMatch(/बनाए रखती हैं/);
    expect(fin.text).toMatch(/समन्वय करती हैं/);
    expect(fin.text).not.toMatch(/हूँ|हूं|थी|था|थे|गोदाम|डिज़ाइन|hi_wh_/);
    expect(JSON.stringify(fin.diagnostics || {})).not.toMatch(/hi_wh_/);

    const kinds = fin.diagnostics?.materialImprovementKinds || [];
    expect(kinds).toContain('wrong_locale_fixed');
    expect(kinds).not.toContain('missing_fact_restored');
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.materialImprovementDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBeFalsy();
    expect(fin.diagnostics?.finalDecisionKind).toMatch(/material_improvement/);

    const usageBefore = 19;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-cook-345-apply',
      requestedLocale: 'hi',
      uiLocale: 'hi',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-cook-345',
      usageCountBefore: usageBefore,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: fin.text,
      finalNormalizedText: fin.text,
    });
    const trace = session.commit();
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const cv = cookCurrentCv();
    const write = applyFinalizedBulletsToCv(cv, 'hi', 'exp-cook-2', fin);
    expect(write.experience[2]?.id).toBe('exp-cook-2');
    expect(write.experience[2]?.isPresent).toBe(true);
    expect(write.experience[2]?.description).toMatch(/करती हैं/);
  });

  it('same-locale HI 1sg → honorific emits perspective_error_fixed only', () => {
    const cook: WorkExperience = {
      id: 'exp-cook-2',
      company: 'Test Kitchen',
      position: 'Cook',
      startDate: '2022-03',
      endDate: '',
      isPresent: true,
      description: DEVICE_COOK_HI_1SG_PROVIDER,
      originalUserDescription: DEVICE_COOK_HI_1SG_PROVIDER,
      canonicalDescription: DEVICE_COOK_HI_1SG_PROVIDER,
      descriptionOrigin: 'ai_generated',
      generatedLocale: 'hi',
    };
    const cv = cookCurrentCv();
    cv.experience[2] = cook;
    (cv.personal as { gender?: string }).gender = 'female';
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_COOK_HI_1SG_PROVIDER,
      experienceId: 'exp-cook-2',
      industry: 'hospitality',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: DEVICE_COOK_HI_1SG_PROVIDER,
        locale: 'hi',
        requestId: 'req-cook-345-same-hi',
        jobContextHash: 'job-cook-345-same-hi',
        experienceEntryId: 'exp-cook-2',
        authoritativeTextOverride: DEVICE_COOK_HI_1SG_PROVIDER,
        provenanceOriginOverride: 'currentTextarea',
      }),
      currentTextareaProvenance: 'ai_generated',
      authoritativeFactSourceKind: 'canonical',
      currentTextareaUsedForFactExtraction: true,
      lastAiOutputHashMatched: false,
      materialUserEditDetected: false,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.text).toMatch(/तैयार करती हैं/);
    expect(fin.text).not.toMatch(/हूँ|हूं|थी/);
    const kinds = fin.diagnostics?.materialImprovementKinds || [];
    expect(kinds).toContain('perspective_error_fixed');
    expect(kinds).not.toContain('wrong_locale_fixed');
    expect(kinds).not.toContain('missing_fact_restored');
    expect(fin.diagnostics?.semanticNoOpDetected).toBeFalsy();
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.finalDecisionKind).toMatch(/material_improvement/);
    expect(fin.diagnostics?.providerPersonMode).toBe('first_singular');
    expect(fin.diagnostics?.normalizedPersonMode).toBe('third_singular');
    expect(fin.diagnostics?.perspectiveNormalizationApplied).toBe(true);
  });

  it('G. male current surface passes', () => {
    const fb = buildHindiCookingExperienceFallback({
      sourceDescription: DEVICE_COOK_EN,
      isPresent: true,
      gender: 'male',
    });
    expect(fb).toBe(DEVICE_COOK_HI_MALE_CURRENT);
    const fin = finalizeCookHi(DEVICE_COOK_HI_MALE_CURRENT, { gender: 'male' });
    expect(fin.blocked).toBe(false);
    expect(fin.text).toMatch(/तैयार करते हैं/);
    expect(fin.text).not.toMatch(/हूँ|थी/);
  });

  it('H. unspecified current uses honorific plural convention', () => {
    const fb = buildHindiCookingExperienceFallback({
      sourceDescription: DEVICE_COOK_EN,
      isPresent: true,
      gender: 'unspecified',
    });
    expect(fb).toMatch(/तैयार करते हैं/);
    const fin = finalizeCookHi(fb, { gender: 'unspecified' });
    expect(fin.blocked).toBe(false);
    expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
  });
});

describe('AAB-345 current vs past Hindi validation', () => {
  it('I–J. current rejects थी / था candidates', () => {
    for (const candidate of [DEVICE_COOK_HI_PAST_FEMALE, DEVICE_COOK_HI_PAST_MALE]) {
      const mix = validateCurrentRoleTenseMix(candidate, 'hi', true);
      expect(mix.length).toBeGreaterThan(0);
      const fin = finalizeCookHi(candidate, {
        gender: candidate.includes('था') ? 'male' : 'female',
      });
      expect(fin.diagnostics?.providerAccepted).toBe(false);
      expect(fin.diagnostics?.expectedEmploymentTense).toBe('present');
      if (fin.blocked) {
        expect(String(fin.diagnostics?.providerRejectionStage || fin.diagnostics?.rejectionStage || ''))
          .toMatch(/hindi_employment_tense|tense/);
      } else {
        // L. grounded present cooking fallback
        expect(fin.origin).toBe('deterministic_fallback');
        expect(fin.text).toMatch(/करती हैं|करते हैं/);
        expect(fin.text).not.toMatch(/थी|था|थे|हूँ/);
        expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
      }
    }
  });

  it('K. completed candidate with legitimate past form passes', () => {
    const fin = finalizeCookHi(DEVICE_COOK_HI_PAST_FEMALE, {
      isPresent: false,
      gender: 'female',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.diagnostics?.expectedEmploymentTense).toBe('past');
    expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
    expect(fin.text).toMatch(/थी|कीं|किया/);
  });

  it('L. invalid past provider selects present cooking fallback', () => {
    const fin = finalizeCookHi(DEVICE_COOK_HI_PAST_FEMALE);
    expect(fin.blocked).toBe(false);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(splitExperienceBullets(fin.text || '')).toHaveLength(3);
    expect(fin.text).toMatch(/भोजन और व्यंजन तैयार करती हैं/);
    expect(fin.text).toMatch(/रसोई में स्वच्छता/);
    expect(fin.text).toMatch(/समन्वय करती हैं/);
    expect(fin.text).not.toMatch(/थी|था|थे|हूँ|गोदाम|डिज़ाइन/);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
  });
});

describe('AAB-345 Hindi tense/perspective matrix (cook / warehouse / design / free-text)', () => {
  const cases: Array<{
    name: string;
    description: string;
    position: string;
    industry?: string;
    warehouseExpected: boolean;
  }> = [
    {
      name: 'cooking',
      description: DEVICE_COOK_EN,
      position: 'Cook',
      industry: 'hospitality',
      warehouseExpected: false,
    },
    {
      name: 'warehouse',
      description: ATLAS_WAREHOUSE_EN,
      position: 'Warehouse Worker',
      industry: 'logistics',
      warehouseExpected: true,
    },
    {
      name: 'graphic-design',
      description: DESIGN_EN,
      position: 'Graphic Designer',
      industry: 'design',
      warehouseExpected: false,
    },
    {
      name: 'free-text',
      description: FREE_TEXT_OCCUPATION_EN,
      position: 'Customer Support Agent',
      industry: 'customer_service',
      warehouseExpected: false,
    },
  ];

  for (const c of cases) {
    it(`${c.name}: warehouse applicability + 1sg present normalize path`, () => {
      expect(sourceHasWarehouseDomainApplicability(c.description, {
        position: c.position,
        industry: c.industry,
      })).toBe(c.warehouseExpected);
      expect(sourceRequiresHindiWarehouseFactCoverage(c.description)).toBe(c.warehouseExpected);

      if (c.name === 'cooking') {
        const fin = finalizeCookHi(DEVICE_COOK_HI_1SG_PROVIDER);
        expect(fin.blocked).toBe(false);
        expect(fin.diagnostics?.providerPersonMode).toBe('first_singular');
        expect(fin.diagnostics?.normalizedPersonMode).toBe('third_singular');
        expect(fin.text).not.toMatch(/हूँ/);
        const pred = scanGenericExperiencePredicates(DEVICE_COOK_EN, fin.text || '');
        expect(pred.sourcePredicateIdentityCount).toBe(3);
        expect(pred.candidatePredicateIdentityCount).toBe(3);
        expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
      } else {
        // First-person present Hindi shell must normalize or fall back without past.
        const firstPersonShell = formatExperienceBullets([
          'कार्य करती हूँ।',
          'दस्तावेज़ अपडेट करती हूँ।',
          'सहकर्मियों के साथ समन्वय करती हूँ।',
        ]);
        expect(detectHindiExperiencePersonMode(firstPersonShell)).toBe('first_singular');
        const normalized = normalizeHindiExperiencePerspective(firstPersonShell);
        expect(detectHindiExperiencePersonMode(normalized)).toBe('third_singular');
        expect(normalized).not.toMatch(/हूँ/);
      }
    });

    it(`${c.name}: third-person present accepted when facts map`, () => {
      if (c.name !== 'cooking') return;
      const fin = finalizeCookHi(DEVICE_COOK_HI_FEMALE_CURRENT);
      expect(fin.blocked).toBe(false);
      expect(fin.diagnostics?.providerPersonMode).toBe('third_singular');
      expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
    });

    it(`${c.name}: past for current rejected or present-fallback`, () => {
      if (c.name !== 'cooking') return;
      const fin = finalizeCookHi(DEVICE_COOK_HI_PAST_FEMALE);
      expect(fin.diagnostics?.providerAccepted).toBe(false);
      if (!fin.blocked) {
        expect(fin.text).not.toMatch(/थी/);
        expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
      }
    });

    it(`${c.name}: past for completed can pass`, () => {
      if (c.name !== 'cooking') return;
      const fin = finalizeCookHi(DEVICE_COOK_HI_PAST_FEMALE, { isPresent: false });
      expect(fin.blocked).toBe(false);
      expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
    });
  }

  it('male / female / unspecified cooking gender surfaces', () => {
    for (const gender of ['female', 'male', 'unspecified'] as const) {
      const fb = buildHindiCookingExperienceFallback({
        sourceDescription: DEVICE_COOK_EN,
        isPresent: true,
        gender,
      });
      if (gender === 'female') expect(fb).toMatch(/करती हैं/);
      else expect(fb).toMatch(/करते हैं/);
      const fin = finalizeCookHi(fb, { gender });
      expect(fin.blocked, gender).toBe(false);
      expect(fin.diagnostics?.tenseValidationPassed, gender).toBe(true);
    }
  });

  it('safe rejection when neither provider nor cooking fallback is valid (empty)', () => {
    const fin = finalizeRoleHi({
      description: DEVICE_COOK_EN,
      candidate: '',
      position: 'Cook',
      industry: 'hospitality',
    });
    // Empty provider may still recover via grounded cooking fallback.
    if (fin.blocked) {
      expect(fin.diagnostics?.applyCommitted).toBeFalsy();
    } else {
      expect(fin.origin).toBe('deterministic_fallback');
      expect(fin.text).toMatch(/भोजन और व्यंजन/);
    }
  });
});

describe('AAB-345 locale typing smoke', () => {
  it('hi remains in CV third-person required locales', () => {
    const locales: Locale[] = ['hi'];
    for (const locale of locales) {
      expect(detectExperiencePersonMode(DEVICE_COOK_HI_1SG_PROVIDER, locale)).toBe('first_singular');
    }
  });
});
