/**
 * Build-237 regression: workplace hygiene must not expand into material storage
 * or meta "role duties" wording; Present must use Hindi present tense.
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
  validateNoExtraGeneratedDuties,
} from '@/lib/cv-material-duty-coverage';
import { hasCvMetaFallbackText } from '@/lib/cv-ai-meta-text';
import { deterministicLocalizedBulletsFromCanonical } from '@/lib/cv-localized-fallback';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import { validateLocalizedExperienceBullets } from '@/lib/cv-semantic-fidelity';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

const SR_THREE = [
  'Pripremala sam jela prema standardima restorana.',
  'Održavala sam higijenu radnog prostora.',
  'Sarađivala sam sa kuhinjskim timom.',
].join('\n');

/** Exact bad Hindi bullet observed on device (build 237). */
const BAD_HI_STORAGE_META =
  '• स्वच्छता और सामग्री भंडारण प्रक्रियाओं का पालन किया जो भूमिका के कर्तव्यों में बताई गई हैं।';

const BAD_HI_ALL = formatExperienceBullets([
  'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती थी।',
  'स्वच्छता और सामग्री भंडारण प्रक्रियाओं का पालन किया जो भूमिका के कर्तव्यों में बताई गई हैं।',
  'मैं रसोई टीम के साथ सहयोग करती थी।',
]);

function makeCv(desc: string, opts?: { isPresent?: boolean; endDate?: string }): CVData {
  return {
    personal: {
      fullName: 'Ana Test',
      jobTitle: 'Kuvar',
      gender: 'female',
      email: 'a@test.com',
      phone: '',
      address: '',
      photoEnabled: false,
    },
    summary: '',
    experience: [{
      id: 'exp-hygiene',
      position: 'Kuvar',
      company: 'Restoran',
      startDate: '2022-01',
      endDate: opts?.isPresent === false ? (opts.endDate || '2024-06') : '',
      isPresent: opts?.isPresent !== false,
      description: desc,
      originalUserDescription: desc,
      canonicalDescription: desc,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  } as CVData;
}

describe('hygiene must not invent storage/meta (build 237)', () => {
  it('1–2. bad Hindi sentence is rejected for storage + meta + past tense', () => {
    const cv = makeCv(SR_THREE);
    const factSet = buildCvCanonicalFactSet(cv);
    const check = validateLocalizedExperienceBullets(BAD_HI_ALL, factSet, {
      locale: 'hi',
      gender: 'female',
      experienceIndex: 0,
      isPresent: true,
    });
    expect(check.valid).toBe(false);
    const kinds = new Set(check.violations.map((v) => v.kind));
    expect(kinds.has('unsupported_generated_duty')).toBe(true);
    expect(kinds.has('meta_fallback_text')).toBe(true);
    expect(kinds.has('employment_tense_mismatch')).toBe(true);

    const blocked = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: BAD_HI_STORAGE_META,
      experienceId: 'exp-hygiene',
    });
    // Must not apply the bad sentence — fallback replaces it.
    expect(blocked.blocked).toBe(false);
    expect(blocked.origin).toBe('deterministic_fallback');
    expect(blocked.text).not.toMatch(/भंडारण/);
    expect(blocked.text).not.toMatch(/भूमिका के कर्तव्यों/);
    expect(hasCvMetaFallbackText(blocked.text)).toBe(false);
  });

  it('3–7. final Hindi Present fallback is exactly the three grounded duties', () => {
    const cv = makeCv(SR_THREE);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'experience_bullets',
      candidate: BAD_HI_ALL,
      experienceId: 'exp-hygiene',
    });
    expect(pipeline.blocked).toBe(false);
    const text = pipeline.finalized.text;
    expect(text).toMatch(/तैयार करती हैं/);
    expect(text).toMatch(/स्वच्छता/);
    expect(text).toMatch(/समन्वय करती हैं|सहयोग करती हैं/);
    expect(text).not.toMatch(/भंडारण|सामग्री भंडारण/);
    expect(text).not.toMatch(/भूमिका के कर्तव्यों|बताई गई/);
    expect(text).not.toMatch(/थी|था|थे|हूँ|हूं|पालन किया/);
    expect(validateMaterialDutyCoverage(SR_THREE, text).valid).toBe(true);
    expect(validateNoExtraGeneratedDuties(SR_THREE, text).valid).toBe(true);
    expect(splitExperienceBullets(text)).toHaveLength(3);
  });

  it('8–12. provenance + state invariant + single success count', () => {
    const cv = makeCv(SR_THREE);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'experience_bullets',
      candidate: BAD_HI_ALL,
      experienceId: 'exp-hygiene',
    });
    expect(pipeline.stateCv.experience[0].description).toBe(pipeline.finalized.text);
    expect(pipeline.previewCv.experience[0].description).toBe(pipeline.finalized.text);
    expect(pipeline.pdfCv.experience[0].description).toBe(pipeline.finalized.text);
    expect(pipeline.docxCv.experience[0].description).toBe(pipeline.finalized.text);
    expect(pipeline.stateCv.experience[0].originalUserDescription).toBe(SR_THREE);
    expect(pipeline.stateCv.experience[0].canonicalDescription || '').toContain('Sarađivala sam sa kuhinjskim timom');
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    expect(pipeline.finalized.origin).toBe('deterministic_fallback');
  });

  it('13–14. past role allows past Hindi but still forbids storage/meta', () => {
    const cv = makeCv(SR_THREE, { isPresent: false, endDate: '2024-06' });
    const factSet = buildCvCanonicalFactSet(cv);
    const pastOk = deterministicLocalizedBulletsFromCanonical(
      bulletsForExperience(factSet, 0),
      'hi',
      'female',
      { isPresent: false },
    );
    expect(pastOk).toMatch(/करती थी|रखती थी/);
    expect(pastOk).not.toMatch(/भंडारण/);
    expect(hasCvMetaFallbackText(pastOk)).toBe(false);

    const badPast = validateLocalizedExperienceBullets(BAD_HI_ALL, factSet, {
      locale: 'hi',
      gender: 'female',
      experienceIndex: 0,
      isPresent: false,
    });
    expect(badPast.violations.some((v) => v.kind === 'unsupported_generated_duty')).toBe(true);
    expect(badPast.violations.some((v) => v.kind === 'meta_fallback_text')).toBe(true);
  });
});

