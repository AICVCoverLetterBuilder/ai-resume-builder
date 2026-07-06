/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { ElegantFormalTemplate, templateComponents } from '@/components/cv-templates';
import { createElegantFormalPdfTemplate } from '@/lib/elegant-formal-pdf-template';
import {
  ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
  ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
  ELEGANT_FORMAL_PHOTO_HEIGHT,
  ELEGANT_FORMAL_PHOTO_WIDTH,
  createElegantFormalPortraitPhoto,
  elegantFormalDataUrlToBytes,
  getElegantFormalCoverCropMetrics,
  inspectElegantFormalPhotoDataUrl,
  isCleanElegantFormalPortraitPhoto,
  prepareElegantFormalCanonicalPhoto,
} from '@/lib/elegant-formal-photo';
import {
  applyElegantFormalKeepTogetherPagination,
  areElegantFormalDomLineIntervalsReliable,
  buildCvPdfBlob,
  buildElegantFormalPaddedPdfSlice,
  buildElegantFormalPdfBlob,
  collectElegantFormalTextLineIntervalsCss,
  exportElegantFormalPdf,
  exportToDOCX,
  findSafeElegantFormalPageBreakCanvasPx,
  findSafeElegantFormalPageBreakFromCanvasPixels,
  isElegantFormalCanvasBreakRowWhitespace,
  isElegantFormalSparseTrailingTailSegment,
  isUnsafeElegantFormalPageBreakCanvasPx,
  planElegantFormalPdfSliceSegments,
  prepareCvPhotoForExport,
  rebalanceElegantFormalSparseTrailingPdfSliceSegments,
  resolveElegantFormalSafePageBreakCanvasPx,
} from '@/lib/export';
import { loadCvDraft, saveCvDraft, clearCvDraft } from '@/lib/draft-storage';
import type { CVData } from '@/lib/types';

const realPhotoPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8DwnwEJMDGgAcQGALpCAwPXYZaSAAAAAElFTkSuQmCC';
const rawAndroidLikeBase64Photo = realPhotoPng.split(',')[1];
const canonicalElegantFormalJpeg = 'data:image/jpeg;base64,AQIDBAUGBwgJCg==';
const canonicalElegantFormalBytes = elegantFormalDataUrlToBytes(canonicalElegantFormalJpeg);

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'elegant-formal-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradovic',
      email: 'dragan@example.com',
      phone: '+381 64 123 456',
      address: 'Brace Abafi 4',
      jobTitle: 'Senior Operations Manager',
      photo: realPhotoPng,
      photoEnabled: true,
    },
    summary: 'Senior operations manager with a record of building reliable teams and clear reporting.',
    experience: [
      {
        id: 'exp1',
        company: 'Adriatic Systems',
        position: 'Senior Operations Manager',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: 'Improved status reporting and reduced handoff delays.\nPartnered with finance and customer teams.',
      },
      {
        id: 'exp2',
        company: 'Blue Line Logistics',
        position: 'Operations Lead',
        startDate: '2017-03',
        endDate: '2020-12',
        isPresent: false,
        description: 'Coordinated daily operations across regional teams.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Faculty of Economics', degree: 'Business Administration', startDate: '2010', endDate: '2014', description: '' },
    ],
    skills: ['Team Leadership', 'Process Improvement', 'Time Management', 'Presentation Skills', 'Reporting'],
    certifications: ['Lean Six Sigma Green Belt'],
    languages: [{ name: 'Serbian', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    templateId: 'elegant-formal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

const exportSource = () => fs.readFileSync(path.resolve('src/lib/export.ts'), 'utf8');
const cvBuilderSource = () => fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
const personalPhotoFields = (data: CVData) => data.personal as CVData['personal'] & {
  originalPhoto?: string;
  circularPhoto?: string;
  rectangularPhoto?: string;
};

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = vi.fn().mockResolvedValue(undefined);
  naturalWidth = 6;
  naturalHeight = 8;
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
        data[index] = 180;
        data[index + 1] = 83;
        data[index + 2] = 9;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  canvas.__ctx = ctx;
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,elegant-formal'), configurable: true });
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
        return new Blob(['%PDF-1.7\nelegant-formal\n%%EOF'], { type: 'application/pdf' });
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

function installInkRowCanvasContextMock(lineTops: number[], lineHeight = 18) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(
    this: HTMLCanvasElement,
    type: string,
  ) {
    if (type !== '2d') return null;
    const pixelIsInk = (x: number, y: number) => {
      if (x < 90 || x > 710) return false;
      return lineTops.some(top => y >= top && y < top + lineHeight);
    };
    return {
      fillRect: vi.fn(),
      fillStyle: '',
      getImageData: (sx: number, sy: number, sw: number, sh: number) => {
        const data = new Uint8ClampedArray(sw * sh * 4);
        for (let row = 0; row < sh; row += 1) {
          for (let col = 0; col < sw; col += 1) {
            const ink = pixelIsInk(sx + col, sy + row);
            const index = (row * sw + col) * 4;
            data[index] = ink ? 55 : 255;
            data[index + 1] = ink ? 55 : 255;
            data[index + 2] = ink ? 55 : 255;
            data[index + 3] = 255;
          }
        }
        return { data, width: sw, height: sh };
      },
    } as unknown as CanvasRenderingContext2D;
  });
}

