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
  buildCvPdfBlob,
  exportToDOCX,
  findVisibleCanvasBottom,
  isCanvasSliceEffectivelyBlank,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,clean-simple'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const html2canvasMock = vi.fn(async (_target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
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
        return new Blob(['%PDF-1.7\nclean-simple\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances };
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

describe('Clean Simple export routing and rendering', () => {
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
    expect(html).toContain('word-spacing:0.08em');
    expect(html).toContain('color:#059669');
    expect(html).toContain('white-space:break-spaces');
    expect(html).toContain('data-clean-simple-section="summary"');
    expect(cleanSource).not.toContain('max-w-[210mm]');
  });

  test('Clean Simple preview keeps photo compact and separates contacts, skills, and languages', () => {
    const html = renderToStaticMarkup(<CleanSimpleTemplate data={cv()} locale="en" />);

    expect(html).toContain('data-clean-simple-photo="frame"');
    expect(html).toContain('width:80px');
    expect(html).toContain('height:80px');
    expect(html).toContain('mila@example.com');
    expect(html).toContain('|');
    expect(html.match(/data-clean-simple-skill="item"/g)).toHaveLength(5);
    expect(html).not.toContain('TeamworkOrganizationTime Management');
    expect(html).toContain('Serbian');
    expect(html).toContain('English');
  });

  test('Clean Simple PDF errors no longer route to Android/browser print fallback', () => {
    const source = cvBuilderSource();
    const cleanGuard = source.indexOf("cv.templateId === 'clean-simple'");
    const fallback = source.indexOf('await openPrintFallback', cleanGuard);
    const guardBlock = source.slice(cleanGuard, fallback);

    expect(source).toContain("onClick={() => handlePDFDownload('cv-preview')}");
    expect(source).toContain('await exportToPDF(previewId, exportFilename)');
    expect(cleanGuard).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(cleanGuard);
    expect(guardBlock).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(guardBlock).toContain('return;');
  });

  test('Clean Simple PDF export builds a non-empty one-page Blob for short content', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="clean-simple" style="width:800px;height:1000px">Clean Simple</div></div>';
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

  test('Clean Simple PDF export paginates long nonblank content without appending a blank page', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="clean-simple" style="width:800px;height:2600px">Clean Simple</div></div>';
    const canvas = makeCanvas(800, 2600, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(3);
    expect(instances[0].addImage).toHaveBeenCalledTimes(3);
  });

  test('Clean Simple canvas blank-slice checks crop trailing whitespace and reject empty final slices', () => {
    const blankCanvas = makeCanvas(120, 160, () => false);
    const contentCanvas = makeCanvas(120, 160, (y) => y >= 0 && y <= 119);

    expect(isCanvasSliceEffectivelyBlank(blankCanvas, 120, 40)).toBe(true);
    expect(isCanvasSliceEffectivelyBlank(contentCanvas, 0, 40)).toBe(false);
    expect(findVisibleCanvasBottom(contentCanvas)).toBeGreaterThanOrEqual(119);
    expect(findVisibleCanvasBottom(contentCanvas)).toBeLessThan(130);
  });

  test('Clean Simple uses the Blob save boundary that reaches MediaStore on Android API 29+', () => {
    const exportSrc = exportSource();
    const nativeSaveSrc = fs.readFileSync(path.resolve('src/lib/native-save.ts'), 'utf8');
    const savePluginSrc = fs.readFileSync(path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'), 'utf8');

    expect(exportSrc).toContain('await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, \'application/pdf\')');
    expect(exportSrc).toContain('await saveFileViaPlatform(blob, `${fileName}.docx`, \'application/vnd.openxmlformats-officedocument.wordprocessingml.document\')');
    expect(nativeSaveSrc).toContain('SaveFileNative.saveFile');
    expect(savePluginSrc).toContain('if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)');
    expect(savePluginSrc).toContain('saveToMediaStoreDownloads(call, decodedBytes, fileName, mimeType');
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
