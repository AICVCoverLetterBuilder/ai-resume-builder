/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { createRirekishoPdfTemplate } from '@/lib/rirekisho-pdf-template';
import { rkNormalizePdfText } from '@/lib/rirekisho-pdf-renderer';
import {
  applyRirekishoKeepTogetherPagination,
  applyRirekishoSelfPrPageBalance,
  buildPaddedPdfSlice,
  buildRirekishoPagedPdfBlob,
  buildRirekishoPdfBlob,
  exportRirekishoToDOCX,
  extractRirekishoInkLineIntervalsFromCanvas,
  findSafeElegantFormalPageBreakCanvasPx,
  getRirekishoPdfContentBoundsCss,
  isUnsafeElegantFormalPageBreakCanvasPx,
  planRirekishoPdfSliceSegments,
  rebalanceRirekishoSparseTrailingPdfSliceSegments,
  resolveCvPdfExportRoute,
  resolveRirekishoSafePageBreakCanvasPx,
  scaleRirekishoContentBoundsToCanvas,
  selectRirekishoPdfLineIntervalsCanvas,
} from '@/lib/export';
import type { CVData } from '@/lib/types';

const originalPhoto = `data:image/jpeg;base64,${Buffer.from('rirekisho-original-photo').toString('base64')}`;
const selectedPhoto = `data:image/jpeg;base64,${Buffer.from('rirekisho-selected-photo').toString('base64')}`;
const croppedPhoto = `data:image/jpeg;base64,${Buffer.from('rirekisho-cropped-photo').toString('base64')}`;
let loadedImageSources: string[] = [];
let drawImageCalls: unknown[][] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'rirekisho-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'diodala12@gmail.com',
      phone: '865333680065',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      dateOfBirth: '1988-02-15',
      gender: '男',
      photo: selectedPhoto,
      originalPhoto,
      photoEnabled: true,
    },
    summary: 'Iskusan učitelj sa oko devet godina rada u obrazovanju. Posebnu vrednost donosi kroz koučing i liderske kompetencije.',
    experience: [
      {
        id: 'exp-1',
        company: 'Zhff',
        position: 'Učitelj u osnovnoj školi',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: '- Planirao sam nastavne jedinice.\n- Primenio sam diferenciranu nastavu.',
      },
      {
        id: 'exp-2',
        company: 'Hfh',
        position: 'Nastavnik geografije',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: '- Koristio sam geografske karte.\n- Učestvovao sam u roditeljskim sastancima.',
      },
    ],
    education: [
      { id: 'edu-1', school: 'Metematički fakultet', degree: 'VI', startDate: '2020-01', endDate: '2025-02', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Coaching', 'Coaching', 'Leadership'],
    certifications: [],
    languages: [{ name: 'Serbian', level: 'Native' }],
    templateId: 'rirekisho',
    region: 'Japan',
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
  naturalHeight = 900;
  width = 600;
  height = 900;
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

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  Object.defineProperty(canvas, 'getContext', {
    value: vi.fn(() => ({
      drawImage: vi.fn((...args: unknown[]) => drawImageCalls.push(args)),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4);
        data.fill(255);
        data[0] = 10;
        data[1] = 10;
        data[2] = 10;
        data[3] = 255;
        return { data };
      }),
    })),
    configurable: true,
  });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => croppedPhoto), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const html2canvasMock = vi.fn(async (target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    if (options?.onclone) {
      const clonedDocument = document.implementation.createHTMLDocument('clone');
      clonedDocument.body.innerHTML = document.body.innerHTML;
      options.onclone(clonedDocument);
    }
    expect(target.matches('[data-template-id="rirekisho"]') || Boolean(target.querySelector('[data-template-id="rirekisho"]'))).toBe(true);
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
        return new Blob(['%PDF-1.7\nrirekisho\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances };
}

type DirectPdfInstance = {
  pages: number;
  drawnText: string[];
  addImage: ReturnType<typeof vi.fn>;
  addPage: ReturnType<typeof vi.fn>;
  rect: ReturnType<typeof vi.fn>;
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
      addFileToVFS = vi.fn();
      addFont = vi.fn();
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
        return new Blob(['%PDF-1.7\nrirekisho-direct\n%%EOF'], { type: 'application/pdf' });
      }
      constructor() { instances.push(this as unknown as DirectPdfInstance); }
    },
  }));
  return { instances };
}

