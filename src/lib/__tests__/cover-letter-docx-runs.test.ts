import { describe, expect, test } from 'vitest';
import {
  formatArabicDocxLineForRtlParagraph,
  lineLooksLatinDominant,
  splitMixedArabicDocxRuns,
} from '../cover-letter-docx-runs';

describe('Arabic cover letter DOCX mixed-direction runs', () => {
  test('C++ stays a single LTR run inside Arabic text', () => {
    const runs = splitMixedArabicDocxRuns('لدي خبرة في C++ وJava.');
    const cppRun = runs.find((r) => r.text.includes('C++'));
    expect(cppRun).toBeDefined();
    expect(cppRun!.rightToLeft).toBe(false);
    expect(cppRun!.text).toContain('C++');
  });

  test('Latin candidate name uses RLM anchor for RTL paragraph', () => {
    const runs = formatArabicDocxLineForRtlParagraph('Alex Carter');
    expect(runs[0].rightToLeft).toBe(false);
    expect(runs[0].text.startsWith('\u200F')).toBe(true);
    expect(runs[0].text).toContain('Alex Carter');
  });

  test('Arabic clause remains RTL run', () => {
    const runs = splitMixedArabicDocxRuns('مع خالص التحية،');
    expect(runs.some((r) => r.rightToLeft && r.text.includes('مع'))).toBe(true);
  });

  test('mixed Google term stays readable as LTR segment', () => {
    const runs = splitMixedArabicDocxRuns('الانضمام إلى فريق Google');
    expect(runs.some((r) => r.text.includes('Google') && !r.rightToLeft)).toBe(true);
    expect(runs.some((r) => r.rightToLeft)).toBe(true);
  });
});
