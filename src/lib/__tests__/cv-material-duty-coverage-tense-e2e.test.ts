/**
 * Build-236 follow-up: material duty coverage + employment-status tense
 * for Experience AI Improvements (Hindi Present cooking fixture + generics).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  splitExperienceBullets,
  buildCvCanonicalFactSet,
  bulletsForExperience,
  ensureCanonicalExperienceFrozen,
  freezeCanonicalExperienceDescription,
  formatExperienceBullets,
} from '@/lib/cv-canonical-facts';
import {
  materialDutyKeysFromDescription,
  validateMaterialDutyCoverage,
} from '@/lib/cv-material-duty-coverage';
import { deterministicLocalizedBulletsFromCanonical } from '@/lib/cv-localized-fallback';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import {
  activateCvExperienceBullets,
  buildBulletRepairPrompt,
} from '@/lib/cv-content-activation';
import { validateLocalizedExperienceBullets } from '@/lib/cv-semantic-fidelity';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

/** Real-device Android fixture: three Serbian duties, often one textarea block. */
export const SR_COOKING_THREE_BLOCK =
  'Pripremala sam jela prema standardima restorana. Održavala sam higijenu radnog prostora. Sarađivala sam sa kuhinjskim timom.';

export const SR_COOKING_THREE_NL = `Pripremala sam jela prema standardima restorana.
Održavala sam higijenu radnog prostora.
Sarađivala sam sa kuhinjskim timom.`;

const MERGED_HI_PAST_MISSING_COLLAB =
  'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती थी और कार्यस्थल की स्वच्छता बनाए रखती थी।';

const HI_PAST_ALL_THREE = formatExperienceBullets([
  'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती थी।',
  'मैं कार्यस्थल की स्वच्छता बनाए रखती थी।',
  'मैं रसोई टीम के साथ सहयोग करती थी।',
]);

