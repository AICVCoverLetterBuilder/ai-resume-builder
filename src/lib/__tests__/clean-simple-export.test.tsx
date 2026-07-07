/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { CleanSimpleTemplate, templateComponents } from '@/components/cv-templates';
import {
  createCleanSimplePdfTemplate,
  splitCleanSimpleSummaryParagraphBlocks,
  splitCleanSimpleSummarySentenceRuns,
} from '@/lib/clean-simple-pdf-template';
import {
  adjustCleanSimpleBreakForSentenceBoundary,
  applyCleanSimpleKeepTogetherPagination,
  applyCleanSimplePostLineBreakGuardCanvasPx,
  buildCleanSimplePdfBlob,
  buildCvPdfBlob,
  buildPaddedPdfSlice,
  CLEAN_SIMPLE_PDF_BUILD_CANARY,
  collectCleanSimpleSummarySentenceSpansCss,
  exportCleanSimplePdf,
  exportToDOCX,
  findCleanSimpleCanvasContentBottomPx,
  findCleanSimpleCanvasWhitespaceBreak,
  findVisibleCanvasBottom,
  getCleanSimplePdfExportBuildOptions,
  isCleanSimpleBreakInsideLineInterval,
  isCleanSimpleSegmentBoundaryLineSafe,
  isCleanSimpleTopPaddingBandClean,
  measureExportMeaningfulContentBounds,
  planCleanSimplePdfSliceSegments,
  readPdfBlobAsLatin1Text,
  resolveCleanSimpleLineAtomicBreakCanvasPx,
  resolveCvPdfCaptureTemplateId,
  resolveCvPdfExportRoute,
} from '@/lib/export';
import type { CleanSimplePdfSliceBreakDiagnostics } from '@/lib/export';
import type { CVData } from '@/lib/types';

const exportSource = () => fs.readFileSync(path.resolve('src/lib/export.ts'), 'utf8');
const pageSource = () => fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
const templateSource = () => fs.readFileSync(path.resolve('src/components/cv-templates.tsx'), 'utf8');
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function rectAttr(top: number, left: number, width: number, height: number): string {
  return [top, left, width, height].join(',');
}

function installRectMock() {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
    const raw = this.getAttribute('data-test-rect');
    if (!raw) {
      return {
        x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}),
      } as DOMRect;
    }
    const [baseTop, left, width, height] = raw.split(',').map(Number);
    let marginShift = Number.parseFloat(this.style.marginTop || '0') || 0;
    let node: HTMLElement | null = this.parentElement;
    while (node) {
      marginShift += Number.parseFloat(node.style.marginTop || '0') || 0;
      node = node.parentElement;
    }
    const collectPreviousSpacerHeight = (element: HTMLElement): number => {
      let total = 0;
      let flowNode: HTMLElement | null = element;
      while (flowNode?.parentElement) {
        let sibling = flowNode.previousElementSibling;
        while (sibling) {
          if (sibling instanceof HTMLElement && sibling.getAttribute('data-clean-simple-final-sections-spacer') === 'true') {
            total += Number.parseFloat(sibling.style.height || '0') || 0;
          }
          sibling = sibling.previousElementSibling;
        }
        flowNode = flowNode.parentElement;
      }
      return total;
    };
    const spacerShift = collectPreviousSpacerHeight(this);
    const top = baseTop + marginShift + spacerShift;
    return {
      x: left,
      y: top,
      top,
      left,
      right: left + width,
      bottom: top + height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  });
}
const originalPhoto = `data:image/jpeg;base64,${Buffer.from('clean-simple-original-photo').toString('base64')}`;
const selectedPhoto = `data:image/jpeg;base64,${Buffer.from('clean-simple-selected-photo').toString('base64')}`;
let loadedImageSources: string[] = [];

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 300;
  naturalHeight = 300;
  decode = vi.fn().mockResolvedValue(undefined);
  private currentSrc = '';

  get src() {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    loadedImageSources.push(value);
    setTimeout(() => {
      if (value.includes('broken')) this.onerror?.();
      else this.onload?.();
    }, 0);
  }
}

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'clean-simple-test',
    name: '',
    personal: {
      fullName: 'Mila Petrovic',
      email: 'mila@example.com',
      phone: '+381 64 555 0100',
      address: 'Belgrade, Serbia',
      jobTitle: 'Operations Coordinator',
      photo: tinyPng,
      photoEnabled: true,
    },
    summary: 'Organized coordinator with experience keeping teams aligned and delivery predictable.',
    experience: [
      {
        id: '1',
        company: 'Northwind Logistics',
        position: 'Operations Coordinator',
        startDate: '2021-03',
        endDate: '',
        isPresent: true,
        description: 'Coordinated daily scheduling across three teams.\n- Reduced handoff delays through clearer status tracking.',
      },
    ],
    education: [
      { id: 'e1', school: 'University of Belgrade', degree: 'BA Management', startDate: '2015', endDate: '2019', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Time Management', 'Scheduling', 'Communication'],
    certifications: ['Project Coordination Certificate'],
    languages: [{ name: 'Serbian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    templateId: 'clean-simple',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

function draganCv(): CVData {
  return cv({
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Учитељ',
      photo: selectedPhoto,
      originalPhoto,
      photoEnabled: true,
    } as CVData['personal'] & { originalPhoto: string },
    summary: 'Iskusan učitelj sa oko devet godina rada u obrazovanju, koji je svoju karijeru gradio kroz neposredan rad sa učenicima.',
    experience: [
      {
        id: 'exp-1',
        company: 'Zhff',
        position: 'Učitelj u osnovnoj školi',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: 'Planirao sam i realizovao nastavne jedinice iz srpskog jezika i matematike.',
      },
      {
        id: 'exp-2',
        company: 'Hfh',
        position: 'Nastavnik geografije',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: 'Koristio sam geografske karte i digitalne alate.',
      },
    ],
    education: [{ id: 'edu-1', school: 'Metematički fakultet', degree: 'VI', startDate: '2020-01', endDate: '2025-02', description: '' }],
    skills: ['Teamwork', 'Organization', 'Coaching', 'Coaching', 'Leadership', 'Creativity'],
    certifications: [],
    languages: [{ name: 'Serbian', level: 'Native' }],
    templateId: 'clean-simple',
    region: 'Balkan',
  });
}

function makeCanvas(width: number, height: number, hasContentAt: (absoluteY: number) => boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'getContext', {
    value: vi.fn(() => ({
      drawImage: vi.fn(),
      getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4);
        data.fill(255);
        for (let row = 0; row < h; row += 1) {
          if (!hasContentAt(y + row)) continue;
          const index = row * w * 4;
          data[index] = 5;
          data[index + 1] = 150;
          data[index + 2] = 105;
          data[index + 3] = 255;
        }
        return { data };
      }),
    })),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,clean-simple'), configurable: true });
  return canvas;
}

/**
 * A canvas backed by a real, mutable RGBA pixel buffer with working fillRect/drawImage/
 * getImageData semantics (not just a fixed synthetic pattern). Used by the V11
 * canvas-pixel-final resolver tests below, which must prove real pixel-level behavior
 * (e.g. that `buildPaddedPdfSlice`'s drawImage + top-padding re-clear genuinely leaves
 * zero ink pixels in the padding band, or that a single faint anti-aliased pixel is
 * still detected as ink) rather than only asserting against a pre-baked ink pattern.
 */
function createPixelBufferCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const buffer = new Uint8ClampedArray(width * height * 4).fill(255);
  (canvas as unknown as { __buf: Uint8ClampedArray }).__buf = buffer;

  const parseFillColor = (style: string): [number, number, number, number] => {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(style);
    if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16), 255];
    const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(style);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] ? Math.round(Number(rgb[4]) * 255) : 255];
    return [255, 255, 255, 255];
  };

  Object.defineProperty(canvas, 'getContext', {
    value: vi.fn(() => {
      let fillStyleValue = '#ffffff';
      return {
        get fillStyle() { return fillStyleValue; },
        set fillStyle(value: string) { fillStyleValue = value; },
        beginPath: vi.fn(),
        arc: vi.fn(),
        closePath: vi.fn(),
        clip: vi.fn(),
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        fillRect(x: number, y: number, w: number, h: number) {
          const [r, g, b, a] = parseFillColor(fillStyleValue);
          const top = Math.max(0, Math.floor(y));
          const bottom = Math.min(height, Math.ceil(y + h));
          const left = Math.max(0, Math.floor(x));
          const right = Math.min(width, Math.ceil(x + w));
          for (let row = top; row < bottom; row += 1) {
            for (let col = left; col < right; col += 1) {
              const index = (row * width + col) * 4;
              buffer[index] = r;
              buffer[index + 1] = g;
              buffer[index + 2] = b;
              buffer[index + 3] = a;
            }
          }
        },
        drawImage(
          source: unknown,
          sx: number, sy: number, sw: number, sh: number,
          dx: number, dy: number, dw: number, dh: number,
        ) {
          const sourceCanvas = source as { width: number; height: number } & { __buf?: Uint8ClampedArray };
          const srcBuf = sourceCanvas.__buf;
          if (!srcBuf) return;
          const scaleX = sw !== 0 ? sw / dw : 1;
          const scaleY = sh !== 0 ? sh / dh : 1;
          for (let row = 0; row < dh; row += 1) {
            const srcRow = Math.floor(sy + row * scaleY);
            const dstRow = Math.floor(dy + row);
            if (srcRow < 0 || srcRow >= sourceCanvas.height || dstRow < 0 || dstRow >= height) continue;
            for (let col = 0; col < dw; col += 1) {
              const srcCol = Math.floor(sx + col * scaleX);
              const dstCol = Math.floor(dx + col);
              if (srcCol < 0 || srcCol >= sourceCanvas.width || dstCol < 0 || dstCol >= width) continue;
              const srcIndex = (srcRow * sourceCanvas.width + srcCol) * 4;
              const dstIndex = (dstRow * width + dstCol) * 4;
              buffer[dstIndex] = srcBuf[srcIndex];
              buffer[dstIndex + 1] = srcBuf[srcIndex + 1];
              buffer[dstIndex + 2] = srcBuf[srcIndex + 2];
              buffer[dstIndex + 3] = srcBuf[srcIndex + 3];
            }
          }
        },
        getImageData(x: number, y: number, w: number, h: number) {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let row = 0; row < h; row += 1) {
            const srcRow = Math.floor(y) + row;
            if (srcRow < 0 || srcRow >= height) continue;
            for (let col = 0; col < w; col += 1) {
              const srcCol = Math.floor(x) + col;
              if (srcCol < 0 || srcCol >= width) continue;
              const srcIndex = (srcRow * width + srcCol) * 4;
              const dstIndex = (row * w + col) * 4;
              data[dstIndex] = buffer[srcIndex];
              data[dstIndex + 1] = buffer[srcIndex + 1];
              data[dstIndex + 2] = buffer[srcIndex + 2];
              data[dstIndex + 3] = buffer[srcIndex + 3];
            }
          }
          return { data, width: w, height: h } as unknown as ImageData;
        },
      } as unknown as CanvasRenderingContext2D;
    }),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,clean-simple-pixel'), configurable: true });
  return canvas;
}

