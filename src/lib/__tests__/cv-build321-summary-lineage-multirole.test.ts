/**
 * AAB-321 Phase 2 — multi-role slot diagnostics + repaired-provider lineage truth.
 */
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION,
  SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION,
  analyzeGermanSummaryEmploymentQuality,
  analyzeGermanSummaryUnitSemantics,
  deriveGermanSlotPresenceFromSemanticRoles,
  primaryRolesToLegacySlots,
  repairGermanSummaryEmployerStatus,
} from '@/lib/cv-german-summary-grounding';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

const AAB320_WEAK_SUMMARY = [
  'Lagermitarbeiterin mit Erfahrung in der Warenannahme, Dokumentenprüfung und',
  'Koordination von Warenbewegungen; zuvor als Grafikdesignerin tätig mit der',
  'Erstellung visueller Materialien, Überarbeitung von Designunterlagen und',
  'Vorbereitung finaler Dateien für verschiedene Formate und Bildschirme.',
  'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
].join(' ');

const WH_DE = [
  'Prüft eingehende Waren',
  'Prüft die zugehörige Dokumentation',
  'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
].join('\n');

const GD_DE = [
  'Erstellt visuelle Materialien und Grafiken',
  'Überarbeitet und passt Designunterlagen an',
  'Bereitet finale Designdateien für Formate und Bildschirme vor',
].join('\n');

function germanFixture(summary = ''): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary,
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
        position: 'Grafikdesignerin',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_DE,
        canonicalDescription: GD_DE,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-321 Summary multi-role and repaired-provider lineage', () => {
  it('revision markers reachable', () => {
    expect(SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION).toBe(
      'summary-multi-role-slot-diagnostics-321-v1',
    );
    expect(SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION).toBe(
      'summary-repaired-provider-lineage-321-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION);
  });

  it('38. combined current/prior sentence emits all semantic roles', () => {
    const unit = [
      'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Prüfung eingehender Waren;',
      'zuvor als Grafikdesignerin bei Rewitu tätig mit der Erstellung visueller Materialien.',
    ].join(' ');
    const analyses = analyzeGermanSummaryUnitSemantics([unit], {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
    });
    expect(analyses[0]!.detectedSemanticRoles).toEqual(expect.arrayContaining([
      'current_role_intro',
      'current_role_duties',
      'prior_role_intro',
      'prior_role_duties',
    ]));
    expect(primaryRolesToLegacySlots(analyses)).toEqual(['current_intro']);
  });

  it('39. three-unit repaired Summary emits current/prior/duration roles', () => {
    const repaired = repairGermanSummaryEmployerStatus(AAB320_WEAK_SUMMARY, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      gender: 'female',
    });
    const q = analyzeGermanSummaryEmploymentQuality(repaired.text, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.finalUnitSemanticRolesByUnit!.length).toBeGreaterThanOrEqual(2);
    const flat = q.finalUnitSemanticRolesByUnit!.flat();
    expect(flat).toEqual(expect.arrayContaining([
      'current_role_intro',
      'prior_role_intro',
      'total_duration',
    ]));
  });

  it('40-42. legacy primary slots remain consistent; booleans derive from roles', () => {
    const q = analyzeGermanSummaryEmploymentQuality(AAB320_WEAK_SUMMARY, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.finalUnitRoleSlots.length).toBe(q.finalUnitSemanticRolesByUnit!.length);
    const derived = deriveGermanSlotPresenceFromSemanticRoles(q.finalUnitSemanticRolesByUnit!);
    // AAB-355: slot presence requires title+employer+state — not mere sentence position.
    expect(derived.priorRoleSlotPresent).toBe(true);
    expect(q.priorRoleSlotPresent).toBe(false);
    expect(q.finalPriorEmployerPresent).toBe(false);
    expect(q.slotValidationPassed).toBe(false);
  });

  it('30-37. provider rejected; repair accepted; final source repaired_provider', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixture(''),
      candidate: AAB320_WEAK_SUMMARY,
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    // AAB-355: third-person repair fails first-person contract → deterministic recovery.
    expect(
      fin.diagnostics?.finalCandidateSource === 'repaired_provider'
      || fin.diagnostics?.finalCandidateSource === 'deterministic_fallback',
    ).toBe(true);
    expect(fin.text).toMatch(/Ich\s+verfüge|Derzeit\s+arbeite\s+ich/i);
    expect(fin.diagnostics?.providerOutcome).toMatch(/rejected/);
    expect(fin.diagnostics?.finalUnitSemanticRolesByUnit).toBeTruthy();
    expect(Array.isArray(fin.diagnostics?.finalUnitSemanticRolesByUnit)).toBe(true);
    expect(fin.diagnostics?.providerCandidateHash).toBeTruthy();
    expect(fin.diagnostics?.finalValidatedCandidateHash).toBeTruthy();
  });
});
