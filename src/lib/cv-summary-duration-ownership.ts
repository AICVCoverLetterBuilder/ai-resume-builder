/**
 * Single ownership for Professional Summary duration phrases.
 *
 * Structured-date `ExperienceDuration` is the only authority. Provider freestyle
 * durations (e.g. "oko godinu dana") must be stripped before the canonical
 * `formatApproximateDurationPhrase` is inserted exactly once.
 *
 * Separate from Experience AI bullet perspective / tense pipelines.
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

export type SummaryDurationOwnershipDiagnostics = {
  summaryDurationExpressionCount: number;
  authoritativeDurationMonths: number | null;
  authoritativeDurationBucket: number | null;
  providerDurationDetected: boolean;
  conflictingDurationDetected: boolean;
  duplicateDurationRemoved: boolean;
  finalDurationExpressionCount: number;
};

/** Locale-agnostic duration expression spans for counting / stripping. */
const DURATION_EXPRESSION_RES: RegExp[] = [
  // English
  /\b(?:with\s+)?(?:around|about|approximately|over|nearly)\s+(?:\d+(?:\.\d+)?|one(?:\s+and\s+a\s+half)?|two(?:\s+and\s+a\s+half)?|three(?:\s+and\s+a\s+half)?|four(?:\s+and\s+a\s+half)?|five(?:\s+and\s+a\s+half)?|six|seven|eight|nine|ten)\s+years?(?:\s+of\s+experience)?\b/giu,
  /\b(?:around|about|approximately)\s+\d+\s+months?\b/giu,
  // Serbian / Croatian — including freestyle "godinu dana" / "jedne i po godine"
  /\b(?:sa\s+oko|s\s+oko|oko|približno)\s+(?:jedne?(?:\s+i\s+po)?|dvije?(?:\s+i\s+po)?|dve(?:\s+i\s+po)?|tri(?:\s+i\s+po)?|četiri(?:\s+i\s+po)?|cetiri(?:\s+i\s+po)?|pet(?:\s+i\s+po)?|šest|sest|sedam|osam|devet|deset|\d+(?:\.\d+)?(?:\s+i\s+po)?)\s+godin(?:a|e|u)(?:\s+iskustva)?\b/giu,
  /\b(?:sa\s+oko|s\s+oko|oko|približno)\s+godinu(?:\s+i\s+po)?(?:\s+dana)?(?:\s+iskustva)?\b/giu,
  /\b(?:sa\s+oko|s\s+oko|oko)\s+(?:jedne?\s+i\s+po|dve\s+i\s+po|dvije\s+i\s+po)\s+(?:godine|godina|godinu)(?:\s+iskustva)?\b/giu,
  /\bgodinu(?:\s+i\s+po)?\s+dana(?:\s+iskustva)?\b/giu,
  /\b(?:sa\s+)?oko\s+\d+\s+meseci(?:\s+iskustva)?\b/giu,
  // German
  /\b(?:mit\s+)?(?:etwa|rund|ca\.?|ungefähr)\s+(?:anderthalb|zweieinhalb|dreiereinhalb|[\wäöü]+|\d+(?:[.,]\d+)?)\s+Jahre?n?(?:\s+(?:Berufs)?[Ee]rfahrung)?\b/giu,
  // Spanish
  /\b(?:con\s+)?(?:alrededor\s+de|circa|unos?|unas?)\s+(?:un|una|uno|dos|tres|cuatro|cinco|seis|[\w]+|\d+(?:\.\d+)?)\s+años?(?:\s+de\s+experiencia)?\b/giu,
  // French
  /\b(?:avec\s+)?(?:environ|à\s+peu\s+près)\s+(?:un\s+an\s+et\s+demi|deux\s+ans\s+et\s+demi|[\w]+|\d+(?:\.\d+)?)\s*(?:ans?)?(?:\s+d['']expérience)?\b/giu,
  // Italian
  /\b(?:con\s+)?circa\s+(?:un\s+anno\s+e\s+mezzo|due\s+anni\s+e\s+mezzo|[\w]+|\d+(?:\.\d+)?)\s*(?:anni?)?(?:\s+di\s+esperienza)?\b/giu,
  // Portuguese
  /\b(?:com\s+)?(?:cerca\s+de|aproximadamente)\s+(?:um\s+e\s+meio|dois\s+e\s+meio|[\w]+|\d+(?:\.\d+)?)\s+anos?(?:\s+de\s+experiência)?\b/giu,
  // Hindi
  /(?:लगभग|करीब)?\s*(?:\d+(?:\.\d+)?|एक|दो|तीन|चार|पाँच|पांच|छह|ढाई|डेढ़|डेढ|साढ़े\s*\d+)\s*वर्षों?(?:\s*के\s*अनुभव(?:\s*के\s*साथ)?)?/gu,
  // Japanese
  /約\s*\d+(?:\.\d+)?\s*年の経験/gu,
  // Russian
  /\b(?:с\s+опытом\s+)?около\s+[\w]+\s+лет\b/giu,
  // Arabic (light)
  /مع\s+حوالي\s+.+\s+من\s+الخبرة/gu,
];

