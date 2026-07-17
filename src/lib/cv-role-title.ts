/**
 * Occupational title resolver for generated summary prose only.
 * Never use placeholder experience titles (e.g. "V") as the candidate profession.
 * Display localization must never mutate the canonical stored title.
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

/** Cook / chef family — display only; never invent cooking duties. */
function localizeCook(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'रसोइया';
  if (locale === 'sr' || locale === 'hr') {
    return g === 'female' ? 'Kuvarica' : 'Kuvar';
  }
  if (locale === 'en') return 'Cook';
  if (locale === 'de') return g === 'female' ? 'Köchin' : 'Koch';
  if (locale === 'fr') return g === 'female' ? 'Cuisinière' : 'Cuisinier';
  if (locale === 'es') return g === 'female' ? 'Cocinera' : 'Cocinero';
  if (locale === 'it') return g === 'female' ? 'Cuoca' : 'Cuoco';
  if (locale === 'pt-BR') return g === 'female' ? 'Cozinheira' : 'Cozinheiro';
  if (locale === 'ru') return g === 'female' ? 'Повариха' : 'Повар';
  if (locale === 'ar') return 'طباخ';
  if (locale === 'ja') return '料理人';
  return 'Cook';
}

const COOK_TITLE_RE = /\b(kuvar(?:ica)?|cook|chef|kuhar(?:ica)?|koch|köchin|cuisinier|cocinero|cuoco|повар|रसोइया|طباخ)\b/iu;
/** Prefix stems — Serbian/Croatian inflect, so trailing `\b` after the stem is unsafe. */
const LOGISTICS_DUTY_RE =
  /\b(?:transport|utovar|istovar|load(?:ing)?|unload|deliver|delivery|warehouse|skladišt|viličar|vilicar|forklift|logistics|isporuč|isporuc|prevoz)|परिवहन|गोदाम|डिलीवरी/iu;
const PROCESS_REPORT_DUTY_RE =
  /\b(?:internal\s+process|process(?:es)?|cross[- ]?functional|collaborat|analy[sz]|report|izveštaj|izvestaj|proces|saradn|sarađ|sarad|koordin)|प्रक्रिया|सहयोग|विश्लेषण|रिपोर्ट/iu;
const COOKING_DUTY_RE =
  /\b(?:cook(?:ing)?|recipe|kitchen|menu|food\s+prep|priprem\w*\s+hran|kuhinj)|भोजन|पकवान|طبخ/iu;

/**
 * True when the stored occupational title belongs to a different duty family than
 * the experience bullets (e.g. Kuvar + warehouse/logistics/process duties).
 * Used to avoid forcing a contradictory title into Summary openings.
 */
export function hasRoleDutyConsistencyConflict(options: {
  profileJobTitle?: string;
  experienceTitle?: string;
  dutiesText?: string;
}): boolean {
  const title = `${options.profileJobTitle || ''} ${options.experienceTitle || ''}`.trim();
  const duties = (options.dutiesText || '').trim();
  if (!title || !duties) return false;
  const titleIsCook = COOK_TITLE_RE.test(title);
  const dutiesAreLogisticsOrOffice =
    LOGISTICS_DUTY_RE.test(duties) || PROCESS_REPORT_DUTY_RE.test(duties);
  const dutiesAreCooking = COOKING_DUTY_RE.test(duties);
  if (titleIsCook && dutiesAreLogisticsOrOffice && !dutiesAreCooking) return true;
  return false;
}

function localizeKnownTitle(title: string, locale: Locale, gender?: string): string | null {
  const normalized = title.normalize('NFKC');
  if (/operater.*proizvod|production\s+operator|operatore.*produz/i.test(normalized)) {
    return localizeProductionOperator(locale, gender);
  }
  if (/dizajner(?:ka)?\s+enterijera|interior\s+designer|innenarchitekt/i.test(normalized)) {
    return localizeInteriorDesigner(locale, gender);
  }
  if (COOK_TITLE_RE.test(normalized)) {
    return localizeCook(locale, gender);
  }
  // sr/hr never need translation of their own titles, and `isWrongLanguageAiOutput`
  // explicitly exempts sr/hr from its Serbo-Croatian-diacritic check.
  if (locale === 'sr' || locale === 'hr') return normalized;
  const isAsciiTitle = /^[A-Za-z0-9\s/&'’.-]+$/u.test(normalized) && normalized.length > 2;
  if (locale === 'en') {
    // A plain-ASCII title is already readable English prose — keep it as-is.
    // Anything else here is actually foreign-script/diacritic source text
    // (e.g. Serbian "Vozač"), which must NOT be kept: `isWrongLanguageAiOutput`
    // rejects Serbo-Croatian diacritics for every locale except sr/hr,
    // INCLUDING English, so leaking it here would surface as a validation
    // failure downstream instead of a generic-but-safe fallback.
    return isAsciiTitle ? normalized : null;
  }
  // For every other target locale, an unmapped title — ASCII (no known
  // translation) or non-ASCII (Serbian/Croatian diacritics or any other
  // script) — must fall back to the generic role label instead of being
  // returned as-is. Returning raw source-language text here leaks untranslated
  // text into the deterministic duration-shell sentence and the grounded
  // canonical-fallback summary (both embed `role` directly into prose for
  // every locale). Downstream locale validation then rejects that leaked
  // text, which surfaces as an intermittent "validation failed" toast
  // specifically for whichever job titles aren't in the small explicit map
  // above — regardless of which locale was requested immediately before.
  return null;
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
 * When the title strongly conflicts with canonical duties (e.g. Kuvar + warehouse),
 * skip forcing that title into Summary prose and use the neutral fallback instead.
 */
export function resolveOccupationalTitleForSummary(options: {
  profileJobTitle?: string;
  currentExperienceTitle?: string;
  locale: Locale;
  gender?: string;
  /** Concatenated experience/description text used for title↔duty consistency. */
  dutiesText?: string;
}): string {
  if (
    hasRoleDutyConsistencyConflict({
      profileJobTitle: options.profileJobTitle,
      experienceTitle: options.currentExperienceTitle,
      dutiesText: options.dutiesText,
    })
  ) {
    return getOccupationalTitleFallback(options.locale, options.gender);
  }
  const candidates = [options.profileJobTitle, options.currentExperienceTitle];
  for (const raw of candidates) {
    if (!isValidOccupationalTitle(raw || '')) continue;
    const localized = localizeKnownTitle(raw!.trim(), options.locale, options.gender);
    if (localized) return localized;
  }
  return getOccupationalTitleFallback(options.locale, options.gender);
}
