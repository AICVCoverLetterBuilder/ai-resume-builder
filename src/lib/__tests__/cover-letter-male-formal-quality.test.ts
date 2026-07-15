import { describe, expect, test } from 'vitest';
import { assembleCoverLetterContent, buildStructuredCoverLetterPrompt } from '../cover-letter-generation';
import {
  buildDeterministicSparseCoverLetter,
  croatianPozicijuRolePhrase,
  portugueseBrRoleReference,
  validateCoverLetterGrounding,
} from '../cover-letter-grounding';
import { buildCoverLetterFactSet } from '../cover-letter-facts';

const ROLE = 'Saradnik za podršku klijentima logistike';
const COMPANY = 'Unoklo';
const NAME = 'Marko Horvat';

const SPARSE = buildCoverLetterFactSet({
  personalName: NAME,
  jobTitle: ROLE,
  companyName: COMPANY,
});

const PROMPT_BASE = {
  displayName: NAME,
  candidateName: NAME,
  companyName: COMPANY,
  jobTitle: ROLE,
  fallbackRole: 'the role',
  fallbackCompany: 'the company',
  variantNote: '',
  dateLine: '14 July 2026',
  tone: 'formal' as const,
  gender: 'male' as const,
};

function formalMaleLetter(locale: Parameters<typeof buildDeterministicSparseCoverLetter>[0]) {
  return buildDeterministicSparseCoverLetter(locale, {
    candidateName: NAME,
    jobTitle: ROLE,
    companyName: COMPANY,
    factSet: SPARSE,
    dateLine: '14. 7. 2026.',
    gender: 'male',
    tone: 'formal',
  });
}

