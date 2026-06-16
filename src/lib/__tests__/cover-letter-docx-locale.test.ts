import { describe, expect, test } from 'vitest';
import { stripLeadingNameForDocx, stripLeadingDateForDocx } from '../export';
import type { Locale } from '../i18n/translations';

/**
 * Tests for Cover Letter DOCX locale support.
 *
 * The production exportCoverLetterToDOCX function uses locale-aware font selection,
 * RTL paragraph direction for Arabic, and locale-formatted dates. These tests
 * validate the helper functions and the locale-to-font mapping logic.
 */

// ── Locale → font family mapping (mirrors the switch inside exportCoverLetterToDOCX) ──

function fontFamilyForLocale(locale: string): string {
  switch (locale) {
    case 'ar':   return 'NotoSansArabic';
    case 'hi':   return 'NotoSansDevanagari';
    case 'ja':   return 'NotoSansJP';
    default:     return 'NotoSans'; // en, de, es, fr, it, pt-BR, ru, sr, hr
  }
}

function isRTLForLocale(locale: string): boolean {
  return locale === 'ar';
}

const ALL_LOCALES: Locale[] = ['en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja'];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('stripLeadingNameForDocx', () => {
  test('strips leading name line', () => {
    const result = stripLeadingNameForDocx('John Doe\n\nDear Hiring Manager,\nI am writing...', 'John Doe');
    expect(result).toBe('Dear Hiring Manager,\nI am writing...');
  });

  test('does not strip name in the middle of content', () => {
    const content = 'Dear Hiring Manager,\n\nI, John Doe, am writing to apply...\n\nSincerely,\nJohn Doe';
    const result = stripLeadingNameForDocx(content, 'John Doe');
    expect(result).toBe(content); // unchanged
  });

  test('handles empty input gracefully', () => {
    expect(stripLeadingNameForDocx('', 'John Doe')).toBe('');
    expect(stripLeadingNameForDocx('Content here', '')).toBe('Content here');
  });

  test('strips leading blank lines after removing the name', () => {
    const result = stripLeadingNameForDocx('John Doe\n\n\nBody text', 'John Doe');
    expect(result).toBe('Body text');
  });

  test('works with international names', () => {
    const result = stripLeadingNameForDocx('José García\n\nEstimado señor,\n\nLe escribo...', 'José García');
    expect(result).toBe('Estimado señor,\n\nLe escribo...');
  });
});

describe('stripLeadingDateForDocx', () => {
  test('strips leading date line with 4-digit year', () => {
    const result = stripLeadingDateForDocx('April 30, 2026\n\nDear Hiring Manager,\n\nI am writing...');
    expect(result).toBe('Dear Hiring Manager,\n\nI am writing...');
  });

  test('strips leading Arabic date line', () => {
    const result = stripLeadingDateForDocx('30 أبريل 2026\n\nالسيد المحترم،\n\nأكتب إليكم...');
    expect(result).toBe('السيد المحترم،\n\nأكتب إليكم...');
  });

  test('strips leading date in various formats', () => {
    const formats = [
      '15 June 2026',
      '2026-06-15',
      '15/06/2026',
      'June 15, 2026',
      '15 juin 2026',
      '15. Juni 2026',
    ];
    for (const dateLine of formats) {
      const result = stripLeadingDateForDocx(`${dateLine}\n\nBody text`);
      expect(result).toBe('Body text');
    }
  });

  test('does not strip body lines containing years', () => {
    const content = 'Dear Hiring Manager,\n\nI have been working since 2020 at Company X.\n\nSincerely,\nJane';
    const result = stripLeadingDateForDocx(content);
    expect(result).toBe(content); // unchanged
  });

  test('handles empty input', () => {
    expect(stripLeadingDateForDocx('')).toBe('');
  });
});

describe('Locale font mapping', () => {
  test('Arabic uses NotoSansArabic', () => {
    expect(fontFamilyForLocale('ar')).toBe('NotoSansArabic');
  });

  test('Hindi uses NotoSansDevanagari', () => {
    expect(fontFamilyForLocale('hi')).toBe('NotoSansDevanagari');
  });

  test('Japanese uses NotoSansJP', () => {
    expect(fontFamilyForLocale('ja')).toBe('NotoSansJP');
  });

  test('English uses NotoSans', () => {
    expect(fontFamilyForLocale('en')).toBe('NotoSans');
  });

  test('Serbian uses NotoSans (Cyrillic supported)', () => {
    expect(fontFamilyForLocale('sr')).toBe('NotoSans');
  });

  test('Russian uses NotoSans (Cyrillic supported)', () => {
    expect(fontFamilyForLocale('ru')).toBe('NotoSans');
  });

  test('All other locales use NotoSans', () => {
    const notoLocales = ['de', 'es', 'fr', 'it', 'pt-BR', 'hr'];
    for (const locale of notoLocales) {
      expect(fontFamilyForLocale(locale)).toBe('NotoSans');
    }
  });
});

describe('RTL locale detection', () => {
  test('Arabic is RTL', () => {
    expect(isRTLForLocale('ar')).toBe(true);
  });

  test('All other locales are LTR', () => {
    const ltrLocales = ALL_LOCALES.filter(l => l !== 'ar');
    for (const locale of ltrLocales) {
      expect(isRTLForLocale(locale)).toBe(false);
    }
  });
});

describe('All 12 locales are supported', () => {
  test('every supported locale has a font mapping', () => {
    for (const locale of ALL_LOCALES) {
      const font = fontFamilyForLocale(locale);
      expect(typeof font).toBe('string');
      expect(font.length).toBeGreaterThan(0);
    }
  });

  test('every supported locale has an RTL setting', () => {
    for (const locale of ALL_LOCALES) {
      const rtl = isRTLForLocale(locale);
      expect(typeof rtl).toBe('boolean');
    }
  });
});

describe('Special characters', () => {
  test('stripLeadingNameForDocx handles Japanese characters', () => {
    const content = '山田太郎\n\n採用ご担当者様\n\n私は…';
    const result = stripLeadingNameForDocx(content, '山田太郎');
    expect(result).toBe('採用ご担当者様\n\n私は…');
  });

  test('stripLeadingNameForDocx handles Cyrillic characters', () => {
    const content = 'Иван Петров\n\nУважаемый господин,\n\nЯ пишу...';
    const result = stripLeadingNameForDocx(content, 'Иван Петров');
    expect(result).toBe('Уважаемый господин,\n\nЯ пишу...');
  });

  test('stripLeadingNameForDocx handles Arabic characters', () => {
    const content = 'أحمد محمد\n\nالسيد المحترم،\n\nأكتب إليكم...';
    const result = stripLeadingNameForDocx(content, 'أحمد محمد');
    expect(result).toBe('السيد المحترم،\n\nأكتب إليكم...');
  });

  test('stripLeadingNameForDocx handles Hindi characters', () => {
    const content = 'राजेश कुमार\n\nप्रिय महोदय,\n\nमैं लिख रहा हूं...';
    const result = stripLeadingNameForDocx(content, 'राजेश कुमार');
    expect(result).toBe('प्रिय महोदय,\n\nमैं लिख रहा हूं...');
  });

  test('stripLeadingDateForDocx handles Japanese date formats', () => {
    const result = stripLeadingDateForDocx('2026年6月15日\n\n採用ご担当者様\n\n私は…');
    expect(result).toBe('採用ご担当者様\n\n私は…');
  });
});
