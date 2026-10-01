import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
  SUMMARY_V3_STYLE_M5_PHASES,
  SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS,
  SUMMARY_V3_STYLE_M5_SOURCE_FLOOR_MISMATCH_CLASSES,
  type SummaryV3StyleResult,
  type SummaryV3StyleRoleIdentityResolution,
  type SummaryV3StyleSafeNoOpEligibilityReason,
  type SummaryV3StyleSourceFloorMismatchClass,
  type SummaryV3StyleUnsupportedClaimCategory,
} from './summary-style-m5';

export const SUMMARY_STYLE_LOCAL_OWNERS = ['hard_guard', 'role_identity_resolution'] as const;
export const SUMMARY_STYLE_HARD_PREDICATES = [
  'unsupported_source_inconsistency', 'injected_manifest_fact',
  'unsupported_authority_or_seniority', 'unsupported_numeric_metric',
  'unsupported_candidate_semantic_material', 'unsupported_named_tool_surface',
  'employment_state_contradiction',
] as const;
export const SUMMARY_STYLE_ROLE_FAILURES = [
  'evaluator_role_contradiction', 'evaluator_role_unresolved',
  'snapshot_role_unresolved_without_equivalence',
] as const;
// One value per positive source-consistency branch, in execution order.
export const SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS = [
  'explicit_source_identity_inconsistency',
  'unannotated_source_role_employer_frame_inconsistency',
  'unsupported_source_nonnumeric_material_result_relation',
  'source_numeric_membership_mismatch',
  'role_local_source_duration_contradiction',
  'source_semantic_claim_membership_mismatch',
  'unmanifested_material_numeric_relation_term',
  'explicit_source_tool_without_manifest_authority',
  'unmanifested_named_source_tool_surface',
  'source_authority_term_membership_mismatch',
] as const;
export type SummaryStyleSourceFloorFirstProducer = (typeof SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS)[number];
const UNSUPPORTED_CATEGORIES = [
  'unsupported_metric', 'unsupported_result_relation', 'unsupported_achievement',
  'unsupported_authority', 'source_floor_mismatch', 'manifest_ceiling_mismatch',
  'other_typed_category',
] as const satisfies readonly SummaryV3StyleUnsupportedClaimCategory[];
export const SUMMARY_STYLE_SAFE_NO_OP_ELIGIBILITIES = [
  'eligible', 'wrong_style', 'wrong_mode', 'source_empty',
  'source_locale_surface_mismatch', 'source_locale_content_mismatch',
  'source_inconsistency', 'role_employer_frame_inconsistency',
  'source_material_result_relation', 'not_applicable',
  'employment_state_contradiction', 'not_evaluated',
] as const satisfies readonly (SummaryV3StyleSafeNoOpEligibilityReason | 'employment_state_contradiction' | 'not_evaluated')[];

export type SummaryStyleHardPredicate = (typeof SUMMARY_STYLE_HARD_PREDICATES)[number];
export type SummaryStyleRoleFailure = (typeof SUMMARY_STYLE_ROLE_FAILURES)[number];
export type SummaryStyleSafeNoOpEligibility = (typeof SUMMARY_STYLE_SAFE_NO_OP_ELIGIBILITIES)[number];
// Four parsed phases, each with the provider schema/parser's maxItems=32.
export const SUMMARY_STYLE_MAX_EVALUATOR_VIOLATIONS = SUMMARY_V3_STYLE_M5_PHASES.length
  * SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL.input_schema.properties.phases.properties.structural.properties.violations.maxItems;

