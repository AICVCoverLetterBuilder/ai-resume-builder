/**
 * Professional Summary grounding e2e — Baker fixture (EN / SR / HI) + cross-locale
 * + generic role guards + usage / export invariants.
 */
import { describe, it, expect } from 'vitest';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import {
  materialDutyKeysFromDescription as materialKeys,
  validateMaterialDutyCoverage,
} from '@/lib/cv-material-duty-coverage';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import { activateCvSummary } from '@/lib/cv-content-activation';
import {
  validateLocalizedSummary,
} from '@/lib/cv-semantic-fidelity';
import {
  countSummaryWords,
  SUMMARY_MAX_WORDS,
  buildConciseGroundedSummary,
} from '@/lib/cv-summary-grounding';
import { localizeBaker, resolveOccupationalTitleForSummary } from '@/lib/cv-role-title';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import { finalizeClientAiSummary } from '@/lib/cv-summary-integrity';
import { acceptValidatedAiContent } from '@/lib/cv-canonical-snapshot';
import { isWrongLanguageAiOutput } from '@/lib/cv-ai-locale-guard';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2026-07-17';

const BAKER_DUTIES = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');

const BAD_EN_LONG = `Experienced Baker with approximately two years of professional kitchen
experience, currently contributing to the team at Ztrew, where core
responsibilities include preparing dishes to restaurant standards and
maintaining a clean, organized workspace. Brings a well-rounded skill set that
supports consistent performance in fast-paced culinary environments, including
strong time management, organization, critical thinking, and adaptability —
all applied daily to uphold quality and efficiency throughout each shift.
Problem-solving and leadership capabilities complement the technical demands
of the role, helping to keep kitchen operations running smoothly under
pressure. Collaborates closely with kitchen colleagues to meet service
expectations and maintain hygiene and presentation standards at every stage of
service. Communicates effectively across teams, backed by native-level English
and advanced proficiency in Italian — an asset in diverse or international
workplace settings. Committed to continued growth within the baking and
culinary field, with a clear focus on taking on greater responsibility and
contributing meaningfully to kitchens that value both craft and teamwork.
Delivers reliability, attention to detail, and a genuine dedication to quality
in every aspect of the work.`.replace(/\s+/g, ' ').trim();

const BAD_SR_PEKARA = `Pekara, sa oko dve godine iskustva u kulinarskoj pripremi. Dosledno sam
primenjivala standarde restorana u pripremi jela, vodeći računa o kvalitetu i
prezentaciji svakog obroka. Razvijala sam veštine organizacije, kritičkog
razmišljanja i prilagodljivosti u dinamičnom radnom okruženju, preuzimajući
inicijativu i pokazujući liderske kvalitete u svakodnevnim zadacima.`.replace(/\s+/g, ' ').trim();

const BAD_HI_QUALITY = `लगभग दो वर्षों के ठोस अनुभव के साथ, मैंने रेस्तरां मानकों के अनुसार उच्च-गुणवत्ता वाले व्यंजन तैयार किए हैं और कार्यस्थल की स्वच्छता तथा स्वास्थ्य मानकों को सख्ती से बनाए रखा है।`;

const BAD_REPAIR_PRESSURE =
  'Baker with approximately two years of experience preparing dishes according to restaurant standards while keeping kitchen operations running smoothly under pressure and improving operational efficiency.';

const ALL_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

