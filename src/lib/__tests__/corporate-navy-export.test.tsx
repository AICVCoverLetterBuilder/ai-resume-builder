/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorporateNavyTemplate, templateComponents } from '@/components/cv-templates';
import { createCorporateNavyPdfTemplate } from '@/lib/corporate-navy-pdf-template';
import {
  buildCorporateNavyPdfBlob,
  createCorporateNavyCircularDocxPhotoDataUrl,
  exportCorporateNavyPdf,
  exportToDOCX,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const originalPhoto = `data:image/jpeg;base64,${Buffer.from('corporate-navy-original-photo').toString('base64')}`;
const squarePhoto = `data:image/jpeg;base64,${Buffer.from('corporate-navy-square-photo').toString('base64')}`;
const transparentCirclePhoto = `data:image/png;base64,${Buffer.from('corporate-navy-transparent-circle-photo').toString('base64')}`;
let loadedImageSources: string[] = [];
let drawImageCalls: unknown[][] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'corporate-navy-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradovic',
      email: 'dragan@example.com',
      phone: '+381 60 123 456',
      address: 'Brace Abafi 4',
      jobTitle: 'Education Lead',
      photo: originalPhoto,
      originalPhoto,
      rectangularPhoto: undefined,
      circularPhoto: 'data:image/png;base64,circular-photo',
      photoEnabled: true,
    },
    summary: 'Experienced educator with a record of building high-performance teams and planning lessons across Serbian language and mathematics.',
    experience: [
      {
        id: 'exp1',
        company: 'Primary School ZHFF',
        position: 'Primary School Teacher',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: '- Planned teaching units for Serbian language and mathematics.\n- Adapted instruction for different knowledge levels.',
      },
      {
        id: 'exp2',
        company: 'HFH',
        position: 'Geography Teacher',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: '- Prepared quarterly teaching plans and assessment cycles.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Mathematics Faculty', degree: 'VI stepen', startDate: '2020-01', endDate: '2025-02', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Time Management', 'Creativity', 'Presentation Skills', 'Coaching', 'Leadership'],
    certifications: [],
    languages: [{ name: 'English', level: 'Intermediate' }, { name: 'Serbian', level: 'Native' }],
    templateId: 'corporate-navy',
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
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,corporate-navy-pdf'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const capturedPhotoSrcs: string[] = [];
  const html2canvasMock = vi.fn(async (target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    const photo = target.querySelector('[data-export-photo="corporate-navy"]') as HTMLImageElement | null;
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
        return new Blob(['%PDF-1.7\ncorporate-navy\n%%EOF'], { type: 'application/pdf' });
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
    const url = `blob:http://corporate-navy/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });

  await exportToDOCX(data, 'corporate-navy-docx-test', 'en', 'corporate-navy');
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

describe('Corporate Navy export', () => {
  test('template id resolves to Corporate Navy with a stable marker', () => {
    const html = renderToStaticMarkup(<CorporateNavyTemplate data={cv()} locale="en" />);

    expect(templateComponents['corporate-navy']).toBe(CorporateNavyTemplate);
    expect(html).toContain('data-template-id="corporate-navy"');
  });

  test('dedicated PDF renderer has compact navy header, left info, right circular photo, and bottom columns', () => {
    const root = createCorporateNavyPdfTemplate(cv(), { locale: 'en', photoDataUrl: originalPhoto });
    const frame = root.querySelector('[data-export-photo-frame="corporate-navy"]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="corporate-navy"]') as HTMLImageElement;

    expect(root.dataset.templateId).toBe('corporate-navy');
    expect(root.style.width).toBe('210mm');
    expect(root.querySelector('[data-corporate-navy-pdf-header]')).not.toBeNull();
    expect(root.querySelector('[data-corporate-navy-header-info]')).not.toBeNull();
    expect(root.querySelector('[data-corporate-navy-header-row]')).not.toBeNull();
    expect(root.querySelector('[data-corporate-navy-accent-rule]')).not.toBeNull();
    expect(frame.style.width).toBe('82px');
    expect(frame.style.height).toBe('82px');
    expect(frame.style.borderRadius).toBe('50%');
    expect(frame.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(photo.style.objectPosition).toBe('center center');
    expect(root.querySelector('[data-corporate-navy-bottom-columns]')).not.toBeNull();
    expect(root.textContent).toContain('Leadership');
    expect(root.textContent).toContain('Mathematics Faculty');
  });

  test('Corporate Navy production PDF route is direct and print fallback is disabled', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const handler = pageSource.slice(pageSource.indexOf('const handlePDFDownload'));
    const branch = handler.indexOf("liveCv.templateId === 'corporate-navy'");
    const guard = handler.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = handler.indexOf('await openPrintFallback', guard);

    expect(branch).toBeGreaterThan(-1);
    expect(handler.slice(branch, branch + 500)).toContain('exportCorporateNavyPdf');
    expect(handler.slice(branch, branch + 500)).toContain('cvRef.current');
    expect(guard).toBeGreaterThan(branch);
    expect(fallback).toBeGreaterThan(guard);
    expect(handler.slice(guard, fallback)).toContain("cv.templateId === 'corporate-navy'");
  });

  test('Corporate Navy PDF Blob is non-empty and short fixture remains one page', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    const { html2canvasMock, instances } = installPdfMocks(canvas);

    const blob = await buildCorporateNavyPdfBlob(cv(), 'en');

    expect(html2canvasMock).toHaveBeenCalled();
    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
  });

  test('Corporate Navy direct export uses shared native/platform save result', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    installPdfMocks(canvas);
    let clickedDownload = '';
    const blobByUrl = new Map<string, Blob>();
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:http://corporate/${blobByUrl.size}`;
      blobByUrl.set(url, blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });

    const result = await exportCorporateNavyPdf(cv(), 'Dragan - CV', 'en');

    expect(clickedDownload).toBe('Dragan - CV.pdf');
    expect(result.result).toBe('saved');
    expect(result.fileName).toBe('Dragan - CV.pdf');
  });

  test('selected originalPhoto is used and square cover crop is proportional', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    const { capturedPhotoSrcs } = installPdfMocks(canvas);

    await buildCorporateNavyPdfBlob(cv({
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

  test('Corporate Navy no-photo PDF renders without placeholder', () => {
    const root = createCorporateNavyPdfTemplate(cv({ personal: { photo: '', originalPhoto: '', photoEnabled: false } }), {
      locale: 'en',
      photoDataUrl: null,
    });

    expect(root.querySelector('[data-export-photo-frame="corporate-navy"]')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Dragan Obradovic');
  });

  test('Corporate Navy DOCX photo helper creates a transparent PNG circle with proportional center crop', async () => {
    const operations: string[] = [];
    let compositeMode = 'source-over';
    const ctx = {
      clearRect: vi.fn(() => operations.push('clearRect')),
      save: vi.fn(() => operations.push('save')),
      beginPath: vi.fn(() => operations.push('beginPath')),
      arc: vi.fn(() => operations.push('arc')),
      closePath: vi.fn(() => operations.push('closePath')),
      clip: vi.fn(() => operations.push('clip')),
      drawImage: vi.fn((...args: unknown[]) => {
        operations.push('drawImage');
        drawImageCalls.push(args);
      }),
      restore: vi.fn(() => operations.push('restore')),
      fill: vi.fn(() => operations.push('fill')),
      fillStyle: '',
      get globalCompositeOperation() {
        return compositeMode;
      },
      set globalCompositeOperation(value: string) {
        compositeMode = value;
        operations.push(`globalCompositeOperation:${value}`);
      },
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: vi.fn(() => ctx), configurable: true });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: vi.fn((type: string) => {
        expect(type).toBe('image/png');
        return transparentCirclePhoto;
      }),
      configurable: true,
    });

    const result = await createCorporateNavyCircularDocxPhotoDataUrl(originalPhoto, 512);

    expect(result).toBe(transparentCirclePhoto);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(ctx.arc).toHaveBeenCalledWith(256, 256, 256, 0, Math.PI * 2);
    expect(operations).toContain('clip');
    expect(operations).toContain('globalCompositeOperation:destination-in');
    expect(operations).toContain('fill');
    expect(operations).toContain('globalCompositeOperation:source-over');
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(-256);
    expect(scaledWidth).toBe(512);
    expect(scaledHeight).toBe(1024);
  });

  test('Corporate Navy DOCX branch preserves Education and emits Skills exactly once', async () => {
    const { documentXml, text } = await captureDocx(cv({ personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined } }));

    expect(text).toContain('Mathematics Faculty');
    expect(text).toContain('Teamwork | Organization');
    expect((text.match(/\bLeadership\b/g) ?? [])).toHaveLength(1);
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('w:type="page"');
  });

  test('Corporate Navy DOCX branch is scoped and uses compact left-text/right-photo header', () => {
    const exportSource = source('src/lib/export.ts');
    const pageSource = source('src/app/cv-builder/page.tsx');
    const branchStart = exportSource.indexOf("cfg.customLayout === 'corporate-navy'");
    const legacyStart = exportSource.indexOf("false && cfg.customLayout === 'corporate-navy'", branchStart);
    const branch = exportSource.slice(branchStart, legacyStart);
    const docxHandlerBranchStart = pageSource.indexOf("liveCv.templateId === 'corporate-navy'");
    const docxHandlerBranch = pageSource.slice(docxHandlerBranchStart, docxHandlerBranchStart + 260);

    expect(exportSource).toContain("customLayout: 'corporate-navy'");
    expect(branch).toContain('cnHeaderTextChildren');
    expect(branch).toContain('cnHeaderCells.push');
    expect(branch).toContain('transformation: { width: 76, height: 76 }');
    expect(branch).toContain('createCorporateNavyCircularDocxPhotoDataUrl(rawPhotoDataUrl, 512)');
    expect(branch).toContain("photoType = cfg.customLayout === 'corporate-navy'");
    expect(branch).toContain('margins: { top: 4, bottom: 4, left: 0, right: 0 }');
    expect(branch).toContain("cnSkills.join('  |  ')");
    expect(branch).not.toContain('alignment: AlignmentType.CENTER, children: [new ImageRun');
    expect(branch).not.toContain('pageBreakBefore');
    expect(docxHandlerBranch.indexOf('originalPhoto')).toBeGreaterThan(-1);
    expect(docxHandlerBranch.indexOf('originalPhoto')).toBeLessThan(docxHandlerBranch.indexOf('circularPhotoDataUrl'));
  });

  test('long Corporate Navy content is not forced into a compressed one-page DOCX path', async () => {
    const longDescription = Array.from({ length: 24 }, (_, index) => `- Delivered corporate milestone ${index + 1} without hidden content.`).join('\n');

    const { documentXml, text } = await captureDocx(cv({
      personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined },
      experience: [
        ...cv().experience,
        { id: 'exp-long', company: 'Long Systems', position: 'Operations Lead', startDate: '2015-01', endDate: '2018-01', isPresent: false, description: longDescription },
      ],
    }));

    expect(text).toContain('Delivered corporate milestone 24 without hidden content.');
    expect(text).toContain('Long Systems');
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('w:vanish');
  });
});
