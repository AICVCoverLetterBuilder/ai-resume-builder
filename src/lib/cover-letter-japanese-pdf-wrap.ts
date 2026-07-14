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
 * measure with NotoSansJP-calibrated advances, wrap with kinsoku (never start a
 * line with 、。 etc.), then render each line with wrap disabled so textkit
 * never invents a hyphen.
 */

export const COVER_LETTER_JA_PDF_FONT_SIZE = 11;
/**
 * A4 content width is 595.28 − 120 padding ≈ 475.28pt. Use a safety margin so
 * NotoSansJP real advances never exceed the Yoga/textkit frame (underestimated
 * Latin / punctuation would otherwise still trigger U+002D insertion).
 */
export const COVER_LETTER_JA_PDF_MAX_LINE_WIDTH = (595.28 - 120) * 0.88;

/** Tiny overflow allowed when attaching a closing mark to the previous line. */
const KINSOKU_ATTACH_TOLERANCE = COVER_LETTER_JA_PDF_FONT_SIZE * 0.35;

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

function isPunctuationOnlyLine(units: string[]): boolean {
  if (units.length === 0) return true;
  const joined = units.join('');
  return [...joined].every((ch) => cannotStart(ch) || cannotEnd(ch) || /[\s]/.test(ch));
}

/**
 * Resolve a break so the sealed line never ends with opening punctuation and the
 * carry never begins with closing punctuation (and is never punctuation-only).
 *
 * Previous bug: when 、/。 did not fit on the previous line, applyKinsoku stopped
 * and left those marks as the start of the next line.
 */
export function applyJapaneseKinsokuBreak(
  lineUnits: string[],
  overflowUnits: string[],
  maxWidth: number,
  fontSize: number,
): { sealed: string[]; carry: string[] } {
  const sealed = [...lineUnits];
  const carry = [...overflowUnits];

  // Opening marks must not end a line.
  while (sealed.length > 1 && cannotEnd(sealed[sealed.length - 1])) {
    carry.unshift(sealed.pop()!);
  }

  // Closing / non-starter marks must not begin the next line.
  while (carry.length > 0 && cannotStart(carry[0])) {
    const mark = carry[0];
    const attachTrial = [...sealed, mark];
    const attachWidth = measureJapanesePdfText(attachTrial.join(''), fontSize);
    if (sealed.length > 0 && attachWidth <= maxWidth + KINSOKU_ATTACH_TOLERANCE) {
      sealed.push(carry.shift()!);
      continue;
    }
    // Backtrack at least one preceding grapheme with the punctuation.
    if (sealed.length === 0) {
      // Nothing to steal — keep mark with following content (caller ensures more units).
      break;
    }
    carry.unshift(sealed.pop()!);
    // After stealing a normal grapheme, carry[0] can start a line; loop re-checks.
  }

  // Never seal a punctuation-only line.
  while (sealed.length > 0 && isPunctuationOnlyLine(sealed)) {
    carry.unshift(sealed.pop()!);
  }

  // If carry is still only punctuation, steal one more grapheme from sealed when possible.
  while (
    carry.length > 0 &&
    isPunctuationOnlyLine(carry) &&
    sealed.length > 0
  ) {
    carry.unshift(sealed.pop()!);
  }

  return { sealed, carry };
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
      if (text.length > 0 && !isPunctuationOnlyLine(unitsToFlush)) {
        out.push(text);
      } else if (text.length > 0 && out.length > 0) {
        // Attach orphan punctuation to the previous emitted line (never drop it).
        out[out.length - 1] = `${out[out.length - 1]}${text}`;
      } else if (text.length > 0) {
        out.push(text);
      }
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
          const { sealed, carry } = applyJapaneseKinsokuBreak(lineUnits, [], maxWidth, fontSize);
          if (sealed.length) flush(sealed);
          lineUnits = carry;
        }
        const parts = graphemeClusters(unit);
        let chunk: string[] = [];
        for (const g of parts) {
          const trial = [...chunk, g];
          if (chunk.length && measureJapanesePdfText(trial.join(''), fontSize) > maxWidth) {
            const { sealed, carry } = applyJapaneseKinsokuBreak(chunk, [g], maxWidth, fontSize);
            if (sealed.length) flush(sealed);
            chunk = carry;
          } else {
            chunk = trial;
          }
        }
        lineUnits = chunk.length ? [...lineUnits, ...chunk] : lineUnits;
        continue;
      }

      const { sealed, carry } = applyJapaneseKinsokuBreak(lineUnits, [unit], maxWidth, fontSize);
      if (sealed.length) flush(sealed);
      lineUnits = carry;

      // If carry alone still exceeds max width (rare), keep progressing one unit at a time.
      if (
        lineUnits.length > 1 &&
        measureJapanesePdfText(lineUnits.join(''), fontSize) > maxWidth &&
        !cannotStart(lineUnits[0])
      ) {
        const head = lineUnits.slice(0, -1);
        const tail = lineUnits.slice(-1);
        const again = applyJapaneseKinsokuBreak(head, tail, maxWidth, fontSize);
        if (again.sealed.length) flush(again.sealed);
        lineUnits = again.carry;
      }
    }

    if (lineUnits.length) {
      // Final line: pull trailing non-starters onto previous emitted line if this
      // would otherwise be punctuation-only.
      if (isPunctuationOnlyLine(lineUnits) && out.length > 0) {
        out[out.length - 1] = `${out[out.length - 1]}${lineUnits.join('')}`;
      } else {
        flush(lineUnits);
      }
    }
  }

  // Post-pass: no line may start with prohibited punctuation or be punctuation-only.
  const repaired: string[] = [];
  for (const line of out.map((l) => sanitizeJapanesePdfWrapMarkers(l))) {
    if (!line) continue;
    const first = graphemeClusters(line)[0];
    if (repaired.length > 0 && (cannotStart(first) || isPunctuationOnlyLine(segmentJapanesePdfUnits(line)))) {
      repaired[repaired.length - 1] = `${repaired[repaired.length - 1]}${line}`;
    } else {
      repaired.push(line);
    }
  }

  return repaired;
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
    const first = graphemeClusters(line)[0];
    if (cannotStart(first)) violations.push(`line_starts_with_${first}`);
    if (isPunctuationOnlyLine(segmentJapanesePdfUnits(line))) violations.push('punctuation_only_line');
  }
  return [...new Set(violations)];
}
