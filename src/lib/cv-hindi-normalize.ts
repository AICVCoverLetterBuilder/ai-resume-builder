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
  [/मेंमैं/gu, 'में मैं'],
  [/परियोजना\s+क्रियान्वयन\s+पर/gu, 'परियोजना क्रियान्वयन में'],
];

const GLUED_POSTPOSITION_FIXES: Array<[RegExp, string]> = [
  [/केअनुभव/gu, 'के अनुभव'],
  [/केव्यावसायिक/gu, 'के व्यावसायिक'],
  [/केअंतर्गत/gu, 'के अंतर्गत'],
  [/केविकास/gu, 'के विकास'],
  [/केसाथ/gu, 'के साथ'],
  [/केलिए/gu, 'के लिए'],
  [/केरूप/gu, 'के रूप'],
  [/कीअनुभव/gu, 'की अनुभव'],
  [/मेंकाम/gu, 'में काम'],
  [/मेंकार्यरत/gu, 'में कार्यरत'],
  [/मेंसहयोग/gu, 'में सहयोग'],
  [/मेंक्रॉस/gu, 'में क्रॉस'],
  [/परकाम/gu, 'पर काम'],
  [/सेकाम/gu, 'से काम'],
  [/कापरिवहन/gu, 'का परिवहन'],
  [/साथकाम/gu, 'साथ काम'],
  [/प्रबंधन\s*केलिए/gu, 'प्रबंधन के लिए'],
];

const BROKEN_SYLLABLE_FIXES: Array<[RegExp, string]> = [
  [/व\s+र्षों/gu, 'वर्षों'],
  [/व\s+र्ष/gu, 'वर्ष'],
  [/अ\s+नुभव/gu, 'अनुभव'],
  [/प\s+र\s+िवहन/gu, 'परिवहन'],
  [/प\s+रिवहन/gu, 'परिवहन'],
];

function isDevanagari(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0900 && code <= 0x097F;
}

function isLatinLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

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

export function normalizeHindiGeneratedWhitespace(
  text: string,
  locale?: Locale | string,
): string {
  if (!text) return text;
  if (locale && locale !== 'hi') return text;
  let out = text.normalize('NFKC');
  for (const [re, repl] of BROKEN_SYLLABLE_FIXES) {
    out = out.replace(re, repl);
  }
  for (const [re, repl] of AUX_CONJUNCTION_FIXES) {
    out = out.replace(re, repl);
  }
  for (const [re, repl] of GLUED_POSTPOSITION_FIXES) {
    out = out.replace(re, repl);
  }
  out = separateScriptBoundaries(out);
  out = out.replace(/[^\S\n]{2,}/g, ' ');
  out = out.replace(/ +\n/g, '\n').replace(/\n +/g, '\n');
  return out.trim();
}

const MERGED_TOKEN_QUALITY: RegExp[] = [
  /केअनुभव/u,
  /केव्यावसायिक/u,
  /केरूप/u,
  /हूँऔर/u,
  /हूंऔर/u,
  /मेंमैं/u,
  /से[A-Za-z]/u,
  /केअंतर्गत/u,
  /केविकास/u,
  /मेंकाम/u,
  /मेंक्रॉस/u,
  /केसाथ/u,
  /केलिए/u,
  /रिपोर्टतैयार/u,
  /व\s+र्षों/u,
  /[\u0900-\u097F]{18,}/u,
];

export function hasSuspiciousHindiMergedTokens(text: string): boolean {
  if (!text || !/[\u0900-\u097F]/.test(text)) return false;
  return MERGED_TOKEN_QUALITY.some((re) => re.test(text));
}

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
