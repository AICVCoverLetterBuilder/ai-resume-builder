/**
 * Final, per-field locale validation for localized CV projections.
 * Metadata is never treated as proof that the actual field text is localized.
 */
import type { CVData, CvSummaryOrigin } from './types';
import type { Locale } from './i18n/translations';
import { getLocalizedCvLanguageName } from './cv-language-options';
import { localizeCvLanguageLevel } from './cv-language-levels';

export type LocalizedSummaryProvenance = {
  requestedLocale: Locale;
  canonicalLocale: Locale;
  localizedLocale: Locale;
  canonicalRevision: number;
  canonicalSourceHash: string;
  origin: CvSummaryOrigin;
};

export type CvLocalizedFieldKind =
  | 'summary'
  | 'role'
  | 'experience_bullet'
  | 'education_degree'
  | 'education_school'
  | 'education_description'
  | 'skill'
  | 'language_name'
  | 'proficiency';

export type CvFieldLocaleViolationKind =
  | 'mixed_locale_summary'
  | 'mixed_locale_field';

export type CvFieldLocaleViolation = {
  kind: CvFieldLocaleViolationKind;
  field: CvLocalizedFieldKind;
  path: string;
  matched: string;
};

export type CvFieldLocaleValidation = {
  valid: boolean;
  violations: CvFieldLocaleViolation[];
};

const SERBIAN_PROSE = /\b(?:dizajnerka|dizajner|enterijera|iskustva|godina|kreirala\s+sam|izrađivala\s+sam|pratila\s+sam|sarađujem|radila\s+sam|profesionalnog|projekata|klijentima|prostor\w*|rešenj\w*|trenutno|veštin\w*|obrazovanj\w*)\b/iu;
const ENGLISH_PROSE = /\b(?:I\s+am|years?\s+of\s+experience|responsible\s+for|worked\s+with|created|designed|developed|managed|collaborated|professional\s+summary)\b/iu;
const DEVANAGARI = /[\u0900-\u097F]/g;
const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿŠšŽžĆćČčĐđ]/g;

function scriptCounts(text: string): { devanagari: number; latin: number } {
  return {
    devanagari: (text.match(DEVANAGARI) || []).length,
    latin: (text.match(LATIN) || []).length,
  };
}

function hasForeignProseForHindi(text: string): boolean {
  return SERBIAN_PROSE.test(text) || ENGLISH_PROSE.test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip structured CV proper nouns / contacts / dates before Hindi script-ratio checks.
 * Does not weaken rejection of random English prose or English skill lists.
 */
export function stripStructuredCvProperNouns(
  text: string,
  structured?: {
    fullName?: string;
    email?: string;
    phone?: string;
    companies?: string[];
    jobTitles?: string[];
  },
): string {
  let out = (text || '').normalize('NFKC');
  const tokens = [
    structured?.fullName,
    structured?.email,
    structured?.phone,
    ...(structured?.companies || []),
    ...(structured?.jobTitles || []),
  ]
    .map((t) => (t || '').trim())
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    out = out.replace(new RegExp(escapeRegExp(token), 'giu'), ' ');
  }
  // Emails, phones, years/dates, and leftover Latin acronyms tied to contacts.
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, ' ');
  out = out.replace(/\+?\d[\d\s().-]{5,}\d/g, ' ');
  out = out.replace(/\b(?:19|20)\d{2}\b/g, ' ');
  out = out.replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/giu, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Hindi prose must be dominated by Hindi grammar. Latin product names, acronyms,
 * company names, email addresses and URLs are neutral and may remain.
 *
 * NOTE: this is the broad, historically Hindi-only "final export" check, applied to
 * an entire CV that may legitimately contain long-standing untranslated content in
 * any other locale (the export pipeline never required every field to already be
 * written in the requested locale, only Hindi). For the narrower "was this field
 * *just generated* by AI for this exact requested locale" check, use
 * `isWrongLanguageAiOutput` from `cv-ai-locale-guard.ts` instead — do not broaden
 * this function's scope, it would reject long-standing valid exports.
 */
export function textMatchesRequestedFieldLocale(
  text: string,
  locale: Locale,
  field: CvLocalizedFieldKind,
  structuredExemptions?: {
    fullName?: string;
    email?: string;
    phone?: string;
    companies?: string[];
    jobTitles?: string[];
  },
): boolean {
  const value = (text || '').normalize('NFKC').trim();
  if (!value) return true;
  if (locale !== 'hi') return true;

  if (field === 'language_name') {
    return getLocalizedCvLanguageName(value, 'hi') === value && !hasForeignProseForHindi(value);
  }
  if (field === 'proficiency') {
    return localizeCvLanguageLevel(value, 'hi') === value && !hasForeignProseForHindi(value);
  }

  const proseField = field === 'summary'
    || field === 'experience_bullet'
    || field === 'education_description';
  // Always neutralize dates/numbers; also strip structured name/company when provided.
  const scriptProbe = proseField
    ? stripStructuredCvProperNouns(value, structuredExemptions)
    : value;
  // Foreign-prose markers inside stripped structured titles (e.g. "dizajner" in a
  // live Experience job title) must not reject an otherwise Devanagari summary.
  if (hasForeignProseForHindi(scriptProbe || value)) return false;
  // If neutralizing structured tokens leaves almost nothing, the field was only
  // proper nouns/contacts — accept for compact fields; prose still needs Hindi.
  const { devanagari, latin } = scriptCounts(scriptProbe || value);
  if (proseField) {
    const total = Math.max(1, devanagari + latin);
    return devanagari >= 4 && devanagari / total >= 0.35;
  }

  // Proper names and compact technical labels may remain Latin. Any Devanagari
  // text is also valid once foreign prose markers have been excluded.
  return devanagari > 0 || latin > 0;
}

