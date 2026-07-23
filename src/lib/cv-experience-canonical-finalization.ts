/**
 * AAB-313 — Spanish Experience canonical finalization architecture.
 *
 * Provider wording is optional. Authoritative source units are the fact
 * authority. Repair must operate on aligned clause spans (never partial
 * keyword deletion). One shared validator + decision object gates apply/usage.
 */
import { fingerprintText } from './cv-export-diagnostics';
import {
  experienceAiSourcesEquivalent,
  normalizeExperienceAiSourceText,
  experienceAiSourceUnits,
} from './cv-experience-ai-operation-snapshot';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { materialDutyKeysFromDescription } from './cv-material-duty-coverage';
import {
  detectSpanishExperienceUnsupportedExpansion,
  detectSpanishExperiencePredicateExpansion,
  sourceRequiresSpanishWarehouseFactCoverage,
  validateSpanishWarehouseExperienceCoverage,
  buildSpanishWarehouseExperienceFallback,
  stripSpanishExperienceUnsupportedEscalation,
} from './cv-spanish-experience-grounding';
import {
  evaluateExperienceVisibleComparison,
  experienceSpanishWarehouseSemanticallyEquivalent,
  experienceVisibleTextsSemanticallyEquivalent,
  type ExperienceMaterialImprovementKind,
  type ExperienceDegradationKind,
} from './cv-experience-visible-noop-authority';

/** Packaging proof — must survive minification / DCE. */
export const EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION =
  'experience-canonical-finalization-313-v1' as const;
export const SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION =
  'spanish-experience-surface-form-gate-313-v1' as const;
export const EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION =
  'experience-evidence-based-improvement-313-v1' as const;
export const EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION =
  'experience-single-decision-apply-gate-313-v1' as const;

void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
void SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION;
void EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION;
void EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION;

export type ExperienceSurfaceFailureKind =
  | 'malformed_surface_form'
  | 'dangling_function_word'
  | 'incomplete_noun_phrase'
  | 'malformed_post_repair_clause'
  | 'grammar_degradation'
  | 'doubled_preposition'
  | 'missing_finite_predicate'
  | 'incomplete_transitive_object';

export type ExperienceCanonicalDecisionKind =
  | 'material_improvement'
  | 'exact_noop'
  | 'normalized_noop'
  | 'semantic_noop'
  | 'neutral_restyle_noop'
  | 'degradation_rejected'
  | 'invalid_candidate_rejected'
  | 'race_rejected'
  | 'terminal_failure'
  | 'none';

export type ExperienceImprovementEvidence = {
  kind: ExperienceMaterialImprovementKind;
  unitHash: string | null;
  previousDefectKind: string | null;
  corrected: true;
};

export type ExperienceCanonicalCandidateValidation = {
  revision: typeof EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  candidateOrigin: string;
  candidateValid: boolean;
  surfaceFormPassed: boolean;
  surfaceFailureKinds: ExperienceSurfaceFailureKind[];
  factCoveragePassed: boolean;
  predicateCoveragePassed: boolean;
  unsupportedCount: number;
  unsupportedKinds: string[];
  addedPredicateCount: number;
  alignmentAmbiguous: boolean;
  unitCount: number;
};

export type ExperienceCanonicalFinalDecision = {
  revision: typeof EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION;
  candidateOrigin: string;
  candidateValid: boolean;
  candidateValidation: ExperienceCanonicalCandidateValidation;
  visibleComparisonAvailable: boolean;
  exactNoOp: boolean;
  normalizedNoOp: boolean;
  semanticNoOp: boolean;
  neutralRestyle: boolean;
  materialImprovement: boolean;
  materialImprovementKinds: ExperienceMaterialImprovementKind[];
  materialImprovementEvidence: ExperienceImprovementEvidence[];
  degradation: boolean;
  degradationKinds: ExperienceDegradationKind[];
  finalDecisionKind: ExperienceCanonicalDecisionKind;
  shouldApply: boolean;
  shouldIncrementUsage: boolean;
  finalTypedReason: string | null;
  selectedText: string;
  unsupportedClaimRepairCandidateProduced: boolean;
  unsupportedClaimRepairCandidateValid: boolean;
  unsupportedClaimRepairSelectedForComparison: boolean;
  unsupportedClaimRepairVisibleApplyPerformed: boolean;
};

