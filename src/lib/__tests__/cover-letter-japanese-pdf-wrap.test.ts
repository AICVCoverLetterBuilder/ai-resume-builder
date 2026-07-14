import { describe, expect, test } from 'vitest';
import React from 'react';
import path from 'path';
import { Font, pdf } from '@react-pdf/renderer';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { assembleCoverLetterContent } from '../cover-letter-generation';
import { buildDeterministicSparseCoverLetter } from '../cover-letter-grounding';
import { buildCoverLetterFactSet } from '../cover-letter-facts';
import {
  CoverLetterPDFDocument,
  computeCoverLetterPdfParagraphs,
  computeJapaneseCoverLetterPdfLines,
} from '../cover-letter-pdf';
import {
  assertJapanesePdfLinesClean,
  COVER_LETTER_JA_PDF_MAX_LINE_WIDTH,
  sanitizeJapanesePdfWrapMarkers,
  segmentJapanesePdfUnits,
  wrapJapanesePdfParagraphLines,
} from '../cover-letter-japanese-pdf-wrap';

const SPARSE = buildCoverLetterFactSet({
  personalName: 'Dio-Dala',
  jobTitle: 'AI-Lawyer',
  companyName: 'Tuxi-Tech',
});

function registerJapanesePdfFontsForTests(): void {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.ttf');
  Font.register({
    family: 'NotoSansJP',
    fonts: [{ src: fontPath, fontWeight: 400 }],
  });
  Font.registerHyphenationCallback((word) => [word]);
}

async function renderCoverLetterPdfText(content: string, candidateName: string): Promise<string> {
  registerJapanesePdfFontsForTests();
  const doc = React.createElement(CoverLetterPDFDocument, {
    candidateName,
    content,
    locale: 'ja',
  });
  const stream = await pdf(doc).toBuffer();
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const buf = Buffer.concat(chunks);
  const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;
  let text = '';
  for (let i = 1; i <= pdfDoc.numPages; i += 1) {
    const page = await pdfDoc.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it) => ('str' in it ? String(it.str) : '')).join('');
  }
  return text;
}

function findCjkInsertedHyphens(text: string): string[] {
  return [...text.matchAll(/([\u3040-\u30FF\u3400-\u9FFF])-([\u3040-\u30FF\u3400-\u9FFF])/gu)].map(
    (m) => m[0],
  );
}

/** Log code points around each Japanese|ASCII-hyphen|Japanese match for diagnostics. */
function hyphenBreakDiagnostics(text: string): Array<{ ctx: string; cps: string }> {
  const out: Array<{ ctx: string; cps: string }> = [];
  for (const m of text.matchAll(/([\u3040-\u30FF\u3400-\u9FFF])-([\u3040-\u30FF\u3400-\u9FFF])/gu)) {
    const i = m.index ?? 0;
    const ctx = text.slice(Math.max(0, i - 4), i + 6);
    out.push({
      ctx,
      cps: [...ctx].map((c) => `U+${(c.codePointAt(0) ?? 0).toString(16).toUpperCase()}`).join(' '),
    });
  }
  return out;
}

