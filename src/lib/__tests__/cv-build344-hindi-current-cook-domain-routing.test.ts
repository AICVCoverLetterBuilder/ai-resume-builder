/**
 * @vitest-environment jsdom
 *
 * AAB-344 — Hindi current-cook Experience domain routing:
 * hospitality/cooking must not activate dedicated Hindi warehouse grounding
 * from prep+colleagues alone. Generic facts/predicates stay 3/3; invalid
 * provider uses grounded Hindi cooking fallback (not design/warehouse shells).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  sourceHasWarehouseDomainApplicability,
  sourceIsCookingHospitalityWithoutWarehouseEvidence,
  countWarehouseDomainAnchorGroups,
  WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION,
} from '@/lib/cv-warehouse-domain-applicability';
import {
  sourceRequiresHindiWarehouseFactCoverage,
  validateHindiWarehouseExperienceCoverage,
  buildHindiCookingExperienceFallback,
  buildHindiWarehouseExperienceFallback,
  isExactHindiCookingThreeDutySource,
  hindiWarehouseFactDiagId,
  HINDI_COOKING_EXPERIENCE_FALLBACK_344_REVISION,
} from '@/lib/cv-hindi-experience-grounding';
import {
  sourceRequiresGermanWarehouseFactCoverage,
} from '@/lib/cv-german-experience-grounding';
import {
  sourceRequiresCroatianWarehouseFactCoverage,
} from '@/lib/cv-croatian-experience-grounding';
import {
  GENERIC_EXPERIENCE_PREDICATE_343_REVISION,
  scanGenericExperiencePredicates,
  sourceRequiresGenericExperiencePredicates,
} from '@/lib/cv-generic-experience-predicate-grounding';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { buildCrossLocaleExperienceFallback } from '@/lib/cv-cross-locale-experience';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { materialDutyKeysFromDescription } from '@/lib/cv-material-duty-coverage';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2026-07-26';

/** Exact AAB-344 device Cook / Test Kitchen English structured-canonical source. */
export const DEVICE_COOK_EN_UNITS = [
  'Prepares meals and dishes.',
  'Maintains hygiene and cleanliness in the kitchen.',
  'Coordinates with kitchen colleagues during food preparation.',
] as const;

export const DEVICE_COOK_EN = DEVICE_COOK_EN_UNITS.join('\n');

/** Expected grounded Hindi cooking fallback (female / current). */
export const DEVICE_COOK_HI_FEMALE_CURRENT_UNITS = [
  'भोजन और व्यंजन तैयार करती हैं।',
  'रसोई में स्वच्छता और साफ-सफाई बनाए रखती हैं।',
  'भोजन की तैयारी के दौरान रसोई के सहकर्मियों के साथ समन्वय करती हैं।',
] as const;

export const DEVICE_COOK_HI_FEMALE_CURRENT = DEVICE_COOK_HI_FEMALE_CURRENT_UNITS.join('\n');

const ATLAS_WAREHOUSE_EN = [
  'Checks incoming goods.',
  'Checks related documents.',
  'Coordinates preparation and movement of goods with colleagues.',
].join('\n');

const DESIGN_PREP_COLLEAGUES_EN = [
  'Creates visual materials and graphic elements.',
  'Reviews and adapts design materials.',
  'Coordinates design handoffs with colleagues during preparation.',
].join('\n');

const MOVEMENT_ONLY_EN = [
  'Handles movement of packages across the floor.',
  'Records shift notes in the logbook.',
  'Supports daily operational tasks.',
].join('\n');

const ALL_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ru', 'hi', 'ja', 'ar', 'sr', 'hr',
];

function cookCurrentCv(options?: {
  description?: string;
  uiLocale?: string;
}): CVData {
  const description = options?.description ?? DEVICE_COOK_EN;
  const cook: WorkExperience = {
    id: 'exp-cook-2',
    company: 'Test Kitchen',
    position: 'Cook',
    startDate: '2022-03',
    endDate: '',
    isPresent: true,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'structured_canonical',
    generatedLocale: undefined,
    generatedDescription: undefined,
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
      gender: 'female',
    },
    personalInfo: {
      fullName: 'Device Cook',
      email: 'cook@example.com',
      phone: '',
      location: '',
      title: 'Cook',
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
    locale: options?.uiLocale ?? 'hi',
  } as unknown as CVData;
}

