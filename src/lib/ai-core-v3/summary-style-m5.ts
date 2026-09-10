import { immutableCopy } from './immutability';
import type { SummaryV3ProviderFailureEnvelope } from './summary-generate';

/**
 * M5.1 is deliberately a domain-only foundation.  It owns style authority and
 * validation, but it owns neither page integration nor persistence, usage, or
 * apply decisions.
 */

export const SUMMARY_V3_STYLE_M5_STYLES = ['shorter', 'stronger', 'professional'] as const;
export type SummaryV3Style = (typeof SUMMARY_V3_STYLE_M5_STYLES)[number];

export const SUMMARY_V3_STYLE_M5_MODES = ['generate_from_context', 'enhance_existing_content'] as const;
export type SummaryV3StyleMode = (typeof SUMMARY_V3_STYLE_M5_MODES)[number];

export const SUMMARY_V3_STYLE_M5_PHASES = [
  'structural',
  'semantic_grounding',
  'language_native_quality',
  'style_fulfillment',
] as const;
export type SummaryV3StylePhase = (typeof SUMMARY_V3_STYLE_M5_PHASES)[number];

export const SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES = ['en', 'de', 'sr', 'hi', 'ar', 'ja', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru'] as const;
export type SummaryV3StyleSupportedLocale = (typeof SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES)[number];

export const SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS = [
  'not_required',
  'equivalent',
  'contradiction',
  'unresolved',
] as const;
export type SummaryV3StyleRoleIdentityResolution = (typeof SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS)[number];

/** Input ceilings keep the immutable M5.1 snapshot and its provider contracts bounded. */
const SUMMARY_V3_STYLE_MAX_MANIFEST_ENTRIES = 64;
const SUMMARY_V3_STYLE_MAX_ENTRY_FACTS = 64;
const SUMMARY_V3_STYLE_MAX_TOTAL_FACTS = 256;
const SUMMARY_V3_STYLE_MAX_PROTECTED_ENTITIES = 64;

export type SummaryV3StyleNotApplicableReason =
  | 'feature_not_enabled'
  | 'operation_not_m5_style'
  | 'unsupported_style'
  | 'unsupported_locale'
  | 'cross_locale'
  | 'm4_generate_owned_elsewhere'
  | 'experience_owned_elsewhere'
  | 'm6_or_future_locale_operation';

export type SummaryV3StyleFailureReason =
  | 'malformed_request'
  | 'insufficient_context'
  | 'ambiguous_current_role'
  | 'source_fact_not_visible'
  | 'stale_identity'
  | 'writer_request_failed'
  | 'writer_transport_malformed'
  | 'writer_identity_mismatch'
  | 'candidate_malformed'
  | 'lost_source_fact'
  | 'unsupported_claim'
  | 'evaluator_request_failed'
  | 'evaluator_transport_malformed'
  | 'evaluator_rejected'
  | 'style_not_fulfilled'
  | 'invalid_language_or_native_surface'
  | 'repair_request_failed'
  | 'repair_transport_malformed'
  | 'repair_identity_mismatch'
  | 'repair_scope_violation'
  | 'repair_evaluator_request_failed'
  | 'repair_evaluator_transport_malformed'
  | 'repair_rejected'
  | 'diagnostic_size_exceeded';

/** Privacy-safe terminal category for a rejected Stronger writer candidate. */
export type SummaryV3StyleUnsupportedClaimCategory =
  | 'unsupported_metric'
  | 'unsupported_result_relation'
  | 'unsupported_achievement'
  | 'unsupported_authority'
  | 'source_floor_mismatch'
  | 'manifest_ceiling_mismatch'
  | 'other_typed_category';

/**
 * Bounded, source-only explanation of the M5 Stronger source-retaining
 * safe-no-op decision. This records no Summary, manifest, or provider text.
 */
export type SummaryV3StyleSafeNoOpEligibilityReason =
  | 'eligible'
  | 'wrong_style'
  | 'wrong_mode'
  | 'source_empty'
  | 'source_locale_surface_mismatch'
  | 'source_locale_content_mismatch'
  | 'source_inconsistency'
  | 'role_employer_frame_inconsistency'
  | 'source_material_result_relation'
  | 'not_applicable';

export type SummaryV3StyleViolationCode =
  | 'missing_fact'
  | 'lost_source_fact'
  | 'unsupported_claim'
  | 'unsupported_authority'
  | 'unsupported_metric'
  | 'invalid_language'
  | 'invalid_native_surface'
  | 'style_not_fulfilled'
  | 'marker_only_change'
  | 'modifier_only_change'
  | 'repeated_style_modifier'
  | 'stacked_style_modifier'
  | 'corporate_jargon'
  | 'stale_identity'
  | 'malformed_candidate'
  | 'safe_no_op';

export type SummaryV3StylePhaseStatus = 'passed' | 'failed';

/**
 * Semantic labels are supplied only by the future trusted page owner. They
 * never come from a writer or evaluator and keep a bounded M5.1 predicate
 * exception distinguishable from names, tools, metrics, and identities.
 */
export const SUMMARY_V3_STYLE_M5_VISIBLE_FACT_KINDS = [
  'duty', 'entity', 'tool', 'metric', 'role', 'employer', 'duration', 'achievement', 'other',
] as const;
export type SummaryV3StyleVisibleFactKind = (typeof SUMMARY_V3_STYLE_M5_VISIBLE_FACT_KINDS)[number];

export interface SummaryV3StyleTransformableDutyInput {
  /** Exact visible predicate span; supports CJK morphology without a locale table. */
  readonly sourcePredicate: string;
  /** Exactly one nonnumeric lexical predicate anchor permitted to change. */
  readonly predicateAnchor: string;
}

export interface SummaryV3StyleFactInput {
  readonly id: string;
  readonly text: string;
  readonly semanticKind?: SummaryV3StyleVisibleFactKind;
  /** Explicit trusted-page provenance; absent by default and never provider supplied. */
  readonly transformableDuty?: SummaryV3StyleTransformableDutyInput;
}

/**
 * Entry-owned target-language role evidence.  This is presentation lineage,
 * never semantic authority: the source role and its hash remain immutable and
 * the alias is usable only while its entry binding and target locale match.
 */
export interface SummaryV3StyleRolePresentationEvidence {
  readonly text: string;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly sourceRoleHash: string;
  readonly provenance: 'validated_localized_projection' | 'validated_export_title_surface';
}

export interface SummaryV3StyleExperienceInput {
  readonly stableId: string;
  readonly role: string;
  readonly employer: string;
  /** Locale of the immutable role source, when entry-owned provenance knows it. */
  readonly roleSourceLocale?: string;
  /** Validated target-language surface for this same entry, when present. */
  readonly rolePresentation?: SummaryV3StyleRolePresentationEvidence;
  readonly employmentState: 'present' | 'completed';
  readonly durationMonths: number;
  readonly facts: readonly SummaryV3StyleFactInput[];
}

export interface SummaryV3StyleManifestInput {
  readonly manifestId: string;
  readonly contextId: string;
  readonly sourceLocale: string;
  readonly currentRoleEntryId: string | null;
  readonly entries: readonly SummaryV3StyleExperienceInput[];
}

/**
 * The caller must provide `visibleSummary` explicitly.  Persisted, preview,
 * DOM, or provider values intentionally have no place in this input.
 */
export interface SummaryV3StyleRequest {
  readonly enabled: boolean;
  readonly operation: string;
  readonly operationId: string;
  readonly style: string;
  readonly requestedLocale: string;
  readonly sourceLocale: string;
  /** Explicitly supplied by the future page owner; `''` is the only empty state. */
  readonly visibleSummary: string;
  readonly visibleSummaryFacts?: readonly SummaryV3StyleFactInput[];
  /** Explicit page-owner-supplied names/entities which must remain exact. */
  readonly protectedEntities?: readonly string[];
  readonly manifest: SummaryV3StyleManifestInput;
  readonly requestIdentity?: string;
  /** Request-start timestamp, bound into the immutable snapshot identity. */
  readonly createdAt: number;
}

export interface SummaryV3StyleFact {
  readonly id: string;
  readonly hash: string;
  readonly text: string;
  readonly origin: 'context_manifest' | 'visible_summary';
  readonly semanticKind: SummaryV3StyleVisibleFactKind;
  readonly transformableDuty: Readonly<{
    sourceFactId: string;
    sourcePredicate: string;
    predicateAnchor: string;
    hash: string;
  }> | null;
}

export interface SummaryV3StyleEntityLock {
  readonly kind: 'role' | 'employer' | 'duration' | 'entity';
  readonly hash: string;
  readonly value: string;
}

export interface SummaryV3StyleSourceUnit {
  readonly id: string;
  readonly hash: string;
}

/**
 * Privacy-safe subject-to-source-unit provenance for the narrow case where a
 * future page owner explicitly protects one visible entity.  The hashes bind
 * a person/entity to its visible facts without putting raw CV text into
 * diagnostic evidence.
 */
export interface SummaryV3StyleEntityRelationBinding {
  readonly entityHash: string;
  readonly sourceUnitHash: string;
  readonly sourceFactHashes: readonly string[];
  readonly hash: string;
}

export interface SummaryV3StyleOperationSnapshot {
  readonly operationId: string;
  readonly style: SummaryV3Style;
  readonly mode: SummaryV3StyleMode;
  readonly requestedLocale: SummaryV3StyleSupportedLocale;
  readonly sourceLocale: SummaryV3StyleSupportedLocale;
  readonly sourceKind: 'context_manifest' | 'visible_summary';
  readonly sourceSummary: string;
  readonly sourceSummaryHash: string;
  readonly sourceSummaryNormalizedLength: number;
  readonly sourceUnits: readonly SummaryV3StyleSourceUnit[];
  readonly selectedEntries: readonly Readonly<{
    stableId: string;
    hash: string;
    roleHash: string;
    employerHash: string;
    roleSourceLocale: string | null;
    rolePresentation: SummaryV3StyleRolePresentationEvidence | null;
    employmentState: 'present' | 'completed';
    durationMonths: number;
  }>[];
  readonly currentRoleEntryId: string | null;
  readonly currentRoleHash: string | null;
  /** Immutable manifest ceiling. It is never writer authority for a non-empty source. */
  readonly manifestFacts: readonly SummaryV3StyleFact[];
  readonly requiredFacts: readonly SummaryV3StyleFact[];
  /** One optional, explicit source-only Stronger predicate boundary. */
  readonly transformableDuty: SummaryV3StyleFact['transformableDuty'];
  readonly entityLocks: readonly SummaryV3StyleEntityLock[];
  /** Explicit-entity bindings prevent cross-person fact reattribution. */
  readonly entityRelationBindings: readonly SummaryV3StyleEntityRelationBinding[];
  readonly structuredDurationMonths: number;
  readonly manifestHash: string;
  readonly contextHash: string;
  readonly snapshotHash: string;
  readonly requestIdentityHash: string;
  readonly createdAt: number;
}

export interface SummaryV3StyleCandidateUnit {
  readonly unitId: string;
  readonly text: string;
  readonly factIds: readonly string[];
}

export interface SummaryV3StyleCandidate {
  readonly operationId: string;
  readonly snapshotHash: string;
  readonly manifestHash: string;
  readonly style: SummaryV3Style;
  readonly locale: SummaryV3StyleSupportedLocale;
  readonly units: readonly SummaryV3StyleCandidateUnit[];
  readonly text: string;
  readonly hash: string;
  readonly normalizedLength: number;
  readonly unitCount: number;
  readonly clauseCount: number;
}

export interface SummaryV3StyleOwnershipNotApplicable {
  readonly kind: 'not_applicable';
  readonly reason: SummaryV3StyleNotApplicableReason;
}

export interface SummaryV3StyleOwnershipOwned {
  readonly kind: 'owned';
  readonly style: SummaryV3Style;
  readonly requestedLocale: SummaryV3StyleSupportedLocale;
}

export type SummaryV3StyleOwnership = SummaryV3StyleOwnershipNotApplicable | SummaryV3StyleOwnershipOwned;

export interface SummaryV3StyleViolation {
  readonly code: SummaryV3StyleViolationCode;
  readonly factIdHashes: readonly string[];
  readonly unitHashes: readonly string[];
  readonly repairable: boolean;
}

export type SummaryV3StyleFulfillmentEvidence =
  | Readonly<{
    style: 'shorter';
    sourceNormalizedLength: number;
    candidateNormalizedLength: number;
    lengthDelta: number;
    lengthDeltaPercent: number;
    sourceUnitCount: number;
    candidateUnitCount: number;
    sourceClauseCount: number;
    candidateClauseCount: number;
    semanticCompressionOperations: number;
    factCoverage: boolean;
    fulfilled: boolean;
    rejectionReasons: readonly SummaryV3StyleViolationCode[];
  }>
  | Readonly<{
    style: 'stronger';
    materiallyDifferentFromSource: boolean;
    strongerPredicateTransformations: number;
    structuralStrengtheningCount: number;
    modifierOnlyTransformationDetected: boolean;
    repeatedStyleModifierCount: number;
    stackedModifierDetected: boolean;
    unsupportedAuthorityDetected: boolean;
    fulfilled: boolean;
    rejectionReasons: readonly SummaryV3StyleViolationCode[];
  }>
  | Readonly<{
    style: 'professional';
    materiallyDifferentFromSource: boolean;
    professionalFramingOperations: number;
    cohesionClarityOperations: number;
    markerOnlyChangeDetected: boolean;
    jargonOrFillerDetected: boolean;
    fulfilled: boolean;
    rejectionReasons: readonly SummaryV3StyleViolationCode[];
  }>;

export type SummaryV3StyleEvidence = Readonly<{
  readonly writerAttempts: number;
  readonly evaluatorAttempts: number;
  readonly repairWriterAttempts: number;
  readonly repairEvaluatorAttempts: number;
  readonly phaseStatuses: Readonly<Record<SummaryV3StylePhase, SummaryV3StylePhaseStatus | 'not_evaluated'>>;
  readonly candidateHash: string | null;
  readonly candidateNormalizedLength: number | null;
  readonly candidateUnitCount: number | null;
  readonly candidateClauseCount: number | null;
  readonly requiredFactCount: number;
  readonly coveredFactCount: number;
  readonly missingFactCount: number;
  readonly unsupportedClaimCount: number;
  readonly styleFulfilled: boolean | null;
  readonly styleEvidence: SummaryV3StyleFulfillmentEvidence | null;
  readonly meaningfulChangeDetected: boolean;
  readonly noOpDetected: boolean;
  readonly unsupportedClaimCategory: SummaryV3StyleUnsupportedClaimCategory | null;
  readonly writerOutputContractFailureClass: SummaryV3StyleWriterOutputContractFailureClass | null;
  readonly writerCandidateReachedValidation: boolean;
  readonly evaluatorReached: boolean;
  readonly safeNoOpConsidered: boolean;
  readonly safeNoOpSelected: boolean;
  readonly safeNoOpEligibilityReason: SummaryV3StyleSafeNoOpEligibilityReason;
  readonly roleIdentityResolution: SummaryV3StyleRoleIdentityResolution;
  /** Existing shared, release-safe provider classification; raw errors never cross this boundary. */
  readonly m5ProviderFailure: SummaryV3ProviderFailureEnvelope | null;
  readonly sourceSummaryHash: string;
  readonly manifestHash: string;
  readonly snapshotHash: string;
  readonly retries: 0;
  readonly fallbacks: 0;
  readonly v2Fallthrough: 0;
}>;

export type SummaryV3StyleResult =
  | Readonly<{ kind: 'not_applicable'; reason: SummaryV3StyleNotApplicableReason }>
  | Readonly<{
    kind: 'handled_failure';
    style: SummaryV3Style;
    mode: SummaryV3StyleMode;
    typedReason: SummaryV3StyleFailureReason;
    evidence: SummaryV3StyleEvidence;
  }>
  | Readonly<{
    kind: 'safe_no_op';
    style: SummaryV3Style;
    mode: 'enhance_existing_content';
    typedReason: 'safe_no_op';
    evidence: SummaryV3StyleEvidence;
  }>
  | Readonly<{
    kind: 'candidate_ready';
    style: SummaryV3Style;
    mode: SummaryV3StyleMode;
    candidate: SummaryV3StyleCandidate;
    evidence: SummaryV3StyleEvidence;
  }>;

/** Runtime discriminator authority shared by the server-result union and HTTP client. */
export const SUMMARY_V3_STYLE_M5_SERVER_RESULT_KINDS = [
  'candidate_ready',
  'safe_no_op',
  'not_applicable',
  'handled_failure',
] as const satisfies readonly SummaryV3StyleResult['kind'][];

type SummaryV3StyleM5ServerResultKindsAreExhaustive = Exclude<
  SummaryV3StyleResult['kind'],
  (typeof SUMMARY_V3_STYLE_M5_SERVER_RESULT_KINDS)[number]
> extends never ? true : false;

export const SUMMARY_V3_STYLE_M5_SERVER_RESULT_KINDS_EXHAUSTIVE:
SummaryV3StyleM5ServerResultKindsAreExhaustive = true;

export interface SummaryV3StyleStrategy {
  readonly style: SummaryV3Style;
  readonly requiresExistingSourceMateriality: boolean;
  readonly requiresGroundedPredicateTransformation: boolean;
  readonly minimumExistingSourceLengthRatio: number;
  readonly writerContract: readonly string[];
  readonly requiredEvidenceKeys: readonly string[];
}

/** One strategy table prevents three copied style pipelines. */
export const SUMMARY_V3_STYLE_STRATEGIES: Readonly<Record<SummaryV3Style, SummaryV3StyleStrategy>> = immutableCopy({
  shorter: {
    style: 'shorter',
    requiresExistingSourceMateriality: true,
    requiresGroundedPredicateTransformation: false,
    minimumExistingSourceLengthRatio: 0,
    writerContract: ['preserve every required fact', 'compress structurally', 'do not remove material facts'],
    requiredEvidenceKeys: [
      'style', 'semanticCompressionOperations', 'sourceNormalizedLength', 'candidateNormalizedLength', 'lengthDelta', 'lengthDeltaPercent',
      'sourceUnitCount', 'candidateUnitCount', 'sourceClauseCount', 'candidateClauseCount', 'factCoverage', 'shorterFulfilled', 'noOpDetected',
    ],
  },
  stronger: {
    style: 'stronger',
    requiresExistingSourceMateriality: true,
    requiresGroundedPredicateTransformation: true,
    minimumExistingSourceLengthRatio: 0,
    writerContract: [
      'strengthen grounded predicate wording before considering achievement or impact framing',
      'treat sourceText as the sole fact authority for enhance_existing_content',
      'preserve duties as duties; never convert a duty into an achievement, accomplishment, result, impact, or business outcome',
      'do not add authority, metrics, numbers, scale, leadership, awards, savings, revenue, efficiency gains, or performance gains unless sourceText explicitly contains them',
      'when the source contains duties only, use confident active wording without implying a result relation',
      'if no meaningful grounded strengthening is possible, return sourceText unchanged as the single safe-no-op candidate',
    ],
    requiredEvidenceKeys: [
      'style', 'strongerPredicateTransformations', 'structuralStrengtheningCount', 'modifierOnlyTransformationDetected',
      'repeatedStyleModifierCount', 'stackedModifierDetected', 'unsupportedAuthorityDetected', 'strongerFulfilled', 'noOpDetected',
    ],
  },
  professional: {
    style: 'professional',
    requiresExistingSourceMateriality: true,
    requiresGroundedPredicateTransformation: false,
    minimumExistingSourceLengthRatio: 0.97,
    writerContract: ['improve formal clarity and cohesion', 'preserve material fact topology'],
    requiredEvidenceKeys: [
      'style', 'professionalFramingOperations', 'cohesionClarityOperations', 'markerOnlyChangeDetected',
      'jargonOrFillerDetected', 'professionalFulfilled', 'noOpDetected',
    ],
  },
}) as Readonly<Record<SummaryV3Style, SummaryV3StyleStrategy>>;

const M5_OPERATION_FOR_STYLE: Readonly<Record<SummaryV3Style, string>> = {
  shorter: 'summary_shorter',
  stronger: 'summary_stronger',
  professional: 'summary_professional',
};

const NOT_APPLICABLE_OPERATIONS: Readonly<Record<string, SummaryV3StyleNotApplicableReason>> = {
  summary_generate: 'm4_generate_owned_elsewhere',
  experience_generate: 'experience_owned_elsewhere',
  experience_enhance: 'experience_owned_elsewhere',
  summary_cross_locale: 'm6_or_future_locale_operation',
};

const VIOLATION_CODES = new Set<SummaryV3StyleViolationCode>([
  'missing_fact', 'lost_source_fact', 'unsupported_claim', 'unsupported_authority', 'unsupported_metric',
  'invalid_language', 'invalid_native_surface', 'style_not_fulfilled', 'marker_only_change',
  'modifier_only_change', 'repeated_style_modifier', 'stacked_style_modifier', 'corporate_jargon',
  'stale_identity', 'malformed_candidate', 'safe_no_op',
]);

export const SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME = 'submit_summary_style_candidate' as const;
export const SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME = 'submit_summary_style_evaluation' as const;

/** Finite parser-owned classes for initial writer source-floor failures. */
export const SUMMARY_V3_STYLE_M5_WRITER_OUTPUT_CONTRACT_FAILURE_CLASSES = [
  'required_fact_coverage',
  'source_lock_preservation',
  'calendar_date_source_floor',
  'exact_material_source_floor',
  'entity_fact_binding_preservation',
  'candidate_source_floor',
  'unit_declared_fact_binding',
] as const;
export type SummaryV3StyleWriterOutputContractFailureClass =
  (typeof SUMMARY_V3_STYLE_M5_WRITER_OUTPUT_CONTRACT_FAILURE_CLASSES)[number];

const SUMMARY_V3_STYLE_M5_VIOLATION_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['code', 'factIdHashes', 'unitHashes', 'repairable'],
  properties: {
    code: { type: 'string', enum: [...VIOLATION_CODES] },
    factIdHashes: { type: 'array', maxItems: 32, items: { type: 'string' } },
    unitHashes: { type: 'array', maxItems: 32, items: { type: 'string' } },
    repairable: { type: 'boolean' },
  },
} as const;

