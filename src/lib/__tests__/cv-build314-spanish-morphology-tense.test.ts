/**
 * AAB-314 — Spanish Experience morphology, tense evidence, canonical acceptance.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { analyzeContentLocale, detectTextLocale } from '@/lib/cv-content-locale';
import {
  extractSpanishExperiencePredicates,
  detectSpanishExperiencePredicateExpansion,
} from '@/lib/cv-spanish-experience-grounding';
import {
  analyzeSpanishExperienceTenseAlignment,
  countIncompleteSpanishUnits,
  extractSpanishMorphologyLemmas,
  normalizeSpanishExperienceTenseOnly,
  SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION,
  SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION,
  EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION,
} from '@/lib/cv-spanish-experience-morphology';
import {
  decideSpanishExperienceFinalCandidate,
  finalizeSpanishExperienceCandidateConservatively,
  validateSpanishExperienceCandidate,
  buildSpanishExperienceDeterministicCandidate,
} from '@/lib/cv-experience-canonical-finalization';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { buildSpanishWarehouseExperienceFallback } from '@/lib/cv-spanish-experience-grounding';

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

const EN_CONTROL = formatExperienceBullets([
  'Reviews incoming goods in the warehouse.',
  'Checks documentation associated with received goods.',
  'Coordinates with colleagues the preparation and movement of goods.',
]);

describe('AAB-314 Spanish morphology markers', () => {
  it('exports packaging markers', () => {
    expect(SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION).toBe(
      'spanish-experience-morphology-314-v1',
    );
    expect(SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION).toBe(
      'spanish-experience-tense-evidence-314-v1',
    );
    expect(EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION).toBe(
      'experience-nonvacuous-predicate-gate-314-v1',
    );
  });
});

describe('AAB-314 Spanish locale detection', () => {
  it('classifies accented preterite Atlas bullets as Spanish', () => {
    const signals = analyzeContentLocale(ATLAS_PAST, { storedLocale: 'en' });
    expect(signals.detectedLocale).toBe('es');
    expect(detectTextLocale(ATLAS_PAST, { storedLocale: 'en' })).toBe('es');
  });

  it('does not classify genuine English warehouse bullets as Spanish', () => {
    expect(detectTextLocale(EN_CONTROL, { storedLocale: 'en' })).toBe('en');
  });
});

describe('AAB-314 Spanish morphology / predicates', () => {
  it('extracts three accented preterite predicates', () => {
    const units = ATLAS_PAST.split(/\n/).map((l) => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
    // Prefer splitExperienceBullets path via expansion:
    const scan = detectSpanishExperiencePredicateExpansion(ATLAS_PAST, ATLAS_PRESENT);
    expect(scan.sourcePredicateIdentityCount).toBe(3);
    expect(scan.sourcePredicateExtractionPassed).toBe(true);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(scan.candidatePredicateIdentityCount).toBeGreaterThanOrEqual(3);
    for (const u of [
      'Revisó la mercancía entrante en el almacén.',
      'Comprobó la documentación asociada a la mercancía recibida.',
      'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
    ]) {
      expect(extractSpanishExperiencePredicates(u).length).toBeGreaterThan(0);
      expect(extractSpanishMorphologyLemmas(u).length).toBeGreaterThan(0);
    }
  });

  it('treats present and past lemmas as the same family', () => {
    const past = extractSpanishExperiencePredicates('Revisó la mercancía entrante.');
    const present = extractSpanishExperiencePredicates('Revisa la mercancía entrante.');
    expect(past[0]?.family).toBe(present[0]?.family);
  });

  it('rejects vacuous predicate coverage when zero source predicates', () => {
    // Force empty extract path: English source with Spanish-looking gate bypassed
    // by calling expansion on empty-predicate Spanish-looking gibberish without verbs.
    const emptyPredSource = formatExperienceBullets([
      'La mercancía entrante en el almacén.',
      'La documentación asociada a la mercancía recibida.',
      'Con sus compañeros la preparación y el movimiento.',
    ]);
    const scan = detectSpanishExperiencePredicateExpansion(emptyPredSource, ATLAS_PRESENT);
    expect(scan.sourcePredicateIdentityCount).toBe(0);
    expect(scan.sourcePredicateExtractionPassed).toBe(false);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(scan.sourcePredicateExtractionFailureReason).toBe(
      'source_predicate_extraction_failed',
    );
  });
});

describe('AAB-314 tense model + normalizer', () => {
  it('detects current-role past mismatch on Atlas fixture', () => {
    const t = analyzeSpanishExperienceTenseAlignment({
      sourceText: ATLAS_PAST,
      candidateText: ATLAS_PRESENT,
      isPresent: true,
    });
    expect(t.expectedEmploymentTense).toBe('present');
    expect(t.sourcePastUnitCount).toBe(3);
    expect(t.sourceTenseMismatchCount).toBe(3);
    expect(t.candidatePresentUnitCount).toBe(3);
    expect(t.candidateTenseMismatchCount).toBe(0);
  });

  it('normalizes Atlas past → present minimally', () => {
    const n = normalizeSpanishExperienceTenseOnly({
      sourceText: ATLAS_PAST,
      isPresent: true,
    });
    expect(n.changed).toBe(true);
    expect(n.tenseOnlyPreservationPassed).toBe(true);
    expect(n.tenseOnlyUnexpectedExpansionDetected).toBe(false);
    expect(n.text).toContain('Revisa la mercancía entrante en el almacén.');
    expect(n.text).toContain('Comprueba la documentación asociada a la mercancía recibida.');
    expect(n.text).toContain('Coordina con sus compañeros la preparación y el movimiento de la mercancía.');
    expect(n.tenseOnlyCandidateLength - n.tenseOnlySourceLength).toBeLessThanOrEqual(24);
  });

  it('normalizes completed-role present → past', () => {
    const n = normalizeSpanishExperienceTenseOnly({
      sourceText: REWITU_PRESENT,
      isPresent: false,
    });
    expect(n.changed).toBe(true);
    expect(n.text).toMatch(/Creó/u);
    expect(n.text).toMatch(/Revisó/u);
    expect(n.text).toMatch(/adaptó/iu);
    expect(n.text).toMatch(/Preparó/u);
  });

  it('complete past bullets are not incomplete', () => {
    expect(countIncompleteSpanishUnits(ATLAS_PAST)).toBe(0);
  });
});

describe('AAB-314 exact Atlas past→present decision', () => {
  it('applies wrong_tense_fixed with evidence and no incomplete_bullet', () => {
    const result = finalizeSpanishExperienceCandidateConservatively({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PAST,
      providerCandidateText: buildSpanishWarehouseExperienceFallback({
        sourceDescription: ATLAS_PAST,
        isPresent: true,
      }),
      isPresent: true,
    });
    expect(result.decision.shouldApply).toBe(true);
    expect(result.decision.shouldIncrementUsage).toBe(true);
    expect(result.decision.finalDecisionKind).toBe('material_improvement');
    expect(result.decision.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
    expect(result.decision.materialImprovementKinds).not.toContain(
      'incomplete_bullet_completed',
    );
    expect(result.decision.materialImprovementEvidenceCount).toBeGreaterThanOrEqual(3);
    expect(result.decision.everyImprovementKindHasEvidence).toBe(true);
    expect(result.decision.tenseOnlyCorrectionDetected).toBe(true);
    expect(result.decision.tenseOnlyPreservationPassed).toBe(true);
    expect(result.decision.tenseOnlyUnexpectedExpansionDetected).toBe(false);
    expect(result.decision.canonicalAcceptancePassed).toBe(true);
    expect(result.decision.sourcePredicateIdentityCount).toBe(3);
    expect(result.decision.sourcePredicateExtractionPassed).toBe(true);
    expect(result.decision.finalCandidatePredicateIdentityCount).toBeGreaterThanOrEqual(3);
    expect(result.decision.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(result.decision.sourceTenseMismatchCount).toBe(3);
    expect(result.decision.expectedEmploymentTense).toBe('present');
    expect(result.decision.selectedText).toContain('Revisa la mercancía entrante en el almacén.');
    expect(result.decision.selectedText).toContain('Comprueba la documentación');
    expect(result.decision.selectedText).toContain('Coordina con sus compañeros');
  });

  it('evaluateExperienceVisibleComparison classifies wrong_tense_fixed only', () => {
    const evalResult = evaluateExperienceVisibleComparison({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PAST,
      candidateText: ATLAS_PRESENT,
      locale: 'es',
      useVisibleForNoOp: true,
      isPresent: true,
    });
    expect(evalResult.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
    expect(evalResult.materialImprovementKinds).not.toContain('incomplete_bullet_completed');
  });

  it('broad warehouse expansion is rejected for tense-only when used as candidate', () => {
    const expanded = formatExperienceBullets([
      'Revisa la mercancía entrante en el almacén asegurando la calidad y conformidad de cada envío recibido diariamente.',
      'Comprueba la documentación asociada a la mercancía recibida y gestiona los registros generales del almacén con eficiencia.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía además del intercambio de información operativa.',
    ]);
    expect(expanded.length).toBeGreaterThan(ATLAS_PAST.length + 40);
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PAST,
      candidateText: expanded,
      candidateOrigin: 'deterministic_fallback',
      isPresent: true,
    });
    // Unsupported expansion and/or tense-only length growth must block apply.
    expect(decision.shouldApply).toBe(false);
  });
});

describe('AAB-314 completed-role + rerun controls', () => {
  it('present → past for completed role', () => {
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

  it('already-correct completed past is no-op +0', () => {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: REWITU_PAST,
      visibleComparisonText: REWITU_PAST,
      candidateText: REWITU_PAST,
      candidateOrigin: 'provider',
      isPresent: false,
    });
    expect(decision.shouldApply).toBe(false);
    expect(decision.shouldIncrementUsage).toBe(false);
    expect(decision.exactNoOp || decision.normalizedNoOp || decision.semanticNoOp).toBe(true);
  });

  it('immediate unedited rerun after present correction is no-op', () => {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PRESENT,
      candidateText: ATLAS_PRESENT,
      candidateOrigin: 'provider',
      isPresent: true,
    });
    expect(decision.shouldApply).toBe(false);
    expect(decision.materialImprovement).toBe(false);
    expect(decision.exactNoOp || decision.normalizedNoOp || decision.semanticNoOp).toBe(true);
  });
});

describe('AAB-314 acceptance gates', () => {
  it('null/false final predicate coverage blocks apply', () => {
    const v = validateSpanishExperienceCandidate({
      factAuthorityText: ATLAS_PAST,
      candidateText: ATLAS_PRESENT,
      candidateOrigin: 'provider',
    });
    expect(v.predicateCoveragePassed).toBe(true);
    expect(v.sourcePredicateIdentityCount).toBe(3);
  });

  it('zero source predicates forbids apply', () => {
    const emptyPred = formatExperienceBullets([
      'La mercancía entrante en el almacén.',
      'La documentación asociada.',
      'Con sus compañeros la preparación.',
    ]);
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: emptyPred,
      visibleComparisonText: emptyPred,
      candidateText: ATLAS_PRESENT,
      candidateOrigin: 'deterministic_fallback',
      isPresent: true,
    });
    expect(decision.shouldApply).toBe(false);
    expect(decision.sourcePredicateExtractionPassed).toBe(false);
    expect(decision.finalTypedReason).toBe('source_predicate_extraction_failed');
  });

  it('deterministic tense candidate validates', () => {
    const det = buildSpanishExperienceDeterministicCandidate({
      factAuthorityText: ATLAS_PAST,
      isPresent: true,
      preferTenseOnly: true,
    });
    expect(det.tenseOnly?.changed).toBe(true);
    expect(det.validation.candidateValid).toBe(true);
    expect(det.text).toContain('Revisa');
  });
});
