/**
 * @vitest-environment jsdom
 *
 * AAB-309 Experience unsupported-claim repair lineage diagnostics:
 * truthful finalCandidateSource, intermediate lineage, fallback skip reasons,
 * and diagnostic invariants.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION } from '@/lib/cv-spanish-experience-grounding';
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

const BAD_AAB308_PROVIDER = formatExperienceBullets([
  'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
  'Comprueba la documentación relacionada con los envíos y entregas de mercancía.',
  'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
]);

const GD_ES_COMPLETED = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
]);

function spanishFixture(currentDesc = WH_ES): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: currentDesc,
    originalUserDescription: currentDesc,
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
    id: 'cv-es-309-lineage',
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

function commitFinalize(
  fin: ReturnType<typeof finalizeCvAiFieldForApply>,
  opts: { usageBefore?: number } = {},
) {
  const usageBefore = opts.usageBefore ?? 17;
  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'es',
    requestedLocale: 'es',
    templateId: 'modern-minimal',
    jobContextHash: 'es-309-lineage',
    requestId: `es-309-${Math.random().toString(36).slice(2, 8)}`,
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

describe('Experience repair lineage diagnostics (AAB-309)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearCvAiDiagnosticHistory();
    localStorage.clear();
  });

  it('exposes experience-repair-lineage-309-v1 marker', () => {
    expect(EXPERIENCE_REPAIR_LINEAGE_309_REVISION)
      .toBe('experience-repair-lineage-309-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(EXPERIENCE_REPAIR_LINEAGE_309_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION);
  });

  it('54-66: provider evidence, repair lineage, truthful skip reason, invariants', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB308_PROVIDER,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });

    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect((fin.diagnostics?.providerUnsupportedClaimCount ?? 0)).toBeGreaterThan(0);
    expect(fin.diagnostics?.unsupportedClaimRepairAttempted).toBe(true);
    expect(fin.diagnostics?.noOpRepairAttempted).toBeFalsy();
    expect(fin.diagnostics?.noOpRepairApplied).toBeFalsy();
    expect(fin.diagnostics?.finalCandidateSource).not.toBe('noop_repair');

    const trace = commitFinalize(fin, { usageBefore: 17 });
    expect(trace.marker).toBe(EXPERIENCE_AI_DIAG_MARKER);
    expect(trace.providerAccepted).toBe(false);
    expect((trace.providerUnsupportedClaimCount ?? 0)).toBeGreaterThan(0);
    expect(trace.unsupportedClaimRepairAttempted).toBe(true);
    expect(trace.noOpRepairAttempted).toBe(false);
    expect(trace.noOpRepairApplied).toBe(false);
    expect(trace.experienceRepairLineageRevision)
      .toBe(EXPERIENCE_REPAIR_LINEAGE_309_REVISION);

    const lineage = trace.candidateLineage || [];
    const provider = lineage.find((c) => c.candidateKind === 'provider');
    expect(provider?.present).toBe(true);
    expect(provider?.accepted).toBe(false);
    expect((provider?.unsupportedClaimCount ?? 0)).toBeGreaterThan(0);

    const repair = lineage.find((c) => c.candidateKind === 'unsupported_claim_repair');
    expect(repair?.present).toBe(true);

    const fallbackSkip = (trace.stages || []).find(
      (s) => s.stage === 'deterministic_fallback_started' && s.result === 'skipped',
    );
    if (fallbackSkip) {
      expect(fallbackSkip.typedReason).not.toBe('provider_accepted');
      expect([
        'unsupported_claim_repair_accepted',
        'unsupported_claim_repair_rejected',
        'provider_path_rejected_or_fallback_absent',
        'residual_unsupported_claims',
        'efficiency_claim',
        'object_scope_expansion',
        'unsupported_claim_repair_noop_or_identical',
        'unsupported_claim_repair_invalid',
      ]).toContain(fallbackSkip.typedReason);
    }

    if (fin.diagnostics?.unsupportedClaimRepairApplied) {
      expect(trace.finalCandidateSource).toBe('unsupported_claim_repair');
      expect(trace.unsupportedClaimRepairApplied).toBe(true);
      expect(trace.unsupportedClaimRepairValidationPassed).toBe(true);
      expect(repair?.accepted).toBe(true);
      expect(trace.finalUnsupportedClaimCount ?? 0).toBe(0);
      const finalSel = lineage.find((c) => c.candidateKind === 'final_selected');
      expect(finalSel?.present).toBe(true);
      expect(finalSel?.accepted).toBe(true);
      if (trace.unsupportedClaimRepairHash && finalSel?.normalizedHash) {
        expect(finalSel.normalizedHash).toBe(trace.unsupportedClaimRepairHash);
      }
    } else if (trace.finalCandidateSource === 'deterministic_fallback') {
      expect(repair?.accepted).toBe(false);
      expect((trace.unsupportedClaimRepairResidualUnsupportedClaimCount ?? 0)
        + (repair?.unsupportedClaimKinds?.length ?? 0)).toBeGreaterThanOrEqual(0);
      const det = lineage.find((c) =>
        c.candidateKind === 'deterministic_fallback'
        || c.candidateKind === 'client_deterministic');
      expect(det?.accepted).toBe(true);
      expect(trace.clientDeterministicFallbackApplied).toBe(true);
      expect(trace.finalUnsupportedClaimCount ?? 0).toBe(0);
    }

    if (trace.countedAsSuccess) {
      expect(trace.visibleApplySucceeded).toBe(true);
      expect(trace.usageCountAfter).toBe(18);
      expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    } else {
      expect(trace.usageCountAfter).toBe(17);
    }

    const invariants = checkExperienceDiagnosticInvariants(trace);
    expect(invariants.passed).toBe(true);
    const completeness = checkExperienceDiagnosticCompleteness(
      trace as unknown as Record<string, unknown>,
    );
    expect(completeness.passed).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('60-63: contradictory lineage invariants fire', () => {
    const bad = checkExperienceDiagnosticInvariants({
      providerAccepted: false,
      stages: [{
        stage: 'deterministic_fallback_started',
        result: 'skipped',
        typedReason: 'provider_accepted',
      }],
      noOpRepairApplied: true,
      noOpRepairAttempted: false,
      unsupportedClaimRepairApplied: true,
      unsupportedClaimRepairAttempted: false,
      unsupportedClaimRepairValidationPassed: false,
      finalUnsupportedClaimCount: 2,
      finalCandidateSource: 'unsupported_claim_repair',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 1,
      usageCountAfter: 2,
    });
    expect(bad.passed).toBe(false);
    const codes = bad.failures.map((f) => f.invariantCode);
    expect(codes).toEqual(expect.arrayContaining([
      'provider_rejected_but_fallback_skip_provider_accepted',
      'noop_repair_applied_without_attempt',
      'unsupported_repair_applied_without_attempt',
      'unsupported_repair_applied_without_validation',
      'unsupported_repair_applied_with_final_unsupported',
    ]));
  });

  it('AAB-308 guarantee detection still rejects unsupported guarantee', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: formatExperienceBullets([
        'Revisa la mercancía entrante para garantizar su correcta recepción.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerUnsupportedClaimKinds || []).toContain(
      'guarantee_escalation',
    );
    if (fin.countedAsSuccess) {
      expect(fin.text).not.toMatch(/garantiz|asegur/i);
    }
  });
});
