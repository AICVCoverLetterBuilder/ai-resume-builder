/**
 * @vitest-environment jsdom
 *
 * AAB494 device regression: Rirekisho uses Japanese date semantics while
 * Serbian work-history text must retain its original Unicode glyphs in the
 * actual direct-PDF output.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { render } from '@testing-library/react';
import { RirekishoTemplate } from '@/components/cv-templates';
import { buildRirekishoPdfBlob } from '@/lib/export';
import { clearPdfI18nFontCache } from '@/lib/pdf-i18n-text';
import {
  buildAndStoreCvExportDiagnostic,
  clearCvExportDiagnosticsForTests,
  getLatestCvExportDiagnostic,
} from '@/lib/cv-export-diagnostics';
import type { PrepareExportReadyResult } from '@/lib/prepare-export-ready-cv';
import type { CVData } from '@/lib/types';

const DUTIES = [
  'Kreirala je grafičke materijale za štampane i digitalne medije.',
  'Proveravam prateću dokumentaciju za primljenu robu.',
  'Usaglašavala sam nacrte i izmene sa članovima projektnog tima.',
  'Priprema grafički materijal za različite štampane i digitalne medije.',
];

function fixture(): CVData {
  return {
    id: 'aab494-rirekisho-sr',
    name: 'AAB494 Rirekisho Serbian',
    personal: {
      fullName: 'Ana Petrović',
      email: 'ana@example.com',
      phone: '+381 60 111 222',
      address: 'Beograd',
      jobTitle: 'Grafička dizajnerka',
      gender: 'female',
      photoEnabled: false,
    },
    summary: 'Grafička dizajnerka sa iskustvom u pripremi grafičkih materijala.',
    contentLocale: 'sr',
    experience: [
      {
        id: 'testwerk', company: 'TestWerk GmbH', position: 'Grafička dizajnerka',
        startDate: '2024-01', endDate: '', isPresent: false, description: DUTIES[0],
      },
      {
        id: 'rewitu', company: 'Rewitu', position: 'Grafička dizajnerka',
        startDate: '2019-06', endDate: '2022-12', isPresent: false, description: DUTIES.slice(1).join('\n'),
      },
      {
        id: 'atlas', company: 'Atlas', position: 'Skladišni radnik',
        startDate: '2023-01', endDate: '', isPresent: true, description: DUTIES[1],
      },
      {
        id: 'current', company: 'Rewitu Current Test', position: 'Grafička dizajnerka',
        startDate: '2026-03', endDate: '', isPresent: true, description: DUTIES[2],
      },
      {
        id: 'pixel', company: 'Pixel Studio', position: 'Grafička dizajnerka',
        startDate: '2026-01', endDate: '', isPresent: true, description: DUTIES[3],
      },
    ],
    education: [], skills: [], certifications: [], languages: [], templateId: 'rirekisho', region: 'Japan',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  } as CVData;
}

function installLocalFonts(): void {
  clearPdfI18nFontCache();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const fileName = String(input).split('/').pop() || '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (!fs.existsSync(fontPath)) return { ok: false } as Response;
    const bytes = fs.readFileSync(fontPath);
    return {
      ok: true,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Response;
  });
}

async function extractPdfText(blob: Blob): Promise<string> {
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableFontFace: true,
  }).promise;
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const content = await pdf.getPage(index + 1).then((page) => page.getTextContent());
    return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
  }));
  return pages.join('\n');
}

function preparedRirekisho(): Extract<PrepareExportReadyResult, { ok: true }> {
  const cv = fixture();
  return {
    ok: true,
    cv,
    diagnostics: {
      selectedTemplateId: 'rirekisho',
      selectedFinalSummaryHash: 'fnv1a_e7f712af',
      selectedFinalSource: 'deterministic_v2_manifest',
      exportSummaryHash: 'fnv1a_e7f712af',
    },
  } as Extract<PrepareExportReadyResult, { ok: true }>;
}

beforeEach(() => {
  localStorage.clear();
  clearCvExportDiagnosticsForTests();
  installLocalFonts();
});
afterEach(() => {
  clearPdfI18nFontCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AAB494 Rirekisho date and Serbian Unicode parity', () => {
  test('uses the same Japanese date contract in Preview and actual PDF output', async () => {
    const cv = fixture();
    const preview = render(<RirekishoTemplate data={cv} />);
    const previewText = preview.container.textContent || '';
    expect(previewText).toContain('2024-01');
    expect(previewText).not.toContain('2024-01〜');
    expect(previewText).toContain('2019-06〜2022-12');
    expect(previewText).toContain('2023-01〜現在');
    expect(previewText).toContain('2026-03〜現在');
    expect(previewText).toContain('2026-01〜現在');
    for (const [company, title] of [
      ['TestWerk GmbH', 'Grafička dizajnerka'],
      ['Atlas', 'Skladišni radnik'],
      ['Rewitu', 'Grafička dizajnerka'],
      ['Rewitu Current Test', 'Grafička dizajnerka'],
      ['Pixel Studio', 'Grafička dizajnerka'],
    ]) {
      expect(previewText).toContain(company);
      expect(previewText).toContain(title);
    }

    const text = await extractPdfText(await buildRirekishoPdfBlob(cv, 'sr'));
    expect(text).toContain('2024-01');
    expect(text).not.toContain('2024-01〜');
    expect(text).toContain('2019-06〜2022-12');
    expect(text).toContain('2023-01〜現在');
    expect(text).toContain('2026-03〜現在');
    expect(text).toContain('2026-01〜現在');
    for (const [company, title] of [
      ['TestWerk GmbH', 'Grafička dizajnerka'],
      ['Atlas', 'Skladišni radnik'],
      ['Rewitu', 'Grafička dizajnerka'],
      ['Rewitu Current Test', 'Grafička dizajnerka'],
      ['Pixel Studio', 'Grafička dizajnerka'],
    ]) {
      expect(text).toContain(company);
      expect(text).toContain(title);
    }
  }, 30000);

  test('preserves Serbian duty diacritics in actual extracted direct-PDF text', async () => {
    const text = await extractPdfText(await buildRirekishoPdfBlob(fixture(), 'sr'));
    for (const duty of DUTIES) expect(text).toContain(duty);
    expect(text).not.toContain('grafike materijale');
    expect(text).not.toMatch(/(?:^|\s)tampane i digitalne(?:\s|$)/u);
    expect(text).not.toContain('razliite');
    expect(text).not.toMatch(/(?:^|\s)lanovima(?:\s|$)/u);
  }, 30000);

  test('commits a fresh Rirekisho PDF terminal diagnostic rather than leaving Corporate Navy latest', () => {
    localStorage.setItem('cvpro-export-diag-pdf', JSON.stringify({
      schemaVersion: 1,
      capturedAt: '2026-08-20T12:01:09.828Z',
      appVersionCode: '494',
      selectedTemplateId: 'corporate-navy',
      exportFormat: 'pdf',
    }));
    const page = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    const pdfHandler = page.indexOf('const handlePDFDownload = async');
    const start = page.indexOf("if (liveCv.templateId === 'rirekisho')", pdfHandler);
    const end = page.indexOf('// ── Guard: for rect-photo templates', start);
    expect(pdfHandler).toBeGreaterThanOrEqual(0);
    expect(start).toBeGreaterThan(pdfHandler);
    expect(page.slice(start, end)).toContain('await recordExportDiagnostic({');

    const prepared = preparedRirekisho();
    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'sr', rawCv: prepared.cv, prepared,
      appVersionCode: '494', appVersionName: '1.0.494',
      rendererReached: true, blobProduced: true, blobMimeType: 'application/pdf',
      androidSaveReached: true, saveResult: { result: 'saved', message: 'saved' },
      extraStages: [
        { stage: 'render_blob', result: 'ok' },
        { stage: 'android_save', result: 'ok' },
      ],
    });
    expect(trace).toMatchObject({
      appVersionCode: '494', appVersionName: '1.0.494', selectedTemplateId: 'rirekisho',
      exportFormat: 'pdf', rendererReached: true, blobProduced: true,
      androidSaveReached: true, saveResult: 'saved', ok: true,
    });
    expect(trace.capturedAt).not.toBe('2026-08-20T12:01:09.828Z');
    expect(getLatestCvExportDiagnostic()).toMatchObject({ selectedTemplateId: 'rirekisho', ok: true });
  });
});
