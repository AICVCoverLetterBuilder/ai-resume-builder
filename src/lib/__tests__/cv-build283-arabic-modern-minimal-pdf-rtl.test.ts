/**
 * @vitest-environment jsdom
 *
 * Build-283: Arabic Modern Minimal PDF RTL geometry + strict three-slot Summary.
 * Dedicated jsPDF path (not html2canvas). Raster + searchable layer must stay
 * inside A4; DOCX path unchanged for content parity.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from 'canvas';
import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { CVData } from '@/lib/types';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { countPdfPages, extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import { clearPdfI18nFontCache, endPdfI18nPlacementTracking } from '@/lib/pdf-i18n-text';
import {
  ARABIC_MODERN_MINIMAL_PDF_RTL_MARKER,
  analyzeArabicModernMinimalPdfGeometry,
  getLastArabicModernMinimalPdfGeometry,
} from '@/lib/modern-minimal-pdf-renderer';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  analyzeArabicSummaryEmploymentQuality,
  buildConciseGroundedSummary,
} from '@/lib/cv-summary-grounding';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';

const WH_AR = [
  'تتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
  'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع.',
  'تنسّق إعداد البضائع وحركتها مع الزملاء. REST API / SQL.',
].join('\n');

const DESIGN_AR_PAST = [
  'أعدّت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
  'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
  'أعدّت ملفات التصميم النهائية وضبطت الصيغ لشاشات مختلفة.',
].join('\n');

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function installFonts(): void {
  clearPdfI18nFontCache();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    const fileName = url.split('/').pop() || '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) {
      const buf = fs.readFileSync(fontPath);
      return {
        ok: true,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      } as Response;
    }
    return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  });
}

function installCanvasShapingMock(): void {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      font: '',
      direction: 'ltr',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      fillStyle: '',
      measureText: (text: string) => ({ width: Math.max(8, text.length * 7.2) }),
      fillText: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => tinyPng),
    configurable: true,
  });
}

function captureExportBlobs(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://b283/${blobs.length}`;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return blobs;
}

async function docxPlainText(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return '';
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function arabicFixture(): CVData {
  const experience = [
    {
      id: 'exp-wh',
      position: 'موظفة مستودع',
      company: 'Atlas',
      startDate: '2023-01',
      endDate: '',
      isPresent: true,
      description: WH_AR,
      originalUserDescription: WH_AR,
      canonicalDescription: WH_AR,
    },
    {
      id: 'exp-design',
      position: 'مصممة جرافيك',
      company: 'Rewitu',
      startDate: '2020-01',
      endDate: '2023-04',
      isPresent: false,
      description: DESIGN_AR_PAST,
      originalUserDescription: DESIGN_AR_PAST,
      canonicalDescription: DESIGN_AR_PAST,
    },
  ];
  const base: CVData = {
    id: 'build-283-ar-mm',
    name: 'CV',
    personal: {
      fullName: 'Anna Kournikova',
      email: 'anna@example.com',
      phone: '+971 50 000 0000',
      address: 'Dubai',
      jobTitle: 'موظفة مستودع',
      gender: 'female',
      photo: tinyPng,
      photoEnabled: true,
    },
    summary: '',
    contentLocale: 'ar',
    summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: 'ar',
    experience,
    education: [{
      id: 'edu-1',
      school: 'State University',
      degree: 'BA',
      startDate: '2016',
      endDate: '2020',
      description: '',
    }],
    skills: ['القيادة', 'التنظيم', 'REST API', 'SQL'],
    certifications: [],
    languages: [{ name: 'Arabic', level: 'Native' }, { name: 'English', level: 'B2' }],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
  const duration = buildExperienceDurationSnapshot(experience, '2026-07-20').total;
  const summary = buildConciseGroundedSummary(
    buildCvCanonicalFactSet(base),
    'ar',
    'female',
    duration,
    { includeSkills: true },
  );
  return { ...base, summary };
}

async function pdfJsTextItems(buf: Buffer): Promise<Array<{ str: string; x: number; y: number }>> {
  const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;
  const items: Array<{ str: string; x: number; y: number }> = [];
  for (let i = 1; i <= pdfDoc.numPages; i += 1) {
    const page = await pdfDoc.getPage(i);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!('str' in it) || !it.str) continue;
      const t = it.transform as number[];
      items.push({ str: it.str, x: t[4]!, y: t[5]! });
    }
  }
  return items;
}

async function renderPageInkBounds(buf: Buffer): Promise<{
  pageWidth: number;
  pageHeight: number;
  minX: number;
  maxX: number;
  inkColumns: number;
}> {
  // Drop jsdom canvas mocks so pdfjs can paint shaped PNG XObjects via node-canvas.
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'getContext');
  Reflect.deleteProperty(HTMLCanvasElement.prototype, 'toDataURL');

  const canvasFactory = {
    create(width: number, height: number) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset(canvasAndContext: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext: { canvas: ReturnType<typeof createCanvas> }) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    },
  };

  const pdfDoc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    canvasFactory,
  } as ConstructorParameters<typeof pdfjs.getDocument>[0]).promise;
  expect(pdfDoc.numPages).toBe(1);
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    canvasFactory,
  } as Parameters<typeof page.render>[0]).promise;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let maxX = 0;
  const colHits = new Uint8Array(width);
  const step = 4;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const a = data[i + 3]!;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (a > 8 && (r < 250 || g < 250 || b < 250)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        colHits[x] = 1;
      }
    }
  }
  let inkColumns = 0;
  for (let x = 0; x < width; x += 1) inkColumns += colHits[x]!;
  return {
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    minX: minX === width ? 0 : minX,
    maxX,
    inkColumns,
  };
}

describe('cv-build283 Arabic Modern Minimal PDF RTL geometry', () => {
  beforeEach(() => {
    installFonts();
    installCanvasShapingMock();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    endPdfI18nPlacementTracking();
  });

  it('exposes the Arabic MM PDF RTL proof marker', () => {
    expect(ARABIC_MODERN_MINIMAL_PDF_RTL_MARKER).toBe('arabic-modern-minimal-pdf-rtl-283-v1');
  });

  it('strict three-slot Summary never appends skills/other unit', () => {
    const cv = arabicFixture();
    expect(cv.summary).not.toMatch(/تشمل\s+المهارات/);
    const q = analyzeArabicSummaryEmploymentQuality(cv.summary, {
      company: 'Atlas',
      priorCompany: 'Rewitu',
      structuredRole: 'موظفة مستودع',
      currentEntryDuties: WH_AR,
      priorEntryDuties: DESIGN_AR_PAST,
      gender: 'female',
    });
    expect(q.finalUnitRoleSlots).toEqual(['current_intro', 'current_duty', 'prior_role']);
    expect(q.finalUnitRoleSlots).not.toContain('other');
    expect(q.groundingValidationPassed).toBe(true);
  });

  it('Arabic MM PDF keeps raster + searchable layer inside A4; DOCX parity; usage +0', async () => {
    const raw = arabicFixture();
    const prepared = prepareExportReadyCv(raw, 'ar', 'modern-minimal');
    expect(prepared.ok, !prepared.ok ? `prepare failed: ${prepared.reason}` : '').toBe(true);
    if (!prepared.ok) return;

    const blobs = captureExportBlobs();
    const beforeUsage = getProAiUsageCount();
    const pdfBlob = await buildModernMinimalPdfBlob(prepared.cv, 'ar');
    const docxCv: CVData = {
      ...prepared.cv,
      personal: { ...prepared.cv.personal, photoEnabled: false, photo: '' },
    };
    await exportToDOCX(docxCv, 'Anna-Kournikova-CV', 'ar', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(beforeUsage);

    const pdfBuf = Buffer.from(await pdfBlob.arrayBuffer());
    expect(countPdfPages(pdfBuf)).toBe(1);
    expect(pdfBuf.toString('latin1')).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+595/);

    const geometry = getLastArabicModernMinimalPdfGeometry();
    expect(geometry).toBeTruthy();
    expect(geometry!.ok).toBe(true);
    expect(geometry!.marker).toBe(ARABIC_MODERN_MINIMAL_PDF_RTL_MARKER);
    expect(geometry!.searchableLayerOutOfBoundsCount).toBe(0);
    expect(geometry!.rasterOutOfBoundsCount).toBe(0);
    expect(geometry!.searchableLayerMinXPt).toBeGreaterThanOrEqual(-0.5);
    expect(geometry!.searchableLayerMaxXPt).toBeLessThanOrEqual(geometry!.pageWidthPt + 0.5);
    expect(geometry!.rasterVisibleBoundsLeftPt).toBeGreaterThanOrEqual(-0.5);
    expect(geometry!.rasterVisibleBoundsRightPt).toBeLessThanOrEqual(geometry!.pageWidthPt + 0.5);
    expect(geometry!.rtlRootTransform).toBe('none');
    expect(geometry!.pdfImageXPt).toBe(0);

    const unicode = extractPdfUnicodeText(pdfBuf);
    // jsPDF Arabic ToUnicode may emit Presentation Forms (FE70–FEFF) in visual order.
    expect(unicode).toMatch(/(?:[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]){8,}/);
    expect(unicode).toMatch(/Anna|Kournikova/);
    expect(unicode).toMatch(/Atlas/);
    expect(unicode).toMatch(/Rewitu/);
    expect(unicode).toMatch(/REST|SQL/);
    expect(prepared.cv.summary).toMatch(/موظفة\s*مستودع/);
    expect(prepared.cv.summary).toMatch(/مصممة\s*جرافيك/);

    const items = await pdfJsTextItems(pdfBuf);
    const outOfBounds = items.filter((it) => it.x < -1 || it.x > 596);
    expect(outOfBounds, JSON.stringify(outOfBounds.slice(0, 5))).toEqual([]);

    // Authoritative raster occupancy from the same placement tracker used by the
    // fail-closed export guard (shaped PNG left/right in page points).
    const rasterSpan = geometry!.rasterVisibleBoundsRightPt - geometry!.rasterVisibleBoundsLeftPt;
    expect(rasterSpan).toBeGreaterThan(geometry!.pageWidthPt * 0.45);
    expect(geometry!.rasterVisibleBoundsLeftPt).toBeLessThan(geometry!.pageWidthPt * 0.25);
    expect(geometry!.searchableLayerMaxXPt - geometry!.searchableLayerMinXPt)
      .toBeGreaterThan(geometry!.pageWidthPt * 0.45);

    // Best-effort pdfjs page image inspection (jsdom cannot paint all PNG XObjects).
    let renderedPage = false;
    try {
      const ink = await renderPageInkBounds(pdfBuf);
      renderedPage = true;
      expect(ink.minX).toBeGreaterThanOrEqual(0);
      expect(ink.maxX).toBeLessThanOrEqual(ink.pageWidth);
      expect((ink.maxX - ink.minX) / ink.pageWidth).toBeGreaterThan(0.45);
      expect(ink.inkColumns / ink.pageWidth).toBeGreaterThan(0.15);
    } catch (err) {
      expect(String(err)).toMatch(/Image or Canvas expected|not implemented/i);
    }
    // Geometry + searchable bounds always required; page image when environment allows.
    expect(geometry!.ok || renderedPage).toBe(true);

    const docxBlob = blobs.find((b) => (b.type || '').includes('word') || b.size > 800)
      || blobs[blobs.length - 1];
    expect(docxBlob).toBeTruthy();
    const docxText = await docxPlainText(docxBlob!);
    expect(docxText).toMatch(/موظفة|مستودع|Atlas|Rewitu/);
    expect(fingerprintText(prepared.cv.summary)).toBe(fingerprintText(raw.summary));
    expect(prepared.cv.summary).toBe(raw.summary);
    expect(prepared.cv.summary).not.toMatch(/تشمل\s+المهارات|مطبخ|تحميل|توصيل/);
  }, 120000);

  it('RTL/bidi matrix lines stay readable and in-bounds', async () => {
    const base = arabicFixture();
    base.experience[0]!.description = [
      'تتحقق من البضائع الواردة لدى Atlas منذ يناير 2023.',
      'تنسّق حركة البضائع مع REST API و SQL.',
      'تحافظ على سجلات المستودع / الوثائق المرفقة، بدقة.',
    ].join('\n');
    base.experience[0]!.originalUserDescription = base.experience[0]!.description;
    base.experience[0]!.canonicalDescription = base.experience[0]!.description;
    const prepared = prepareExportReadyCv(base, 'ar', 'modern-minimal');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const blob = await buildModernMinimalPdfBlob(prepared.cv, 'ar');
    const buf = Buffer.from(await blob.arrayBuffer());
    const geo = getLastArabicModernMinimalPdfGeometry();
    expect(geo?.ok).toBe(true);
    expect(geo?.searchableLayerOutOfBoundsCount).toBe(0);
    const text = extractPdfUnicodeText(buf);
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/REST|SQL/);
    expect(text).toMatch(/[\u0600-\u06FF]/);
  }, 60000);

  it('geometry analyzer rejects negative / narrow-strip placements', () => {
    const bad = analyzeArabicModernMinimalPdfGeometry([
      {
        kind: 'shaped-raster',
        leftPt: -40,
        rightPt: -5,
        yPt: 100,
        widthPt: 35,
      },
      {
        kind: 'unicode-invisible',
        leftPt: -40,
        rightPt: -5,
        yPt: 100,
        widthPt: 35,
      },
    ]);
    expect(bad.ok).toBe(false);
    expect(bad.reasons.length).toBeGreaterThan(0);
    expect(bad.searchableLayerOutOfBoundsCount).toBeGreaterThan(0);
  });
});