/** Paints a full-width horizontal ink row (default: solid dark gray) onto a pixel-buffer canvas. */
function paintCleanSimpleInkRow(canvas: HTMLCanvasElement, y: number, heightPx = 1, rgb: [number, number, number] = [10, 10, 10]): void {
  const ctx = canvas.getContext('2d') as unknown as { fillStyle: string; fillRect: (x: number, y: number, w: number, h: number) => void };
  ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  ctx.fillRect(0, y, canvas.width, heightPx);
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{
    pages: number;
    addImage: ReturnType<typeof vi.fn>;
    addPage: ReturnType<typeof vi.fn>;
    metadataKeywords: string;
    drawnText: string[];
    drawnRuns: Array<{ page: number; text: string }>;
  }> = [];
  const clonedTextContents: string[] = [];
  const html2canvasMock = vi.fn(async (_target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    if (options?.onclone) {
      const clonedDocument = document.implementation.createHTMLDocument('clone');
      clonedDocument.body.innerHTML = document.body.innerHTML;
      options.onclone(clonedDocument);
      clonedTextContents.push(clonedDocument.body.textContent ?? '');
    }
    return canvas;
  });
  vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
  vi.doMock('jspdf', () => ({
    jsPDF: class MockPdf {
      pages = 1;
      metadataKeywords = '';
      drawnText: string[] = [];
      drawnRuns: Array<{ page: number; text: string }> = [];
      addImage = vi.fn();
      addPage = vi.fn(() => {
        this.pages += 1;
      });
      setFont = vi.fn();
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      setDrawColor = vi.fn();
      setLineWidth = vi.fn();
      line = vi.fn();
      text = vi.fn((value: string | string[]) => {
        const values = Array.isArray(value) ? value.map(String) : [String(value)];
        this.drawnText.push(...values);
        values.forEach(text => this.drawnRuns.push({ page: this.pages, text }));
      });
      splitTextToSize = vi.fn((value: string, maxWidth: number) => {
        const words = String(value).split(/\s+/).filter(Boolean);
        const maxChars = Math.max(12, Math.floor(maxWidth / 2.2));
        const lines: string[] = [];
        let current = '';
        words.forEach((word) => {
          const next = current ? `${current} ${word}` : word;
          if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
          } else {
            current = next;
          }
        });
        if (current) lines.push(current);
        return lines.length > 0 ? lines : [''];
      });
      setProperties(props: { keywords?: string; subject?: string }) {
        this.metadataKeywords = props.keywords ?? props.subject ?? '';
      }
      constructor() {
        instances.push(this);
      }
      output(type?: string) {
        const body = `%PDF-1.7\n${this.metadataKeywords}\n${this.drawnText.join('\n')}\n%%EOF`;
        if (type === 'blob') return new Blob([body], { type: 'application/pdf' });
        return body;
      }
    },
  }));
  return { instances, clonedTextContents, html2canvasMock };
}

