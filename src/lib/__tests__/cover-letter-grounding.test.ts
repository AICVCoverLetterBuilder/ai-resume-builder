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
    expect(letter.paragraph1).toContain('للتقدم لشغل وظيفة');
    expect(letter.paragraph1).not.toContain('بوصفي');
    expect(letter.closing).toContain('المساهمة في فريقكم');
    expect(letter.closing).not.toContain('قيمة حقيقية');
    expect(letter.signOff).toContain('مع خالص التحية');
  });
});