describe('male + formal language quality and company-claim grounding', () => {
  test('Spanish formal is substantial without confident sparse phrases; male agreement holds', () => {
    const text = assembleCoverLetterContent(formalMaleLetter('es'), 'es');
    expect(text).not.toContain('aportar con decisión');
    expect(text).not.toContain('El puesto me resulta de verdadero interés');
    expect(text).not.toContain('aprender en el rol');
    expect(text).toContain('interesado');
    expect(text).toMatch(/responsabilidades del puesto|objetivos de la organización|desarrollo profesional/);
    expect(text.split(/[.!?¿¡]/u).filter((s) => s.trim().length > 40).length).toBeGreaterThanOrEqual(3);
    expect(text.length).toBeGreaterThan(320);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'es', gender: 'male' }).valid).toBe(true);

    const confident = assembleCoverLetterContent(
      buildDeterministicSparseCoverLetter('es', {
        candidateName: NAME,
        jobTitle: ROLE,
        companyName: COMPANY,
        factSet: SPARSE,
        dateLine: '14 de julio de 2026',
        gender: 'male',
        tone: 'confident',
      }),
      'es',
    );
    expect(confident).toContain('contribuir de forma activa y responsable');
    expect(confident).not.toContain('aportar con decisión');
  });

  test('Italian closing has finite verb; no detached disposizione fragment', () => {
    const text = assembleCoverLetterContent(formalMaleLetter('it'), 'it');
    expect(text).toContain('rimango a vostra completa disposizione');
    expect(text).toMatch(/Sarei lieto[\s\S]*rimango a vostra completa disposizione/);
    expect(text).not.toMatch(/,\s*a vostra completa disposizione/u);
    expect(text).toMatch(/lieto|motivato|pronto/i);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'it', gender: 'male' }).valid).toBe(true);
  });

  test('Croatian preserves exact quoted multiword role without Saradnika decline', () => {
    expect(croatianPozicijuRolePhrase(ROLE)).toBe(`poziciju „${ROLE}“`);
    expect(croatianPozicijuRolePhrase(ROLE)).not.toContain('Saradnika');
    const text = assembleCoverLetterContent(formalMaleLetter('hr'), 'hr');
    expect(text).toContain(`poziciju „${ROLE}“`);
    expect(text).not.toContain('poziciju Saradnika');
    expect(text).not.toMatch(/Saradnika za podršku/);
    expect(text).toContain(ROLE);
    expect(text).toContain('Dostupan sam');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'hr', gender: 'male' }).valid).toBe(true);
  });

  test('unsupported company reputation claims are rejected for hi/ja/hr/ru', () => {
    const samples: Array<{ locale: 'hi' | 'ja' | 'hr' | 'ru'; draft: string }> = [
      {
        locale: 'hi',
        draft: `${COMPANY} एक प्रतिष्ठित संगठन है। मैं ${ROLE} पद के लिए आवेदन प्रस्तुत कर रहा हूँ।`,
      },
      {
        locale: 'ja',
        draft: `${COMPANY} は顧客サービスを重視する企業として認識しており、${ROLE}職に応募いたします。`,
      },
      {
        locale: 'hr',
        draft: `Prijavljujem se u tvrtku kojoj je stalo do kvalitete usluge za poziciju „${ROLE}“.`,
      },
      {
        locale: 'ru',
        draft: `${COMPANY} привлекает меня своей ориентацией на клиентский сервис. Пишу на позицию ${ROLE}.`,
      },
    ];
    for (const { locale, draft } of samples) {
      const result = validateCoverLetterGrounding(draft, SPARSE, { locale, gender: 'male' });
      expect(result.valid, locale).toBe(false);
      expect(
        result.violations.some(
          (v) => v.kind === 'unsupported_company_attribute' || v.kind === 'unsupported_company_claim',
        ),
        locale,
      ).toBe(true);
    }

    for (const locale of ['hi', 'ja', 'hr', 'ru'] as const) {
      const text = assembleCoverLetterContent(formalMaleLetter(locale), locale);
      expect(validateCoverLetterGrounding(text, SPARSE, { locale, gender: 'male' }).valid).toBe(true);
      expect(text.trim().length).toBeGreaterThan(40);
    }
  });

  test('Russian formal uses natural joining-opportunity phrasing with male agreement', () => {
    const text = assembleCoverLetterContent(formalMaleLetter('ru'), 'ru');
    expect(text).toContain('Буду рад возможности присоединиться');
    expect(text).not.toContain('рассмотреть возможность присоединиться');
    expect(text).toContain('Готов');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'ru', gender: 'male' }).valid).toBe(true);
  });

  test('French formal uses natural collocations with male agreement', () => {
    const text = assembleCoverLetterContent(formalMaleLetter('fr'), 'fr');
    expect(text).toContain('Madame, Monsieur,');
    expect(text).not.toContain('équipe de recrutement de');
    expect(text).toContain('vivement intéressé par la possibilité de rejoindre vos équipes');
    expect(text).toContain('mettre mon engagement et ma motivation au service de votre organisation');
    expect(text).not.toContain('intéressé à rejoindre');
    expect(text).not.toContain('bonne volonté');
    expect(text).not.toContain('apprendre dans ce rôle');
    expect(text).not.toContain('contribuer lorsque cela sera utile');
    expect(text).not.toContain('votre temps et votre considération');
    expect(text).toContain("attention portée à ma candidature");
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'fr', gender: 'male' }).valid).toBe(true);

    const prompt = buildStructuredCoverLetterPrompt({
      ...PROMPT_BASE,
      languageName: 'French',
      locale: 'fr',
      toneDesc: 'formel et professionnel',
      genderNote: 'male',
      closing: 'Cordialement',
    });
    expect(prompt).toContain('FRENCH QUALITY RULES');
    expect(prompt).toContain('vivement intéressé');
    expect(prompt).toContain('bonne volonté');
  });

  test('German uses Sehr geehrte Damen und Herren without company-in-salutation', () => {
    const letter = formalMaleLetter('de');
    expect(letter.greeting).toBe('Sehr geehrte Damen und Herren,');
    expect(letter.greeting).not.toMatch(/von\s+/i);
    const text = assembleCoverLetterContent(letter, 'de');
    expect(text).toContain(COMPANY);
    expect(text).toContain(ROLE);
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'de', gender: 'male' }).valid).toBe(true);
  });

  test('Portuguese-BR keeps exact title and natural logistics gloss', () => {
    expect(portugueseBrRoleReference(ROLE)).toContain(ROLE);
    expect(portugueseBrRoleReference(ROLE)).toContain(
      'Colaborador de suporte ao cliente na área de logística',
    );
    expect(portugueseBrRoleReference(ROLE)).not.toContain('Suporte a Clientes de Logística');
    const text = assembleCoverLetterContent(formalMaleLetter('pt-BR'), 'pt-BR');
    expect(text).toContain(ROLE);
    expect(text).toContain('suporte ao cliente na área de logística');
    expect(text).not.toContain('Suporte a Clientes de Logística');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'pt-BR', gender: 'male' }).valid).toBe(true);
  });

  test('Arabic formal keeps Latin role readable and remains grounded', () => {
    const letter = formalMaleLetter('ar');
    const text = assembleCoverLetterContent(letter, 'ar');
    expect(text).toContain(ROLE);
    expect(text.indexOf(ROLE)).toBeGreaterThan(-1);
    expect(text).toContain(COMPANY);
    expect(text).toContain('أتقدم بطلب لشغل وظيفة');
    expect(text).toContain('مع خالص التحية');
    expect(validateCoverLetterGrounding(text, SPARSE, { locale: 'ar', gender: 'male' }).valid).toBe(true);
  });

  test('male forms remain correct in gender-sensitive formal locales', () => {
    const checks: Array<{ locale: 'es' | 'it' | 'fr' | 'ru' | 'hr' | 'hi'; needles: RegExp }> = [
      { locale: 'es', needles: /interesado/ },
      { locale: 'it', needles: /lieto/ },
      { locale: 'fr', needles: /intéressé/ },
      { locale: 'ru', needles: /Буду рад|Готов/ },
      { locale: 'hr', needles: /Dostupan sam/ },
      { locale: 'hi', needles: /कर रहा हूँ|खरा उतर|चाहता हूँ/ },
    ];
    for (const { locale, needles } of checks) {
      const text = assembleCoverLetterContent(formalMaleLetter(locale), locale);
      expect(text, locale).toMatch(needles);
      expect(validateCoverLetterGrounding(text, SPARSE, { locale, gender: 'male' }).valid).toBe(true);
    }
  });

  test('friendly Spanish path remains unchanged; grounding recovery fallback stays non-blank', () => {
    const friendly = assembleCoverLetterContent(
      buildDeterministicSparseCoverLetter('es', {
        candidateName: NAME,
        jobTitle: 'Android tester',
        companyName: COMPANY,
        factSet: buildCoverLetterFactSet({
          personalName: NAME,
          jobTitle: 'Android tester',
          companyName: COMPANY,
        }),
        dateLine: '14 de julio de 2026',
        gender: 'male',
        tone: 'friendly',
      }),
      'es',
    );
    expect(friendly).toContain('contribuir de manera activa y responsable');
    expect(friendly).not.toContain('aportar con decisión');
    expect(friendly).not.toContain('aprender en el rol');

    const repaired = assembleCoverLetterContent(formalMaleLetter('es'), 'es');
    expect(repaired.trim().length).toBeGreaterThan(80);
    expect(validateCoverLetterGrounding(repaired, SPARSE, { locale: 'es', gender: 'male' }).valid).toBe(true);
  });
});
