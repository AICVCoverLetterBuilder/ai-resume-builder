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
  buildTechSidebarPdfBlob,
  exportTechSidebarPdf,
  exportToDOCX,
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

  test('Tech Sidebar PDF Blob is non-empty and short fixture remains one page', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    const { html2canvasMock, instances } = installPdfMocks(canvas);

    const blob = await buildTechSidebarPdfBlob(cv(), 'en');

    expect(html2canvasMock).toHaveBeenCalled();
    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
  });

  test('Tech Sidebar direct export uses shared native/platform save result', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    installPdfMocks(canvas);
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
    const canvas = makeCanvas(800, 1000, () => true);
    const { capturedPhotoSrcs } = installPdfMocks(canvas);

    await buildTechSidebarPdfBlob(cv({
      personal: {
        originalPhoto,
        photo: 'data:image/jpeg;base64,photo-field',
        circularPhoto: 'data:image/png;base64,circular-field',
      },
    }), 'en');

    expect(loadedImageSources).toContain(originalPhoto);
    expect(capturedPhotoSrcs).toContain(squarePhoto);
    expect(capturedPhotoSrcs[0]).not.toContain('circular-field');
    expect(capturedPhotoSrcs[0]).not.toContain('photo-field');
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
