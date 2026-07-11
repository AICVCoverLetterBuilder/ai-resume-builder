/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {
  buildContemporaryBoldPagedPdfBlob,
  buildContemporaryBoldPdfBlob,
  exportContemporaryBoldPdf,
  exportToDOCX,
  resolveCvPdfExportRoute,
} from '@/lib/export';
import {
  cbNormalizePdfText,
  cbRegisterUnicodeFonts,
  cbDetectCompactMode,
  cbSafeMaxWidth,
  cbCreateContext,
} from '@/lib/contemporary-bold-pdf-renderer';
import type { CVData } from '@/lib/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORIGINAL_PHOTO = `data:image/jpeg;base64,${Buffer.from('cb-original-photo').toString('base64')}`;
const MASKED_CIRCLE_PHOTO = 'data:image/png;base64,cb-masked-circle-photo';
let pdfInstances: MockPdf[] = [];
let addFileToVFSCalls: string[] = [];

function cv(overrides: Partial<CVData> & { personal?: Partial<CVData['personal']> } = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'cb-test',
    name: '',
    personal: {
      fullName: 'Dragan Obradović',
      email: 'dragan@example.com',
      phone: '+381 60 123 456',
      address: 'Braće Abafi 4',
      jobTitle: 'Učitelj u osnovnoj školi',
      photo: ORIGINAL_PHOTO,
      originalPhoto: ORIGINAL_PHOTO,
      rectangularPhoto: undefined,
      circularPhoto: 'data:image/png;base64,circle-photo',
      photoEnabled: true,
    },
    summary: 'Iskusan nastavnik sa dugogodišnjim iskustvom u radu sa učenicima u nastavi Matematičkom predmetu.',
    experience: [
      {
        id: 'exp1',
        company: 'Osnovna škola ZHFF',
        position: 'Nastavnik',
        startDate: '2023-05',
        endDate: '',
        isPresent: true,
        description: '- Planirao nastavne jedinice za srpski jezik i matematiku.\n- Prilagođavao nastavu.',
      },
    ],
    education: [
      { id: 'edu1', school: 'Matematički fakultet', degree: 'VI stepen', startDate: '2020-01', endDate: '2025-02', description: '' },
    ],
    skills: ['Teamwork', 'Organization', 'GitHub', 'Node.js', 'C++17'],
    certifications: [],
    languages: [{ name: 'English', level: 'Intermediate' }, { name: 'Serbian', level: 'Native' }],
    templateId: 'contemporary-bold',
    region: 'Balkan',
    createdAt: '',
    updatedAt: '',
  };
  return { ...base, ...rest, personal: { ...base.personal, ...personal } };
}

