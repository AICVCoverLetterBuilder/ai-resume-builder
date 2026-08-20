/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorporateNavyTemplate, templateComponents } from '@/components/cv-templates';
import { createCorporateNavyPdfTemplate } from '@/lib/corporate-navy-pdf-template';
import {
  applyCorporateNavyKeepTogetherPagination,
  buildCorporateNavyPdfBlob,
  buildCorporateNavyPagedPdfBlob,
  createCorporateNavyCircularDocxPhotoDataUrl,
  exportCorporateNavyPdf,
  exportToDOCX,
  resolveCvPdfExportRoute,
} from '@/lib/export';
import { cnNormalizePdfText } from '@/lib/corporate-navy-pdf-renderer';
import type { CVData } from '@/lib/types';

const originalPhoto = `data:image/jpeg;base64,${Buffer.from('corporate-navy-original-photo').toString('base64')}`;
const squarePhoto = `data:image/jpeg;base64,${Buffer.from('corporate-navy-square-photo').toString('base64')}`;
const transparentCirclePhoto = `data:image/png;base64,${Buffer.from('corporate-navy-transparent-circle-photo').toString('base64')}`;
let loadedImageSources: string[] = [];
let drawImageCalls: unknown[][] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'corporate-navy-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradovic',
      email: 'dragan@example.com',
      phone: '+381 60 123 456',
      address: 'Brace Abafi 4',
      jobTitle: 'Education Lead',
      photo: originalPhoto,
      originalPhoto,
      rectangularPhoto: undefined,
      circularPhoto: 'data:image/png;base64,circular-photo',
      photoEnabled: true,
    },
    summary: 'Experienced educator with a record of building high-performance teams and planning lessons across Serbian language and mathematics.',
    experience: [
      {
        id: 'exp1',
        company: 'Primary School ZHFF',
        position: 'Primary School Teacher',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: '- Planned teaching units for Serbian language and mathematics.\n- Adapted instruction for different knowledge levels.',
      },
      {
        id: 'exp2',
        company: 'HFH',
        position: 'Geography Teacher',
        startDate: '2017-02',
        endDate: '2023-01',
        isPresent: false,
        description: '- Prepared quarterly teaching plans and assessment cycles.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Mathematics Faculty', degree: 'VI stepen', startDate: '2020-01', endDate: '2025-02', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'Time Management', 'Creativity', 'Presentation Skills', 'Coaching', 'Leadership'],
    certifications: [],
    languages: [{ name: 'English', level: 'Intermediate' }, { name: 'Serbian', level: 'Native' }],
    templateId: 'corporate-navy',
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
        data[index] = 15;
        data[index + 1] = 23;
        data[index + 2] = 42;
        data[index + 3] = 255;
      }
      return { data };
    }),
  };
  Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => ctx), configurable: true });
  Object.defineProperty(canvas, 'toDataURL', { value: vi.fn(() => 'data:image/jpeg;base64,corporate-navy-pdf'), configurable: true });
  return canvas;
}

function installPdfMocks(canvas: HTMLCanvasElement) {
  const instances: Array<{ pages: number; addImage: ReturnType<typeof vi.fn>; addPage: ReturnType<typeof vi.fn> }> = [];
  const capturedPhotoSrcs: string[] = [];
  const html2canvasMock = vi.fn(async (target: HTMLElement, options?: { onclone?: (doc: Document) => void }) => {
    const photo = target.querySelector('[data-export-photo="corporate-navy"]') as HTMLImageElement | null;
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
        return new Blob(['%PDF-1.7\ncorporate-navy\n%%EOF'], { type: 'application/pdf' });
      }
    },
  }));

  return { html2canvasMock, instances, capturedPhotoSrcs };
}

