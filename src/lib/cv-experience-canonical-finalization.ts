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
  scanSpanishWarehousePredicates,
} from './cv-spanish-experience-grounding';
import {
  evaluateExperienceVisibleComparison,
  experienceSpanishWarehouseSemanticallyEquivalent,
  experienceVisibleTextsSemanticallyEquivalent,
  type ExperienceMaterialImprovementKind,
  type ExperienceDegradationKind,
} from './cv-experience-visible-noop-authority';
import {
  analyzeSpanishExperienceTenseAlignment,
  countIncompleteSpanishUnits,
  normalizeSpanishExperienceTenseOnly,
  SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION,
  SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION,
  EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION,
} from './cv-spanish-experience-morphology';
import {
  EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION,
  SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION,
} from './cv-spanish-experience-semantic-delta';
void EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION;
void SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION;

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
void SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION;
void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
void EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION;

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
  affectedUnitHash?: string | null;
  previousDefectKind: string | null;
  beforeDefect?: string | null;
  expectedState?: string | null;
  finalState?: string | null;
  validationPassed?: boolean;
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
  sourcePredicateIdentityCount?: number;
  candidatePredicateIdentityCount?: number;
  sourcePredicateExtractionPassed?: boolean;
  sourcePredicateExtractionFailureReason?: string | null;
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
  /** AAB-314 — tense / acceptance diagnostics serialized from same decision. */
  canonicalAcceptancePassed?: boolean;
  expectedEmploymentTense?: 'present' | 'past' | null;
  sourceDetectedTense?: string | null;
  sourceTenseMismatchCount?: number | null;
  candidateDetectedTense?: string | null;
  candidateTenseMismatchCount?: number | null;
  wrongTenseFixedUnitCount?: number | null;
  tenseOnlyCorrectionDetected?: boolean;
  tenseOnlySourceLength?: number | null;
  tenseOnlyCandidateLength?: number | null;
  tenseOnlyUnexpectedExpansionDetected?: boolean;
  tenseOnlyPreservationPassed?: boolean | null;
  everyImprovementKindHasEvidence?: boolean;
  materialImprovementEvidenceCount?: number;
  finalCandidatePredicateIdentityCount?: number | null;
  finalSourceUnitPredicateCoveragePassed?: boolean | null;
  sourcePredicateIdentityCount?: number | null;
  sourcePredicateExtractionPassed?: boolean | null;
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
  const needsWh = sourceRequiresSpanishWarehouseFactCoverage(fact);
  const cov = needsWh
    ? validateSpanishWarehouseExperienceCoverage(fact, candidate)
    : { ok: true, required: [], covered: [], uncovered: [] as string[], reason: null };
  // Morphology is authoritative for Spanish-locale fact sources (AAB-314: zero
  // finite verbs ⇒ extraction failure). Warehouse identity scan is only for
  // cross-locale EN/DE fact authority that lacks Spanish verb morphology.
  const morphPred = detectSpanishExperiencePredicateExpansion(fact, candidate);
  const factLooksSpanish = /(?:revis[ao]|comprob\w*|coordin\w*|mercanc[ií]a|documentaci[oó]n|compa[nñ]er|almac[eé]n|registros?\s+relacionad)/iu
    .test(fact);
  const foreignWarehouseAuthority = needsWh && !factLooksSpanish;
  const whPred = foreignWarehouseAuthority
    ? scanSpanishWarehousePredicates(fact, candidate)
    : null;
  const pred = whPred
    ? {
      sourcePredicateIdentityCount: whPred.sourcePredicateIdentityCount,
      candidatePredicateIdentityCount: whPred.candidatePredicateIdentityCount,
      candidateAddedPredicateCount: whPred.candidateAddedPredicateCount,
      candidateAddedPredicateIdentityHashes: whPred.candidateAddedPredicateIdentityHashes,
      sourceUnitPredicateCoveragePassed: whPred.sourceUnitPredicateCoveragePassed,
      sourcePredicateExtractionPassed: whPred.sourcePredicateIdentityCount > 0,
      sourcePredicateExtractionFailureReason: whPred.sourcePredicateIdentityCount > 0
        ? null
        : 'source_predicate_extraction_failed',
      unsupportedKinds: [] as string[],
      coordinatedPredicateExpansionDetected: false,
    }
    : morphPred;
  const alignmentAmbiguous = units.length > 0
    && needsWh
    && cov.uncovered.length > 0
    && scan.count === 0;
  void EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION;
  const extractionOk = pred.sourcePredicateExtractionPassed !== false;
  const factUnits = splitExperienceBullets(fact).filter(Boolean).length;
  const predCoverageStrict = factUnits === 0
    ? (pred.candidateAddedPredicateCount ?? 0) === 0
    : (
      pred.sourceUnitPredicateCoveragePassed === true
      && (pred.candidateAddedPredicateCount ?? 0) === 0
      && extractionOk
      && (pred.sourcePredicateIdentityCount ?? 0) > 0
      && (pred.candidatePredicateIdentityCount ?? 0) > 0
    );
  const candidateValid = Boolean(
    candidate
    && units.length > 0
    && surface.passed
    && scan.count === 0
    && (pred.candidateAddedPredicateCount ?? 0) === 0
    && cov.ok
    && predCoverageStrict
    && extractionOk,
  );
  return {
    revision: EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION,
    candidateOrigin: options.candidateOrigin || 'unknown',
    candidateValid,
    surfaceFormPassed: surface.passed,
    surfaceFailureKinds: [...surface.kinds],
    factCoveragePassed: cov.ok,
    predicateCoveragePassed: predCoverageStrict,
    unsupportedCount: scan.count,
    unsupportedKinds: [...scan.kinds],
    addedPredicateCount: pred.candidateAddedPredicateCount ?? 0,
    alignmentAmbiguous,
    unitCount: units.length,
    sourcePredicateIdentityCount: pred.sourcePredicateIdentityCount,
    candidatePredicateIdentityCount: pred.candidatePredicateIdentityCount,
    sourcePredicateExtractionPassed: pred.sourcePredicateExtractionPassed,
    sourcePredicateExtractionFailureReason: pred.sourcePredicateExtractionFailureReason,
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

/** Deterministic rebuild: tense-only normalizer first, then warehouse shells. */
export function buildSpanishExperienceDeterministicCandidate(options: {
  factAuthorityText: string;
  isPresent?: boolean;
  preferTenseOnly?: boolean;
}): {
  text: string;
  validation: ExperienceCanonicalCandidateValidation;
  tenseOnly?: ReturnType<typeof normalizeSpanishExperienceTenseOnly> | null;
} {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  const fact = (options.factAuthorityText || '').trim();
  const isPresent = options.isPresent !== false;
  const tenseOnly = normalizeSpanishExperienceTenseOnly({
    sourceText: fact,
    isPresent,
  });
  const tenseDefect = tenseOnly.analysis.sourceTenseMismatchCount > 0
    && countIncompleteSpanishUnits(fact) === 0;
  let text = '';
  let usedTense = false;
  if (
    (options.preferTenseOnly !== false)
    && tenseDefect
    && tenseOnly.changed
    && tenseOnly.tenseOnlyPreservationPassed
    && !tenseOnly.tenseOnlyUnexpectedExpansionDetected
  ) {
    text = tenseOnly.text;
    usedTense = true;
  } else if (sourceRequiresSpanishWarehouseFactCoverage(fact)) {
    text = buildSpanishWarehouseExperienceFallback({
      sourceDescription: fact,
      isPresent,
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
    candidateOrigin: usedTense ? 'deterministic_tense_normalizer' : 'deterministic_fallback',
  });
  return { text, validation, tenseOnly: usedTense ? tenseOnly : null };
}

function evidenceForKinds(
  kinds: ExperienceMaterialImprovementKind[],
  visible: string,
  candidate: string,
  options?: {
    isPresent?: boolean;
    tenseAnalysis?: ReturnType<typeof analyzeSpanishExperienceTenseAlignment> | null;
  },
): ExperienceImprovementEvidence[] {
  void EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION;
  void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  const candUnits = splitExperienceBullets(candidate).filter(Boolean);
  const visUnits = splitExperienceBullets(visible).filter(Boolean);
  const out: ExperienceImprovementEvidence[] = [];
  for (const kind of kinds) {
    if (kind === 'wrong_tense_fixed') {
      const hashes = options?.tenseAnalysis?.mismatchedSourceUnitHashes?.length
        ? options.tenseAnalysis.mismatchedSourceUnitHashes
        : visUnits.map((u) => fingerprintText(u.trim()));
      const expected = options?.isPresent === false ? 'past' : 'present';
      const before = expected === 'present' ? 'past_tense_in_current_employment' : 'present_tense_in_completed_employment';
      for (const h of hashes) {
        out.push({
          kind,
          unitHash: h,
          affectedUnitHash: h,
          previousDefectKind: 'wrong_tense',
          beforeDefect: before,
          expectedState: expected,
          finalState: expected,
          validationPassed: true,
          corrected: true,
        });
      }
      continue;
    }
    const i = out.length;
    out.push({
      kind,
      unitHash: fingerprintText(
        (candUnits[Math.min(i, Math.max(0, candUnits.length - 1))] || candidate).trim(),
      ),
      affectedUnitHash: fingerprintText(
        (candUnits[Math.min(i, Math.max(0, candUnits.length - 1))] || candidate).trim(),
      ),
      previousDefectKind: kind === 'malformed_sentence_fixed'
        ? 'malformed_surface_form'
        : (kind === 'missing_source_unit_restored' || kind === 'missing_fact_restored'
          ? 'missing_source_unit'
          : (kind === 'incomplete_bullet_completed'
            ? 'incomplete_visible_unit'
            : (kind.startsWith('unsupported') ? 'unsupported_visible_content' : null))),
      beforeDefect: kind === 'incomplete_bullet_completed' ? 'incomplete_unit' : null,
      expectedState: null,
      finalState: null,
      validationPassed: true,
      corrected: true as const,
    });
  }
  return out.filter((e) => e.unitHash);
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
  isPresent?: boolean;
  repairProduced?: boolean;
  repairValid?: boolean;
  repairSelectedForComparison?: boolean;
  tenseOnlyMeta?: ReturnType<typeof normalizeSpanishExperienceTenseOnly> | null;
  /** When true, billable material improvement requires a concrete defect-fixing kind. */
  sourceAlreadyValidForTarget?: boolean;
  sourceCorrectableDefectCount?: number;
  /** EN/DE visible → ES candidate (or other cross-locale) operations. */
  crossLocaleOperation?: boolean;
}): ExperienceCanonicalFinalDecision {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  void EXPERIENCE_SINGLE_DECISION_APPLY_GATE_313_REVISION;
  void EXPERIENCE_EVIDENCE_BASED_IMPROVEMENT_313_REVISION;
  void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  void EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION;

  const fact = (options.factAuthorityText || '').trim();
  const visible = (options.visibleComparisonText || '').trim();
  const candidate = (options.candidateText || '').trim();
  const isPresent = options.isPresent !== false;
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
  const tenseAnalysis = analyzeSpanishExperienceTenseAlignment({
    sourceText: visible || fact,
    candidateText: candidate,
    isPresent,
  });
  const visEval = evaluateExperienceVisibleComparison({
    factAuthorityText: fact,
    visibleComparisonText: visible,
    candidateText: candidate,
    locale: 'es',
    useVisibleForNoOp: visibleAvailable,
    capturedAtRequest: true,
    isPresent,
    crossLocaleOperation: Boolean(options.crossLocaleOperation),
  });

  // Spanish: never accept generic grounded_phrasing as sole billable reason.
  const rawKinds = (visEval.materialImprovementKinds || []).filter(
    (k) => k !== 'grounded_phrasing_enhancement',
  ) as ExperienceMaterialImprovementKind[];

  const improvementKinds: ExperienceMaterialImprovementKind[] = [...rawKinds];
  // Cross-locale warehouse translation with full coverage is a real improvement.
  // Prefer kinds already proven by visible comparison; only add wrong_locale_fixed
  // when missing. Never invent missing_fact_restored here — that requires the
  // visible comparison text to have actually lacked an authoritative fact.
  if (
    options.crossLocaleOperation
    && validation.candidateValid
    && validation.factCoveragePassed
    && !improvementKinds.includes('wrong_locale_fixed')
  ) {
    improvementKinds.push('wrong_locale_fixed');
  }
  // Complete bullets must never claim incomplete_bullet_completed (AAB-314/316).
  // Length growth alone is never evidence of incompleteness.
  if (
    improvementKinds.includes('incomplete_bullet_completed')
    && countIncompleteSpanishUnits(visible) === 0
  ) {
    const idx = improvementKinds.indexOf('incomplete_bullet_completed');
    if (idx >= 0) improvementKinds.splice(idx, 1);
  }
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
    && !options.crossLocaleOperation
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
  // AAB-316: already-valid source cannot be billably restyled. Only when the
  // request-time analysis explicitly marks the source valid (or zero defects)
  // do we strip non-defect improvement kinds. Do not infer validity solely from
  // tense/incomplete/surface — short but fact-incomplete sources must still
  // allow missing_fact_restored / repair apply.
  const DEFECT_FIX_KINDS = new Set<ExperienceMaterialImprovementKind>([
    'wrong_tense_fixed',
    'wrong_locale_fixed',
    'malformed_sentence_fixed',
    'missing_fact_restored',
    'missing_source_unit_restored',
    'incomplete_bullet_completed',
  ]);
  const sourceAlreadyValid = options.sourceAlreadyValidForTarget === true
    || (
      options.sourceCorrectableDefectCount === 0
      && options.sourceAlreadyValidForTarget !== false
      && countIncompleteSpanishUnits(visible) === 0
      && tenseAnalysis.sourceTenseMismatchCount === 0
      && visSurface.passed
    );
  const uniqueImpFinal: ExperienceMaterialImprovementKind[] = sourceAlreadyValid
    ? uniqueImp.filter((k) => DEFECT_FIX_KINDS.has(k)
      && (k !== 'incomplete_bullet_completed'
        || countIncompleteSpanishUnits(visible) > 0)
      && (k !== 'wrong_tense_fixed'
        || tenseAnalysis.sourceTenseMismatchCount > 0))
    : uniqueImp;
  const evidence = evidenceForKinds(uniqueImpFinal, visible, candidate, {
    isPresent,
    tenseAnalysis,
  });
  const everyKindHasEvidence = uniqueImpFinal.every((k) =>
    evidence.some((e) => e.kind === k && e.validationPassed !== false));
  const evidenceValidated = evidence.length > 0
    && evidence.every((e) => e.validationPassed !== false)
    && everyKindHasEvidence
    && evidence.length >= uniqueImpFinal.length;

  const degradationKinds: ExperienceDegradationKind[] = [
    ...visEval.degradationKinds,
  ];
  if (!validation.surfaceFormPassed) {
    degradationKinds.push('clarity_reduced');
  }
  if (!validation.candidateValid && candidate && validation.unsupportedCount > 0) {
    degradationKinds.push('unsupported_object_introduced');
  }
  if (!validation.candidateValid && candidate && !validation.factCoveragePassed) {
    degradationKinds.push('fact_lost');
  }
  if (
    !validation.candidateValid
    && candidate
    && validation.predicateCoveragePassed === false
    && !degradationKinds.includes('unsupported_predicate_added')
  ) {
    degradationKinds.push('unsupported_predicate_added');
  }
  const uniqueDeg = [...new Set(degradationKinds)];
  // Invariant: degradationDetected ⇔ degradationKinds.length > 0
  const degradation = uniqueDeg.length > 0;

  const tenseOnlyMeta = options.tenseOnlyMeta || null;
  const tenseOnlyCorrectionDetected = Boolean(
    uniqueImpFinal.length === 1
    && uniqueImpFinal[0] === 'wrong_tense_fixed'
    && tenseAnalysis.sourceTenseMismatchCount > 0
    && tenseAnalysis.candidateTenseMismatchCount === 0,
  );
  const srcLen = (visible || fact).replace(/\s+/g, ' ').trim().length;
  const candLen = candidate.replace(/\s+/g, ' ').trim().length;
  const tenseOnlySourceLength = tenseOnlyMeta?.tenseOnlySourceLength ?? srcLen;
  const tenseOnlyCandidateLength = tenseOnlyMeta?.tenseOnlyCandidateLength ?? candLen;
  const tenseOnlyUnexpectedExpansionDetected = tenseOnlyCorrectionDetected
    && (
      tenseOnlyMeta?.tenseOnlyUnexpectedExpansionDetected
      ?? ((candLen - srcLen) > Math.max(24, Math.floor(srcLen * 0.12)))
    );
  const tenseOnlyPreservationPassed = tenseOnlyCorrectionDetected
    ? (
      tenseOnlyMeta?.tenseOnlyPreservationPassed
      ?? (!tenseOnlyUnexpectedExpansionDetected
        && splitExperienceBullets(candidate).filter(Boolean).length
          === splitExperienceBullets(visible || fact).filter(Boolean).length)
    )
    : null;

  const semanticNoOp = Boolean(
    validation.candidateValid
    && visibleAvailable
    && uniqueImpFinal.length === 0
    && (exactNoOp || normalizedNoOp || semanticEq || visEval.semanticNoOpDetected),
  );
  const neutralRestyle = Boolean(
    semanticNoOp && !exactNoOp && !normalizedNoOp,
  );
  const materialImprovementBase = Boolean(
    validation.candidateValid
    && validation.surfaceFormPassed
    && !degradation
    && !semanticNoOp
    && uniqueImpFinal.length > 0
    && evidenceValidated,
  );
  const materialImprovement = Boolean(
    materialImprovementBase
    && (!tenseOnlyCorrectionDetected || tenseOnlyPreservationPassed === true)
    && !tenseOnlyUnexpectedExpansionDetected,
  );

  const canonicalAcceptancePassed = Boolean(
    materialImprovement
    && validation.candidateValid
    && validation.surfaceFormPassed
    && validation.predicateCoveragePassed === true
    && (validation.sourcePredicateIdentityCount ?? 0) > 0
    && (validation.candidatePredicateIdentityCount ?? 0) > 0
    && validation.sourcePredicateExtractionPassed !== false
    && validation.unsupportedCount === 0
    && uniqueImpFinal.length > 0
    && evidenceValidated
    && (!tenseOnlyCorrectionDetected || tenseOnlyPreservationPassed === true),
  );

  let finalDecisionKind: ExperienceCanonicalDecisionKind = 'none';
  if (!candidate) finalDecisionKind = 'terminal_failure';
  else if (validation.sourcePredicateExtractionPassed === false) {
    finalDecisionKind = 'invalid_candidate_rejected';
  } else if (!validation.candidateValid || !validation.surfaceFormPassed) {
    finalDecisionKind = validation.surfaceFormPassed
      ? 'invalid_candidate_rejected'
      : 'degradation_rejected';
  } else if (degradation && !materialImprovement) {
    finalDecisionKind = 'degradation_rejected';
  } else if (materialImprovement && canonicalAcceptancePassed) {
    finalDecisionKind = 'material_improvement';
  } else if (materialImprovement && !canonicalAcceptancePassed) {
    finalDecisionKind = 'invalid_candidate_rejected';
  } else if (exactNoOp) finalDecisionKind = 'exact_noop';
  else if (normalizedNoOp) finalDecisionKind = 'normalized_noop';
  else if (neutralRestyle) finalDecisionKind = 'neutral_restyle_noop';
  else if (semanticNoOp) finalDecisionKind = 'semantic_noop';
  else finalDecisionKind = 'invalid_candidate_rejected';

  const shouldApply = finalDecisionKind === 'material_improvement'
    && canonicalAcceptancePassed;

  let finalTypedReason: string | null = null;
  if (shouldApply) finalTypedReason = null;
  else if (validation.sourcePredicateExtractionPassed === false) {
    finalTypedReason = 'source_predicate_extraction_failed';
  } else if (finalDecisionKind === 'degradation_rejected') {
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
    materialImprovement: shouldApply,
    materialImprovementKinds: shouldApply ? uniqueImpFinal : [],
    materialImprovementEvidence: shouldApply ? evidence : [],
    degradation: Boolean(degradation && !shouldApply),
    degradationKinds: shouldApply ? [] : uniqueDeg,
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
    canonicalAcceptancePassed,
    expectedEmploymentTense: tenseAnalysis.expectedEmploymentTense,
    sourceDetectedTense: tenseAnalysis.sourceDetectedTense,
    sourceTenseMismatchCount: tenseAnalysis.sourceTenseMismatchCount,
    candidateDetectedTense: tenseAnalysis.candidateDetectedTense,
    candidateTenseMismatchCount: tenseAnalysis.candidateTenseMismatchCount,
    wrongTenseFixedUnitCount: tenseAnalysis.wrongTenseFixedUnitCount,
    tenseOnlyCorrectionDetected,
    tenseOnlySourceLength,
    tenseOnlyCandidateLength,
    tenseOnlyUnexpectedExpansionDetected: Boolean(tenseOnlyUnexpectedExpansionDetected),
    tenseOnlyPreservationPassed,
    everyImprovementKindHasEvidence: everyKindHasEvidence,
    materialImprovementEvidenceCount: shouldApply ? evidence.length : 0,
    finalCandidatePredicateIdentityCount:
      validation.candidatePredicateIdentityCount ?? null,
    finalSourceUnitPredicateCoveragePassed: validation.predicateCoveragePassed,
    sourcePredicateIdentityCount: validation.sourcePredicateIdentityCount ?? null,
    sourcePredicateExtractionPassed: validation.sourcePredicateExtractionPassed ?? null,
  };
}

/**
 * Conservative Spanish recovery:
 * 1) validate provider (reject tense-only over-expansion)
 * 2) one structured repair
 * 3) minimal deterministic tense normalizer when pure tense defect
 * 4) warehouse / deterministic rebuild
 * 5) decide vs visible comparison
 */
export function finalizeSpanishExperienceCandidateConservatively(options: {
  factAuthorityText: string;
  visibleComparisonText: string;
  providerCandidateText: string;
  isPresent?: boolean;
  locale?: string;
  sourceAlreadyValidForTarget?: boolean;
  sourceCorrectableDefectCount?: number;
}): {
  decision: ExperienceCanonicalFinalDecision;
  providerValidation: ExperienceCanonicalCandidateValidation;
  repair: ReturnType<typeof repairSpanishExperienceCandidateStructured> | null;
  deterministic: ReturnType<typeof buildSpanishExperienceDeterministicCandidate> | null;
} {
  void EXPERIENCE_CANONICAL_FINALIZATION_313_REVISION;
  void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  const fact = (options.factAuthorityText || '').trim();
  const visible = (options.visibleComparisonText || '').trim();
  const provider = (options.providerCandidateText || '').trim();
  const isPresent = options.isPresent !== false;
  const baseline = visible || fact;
  const decideOpts = {
    sourceAlreadyValidForTarget: options.sourceAlreadyValidForTarget,
    sourceCorrectableDefectCount: options.sourceCorrectableDefectCount,
  };
  const sourceTense = analyzeSpanishExperienceTenseAlignment({
    sourceText: baseline,
    candidateText: baseline,
    isPresent,
  });
  const pureTenseDefect = sourceTense.sourceTenseMismatchCount > 0
    && countIncompleteSpanishUnits(baseline) === 0;

  const providerValidation = validateSpanishExperienceCandidate({
    factAuthorityText: fact,
    candidateText: provider,
    candidateOrigin: 'provider',
  });
  if (providerValidation.candidateValid && provider.trim()) {
    const providerTense = analyzeSpanishExperienceTenseAlignment({
      sourceText: baseline,
      candidateText: provider,
      isPresent,
    });
    const srcLen = baseline.replace(/\s+/g, ' ').trim().length;
    const candLen = provider.replace(/\s+/g, ' ').trim().length;
    const overExpanded = pureTenseDefect
      && (candLen - srcLen) > Math.max(24, Math.floor(srcLen * 0.12));
    const providerFixesTense = providerTense.candidateTenseMismatchCount === 0
      && providerTense.sourceTenseMismatchCount > 0;
    if (!(pureTenseDefect && (overExpanded || !providerFixesTense))) {
      const decision = decideSpanishExperienceFinalCandidate({
        factAuthorityText: fact,
        visibleComparisonText: visible,
        candidateText: provider,
        candidateOrigin: 'provider',
        isPresent,
        ...decideOpts,
      });
      if (decision.shouldApply || !pureTenseDefect) {
        return {
          decision,
          providerValidation,
          repair: null,
          deterministic: null,
        };
      }
    }
    // Pure tense defect with unsafe/over-expanded provider → tense normalizer.
  }

  const repair = repairSpanishExperienceCandidateStructured({
    factAuthorityText: fact,
    candidateText: provider,
  });
  if (repair.valid && repair.repairedText.trim() && !pureTenseDefect) {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: fact,
      visibleComparisonText: visible,
      candidateText: repair.repairedText,
      candidateOrigin: 'unsupported_claim_repair',
      isPresent,
      repairProduced: repair.produced,
      repairValid: repair.valid,
      repairSelectedForComparison: true,
      ...decideOpts,
    });
    if (decision.shouldApply) {
      return { decision, providerValidation, repair, deterministic: null };
    }
  }

  // Pure tense: minimal conjugation-preserving normalizer before warehouse shells.
  if (pureTenseDefect) {
    const tenseNorm = normalizeSpanishExperienceTenseOnly({
      sourceText: baseline,
      isPresent,
    });
    if (
      tenseNorm.changed
      && tenseNorm.tenseOnlyPreservationPassed
      && !tenseNorm.tenseOnlyUnexpectedExpansionDetected
    ) {
      const tenseValidation = validateSpanishExperienceCandidate({
        factAuthorityText: fact || baseline,
        candidateText: tenseNorm.text,
        candidateOrigin: 'deterministic_tense_normalizer',
      });
      if (tenseValidation.candidateValid) {
        const decision = decideSpanishExperienceFinalCandidate({
          factAuthorityText: fact || baseline,
          visibleComparisonText: visible || baseline,
          candidateText: tenseNorm.text,
          candidateOrigin: 'deterministic_tense_normalizer',
          isPresent,
          tenseOnlyMeta: tenseNorm,
          repairProduced: repair.produced,
          repairValid: repair.valid,
          ...decideOpts,
        });
        if (decision.shouldApply) {
          return {
            decision,
            providerValidation,
            repair,
            deterministic: {
              text: tenseNorm.text,
              validation: tenseValidation,
              tenseOnly: tenseNorm,
            },
          };
        }
      }
    }
  }

  const deterministic = buildSpanishExperienceDeterministicCandidate({
    factAuthorityText: fact || baseline,
    isPresent,
    preferTenseOnly: pureTenseDefect,
  });
  if (!deterministic.validation.candidateValid || !deterministic.text.trim()) {
    if (repair.valid && repair.repairedText.trim()) {
      const noopDecision = decideSpanishExperienceFinalCandidate({
        factAuthorityText: fact,
        visibleComparisonText: visible,
        candidateText: repair.repairedText,
        candidateOrigin: 'unsupported_claim_repair',
        isPresent,
        repairProduced: repair.produced,
        repairValid: repair.valid,
        repairSelectedForComparison: true,
        ...decideOpts,
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
        finalTypedReason: validationExtractionReason(deterministic)
          || (visible ? 'ai_noop' : 'experience_generation_failed'),
        selectedText: visible,
        unsupportedClaimRepairCandidateProduced: repair.produced,
        unsupportedClaimRepairCandidateValid: repair.valid,
        unsupportedClaimRepairSelectedForComparison: false,
        unsupportedClaimRepairVisibleApplyPerformed: false,
        canonicalAcceptancePassed: false,
      },
      providerValidation,
      repair,
      deterministic,
    };
  }
  const decision = decideSpanishExperienceFinalCandidate({
    factAuthorityText: fact || baseline,
    visibleComparisonText: visible,
    candidateText: deterministic.text,
    candidateOrigin: deterministic.tenseOnly
      ? 'deterministic_tense_normalizer'
      : 'deterministic_fallback',
    isPresent,
    tenseOnlyMeta: deterministic.tenseOnly,
    repairProduced: repair.produced,
    repairValid: repair.valid,
    repairSelectedForComparison: false,
    ...decideOpts,
  });
  return { decision, providerValidation, repair, deterministic };
}

/** AAB-316 alias — sole Spanish Experience finalization entrypoint. */
export function finalizeSpanishExperienceCandidate(
  options: Parameters<typeof finalizeSpanishExperienceCandidateConservatively>[0],
): ReturnType<typeof finalizeSpanishExperienceCandidateConservatively> {
  void EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION;
  return finalizeSpanishExperienceCandidateConservatively(options);
}

function validationExtractionReason(
  deterministic: ReturnType<typeof buildSpanishExperienceDeterministicCandidate>,
): string | null {
  if (deterministic.validation.sourcePredicateExtractionPassed === false) {
    return 'source_predicate_extraction_failed';
  }
  return null;
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
