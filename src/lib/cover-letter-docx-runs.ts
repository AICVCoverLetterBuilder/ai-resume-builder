/**
 * Mixed Arabic/Latin DOCX text runs for cover-letter export.
 * Latin names, C++, Java, emails, and similar tokens stay LTR inside RTL paragraphs.
 */
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;
const LATIN_TECH_CHAR_RE = /[A-Za-z0-9@.+#_\-]/;

export type CoverLetterDocxTextRunSpec = {
  text: string;
  rightToLeft: boolean;
};

export function splitMixedArabicDocxRuns(line: string): CoverLetterDocxTextRunSpec[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const runs: CoverLetterDocxTextRunSpec[] = [];
  let buffer = '';
  let currentRtl: boolean | null = null;

  const flush = () => {
    if (!buffer) return;
    runs.push({ text: buffer, rightToLeft: currentRtl ?? false });
    buffer = '';
    currentRtl = null;
  };

  for (const char of trimmed) {
    const isArabic = ARABIC_SCRIPT_RE.test(char);
    const isLatinTech = LATIN_TECH_CHAR_RE.test(char);

    if (isArabic) {
      if (currentRtl === false) flush();
      currentRtl = true;
      buffer += char;
      continue;
    }

    if (isLatinTech) {
      if (currentRtl === true) flush();
      currentRtl = false;
      buffer += char;
      continue;
    }

    // Spaces and punctuation attach to the active script run.
    if (currentRtl === null) {
      currentRtl = false;
    }
    buffer += char;
  }

  flush();
  return runs.length ? runs : [{ text: trimmed, rightToLeft: ARABIC_SCRIPT_RE.test(trimmed) }];
}

export function lineLooksLatinDominant(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const arabicCount = (trimmed.match(new RegExp(ARABIC_SCRIPT_RE.source, 'gu')) ?? []).length;
  const latinLetters = (trimmed.match(/[A-Za-z]/g) ?? []).length;
  return latinLetters >= 2 && latinLetters > arabicCount;
}

/** RTL paragraph anchor for a Latin-only closing/name line in Arabic DOCX. */
export function formatArabicDocxLineForRtlParagraph(line: string): CoverLetterDocxTextRunSpec[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  if (lineLooksLatinDominant(trimmed)) {
    return [{ text: `\u200F${trimmed}`, rightToLeft: false }];
  }
  return splitMixedArabicDocxRuns(trimmed);
}