beforeEach(() => {
  vi.restoreAllMocks();
  loadedImageSources = [];
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
  Object.defineProperty(globalThis, 'requestAnimationFrame', { value: (cb: FrameRequestCallback) => setTimeout(cb, 0), configurable: true });
  Object.defineProperty(document, 'fonts', {
    value: { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() },
    configurable: true,
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    beginPath: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(tinyPng);
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://test/docx'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.doUnmock('html2canvas');
  vi.doUnmock('jspdf');
  vi.restoreAllMocks();
});

describe('Clean Simple preview/export parity', () => {
  test('Clean Simple resolves to its real renderer and export-safe A4 root', () => {
    const html = renderToStaticMarkup(<CleanSimpleTemplate data={cv()} locale="en" />);
    const src = templateSource();
    const cleanStart = src.indexOf('export function CleanSimpleTemplate');
    const cleanEnd = src.indexOf('// --- Professional Classic');
    const cleanSource = src.slice(cleanStart, cleanEnd);

    expect(templateComponents['clean-simple']).toBe(CleanSimpleTemplate);
    expect(html).toContain('data-template-id="clean-simple"');
    expect(html).toContain('box-border');
    expect(html).toContain('w-[210mm]');
    expect(html).toContain('min-height:297mm');
    expect(cleanSource).not.toContain('max-w-[210mm]');
  });

  test('Clean Simple PDF uses the dedicated direct renderer route, not generic exportToPDF/print fallback', () => {
    const page = pageSource();
    const branch = page.indexOf("resolveCvPdfExportRoute(liveCv.templateId).kind === 'dedicated-clean-simple'");
    const exportCall = page.indexOf('exportCleanSimplePdf', branch);
    const genericExport = page.indexOf('exportToPDF(previewId', branch);
    const fallbackGuard = page.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = page.indexOf('await openPrintFallback', fallbackGuard);

    expect(branch).toBeGreaterThan(-1);
    expect(exportCall).toBeGreaterThan(branch);
    expect(exportCall).toBeLessThan(genericExport);
    expect(page.slice(branch, exportCall)).toContain('cvRef.current');
    expect(page.slice(branch, branch + 300)).toContain('showCvExportSuccessToast');
    expect(page.slice(fallbackGuard, fallback)).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(page.slice(fallbackGuard, fallback)).toContain('return;');

    const src = exportSource();
    expect(src).toContain('export async function exportCleanSimplePdf');
    expect(src).toContain('const pdfBlob = await buildCleanSimplePdfBlob(cv, locale)');
    expect(src).toContain('export async function buildCleanSimplePdfBlob');
    expect(src).toContain("await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf')");
  });

  test('Clean Simple PDF export wires block-aware keep-together pagination before html2canvas capture', () => {
    const src = exportSource();
    const templateSrc = fs.readFileSync(path.resolve('src/lib/clean-simple-pdf-template.ts'), 'utf8');
    expect(src).toContain('applyCleanSimpleKeepTogetherPagination');
    expect(src).toContain("captureTemplateId === 'clean-simple' && sourceRootForTag");
    expect(templateSrc).toContain('data-clean-simple-summary-block');
    expect(templateSrc).toContain('data-clean-simple-experience-header');
    expect(templateSrc).toContain('data-clean-simple-experience-description');
  });

  test('splitCleanSimpleSummaryParagraphBlocks only splits on real paragraph breaks, never on sentences', () => {
    // Real, explicit paragraph breaks (blank line) are the only thing that produces
    // more than one block — this is what keeps the rendered summary's typography
    // identical to the template's original single/multi-paragraph flow instead of the
    // V6 regression that rendered every sentence as its own visually separated block.
    expect(splitCleanSimpleSummaryParagraphBlocks('First paragraph.\n\nSecond paragraph.')).toEqual([
      'First paragraph.',
      'Second paragraph.',
    ]);
    expect(splitCleanSimpleSummaryParagraphBlocks('First sentence. Second sentence. Third sentence.')).toEqual([
      'First sentence. Second sentence. Third sentence.',
    ]);
  });

  test('splitCleanSimpleSummaryParagraphBlocks repairs glued sentence spacing without creating new blocks', () => {
    // "matter.Software" is a real content bug (missing space) — it must be repaired by
    // inserting the missing space, but must NOT create a second visible paragraph block.
    const blocks = splitCleanSimpleSummaryParagraphBlocks('Details matter.Software quality follows. Rooted in care.');
    expect(blocks).toEqual(['Details matter. Software quality follows. Rooted in care.']);
  });

  test('Clean Simple summary template renders one flowing block per real paragraph, not per sentence', () => {
    // A summary with no explicit paragraph break must render as exactly ONE flowing
    // <p> — multiple sentences must never be split into separate visible blocks
    // (the V6 regression this fix reverts).
    const singleParagraphRoot = createCleanSimplePdfTemplate({
      ...draganCv(),
      summary: 'First sentence on page one. Second sentence should stay in the same flowing paragraph. Third sentence too.',
    }, { locale: 'en' });
    const singleParagraphBlocks = Array.from(singleParagraphRoot.querySelectorAll('[data-clean-simple-summary-block]'));
    expect(singleParagraphBlocks).toHaveLength(1);
    expect(singleParagraphBlocks[0].textContent).toBe(
      'First sentence on page one. Second sentence should stay in the same flowing paragraph. Third sentence too.',
    );
    expect(singleParagraphBlocks[0].getAttribute('data-export-block')).toBe('clean-simple-summary');

    // An explicit user paragraph break (blank line) is the only thing that produces a
    // second block.
    const twoParagraphRoot = createCleanSimplePdfTemplate({
      ...draganCv(),
      summary: 'First paragraph stays together.\n\nSecond paragraph stays together too.',
    }, { locale: 'en' });
    const twoParagraphBlocks = Array.from(twoParagraphRoot.querySelectorAll('[data-clean-simple-summary-block]'));
    expect(twoParagraphBlocks).toHaveLength(2);
  });

  test('applyCleanSimpleKeepTogetherPagination shifts a straddling summary block to the next page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="clean-simple" data-test-rect="${rectAttr(0, 0, 800, 1800)}">
        <section data-clean-simple-section="summary" data-test-rect="${rectAttr(900, 40, 720, 260)}">
          <h2 data-test-rect="${rectAttr(900, 40, 720, 16)}">PROFESSIONAL SUMMARY</h2>
          <div data-clean-simple-summary-blocks="true" data-test-rect="${rectAttr(920, 40, 720, 220)}">
            <p data-clean-simple-summary-block="true" data-test-rect="${rectAttr(920, 40, 720, 90)}">First summary block stays on page one.</p>
            <p data-clean-simple-summary-block="true" data-test-rect="${rectAttr(pageHeight - 24, 40, 720, 110)}">Second summary block must not straddle the page break.</p>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="clean-simple"]') as HTMLElement;
    const secondBlock = document.querySelector('[data-clean-simple-summary-block]:last-of-type') as HTMLElement;

    const report = applyCleanSimpleKeepTogetherPagination(root);

    expect(Number.parseFloat(secondBlock.style.marginTop)).toBeGreaterThan(20);
    const summaryBlockDiagnostics = report.blocks.filter(b => b.kind === 'summary-block');
    expect(summaryBlockDiagnostics).toHaveLength(2);
    expect(summaryBlockDiagnostics[1]).toMatchObject({
      keepGroupId: 'summary-block-1',
      straddles: false,
      shifted: true,
    });
    expect(summaryBlockDiagnostics[1].appliedMarginTopPx).toBeGreaterThan(20);
    expect(document.body.textContent).toContain('Second summary block must not straddle the page break.');
  });

  test('applyCleanSimpleKeepTogetherPagination keeps WORK EXPERIENCE heading glued to its first entry', () => {
    const pageHeight = (297 / 210) * 800;
    // Heading fits just before the boundary, but the first entry's header row + description
    // would straddle it — the heading itself must be pushed down to the next page too, so
    // the exported PDF never shows a page starting with the entry but no section heading.
    document.body.innerHTML = `
      <div data-template-id="clean-simple" data-test-rect="${rectAttr(0, 0, 800, 1800)}">
        <section data-clean-simple-section="experience" data-test-rect="${rectAttr(pageHeight - 40, 40, 720, 200)}">
          <h2 data-test-rect="${rectAttr(pageHeight - 40, 40, 720, 16)}">WORK EXPERIENCE</h2>
          <div data-export-group="clean-simple-experience" data-test-rect="${rectAttr(pageHeight - 20, 40, 720, 180)}">
            <div data-clean-simple-experience-header="true" data-test-rect="${rectAttr(pageHeight - 20, 40, 720, 16)}">Software engineer at Zezezeze</div>
            <p data-clean-simple-experience-description="true" data-test-rect="${rectAttr(pageHeight - 2, 40, 720, 40)}">Built and shipped product features.</p>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="clean-simple"]') as HTMLElement;
    const heading = root.querySelector('[data-clean-simple-section="experience"] h2') as HTMLElement;

    const report = applyCleanSimpleKeepTogetherPagination(root);

    // The heading did not straddle the boundary on its own, but its required trailing
    // content (header row + first description lines) did not fit before the boundary —
    // the heading itself must still be pushed to the next page so it is never left
    // stranded alone at the bottom of a page while its entry starts the next one.
    expect(Number.parseFloat(heading.style.marginTop) || 0).toBeGreaterThan(0);

    const headingDiagnostic = report.blocks.find(b => b.kind === 'section-heading' && b.keepGroupId === 'experience');
    expect(headingDiagnostic?.shifted).toBe(true);
    expect(headingDiagnostic?.straddles).toBe(false);
  });

  test('applyCleanSimpleKeepTogetherPagination keeps Skills heading with all final skill items instead of allowing page 3 to start with orphaned chips', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="clean-simple" data-test-rect="${rectAttr(0, 0, 800, pageHeight * 3)}">
        <div data-clean-simple-final-sections="true" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight - 38, 40, 720, 118)}">
          <section data-clean-simple-section="skills" data-test-rect="${rectAttr(pageHeight - 38, 40, 720, 118)}">
            <h2 data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight - 38, 40, 720, 16)}">SKILLS</h2>
            <div data-test-rect="${rectAttr(pageHeight - 16, 40, 720, 96)}">
              <span data-clean-simple-skill="item" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight - 16, 40, 80, 14)}">Python</span>
              <span data-clean-simple-skill="item" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight + 44, 40, 100, 14)}">Teamwork</span>
              <span data-clean-simple-skill="item" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight + 64, 40, 240, 14)}">Cloud Services (AWS/Azure/GCP)</span>
              <span data-clean-simple-skill="item" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight + 84, 40, 150, 14)}">Problem Solving</span>
            </div>
          </section>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="clean-simple"]') as HTMLElement;
    const finalWrapper = root.querySelector('[data-clean-simple-final-sections]') as HTMLElement;
    const skillsSection = root.querySelector('[data-clean-simple-section="skills"]') as HTMLElement;

    const report = applyCleanSimpleKeepTogetherPagination(root);

    const spacer = finalWrapper.previousElementSibling as HTMLElement | null;
    expect(spacer?.getAttribute('data-clean-simple-final-sections-spacer')).toBe('true');
    expect(Number.parseFloat(spacer?.style.height || '0')).toBeGreaterThan(0);
    expect(Number.parseFloat(finalWrapper.style.marginTop) || 0).toBe(0);
    const skillsHeadingDiagnostic = report.blocks.find(b => b.kind === 'section-heading' && b.keepGroupId === 'skills');
    expect(skillsHeadingDiagnostic?.straddles).toBe(false);
    expect(skillsHeadingDiagnostic?.top).toBeGreaterThanOrEqual(pageHeight);
    // Generic heading+first-child logic must not add a second, independent shift to the
    // Skills section inside the atomic final wrapper.
    expect(Number.parseFloat(skillsSection.style.marginTop) || 0).toBe(0);
    expect(report.finalSections.moved).toBe(true);
    expect(report.finalSections.straddledBefore).toBe(true);
    expect(report.finalSections.straddlesAfter).toBe(false);
    expect(report.finalSections.spacerHeightPx).toBeGreaterThan(0);
    // This was V12's remaining defect: a clean canvas whitespace break was allowed
    // between the heading/early chips and the final chips. The whole short Skills
    // section now moves before rasterization, so no page can start with orphaned items.
    expect(skillsHeadingDiagnostic?.textPreview).toBe('SKILLS');
  });

  test('applyCleanSimpleKeepTogetherPagination moves Skills and Languages together when the final compact block fits on a continuation page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="clean-simple" data-test-rect="${rectAttr(0, 0, 800, pageHeight * 3)}">
        <div data-clean-simple-final-sections="true" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight - 42, 40, 720, 162)}">
          <section data-clean-simple-section="skills" data-test-rect="${rectAttr(pageHeight - 42, 40, 720, 90)}">
            <h2 data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight - 42, 40, 720, 16)}">SKILLS</h2>
            <div data-test-rect="${rectAttr(pageHeight - 20, 40, 720, 68)}">
              <span data-clean-simple-skill="item" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight - 20, 40, 80, 14)}">Python</span>
              <span data-clean-simple-skill="item" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight + 24, 40, 150, 14)}">Problem Solving</span>
            </div>
          </section>
          <section data-clean-simple-section="languages" data-test-rect="${rectAttr(pageHeight + 62, 40, 720, 58)}">
            <h2 data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight + 62, 40, 720, 16)}">LANGUAGES</h2>
            <div data-test-rect="${rectAttr(pageHeight + 84, 40, 720, 30)}">
              <span data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight + 84, 40, 180, 14)}">English (Advanced)</span>
              <span data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight + 100, 40, 160, 14)}">Italian (Native)</span>
            </div>
          </section>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="clean-simple"]') as HTMLElement;
    const finalWrapper = root.querySelector('[data-clean-simple-final-sections]') as HTMLElement;
    const skillsSection = root.querySelector('[data-clean-simple-section="skills"]') as HTMLElement;
    const languagesSection = root.querySelector('[data-clean-simple-section="languages"]') as HTMLElement;

    const report = applyCleanSimpleKeepTogetherPagination(root);

    const spacer = finalWrapper.previousElementSibling as HTMLElement | null;
    expect(spacer?.getAttribute('data-clean-simple-final-sections-spacer')).toBe('true');
    expect(Number.parseFloat(spacer?.style.height || '0')).toBeGreaterThan(0);
    expect(Number.parseFloat(finalWrapper.style.marginTop) || 0).toBe(0);
    const finalGroupDiagnostic = report.blocks.find(b => b.kind === 'final-section-group' && b.keepGroupId === 'skills-languages');
    expect(finalGroupDiagnostic).toBeDefined();
    expect(finalGroupDiagnostic?.top).toBeGreaterThanOrEqual(pageHeight);
    expect(finalGroupDiagnostic?.straddles).toBe(false);
    expect(finalGroupDiagnostic?.textPreview).toContain('SKILLS');
    expect(Number.parseFloat(skillsSection.style.marginTop) || 0).toBe(0);
    expect(Number.parseFloat(languagesSection.style.marginTop) || 0).toBe(0);
    expect(report.finalSections.moved).toBe(true);
    expect(report.finalSections.beforeTop).toBeCloseTo(pageHeight - 42);
    expect(report.finalSections.beforeBottom).toBeCloseTo(pageHeight + 114);
    expect(report.finalSections.afterTop).toBeGreaterThanOrEqual(pageHeight);
    expect(report.finalSections.fitsOnContinuationPage).toBe(true);
  });

  test('Clean Simple PDF export bakes continuation-page top padding into slice bitmaps', () => {
    const src = exportSource();
    expect(src).toContain('CLEAN_SIMPLE_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(src).toContain('CLEAN_SIMPLE_PDF_BUILD_CANARY');
    expect(src).toContain('planCleanSimplePdfSliceSegments');
    expect(src).toContain('buildPaddedPdfSlice');
    expect(src).toContain('getCleanSimplePdfExportBuildOptions');

    const buildOptions = getCleanSimplePdfExportBuildOptions();
    expect(buildOptions.forcedCaptureTemplateId).toBe('clean-simple');
    expect(buildOptions.continuationSliceInsets?.topInsetCssPx).toBe(34);
    expect(buildOptions.continuationSliceInsets?.bottomInsetCssPx).toBe(40);
    // V11: production build options must never embed a debug canary in real PDF output.
    expect(buildOptions.pdfBuildCanary).toBeUndefined();

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = 800;
    sourceCanvas.height = 1200;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (sourceCtx) {
      sourceCtx.fillStyle = '#ffffff';
      sourceCtx.fillRect(0, 0, 800, 1200);
      sourceCtx.fillStyle = '#111111';
      sourceCtx.fillRect(40, 200, 720, 18);
    }

    const padded = buildPaddedPdfSlice(sourceCanvas, 200, 400, 800, 34, 40);
    expect(padded.topInsetCanvasPx).toBe(34);
    expect(padded.bottomInsetCanvasPx).toBe(40);
    expect(padded.paddedHeightPx).toBe(474);
  });

  test('Clean Simple Android export route resolves to dedicated buildCleanSimplePdfBlob path', () => {
    expect(resolveCvPdfExportRoute('clean-simple')).toEqual({ kind: 'dedicated-clean-simple' });

    const page = pageSource();
    const branch = page.indexOf("resolveCvPdfExportRoute(liveCv.templateId).kind === 'dedicated-clean-simple'");
    const exportCall = page.indexOf('exportCleanSimplePdf', branch);
    const genericExport = page.indexOf('exportToPDF(previewId', branch);

    expect(branch).toBeGreaterThan(-1);
    expect(exportCall).toBeGreaterThan(branch);
    expect(exportCall).toBeLessThan(genericExport);
  });

  test('buildCleanSimplePdfBlob uses the dedicated page-aware jsPDF renderer, not the generic tall-canvas slice path', () => {
    const src = exportSource();
    const start = src.indexOf('export async function buildCleanSimplePdfBlob');
    const end = src.indexOf('export async function exportCleanSimplePdf', start);
    const block = src.slice(start, end);

    expect(src).toContain('export async function buildCleanSimplePagedPdfBlob');
    expect(block).toContain('buildCleanSimplePagedPdfBlob(cv, locale');
    expect(block).not.toContain('buildCvPdfBlob');
    expect(block).not.toContain('html2canvas');
    // V11: no pdfBuildCanary key at all in production build options — real Clean Simple
    // PDF exports must not embed any debug/build-tag metadata.
    expect(getCleanSimplePdfExportBuildOptions()).toEqual({
      forcedCaptureTemplateId: 'clean-simple',
      continuationSliceInsets: {
        topInsetCssPx: 34,
        bottomInsetCssPx: 40,
      },
    });
  });

  test('planCleanSimplePdfSliceSegments chooses a whitespace page break instead of mid-line cut', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 2400;
    const inkRows = new Set<number>();
    for (let y = 80; y < 2300; y += 24) {
      for (let row = y; row < y + 14; row += 1) inkRows.add(row);
    }
    Object.defineProperty(canvas, 'getContext', {
      value: vi.fn(() => ({
        fillStyle: '',
        fillRect: vi.fn(),
        getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
          const data = new Uint8ClampedArray(w * h * 4);
          data.fill(255);
          for (let row = 0; row < h; row += 1) {
            if (!inkRows.has(y + row)) continue;
            const index = row * w * 4;
            data[index] = 10;
            data[index + 1] = 10;
            data[index + 2] = 10;
            data[index + 3] = 255;
          }
          return { data };
        }),
      })),
      configurable: true,
    });

    const pageHeightPx = (297 / 210) * 800;
    const segments = planCleanSimplePdfSliceSegments(
      2400,
      pageHeightPx,
      0,
      canvas,
      64,
      736,
      8,
      96,
    );

    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments[0].endPx).toBeLessThan(pageHeightPx);
    expect(segments[0].endPx).toBeGreaterThan(pageHeightPx - 96);
  });

  test('planCleanSimplePdfSliceSegments accounts for baked top/bottom insets so no content is silently dropped', () => {
    // Regression for the V6 bug: segments were previously planned using the full
    // pageHeightPx, then the renderer independently re-capped each continuation slice
    // to (pageHeightPx - topInset) at render time — silently discarding whatever fell
    // in the gap between the planned break and the render-time cap (never shown on
    // that page *or* the next), which is exactly what looked like clipped/bleeding text
    // at the bottom of page 2. Segments must now already respect that reduced budget.
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 3600;
    Object.defineProperty(canvas, 'getContext', {
      value: vi.fn(() => ({
        fillStyle: '',
        fillRect: vi.fn(),
        // No safe whitespace row anywhere — forces every break to fall back to its
        // target position, which is the scenario most likely to clip content.
        getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let row = 0; row < h; row += 1) {
            const index = row * w * 4;
            data[index] = 10;
            data[index + 1] = 10;
            data[index + 2] = 10;
            data[index + 3] = 255;
          }
          return { data };
        }),
      })),
      configurable: true,
    });

    const pageHeightPx = (297 / 210) * 800;
    const topInsetCanvasPx = 42;
    const bottomInsetCanvasPx = 28;
    const segments = planCleanSimplePdfSliceSegments(
      3600,
      pageHeightPx,
      0,
      canvas,
      64,
      736,
      8,
      96,
      topInsetCanvasPx,
      bottomInsetCanvasPx,
    );

    expect(segments.length).toBeGreaterThanOrEqual(3);
    // No gaps and no overlaps: every canvas pixel row is assigned to exactly one page.
    expect(segments[0].startPx).toBe(0);
    for (let i = 1; i < segments.length; i += 1) {
      expect(segments[i].startPx).toBe(segments[i - 1].endPx);
    }
    expect(segments[segments.length - 1].endPx).toBe(3600);

    // Every non-final segment must already fit within the page's post-inset budget —
    // page 1 loses only the bottom inset, continuation pages lose top+bottom.
    for (let i = 0; i < segments.length - 1; i += 1) {
      const heightPx = segments[i].endPx - segments[i].startPx;
      const topPad = i === 0 ? 0 : topInsetCanvasPx;
      expect(heightPx).toBeLessThanOrEqual(pageHeightPx - topPad - bottomInsetCanvasPx + 0.5);
    }
  });

  describe('Clean Simple canvas-pixel-final page break slicing (V11)', () => {
    const lineHeightPx = 16;
    const linePeriodPx = 40;
    const guardPx = 8;

    function buildRootedInFixture() {
      const lineIntervals = Array.from({ length: 60 }, (_, k) => ({
        top: k * linePeriodPx,
        bottom: k * linePeriodPx + lineHeightPx,
      }));
      const inkRows = new Set<number>();
      lineIntervals.forEach(({ top, bottom }) => {
        for (let row = top; row < bottom; row += 1) inkRows.add(row);
      });

      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 2400;
      Object.defineProperty(canvas, 'getContext', {
        value: vi.fn(() => ({
          fillStyle: '',
          fillRect: vi.fn(),
          getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
            const data = new Uint8ClampedArray(w * h * 4);
            data.fill(255);
            for (let row = 0; row < h; row += 1) {
              if (!inkRows.has(y + row)) continue;
              const index = row * w * 4;
              data[index] = 10;
              data[index + 1] = 10;
              data[index + 2] = 10;
              data[index + 3] = 255;
            }
            return { data };
          }),
        })),
        configurable: true,
      });

      const pageHeightPx = 500;
      const line12Top = 12 * linePeriodPx;
      const line13Top = 13 * linePeriodPx;
      const sentenceSpans = [{ top: line12Top, bottom: line13Top + lineHeightPx }];
      const naiveBreakPx = line12Top + lineHeightPx + 4;
      return { canvas, lineIntervals, pageHeightPx, sentenceSpans, naiveBreakPx, line12Top, line13Top, guardPx };
    }

    test('resolveCleanSimpleLineAtomicBreakCanvasPx moves a break inside a line interval to whitespace before that line', () => {
      const lineIntervals = [
        { top: 440, bottom: 456 },
        { top: 480, bottom: 496 },
        { top: 520, bottom: 536 },
      ];
      const insideLineBreakPx = 488;
      expect(isCleanSimpleBreakInsideLineInterval(insideLineBreakPx, lineIntervals)?.top).toBe(480);

      const resolution = resolveCleanSimpleLineAtomicBreakCanvasPx(
        insideLineBreakPx,
        lineIntervals,
        8,
        64,
        100,
        520,
      );
      expect(resolution.applied).toBe(true);
      expect(resolution.intersectedLine?.top).toBe(480);
      expect(resolution.breakPx).toBeLessThan(480);
      expect(isCleanSimpleSegmentBoundaryLineSafe(resolution.breakPx, lineIntervals, 8)).toBe(true);
    });

    test('resolveCleanSimpleLineAtomicBreakCanvasPx snaps sentence.top to whitespace before the sentence line, not at line.top', () => {
      const { lineIntervals, line12Top } = buildRootedInFixture();
      const resolution = resolveCleanSimpleLineAtomicBreakCanvasPx(
        line12Top,
        lineIntervals,
        8,
        64,
        100,
        500,
      );
      expect(resolution.applied).toBe(true);
      expect(resolution.breakPx).toBeLessThan(line12Top);
      expect(isCleanSimpleSegmentBoundaryLineSafe(resolution.breakPx, lineIntervals, 8)).toBe(true);
    });

    test('planCleanSimplePdfSliceSegments never places a segment boundary inside a rendered line interval', () => {
      const { canvas, lineIntervals, pageHeightPx, sentenceSpans, guardPx } = buildRootedInFixture();
      const segments = planCleanSimplePdfSliceSegments(
        2400, pageHeightPx, 0, canvas, 64, 736, guardPx, 100, 34, 40, lineIntervals, true, 40, sentenceSpans, 6,
      );
      for (let i = 0; i < segments.length - 1; i += 1) {
        const boundaryPx = segments[i].endPx;
        expect(segments[i + 1].startPx).toBe(boundaryPx);
        expect(isCleanSimpleBreakInsideLineInterval(boundaryPx, lineIntervals)).toBeNull();
        expect(isCleanSimpleSegmentBoundaryLineSafe(boundaryPx, lineIntervals, guardPx)).toBe(true);
      }
    });

    test('regression: half-row split — pixel resolver keeps the boundary in late whitespace instead of moving sentence content too early', () => {
      const { canvas, lineIntervals, pageHeightPx, sentenceSpans, line12Top, guardPx } = buildRootedInFixture();
      const segments = planCleanSimplePdfSliceSegments(
        2400, pageHeightPx, 0, canvas, 64, 736, guardPx, 100, 0, 0, lineIntervals, true, 40, sentenceSpans, 6,
      );
      const pageBreakPx = segments[0].endPx;
      expect(pageBreakPx).toBeGreaterThan(line12Top + lineHeightPx);
      expect(pageBreakPx).toBeLessThanOrEqual(pageHeightPx + guardPx * 2);
      expect(isCleanSimpleSegmentBoundaryLineSafe(pageBreakPx, lineIntervals, guardPx)).toBe(true);
      const splitLine = lineIntervals.find(line => line.top === line12Top)!;
      expect(pageBreakPx).toBeGreaterThanOrEqual(splitLine.bottom + guardPx);
      expect(segments[1].startPx).toBe(pageBreakPx);
    });

    test('adjustCleanSimpleBreakForSentenceBoundary relocates the exact Rooted-in two-line split that V8 missed at the 50% height threshold', () => {
      const { lineIntervals, sentenceSpans, naiveBreakPx } = buildRootedInFixture();
      const adjustment = adjustCleanSimpleBreakForSentenceBoundary(
        naiveBreakPx,
        sentenceSpans,
        lineIntervals,
        110,
      );
      expect(adjustment.applied).toBe(true);
      expect(adjustment.breakPx).toBe(sentenceSpans[0].top);
      expect(adjustment.reason).toBe('line-prefix-split');
    });

    test('adjustCleanSimpleBreakForSentenceBoundary leaves a normal split alone once most of a long multi-line sentence already fits on the page', () => {
      const sentenceSpans = [{ top: 50, bottom: 900 }];
      const lineIntervals = Array.from({ length: 20 }, (_, i) => ({
        top: 50 + i * 40,
        bottom: 50 + i * 40 + 16,
      }));
      const breakPx = 800;
      const adjustment = adjustCleanSimpleBreakForSentenceBoundary(
        breakPx,
        sentenceSpans,
        lineIntervals,
        60,
      );
      expect(adjustment.applied).toBe(false);
      expect(adjustment.breakPx).toBe(800);
    });

    test('adjustCleanSimpleBreakForSentenceBoundary keeps the original break when relocating would leave too little on the page', () => {
      const sentenceSpans = [{ top: 50, bottom: 90 }];
      const lineIntervals = [
        { top: 50, bottom: 66 },
        { top: 80, bottom: 96 },
      ];
      const breakPx = 70;
      const adjustment = adjustCleanSimpleBreakForSentenceBoundary(
        breakPx,
        sentenceSpans,
        lineIntervals,
        600,
      );
      expect(adjustment.applied).toBe(false);
      expect(adjustment.reason).toBe('min-break-rejected');
    });

    test('adjustCleanSimpleBreakForSentenceBoundary is a no-op when the break already falls between sentences', () => {
      const sentenceSpans = [{ top: 600, bottom: 760 }, { top: 760, bottom: 900 }];
      const lineIntervals = [
        { top: 600, bottom: 616 },
        { top: 640, bottom: 656 },
        { top: 760, bottom: 776 },
        { top: 800, bottom: 816 },
      ];
      expect(adjustCleanSimpleBreakForSentenceBoundary(760, sentenceSpans, lineIntervals, 500).breakPx).toBe(760);
      expect(adjustCleanSimpleBreakForSentenceBoundary(1000, sentenceSpans, lineIntervals, 500).breakPx).toBe(1000);
    });

    test('planCleanSimplePdfSliceSegments ignores legacy sentence relocation and chooses the same late canvas-safe break', () => {
      const { canvas, lineIntervals, pageHeightPx, sentenceSpans, line12Top, guardPx } = buildRootedInFixture();
      const withoutSentenceGuard = planCleanSimplePdfSliceSegments(
        2400, pageHeightPx, 0, canvas, 64, 736, guardPx, 100, 0, 0, lineIntervals, true, 40,
      );
      expect(isCleanSimpleSegmentBoundaryLineSafe(withoutSentenceGuard[0].endPx, lineIntervals, guardPx)).toBe(true);
      expect(withoutSentenceGuard[0].endPx).toBeLessThanOrEqual(pageHeightPx + guardPx * 2);

      const withSentenceGuard = planCleanSimplePdfSliceSegments(
        2400, pageHeightPx, 0, canvas, 64, 736, guardPx, 100, 0, 0, lineIntervals, true, 40, sentenceSpans, 6,
      );
      expect(withSentenceGuard[0].endPx).toBeGreaterThan(line12Top + lineHeightPx);
      expect(withSentenceGuard[1].startPx).toBe(withSentenceGuard[0].endPx);
      expect(isCleanSimpleSegmentBoundaryLineSafe(withSentenceGuard[0].endPx, lineIntervals, guardPx)).toBe(true);
      expect(withSentenceGuard[0].endPx).toBe(withoutSentenceGuard[0].endPx);
    });

    test('planCleanSimplePdfSliceSegments chooses the latest safe whitespace band before the bottom margin, not an overly early band', () => {
      const canvas = createPixelBufferCanvas(800, 1400);
      const lineIntervals = [
        { top: 480, bottom: 496 },
        { top: 520, bottom: 536 },
        { top: 560, bottom: 576 },
      ];
      lineIntervals.forEach(line => paintCleanSimpleInkRow(canvas, line.top, line.bottom - line.top));
      const diagnostics: CleanSimplePdfSliceBreakDiagnostics[] = [];

      const segments = planCleanSimplePdfSliceSegments(
        1400,
        600,
        0,
        canvas,
        0,
        800,
        8,
        120,
        0,
        40,
        lineIntervals,
        true,
        40,
        [{ top: 480, bottom: 576 }],
        6,
        diagnostics,
      );

      expect(segments[0].endPx).toBeGreaterThan(536);
      expect(segments[0].endPx).toBeLessThan(560);
      expect(600 - segments[0].endPx).toBeLessThanOrEqual(64);
      expect(diagnostics[0].targetBreakPx).toBe(560);
      expect(diagnostics[0].sentenceRelocationApplied).toBe(false);
      expect(diagnostics[0].canvasWhitespaceFound).toBe(true);
    });

    test('applyCleanSimplePostLineBreakGuardCanvasPx delegates to line-atomic resolver', () => {
      const lineIntervals = [
        { top: 480, bottom: 496 },
        { top: 520, bottom: 536 },
      ];
      const result = applyCleanSimplePostLineBreakGuardCanvasPx(500, lineIntervals, 8, 520);
      expect(isCleanSimpleSegmentBoundaryLineSafe(result, lineIntervals, 8)).toBe(true);
    });

    test('buildPaddedPdfSlice re-clears continuation-page top padding after drawImage', () => {
      const src = exportSource();
      expect(src).toContain('forcibly re-clear the continuation-page top padding band after drawImage');
      expect(src).toContain('ctx.fillRect(0, 0, canvasWidthPx, safeTopInsetCanvasPx)');
    });

    test('planCleanSimplePdfSliceSegments produces contiguous non-overlapping line-safe segments', () => {
      const { canvas, lineIntervals, pageHeightPx, sentenceSpans, guardPx } = buildRootedInFixture();
      const segments = planCleanSimplePdfSliceSegments(
        2400, pageHeightPx, 0, canvas, 64, 736, guardPx, 100, 34, 40, lineIntervals, true, 40, sentenceSpans, 6,
      );
      expect(segments.length).toBeGreaterThanOrEqual(2);
      expect(segments[1].startPx).toBe(segments[0].endPx);
      expect(isCleanSimpleSegmentBoundaryLineSafe(segments[0].endPx, lineIntervals, guardPx)).toBe(true);
    });

    test('collectCleanSimpleSummarySentenceSpansCss measures one span per sentence via DOM Range, skipping single-sentence paragraphs', () => {
      const rectSpy = installRectMock();
      const charsPerLine = 30;
      const lineHeightPx = 12;
      const originalGetClientRects = Range.prototype.getClientRects;
      Range.prototype.getClientRects = function getClientRects(this: Range) {
        const start = this.startOffset;
        const end = this.endOffset;
        if (end <= start) return [] as unknown as DOMRectList;
        const startLine = Math.floor(start / charsPerLine);
        const endLine = Math.floor((end - 1) / charsPerLine);
        const rects: DOMRect[] = [];
        for (let line = startLine; line <= endLine; line += 1) {
          const top = line * lineHeightPx;
          rects.push({
            top, bottom: top + lineHeightPx - 2, left: 0, right: 200, width: 200, height: lineHeightPx - 2, x: 0, y: top,
            toJSON: () => ({}),
          } as DOMRect);
        }
        return rects as unknown as DOMRectList;
      };

      try {
        const root = document.createElement('div');
        root.setAttribute('data-test-rect', rectAttr(0, 0, 400, 400));
        document.body.appendChild(root);

        const singleSentence = document.createElement('p');
        singleSentence.setAttribute('data-clean-simple-summary-block', 'true');
        singleSentence.textContent = 'Just one sentence here with no split risk.';
        root.appendChild(singleSentence);

        const multiSentenceText = 'Rooted in a mathematics background, she designed backend systems for years. '
          + 'She later moved into engineering leadership roles.';
        const multiSentence = document.createElement('p');
        multiSentence.setAttribute('data-clean-simple-summary-block', 'true');
        multiSentence.textContent = multiSentenceText;
        root.appendChild(multiSentence);

        const expectedSentenceCount = splitCleanSimpleSummarySentenceRuns(multiSentenceText).length;
        expect(expectedSentenceCount).toBe(2);

        const spans = collectCleanSimpleSummarySentenceSpansCss(root);

        // The single-sentence paragraph contributes nothing (no internal split risk to
        // guard against); the multi-sentence paragraph contributes exactly one span per
        // sentence, in reading order (adjacent sentences may still share their boundary
        // line, since sentence 2 can start mid-line right after sentence 1 ends).
        expect(spans.length).toBe(expectedSentenceCount);
        spans.forEach((span) => {
          expect(span.bottomCssPx).toBeGreaterThan(span.topCssPx);
        });
        for (let i = 1; i < spans.length; i += 1) {
          expect(spans[i].topCssPx).toBeGreaterThanOrEqual(spans[i - 1].topCssPx);
        }
      } finally {
        rectSpy.mockRestore();
        Range.prototype.getClientRects = originalGetClientRects;
        document.body.innerHTML = '';
      }
    });

    test('findCleanSimpleCanvasWhitespaceBreak moves a candidate break through a row to the nearest real whitespace band, never inside the row', () => {
      const canvas = createPixelBufferCanvas(800, 1000);
      // A single text row from y=480..495 (16px tall). The naive nominal target lands
      // squarely inside it (y=488) — exactly the failure mode reported on real Android:
      // a DOM-measured "safe" break still cut through actual rendered ink.
      paintCleanSimpleInkRow(canvas, 480, 16);
      const nextRowTop = 520;
      paintCleanSimpleInkRow(canvas, nextRowTop, 16);

      const result = findCleanSimpleCanvasWhitespaceBreak(canvas, 488, {
        contentLeftPx: 0,
        contentRightPx: 800,
        minBreakPx: 100,
        maxBreakPx: 519,
        searchRangePx: 200,
        minBandHeightPx: 8,
      });

      expect(result.found).toBe(true);
      expect(result.breakPx).not.toBe(488);
      // Must land strictly between the two rows (in the 496..520 gap), never inside either.
      expect(result.breakPx).toBeGreaterThan(495);
      expect(result.breakPx).toBeLessThan(nextRowTop);
      expect(result.bandHeightPx).toBeGreaterThanOrEqual(8);

      // Verify directly against the real pixel buffer: no ink pixel at the chosen row.
      const ctx = canvas.getContext('2d')!;
      const row = ctx.getImageData(0, result.breakPx, canvas.width, 1).data;
      for (let i = 0; i < row.length; i += 4) {
        expect(row[i]).toBeGreaterThanOrEqual(250);
      }
    });

    test('findCleanSimpleCanvasWhitespaceBreak treats a single faint anti-aliased pixel as ink, not whitespace', () => {
      const canvas = createPixelBufferCanvas(800, 400);
      // Only ONE pixel in the row is non-white, and only faintly so (249 < the 250
      // near-white threshold) — simulating a lone anti-aliased glyph edge pixel that a
      // coarse sampled scan (e.g. a stride of every-Nth column) could easily step over.
      const ctx = canvas.getContext('2d') as unknown as { fillStyle: string; fillRect: (x: number, y: number, w: number, h: number) => void };
      ctx.fillStyle = 'rgb(249, 249, 249)';
      ctx.fillRect(400, 200, 1, 1);

      const result = findCleanSimpleCanvasWhitespaceBreak(canvas, 200, {
        contentLeftPx: 0,
        contentRightPx: 800,
        minBreakPx: 0,
        maxBreakPx: 399,
        searchRangePx: 200,
        minBandHeightPx: 8,
      });

      // The faint pixel's row must never be chosen as, or fall inside, the resolved band —
      // proving the single-pixel-wide anti-aliased row was correctly classified as ink.
      expect(result.breakPx).not.toBe(200);
      if (result.found) {
        const rowIsInsideBand = 200 >= result.bandStartPx && 200 <= result.bandEndPx;
        expect(rowIsInsideBand).toBe(false);
      }
    });

    test('findCleanSimpleCanvasWhitespaceBreak never drops or overlaps content: only blank rows are skipped between page 1 and page 2', () => {
      const canvas = createPixelBufferCanvas(800, 1200);
      const rowTops = [100, 300, 500, 700, 900];
      rowTops.forEach(top => paintCleanSimpleInkRow(canvas, top, 16));

      const target = 508; // inside the row starting at 500
      const result = findCleanSimpleCanvasWhitespaceBreak(canvas, target, {
        contentLeftPx: 0,
        contentRightPx: 800,
        minBreakPx: 320,
        maxBreakPx: 560,
        searchRangePx: 200,
        minBandHeightPx: 8,
      });

      expect(result.found).toBe(true);
      // The break must fall strictly between two known ink rows — content on both sides
      // of the cut is fully preserved on one page or the other, never truncated.
      expect(result.breakPx).toBeGreaterThan(316); // row at 300 ends at 316
      expect(result.breakPx).toBeLessThan(500); // next row starts at 500
    });

    test('regression: findCleanSimpleCanvasWhitespaceBreak never chooses a break that intersects actual canvas ink rows, across many candidate targets', () => {
      const canvas = createPixelBufferCanvas(800, 2000);
      const rowTops: number[] = [];
      for (let y = 40; y < 1960; y += 36) {
        rowTops.push(y);
        paintCleanSimpleInkRow(canvas, y, 14);
      }

      for (let target = 60; target < 1900; target += 17) {
        const result = findCleanSimpleCanvasWhitespaceBreak(canvas, target, {
          contentLeftPx: 0,
          contentRightPx: 800,
          minBreakPx: Math.max(0, target - 200),
          maxBreakPx: target + 20,
          searchRangePx: 200,
          minBandHeightPx: 6,
        });
        if (!result.found) continue;
        const insideAnyRow = rowTops.some(top => result.breakPx > top - 1 && result.breakPx < top + 14 + 1);
        expect(insideAnyRow).toBe(false);
      }
    });

    test('buildPaddedPdfSlice leaves the continuation-page top padding band pixel-perfect white even when source ink sits right at the slice seam', () => {
      const source = createPixelBufferCanvas(400, 600);
      // Ink row ends exactly 4px above the slice's offsetY (300) — the tightest possible
      // anti-aliasing-adjacent case for a seam that must never leak into page 2's padding.
      paintCleanSimpleInkRow(source, 296, 3);

      // Reproduce exactly what buildPaddedPdfSlice does internally (fillRect white,
      // drawImage the source slice, then re-clear the top padding band white), but on a
      // real pixel-buffer-backed canvas so the result can be verified pixel-by-pixel
      // instead of only asserting the function ran without throwing.
      const sliceCanvas = createPixelBufferCanvas(400, 234);
      const sliceCtx = sliceCanvas.getContext('2d')!;
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, 400, 234);
      sliceCtx.drawImage(source, 0, 300, 400, 200, 0, 34, 400, 200);
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, 400, 34);

      const topBand = sliceCtx.getImageData(0, 0, 400, 34).data;
      for (let i = 0; i < topBand.length; i += 4) {
        expect(topBand[i]).toBe(255);
        expect(topBand[i + 1]).toBe(255);
        expect(topBand[i + 2]).toBe(255);
      }
      expect(isCleanSimpleTopPaddingBandClean(sliceCanvas, 34)).toBe(true);

      // Sanity: buildPaddedPdfSlice itself (against the default mocked canvas context)
      // still runs and reports the same insets used above.
      const padded = buildPaddedPdfSlice(source, 300, 200, 400, 34, 0);
      expect(padded.topInsetCanvasPx).toBe(34);
      expect(padded.paddedHeightPx).toBe(234);
    });
  });

  describe('Clean Simple content-completeness — Skills/Languages tail preservation (V12)', () => {
    test('regression: findVisibleCanvasBottom can miss a sparse, isolated trailing content row that a dense earlier block hides from its coarse stride — findCleanSimpleCanvasContentBottomPx never does', () => {
      const canvas = createPixelBufferCanvas(800, 2400);
      // Dense "Skills" block: solid full-width ink for 50 rows — easily hit by any
      // sample stride, at any alignment.
      for (let y = 1200; y < 1250; y += 1) paintCleanSimpleInkRow(canvas, y, 1);
      // Sparse, isolated "Languages" row far below the Skills block, deliberately placed
      // off findVisibleCanvasBottom's sample grid. For an 800px-wide canvas its stride is
      // max(3, floor(800/100)) = 8, scanning from height-1=2399 downward (2399, 2391,
      // 2383, 2375, …) — none of those land on row 2382.
      paintCleanSimpleInkRow(canvas, 2382, 1);

      const coarseBottom = findVisibleCanvasBottom(canvas);
      const preciseBottom = findCleanSimpleCanvasContentBottomPx(canvas, 0, 800);

      // This is the exact V11→V12 regression: the coarse dual-stride scan steps clean
      // over the real last row of content and reports a bottom at the earlier, denser
      // Skills block instead — which is what let the pre-slice canvas crop permanently
      // discard everything below it (Languages included) on real Android captures.
      expect(coarseBottom).toBeLessThan(2382);
      // The full-resolution scanner backing the V12 planner fix always finds the true
      // last ink row, no matter how sparse or isolated it is.
      expect(preciseBottom).toBe(2383);
    });

    test('findCleanSimpleCanvasContentBottomPx returns 0 for a fully blank canvas and the exact row-past-last-ink otherwise', () => {
      const blank = createPixelBufferCanvas(400, 900);
      expect(findCleanSimpleCanvasContentBottomPx(blank, 0, 400)).toBe(0);

      const withInk = createPixelBufferCanvas(400, 900);
      paintCleanSimpleInkRow(withInk, 850, 3);
      expect(findCleanSimpleCanvasContentBottomPx(withInk, 0, 400)).toBe(853);
    });

    test('planCleanSimplePdfSliceSegments never drops real content sitting inside the flat trailing-tolerance band at the very bottom of the canvas', () => {
      const canvasHeightPx = 1200;
      const canvas = createPixelBufferCanvas(800, canvasHeightPx);
      for (let y = 40; y < 1000; y += 40) paintCleanSimpleInkRow(canvas, y, 14);
      // "Languages" row sitting only 10px above the canvas's true bottom edge — well
      // inside what a flat ~30px trailing tolerance would otherwise have swallowed
      // whole, silently excluding it from every planned segment.
      const languagesRowTop = canvasHeightPx - 10;
      const languagesRowBottom = canvasHeightPx - 2;
      paintCleanSimpleInkRow(canvas, languagesRowTop, 8);

      const trailingTolerancePx = 30; // representative canvas-px value of PDF_TRAILING_SLICE_TOLERANCE_MM
      const pageHeightPx = canvasHeightPx - 20; // just short of the full canvas height
      const segments = planCleanSimplePdfSliceSegments(
        canvasHeightPx, pageHeightPx, trailingTolerancePx, canvas, 0, 800, 8, 100,
      );

      expect(segments.length).toBeGreaterThanOrEqual(1);
      expect(segments[0].startPx).toBe(0);
      for (let i = 1; i < segments.length; i += 1) {
        expect(segments[i].startPx).toBe(segments[i - 1].endPx);
      }
      const lastSegment = segments[segments.length - 1];
      expect(lastSegment.endPx).toBeGreaterThanOrEqual(languagesRowBottom);
    });

    test('planCleanSimplePdfSliceSegments adds a third page instead of dropping tail content when it does not fit within two pages worth of budget', () => {
      const pageHeightPx = 700;
      const canvasHeightPx = 1550; // just over two pages (1400) worth of content
      const canvas = createPixelBufferCanvas(800, canvasHeightPx);
      for (let y = 20; y < canvasHeightPx - 40; y += 30) paintCleanSimpleInkRow(canvas, y, 12);
      // Tail content (e.g. the last Language row) sitting right at the very end, past
      // what fits on page 2's budget.
      const tailInkTop = canvasHeightPx - 10;
      paintCleanSimpleInkRow(canvas, tailInkTop, 6);

      const trailingTolerancePx = 30;
      const segments = planCleanSimplePdfSliceSegments(
        canvasHeightPx, pageHeightPx, trailingTolerancePx, canvas, 0, 800, 8, 100, 34, 40,
      );

      expect(segments.length).toBeGreaterThanOrEqual(3);
      expect(segments[segments.length - 1].endPx).toBeGreaterThanOrEqual(tailInkTop + 6);
      expect(segments[0].startPx).toBe(0);
      for (let i = 1; i < segments.length; i += 1) {
        expect(segments[i].startPx).toBe(segments[i - 1].endPx);
      }
    });

    test('createCleanSimplePdfTemplate marks every skill chip and language entry as data-export-meaningful, not just their section headings', () => {
      const testCv = cv({
        skills: [
          'Python', 'TypeScript', 'SQL / Databases', 'Node.js', 'REST APIs', 'Agile / Scrum',
          'JavaScript', 'React', 'Software Testing', 'Debugging', 'Teamwork',
          'Cloud Services (AWS/Azure/GCP)', 'Problem Solving',
        ],
        languages: [
          { name: 'English', level: 'Advanced' },
          { name: 'French', level: 'Intermediate' },
          { name: 'Italian', level: 'Native' },
        ],
      });
      const root = createCleanSimplePdfTemplate(testCv, { locale: 'en' });

      const skillChips = Array.from(root.querySelectorAll('[data-clean-simple-skill="item"]'));
      expect(skillChips).toHaveLength(13);
      skillChips.forEach((chip) => {
        expect(chip.getAttribute('data-export-meaningful')).toBe('true');
      });

      const languagesSection = root.querySelector('[data-clean-simple-section="languages"]');
      expect(languagesSection).not.toBeNull();
      const languageSpans = Array.from(languagesSection!.querySelectorAll('span[data-export-meaningful="true"]'));
      // One meaningful span per language entry — the "|" separators between them stay
      // plain, unmarked spans.
      expect(languageSpans).toHaveLength(3);
      expect(languageSpans.map(el => el.textContent)).toEqual([
        'English (Advanced)', 'French (Intermediate)', 'Italian (Native)',
      ]);
    });

    test('createCleanSimplePdfTemplate wraps Skills and Languages in one real final-sections container for atomic pagination', () => {
      const testCv = cv({
        skills: [
          'Python', 'TypeScript', 'SQL / Databases', 'Node.js', 'REST APIs', 'Agile / Scrum',
          'JavaScript', 'React', 'Software Testing', 'Debugging', 'Teamwork',
          'Cloud Services (AWS/Azure/GCP)', 'Problem Solving',
        ],
        languages: [
          { name: 'English', level: 'Advanced' },
          { name: 'French', level: 'Intermediate' },
          { name: 'Italian', level: 'Native' },
        ],
      });

      const root = createCleanSimplePdfTemplate(testCv, { locale: 'en' });
      const wrapper = root.querySelector('[data-clean-simple-final-sections="true"]');

      expect(wrapper).not.toBeNull();
      expect(wrapper?.getAttribute('data-export-meaningful')).toBe('true');
      expect(wrapper?.tagName).toBe('DIV');
      expect((wrapper as HTMLElement | null)?.style.display).toBe('block');
      expect((wrapper as HTMLElement | null)?.style.position).not.toBe('absolute');
      const skillsSection = wrapper!.querySelector('[data-clean-simple-section="skills"]');
      const languagesSection = wrapper!.querySelector('[data-clean-simple-section="languages"]');
      expect(skillsSection).not.toBeNull();
      expect(languagesSection).not.toBeNull();
      expect(wrapper!.textContent).toContain('SKILLS');
      expect(wrapper!.textContent).toContain('Problem Solving');
      expect(wrapper!.textContent).toContain('LANGUAGES');
      expect(wrapper!.textContent).toContain('Italian (Native)');
    });

    test('measureExportMeaningfulContentBounds now reaches all the way down to the last Language row, not just the LANGUAGES heading', () => {
      document.body.innerHTML = `
        <div data-test-rect="${rectAttr(0, 0, 800, 1200)}">
          <div data-export-meaningful="true" data-test-rect="${rectAttr(0, 40, 720, 30)}">Name</div>
          <section>
            <h2 data-export-meaningful="true" data-test-rect="${rectAttr(1000, 40, 720, 16)}">LANGUAGES</h2>
            <div>
              <span data-export-meaningful="true" data-test-rect="${rectAttr(1030, 40, 200, 14)}">English (Advanced)</span>
              <span data-export-meaningful="true" data-test-rect="${rectAttr(1050, 40, 200, 14)}">Italian (Native)</span>
            </div>
          </section>
        </div>
      `;
      installRectMock();
      const root = document.querySelector('[data-test-rect]') as HTMLElement;

      const bounds = measureExportMeaningfulContentBounds(root);

      expect(bounds).not.toBeNull();
      // Before this fix, only the heading carried the marker, so maxBottomCssPx stopped
      // at 1016 (the heading's own bottom) — the real language rows beneath it were
      // invisible to the semantic content-bottom measurement.
      expect(bounds!.maxBottomCssPx).toBeGreaterThanOrEqual(1064);
    });

    test('Clean Simple export wires semantic content-bounds measurement so the pre-slice canvas crop can never trim below Skills/Languages, and semantic trimming can never drop a page holding them', () => {
      const src = exportSource();
      const oncloneStart = src.indexOf('onclone:');
      const cleanSimpleBlockStart = src.indexOf("if (captureTemplateId === 'clean-simple') {", oncloneStart);
      expect(cleanSimpleBlockStart).toBeGreaterThan(oncloneStart);
      const cleanSimpleBlock = src.slice(cleanSimpleBlockStart, cleanSimpleBlockStart + 1200);
      expect(cleanSimpleBlock).toContain('measureExportMeaningfulContentBounds(cloneRoot)');
      expect(cleanSimpleBlock).toContain('expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds)');

      const shouldUseFullSemanticCanvasDecl = src.slice(
        src.indexOf('const shouldUseFullSemanticCanvas ='),
        src.indexOf('\n', src.indexOf('const shouldUseFullSemanticCanvas =')),
      );
      expect(shouldUseFullSemanticCanvasDecl).toContain("captureTemplateId === 'clean-simple'");
    });

    test('V12: full Clean Simple export pipeline never drops a planned page once real semantic content bounds exist, and the final page reaches the true content bottom', async () => {
      const pageHeightCanvasPx = (297 / 210) * 800;
      const totalHeight = Math.round(pageHeightCanvasPx * 1.85);
      const skillsHeadingTop = totalHeight - 140;
      const languagesHeadingTop = totalHeight - 60;
      const languagesRowTop = totalHeight - 30;
      const languagesRowBottom = totalHeight - 16;

      document.body.innerHTML = `
        <div id="cv-preview">
          <div data-template-id="clean-simple" data-test-rect="${rectAttr(0, 0, 800, totalHeight)}">
            <div data-export-meaningful="true" data-test-rect="${rectAttr(0, 40, 400, 40)}">Mila Petrovic</div>
            <p data-export-meaningful="true" data-test-rect="${rectAttr(60, 40, 720, skillsHeadingTop - 80)}">Filler experience content spanning most of the document.</p>
            <h2 data-export-meaningful="true" data-test-rect="${rectAttr(skillsHeadingTop, 40, 200, 16)}">SKILLS</h2>
            <span data-export-meaningful="true" data-test-rect="${rectAttr(skillsHeadingTop + 20, 40, 200, 14)}">Python</span>
            <h2 data-export-meaningful="true" data-test-rect="${rectAttr(languagesHeadingTop, 40, 200, 16)}">LANGUAGES</h2>
            <span data-export-meaningful="true" data-test-rect="${rectAttr(languagesRowTop, 40, 200, 14)}">Italian (Native)</span>
          </div>
        </div>
      `;
      installRectMock();

      const canvas = makeCanvas(800, totalHeight, (y) => (
        (y >= 0 && y <= 40)
        || (y >= 60 && y <= skillsHeadingTop - 20)
        || (y >= skillsHeadingTop && y <= skillsHeadingTop + 34)
        || (y >= languagesHeadingTop && y <= languagesRowBottom)
      ));
      const { instances } = installPdfMocks(canvas);

      await buildCvPdfBlob('cv-preview', getCleanSimplePdfExportBuildOptions());

      expect(instances).toHaveLength(1);
      const report = (window as unknown as {
        __cleanSimplePdfPaginationReport?: { segments: Array<{ startPx: number; endPx: number }> };
      }).__cleanSimplePdfPaginationReport;
      expect(report).toBeDefined();
      expect(report!.segments.length).toBeGreaterThanOrEqual(2);
      // Every planned segment must actually have been rendered onto the PDF — none
      // silently dropped by the blank-page heuristic now that real semantic content
      // bounds exist for Clean Simple.
      expect(instances[0].addImage).toHaveBeenCalledTimes(report!.segments.length);
      const lastSegment = report!.segments[report!.segments.length - 1];
      expect(lastSegment.endPx).toBeGreaterThanOrEqual(languagesRowBottom);
    });
  });

  test('buildCleanSimplePdfBlob wiring resolves capture template id as clean-simple', () => {
    const root = createCleanSimplePdfTemplate(draganCv(), { locale: 'en', photoDataUrl: originalPhoto });
    const container = document.createElement('div');
    container.id = 'clean-simple-capture-id-test';
    container.setAttribute('data-clean-simple-pdf-export-container', 'true');
    container.setAttribute('data-template-id', 'clean-simple');
    container.setAttribute('data-export-template', 'clean-simple');
    container.appendChild(root);
    document.body.appendChild(container);

    expect(resolveCvPdfCaptureTemplateId(container)).toBe('clean-simple');
    expect(resolveCvPdfCaptureTemplateId(container, { forcedCaptureTemplateId: 'clean-simple' })).toBe('clean-simple');

    root.removeAttribute('data-template-id');
    expect(resolveCvPdfCaptureTemplateId(container)).toBe('clean-simple');
    expect(resolveCvPdfCaptureTemplateId(container, { forcedCaptureTemplateId: 'clean-simple' })).toBe('clean-simple');

    container.removeAttribute('data-template-id');
    container.removeAttribute('data-export-template');
    expect(resolveCvPdfCaptureTemplateId(container)).toBeNull();
    expect(resolveCvPdfCaptureTemplateId(container, { forcedCaptureTemplateId: 'clean-simple' })).toBe('clean-simple');
  });

  test('Clean Simple direct PDF renderer bypasses html2canvas/tall bitmap slicing at runtime', async () => {
    const canvas = makeCanvas(800, 2600, () => true);
    const { instances: directInstances, html2canvasMock } = installPdfMocks(canvas);

    await buildCleanSimplePdfBlob(draganCv(), 'en');

    expect(directInstances).toHaveLength(1);
    expect(html2canvasMock).not.toHaveBeenCalled();
    expect(directInstances[0].drawnText.join('\n')).toContain('WORK EXPERIENCE');
  });

  test('V11: Clean Simple production export embeds no debug canary / build-tag metadata in the generated PDF blob', async () => {
    const canvas = makeCanvas(800, 2000, () => true);
    const { instances } = installPdfMocks(canvas);

    const blob = await buildCleanSimplePdfBlob(draganCv(), 'en');

    expect(instances[0]?.metadataKeywords).toBe('');
    const pdfText = await readPdfBlobAsLatin1Text(blob);
    expect(pdfText).not.toContain(CLEAN_SIMPLE_PDF_BUILD_CANARY);
    expect(pdfText).not.toContain('CLEAN_SIMPLE_LINE_ATOMIC_V10');
    expect(pdfText).not.toMatch(/CLEAN_SIMPLE_[A-Z0-9_]*V\d+/);
  });

  test('explicit continuation slice options prevent renderPdfSlice fallthrough without DOM markers', async () => {
    const runMarkerlessExport = async (buildOptions?: ReturnType<typeof getCleanSimplePdfExportBuildOptions>) => {
      const container = document.createElement('div');
      container.id = `clean-simple-markerless-${Math.random().toString(36).slice(2)}`;
      const inner = document.createElement('div');
      inner.style.width = '800px';
      inner.style.height = '2000px';
      inner.textContent = 'Markerless Clean Simple export fixture';
      container.appendChild(inner);
      document.body.appendChild(container);

      const canvas = makeCanvas(800, 2000, () => true);
      const { instances } = installPdfMocks(canvas);
      await buildCvPdfBlob(container.id, buildOptions ?? {});
      container.remove();
      return instances[0];
    };

    const unpaddedPdf = await runMarkerlessExport();
    const paddedPdf = await runMarkerlessExport(getCleanSimplePdfExportBuildOptions());

    expect(unpaddedPdf.pages).toBeGreaterThanOrEqual(2);
    expect(paddedPdf.pages).toBeGreaterThanOrEqual(2);

    const unpaddedPage2Y = Number(unpaddedPdf.addImage.mock.calls[1][3]);
    const unpaddedPage2HeightMm = Number(unpaddedPdf.addImage.mock.calls[1][5]);
    const paddedPage2Y = Number(paddedPdf.addImage.mock.calls[1][3]);
    const paddedPage2HeightMm = Number(paddedPdf.addImage.mock.calls[1][5]);
    const expectedTopPadMm = (34 / 800) * 210;

    expect(unpaddedPage2Y).toBe(0);
    expect(paddedPage2Y).toBe(0);
    expect(paddedPage2HeightMm).toBeGreaterThan(unpaddedPage2HeightMm);
    expect(paddedPage2HeightMm - unpaddedPage2HeightMm).toBeGreaterThanOrEqual(expectedTopPadMm - 1);
  });

  test('dedicated Clean Simple PDF root is fixed A4, uses real text nodes, and keeps text spacing intact', () => {
    const root = createCleanSimplePdfTemplate(draganCv(), { locale: 'en', photoDataUrl: originalPhoto });
    const photoFrame = root.querySelector('[data-clean-simple-photo="frame"]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="clean-simple"]') as HTMLImageElement;
    const contactRow = root.querySelector('[data-clean-simple-contact-row]') as HTMLElement;
    const dates = Array.from(root.querySelectorAll<HTMLElement>('div')).filter(el => el.textContent?.includes('2020-01 - 2025-02'));
    const text = root.textContent ?? '';

    expect(root.dataset.templateId).toBe('clean-simple');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minWidth).toBe('210mm');
    expect(photoFrame.style.width).toBe('80px');
    expect(photoFrame.style.height).toBe('80px');
    expect(photoFrame.style.borderRadius).toBe('9999px');
    expect(photoFrame.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(root.style.wordSpacing).toBe('0.6px');
    expect(root.style.letterSpacing).toBe('0px');
    expect(contactRow.textContent).toContain('Braće Abafi 4');
    expect(dates.some(el => el.style.whiteSpace === 'nowrap')).toBe(true);

    expect(text).toContain('Učitelj u osnovnoj školi');
    expect(text).toContain('Nastavnik geografije');
    expect(text).toContain('at Hfh');
    expect(text).toContain('Metematički fakultet');
    expect(text).not.toContain('osnovnojškoli');
    expect(text).not.toContain('Nastavnikgeografije');
    expect(text).not.toContain('Nastavnikgeografijeat');
    expect(text).not.toContain('Metematičkifakultet');

    // Skills must never break mid-word — every skill item is a single nowrap span.
    const skillItems = Array.from(root.querySelectorAll<HTMLElement>('[data-clean-simple-skill="item"]'));
    expect(skillItems.map(el => el.textContent)).toEqual(['Teamwork', 'Organization', 'Coaching', 'Coaching', 'Leadership', 'Creativity']);
    skillItems.forEach((el) => expect(el.style.whiteSpace).toBe('nowrap'));
    expect(text).not.toContain('Teamwor k');
    expect(text).not.toContain('Creativit y');
    expect(text).not.toContain('Coachin g');

    // Bold single-line fields (position "at" company, education degree) use the
    // safe flex+gap word rendering, not a single fragile text-node run.
    const safeWordContainers = Array.from(root.querySelectorAll<HTMLElement>('[data-clean-simple-safe-words]'));
    expect(safeWordContainers.length).toBeGreaterThanOrEqual(3); // 2 experience titles + 1 education degree
    safeWordContainers.forEach((container) => {
      expect(container.style.display).toBe('flex');
      expect(container.style.flexWrap).toBe('wrap');
    });
    const secondPosition = safeWordContainers.find(el => el.textContent === 'Nastavnik geografije at Hfh');
    expect(secondPosition).toBeDefined();
  });

  test('Clean Simple direct PDF Blob is non-empty, uses the user-framed selected photo (matching DOCX), and the Dragan fixture remains one page', async () => {
    const canvas = makeCanvas(800, 1050, y => y < 980);
    const { instances } = installPdfMocks(canvas);

    const blob = await buildCleanSimplePdfBlob(draganCv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
    expect(loadedImageSources).toContain(selectedPhoto);
    expect(loadedImageSources).not.toContain(originalPhoto);

    const pdfText = instances[0].drawnText.join('\n');
    expect(pdfText).toContain('Učitelj u osnovnoj školi');
    expect(pdfText).toContain('Nastavnik geografije at Hfh');
    expect(pdfText).toContain('Metematički fakultet');
    expect(pdfText).not.toContain('osnovnojškoli');
    expect(pdfText).not.toContain('Nastavnikgeografije');
    expect(pdfText).not.toContain('Nastavnikgeografijeat');
    expect(pdfText).not.toContain('Metematičkifakultet');
    expect(pdfText).not.toContain('Teamwor k');
    expect(pdfText).not.toContain('Creativit y');
    expect(pdfText).not.toContain('Coachin g');
  });

  test('Clean Simple PDF falls back to originalPhoto only when no selected photo exists', async () => {
    const canvas = makeCanvas(800, 1050, y => y < 980);
    installPdfMocks(canvas);
    const cvWithoutSelectedPhoto = draganCv();
    (cvWithoutSelectedPhoto.personal as CVData['personal'] & { photo?: string }).photo = undefined;

    const blob = await buildCleanSimplePdfBlob(cvWithoutSelectedPhoto, 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain(selectedPhoto);
  });

  test('Clean Simple PDF export paginates long content without appending a blank trailing page', async () => {
    const canvas = makeCanvas(800, 2600, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCleanSimplePdfBlob(draganCv(), 'en');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBeGreaterThanOrEqual(1);
  });

  test('Clean Simple direct PDF renderer preserves all final Skills/Languages and never starts their page with orphan skill items', async () => {
    const longCv = cv({
      summary: Array.from({ length: 20 }, (_, index) => `Summary sentence ${index + 1} describes reliable delivery and careful coordination.`).join(' '),
      experience: [
        {
          id: 'exp-long-1',
          company: 'Acme Platforms',
          position: 'Software Engineer',
          startDate: '2021-01',
          endDate: '',
          isPresent: true,
          description: [
            '- Built APIs and internal tooling for delivery teams.',
            '- Improved release quality through testing, debugging, and clear documentation.',
            '- Collaborated with product and support teams on operational fixes.',
          ].join('\n'),
        },
        {
          id: 'exp-long-2',
          company: 'Beta Systems',
          position: 'Junior Developer',
          startDate: '2019-01',
          endDate: '2020-12',
          isPresent: false,
          description: '- Maintained web applications and fixed production issues.',
        },
      ],
      education: [
        { id: 'edu-long', school: 'University of Belgrade', degree: 'BSc Computer Science', startDate: '2015', endDate: '2019', description: '' },
      ],
      skills: [
        'Python',
        'TypeScript',
        'SQL / Databases',
        'Node.js',
        'REST APIs',
        'Agile / Scrum',
        'JavaScript',
        'React',
        'Software Testing',
        'Debugging',
        'Teamwork',
        'Cloud Services (AWS/Azure/GCP)',
        'Problem Solving',
      ],
      languages: [
        { name: 'English', level: 'Advanced' },
        { name: 'French', level: 'Intermediate' },
        { name: 'Italian', level: 'Native' },
      ],
      certifications: [],
    });
    const { instances } = installPdfMocks(makeCanvas(800, 2600, () => true));

    await buildCleanSimplePdfBlob(longCv, 'en');

    const pdf = instances[0];
    const text = pdf.drawnText.join('\n');
    const normalizedText = text.replace(/\s+/g, ' ');
    [
      'Python',
      'TypeScript',
      'SQL / Databases',
      'Node.js',
      'REST APIs',
      'Agile / Scrum',
      'JavaScript',
      'React',
      'Software Testing',
      'Debugging',
      'Teamwork',
      'Cloud Services (AWS/Azure/GCP)',
      'Problem Solving',
      'English (Advanced)',
      'French (Intermediate)',
      'Italian (Native)',
    ].forEach(item => expect(normalizedText).toContain(item));

    const skillsHeadingRun = pdf.drawnRuns.find(run => run.text === 'SKILLS');
    const teamworkRun = pdf.drawnRuns.find(run => run.text.includes('Teamwork'));
    const cloudRun = pdf.drawnRuns.find(run => run.text.includes('Cloud Services'));
    const languagesHeadingRun = pdf.drawnRuns.find(run => run.text === 'LANGUAGES');
    expect(skillsHeadingRun).toBeDefined();
    expect(teamworkRun?.page).toBe(skillsHeadingRun?.page);
    expect(cloudRun?.page).toBe(skillsHeadingRun?.page);
    expect(languagesHeadingRun?.page).toBe(skillsHeadingRun?.page);
  });

  test('Clean Simple direct PDF keeps Work Experience heading with the first entry lead block', async () => {
    const longCv = cv({
      summary: Array.from({ length: 18 }, (_, index) => `Summary sentence ${index + 1} with enough detail to wrap across multiple pages.`).join(' '),
      experience: [
        {
          id: 'exp-lead',
          company: 'Acme Platforms',
          position: 'Software Engineer',
          startDate: '2021-01',
          endDate: '',
          isPresent: true,
          description: [
            '- Built APIs and internal tooling for delivery teams.',
            '- Improved release quality through testing, debugging, and clear documentation.',
            '- Collaborated with product and support teams on operational fixes.',
          ].join('\n'),
        },
      ],
      education: [{ id: 'edu-lead', school: 'University of Belgrade', degree: 'BSc Computer Science', startDate: '2015', endDate: '2019', description: '' }],
      skills: ['Python', 'TypeScript'],
      languages: [{ name: 'English', level: 'Advanced' }],
    });
    const { instances } = installPdfMocks(makeCanvas(800, 2600, () => true));
    await buildCleanSimplePdfBlob(longCv, 'en');
    const pdf = instances[0];
    const experienceHeading = pdf.drawnRuns.find(run => run.text === 'WORK EXPERIENCE');
    const firstTitle = pdf.drawnRuns.find(run => run.text.includes('Software Engineer at Acme Platforms'));
    const firstBullet = pdf.drawnRuns.find(run => run.text.includes('Built APIs and internal tooling'));
    expect(experienceHeading).toBeDefined();
    expect(firstTitle?.page).toBe(experienceHeading?.page);
    expect(firstBullet?.page).toBe(experienceHeading?.page);
  });

  test('Clean Simple direct PDF keeps Education heading with the education row', async () => {
    const longCv = cv({
      summary: Array.from({ length: 18 }, (_, index) => `Summary sentence ${index + 1} with enough detail to wrap across multiple pages.`).join(' '),
      experience: [
        {
          id: 'exp-edu',
          company: 'Acme Platforms',
          position: 'Software Engineer',
          startDate: '2021-01',
          endDate: '',
          isPresent: true,
          description: '- Built APIs and internal tooling for delivery teams.',
        },
      ],
      education: [{ id: 'edu-row', school: 'University of Belgrade', degree: 'BSc Computer Science', startDate: '2015', endDate: '2019', description: '' }],
      skills: ['Python', 'TypeScript', 'SQL / Databases', 'Node.js', 'REST APIs', 'Agile / Scrum', 'JavaScript', 'React', 'Software Testing', 'Debugging', 'Teamwork', 'Cloud Services (AWS/Azure/GCP)', 'Problem Solving'],
      languages: [{ name: 'English', level: 'Advanced' }, { name: 'French', level: 'Intermediate' }, { name: 'Italian', level: 'Native' }],
    });
    const { instances } = installPdfMocks(makeCanvas(800, 2600, () => true));
    await buildCleanSimplePdfBlob(longCv, 'en');
    const pdf = instances[0];
    const educationHeading = pdf.drawnRuns.find(run => run.text === 'EDUCATION');
    const degreeRow = pdf.drawnRuns.find(run => run.text.includes('BSc Computer Science'));
    const schoolRow = pdf.drawnRuns.find(run => run.text.includes('University of Belgrade'));
    expect(educationHeading).toBeDefined();
    expect(degreeRow?.page).toBe(educationHeading?.page);
    expect(schoolRow?.page).toBe(educationHeading?.page);
  });

  test('Clean Simple direct PDF paginates long Summary without clipping or losing text', async () => {
    const sentences = Array.from({ length: 24 }, (_, index) => `Summary sentence ${index + 1} describes reliable delivery and careful coordination.`);
    const longCv = cv({ summary: sentences.join(' ') });
    const { instances } = installPdfMocks(makeCanvas(800, 2600, () => true));
    await buildCleanSimplePdfBlob(longCv, 'en');
    const pdfText = instances[0].drawnText.join(' ').replace(/\s+/g, ' ');
    sentences.forEach(sentence => expect(pdfText).toContain(sentence.replace(/\s+/g, ' ')));
  });

  test('Clean Simple export save path writes a PDF through platform save', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    installPdfMocks(canvas);
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/clean-simple-pdf';
    });
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    const result = await exportCleanSimplePdf(draganCv(), 'Dragan Obradovic - CV', 'en');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob?.type).toBe('application/pdf');
    expect(result.fileName).toBe('Dragan Obradovic - CV.pdf');
    expect(result.sourceBytes).toBeGreaterThan(0);
  });

  test('Clean Simple DOCX uses a dedicated layout before generic single fallback', () => {
    const src = exportSource();
    const cleanConfig = src.indexOf('customLayout: \'clean-simple\'');
    const cleanBranch = src.indexOf('cfg.customLayout === \'clean-simple\'');
    const genericSingle = src.indexOf('cfg.layout === \'single\'');
    const modernBranch = src.indexOf("else if (cfg.customLayout === 'modern-minimal')", cleanBranch);
    const branch = src.slice(cleanBranch, modernBranch);

    expect(cleanConfig).toBeGreaterThan(0);
    expect(cleanBranch).toBeGreaterThan(0);
    expect(cleanBranch).toBeLessThan(genericSingle);
    expect(branch).toContain('Clean Simple DOCX mirrors the live preview');
    expect(branch).toContain('ImageRun');
    expect(branch).toContain('contacts.join(\'  |  \')');
    expect(branch).toContain('getLocalizedCvSkillName');
    expect(branch).toContain('bidirectional: isRTL');
  });

  test('Clean Simple DOCX reuses the PDF-validated photo selection/crop with a larger circular photo box', async () => {
    const src = exportSource();
    expect(src).toContain("const directCleanSimplePhoto = cfg.customLayout === 'clean-simple'");
    expect(src).toContain('await prepareCleanSimplePdfPhotoDataUrl(cvData)');
    expect(src).toContain("photoShape: 'circle', photoSize: 84");
    expect(src).toContain('} else if (directCleanSimplePhoto) {');
    // The dedicated PDF renderer/route must remain completely untouched by this fix.
    expect(src).toContain("export async function exportCleanSimplePdf");
    expect(src).toContain('export async function buildCleanSimplePdfBlob');

    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/clean-simple-docx-photo';
    });
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = vi.fn();
      return el;
    });

    await exportToDOCX(draganCv(), 'clean-simple-dragan-docx-photo-test', 'en', 'clean-simple');

    expect(savedBlob).toBeDefined();
    // Same selected/cropped photo priority as the PDF: prefer cv.personal.photo,
    // never fall back to originalPhoto when a selected photo already exists.
    expect(loadedImageSources).toContain(selectedPhoto);
    expect(loadedImageSources).not.toContain(originalPhoto);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
    expect(documentXml).toContain('Dragan Obradović');
  });

  test('Clean Simple DOCX falls back to originalPhoto only when no selected photo exists', async () => {
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/clean-simple-docx-fallback';
    });
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = vi.fn();
      return el;
    });
    const cvWithoutSelectedPhoto = draganCv();
    (cvWithoutSelectedPhoto.personal as CVData['personal'] & { photo?: string }).photo = undefined;

    await exportToDOCX(cvWithoutSelectedPhoto, 'clean-simple-dragan-docx-fallback-test', 'en', 'clean-simple');

    expect(savedBlob).toBeDefined();
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain(selectedPhoto);
  });

  test('Clean Simple DOCX with photo contains non-empty body text, media, and relationship', async () => {
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/docx';
    });
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    await exportToDOCX(cv(), 'clean-simple-photo-test', 'en', 'clean-simple');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const contentTypes = await zip.file('[Content_Types].xml')!.async('text');
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(contentTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml');
    expect(documentXml).toContain('Mila Petrovic');
    expect(documentXml).toContain('Operations Coordinator');
    expect(documentXml).toContain('Northwind Logistics');
    expect(documentXml).toContain('Teamwork');
    expect(documentXml).toContain('<w:drawing>');
    expect(relsXml).toContain('image');
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  test('Clean Simple DOCX without photo remains valid and non-empty', async () => {
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/docx';
    });
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = vi.fn();
      return el;
    });

    await exportToDOCX(cv({ personal: { photo: undefined, photoEnabled: false } }), 'clean-simple-no-photo-test', 'en', 'clean-simple');

    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Mila Petrovic');
    expect(documentXml).toContain('Organized coordinator');
    expect(documentXml).toContain('Teamwork');
    expect(mediaFiles).toHaveLength(0);
  });

  test('other template component routing remains unchanged', () => {
    expect(Object.keys(templateComponents)).toEqual([
      'modern-minimal',
      'creative-bold',
      'creative-artistic',
      'elegant-formal',
      'clean-simple',
      'professional-classic',
      'ats-standard',
      'executive-premium',
      'nordic-clean',
      'tech-sidebar',
      'corporate-navy',
      'modern-minimal-executive',
      'contemporary-bold',
      'rirekisho',
    ]);
  });
});
