/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { TechSidebarTemplate, templateComponents } from '@/components/cv-templates';
import { createTechSidebarPdfTemplate } from '@/lib/tech-sidebar-pdf-template';
import {
  buildPaddedPdfSlice,
  buildTechSidebarPdfBlob,
  collectTechSidebarMainColumnTextLineIntervalsCss,
  exportTechSidebarPdf,
  exportToDOCX,
  extractTechSidebarMainColumnInkLineIntervalsFromCanvas,
  findSafeElegantFormalPageBreakCanvasPx,
  getTechSidebarMainColumnContentBoundsCss,
  isUnsafeElegantFormalPageBreakCanvasPx,
  planTechSidebarPdfSliceSegments,
  resolveCvPdfExportRoute,
  resolveTechSidebarSafePageBreakCanvasPx,
  scaleTechSidebarMainColumnBoundsToCanvas,
  selectTechSidebarPdfLineIntervalsCanvas,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const originalPhoto = `data:image/jpeg;base64,${Buffer.from('tech-sidebar-original-photo').toString('base64')}`;
const squarePhoto = `data:image/jpeg;base64,${Buffer.from('tech-sidebar-square-photo').toString('base64')}`;
let loadedImageSources: string[] = [];
let drawImageCalls: unknown[][] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'tech-sidebar-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradovic',
      email: 'dragan@example.com',
      phone: '+381 60 123 456',
      address: 'Brace Abafi 4',
      jobTitle: 'Senior Software Engineer',
      photo: originalPhoto,
      originalPhoto,
      rectangularPhoto: undefined,
      circularPhoto: 'data:image/png;base64,circular-photo',
      photoEnabled: true,
    },
    summary: 'Experienced engineer with a record of building reliable products and mentoring high-performing teams.',
    experience: [
      {
        id: 'exp1',
        company: 'Platform Labs',
        position: 'Senior Software Engineer',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: '- Built deployment tooling for quarterly planning discipline.\n- Improved CRM pipeline hygiene through tighter forecasting.',
      },
      {
        id: 'exp2',
        company: 'Studio Nine',
        position: 'Frontend Engineer',
        startDate: '2018-04',
        endDate: '2020-12',
        isPresent: false,
        description: '- Shipped accessible interfaces for enterprise dashboards.',
      },
    ],
    education: [
      { id: 'edu1', school: 'University of Belgrade', degree: 'BSc Computer Science', startDate: '2013-10', endDate: '2017-06', description: '' },
    ],
    skills: ['React', 'TypeScript', 'System Design', 'Leadership'],
    certifications: [],
    languages: [{ name: 'English', level: 'Native' }, { name: 'Serbian', level: 'Native' }],
    templateId: 'tech-sidebar',
    region: 'Balkan',
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = vi.fn().mockResolvedValue(undefined);
  naturalWidth = 400;
  naturalHeight = 800;
  complete = true;
  private currentSrc = '';

  get src() {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    loadedImageSources.push(value);
    setTimeout(() => this.onload?.(), 0);
  }
}

