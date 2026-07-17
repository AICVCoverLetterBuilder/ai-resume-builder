/**
 * Deterministic experience duration for summaries — one shared calculation for all locales.
 * PDF and DOCX must consume the same precomputed snapshot (never independent device clocks).
 */
import type { WorkExperience } from './types';
import type { Locale } from './i18n/translations';

export type ExperienceDuration = {
  totalMonths: number;
  fullYears: number;
  remainingMonths: number;
  /** Policy years/months for approximate summary wording. */
  approxYears: number;
  unit: 'months' | 'years';
  hasValidDates: boolean;
};

export type ExperienceDurationSnapshot = {
  /** ISO date `YYYY-MM-DD` used for all Present-role end calculations. */
  referenceDateIso: string;
  byExperienceId: Record<string, ExperienceDuration>;
  total: ExperienceDuration;
};

function parseYearMonth(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec((value || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year, month };
}

/** Calendar months from start YYYY-MM to end YYYY-MM (inclusive difference). */
export function monthsBetweenYearMonths(startYm: string, endYm: string): number {
  const start = parseYearMonth(startYm);
  const end = parseYearMonth(endYm);
  if (!start || !end) return 0;
  return (end.year - start.year) * 12 + (end.month - start.month);
}

export function referenceDateToYearMonth(referenceDate: Date | string): string {
  if (typeof referenceDate === 'string' && /^\d{4}-\d{2}/.test(referenceDate)) {
    return referenceDate.slice(0, 7);
  }
  const d = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    return `${fallback.getUTCFullYear()}-${String(fallback.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  // Use UTC calendar parts so PDF/DOCX never diverge by local timezone.
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function toReferenceDateIso(referenceDate: Date | string): string {
  if (typeof referenceDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(referenceDate)) {
    return referenceDate.slice(0, 10);
  }
  const ym = referenceDateToYearMonth(referenceDate);
  return `${ym}-01`;
}

/**
 * Approximate duration policy (shared across locales):
 * - under 12 months → months
 * - 12–17 months → ~1 year
 * - 18–29 months → ~2 years
 * - otherwise → rounded-down full years
 */
export function applyApproximateDurationPolicy(totalMonths: number): ExperienceDuration {
  if (!Number.isFinite(totalMonths) || totalMonths <= 0) {
    return {
      totalMonths: 0,
      fullYears: 0,
      remainingMonths: 0,
      approxYears: 0,
      unit: 'months',
      hasValidDates: false,
    };
  }
  const fullYears = Math.floor(totalMonths / 12);
  const remainingMonths = totalMonths % 12;
  if (totalMonths < 12) {
    return {
      totalMonths,
      fullYears,
      remainingMonths,
      approxYears: 0,
      unit: 'months',
      hasValidDates: true,
    };
  }
  if (totalMonths <= 17) {
    return {
      totalMonths,
      fullYears,
      remainingMonths,
      approxYears: 1,
      unit: 'years',
      hasValidDates: true,
    };
  }
  if (totalMonths <= 29) {
    return {
      totalMonths,
      fullYears,
      remainingMonths,
      approxYears: 2,
      unit: 'years',
      hasValidDates: true,
    };
  }
  return {
    totalMonths,
    fullYears,
    remainingMonths,
    approxYears: fullYears,
    unit: 'years',
    hasValidDates: true,
  };
}

export function computeExperienceDuration(
  exp: Pick<WorkExperience, 'startDate' | 'endDate' | 'isPresent'>,
  referenceDate: Date | string,
): ExperienceDuration {
  if (!exp.startDate?.trim()) {
    return applyApproximateDurationPolicy(0);
  }
  const endYm = exp.isPresent || !exp.endDate?.trim()
    ? referenceDateToYearMonth(referenceDate)
    : exp.endDate.trim().slice(0, 7);
  const months = monthsBetweenYearMonths(exp.startDate.trim().slice(0, 7), endYm);
  return applyApproximateDurationPolicy(Math.max(0, months));
}

export function buildExperienceDurationSnapshot(
  experiences: Array<Pick<WorkExperience, 'id' | 'startDate' | 'endDate' | 'isPresent'>>,
  referenceDate: Date | string = new Date(),
): ExperienceDurationSnapshot {
  const referenceDateIso = toReferenceDateIso(referenceDate);
  const byExperienceId: Record<string, ExperienceDuration> = {};
  let totalMonths = 0;
  let hasValidDates = false;
  for (const exp of experiences) {
    const duration = computeExperienceDuration(exp, referenceDateIso);
    byExperienceId[exp.id] = duration;
    if (duration.hasValidDates) {
      totalMonths += duration.totalMonths;
      hasValidDates = true;
    }
  }
  const total = hasValidDates
    ? applyApproximateDurationPolicy(totalMonths)
    : applyApproximateDurationPolicy(0);
  return { referenceDateIso, byExperienceId, total };
}

/** Compact token for AI prompts / legacy clients: "5", "1", "under-one-year", "practical", "". */
export function durationToPromptToken(duration: ExperienceDuration): string {
  if (!duration.hasValidDates) return '';
  if (duration.unit === 'months') {
    if (duration.totalMonths < 6) return 'practical';
    return 'under-one-year';
  }
  return String(duration.approxYears);
}

/**
 * Word-number maps for every supported locale (1-10), used to parse the duration
 * a translated/localized AI summary actually claims — never just the source language.
 * Includes common alternate/nominative forms in addition to the dative/oblique forms
 * used by `YEAR_WORD_BY_LOCALE` for the canned phrase (e.g. German "ein" vs "einem").
 */
const WORD_TO_YEARS_BY_LOCALE: Record<string, Record<string, number>> = {
  en: {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10,
  },
  de: {
    ein: 1, eine: 1, einem: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4,
    fünf: 5, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
  },
  es: {
    un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  },
  fr: {
    un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6,
    sept: 7, huit: 8, neuf: 9, dix: 10,
  },
  it: {
    un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5,
    sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  },
  'pt-BR': {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  },
  ru: {
    'один': 1, 'одного': 1, 'одна': 1, 'два': 2, 'двух': 2, 'три': 3, 'трёх': 3, 'трех': 3,
    'четыре': 4, 'четырёх': 4, 'четырех': 4, 'пять': 5, 'пяти': 5, 'шесть': 6, 'шести': 6,
    'семь': 7, 'семи': 7, 'восемь': 8, 'восьми': 8, 'девять': 9, 'девяти': 9,
    'десять': 10, 'десяти': 10,
  },
  ar: {
    'سنة واحدة': 1, 'سنتين': 2, 'ثلاث': 3, 'أربع': 4, 'خمس': 5,
    'ست': 6, 'سبع': 7, 'ثمان': 8, 'تسع': 9, 'عشر': 10,
  },
  sr: { jedne: 1, jedna: 1, jedan: 1, dve: 2, dvije: 2, dva: 2, tri: 3, četiri: 4, cetiri: 4, pet: 5, šest: 6, sest: 6 },
  hr: { jedne: 1, jedna: 1, jedan: 1, dve: 2, dvije: 2, dva: 2, tri: 3, četiri: 4, cetiri: 4, pet: 5, šest: 6, sest: 6 },
  hi: { 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'छः': 6 },
};

function tokenToYears(token: string): number | null {
  const t = (token || '').trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.floor(parseFloat(t));
  const lower = t.toLowerCase();
  for (const wordMap of Object.values(WORD_TO_YEARS_BY_LOCALE)) {
    if (wordMap[t] != null) return wordMap[t];
    if (wordMap[lower] != null) return wordMap[lower];
  }
  return null;
}

/** Extract approximate year numbers claimed in a summary (empty if no duration claim). */
export function extractSummaryYearClaims(text: string): number[] {
  const raw = text || '';
  const claims: number[] = [];
  const patterns: RegExp[] = [
    /\b(?:around|about|approximately|over|nearly)?\s*(\d+(?:\.\d+)?)\s*\+?\s*years?\b/giu,
    /\b(?:around|about|approximately)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/giu,
    /\b(?:oko|od|približno|vise od|više od)\s+(jedne?|dvije?|dve|tri|četiri|cetiri|pet|šest|sest|\d+)\s+godin/giu,
    /(?:लगभग|करीब)?\s*(\d+|एक|दो|तीन|चार|पाँच|पांच|छह)\s*वर्ष/giu,
    // German: "mit etwa vier Jahren Erfahrung" / "Vier Jahre Erfahrung" (Jahr|Jahre|Jahren).
    /\b(?:etwa|rund|ca\.?|ungefähr)?\s*(ein|eine|einem|einen|einer|zwei|drei|vier|fünf|funf|sechs|sieben|acht|neun|zehn|\d+(?:\.\d+)?)\s*\+?\s*Jahre?n?\b/giu,
    // Spanish: "con alrededor de cuatro años de experiencia".
    /\b(?:alrededor de|circa|unos?|unas?)?\s*(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\d+(?:\.\d+)?)\s*\+?\s*años?\b/giu,
    // French: "avec environ quatre ans d'expérience".
    /\b(?:environ|à peu près)?\s*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\d+(?:\.\d+)?)\s*\+?\s*ans?\b/giu,
    // Italian: "con circa quattro anni di esperienza".
    /\b(?:circa)?\s*(un|una|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|\d+(?:\.\d+)?)\s*\+?\s*anni?\b/giu,
    // Portuguese (BR): "com cerca de quatro anos de experiência".
    /\b(?:cerca de|aproximadamente)?\s*(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|\d+(?:\.\d+)?)\s*\+?\s*anos?\b/giu,
    // Russian: "с опытом около четырёх лет" / "четыре года опыта".
    /\b(?:около|примерно)?\s*(один|одного|одна|два|двух|три|трёх|трех|четыре|четырёх|четырех|пять|пяти|шесть|шести|семь|семи|восемь|восьми|девять|девяти|десять|десяти|\d+(?:\.\d+)?)\s*(?:лет|года|год)\b/giu,
    // Arabic: "سنة واحدة" / "سنتين" are already complete one/two-year phrases.
    /(سنة واحدة|سنتين)/giu,
    // Arabic: "مع حوالي أربع سنوات من الخبرة" (number word 3-10 + سنوات).
    /(ثلاث|أربع|خمس|ست|سبع|ثمان|تسع|عشر)\s*سنوات/giu,
    // Arabic: digit + سنوات/سنة.
    /(\d+(?:\.\d+)?)\s*(?:سنوات|سنة)/giu,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const clone = new RegExp(re.source, re.flags);
    while ((m = clone.exec(raw)) !== null) {
      const years = tokenToYears(m[1]);
      if (years != null) claims.push(years);
    }
  }
  return [...new Set(claims.filter((n) => n > 0 && n < 50))];
}

const YEAR_WORD_BY_LOCALE: Record<Locale, Record<number, string>> = {
  en: {
    1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six',
    7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  },
  de: {
    1: 'einem', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs',
    7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn',
  },
  es: {
    1: 'un', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis',
    7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez',
  },
  fr: {
    1: 'un', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq', 6: 'six',
    7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix',
  },
  it: {
    1: 'un', 2: 'due', 3: 'tre', 4: 'quattro', 5: 'cinque', 6: 'sei',
    7: 'sette', 8: 'otto', 9: 'nove', 10: 'dieci',
  },
  ar: {
    1: 'سنة واحدة', 2: 'سنتين', 3: 'ثلاث', 4: 'أربع', 5: 'خمس', 6: 'ست',
    7: 'سبع', 8: 'ثمان', 9: 'تسع', 10: 'عشر',
  },
  sr: {
    1: 'jedne', 2: 'dve', 3: 'tri', 4: 'četiri', 5: 'pet', 6: 'šest',
    7: 'sedam', 8: 'osam', 9: 'devet', 10: 'deset',
  },
  hr: {
    1: 'jedne', 2: 'dvije', 3: 'tri', 4: 'četiri', 5: 'pet', 6: 'šest',
    7: 'sedam', 8: 'osam', 9: 'devet', 10: 'deset',
  },
  ru: {
    1: 'одного', 2: 'двух', 3: 'трёх', 4: 'четырёх', 5: 'пяти', 6: 'шести',
    7: 'семи', 8: 'восьми', 9: 'девяти', 10: 'десяти',
  },
  'pt-BR': {
    1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis',
    7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
  },
  hi: {
    1: 'एक', 2: 'दो', 3: 'तीन', 4: 'चार', 5: 'पाँच', 6: 'छह',
    7: 'सात', 8: 'आठ', 9: 'नौ', 10: 'दस',
  },
  ja: {
    1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6',
    7: '7', 8: '8', 9: '9', 10: '10',
  },
};

/** Localized word/digit form for an approximate year count (shared by injectors/templates). */
export function yearWordForLocale(locale: Locale, n: number): string {
  return YEAR_WORD_BY_LOCALE[locale]?.[n] || String(n);
}

export function summaryHasDurationClaim(text: string): boolean {
  return extractSummaryYearClaims(text).length > 0
    // Jahre?n? covers Jahr / Jahre / Jahren — the plural nominative "Jahre" (no
    // trailing "n") was previously missed, rejecting natural German phrasing such
    // as "Vier Jahre Erfahrung" that never uses the dative "Jahren" form.
    || /\b(years? of experience|godina iskustva|profesionalnog iskustva|Jahre?n?\s*(?:Berufs)?[Ee]rfahrung|años de experiencia|ans d'expérience|anni di esperienza|anos de experiência|वर्षों के अनुभव|वर्ष के अनुभव|वर्षों?\s*का\s*अनुभव)\b/iu.test(text)
    || /\b(?:around|about|approximately)\s+[\w-]+\s+years?\b/iu.test(text)
    || /\boko\s+\S+\s+godin/iu.test(text)
    || /लगभग\s+\S+\s+वर्ष/u.test(text)
    || /約\s*\d+\s*年/u.test(text)
    || /\d+\s*年の経験/u.test(text)
    || /سنوات|سنة|خبرة/u.test(text)
    || /лет опыта|годом опыта|года опыта/u.test(text);
}

/** Escapes regex metacharacters so locale word forms can be embedded safely. */
function escapeRegExpToken(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scripts where JS regex `\b` is unreliable (it only recognises ASCII `[A-Za-z0-9_]`
 * as word characters), so a locale word must be matched with a plain substring test
 * instead of a word-boundary-anchored one.
 */
function scriptNeedsSubstringMatch(word: string): boolean {
  return /[^\u0000-\u02FF]/u.test(word);
}

/** True when `word` appears in `summary` as a standalone token, script-aware. */
function localeWordAppearsIn(summary: string, word: string): boolean {
  if (!word) return false;
  if (scriptNeedsSubstringMatch(word)) return summary.includes(word);
  return new RegExp(`\\b${escapeRegExpToken(word)}\\b`, 'iu').test(summary);
}

export function summaryIncludesDurationPhrase(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
): boolean {
  if (!duration.hasValidDates) return false;
  const phrase = formatApproximateDurationPhrase(duration, locale);
  if (phrase && summary.includes(phrase)) return true;
  // Locale digit/word forms of the expected approx years.
  if (duration.unit === 'years' && duration.approxYears > 0) {
    const n = duration.approxYears;
    const word = YEAR_WORD_BY_LOCALE[locale]?.[n] || String(n);
    if (locale === 'ja' && new RegExp(`約\\s*${n}\\s*年`).test(summary)) return true;
    if (locale === 'hi' && summary.includes(word) && /वर्ष/.test(summary)) return true;
    if ((locale === 'sr' || locale === 'hr') && new RegExp(`\\boko\\s+${word}\\s+godin`, 'iu').test(summary)) {
      return true;
    }
    // Generic cross-locale fallback: the expected number is claimed in this locale's
    // own word/digit form AND the text carries a recognizable duration/experience claim.
    // (Guards against accepting a bare number that has nothing to do with tenure.)
    if (localeWordAppearsIn(summary, word) && summaryHasDurationClaim(summary)) return true;
  }
  return false;
}

export function validateSummaryDuration(
  summary: string,
  expected: ExperienceDuration,
  options?: { requireDurationClaim?: boolean; locale?: Locale },
): { valid: boolean; claims: number[]; violation?: 'experience_duration_mismatch' } {
  if (!expected.hasValidDates || expected.unit !== 'years') {
    return { valid: true, claims: extractSummaryYearClaims(summary) };
  }
  const locale = options?.locale;
  if (locale && summaryIncludesDurationPhrase(summary, expected, locale)) {
    return { valid: true, claims: [expected.approxYears] };
  }
  if (!summaryHasDurationClaim(summary)) {
    // AI/fallback summaries must include the shared duration; user-written may omit it.
    if (options?.requireDurationClaim) {
      return { valid: false, claims: [], violation: 'experience_duration_mismatch' };
    }
    return { valid: true, claims: [] };
  }
  const claims = extractSummaryYearClaims(summary);
  if (claims.length) {
    const ok = claims.every((c) => c === expected.approxYears);
    return ok
      ? { valid: true, claims }
      : { valid: false, claims, violation: 'experience_duration_mismatch' };
  }
  // Duration phrasing present but year token unparsed (e.g. "ninety-nine years") —
  // require the deterministic approxYears to appear as a digit or a known word form.
  // Checks the *requested* locale's own word first (the actual root cause of the
  // cross-locale regression was this check silently only recognising en/sr/hi words),
  // then falls back to English as a universal safety net.
  const digitMentioned = new RegExp(`\\b${expected.approxYears}\\b`, 'iu').test(summary);
  const localeWord = locale ? YEAR_WORD_BY_LOCALE[locale]?.[expected.approxYears] : undefined;
  const localeWordMentioned = localeWord ? localeWordAppearsIn(summary, localeWord) : false;
  const enWord = YEAR_WORD_BY_LOCALE.en[expected.approxYears] || String(expected.approxYears);
  const enWordMentioned = localeWordAppearsIn(summary, enWord);
  const expectedMentioned = digitMentioned || localeWordMentioned || enWordMentioned;
  return expectedMentioned
    ? { valid: true, claims }
    : { valid: false, claims, violation: 'experience_duration_mismatch' };
}

/** Localized approximate-duration phrase for summary shells (identical underlying length). */
export function formatApproximateDurationPhrase(duration: ExperienceDuration, locale: Locale): string {
  if (!duration.hasValidDates) return '';
  if (duration.unit === 'months') {
    if (duration.totalMonths < 6) return '';
    if (locale === 'hi') return `लगभग ${duration.totalMonths} महीनों`;
    if (locale === 'sr' || locale === 'hr') return `oko ${duration.totalMonths} meseci`;
    return `around ${duration.totalMonths} months`;
  }
  const n = duration.approxYears;
  const word = YEAR_WORD_BY_LOCALE[locale]?.[n] || String(n);
  // Serbian/Croatian: 1 godina, 2–4 godine, 5+ godina
  const srYearNoun = n === 1 ? 'godina' : n >= 2 && n <= 4 ? 'godine' : 'godina';
  switch (locale) {
    case 'sr':
      return `sa oko ${word} ${srYearNoun} iskustva`;
    case 'hr':
      return `s oko ${word} ${srYearNoun} iskustva`;
    case 'hi':
      return `लगभग ${word} वर्षों के अनुभव के साथ`;
    case 'de':
      return `mit etwa ${word} Jahren Erfahrung`;
    case 'es':
      return `con alrededor de ${word} años de experiencia`;
    case 'fr':
      return `avec environ ${word} ans d'expérience`;
    case 'it':
      return `con circa ${word} anni di esperienza`;
    case 'ru':
      return `с опытом около ${word} лет`;
    case 'pt-BR':
      return `com cerca de ${word} anos de experiência`;
    case 'ar':
      return `مع حوالي ${word} من الخبرة`;
    case 'ja':
      return `約${word}年の経験`;
    default:
      return `with around ${word} years of experience`;
  }
}

