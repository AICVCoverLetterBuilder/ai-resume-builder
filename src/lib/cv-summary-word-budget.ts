import type { Locale } from './i18n/translations';
import { countSummaryWords } from './cv-summary-grounding';

export const SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION =
  'summary-export-word-budget-compaction-403-v1' as const;

export type SummaryWordBudgetCompactionResult = {
  text: string;
  wordCountBefore: number;
  wordCountAfter: number;
  maxWords: number;
  revision: typeof SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION;
};

const TRAILING_CONNECTOR_WORDS = new Set([
  // English
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with',
  // Spanish / Portuguese / Italian / French
  'a', 'al', 'con', 'da', 'de', 'del', 'di', 'du', 'e', 'el', 'en', 'et', 'la', 'las', 'le', 'les',
  'los', 'o', 'para', 'par', 'per', 'por', 'que', 'un', 'una', 'une', 'y',
  // German / South Slavic
  'als', 'bei', 'der', 'die', 'das', 'ein', 'eine', 'für', 'i', 'im', 'in', 'mit', 'na', 'od', 'sa',
  'sowie', 'und', 'u', 'za',
  // Other common conjunctions / particles
  'и', 'с', 'в', 'на', 'для', 'तथा', 'और', 'و',
]);

function maxSummaryWords(locale: Locale): number {
  return locale === 'hi' || locale === 'sr' ? 110 : 90;
}

function terminalPunctuation(locale: Locale): string {
  if (locale === 'hi') return '।';
  if (locale === 'ja') return '。';
  if (locale === 'ar') return '۔';
  return '.';
}

function normalizedContains(haystack: string, needle: string): boolean {
  const h = haystack.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  const n = needle.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
  return Boolean(n) && h.includes(n);
}

function lastLexicalToken(text: string): string {
  const token = text.trim().split(/\s+/u).at(-1) || '';
  return token
    .normalize('NFKC')
    .replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, '')
    .toLowerCase();
}

/**
 * Minimally compact a near-budget saved Summary without rebuilding it from a
 * generic occupation shell. The caller-provided validator remains authoritative:
 * no candidate is accepted unless the normal export contract accepts it.
 */
export function compactSavedSummaryNearWordBudget(options: {
  summary: string;
  locale: Locale;
  protectedPhrases?: string[];
  validate: (candidate: string) => boolean;
}): SummaryWordBudgetCompactionResult | null {
  const normalized = String(options.summary || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const maxWords = maxSummaryWords(options.locale);
  const wordCountBefore = countSummaryWords(normalized, options.locale);
  if (wordCountBefore <= maxWords || wordCountBefore > maxWords + 20) return null;

  const tokens = normalized.split(/\s+/u).filter(Boolean);
  if (tokens.length <= 1) return null;

  const protectedPhrases = (options.protectedPhrases || [])
    .map((value) => String(value || '').trim())
    .filter((value) => value && normalizedContains(normalized, value));

  const minWords = Math.max(
    1,
    maxWords - 20,
    Math.floor(wordCountBefore * 0.7),
  );
  const terminal = terminalPunctuation(options.locale);

  for (let tokenCount = Math.min(tokens.length, maxWords); tokenCount >= minWords; tokenCount -= 1) {
    let candidate = tokens.slice(0, tokenCount).join(' ').trim();
    candidate = candidate
      .replace(/[,;:،؛\-–—]+$/u, '')
      .replace(/[.!?…।。！？؟۔]+$/u, '')
      .trim();
    if (!candidate) continue;

    const lastToken = lastLexicalToken(candidate);
    if (!lastToken || TRAILING_CONNECTOR_WORDS.has(lastToken)) continue;

    candidate = `${candidate}${terminal}`;
    const wordCountAfter = countSummaryWords(candidate, options.locale);
    if (wordCountAfter > maxWords || wordCountAfter >= wordCountBefore) continue;
    if (protectedPhrases.some((phrase) => !normalizedContains(candidate, phrase))) continue;
    if (!options.validate(candidate)) continue;

    return {
      text: candidate,
      wordCountBefore,
      wordCountAfter,
      maxWords,
      revision: SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION,
    };
  }

  return null;
}