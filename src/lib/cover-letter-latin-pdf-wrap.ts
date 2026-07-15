/**
 * Explicit Latin Cover Letter PDF word wrapping.
 *
 * @react-pdf/textkit can still force-break Latin runs into single-character
 * fragments on some Android builds even when hyphenation returns [word].
 * Strategy: pre-wrap on space boundaries (keeping hyphenated tokens), then
 * render each line with wrap={false}. Japanese wrapping stays separate.
 */

export const COVER_LETTER_LATIN_PDF_FONT_SIZE = 11;
export const COVER_LETTER_LATIN_PDF_MAX_LINE_WIDTH = (595.28 - 120) * 0.92;

/** Approx advance for NotoSans at cover-letter size (Latin / Cyrillic). */
export function measureLatinPdfText(
  text: string,
  fontSize: number = COVER_LETTER_LATIN_PDF_FONT_SIZE,
): number {
  if (!text) return 0;
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === ' ' || ch === '\t') width += fontSize * 0.28;
    else if (ch === '-' || ch === '–' || ch === '—' || ch === '.') width += fontSize * 0.32;
    else if (cp >= 0x0400 && cp <= 0x04ff) width += fontSize * 0.55; // Cyrillic
    else if ((ch >= 'A' && ch <= 'Z') || (ch >= 'À' && ch <= 'Ý')) width += fontSize * 0.62;
    else if (ch === 'i' || ch === 'l' || ch === 'I' || ch === 'j' || ch === 'f' || ch === 't') {
      width += fontSize * 0.3;
    } else width += fontSize * 0.52;
  }
  return width;
}

/**
 * Tokenize for wrapping: keep hyphenated compounds and email/URL chunks intact.
 * Ordinary spaces are the only soft wrap opportunities.
 */
export function segmentLatinPdfUnits(text: string): string[] {
  const cleaned = text.replace(/\u00AD/g, '').replace(/\u200B/g, '');
  const units: string[] = [];
  const re =
    /[A-Za-zÀ-ÿĀ-žЂ-џЁёА-я0-9][A-Za-zÀ-ÿĀ-žЂ-џЁёА-я0-9._%+\-]*@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}|https?:\/\/\S+|[A-Za-zÀ-ÿĀ-žЂ-џЁёА-я0-9]+(?:[.\-][A-Za-zÀ-ÿĀ-žЂ-џЁёА-я0-9]+)+|[A-Za-zÀ-ÿĀ-žЂ-џЁёА-я0-9]+|[^\sA-Za-zÀ-ÿĀ-žЂ-џЁёА-я0-9]+|\s+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    units.push(m[0]);
  }
  return units.length ? units : [cleaned];
}

function isWhitespaceUnit(unit: string): boolean {
  return /^\s+$/u.test(unit);
}

function isLongOverflowToken(unit: string, maxWidth: number, fontSize: number): boolean {
  return !isWhitespaceUnit(unit) && measureLatinPdfText(unit, fontSize) > maxWidth;
}

/** Soft-break only very long URLs/emails by grapheme clusters (never ordinary words). */
function breakLongToken(unit: string, maxWidth: number, fontSize: number): string[] {
  const chars = Array.from(unit);
  const lines: string[] = [];
  let chunk = '';
  for (const ch of chars) {
    const trial = chunk + ch;
    if (chunk && measureLatinPdfText(trial, fontSize) > maxWidth) {
      lines.push(chunk);
      chunk = ch;
    } else {
      chunk = trial;
    }
  }
  if (chunk) lines.push(chunk);
  return lines;
}

export function wrapLatinPdfParagraphLines(
  paragraph: string,
  options?: { maxWidth?: number; fontSize?: number },
): string[] {
  const maxWidth = options?.maxWidth ?? COVER_LETTER_LATIN_PDF_MAX_LINE_WIDTH;
  const fontSize = options?.fontSize ?? COVER_LETTER_LATIN_PDF_FONT_SIZE;
  const cleaned = paragraph.replace(/\s+$/u, '');
  if (!cleaned.trim()) return [];

  const out: string[] = [];
  for (const block of cleaned.split('\n')) {
    if (!block.trim()) continue;
    const units = segmentLatinPdfUnits(block);
    let line = '';

    const flush = () => {
      const t = line.replace(/\s+$/u, '');
      if (t) out.push(t);
      line = '';
    };

    for (const unit of units) {
      if (isLongOverflowToken(unit, maxWidth, fontSize)) {
        if (line.trim()) flush();
        const parts = breakLongToken(unit, maxWidth, fontSize);
        for (let i = 0; i < parts.length; i += 1) {
          if (i < parts.length - 1) out.push(parts[i]);
          else line = parts[i];
        }
        continue;
      }

      const trial = line + unit;
      if (line && measureLatinPdfText(trial, fontSize) > maxWidth && !isWhitespaceUnit(unit)) {
        flush();
        line = isWhitespaceUnit(unit) ? '' : unit;
      } else {
        line = trial;
      }
    }
    if (line.trim()) flush();
  }

  return out;
}

/** True when a Latin locale should use explicit word wrapping in Cover Letter PDF. */
export function usesLatinCoverLetterPdfWordWrap(locale: string): boolean {
  return ['en', 'de', 'es', 'fr', 'it', 'sr', 'hr', 'ru', 'pt-BR'].includes(locale);
}

/**
 * Assert prepared Latin PDF lines do not splice ordinary words into
 * single-letter fragments (en→e/n, el→e/l). Word-boundary wraps are fine.
 */
export function findLatinLetterSplitViolations(lines: string[]): string[] {
  const violations: string[] = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    const a = (lines[i] ?? '').trimEnd();
    const b = (lines[i + 1] ?? '').trimStart();
    const lastWord = a.split(/\s+/).pop() ?? '';
    const firstWord = b.split(/\s+/).shift() ?? '';
    // Flag only when both sides are single-letter fragments (e + n, e + l),
    // not when a legitimate one-letter Spanish word (y, a, o) ends a line.
    if (
      lastWord.length === 1
      && firstWord.length === 1
      && /^[A-Za-zÀ-ÿ]$/u.test(lastWord)
      && /^[A-Za-zÀ-ÿ]$/u.test(firstWord)
    ) {
      violations.push(`${lastWord}${firstWord}@${i}`);
    }
  }
  for (const line of lines) {
    if (/^[A-Za-zÀ-ÿ]$/u.test(line.trim())) {
      violations.push(`lone_letter:${line}`);
    }
  }
  return violations;
}