function makeCanvas(width: number, height: number, hasContentAt: (absoluteY: number) => boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      data.fill(255);
      for (let row = 0; row < h; row += 1) {
        if (!hasContentAt(y + row)) continue;
        const index = row * w * 4;
        data[index] = 15;
        data[index + 1] = 23;
        data[index + 2] = 42;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,tech-sidebar-pdf'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const capturedPhotoSrcs: string[] = [];
  const html2canvasMock = vi.fn(async (target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    const photo = target.querySelector('[data-export-photo="tech-sidebar"]') as HTMLImageElement | null;
    if (photo) capturedPhotoSrcs.push(photo.getAttribute('src') ?? photo.src);
    if (options?.onclone) {
      const clonedDocument = document.implementation.createHTMLDocument('clone');
      clonedDocument.body.innerHTML = document.body.innerHTML;
      options.onclone(clonedDocument);
    }
    return canvas;
  });

  vi.doMock('html2canvas', () => ({ default: html2canvasMock }));
  vi.doMock('jspdf', () => ({
    jsPDF: class MockPdf {
      pages = 1;
      addImage = vi.fn();
      addPage = vi.fn(() => {
        this.pages += 1;
      });

      constructor() {
        instances.push(this);
      }

      output() {
        return new Blob(['%PDF-1.7\ntech-sidebar\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances, capturedPhotoSrcs };
}

type DirectPdfInstance = {
  pages: number;
  drawnText: string[];
  addImage: ReturnType<typeof vi.fn>;
  addPage: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
};

function installDirectPdfMocks() {
  const instances: DirectPdfInstance[] = [];
  vi.doMock('jspdf', () => ({
    jsPDF: class MockPdf {
      pages = 1;
      drawnText: string[] = [];
      addImage = vi.fn();
      addPage = vi.fn(() => { this.pages += 1; });
      setFont = vi.fn();
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      setFillColor = vi.fn();
      setDrawColor = vi.fn();
      setLineWidth = vi.fn();
      rect = vi.fn();
      line = vi.fn();
      circle = vi.fn();
      text = vi.fn((t: string | string[]) => {
        const parts = Array.isArray(t) ? t : [t];
        this.drawnText.push(...parts);
      });
      splitTextToSize = vi.fn((text: string, maxWidth: number): string[] => {
        if (!text || typeof text !== 'string') return [];
        const approxChars = Math.max(8, Math.floor(maxWidth / 2.5));
        const words = text.split(/\s+/).filter(Boolean);
        if (!words.length) return [text];
        const lines: string[] = [];
        let current = '';
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (candidate.length > approxChars && current) {
            lines.push(current);
            current = word;
          } else {
            current = candidate;
          }
        }
        if (current) lines.push(current);
        return lines.length ? lines : [text];
      });
      getTextWidth = vi.fn((text: string) => Math.min(text.length * 1.8, 40));
      output() {
        return new Blob(['%PDF-1.7\ntech-sidebar-direct\n%%EOF'], { type: 'application/pdf' });
      }
      constructor() { instances.push(this as unknown as DirectPdfInstance); }
    },
  }));
  return { instances };
}

function longStressCv(): CVData {
  return {
    ...cv(),
    summary: Array.from({ length: 40 }, (_, i) =>
      `Sentence ${i + 1}: reliable engineering delivery across distributed systems and product teams.`,
    ).join(' '),
    experience: [
      {
        id: 'exp-1',
        company: 'Platform Labs',
        position: 'Senior Software Engineer',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: Array.from({ length: 18 }, (_, i) =>
          `- Achievement ${i + 1}: delivered measurable impact across deployment, QA, and release work.`,
        ).join('\n'),
      },
      {
        id: 'exp-2',
        company: 'Pixel & Co',
        position: 'Software Tester',
        startDate: '2015-03',
        endDate: '2017-12',
        isPresent: false,
        description: [
          '- Designed visual identities for 50+ brands across Europe, North America, and Asia Pacific.',
          '- Produced motion graphics for broadcast TV and digital channels including RAI, Sky, and BBC.',
          '- Collaborated with product teams on UX/UI improvements for e-commerce and mobile platforms.',
          '- Managed vendor relationships and production timelines for multiple concurrent projects.',
          '- Mentored junior designers in brand strategy fundamentals and professional communication.',
          '- Conducted client workshops and strategic presentations while reporting findings to the development team.',
        ].join('\n'),
      },
    ],
    education: [{
      id: 'edu-1',
      school: 'Mathematic school',
      degree: 'VI',
      startDate: '2020-01',
      endDate: '2025-01',
      description: '',
    }],
    skills: ['React', 'TypeScript', 'System Design', 'Leadership', 'Cloud Services (AWS/Azure/GCP)'],
    languages: [{ name: 'English', level: 'Native' }, { name: 'Serbian', level: 'Fluent' }],
  };
}

async function captureDocx(data: CVData): Promise<{ documentXml: string; text: string }> {
  const blobByUrl = new Map<string, Blob>();
  let capturedBlob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:http://tech-sidebar/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });

  await exportToDOCX(data, 'tech-sidebar-docx-test', 'en', 'tech-sidebar');
  expect(capturedBlob).not.toBeNull();
  const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const text = documentXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return { documentXml, text };
}

function source(file: string): string {
  return fs.readFileSync(path.resolve(file), 'utf8');
}

beforeEach(() => {
  vi.restoreAllMocks();
  loadedImageSources = [];
  drawImageCalls = [];
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn((...args: unknown[]) => {
        drawImageCalls.push(args);
      }),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => squarePhoto),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'requestAnimationFrame', { value: (cb: FrameRequestCallback) => setTimeout(cb, 0), configurable: true });
  Object.defineProperty(document, 'fonts', {
    value: { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() },
    configurable: true,
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.doUnmock('html2canvas');
  vi.doUnmock('jspdf');
  vi.restoreAllMocks();
});

describe('Tech Sidebar export', () => {
  test('template id resolves to Tech Sidebar with a stable marker', () => {
    const html = renderToStaticMarkup(<TechSidebarTemplate data={cv()} locale="en" />);

    expect(templateComponents['tech-sidebar']).toBe(TechSidebarTemplate);
    expect(html).toContain('data-template-id="tech-sidebar"');
  });

  test('dedicated PDF renderer has Tech Sidebar structure and emits Skills once', () => {
    const root = createTechSidebarPdfTemplate(cv(), { locale: 'en', photoDataUrl: originalPhoto });
    const frame = root.querySelector('[data-export-photo-frame="tech-sidebar"]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="tech-sidebar"]') as HTMLImageElement;

    expect(root.dataset.templateId).toBe('tech-sidebar');
    expect(root.style.width).toBe('210mm');
    expect(root.style.gridTemplateColumns).toBe('64mm 1fr');
    expect(root.querySelector('[data-tech-sidebar-pdf-sidebar]')).not.toBeNull();
    expect(root.querySelector('[data-tech-sidebar-pdf-main]')).not.toBeNull();
    expect(frame.style.width).toBe('88px');
    expect(frame.style.height).toBe('88px');
    expect(frame.style.borderRadius).toBe('50%');
    expect(frame.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(photo.style.objectPosition).toBe('center center');
    expect(root.querySelectorAll('[data-tech-sidebar-skills="sidebar"]')).toHaveLength(1);
    expect(root.textContent).toContain('Leadership');
    expect(root.textContent).toContain('University of Belgrade');
  });

  test('Tech Sidebar production PDF route is direct and print fallback is disabled', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const branch = pageSource.indexOf("liveCv.templateId === 'tech-sidebar'");
    const guard = pageSource.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = pageSource.indexOf('await openPrintFallback', guard);

    expect(branch).toBeGreaterThan(-1);
    expect(pageSource.slice(branch, branch + 500)).toContain('exportTechSidebarPdf');
    expect(pageSource.slice(branch, branch + 500)).toContain('cvRef.current');
    expect(guard).toBeGreaterThan(branch);
    expect(fallback).toBeGreaterThan(guard);
    expect(pageSource.slice(guard, fallback)).toContain("cv.templateId === 'tech-sidebar'");
  });

  test('tech-sidebar resolves to the dedicated-tech-sidebar export route', () => {
    expect(resolveCvPdfExportRoute('tech-sidebar').kind).toBe('dedicated-tech-sidebar');
  });

  test('Tech Sidebar dedicated PDF uses direct jsPDF renderer, not canvas slicing', () => {
    const exportSource = source('src/lib/export.ts');
    const rendererSource = source('src/lib/tech-sidebar-pdf-renderer.ts');
    expect(exportSource).toContain('buildTechSidebarPagedPdfBlob');
    expect(exportSource).toContain("kind: 'dedicated-tech-sidebar'");
    expect(rendererSource).toContain('tsCreateContext');
    expect(rendererSource).toContain('tsDrawPageOneSidebar');
    expect(rendererSource).toContain('tsDrawContinuationSidebar');
    expect(rendererSource).not.toContain('html2canvas');
    expect(rendererSource).not.toContain('buildCvPdfBlob');
    expect(rendererSource).not.toContain('renderPdfSlice');
    expect(rendererSource).not.toContain('renderPaddedPdfSlice');
  });

  test('Tech Sidebar PDF Blob is non-empty and short fixture remains one page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildTechSidebarPdfBlob(cv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
    const drawn = instances[0].drawnText.join(' ');
    expect(drawn).toContain('Dragan Obradovic');
    expect(drawn).toContain('React');
    expect(drawn).toContain('PROFESSIONAL SUMMARY');
  });

  test('Tech Sidebar long direct PDF export paginates without ghost fragments or orphaned tails', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildTechSidebarPagedPdfBlob(longStressCv(), 'en', { photoDataUrl: squarePhoto });
    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0]?.pages).toBeGreaterThanOrEqual(2);
    expect(instances[0]?.pages).toBeLessThanOrEqual(3);

    const drawn = instances[0]?.drawnText ?? [];
    const text = drawn.join(' ');
    const count = (needle: string) => {
      let total = 0;
      let pos = 0;
      while (true) {
        const idx = text.indexOf(needle, pos);
        if (idx === -1) break;
        total += 1;
        pos = idx + needle.length;
      }
      return total;
    };

    expect(count('PROFESSIONAL SUMMARY')).toBe(1);
    expect(count('Sentence 1:')).toBe(1);
    expect(count('WORK EXPERIENCE')).toBe(1);
    expect(count('Designed visual identities for 50+ brands')).toBe(1);
    expect(text).toContain('reporting findings to the development team.');
    expect(text).not.toContain('lead.Assisted');
    expect(text).toContain('Mathematic school');
    expect(text).toContain('EDUCATION');
    expect(text).toContain('CONTINUED');
    if ((instances[0]?.pages ?? 0) >= 3) {
      expect(text).toContain('Software Tester (continued)');
    }
    expect(instances[0]?.rect).toHaveBeenCalled();
  });

  test('Tech Sidebar sidebar page 1 includes skills and languages in direct PDF output', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildTechSidebarPdfBlob(cv(), 'en');
    const drawn = instances[0]?.drawnText.join(' ') ?? '';
    expect(drawn).toContain('SKILLS');
    expect(drawn).toContain('LANGUAGES');
    expect(drawn).toContain('React');
    expect(drawn).toContain('English');
  });

  test('legacy Tech Sidebar padded slice helpers remain available for generic preview path', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('TECH_SIDEBAR_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(exportSource).toContain('TECH_SIDEBAR_PDF_PAGE_BOTTOM_INSET_CSS_PX');
    expect(exportSource).toContain('buildPaddedPdfSlice');
    expect(exportSource).toContain("captureTemplateId === 'tech-sidebar'");
    expect(exportSource).toContain('renderPaddedPdfSlice');

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

    const padded = buildPaddedPdfSlice(sourceCanvas, 200, 400, 800, 28, 28);
    expect(padded.topInsetCanvasPx).toBe(28);
    expect(padded.bottomInsetCanvasPx).toBe(28);
    expect(padded.paddedHeightPx).toBe(456);
  });

  test('Tech Sidebar safe page breaks scan only the main column and avoid slicing through text lines', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('planTechSidebarPdfSliceSegments');
    expect(exportSource).toContain('collectTechSidebarMainColumnTextLineIntervalsCss');
    expect(exportSource).toContain('extractTechSidebarMainColumnInkLineIntervalsFromCanvas');
    expect(exportSource).toContain('selectTechSidebarPdfLineIntervalsCanvas');
    expect(exportSource).toContain('resolveTechSidebarSafePageBreakCanvasPx');
    expect(exportSource).toContain('scaleTechSidebarMainColumnBoundsToCanvas');
    expect(exportSource).toContain('data-ts-pdf-break-sources');

    const fallbackMainLeft = Math.floor(800 * (64 / 210));
    const explicitBounds = { leftCssPx: fallbackMainLeft + 2, rightCssPx: 780 };
    const canvasBounds = scaleTechSidebarMainColumnBoundsToCanvas(explicitBounds, 800, 794);
    expect(canvasBounds.contentLeftPx).toBeGreaterThanOrEqual(fallbackMainLeft);
    expect(canvasBounds.contentRightPx).toBeGreaterThan(canvasBounds.contentLeftPx);

    const intervals = [
      { top: 1080, bottom: 1102 },
      { top: 1106, bottom: 1128 },
    ];
    expect(isUnsafeElegantFormalPageBreakCanvasPx(1095, intervals, 16)).toBe(true);
    expect(findSafeElegantFormalPageBreakCanvasPx(intervals, 1131, 16, 48)).toBeLessThan(1131);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1400;
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4);
        data.fill(255);
        for (let row = 0; row < h; row += 1) {
          const absoluteY = y + row;
          const isInkRow = absoluteY >= 1080 && absoluteY < 1098
            || absoluteY >= 1104 && absoluteY < 1122
            || absoluteY >= 1128 && absoluteY < 1146;
          if (!isInkRow) continue;
          for (let x = 0; x < w; x += 1) {
            const index = (row * w + x) * 4;
            data[index] = 17;
            data[index + 1] = 24;
            data[index + 2] = 39;
            data[index + 3] = 255;
          }
        }
        return { data };
      }),
    };
    Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });

    const resolution = resolveTechSidebarSafePageBreakCanvasPx(
      canvas,
      [{ top: 1080, bottom: 1146 }],
      false,
      1131,
      28,
      48,
      96,
      0,
      canvasBounds.contentLeftPx,
      canvasBounds.contentRightPx,
    );

    expect(resolution.source).toBe('canvas');
    expect(resolution.breakPx).toBeLessThan(1131);
    expect(resolution.breakPx).toBeGreaterThan(1102);

    const inkIntervals = extractTechSidebarMainColumnInkLineIntervalsFromCanvas(
      canvas,
      canvasBounds.contentLeftPx,
      canvasBounds.contentRightPx,
    );
    expect(inkIntervals.length).toBeGreaterThan(0);
    const intervalSelection = selectTechSidebarPdfLineIntervalsCanvas(
      [{ top: 1080, bottom: 1146 }],
      false,
      inkIntervals,
    );
    expect(intervalSelection.source).toBe('canvas');
    expect(intervalSelection.reliable).toBe(true);
    expect(intervalSelection.intervals?.length).toBeGreaterThan(0);

    const segments = planTechSidebarPdfSliceSegments(
      1400,
      1123,
      0,
      canvas,
      intervalSelection.intervals,
      intervalSelection.reliable,
      28,
      48,
      96,
      canvasBounds.contentLeftPx,
      canvasBounds.contentRightPx,
      [],
    );
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].endPx).toBeLessThan(1123);
  });

  test('Tech Sidebar direct export uses shared native/platform save result', async () => {
    installDirectPdfMocks();
    let clickedDownload = '';
    const blobByUrl = new Map<string, Blob>();
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:http://tech/${blobByUrl.size}`;
      blobByUrl.set(url, blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });

    const result = await exportTechSidebarPdf(cv(), 'Dragan - CV', 'en');

    expect(clickedDownload).toBe('Dragan - CV.pdf');
    expect(result.result).toBe('saved');
    expect(result.fileName).toBe('Dragan - CV.pdf');
  });

  test('selected originalPhoto is used and square cover crop is proportional', async () => {
    installDirectPdfMocks();

    await buildTechSidebarPdfBlob(cv({
      personal: {
        originalPhoto,
        photo: 'data:image/jpeg;base64,photo-field',
        circularPhoto: 'data:image/png;base64,circular-field',
      },
    }), 'en');

    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain('circular-field');
    expect(drawImageCalls.length).toBeGreaterThan(0);
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(-82);
    expect(scaledWidth).toBe(164);
    expect(scaledHeight).toBe(328);
  });

  test('Tech Sidebar no-photo PDF renders without a placeholder', () => {
    const root = createTechSidebarPdfTemplate(cv({ personal: { photo: '', originalPhoto: '', photoEnabled: false } }), {
      locale: 'en',
      photoDataUrl: null,
    });

    expect(root.querySelector('[data-export-photo-frame="tech-sidebar"]')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Dragan Obradovic');
  });

  test('Tech Sidebar DOCX branch keeps Skills in sidebar only and preserves Education', async () => {
    const { documentXml, text } = await captureDocx(cv({ personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined } }));

    expect(text).toContain('University of Belgrade');
    expect(text).toContain('React');
    expect((text.match(/\bLeadership\b/g) ?? [])).toHaveLength(1);
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('w:type="page"');
  });

  test('Tech Sidebar source keeps DOCX scope narrow and removes duplicate main Skills path', () => {
    const exportSource = source('src/lib/export.ts');
    const branchStart = exportSource.indexOf("cfg.customLayout === 'tech-sidebar'");
    const branchEnd = exportSource.indexOf('// ════ LAYOUT: sidebar-left', branchStart);
    const branch = exportSource.slice(branchStart, branchEnd);

    expect(exportSource).toContain("customLayout: 'tech-sidebar'");
    expect(exportSource).toContain('sidebarPct: 30');
    expect(branch).toContain('const hasSkillsOrLangs = false');
    expect(branch).toContain('leftRuns.slice(0, 1)');
    expect(branch).toContain('exp.company');
    expect(branch).not.toContain('pageBreakBefore');
    expect(branch).not.toContain('<w:br w:type="page"');
  });

  test('long Tech Sidebar content is not forced into a compressed one-page DOCX path', async () => {
    const longDescription = Array.from({ length: 24 }, (_, index) => `- Delivered milestone ${index + 1} without hidden content.`).join('\n');

    const { documentXml, text } = await captureDocx(cv({
      personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined },
      experience: [
        ...cv().experience,
        { id: 'exp-long', company: 'Long Systems', position: 'Lead Engineer', startDate: '2015-01', endDate: '2018-01', isPresent: false, description: longDescription },
      ],
    }));

    expect(text).toContain('Delivered milestone 24 without hidden content.');
    expect(text).toContain('Long Systems');
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('w:vanish');
  });
});