function makeFixtureCv(desc: string, opts?: {
  isPresent?: boolean;
  endDate?: string;
  gender?: string;
  localeGrounding?: string;
}): CVData {
  const frozen = opts?.localeGrounding ?? desc;
  return {
    personal: {
      fullName: 'Ana Test',
      jobTitle: 'Kuvar',
      gender: opts?.gender || 'female',
      email: 'a@test.com',
      phone: '',
      address: '',
      photoEnabled: false,
    },
    summary: '',
    experience: [{
      id: 'exp-cook-hi',
      position: 'Kuvar',
      company: 'Restoran',
      startDate: '2022-01',
      endDate: opts?.isPresent === false ? (opts.endDate || '2024-06') : '',
      isPresent: opts?.isPresent !== false,
      description: desc,
      originalUserDescription: frozen,
      canonicalDescription: frozen,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  } as CVData;
}

describe('material duty coverage + employment tense (Hindi Present cooking)', () => {
  it('1. parses three material facts from block and newline fixtures', () => {
    expect(splitExperienceBullets(SR_COOKING_THREE_BLOCK)).toHaveLength(3);
    expect(splitExperienceBullets(SR_COOKING_THREE_NL)).toHaveLength(3);
    const keys = materialDutyKeysFromDescription(SR_COOKING_THREE_BLOCK);
    expect(keys).toEqual([
      'food_prep',
      'hygiene_workplace',
      'kitchen_collaboration',
    ]);
  });

  it('2–5. Hindi Present finalize preserves all three duties, female present, no cuisine invention', () => {
    const cv = makeFixtureCv(SR_COOKING_THREE_BLOCK);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'experience_bullets',
      candidate: MERGED_HI_PAST_MISSING_COLLAB,
      experienceId: 'exp-cook-hi',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.origin).toBe('deterministic_fallback');
    const text = pipeline.stateCv.experience[0].description;
    expect(text).toMatch(/तैयार करती हूँ/);
    expect(text).toMatch(/स्वच्छता बनाए रखती हूँ/);
    expect(text).toMatch(/सहयोग करती हूँ/);
    expect(text).not.toMatch(/थी/);
    expect(text).not.toMatch(/सर्बियाई|भूमध्य|Mediterranean|mediteransk/i);
    expect(text).toMatch(/करती हूँ/);
    expect(validateMaterialDutyCoverage(SR_COOKING_THREE_BLOCK, text).valid).toBe(true);
    expect(pipeline.stateCv.experience[0].originalUserDescription).toBe(SR_COOKING_THREE_BLOCK);
  });

  it('6–8. provider missing collab rejected; repair gets missing-duty; repair miss → fallback', async () => {
    const cv = makeFixtureCv(SR_COOKING_THREE_NL);
    const factSet = buildCvCanonicalFactSet(cv);
    const first = validateLocalizedExperienceBullets(MERGED_HI_PAST_MISSING_COLLAB, factSet, {
      locale: 'hi',
      gender: 'female',
      experienceIndex: 0,
      isPresent: true,
    });
    expect(first.valid).toBe(false);
    expect(first.violations.some((v) => v.kind === 'missing_canonical_duty')).toBe(true);
    expect(first.violations.some((v) => v.kind === 'employment_tense_mismatch')).toBe(true);

    const repairPrompt = buildBulletRepairPrompt(
      'hi',
      first.violations,
      MERGED_HI_PAST_MISSING_COLLAB,
      bulletsForExperience(factSet, 0).map((b) => `- [${b.id}] ${b.value}`).join('\n'),
      { isPresent: true, gender: 'female' },
    );
    expect(repairPrompt).toMatch(/Missing duty categories/i);
    expect(repairPrompt).toMatch(/kitchen_collaboration|kitchen/i);
    expect(repairPrompt).toMatch(/Required employment tense:\s*present/i);

    const repairStillBad = vi.fn(async () => HI_PAST_ALL_THREE);
    const activated = await activateCvExperienceBullets({
      locale: 'hi',
      gender: 'female',
      experienceIndex: 0,
      factSet,
      candidate: MERGED_HI_PAST_MISSING_COLLAB,
      isPresent: true,
      repair: repairStillBad,
    });
    expect(repairStillBad).toHaveBeenCalled();
    expect(activated.status).toBe('fallback');
    expect(activated.content).toMatch(/सहयोग करती हूँ/);
    expect(activated.content).toMatch(/तैयार करती हूँ/);
    expect(activated.content).not.toMatch(/थी/);
  });

  it('9–11. past-tense Hindi for Present rejected; fallback present; final state has all three', () => {
    const cv = makeFixtureCv(SR_COOKING_THREE_BLOCK);
    const blockedReason = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: HI_PAST_ALL_THREE,
      experienceId: 'exp-cook-hi',
    });
    // finalize should replace with present-tense fallback, not stay blocked
    expect(blockedReason.blocked).toBe(false);
    expect(blockedReason.origin).toBe('deterministic_fallback');
    expect(blockedReason.text).toMatch(/करती हूँ/);
    expect(blockedReason.text).not.toMatch(/थी/);
    expect(blockedReason.text).toMatch(/रसोई टीम/);

    const next = applyFinalizedBulletsToCv(cv, 'hi', 'exp-cook-hi', blockedReason);
    expect(next.experience[0].description).toBe(blockedReason.text);
    expect(next.experience[0].originalUserDescription).toBe(SR_COOKING_THREE_BLOCK);
  });

  it('12–13. cvRef/apply path keeps same finalized text; originalUserDescription unchanged', () => {
    const cv = makeFixtureCv(SR_COOKING_THREE_NL);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'experience_bullets',
      candidate: MERGED_HI_PAST_MISSING_COLLAB,
      experienceId: 'exp-cook-hi',
    });
    expect(pipeline.stateCv.experience[0].description).toBe(pipeline.finalized.text);
    expect(pipeline.stateCv.experience[0].originalUserDescription).toBe(SR_COOKING_THREE_NL);
    expect(pipeline.stateCv.experience[0].canonicalDescription || '').toContain('Sarađivala sam sa kuhinjskim timom');
    expect(pipeline.stateCv.experience[0].descriptionOrigin).toMatch(/deterministic_fallback|ai_/);
  });

  it('14–15. applied fallback counts success once; empty grounding is client-guarded', () => {
    const cv = makeFixtureCv(SR_COOKING_THREE_BLOCK);
    const applied = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: MERGED_HI_PAST_MISSING_COLLAB,
      experienceId: 'exp-cook-hi',
      originHint: 'ai_generated',
    });
    // After internal fallback, countedAsSuccess is true exactly once for apply.
    expect(applied.countedAsSuccess).toBe(true);
    expect(applied.origin).toBe('deterministic_fallback');

    const emptyExp = ensureCanonicalExperienceFrozen({
      id: 'empty',
      position: 'Kuvar',
      company: 'X',
      startDate: '',
      endDate: '',
      isPresent: true,
      description: '',
      originalUserDescription: '',
      canonicalDescription: '',
      descriptionOrigin: 'user',
    });
    expect(freezeCanonicalExperienceDescription(emptyExp).trim()).toBe('');
    expect(aiErrorMessage('experience_description_required', 'en'))
      .toBe('Enter a work-experience description first.');
  });

  it('16. empty description guard message is localized and distinct', () => {
    expect(aiErrorMessage('experience_description_required', 'en'))
      .toBe('Enter a work-experience description first.');
    expect(aiErrorMessage('experience_description_required', 'hi')).toMatch(/कार्य अनुभव|विवरण/);
    expect(aiErrorMessage('experience_description_required', 'sr')).toMatch(/opis radnog iskustva/i);
  });

  it('17–18. past-role Hindi uses past tense; validation does not demand present', () => {
    const cv = makeFixtureCv(SR_COOKING_THREE_BLOCK, { isPresent: false, endDate: '2024-06' });
    const factSet = buildCvCanonicalFactSet(cv);
    const pastOk = validateLocalizedExperienceBullets(HI_PAST_ALL_THREE, factSet, {
      locale: 'hi',
      gender: 'female',
      experienceIndex: 0,
      isPresent: false,
    });
    expect(pastOk.valid).toBe(true);

    const fallback = deterministicLocalizedBulletsFromCanonical(
      bulletsForExperience(factSet, 0),
      'hi',
      'female',
      { isPresent: false },
    );
    expect(fallback).toMatch(/करती थी|रखती थी/);
    expect(fallback).not.toMatch(/करती हूँ/);
  });
});

