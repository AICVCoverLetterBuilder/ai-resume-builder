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
 * Approximate duration policy (shared across all locales).
 *
 * Deterministic rule from completed calendar months (Present uses reference clock):
 * 1. Under 12 months → report months (not years).
 * 2. Otherwise let `fullYears = floor(months/12)` and `rem = months % 12`:
 *    - rem ≤ 2  → whole years (near a whole-year boundary)
 *    - rem 3–8  → fullYears + 0.5 (near a half-year)
 *    - rem 9–11 → fullYears + 1 (closer to the next whole year)
 *
 * Examples: 12→1, 18→1.5, 24→2, 30→2.5, 33→3, 62→5.
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
  let approxYears: number;
  if (remainingMonths <= 2) {
    approxYears = fullYears;
  } else if (remainingMonths <= 8) {
    approxYears = fullYears + 0.5;
  } else {
    approxYears = fullYears + 1;
  }
  return {
    totalMonths,
    fullYears,
    remainingMonths,
    approxYears,
    unit: 'years',
    hasValidDates: true,
  };
}

/** Non-PII diagnostic bucket for duration (e.g. `years:2.5`, `months:8`). */
export function durationDisplayBucket(duration: ExperienceDuration): string {
  if (!duration.hasValidDates) return 'none';
  if (duration.unit === 'months') return `months:${duration.totalMonths}`;
  return `years:${duration.approxYears}`;
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

/** Absolute month index for overlap merging (year*12 + month). */
function yearMonthToIndex(ym: string): number | null {
  const parsed = parseYearMonth(ym);
  if (!parsed) return null;
  return parsed.year * 12 + parsed.month;
}

/**
 * Union length of employment intervals in months (overlapping roles counted once).
 */
export function mergeExperienceMonthsUnion(
  experiences: Array<Pick<WorkExperience, 'startDate' | 'endDate' | 'isPresent'>>,
  referenceDate: Date | string,
): number {
  const refYm = referenceDateToYearMonth(referenceDate);
  const intervals: Array<{ start: number; end: number }> = [];
  for (const exp of experiences) {
    if (!exp.startDate?.trim()) continue;
    const start = yearMonthToIndex(exp.startDate.trim().slice(0, 7));
    const endYm = exp.isPresent || !exp.endDate?.trim()
      ? refYm
      : exp.endDate.trim().slice(0, 7);
    const end = yearMonthToIndex(endYm);
    if (start == null || end == null || end < start) continue;
    intervals.push({ start, end });
  }
  if (!intervals.length) return 0;
  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  let union = 0;
  let curStart = intervals[0].start;
  let curEnd = intervals[0].end;
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= curEnd + 1) {
      curEnd = Math.max(curEnd, next.end);
    } else {
      union += Math.max(0, curEnd - curStart);
      curStart = next.start;
      curEnd = next.end;
    }
  }
  union += Math.max(0, curEnd - curStart);
  return union;
}

