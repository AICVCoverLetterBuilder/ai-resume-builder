/**
 * Single ownership for Professional Summary duration phrases.
 *
 * Structured-date `ExperienceDuration` is the only authority. Provider freestyle
 * durations (e.g. "oko godinu dana") must be stripped before the canonical
 * `formatApproximateDurationPhrase` is inserted exactly once.
 *
 * Counting/stripping use a normalized scan text (decimal comma → point) and an
 * independent post-insert re-scan so diagnostics cannot false-pass.
 */
import type { Locale } from './i18n/translations';
import {
  formatApproximateDurationPhrase,
  summaryIncludesDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';

/** Local context type — avoid importing cv-content-quality (circular). */
export type SummaryDurationContext = {
  role?: string;
  company?: string;
  startDate?: string;
  gender?: string;
};

export type SummaryDurationClaimKind = 'numeric' | 'written' | 'mixed' | 'unknown';

export type SummaryDurationClaimHit = {
  start: number;
  end: number;
  kind: SummaryDurationClaimKind;
  matched: string;
};

export type SummaryDurationOwnershipDiagnostics = {
  summaryDurationExpressionCount: number;
  authoritativeDurationMonths: number | null;
  authoritativeDurationBucket: number | null;
  providerDurationDetected: boolean;
  conflictingDurationDetected: boolean;
  duplicateDurationRemoved: boolean;
  finalDurationExpressionCount: number;
  /** Independent scan before any strip/insert. */
  durationClaimCountBeforeStrip: number;
  numericDurationClaimCount: number;
  writtenDurationClaimCount: number;
  durationClaimsRemovedBeforeInsert: number;
  durationClaimCountAfterInsert: number;
  /** Second, independent scan of the finalized text (must agree with after-insert). */
  independentFinalDurationClaimCount: number;
  durationDetectorAgreement: boolean;
  durationValidationPassed: boolean;
  finalDurationRepresentationKind?: DurationRepresentationKind;
  finalDurationRepresentationCount?: number;
  finalDurationHybridDetected?: boolean;
  durationSemanticValueMonths?: number | null;
  durationRepresentationAgreement?: boolean;
  /** Non-PII revision from the duration finalizer implementation that ran. */
  summaryDurationFinalizerRevision?: string;
};

/**
 * Normalize text for duration scanning:
 * - decimal comma → point (`6,5` → `6.5`)
 * - collapse whitespace
 * Does not change meaning of non-decimal commas in prose beyond digit,digit.
 */
export function normalizeDurationScanText(text: string): string {
  return (text || '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Locale-agnostic duration expression spans for counting / stripping.
 * Patterns run against `normalizeDurationScanText` so `6,5` and `6.5` share one path.
 */
/** Digit amount: whole or decimal with `.` or `,` (scan text normalizes `,` → `.`). */
const NUM = String.raw`\d+(?:\.\d+)?`;

const DURATION_EXPRESSION_RES: RegExp[] = [
  // English — half-year optional on every spelled number
  new RegExp(
    String.raw`\b(?:with\s+)?(?:around|about|approximately|over|nearly)\s+(?:${NUM}|one(?:\s+and\s+a\s+half)?|two(?:\s+and\s+a\s+half)?|three(?:\s+and\s+a\s+half)?|four(?:\s+and\s+a\s+half)?|five(?:\s+and\s+a\s+half)?|six(?:\s+and\s+a\s+half)?|seven(?:\s+and\s+a\s+half)?|eight(?:\s+and\s+a\s+half)?|nine(?:\s+and\s+a\s+half)?|ten(?:\s+and\s+a\s+half)?)\s+years?(?:\s+of\s+(?:work\s+)?experience)?\b`,
    'giu',
  ),
  /\b(?:around|about|approximately)\s+\d+\s+months?\b/giu,
  new RegExp(
    String.raw`\b${NUM}\s+years?(?:\s+of\s+(?:work\s+)?experience)\b`,
    'giu',
  ),

  // Serbian / Croatian — approximators, numeric (decimal comma normalized), written, radnog
  // Use (?<!\p{L}) instead of \b so diacritic-initial tokens (šest, četiri, približno) match.
  new RegExp(
    String.raw`(?<!\p{L})(?:sa\s+)?(?:oko|približno|otprilike|s\s+oko)\s+(?:jedne?(?:\s+i\s+po)?|dvije?(?:\s+i\s+po)?|dve(?:\s+i\s+po)?|tri(?:\s+i\s+po)?|četiri(?:\s+i\s+po)?|cetiri(?:\s+i\s+po)?|pet(?:\s+i\s+po)?|šest(?:\s+i\s+po)?|sest(?:\s+i\s+po)?|sedam(?:\s+i\s+po)?|osam(?:\s+i\s+po)?|devet(?:\s+i\s+po)?|deset(?:\s+i\s+po)?|${NUM}(?:\s+i\s+po)?)\s+godin(?:a|e|u)(?:\s+radnog)?(?:\s+iskustva)?(?!\p{L})`,
    'giu',
  ),
  /(?<!\p{L})(?:sa\s+)?(?:oko|približno|otprilike|s\s+oko)\s+godinu(?:\s+i\s+po)?(?:\s+dana)?(?:\s+(?:radnog\s+)?iskustva)?(?!\p{L})/giu,
  /(?<!\p{L})(?:jedne?\s+i\s+po|dve\s+i\s+po|dvije\s+i\s+po|tri\s+i\s+po|četiri\s+i\s+po|cetiri\s+i\s+po|pet\s+i\s+po|šest\s+i\s+po|sest\s+i\s+po|sedam\s+i\s+po|osam\s+i\s+po|devet\s+i\s+po|deset\s+i\s+po)\s+godin(?:a|e|u)(?:\s+radnog)?(?:\s+iskustva)?(?!\p{L})/giu,
  new RegExp(
    String.raw`(?<!\p{L})${NUM}\s+godin(?:a|e|u)(?:\s+radnog)?(?:\s+iskustva)(?!\p{L})`,
    'giu',
  ),
  /(?<!\p{L})godinu(?:\s+i\s+po)?\s+dana(?:\s+(?:radnog\s+)?iskustva)?(?!\p{L})/giu,
  /(?<!\p{L})(?:sa\s+)?oko\s+\d+\s+meseci(?:\s+iskustva)?(?!\p{L})/giu,

  // German
  new RegExp(
    String.raw`\b(?:mit\s+)?(?:etwa|rund|ca\.?|ungefähr)\s+(?:anderthalb|zweieinhalb|dreieinhalb|[\wäöü]+|${NUM})\s+Jahre?n?(?:\s+(?:Berufs)?[Ee]rfahrung)?\b`,
    'giu',
  ),
  new RegExp(
    String.raw`\b${NUM}\s+Jahre?n?(?:\s+(?:Berufs)?[Ee]rfahrung)\b`,
    'giu',
  ),

  // Spanish
  /\b(?:con\s+)?(?:alrededor\s+de|circa|aproximadamente|unos?|unas?)\s+(?:un|una|uno|dos|tres|cuatro|cinco|seis)(?:\s+y\s+medio)?\s+años?(?:\s+de\s+experiencia)?\b/giu,
  new RegExp(
    String.raw`\b(?:con\s+)?(?:alrededor\s+de|circa|aproximadamente|unos?|unas?)\s+${NUM}\s+años?(?:\s+de\s+experiencia)?\b`,
    'giu',
  ),
  new RegExp(
    String.raw`\b${NUM}\s+años?(?:\s+de\s+experiencia)\b`,
    'giu',
  ),

  // French
  new RegExp(
    String.raw`\b(?:avec\s+)?(?:environ|à\s+peu\s+près|approximativement)\s+(?:un\s+an\s+et\s+demi|deux\s+ans\s+et\s+demi|trois\s+ans\s+et\s+demi|quatre\s+ans\s+et\s+demi|cinq\s+ans\s+et\s+demi|six\s+ans\s+et\s+demi|[\w]+|${NUM})\s*(?:ans?)?(?:\s+d['']expérience)?\b`,
    'giu',
  ),
  new RegExp(
    String.raw`\b${NUM}\s+ans?(?:\s+d['']expérience)\b`,
    'giu',
  ),

  // Italian
  new RegExp(
    String.raw`\b(?:con\s+)?(?:circa|approssimativamente)\s+(?:un\s+anno\s+e\s+mezzo|due\s+anni\s+e\s+mezzo|tre\s+anni\s+e\s+mezzo|sei\s+anni\s+e\s+mezzo|[\w]+|${NUM})\s*(?:anni?)?(?:\s+di\s+esperienza)?\b`,
    'giu',
  ),
  new RegExp(
    String.raw`\b${NUM}\s+anni?(?:\s+di\s+esperienza)\b`,
    'giu',
  ),

  // Portuguese — include all common "N e meio" half-year forms (not only 1.5/2.5/3.5/6.5).
  new RegExp(
    String.raw`\b(?:com\s+)?(?:cerca\s+de|aproximadamente)\s+(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|${NUM})(?:\s+e\s+meio)?\s+anos?(?:\s+de\s+experiência)?\b`,
    'giu',
  ),
  new RegExp(
    String.raw`\b(?:um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez)(?:\s+e\s+meio)\s+anos?(?:\s+de\s+experiência)?\b`,
    'giu',
  ),
  new RegExp(
    String.raw`\b${NUM}\s+anos?(?:\s+de\s+experiência)\b`,
    'giu',
  ),

  // Hindi — written (साढ़े छह), numeric (6.5), and hybrid (साढ़े 6.5) forms
  new RegExp(
    String.raw`(?:लगभग|करीब)?\s*(?:साढ़े\s*(?:\d+(?:[.,]\d+)?|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)|(?:${NUM}|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|ढाई|डेढ़|डेढ))\s*वर्षों?(?:\s*(?:का|के)\s*(?:संयुक्त\s*)?(?:कार्य\s*)?अनुभव(?:\s*के\s*साथ|\s*रखने)?)?`,
    'gu',
  ),
  // Hindi months-based: छह वर्ष छह महीने
  /(?:लगभग|करीब)?\s*(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|\d+)\s*वर्ष(?:ों)?\s*(?:और\s*)?(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|\d+)\s*महीन[ेों]/gu,

  // Japanese
  new RegExp(String.raw`約\s*${NUM}\s*年の(?:勤務)?経験`, 'gu'),
  new RegExp(String.raw`${NUM}\s*年の(?:勤務)?経験`, 'gu'),

  // Russian — JS `\b`/`\w` are ASCII-only; use Unicode letter lookarounds.
  new RegExp(
    String.raw`(?<!\p{L})с\s+опытом\s+около\s+(?:\p{L}+(?:\s+с\s+половиной)?|${NUM})\s+лет(?!\p{L})`,
    'giu',
  ),
  new RegExp(
    String.raw`(?<!\p{L})(?:около|примерно)\s+(?:\p{L}+(?:\s+с\s+половиной)?|${NUM})\s*(?:лет|года|год)(?:\s+(?:трудового\s+)?опыта)?(?!\p{L})`,
    'giu',
  ),
  new RegExp(
    String.raw`(?<!\p{L})(?:один|одного|одна|два|двух|три|трёх|трех|четыре|четырёх|четырех|пять|пяти|шесть|шести|семь|семи|восемь|восьми|девять|девяти|десять|десяти|${NUM})(?:\s+с\s+половиной)?\s*(?:лет|года|год)(?:\s+(?:трудового\s+)?опыта)(?!\p{L})`,
    'giu',
  ),
  new RegExp(
    String.raw`(?<!\p{L})${NUM}\s*(?:лет|года|год)(?:\s+(?:трудового\s+)?опыта)(?!\p{L})`,
    'giu',
  ),

  // Arabic — written RTL-safe phrases (نحو / حوالي + years + الخبرة المشتركة)
  /نحو\s+.+\s+من\s+الخبرة(?:\s+المشتركة)?/gu,
  /مع\s+حوالي\s+.+\s+من\s+(?:خبرة\s+العمل|الخبرة)/gu,
  /حوالي\s+.+\s+من\s+(?:خبرة\s+العمل|الخبرة(?:\s+المشتركة)?)/gu,
  new RegExp(
    String.raw`(?:نحو|حوالي)\s+(?:سنة\s*ونصف|سنتين(?:\s*ونصف)?|سنة واحدة|(?:ثلاث|أربع|خمس|ست|سبع|ثمان(?:ي)?|تسع|عشر)\s*سنوات(?:\s*ونصف)?|${NUM}\s*(?:سنوات|سنة))(?:\s+من\s+(?:خبرة\s+العمل|الخبرة(?:\s+المشتركة)?))?`,
    'gu',
  ),
];

/** Same patterns but accept raw `,` or `.` decimals (for stripping without rewriting prose). */
const DURATION_STRIP_RES: RegExp[] = DURATION_EXPRESSION_RES.map((re) =>
  new RegExp(re.source.replace(/\\d\+\(\?:\\.\\d\+\)\?/g, String.raw`\d+(?:[.,]\d+)?`), re.flags),
);

const NUMERIC_HINT_RE = /\d/;
const WRITTEN_HINT_RE =
  /(?:one|two|three|four|five|six|seven|eight|nine|ten|and\s+a\s+half|jedne|dve|dvije|tri|četiri|cetiri|pet|šest|sest|sedam|osam|devet|deset|\bi\s+po\b|anderthalb|años|ans|anni|anos|один|одного|два|двух|три|трёх|четыре|четырёх|пять|шесть|семь|восемь|девять|десять|с\s+половиной|एक|दो|तीन|चार|पाँच|छह|सात|आठ|नौ|दस|ढाई|डेढ़|साढ़े|ثلاث|أربع|خمس|ست|سبع|ثمان|تسع|عشر|سنة|سنتين|ونصف|نحو|حوالي)/iu;

/** Representation styles inside a single duration claim. */
export type DurationRepresentationKind =
  | 'numeric'
  | 'written'
  | 'written_half_year'
  | 'months'
  | 'hybrid'
  | 'none'
  | 'unknown';

export type DurationRepresentationAnalysis = {
  semanticClaimCount: number;
  numericRepresentationCount: number;
  writtenRepresentationCount: number;
  monthsRepresentationCount: number;
  hybridRepresentationCount: number;
  duplicateEquivalentDurationCount: number;
  representationKind: DurationRepresentationKind;
  representationCount: number;
  hybridDetected: boolean;
  agreement: boolean;
};

/**
 * Detect hybrid / multi-representation duration claims such as:
 * - साढ़े 6.5 वर्ष (written half-marker + decimal)
 * - six and a half 6.5 years
 * - 6.5 years, that is six and a half years
 */
export function analyzeDurationRepresentations(
  text: string,
  _locale?: Locale,
): DurationRepresentationAnalysis {
  const raw = text || '';
  const normalized = normalizeDurationScanText(raw);
  const claims = scanSummaryDurationClaims(normalized);
  let numericRepresentationCount = 0;
  let writtenRepresentationCount = 0;
  let monthsRepresentationCount = 0;
  let hybridRepresentationCount = 0;

  const hiHybrid = /साढ़े\s*\d+(?:[.,]\d+)/u.test(normalized)
    || (/साढ़े\s*(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)/u.test(normalized)
      && /\d+(?:[.,]\d+)\s*वर्ष/u.test(normalized))
    || (/\d+(?:[.,]\d+)\s*वर्ष/u.test(normalized)
      && /(?:यानी|अर्थात्|अर्थात)\s*साढ़े/u.test(normalized));

  // Months-based "छह वर्ष छह महीने" is a single valid representation, not a hybrid.
  const hiMonthsBased = /(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|\d+)\s*वर्ष(?:ों)?\s*(?:और\s*)?(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|\d+)\s*महीन/u.test(normalized);

  const enHybrid = /(?:six|two|three|four|five|one)\s+and\s+a\s+half\s+\d+(?:[.,]\d+)\s+years?/iu.test(normalized)
    || (/\d+(?:[.,]\d+)\s+years?/iu.test(normalized)
      && /(?:that\s+is|i\.e\.|or)\s+(?:six|two|three|four|five|one)\s+and\s+a\s+half/iu.test(normalized));

  const srHybrid = /(?:šest|sest|dve|dvije|tri|pet)\s+i\s+po\s+\d+(?:[.,]\d+)\s+godin/iu.test(normalized)
    || (/\d+(?:[.,]\d+)\s+godin/iu.test(normalized)
      && /(?:odnosno|tj\.|to\s+jest)\s+(?:šest|sest|dve|dvije)\s+i\s+po/iu.test(normalized));

  const ruHybrid = /(?:шести|двух|трёх|трех)\s+с\s+половиной\s+\d+(?:[.,]\d+)\s*лет/iu.test(normalized);
  const arHybrid = /(?:ست|سنتين|ثلاث)\s+ونصف\s+\d+(?:[.,]\d+)/u.test(normalized);
  const jaHybrid = /約?\s*\d+(?:[.,]\d+)\s*年.*(?:半年|半)/u.test(normalized)
    || /(?:半年|半).*\d+(?:[.,]\d+)\s*年/u.test(normalized);

  if ((hiHybrid && !hiMonthsBased) || enHybrid || srHybrid || ruHybrid || arHybrid || jaHybrid) {
    hybridRepresentationCount += 1;
  }

  for (const h of claims) {
    const m = h.matched;
    if (/महीन|months?/iu.test(m) && /वर्ष|years?|godin/iu.test(m)) {
      monthsRepresentationCount += 1;
      continue;
    }
    if (h.kind === 'mixed' || (/साढ़े/.test(m) && /\d+(?:[.,]\d+)/.test(m))) {
      hybridRepresentationCount += 1;
    } else if (h.kind === 'numeric') {
      numericRepresentationCount += 1;
    } else if (h.kind === 'written') {
      writtenRepresentationCount += 1;
    }
  }

  // Dual equivalent claims in one text (numeric + written of same duration).
  // Skip when the only written cue is months-based (years+months is one representation).
  const hasNumeric = /\d+(?:[.,]\d+)?\s*(?:years?|godin|Jahre|años|ans|anni|anos|лет|سنة|سنوات|वर्ष|年)/iu.test(normalized);
  const hasWritten = /(?:and\s+a\s+half|i\s+po|с\s+половиной|साढ़े|डेढ़|ढाई|anderthalb|y\s+medio|et\s+demi|e\s+mezzo|e\s+meio)/iu.test(normalized)
    || /(?:one|two|three|four|five|six|seven|eight|nine|ten)\s+years?/iu.test(normalized);
  let duplicateEquivalentDurationCount = 0;
  if (!hiMonthsBased && claims.length >= 2 && hasNumeric && hasWritten) {
    duplicateEquivalentDurationCount = claims.length - 1;
  }
  if (hybridRepresentationCount > 0) {
    duplicateEquivalentDurationCount = Math.max(duplicateEquivalentDurationCount, 1);
  }

  const stylesPresent = [
    numericRepresentationCount > 0,
    writtenRepresentationCount > 0 && !hiMonthsBased,
    monthsRepresentationCount > 0 || hiMonthsBased,
  ].filter(Boolean).length;

  let representationKind: DurationRepresentationKind = 'none';
  if (hiMonthsBased) {
    representationKind = 'months';
  } else if (hybridRepresentationCount > 0 || (stylesPresent > 1 && claims.length >= 1)) {
    representationKind = 'hybrid';
  } else if (monthsRepresentationCount > 0) {
    representationKind = 'months';
  } else if (
    writtenRepresentationCount > 0
    && /साढ़े\s*(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)/u.test(normalized)
    && !/\d+(?:[.,]\d+)?\s*वर्ष/u.test(normalized)
  ) {
    representationKind = 'written_half_year';
  } else if (writtenRepresentationCount > 0) {
    representationKind = 'written';
  } else if (numericRepresentationCount > 0) {
    representationKind = 'numeric';
  } else if (claims.length > 0) {
    representationKind = 'unknown';
  }

  const representationCount = hiMonthsBased
    ? 1
    : Math.max(
      claims.length,
      hybridRepresentationCount > 0 ? 2 : 0,
      stylesPresent,
    );
  const hybridDetected = !hiMonthsBased
    && (representationKind === 'hybrid' || hybridRepresentationCount > 0);
  const agreement = !hybridDetected
    && (hiMonthsBased || claims.length <= 1)
    && (hiMonthsBased || stylesPresent <= 1)
    && duplicateEquivalentDurationCount === 0;

  return {
    semanticClaimCount: claims.length,
    numericRepresentationCount,
    writtenRepresentationCount,
    monthsRepresentationCount,
    hybridRepresentationCount,
    duplicateEquivalentDurationCount,
    representationKind,
    representationCount: hybridDetected ? Math.max(2, representationCount) : Math.max(claims.length, stylesPresent || 0),
    hybridDetected,
    agreement,
  };
}

export function hasHybridDurationRepresentation(text: string, locale?: Locale): boolean {
  return analyzeDurationRepresentations(text, locale).hybridDetected;
}

function cloneRes(): RegExp[] {
  return DURATION_EXPRESSION_RES.map((re) => new RegExp(re.source, re.flags));
}

function classifyClaim(matched: string): SummaryDurationClaimKind {
  const hasNum = NUMERIC_HINT_RE.test(matched);
  const hasWritten = WRITTEN_HINT_RE.test(matched);
  // साढ़े + arabic digits (esp. decimals) is a hybrid representation.
  if (/साढ़े/.test(matched) && /\d/.test(matched)) return 'mixed';
  if (hasNum && hasWritten) return 'mixed';
  if (hasNum) return 'numeric';
  if (hasWritten) return 'written';
  return 'unknown';
}

/**
 * Independent scan of total-experience duration claims.
 * Always normalizes decimal commas before matching.
 */
export function scanSummaryDurationClaims(
  text: string,
  _locale?: Locale,
): SummaryDurationClaimHit[] {
  const raw = text || '';
  if (!raw.trim()) return [];
  const normalized = normalizeDurationScanText(raw);
  // Map matches on normalized text back by searching original for the
  // comma-or-point equivalent when possible; for counting we use normalized spans.
  const hits: SummaryDurationClaimHit[] = [];
  for (const re of cloneRes()) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(normalized)) !== null) {
      const matched = m[0];
      hits.push({
        start: m.index,
        end: m.index + matched.length,
        kind: classifyClaim(matched),
        matched,
      });
      if (matched.length === 0) re.lastIndex += 1;
    }
  }
  if (!hits.length) return [];
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: SummaryDurationClaimHit[] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.start < last.end) {
      last.end = Math.max(last.end, h.end);
      if (last.kind !== h.kind) last.kind = 'mixed';
      last.matched = normalized.slice(last.start, last.end);
    } else {
      merged.push({ ...h });
    }
  }
  return merged;
}