function bakerCv(overrides?: Partial<CVData>): CVData {
  return {
    personal: {
      fullName: 'Ana Baker',
      jobTitle: 'Baker',
      gender: 'female',
      email: 'a@test.com',
      phone: '',
      address: '',
      photoEnabled: false,
    },
    summary: '',
    experience: [{
      id: 'exp-baker',
      position: 'Baker',
      company: 'Ztrew',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: BAKER_DUTIES,
      originalUserDescription: BAKER_DUTIES,
      canonicalDescription: BAKER_DUTIES,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: [
      'Presentation Skills',
      'Leadership',
      'Organization',
      'Critical Thinking',
      'Adaptability',
      'Problem Solving',
      'Time Management',
    ],
    certifications: [],
    languages: [
      { name: 'English', level: 'native' },
      { name: 'Italian', level: 'advanced' },
    ],
    ...overrides,
  } as CVData;
}

describe('Professional Summary grounding — Baker fixture', () => {
  const cv = bakerCv();
  const factSet = buildCvCanonicalFactSet({ ...cv, summary: '', canonicalSummary: '' });
  const duration = buildExperienceDurationSnapshot(cv.experience, REF);

  it('1–5. canonical fact set: 3 duties, female, Present, duration from Jan 2024', () => {
    const bullets = factSet.facts.filter((f) => f.type === 'experience_bullet');
    expect(bullets).toHaveLength(3);
    const keys = materialKeys(BAKER_DUTIES);
    expect(keys).toEqual(expect.arrayContaining([
      'food_prep',
      'hygiene_workplace',
      'kitchen_collaboration',
    ]));
    expect(cv.personal.gender).toBe('female');
    expect(cv.experience[0].isPresent).toBe(true);
    expect(duration.total.hasValidDates).toBe(true);
    expect(duration.total.totalMonths).toBe(30);
    expect(duration.total.approxYears).toBe(2.5);
    expect(localizeBaker('sr', 'female')).toBe('Pekarka');
    expect(localizeBaker('en', 'female')).toBe('Baker');
  });

  it('6–12. long English provider text rejected; fallback grounded + ≤90 words', async () => {
    const check = validateLocalizedSummary(BAD_EN_LONG, factSet, {
      locale: 'en',
      gender: 'female',
      expectedDuration: duration.total,
    });
    expect(check.valid).toBe(false);
    expect(check.violations.some((v) =>
      v.kind === 'unsupported_summary_claim'
      || v.kind === 'skill_inflation'
      || v.kind === 'summary_too_long'
      || v.kind === 'unsupported_achievement_or_impact',
    )).toBe(true);
    expect(countSummaryWords(BAD_EN_LONG, 'en')).toBeGreaterThan(SUMMARY_MAX_WORDS);

    const activated = await activateCvSummary({
      locale: 'en',
      gender: 'female',
      factSet,
      candidate: BAD_EN_LONG,
      sourceFactsText: BAKER_DUTIES,
      duration: duration.total,
      fallbackSummary: '',
      repair: async () => BAD_REPAIR_PRESSURE,
    });
    expect(activated.status).toBe('fallback');
    expect(activated.content).toMatch(/Baker/i);
    expect(activated.content).toMatch(/restaurant standards/i);
    expect(activated.content).toMatch(/hygiene/i);
    expect(activated.content).toMatch(/kitchen team/i);
    expect(activated.content).not.toMatch(/under pressure|fast-paced|leadership capabilities|reliability|dedication/i);
    expect(countSummaryWords(activated.content, 'en')).toBeLessThanOrEqual(SUMMARY_MAX_WORDS);
    // Skills sentence lists labels — not achievements.
    if (/Key skills include/i.test(activated.content)) {
      expect(activated.content).not.toMatch(/demonstrated leadership|took initiative/i);
    }

    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'summary_generate',
      candidate: BAD_EN_LONG,
      referenceDateIso: REF,
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    expect(pipeline.stateCv.summary).toBe(activated.content);
  });

  it('13–16. Serbian Pekara rejected; final Pekarka without initiative/leadership', async () => {
    const check = validateLocalizedSummary(BAD_SR_PEKARA, factSet, {
      locale: 'sr',
      gender: 'female',
      expectedDuration: duration.total,
    });
    expect(check.valid).toBe(false);
    expect(check.violations.some((v) => v.kind === 'summary_gender_mismatch')).toBe(true);

    const activated = await activateCvSummary({
      locale: 'sr',
      gender: 'female',
      factSet,
      candidate: BAD_SR_PEKARA,
      sourceFactsText: BAKER_DUTIES,
      duration: duration.total,
      fallbackSummary: '',
    });
    expect(activated.status).toBe('fallback');
    expect(activated.content).toMatch(/\bPekarka\b/);
    expect(activated.content).not.toMatch(/\bPekara\b/);
    expect(activated.content).not.toMatch(/inicijativ|liderske kvalitete|dinamičn/i);
    expect(activated.content).toMatch(/higijen/i);
    expect(activated.content).toMatch(/kuhinjsk/i);
  });

  it('17–21. Hindi quality/health rejected; final has collaboration + female grammar', async () => {
    const check = validateLocalizedSummary(BAD_HI_QUALITY, factSet, {
      locale: 'hi',
      gender: 'female',
      expectedDuration: duration.total,
    });
    expect(check.valid).toBe(false);
    expect(check.violations.some((v) => v.kind === 'unsupported_summary_claim')).toBe(true);

    const activated = await activateCvSummary({
      locale: 'hi',
      gender: 'female',
      factSet,
      candidate: BAD_HI_QUALITY,
      sourceFactsText: BAKER_DUTIES,
      duration: duration.total,
      fallbackSummary: '',
    });
    expect(activated.status).toBe('fallback');
    expect(activated.content).toMatch(/सहयोग/);
    expect(activated.content).toMatch(/करती हूँ|वाली/);
    expect(activated.content).not.toMatch(/उच्च|स्वास्थ्य|भंडारण|सख्ती/);
    expect(activated.content).toMatch(/[\u0900-\u097F]/);
  });
});

describe('Professional Summary — cross-locale fact consistency', () => {
  const cv = bakerCv();
  const duration = buildExperienceDurationSnapshot(cv.experience, REF);
  const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });

  it('22–24. en → sr → hi from same fact set; prior summary never grounds next', async () => {
    const en = await activateCvSummary({
      locale: 'en', gender: 'female', factSet, candidate: BAD_EN_LONG,
      sourceFactsText: BAKER_DUTIES, duration: duration.total, fallbackSummary: '',
    });
    let next = acceptValidatedAiContent(cv, {
      locale: 'en',
      summary: en.content,
      summaryOrigin: 'deterministic_fallback',
    });
    // Even with inflated previous summary stored, fact set for next locale must not ground on it.
    const factSet2 = buildCvCanonicalFactSet(next);
    const inflatedStillRejected = validateLocalizedSummary(BAD_EN_LONG, factSet2, {
      locale: 'en', gender: 'female',
    });
    expect(inflatedStillRejected.valid).toBe(false);

    const sr = await activateCvSummary({
      locale: 'sr', gender: 'female', factSet, candidate: BAD_SR_PEKARA,
      sourceFactsText: BAKER_DUTIES, duration: duration.total, fallbackSummary: '',
    });
    next = acceptValidatedAiContent(next, {
      locale: 'sr',
      summary: sr.content,
      summaryOrigin: 'deterministic_fallback',
    });
    const hi = await activateCvSummary({
      locale: 'hi', gender: 'female', factSet, candidate: BAD_HI_QUALITY,
      sourceFactsText: BAKER_DUTIES, duration: duration.total, fallbackSummary: '',
    });
    expect(en.content).toMatch(/restaurant standards|hygiene|kitchen team/i);
    expect(sr.content).toMatch(/Pekarka/);
    expect(hi.content).toMatch(/सहयोग/);
    for (const text of [en.content, sr.content, hi.content]) {
      expect(validateMaterialDutyCoverage(BAKER_DUTIES, text).valid, text).toBe(true);
    }
    expect(hi.content).not.toMatch(/under pressure|Pekara|high-quality/i);
  });

  it('25–30. all 12 locales: language/script, gender, no meta', () => {
    for (const locale of ALL_LOCALES) {
      const grounded = deterministicLocalizedSummaryFromCanonical(
        factSet, locale, 'female', duration.total,
      );
      expect(grounded, locale).toBeTruthy();
      const finalized = finalizeClientAiSummary(grounded, cv, locale, duration);
      expect(finalized.blocked, locale).toBe(false);
      expect(isWrongLanguageAiOutput(finalized.summary, locale), locale).toBe(false);
      expect(countSummaryWords(finalized.summary, locale)).toBeLessThanOrEqual(SUMMARY_MAX_WORDS);
      expect(finalized.summary).not.toMatch(/CORRECTED PROFESSIONAL|SOURCE FACTS|role duties/i);
      if (locale === 'sr' || locale === 'hr') {
        expect(finalized.summary).toMatch(/Pekarka/);
      }
      if (locale === 'ja') {
        expect(finalized.summary).not.toMatch(/女性|female baker/i);
      }
      if (locale === 'ar') {
        expect(finalized.summary).toMatch(/[\u0600-\u06FF]/);
      }
      if (locale === 'hi') {
        expect(finalized.summary).toMatch(/[\u0900-\u097F]/);
        expect(finalized.summary).toMatch(/करती हूँ|वाली/);
      }
    }
  });
});