export function buildExperienceDurationSnapshot(
  experiences: Array<Pick<WorkExperience, 'id' | 'startDate' | 'endDate' | 'isPresent'>>,
  referenceDate: Date | string = new Date(),
): ExperienceDurationSnapshot {
  const referenceDateIso = toReferenceDateIso(referenceDate);
  const byExperienceId: Record<string, ExperienceDuration> = {};
  let hasValidDates = false;
  for (const exp of experiences) {
    const duration = computeExperienceDuration(exp, referenceDateIso);
    byExperienceId[exp.id] = duration;
    if (duration.hasValidDates) {
      hasValidDates = true;
    }
  }
  // Total tenure merges overlapping Present/past roles so duration is not double-counted.
  const totalMonths = hasValidDates
    ? mergeExperienceMonthsUnion(experiences, referenceDateIso)
    : 0;
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
  hi: { 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पाँच': 5, 'पांच': 5, 'छह': 6, 'छः': 6, 'ढाई': 2.5, 'डेढ़': 1.5, 'डेढ': 1.5 },
};

function tokenToYears(token: string): number | null {
  const t = (token || '').trim();
  if (!t) return null;
  if (/^\d+(?:\.\d+)?$/.test(t)) {
    const n = parseFloat(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const lower = t.toLowerCase();
  const halfPhrases: Record<string, number> = {
    'one and a half': 1.5,
    'two and a half': 2.5,
    'three and a half': 3.5,
    'four and a half': 4.5,
    'five and a half': 5.5,
    'jedne i po': 1.5,
    'dve i po': 2.5,
    'dvije i po': 2.5,
    'tri i po': 3.5,
    ढाई: 2.5,
    डेढ़: 1.5,
    डेढ: 1.5,
  };
  if (halfPhrases[t] != null) return halfPhrases[t];
  if (halfPhrases[lower] != null) return halfPhrases[lower];
  for (const wordMap of Object.values(WORD_TO_YEARS_BY_LOCALE)) {
    if (wordMap[t] != null) return wordMap[t];
    if (wordMap[lower] != null) return wordMap[lower];
  }
  return null;
}

function yearsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

/** Extract approximate year numbers claimed in a summary (empty if no duration claim). */
export function extractSummaryYearClaims(text: string): number[] {
  const raw = (text || '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ');
  const claims: number[] = [];

  // Half-year phrases (checked before bare "two years" / "दो वर्षों").
  const halfRes: Array<[RegExp, number]> = [
    [/\btwo\s+and\s+a\s+half\s+years?\b/giu, 2.5],
    [/\bone\s+and\s+a\s+half\s+years?\b/giu, 1.5],
    [/\bthree\s+and\s+a\s+half\s+years?\b/giu, 3.5],
    [/\bsix\s+and\s+a\s+half\s+years?\b/giu, 6.5],
    [/\bdve\s+i\s+po\s+godin/giu, 2.5],
    [/\bdvije\s+i\s+po\s+godin/giu, 2.5],
    [/\bjedne\s+i\s+po\s+godin/giu, 1.5],
    [/\bšest\s+i\s+po\s+godin|\bsest\s+i\s+po\s+godin/giu, 6.5],
    [/\bgodinu\s+i\s+po\b/giu, 1.5],
    [/ढाई\s*वर्ष/gu, 2.5],
    [/डेढ़\s*वर्ष|डेढ\s*वर्ष/gu, 1.5],
    // Arabic written half-years (must beat bare "ست سنوات" → 6).
    [/سنة\s*ونصف/gu, 1.5],
    [/سنتين\s*ونصف/gu, 2.5],
    [/ثلاث\s*سنوات\s*ونصف/gu, 3.5],
    [/أربع\s*سنوات\s*ونصف/gu, 4.5],
    [/خمس\s*سنوات\s*ونصف/gu, 5.5],
    [/ست\s*سنوات\s*ونصف/gu, 6.5],
    [/سبع\s*سنوات\s*ونصف/gu, 7.5],
    [/ثمان(?:ي)?\s*سنوات\s*ونصف/gu, 8.5],
    [/تسع\s*سنوات\s*ونصف/gu, 9.5],
    [/عشر\s*سنوات\s*ونصف/gu, 10.5],
  ];
  for (const [re, years] of halfRes) {
    if (re.test(raw)) claims.push(years);
  }
  // When an Arabic half-year phrase matched, skip the bare "ست سنوات" integer capture.
  const arabicHalfMatched = /(?:سنة|سنتين|ثلاث|أربع|خمس|ست|سبع|ثمان(?:ي)?|تسع|عشر)\s*(?:سنوات\s*)?ونصف/u.test(raw);
  // Freestyle Serbian "oko godinu dana" ≈ 1 year (provider often invents this).
  if (/\boko\s+godinu(?:\s+dana)?(?:\s+iskustva)?\b/iu.test(raw) && !/\bgodinu\s+i\s+po\b/iu.test(raw)) {
    claims.push(1);
  }
  // Numeric half-years beyond the word map (e.g. "16 i po godine", "16 and a half years").
  const numericHalf = [
    /\b(\d+)\s+i\s+po\s+godin/giu,
    /\b(\d+)\s+and\s+a\s+half\s+years?\b/giu,
    /साढ़े\s*(\d+)\s*वर्ष/gu,
  ];
  for (const re of numericHalf) {
    let m: RegExpExecArray | null;
    const clone = new RegExp(re.source, re.flags);
    while ((m = clone.exec(raw)) !== null) {
      const whole = Number(m[1]);
      if (Number.isFinite(whole) && whole > 0) claims.push(whole + 0.5);
    }
  }

  const patterns: RegExp[] = [
    /\b(?:around|about|approximately|over|nearly)?\s*(\d+(?:\.\d+)?)\s*\+?\s*years?\b/giu,
    /\b(?:around|about|approximately)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+years?\b/giu,
    /\b(?:oko|od|približno|otprilike|vise od|više od)\s+(jedne?|dvije?|dve|tri|četiri|cetiri|pet|šest|sest|sedam|osam|devet|deset|\d+(?:\.\d+)?)\s+godin/giu,
    /\b(\d+(?:\.\d+)?)\s+godin(?:a|e|u)(?:\s+radnog)?(?:\s+iskustva)?\b/giu,
    /(?:लगभग|करीब)?\s*(\d+(?:\.\d+)?|एक|दो|तीन|चार|पाँच|पांच|छह|ढाई|डेढ़|डेढ)\s*वर्ष/giu,
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
    // JS `\b` is ASCII-only — use Unicode letter lookarounds for Cyrillic.
    /(?<!\p{L})(?:около|примерно)?\s*(один|одного|одна|два|двух|три|трёх|трех|четыре|четырёх|четырех|пять|пяти|шесть|шести|семь|семи|восемь|восьми|девять|девяти|десять|десяти|\d+(?:\.\d+)?)(?:\s+с\s+половиной)?\s*(?:лет|года|год)(?!\p{L})/giu,
    // Arabic: "سنة واحدة" / "سنتين" are already complete one/two-year phrases.
    /(سنة واحدة|سنتين)(?!\s*ونصف)/giu,
    // Arabic: "مع حوالي أربع سنوات من الخبرة" (number word 3-10 + سنوات).
    // Skip when "… سنوات ونصف" already counted as a half-year claim.
    ...(arabicHalfMatched
      ? []
      : [/(ثلاث|أربع|خمس|ست|سبع|ثمان|تسع|عشر)\s*سنوات(?!\s*ونصف)/giu]),
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
    1: 'one', 1.5: 'one and a half', 2: 'two', 2.5: 'two and a half', 3: 'three', 3.5: 'three and a half',
    4: 'four', 4.5: 'four and a half', 5: 'five', 5.5: 'five and a half', 6: 'six', 6.5: 'six and a half',
    7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  },
  de: {
    1: 'einem', 1.5: 'anderthalb', 2: 'zwei', 2.5: 'zweieinhalb', 3: 'drei', 3.5: 'dreiereinhalb',
    4: 'vier', 4.5: 'viereinhalb', 5: 'fünf', 5.5: 'fünfeinhalb', 6: 'sechs',
    7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn',
  },
  es: {
    1: 'un', 1.5: 'uno y medio', 2: 'dos', 2.5: 'dos y medio', 3: 'tres', 3.5: 'tres y medio',
    4: 'cuatro', 4.5: 'cuatro y medio', 5: 'cinco', 5.5: 'cinco y medio', 6: 'seis',
    7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez',
  },
  fr: {
    1: 'un', 1.5: 'un an et demi', 2: 'deux', 2.5: 'deux ans et demi', 3: 'trois', 3.5: 'trois ans et demi',
    4: 'quatre', 4.5: 'quatre ans et demi', 5: 'cinq', 5.5: 'cinq ans et demi', 6: 'six',
    7: 'sept', 8: 'huit', 9: 'neuf', 10: 'dix',
  },
  it: {
    1: 'un', 1.5: 'un anno e mezzo', 2: 'due', 2.5: 'due anni e mezzo', 3: 'tre', 3.5: 'tre anni e mezzo',
    4: 'quattro', 4.5: 'quattro anni e mezzo', 5: 'cinque', 5.5: 'cinque anni e mezzo', 6: 'sei',
    7: 'sette', 8: 'otto', 9: 'nove', 10: 'dieci',
  },
  ar: {
    1: 'سنة', 1.5: 'سنة ونصف', 2: 'سنتين', 2.5: 'سنتين ونصف', 3: 'ثلاث سنوات', 3.5: 'ثلاث سنوات ونصف',
    4: 'أربع سنوات', 4.5: 'أربع سنوات ونصف', 5: 'خمس سنوات', 5.5: 'خمس سنوات ونصف',
    6: 'ست سنوات', 6.5: 'ست سنوات ونصف',
    7: 'سبع سنوات', 8: 'ثماني سنوات', 9: 'تسع سنوات', 10: 'عشر سنوات',
  },
  sr: {
    1: 'jedne', 1.5: 'jedne i po', 2: 'dve', 2.5: 'dve i po', 3: 'tri', 3.5: 'tri i po',
    4: 'četiri', 4.5: 'četiri i po', 5: 'pet', 5.5: 'pet i po', 6: 'šest', 6.5: 'šest i po',
    7: 'sedam', 8: 'osam', 9: 'devet', 10: 'deset',
  },
  hr: {
    1: 'jedne', 1.5: 'jedne i po', 2: 'dvije', 2.5: 'dvije i po', 3: 'tri', 3.5: 'tri i po',
    4: 'četiri', 4.5: 'četiri i po', 5: 'pet', 5.5: 'pet i po', 6: 'šest', 6.5: 'šest i po',
    7: 'sedam', 8: 'osam', 9: 'devet', 10: 'deset',
  },
  ru: {
    1: 'одного', 1.5: 'полутора', 2: 'двух', 2.5: 'двух с половиной', 3: 'трёх', 3.5: 'трёх с половиной',
    4: 'четырёх', 4.5: 'четырёх с половиной', 5: 'пяти', 5.5: 'пяти с половиной', 6: 'шести',
    7: 'семи', 8: 'восьми', 9: 'девяти', 10: 'десяти',
  },
  'pt-BR': {
    1: 'um', 1.5: 'um e meio', 2: 'dois', 2.5: 'dois e meio', 3: 'três', 3.5: 'três e meio',
    4: 'quatro', 4.5: 'quatro e meio', 5: 'cinco', 5.5: 'cinco e meio', 6: 'seis',
    7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
  },
  hi: {
    1: 'एक', 1.5: 'डेढ़', 2: 'दो', 2.5: 'ढाई', 3: 'तीन', 3.5: 'साढ़े तीन',
    4: 'चार', 4.5: 'साढ़े चार', 5: 'पाँच', 5.5: 'साढ़े पाँच', 6: 'छह', 6.5: 'साढ़े छह',
    7: 'सात', 7.5: 'साढ़े सात', 8: 'आठ', 8.5: 'साढ़े आठ', 9: 'नौ', 9.5: 'साढ़े नौ',
    10: 'दस', 10.5: 'साढ़े दस',
  },
  ja: {
    1: '1', 1.5: '1.5', 2: '2', 2.5: '2.5', 3: '3', 3.5: '3.5',
    4: '4', 4.5: '4.5', 5: '5', 5.5: '5.5', 6: '6',
    7: '7', 8: '8', 9: '9', 10: '10',
  },
};

/** Localized word/digit form for an approximate year count (shared by injectors/templates). */
export function yearWordForLocale(locale: Locale, n: number): string {
  const map = YEAR_WORD_BY_LOCALE[locale];
  if (map?.[n] != null) return map[n];
  if (Number.isInteger(n)) return String(n);
  // Avoid awkward "2.5 years" / "16.5 godine" prose when a locale map entry is missing.
  const whole = Math.floor(n);
  const half = Math.abs(n - whole - 0.5) < 0.01;
  if (!half) return String(n);
  const wholeWord = map?.[whole] ?? String(whole);
  if (locale === 'en') return `${wholeWord} and a half`;
  if (locale === 'sr' || locale === 'hr') return `${wholeWord} i po`;
  if (locale === 'hi') return whole >= 3 ? `साढ़े ${wholeWord}` : String(n);
  if (locale === 'de') return `${whole},5`;
  if (locale === 'es') return `${wholeWord} y medio`;
  if (locale === 'fr') return `${wholeWord} ans et demi`;
  if (locale === 'it') return `${wholeWord} anni e mezzo`;
  if (locale === 'pt-BR') return `${wholeWord} e meio`;
  if (locale === 'ru') return `${wholeWord} с половиной`;
  if (locale === 'ar') {
    // Prefer written half-years — never emit bidi-fragile decimals like 6.5.
    if (whole === 1) return 'سنة ونصف';
    if (whole === 2) return 'سنتين ونصف';
    return `${wholeWord} ونصف`;
  }
  // ja and other numeral-friendly locales may keep a decimal.
  return String(n);
}

export function summaryHasDurationClaim(text: string): boolean {
  const normalized = (text || '').replace(/(\d),(\d)/g, '$1.$2');
  return extractSummaryYearClaims(normalized).length > 0
    // Jahre?n? covers Jahr / Jahre / Jahren — the plural nominative "Jahre" (no
    // trailing "n") was previously missed, rejecting natural German phrasing such
    // as "Vier Jahre Erfahrung" that never uses the dative "Jahren" form.
    || /\b(years? of experience|godina iskustva|godinu(?:\s+i\s+po)?(?:\s+dana)?(?:\s+iskustva)?|profesionalnog iskustva|Jahre?n?\s*(?:Berufs)?[Ee]rfahrung|años de experiencia|ans d'expérience|anni di esperienza|anos de experiência|वर्षों के अनुभव|वर्ष के अनुभव|वर्षों?\s*का\s*अनुभव)\b/iu.test(normalized)
    || /\b(?:around|about|approximately)\s+[\w-]+\s+years?\b/iu.test(normalized)
    || /\b(?:oko|približno|otprilike)\s+\S+(?:\s+\S+)?\s+godin/iu.test(normalized)
    || /\boko\s+godinu\b/iu.test(normalized)
    || /\d+(?:\.\d+)?\s+godin(?:a|e|u)(?:\s+radnog)?(?:\s+iskustva)/iu.test(normalized)
    || /लगभग\s+\S+\s+वर्ष/u.test(normalized)
    || /約\s*\d+\s*年/u.test(normalized)
    || /\d+\s*年の経験/u.test(normalized)
    || /سنوات|سنة|خبرة/u.test(normalized)
    || /лет опыта|годом опыта|года опыта/u.test(normalized);
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
    const word = yearWordForLocale(locale, n);
    if (locale === 'ja' && new RegExp(`約\\s*${n}\\s*年`).test(summary)) return true;
    if (locale === 'hi' && summary.includes(word) && /वर्ष/.test(summary)) {
      // Reject hybrid written+numeric forms (e.g. साढ़े 6.5).
      if (/साढ़े\s*\d+(?:[.,]\d+)/u.test(summary)) return false;
      if (/साढ़े\s*(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)/u.test(summary)
        && /\d+(?:[.,]\d+)\s*वर्ष/u.test(summary)) {
        return false;
      }
      return true;
    }
    if ((locale === 'sr' || locale === 'hr') && new RegExp(
      `\\boko\\s+${escapeRegExpToken(word)}\\s+godin`,
      'iu',
    ).test(summary)) {
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
    const ok = claims.every((c) => yearsEqual(c, expected.approxYears));
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
  const word = yearWordForLocale(locale, n);
  const isHalf = !Number.isInteger(n);
  // Serbian/Croatian: 1 godina, 2–4 godine, 5+ godina; half-years use godine.
  const srYearNoun = isHalf || (n >= 2 && n <= 4) ? 'godine' : n === 1 ? 'godina' : 'godina';
  switch (locale) {
    case 'sr':
      return `sa oko ${word} ${srYearNoun} iskustva`;
    case 'hr':
      return `s oko ${word} ${srYearNoun} iskustva`;
    case 'hi':
      return `लगभग ${word} वर्षों का संयुक्त अनुभव`;
    case 'de':
      return isHalf
        ? `mit etwa ${word} Jahren Erfahrung`
        : `mit etwa ${word} Jahren Erfahrung`;
    case 'es':
      return `con alrededor de ${word} años de experiencia`;
    case 'fr':
      // French half phrases already include "ans".
      if (isHalf && /ans/.test(word)) return `avec environ ${word} d'expérience`;
      return `avec environ ${word} ans d'expérience`;
    case 'it':
      if (isHalf && /anni|anno/.test(word)) return `con circa ${word} di esperienza`;
      return `con circa ${word} anni di esperienza`;
    case 'ru':
      return `с опытом около ${word} лет`;
    case 'pt-BR':
      return `com cerca de ${word} anos de experiência`;
    case 'ar':
      // Single written RTL-safe duration — never numeric hybrids like 6.5.
      if (/سنوات|سنة|سنتين/.test(word)) {
        return `نحو ${word} من الخبرة المشتركة`;
      }
      return `نحو ${word} سنوات من الخبرة المشتركة`;
    case 'ja':
      return `約${word}年の経験`;
    default:
      return `with approximately ${word} years of experience`;
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
  // English word years (including half-year compounds)
  out = out.replace(
    /\b(around|about|approximately)\s+(one and a half|two and a half|three and a half|four and a half|five and a half|one|two|three|four|five|six|seven|eight|nine|ten|[\w-]+)\s+years?\b/giu,
    (_m, pref, tok) => {
      const mapped = YEAR_WORD_BY_LOCALE.en[target];
      if (mapped) return `${pref} ${mapped} years`;
      if (/^(one|two|three|four|five|six|seven|eight|nine|ten|[\w-]+)$/i.test(tok)) {
        return `${pref} ${YEAR_WORD_BY_LOCALE.en[target] || target} years`;
      }
      return _m;
    },
  );
  // Serbian / Croatian — preserve correct year-noun declension (incl. "dve i po")
  const srNoun = (!Number.isInteger(target) || (target >= 2 && target <= 4))
    ? 'godine'
    : target === 1 ? 'godina' : 'godina';
  out = out.replace(
    /\b(oko|približno|sa\s+oko|s\s+oko)\s+(jedne(?:\s+i\s+po)?|dvije?(?:\s+i\s+po)?|dve(?:\s+i\s+po)?|tri(?:\s+i\s+po)?|četiri|cetiri|pet|šest|sest|\d+(?:\.\d+)?)\s+godin\w*/giu,
    `$1 ${YEAR_WORD_BY_LOCALE.sr[target] || target} ${srNoun}`,
  );
  // Hindi — replace full duration spans including साढ़े compounds BEFORE bare digits,
  // otherwise "साढ़े छह" becomes "साढ़े 6.5" when only "छह" is substituted.
  const hiWord = yearWordForLocale('hi', target);
  out = out.replace(
    /(लगभग|करीब)?\s*(?:साढ़े\s*(?:\d+(?:[.,]\d+)?|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)|(?:\d+(?:[.,]\d+)?|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|ढाई|डेढ़|डेढ))\s*वर्षों?(?:\s*के\s*(?:कार्य\s*)?अनुभव(?:\s*के\s*साथ)?)?/gu,
    (_m, pref) => `${pref ? `${pref} ` : ''}${hiWord} वर्षों`.trim(),
  );

  // If still mismatched and has a claim, append/replace with locale phrase is too aggressive —
  // prefer light substitution then verify.
  return out.replace(/\s+/g, ' ').trim();
}