/** Spanish surface-form gate — rejects malformed post-strip / post-repair text. */
export function validateSpanishExperienceSurfaceForm(
  text: string,
): {
  passed: boolean;
  kinds: ExperienceSurfaceFailureKind[];
  revision: typeof SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION;
} {
  void SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION;
  const kinds: ExperienceSurfaceFailureKind[] = [];
  const raw = (text || '').trim();
  if (!raw) {
    return { passed: true, kinds: [], revision: SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION };
  }
  const units = splitExperienceBullets(raw).filter(Boolean);
  const joined = units.join('\n');

  // Structural post-repair orphans and broken function-word sequences only.
  // Do not over-reject natural CV Spanish (Rewitu / warehouse / inclusive peers).
  const malformedRes: Array<{ re: RegExp; kind: ExperienceSurfaceFailureKind }> = [
    { re: /\bcada\s+de\b/iu, kind: 'malformed_post_repair_clause' },
    { re: /\ba\s+cada\s+de\b/iu, kind: 'malformed_post_repair_clause' },
    { re: /\bcon\s+cada\s+de\b/iu, kind: 'malformed_post_repair_clause' },
    // Malformed "cada del" leftover (not "cada del almacén" with a following noun
    // that forms a complete NP — require orphan/end or doubled function words).
    { re: /\bcada\s+del(?:\s*[.,;:!?]|$)/iu, kind: 'malformed_post_repair_clause' },
    { re: /\bcada\s+del\s+(?:de|con|a|para|y|e)\b/iu, kind: 'malformed_post_repair_clause' },
    { re: /\bde\s+de\b/iu, kind: 'doubled_preposition' },
    { re: /\b(?:^|[^\p{L}])a\s+de(?:\s|$|[.,;:!?])/iu, kind: 'malformed_surface_form' },
    { re: /\bcon\s+de(?:\s|$|[.,;:!?])/iu, kind: 'malformed_surface_form' },
    { re: /\bpara\s+de(?:\s|$|[.,;:!?])/iu, kind: 'malformed_surface_form' },
    { re: /\b(?:de|con|a|para|por)\s+(?:de|con|a|para|por)\b/iu, kind: 'doubled_preposition' },
    { re: /\b(?:el|la|los|las)\s+(?:el|la|los|las)\b/iu, kind: 'malformed_surface_form' },
    {
      re: /(?:^|\s)(?:el|la|los|las|un|una|cada|todo|toda|todos|todas|cualquier)\s*[.,;:!?]|(\s|^)(?:el|la|los|las|un|una|cada)\s*$/imu,
      kind: 'dangling_function_word',
    },
    // Whole-token dangling prepositions only — never match the final "a" of
    // "mercancía." (JS \b treats non-ASCII letters as non-word chars).
    { re: /(?:^|\s)(?:de|con|a|para|por|en|y|e)\s*[.,;:!?]\s*$/imu, kind: 'dangling_function_word' },
    { re: /(?:^|\s)cada\s+(?:uno|una)?\s*$/imu, kind: 'dangling_function_word' },
    // Orphan quantifier leftovers after stripping the noun ("cada recibido",
    // "cada conforme") without a following concrete noun phrase.
    { re: /\bcada\s+(?:recibid\w*|conforme\w*)\b/iu, kind: 'malformed_post_repair_clause' },
  ];
  for (const { re, kind } of malformedRes) {
    if (re.test(joined)) kinds.push(kind);
  }

  for (const unit of units) {
    const u = (unit || '').trim();
    if (!u) {
      kinds.push('incomplete_noun_phrase');
      continue;
    }
    // Empty NP after a lone determiner/quantifier unit.
    if (/^(?:el|la|los|las|un|una|cada|todos?|todas?|cualquier)\.?$/iu.test(u)) {
      kinds.push('incomplete_noun_phrase');
    }
  }

  const unique = [...new Set(kinds)];
  return {
    passed: unique.length === 0,
    kinds: unique,
    revision: SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION,
  };
}

/**
 * Scrub orphan function-word leftovers after clause-level strip.
 * Prefer correcting salvageable rows; otherwise empty the unit.
 */