export interface SummaryStyleLocalDiagnostics {
  readonly sourceFloorFirstProducer: SummaryStyleSourceFloorFirstProducer | null;
  readonly postEvaluatorLocalOwner: (typeof SUMMARY_STYLE_LOCAL_OWNERS)[number] | null;
  readonly postEvaluatorHardPredicate: SummaryStyleHardPredicate | null;
  readonly postEvaluatorRoleIdentityFailureClass: SummaryStyleRoleFailure | null;
  readonly postEvaluatorUnsupportedClaimCategory: SummaryV3StyleUnsupportedClaimCategory | null;
  readonly postEvaluatorSourceFloorMismatchClass: SummaryV3StyleSourceFloorMismatchClass | null;
  readonly evaluatorAllPhasesPassed: boolean | null;
  readonly evaluatorViolationCount: number | null;
  readonly evaluatorRoleIdentityResolution: SummaryV3StyleRoleIdentityResolution | null;
  readonly strongerSafeNoOpEligibility: SummaryStyleSafeNoOpEligibility | null;
}

// Process-local sidecar: never part of result JSON, evidence size gates,
// snapshots, hashes, provider/repair inputs or the client transport contract.
const diagnostics = new WeakMap<object, SummaryStyleLocalDiagnostics>();
const finite = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && allowed.includes(value as T) ? value as T : null;

export function recordSummaryStyleLocalDiagnostics(
  result: SummaryV3StyleResult,
  value: Omit<SummaryStyleLocalDiagnostics, 'sourceFloorFirstProducer'> & {
    readonly sourceFloorFirstProducer?: SummaryStyleSourceFloorFirstProducer | null;
  },
): SummaryV3StyleResult {
  const owner = finite(value.postEvaluatorLocalOwner, SUMMARY_STYLE_LOCAL_OWNERS);
  diagnostics.set(result, Object.freeze({
    sourceFloorFirstProducer: owner === 'hard_guard'
      && value.postEvaluatorHardPredicate === 'unsupported_source_inconsistency'
      ? finite(value.sourceFloorFirstProducer, SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS) : null,
    postEvaluatorLocalOwner: owner,
    postEvaluatorHardPredicate: owner === 'hard_guard'
      ? finite(value.postEvaluatorHardPredicate, SUMMARY_STYLE_HARD_PREDICATES) : null,
    postEvaluatorRoleIdentityFailureClass: owner === 'role_identity_resolution'
      ? finite(value.postEvaluatorRoleIdentityFailureClass, SUMMARY_STYLE_ROLE_FAILURES) : null,
    postEvaluatorUnsupportedClaimCategory: owner ? finite(value.postEvaluatorUnsupportedClaimCategory, UNSUPPORTED_CATEGORIES) : null,
    postEvaluatorSourceFloorMismatchClass: owner
      ? finite(value.postEvaluatorSourceFloorMismatchClass, SUMMARY_V3_STYLE_M5_SOURCE_FLOOR_MISMATCH_CLASSES) : null,
    evaluatorAllPhasesPassed: typeof value.evaluatorAllPhasesPassed === 'boolean' ? value.evaluatorAllPhasesPassed : null,
    evaluatorViolationCount: Number.isSafeInteger(value.evaluatorViolationCount)
      && value.evaluatorViolationCount !== null && value.evaluatorViolationCount >= 0
      && value.evaluatorViolationCount <= SUMMARY_STYLE_MAX_EVALUATOR_VIOLATIONS ? value.evaluatorViolationCount : null,
    evaluatorRoleIdentityResolution: finite(value.evaluatorRoleIdentityResolution, SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS),
    strongerSafeNoOpEligibility: finite(value.strongerSafeNoOpEligibility, SUMMARY_STYLE_SAFE_NO_OP_ELIGIBILITIES),
  }));
  return result;
}

export function readSummaryStyleLocalDiagnostics(result: object): SummaryStyleLocalDiagnostics {
  return diagnostics.get(result) ?? {
    sourceFloorFirstProducer: null,
    postEvaluatorLocalOwner: null, postEvaluatorHardPredicate: null,
    postEvaluatorRoleIdentityFailureClass: null, postEvaluatorUnsupportedClaimCategory: null,
    postEvaluatorSourceFloorMismatchClass: null, evaluatorAllPhasesPassed: null,
    evaluatorViolationCount: null, evaluatorRoleIdentityResolution: null,
    strongerSafeNoOpEligibility: null,
  };
}
