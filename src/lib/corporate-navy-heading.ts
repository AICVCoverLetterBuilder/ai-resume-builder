/**
 * Script-aware Corporate Navy section heading formatter.
 * Latin/Cyrillic may keep letter-spaced uppercase (DOCX).
 * Devanagari/Arabic/CJK always render as one shaped Unicode unit.
 */

const DEVANAGARI = /[\u0900-\u097F]/u;
const ARABIC = /[\u0600-\u06FF]/u;
const CJK = /[\u3040-\u30ff\u3400-\u9fff]/u;
const CYRILLIC = /[\u0400-\u04FF]/u;

export function corporateNavyHeadingNeedsTightShaping(text: string): boolean {
  return DEVANAGARI.test(text) || ARABIC.test(text) || CJK.test(text);
}

/**
 * Format a Corporate Navy section heading for PDF/DOCX.
 * Never splits Devanagari grapheme clusters or inserts per-code-point spaces.
 *
 * @param letterSpaced Latin/Cyrillic letter-spacing (DOCX yes, PDF no — preserves each surface's look).
 */
export function formatCorporateNavySectionHeading(
  label: string,
  options?: { letterSpaced?: boolean },
): string {
  const text = (label || '').trim();
  if (!text) return '';
  if (corporateNavyHeadingNeedsTightShaping(text)) {
    // Complete Unicode string as one shaped unit — no split(''), no spaces, no uppercasing.
    return text;
  }
  const letterSpaced = options?.letterSpaced !== false;
  if (CYRILLIC.test(text)) {
    const upper = text.toLocaleUpperCase('ru-RU');
    return letterSpaced ? upper.split('').join(' ') : upper;
  }
  const upper = text.toUpperCase();
  return letterSpaced ? upper.split('').join(' ') : upper;
}

/** True when a heading string has inserted letter-spacing between Devanagari code points. */
export function hasBrokenDevanagariLetterSpacing(heading: string): boolean {
  if (!DEVANAGARI.test(heading)) return false;
  // Matra split from base letter: "प े" / "स ा"
  if (/[\u0900-\u097F]\s+[\u093A-\u094D\u0901-\u0903]/u.test(heading)) return true;
  // Dense letter-spacing: many 1–2 code-point tokens (not normal word spaces).
  const parts = heading.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return false;
  const short = parts.filter((p) => p.length <= 2 && DEVANAGARI.test(p)).length;
  return short >= 3 && short / parts.length >= 0.5;
}