/** Constrained repair: rewrite mismatched year claims to the deterministic value. */
export function repairSummaryDuration(
  summary: string,
  expected: ExperienceDuration,
  locale: Locale,
): string {
  if (!expected.hasValidDates || expected.unit !== 'years') return summary;
  let out = summary;
  const target = expected.approxYears;
  const word = YEAR_WORD_BY_LOCALE[locale]?.[target] || String(target);

  // Numeric years
  out = out.replace(
    /\b(around|about|approximately|over|nearly)?\s*\d+(?:\.\d+)?\s*\+?\s*years?\b/giu,
    (_m, pref) => `${pref ? `${pref} ` : ''}${target} years`.replace(/\s+/g, ' ').trim(),
  );
  // English word years (including unparsed compounds like ninety-nine)
  out = out.replace(
    /\b(around|about|approximately)\s+(one|two|three|four|five|six|seven|eight|nine|ten|[\w-]+)\s+years?\b/giu,
    (_m, pref, tok) => {
      if (/^(one|two|three|four|five|six|seven|eight|nine|ten|[\w-]+)$/i.test(tok)) {
        return `${pref} ${YEAR_WORD_BY_LOCALE.en[target] || target} years`;
      }
      return _m;
    },
  );
  // Serbian / Croatian — preserve correct year-noun declension
  const srNoun = target === 1 ? 'godina' : target >= 2 && target <= 4 ? 'godine' : 'godina';
  out = out.replace(
    /\b(oko|približno|sa\s+oko|s\s+oko)\s+(jedne?|dvije?|dve|tri|četiri|cetiri|pet|šest|sest|\d+)\s+godin\w*/giu,
    `$1 ${YEAR_WORD_BY_LOCALE.sr[target] || target} ${srNoun}`,
  );
  // Hindi
  out = out.replace(
    /(लगभग|करीब)?\s*(\d+|एक|दो|तीन|चार|पाँच|पांच|छह)\s*वर्षों?/giu,
    (_m, pref) => `${pref ? `${pref} ` : ''}${word} वर्षों`.trim(),
  );

  // If still mismatched and has a claim, append/replace with locale phrase is too aggressive —
  // prefer light substitution then verify.
  return out.replace(/\s+/g, ' ').trim();
}
