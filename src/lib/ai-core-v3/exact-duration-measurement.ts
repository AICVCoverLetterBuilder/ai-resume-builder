import { normalizeSummaryV3StyleNumericSurface } from './summary-style-m5';

export interface ExactDurationMeasurement {
  /** UTF-16 indices into the original, unmodified input. End is exclusive. */
  readonly start: number;
  readonly end: number;
  readonly totalMonths: number;
}

/**
 * One finite measurement lexicon, not translations or employment semantics.
 * Sources: existing cv-experience-duration/cv-summary-duration-ownership unit
 * copy and M5's supported unit surfaces, plus Task081's native month matrix.
 * Singular/paucal/plural/oblique variants are explicit, never stem matches.
 * sr mesec and hr mjesec remain distinct spellings. Japanese bare 月 is not
 * included: a calendar month number must not acquire a duration unit here.
 */
const MONTH_UNITS = [
  'month', 'months',
  'monat', 'monate', 'monaten', 'monats',
  'mesec', 'meseca', 'meseci', 'mesecu', 'mesecima',
  'месец', 'месеца', 'месеци',
  'mjesec', 'mjeseca', 'mjeseci', 'mjesecu', 'mjesecima',
  'mois',
  'mes', 'meses', 'mês',
  'mese', 'mesi',
  'месяц', 'месяца', 'месяцев',
  'महीना', 'महीने', 'महीनों',
  'شهر', 'أشهر', 'شهرين',
  'か月', 'ヶ月', 'カ月', '箇月',
] as const;

const YEAR_UNITS = [
  'year', 'years',
  'jahr', 'jahre', 'jahren', 'jahres',
  'godina', 'godine', 'godinu', 'година', 'године', 'годину',
  'an', 'ans', 'année', 'années',
  'año', 'años', 'anno', 'anni', 'ano', 'anos',
  'год', 'года', 'лет',
  'वर्ष', 'वर्षों',
  'سنة', 'سنوات', 'سنتين',
  '年',
] as const;

const UNIT_MONTH_MULTIPLIERS: ReadonlyMap<string, number> = new Map([
  ...MONTH_UNITS.map((unit) => [unit, 1] as const),
  ...YEAR_UNITS.map((unit) => [unit, 12] as const),
]);
// These exact Arabic noun forms encode dual quantity, not an arbitrary plural.
const DUAL_QUANTITY_UNITS = new Set(['شهرين', 'سنتين']);

// Consume complete numeric and unit tokens before interpretation. This also
// consumes unsupported decimal/grouping/version-like numbers without letting
// their final digit tail become a second, supposedly clean measurement.
const MEASUREMENT_TOKENS = /([\p{N}]+(?:[.,٫٬][\p{N}]+)*)[\p{Zs}\t]*([\p{L}\p{M}]+)/gu;
const WORD_TOKEN = /[\p{L}\p{M}\p{N}\p{Cf}_]/u;
const SIGN_RANGE_OR_IDENTIFIER = /[\p{Sc}\p{Pd}−±+/@#\\%٪％]/u;

function contaminatedBoundary(input: string, start: number, end: number): boolean {
  const prefix = input.slice(0, start);
  const suffix = input.slice(end);
  const before = Array.from(prefix).at(-1) || '';
  const after = Array.from(suffix)[0] || '';
  if (WORD_TOKEN.test(before) || WORD_TOKEN.test(after)) return true;
  // Do not accept the tail of a decimal, domain, percentage, range, signed
  // value or identifier. Whitespace does not rescue a nearby sign/currency.
  if (/[.,٫٬%٪]/u.test(before) || /[%٪]/u.test(after)) return true;
  const previousNonspace = Array.from(prefix.trimEnd()).at(-1) || '';
  const nextNonspace = Array.from(suffix.trimStart())[0] || '';
  if (/\p{N}/u.test(previousNonspace)) return true;
  if (SIGN_RANGE_OR_IDENTIFIER.test(previousNonspace) || SIGN_RANGE_OR_IDENTIFIER.test(nextNonspace)) return true;
  return /^[.,][\p{L}\p{M}\p{N}_]/u.test(suffix);
}

/**
 * Measurement only. It grants no fact, source-refresh or semantic ownership.
 * Integers only: decimal months/years, grouping, signs and ranges fail closed.
 * Compound prose may yield separate measurements, never a combined duration.
 * Unknown words/scripts are unavailable, not fuzzily guessed or rounded.
 */
export function findExactDurationMeasurements(input: string): readonly ExactDurationMeasurement[] {
  const found: ExactDurationMeasurement[] = [];
  // A fresh iterator has independent state for every call; no global cursor.
  for (const match of input.matchAll(MEASUREMENT_TOKENS)) {
    const start = match.index!;
    const end = start + match[0].length;
    if (contaminatedBoundary(input, start, end)) continue;
    const number = normalizeSummaryV3StyleNumericSurface(match[1]!);
    if (!/^[0-9]+$/u.test(number)) continue;
    const unit = match[2]!.normalize('NFC').toLowerCase();
    const multiplier = UNIT_MONTH_MULTIPLIERS.get(unit);
    if (multiplier === undefined) continue;
    const amount = Number(number);
    if (DUAL_QUANTITY_UNITS.has(unit) && amount !== 2) continue;
    const totalMonths = amount * multiplier;
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(totalMonths)) continue;
    found.push({ start, end, totalMonths });
  }
  return found;
}

/** Accept only an entire measurement, optionally surrounded by whitespace. */
export function parseExactDurationMeasurement(input: string): number | null {
  const matches = findExactDurationMeasurements(input);
  if (matches.length !== 1) return null;
  const measurement = matches[0]!;
  return input.slice(0, measurement.start).trim() === '' && input.slice(measurement.end).trim() === ''
    ? measurement.totalMonths : null;
}
