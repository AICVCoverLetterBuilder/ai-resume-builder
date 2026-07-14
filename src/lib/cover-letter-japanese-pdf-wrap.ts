/**
 * Explicit Japanese Cover Letter PDF line wrapping.
 *
 * Root cause of visible ASCII hyphens: @react-pdf/textkit's script itemizer
 * splits kanji/kana into separate syllables; when Knuth–Plass breaks at a
 * penalty between those syllables, breakLines always inserts U+002D
 * HYPHEN-MINUS. Soft hyphens / ZWSP opportunities do not stop that insertion
 * and can truncate or still show `-` on Android.
 *
 * Strategy: sanitize wrap markers, segment graphemes (keeping Latin tokens),
 * measure with NotoSansJP-calibrated advances, wrap with basic kinsoku, then
 * render each line with wrap disabled so textkit never invents a hyphen.
 */

export const COVER_LETTER_JA_PDF_FONT_SIZE = 11;
/**
 * A4 content width is 595.28 − 120 padding ≈ 475.28pt. Use a safety margin so
 * NotoSansJP real advances never exceed the Yoga/textkit frame (underestimated
 * Latin / punctuation would otherwise still trigger U+002D insertion).
 */
export const COVER_LETTER_JA_PDF_MAX_LINE_WIDTH = (595.28 - 120) * 0.88;

const NO_START =
  '、。，．）］｝〉》」』】！？ー･・,.!?:;%）］｝';
const NO_END = '（［｛〈《「『【〔［｛（';

const CJK_RE =
  /[\u3040-\u30FF\u3400-\u9FFF々〆ヵヶ｡-ﾟ]/u;

/** Markers that only exist for wrapping / soft hyphenation — never keep in PDF text. */
export function sanitizeJapanesePdfWrapMarkers(text: string): string {
  return text
    .replace(/\u00AD/g, '') // soft hyphen
    .replace(/\u200B/g, '') // ZWSP (failed prior strategy)
    .replace(/\u2060/g, '') // word joiner
    .replace(/\uFEFF/g, '') // ZWNBSP / BOM
    .replace(/\uFFFE|\uFFFF/g, '')
    .replace(/\u000B/g, ''); // vertical tab
}

function graphemeClusters(text: string): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text), (s) => s.segment);
    }
  } catch {
    // fall through
  }
  return Array.from(text);
}

/**
 * Keep Latin / numeric / email / hyphenated terms together; otherwise grapheme units.
 */
export function segmentJapanesePdfUnits(text: string): string[] {
  const cleaned = sanitizeJapanesePdfWrapMarkers(text);
  const units: string[] = [];
  // Emails, hyphenated Latin compounds (Dio-Dala, AI-Lawyer), alphanumerics.
  const latinChunk =
    /[A-Za-z0-9][A-Za-z0-9._%+\-]*@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}|[A-Za-z0-9]+(?:[.\-][A-Za-z0-9]+)+|[A-Za-z0-9]+/yu;

  let i = 0;
  const chars = graphemeClusters(cleaned);
  while (i < chars.length) {
    const from = chars.slice(i).join('');
    latinChunk.lastIndex = 0;
    const m = latinChunk.exec(from);
    if (m && m.index === 0) {
      units.push(m[0]);
      i += graphemeClusters(m[0]).length;
      continue;
    }
    units.push(chars[i]);
    i += 1;
  }
  return units;
}

/**
 * Advance width calibrated against public/fonts/NotoSansJP-Regular.ttf at the
 * cover-letter PDF size (CJK / fullwidth ≈ fontSize; Latin averaged from glyph metrics).
 */
export function measureJapanesePdfText(
  text: string,
  fontSize: number = COVER_LETTER_JA_PDF_FONT_SIZE,
): number {
  if (!text) return 0;
  let width = 0;
  for (const ch of graphemeClusters(text)) {
    if (!ch) continue;
    const cp = ch.codePointAt(0) ?? 0;
    if (CJK_RE.test(ch) || (cp >= 0xff01 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6)) {
      width += fontSize;
    } else if (ch === ' ' || ch === '\t') {
      width += fontSize * 0.224;
    } else if (ch === '-') {
      width += fontSize * 0.347;
    } else if (ch === 'i' || ch === 'l' || ch === 'I' || ch === 'j' || ch === 'f' || ch === 't') {
      width += fontSize * 0.28;
    } else if (ch >= 'A' && ch <= 'Z') {
      width += fontSize * 0.62;
    } else if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      width += fontSize * 0.52;
    } else {
      width += fontSize * 0.55;
    }
  }
  return width;
}

