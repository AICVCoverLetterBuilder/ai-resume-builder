/**
 * Cover-letter grammatical gender: selected app gender is the only source of truth.
 * Never infer gender from name, job title, language, or model assumptions.
 */
import type { Locale } from './i18n/translations';

export type CoverLetterGender = 'male' | 'female' | 'unspecified';

/** Locales where first-person / adjective agreement commonly depends on applicant gender. */
export const COVER_LETTER_GENDERED_LOCALES: ReadonlyArray<Locale> = [
  'hi',
  'ar',
  'sr',
  'hr',
  'ru',
  'fr',
  'es',
  'it',
  'pt-BR',
  'de',
];

export function normalizeCoverLetterGender(raw: unknown): CoverLetterGender {
  if (raw == null) return 'unspecified';
  if (typeof raw !== 'string') return 'unspecified';
  const value = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'male' || value === 'm' || value === 'man' || value === 'masculine') return 'male';
  if (value === 'female' || value === 'f' || value === 'woman' || value === 'feminine') return 'female';
  // Aliases and empty → canonical unspecified (never compare raw UI values afterward)
  if (
    value === '' ||
    value === 'unspecified' ||
    value === 'prefer_not_to_say' ||
    value === 'prefer_not_to_say_' ||
    value === 'not_specified' ||
    value === 'not_specified_' ||
    value === 'none' ||
    value === 'unknown' ||
    value === 'other' ||
    value === 'n_a' ||
    value === 'na'
  ) {
    return 'unspecified';
  }
  return 'unspecified';
}

/** Compare genders only after normalization. */
export function coverLetterGendersEqual(a: unknown, b: unknown): boolean {
  return normalizeCoverLetterGender(a) === normalizeCoverLetterGender(b);
}

/**
 * Explicit gender instructions for generation / repair prompts.
 * Empty for English/Japanese (gender rarely affects sentence form).
 */
