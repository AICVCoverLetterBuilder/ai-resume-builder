/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { NordicCleanTemplate, templateComponents } from '@/components/cv-templates';
import { createNordicCleanPdfTemplate } from '@/lib/nordic-clean-pdf-template';
import {
  buildNordicCleanPdfBlob,
  exportNordicCleanPdf,
  resolveCvPdfExportRoute,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const originalPhoto = `data:image/jpeg;base64,${Buffer.from('nordic-original-photo').toString('base64')}`;
const squarePhoto = `data:image/jpeg;base64,${Buffer.from('nordic-clean-square-photo').toString('base64')}`;
let loadedImageSources: string[] = [];
let drawImageCalls: unknown[][] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'nordic-clean-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      photo: originalPhoto,
      originalPhoto,
      rectangularPhoto: undefined,
      circularPhoto: 'data:image/png;base64,AQID',
      photoEnabled: true,
    },
    summary: 'Iskusan učitelj sa oko devet godina rada u obrazovanju, koji je svoju karijeru gradio kroz neposredan rad sa učenicima.',
    experience: [
      {
        id: 'exp1',
        company: 'Zhff',
        position: 'Učitelj u osnovnoj školi',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: [
          'Planirao sam i realizovao nastavne jedinice iz srpskog jezika i matematike.',
          'Primenio sam diferenciranu nastavu za učenike različitih nivoa znanja.',
        ].join('\n'),
      },
      {
        id: 'exp2',
        company: 'Hfh',
        position: 'Nastavnik geografije',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: 'Sprovodio sam formativno i sumativno ocenjivanje učenika.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Metematički fakultet', degree: 'VI', startDate: '2020-01', endDate: '2025-02', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Time Management', 'Creativity', 'Presentation Skills', 'Coaching', 'Leadership'],
    certifications: [],
    languages: [],
    templateId: 'nordic-clean',
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
        data[index] = 13;
        data[index + 1] = 148;
        data[index + 2] = 136;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,nordic-clean'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const capturedPhotoSrcs: string[] = [];
  const html2canvasMock = vi.fn(async (_target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    const photo = _target.querySelector('[data-export-photo="nordic-clean"]') as HTMLImageElement | null;
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
        return new Blob(['%PDF-1.7\nnordic-clean\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances, capturedPhotoSrcs };
}

type DirectPdfInstance = {
  pages: number;
  drawnText: string[];
  addImage: ReturnType<typeof vi.fn>;
  addPage: ReturnType<typeof vi.fn>;
};

function installDirectPdfMocks() {
  const instances: DirectPdfInstance[] = [];
  vi.doMock('jspdf', () => ({
    jsPDF: class MockPdf {
      pages = 1;
      drawnText: string[] = [];
      addImage = vi.fn();
      addPage = vi.fn(() => { this.pages += 1; });
      setFont = vi.fn();
      setFontSize = vi.fn();
      setTextColor = vi.fn();
      setFillColor = vi.fn();
      setDrawColor = vi.fn();
      setLineWidth = vi.fn();
      rect = vi.fn();
      line = vi.fn();
      text = vi.fn((t: string | string[]) => {
        const parts = Array.isArray(t) ? t : [t];
        this.drawnText.push(...parts);
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
        return new Blob(['%PDF-1.7\nnordic-clean-direct\n%%EOF'], { type: 'application/pdf' });
      }
      constructor() { instances.push(this as unknown as DirectPdfInstance); }
    },
  }));
  return { instances };
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
  vi.doUnmock('@/lib/native-save');
  vi.restoreAllMocks();
});

describe('Nordic Clean PDF export', () => {
  test('live preview has a stable template marker', () => {
    const html = renderToStaticMarkup(<NordicCleanTemplate data={cv()} locale="en" />);

    expect(templateComponents['nordic-clean']).toBe(NordicCleanTemplate);
    expect(html).toContain('data-template-id="nordic-clean"');
  });

  test('dedicated PDF renderer preserves Nordic visual structure and photo', () => {
    const root = createNordicCleanPdfTemplate(cv(), { locale: 'en', photoDataUrl: originalPhoto });

    expect(root.dataset.templateId).toBe('nordic-clean');
    expect(root.style.width).toBe('210mm');
    expect(root.querySelector('[data-nordic-clean-pdf-header]')).not.toBeNull();
    const frame = root.querySelector('[data-export-photo-frame="nordic-clean"]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="nordic-clean"]') as HTMLImageElement;
    expect(frame).not.toBeNull();
    expect(photo).not.toBeNull();
    expect(frame.style.width).toBe('82px');
    expect(frame.style.height).toBe('82px');
    expect(frame.style.minWidth).toBe('82px');
    expect(frame.style.maxWidth).toBe('82px');
    expect(frame.style.minHeight).toBe('82px');
    expect(frame.style.maxHeight).toBe('82px');
    expect(frame.style.borderRadius).toBe('50%');
    expect(frame.style.overflow).toBe('hidden');
    expect(frame.style.flexShrink).toBe('0');
    expect(photo.style.width).toBe('100%');
    expect(photo.style.height).toBe('100%');
    expect(photo.style.objectFit).toBe('cover');
    expect(photo.style.objectPosition).toBe('center center');
    expect(root.textContent).toContain('Dragan Obradović');
    expect(root.textContent).toContain('Učitelj u osnovnoj školi');
    expect(root.textContent).toContain('Teamwork');
    expect(root.querySelectorAll('[data-export-group="nordic-clean-experience"]')).toHaveLength(2);
  });

  test('production handler routes nordic-clean to direct PDF export and disables print fallback', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const branch = pageSource.indexOf("liveCv.templateId === 'nordic-clean'");
    const guard = pageSource.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = pageSource.indexOf('await openPrintFallback', guard);

    expect(branch).toBeGreaterThan(-1);
    expect(pageSource.slice(branch, branch + 500)).toContain('exportNordicCleanPdf');
    expect(guard).toBeGreaterThan(branch);
    expect(fallback).toBeGreaterThan(guard);
    expect(pageSource.slice(guard, fallback)).toContain("cv.templateId === 'nordic-clean'");
  });

  test('nordic-clean resolves to the dedicated-nordic-clean export route', () => {
    expect(resolveCvPdfExportRoute('nordic-clean').kind).toBe('dedicated-nordic-clean');
  });

  test('Nordic Clean dedicated PDF uses direct jsPDF renderer, not canvas slicing', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('buildNordicCleanPagedPdfBlob');
    expect(exportSource).toContain("kind: 'dedicated-nordic-clean'");
    const fnStart = exportSource.indexOf('export async function buildNordicCleanPagedPdfBlob');
    const fnEnd = exportSource.indexOf('export async function buildNordicCleanPdfBlob', fnStart);
    const fn = exportSource.slice(fnStart, fnEnd);
    expect(fn).not.toContain('renderPdfSlice');
    expect(fn).not.toContain('renderPaddedPdfSlice');
    expect(fn).not.toContain('html2canvas');
    expect(fn).not.toContain('buildCvPdfBlob');
  });

  test('Nordic Clean source keeps WORK EXPERIENCE heading with first entry lead block', () => {
    const exportSource = source('src/lib/export.ts');
    const fn = exportSource.indexOf('function ncDrawExperience(');
    const body = exportSource.slice(fn, fn + 600);
    expect(body).toContain('ncMoveToFreshPageIfNeeded');
    expect(body).toContain('ncExperienceLeadBlockHeight');
  });

  test('Nordic Clean source groups Education + lower sections before drawing', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('ncMoveLowerSectionsIfNeeded');
    expect(exportSource).toContain('ncSkillsLanguagesHeight');
    expect(exportSource).toContain('ncEducationHeight');
  });

  test('Nordic Clean long direct PDF export paginates without half-line splits', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const longCv = (): CVData => ({
      ...cv(),
      summary: Array.from({ length: 40 }, (_, i) =>
        `Sentence ${i + 1}: calm focused teaching experience across global classrooms.`,
      ).join(' '),
      experience: [
        {
          id: 'exp-1',
          company: 'Zhff',
          position: 'Učitelj u osnovnoj školi',
          startDate: '2023-05',
          endDate: '',
          isPresent: true,
          description: Array.from({ length: 18 }, (_, i) =>
            `- Achievement ${i + 1}: delivered measurable impact across curriculum, assessment, and classroom work.`,
          ).join('\n'),
        },
        {
          id: 'exp-2',
          company: 'Pixel & Co',
          position: 'Software Tester',
          startDate: '2015-03',
          endDate: '2017-12',
          isPresent: false,
          description: [
            '- Designed visual identities for 50+ brands across Europe, North America, and Asia Pacific.',
            '- Produced motion graphics for broadcast TV and digital channels including RAI, Sky, and BBC.',
            '- Collaborated with product teams on UX/UI improvements for e-commerce and mobile platforms.',
            '- Managed vendor relationships and production timelines for multiple concurrent projects.',
            '- Mentored junior designers in brand strategy fundamentals and professional communication.',
            '- Conducted client workshops and strategic presentations for C-suite stakeholders.',
          ].join('\n'),
        },
      ],
      languages: [{ name: 'Serbian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    });

    const blob = await mod.buildNordicCleanPagedPdfBlob(longCv(), 'en', { photoDataUrl: squarePhoto });
    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0]?.pages).toBeGreaterThanOrEqual(2);
    expect(instances[0]?.pages).toBeLessThanOrEqual(3);
  });

  test('Nordic Clean direct PDF renders Professional Summary heading and body exactly once', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const longSummary = Array.from({ length: 40 }, (_, i) =>
      `Sentence ${i + 1}: calm focused teaching experience across global classrooms.`,
    ).join(' ');

    await mod.buildNordicCleanPagedPdfBlob({
      ...cv(),
      summary: longSummary,
      experience: [{
        id: 'exp-qa',
        company: 'Pixel & Co',
        position: 'Software Tester',
        startDate: '2015-03',
        endDate: '2017-12',
        isPresent: false,
        description: [
          '- QA lead.',
          '- Assisted senior QA engineers with test planning.',
          '- Designed visual identities for 50+ brands across Europe, North America, and Asia Pacific.',
          '- Produced motion graphics for broadcast TV and digital channels including RAI, Sky, and BBC.',
          '- Collaborated with product teams on UX/UI improvements for e-commerce and mobile platforms.',
          '- Managed vendor relationships and production timelines for multiple concurrent projects.',
        ].join('\n'),
      }],
    }, 'en', { photoDataUrl: null });

    const drawn = instances[0]?.drawnText.join(' ') ?? '';
    const count = (needle: string) => {
      let total = 0;
      let pos = 0;
      while (true) {
        const idx = drawn.indexOf(needle, pos);
        if (idx === -1) break;
        total += 1;
        pos = idx + needle.length;
      }
      return total;
    };

    expect(count('PROFESSIONAL SUMMARY')).toBe(1);
    expect(count('Sentence 1:')).toBe(1);
    expect(count('Sentence 40:')).toBe(1);
    expect(count('QA lead.')).toBe(1);
    expect(count('Assisted senior QA engineers')).toBe(1);
    expect(count('Designed visual identities for 50+ brands')).toBe(1);
    expect(drawn).not.toContain('lead.Assisted');
  });

  test('Nordic Clean direct PDF splits glued experience sentences into separate bullet items', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    await mod.buildNordicCleanPagedPdfBlob({
      ...cv(),
      summary: 'Focused QA specialist with strong attention to detail.',
      experience: [{
        id: 'exp-glued',
        company: 'Pixel & Co',
        position: 'Software Tester',
        startDate: '2015-03',
        endDate: '2017-12',
        isPresent: false,
        description: 'QA lead.Assisted senior QA engineers with test planning.',
      }],
    }, 'en', { photoDataUrl: null });

    const drawn = instances[0]?.drawnText.join(' ') ?? '';
    expect(drawn).toContain('QA lead.');
    expect(drawn).toContain('Assisted senior QA engineers');
    expect(drawn).not.toContain('lead.Assisted');
  });

  test('Nordic Clean PDF Blob is non-empty and fixture remains one page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildNordicCleanPdfBlob(cv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
    const drawn = instances[0].drawnText.join(' ');
    expect(drawn).toContain('Dragan Obradović');
    expect(drawn).toContain('Teamwork');
  });

  test('legacy generic preview slicing helpers remain for other templates only', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('NORDIC_CLEAN_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(exportSource).toContain("captureTemplateId === 'nordic-clean'");
    const fnStart = exportSource.indexOf('export async function buildNordicCleanPagedPdfBlob');
    const fnEnd = exportSource.indexOf('export async function buildNordicCleanPdfBlob', fnStart);
    const fn = exportSource.slice(fnStart, fnEnd);
    expect(fn).not.toContain('renderPaddedPdfSlice');
  });

  test('Nordic Clean direct export uses shared native save result', async () => {
    installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const blobByUrl = new Map<string, Blob>();
    let clickedDownload = '';
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:http://nordic/${blobByUrl.size}`;
      blobByUrl.set(url, blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });

    const result = await mod.exportNordicCleanPdf(cv(), 'Dragan Obradovic - CV', 'en');

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickedDownload).toBe('Dragan Obradovic - CV.pdf');
    expect(result.result).toBe('saved');
    expect(result.fileName).toBe('Dragan Obradovic - CV.pdf');
  });

  test('selected original photo is used instead of circularPhoto', async () => {
    installDirectPdfMocks();
    const mod = await import('@/lib/export');

    await mod.buildNordicCleanPdfBlob(cv({
      personal: {
        originalPhoto,
        photo: 'data:image/jpeg;base64,photo-field',
        circularPhoto: 'data:image/png;base64,circular-field',
      },
    }), 'en');

    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain('circular-field');
  });

  test('Nordic Clean photo preparation uses uniform center-cover scaling', async () => {
    installDirectPdfMocks();
    const mod = await import('@/lib/export');

    await mod.buildNordicCleanPdfBlob(cv(), 'en');

    expect(drawImageCalls.length).toBeGreaterThan(0);
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(-82);
    expect(scaledWidth).toBe(164);
    expect(scaledHeight).toBe(328);
  });

  test('Nordic Clean no-photo case renders without a photo frame', () => {
    const root = createNordicCleanPdfTemplate(cv({ personal: { originalPhoto: '', photo: '', photoEnabled: false } }), {
      locale: 'en',
      photoDataUrl: null,
    });

    expect(root.querySelector('[data-export-photo-frame="nordic-clean"]')).toBeNull();
    expect(root.querySelector('[data-export-photo="nordic-clean"]')).toBeNull();
    expect(root.textContent).toContain('Dragan');
  });

  test('Nordic Clean DOCX branch remains dedicated and unchanged', () => {
    const exportSource = source('src/lib/export.ts');
    const branchStart = exportSource.indexOf("cfg.customLayout === 'nordic-clean'");
    const branchEnd = exportSource.indexOf("else if (cfg.customLayout === 'executive-premium')", branchStart);
    const branch = exportSource.slice(branchStart, branchEnd);

    expect(branchStart).toBeGreaterThan(-1);
    expect(branch).toContain('nordic-clean');
    expect(branch).toContain('BorderStyle.SINGLE, size: 4, color:');
  });
});
