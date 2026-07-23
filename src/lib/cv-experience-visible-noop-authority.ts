/**
 * AAB-311 — dual-source Experience authority:
 * fact authority (pre-AI / original) vs visible comparison (current textarea).
 *
 * Unedited prior AI output must never become fact authority, but it is the
 * mandatory no-op / degradation / meaningful-change baseline on re-run.
 */
import { fingerprintText } from './cv-export-diagnostics';
import {
  experienceAiSourcesEquivalent,
  normalizeExperienceAiSourceText,
} from './cv-experience-ai-operation-snapshot';
import { experienceAiHasMeaningfulChange } from './cv-experience-perspective';
import { splitExperienceBullets } from './cv-canonical-facts';
import { materialDutyKeysFromDescription } from './cv-material-duty-coverage';
import { detectSpanishExperienceUnsupportedExpansion } from './cv-spanish-experience-grounding';

/** Packaging proof — must survive minification / DCE. */
export const EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION =
  'experience-visible-noop-authority-311-v1' as const;

void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;

export type ExperienceVisibleComparisonKind =
  | 'currentTextarea'
  | 'liveRawSnapshot'
  | 'none';

export type ExperienceMaterialImprovementKind =
  | 'restored_missing_fact'
  | 'fixed_locale'
  | 'fixed_tense'
  | 'fixed_grammar'
  | 'removed_duplication'
  | 'removed_unsupported_material'
  | 'repaired_incomplete_sentence'
  | 'restored_missing_bullet'
  | 'severe_readability';

export type ExperienceDegradationKind =
  | 'unsupported_object_introduced'
  | 'compliance_scope_introduced'
  | 'fact_lost'
  | 'clarity_reduced'
  | 'redundancy_added'
  | 'tense_regressed'
  | 'unsupported_predicate_added'
  | 'restyle_without_benefit';

export type ExperienceVisibleComparisonEvaluation = {
  revision: typeof EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  visibleComparisonSourceKind: ExperienceVisibleComparisonKind;
  visibleComparisonHash: string | null;
  visibleComparisonNormalizedHash: string | null;
  visibleComparisonUnitCount: number;
  visibleComparisonProvenance: string | null;
  visibleComparisonMatchedLastAiOutput: boolean;
  visibleComparisonUsedForNoOp: boolean;
  visibleComparisonUsedForDegradationCheck: boolean;
  finalMatchesVisibleComparisonAfterNormalization: boolean;
  finalSemanticallyEquivalentToVisibleComparison: boolean;
  semanticNoOpDetected: boolean;
  semanticNoOpReason: string | null;
  materialImprovementDetected: boolean;
  materialImprovementKinds: ExperienceMaterialImprovementKind[];
  degradationDetected: boolean;
  degradationKinds: ExperienceDegradationKind[];
};

function hashNormalized(text: string): string | null {
  const n = normalizeExperienceAiSourceText(text || '');
  return n ? fingerprintText(n) : null;
}

/**
 * Spanish warehouse semantic skeleton: synonym / optional-location insensitive.
 * Does not authorize new facts — only equates grounded realizations.
 */