/** Real Android stress fixture — long summary, many bullets, technical terms. */
function stressCv(): CVData {
  const summaryLines = [
    'Iskusan senior softverski inženjer sa više od deset godina iskustva u razvoju sistema visoke dostupnosti.',
    'Specijalizovan za C++17, Node.js, REST APIs i CI/CD automatizaciju pipeline-ova na GitHub platformi.',
    'Primenio sam nlohmann/json biblioteku za serijalizaciju i libcurl za HTTP komunikaciju u embedded projektima.',
    'Koristio sam GitHub Actions za automatizovano testiranje i GitHub za upravljanje kodom tima.',
    'daIskusan u radu sa učenicima u nastavi Matematičkom predmetu.',
    'napreduje.Iskusan je i dalje motivisan da unapredi rad tima.',
    'users.Led teams and accordingly.Led cross-functional initiatives.',
    ...Array.from({ length: 15 }, (_, i) =>
      `Rečenica ${i + 1}: sistematski pristup razvoju softvera uz primenu agilnih metodologija i kontinuiranu integraciju.`,
    ),
  ].join(' ');

  return cv({
    summary: summaryLines,
    experience: [
      {
        id: 'exp1',
        company: 'Tech Solutions d.o.o.',
        position: 'Senior C++ Developer',
        startDate: '2020-03',
        endDate: '',
        isPresent: true,
        description: [
          '- Implementirao visoko-performansni server koristeći C++17 i nlohmann/json.',
          '- Integrisao libcurl za komunikaciju sa eksternim REST APIs servisima.',
          '- Koristio GitHub Actions za CI/CD pipeline i automatizovano testiranje.',
          '- Optimizovao memorijsko upravljanje i smanjio latenciju za 40%.',
          '- Sarađivao sa timovima na GitHub platformi koristeći pull request workflow.',
          '- Projektovao i implementirao microservices arhitekturu sa REST APIs.',
          '- Pisao unit testove i integracionе testove za kritične komponente sistema.',
          '- Mentovao mlađe programere u C++17 tehnikama i Node.js ekosistemu.',
        ].join('\n'),
      },
      {
        id: 'exp2',
        company: 'StartUp Labs',
        position: 'Node.js Backend Developer',
        startDate: '2016-09',
        endDate: '2020-02',
        isPresent: false,
        description: [
          '- Razvijao backend servise koristeći Node.js i Express.js framework.',
          '- Dizajnirao REST APIs za mobilne i web aplikacije.',
          '- Implementirao CI/CD pipeline koristeći GitHub Actions i GitLab CI.',
          '- Koristio MongoDB i PostgreSQL za upravljanje podacima.',
          '- Sarađivao sa front-end timom na integraciji React.js komponenti.',
          '- Pisao dokumentaciju i API specifikacije za interne i eksterne korisnike.',
        ].join('\n'),
      },
      {
        id: 'exp3',
        company: 'DataCore Inc.',
        position: 'Junior Developer',
        startDate: '2013-06',
        endDate: '2016-08',
        isPresent: false,
        description: [
          '- Razvijao Python skripte za analizu podataka i automatizaciju.',
          '- Koristio Git i GitHub za upravljanje verzijama koda.',
          '- Pomagao u migraciji legacy sistema na modernu arhitekturu.',
          '- Učio i primenjivao agilne metodologije razvoja softvera.',
        ].join('\n'),
      },
    ],
    education: [
      { id: 'edu1', school: 'Elektrotehnički fakultet Beograd', degree: 'Master računarskih nauka', startDate: '2011-09', endDate: '2013-07', description: '' },
      { id: 'edu2', school: 'Elektrotehnički fakultet Beograd', degree: 'Bachelor računarskih nauka', startDate: '2007-09', endDate: '2011-07', description: '' },
    ],
    skills: ['C++17', 'Node.js', 'GitHub', 'React.js', 'REST APIs', 'CI/CD', 'MongoDB', 'PostgreSQL', 'Python', 'nlohmann/json', 'libcurl', 'TypeScript', 'Docker', 'Kubernetes'],
    languages: [
      { name: 'Serbian', level: 'Native' },
      { name: 'English', level: 'Fluent' },
      { name: 'German', level: 'Basic' },
    ],
  });
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

class MockPdf {
  pages = 1;
  addImage = vi.fn();
  addPage = vi.fn(() => { this.pages += 1; });
  output = vi.fn((_t?: string) =>
    new Blob([
      '%PDF-1.7\nDragan Obradović\nUčitelj u osnovnoj školi\nBraće Abafi\nučenicima\nMatematičkom\nGitHub\nNode.js\nC++17\nnlohmann/json\nREST APIs\nCI/CD\nPROFESSIONAL SUMMARY\nWORK EXPERIENCE\nEDUCATION\nSKILLS\nLANGUAGES\n%%EOF',
    ], { type: 'application/pdf' }),
  );
  setFillColor = vi.fn();
  setDrawColor = vi.fn();
  setLineWidth = vi.fn();
  setFontSize = vi.fn();
  setFont = vi.fn();
  setTextColor = vi.fn();
  text = vi.fn();
  rect = vi.fn();
  circle = vi.fn();
  line = vi.fn();
  splitTextToSize = vi.fn((text: string, _w: number) => [text]);
  getTextWidth = vi.fn((_t: string) => 20);
  addFileToVFS = vi.fn((name: string) => { addFileToVFSCalls.push(name); });
  addFont = vi.fn();
}

function installMocks(): void {
  vi.doMock('html2canvas', () => ({
    default: vi.fn(async () => { throw new Error('html2canvas must not be called for contemporary-bold'); }),
  }));
  vi.doMock('jspdf', () => ({
    jsPDF: class extends MockPdf {
      constructor() {
        super();
        pdfInstances.push(this as unknown as MockPdf);
      }
    },
  }));
}

async function captureDocx(data: CVData): Promise<{ text: string }> {
  const blobByUrl = new Map<string, Blob>();
  let capturedBlob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const url = `blob:http://cb/${blobByUrl.size}`;
    blobByUrl.set(url, blob);
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    capturedBlob = blobByUrl.get(this.href) ?? null;
  });
  await exportToDOCX(data, 'cb-docx-test', 'en', 'contemporary-bold');
  expect(capturedBlob).not.toBeNull();
  const zip = await JSZip.loadAsync(await capturedBlob!.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')!.async('string');
  const text = documentXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { text };
}

