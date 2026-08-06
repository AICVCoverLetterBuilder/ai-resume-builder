import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildExperienceLocalizationSnapshot,
  canonicalizeExperienceLocalizationText,
  EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS,
  EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS,
  hashExperienceLocalizedSurfaceValue,
  partitionExperienceLocalizationRecords,
  validateExperienceLocalizationPhysicalBatch,
  type ExperienceLocalizationRequestRecord,
} from '@/lib/cv-experience-localized-surfaces';
import {
  hashExperienceSourceLocaleText,
  resolveExperienceSourceLocale,
} from '@/lib/cv-experience-source-locale';

function exp(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp-1', company: 'Atlas', position: 'Role', startDate: '2024-01', endDate: '',
    isPresent: true, description: 'Prüft eingehende Anfragen und koordiniert Termine.',
    originalUserDescription: 'Prüft eingehende Anfragen und koordiniert Termine.',
    canonicalDescription: 'Prüft eingehende Anfragen und koordiniert Termine.',
    descriptionOrigin: 'user',
    ...overrides,
  };
}

function cv(experience: WorkExperience[]): CVData {
  return {
    id: 'aab400-cv', name: 'AAB400', personal: { fullName: 'Test', email: '', phone: '', address: '', jobTitle: 'Role' },
    summary: '', experience, education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
}

function requestRecord(sourceText: string, index: number): ExperienceLocalizationRequestRecord {
  const canonical = canonicalizeExperienceLocalizationText(sourceText);
  return { requestIdentity: `request-${index}`, cvId: 'aab400-cv', experienceId: 'exp-1',
    experienceLineageHash: 'lineage', sourceClauseIndex: index,
    sourceClauseHash: hashExperienceLocalizedSurfaceValue(canonical), semanticFactId: `fact-${index}`,
    sourceLocale: 'de', targetLocale: 'es', canonicalLineageHash: 'canonical', sourceText: canonical };
}

describe('AAB-400 lossless current-text-bound Experience export contract', () => {
  it('lets confidently detected current German text override stale Spanish metadata', () => {
    const current = exp({
      descriptionSourceLocale: 'es',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText('Texto español anterior.'),
    });
    expect(resolveExperienceSourceLocale(current)).toEqual({
      locale: 'de', resolution: 'current_authoritative_text',
    });
  });

  it('trusts a manual locale only when it is bound to the exact current text', () => {
    const current = exp({
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText('Prüft eingehende Anfragen und koordiniert Termine.'),
    });
    expect(resolveExperienceSourceLocale(current)).toEqual({
      locale: 'de', resolution: 'description_source_locale',
    });
  });

  it('keeps a clause longer than the old 1,600-character boundary losslessly', () => {
    const longClause = `Bearbeitet ${'komplexe Kundenanfragen '.repeat(100)}`.trim();
    const snapshot = buildExperienceLocalizationSnapshot(cv([exp({
      description: longClause,
      originalUserDescription: longClause,
      canonicalDescription: longClause,
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(longClause),
    })]), 'es');
    expect(snapshot.ok).toBe(true);
    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.records[0]?.sourceText).toBe(longClause);
    expect(snapshot.records[0]?.sourceText.length).toBeGreaterThan(1_600);
    expect(snapshot.records[0]?.sourceText.length).toBeLessThan(EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS);
  });

  it('supports a normal persisted Builder state above the former 240-duty aggregate cap', () => {
    const duties = Array.from({ length: 241 }, (_, i) => `Prüft Vorgang Nummer ${i + 1}.`).join('\n');
    const snapshot = buildExperienceLocalizationSnapshot(cv([exp({
      description: duties,
      originalUserDescription: duties,
      canonicalDescription: duties,
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(duties),
    })]), 'es');
    expect(snapshot.ok).toBe(true);
    expect(snapshot.records).toHaveLength(241);
    expect(snapshot.missingRecords).toHaveLength(241);
  });

  it('fails closed for stale unbound legacy locale metadata after a manual text change', () => {
    const current = exp({
      description: 'Updated short text',
      originalUserDescription: 'PrÃ¼ft eingehende Anfragen und koordiniert Termine.',
      canonicalDescription: 'PrÃ¼ft eingehende Anfragen und koordiniert Termine.',
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: undefined,
    });
    expect(resolveExperienceSourceLocale(current)).toEqual({
      locale: null, resolution: 'ambiguous',
    });
  });

  it('does not treat original-text equality alone as locale-specific legacy evidence', () => {
    const current = exp({
      description: 'Q4 CRM KPI',
      originalUserDescription: 'Q4 CRM KPI',
      canonicalDescription: 'Q4 CRM KPI',
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: undefined,
    });
    expect(resolveExperienceSourceLocale(current)).toEqual({
      locale: null, resolution: 'ambiguous',
    });
  });

  it('enforces the shared canonical-text boundary without truncation', () => {
    const atMax = `A${'b'.repeat(EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS - 1)}`;
    const overMax = `${atMax}c`;
    const accepted = buildExperienceLocalizationSnapshot(cv([exp({
      description: atMax,
      originalUserDescription: atMax,
      canonicalDescription: atMax,
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(atMax),
    })]), 'es');
    expect(accepted.ok).toBe(true);
    expect(accepted.records[0]?.sourceText).toBe(atMax);

    const rejected = buildExperienceLocalizationSnapshot(cv([exp({
      description: overMax,
      originalUserDescription: overMax,
      canonicalDescription: overMax,
      descriptionSourceLocale: 'de',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(overMax),
    })]), 'es');
    expect(rejected.ok).toBe(false);
    expect(rejected.reason).toBe('experience_localization_source_text_too_long');
    expect(rejected.records).toHaveLength(0);
  });

  it('does not retain the silent 1,600-character route truncation', async () => {
    const fs = await import('node:fs');
    const route = fs.readFileSync('src/app/api/generate/route.ts', 'utf8');
    expect(route).not.toContain('sanitizeText(record.sourceText, 1600)');
    expect(route).toContain('EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS');
    expect(route).toContain('hashExperienceLocalizedSurfaceValue(record.sourceText) !== record.sourceClauseHash');
  });

  it('partitions physical batches by record count, canonical chars and UTF-8 bytes', () => {
    const atByteBoundary = [requestRecord('अ'.repeat(5_000), 1)];
    expect(validateExperienceLocalizationPhysicalBatch(atByteBoundary)).toEqual({
      ok: true, canonicalChars: 5_000, utf8Bytes: 15_000,
    });
    const aggregateOverflow = Array.from({ length: 6 }, (_, i) => requestRecord('x'.repeat(1_000), i));
    expect(validateExperienceLocalizationPhysicalBatch(aggregateOverflow)).toEqual({
      ok: false, reason: 'experience_localization_batch_payload_too_large',
    });
    const plan = partitionExperienceLocalizationRecords(aggregateOverflow);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.batches.map((batch) => batch.length)).toEqual([5, 1]);
    expect(EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS).toBe(5_000);
  });

  it('uses NFKC and whitespace canonical equality while material changes alter hashes', () => {
    const raw = 'Cafe\u0301\r\n  coordinates   requests';
    const canonical = 'Café coordinates requests';
    expect(canonicalizeExperienceLocalizationText(raw)).toBe(canonical);
    expect(hashExperienceSourceLocaleText(raw)).toBe(hashExperienceSourceLocaleText(canonical));
    expect(hashExperienceLocalizedSurfaceValue(raw)).toBe(hashExperienceLocalizedSurfaceValue(canonical));
    expect(hashExperienceLocalizedSurfaceValue(`${canonical} now`)).not.toBe(hashExperienceLocalizedSurfaceValue(canonical));
  });

  it('keeps the Experience textarea free of browser maxLength clipping', async () => {
    const fs = await import('node:fs');
    const builder = fs.readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    expect(builder).not.toContain('maxLength={EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS}');
    expect(builder).toContain('experienceDescriptionLocalizationLimitViolation(exp.description)');
  });
});