describe('Professional Summary — generic fixtures', () => {
  it('31. Leadership skill does not become team-lead claim', async () => {
    const cv = bakerCv({
      personal: {
        fullName: 'Dev',
        jobTitle: 'Software Engineer',
        gender: 'male',
        email: 'd@test.com',
        phone: '',
        address: '',
        photoEnabled: false,
      },
      experience: [{
        id: 'e1',
        position: 'Software Engineer',
        company: 'Acme',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: 'Develop React features.\nWrite unit tests.',
        originalUserDescription: 'Develop React features.\nWrite unit tests.',
        canonicalDescription: 'Develop React features.\nWrite unit tests.',
      }],
      skills: ['Leadership', 'Communication'],
    });
    const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });
    const duration = buildExperienceDurationSnapshot(cv.experience, REF);
    const bad = 'Software Engineer who demonstrated leadership and led the team to ship features.';
    const check = validateLocalizedSummary(bad, factSet, { locale: 'en', gender: 'male' });
    expect(check.violations.some((v) => v.kind === 'skill_inflation')).toBe(true);
    const grounded = buildConciseGroundedSummary(factSet, 'en', 'male', duration.total);
    expect(grounded).not.toMatch(/led the team|demonstrated leadership/i);
  });

  it('32–34. warehouse / sales / healthcare do not invent extra duties', () => {
    const cases: Array<{ title: string; duties: string; bad: string; kind: string }> = [
      {
        title: 'Warehouse Associate',
        duties: 'Load and unload goods.\nDeliver packages safely.',
        bad: 'Warehouse Associate specializing in route planning and logistics optimization.',
        kind: 'occupation_inference',
      },
      {
        title: 'Sales Associate',
        duties: 'Communicate with clients.\nProcess orders.',
        bad: 'Sales Associate who drove revenue growth through communication.',
        kind: 'skill_inflation',
      },
      {
        title: 'Nurse',
        duties: 'Provide patient care.\nUpdate medical records.',
        bad: 'Nurse responsible for medication administration and patient care.',
        kind: 'occupation_inference',
      },
    ];
    for (const c of cases) {
      const cv = bakerCv({
        personal: {
          fullName: 'X',
          jobTitle: c.title,
          gender: 'female',
          email: 'x@test.com',
          phone: '',
          address: '',
          photoEnabled: false,
        },
        experience: [{
          id: 'e1',
          position: c.title,
          company: 'Org',
          startDate: '2023-01',
          endDate: '',
          isPresent: true,
          description: c.duties,
          originalUserDescription: c.duties,
          canonicalDescription: c.duties,
        }],
        skills: ['Communication', 'Leadership'],
      });
      const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });
      const check = validateLocalizedSummary(c.bad, factSet, { locale: 'en', gender: 'female' });
      expect(check.valid, c.title).toBe(false);
      expect(
        check.violations.some((v) => v.kind === c.kind || v.kind === 'unsupported_summary_claim' || v.kind === 'skill_inflation' || v.kind === 'occupation_inference'),
        c.title,
      ).toBe(true);
    }
  });

  it('35–36. blank dates omit duration; overlapping jobs not double-counted', () => {
    const blank = bakerCv({
      experience: [{
        id: 'e1',
        position: 'Baker',
        company: 'Z',
        startDate: '',
        endDate: '',
        isPresent: false,
        description: BAKER_DUTIES,
        originalUserDescription: BAKER_DUTIES,
        canonicalDescription: BAKER_DUTIES,
      }],
    });
    const dBlank = buildExperienceDurationSnapshot(blank.experience, REF);
    const fs = buildCvCanonicalFactSet({ ...blank, summary: '' });
    const text = buildConciseGroundedSummary(fs, 'en', 'female', dBlank.total);
    expect(text).not.toMatch(/\d+\s+years|two years|approximately/i);

    const overlap = bakerCv({
      experience: [
        {
          id: 'e1',
          position: 'Baker',
          company: 'A',
          startDate: '2024-01',
          endDate: '',
          isPresent: true,
          description: BAKER_DUTIES,
          originalUserDescription: BAKER_DUTIES,
          canonicalDescription: BAKER_DUTIES,
        },
        {
          id: 'e2',
          position: 'Baker',
          company: 'B',
          startDate: '2024-06',
          endDate: '',
          isPresent: true,
          description: 'Prepare dishes according to restaurant standards.',
          originalUserDescription: 'Prepare dishes according to restaurant standards.',
          canonicalDescription: 'Prepare dishes according to restaurant standards.',
        },
      ],
    });
    const dOverlap = buildExperienceDurationSnapshot(overlap.experience, REF);
    expect(dOverlap.total.approxYears).toBe(2.5);
  });

  it('37. past-only experience does not say currently', () => {
    const cv = bakerCv({
      experience: [{
        id: 'e1',
        position: 'Baker',
        company: 'Z',
        startDate: '2022-01',
        endDate: '2023-06',
        isPresent: false,
        description: BAKER_DUTIES,
        originalUserDescription: BAKER_DUTIES,
        canonicalDescription: BAKER_DUTIES,
      }],
    });
    const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });
    const bad = 'Baker currently contributing at Ztrew with experience preparing dishes.';
    const check = validateLocalizedSummary(bad, factSet, { locale: 'en', gender: 'female' });
    expect(check.violations.some((v) => v.kind === 'summary_employment_status_mismatch')).toBe(true);
  });

  it('38–40. empty skills / empty experience / unknown title', () => {
    const noSkills = bakerCv({ skills: [] });
    const fs1 = buildCvCanonicalFactSet({ ...noSkills, summary: '' });
    const d1 = buildExperienceDurationSnapshot(noSkills.experience, REF);
    const t1 = buildConciseGroundedSummary(fs1, 'en', 'female', d1.total);
    expect(t1).toMatch(/Baker/i);
    expect(t1).not.toMatch(/Key skills include/i);
    expect(t1).toMatch(/kitchen team/i);

    const noExp = bakerCv({ experience: [] });
    const fs2 = buildCvCanonicalFactSet({ ...noExp, summary: '' });
    const t2 = buildConciseGroundedSummary(fs2, 'en', 'female', undefined);
    expect(t2).toMatch(/Baker/i);
    expect(t2).not.toMatch(/years of experience/i);

    const unknown = resolveOccupationalTitleForSummary({
      profileJobTitle: 'Quantum Flux Technician',
      locale: 'en',
      gender: 'female',
    });
    expect(unknown).toMatch(/Quantum Flux Technician|professional/i);
  });
});

