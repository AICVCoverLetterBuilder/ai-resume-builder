import { describe, expect, test } from 'vitest';
import React from 'react';
import path from 'path';
import { Font, pdf } from '@react-pdf/renderer';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  CoverLetterPDFDocument,
  computeLatinCoverLetterPdfLines,
} from '../cover-letter-pdf';
import {
  findLatinLetterSplitViolations,
  wrapLatinPdfParagraphLines,
} from '../cover-letter-latin-pdf-wrap';

function registerLatinPdfFontsForTests(): void {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'NotoSans-Regular.ttf');
  Font.register({
    family: 'NotoSans',
    fonts: [{ src: fontPath, fontWeight: 400 }],
  });
  Font.registerHyphenationCallback((word) => [word]);
}

async function renderCoverLetterPdfText(content: string, candidateName: string): Promise<string> {
  registerLatinPdfFontsForTests();
  const doc = React.createElement(CoverLetterPDFDocument, {
    candidateName,
    content,
    locale: 'es',
  });
  const blob = await pdf(doc).toBlob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const pdfDoc = await pdfjs.getDocument({ data: buf }).promise;
  let text = '';
  for (let i = 1; i <= pdfDoc.numPages; i += 1) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: { str?: string }) => it.str ?? '').join(' ') + '\n';
  }
  return text;
}

describe('Latin Cover Letter PDF word wrapping', () => {
  test('ordinary Spanish words are not letter-split across prepared lines', () => {
    const paragraph =
      'Le escribo para expresar mi interés en el puesto de Saradnik za podršku klijentima logistike en Unoklo. '
      + 'Estoy interesado en asumir las responsabilidades del puesto, conocer sus procesos y contribuir de manera responsable a los objetivos del equipo. '
      + 'Deseo conocer con mayor detalle las expectativas del rol y aportar de forma constante. '
      + 'Quedo a su disposición para una entrevista. Gracias por su consideración.';
    const lines = wrapLatinPdfParagraphLines(paragraph.repeat(2), { maxWidth: 120 });
    expect(lines.length).toBeGreaterThan(4);
    expect(findLatinLetterSplitViolations(lines)).toEqual([]);
    const joined = lines.join(' ');
    for (const word of ['en', 'el', 'expectativas', 'expresar', 'consideración', 'Unoklo']) {
      expect(joined).toContain(word);
    }
    // No single-character fragment lines for common Spanish particles
    for (const line of lines) {
      expect(line.trim()).not.toMatch(/^[en]$/i);
    }
  });

  test('PDF render preserves ordinary Spanish words without mid-word letter fragments', async () => {
    const body =
      'Estimado equipo de selección de Unoklo:\n\n'
      + 'Le escribo para expresar mi interés en el puesto. Estoy interesado en conocer sus expectativas y contribuir de manera responsable al trabajo del equipo.\n\n'
      + 'Quedo a disposición para una entrevista.\n\n'
      + 'Gracias por su consideración.\n\n'
      + 'Atentamente,\n\nAlex Carter';
    const lineGroups = computeLatinCoverLetterPdfLines(body, 'Alex Carter', 'es');
    const flat = lineGroups.flat();
    expect(flat.length).toBeGreaterThan(3);
    expect(findLatinLetterSplitViolations(flat)).toEqual([]);

    const extracted = await renderCoverLetterPdfText(body, 'Alex Carter');
    expect(extracted).toContain('expresar');
    expect(extracted).toContain('expectativas');
    expect(extracted).toContain('consideración');
    expect(extracted).toContain('Unoklo');
    expect(extracted).not.toMatch(/\be\s+n\s+Unoklo\b/i);
    expect(extracted).not.toMatch(/\be\s+l\s+equipo\b/i);
  }, 30000);
});
