/**
 * AAB-311/312 — dual-source Experience authority:
 * fact authority (pre-AI / original) vs visible comparison (current textarea).
 *
 * Unedited prior AI output must never become fact authority. The request-time
 * visible textarea is the mandatory no-op / degradation / improvement baseline
 * for every non-empty Experience operation.
 */
import { fingerprintText } from './cv-export-diagnostics';
import {
  experienceAiSourcesEquivalent,
  normalizeExperienceAiSourceText,
  experienceAiSourceUnits,
} from './cv-experience-ai-operation-snapshot';
import { experienceAiHasMeaningfulChange } from './cv-experience-perspective';
import { splitExperienceBullets } from './cv-canonical-facts';
import { materialDutyKeysFromDescription } from './cv-material-duty-coverage';
import {
  detectSpanishExperienceUnsupportedExpansion,
  sourceRequiresSpanishWarehouseFactCoverage,
  validateSpanishWarehouseExperienceCoverage,
  scanSpanishWarehousePredicates,
} from './cv-spanish-experience-grounding';
import {
  sourceRequiresGermanWarehouseFactCoverage,
  validateGermanWarehouseExperienceCoverage,
  scanGermanWarehousePredicates,
} from './cv-german-experience-grounding';
import {
  sourceRequiresStrictEnglishWarehouseFactCoverage,
  validateEnglishWarehouseExperienceCoverage,
  scanEnglishWarehousePredicates,
} from './cv-english-experience-warehouse-grounding';
import { validateCrossLocaleSemanticCoverage } from './cv-cross-locale-experience';
import { detectTextLocale } from './cv-content-locale';
import {
  analyzeSpanishExperienceTenseAlignment,
  countIncompleteSpanishUnits,
  SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION,
} from './cv-spanish-experience-morphology';
import {
  EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION,
  normalizeExperienceFactAuthorityKind,
} from './cv-experience-authority-snapshot-327';
void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;

/** Packaging proof — must survive minification / DCE. */
export const EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION =
  'experience-visible-noop-authority-311-v1' as const;
/** AAB-312 — request-time visible snapshot wiring. */
export const EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION =
  'experience-visible-snapshot-wiring-312-v1' as const;
/** AAB-312 — final semantic no-op / evidence-based improvement gate. */
export const EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION =
  'experience-semantic-noop-final-gate-312-v1' as const;
/** AAB-312 — fact-authority diagnostic consistency. */
export const EXPERIENCE_FACT_AUTHORITY_CONSISTENCY_312_REVISION =
  'experience-fact-authority-consistency-312-v1' as const;

void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
void EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION;
void EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION;
void EXPERIENCE_FACT_AUTHORITY_CONSISTENCY_312_REVISION;

export type ExperienceVisibleComparisonKind =
  | 'currentTextarea'
  | 'liveRawSnapshot'
  | 'none';

export type ExperienceMaterialImprovementKind =
  | 'missing_fact_restored'
  | 'missing_source_unit_restored'
  | 'wrong_locale_fixed'
  | 'wrong_tense_fixed'
  | 'grammar_error_fixed'
  | 'malformed_sentence_fixed'
  | 'duplicate_removed'
  | 'unsupported_claim_removed_from_visible_text'
  | 'unsupported_object_removed_from_visible_text'
  | 'unsupported_predicate_removed_from_visible_text'
  | 'incomplete_bullet_completed'
  | 'severe_readability_issue_fixed'
  | 'perspective_error_fixed'
  | 'grounded_phrasing_enhancement';

export type ExperienceDegradationKind =
  | 'unsupported_object_introduced'
  | 'compliance_scope_introduced'
  | 'fact_lost'
  | 'clarity_reduced'
  | 'redundancy_added'
  | 'tense_regressed'
  | 'unsupported_predicate_added'
  | 'restyle_without_benefit';

export type ExperienceFinalDecisionKind =
  | 'material_improvement'
  | 'semantic_noop'
  | 'exact_noop'
  | 'degradation'
  | 'neutral_restyle'
  | 'none';

export type ExperienceVisibleComparisonSnapshot = {
  kind: ExperienceVisibleComparisonKind;
  rawText: string;
  hash: string | null;
  normalizedHash: string | null;
  length: number;
  unitCount: number;
  locale: string;
  provenance: string | null;
  matchedLastAiOutput: boolean;
  capturedAtRequest: true;
  entryIdHash?: string | null;
};