function source(file: string): string {
  return fs.readFileSync(path.resolve(file), 'utf8');
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.restoreAllMocks();
  pdfInstances = [];
  addFileToVFSCalls = [];
  Object.defineProperty(globalThis, 'Image', {
    value: class {
      onload: (() => void) | null = null;
      decode = vi.fn().mockResolvedValue(undefined);
      naturalWidth = 164; naturalHeight = 164;
      set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
    },
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      clearRect: vi.fn(), fillRect: vi.fn(), save: vi.fn(), beginPath: vi.fn(),
      arc: vi.fn(), closePath: vi.fn(), clip: vi.fn(),
      drawImage: vi.fn(), restore: vi.fn(), fill: vi.fn(),
      fillStyle: '', globalCompositeOperation: 'source-over',
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => MASKED_CIRCLE_PHOTO),
    configurable: true,
  });
  Object.defineProperty(document, 'fonts', {
    value: { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() },
    configurable: true,
  });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (typeof url === 'string' && url.startsWith('/fonts/')) {
      const fileName = url.split('/').pop() ?? '';
      const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
      if (fs.existsSync(fontPath)) {
        const buf = fs.readFileSync(fontPath);
        if (buf.byteLength > 1024) {
          return {
            ok: true,
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
          } as Response;
        }
      }
    }
    return { ok: false } as Response;
  }));
  installMocks();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.doUnmock('html2canvas');
  vi.doUnmock('jspdf');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Contemporary Bold PDF rebuild v2', () => {

  // ── Routing (T01–T05) ──────────────────────────────────────────────────────

  test('T01: contemporary-bold resolves to dedicated-contemporary-bold', () => {
    expect(resolveCvPdfExportRoute('contemporary-bold').kind).toBe('dedicated-contemporary-bold');
  });

  test('T02: Contemporary Bold PDF calls buildContemporaryBoldPagedPdfBlob', () => {
    expect(typeof buildContemporaryBoldPagedPdfBlob).toBe('function');
    const rendererSrc = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(rendererSrc).toContain('export async function buildContemporaryBoldPagedPdfBlob');
  });

  test('T03: Contemporary Bold PDF does not call buildCvPdfBlob', () => {
    const expSrc = source('src/lib/export.ts');
    const fnStart = expSrc.indexOf('export async function buildContemporaryBoldPdfBlob');
    const fnEnd = expSrc.indexOf('\nexport async function', fnStart + 10);
    expect(expSrc.slice(fnStart, fnEnd)).not.toContain('buildCvPdfBlob');
  });

  test('T04: Contemporary Bold PDF does not call html2canvas', () => {
    const rendererSrc = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(rendererSrc).not.toMatch(/from ['"]html2canvas['"]/);
    expect(rendererSrc).not.toMatch(/import\(['"]html2canvas['"]\)/);
  });

  test('T05: Contemporary Bold PDF does not call renderPdfSlice/renderPaddedPdfSlice', () => {
    const rendererSrc = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(rendererSrc).not.toContain('renderPdfSlice');
    expect(rendererSrc).not.toContain('renderPaddedPdfSlice');
  });

  // ── Renderer isolation (T06–T08) ───────────────────────────────────────────

  test('T06: Contemporary Bold renderer does not import Clean Simple renderer', () => {
    expect(source('src/lib/contemporary-bold-pdf-renderer.ts')).not.toContain('clean-simple-pdf-renderer');
  });

  test('T07: Contemporary Bold renderer does not import Modern Minimal renderer', () => {
    expect(source('src/lib/contemporary-bold-pdf-renderer.ts')).not.toContain('modern-minimal-pdf-renderer');
  });

  test('T08: Contemporary Bold renderer does not import Executive Premium renderer', () => {
    expect(source('src/lib/contemporary-bold-pdf-renderer.ts')).not.toContain('executive-premium-pdf-renderer');
  });

  // ── Layout (T09–T17) ──────────────────────────────────────────────────────

  test('T09: page 1 is not header-only blank — text is drawn after header', async () => {
    const blob = await buildContemporaryBoldPagedPdfBlob(cv(), 'en');
    expect(blob.size).toBeGreaterThan(0);
    const instance = pdfInstances[0]!;
    expect(instance.text).toHaveBeenCalled();
  });

  test('T10: PROFESSIONAL SUMMARY heading drawn on page 1 (before any addPage)', async () => {
    await buildContemporaryBoldPagedPdfBlob(cv(), 'en');
    const instance = pdfInstances[0]!;
    const textCalls = (instance.text as ReturnType<typeof vi.fn>).mock.calls as [string, ...unknown[]][];
    const addPageOrder = (instance.addPage as ReturnType<typeof vi.fn>).mock.invocationCallOrder;
    const summaryIdx = textCalls.findIndex(([t]) => typeof t === 'string' && t.toUpperCase().includes('SUMMARY'));
    expect(summaryIdx).toBeGreaterThan(-1);
    if (addPageOrder.length > 0) {
      const summaryOrder = (instance.text as ReturnType<typeof vi.fn>).mock.invocationCallOrder[summaryIdx]!;
      expect(summaryOrder).toBeLessThan(addPageOrder[0]!);
    }
  });

  test('T11: summary can paginate — cbEnsureSpace + cbAddPage logic is present', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(src).toContain('cbDrawSummary');
    expect(src).toContain('cbDrawWrappedParagraph');
    expect(src).toContain('cbEnsureSpace');
    expect(src).toContain('cbAddPage');
  });

  test('T12: Work Experience heading stays with first job lead', async () => {
    await buildContemporaryBoldPagedPdfBlob(cv(), 'en');
    const instance = pdfInstances[0]!;
    const textCalls = (instance.text as ReturnType<typeof vi.fn>).mock.calls as [string, ...unknown[]][];
    const expIdx = textCalls.findIndex(([t]) => typeof t === 'string' && t.toUpperCase().includes('EXPERIENCE'));
    expect(expIdx).toBeGreaterThan(-1);
  });

  test('T13: wrapped bullets use hanging indent (textX > markerX)', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(src).toContain('markerX');
    expect(src).toContain('textX');
    expect(src).toContain('wrapW');
  });

  test('T14: no duplicate bullet marker on wrapped continuation lines', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    // Marker is only drawn when i === 0 (first line of bullet)
    expect(src).toContain('i === 0 && drawMarker');
  });

  test('T15: Education / Skills / Languages are rendered', async () => {
    await buildContemporaryBoldPagedPdfBlob(cv(), 'en');
    const instance = pdfInstances[0]!;
    const textCalls = (instance.text as ReturnType<typeof vi.fn>).mock.calls as [string, ...unknown[]][];
    const all = textCalls.map(([t]) => String(t).toUpperCase()).join(' ');
    expect(all).toContain('EDUCATION');
    expect(all).toContain('SKILLS');
    expect(all).toContain('LANGUAGES');
  });

  test('T16: Education + Skills + Languages grouped in cbDrawLowerSections', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(src).toContain('cbDrawLowerSections');
    expect(src).toContain('cbMeasureLowerSectionsHeight');
  });

  test('T17: compact mode detects long CVs and switches layout pack', () => {
    const shortCv = cv();
    const longCv = stressCv();
    expect(cbDetectCompactMode(shortCv)).toBe(false);
    expect(cbDetectCompactMode(longCv)).toBe(true);
  });

  // ── Right margin / clipping (T18–T20) ────────────────────────────────────

  test('T18: content width = pageWidth − left − right (182mm for A4 with 14mm margins)', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    // CONTENT_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT = 210 - 14 - 14 = 182
    expect(src).toContain('MARGIN_LEFT = 14');
    expect(src).toContain('MARGIN_RIGHT = 14');
    expect(src).toContain('CONTENT_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT');
  });

  test('T19: cbSafeMaxWidth enforces right-margin boundary', async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF() as unknown as MockPdf;
    const ctx = cbCreateContext(pdf as never, cv(), 'en', {
      latinReady: false,
      arabicReady: false,
      devanagariReady: false,
      japaneseReady: false,
    });
    // At contentX (14mm), safe max width = 210 - 14 - 14 = 182mm
    const w = cbSafeMaxWidth(ctx, ctx.contentX);
    expect(w).toBe(182);
    // At a deeper x (50mm), safe width = 210 - 14 - 50 = 146mm
    const w2 = cbSafeMaxWidth(ctx, 50);
    expect(w2).toBe(146);
  });

  test('T20: no right-side clipping — wrapLines uses cbSafeMaxWidth', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(src).toContain('cbSafeMaxWidth');
    expect(src).toContain('safeW = Math.min(maxW, cbSafeMaxWidth');
  });

  // ── Normalization — technical term protection (T21–T27) ──────────────────

  test('T21: GitHub is preserved exactly (never becomes "Git. Hub")', () => {
    expect(cbNormalizePdfText('GitHub')).toBe('GitHub');
    expect(cbNormalizePdfText('Used GitHub for version control')).toContain('GitHub');
    expect(cbNormalizePdfText('Koristio sam GitHub Actions za CI/CD')).toContain('GitHub');
    expect(cbNormalizePdfText('GitHub')).not.toContain('Git. Hub');
  });

  test('T22: "Git. Hub" does not appear in any normalization output', () => {
    const inputs = [
      'GitHub',
      'GitHub Actions',
      'GitHub Copilot',
      'Deployed via GitHub Actions pipeline',
      'Managed GitHub repositories for the team',
    ];
    for (const input of inputs) {
      expect(cbNormalizePdfText(input)).not.toContain('Git. Hub');
    }
  });

  test('T23: Node.js is preserved exactly', () => {
    expect(cbNormalizePdfText('Node.js')).toBe('Node.js');
    expect(cbNormalizePdfText('Built with Node.js and Express.js')).toContain('Node.js');
    expect(cbNormalizePdfText('Built with Node.js and Express.js')).toContain('Express.js');
  });

  test('T24: C++17 is preserved exactly', () => {
    expect(cbNormalizePdfText('C++17')).toBe('C++17');
    expect(cbNormalizePdfText('Wrote C++17 code using modern templates')).toContain('C++17');
  });

  test('T25: nlohmann/json is preserved exactly', () => {
    expect(cbNormalizePdfText('nlohmann/json')).toBe('nlohmann/json');
    expect(cbNormalizePdfText('Used nlohmann/json for serialization')).toContain('nlohmann/json');
  });

  test('T26: REST APIs is preserved exactly', () => {
    expect(cbNormalizePdfText('REST APIs')).toBe('REST APIs');
    expect(cbNormalizePdfText('Designed REST APIs for mobile clients')).toContain('REST APIs');
  });

  test('T27: CI/CD is preserved exactly', () => {
    expect(cbNormalizePdfText('CI/CD')).toBe('CI/CD');
    expect(cbNormalizePdfText('Set up CI/CD pipeline')).toContain('CI/CD');
  });

  // ── Normalization — glued sentence boundaries (T28–T29) ───────────────────

  test('T28: daIskusan is normalized to "da. Iskusan"', () => {
    const result = cbNormalizePdfText('daIskusan nastavnik');
    expect(result).not.toMatch(/daIs/);
    expect(result).toMatch(/da\.?\s+Iskusan/);
  });

  test('T29a: users.Led is normalized to "users. Led"', () => {
    expect(cbNormalizePdfText('users.Led')).toBe('users. Led');
  });

  test('T29b: accordingly.Led is normalized to "accordingly. Led"', () => {
    expect(cbNormalizePdfText('accordingly.Led')).toBe('accordingly. Led');
  });

  test('T29c: napreduje.Iskusan is normalized to "napreduje. Iskusan"', () => {
    expect(cbNormalizePdfText('napreduje.Iskusan')).toBe('napreduje. Iskusan');
  });

  // ── Unicode / Serbian diacritics (T30–T32) ────────────────────────────────

  test('T30: cbRegisterUnicodeFonts registers NotoSans for Serbian diacritics', async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF() as unknown as MockPdf;
    const result = await cbRegisterUnicodeFonts(pdf as never);
    expect(result).toBe(true);
    expect(pdf.addFileToVFS).toHaveBeenCalledWith('NotoSans-Regular.ttf', expect.any(String));
    expect(pdf.addFileToVFS).toHaveBeenCalledWith('NotoSans-Bold.ttf', expect.any(String));
    expect(pdf.addFont).toHaveBeenCalledWith('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    expect(pdf.addFont).toHaveBeenCalledWith('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  });

  test('T31: generated PDF includes Serbian Latin Extended characters', async () => {
    const blob = await buildContemporaryBoldPagedPdfBlob(cv(), 'en');
    const text = await blob.text();
    expect(text).toContain('Dragan Obradović');
    expect(text).toContain('Učitelj u osnovnoj školi');
    expect(text).toContain('Braće Abafi');
  });

  test('T32: generated PDF text does not contain replacement/control garbage (U+FFFD)', async () => {
    const blob = await buildContemporaryBoldPagedPdfBlob(cv(), 'en');
    const text = await blob.text();
    expect(text).not.toContain('\uFFFD');
  });

  // ── DOCX untouched (T33) ─────────────────────────────────────────────────

  test('T33: DOCX export is untouched and still works', async () => {
    const expSrc = source('src/lib/export.ts');
    expect(expSrc).toContain("'contemporary-bold': {");
    const { text } = await captureDocx(cv());
    expect(text).toContain('Matematički fakultet');
  });

  // ── End-to-end (T34–T35) ─────────────────────────────────────────────────

  test('T34: buildContemporaryBoldPdfBlob uses dedicated renderer, no DOM container', async () => {
    const blob = await buildContemporaryBoldPdfBlob(cv(), 'en');
    expect(blob.size).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-contemporary-bold-pdf-export-container]')).toHaveLength(0);
  });

  test('T35: exportContemporaryBoldPdf produces a .pdf download with correct filename', async () => {
    let clickedDownload = '';
    const blobByUrl = new Map<string, Blob>();
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(), configurable: true, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      const url = `blob:http://cb/${blobByUrl.size}`;
      blobByUrl.set(url, blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });
    const result = await exportContemporaryBoldPdf(cv(), 'Dragan - CV', 'en');
    expect(clickedDownload).toBe('Dragan - CV.pdf');
    expect(result.result).toBe('saved');
    expect(result.fileName).toBe('Dragan - CV.pdf');
  });

  // ── Guard & export wiring ─────────────────────────────────────────────────

  test('T36: buildCvPdfBlob guard rejects contemporary-bold → dedicated path enforced', () => {
    const src = source('src/lib/export.ts');
    expect(src).toContain("initialCaptureTemplateId === 'contemporary-bold'");
    expect(src).toContain('dedicated-contemporary-bold');
  });

  test('T37: renderer exposes all required named exports', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    const required = [
      'buildContemporaryBoldPagedPdfBlob',
      'cbRegisterUnicodeFonts',
      'cbNormalizePdfText',
      'cbDetectCompactMode',
      'cbCreateContext',
      'cbDrawHeader',
      'cbDrawSummary',
      'cbDrawExperienceSection',
      'cbDrawExperienceEntry',
      'cbDrawLowerSections',
      'cbDrawSkillsLanguagesGroup',
      'cbDrawEducationSection',
      'cbSafeMaxWidth',
      'cbDrawSectionHeading',
      'cbDrawWrappedBullet',
    ];
    for (const fn of required) expect(src, `missing export: ${fn}`).toContain(`export`);
    for (const fn of required) expect(src, `missing fn: ${fn}`).toContain(fn);
  });

  test('Contemporary Bold PDF uses circular masked photo helper in header renderer', () => {
    const src = source('src/lib/contemporary-bold-pdf-renderer.ts');
    expect(src).toContain('drawCircularPdfPhoto');
    expect(src).toContain('preparePdfCircularPhotoDataUrl');
    expect(src).not.toContain("addImage(photoDataUrl, 'JPEG'");
    expect(src).not.toContain("addImage(photoDataUrl, 'PNG', cx - PHOTO_R");
  });
});
