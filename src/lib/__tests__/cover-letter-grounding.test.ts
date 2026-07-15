// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import {
  buildDeterministicSparseCoverLetter,
  validateCoverLetterGrounding,
} from '../cover-letter-grounding';
import { assembleCoverLetterContent } from '../cover-letter-generation';
import type { Locale } from '../i18n/translations';

const ALL_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

describe('cover letter source facts', () => {
  test('sparse input yields empty professional facts', () => {
    const factSet = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Salesman',
      companyName: 'Acme',
    });
    expect(factSet.isSparse).toBe(true);
    expect(factSet.facts.some((f) => f.type === 'skill')).toBe(false);
    expect(factSet.facts.find((f) => f.type === 'target_position')?.value).toBe('Salesman');
  });

  test('explicit Excel skill is captured without inventing CRM', () => {
    const factSet = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Salesman',
      companyName: 'Acme',
      skills: ['Microsoft Excel'],
    });
    expect(factSet.isSparse).toBe(false);
    expect(factSet.facts.some((f) => /excel/i.test(f.value))).toBe(true);
    expect(factSet.facts.some((f) => /crm/i.test(f.value))).toBe(false);
  });
});

describe('cover letter grounding validation', () => {
  test('rejects unsupported technologies when facts have none', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Salesman',
      companyName: 'Acme',
    });
    const draft =
      'I am applying for Salesman at Acme. I know Java, Python, databases, cloud systems, and Agile well.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === 'named_skill_or_tool')).toBe(true);
  });

  test('rejects leadership without evidence', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Developer',
      companyName: 'Acme',
    });
    const draft = 'I led several software projects from design through launch at previous companies.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === 'leadership_claim')).toBe(true);
  });

  test('rejects metrics without source numbers', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Developer',
      companyName: 'Acme',
    });
    const draft = 'I have 5 years of experience and improved efficiency by 30%.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === 'numeric_claim' || v.kind === 'experience_strength_claim')).toBe(
      true,
    );
  });

  test('job description requirements are not treated as candidate experience', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Developer',
      companyName: 'Acme',
      jobDescription: 'Requires 5 years of experience and Python.',
    });
    const draft =
      'I am interested in the Developer role at Acme. I have 5 years of experience and expert Python skills.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(false);
  });

  test('allows Python and two years when present in facts', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Developer',
      companyName: 'Acme',
      skills: ['Python'],
      experience: [
        {
          position: 'Junior Developer',
          company: 'PastCo',
          description: 'Built internal tools with Python across 2 years of experience.',
          startDate: '2022',
          endDate: '2024',
          isPresent: false,
        },
      ],
    });
    const draft =
      'I am applying for Developer at Acme. My work at PastCo included Python development across 2 years of experience.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(true);
  });

  test('deterministic fallback is grounded for every locale', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Salesman',
      companyName: 'Acme',
    });
    for (const locale of ALL_LOCALES) {
      const letter = buildDeterministicSparseCoverLetter(locale, {
        candidateName: 'Alex Carter',
        jobTitle: 'Salesman',
        companyName: 'Acme',
        factSet: facts,
        dateLine: '2026-07-12',
      });
      const text = assembleCoverLetterContent(letter);
      const grounding = validateCoverLetterGrounding(text, facts);
      expect(grounding.valid, locale).toBe(true);
      expect(text.toLowerCase()).not.toMatch(/\b(java|python|agile|crm)\b/i);
      expect(letter.candidateName).toBe('Alex Carter');
    }
  });

  test('Arabic fallback uses natural phrasing and Arabic comma-friendly sign-off', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'مطوّر برمجيات',
      companyName: 'Gnoogy',
    });
    const letter = buildDeterministicSparseCoverLetter('ar', {
      candidateName: 'Alex Carter',
      jobTitle: 'مطوّر برمجيات',
      companyName: 'Gnoogy',
      factSet: facts,
      dateLine: '12 يوليو 2026',
    });
    expect(letter.greeting).toContain('إلى فريق التوظيف المحترم في شركة');
    expect(letter.paragraph1).toContain('أتقدم بطلب لشغل وظيفة');
    expect(letter.paragraph1).not.toContain('بوصفي');
    expect(letter.closing).not.toContain('قيمة حقيقية');
    expect(letter.signOff).toContain('مع خالص التحية');
  });

  test('all locale sparse fallbacks avoid meta/system wording', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
    });
    for (const locale of ALL_LOCALES) {
      const letter = buildDeterministicSparseCoverLetter(locale, {
        candidateName: 'Alex Carter',
        jobTitle: 'Software Developer',
        companyName: 'Gnox',
        factSet: facts,
        dateLine: '2026-07-14',
      });
      const text = assembleCoverLetterContent(letter);
      expect(text).not.toMatch(/source details|limited information|sparse|fallback|AI-?generated|SOURCE FACTS/i);
      expect(text).toContain('Software Developer');
      expect(letter.candidateName).toBe('Alex Carter');
      expect(validateCoverLetterGrounding(text, facts).valid, locale).toBe(true);
    }
  });

  test('English sparse fallback does not leak source-details phrasing', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
    });
    const letter = buildDeterministicSparseCoverLetter('en', {
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
      factSet: facts,
      dateLine: 'July 14, 2026',
    });
    const text = assembleCoverLetterContent(letter);
    expect(text).not.toMatch(/source details/i);
    expect(text).not.toMatch(/limited information/i);
    expect(text).toMatch(/express my interest/i);
    expect(text).toContain('Software Developer');
    expect(text).not.toMatch(/attention to detail|professionalism|quality assurance|positive impact|strong work ethic/i);
  });

  test('meta wording is rejected by grounding validation', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Developer',
      companyName: 'Acme',
    });
    const draft = 'While my source details are limited, I am applying for Developer at Acme.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === 'meta_or_system_wording')).toBe(true);
  });

  test('rejects unsupported personal qualities and role-derived duties', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
    });
    const draft =
      'I apply for Android tester at Gnof. I bring professionalism and attention to detail and will contribute meaningfully to Gnof\'s quality assurance efforts with test automation.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === 'personality_claim')).toBe(true);
    expect(result.violations.some((v) => v.kind === 'role_inferred_duty')).toBe(true);
  });

  test('allows explicitly supplied personal quality', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex',
      jobTitle: 'Developer',
      companyName: 'Acme',
      summary: 'Detail-oriented developer focused on clear delivery.',
      skills: ['teamwork'],
    });
    const draft =
      'I am applying for Developer at Acme. I am detail-oriented and value teamwork.';
    const result = validateCoverLetterGrounding(draft, facts);
    expect(result.valid).toBe(true);
  });

  test('Hindi sparse fallback is gender-neutral without personality filler', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
    });
    const letter = buildDeterministicSparseCoverLetter('hi', {
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
      factSet: facts,
      dateLine: '14 जुलाई 2026',
      gender: 'unspecified',
    });
    const text = assembleCoverLetterContent(letter);
    expect(text).not.toMatch(/चाहता\/चाहती|करूँगा\/करूँगी|रहा\/रही/);
    expect(text).not.toMatch(/चाहता हूँ|चाहती हूँ|कर रहा हूँ|कर रही हूँ/);
    expect(text).not.toMatch(/ईमानदारी|लगन/);
    expect(text).toContain('Software Developer');
    expect(text).toContain('यह आवेदन प्रस्तुत है');
    expect(validateCoverLetterGrounding(text, facts).valid).toBe(true);
  });

  test('Hindi female sparse fallback uses feminine forms only', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
    });
    const letter = buildDeterministicSparseCoverLetter('hi', {
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
      factSet: facts,
      dateLine: '14 जुलाई 2026',
      gender: 'female',
    });
    const text = assembleCoverLetterContent(letter);
    expect(text).toContain('प्रस्तुत कर रही हूँ');
    expect(text).toContain('मैं साक्षात्कार के लिए उपलब्ध हूँ');
    expect(text).not.toContain('प्रस्तुत कर रहा हूँ');
    expect(text).not.toContain('उपलब्ध रहना चाहती हूँ');
    expect(text).not.toMatch(/चाहता\/चाहती|रहा\/रही/);
    expect(validateCoverLetterGrounding(text, facts).valid).toBe(true);
  });

  test('Hindi male sparse fallback uses masculine forms only', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
    });
    const letter = buildDeterministicSparseCoverLetter('hi', {
      candidateName: 'Alex Carter',
      jobTitle: 'Software Developer',
      companyName: 'Gnox',
      factSet: facts,
      dateLine: '14 जुलाई 2026',
      gender: 'male',
    });
    const text = assembleCoverLetterContent(letter);
    expect(text).toContain('प्रस्तुत कर रहा हूँ');
    expect(text).toContain('मैं साक्षात्कार के लिए उपलब्ध हूँ');
    expect(text).not.toContain('प्रस्तुत कर रही हूँ');
    expect(text).not.toContain('उपलब्ध रहना चाहता हूँ');
    expect(text).not.toMatch(/चाहता\/चाहती|रहा\/रही/);
    expect(validateCoverLetterGrounding(text, facts).valid).toBe(true);
  });

  test('gendered locale sparse fallbacks preserve selected gender without slash placeholders', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
    });
    const cases: Array<{ locale: typeof ALL_LOCALES[number]; gender: 'male' | 'female'; mustInclude: string; mustNotInclude: string }> = [
      { locale: 'fr', gender: 'female', mustInclude: 'Je serais ravie', mustNotInclude: "Je serais ravi d" },
      { locale: 'fr', gender: 'male', mustInclude: "Je serais ravi d", mustNotInclude: 'Je serais ravie' },
      { locale: 'it', gender: 'female', mustInclude: 'Sarei lieta', mustNotInclude: 'Sarei lieto' },
      { locale: 'it', gender: 'male', mustInclude: 'Sarei lieto', mustNotInclude: 'Sarei lieta' },
      { locale: 'es', gender: 'female', mustInclude: 'interesada', mustNotInclude: 'interesado' },
      { locale: 'es', gender: 'male', mustInclude: 'interesado', mustNotInclude: 'interesada' },
      { locale: 'ru', gender: 'female', mustInclude: 'Готова к собеседованию', mustNotInclude: 'Готов к собеседованию' },
      { locale: 'ru', gender: 'male', mustInclude: 'Готов к собеседованию', mustNotInclude: 'Готова к собеседованию' },
      { locale: 'sr', gender: 'female', mustInclude: 'Dostupna sam', mustNotInclude: 'Dostupan sam' },
      { locale: 'sr', gender: 'male', mustInclude: 'Dostupan sam', mustNotInclude: 'Dostupna sam' },
      { locale: 'hr', gender: 'female', mustInclude: 'Dostupna sam', mustNotInclude: 'Dostupan sam' },
      { locale: 'hr', gender: 'male', mustInclude: 'Dostupan sam', mustNotInclude: 'Dostupna sam' },
    ];
    for (const c of cases) {
      const letter = buildDeterministicSparseCoverLetter(c.locale, {
        candidateName: 'Alex Carter',
        jobTitle: 'Android tester',
        companyName: 'Gnof',
        factSet: facts,
        dateLine: '2026-07-14',
        gender: c.gender,
      });
      const text = assembleCoverLetterContent(letter);
      expect(text, `${c.locale}-${c.gender}`).toContain(c.mustInclude);
      expect(text, `${c.locale}-${c.gender}`).not.toContain(c.mustNotInclude);
      expect(text).not.toMatch(/motivé\(e\)|encantado\/a|lieto\/a|рад\(а\)|obrigado\(a\)/);
      expect(validateCoverLetterGrounding(text, facts).valid).toBe(true);
    }
  });

  test('Arabic sparse fallback uses natural join wording without unsupported traits', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'مطوّر برمجيات',
      companyName: 'Gnoogy',
    });
    const letter = buildDeterministicSparseCoverLetter('ar', {
      candidateName: 'Alex Carter',
      jobTitle: 'مطوّر برمجيات',
      companyName: 'Gnoogy',
      factSet: facts,
      dateLine: '12 يوليو 2026',
    });
    const text = assembleCoverLetterContent(letter);
    expect(text).not.toContain('أنتمي إليها');
    expect(text).not.toContain('فرصة مدروسة نحو مسيرة مهنية هادفة');
    expect(text).not.toMatch(/مسيرة مهنية هادفة|فرصة مدروسة/);
    expect(text).not.toContain('تهتمّني');
    expect(text).toContain('تهمّني هذه الفرصة');
    expect(text).toContain('وأتطلع إلى فرصة الانضمام إلى فريقكم');
    expect(text).toContain('فهم متطلبات الدور والتكيف معها والوفاء بمسؤولياته');
    expect(text).not.toContain('معرفة المزيد عن الدور والتكيف مع متطلبات هذا الدور');
    expect(text).not.toContain('وأرجو أن تتاح لي الفرصة للانضمام');
    expect(text).not.toContain('والعمل على تلبية ما ينتظر من شاغله');
    expect(text).not.toContain('وأرحب بفرصة التعرف على متطلبات الوظيفة ومناقشة إمكانية الانضمام إلى فريقكم');
    expect(text).not.toMatch(/الدقة|الاحترافية|القدرات التحليلية/);
    expect(letter.signOff).toContain('مع خالص التحية');
    expect(validateCoverLetterGrounding(text, facts).valid).toBe(true);
  });

  test('all locale sparse fallbacks avoid invented qualities and gender placeholders', () => {
    const facts = buildCoverLetterFactSet({
      personalName: 'Alex Carter',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
    });
    for (const locale of ALL_LOCALES) {
      const letter = buildDeterministicSparseCoverLetter(locale, {
        candidateName: 'Alex Carter',
        jobTitle: 'Android tester',
        companyName: 'Gnof',
        factSet: facts,
        dateLine: '2026-07-14',
      });
      const text = assembleCoverLetterContent(letter);
      const grounding = validateCoverLetterGrounding(text, facts);
      expect(grounding.valid, `${locale}: ${JSON.stringify(grounding.violations)}`).toBe(true);
      expect(text).toContain('Android tester');
      expect(text).not.toMatch(/quality assurance|test automation|attention to detail/i);
      expect(text).not.toMatch(/\b[\p{L}]{3,}\/[\p{L}]{1,4}\b/u);
    }
  });
});