describe('cross-locale Present cooking coverage', () => {
  const locales: Locale[] = ['sr', 'en', 'de', 'ar', 'ru', 'ja', 'pt-BR', 'hi', 'hr', 'es', 'fr', 'it'];

  it('19–23. all 12 locales preserve three material duties for Present role', () => {
    const cv = makeFixtureCv(SR_COOKING_THREE_BLOCK);
    const factSet = buildCvCanonicalFactSet(cv);
    const facts = bulletsForExperience(factSet, 0);
    expect(facts).toHaveLength(3);

    for (const locale of locales) {
      const text = deterministicLocalizedBulletsFromCanonical(facts, locale, 'female', { isPresent: true });
      expect(text.trim(), locale).not.toBe('');
      const coverage = validateMaterialDutyCoverage(SR_COOKING_THREE_BLOCK, text);
      expect(coverage.valid, `${locale}: missing ${coverage.missing.join(',')}`).toBe(true);
      if (locale === 'en') {
        expect(text).toMatch(/\bPrepare\b/);
        expect(text).toMatch(/\bMaintain\b/);
        expect(text).toMatch(/\bCollaborate\b/);
        expect(text).not.toMatch(/\bPrepared\b/);
      }
      if (locale === 'sr') {
        expect(text).toMatch(/Pripremam|Poštujem|Sarađujem/);
        expect(text).not.toMatch(/Pripremala sam/);
      }
      if (locale === 'hi') {
        expect(text).toMatch(/करती हूँ/);
        expect(text).not.toMatch(/थी/);
      }
    }
  });
});