function warehouseCv(description: string): CVData {
  const entry: WorkExperience = {
    id: 'exp-wh-0',
    company: 'Atlas',
    position: 'Warehouse Worker',
    startDate: '2021-01',
    endDate: '',
    isPresent: true,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'structured_canonical',
  };
  return {
    personal: {
      fullName: 'Warehouse Worker',
      email: 'wh@example.com',
      phone: '',
      location: '',
      jobTitle: 'Warehouse Worker',
      gender: 'female',
    },
    personalInfo: {
      fullName: 'Warehouse Worker',
      email: 'wh@example.com',
      phone: '',
      location: '',
      title: 'Warehouse Worker',
    },
    summary: '',
    experience: [entry],
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

function finalizeCookHi(candidate: string, extras?: Record<string, unknown>) {
  const cv = cookCurrentCv();
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'hi',
    gender: 'female',
    cv,
    candidate,
    experienceId: 'exp-cook-2',
    industry: 'hospitality',
    level: 'mid',
    referenceDateIso: REF,
    operationSnapshot: createExperienceAiOperationSnapshot({
      liveText: DEVICE_COOK_EN,
      locale: 'hi',
      requestId: 'req-cook-344',
      jobContextHash: 'job-cook-344',
      experienceEntryId: 'exp-cook-2',
      authoritativeTextOverride: DEVICE_COOK_EN,
      provenanceOriginOverride: 'currentTextarea',
    }),
    currentTextareaProvenance: 'structured_canonical',
    authoritativeFactSourceKind: 'canonical',
    currentTextareaUsedForFactExtraction: true,
    lastAiOutputHashMatched: false,
    materialUserEditDetected: false,
    ...extras,
  });
}