function longStressCv(): CVData {
  return {
    ...cv(),
    summary: [
      'Software engineer with strong delivery experience across distributed systems and quality-focused product teams.',
      'Built reliable regression packs and CI gates that reduced release risk.lead.Assisted junior engineers during onboarding.',
      'Applied automation across staging environments.Software engineer focused on measurable quality outcomes.',
      ...Array.from({ length: 28 }, (_, i) =>
        `Sentence ${i + 1}: reliable teaching delivery across classrooms, coaching, and leadership development.`,
      ),
    ].join(' ').replace('development. Sentence 2', 'development.Sentence 2'),
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
          '- Drove post-release verification checklists used by multiple product teams after weekend deployments.',
          '- Reduced duplicate defect noise by refining severity criteria and triage rituals across the QA board.',
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
          '- Managed vendor relationships and production timelines for multiple concurrent projects.',
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
  };
}

async function captureDocx(data: CVData): Promise<{ documentXml: string; text: string; files: string[] }> {
  const blobByUrl = new Map<string, Blob>();
  let capturedBlob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:http://rirekisho/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });

  await exportRirekishoToDOCX(data, 'rirekisho-docx-test');
  expect(capturedBlob).not.toBeNull();
  const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer());
  const files = Object.keys(zip.files);
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const text = documentXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return { documentXml, text, files };
}

function source(file: string): string {
  return fs.readFileSync(path.resolve(file), 'utf8');
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

beforeEach(() => {
  vi.restoreAllMocks();
  loadedImageSources = [];
  drawImageCalls = [];
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn((...args: unknown[]) => drawImageCalls.push(args)),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => croppedPhoto),
    configurable: true,
  });
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

