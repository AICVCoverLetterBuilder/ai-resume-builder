import { describe, expect, test } from 'vitest';
import {
  countLeadingDateLinesAfterStrip,
  isLikelyCoverLetterDateLine,
  normalizeCoverLetterBody,
  prepareCoverLetterForDisplay,
  stripCoverLetterExportHeader,
} from '../cover-letter-header';
import { computeCoverLetterPdfParagraphs } from '../cover-letter-pdf';
import { stripLeadingDateForDocx } from '../export';
import type { Locale } from '../i18n/translations';

const ALL_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

const SAMPLE_DATES: Record<Locale, string> = {
  en: 'July 14, 2026',
  de: '14. Juli 2026',
  es: '14 de julio de 2026',
  fr: '14 juillet 2026',
  it: '14 luglio 2026',
  ar: '١٤ يوليو ٢٠٢٦',
  sr: '14. jul 2026.',
  hr: '14. srpnja 2026.',
  ru: '14 июля 2026 г.',
  'pt-BR': '14 de julho de 2026',
  hi: '14 जुलाई 2026',
  ja: '2026年7月14日',
};

describe('cover-letter header normalization — dates', () => {
  test('recognizes representative localized document-date lines', () => {
    for (const locale of ALL_LOCALES) {
      expect(isLikelyCoverLetterDateLine(SAMPLE_DATES[locale]), locale).toBe(true);
    }
    expect(isLikelyCoverLetterDateLine('14 July 2026')).toBe(true);
    expect(isLikelyCoverLetterDateLine('14 يوليو 2026')).toBe(true);
  });

  test('strips date/email/phone/date header down to greeting', () => {
    const raw = [
      'July 14, 2026',
      'alex@example.com',
      '+1 555 0100',
      'July 14, 2026',
      '',
      'Dear Hiring Team at Gnox,',
      '',
      'I am writing to express my interest.',
      '',
      'Sincerely,',
      'Alex Carter',
    ].join('\n');
    const body = stripCoverLetterExportHeader(raw, 'Alex Carter');
    expect(body.startsWith('Dear Hiring Team')).toBe(true);
    expect(countLeadingDateLinesAfterStrip(raw, 'Alex Carter')).toBe(0);
    expect(body).not.toMatch(/alex@example.com/);
    expect(body).not.toMatch(/July 14, 2026/);
    expect(body).toContain('Alex Carter'); // signoff preserved
  });

  test('preserves legitimate body dates and final signoff name', () => {
    const raw = [
      'Alex Carter',
      'alex@example.com',
      'July 14, 2026',
      '',
      'Dear Hiring Team,',
      '',
      'I completed a certification in March 2024 and would welcome an interview in August 2026.',
      '',
      'Sincerely,',
      'Alex Carter',
    ].join('\n');
    const body = normalizeCoverLetterBody(raw, 'Alex Carter');
    expect(body).toContain('March 2024');
    expect(body).toContain('August 2026');
    expect(body.trim().endsWith('Alex Carter')).toBe(true);
    expect(body).not.toMatch(/^July 14, 2026/m);
  });

  test('all-locale date headers normalize cleanly for PDF/DOCX prep', () => {
    for (const locale of ALL_LOCALES) {
      const date = SAMPLE_DATES[locale];
      const raw = `${date}\nemail@example.com\n+1234567890\n${date}\n\nGreeting line\n\nBody mentioning 2019 experience stays.\n\nSignoff,\nAlex Carter`;
      const body = stripCoverLetterExportHeader(raw, 'Alex Carter');
      expect(countLeadingDateLinesAfterStrip(raw, 'Alex Carter'), locale).toBe(0);
      expect(body.startsWith('Greeting line'), locale).toBe(true);
      expect(body).toContain('2019');
      expect(body).toContain('Alex Carter');
      const paragraphs = computeCoverLetterPdfParagraphs(raw, 'Alex Carter');
      expect(paragraphs[0], locale).toMatch(/Greeting/);
      expect(stripLeadingDateForDocx(`${date}\n\nGreeting`)).toBe('Greeting');
    }
  });

  test('prepareCoverLetterForDisplay has exactly one leading date', () => {
    const body = 'Dear Hiring Team at Gnox,\n\nI am interested.\n\nSincerely,\nAlex Carter';
    const display = prepareCoverLetterForDisplay(body, 'Alex Carter', 'en');
    const lines = display.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(isLikelyCoverLetterDateLine(lines[0])).toBe(true);
    expect(lines.slice(1).filter((l) => isLikelyCoverLetterDateLine(l))).toHaveLength(0);
  });
});
