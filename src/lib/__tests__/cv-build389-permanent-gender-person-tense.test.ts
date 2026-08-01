/**
 * Permanent AAB-389 — gender / person / tense matrix for affected locales.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2';
import {
  AAB389_GENDERED_LOCALES,
  AAB389_GENDERS,
  AAB389_SUMMARY_ACTIONS,
  aab389DeterministicSource,
  aab389FinalizeSummary,
  aab389AssertSummarySuccess,
  aab389SeedUsage,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

const EXPECTATIONS: Record<string, { male: RegExp; female: RegExp; banned: RegExp }> = {
  sr: {
    male: /(?:\bsam radio\b|\bobavljao\b|\bpregledao\b|\bbeležio\b|\bmenjao\b)/u,
    female: /(?:\bsam radila\b|\bobavljala\b|\bpregledala\b|\bbeležila\b|\bmenjala\b)/u,
    banned: /radio\s*\/\s*la|zaposlen\s*\/\s*a/u,
  },
  hr: {
    male: /(?:\bsam radio\b|\bobavljao\b|\bpregledavao\b|\bbilježio\b|\bmijenjao\b)/u,
    female: /(?:\bsam radila\b|\bobavljala\b|\bpregledavala\b|\bbilježila\b|\bmijenjala\b)/u,
    banned: /radio\s*\/\s*la|zaposlen\s*\/\s*a/u,
  },
  ru: {
    male: /(?:работал|занимал|проверял|фиксировал|заменял)(?=[^\p{L}])/u,
    female: /(?:работала|занимала|проверяла|фиксировала|заменяла)(?=[^\p{L}])/u,
    banned: /работал\(а\)|занимал\(а\)/u,
  },
  hi: {
    male: /(?:काम करता|करता हूँ|करता था)/u,
    female: /(?:काम करती|करती हूँ|करती थी)/u,
    banned: /करता\s*\/\s*करती|था\s*\/\s*थी/u,
  },
};

describe('AAB-389 permanent gender/person/tense', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(30);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('male/female/unspecified emit one correct form for every Summary action', () => {
    for (const locale of AAB389_GENDERED_LOCALES) {
      const exp = EXPECTATIONS[locale];
      for (const gender of AAB389_GENDERS) {
        const source = aab389DeterministicSource(locale, gender.value);
        for (const action of AAB389_SUMMARY_ACTIONS) {
          const label = `${locale}/${gender.key}/${action}`;
          const fin = aab389FinalizeSummary({
            locale,
            gender: gender.value,
            action,
            existingSummary: action === 'generate_empty' ? '' : source,
          });
          const text = aab389AssertSummarySuccess(fin, locale, label);
          expect(text, label).not.toMatch(exp.banned);
          if (gender.key === 'female') {
            expect(text, label).toMatch(exp.female);
          } else {
            expect(text, label).toMatch(exp.male);
          }
          // Current present / prior completed framing.
          if (locale === 'sr' || locale === 'hr') {
            expect(text, label).toMatch(/Trenutno (?:radim|obavljam)/u);
          }
          if (locale === 'ru') {
            expect(text, label).toMatch(/Сейчас(?: я)? (?:работаю|занимаю)/u);
          }
          if (locale === 'hi') {
            expect(text, label).toMatch(/वर्तमान में/u);
            expect(text, label).toMatch(/इससे पहले|पहले मैं/u);
          }
        }
      }
    }
  });
});