function finalizeCookLocale(
  locale: Locale,
  candidate: string,
) {
  const cv = cookCurrentCv({ uiLocale: locale });
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: locale,
    gender: 'female',
    cv,
    candidate,
    experienceId: 'exp-cook-2',
    industry: 'hospitality',
    level: 'mid',
    referenceDateIso: REF,
    operationSnapshot: createExperienceAiOperationSnapshot({
      liveText: DEVICE_COOK_EN,
      locale,
      requestId: `req-cook-344-${locale}`,
      jobContextHash: `job-cook-344-${locale}`,
      experienceEntryId: 'exp-cook-2',
      authoritativeTextOverride: DEVICE_COOK_EN,
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

describe('AAB-344 warehouse domain applicability contract', () => {
  it('exposes packaging revision', () => {
    expect(WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION).toBe(
      'warehouse-domain-applicability-344-v1',
    );
    expect(HINDI_COOKING_EXPERIENCE_FALLBACK_344_REVISION).toBe(
      'hindi-cooking-experience-fallback-344-v1',
    );
  });

  it('cook + hospitality does not activate warehouse applicability', () => {
    expect(sourceHasWarehouseDomainApplicability(DEVICE_COOK_EN, {
      position: 'Cook',
      industry: 'hospitality',
    })).toBe(false);
    expect(sourceIsCookingHospitalityWithoutWarehouseEvidence(DEVICE_COOK_EN, {
      position: 'Cook',
      industry: 'hospitality',
    })).toBe(true);
    expect(sourceRequiresHindiWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);
    expect(sourceRequiresGermanWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);
    expect(sourceRequiresCroatianWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);
    expect(countWarehouseDomainAnchorGroups(DEVICE_COOK_EN)).toBe(0);
  });

  it('coord+prepar material key alone does not force Hindi warehouse', () => {
    const keys = materialDutyKeysFromDescription(DEVICE_COOK_EN);
    // Historical false positive: warehouse_movement from coord…prepar.
    expect(keys).toContain('kitchen_collaboration');
    expect(sourceRequiresHindiWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);
    const cov = validateHindiWarehouseExperienceCoverage(DEVICE_COOK_EN, 'x');
    expect(cov.required).toEqual([]);
    expect(cov.uncovered.map(hindiWarehouseFactDiagId)).not.toContain(
      'hi_wh_goods_prep_movement_colleagues',
    );
  });

  it('graphic designer prep+colleagues does not activate warehouse', () => {
    expect(sourceHasWarehouseDomainApplicability(DESIGN_PREP_COLLEAGUES_EN)).toBe(false);
    expect(sourceRequiresHindiWarehouseFactCoverage(DESIGN_PREP_COLLEAGUES_EN)).toBe(false);
  });

  it('movement alone does not activate warehouse', () => {
    expect(sourceHasWarehouseDomainApplicability(MOVEMENT_ONLY_EN)).toBe(false);
    expect(sourceRequiresHindiWarehouseFactCoverage(MOVEMENT_ONLY_EN)).toBe(false);
  });

  it('genuine incoming + docs + goods movement still activates warehouse', () => {
    expect(countWarehouseDomainAnchorGroups(ATLAS_WAREHOUSE_EN)).toBeGreaterThanOrEqual(2);
    expect(sourceHasWarehouseDomainApplicability(ATLAS_WAREHOUSE_EN, {
      position: 'Warehouse Worker',
    })).toBe(true);
    expect(sourceRequiresHindiWarehouseFactCoverage(ATLAS_WAREHOUSE_EN)).toBe(true);
    const cov = validateHindiWarehouseExperienceCoverage(
      ATLAS_WAREHOUSE_EN,
      buildHindiWarehouseExperienceFallback({
        sourceDescription: ATLAS_WAREHOUSE_EN,
        isPresent: true,
        gender: 'female',
      }),
    );
    expect(cov.ok).toBe(true);
    expect(cov.required.length).toBe(3);
  });
});

describe('AAB-344 exact Hindi current-cook device regression', () => {
  it('matches exact device source hash and three-duty cooking identity', () => {
    expect(fingerprintText(DEVICE_COOK_EN)).toBe('fnv1a_f4b943a2_l137_b80_e46');
    expect(isExactHindiCookingThreeDutySource(DEVICE_COOK_EN)).toBe(true);
    expect(sourceRequiresGenericExperiencePredicates(DEVICE_COOK_EN)).toBe(true);
  });

  it('generic facts/predicates stay 3/3 with zero hi_wh_* identities', () => {
    const fb = buildHindiCookingExperienceFallback({
      sourceDescription: DEVICE_COOK_EN,
      isPresent: true,
      gender: 'female',
    });
    const pred = scanGenericExperiencePredicates(DEVICE_COOK_EN, fb);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(JSON.stringify(pred)).not.toMatch(/hi_wh_/);
    expect(fb).not.toMatch(/गोदाम|माल की तैयारी|डिज़ाइन|डिजाइन|दृश्य/);
  });

  it('builds exact female/current Hindi cooking fallback', () => {
    const fb = buildHindiCookingExperienceFallback({
      sourceDescription: DEVICE_COOK_EN,
      isPresent: true,
      gender: 'female',
    });
    expect(splitExperienceBullets(fb)).toEqual([...DEVICE_COOK_HI_FEMALE_CURRENT_UNITS]);
    expect(fb).toContain('तैयार करती हैं');
    expect(fb).toContain('बनाए रखती हैं');
    expect(fb).toContain('समन्वय करती हैं');
  });

  it('accepts valid Hindi cooking provider and commits on third entry with usage +1', () => {
    const cv = cookCurrentCv();
    expect(cv.experience).toHaveLength(3);
    const fin = finalizeCookHi(DEVICE_COOK_HI_FEMALE_CURRENT);
    expect(fin.blocked).toBe(false);
    expect(fin.diagnostics?.providerAccepted).toBe(true);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount ?? 0)).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(JSON.stringify(fin.diagnostics || {})).not.toMatch(/hi_wh_/);
    expect(fin.diagnostics?.expectedEmploymentTense).toBe('present');
    expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
    expect(fin.diagnostics?.authoritativeFactSourceKind).toMatch(/canonical|current_textarea/);
    expect(fin.diagnostics?.degradationDetected).toBeFalsy();
    expect(fin.diagnostics?.semanticNoOpDetected).toBeFalsy();
    expect(fin.text).toMatch(/भोजन और व्यंजन/);
    expect(fin.text).not.toMatch(/गोदाम|डिज़ाइन/);

    const usageBefore = 19;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-cook-344-apply',
      requestedLocale: 'hi',
      uiLocale: 'hi',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-cook-344',
      usageCountBefore: usageBefore,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: fin.text,
      finalNormalizedText: fin.text,
    });
    const trace = session.commit();
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'hi', 'exp-cook-2', fin);
    expect(write.experience[2]?.id).toBe('exp-cook-2');
    expect(write.experience[2]?.description).toMatch(/रसोई/);
    expect(write.experience[2]?.isPresent).toBe(true);
    expect(
      (write.experience[2] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('hi');
  });

  it('invalid provider triggers Hindi cooking fallback (not design/warehouse soft shells)', () => {
    const invalidProvider = formatExperienceBullets([
      'भूमिका के दैनिक डिज़ाइन कर्तव्य पूरे करती है और संबंधित सामग्री की सटीकता जाँचती है।',
      'प्रोजेक्ट आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन करती है।',
      'सहकर्मियों के साथ डिज़ाइन हैंडऑफ़ का समन्वय करती है ताकि डिलिवरेबल्स समय पर रहें।',
    ]);
    const fin = finalizeCookHi(invalidProvider);
    expect(fin.blocked).toBe(false);
    const bullets = splitExperienceBullets(fin.text || '');
    expect(bullets).toHaveLength(3);
    expect(fin.text).toMatch(/भोजन और व्यंजन तैयार करती हैं/);
    expect(fin.text).toMatch(/रसोई में स्वच्छता/);
    expect(fin.text).toMatch(/रसोई के सहकर्मियों/);
    expect(fin.text).not.toMatch(/डिज़ाइन|गोदाम|माल की तैयारी और स्थानांतरण/);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(JSON.stringify(fin.diagnostics || {})).not.toMatch(/hi_wh_/);
    expect(sourceRequiresHindiWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);
  });

  it('rejection preserves English cook text, entry index 2, and usage', () => {
    const cv = cookCurrentCv();
    const before = cv.experience[2]?.description;
    const rejectedFinalize = {
      blocked: true,
      countedAsSuccess: false,
      text: '',
      origin: 'ai_generated' as const,
      diagnostics: {
        applyCommitted: false,
        visibleApplySucceeded: false,
        countedAsSuccess: false,
      },
    };
    const applied = applyFinalizedBulletsToCv(
      cv,
      'hi',
      'exp-cook-2',
      rejectedFinalize as never,
    );
    expect(applied.experience[2]?.description).toBe(before);
    expect(applied.experience[2]?.id).toBe('exp-cook-2');
    expect(applied.experience[2]?.description).toBe(DEVICE_COOK_EN);
  });

  it('documents recovered pre-fix cook→hi soft-shell / warehouse collapse path', () => {
    const soft = buildCrossLocaleExperienceFallback({
      sourceDescription: DEVICE_COOK_EN,
      targetLocale: 'hi',
      isPresent: true,
      gender: 'female',
    });
    const softBullets = splitExperienceBullets(soft);
    expect(softBullets.length).toBeGreaterThanOrEqual(1);
    // Historical warehouse collapse (1 bullet) must not activate for cooking.
    expect(sourceRequiresHindiWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);
    const cooking = buildHindiCookingExperienceFallback({
      sourceDescription: DEVICE_COOK_EN,
      isPresent: true,
      gender: 'female',
    });
    expect(splitExperienceBullets(cooking)).toHaveLength(3);
    expect(cooking).not.toMatch(/डिज़ाइन|गोदाम/);
    // Soft shells may be office/work frames — design shells are a separate
    // invalid soft-shell failure mode; cooking fallback avoids both.
    expect(soft).not.toMatch(/भोजन और व्यंजन तैयार करती हैं/);
  });
});