export function scrubSpanishExperiencePostRepairSurface(text: string): string {
  void SPANISH_EXPERIENCE_SURFACE_FORM_GATE_313_REVISION;
  const units = splitExperienceBullets(text || '').map((b) => {
    let row = (b || '').trim();
    if (!row) return '';
    row = row
      .replace(/\b(?:a|con|de|para)\s+cada\s+de\b/giu, '')
      .replace(/\bcada\s+de(?:l)?\b/giu, '')
      .replace(/\b(?:a|con|de|para)\s+de\b/giu, '')
      .replace(/\bde\s+de\b/giu, 'de')
      .replace(/\b(?:el|la|los|las)\s+(?:el|la|los|las)\b/giu, '$1')
      .replace(/\s+(?:de|con|a|para|por|y|e)\s*[.,;:!?]\s*$/giu, '.')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:])/g, '$1')
      .trim();
    if (row && !/[.!?]$/u.test(row)) row = `${row}.`;
    const surface = validateSpanishExperienceSurfaceForm(row);
    if (!surface.passed) return '';
    return row;
  }).filter(Boolean);
  return formatExperienceBullets(units);
}

/** Shared Spanish Experience candidate validator (provider / repair / deterministic). */
export function validateSpanishExperienceCandidate(options: {
  factAuthorityText: string;
  candidateText: string;
  candidateOrigin: string;
  locale?: string;
}): ExperienceCanonicalCandidateValidation {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  const fact = (options.factAuthorityText || '').trim();
  const candidate = (options.candidateText || '').trim();
  const units = splitExperienceBullets(candidate).filter(Boolean);
  const surface = validateSpanishExperienceSurfaceForm(candidate);
  const scan = detectSpanishExperienceUnsupportedExpansion(fact, candidate);
  const pred = detectSpanishExperiencePredicateExpansion(fact, candidate);
  const needsWh = sourceRequiresSpanishWarehouseFactCoverage(fact);
  const cov = needsWh
    ? validateSpanishWarehouseExperienceCoverage(fact, candidate)
    : { ok: true, required: [], covered: [], uncovered: [] as string[], reason: null };
  const alignmentAmbiguous = units.length > 0
    && needsWh
    && cov.uncovered.length > 0
    && scan.count === 0;
  const candidateValid = Boolean(
    candidate
    && units.length > 0
    && surface.passed
    && scan.count === 0
    && (pred.candidateAddedPredicateCount ?? 0) === 0
    && cov.ok
    && pred.sourceUnitPredicateCoveragePassed !== false,
  );
  return {
    revision: EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION,
    candidateOrigin: options.candidateOrigin || 'unknown',
    candidateValid,
    surfaceFormPassed: surface.passed,
    surfaceFailureKinds: [...surface.kinds],
    factCoveragePassed: cov.ok,
    predicateCoveragePassed: pred.sourceUnitPredicateCoveragePassed !== false
      && (pred.candidateAddedPredicateCount ?? 0) === 0,
    unsupportedCount: scan.count,
    unsupportedKinds: [...scan.kinds],
    addedPredicateCount: pred.candidateAddedPredicateCount ?? 0,
    alignmentAmbiguous,
    unitCount: units.length,
  };
}

/**
 * Structured Spanish repair: strip unsupported spans, then scrub surface orphans.
 * Never returns a candidate that fails the surface-form gate.
 */
export function repairSpanishExperienceCandidateStructured(options: {
  factAuthorityText: string;
  candidateText: string;
}): {
  repairedText: string;
  produced: boolean;
  valid: boolean;
  validation: ExperienceCanonicalCandidateValidation;
} {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  const fact = (options.factAuthorityText || '').trim();
  const raw = (options.candidateText || '').trim();
  if (!raw) {
    const empty = validateSpanishExperienceCandidate({
      factAuthorityText: fact,
      candidateText: '',
      candidateOrigin: 'unsupported_claim_repair',
    });
    return { repairedText: '', produced: false, valid: false, validation: empty };
  }
  const stripped = stripSpanishExperienceUnsupportedEscalation(raw, fact);
  const scrubbed = scrubSpanishExperiencePostRepairSurface(stripped);
  const validation = validateSpanishExperienceCandidate({
    factAuthorityText: fact,
    candidateText: scrubbed,
    candidateOrigin: 'unsupported_claim_repair',
  });
  return {
    repairedText: scrubbed,
    produced: Boolean(scrubbed.trim()),
    valid: validation.candidateValid,
    validation,
  };
}

