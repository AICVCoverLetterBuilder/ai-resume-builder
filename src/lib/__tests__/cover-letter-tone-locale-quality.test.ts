import { describe, expect, test } from 'vitest';
import { assembleCoverLetterContent } from '../cover-letter-generation';
import {
  buildDeterministicSparseCoverLetter,
  croatianPozicijuRolePhrase,
  serbianPozicijuRolePhrase,
  validateCoverLetterGrounding,
} from '../cover-letter-grounding';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import { findGenderFormMismatches } from '../cover-letter-gender-validation';

const ROLE = 'Saradnik za podršku klijentima u logistici';
const COMPANY = 'Unoklo';
const NAME = 'Alex Carter';
const FACTS = buildCoverLetterFactSet({
  personalName: NAME,
  jobTitle: ROLE,
  companyName: COMPANY,
});

function letter(
  locale: Parameters<typeof buildDeterministicSparseCoverLetter>[0],
  gender: 'male' | 'female' | 'unspecified',
  tone: 'formal' | 'friendly' | 'confident',
) {
  return buildDeterministicSparseCoverLetter(locale, {
    candidateName: NAME,
    jobTitle: ROLE,
    companyName: COMPANY,
    factSet: FACTS,
    dateLine: '2026-07-15',
    gender,
    tone,
  });
}

