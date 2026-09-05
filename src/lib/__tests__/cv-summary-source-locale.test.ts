import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  applyCanonicalSummaryEdit,
} from '../cv-canonical-snapshot';
import {
  canonicalizeSummarySourceLocale,
  hashSummarySourceLocaleText,
  resolveSummarySourceLocale,
  summaryBindingLocalesMatch,
  summaryV3CandidateBindingMatches,
} from '../cv-summary-source-locale';
import { auditCvExportIntegrity } from '../cv-export-integrity-audit';
import { hashSummaryV3Value } from '../ai-core-v3/summary-generate';

function cv(overrides: Partial<CVData> = {}): CVData {
  return {
    id: 'summary-locale-test',
    name: 'Summary locale test',
    personal: {
      fullName: 'Ana Example',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: 'Engineer',
    },
    summary: 'Builds reliable systems.',
    contentLocale: 'en',
    summaryOrigin: 'user',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('Summary current-text locale binding', () => {
  it.each([
    ['en', 'en'], ['de', 'de-DE'], ['sr', 'sr-Latn-RS'], ['sr', 'sr-Cyrl-RS'],
    ['pt-BR', 'pt_BR'], ['pt-BR', 'PT-br'], ['en', 'en-US'], ['en', 'en_GB'],
    ['hi', 'hi-IN'], ['ar', 'ar-SA'], ['ja', 'ja-JP'], ['fr', 'fr-FR'],
    ['es', 'es-ES'], ['es', 'es-MX'], ['it', 'it-IT'], ['hr', 'hr-HR'], ['ru', 'ru-RU'],
  ] as const)('strictly canonicalizes accepted Summary locale %s from %s', (expected, raw) => {
    expect(canonicalizeSummarySourceLocale(raw)).toBe(expected);
  });

  it.each(['pt-PT', 'pl', 'nl', 'zh', '', 'en-CA'] as const)('rejects unsupported Summary locale %s', (raw) => {
    expect(canonicalizeSummarySourceLocale(raw)).toBeNull();
    expect(summaryBindingLocalesMatch(raw, raw)).toBe(false);
  });

  it('keeps legacy same-locale CVs on the global fallback', () => {
    expect(resolveSummarySourceLocale(cv())).toEqual({
      locale: 'en',
      resolution: 'global_default_fallback',
    });
  });

  it('prefers a valid current-text binding over global contentLocale', () => {
    const summary = 'Prüft Prozesse und koordiniert Termine.';
    const result = resolveSummarySourceLocale(cv({
      summary,
      summarySourceLocale: 'de',
      summarySourceLocaleTextHash: hashSummarySourceLocaleText(summary),
    }));
    expect(result).toEqual({ locale: 'de', resolution: 'bound_current_text' });
  });

  it('rejects stale binding metadata and falls back without rewriting it', () => {
    const original = cv({
      summarySourceLocale: 'de',
      summarySourceLocaleTextHash: hashSummarySourceLocaleText('Alte deutsche Fassung.'),
    });
    const result = resolveSummarySourceLocale(original);
    expect(result).toEqual({ locale: 'en', resolution: 'global_default_fallback' });
    expect(original.summarySourceLocale).toBe('de');
    expect(original.summarySourceLocaleTextHash).toBe(
      hashSummarySourceLocaleText('Alte deutsche Fassung.'),
    );
  });

  it('rejects an unsupported or stale binding even when the text hash is otherwise exact', () => {
    const summary = 'Prüft Prozesse und koordiniert Termine.';
    for (const raw of ['pl', 'pt-PT'] as const) {
      const original = cv({
        summary,
        contentLocale: undefined,
        summarySourceLocale: raw as CVData['summarySourceLocale'],
        summarySourceLocaleTextHash: hashSummarySourceLocaleText(summary),
      });
      expect(resolveSummarySourceLocale(original)).toEqual({ locale: null, resolution: 'unresolved' });
    }
  });

  it('fails the atomic candidate predicate closed for every unsupported/missing/wrong binding case', () => {
    const summary = 'Prüft Prozesse und koordiniert Termine.';
    const valid = {
      requestedLocale: 'de', committedSourceLocale: 'de', committedGeneratedLocale: 'de',
      committedSummaryOrigin: 'ai_generated', committedSummary: summary,
      committedSummaryHash: hashSummaryV3Value(summary), intendedCandidateHash: hashSummaryV3Value(summary),
      committedSummarySourceLocaleTextHash: hashSummarySourceLocaleText(summary),
      committedCvHash: 'cv-same', intendedCvHash: 'cv-same',
      committedContentLocale: 'en', intendedContentLocale: 'en',
    };
    expect(summaryV3CandidateBindingMatches(valid)).toBe(true);
    const invalidCases = [
      { requestedLocale: 'pl' }, { requestedLocale: 'pt-PT' },
      { committedSourceLocale: 'pl' }, { committedSourceLocale: 'pt-PT' },
      { committedSourceLocale: '' }, { committedSourceLocale: undefined },
      { committedSourceLocale: 'fr' },
      { committedSummarySourceLocaleTextHash: 'wrong-hash' },
      { committedSummaryHash: 'wrong-summary-hash' },
      { committedCvHash: 'stale-cv' }, { committedContentLocale: 'de' },
    ];
    let usage = 0;
    for (const overrides of invalidCases) {
      const accepted = summaryV3CandidateBindingMatches({ ...valid, ...overrides });
      expect(accepted).toBe(false);
      if (accepted) usage += 1;
    }
    expect(usage).toBe(0);
  });

  it('manual Summary edit binds the pre-edit locale and never UI locale', () => {
    const before = cv({
      summary: 'Builds reliable systems.',
      summarySourceLocale: 'en',
      summarySourceLocaleTextHash: hashSummarySourceLocaleText('Builds reliable systems.'),
      summaryGeneratedLocale: 'en',
    });
    const edited = applyCanonicalSummaryEdit(before, 'Builds resilient systems.', 'de');
    expect(edited.contentLocale).toBe('en');
    expect(edited.summarySourceLocale).toBe('en');
    expect(edited.summarySourceLocaleTextHash).toBe(
      hashSummarySourceLocaleText('Builds resilient systems.'),
    );
    expect(edited.summaryGeneratedLocale).toBeUndefined();
  });

  it('manual edit after a mixed-locale Summary translation preserves its locale binding', () => {
    const german = 'Prüft Prozesse und koordiniert Termine.';
    const before = cv({
      summary: german,
      summarySourceLocale: 'de',
      summarySourceLocaleTextHash: hashSummarySourceLocaleText(german),
      summaryGeneratedLocale: 'de',
      contentLocale: 'en',
    });
    const edited = applyCanonicalSummaryEdit(before, `${german} Arbeitet sorgfältig.`, 'fr');
    expect(edited.contentLocale).toBe('en');
    expect(edited.summarySourceLocale).toBe('de');
    expect(edited.summarySourceLocaleTextHash).toBe(
      hashSummarySourceLocaleText(`${german} Arbeitet sorgfältig.`),
    );
    expect(edited.summaryGeneratedLocale).toBeUndefined();
  });

  it('export integrity uses valid Summary binding without changing Experience authority', () => {
    const summary = 'Prüft die Tätigkeit und koordiniert Termine.';
    const result = auditCvExportIntegrity(cv({
      summary,
      summarySourceLocale: 'de',
      summarySourceLocaleTextHash: hashSummarySourceLocaleText(summary),
      contentLocale: 'en',
      summaryOrigin: 'user',
    }), 'en', { requireSummaryDuration: false });
    expect(result.summaryOk).toBe(true);
  });

  it('fails closed when unresolved Summary source evidence cannot borrow the export target', () => {
    const result = auditCvExportIntegrity(cv({
      summary: 'Prüft die Tätigkeit und koordiniert Termine.',
      contentLocale: undefined,
      summarySourceLocale: 'pt-PT' as CVData['summarySourceLocale'],
      summarySourceLocaleTextHash: 'stale-hash',
      canonicalSnapshot: undefined,
    }), 'de', { requireSummaryDuration: false });
    expect(result.ok).toBe(false);
    expect(result.summaryOk).toBe(false);
    expect(result.reasons).toContain('summary_source_locale_unresolved');
  });
});