describe('cross-locale Present cooking without storage/meta', () => {
  it('15–18. sr/en/de/ar/ru/ja/pt-BR preserve three duties without meta or storage', () => {
    const cv = makeCv(SR_THREE);
    const facts = bulletsForExperience(buildCvCanonicalFactSet(cv), 0);
    const locales: Locale[] = ['sr', 'en', 'de', 'ar', 'ru', 'ja', 'pt-BR', 'hi'];
    for (const locale of locales) {
      const text = deterministicLocalizedBulletsFromCanonical(facts, locale, 'female', { isPresent: true });
      expect(text.trim(), locale).not.toBe('');
      expect(validateMaterialDutyCoverage(SR_THREE, text).valid, locale).toBe(true);
      expect(validateNoExtraGeneratedDuties(SR_THREE, text).valid, locale).toBe(true);
      expect(hasCvMetaFallbackText(text), locale).toBe(false);
      if (locale === 'sr') {
        expect(text).toMatch(/Pripremam/);
        expect(text).toMatch(/Održavam/);
        expect(text).toMatch(/Sarađujem/);
      }
      if (locale === 'en') {
        expect(text).toMatch(/\bPrepare\b/);
        expect(text).toMatch(/\bMaintain\b/);
        expect(text).toMatch(/\bCollaborate\b/);
      }
    }
  });
});

