/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfessionalClassicTemplate, templateComponents } from '@/components/cv-templates';
import { createProfessionalClassicPdfTemplate } from '@/lib/professional-classic-pdf-template';
import {
  buildProfessionalClassicPdfBlob,
  exportProfessionalClassicPdf,
  exportToDOCX,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const exportSource = () => fs.readFileSync(path.resolve('src/lib/export.ts'), 'utf8');
const pageSource = () => fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
const templateSource = () => fs.readFileSync(path.resolve('src/components/cv-templates.tsx'), 'utf8');
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const originalPhoto = `data:image/jpeg;base64,${Buffer.from('professional-classic-original-photo').toString('base64')}`;
const selectedPhoto = `data:image/jpeg;base64,${Buffer.from('professional-classic-selected-photo').toString('base64')}`;
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

// Real-world fixture: skills genuinely contain "Coaching" AND "Mentoring" as two
// distinct, non-duplicate entries — the exact case the reported bug corrupted into
// duplicate "Coaching" by resolving "Mentoring" through the shared skill-alias
// lookup (cv-skill-options.ts lists "mentoring" as a search alias of "coaching").
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
    skills: ['Teamwork', 'Organization', 'Coaching', 'Mentoring', 'Leadership'],
    certifications: [],
    languages: [{ name: 'Serbian', level: 'Native' }],
    templateId: 'professional-classic',
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
          data[index] = 31;
          data[index + 1] = 41;
          data[index + 2] = 55;
          data[index + 3] = 255;
        }
        return { data };
      }),
    })),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,professional-classic'), configurable: true });
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
        return new Blob(['%PDF-1.7\nprofessional-classic\n%%EOF'], { type: 'application/pdf' });
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