const SUMMARY_V3_STYLE_M5_PHASE_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['status', 'violations'],
  properties: {
    status: { type: 'string', enum: ['passed', 'failed'] },
    violations: { type: 'array', maxItems: 32, items: SUMMARY_V3_STYLE_M5_VIOLATION_SCHEMA },
  },
} as const;

/*
 * The evaluator is a forced structured-tool boundary, not merely a runtime
 * parser boundary. Keep the three evidence alternatives closed here as well
 * as in the server parser so a provider cannot legally emit an unbounded
 * object that happens to be rejected only after transport.
 */
const SUMMARY_V3_STYLE_M5_SHORTER_EVIDENCE_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: [...SUMMARY_V3_STYLE_STRATEGIES.shorter.requiredEvidenceKeys],
  properties: {
    style: { type: 'string', enum: ['shorter'] },
    semanticCompressionOperations: { type: 'integer', minimum: 0, maximum: 12_000 },
    sourceNormalizedLength: { type: 'integer', minimum: 0, maximum: 12_000 },
    candidateNormalizedLength: { type: 'integer', minimum: 0, maximum: 12_000 },
    lengthDelta: { type: 'integer', minimum: -12_000, maximum: 12_000 },
    lengthDeltaPercent: { type: 'number', minimum: -1, maximum: 1 },
    sourceUnitCount: { type: 'integer', minimum: 0, maximum: 64 },
    candidateUnitCount: { type: 'integer', minimum: 0, maximum: 64 },
    sourceClauseCount: { type: 'integer', minimum: 0, maximum: 128 },
    candidateClauseCount: { type: 'integer', minimum: 0, maximum: 128 },
    factCoverage: { type: 'boolean' },
    shorterFulfilled: { type: 'boolean' },
    noOpDetected: { type: 'boolean' },
  },
} as const;

const SUMMARY_V3_STYLE_M5_STRONGER_EVIDENCE_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: [...SUMMARY_V3_STYLE_STRATEGIES.stronger.requiredEvidenceKeys],
  properties: {
    style: { type: 'string', enum: ['stronger'] },
    strongerPredicateTransformations: { type: 'integer', minimum: 0, maximum: 12_000 },
    structuralStrengtheningCount: { type: 'integer', minimum: 0, maximum: 12_000 },
    modifierOnlyTransformationDetected: { type: 'boolean' },
    repeatedStyleModifierCount: { type: 'integer', minimum: 0, maximum: 12_000 },
    stackedModifierDetected: { type: 'boolean' },
    unsupportedAuthorityDetected: { type: 'boolean' },
    strongerFulfilled: { type: 'boolean' },
    noOpDetected: { type: 'boolean' },
  },
} as const;

const SUMMARY_V3_STYLE_M5_PROFESSIONAL_EVIDENCE_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  required: [...SUMMARY_V3_STYLE_STRATEGIES.professional.requiredEvidenceKeys],
  properties: {
    style: { type: 'string', enum: ['professional'] },
    professionalFramingOperations: { type: 'integer', minimum: 0, maximum: 12_000 },
    cohesionClarityOperations: { type: 'integer', minimum: 0, maximum: 12_000 },
    markerOnlyChangeDetected: { type: 'boolean' },
    jargonOrFillerDetected: { type: 'boolean' },
    professionalFulfilled: { type: 'boolean' },
    noOpDetected: { type: 'boolean' },
  },
} as const;

export const SUMMARY_V3_STYLE_M5_WRITER_TOOL = immutableCopy({
  name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  description: 'Submit exactly one fact-locked Summary style candidate. This tool cannot validate, apply, persist, charge usage, or authorize any side effect.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'units'],
    properties: {
      operationId: { type: 'string' }, snapshotHash: { type: 'string' }, manifestHash: { type: 'string' },
       style: { type: 'string', enum: [...SUMMARY_V3_STYLE_M5_STYLES] }, locale: { type: 'string', enum: [...SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES] },
      units: {
        type: 'array', minItems: 1, maxItems: 64,
        items: {
          type: 'object', additionalProperties: false, required: ['unitId', 'text', 'factIds'],
          properties: {
            unitId: { type: 'string' }, text: { type: 'string' },
            factIds: { type: 'array', minItems: 1, items: { type: 'string' } },
          },
        },
      },
    },
  },
});

export const SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL = immutableCopy({
  name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  description: 'Submit only bounded Summary style evaluation evidence. This tool cannot write replacement prose, apply, persist, charge usage, or authorize any side effect.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'candidateHash', 'candidateUnitHashes', 'phases', 'representedFactIdHashes', 'missingFactIdHashes', 'roleIdentityResolution', 'styleEvidence'],
    properties: {
      operationId: { type: 'string' }, snapshotHash: { type: 'string' }, manifestHash: { type: 'string' },
       style: { type: 'string', enum: [...SUMMARY_V3_STYLE_M5_STYLES] }, locale: { type: 'string', enum: [...SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES] },
      candidateHash: { type: 'string' },
      candidateUnitHashes: { type: 'array', minItems: 1, maxItems: 64, items: { type: 'string' } },
      phases: {
        type: 'object', additionalProperties: false,
        required: [...SUMMARY_V3_STYLE_M5_PHASES],
        properties: {
          structural: SUMMARY_V3_STYLE_M5_PHASE_SCHEMA,
          semantic_grounding: SUMMARY_V3_STYLE_M5_PHASE_SCHEMA,
          language_native_quality: SUMMARY_V3_STYLE_M5_PHASE_SCHEMA,
          style_fulfillment: SUMMARY_V3_STYLE_M5_PHASE_SCHEMA,
        },
      },
      representedFactIdHashes: { type: 'array', maxItems: 256, items: { type: 'string' } },
      missingFactIdHashes: { type: 'array', maxItems: 256, items: { type: 'string' } },
      roleIdentityResolution: { type: 'string', enum: [...SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS] },
      styleEvidence: {
        oneOf: [
          SUMMARY_V3_STYLE_M5_SHORTER_EVIDENCE_SCHEMA,
          SUMMARY_V3_STYLE_M5_STRONGER_EVIDENCE_SCHEMA,
          SUMMARY_V3_STYLE_M5_PROFESSIONAL_EVIDENCE_SCHEMA,
        ],
      },
    },
  },
});

/**
 * Anthropic's strict tool boundary accepts only a bounded subset of JSON
 * Schema.  The authoritative M5 schemas above intentionally retain local
 * safety ceilings (for example maxItems and numeric bounds) so the parser can
 * reject oversized or malformed provider candidates.  Those local-only
 * constraints cannot be sent verbatim to Anthropic: direct messages.create
 * calls do not apply the SDK's schema transformer, and the API rejects them
 * with HTTP 400.  Keep the authoritative schemas immutable and derive a
 * deterministic provider wire projection instead.
 */
export type SummaryV3StyleProviderTool = Readonly<{
  name: string;
  description: string;
  strict: true;
  input_schema: Readonly<{
    type: 'object';
    [key: string]: unknown;
  }>;
}>;

const SUMMARY_V3_STYLE_PROVIDER_UNSUPPORTED_KEYS = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'maxItems',
  'maxContains',
  'uniqueItems',
  'contains',
  'minProperties',
  'maxProperties',
]);

function schemaRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * oneOf is projected to anyOf only for the evaluator's styleEvidence union.
 * Each branch carries a non-empty, pairwise-disjoint style enum, making the
 * alternatives a true discriminator partition rather than an overlapping
 * union.  An unexpected overlapping/undiscriminated oneOf fails closed.
 */
function hasDisjointStyleAlternatives(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const seen = new Set<string>();
  for (const variant of value) {
    const record = schemaRecord(variant);
    const properties = schemaRecord(record?.properties);
    const style = schemaRecord(properties?.style);
    const enumValues = style?.enum;
    if (!Array.isArray(enumValues) || enumValues.length === 0) return false;
    for (const item of enumValues) {
      if (typeof item !== 'string' || seen.has(item)) return false;
      seen.add(item);
    }
  }
  return true;
}

function projectSummaryV3StyleProviderSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(projectSummaryV3StyleProviderSchema);
  const record = schemaRecord(value);
  if (!record) return value;
  const projected: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [key, child] of Object.entries(record)) {
    if (key === 'oneOf') {
      if (!hasDisjointStyleAlternatives(child)) {
        throw new Error('M5 provider schema oneOf lacks a disjoint style discriminator');
      }
      projected.anyOf = child.map(projectSummaryV3StyleProviderSchema);
      continue;
    }
    if (key === 'minItems' && child !== 0 && child !== 1) {
      removed.push(`${key}=${JSON.stringify(child)}`);
      continue;
    }
    if (SUMMARY_V3_STYLE_PROVIDER_UNSUPPORTED_KEYS.has(key)) {
      removed.push(`${key}=${JSON.stringify(child)}`);
      continue;
    }
    projected[key] = projectSummaryV3StyleProviderSchema(child);
  }
  if (removed.length > 0) {
    const existing = typeof projected.description === 'string' ? projected.description : '';
    const note = `Provider transport omits local-only constraints (${removed.join(', ')}); M5 local validation remains authoritative.`;
    projected.description = existing ? `${existing}\n\n${note}` : note;
  }
  return projected;
}

export function projectSummaryV3StyleToolForProvider(
  tool: typeof SUMMARY_V3_STYLE_M5_WRITER_TOOL | typeof SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
): SummaryV3StyleProviderTool {
  return immutableCopy({
    name: tool.name,
    description: tool.description,
    strict: true as const,
    input_schema: projectSummaryV3StyleProviderSchema(tool.input_schema) as SummaryV3StyleProviderTool['input_schema'],
  });
}

/** Stable wire contracts used by every M5 writer/evaluator invocation. */
export const SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL = projectSummaryV3StyleToolForProvider(SUMMARY_V3_STYLE_M5_WRITER_TOOL);
export const SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL = projectSummaryV3StyleToolForProvider(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL);

export function isSummaryV3Style(value: unknown): value is SummaryV3Style {
  return typeof value === 'string' && (SUMMARY_V3_STYLE_M5_STYLES as readonly string[]).includes(value);
}

export function canonicalSummaryV3StyleLocale(value: unknown): SummaryV3StyleSupportedLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/_/gu, '-').toLowerCase();
  if (/^pt-br(?:-|$)/u.test(normalized)) return 'pt-BR';
  const primary = normalized.split('-')[0];
  return (SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES as readonly string[]).includes(primary)
    ? primary as SummaryV3StyleSupportedLocale
    : null;
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

/** Stable non-secret fingerprint for identity/evidence correlation only. */
export function hashSummaryV3StyleValue(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return `m5_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function normalizeSummaryV3StyleText(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

/**
 * Canonicalize the decimal surfaces used by the supported M5.1 locales.
 * This is identity normalization only: the source/candidate prose itself is
 * never rewritten or exposed. NFKC already handles fullwidth digits, while
 * Arabic-Indic, extended Arabic-Indic, and Devanagari require their decimal
 * zero offsets to compare safely with structured manifest numbers.
 */
const SUMMARY_V3_STYLE_DECIMAL_ZERO_CODEPOINTS = [0x0030, 0x0660, 0x06f0, 0x0966, 0xff10] as const;

export function normalizeSummaryV3StyleNumericSurface(value: string): string {
  return Array.from(value).map((character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return character;
    const decimalZero = SUMMARY_V3_STYLE_DECIMAL_ZERO_CODEPOINTS
      .find((zero) => codePoint >= zero && codePoint <= zero + 9);
    return decimalZero === undefined ? character : String(codePoint - decimalZero);
  }).join('').replace(/\u066b/gu, '.').replace(/\u066c/gu, ',');
}

const JAPANESE_EXACT_SURFACE_PARTICLES = new Set(['は', 'が', 'を', 'に', 'の', 'と', 'へ', 'も', 'や', 'か', 'さん', '氏', '様']);
const CASED_MULTI_TOKEN_NONIDENTITY_PREFIXES = new Set(['a', 'an', 'the', 'current', 'former', 'past', 'previous']);
const CASED_SINGLE_TOKEN_SUBJECT_NONIDENTITY_PREFIXES = new Set([
  'a', 'an', 'the', 'current', 'former', 'past', 'previous', 'this', 'that', 'these', 'those',
  'i', 'we', 'he', 'she', 'they', 'it',
]);
const CASED_SUBJECT_DISCOURSE_PREFIXES = new Set([
  'currently', 'formerly', 'previously', 'presently', 'now', 'today', 'recently', 'historically', 'initially',
]);
const JAPANESE_NONIDENTITY_SINGLE_SUBJECTS = new Set(['私', '僕', '俺', '彼', '誰', '何']);
const LOWERCASE_NAME_CONNECTOR_SEQUENCE = /^(?:\s+(?:(?:de|del|da|di|van|von|bin|der|den|ten|ter|al|el|la|le|du|dos|das)\s+)+\p{Lu})/iu;
const CASED_CONNECTOR_IDENTITY_PATTERN = /\p{Lu}[\p{L}\p{N}'’.-]*(?:\s+(?:(?:de|del|da|di|van|von|bin|der|den|ten|ter|al|el|la|le|du|dos|das)\s+)+\p{Lu}[\p{L}\p{N}'’.-]*)+/gu;

function isExactSurfaceBoundary(
  surface: string,
  before: string | undefined,
  followingText: string,
): boolean {
  const following = followingText[0];
  const isWordOrNumber = (value: string | undefined) => !!value && /[\p{L}\p{N}]/u.test(value);
  const isJapaneseCharacter = (value: string | undefined) => !!value && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value);
  const hasJapaneseScript = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(surface);
  if (!hasJapaneseScript) {
    // A cased Latin technical surface can be grammatically adjacent to
    // Japanese (`高いAPIを`) without becoming a substring match. Both sides
    // must still be Japanese-script characters or real boundaries, so `Go`
    // never matches inside `Google`.
    const casedLatinTechnical = /\p{Lu}/u.test(surface) && /\p{Script=Latin}/u.test(surface);
    const numericSurface = /^\p{N}+(?:[.,]\p{N}+)?$/u.test(surface);
    if ((casedLatinTechnical || numericSurface)
      && (!isWordOrNumber(before) || isJapaneseCharacter(before))
      && (!isWordOrNumber(following) || isJapaneseCharacter(following))) return true;
    return !isWordOrNumber(before) && !isWordOrNumber(following);
  }
  // Japanese names can be adjacent to particles/honorifics rather than a
  // whitespace boundary (`ミラは`, `ミラさん`), but must not match inside a
  // longer unrelated name such as `ミラリン`.
  const beforeAllowed = !isWordOrNumber(before) || JAPANESE_EXACT_SURFACE_PARTICLES.has(before || '');
  // A complete source unit may end in `。` immediately followed by the next
  // Japanese sentence. The terminal delimiter itself is the hard boundary;
  // requiring whitespace here would reject the immutable source unit.
  const afterAllowed = /[.!?。！？।]$/u.test(surface)
    || !isWordOrNumber(following)
    || Array.from(JAPANESE_EXACT_SURFACE_PARTICLES).some((particle) => followingText.startsWith(particle));
  return beforeAllowed && afterAllowed;
}

/** Exact normalized textual surface match; never accepts `Go` inside `Google`. */
export function summaryV3StyleContainsExactSurface(
  container: string,
  surface: string,
  caseSensitive = false,
): boolean {
  const normalizedContainer = normalizeSummaryV3StyleText(container);
  const normalizedSurface = normalizeSummaryV3StyleText(surface);
  if (!normalizedContainer || !normalizedSurface) return false;
  const haystack = caseSensitive ? normalizedContainer : normalizedContainer.toLocaleLowerCase();
  const needle = caseSensitive ? normalizedSurface : normalizedSurface.toLocaleLowerCase();
  let start = 0;
  while (start < haystack.length) {
    const index = haystack.indexOf(needle, start);
    if (index < 0) return false;
    if (isExactSurfaceBoundary(needle, haystack[index - 1], haystack.slice(index + needle.length))) return true;
    start = index + needle.length;
  }
  return false;
}

/**
 * Exact-cased material source surfaces protect names and technical spellings
 * (`Ava`, `R`, `Go`, `C#`, `Node.js`) without imposing a locale-specific
 * semantic parser. Ordinary lowercase duty language remains evaluator-owned.
 */
export function summaryV3StyleCandidatePreservesExactMaterialSurfaces(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return true;
  const surfaces = rawFactTokens(snapshot.sourceSummary)
    .filter((token) => /\p{Lu}/u.test(token))
    .filter((token) => {
      const folded = token.toLocaleLowerCase();
      return !FACT_ANCHOR_STOP_WORDS.has(folded)
        && !PREDICATE_SUBJECT_TOKENS.has(folded)
        // Current/prior state is validated by the server's typed employment
        // guard; it is not a literal identity surface that should mask that
        // more precise terminal behind a generic source-floor failure.
        && !CASED_MULTI_TOKEN_NONIDENTITY_PREFIXES.has(folded);
    });
  // Individual token locks protect casing, while an exact cased phrase
  // anywhere in the source closes insertion/reordering (`Ava Priya Patel`
  // and `Patel Ava`) without assuming every title-cased word is a person.
  const protectedSurfaces = [
    ...surfaces,
    ...casedMultiTokenExactSurfaces(snapshot.sourceSummary),
    ...casedConnectorIdentityExactSurfaces(snapshot.sourceSummary),
    ...japaneseSubjectIdentitySurfaces(snapshot.sourceSummary),
  ];
  if (!Array.from(new Set(protectedSurfaces))
    .every((surface) => summaryV3StyleContainsExactSurface(candidateText, surface, true))) return false;
  if (!casedSingleTokenSubjectIdentitySurfaces(snapshot)
    .every((surface) => candidatePreservesUnexpandedCasedIdentitySurface(
      candidateText,
      surface,
      casedIdentityCommaSuffixes(snapshot.sourceSummary, surface),
      sourceParentheticalIdentitySuffixes(snapshot.sourceSummary, surface, true),
    ))) return false;
  if (!japaneseSubjectIdentitySurfaces(snapshot.sourceSummary)
    .every((surface) => candidatePreservesUnexpandedJapaneseIdentitySurface(
      candidateText,
      surface,
      sourceParentheticalIdentitySuffixes(snapshot.sourceSummary, surface, true),
    ))) return false;
  if (!boundedRoleAttestedSelfIdentityFrames(snapshot)
    .every((frame) => candidatePreservesBoundedRoleAttestedSelfIdentity(candidateText, frame))) return false;
  if (!roleAttestedUncasedIdentityFrames(snapshot)
    .every((frame) => candidatePreservesRoleAttestedUncasedIdentity(candidateText, frame))) return false;
  return inlineRoleAttestedUncasedIdentityFrames(snapshot)
    .every((frame) => candidatePreservesInlineRoleAttestedUncasedIdentity(candidateText, frame));
}

export function normalizedSummaryV3StyleLength(value: string): number {
  return normalizeSummaryV3StyleText(value).replace(/[\p{P}\p{S}\s]/gu, '').length;
}

export function countSummaryV3StyleUnits(value: string): number {
  const normalized = normalizeSummaryV3StyleText(value);
  if (!normalized) return 0;
  return normalized.split(/(?<=[!?。！？।])\s*|(?<=\.)\s+(?=\S)/u).filter(Boolean).length;
}

export function countSummaryV3StyleClauses(value: string): number {
  const normalized = normalizeSummaryV3StyleText(value);
  if (!normalized) return 0;
  return normalized.split(/[,;:，、؛]/u).filter((part) => part.trim().length > 0).length;
}

function punctuationInsensitive(value: string): string {
  return normalizeSummaryV3StyleText(value).replace(/[^\p{L}\p{N}]/gu, '').toLocaleLowerCase();
}

function sourceUnitTexts(value: string): readonly string[] {
  const normalized = normalizeSummaryV3StyleText(value);
  if (!normalized) return [];
  // A period is a sentence boundary only when followed by whitespace. This
  // keeps `Node.js` and `.NET` atomic source facts while preserving ordinary
  // prose sentence units and script-native sentence delimiters.
  return normalized.split(/(?<=[!?。！？।])\s*|(?<=\.)\s+(?=\S)/u).filter(Boolean);
}

/**
 * A compact, literal multi-token surface guard for cased identities. It does
 * not classify names or roles: it preserves any source sequence of at least
 * two cased lexical tokens after stripping only a leading article/state word.
 * This closes insertion/reordering both at and away from unit start without
 * importing a locale-specific name parser.
 */
function casedMultiTokenExactSurfaces(value: string): readonly string[] {
  return sourceUnitTexts(value)
    .flatMap((unit) => Array.from(unit.matchAll(/\p{Lu}[\p{L}\p{N}'’.-]*(?:\s+\p{Lu}[\p{L}\p{N}'’.-]*)+/gu))
      .map((match) => {
        // The lexical matcher deliberately admits dots for source forms such
        // as `Node.js`; strip only terminal sentence punctuation before
        // preserving a multi-token identity surface (`Product Engineer.`).
        const tokens = match[0].replace(/[.!?。！？।]+$/u, '').split(/\s+/u);
        while (tokens.length > 0 && CASED_MULTI_TOKEN_NONIDENTITY_PREFIXES.has(tokens[0]!.toLocaleLowerCase())) tokens.shift();
        return tokens.length >= 2 ? tokens.join(' ') : undefined;
      }))
    .filter((surface): surface is string => !!surface);
}

