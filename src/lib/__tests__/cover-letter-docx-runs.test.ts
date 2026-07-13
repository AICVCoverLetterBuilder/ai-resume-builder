import { describe, expect, test } from 'vitest';
import {
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

  test('Latin candidate name line is LTR-dominant', () => {
    expect(lineLooksLatinDominant('Alex Carter')).toBe(true);
    const runs = splitMixedArabicDocxRuns('Alex Carter');
    expect(runs.every((r) => !r.rightToLeft)).toBe(true);
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
