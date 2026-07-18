/**
 * Serbian Latin confusable-Cyrillic normalization for Summary (and similar prose).
 * Only rewrites mixed-script tokens when the requested output is Serbian Latin.
 * Pure Cyrillic Serbian is left untouched.
 */

/** Cyrillic lookalikes that commonly leak into Latin Serbian tokens. */
const CYR_TO_LATIN_CONFUSABLE: Record<string, string> = {
  '\u0430': 'a', // а
  '\u0410': 'A',
  '\u0435': 'e', // е
  '\u0415': 'E',
  '\u043E': 'o', // о
  '\u041E': 'O',
  '\u0440': 'p', // р
  '\u0420': 'P',
  '\u0441': 'c', // с
  '\u0421': 'C',
  '\u0445': 'x', // х
  '\u0425': 'X',
  '\u0458': 'j', // ј
  '\u0408': 'J',
  '\u0443': 'y', // у ( occasional; only inside mixed tokens )
  '\u0423': 'Y',
  '\u043A': 'k', // к
  '\u041A': 'K',
  '\u041C': 'M', // М
  '\u043C': 'm',
  '\u0422': 'T', // Т
  '\u0442': 't',
  '\u0412': 'B', // В
  '\u0432': 'b',
  '\u041D': 'H', // Н
  '\u043D': 'h',
};

const CYR_CONFUSABLE_RE = /[\u0430\u0410\u0435\u0415\u043E\u041E\u0440\u0420\u0441\u0421\u0445\u0425\u0458\u0408\u0443\u0423\u043A\u041A\u043C\u041C\u0442\u0422\u0432\u0412\u043D\u041D]/u;
const LATIN_LETTER_RE = /[A-Za-zÀ-ž]/u;
const CYRILLIC_LETTER_RE = /\p{Script=Cyrillic}/u;

function isMostlyLatinToken(token: string): boolean {
  let latin = 0;
  let cyr = 0;
  for (const ch of token) {
    if (LATIN_LETTER_RE.test(ch)) latin += 1;
    else if (CYRILLIC_LETTER_RE.test(ch)) cyr += 1;
  }
  if (latin + cyr === 0) return false;
  // Mixed or Latin-dominant with confusable Cyrillic letters.
  return latin > 0 && latin >= cyr;
}

function isPureCyrillicToken(token: string): boolean {
  let letters = 0;
  let cyr = 0;
  for (const ch of token) {
    if (/\p{L}/u.test(ch)) {
      letters += 1;
      if (CYRILLIC_LETTER_RE.test(ch)) cyr += 1;
    }
  }
  return letters > 0 && cyr === letters;
}

/**
 * Within otherwise Latin Serbian words, replace confusable Cyrillic code points
 * with Latin equivalents (e.g. pregledа → pregleda).
 */
export function normalizeSerbianLatinConfusables(text: string): string {
  if (!text || !CYR_CONFUSABLE_RE.test(text)) return text;
  return text.replace(/\p{L}+/gu, (token) => {
    if (!CYR_CONFUSABLE_RE.test(token)) return token;
    if (isPureCyrillicToken(token)) return token;
    if (!isMostlyLatinToken(token)) return token;
    let out = '';
    for (const ch of token) {
      out += CYR_TO_LATIN_CONFUSABLE[ch] ?? ch;
    }
    return out;
  });
}

/** True when a Latin-dominant token still contains Cyrillic confusables. */
export function hasSerbianLatinMixedScriptToken(text: string): boolean {
  if (!text) return false;
  const tokens = text.match(/\p{L}+/gu) || [];
  for (const token of tokens) {
    if (isPureCyrillicToken(token)) continue;
    if (isMostlyLatinToken(token) && CYR_CONFUSABLE_RE.test(token)) return true;
    // Mixed Latin+Cyrillic in one token
    if (LATIN_LETTER_RE.test(token) && CYRILLIC_LETTER_RE.test(token)) return true;
  }
  return false;
}

/**
 * Restore singular/plural noun forms from Experience source facts when Summary
 * paraphrases only the grammatical number (e.g. statusom → statusima).
 * Conservative: only known instrumental singular↔plural pairs present in source.
 */
const SR_INSTRUMENTAL_PAIRS: Array<[RegExp, string]> = [
  [/\bnajnovijim\s+statusima\b/giu, 'najnovijim statusom'],
  [/\bsa\s+najnovijim\s+statusima\b/giu, 'sa najnovijim statusom'],
];

export function preserveSerbianSummaryFactForms(
  summary: string,
  sourceDuties: string,
): string {
  let out = summary || '';
  const src = sourceDuties || '';
  // Only restore singular when the source itself used singular instrumental.
  if (/\bnajnovijim\s+statusom\b/iu.test(src) && /\bnajnovijim\s+statusima\b/iu.test(out)) {
    for (const [re, repl] of SR_INSTRUMENTAL_PAIRS) {
      out = out.replace(re, repl);
    }
  }
  return out;
}

const SR_MONTH_GENITIVE: Record<string, string> = {
  '01': 'januara',
  '02': 'februara',
  '03': 'marta',
  '04': 'aprila',
  '05': 'maja',
  '06': 'juna',
  '07': 'jula',
  '08': 'avgusta',
  '09': 'septembra',
  '10': 'oktobra',
  '11': 'novembra',
  '12': 'decembra',
};

/**
 * Insert missing company / start-date grounding after the occupational title
 * when provider Summary omitted them (e.g. "… u kompaniji Atlas od marta 2025.").
 */
export function enrichSerbianSummaryEmploymentGrounding(
  summary: string,
  options: { role?: string; company?: string; startDate?: string },
): string {
  const out = (summary || '').trim();
  if (!out) return out;
  const company = (options.company || '').trim();
  const role = (options.role || '').trim();
  const ym = /^(\d{4})-(\d{2})/.exec((options.startDate || '').trim());
  const month = ym ? SR_MONTH_GENITIVE[ym[2]] : '';
  const year = ym?.[1] || '';

  const hasCompany = company
    ? new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(out)
    : true;
  const hasStart = month && year
    ? new RegExp(`${month}\\s+${year}`, 'iu').test(out)
    : true;

  if (hasCompany && hasStart) return out;

  const parts: string[] = [];
  if (company && !hasCompany) parts.push(`u kompaniji ${company}`);
  if (month && year && !hasStart) parts.push(`od ${month} ${year}. godine`);
  if (!parts.length) return out;

  const clause = parts.join(' ');
  if (role && out.toLowerCase().startsWith(role.toLowerCase())) {
    const rest = out.slice(role.length).replace(/^[\s,]+/, '');
    return `${role} ${clause}${rest ? (rest.match(/^(koji|koja|sa\b|,)/i) ? `, ${rest}` : ` ${rest}`) : ''}`.replace(/\s+/g, ' ').trim();
  }
  // Fallback: insert after first comma or before first duration phrase.
  if (/,/.test(out)) {
    return out.replace(/,/, `, ${clause},`).replace(/\s+/g, ' ').trim();
  }
  return `${out.replace(/\.?\s*$/, '')} ${clause}.`.replace(/\s+/g, ' ').trim();
}