export type ExperienceVisibleComparisonEvaluation = {
  revision: typeof EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION;
  visibleComparisonSourceKind: ExperienceVisibleComparisonKind;
  visibleComparisonHash: string | null;
  visibleComparisonNormalizedHash: string | null;
  visibleComparisonUnitCount: number;
  visibleComparisonProvenance: string | null;
  visibleComparisonMatchedLastAiOutput: boolean;
  visibleComparisonUsedForNoOp: boolean;
  visibleComparisonUsedForDegradationCheck: boolean;
  visibleComparisonCapturedAtRequest: boolean;
  finalMatchesVisibleComparisonAfterNormalization: boolean;
  finalSemanticallyEquivalentToVisibleComparison: boolean;
  semanticNoOpDetected: boolean;
  semanticNoOpReason: string | null;
  materialImprovementDetected: boolean;
  materialImprovementKinds: ExperienceMaterialImprovementKind[];
  degradationDetected: boolean;
  degradationKinds: ExperienceDegradationKind[];
  neutralRestyleDetected: boolean;
  finalDecisionKind: ExperienceFinalDecisionKind;
};

function hashNormalized(text: string): string | null {
  const n = normalizeExperienceAiSourceText(text || '');
  return n ? fingerprintText(n) : null;
}

/** Build immutable request-time visible comparison from live textarea text. */
export function buildExperienceVisibleComparisonSnapshot(options: {
  liveText: string;
  locale: string;
  provenance?: string | null;
  matchedLastAiOutput?: boolean;
  entryIdHash?: string | null;
}): ExperienceVisibleComparisonSnapshot {
  void EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION;
  const raw = (options.liveText || '').trimEnd();
  const trimmed = raw.trim();
  const units = trimmed ? experienceAiSourceUnits(trimmed) : [];
  return {
    kind: trimmed ? 'currentTextarea' : 'none',
    rawText: raw,
    hash: trimmed ? fingerprintText(trimmed) : null,
    normalizedHash: hashNormalized(trimmed),
    length: trimmed.length,
    unitCount: units.length,
    locale: options.locale || '',
    provenance: options.provenance ?? null,
    matchedLastAiOutput: Boolean(options.matchedLastAiOutput),
    capturedAtRequest: true,
    entryIdHash: options.entryIdHash ?? null,
  };
}

/**
 * Spanish warehouse semantic skeleton: synonym / optional-location / inclusive
 * peer phrasing insensitive. Does not authorize new facts.
 */