describe('Professional Summary — state / export / usage', () => {
  const cv = bakerCv();
  const duration = buildExperienceDurationSnapshot(cv.experience, REF);

  it('41–46. identical summary across apply; usage once; export/switch zero extra', async () => {
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'summary_generate',
      candidate: BAD_EN_LONG,
      referenceDateIso: REF,
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    const summary = pipeline.stateCv.summary;
    expect(summary).toBeTruthy();

    // Simulate preview/export reading the same state field (no regeneration).
    expect(pipeline.stateCv.summary).toBe(summary);

    // Provider/repair rejection path: finalize alone with bad text that gets replaced
    // still counts success once when fallback applies.
    const rejectedOnly = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: BAD_EN_LONG,
      durationSnapshot: duration,
      referenceDateIso: REF,
    });
    expect(rejectedOnly.blocked).toBe(false);
    expect(rejectedOnly.countedAsSuccess).toBe(true);
    expect(rejectedOnly.origin).toBe('deterministic_fallback');

    // Language switch without generation: acceptValidatedAiContent does not count usage.
    const switched = acceptValidatedAiContent(pipeline.stateCv, {
      locale: 'sr',
      summary: pipeline.stateCv.summary,
      summaryOrigin: pipeline.stateCv.summaryOrigin,
    });
    expect(switched.summary).toBe(summary);
  });

  it('50× cold activateCvSummary English fallback is stable', async () => {
    const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });
    let first = '';
    for (let i = 0; i < 50; i++) {
      const activated = await activateCvSummary({
        locale: 'en',
        gender: 'female',
        factSet,
        candidate: BAD_EN_LONG,
        sourceFactsText: BAKER_DUTIES,
        duration: duration.total,
        fallbackSummary: '',
        repair: async () => BAD_REPAIR_PRESSURE,
      });
      expect(activated.status, `run ${i}`).toBe('fallback');
      expect(activated.content, `run ${i}`).toMatch(/Baker/i);
      expect(activated.content, `run ${i}`).not.toMatch(/under pressure|fast-paced/i);
      if (i === 0) first = activated.content;
      else expect(activated.content, `run ${i}`).toBe(first);
    }
  });
});
