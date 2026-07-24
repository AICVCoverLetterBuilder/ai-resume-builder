/**
 * AAB-315 — Experience visible-source defect analysis must complete before
 * provider no-op classification. Exact provider match is not a final no-op when
 * the visible source still violates a known target contract (tense, locale, …).
 */
import { fingerprintText } from './cv-export-diagnostics';
import { splitExperienceBullets } from './cv-canonical-facts';
import { detectTextLocale } from './cv-content-locale';
import {
  detectSpanishExperiencePredicateExpansion,
  detectSpanishExperienceUnsupportedExpansion,
} from './cv-spanish-experience-grounding';
import {
  analyzeSpanishExperienceTenseAlignment,
  analyzeSpanishExperienceUnitTense,
  countIncompleteSpanishUnits,
  unitHasIncompleteSpanishSurface,
  SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION,
  SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION,
} from './cv-spanish-experience-morphology';
import { validateSpanishExperienceSurfaceForm } from './cv-experience-canonical-finalization';

export const EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION =
  'experience-source-defect-first-decision-315-v1' as const;
export const SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION =
  'spanish-experience-provider-noop-tense-recovery-315-v1' as const;
export const SPANISH_EXPERIENCE_FINAL_TENSE_ACCEPTANCE_315_REVISION =
  'spanish-experience-final-tense-acceptance-315-v1' as const;
export const EXPERIENCE_TENSE_DECISION_DIAGNOSTICS_315_REVISION =
  'experience-tense-decision-diagnostics-315-v1' as const;

void EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION;
void SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION;
void SPANISH_EXPERIENCE_FINAL_TENSE_ACCEPTANCE_315_REVISION;
void EXPERIENCE_TENSE_DECISION_DIAGNOSTICS_315_REVISION;
void SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION;
void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;

export type ExperienceCorrectableDefectKind =
  | 'wrong_tense'
  | 'wrong_locale'
  | 'malformed_sentence'
  | 'incomplete_unit'
  | 'missing_source_unit'
  | 'unsupported_visible_claim'
  | 'duplicate_unit'
  | 'perspective_mismatch'
  | 'source_predicate_extraction_failed';

export type ExperienceVisibleSourceAnalysis = {
  revision: typeof EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION;
  sourceLocale: string;
  sourceLocaleValid: boolean;
  sourceUnitCount: number;
  sourcePredicateIdentityCount: number;
  sourcePredicateExtractionPassed: boolean;
  sourceUnitsWithPredicates: number;
  sourceUnitsMissingPredicates: number;
  expectedEmploymentTense: 'present' | 'past' | null;
  detectedTenseByUnit: Array<'present' | 'past' | 'mixed' | 'unknown'>;
  sourceDetectedTense: 'present' | 'past' | 'mixed' | 'unknown' | null;
  sourcePastUnitCount: number;
  sourcePresentUnitCount: number;
  tenseMismatchUnitHashes: string[];
  tenseMismatchCount: number;
  localeMismatchCount: number;
  malformedUnitHashes: string[];
  malformedUnitCount: number;
  incompleteUnitHashes: string[];
  incompleteUnitCount: number;
  duplicateUnitCount: number;
  unsupportedVisibleClaimKinds: string[];
  unsupportedVisibleClaimCount: number;
  missingRequiredSourceUnitCount: number;
  perspectiveMismatchCount: number;
  correctableDefectKinds: ExperienceCorrectableDefectKind[];
  correctableDefectCount: number;
  sourceAlreadyValidForTarget: boolean;
  sourceTenseValidationPassed: boolean | null;
  primaryUnresolvedDefectKind: ExperienceCorrectableDefectKind | null;
};

