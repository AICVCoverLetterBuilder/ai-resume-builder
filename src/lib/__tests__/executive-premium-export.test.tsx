/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { ExecutivePremiumTemplate, templateComponents } from '@/components/cv-templates';
import { createExecutivePremiumPdfTemplate } from '@/lib/executive-premium-pdf-template';
import {
  buildCvPdfBlob,
  buildExecutivePremiumPdfBlob,
  buildPaddedPdfSlice,
  exportToDOCX,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==';

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'executive-premium-test',
    name: '',
    personal: {
      fullName: 'Marcus Thorne',
      email: 'm.thorne@example.com',
      phone: '+1 212 333 0198',
      address: 'New York, NY',
      jobTitle: 'Chief Revenue Officer',
      photo,
      originalPhoto: photo,
      rectangularPhoto: photo,
      circularPhoto: 'data:image/png;base64,AQID',
      photoEnabled: true,
    },
    summary: 'Executive leader with 15 years building high-performance teams and predictable growth.',
    experience: [
      {
        id: 'exp1',
        company: 'Global Ventures',
        position: 'Chief Revenue Officer',
        startDate: '2019-04',
        endDate: '',
        isPresent: true,
        description: '- Led a team of 20 sales reps, exceeding quarterly targets.\n- Improved CRM pipeline hygiene.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Harvard Business School', degree: 'MBA', startDate: '2012-09', endDate: '2014-05', description: '' },
    ],
    skills: ['Strategic Planning', 'Leadership', 'Negotiation', 'Coaching', 'Coaching'],
    certifications: [],
    languages: [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Intermediate' }],
    templateId: 'executive-premium',
    region: 'US',
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
  naturalWidth = 600;
  naturalHeight = 800;
  complete = true;
  private currentSrc = '';

  get src() {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
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
        data[index] = 17;
        data[index + 1] = 24;
        data[index + 2] = 39;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => photo), configurable: true });
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
        return new Blob(['%PDF-1.7\nexecutive-premium\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances };
}

async function captureDocx(data: CVData): Promise<{ documentXml: string; mediaNames: string[]; mediaBytes: Uint8Array[] }> {
  const blobByUrl = new Map<string, Blob>();
  let capturedBlob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:http://test/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });

  await exportToDOCX(data, 'executive-premium-docx-test', 'en', 'executive-premium');
  expect(capturedBlob).not.toBeNull();
  const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const mediaNames = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && !name.endsWith('/'));
  const mediaBytes = await Promise.all(mediaNames.map(name => zip.file(name)!.async('uint8array')));
  return { documentXml, mediaNames, mediaBytes };
}

