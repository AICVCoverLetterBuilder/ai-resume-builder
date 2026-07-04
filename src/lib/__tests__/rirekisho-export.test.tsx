/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { createRirekishoPdfTemplate } from '@/lib/rirekisho-pdf-template';
import {
  buildRirekishoPdfBlob,
  exportRirekishoToDOCX,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const originalPhoto = `data:image/jpeg;base64,${Buffer.from('rirekisho-original-photo').toString('base64')}`;
const selectedPhoto = `data:image/jpeg;base64,${Buffer.from('rirekisho-selected-photo').toString('base64')}`;
const croppedPhoto = `data:image/jpeg;base64,${Buffer.from('rirekisho-cropped-photo').toString('base64')}`;
let loadedImageSources: string[] = [];
let drawImageCalls: unknown[][] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'rirekisho-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      dateOfBirth: '1988-02-15',
      gender: '男',
      photo: selectedPhoto,
      originalPhoto,
      photoEnabled: true,
    },
    summary: 'Iskusan učitelj sa oko devet godina rada u obrazovanju. Posebnu vrednost donosi kroz koučing i liderske kompetencije.',
    experience: [
      {
        id: 'exp-1',
        company: 'Zhff',
        position: 'Učitelj u osnovnoj školi',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: '- Planirao sam nastavne jedinice.\n- Primenio sam diferenciranu nastavu.',
      },
      {
        id: 'exp-2',
        company: 'Hfh',
        position: 'Nastavnik geografije',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: '- Koristio sam geografske karte.\n- Učestvovao sam u roditeljskim sastancima.',
      },
    ],
    education: [
      { id: 'edu-1', school: 'Metematički fakultet', degree: 'VI', startDate: '2020-01', endDate: '2025-02', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Coaching', 'Coaching', 'Leadership'],
    certifications: [],
    languages: [{ name: 'Serbian', level: 'Native' }],
    templateId: 'rirekisho',
    region: 'Japan',
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
  naturalWidth = 600;
  naturalHeight = 900;
  width = 600;
  height = 900;
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
        data[0] = 10;
        data[1] = 10;
        data[2] = 10;
        data[3] = 255;
        return { data };
      }),
    })),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => croppedPhoto), configurable: true });
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
    expect(target.matches('[data-template-id="rirekisho"]') || Boolean(target.querySelector('[data-template-id="rirekisho"]'))).toBe(true);
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
        return new Blob(['%PDF-1.7\nrirekisho\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances };
}

async function captureDocx(data: CVData): Promise<{ documentXml: string; text: string; files: string[] }> {
  const blobByUrl = new Map<string, Blob>();
  let capturedBlob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:http://rirekisho/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });

  await exportRirekishoToDOCX(data, 'rirekisho-docx-test');
  expect(capturedBlob).not.toBeNull();
  const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer());
  const files = Object.keys(zip.files);
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const text = documentXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return { documentXml, text, files };
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
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn((...args: unknown[]) => drawImageCalls.push(args)),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => croppedPhoto),
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

describe('Rirekisho export', () => {
  test('dedicated PDF renderer has fixed root, stable marker, constrained photo, and readable sections', () => {
    const root = createRirekishoPdfTemplate(cv(), { locale: 'en', photoDataUrl: croppedPhoto });
    const photoBox = root.querySelector('[data-rirekisho-photo-box]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="rirekisho"]') as HTMLImageElement;
    const rootText = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    const skills = Array.from(root.querySelectorAll('[data-rirekisho-skill]')).map(el => (el.textContent ?? '').replace(/\u00a0/g, ' '));
    const bullets = root.querySelectorAll('[data-rirekisho-bullet-row]');

    expect(root.dataset.templateId).toBe('rirekisho');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minWidth).toBe('210mm');
    expect(rootText).toContain('履　歴　書');
    expect(rootText).toContain('氏名 / Full Name');
    expect(rootText).toContain('学　歴');
    expect(rootText).toContain('職　歴');
    expect(rootText).toContain('スキル');
    expect(rootText).toContain('自己PR');
    expect(rootText).toContain('Dragan Obradović');
    expect(photoBox.style.width).toBe('90px');
    expect(photoBox.style.height).toBe('120px');
    expect(photoBox.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(skills).toEqual(['Teamwork', 'Organization', 'Coaching', 'Coaching', 'Leadership']);
    expect(bullets).toHaveLength(4);
  });

  test('production PDF route uses latest cvRef, direct export, and disables print fallback', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const handler = pageSource.slice(pageSource.indexOf('const handlePDFDownload'));
    const branch = handler.indexOf("liveCv.templateId === 'rirekisho'");
    const exportCall = handler.indexOf('exportRirekishoPdf', branch);
    const genericExport = handler.indexOf('exportToPDF', branch);
    const fallbackGuard = handler.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = handler.indexOf('await openPrintFallback', fallbackGuard);

    expect(branch).toBeGreaterThan(-1);
    expect(exportCall).toBeGreaterThan(branch);
    expect(exportCall).toBeLessThan(genericExport);
    expect(handler.slice(branch, branch + 420)).toContain('cvRef.current');
    expect(handler.slice(fallbackGuard, fallback)).toContain("cv.templateId === 'rirekisho'");
    expect(handler.slice(branch, exportCall)).not.toContain('querySelector');
  });

  test('PDF Blob is non-empty, one page, and originalPhoto is used before selected photo', async () => {
    const canvas = makeCanvas(800, 1080);
    const { html2canvasMock, instances } = installPdfMocks(canvas);

    const blob = await buildRirekishoPdfBlob(cv(), 'en');

    expect(html2canvasMock).toHaveBeenCalled();
    expect(blob.size).toBeGreaterThan(0);
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain(selectedPhoto);
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(scaledWidth / scaledHeight).toBeCloseTo(600 / 900, 3);
    expect(dx).toBe(0);
    expect(dy).toBeLessThan(0);
  });

  test('DOCX remains table-based, editable, fixed-width, with constrained photo and preserved skills/self PR', async () => {
    const { documentXml, text, files } = await captureDocx(cv());

    expect(documentXml).toContain('<w:tbl>');
    expect(documentXml).toContain('<w:tblLayout w:type="fixed"');
    expect(documentXml).toContain('<w:gridCol w:w="2520"');
    expect(documentXml).toContain('<w:gridCol w:w="6840"');
    expect(documentXml).toContain('<w:gridCol w:w="4680"');
    expect(documentXml).not.toContain('<w:gridCol w:w="100"');
    expect(documentXml).not.toContain('w:type="pct" w:w="100"');
    expect(documentXml).toContain('wp:extent');
    expect(files.some(file => file.startsWith('word/media/'))).toBe(true);
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(loadedImageSources).toContain(originalPhoto);
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBeCloseTo(-15.2, 1);
    expect(scaledWidth / scaledHeight).toBeCloseTo(600 / 900, 3);
    expect(text).toContain('履 歴 書');
    expect(text).toContain('Dragan Obradović');
    expect(text).toContain('Iskusan učitelj');
    expect(text).toContain('Metematički fakultet');
    expect(text).toContain('Koristio sam geografske karte');
    expect((text.match(/\bCoaching\b/g) ?? [])).toHaveLength(2);
  });
});
