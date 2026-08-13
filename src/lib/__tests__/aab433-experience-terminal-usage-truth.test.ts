/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import {
  checkExperienceDiagnosticInvariants,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  EXPERIENCE_TERMINAL_USAGE_TRUTH_433_REVISION,
  type ExperienceAiDiagnosticTrace,
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import type { CVData, WorkExperience } from '@/lib/types';

function session(usageCountBefore = 22): ExperienceAiDiagnosticSession {
  return new ExperienceAiDiagnosticSession({
    uiLocale: 'hi',
    requestedLocale: 'hi',
    contentLocale: 'hi',
    templateId: 'modern',
    gender: 'female',
    requestId: 'aab433-terminal-usage',
    usageCountBefore,
    jobContextHash: 'aab433-job-context',
  });
}

function authorizeCommittedApply(
  s: ExperienceAiDiagnosticSession,
  finalCandidateSource = 'provider',
): void {
  s.patch({
    applyAuthorized: true,
    applyWriteSucceeded: true,
    applyCommitted: true,
    finalCandidateSource,
    finalNormalizedHash: 'fnv1a_final',
    canonicalExperienceDecisionAllowsApply: true,
    canonicalExperienceDecisionAllowsUsage: true,
    finalVisibleDecisionAcceptedForApply: true,
    finalDecisionKind: 'material_improvement',
    materialImprovementDetected: true,
    semanticNoOpDetected: false,
  });
}

describe('AAB-433 Experience terminal usage diagnostic truth', () => {
  it('serializes Spanish guarantee rejection, repair revalidation, and final +0 truth', () => {
    const source = formatExperienceBullets([
      'Revisa la mercancía entrante',
      'Comprueba la documentación relacionada',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
    ]);
    const candidate = formatExperienceBullets([
      'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
      'Comprueba la documentación relacionada con los envíos y entregas de mercancía.',
      'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
    ]);
    const experience: WorkExperience = {
      id: 'exp-atlas', company: 'Atlas', position: 'Empleado de almacén',
      startDate: '2023-01', endDate: '', isPresent: true, description: source,
      originalUserDescription: source, descriptionOrigin: 'user', contentLocale: 'es',
    } as WorkExperience;
    const prior: WorkExperience = {
      id: 'exp-rewitu', company: 'Rewitu', position: 'Diseñadora gráfica',
      startDate: '2020-01', endDate: '2022-12', isPresent: false,
      description: formatExperienceBullets([
        'Creó materiales visuales y elementos gráficos',
        'Revisó y adaptó materiales de diseño',
        'Preparó archivos finales de diseño para distintos formatos y pantallas',
      ]),
      originalUserDescription: formatExperienceBullets([
        'Creó materiales visuales y elementos gráficos',
        'Revisó y adaptó materiales de diseño',
        'Preparó archivos finales de diseño para distintos formatos y pantallas',
      ]),
      descriptionOrigin: 'user', contentLocale: 'es',
    } as WorkExperience;
    const cv: CVData = {
      id: 'cv-es-433', name: 'CV', summary: '', contentLocale: 'es',
      templateId: 'modern-minimal', region: 'EU',
      createdAt: '2026-07-19', updatedAt: '2026-07-19',
      personal: { fullName: 'Ana', email: 'ana@example.com', phone: '', address: '',
        jobTitle: experience.position, gender: 'female', photoEnabled: false },
      experience: [experience, prior], education: [], skills: [], certifications: [], languages: [],
    };
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description', requestedLocale: 'es',
      gender: 'female', cv, candidate, experienceId: experience.id, referenceDateIso: '2026-07-19',
    });
    const diagnostics = result.diagnostics!;
    expect(diagnostics.providerAccepted).toBe(false);
    expect(diagnostics.providerRejectionStage).toBe('unsupported_claim_validation');
    expect(diagnostics.providerUnsupportedClaimKinds).toContain('guarantee_escalation');
    expect(diagnostics.unsupportedClaimRepairAttempted).toBe(true);
    // A repair attempt is always fully revalidated. This fixture remains
    // The repaired surface is fully revalidated, but it is semantically the
    // same as source. The existing Spanish contract must terminalize that as a
    // no-op rather than create a false paid apply.
    expect(diagnostics.unsupportedClaimRepairValidationPassed).toBe(true);
    expect(diagnostics.finalCandidateSource).toBe('none');
    expect(result.countedAsSuccess).toBe(false);

    const s = session();
    s.patch({
      providerAccepted: diagnostics.providerAccepted,
      providerRejectionStage: diagnostics.providerRejectionStage,
      providerUnsupportedClaimKinds: diagnostics.providerUnsupportedClaimKinds,
      unsupportedClaimRepairAttempted: diagnostics.unsupportedClaimRepairAttempted,
      unsupportedClaimRepairValidationPassed: diagnostics.unsupportedClaimRepairValidationPassed,
      finalCandidateSource: diagnostics.finalCandidateSource,
      applyAuthorized: false, applyWriteSucceeded: false, applyCommitted: false,
      canonicalExperienceDecisionAllowsApply: false,
      canonicalExperienceDecisionAllowsUsage: false,
      finalVisibleDecisionAcceptedForApply: false,
      finalNormalizedHash: 'es433-final',
    });
    s.recordVisibleApply(false, 22);
    const trace = s.commit();
    expect(trace.shouldIncrementUsage).toBe(false);
    expect(trace.usageIncrementAttempted).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountAfter).toBe(22);
  });

  it.each(['provider', 'repair', 'deterministic_fallback'])(
    '%s successful path serializes the actual committed +1 as the single terminal usage result',
    (finalCandidateSource) => {
    const s = session();
    authorizeCommittedApply(s, finalCandidateSource);
    s.recordVisibleApply(true, 23, {
      visibleDescription: 'पहला सुरक्षित कर्तव्य।',
      finalNormalizedText: 'पहला सुरक्षित कर्तव्य।',
    });
    const trace = s.commit();

    expect(trace.shouldIncrementUsage).toBe(true);
    expect(trace.usageIncrementAttempted).toBe(true);
    expect(trace.usageCountBefore).toBe(22);
    expect(trace.usageCountAfter).toBe(23);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.experienceTerminalUsageTruthRevision)
      .toBe(EXPERIENCE_TERMINAL_USAGE_TRUTH_433_REVISION);
    },
  );

  const rejectedTerminalCases: Array<[string, Partial<ExperienceAiDiagnosticTrace>]> = [
    ['semantic no-op', { semanticNoOpDetected: true, finalDecisionKind: 'semantic_noop' }],
    ['invalid candidate', { finalDecisionKind: 'invalid_candidate_rejected' }],
    ['rollback', { applyCommitted: false, applyWriteSucceeded: false }],
    ['race rejection', { raceGuardResult: 'fail' }],
  ];

  it.each(rejectedTerminalCases)('%s terminalizes false and +0', (_name, patch) => {
    const s = session();
    s.patch(patch);
    s.recordVisibleApply(false, 22);
    const trace = s.commit();

    expect(trace.shouldIncrementUsage).toBe(false);
    expect(trace.usageIncrementAttempted).toBe(false);
    expect(trace.usageCountAfter).toBe(22);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.visibleApplySucceeded).toBe(false);
  });

  it('fails closed when a successful terminal record contradicts usage truth', () => {
    const s = session();
    authorizeCommittedApply(s);
    s.recordVisibleApply(true, 23, {
      visibleDescription: 'पहला सुरक्षित कर्तव्य।',
      finalNormalizedText: 'पहला सुरक्षित कर्तव्य।',
    });
    const trace = s.commit();
    const invalid = {
      ...trace,
      shouldIncrementUsage: false,
      usageIncrementAttempted: false,
    };
    const result = checkExperienceDiagnosticInvariants(invalid);
    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.invariantCode))
      .toContain('terminal_usage_success_not_incremented');
  });

  it('is idempotent: a second terminal commit cannot bill again', () => {
    const s = session();
    authorizeCommittedApply(s);
    s.recordVisibleApply(true, 23, {
      visibleDescription: 'पहला सुरक्षित कर्तव्य।',
      finalNormalizedText: 'पहला सुरक्षित कर्तव्य।',
    });
    const first = s.commit();
    const second = s.commit();
    expect(second).toBe(first);
    expect(second.usageCountAfter).toBe(23);
    expect(second.shouldIncrementUsage).toBe(true);
  });
});