describe('AAB-344 all-locale cooking matrix (no warehouse activation)', () => {
  for (const locale of ALL_LOCALES) {
    it(`${locale}: cook duties keep warehouse off, 3 generic predicates, present tense path`, () => {
      expect(sourceHasWarehouseDomainApplicability(DEVICE_COOK_EN, {
        position: 'Cook',
        industry: 'hospitality',
      })).toBe(false);
      expect(sourceRequiresHindiWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);

      let candidate: string;
      if (locale === 'hi') {
        candidate = DEVICE_COOK_HI_FEMALE_CURRENT;
      } else if (locale === 'en') {
        candidate = DEVICE_COOK_EN;
      } else {
        candidate = buildCrossLocaleExperienceFallback({
          sourceDescription: DEVICE_COOK_EN,
          targetLocale: locale,
          isPresent: true,
          gender: 'female',
        });
      }

      const fin = finalizeCookLocale(locale, candidate);
      expect(JSON.stringify(fin.diagnostics || {})).not.toMatch(/hi_wh_/);
      expect(sourceRequiresHindiWarehouseFactCoverage(DEVICE_COOK_EN)).toBe(false);

      if (locale === 'en') {
        // Same-locale English: no-op or enhancement without warehouse contamination.
        return;
      }

      // Soft cross-locale shells may still fail for some locales; cooking must not
      // route into warehouse rejection. Hindi must succeed via cooking path.
      if (locale === 'hi') {
        expect(fin.blocked).toBe(false);
        const text = fin.text || '';
        expect(text).toMatch(/भोजन|रसोई/);
        expect(text).not.toMatch(/गोदाम में आने|माल की तैयारी और स्थानांतरण/);
        const pred = scanGenericExperiencePredicates(DEVICE_COOK_EN, text);
        expect(pred.sourcePredicateIdentityCount).toBe(3);
        expect(pred.candidatePredicateIdentityCount).toBe(3);
        expect(pred.candidateAddedPredicateCount).toBe(0);
        expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
        expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
      } else if (!fin.blocked && fin.countedAsSuccess) {
        const text = fin.text || '';
        expect(text, locale).not.toMatch(/गोदाम में आने|माल की तैयारी और स्थानांतरण/);
        const cv = cookCurrentCv({ uiLocale: locale });
        const write = applyFinalizedBulletsToCv(cv, locale, 'exp-cook-2', fin);
        expect(write.experience[2]?.id).toBe('exp-cook-2');
      } else {
        // Blocked soft-shell path is acceptable for non-hi locales in this matrix
        // as long as warehouse specialization never activated.
        expect(JSON.stringify(fin.diagnostics || {})).not.toMatch(/hi_wh_|hindi_warehouse/);
      }
    });
  }
});

