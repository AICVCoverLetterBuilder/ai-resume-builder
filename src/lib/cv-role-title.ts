/**
 * Occupational title resolver for generated summary prose only.
 * Never use placeholder experience titles (e.g. "V") as the candidate profession.
 */
import type { Locale } from './i18n/translations';
import { normalizeCoverLetterGender } from './cover-letter-gender';

const PLACEHOLDER_TITLE = /^(n\/a|na|tbd|test|xxx|position|role|job|title|none|unknown)$/i;

export function isValidOccupationalTitle(title: string): boolean {
  const t = (title || '').trim();
  if (!t) return false;
  if (t.length <= 1) return false;
  if (PLACEHOLDER_TITLE.test(t)) return false;
  if (/^[-_.\sx]+$/i.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return false;
  return true;
}

function localizeProductionOperator(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'उत्पादन ऑपरेटर';
  if (locale === 'sr' || locale === 'hr') {
    return g === 'female' ? 'Operaterka u proizvodnji' : 'Operater u proizvodnji';
  }
  if (locale === 'en') return 'Production Operator';
  if (locale === 'de') return g === 'female' ? 'Produktionsmitarbeiterin' : 'Produktionsmitarbeiter';
  return 'Production Operator';
}

function localizeInteriorDesigner(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'इंटीरियर डिज़ाइनर';
  if (locale === 'sr' || locale === 'hr') {
    return g === 'female' ? 'Dizajnerka enterijera' : 'Dizajner enterijera';
  }
  if (locale === 'en') return 'Interior Designer';
  if (locale === 'de') return g === 'female' ? 'Innenarchitektin' : 'Innenarchitekt';
  return 'Interior Designer';
}

function localizeKnownTitle(title: string, locale: Locale, gender?: string): string | null {
  const normalized = title.normalize('NFKC');
  if (/operater.*proizvod|production\s+operator|operatore.*produz/i.test(normalized)) {
    return localizeProductionOperator(locale, gender);
  }
  if (/dizajner(?:ka)?\s+enterijera|interior\s+designer|innenarchitekt/i.test(normalized)) {
    return localizeInteriorDesigner(locale, gender);
  }
  if (locale === 'sr' || locale === 'hr' || locale === 'en') return normalized;
  if (/^[A-Za-z0-9\s/&'’.-]+$/u.test(normalized) && normalized.length > 2) {
    return null;
  }
  return normalized;
}

/** Localize a known occupational title on a detached preview/export projection. */
export function localizeOccupationalTitleForProjection(
  title: string,
  locale: Locale,
  gender?: string,
): string {
  if (!isValidOccupationalTitle(title)) return title;
  return localizeKnownTitle(title.trim(), locale, gender) || title;
}

export function getOccupationalTitleFallback(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'पेशेवर';
  if (locale === 'sr' || locale === 'hr') return g === 'female' ? 'profesionalka' : 'profesionalac';
  if (locale === 'de') return g === 'female' ? 'Fachkraft' : 'Fachkraft';
  return 'professional';
}

/**
 * Priority: profile/professional title → current experience title → safe locale fallback.
 */
export function resolveOccupationalTitleForSummary(options: {
  profileJobTitle?: string;
  currentExperienceTitle?: string;
  locale: Locale;
  gender?: string;
}): string {
  const candidates = [options.profileJobTitle, options.currentExperienceTitle];
  for (const raw of candidates) {
    if (!isValidOccupationalTitle(raw || '')) continue;
    const localized = localizeKnownTitle(raw!.trim(), options.locale, options.gender);
    if (localized) return localized;
  }
  return getOccupationalTitleFallback(options.locale, options.gender);
}