describe('tone-separated locale quality pass', () => {
  test('Hindi gender idiom खरा/खरी and fuller formal/friendly letters', () => {
    expect(findGenderFormMismatches('अपेक्षाओं पर खरा उतरने', 'hi', 'female')).toContain('खरा उतर');
    expect(findGenderFormMismatches('अपेक्षाओं पर खरी उतरने', 'hi', 'male')).toContain('खरी उतर');
    expect(findGenderFormMismatches('अपेक्षाओं को पूरा करने के लिए प्रतिबद्ध हूँ', 'hi', 'unspecified')).toEqual([]);

    const femaleFormal = assembleCoverLetterContent(letter('hi', 'female', 'formal'), 'hi');
    expect(femaleFormal).toContain('मैं साक्षात्कार के लिए उपलब्ध हूँ');
    expect(femaleFormal).not.toContain('जहाँ उपयुक्त हो योगदान देने');
    expect(femaleFormal).not.toContain('यह पद रुचिकर लगता है');
    expect(femaleFormal).not.toContain('उपलब्ध रहना चाहती हूँ');
    expect(femaleFormal).not.toContain('उपलब्ध रहना चाहता हूँ');
    expect(femaleFormal.length).toBeGreaterThan(180);
    expect(validateCoverLetterGrounding(femaleFormal, FACTS, { locale: 'hi', gender: 'female' }).valid).toBe(true);

    const maleFriendly = assembleCoverLetterContent(letter('hi', 'male', 'friendly'), 'hi');
    expect(maleFriendly).toContain('मैं साक्षात्कार के लिए उपलब्ध हूँ');
    expect(maleFriendly).not.toContain('जहाँ उपयुक्त हो योगदान देने');
    expect(maleFriendly).toContain('सहयोगी');
    expect(validateCoverLetterGrounding(maleFriendly, FACTS, { locale: 'hi', gender: 'male' }).valid).toBe(true);

    const unspecified = assembleCoverLetterContent(letter('hi', 'unspecified', 'formal'), 'hi');
    expect(unspecified).toContain('अपेक्षाओं को पूरा करने के लिए प्रतिबद्ध हूँ');
    expect(unspecified).not.toMatch(/खरा|खरी/);
  });

  test('Arabic formal/friendly/confident are distinct; confident female keeps مستعدة', () => {
    const formal = assembleCoverLetterContent(letter('ar', 'female', 'formal'), 'ar');
    const friendly = assembleCoverLetterContent(letter('ar', 'female', 'friendly'), 'ar');
    const confident = assembleCoverLetterContent(letter('ar', 'female', 'confident'), 'ar');
    expect(formal).not.toEqual(friendly);
    expect(friendly).not.toEqual(confident);
    expect(confident).toContain('مستعدة');
    expect(confident).not.toContain('معرفة المزيد عن الدور والتكيف مع متطلبات هذا الدور');
    expect((formal.match(/معرفة المزيد/g) ?? []).length).toBeLessThan(2);
    expect(formal).toContain(ROLE);
    expect(formal.indexOf(ROLE)).toBeGreaterThan(-1);
    expect(validateCoverLetterGrounding(confident, FACTS, { locale: 'ar', gender: 'female' }).valid).toBe(true);
  });

  test('Italian friendly does not presume acceptance; closing has finite verb', () => {
    const friendly = assembleCoverLetterContent(letter('it', 'male', 'friendly'), 'it');
    expect(friendly).toContain('Sarei lieto di entrare a far parte del vostro team');
    expect(friendly).not.toContain('Sono lieto di poter far parte del team');
    expect(friendly).toContain('rimango a vostra completa disposizione');
    expect(validateCoverLetterGrounding(friendly, FACTS, { locale: 'it', gender: 'male' }).valid).toBe(true);
  });

  test('Croatian/Serbian quote exact titles and use present-tense application wording', () => {
    expect(croatianPozicijuRolePhrase(ROLE)).toBe(`poziciju „${ROLE}“`);
    expect(serbianPozicijuRolePhrase(ROLE)).toBe(`poziciju „${ROLE}“`);
    expect(serbianPozicijuRolePhrase('Android tester')).toBe('poziciju Android testera');
    expect(serbianPozicijuRolePhrase('vozač')).toBe('poziciju vozača');

    const hr = assembleCoverLetterContent(letter('hr', 'female', 'formal'), 'hr');
    expect(hr).toContain('Ovim putem se prijavljujem');
    expect(hr).not.toContain('Ovim putem prijavila sam se');
    expect(hr).not.toContain('Saradnika');
    expect(hr).toContain(`poziciju „${ROLE}“`);

    const sr = assembleCoverLetterContent(letter('sr', 'male', 'formal'), 'sr');
    expect(sr).toContain('Ovim putem se prijavljujem');
    expect(sr).not.toContain('Ovim putem prijavljujem se');
    expect(sr).toContain(`poziciju „${ROLE}“`);
    expect(sr).toContain('privukla mi je pažnju');
    expect(validateCoverLetterGrounding(hr, FACTS, { locale: 'hr', gender: 'female' }).valid).toBe(true);
    expect(validateCoverLetterGrounding(sr, FACTS, { locale: 'sr', gender: 'male' }).valid).toBe(true);
  });

  test('Russian opening and useful contribution phrasing; German salutation; pt-BR environment fix', () => {
    const ru = assembleCoverLetterContent(letter('ru', 'male', 'formal'), 'ru');
    expect(ru).toContain('Обращаюсь к вам, чтобы выразить интерес');
    expect(ru).toContain('полезный вклад');
    expect(ru).not.toContain('посильный вклад');
    expect(ru).toContain('Буду рад возможности присоединиться');

    for (const tone of ['formal', 'friendly', 'confident'] as const) {
      const de = letter('de', 'male', tone);
      expect(de.greeting).toBe('Sehr geehrte Damen und Herren,');
    }

    const pt = assembleCoverLetterContent(letter('pt-BR', 'male', 'formal'), 'pt-BR');
    expect(pt).toContain('Vejo nessa posição uma oportunidade concreta');
    expect(pt).not.toMatch(/essa posição representa um ambiente propício/i);
    expect(pt).toContain('suporte ao cliente na área de logística');
    expect(validateCoverLetterGrounding(ru, FACTS, { locale: 'ru', gender: 'male' }).valid).toBe(true);
    expect(validateCoverLetterGrounding(pt, FACTS, { locale: 'pt-BR', gender: 'male' }).valid).toBe(true);
  });

  test('English and Japanese reject unsupported company attributes; JA friendly ≠ formal', () => {
    const enBad = validateCoverLetterGrounding(
      `${COMPANY}'s work in this space is excellent. I want to join a team that takes client support seriously.`,
      FACTS,
      { locale: 'en', gender: 'male' },
    );
    expect(enBad.valid).toBe(false);
    expect(enBad.violations.some((v) => v.kind === 'unsupported_company_attribute')).toBe(true);

    const jaBad = validateCoverLetterGrounding(
      `${COMPANY}は顧客との信頼関係を重視する企業として認識しており、応募します。`,
      FACTS,
      { locale: 'ja', gender: 'unspecified' },
    );
    expect(jaBad.valid).toBe(false);

    const jaFormal = assembleCoverLetterContent(letter('ja', 'unspecified', 'formal'), 'ja');
    const jaFriendly = assembleCoverLetterContent(letter('ja', 'unspecified', 'friendly'), 'ja');
    expect(jaFormal).not.toEqual(jaFriendly);
    expect(jaFormal).toContain('敬具');
    expect(jaFormal).toContain('物流および顧客サポートの業務に関心');
    expect(jaFormal).not.toContain('として認識しており');
    expect(validateCoverLetterGrounding(jaFormal, FACTS, { locale: 'ja' }).valid).toBe(true);

    const en = assembleCoverLetterContent(letter('en', 'male', 'confident'), 'en');
    expect(en).not.toContain('takes client support seriously');
    expect(validateCoverLetterGrounding(en, FACTS, { locale: 'en', gender: 'male' }).valid).toBe(true);
  });
});