/** Count distinct duration expressions (independent scan). */
export function countSummaryDurationExpressions(text: string, locale?: Locale): number {
  return scanSummaryDurationClaims(text, locale).length;
}

export type DurationClaimBreakdown = {
  total: number;
  numeric: number;
  written: number;
  mixed: number;
};

export function summarizeDurationClaimBreakdown(
  text: string,
  locale?: Locale,
): DurationClaimBreakdown {
  const hits = scanSummaryDurationClaims(text, locale);
  let numeric = 0;
  let written = 0;
  let mixed = 0;
  for (const h of hits) {
    if (h.kind === 'numeric') numeric += 1;
    else if (h.kind === 'written') written += 1;
    else if (h.kind === 'mixed') mixed += 1;
  }
  return { total: hits.length, numeric, written, mixed };
}

/**
 * Independent post-finalization verifier — must not be satisfied solely by the
 * mutator's own bookkeeping fields.
 */
export function verifyIndependentFinalDurationCount(
  text: string,
  locale: Locale,
  options?: { requireExactlyOne?: boolean },
): { ok: boolean; count: number; breakdown: DurationClaimBreakdown; representation: DurationRepresentationAnalysis } {
  const breakdown = summarizeDurationClaimBreakdown(text, locale);
  const representation = analyzeDurationRepresentations(text, locale);
  const requireOne = options?.requireExactlyOne !== false;
  const countOk = requireOne ? breakdown.total === 1 : breakdown.total <= 1;
  const ok = countOk && representation.agreement && !representation.hybridDetected;
  return { ok, count: breakdown.total, breakdown, representation };
}

