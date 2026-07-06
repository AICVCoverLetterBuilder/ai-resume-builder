/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { templateComponents } from '@/components/cv-templates';
import { createContemporaryBoldPdfTemplate } from '@/lib/contemporary-bold-pdf-template';
import {
  applyContemporaryBoldKeepTogetherPagination,
  buildContemporaryBoldPdfBlob,
  exportContemporaryBoldPdf,
  exportToDOCX,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const originalPhoto = `data:image/jpeg;base64,${Buffer.from('contemporary-bold-original-photo').toString('base64')}`;
const squarePhoto = `data:image/jpeg;base64,${Buffer.from('contemporary-bold-square-photo').toString('base64')}`;
const transparentCirclePhoto = `data:image/png;base64,${Buffer.from('contemporary-bold-transparent-circle-photo').toString('base64')}`;
let loadedImageSources: string[] = [];
let drawImageCalls: unknown[][] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'contemporary-bold-test',
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
    templateId: 'contemporary-bold',
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
  width = 400;
  height = 800;
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

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'getContext', {
    value: vi.fn(() => ({
      drawImage: vi.fn((...args: unknown[]) => drawImageCalls.push(args)),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4);
        data.fill(255);
        data[0] = 15;
        data[1] = 23;
        data[2] = 42;
        data[3] = 255;
        return { data };
      }),
    })),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,contemporary-bold-pdf'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const html2canvasMock = vi.fn(async (target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    if (options?.onclone) {
      const clonedDocument = document.implementation.createHTMLDocument('clone');
      clonedDocument.body.innerHTML = document.body.innerHTML;
      options.onclone(clonedDocument);
    }
    expect(target.matches('[data-template-id="contemporary-bold"]') || Boolean(target.querySelector('[data-template-id="contemporary-bold"]'))).toBe(true);
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
        return new Blob(['%PDF-1.7\ncontemporary-bold\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances };
}

async function captureDocx(data: CVData): Promise<{ documentXml: string; text: string }> {
  const blobByUrl = new Map<string, Blob>();
  let capturedBlob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:http://contemporary-bold/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });

  await exportToDOCX(data, 'contemporary-bold-docx-test', 'en', 'contemporary-bold');
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

function rectAttr(top: number, left: number, width: number, height: number): string {
  return [top, left, width, height].join(',');
}

function installRectMock() {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
    const raw = this.getAttribute('data-test-rect');
    if (!raw) {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }
    const [top, left, width, height] = raw.split(',').map(Number);
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

beforeEach(() => {
  vi.restoreAllMocks();
  loadedImageSources = [];
  drawImageCalls = [];
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn((...args: unknown[]) => drawImageCalls.push(args)),
      restore: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      globalCompositeOperation: 'source-over',
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn((type?: string) => (type === 'image/png' ? transparentCirclePhoto : squarePhoto)),
    configurable: true,
  });
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

describe('Contemporary Bold export', () => {
  test('template id resolves to the intended preview component and fixed-width PDF root', () => {
    const Template = templateComponents['contemporary-bold'];
    const html = renderToStaticMarkup(<Template data={cv()} locale="en" />);
    const root = createContemporaryBoldPdfTemplate(cv(), { locale: 'en', photoDataUrl: originalPhoto });
    const frame = root.querySelector('[data-export-photo-frame="contemporary-bold"]') as HTMLElement;

    expect(html).toContain('data-template-id="corporate-navy"');
    expect(root.dataset.templateId).toBe('contemporary-bold');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minWidth).toBe('210mm');
    expect(root.querySelector('[data-contemporary-bold-pdf-header]')).not.toBeNull();
    expect(frame.style.width).toBe('82px');
    expect(frame.style.height).toBe('82px');
    expect(frame.style.borderRadius).toBe('50%');
  });

  test('production PDF route uses the dedicated renderer and disables print fallback', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const handler = pageSource.slice(pageSource.indexOf('const handlePDFDownload'));
    const branch = handler.indexOf("liveCv.templateId === 'contemporary-bold'");
    const guard = handler.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = handler.indexOf('await openPrintFallback', guard);

    expect(branch).toBeGreaterThan(-1);
    expect(handler.slice(branch, branch + 520)).toContain('cvRef.current');
    expect(handler.slice(branch, branch + 520)).toContain('exportContemporaryBoldPdf');
    expect(guard).toBeGreaterThan(branch);
    expect(fallback).toBeGreaterThan(guard);
    expect(handler.slice(guard, fallback)).toContain("cv.templateId === 'contemporary-bold'");
  });

  test('Contemporary Bold PDF export wires keep-together pagination before html2canvas capture', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('applyContemporaryBoldKeepTogetherPagination');
    expect(exportSource).toContain("captureTemplateId === 'contemporary-bold' && sourceRootForTag");
    expect(exportSource).toContain("applyCorporateFamilyKeepTogetherPagination(root, 'contemporary-bold')");
  });

  test('Contemporary Bold keep-together shifts WORK EXPERIENCE heading with first entry when heading would orphan', () => {
    document.body.innerHTML = `
      <div data-template-id="contemporary-bold" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="contemporary-bold-section" data-test-rect="${rectAttr(1080, 34, 732, 180)}">
          <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(1100, 34, 732, 22)}">WORK EXPERIENCE</h2>
          <div data-export-group="contemporary-bold-experience" data-test-rect="${rectAttr(1130, 34, 732, 120)}">
            <div data-test-rect="${rectAttr(1130, 34, 732, 28)}">
              <h3>Primary School Teacher</h3>
            </div>
            <p data-test-rect="${rectAttr(1160, 34, 732, 18)}">Primary School ZHFF</p>
            <div data-export-meaningful="true" data-test-rect="${rectAttr(1182, 34, 732, 24)}">
              <span>-</span><span>Planned teaching units for Serbian language and mathematics.</span>
            </div>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="contemporary-bold"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyContemporaryBoldKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('WORK EXPERIENCE');
    expect(document.body.textContent).toContain('Primary School Teacher');
  });

  test('Contemporary Bold keep-together shifts Education heading with first education row when heading would orphan', () => {
    document.body.innerHTML = `
      <div data-template-id="contemporary-bold" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <main data-contemporary-bold-pdf-body="true">
          <section data-export-group="contemporary-bold-section" data-test-rect="${rectAttr(1080, 34, 732, 90)}">
            <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(1100, 34, 732, 22)}">EDUCATION</h2>
            <div data-test-rect="${rectAttr(1130, 34, 732, 40)}">
              <div>
                <h3>VI stepen</h3>
                <p>Mathematics Faculty</p>
              </div>
              <div>2020-01 - 2025-02</div>
            </div>
          </section>
        </main>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="contemporary-bold"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyContemporaryBoldKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('EDUCATION');
    expect(document.body.textContent).toContain('Mathematics Faculty');
  });

  test('Contemporary Bold keep-together does not shift a section that already fits on one page', () => {
    document.body.innerHTML = `
      <div data-template-id="contemporary-bold" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="contemporary-bold-section" data-test-rect="${rectAttr(820, 34, 732, 120)}">
          <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(820, 34, 732, 22)}">WORK EXPERIENCE</h2>
          <div data-export-group="contemporary-bold-experience" data-test-rect="${rectAttr(850, 34, 732, 90)}">
            <div data-test-rect="${rectAttr(850, 34, 732, 28)}"><h3>Teacher</h3></div>
            <p data-test-rect="${rectAttr(880, 34, 732, 18)}">School</p>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="contemporary-bold"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyContemporaryBoldKeepTogetherPagination(root);

    expect(heading.style.marginTop).toBe('');
  });

  test('PDF Blob is non-empty, one page, and originalPhoto is cropped proportionally', async () => {
    const canvas = makeCanvas(800, 1000);
    const { html2canvasMock, instances } = installPdfMocks(canvas);

    const blob = await buildContemporaryBoldPdfBlob(cv({
      personal: {
        originalPhoto,
        photo: 'data:image/jpeg;base64,photo-field',
        circularPhoto: 'data:image/png;base64,circular-field',
      },
    }), 'en');

    expect(html2canvasMock).toHaveBeenCalled();
    expect(blob.size).toBeGreaterThan(0);
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain('data:image/png;base64,circular-field');
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(-82);
    expect(scaledWidth).toBe(164);
    expect(scaledHeight).toBe(328);
  });

  test('direct Contemporary Bold PDF export uses shared platform save result', async () => {
    const canvas = makeCanvas(800, 1000);
    installPdfMocks(canvas);
    let clickedDownload = '';
    const blobByUrl = new Map<string, Blob>();
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:http://contemporary/${blobByUrl.size}`;
      blobByUrl.set(url, blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });

    const result = await exportContemporaryBoldPdf(cv(), 'Dragan - CV', 'en');

    expect(clickedDownload).toBe('Dragan - CV.pdf');
    expect(result.result).toBe('saved');
    expect(result.fileName).toBe('Dragan - CV.pdf');
  });

  test('DOCX uses compact text-left/photo-right layout, transparent PNG photo, and no skill bullets', async () => {
    const exportSource = source('src/lib/export.ts');
    const pageSource = source('src/app/cv-builder/page.tsx');
    const configStart = exportSource.indexOf("'contemporary-bold': {");
    const config = exportSource.slice(configStart, exportSource.indexOf('},', configStart) + 2);
    const docxHandlerBranchStart = pageSource.indexOf("liveCv.templateId === 'corporate-navy' || liveCv.templateId === 'contemporary-bold'");
    const docxHandlerBranch = pageSource.slice(docxHandlerBranchStart, docxHandlerBranchStart + 300);
    const { documentXml, text } = await captureDocx(cv());

    expect(config).toContain("customLayout: 'corporate-navy'");
    expect(docxHandlerBranch.indexOf('originalPhoto')).toBeGreaterThan(-1);
    expect(docxHandlerBranch.indexOf('originalPhoto')).toBeLessThan(docxHandlerBranch.indexOf('circularPhotoDataUrl'));
    expect(documentXml).toContain('wp:extent cx="723900" cy="723900"');
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(text).toContain('Mathematics Faculty');
    expect(text).toContain('Teamwork | Organization');
    expect((text.match(/\bLeadership\b/g) ?? [])).toHaveLength(1);
    expect(text).not.toContain('• Teamwork');
  });
});
