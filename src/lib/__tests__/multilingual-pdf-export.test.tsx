/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildCleanSimplePagedPdfBlob } from '@/lib/clean-simple-pdf-renderer';
import { buildCleanSimplePdfBlob } from '@/lib/export';
import {
  clearPdfI18nFontCache,
  detectBrokenPdfTextPatterns,
  technicalTermsPreservedInText,
} from '@/lib/pdf-i18n-text';
import { countPdfPages, extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

const TECHNICAL_TERMS = ['GitHub', 'Node.js', 'C++17', 'REST APIs', 'CI/CD', 'SQL', 'AWS'] as const;
const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let shapedCanvasTexts: string[] = [];

function baseCv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'multilingual-pdf-test',
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

function arabicCv(): CVData {
  return baseCv({
    personal: {
      fullName: 'محمد أحمد',
      email: 'mohammed@example.com',
      phone: '+966 50 123 4567',
      address: 'الرياض، المملكة العربية السعودية',
      jobTitle: 'مهندس برمجيات أول',
    },
    summary: 'مهندس برمجيات ذو خبرة في بناء أنظمة موثوقة باستخدام Node.js و GitHub و REST APIs و CI/CD و SQL و AWS.',
    experience: [{
      id: 'ar-exp-1',
      company: 'شركة التقنية',
      position: 'مهندس برمجيات',
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: '- طورت خدمات خلفية باستخدام Node.js و C++17.\n- أدرت CI/CD على GitHub مع REST APIs.',
    }],
    education: [{
      id: 'ar-edu-1',
      school: 'جامعة الملك سعود',
      degree: 'بكالوريوس علوم الحاسب',
      startDate: '2014',
      endDate: '2018',
      description: '',
    }],
    languages: [{ name: 'العربية', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    region: 'MiddleEast',
  });
}

function hindiCv(): CVData {
  return baseCv({
    personal: {
      fullName: 'राज कुमार शर्मा',
      email: 'raj@example.com',
      phone: '+91 98765 43210',
      address: 'नई दिल्ली, भारत',
      jobTitle: 'वरिष्ठ सॉफ्टवेयर अभियंता',
    },
    summary: 'अनुभवी अभियंता जो Node.js, GitHub, REST APIs, CI/CD, SQL और AWS के साथ स्केलेबल सिस्टम बनाता है।',
    experience: [{
      id: 'hi-exp-1',
      company: 'टेक सॉल्यूशंस',
      position: 'सॉफ्टवेयर अभियंता',
      startDate: '2019-06',
      endDate: '',
      isPresent: true,
      description: '- Node.js और C++17 के साथ माइक्रोसर्विसेज़ विकसित कीं।\n- GitHub Actions पर CI/CD पाइपलाइन बनाई।',
    }],
    education: [{
      id: 'hi-edu-1',
      school: 'आईआईटी दिल्ली',
      degree: 'बी.टेक कंप्यूटर साइंस',
      startDate: '2013',
      endDate: '2017',
      description: '',
    }],
    languages: [{ name: 'हिन्दी', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    region: 'India',
  });
}

function russianCv(): CVData {
  return baseCv({
    personal: {
      fullName: 'Иван Петров',
      email: 'ivan@example.com',
      phone: '+7 495 123 4567',
      address: 'Москва, Россия',
      jobTitle: 'Ведущий инженер-программист',
    },
    summary: 'Опытный инженер, разрабатывающий надёжные системы с Node.js, GitHub, REST APIs, CI/CD, SQL и AWS.',
    experience: [{
      id: 'ru-exp-1',
      company: 'ТехноСофт',
      position: 'Старший разработчик',
      startDate: '2018-03',
      endDate: '',
      isPresent: true,
      description: '- Разрабатывал сервисы на Node.js и C++17.\n- Настроил CI/CD в GitHub с REST APIs.',
    }],
    education: [{
      id: 'ru-edu-1',
      school: 'МГУ им. Ломоносова',
      degree: 'Бакалавр информатики',
      startDate: '2012',
      endDate: '2016',
      description: '',
    }],
    languages: [{ name: 'Русский', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    region: 'EU',
  });
}

function japaneseCv(): CVData {
  return baseCv({
    personal: {
      fullName: '田中 陽翔',
      email: 'tanaka@example.com',
      phone: '+81 3 1234 5678',
      address: '東京都, 日本',
      jobTitle: 'シニアソフトウェアエンジニア',
    },
    summary: 'Node.js、GitHub、REST APIs、CI/CD、SQL、AWSを活用した信頼性の高いシステムを構築するエンジニア。',
    experience: [{
      id: 'ja-exp-1',
      company: 'テックソリューションズ',
      position: 'ソフトウェアエンジニア',
      startDate: '2019-04',
      endDate: '',
      isPresent: true,
      description: '- Node.jsとC++17でバックエンドサービスを開発。\n- GitHub上でCI/CDパイプラインを構築。',
    }],
    education: [{
      id: 'ja-edu-1',
      school: '東京大学',
      degree: '学士（情報工学）',
      startDate: '2013',
      endDate: '2017',
      description: '',
    }],
    languages: [{ name: '日本語', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    region: 'Japan',
  });
}

function serbianRegressionCv(): CVData {
  return baseCv({
    personal: {
      fullName: 'Dragan Obradović',
      email: 'dragan@example.com',
      phone: '+381 60 123 456',
      address: 'Braće Abafi 4, Beograd',
      jobTitle: 'Učitelj u osnovnoj školi',
    },
    summary: 'Iskusan učitelj sa iskustvom u radu sa učenicima. Koristio sam Node.js, GitHub, REST APIs, CI/CD, SQL i AWS u digitalnim alatima.',
    experience: [{
      id: 'sr-exp-1',
      company: 'Osnovna škola',
      position: 'Učitelj',
      startDate: '2020-09',
      endDate: '',
      isPresent: true,
      description: '- Planirao nastavu uz C++17 i Node.js projekte.\n- Koristio GitHub za CI/CD.',
    }],
    education: [{
      id: 'sr-edu-1',
      school: 'Matematički fakultet',
      degree: 'Diploma',
      startDate: '2015',
      endDate: '2019',
      description: '',
    }],
    languages: [{ name: 'Srpski', level: 'Native' }, { name: 'English', level: 'Fluent' }],
    region: 'Balkan',
  });
}

function englishRegressionCv(): CVData {
  return baseCv({
    personal: {
      fullName: 'Alex Johnson',
      email: 'alex@example.com',
      phone: '+1 555 0100',
      address: 'San Francisco, CA',
      jobTitle: 'Senior Software Engineer',
    },
    summary: 'Full-stack engineer building reliable systems with Node.js, GitHub, REST APIs, CI/CD, SQL, and AWS.',
    experience: [{
      id: 'en-exp-1',
      company: 'Acme Corp',
      position: 'Senior Engineer',
      startDate: '2021-01',
      endDate: '',
      isPresent: true,
      description: '- Built services with Node.js and C++17.\n- Managed CI/CD on GitHub with REST APIs.',
    }],
    education: [{
      id: 'en-edu-1',
      school: 'State University',
      degree: 'BS Computer Science',
      startDate: '2014',
      endDate: '2018',
      description: '',
    }],
    languages: [{ name: 'English', level: 'Native' }, { name: 'Spanish', level: 'Intermediate' }],
    region: 'US',
  });
}

function installFontFetchMock(): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: string | URL | Request) => {
    const url = String(input);
    expect(url.startsWith('/fonts/'), `production PDF font load must use local /fonts path, got ${url}`).toBe(true);
    expect(url.includes('githubusercontent'), `CDN font fetch must not be used: ${url}`).toBe(false);
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
    return { ok: false, arrayBuffer: async () => new ArrayBuffer(0) } as Response;
  });
}

function installCanvasShapingMock(): void {
  shapedCanvasTexts = [];
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => ({
      font: '',
      direction: 'ltr',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      fillStyle: '',
      measureText: (text: string) => ({ width: Math.max(8, text.length * 8) }),
      fillText: (text: string) => { shapedCanvasTexts.push(text); },
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => tinyPng),
    configurable: true,
  });
}

function combinedRenderableText(extracted: string): string {
  return `${extracted} ${shapedCanvasTexts.join(' ')}`.trim();
}

function assertNoBrokenPatterns(text: string): void {
  const broken = detectBrokenPdfTextPatterns(text);
  expect(broken.japaneseMojibake, 'Japanese mojibake detected').toBe(false);
  expect(broken.hindiTabSeparated, 'Hindi tab-separated letters detected').toBe(false);
  expect(broken.cyrillicControlGarbage, 'Cyrillic control garbage detected').toBe(false);
  expect(text.includes('\uFFFD'), 'replacement character detected').toBe(false);
  expect(/[\u0000-\u0008\u000B\u000E-\u001F]/.test(text), 'C0 control characters detected').toBe(false);
}

function bodyTechnicalTerms(cv: CVData): string[] {
  const body = [
    cv.summary,
    ...cv.experience.map((e) => e.description),
  ].join(' ');
  return TECHNICAL_TERMS.filter((term) => body.includes(term));
}

function assertTechnicalTerms(cv: CVData, text: string): void {
  const expected = bodyTechnicalTerms(cv);
  expect(expected.length).toBeGreaterThan(0);
  expect(text.includes('Node.js'), 'Node.js must survive PDF export').toBe(true);
  expect(text).not.toContain('Git. Hub');
  expect(text).not.toContain('Node. js');
  const preservedCount = expected.filter((term) => text.includes(term)).length;
  expect(
    preservedCount,
    `expected at least 2 preserved terms from ${expected.join(', ')}`,
  ).toBeGreaterThanOrEqual(Math.min(2, expected.length));
  expect(technicalTermsPreservedInText(text, expected.filter((t) => text.includes(t)))).toBe(true);
}

async function exportRealPdf(cv: CVData, locale: Locale): Promise<Buffer> {
  vi.doUnmock('jspdf');
  clearPdfI18nFontCache();
  const blob = await buildCleanSimplePagedPdfBlob(cv, locale, { photoDataUrl: null });
  expect(blob.size).toBeGreaterThan(0);
  return Buffer.from(await blob.arrayBuffer());
}

beforeEach(() => {
  vi.restoreAllMocks();
  shapedCanvasTexts = [];
  clearPdfI18nFontCache();
  Object.defineProperty(globalThis, 'Image', {
    value: class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 300;
      naturalHeight = 300;
      decode = vi.fn().mockResolvedValue(undefined);
      set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
    },
    configurable: true,
  });
  Object.defineProperty(document, 'fonts', {
    value: { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: (cb: FrameRequestCallback) => setTimeout(cb, 0),
    configurable: true,
  });
  installFontFetchMock();
  installCanvasShapingMock();
});

afterEach(() => {
  vi.doUnmock('jspdf');
  vi.restoreAllMocks();
  clearPdfI18nFontCache();
});

describe('Multilingual Clean Simple PDF export', () => {
  test('Arabic CV exports via buildCleanSimplePagedPdfBlob without broken patterns', async () => {
    const buffer = await exportRealPdf(arabicCv(), 'ar');
    const extracted = extractPdfUnicodeText(buffer);
    const combined = combinedRenderableText(extracted);

    assertNoBrokenPatterns(combined);
    assertTechnicalTerms(arabicCv(), combined);
    expect(combined).toMatch(/[\u0600-\u06FF]/);
    expect(detectBrokenPdfTextPatterns(combined).arabicMissing).toBe(false);
    expect(shapedCanvasTexts.length > 0 || /[\u0600-\u06FF]/.test(extracted)).toBe(true);
  }, 30000);

  test('Hindi CV exports via buildCleanSimplePagedPdfBlob without tab-separated Devanagari', async () => {
    const buffer = await exportRealPdf(hindiCv(), 'hi');
    const extracted = extractPdfUnicodeText(buffer);
    const combined = combinedRenderableText(extracted);

    assertNoBrokenPatterns(combined);
    assertTechnicalTerms(hindiCv(), combined);
    expect(combined).toMatch(/[\u0900-\u097F]/);
    expect(detectBrokenPdfTextPatterns(combined).hindiTabSeparated).toBe(false);
    expect(shapedCanvasTexts.length > 0 || /[\u0900-\u097F]/.test(extracted)).toBe(true);
  }, 30000);

  test('Russian CV exports Cyrillic text without control-character garbage', async () => {
    const buffer = await exportRealPdf(russianCv(), 'ru');
    const extracted = extractPdfUnicodeText(buffer);
    const combined = combinedRenderableText(extracted);

    assertNoBrokenPatterns(combined);
    assertTechnicalTerms(russianCv(), combined);
    expect(combined).toMatch(/[\u0400-\u04FF]/);
    expect(detectBrokenPdfTextPatterns(combined).cyrillicControlGarbage).toBe(false);
  }, 30000);

  test('Japanese CV exports without mojibake patterns', async () => {
    const buffer = await exportRealPdf(japaneseCv(), 'ja');
    const extracted = extractPdfUnicodeText(buffer);
    const combined = combinedRenderableText(extracted);

    assertNoBrokenPatterns(combined);
    assertTechnicalTerms(japaneseCv(), combined);
    expect(combined).toMatch(/[\u3040-\u30FF\u3400-\u9FFF]/);
    expect(detectBrokenPdfTextPatterns(combined).japaneseMojibake).toBe(false);
  }, 30000);

  test('Serbian regression CV preserves Latin Extended diacritics', async () => {
    const buffer = await exportRealPdf(serbianRegressionCv(), 'sr');
    const extracted = extractPdfUnicodeText(buffer);
    const combined = combinedRenderableText(extracted);

    assertNoBrokenPatterns(combined);
    assertTechnicalTerms(serbianRegressionCv(), combined);
    for (const needle of ['Obradović', 'Učitelj', 'Braće', 'Matematički', 'učenicima']) {
      expect(combined.includes(needle) || extracted.includes(needle), `missing ${needle}`).toBe(true);
    }
    expect(combined).not.toContain('Uitelj');
    expect(combined).not.toContain('Brae');
  }, 30000);

  test('English regression CV renders all sections with technical terms', async () => {
    const buffer = await exportRealPdf(englishRegressionCv(), 'en');
    const extracted = extractPdfUnicodeText(buffer);
    const combined = combinedRenderableText(extracted);

    assertNoBrokenPatterns(combined);
    assertTechnicalTerms(englishRegressionCv(), combined);
    expect(combined.toUpperCase()).toMatch(/PROFESSIONAL SUMMARY|SUMMARY/);
    expect(combined.toUpperCase()).toMatch(/WORK EXPERIENCE|EXPERIENCE/);
    expect(combined).toContain('Alex Johnson');
    expect(combined).toContain('Senior Software Engineer');
  }, 30000);

  test('buildCleanSimplePdfBlob app export path delegates to paged renderer for Arabic', async () => {
    const blob = await buildCleanSimplePdfBlob(arabicCv(), 'ar');
    expect(blob.size).toBeGreaterThan(0);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const combined = combinedRenderableText(extractPdfUnicodeText(buffer));
    assertNoBrokenPatterns(combined);
  }, 30000);

  test('multilingual PDFs stay within reasonable page count (no pagination regression)', async () => {
    const cases: Array<[CVData, Locale]> = [
      [arabicCv(), 'ar'],
      [hindiCv(), 'hi'],
      [russianCv(), 'ru'],
      [japaneseCv(), 'ja'],
      [serbianRegressionCv(), 'sr'],
      [englishRegressionCv(), 'en'],
    ];
    for (const [cv, locale] of cases) {
      const buffer = await exportRealPdf(cv, locale);
      const pages = countPdfPages(buffer);
      expect(pages, `${locale} page count`).toBeGreaterThanOrEqual(1);
      expect(pages, `${locale} page count`).toBeLessThanOrEqual(4);
    }
  }, 60000);
});