function pushIfInvalid(
  violations: CvFieldLocaleViolation[],
  text: string,
  locale: Locale,
  field: CvLocalizedFieldKind,
  path: string,
  structuredExemptions?: {
    fullName?: string;
    email?: string;
    phone?: string;
    companies?: string[];
    jobTitles?: string[];
  },
): void {
  if (textMatchesRequestedFieldLocale(text, locale, field, structuredExemptions)) return;
  violations.push({
    kind: field === 'summary' ? 'mixed_locale_summary' : 'mixed_locale_field',
    field,
    path,
    matched: (text || '').trim().slice(0, 160),
  });
}

export function validateFinalLocalizedCvFields(
  cv: Pick<CVData, 'summary' | 'personal' | 'experience' | 'education' | 'skills' | 'languages'>,
  requestedLocale: Locale,
): CvFieldLocaleValidation {
  const violations: CvFieldLocaleViolation[] = [];
  const structuredExemptions = {
    fullName: cv.personal?.fullName || '',
    email: cv.personal?.email || '',
    phone: cv.personal?.phone || '',
    companies: (cv.experience || []).map((e) => e.company || '').filter(Boolean),
    jobTitles: [
      cv.personal?.jobTitle || '',
      ...(cv.experience || []).map((e) => e.position || ''),
    ].filter(Boolean),
  };
  pushIfInvalid(
    violations,
    cv.summary || '',
    requestedLocale,
    'summary',
    'summary',
    structuredExemptions,
  );
  pushIfInvalid(
    violations,
    cv.personal?.jobTitle || '',
    requestedLocale,
    'role',
    'personal.jobTitle',
  );

  (cv.experience || []).forEach((experience, experienceIndex) => {
    pushIfInvalid(
      violations,
      experience.position || '',
      requestedLocale,
      'role',
      `experience[${experienceIndex}].position`,
    );
    (experience.description || '')
      .split(/\r?\n/)
      .map((line) => line.replace(/^[•\-\*\u2022]\s*/, '').trim())
      .filter(Boolean)
      .forEach((bullet, bulletIndex) => {
        pushIfInvalid(
          violations,
          bullet,
          requestedLocale,
          'experience_bullet',
          `experience[${experienceIndex}].description[${bulletIndex}]`,
          structuredExemptions,
        );
      });
  });

  (cv.education || []).forEach((education, educationIndex) => {
    pushIfInvalid(
      violations,
      education.degree || '',
      requestedLocale,
      'education_degree',
      `education[${educationIndex}].degree`,
    );
    pushIfInvalid(
      violations,
      education.school || '',
      requestedLocale,
      'education_school',
      `education[${educationIndex}].school`,
    );
    pushIfInvalid(
      violations,
      education.description || '',
      requestedLocale,
      'education_description',
      `education[${educationIndex}].description`,
    );
  });

  (cv.skills || []).forEach((skill, skillIndex) => {
    pushIfInvalid(violations, skill, requestedLocale, 'skill', `skills[${skillIndex}]`);
  });
  (cv.languages || []).forEach((language, languageIndex) => {
    pushIfInvalid(
      violations,
      language.name || '',
      requestedLocale,
      'language_name',
      `languages[${languageIndex}].name`,
    );
    pushIfInvalid(
      violations,
      language.level || '',
      requestedLocale,
      'proficiency',
      `languages[${languageIndex}].level`,
    );
  });

  return { valid: violations.length === 0, violations };
}

/** Preview safety: omit only fields that failed locale validation; never display mixed prose. */
export function omitInvalidLocalizedFieldsForPreview(cv: CVData, requestedLocale: Locale): CVData {
  const result = validateFinalLocalizedCvFields(cv, requestedLocale);
  if (result.valid) return cv;
  const invalid = new Set(result.violations.map((violation) => violation.path));
  return {
    ...cv,
    summary: invalid.has('summary') ? '' : cv.summary,
    personal: {
      ...cv.personal,
      jobTitle: invalid.has('personal.jobTitle') ? '' : cv.personal.jobTitle,
    },
    experience: cv.experience.map((experience, experienceIndex) => {
      const bullets = (experience.description || '')
        .split(/\r?\n/)
        .filter((line, bulletIndex) =>
          !invalid.has(`experience[${experienceIndex}].description[${bulletIndex}]`));
      return {
        ...experience,
        position: invalid.has(`experience[${experienceIndex}].position`)
          ? ''
          : experience.position,
        description: bullets.join('\n'),
      };
    }),
    education: cv.education.map((education, educationIndex) => ({
      ...education,
      degree: invalid.has(`education[${educationIndex}].degree`) ? '' : education.degree,
      school: invalid.has(`education[${educationIndex}].school`) ? '' : education.school,
      description: invalid.has(`education[${educationIndex}].description`)
        ? ''
        : education.description,
    })),
    skills: cv.skills.filter((_, skillIndex) => !invalid.has(`skills[${skillIndex}]`)),
    languages: cv.languages.filter((_, languageIndex) =>
      !invalid.has(`languages[${languageIndex}].name`)
      && !invalid.has(`languages[${languageIndex}].level`)),
  };
}

export function buildLocalizedSummaryProvenance(options: {
  requestedLocale: Locale;
  canonicalLocale: Locale;
  canonicalRevision: number;
  canonicalSourceHash: string;
  origin?: CvSummaryOrigin;
}): LocalizedSummaryProvenance {
  return {
    requestedLocale: options.requestedLocale,
    canonicalLocale: options.canonicalLocale,
    localizedLocale: options.requestedLocale,
    canonicalRevision: options.canonicalRevision,
    canonicalSourceHash: options.canonicalSourceHash,
    origin: options.origin || 'user',
  };
}