describe('Professional Classic preview/export parity', () => {
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
    expect(pcSource).not.toContain('max-w-[210mm]');
  });

  test('Professional Classic PDF uses the dedicated direct renderer route, not generic exportToPDF/print fallback', () => {
    const page = pageSource();
    const branch = page.indexOf("liveCv.templateId === 'professional-classic'");
    const exportCall = page.indexOf('exportProfessionalClassicPdf', branch);
    const genericExport = page.indexOf('exportToPDF(previewId', branch);
    const fallbackGuard = page.indexOf("cv.templateId === 'professional-classic'", branch);
    const fallback = page.indexOf('await openPrintFallback', fallbackGuard);

    expect(branch).toBeGreaterThan(-1);
    expect(exportCall).toBeGreaterThan(branch);
    expect(exportCall).toBeLessThan(genericExport);
    expect(page.slice(branch, exportCall)).toContain('cvRef.current');
    expect(page.slice(branch, branch + 300)).toContain('showCvExportSuccessToast');
    expect(page.slice(fallbackGuard, fallback)).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(page.slice(fallbackGuard, fallback)).toContain('return;');

    const src = exportSource();
    expect(src).toContain('export async function exportProfessionalClassicPdf');
    expect(src).toContain('const pdfBlob = await buildProfessionalClassicPdfBlob(cv, locale)');
    expect(src).toContain('export async function buildProfessionalClassicPdfBlob');
    expect(src).toContain("await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf')");
  });

  test('dedicated Professional Classic PDF root is fixed A4, dark header, and keeps text spacing intact', () => {
    const root = createProfessionalClassicPdfTemplate(draganCv(), { locale: 'en', photoDataUrl: originalPhoto });
    const header = root.querySelector('[data-professional-classic-header="true"]') as HTMLElement;
    const photoFrame = root.querySelector('[data-professional-classic-photo="frame"]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="professional-classic"]') as HTMLImageElement;
    const contactRow = root.querySelector('[data-professional-classic-contact-row]') as HTMLElement;
    const dates = Array.from(root.querySelectorAll<HTMLElement>('div')).filter(el => el.textContent?.includes('2020-01 - 2025-02'));
    const text = root.textContent ?? '';

    expect(root.dataset.templateId).toBe('professional-classic');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minWidth).toBe('210mm');
    expect(header.style.backgroundColor).toBe('rgb(31, 41, 55)');
    expect(photoFrame.style.width).toBe('90px');
    expect(photoFrame.style.height).toBe('90px');
    expect(photoFrame.style.borderRadius).toBe('9999px');
    expect(photoFrame.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(root.style.wordSpacing).toBe('0.6px');
    expect(root.style.letterSpacing).toBe('0px');
    expect(contactRow.textContent).toContain('Braće Abafi 4');
    expect(dates.some(el => el.style.whiteSpace === 'nowrap')).toBe(true);

    expect(text).toContain('Učitelj u osnovnoj školi');
    expect(text).toContain('Nastavnik geografije');
    expect(text).toContain('Metematički fakultet');
    expect(text).not.toContain('osnovnojškoli');
    expect(text).not.toContain('Nastavnikgeografije');
    expect(text).not.toContain('Metematičkifakultet');

    // Skills must be rendered verbatim: same values, same order, no dedup/localization.
    const skillItems = Array.from(root.querySelectorAll<HTMLElement>('[data-professional-classic-skill="item"]'));
    expect(skillItems.map(el => el.textContent)).toEqual(['Teamwork', 'Organization', 'Coaching', 'Mentoring', 'Leadership']);
    skillItems.forEach((el) => expect(el.style.whiteSpace).toBe('nowrap'));
    expect(text).not.toContain('Teamwor k');
    expect(text).not.toContain('Coachin g');
    expect(text).not.toContain('Mentorin g');

    // Bold single-line fields (experience position, education degree) use the safe
    // flex+gap word rendering, not a single fragile text-node run.
    const safeWordContainers = Array.from(root.querySelectorAll<HTMLElement>('[data-professional-classic-safe-words]'));
    expect(safeWordContainers.length).toBeGreaterThanOrEqual(3); // 2 experience titles + 1 education degree
    safeWordContainers.forEach((container) => {
      expect(container.style.display).toBe('flex');
      expect(container.style.flexWrap).toBe('wrap');
    });
    const secondPosition = safeWordContainers.find(el => el.textContent === 'Nastavnik geografije');
    expect(secondPosition).toBeDefined();
  });

  test('Professional Classic PDF never resolves "Mentoring" to "Coaching" and never shows duplicate Coaching for a fixture that has none', () => {
    const root = createProfessionalClassicPdfTemplate(draganCv(), { locale: 'en', photoDataUrl: null });
    const skillItems = Array.from(root.querySelectorAll<HTMLElement>('[data-professional-classic-skill="item"]'));
    const skillTexts = skillItems.map(el => el.textContent);

    expect(skillTexts).toContain('Coaching');
    expect(skillTexts).toContain('Mentoring');
    expect(skillTexts.filter(s => s === 'Coaching')).toHaveLength(1);
    expect(skillTexts.filter(s => s === 'Mentoring')).toHaveLength(1);
  });

  test('Professional Classic PDF preserves genuine duplicate skills exactly as entered', () => {
    const root = createProfessionalClassicPdfTemplate(cv({ skills: ['Teamwork', 'Coaching', 'Coaching', 'Leadership'] }), { locale: 'en' });
    const skillItems = Array.from(root.querySelectorAll<HTMLElement>('[data-professional-classic-skill="item"]'));
    expect(skillItems.map(el => el.textContent)).toEqual(['Teamwork', 'Coaching', 'Coaching', 'Leadership']);
  });

  test('Professional Classic PDF direct Blob is non-empty, uses the user-framed selected photo (matching DOCX), and the Dragan fixture stays compact', async () => {
    const canvas = makeCanvas(800, 1050, y => y < 980);
    const { instances, clonedTextContents } = installPdfMocks(canvas);

    const blob = await buildProfessionalClassicPdfBlob(draganCv(), 'en');

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
    expect(cloneText).not.toContain('Metematičkifakultet');
    expect(cloneText).toContain('Coaching');
    expect(cloneText).toContain('Mentoring');
    expect(cloneText).not.toContain('CoachingCoaching');
  });

  test('Professional Classic PDF falls back to originalPhoto only when no selected photo exists', async () => {
    const canvas = makeCanvas(800, 1050, y => y < 980);
    installPdfMocks(canvas);
    const cvWithoutSelectedPhoto = draganCv();
    (cvWithoutSelectedPhoto.personal as CVData['personal'] & { photo?: string }).photo = undefined;

    const blob = await buildProfessionalClassicPdfBlob(cvWithoutSelectedPhoto, 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain(selectedPhoto);
  });

  test('Professional Classic PDF export paginates long content without appending a blank trailing page', async () => {
    const canvas = makeCanvas(800, 2600, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildProfessionalClassicPdfBlob(draganCv(), 'en');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBeGreaterThanOrEqual(1);
  });

  test('Professional Classic export save path writes a PDF through platform save', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    installPdfMocks(canvas);
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/professional-classic-pdf';
    });
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    const result = await exportProfessionalClassicPdf(draganCv(), 'Dragan Obradovic - CV', 'en');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob?.type).toBe('application/pdf');
    expect(result.fileName).toBe('Dragan Obradovic - CV.pdf');
    expect(result.sourceBytes).toBeGreaterThan(0);
  });

  test('Professional Classic DOCX uses its dedicated layout before generic fallbacks (untouched)', () => {
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

  test('Professional Classic DOCX and PDF render the exact same skill labels and order from the same fixture (Coaching + Mentoring, not duplicated)', async () => {
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/professional-classic-docx-skills';
    });
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = vi.fn();
      return el;
    });

    await exportToDOCX(draganCv(), 'professional-classic-dragan-docx-skills-test', 'en', 'professional-classic');

    expect(savedBlob).toBeDefined();
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');

    expect(documentXml).toContain('Coaching');
    expect(documentXml).toContain('Mentoring');
    expect((documentXml.match(/Coaching/g) ?? [])).toHaveLength(1);
    expect((documentXml.match(/Mentoring/g) ?? [])).toHaveLength(1);

    const pdfRoot = createProfessionalClassicPdfTemplate(draganCv(), { locale: 'en' });
    const pdfSkills = Array.from(pdfRoot.querySelectorAll<HTMLElement>('[data-professional-classic-skill="item"]')).map(el => el.textContent);
    expect(pdfSkills).toEqual(['Teamwork', 'Organization', 'Coaching', 'Mentoring', 'Leadership']);
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