/** Deterministic rebuild from authoritative source (warehouse when applicable). */
export function buildSpanishExperienceDeterministicCandidate(options: {
  factAuthorityText: string;
  isPresent?: boolean;
}): {
  text: string;
  validation: ExperienceCanonicalCandidateValidation;
} {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  const fact = (options.factAuthorityText || '').trim();
  let text = '';
  if (sourceRequiresSpanishWarehouseFactCoverage(fact)) {
    text = buildSpanishWarehouseExperienceFallback({
      sourceDescription: fact,
      isPresent: options.isPresent !== false,
    });
  } else {
    const units = experienceAiSourceUnits(fact);
    text = formatExperienceBullets(units.map((u) => {
      let row = (u || '').trim();
      if (row && !/[.!?]$/u.test(row)) row = `${row}.`;
      return row;
    }));
  }
  text = scrubSpanishExperiencePostRepairSurface(text);
  const validation = validateSpanishExperienceCandidate({
    factAuthorityText: fact,
    candidateText: text,
    candidateOrigin: 'deterministic_fallback',
  });
  return { text, validation };
}

function evidenceForKinds(
  kinds: ExperienceMaterialImprovementKind[],
  visible: string,
  candidate: string,
): ExperienceImprovementEvidence[] {
  void EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION;
  const candUnits = splitExperienceBullets(candidate).filter(Boolean);
  void visible;
  return kinds.map((kind, i) => ({
    kind,
    unitHash: fingerprintText(
      (candUnits[Math.min(i, Math.max(0, candUnits.length - 1))] || candidate).trim(),
    ),
    previousDefectKind: kind === 'malformed_sentence_fixed'
      ? 'malformed_surface_form'
      : (kind === 'missing_source_unit_restored' || kind === 'missing_fact_restored'
        ? 'missing_source_unit'
        : (kind.startsWith('unsupported') ? 'unsupported_visible_content' : null)),
    corrected: true as const,
  })).filter((e) => e.unitHash);
}

/**
 * Canonical Spanish Experience final decision.
 * Shared for provider / repair / deterministic candidates vs visible comparison.
 */
