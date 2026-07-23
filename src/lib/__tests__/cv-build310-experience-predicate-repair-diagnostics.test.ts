/**
 * @vitest-environment jsdom
 *
 * AAB-310 Experience predicate repair diagnostics.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION } from '@/lib/cv-spanish-experience-grounding';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import {
  clearExperienceAiDiagnosticsForTests,
  clearExperienceAiDiagnostics,
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  checkExperienceDiagnosticCompleteness,
  checkExperienceDiagnosticInvariants,
  clearCvAiDiagnosticHistory,
  EXPERIENCE_AI_DIAG_MARKER,
} from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-19';

const WH_ES = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

const BAD_PROVIDER = formatExperienceBullets([
  'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
  'Comprueba y gestiona la documentación relacionada con los envíos y entregas de mercancía.',
  'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
]);

const GD_ES_COMPLETED = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
]);

function spanishFixture(): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_ES,
    originalUserDescription: WH_ES,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', 'female'),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: GD_ES_COMPLETED,
    originalUserDescription: GD_ES_COMPLETED,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  return {
    id: 'cv-es-310-diag',
    name: 'CV',
    personal: {
      fullName: 'Ana Test',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: current.position,
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'es',
    templateId: 'modern-minimal',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    hobbies: [],
    updatedAt: REF,
  };
}

function commitFinalize(fin: ReturnType<typeof finalizeCvAiFieldForApply>) {
  const usageBefore = 19;
  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'es',
    requestedLocale: 'es',
    templateId: 'modern-minimal',
    jobContextHash: 'es-310-pred',
    requestId: `es-310-${Math.random().toString(36).slice(2, 8)}`,
    usageCountBefore: usageBefore,
  });
  session.patch({
    selectedSourceKind: 'current_textarea',
    clickedExperienceEntryIdHash: 'fnv1a_atlas',
    detectedSourceLocale: 'es',
    stableEntryIdentityMatched: true,
  });
  session.recordFinalizeResult(fin);
  if (fin.blocked || !fin.countedAsSuccess) {
    session.recordVisibleApply(false, usageBefore);
  } else {
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: fin.text,
      finalNormalizedText: fin.text,
    });
  }
  return session.commit();
}

describe('Experience predicate repair diagnostics (AAB-310)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearCvAiDiagnosticHistory();
    localStorage.clear();
  });

  it('exposes experience-predicate-repair-lineage-310-v1', () => {
    expect(EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION)
      .toBe('experience-predicate-repair-lineage-310-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION);
  });

  it('53-62: predicate evidence, lineage, invariants for gestiona repair', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_PROVIDER,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect((fin.diagnostics?.candidateAddedPredicateCount ?? 0)).toBeGreaterThan(0);
    expect(fin.diagnostics?.unsupportedClaimRepairAttempted).toBe(true);
    expect(fin.diagnostics?.noOpRepairAttempted).toBeFalsy();
    expect(fin.diagnostics?.noOpRepairApplied).toBeFalsy();
    expect(fin.diagnostics?.providerUnsupportedClaimKinds || []).toEqual(
      expect.arrayContaining(['action_scope_expansion', 'document_management_expansion']),
    );

    const trace = commitFinalize(fin);
    expect(trace.marker).toBe(EXPERIENCE_AI_DIAG_MARKER);
    expect(trace.candidateAddedPredicateCount).toBeGreaterThan(0);
    expect(trace.experiencePredicateRepairLineageRevision)
      .toBe(EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION);
    expect(trace.unsupportedClaimRepairAttempted).toBe(true);
    expect(trace.noOpRepairApplied).toBe(false);

    const lineage = trace.candidateLineage || [];
    expect(lineage.find((c) => c.candidateKind === 'provider')?.accepted).toBe(false);
    expect(lineage.find((c) => c.candidateKind === 'unsupported_claim_repair')?.present)
      .toBe(true);

    if (fin.countedAsSuccess) {
      expect(fin.text).not.toMatch(/gestiona/i);
      expect(trace.finalUnsupportedClaimCount ?? 0).toBe(0);
      expect(trace.repairResidualAddedPredicateCount ?? 0).toBe(0);
      expect(trace.usageCountAfter).toBe(20);
    }

    expect(checkExperienceDiagnosticInvariants(trace).passed).toBe(true);
    expect(checkExperienceDiagnosticCompleteness(
      trace as unknown as Record<string, unknown>,
    ).passed).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('59: invariant catches accepted repair with residual predicates', () => {
    const bad = checkExperienceDiagnosticInvariants({
      unsupportedClaimRepairApplied: true,
      unsupportedClaimRepairAttempted: true,
      unsupportedClaimRepairValidationPassed: true,
      repairResidualAddedPredicateCount: 1,
      finalUnsupportedClaimCount: 0,
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 1,
      usageCountAfter: 2,
    });
    expect(bad.passed).toBe(false);
    expect(bad.failures.map((f) => f.invariantCode)).toContain(
      'unsupported_repair_applied_with_residual_predicates',
    );
  });
});