/** Strip every recognized duration expression, cleaning leftover commas/spaces. */
export function stripAllSummaryDurationExpressions(text: string, _locale?: Locale): string {
  let out = text || '';
  // Prefer comma/point-tolerant strip patterns so we do not rewrite unrelated decimals.
  for (const re of DURATION_STRIP_RES.map((r) => new RegExp(r.source, r.flags))) {
    out = out.replace(re, ' ');
  }
  // Residual numeric forms with decimal comma/point + year/experience (all locales).
  out = out.replace(
    /\b(?:sa\s+|with\s+|con\s+|mit\s+|avec\s+|com\s+)?(?:oko|približno|otprilike|around|about|approximately|environ|circa|cerca\s+de|etwa|rund|ungefähr)?\s*\d+[.,]\d+\s+(?:godin(?:a|e|u)|years?|Jahre?n?|años?|ans?|anni?|anos?)(?:\s+(?:radnog\s+)?(?:iskustva|of\s+(?:work\s+)?experience|Erfahrung|de\s+experiencia|d['']expérience|di\s+esperienza|de\s+experiência))?\b/giu,
    ' ',
  );
  // Residual hybrid / dual-representation forms (numeric + यानी + written).
  out = out.replace(
    /\d+(?:[.,]\d+)?\s*वर्ष(?:ों)?\s*(?:यानी|अर्थात्|अर्थात)\s*साढ़े\s*(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|\d+)\s*वर्ष(?:ों)?/gu,
    ' ',
  );
  out = out.replace(
    /साढ़े\s*(?:एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस)\s*वर्ष(?:ों)?\s*(?:यानी|अर्थात्|अर्थात)\s*\d+(?:[.,]\d+)?\s*वर्ष(?:ों)?/gu,
    ' ',
  );
  out = out
    .replace(/\s*,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\(\s*\)/g, '')
    // Dangling conjunctions left after removing dual "sa X i sa Y" duration clauses.
    .replace(/\b(sa|s|with|con|mit|avec|com)\s+(?=[,.;!?]|$)/giu, '')
    .replace(/\s+\bi\b\s+(?=u\s|u\b|,|\.|$)/giu, ' ')
    .replace(/\s+\band\b\s+(?=with\b|,|\.|$)/giu, ' ')
    .replace(/\s+([.!?।])/gu, '$1')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out;
}