export function decideSpanishExperienceFinalCandidate(options: {
  factAuthorityText: string;
  visibleComparisonText: string;
  candidateText: string;
  candidateOrigin: string;
  locale?: string;
  repairProduced?: boolean;
  repairValid?: boolean;
  repairSelectedForComparison?: boolean;
}): ExperienceCanonicalFinalDecision {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  void EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION;
  void EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION;

  const fact = (options.factAuthorityText || '').trim();
  const visible = (options.visibleComparisonText || '').trim();
  const candidate = (options.candidateText || '').trim();
  const validation = validateSpanishExperienceCandidate({
    factAuthorityText: fact,
    candidateText: candidate,
    candidateOrigin: options.candidateOrigin,
    locale: options.locale,
  });

  const visibleAvailable = Boolean(visible);
  const exactNoOp = visibleAvailable && candidate === visible;
  const normalizedNoOp = visibleAvailable
    && experienceAiSourcesEquivalent(visible, candidate);
  const semanticEq = visibleAvailable
    && experienceVisibleTextsSemanticallyEquivalent(visible, candidate, 'es');
  const visEval = evaluateExperienceVisibleComparison({
    factAuthorityText: fact,
    visibleComparisonText: visible,
    candidateText: candidate,
    locale: 'es',
    useVisibleForNoOp: visibleAvailable,
    capturedAtRequest: true,
  });

  // Spanish: never accept generic grounded_phrasing as sole billable reason.
  const rawKinds = (visEval.materialImprovementKinds || []).filter(
    (k) => k !== 'grounded_phrasing_enhancement',
  ) as ExperienceMaterialImprovementKind[];

  const improvementKinds: ExperienceMaterialImprovementKind[] = [...rawKinds];
  const visSurface = validateSpanishExperienceSurfaceForm(visible);
  const candSurface = validateSpanishExperienceSurfaceForm(candidate);
  if (!visSurface.passed && candSurface.passed && validation.candidateValid) {
    if (!improvementKinds.includes('malformed_sentence_fixed')) {
      improvementKinds.push('malformed_sentence_fixed');
    }
  }
  if (
    visEval.degradationDetected === false
    && validation.candidateValid
    && visibleAvailable
  ) {
    const factKeys = new Set(materialDutyKeysFromDescription(fact || visible));
    const visKeys = new Set(materialDutyKeysFromDescription(visible));
    const candKeys = new Set(materialDutyKeysFromDescription(candidate));
    for (const k of factKeys) {
      if (!visKeys.has(k) && candKeys.has(k)
        && !improvementKinds.includes('missing_fact_restored')) {
        improvementKinds.push('missing_fact_restored');
      }
    }
    const visN = splitExperienceBullets(visible).filter(Boolean).length;
    const candN = splitExperienceBullets(candidate).filter(Boolean).length;
    if (visN < Math.max(factKeys.size, 1) && candN > visN
      && !improvementKinds.includes('missing_source_unit_restored')) {
      improvementKinds.push('missing_source_unit_restored');
    }
  }

  const uniqueImp = [...new Set(improvementKinds)];
  const evidence = evidenceForKinds(uniqueImp, visible, candidate);
  const degradationKinds: ExperienceDegradationKind[] = [
    ...visEval.degradationKinds,
  ];
  if (!validation.surfaceFormPassed) {
    degradationKinds.push('clarity_reduced');
  }
  if (!validation.candidateValid && candidate && validation.unsupportedCount > 0) {
    degradationKinds.push('unsupported_object_introduced');
  }
  const uniqueDeg = [...new Set(degradationKinds)];
  const degradation = !validation.candidateValid || uniqueDeg.length > 0
    || !validation.surfaceFormPassed;

  const semanticNoOp = Boolean(
    validation.candidateValid
    && visibleAvailable
    && uniqueImp.length === 0
    && (exactNoOp || normalizedNoOp || semanticEq || visEval.semanticNoOpDetected),
  );
  const neutralRestyle = Boolean(
    semanticNoOp && !exactNoOp && !normalizedNoOp,
  );
  const materialImprovement = Boolean(
    validation.candidateValid
    && validation.surfaceFormPassed
    && !degradation
    && !semanticNoOp
    && uniqueImp.length > 0
    && evidence.length === uniqueImp.length,
  );

  let finalDecisionKind: ExperienceCanonicalDecisionKind = 'none';
  if (!candidate) finalDecisionKind = 'terminal_failure';
  else if (!validation.candidateValid || !validation.surfaceFormPassed) {
    finalDecisionKind = validation.surfaceFormPassed
      ? 'invalid_candidate_rejected'
      : 'degradation_rejected';
  } else if (degradation && !materialImprovement) {
    finalDecisionKind = 'degradation_rejected';
  } else if (materialImprovement) finalDecisionKind = 'material_improvement';
  else if (exactNoOp) finalDecisionKind = 'exact_noop';
  else if (normalizedNoOp) finalDecisionKind = 'normalized_noop';
  else if (neutralRestyle) finalDecisionKind = 'neutral_restyle_noop';
  else if (semanticNoOp) finalDecisionKind = 'semantic_noop';
  else finalDecisionKind = 'invalid_candidate_rejected';

  const shouldApply = finalDecisionKind === 'material_improvement';

  let finalTypedReason: string | null = null;
  if (shouldApply) finalTypedReason = null;
  else if (finalDecisionKind === 'degradation_rejected') {
    finalTypedReason = validation.surfaceFailureKinds[0]
      || uniqueDeg[0]
      || 'experience_ai_degradation';
  } else if (
    finalDecisionKind === 'semantic_noop'
    || finalDecisionKind === 'neutral_restyle_noop'
    || finalDecisionKind === 'exact_noop'
    || finalDecisionKind === 'normalized_noop'
  ) {
    finalTypedReason = visEval.semanticNoOpReason || 'ai_noop';
  } else {
    finalTypedReason = 'experience_ai_invalid_candidate';
  }

  return {
    revision: EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION,
    candidateOrigin: options.candidateOrigin,
    candidateValid: validation.candidateValid,
    candidateValidation: validation,
    visibleComparisonAvailable: visibleAvailable,
    exactNoOp,
    normalizedNoOp,
    semanticNoOp,
    neutralRestyle,
    materialImprovement,
    materialImprovementKinds: materialImprovement ? uniqueImp : [],
    materialImprovementEvidence: materialImprovement ? evidence : [],
    degradation: Boolean(degradation && !materialImprovement),
    degradationKinds: materialImprovement ? [] : uniqueDeg,
    finalDecisionKind,
    shouldApply,
    shouldIncrementUsage: shouldApply,
    finalTypedReason,
    selectedText: shouldApply ? candidate : visible,
    unsupportedClaimRepairCandidateProduced: Boolean(options.repairProduced),
    unsupportedClaimRepairCandidateValid: Boolean(options.repairValid),
    unsupportedClaimRepairSelectedForComparison: Boolean(
      options.repairSelectedForComparison,
    ),
    unsupportedClaimRepairVisibleApplyPerformed: Boolean(
      shouldApply && options.candidateOrigin === 'unsupported_claim_repair',
    ),
  };
}

/**
 * Conservative Spanish recovery: validate provider → one structured repair →
 * deterministic rebuild → decide vs visible comparison.
 */
