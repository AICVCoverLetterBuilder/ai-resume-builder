import { describe, it, expect } from 'vitest';
import {
  splitExperienceBullets,
  buildCvCanonicalFactSet,
  classifyDutyCategory,
  ensureCanonicalExperienceFrozen,
  freezeCanonicalExperienceDescription,
  formatExperienceBullets,
} from '@/lib/cv-canonical-facts';
import { deterministicLocalizedBulletsFromCanonical } from '@/lib/cv-localized-fallback';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

/** Exact Android textarea-style Serbian cooking duties (inline • separators). */
export const SR_COOKING_INLINE =
  '• Pripremala sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana Boranija. • Organizovala sam pripremu namirnica i održavala uredan radni prostor u kuhinji. • Sarađivala sam sa kolegama iz kuhinjskog tima tokom dnevnog servisa. • Poštovala sam higijenske procedure i pravila skladištenja namirnica.';

export const SR_COOKING_NL = `• Pripremala sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana Boranija.
• Organizovala sam pripremu namirnica i održavala uredan radni prostor u kuhinji.
• Sarađivala sam sa kolegama iz kuhinjskog tima tokom dnevnog servisa.
• Poštovala sam higijenske procedure i pravila skladištenja namirnica.`;

const GROUNDED_EN = formatExperienceBullets([
  'Prepared Serbian and Mediterranean dishes in accordance with the restaurant’s established standards.',
  'Organized food-preparation tasks and maintained an orderly kitchen workstation.',
  'Coordinated with kitchen colleagues during daily service.',
  'Followed hygiene and ingredient-storage procedures stated in the role duties.',
]);

const BAD_EN_INVENTIONS = formatExperienceBullets([
  'Increased revenue and customer satisfaction across the dining room.',
  'Led the kitchen team and owned menu development.',
  'Reduced food costs through inventory ownership.',
  'Won awards for speed and efficiency improvements.',
]);

const BAD_SR_FOR_EN = SR_COOKING_NL;

function makeCookingCv(desc: string, opts?: { canonicalEmpty?: boolean }): CVData {
  const frozen = opts?.canonicalEmpty ? undefined : desc;
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
      id: 'exp-cook-1',
      position: 'Kuvar',
      company: 'Boranija',
      startDate: '2022-01',
      endDate: '',
      isPresent: true,
      description: desc,
      ...(frozen ? { canonicalDescription: frozen } : {}),
    }],
    education: [],
    skills: ['Organization'],
    certifications: [],
    languages: [{ name: 'French', level: 'advanced' }],
  } as CVData;
}

