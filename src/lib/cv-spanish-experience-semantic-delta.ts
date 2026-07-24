/**
 * AAB-316 — Spanish Experience semantic-delta grounding and single-finalizer markers.
 * Candidate-only scope/modifier/outcome material must be source-supported.
 */
import type { ExperienceUnsupportedClaimKind } from './cv-experience-unsupported-claims';

export const EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION =
  'experience-single-canonical-finalizer-316-v1' as const;
export const SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION =
  'spanish-experience-semantic-delta-grounding-316-v1' as const;
export const SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION =
  'spanish-experience-valid-source-noop-316-v1' as const;
export const EXPERIENCE_FINAL_DECISION_TRUTH_316_REVISION =
  'experience-final-decision-truth-316-v1' as const;

void EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION;
void SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION;
void SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION;
void EXPERIENCE_FINAL_DECISION_TRUTH_316_REVISION;

/** Project / plurality / diversity scope expansions. */
export const PROJECT_SCOPE_EXPANSION_ES =
  /\b(?:diversos|diversas|m[uú]ltiples|varios|varias|distintos|distintas|diferentes)\s+proyectos?\b|\bproyectos?\s+de\s+diversa\s+[ií]ndole\b|\bpara\s+(?:diversos|m[uú]ltiples|varios|distintos)\s+proyectos?\b/iu;

/** Requirements / specifications / established criteria. */
export const REQUIREMENTS_SCOPE_EXPANSION_ES =
  /\bseg[uú]n\s+los\s+requisitos?(?:\s+establecidos?)?\b|\bconforme\s+a\s+los\s+requisitos?\b|\bde\s+acuerdo\s+con\s+las\s+especificaciones?\b|\bcumpliendo\s+los\s+est[aá]ndares?\b|\bseg[uú]n\s+las\s+normas?\s+definidas?\b|\bseg[uú]n\s+las\s+especificaciones?\b/iu;

/** Participial / adjectival optimization & quality outcome modifiers. */
export const OPTIMIZATION_MODIFIER_ES =
  /\boptimiz(?:a|ó|ar|ado|ados|ada|adas|ando)?\b|\bmejorad(?:o|os|a|as)\b|\bde\s+alta\s+calidad\b|\bpreparad[oa]s?\s+para\s+garantiz|\borientad[oa]s?\s+a\s+maximizar|\bcon\s+el\s+fin\s+de\s+asegur/iu;

export type SpanishSemanticDeltaScan = {
  revision: typeof SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION;
  kinds: ExperienceUnsupportedClaimKind[];
  labels: string[];
  count: number;
  candidateAddedScopeCount: number;
  candidateAddedModifierCount: number;
  candidateAddedOutcomeCount: number;
};

function sourceHas(source: string, re: RegExp): boolean {
  return re.test(source || '');
}

/**
 * Domain-independent Spanish Experience semantic-delta scan.
 * Candidate-only project/requirements/optimization material is unsupported
 * unless the aligned authoritative source already states the same fact.
 */
export function detectSpanishExperienceSemanticDelta(
  sourceDescription: string,
  candidateDescription: string,
): SpanishSemanticDeltaScan {
  void SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION;
  const source = sourceDescription || '';
  const candidate = candidateDescription || '';
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  const labels: string[] = [];
  let candidateAddedScopeCount = 0;
  let candidateAddedModifierCount = 0;
  let candidateAddedOutcomeCount = 0;

  if (PROJECT_SCOPE_EXPANSION_ES.test(candidate) && !PROJECT_SCOPE_EXPANSION_ES.test(source)) {
    kinds.push('project_scope_expansion');
    labels.push('project_scope_expansion');
    kinds.push('unsupported_modifier_expansion');
    labels.push('unsupported_modifier_expansion');
    candidateAddedScopeCount += 1;
  }
  if (
    REQUIREMENTS_SCOPE_EXPANSION_ES.test(candidate)
    && !REQUIREMENTS_SCOPE_EXPANSION_ES.test(source)
    && !sourceHas(source, /\brequisitos?\b|\bespecificaciones?\b|\best[aá]ndares?\b|\bnormas?\s+definidas?\b/iu)
  ) {
    kinds.push('requirements_scope_expansion');
    labels.push('requirements_scope_expansion');
    kinds.push('standards_scope_expansion');
    labels.push('standards_scope_expansion');
    kinds.push('compliance_scope_expansion');
    labels.push('compliance_scope_expansion');
    kinds.push('unsupported_modifier_expansion');
    labels.push('unsupported_modifier_expansion');
    candidateAddedScopeCount += 1;
    candidateAddedModifierCount += 1;
  }
  if (OPTIMIZATION_MODIFIER_ES.test(candidate) && !OPTIMIZATION_MODIFIER_ES.test(source)) {
    if (/\boptimiz/iu.test(candidate) && !/\boptimiz/iu.test(source)) {
      kinds.push('optimization_claim');
      labels.push('optimization_claim');
      candidateAddedModifierCount += 1;
      candidateAddedOutcomeCount += 1;
    }
    if (/\bmejorad/iu.test(candidate) && !/\bmejorad|\bmejor(?:a|ó|ar)\b/iu.test(source)) {
      kinds.push('quality_claim');
      labels.push('quality_claim');
      candidateAddedModifierCount += 1;
    }
    if (/\bde\s+alta\s+calidad\b/iu.test(candidate) && !/\bde\s+alta\s+calidad\b|\balta\s+calidad\b/iu.test(source)) {
      kinds.push('quality_claim');
      labels.push('quality_claim');
      candidateAddedModifierCount += 1;
    }
    if (
      /(?:preparad[oa]s?\s+para\s+garantiz|orientad[oa]s?\s+a\s+maximizar|con\s+el\s+fin\s+de\s+asegur)/iu
        .test(candidate)
      && !/(?:garantiz|maximizar|asegur)/iu.test(source)
    ) {
      kinds.push('outcome_ownership');
      labels.push('outcome_ownership');
      kinds.push('performance_claim');
      labels.push('performance_claim');
      candidateAddedOutcomeCount += 1;
    }
    kinds.push('unsupported_modifier_expansion');
    labels.push('unsupported_modifier_expansion');
  }

  const uniqueKinds = [...new Set(kinds)];
  return {
    revision: SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION,
    kinds: uniqueKinds,
    labels: [...new Set(labels)],
    count: uniqueKinds.length,
    candidateAddedScopeCount,
    candidateAddedModifierCount,
    candidateAddedOutcomeCount,
  };
}
