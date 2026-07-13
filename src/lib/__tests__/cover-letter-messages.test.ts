import { describe, expect, test } from 'vitest';
import {
  coverLetterAiUnavailable,
  coverLetterGroundingFailed,
  coverLetterStaleContent,
  coverLetterWrongLanguage,
} from '../cover-letter-messages';

describe('cover letter localized messages', () => {
  test('Arabic AI unavailable message is Arabic, not English', () => {
    const msg = coverLetterAiUnavailable('ar');
    expect(msg).toContain('الذكاء الاصطناعي');
    expect(msg).not.toBe('AI service is temporarily unavailable. Please try again later.');
  });

  test('Hindi wrong-language message is localized', () => {
    const msg = coverLetterWrongLanguage('hi');
    expect(msg).toContain('कवर लेटर');
  });

  test('Arabic stale content download message is localized', () => {
    const msg = coverLetterStaleContent('ar');
    expect(msg).toContain('خطاب');
    expect(msg).not.toContain('Generate a cover letter');
  });

  test('grounding failure message exists for all major locales and is distinct from AI/export errors', () => {
    for (const locale of ['en', 'ar', 'hi', 'de', 'es', 'fr', 'it', 'sr', 'hr', 'ru', 'pt-BR', 'ja'] as const) {
      const msg = coverLetterGroundingFailed(locale);
      expect(msg.length).toBeGreaterThan(20);
      expect(msg.toLowerCase()).not.toContain('pdf');
      expect(msg.toLowerCase()).not.toContain('docx');
      expect(msg).not.toBe(coverLetterAiUnavailable(locale));
    }
    expect(coverLetterGroundingFailed('ar')).toMatch(/معلومات|غير مدعومة|الآمن/);
  });

  test('unknown locale falls back to English', () => {
    expect(coverLetterAiUnavailable('xx' as 'en')).toContain('AI service');
  });
});