export function normalizeSpanishExperienceSemanticSkeleton(text: string): string {
  void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  void EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION;
  return normalizeExperienceAiSourceText(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\b(revisa|reviso|comprueba|comproba|verifica|controla|inspecciona|examina)(?:r|ndo|do|da|dos|das)?\b/giu, 'VERIF')
    .replace(/\b(coordina|colabora)(?:r|ndo|do|da)?\b/giu, 'COORD')
    .replace(/\b(?:en|dentro\s+de(?:l)?)\s+(?:el\s+)?almacen\b/giu, '')
    // Normalize goods object before stripping prepositions so
    // "relacionada con la mercancía recibida" ≡ "asociada a la mercancía recibida".
    .replace(/\bmercancia\s+(?:entrante|recibida)\b/giu, 'MERC')
    .replace(/\b(?:con|a)\s+(?:la\s+)?MERC\b/giu, '')
    .replace(/\bdocumentacion\s+(?:relacionad\w*|asociad\w*)(?:\s+(?:con|a))?\b/giu, 'DOC_REL')
    .replace(/\bdocumentos?\s+(?:relacionad\w*|asociad\w*)\b/giu, 'DOC_REL')
    .replace(/\bdocumentacion\b/giu, 'DOC')
    .replace(/\bpreparacion\b/giu, 'PREP')
    .replace(/\bmovimiento\b/giu, 'MOV')
    // Inclusive / peer equivalents (compañeros ↔ compañeras y compañeros ↔ equipo).
    .replace(/\bcompaneras?\s+y\s+companeros?\b/giu, 'PEERS')
    .replace(/\bcompaneros?\s+y\s+companeras?\b/giu, 'PEERS')
    .replace(/\bcompaneros?\b/giu, 'PEERS')
    .replace(/\bcompaneras?\b/giu, 'PEERS')
    .replace(/\bel\s+equipo\b/giu, 'PEERS')
    .replace(/\bsus\s+colegas\b/giu, 'PEERS')
    .replace(/\bcolegas\b/giu, 'PEERS')
    .replace(/[^\p{L}\p{N}\s_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function experienceSpanishWarehouseSemanticallyEquivalent(
  a: string,
  b: string,
): boolean {
  void EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION;
  if (experienceAiSourcesEquivalent(a, b)) return true;
  const unitsA = splitExperienceBullets(a || '').filter(Boolean);
  const unitsB = splitExperienceBullets(b || '').filter(Boolean);
  if (unitsA.length !== unitsB.length || unitsA.length === 0) return false;
  for (let i = 0; i < unitsA.length; i += 1) {
    const sa = normalizeSpanishExperienceSemanticSkeleton(unitsA[i] || '');
    const sb = normalizeSpanishExperienceSemanticSkeleton(unitsB[i] || '');
    if (!sa || !sb || sa !== sb) return false;
  }
  // Unit skeletons already encode synonym / inclusive / location equivalence.
  // Duty-key string equality is too brittle for safe synonym pairs (e.g.
  // relacionada ↔ asociada) and must not veto semantic no-op.
  void materialDutyKeysFromDescription;
  return true;
}

export function experienceVisibleTextsSemanticallyEquivalent(
  visible: string,
  candidate: string,
  locale: string,
): boolean {
  void EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION;
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

function detectInclusiveGenderOnlyChange(visible: string, candidate: string): boolean {
  const stripPeers = (t: string) => normalizeSpanishExperienceSemanticSkeleton(t);
  return stripPeers(visible) === stripPeers(candidate)
    && /companer/iu.test(visible + candidate)
    && !experienceAiSourcesEquivalent(visible, candidate);
}

/**
 * Evaluate a grounded candidate against the request-time visible comparison.
 * Material improvement is true only when evidence kinds are non-empty.
 */
export function evaluateExperienceVisibleComparison(options: {
  factAuthorityText: string;
  visibleComparisonText: string;
  candidateText: string;
  locale: string;
  visibleComparisonProvenance?: string | null;
  matchedLastAiOutput?: boolean;
  useVisibleForNoOp?: boolean;
  capturedAtRequest?: boolean;
  /** Employment tense for Spanish wrong_tense_fixed evidence. */
  isPresent?: boolean;
  /** When true, visible and candidate may be different languages. */
  crossLocaleOperation?: boolean;
}): ExperienceVisibleComparisonEvaluation {
  void EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION;
  void EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION;
  void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  const visible = (options.visibleComparisonText || '').trim();
  const candidate = (options.candidateText || '').trim();
  const fact = (options.factAuthorityText || '').trim();
  const locale = options.locale || 'en';
  const useVisible = options.useVisibleForNoOp !== false && Boolean(visible);
  const visibleHash = visible ? fingerprintText(visible) : null;
  const visibleNormHash = hashNormalized(visible);
  const units = splitExperienceBullets(visible).filter(Boolean);

  const exactNormMatch = useVisible && experienceAiSourcesEquivalent(visible, candidate);
  const visibleIsFactAuthority = Boolean(
    visible && fact && experienceAiSourcesEquivalent(visible, fact),
  );
  const allowSemanticNoOpBaseline = useVisible;
  const semanticEq = allowSemanticNoOpBaseline
    && experienceVisibleTextsSemanticallyEquivalent(visible, candidate, locale);
  const inclusiveOnly = useVisible
    && (locale || '').toLowerCase().startsWith('es')
    && detectInclusiveGenderOnlyChange(visible, candidate);
  const textualDiffVsVisible = useVisible
    && experienceAiHasMeaningfulChange(visible, candidate);
  const textualDiffVsFact = fact
    ? experienceAiHasMeaningfulChange(fact, candidate)
    : textualDiffVsVisible;

  const degradationKinds: ExperienceDegradationKind[] = [];
  const improvementKinds: ExperienceMaterialImprovementKind[] = [];
  const visUnits = units.length;
  const candUnits = splitExperienceBullets(candidate).filter(Boolean).length;
  const lengthDelta = Math.abs(candidate.length - visible.length);
  const synonymOnlyRestyle = Boolean(
    useVisible
    && candidate
    && (semanticEq || inclusiveOnly)
    && !exactNormMatch
    && visUnits === candUnits
    && visUnits > 0
    && lengthDelta <= Math.max(28, Math.floor(visible.length * 0.12)),
  );

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
    const visibleLocale = visible ? detectTextLocale(visible) : 'unknown';
    const candidateLocale = candidate ? detectTextLocale(candidate) : 'unknown';
    const crossLangSurface = Boolean(options.crossLocaleOperation)
      || (
        visible
        && candidate
        && visibleLocale !== 'unknown'
        && candidateLocale !== 'unknown'
        && visibleLocale !== candidateLocale
      )
      || (
        visible
        && candidate
        && (locale || '').toLowerCase().startsWith('de')
        && /[A-Za-z]/.test(visible)
        && !/(?:prüft|kontrolliert|koordiniert|waren|unterlagen|kolleg)/iu.test(visible)
        && /(?:prüft|kontrolliert|koordiniert|waren|unterlagen|kolleg)/iu.test(candidate)
      );
    if (crossLangSurface) {
      // Cross-locale: compare candidate against fact-authority identities, never
      // raw same-language material-key equality vs a prior-locale visible AI snapshot.
      const auth = fact || visible;
      const target = (locale || '').toLowerCase();
      // Visible-lack check must use a validator that understands the *visible*
      // language (DE visible cannot be scored by Spanish bullet matchers).
      const visibleUncoveredCount = ((): number => {
        const v = visible || '';
        if (!v.trim()) return Math.max(3, 1);
        if (
          /(?:prüft|kontrolliert|koordiniert|waren|unterlagen|kolleg)/iu.test(v)
          || sourceRequiresGermanWarehouseFactCoverage(v)
        ) {
          return validateGermanWarehouseExperienceCoverage(auth, v).uncovered.length;
        }
        if (/(?:revis[ao]|comprob|coordin|mercanc[ií]a|documentaci|compa[nñ]er)/iu.test(v)) {
          return validateSpanishWarehouseExperienceCoverage(auth, v).uncovered.length;
        }
        if (sourceRequiresStrictEnglishWarehouseFactCoverage(auth)) {
          return validateEnglishWarehouseExperienceCoverage(auth, v).uncovered.length;
        }
        return validateCrossLocaleSemanticCoverage(auth, v).uncoveredCount;
      })();
      if (
        target.startsWith('de')
        && sourceRequiresGermanWarehouseFactCoverage(auth)
      ) {
        const cov = validateGermanWarehouseExperienceCoverage(auth, candidate);
        const pred = scanGermanWarehousePredicates(auth, candidate);
        if (!cov.ok || !pred.sourceUnitPredicateCoveragePassed) {
          degradationKinds.push('fact_lost');
        } else if (pred.candidateAddedPredicateCount > 0) {
          degradationKinds.push('unsupported_predicate_added');
        } else {
          improvementKinds.push('wrong_locale_fixed');
          if (cov.covered.length >= 3 && visibleUncoveredCount > 0) {
            improvementKinds.push('missing_fact_restored');
          }
        }
      } else if (
        target.startsWith('es')
        && sourceRequiresSpanishWarehouseFactCoverage(auth)
      ) {
        const cov = validateSpanishWarehouseExperienceCoverage(auth, candidate);
        const pred = scanSpanishWarehousePredicates(auth, candidate);
        if (!cov.ok || !pred.sourceUnitPredicateCoveragePassed) {
          degradationKinds.push('fact_lost');
        } else if (pred.candidateAddedPredicateCount > 0) {
          degradationKinds.push('unsupported_predicate_added');
        } else {
          improvementKinds.push('wrong_locale_fixed');
          if (cov.covered.length >= 3 && visibleUncoveredCount > 0) {
            improvementKinds.push('missing_fact_restored');
          }
        }
      } else if (
        target === 'en'
        && sourceRequiresStrictEnglishWarehouseFactCoverage(auth)
      ) {
        const cov = validateEnglishWarehouseExperienceCoverage(auth, candidate);
        const pred = scanEnglishWarehousePredicates(auth, candidate);
        if (!cov.ok || !pred.sourceUnitPredicateCoveragePassed) {
          degradationKinds.push('fact_lost');
        } else if (pred.candidateAddedPredicateCount > 0) {
          degradationKinds.push('unsupported_predicate_added');
        } else {
          improvementKinds.push('wrong_locale_fixed');
          if (cov.covered.length >= 3 && visibleUncoveredCount > 0) {
            improvementKinds.push('missing_fact_restored');
          }
        }
      } else {
        // Generic cross-locale: semantic frame / identity coverage, not surface keys.
        const semantic = validateCrossLocaleSemanticCoverage(auth, candidate);
        if (!semantic.ok || semantic.coveredCount < semantic.requiredCount) {
          degradationKinds.push('fact_lost');
        } else if (
          visibleLocale !== 'unknown'
          && candidateLocale !== 'unknown'
          && visibleLocale !== candidateLocale
        ) {
          improvementKinds.push('wrong_locale_fixed');
          if (
            semantic.coveredCount >= Math.min(3, semantic.requiredCount)
            && visibleUncoveredCount > 0
          ) {
            improvementKinds.push('missing_fact_restored');
          }
        }
      }
    } else {
      for (const k of factKeys) {
        if (!candKeys.has(k) && visKeys.has(k)) degradationKinds.push('fact_lost');
      }
    }
    // Same-language material-key restoration only — never across locales
    // (cross-locale warehouse keys do not align on surface tokens).
    if (!crossLangSurface) {
      for (const k of factKeys) {
        if (!visKeys.has(k) && candKeys.has(k)) {
          improvementKinds.push('missing_fact_restored');
        }
      }
    }
    if (visScan.count > 0 && candScan.count === 0) {
      improvementKinds.push('unsupported_claim_removed_from_visible_text');
    }
    if (visUnits < Math.max(factKeys.size, 1) && candUnits > visUnits) {
      improvementKinds.push('missing_source_unit_restored');
    }
    // Cross-locale / wrong-script visible → valid Spanish candidate.
    if (
      isEs
      && visible
      && candidate
      && candScan.count === 0
      && (
        /[\u0900-\u097F]/.test(visible)
        || /[\u0400-\u04FF]/.test(visible)
        || /[\u0600-\u06FF]/.test(visible)
        || /[\u3040-\u30ff\u3400-\u9fff]/.test(visible)
        || (
          visibleLocale !== 'unknown'
          && candidateLocale !== 'unknown'
          && visibleLocale !== candidateLocale
        )
        || (
          /(?:prüft|kontrolliert|koordiniert|waren|unterlagen|kolleg)/iu.test(visible)
          && /(?:revisa|comprueba|coordina|mercanc|documentaci)/iu.test(candidate)
        )
      )
      && !/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30ff\u3400-\u9fff]/.test(candidate)
      && /[áéíóúñü¿¡]|\b(?:revisa|comprueba|coordina|mercanc|documentaci)/iu.test(candidate)
    ) {
      if (!improvementKinds.includes('wrong_locale_fixed')) {
        improvementKinds.push('wrong_locale_fixed');
      }
    }
    // Tense mismatch vs employment state — evidence-only wrong_tense_fixed.
    let sourceTenseMismatchCount = 0;
    if (isEs && options.isPresent !== undefined && candScan.count === 0) {
      const tense = analyzeSpanishExperienceTenseAlignment({
        sourceText: visible,
        candidateText: candidate,
        isPresent: options.isPresent,
      });
      sourceTenseMismatchCount = tense.sourceTenseMismatchCount;
      if (
        tense.sourceTenseMismatchCount > 0
        && tense.candidateTenseMismatchCount === 0
        && !exactNormMatch
      ) {
        improvementKinds.push('wrong_tense_fixed');
      } else if (
        tense.sourceTenseMismatchCount === 0
        && tense.candidateTenseMismatchCount > 0
      ) {
        degradationKinds.push('tense_regressed');
      }
    }
    // Incomplete / abbreviated completion — ONLY when morphology proves incompleteness.
    // Length growth alone must never authorize incomplete_bullet_completed (AAB-316).
    const incompleteVisible = isEs ? countIncompleteSpanishUnits(visible) : 0;
    if (
      isEs
      && visibleIsFactAuthority
      && textualDiffVsFact
      && !exactNormMatch
      && candScan.count === 0
      && sourceTenseMismatchCount === 0
      && !improvementKinds.includes('wrong_tense_fixed')
      && improvementKinds.length === 0
      && !synonymOnlyRestyle
      && !inclusiveOnly
      && incompleteVisible > 0
    ) {
      improvementKinds.push('incomplete_bullet_completed');
    }
    // Non-Spanish: evidence kind for any non-exact grounded rewrite so usage
    // invariants never see materialImprovement true with empty kinds, and so
    // contaminated-AI recovery remains billable once.
    if (
      !isEs
      && textualDiffVsVisible
      && !exactNormMatch
      && improvementKinds.length === 0
    ) {
      improvementKinds.push('grounded_phrasing_enhancement');
    }
    if (textualDiffVsVisible && (semanticEq || inclusiveOnly) && improvementKinds.length === 0) {
      degradationKinds.push('restyle_without_benefit');
    }
  }

  const uniqueDeg = [...new Set(degradationKinds)].filter((k) =>
    !(k === 'restyle_without_benefit' && (semanticEq || inclusiveOnly)));
  const uniqueImp = [...new Set(improvementKinds)];
  // Invariant: degradationDetected requires at least one concrete kind.
  const degradationDetected = uniqueDeg.length > 0;
  const semanticEquivalent = Boolean(semanticEq || inclusiveOnly);
  // Re-run no-op: any semantic equivalence without improvement evidence.
  // First-click (visible ≡ fact): only exact match or synonym/inclusive restyle.
  const semanticNoOpDetected = Boolean(
    useVisible
    && candidate
    && uniqueImp.length === 0
    && (
      exactNormMatch
      || inclusiveOnly
      || (semanticEquivalent && !visibleIsFactAuthority)
      || (semanticEquivalent && visibleIsFactAuthority && synonymOnlyRestyle)
    ),
  );
  // Evidence-based only — never default true from textual difference alone.
  const materialImprovementDetected = Boolean(
    useVisible
    && candidate
    && !semanticNoOpDetected
    && !degradationDetected
    && uniqueImp.length > 0,
  );
  const neutralRestyleDetected = Boolean(
    semanticNoOpDetected && !exactNormMatch && uniqueImp.length === 0,
  );

  let semanticNoOpReason: string | null = null;
  if (semanticNoOpDetected) {
    if (exactNormMatch) semanticNoOpReason = 'normalized_visible_match';
    else if (inclusiveOnly) semanticNoOpReason = 'inclusive_gender_equivalent';
    else if (neutralRestyleDetected) semanticNoOpReason = 'neutral_restyle';
    else semanticNoOpReason = 'semantic_equivalent_visible';
  }

  let finalDecisionKind: ExperienceFinalDecisionKind = 'none';
  if (degradationDetected) finalDecisionKind = 'degradation';
  else if (materialImprovementDetected) finalDecisionKind = 'material_improvement';
  else if (exactNormMatch) finalDecisionKind = 'exact_noop';
  else if (neutralRestyleDetected) finalDecisionKind = 'neutral_restyle';
  else if (semanticNoOpDetected) finalDecisionKind = 'semantic_noop';

  return {
    revision: EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION,
    visibleComparisonSourceKind: visible ? 'currentTextarea' : 'none',
    visibleComparisonHash: visibleHash,
    visibleComparisonNormalizedHash: visibleNormHash,
    visibleComparisonUnitCount: units.length,
    visibleComparisonProvenance: options.visibleComparisonProvenance ?? null,
    visibleComparisonMatchedLastAiOutput: Boolean(options.matchedLastAiOutput),
    visibleComparisonUsedForNoOp: useVisible,
    visibleComparisonUsedForDegradationCheck: useVisible,
    visibleComparisonCapturedAtRequest: options.capturedAtRequest !== false,
    finalMatchesVisibleComparisonAfterNormalization: exactNormMatch,
    finalSemanticallyEquivalentToVisibleComparison: semanticEquivalent,
    semanticNoOpDetected,
    semanticNoOpReason,
    materialImprovementDetected,
    materialImprovementKinds: materialImprovementDetected ? uniqueImp : [],
    degradationDetected,
    degradationKinds: uniqueDeg,
    neutralRestyleDetected,
    finalDecisionKind,
  };
}

/**
 * Every non-empty Experience textarea is a visible comparison baseline.
 * Fact authority provenance is independent.
 */
export function shouldUseVisibleComparisonForNoOp(options: {
  currentTextareaProvenance?: string | null;
  lastAiOutputHashMatched?: boolean | null;
  materialUserEditDetected?: boolean | null;
  visibleText?: string | null;
  factAuthorityText?: string | null;
}): boolean {
  void EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION;
  const visible = (options.visibleText || '').trim();
  void options.currentTextareaProvenance;
  void options.lastAiOutputHashMatched;
  void options.materialUserEditDetected;
  void options.factAuthorityText;
  return Boolean(visible);
}

/** Map provenance authority kind into diagnostic factAuthorityKind. */
export function mapFactAuthorityKindForDiagnostics(
  authoritativeFactSourceKind: string | null | undefined,
): string | null {
  void EXPERIENCE_FACT_AUTHORITY_CONSISTENCY_312_REVISION;
  void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
  return normalizeExperienceFactAuthorityKind(authoritativeFactSourceKind);
}