describe('generic no-expansion', () => {
  it('19. hygiene does not imply storage', () => {
    const src = 'Održavala sam higijenu radnog prostora.';
    expect(materialDutyKeysFromDescription(src)).toEqual(['hygiene_workplace']);
    const extras = validateNoExtraGeneratedDuties(
      src,
      'Followed hygiene and ingredient-storage procedures stated in the role duties.',
    );
    expect(extras.valid).toBe(false);
    expect(extras.extras).toContain('ingredient_or_material_storage');
    expect(hasCvMetaFallbackText(
      'Followed hygiene and ingredient-storage procedures stated in the role duties.',
    )).toBe(true);
  });

  it('20. delivery does not imply route planning', () => {
    const src = 'Deliver goods safely to their destination.';
    const extras = validateNoExtraGeneratedDuties(
      src,
      'Deliver goods safely and plan delivery routes for the warehouse.',
    );
    expect(extras.valid).toBe(false);
    expect(extras.extras).toContain('route_planning');
  });

  it('21. testing does not imply documentation', () => {
    const src = 'Test features with unit tests.';
    // documentation is a material key — use extra claim for medication-style pattern;
    // software_documentation is covered by material keys when present in generated text
    // without source support via classify on generated side... use validateNoExtra for storage-like.
    const generated = 'Test features with unit tests and document APIs for the team.';
    const required = materialDutyKeysFromDescription(src);
    expect(required).toEqual(['software_testing']);
    // Generated documentation is an unsupported software_documentation key vs source.
    const genKeys = materialDutyKeysFromDescription(generated);
    expect(genKeys).toContain('software_documentation');
    expect(genKeys.filter((k) => !required.includes(k) && k !== 'software_testing')).toContain('software_documentation');
  });

  it('22. customer communication does not imply sales targets', () => {
    const src = 'Communicate with clients about needs and proposals.';
    const extras = validateNoExtraGeneratedDuties(
      src,
      'Communicate with clients and hit monthly sales targets.',
    );
    expect(extras.valid).toBe(false);
    expect(extras.extras).toContain('sales_targets');
  });

  it('23. explicitly combined hygiene+storage in source remains allowed', () => {
    const src = 'Poštovala sam higijenske procedure i pravila skladištenja namirnica.';
    const hi = deterministicLocalizedBulletsFromCanonical(
      bulletsForExperience(buildFactSet(src), 0),
      'hi',
      'female',
      { isPresent: true },
    );
    expect(hi).toMatch(/भंडारण|स्वच्छ|higijen|hygiene|कार्यस्थल|सामग्री/i);
    expect(validateNoExtraGeneratedDuties(src, hi).valid).toBe(true);
  });
});

function buildFactSet(desc: string) {
  return buildCvCanonicalFactSet(makeCv(desc));
}

describe('50× cold hygiene-no-storage apply', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs 50 times from fresh state with zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = makeCv(SR_THREE);
      const frozen = ensureCanonicalExperienceFrozen(cv.experience[0]);
      expect(freezeCanonicalExperienceDescription(frozen)).toContain('higijenu');
      const pipeline = runCvAiApplyPipeline({
        cv: { ...cv, experience: [frozen] },
        locale: 'hi',
        action: 'experience_bullets',
        candidate: BAD_HI_ALL,
        experienceId: 'exp-hygiene',
      });
      expect(pipeline.blocked, `iter ${i}`).toBe(false);
      const text = pipeline.stateCv.experience[0].description;
      expect(text, `iter ${i}`).toMatch(/तैयार करती हैं/);
      expect(text, `iter ${i}`).toMatch(/स्वच्छता/);
      expect(text, `iter ${i}`).toMatch(/समन्वय करती हैं|सहयोग करती हैं/);
      expect(text, `iter ${i}`).not.toMatch(/भंडारण|भूमिका के कर्तव्यों|पालन किया|हूँ|हूं|थी/);
      expect(pipeline.stateCv.experience[0].originalUserDescription).toBe(SR_THREE);
    }
  });
});