function emptyAnalysis(
  overrides: Partial<ExperienceVisibleSourceAnalysis> = {},
): ExperienceVisibleSourceAnalysis {
  return {
    revision: EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION,
    sourceLocale: 'unknown',
    sourceLocaleValid: true,
    sourceUnitCount: 0,
    sourcePredicateIdentityCount: 0,
    sourcePredicateExtractionPassed: true,
    sourceUnitsWithPredicates: 0,
    sourceUnitsMissingPredicates: 0,
    expectedEmploymentTense: null,
    detectedTenseByUnit: [],
    sourceDetectedTense: null,
    sourcePastUnitCount: 0,
    sourcePresentUnitCount: 0,
    tenseMismatchUnitHashes: [],
    tenseMismatchCount: 0,
    localeMismatchCount: 0,
    malformedUnitHashes: [],
    malformedUnitCount: 0,
    incompleteUnitHashes: [],
    incompleteUnitCount: 0,
    duplicateUnitCount: 0,
    unsupportedVisibleClaimKinds: [],
    unsupportedVisibleClaimCount: 0,
    missingRequiredSourceUnitCount: 0,
    perspectiveMismatchCount: 0,
    correctableDefectKinds: [],
    correctableDefectCount: 0,
    sourceAlreadyValidForTarget: true,
    sourceTenseValidationPassed: null,
    primaryUnresolvedDefectKind: null,
    ...overrides,
  };
}

/**
 * Analyze the visible Experience source against the target contract before any
 * provider no-op classification.
 */
