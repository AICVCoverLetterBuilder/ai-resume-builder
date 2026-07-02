/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreativeBoldTemplate, templateComponents } from '@/components/cv-templates';
import {
  buildCvPdfBlob,
  createMeaningfulContentPagePlan,
  exportToDOCX,
  exportToPDF,
  isCanvasSliceEffectivelyBlank,
  isCreativeBoldCanvasSliceEffectivelyBlank,
  measureExportMeaningfulContentBounds,
} from '@/lib/export';
import { getCvExportSuccessToast } from '@/lib/export-success-toast';
import type { CVData } from '@/lib/types';

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'creative-bold-test',
    name: '',
    personal: {
      fullName: 'Sofia Rossi',
      email: 'sofia@example.com',
      phone: '+39 02 123 4567',
      address: 'Milan, Italy',
      jobTitle: 'Creative Director',
      photo: tinyPng,
      photoEnabled: true,
    },
    summary: 'Creative director with a record of building memorable brand systems and reliable teams.',
    experience: [
      {
        id: 'exp1',
        company: 'Studio Visiva',
        position: 'Creative Director',
        startDate: '2020-01',
        endDate: '',
        isPresent: true,
        description: 'Directed integrated campaigns for global brands.\nPartnered with strategy and product teams.',
      },
      {
        id: 'exp2',
        company: 'Pixel & Co',
        position: 'Senior Designer',
        startDate: '2016-03',
        endDate: '2019-12',
        isPresent: false,
        description: 'Designed visual identities for more than 50 brands.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Politecnico di Milano', degree: 'MA Graphic Design', startDate: '2012', endDate: '2014', description: '' },
    ],
    skills: ['Brand Strategy', 'Art Direction', 'Figma', 'Motion Design'],
    certifications: ['Adobe Certified Professional'],
    languages: [{ name: 'Italian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    templateId: 'creative-bold',
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
        data[index] = 190;
        data[index + 1] = 18;
        data[index + 2] = 60;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  canvas.__ctx = ctx;
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,creative-bold'), configurable: true });
  return canvas;
}

function makePixelCanvas(
  width: number,
  height: number,
  pixelAt: (x: number, y: number) => [number, number, number, number],
): TestCanvas {
  const canvas = document.createElement('canvas') as TestCanvas;
  canvas.width = width;
  canvas.height = height;
  const ctx = {
    drawImage: vi.fn(),
    getImageData: vi.fn((x: number, y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let row = 0; row < h; row += 1) {
        for (let col = 0; col < w; col += 1) {
          const [red, green, blue, alpha] = pixelAt(x + col, y + row);
          const index = (row * w + col) * 4;
          data[index] = red;
          data[index + 1] = green;
          data[index + 2] = blue;
          data[index + 3] = alpha;
        }
      }
      return { data };
    }),
  };
  canvas.__ctx = ctx;
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,creative-bold'), configurable: true });
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
        return new Blob(['%PDF-1.7\ncreative-bold\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances, cloneDocuments };
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

function semanticCreativeBoldHtml(options: {
  rootWidth: number;
  rootHeight: number;
  meaningful: Array<{ top: number; height: number; text?: string; column?: 'sidebar' | 'main' }>;
}) {
  const rootRect = rectAttr(0, 0, options.rootWidth, options.rootHeight);
  const sidebarWidth = options.rootWidth * 0.28;
  const items = options.meaningful.map((item, index) => {
    const left = item.column === 'main' ? sidebarWidth + 32 : 24;
    const width = item.column === 'main' ? options.rootWidth - sidebarWidth - 64 : sidebarWidth - 48;
    return `<p data-export-meaningful="true" data-test-rect="${rectAttr(item.top, left, width, item.height)}">${item.text ?? `Meaningful ${index}`}</p>`;
  }).join('');

  return `
    <div
      data-template-id="creative-bold"
      data-test-rect="${rootRect}"
      style="width:${options.rootWidth}px;height:${options.rootHeight}px;background:#fff"
    >
      <div>
        <aside>${items}</aside>
        <main></main>
      </div>
    </div>
  `;
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
      return { data };
    }),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(tinyPng);
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://test/export'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.doUnmock('html2canvas');
  vi.doUnmock('jspdf');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Creative Bold export routing and rendering', () => {
  test('Creative Bold resolves to its real renderer and export-safe A4 root', () => {
    const html = renderToStaticMarkup(<CreativeBoldTemplate data={cv()} locale="en" />);
    const src = templateSource();
    const cbStart = src.indexOf('export function CreativeBoldTemplate');
    const cbEnd = src.indexOf('// --- Elegant Formal');
    const cbSource = src.slice(cbStart, cbEnd);

    expect(templateComponents['creative-bold']).toBe(CreativeBoldTemplate);
    expect(html).toContain('data-template-id="creative-bold"');
    expect(html).toContain('box-border');
    expect(html).toContain('w-[210mm]');
    expect(html).toContain('min-height:297mm');
    expect(html).toContain('background:linear-gradient(180deg, #e11d48 0%, #be123c 100%)');
    expect(html).toContain('data-creative-bold-photo="frame"');
    expect(html).toContain('data-creative-bold-skill="item"');
    expect(html).toContain('data-export-meaningful="true"');
    expect(cbSource).not.toContain('max-w-[210mm]');
  });

  test('Creative Bold is included in styled html2canvas clone and image paths', () => {
    const src = exportSource();
    expect(src).toContain("type StyledPdfTemplateId = 'modern-minimal' | 'clean-simple' | 'professional-classic' | 'creative-bold' | 'creative-artistic' | 'elegant-formal'");
    expect(src).toContain('function isCreativeBoldCaptureTarget');
    expect(src).toContain("if (isCreativeBoldCaptureTarget(target)) return 'creative-bold'");
    expect(src).toContain('normalizeCreativeBoldPdfTextStyles');
    expect(src).toContain("captureTemplateId === 'creative-bold'");
    expect(src).toContain("captureTemplateId === 'clean-simple' || captureTemplateId === 'professional-classic' || captureTemplateId === 'creative-bold' || captureTemplateId === 'creative-artistic' || captureTemplateId === 'elegant-formal'");
  });

  test('Creative Bold PDF errors do not route to Android/browser print fallback', () => {
    const source = cvBuilderSource();
    const cbGuard = source.indexOf("cv.templateId === 'creative-bold'");
    const fallback = source.indexOf('await openPrintFallback', cbGuard);
    const guardBlock = source.slice(cbGuard, fallback);

    expect(cbGuard).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(cbGuard);
    expect(guardBlock).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(guardBlock).toContain('return;');
  });

  test('Creative Bold PDF export builds a non-empty one-page Blob for short content', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-bold" style="width:800px;height:1000px">Creative Bold</div></div>';
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

  test('Creative Bold PDF boundary content within trailing tolerance stays one page', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-bold" style="width:800px;height:1144px">Creative Bold</div></div>';
    const canvas = makeCanvas(800, 1144, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
  });

  test('Creative Bold PDF clone preserves sidebar, columns, photo, skills, and text spacing', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<CreativeBoldTemplate data={cv()} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { cloneDocuments } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    const cloneRoot = cloneDocuments[0].querySelector('[data-template-id="creative-bold"]') as HTMLElement;
    const layout = cloneRoot.firstElementChild as HTMLElement;
    const sidebar = cloneRoot.querySelector('aside') as HTMLElement;
    const main = cloneRoot.querySelector('main') as HTMLElement;
    const photo = cloneRoot.querySelector('[data-creative-bold-photo="frame"]') as HTMLElement;
    const skills = cloneRoot.querySelectorAll('[data-creative-bold-skill="item"]');

    expect(cloneRoot.textContent).toContain('Sofia Rossi');
    expect(cloneRoot.textContent).toContain('Creative Director');
    expect(cloneRoot.textContent).toContain('Creative director with a record');
    expect(cloneRoot.textContent).not.toContain('CreativeDirector');
    expect(cloneRoot.style.width).toBe('210mm');
    expect(cloneRoot.style.overflow).toBe('hidden');
    expect(layout.style.display).toBe('grid');
    expect(layout.style.gridTemplateColumns).toBe('28% 72%');
    expect(layout.style.gap).toBe('0px');
    expect(layout.style.overflow).toBe('hidden');
    expect(sidebar.style.backgroundColor || sidebar.style.background).toMatch(/rgb\(190, 18, 60\)|#be123c|linear-gradient/i);
    expect(sidebar.style.gridColumn).toBe('1');
    expect(sidebar.style.width).toBe('100%');
    expect(sidebar.style.minWidth).toBe('0px');
    expect(sidebar.style.flex).toBe('0 0 auto');
    expect(sidebar.style.overflow).toBe('hidden');
    expect(main.style.gridColumn).toBe('2');
    expect(main.style.width).toBe('100%');
    expect(main.style.minWidth).toBe('0px');
    expect(main.style.overflowX).toBe('hidden');
    expect(main.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect([28, 72].reduce((sum, width) => sum + width, 0)).toBe(100);
    expect(photo.style.width).toBe('110px');
    expect(photo.style.height).toBe('110px');
    expect(skills.length).toBe(4);
    expect(cloneRoot.style.fontFamily).toContain('Arial');
    expect(cloneRoot.style.wordSpacing).toBe('normal');
    expect(cloneRoot.style.letterSpacing).toBe('normal');
    expect(cloneRoot.style.whiteSpace).toBe('normal');
  });

  test('Creative Bold PDF clone preserves inherited light sidebar text colors', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<CreativeBoldTemplate data={cv()} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { cloneDocuments } = installPdfMocks(canvas);

    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) => ({
      [Symbol.iterator]: function* properties() {
        yield 'color';
      },
      getPropertyValue: (property: string) => {
        if (property !== 'color') return '';
        return element.closest('.text-rose-100') ? 'oklch(0.94 0.03 12)' : '#111827';
      },
      getPropertyPriority: () => '',
    }) as unknown as CSSStyleDeclaration);

    await buildCvPdfBlob('cv-preview');

    const cloneRoot = cloneDocuments[0].querySelector('[data-template-id="creative-bold"]') as HTMLElement;
    const contact = Array.from(cloneRoot.querySelectorAll('aside p'))
      .find(node => node.textContent === 'sofia@example.com') as HTMLElement;

    expect(contact.style.color).toBe('rgb(255, 228, 230)');
  });

  test('Creative Bold skips a trailing slice containing only white plus uniform magenta sidebar background', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-bold" style="width:800px;height:1160px">Creative Bold</div></div>';
    const sidebarWidth = Math.ceil(800 * 0.28);
    const pageHeight = (297 / 210) * 800;
    const canvas = makePixelCanvas(800, 1160, (x, y) => {
      if (y < pageHeight && x === 380 && y === 200) return [17, 24, 39, 255];
      if (y >= pageHeight && x < sidebarWidth) return [190, 18, 60, 255];
      return [255, 255, 255, 255];
    });
    const { instances } = installPdfMocks(canvas);

    expect(isCanvasSliceEffectivelyBlank(canvas, pageHeight, 1160 - pageHeight)).toBe(false);
    expect(isCreativeBoldCanvasSliceEffectivelyBlank(canvas, pageHeight, 1160 - pageHeight)).toBe(true);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addImage).toHaveBeenCalledTimes(1);
  });

  test.each([1, 2, 2.625, 3])(
    'Creative Bold semantic bounds skip fractional structural overflow at Android-like scale %s',
    async (scale) => {
      const rootWidth = 800;
      const pageHeightCss = (297 / 210) * rootWidth;
      const rootHeight = pageHeightCss + 48;
      const canvasWidth = Math.round(rootWidth * scale);
      const canvasHeight = Math.ceil(rootHeight * scale);
      const pageHeightPx = (297 / 210) * canvasWidth;
      document.body.innerHTML = `<div id="cv-preview">${semanticCreativeBoldHtml({
        rootWidth,
        rootHeight,
        meaningful: [{ top: 120, height: 44, text: 'Sofia Rossi', column: 'sidebar' }],
      })}</div>`;
      installRectMock();
      const canvas = makePixelCanvas(canvasWidth, canvasHeight, (x, y) => {
        if (y >= pageHeightPx && x < canvasWidth * 0.28) return [190, 18, 60, 255];
        if (y < pageHeightPx && x === Math.floor(canvasWidth * 0.5) && y === 120) return [17, 24, 39, 255];
        return [255, 255, 255, 255];
      });
      const { instances } = installPdfMocks(canvas);

      await buildCvPdfBlob('cv-preview');

      expect(instances).toHaveLength(1);
      expect(instances[0].pages).toBe(1);
      expect(instances[0].addImage).toHaveBeenCalledTimes(1);
    },
  );

  test('Creative Bold semantic bounds skip a trailing magenta gradient slice', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 64;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    const pageHeightPx = (297 / 210) * canvasWidth;
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeBoldHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: 180, height: 36, text: 'Creative Director', column: 'main' }],
    })}</div>`;
    installRectMock();
    const canvas = makePixelCanvas(canvasWidth, canvasHeight, (x, y) => {
      if (y >= pageHeightPx && x < canvasWidth * 0.28) {
        const shift = Math.min(35, Math.floor((y - pageHeightPx) / 2));
        return [225 - shift, 29 + Math.floor(shift / 3), 72 + Math.floor(shift / 2), 255];
      }
      return [255, 255, 255, 255];
    });
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addImage).toHaveBeenCalledTimes(1);
  });

  test('Creative Bold semantic bounds skip trailing sidebar shadow and border pixels only', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 64;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    const pageHeightPx = (297 / 210) * canvasWidth;
    const sidebarWidthPx = Math.round(canvasWidth * 0.28);
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeBoldHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: 160, height: 36, text: 'Contact line', column: 'sidebar' }],
    })}</div>`;
    installRectMock();
    const canvas = makePixelCanvas(canvasWidth, canvasHeight, (x, y) => {
      if (y >= pageHeightPx && x < sidebarWidthPx) return [190, 18, 60, 255];
      if (y >= pageHeightPx && x >= sidebarWidthPx && x <= sidebarWidthPx + 3) return [110, 12, 42, 255];
      return [255, 255, 255, 255];
    });
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addImage).toHaveBeenCalledTimes(1);
  });

  test('Creative Bold semantic bounds preserve a trailing slice containing a real skill or language', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 80;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    const pageHeightPx = (297 / 210) * canvasWidth;
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeBoldHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: pageHeightCss + 12, height: 22, text: 'Italian - Native', column: 'sidebar' }],
    })}</div>`;
    installRectMock();
    const canvas = makePixelCanvas(canvasWidth, canvasHeight, (x, y) => {
      if (y >= pageHeightPx && x < canvasWidth * 0.28) return [190, 18, 60, 255];
      return [255, 255, 255, 255];
    });
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Creative Bold semantic bounds preserve a trailing slice containing real main-column text', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 80;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    const pageHeightPx = (297 / 210) * canvasWidth;
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeBoldHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: pageHeightCss + 14, height: 28, text: 'Education entry', column: 'main' }],
    })}</div>`;
    installRectMock();
    const canvas = makePixelCanvas(canvasWidth, canvasHeight, (x, y) => {
      if (y >= pageHeightPx && x < canvasWidth * 0.28) return [190, 18, 60, 255];
      return [255, 255, 255, 255];
    });
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Creative Bold meaningful page plan is deterministic with slightly different mm-to-pixel widths', () => {
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeBoldHtml({
      rootWidth: 793.7,
      rootHeight: 1168.2,
      meaningful: [{ top: 100, height: 900, text: 'Boundary content', column: 'main' }],
    })}</div>`;
    installRectMock();
    const root = document.querySelector('[data-template-id="creative-bold"]') as HTMLElement;
    const bounds = measureExportMeaningfulContentBounds(root);
    expect(bounds).not.toBeNull();

    const plan = createMeaningfulContentPagePlan(bounds!, 1587, 793.7);
    const pageHeightPx = (297 / 210) * 1587;

    expect(plan).not.toBeNull();
    expect(plan!.maxBottomCanvasPx).toBeLessThan(pageHeightPx);
  });

  test('Creative Bold preserves a trailing slice containing real sidebar text', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-bold" style="width:800px;height:1160px">Creative Bold</div></div>';
    const sidebarWidth = Math.ceil(800 * 0.28);
    const pageHeight = (297 / 210) * 800;
    const canvas = makePixelCanvas(800, 1160, (x, y) => {
      if (y >= pageHeight && x < sidebarWidth) {
        if (x >= 36 && x <= 90 && y >= pageHeight + 10 && y <= pageHeight + 16) return [255, 255, 255, 255];
        return [190, 18, 60, 255];
      }
      return [255, 255, 255, 255];
    });
    const { instances } = installPdfMocks(canvas);

    expect(isCreativeBoldCanvasSliceEffectivelyBlank(canvas, pageHeight, 1160 - pageHeight)).toBe(false);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Creative Bold preserves a trailing slice containing real main-column text', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-bold" style="width:800px;height:1160px">Creative Bold</div></div>';
    const sidebarWidth = Math.ceil(800 * 0.28);
    const pageHeight = (297 / 210) * 800;
    const canvas = makePixelCanvas(800, 1160, (x, y) => {
      if (y >= pageHeight && x < sidebarWidth) return [190, 18, 60, 255];
      if (x >= 340 && x <= 430 && y >= pageHeight + 10 && y <= pageHeight + 16) return [17, 24, 39, 255];
      return [255, 255, 255, 255];
    });
    const { instances } = installPdfMocks(canvas);

    expect(isCreativeBoldCanvasSliceEffectivelyBlank(canvas, pageHeight, 1160 - pageHeight)).toBe(false);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Creative Bold PDF export paginates long nonblank content', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-bold" style="width:800px;height:2600px">Creative Bold</div></div>';
    const canvas = makeCanvas(800, 2600, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(3);
    expect(instances[0].addImage).toHaveBeenCalledTimes(3);
  });

  test('Creative Bold no-photo PDF remains valid', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<CreativeBoldTemplate data={cv({ personal: { photo: undefined, photoEnabled: false } })} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { instances } = installPdfMocks(canvas);

    const blob = await buildCvPdfBlob('cv-preview');

    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0].pages).toBe(1);
    expect(document.querySelector('[data-creative-bold-photo="frame"]')).toBeNull();
  });

  test('Creative Bold PDF reaches the shared save result after Blob generation', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-bold" style="width:800px;height:1000px">Creative Bold</div></div>';
    const canvas = makeCanvas(800, 1000, () => true);
    installPdfMocks(canvas);
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });

    const result = await exportToPDF('cv-preview', 'Sofia Rossi - CV');

    expect(result.result).toBe('saved');
    expect(result.platform).toBe('web');
    expect(result.fileName).toBe('Sofia Rossi - CV.pdf');
    expect(result.sourceBytes).toBeGreaterThan(0);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test('Creative Bold verified Android PDF save produces exactly one shared success toast payload', () => {
    const toastPayloads = [
      getCvExportSuccessToast({
        result: 'saved',
        platform: 'android',
        fileName: 'Sofia Rossi - CV.pdf',
        destination: 'Downloads/CV Pro AI',
        sourceBytes: 298373,
        bytesWritten: 298373,
        verifiedSize: 298373,
      }, 'pdf', 'Sofia Rossi - CV.pdf', {
        cvSavedSuccessfully: 'CV saved successfully',
        downloadStarted: 'Download started',
        savedToDownloadsFolder: 'Saved to',
        pdfSavedSuccessfully: 'PDF saved successfully',
        docxSavedSuccessfully: 'DOCX saved successfully',
      }),
    ].filter(Boolean);

    expect(toastPayloads).toHaveLength(1);
    expect(toastPayloads[0]?.title).toBe('CV saved successfully');
    expect(toastPayloads[0]?.description).toContain('PDF saved successfully');
    expect(toastPayloads[0]?.description).toContain('Sofia Rossi - CV.pdf');
    expect(toastPayloads[0]?.description).toContain('Saved to: Downloads/CV Pro AI');
  });

  test('Creative Bold DOCX uses the existing shared sidebar-left branch', () => {
    const src = exportSource();
    const config = src.indexOf("'creative-bold': {");
    const sidebarBranch = src.indexOf("LAYOUT: sidebar-left");
    const branch = src.slice(sidebarBranch, src.indexOf('// ─── Build and download document', sidebarBranch));

    expect(config).toBeGreaterThan(0);
    expect(src.slice(config, config + 500)).toContain("layout: 'sidebar-left'");
    expect(src.slice(config, config + 500)).toContain('sidebarPct: 33');
    expect(branch).toContain('sidebarChildren');
    expect(branch).toContain('ImageRun');
    expect(branch).toContain('sidebarSectionHeading(t.cv.skills)');
    expect(branch).toContain('mainHeading(t.cv.experience)');
  });

  test('Creative Bold DOCX with photo contains editable body text, sidebar markers, media, and relationship', async () => {
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

    await exportToDOCX(cv(), 'creative-bold-photo-test', 'en', 'creative-bold');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);
    expect(Array.from(new Uint8Array(await savedBlob!.slice(0, 2).arrayBuffer()))).toEqual([0x50, 0x4b]);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Sofia Rossi');
    expect(documentXml).toContain('Creative Director');
    expect(documentXml).toContain('Studio Visiva');
    expect(documentXml).toContain('Brand Strategy');
    expect(documentXml).toContain('Italian');
    expect(documentXml).toContain('E11D48');
    expect(documentXml).toContain('BE123C');
    expect(documentXml).toContain('<w:drawing>');
    expect(relsXml).toContain('image');
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  test('Creative Bold DOCX without photo remains valid and does not lose text', async () => {
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

    await exportToDOCX(cv({ personal: { photo: undefined, photoEnabled: false } }), 'creative-bold-no-photo-test', 'en', 'creative-bold');

    expect(savedBlob).toBeDefined();
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Sofia Rossi');
    expect(documentXml).toContain('Creative director with a record');
    expect(documentXml).toContain('Brand Strategy');
    expect(documentXml).not.toContain('<w:drawing>');
    expect(mediaFiles).toHaveLength(0);
  });

  test('Creative Bold DOCX boundary content is not duplicated or lost', async () => {
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

    await exportToDOCX(cv({
      education: [
        { id: 'edu1', school: 'Politecnico di Milano', degree: 'MA Graphic Design', startDate: '2012', endDate: '2014', description: 'Brand systems and visual communication.' },
        { id: 'edu2', school: 'Domus Academy', degree: 'Design Strategy Program', startDate: '2015', endDate: '2015', description: 'Creative leadership and campaign planning.' },
      ],
    }), 'creative-bold-boundary-test', 'en', 'creative-bold');

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');

    expect((documentXml.match(/Politecnico di Milano/g) ?? [])).toHaveLength(1);
    expect((documentXml.match(/Domus Academy/g) ?? [])).toHaveLength(1);
    expect(documentXml).toContain('Brand systems and visual communication.');
    expect(documentXml).toContain('Creative leadership and campaign planning.');
  });
});
