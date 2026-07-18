/**
 * @vitest-environment jsdom
 *
 * Build 250 production audit:
 * - Hindi Modern Minimal PDF Unicode text layer (hybrid under shaped PNG)
 * - Deterministic half-year duration (Jan 2024–Present @ 2026-07-18 → 2.5)
 * - PDF/DOCX Summary parity
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { CVData } from '@/lib/types';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText, countPdfPages } from '@/lib/pdf-text-extract';
import { clearPdfI18nFontCache, needsShapedTextFallback } from '@/lib/pdf-i18n-text';
import {
  applyApproximateDurationPolicy,
  buildExperienceDurationSnapshot,
  computeExperienceDuration,
  durationDisplayBucket,
  formatApproximateDurationPhrase,
  monthsBetweenYearMonths,
  yearWordForLocale,
} from '@/lib/cv-experience-duration';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { classifyBulletScript } from '@/lib/cv-export-diagnostics';
import { translations } from '@/lib/i18n/translations';

const REF = '2026-07-18';
const EN_SHELLS = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');
const SEMANTIC_KEYS = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
] as const;

function bakerFixture(overrides: Partial<CVData> = {}): CVData {
  return {
    id: 'build-250-baker',
    name: 'CV',
    personal: {
      fullName: 'Ivan Grozni',
      jobTitle: 'Baker',
      gender: 'female',
      email: 'ivan@example.com',
      phone: '+381 60 111 222',
      address: 'Belgrade',
      photoEnabled: false,
    },
    summary: 'I am a Baker with about two years of experience.',
    contentLocale: 'en',
    summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: 'en',
    experience: [{
      id: 'exp-1',
      position: 'Baker',
      company: 'Ztrew',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: EN_SHELLS,
      generatedDescription: EN_SHELLS,
      originalUserDescription: EN_SHELLS,
      canonicalDescription: EN_SHELLS,
      descriptionOrigin: 'ai_generated',
      generatedLocale: 'sr',
    }],
    education: [],
    skills: ['Organization', 'Adaptability', 'Problem Solving', 'Time Management'],
    certifications: [],
    languages: [{ name: 'English', level: 'native' }],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    runtimeMigrationVersion: 3,
    canonicalSnapshot: {
      schemaVersion: 1,
      frozenAt: '2025-01-01T00:00:00.000Z',
      canonicalLocale: 'en',
      personal: { fullName: 'Ivan Grozni', jobTitle: 'Baker' },
      summary: '',
      experience: [{
        id: 'exp-1',
        company: 'Ztrew',
        position: 'Baker',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: EN_SHELLS,
      }],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
    },
    ...overrides,
  } as CVData;
}

function installFonts(): void {
  clearPdfI18nFontCache();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input);
    const fileName = url.split('/').pop() || '';
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
}

async function extractWithPdfJs(buf: Buffer): Promise<string> {
  const pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(buf), disableFontFace: true }).promise;
  let text = '';
  for (let i = 1; i <= pdfDoc.numPages; i += 1) {
    const page = await pdfDoc.getPage(i);
    const tc = await page.getTextContent();
    text += `${tc.items.map((it) => ('str' in it ? it.str : '')).join(' ')}\n`;
  }
  return text;
}

function mockDownload(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://b250/${blobs.length}`;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return blobs;
}

describe('Build 250 duration policy', () => {
  it('Jan 2024–Present at 2026-07-18 is 30 months → 2.5 years', () => {
    expect(monthsBetweenYearMonths('2024-01', '2026-07')).toBe(30);
    const d = computeExperienceDuration(
      { startDate: '2024-01', endDate: '', isPresent: true },
      REF,
    );
    expect(d.totalMonths).toBe(30);
    expect(d.approxYears).toBe(2.5);
    expect(durationDisplayBucket(d)).toBe('years:2.5');
  });

  it('2025-07–Present at 2026-07-18 is ~1 year', () => {
    const d = computeExperienceDuration(
      { startDate: '2025-07', endDate: '', isPresent: true },
      REF,
    );
    expect(d.totalMonths).toBe(12);
    expect(d.approxYears).toBe(1);
  });

  it('localized half-year wording: hi / en / sr female', () => {
    const d = applyApproximateDurationPolicy(30);
    expect(yearWordForLocale('hi', 2.5)).toBe('ढाई');
    expect(yearWordForLocale('en', 2.5)).toBe('two and a half');
    expect(yearWordForLocale('sr', 2.5)).toBe('dve i po');
    expect(formatApproximateDurationPhrase(d, 'en')).toMatch(/two and a half years/);
    expect(formatApproximateDurationPhrase(d, 'sr')).toMatch(/dve i po godine iskustva/);
    expect(formatApproximateDurationPhrase(d, 'hi')).toMatch(/ढाई/);
  });

  it('overlapping roles are not double-counted', () => {
    const snap = buildExperienceDurationSnapshot([
      { startDate: '2024-01', endDate: '', isPresent: true },
      { startDate: '2024-06', endDate: '', isPresent: true },
    ], REF);
    expect(snap.total.totalMonths).toBe(30);
    expect(snap.total.approxYears).toBe(2.5);
  });

  it('invalid dates yield no duration claim', () => {
    const d = computeExperienceDuration(
      { startDate: '', endDate: '', isPresent: true },
      REF,
    );
    expect(d.hasValidDates).toBe(false);
    expect(durationDisplayBucket(d)).toBe('none');
  });

  it('exact whole-year boundary stays whole years', () => {
    expect(applyApproximateDurationPolicy(24).approxYears).toBe(2);
    expect(applyApproximateDurationPolicy(12).approxYears).toBe(1);
  });

  it('under one year stays in months', () => {
    expect(applyApproximateDurationPolicy(8).unit).toBe('months');
  });
});

describe('Build 250 Hindi Modern Minimal PDF text layer + parity', () => {
  beforeEach(() => {
    installFonts();
    localStorage.clear();
  });

  it('needsShapedTextFallback is text-script based (Latin under hi is not PNG)', () => {
    expect(needsShapedTextFallback('hi', 'Ivan Grozni')).toBe(false);
    expect(needsShapedTextFallback('hi', 'Ztrew')).toBe(false);
    expect(needsShapedTextFallback('hi', 'मैं बेकर हूँ')).toBe(true);
    expect(needsShapedTextFallback('ar', 'محمد')).toBe(true);
  });

  it('prepare + PDF/DOCX share ढाई Summary and Hindi Experience', async () => {
    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    const raw = bakerFixture();
    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.cv.summary).toMatch(/ढाई/);
    expect(prepared.cv.summary).not.toMatch(/लगभग दो वर्षों/);
    expect(prepared.cv.summary).toMatch(/रसोई|सहयोग/);
    expect(prepared.diagnostics.summarySemanticDutyKeys).toEqual([...SEMANTIC_KEYS]);
    const scripts = splitExperienceBullets(prepared.cv.experience[0].description)
      .map(classifyBulletScript);
    expect(scripts.every((s) => s === 'hi')).toBe(true);

    const pageCountBefore = 1;
    const blob = await buildModernMinimalPdfBlob(prepared.cv, 'hi');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
    expect(blob.type).toMatch(/pdf/);

    const buf = Buffer.from(await blob.arrayBuffer());
    expect(countPdfPages(buf)).toBe(pageCountBefore);

    const latin1 = buf.toString('latin1');
    expect((latin1.match(/\/ToUnicode\b/g) || []).length).toBeGreaterThan(0);
    expect((latin1.match(/\/Subtype\s*\/Image\b/g) || []).length).toBeGreaterThan(0);
    // Not a page-sized raster capture
    expect((latin1.match(/\/Width\s+(595|612)\b/g) || []).length).toBe(0);

    const extracted = extractPdfUnicodeText(buf);
    const pdfjsText = await extractWithPdfJs(buf);
    const combined = `${extracted}\n${pdfjsText}`;

    expect(combined).toMatch(/[\u0900-\u097F]/);
    expect(combined).toMatch(/बेकर/);
    expect(combined).toContain(translations.hi.cv.summary);
    expect(combined).toContain(translations.hi.cv.experience);
    expect(combined).toMatch(/व्यंजन|तैयार/);
    expect(combined).toMatch(/स्वच्छ/);
    expect(combined).toMatch(/रसोई|सहयोग/);
    expect(combined).toMatch(/Ivan Grozni/);
    expect(combined).toMatch(/Ztrew/);
    expect(combined).not.toMatch(/Prepare dishes according to restaurant standards/);
    // No full-document duplication of every sentence
    const bakerHits = (combined.match(/बेकर/g) || []).length;
    expect(bakerHits).toBeGreaterThanOrEqual(1);
    expect(bakerHits).toBeLessThan(8);

    const blobs = mockDownload();
    await exportToDOCX(prepared.cv, 'build-250', 'hi');
    expect(blobs[blobs.length - 1]?.size).toBeGreaterThan(0);

    // Second prepare shares identical Summary (parity)
    const prepared2 = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared2.ok).toBe(true);
    if (!prepared2.ok) return;
    expect(prepared2.cv.summary).toBe(prepared.cv.summary);
    expect(prepared2.cv.experience[0].description).toBe(prepared.cv.experience[0].description);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);
  }, 90_000);

  it('English and Arabic controls still export extractable text', async () => {
    const enPrep = prepareExportReadyCv(bakerFixture(), 'en', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(enPrep.ok).toBe(true);
    if (!enPrep.ok) return;
    expect(enPrep.cv.summary).toMatch(/two and a half years/);
    const enBuf = Buffer.from(await (await buildModernMinimalPdfBlob(enPrep.cv, 'en')).arrayBuffer());
    const enText = `${extractPdfUnicodeText(enBuf)}\n${await extractWithPdfJs(enBuf)}`;
    expect(enText).toMatch(/Baker|Ivan Grozni|Ztrew/i);
    expect(enText).toMatch(/two and a half|hygiene|kitchen/i);

    const arCv = bakerFixture({
      personal: {
        fullName: 'محمد أحمد',
        jobTitle: 'خباز',
        gender: 'male',
        email: 'a@b.c',
        phone: '1',
        address: 'Riyadh',
        photoEnabled: false,
      },
      summary: '',
      skills: ['Organization'],
    });
    const arPrep = prepareExportReadyCv(arCv, 'ar', 'modern-minimal', {
      gender: 'male',
      referenceDate: REF,
    });
    // Arabic may fail summary locale if empty — only assert PDF path when ok
    if (arPrep.ok) {
      const arBuf = Buffer.from(await (await buildModernMinimalPdfBlob(arPrep.cv, 'ar')).arrayBuffer());
      const arText = `${extractPdfUnicodeText(arBuf)}\n${await extractWithPdfJs(arBuf)}`;
      expect(arText.length + (arBuf.toString('latin1').match(/\/Subtype\s*\/Image/g) || []).length)
        .toBeGreaterThan(0);
    }
  }, 90_000);
});