export function getCoverLetterGenderInstruction(locale: Locale | string, genderRaw: unknown): string {
  const gender = normalizeCoverLetterGender(genderRaw);
  const loc = locale as Locale;

  if (loc === 'en' || loc === 'ja') {
    return '';
  }

  if (loc === 'hi') {
    if (gender === 'male') {
      return [
        ' GENDER (MANDATORY): The applicant is MALE.',
        'Use exclusively masculine first-person Hindi forms throughout (e.g. "कर रहा हूँ", "चाहता हूँ", "होऊँगा", "प्रस्तुत कर रहा हूँ").',
        'Never use feminine forms (चाहती / कर रही) and never use slash alternatives (चाहता/चाहती, रहा/रही).',
        'Do not infer gender from the candidate name or job title.',
      ].join(' ');
    }
    if (gender === 'female') {
      return [
        ' GENDER (MANDATORY): The applicant is FEMALE.',
        'Use exclusively feminine first-person Hindi forms throughout (e.g. "कर रही हूँ", "चाहती हूँ", "होऊँगी", "प्रस्तुत कर रही हूँ").',
        'Never use masculine forms (चाहता / कर रहा) and never use slash alternatives (चाहता/चाहती, रहा/रही).',
        'Do not infer gender from the candidate name or job title.',
      ].join(' ');
    }
    return [
      ' GENDER: Unspecified.',
      'Use natural gender-neutral Hindi constructions only (impersonal noun-based sentences such as "यह आवेदन प्रस्तुत है", "अवसर स्वागतयोग्य होगा").',
      'Never use masculine forms (चाहता हूँ, कर रहा हूँ), feminine forms (चाहती हूँ, कर रही हूँ), slash alternatives, or third-person rewrites that name the candidate as the grammatical subject (e.g. "Name आवेदन कर रहे हैं").',
      'Never show drafting corrections ("— नहीं", "क्षमा करें", "मेरा मतलब"). Do not invent gender from the name.',
    ].join(' ');
  }

  if (loc === 'ar') {
    if (gender === 'male') {
      return ' GENDER (MANDATORY): Applicant is MALE. Use masculine agreement consistently (e.g. مستعد when readiness is stated). Never use slash or dual-gender placeholders. Do not infer gender from the name.';
    }
    if (gender === 'female') {
      return ' GENDER (MANDATORY): Applicant is FEMALE. Use feminine agreement consistently (e.g. متقدمة، مهتمة، مستعدة). Never use slash placeholders. Do not infer gender from the name.';
    }
    return ' GENDER: Unspecified. Prefer natural gender-neutral Modern Standard Arabic first-person phrasing (أتقدم، أرحب، تهمني، يسعدني، أرغب، أتطلع). Never use speaker-marking adjectives such as حريص/حريصة، متاح/متاحة، مستعد/مستعدة، مهتم/مهتمة، متحمس/متحمسة، سعيد/سعيدة. Never use slash placeholders. Do not infer gender from the name.';
  }

  if (loc === 'sr' || loc === 'hr') {
    if (gender === 'male') {
      return ' VAŽNO: Subjekt je MUŠKI. Koristi ISKLJUČIVO muške glagolske i pridevske oblike kroz ceo tekst (npr. "prijavio sam se", "radio sam", "bio sam"). NIKADA ne koristi kombinovane oblike kao "Vodio/la", "radio/la", "bio/la". Nemoj zaključivati pol iz imena.';
    }
    if (gender === 'female') {
      return ' VAŽNO: Subjekt je ŽENSKI. Koristi ISKLJUČIVO ženske glagolske i pridevske oblike kroz ceo tekst (npr. "prijavila sam se", "radila sam", "bila sam"). NIKADA ne koristi kombinovane oblike kao "Vodio/la", "radio/la", "bio/la". Nemoj zaključivati pol iz imena.';
    }
    return ' Pol nije poznat. Koristi neutralne imeničke i gerundske strukture bez ličnih rodnih oblika. NIKADA ne koristi kombinovane oblike kao "Vodio/la", "radio/la", "bio/la". Nemoj zaključivati pol iz imena.';
  }

  if (loc === 'ru') {
    if (gender === 'male') {
      return ' GENDER (MANDATORY): Applicant is MALE. Use masculine past/participle agreement (e.g. "писал", "был бы рад", "готов"). Never use slash forms like рад(а). Do not infer gender from the name.';
    }
    if (gender === 'female') {
      return ' GENDER (MANDATORY): Applicant is FEMALE. Use feminine past/participle agreement (e.g. "писала", "была бы рада", "готова"). Never use slash forms like рад(а). Do not infer gender from the name.';
    }
    return ' GENDER: Unspecified. Prefer gender-neutral impersonal Russian phrasing. Never use slash forms like рад(а). Do not infer gender from the name.';
  }

  if (loc === 'fr') {
    if (gender === 'male') {
      return ' GENDER (MANDATORY): Applicant is MALE. Use masculine agreement (e.g. "motivé", "intéressé", "ravi"). Never write forms like motivé(e). Do not infer gender from the name.';
    }
    if (gender === 'female') {
      return ' GENDER (MANDATORY): Applicant is FEMALE. Use feminine agreement (e.g. "motivée", "intéressée", "ravie"). Never write forms like motivé(e). Do not infer gender from the name.';
    }
    return ' GENDER: Unspecified. Prefer gender-neutral French constructions. Never write forms like motivé(e). Do not infer gender from the name.';
  }

  if (loc === 'es') {
    if (gender === 'male') {
      return ' GENDER (MANDATORY): Applicant is MALE. Use masculine agreement (e.g. "interesado", "motivado", "preparado", "encantado"). Never write slash forms like encantado/a. Do not infer gender from the name.';
    }
    if (gender === 'female') {
      return ' GENDER (MANDATORY): Applicant is FEMALE. Use feminine agreement (e.g. "interesada", "motivada", "preparada", "encantada"). Never write slash forms like encantado/a. Do not infer gender from the name.';
    }
    return ' GENDER: Unspecified. Prefer gender-neutral Spanish constructions. Never write slash forms like encantado/a. Do not infer gender from the name.';
  }

  if (loc === 'it') {
    if (gender === 'male') {
      return ' GENDER (MANDATORY): Applicant is MALE. Use masculine agreement (e.g. "interessato", "entusiasta", "motivato", "pronto", "lieto"). Never write slash forms like lieto/a. Do not infer gender from the name.';
    }
    if (gender === 'female') {
      return ' GENDER (MANDATORY): Applicant is FEMALE. Use feminine agreement (e.g. "interessata", "entusiasta", "motivata", "pronta", "lieta"). Never write slash forms like lieto/a. Do not infer gender from the name.';
    }
    return ' GENDER: Unspecified. Prefer gender-neutral Italian constructions. Never write slash forms like lieto/a. Do not infer gender from the name.';
  }

  if (loc === 'pt-BR') {
    if (gender === 'male') {
      return ' GENDER (MANDATORY): Applicant is MALE. Use masculine agreement (e.g. "interessado", "motivado", "obrigado"). Never write forms like obrigado(a). Do not infer gender from the name.';
    }
    if (gender === 'female') {
      return ' GENDER (MANDATORY): Applicant is FEMALE. Use feminine agreement (e.g. "interessada", "motivada", "obrigada"). Never write forms like obrigado(a). Do not infer gender from the name.';
    }
    return ' GENDER: Unspecified. Prefer gender-neutral Brazilian Portuguese constructions. Never write forms like obrigado(a). Do not infer gender from the name.';
  }

  if (loc === 'de') {
    if (gender === 'male') {
      return ' GENDER (MANDATORY): Applicant is MALE. Where German self-reference requires gender (e.g. participle forms), use masculine agreement. Do not use slash forms. Do not infer gender from the name.';
    }
    if (gender === 'female') {
      return ' GENDER (MANDATORY): Applicant is FEMALE. Where German self-reference requires gender, use feminine agreement. Do not use slash forms. Do not infer gender from the name.';
    }
    return ' GENDER: Unspecified. Prefer natural gender-neutral German constructions. Do not use slash forms. Do not infer gender from the name.';
  }

  return '';
}
