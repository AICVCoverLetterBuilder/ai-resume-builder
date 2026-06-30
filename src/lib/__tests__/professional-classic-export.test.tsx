/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfessionalClassicTemplate, templateComponents } from '@/components/cv-templates';
import { buildCvPdfBlob, exportToDOCX } from '@/lib/export';
import type { CVData } from '@/lib/types';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'professional-classic-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradovic',
      email: 'dragan@example.com',
      phone: '+381 64 222 0100',
      address: 'Belgrade, Serbia',
      jobTitle: 'Senior Operations Manager',
      photo: tinyPng,
      photoEnabled: true,
    },
    summary: 'Senior operations manager with a record of building reliable teams and predictable delivery.',
    experience: [
      {
        id: 'exp1',
        company: 'Adriatic Systems',
        position: 'Senior Operations Manager',
        startDate: '2020-01',
        endDate: '',
        isPresent: true,
        description: '- Led cross-functional planning for a 40-person team.\n- Reduced late handoffs through clearer weekly reporting.',
      },
      {
        id: 'exp2',
        company: 'Blue Harbor Group',
        position: 'Operations Lead',
        startDate: '2017-02',
        endDate: '2019-12',
        isPresent: false,
        description: 'Built operating cadence for regional teams.',
      },
    ],
    education: [
      { id: 'edu1', school: 'University of Belgrade', degree: 'BA Management', startDate: '2012', endDate: '2016', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Time Management', 'Scheduling', 'Communication'],
    certifications: ['Lean Operations Certificate'],
    languages: [{ name: 'Serbian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    templateId: 'professional-classic',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

const exportSource = () => fs.readFileSync(path.resolve('src/lib/export.ts'), 'utf8');
const templateSource = () => fs.readFileSync(path.resolve('src/components/cv-templates.tsx'), 'utf8');
const cvBuilderSource = () => fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = vi.fn().mockResolvedValue(undefined);
  private currentSrc = '';

  get src() {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    setTimeout(() => this.onload?.(), 0);
  }
}

class MockFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL() {
    this.result = 'data:image/jpeg;base64,AQID';
    setTimeout(() => this.onload?.(), 0);
  }
}

type TestCanvas = HTMLCanvasElement & {
  __ctx: {
    drawImage: ReturnType<typeof vi.fn>;
    getImageData: ReturnType<typeof vi.fn>;
  };
};

function makeCanvas(width: number, height: number, hasContentAt: (absoluteY: number) => boolean): TestCanvas {
  const canvas = document.createElement('canvas') as TestCanvas;
  canvas.width = width;
  canvas.height = height;
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      data.fill(255);
      for (let row = 0; row < h; row += 1) {
        if (!hasContentAt(y + row)) continue;
        const index = row * w * 4;
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  canvas.__ctx = ctx;
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,professional-classic'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const cloneDocuments: Document[] = [];
  const html2canvasMock = vi.fn(async (_target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    if (options?.onclone) {
      const clonedDocument = document.implementation.createHTMLDocument('clone');
      clonedDocument.body.innerHTML = document.body.innerHTML;
      options.onclone(clonedDocument);
      cloneDocuments.push(clonedDocument);
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
        return new Blob(['%PDF-1.7\nprofessional-classic\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances, cloneDocuments };
}

beforeEach(() => {
  vi.restoreAllMocks();
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
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      data.fill(255);
      for (let row = 0; row < h; row += 1) {
        const index = row * w * 4;
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 255;
      }
      return { data };
    }),
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Professional Classic export routing and rendering', () => {
  test('Professional Classic resolves to its real renderer and export-safe A4 root', () => {
    const html = renderToStaticMarkup(<ProfessionalClassicTemplate data={cv()} locale="en" />);
    const src = templateSource();
    const pcStart = src.indexOf('export function ProfessionalClassicTemplate');
    const pcEnd = src.indexOf('// --- ATS Standard');
    const pcSource = src.slice(pcStart, pcEnd);

    expect(templateComponents['professional-classic']).toBe(ProfessionalClassicTemplate);
    expect(html).toContain('data-template-id="professional-classic"');
    expect(html).toContain('box-border');
    expect(html).toContain('w-[210mm]');
    expect(html).toContain('min-height:297mm');
    expect(html).toContain('background-color:#1f2937');
    expect(html).toContain('word-spacing:normal');
    expect(html).toContain('letter-spacing:normal');
    expect(html).toContain('white-space:normal');
    expect(html).toContain('font-kerning:normal');
    expect(pcSource).not.toContain('max-w-[210mm]');
  });

  test('Professional Classic preview keeps header, photo, contacts, and skills export-safe', () => {
    const html = renderToStaticMarkup(<ProfessionalClassicTemplate data={cv()} locale="en" />);

    expect(html).toContain('data-professional-classic-header="true"');
    expect(html).toContain('data-professional-classic-photo="frame"');
    expect(html).toContain('width:90px');
    expect(html).toContain('height:90px');
    expect(html).toContain('border-radius:9999px');
    expect(html).toContain('dragan@example.com');
    expect(html).toContain('|');
    expect(html.match(/data-professional-classic-skill="item"/g)).toHaveLength(5);
    expect(html).not.toContain('TeamworkOrganizationTime Management');
  });

  test('Professional Classic PDF errors do not route to Android/browser print fallback', () => {
    const source = cvBuilderSource();
    const pcGuard = source.indexOf("cv.templateId === 'professional-classic'");
    const fallback = source.indexOf('await openPrintFallback', pcGuard);
    const guardBlock = source.slice(pcGuard, fallback);

    expect(source).toContain("onClick={() => handlePDFDownload('cv-preview')}");
    expect(source).toContain('await exportToPDF(previewId, exportFilename)');
    expect(pcGuard).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(pcGuard);
    expect(guardBlock).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(guardBlock).toContain('return;');
  });

  test('Professional Classic PDF export builds a non-empty one-page Blob for short content', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="professional-classic" style="width:800px;height:1000px">Professional Classic</div></div>';
    const canvas = makeCanvas(800, 1000, () => true);
    const { html2canvasMock, instances } = installPdfMocks(canvas);

    const blob = await buildCvPdfBlob('cv-preview');

    expect(html2canvasMock).toHaveBeenCalled();
    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
  });

  test('Professional Classic PDF clone preserves literal spaces and normalizes spacing-safe text styles', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<ProfessionalClassicTemplate data={cv()} locale="en" />)}</div>`;
    const sourceRoot = document.querySelector('[data-template-id="professional-classic"]') as HTMLElement;
    const canvas = makeCanvas(800, 1000, () => true);
    const { cloneDocuments } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    const cloneRoot = cloneDocuments[0].querySelector('[data-template-id="professional-classic"]') as HTMLElement;
    expect(sourceRoot.textContent).toContain('Dragan Obradovic');
    expect(sourceRoot.textContent).toContain('Senior Operations Manager');
    expect(sourceRoot.textContent).toContain('Senior operations manager with a record');
    expect(cloneRoot.textContent).toContain('Dragan Obradovic');
    expect(cloneRoot.textContent).toContain('Senior Operations Manager');
    expect(cloneRoot.textContent).toContain('Senior operations manager with a record');
    expect(cloneRoot.textContent).not.toContain('DraganObradovic');
    expect(cloneRoot.style.fontFamily).toContain('Arial');
    expect(cloneRoot.style.wordSpacing).toBe('normal');
    expect(cloneRoot.style.letterSpacing).toBe('normal');
    expect(cloneRoot.style.whiteSpace).toBe('normal');
    expect(cloneRoot.style.getPropertyValue('font-kerning')).toBe('normal');
    expect(cloneRoot.style.textRendering).toBe('geometricprecision');
  });

  test('Professional Classic PDF export resolves relative photo URLs instead of hiding the frame', async () => {
    document.head.innerHTML = '<base href="http://localhost/">';
    Object.defineProperty(document, 'baseURI', { value: 'http://localhost/', configurable: true });
    const markup = renderToStaticMarkup(<ProfessionalClassicTemplate data={cv({ personal: { photo: '/professional-classic-real-photo-crop.jpg' } })} locale="en" />);
    document.body.innerHTML = `<div id="cv-preview">${markup.replace(/^<link[^>]+>/, '')}</div>`;
    expect((document.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('/professional-classic-real-photo-crop.jpg');
    const canvas = makeCanvas(800, 1000, () => true);
    const { cloneDocuments } = installPdfMocks(canvas);
    const fetchMock = vi.fn(async () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }), { status: 200 }));
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });
    Object.defineProperty(window, 'fetch', { value: fetchMock, configurable: true });
    Object.defineProperty(globalThis, 'FileReader', { value: MockFileReader, configurable: true });
    Object.defineProperty(window, 'FileReader', { value: MockFileReader, configurable: true });
    await buildCvPdfBlob('cv-preview');

    const cloneFrame = cloneDocuments[0].querySelector('[data-professional-classic-photo="frame"]') as HTMLElement;
    const cloneImg = cloneFrame.querySelector('img') as HTMLImageElement;
    expect(cloneFrame.style.display).not.toBe('none');
    expect(cloneImg.getAttribute('src')).toBe('/professional-classic-real-photo-crop.jpg');
    expect(cloneImg.getAttribute('alt')).toBe('');
  });

  test('Professional Classic PDF export paginates long nonblank content', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="professional-classic" style="width:800px;height:2600px">Professional Classic</div></div>';
    const canvas = makeCanvas(800, 2600, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(3);
    expect(instances[0].addImage).toHaveBeenCalledTimes(3);
  });

  test('Professional Classic PDF export skips a blank trailing canvas slice', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="professional-classic" style="width:800px;height:2600px">Professional Classic</div></div>';
    const canvas = makeCanvas(800, 2600, (y) => y < 2200);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Professional Classic no-photo PDF remains valid', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<ProfessionalClassicTemplate data={cv({ personal: { photo: undefined, photoEnabled: false } })} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { instances } = installPdfMocks(canvas);

    const blob = await buildCvPdfBlob('cv-preview');

    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0].pages).toBe(1);
    expect(document.querySelector('[data-professional-classic-photo="frame"]')).toBeNull();
  });

  test('Professional Classic DOCX uses its dedicated layout before generic fallbacks', () => {
    const src = exportSource();
    const pcConfig = src.indexOf("customLayout: 'professional-classic'");
    const pcBranch = src.indexOf("cfg.customLayout === 'professional-classic'");
    const genericSingle = src.indexOf("cfg.layout === 'single'");
    const branch = src.slice(pcBranch, src.indexOf("else if (cfg.customLayout === 'creative-artistic')", pcBranch));

    expect(pcConfig).toBeGreaterThan(0);
    expect(pcBranch).toBeGreaterThan(0);
    expect(pcBranch).toBeLessThan(genericSingle);
    expect(branch).toContain('const headerBg');
    expect(branch).toContain('ImageRun');
    expect(branch).toContain("'  |  '");
    expect(branch).toContain('pcDescriptionParagraphs');
    expect(branch).toContain('cvData.skills.map((s) => s.trim()).filter(Boolean)');
  });

  test('Professional Classic DOCX with photo contains non-empty body text, media, and relationship', async () => {
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

    await exportToDOCX(cv(), 'professional-classic-photo-test', 'en', 'professional-classic');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);
    expect(Array.from(new Uint8Array(await savedBlob!.slice(0, 2).arrayBuffer()))).toEqual([0x50, 0x4b]);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const contentTypes = await zip.file('[Content_Types].xml')!.async('text');
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(contentTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml');
    expect(documentXml).toContain('Dragan Obradovic');
    expect(documentXml).toContain('Senior operations manager');
    expect(documentXml).toContain('Adriatic Systems');
    expect(documentXml).toContain('Teamwork');
    expect(documentXml).toContain('Scheduling');
    expect(documentXml.match(/Time Management/g)).toHaveLength(1);
    expect(documentXml).toContain('<w:drawing>');
    expect(documentXml).toContain('|');
    expect(relsXml).toContain('image');
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  test('Professional Classic DOCX without photo remains valid and non-empty', async () => {
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

    await exportToDOCX(cv({ personal: { photo: undefined, photoEnabled: false } }), 'professional-classic-no-photo-test', 'en', 'professional-classic');

    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Dragan Obradovic');
    expect(documentXml).toContain('Senior operations manager');
    expect(documentXml).toContain('Teamwork');
    expect(documentXml).not.toContain('<w:drawing>');
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
