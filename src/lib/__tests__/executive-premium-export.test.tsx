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
  epNormalizeDocxText,
  exportToDOCX,
  resolveCvPdfExportRoute,
} from '@/lib/export';
import { epNormalizePdfText } from '@/lib/executive-premium-pdf-renderer';
import { extractPdfUnicodeText, countPdfPages } from '@/lib/pdf-text-extract';
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
      roundedRect = vi.fn();
      line = vi.fn();
      circle = vi.fn();
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
        return new Blob(['%PDF-1.7\nexecutive-premium-direct\n%%EOF'], { type: 'application/pdf' });
      }
      constructor() { instances.push(this as unknown as DirectPdfInstance); }
    },
  }));
  return { instances };
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
      originalPhoto: undefined,
      rectangularPhoto: undefined,
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
  };
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

function pdfTextIncludes(text: string, needle: string): boolean {
  return text.includes(needle) || text.toUpperCase().includes(needle.toUpperCase());
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });
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

  test('executive-premium resolves to the dedicated-executive-premium export route', () => {
    expect(resolveCvPdfExportRoute('executive-premium').kind).toBe('dedicated-executive-premium');
  });

  test('Executive Premium dedicated PDF uses direct jsPDF renderer, not canvas slicing', () => {
    const exportSource = source('src/lib/export.ts');
    const rendererSource = source('src/lib/executive-premium-pdf-renderer.ts');
    expect(exportSource).toContain('buildExecutivePremiumPagedPdfBlob');
    expect(exportSource).toContain("kind: 'dedicated-executive-premium'");
    expect(rendererSource).toContain('epCreateContext');
    expect(rendererSource).toContain('epDrawHeader');
    expect(rendererSource).toContain('epDrawSummary');
    expect(rendererSource).toContain('epRegisterUnicodeFonts');
    expect(rendererSource).toContain('epDrawWrappedBullet');
    expect(rendererSource).toContain('epDrawExperienceEntryContinuation');
    expect(rendererSource).toContain('epNormalizePdfText');
    expect(rendererSource).not.toContain('html2canvas');
    expect(rendererSource).not.toContain('buildCvPdfBlob');
    expect(rendererSource).not.toContain('renderPdfSlice');
    expect(rendererSource).not.toContain('renderPaddedPdfSlice');
    expect(rendererSource).not.toContain('buildModernMinimalPagedPdfBlob');
    expect(rendererSource).not.toContain('buildCorporateNavyPagedPdfBlob');
    expect(exportSource).toContain('Executive Premium PDF must use exportExecutivePremiumPdf');
    expect(exportSource).not.toMatch(/buildExecutivePremiumPdfBlob[\s\S]{0,400}buildCvPdfBlob/);
  });

  test('epNormalizeDocxText fixes glued sentence boundaries for DOCX export only', () => {
    expect(epNormalizeDocxText('napreduje.Iskusan učitelj.')).toBe('napreduje. Iskusan učitelj.');
    expect(epNormalizeDocxText('Stvarao sam priliku daIskusan učitelj.')).toBe(
      'Stvarao sam priliku da. Iskusan učitelj.',
    );
    expect(epNormalizeDocxText('scaffolds.logic.Built smoke suites.')).toBe(
      'scaffolds. logic. Built smoke suites.',
    );
    expect(epNormalizeDocxText('strategy.applied.Designed workshop kits.')).toBe(
      'strategy. applied. Designed workshop kits.',
    );
    expect(epNormalizeDocxText('Used Node.js and REST APIs with CI/CD pipelines.')).toBe(
      'Used Node.js and REST APIs with CI/CD pipelines.',
    );
  });

  test('epNormalizePdfText fixes glued sentence boundaries for PDF rendering only', () => {
    expect(epNormalizePdfText('scaffolds.logic.Built smoke suites.')).toBe(
      'scaffolds. logic. Built smoke suites.',
    );
    expect(epNormalizePdfText('strategy.applied.Designed workshop kits.')).toBe(
      'strategy. applied. Designed workshop kits.',
    );
    expect(epNormalizePdfText('environments.Software platforms stayed consistent.')).toBe(
      'environments. Software platforms stayed consistent.',
    );
    expect(epNormalizePdfText('risk.lead.Assisted junior engineers.')).toBe(
      'risk. lead. Assisted junior engineers.',
    );
    expect(epNormalizePdfText('Stvarao sam priliku daIskusan učitelj.')).toBe(
      'Stvarao sam priliku da. Iskusan učitelj.',
    );
    expect(epNormalizePdfText('Used Node.js and REST APIs with CI/CD pipelines.')).toBe(
      'Used Node.js and REST APIs with CI/CD pipelines.',
    );
  });

  test('Executive Premium PDF Blob is non-empty and short fixture remains one page', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');

    const blob = await mod.buildExecutivePremiumPdfBlob(
      cv({ personal: { photoEnabled: false, originalPhoto: undefined, rectangularPhoto: undefined } }),
      'en',
    );

    expect(blob.size).toBeGreaterThan(0);
    expect(await blob.text()).toContain('%PDF');
    expect(instances).toHaveLength(1);
    expect(instances[0]!.pages).toBe(1);
    expect(instances[0]!.addPage).not.toHaveBeenCalled();
    const drawn = instances[0]!.drawnText.join(' ');
    expect(drawn).toContain('MARCUS THORNE');
    expect(drawn.toUpperCase()).toContain('PROFESSIONAL SUMMARY');
    expect(drawn.toUpperCase()).toContain('WORK EXPERIENCE');
  });

  test('Page 1 draws Professional Summary after header (body is not blank)', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildExecutivePremiumPdfBlob(cv({ personal: { photoEnabled: false } }), 'en');
    const drawn = instances[0]?.drawnText ?? [];
    const summaryIdx = drawn.findIndex((t) => /professional summary/i.test(t));
    const nameIdx = drawn.findIndex((t) => /MARCUS THORNE/i.test(t));
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(summaryIdx).toBeGreaterThan(nameIdx);
    expect(instances[0]?.pages).toBe(1);
  });

  test('Android stress fixture paginates with summary on page 1 and no glued text', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    const blob = await mod.buildExecutivePremiumPagedPdfBlob(androidStressCv(), 'en', { photoDataUrl: photo });
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
      expect(text).toMatch(/\(continued\)|Sentence 1:|PROFESSIONAL SUMMARY CONTINUED/i);
    }
  });

  test('Serbian Latin Extended characters survive in real direct PDF output', async () => {
    vi.doUnmock('jspdf');
    const mod = await import('@/lib/executive-premium-pdf-renderer');
    const blob = await mod.buildExecutivePremiumPagedPdfBlob(serbianStressCv(), 'en', { photoDataUrl: null });
    expect(blob.size).toBeGreaterThan(5000);

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
  }, 30000);

  test('Serbian Unicode passes through renderer text calls before PDF encoding', async () => {
    const { instances } = installDirectPdfMocks();
    const mod = await import('@/lib/export');
    await mod.buildExecutivePremiumPdfBlob(serbianStressCv(), 'en');
    const drawn = instances[0]?.drawnText.join(' ') ?? '';
    for (const needle of ['Obradović', 'Učitelj', 'Braće', 'učenicima', 'Matematičkom', 'da. Iskusan']) {
      expect(pdfTextIncludes(drawn, needle), `missing ${needle} in drawn text`).toBe(true);
    }
    expect(drawn).not.toContain('daIskusan');
  });

  test('real Serbian PDF starts summary on page 1 and includes lower sections', async () => {
    vi.doUnmock('jspdf');
    const mod = await import('@/lib/executive-premium-pdf-renderer');
    const blob = await mod.buildExecutivePremiumPagedPdfBlob(serbianStressCv(), 'en', { photoDataUrl: null });
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

  test('legacy Executive Premium padded slice helpers remain available for generic preview path', () => {
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
    expect(text).toContain('PROFESSIONAL SUMMARY');
    expect(text).toContain('Senior teacher with experience creating structured and inclusive classrooms.');
    expect(text).toContain('Teamwork | Organization | Time Management | Creativity | Presentation Skills | Coaching | Coaching | Leadership');
    expect((text.match(/\bLeadership\b/g) ?? [])).toHaveLength(1);
    expect((text.match(/\bCoaching\b/g) ?? [])).toHaveLength(2);
    expect(documentXml).not.toContain('<w:br w:type="page"');
    expect(documentXml).not.toContain('<w:numPr>');
    expect(documentXml).toContain('w:keepNext');
  });

  test('Executive Premium DOCX renders PROFESSIONAL SUMMARY heading and fixes glued summary text', async () => {
    const data = cv({
      personal: { photoEnabled: false, photo: undefined, originalPhoto: undefined, rectangularPhoto: undefined },
      summary: 'Nastavnik čiji rad napreduje.Iskusan učitelj sa priliku daIskusan učenicima.',
      experience: [],
      education: [],
      skills: [],
      languages: [],
    });
    const { documentXml } = await captureDocx(data);
    const text = visibleDocxText(documentXml);

    expect(text).toContain('PROFESSIONAL SUMMARY');
    expect(text).toContain('napreduje. Iskusan');
    expect(text).toContain('da. Iskusan');
    expect(text).not.toContain('napreduje.Iskusan');
    expect(text).not.toContain('daIskusan');
    expect(text).toContain('učenicima');
    expect(documentXml).toContain('w:keepNext');
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
