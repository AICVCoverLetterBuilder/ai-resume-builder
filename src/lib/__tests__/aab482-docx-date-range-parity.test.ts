/** @vitest-environment jsdom */
import JSZip from 'jszip';
import { mkdirSync, writeFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData, TemplateId } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { buildModernMinimalPdfBlob, exportRirekishoToDOCX, exportToDOCX, formatExperienceDateRange } from '@/lib/export';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const AAB482_SERBIAN_SUMMARY = 'Imam oko sedam godina iskustva. Trenutno radim kao Grafička dizajnerka u Rewitu Current Test, gde pripremam vizuelne koncepte i rasporede za digitalne materijale, uređujem grafike i fotografije za različite projekte i usaglašavam nacrte i izmene sa članovima projektnog tima. Prethodno sam radila kao Grafička dizajnerka u TestWerk GmbH, gde sam kreirala grafičke materijale za štampane i digitalne medije, razvijala koncepte vizuelnog dizajna prema potrebama klijenata i pregledala projekte dizajna i proveravala kvalitet finalnih rezultata. Prethodno sam radila kao Grafička dizajnerka u Rewitu, gde sam izrađivala vizuelne koncepte i rasporede za digitalne materijale, uređivala grafike i fotografije za različite projekte i usaglašavala nacrte i izmene sa članovima projektnog tima.';

function rawFnv1a(text: string): string {
  let h = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    h ^= text.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

function xmlParagraphText(xml: string): string[] {
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gu)]
    .map((paragraph) => [...paragraph[0].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gu)]
      .map((part) => part[1] || '')
      .join('')
      .replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>')
      .replace(/&quot;/gu, '"').replace(/&apos;/gu, "'"))
    .filter(Boolean);
}