describe('Serbian cooking → English AI Improvements apply pipeline', () => {
  it('1. bullet glyph parsing preserves every canonical duty (inline + newline)', () => {
    expect(splitExperienceBullets(SR_COOKING_INLINE)).toHaveLength(4);
    expect(splitExperienceBullets(SR_COOKING_NL)).toHaveLength(4);
    expect(splitExperienceBullets(SR_COOKING_INLINE)[0]).toMatch(/Pripremala sam jela/);
    expect(splitExperienceBullets(SR_COOKING_INLINE)[3]).toMatch(/higijenske/);
  });

  it('2. Serbian inflected cooking verbs classify correctly', () => {
    const units = splitExperienceBullets(SR_COOKING_NL);
    expect(classifyDutyCategory(units[0])).toBe('food_preparation');
    expect(classifyDutyCategory(units[1])).toBe('food_preparation');
    expect(classifyDutyCategory(units[2])).toBe('food_preparation');
    expect(classifyDutyCategory(units[3])).toBe('hygiene_safety');
  });

  it('3. legacy freeze: empty canonicalDescription freezes user Serbian duties', () => {
    const cv = makeCookingCv(SR_COOKING_NL, { canonicalEmpty: true });
    expect(cv.experience[0].canonicalDescription).toBeUndefined();
    const frozen = ensureCanonicalExperienceFrozen(cv.experience[0]);
    expect(freezeCanonicalExperienceDescription(frozen)).toContain('Pripremala sam jela');
    expect(frozen.canonicalDescription).toBe(SR_COOKING_NL);
  });

  it('4. first AI Improvements click succeeds with grounded provider English', () => {
    const cv = makeCookingCv(SR_COOKING_INLINE);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: GROUNDED_EN,
      experienceId: 'exp-cook-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    expect(pipeline.stateCv.experience[0].description).toMatch(/Prepared Serbian and Mediterranean/);
    expect(pipeline.stateCv.experience[0].canonicalDescription).toContain('Pripremala sam jela');
  });

  it('5. invented achievements → rejected; deterministic English fallback applied', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: BAD_EN_INVENTIONS,
      experienceId: 'exp-cook-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.origin).toBe('deterministic_fallback');
    expect(pipeline.stateCv.experience[0].description).not.toMatch(/Increased revenue|menu development|awards/i);
    expect(pipeline.stateCv.experience[0].description).toMatch(/dish|kitchen|hygiene|ingredient/i);
    expect(pipeline.stateCv.experience[0].canonicalDescription).toContain('Pripremala sam jela');
  });

  it('6. Serbian provider output for English request → English fallback', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: BAD_SR_FOR_EN,
      experienceId: 'exp-cook-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.origin).toBe('deterministic_fallback');
    expect(pipeline.stateCv.experience[0].description).toMatch(/Prepare|Organize|Coordinate|Follow/i);
    expect(pipeline.stateCv.experience[0].description).not.toMatch(/Pripremala sam/);
  });

  it('7. empty/timeout candidate → deterministic English fallback', () => {
    const cv = makeCookingCv(SR_COOKING_INLINE);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-cook-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.origin).toBe('deterministic_fallback');
    expect(splitExperienceBullets(pipeline.stateCv.experience[0].description)).toHaveLength(4);
  });

  it('8. canonicalDescription remains Serbian; generated description is English', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    const before = cv.experience[0].canonicalDescription!;
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: GROUNDED_EN,
      experienceId: 'exp-cook-1',
    });
    const next = applyFinalizedBulletsToCv(cv, 'en', 'exp-cook-1', finalized);
    expect(next.experience[0].canonicalDescription).toBe(before);
    expect(next.experience[0].description).toMatch(/Prepared Serbian/);
  });

  it('9. industry/level metadata do not invent management or impact', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    const facts = buildCvCanonicalFactSet(cv).facts.filter((f) => f.type === 'experience_bullet');
    const withMeta = deterministicLocalizedBulletsFromCanonical(facts, 'en', 'female');
    const withoutMeta = deterministicLocalizedBulletsFromCanonical(facts, 'en', 'female');
    expect(withMeta).toBe(withoutMeta);
    expect(withMeta).not.toMatch(/leadership|revenue|management ownership|awards/i);
    expect(withMeta).toMatch(/dish|kitchen|hygiene|ingredient/i);
  });

  it('10. female Serbian source does not block natural English bullets', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: GROUNDED_EN,
      experienceId: 'exp-cook-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.reason).toBeUndefined();
  });

  it('11. state / preview / PDF / DOCX projections share finalized English', () => {
    const cv = makeCookingCv(SR_COOKING_INLINE);
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-cook-1',
    });
    const text = pipeline.finalized.text;
    expect(pipeline.stateCv.experience[0].description).toBe(text);
    expect(pipeline.previewCv.experience[0].description).toContain(
      splitExperienceBullets(text)[0].slice(0, 40),
    );
    expect(pipeline.pdfCv.experience[0].description).toContain(
      splitExperienceBullets(text)[0].slice(0, 40),
    );
    expect(pipeline.docxCv.experience[0].description).toContain(
      splitExperienceBullets(text)[0].slice(0, 40),
    );
  });

  it('12. usage: success counts once; terminal block counts zero', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    const ok = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: GROUNDED_EN,
      experienceId: 'exp-cook-1',
    });
    expect(ok.countedAsSuccess).toBe(true);
    // No duties + empty candidate → nothing to apply
    const emptyCv = makeCookingCv('');
    emptyCv.experience[0].canonicalDescription = '';
    emptyCv.experience[0].description = '';
    const blocked = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv: emptyCv,
      candidate: '',
      experienceId: 'exp-cook-1',
    });
    expect(blocked.blocked).toBe(true);
    expect(blocked.countedAsSuccess).toBe(false);
  });

  it('13. locale switch EN → SR still grounds from original Serbian canonical', () => {
    let cv = makeCookingCv(SR_COOKING_NL);
    const en = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: GROUNDED_EN,
      experienceId: 'exp-cook-1',
    });
    cv = en.stateCv;
    const sr = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '• Invented English leftover\n• Should not become canonical',
      experienceId: 'exp-cook-1',
    });
    expect(sr.stateCv.experience[0].canonicalDescription).toContain('Pripremala sam jela');
    expect(sr.stateCv.experience[0].description).toMatch(/Priprem|Organiz|Sarađ|Poštov|jela|kuhinj|higijen/i);
  });

  it('14. representative: Serbian → Hindi / German cooking bullets', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    for (const locale of ['hi', 'de'] as Locale[]) {
      const pipeline = runCvAiApplyPipeline({
        cv,
        locale,
        action: 'experience_bullets',
        candidate: '',
        experienceId: 'exp-cook-1',
      });
      expect(pipeline.blocked, locale).toBe(false);
      expect(splitExperienceBullets(pipeline.stateCv.experience[0].description).length).toBe(4);
      expect(pipeline.stateCv.experience[0].canonicalDescription).toContain('Pripremala');
    }
  });

  it('15. English → Serbian duties (generic occupation) still works', () => {
    const enDuties = formatExperienceBullets([
      'Transport, load and safely deliver goods within warehouse operations.',
      'Work on the development and implementation of internal processes.',
      'Collaborate with cross-functional teams on project execution.',
      'Analyze business data and prepare reports for senior management.',
    ]);
    const cv = {
      ...makeCookingCv(enDuties),
      personal: { ...makeCookingCv(enDuties).personal, jobTitle: 'Warehouse Operator' },
    } as CVData;
    cv.experience[0].position = 'Warehouse Operator';
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'sr',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-cook-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.stateCv.experience[0].description).toMatch(/Transport|proces|Sarađ|Analiz/i);
  });

  it('16. non-cooking occupation remains generic (teacher + software not neutralized wrongly for bullets)', () => {
    const duties = formatExperienceBullets([
      'Develop React applications and deploy APIs.',
      'Write unit tests in TypeScript.',
    ]);
    const cv = makeCookingCv(duties);
    cv.personal.jobTitle = 'Teacher';
    cv.experience[0].position = 'Teacher';
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: duties,
      experienceId: 'exp-cook-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.stateCv.experience[0].description).toMatch(/React|TypeScript/);
  });

  it('17. applyCvContentQuality projection does not rewrite canonical Serbian', () => {
    const cv = makeCookingCv(SR_COOKING_NL);
    const en = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: GROUNDED_EN,
      experienceId: 'exp-cook-1',
    });
    const q = applyCvContentQuality(en.stateCv, 'en', { gender: 'female' });
    expect(en.stateCv.experience[0].canonicalDescription).toContain('Pripremala');
    expect(q.cv.experience[0].canonicalDescription || en.stateCv.experience[0].canonicalDescription)
      .toContain('Pripremala');
  });
});

describe('50× cold-state Serbian cooking AI Improvements', () => {
  it('50 independent runs with zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = makeCookingCv(i % 2 === 0 ? SR_COOKING_INLINE : SR_COOKING_NL);
      const pipeline = runCvAiApplyPipeline({
        cv,
        locale: 'en',
        action: 'experience_bullets',
        candidate: i % 3 === 0 ? '' : i % 3 === 1 ? BAD_EN_INVENTIONS : GROUNDED_EN,
        experienceId: 'exp-cook-1',
      });
      expect(pipeline.blocked, `run ${i}`).toBe(false);
      expect(pipeline.finalized.countedAsSuccess, `run ${i}`).toBe(true);
      expect(pipeline.stateCv.experience[0].canonicalDescription, `run ${i}`).toMatch(/Pripremala sam jela/);
      expect(pipeline.stateCv.experience[0].description, `run ${i}`).not.toMatch(/Pripremala sam/);
      expect(pipeline.stateCv.experience[0].description, `run ${i}`).not.toMatch(/Increased revenue/i);
      expect(splitExperienceBullets(pipeline.stateCv.experience[0].description).length, `run ${i}`).toBe(4);
    }
  });
});
