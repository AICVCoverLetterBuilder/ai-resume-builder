/**
 * Shared header stripping for cover-letter preview/PDF/DOCX.
 * Removes API-baked name, contact lines, and leading date so exporters
 * can render exactly one localized date.
 */

const YEAR_RE = /(?:\b\d{4}\b|[٠-٩]{4}|[०-९]{4}|\d{4}\s*年)/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+\-().]{7,}$/;
const URL_RE = /^(https?:\/\/|www\.)/i;

export function isLikelyCoverLetterDateLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (!YEAR_RE.test(trimmed)) return false;
  // Reject lines that look like full sentences with a year mention.
  if (/[.!?।؟。]/.test(trimmed) && trimmed.split(/\s+/).length > 8) return false;
  return true;
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
 * Strip leading contact lines and a single leading date line from API header.
 * Does not remove dates that appear later in body paragraphs.
 */
export function stripLeadingCoverLetterDateAndContacts(text: string): string {
  const lines = text.split('\n');
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  // Contact / empty lines that sit above the baked-in API date.
  while (lines.length > 0) {
    const trimmed = lines[0].trim();
    if (!trimmed) {
      lines.shift();
      continue;
    }
    if (isLikelyCoverLetterContactLine(trimmed)) {
      lines.shift();
      continue;
    }
    break;
  }

  if (lines.length > 0 && isLikelyCoverLetterDateLine(lines[0])) {
    lines.shift();
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
  }

  return lines.join('\n');
}

/** Full export header cleanup: name → contacts/date. */
export function stripCoverLetterExportHeader(content: string, candidateName: string): string {
  const afterName = stripLeadingCoverLetterName(content, candidateName);
  return stripLeadingCoverLetterDateAndContacts(afterName);
}

/** Count how many leading date lines would still be visible after stripping (0 expected). */
export function countLeadingDateLinesAfterStrip(content: string, candidateName: string): number {
  const cleaned = stripCoverLetterExportHeader(content, candidateName);
  const first = cleaned.split('\n').find((l) => l.trim().length > 0) ?? '';
  return isLikelyCoverLetterDateLine(first) ? 1 : 0;
}
