/**
 * AAB-315 Phase 2 — tense decision diagnostics, invariants, markers.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION,
  SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION,
  SPANISH_EXPERIENCE_FINAL_TENSE_ACCEPTANCE_315_REVISION,
  EXPERIENCE_TENSE_DECISION_DIAGNOSTICS_315_REVISION,
  analyzeExperienceVisibleSource,
} from '@/lib/cv-experience-visible-source-analysis';
import {
  SUMMARY_RUNTIME_MARKER_SET,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import {
  checkExperienceDiagnosticInvariants,
  checkExperienceDiagnosticCompleteness,
} from '@/lib/cv-ai-diagnostics-contract';
import type { CVData, WorkExperience } from '@/lib/types';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';

const REF = '2026-07-24';

const ATLAS_PAST = formatExperienceBullets([
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const ATLAS_PRESENT = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

function spanishFixture(desc: string): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: desc,
    originalUserDescription: desc,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  return {
    personal: {
      fullName: 'Test User',
      jobTitle: localizeWarehouseEmployee('es', 'female'),
      email: 't@example.com',
      phone: '',
      location: '',
      summary: '',
    },
    experience: [current],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
  };
}

describe('AAB-315 Phase 2 markers and runtime set', () => {
  it('keeps all four 315 markers in SUMMARY_RUNTIME_MARKER_SET', () => {
    for (const m of [
      EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION,
      SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION,
      SPANISH_EXPERIENCE_FINAL_TENSE_ACCEPTANCE_315_REVISION,
      EXPERIENCE_TENSE_DECISION_DIAGNOSTICS_315_REVISION,
    ]) {
      expect(SUMMARY_RUNTIME_MARKER_SET).toContain(m);
    }
  });
});

describe('AAB-315 Phase 2 diagnostics on provider-echo tense recovery', () => {
  it('populates source/provider/deterministic/final tense fields on success', () => {
    const cv = spanishFixture(ATLAS_PAST);
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: ATLAS_PAST,
      locale: 'es',
      requestId: 'req-315-diag',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: ATLAS_PAST,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(fin.countedAsSuccess).toBe(true);
    const d = fin.diagnostics!;
    expect(d.sourceAlreadyValidForTarget).toBe(false);
    expect(d.sourceTenseMismatchCount).toBe(3);
    expect(d.sourceTenseValidationPassed).toBe(false);
    expect(d.expectedEmploymentTense).toBe('present');
    expect(d.providerNoOpDetected).toBe(true);
    expect(d.providerNoOpBlockedBySourceDefect).toBe(true);
    expect(d.providerNoOpEligibleAsFinal).toBe(false);
    expect(d.deterministicTenseNormalizerAttempted).toBe(true);
    expect(d.deterministicTenseNormalizerProducedCandidate).toBe(true);
    expect(d.deterministicFixesSourceDefect).toBe(true);
    expect(d.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
    expect(d.canonicalAcceptancePassed).toBe(true);
    expect(d.finalDecisionKind).toBe('material_improvement');
    expect(d.tenseOnlyPreservationPassed).toBe(true);
    expect(Number(d.wrongTenseFixedUnitCount)).toBeGreaterThanOrEqual(1);

    const trace = {
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 2,
      marker: 'EXPERIENCE_AI_DIAG_V1',
      requestedLocale: 'es',
      operationMode: 'enhance_existing',
      field: 'experience_description',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 25,
      usageCountAfter: 26,
      selectedSourceKind: 'originalUserDescription',
      clickedExperienceEntryIdHash: 'h',
      visibleTextareaMatchesFinalNormalizedHash: true,
      visibleDescriptionMatchesFinalHash: true,
      finalNormalizedHash: 'h2',
      ...d,
    };
    const inv = checkExperienceDiagnosticInvariants(trace);
    expect(inv.passed).toBe(true);
    const comp = checkExperienceDiagnosticCompleteness(trace);
    expect(comp.passed).toBe(true);
  });

  it('populates source-defect fields on exact no-op of already-valid source', () => {
    const cv = spanishFixture(ATLAS_PRESENT);
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-315-noop-diag',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PRESENT,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: ATLAS_PRESENT,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.diagnostics?.sourceAlreadyValidForTarget).toBe(true);
    expect(fin.diagnostics?.sourceTenseMismatchCount).toBe(0);
    expect(fin.diagnostics?.providerNoOpEligibleAsFinal).toBe(true);
    expect(fin.diagnostics?.providerNoOpBlockedBySourceDefect).toBe(false);
  });

  it('invariant catches final noop before defect recovery', () => {
    const a = analyzeExperienceVisibleSource({
      visibleText: ATLAS_PAST,
      targetLocale: 'es',
      isPresent: true,
    });
    expect(a.sourceAlreadyValidForTarget).toBe(false);
    const inv = checkExperienceDiagnosticInvariants({
      requestedLocale: 'es',
      operationMode: 'enhance_existing',
      field: 'experience_description',
      sourceAlreadyValidForTarget: false,
      sourceTenseMismatchCount: 3,
      finalDecisionKind: 'exact_noop',
      deterministicTenseNormalizerAttempted: false,
      countedAsSuccess: false,
    });
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) =>
      f.invariantCode === 'final_noop_before_source_defect_recovery')).toBe(true);
  });
});
