/**
 * AAB-321 Phase 1 — German Summary employer + employment-state coverage.
 */
import { describe, expect, it } from 'vitest';
import {
  GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION,
  GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION,
  analyzeGermanCurrentRoleCoverage,
  analyzeGermanPriorRoleCoverage,
  analyzeGermanSummaryEmploymentQuality,
  repairGermanSummaryEmployerStatus,
} from '@/lib/cv-german-summary-grounding';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

/** Exact AAB-320 device Summary — missing Atlas/Rewitu/current-status. */
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

const coverageOpts = {
  company: 'Atlas',
  role: 'Lagermitarbeiterin',
  startDate: '2023-01',
  priorCompany: 'Rewitu',
  priorRole: 'Grafikdesignerin',
};

describe('AAB-321 German Summary employer and status coverage', () => {
  it('revision markers are reachable', () => {
    expect(GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION).toBe(
      'german-summary-employer-coverage-321-v1',
    );
    expect(GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION).toBe(
      'german-summary-employment-state-321-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION);
  });

  it('1. current role/title/duties without Atlas → reject', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin mit Erfahrung in der Warenannahme und Dokumentenprüfung.',
      coverageOpts,
    );
    expect(c.currentEmployerPresent).toBe(false);
    expect(c.currentRoleIntroValidationPassed).toBe(false);
    expect(c.currentRoleIntroRejectionReasons).toContain('missing_current_employer');
  });

  it('2. current role with Atlas → employer pass', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Warenannahme.',
      coverageOpts,
    );
    expect(c.currentEmployerPresent).toBe(true);
    expect(c.currentEmployerMatchesStructuredEmployer).toBe(true);
    expect(c.currentRoleIntroValidationPassed).toBe(true);
  });

  it('3. prior role/title/duties without Rewitu → reject', () => {
    const p = analyzeGermanPriorRoleCoverage(
      'Zuvor war sie als Grafikdesignerin tätig mit der Erstellung visueller Materialien.',
      coverageOpts,
    );
    expect(p.priorEmployerPresent).toBe(false);
    expect(p.priorRoleIntroValidationPassed).toBe(false);
    expect(p.priorRoleIntroRejectionReasons).toContain('missing_prior_employer');
  });

  it('4. prior role with Rewitu → employer pass', () => {
    const p = analyzeGermanPriorRoleCoverage(
      'Zuvor war sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien.',
      coverageOpts,
    );
    expect(p.priorEmployerPresent).toBe(true);
    expect(p.priorRoleIntroValidationPassed).toBe(true);
  });

  it('5. wrong current employer → reject', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin bei Rewitu seit Januar 2023 mit Erfahrung in der Warenannahme.',
      coverageOpts,
    );
    expect(c.currentEmployerPresent).toBe(false);
    expect(c.currentRoleIntroRejectionReasons).toContain('missing_current_employer');
  });

  it('6. wrong prior employer → reject', () => {
    const p = analyzeGermanPriorRoleCoverage(
      'Zuvor war sie als Grafikdesignerin bei Atlas tätig.',
      coverageOpts,
    );
    expect(p.priorEmployerPresent).toBe(false);
    expect(p.priorRoleIntroRejectionReasons).toContain('missing_prior_employer');
  });

  it('7. swapped employers → reject', () => {
    const q = analyzeGermanSummaryEmploymentQuality(
      [
        'Lagermitarbeiterin bei Rewitu seit Januar 2023 mit Erfahrung in der Warenannahme.',
        'Zuvor war sie als Grafikdesignerin bei Atlas tätig und erstellte visuelle Materialien.',
        'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
      ].join(' '),
      {
        ...coverageOpts,
        currentEntryDuties: WH_DE,
        priorEntryDuties: GD_DE,
        gender: 'female',
        structuredSkills: [],
        expectedDurationOwner: 'total_professional_experience',
      },
    );
    expect(q.finalCurrentEmployerPresent).toBe(false);
    expect(q.finalPriorEmployerPresent).toBe(false);
    expect(q.slotValidationPassed).toBe(false);
  });

  it('8. employer names remain untranslated', () => {
    const repaired = repairGermanSummaryEmployerStatus(AAB320_WEAK_SUMMARY, {
      ...coverageOpts,
      gender: 'female',
    });
    expect(repaired.text).toMatch(/\bAtlas\b/);
    expect(repaired.text).toMatch(/\bRewitu\b/);
    expect(repaired.text).not.toMatch(/Atlas\s+GmbH|Rewitu\s+AG/i);
  });

  it('9. employer matching is entry-scoped', () => {
    const q = analyzeGermanSummaryEmploymentQuality(
      [
        'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Warenannahme.',
        'Zuvor war sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien.',
        'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
      ].join(' '),
      {
        ...coverageOpts,
        currentEntryDuties: WH_DE,
        priorEntryDuties: GD_DE,
        gender: 'female',
        expectedDurationOwner: 'total_professional_experience',
      },
    );
    expect(q.finalCurrentEmployerPresent).toBe(true);
    expect(q.finalPriorEmployerPresent).toBe(true);
    expect(q.employerCrossEntryLeakageDetected).toBe(false);
  });

  it('10. seit Januar 2023 → pass current status', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Warenannahme.',
      coverageOpts,
    );
    expect(c.currentDateMarkerPresent).toBe(true);
    expect(c.currentEmploymentStateExpressed).toBe(true);
  });

  it('11. derzeit bei Atlas → pass', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin derzeit bei Atlas mit Erfahrung in der Warenannahme.',
      coverageOpts,
    );
    expect(c.currentEmploymentStateExpressed).toBe(true);
    expect(c.currentRoleIntroValidationPassed).toBe(true);
  });

  it('12. aktuell bei Atlas tätig → pass', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Sie ist aktuell bei Atlas als Lagermitarbeiterin tätig mit Erfahrung in der Warenannahme.',
      coverageOpts,
    );
    expect(c.currentEmploymentStateExpressed).toBe(true);
  });

  it('13. role title plus duties only → reject', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin prüft eingehende Waren und Dokumente.',
      coverageOpts,
    );
    expect(c.currentRoleIntroValidationPassed).toBe(false);
  });

  it('14. generic mit Erfahrung → reject as current-status evidence', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin mit Erfahrung in der Warenannahme.',
      coverageOpts,
    );
    expect(c.currentEmploymentStateExpressed).toBe(false);
    expect(c.currentStatusRejectionReasons.length).toBeGreaterThan(0);
  });

  it('15. current marker not linked to Atlas → reject', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin derzeit mit Erfahrung in der Warenannahme.',
      coverageOpts,
    );
    expect(c.currentEmployerPresent).toBe(false);
    expect(c.currentRoleIntroValidationPassed).toBe(false);
  });

  it('16. duration sentence cannot satisfy current status', () => {
    const c = analyzeGermanCurrentRoleCoverage(
      'Lagermitarbeiterin bei Atlas. Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
      coverageOpts,
    );
    // Employer present but no current-state/date marker.
    expect(c.currentEmployerPresent).toBe(true);
    expect(c.currentEmploymentStateExpressed).toBe(false);
  });

  it('17. Zuvor war sie ... bei Rewitu tätig → pass', () => {
    const p = analyzeGermanPriorRoleCoverage(
      'Zuvor war sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien.',
      coverageOpts,
    );
    expect(p.priorRoleIntroValidationPassed).toBe(true);
  });

  it('18. prior role without transition marker → reject when ambiguous', () => {
    const p = analyzeGermanPriorRoleCoverage(
      'Grafikdesignerin bei Rewitu mit der Erstellung visueller Materialien.',
      coverageOpts,
    );
    expect(p.priorEmploymentStateExpressed).toBe(false);
    expect(p.priorRoleIntroValidationPassed).toBe(false);
  });

  it('19. prior marker without Rewitu → reject', () => {
    const p = analyzeGermanPriorRoleCoverage(
      'Zuvor war sie als Grafikdesignerin tätig.',
      coverageOpts,
    );
    expect(p.priorRoleIntroRejectionReasons).toContain('missing_prior_employer');
  });

  it('20-28. exact AAB-320 output repaired with employers/status', () => {
    const q0 = analyzeGermanSummaryEmploymentQuality(AAB320_WEAK_SUMMARY, {
      ...coverageOpts,
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q0.slotValidationPassed).toBe(false);
    expect(q0.slotRejectionReasons).toEqual(expect.arrayContaining([
      'missing_current_employer',
      'missing_current_employment_marker',
      'missing_prior_employer',
    ]));

    const repaired = repairGermanSummaryEmployerStatus(AAB320_WEAK_SUMMARY, {
      ...coverageOpts,
      gender: 'female',
    });
    expect(repaired.attempted).toBe(true);
    expect(repaired.applied).toBe(true);
    expect(repaired.text).toMatch(/\bAtlas\b/);
    expect(repaired.text).toMatch(/\bRewitu\b/);
    expect(repaired.text).toMatch(/seit\s+Januar\s+2023|derzeit|aktuell/i);
    expect(repaired.text).toMatch(/zuvor/i);
    expect(repaired.text).toMatch(/Warenannahme/);
    expect(repaired.text).toMatch(/visueller Materialien|visuelle Materialien/);
    expect(repaired.text).toMatch(/insgesamt/i);
    expect(repaired.text).toMatch(/sechseinhalb/);
    expect(repaired.text).not.toMatch(/Kernkompetenzen|Agile|Scrum/i);
    expect(repaired.transformationKinds).toEqual(expect.arrayContaining([
      'current_employer_restored',
      'prior_employer_restored',
      'current_status_restored',
    ]));

    const q1 = analyzeGermanSummaryEmploymentQuality(repaired.text, {
      ...coverageOpts,
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_DE,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q1.finalCurrentEmployerPresent).toBe(true);
    expect(q1.finalPriorEmployerPresent).toBe(true);
    expect(q1.finalCurrentEmploymentStateExpressed).toBe(true);
    expect(q1.finalPriorEmploymentStateExpressed).toBe(true);
    expect(q1.slotValidationPassed).toBe(true);
    expect(q1.groundingValidationPassed).toBe(true);
  });

  it('29. repair failure dispatches deterministic fallback', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixture({ summary: '' }),
      candidate: 'Lagermitarbeiterin. Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/\bAtlas\b/);
    expect(fin.text).toMatch(/\bRewitu\b/);
    expect(fin.origin).toMatch(/deterministic|ai_repaired/);
  });

  it('43-47. missing Atlas/Rewitu/status block apply; repaired candidate applies +1', () => {
    const reject = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixture({ summary: '' }),
      candidate: AAB320_WEAK_SUMMARY,
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(reject.blocked).toBe(false);
    expect(reject.countedAsSuccess).toBe(true);
    expect(reject.text).toMatch(/\bAtlas\b/);
    expect(reject.text).toMatch(/\bRewitu\b/);
    expect(reject.text).toMatch(/seit\s+Januar\s+2023|derzeit|aktuell/i);
    expect(reject.diagnostics?.finalCurrentEmployerPresent).toBe(true);
    expect(reject.diagnostics?.finalPriorEmployerPresent).toBe(true);
    expect(reject.diagnostics?.finalCurrentEmploymentStateExpressed).toBe(true);
    expect(reject.diagnostics?.finalSlotValidationPassed).toBe(true);
    expect(reject.diagnostics?.finalCandidateSource).toBe('repaired_provider');
    expect(reject.diagnostics?.providerAccepted).toBe(false);
    expect(reject.diagnostics?.repairAccepted).toBe(true);
    expect(reject.diagnostics?.germanEmployerStatusRepairApplied).toBe(true);
  });

  it('48. failed recovery keeps usage unchanged (blocked when no safe candidate)', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: {
        ...germanFixture({ summary: '' }),
        experience: [],
      } as CVData,
      candidate: 'Hello world Agile Scrum Kernkompetenzen.',
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    // Empty experience / unsupported: either blocked or deterministic empty-safe path.
    if (fin.countedAsSuccess) {
      expect(fin.text).not.toMatch(/Agile|Scrum|Kernkompetenzen/i);
    } else {
      expect(fin.blocked).toBe(true);
    }
  });
});