function mergePhraseIntoFirstSentence(text: string, phrase: string, locale: Locale): string {
  const trimmed = (text || '').trim();
  if (locale === 'hi') {
    if (!trimmed) return `${phrase}।`;
    return `${trimmed.replace(/[।.!?]+$/u, '')} ${phrase}।`.replace(/\s+/g, ' ').trim();
  }
  if (!trimmed) {
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`;
  }
  const match = trimmed.match(/^(.+?)([.!?۔])(\s+.*)?$/u);
  if (match) {
    const head = match[1].trim().replace(/[, ،]+$/u, '');
    const rest = (match[3] || '').trim();
    const merged = `${head}, ${phrase}${match[2]}`.replace(/\s+/g, ' ').trim();
    return rest ? `${merged} ${rest}`.replace(/\s+/g, ' ').trim() : merged;
  }
  const withoutTrailingPunct = trimmed.replace(/[.!?۔]+\s*$/u, '');
  return `${withoutTrailingPunct}, ${phrase}.`.replace(/\s+/g, ' ').trim();
}

export type EnforceAuthoritativeDurationResult = {
  summary: string;
  diagnostics: SummaryDurationOwnershipDiagnostics;
  changed: boolean;
};

/**
 * Ensure Summary contains at most one duration phrase — the structured-date phrase.
 * Flow: independent scan → strip all → insert one → independent re-scan → require count === 1.
 */
export function enforceAuthoritativeSummaryDuration(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
  options?: {
    requireDurationClaim?: boolean;
    context?: SummaryDurationContext;
    injectFn?: (
      text: string,
      duration: ExperienceDuration,
      locale: Locale,
      context?: SummaryDurationContext,
    ) => string;
  },
): EnforceAuthoritativeDurationResult {
  const requireClaim = Boolean(options?.requireDurationClaim);
  const beforeBreakdown = summarizeDurationClaimBreakdown(summary, locale);
  const beforeCount = beforeBreakdown.total;
  const phrase = duration.hasValidDates
    ? formatApproximateDurationPhrase(duration, locale)
    : '';
  const hasAuthoritative = phrase
    ? summaryIncludesDurationPhrase(summary, duration, locale)
    : false;
  const providerDurationDetected = beforeCount > 0 && !hasAuthoritative;
  const conflictingDurationDetected = beforeCount > 1
    || (beforeCount >= 1 && phrase && !hasAuthoritative)
    || (beforeCount > 1 && hasAuthoritative);

  let working = summary || '';
  let duplicateDurationRemoved = false;
  let durationClaimsRemovedBeforeInsert = 0;

  const stripAll = (input: string): string => {
    const stripped = stripAllSummaryDurationExpressions(input, locale);
    return stripped;
  };

  if (!duration.hasValidDates) {
    if (requireClaim && beforeCount > 0) {
      working = stripAll(working);
      duplicateDurationRemoved = true;
      durationClaimsRemovedBeforeInsert = beforeCount;
    }
  } else if (requireClaim) {
    // Idempotent fast path: already exactly one authoritative, non-hybrid claim.
    const beforeRep = analyzeDurationRepresentations(summary, locale);
    if (beforeCount === 1 && hasAuthoritative && beforeRep.agreement && !beforeRep.hybridDetected) {
      durationClaimsRemovedBeforeInsert = 0;
      duplicateDurationRemoved = false;
      working = summary || '';
    } else {
      // Strip every detected claim, then insert exactly one authoritative phrase.
      const stripped = stripAll(working);
      durationClaimsRemovedBeforeInsert = beforeCount;
      duplicateDurationRemoved = beforeCount > 0 || beforeRep.hybridDetected;
      working = stripped;
      if (phrase) {
        if (options?.injectFn) {
          working = options.injectFn(working, duration, locale, options.context);
        } else {
          working = mergePhraseIntoFirstSentence(working, phrase, locale);
        }
      }
    }
  } else if (beforeCount > 1 || analyzeDurationRepresentations(summary, locale).hybridDetected) {
    const stripped = stripAll(working);
    duplicateDurationRemoved = true;
    durationClaimsRemovedBeforeInsert = beforeCount;
    working = phrase
      ? (options?.injectFn
        ? options.injectFn(stripped, duration, locale, options.context)
        : mergePhraseIntoFirstSentence(stripped, phrase, locale))
      : stripped;
  }

  working = working.replace(/\s+/g, ' ').trim();
  const afterInsertBreakdown = summarizeDurationClaimBreakdown(working, locale);
  let afterInsertCount = afterInsertBreakdown.total;

  // Repair loop if independent scan still sees ≠ 1 when required.
  if (requireClaim && duration.hasValidDates && phrase && afterInsertCount !== 1) {
    working = mergePhraseIntoFirstSentence(stripAll(working), phrase, locale)
      .replace(/\s+/g, ' ')
      .trim();
    duplicateDurationRemoved = true;
    afterInsertCount = summarizeDurationClaimBreakdown(working, locale).total;
  }

  // Independent final verification (separate call, not reusing mutator bookkeeping).
  const independent = verifyIndependentFinalDurationCount(working, locale, {
    requireExactlyOne: requireClaim && duration.hasValidDates,
  });
  const finalRep = independent.representation;
  const detectorAgreement = independent.count === afterInsertCount
    && finalRep.agreement
    && !finalRep.hybridDetected;
  const durationValidationPassed = Boolean(
    independent.ok
    && detectorAgreement
    && !finalRep.hybridDetected
    && (!requireClaim || !duration.hasValidDates || independent.count === 1),
  );

  // If hybrid survived, force one more strip+insert of the canonical phrase.
  if (requireClaim && duration.hasValidDates && phrase && finalRep.hybridDetected) {
    working = mergePhraseIntoFirstSentence(stripAll(working), phrase, locale)
      .replace(/\s+/g, ' ')
      .trim();
    if (options?.injectFn) {
      working = options.injectFn(stripAll(working), duration, locale, options.context);
    }
    const repaired = verifyIndependentFinalDurationCount(working, locale, {
      requireExactlyOne: true,
    });
    Object.assign(independent, repaired);
    afterInsertCount = repaired.count;
  }

  const finalRep2 = analyzeDurationRepresentations(working, locale);
  const independentFinal = verifyIndependentFinalDurationCount(working, locale, {
    requireExactlyOne: requireClaim && duration.hasValidDates,
  });

  const diagnostics: SummaryDurationOwnershipDiagnostics = {
    summaryDurationExpressionCount: beforeCount,
    authoritativeDurationMonths: duration.hasValidDates ? duration.totalMonths : null,
    authoritativeDurationBucket: duration.hasValidDates && duration.unit === 'years'
      ? duration.approxYears
      : duration.hasValidDates && duration.unit === 'months'
        ? duration.totalMonths
        : null,
    providerDurationDetected,
    conflictingDurationDetected: Boolean(conflictingDurationDetected),
    duplicateDurationRemoved,
    finalDurationExpressionCount: independentFinal.count,
    durationClaimCountBeforeStrip: beforeCount,
    numericDurationClaimCount: beforeBreakdown.numeric + beforeBreakdown.mixed,
    writtenDurationClaimCount: beforeBreakdown.written + beforeBreakdown.mixed,
    durationClaimsRemovedBeforeInsert,
    durationClaimCountAfterInsert: afterInsertCount,
    independentFinalDurationClaimCount: independentFinal.count,
    durationDetectorAgreement: independentFinal.count === afterInsertCount && finalRep2.agreement,
    durationValidationPassed: Boolean(
      independentFinal.ok
      && !finalRep2.hybridDetected
      && finalRep2.agreement
      && (!requireClaim || !duration.hasValidDates || independentFinal.count === 1),
    ),
    finalDurationRepresentationKind: finalRep2.representationKind,
    finalDurationRepresentationCount: finalRep2.representationCount,
    finalDurationHybridDetected: finalRep2.hybridDetected,
    durationSemanticValueMonths: duration.hasValidDates ? duration.totalMonths : null,
    durationRepresentationAgreement: finalRep2.agreement,
  };

  return {
    summary: working,
    diagnostics,
    changed: working !== (summary || '').replace(/\s+/g, ' ').trim(),
  };
}

/** True when Summary duration postcondition fails (multiple / conflicting expressions). */
export function summaryDurationPostconditionFailed(
  text: string,
  duration: ExperienceDuration,
  locale: Locale,
  options?: { requireDurationClaim?: boolean },
): boolean {
  const independent = verifyIndependentFinalDurationCount(text, locale, {
    requireExactlyOne: Boolean(options?.requireDurationClaim && duration.hasValidDates),
  });
  if (!independent.ok) return true;
  if (options?.requireDurationClaim && duration.hasValidDates && independent.count === 0) {
    return true;
  }
  if (
    independent.count === 1
    && duration.hasValidDates
    && !summaryIncludesDurationPhrase(text, duration, locale)
  ) {
    return true;
  }
  return false;
}
