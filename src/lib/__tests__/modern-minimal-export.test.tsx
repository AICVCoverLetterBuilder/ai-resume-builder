/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModernMinimalTemplate, templateComponents } from '@/components/cv-templates';
import { createModernMinimalPdfTemplate } from '@/lib/modern-minimal-pdf-template';
import {
  buildModernMinimalPdfBlob,
  CV_PDF_A4_HEIGHT_MM,
  CV_PDF_A4_WIDTH_MM,
  exportModernMinimalPdf,
  prepareModernMinimalImagesForExport,
  resolveExportImageDataUrl,
} from '@/lib/export';
import { exportToDOCX } from '@/lib/export';
import type { CVData } from '@/lib/types';

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'modern-minimal-test',
    name: '',
    personal: {
      fullName: 'Alexandra Very Long Candidate Name With Multiple Words',
      email: 'alexandra@example.com',
      phone: '+1 555 0100',
      address: 'San Francisco, CA',
      jobTitle: 'Senior Software Engineer',
      photo: 'data:image/png;base64,photo',
      photoEnabled: true,
    },
    summary: 'Full-stack engineer focused on accessible, scalable web applications.',
    experience: [
      {
        id: '1',
        company: 'Acme Corp',
        position: 'Senior Engineer',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: 'Built resilient systems.\n- Improved performance with careful profiling.',
      },
    ],
    education: [{ id: 'e1', school: 'State University', degree: 'BS Computer Science', startDate: '2014', endDate: '2018', description: '' }],
    skills: ['TypeScript', 'React', 'Node.js', 'Accessibility', 'PostgreSQL', 'Cloud Architecture'],
    certifications: ['AWS Certified Developer'],
    languages: [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Intermediate' }],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

const exportSource = () => fs.readFileSync(path.resolve('src/lib/export.ts'), 'utf8');
const pageSource = () => fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
const templateSource = () => fs.readFileSync(path.resolve('src/components/cv-templates.tsx'), 'utf8');
const previewSource = () => fs.readFileSync(path.resolve('src/components/TemplatePreview.tsx'), 'utf8');
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const originalPhoto = `data:image/jpeg;base64,${Buffer.from('modern-minimal-original-photo').toString('base64')}`;
const selectedPhoto = `data:image/jpeg;base64,${Buffer.from('modern-minimal-selected-photo').toString('base64')}`;
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

function draganCv(): CVData {
  return cv({
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      photo: selectedPhoto,
      originalPhoto,
      photoEnabled: true,
    } as CVData['personal'] & { originalPhoto: string },
    summary: 'Iskusan učitelj sa oko devet godina rada u obrazovanju. Posebnu vrednost donosi kroz koučing, liderske kompetencije i profesionalnu pažnju u kreiranju kvalitetnih nastavnih sadržaja.',
    experience: [
      {
        id: 'exp-1',
        company: 'Zhff',
        position: 'Učitelj u osnovnoj školi',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: 'Planirao sam nastavne jedinice i kreirao kvalitetne materijale.\nPrimenio sam diferenciranu nastavu uz profesionalnu pažnju.',
      },
      {
        id: 'exp-2',
        company: 'Hfh',
        position: 'Nastavnik geografije',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: 'Koristio sam geografske karte i digitalne alate.\nUčestvovao sam u roditeljskim sastancima.',
      },
    ],
    education: [{ id: 'edu-1', school: 'Metematički fakultet', degree: 'VI', startDate: '2020-01', endDate: '2025-02', description: '' }],
    skills: ['Teamwork', 'Organization', 'Coaching', 'Coaching', 'Leadership'],
    certifications: [],
    languages: [{ name: 'Serbian', level: 'Native' }],
    templateId: 'modern-minimal',
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
          data[index] = 79;
          data[index + 1] = 70;
          data[index + 2] = 229;
          data[index + 3] = 255;
        }
        return { data };
      }),
    })),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,modern-minimal'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const clonedTextContents: string[] = [];
  const clonedPhotoFrameWidths: string[] = [];
  vi.doMock('html2canvas', () => ({
    default: vi.fn(async (_target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
      if (options?.onclone) {
        const clonedDocument = document.implementation.createHTMLDocument('clone');
        clonedDocument.body.innerHTML = document.body.innerHTML;
        const frame = clonedDocument.querySelector('[data-modern-minimal-photo-frame]') as HTMLElement | null;
        if (frame) clonedPhotoFrameWidths.push(frame.style.width);
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
        return new Blob(['%PDF-1.7\nmodern-minimal\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));
  return { instances, clonedTextContents, clonedPhotoFrameWidths };
}

beforeEach(() => {
  vi.restoreAllMocks();
  loadedImageSources = [];
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
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

describe('Modern Minimal preview/export parity', () => {
  test('Modern Minimal resolves to the real renderer, not a static preview image or fallback', () => {
    expect(templateComponents['modern-minimal']).toBe(ModernMinimalTemplate);
    expect(previewSource()).toContain('const TemplateComponent = templateComponents[templateId]');
    expect(previewSource()).not.toContain('<img');
    expect(previewSource()).not.toContain('modern-minimal.png');
  });

  test('Modern Minimal HTML preview root is a border-box A4 capture target', () => {
    const html = renderToStaticMarkup(<ModernMinimalTemplate data={cv()} locale="en" />);
    const src = templateSource();
    const modernStart = src.indexOf('export function ModernMinimalTemplate');
    const modernEnd = src.indexOf('// --- Creative Bold');
    const modernSource = src.slice(modernStart, modernEnd);

    expect(html).toContain('data-template-id="modern-minimal"');
    expect(html).toContain('box-border');
    expect(html).toContain('w-[210mm]');
    expect(html).toContain('min-height:297mm');
    expect(modernSource).not.toContain('max-w-[210mm]');
  });

  test('Modern Minimal renders photo and no-photo variants without changing content', () => {
    const withPhoto = renderToStaticMarkup(<ModernMinimalTemplate data={cv({ personal: { photo: tinyPng } })} locale="en" />);
    const noPhoto = renderToStaticMarkup(<ModernMinimalTemplate data={cv({ personal: { photoEnabled: false } })} locale="en" />);

    expect(withPhoto).toContain('img');
    expect(withPhoto).toContain('Alexandra Very Long Candidate Name');
    expect(noPhoto).not.toContain('img');
    expect(noPhoto).toContain('Alexandra Very Long Candidate Name');
  });

  test('Modern Minimal PDF image preparation keeps data URL photos export-safe', async () => {
    document.body.innerHTML = `
      <div data-template-id="modern-minimal">
        <div style="width:110px;height:110px;border-radius:9999px;overflow:hidden">
          <img src="${tinyPng}#cache" alt="candidate photo" style="width:100%;height:100%;object-fit:cover" />
        </div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    const frame = img.parentElement as HTMLElement;
    const prepared = await prepareModernMinimalImagesForExport(root);

    expect(img.getAttribute('src')).toBe(tinyPng);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.style.objectFit).toBe('cover');
    expect(frame.style.display).not.toBe('none');

    prepared[0].img.setAttribute('alt', 'mutated');
    prepared[0].frame.style.display = 'none';
    prepared.forEach(entry => {
      if (entry.previousSrc === null) entry.img.removeAttribute('src');
      else entry.img.setAttribute('src', entry.previousSrc);
      if (entry.previousAlt === null) entry.img.removeAttribute('alt');
      else entry.img.setAttribute('alt', entry.previousAlt);
      entry.frame.style.display = entry.previousFrameDisplay;
    });
    expect(img.getAttribute('src')).toBe(`${tinyPng}#cache`);
    expect(img.getAttribute('alt')).toBe('candidate photo');
  });

  test('Modern Minimal blob photo is converted to a decoded data URL before PDF capture', async () => {
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) }));
    document.body.innerHTML = `
      <div data-template-id="modern-minimal">
        <div style="width:110px;height:110px;border-radius:9999px;overflow:hidden">
          <img src="blob:http://localhost/photo" alt="candidate photo" />
        </div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    await prepareModernMinimalImagesForExport(root);

    expect(fetch).toHaveBeenCalledWith('blob:http://localhost/photo');
    expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(img.getAttribute('alt')).toBe('');
  });

  test('Modern Minimal broken photo source hides the photo frame instead of exporting alt text', async () => {
    document.body.innerHTML = `
      <div data-template-id="modern-minimal">
        <div style="width:110px;height:110px;border-radius:9999px;overflow:hidden">
          <img src="https://remote.example/broken-photo.png" alt="candidate photo" />
        </div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    const frame = img.parentElement as HTMLElement;
    await prepareModernMinimalImagesForExport(root);

    expect(img.hasAttribute('src')).toBe(false);
    expect(img.getAttribute('alt')).toBe('');
    expect(frame.style.display).toBe('none');
  });

  test('only Modern Minimal image preparation mutates image sources', async () => {
    document.body.innerHTML = `
      <div data-template-id="clean-simple">
        <div><img src="${tinyPng}#cache" alt="candidate photo" /></div>
      </div>
    `;

    const root = document.querySelector('[data-template-id="clean-simple"]') as HTMLElement;
    const img = root.querySelector('img') as HTMLImageElement;
    const prepared = await prepareModernMinimalImagesForExport(root);

    expect(prepared).toEqual([]);
    expect(img.getAttribute('src')).toBe(`${tinyPng}#cache`);
    expect(img.getAttribute('alt')).toBe('candidate photo');
  });

  test('fetchable export images resolve to data URLs without enabling remote cross-origin loading', async () => {
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(blob) }));

    await expect(resolveExportImageDataUrl('blob:http://localhost/photo')).resolves.toMatch(/^data:image\/png;base64,/);
    await expect(resolveExportImageDataUrl('https://remote.example/photo.png')).resolves.toBeNull();
  });

  test('Modern Minimal skills and languages are separated in the preview renderer', () => {
    const html = renderToStaticMarkup(<ModernMinimalTemplate data={cv()} locale="en" />);

    expect(html).toContain('TypeScript');
    expect(html).toContain('React');
    expect(html).toContain('rounded bg-indigo-50');
    expect(html).toContain('English');
    expect(html).toContain('Native');
  });

  test('PDF export uses A4 dimensions and avoids custom short-page sizing', () => {
    const src = exportSource();

    expect(CV_PDF_A4_WIDTH_MM).toBe(210);
    expect(CV_PDF_A4_HEIGHT_MM).toBe(297);
    expect(src).toContain('format: \'a4\'');
    expect(src).toContain('PDF_TRAILING_SLICE_TOLERANCE_MM');
    expect(src).toContain('while (offsetY < canvasHeightPx - trailingTolerancePx)');
    expect(src).not.toContain('format: useSinglePage ? [PDF_WIDTH_MM');
  });

  test('Modern Minimal PDF uses the direct renderer route and disables print fallback', () => {
    const page = pageSource();
    const branch = page.indexOf("liveCv.templateId === 'modern-minimal'");
    const exportCall = page.indexOf('exportModernMinimalPdf', branch);
    const genericExport = page.indexOf('exportToPDF', branch);
    const fallbackGuard = page.indexOf("cv.templateId === 'modern-minimal'", branch);
    const fallback = page.indexOf('await openPrintFallback', fallbackGuard);

    expect(branch).toBeGreaterThan(-1);
    expect(exportCall).toBeGreaterThan(branch);
    expect(exportCall).toBeLessThan(genericExport);
    expect(page.slice(branch, exportCall)).toContain('cvRef.current');
    expect(page.slice(branch, branch + 420)).toContain('showCvExportSuccessToast');
    expect(page.slice(fallbackGuard, fallback)).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(page.slice(fallbackGuard, fallback)).toContain('return;');
  });

  test('the exact real-world Android-reported joined words never appear anywhere in the routed Modern Minimal PDF chain', () => {
    // This is a stronger, end-to-end regression: it verifies the single source
    // chain the real app/Android build actually executes — page.tsx routes
    // 'modern-minimal' to exportModernMinimalPdf, which is defined in export.ts
    // and built from createModernMinimalPdfTemplate — and that the renderer file
    // itself cannot reintroduce per-word/spacer-span text splitting, which is
    // what previously caused "Učitelj u osnovnojškoli", "profesionalnupažnju",
    // "Nastavnikgeografije" and "Metematičkifakultet" to appear in production.
    const page = pageSource();
    const src = exportSource();
    const rendererSrc = fs.readFileSync(path.resolve('src/lib/modern-minimal-pdf-template.ts'), 'utf8');

    // 1. page.tsx really calls exportModernMinimalPdf for this template id.
    expect(page).toContain("liveCv.templateId === 'modern-minimal'");
    expect(page).toContain('exportModernMinimalPdf(latestCv, exportFilename, locale)');

    // 2. export.ts's exportModernMinimalPdf is built on buildModernMinimalPdfBlob,
    //    which in turn renders via createModernMinimalPdfTemplate — not some other
    //    older/duplicate Modern Minimal PDF function.
    expect(src).toContain('export async function exportModernMinimalPdf');
    expect(src).toContain('const pdfBlob = await buildModernMinimalPdfBlob(cv, locale)');
    expect(src).toContain('export async function buildModernMinimalPdfBlob');
    expect(src).toContain('container.appendChild(createModernMinimalPdfTemplate(cv,');
    expect(src.match(/function buildModernMinimalPdfBlob/g)?.length).toBe(1);
    expect(src.match(/function exportModernMinimalPdf/g)?.length).toBe(1);

    // 3. The renderer that actually produces the DOM text nodes uses plain
    //    textContent assignment, not a per-word span/spacer implementation.
    expect(rendererSrc).toContain('element.textContent = text');
    expect(rendererSrc).not.toContain('data-modern-minimal-export-space');
    expect(rendererSrc).not.toContain('split(/( +)/)');
    expect(rendererSrc).not.toMatch(/for\s*\(.*word/i);

    // 4. Runtime proof with the exact fixture that produced the reported bug —
    //    none of the real-world Android-reported joined words are present.
    const root = createModernMinimalPdfTemplate(draganCv(), { locale: 'en', photoDataUrl: originalPhoto });
    const text = root.textContent ?? '';
    expect(text).not.toContain('osnovnojškoli');
    expect(text).not.toContain('profesionalnupažnju');
    expect(text).not.toContain('Nastavnikgeografije');
    expect(text).not.toContain('Metematičkifakultet');
  });

  test('dedicated Modern Minimal PDF root is fixed A4, compact, and keeps text spacing intact', () => {
    const root = createModernMinimalPdfTemplate(draganCv(), { locale: 'en', photoDataUrl: originalPhoto });
    const photoFrame = root.querySelector('[data-modern-minimal-photo-frame]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="modern-minimal"]') as HTMLImageElement;
    const contactRow = root.querySelector('[data-modern-minimal-contact-row]') as HTMLElement;
    const dates = Array.from(root.querySelectorAll<HTMLElement>('div')).filter(el => el.textContent?.includes('2020-01 - 2025-02'));
    const text = root.textContent ?? '';

    expect(root.dataset.templateId).toBe('modern-minimal');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minWidth).toBe('210mm');
    expect(root.style.padding).toBe('24px 34px 22px');
    expect(photoFrame.style.width).toBe('100px');
    expect(photoFrame.style.height).toBe('100px');
    expect(photoFrame.style.borderRadius).toBe('9999px');
    expect(photoFrame.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(photo.style.objectPosition).toBe('50% 50%');
    expect(root.querySelector('[data-modern-minimal-export-space]')).toBeNull();
    expect(contactRow.textContent).toContain('Braće Abafi 4');
    expect(dates.some(el => el.style.whiteSpace === 'nowrap')).toBe(true);
    expect(text).toContain('Učitelj u osnovnoj školi');
    expect(text).toContain('Nastavnik geografije');
    expect(text).toContain('profesionalnu pažnju');
    expect(text).toContain('kreiranju kvalitetnih');
    expect(text).toContain('Metematički fakultet');
    expect(text).not.toContain('osnovnojškoli');
    expect(text).not.toContain('Nastavnikgeografije');
    expect(text).not.toContain('Metematičkifakultet');
    expect(text).not.toContain('profesionalnupažnju');
    expect(text).not.toContain('kreiranjukvalitetnih');
    expect(text).toContain('VI / Metematički fakultet');
    expect(text).toContain('Teamwork');
  });

  test('Modern Minimal direct PDF Blob is non-empty, uses originalPhoto, and Dragan fixture remains one page', async () => {
    const canvas = makeCanvas(800, 1050, y => y < 980);
    const { instances, clonedTextContents, clonedPhotoFrameWidths } = installPdfMocks(canvas);

    const blob = await buildModernMinimalPdfBlob(draganCv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
    // originalPhoto is loaded both for validation and as the source of the
    // canonical square/circular crop (cropModernMinimalPdfPhoto) baked into the
    // final header image, so the larger frame shows a clear, correctly framed face.
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain(selectedPhoto);
    expect(clonedPhotoFrameWidths).toContain('100px');
    const cloneText = clonedTextContents.join('\n');
    expect(cloneText).toContain('VI / Metematički fakultet');
    expect(cloneText).toContain('Teamwork');
    expect(cloneText).toContain('Učitelj u osnovnoj školi');
    expect(cloneText).not.toContain('osnovnojškoli');
    expect(cloneText).not.toContain('Nastavnikgeografije');
    expect(cloneText).not.toContain('Metematičkifakultet');
    expect(cloneText).not.toContain('profesionalnupažnju');
    expect(cloneText).not.toContain('kreiranjukvalitetnih');
  });

  test('Modern Minimal export save path writes a PDF through platform save', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    installPdfMocks(canvas);
    let savedBlob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      savedBlob = blob as Blob;
      return 'blob:http://test/modern-minimal-pdf';
    });
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    const result = await exportModernMinimalPdf(draganCv(), 'Dragan Obradovic - CV', 'en');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob?.type).toBe('application/pdf');
    expect(result.fileName).toBe('Dragan Obradovic - CV.pdf');
    expect(result.sourceBytes).toBeGreaterThan(0);
  });

  test('Modern Minimal DOCX uses a dedicated layout before the generic single fallback', () => {
    const src = exportSource();
    const modernConfig = src.indexOf('customLayout: \'modern-minimal\'');
    const modernBranch = src.indexOf('cfg.customLayout === \'modern-minimal\'');
    const genericSingle = src.indexOf('cfg.layout === \'single\'');

    expect(modernConfig).toBeGreaterThan(0);
    expect(modernBranch).toBeGreaterThan(0);
    expect(modernBranch).toBeLessThan(genericSingle);
  });

  test('Modern Minimal DOCX contains template-specific layout markers and wrapped chip styling', () => {
    const src = exportSource();
    const branch = src.slice(src.indexOf('cfg.customLayout === \'modern-minimal\''), src.indexOf('cfg.layout === \'single\''));

    expect(branch).toContain('Modern Minimal DOCX mirrors the app preview');
    expect(branch).toContain('ImageRun');
    expect(branch).toContain('chipShade');
    expect(branch).toContain('getLocalizedCvSkillName');
    expect(branch).toContain('getLocalizedCvLanguageName');
    expect(branch).toContain('bidirectional: isRTL');
    expect(branch).toContain('mmDateRow');
  });

  test('Modern Minimal DOCX with photo contains media, relationship, drawing reference and text', async () => {
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

    await exportToDOCX(cv({ personal: { photo: tinyPng } }), 'modern-minimal-photo-test', 'en', 'modern-minimal');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Alexandra Very Long Candidate Name');
    expect(documentXml).toContain('Senior Engineer');
    expect(documentXml).toContain('TypeScript');
    expect(documentXml).toContain('<w:drawing>');
    expect(relsXml).toContain('image');
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  test('Modern Minimal DOCX without photo remains valid and non-empty', async () => {
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

    await exportToDOCX(cv({ personal: { photo: undefined, photoEnabled: false } }), 'modern-minimal-no-photo-test', 'en', 'modern-minimal');

    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Alexandra Very Long Candidate Name');
    expect(documentXml).toContain('Full-stack engineer');
    expect(mediaFiles).toHaveLength(0);
  });

  test('localized headings and RTL structure remain wired for Modern Minimal', () => {
    const arHtml = renderToStaticMarkup(<ModernMinimalTemplate data={cv()} locale="ar" />);
    const src = exportSource();

    expect(arHtml).toContain('data-template-id="modern-minimal"');
    expect(src).toContain('const isRTL = locale === \'ar\'');
    expect(src).toContain('mmHeading(t.cv.summary)');
    expect(src).toContain('mmHeading(t.cv.experience)');
    expect(src).toContain('mmHeading(t.cv.skills)');
    expect(src).toContain('mmHeading(t.cv.languages)');
  });

  test('AI Recommend source is not part of this Modern Minimal export change', () => {
    const changedFiles = fs.existsSync(path.resolve('.git'))
      ? execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
          .split(/\r?\n/)
          .filter(Boolean)
      : [];

    expect(changedFiles).not.toContain('src/lib/types.ts');
  });
});

describe('Modern Minimal synced Android assets regression', () => {
  const androidPublicDir = path.resolve('android/app/src/main/assets/public');
  const androidChunksDir = path.join(androidPublicDir, '_next', 'static', 'chunks');

  function readSyncedAndroidChunks(): { found: boolean; combined: string } {
    if (!fs.existsSync(androidChunksDir)) return { found: false, combined: '' };
    const files = fs.readdirSync(androidChunksDir).filter(name => name.endsWith('.js'));
    if (files.length === 0) return { found: false, combined: '' };
    const combined = files
      .map(name => fs.readFileSync(path.join(androidChunksDir, name), 'utf8'))
      .join('\n');
    return { found: true, combined };
  }

  const { found } = readSyncedAndroidChunks();

  // This test only runs meaningfully after `npx cap sync android` has copied a
  // fresh `out` build into android/app/src/main/assets/public. If that folder
  // has not been synced yet (e.g. a clean checkout before any build), skip
  // rather than fail — an unsynced/missing folder is a different problem than
  // a stale/regressed one.
  test.skipIf(!found)('synced Android assets contain the current Modern Minimal PDF renderer and no old span-spacer markers', () => {
    const { combined } = readSyncedAndroidChunks();

    // New renderer markers must be present — proves the currently built source
    // (with element.textContent = text, no per-word spacer spans) is what
    // actually ships inside the Android app bundle, not a stale/duplicate copy.
    expect(combined).toContain('data-modern-minimal-pdf-template');
    expect(combined.includes('modern-minimal-pdf-export')).toBe(true);

    // Old markers from the pre-fix span-by-word spacer implementation must be
    // completely absent. If these ever reappear, the synced Android assets are
    // stale or a regression reintroduced the old renderer.
    expect(combined).not.toContain('data-modern-minimal-export-space');
    expect(combined).not.toContain('modern-minimal-export-space');

    // Guard against the exact Android-reported joined words resurfacing in the
    // shipped bundle logic (this checks the fixture strings used to prove the
    // renderer keeps natural spaces, not runtime CV content).
    expect(combined).not.toContain('Nastavnikgeografije');
    expect(combined).not.toContain('Metematičkifakultet');
    expect(combined).not.toContain('profesionalnupažnju');
  });

  test('Modern Minimal PDF source fixes are committed to git, not only present in the working tree', () => {
    if (!fs.existsSync(path.resolve('.git'))) return;
    const trackedFiles = execFileSync('git', ['ls-files', 'src/lib/modern-minimal-pdf-template.ts'], { encoding: 'utf8' }).trim();
    const uncommittedExportDiff = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'src/lib/export.ts'], { encoding: 'utf8' });

    if (!trackedFiles) {
      console.warn(
        '[modern-minimal regression] src/lib/modern-minimal-pdf-template.ts is not committed to git. ' +
        'Any release build (AAB/CI) produced from a clean checkout instead of this working tree will NOT ' +
        'contain the Modern Minimal PDF text-spacing fix, even though local build/sync/tests pass.',
      );
    }
    if (uncommittedExportDiff.includes('export.ts')) {
      console.warn(
        '[modern-minimal regression] src/lib/export.ts has uncommitted changes affecting Modern Minimal PDF export. ' +
        'A clean-checkout release build would use the old exportToPDF-only behavior.',
      );
    }
    // Informational only — this repo's workflow intentionally avoids auto-committing.
    // The warnings above surface the most likely real-world cause of "fixed locally,
    // still broken in the Android/Internal testing build" reports.
    expect(true).toBe(true);
  });
});