function visibleDocxText(documentXml: string): string {
  return documentXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function source(file: string): string {
  return fs.readFileSync(path.resolve(file), 'utf8');
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
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

describe('Executive Premium export', () => {
  test('executive-premium resolves to the React component with a stable marker', () => {
    const html = renderToStaticMarkup(<ExecutivePremiumTemplate data={cv()} locale="en" />);

    expect(templateComponents['executive-premium']).toBe(ExecutivePremiumTemplate);
    expect(html).toContain('data-template-id="executive-premium"');
  });

  test('dedicated PDF renderer creates the centered narrow navy header with photo and separators', () => {
    const root = createExecutivePremiumPdfTemplate(cv(), { locale: 'en', photoDataUrl: photo });
    const header = root.querySelector('[data-executive-premium-pdf-header]') as HTMLElement;

    expect(root.dataset.templateId).toBe('executive-premium');
    expect(root.style.width).toBe('210mm');
    expect(header.style.backgroundColor).toBe('rgb(17, 24, 39)');
    expect(header.style.width).toBe('540px');
    expect(root.querySelector('[data-export-photo="executive-premium"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-export-contact-separator="executive-premium"]').length).toBeGreaterThanOrEqual(2);
    expect(root.textContent).toContain('New York, NY');
  });

  test('no-photo Executive Premium PDF is valid and does not reserve an image', () => {
    const root = createExecutivePremiumPdfTemplate(cv(), { locale: 'en', photoDataUrl: null });

    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('MARCUS THORNE');
    expect(root.textContent).toContain('Strategic Planning');
  });

  test('bullets remain separate and lower Skills/Languages layout exists', () => {
    const root = createExecutivePremiumPdfTemplate(cv(), { locale: 'en', photoDataUrl: photo });

    expect(root.querySelectorAll('[data-export-bullet-row="executive-premium"]')).toHaveLength(2);
    expect(root.querySelector('[data-export-group="executive-premium-lower-layout"]')).not.toBeNull();
    expect(root.textContent).toContain('Coaching | Coaching');
  });

  test('production handler routes executive-premium to direct PDF export and disables print fallback', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const branch = pageSource.indexOf("liveCv.templateId === 'executive-premium'");
    const fallback = pageSource.indexOf('await openPrintFallback', branch);
    const guard = pageSource.indexOf("cv.templateId === 'clean-simple'", branch);

    expect(branch).toBeGreaterThan(-1);
    expect(pageSource.slice(branch, branch + 500)).toContain('exportExecutivePremiumPdf');
    expect(guard).toBeGreaterThan(branch);
    expect(fallback).toBeGreaterThan(guard);
    expect(pageSource.slice(guard, fallback)).toContain("cv.templateId === 'executive-premium'");
  });

  test('Executive Premium PDF Blob is non-empty and short fixture remains one page', async () => {
    const canvas = makeCanvas(800, 1000, () => true);
    const { html2canvasMock, instances } = installPdfMocks(canvas);

    const blob = await buildExecutivePremiumPdfBlob(cv({ personal: { photoEnabled: false, originalPhoto: undefined, rectangularPhoto: undefined } }), 'en');

    expect(html2canvasMock).toHaveBeenCalled();
    expect(blob.size).toBeGreaterThan(0);
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
  });

  test('Executive Premium blank trailing canvas content is removed before pagination', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="executive-premium" style="width:800px;height:2300px"><div data-export-meaningful="true" style="height:900px">Executive Premium</div></div></div>';
    const canvas = makeCanvas(800, 2300, y => y < 900);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
  });

  test('Executive Premium PDF export bakes continuation-page top padding into slice bitmaps', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('EXECUTIVE_PREMIUM_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(exportSource).toContain('EXECUTIVE_PREMIUM_PDF_PAGE_BOTTOM_INSET_CSS_PX');
    expect(exportSource).toContain('buildPaddedPdfSlice');
    expect(exportSource).toContain("captureTemplateId === 'executive-premium'");
    expect(exportSource).toContain('renderPaddedPdfSlice');

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

    const padded = buildPaddedPdfSlice(sourceCanvas, 200, 400, 800, 28, 28);
    expect(padded.topInsetCanvasPx).toBe(28);
    expect(padded.bottomInsetCanvasPx).toBe(28);
    expect(padded.paddedHeightPx).toBe(456);
  });

  test('DOCX branch uses Executive Premium layout and avoids circular photo sources', () => {
    const exportSource = source('src/lib/export.ts');
    const branchStart = exportSource.indexOf("cfg.customLayout === 'executive-premium'");
    const branchEnd = exportSource.indexOf("else if (cfg.customLayout === 'clean-simple')", branchStart);
    const branch = exportSource.slice(branchStart, branchEnd);

    expect(exportSource).toContain("customLayout: 'executive-premium'");
    expect(exportSource).toContain('prepareExecutivePremiumCanonicalPhoto');
    expect(branch).toContain('alignment: AlignmentType.CENTER');
    expect(branch).toContain('D97706');
    expect(branch).toContain('epHeaderBorders');
    expect(branch).toContain('insideHorizontal');
    expect(branch).toContain('const epHeaderParagraphs');
    expect(branch).toContain('rows: [new TableRow');
    expect(branch).not.toContain('epHeaderRows');
    expect(branch).toContain("new TextRun({ text: '-  '");
    expect(branch).toContain("epLocalizedSkills.map((s, i) => new TextRun({ text: (i > 0 ? ' | ' : '') + s");
    expect(branch).not.toContain('circularPhoto');
  });

  test('Executive Premium DOCX keeps skills compact, editable, and not duplicated', async () => {
    const data = cv({
      personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined, rectangularPhoto: undefined },
      summary: 'Senior teacher with experience creating structured and inclusive classrooms.',
      skills: ['Teamwork', 'Organization', 'Time Management', 'Creativity', 'Presentation Skills', 'Coaching', 'Coaching', 'Leadership'],
      languages: [],
    });
    const { documentXml, mediaNames } = await captureDocx(data);
    const text = visibleDocxText(documentXml);

    expect(mediaNames).toHaveLength(0);
    expect(text).not.toContain('PROFESSIONAL SUMMARY');
    expect(text).toContain('Senior teacher with experience creating structured and inclusive classrooms.');
    expect(text).toContain('Teamwork | Organization | Time Management | Creativity | Presentation Skills | Coaching | Coaching | Leadership');
    expect((text.match(/\bLeadership\b/g) ?? [])).toHaveLength(1);
    expect((text.match(/\bCoaching\b/g) ?? [])).toHaveLength(2);
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('<w:numPr>');
  });

  test('Executive Premium DOCX embeds the selected original photo bytes', async () => {
    const selectedPhotoDataUrl = `data:image/jpeg;base64,${Buffer.from('selected-executive-photo-bytes').toString('base64')}`;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        fillRect: vi.fn(),
      })),
      configurable: true,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: vi.fn(() => selectedPhotoDataUrl),
      configurable: true,
    });
    const data = cv({
      personal: {
        photoEnabled: true,
        originalPhoto: `data:image/jpeg;base64,${Buffer.from('actual-user-photo-source').toString('base64')}`,
        rectangularPhoto: undefined,
        circularPhoto: 'data:image/png;base64,AQID',
        photo: undefined,
      },
    });
    const { mediaNames, mediaBytes } = await captureDocx(data);

    expect(mediaNames).toHaveLength(1);
    expect(Buffer.from(mediaBytes[0]).toString('utf8')).toBe('selected-executive-photo-bytes');
  });

  test('Executive Premium DOCX preserves Serbian characters and emits all source sections', async () => {
    const data = cv({
      personal: {
        fullName: 'Dragan Obradović',
        email: 'diodala12@gmail.com',
        phone: '865333680065',
        address: 'Braće Abafi 4',
        jobTitle: 'Učitelj u osnovnoj školi',
        photoEnabled: false,
        photo: undefined,
        originalPhoto: undefined,
        rectangularPhoto: undefined,
      },
      summary: '',
      experience: [
        {
          id: 'exp1',
          company: 'Zhff',
          position: 'Učitelj u osnovnoj školi',
          startDate: '2023-05',
          endDate: '',
          isPresent: true,
          description: [
            'Planirao sam i realizovao nastavne jedinice iz srpskog jezika i matematike u skladu sa važećim nastavnim planom i programom za razrednu nastavu.',
            'Primenio sam diferenciranu nastavu kako bi prilagodio nastavne sadržaje učenicima različitih nivoa znanja i stilova učenja.',
          ].join('\n'),
        },
      ],
      education: [{ id: 'edu1', school: 'Metematički fakultet', degree: 'VI', startDate: '2020-01', endDate: '2025-02', description: '' }],
      skills: ['Teamwork', 'Organization', 'Time Management', 'Creativity', 'Presentation Skills', 'Coaching', 'Coaching', 'Leadership'],
      languages: [],
    });
    const { documentXml } = await captureDocx(data);
    const text = visibleDocxText(documentXml);

    for (const value of ['DRAGAN OBRADOVIĆ', 'Učitelj u osnovnoj školi', 'Braće Abafi 4', 'važećim', 'sadržaje', 'učenicima', 'Metematički fakultet']) {
      expect(text).toContain(value);
    }
    expect(text).toContain('WORK EXPERIENCE');
    expect(text).toContain('EDUCATION');
    expect(text).toContain('SKILLS');
  });

  test('other template export routes remain present', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');

    expect(pageSource).toContain("liveCv.templateId === 'elegant-formal'");
    expect(pageSource).toContain("liveCv.templateId === 'ats-standard'");
    expect(source('src/lib/export.ts')).toContain("customLayout: 'elegant-formal'");
  });
});