export function finalizeSpanishExperienceCandidateConservatively(options: {
  factAuthorityText: string;
  visibleComparisonText: string;
  providerCandidateText: string;
  isPresent?: boolean;
  locale?: string;
}): {
  decision: ExperienceCanonicalFinalDecision;
  providerValidation: ExperienceCanonicalCandidateValidation;
  repair: ReturnType<typeof repairSpanishExperienceCandidateStructured> | null;
  deterministic: ReturnType<typeof buildSpanishExperienceDeterministicCandidate> | null;
} {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  const fact = (options.factAuthorityText || '').trim();
  const visible = (options.visibleComparisonText || '').trim();
  const provider = (options.providerCandidateText || '').trim();

  const providerValidation = validateSpanishExperienceCandidate({
    factAuthorityText: fact,
    candidateText: provider,
    candidateOrigin: 'provider',
  });
  if (providerValidation.candidateValid) {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: fact,
      visibleComparisonText: visible,
      candidateText: provider,
      candidateOrigin: 'provider',
    });
    return {
      decision,
      providerValidation,
      repair: null,
      deterministic: null,
    };
  }

  const repair = repairSpanishExperienceCandidateStructured({
    factAuthorityText: fact,
    candidateText: provider,
  });
  if (repair.valid && repair.repairedText.trim()) {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: fact,
      visibleComparisonText: visible,
      candidateText: repair.repairedText,
      candidateOrigin: 'unsupported_claim_repair',
      repairProduced: repair.produced,
      repairValid: repair.valid,
      repairSelectedForComparison: true,
    });
    if (decision.shouldApply) {
      return { decision, providerValidation, repair, deterministic: null };
    }
    // Valid repair that is only a no-op vs visible: still attempt deterministic
    // rebuild, which may prove incomplete_bullet_completed / malformed fix.
  }

  const deterministic = buildSpanishExperienceDeterministicCandidate({
    factAuthorityText: fact,
    isPresent: options.isPresent,
  });
  if (!deterministic.validation.candidateValid || !deterministic.text.trim()) {
    // Prefer repair no-op decision when repair was valid but not applied.
    if (repair.valid && repair.repairedText.trim()) {
      const noopDecision = decideSpanishExperienceFinalCandidate({
        factAuthorityText: fact,
        visibleComparisonText: visible,
        candidateText: repair.repairedText,
        candidateOrigin: 'unsupported_claim_repair',
        repairProduced: repair.produced,
        repairValid: repair.valid,
        repairSelectedForComparison: true,
      });
      return { decision: noopDecision, providerValidation, repair, deterministic };
    }
    return {
      decision: {
        revision: EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION,
        candidateOrigin: 'none',
        candidateValid: false,
        candidateValidation: deterministic.validation,
        visibleComparisonAvailable: Boolean(visible),
        exactNoOp: false,
        normalizedNoOp: false,
        semanticNoOp: Boolean(visible),
        neutralRestyle: false,
        materialImprovement: false,
        materialImprovementKinds: [],
        materialImprovementEvidence: [],
        degradation: false,
        degradationKinds: [],
        finalDecisionKind: visible ? 'semantic_noop' : 'terminal_failure',
        shouldApply: false,
        shouldIncrementUsage: false,
        finalTypedReason: visible ? 'ai_noop' : 'experience_generation_failed',
        selectedText: visible,
        unsupportedClaimRepairCandidateProduced: repair.produced,
        unsupportedClaimRepairCandidateValid: repair.valid,
        unsupportedClaimRepairSelectedForComparison: false,
        unsupportedClaimRepairVisibleApplyPerformed: false,
      },
      providerValidation,
      repair,
      deterministic,
    };
  }
  const decision = decideSpanishExperienceFinalCandidate({
    factAuthorityText: fact,
    visibleComparisonText: visible,
    candidateText: deterministic.text,
    candidateOrigin: 'deterministic_fallback',
    repairProduced: repair.produced,
    repairValid: repair.valid,
    repairSelectedForComparison: false,
  });
  return { decision, providerValidation, repair, deterministic };
}

export function spanishExperienceTextsSemanticallyEquivalentAligned(
  a: string,
  b: string,
): boolean {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  return experienceSpanishWarehouseSemanticallyEquivalent(a, b);
}

export function hashExperienceCanonicalText(text: string): string | null {
  const n = normalizeExperienceAiSourceText(text || '');
  return n ? fingerprintText(n) : null;
}
