/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { CleanSimpleTemplate, templateComponents } from '@/components/cv-templates';
import { createCleanSimplePdfTemplate } from '@/lib/clean-simple-pdf-template';
import {
  buildCleanSimplePdfBlob,
  exportCleanSimplePdf,
  exportToDOCX,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const exportSource = () => fs.readFileSync(path.resolve('src/lib/export.ts'), 'utf8');
const pageSource = () => fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
const templateSource = () => fs.readFileSync(path.resolve('src/components/cv-templates.tsx'), 'utf8');
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const clonedTextContents: string[] = [];
  vi.doMock('html2canvas', () => ({
    default: vi.fn(async (_target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
      if (options?.onclone) {
        const clonedDocument = document.implementation.createHTMLDocument('clone');
        clonedDocument.body.innerHTML = document.body.innerHTML;
        options.onclone(clonedDocument);
        clonedTextContents.push(clonedDocument.body.textContent ?? '');
      }
      return canvas;
    }),
  }));
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
  return { instances, clonedTextContents };
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
    const branch = page.indexOf("liveCv.templateId === 'clean-simple'");
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
    const { instances, clonedTextContents } = installPdfMocks(canvas);

    const blob = await buildCleanSimplePdfBlob(draganCv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
    expect(loadedImageSources).toContain(selectedPhoto);
    expect(loadedImageSources).not.toContain(originalPhoto);

    const cloneText = clonedTextContents.join('\n');
    expect(cloneText).toContain('Učitelj u osnovnoj školi');
    expect(cloneText).toContain('Nastavnik geografije');
    expect(cloneText).toContain('Metematički fakultet');
    expect(cloneText).not.toContain('osnovnojškoli');
    expect(cloneText).not.toContain('Nastavnikgeografije');
    expect(cloneText).not.toContain('Nastavnikgeografijeat');
    expect(cloneText).not.toContain('Metematičkifakultet');
    expect(cloneText).not.toContain('Teamwor k');
    expect(cloneText).not.toContain('Creativit y');
    expect(cloneText).not.toContain('Coachin g');
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
