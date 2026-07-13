import { describe, expect, test } from 'vitest';
import {
  coverLetterAiUnavailable,
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

  test('unknown locale falls back to English', () => {
    expect(coverLetterAiUnavailable('xx' as 'en')).toContain('AI service');
  });
});