function cloneRes(): RegExp[] {
  return DURATION_EXPRESSION_RES.map((re) => new RegExp(re.source, re.flags));
}

/** Count distinct duration expressions in Summary text (non-overlapping greedy left-to-right). */
export function countSummaryDurationExpressions(text: string, _locale?: Locale): number {
  const raw = text || '';
  if (!raw.trim()) return 0;
  const hits: Array<{ start: number; end: number }> = [];
  for (const re of cloneRes()) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length });
      if (m[0].length === 0) re.lastIndex += 1;
    }
  }
  if (!hits.length) return 0;
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.start < last.end) {
      last.end = Math.max(last.end, h.end);
    } else {
      merged.push({ ...h });
    }
  }
  return merged.length;
}

/** Strip every recognized duration expression, cleaning leftover commas/spaces. */
export function stripAllSummaryDurationExpressions(text: string, _locale?: Locale): string {
  let out = text || '';
  for (const re of cloneRes()) {
    out = out.replace(re, ' ');
  }
  out = out
    .replace(/\s*,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*\./g, '.')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.!?।])/gu, '$1')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
  return out;
}

function mergePhraseIntoFirstSentence(text: string, phrase: string, locale: Locale): string {
  const trimmed = (text || '').trim();
  if (locale === 'hi') {
    // Caller should use Hindi-specific inject; keep a safe fallback.
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
 * Always strips provider / competing phrases first when dates are valid and a claim
 * is required.
 */
export function enforceAuthoritativeSummaryDuration(
  summary: string,
  duration: ExperienceDuration,
  locale: Locale,
  options?: {
    requireDurationClaim?: boolean;
    context?: SummaryDurationContext;
    /** Optional inject helper for Hindi opening-sentence placement. */
    injectFn?: (
      text: string,
      duration: ExperienceDuration,
      locale: Locale,
      context?: SummaryDurationContext,
    ) => string;
  },
): EnforceAuthoritativeDurationResult {
  const requireClaim = Boolean(options?.requireDurationClaim);
  const beforeCount = countSummaryDurationExpressions(summary, locale);
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

  if (!duration.hasValidDates) {
    // No structured dates — drop freestyle duration noise only when forcing AI claim policy.
    if (requireClaim && beforeCount > 0) {
      working = stripAllSummaryDurationExpressions(working, locale);
      duplicateDurationRemoved = true;
    }
  } else if (requireClaim) {
    // AI / generated Summary: structured dates own the single phrase.
    if (beforeCount !== 1 || conflictingDurationDetected || !hasAuthoritative) {
      const stripped = stripAllSummaryDurationExpressions(working, locale);
      duplicateDurationRemoved = beforeCount > 0;
      working = stripped;
      if (phrase) {
        if (options?.injectFn) {
          working = options.injectFn(working, duration, locale, options.context);
        } else {
          working = mergePhraseIntoFirstSentence(working, phrase, locale);
        }
      }
    }
  } else if (beforeCount > 1) {
    // User-authored: only collapse duplicate/competing duration expressions.
    const stripped = stripAllSummaryDurationExpressions(working, locale);
    duplicateDurationRemoved = true;
    working = phrase
      ? (options?.injectFn
        ? options.injectFn(stripped, duration, locale, options.context)
        : mergePhraseIntoFirstSentence(stripped, phrase, locale))
      : stripped;
  }

  // Final postcondition for required claims: never leave 2+ expressions.
  let finalCount = countSummaryDurationExpressions(working, locale);
  if (finalCount > 1 && phrase) {
    working = mergePhraseIntoFirstSentence(
      stripAllSummaryDurationExpressions(working, locale),
      phrase,
      locale,
    );
    duplicateDurationRemoved = true;
    finalCount = countSummaryDurationExpressions(working, locale);
  }

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
    finalDurationExpressionCount: finalCount,
  };

  return {
    summary: working.replace(/\s+/g, ' ').trim(),
    diagnostics,
    changed: working.replace(/\s+/g, ' ').trim() !== (summary || '').replace(/\s+/g, ' ').trim(),
  };
}

/** True when Summary duration postcondition fails (multiple / conflicting expressions). */
export function summaryDurationPostconditionFailed(
  text: string,
  duration: ExperienceDuration,
  locale: Locale,
  options?: { requireDurationClaim?: boolean },
): boolean {
  const count = countSummaryDurationExpressions(text, locale);
  if (count > 1) return true;
  if (options?.requireDurationClaim && duration.hasValidDates && count === 0) return true;
  if (count === 1 && duration.hasValidDates && !summaryIncludesDurationPhrase(text, duration, locale)) {
    return true;
  }
  return false;
}
