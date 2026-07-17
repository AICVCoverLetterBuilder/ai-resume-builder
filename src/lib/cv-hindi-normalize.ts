/**
 * Hindi (Devanagari) whitespace / token-merge normalization for AI-generated CV text.
 * Prefer phrase-aware postposition and Latin-boundary fixes over broad character surgery.
 */
import type { Locale } from './i18n/translations';

/** Auxiliary / conjunction merges confirmed in package-1 exports. */
const AUX_CONJUNCTION_FIXES: Array<[RegExp, string]> = [
  [/हूँऔर/gu, 'हूँ और'],
  [/हूंऔर/gu, 'हूं और'],
  [/हैऔर/gu, 'है और'],
  [/हैंऔर/gu, 'हैं और'],
  [/हूँतथा/gu, 'हूँ तथा'],
  [/रहीहूँ/gu, 'रही हूँ'],
  [/रहाहूँ/gu, 'रहा हूँ'],
  [/करतीहूँ/gu, 'करती हूँ'],
  [/करताहूँ/gu, 'करता हूँ'],
  [/कररही/gu, 'कर रही'],
  [/कररहा/gu, 'कर रहा'],
  [/तैयारकरती/gu, 'तैयार करती'],
  [/तैयारकरता/gu, 'तैयार करता'],
  [/रिपोर्टतैयार/gu, 'रिपोर्ट तैयार'],
  [/अनुभववाला/gu, 'अनुभव वाला'],
  [/अनुभववाली/gu, 'अनुभव वाली'],
  // Prefer natural "में" over "पर" for project-execution collaboration.
  [/परियोजना\s+क्रियान्वयन\s+पर/gu, 'परियोजना क्रियान्वयन में'],
];

/**
 * Confirmed glued postposition+token pairs. Prefer exact phrase repairs over
 * character-level splits so legitimate words (कार्यों, परिवहन) stay intact.
 */
const GLUED_POSTPOSITION_FIXES: Array<[RegExp, string]> = [
  [/केअनुभव/gu, 'के अनुभव'],
  [/केअंतर्गत/gu, 'के अंतर्गत'],
  [/केविकास/gu, 'के विकास'],
  [/केसाथ/gu, 'के साथ'],
  [/केलिए/gu, 'के लिए'],
  [/कीअनुभव/gu, 'की अनुभव'],
  [/मेंकाम/gu, 'में काम'],
  [/मेंकार्यरत/gu, 'में कार्यरत'],
  [/मेंसहयोग/gu, 'में सहयोग'],
  [/परकाम/gu, 'पर काम'],
  [/सेकाम/gu, 'से काम'],
  [/कापरिवहन/gu, 'का परिवहन'],
  [/साथकाम/gu, 'साथ काम'],
];

function isDevanagari(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0900 && code <= 0x097F;
}

function isLatinLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

/**
 * Insert missing spaces between Devanagari and Latin proper nouns / reverse.
 * Does not touch matras, nukta, or conjunct sequences (those stay within Devanagari range).
 */
function separateScriptBoundaries(text: string): string {
  let out = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const prev = out.length ? out[out.length - 1] : '';
    if (prev && isDevanagari(prev) && isLatinLetter(ch)) {
      out += ' ';
    } else if (prev && isLatinLetter(prev) && isDevanagari(ch)) {
      out += ' ';
    } else if (prev && /\d/.test(prev) && isDevanagari(ch)) {
      out += ' ';
    } else if (prev && isDevanagari(prev) && /\d/.test(ch)) {
      out += ' ';
    }
    out += ch;
  }
  return out;
}

/**
 * Normalize freshly generated Hindi Summary / bullets.
 * Safe on empty / non-Hindi text (returns input with light trim only when locale !== hi).
 *
 * Uses exact glued-phrase repairs + Devanagari↔Latin boundaries only. Broad
 * "postposition + next letter" splits are unsafe (they break कार्यों, परिवहन,
 * ऑपरेटर, कार्यरत).
 */
export function normalizeHindiGeneratedWhitespace(
  text: string,
  locale?: Locale | string,
): string {
  if (!text) return text;
  if (locale && locale !== 'hi') return text;
  let out = text.normalize('NFKC');
  for (const [re, repl] of AUX_CONJUNCTION_FIXES) {
    out = out.replace(re, repl);
  }
  for (const [re, repl] of GLUED_POSTPOSITION_FIXES) {
    out = out.replace(re, repl);
  }
  out = separateScriptBoundaries(out);
  // Collapse accidental multi-spaces introduced by normalization; keep newlines.
  out = out.replace(/[^\S\n]{2,}/g, ' ');
  out = out.replace(/ +\n/g, '\n').replace(/\n +/g, '\n');
  return out.trim();
}

/** Suspicious merged-token patterns that should fail Hindi quality validation. */
const MERGED_TOKEN_QUALITY: RegExp[] = [
  /केअनुभव/u,
  /हूँऔर/u,
  /हूंऔर/u,
  /से[A-Za-z]/u,
  /केअंतर्गत/u,
  /केविकास/u,
  /मेंकाम/u,
  /केसाथ/u,
  /केलिए/u,
  /रिपोर्टतैयार/u,
  /[\u0900-\u097F]{18,}/u, // excessively long glued Devanagari token
];

export function hasSuspiciousHindiMergedTokens(text: string): boolean {
  if (!text || !/[\u0900-\u097F]/.test(text)) return false;
  return MERGED_TOKEN_QUALITY.some((re) => re.test(text));
}

/**
 * Normalize then report whether residual merges remain (for fidelity guards).
 */
export function normalizeAndAssessHindiText(
  text: string,
  locale?: Locale | string,
): { text: string; stillSuspicious: boolean } {
  const normalized = normalizeHindiGeneratedWhitespace(text, locale);
  return {
    text: normalized,
    stillSuspicious: locale === 'hi' && hasSuspiciousHindiMergedTokens(normalized),
  };
}
