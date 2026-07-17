/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { ATSStandardTemplate, templateComponents } from '@/components/cv-templates';
import { createAtsStandardPdfTemplate } from '@/lib/ats-standard-pdf-template';
import {
  buildCvPdfBlob,
  resolveCvPdfExportRoute,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const canonicalPhoto = 'data:image/jpeg;base64,AQIDBAUGBwgJCg==';
const spacedPhrases = [
  'building high-performance teams',
  'exceeding quarterly targets',
  'through tighter forecasting',
  'Improved CRM pipeline hygiene',
  'quarterly planning discipline',
];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'ats-standard-test',
    name: '',
    personal: {
      fullName: 'Marcus Thorne',
      email: 'm.thorne@example.com',
      phone: '+1 212 333 0198',
      address: 'New York, NY',
      jobTitle: 'Sales Director',
      photo: canonicalPhoto,
      photoEnabled: true,
    },
    summary: 'Results-driven executive with 10 years driving revenue growth and building high-performance teams.',
    experience: [
      {
        id: 'exp1',
        company: 'Global Ventures',
        position: 'Sales Director',
        startDate: '2019-04',
        endDate: '',
        isPresent: true,
        description: '- Led a team of 20 sales reps, exceeding quarterly targets by 33% consistently.\n- Closed forecast variance through tighter forecasting.',
      },
      {
        id: 'exp2',
        company: 'Apex Solutions',
        position: 'Senior Manager',
        startDate: '2015-06',
        endDate: '2019-03',
        isPresent: false,
        description: '- Improved CRM pipeline hygiene and quarterly planning discipline.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Harvard Business School', degree: 'MBA', startDate: '2012-09', endDate: '2014-05', description: '' },
    ],
    skills: ['Strategic Planning', 'Leadership', 'Negotiation', 'CRM Forecasting'],
    certifications: ['Revenue Leadership Certificate'],
    languages: [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Intermediate' }],
    templateId: 'ats-standard',
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
  naturalWidth = 246;
  naturalHeight = 327;
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
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,ats-standard'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const clonedTextContents: string[] = [];
  const html2canvasMock = vi.fn(async (_target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    if (options?.onclone) {
      const clonedDocument = document.implementation.createHTMLDocument('clone');
      clonedDocument.body.innerHTML = document.body.innerHTML;
      options.onclone(clonedDocument);
      clonedTextContents.push(clonedDocument.body.textContent ?? '');
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
        return new Blob(['%PDF-1.7\nats-standard\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances, clonedTextContents };
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
      getTextWidth = vi.fn((_text: string) => 20);
      output() {
        return new Blob(['%PDF-1.7\nats-standard-direct\n%%EOF'], { type: 'application/pdf' });
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

describe('ATS Standard PDF export', () => {
  test('ats-standard resolves to the ATS Standard React component with a stable marker', () => {
    const html = renderToStaticMarkup(<ATSStandardTemplate data={cv()} locale="en" />);

    expect(templateComponents['ats-standard']).toBe(ATSStandardTemplate);
    expect(html).toContain('data-template-id="ats-standard"');
  });

  test('dedicated PDF renderer uses a white ATS root and stable template marker', () => {
    const root = createAtsStandardPdfTemplate(cv(), { locale: 'en' });
    const header = root.querySelector('[data-ats-standard-pdf-header]') as HTMLElement;

    expect(root.dataset.templateId).toBe('ats-standard');
    expect(root.style.width).toBe('210mm');
    expect(root.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(header.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(header.textContent).toContain('Marcus Thorne');
    expect(header.textContent).not.toContain('MARCUS THORNE');
  });

  test('ATS Standard PDF never renders an image even when the CV contains photo fields', () => {
    const root = createAtsStandardPdfTemplate(cv({
      personal: {
        photo: canonicalPhoto,
        originalPhoto: canonicalPhoto,
        rectangularPhoto: canonicalPhoto,
        circularPhoto: canonicalPhoto,
        photoEnabled: true,
      } as Partial<CVData['personal']>,
    }), { locale: 'en' });

    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-export-photo="ats-standard"]')).toBeNull();
    expect(root.querySelector('[data-ats-standard-photo]')).toBeNull();
  });

  test('no-photo version is valid and does not create a broken image', () => {
    const root = createAtsStandardPdfTemplate(cv({ personal: { photoEnabled: false } }), { locale: 'en' });

    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Marcus Thorne');
    expect(root.textContent).toContain('Strategic Planning');
  });

  test('candidate header is compact and centered', () => {
    const root = createAtsStandardPdfTemplate(cv(), { locale: 'en' });
    const header = root.querySelector('[data-ats-standard-pdf-header]') as HTMLElement;
    const name = header.querySelector('h1') as HTMLElement;

    expect(header.style.textAlign).toBe('center');
    expect(header.style.padding).toBe('28px 48px 14px');
    expect(name.style.fontSize).toBe('21px');
    expect(name.style.letterSpacing).toBe('normal');
    expect(name.style.textTransform).toBe('none');
  });

  test('section headings are left-aligned with thin light-gray rules', () => {
    const root = createAtsStandardPdfTemplate(cv(), { locale: 'en' });
    const heading = root.querySelector('main h2') as HTMLElement;

    expect(heading.textContent).toBe('PROFESSIONAL SUMMARY');
    expect(heading.style.textAlign).toBe('left');
    expect(heading.style.borderBottom).toBe('1px solid rgb(209, 213, 219)');
    expect(heading.style.letterSpacing).toBe('0.02em');
  });

  test('bullets remain separate rows and multi-word skills stay intact', () => {
    const root = createAtsStandardPdfTemplate(cv(), { locale: 'en' });

    expect(root.querySelectorAll('[data-export-bullet-row="ats-standard"]')).toHaveLength(3);
    expect(root.textContent).toContain('Strategic Planning');
    expect(root.textContent).not.toContain('StrategicPlanning');
  });

  test('fixture and dedicated PDF template DOM preserve ATS body word spaces', () => {
    const fixture = cv();
    const rawFixtureText = [
      fixture.summary,
      ...fixture.experience.map(exp => exp.description),
    ].join('\n');
    const root = createAtsStandardPdfTemplate(fixture, { locale: 'en' });
    const bodyText = root.textContent ?? '';
    const bodyParagraph = Array.from(root.querySelectorAll<HTMLElement>('p, li span:last-child'))
      .find(element => element.textContent?.includes('building high-performance teams')) as HTMLElement;
    const heading = root.querySelector('main h2') as HTMLElement;

    spacedPhrases.forEach((phrase) => {
      expect(rawFixtureText).toContain(phrase);
      expect(bodyText).toContain(phrase);
      expect(bodyText).not.toContain(phrase.replaceAll(' ', ''));
    });
    expect(bodyParagraph.style.wordSpacing).toBe('normal');
    expect(bodyParagraph.style.letterSpacing).toBe('normal');
    expect(heading.style.letterSpacing).toBe('0.02em');
  });

  test('direct PDF renderer preserves ATS body word spaces in drawn text', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const fixture = cv();

    await mod.buildAtsStandardPdfBlob(fixture, 'en');
    const drawn = instances[0]?.drawnText.join(' ') ?? '';

    spacedPhrases.forEach((phrase) => {
      expect(drawn).toContain(phrase);
      expect(drawn).not.toContain(phrase.replaceAll(' ', ''));
    });
  });

  test('ats-standard resolves to the dedicated-ats-standard export route', () => {
    expect(resolveCvPdfExportRoute('ats-standard').kind).toBe('dedicated-ats-standard');
  });

  test('ATS Standard dedicated PDF uses direct jsPDF renderer, not canvas slicing', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('buildAtsStandardPagedPdfBlob');
    expect(exportSource).toContain("kind: 'dedicated-ats-standard'");
    const fnStart = exportSource.indexOf('export async function buildAtsStandardPagedPdfBlob');
    const fnEnd = exportSource.indexOf('export async function buildAtsStandardPdfBlob', fnStart);
    const fn = exportSource.slice(fnStart, fnEnd);
    expect(fn).not.toContain('renderPdfSlice');
    expect(fn).not.toContain('renderPaddedPdfSlice');
    expect(fn).not.toContain('html2canvas');
    expect(fn).not.toContain('buildCvPdfBlob');
  });

  test('ATS Standard source keeps WORK EXPERIENCE heading with first entry lead block', () => {
    const exportSource = source('src/lib/export.ts');
    const fn = exportSource.indexOf('function atsDrawExperience(');
    const body = exportSource.slice(fn, fn + 600);
    expect(body).toContain('atsMoveToFreshPageIfNeeded');
    expect(body).toContain('atsExperienceLeadBlockHeight');
  });

  test('ATS Standard source groups Education + lower sections before drawing', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('atsMoveLowerSectionsIfNeeded');
    expect(exportSource).toContain('atsLowerSectionsHeight');
    expect(exportSource).toContain('atsEducationHeight');
  });

  test('ATS Standard long direct PDF export paginates without half-line splits', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const longCv = (): CVData => ({
      ...cv(),
      summary: Array.from({ length: 40 }, (_, i) =>
        `Sentence ${i + 1}: results-driven revenue growth across global markets.`,
      ).join(' '),
      experience: [
        {
          id: 'exp-1',
          company: 'Global Ventures',
          position: 'Sales Director',
          startDate: '2019-04',
          endDate: '',
          isPresent: true,
          description: Array.from({ length: 18 }, (_, i) =>
            `- Achievement ${i + 1}: delivered measurable impact across sales, pipeline, and forecasting work.`,
          ).join('\n'),
        },
        {
          id: 'exp-2',
          company: 'Apex Solutions',
          position: 'Software Tester',
          startDate: '2015-06',
          endDate: '2019-03',
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
      education: [{ id: 'edu-1', school: 'Harvard Business School', degree: 'MBA', startDate: '2012-09', endDate: '2014-05', description: '' }],
      skills: ['Strategic Planning', 'Leadership', 'Negotiation', 'CRM Forecasting', 'Cloud Services (AWS/Azure/GCP)'],
      languages: [{ name: 'English', level: 'Native' }, { name: 'French', level: 'Intermediate' }],
    });

    const blob = await mod.buildAtsStandardPagedPdfBlob(longCv(), 'en');
    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0]?.pages).toBeGreaterThanOrEqual(2);
    expect(instances[0]?.pages).toBeLessThanOrEqual(3);
  });

  test('production handler routes ats-standard to dedicated PDF export and disables print fallback', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const atsBranch = pageSource.indexOf("liveCv.templateId === 'ats-standard'");
    const fallback = pageSource.indexOf('await openPrintFallback', atsBranch);
    const guard = pageSource.indexOf("cv.templateId === 'clean-simple'", atsBranch);

    expect(atsBranch).toBeGreaterThan(-1);
    expect(pageSource.slice(atsBranch, atsBranch + 500)).toContain('exportAtsStandardPdf');
    expect(pageSource.slice(atsBranch, atsBranch + 500)).toContain('showCvExportSuccessToast');
    expect(pageSource.slice(atsBranch, atsBranch + 500)).not.toContain('prepareElegantFormalCanonicalPhoto');
    expect(pageSource).not.toContain('prepareAtsStandardPdfPhotoDataUrl');
    expect(guard).toBeGreaterThan(atsBranch);
    expect(fallback).toBeGreaterThan(guard);
    expect(pageSource.slice(guard, fallback)).toContain("cv.templateId === 'ats-standard'");
    expect(pageSource.slice(guard, fallback)).toContain('t.cv.pdfExportFailed');
    expect(pageSource.slice(guard, fallback)).toContain('return;');
  });

  test('ATS Standard PDF route never invokes photo preparation or photo sources', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const atsBranch = pageSource.indexOf("liveCv.templateId === 'ats-standard'");
    const branchEnd = pageSource.indexOf('//', atsBranch);
    const branch = pageSource.slice(atsBranch, branchEnd);
    const exportSource = source('src/lib/export.ts');
    const buildStart = exportSource.indexOf('export async function buildAtsStandardPdfBlob');
    const buildEnd = exportSource.indexOf('export async function exportAtsStandardPdf', buildStart);
    const buildBlock = exportSource.slice(buildStart, buildEnd);

    expect(branch).not.toContain('prepareElegantFormalCanonicalPhoto');
    expect(branch).not.toContain('photoDataUrl');
    expect(branch).not.toContain('originalPhoto');
    expect(branch).not.toContain('rectangularPhoto');
    expect(branch).not.toContain('circularPhoto');
    expect(buildBlock).toContain('buildAtsStandardPagedPdfBlob');
    expect(buildBlock).not.toContain('photoDataUrl');
    expect(buildBlock).not.toContain('html2canvas');
    expect(buildBlock).not.toContain('buildCvPdfBlob');
  });

  test('ATS Standard PDF Blob is non-empty and short fixture remains one page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildAtsStandardPdfBlob(cv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
    expect(instances[0].addPage).not.toHaveBeenCalled();
    const drawn = instances[0].drawnText.join(' ');
    expect(drawn).toContain('Marcus Thorne');
    expect(drawn).toContain('Strategic Planning');
  });

  test('blank trailing canvas content is removed before pagination', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="ats-standard" style="width:800px;height:2300px"><div data-export-meaningful="true" style="height:900px">ATS Standard</div></div></div>';
    const canvas = makeCanvas(800, 2300, y => y < 900);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(1);
  });

  test('long fixture uses only meaningful pages', async () => {
    document.body.innerHTML = '<div id="cv-preview"><div data-template-id="ats-standard" style="width:800px;height:2500px"><div data-export-meaningful="true" style="height:2500px">ATS Standard long</div></div></div>';
    const canvas = makeCanvas(800, 2500, () => true);
    const { instances } = installPdfMocks(canvas);

    await buildCvPdfBlob('cv-preview');

    expect(instances).toHaveLength(1);
    expect(instances[0].pages).toBe(3);
    expect(instances[0].addImage).toHaveBeenCalledTimes(3);
  });

  test('legacy generic preview slicing helpers remain for other templates only', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('ATS_STANDARD_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(exportSource).toContain('buildPaddedPdfSlice');
    expect(exportSource).toContain("captureTemplateId === 'ats-standard'");
    const fnStart = exportSource.indexOf('export async function buildAtsStandardPagedPdfBlob');
    const fnEnd = exportSource.indexOf('export async function buildAtsStandardPdfBlob', fnStart);
    const fn = exportSource.slice(fnStart, fnEnd);
    expect(fn).not.toContain('renderPaddedPdfSlice');
  });

  test('DOCX export code is not part of the ATS Standard PDF route', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const atsBranch = pageSource.indexOf("liveCv.templateId === 'ats-standard'");
    const branch = pageSource.slice(atsBranch, atsBranch + 600);

    expect(branch).not.toContain('exportToDOCX');
    expect(source('src/lib/export.ts')).toContain("customLayout: 'modern-minimal'");
  });
});