type DirectPdfInstance = {
  pages: number;
  drawnText: string[];
  textCalls: Array<{ text: string; x: number }>;
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
      textCalls: Array<{ text: string; x: number }> = [];
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
      circle = vi.fn();
      text = vi.fn((t: string | string[], x?: number) => {
        const parts = Array.isArray(t) ? t : [t];
        for (const part of parts) {
          this.drawnText.push(part);
          this.textCalls.push({ text: part, x: x ?? 0 });
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
        return new Blob(['%PDF-1.7\ncorporate-navy-direct\n%%EOF'], { type: 'application/pdf' });
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
  };
}

async function captureDocx(data: CVData): Promise<{ documentXml: string; text: string }> {
  const blobByUrl = new Map<string, Blob>();
  let capturedBlob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:http://corporate-navy/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });

  await exportToDOCX(data, 'corporate-navy-docx-test', 'en', 'corporate-navy');
  expect(capturedBlob).not.toBeNull();
  const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const text = documentXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return { documentXml, text };
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
      fillStyle: '',
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn((...args: unknown[]) => {
        drawImageCalls.push(args);
      }),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      globalCompositeOperation: 'source-over',
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => transparentCirclePhoto),
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
  vi.restoreAllMocks();
});

describe('Corporate Navy export', () => {
  test('template id resolves to Corporate Navy with a stable marker', () => {
    const html = renderToStaticMarkup(<CorporateNavyTemplate data={cv()} locale="en" />);

    expect(templateComponents['corporate-navy']).toBe(CorporateNavyTemplate);
    expect(html).toContain('data-template-id="corporate-navy"');
  });

  test('dedicated PDF renderer has compact navy header, left info, right circular photo, and bottom columns', () => {
    const root = createCorporateNavyPdfTemplate(cv(), { locale: 'en', photoDataUrl: originalPhoto });
    const frame = root.querySelector('[data-export-photo-frame="corporate-navy"]') as HTMLElement;
    const photo = root.querySelector('[data-export-photo="corporate-navy"]') as HTMLImageElement;

    expect(root.dataset.templateId).toBe('corporate-navy');
    expect(root.style.width).toBe('210mm');
    expect(root.querySelector('[data-corporate-navy-pdf-header]')).not.toBeNull();
    expect(root.querySelector('[data-corporate-navy-header-info]')).not.toBeNull();
    expect(root.querySelector('[data-corporate-navy-header-row]')).not.toBeNull();
    expect(root.querySelector('[data-corporate-navy-accent-rule]')).not.toBeNull();
    expect(frame.style.width).toBe('82px');
    expect(frame.style.height).toBe('82px');
    expect(frame.style.borderRadius).toBe('50%');
    expect(frame.style.overflow).toBe('hidden');
    expect(photo.style.objectFit).toBe('cover');
    expect(photo.style.objectPosition).toBe('center center');
    expect(root.querySelector('[data-corporate-navy-bottom-columns]')).not.toBeNull();
    expect(root.textContent).toContain('Leadership');
    expect(root.textContent).toContain('Mathematics Faculty');
  });

  test('Corporate Navy production PDF route is direct and print fallback is disabled', () => {
    const pageSource = source('src/app/cv-builder/page.tsx');
    const handler = pageSource.slice(pageSource.indexOf('const handlePDFDownload'));
    const branch = handler.indexOf("liveCv.templateId === 'corporate-navy'");
    const guard = handler.indexOf("cv.templateId === 'clean-simple'", branch);
    const fallback = handler.indexOf('await openPrintFallback', guard);

    expect(branch).toBeGreaterThan(-1);
    expect(handler.slice(branch, branch + 500)).toContain('exportCorporateNavyPdf');
    expect(handler.slice(branch, branch + 500)).toContain('liveCv');
    expect(guard).toBeGreaterThan(branch);
    expect(fallback).toBeGreaterThan(guard);
    expect(handler.slice(guard, fallback)).toContain("cv.templateId === 'corporate-navy'");
  });

  test('corporate-navy resolves to the dedicated-corporate-navy export route', () => {
    expect(resolveCvPdfExportRoute('corporate-navy').kind).toBe('dedicated-corporate-navy');
    expect(resolveCvPdfExportRoute('contemporary-bold').kind).toBe('dedicated-contemporary-bold');
  });

  test('Corporate Navy dedicated PDF uses direct jsPDF renderer, not canvas slicing', () => {
    const exportSource = source('src/lib/export.ts');
    const rendererSource = source('src/lib/corporate-navy-pdf-renderer.ts');
    expect(exportSource).toContain('buildCorporateNavyPagedPdfBlob');
    expect(exportSource).toContain("kind: 'dedicated-corporate-navy'");
    expect(rendererSource).toContain('cnCreateContext');
    expect(rendererSource).toContain('cnDrawHeader');
    expect(rendererSource).toContain('drawCircularPdfPhoto');
    expect(rendererSource).toContain('preparePdfCircularPhotoDataUrl');
    expect(rendererSource).not.toContain("addImage(photoDataUrl, 'JPEG'");
    expect(rendererSource).toContain('cnDrawSummary');
    expect(rendererSource).toContain('cnDrawWrappedBullet');
    expect(rendererSource).toContain('cnMeasureBulletHeight');
    expect(rendererSource).toContain('cnNormalizePdfText');
    expect(rendererSource).not.toContain('html2canvas');
    expect(rendererSource).not.toContain('buildCvPdfBlob');
    expect(rendererSource).not.toContain('renderPdfSlice');
    expect(rendererSource).not.toContain('renderPaddedPdfSlice');
    expect(exportSource).not.toMatch(/buildCorporateNavyPdfBlob[\s\S]{0,400}buildCvPdfBlob/);
  });

  test('cnNormalizePdfText fixes glued sentence boundaries for PDF rendering only', () => {
    expect(cnNormalizePdfText('scaffolds.logic.Built smoke suites.')).toBe(
      'scaffolds. logic. Built smoke suites.',
    );
    expect(cnNormalizePdfText('strategy.applied.Designed workshop kits.')).toBe(
      'strategy. applied. Designed workshop kits.',
    );
    expect(cnNormalizePdfText('environments.Software platforms stayed consistent.')).toBe(
      'environments. Software platforms stayed consistent.',
    );
    expect(cnNormalizePdfText('risk.lead.Assisted junior engineers.')).toBe(
      'risk. lead. Assisted junior engineers.',
    );
    expect(cnNormalizePdfText('Used Node.js and REST APIs with CI/CD pipelines.')).toBe(
      'Used Node.js and REST APIs with CI/CD pipelines.',
    );
  });

  test('cnDrawWrappedBullet draws only one dash marker for wrapped bullet lines', async () => {
    vi.doUnmock('jspdf');
    const textCalls: Array<{ text: string; x: number }> = [];
    vi.doMock('jspdf', () => ({
      jsPDF: class MockPdf {
        text = vi.fn((t: string, x?: number) => {
          textCalls.push({ text: t, x: x ?? 0 });
        });
        setFont = vi.fn();
        setFontSize = vi.fn();
        setTextColor = vi.fn();
        getTextWidth = vi.fn(() => 2);
        addPage = vi.fn();
        output() { return new Blob(['%PDF'], { type: 'application/pdf' }); }
      },
    }));

    const { cnCreateContext, cnDrawWrappedBullet, cnBulletTextLayout } = await import('@/lib/corporate-navy-pdf-renderer');
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const ctx = cnCreateContext(pdf, cv({ personal: { photoEnabled: false } }), 'en', {
      latinReady: true,
      arabicReady: false,
      devanagariReady: false,
      japaneseReady: false,
    });
    const layout = cnBulletTextLayout(ctx, ctx.contentW);
    const lines = [
      'Built and maintained RESTful APIs using Node.js and Express, supporting core product features used across the',
      'platform.',
    ];

    cnDrawWrappedBullet(ctx, lines, layout);

    expect(textCalls.filter((c) => c.text === '-')).toHaveLength(1);
    const continuation = textCalls.find((c) => c.text.includes('platform.'));
    expect(continuation).toBeDefined();
    expect(continuation!.x).toBe(layout.textX);
    expect(continuation!.text).not.toMatch(/^-/);
  });

  test('wrapped experience bullets do not prefix continuation lines with a dash', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildCorporateNavyPagedPdfBlob(cv({
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

    const calls = instances[0]?.textCalls ?? [];
    const dashes = calls.filter((c) => c.text === '-');
    const bodyLines = calls.filter((c) => c.text !== '-' && !/^(WORK EXPERIENCE|PROFESSIONAL SUMMARY)$/i.test(c.text));
    const continuation = bodyLines.find((c) => /platform\./i.test(c.text));

    expect(dashes.length).toBeGreaterThanOrEqual(1);
    expect(continuation).toBeDefined();
    expect(continuation!.text).not.toMatch(/^-/);
    expect(calls.filter((c) => c.text === '-').length).toBe(1);
  });

  test('dedicated Corporate Navy PDF preserves start-only, completed, and current Experience date semantics', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildCorporateNavyPagedPdfBlob(cv({
      personal: {
        fullName: 'Date Contract',
        email: 'dragan@example.com',
        phone: '+381 60 123 456',
        address: 'Brace Abafi 4',
        jobTitle: 'Education Lead',
        photoEnabled: false,
      },
      summary: '', education: [], skills: [], languages: [],
      experience: [
        {
          id: 'start-only', company: 'Start Only', position: 'Role',
          startDate: '2024-01', endDate: '', isPresent: false, description: '',
        },
        {
          id: 'completed', company: 'Completed', position: 'Role',
          startDate: '2019-06', endDate: '2022-12', isPresent: false, description: '',
        },
        {
          id: 'current', company: 'Current', position: 'Role',
          startDate: '2023-01', endDate: '', isPresent: true, description: '',
        },
      ],
    }), 'en');

    const drawn = instances[0]?.drawnText ?? [];
    expect(drawn).toContain('2024-01');
    expect(drawn).not.toContain('2024-01 -');
    expect(drawn).toContain('2019-06 - 2022-12');
    expect(drawn).toContain('2023-01 - Present');
  });

  test('long QA Tester bullet does not render "- and API layers" on continuation line', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildCorporateNavyPagedPdfBlob(cv({
      personal: { photoEnabled: false, fullName: 'Test User' },
      summary: '',
      education: [],
      skills: [],
      languages: [],
      experience: [{
        id: 'exp-qa',
        company: 'Pixel & Co',
        position: 'QA Tester',
        startDate: '2015-03',
        endDate: '2017-12',
        isPresent: false,
        description: '- Designed and maintained end-to-end test suites using Selenium and TestNG, covering critical user journeys across web and API layers.',
      }],
    }), 'en');

    const drawn = instances[0]?.drawnText ?? [];
    expect(drawn.some((t) => /and API layers/i.test(t))).toBe(true);
    expect(drawn.some((t) => /^-\s*and API layers/i.test(t))).toBe(false);
    expect(instances[0]?.textCalls.filter((c) => c.text === '-').length).toBe(1);
  });

  test('legacy Corporate Navy keep-together pagination helper remains for generic preview path', () => {
    const exportSource = source('src/lib/export.ts');
    expect(exportSource).toContain('applyCorporateNavyKeepTogetherPagination');
    expect(exportSource).toContain("applyCorporateFamilyKeepTogetherPagination(root, 'corporate-navy')");
  });

  test('Corporate Navy keep-together shifts WORK EXPERIENCE heading with first entry when heading would orphan', () => {
    document.body.innerHTML = `
      <div data-template-id="corporate-navy" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="corporate-navy-section" data-test-rect="${rectAttr(1080, 34, 732, 180)}">
          <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(1100, 34, 732, 22)}">WORK EXPERIENCE</h2>
          <div data-export-group="corporate-navy-experience" data-test-rect="${rectAttr(1130, 34, 732, 120)}">
            <div data-test-rect="${rectAttr(1130, 34, 732, 28)}">
              <h3>Primary School Teacher</h3>
            </div>
            <p data-test-rect="${rectAttr(1160, 34, 732, 18)}">Primary School ZHFF</p>
            <div data-export-meaningful="true" data-test-rect="${rectAttr(1182, 34, 732, 24)}">
              <span>-</span><span>Planned teaching units for Serbian language and mathematics.</span>
            </div>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="corporate-navy"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyCorporateNavyKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('WORK EXPERIENCE');
    expect(document.body.textContent).toContain('Primary School Teacher');
  });

  test('Corporate Navy keep-together shifts Education heading with first education row when heading would orphan', () => {
    document.body.innerHTML = `
      <div data-template-id="corporate-navy" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <main data-corporate-navy-pdf-body="true">
          <section data-export-group="corporate-navy-section" data-test-rect="${rectAttr(1080, 34, 732, 90)}">
            <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(1100, 34, 732, 22)}">EDUCATION</h2>
            <div data-test-rect="${rectAttr(1130, 34, 732, 40)}">
              <div>
                <h3>VI stepen</h3>
                <p>Mathematics Faculty</p>
              </div>
              <div>2020-01 - 2025-02</div>
            </div>
          </section>
        </main>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="corporate-navy"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyCorporateNavyKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('EDUCATION');
    expect(document.body.textContent).toContain('Mathematics Faculty');
  });

  test('Corporate Navy keep-together shifts Skills heading with first skill chip when heading would orphan', () => {
    document.body.innerHTML = `
      <div data-template-id="corporate-navy" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="corporate-navy-section" data-test-rect="${rectAttr(1080, 34, 732, 70)}">
          <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(1100, 34, 732, 22)}">SKILLS</h2>
          <div data-test-rect="${rectAttr(1130, 34, 732, 20)}">
            <span data-export-meaningful="true" data-test-rect="${rectAttr(1130, 34, 80, 18)}">Leadership</span>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="corporate-navy"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyCorporateNavyKeepTogetherPagination(root);

    expect(Number.parseFloat(heading.style.marginTop)).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('SKILLS');
    expect(document.body.textContent).toContain('Leadership');
  });

  test('Corporate Navy keep-together does not shift a section that already fits on one page', () => {
    document.body.innerHTML = `
      <div data-template-id="corporate-navy" data-test-rect="${rectAttr(0, 0, 800, 1400)}">
        <section data-export-group="corporate-navy-section" data-test-rect="${rectAttr(820, 34, 732, 120)}">
          <h2 data-export-keep-with-next="true" data-test-rect="${rectAttr(820, 34, 732, 22)}">WORK EXPERIENCE</h2>
          <div data-export-group="corporate-navy-experience" data-test-rect="${rectAttr(850, 34, 732, 90)}">
            <div data-test-rect="${rectAttr(850, 34, 732, 28)}"><h3>Teacher</h3></div>
            <p data-test-rect="${rectAttr(880, 34, 732, 18)}">School</p>
          </div>
        </section>
      </div>
    `;
    installRectMock();
    const root = document.querySelector('[data-template-id="corporate-navy"]') as HTMLElement;
    const heading = root.querySelector('h2') as HTMLElement;

    applyCorporateNavyKeepTogetherPagination(root);

    expect(heading.style.marginTop).toBe('');
  });

  test('Corporate Navy PDF Blob is non-empty and short fixture remains one page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildCorporateNavyPdfBlob(
      cv({ personal: { photoEnabled: false, originalPhoto: undefined } }),
      'en',
    );

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0]!.pages).toBe(1);
    expect(instances[0]!.addPage).not.toHaveBeenCalled();
    const drawn = instances[0]!.drawnText.join(' ');
    expect(drawn).toContain('Dragan Obradovic');
    expect(drawn.toUpperCase()).toContain('PROFESSIONAL SUMMARY');
    expect(drawn.toUpperCase()).toContain('WORK EXPERIENCE');
  });

  test('Page 1 draws Professional Summary after header (body is not blank)', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildCorporateNavyPdfBlob(cv({ personal: { photoEnabled: false } }), 'en');
    const drawn = instances[0]?.drawnText ?? [];
    const summaryIdx = drawn.findIndex((t) => /professional summary/i.test(t));
    const nameIdx = drawn.findIndex((t) => /Dragan Obradovic/i.test(t));
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(summaryIdx).toBeGreaterThan(nameIdx);
    expect(instances[0]?.pages).toBe(1);
  });

  test('Android stress fixture paginates with summary on page 1 and no glued text', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    // alreadyPrepared: exercise renderer pagination on the long fixture text.
    // Integrity recovery may shorten ungrounded summaries and is covered elsewhere.
    const blob = await mod.buildCorporateNavyPagedPdfBlob(androidStressCv(), 'en', {
      photoDataUrl: originalPhoto,
      alreadyPrepared: true,
    });
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
    expect(text).not.toContain('environments.Software');
    expect(text).toContain('environments. Software');
    expect(text).toContain('reporting findings to the development team.');
    if ((instances[0]?.pages ?? 0) >= 2) {
      expect(text).toMatch(/\(continued\)|Sentence 1:/);
    }
  });

  test('Corporate Navy direct export uses shared native/platform save result', async () => {
    installDirectPdfMocks();
    let clickedDownload = '';
    const blobByUrl = new Map<string, Blob>();
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:http://corporate/${blobByUrl.size}`;
      blobByUrl.set(url, blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });

    const result = await exportCorporateNavyPdf(cv(), 'Dragan - CV', 'en');

    expect(clickedDownload).toBe('Dragan - CV.pdf');
    expect(result.result).toBe('saved');
    expect(result.fileName).toBe('Dragan - CV.pdf');
  });

  test('selected originalPhoto is used for direct PDF photo embedding', async () => {
    const { instances } = installDirectPdfMocks();

    await buildCorporateNavyPdfBlob(cv({
      personal: {
        originalPhoto,
        photo: 'data:image/jpeg;base64,photo-field',
        circularPhoto: 'data:image/png;base64,circular-field',
      },
    }), 'en');

    expect(loadedImageSources).toContain(originalPhoto);
    expect(instances[0]?.addImage).toHaveBeenCalled();
    const addImageArgs = instances[0]?.addImage.mock.calls[0] as [string, string];
    expect(addImageArgs[1]).toBe('PNG');
  });

  test('Corporate Navy no-photo PDF renders without placeholder', () => {
    const root = createCorporateNavyPdfTemplate(cv({ personal: { photo: '', originalPhoto: '', photoEnabled: false } }), {
      locale: 'en',
      photoDataUrl: null,
    });

    expect(root.querySelector('[data-export-photo-frame="corporate-navy"]')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('Dragan Obradovic');
  });

  test('Corporate Navy DOCX photo helper creates a transparent PNG circle with proportional center crop', async () => {
    const operations: string[] = [];
    let compositeMode = 'source-over';
    const ctx = {
      clearRect: vi.fn(() => operations.push('clearRect')),
      save: vi.fn(() => operations.push('save')),
      beginPath: vi.fn(() => operations.push('beginPath')),
      arc: vi.fn(() => operations.push('arc')),
      closePath: vi.fn(() => operations.push('closePath')),
      clip: vi.fn(() => operations.push('clip')),
      drawImage: vi.fn((...args: unknown[]) => {
        operations.push('drawImage');
        drawImageCalls.push(args);
      }),
      restore: vi.fn(() => operations.push('restore')),
      fill: vi.fn(() => operations.push('fill')),
      fillStyle: '',
      get globalCompositeOperation() {
        return compositeMode;
      },
      set globalCompositeOperation(value: string) {
        compositeMode = value;
        operations.push(`globalCompositeOperation:${value}`);
      },
    };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: vi.fn(() => ctx), configurable: true });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: vi.fn((type: string) => {
        expect(type).toBe('image/png');
        return transparentCirclePhoto;
      }),
      configurable: true,
    });

    const result = await createCorporateNavyCircularDocxPhotoDataUrl(originalPhoto, 512);

    expect(result).toBe(transparentCirclePhoto);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(ctx.arc).toHaveBeenCalledWith(256, 256, 256, 0, Math.PI * 2);
    expect(operations).toContain('clip');
    expect(operations).toContain('globalCompositeOperation:destination-in');
    expect(operations).toContain('fill');
    expect(operations).toContain('globalCompositeOperation:source-over');
    const [, dx, dy, scaledWidth, scaledHeight] = drawImageCalls[0] as [unknown, number, number, number, number];
    expect(dx).toBe(0);
    expect(dy).toBe(-256);
    expect(scaledWidth).toBe(512);
    expect(scaledHeight).toBe(1024);
  });

  test('Corporate Navy DOCX branch preserves Education and emits Skills exactly once', async () => {
    const { documentXml, text } = await captureDocx(cv({ personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined } }));

    expect(text).toContain('Mathematics Faculty');
    expect(text).toContain('Teamwork | Organization');
    expect((text.match(/\bLeadership\b/g) ?? [])).toHaveLength(1);
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('w:type="page"');
  });

  test('Corporate Navy DOCX branch is scoped and uses compact left-text/right-photo header', () => {
    const exportSource = source('src/lib/export.ts');
    const pageSource = source('src/app/cv-builder/page.tsx');
    const branchStart = exportSource.indexOf("cfg.customLayout === 'corporate-navy'");
    const legacyStart = exportSource.indexOf("false && cfg.customLayout === 'corporate-navy'", branchStart);
    const branch = exportSource.slice(branchStart, legacyStart);
    const docxBranchStart = exportSource.indexOf("else if (cfg.customLayout === 'corporate-navy')");
    const docxBranch = exportSource.slice(docxBranchStart, legacyStart);
    const docxHandlerBranchStart = pageSource.indexOf("liveCv.templateId === 'corporate-navy'");
    const docxHandlerBranch = pageSource.slice(docxHandlerBranchStart, docxHandlerBranchStart + 260);

    expect(exportSource).toContain("customLayout: 'corporate-navy'");
    expect(branch).toContain('cnHeaderTextChildren');
    expect(branch).toContain('cnHeaderCells.push');
    expect(branch).toContain('transformation: { width: 76, height: 76 }');
    expect(branch).toContain('createCorporateNavyCircularDocxPhotoDataUrl(rawPhotoDataUrl, 512)');
    expect(branch).toContain("photoType = cfg.customLayout === 'corporate-navy'");
    expect(branch).toContain('margins: { top: 4, bottom: 4, left: 0, right: 0 }');
    expect(branch).toContain("cnSkills.join('  |  ')");
    expect(branch).not.toContain('alignment: AlignmentType.CENTER, children: [new ImageRun');
    expect(docxBranch).not.toContain('pageBreakBefore');
    expect(docxHandlerBranch.indexOf('originalPhoto')).toBeGreaterThan(-1);
    expect(docxHandlerBranch.indexOf('originalPhoto')).toBeLessThan(docxHandlerBranch.indexOf('circularPhotoDataUrl'));
  });

  test('long Corporate Navy content is not forced into a compressed one-page DOCX path', async () => {
    const longDescription = Array.from({ length: 24 }, (_, index) => `- Delivered corporate milestone ${index + 1} without hidden content.`).join('\n');

    const { documentXml, text } = await captureDocx(cv({
      personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined },
      experience: [
        ...cv().experience,
        { id: 'exp-long', company: 'Long Systems', position: 'Operations Lead', startDate: '2015-01', endDate: '2018-01', isPresent: false, description: longDescription },
      ],
    }));

    expect(text).toContain('Delivered corporate milestone 24 without hidden content.');
    expect(text).toContain('Long Systems');
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('w:vanish');
  });
});