describe('Rirekisho export', () => {
  test('dedicated PDF renderer has fixed root, stable marker, constrained photo, and readable sections', () => {
    const root = createRirekishoPdfTemplate(cv(), { locale: 'en', photoDataUrl: croppedPhoto });
    const photoBox = root.querySelector('[data-rirekisho-photo-box]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="rirekisho"]') as HTMLImageElement;
    const rootText = (root.textContent ?? '').replace(/\u00a0/g, ' ');
    const skills = Array.from(root.querySelectorAll('[data-rirekisho-skill]')).map(el => (el.textContent ?? '').replace(/\u00a0/g, ' '));
    const bullets = root.querySelectorAll('[data-rirekisho-bullet-row]');

    expect(root.dataset.templateId).toBe('rirekisho');
    expect(root.style.width).toBe('210mm');
    expect(root.style.minWidth).toBe('210mm');
    expect(rootText).toContain('履　歴　書');
    expect(rootText).toContain('氏名 / Full Name');
    expect(rootText).toContain('学　歴');
    expect(rootText).toContain('職　歴');
    expect(rootText).toContain('スキル');
    expect(rootText).toContain('自己PR');
    expect(root.querySelector('[data-rirekisho-summary-row="true"]')).not.toBeNull();
    expect(root.querySelector('[data-rirekisho-section-kind="self-pr"]')).not.toBeNull();
    expect(rootText).toContain('Dragan Obradović');
    expect(photoBox.style.width).toBe('90px');
    expect(photoBox.style.height).toBe('120px');
    expect(photoBox.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(skills).toEqual(['Teamwork', 'Organization', 'Coaching', 'Coaching', 'Leadership']);
    expect(bullets).toHaveLength(4);
  });

  test('section bar headings use a fixed-height flex bar with inner label wrapper for Android CJK rendering', () => {
    const root = createRirekishoPdfTemplate(cv(), { locale: 'en', photoDataUrl: croppedPhoto });
    const headings = Array.from(root.querySelectorAll<HTMLElement>('section[data-export-group="rirekisho-section"] > h2'));

    expect(headings.length).toBeGreaterThanOrEqual(5);
    for (const heading of headings) {
      expect(heading.style.display).toBe('flex');
      expect(heading.style.alignItems).toBe('center');
      expect(heading.style.height).toBe('28px');
      expect(heading.style.minHeight).toBe('28px');
      expect(heading.style.overflow).toBe('visible');
      const label = heading.querySelector('[data-rirekisho-section-bar-label="true"]') as HTMLElement | null;
      expect(label).not.toBeNull();
      expect(label!.style.display).toBe('inline-flex');
      expect(label!.style.alignItems).toBe('center');
      expect(label!.style.lineHeight).toBe('1');
      expect(label!.style.transform).toBe('translateY(-1px)');
    }
    expect(headings.map(h => (h.textContent ?? '').replace(/\u00a0/g, ' '))).toEqual(
      expect.arrayContaining(['学　歴', '職　歴', 'スキル', '自己PR']),
    );
  });

  test('production PDF route uses latest cvRef, direct export, and disables print fallback', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const handler = pageSource.slice(pageSource.indexOf('const handlePDFDownload'));
    const branch = handler.indexOf("liveCv.templateId === 'rirekisho'");
    const exportCall = handler.indexOf('exportRirekishoPdf', branch);
    const genericExport = handler.indexOf('exportToPDF', branch);
    const fallbackGuard = handler.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = handler.indexOf('await openPrintFallback', fallbackGuard);

    expect(branch).toBeGreaterThan(-1);
    expect(exportCall).toBeGreaterThan(branch);
    expect(exportCall).toBeLessThan(genericExport);
    expect(handler.slice(branch, branch + 420)).toContain('cvRef.current');
    expect(handler.slice(fallbackGuard, fallback)).toContain("cv.templateId === 'rirekisho'");
    expect(handler.slice(branch, exportCall)).not.toContain('querySelector');
  });

  test('rirekisho resolves to the dedicated-rirekisho export route', () => {
    expect(resolveCvPdfExportRoute('rirekisho').kind).toBe('dedicated-rirekisho');
  });

  test('Rirekisho dedicated PDF uses hybrid content-flow direct jsPDF renderer, not canvas slicing', () => {
    const exportSource = source('src/lib/export.ts');
    const rendererSource = source('src/lib/rirekisho-pdf-renderer.ts');
    expect(exportSource).toContain('buildRirekishoPagedPdfBlob');
    expect(exportSource).toContain("kind: 'dedicated-rirekisho'");
    expect(rendererSource).toContain('rkCreateContext');
    expect(rendererSource).toContain('rkDrawSectionBar');
    expect(rendererSource).toContain('rkDrawWorkLeadBlock');
    expect(rendererSource).toContain('rkDrawWorkBulletFlow');
    expect(rendererSource).toContain('rkDrawAtomicWrappedBullet');
    expect(rendererSource).toContain('rkNormalizePdfText');
    expect(rendererSource).toContain('rkRebalanceSparseFinalSelfPrPage');
    expect(rendererSource).toContain('rkDrawSelfPrSection');
    expect(rendererSource).toContain('rkDrawSelfPrContinuation');
    expect(rendererSource).toContain('rkDrawSkillsLanguagesGroup');
    expect(rendererSource).not.toContain('html2canvas');
    expect(rendererSource).not.toContain('buildCvPdfBlob');
    expect(rendererSource).not.toContain('renderPdfSlice');
    expect(rendererSource).not.toContain('renderPaddedPdfSlice');
    expect(exportSource).not.toMatch(/buildRirekishoPdfBlob[\s\S]{0,400}buildCvPdfBlob/);
  });

  test('rkNormalizePdfText fixes glued sentence boundaries for PDF rendering only', () => {
    expect(rkNormalizePdfText('matter.Software engineer with QA experience.')).toBe(
      'matter. Software engineer with QA experience.',
    );
    expect(rkNormalizePdfText('lead.Assisted students during lessons.')).toBe(
      'lead. Assisted students during lessons.',
    );
    expect(rkNormalizePdfText('logic.Built automated smoke suites.')).toBe(
      'logic. Built automated smoke suites.',
    );
    expect(rkNormalizePdfText('applied.Designed regression packs.')).toBe(
      'applied. Designed regression packs.',
    );
    expect(rkNormalizePdfText('environments.Software engineer with expertise.')).toBe(
      'environments. Software engineer with expertise.',
    );
    expect(rkNormalizePdfText('scaffolds.logic.Built smoke suites.')).toBe(
      'scaffolds. logic. Built smoke suites.',
    );
    expect(rkNormalizePdfText('risk.lead.Assisted junior engineers.')).toBe(
      'risk. lead. Assisted junior engineers.',
    );
    expect(rkNormalizePdfText('Already fine. Next sentence.')).toBe('Already fine. Next sentence.');
    expect(rkNormalizePdfText('Used Node.js and REST APIs with CI/CD pipelines.')).toBe(
      'Used Node.js and REST APIs with CI/CD pipelines.',
    );
  });

  test('rkRebalanceSparseFinalSelfPrPage avoids tiny final Self PR tails', async () => {
    const { rkRebalanceSparseFinalSelfPrPage } = await import('@/lib/rirekisho-pdf-renderer');
    const rebalanced = rkRebalanceSparseFinalSelfPrPage([
      Array.from({ length: 20 }, (_, i) => `L${i}`),
      ['A', 'B'],
    ]);
    expect(rebalanced[rebalanced.length - 1]!.length).toBeGreaterThanOrEqual(6);
  });

  test('PDF Blob is non-empty, one page, and originalPhoto is used before selected photo', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildRirekishoPdfBlob(cv(), 'en');

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0]!.pages).toBe(1);
    expect(instances[0]!.addPage).not.toHaveBeenCalled();
    expect(loadedImageSources).toContain(originalPhoto);
    expect(loadedImageSources).not.toContain(selectedPhoto);
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(scaledWidth / scaledHeight).toBeCloseTo(600 / 900, 3);
    expect(dx).toBe(0);
    expect(dy).toBeLessThan(0);
    const drawn = instances[0]!.drawnText.join(' ');
    expect(drawn).toContain('Dragan Obradović');
    expect(drawn).toContain('Metematički fakultet');
    expect(drawn).toContain('自己PR');
  });

  test('Rirekisho long direct PDF export paginates with continuation headers and full content', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildRirekishoPagedPdfBlob(longStressCv(), 'en', { photoDataUrl: croppedPhoto });
    expect(blob.size).toBeGreaterThan(0);
    expect(instances[0]?.pages).toBeGreaterThanOrEqual(2);
    expect(instances[0]?.pages).toBeLessThanOrEqual(4);

    const drawn = instances[0]?.drawnText ?? [];
    const text = drawn.join(' ');
    const count = (needle: string) => {
      let total = 0;
      let pos = 0;
      while (true) {
        const idx = text.indexOf(needle, pos);
        if (idx === -1) break;
        total += 1;
        pos = idx + needle.length;
      }
      return total;
    };

    expect(count('Sentence 1:')).toBe(1);
    expect(text).not.toContain('development.Sentence 2');
    expect(text).toContain('development. Sentence 2');
    expect(text).not.toContain('logic.Built');
    expect(text).toContain('logic. Built');
    expect(text).not.toContain('applied.Designed');
    expect(text).toContain('applied. Designed');
    expect(text).not.toContain('environments.Software');
    expect(text).toContain('environments. Software');
    expect(text).not.toContain('risk.lead.Assisted');
    expect(text).toContain('Designed visual identities for 50+ brands');
    expect(text).toContain('reporting findings to the development team.');
    expect(text).toContain('Mathematic school');
    expect(text).toContain('React');
    expect(text).toContain('English');
    expect(text).toContain('職　歴');
    expect(text).toContain('自己PR');
    if (text.includes('自己PR 続き') || text.includes('(continued)') || text.includes('職歴 続き')) {
      expect(instances[0]?.pages ?? 0).toBeGreaterThanOrEqual(2);
    }
    expect(instances[0]?.pages ?? 0).toBeLessThan(5);
    expect(instances[0]?.rect).toHaveBeenCalled();
  });

  test('legacy Rirekisho padded slice helpers remain available for generic preview path', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('applyRirekishoKeepTogetherPagination');
    expect(exportSource).toContain('RIREKISHO_PDF_PAGE_TOP_INSET_CSS_PX');
    expect(exportSource).toContain('rebalanceRirekishoSparseTrailingPdfSliceSegments');
    expect(exportSource).toContain('applyRirekishoSelfPrPageBalance');
    expect(exportSource).toContain('planRirekishoPdfSliceSegments');
    expect(exportSource).toContain('renderPaddedPdfSlice');
    expect(exportSource).toContain("captureTemplateId === 'rirekisho'");
  });

  test('Rirekisho keep-together shifts 職歴 heading with first table row when heading would orphan', () => {
    document.body.innerHTML = `
      <div data-template-id="rirekisho" data-test-rect="${rectAttr(0, 0, 794, 3200)}">
        <section data-export-group="rirekisho-section" data-test-rect="${rectAttr(1080, 34, 726, 180)}">
          <h2 data-test-rect="${rectAttr(1100, 34, 726, 22)}">職　歴</h2>
          <table data-test-rect="${rectAttr(1130, 34, 726, 120)}">
            <tr data-export-meaningful="true" data-test-rect="${rectAttr(1130, 34, 726, 28)}">
              <td>2023-05〜現在</td>
              <td>Učitelj u osnovnoj školi</td>
            </tr>
            <tr data-rirekisho-bullet-row="true" data-test-rect="${rectAttr(1160, 34, 726, 24)}">
              <td></td>
              <td>Planirao sam nastavne jedinice.</td>
            </tr>
          </table>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="rirekisho"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyRirekishoKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('職');
    expect(document.body.textContent).toContain('Planirao sam nastavne jedinice');
  });

  test('Rirekisho keep-together shifts straddling work-history bullet rows to the next page', () => {
    document.body.innerHTML = `
      <div data-template-id="rirekisho" data-test-rect="${rectAttr(0, 0, 794, 3200)}">
        <table>
          <tr data-rirekisho-bullet-row="true" data-test-rect="${rectAttr(1100, 34, 726, 48)}">
            <td></td>
            <td>Koristio sam geografske karte i digitalne alate za nastavu.</td>
          </tr>
        </table>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="rirekisho"]') as HTMLElement;
    const bullet = root.querySelector('[data-rirekisho-bullet-row="true"]') as HTMLElement;

    applyRirekishoKeepTogetherPagination(root);

    expect(Number.parseFloat(bullet.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Koristio sam geografske karte');
  });

  test('Rirekisho keep-together keeps 自己PR on the current page when only the heading plus two lines are required', () => {
    document.body.innerHTML = `
      <div data-template-id="rirekisho" data-test-rect="${rectAttr(0, 0, 794, 3200)}">
        <section data-export-group="rirekisho-section" data-rirekisho-section-kind="languages" data-test-rect="${rectAttr(980, 34, 726, 40)}">
          <h2 data-test-rect="${rectAttr(980, 34, 726, 22)}">語学</h2>
          <table>
            <tr data-export-meaningful="true" data-test-rect="${rectAttr(1006, 34, 726, 18)}">
              <td>Serbian</td><td>Native</td>
            </tr>
          </table>
        </section>
        <section data-export-group="rirekisho-section" data-rirekisho-section-kind="self-pr" data-test-rect="${rectAttr(1028, 34, 726, 220)}">
          <h2 data-test-rect="${rectAttr(1028, 34, 726, 22)}">自己PR</h2>
          <table>
            <tr data-export-meaningful="true" data-rirekisho-summary-row="true" data-test-rect="${rectAttr(1054, 34, 726, 180)}">
              <td>Iskusan učitelj sa oko devet godina rada u obrazovanju. Posebnu vrednost donosi kroz koučing i liderske kompetencije.</td>
            </tr>
          </table>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="rirekisho"]') as HTMLElement;
    const heading = root.querySelector('[data-rirekisho-section-kind="self-pr"] h2') as HTMLElement;

    applyRirekishoKeepTogetherPagination(root);

    expect(heading.style.marginTop).toBe('');
    expect(document.body.textContent).toContain('自己PR');
    expect(document.body.textContent).toContain('Iskusan učitelj');
  });

  test('Rirekisho self-pr page balance pulls an over-shifted 自己PR heading back when the previous page has room', () => {
    document.body.innerHTML = `
      <div data-template-id="rirekisho" data-test-rect="${rectAttr(0, 0, 794, 3200)}">
        <section data-export-group="rirekisho-section" data-rirekisho-section-kind="languages" data-test-rect="${rectAttr(980, 34, 726, 40)}">
          <h2 data-test-rect="${rectAttr(980, 34, 726, 22)}">語学</h2>
          <table>
            <tr data-export-meaningful="true" data-test-rect="${rectAttr(1006, 34, 726, 18)}">
              <td>Serbian</td><td>Native</td>
            </tr>
          </table>
        </section>
        <section data-export-group="rirekisho-section" data-rirekisho-section-kind="self-pr" data-test-rect="${rectAttr(1140, 34, 726, 220)}">
          <h2 style="margin-top: 112px" data-test-rect="${rectAttr(1252, 34, 726, 22)}">自己PR</h2>
          <table>
            <tr data-export-meaningful="true" data-rirekisho-summary-row="true" data-test-rect="${rectAttr(1278, 34, 726, 180)}">
              <td>Iskusan učitelj sa oko devet godina rada u obrazovanju. Posebnu vrednost donosi kroz koučing i liderske kompetencije.</td>
            </tr>
          </table>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="rirekisho"]') as HTMLElement;
    const heading = root.querySelector('[data-rirekisho-section-kind="self-pr"] h2') as HTMLElement;

    applyRirekishoSelfPrPageBalance(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeLessThan(112);
    expect(document.body.textContent).toContain('自己PR');
  });

  test('Rirekisho keep-together does not shift a section that already fits on one page', () => {
    document.body.innerHTML = `
      <div data-template-id="rirekisho" data-test-rect="${rectAttr(0, 0, 794, 3200)}">
        <section data-export-group="rirekisho-section" data-test-rect="${rectAttr(820, 34, 726, 120)}">
          <h2 data-test-rect="${rectAttr(820, 34, 726, 22)}">自己PR</h2>
          <table data-test-rect="${rectAttr(850, 34, 726, 80)}">
            <tr data-export-meaningful="true" data-test-rect="${rectAttr(850, 34, 726, 80)}">
              <td>Iskusan učitelj sa oko devet godina rada u obrazovanju.</td>
            </tr>
          </table>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="rirekisho"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyRirekishoKeepTogetherPagination(root);

    expect(heading.style.marginTop).toBe('');
  });

  test('Rirekisho PDF export bakes continuation-page top padding and avoids slicing through text lines', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('collectElegantFormalTextLineIntervalsCss(sourceRootForTag)');
    expect(exportSource).toContain('getRirekishoPdfContentBoundsCss');
    expect(exportSource).toContain('extractRirekishoInkLineIntervalsFromCanvas');
    expect(exportSource).toContain('selectRirekishoPdfLineIntervalsCanvas');
    expect(exportSource).toContain('resolveRirekishoSafePageBreakCanvasPx');

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

    const explicitBounds = getRirekishoPdfContentBoundsCss(
      createRirekishoPdfTemplate(cv(), { locale: 'en', photoDataUrl: croppedPhoto }),
    );
    const canvasBounds = scaleRirekishoContentBoundsToCanvas(explicitBounds, 800, 794);
    expect(canvasBounds.contentLeftPx).toBeGreaterThan(0);
    expect(canvasBounds.contentRightPx).toBeGreaterThan(canvasBounds.contentLeftPx);

    const intervals = [
      { top: 1080, bottom: 1102 },
      { top: 1106, bottom: 1128 },
    ];
    expect(isUnsafeElegantFormalPageBreakCanvasPx(1095, intervals, 16)).toBe(true);
    expect(findSafeElegantFormalPageBreakCanvasPx(intervals, 1131, 16, 48)).toBeLessThan(1131);

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1400;
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn((_x: number, y: number, w: number, h: number) => {
        const data = new Uint8ClampedArray(w * h * 4);
        data.fill(255);
        for (let row = 0; row < h; row += 1) {
          const absoluteY = y + row;
          const isInkRow = absoluteY >= 1080 && absoluteY < 1098
            || absoluteY >= 1104 && absoluteY < 1122
            || absoluteY >= 1128 && absoluteY < 1146;
          if (!isInkRow) continue;
          for (let x = 0; x < w; x += 1) {
            const index = (row * w + x) * 4;
            data[index] = 17;
            data[index + 1] = 24;
            data[index + 2] = 39;
            data[index + 3] = 255;
          }
        }
        return { data };
      }),
    };
    Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });

    const resolution = resolveRirekishoSafePageBreakCanvasPx(
      canvas,
      [{ top: 1080, bottom: 1146 }],
      false,
      1131,
      16,
      48,
      96,
      0,
      canvasBounds.contentLeftPx,
      canvasBounds.contentRightPx,
    );

    expect(resolution.source).toBe('canvas');
    expect(resolution.breakPx).toBeLessThan(1131);
    expect(resolution.breakPx).toBeGreaterThan(1102);

    const inkIntervals = extractRirekishoInkLineIntervalsFromCanvas(
      canvas,
      canvasBounds.contentLeftPx,
      canvasBounds.contentRightPx,
    );
    expect(inkIntervals.length).toBeGreaterThan(0);
    const intervalSelection = selectRirekishoPdfLineIntervalsCanvas(
      [{ top: 1080, bottom: 1146 }],
      false,
      inkIntervals,
    );
    expect(intervalSelection.source).toBe('canvas');
    expect(intervalSelection.reliable).toBe(true);
    expect(intervalSelection.intervals?.length).toBeGreaterThan(0);

    const segments = planRirekishoPdfSliceSegments(
      1400,
      1123,
      0,
      canvas,
      intervalSelection.intervals,
      intervalSelection.reliable,
      16,
      48,
      96,
      canvasBounds.contentLeftPx,
      canvasBounds.contentRightPx,
      [],
    );
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0].endPx).toBeLessThan(1123);

    const sparseSegments = rebalanceRirekishoSparseTrailingPdfSliceSegments(
      [
        { startPx: 0, endPx: 900, breakSource: 'nominal' },
        { startPx: 900, endPx: 1123, breakSource: 'nominal' },
        { startPx: 1123, endPx: 1180, breakSource: 'nominal' },
      ],
      1123,
      0,
    );
    expect(sparseSegments).toHaveLength(2);
    expect(sparseSegments[1].endPx).toBe(1180);
  });

  test('Rirekisho DOCX keeps small Languages section together with heading and rows', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('function rirekishoLanguagesSectionTable');
    expect(exportSource).toContain('rirekishoLanguagesHeadingTableRow');
    expect(exportSource).toContain("jpRun('語学'");
    expect(exportSource).toContain('cantSplit: true');
    expect(exportSource).toContain('keepLines: true');
    expect(exportSource).toContain('children.push(rirekishoLanguagesSectionTable());');
    expect(exportSource).not.toContain("children.push(sectionHeadingRow('語学'));");
    expect(exportSource).not.toContain('children: [innerTable]');
    expect(exportSource).not.toContain('languageCount > 8');
  });

  test('Rirekisho DOCX emits 語学 and 言語 in one flat table without a nested wrapper', async () => {
    const multiLangCv = cv({
      languages: [
        { name: 'English', level: 'Advanced' },
        { name: 'French', level: 'Intermediate' },
        { name: 'Italian', level: 'Native' },
      ],
    });
    const { documentXml } = await captureDocx(multiLangCv);
    const gogakuIdx = documentXml.indexOf('語学');
    expect(gogakuIdx).toBeGreaterThan(-1);
    const tableStart = documentXml.lastIndexOf('<w:tbl>', gogakuIdx);
    const tableEnd = documentXml.indexOf('</w:tbl>', gogakuIdx);
    const languagesTable = documentXml.slice(tableStart, tableEnd);
    expect(languagesTable).toContain('語学');
    expect(languagesTable).toContain('English');
    expect(languagesTable).toContain('Italian');
    expect(languagesTable).toContain('レベル');
    expect((languagesTable.match(/<w:tbl>/g) ?? []).length).toBe(1);
    const headingRowEnd = languagesTable.indexOf('</w:tr>', languagesTable.indexOf('語学'));
    const headerRow = languagesTable.slice(headingRowEnd, languagesTable.indexOf('</w:tr>', headingRowEnd + 1));
    expect(headerRow).toContain('言語');
    expect(headerRow).toContain('レベル');
    expect(languagesTable.indexOf('<w:trPr><w:cantSplit/></w:trPr>', languagesTable.indexOf('語学') - 400)).toBeGreaterThan(-1);
  });

  test('DOCX remains table-based, editable, fixed-width, with constrained photo and preserved skills/self PR', async () => {
    const { documentXml, text, files } = await captureDocx(cv());

    expect(documentXml).toContain('<w:tbl>');
    expect(documentXml).toContain('<w:tblLayout w:type="fixed"');
    expect(documentXml).toContain('<w:gridCol w:w="2520"');
    expect(documentXml).toContain('<w:gridCol w:w="6840"');
    expect(documentXml).toContain('<w:gridCol w:w="4680"');
    expect(documentXml).not.toContain('<w:gridCol w:w="100"');
    expect(documentXml).not.toContain('w:type="pct" w:w="100"');
    expect(documentXml).toContain('wp:extent');
    expect(files.some(file => file.startsWith('word/media/'))).toBe(true);
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(loadedImageSources).toContain(originalPhoto);
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBeCloseTo(-15.2, 1);
    expect(scaledWidth / scaledHeight).toBeCloseTo(600 / 900, 3);
    expect(text).toContain('履 歴 書');
    expect(text).toContain('Dragan Obradović');
    expect(text).toContain('Iskusan učitelj');
    expect(text).toContain('Metematički fakultet');
    expect(text).toContain('Koristio sam geografske karte');
    expect((text.match(/\bCoaching\b/g) ?? [])).toHaveLength(2);
  });
});