describe('Japanese Cover Letter PDF wrapping', () => {
  test('sanitize removes wrap markers but keeps legitimate ASCII hyphens', () => {
    const raw = `応募\u00ADさせて\u200Bいただきたく\u000B。Dio-Dala@Tuxi-Tech.ai`;
    const cleaned = sanitizeJapanesePdfWrapMarkers(raw);
    expect(cleaned).toBe('応募させていただきたく。Dio-Dala@Tuxi-Tech.ai');
    expect(cleaned).toContain('Dio-Dala');
    expect(cleaned).not.toMatch(/[\u00AD\u200B\u000B\uFFFE\uFFFF]/);
  });

  test('latin hyphenated tokens stay as single units', () => {
    const units = segmentJapanesePdfUnits(
      '候補者 Dio-Dala は Tuxi-Tech の AI-Lawyer 職に応募します。contact@tuxi-tech.example',
    );
    expect(units).toContain('Dio-Dala');
    expect(units).toContain('Tuxi-Tech');
    expect(units).toContain('AI-Lawyer');
    expect(units).toContain('contact@tuxi-tech.example');
  });

  test('long Japanese paragraph wraps to multiple clean lines', () => {
    const paragraph =
      '当社のAI-Lawyer職に応募させていただきたく存じます。真摯に取り組み、望ましい成果を出すよう考え、ご検討のほどよろしくお願いいたします。'.repeat(
        3,
      );
    const lines = wrapJapanesePdfParagraphLines(paragraph);
    expect(lines.length).toBeGreaterThan(3);
    expect(assertJapanesePdfLinesClean(lines)).toEqual([]);
    const joined = lines.join('');
    expect(joined.replace(/\s/g, '')).toBe(sanitizeJapanesePdfWrapMarkers(paragraph).replace(/\s/g, ''));
    expect(joined).toContain('AI-Lawyer');
    // No artificial hyphen between CJK chars in prepared lines
    expect(findCjkInsertedHyphens(joined)).toEqual([]);
    // Line starts should not be stranded closers where kinsoku applies
    for (const line of lines) {
      expect(line).not.toMatch(/^[、。！？）」』]/u);
    }
  });

  test('kinsoku never starts a line with 、 or 。 and never invents CJK hyphens', () => {
    const samples = [
      '業務に真摯に取り組みながら、着実に貢献してまいります。',
      '貴社の取り組みとともに歩んでいきたいと考えております。',
    ];
    // Force many narrow widths so punctuation hits the break boundary often.
    const widths = [40, 55, 70, 90, 110, 130, COVER_LETTER_JA_PDF_MAX_LINE_WIDTH];
    for (const sample of samples) {
      for (const maxWidth of widths) {
        const lines = wrapJapanesePdfParagraphLines(sample, { maxWidth });
        expect(lines.length).toBeGreaterThan(0);
        expect(assertJapanesePdfLinesClean(lines)).toEqual([]);
        for (const line of lines) {
          expect(line).not.toMatch(/^[、。]/u);
          expect(line.trim()).not.toMatch(/^[、。，．）］｝〉》」』】！？ー]+$/u);
        }
        const joined = lines.join('');
        expect(joined).toBe(sample);
        // Each punctuation mark appears exactly once
        expect([...joined].filter((c) => c === '、').length).toBe(
          [...sample].filter((c) => c === '、').length,
        );
        expect([...joined].filter((c) => c === '。').length).toBe(
          [...sample].filter((c) => c === '。').length,
        );
        expect(findCjkInsertedHyphens(joined)).toEqual([]);
      }
    }
  });

  test('rendered Japanese PDF has no CJK-boundary hyphens; keeps Latin hyphens and 敬具', async () => {
    const letter = buildDeterministicSparseCoverLetter('ja', {
      candidateName: 'Dio-Dala',
      jobTitle: 'AI-Lawyer',
      companyName: 'Tuxi-Tech',
      factSet: SPARSE,
      dateLine: '2026年7月14日',
      gender: 'unspecified',
    });
    const body = assembleCoverLetterContent(letter, 'ja');
    expect(body).toContain('敬具');
    expect(body).not.toContain('敬具,');

    // Preview/DOCX path: paragraphs must not embed ZWSP wrap markers
    const paragraphs = computeCoverLetterPdfParagraphs(body, 'Dio-Dala', 'ja');
    expect(paragraphs.join('\n')).not.toContain('\u200B');
    expect(paragraphs.join('\n')).not.toContain('\u00AD');

    const lineGroups = computeJapaneseCoverLetterPdfLines(body, 'Dio-Dala');
    expect(lineGroups.some((g) => g.length > 1)).toBe(true);
    expect(assertJapanesePdfLinesClean(lineGroups.flat())).toEqual([]);

    const extracted = await renderCoverLetterPdfText(body, 'Dio-Dala');
    const inserted = findCjkInsertedHyphens(extracted);
    if (inserted.length) {
      // Diagnostics without dumping full personal letter body
      console.error('[ja-pdf] inserted hyphen breaks', hyphenBreakDiagnostics(extracted));
    }
    expect(inserted).toEqual([]);
    expect(extracted).toContain('敬具');
    expect(extracted).not.toContain('敬具,');
    expect(extracted).toContain('Dio-Dala');
    expect(extracted).toContain('Tuxi-Tech');
    expect(extracted).toContain('AI-Lawyer');
    expect(extracted).toContain('応募');
    expect(extracted).not.toMatch(/[\u00AD\u200B\u000B\uFFFE\uFFFF]/);
  }, 30000);

  test('stored preview content is unchanged by Japanese PDF line layout', () => {
    const source =
      'Dio-Dala\n\nTuxi-Tech採用ご担当者様\n\nAI-Lawyer職に応募いたします。\n\n敬具\nDio-Dala';
    const paragraphs = computeCoverLetterPdfParagraphs(source, 'Dio-Dala', 'ja');
    expect(paragraphs.join('\n\n')).toContain('AI-Lawyer職に応募いたします。');
    expect(paragraphs.join('\n\n')).toContain('敬具');
    expect(paragraphs.join('\n\n')).not.toContain('\u200B');
    // Explicit lines exist only in the PDF line builder
    const lines = wrapJapanesePdfParagraphLines(paragraphs[0] ?? '');
    expect(lines.join('')).toBe(paragraphs[0]);
  });
});