describe('generic occupations material coverage', () => {
  it('24. warehouse preserves transport/loading/safe delivery', () => {
    const src = 'Transport goods in the warehouse. Load shipments carefully. Deliver goods safely.';
    expect(materialDutyKeysFromDescription(src)).toEqual([
      'logistics_transport',
      'logistics_loading',
      'logistics_delivery',
    ]);
    const cv = makeFixtureCv(src, { gender: 'male' });
    cv.personal.jobTitle = 'Warehouse Operator';
    cv.experience[0].position = 'Warehouse Operator';
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '• Transport goods in the warehouse.',
      experienceId: 'exp-cook-hi',
    });
    expect(pipeline.blocked).toBe(false);
    const text = pipeline.finalized.text;
    expect(validateMaterialDutyCoverage(src, text).valid).toBe(true);
    expect(text.toLowerCase()).toMatch(/transport/);
    expect(text.toLowerCase()).toMatch(/load/);
    expect(text.toLowerCase()).toMatch(/deliver/);
  });

  it('25. software preserves development/testing/documentation', () => {
    const src = 'Develop React features and APIs. Test features with unit tests. Document APIs for the team.';
    expect(materialDutyKeysFromDescription(src)).toEqual([
      'software_development',
      'software_testing',
      'software_documentation',
    ]);
    const cv = makeFixtureCv(src, { gender: 'male' });
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '• Develop React features and APIs.',
      experienceId: 'exp-cook-hi',
    });
    expect(pipeline.blocked).toBe(false);
    expect(validateMaterialDutyCoverage(src, pipeline.finalized.text).valid).toBe(true);
  });

  it('26–27. sales preserves prospecting/client communication/order processing; combining keeps third', () => {
    const src = [
      'Prospect new leads and build the sales pipeline.',
      'Communicate with clients about needs and proposals.',
      'Process customer orders through to fulfillment.',
    ].join('\n');
    expect(materialDutyKeysFromDescription(src)).toHaveLength(3);
    const combinedTwo = formatExperienceBullets([
      'Prospect new leads and communicate with clients about needs.',
      'Process customer orders through to fulfillment.',
    ]);
    // Combining first two is OK if all three meanings remain.
    expect(validateMaterialDutyCoverage(src, combinedTwo).valid).toBe(true);
    const dropOrder = formatExperienceBullets([
      'Prospect new leads and communicate with clients about needs.',
    ]);
    expect(validateMaterialDutyCoverage(src, dropOrder).valid).toBe(false);
    expect(validateMaterialDutyCoverage(src, dropOrder).missing).toContain('sales_order_processing');
  });
});

describe('50× cold Hindi Present cooking apply', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs 50 times from fresh state with zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = makeFixtureCv(SR_COOKING_THREE_BLOCK);
      const frozen = ensureCanonicalExperienceFrozen(cv.experience[0]);
      expect(freezeCanonicalExperienceDescription(frozen)).toContain('Sarađivala');
      const pipeline = runCvAiApplyPipeline({
        cv: { ...cv, experience: [frozen] },
        locale: 'hi',
        action: 'experience_bullets',
        candidate: MERGED_HI_PAST_MISSING_COLLAB,
        experienceId: 'exp-cook-hi',
      });
      expect(pipeline.blocked, `iter ${i}`).toBe(false);
      expect(pipeline.finalized.countedAsSuccess, `iter ${i}`).toBe(true);
      const text = pipeline.stateCv.experience[0].description;
      expect(text, `iter ${i}`).toMatch(/तैयार करती हूँ/);
      expect(text, `iter ${i}`).toMatch(/स्वच्छता बनाए रखती हूँ/);
      expect(text, `iter ${i}`).toMatch(/सहयोग करती हूँ/);
      expect(text, `iter ${i}`).not.toMatch(/थी/);
      expect(pipeline.stateCv.experience[0].originalUserDescription).toBe(SR_COOKING_THREE_BLOCK);
    }
  });
});
