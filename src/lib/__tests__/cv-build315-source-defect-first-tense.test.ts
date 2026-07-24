/**
 * AAB-315 — source-defect-first Spanish Experience tense recovery.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  analyzeExperienceVisibleSource,
  providerNoOpEligibleAsFinal,
  providerUnresolvedSourceDefectReason,
  EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION,
  SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION,
  SPANISH_EXPERIENCE_FINAL_TENSE_ACCEPTANCE_315_REVISION,
  EXPERIENCE_TENSE_DECISION_DIAGNOSTICS_315_REVISION,
} from '@/lib/cv-experience-visible-source-analysis';
import {
  finalizeSpanishExperienceCandidateConservatively,
  decideSpanishExperienceFinalCandidate,
} from '@/lib/cv-experience-canonical-finalization';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import type { CVData, WorkExperience } from '@/lib/types';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';

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

const REWITU_PRESENT = formatExperienceBullets([
  'Crea materiales visuales y elementos gráficos.',
  'Revisa y adapta materiales de diseño.',
  'Prepara archivos finales para distintos formatos y pantallas.',
]);

const REWITU_PAST = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos.',
  'Revisó y adaptó materiales de diseño.',
  'Preparó archivos finales para distintos formatos y pantallas.',
]);

function spanishFixture(opts: {
  currentDesc: string;
  originalDesc?: string;
  isPresent?: boolean;
  provenance?: ReturnType<typeof buildExperienceAiOutputProvenance>;
}): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: opts.isPresent !== false,
    description: opts.currentDesc,
    originalUserDescription: opts.originalDesc ?? opts.currentDesc,
    descriptionOrigin: opts.provenance ? 'ai_generated' : 'user',
    contentLocale: 'es',
    aiOutputProvenance: opts.provenance,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', 'female'),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: REWITU_PAST,
    originalUserDescription: REWITU_PAST,
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
    experience: [current, prior],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    contentLocale: 'es',
  };
}

describe('AAB-315 markers', () => {
  it('exports packaging markers', () => {
    expect(EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION).toBe(
      'experience-source-defect-first-decision-315-v1',
    );
    expect(SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION).toBe(
      'spanish-experience-provider-noop-tense-recovery-315-v1',
    );
    expect(SPANISH_EXPERIENCE_FINAL_TENSE_ACCEPTANCE_315_REVISION).toBe(
      'spanish-experience-final-tense-acceptance-315-v1',
    );
    expect(EXPERIENCE_TENSE_DECISION_DIAGNOSTICS_315_REVISION).toBe(
      'experience-tense-decision-diagnostics-315-v1',
    );
  });
});

describe('AAB-315 source-defect analysis before no-op', () => {
  it('detects three past units as invalid for current role', () => {
    const a = analyzeExperienceVisibleSource({
      visibleText: ATLAS_PAST,
      targetLocale: 'es',
      isPresent: true,
    });
    expect(a.sourceLocale).toBe('es');
    expect(a.sourcePredicateIdentityCount).toBe(3);
    expect(a.expectedEmploymentTense).toBe('present');
    expect(a.sourceDetectedTense).toBe('past');
    expect(a.sourcePastUnitCount).toBe(3);
    expect(a.sourcePresentUnitCount).toBe(0);
    expect(a.tenseMismatchCount).toBe(3);
    expect(a.tenseMismatchUnitHashes.length).toBe(3);
    expect(a.sourceTenseValidationPassed).toBe(false);
    expect(a.sourceAlreadyValidForTarget).toBe(false);
    expect(a.correctableDefectKinds).toContain('wrong_tense');
    expect(providerNoOpEligibleAsFinal(a)).toBe(false);
    expect(providerUnresolvedSourceDefectReason(a)).toBe('unresolved_wrong_tense');
  });

  it('marks already-correct present source as valid for current role', () => {
    const a = analyzeExperienceVisibleSource({
      visibleText: ATLAS_PRESENT,
      targetLocale: 'es',
      isPresent: true,
    });
    expect(a.tenseMismatchCount).toBe(0);
    expect(a.sourceAlreadyValidForTarget).toBe(true);
    expect(providerNoOpEligibleAsFinal(a)).toBe(true);
  });
});

describe('AAB-315 provider exact match cannot bypass tense defect', () => {
  it('conservative path: identical past provider still yields present correction', () => {
    const result = finalizeSpanishExperienceCandidateConservatively({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PAST,
      providerCandidateText: ATLAS_PAST,
      isPresent: true,
    });
    expect(result.decision.shouldApply).toBe(true);
    expect(result.decision.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
    expect(result.decision.selectedText).toContain('Revisa la mercancía entrante en el almacén.');
    expect(result.decision.selectedText).toContain('Comprueba la documentación');
    expect(result.decision.selectedText).toContain('Coordina con sus compañeros');
    expect(result.decision.tenseOnlyPreservationPassed).toBe(true);
    expect(result.decision.canonicalAcceptancePassed).toBe(true);
  });

  it('end-to-end finalize: provider echo of past source applies tense fix +1', () => {
    const cv = spanishFixture({ currentDesc: ATLAS_PAST, isPresent: true });
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: ATLAS_PAST,
      locale: 'es',
      requestId: 'req-315-atlas',
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
    expect(fin.text).toContain('Revisa la mercancía entrante en el almacén.');
    expect(fin.text).toContain('Comprueba la documentación asociada a la mercancía recibida.');
    expect(fin.text).toContain('Coordina con sus compañeros la preparación y el movimiento de la mercancía.');
    expect(fin.diagnostics?.providerNoOpDetected).toBe(true);
    expect(fin.diagnostics?.providerNoOpBlockedBySourceDefect).toBe(true);
    expect(fin.diagnostics?.providerNoOpEligibleAsFinal).toBe(false);
    expect(fin.diagnostics?.sourceAlreadyValidForTarget).toBe(false);
    expect(fin.diagnostics?.sourceTenseMismatchCount).toBe(3);
    expect(fin.diagnostics?.sourceTenseValidationPassed).toBe(false);
    expect(fin.diagnostics?.expectedEmploymentTense).toBe('present');
    expect(fin.diagnostics?.deterministicTenseNormalizerAttempted).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
    expect(fin.diagnostics?.canonicalAcceptancePassed).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toMatch(/tense|deterministic/);
    expect(fin.diagnostics?.finalDecisionKind).toBe('material_improvement');
  });
});

describe('AAB-315 already-valid and completed controls', () => {
  it('correct current-role present may no-op', () => {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: ATLAS_PRESENT,
      visibleComparisonText: ATLAS_PRESENT,
      candidateText: ATLAS_PRESENT,
      candidateOrigin: 'provider',
      isPresent: true,
    });
    expect(decision.shouldApply).toBe(false);
    expect(decision.exactNoOp || decision.normalizedNoOp || decision.semanticNoOp).toBe(true);
  });

  it('completed present → past applies wrong_tense_fixed', () => {
    const result = finalizeSpanishExperienceCandidateConservatively({
      factAuthorityText: REWITU_PRESENT,
      visibleComparisonText: REWITU_PRESENT,
      providerCandidateText: REWITU_PRESENT,
      isPresent: false,
    });
    expect(result.decision.shouldApply).toBe(true);
    expect(result.decision.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
    expect(result.decision.selectedText).toMatch(/Creó/u);
    expect(result.decision.selectedText).toMatch(/Preparó/u);
  });

  it('completed past already valid is no-op', () => {
    const a = analyzeExperienceVisibleSource({
      visibleText: REWITU_PAST,
      targetLocale: 'es',
      isPresent: false,
    });
    expect(a.tenseMismatchCount).toBe(0);
    expect(a.sourceAlreadyValidForTarget).toBe(true);
  });

  it('immediate unedited rerun after correction is no-op +0', () => {
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-atlas',
      appliedOutput: ATLAS_PRESENT,
      preAiFactText: ATLAS_PAST,
      sourceLocale: 'es',
      targetLocale: 'es',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'pre_ai_snapshot',
    });
    const cv = spanishFixture({
      currentDesc: ATLAS_PRESENT,
      originalDesc: ATLAS_PAST,
      provenance,
      isPresent: true,
    });
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-315-rerun',
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
      candidate: ATLAS_PRESENT,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.diagnostics?.sourceAlreadyValidForTarget).toBe(true);
    expect(fin.diagnostics?.sourceTenseMismatchCount).toBe(0);
  });
});
