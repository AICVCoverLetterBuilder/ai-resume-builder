/**
 * AAB-320 Phase 1 — German Summary recovery dispatch + multi-signal role slots.
 * Exact AAB-319 device failure must recover deterministically with apply +1.
 */
import { describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import {
  GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION,
  GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION,
  analyzeGermanSummaryEmploymentQuality,
  analyzeGermanSummaryUnitSemantics,
  buildGermanEntryOwnedSummary,
  primaryRolesToLegacySlots,
  splitGermanSummaryUnits,
} from '@/lib/cv-german-summary-grounding';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

/** Provider text shaped like the AAB-319 device failure: current+prior mixed
 *  with a skills-labeled unit and total duration, but slots misclassified under
 *  the old exclusive heuristic. */
const AAB319_PROVIDER_MISCLASSIFIED = [
  'Lagermitarbeiterin bei Atlas seit Januar 2023, zuständig für die Prüfung',
  'eingehender Waren und der zugehörigen Dokumentation sowie die Koordination mit',
  'Kollegen bei der Vorbereitung und dem Transport von Waren.',
  'Zuvor war sie als Grafikdesignerin bei Rewitu tätig, wo sie visuelle Materialien',
  'erstellte, Designunterlagen überarbeitete und finale Dateien für verschiedene',
  'Formate aufbereitete.',
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

function germanFixture(overrides: {
  summary?: string;
  gender?: string;
  skills?: string[];
} = {}): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: overrides.gender || 'female',
    },
    summary: overrides.summary ?? '',
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
    skills: (overrides.skills || []).map((name) => ({ name })),
    languages: [],
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-320 German Summary recovery and role slots', () => {
  it('revision markers are reachable in runtime marker set', () => {
    expect(GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION).toBe(
      'german-summary-recovery-dispatch-320-v1',
    );
    expect(GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION).toBe(
      'german-summary-role-slot-classifier-320-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION);
  });

  it('classifies current role + duties in one sentence with seit/zuständig', () => {
    const unit = 'Lagermitarbeiterin bei Atlas seit Januar 2023, zuständig für die Prüfung eingehender Waren und der zugehörigen Dokumentation sowie die Koordination mit Kollegen bei der Vorbereitung und dem Transport von Waren.';
    const analyses = analyzeGermanSummaryUnitSemantics([unit], {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
    });
    expect(analyses[0]!.detectedSemanticRoles).toContain('current_role_intro');
    expect(analyses[0]!.detectedSemanticRoles).toContain('current_role_duties');
    expect(analyses[0]!.primaryRole).toBe('current_role_intro');
    expect(primaryRolesToLegacySlots(analyses)).toEqual(['current_intro']);
  });

  it('classifies prior role with Zuvor war sie', () => {
    const unit = 'Zuvor war sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien, überarbeitete Designunterlagen und bereitete finale Dateien für verschiedene Formate und Bildschirme vor.';
    const analyses = analyzeGermanSummaryUnitSemantics([unit], {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
    });
    expect(analyses[0]!.detectedSemanticRoles).toContain('prior_role_intro');
    expect(analyses[0]!.detectedSemanticRoles).toContain('prior_role_duties');
    expect(primaryRolesToLegacySlots(analyses)).toEqual(['prior_role']);
  });

  it('keeps current-role primary when employment sentence overlaps skill lexicon', () => {
    const unit = 'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Prüfung eingehender Waren und der zugehörigen Dokumentation sowie in der Koordination der Vorbereitung und Bewegung von Waren.';
    const analyses = analyzeGermanSummaryUnitSemantics([unit], {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
    });
    expect(analyses[0]!.primaryRole).toBe('current_role_intro');
    expect(analyses[0]!.primaryRole).not.toBe('explicit_skills');
  });

  it('multi-role mixed unit retains both current and prior semantic roles', () => {
    const unit = [
      'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Prüfung eingehender Waren.',
      'Zuvor war sie als Grafikdesignerin bei Rewitu tätig.',
    ].join(' ');
    // Treat as one compound unit to simulate provider merge.
    const analyses = analyzeGermanSummaryUnitSemantics([unit], {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
    });
    expect(analyses[0]!.detectedSemanticRoles).toContain('current_role_intro');
    expect(analyses[0]!.detectedSemanticRoles).toContain('prior_role_intro');
    expect(analyses[0]!.primaryRole).toBe('current_role_intro');
  });

  it('employment quality marks current intro/duty and prior for deterministic builder', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'etwa sechseinhalb Jahre',
      dutyFacts: [
        { value: 'Prüft eingehende Waren', sourceText: 'Prüft eingehende Waren' },
        { value: 'Prüft die zugehörige Dokumentation', sourceText: 'Prüft die zugehörige Dokumentation' },
        {
          value: 'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
          sourceText: 'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
        },
      ],
      priorRole: 'Grafikdesignerin',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_DE,
    });
    const q = analyzeGermanSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      gender: 'female',
      structuredSkills: [],
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.currentIntroSlotPresent).toBe(true);
    expect(q.currentDutySlotPresent).toBe(true);
    expect(q.priorRoleSlotPresent).toBe(true);
    expect(q.totalDurationSlotPresent).toBe(true);
    expect(q.slotValidationPassed).toBe(true);
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(3);
    expect(q.slotRejectionReasons).toEqual([]);
  });

  it('exact AAB-319 empty Summary: recoverable provider rejection → deterministic apply +1', () => {
    // Provider omits current Atlas role entirely — recoverable via deterministic rebuild.
    const providerMissingCurrent = [
      'Zuvor war sie als Grafikdesignerin bei Rewitu tätig, wo sie visuelle Materialien',
      'erstellte, Designunterlagen überarbeitete und finale Dateien für verschiedene',
      'Formate aufbereitete.',
      'Zu ihren Kernkompetenzen zählen Führung, Organisation und Kommunikation.',
      'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
    ].join(' ');
    const cv = germanFixture({ summary: '', skills: [] });
    const result = finalizeCvAiFieldForApply({
      field: 'summary',
      action: 'summary_generate',
      candidate: providerMissingCurrent,
      cv,
      requestedLocale: 'de',
      gender: 'female',
      referenceDateIso: REF,
      originHint: 'ai_generated',
    });
    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    expect(result.origin).toBe('deterministic_fallback');
    expect(result.text).toMatch(/Lagermitarbeiterin/i);
    expect(result.text).toMatch(/Atlas/i);
    expect(result.text).toMatch(/Rewitu/i);
    expect(result.text).toMatch(/Grafikdesignerin/i);
    if (!summaryV2ModeActive()) {
      if (!summaryV2ModeActive()) {
      expect(result.text).toMatch(/insgesamt/i);
    } else {
      expect(result.text).toMatch(/Erfahrung|Jahre|Atlas|Ich/i);
    }
    } else {
      expect(result.text).toMatch(/Erfahrung|Jahre|Atlas|Ich/i);
    }
    expect(result.text).not.toMatch(/Kernkompetenzen|Führung/i);
    const d = result.diagnostics || {};
    expect(d.providerRejectionReason || d.providerTypedRejectionReason).toBeTruthy();
    expect(
      (d.providerSlotRejectionReasons as string[] | undefined)?.length
      || (d.slotRejectionReasons as string[] | undefined)?.length
      || d.providerRejectionReason,
    ).toBeTruthy();
    expect(d.clientDeterministicFallbackAttempted || d.deterministicCandidatePresent).toBe(true);
    expect(d.clientDeterministicFallbackApplied || d.clientFallbackUsed).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(d.currentIntroSlotPresent).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(d.currentDutySlotPresent).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(d.priorRoleSlotPresent).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(d.totalDurationSlotPresent).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(d.slotValidationPassed).toBe(true);
    }
  });

  it('provider with current+prior+duration now classifies current slots (AAB-319 slot bug fixed)', () => {
    const q = analyzeGermanSummaryEmploymentQuality(AAB319_PROVIDER_MISCLASSIFIED, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      gender: 'female',
      structuredSkills: [],
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.currentIntroSlotPresent).toBe(true);
    expect(q.currentDutySlotPresent).toBe(true);
    expect(q.priorRoleSlotPresent).toBe(true);
    expect(q.totalDurationSlotPresent).toBe(true);
    expect(q.slotValidationPassed).toBe(true);
    expect(q.finalUnitRoleSlots).toContain('current_intro');
    expect(q.currentEmploymentIntroductionCount).toBeGreaterThanOrEqual(1);
    expect(q.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(3);
  });

  it('missing current intro rejects candidate with typed slot reasons', () => {
    const text = [
      'Zuvor war sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien.',
      'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
    ].join(' ');
    const q = analyzeGermanSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      structuredSkills: [],
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.slotValidationPassed).toBe(false);
    expect(q.slotRejectionReasons.length).toBeGreaterThan(0);
    expect(q.slotRejectionReasons).toContain('missing_current_role_intro');
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.typedRejectionReason).toBeTruthy();
  });

  it('skills introducer cannot override exact employer/title match', () => {
    const unit = 'Lagermitarbeiterin bei Atlas seit Januar 2023. Zu ihren Kernkompetenzen zählen Organisation.';
    const units = splitGermanSummaryUnits(unit);
    const analyses = analyzeGermanSummaryUnitSemantics(units, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
    });
    const current = analyses.find((a) => a.employerEntryMatches || a.roleTitleEntryMatches);
    expect(current).toBeTruthy();
    expect(current!.primaryRole).toBe('current_role_intro');
  });

  it('provider valid path: no deterministic fallback when slots pass', () => {
    const good = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'etwa sechseinhalb Jahre',
      dutyFacts: [
        { value: 'Prüft eingehende Waren', sourceText: 'Prüft eingehende Waren' },
        { value: 'Prüft die zugehörige Dokumentation', sourceText: 'Prüft die zugehörige Dokumentation' },
        {
          value: 'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
          sourceText: 'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
        },
      ],
      priorRole: 'Grafikdesignerin',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_DE,
    });
    const cv = germanFixture({ summary: '', skills: [] });
    const result = finalizeCvAiFieldForApply({
      field: 'summary',
      candidate: good,
      cv,
      requestedLocale: 'de',
      gender: 'female',
      referenceDateIso: REF,
      originHint: 'ai_generated',
    });
    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(result.origin).not.toBe('deterministic_fallback');
    }
    expect(result.diagnostics?.clientDeterministicFallbackApplied).toBeFalsy();
  });
});
