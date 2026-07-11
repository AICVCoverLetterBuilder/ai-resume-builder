import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  detectBrokenPdfTextPatterns,
  detectPdfScript,
  getPdfI18nFontLoadUrls,
  isPdfI18nCdnFallbackEnabled,
  listActivePdfI18nFontLoadUrls,
  PDF_I18N_MIN_FONT_BYTES,
  protectTechnicalTokens,
  REQUIRED_PDF_FONT_FILES,
  resolvePdfFontFamily,
  shouldApplyLatinPdfSentenceFixes,
  technicalTermsPreservedInText,
  type PdfI18nRegistry,
} from '@/lib/pdf-i18n-text';

const fullRegistry: PdfI18nRegistry = {
  latinReady: true,
  arabicReady: true,
  devanagariReady: true,
  japaneseReady: true,
};

const latinOnlyRegistry: PdfI18nRegistry = {
  latinReady: true,
  arabicReady: false,
  devanagariReady: false,
  japaneseReady: false,
};

const emptyRegistry: PdfI18nRegistry = {
  latinReady: false,
  arabicReady: false,
  devanagariReady: false,
  japaneseReady: false,
};

describe('pdf-i18n-text utilities', () => {
  describe('detectPdfScript', () => {
    test('detects Arabic script', () => {
      expect(detectPdfScript('محمد أحمد')).toBe('arabic');
      expect(detectPdfScript('مرحبا Node.js')).toBe('arabic');
    });

    test('detects Devanagari script for Hindi', () => {
      expect(detectPdfScript('राज कुमार')).toBe('devanagari');
      expect(detectPdfScript('अभियंता GitHub')).toBe('devanagari');
    });

    test('detects Japanese script', () => {
      expect(detectPdfScript('田中太郎')).toBe('japanese');
      expect(detectPdfScript('ソフトウェアエンジニア')).toBe('japanese');
    });

    test('detects Cyrillic script for Russian', () => {
      expect(detectPdfScript('Иван Петров')).toBe('cyrillic');
      expect(detectPdfScript('инженер программист')).toBe('cyrillic');
    });

    test('defaults to Latin for ASCII/Latin Extended text', () => {
      expect(detectPdfScript('')).toBe('latin');
      expect(detectPdfScript('Alex Johnson')).toBe('latin');
      expect(detectPdfScript('Dragan Obradović')).toBe('latin');
      expect(detectPdfScript('Node.js REST APIs')).toBe('latin');
    });

    test('prioritizes Japanese over other scripts when CJK is present', () => {
      expect(detectPdfScript('日本語 русский')).toBe('japanese');
    });
  });

  describe('resolvePdfFontFamily', () => {
    test('returns NotoSansArabic for Arabic locale/text when registered', () => {
      expect(resolvePdfFontFamily(fullRegistry, 'ar', 'محمد')).toBe('NotoSansArabic');
    });

    test('returns NotoSansDevanagari for Hindi locale/text when registered', () => {
      expect(resolvePdfFontFamily(fullRegistry, 'hi', 'राज')).toBe('NotoSansDevanagari');
    });

    test('returns NotoSansJP for Japanese locale/text when registered', () => {
      expect(resolvePdfFontFamily(fullRegistry, 'ja', '田中')).toBe('NotoSansJP');
    });

    test('returns NotoSans for Russian Cyrillic when Latin bundle is ready', () => {
      expect(resolvePdfFontFamily(fullRegistry, 'ru', 'Иван')).toBe('NotoSans');
      expect(resolvePdfFontFamily(latinOnlyRegistry, 'ru', 'Петров')).toBe('NotoSans');
    });

    test('returns NotoSans for English/Serbian Latin locales', () => {
      expect(resolvePdfFontFamily(fullRegistry, 'en', 'Software Engineer')).toBe('NotoSans');
      expect(resolvePdfFontFamily(fullRegistry, 'sr', 'Učitelj')).toBe('NotoSans');
    });

    test('falls back to Latin or helvetica when script bundle is unavailable', () => {
      expect(resolvePdfFontFamily(latinOnlyRegistry, 'ar', 'مرحبا')).toBe('NotoSans');
      expect(resolvePdfFontFamily(emptyRegistry, 'en', 'Hello')).toBe('helvetica');
      expect(resolvePdfFontFamily(null, 'ja', '日本語')).toBe('helvetica');
    });
  });

  describe('shouldApplyLatinPdfSentenceFixes', () => {
    test('skips Latin fixes for ar/hi/ja/ru locales', () => {
      expect(shouldApplyLatinPdfSentenceFixes('ar', 'any text')).toBe(false);
      expect(shouldApplyLatinPdfSentenceFixes('hi', 'राज')).toBe(false);
      expect(shouldApplyLatinPdfSentenceFixes('ja', '田中')).toBe(false);
      expect(shouldApplyLatinPdfSentenceFixes('ru', 'Иван')).toBe(false);
    });

    test('applies Latin fixes for en/sr with Latin script text', () => {
      expect(shouldApplyLatinPdfSentenceFixes('en', 'daIskusan teacher')).toBe(true);
      expect(shouldApplyLatinPdfSentenceFixes('sr', 'Stvarao sam priliku daIskusan')).toBe(true);
    });

    test('skips Latin fixes when non-Latin script is detected in text', () => {
      expect(shouldApplyLatinPdfSentenceFixes('en', 'مرحبا world')).toBe(false);
      expect(shouldApplyLatinPdfSentenceFixes('en', '田中太郎')).toBe(false);
    });

    test('allows Cyrillic text fixes only when locale is not ru', () => {
      expect(shouldApplyLatinPdfSentenceFixes('en', 'Иван Петров')).toBe(true);
    });
  });

  describe('protectTechnicalTokens', () => {
    test('preserves Node.js, GitHub, REST APIs, C++17 through stub/restore cycle', () => {
      const input = 'Built with Node.js on GitHub exposing REST APIs using C++17.';
      const { text, restore } = protectTechnicalTokens(input);
      expect(text).not.toContain('Node.js');
      expect(text).not.toContain('GitHub');
      expect(restore(text)).toBe(input);
    });

    test('preserves email addresses through stub/restore cycle', () => {
      const input = 'Contact dev@example.com or team.lead@company.co.uk for details.';
      const { text, restore } = protectTechnicalTokens(input);
      expect(text).not.toContain('dev@example.com');
      expect(restore(text)).toBe(input);
    });

    test('preserves CI/CD, SQL, AWS alongside localized text', () => {
      const input = 'CI/CD pipeline with SQL on AWS and Azure.';
      const { text, restore } = protectTechnicalTokens(input);
      expect(restore(text)).toContain('CI/CD');
      expect(restore(text)).toContain('SQL');
      expect(restore(text)).toContain('AWS');
      expect(restore(text)).not.toBe(text);
    });
  });

  describe('detectBrokenPdfTextPatterns', () => {
    test('detects Japanese mojibake patterns', () => {
      expect(detectBrokenPdfTextPatterns('0×0í0abc').japaneseMojibake).toBe(true);
      expect(detectBrokenPdfTextPatterns('0x10í0A').japaneseMojibake).toBe(true);
      expect(detectBrokenPdfTextPatterns('broken\uFFFDglyph').japaneseMojibake).toBe(true);
      expect(detectBrokenPdfTextPatterns('田中太郎').japaneseMojibake).toBe(false);
    });

    test('detects Hindi tab-separated Devanagari letters', () => {
      expect(detectBrokenPdfTextPatterns('रा\tज').hindiTabSeparated).toBe(true);
      expect(detectBrokenPdfTextPatterns('राज कुमार').hindiTabSeparated).toBe(false);
    });

    test('detects Cyrillic control-character garbage', () => {
      expect(detectBrokenPdfTextPatterns('\u0004\u001f\u0400\u0418\u0432\u0430\u043d').cyrillicControlGarbage).toBe(true);
      expect(detectBrokenPdfTextPatterns('Иван Петров').cyrillicControlGarbage).toBe(false);
    });

    test('detects Arabic missing text (latin-only fragments)', () => {
      expect(detectBrokenPdfTextPatterns('...').arabicMissing).toBe(true);
      expect(detectBrokenPdfTextPatterns('Node.js').arabicMissing).toBe(true);
      expect(detectBrokenPdfTextPatterns('محمد أحمد').arabicMissing).toBe(false);
    });
  });

  describe('technicalTermsPreservedInText', () => {
    test('returns true when all listed terms appear in text', () => {
      const text = 'GitHub Node.js C++17 REST APIs CI/CD SQL AWS';
      expect(technicalTermsPreservedInText(text, ['GitHub', 'Node.js', 'C++17'])).toBe(true);
    });

    test('returns true when terms are absent (nothing to preserve)', () => {
      expect(technicalTermsPreservedInText('plain summary', ['GitHub', 'Node.js'])).toBe(true);
    });

    test('returns true for mixed-language text containing technical tokens', () => {
      const text = 'مهندس يستخدم Node.js و GitHub و REST APIs و C++17 و CI/CD و SQL و AWS.';
      expect(technicalTermsPreservedInText(text)).toBe(true);
    });
  });

  describe('bundled local PDF fonts', () => {
    test('all required font files exist under public/fonts with minimum size', () => {
      const fontsDir = path.join(process.cwd(), 'public', 'fonts');
      for (const fileName of REQUIRED_PDF_FONT_FILES) {
        const full = path.join(fontsDir, fileName);
        expect(fs.existsSync(full), `missing ${fileName}`).toBe(true);
        const size = fs.statSync(full).size;
        expect(size, `${fileName} too small`).toBeGreaterThan(PDF_I18N_MIN_FONT_BYTES);
      }
    });

    test('production font loading uses local /fonts paths only by default', () => {
      expect(isPdfI18nCdnFallbackEnabled()).toBe(false);
      for (const fileName of REQUIRED_PDF_FONT_FILES) {
        const urls = getPdfI18nFontLoadUrls(fileName);
        expect(urls).toEqual([`/fonts/${fileName}`]);
      }
      const active = listActivePdfI18nFontLoadUrls();
      expect(active.every((url) => url.startsWith('/fonts/'))).toBe(true);
      expect(active.some((url) => url.includes('githubusercontent'))).toBe(false);
    });

    test('each font URL resolves to an on-disk public/fonts file', () => {
      const fontsDir = path.join(process.cwd(), 'public', 'fonts');
      for (const fileName of REQUIRED_PDF_FONT_FILES) {
        const [url] = getPdfI18nFontLoadUrls(fileName);
        const diskName = url!.replace('/fonts/', '');
        expect(fs.existsSync(path.join(fontsDir, diskName))).toBe(true);
      }
    });
  });
});