function cannotStart(ch: string | undefined): boolean {
  return Boolean(ch && [...NO_START].includes(ch));
}

function cannotEnd(ch: string | undefined): boolean {
  return Boolean(ch && [...NO_END].includes(ch));
}

function applyKinsoku(
  lineUnits: string[],
  nextUnits: string[],
  maxWidth: number,
  fontSize: number,
): { line: string[]; next: string[] } {
  const line = [...lineUnits];
  const next = [...nextUnits];

  while (line.length > 1 && cannotEnd(line[line.length - 1])) {
    next.unshift(line.pop()!);
  }
  while (next.length > 0 && line.length > 0 && cannotStart(next[0])) {
    const pulled = next.shift()!;
    const trial = [...line, pulled];
    if (measureJapanesePdfText(trial.join(''), fontSize) <= maxWidth + 0.01) {
      line.push(pulled);
    } else {
      next.unshift(pulled);
      break;
    }
  }
  return { line, next };
}

/**
 * Build explicit PDF lines for one Japanese paragraph. Does not mutate stored
 * cover-letter content — PDF layout only.
 */
export function wrapJapanesePdfParagraphLines(
  paragraph: string,
  options?: {
    maxWidth?: number;
    fontSize?: number;
  },
): string[] {
  const maxWidth = options?.maxWidth ?? COVER_LETTER_JA_PDF_MAX_LINE_WIDTH;
  const fontSize = options?.fontSize ?? COVER_LETTER_JA_PDF_FONT_SIZE;
  const cleaned = sanitizeJapanesePdfWrapMarkers(paragraph).replace(/\s+$/u, '');
  if (!cleaned.trim()) return [];

  const physical = cleaned.split('\n');
  const out: string[] = [];

  for (const block of physical) {
    if (!block) continue;
    const units = segmentJapanesePdfUnits(block);
    let lineUnits: string[] = [];

    const flush = (unitsToFlush: string[]) => {
      const text = unitsToFlush.join('');
      if (text.length > 0) out.push(text);
    };

    for (const unit of units) {
      const candidate = [...lineUnits, unit];
      const width = measureJapanesePdfText(candidate.join(''), fontSize);
      if (lineUnits.length === 0 || width <= maxWidth) {
        lineUnits = candidate;
        continue;
      }

      if (measureJapanesePdfText(unit, fontSize) > maxWidth) {
        if (lineUnits.length) {
          flush(lineUnits);
          lineUnits = [];
        }
        const parts = graphemeClusters(unit);
        let chunk: string[] = [];
        for (const g of parts) {
          const trial = [...chunk, g];
          if (chunk.length && measureJapanesePdfText(trial.join(''), fontSize) > maxWidth) {
            flush(chunk);
            chunk = [g];
          } else {
            chunk = trial;
          }
        }
        lineUnits = chunk;
        continue;
      }

      const adjusted = applyKinsoku(lineUnits, [unit], maxWidth, fontSize);
      flush(adjusted.line);
      lineUnits = adjusted.next;
      if (
        lineUnits.length &&
        measureJapanesePdfText(lineUnits.join(''), fontSize) > maxWidth
      ) {
        flush(lineUnits);
        lineUnits = [];
      }
    }

    if (lineUnits.length) flush(lineUnits);
  }

  return out.map((l) => sanitizeJapanesePdfWrapMarkers(l));
}

/** Assert prepared Japanese PDF lines are free of wrap artifacts (tests/diagnostics). */
export function assertJapanesePdfLinesClean(lines: string[]): string[] {
  const violations: string[] = [];
  for (const line of lines) {
    for (const ch of line) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0x00ad) violations.push('U+00AD');
      if (cp === 0x000b) violations.push('U+000B');
      if (cp === 0xfffe || cp === 0xffff) violations.push(`U+${cp.toString(16).toUpperCase()}`);
      if (cp === 0x200b) violations.push('U+200B');
    }
  }
  return [...new Set(violations)];
}