function semanticElegantFormalHtml(options: {
  rootWidth: number;
  rootHeight: number;
  meaningful: Array<{ top: number; height: number; text?: string }>;
}) {
  const rootRect = rectAttr(0, 0, options.rootWidth, options.rootHeight);
  const items = options.meaningful.map((item, index) =>
    `<p data-export-meaningful="true" data-test-rect="${rectAttr(item.top, 40, options.rootWidth - 80, item.height)}">${item.text ?? `Meaningful ${index}`}</p>`,
  ).join('');

  return `
    <div
      data-template-id="elegant-formal"
      data-test-rect="${rootRect}"
      style="width:${options.rootWidth}px;height:${options.rootHeight}px;background:#fff"
    >
      <header data-export-meaningful="true" style="height:140px;border-bottom:1px solid #d1d5db">Elegant Formal</header>
      <section>${items}</section>
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
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(realPhotoPng);
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:http://test/export'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

afterEach(() => {
  document.body.innerHTML = '';
  clearCvDraft();
  vi.doUnmock('html2canvas');
  vi.doUnmock('jspdf');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Elegant Formal export routing and rendering', () => {
  test('Elegant Formal portrait photo crop uses one uniform centered cover scale', () => {
    expect(ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH).toBe(ELEGANT_FORMAL_PHOTO_WIDTH * 3);
    expect(ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT).toBe(ELEGANT_FORMAL_PHOTO_HEIGHT * 3);

    const wide = getElegantFormalCoverCropMetrics(1200, 800);
    expect(wide.scale).toBeCloseTo(ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT / 800);
    expect(wide.offsetX).toBeLessThan(0);
    expect(wide.offsetY).toBeCloseTo(0);

    const tall = getElegantFormalCoverCropMetrics(800, 1400);
    expect(tall.scale).toBeCloseTo(ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH / 800);
    expect(tall.offsetX).toBeCloseTo(0);
    expect(tall.offsetY).toBeLessThan(0);

    const square = getElegantFormalCoverCropMetrics(1000, 1000);
    expect(square.scale).toBeCloseTo(ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT / 1000);
    expect(square.offsetX).toBeLessThan(0);
    expect(square.offsetY).toBeCloseTo(0);
  });

  test('Elegant Formal canonical portrait JPEG is rectangular and unmasked', async () => {
    const createdCanvases: HTMLCanvasElement[] = [];
    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      clip: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: '',
    };
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'canvas') createdCanvases.push(el as HTMLCanvasElement);
      return el;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,elegant-formal-rect');

    const result = await createElegantFormalPortraitPhoto(realPhotoPng);
    const canvas = createdCanvases[0];

    expect(canvas.width).toBe(ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH);
    expect(canvas.height).toBe(ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT);
    expect(result.metrics.targetWidth).toBe(246);
    expect(result.metrics.targetHeight).toBe(327);
    expect(result.metrics.scale).toBeCloseTo(ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH / 6);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      0,
      expect.any(Number),
      ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
      expect.any(Number),
    );
    expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH, ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.clip).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92);
    expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('Elegant Formal photo inspection rejects masked/stale variants and accepts exact opaque JPEG', async () => {
    const realCreateElement = document.createElement.bind(document);
    const exactJpeg = 'data:image/jpeg;base64,clean-rect';
    const stalePng = 'data:image/png;base64,stale-circle';
    const blackJpeg = 'data:image/jpeg;base64,black-mask';
    const whiteJpeg = 'data:image/jpeg;base64,white-mask';

    let lastInspectedSrc = '';
    class InspectImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH;
      naturalHeight = ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT;
      private currentSrc = '';

      get src() {
        return this.currentSrc;
      }

      set src(value: string) {
        lastInspectedSrc = value;
        this.currentSrc = value;
        if (value === exactJpeg || value === blackJpeg || value === whiteJpeg) {
          this.naturalWidth = ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH;
          this.naturalHeight = ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT;
        } else {
          this.naturalWidth = 300;
          this.naturalHeight = 300;
        }
        setTimeout(() => this.onload?.(), 0);
      }
    }
    Object.defineProperty(globalThis, 'Image', { value: InspectImage, configurable: true });
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() !== 'canvas') return el;
      const ctx = {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        setTransform: vi.fn(),
        getImageData: vi.fn(() => {
          const canvas = el as HTMLCanvasElement;
          const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
          data.fill(255);
          const write = (x: number, y: number, rgba: [number, number, number, number]) => {
            const i = (y * canvas.width + x) * 4;
            data[i] = rgba[0];
            data[i + 1] = rgba[1];
            data[i + 2] = rgba[2];
            data[i + 3] = rgba[3];
          };
          const src = lastInspectedSrc;
          const rgba: [number, number, number, number] = src === blackJpeg
            ? [0, 0, 0, 255]
            : src === whiteJpeg
              ? [255, 255, 255, 255]
              : src === stalePng
                ? [120, 30, 70, 0]
                : [34, 90, 150, 255];
          write(0, 0, rgba);
          write(canvas.width - 1, 0, rgba);
          write(0, canvas.height - 1, rgba);
          write(canvas.width - 1, canvas.height - 1, rgba);
          return { data };
        }),
      };
      Object.defineProperty(el, 'getContext', { value: vi.fn(() => ctx), configurable: true });
      return el;
    });

    const clean = await inspectElegantFormalPhotoDataUrl(exactJpeg);

    expect(clean.width).toBe(246);
    expect(clean.height).toBe(327);
    expect(clean.hasAlpha).toBe(false);
    expect(clean.cornerPixels.topLeft).toEqual({ r: 34, g: 90, b: 150, a: 255 });
    await expect(isCleanElegantFormalPortraitPhoto(exactJpeg)).resolves.toBe(true);
    await expect(isCleanElegantFormalPortraitPhoto(stalePng)).resolves.toBe(false);
    await expect(isCleanElegantFormalPortraitPhoto(blackJpeg)).resolves.toBe(false);
    await expect(isCleanElegantFormalPortraitPhoto(whiteJpeg)).resolves.toBe(false);
  });

  test('Elegant Formal canonical photo source priority ignores stale variants when original exists', async () => {
    const ctx = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      setTransform: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(canonicalElegantFormalJpeg);

    const result = await prepareElegantFormalCanonicalPhoto({
      originalPhoto: 'data:image/jpeg;base64,original-upload',
      rectangularPhoto: 'data:image/jpeg;base64,old-oval-rectangle',
    });

    expect(result?.source).toBe('original-photo');
    expect(result?.dataUrl).toBe(canonicalElegantFormalJpeg);
    expect(Array.from(result?.bytes ?? [])).toEqual(Array.from(canonicalElegantFormalBytes));
    expect(result?.mimeType).toBe('image/jpeg');
    expect(result?.width).toBe(246);
    expect(result?.height).toBe(327);
    expect(result?.metrics?.targetWidth).toBe(246);
    expect(result?.metrics?.targetHeight).toBe(327);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      0,
      expect.any(Number),
      ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
      expect.any(Number),
    );
  });

  test('Elegant Formal uses originalPhoto over circular personal photo and stale rectangular variants', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(canonicalElegantFormalJpeg);

    const result = await prepareElegantFormalCanonicalPhoto({
      originalPhoto: 'data:image/png;base64,raw-upload',
      rectangularPhoto: 'data:image/jpeg;base64,stale-black-corners',
    });

    expect(result?.source).toBe('original-photo');
    expect(result?.dataUrl).toBe(canonicalElegantFormalJpeg);
    expect(Array.from(result?.bytes ?? [])).toEqual(Array.from(canonicalElegantFormalBytes));
  });

  test('Elegant Formal without originalPhoto rejects invalid masked legacy sources for clean no-photo export', async () => {
    await expect(prepareElegantFormalCanonicalPhoto({
      rectangularPhoto: 'data:image/png;base64,circular-mask',
    })).resolves.toBeNull();
  });

  test('Elegant Formal resolves to the real renderer and export-safe A4 root', () => {
    const html = renderToStaticMarkup(<ElegantFormalTemplate data={cv()} locale="en" />);

    expect(templateComponents['elegant-formal']).toBe(ElegantFormalTemplate);
    expect(html).toContain('data-template-id="elegant-formal"');
    expect(html).toContain('box-border');
    expect(html).toContain('w-[210mm]');
    expect(html).toContain('min-height:297mm');
    expect(html).toContain('padding:34px');
    expect(html).toContain('font-family:Georgia');
    expect(html).toContain('data-elegant-formal-photo="frame"');
    expect(html).toContain('data-export-contact-item="elegant-formal"');
    expect(html).toContain('data-export-contact-separator="elegant-formal"');
    expect(html).toContain('data-export-group="experience-entry"');
    expect(html).toContain('data-export-bullet-list="elegant-formal"');
    expect(html).toContain('data-export-bullet-item="elegant-formal"');
    expect(html).toContain('data-elegant-formal-entry-row="true"');
    expect(html).toContain('data-export-group="education-section"');
    expect(html).toContain('data-export-group="skills-languages-block"');
    expect(html).toContain('data-export-skill-row="elegant-formal"');
    expect(html).toContain('data-export-skill-chip="elegant-formal"');
    expect(html).toContain('Dragan Obradovic');
    expect(html).toContain('Brace Abafi 4');
  });

  test('Elegant Formal is included in styled html2canvas clone and image paths only for its template id', () => {
    const src = exportSource();

    expect(src).toContain("'elegant-formal'");
    expect(src).toContain('function isElegantFormalCaptureTarget');
    expect(src).toContain("if (isElegantFormalCaptureTarget(target)) return 'elegant-formal'");
    expect(src).toContain('fallbackElegantFormalColor');
    expect(src).toContain('applyElegantFormalPdfLayout');
    expect(src).toContain('applyElegantFormalKeepTogetherPagination');
    expect(src).toContain('normalizeElegantFormalPdfTextStyles');
    expect(src).toContain("captureTemplateId === 'elegant-formal'");
    expect(src).toContain("cfg.customLayout === 'elegant-formal'");
    expect(src).toContain('prepareCvPhotoForExport');
    expect(src).toContain('directElegantFormalPhoto.bytes');
    expect(src).toContain('isCleanElegantFormalPortraitPhoto(rawPhotoDataUrl)');
    expect(src).not.toContain('createElegantFormalPortraitPhoto(rawPhotoDataUrl');
    expect(src).toContain("src.startsWith('content:')");
    expect(src).not.toContain("if ((captureTemplateId === 'creative-artistic' || captureTemplateId === 'elegant-formal') && captureWidth > 0)");
  });

  test('Elegant Formal app export regenerates from originalPhoto before stale variants', () => {
    const source = cvBuilderSource();

    expect(source).toContain('const variants = getPersonalPhotoVariants(cv)');
    expect(source).toContain('createElegantFormalPortraitPhoto(sourceOriginal)');
    expect(source).toContain('prepareElegantFormalCanonicalPhoto');
    expect(source).toContain('const liveCv = cvRef.current');
    expect(source).toContain('originalPhoto = personalVariants.originalPhoto');
    expect(source).toContain('rectangularPhoto = personalVariants.rectangularPhoto');
    expect(source).toContain('getElegantFormalPreviewPhotoSrc');
    expect(source).toContain("await tryPrepare({ rectangularPhoto: previewPhoto }, 'preview.img.src')");
    expect(source).toContain("await tryPrepare({ rectangularPhoto: currentPhoto }, 'cv.personal.photo')");
    expect(source).not.toContain("await tryPrepare({ originalPhoto: previewPhoto }, 'preview.img.src')");
    expect(source).not.toContain("await tryPrepare({ originalPhoto: currentPhoto }, 'cv.personal.photo')");
    expect(source).not.toContain("await tryPrepare({ originalPhoto: circularPhoto }, 'cv.personal.circularPhoto')");
    expect(source).toContain("liveCv.templateId === 'elegant-formal'");
    expect(source).toContain('elegantFormalPhoto = await ensureElegantFormalPhotoForExport()');
    expect(source).toContain('photoForExport = elegantFormalPhoto?.dataUrl');
    expect(source).toContain('const cvForExport = { ...latestCv, personal: { ...latestCv.personal, photo: photoForExport } }');
    expect(source).toContain('getPersonalPhotoVariants(cv).originalPhoto ? getPersonalPhotoVariants(cv).rectangularPhoto : validatedElegantFormalFallbackPhoto');
    expect(source).not.toContain('findLoadedElegantFormalPreviewPhoto');
    expect(source).not.toContain('personalPhoto: cv.personal.photo');
    expect(source).not.toContain('applyElegantFormalPhotoToPreview(ensuredPhoto, previewId)');
    expect(source).toContain('isCleanElegantFormalPortraitPhoto(rectPhoto)');
    expect(source).toContain('ELEGANT_FORMAL_PHOTO_STATE_MISMATCH');
    expect(source).not.toContain("throw new Error('ELEGANT_FORMAL_PHOTO_STATE_MISMATCH')");
    expect(source).toContain('cv.personal.originalPhoto');
    expect(source).toContain('cv.personal.rectangularPhoto');
    expect(source).toContain('cv.personal.circularPhoto');
    expect(source).toContain('local.originalPhotoDataUrl');
    expect(source).toContain('local.rectangularPhotoDataUrl');
    expect(source).toContain('preview.img.src');
    expect(source).toContain('selectedSource=');
    expect(source).toContain('code=ELEGANT_FORMAL_PHOTO_READY');
    expect(source).toContain('originalPhoto: nextOriginal ?? getPersonalPhotoVariants(prev).originalPhoto');
    expect(source).toContain('rectangularPhoto: nextRectangular ?? getPersonalPhotoVariants(prev).rectangularPhoto');
    expect(source).not.toContain('persistCurrentDraft');
    expect(source).not.toContain("cv.templateId === 'elegant-formal'\\n      ? (rectangularPhotoDataUrl ?? cv.personal.photo)");
  });

  test('Elegant Formal app export cannot reach circular photo fallbacks', () => {
    const source = cvBuilderSource();
    const resolverStart = source.indexOf('const ensureElegantFormalPhotoForExport');
    const resolverEnd = source.indexOf('const localizedPreviewCv', resolverStart);
    const resolver = source.slice(resolverStart, resolverEnd);

    expect(resolver).toContain("await tryPrepare({ originalPhoto, rectangularPhoto }");
    expect(resolver).toContain("await tryPrepare({ rectangularPhoto: previewPhoto }, 'preview.img.src')");
    expect(resolver).toContain("await tryPrepare({ rectangularPhoto: currentPhoto }, 'cv.personal.photo')");
    expect(resolver).not.toContain('const circularPhoto');
    expect(resolver).not.toContain('draft?.circularPhoto');
    expect(resolver).not.toContain("tryPrepare({ originalPhoto: previewPhoto }");
    expect(resolver).not.toContain("tryPrepare({ originalPhoto: currentPhoto }");
    expect(resolver).not.toContain("tryPrepare({ originalPhoto: circularPhoto }");
    expect(resolver).not.toContain("selectedSource=cv.personal.circularPhoto");
  });

  test('Elegant Formal dedicated PDF renderer creates rectangular canonical photo and complete content', () => {
    const photo = {
      dataUrl: canonicalElegantFormalJpeg,
      bytes: canonicalElegantFormalBytes,
      mimeType: 'image/jpeg' as const,
      width: ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
      height: ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
      source: 'original-photo' as const,
      metrics: {
        sourceWidth: 1200,
        sourceHeight: 1600,
        targetWidth: ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
        targetHeight: ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
        scale: ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT / 1600,
        offsetX: 0,
        offsetY: 0,
      },
    };

    const root = createElegantFormalPdfTemplate(cv(), { locale: 'en', photoDataUrl: photo.dataUrl });
    const frame = root.querySelector('[data-elegant-formal-photo="frame"]') as HTMLElement;
    const img = root.querySelector('[data-elegant-formal-pdf-photo="canonical"]') as HTMLImageElement;
    const images = root.querySelectorAll('img');
    const bulletItems = Array.from(root.querySelectorAll('[data-export-bullet-item="elegant-formal"]'));
    const skills = Array.from(root.querySelectorAll<HTMLElement>('[data-export-skill-chip="elegant-formal"]'))
      .map(item => item.textContent);

    expect(root.getAttribute('data-elegant-formal-pdf-template')).toBe('true');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minHeight).toBe('297mm');
    expect(frame.style.width).toBe(`${ELEGANT_FORMAL_PHOTO_WIDTH}px`);
    expect(frame.style.height).toBe(`${ELEGANT_FORMAL_PHOTO_HEIGHT}px`);
    expect(frame.style.borderRadius).toBe('2px');
    expect(images).toHaveLength(1);
    expect(img.getAttribute('src')).toBe(canonicalElegantFormalJpeg);
    expect(img.getAttribute('data-export-photo')).toBe('elegant-formal');
    expect(img.width).toBe(ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH);
    expect(img.height).toBe(ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT);
    expect(img.style.width).toBe(`${ELEGANT_FORMAL_PHOTO_WIDTH}px`);
    expect(img.style.height).toBe(`${ELEGANT_FORMAL_PHOTO_HEIGHT}px`);
    expect(img.style.objectFit).toBe('cover');
    expect(img.style.clipPath).toBe('none');
    expect(img.style.maskImage).toBe('none');
    expect(root.outerHTML).not.toContain('border-radius: 50%');
    expect(root.outerHTML).not.toContain('ellipse(');
    expect(root.outerHTML).not.toContain('arc(');
    expect(bulletItems).toHaveLength(3);
    expect(skills).toContain('Time Management');
    expect(skills).toContain('Presentation Skills');
    expect(root.textContent).toContain('Business Administration');
    expect(root.textContent).toContain('Faculty of Economics');
  });

  test('Elegant Formal dedicated PDF renderer omits photo cleanly when no original photo is prepared', () => {
    const root = createElegantFormalPdfTemplate(cv({ personal: { photo: undefined, photoEnabled: true } }), { locale: 'en', photoDataUrl: null });

    expect(root.querySelector('[data-elegant-formal-photo="frame"]')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Dragan Obradovic');
    expect(root.textContent).toContain('Team Leadership');
  });

  test('Elegant Formal PDF uses the dedicated export renderer instead of preview DOM capture', () => {
    const source = cvBuilderSource();
    const pdfStart = source.indexOf('const handlePDFDownload');
    const pdfEnd = source.indexOf('const handleTemplateRecommend', pdfStart);
    const pdfHandler = source.slice(pdfStart, pdfEnd);
    const elegantStart = pdfHandler.indexOf("liveCv.templateId === 'elegant-formal'");
    const elegantEnd = pdfHandler.indexOf('if (RECT_PHOTO_TEMPLATES.includes', elegantStart);
    const elegantPdfBranch = pdfHandler.slice(elegantStart, elegantEnd);
    const exportModule = exportSource();

    expect(source).toContain('exportElegantFormalPdf');
    expect(source).toContain('prepareElegantFormalPdfPhotoDataUrl');
    expect(source).toContain('const liveCv = cvRef.current');
    expect(source).toContain('const originalPhoto = personalVariants.originalPhoto');
    expect(source).toContain('const rectangularPhoto = originalPhoto ? undefined : personalVariants.rectangularPhoto');
    expect(source).toContain("throw new Error('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING')");
    expect(elegantPdfBranch).toContain('const photoDataUrl = await prepareElegantFormalPdfPhotoDataUrl()');
    expect(elegantPdfBranch).toContain('await exportElegantFormalPdf(latestCv, exportFilename, locale, { photoDataUrl })');
    expect(elegantPdfBranch).toContain('return;');
    expect(elegantPdfBranch).not.toContain('applyElegantFormalPhotoToPreview');
    expect(elegantPdfBranch).not.toContain('exportToPDF(previewId');
    expect(elegantPdfBranch).not.toContain('openPrintFallback');
    expect(elegantPdfBranch).not.toContain('exportToDOCX');
    expect(exportModule).toContain('createElegantFormalPdfTemplate(cv, { locale, photoDataUrl })');
    expect(exportModule).toContain('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
    expect(exportModule).toContain("container.setAttribute('data-elegant-formal-pdf-export-container', 'true')");
  });

  test('Elegant Formal photo variants are persisted inside cv.personal and survive draft reload/partial personal edits', () => {
    const uploaded = cv({
      personal: {
        photo: 'data:image/jpeg;base64,display',
        originalPhoto: 'data:image/png;base64,original',
        circularPhoto: 'data:image/png;base64,circle',
        rectangularPhoto: canonicalElegantFormalJpeg,
      },
    });
    saveCvDraft({
      cv: uploaded,
      originalPhoto: undefined,
      circularPhoto: undefined,
      rectangularPhoto: undefined,
      savedAt: new Date().toISOString(),
    });

    const reloaded = loadCvDraft();
    expect(personalPhotoFields(reloaded!.cv).originalPhoto).toBe('data:image/png;base64,original');
    expect(personalPhotoFields(reloaded!.cv).circularPhoto).toBe('data:image/png;base64,circle');
    expect(personalPhotoFields(reloaded!.cv).rectangularPhoto).toBe(canonicalElegantFormalJpeg);

    const editedPersonal = { ...reloaded!.cv.personal, fullName: 'Dragan Obradovic Updated', email: 'updated@example.com' };
    saveCvDraft({ cv: { ...reloaded!.cv, personal: editedPersonal }, savedAt: new Date().toISOString() });

    const afterEdit = loadCvDraft();
    expect(afterEdit?.cv.personal.fullName).toBe('Dragan Obradovic Updated');
    expect(afterEdit?.cv.personal.email).toBe('updated@example.com');
    expect(personalPhotoFields(afterEdit!.cv).originalPhoto).toBe('data:image/png;base64,original');
    expect(personalPhotoFields(afterEdit!.cv).circularPhoto).toBe('data:image/png;base64,circle');
    expect(personalPhotoFields(afterEdit!.cv).rectangularPhoto).toBe(canonicalElegantFormalJpeg);
  });

  test('legacy root draft photo fields hydrate into cv.personal for app restart compatibility', () => {
    const legacy = cv({ personal: { photo: undefined, originalPhoto: undefined, circularPhoto: undefined, rectangularPhoto: undefined } });
    saveCvDraft({
      cv: legacy,
      originalPhoto: 'data:image/png;base64,legacy-original',
      circularPhoto: 'data:image/png;base64,legacy-circle',
      rectangularPhoto: canonicalElegantFormalJpeg,
      savedAt: new Date().toISOString(),
    });

    const reloaded = loadCvDraft();

    expect(personalPhotoFields(reloaded!.cv).originalPhoto).toBe('data:image/png;base64,legacy-original');
    expect(personalPhotoFields(reloaded!.cv).circularPhoto).toBe('data:image/png;base64,legacy-circle');
    expect(personalPhotoFields(reloaded!.cv).rectangularPhoto).toBe(canonicalElegantFormalJpeg);
  });

  test('Elegant Formal PDF errors do not route to Android/browser print fallback', () => {
    const source = cvBuilderSource();
    const guard = source.indexOf("cv.templateId === 'elegant-formal'");
    const fallback = source.indexOf('await openPrintFallback', guard);
    const guardBlock = source.slice(guard, fallback);

    expect(guard).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(guard);
    expect(guardBlock).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(guardBlock).toContain('return;');
  });

  test('Elegant Formal PDF clone preserves serif header, photo, contacts, amber rules, italic summary, and normal spacing', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<ElegantFormalTemplate data={cv()} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { cloneDocuments } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    const cloneRoot = cloneDocuments[0].querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const header = cloneRoot.querySelector('header') as HTMLElement;
    const photoFrame = cloneRoot.querySelector('[data-elegant-formal-photo="frame"]') as HTMLElement;
    const photo = cloneRoot.querySelector('img') as HTMLImageElement;
    const address = Array.from(cloneRoot.querySelectorAll<HTMLElement>('[data-export-contact-item="elegant-formal"]'))
      .find(item => item.textContent?.includes('Brace Abafi 4'));
    const entryRow = cloneRoot.querySelector('[data-elegant-formal-entry-row="true"]') as HTMLElement;
    const summary = Array.from(cloneRoot.querySelectorAll('p'))
      .find(item => item.textContent?.includes('Senior operations manager')) as HTMLElement;
    const skillsBlock = cloneRoot.querySelector('[data-export-group="skills-languages-block"]') as HTMLElement;
    const skillRow = cloneRoot.querySelector('[data-export-skill-row="elegant-formal"]') as HTMLElement;
    const skillChip = Array.from(cloneRoot.querySelectorAll<HTMLElement>('[data-export-skill-chip="elegant-formal"]'))
      .find(item => item.textContent === 'Team Leadership');
    const bulletItems = Array.from(cloneRoot.querySelectorAll<HTMLElement>('[data-export-bullet-item="elegant-formal"]'));

    expect(cloneRoot.textContent).toContain('Dragan Obradovic');
    expect(cloneRoot.textContent).toContain('Senior Operations Manager');
    expect(cloneRoot.textContent).toContain('dragan@example.com');
    expect(cloneRoot.textContent).toContain('Brace Abafi 4');
    expect(cloneRoot.textContent).toContain('Team Leadership');
    expect(cloneRoot.textContent).not.toContain('DraganObradovic');
    expect(cloneRoot.style.width).toBe('210mm');
    expect(cloneRoot.style.fontFamily).toContain('Georgia');
    expect(cloneRoot.style.padding).toBe('34px');
    expect(cloneRoot.style.fontSize).toBe('13px');
    expect(cloneRoot.style.wordSpacing).toBe('normal');
    expect(cloneRoot.style.letterSpacing).toBe('normal');
    expect(cloneRoot.style.whiteSpace).toBe('normal');
    expect(cloneRoot.style.fontKerning).toBe('normal');
    expect(header.style.borderBottom).toContain('solid');
    expect(header.style.paddingBottom).toBe('16px');
    expect(header.style.marginBottom).toBe('16px');
    expect(photoFrame.style.width).toBe('82px');
    expect(photoFrame.style.height).toBe('109px');
    expect(photoFrame.style.border).toContain('0');
    expect(photoFrame.style.backgroundColor).toBe('transparent');
    expect(photo.alt).toBe('');
    expect(photo.style.objectFit).toBe('cover');
    expect(photo.style.borderRadius).toBe('2px');
    expect(photo.style.clipPath).toBe('none');
    expect(photo.style.maskImage).toBe('none');
    expect(photo.style.getPropertyValue('-webkit-mask-image')).toBe('none');
    expect(entryRow.style.display).toBe('grid');
    expect(entryRow.style.gridTemplateColumns).toContain('minmax');
    expect(address).toBeDefined();
    expect(address!.style.display).toBe('inline-flex');
    expect(address!.style.whiteSpace).toBe('nowrap');
    expect(summary.style.fontStyle).toBe('italic');
    expect(skillsBlock.style.display).toBe('grid');
    expect(skillsBlock.style.gridTemplateColumns).toBe('1.65fr 0.7fr 0.8fr');
    expect(skillsBlock.style.gap).toBe('14px');
    expect(skillsBlock.style.paddingTop).toBe('9px');
    expect(skillsBlock.style.borderTop).toContain('solid');
    expect(skillRow.style.display).toBe('flex');
    expect(skillRow.style.flexWrap).toBe('wrap');
    expect(skillChip).toBeDefined();
    expect(skillChip!.style.whiteSpace).toBe('nowrap');
    expect(bulletItems).toHaveLength(3);
    expect(bulletItems[0].textContent).toContain('Improved status reporting');
    expect(bulletItems[1].textContent).toContain('Partnered with finance');
  });

  test('Elegant Formal keeps compact entries together without moving the whole lower block', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="education-section" data-test-rect="${rectAttr(pageHeight - 180, 40, 720, 210)}">
          <h2 data-export-meaningful="true">Education</h2>
          <div data-export-group="education-entry" data-export-meaningful="true" data-test-rect="${rectAttr(pageHeight - 24, 40, 720, 90)}">Business Administration</div>
        </section>
        <div data-export-group="skills-languages-block" data-test-rect="${rectAttr(pageHeight - 120, 40, 720, 110)}">
          <section data-export-group="skills-section" data-test-rect="${rectAttr(pageHeight - 120, 40, 200, 80)}">Team Leadership</section>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const education = document.querySelector('[data-export-group="education-section"]') as HTMLElement;
    const lowerBlock = document.querySelector('[data-export-group="skills-languages-block"]') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(Number.parseFloat(education.style.marginTop)).toBeGreaterThan(20);
    expect(lowerBlock.style.marginTop).toBe('');
    expect(document.body.textContent).toContain('Business Administration');
  });

  test('Elegant Formal does not push the compact lower skills block onto a trailing page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <div data-export-group="skills-languages-block" data-test-rect="${rectAttr(pageHeight - 34, 40, 720, 80)}">
          <section data-export-group="skills-section" data-test-rect="${rectAttr(pageHeight - 34, 40, 240, 80)}">Team Leadership</section>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const skills = document.querySelector('[data-export-group="skills-section"]') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(skills.style.marginTop).toBe('');
    expect(document.body.textContent).toContain('Team Leadership');
  });

  test('Elegant Formal shifts a Work Experience section heading when the first entry would start on the next page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1800)}">
        <section data-export-group="experience-section" data-test-rect="${rectAttr(pageHeight - 30, 40, 720, 220)}">
          <h2 data-test-rect="${rectAttr(pageHeight - 30, 40, 720, 20)}">Work Experience</h2>
          <div data-export-group="experience-entry" data-test-rect="${rectAttr(pageHeight - 6, 40, 720, 196)}">
            <div data-elegant-formal-entry-row="true" data-test-rect="${rectAttr(pageHeight + 4, 40, 720, 28)}">
              <h3>Učitelj u osnovnoj školi</h3>
            </div>
            <p data-test-rect="${rectAttr(pageHeight + 36, 40, 720, 18)}">Zhff</p>
            <ul>
              <li data-export-bullet-item="elegant-formal" data-test-rect="${rectAttr(pageHeight + 58, 40, 720, 22)}">First bullet line.</li>
            </ul>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const heading = document.querySelector('[data-export-group="experience-section"] h2') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Work Experience');
    expect(document.body.textContent).toContain('Učitelj u osnovnoj školi');
    expect(document.body.textContent).toContain('First bullet line.');
  });

  test('Elegant Formal shifts a Skills section heading when the first skill row would start on the next page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1500)}">
        <div data-export-group="skills-languages-block" data-test-rect="${rectAttr(pageHeight - 40, 40, 720, 90)}">
          <section data-export-group="skills-section" data-test-rect="${rectAttr(pageHeight - 40, 40, 240, 90)}">
            <h2 data-test-rect="${rectAttr(pageHeight - 40, 40, 240, 18)}">Skills</h2>
            <div data-export-skill-row="elegant-formal" data-test-rect="${rectAttr(pageHeight + 4, 40, 240, 28)}">Team Leadership</div>
          </section>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const heading = document.querySelector('[data-export-group="skills-section"] h2') as HTMLElement;
    const skillsBlock = document.querySelector('[data-export-group="skills-languages-block"]') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(skillsBlock.style.marginTop).toBe('');
    expect(document.body.textContent).toContain('Skills');
    expect(document.body.textContent).toContain('Team Leadership');
  });

  test('Elegant Formal shifts an Education section heading when the first education entry would start on the next page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1500)}">
        <section data-export-group="education-section" data-test-rect="${rectAttr(pageHeight - 28, 40, 720, 120)}">
          <h2 data-test-rect="${rectAttr(pageHeight - 28, 40, 720, 18)}">Education</h2>
          <div data-export-group="education-entry" data-test-rect="${rectAttr(pageHeight + 6, 40, 720, 86)}">
            <h3>Business Administration</h3>
            <p>Faculty of Economics | 2010 - 2014</p>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const heading = document.querySelector('[data-export-group="education-section"] h2') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Education');
    expect(document.body.textContent).toContain('2010 - 2014');
  });

  test('Elegant Formal shifts a bullet that ends too close to the bottom of a page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1600)}">
        <div data-export-group="experience-entry" data-test-rect="${rectAttr(pageHeight - 34, 40, 720, 34)}">
          <ul>
            <li data-export-bullet-item="elegant-formal" data-test-rect="${rectAttr(pageHeight - 34, 58, 664, 22)}">
              Redovno sam komunicirao sa roditeljima.
            </li>
          </ul>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const bullet = document.querySelector('[data-export-bullet-item="elegant-formal"]') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(Number.parseFloat(bullet.style.marginTop)).toBeGreaterThan(10);
    expect(document.body.textContent).toContain('Redovno sam komunicirao sa roditeljima.');
  });

  test('Elegant Formal shifts a bullet that starts too close to the top of a page after a cut', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1600)}">
        <div data-export-group="experience-entry" data-test-rect="${rectAttr(pageHeight + 2, 40, 720, 30)}">
          <ul>
            <li data-export-bullet-item="elegant-formal" data-test-rect="${rectAttr(pageHeight + 2, 58, 664, 22)}">
              Koristio sam geografske karte i digitalne alate.
            </li>
          </ul>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const bullet = document.querySelector('[data-export-bullet-item="elegant-formal"]') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(Number.parseFloat(bullet.style.marginTop)).toBeGreaterThan(10);
    expect(document.body.textContent).toContain('Koristio sam geografske karte');
  });

  test('Elegant Formal safe canvas page breaks avoid slicing through measured text lines', () => {
    const lines = [
      { top: 1100, bottom: 1124 },
      { top: 1128, bottom: 1152 },
      { top: 1156, bottom: 1180 },
    ];
    const guardPx = 28;
    const targetBreakPx = 1131;

    expect(isUnsafeElegantFormalPageBreakCanvasPx(1112, lines, guardPx)).toBe(true);
    expect(isUnsafeElegantFormalPageBreakCanvasPx(1140, lines, guardPx)).toBe(true);

    const safeBreakPx = findSafeElegantFormalPageBreakCanvasPx(lines, targetBreakPx, guardPx, 48);
    expect(safeBreakPx).toBeLessThanOrEqual(targetBreakPx);
    expect(isUnsafeElegantFormalPageBreakCanvasPx(safeBreakPx, lines, guardPx)).toBe(false);
    expect(safeBreakPx).toBeGreaterThan(lines[0].bottom);
    expect(safeBreakPx).toBeLessThan(lines[1].top);
  });

  test('Elegant Formal export collects summary text lines for safe canvas slicing', () => {
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1600)}">
        <section data-export-group="summary-section">
          <p data-export-meaningful="true" data-test-rect="${rectAttr(120, 40, 720, 22)}">Line one of summary.</p>
          <p data-test-rect="${rectAttr(160, 40, 720, 22)}">Line two of summary.</p>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;

    const intervals = collectElegantFormalTextLineIntervalsCss(root);

    expect(intervals.length).toBeGreaterThanOrEqual(2);
    expect(exportSource()).toContain('findSafeElegantFormalPageBreakCanvasPx');
    expect(exportSource()).toContain('findSafeElegantFormalPageBreakFromCanvasPixels');
    expect(exportSource()).toContain('resolveElegantFormalSafePageBreakCanvasPx');
    expect(exportSource()).toContain('collectElegantFormalTextLineIntervalsCss');
    expect(exportSource()).toContain('offsetY += sliceHeight');
    expect(exportSource()).toContain('data-ef-pdf-break-sources');
    expect(exportSource()).toContain('ELEGANT_FORMAL_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(exportSource()).toContain('ELEGANT_FORMAL_PDF_PAGE_BOTTOM_INSET_CSS_PX');
    expect(exportSource()).toContain('buildElegantFormalPaddedPdfSlice');
    expect(exportSource()).toContain('renderElegantFormalPdfSlice');
    expect(exportSource()).toContain('planElegantFormalPdfSliceSegments');
    expect(exportSource()).toContain('rebalanceElegantFormalSparseTrailingPdfSliceSegments');
  });

  test('Elegant Formal treats block-level DOM intervals as unreliable on Android-like export roots', () => {
    const intervals = [
      { topCssPx: 120, bottomCssPx: 260 },
      { topCssPx: 300, bottomCssPx: 322 },
    ];

    expect(areElegantFormalDomLineIntervalsReliable(intervals)).toBe(false);
    expect(areElegantFormalDomLineIntervalsReliable([
      { topCssPx: 120, bottomCssPx: 142 },
      { topCssPx: 146, bottomCssPx: 168 },
    ])).toBe(true);
  });

  test('Elegant Formal canvas pixel fallback finds whitespace between rendered summary lines', () => {
    installInkRowCanvasContextMock([1080, 1104, 1128]);
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1400;

    const targetBreakPx = 1131;
    const guardPx = 28;
    const contentLeftPx = 80;
    const contentRightPx = 720;

    expect(isElegantFormalCanvasBreakRowWhitespace(canvas, targetBreakPx, contentLeftPx, contentRightPx)).toBe(false);

    const safeBreakPx = findSafeElegantFormalPageBreakFromCanvasPixels(
      canvas,
      targetBreakPx,
      guardPx,
      96,
      0,
      contentLeftPx,
      contentRightPx,
    );

    expect(safeBreakPx).toBeLessThan(targetBreakPx);
    expect(isElegantFormalCanvasBreakRowWhitespace(canvas, safeBreakPx, contentLeftPx, contentRightPx)).toBe(true);
  });

  test('Elegant Formal resolves page breaks with canvas fallback when DOM intervals are block-level', () => {
    installInkRowCanvasContextMock([1080, 1104, 1128]);
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1400;

    const blockDomIntervals = [{ top: 1080, bottom: 1146 }];
    const resolution = resolveElegantFormalSafePageBreakCanvasPx(
      canvas,
      blockDomIntervals,
      false,
      1131,
      28,
      48,
      96,
      0,
    );

    expect(resolution.source).toBe('canvas');
    expect(resolution.breakPx).toBeLessThan(1131);
    expect(isElegantFormalCanvasBreakRowWhitespace(canvas, resolution.breakPx, 80, 720)).toBe(true);
  });

  test('Elegant Formal padded PDF slices bake white top/bottom breathing room into continuation pages', () => {
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

    const sliceHeight = 400;
    const topInset = 28;
    const bottomInset = 28;
    const padded = buildElegantFormalPaddedPdfSlice(
      sourceCanvas,
      200,
      sliceHeight,
      800,
      topInset,
      bottomInset,
    );

    expect(padded.topInsetCanvasPx).toBe(28);
    expect(padded.bottomInsetCanvasPx).toBe(28);
    expect(padded.paddedHeightPx).toBe(sliceHeight + topInset + bottomInset);
    expect(padded.dataUrl.length).toBeGreaterThan(0);
  });

  test('Elegant Formal merges a sparse trailing tail slice into the previous PDF page', () => {
    const pageHeightPx = 1000;
    const segments = rebalanceElegantFormalSparseTrailingPdfSliceSegments(
      [
        { startPx: 120, endPx: 980, breakSource: 'canvas' },
        { startPx: 980, endPx: 1120, breakSource: 'canvas' },
      ],
      pageHeightPx,
      8,
      [{ top: 990, bottom: 1010 }, { top: 1040, bottom: 1062 }],
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]?.startPx).toBe(120);
    expect(segments[0]?.endPx).toBe(1120);
    expect(isElegantFormalSparseTrailingTailSegment(
      { startPx: 980, endPx: 1120, breakSource: 'canvas' },
      pageHeightPx,
      [{ top: 1080, bottom: 1102 }, { top: 1106, bottom: 1118 }],
    )).toBe(true);
  });

  test('Elegant Formal keeps Education and Skills/Languages together when the combined tail straddles a page', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="elegant-formal" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="education-section" data-test-rect="${rectAttr(pageHeight - 140, 40, 720, 120)}">
          <h2>Education</h2>
          <div data-export-group="education-entry" data-test-rect="${rectAttr(pageHeight - 110, 40, 720, 80)}">Business Administration</div>
        </section>
        <div data-export-group="skills-languages-block" data-test-rect="${rectAttr(pageHeight + 20, 40, 720, 100)}">
          <section data-export-group="skills-section" data-test-rect="${rectAttr(pageHeight + 20, 40, 240, 80)}">Team Leadership</section>
          <section data-export-group="languages-section" data-test-rect="${rectAttr(pageHeight + 20, 520, 240, 80)}">English</section>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="elegant-formal"]') as HTMLElement;
    const education = document.querySelector('[data-export-group="education-section"]') as HTMLElement;
    const skillsBlock = document.querySelector('[data-export-group="skills-languages-block"]') as HTMLElement;

    applyElegantFormalKeepTogetherPagination(root);

    expect(Number.parseFloat(education.style.marginTop)).toBeGreaterThan(20);
    expect(skillsBlock.style.marginTop).toBe('');
    expect(document.body.textContent).toContain('Business Administration');
    expect(document.body.textContent).toContain('Team Leadership');
  });

  test('shared photo preparation supports Android runtime URL and raw Base64 sources', async () => {
    const imageBlob = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(imageBlob) }));

    const blobPrepared = await prepareCvPhotoForExport('blob:http://localhost/android-photo');
    const rawPrepared = await prepareCvPhotoForExport(rawAndroidLikeBase64Photo);

    expect(fetch).toHaveBeenCalledWith('blob:http://localhost/android-photo');
    expect(blobPrepared?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(blobPrepared?.bytes.length).toBeGreaterThan(0);
    expect(rawPrepared?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(rawPrepared?.bytes.length).toBeGreaterThan(0);
  });

  test('Elegant Formal PDF export builds a non-empty one-page Blob for short content', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<ElegantFormalTemplate data={cv()} locale="en" />)}</div>`;
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

  test('Elegant Formal dedicated PDF Blob captures the offscreen export renderer, not the visible preview', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="elegant-formal">VISIBLE PREVIEW SHOULD NOT EXPORT</div></div>';
    const canvas = makeCanvas(800, 1000, () => true);
    const { html2canvasMock, instances } = installPdfMocks(canvas);
    const blob = await buildElegantFormalPdfBlob(cv(), 'en', { photoDataUrl: canonicalElegantFormalJpeg });
    const captureTarget = html2canvasMock.mock.calls[0][0] as HTMLElement;
    const img = captureTarget.querySelector('[data-export-photo="elegant-formal"]') as HTMLImageElement;

    expect(blob.size).toBeGreaterThan(0);
    expect(captureTarget.getAttribute('data-template-id')).toBe('elegant-formal');
    expect(captureTarget.getAttribute('data-elegant-formal-pdf-template')).toBe('true');
    expect(captureTarget.textContent).toContain('Dragan Obradovic');
    expect(captureTarget.textContent).not.toContain('VISIBLE PREVIEW SHOULD NOT EXPORT');
    expect(captureTarget.querySelector('[data-elegant-formal-photo="frame"]')).not.toBeNull();
    expect(captureTarget.querySelectorAll('img')).toHaveLength(1);
    expect(img.getAttribute('src')).toBe(canonicalElegantFormalJpeg);
    expect(document.querySelector('[data-elegant-formal-pdf-export-container]')).toBeNull();
    expect(instances[0].pages).toBe(1);
  });

  test('Elegant Formal dedicated PDF throws when original photo exists but photoDataUrl is missing', async () => {
    await expect(buildElegantFormalPdfBlob(
      cv({ personal: { originalPhoto: realPhotoPng, rectangularPhoto: undefined } }),
      'en',
      { photoDataUrl: null },
    )).rejects.toThrow('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
  });

  test('Elegant Formal semantic bounds skip a trailing empty A4 slice', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 72;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    document.body.innerHTML = `<div id="cv-preview">${semanticElegantFormalHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: 120, height: 40, text: 'Dragan Obradovic' }],
    })}</div>`;
    installRectMock();
    const canvas = makeCanvas(canvasWidth, canvasHeight, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances[0].pages).toBe(1);
    expect(instances[0].addImage).toHaveBeenCalledTimes(1);
  });

  test('Elegant Formal semantic bounds preserve a later nonblank page', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 120;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    document.body.innerHTML = `<div id="cv-preview">${semanticElegantFormalHtml({
      rootWidth,
      rootHeight,
      meaningful: [
        { top: 120, height: 40, text: 'Dragan Obradovic' },
        { top: pageHeightCss + 36, height: 40, text: 'Later page skills' },
      ],
    })}</div>`;
    installRectMock();
    const canvas = makeCanvas(canvasWidth, canvasHeight, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Elegant Formal semantic pagination does not crop meaningful skills to force one page', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 56;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    document.body.innerHTML = `<div id="cv-preview">${semanticElegantFormalHtml({
      rootWidth,
      rootHeight,
      meaningful: [
        { top: 120, height: 40, text: 'Dragan Obradovic' },
        { top: pageHeightCss + 16, height: 28, text: 'Presentation Skills' },
      ],
    })}</div>`;
    installRectMock();
    const canvas = makeCanvas(canvasWidth, canvasHeight, (y) => y < pageHeightCss * 2 || y > pageHeightCss * 2 + 16);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Elegant Formal no-photo PDF remains valid and has no broken image frame', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<ElegantFormalTemplate data={cv({ personal: { photo: undefined, photoEnabled: false } })} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { instances } = installPdfMocks(canvas);

    const blob = await buildCvPdfBlob('cv-preview');

    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0].pages).toBe(1);
    expect(document.querySelector('[data-template-id="elegant-formal"] img')).toBeNull();
  });

  test('Elegant Formal dedicated PDF reaches the shared save result after Blob generation', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="elegant-formal">VISIBLE PREVIEW SHOULD NOT EXPORT</div></div>';
    const canvas = makeCanvas(800, 1000, () => true);
    installPdfMocks(canvas);
    const clickSpy = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') el.click = clickSpy;
      return el;
    });
    const result = await exportElegantFormalPdf(cv(), 'Dragan Obradovic - CV', 'en', { photoDataUrl: canonicalElegantFormalJpeg });

    expect(result.result).toBe('saved');
    expect(result.platform).toBe('web');
    expect(result.fileName).toBe('Dragan Obradovic - CV.pdf');
    expect(result.sourceBytes).toBeGreaterThan(0);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  test('Elegant Formal DOCX with photo contains editable body text, media, and relationship', async () => {
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

    await exportToDOCX(
      cv({ personal: { photo: canonicalElegantFormalJpeg } }),
      'elegant-formal-photo-test',
      'en',
      'elegant-formal',
      {
        elegantFormalPhoto: {
          dataUrl: canonicalElegantFormalJpeg,
          bytes: canonicalElegantFormalBytes,
          mimeType: 'image/jpeg',
          width: ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
          height: ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
          source: 'original-photo',
        },
      },
    );

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);
    expect(Array.from(new Uint8Array(await savedBlob!.slice(0, 2).arrayBuffer()))).toEqual([0x50, 0x4b]);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const contentTypesXml = await zip.file('[Content_Types].xml')!.async('text');
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !name.endsWith('/'));
    const firstTableXml = documentXml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)?.[0] ?? '';
    const extent = documentXml.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);

    expect(documentXml).toContain('Dragan Obradovic');
    expect(documentXml).toContain('Senior operations manager with a record');
    expect(documentXml).toContain('Adriatic Systems');
    expect(documentXml).toContain('Team\u00A0Leadership');
    expect(documentXml).toContain('Time\u00A0Management');
    expect(documentXml).toContain('Presentation\u00A0Skills');
    expect(documentXml).toContain(' | ');
    expect(documentXml).toContain('<w:numPr>');
    expect(documentXml).toContain('B45309');
    expect(documentXml).toContain('<w:drawing>');
    expect(extent).not.toBeNull();
    expect(Number(extent![1]) / Number(extent![2])).toBeCloseTo(ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH / ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT, 3);
    expect(firstTableXml).toContain('<w:insideH w:val="nil"');
    expect(firstTableXml).toContain('<w:insideV w:val="nil"');
    expect(firstTableXml).toContain('<w:tcBorders>');
    expect(firstTableXml).toContain('<w:start w:val="nil"');
    expect(firstTableXml).toContain('<w:end w:val="nil"');
    expect(firstTableXml).toContain('<w:tblCellSpacing w:type="dxa" w:w="0"');
    expect(firstTableXml).not.toContain('<w:insideH w:val="single"');
    expect(firstTableXml).not.toContain('<w:insideV w:val="single"');
    expect(firstTableXml).not.toContain('w:color="auto"');
    expect(relsXml).toContain('image');
    expect(contentTypesXml).toMatch(/image\/(?:jpeg|png)/);
    expect(mediaFiles.length).toBeGreaterThan(0);
    expect(Array.from(new Uint8Array(await zip.file(mediaFiles[0])!.async('arraybuffer')))).toEqual(Array.from(canonicalElegantFormalBytes));
  });

  test('Elegant Formal reload flow renders preview and exports PDF/DOCX from the same canonical personal photo bytes', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(canonicalElegantFormalJpeg);
    const canonical = await prepareElegantFormalCanonicalPhoto({
      originalPhoto: realPhotoPng,
      rectangularPhoto: 'data:image/jpeg;base64,stale',
    });
    expect(canonical?.source).toBe('original-photo');
    expect(canonical?.width).toBe(246);
    expect(canonical?.height).toBe(327);

    saveCvDraft({
      cv: cv({
        personal: {
          photo: realPhotoPng,
          originalPhoto: realPhotoPng,
          circularPhoto: realPhotoPng,
          rectangularPhoto: canonical!.dataUrl,
        },
      }),
      savedAt: new Date().toISOString(),
    });
    const reloaded = loadCvDraft()!.cv;
    expect(personalPhotoFields(reloaded).originalPhoto).toBe(realPhotoPng);
    expect(personalPhotoFields(reloaded).rectangularPhoto).toBe(canonical!.dataUrl);

    const previewCv = {
      ...reloaded,
      personal: { ...reloaded.personal, photo: `${personalPhotoFields(reloaded).rectangularPhoto}#rect` },
    };
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<ElegantFormalTemplate data={previewCv} locale="en" />)}</div>`;
    const previewImg = document.querySelector<HTMLImageElement>('[data-template-id="elegant-formal"] img');
    expect(previewImg).not.toBeNull();
    expect(previewImg!.getAttribute('src')).toContain(canonical!.dataUrl);

    const canvas = makeCanvas(800, 1000, () => true);
    const { instances } = installPdfMocks(canvas);
    const pdfBlob = await buildCvPdfBlob('cv-preview');
    expect(pdfBlob.size).toBeGreaterThan(0);
    expect(instances[0].pages).toBe(1);

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
    await exportToDOCX(
      { ...reloaded, personal: { ...reloaded.personal, photo: canonical!.dataUrl } },
      'elegant-formal-reload-flow',
      'en',
      'elegant-formal',
      { elegantFormalPhoto: canonical },
    );

    expect(savedBlob).toBeDefined();
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !name.endsWith('/'));
    expect(documentXml).toContain('<w:drawing>');
    expect(relsXml).toContain('image');
    expect(mediaFiles).toHaveLength(1);
    expect(Array.from(new Uint8Array(await zip.file(mediaFiles[0])!.async('arraybuffer')))).toEqual(Array.from(canonical!.bytes));
  });

  test('Elegant Formal DOCX preserves repeated user skills while keeping multi-word skills non-breaking', async () => {
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

    await exportToDOCX(
      cv({ personal: { photo: undefined, photoEnabled: false }, skills: ['Coaching', 'Coaching', 'Time Management', 'Presentation Skills'] }),
      'elegant-formal-skill-test',
      'en',
      'elegant-formal',
    );

    expect(savedBlob).toBeDefined();
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');

    expect((documentXml.match(/Coaching/g) ?? [])).toHaveLength(2);
    expect(documentXml).toContain('Time\u00A0Management');
    expect(documentXml).toContain('Presentation\u00A0Skills');
  });

  test('Elegant Formal DOCX rejects non-canonical Android-like raw Base64 photo source', async () => {
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

    await exportToDOCX(cv({ personal: { photo: rawAndroidLikeBase64Photo } }), 'elegant-formal-android-source-test', 'en', 'elegant-formal');

    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !name.endsWith('/'));

    expect(documentXml).toContain('Dragan Obradovic');
    expect(documentXml).not.toContain('<w:drawing>');
    expect(relsXml).not.toContain('image');
    expect(mediaFiles).toHaveLength(0);
  });

  test('Elegant Formal DOCX without photo remains valid and does not lose text', async () => {
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

    await exportToDOCX(cv({ personal: { photo: undefined, photoEnabled: false } }), 'elegant-formal-no-photo-test', 'en', 'elegant-formal');

    expect(savedBlob).toBeDefined();
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !name.endsWith('/'));

    expect(documentXml).toContain('Dragan Obradovic');
    expect(documentXml).toContain('Senior operations manager with a record');
    expect(documentXml).toContain('Team\u00A0Leadership');
    expect(documentXml).not.toContain('<w:drawing>');
    expect(mediaFiles).toHaveLength(0);
  });
});