export function normalizeSpanishExperienceSemanticSkeleton(text: string): string {
  void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  return normalizeExperienceAiSourceText(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\b(revisa|reviso|comprueba|comproba|verifica|controla|inspecciona|examina)(?:r|ndo|do|da|dos|das)?\b/giu, 'VERIF')
    .replace(/\b(coordina|colabora)(?:r|ndo|do|da)?\b/giu, 'COORD')
    .replace(/\b(?:en|dentro\s+de(?:l)?)\s+(?:el\s+)?almacen\b/giu, '')
    .replace(/\bcon\s+(?:la\s+)?mercancia\s+recibida\b/giu, '')
    .replace(/\bmercancia\s+(?:entrante|recibida)\b/giu, 'MERC')
    .replace(/\bdocumentacion\s+relacionad\w*\b/giu, 'DOC_REL')
    .replace(/\bdocumentacion\b/giu, 'DOC')
    .replace(/\bpreparacion\b/giu, 'PREP')
    .replace(/\bmovimiento\b/giu, 'MOV')
    .replace(/\bcompaneros?\b/giu, 'PEERS')
    .replace(/[^\p{L}\p{N}\s_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function experienceSpanishWarehouseSemanticallyEquivalent(
  a: string,
  b: string,
): boolean {
  void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  if (experienceAiSourcesEquivalent(a, b)) return true;
  const unitsA = splitExperienceBullets(a || '').filter(Boolean);
  const unitsB = splitExperienceBullets(b || '').filter(Boolean);
  if (unitsA.length !== unitsB.length || unitsA.length === 0) return false;
  for (let i = 0; i < unitsA.length; i += 1) {
    const sa = normalizeSpanishExperienceSemanticSkeleton(unitsA[i] || '');
    const sb = normalizeSpanishExperienceSemanticSkeleton(unitsB[i] || '');
    if (!sa || !sb || sa !== sb) return false;
  }
  const keysA = [...materialDutyKeysFromDescription(a || '')].sort().join('|');
  const keysB = [...materialDutyKeysFromDescription(b || '')].sort().join('|');
  return keysA === keysB;
}

export function experienceVisibleTextsSemanticallyEquivalent(
  visible: string,
  candidate: string,
  locale: string,
): boolean {
  void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  if (experienceAiSourcesEquivalent(visible, candidate)) return true;
  if ((locale || '').toLowerCase().startsWith('es')) {
    return experienceSpanishWarehouseSemanticallyEquivalent(visible, candidate);
  }
  return false;
}

function complianceKindsPresent(kinds: string[]): boolean {
  return kinds.some((k) =>
    k === 'compliance_scope_expansion'
    || k === 'conformity_object_expansion'
    || k === 'certification_scope_expansion'
    || k === 'approval_scope_expansion'
    || k === 'quality_scope_expansion'
    || k === 'unsupported_object_expansion'
    || k === 'object_scope_expansion'
    || k === 'guarantee_escalation'
    || k === 'efficiency_claim'
    || k === 'action_scope_expansion'
    || k === 'coordinated_predicate_expansion'
    || k === 'document_management_expansion');
}

/**
 * Evaluate a grounded candidate against the visible comparison baseline.
 * Fact authority is separate and must not be used as the no-op reference.
 */
export function evaluateExperienceVisibleComparison(options: {
  factAuthorityText: string;
  visibleComparisonText: string;
  candidateText: string;
  locale: string;
  visibleComparisonProvenance?: string | null;
  matchedLastAiOutput?: boolean;
  useVisibleForNoOp?: boolean;
}): ExperienceVisibleComparisonEvaluation {
  void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  const visible = (options.visibleComparisonText || '').trim();
  const candidate = (options.candidateText || '').trim();
  const fact = (options.factAuthorityText || '').trim();
  const locale = options.locale || 'en';
  const useVisible = options.useVisibleForNoOp !== false && Boolean(visible);
  const visibleHash = visible ? fingerprintText(visible) : null;
  const visibleNormHash = hashNormalized(visible);
  const units = splitExperienceBullets(visible).filter(Boolean);

  const exactNormMatch = useVisible && experienceAiSourcesEquivalent(visible, candidate);
  // Semantic synonym/location equivalence is only a no-op baseline when the
  // visible text is not the fact authority (unedited AI re-run). On first click,
  // visible ≈ fact and grounded polish (e.g. "en el almacén") may still apply.
  const visibleIsFactAuthority = Boolean(
    visible && fact && experienceAiSourcesEquivalent(visible, fact),
  );
  const allowSemanticNoOpBaseline = useVisible && !visibleIsFactAuthority;
  const semanticEq = allowSemanticNoOpBaseline
    && experienceVisibleTextsSemanticallyEquivalent(visible, candidate, locale);
  const textualDiffVsVisible = useVisible
    && experienceAiHasMeaningfulChange(visible, candidate);
  const textualDiffVsFact = fact
    ? experienceAiHasMeaningfulChange(fact, candidate)
    : textualDiffVsVisible;

  const degradationKinds: ExperienceDegradationKind[] = [];
  const improvementKinds: ExperienceMaterialImprovementKind[] = [];

  if (useVisible && candidate) {
    const isEs = (locale || '').toLowerCase().startsWith('es');
    const candScan = isEs
      ? detectSpanishExperienceUnsupportedExpansion(fact || visible, candidate)
      : { count: 0, kinds: [] as string[], candidateAddedPredicateCount: 0 };
    const visScan = isEs
      ? detectSpanishExperienceUnsupportedExpansion(fact || visible, visible)
      : { count: 0, kinds: [] as string[], candidateAddedPredicateCount: 0 };
    if (candScan.count > visScan.count && complianceKindsPresent(candScan.kinds)) {
      degradationKinds.push('unsupported_object_introduced');
      if (candScan.kinds.some((k) =>
        k.includes('compliance') || k.includes('conformity') || k.includes('certification')
        || k.includes('approval') || k.includes('quality_scope'))) {
        degradationKinds.push('compliance_scope_introduced');
      }
    }
    if ((candScan.candidateAddedPredicateCount ?? 0) > 0) {
      degradationKinds.push('unsupported_predicate_added');
    }
    const factKeys = new Set(materialDutyKeysFromDescription(fact || visible));
    const candKeys = new Set(materialDutyKeysFromDescription(candidate));
    const visKeys = new Set(materialDutyKeysFromDescription(visible));
    for (const k of factKeys) {
      if (!candKeys.has(k) && visKeys.has(k)) degradationKinds.push('fact_lost');
    }
    for (const k of factKeys) {
      if (!visKeys.has(k) && candKeys.has(k)) {
        improvementKinds.push('restored_missing_fact');
      }
    }
    if (visScan.count > 0 && candScan.count === 0) {
      improvementKinds.push('removed_unsupported_material');
    }
    const visUnits = splitExperienceBullets(visible).filter(Boolean).length;
    const candUnits = splitExperienceBullets(candidate).filter(Boolean).length;
    if (visUnits < factKeys.size && candUnits >= factKeys.size) {
      improvementKinds.push('restored_missing_bullet');
    }
    // Pure restyle: different text, same skeleton, no improvement signal.
    if (textualDiffVsVisible && semanticEq && improvementKinds.length === 0) {
      degradationKinds.push('restyle_without_benefit');
    }
  }

  const uniqueDeg = [...new Set(degradationKinds)];
  const uniqueImp = [...new Set(improvementKinds)];
  const degradationDetected = uniqueDeg.some((k) => k !== 'restyle_without_benefit')
    || (uniqueDeg.includes('restyle_without_benefit') && !semanticEq);
  const semanticNoOpDetected = Boolean(
    useVisible && candidate && (exactNormMatch || semanticEq) && uniqueImp.length === 0,
  );
  // Material improvement vs visible baseline:
  // - explicit improvement kinds, or
  // - first-click polish when visible ≡ fact, or
  // - unedited-AI re-run where candidate is a grounded rewrite of fact authority
  //   that is not a semantic restyle of the (possibly contaminated) visible text.
  const materialImprovementDetected = Boolean(
    useVisible
    && candidate
    && !semanticNoOpDetected
    && !degradationDetected
    && (
      uniqueImp.length > 0
      || (visibleIsFactAuthority && textualDiffVsFact && !exactNormMatch)
      || (
        // Unedited AI visible: any validated non-equivalent rewrite may apply
        // (e.g. deterministic fallback restoring pre-AI facts over contamination).
        // Synonym-only restyles of a good visible result are caught by semanticEq.
        !visibleIsFactAuthority
        && textualDiffVsVisible
        && !semanticEq
      )
    ),
  );

  return {
    revision: EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION,
    visibleComparisonSourceKind: visible
      ? (options.visibleComparisonProvenance === 'liveRawSnapshot'
        ? 'liveRawSnapshot'
        : 'currentTextarea')
      : 'none',
    visibleComparisonHash: visibleHash,
    visibleComparisonNormalizedHash: visibleNormHash,
    visibleComparisonUnitCount: units.length,
    visibleComparisonProvenance: options.visibleComparisonProvenance ?? null,
    visibleComparisonMatchedLastAiOutput: Boolean(options.matchedLastAiOutput),
    visibleComparisonUsedForNoOp: useVisible,
    visibleComparisonUsedForDegradationCheck: useVisible,
    finalMatchesVisibleComparisonAfterNormalization: exactNormMatch,
    finalSemanticallyEquivalentToVisibleComparison: semanticEq,
    semanticNoOpDetected,
    semanticNoOpReason: semanticNoOpDetected
      ? (exactNormMatch ? 'normalized_visible_match' : 'semantic_equivalent_visible')
      : null,
    materialImprovementDetected,
    materialImprovementKinds: materialImprovementDetected ? uniqueImp : [],
    degradationDetected,
    degradationKinds: uniqueDeg.filter((k) =>
      !(k === 'restyle_without_benefit' && semanticEq)),
  };
}

/** Whether re-run should use current textarea as no-op/degradation baseline. */
export function shouldUseVisibleComparisonForNoOp(options: {
  currentTextareaProvenance?: string | null;
  lastAiOutputHashMatched?: boolean | null;
  materialUserEditDetected?: boolean | null;
  visibleText?: string | null;
  factAuthorityText?: string | null;
}): boolean {
  void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  const visible = (options.visibleText || '').trim();
  if (!visible) return false;
  // Only unedited prior-AI re-runs require the visible textarea as no-op baseline.
  // Do not treat every fact-authority override (first enhance, cross-locale, etc.)
  // as a visible no-op gate — that regresses German/Hindi apply paths.
  if (options.currentTextareaProvenance === 'ai_generated_unedited') return true;
  if (options.lastAiOutputHashMatched === true && options.materialUserEditDetected === false) {
    return true;
  }
  void options.factAuthorityText;
  return false;
}