export function analyzeExperienceVisibleSource(options: {
  visibleText: string;
  targetLocale: string;
  isPresent?: boolean;
  storedLocale?: string | null;
}): ExperienceVisibleSourceAnalysis {
  void EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION;
  const visible = (options.visibleText || '').trim();
  const targetLocale = (options.targetLocale || 'en').toLowerCase();
  const isPresent = options.isPresent !== false;
  if (!visible) {
    return emptyAnalysis({
      sourceLocale: targetLocale,
      expectedEmploymentTense: isPresent ? 'present' : 'past',
    });
  }

  const units = splitExperienceBullets(visible).filter(Boolean);
  const detectedLocale = detectTextLocale(visible, {
    storedLocale: options.storedLocale || targetLocale,
    generatedLocale: options.storedLocale || targetLocale,
  });
  const sourceLocale = detectedLocale === 'unknown' ? targetLocale : detectedLocale;
  const localeMismatchCount = (() => {
    const src = sourceLocale.toLowerCase();
    const tgt = targetLocale;
    if (!src || src === 'unknown') return 0;
    if (src === tgt) return 0;
    if ((src === 'sr' || src === 'hr') && (tgt === 'sr' || tgt === 'hr')) return 0;
    return 1;
  })();

  const isEs = targetLocale.startsWith('es') || sourceLocale.toLowerCase().startsWith('es');
  if (!isEs) {
    return emptyAnalysis({
      sourceLocale,
      sourceLocaleValid: localeMismatchCount === 0,
      sourceUnitCount: units.length,
      localeMismatchCount,
      expectedEmploymentTense: isPresent ? 'present' : 'past',
      correctableDefectKinds: localeMismatchCount > 0 ? ['wrong_locale'] : [],
      correctableDefectCount: localeMismatchCount > 0 ? 1 : 0,
      sourceAlreadyValidForTarget: localeMismatchCount === 0,
      primaryUnresolvedDefectKind: localeMismatchCount > 0 ? 'wrong_locale' : null,
    });
  }

  const pred = detectSpanishExperiencePredicateExpansion(visible, visible);
  const tense = analyzeSpanishExperienceTenseAlignment({
    sourceText: visible,
    candidateText: visible,
    isPresent,
  });
  const detectedTenseByUnit = units.map((u) => analyzeSpanishExperienceUnitTense(u));
  const surface = validateSpanishExperienceSurfaceForm(visible);
  const malformedUnitHashes: string[] = [];
  const incompleteUnitHashes: string[] = [];
  for (const u of units) {
    const unitSurface = validateSpanishExperienceSurfaceForm(u);
    if (!unitSurface.passed) malformedUnitHashes.push(fingerprintText(u.trim()));
    if (unitHasIncompleteSpanishSurface(u)) incompleteUnitHashes.push(fingerprintText(u.trim()));
  }
  const incompleteUnitCount = countIncompleteSpanishUnits(visible);
  const visScan = detectSpanishExperienceUnsupportedExpansion(visible, visible);
  const hashes = units.map((u) => fingerprintText(u.trim()));
  const uniqueHashes = new Set(hashes);
  const duplicateUnitCount = Math.max(0, hashes.length - uniqueHashes.size);

  const kinds: ExperienceCorrectableDefectKind[] = [];
  if (localeMismatchCount > 0) kinds.push('wrong_locale');
  if (tense.sourceTenseMismatchCount > 0) kinds.push('wrong_tense');
  if (!pred.sourcePredicateExtractionPassed || pred.sourcePredicateIdentityCount === 0) {
    kinds.push('source_predicate_extraction_failed');
  }
  if (malformedUnitHashes.length > 0 || !surface.passed) kinds.push('malformed_sentence');
  if (incompleteUnitCount > 0) kinds.push('incomplete_unit');
  if (visScan.count > 0) kinds.push('unsupported_visible_claim');
  if (duplicateUnitCount > 0) kinds.push('duplicate_unit');

  const uniqueKinds = [...new Set(kinds)];
  const primary = uniqueKinds.includes('wrong_tense')
    ? 'wrong_tense'
    : (uniqueKinds[0] || null);

  return {
    revision: EXPERIENCE_SOURCE_DEFECT_FIRST_DECISION_315_REVISION,
    sourceLocale,
    sourceLocaleValid: localeMismatchCount === 0,
    sourceUnitCount: units.length,
    sourcePredicateIdentityCount: pred.sourcePredicateIdentityCount,
    sourcePredicateExtractionPassed: pred.sourcePredicateExtractionPassed,
    sourceUnitsWithPredicates: pred.sourceUnitsWithPredicateCount,
    sourceUnitsMissingPredicates: pred.sourceUnitsMissingPredicateCount,
    expectedEmploymentTense: tense.expectedEmploymentTense,
    detectedTenseByUnit,
    sourceDetectedTense: tense.sourceDetectedTense,
    sourcePastUnitCount: tense.sourcePastUnitCount,
    sourcePresentUnitCount: tense.sourcePresentUnitCount,
    tenseMismatchUnitHashes: [...tense.mismatchedSourceUnitHashes],
    tenseMismatchCount: tense.sourceTenseMismatchCount,
    localeMismatchCount,
    malformedUnitHashes,
    malformedUnitCount: malformedUnitHashes.length,
    incompleteUnitHashes,
    incompleteUnitCount,
    duplicateUnitCount,
    unsupportedVisibleClaimKinds: [...visScan.kinds],
    unsupportedVisibleClaimCount: visScan.count,
    missingRequiredSourceUnitCount: 0,
    perspectiveMismatchCount: 0,
    correctableDefectKinds: uniqueKinds,
    correctableDefectCount: uniqueKinds.length,
    sourceAlreadyValidForTarget: uniqueKinds.length === 0,
    sourceTenseValidationPassed: tense.sourceTenseMismatchCount === 0,
    primaryUnresolvedDefectKind: primary,
  };
}

/** Provider exact/semantic match may be a final no-op only when source is already valid. */
export function providerNoOpEligibleAsFinal(
  analysis: ExperienceVisibleSourceAnalysis | null | undefined,
): boolean {
  void SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION;
  if (!analysis) return true;
  return analysis.sourceAlreadyValidForTarget === true;
}

export function providerUnresolvedSourceDefectReason(
  analysis: ExperienceVisibleSourceAnalysis | null | undefined,
): string {
  void SPANISH_EXPERIENCE_PROVIDER_NOOP_TENSE_RECOVERY_315_REVISION;
  const kind = analysis?.primaryUnresolvedDefectKind;
  if (kind === 'wrong_tense') return 'unresolved_wrong_tense';
  if (kind === 'wrong_locale') return 'unresolved_wrong_locale';
  if (kind === 'malformed_sentence') return 'unresolved_malformed_sentence';
  if (kind === 'incomplete_unit') return 'unresolved_incomplete_unit';
  if (kind === 'unsupported_visible_claim') return 'unresolved_unsupported_visible_claim';
  if (kind === 'source_predicate_extraction_failed') {
    return 'source_predicate_extraction_failed';
  }
  if (kind) return `unresolved_${kind}`;
  return 'unresolved_source_defect';
}
