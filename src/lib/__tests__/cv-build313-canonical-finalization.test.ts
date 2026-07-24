/**
 * @vitest-environment jsdom
 *
 * AAB-313 — Spanish Experience canonical finalization:
 * surface-form gate, structured repair, evidence-based improvement,
 * single decision apply gate (no generic grounded_phrasing billing).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION,
  SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION,
  EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION,
  EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION,
  EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION,
  EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  validateSpanishExperienceSurfaceForm,
  validateSpanishExperienceCandidate,
  repairSpanishExperienceCandidateStructured,
  buildSpanishExperienceDeterministicCandidate,
  decideSpanishExperienceFinalCandidate,
  finalizeSpanishExperienceCandidateConservatively,
} from '@/lib/cv-experience-canonical-finalization';
import {
  evaluateExperienceVisibleComparison,
  experienceSpanishWarehouseSemanticallyEquivalent,
} from '@/lib/cv-experience-visible-noop-authority';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import {
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { clearCvAiDiagnosticHistory } from '@/lib/cv-ai-diagnostics-contract';
import {
  createExperienceAiOperationSnapshot,
} from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceAiOutputProvenance,
} from '@/lib/cv-experience-ai-output-provenance';

const REF = '2026-07-20';

const WH_ES_SHORT = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

const WH_ES_VISIBLE = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_BAD_CADA_DE = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a cada de mercancía recibida.',
  'Coordina con sus compañeras y compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_INCLUSIVE = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a la mercancía recibida.',
  'Coordina con sus compañeras y compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_SYNONYM_DOC = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_MISSING_UNIT = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_PAST_WRONG = formatExperienceBullets([
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_WITH_CONFORMIDAD = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a cada conformidad de mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const GD_ES_COMPLETED = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
]);

function spanishFixture(opts: {
  currentDesc: string;
  originalDesc?: string;
  provenance?: ReturnType<typeof buildExperienceAiOutputProvenance>;
  isPresent?: boolean;
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
    description: GD_ES_COMPLETED,
    originalUserDescription: GD_ES_COMPLETED,
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
  };
}

describe('cv-build313 canonical finalization', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('exposes AAB-313 revision markers in the runtime set', () => {
    expect(EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION)
      .toBe('experience-canonical-finalization-313-v1');
    expect(SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION)
      .toBe('spanish-experience-surface-form-gate-313-v1');
    expect(EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION)
      .toBe('experience-evidence-based-improvement-313-v1');
    expect(EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION)
      .toBe('experience-single-decision-apply-gate-313-v1');
    for (const m of [
      EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION,
      SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION,
      EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION,
      EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION,
      EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION,
      EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION,
    ]) {
      expect(SUMMARY_RUNTIME_MARKER_SET).toContain(m);
    }
  });

  it('rejects exact AAB-312 malformed cada de surface form', () => {
    const surface = validateSpanishExperienceSurfaceForm(WH_ES_BAD_CADA_DE);
    expect(surface.passed).toBe(false);
    expect(surface.kinds.length).toBeGreaterThan(0);
    expect(
      surface.kinds.some((k) =>
        k === 'malformed_post_repair_clause' || k === 'dangling_function_word'),
    ).toBe(true);
    const validation = validateSpanishExperienceCandidate({
      factAuthorityText: WH_ES_SHORT,
      candidateText: WH_ES_BAD_CADA_DE,
      candidateOrigin: 'unsupported_claim_repair',
    });
    expect(validation.candidateValid).toBe(false);
    expect(validation.surfaceFormPassed).toBe(false);
  });

  it('rejects cada de / cada del / doubled prepositions / dangling determiners', () => {
    expect(validateSpanishExperienceSurfaceForm('Comprueba la documentación a cada de mercancía.')
      .passed).toBe(false);
    expect(validateSpanishExperienceSurfaceForm('Comprueba cada del.')
      .passed).toBe(false);
    expect(validateSpanishExperienceSurfaceForm('Coordina con de compañeros la mercancía.')
      .passed).toBe(false);
    expect(validateSpanishExperienceSurfaceForm('Revisa la.')
      .passed).toBe(false);
    expect(validateSpanishExperienceSurfaceForm(
      'Revisa la mercancía entrante en el almacén.',
    ).passed).toBe(true);
  });

  it('allows natural cada envío when source-supported and well-formed', () => {
    const src = formatExperienceBullets([
      'Revisa cada envío entrante en el almacén.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    const cand = src;
    const surface = validateSpanishExperienceSurfaceForm(cand);
    expect(surface.passed).toBe(true);
    const validation = validateSpanishExperienceCandidate({
      factAuthorityText: src,
      candidateText: cand,
      candidateOrigin: 'provider',
    });
    expect(validation.surfaceFormPassed).toBe(true);
  });

  it('structured repair never leaves orphan cada de after stripping conformidad', () => {
    const repair = repairSpanishExperienceCandidateStructured({
      factAuthorityText: WH_ES_SHORT,
      candidateText: WH_ES_WITH_CONFORMIDAD,
    });
    expect(repair.repairedText).not.toMatch(/\bcada\s+de\b/iu);
    expect(repair.repairedText).not.toMatch(/\bconformidad\b/iu);
    if (repair.produced) {
      expect(repair.validation.surfaceFormPassed).toBe(true);
    }
  });

  it('conservative recovery rejects bad repaired candidate for clean visible fixture', () => {
    const result = finalizeSpanishExperienceCandidateConservatively({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_VISIBLE,
      providerCandidateText: WH_ES_BAD_CADA_DE,
      isPresent: true,
    });
    expect(result.providerValidation.candidateValid).toBe(false);
    expect(result.decision.shouldApply).toBe(false);
    expect(result.decision.shouldIncrementUsage).toBe(false);
    expect(result.decision.materialImprovement).toBe(false);
    expect(
      result.decision.finalDecisionKind === 'semantic_noop'
      || result.decision.finalDecisionKind === 'neutral_restyle_noop'
      || result.decision.finalDecisionKind === 'exact_noop'
      || result.decision.finalDecisionKind === 'normalized_noop'
      || result.decision.finalDecisionKind === 'degradation_rejected'
      || result.decision.finalDecisionKind === 'invalid_candidate_rejected',
    ).toBe(true);
    expect(result.decision.selectedText).toBe(WH_ES_VISIBLE);
  });

  it('inclusive-language-only change is semantic/neutral restyle no-op', () => {
    expect(experienceSpanishWarehouseSemanticallyEquivalent(
      WH_ES_VISIBLE,
      WH_ES_INCLUSIVE,
    )).toBe(true);
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_VISIBLE,
      candidateText: WH_ES_INCLUSIVE,
      candidateOrigin: 'provider',
    });
    expect(decision.materialImprovement).toBe(false);
    expect(decision.shouldApply).toBe(false);
    expect(decision.semanticNoOp || decision.neutralRestyle).toBe(true);
    expect(decision.materialImprovementKinds).not.toContain('grounded_phrasing_enhancement');
  });

  it('documentation synonym change is semantic no-op for user-edited text', () => {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: WH_ES_SYNONYM_DOC,
      visibleComparisonText: WH_ES_SYNONYM_DOC,
      candidateText: WH_ES_VISIBLE,
      candidateOrigin: 'provider',
    });
    expect(decision.shouldApply).toBe(false);
    expect(decision.materialImprovement).toBe(false);
    expect(decision.semanticNoOp || decision.neutralRestyle || decision.normalizedNoOp).toBe(true);
  });

  it('generic grounded_phrasing alone cannot authorize Spanish apply', () => {
    const evalResult = evaluateExperienceVisibleComparison({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_VISIBLE,
      candidateText: WH_ES_INCLUSIVE,
      locale: 'es',
      useVisibleForNoOp: true,
    });
    expect(evalResult.materialImprovementKinds).not.toContain('grounded_phrasing_enhancement');
    expect(evalResult.materialImprovementDetected).toBe(false);
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_VISIBLE,
      candidateText: WH_ES_INCLUSIVE,
      candidateOrigin: 'provider',
    });
    expect(decision.materialImprovementKinds).not.toContain('grounded_phrasing_enhancement');
    expect(decision.shouldApply).toBe(false);
  });

  it('missing source unit restoration can be material improvement with evidence', () => {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_MISSING_UNIT,
      candidateText: WH_ES_VISIBLE,
      candidateOrigin: 'deterministic_fallback',
    });
    if (decision.candidateValid && decision.materialImprovement) {
      expect(decision.materialImprovementKinds.length).toBeGreaterThan(0);
      expect(decision.materialImprovementEvidence.length).toBeGreaterThanOrEqual(
        decision.materialImprovementKinds.length,
      );
      expect(
        decision.materialImprovementKinds.some((k) =>
          k === 'missing_source_unit_restored' || k === 'missing_fact_restored'),
      ).toBe(true);
      expect(decision.shouldApply).toBe(true);
    } else {
      // Still must not bill without evidence.
      expect(decision.shouldApply).toBe(false);
      expect(decision.materialImprovementKinds).toEqual([]);
    }
  });

  it('malformed visible text fixed is material improvement with evidence', () => {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_BAD_CADA_DE,
      candidateText: WH_ES_VISIBLE,
      candidateOrigin: 'deterministic_fallback',
    });
    expect(decision.candidateValid).toBe(true);
    expect(decision.materialImprovement).toBe(true);
    expect(decision.materialImprovementKinds).toContain('malformed_sentence_fixed');
    expect(decision.materialImprovementEvidence.length).toBeGreaterThan(0);
    expect(decision.shouldApply).toBe(true);
  });

  it('deterministic rebuild passes the same validator', () => {
    const det = buildSpanishExperienceDeterministicCandidate({
      factAuthorityText: WH_ES_SHORT,
      isPresent: true,
    });
    expect(det.text.trim().length).toBeGreaterThan(0);
    expect(det.validation.surfaceFormPassed).toBe(true);
    expect(det.validation.candidateValid).toBe(true);
    expect(det.text).not.toMatch(/\bcada\s+de\b/iu);
  });

  it('finalize path: AAB-312 regression — bad candidate not applied, usage +0', () => {
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-atlas',
      appliedOutput: WH_ES_VISIBLE,
      preAiFactText: WH_ES_SHORT,
      sourceLocale: 'es',
      targetLocale: 'es',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'pre_ai_snapshot',
    });
    const cv = spanishFixture({
      currentDesc: WH_ES_VISIBLE,
      originalDesc: WH_ES_SHORT,
      provenance,
    });
    const snap = createExperienceAiOperationSnapshot({
      liveText: WH_ES_VISIBLE,
      locale: 'es',
      requestId: 'req-313-aab312',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: WH_ES_SHORT,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: WH_ES_BAD_CADA_DE,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.text).toBe(WH_ES_VISIBLE);
    expect(result.diagnostics?.materialImprovementDetected).not.toBe(true);
    expect(result.diagnostics?.materialImprovementKinds || []).not.toContain(
      'grounded_phrasing_enhancement',
    );
  });

  it('finalize path: inclusive-only unedited re-run is no-op +0', () => {
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-atlas',
      appliedOutput: WH_ES_VISIBLE,
      preAiFactText: WH_ES_SHORT,
      sourceLocale: 'es',
      targetLocale: 'es',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'pre_ai_snapshot',
    });
    const cv = spanishFixture({
      currentDesc: WH_ES_VISIBLE,
      originalDesc: WH_ES_SHORT,
      provenance,
    });
    const snap = createExperienceAiOperationSnapshot({
      liveText: WH_ES_VISIBLE,
      locale: 'es',
      requestId: 'req-313-inclusive',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: WH_ES_SHORT,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: WH_ES_INCLUSIVE,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.text).toBe(WH_ES_VISIBLE);
    expect(result.diagnostics?.materialImprovementDetected).not.toBe(true);
  });

  it('finalize path: user-edited synonym re-run is no-op +0', () => {
    const cv = spanishFixture({
      currentDesc: WH_ES_SYNONYM_DOC,
      originalDesc: WH_ES_SYNONYM_DOC,
    });
    const snap = createExperienceAiOperationSnapshot({
      liveText: WH_ES_SYNONYM_DOC,
      locale: 'es',
      requestId: 'req-313-edit',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: WH_ES_VISIBLE,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.text).toBe(WH_ES_SYNONYM_DOC);
  });

  it('shared validator is used for provider, repair, and deterministic origins', () => {
    const provider = validateSpanishExperienceCandidate({
      factAuthorityText: WH_ES_SHORT,
      candidateText: WH_ES_VISIBLE,
      candidateOrigin: 'provider',
    });
    const repair = validateSpanishExperienceCandidate({
      factAuthorityText: WH_ES_SHORT,
      candidateText: WH_ES_VISIBLE,
      candidateOrigin: 'unsupported_claim_repair',
    });
    const det = validateSpanishExperienceCandidate({
      factAuthorityText: WH_ES_SHORT,
      candidateText: WH_ES_VISIBLE,
      candidateOrigin: 'deterministic_fallback',
    });
    expect(provider.revision).toBe(EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION);
    expect(repair.revision).toBe(provider.revision);
    expect(det.revision).toBe(provider.revision);
    expect(provider.candidateValid).toBe(true);
    expect(repair.candidateValid).toBe(true);
    expect(det.candidateValid).toBe(true);
  });

  it('source-supported gestiona / efficiency remain self-grounded; conformity surface stays valid', () => {
    const gestionaSrc = formatExperienceBullets([
      'Comprueba y gestiona la documentación relacionada',
      'Revisa la mercancía entrante',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
    ]);
    const efficiencySrc = formatExperienceBullets([
      'Revisa la mercancía entrante',
      'Comprueba la documentación relacionada',
      'Coordina de forma eficiente con sus compañeros la preparación y el movimiento de la mercancía',
    ]);
    const conformitySrc = formatExperienceBullets([
      'Revisa la mercancía entrante',
      'Comprueba certificados y declaraciones de conformidad',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
    ]);
    for (const src of [gestionaSrc, efficiencySrc]) {
      const v = validateSpanishExperienceCandidate({
        factAuthorityText: src,
        candidateText: src,
        candidateOrigin: 'provider',
      });
      expect(v.surfaceFormPassed).toBe(true);
      expect(v.unsupportedCount).toBe(0);
      expect(v.addedPredicateCount).toBe(0);
      expect(v.candidateValid).toBe(true);
    }
    // Conformity wording must remain surface-valid (scanner kinds are asserted in AAB-311).
    expect(validateSpanishExperienceSurfaceForm(conformitySrc).passed).toBe(true);
  });

  it('completed Rewitu past Spanish remains valid surface form', () => {
    const v = validateSpanishExperienceCandidate({
      factAuthorityText: GD_ES_COMPLETED,
      candidateText: GD_ES_COMPLETED,
      candidateOrigin: 'provider',
    });
    expect(v.surfaceFormPassed).toBe(true);
    expect(v.candidateValid).toBe(true);
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: GD_ES_COMPLETED,
      visibleComparisonText: GD_ES_COMPLETED,
      candidateText: GD_ES_COMPLETED,
      candidateOrigin: 'provider',
    });
    expect(decision.shouldApply).toBe(false);
    expect(decision.exactNoOp || decision.normalizedNoOp || decision.semanticNoOp).toBe(true);
  });

  it('wrong-tense visible can classify wrong_tense_fixed when candidate corrects it', () => {
    const evalResult = evaluateExperienceVisibleComparison({
      factAuthorityText: WH_ES_PAST_WRONG,
      visibleComparisonText: WH_ES_PAST_WRONG,
      candidateText: WH_ES_VISIBLE,
      locale: 'es',
      useVisibleForNoOp: true,
      isPresent: true,
    });
    expect(evalResult.materialImprovementDetected).toBe(true);
    expect(evalResult.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
    expect(evalResult.materialImprovementKinds).not.toContain('incomplete_bullet_completed');
    expect(evalResult.materialImprovementKinds).not.toContain('grounded_phrasing_enhancement');
  });
});