/**
 * Preserve an exact cased identity joined by already-recognized lowercase
 * connectors (`Ava van Dyke`) anywhere in a source unit. This is a literal
 * source surface, not a general person parser; it closes insertion/reordering
 * around a connector while retaining ordinary lowercase prose ownership.
 */
function casedConnectorIdentityExactSurfaces(value: string): readonly string[] {
  return sourceUnitTexts(value)
    .flatMap((unit) => Array.from(unit.matchAll(CASED_CONNECTOR_IDENTITY_PATTERN), (match) => match[0]));
}

/**
 * A compact cased name cannot be distinguished from every titlecase word.
 * Preserve it only in unambiguous English subject frames: a copula/possessive,
 * direct self-identification, a manifest-role apposition, or a source-unit-
 * leading cased subject followed by a lowercase action token. Articles,
 * pronouns, and employment-state labels are excluded so this remains a source
 * floor rather than a title/name parser.
 */
function sourceClauseLeadingSegments(value: string): readonly string[] {
  return sourceUnitTexts(value).flatMap((unit) => [
    unit,
    ...Array.from(unit.matchAll(/[,;:，、؛]\s*/gu), (match) => unit.slice((match.index ?? 0) + match[0].length)),
  ]);
}

/**
 * A compact cased source identity may follow one explicit lowercase discourse
 * prefix (`currently Li builds ...`). This is not a generic name classifier:
 * the prefix is finite, the identity remains a single cased lexical token,
 * and it must be followed immediately by a lowercase action token.
 */
