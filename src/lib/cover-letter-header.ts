/**
 * Shared cover-letter header normalization for preview / PDF / DOCX / copy.
 * Removes generated leading metadata so renderers own the single visible date.
 */

const YEAR_RE = /(?:\b\d{4}\b|[٠-٩]{4}|[०-९]{4})/u;
const JP_DATE_RE = /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+\-().]{7,}$/;
const URL_RE = /^(https?:\/\/|www\.)/i;

/** Month / date-token markers across the 12 supported locales. */
const DATE_TOKEN_RE = new RegExp(
  [
    // English
    'january|february|march|april|may|june|july|august|september|october|november|december',
    'jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec',
    // German
    'januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember',
    // Spanish / Portuguese
    'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre',
    'janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro',
    // French
    'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre',
    // Italian
    'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre',
    // Arabic (Western + common MSA month names)
    'يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر',
    // Serbian (Latin) / Croatian
    'januar|februar|mart|april|maj|jun|jun[ia]|jul|avgust|septembar|oktobar|novembar|decembar',
    'siječnja|veljače|ožujka|travnja|svibnja|lipnja|srpnja|kolovoza|rujna|listopada|studenoga|prosinca',
    'sijecnja|veljace|ozujka|srpnja',
    // Russian
    'января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря',
    'г\\.',
    // Hindi
    'जनवरी|फ़रवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|सितम्बर|अक्टूबर|नवंबर|नवम्बर|दिसंबर|दिसम्बर',
  ].join('|'),
  'iu',
);

const LOCALE_DATE_TAGS: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  it: 'it-IT',
  ar: 'ar-EG',
  sr: 'sr-Latn-RS',
  hr: 'hr-HR',
  ru: 'ru-RU',
  'pt-BR': 'pt-BR',
  hi: 'hi-IN',
  ja: 'ja-JP',
};

export function formatCoverLetterDocumentDate(locale: string, date: Date = new Date()): string {
  const tag = LOCALE_DATE_TAGS[locale] ?? 'en-US';
  try {
    return new Intl.DateTimeFormat(tag, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }
}

export function isLikelyCoverLetterDateLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) return false;
  if (JP_DATE_RE.test(trimmed)) return true;
  if (!YEAR_RE.test(trimmed) && !/[٠-٩]{4}/.test(trimmed) && !/[०-९]{4}/.test(trimmed)) {
    return false;
  }
  // Prefer lines that look like calendar dates (month token, dotted day, ISO, or short).
  if (DATE_TOKEN_RE.test(trimmed)) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(trimmed)) return true;
  if (/^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(trimmed)) return true;
  if (/^\d{1,2}\.\s*\S+\s+\d{4}\.?$/.test(trimmed)) return true; // 14. Juli 2026.
  if (/^[٠-٩0-9]{1,2}\s+\S+\s+[٠-٩0-9]{4}$/u.test(trimmed)) return true;
  if (/^[०-९0-9]{1,2}\s+\S+\s+[०-९0-9]{4}$/u.test(trimmed)) return true;
  // Reject long sentences that merely mention a year (body employment/interview dates).
  if (/[.!?।؟。]/.test(trimmed) && trimmed.split(/\s+/).length > 8) return false;
  // Bare year-only or year with few tokens (e.g. "2026", "July 2026") as header dates.
  const tokenCount = trimmed.split(/\s+/).length;
  return tokenCount <= 6 && YEAR_RE.test(trimmed);
}

export function isLikelyCoverLetterContactLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (EMAIL_RE.test(trimmed)) return true;
  if (URL_RE.test(trimmed)) return true;
  if (PHONE_RE.test(trimmed.replace(/\s/g, ' '))) return true;
  return false;
}

export function stripLeadingCoverLetterName(raw: string, candidateName: string): string {
  if (!candidateName.trim()) return raw;
  const nameLower = candidateName.trim().toLowerCase();
  const lines = raw.split('\n');
  while (lines.length > 0 && lines[0].trim().toLowerCase() === nameLower) {
    lines.shift();
  }
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  return lines.join('\n');
}

/**
 * Strip leading contact lines and leading date lines from an API header region.
 * Prefer stripCoverLetterExportHeader for full cleanup.
 */
export function stripLeadingCoverLetterDateAndContacts(text: string): string {
  return stripCoverLetterExportHeader(text, '');
}

/**
 * Remove generated leading metadata (name / email / phone / date lines / blanks)
 * until the greeting or first body paragraph begins.
 * Does not remove dates inside body paragraphs or the final signoff name.
 */
export function stripCoverLetterExportHeader(content: string, candidateName: string): string {
  const lines = content.split('\n');
  const nameLower = candidateName.trim().toLowerCase();
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    const isName = Boolean(nameLower) && trimmed.toLowerCase() === nameLower;
    if (isName || isLikelyCoverLetterContactLine(trimmed) || isLikelyCoverLetterDateLine(trimmed)) {
      i += 1;
      continue;
    }
    break;
  }

  while (i < lines.length && lines[i].trim() === '') {
    i += 1;
  }

  return lines.slice(i).join('\n');
}

/** Body only — no renderer date. */
export function normalizeCoverLetterBody(content: string, candidateName: string): string {
  return stripCoverLetterExportHeader(content, candidateName).replace(/^\n+/, '').replace(/\n+$/, '');
}

/**
 * Preview/copy presentation: exactly one localized document date + normalized body.
 */
export function prepareCoverLetterForDisplay(
  content: string,
  candidateName: string,
  locale: string,
): string {
  const body = normalizeCoverLetterBody(content, candidateName);
  if (!body.trim()) return '';
  const date = formatCoverLetterDocumentDate(locale);
  return `${date}\n\n${body}`;
}

/** Count leading date lines still present after strip (0 expected). */
export function countLeadingDateLinesAfterStrip(content: string, candidateName: string): number {
  const cleaned = stripCoverLetterExportHeader(content, candidateName);
  const first = cleaned.split('\n').find((l) => l.trim().length > 0) ?? '';
  return isLikelyCoverLetterDateLine(first) ? 1 : 0;
}
