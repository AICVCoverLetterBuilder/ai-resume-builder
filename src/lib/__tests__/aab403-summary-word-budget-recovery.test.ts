import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { buildCanonicalSnapshotFromCv } from '@/lib/cv-canonical-snapshot';
import { countSummaryWords } from '@/lib/cv-summary-grounding';
import {
  compactSavedSummaryNearWordBudget,
  SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION,
} from '@/lib/cv-summary-word-budget';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';

const REF = '2026-08-07';
const DEVICE_SUMMARY = [
  'Cuento con alrededor de tres años y medio de experiencia.',
  'Actualmente trabajo como Mecánico de bicicletas en RadWerk, donde realizo con rigor trabajos de mantenimiento en bicicletas, a la vez que reviso las bicicletas en busca de defectos técnicos y sustituyo las piezas defectuosas de las bicicletas.',
  'Anteriormente trabajé como Recepcionista en StadtHotel, donde recibí a los huéspedes de manera profesional en la recepción del hotel, registré y gestioné reservas, a la vez que realicé los cambios necesarios y atendí las consultas y preguntas de los huéspedes de forma competente y orientada al servicio.',
].join(' ');

function experience(
  id: string,
  company: string,
  position: string,
  duties: string[],
  dates: { start: string; end: string; present: boolean },
): WorkExperience {
  const description = duties.map((duty) => `- ${duty}`).join('\n');
  return {
    id,
    company,
    position,
    startDate: dates.start,
    endDate: dates.end,
    isPresent: dates.present,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
  };
}

function deviceCv(): CVData {
  const base: CVData = {
    id: 'aab403-summary-budget-device',
    name: 'John wayn',
    templateId: 'modern-minimal',
    region: 'EU',
    personal: {
      fullName: 'John wayn',
      email: 'john@example.test',
      phone: '337373737',
      address: 'xjdjdjxh',
      jobTitle: 'Mecánico de bicicletas',
      photoEnabled: false,
    },
    summary: DEVICE_SUMMARY,
    canonicalSummary: DEVICE_SUMMARY,
    summaryOrigin: 'deterministic_fallback',
    summaryGeneratedLocale: 'es',
    contentLocale: 'es',
    experience: [
      experience(
        'current',
        'RadWerk',
        'Mecánico de bicicletas',
        [
          'Realiza trabajos de mantenimiento en bicicletas.',
          'Revisa las bicicletas en busca de defectos técnicos.',
          'Sustituye las piezas defectuosas de las bicicletas.',
        ],
        { start: '2024-01', end: '', present: true },
      ),
      experience(
        'prior',
        'StadtHotel',
        'Recepcionista',
        [
          'Recibió a los huéspedes de manera profesional en la recepción del hotel.',
          'Registró y gestionó reservas y realizó los cambios necesarios.',
          'Atendió las consultas y preguntas de los huéspedes de forma competente.',
        ],
        { start: '2023-01', end: '2023-12', present: false },
      ),
    ],
    education: [],
    skills: [],
    certifications: [],
    languages: [{ name: 'Español', level: 'native' }],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    runtimeMigrationVersion: 3,
  };

  return {
    ...base,
    canonicalSnapshot: buildCanonicalSnapshotFromCv(base, {
      canonicalLocale: 'es',
      createdFrom: 'legacy_migration',
      revision: 1,
      state: 'valid',
    }),
  };
}

describe('AAB-403 Summary word-budget recovery', () => {
  it('minimally compacts the 94-word device Summary instead of collapsing to a generic shell', () => {
    expect(countSummaryWords(DEVICE_SUMMARY, 'es')).toBe(94);
    const raw = deviceCv();
    const before = structuredClone(raw);
    const prepared = prepareExportReadyCv(raw, 'es', 'modern-minimal', {
      referenceDate: REF,
    });

    expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
    if (!prepared.ok) return;

    const summary = prepared.cv.summary || '';
    const words = countSummaryWords(summary, 'es');
    expect(words).toBeLessThanOrEqual(90);
    expect(words).toBeGreaterThanOrEqual(85);
    expect(summary).toContain('Mecánico de bicicletas');
    expect(summary).toContain('RadWerk');
    expect(summary).toContain('Recepcionista');
    expect(summary).toContain('StadtHotel');
    expect(summary).toMatch(/atendí las consultas y preguntas de los huéspedes/iu);
    expect(summary).not.toMatch(/^professional\b/iu);
    expect(prepared.cv.summaryOrigin).toBe('deterministic_fallback');
    expect(prepared.diagnostics).toMatchObject({
      summaryInitialValid: false,
      summaryRecoverySource: 'bounded_saved_summary',
      summaryRecoveryReason: 'valid',
      summaryWordCountBefore: 94,
      summaryWordCountAfter: words,
      summaryWordBudgetMax: 90,
      summaryWordBudgetCompactionRevision:
        SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION,
    });
    expect(raw).toEqual(before);
  });

  it('does not perform a destructive near-budget trim when the overrun is large', () => {
    const summary = Array.from({ length: 120 }, (_, index) => `palabra${index + 1}`).join(' ');
    const compacted = compactSavedSummaryNearWordBudget({
      summary,
      locale: 'es',
      validate: () => true,
    });
    expect(compacted).toBeNull();
  });

  it('never drops a protected current or prior employer to satisfy the budget', () => {
    const summary = [
      ...Array.from({ length: 89 }, (_, index) => `dato${index + 1}`),
      'RadWerk',
      'y',
      'StadtHotel',
    ].join(' ');
    expect(countSummaryWords(summary, 'es')).toBe(92);
    const compacted = compactSavedSummaryNearWordBudget({
      summary,
      locale: 'es',
      protectedPhrases: ['RadWerk', 'StadtHotel'],
      validate: () => true,
    });
    expect(compacted).toBeNull();
  });
});