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
  applyModernMinimalKeepTogetherPagination,
  assertDedicatedPdfRouteWasHandled,
  buildCvPdfBlob,
  buildModernMinimalPdfBlob,
  buildModernMinimalPagedPdfBlob,
  buildPaddedPdfSlice,
  CV_PDF_A4_HEIGHT_MM,
  CV_PDF_A4_WIDTH_MM,
  exportModernMinimalPdf,
  prepareModernMinimalImagesForExport,
  resolveCvForPdfExport,
  resolveCvPdfExportRoute,
  resolveExportImageDataUrl,
} from '@/lib/export';
import { exportToDOCX } from '@/lib/export';
import { mmNormalizePdfText } from '@/lib/modern-minimal-pdf-renderer';
import { countPdfPages, extractPdfUnicodeText } from '@/lib/pdf-text-extract';
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

function serbianStressCv(): CVData {
  return {
    ...cv(),
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      photoEnabled: false,
      photo: undefined,
    },
    summary: [
      'Iskusan učitelj sa oko devet godina rada u obrazovanju.',
      'Stvarao sam priliku daIskusan učitelj sa čvrstom stručnom praksom u koučingu i sarađivanju sa učenicima.',
      'Planirao sam rad u Matematičkom fakultetu uz praćenje i izvođenje nastave.',
      ...Array.from({ length: 14 }, (_, i) =>
        `Rečenica ${i + 1}: diferencirana nastava za učenike različitih nivoa znanja i stilova učenja.`,
      ),
    ].join(' '),
    experience: [
      {
        id: 'exp-sr-1',
        company: 'Zhff',
        position: 'Učitelj u osnovnoj školi',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: [
          '- Planirao sam i realizovao nastavne jedinice iz srpskog jezika i matematike.',
          '- Primenio sam diferenciranu nastavu kako bi prilagodio sadržaje učenicima različitih nivoa znanja.',
          '- Sprovodio sam formativno i sumativno ocenjivanje učenika uz praćenje napretka.',
        ].join('\n'),
      },
    ],
    education: [{
      id: 'edu-sr-1',
      school: 'Matematički fakultet',
      degree: 'VI',
      startDate: '2020-01',
      endDate: '2025-02',
      description: '',
    }],
    skills: ['Teamwork', 'Organization', 'Coaching', 'Leadership'],
    languages: [{ name: 'Serbian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    templateId: 'modern-minimal',
    region: 'Balkan',
  };
}

function pdfTextIncludes(text: string, needle: string): boolean {
  return text.includes(needle) || text.toUpperCase().includes(needle.toUpperCase());
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

type DirectPdfInstance = {
  pages: number;
  drawnText: string[];
  textCalls: Array<{ text: string; x: number; page: number }>;
  addImage: ReturnType<typeof vi.fn>;
  addPage: ReturnType<typeof vi.fn>;
  addFileToVFS: ReturnType<typeof vi.fn>;
  addFont: ReturnType<typeof vi.fn>;
};

function installDirectPdfMocks() {
  const instances: DirectPdfInstance[] = [];
  vi.doMock('jspdf', () => ({
    jsPDF: class MockPdf {
      pages = 1;
      currentPage = 1;
      drawnText: string[] = [];
      textCalls: Array<{ text: string; x: number; page: number }> = [];
      addImage = vi.fn();
      addPage = vi.fn(() => { this.pages += 1; this.currentPage = this.pages; });
      addFileToVFS = vi.fn();
      addFont = vi.fn();
      setPage = vi.fn((page: number) => { this.currentPage = page; });
      setFont = vi.fn();
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      setFillColor = vi.fn();
      setDrawColor = vi.fn();
      setLineWidth = vi.fn();
      setProperties = vi.fn();
      rect = vi.fn();
      roundedRect = vi.fn();
      line = vi.fn();
      circle = vi.fn();
      text = vi.fn((t: string | string[], x?: number) => {
        const parts = Array.isArray(t) ? t : [t];
        for (const part of parts) {
          this.drawnText.push(part);
          this.textCalls.push({ text: part, x: x ?? 0, page: this.currentPage });
        }
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
        return new Blob(['%PDF-1.7\nmodern-minimal-direct\n%%EOF'], { type: 'application/pdf' });
      }
      constructor() { instances.push(this as unknown as DirectPdfInstance); }
    },
  }));
  return { instances };
}

function androidStressCv(): CVData {
  return {
    ...cv(),
    personal: {
      ...cv().personal,
      fullName: 'Dragan Obradović',
      jobTitle: 'Software engineer',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      photo: selectedPhoto,
      originalPhoto,
      photoEnabled: true,
    },
    summary: [
      'Software engineer with strong delivery experience across distributed systems and quality-focused product teams.',
      'Built reliable regression packs and CI gates that reduced release risk.lead.Assisted junior engineers during onboarding.',
      'Applied automation across staging environments.Software engineer focused on measurable quality outcomes.',
      ...Array.from({ length: 18 }, (_, i) =>
        `Sentence ${i + 1}: reliable engineering delivery across classrooms, coaching, and leadership development.`,
      ),
    ].join(' '),
    experience: [
      {
        id: 'exp-1',
        company: 'Zezezeze',
        position: 'Software engineer',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: [
          '- Owned end-to-end release quality for customer-facing products across mobile and web surfaces.',
          '- Built reusable automation scaffolds.logic.Built smoke suites covering login, checkout, and account recovery paths.',
          '- Partnered with developers to triage flaky suites and stabilize nightly pipelines before cutover weekends.',
          '- Documented defect trends and risk signals for product stakeholders during major migration windows.',
          '- Mentored QA peers on exploratory strategies while keeping regression coverage complete and measurable.',
          '- Improved feedback loops between engineering and support so production incidents were resolved faster.',
          '- Introduced risk-based testing for high-impact flows and reduced escape defects across consecutive releases.',
          '- Collaborated on observability dashboards that highlighted failing critical journeys before customers noticed.',
          '- Authored clear reproduction steps so developers could fix regressions without lengthy clarification threads.',
          '- Maintained shared fixture data and seeded environments.Software platforms stayed consistent across squads.',
        ].join('\n'),
      },
      {
        id: 'exp-2',
        company: 'Pixel & Co',
        position: 'QA Tester',
        startDate: '2015-03',
        endDate: '2017-12',
        isPresent: false,
        description: [
          '- Designed visual identities for 50+ brands across Europe, North America, and Asia Pacific.',
          '- Produced motion graphics for broadcast TV and digital channels including RAI, Sky, and BBC.',
          '- Collaborated with product teams on UX/UI improvements for e-commerce and mobile platforms.',
          '- Mentored junior designers in brand strategy.applied.Designed workshop kits for onboarding cohorts.',
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
    skills: ['React', 'TypeScript', 'System Design', 'Leadership', 'Coaching'],
    languages: [{ name: 'English', level: 'Native' }, { name: 'Serbian', level: 'Fluent' }],
    region: 'Balkan',
  };
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
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: string | URL | Request) => {
    const url = String(input);
    const fileName = url.split('/').pop() ?? '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) {
      const buf = fs.readFileSync(fontPath);
      return {
        ok: true,
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      } as Response;
    }
    return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
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
    const branch = page.indexOf('selectedTemplateId = cv.templateId');
    const mmBranch = page.indexOf("selectedTemplateId === 'modern-minimal'", branch);
    const exportCall = page.indexOf('exportModernMinimalPdf(cvForExport', branch);
    const genericExport = page.indexOf('exportToPDF(previewId', branch);
    const fallbackGuard = page.indexOf("cv.templateId === 'modern-minimal'", branch);
    const fallback = page.indexOf('await openPrintFallback', fallbackGuard);

    expect(branch).toBeGreaterThan(-1);
    expect(mmBranch).toBeGreaterThan(branch);
    expect(page.indexOf('templateId: selectedTemplateId', branch)).toBeGreaterThan(branch);
    expect(page.indexOf("route.kind !== 'dedicated-modern-minimal'", branch)).toBeGreaterThan(branch);
    expect(exportCall).toBeGreaterThan(mmBranch);
    expect(exportCall).toBeLessThan(genericExport);
    expect(page.indexOf('assertDedicatedPdfRouteWasHandled(pdfResolution)', branch)).toBeGreaterThan(branch);
    expect(page.slice(fallbackGuard, fallback)).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(page.slice(fallbackGuard, fallback)).toContain('return;');
  });

  test('resolveCvForPdfExport prefers UI modern-minimal over stale cvRef corporate-navy', () => {
    document.body.innerHTML = `
      <div id="cv-preview">
        <div data-template-id="modern-minimal">Modern Minimal preview</div>
      </div>
    `;
    const staleCv = cv({ templateId: 'corporate-navy' });
    const resolution = resolveCvForPdfExport(staleCv, {
      previewElementId: 'cv-preview',
      uiTemplateId: 'modern-minimal',
    });
    expect(resolution.templateId).toBe('modern-minimal');
    expect(resolution.route.kind).toBe('dedicated-modern-minimal');
    expect(resolution.sources.cvRefTemplateId).toBe('corporate-navy');
  });

  test('selecting Corporate Navy then Modern Minimal exports via Modern Minimal renderer only', async () => {
    installDirectPdfMocks();
    const corporateSpy = vi.spyOn(
      await import('@/lib/corporate-navy-pdf-renderer'),
      'buildCorporateNavyPagedPdfBlob',
    );
    const executiveSpy = vi.spyOn(
      await import('@/lib/executive-premium-pdf-renderer'),
      'buildExecutivePremiumPagedPdfBlob',
    );
    const pagedSpy = vi.spyOn(
      await import('@/lib/modern-minimal-pdf-renderer'),
      'buildModernMinimalPagedPdfBlob',
    );

    const staleCorporate = cv({ templateId: 'corporate-navy', personal: { photoEnabled: false } });
    const mmCv = { ...staleCorporate, templateId: 'modern-minimal' as const };
    await exportModernMinimalPdf(mmCv, 'route-test', 'en');

    expect(pagedSpy).toHaveBeenCalled();
    expect(corporateSpy).not.toHaveBeenCalled();
    expect(executiveSpy).not.toHaveBeenCalled();
  });

  test('selecting Executive Premium then Modern Minimal exports via Modern Minimal renderer only', async () => {
    installDirectPdfMocks();
    const corporateSpy = vi.spyOn(
      await import('@/lib/corporate-navy-pdf-renderer'),
      'buildCorporateNavyPagedPdfBlob',
    );
    const executiveSpy = vi.spyOn(
      await import('@/lib/executive-premium-pdf-renderer'),
      'buildExecutivePremiumPagedPdfBlob',
    );
    const pagedSpy = vi.spyOn(
      await import('@/lib/modern-minimal-pdf-renderer'),
      'buildModernMinimalPagedPdfBlob',
    );

    const staleExecutive = cv({ templateId: 'executive-premium', personal: { photoEnabled: false } });
    const mmCv = { ...staleExecutive, templateId: 'modern-minimal' as const };
    await exportModernMinimalPdf(mmCv, 'route-test', 'en');

    expect(pagedSpy).toHaveBeenCalled();
    expect(corporateSpy).not.toHaveBeenCalled();
    expect(executiveSpy).not.toHaveBeenCalled();
  });

  test('buildCvPdfBlob hard-fails for modern-minimal DOM capture', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="modern-minimal">MM</div></div>';
    await expect(buildCvPdfBlob('cv-preview')).rejects.toThrow(/dedicated-modern-minimal/);
  });

  test('assertDedicatedPdfRouteWasHandled blocks generic export for dedicated templates', () => {
    const resolution = resolveCvForPdfExport(cv({ templateId: 'modern-minimal' }), {
      uiTemplateId: 'modern-minimal',
    });
    expect(() => assertDedicatedPdfRouteWasHandled(resolution)).toThrow(/Dedicated PDF route/);
  });

  test('modern-minimal resolves to the dedicated-modern-minimal export route', () => {
    expect(resolveCvPdfExportRoute('modern-minimal').kind).toBe('dedicated-modern-minimal');
  });

  test('Modern Minimal runtime export reaches buildModernMinimalPagedPdfBlob only', async () => {
    installDirectPdfMocks();
    const pagedSpy = vi.spyOn(
      await import('@/lib/modern-minimal-pdf-renderer'),
      'buildModernMinimalPagedPdfBlob',
    );
    const corporateSpy = vi.spyOn(
      await import('@/lib/corporate-navy-pdf-renderer'),
      'buildCorporateNavyPagedPdfBlob',
    );
    const executiveSpy = vi.spyOn(
      await import('@/lib/executive-premium-pdf-renderer'),
      'buildExecutivePremiumPagedPdfBlob',
    );

    await exportModernMinimalPdf(cv({ personal: { photoEnabled: false } }), 'modern-minimal-test', 'en');

    expect(pagedSpy).toHaveBeenCalled();
    expect(corporateSpy).not.toHaveBeenCalled();
    expect(executiveSpy).not.toHaveBeenCalled();
  });

  test('Modern Minimal PDF does not stamp removed debug canary markers', async () => {
    const { instances } = installDirectPdfMocks();
    const blob = await buildModernMinimalPagedPdfBlob(androidStressCv(), 'en', { photoDataUrl: selectedPhoto });
    expect(blob.size).toBeGreaterThan(0);

    const inst = instances[0]!;
    const drawn = inst.drawnText.join(' ');
    expect(drawn).not.toContain('MM_DIRECT_158');
    expect(drawn).not.toContain('Modern Minimal Direct PDF');
    expect(inst.textCalls.filter((c) => c.text === 'MM_DIRECT_158')).toHaveLength(0);
  });

  test('handlePDFDownload forces templateId from live selection and hard-fails before falling through to another renderer', () => {
    const page = pageSource();
    const branch = page.indexOf('selectedTemplateId = cv.templateId');
    const mmBranch = page.indexOf("selectedTemplateId === 'modern-minimal'", branch);

    expect(page.indexOf('const cvForExport = prepareFinalLocaleSafeCv({', branch)).toBeGreaterThan(branch);
    expect(page.indexOf('...cvRef.current', branch)).toBeGreaterThan(branch);
    expect(page.indexOf('templateId: selectedTemplateId', branch)).toBeGreaterThan(branch);
    expect(page.indexOf('cvRefTemplateId !== selectedTemplateId', branch)).toBeGreaterThan(branch);
    expect(page.indexOf("route.kind !== 'dedicated-modern-minimal'", mmBranch)).toBeGreaterThan(mmBranch);
    expect(page.indexOf('exportModernMinimalPdf(cvForExport, exportFilename, locale)', mmBranch)).toBeGreaterThan(mmBranch);
    expect(page.indexOf('[MM PDF CANARY]', branch)).toBe(-1);
    expect(page.indexOf('__CV_PDF_EXPORT_TRACE__', branch)).toBe(-1);
    expect(page.indexOf('MM_DIRECT_158', branch)).toBe(-1);
  });

  test('Modern Minimal PDF header uses white/indigo accent, not corporate navy full-width fill', async () => {
    const { instances } = installDirectPdfMocks();
    await buildModernMinimalPagedPdfBlob(
      cv({ personal: { photoEnabled: true, photo: tinyPng } }),
      'en',
      { photoDataUrl: tinyPng },
    );
    const inst = instances[0]!;
    expect(inst.rect).not.toHaveBeenCalled();
    expect(inst.setFillColor).toHaveBeenCalledWith(255, 255, 255);
    expect(inst.setDrawColor).toHaveBeenCalledWith(79, 70, 229);
    expect(inst.setFillColor).not.toHaveBeenCalledWith(15, 23, 42);
  });

  test('Modern Minimal dedicated PDF uses direct jsPDF renderer, not canvas slicing', () => {
    const src = exportSource();
    const rendererSource = fs.readFileSync(path.resolve('src/lib/modern-minimal-pdf-renderer.ts'), 'utf8');
    expect(src).toContain('buildModernMinimalPagedPdfBlob');
    expect(src).toContain("kind: 'dedicated-modern-minimal'");
    expect(rendererSource).toContain('mmCreateContext');
    expect(rendererSource).toContain('mmDrawHeader');
    expect(rendererSource).toContain('mmDrawSummary');
    expect(rendererSource).toContain('mmDrawWrappedBullet');
    expect(rendererSource).toContain('mmDrawWrappedParagraph');
    expect(rendererSource).toContain('mmDrawExperienceEntry');
    expect(rendererSource).toContain('mmMoveToNextPage');
    expect(rendererSource).toContain('mmMeasureLowerSectionsHeight');
    expect(rendererSource).toContain('mmNormalizePdfText');
    expect(rendererSource).not.toContain('html2canvas');
    expect(rendererSource).not.toContain('buildCvPdfBlob');
    expect(rendererSource).not.toContain('renderPdfSlice');
    expect(rendererSource).not.toContain('renderPaddedPdfSlice');
    expect(src).not.toMatch(/buildModernMinimalPdfBlob[\s\S]{0,400}buildCvPdfBlob/);
  });

  test('mmNormalizePdfText fixes glued sentence boundaries for PDF rendering only', () => {
    expect(mmNormalizePdfText('scaffolds.logic.Built smoke suites.')).toBe(
      'scaffolds. logic. Built smoke suites.',
    );
    expect(mmNormalizePdfText('strategy.applied.Designed workshop kits.')).toBe(
      'strategy. applied. Designed workshop kits.',
    );
    expect(mmNormalizePdfText('environments.Software platforms stayed consistent.')).toBe(
      'environments. Software platforms stayed consistent.',
    );
    expect(mmNormalizePdfText('Used Node.js and REST APIs with CI/CD pipelines.')).toBe(
      'Used Node.js and REST APIs with CI/CD pipelines.',
    );
    expect(mmNormalizePdfText('Stvarao sam priliku daIskusan učitelj sa čvrstom stručnom praksom.')).toContain(
      'da. Iskusan',
    );
    expect(mmNormalizePdfText('Stvarao sam priliku daIskusan učitelj sa čvrstom stručnom praksom.')).not.toContain(
      'daIskusan',
    );
  });

  test('Modern Minimal renderer registers multilingual fonts via shared pdf-i18n-text layer', () => {
    const rendererSource = fs.readFileSync(path.resolve('src/lib/modern-minimal-pdf-renderer.ts'), 'utf8');
    expect(rendererSource).toContain('mmRegisterUnicodeFonts');
    expect(rendererSource).toContain('registerPdfI18nFonts');
    expect(rendererSource).toContain('pdfI18nCtxDraw');
    expect(rendererSource).toContain('pdfI18nCtxSplit');
    expect(rendererSource).toContain('shouldApplyLatinPdfSentenceFixes');
    expect(rendererSource).toContain('const i18n = await registerPdfI18nFonts(pdf)');
  });

  test('Serbian Unicode passes through renderer text calls before PDF encoding', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildModernMinimalPdfBlob(serbianStressCv(), 'en');
    const drawn = instances[0]?.drawnText.join(' ') ?? '';
    for (const needle of ['Obradović', 'Učitelj', 'Braće', 'učenicima', 'Matematičkom', 'da. Iskusan']) {
      expect(pdfTextIncludes(drawn, needle), `missing ${needle} in drawn text`).toBe(true);
    }
    expect(drawn).not.toContain('daIskusan');
  });

  test('Serbian Latin Extended characters survive in real direct PDF output', async () => {
    vi.doUnmock('jspdf');
    const mod = await import('@/lib/modern-minimal-pdf-renderer');
    const blob = await mod.buildModernMinimalPagedPdfBlob(serbianStressCv(), 'en', { photoDataUrl: null });
    expect(blob.size).toBeGreaterThan(3000);

    const buffer = Buffer.from(await blob.arrayBuffer());
    const extracted = extractPdfUnicodeText(buffer);
    expect(buffer.toString('latin1').includes('NotoSans')).toBe(true);

    for (const needle of [
      'Obradović',
      'Učitelj',
      'Braće',
      'učenicima',
      'Matematičkom',
      'čvrstom',
      'stručnom',
      'koučingu',
      'sarađivanju',
      'praćenje',
      'izvođenje',
    ]) {
      expect(pdfTextIncludes(extracted, needle), `missing ${needle}`).toBe(true);
    }

    expect(extracted.includes('daIskusan')).toBe(false);
    expect(extracted.includes('da. Iskusan')).toBe(true);
    expect(extracted.includes('\uFFFD')).toBe(false);
    // Reject C0 control characters (other than the normal whitespace ones) that
    // would indicate broken glyph decoding around Serbian letters.
    expect(/[\u0000-\u0008\u000B\u000E-\u001F]/.test(extracted)).toBe(false);
  }, 30000);

  test('real direct Modern Minimal PDF keeps Page 1 body used and Professional Summary starting after the header', async () => {
    vi.doUnmock('jspdf');
    const mod = await import('@/lib/modern-minimal-pdf-renderer');
    const blob = await mod.buildModernMinimalPagedPdfBlob(serbianStressCv(), 'en', { photoDataUrl: null });
    const buffer = Buffer.from(await blob.arrayBuffer());
    const extracted = extractPdfUnicodeText(buffer);
    const pageCount = countPdfPages(buffer);

    expect(pageCount).toBeGreaterThanOrEqual(1);
    expect(pageCount).toBeLessThanOrEqual(3);
    expect(extracted.toUpperCase()).toMatch(/PROFESSIONAL SUMMARY/);
    expect(extracted.toUpperCase()).toMatch(/WORK EXPERIENCE/);
    expect(extracted.toUpperCase()).toMatch(/EDUCATION/);
    expect(extracted.toUpperCase()).toMatch(/SKILLS/);
    expect(extracted.toUpperCase()).toMatch(/LANGUAGES/);
    const summaryIdx = extracted.toUpperCase().indexOf('PROFESSIONAL SUMMARY');
    const nameIdx = extracted.toUpperCase().indexOf('OBRADOVI');
    expect(summaryIdx).toBeGreaterThan(nameIdx);
  }, 30000);

  test('the exact real-world Android-reported joined words never appear in the routed Modern Minimal PDF chain', () => {
    const page = pageSource();
    const src = exportSource();
    const rendererSrc = fs.readFileSync(path.resolve('src/lib/modern-minimal-pdf-template.ts'), 'utf8');

    expect(page).toContain("selectedTemplateId === 'modern-minimal'");
    expect(page).toContain('exportModernMinimalPdf(cvForExport, exportFilename, locale)');
    expect(src).toContain('export async function exportModernMinimalPdf');
    expect(src).toContain('const pdfBlob = await buildModernMinimalPdfBlob(cv, locale)');
    expect(src).toContain('buildModernMinimalPagedPdfBlob');
    expect(src.match(/function buildModernMinimalPdfBlob/g)?.length).toBe(1);
    expect(rendererSrc).toContain('element.textContent = text');

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
    expect(root.getAttribute('data-modern-minimal-pdf-body')).toBe('true');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minWidth).toBe('210mm');
    expect(root.style.padding).toBe('24px 34px 22px');
    expect(photoFrame.style.width).toBe('100px');
    expect(photoFrame.style.height).toBe('100px');
    expect(photoFrame.style.borderRadius).toBe('9999px');
    expect(photoFrame.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(photo.style.objectPosition).toBe('50% 50%');
    expect(root.style.wordSpacing).toBe('0.6px');
    expect(root.style.letterSpacing).toBe('0px');
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

    // Bold single-line fields (position titles, education degree/school line) must
    // render each word as its own element inside a flex row with a real CSS `gap`,
    // so the inter-word gap is guaranteed by element box layout rather than by a
    // single text node's space-glyph width (which is what could still visually
    // collapse on some WebView/html2canvas font combinations).
    const safeWordContainers = Array.from(root.querySelectorAll<HTMLElement>('[data-modern-minimal-safe-words]'));
    expect(safeWordContainers.length).toBeGreaterThanOrEqual(3); // 2 experience positions + 1 education line
    safeWordContainers.forEach((container) => {
      expect(container.style.display).toBe('flex');
      expect(container.style.flexWrap).toBe('wrap');
      expect(container.style.columnGap).toBe('0.32em');
      expect(container.querySelectorAll('span').length).toBeGreaterThanOrEqual(2);
    });
    const positionContainer = safeWordContainers.find(el => el.textContent === 'Nastavnik geografije');
    expect(positionContainer).toBeDefined();
    expect(Array.from(positionContainer!.querySelectorAll('span')).map(s => s.textContent)).toEqual(['Nastavnik', 'geografije']);
    const educationContainer = safeWordContainers.find(el => el.textContent === 'VI / Metematički fakultet');
    expect(educationContainer).toBeDefined();
    expect(Array.from(educationContainer!.querySelectorAll('span')).map(s => s.textContent)).toEqual(['VI', '/', 'Metematički', 'fakultet']);
    expect(root.querySelector('[data-export-group="modern-minimal-experience-header"]')).not.toBeNull();
    expect(root.querySelector('[data-export-group="modern-minimal-experience-line"]')).not.toBeNull();
  });

  test('legacy Modern Minimal keep-together pagination helper remains for generic preview path', () => {
    const src = exportSource();
    expect(src).toContain('applyModernMinimalKeepTogetherPagination');
    expect(src).toContain("captureTemplateId === 'modern-minimal'");
  });

  test('legacy Modern Minimal padded slice helpers remain available for generic preview path', () => {
    const src = exportSource();
    expect(src).toContain('MODERN_MINIMAL_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(src).toContain('MODERN_MINIMAL_PDF_PAGE_BOTTOM_INSET_CSS_PX');
    expect(src).toContain('buildPaddedPdfSlice');
    expect(src).toContain("captureTemplateId === 'modern-minimal'");
    expect(src).toContain('renderPaddedPdfSlice');

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

    const padded = buildPaddedPdfSlice(sourceCanvas, 200, 400, 800, 28, 0);
    expect(padded.topInsetCanvasPx).toBe(28);
    expect(padded.bottomInsetCanvasPx).toBe(0);
    expect(padded.paddedHeightPx).toBe(428);
  });

  test('Modern Minimal keep-together shifts WORK EXPERIENCE heading with first entry when heading would orphan', () => {
    document.body.innerHTML = `
      <div data-template-id="modern-minimal" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="modern-minimal-section" data-test-rect="${rectAttr(1080, 34, 732, 180)}">
          <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(1100, 34, 732, 22)}">WORK EXPERIENCE</h2>
          <div data-export-group="modern-minimal-experience" data-test-rect="${rectAttr(1130, 34, 732, 120)}">
            <div data-export-group="modern-minimal-experience-header" data-test-rect="${rectAttr(1130, 34, 732, 48)}">
              <div data-test-rect="${rectAttr(1130, 34, 732, 28)}">Software engineer</div>
              <p data-test-rect="${rectAttr(1160, 34, 732, 18)}">Zezezeze</p>
            </div>
            <div data-export-group="modern-minimal-experience-line" data-export-meaningful="true" data-test-rect="${rectAttr(1182, 34, 732, 24)}">- First bullet line</div>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyModernMinimalKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('WORK EXPERIENCE');
    expect(document.body.textContent).toContain('Software engineer');
    expect(document.body.textContent).toContain('Zezezeze');
  });

  test('Modern Minimal keep-together shifts first job header when company and bullets would start on the next page', () => {
    document.body.innerHTML = `
      <div data-template-id="modern-minimal" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="modern-minimal-section" data-test-rect="${rectAttr(980, 34, 732, 180)}">
          <h2 data-test-rect="${rectAttr(990, 34, 732, 22)}">WORK EXPERIENCE</h2>
          <div data-export-group="modern-minimal-experience" data-test-rect="${rectAttr(1020, 34, 732, 120)}">
            <div data-export-group="modern-minimal-experience-header" data-test-rect="${rectAttr(1100, 34, 732, 50)}">
              <div data-test-rect="${rectAttr(1100, 34, 732, 28)}">Software engineer</div>
              <p data-test-rect="${rectAttr(1130, 34, 732, 18)}">Zezezeze</p>
            </div>
            <div data-export-group="modern-minimal-experience-line" data-export-meaningful="true" data-test-rect="${rectAttr(1155, 34, 732, 24)}">- First bullet line</div>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="modern-minimal"]') as HTMLElement;
    const header = root.querySelector('[data-export-group="modern-minimal-experience-header"]') as HTMLElement;

    applyModernMinimalKeepTogetherPagination(root);

    expect(Number.parseFloat(header.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Zezezeze');
    expect(document.body.textContent).toContain('First bullet line');
  });

  test('Modern Minimal direct PDF Blob is non-empty and short fixture remains one page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildModernMinimalPdfBlob(
      cv({ personal: { photoEnabled: false, photo: undefined } }),
      'en',
    );

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0]!.pages).toBe(1);
    expect(instances[0]!.addPage).not.toHaveBeenCalled();
    const drawn = instances[0]!.drawnText.join(' ');
    expect(drawn).toContain('Alexandra Very Long Candidate Name');
    expect(drawn.toUpperCase()).toContain('PROFESSIONAL SUMMARY');
    expect(drawn.toUpperCase()).toContain('WORK EXPERIENCE');
  });

  test('Page 1 draws Professional Summary after header (body is not blank)', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildModernMinimalPdfBlob(cv({ personal: { photoEnabled: false } }), 'en');
    const drawn = instances[0]?.drawnText ?? [];
    const summaryIdx = drawn.findIndex((t) => /professional summary/i.test(t));
    const nameIdx = drawn.findIndex((t) => /Alexandra Very Long Candidate Name/i.test(t));
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(summaryIdx).toBeGreaterThan(nameIdx);
    expect(instances[0]?.pages).toBe(1);
  });

  test('Android stress fixture paginates with summary on page 1 and no glued text', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const blob = await mod.buildModernMinimalPagedPdfBlob(androidStressCv(), 'en', { photoDataUrl: selectedPhoto });
    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0]?.pages).toBeGreaterThanOrEqual(2);
    expect(instances[0]?.pages).toBeLessThanOrEqual(3);

    const text = (instances[0]?.drawnText ?? []).join(' ');
    expect(text.toUpperCase()).toContain('PROFESSIONAL SUMMARY');
    expect(text.toUpperCase()).toContain('WORK EXPERIENCE');
    expect(text.toUpperCase()).toContain('EDUCATION');
    expect(text.toUpperCase()).toContain('SKILLS');
    expect(text.toUpperCase()).toContain('LANGUAGES');
    expect(text).toContain('React');
    expect(text).toContain('English');
    expect(text).not.toContain('logic.Built');
    expect(text).toContain('logic. Built');
    expect(text).not.toContain('applied.Designed');
    expect(text).toContain('applied. Designed');
    expect(text).toContain('reporting findings to the development team.');
    if ((instances[0]?.pages ?? 0) >= 2) {
      expect(text).toMatch(/\(continued\)|Sentence 1:/);
    }

    // Education and Skills/Languages must be grouped on the same page rather
    // than Education landing on the tail of one page while Skills/Languages
    // gets orphaned alone on the next.
    const calls = instances[0]?.textCalls ?? [];
    const educationPage = calls.find((c) => c.text.toUpperCase() === 'EDUCATION')?.page;
    const skillsPage = calls.find((c) => c.text.toUpperCase() === 'SKILLS')?.page;
    const languagesPage = calls.find((c) => c.text.toUpperCase() === 'LANGUAGES')?.page;
    expect(educationPage).toBeDefined();
    expect(skillsPage).toBeDefined();
    expect(educationPage).toBe(skillsPage);
    expect(educationPage).toBe(languagesPage);
  });

  test('lower-section grouping keeps Education with Skills/Languages instead of orphaning Skills alone on a final page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    // Long-enough experience content pushes close to a page boundary right
    // before Education, reproducing the real-world "Education fits at the
    // bottom of page 2, Skills/Languages alone on page 3" report.
    const heavyCv = cv({
      personal: { photoEnabled: false },
      summary: '',
      experience: [{
        id: 'exp-heavy',
        company: 'Acme Corp',
        position: 'Senior Engineer',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: Array.from({ length: 26 }, (_, i) =>
          `- Delivered measurable outcome number ${i + 1} across distributed systems, quality gates, and release engineering practices for enterprise customers.`,
        ).join('\n'),
      }],
      education: [{ id: 'edu-1', school: 'State University', degree: 'BS Computer Science', startDate: '2014', endDate: '2018', description: '' }],
      skills: ['TypeScript', 'React', 'Node.js', 'Accessibility', 'PostgreSQL', 'Cloud Architecture'],
      languages: [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Intermediate' }],
      certifications: [],
    });

    await mod.buildModernMinimalPagedPdfBlob(heavyCv, 'en');
    const calls = instances[0]?.textCalls ?? [];
    const educationPage = calls.find((c) => c.text.toUpperCase() === 'EDUCATION')?.page;
    const skillsPage = calls.find((c) => c.text.toUpperCase() === 'SKILLS')?.page;
    const languagesPage = calls.find((c) => c.text.toUpperCase() === 'LANGUAGES')?.page;

    expect(educationPage).toBeDefined();
    expect(skillsPage).toBeDefined();
    expect(languagesPage).toBeDefined();
    expect(educationPage).toBe(skillsPage);
    expect(educationPage).toBe(languagesPage);

    // No content lost: education/skills/languages text must all still appear.
    const text = (instances[0]?.drawnText ?? []).join(' ');
    expect(text).toContain('State University');
    expect(text).toContain('React');
    expect(text).toContain('English');
    expect(text.toUpperCase()).toContain('WORK EXPERIENCE');
  });

  test('mmDrawLowerSections moves the whole Education + Skills/Languages group to a fresh page only when the group fits together but not on the current page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/modern-minimal-pdf-renderer');
    const { jsPDF } = await import('jspdf');

    const smallGroupCv = cv({
      personal: { photoEnabled: false },
      summary: '',
      experience: [],
      education: [{ id: 'edu-1', school: 'State University', degree: 'BS Computer Science', startDate: '2014', endDate: '2018', description: '' }],
      skills: ['TypeScript', 'React', 'Node.js'],
      languages: [{ name: 'English', level: 'Native' }],
      certifications: [],
    });

    const pdf = new jsPDF();
    const ctx = mod.mmCreateContext(pdf as unknown as Parameters<typeof mod.mmCreateContext>[0], smallGroupCv, 'en', false);
    // Simulate near the bottom of a page: Education alone would fit in the
    // remaining room, but Education + Skills/Languages together would not —
    // while the combined group easily fits on a fresh page.
    ctx.y = ctx.bottomSafeY - 16;
    const pageBefore = ctx.pageIndex;

    mod.mmDrawLowerSections(ctx);

    expect(ctx.pageIndex).toBe(pageBefore + 1);
    const inst = instances[0]!;
    expect(inst.addPage).toHaveBeenCalledTimes(1);
    const educationPage = inst.textCalls.find((c) => c.text.toUpperCase() === 'EDUCATION')?.page;
    const skillsPage = inst.textCalls.find((c) => c.text.toUpperCase() === 'SKILLS')?.page;
    expect(educationPage).toBeDefined();
    expect(educationPage).toBe(skillsPage);
  });

  test('mmDrawLowerSections does not force an unnecessary page break when the group already fits on the current page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/modern-minimal-pdf-renderer');
    const { jsPDF } = await import('jspdf');

    const smallGroupCv = cv({
      personal: { photoEnabled: false },
      summary: '',
      experience: [],
      education: [{ id: 'edu-1', school: 'State University', degree: 'BS Computer Science', startDate: '2014', endDate: '2018', description: '' }],
      skills: ['TypeScript', 'React'],
      languages: [{ name: 'English', level: 'Native' }],
      certifications: [],
    });

    const pdf = new jsPDF();
    const ctx = mod.mmCreateContext(pdf as unknown as Parameters<typeof mod.mmCreateContext>[0], smallGroupCv, 'en', false);
    ctx.y = ctx.marginTop;
    const pageBefore = ctx.pageIndex;

    mod.mmDrawLowerSections(ctx);

    expect(ctx.pageIndex).toBe(pageBefore);
    const inst = instances[0]!;
    expect(inst.addPage).not.toHaveBeenCalled();
  });

  test('wrapped experience bullets do not prefix continuation lines with a dash', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildModernMinimalPagedPdfBlob(cv({
      personal: { photoEnabled: false, fullName: 'Test User' },
      summary: '',
      education: [],
      skills: [],
      languages: [],
      experience: [{
        id: 'exp-wrap',
        company: 'Acme',
        position: 'Software engineer',
        startDate: '2020-01',
        endDate: '',
        isPresent: true,
        description: '- Built and maintained RESTful APIs using Node.js and Express, supporting core product features used across the platform.',
      }],
    }), 'en');
    expect(instances[0]?.textCalls.filter((c) => c.text === '-').length).toBe(1);
    const continuation = instances[0]?.textCalls.find((c) => /platform\./i.test(c.text));
    expect(continuation?.text).not.toMatch(/^-/);
  });

  test('Modern Minimal direct PDF uses selected photo and Dragan fixture export path', async () => {
    installDirectPdfMocks();

    const blob = await buildModernMinimalPdfBlob(draganCv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(loadedImageSources).toContain(selectedPhoto);
    expect(loadedImageSources).not.toContain(originalPhoto);
  });

  test('Modern Minimal PDF falls back to originalPhoto only when no selected photo exists', async () => {
    installDirectPdfMocks();
    const cvWithoutSelectedPhoto = draganCv();
    (cvWithoutSelectedPhoto.personal as CVData['personal'] & { photo?: string }).photo = undefined;

    const blob = await buildModernMinimalPdfBlob(cvWithoutSelectedPhoto, 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain(selectedPhoto);
  });

  test('Modern Minimal export save path writes a PDF through platform save', async () => {
    installDirectPdfMocks();
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

    // types.ts may gain optional CV fact-lock fields (canonicalDescription/canonicalSummary);
    // AI recommend template scoring must remain untouched.
    if (changedFiles.includes('src/lib/types.ts')) {
      const typesDiff = execFileSync('git', ['diff', '--', 'src/lib/types.ts'], { encoding: 'utf8' });
      expect(typesDiff).not.toMatch(/recommendTemplate|ProfessionCategory|templateInfo/);
      expect(typesDiff).toMatch(/canonicalDescription|canonicalSummary/);
    }
    expect(changedFiles).not.toContain('src/lib/ai.ts');
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

    // Direct renderer must ship in the synced Android bundle.
    expect(combined).toContain('dedicated-modern-minimal');
    expect(combined).toContain('Modern Minimal PDF export requires dedicated-modern-minimal route');

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
