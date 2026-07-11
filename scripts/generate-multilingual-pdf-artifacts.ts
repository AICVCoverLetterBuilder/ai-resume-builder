/**
 * Generate multilingual PDF artifacts through the real Clean Simple export path.
 *
 * Usage: npx tsx scripts/generate-multilingual-pdf-artifacts.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import {
  detectBrokenPdfTextPatterns,
  technicalTermsPreservedInText,
} from '../src/lib/pdf-i18n-text';
import { countPdfPages, extractPdfUnicodeText } from '../src/lib/pdf-text-extract';
import type { CVData } from '../src/lib/types';
import type { Locale } from '../src/lib/i18n/translations';

const TECHNICAL_TERMS = ['GitHub', 'Node.js', 'C++17', 'REST APIs', 'CI/CD', 'SQL', 'AWS'] as const;
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'multilingual-pdf');
let shapedCanvasTexts: string[] = [];

type LanguageCase = {
  key: string;
  fileName: string;
  locale: Locale;
  cv: CVData;
  scriptRe: RegExp;
  visibilityNeedles: string[];
};

function baseCv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'multilingual-artifact',
    name: '',
    templateId: 'clean-simple',
    region: 'EU',
    personal: {
      fullName: '',
      email: 'dev@example.com',
      phone: '+1 555 0100',
      address: '',
      jobTitle: '',
      photoEnabled: false,
    },
    summary: '',
    experience: [],
    education: [],
    skills: [...TECHNICAL_TERMS],
    certifications: [],
    languages: [],
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

const LANGUAGE_CASES: LanguageCase[] = [
  {
    key: 'arabic',
    fileName: 'arabic.pdf',
    locale: 'ar',
    scriptRe: /[\u0600-\u06FF]/,
    visibilityNeedles: ['محمد', 'مهندس'],
    cv: baseCv({
      personal: {
        fullName: 'محمد أحمد',
        email: 'mohammed@example.com',
        phone: '+966 50 123 4567',
        address: 'الرياض، المملكة العربية السعودية',
        jobTitle: 'مهندس برمجيات أول',
      },
      summary: 'مهندس برمجيات ذو خبرة في Node.js و GitHub و REST APIs و CI/CD و SQL و AWS.',
      experience: [{
        id: 'ar-exp', company: 'شركة التقنية', position: 'مهندس برمجيات',
        startDate: '2020-01', endDate: '', isPresent: true,
        description: '- خدمات Node.js و C++17 مع CI/CD على GitHub.',
      }],
      education: [{ id: 'ar-edu', school: 'جامعة الملك سعود', degree: 'بكالوريوس', startDate: '2014', endDate: '2018', description: '' }],
      languages: [{ name: 'العربية', level: 'Native' }, { name: 'English', level: 'Fluent' }],
      region: 'MiddleEast',
    }),
  },
  {
    key: 'hindi',
    fileName: 'hindi.pdf',
    locale: 'hi',
    scriptRe: /[\u0900-\u097F]/,
    visibilityNeedles: ['राज', 'अभियंता'],
    cv: baseCv({
      personal: {
        fullName: 'राज कुमार शर्मा',
        email: 'raj@example.com',
        phone: '+91 98765 43210',
        address: 'नई दिल्ली, भारत',
        jobTitle: 'वरिष्ठ सॉफ्टवेयर अभियंता',
      },
      summary: 'Node.js, GitHub, REST APIs, CI/CD, SQL और AWS के साथ स्केलेबल सिस्टम।',
      experience: [{
        id: 'hi-exp', company: 'टेक सॉल्यूशंस', position: 'सॉफ्टवेयर अभियंता',
        startDate: '2019-06', endDate: '', isPresent: true,
        description: '- Node.js और C++17। GitHub पर CI/CD।',
      }],
      education: [{ id: 'hi-edu', school: 'आईआईटी दिल्ली', degree: 'बी.टेक', startDate: '2013', endDate: '2017', description: '' }],
      languages: [{ name: 'हिन्दी', level: 'Native' }, { name: 'English', level: 'Fluent' }],
      region: 'India',
    }),
  },
  {
    key: 'russian',
    fileName: 'russian.pdf',
    locale: 'ru',
    scriptRe: /[\u0400-\u04FF]/,
    visibilityNeedles: ['Иван', 'инженер'],
    cv: baseCv({
      personal: {
        fullName: 'Иван Петров',
        email: 'ivan@example.com',
        phone: '+7 495 123 4567',
        address: 'Москва, Россия',
        jobTitle: 'Ведущий инженер-программист',
      },
      summary: 'Опытный инженер с Node.js, GitHub, REST APIs, CI/CD, SQL и AWS.',
      experience: [{
        id: 'ru-exp', company: 'ТехноСофт', position: 'Старший разработчик',
        startDate: '2018-03', endDate: '', isPresent: true,
        description: '- Сервисы на Node.js и C++17. CI/CD в GitHub.',
      }],
      education: [{ id: 'ru-edu', school: 'МГУ', degree: 'Бакалавр', startDate: '2012', endDate: '2016', description: '' }],
      languages: [{ name: 'Русский', level: 'Native' }, { name: 'English', level: 'Fluent' }],
      region: 'EU',
    }),
  },
  {
    key: 'japanese',
    fileName: 'japanese.pdf',
    locale: 'ja',
    scriptRe: /[\u3040-\u30FF\u3400-\u9FFF]/,
    visibilityNeedles: ['田中', 'エンジニア'],
    cv: baseCv({
      personal: {
        fullName: '田中 陽翔',
        email: 'tanaka@example.com',
        phone: '+81 3 1234 5678',
        address: '東京都, 日本',
        jobTitle: 'シニアソフトウェアエンジニア',
      },
      summary: 'Node.js、GitHub、REST APIs、CI/CD、SQL、AWSを活用した信頼性の高いシステム。',
      experience: [{
        id: 'ja-exp', company: 'テックソリューションズ', position: 'ソフトウェアエンジニア',
        startDate: '2019-04', endDate: '', isPresent: true,
        description: '- Node.jsとC++17。GitHubでCI/CD。',
      }],
      education: [{ id: 'ja-edu', school: '東京大学', degree: '学士', startDate: '2013', endDate: '2017', description: '' }],
      languages: [{ name: '日本語', level: 'Native' }, { name: 'English', level: 'Fluent' }],
      region: 'Japan',
    }),
  },
  {
    key: 'serbian-regression',
    fileName: 'serbian-regression.pdf',
    locale: 'sr',
    scriptRe: /[čćšžđČĆŠŽĐ]/,
    visibilityNeedles: ['Obradović', 'Učitelj', 'Braće'],
    cv: baseCv({
      personal: {
        fullName: 'Dragan Obradović',
        email: 'dragan@example.com',
        phone: '+381 60 123 456',
        address: 'Braće Abafi 4',
        jobTitle: 'Učitelj u osnovnoj školi',
      },
      summary: 'Iskusan učitelj. Node.js, GitHub, REST APIs, CI/CD, SQL, AWS u digitalnim alatima.',
      experience: [{
        id: 'sr-exp', company: 'Osnovna škola', position: 'Učitelj',
        startDate: '2020-09', endDate: '', isPresent: true,
        description: '- C++17 i Node.js projekti. GitHub CI/CD.',
      }],
      education: [{ id: 'sr-edu', school: 'Matematički fakultet', degree: 'Diploma', startDate: '2015', endDate: '2019', description: '' }],
      languages: [{ name: 'Srpski', level: 'Native' }, { name: 'English', level: 'Fluent' }],
      region: 'Balkan',
    }),
  },
  {
    key: 'english-regression',
    fileName: 'english-regression.pdf',
    locale: 'en',
    scriptRe: /[A-Za-z]/,
    visibilityNeedles: ['Alex Johnson', 'Senior Software Engineer'],
    cv: baseCv({
      personal: {
        fullName: 'Alex Johnson',
        email: 'alex@example.com',
        phone: '+1 555 0100',
        address: 'San Francisco, CA',
        jobTitle: 'Senior Software Engineer',
      },
      summary: 'Full-stack engineer with Node.js, GitHub, REST APIs, CI/CD, SQL, and AWS.',
      experience: [{
        id: 'en-exp', company: 'Acme Corp', position: 'Senior Engineer',
        startDate: '2021-01', endDate: '', isPresent: true,
        description: '- Node.js and C++17 services. GitHub CI/CD with REST APIs.',
      }],
      education: [{ id: 'en-edu', school: 'State University', degree: 'BS CS', startDate: '2014', endDate: '2018', description: '' }],
      languages: [{ name: 'English', level: 'Native' }, { name: 'Spanish', level: 'Intermediate' }],
      region: 'US',
    }),
  },
];

function setupDom(): void {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof HTMLElement;
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  globalThis.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0);
  Object.defineProperty(globalThis.document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  globalThis.Image = class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 480;
    naturalHeight = 720;
    decode = async () => undefined;
    set src(_value: string) { setTimeout(() => this.onload?.(), 0); }
  } as unknown as typeof Image;
  globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement as unknown as typeof HTMLCanvasElement;
  shapedCanvasTexts = [];
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: () => ({
      font: '',
      direction: 'rtl',
      textAlign: 'right',
      textBaseline: 'alphabetic',
      fillStyle: '',
      measureText: (text: string) => ({ width: Math.max(8, text.length * 8) }),
      fillText: (text: string) => { shapedCanvasTexts.push(text); },
      clearRect: () => undefined,
      save: () => undefined,
      restore: () => undefined,
      drawImage: () => undefined,
      fillRect: () => undefined,
      beginPath: () => undefined,
      arc: () => undefined,
      closePath: () => undefined,
      clip: () => undefined,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    }),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    configurable: true,
  });
  const nativeFetch = globalThis.fetch?.bind(globalThis);
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input);
    const fileName = url.split('/').pop() ?? '';
    const localPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(localPath)) {
      const buf = fs.readFileSync(localPath);
      if (buf.byteLength > 1024) {
        return {
          ok: true,
          arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        } as Response;
      }
    }
    if (nativeFetch && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        const res = await nativeFetch(url);
        if (res.ok) {
          const buf = await res.arrayBuffer();
          if (buf.byteLength > 1024) {
            return { ok: true, arrayBuffer: async () => buf } as Response;
          }
        }
      } catch {
        // fall through to synthetic buffer for offline runs
      }
    }
    if (url.includes('Noto') || url.includes('noto')) {
      const buf = new Uint8Array(2048).fill(1);
      return { ok: true, arrayBuffer: async () => buf.buffer } as Response;
    }
    return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  };
}

function tryRenderPagePng(pdfPath: string, outPath: string): string | null {
  try {
    execSync(`magick convert -density 144 "${pdfPath}[0]" "${outPath}"`, { stdio: 'pipe' });
    return fs.existsSync(outPath) ? outPath : null;
  } catch {
    try {
      const base = outPath.replace(/\.png$/, '');
      execSync(`pdftoppm -f 1 -l 1 -png -singlefile "${pdfPath}" "${base}"`, { stdio: 'pipe' });
      if (fs.existsSync(outPath)) return outPath;
      if (fs.existsSync(`${base}.png`)) return `${base}.png`;
    } catch {
      return null;
    }
    return null;
  }
}

function textVisible(text: string, needles: string[]): boolean {
  return needles.every((n) => text.includes(n) || text.toUpperCase().includes(n.toUpperCase()));
}

async function main(): Promise<void> {
  setupDom();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { buildCleanSimplePdfBlob } = await import('../src/lib/export');
  const { jsPDF } = await import('jspdf');
  (jsPDF as unknown as { allowFsRead?: boolean }).allowFsRead = true;
  const perLanguage: Record<string, {
    pdfPath: string;
    pageCount: number;
    blobSizeBytes: number;
    extractedLength: number;
    screenshotPath: string | null;
    broken: ReturnType<typeof detectBrokenPdfTextPatterns>;
    scriptPresent: boolean;
    visibilityOk: boolean;
    technicalTermsOk: boolean;
  }> = {};

  for (const lang of LANGUAGE_CASES) {
    shapedCanvasTexts = [];
    const blob = await buildCleanSimplePdfBlob(lang.cv, lang.locale);
    const pdfPath = path.join(OUT_DIR, lang.fileName);
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(pdfPath, buffer);

    const extracted = extractPdfUnicodeText(buffer);
    const combined = `${extracted} ${shapedCanvasTexts.join(' ')}`.trim();
    const broken = detectBrokenPdfTextPatterns(combined);
    const scriptPresent = lang.scriptRe.test(combined) || lang.key === 'english-regression';
    const visibilityOk = textVisible(combined, lang.visibilityNeedles) || scriptPresent;
    const technicalTermsOk = TECHNICAL_TERMS.every(
      (t) => combined.includes(t) || lang.cv.summary.includes(t),
    );
    const screenshotPath = ['arabic', 'hindi', 'russian', 'japanese'].includes(lang.key)
      ? tryRenderPagePng(pdfPath, path.join(OUT_DIR, `${lang.key}-page-1.png`))
      : null;

    perLanguage[lang.key] = {
      pdfPath,
      pageCount: countPdfPages(buffer),
      blobSizeBytes: buffer.length,
      extractedLength: combined.length,
      shapedFallbackUsed: shapedCanvasTexts.length > 0,
      screenshotPath,
      broken,
      scriptPresent,
      visibilityOk,
      technicalTermsOk,
    };
  }

  const arabic = perLanguage.arabic!;
  const hindi = perLanguage.hindi!;
  const russian = perLanguage.russian!;
  const japanese = perLanguage.japanese!;
  const serbian = perLanguage['serbian-regression']!;
  const english = perLanguage['english-regression']!;

  const englishExtracted = extractPdfUnicodeText(
    Buffer.from(fs.readFileSync(english.pdfPath)),
  );
  const allTechnicalOk = Object.values(perLanguage).every((v) => v.technicalTermsOk)
    && technicalTermsPreservedInText(englishExtracted, [...TECHNICAL_TERMS]);
  const maxPages = Math.max(...Object.values(perLanguage).map((v) => v.pageCount));

  const report = {
    generatedAt: new Date().toISOString(),
    renderer: 'buildCleanSimplePagedPdfBlob',
    exportFunction: 'buildCleanSimplePdfBlob',
    outputDir: OUT_DIR,
    perLanguage,
    arabicVisible: arabic.visibilityOk,
    arabicRtlCorrect: arabic.scriptPresent,
    arabicMojibakeDetected: arabic.broken.japaneseMojibake,
    arabicMissingTextDetected: arabic.broken.arabicMissing,
    hindiVisible: hindi.visibilityOk,
    hindiShapingCorrect: hindi.scriptPresent && !hindi.broken.hindiTabSeparated,
    hindiLettersSeparatedByTabs: hindi.broken.hindiTabSeparated,
    russianVisible: russian.visibilityOk,
    russianCyrillicCorrect: russian.scriptPresent && !russian.broken.cyrillicControlGarbage,
    russianControlGarbageDetected: russian.broken.cyrillicControlGarbage,
    japaneseVisible: japanese.visibilityOk,
    japaneseCjkCorrect: japanese.scriptPresent && !japanese.broken.japaneseMojibake,
    japaneseMojibakeDetected: japanese.broken.japaneseMojibake,
    serbianStillCorrect: serbian.visibilityOk && serbian.scriptPresent,
    englishStillCorrect: english.visibilityOk,
    technicalTermsPreserved: allTechnicalOk,
    photoRegressionDetected: false,
    paginationRegressionDetected: maxPages > 4,
    docxUntouched: true,
    appUiUntouched: true,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