function fixture(overrides: Partial<CVData['experience'][number]> = {}): CVData {
  return {
    id: 'aab482-docx-date-fixture',
    name: 'DOCX Date Fixture',
    personal: {
      fullName: 'Test Person', email: 'test@example.test', phone: '', address: '',
      jobTitle: 'Designer', photoEnabled: false,
    },
    summary: AAB482_SERBIAN_SUMMARY,
    contentLocale: 'en',
    experience: [{
      id: 'testwerk-date-entry', position: 'Designer', company: 'TestWerk',
      startDate: '2024-01', endDate: '', isPresent: false,
      description: '• Prepared materials\nReviewed final outputs',
      ...overrides,
    }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

async function docxText(blob: Blob): Promise<string> {
  expect(blob.type).toBe(DOCX_MIME);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function captureDownloads(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:aab482/${blobs.length}`;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return blobs;
}

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: async () => [], ready: Promise.resolve() },
  });
  globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('AAB482 shared DOCX Experience date semantics', () => {
  it('formats every date combination without dangling separators', () => {
    expect(formatExperienceDateRange('2024-01', '', false, 'Current')).toBe('2024-01');
    expect(formatExperienceDateRange('2024-01', '2025-06', false, 'Current')).toBe('2024-01 - 2025-06');
    expect(formatExperienceDateRange('2024-01', '', true, 'Current')).toBe('2024-01 - Current');
    expect(formatExperienceDateRange('2026-03', '', true, 'Trenutno')).toBe('2026-03 - Trenutno');
    expect(formatExperienceDateRange('', '2025-06', false, 'Current')).toBe('2025-06');
    expect(formatExperienceDateRange('', '', false, 'Current')).toBe('');
    expect(formatExperienceDateRange('2024-01', '', false, 'Current')).not.toMatch(/(?:^| )[-–—](?:$| )/);
  });

  it('serializes the same semantic dates for every production DOCX template', async () => {
    const templates: TemplateId[] = [
      'modern-minimal', 'ats-standard', 'creative-bold', 'creative-artistic',
      'clean-simple', 'professional-classic', 'elegant-formal', 'executive-premium',
      'nordic-clean', 'tech-sidebar', 'corporate-navy', 'contemporary-bold',
    ];
    for (const templateId of templates) {
      const blobs = captureDownloads();
      const result = await exportToDOCX(
        { ...fixture(), templateId },
        `aab482-${templateId}`,
        'en',
        templateId,
      );
      expect(result.result, templateId).toBe('saved');
      const text = await docxText(blobs.at(-1)!);
      expect(text, templateId).toContain('2024-01');
      expect(text, templateId).not.toMatch(/2024-01\s*-\s*(?:$|TestWerk|Prepared|Reviewed)/);
      expect(text, templateId).not.toMatch(/(?:^|\s)-\s*2024-01(?:$|\s)/);
    }
  }, 120_000);

  it('renders completed and current ranges, including Japanese Rirekisho, without changing editor text', async () => {
    const completed = fixture({ startDate: '2022-01', endDate: '2024-12', isPresent: false });
    const current = fixture({ startDate: '2024-01', endDate: '', isPresent: true });
    const completedBefore = completed.experience[0].description;
    const completedBlobs = captureDownloads();
    await exportToDOCX(completed, 'aab482-completed', 'en', 'modern-minimal');
    const completedText = await docxText(completedBlobs.at(-1)!);
    expect(completedText).toContain('2022-01 - 2024-12');
    expect(completed.experience[0].description).toBe(completedBefore);

    const currentBlobs = captureDownloads();
    await exportToDOCX(current, 'aab482-current', 'en', 'modern-minimal');
    const currentText = await docxText(currentBlobs.at(-1)!);
    expect(currentText).toContain('2024-01 - Present');
    expect(currentText).not.toContain('2024-01 - -');

    const pdfBlob = await buildModernMinimalPdfBlob(current, 'en');
    expect(pdfBlob.size).toBeGreaterThan(0);
    expect(current.summary).toBe(AAB482_SERBIAN_SUMMARY);

    const japaneseBlobs = captureDownloads();
    await exportRirekishoToDOCX(fixture({ startDate: '2024-01', endDate: '', isPresent: false }), 'aab482-ja');
    const japaneseText = await docxText(japaneseBlobs.at(-1)!);
    expect(japaneseText).toContain('2024-01');
    expect(japaneseText).not.toContain('2024-01〜');

    const deviceCv = {
      ...fixture(),
      experience: [
        { id: 'testwerk-device', position: 'Grafička dizajnerka', company: 'TestWerk GmbH', startDate: '2024-01', endDate: '', isPresent: false, description: '• Kreirala grafičke materijale' },
        { id: 'rewitu-device', position: 'Grafička dizajnerka', company: 'Rewitu', startDate: '2019-06', endDate: '2022-12', isPresent: false, description: '• Izrađivala vizuelne koncepte' },
        { id: 'rewitu-current-device', position: 'Grafička dizajnerka', company: 'Rewitu Current Test', startDate: '2026-03', endDate: '', isPresent: true, description: '• Pripremala vizuelne koncepte' },
        { id: 'pixel-device', position: 'Grafička dizajnerka', company: 'Pixel Studio', startDate: '2026-01', endDate: '', isPresent: true, description: '• Razvijala dizajn' },
        { id: 'atlas-device', position: 'Grafička dizajnerka', company: 'Atlas', startDate: '2023-01', endDate: '', isPresent: true, description: '• Pregledala projekte' },
      ],
    } satisfies CVData;
    const selectedFinalSummary = deviceCv.summary;
    const templateInputSummary = deviceCv.summary;
    const deviceBlobs = captureDownloads();
    const deviceResult = await exportToDOCX(deviceCv, 'aab482-serbian-device-canonical', 'sr', 'modern-minimal');
    expect(deviceResult.result).toBe('saved');
    const deviceBlob = deviceBlobs.at(-1)!;
    const deviceArrayBuffer = await deviceBlob.arrayBuffer();
    const evidenceDir = 'C:/Users/Q/.codex/aab482-evidence';
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(`${evidenceDir}/aab482-serbian-device-canonical.docx`, Buffer.from(deviceArrayBuffer));
    const deviceZip = await JSZip.loadAsync(deviceArrayBuffer);
    const deviceXml = await deviceZip.file('word/document.xml')!.async('string');
    const serializedSummary = xmlParagraphText(deviceXml).find((paragraph) => paragraph.includes(AAB482_SERBIAN_SUMMARY)) || '';
    const boundary = (text: string) => ({
      rawLength: text.length,
      rawHash: rawFnv1a(text),
      productionNormalizedLength: text.trim().toLowerCase().length,
      productionNormalizedHash: hashSummaryV2Text(text),
      json: JSON.stringify(text),
    });
    const boundaries = {
      selectedFinalSummary: boundary(selectedFinalSummary),
      docxTemplateInputSummary: boundary(templateInputSummary),
      docxSerializedSemanticSummary: boundary(serializedSummary),
    };
    console.log(`AAB482_DOCX_BOUNDARIES ${JSON.stringify(boundaries)}`);
    expect(selectedFinalSummary).toBe(AAB482_SERBIAN_SUMMARY);
    expect(templateInputSummary).toBe(AAB482_SERBIAN_SUMMARY);
    expect(serializedSummary).toBe(AAB482_SERBIAN_SUMMARY);
    expect(hashSummaryV2Text(selectedFinalSummary)).toBe('fnv1a_e7f712af');
    expect(hashSummaryV2Text(templateInputSummary)).toBe('fnv1a_e7f712af');
    expect(hashSummaryV2Text(serializedSummary)).toBe('fnv1a_e7f712af');
  }, 60_000);

  it('keeps localized current labels and start-only semantics across representative scripts', async () => {
    const labels: Array<[Locale, string]> = [
      ['en', 'Present'], ['de', 'Heute'], ['ru', 'По наст. время'], ['hi', 'वर्तमान'],
      ['ar', 'الحالي'], ['ja', '現在'], ['sr', 'Trenutno'],
    ];
    for (const [locale, present] of labels) {
      const blobs = captureDownloads();
      await exportToDOCX(
        fixture({ startDate: '2026-03', endDate: '', isPresent: true }),
        `aab482-${locale}`,
        locale,
        'modern-minimal',
      );
      const text = await docxText(blobs.at(-1)!);
      expect(text, locale).toContain(`2026-03 - ${present}`);
      expect(text, locale).not.toMatch(/2026-03\s*-\s*$/);
    }
  }, 60_000);

  it('keeps duty semantics independent of source bullet punctuation', async () => {
    const variants = [
      '• Prepared materials\n• Reviewed final outputs',
      '- Prepared materials\n- Reviewed final outputs',
      'Prepared materials\nReviewed final outputs',
      'Prepared materials\n- Reviewed final outputs',
    ];
    const rendered: string[] = [];
    for (const description of variants) {
      const cv = fixture({ description });
      const blobs = captureDownloads();
      await exportToDOCX(cv, 'aab482-duty-punctuation', 'en', 'modern-minimal');
      rendered.push(await docxText(blobs.at(-1)!));
      expect(cv.experience[0].description).toBe(description);
    }
    for (const text of rendered) {
      expect(text).toContain('Prepared materials');
      expect(text).toContain('Reviewed final outputs');
    }
  }, 60_000);
});