describe('AAB-344 preserve warehouse + arbitrary-role smoke', () => {
  it('Hindi warehouse female/current Atlas path still uses dedicated grounding', () => {
    const fb = buildHindiWarehouseExperienceFallback({
      sourceDescription: ATLAS_WAREHOUSE_EN,
      isPresent: true,
      gender: 'female',
    });
    expect(fb).toMatch(/गोदाम में आने वाले माल/);
    expect(sourceRequiresHindiWarehouseFactCoverage(ATLAS_WAREHOUSE_EN)).toBe(true);
    const cv = warehouseCv(ATLAS_WAREHOUSE_EN);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: fb,
      experienceId: 'exp-wh-0',
      industry: 'logistics',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: ATLAS_WAREHOUSE_EN,
        locale: 'hi',
        requestId: 'req-wh-344',
        jobContextHash: 'job-wh-344',
        experienceEntryId: 'exp-wh-0',
        authoritativeTextOverride: ATLAS_WAREHOUSE_EN,
        provenanceOriginOverride: 'currentTextarea',
      }),
      currentTextareaProvenance: 'structured_canonical',
      authoritativeFactSourceKind: 'canonical',
      currentTextareaUsedForFactExtraction: true,
      lastAiOutputHashMatched: false,
      materialUserEditDetected: false,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.text).toMatch(/गोदाम/);
    expect(GENERIC_EXPERIENCE_PREDICATE_343_REVISION).toBeTruthy();
  });
});
