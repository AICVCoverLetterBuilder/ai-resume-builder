import { describe, expect, test } from 'vitest';
import { assembleCoverLetterContent, buildStructuredCoverLetterPrompt } from '../cover-letter-generation';
import {
  buildDeterministicSparseCoverLetter,
  serbianPozicijuRolePhrase,
  serbianUloguRolePhrase,
  serbianUloziRolePhrase,
  validateCoverLetterGrounding,
} from '../cover-letter-grounding';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import { getCoverLetterGenderInstruction } from '../cover-letter-gender';

const SPARSE = buildCoverLetterFactSet({
  personalName: 'Many Loom',
  jobTitle: 'Android tester',
  companyName: 'Gnof',
});

const PROMPT_BASE = {
  displayName: 'Many Loom',
  candidateName: 'Many Loom',
  companyName: 'Gnof',
  jobTitle: 'Android tester',
  fallbackRole: 'the role',
  fallbackCompany: 'the company',
  variantNote: '',
  dateLine: '14 July 2026',
};

describe('female + confident language quality polish', () => {
  test('Spanish confident female fallback is assertive without cuando sea apropiado', () => {
    const letter = buildDeterministicSparseCoverLetter('es', {
      candidateName: 'Many Loom',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
      factSet: SPARSE,
      dateLine: '14 de julio de 2026',
      gender: 'female',
      tone: 'confident',
    });
    const text = assembleCoverLetterContent(letter, 'es');
    expect(text).toContain('aportar con decisión');
    expect(text).not.toContain('cuando sea apropiado');
    expect(text).not.toContain('contribuir de forma responsable');
    expect(text).toMatch(/motivada|preparada|encantada/);
    expect(text.split(/[.!?؟。]/u).filter((s) => s.trim().length > 12).length).toBeGreaterThanOrEqual(3);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'es', gender: 'female' }).valid).toBe(true);
    expect(getCoverLetterGenderInstruction('es', 'female')).toContain('motivada');
  });

  test('Japanese confident wording is assertive, gender-neutral, and keep 敬具 without comma', () => {
    const letter = buildDeterministicSparseCoverLetter('ja', {
      candidateName: 'Many Loom',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
      factSet: SPARSE,
      dateLine: '2026年7月14日',
      gender: 'female',
      tone: 'confident',
    });
    const text = assembleCoverLetterContent(letter, 'ja');
    expect(text).not.toContain('現時点では');
    expect(text).not.toContain('積み重ねていきたい');
    expect(text).toContain('迅速に習得');
    expect(text).toContain('真摯に');
    expect(text).toContain('着実に貢献');
    expect(text).not.toMatch(/経験豊富|テスト実績|Android製品の品質向上に長年/);
    expect(text).toContain('敬具');
    expect(text).not.toContain('敬具,');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'ja', gender: 'female' }).valid).toBe(true);
  });

  test('Arabic confident uses أتطلع and natural responsibilities; female keeps مستعدة', () => {
    const letter = buildDeterministicSparseCoverLetter('ar', {
      candidateName: 'Many Loom',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
      factSet: SPARSE,
      dateLine: '14 يوليو 2026',
      gender: 'female',
      tone: 'confident',
    });
    const text = assembleCoverLetterContent(letter, 'ar');
    expect(text).toContain('وأتطلع إلى فرصة الانضمام إلى فريقكم');
    expect(text).not.toContain('وأرجو أن تتاح لي الفرصة للانضمام');
    expect(text).toContain('والتكيف مع متطلبات هذا الدور والوفاء بمسؤولياته');
    expect(text).not.toContain('والعمل على تلبية ما ينتظر من شاغله');
    expect(text).toContain('مستعدة');
    expect(text).not.toMatch(/(?:^|[^\u0600-\u06FF])مستعد(?:[^\u0600-\u06FF]|$)/u);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'ar', gender: 'female' }).valid).toBe(true);
  });

  test('Italian removes disponibilità tautology and uses Vi ringrazio', () => {
    const letter = buildDeterministicSparseCoverLetter('it', {
      candidateName: 'Many Loom',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
      factSet: SPARSE,
      dateLine: '14 luglio 2026',
      gender: 'female',
      tone: 'confident',
    });
    const text = assembleCoverLetterContent(letter, 'it');
    expect(text).not.toContain('mettere a disposizione la mia disponibilità');
    expect(text).toContain('il mio impegno e la mia volontà di contribuire');
    expect(text).toContain('Vi ringrazio');
    expect(text).not.toContain('La ringrazio');
    expect(text).toMatch(/motivata|lieta|interessata/);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'it', gender: 'female' }).valid).toBe(true);
  });

  test('Serbian declines Android tester and prompts forbid proizvodi koriste korisnici', () => {
    expect(serbianPozicijuRolePhrase('Android tester')).toBe('poziciju Android testera');
    expect(serbianUloguRolePhrase('Android tester')).toBe('ulogu Android testera');
    const letter = buildDeterministicSparseCoverLetter('sr', {
      candidateName: 'Many Loom',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
      factSet: SPARSE,
      dateLine: '14. jul 2026.',
      gender: 'female',
      tone: 'confident',
    });
    const text = assembleCoverLetterContent(letter, 'sr');
    expect(text).toContain('Android testera');
    expect(text).toContain('prijavljujem');
    expect(text.includes('poziciju Android testera')).toBe(true);
    expect(text).not.toMatch(/za poziciju Android tester(?!a)/);
    expect(text).not.toContain('proizvodi koriste korisnici');
    expect(text).toContain('Dostupna sam');
    expect(text).toContain('Motivisana sam');
    expect(text).not.toContain('gde je to primereno');
    expect(text).not.toContain('Pozicija je od stvarnog interesa');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'sr', gender: 'female' }).valid).toBe(true);

    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      languageName: 'Serbian',
      locale: 'sr',
      toneDesc: 'samouveren i odlučan',
      tone: 'confident',
      gender: 'female',
      genderNote: getCoverLetterGenderInstruction('sr', 'female'),
      closing: 'Srdačno',
    });
    expect(prompt).toContain('proizvodi koriste korisnici');
    expect(prompt).toContain('SERBIAN QUALITY RULES');
    expect(prompt).toContain('Teachera');
    expect(prompt).toContain('gde je to primereno');
  });

  test('Serbian female confident fallback is decisive, not sparse, and keeps Teacher quoted', () => {
    expect(serbianPozicijuRolePhrase('Teacher')).toBe('poziciju „Teacher“');
    expect(serbianPozicijuRolePhrase('AI-Lawyer')).toBe('poziciju „AI-Lawyer“');
    expect(serbianUloziRolePhrase('Teacher')).toBe('ulozi „Teacher“');
    expect(serbianUloguRolePhrase('Teacher')).toBe('ulogu „Teacher“');
    expect(serbianPozicijuRolePhrase('Teacher')).not.toContain('Teachera');

    const facts = buildCoverLetterFactSet({
      personalName: 'Ana Petrović',
      jobTitle: 'Teacher',
      companyName: 'Edu-Bridge',
    });
    const female = assembleCoverLetterContent(
      buildDeterministicSparseCoverLetter('sr', {
        candidateName: 'Ana Petrović',
        jobTitle: 'Teacher',
        companyName: 'Edu-Bridge',
        factSet: facts,
        dateLine: '14. jul 2026.',
        gender: 'female',
        tone: 'confident',
      }),
      'sr',
    );
    expect(female).toContain('poziciju „Teacher“');
    expect(female).toContain('ulogu „Teacher“');
    expect(female).toContain('ulozi „Teacher“');
    expect(female).not.toContain('Teachera');
    expect(female).toContain('Motivisana sam');
    expect(female).toContain('spremna sam');
    expect(female).toContain('predstavila');
    expect(female).toContain('Dostupna sam');
    expect(female).toContain('Ana Petrović');
    expect(female).toContain('Edu-Bridge');
    expect(female).not.toContain('gde je to primereno');
    expect(female).not.toContain('Pozicija je od stvarnog interesa');
    expect(female).not.toMatch(/Bilo bi mi drago/i);
    expect(female.split(/[.!?]/u).filter((s) => s.trim().length > 20).length).toBeGreaterThanOrEqual(4);
    expect(female.length).toBeGreaterThan(320);
    expect(validateCoverLetterGrounding(female, facts, { locale: 'sr', gender: 'female' }).valid).toBe(true);

    for (const gender of ['male', 'unspecified'] as const) {
      const text = assembleCoverLetterContent(
        buildDeterministicSparseCoverLetter('sr', {
          candidateName: 'Ana Petrović',
          jobTitle: 'Teacher',
          companyName: 'Edu-Bridge',
          factSet: facts,
          dateLine: '14. jul 2026.',
          gender,
          tone: 'confident',
        }),
        'sr',
      );
      expect(text).toContain('„Teacher“');
      expect(text).not.toContain('Teachera');
      expect(text).toContain('Ana Petrović');
      expect(text).toContain('Edu-Bridge');
      expect(text).not.toContain('gde je to primereno');
      expect(text).not.toContain('Pozicija je od stvarnog interesa');
      expect(text.length).toBeGreaterThan(280);
      if (gender === 'male') {
        expect(text).toContain('Motivisan sam');
        expect(text).toContain('Dostupan sam');
        expect(text).not.toContain('Motivisana sam');
        expect(text).not.toContain('Dostupna sam');
      } else {
        expect(text).not.toContain('Motivisana sam');
        expect(text).not.toContain('Motivisan sam');
        expect(text).not.toContain('Dostupna sam');
        expect(text).not.toContain('Dostupan sam');
      }
      expect(validateCoverLetterGrounding(text, facts, { locale: 'sr', gender }).valid).toBe(true);
    }

    const lawyerLetter = buildDeterministicSparseCoverLetter('sr', {
      candidateName: 'Ana Petrović',
      jobTitle: 'AI-Lawyer',
      companyName: 'Edu-Bridge',
      factSet: buildCoverLetterFactSet({
        personalName: 'Ana Petrović',
        jobTitle: 'AI-Lawyer',
        companyName: 'Edu-Bridge',
      }),
      dateLine: '14. jul 2026.',
      gender: 'female',
      tone: 'confident',
    });
    const lawyerText = assembleCoverLetterContent(lawyerLetter, 'sr');
    expect(lawyerText).toContain('„AI-Lawyer“');
    expect(lawyerText).toContain('AI-Lawyer');
    expect(lawyerText).not.toMatch(/AI-Lawyera|Lawyera/);
    expect(lawyerText).not.toContain('AI Lawyer'); // preserve hyphenated title
  });

  test('German forbids ehrlichen Beitrag and prefers engagierten Beitrag', () => {
    const letter = buildDeterministicSparseCoverLetter('de', {
      candidateName: 'Many Loom',
      jobTitle: 'Android tester',
      companyName: 'Gnof',
      factSet: SPARSE,
      dateLine: '14. Juli 2026',
      gender: 'female',
      tone: 'confident',
    });
    const text = assembleCoverLetterContent(letter, 'de');
    expect(text).not.toContain('ehrlichen Beitrag');
    expect(text).toContain('engagierten Beitrag');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'de', gender: 'female' }).valid).toBe(true);

    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      languageName: 'German',
      locale: 'de',
      toneDesc: 'selbstbewusst und überzeugend',
      tone: 'confident',
      gender: 'female',
      genderNote: getCoverLetterGenderInstruction('de', 'female'),
      closing: 'Mit freundlichen Grüßen',
    });
    expect(prompt).toContain('ehrlichen Beitrag');
    expect(prompt).toContain('engagierten Beitrag');
  });

  test('Hindi/Russian/Croatian/French female fallbacks remain valid', () => {
    const cases: Array<{ locale: 'hi' | 'ru' | 'hr' | 'fr'; mustInclude: string }> = [
      { locale: 'hi', mustInclude: 'कर रही हूँ' },
      { locale: 'ru', mustInclude: 'Готова' },
      { locale: 'hr', mustInclude: 'Dostupna sam' },
      { locale: 'fr', mustInclude: 'ravie' },
    ];
    for (const c of cases) {
      const letter = buildDeterministicSparseCoverLetter(c.locale, {
        candidateName: 'Many Loom',
        jobTitle: 'Android tester',
        companyName: 'Gnof',
        factSet: SPARSE,
        dateLine: '2026-07-14',
        gender: 'female',
        tone: 'confident',
      });
      const text = assembleCoverLetterContent(letter, c.locale);
      expect(text, c.locale).toContain(c.mustInclude);
      expect(validateCoverLetterGrounding(text, SPARSE, { locale: c.locale, gender: 'female' }).valid).toBe(true);
    }
  });

  test('Spanish confident prompt forbids cuando sea apropiado', () => {
    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      languageName: 'Spanish',
      locale: 'es',
      toneDesc: 'segura, convincente y decidida',
      tone: 'confident',
      gender: 'female',
      genderNote: getCoverLetterGenderInstruction('es', 'female'),
      closing: 'Atentamente',
    });
    expect(prompt).toContain('SPANISH QUALITY RULES');
    expect(prompt).toContain('cuando sea apropiado');
    expect(prompt).toContain('motivada');
    expect(prompt).toContain('CONFIDENT TONE');
  });
});
