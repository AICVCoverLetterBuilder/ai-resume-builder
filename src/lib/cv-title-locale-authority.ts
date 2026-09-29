import { detectTextLocale } from './cv-content-locale';
import { EXPERIENCE_SOURCE_LOCALES } from './cv-experience-source-locale';
import type { Locale } from './i18n/translations';
import type { CVData, WorkExperience } from './types';

export const TITLE_LOCALE_AUTHORITY_UNBOUND = 'export_title_locale_authority_unbound' as const;

export function canonicalTitleLocaleText(text: string): string {
  return String(text || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

/** The same text-bound FNV-1a convention as Experience description authority. */
export function hashTitleLocaleText(text: string): string {
  const value = canonicalTitleLocaleText(text);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}_l${value.length}`;
}

/** Locale-invariant identifiers need no authored-language guess or provider. */
export function invariantTitleLocaleText(text: string): boolean {
  const value = canonicalTitleLocaleText(text);
  if (!value) return false;
  if (/^(?:https?:\/\/|www\.)\S+$/iu.test(value)) return true;
  return /^[A-Z0-9][A-Z0-9._:/+#-]*(?:\s+[A-Z0-9][A-Z0-9._:/+#-]*)*$/u.test(value)
    && /[A-Z0-9]/u.test(value);
}

function supportedLocale(value?: string | null): Locale | null {
  return EXPERIENCE_SOURCE_LOCALES.find((locale) => locale === value) || null;
}

export type TitleLocaleResolution = {
  locale: Locale | null;
  status: 'direct_detected' | 'bound' | 'invariant' | 'legacy_unbound';
};

function resolveTitle(text: string, locale?: string, binding?: string): TitleLocaleResolution {
  const detected = supportedLocale(detectTextLocale(text));
  if (detected) return { locale: detected, status: 'direct_detected' };
  if (invariantTitleLocaleText(text)) return { locale: null, status: 'invariant' };
  const bound = supportedLocale(locale);
  if (bound && binding === hashTitleLocaleText(text)) return { locale: bound, status: 'bound' };
  return { locale: null, status: 'legacy_unbound' };
}

export function resolveExperienceTitleLocale(exp: WorkExperience): TitleLocaleResolution {
  return resolveTitle(exp.position, exp.positionSourceLocale, exp.positionSourceLocaleTextHash);
}

export function resolvePersonalTitleLocale(cv: CVData): TitleLocaleResolution {
  const header = canonicalTitleLocaleText(cv.personal?.jobTitle || '');
  const detected = supportedLocale(detectTextLocale(header));
  if (detected) return { locale: detected, status: 'direct_detected' };
  if (invariantTitleLocaleText(header)) return { locale: null, status: 'invariant' };
  const matching = (cv.experience || []).find((exp) =>
    canonicalTitleLocaleText(exp.position).toLocaleLowerCase()
      === header.toLocaleLowerCase());
  if (matching) return resolveExperienceTitleLocale(matching);
  return resolveTitle(header, cv.personal?.jobTitleSourceLocale, cv.personal?.jobTitleSourceLocaleTextHash);
}

export type UnboundTitleLocaleField = {
  fieldKey: string;
  title: string;
  titleHash: string;
};

export function collectUnboundTitleLocaleFields(
  cv: CVData,
  options?: { experienceIds?: ReadonlySet<string>; includePersonalTitle?: boolean },
): UnboundTitleLocaleField[] {
  const fields: UnboundTitleLocaleField[] = [];
  const header = canonicalTitleLocaleText(cv.personal?.jobTitle || '');
  const matching = (cv.experience || []).find((exp) =>
    canonicalTitleLocaleText(exp.position).toLocaleLowerCase() === header.toLocaleLowerCase());
  if (header && !matching && options?.includePersonalTitle !== false
    && resolvePersonalTitleLocale(cv).status === 'legacy_unbound') {
    fields.push({ fieldKey: 'personal.jobTitle', title: header, titleHash: hashTitleLocaleText(header) });
  }
  for (const exp of cv.experience || []) {
    if (options?.experienceIds && !options.experienceIds.has(exp.id)
      && !(options.includePersonalTitle !== false && matching?.id === exp.id)) continue;
    const title = canonicalTitleLocaleText(exp.position);
    if (title && resolveExperienceTitleLocale(exp).status === 'legacy_unbound') {
      fields.push({ fieldKey: `experience.${exp.id}.position`, title, titleHash: hashTitleLocaleText(title) });
    }
  }
  return fields;
}

export type TitleLocaleConfirmation = UnboundTitleLocaleField & { locale: Locale };

/** All-or-nothing metadata-only confirmation against the exact current titles. */
export function confirmTitleLocales(cv: CVData, confirmations: TitleLocaleConfirmation[]): CVData | null {
  const expected = collectUnboundTitleLocaleFields(cv);
  if (expected.length !== confirmations.length) return null;
  const byKey = new Map(confirmations.map((item) => [item.fieldKey, item]));
  if (byKey.size !== confirmations.length || expected.some((field) => {
    const selected = byKey.get(field.fieldKey);
    return !selected || selected.titleHash !== field.titleHash || selected.title !== field.title
      || !supportedLocale(selected.locale);
  })) return null;
  const personalSelection = byKey.get('personal.jobTitle');
  return {
    ...cv,
    updatedAt: new Date().toISOString(),
    personal: personalSelection ? {
      ...cv.personal,
      jobTitleSourceLocale: personalSelection.locale,
      jobTitleSourceLocaleTextHash: personalSelection.titleHash,
    } : cv.personal,
    experience: (cv.experience || []).map((exp) => {
      const selected = byKey.get(`experience.${exp.id}.position`);
      return selected ? {
        ...exp,
        positionSourceLocale: selected.locale,
        positionSourceLocaleTextHash: selected.titleHash,
      } : exp;
    }),
  };
}
