/**
 * AAB-323 Phase 2 — repair/fallback diagnostic truth + visible duty gates.
 */
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION,
  checkSummaryDiagnosticInvariants,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

const AAB322_BAD = [
  'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in die Abstimmung',
  'der Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen. Zuvor war',
  'sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien,',
  'überarbeitete Designunterlagen und bereitete finale Dateien für verschiedene',
  'Formate und Bildschirme vor. Insgesamt verfügt sie über etwa sechseinhalb Jahre',
  'Berufserfahrung.',
].join(' ');

const WH_DE = [
  'Prüft eingehende Waren',
  'Prüft die zugehörige Dokumentation',
  'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
].join('\n');

const GD_ES = [
  'Crea materiales visuales y gráficos',
  'Revisa y adapta documentos de diseño',
  'Prepara archivos de diseño finales para formatos y pantallas',
].join('\n');

function germanFixture(): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'atlas',
        position: 'Lagermitarbeiterin',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_DE,
        canonicalDescription: WH_DE,
      },
      {
        id: 'rewitu',
        position: 'Diseñadora gráfica',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_ES,
        canonicalDescription: GD_ES,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-323 repair and fallback diagnostic truth', () => {
  it('marker reachable', () => {
    expect(SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION).toBe(
      'summary-repair-selection-truth-323-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION);
  });

  it('33-38. rejected repair + deterministic selection keeps repairApplied false', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixture(),
      candidate: AAB322_BAD,
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.repairApplied).toBe(false);
    expect(fin.diagnostics?.repairSelected).toBe(false);
    expect(fin.diagnostics?.repairAccepted).toBe(false);
    expect(fin.diagnostics?.deterministicAccepted).toBe(true);
    expect(fin.diagnostics?.fallbackApplied).toBe(true);
    expect(fin.diagnostics?.summaryRepairApplied).toBe(false);
    expect(fin.diagnostics?.repairAcceptedTransformationKinds || []).toEqual([]);
    expect(fin.diagnostics?.repairAppliedTransformationKinds || []).toEqual([]);
    // Attempted transformations may be non-empty if repair logic ran.
    expect(Array.isArray(fin.diagnostics?.repairAttemptedTransformationKinds)
      || fin.diagnostics?.repairTransformationKinds == null
      || Array.isArray(fin.diagnostics?.repairTransformationKinds)).toBe(true);
  });

  it('invariants: repairApplied with deterministic source fails', () => {
    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'de',
      finalCandidateSource: 'deterministic_fallback',
      repairApplied: true,
      repairSelected: false,
      countedAsSuccess: true,
    } as never);
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) =>
      f.invariantCode === 'deterministic_forbids_repair_applied')).toBe(true);
  });

  it('invariants: concrete coverage must equal covered duty facts', () => {
    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'de',
      currentRoleConcreteFactCoverage: 3,
      coveredCurrentDutyFactCount: 1,
      countedAsSuccess: false,
    } as never);
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) =>
      f.invariantCode === 'concrete_coverage_must_equal_covered_duty_facts')).toBe(true);
  });
});