function casedDiscoursePrefixedSubjectIdentitySurfaces(value: string): readonly string[] {
  return sourceClauseLeadingSegments(value)
    .map((segment) => {
      const match = /^(\p{Ll}+)\s+(\p{Lu}[\p{L}\p{N}'’.-]*)\s+\p{Ll}[\p{L}\p{N}'’.-]*/u.exec(segment);
      return match && CASED_SUBJECT_DISCOURSE_PREFIXES.has(match[1]!.toLocaleLowerCase()) ? match[2] : undefined;
    })
    .filter((surface): surface is string => !!surface);
}

function casedSingleTokenSubjectIdentitySurfaces(
  snapshot: SummaryV3StyleOperationSnapshot,
): readonly string[] {
  const roles = snapshot.selectedEntries
    .map((entry) => snapshot.manifestFacts.find((fact) => fact.id === `${entry.stableId}:role`)?.text)
    .filter((role): role is string => !!role);
  return [
    ...sourceClauseLeadingSegments(snapshot.sourceSummary)
    .flatMap((unit) => [
      /^([\p{Lu}][\p{L}\p{N}'’.-]*)\s+(?:is|was|has)\b/u.exec(unit)?.[1],
      /^I\s+am\s+([\p{Lu}][\p{L}\p{N}'’.-]*)(?=$|[,.!?])/u.exec(unit)?.[1],
      /^I['’]m\s+([\p{Lu}][\p{L}\p{N}'’.-]*)(?=$|[,.!?])/u.exec(unit)?.[1],
      /^My\s+name\s+is\s+([\p{Lu}][\p{L}\p{N}'’.-]*)(?=$|[,.!?])/u.exec(unit)?.[1],
      /^([\p{Lu}][\p{L}\p{N}'’.-]*)\s+\p{Ll}[\p{L}\p{N}'’.-]*/u.exec(unit)?.[1],
    ])
    .filter((surface): surface is string => !!surface
      && !CASED_SINGLE_TOKEN_SUBJECT_NONIDENTITY_PREFIXES.has(surface.toLocaleLowerCase())),
    ...sourceClauseLeadingSegments(snapshot.sourceSummary)
      .flatMap((unit) => {
        const surface = /^([\p{Lu}][\p{L}\p{N}'’.-]*),\s+/u.exec(unit)?.[1];
        return surface && roles.some((role) => summaryV3StyleContainsExactSurface(unit, role, true)) ? [surface] : [];
      }),
    ...casedDiscoursePrefixedSubjectIdentitySurfaces(snapshot.sourceSummary),
  ];
}

/**
 * A title-cased role may legitimately follow a bounded source identity frame
 * (`I am Li,`, `I'm Li,`, `My name is Li,`, or `Li, Product Engineer`). Retain
 * only its exact source comma suffix; an inserted `Wei` is not source-attested.
 */
function casedIdentityCommaSuffixes(value: string, surface: string): readonly string[] {
  const prefixes = [`I am ${surface}`, `I'm ${surface}`, `I’m ${surface}`, `My name is ${surface}`, surface];
  return sourceClauseLeadingSegments(value)
    .flatMap((unit) => prefixes.flatMap((prefix) => unit.startsWith(prefix) ? [unit.slice(prefix.length)] : []))
    .filter((suffix) => /^,\s*\p{Lu}/u.test(suffix));
}

/**
 * A plain exact word boundary accepts `Li` inside `Li Wei`, `Wei Li`, or
 * `Li de Wei`. This additional subject-identity check requires every
 * exact-cased occurrence to remain a standalone surface rather than either
 * side of a cased expansion, including compact lowercase name connectors.
 */
function candidatePreservesUnexpandedCasedIdentitySurface(
  candidateText: string,
  surface: string,
  sourceCommaSuffixes: readonly string[],
  sourceParentheticalSuffixes: readonly string[],
): boolean {
  const haystack = normalizeSummaryV3StyleText(candidateText);
  const needle = normalizeSummaryV3StyleText(surface);
  let start = 0;
  let foundStandalone = false;
  while (start < haystack.length) {
    const index = haystack.indexOf(needle, start);
    if (index < 0) break;
    const precedingText = haystack.slice(0, index);
    const followingText = haystack.slice(index + needle.length);
    if (isExactSurfaceBoundary(needle, haystack[index - 1], followingText)) {
      const parentheticalSuffix = immediateIdentityParentheticalSuffix(followingText)?.suffix;
      const explicitSelfIntroductionPrefix = /(?:^|[.!?。！？।]\s*)(?:I\s+am\s+|I['’]m\s+|My\s+name\s+is\s+)$/u.test(precedingText);
      if ((/(?:\p{Lu}[\p{L}\p{N}'’]*\s+|[-'’]\p{Lu})$/u.test(precedingText)
          && !explicitSelfIntroductionPrefix)
        || /^(?:(?:\s+|[-'’])\p{Lu})/u.test(followingText)
        || (!!parentheticalSuffix && !sourceParentheticalSuffixes.includes(parentheticalSuffix))
        || (/^,\s*\p{Lu}/u.test(followingText)
          && !sourceCommaSuffixes.some((suffix) => followingText.startsWith(suffix)))
        || LOWERCASE_NAME_CONNECTOR_SEQUENCE.test(followingText)) return false;
      foundStandalone = true;
    }
    start = index + needle.length;
  }
  return foundStandalone;
}

type BoundedRoleAttestedSelfIdentityFrame = Readonly<{
  /** Exact source-unit-leading self-identification phrase, including its final space. */
  readonly prefix: string;
  /** One compact, source-attested identity surface immediately after the prefix. */
  readonly surface: string;
  /** The first lexical source witness immediately after the identity. */
  readonly successor: string;
  /** Optional source delimiter that must remain immediately before successor. */
  readonly delimiter: string | null;
}>;

/**
 * These are explicit first-person self-introduction frames, not a name
 * classifier. A compact surface becomes protected only when the source unit
 * also carries one exact selected role, except for the Japanese copular form
 * whose `です` itself is the bounded identity witness. Keeping the small list
 * here makes the contract locale-aware without adding locale rewrite tables.
 */
const BOUNDED_SELF_IDENTITY_PREFIXES: readonly RegExp[] = [
  /^(I\s+am\s+)([\p{L}\p{N}'’.-]+)/u,
  /^(I['’]m\s+)([\p{L}\p{N}'’.-]+)/u,
  /^(My\s+name\s+is\s+)([\p{L}\p{N}'’.-]+)/u,
  /^(Ich\s+(?:bin|heiße)\s+)([\p{L}\p{N}'’.-]+)/u,
  /^(Ја\s+сам\s+|Ja\s+sam\s+)([\p{L}\p{N}'’.-]+)/u,
  /^(أنا\s+)([\p{Script=Arabic}]{2,})/u,
  /^(मैं\s+)([\p{Script=Devanagari}]{2,})/u,
  /^((?:私|僕|俺)(?:は)?)([\p{Script=Han}\p{Script=Katakana}]+?)(?=(?:さん|氏|様)?(?:です|であります))/u,
];

function boundedSelfIdentitySuccessor(
  sourceUnitTail: string,
): Readonly<{ readonly delimiter: string | null; readonly value: string }> | null {
  const tail = sourceUnitTail.trimStart();
  const delimiter = /^[,،，、]/u.exec(tail)?.[0] ?? null;
  const afterDelimiter = delimiter ? tail.slice(delimiter.length).trimStart() : tail;
  const surface = /^(?:[\p{L}\p{N}]+)/u.exec(afterDelimiter)?.[0];
  return surface ? immutableCopy({ delimiter, value: surface }) : null;
}

/**
 * A self-ID may follow a compact framing clause (`Currently, I am Li`) while
 * still remaining an explicit source-owned construction. Do not search free
 * prose: only the source-unit start and post-clause-delimiter positions are
 * admitted to the bounded extractor.
 */
function boundedSelfIdentitySourceSegments(unit: string): readonly string[] {
  return [
    unit,
    ...Array.from(unit.matchAll(/[,;:，、؛]\s*/gu), (match) => unit.slice((match.index ?? 0) + match[0].length)),
  ];
}

function boundedRoleAttestedSelfIdentityFrames(
  snapshot: SummaryV3StyleOperationSnapshot,
): readonly BoundedRoleAttestedSelfIdentityFrame[] {
  const roles = snapshot.selectedEntries
    .map((entry) => snapshot.manifestFacts.find((fact) => fact.id === `${entry.stableId}:role`)?.text)
    .filter((role): role is string => !!role);
  if (roles.length === 0) return [];
  const frames: BoundedRoleAttestedSelfIdentityFrame[] = [];
  for (const unit of sourceUnitTexts(snapshot.sourceSummary)) {
    for (const segment of boundedSelfIdentitySourceSegments(unit)) {
      for (const pattern of BOUNDED_SELF_IDENTITY_PREFIXES) {
        const match = pattern.exec(segment);
        if (!match) continue;
        const japaneseCopularFrame = /^(?:私|僕|俺)/u.test(match[1] ?? '');
        // Role spelling/capitalization is a source context qualifier here;
        // preserve identity casing separately through exact source surfaces.
        const roleAttested = roles.some((role) => summaryV3StyleContainsExactSurface(unit, role));
        if (!roleAttested && !japaneseCopularFrame) continue;
        const successor = boundedSelfIdentitySuccessor(segment.slice(match[0].length));
        if (!successor) continue;
        frames.push(immutableCopy({
          // Every listed pattern deliberately has exactly two captures:
          // self-identification prefix, then one compact identity surface.
          prefix: match[1]!,
          surface: match[2]!,
          successor: successor.value,
          delimiter: successor.delimiter,
        }) as BoundedRoleAttestedSelfIdentityFrame);
        break;
      }
    }
  }
  return frames;
}

/**
 * The source form is deliberately replayed as `prefix + compact identity +
 * source witness`. An insertion (`Li Wei`, `ميرا أحمد`, `森・田`) changes the
 * immediate witness; a reordering loses the source prefix. This stays a
 * bounded self-identification invariant rather than a generic NER rule.
 */
function candidatePreservesBoundedRoleAttestedSelfIdentity(
  candidateText: string,
  frame: BoundedRoleAttestedSelfIdentityFrame,
): boolean {
  const haystack = normalizeSummaryV3StyleText(candidateText);
  // Frame fragments originate from the already-normalized source unit. Keep
  // the prefix's deliberate trailing separator: normalizing it again would
  // trim `I am ` to `I am` and make an unchanged self-identification fail.
  const prefix = frame.prefix;
  const surface = frame.surface;
  const expected = `${prefix}${surface}`;
  let start = 0;
  let foundOriginalFrame = false;
  while (start < haystack.length) {
    const index = haystack.indexOf(expected, start);
    if (index < 0) break;
    const precedingText = haystack.slice(0, index);
    const followingText = haystack.slice(index + expected.length);
    if (isSummaryV3StyleIdentityFramePosition(precedingText)) {
      const afterIdentity = followingText.trimStart();
      const afterDelimiter = frame.delimiter === null
        ? afterIdentity
        : afterIdentity.startsWith(frame.delimiter)
          ? afterIdentity.slice(frame.delimiter.length).trimStart()
          : null;
      const preservesSuccessor = afterDelimiter !== null
        && startsWithExactSummaryV3StyleSurface(afterDelimiter, frame.successor);
      if (!preservesSuccessor) return false;
      foundOriginalFrame = true;
    }
    start = index + expected.length;
  }
  return foundOriginalFrame;
}

function isSummaryV3StyleIdentityFramePosition(precedingText: string): boolean {
  if (isSummaryV3StyleUnitLeadingPosition(precedingText)) return true;
  return /[,;:，、؛]$/u.test(precedingText.replace(/\s+$/u, ''));
}

/**
 * Japanese compact identities have no capitalization. At a source clause
 * start, a Han/Katakana surface directly followed by a subject/topic particle
 * or an honorific is an unambiguous identity frame. This remains narrower than
 * a generic Japanese name classifier and excludes short first-person/pronoun
 * forms that would otherwise constrain ordinary source language.
 */
function japaneseSubjectIdentitySurfaces(value: string): readonly string[] {
  return sourceClauseLeadingSegments(value)
    .map((segment) => /^([\p{Script=Han}\p{Script=Katakana}]+?)(?:(?:さん|氏|様)(?:は|が|も)?|(?:は|が|も))/u.exec(segment)?.[1])
    .filter((surface): surface is string => !!surface && !JAPANESE_NONIDENTITY_SINGLE_SUBJECTS.has(surface));
}

/**
 * `・` and whitespace are exact lexical boundaries, but in a clause-leading Japanese
 * subject frame they can also join an expanded identity (`ミラ・アキコ`,
 * `森・田さん`). Reject that bounded construction while preserving ordinary
 * particle/honorific adjacency.
 */
function candidatePreservesUnexpandedJapaneseIdentitySurface(
  candidateText: string,
  surface: string,
  sourceParentheticalSuffixes: readonly string[],
): boolean {
  const haystack = normalizeSummaryV3StyleText(candidateText);
  const needle = normalizeSummaryV3StyleText(surface);
  let start = 0;
  let foundStandalone = false;
  while (start < haystack.length) {
    const index = haystack.indexOf(needle, start);
    if (index < 0) break;
    const precedingText = haystack.slice(0, index);
    const followingText = haystack.slice(index + needle.length);
    // A direct Han/Katakana continuation is never a particle/honorific
    // boundary for this compact source identity (`森田`, `ミラリン`). Check it
    // even when the generic exact-surface helper would otherwise skip that
    // occurrence after an earlier valid repeated identity.
    if (/^[\p{Script=Han}\p{Script=Katakana}]/u.test(followingText)) return false;
    const parentheticalSuffix = immediateIdentityParentheticalSuffix(followingText)?.suffix;
    if (parentheticalSuffix && !sourceParentheticalSuffixes.includes(parentheticalSuffix)) return false;
    if (isExactSurfaceBoundary(needle, haystack[index - 1], followingText)) {
      if (/(?:[\p{Script=Han}\p{Script=Katakana}]+[・\s]+)$/u.test(precedingText)
        || /^(?:[・\s]+[\p{Script=Han}\p{Script=Katakana}]+)(?:(?:さん|氏|様)?(?:は|が|も|です|であります)|[・\s])/u.test(followingText)) return false;
      foundStandalone = true;
    }
    start = index + needle.length;
  }
  return foundStandalone;
}

type RoleAttestedUncasedIdentityFrame = Readonly<{
  readonly surface: string;
  readonly successor: string;
  readonly successorAfter: string | null;
  readonly permitsMarkedSuccessorReplacement: boolean;
}>;

type InlineRoleAttestedUncasedIdentityFrame = Readonly<{
  readonly surface: string;
  readonly roleFrame: string;
}>;

function startsWithExactSummaryV3StyleSurface(value: string, surface: string): boolean {
  const normalizedValue = normalizeSummaryV3StyleText(value);
  const normalizedSurface = normalizeSummaryV3StyleText(surface);
  return normalizedValue.startsWith(normalizedSurface)
    && isExactSurfaceBoundary(normalizedSurface, undefined, normalizedValue.slice(normalizedSurface.length));
}

function isSummaryV3StyleUnitLeadingPosition(precedingText: string): boolean {
  const trimmed = precedingText.replace(/\s+$/u, '');
  return trimmed.length === 0 || /[.!?。！？।]$/u.test(trimmed);
}

/**
 * Arabic and Devanagari do not carry a capitalization signal. This deliberately
 * avoids a general name classifier: it applies only to a compact token at a
 * source clause start that shares that clause with one exact structured role
 * surface. Once that identity is role-attested, its source-attested subject
 * frames elsewhere in the Summary use their next lexical token as a bounded
 * anti-expansion witness.
 */
function roleAttestedUncasedIdentityFrames(
  snapshot: SummaryV3StyleOperationSnapshot,
): readonly RoleAttestedUncasedIdentityFrame[] {
  const roles = snapshot.selectedEntries
    .map((entry) => snapshot.manifestFacts.find((fact) => fact.id === `${entry.stableId}:role`)?.text)
    .filter((role): role is string => !!role);
  if (roles.length === 0) return [];
  const markedAnchor = snapshot.transformableDuty
    ? summaryV3StyleFactAnchorTokens(snapshot.transformableDuty.predicateAnchor)
      .find((token) => !token.startsWith('span:'))
    : null;
  const sourceSegments = sourceClauseLeadingSegments(snapshot.sourceSummary);
  const validatedIdentities = new Set(sourceSegments
    .flatMap((segment) => {
      const identity = /^([\p{Script=Arabic}\p{Script=Devanagari}]{2,})\s+/u.exec(segment)?.[1];
      return identity && roles.some((role) => summaryV3StyleContainsExactSurface(segment, role, true)) ? [identity] : [];
    }));
  const frames: RoleAttestedUncasedIdentityFrame[] = [];
  for (const segment of sourceSegments) {
    const identity = /^([\p{Script=Arabic}\p{Script=Devanagari}]{2,})\s+/u.exec(segment)?.[1];
    if (!identity || !validatedIdentities.has(identity)) continue;
    const afterIdentity = segment.slice(identity.length).trimStart();
    const successor = /^([\p{Script=Arabic}\p{Script=Devanagari}]+)/u.exec(afterIdentity)?.[1];
    if (successor) {
      const afterSuccessor = afterIdentity.slice(successor.length).trimStart();
      const successorAfter = /^([\p{Script=Arabic}\p{Script=Devanagari}]+)/u.exec(afterSuccessor)?.[1] || null;
      const successorAnchor = summaryV3StyleFactAnchorTokens(successor).find((token) => !token.startsWith('span:'));
      frames.push(immutableCopy({
        surface: identity,
        successor,
        successorAfter,
        permitsMarkedSuccessorReplacement: !!markedAnchor && markedAnchor === successorAnchor,
      }) as RoleAttestedUncasedIdentityFrame);
    }
  }
  return frames;
}

/**
 * A compact Arabic or Devanagari surface in an explicit role construction is
 * a source-attested identity even when it is not clause-leading. The only
 * accepted frames are `surface ك<structured role>` and
 * `surface को <structured role>`; this is a literal employment-relation lock,
 * not a general name classifier.
 */
function inlineRoleAttestedUncasedIdentityFrames(
  snapshot: SummaryV3StyleOperationSnapshot,
): readonly InlineRoleAttestedUncasedIdentityFrame[] {
  const roles = snapshot.selectedEntries
    .map((entry) => snapshot.manifestFacts.find((fact) => fact.id === `${entry.stableId}:role`)?.text)
    .filter((role): role is string => !!role)
    .map((role) => normalizeSummaryV3StyleText(role));
  const frames: InlineRoleAttestedUncasedIdentityFrame[] = [];
  for (const unit of sourceUnitTexts(snapshot.sourceSummary)) {
    const normalizedUnit = normalizeSummaryV3StyleText(unit);
    const searchableUnit = normalizedUnit.toLocaleLowerCase();
    for (const role of roles) {
      const searchableRole = role.toLocaleLowerCase();
      let start = 0;
      while (start < searchableUnit.length) {
        const roleIndex = searchableUnit.indexOf(searchableRole, start);
        if (roleIndex < 0) break;
        const afterRole = normalizedUnit.slice(roleIndex + role.length);
        if (/^[\p{L}\p{N}]/u.test(afterRole)) {
          start = roleIndex + role.length;
          continue;
        }
        const beforeRole = normalizedUnit.slice(0, roleIndex);
        const match = /(?:^|\s)([\p{Script=Arabic}]{2,})\s+ك$/u.exec(beforeRole)
          || /(?:^|\s)([\p{Script=Devanagari}]{2,})\s+को\s+$/u.exec(beforeRole);
        if (match) {
          const surface = match[1]!;
          const surfaceIndex = beforeRole.lastIndexOf(surface);
          const roleFrame = normalizedUnit.slice(surfaceIndex + surface.length, roleIndex + role.length).trim();
          if (roleFrame) frames.push(immutableCopy({ surface, roleFrame }) as InlineRoleAttestedUncasedIdentityFrame);
        }
        start = roleIndex + role.length;
      }
    }
  }
  return frames;
}

/**
 * Preserve the source clause-leading compact identity frame without treating every
 * uncased token as a name.  An inserted compact lexical token before the
 * source successor (`لو أحمد مهندس`, `ली शर्मा इंजीनियर`) or a reordered
 * identity fails before the evaluator receives the candidate.
 */
function candidatePreservesRoleAttestedUncasedIdentity(
  candidateText: string,
  frame: RoleAttestedUncasedIdentityFrame,
): boolean {
  const haystack = normalizeSummaryV3StyleText(candidateText);
  const needle = normalizeSummaryV3StyleText(frame.surface);
  let start = 0;
  let foundOriginalFrame = false;
  while (start < haystack.length) {
    const index = haystack.indexOf(needle, start);
    if (index < 0) break;
    const precedingText = haystack.slice(0, index);
    const followingText = haystack.slice(index + needle.length);
    if (isExactSurfaceBoundary(needle, haystack[index - 1], followingText)) {
      const afterWhitespace = followingText.replace(/^\s+/u, '');
      const hasOriginalSuccessor = startsWithExactSummaryV3StyleSurface(afterWhitespace, frame.successor);
      const insertedCompactToken = /^([\p{Script=Arabic}\p{Script=Devanagari}]+)\s+(.+)$/u.exec(afterWhitespace);
      const hasInsertedIdentityBeforeSuccessor = !!insertedCompactToken
        && startsWithExactSummaryV3StyleSurface(insertedCompactToken[2]!, frame.successor);
      if (hasInsertedIdentityBeforeSuccessor) return false;
      if (hasOriginalSuccessor) {
        if (!isSummaryV3StyleIdentityFramePosition(precedingText)) return false;
        foundOriginalFrame = true;
      } else if (frame.permitsMarkedSuccessorReplacement && frame.successorAfter) {
        const replacement = /^([\p{Script=Arabic}\p{Script=Devanagari}]+)\s+(.+)$/u.exec(afterWhitespace);
        if (replacement
          && startsWithExactSummaryV3StyleSurface(replacement[2]!, frame.successorAfter)
          && isSummaryV3StyleIdentityFramePosition(precedingText)) foundOriginalFrame = true;
      }
    }
    start = index + needle.length;
  }
  return foundOriginalFrame;
}

/** Preserve each exact inline role-attested compact identity relation. */
function candidatePreservesInlineRoleAttestedUncasedIdentity(
  candidateText: string,
  frame: InlineRoleAttestedUncasedIdentityFrame,
): boolean {
  const haystack = normalizeSummaryV3StyleText(candidateText);
  const needle = normalizeSummaryV3StyleText(frame.surface);
  let start = 0;
  let foundOriginalFrame = false;
  while (start < haystack.length) {
    const index = haystack.indexOf(needle, start);
    if (index < 0) break;
    const followingText = haystack.slice(index + needle.length);
    if (isExactSurfaceBoundary(needle, haystack[index - 1], followingText)) {
      if (!startsWithExactSummaryV3StyleSurface(followingText.trimStart(), frame.roleFrame)) return false;
      foundOriginalFrame = true;
    }
    start = index + needle.length;
  }
  return foundOriginalFrame;
}

function sourceMaterialFactTexts(value: string): readonly string[] {
  return sourceUnitTexts(value)
    .flatMap((unit) => unit.split(/[,;:，、؛]/u))
    // An explicit coordinator followed by a title-cased subject and a
    // lowercase predicate is a bounded second relation, not an interchangeable
    // tail of the first person's fact. This deliberately leaves ordinary
    // same-subject conjunctions (`builds APIs and mentors peers`) intact.
    .flatMap((clause) => clause.split(/\s+(?=(?:and|but|while)\s+\p{Lu}[\p{L}\p{N}'’.-]*(?:\s+\p{Lu}[\p{L}\p{N}'’.-]*){0,2}\s+\p{Ll}[\p{L}\p{N}'’.-]*)/u))
    .map((clause) => normalizeSummaryV3StyleText(clause))
    .filter(Boolean);
}

const FACT_ANCHOR_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from', 'has', 'have',
  'he', 'her', 'him', 'in', 'is', 'it', 'of', 'on', 'or', 'over', 'she', 'that', 'the',
  'their', 'they', 'this', 'to', 'was', 'were', 'with', 'you', 'your',
]);
const PREDICATE_SUBJECT_TOKENS = new Set([
  'i', 'we', 'he', 'she', 'they', 'it', 'ich', 'wir', 'er', 'sie', 'ja', 'mi', 'on', 'ona', 'oni', 'मैं', 'हम', 'वह', 'वे', 'أنا', 'نحن', 'هو', 'هي', 'هم', '彼', '彼女',
]);
const NARROW_NAMED_TOOL_SOURCE_PATTERN = /\b(?:uses?|using|with)\s+(\p{Lu}[\p{L}\p{N}]*(?:\+\+|#)?)/gu;

function rawFactTokens(value: string): readonly string[] {
  return normalizeSummaryV3StyleNumericSurface(normalizeSummaryV3StyleText(value))
    .match(/[\p{Script=Latin}]+|[\p{Script=Cyrillic}]+|[\p{Script=Devanagari}]+|[\p{Script=Arabic}]+|[\p{Script=Han}]+|[\p{Script=Hiragana}]+|[\p{Script=Katakana}]+|\p{N}+/gu) || [];
}

/**
 * Ordered lexical surfaces for one bounded relation check. Unlike the public
 * anchor set, this retains repetition so a source-attested grammatical bridge
 * (for example a Hindi auxiliary) can be verified in place without granting
 * a free-form semantic insertion.
 */
export function summaryV3StyleOrderedFactTokens(value: string): readonly string[] {
  return rawFactTokens(value).map((token) => token.toLocaleLowerCase());
}

/**
 * A year inside an explicit source date range is a date endpoint, never a
 * structured CV metric.  Keep range detection compact and shared across
 * Latin/Cyrillic/Arabic/Devanagari connector forms; lexical date preservation
 * remains a separate source-floor check below.
 */
function summaryV3StyleCalendarRangeYears(value: string): ReadonlySet<string> {
  const normalized = normalizeSummaryV3StyleNumericSurface(normalizeSummaryV3StyleText(value));
  const years = new Set<string>();
  const pattern = /(?:\p{L}{2,}\s+)?((?:19|20)\d{2})\s*(?:to|until|through|bis|do|до|إلى|से|[-–—])\s*(?:\p{L}{2,}\s+)?((?:19|20)\d{2})/giu;
  for (const match of normalized.matchAll(pattern)) {
    years.add(match[1]!);
    years.add(match[2]!);
  }
  return years;
}

/**
 * Preserve exact technical, metric, and duration spans in addition to lexical
 * anchors. A bare number is insufficient authority for `20%`, `24 months`,
 * or `24か月`; likewise `C#` and `C++` are different tools despite sharing a
 * letter token. These spans are local source-floor evidence, never prose
 * diagnostics or locale-specific rewrite tables.
 */
function sourceSemanticSpans(value: string): readonly string[] {
  const normalized = normalizeSummaryV3StyleNumericSurface(normalizeSummaryV3StyleText(value)).toLocaleLowerCase();
  const calendarRangeYears = summaryV3StyleCalendarRangeYears(normalized);
  // A dotted/slashed calendar date can resemble a dotted technical token
  // (`01.05.2020`). Calendar preservation owns that entire lexical surface;
  // it must not also become a manifest-required technical span.
  const calendarDateSurfaces = new Set(summaryV3StyleCalendarDateRanges(normalized)
    .map(([start, end]) => normalized.slice(start, end).trim()));
  const isCalendarDateSurface = (span: string): boolean => calendarDateSurfaces.has(span.trim());
  // Do not absorb terminal sentence punctuation (`C#.` must remain `C#`).
  // Preserve `C#`, `C++`, dotted identifiers such as `Node.js`/`.NET`, and
  // exact currency notation as distinct local source-floor semantics.
  const technical = (normalized.match(/(?:[\p{L}\p{N}]+(?:\+\+|#)|[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)+|\.[\p{L}\p{N}]{2,})/gu) || [])
    .filter((span) => !isCalendarDateSurface(span));
  const metricsAndDurations = (normalized.match(/\p{N}+(?:[.,]\p{N}+)?\s*(?:%|٪)|\p{N}+(?:[.,]\p{N}+)?\s*[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Devanagari}]+/gu) || [])
    // A range endpoint can be followed by ordinary clause glue (`2022 i`),
    // not just the range connector. Treat either endpoint as a lexical date
    // surface rather than incorrectly demanding a manifest metric span.
    .filter((span) => {
      const year = /^(?:19|20)\d{2}(?!\p{N})/u.exec(span.trim())?.[0];
      return !year || !calendarRangeYears.has(year);
    });
  const japaneseDurations = (normalized.match(/\p{N}+(?:[.,]\p{N}+)?\s*(?:か月|ヶ月|カ月|箇月|年)/gu) || [])
    .filter((span) => !/^(?:19|20)\d{2}\s*年$/u.test(span.trim()));
  const currencies = normalized.match(/(?:\p{Sc}\s*\p{N}+(?:[.,]\p{N}+)?|\p{N}+(?:[.,]\p{N}+)?\s*\p{Sc})/gu) || [];
  return Array.from(new Set([...technical, ...metricsAndDurations, ...japaneseDurations, ...currencies].map((span) =>
    `span:${span.replace(/\s+/gu, ' ').replace(/\s*(?:%|٪)/gu, '%').replace(/(\p{Sc})\s+/gu, '$1').replace(/\s+(\p{Sc})/gu, '$1')}`)));
}

/**
 * Calendar expressions are source facts, not interchangeable number sets.
 * Keep each visible lexical month/year, full named day/month/year, or year
 * range intact without maintaining a locale month-name table. This catches
 * `Jan 2020 to Feb 2022` and `May 5, 2020` being changed while leaving
 * ordinary prose rendering evaluator-owned.
 */
export function summaryV3StyleCalendarDateRanges(value: string): readonly (readonly [number, number])[] {
  const normalized = normalizeSummaryV3StyleNumericSurface(normalizeSummaryV3StyleText(value));
  const ranges = [
    /\p{L}{2,}\s+\d{1,2}(?:st|nd|rd|th)?\s*[,،]?\s*(?:19|20)\d{2}/giu,
    /\d{1,2}(?:st|nd|rd|th|\.)?\s+\p{L}{2,}\s+(?:19|20)\d{2}/giu,
    /\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2}/gu,
    /(?:\p{L}{2,}\s+)?(?:19|20)\d{2}(?:\s*(?:to|until|through|bis|do|до|إلى|से|[-–—])\s*(?:\p{L}{2,}\s+)?(?:19|20)\d{2})?/giu,
    /(?:19|20)\d{2}[./-]\d{1,2}(?:[./-]\d{1,2})?/gu,
    /(?:19|20)\d{2}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?/gu,
    /(?:19|20)\d{2}\s*年(?:\s*(?:から|〜|～|[-–—])\s*(?:19|20)\d{2}\s*年)?/gu,
  ];
  const extracted = ranges.flatMap((pattern) => Array.from(normalized.matchAll(pattern), (match) =>
    match.index === undefined ? [] : [[match.index, match.index + match[0].length] as const]))
    .flat();
  return Array.from(new Map(extracted
    .filter(([start, end], index) => !extracted.some(([otherStart, otherEnd], otherIndex) => otherIndex !== index
      && otherStart <= start && otherEnd >= end && (otherStart !== start || otherEnd !== end)))
    .map((range) => [`${range[0]}:${range[1]}`, range] as const)).values());
}

function summaryV3StyleCalendarDateSurfaces(value: string): readonly string[] {
  const normalized = normalizeSummaryV3StyleNumericSurface(normalizeSummaryV3StyleText(value));
  return Array.from(new Set(summaryV3StyleCalendarDateRanges(normalized)
    .map(([start, end]) => normalized.slice(start, end).trim())
    .filter(Boolean)));
}

/** Preserve complete source-attested date surfaces before evaluator authority. */
export function summaryV3StyleCandidatePreservesCalendarDateSurfaces(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return true;
  const normalizedCandidate = normalizeSummaryV3StyleNumericSurface(normalizeSummaryV3StyleText(candidateText));
  const sourceSurfaces = summaryV3StyleCalendarDateSurfaces(snapshot.sourceSummary);
  const candidateSurfaces = summaryV3StyleCalendarDateSurfaces(normalizedCandidate);
  // Dates are an immutable source-floor and source-ceiling: retaining the
  // original range cannot authorize a second, conflicting range appended to
  // the candidate. Exact lexical preservation is intentionally stricter than
  // a loose set of shared year numbers.
  // Calendar extraction owns its script-aware lexical boundary. Comparing
  // maximal extracted surfaces preserves `2020年5月1日` next to Japanese
  // prose without treating its embedded `2020年` as an independent date.
  return sourceSurfaces.every((surface) => candidateSurfaces.includes(surface))
    && candidateSurfaces.every((surface) => sourceSurfaces.includes(surface));
}

const SUMMARY_V3_STYLE_MONTH_DURATION_SUFFIX = /^(?:month(?:s)?|monat(?:e|en)?|mesec\w*|мес\w*|महीन\w*|شهر\w*|か月|ヶ月|カ月|箇月)/iu;
const SUMMARY_V3_STYLE_YEAR_DURATION_SUFFIX = /^(?:year(?:s)?|jahr(?:e|en)?|god\w*|год\w*|वर्ष|سن(?:ة|تين|وات)?|年)/iu;

/**
 * Convert one locally extracted duration span to its structured month value.
 * The caller still decides whether that value is authorized by an immutable
 * Experience entry; this helper never grants an arbitrary duration authority.
 */
export function summaryV3StyleDurationMonthsFromSemanticSpan(span: string): number | null {
  const match = /^span:(\d+(?:[.,]\d+)?)(.*)$/u.exec(normalizeSummaryV3StyleNumericSurface(span));
  if (!match) return null;
  const value = Number(match[1]!.replace(',', '.'));
  const suffix = match[2]!.trim();
  if (!Number.isFinite(value) || value <= 0 || !suffix) return null;
  return SUMMARY_V3_STYLE_MONTH_DURATION_SUFFIX.test(suffix)
    ? value
    : SUMMARY_V3_STYLE_YEAR_DURATION_SUFFIX.test(suffix)
      ? value * 12
      : null;
}

function structuredDurationSemanticSpans(value: string): readonly string[] {
  return sourceSemanticSpans(value)
    .filter((span) => summaryV3StyleDurationMonthsFromSemanticSpan(span) !== null);
}

function escapeSummaryV3StyleLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * Remove only complete duration surfaces from a normalized source floor. This
 * is position-aware: a separate matching numeral (for example `2 awards`)
 * remains a required source anchor even when `2 years` is equivalent to
 * `24 months`.
 */
function withoutStructuredDurationSurfaces(value: string, spans: readonly string[]): string {
  let normalized = normalizeSummaryV3StyleNumericSurface(normalizeSummaryV3StyleText(value)).toLocaleLowerCase();
  for (const span of spans) {
    const surface = normalizeSummaryV3StyleNumericSurface(span.slice('span:'.length)).toLocaleLowerCase();
    if (!surface) continue;
    normalized = normalized.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeSummaryV3StyleLiteral(surface)}(?![\\p{L}\\p{N}])`, 'gu'),
      ' ',
    );
  }
  return normalized;
}

function candidateTextPreservesEquivalentStructuredDurationFact(
  snapshot: SummaryV3StyleOperationSnapshot,
  factText: string,
  candidateText: string,
): boolean {
  const authorizedMonths = new Set(snapshot.selectedEntries.map((entry) => entry.durationMonths));
  const sourceDurations = structuredDurationSemanticSpans(factText)
    .filter((span) => {
      const months = summaryV3StyleDurationMonthsFromSemanticSpan(span);
      return months !== null && authorizedMonths.has(months);
    });
  if (sourceDurations.length === 0) return false;
  const candidateMonths = new Set(structuredDurationSemanticSpans(candidateText)
    .map(summaryV3StyleDurationMonthsFromSemanticSpan)
    .filter((months): months is number => months !== null));
  if (!sourceDurations.every((span) => {
    const months = summaryV3StyleDurationMonthsFromSemanticSpan(span);
    return months !== null && candidateMonths.has(months);
  })) return false;
  const sourceAnchors = summaryV3StyleFactAnchorTokens(withoutStructuredDurationSurfaces(factText, sourceDurations));
  const candidateAnchors = new Set(summaryV3StyleFactAnchorTokens(
    withoutStructuredDurationSurfaces(candidateText, structuredDurationSemanticSpans(candidateText)),
  ));
  return sourceAnchors.every((anchor) => candidateAnchors.has(anchor));
}

/** Locale/script-aware lexical anchors used only as a local preservation floor. */
export function summaryV3StyleFactAnchorTokens(value: string): readonly string[] {
  const rawTokens = rawFactTokens(value);
  const firstToken = rawTokens[0]?.toLocaleLowerCase();
  return Array.from(new Set([...rawTokens
    .filter((token) => {
      const folded = token.toLocaleLowerCase();
      return /\p{N}/u.test(token)
        || (folded.length >= 3 && !FACT_ANCHOR_STOP_WORDS.has(folded))
        // Keep compact cased proper names (for example, "Li") as independent
        // source-floor anchors without turning sentence-initial pronouns into
        // entity locks that would block a grounded predicate transformation.
        || (/\p{Lu}/u.test(token)
          && !FACT_ANCHOR_STOP_WORDS.has(folded)
          && !PREDICATE_SUBJECT_TOKENS.has(folded))
        // Preserve compact uncased-script tokens anywhere in the source:
        // Japanese ミラ, Arabic لو, and Devanagari ली cannot rely on Latin
        // capitalization or a first-token heuristic for name protection.
        // Single-character particles remain outside this compact-name floor.
        || (/[\p{Script=Devanagari}\p{Script=Arabic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(token)
          && folded.length >= 2
          && !PREDICATE_SUBJECT_TOKENS.has(folded)
          && !(folded === firstToken && FACT_ANCHOR_STOP_WORDS.has(folded)));
    })
    .map((token) => token.toLocaleLowerCase()), ...sourceSemanticSpans(value)]));
}

function replaceableGroundedPredicateAnchor(value: string, anchors: readonly string[]): string | null {
  const rawTokens = rawFactTokens(value);
  const firstToken = rawTokens[0]?.toLocaleLowerCase();
  if (!firstToken || !PREDICATE_SUBJECT_TOKENS.has(firstToken)) return null;
  const anchorSet = new Set(anchors);
  for (const token of rawTokens.slice(1)) {
    const folded = token.toLocaleLowerCase();
    if (!/\p{N}/u.test(token) && anchorSet.has(folded)) return folded;
  }
  return null;
}

function markedTransformablePredicateAnchor(
  snapshot: SummaryV3StyleOperationSnapshot,
  fact: SummaryV3StyleFact,
): string | null {
  const duty = snapshot.transformableDuty;
  if (!duty || fact.transformableDuty?.hash !== duty.hash) return null;
  return summaryV3StyleFactAnchorTokens(duty.predicateAnchor)
    .find((anchor) => !anchor.startsWith('span:')) || null;
}

function candidateTextRepresentsFact(
  snapshot: SummaryV3StyleOperationSnapshot,
  fact: SummaryV3StyleFact,
  candidateText: string,
): boolean {
  const candidateTokens = new Set(summaryV3StyleFactAnchorTokens(candidateText));
  const sourceAnchorTokens = new Set(snapshot.requiredFacts.flatMap((fact) => summaryV3StyleFactAnchorTokens(fact.text)));
  if (summaryV3StyleContainsExactSurface(candidateText, fact.text)) return true;
  if (candidateTextPreservesEquivalentStructuredDurationFact(snapshot, fact.text, candidateText)) return true;
  const anchors = summaryV3StyleFactAnchorTokens(fact.text);
  if (anchors.length === 0) return false;
  const numericAnchors = anchors.filter((anchor) => /\p{N}/u.test(anchor));
  if (numericAnchors.some((anchor) => !candidateTokens.has(anchor))) return false;
  const missingAnchors = anchors.filter((anchor) => !candidateTokens.has(anchor));
  if (missingAnchors.length === 0) return true;
  // Stronger may replace only the first lexical predicate after an explicit
  // recognized subject/pronoun. Any other missing anchor (such as a name,
  // tool, employer, metric, or later duty token) fails closed. The injected
  // evaluator still owns semantic grounding of the replacement predicate.
  // Optional page annotations can be compact phrases (for example,
  // "builds reliable APIs") even though their exact source clause begins
  // with an explicit subject ("She builds reliable APIs").  Reuse only that
  // containing source clause as bounded predicate context; never treat the
  // annotation itself as a free-standing waivable lexical token.
  const sourceClause = sourceMaterialFactTexts(snapshot.sourceSummary)
    .find((clause) => summaryV3StyleContainsExactSurface(clause, fact.text));
  const markedPredicate = markedTransformablePredicateAnchor(snapshot, fact);
  const replaceablePredicate = markedPredicate ? null : replaceableGroundedPredicateAnchor(sourceClause || fact.text, anchors);
  const markedPredicateReplacement = !!markedPredicate
    && missingAnchors.length === 1
    && missingAnchors[0] === markedPredicate;
  const hasGroundedReplacement = snapshot.style === 'stronger'
    && snapshot.mode === 'enhance_existing_content'
    && (markedPredicateReplacement
      || (missingAnchors.length === 1 && missingAnchors[0] === replaceablePredicate))
    && Array.from(candidateTokens).some((token) => !sourceAnchorTokens.has(token));
  return hasGroundedReplacement;
}

/**
 * Bounded lexical fallback over a caller-supplied Stronger fact scope. The
 * whole-candidate caller requires at least two changed facts; the per-unit
 * caller may require one only after whole-candidate preservation has passed.
 * Numeric/material/entity guards remain independently enforced by the parser.
 */
function candidateRepresentsBoundedStrongerParaphrase(
  snapshot: SummaryV3StyleOperationSnapshot,
  facts: readonly SummaryV3StyleFact[],
  candidateText: string,
  minimumChangedFactCount: number,
): boolean {
  if (snapshot.style !== 'stronger' || snapshot.mode !== 'enhance_existing_content'
    || snapshot.transformableDuty || facts.length === 0) return false;
  const candidateTokens = new Set(summaryV3StyleFactAnchorTokens(candidateText));
  const sourceTokens = new Set(snapshot.requiredFacts.flatMap((fact) => summaryV3StyleFactAnchorTokens(fact.text)));
  let changedFactCount = 0;
  for (const fact of facts) {
    if (candidateTextRepresentsFact(snapshot, fact, candidateText)) continue;
    const anchors = summaryV3StyleFactAnchorTokens(fact.text);
    if (anchors.length === 0) return false;
    const numericAnchors = anchors.filter((anchor) => /\p{N}/u.test(anchor));
    if (numericAnchors.some((anchor) => !candidateTokens.has(anchor))) return false;
    const overlap = anchors.filter((anchor) => candidateTokens.has(anchor)).length;
    const requiredOverlap = Math.min(3, Math.max(1, anchors.length - 1));
    if (overlap < requiredOverlap) return false;
    changedFactCount += 1;
  }
  return changedFactCount >= minimumChangedFactCount
    && Array.from(candidateTokens).some((token) => !sourceTokens.has(token));
}

function candidateRepresentsUnmarkedMultiFactStrongerParaphrase(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  if (snapshot.requiredFacts.length < 3) return false;
  return candidateRepresentsBoundedStrongerParaphrase(snapshot, snapshot.requiredFacts, candidateText, 2);
}

function relationOccurrences(value: string, relationValue: string): readonly number[] {
  const normalized = normalizedRelationText(value);
  const needle = normalizedRelationText(relationValue);
  if (!needle) return [];
  const occurrences: number[] = [];
  let start = 0;
  while (start < normalized.length) {
    const index = normalized.indexOf(needle, start);
    if (index < 0) break;
    const before = normalized[index - 1];
    if (isExactSurfaceBoundary(needle, before, normalized.slice(index + needle.length))) occurrences.push(index);
    start = index + needle.length;
  }
  return occurrences;
}

function candidateRelationSegments(
  candidateText: string,
  entityValue: string,
  allEntityValues: readonly string[],
): readonly string[] {
  const otherEntities = allEntityValues.filter((value) => normalizedRelationText(value) !== normalizedRelationText(entityValue));
  return sourceUnitTexts(candidateText).flatMap((unit) => relationOccurrences(unit, entityValue).map((entityStart) => {
    const otherOccurrences = otherEntities.flatMap((other) => relationOccurrences(unit, other)
      .map((start) => ({ start, end: start + other.length })));
    const previous = otherOccurrences.filter((other) => other.end <= entityStart)
      .reduce((latest, other) => Math.max(latest, other.end), 0);
    const following = otherOccurrences.filter((other) => other.start > entityStart)
      .reduce((earliest, other) => Math.min(earliest, other.start), unit.length);
    return unit.slice(previous, following);
  }));
}

/**
 * Every explicitly protected entity/source-unit binding must survive in one
 * candidate relation segment. This is intentionally narrower than natural
 * language inference: it rejects cross-person reattribution without guessing
 * pronoun resolution or introducing locale-specific grammar tables.
 */
export function summaryV3StyleCandidatePreservesEntityFactBindings(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  if (snapshot.mode === 'generate_from_context' || snapshot.entityRelationBindings.length === 0) return true;
  const entities = snapshot.entityLocks.filter((lock) => lock.kind === 'entity');
  const entityValues = entities.map((entity) => entity.value);
  const factsByHash = new Map(snapshot.requiredFacts.map((fact) => [fact.hash, fact] as const));
  return snapshot.entityRelationBindings.every((binding) => {
    const entity = entities.find((item) => item.hash === binding.entityHash);
    if (!entity) return false;
    const segments = candidateRelationSegments(candidateText, entity.value, entityValues);
    return segments.some((segment) => binding.sourceFactHashes.every((factHash) => {
      const fact = factsByHash.get(factHash);
      return !!fact && candidateTextRepresentsFact(snapshot, fact, segment);
    }));
  });
}

/**
 * Writer fact labels are transport metadata, never preservation proof.  This
 * conservative lexical floor independently catches material source omissions;
 * the injected evaluator receives the raw authority for semantic validation.
 */
export function summaryV3StyleCandidateRepresentsRequiredFacts(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  // Context generation may legitimately synthesize/paraphrase the immutable
  // manifest in any supported locale. Its writer IDs bind each unit to the
  // manifest and the evaluator's semantic-grounding partition is the one
  // multilingual representation authority. The literal preservation floor is
  // intentionally limited to visible-summary transformation mode.
  if (snapshot.mode === 'generate_from_context') return true;
  return snapshot.requiredFacts.every((fact) => candidateTextRepresentsFact(snapshot, fact, candidateText))
    || candidateRepresentsUnmarkedMultiFactStrongerParaphrase(snapshot, candidateText);
}

/**
 * Writer labels are transport metadata, but each declared fact must also be
 * represented by the individual unit that claims it. This prevents a writer
 * from making global coverage look complete by cross-labelling two units.
 */
export function summaryV3StyleCandidateUnitsRepresentDeclaredFacts(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidate: SummaryV3StyleCandidate,
): boolean {
  if (snapshot.mode === 'generate_from_context') return true;
  const factsById = new Map(snapshot.requiredFacts.map((fact) => [fact.id, fact] as const));
  if (!summaryV3StyleCandidateRepresentsRequiredFacts(snapshot, candidate.text)) return false;
  return candidate.units.every((unit) => {
    const declaredFacts = unit.factIds.map((factId) => factsById.get(factId));
    if (declaredFacts.some((fact) => !fact)) return false;
    const boundedFacts = declaredFacts as readonly SummaryV3StyleFact[];
    return boundedFacts.every((fact) => candidateTextRepresentsFact(snapshot, fact, unit.text))
      || candidateRepresentsBoundedStrongerParaphrase(snapshot, boundedFacts, unit.text, 1);
  });
}

function sourceUnits(value: string): readonly SummaryV3StyleSourceUnit[] {
  return sourceUnitTexts(value).map((unit) => ({
    // Content-derived identity deliberately avoids positional/array-index identity.
    id: hashSummaryV3StyleValue(`source-unit:${unit}`),
    hash: hashSummaryV3StyleValue(unit),
  }));
}

function normalizedRelationText(value: string): string {
  return normalizeSummaryV3StyleText(value).toLocaleLowerCase();
}

/**
 * Build only unambiguous subject bindings. A source material clause may be
 * finer than a sentence, which keeps two explicit subjects separated by a
 * comma from being treated as one interchangeable fact bucket. Inference from
 * pronouns or locale grammar would turn this M5.1 foundation into an unsafe
 * locale parser; those cases remain evaluator semantic authority.
 */
function entityRelationBindings(
  source: string,
  locks: readonly SummaryV3StyleEntityLock[],
  facts: readonly SummaryV3StyleFact[],
): readonly SummaryV3StyleEntityRelationBinding[] {
  const entityLocks = Array.from(new Map(locks
    .filter((lock) => lock.kind === 'entity')
    .map((lock) => [normalizedRelationText(lock.value), lock] as const))
    .values());
  if (entityLocks.length === 0 || !source) return immutableCopy([]) as readonly SummaryV3StyleEntityRelationBinding[];
  const bindings: SummaryV3StyleEntityRelationBinding[] = [];
  for (const unit of sourceMaterialFactTexts(source)) {
    const matchedEntities = entityLocks.filter((entity) => summaryV3StyleContainsExactSurface(unit, entity.value));
    // A trusted compact entity can overlap an automatic full-name entity
    // (`Ava` and `Ava Patel`). Bind the maximal exact identity rather than
    // dropping the clause as "two people"; the compact lock remains a
    // separate literal-preservation floor.
    const maximalMatchedEntities = matchedEntities.filter((entity) => !matchedEntities.some((other) =>
      other !== entity
      && summaryV3StyleContainsLongerIdentityTokenSequence(other.value, entity.value)));
    // Even after clause splitting, a clause with two explicit people is not a
    // safe place to infer attribution; the evaluator remains responsible.
    if (maximalMatchedEntities.length !== 1) continue;
    const entity = maximalMatchedEntities[0]!;
    const entityAnchors = new Set(summaryV3StyleFactAnchorTokens(entity.value));
    const sourceFactHashes = facts
      .filter((fact) => fact.origin === 'visible_summary'
        && summaryV3StyleContainsExactSurface(unit, fact.text))
      .filter((fact) => summaryV3StyleFactAnchorTokens(fact.text)
        .some((anchor) => !entityAnchors.has(anchor)))
      .map((fact) => fact.hash);
    if (sourceFactHashes.length === 0) continue;
    const sourceUnitHash = hashSummaryV3StyleValue(unit);
    bindings.push({
      entityHash: entity.hash,
      sourceUnitHash,
      sourceFactHashes,
      hash: hashSummaryV3StyleValue(`entity-relation:${entity.hash}:${sourceUnitHash}:${sourceFactHashes.join('|')}`),
    });
  }
  return immutableCopy(bindings) as readonly SummaryV3StyleEntityRelationBinding[];
}

const AUTO_RELATION_STATE_WORDS = new Set(['current', 'former', 'previous', 'past', 'present']);

/**
 * Optional page annotations remain unnecessary for the straightforward,
 * multi-person Latin-script case. We add only distinct clause-leading
 * title-case subjects, and only when there are at least two: that is enough
 * to prevent an attribution swap without pretending to resolve pronouns or
 * run NER. Clause granularity deliberately matches entityRelationBindings.
 * Ambiguous single-character/non-cased-script names still require the trusted
 * `protectedEntities` boundary supplied by the future page owner.
 */
function automaticRelationEntityLocks(
  source: string,
  locks: readonly SummaryV3StyleEntityLock[],
): readonly SummaryV3StyleEntityLock[] {
  const existing = new Set(locks.map((lock) => normalizedRelationText(lock.value)));
  const candidates = Array.from(new Set(sourceMaterialFactTexts(source)
    .map((clause) => /^(?:(?:and|but|while)\s+)?(\p{Lu}[\p{L}\p{N}]*(?:\s+\p{Lu}[\p{L}\p{N}]*){0,2})(?=\s+\p{Ll})/u.exec(clause)?.[1])
    .filter((value): value is string => !!value)
    .filter((value) => !PREDICATE_SUBJECT_TOKENS.has(value.toLocaleLowerCase())
      // A leading state marker means this title-cased run is a role/state
      // phrase, not an automatically inferred person identity.
      && !AUTO_RELATION_STATE_WORDS.has(rawFactTokens(value)[0]?.toLocaleLowerCase() || '')
      && !existing.has(normalizedRelationText(value)))));
  if (candidates.length < 2) return locks;
  const additions = candidates
    .map((value) => ({ kind: 'entity' as const, value, hash: hashSummaryV3StyleValue(`entity:auto:${value}`) }));
  return immutableCopy([...locks, ...additions]) as readonly SummaryV3StyleEntityLock[];
}

function assertStringId(value: unknown, field: string): asserts value is string {
  if (!isNonBlank(value) || !/^[A-Za-z0-9_.:-]{1,160}$/u.test(value)) throw new SummaryV3StyleInputError('malformed_request', field);
}

function assertText(value: unknown, field: string): asserts value is string {
  if (!isNonBlank(value) || value.length > 12_000) throw new SummaryV3StyleInputError('malformed_request', field);
}

function isVisibleFactKind(value: unknown): value is SummaryV3StyleVisibleFactKind {
  return typeof value === 'string' && (SUMMARY_V3_STYLE_M5_VISIBLE_FACT_KINDS as readonly string[]).includes(value);
}

function parseTransformableDuty(
  input: SummaryV3StyleFactInput,
  origin: SummaryV3StyleFact['origin'],
): SummaryV3StyleFact['transformableDuty'] {
  if (input.transformableDuty === undefined) return null;
  if (origin !== 'visible_summary' || input.semanticKind !== 'duty'
    || !isRecord(input.transformableDuty)
    || !hasExactKeys(input.transformableDuty, ['predicateAnchor', 'sourcePredicate'])) {
    throw new SummaryV3StyleInputError('malformed_request', 'transformableDuty requires one visible duty fact');
  }
  const sourcePredicate = input.transformableDuty.sourcePredicate;
  const predicateAnchor = input.transformableDuty.predicateAnchor;
  assertText(sourcePredicate, 'transformableDuty.sourcePredicate');
  assertText(predicateAnchor, 'transformableDuty.predicateAnchor');
  const normalizedFact = normalizeSummaryV3StyleText(input.text).toLocaleLowerCase();
  const normalizedPredicate = normalizeSummaryV3StyleText(sourcePredicate).toLocaleLowerCase();
  const predicateAnchors = summaryV3StyleFactAnchorTokens(predicateAnchor)
    .filter((anchor) => !anchor.startsWith('span:'));
  if (!normalizedFact.includes(normalizedPredicate)
    || !normalizedPredicate.includes(normalizeSummaryV3StyleText(predicateAnchor).toLocaleLowerCase())
    || predicateAnchors.length !== 1
    || predicateAnchors.some((anchor) => /\p{N}/u.test(anchor))) {
    throw new SummaryV3StyleInputError('malformed_request', 'transformableDuty requires one nonnumeric predicate anchor inside its exact source span');
  }
  return immutableCopy({
    sourceFactId: input.id,
    sourcePredicate,
    predicateAnchor,
    hash: hashSummaryV3StyleValue(`transformable-duty:${input.id}:${sourcePredicate}:${predicateAnchor}`),
  });
}

function asFact(
  input: SummaryV3StyleFactInput,
  origin: SummaryV3StyleFact['origin'],
  inheritedTransformableDuty: SummaryV3StyleFact['transformableDuty'] = null,
): SummaryV3StyleFact {
  assertStringId(input?.id, 'fact.id');
  assertText(input?.text, 'fact.text');
  const semanticKind = input.semanticKind === undefined ? 'other' : input.semanticKind;
  if (!isVisibleFactKind(semanticKind)) throw new SummaryV3StyleInputError('malformed_request', 'fact.semanticKind');
  if (origin !== 'visible_summary' && (input.semanticKind !== undefined || input.transformableDuty !== undefined)) {
    throw new SummaryV3StyleInputError('malformed_request', 'manifest facts cannot carry visible-summary semantics');
  }
  const transformableDuty = inheritedTransformableDuty || parseTransformableDuty(input, origin);
  return immutableCopy({
    id: input.id,
    hash: hashSummaryV3StyleValue(`${input.id}:${input.text}:${semanticKind}:${transformableDuty?.hash || ''}`),
    text: input.text,
    origin,
    semanticKind,
    transformableDuty,
  }) as SummaryV3StyleFact;
}

function operationMatchesStyle(operation: string, style: SummaryV3Style): boolean {
  return operation === 'summary_style' || operation === M5_OPERATION_FOR_STYLE[style];
}

export function decideSummaryV3StyleOwnership(request: Pick<SummaryV3StyleRequest, 'enabled' | 'operation' | 'style' | 'requestedLocale' | 'sourceLocale'>): SummaryV3StyleOwnership {
  if (request.enabled === false) return immutableCopy({ kind: 'not_applicable', reason: 'feature_not_enabled' });
  if (typeof request.operation === 'string' && request.operation in NOT_APPLICABLE_OPERATIONS) {
    return immutableCopy({ kind: 'not_applicable', reason: NOT_APPLICABLE_OPERATIONS[request.operation] });
  }
  if (!isSummaryV3Style(request.style)) return immutableCopy({ kind: 'not_applicable', reason: 'unsupported_style' });
  if (!operationMatchesStyle(request.operation, request.style)) {
    return immutableCopy({ kind: 'not_applicable', reason: 'operation_not_m5_style' });
  }
  const requestedLocale = canonicalSummaryV3StyleLocale(request.requestedLocale);
  const sourceLocale = canonicalSummaryV3StyleLocale(request.sourceLocale);
  if (!requestedLocale || !sourceLocale) return immutableCopy({ kind: 'not_applicable', reason: 'unsupported_locale' });
  if (requestedLocale !== sourceLocale) return immutableCopy({ kind: 'not_applicable', reason: 'cross_locale' });
  return immutableCopy({ kind: 'owned', style: request.style, requestedLocale });
}

export class SummaryV3StyleInputError extends Error {
  readonly reason: Extract<SummaryV3StyleFailureReason, 'malformed_request' | 'insufficient_context' | 'ambiguous_current_role' | 'source_fact_not_visible'>;
  constructor(reason: SummaryV3StyleInputError['reason'], message: string) {
    super(message);
    this.name = 'SummaryV3StyleInputError';
    this.reason = reason;
  }
}

function validateManifest(input: SummaryV3StyleManifestInput): {
  entries: readonly SummaryV3StyleExperienceInput[];
  currentRole: SummaryV3StyleExperienceInput | null;
  totalDurationMonths: number;
} {
  if (!isRecord(input)) throw new SummaryV3StyleInputError('malformed_request', 'manifest must be an object');
  assertStringId(input.manifestId, 'manifestId');
  assertStringId(input.contextId, 'contextId');
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new SummaryV3StyleInputError('insufficient_context', 'manifest entries are required');
  }
  if (input.entries.length > SUMMARY_V3_STYLE_MAX_MANIFEST_ENTRIES) {
    throw new SummaryV3StyleInputError('malformed_request', 'manifest entries exceed the M5.1 bound');
  }
  const ids = new Set<string>();
  let totalDurationMonths = 0;
  let totalFacts = 0;
  for (const entry of input.entries) {
    assertStringId(entry?.stableId, 'entry.stableId');
    assertText(entry?.role, 'entry.role');
    assertText(entry?.employer, 'entry.employer');
    if (entry.roleSourceLocale !== undefined
      && (typeof entry.roleSourceLocale !== 'string' || entry.roleSourceLocale.length > 32)) {
      throw new SummaryV3StyleInputError('malformed_request', 'entry.roleSourceLocale');
    }
    if (entry.rolePresentation !== undefined) {
      const presentation = entry.rolePresentation;
      if (!isRecord(presentation)
        || typeof presentation.text !== 'string'
        || !summaryV3StyleIsNonBlank(presentation.text)
        || presentation.text.length > 500
        || typeof presentation.sourceLocale !== 'string'
        || typeof presentation.targetLocale !== 'string'
        || typeof presentation.sourceRoleHash !== 'string'
        || !/^m5_[a-z0-9]{1,32}$/u.test(presentation.sourceRoleHash)
        || (presentation.provenance !== 'validated_localized_projection'
          && presentation.provenance !== 'validated_export_title_surface')) {
        throw new SummaryV3StyleInputError('malformed_request', 'entry.rolePresentation');
      }
    }
    if (entry.employmentState !== 'present' && entry.employmentState !== 'completed') {
      throw new SummaryV3StyleInputError('malformed_request', 'entry.employmentState');
    }
    if (!Number.isInteger(entry.durationMonths) || entry.durationMonths < 0) {
      throw new SummaryV3StyleInputError('malformed_request', 'entry.durationMonths');
    }
    if (ids.has(entry.stableId)) throw new SummaryV3StyleInputError('malformed_request', 'duplicate entry.stableId');
    ids.add(entry.stableId);
    totalDurationMonths += entry.durationMonths;
    if (!Array.isArray(entry.facts) || entry.facts.length > SUMMARY_V3_STYLE_MAX_ENTRY_FACTS) {
      throw new SummaryV3StyleInputError('malformed_request', 'entry.facts');
    }
    totalFacts += 4 + entry.facts.length;
    if (totalFacts > SUMMARY_V3_STYLE_MAX_TOTAL_FACTS) {
      throw new SummaryV3StyleInputError('malformed_request', 'manifest facts exceed the M5.1 bound');
    }
    const factIds = new Set<string>();
    for (const fact of entry.facts) {
      assertStringId(fact?.id, 'fact.id');
      assertText(fact?.text, 'fact.text');
      if (factIds.has(fact.id)) throw new SummaryV3StyleInputError('malformed_request', 'duplicate fact.id');
      factIds.add(fact.id);
    }
  }
  const currentRole = input.currentRoleEntryId === null
    ? null
    : input.entries.find((entry) => entry.stableId === input.currentRoleEntryId) ?? null;
  if (input.currentRoleEntryId !== null && !currentRole) {
    throw new SummaryV3StyleInputError('ambiguous_current_role', 'current role is not selected');
  }
  if (currentRole && currentRole.employmentState !== 'present') {
    throw new SummaryV3StyleInputError('ambiguous_current_role', 'current role must be present employment');
  }
  return { entries: input.entries, currentRole, totalDurationMonths };
}

function entityLocks(
  entries: readonly SummaryV3StyleExperienceInput[],
  visibleSummary: string,
  protectedEntities: readonly string[] | undefined,
): readonly SummaryV3StyleEntityLock[] {
  const candidateLocks = entries.flatMap((entry) => [
    ['role', entry.role], ['employer', entry.employer], ['duration', String(entry.durationMonths)],
  ] as const).map(([kind, value]) => ({ kind, value }));
  const visibleCandidateLocks = !visibleSummary ? candidateLocks : candidateLocks.filter((lock) =>
    summaryV3StyleIdentityClauses(visibleSummary).some((clause) =>
      summaryV3StyleContainsExactSurface(clause, lock.value)
      && !candidateLocks.some((other) => other !== lock
        && other.kind === lock.kind
        && summaryV3StyleContainsLongerIdentityTokenSequence(other.value, lock.value)
        && summaryV3StyleContainsExactSurface(clause, other.value))));
  const locks: SummaryV3StyleEntityLock[] = visibleCandidateLocks
    .map((lock) => ({ kind: lock.kind, value: lock.value, hash: hashSummaryV3StyleValue(`${lock.kind}:${lock.value}`) }));
  if (protectedEntities !== undefined) {
    if (!Array.isArray(protectedEntities) || protectedEntities.length > SUMMARY_V3_STYLE_MAX_PROTECTED_ENTITIES) {
      throw new SummaryV3StyleInputError('malformed_request', 'protectedEntities');
    }
    for (const entity of protectedEntities) {
      assertText(entity, 'protectedEntity');
      if (visibleSummary && !summaryV3StyleContainsExactSurface(visibleSummary, entity, true)) {
        throw new SummaryV3StyleInputError('source_fact_not_visible', 'protected entity is not visible in source');
      }
      locks.push({ kind: 'entity', value: entity, hash: hashSummaryV3StyleValue(`entity:${entity}`) });
    }
  }
  return immutableCopy(locks) as readonly SummaryV3StyleEntityLock[];
}

/**
 * A longer same-kind identity subsumes a shorter identity only through a
 * complete contiguous lexical-token sequence. This covers `Acme-Labs` /
 * `Acme` and `Senior Engineer` / `Engineer`, while never conflating
 * `Engineering` with `Engineer`.
 */
export function summaryV3StyleContainsLongerIdentityTokenSequence(value: string, prefix: string): boolean {
  const valueTokens = normalizeSummaryV3StyleText(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const prefixTokens = normalizeSummaryV3StyleText(prefix).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return valueTokens.length > prefixTokens.length
    && prefixTokens.length > 0
    && valueTokens.some((_token, start) => start + prefixTokens.length <= valueTokens.length
      && prefixTokens.every((token, offset) => valueTokens[start + offset] === token));
}

function summaryV3StyleIdentityClauses(value: string): readonly string[] {
  return normalizeSummaryV3StyleText(value)
    .split(/(?<=[!?。！？।])\s*|(?<=\.)\s+(?=\S)|[,;:，、؛]/u)
    .filter(Boolean);
}

function tokenSequenceStartsWith(tokens: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length > 0 && prefix.length <= tokens.length
    && prefix.every((token, index) => token.toLocaleLowerCase() === tokens[index]!.toLocaleLowerCase());
}

/**
 * A marked duty is an explicit future-page semantic boundary, not an inferred
 * language heuristic. Its exact predicate is the sole source anchor a
 * Stronger rewrite may replace; all sibling automatic facts inherit that same
 * immutable marker so the whole source clause cannot accidentally block it.
 */
function validateTransformableDuty(
  facts: readonly SummaryV3StyleFact[],
  source: string,
  style: SummaryV3Style,
  mode: SummaryV3StyleMode,
  locks: readonly SummaryV3StyleEntityLock[],
): SummaryV3StyleFact['transformableDuty'] {
  const duties = Array.from(new Map(facts
    .flatMap((fact) => fact.transformableDuty ? [[fact.transformableDuty.hash, fact.transformableDuty] as const] : []))
    .values());
  if (duties.length === 0) return null;
  if (duties.length !== 1 || style !== 'stronger' || mode !== 'enhance_existing_content') {
    throw new SummaryV3StyleInputError('malformed_request', 'transformableDuty is limited to one non-empty Stronger operation');
  }
  const duty = duties[0]!;
  const explicitFact = facts.find((fact) => fact.id === duty.sourceFactId && fact.semanticKind === 'duty'
    && fact.transformableDuty?.hash === duty.hash);
  if (!explicitFact) throw new SummaryV3StyleInputError('malformed_request', 'transformableDuty source fact is not an explicit visible duty');
  const sourceClause = sourceMaterialFactTexts(source)
    .find((clause) => summaryV3StyleContainsExactSurface(clause, explicitFact.text));
  if (!sourceClause) throw new SummaryV3StyleInputError('source_fact_not_visible', 'transformableDuty source fact is not visible');
  const clauseTokens = rawFactTokens(sourceClause);
  const entitySubject = locks.filter((lock) => lock.kind === 'entity').find((lock) =>
    tokenSequenceStartsWith(clauseTokens, rawFactTokens(lock.value)));
  if (!entitySubject) {
    throw new SummaryV3StyleInputError('malformed_request', 'transformableDuty requires an explicit entity lock at the start of its source clause');
  }
  const subjectTokenCount = rawFactTokens(entitySubject.value).length;
  const predicateTokens = rawFactTokens(duty.predicateAnchor);
  const sourcePredicateTokens = rawFactTokens(duty.sourcePredicate);
  const predicateIndex = clauseTokens.findIndex((token, index) => index >= subjectTokenCount
    && token.toLocaleLowerCase() === predicateTokens[0]!.toLocaleLowerCase());
  const normalizedPredicate = normalizeSummaryV3StyleText(duty.sourcePredicate).toLocaleLowerCase();
  const protectedSemanticKinds = new Set<SummaryV3StyleVisibleFactKind>([
    'entity', 'tool', 'metric', 'role', 'employer', 'duration',
  ]);
  const targetsProtectedSourceFact = facts.some((fact) => fact.id !== duty.sourceFactId
    && protectedSemanticKinds.has(fact.semanticKind)
    && summaryV3StyleContainsExactSurface(fact.text, normalizedPredicate));
  const normalizedAnchor = normalizeSummaryV3StyleText(duty.predicateAnchor).toLocaleLowerCase();
  const anchorUsesJapaneseScript = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(normalizedAnchor);
  const sourcePredicateStartsWithAnchor = sourcePredicateTokens.length > 0 && predicateTokens.length > 0
    && normalizedPredicate.startsWith(normalizedAnchor)
    // Japanese predicates commonly carry inflection directly after the Han
    // stem (`構築しました`). Other scripts retain an exact lexical boundary so
    // `Go` cannot be smuggled through `Google`, or a trailing tool through
    // `uses Python`.
    && (anchorUsesJapaneseScript || isExactSurfaceBoundary(
      normalizedAnchor,
      undefined,
      normalizedPredicate.slice(normalizedAnchor.length),
    ));
  const sourcePredicateIsVisible = summaryV3StyleContainsExactSurface(sourceClause, duty.sourcePredicate);
  const anchorOverlapsNarrowNamedTool = Array.from(sourceClause.matchAll(NARROW_NAMED_TOOL_SOURCE_PATTERN))
    .some((match) => summaryV3StyleContainsExactSurface(duty.predicateAnchor, match[1]!)
      || summaryV3StyleContainsExactSurface(match[1]!, duty.predicateAnchor));
  const anchorIsTechnicalSpan = sourceSemanticSpans(duty.predicateAnchor).length > 0;
  if (predicateTokens.length === 0 || predicateIndex < subjectTokenCount
    || !sourcePredicateStartsWithAnchor || !sourcePredicateIsVisible
    || anchorOverlapsNarrowNamedTool || anchorIsTechnicalSpan
    || locks.some((lock) => normalizeSummaryV3StyleText(lock.value).toLocaleLowerCase()
      === normalizedPredicate)
    || targetsProtectedSourceFact) {
    throw new SummaryV3StyleInputError('malformed_request', 'transformableDuty predicate is not a permitted grounded duty token');
  }
  return duty;
}

function contextFacts(entries: readonly SummaryV3StyleExperienceInput[]): readonly SummaryV3StyleFact[] {
  const facts: SummaryV3StyleFact[] = [];
  for (const entry of entries) {
    facts.push(asFact({ id: `${entry.stableId}:role`, text: entry.role }, 'context_manifest'));
    facts.push(asFact({ id: `${entry.stableId}:employer`, text: entry.employer }, 'context_manifest'));
    facts.push(asFact({ id: `${entry.stableId}:employment_state`, text: entry.employmentState }, 'context_manifest'));
    facts.push(asFact({ id: `${entry.stableId}:duration`, text: String(entry.durationMonths) }, 'context_manifest'));
    for (const fact of entry.facts) facts.push(asFact(fact, 'context_manifest'));
  }
  const ids = new Set<string>();
  for (const fact of facts) {
    if (ids.has(fact.id)) throw new SummaryV3StyleInputError('malformed_request', 'duplicate required fact id');
    ids.add(fact.id);
  }
  return immutableCopy(facts) as readonly SummaryV3StyleFact[];
}

function visibleFacts(input: readonly SummaryV3StyleFactInput[] | undefined, source: string): readonly SummaryV3StyleFact[] {
  if (input !== undefined && (!Array.isArray(input) || input.length > SUMMARY_V3_STYLE_MAX_TOTAL_FACTS)) {
    throw new SummaryV3StyleInputError('malformed_request', 'visibleSummaryFacts');
  }
  const explicitFacts = (input || []).map((rawFact) => asFact(rawFact, 'visible_summary'));
  const explicitDutyFacts = explicitFacts.filter((fact) => fact.transformableDuty !== null);
  if (explicitDutyFacts.length > 1) {
    throw new SummaryV3StyleInputError('malformed_request', 'at most one transformableDuty is allowed');
  }
  const explicitDutyFact = explicitDutyFacts[0] || null;
  if (explicitDutyFact) {
    const matchingClauses = sourceMaterialFactTexts(source)
      .filter((clause) => summaryV3StyleContainsExactSurface(clause, explicitDutyFact.text));
    if (matchingClauses.length !== 1) {
      throw new SummaryV3StyleInputError('malformed_request', 'transformableDuty must identify one exact visible source clause');
    }
  }
  const facts: SummaryV3StyleFact[] = [];
  const ids = new Set<string>();
  for (const factText of sourceMaterialFactTexts(source)) {
    const inheritedDuty = explicitDutyFact
      && summaryV3StyleContainsExactSurface(factText, explicitDutyFact.text)
      ? explicitDutyFact.transformableDuty
      : null;
    const sourceFact = asFact({ id: `visible:${hashSummaryV3StyleValue(factText)}`, text: factText }, 'visible_summary', inheritedDuty);
    if (!ids.has(sourceFact.id)) {
      ids.add(sourceFact.id);
      facts.push(sourceFact);
    }
  }
  for (const fact of explicitFacts) {
    if (ids.has(fact.id)) throw new SummaryV3StyleInputError('malformed_request', 'duplicate visible fact id');
    ids.add(fact.id);
    if (!summaryV3StyleContainsExactSurface(source, fact.text)) {
      throw new SummaryV3StyleInputError('source_fact_not_visible', 'a visible source fact is not in the exact visible summary');
    }
    facts.push(fact);
  }
  if (facts.length > SUMMARY_V3_STYLE_MAX_TOTAL_FACTS) {
    throw new SummaryV3StyleInputError('malformed_request', 'visible summary facts exceed the M5.1 bound');
  }
  for (const fact of facts) {
    if (!summaryV3StyleContainsExactSurface(source, fact.text)) {
      throw new SummaryV3StyleInputError('source_fact_not_visible', 'a source-floor fact is not in the exact visible summary');
    }
  }
  return immutableCopy(facts) as readonly SummaryV3StyleFact[];
}

export function createSummaryV3StyleOperationSnapshot(request: SummaryV3StyleRequest): SummaryV3StyleOperationSnapshot {
  const ownership = decideSummaryV3StyleOwnership(request);
  if (ownership.kind !== 'owned') throw new SummaryV3StyleInputError('malformed_request', 'operation is not M5-owned');
  if (typeof request.enabled !== 'boolean') throw new SummaryV3StyleInputError('malformed_request', 'enabled must be boolean');
  assertStringId(request.operationId, 'operationId');
  const manifestState = validateManifest(request.manifest);
  if (canonicalSummaryV3StyleLocale(request.manifest.sourceLocale) !== ownership.requestedLocale) {
    throw new SummaryV3StyleInputError('malformed_request', 'manifest source locale does not match requested locale');
  }
  const visibleSummary = request.visibleSummary;
  if (typeof visibleSummary !== 'string') throw new SummaryV3StyleInputError('malformed_request', 'visibleSummary must be explicitly supplied as a string');
  if (visibleSummary.length > 12_000) throw new SummaryV3StyleInputError('malformed_request', 'visibleSummary too large');
  if (visibleSummary !== '' && !normalizeSummaryV3StyleText(visibleSummary)) {
    throw new SummaryV3StyleInputError('malformed_request', 'visibleSummary must be exactly empty or contain visible source text');
  }
  const sourceSummary = visibleSummary;
  const mode: SummaryV3StyleMode = sourceSummary === '' ? 'generate_from_context' : 'enhance_existing_content';
  const authoritativeLocaleSurface = sourceSummary || manifestState.entries
    .flatMap((entry) => [entry.role, entry.employer, ...entry.facts.map((fact) => fact.text)])
    .join(' ');
  if (!summaryV3StyleLocaleContentMatches(authoritativeLocaleSurface, ownership.requestedLocale)) {
    throw new SummaryV3StyleInputError('malformed_request', 'authoritative content does not match the claimed source locale');
  }
  if (mode === 'generate_from_context' && !manifestState.currentRole) {
    throw new SummaryV3StyleInputError('ambiguous_current_role', 'empty source requires one selected current role');
  }
  if (mode === 'generate_from_context' && (!manifestState.currentRole
    || manifestState.currentRole.durationMonths <= 0
    || manifestState.currentRole.facts.length === 0)) {
    throw new SummaryV3StyleInputError('insufficient_context', 'empty source requires a current role, structured duration, and one substantive manifest fact');
  }
  const immutableManifestFacts = contextFacts(manifestState.entries);
  const facts = mode === 'generate_from_context'
    ? immutableManifestFacts
    : visibleFacts(request.visibleSummaryFacts, sourceSummary);
  if (facts.length === 0) throw new SummaryV3StyleInputError('insufficient_context', 'no required facts');
  const locks = automaticRelationEntityLocks(
    sourceSummary,
    entityLocks(manifestState.entries, sourceSummary, request.protectedEntities),
  );
  const transformableDuty = validateTransformableDuty(facts, sourceSummary, ownership.style, mode, locks);
  const relationBindings = entityRelationBindings(sourceSummary, locks, facts);
  const selectedEntries = manifestState.entries.map((entry) => {
    const roleSourceLocale = canonicalSummaryV3StyleLocale(entry.roleSourceLocale) || null;
    const rawPresentation = entry.rolePresentation;
    const rolePresentation = rawPresentation
      && canonicalSummaryV3StyleLocale(rawPresentation.targetLocale) === ownership.requestedLocale
      && canonicalSummaryV3StyleLocale(rawPresentation.sourceLocale)
      && rawPresentation.sourceRoleHash === hashSummaryV3StyleValue(entry.role)
      && normalizeSummaryV3StyleText(rawPresentation.text) !== normalizeSummaryV3StyleText(entry.role)
      ? immutableCopy({
        text: rawPresentation.text,
        sourceLocale: canonicalSummaryV3StyleLocale(rawPresentation.sourceLocale)!,
        targetLocale: ownership.requestedLocale,
        sourceRoleHash: rawPresentation.sourceRoleHash,
        provenance: rawPresentation.provenance,
      }) as SummaryV3StyleRolePresentationEvidence
      : null;
    return immutableCopy({
    stableId: entry.stableId,
    hash: hashSummaryV3StyleValue(JSON.stringify({
      stableId: entry.stableId,
      role: entry.role,
      employer: entry.employer,
      roleSourceLocale,
      rolePresentation,
      employmentState: entry.employmentState,
      durationMonths: entry.durationMonths,
    })),
    roleHash: hashSummaryV3StyleValue(entry.role),
    employerHash: hashSummaryV3StyleValue(entry.employer),
    roleSourceLocale,
    rolePresentation,
    employmentState: entry.employmentState,
    durationMonths: entry.durationMonths,
    });
  });
  const manifestHash = hashSummaryV3StyleValue(JSON.stringify({
    manifestId: request.manifest.manifestId,
    contextId: request.manifest.contextId,
    entries: selectedEntries,
    currentRoleEntryId: request.manifest.currentRoleEntryId,
    facts: immutableManifestFacts.map((fact) => [fact.id, fact.hash]),
  }));
  const contextHash = hashSummaryV3StyleValue(`${request.manifest.contextId}:${manifestHash}`);
  const sourceSummaryHash = hashSummaryV3StyleValue(sourceSummary);
  if (!Number.isFinite(request.createdAt) || request.createdAt < 0) {
    throw new SummaryV3StyleInputError('malformed_request', 'createdAt must be a finite request-start timestamp');
  }
  if (request.requestIdentity !== undefined) assertStringId(request.requestIdentity, 'requestIdentity');
  const createdAt = Number(request.createdAt);
  const requestIdentityHash = hashSummaryV3StyleValue(request.requestIdentity ?? request.operationId);
  const snapshotHash = hashSummaryV3StyleValue(JSON.stringify({
    operationId: request.operationId,
    style: ownership.style,
    mode,
    requestedLocale: ownership.requestedLocale,
    sourceSummaryHash,
    manifestHash,
    contextHash,
    requestIdentityHash,
    createdAt,
    currentRoleEntryId: request.manifest.currentRoleEntryId,
    entityLocks: locks.map((lock) => [lock.kind, lock.hash]),
    requiredFacts: facts.map((fact) => [fact.id, fact.hash]),
    entityRelationBindings: relationBindings.map((binding) => [binding.entityHash, binding.sourceUnitHash, binding.sourceFactHashes, binding.hash]),
    transformableDuty: transformableDuty?.hash || null,
    sourceUnits: sourceUnits(sourceSummary).map((unit) => [unit.id, unit.hash]),
    structuredDurationMonths: manifestState.totalDurationMonths,
  }));
  return immutableCopy({
    operationId: request.operationId,
    style: ownership.style,
    mode,
    requestedLocale: ownership.requestedLocale,
    sourceLocale: ownership.requestedLocale,
    sourceKind: mode === 'generate_from_context' ? 'context_manifest' : 'visible_summary',
    sourceSummary,
    sourceSummaryHash,
    sourceSummaryNormalizedLength: normalizedSummaryV3StyleLength(sourceSummary),
    sourceUnits: sourceUnits(sourceSummary),
    selectedEntries,
    currentRoleEntryId: request.manifest.currentRoleEntryId,
    currentRoleHash: manifestState.currentRole ? hashSummaryV3StyleValue(manifestState.currentRole.stableId) : null,
    manifestFacts: immutableManifestFacts,
    requiredFacts: facts,
    transformableDuty,
    entityLocks: locks,
    entityRelationBindings: relationBindings,
    structuredDurationMonths: manifestState.totalDurationMonths,
    manifestHash,
    contextHash,
    snapshotHash,
    requestIdentityHash,
    createdAt,
  }) as SummaryV3StyleOperationSnapshot;
}

export function createSummaryV3StyleInitialEvidence(snapshot: SummaryV3StyleOperationSnapshot): SummaryV3StyleEvidence {
  return immutableCopy({
    writerAttempts: 0,
    evaluatorAttempts: 0,
    repairWriterAttempts: 0,
    repairEvaluatorAttempts: 0,
    phaseStatuses: {
      structural: 'not_evaluated',
      semantic_grounding: 'not_evaluated',
      language_native_quality: 'not_evaluated',
      style_fulfillment: 'not_evaluated',
    },
    candidateHash: null,
    candidateNormalizedLength: null,
    candidateUnitCount: null,
    candidateClauseCount: null,
    requiredFactCount: snapshot.requiredFacts.length,
    coveredFactCount: 0,
    missingFactCount: snapshot.requiredFacts.length,
    unsupportedClaimCount: 0,
    styleFulfilled: null,
    styleEvidence: null,
    meaningfulChangeDetected: false,
    noOpDetected: false,
    unsupportedClaimCategory: null,
    writerOutputContractFailureClass: null,
    writerCandidateReachedValidation: false,
    evaluatorReached: false,
    safeNoOpConsidered: false,
    safeNoOpSelected: false,
    safeNoOpEligibilityReason: 'not_applicable',
    roleIdentityResolution: 'not_required',
    m5ProviderFailure: null,
    sourceSummaryHash: snapshot.sourceSummaryHash,
    manifestHash: snapshot.manifestHash,
    snapshotHash: snapshot.snapshotHash,
    retries: 0,
    fallbacks: 0,
    v2Fallthrough: 0,
  }) as SummaryV3StyleEvidence;
}

export function createSummaryV3StyleHandledFailure(
  snapshot: SummaryV3StyleOperationSnapshot,
  typedReason: SummaryV3StyleFailureReason,
  evidence: SummaryV3StyleEvidence = createSummaryV3StyleInitialEvidence(snapshot),
): SummaryV3StyleResult {
  return immutableCopy({ kind: 'handled_failure', style: snapshot.style, mode: snapshot.mode, typedReason, evidence }) as SummaryV3StyleResult;
}

export function isSummaryV3StyleViolationCode(value: unknown): value is SummaryV3StyleViolationCode {
  return typeof value === 'string' && VIOLATION_CODES.has(value as SummaryV3StyleViolationCode);
}

export function isSummaryV3StyleRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

export function summaryV3StyleHasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return hasExactKeys(value, keys);
}

export function summaryV3StyleIsNonBlank(value: unknown): value is string {
  return isNonBlank(value);
}

export function summaryV3StyleIsMarkdownOrList(input: string): boolean {
  // Providers can use Unicode line separators instead of CRLF/LF. Treat all
  // physical line boundaries alike before testing candidate transport syntax.
  const value = input.replace(/\r\n|[\r\n\u0085\u2028\u2029]/gu, '\n');
  const summaryHeadingOrPreamble = /^(?:(?:summary|professional summary|career summary|resume summary|cv summary|profile)|(?:zusammenfassung|berufliche zusammenfassung|profil)|(?:sažetak|sažetka|profesionalni sažetak|profesionalnog sažetka|profil)|(?:सारांश|पेशेवर सारांश|प्रोफ़ाइल)|(?:ملخص|الملخص|ملخص مهني|نبذة|الملف الشخصي)|(?:要約|職務要約|プロフィール)|(?:(?:here(?:'s| is)|this is)\s+)?your\s+(?:professional\s+)?(?:summary|profile|resume summary|cv summary)|(?:hier ist|dies ist)\s+(?:ihre\s+)?(?:berufliche\s+)?(?:zusammenfassung|profil)|(?:(?:evo|ovo je)\s+)?vaš(?:eg)?\s+(?:profesionalni\s+|profesionalnog\s+)?(?:sažetak|sažetka|profil)|(?:यह\s+)?(?:आपका\s+)?(?:पेशेवर\s+)?(?:सारांश|प्रोफ़ाइल)(?:\s+है)?|(?:(?:هذا|إليك)\s+)?(?:ملخصك|الملخص|ملخص مهني|نبذة|الملف الشخصي)|(?:(?:以下が|これは)\s*)?(?:職務要約|要約|プロフィール)(?:です)?)(?:[ \t]*(?::|=|[-–—])[ \t]*\S|[ \t]*\n[ \t]*\S)/iu;
  // Cased title/connector grammar catches conventional plain-text headings
  // without treating a grammatical wrap before a proper noun or tool as
  // transport formatting. Non-cased representative locales use a compact
  // native-label grammar, preserving ordinary native wrapped prose.
  const descriptorSummaryHeading = /^(?:(?:updated|revised|rewritten|polished|professional|career|executive|concise|enhanced|improved)\s+)+(?:summary|profile|bio|overview|introduction|resume|cv(?:\s+summary)?|career\s+profile)(?:[ \t]*(?::|=|[-–—])[ \t]*(?:\S|\n[ \t]*\S)|[ \t]*\n[ \t]*\S)/iu;
  const plainTextHeadingTerm = '(?:[Ss]ummary|[Pp]rofile|[Bb]io|[Oo]verview|[Ii]ntroduction|[Qq]ualifications|[Ee]xperience|[Ss]kills|[Cc]areer|[Cc][Vv]|[Rr]esume|[Gg]lance|[Rr]ecord|[Ii]mpact|[Aa]chievements|[Hh]ighlights|[Bb]ackground|[Ee]xpertise|[Ss]napshot|[Ff]ocus|[Ss]trengths|[Aa]ccomplishments|[Hh]istory|[Ss]tatement|[Ii]nformation|[Dd]etails|[Cc]apabilities|[Cc]ompetencies|[Cc]ontributions)';
  const plainTextHeadingModifier = '(?:key|major|relevant|personal|professional|core|technical|selected|additional|primary|essential|career|work|employment|leadership|executive|concise|updated|revised|rewritten|polished|enhanced|improved|main|principal|notable)';
  const titleCaseHeadingToken = '(?:\\p{Lu}[\\p{L}\\p{M}\\p{N}\'’.-]*|[\\p{Lu}\\p{N}][\\p{Lu}\\p{N}&/._-]*)';
  const titleCaseHeadingLine = titleCaseHeadingToken + '(?:[ \\t]+(?:' + titleCaseHeadingToken + '|a|an|the|of|and|or|for|at|in|on|to|with|by|from|de|von|und|im|am|na|u|za)){0,11}';
  const titleCaseHeading = new RegExp('^(?=[^\\n]{1,96}\\n[ \\t]*\\p{Lu})' + titleCaseHeadingLine + '[ \\t]*\\n[ \\t]*\\S', 'u');
  const lowerCaseTitleHeading = new RegExp('^(?=[^\\n]{0,96}\\b' + plainTextHeadingTerm + '\\b)(?=[^\\n]{1,96}\\n[ \\t]*\\p{Lu})(?:' + titleCaseHeadingToken + '|' + plainTextHeadingTerm + '|' + plainTextHeadingModifier + '|a|an|the)(?:[ \\t]+(?:' + titleCaseHeadingToken + '|' + plainTextHeadingTerm + '|' + plainTextHeadingModifier + '|a|an|the|of|and|or|for|at|in|on|to|with|by|from|de|von|und|im|am|na|u|za)){0,11}[ \\t]*\\n[ \\t]*\\S', 'u');
  // A compact all-lowercase line followed by a capitalized prose unit is
  // heading-shaped even when its descriptor is not in a finite vocabulary
  // (for example, "project overview"). Keep this deliberately bounded and
  // require an unfinished first line so complete sentence units remain prose.
  const lowerCaseStructuralHeading = /^(?=[^\n]{1,72}\n[ \t]*\p{Lu})(?![^\n]*[.!?…。！？؛;])\p{Ll}[\p{L}\p{M}\p{N}'’.-]*(?:[ \t]+[\p{L}\p{M}\p{N}'’.-]+){0,7}[ \t]*(?::|=|[-–—])?[ \t]*\n[ \t]*\S/u;
  const nonCasedPlainTextHeading = /^(?:(?:主な(?:実績|成果|スキル)|主要な(?:実績|成果|スキル)|職務(?:要約|経歴)|(?:プロジェクト(?:概要|実績|経験)?)|要約|プロフィール|自己紹介|概要|実績|成果|スキル|経験|資格|経歴|職歴|キャリア)|(?:المهارات الأساسية|المهارات|الخبرات|الخبرة|الخبرة المهنية|المشاريع|المشروع|المشروعات|المسار المهني|الإنجازات الرئيسية|الإنجازات|الملف الشخصي|نبذة|ملخص|المؤهلات|السيرة الذاتية)|(?:मुख्य कौशल|प्रमुख उपलब्धियां|प्रमुख उपलब्धियाँ|उपलब्धियां|उपलब्धियाँ|परियोजनाएं|परियोजनाएँ|परियोजना|कार्य अनुभव|कौशल|अनुभव|प्रोफ़ाइल|सारांश|योग्यताएं|योग्यताएँ))(?:[ \t]*(?::|=|[-–—])[ \t]*\S|[ \t]*\n[ \t]*\S)/u;
  const rawOrEscapedMarkup = /<\/?[A-Za-z][A-Za-z\p{N}:_-]*(?:\s+[^<>]*)?>|&lt;\/?[A-Za-z][A-Za-z\p{N}:_-]*(?:\s+[^&<>]*?)?&gt;/iu;
  const rawOrEscapedMarkdownAutolink = /<(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^<>\s]{1,2048}|[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)>|&lt;(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^&<>\s]{1,2048}|[A-Za-z0-9.!#$%&'*+/=?^_{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)&gt;/iu;
  // A tag-shaped matcher does not cover declarations, comments, CDATA, or
  // processing instructions. They are still transport/markup rather than
  // candidate prose, including when HTML-escaped by a provider.
  const rawOrEscapedMarkupDeclaration = /<!--[\s\S]{0,4096}?-->|<!DOCTYPE(?:\s+[^<>]{0,2048})?>|<!\[CDATA\[[\s\S]{0,4096}?\]\]>|<\?[\s\S]{0,4096}?\?>|&lt;!--[\s\S]{0,4096}?--&gt;|&lt;!DOCTYPE(?:\s+[^&<>]{0,2048})?&gt;|&lt;!\[CDATA\[[\s\S]{0,4096}?\]\]&gt;|&lt;\?[\s\S]{0,4096}?\?&gt;/iu;
  const invisibleFormatControl = /\p{Cf}/u;
  // These are wrapper labels and assistant preambles, not Summary prose.
  // Keep the list compact and structural: ordinary prose with a colon stays
  // valid unless it uses an exact wrapper label at a sentence/line boundary.
  const explanatoryWrapper = /(?:^|[\n.!?。！？।;:([{\["'“”‘’«»‹›—–-]\s*)(?:note(?:s)?|explanation(?:s)?|rationale|reasoning|comment|response|answer|draft|hinweis|anmerkung|erläuterung|begründung|antwort|entwurf|napomena|objašnjenje|obrazloženje|odgovor|nacrt|नोट|टिप्पणी|स्पष्टीकरण|कारण|उत्तर|मसौदा|ملاحظة|توضيح|شرح|تبرير|إجابة|مسودة|注|注記|注意|説明|理由|回答|下書き)\s*(?::|=|[-–—])\s*\S/iu;
  const conversationalPreamble = /(?:^|[\n.!?。！？।;:([{\["'“”‘’«»‹›—–-]\s*)(?:(?:sure|certainly|of course|here you go)|(?:here(?:'s| is)|(?:this|below) is)(?:\s+(?:the|your))?(?:\s+(?:revised|updated|rewritten|polished|professional))?\s+(?:summary|profile)|i(?:'ve| have)?\s+(?:revised|updated|rewritten|prepared)(?:\s+(?:the|your))?\s+(?:summary|profile)|hier ist(?:\s+(?:die|ihre))?(?:\s+(?:überarbeitete|aktualisierte|professionelle))?\s+(?:zusammenfassung|profil)|(?:naravno|evo)|(?:ज़रूर|यह रहा)|(?:بالتأكيد|إليك)|(?:もちろん|こちらです|以下です)|(?:以下は|こちらは|これは)(?:\s*(?:更新された|改訂された|プロフェッショナルな))?\s*(?:職務要約|要約|プロフィール)(?:です)?)\s*(?::|,|[-–—])\s*\S/iu;
  const rawObjectLiteralFragment = /(?:\{\s*(?:"[^"]+"|[\p{L}_$][\p{L}\p{N}_$-]*)\s*:|\[\s*\{\s*(?:"[^"]+"|[\p{L}_$][\p{L}\p{N}_$-]*)\s*:)/u;
  const horizontalRuleOrTable = /(?:^|\n)[\t ]*(?:(?:[-_*]\s*){3,}|(?:\|?\s*:?-{3,}:?\s*)+\|?)(?:$|\n)/u;
  const remainingMarkdown = /~~[^~\n]+~~|!?\[[^\]\n]+\]\[[^\]\n]+\]|(?:^|\n)[^\n]{1,120}\n={3,}(?:$|\n)/u;
  const pairedMarkdownEmphasis = /(?:(\*{1,3})(?=\S)[^*\n]{1,512}\1|(?:^|[^\p{L}\p{N}_])(_{1,3})(?=\S)[^_\n]{1,512}\2)/u;
  const referenceDefinition = /(?:^|\n)[\t ]*\[[^\]\n]+\]:\s*\S/u;
  const inlineFootnoteReference = /\[\^[^\]\n]{1,160}\]/u;
  const indentedCodeBlock = /(?:^|\n)(?: {4,}| {0,3}\t)\S/u;
  return /(^|\n)[\t ]*(?:#\s*|[-*+–—]\s+|[•◦‣▪⁃]\s*|>\s*|\p{N}+(?:[.．](?!\p{N})|\))\s*|[\(（]\p{N}+[\)）]\s*)|```|~~~|`[^`]+`|\[[^\]]+\]\([^\)]+\)|(?:^|\s)(?:\*\*|__)[^\n]+?(?:\*\*|__)|(?:^|\s)[*_][^\s*_][^\n]*?[*_]/u.test(value)
    || summaryHeadingOrPreamble.test(value)
    || descriptorSummaryHeading.test(value)
    || titleCaseHeading.test(value)
    || lowerCaseTitleHeading.test(value)
    || lowerCaseStructuralHeading.test(value)
    || nonCasedPlainTextHeading.test(value)
    || horizontalRuleOrTable.test(value)
    || remainingMarkdown.test(value)
    || pairedMarkdownEmphasis.test(value)
    || referenceDefinition.test(value)
    || inlineFootnoteReference.test(value)
    || indentedCodeBlock.test(value)
    || rawOrEscapedMarkup.test(value)
    || rawOrEscapedMarkdownAutolink.test(value)
    || rawOrEscapedMarkupDeclaration.test(value)
    || invisibleFormatControl.test(value)
    || explanatoryWrapper.test(value)
    || conversationalPreamble.test(value)
    || rawObjectLiteralFragment.test(value);
}

/**
 * Writer candidate prose is not a place for protocol metadata. Restrict this
 * to reserved labels at a unit or clause boundary, leaving ordinary prose
 * with a colon available while tool/operation/result fragments fail before
 * evaluation.
 */
export function summaryV3StyleHasReservedTransportMetadataPrefix(input: string): boolean {
  // Preserve physical line starts: the general text normalizer intentionally
  // collapses whitespace, but a new line is also a protocol clause boundary.
  const value = input.replace(/\r\n|[\r\n\u0085\u2028\u2029]/gu, '\n');
  const normalizedWithLines = value.split('\n')
    .map((line) => normalizeSummaryV3StyleText(line))
    .join('\n');
  const label = '(?:operation(?:[ _-]*id)?|snapshot(?:[ _-]*hash)?|manifest(?:[ _-]*hash)?|candidate(?:[ _-]*(?:hash|unit(?:[ _-]*count)?))?|content(?:[ _-]*block(?:[ _-]*count)?)?|text(?:[ _-]*block(?:[ _-]*count)?)?|tool(?:[ _-]*(?:name|choice|block(?:[ _-]*count)?|use))?|input|output|schema|fact(?:[ _-]*(?:id|ids|hash|hashes))?|unit(?:[ _-]*(?:id|ids|hash|hashes))?|phase(?:[ _-]*(?:status|statuses))?|repair(?:[ _-]*(?:only|writer|evaluator))?|summary|style|locale|validation|apply(?:[ _-]*(?:authorized|authorization))?|usage(?:[ _-]*(?:authorized|authorization))?|persist(?:ence|ed)?|writer|evaluator|result|evidence)';
  // A metadata label remains a protocol fragment when it is wrapped in a
  // quote, bracket, parenthesis, slash, or pipe after otherwise normal prose.
  // Do not admit a generic whitespace boundary: ordinary prose may still use
  // words such as `validation` with a normal colon.
  const clauseBoundary = `(?:^|[.!?。！？।,;:，、؛\\-–—\\[\\]\\(\\)（）［］{}"'“”‘’«»‹›/|]\\s*|\\n)`;
  const metadataSeparator = '(?:\\s*(?::|=|[-–—,\\/|])\\s*|\\s+)';
  const delimitedLabel = new RegExp(
    `${clauseBoundary}${label}${metadataSeparator}\\S`,
    'iu',
  );
  const statusLabel = new RegExp(
    `${clauseBoundary}${label}\\s+(?:passed|failed|authorized|denied|complete(?:d)?|success(?:ful(?:ly)?)?|true|false|null)\\b`,
    'iu',
  );
  const jsonObjectLabel = new RegExp(
    `(?:^|[\\s;,:，、؛\\[\\]\\(\\)（）［］"'“”‘’«»‹›/|])\\{\\s*["']?${label}["']?\\s*:`,
    'iu',
  );
  const jsonObjectFragment = /(?:^|[\s;,:，、؛\[\]\(\)（）［］"'“”‘’«»‹›/|])(?:\{\s*"[^"]+"\s*:|\[\s*\{\s*"[^"]+"\s*:)/u;
  const camelCaseProtocolKey = new RegExp(
    `${clauseBoundary}[a-z][a-z\\p{N}]*(?:[A-Z][A-Za-z\\p{N}]*)+${metadataSeparator}\\S`,
    'u',
  );
  return delimitedLabel.test(normalizedWithLines)
    || statusLabel.test(normalizedWithLines)
    || jsonObjectLabel.test(normalizedWithLines)
    || jsonObjectFragment.test(normalizedWithLines)
    || camelCaseProtocolKey.test(normalizedWithLines);
}

export function summaryV3StylePunctuationOnlyChange(source: string, candidate: string): boolean {
  return normalizeSummaryV3StyleText(source) !== normalizeSummaryV3StyleText(candidate)
    && punctuationInsensitive(source) === punctuationInsensitive(candidate);
}

/** A compact fail-closed script floor; detailed native quality remains evaluator-owned. */
export function summaryV3StyleLocaleSurfaceMatches(value: string, locale: SummaryV3StyleSupportedLocale): boolean {
  if (!normalizeSummaryV3StyleText(value)) return false;
  const letters = value.match(/\p{L}/gu) || [];
  if (letters.length === 0) return false;
  const targetLetterCount = (predicate: (letter: string) => boolean) => letters.filter(predicate).length;
  if (locale === 'hi') return targetLetterCount((letter) => /\p{Script=Devanagari}/u.test(letter)) * 100 >= letters.length * 60;
  if (locale === 'ar') return targetLetterCount((letter) => /\p{Script=Arabic}/u.test(letter)) * 100 >= letters.length * 60;
  if (locale === 'ja') return targetLetterCount((letter) => /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(letter)) * 100 >= letters.length * 60;
  if (locale === 'sr') return targetLetterCount((letter) => /[\p{Script=Latin}\p{Script=Cyrillic}]/u.test(letter)) * 100 >= letters.length * 60;
  if (locale === 'ru') return targetLetterCount((letter) => /\p{Script=Cyrillic}/u.test(letter)) * 100 >= letters.length * 60;
  return targetLetterCount((letter) => /\p{Script=Latin}/u.test(letter)) * 100 >= letters.length * 60;
}

const LATIN_LOCALE_SIGNALS: Readonly<Record<'en' | 'de' | 'sr', readonly string[]>> = {
  en: ['and', 'at', 'for', 'from', 'has', 'in', 'is', 'of', 'over', 'she', 'the', 'with'],
  de: ['als', 'bei', 'der', 'die', 'durch', 'für', 'im', 'mit', 'und', 'von', 'wurde'],
  sr: ['bila', 'godina', 'je', 'kao', 'na', 'od', 'sa', 'u', 'već', 'za'],
};

/**
 * Locale labels are authoritative only when the supplied source does not show
 * a stronger compact signal for another supported Latin locale.  Script-based
 * locales have a stricter 60% surface floor above.
 */
export function summaryV3StyleLocaleContentMatches(value: string, locale: SummaryV3StyleSupportedLocale): boolean {
  if (!summaryV3StyleLocaleSurfaceMatches(value, locale)) return false;
  if (locale === 'hi' || locale === 'ar' || locale === 'ja') return true;
  if (locale !== 'en' && locale !== 'de' && locale !== 'sr') return true;
  const tokens = new Set((normalizeSummaryV3StyleText(value).toLocaleLowerCase().match(/\p{L}+/gu) || []));
  const signalCount = (target: keyof typeof LATIN_LOCALE_SIGNALS) => LATIN_LOCALE_SIGNALS[target]
    .filter((signal) => tokens.has(signal)).length;
  if (locale === 'sr' && Array.from(tokens).some((token) => /\p{Script=Cyrillic}/u.test(token))) return true;
  const own = signalCount(locale);
  const strongestForeign = (Object.keys(LATIN_LOCALE_SIGNALS) as Array<keyof typeof LATIN_LOCALE_SIGNALS>)
    .filter((target) => target !== locale)
    .reduce((maximum, target) => Math.max(maximum, signalCount(target)), 0);
  return strongestForeign < 2 || own >= strongestForeign;
}

export function summaryV3StyleCandidatePreservesLocks(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  // The empty-state writer may use supported locale inflection (`Atlas` ->
  // `Atlasu`) when synthesizing from the manifest. Literal source locks are
  // an enhance-existing-content preservation floor; generated semantic
  // grounding remains bound by the evaluator's immutable manifest contract.
  if (snapshot.mode === 'generate_from_context') return true;
  const normalizedCandidate = normalizeSummaryV3StyleText(candidateText);
  const normalizedNumericCandidate = normalizeSummaryV3StyleNumericSurface(normalizedCandidate);
  return snapshot.entityLocks.every((lock) => {
    const normalizedLock = normalizeSummaryV3StyleText(lock.value);
    // Future callers explicitly designate `entity` locks (for example a
    // person name) as literal-preservation values. Every identity lock also
    // retains the immediately source-attested lexical shape, so `Li Wei`,
    // `مهندسة أولى`, and `シニア エンジニア` cannot pass by retaining only a
    // shorter exact substring.
    return lock.kind === 'entity' || lock.kind === 'role' || lock.kind === 'employer'
      ? candidatePreservesUnexpandedIdentityLock(
        snapshot,
        normalizedCandidate,
        normalizedLock,
        lock.kind,
      )
      // Manifest duration values are structured numbers; a native source
      // numeral must bind to the same duration without permitting `24` to
      // match `240` as a substring.
      : lock.kind === 'duration'
        ? summaryV3StyleContainsExactSurface(
          normalizedNumericCandidate,
          normalizeSummaryV3StyleNumericSurface(normalizedLock),
          true,
        )
      : summaryV3StyleContainsExactSurface(normalizedCandidate, normalizedLock);
  });
}

/**
 * A direct lexical extension can be proven without classifying names or
 * maintaining a seniority table: retain the source-attested immediate lexical
 * neighbor. `Li Wei builds`, `Senior Engineer at`, `مهندسة أولى في`, and
 * `シニア エンジニアとして` all introduce a new word immediately beside an exact
 * lock while preserving its original neighbor. Punctuation-separated
 * apposition is intentionally left to the normal fact/style validators.
 */
type SummaryV3StyleIdentityLockContext = Readonly<{
  readonly before: string | null;
  readonly after: string | null;
}>;

function exactSummaryV3StyleSurfaceIndexes(value: string, surface: string, caseSensitive: boolean): readonly number[] {
  const haystack = normalizeSummaryV3StyleText(value);
  const needle = normalizeSummaryV3StyleText(surface);
  const searchableHaystack = caseSensitive ? haystack : haystack.toLocaleLowerCase();
  const searchableNeedle = caseSensitive ? needle : needle.toLocaleLowerCase();
  const indexes: number[] = [];
  let start = 0;
  while (start < searchableHaystack.length) {
    const index = searchableHaystack.indexOf(searchableNeedle, start);
    if (index < 0) break;
    if (isExactSurfaceBoundary(
      searchableNeedle,
      searchableHaystack[index - 1],
      searchableHaystack.slice(index + searchableNeedle.length),
    )) indexes.push(index);
    start = index + searchableNeedle.length;
  }
  return indexes;
}

function immediateIdentityPrefix(value: string): string | null {
  return /([\p{L}\p{N}]+)(?:[\s\-‐‑‒–—・]*)$/u.exec(value)?.[1]?.toLocaleLowerCase() ?? null;
}

type SummaryV3StyleImmediateParentheticalSuffix = Readonly<{
  readonly suffix: string;
  readonly length: number;
}>;

/**
 * A directly attached transparent wrapper can carry a hidden name or level
 * extension (`Li (Wei)`, `Product Engineer [II]`). Retain this only as one
 * normalized lexical suffix so a source-attested form can remain intact.
 */
function immediateIdentityParentheticalSuffix(
  value: string,
): SummaryV3StyleImmediateParentheticalSuffix | null {
  const match = /^\s*[\(（\[［\{｛]\s*([^\(\)（）\[\]［］\{\}｛｝]*[\p{L}\p{N}][^\(\)（）\[\]［］\{\}｛｝]*)\s*[\)）\]］\}｝]/u.exec(value);
  if (!match) return null;
  const content = normalizeSummaryV3StyleText(match[1]!).replace(/\s+/gu, ' ').toLocaleLowerCase();
  return content ? immutableCopy({ suffix: `parenthetical:${content}`, length: match[0].length }) as SummaryV3StyleImmediateParentheticalSuffix : null;
}

/**
 * A comma-separated Roman/numeric level is an adjacent role extension, not
 * ordinary apposition (`Product Engineer, II at Atlas`). Limit this to a
 * compact level grammar so prose such as `Engineer, who ...` stays available.
 */
function immediateIdentityDelimitedLevelSuffix(
  value: string,
): SummaryV3StyleImmediateParentheticalSuffix | null {
  const match = /^\s*[,;:]\s*((?:[ivxlcdm]+|\d{1,2}|(?:level|grade)\s+(?:[ivxlcdm]+|\d{1,2})|[lp]\d{1,2}))(?=\s|[,.!?。！？।]|$)/iu.exec(value);
  if (!match) return null;
  return immutableCopy({ suffix: `level:${match[1]!.replace(/\s+/gu, ' ').toLocaleLowerCase()}`, length: match[0].length }) as SummaryV3StyleImmediateParentheticalSuffix;
}

/**
 * A title-cased role or employer immediately after a comma or slash is a
 * material appositional extension (`Product Engineer, Architect`), not the
 * lowercase discourse continuation (`Engineer, who ...`) that remains
 * available to ordinary prose. Preserve a source-attested variant literally.
 */
function immediateIdentityDelimitedCasedSuffix(
  value: string,
): SummaryV3StyleImmediateParentheticalSuffix | null {
  const match = /^\s*[,;/／]\s*(\p{Lu}[\p{L}\p{N}'’.-]*)(?=\s|[,.!?。！？।]|$)/u.exec(value);
  if (!match) return null;
  return immutableCopy({ suffix: `delimited:${match[1]!.toLocaleLowerCase()}`, length: match[0].length }) as SummaryV3StyleImmediateParentheticalSuffix;
}

function sourceParentheticalIdentitySuffixes(
  value: string,
  surface: string,
  caseSensitive: boolean,
): readonly string[] {
  return exactSummaryV3StyleSurfaceIndexes(value, surface, caseSensitive)
    .map((index) => immediateIdentityParentheticalSuffix(
      normalizeSummaryV3StyleText(value).slice(index + normalizeSummaryV3StyleText(surface).length),
    )?.suffix)
    .filter((suffix): suffix is string => !!suffix);
}

function immediateIdentitySuffixes(value: string): readonly string[] {
  const suffixes: string[] = [];
  let remaining = value;
  // Continue only through a directly adjacent lexical run. A comma or other
  // clause boundary stops the scan, preserving legitimate apposition while
  // closing any-length inserted identity expansion before the source witness.
  while (remaining) {
    const parenthetical = immediateIdentityParentheticalSuffix(remaining);
    if (parenthetical) {
      suffixes.push(parenthetical.suffix);
      remaining = remaining.slice(parenthetical.length);
      continue;
    }
    const delimitedLevel = immediateIdentityDelimitedLevelSuffix(remaining);
    if (delimitedLevel) {
      suffixes.push(delimitedLevel.suffix);
      remaining = remaining.slice(delimitedLevel.length);
      continue;
    }
    const delimitedCased = immediateIdentityDelimitedCasedSuffix(remaining);
    if (delimitedCased) {
      suffixes.push(delimitedCased.suffix);
      remaining = remaining.slice(delimitedCased.length);
      continue;
    }
    const next = /^(?:[\s\-‐‑‒–—・]*)([\p{L}\p{N}]+)/u.exec(remaining);
    if (!next) break;
    suffixes.push(next[1]!.toLocaleLowerCase());
    remaining = remaining.slice(next[0].length);
  }
  return suffixes;
}

function immediateIdentitySuffixIsTerminalExtension(value: string): boolean {
  if (immediateIdentityParentheticalSuffix(value)
    || immediateIdentityDelimitedLevelSuffix(value)
    || immediateIdentityDelimitedCasedSuffix(value)) return true;
  const first = /^(?:[\s\-‐‑‒–—・]*)([\p{L}\p{N}]+)/u.exec(value);
  return !!first && /^[\s\-‐‑‒–—・.!?。！？।]*$/u.test(value.slice(first[0].length));
}

/**
 * A new adjacent lexical extension cannot become harmless merely by placing a
 * clause delimiter before the source-attested neighbor (`Engineer Senior,
 * at ...`). This is structural adjacency, not a language-specific title
 * table; ordinary `Engineer, who ...` has no inserted lexical extension.
 */
function immediateIdentityPunctuationDelimitedSuccessor(value: string): string | null {
  return /^(?:[\s\-‐‑‒–—・]*)(?:[\p{L}\p{N}]+)\s*[,;:，、؛]\s*([\p{L}\p{N}]+)/u.exec(value)?.[1]?.toLocaleLowerCase() ?? null;
}

function identityHasImmediateClauseDelimiter(value: string): boolean {
  return /^[\s]*[,;:，、؛]/u.test(value);
}

/*
 * These words are deliberately not accepted as an identity expansion. They
 * are passed to the existing local employment, authority, or style guards so
 * those guards can return their specific typed terminal rather than turning a
 * known modifier into a generic source-floor failure.
 */
const NONMATERIAL_IDENTITY_PREFIXES = new Set([
  'a', 'an', 'the', 'as',
  'current', 'former', 'past', 'previous',
  'proven', 'accomplished', 'distinguished',
  'senior', 'principal',
]);

function candidatePreservesUnexpandedIdentityLock(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
  lockValue: string,
  lockKind: Extract<SummaryV3StyleEntityLock['kind'], 'entity' | 'role' | 'employer'>,
): boolean {
  const caseSensitive = lockKind === 'entity';
  const haystack = normalizeSummaryV3StyleText(candidateText);
  const needle = normalizeSummaryV3StyleText(lockValue);
  const searchableHaystack = caseSensitive ? haystack : haystack.toLocaleLowerCase();
  const searchableNeedle = caseSensitive ? needle : needle.toLocaleLowerCase();
  const source = normalizeSummaryV3StyleText(snapshot.sourceSummary);
  const sourceContexts = exactSummaryV3StyleSurfaceIndexes(source, needle, caseSensitive)
    .map((index) => immutableCopy({
      before: immediateIdentityPrefix(source.slice(0, index)),
      after: immediateIdentitySuffixes(source.slice(index + needle.length))[0] ?? null,
    }) as SummaryV3StyleIdentityLockContext);
  const sourcePrefixes = new Set(sourceContexts.map((context) => context.before).filter((value): value is string => !!value));
  const sourceSuffixes = new Set(sourceContexts.map((context) => context.after).filter((value): value is string => !!value));
  const sourceHasTerminalLock = sourceContexts.some((context) => context.after === null);
  let start = 0;
  let foundStandalone = false;
  while (start < searchableHaystack.length) {
    const index = searchableHaystack.indexOf(searchableNeedle, start);
    if (index < 0) break;
    const precedingText = haystack.slice(0, index);
    const followingText = haystack.slice(index + needle.length);
    if (isExactSurfaceBoundary(
      searchableNeedle,
      searchableHaystack[index - 1],
      searchableHaystack.slice(index + searchableNeedle.length),
    )) {
      const prefix = immediateIdentityPrefix(precedingText);
      const suffixes = immediateIdentitySuffixes(followingText);
      const [firstSuffix] = suffixes;
      const punctuationDelimitedSuccessor = immediateIdentityPunctuationDelimitedSuccessor(followingText);
      const prefixIntroducesUnattestedMaterial = !!prefix
        && !sourcePrefixes.has(prefix)
        && !NONMATERIAL_IDENTITY_PREFIXES.has(prefix);
      const followsSourceIdentityContext = (firstSuffix && sourceSuffixes.has(firstSuffix))
        || (!firstSuffix && identityHasImmediateClauseDelimiter(followingText)
          && (sourceHasTerminalLock || sourceSuffixes.size > 0));
      if ((firstSuffix && suffixes.slice(1).some((suffix) => sourceSuffixes.has(suffix)) && !sourceSuffixes.has(firstSuffix))
        || (firstSuffix && punctuationDelimitedSuccessor && sourceSuffixes.has(punctuationDelimitedSuccessor)
          && !sourceSuffixes.has(firstSuffix))
        // An explicit entity is literal-preservation authority. When its
        // source occurrence is terminal, any directly attached lexical run
        // (`Ava` -> `Ava Priya built ...`) is a material expansion. Roles and
        // employers retain their bounded terminal extension rule so ordinary
        // fluent reformats such as `Atlas who builds ...` are not rejected.
        || (firstSuffix && sourceHasTerminalLock && !sourceSuffixes.has(firstSuffix)
          && (lockKind === 'entity' || immediateIdentitySuffixIsTerminalExtension(followingText)))
        || (prefixIntroducesUnattestedMaterial && followsSourceIdentityContext)) return false;
      foundStandalone = true;
    }
    start = index + searchableNeedle.length;
  }
  return foundStandalone;
}

export function createSummaryV3StyleCandidate(
  snapshot: SummaryV3StyleOperationSnapshot,
  units: readonly SummaryV3StyleCandidateUnit[],
): SummaryV3StyleCandidate {
  const text = units.map((unit) => unit.text).join(' ').trim();
  return immutableCopy({
    operationId: snapshot.operationId,
    snapshotHash: snapshot.snapshotHash,
    manifestHash: snapshot.manifestHash,
    style: snapshot.style,
    locale: snapshot.requestedLocale,
    units,
    text,
    hash: hashSummaryV3StyleValue(JSON.stringify(units.map((unit) => [unit.unitId, unit.text, unit.factIds]))),
    normalizedLength: normalizedSummaryV3StyleLength(text),
    unitCount: countSummaryV3StyleUnits(text),
    clauseCount: countSummaryV3StyleClauses(text),
  }) as SummaryV3StyleCandidate;
}

/** Binds ordered unit ID, exact prose, and declared ordered fact IDs. */
export function summaryV3StyleCandidateUnitHash(unit: SummaryV3StyleCandidateUnit): string {
  return hashSummaryV3StyleValue(JSON.stringify([unit.unitId, unit.text, unit.factIds]));
}

export function summarizeSummaryV3StyleFactCoverage(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidate: SummaryV3StyleCandidate,
): Readonly<{ coveredFactCount: number; missingFactCount: number; missingFactIds: readonly string[] }> {
  const covered = new Set(candidate.units.flatMap((unit) => unit.factIds));
  const missingFactIds = snapshot.requiredFacts.filter((fact) => !covered.has(fact.id)).map((fact) => fact.id);
  return immutableCopy({
    coveredFactCount: snapshot.requiredFacts.length - missingFactIds.length,
    missingFactCount: missingFactIds.length,
    missingFactIds,
  }) as Readonly<{ coveredFactCount: number; missingFactCount: number; missingFactIds: readonly string[] }>;
}

export function createSummaryV3StyleNotApplicable(reason: SummaryV3StyleNotApplicableReason): SummaryV3StyleResult {
  return immutableCopy({ kind: 'not_applicable', reason }) as SummaryV3StyleResult;
}
