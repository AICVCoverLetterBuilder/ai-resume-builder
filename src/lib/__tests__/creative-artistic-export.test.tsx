/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreativeArtisticTemplate, templateComponents } from '@/components/cv-templates';
import {
  applyCreativeArtisticKeepTogetherPagination,
  buildCvPdfBlob,
  createMeaningfulContentPagePlan,
  exportToDOCX,
  exportToPDF,
  measureExportMeaningfulContentBounds,
} from '@/lib/export';
import { getCvExportSuccessToast } from '@/lib/export-success-toast';
import type { CVData } from '@/lib/types';

const realPhotoPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mP8z8DwnwEJMDGgAcQGALpCAwPXYZaSAAAAAElFTkSuQmCC';

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'creative-artistic-test',
    name: '',
    personal: {
      fullName: 'Sofia Rossi',
      email: 'sofia@example.com',
      phone: '+39 02 123 4567',
      address: 'Milan, Italy',
      jobTitle: 'Creative Director',
      photo: realPhotoPng,
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
    templateId: 'creative-artistic',
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
        data[index] = 124;
        data[index + 1] = 58;
        data[index + 2] = 237;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  canvas.__ctx = ctx;
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,creative-artistic'), configurable: true });
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
        return new Blob(['%PDF-1.7\ncreative-artistic\n%%EOF'], { type: 'application/pdf' });
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

function semanticCreativeArtisticHtml(options: {
  rootWidth: number;
  rootHeight: number;
  meaningful: Array<{ top: number; height: number; text?: string }>;
}) {
  const rootRect = rectAttr(0, 0, options.rootWidth, options.rootHeight);
  const items = options.meaningful.map((item, index) =>
    `<p data-export-meaningful="true" data-test-rect="${rectAttr(item.top, 32, options.rootWidth - 64, item.height)}">${item.text ?? `Meaningful ${index}`}</p>`,
  ).join('');

  return `
    <div
      data-template-id="creative-artistic"
      data-test-rect="${rootRect}"
      style="width:${options.rootWidth}px;height:${options.rootHeight}px;background:#fff"
    >
      <header style="height:164px;background:linear-gradient(90deg,#7c3aed,#c026d3)"></header>
      <div>${items}</div>
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
  vi.doUnmock('html2canvas');
  vi.doUnmock('jspdf');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Creative Artistic export routing and rendering', () => {
  test('Creative Artistic resolves to the real renderer and export-safe A4 root', () => {
    const html = renderToStaticMarkup(<CreativeArtisticTemplate data={cv()} locale="en" />);

    expect(templateComponents['creative-artistic']).toBe(CreativeArtisticTemplate);
    expect(html).toContain('data-template-id="creative-artistic"');
    expect(html).toContain('box-border');
    expect(html).toContain('w-[210mm]');
    expect(html).toContain('min-height:297mm');
  expect(html).toContain('linear-gradient(90deg, #7c3aed 0%, #c026d3 100%)');
    expect(html).toContain('data-export-meaningful="true"');
    expect(html).toContain('data-export-group="education-section"');
    expect(html).toContain('data-export-group="education-entry"');
    expect(html).toContain('data-export-group="skills-block"');
    expect(html).toContain('data-export-contact-item="true"');
    expect(html).toContain('sofia@example.com');
    expect(html).toContain('•');
    expect(html).toContain('Brand Strategy');
    expect(html).toContain('font-kerning:normal');
  });

  test('Creative Artistic is included in styled html2canvas clone and image paths', () => {
    const src = exportSource();

    expect(src).toContain("'creative-artistic'");
    expect(src).toContain('function isCreativeArtisticCaptureTarget');
    expect(src).toContain("if (isCreativeArtisticCaptureTarget(target)) return 'creative-artistic'");
    expect(src).toContain('fallbackCreativeArtisticColor');
    expect(src).toContain('applyCreativeArtisticPdfLayout');
    expect(src).toContain('applyCreativeArtisticKeepTogetherPagination');
    expect(src).toContain('normalizeCreativeArtisticPdfTextStyles');
    expect(src).toContain("captureTemplateId === 'creative-artistic'");
  });

  test('Creative Artistic PDF layout hooks are gated away from existing styled templates', () => {
    const src = exportSource();
    const cloneBlock = src.slice(src.indexOf('onclone: (clonedDocument)'), src.indexOf('cloneRoot.removeAttribute'));
    const professionalBranch = cloneBlock.slice(
      cloneBlock.indexOf("if (captureTemplateId === 'professional-classic')"),
      cloneBlock.indexOf("if (captureTemplateId === 'creative-bold')"),
    );
    const boldBranch = cloneBlock.slice(
      cloneBlock.indexOf("if (captureTemplateId === 'creative-bold')"),
      cloneBlock.indexOf("if (captureTemplateId === 'creative-artistic')"),
    );
    const artisticBranch = cloneBlock.slice(cloneBlock.indexOf("if (captureTemplateId === 'creative-artistic')"));

    expect(cloneBlock).not.toContain("if (captureTemplateId === 'modern-minimal')");
    expect(cloneBlock).not.toContain("if (captureTemplateId === 'clean-simple')");
    expect(professionalBranch).not.toContain('applyCreativeArtistic');
    expect(boldBranch).not.toContain('applyCreativeArtistic');
    expect(artisticBranch).toContain('applyCreativeArtisticPdfLayout');
    expect(artisticBranch).toContain('applyCreativeArtisticKeepTogetherPagination');
  });

  test('Creative Artistic keeps short education groups together across page boundaries', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="creative-artistic" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="education-section" data-test-rect="${rectAttr(pageHeight - 24, 32, 720, 90)}">
          <h2 data-export-meaningful="true">Education</h2>
          <div data-export-group="education-entry" data-export-meaningful="true">
            <h3>VI</h3>
            <p>Metematicki fakultet | 2020-01 - 2025-02</p>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="creative-artistic"]') as HTMLElement;
    const education = document.querySelector('[data-export-group="education-section"]') as HTMLElement;

    applyCreativeArtisticKeepTogetherPagination(root);

    expect(Number.parseFloat(education.style.marginTop)).toBeGreaterThan(20);
    expect(document.body.textContent).toContain('VI');
    expect(document.body.textContent).toContain('Metematicki fakultet');
    expect((document.body.textContent?.match(/VI/g) ?? [])).toHaveLength(1);
  });

  test('Creative Artistic does not move a short education group that already fits', () => {
    document.body.innerHTML = `
      <div data-template-id="creative-artistic" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="education-section" data-test-rect="${rectAttr(820, 32, 720, 90)}">
          <h2 data-export-meaningful="true">Education</h2>
          <div data-export-group="education-entry" data-export-meaningful="true">
            <h3>VI</h3>
            <p>Metematicki fakultet | 2020-01 - 2025-02</p>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="creative-artistic"]') as HTMLElement;
    const education = document.querySelector('[data-export-group="education-section"]') as HTMLElement;

    applyCreativeArtisticKeepTogetherPagination(root);

    expect(education.style.marginTop).toBe('');
  });

  test('Creative Artistic keeps Skills heading with the skills block', () => {
    const pageHeight = (297 / 210) * 800;
    document.body.innerHTML = `
      <div data-template-id="creative-artistic" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <div data-export-group="skills-block" data-test-rect="${rectAttr(pageHeight - 10, 32, 720, 86)}">
          <section data-export-group="skills-section">
            <h2 data-export-meaningful="true">Skills</h2>
            <div data-export-group="skills-row"><span data-export-meaningful="true">Teamwork</span></div>
          </section>
        </div>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="creative-artistic"]') as HTMLElement;
    const skillsBlock = document.querySelector('[data-export-group="skills-block"]') as HTMLElement;

    applyCreativeArtisticKeepTogetherPagination(root);

    expect(Number.parseFloat(skillsBlock.style.marginTop)).toBeGreaterThan(5);
    expect(document.body.textContent).toContain('Skills');
    expect(document.body.textContent).toContain('Teamwork');
  });

  test('Creative Artistic contact items are unbroken units with attached separators', () => {
    const html = renderToStaticMarkup(<CreativeArtisticTemplate data={cv({ personal: { address: 'Braće Abafi 4' } })} locale="en" />);

    expect(html).toContain('Braće Abafi 4');
    expect(html).toContain('data-export-contact-item="true"');
    expect(html).toContain('data-export-contact-separator="true"');
    expect(html).toContain('white-space:nowrap');
    expect(html).toContain('flex-shrink:0');
    expect(html).not.toContain('Braće Abafi <');
  });

  test('Creative Artistic skill chips are complete nowrap flex items', () => {
    const html = renderToStaticMarkup(<CreativeArtisticTemplate data={cv({ skills: ['Presentation Skills', 'Teamwork'] })} locale="en" />);

    expect(html).toContain('Presentation Skills');
    expect(html).toContain('data-export-skill-chip="true"');
    expect(html).toContain('display:inline-flex');
    expect(html).toContain('white-space:nowrap');
    expect(html).toContain('flex:0 0 auto');
    expect(html).not.toContain('Presentation <');
  });

  test('Creative Artistic PDF errors do not route to Android/browser print fallback', () => {
    const source = cvBuilderSource();
    const guard = source.indexOf("cv.templateId === 'creative-artistic'");
    const fallback = source.indexOf('await openPrintFallback', guard);
    const guardBlock = source.slice(guard, fallback);

    expect(guard).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(guard);
    expect(guardBlock).toContain('toast.error(t.cv.pdfExportFailed)');
    expect(guardBlock).toContain('return;');
  });

  test('Creative Artistic PDF clone preserves gradient header, white body, photo, contacts, skills, and normal spacing', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<CreativeArtisticTemplate data={cv()} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { cloneDocuments } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    const cloneRoot = cloneDocuments[0].querySelector('[data-template-id="creative-artistic"]') as HTMLElement;
    const header = cloneRoot.querySelector('header') as HTMLElement;
    const body = header.nextElementSibling as HTMLElement;
    const photo = cloneRoot.querySelector('img') as HTMLImageElement;
    const skills = cloneRoot.querySelectorAll('[data-export-meaningful="true"]');

    expect(cloneRoot.textContent).toContain('Sofia Rossi');
    expect(cloneRoot.textContent).toContain('Creative Director');
    expect(cloneRoot.textContent).toContain('sofia@example.com');
    expect(cloneRoot.textContent).toContain('•');
    expect(cloneRoot.textContent).toContain('Brand Strategy');
    expect(cloneRoot.textContent).not.toContain('CreativeDirector');
    expect(cloneRoot.style.width).toBe('210mm');
    expect(header.style.background || header.style.backgroundImage).toMatch(/linear-gradient/i);
    expect(header.style.backgroundColor).toBe('rgb(124, 58, 237)');
    expect(body.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(photo.alt).toBe('');
    expect(photo.style.objectFit).toBe('cover');
    expect(skills.length).toBeGreaterThan(10);
    expect(cloneRoot.style.fontFamily).toContain('Arial');
    expect(cloneRoot.style.wordSpacing).toBe('normal');
    expect(cloneRoot.style.letterSpacing).toBe('normal');
    expect(cloneRoot.style.whiteSpace).toBe('normal');
    expect(cloneRoot.style.fontKerning).toBe('normal');
  });

  test('Creative Artistic PDF clone reapplies nowrap after text normalization for contacts and chips', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<CreativeArtisticTemplate data={cv({
      personal: { address: 'BraÄ‡e Abafi 4' },
      skills: ['Presentation Skills', 'Teamwork'],
    })} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { cloneDocuments } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    const cloneRoot = cloneDocuments[0].querySelector('[data-template-id="creative-artistic"]') as HTMLElement;
    const address = Array.from(cloneRoot.querySelectorAll<HTMLElement>('[data-export-contact-item="true"]'))
      .find(item => item.textContent?.includes('BraÄ‡e Abafi 4'));
    const separator = address?.querySelector<HTMLElement>('[data-export-contact-separator="true"]');
    const presentationChip = Array.from(cloneRoot.querySelectorAll<HTMLElement>('[data-export-skill-chip="true"]'))
      .find(item => item.textContent === 'Presentation Skills');

    expect(address).toBeDefined();
    expect(address!.style.display).toBe('inline-flex');
    expect(address!.style.whiteSpace).toBe('nowrap');
    expect(address!.style.flexShrink).toBe('0');
    expect(address!.style.wordBreak).toBe('keep-all');
    expect(separator).toBeDefined();
    expect(separator!.parentElement).toBe(address);
    expect(separator!.style.whiteSpace).toBe('nowrap');

    expect(presentationChip).toBeDefined();
    expect(presentationChip!.style.display).toBe('inline-flex');
    expect(presentationChip!.style.whiteSpace).toBe('nowrap');
    expect(presentationChip!.style.flexShrink).toBe('0');
    expect(presentationChip!.style.wordBreak).toBe('keep-all');
  });

  test('Creative Artistic PDF export builds a non-empty one-page Blob for short content', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-artistic" style="width:800px;height:1000px">Creative Artistic</div></div>';
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

  test('Creative Artistic PDF boundary content within trailing tolerance stays one page', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-artistic" style="width:800px;height:1144px">Creative Artistic</div></div>';
    const canvas = makeCanvas(800, 1144, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances[0].pages).toBe(1);
  });

  test('Creative Artistic semantic bounds skip a trailing gradient-only slice', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 72;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeArtisticHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: 120, height: 40, text: 'Sofia Rossi' }],
    })}</div>`;
    installRectMock();
    const canvas = makeCanvas(canvasWidth, canvasHeight, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances[0].pages).toBe(1);
    expect(instances[0].addImage).toHaveBeenCalledTimes(1);
  });

  test('Creative Artistic semantic bounds preserve a later page with real content', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 96;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeArtisticHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: pageHeightCss + 18, height: 30, text: 'Later page skill' }],
    })}</div>`;
    installRectMock();
    const canvas = makeCanvas(canvasWidth, canvasHeight, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Creative Artistic semantic bounds prevent blank trimming from cropping pale final content', async () => {
    const rootWidth = 800;
    const pageHeightCss = (297 / 210) * rootWidth;
    const rootHeight = pageHeightCss + 96;
    const canvasWidth = 1600;
    const canvasHeight = Math.ceil(rootHeight * 2);
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeArtisticHtml({
      rootWidth,
      rootHeight,
      meaningful: [{ top: pageHeightCss + 24, height: 36, text: 'Skills Teamwork' }],
    })}</div>`;
    installRectMock();
    const canvas = makeCanvas(canvasWidth, canvasHeight, y => y < 120);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances[0].pages).toBe(2);
    expect(instances[0].addImage).toHaveBeenCalledTimes(2);
  });

  test('Creative Artistic meaningful page plan uses root-relative content bounds', () => {
    document.body.innerHTML = `<div id="cv-preview">${semanticCreativeArtisticHtml({
      rootWidth: 793.7,
      rootHeight: 1168.2,
      meaningful: [{ top: 100, height: 900, text: 'Boundary content' }],
    })}</div>`;
    installRectMock();
    const root = document.querySelector('[data-template-id="creative-artistic"]') as HTMLElement;
    const bounds = measureExportMeaningfulContentBounds(root);
    const plan = createMeaningfulContentPagePlan(bounds!, 1587, 793.7);
    const pageHeightPx = (297 / 210) * 1587;

    expect(bounds).not.toBeNull();
    expect(plan).not.toBeNull();
    expect(plan!.maxBottomCanvasPx).toBeLessThan(pageHeightPx);
  });

  test('Creative Artistic no-photo PDF remains valid and has no broken image frame', async () => {
    document.body.innerHTML = `<div id="cv-preview">${renderToStaticMarkup(<CreativeArtisticTemplate data={cv({ personal: { photo: undefined, photoEnabled: false } })} locale="en" />)}</div>`;
    const canvas = makeCanvas(800, 1000, () => true);
    const { instances } = installPdfMocks(canvas);

    const blob = await buildCvPdfBlob('cv-preview');

    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0].pages).toBe(1);
    expect(document.querySelector('[data-template-id="creative-artistic"] img')).toBeNull();
  });

  test('Creative Artistic PDF reaches the shared save result after Blob generation', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="creative-artistic" style="width:800px;height:1000px">Creative Artistic</div></div>';
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

  test('Creative Artistic verified Android PDF save produces exactly one shared success toast payload', () => {
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

  test('Creative Artistic DOCX uses the existing dedicated branch', () => {
    const src = exportSource();
    const config = src.indexOf("'creative-artistic': {");
    const branch = src.slice(src.indexOf("cfg.customLayout === 'creative-artistic'"), src.indexOf("else if (cfg.customLayout === 'elegant-formal'"));

    expect(config).toBeGreaterThan(0);
    expect(src.slice(config, config + 800)).toContain("customLayout: 'creative-artistic'");
    expect(src.slice(config, config + 800)).toContain("layout: 'dark-header'");
    expect(branch).toContain('ImageRun');
    expect(branch).toContain('caHeading');
    expect(branch).toContain('left purple border accent');
  });

  test('Creative Artistic DOCX with photo contains editable body text, media, and relationship', async () => {
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

    await exportToDOCX(cv(), 'creative-artistic-photo-test', 'en', 'creative-artistic');

    expect(clickSpy).toHaveBeenCalled();
    expect(savedBlob).toBeDefined();
    expect(savedBlob!.size).toBeGreaterThan(5000);
    expect(Array.from(new Uint8Array(await savedBlob!.slice(0, 2).arrayBuffer()))).toEqual([0x50, 0x4b]);

    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const documentXml = await zip.file('word/document.xml')!.async('text');
    const relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('word/media/'));

    expect(documentXml).toContain('Sofia Rossi');
    expect(documentXml).toContain('Creative director with a record');
    expect(documentXml).toContain('Studio Visiva');
    expect(documentXml).toContain('Brand Strategy');
    expect(documentXml).toContain('Italian');
    expect(documentXml).toContain('7C3AED');
    expect(documentXml).toContain('<w:drawing>');
    expect(relsXml).toContain('image');
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  test('Creative Artistic DOCX without photo remains valid and does not lose text', async () => {
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

    await exportToDOCX(cv({ personal: { photo: undefined, photoEnabled: false } }), 'creative-artistic-no-photo-test', 'en', 'creative-artistic');

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
});
