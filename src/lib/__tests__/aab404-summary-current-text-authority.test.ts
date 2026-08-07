import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyCanonicalSummaryEdit,
  buildCanonicalSnapshotFromCv,
} from '@/lib/cv-canonical-snapshot';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import { countSummaryWords } from '@/lib/cv-summary-grounding';
import {
  resolveSummaryCurrentTextAuthority,
  SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION,
} from '@/lib/cv-summary-current-text-authority';
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
    // Device-equivalent current-text-bound Experience locale provenance.
    descriptionSourceLocale: 'es',
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(description),
  };
}

function deviceCv(): CVData {
  const staleContext = buildExperienceJobContext({
    position: 'Lagermitarbeiter',
    locale: 'de',
  });

  const base: CVData = {
    id: 'aab404-summary-current-text-device',
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
    summaryGeneratedLocale: 'de',
    summaryGenerationContextKey: staleContext.key,
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

describe('AAB-404 Summary current-text authority', () => {
  it('rebinds the device Summary after stale generated metadata and then performs bounded compaction', () => {
    expect(countSummaryWords(DEVICE_SUMMARY, 'es')).toBe(94);

    const raw = deviceCv();
    const before = structuredClone(raw);
    const prepared = prepareExportReadyCv(raw, 'es', 'modern-minimal', {
      referenceDate: REF,
    });

    expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
    if (!prepared.ok) return;

    const summary = prepared.cv.summary || '';
    const currentContext = buildExperienceJobContext({
      position: 'Mecánico de bicicletas',
      locale: 'es',
    });

    const diag = prepared.diagnostics as unknown as Record<string, unknown>;
    const preparedCv = prepared.cv as unknown as Record<string, unknown>;
    const debugSummaryAuthority = JSON.stringify({
      finalSummary: summary,
      finalSummaryOrigin: preparedCv.summaryOrigin,
      finalSummaryGeneratedLocale: preparedCv.summaryGeneratedLocale,
      finalSummaryGenerationContextKey: preparedCv.summaryGenerationContextKey,
      summaryInitialValid: diag.summaryInitialValid,
      summaryInitialReason: diag.summaryInitialReason,
      summaryRecoverySource: diag.summaryRecoverySource,
      summaryRecoveryReason: diag.summaryRecoveryReason,
      summaryStaleMetadataDetected: diag.summaryStaleMetadataDetected,
      summaryVisibleTextAuthorityRebound: diag.summaryVisibleTextAuthorityRebound,
      summaryVisibleTextAuthorityReason: diag.summaryVisibleTextAuthorityReason,
      summaryVisibleTextValidationReason: diag.summaryVisibleTextValidationReason,
      staleSummaryExcluded: diag.staleSummaryExcluded,
      summaryWordCountBefore: diag.summaryWordCountBefore,
      summaryWordCountAfter: diag.summaryWordCountAfter,
      summaryWordBudgetMax: diag.summaryWordBudgetMax,
      summaryFactSetSource: diag.summaryFactSetSource,
      summarySemanticDutyKeys: diag.summarySemanticDutyKeys,
    });

    expect(countSummaryWords(summary, 'es')).toBeLessThanOrEqual(90);
    expect(summary, debugSummaryAuthority).toContain('Mecánico de bicicletas');
    expect(summary).toContain('RadWerk');
    expect(summary).toContain('Recepcionista');
    expect(summary).toContain('StadtHotel');
    expect(summary).not.toMatch(/^professional\b/iu);
    expect(prepared.cv.summaryGenerationContextKey).toBe(currentContext.key);
    expect(prepared.cv.summaryGeneratedLocale).toBe('es');
    expect(prepared.diagnostics).toMatchObject({
      summaryInitialValid: false,
      summaryInitialReason: 'summary_too_long:94 words, maximum 90',
      summaryRecoverySource: 'bounded_saved_summary',
      summaryStaleMetadataDetected: true,
      summaryVisibleTextAuthorityRebound: true,
      summaryVisibleTextAuthorityReason: 'validated_current_text_over_stale_context',
      summaryVisibleTextValidationReason: 'summary_too_long:94 words, maximum 90',
      summaryCurrentTextAuthorityRevision:
        SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION,
      staleSummaryExcluded: false,
    });
    expect(raw).toEqual(before);
  });

  it('does not rebind stale metadata when the visible Summary fails real locale or grounding validation', () => {
    const decision = resolveSummaryCurrentTextAuthority({
      staleMetadataDetected: true,
      occupationalContentConflict: false,
      validation: {
        valid: false,
        reason: 'mixed_locale_summary',
        violations: ['mixed_locale_summary'],
      },
    });

    expect(decision).toMatchObject({
      staleMetadataDetected: true,
      rebound: false,
      onlyWordBudgetViolation: false,
      visibleTextValidationReason: 'mixed_locale_summary',
      revision: SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION,
    });
  });

  it('never lets a conflicting occupation Summary bypass the stale-context gate', () => {
    const decision = resolveSummaryCurrentTextAuthority({
      staleMetadataDetected: true,
      occupationalContentConflict: true,
      validation: {
        valid: false,
        reason: 'summary_too_long:94 words, maximum 90',
        violations: ['summary_too_long:94 words, maximum 90'],
      },
    });

    expect(decision.rebound).toBe(false);
  });

  it('clears AI generation metadata when the user edits the visible Summary', () => {
    const cv = deviceCv();
    const edited = applyCanonicalSummaryEdit(
      cv,
      `${DEVICE_SUMMARY} Texto revisado por la persona usuaria.`,
      'es',
    );

    expect(edited.summaryOrigin).toBe('user');
    expect(edited.summaryGeneratedLocale).toBeUndefined();
    expect(edited.summaryGenerationContextKey).toBeUndefined();
    expect(edited.contentLocale).toBe('es');
  });
});