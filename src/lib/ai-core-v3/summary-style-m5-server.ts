import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
  SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL,
  SUMMARY_V3_STYLE_STRATEGIES,
  canonicalSummaryV3StyleLocale,
  summaryV3StyleContainsExactSurface,
  summaryV3StyleContainsLongerIdentityTokenSequence,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  createSummaryV3StyleCandidate,
  createSummaryV3StyleHandledFailure,
  createSummaryV3StyleInitialEvidence,
  createSummaryV3StyleNotApplicable,
  createSummaryV3StyleOperationSnapshot,
  decideSummaryV3StyleOwnership,
  hashSummaryV3StyleValue,
  isSummaryV3StyleRecord,
  isSummaryV3StyleViolationCode,
  normalizeSummaryV3StyleNumericSurface,
  normalizeSummaryV3StyleText,
  normalizedSummaryV3StyleLength,
  summarizeSummaryV3StyleFactCoverage,
  summarizeSummaryV3StyleSourceLockDiagnostics,
  summaryV3StyleCandidatePreservesCalendarDateSurfaces,
  summaryV3StyleCandidatePreservesExactMaterialSurfaces,
  summaryV3StyleCandidatePreservesEntityFactBindings,
  summaryV3StyleCandidateUnitHash,
  inspectSummaryV3StyleCandidatePreservesLocks,
  summaryV3StyleCalendarDateRanges,
  inspectSummaryV3StyleCandidateSourceFloor,
  summaryV3StyleCandidateSourceFloorDecision,
  summaryV3StyleCandidateUnitsRepresentDeclaredFacts,
  summaryV3StyleLocalSemanticDecision,
  summaryV3StyleDurationMonthsFromSemanticSpan,
  summaryV3StyleFactAnchorTokens,
  summaryV3StyleOrderedFactTokens,
  summaryV3StyleHasExactKeys,
  summaryV3StyleHasReservedTransportMetadataPrefix,
  summaryV3StyleIsMarkdownOrList,
  summaryV3StyleIsNonBlank,
  summaryV3StyleLocaleSurfaceMatches,
  summaryV3StyleLocaleContentMatches,
  summaryV3StylePunctuationOnlyChange,
  type SummaryV3Style,
  type SummaryV3StyleCandidate,
  type SummaryV3StyleCandidateUnit,
  type SummaryV3StyleEvidence,
  type SummaryV3StyleFailureReason,
  type SummaryV3StyleFulfillmentEvidence,
  type SummaryV3StyleOperationSnapshot,
  type SummaryV3StyleSupportedLocale,
  type SummaryV3StylePhase,
  type SummaryV3StylePhaseStatus,
  type SummaryV3StylePostEvaluatorLocalFailureClass,
  type SummaryV3StyleRequest,
  type SummaryV3StyleResult,
  type SummaryV3StyleRoleIdentityResolution,
  type SummaryV3StyleSafeNoOpEligibilityReason,
  type SummaryV3StyleUnsupportedClaimCategory,
  type SummaryV3StyleSourceFloorMismatchClass,
  type SummaryV3StyleSourceLockInspection,
  type SummaryV3StyleEmploymentStateContradictionClass,
  type SummaryV3StyleCandidateSourceFloorInspection,
  type SummaryV3StyleEvaluatorOutputContractFailureClass,
  type SummaryV3StyleWriterOutputContractFailureClass,
  type SummaryV3StyleViolation,
  type SummaryV3StyleViolationCode,
} from './summary-style-m5';
import { immutableCopy } from './immutability';
import {
  recordSummaryStyleLocalDiagnostics,
  type SummaryStyleHardPredicate,
  type SummaryStyleRoleFailure,
  type SummaryStyleSafeNoOpEligibility,
} from './summary-style-m5-local-observability';
import { detectRoleLabelSourceLocale } from '@/lib/cv-summary-structured-role-localization';
import {
  SummaryV3ProviderTransportError,
  classifySummaryV3ProviderFailure,
} from './summary-generate-server';
import type {
  SummaryV3ProviderFailureEnvelope,
  SummaryV3ProviderPhase,
} from './summary-generate';

/** The server executor is injected; no external SDK is instantiated here. */
export interface SummaryV3StyleWriterInput {
  readonly operationId: string;
  readonly snapshotHash: string;
  readonly manifestHash: string;
  readonly style: SummaryV3Style;
  readonly locale: string;
  readonly mode: 'generate_from_context' | 'enhance_existing_content';
  readonly sourceKind: 'context_manifest' | 'visible_summary';
  readonly sourceText: string;
  readonly sourceUnits: SummaryV3StyleOperationSnapshot['sourceUnits'];
  readonly selectedEntries: SummaryV3StyleOperationSnapshot['selectedEntries'];
  readonly currentRoleEntryId: string | null;
  readonly currentRoleHash: string | null;
  readonly structuredDurationMonths: number;
  readonly requiredFacts: SummaryV3StyleOperationSnapshot['requiredFacts'];
  readonly transformableDuty: SummaryV3StyleOperationSnapshot['transformableDuty'];
  readonly entityLocks: readonly Readonly<{ kind: string; value: string; hash: string }>[];
  readonly roleIdentity: Readonly<{
    status: 'not_assessed' | 'equivalent' | 'contradiction' | 'unresolved';
    selectedEntryId: string | null;
  }>;
  readonly styleContract: readonly string[];
  readonly forcedTool: Readonly<{
    toolName: typeof SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME;
    toolChoice: 'required';
    strict: true;
    expectedToolBlocks: 1;
    allowedTextBlocks: 0;
    schema: typeof SUMMARY_V3_STYLE_M5_WRITER_TOOL;
  }>;
}

export interface SummaryV3StyleEvaluatorInput {
  readonly operationId: string;
  readonly snapshotHash: string;
  readonly manifestHash: string;
  readonly style: SummaryV3Style;
  readonly locale: string;
  readonly mode: 'generate_from_context' | 'enhance_existing_content';
  readonly candidate: SummaryV3StyleCandidate;
  readonly sourceText: string;
  readonly sourceUnits: SummaryV3StyleOperationSnapshot['sourceUnits'];
  readonly selectedEntries: SummaryV3StyleOperationSnapshot['selectedEntries'];
  readonly currentRoleEntryId: string | null;
  readonly currentRoleHash: string | null;
  readonly structuredDurationMonths: number;
  readonly requiredFacts: SummaryV3StyleOperationSnapshot['requiredFacts'];
  readonly transformableDuty: SummaryV3StyleOperationSnapshot['transformableDuty'];
  readonly manifestValidationCeiling: SummaryV3StyleOperationSnapshot['manifestFacts'];
  readonly entityLocks: readonly Readonly<{ kind: string; value: string; hash: string }>[];
  readonly roleIdentity: Readonly<{
    status: 'not_assessed' | 'equivalent' | 'contradiction' | 'unresolved';
    selectedEntryId: string | null;
    structuredRole: string | null;
    roleSourceLocale: string | null;
    employer: string | null;
    rolePresentation: SummaryV3StyleOperationSnapshot['selectedEntries'][number]['rolePresentation'];
  }>;
  readonly forcedTool: Readonly<{
    toolName: typeof SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME;
    toolChoice: 'required';
    strict: true;
    expectedToolBlocks: 1;
    allowedTextBlocks: 0;
    schema: typeof SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL;
  }>;
}

export interface SummaryV3StyleRepairWriterInput extends SummaryV3StyleWriterInput {
  readonly originalCandidate: SummaryV3StyleCandidate;
  readonly violations: readonly SummaryV3StyleViolation[];
  readonly repairOnly: true;
}

export interface SummaryV3StyleServerDependencies {
  readonly write: (input: SummaryV3StyleWriterInput) => Promise<unknown>;
  readonly evaluate: (input: SummaryV3StyleEvaluatorInput) => Promise<unknown>;
  readonly repairWrite?: (input: SummaryV3StyleRepairWriterInput) => Promise<unknown>;
  readonly repairEvaluate?: (input: SummaryV3StyleEvaluatorInput) => Promise<unknown>;
  readonly now?: () => number;
}

interface ParsedEvaluation {
  readonly phases: Readonly<Record<SummaryV3StylePhase, Readonly<{
    status: SummaryV3StylePhaseStatus;
    violations: readonly SummaryV3StyleViolation[];
  }>>>;
  readonly representedFactIdHashes: readonly string[];
  readonly missingFactIdHashes: readonly string[];
  readonly roleIdentityResolution: SummaryV3StyleRoleIdentityResolution;
  readonly styleEvidence: ParsedStyleEvidence;
}

interface ParsedShorterEvidence {
  readonly style: 'shorter';
  readonly semanticCompressionOperations: number;
  readonly sourceNormalizedLength: number;
  readonly candidateNormalizedLength: number;
  readonly lengthDelta: number;
  readonly lengthDeltaPercent: number;
  readonly sourceUnitCount: number;
  readonly candidateUnitCount: number;
  readonly sourceClauseCount: number;
  readonly candidateClauseCount: number;
  readonly factCoverage: boolean;
  readonly shorterFulfilled: boolean;
  readonly noOpDetected: boolean;
}

interface ParsedStrongerEvidence {
  readonly style: 'stronger';
  readonly strongerPredicateTransformations: number;
  readonly structuralStrengtheningCount: number;
  readonly modifierOnlyTransformationDetected: boolean;
  readonly repeatedStyleModifierCount: number;
  readonly stackedModifierDetected: boolean;
  readonly unsupportedAuthorityDetected: boolean;
  readonly strongerFulfilled: boolean;
  readonly noOpDetected: boolean;
}

interface ParsedProfessionalEvidence {
  readonly style: 'professional';
  readonly professionalFramingOperations: number;
  readonly cohesionClarityOperations: number;
  readonly markerOnlyChangeDetected: boolean;
  readonly jargonOrFillerDetected: boolean;
  readonly professionalFulfilled: boolean;
  readonly noOpDetected: boolean;
}

type ParsedStyleEvidence = ParsedShorterEvidence | ParsedStrongerEvidence | ParsedProfessionalEvidence;

type WriterParseResult =
  | Readonly<{ ok: true; candidate: SummaryV3StyleCandidate }>
  | Readonly<{ ok: false; reason: 'writer_transport_malformed' | 'writer_identity_mismatch' | 'candidate_malformed' }>
  | Readonly<{
    ok: false;
    reason: 'lost_source_fact';
    writerOutputContractFailureClass: SummaryV3StyleWriterOutputContractFailureClass;
    candidate: SummaryV3StyleCandidate;
    candidateSourceFloorInspection?: SummaryV3StyleCandidateSourceFloorInspection;
    sourceLockInspection?: SummaryV3StyleSourceLockInspection;
  }>;

type EvaluatorParseResult =
  | Readonly<{ ok: true; evaluation: ParsedEvaluation }>
  | Readonly<{
    ok: false;
    reason: 'evaluator_transport_malformed';
    evaluatorOutputContractFailureClass: SummaryV3StyleEvaluatorOutputContractFailureClass;
  }>
  | Readonly<{ ok: false; reason: 'evaluator_rejected' }>;

function writerFailure(
  reason: Extract<WriterParseResult, { ok: false }>['reason'],
  writerOutputContractFailureClass?: SummaryV3StyleWriterOutputContractFailureClass,
  candidate?: SummaryV3StyleCandidate,
  candidateSourceFloorInspection?: SummaryV3StyleCandidateSourceFloorInspection,
  sourceLockInspection?: SummaryV3StyleSourceLockInspection,
): WriterParseResult {
  return immutableCopy({
    ok: false as const,
    reason,
    ...(writerOutputContractFailureClass ? { writerOutputContractFailureClass } : {}),
    ...(candidate ? { candidate } : {}),
    ...(candidateSourceFloorInspection ? { candidateSourceFloorInspection } : {}),
    ...(sourceLockInspection ? { sourceLockInspection } : {}),
  }) as WriterParseResult;
}

function evaluatorFailure(
  evaluatorOutputContractFailureClass: SummaryV3StyleEvaluatorOutputContractFailureClass,
): EvaluatorParseResult {
  return immutableCopy({
    ok: false as const,
    reason: 'evaluator_transport_malformed' as const,
    evaluatorOutputContractFailureClass,
  }) as EvaluatorParseResult;
}

const REQUIRED_PHASES: readonly SummaryV3StylePhase[] = [
  'structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment',
];

const UNSUPPORTED_CLAIM_CODES = new Set(['unsupported_claim', 'unsupported_authority', 'unsupported_metric']);
const UNREPAIRABLE_CODES = new Set([
  'unsupported_claim', 'unsupported_authority', 'unsupported_metric', 'lost_source_fact', 'stale_identity', 'safe_no_op',
]);
const JARGON_PATTERN = /\b(?:synergy|world[- ]class|game[- ]changing|dynamic|strategic|exceptional|outstanding|highly|very|proven|results[- ]driven|thought leader)\b/iu;
const AUTHORITY_PATTERN = /\b(?:own(?:ed|ing|s)?|lead(?:s|ing|ership)?|led|drove|drives|driving|deliver(?:ed|s|ing)? results|senior|principal|director|head of|manage(?:d|r|rs|s|ment|ing)?|supervis(?:ed|es|ing)?|spearhead(?:ed|s|ing)?|executive)\b/giu;
const NUMBER_TOKEN_PATTERN = /\p{N}+(?:[.,٫]\p{N}+)?/gu;
const STYLE_CONTENT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'is', 'of', 'on', 'or', 'she', 'the', 'to', 'who', 'with',
]);
const SOURCE_METRIC_RELATION_STOP_WORDS = new Set([
  ...STYLE_CONTENT_STOP_WORDS,
  'over', 'month', 'months', 'year', 'years', 'during', 'within', 'through', 'per', 'use', 'uses', 'using',
  // Supported-locale relation glue only. These tokens carry no material CV
  // claim and must not turn an otherwise manifest-grounded duration sentence
  // into an apparent source inconsistency.
  'bei', 'seit', 'mit', 'und', 'für', 'im', 'als', 'auf',
  'je', 'već', 'kroz', 'tokom', 'iz', 'od', 'do', 'sa', 'za',
  'में', 'से', 'और', 'के', 'का', 'की', 'हैं', 'पर',
  'في', 'من', 'منذ', 'مع', 'على', 'و',
  'として', 'から', 'まで', 'の', 'を', 'に', 'は', 'が', 'で', 'と',
]);
const MATERIAL_NUMERIC_RELATION_TERMS = new Set([
  'revenue', 'profit', 'profits', 'sales', 'margin', 'margins', 'roi', 'growth',
]);
// Direct result nouns are a compact source-floor category even without a
// number or currency glyph. This prevents a Stronger predicate replacement
// from smuggling in `generates revenue` while leaving ordinary adjective and
// locale-quality decisions to the injected evaluator.
const MATERIAL_RESULT_RELATION_TERMS = new Set([
  ...MATERIAL_NUMERIC_RELATION_TERMS,
  'save', 'saves', 'saved', 'saving', 'savings', 'money',
  'award', 'awards', 'promotion', 'promotions',
  'client', 'clients', 'customer', 'customers', 'result', 'results',
  'outcome', 'outcomes', 'impact',
]);
// Clients/customers are material candidate-floor nouns, but `builds APIs for
// customers` is an ordinary visible duty rather than a source-side result
// assertion. Reserve this smaller ceiling for actual result claims.
const SOURCE_MATERIAL_RESULT_CEILING_TERMS = new Set([
  ...MATERIAL_NUMERIC_RELATION_TERMS,
  'save', 'saves', 'saved', 'saving', 'savings', 'money',
  'award', 'awards', 'promotion', 'promotions',
  'result', 'results', 'outcome', 'outcomes', 'impact',
]);
const NAMED_TOOL_LEXEME_PATTERN = /(?:\.NET|\p{Lu}[\p{L}\p{N}]*(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?)/gu;
const NAMED_TOOL_USE_RELATION_PATTERN = /\b(?:uses?|using|Uses?|Using)\s+((?:\.NET|\p{Lu}[\p{L}\p{N}]*(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?)(?:(?:\s+(?:(?:and|or)\s+)?|,\s*)(?:\.NET|\p{Lu}[\p{L}\p{N}]*(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?))*)/gu;
const NAMED_TOOL_WITH_RELATION_PATTERN = /\b(?:with|With)\s+((?:\.NET|\p{Lu}[\p{L}\p{N}]*(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?)(?:(?:\s+(?:(?:and|or)\s+)?|,\s*)(?:\.NET|\p{Lu}[\p{L}\p{N}]*(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?))*)/gu;

function count(value: unknown, maximum = 100_000): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum ? value : null;
}

function signedCount(value: unknown, maximum = 100_000): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= -maximum && value <= maximum ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function authorityTerms(value: string): readonly string[] {
  return Array.from(new Set(normalizeSummaryV3StyleText(value).toLocaleLowerCase().match(AUTHORITY_PATTERN) || []));
}

function hasUnsupportedAuthorityOrSeniority(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  const sourceTerms = new Set(authorityTerms(`${snapshot.sourceSummary} ${snapshot.requiredFacts.map((fact) => fact.text).join(' ')}`));
  return authorityTerms(candidateText).some((term) => !sourceTerms.has(term));
}

/** Compare numeric authority by value surface, not numeral script. */
function numericTokens(value: string): readonly string[] {
  return normalizeSummaryV3StyleNumericSurface(value).match(NUMBER_TOKEN_PATTERN) || [];
}

function hasUnsupportedNumericMetric(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  const sourceNumbers = new Set(numericTokensOutsideValidatedStructuredDurationSurfaces(
    snapshot,
    `${snapshot.sourceSummary} ${snapshot.requiredFacts.map((fact) => fact.text).join(' ')}`,
  ));
  const candidateNumbers = numericTokensOutsideValidatedStructuredDurationSurfaces(snapshot, candidateText);
  if (candidateNumbers.some((number) => !sourceNumbers.has(number))) return true;
  // For a non-empty transformation, preserve the source's numeric relation as
  // well as membership: set equality alone would accept `20% over 24 months`
  // rewritten as `24% over 20 months`.
  if (snapshot.mode === 'enhance_existing_content') {
    const stableUnique = (numbers: readonly string[]) => numbers.filter((number, index) => numbers.indexOf(number) === index);
    const visibleNumbers = stableUnique(numericTokensOutsideValidatedStructuredDurationSurfaces(snapshot, snapshot.sourceSummary));
    const candidateSequence = stableUnique(candidateNumbers);
    return visibleNumbers.length > 0 && visibleNumbers.join('|') !== candidateSequence.join('|');
  }
  return false;
}

// Historical marker constants are intentionally absent from runtime authority.

/**
 * Identity-bound employment relation parser. Employment state is a property
 * of the selected role/employer frame, never of an isolated duty verb or a
 * global marker token. This parser is the single runtime authority used by
 * contradiction and source-preservation checks, and by the diagnostic bit.
 */
type EmploymentFrameGrammar = Readonly<{
  readonly relations: readonly RegExp[];
  readonly employerBeforeRoleRelations: readonly RegExp[];
  readonly employerBeforeRoleLinks: readonly RegExp[];
  readonly employerBeforeRoleDirectRelations?: readonly RegExp[];
  readonly employerBeforeRolePresentPrefixes: readonly RegExp[];
  readonly employerBeforeRoleCompletedPrefixes: readonly RegExp[];
  readonly presentPrefixes: readonly RegExp[];
  readonly completedPrefixes: readonly RegExp[];
  readonly presentSuffixes?: readonly RegExp[];
  readonly completedSuffixes?: readonly RegExp[];
}>;

const EMPLOYMENT_WORDS = `[\\p{L}\\p{M}\\p{N}'’+#&./-]+`;

/**
 * One locale-aware employment-frame grammar. The same grammar object is used
 * for source classification, candidate classification, contradiction, source
 * preservation, and the diagnostic opposite-frame bit.
 */
const EMPLOYMENT_FRAME_GRAMMARS: Readonly<Record<SummaryV3StyleSupportedLocale, EmploymentFrameGrammar>> = {
  en: {
    relations: [/\b(?:at|with)\b/iu],
    employerBeforeRoleRelations: [/\b(?:at|with)\s*$/iu],
    employerBeforeRoleLinks: [/\b(?:as)(?:\s+an?)?\s*$/iu],
    employerBeforeRolePresentPrefixes: [/\b(?:work|works|serve|serves)\s*$/iu, /\b(?:am|is|are)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/\b(?:worked|served)\s*$/iu, /\b(?:was|were)\s*$/iu],
    presentPrefixes: [
      /\b(?:currently|presently|ongoing)\s+(?:work|works|serve|serves)\s+as\s+(?:an?\s+)?$/iu,
      /\b(?:currently|presently|ongoing)\s+(?:am|is|are)\s+(?:an?\s+)?$/iu,
      /\b(?:work|works|serve|serves)\s+as\s+(?:an?\s+)?$/iu,
      new RegExp(`\\b(?:am|is|are)\\s+(?:an?\\s+)?(?:${EMPLOYMENT_WORDS}\\s+){0,2}$`, 'iu'),
      new RegExp(`\\b(?:am|is|are)\\s+(?:an?\\s+)?(?:${EMPLOYMENT_WORDS}\\s+){0,2}$`, 'iu'),
    ],
    completedPrefixes: [
      new RegExp(`\\b(?:formerly|previously|once)\\s+(?:worked|served)\\s+as\\s*(?:${EMPLOYMENT_WORDS}\\s+){0,3}$`, 'iu'),
      new RegExp(`\\b(?:worked|served)\\s+as\\s*(?:${EMPLOYMENT_WORDS}\\s+){0,3}$`, 'iu'),
      /\b(?:was|were)\s+(?:an?\s+)?$/iu,
    ],
  },
  de: {
    relations: [/\b(?:bei|in)\b/iu],
    employerBeforeRoleRelations: [/\b(?:bei|in)\s*$/iu],
    employerBeforeRoleLinks: [/\bals(?:\s+ein(?:e|en|em|er)?)?\s*$/iu],
    employerBeforeRolePresentPrefixes: [
      /\b(?:arbeite|arbeitet)\s+(?:aktuell|derzeit|gegenwärtig)\s+(?:bei|in)\s*$/iu,
      /\b(?:bin|ist|sind)\s+(?:aktuell|derzeit|gegenwärtig)?\s*(?:bei|in)\s*$/iu,
      /\b(?:arbeite|arbeitet)\s+(?:aktuell|derzeit|gegenwärtig)\s*$/iu,
      /\b(?:bin|ist|sind)\s+(?:aktuell|derzeit|gegenwärtig)\s*$/iu,
      /\b(?:arbeite|arbeitet)\s*$/iu,
      /\b(?:bin|ist|sind)\s*$/iu,
    ],
    employerBeforeRoleCompletedPrefixes: [
      /\b(?:arbeitete|arbeiteten)\s+(?:früher|zuvor|ehemals)\s+(?:bei|in)\s*$/iu,
      /\b(?:war|waren)\s+(?:früher|zuvor|ehemals)?\s*(?:bei|in)\s*$/iu,
      /\b(?:arbeitete|arbeiteten)\s*$/iu,
      /\b(?:war|waren)\s*$/iu,
    ],
    presentPrefixes: [
      /\b(?:arbeite|arbeitet)\s+(?:aktuell\s+)?als\s+(?:ein(?:e|en|em|er)?\s+)?$/iu,
      /\b(?:ist|sind)\s+(?:ein(?:e|en|em|er)?\s+)?$/iu,
    ],
    completedPrefixes: [
      /\b(?:arbeitete|arbeiteten|arbeitete)\s+(?:früher\s+)?als\s+(?:ein(?:e|en|em|er)?\s+)?$/iu,
      /\b(?:war|waren)\s+(?:ein(?:e|en|em|er)?\s+)?$/iu,
    ],
  },
  sr: {
    relations: [/\b(?:u|kod|sa|s)\b/iu],
    employerBeforeRoleRelations: [/\b(?:u|kod|sa|s)\s*$/iu],
    employerBeforeRoleLinks: [/\b(?:kao|u\s+ulozi)\s*$/iu],
    employerBeforeRolePresentPrefixes: [/(?:trenutno\s+)?(?:radim|radi|sam|je)\s*$/iu, /(?:trenutno\s+)?(?:radim|radi|sam|je)\s+(?:u|na)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/(?:prethodno\s+)?(?:sam\s+)?(?:radio|radila|radili|bio|bila|bili)\s*$/iu, /(?:prethodno\s+)?(?:sam\s+)?(?:radio|radila|radili|bio|bila|bili)\s+(?:u|na)\s*$/iu],
    presentPrefixes: [
      /\b(?:radim|radi|sam|je)\s+(?:trenutn(?:o|a|i)?\s+)?(?:kao|u\s+ulozi)?\s*$/iu,
    ],
    completedPrefixes: [
      /\b(?:radio|radila|radili|bio|bila|bili)\s+(?:ranije\s+)?(?:kao|u\s+ulozi)?\s*$/iu,
    ],
  },
  hr: {
    relations: [/\b(?:u|kod|sa|s)\b/iu],
    employerBeforeRoleRelations: [/\b(?:u|kod|sa|s)\s*$/iu],
    employerBeforeRoleLinks: [/\b(?:kao|u\s+ulozi)\s*$/iu],
    employerBeforeRolePresentPrefixes: [/(?:trenutno\s+)?(?:radim|radi|sam|je)\s*$/iu, /(?:trenutno\s+)?(?:radim|radi|sam|je)\s+(?:u|na)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/(?:prethodno\s+)?(?:sam\s+)?(?:radio|radila|radili|bio|bila|bili)\s*$/iu, /(?:prethodno\s+)?(?:sam\s+)?(?:radio|radila|radili|bio|bila|bili)\s+(?:u|na)\s*$/iu],
    presentPrefixes: [
      /\b(?:radim|radi|sam|je)\s+(?:trenutn(?:o|a|i)?\s+)?(?:kao|u\s+ulozi)?\s*$/iu,
    ],
    completedPrefixes: [
      /\b(?:radio|radila|radili|bio|bila|bili)\s+(?:ranije\s+)?(?:kao|u\s+ulozi)?\s*$/iu,
    ],
  },
  hi: {
    relations: [/(?:^|\s)में(?:\s|$)/u],
    employerBeforeRoleRelations: [/(?:^|\s)में\s*$/u],
    employerBeforeRoleLinks: [/(?:के\s+रूप\s+में|में)\s*$/u],
    employerBeforeRoleDirectRelations: [/^\s*में\s*$/u],
    employerBeforeRolePresentPrefixes: [/(?:वर्तमान(?:\s+में)?|अभी|कार्यरत)\s*$/u],
    employerBeforeRoleCompletedPrefixes: [/(?:पूर्व(?:\s+में)?|पहले|भूतपूर्व)\s*$/u],
    presentPrefixes: [],
    completedPrefixes: [],
    presentSuffixes: [
      /^\s*(?:हूँ|है|हैं)(?=\s*(?:$|[.!?।！？,，;:؛]|और(?=\s|$)|लेकिन(?=\s|$)))/u,
      /^\s*(?:में\s+)?काम\s+कर(?:ता|ती|ते)\s+(?:हूँ|है|हैं)(?=\s*(?:$|[.!?।！？,，;:؛]|और(?=\s|$)|लेकिन(?=\s|$)))/u,
    ],
    completedSuffixes: [
      /^\s*(?:था|थी|थे|थीं)(?=\s*(?:$|[.!?।！？,，;:؛]|और(?=\s|$)|लेकिन(?=\s|$)))/u,
      /^\s*(?:में\s+)?काम\s+कर(?:ता|ती|ते)\s+(?:था|थी|थे|थीं)(?=\s*(?:$|[.!?।！？,，;:؛]|और(?=\s|$)|लेकिन(?=\s|$)))/u,
    ],
  },
  ar: {
    relations: [/(?:^|\s)(?:في|ب)(?:\s|$)/u],
    employerBeforeRoleRelations: [/(?:^|\s)(?:في|ب)\s*$/u],
    employerBeforeRoleLinks: [/(?:كـ|ك)\s*$/u],
    employerBeforeRolePresentPrefixes: [/(?:حالي(?:ة|ا)?|أعمل|يعمل|أكون|يكون|حاضِر)\s*$/u, /(?:أعمل|يعمل|أكون|يكون)\s+حاليا\s*$/u],
    employerBeforeRoleCompletedPrefixes: [/(?:سابق(?:ة|ا)?|عملت|كان|كانت|سابقا)\s*$/u, /عملت\s+سابقا\s*$/u],
    presentPrefixes: [/(?:أعمل|يعمل|أكون|يكون)\s+(?:حاليا\s+)?(?:كـ|ك)\s*$/u],
    completedPrefixes: [/عملت\s+(?:سابقا\s+)?(?:كـ|ك)\s*$/u],
  },
  ja: {
    relations: [/の/u, /として/u, /(?:^|\s)で(?:\s|$)/u],
    employerBeforeRoleRelations: [/(?:^|\s)で\s*$/u],
    employerBeforeRoleLinks: [/^\s*で\s*$/u, /として\s*$/u],
    employerBeforeRoleDirectRelations: [/^\s*(?:の|で)\s*$/u],
    employerBeforeRolePresentPrefixes: [/(?:現在|現職|働いて|務めて|勤務)\s*$/u],
    employerBeforeRoleCompletedPrefixes: [/(?:前職|以前|かつて|働いていた|務めていた|勤務していた)\s*$/u],
    presentPrefixes: [],
    completedPrefixes: [/(?:前職|以前|かつて)(?:では|は|に)?\s*$/u, /(?:働いていた|務めていた|勤務していた)\s*$/u],
    presentSuffixes: [/^\s*(?:として|で)?働いています(?=\s*(?:$|[.!?。！？、,，;:：]|が|けれども|しかし))/u],
    completedSuffixes: [/^\s*(?:として|で)?働いていました(?=\s*(?:$|[.!?。！？、,，;:：]|が|けれども|しかし))/u],
  },
  fr: {
    relations: [/\b(?:chez|dans|à|avec|pour)\b/iu],
    employerBeforeRoleRelations: [/\b(?:chez|dans|à|avec|pour)\s*$/iu],
    employerBeforeRoleLinks: [/\bcomme(?:\s+un?)?\s*$/iu],
    employerBeforeRolePresentPrefixes: [/\b(?:travaille|travaillez|travail)\s+(?:actuellement\s+)?(?:chez|dans|à|avec|pour)?\s*$/iu, /\b(?:suis|est|sommes|sont)\s+(?:actuellement\s+)?(?:chez|dans|à|avec|pour)?\s*$/iu, /\b(?:travaille|travaillez|travail)\s*$/iu, /\b(?:suis|est|sommes|sont)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/\b(?:travaillais|travaillait|travaillé)\s*$/iu, /\b(?:étais|était|étaient)\s*$/iu],
    presentPrefixes: [
      /\b(?:travaille|travaillez|travail)\s+(?:actuellement\s+)?comme\s+(?:un?\s+)?$/iu,
      /\b(?:suis|est|sommes|sont)\s+(?:un?\s+)?$/iu,
    ],
    completedPrefixes: [
      /\b(?:ai|a|avez|avait|travaillais|travaillait|travaillé)\s+(?:auparavant\s+)?(?:travaillé\s+)?comme\s+(?:un?\s+)?$/iu,
      /\b(?:étais|était|étaient)\s+(?:un?\s+)?$/iu,
    ],
  },
  es: {
    relations: [/\b(?:en|con|para)\b/iu],
    employerBeforeRoleRelations: [/\b(?:en|con|para)\s*$/iu],
    employerBeforeRoleLinks: [/\bcomo(?:\s+un?)?\s*$/iu],
    employerBeforeRolePresentPrefixes: [/\b(?:actualmente\s+)?(?:trabajo|trabaja|trabajamos)\s+(?:en|con|para)?\s*$/iu, /\b(?:soy|es|somos|son)\s+(?:actualmente\s+)?(?:en|con|para)?\s*$/iu, /\b(?:trabajo|trabaja|trabajamos)\s*$/iu, /\b(?:soy|es|somos|son)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/\b(?:trabajé|trabajó|trabajaba|trabajaron)\s*$/iu, /\b(?:era|eran|fui|fue)\s*$/iu],
    presentPrefixes: [
      /\b(?:trabajo|trabaja|trabajamos)\s+(?:actualmente\s+)?como\s+(?:un?\s+)?$/iu,
      /\b(?:soy|es|somos|son)\s+(?:un?\s+)?$/iu,
    ],
    completedPrefixes: [
      /\b(?:trabajé|trabajó|trabajaba|trabajaron)\s+(?:anteriormente\s+)?como\s+(?:un?\s+)?$/iu,
      /\b(?:era|eran|fui|fue)\s+(?:un?\s+)?$/iu,
    ],
  },
  it: {
    relations: [/\b(?:presso|in|con|per)\b/iu],
    employerBeforeRoleRelations: [/\b(?:presso|in|con|per)\s*$/iu],
    employerBeforeRoleLinks: [/\bcome(?:\s+un?)?\s*$/iu],
    employerBeforeRolePresentPrefixes: [/\b(?:attualmente\s+)?(?:lavoro|lavora|lavoriamo)\s+(?:presso|in|con|per)?\s*$/iu, /\b(?:sono|è|siamo)\s+(?:attualmente\s+)?(?:presso|in|con|per)?\s*$/iu, /\b(?:lavoro|lavora|lavoriamo)\s*$/iu, /\b(?:sono|è|siamo)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/\b(?:lavoravo|lavorò|lavorato)\s*$/iu, /\b(?:ero|era|erano|fui|fu)\s*$/iu],
    presentPrefixes: [
      /\b(?:lavoro|lavora|lavoriamo)\s+(?:attualmente\s+)?come\s+(?:un?\s+)?$/iu,
      /\b(?:sono|è|siamo|sono)\s+(?:un?\s+)?$/iu,
    ],
    completedPrefixes: [
      /\b(?:ho|ha|avevo|lavoravo|lavorò|lavorato)\s+(?:precedentemente\s+)?(?:lavorato\s+)?come\s+(?:un?\s+)?$/iu,
      /\b(?:ero|era|erano|fui|fu)\s+(?:un?\s+)?$/iu,
    ],
  },
  'pt-BR': {
    relations: [/\b(?:em|no|na|com|para)\b/iu],
    employerBeforeRoleRelations: [/\b(?:em|no|na|com|para)\s*$/iu],
    employerBeforeRoleLinks: [/\bcomo(?:\s+um?a?)?\s*$/iu],
    employerBeforeRolePresentPrefixes: [/\b(?:atualmente\s+)?(?:trabalho|trabalha|trabalhamos)\s+(?:em|no|na|com|para)?\s*$/iu, /\b(?:sou|é|somos|são)\s+(?:atualmente\s+)?(?:em|no|na|com|para)?\s*$/iu, /\b(?:trabalho|trabalha|trabalhamos)\s*$/iu, /\b(?:sou|é|somos|são)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/\b(?:trabalhei|trabalhou|trabalhava|trabalharam)\s*$/iu, /\b(?:era|eram|fui|foi)\s*$/iu],
    presentPrefixes: [
      /\b(?:trabalho|trabalha|trabalhamos)\s+(?:atualmente\s+)?como\s+(?:um?a?\s+)?$/iu,
      /\b(?:sou|é|somos|são)\s+(?:um?a?\s+)?$/iu,
    ],
    completedPrefixes: [
      /\b(?:trabalhei|trabalhou|trabalhava|trabalharam)\s+(?:anteriormente\s+)?como\s+(?:um?a?\s+)?$/iu,
      /\b(?:era|eram|fui|foi)\s+(?:um?a?\s+)?$/iu,
    ],
  },
  ru: {
    relations: [/(?:^|\s)(?:у|в|на|с)(?:\s|$)/iu],
    employerBeforeRoleRelations: [/(?:^|\s)(?:у|в|на|с)\s*$/iu],
    employerBeforeRoleLinks: [/(?:как)\s*$/iu],
    employerBeforeRolePresentPrefixes: [/(?:работаю|работает|работаем)\s*$/iu, /(являюсь|является)\s*$/iu],
    employerBeforeRoleCompletedPrefixes: [/(?:работал|работала|работали)\s*$/iu, /(был|была|были)\s*$/iu],
    presentPrefixes: [
      /(?:^|\s)(?:работаю|работает|работаем)\s+(?:сейчас\s+)?как\s*$/iu,
      /(?:^|\s)(?:сейчас\s+я\s+)?(?:являюсь|является)\s*$/iu,
    ],
    completedPrefixes: [
      /(?:^|\s)(?:работал|работала|работали)\s+(?:ранее\s+)?как\s*$/iu,
      /(?:^|\s)(?:ранее\s+я\s+)?(?:был|была|были)\s*$/iu,
    ],
  },
};

function employmentFrameGrammarFor(locale: string): EmploymentFrameGrammar {
  const canonical = canonicalSummaryV3StyleLocale(locale);
  return canonical ? EMPLOYMENT_FRAME_GRAMMARS[canonical] : EMPLOYMENT_FRAME_GRAMMARS.en;
}

type SummaryV3StyleEntryIdentitySurface = Readonly<{
  readonly entryId: string;
  readonly kind: 'role' | 'employer';
  readonly value: string;
  readonly normalizedValue: string;
}>;

type SummaryV3StyleRoleIdentityStatus = 'not_assessed' | 'equivalent' | 'contradiction' | 'unresolved';

type SummaryV3StyleRoleIdentityDecision = Readonly<{
  status: SummaryV3StyleRoleIdentityStatus;
  selectedEntryId: string | null;
}>;

/**
 * Resolve entry identity only through exact fact anchors. A visible longer
 * same-kind surface wins over its literal phrase prefix (`Acme Labs` over
 * `Acme`), so a neighboring entry cannot manufacture a current/prior or
 * duration association for the shorter identity.
 */
function exactEntryIdentitySurfaces(
  snapshot: SummaryV3StyleOperationSnapshot,
): readonly SummaryV3StyleEntryIdentitySurface[] {
  return snapshot.selectedEntries.flatMap((entry) => (['role', 'employer'] as const).flatMap((kind) => {
    const value = snapshot.manifestFacts.find((fact) => fact.id === `${entry.stableId}:${kind}`)?.text;
    const source = value ? [immutableCopy({
      entryId: entry.stableId,
      kind,
      value,
      normalizedValue: normalizeSummaryV3StyleText(value).toLocaleLowerCase(),
    }) as SummaryV3StyleEntryIdentitySurface] : [];
    if (kind !== 'role' || !entry.rolePresentation) return source;
    return [
      ...source,
      immutableCopy({
        entryId: entry.stableId,
        kind: 'role' as const,
        value: entry.rolePresentation.text,
        normalizedValue: normalizeSummaryV3StyleText(entry.rolePresentation.text).toLocaleLowerCase(),
      }) as SummaryV3StyleEntryIdentitySurface,
    ];
  }));
}

function exactEntryIdsInSummaryV3StyleClause(
  snapshot: SummaryV3StyleOperationSnapshot,
  clause: string,
): ReadonlySet<string> {
  const visible = exactEntryIdentitySurfaces(snapshot)
    .filter((identity) => factSurfaceIsPresent(identity.value, clause));
  const maximal = visible.filter((identity) => !visible.some((other) =>
    other !== identity
    && other.kind === identity.kind
    && summaryV3StyleContainsLongerIdentityTokenSequence(other.normalizedValue, identity.normalizedValue)));
  return new Set(maximal.map((identity) => identity.entryId));
}

function summaryV3StyleIdentityClauses(value: string): readonly string[] {
  return normalizeSummaryV3StyleText(value)
    .split(/(?<=[.!?。！？।])\s*|(?<=\.)\s+(?=\S)|[,;:，、؛]/u)
    .filter(Boolean);
}

function employmentFrameStateForClause(
  snapshot: SummaryV3StyleOperationSnapshot,
  entry: SummaryV3StyleOperationSnapshot['selectedEntries'][number],
  clause: string,
  locale: string,
): 'present' | 'completed' | 'neutral' | 'conflicting' {
  const identities = exactEntryIdentitySurfaces(snapshot).filter((identity) => identity.entryId === entry.stableId);
  const roleSurfaces = identities.filter((identity) => identity.kind === 'role');
  const employerSurfaces = identities.filter((identity) => identity.kind === 'employer');
  const normalizedClause = normalizeSummaryV3StyleText(clause).toLocaleLowerCase();
  const roleSurface = roleSurfaces.find((identity) => normalizedClause.includes(identity.normalizedValue));
  const employerSurface = employerSurfaces.find((identity) => normalizedClause.includes(identity.normalizedValue));
  if (!roleSurface || !employerSurface) return 'neutral';
  const roleStart = normalizedClause.indexOf(roleSurface.normalizedValue);
  const employerStart = normalizedClause.indexOf(employerSurface.normalizedValue);
  const grammar = employmentFrameGrammarFor(locale);
  if (roleStart < 0 || employerStart < 0) return 'neutral';
  const roleBeforeEmployer = roleStart < employerStart;
  const relationSurface = normalizedClause.slice(
    Math.min(roleStart, employerStart),
    Math.max(roleStart, employerStart),
  );
  const beforeEmployer = normalizedClause.slice(Math.max(0, employerStart - 128), employerStart);
  const beforeRole = normalizedClause.slice(Math.max(0, roleStart - 128), roleStart);
  const beforeEmployerRelation = beforeEmployer.replace(/\S+\s*$/u, '');
  const stateWindows = roleBeforeEmployer
    ? [beforeRole]
    : [beforeEmployer, beforeEmployerRelation, beforeRole];
  const frameEnd = Math.max(
    roleStart + roleSurface.normalizedValue.length,
    employerStart + employerSurface.normalizedValue.length,
  );
  const afterFrame = normalizedClause.slice(frameEnd, frameEnd + 160);
  const relationMatched = roleBeforeEmployer
    ? grammar.relations.some((relation) => relation.test(relationSurface))
    : (grammar.employerBeforeRoleRelations.some((relation) => relation.test(beforeEmployer))
      && grammar.employerBeforeRoleLinks.some((link) => link.test(
        normalizedClause.slice(
          employerStart + employerSurface.normalizedValue.length,
          roleStart,
        ),
      )))
      || (grammar.employerBeforeRoleDirectRelations || []).some((relation) => relation.test(
        normalizedClause.slice(
          employerStart + employerSurface.normalizedValue.length,
          roleStart,
        ),
      ));
  if (!relationMatched) return 'neutral';
  const current = grammar.presentPrefixes.some((prefix) => stateWindows.some((window) => prefix.test(window)))
    || (!roleBeforeEmployer && grammar.employerBeforeRolePresentPrefixes.some((prefix) => (
      stateWindows.some((window) => prefix.test(window))
    )))
    || (grammar.presentSuffixes || []).some((suffix) => suffix.test(afterFrame));
  const completed = grammar.completedPrefixes.some((prefix) => stateWindows.some((window) => prefix.test(window)))
    || (!roleBeforeEmployer && grammar.employerBeforeRoleCompletedPrefixes.some((prefix) => (
      stateWindows.some((window) => prefix.test(window))
    )))
    || (grammar.completedSuffixes || []).some((suffix) => suffix.test(afterFrame));
  if (current && completed) return 'conflicting';
  if (current && !completed) return 'present';
  if (completed && !current) return 'completed';
  return 'neutral';
}

type EmploymentRelationState = 'present' | 'completed' | 'neutral' | 'conflicting';

type EmploymentRelationEntryDecision = Readonly<{
  readonly entryId: string;
  readonly sourceState: 'present' | 'completed' | null;
  readonly candidateState: EmploymentRelationState;
  readonly explicitOpposite: boolean;
}>;

export type SummaryV3StyleEmploymentRelationDecision = Readonly<{
  readonly contradicted: boolean;
  readonly class: SummaryV3StyleEmploymentStateContradictionClass | null;
  readonly explicitOppositeFrameDetected: boolean;
  readonly entries: readonly EmploymentRelationEntryDecision[];
}>;

function employmentRelationStateForText(
  snapshot: SummaryV3StyleOperationSnapshot,
  text: string,
  locale: string,
): ReadonlyMap<string, EmploymentRelationState> {
  const clauses = summaryV3StyleIdentityClauses(text);
  const result = new Map<string, EmploymentRelationState>();
  for (const entry of snapshot.selectedEntries) {
    const sameClause = clauses.filter((clause) =>
      exactEntryIdsInSummaryV3StyleClause(snapshot, clause).has(entry.stableId));
    const states = sameClause.map((clause) => employmentFrameStateForClause(snapshot, entry, clause, locale));
    if (states.includes('conflicting')) {
      result.set(entry.stableId, 'conflicting');
      continue;
    }
    const explicitStates = states.filter((state): state is 'present' | 'completed' => state !== 'neutral');
    const state = new Set(explicitStates);
    result.set(entry.stableId, state.size > 1 ? 'conflicting' : state.values().next().value || 'neutral');
  }
  return result;
}

/**
 * One semantic decision for every selected employment frame. Historical
 * marker/parity classes remain valid diagnostic values, but are never emitted
 * by this new runtime decision.
 */
export function employmentRelationDecision(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): SummaryV3StyleEmploymentRelationDecision {
  const candidateStates = employmentRelationStateForText(snapshot, candidateText, snapshot.requestedLocale);
  const sourceStates = employmentRelationStateForText(snapshot, snapshot.sourceSummary, snapshot.sourceLocale);
  const entries = snapshot.selectedEntries.map((entry) => {
    const sourceState = sourceStates.get(entry.stableId);
    const candidateState = candidateStates.get(entry.stableId) || 'neutral';
    const explicitOpposite = (entry.employmentState === 'present' && (candidateState === 'completed' || candidateState === 'conflicting'))
      || (entry.employmentState === 'completed' && (candidateState === 'present' || candidateState === 'conflicting'));
    return immutableCopy({
      entryId: entry.stableId,
      sourceState: sourceState === 'present' || sourceState === 'completed' ? sourceState : null,
      candidateState,
      explicitOpposite,
    }) as EmploymentRelationEntryDecision;
  });
  const opposite = entries.find((entry) => entry.explicitOpposite);
  return immutableCopy({
    contradicted: Boolean(opposite),
    class: opposite
      ? opposite.sourceState === 'present' || snapshot.selectedEntries.find((entry) => entry.stableId === opposite.entryId)?.employmentState === 'present'
        ? 'present_entry_prior_marker' as const
        : 'completed_entry_current_marker' as const
      : null,
    explicitOppositeFrameDetected: Boolean(opposite),
    entries,
  });
}

function explicitSourceEmploymentState(
  snapshot: SummaryV3StyleOperationSnapshot,
  entryId: string,
): 'present' | 'completed' | null {
  const parsed = employmentRelationStateForText(snapshot, snapshot.sourceSummary, snapshot.sourceLocale).get(entryId);
  return parsed === 'present' || parsed === 'completed' ? parsed : null;
}

function employmentSourceStatePreservationFailure(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  const relation = employmentRelationDecision(snapshot, candidateText);
  if (relation.contradicted) return false;
  return relation.entries.some((entry) => {
    const sourceState = explicitSourceEmploymentState(snapshot, entry.entryId);
    return sourceState !== null && entry.candidateState !== sourceState;
  });
}

/**
 * Backward-compatible facade for callers and historical tests. New runtime
 * decisions are semantic only; lexical parity/fallback branches are gone.
 */
export function employmentStateContradictionDecision(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): SummaryV3StyleEmploymentRelationDecision {
  return employmentRelationDecision(snapshot, candidateText);
}

export function employmentStateContradictionClass(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): SummaryV3StyleEmploymentStateContradictionClass | null {
  return employmentStateContradictionDecision(snapshot, candidateText).class;
}

export function hasEmploymentStateContradiction(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  return employmentStateContradictionDecision(snapshot, candidateText).contradicted;
}

function semanticRelationClauses(value: string): readonly string[] {
  return normalizeSummaryV3StyleText(value)
    .split(/(?<=[!?。！？।])\s*|(?<=\.)\s+(?=\S)|[,;:，、؛]/u)
    .filter((clause) => summaryV3StyleFactAnchorTokens(clause).some((token) => token.startsWith('span:')));
}

function numericOrCurrencyRelationClauses(value: string): readonly string[] {
  return normalizeSummaryV3StyleText(value)
    .split(/(?<=[!?。！？।])\s*|(?<=\.)\s+(?=\S)|[,;:，、؛]/u)
    .filter((clause) => /\p{N}+(?:[.,٫]\p{N}+)?/u.test(clause) || /\p{Sc}/u.test(clause));
}

function materialResultRelationClauses(value: string): readonly string[] {
  return normalizeSummaryV3StyleText(value)
    .split(/(?<=[!?。！？।])\s*|(?<=\.)\s+(?=\S)|[,;:，、؛]/u)
    .filter((clause) => summaryV3StyleFactAnchorTokens(clause)
      .some((token) => MATERIAL_RESULT_RELATION_TERMS.has(token)));
}

function materialResultRelationKeywords(value: string): readonly string[] {
  return Array.from(new Set(summaryV3StyleFactAnchorTokens(value)
    .filter((token) => !token.startsWith('span:'))
    .filter((token) => token.length >= 2 && !SOURCE_METRIC_RELATION_STOP_WORDS.has(token))));
}

function numericOrCurrencyRelationKeywords(value: string): readonly string[] {
  // Reuse the domain's script-aware lexical splitter. A generic `\p{L}+`
  // token merges adjacent Japanese Han/Hiragana/Katakana text into a surface
  // that no manifest anchor can represent, turning an unchanged valid source
  // metric or date into a false unsupported-claim terminal.
  const tokens = summaryV3StyleOrderedFactTokens(value);
  const indices = tokens.flatMap((token, index) => /\p{N}|\p{Sc}/u.test(token) ? [index] : []);
  return Array.from(new Set(indices.flatMap((index) => tokens.slice(Math.max(0, index - 3), index + 4))
    .filter((token) => !/\p{N}|\p{Sc}/u.test(token))
    .filter((token) => token.length >= 2 && !SOURCE_METRIC_RELATION_STOP_WORDS.has(token))));
}

function isStructuredDurationSemanticSpan(span: string, snapshot: SummaryV3StyleOperationSnapshot): boolean {
  const expectedMonths = summaryV3StyleDurationMonthsFromSemanticSpan(span);
  return expectedMonths !== null && snapshot.selectedEntries.some((entry) => entry.durationMonths === expectedMonths);
}

/**
 * A source duration may be semantically equivalent to its structured manifest
 * duration while its literal number differs (`2 years` versus `24 months`).
 * Exempt only numeric tokens physically contained in a validated duration
 * span; a second `2` in `2 years and 2 awards` remains exact-value authority.
 */
function validatedStructuredDurationRanges(
  snapshot: SummaryV3StyleOperationSnapshot,
  value: string,
): readonly (readonly [number, number])[] {
  const source = normalizeSummaryV3StyleNumericSurface(value).toLocaleLowerCase();
  const isWordOrNumber = (character: string | undefined): boolean => !!character && /[\p{L}\p{N}]/u.test(character);
  const isJapaneseScript = (character: string | undefined): boolean => !!character
    && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character);
  const durationRanges: Array<readonly [number, number]> = [];
  for (const span of summaryV3StyleFactAnchorTokens(value)
    .filter((token) => token.startsWith('span:'))
    .filter((token) => isStructuredDurationSemanticSpan(token, snapshot))) {
    const surface = normalizeSummaryV3StyleNumericSurface(span.slice('span:'.length)).toLocaleLowerCase();
    const allowsJapaneseDurationContinuation = /(?:か月|ヶ月|カ月|箇月|年)$/u.test(surface);
    let offset = 0;
    while (offset < source.length) {
      const index = source.indexOf(surface, offset);
      if (index < 0) break;
      const following = source[index + surface.length];
      if ((!isWordOrNumber(source[index - 1]) || (allowsJapaneseDurationContinuation && isJapaneseScript(source[index - 1])))
        && (!isWordOrNumber(following) || (allowsJapaneseDurationContinuation && isJapaneseScript(following)))) {
        durationRanges.push([index, index + surface.length]);
      }
      offset = index + surface.length;
    }
  }
  return durationRanges;
}

function numericTokensOutsideValidatedStructuredDurationSurfaces(
  snapshot: SummaryV3StyleOperationSnapshot,
  value = snapshot.sourceSummary,
  ignoreCalendarDates = false,
): readonly string[] {
  const source = normalizeSummaryV3StyleNumericSurface(value).toLocaleLowerCase();
  const durationRanges = validatedStructuredDurationRanges(snapshot, value);
  const excludedRanges = ignoreCalendarDates ? [...durationRanges, ...summaryV3StyleCalendarDateRanges(value)] : durationRanges;
  return Array.from(source.matchAll(NUMBER_TOKEN_PATTERN))
    .filter((match) => match.index !== undefined
      && !excludedRanges.some(([start, end]) => match.index! >= start && match.index! + match[0].length <= end))
    .map((match) => match[0]);
}

/**
 * Duration equivalence waives only the physical duration surface. Surrounding
 * relation vocabulary remains subject to the non-empty source ceiling, so a
 * newly inserted `revenue` claim cannot hide behind `24 months`.
 */
function numericOrCurrencyRelationKeywordsOutsideValidatedStructuredDurationSurfaces(
  snapshot: SummaryV3StyleOperationSnapshot,
  value: string,
): readonly string[] {
  const durationSpans = summaryV3StyleFactAnchorTokens(value)
    .filter((token) => token.startsWith('span:'))
    .filter((token) => isStructuredDurationSemanticSpan(token, snapshot));
  if (durationSpans.length === 0) return numericOrCurrencyRelationKeywords(value);
  // A duration-equivalent relation still needs its surrounding material
  // vocabulary checked. Removing the entire `24 months` surface would also
  // remove the only numeric anchor and let `generates revenue ... 24 months`
  // bypass the source ceiling. Keep every lexical token outside the exact
  // authorized duration range; a single marked predicate replacement remains
  // handled by candidateRelationUsesMarkedPredicateReplacement below.
  const durationTokens = new Set(durationSpans.flatMap((span) =>
    summaryV3StyleFactAnchorTokens(span.slice('span:'.length))
      .filter((token) => !token.startsWith('span:'))));
  return Array.from(new Set(summaryV3StyleFactAnchorTokens(value)
    .filter((token) => !token.startsWith('span:'))
    .filter((token) => !durationTokens.has(token))
    .filter((token) => !/\p{N}|\p{Sc}/u.test(token))
    .filter((token) => token.length >= 2 && !SOURCE_METRIC_RELATION_STOP_WORDS.has(token))));
}

function materialFactAnchors(value: string): readonly string[] {
  return summaryV3StyleFactAnchorTokens(value)
    .filter((anchor) => anchor.startsWith('span:') || /\p{N}/u.test(anchor)
      || (anchor.length >= 2 && !SOURCE_METRIC_RELATION_STOP_WORDS.has(anchor))
      // The domain anchor constructor emits a one-character lexical anchor
      // only when it survived its uppercase/proper-surface rules (`R`, not a
      // generic lower-case particle). Keep that exact token so a short CV
      // tool cannot be injected from context or silently ignored in source.
      || (anchor.length === 1 && !SOURCE_METRIC_RELATION_STOP_WORDS.has(anchor)));
}

/**
 * Extract only capitalized/symbolic technical terms in an English tool-use
 * relation. This is intentionally not a general tool or person classifier;
 * it supplies a local ceiling for the same narrow source form already used
 * to detect an unmanifested source-only tool.
 */
type NamedToolRelationSurface = Readonly<{
  readonly kind: 'use' | 'with';
  readonly surface: string;
  /** Complete capitalized relation phrase, not merely one of its tokens. */
  readonly relationSurface: string;
}>;

function namedToolRelationSurfaces(value: string): readonly NamedToolRelationSurface[] {
  const normalized = normalizeSummaryV3StyleText(value);
  const relations = [
    ['use', NAMED_TOOL_USE_RELATION_PATTERN],
    ['with', NAMED_TOOL_WITH_RELATION_PATTERN],
  ] as const;
  const surfaces = relations.flatMap(([kind, pattern]) => Array.from(normalized.matchAll(pattern))
    .flatMap((relation) => Array.from(relation[1]!.matchAll(NAMED_TOOL_LEXEME_PATTERN), (token) =>
      immutableCopy({ kind, surface: token[0], relationSurface: relation[1]! }) as NamedToolRelationSurface)));
  return Array.from(new Map(surfaces.map((surface) =>
    [`${surface.kind}:${surface.relationSurface}:${surface.surface}`, surface])).values());
}

/** Exact token/span containment, never a substring test (`Go` is not `Google`). */
function factSurfaceIsPresent(value: string, container: string): boolean {
  const anchors = materialFactAnchors(value);
  if (anchors.length === 0) return false;
  const containerAnchors = new Set(materialFactAnchors(container));
  return anchors.every((anchor) => containerAnchors.has(anchor));
}

/**
 * Plain named technical surfaces (for example `uses Rust`) have no generic
 * syntax for a locale-neutral tool classifier. This narrow English technical
 * relation guard catches an unmanifested named tool without treating German
 * nouns, Serbian inflections, or other capitalized natural-language surfaces
 * as tools. Other locale semantics remain evaluator authority.
 */
function isManifestEntryIdentityFactId(id: string): boolean {
  return /:(?:role|employer|employment_state|duration)$/u.test(id);
}

/**
 * A technical relation is authorized only by an exact non-identity manifest
 * fact. Flat token overlap is not enough: a manifest employer `Rust Labs`
 * must never authorize an unmanifested `uses Rust` source claim.
 */
function manifestHasExactNamedToolAuthority(
  snapshot: SummaryV3StyleOperationSnapshot,
  surface: string,
): boolean {
  const normalizedSurface = normalizeSummaryV3StyleText(surface).toLocaleLowerCase();
  return snapshot.manifestFacts
    .filter((fact) => !isManifestEntryIdentityFactId(fact.id))
    .some((fact) => normalizeSummaryV3StyleText(fact.text).toLocaleLowerCase() === normalizedSurface
      || namedToolRelationSurfaces(fact.text).some((relation) => relation.kind === 'use'
        && normalizeSummaryV3StyleText(relation.surface).toLocaleLowerCase() === normalizedSurface));
}

function hasUnmanifestedNamedSourceToolSurface(snapshot: SummaryV3StyleOperationSnapshot): boolean {
  return namedToolRelationSurfaces(snapshot.sourceSummary).some((relation) => {
    if (manifestHasExactNamedToolAuthority(snapshot, relation.surface)) return false;
    // A complete employer/entity phrase after `with` remains ordinary
    // relationship prose. Do not relabel a token inside `Rust Labs` as tool
    // authority, but require a manifest fact for any actual tool surface.
    return relation.kind !== 'with' || !snapshot.entityLocks
      .filter((lock) => lock.kind === 'entity' || lock.kind === 'role' || lock.kind === 'employer')
      .some((lock) => normalizeSummaryV3StyleText(lock.value).toLocaleLowerCase()
        === normalizeSummaryV3StyleText(relation.relationSurface).toLocaleLowerCase());
  });
}

function sourceRelationLeadingCasedAnchor(value: string): string | null {
  const token = /^\s*(\p{Lu}[\p{L}\p{N}]*)/u.exec(normalizeSummaryV3StyleText(value))?.[1];
  return token ? token.toLocaleLowerCase() : null;
}

function looselyEquivalentManifestRelationAnchor(anchor: string, manifestAnchors: ReadonlySet<string>): boolean {
  if (manifestAnchors.has(anchor)) return true;
  // This is only a small inflection tolerance for a source fact already
  // supported by neighboring manifest vocabulary (`build` / `builds`). It is
  // not a synonym table and cannot authorize a distinct material noun.
  const stem = anchor.replace(/(?:ing|ed|es|s)$/iu, '');
  return stem.length >= 3 && Array.from(manifestAnchors).some((candidate) =>
    candidate.replace(/(?:ing|ed|es|s)$/iu, '') === stem);
}

/**
 * A non-empty source cannot gain a new narrow named-tool relation. A
 * capitalized source employer/entity can appear after `with` in ordinary
 * prose, but only its complete exact visible identity is exempt. A token
 * embedded inside a longer employer (`Rust` inside `Rust Labs`) cannot be
 * relabeled as a tool merely because that token occurs in source material.
 */
function hasUnsupportedCandidateNamedToolSurface(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  const sourceUseSurfaces = new Set(namedToolRelationSurfaces(snapshot.sourceSummary)
    .filter((relation) => relation.kind === 'use')
    .map((relation) => relation.surface));
  const sourceEntitySurfaces = new Set(snapshot.entityLocks
    .filter((lock) => lock.kind === 'entity' || lock.kind === 'role' || lock.kind === 'employer')
    .map((lock) => normalizeSummaryV3StyleText(lock.value).toLocaleLowerCase()));
  const sourceWithRelationSurfaces = new Set(namedToolRelationSurfaces(snapshot.sourceSummary)
    .filter((relation) => relation.kind === 'with')
    .map((relation) => normalizeSummaryV3StyleText(relation.relationSurface).toLocaleLowerCase()));
  return namedToolRelationSurfaces(candidateText).some((relation) => relation.kind === 'use'
    ? !sourceUseSurfaces.has(relation.surface)
    : !sourceEntitySurfaces.has(normalizeSummaryV3StyleText(relation.relationSurface).toLocaleLowerCase())
      && !sourceWithRelationSurfaces.has(normalizeSummaryV3StyleText(relation.relationSurface).toLocaleLowerCase()));
}

function hasRoleLocalSourceDurationContradiction(snapshot: SummaryV3StyleOperationSnapshot): boolean {
  const entryIdentityAppearsInSource = (entry: SummaryV3StyleOperationSnapshot['selectedEntries'][number]): boolean => {
    return summaryV3StyleIdentityClauses(snapshot.sourceSummary)
      .some((clause) => exactEntryIdsInSummaryV3StyleClause(snapshot, clause).has(entry.stableId));
  };
  for (const clause of semanticRelationClauses(snapshot.sourceSummary)) {
    const durationMonths = summaryV3StyleFactAnchorTokens(clause)
      .filter((token) => token.startsWith('span:'))
      .map(summaryV3StyleDurationMonthsFromSemanticSpan)
      .filter((value): value is number => value !== null);
    if (durationMonths.length === 0) continue;
    const matchedEntryIds = exactEntryIdsInSummaryV3StyleClause(snapshot, clause);
    const matchedEntries = snapshot.selectedEntries.filter((entry) => matchedEntryIds.has(entry.stableId));
    // With more than one Experience entry, a duration sentence that names no
    // role/employer is only safe when exactly one entry has that duration and
    // that same entry is explicitly identified elsewhere in the source. This
    // permits an ordinary current-role introduction followed by `She ... for
    // 24 months`, while still rejecting a free-standing duration that could be
    // borrowed from a different Experience entry.
    if (matchedEntries.length === 0) {
      if (snapshot.selectedEntries.length > 1) {
        const durationEntries = snapshot.selectedEntries.filter((entry) =>
          durationMonths.some((value) => value === entry.durationMonths));
        if (durationEntries.length !== 1 || !entryIdentityAppearsInSource(durationEntries[0]!)) return true;
      }
      continue;
    }
    if (matchedEntries.length !== 1 || durationMonths.some((value) => value !== matchedEntries[0]!.durationMonths)) return true;
  }
  return false;
}

/**
 * The future page owner may explicitly label visible role/employer facts.
 * Those labels are trusted provenance, not prose inference: each must map to
 * one selected manifest identity, and a source clause that names both must
 * map to the same entry. Untyped source prose remains evaluator-owned.
 */
function hasExplicitSourceIdentityInconsistency(snapshot: SummaryV3StyleOperationSnapshot): boolean {
  const explicit = snapshot.requiredFacts
    .filter((fact) => fact.origin === 'visible_summary'
      && (fact.semanticKind === 'role' || fact.semanticKind === 'employer'));
  if (explicit.length === 0) return false;
  const identities = exactEntryIdentitySurfaces(snapshot);
  const entryIdsFor = (kind: 'role' | 'employer', text: string): ReadonlySet<string> => new Set(identities
    .filter((identity) => identity.kind === kind
      && normalizeSummaryV3StyleText(identity.value).toLocaleLowerCase()
        === normalizeSummaryV3StyleText(text).toLocaleLowerCase())
    .map((identity) => identity.entryId));
  if (explicit.some((fact) => entryIdsFor(fact.semanticKind as 'role' | 'employer', fact.text).size === 0)) return true;
  for (const clause of summaryV3StyleIdentityClauses(snapshot.sourceSummary)) {
    const roles = explicit.filter((fact) => fact.semanticKind === 'role'
      && summaryV3StyleContainsExactSurface(clause, fact.text));
    const employers = explicit.filter((fact) => fact.semanticKind === 'employer'
      && summaryV3StyleContainsExactSurface(clause, fact.text));
    for (const role of roles) {
      for (const employer of employers) {
        const roleEntries = entryIdsFor('role', role.text);
        const employerEntries = entryIdsFor('employer', employer.text);
        if (!Array.from(roleEntries).some((entryId) => employerEntries.has(entryId))) return true;
      }
    }
  }
  return false;
}

/**
 * Decide the bounded role/employer identity relation for one overt role frame.
 * Exact source or validated entry-owned presentation surfaces are equivalent;
 * a known role belonging to another entry or same-locale mismatch is a real
 * contradiction. A different locale without validated presentation evidence
 * is unresolved and remains evaluator-owned, never silently accepted.
 */
function roleEmployerFrameDecision(
  snapshot: SummaryV3StyleOperationSnapshot,
  roleSurface: string,
  employerSurface: string,
): SummaryV3StyleRoleIdentityDecision {
  const identities = exactEntryIdentitySurfaces(snapshot);
  if (snapshot.mode !== 'enhance_existing_content') return { status: 'not_assessed', selectedEntryId: null };
  const normalizeEmployerIdentity = (value: string): string => normalizeSummaryV3StyleText(value)
    .toLocaleLowerCase()
    // The bounded corporate suffix grammar leaves a terminal organization
    // period as sentence punctuation (`Atlas, Inc.`), rather than making it
    // part of the identity capture. It is not a different employer claim.
    .replace(/\.$/u, '');
  const normalizedRole = normalizeSummaryV3StyleText(roleSurface).toLocaleLowerCase();
  const normalizedEmployer = normalizeEmployerIdentity(employerSurface);
  const employerEntries = snapshot.selectedEntries.filter((entry) => (
    normalizeEmployerIdentity(identities.find((identity) => identity.entryId === entry.stableId && identity.kind === 'employer')?.value || '')
      === normalizedEmployer
  ));
  const currentEntry = snapshot.currentRoleEntryId
    ? snapshot.selectedEntries.find((entry) => entry.stableId === snapshot.currentRoleEntryId) || null
    : null;
  const currentEmployerMatches = Boolean(currentEntry && employerEntries.some((entry) => entry.stableId === currentEntry!.stableId));
  if (!currentEmployerMatches) return { status: 'contradiction', selectedEntryId: null };
  const exactRoleEntryIds = new Set(identities
    .filter((identity) => identity.kind === 'role' && identity.normalizedValue === normalizedRole)
    .map((identity) => identity.entryId));
  if (exactRoleEntryIds.has(currentEntry!.stableId)) {
    return { status: 'equivalent', selectedEntryId: currentEntry!.stableId };
  }
  // Japanese identity frames conventionally use a bounded role suffix
  // (`エンジニア`) for a compound manifest role (`ソフトウェアエンジニア`).
  // Preserve that previously validated locale-specific equivalence without
  // turning generic cross-locale token overlap into identity authority.
  if (snapshot.requestedLocale === 'ja') {
    const suffixForEmployer = employerEntries.filter((entry) => {
      const role = identities.find((identity) => identity.entryId === entry.stableId && identity.kind === 'role')?.normalizedValue || '';
      return normalizedRole.length >= 2 && role.endsWith(normalizedRole);
    });
    if (suffixForEmployer.length === 1) {
      return { status: 'equivalent', selectedEntryId: suffixForEmployer[0]!.stableId };
    }
  }
  // A role that is exact for another entry is never borrowed through a shared
  // employer or aggregate manifest vocabulary.
  if (exactRoleEntryIds.size > 0) return { status: 'contradiction', selectedEntryId: null };

  const sourceRoleLocale = canonicalSummaryV3StyleLocale(detectRoleLabelSourceLocale(roleSurface))
    || snapshot.requestedLocale;
  const matchingRoleLocale = [currentEntry]
    .filter((entry): entry is NonNullable<typeof currentEntry> => Boolean(entry))
    .map((entry) => canonicalSummaryV3StyleLocale(entry.roleSourceLocale || '')
      || canonicalSummaryV3StyleLocale(detectRoleLabelSourceLocale(
        identities.find((identity) => identity.entryId === entry.stableId && identity.kind === 'role')?.value || '',
      ))
      || snapshot.requestedLocale);
  if (matchingRoleLocale.some((locale) => locale !== sourceRoleLocale)) {
    return { status: 'unresolved', selectedEntryId: currentEntry!.stableId };
  }
  return { status: 'contradiction', selectedEntryId: null };
}

/**
 * Optional page annotations are not the only identity evidence. A compact,
 * direct role/employer frame in the visible source is itself a
 * manifest-validation claim. Keep this deliberately bounded: native/other
 * forms remain evaluator-owned, while an overt mismatch is rejected only
 * when it is a proven contradiction.
 */
function roleEmployerIdentityDecision(
  snapshot: SummaryV3StyleOperationSnapshot,
  text = snapshot.sourceSummary,
): SummaryV3StyleRoleIdentityDecision {
  if (snapshot.mode !== 'enhance_existing_content') return { status: 'not_assessed', selectedEntryId: null };
  const identities = exactEntryIdentitySurfaces(snapshot);
  const hasIdentity = snapshot.selectedEntries.some((entry) => (
    identities.some((identity) => identity.entryId === entry.stableId && identity.kind === 'role')
    && identities.some((identity) => identity.entryId === entry.stableId && identity.kind === 'employer')
  ));
  if (!hasIdentity) return { status: 'not_assessed', selectedEntryId: null };
  const casedToken = "[\\p{Lu}][\\p{L}\\p{N}&/'’+#-]*";
  const casedSurface = `${casedToken}(?:\\s+${casedToken}){0,4}`;
  // The overt English identity grammar is the guard. Role and employer
  // surfaces themselves may be normally lowercase (`data scientist at atlas`)
  // and a bounded corporate suffix is part of an employer identity, not a
  // sentence delimiter (`Atlas, Inc.`).
  const identityToken = "[\\p{L}][\\p{L}\\p{N}&/'’+#-]*";
  const roleSurface = `${identityToken}(?:\\s+${identityToken}){0,5}?`;
  const employerToken = "[\\p{L}\\p{N}][\\p{L}\\p{N}&/'’+#-]*";
  const employerCoreSurface = `${employerToken}(?:\\s+${employerToken}){0,4}?`;
  const corporateSuffix = '(?:Inc\\.|Incorporated|LLC|L\\.L\\.C\\.|Ltd\\.|Limited|Corp\\.|Corporation|Co\\.|Company|GmbH|AG|PLC|P\\.L\\.C\\.|S\\.A\\.|S\\.p\\.A\\.|B\\.V\\.|Inc|Ltd|Corp|Co|P\\.L\\.C|S\\.A|S\\.p\\.A|B\\.V)';
  const employerSurface = `(?:${employerCoreSurface},\\s+${corporateSuffix}|${employerCoreSurface}(?!,\\s+${corporateSuffix}))`;
  const directFrame = new RegExp(
    `\\b(?:(?:is|was|am|are)\\s+(?:an?\\s+)?|(?:works?|worked|serves?|served)\\s+as\\s+(?:an?\\s+)?)(${roleSurface})\\s+(?:at|with)\\s+(${employerSurface})(?=$|[.!?。！？।,;:]|\\s+(?:for|from|since|who|where|while|and|but|with|on|during|after|before)\\b)`,
    'gu',
  );
  const appositionalFrame = new RegExp(
    `(?:^|[.!?。！？।]\\s*)${casedSurface},\\s*(?:an?\\s+)?(${roleSurface})\\s+(?:at|with)\\s+(${employerSurface})(?=$|[.!?。！？।,;:]|\\s+(?:for|from|since|who|where|while|and|but|with|on|during|after|before)\\b)`,
    'gu',
  );
  const source = normalizeSummaryV3StyleText(text);
  const literalRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const frames = [
    ...Array.from(source.matchAll(directFrame)),
    ...Array.from(source.matchAll(appositionalFrame)),
  ].map((match) => ({ role: match[1] || '', employer: match[2] || '' }));
  if (frames.length > 0) {
    const decisions = frames.map((frame) => roleEmployerFrameDecision(snapshot, frame.role, frame.employer));
    if (decisions.some((decision) => decision.status === 'contradiction')) return { status: 'contradiction', selectedEntryId: null };
    if (decisions.some((decision) => decision.status === 'unresolved')) return { status: 'unresolved', selectedEntryId: decisions.find((decision) => decision.selectedEntryId)?.selectedEntryId || null };
    return { status: 'equivalent', selectedEntryId: decisions.find((decision) => decision.selectedEntryId)?.selectedEntryId || null };
  }
  // These are deliberately small, direct locale grammars—not a general
  // classifier. They use an exact manifest employer and an overt local role
  // frame, so an unannotated contradictory source never gains safe-no-op
  // authority. Other natural-language forms remain evaluator-owned.
  const localeSource = source.toLocaleLowerCase();
  const localizedFrames = (patternForEmployer: (employer: string) => RegExp): Array<{ role: string; employer: string }> =>
    snapshot.selectedEntries.flatMap((entry) => {
      const employer = identities.find((identity) => identity.entryId === entry.stableId && identity.kind === 'employer')?.value || '';
      if (!employer) return [];
      return Array.from(localeSource.matchAll(patternForEmployer(employer)), (match) => ({ role: match[1] || '', employer }));
    });
  const decideLocalizedFrames = (framesForLocale: Array<{ role: string; employer: string }>): SummaryV3StyleRoleIdentityDecision => {
    if (framesForLocale.length === 0) return { status: 'not_assessed', selectedEntryId: null };
    const decisions = framesForLocale.map((frame) => roleEmployerFrameDecision(snapshot, frame.role, frame.employer));
    if (decisions.some((decision) => decision.status === 'contradiction')) return { status: 'contradiction', selectedEntryId: null };
    if (decisions.some((decision) => decision.status === 'unresolved')) return { status: 'unresolved', selectedEntryId: decisions.find((decision) => decision.selectedEntryId)?.selectedEntryId || null };
    return { status: 'equivalent', selectedEntryId: decisions.find((decision) => decision.selectedEntryId)?.selectedEntryId || null };
  };
  const localeRoleSurface = '[\\p{L}\\p{M}\\p{N}ー #+.-]{1,64}?';
  if (snapshot.requestedLocale === 'ja') {
    return decideLocalizedFrames(localizedFrames((employer) => new RegExp(`${literalRegex(employer)}の(${localeRoleSurface})として`, 'giu')));
  }
  if (snapshot.requestedLocale === 'de') {
    return decideLocalizedFrames(localizedFrames((employer) => new RegExp(`\\b(?:ist|war)\\s+(?:ein(?:e|en|em|er)?\\s+)?(${localeRoleSurface})\\s+(?:bei|in)\\s+${literalRegex(employer)}(?=$|[.!?])`, 'giu')));
  }
  if (snapshot.requestedLocale === 'sr') {
    return decideLocalizedFrames(localizedFrames((employer) => new RegExp(`\\bje\\s+(${localeRoleSurface})\\s+u\\s+${literalRegex(employer)}(?:[a-zčćđšž]{0,3})?(?=$|[.!?])`, 'giu')));
  }
  if (snapshot.requestedLocale === 'hi') {
    const hindiRoleToken = '[\\p{L}\\p{M}\\p{N}ー#+.-]+';
    const hindiDirectRoleSurface = `${hindiRoleToken}(?:\\s+${hindiRoleToken}){0,4}?`;
    return decideLocalizedFrames(localizedFrames((employer) => new RegExp(`${literalRegex(employer)}\\s+में\\s+(${hindiDirectRoleSurface})\\s+(?:है|हैं|था|थी|थे)`, 'giu')));
  }
  if (snapshot.requestedLocale === 'ar') {
    return decideLocalizedFrames(localizedFrames((employer) => new RegExp(`(?:^|[.!?؟]\\s*)[\\p{Script=Arabic}\\p{M}]{2,}\\s+(${localeRoleSurface})\\s+في\\s+${literalRegex(employer)}(?=$|[.!?؟])`, 'giu')));
  }
  return { status: 'not_assessed', selectedEntryId: null };
}

function hasUnannotatedSourceRoleEmployerFrameInconsistency(snapshot: SummaryV3StyleOperationSnapshot): boolean {
  return roleEmployerIdentityDecision(snapshot).status === 'contradiction';
}

/**
 * A non-empty Summary is its own transformation authority, but an overt
 * metric/authority claim absent from the immutable CV manifest is internally
 * inconsistent and must not become a safe no-op or a repairable rewrite.
 * Numeric membership alone is deliberately insufficient: `20%` and `24`
 * elsewhere in a manifest do not authorize `revenue by 24% over 20 months`.
 */
function hasUnsupportedSourceInconsistency(snapshot: SummaryV3StyleOperationSnapshot): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  if (hasExplicitSourceIdentityInconsistency(snapshot)) return true;
  if (hasUnannotatedSourceRoleEmployerFrameInconsistency(snapshot)) return true;
  if (hasUnsupportedSourceNonnumericMaterialResultRelation(snapshot)) return true;
  const manifestText = snapshot.manifestFacts.map((fact) => fact.text).join(' ');
  const manifestNumbers = new Set(numericTokens(manifestText));
  const sourceNumbers = numericTokensOutsideValidatedStructuredDurationSurfaces(snapshot, snapshot.sourceSummary, true);
  if (sourceNumbers.some((number) => !manifestNumbers.has(number))) return true;
  if (hasRoleLocalSourceDurationContradiction(snapshot)) return true;
  const manifestSemanticClaims = new Set(snapshot.manifestFacts
    .flatMap((fact) => summaryV3StyleFactAnchorTokens(fact.text))
    .filter((token) => token.startsWith('span:')));
  const sourceSemanticClaims = summaryV3StyleFactAnchorTokens(snapshot.sourceSummary)
    .filter((token) => token.startsWith('span:'));
  if (sourceSemanticClaims.some((claim) => !manifestSemanticClaims.has(claim)
    && !isStructuredDurationSemanticSpan(claim, snapshot))) return true;
  const manifestRelationAnchors = new Set(snapshot.manifestFacts
    .flatMap((fact) => summaryV3StyleFactAnchorTokens(fact.text)));
  const identityAnchors = new Set(snapshot.entityLocks
    .flatMap((lock) => summaryV3StyleFactAnchorTokens(lock.value)));
  for (const sourceRelationClause of semanticRelationClauses(snapshot.sourceSummary)) {
    const relationSpans = summaryV3StyleFactAnchorTokens(sourceRelationClause).filter((token) => token.startsWith('span:'));
    const keywords = numericOrCurrencyRelationKeywordsOutsideValidatedStructuredDurationSurfaces(
      snapshot,
      sourceRelationClause,
    );
    // Equivalent structured duration permits only its own exact span. A
    // source-only `revenue` relation must still prove itself against one
    // immutable manifest fact rather than disappearing with the duration.
    if (relationSpans.every((span) => isStructuredDurationSemanticSpan(span, snapshot)) && keywords.length === 0) continue;
    const leadingCasedAnchor = sourceRelationLeadingCasedAnchor(sourceRelationClause);
    const unmanifestedTerms = keywords.filter((keyword) =>
      !identityAnchors.has(keyword)
      && keyword !== leadingCasedAnchor
      && !looselyEquivalentManifestRelationAnchor(keyword, manifestRelationAnchors));
    // A visible predicate may differ morphologically or grammatically across
    // the supported source locales. Keep that multilingual quality judgment
    // evaluator-owned, but never let a directly material numeric-relation
    // noun such as `revenue` become source authority merely by sharing a
    // structured duration with a manifest entry.
    if (unmanifestedTerms.some((term) => MATERIAL_NUMERIC_RELATION_TERMS.has(term))) return true;
  }
  const explicitSourceTools = snapshot.requiredFacts.filter((fact) => fact.origin === 'visible_summary' && fact.semanticKind === 'tool');
  if (explicitSourceTools.some((fact) => !manifestHasExactNamedToolAuthority(snapshot, fact.text))) return true;
  if (hasUnmanifestedNamedSourceToolSurface(snapshot)) return true;
  const manifestAuthority = new Set(authorityTerms(manifestText));
  return authorityTerms(snapshot.sourceSummary).some((term) => !manifestAuthority.has(term));
}

function semanticSpanHasEquivalentSourceAuthority(
  candidateSpan: string,
  sourceSpans: ReadonlySet<string>,
): boolean {
  if (sourceSpans.has(candidateSpan)) return true;
  const candidateDuration = summaryV3StyleDurationMonthsFromSemanticSpan(candidateSpan);
  return candidateDuration !== null && Array.from(sourceSpans)
    .some((sourceSpan) => summaryV3StyleDurationMonthsFromSemanticSpan(sourceSpan) === candidateDuration);
}

/**
 * A Stronger predicate may be replaced once in a direct subject-first
 * relation, including when it appears near a supported duration. The
 * replacement must retain the immediate next source material token; this
 * allows `builds APIs` → `engineers APIs`, but not `generates revenue ...`.
 * An explicit marked duty narrows that replacement to its declared anchor.
 */
function candidateRelationUsesMarkedPredicateReplacement(
  snapshot: SummaryV3StyleOperationSnapshot,
  sourceRelation: string,
  candidateRelation: string,
  unmatchedKeywords: readonly string[],
  allowUnmarkedDirectSuccessor = false,
): boolean {
  if (snapshot.style !== 'stronger' || unmatchedKeywords.length !== 1) return false;
  const markedAnchor = snapshot.transformableDuty
    ? summaryV3StyleFactAnchorTokens(snapshot.transformableDuty.predicateAnchor)
      .find((token) => !token.startsWith('span:'))
    : null;
  const sourceTokens = summaryV3StyleFactAnchorTokens(sourceRelation)
    .filter((token) => !token.startsWith('span:'));
  const candidateTokens = summaryV3StyleFactAnchorTokens(candidateRelation)
    .filter((token) => !token.startsWith('span:'));
  const replacementIndex = candidateTokens.indexOf(unmatchedKeywords[0]!);
  const successor = replacementIndex >= 0 ? candidateTokens[replacementIndex + 1] : null;
  if (!successor) return false;
  const sourceDurationSpans = summaryV3StyleFactAnchorTokens(sourceRelation)
    .filter((token) => token.startsWith('span:'));
  const candidateDurationSpans = summaryV3StyleFactAnchorTokens(candidateRelation)
    .filter((token) => token.startsWith('span:'));
  const sourceDurationOnly = sourceDurationSpans.length > 0
    && sourceDurationSpans.every((span) => isStructuredDurationSemanticSpan(span, snapshot));
  const candidateDurationOnly = candidateDurationSpans.length > 0
    && candidateDurationSpans.every((span) => isStructuredDurationSemanticSpan(span, snapshot));
  if (markedAnchor) {
    const sourceOrderedTokens = summaryV3StyleOrderedFactTokens(sourceRelation);
    const candidateOrderedTokens = summaryV3StyleOrderedFactTokens(candidateRelation);
    return sourceOrderedTokens.some((token, sourceIndex) => {
      if (token !== markedAnchor) return false;
      const sourceSuccessor = sourceOrderedTokens[sourceIndex + 1];
      if (!sourceSuccessor) return false;
      return candidateOrderedTokens.some((candidateToken, candidateIndex) => {
        if (candidateToken !== unmatchedKeywords[0]!) return false;
        if (candidateOrderedTokens[candidateIndex + 1] === sourceSuccessor) return true;
        // A marked predicate can expand into one source-attested grammatical
        // bridge only when that exact bridge-successor pair already occurs in
        // the same source relation. This supports inflected forms such as a
        // Hindi auxiliary while keeping a new material pair (`generates
        // revenue`) outside the local semantic ceiling.
        const bridge = candidateOrderedTokens[candidateIndex + 1];
        return !!bridge
          && candidateOrderedTokens[candidateIndex + 2] === sourceSuccessor
          && sourceOrderedTokens.some((sourceToken, index) =>
            sourceToken === bridge && sourceOrderedTokens[index + 1] === sourceSuccessor);
      });
    });
  }
  const sourceAnchorIndex = sourceTokens.findIndex((token, index) =>
    token !== unmatchedKeywords[0]!
    && sourceTokens[index + 1] === successor
    // The unannotated fallback remains deliberately tiny: only the first
    // lexical predicate in a relation whose sole numeric semantics are an
    // equivalent structured duration may change. The material-result caller
    // may additionally allow that exact direct-successor replacement only
    // after proving every result noun is already source-attested.
    && index === 0
    && ((sourceDurationOnly && candidateDurationOnly) || allowUnmarkedDirectSuccessor));
  return sourceAnchorIndex >= 0 && replacementIndex >= 0;
}

/**
 * The non-empty source is the candidate's metric/tool authority.  Preserve
 * exact semantic spans (or the same structured duration) and require every
 * numeric/currency relation to remain grounded in a source relation clause.
 * This closes `$20`/`20% revenue` additions that reuse an existing numeral.
 */
function hasUnattestedNonnumericMaterialResultRelation(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  // A candidate relation carrying an unambiguous result noun must be grounded
  // in one source relation. In particular, one allowed Stronger predicate
  // substitution cannot introduce an extra result object (`builds APIs` ->
  // `generates revenue with APIs`).
  const sourceMaterialResultRelations = materialResultRelationClauses(snapshot.sourceSummary);
  for (const candidateRelation of materialResultRelationClauses(candidateText)
    // Numeric/currency material relations retain the existing post-evaluator
    // evidence path below; this early boundary is specifically for the
    // otherwise invisible nonnumeric-result injection.
    .filter((relation) => !/\p{N}+(?:[.,٫]\p{N}+)?/u.test(relation) && !/\p{Sc}/u.test(relation))) {
    const candidateMaterialTerms = summaryV3StyleFactAnchorTokens(candidateRelation)
      .filter((token) => MATERIAL_RESULT_RELATION_TERMS.has(token));
    const candidateKeywords = materialResultRelationKeywords(candidateRelation);
    const relationIsGrounded = sourceMaterialResultRelations.some((sourceRelation) => {
      const sourceRelationAnchors = new Set(summaryV3StyleFactAnchorTokens(sourceRelation));
      const unmatchedKeywords = candidateKeywords.filter((keyword) => !sourceRelationAnchors.has(keyword));
      return candidateMaterialTerms.every((term) => sourceRelationAnchors.has(term))
        && (unmatchedKeywords.length === 0 || candidateRelationUsesMarkedPredicateReplacement(
          snapshot,
          sourceRelation,
          candidateRelation,
          unmatchedKeywords,
          true,
        ));
    });
    if (!relationIsGrounded) return true;
  }
  return false;
}

/**
 * A visible source remains the transformation floor, but it cannot carry an
 * unmanifested result claim into a safe no-op. Require every nonnumeric
 * material-result relation to be attested together in one immutable manifest
 * relation; ordinary language quality stays evaluator-owned.
 */
function hasUnsupportedSourceNonnumericMaterialResultRelation(
  snapshot: SummaryV3StyleOperationSnapshot,
): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  const manifestRelations = materialResultRelationClauses(snapshot.manifestFacts.map((fact) => fact.text).join('. '));
  for (const sourceRelation of materialResultRelationClauses(snapshot.sourceSummary)
    .filter((relation) => !/\p{N}+(?:[.,٫]\p{N}+)?/u.test(relation) && !/\p{Sc}/u.test(relation))) {
    const sourceMaterialTerms = summaryV3StyleFactAnchorTokens(sourceRelation)
      .filter((token) => SOURCE_MATERIAL_RESULT_CEILING_TERMS.has(token));
    if (sourceMaterialTerms.length === 0) continue;
    const sourceKeywords = materialResultRelationKeywords(sourceRelation);
    const grounded = manifestRelations.some((manifestRelation) => {
      const manifestAnchors = new Set(summaryV3StyleFactAnchorTokens(manifestRelation));
      return sourceMaterialTerms.every((term) => manifestAnchors.has(term))
        && sourceKeywords.every((keyword) => looselyEquivalentManifestRelationAnchor(keyword, manifestAnchors));
    });
    if (!grounded) return true;
  }
  return false;
}

function hasUnsupportedCandidateSemanticMaterial(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  const sourceSpans = new Set(summaryV3StyleFactAnchorTokens(snapshot.sourceSummary)
    .filter((token) => token.startsWith('span:')));
  const candidateSpans = summaryV3StyleFactAnchorTokens(candidateText)
    .filter((token) => token.startsWith('span:'));
  if (candidateSpans.some((span) => !semanticSpanHasEquivalentSourceAuthority(span, sourceSpans))) return true;
  if (hasUnattestedNonnumericMaterialResultRelation(snapshot, candidateText)) return true;
  const sourceRelations = numericOrCurrencyRelationClauses(snapshot.sourceSummary);
  for (const candidateRelation of numericOrCurrencyRelationClauses(candidateText)) {
    const relationSpans = summaryV3StyleFactAnchorTokens(candidateRelation)
      .filter((token) => token.startsWith('span:'));
    const relationKeywords = numericOrCurrencyRelationKeywordsOutsideValidatedStructuredDurationSurfaces(
      snapshot,
      candidateRelation,
    );
    const relationIsGrounded = sourceRelations.some((sourceRelation) => {
      const sourceRelationSpans = new Set(summaryV3StyleFactAnchorTokens(sourceRelation)
        .filter((token) => token.startsWith('span:')));
      const sourceRelationAnchors = new Set(summaryV3StyleFactAnchorTokens(sourceRelation));
      const unmatchedKeywords = relationKeywords.filter((keyword) => !sourceRelationAnchors.has(keyword));
      return relationSpans.every((span) => semanticSpanHasEquivalentSourceAuthority(span, sourceRelationSpans))
        && (unmatchedKeywords.length === 0
          // Shorter predicate wording is deliberately evaluator-owned once
          // immutable numeric/duration authority is intact. Numeric result
          // nouns remain a deterministic local ceiling.
          || (snapshot.style === 'shorter'
            && !unmatchedKeywords.some((keyword) => MATERIAL_NUMERIC_RELATION_TERMS.has(keyword)))
          || candidateRelationUsesMarkedPredicateReplacement(
            snapshot,
            sourceRelation,
            candidateRelation,
            unmatchedKeywords,
          ));
    });
    if (!relationIsGrounded) return true;
  }
  return false;
}

function hasInjectedManifestFact(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  return snapshot.manifestFacts.some((fact) => {
    return factSurfaceIsPresent(fact.text, candidateText)
      && !factSurfaceIsPresent(fact.text, snapshot.sourceSummary);
  });
}

/** Local hard rejections run before any evaluator-directed repair decision. */
interface LocalHardDecision {
  readonly reason: Extract<SummaryV3StyleFailureReason, 'unsupported_claim' | 'lost_source_fact'> | null;
  readonly predicate: SummaryStyleHardPredicate | null;
}

function localHardRejectionDecision(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): LocalHardDecision {
  // Language/native surface has the more specific typed terminal. Let the
  // regular local style guard classify it before considering ceiling facts.
  if (!summaryV3StyleLocaleSurfaceMatches(candidateText, snapshot.requestedLocale)
    || !summaryV3StyleLocaleContentMatches(candidateText, snapshot.requestedLocale)) return { reason: null, predicate: null };
  // A visible source employment relation is a source fact in its own right.
  // Preserve it independently from contradiction: neutral wording is not an
  // opposite relation, but it cannot silently erase an explicit source state.
  if (employmentSourceStatePreservationFailure(snapshot, candidateText)) return { reason: 'lost_source_fact', predicate: null };
  // The same ordered short-circuit execution returns both reason and winner.
  if (hasUnsupportedSourceInconsistency(snapshot)) return { reason: 'unsupported_claim', predicate: 'unsupported_source_inconsistency' };
  if (hasInjectedManifestFact(snapshot, candidateText)) return { reason: 'unsupported_claim', predicate: 'injected_manifest_fact' };
  if (hasUnsupportedAuthorityOrSeniority(snapshot, candidateText)) return { reason: 'unsupported_claim', predicate: 'unsupported_authority_or_seniority' };
  if (hasUnsupportedNumericMetric(snapshot, candidateText)) return { reason: 'unsupported_claim', predicate: 'unsupported_numeric_metric' };
  if (hasUnsupportedCandidateSemanticMaterial(snapshot, candidateText)) return { reason: 'unsupported_claim', predicate: 'unsupported_candidate_semantic_material' };
  if (hasUnsupportedCandidateNamedToolSurface(snapshot, candidateText)) return { reason: 'unsupported_claim', predicate: 'unsupported_named_tool_surface' };
  if (hasEmploymentStateContradiction(snapshot, candidateText)) return { reason: 'unsupported_claim', predicate: 'employment_state_contradiction' };
  return { reason: null, predicate: null };
}

function localHardRejection(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
  observe?: (decision: LocalHardDecision) => void,
): LocalHardDecision['reason'] {
  const decision = localHardRejectionDecision(snapshot, candidateText);
  observe?.(decision);
  return decision.reason;
}

function styleContentTokens(value: string): ReadonlySet<string> {
  return new Set(summaryV3StyleFactAnchorTokens(value)
    .filter((token) => !token.startsWith('span:'))
    .filter((token) => /\p{N}/u.test(token) || (token.length >= 2 && !STYLE_CONTENT_STOP_WORDS.has(token))));
}

function hasGroundedPredicateTransformation(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  const sourceTokens = styleContentTokens(snapshot.sourceSummary);
  const candidateTokens = styleContentTokens(candidateText);
  const markedPredicate = snapshot.transformableDuty
    ? summaryV3StyleFactAnchorTokens(snapshot.transformableDuty.predicateAnchor)
      .find((token) => !token.startsWith('span:'))
    : null;
  if (markedPredicate && !candidateTokens.has(markedPredicate)
    && Array.from(candidateTokens).some((token) => !sourceTokens.has(token))) return true;
  return Array.from(sourceTokens).some((token) => !candidateTokens.has(token))
    && Array.from(candidateTokens).some((token) => !sourceTokens.has(token));
}

/**
 * Stronger may foreground an explicitly trusted, manifest-supported
 * achievement without replacing a duty predicate. The source achievement
 * anchors must stay intact and move into a materially different order; a
 * decorative adjective therefore cannot satisfy this bounded branch.
 */
function hasGroundedAchievementFraming(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  if (snapshot.mode !== 'enhance_existing_content') return false;
  const candidateTokens = new Set(summaryV3StyleFactAnchorTokens(candidateText));
  const manifestTokens = new Set(snapshot.manifestFacts.flatMap((fact) => summaryV3StyleFactAnchorTokens(fact.text)));
  return snapshot.requiredFacts.some((fact) => {
    if (fact.origin !== 'visible_summary' || fact.semanticKind !== 'achievement') return false;
    const anchors = summaryV3StyleFactAnchorTokens(fact.text);
    if (anchors.length === 0 || !anchors.every((anchor) => manifestTokens.has(anchor) && candidateTokens.has(anchor))) return false;
    const anchorSet = new Set(anchors);
    const sourceOrder = summaryV3StyleFactAnchorTokens(fact.text).filter((anchor) => anchorSet.has(anchor));
    const candidateOrder = summaryV3StyleFactAnchorTokens(candidateText).filter((anchor) => anchorSet.has(anchor));
    return sourceOrder.length > 1 && sourceOrder.join('|') !== candidateOrder.join('|');
  });
}

function hasOnlyRoleIntroductionChange(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  const sourceUnits = normalizeSummaryV3StyleText(snapshot.sourceSummary).split(/(?<=[.!?。！？।])\s*/u).filter(Boolean);
  if (sourceUnits.length < 2) return false;
  const sourceBody = sourceUnits.slice(1).join(' ').toLocaleLowerCase();
  return sourceBody.length > 0 && normalizeSummaryV3StyleText(candidateText).toLocaleLowerCase().includes(sourceBody);
}

function isSingleDecorativeLexicalSwap(
  snapshot: SummaryV3StyleOperationSnapshot,
  source: string,
  candidate: string,
): boolean {
  if (countSummaryV3StyleUnits(source) !== countSummaryV3StyleUnits(candidate)
    || countSummaryV3StyleClauses(source) !== countSummaryV3StyleClauses(candidate)) return false;
  const tokens = (value: string) => new Set((normalizeSummaryV3StyleText(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
  const sourceTokens = tokens(source);
  const candidateTokens = tokens(candidate);
  const removed = Array.from(sourceTokens).filter((token) => !candidateTokens.has(token));
  const added = Array.from(candidateTokens).filter((token) => !sourceTokens.has(token));
  if (removed.length > 1 || added.length > 1 || removed.length + added.length === 0) return false;
  // Professional may replace a duty predicate, but a one-token modifier
  // inserted before the immutable role/employer frame is still a decorative
  // no-op. This bounded positional check preserves that existing guard
  // without becoming a semantic synonym matcher.
  if (snapshot.style !== 'professional' || added.length !== 1) return true;
  const normalizedCandidate = normalizeSummaryV3StyleText(candidate).toLocaleLowerCase();
  const identityIndexes = snapshot.entityLocks
    .filter((lock) => lock.kind === 'role' || lock.kind === 'employer')
    .map((lock) => normalizedCandidate.indexOf(normalizeSummaryV3StyleText(lock.value).toLocaleLowerCase()))
    .filter((index) => index >= 0);
  const addedIndex = normalizedCandidate.indexOf(added[0]!);
  const firstIdentity = identityIndexes.length > 0 ? Math.min(...identityIndexes) : Number.POSITIVE_INFINITY;
  return addedIndex >= 0 && addedIndex < firstIdentity;
}

function safeNoOpEvidenceIsConsistent(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidate: SummaryV3StyleCandidate,
  evidence: ParsedStyleEvidence,
): boolean {
  if (evidence.style === 'shorter') {
    const sourceLength = normalizedSummaryV3StyleLength(snapshot.sourceSummary);
    return evidence.shorterFulfilled && evidence.semanticCompressionOperations === 0 && evidence.factCoverage
      && evidence.sourceNormalizedLength === sourceLength && evidence.candidateNormalizedLength === candidate.normalizedLength
      && evidence.lengthDelta === 0 && evidence.lengthDeltaPercent === 0
      && evidence.sourceUnitCount === countSummaryV3StyleUnits(snapshot.sourceSummary)
      && evidence.candidateUnitCount === candidate.unitCount
      && evidence.sourceClauseCount === countSummaryV3StyleClauses(snapshot.sourceSummary)
      && evidence.candidateClauseCount === candidate.clauseCount;
  }
  if (evidence.style === 'stronger') {
    return evidence.strongerFulfilled && evidence.strongerPredicateTransformations === 0
      && evidence.structuralStrengtheningCount === 0 && !evidence.modifierOnlyTransformationDetected
      && evidence.repeatedStyleModifierCount === 0 && !evidence.stackedModifierDetected && !evidence.unsupportedAuthorityDetected;
  }
  return evidence.professionalFulfilled && evidence.professionalFramingOperations === 0
    && evidence.cohesionClarityOperations === 0 && !evidence.markerOnlyChangeDetected && !evidence.jargonOrFillerDetected;
}

function exactIdentity(value: Record<string, unknown>, snapshot: SummaryV3StyleOperationSnapshot): boolean {
  return value.operationId === snapshot.operationId
    && value.snapshotHash === snapshot.snapshotHash
    && value.manifestHash === snapshot.manifestHash
    && value.style === snapshot.style
    && canonicalSummaryV3StyleLocale(value.locale) === snapshot.requestedLocale;
}

function parseCandidateUnit(value: unknown): SummaryV3StyleCandidateUnit | null {
  if (!isSummaryV3StyleRecord(value) || !summaryV3StyleHasExactKeys(value, ['unitId', 'text', 'factIds'])) return null;
  if (!summaryV3StyleIsNonBlank(value.unitId) || !/^[A-Za-z0-9_.:-]{1,160}$/u.test(value.unitId)) return null;
  if (!summaryV3StyleIsNonBlank(value.text) || value.text.length > 12_000
    || summaryV3StyleIsMarkdownOrList(value.text)
    || summaryV3StyleHasReservedTransportMetadataPrefix(value.text)) return null;
  if (!Array.isArray(value.factIds) || value.factIds.length === 0 || value.factIds.some((factId) => !summaryV3StyleIsNonBlank(factId))) return null;
  if (new Set(value.factIds).size !== value.factIds.length) return null;
  return immutableCopy({ unitId: value.unitId, text: value.text, factIds: value.factIds }) as SummaryV3StyleCandidateUnit;
}

function candidateTransportHasProhibitedSurface(
  units: readonly SummaryV3StyleCandidateUnit[],
  candidateText: string,
): boolean {
  const unitTexts = units.map((unit) => unit.text);
  // Check the executable joined text, the physical newline-preserving unit
  // order, and every leading unit grouping. The latter closes a transport seam
  // where a plain-text heading is itself split across consecutive tool units.
  const surfaces = [candidateText, unitTexts.join('\n')];
  for (let boundary = 1; boundary < unitTexts.length; boundary += 1) {
    surfaces.push(unitTexts.slice(0, boundary).join(' ') + '\n' + unitTexts.slice(boundary).join(' '));
  }
  return surfaces.some((surface) => summaryV3StyleIsMarkdownOrList(surface)
    || summaryV3StyleHasReservedTransportMetadataPrefix(surface));
}

function classifyWriterOutputContractFailure(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidate: SummaryV3StyleCandidate,
  coverage: ReturnType<typeof summarizeSummaryV3StyleFactCoverage>,
  candidateSourceFloorInspection?: SummaryV3StyleCandidateSourceFloorInspection,
  sourceLockInspection: SummaryV3StyleSourceLockInspection = inspectSummaryV3StyleCandidatePreservesLocks(snapshot, candidate.text),
): SummaryV3StyleWriterOutputContractFailureClass | null {
  if (coverage.missingFactCount > 0) return 'required_fact_coverage';
  if (!sourceLockInspection.preserved) return 'source_lock_preservation';
  if (!summaryV3StyleCandidatePreservesCalendarDateSurfaces(snapshot, candidate.text)) return 'calendar_date_source_floor';
  // Title-cased duty nouns (for example German `Systeme`) are not immutable
  // identity locks.  In Shorter and Professional they may be paraphrased and
  // must reach the single evaluator; role/employer/duration/date and explicit
  // contradictions remain deterministic checks above and below. The exact
  // material helper itself excludes ordinary duty surfaces for Professional,
  // so this gate retains only true identity/technical hard-lock ownership.
  if ((snapshot.style === 'stronger' || snapshot.style === 'professional')
    && !summaryV3StyleCandidatePreservesExactMaterialSurfaces(snapshot, candidate.text)) return 'exact_material_source_floor';
  if (!summaryV3StyleCandidatePreservesEntityFactBindings(snapshot, candidate.text)) return 'entity_fact_binding_preservation';
  // Shorter and Professional predicate paraphrase are intentionally
  // tri-state. Only a deterministic local invalid decision may fail at the
  // writer boundary; unresolved equivalence must reach the single strict
  // evaluator. Stronger retains its established bounded local admission
  // contract because its explicit predicate transformation is style-owned.
  if (snapshot.style === 'shorter' || snapshot.style === 'professional') {
    if (summaryV3StyleLocalSemanticDecision(snapshot, candidate.text) === 'invalid') return 'candidate_source_floor';
  } else if (summaryV3StyleCandidateSourceFloorDecision(
    snapshot,
    candidate.text,
    candidateSourceFloorInspection ?? inspectSummaryV3StyleCandidateSourceFloor(snapshot, candidate.text),
  ) === 'invalid') {
    return 'candidate_source_floor';
  }
  if (!summaryV3StyleCandidateUnitsRepresentDeclaredFacts(snapshot, candidate)) return 'unit_declared_fact_binding';
  return null;
}

function parseWriterOutput(value: unknown, snapshot: SummaryV3StyleOperationSnapshot): WriterParseResult {
  if (!isSummaryV3StyleRecord(value)
    || !summaryV3StyleHasExactKeys(value, ['toolName', 'contentBlockCount', 'textBlockCount', 'toolBlockCount', 'input'])) {
    return writerFailure('writer_transport_malformed');
  }
  if (value.toolName !== SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME
    || value.contentBlockCount !== 1 || value.textBlockCount !== 0 || value.toolBlockCount !== 1
    || !isSummaryV3StyleRecord(value.input)) {
    return writerFailure('writer_transport_malformed');
  }
  const payload = value.input;
  if (!summaryV3StyleHasExactKeys(payload, ['operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'units'])) {
    return writerFailure('writer_transport_malformed');
  }
  if (!exactIdentity(payload, snapshot)) return writerFailure('writer_identity_mismatch');
  if (!Array.isArray(payload.units) || payload.units.length === 0 || payload.units.length > 64) {
    return writerFailure('candidate_malformed');
  }
  const units: SummaryV3StyleCandidateUnit[] = [];
  const unitIds = new Set<string>();
  for (const unit of payload.units) {
    const parsed = parseCandidateUnit(unit);
    if (!parsed || unitIds.has(parsed.unitId)) return writerFailure('candidate_malformed');
    unitIds.add(parsed.unitId);
    units.push(parsed);
  }
  const candidate = createSummaryV3StyleCandidate(snapshot, units);
  // Validate every ordered structural view before evaluator authority. A writer
  // may split a prohibited heading or metadata fragment across valid tool
  // units; no reconstructed surface may reach evaluation.
  if (!summaryV3StyleIsNonBlank(candidate.text) || candidate.text.length > 24_000
    || candidateTransportHasProhibitedSurface(units, candidate.text)) {
    return writerFailure('candidate_malformed');
  }
  const coverage = summarizeSummaryV3StyleFactCoverage(snapshot, candidate);
  const allowedFacts = new Set(snapshot.requiredFacts.map((fact) => fact.id));
  const suppliedFacts = candidate.units.flatMap((unit) => unit.factIds);
  if (suppliedFacts.some((factId) => !allowedFacts.has(factId)) || new Set(suppliedFacts).size !== suppliedFacts.length) {
    return writerFailure('candidate_malformed');
  }
  const candidateSourceFloorInspection = snapshot.style === 'stronger'
    ? inspectSummaryV3StyleCandidateSourceFloor(snapshot, candidate.text)
    : undefined;
  const sourceLockInspection = inspectSummaryV3StyleCandidatePreservesLocks(snapshot, candidate.text);
  const writerOutputContractFailureClass = classifyWriterOutputContractFailure(
    snapshot,
    candidate,
    coverage,
    candidateSourceFloorInspection,
    sourceLockInspection,
  );
  if (writerOutputContractFailureClass) return writerFailure(
    'lost_source_fact',
    writerOutputContractFailureClass,
    candidate,
    writerOutputContractFailureClass === 'candidate_source_floor'
      ? candidateSourceFloorInspection
      : undefined,
    writerOutputContractFailureClass === 'source_lock_preservation'
      ? sourceLockInspection
      : undefined,
  );
  return immutableCopy({ ok: true, candidate });
}

type EvaluatorParserValue<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; evaluatorOutputContractFailureClass: SummaryV3StyleEvaluatorOutputContractFailureClass }>;

function evaluatorParserValueFailure(
  evaluatorOutputContractFailureClass: SummaryV3StyleEvaluatorOutputContractFailureClass,
): EvaluatorParserValue<never> {
  return immutableCopy({ ok: false as const, evaluatorOutputContractFailureClass }) as EvaluatorParserValue<never>;
}

function parseViolation(value: unknown): EvaluatorParserValue<SummaryV3StyleViolation> {
  if (!isSummaryV3StyleRecord(value)
    || !summaryV3StyleHasExactKeys(value, ['code', 'factIdHashes', 'unitHashes', 'repairable'])
    || !isSummaryV3StyleViolationCode(value.code)
    || !Array.isArray(value.factIdHashes)
    || !Array.isArray(value.unitHashes)
    || value.factIdHashes.length > 32
    || value.unitHashes.length > 32
    || (value.factIdHashes.length === 0 && value.unitHashes.length === 0)
    || value.factIdHashes.some((hash) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80)
    || value.unitHashes.some((hash) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80)
    || typeof value.repairable !== 'boolean') {
    return evaluatorParserValueFailure('phase_violation_shape');
  }
  if (new Set(value.factIdHashes).size !== value.factIdHashes.length
    || new Set(value.unitHashes).size !== value.unitHashes.length) {
    return evaluatorParserValueFailure('phase_violation_duplicates');
  }
  return immutableCopy({
    ok: true as const,
    value: immutableCopy({
      code: value.code,
      factIdHashes: value.factIdHashes,
      unitHashes: value.unitHashes,
      repairable: value.repairable,
    }) as SummaryV3StyleViolation,
  }) as EvaluatorParserValue<SummaryV3StyleViolation>;
}

function parsePhase(
  value: unknown,
): EvaluatorParserValue<Readonly<{ status: SummaryV3StylePhaseStatus; violations: readonly SummaryV3StyleViolation[] }>> {
  if (!isSummaryV3StyleRecord(value) || !summaryV3StyleHasExactKeys(value, ['status', 'violations'])
    || (value.status !== 'passed' && value.status !== 'failed') || !Array.isArray(value.violations) || value.violations.length > 32) {
    return evaluatorParserValueFailure('phase_shape');
  }
  const violations: SummaryV3StyleViolation[] = [];
  for (const violation of value.violations) {
    const parsed = parseViolation(violation);
    if (!parsed.ok) return parsed;
    violations.push(parsed.value);
  }
  if ((value.status === 'passed' && violations.length > 0) || (value.status === 'failed' && violations.length === 0)) {
    return evaluatorParserValueFailure('phase_status_consistency');
  }
  return immutableCopy({
    ok: true as const,
    value: immutableCopy({ status: value.status, violations }) as Readonly<{
      status: SummaryV3StylePhaseStatus;
      violations: readonly SummaryV3StyleViolation[];
    }>,
  }) as EvaluatorParserValue<Readonly<{ status: SummaryV3StylePhaseStatus; violations: readonly SummaryV3StyleViolation[] }>>;
}

function parseStyleEvidence(
  value: unknown,
  snapshot: SummaryV3StyleOperationSnapshot,
): EvaluatorParserValue<ParsedStyleEvidence> {
  if (!isSummaryV3StyleRecord(value) || value.style !== snapshot.style) return evaluatorParserValueFailure('style_evidence_shape');
  if (snapshot.style === 'shorter') {
    const keys = SUMMARY_V3_STYLE_STRATEGIES.shorter.requiredEvidenceKeys;
    if (!summaryV3StyleHasExactKeys(value, keys)) return evaluatorParserValueFailure('style_evidence_shape');
    const values = [
      count(value.semanticCompressionOperations), count(value.sourceNormalizedLength), count(value.candidateNormalizedLength), signedCount(value.lengthDelta, 12_000),
      count(value.sourceUnitCount), count(value.candidateUnitCount), count(value.sourceClauseCount), count(value.candidateClauseCount),
    ];
    const lengthDeltaPercent = typeof value.lengthDeltaPercent === 'number' && Number.isFinite(value.lengthDeltaPercent)
      && value.lengthDeltaPercent >= -1 && value.lengthDeltaPercent <= 1 ? value.lengthDeltaPercent : null;
    const factCoverage = bool(value.factCoverage);
    const shorterFulfilled = bool(value.shorterFulfilled);
    const noOpDetected = bool(value.noOpDetected);
    if (values.some((item) => item === null) || lengthDeltaPercent === null || factCoverage === null || shorterFulfilled === null || noOpDetected === null) return evaluatorParserValueFailure('style_evidence_shape');
    return immutableCopy({
      ok: true as const,
      value: immutableCopy({
        style: 'shorter', semanticCompressionOperations: values[0]!, sourceNormalizedLength: values[1]!,
        candidateNormalizedLength: values[2]!, lengthDelta: values[3]!, lengthDeltaPercent, sourceUnitCount: values[4]!, candidateUnitCount: values[5]!,
        sourceClauseCount: values[6]!, candidateClauseCount: values[7]!, factCoverage, shorterFulfilled, noOpDetected,
      }) as ParsedShorterEvidence,
    }) as EvaluatorParserValue<ParsedStyleEvidence>;
  }
  if (snapshot.style === 'stronger') {
    const keys = SUMMARY_V3_STYLE_STRATEGIES.stronger.requiredEvidenceKeys;
    if (!summaryV3StyleHasExactKeys(value, keys)) return evaluatorParserValueFailure('style_evidence_shape');
    const transformationCount = count(value.strongerPredicateTransformations);
    const structuralCount = count(value.structuralStrengtheningCount);
    const repeatedCount = count(value.repeatedStyleModifierCount);
    const modifierOnly = bool(value.modifierOnlyTransformationDetected);
    const stacked = bool(value.stackedModifierDetected);
    const unsupportedAuthority = bool(value.unsupportedAuthorityDetected);
    const fulfilled = bool(value.strongerFulfilled);
    const noOpDetected = bool(value.noOpDetected);
    if ([transformationCount, structuralCount, repeatedCount, modifierOnly, stacked, unsupportedAuthority, fulfilled, noOpDetected].some((item) => item === null)) return evaluatorParserValueFailure('style_evidence_shape');
    return immutableCopy({
      ok: true as const,
      value: immutableCopy({
        style: 'stronger', strongerPredicateTransformations: transformationCount!, structuralStrengtheningCount: structuralCount!,
        modifierOnlyTransformationDetected: modifierOnly!, repeatedStyleModifierCount: repeatedCount!, stackedModifierDetected: stacked!,
        unsupportedAuthorityDetected: unsupportedAuthority!, strongerFulfilled: fulfilled!, noOpDetected: noOpDetected!,
      }) as ParsedStrongerEvidence,
    }) as EvaluatorParserValue<ParsedStyleEvidence>;
  }
  const keys = SUMMARY_V3_STYLE_STRATEGIES.professional.requiredEvidenceKeys;
  if (!summaryV3StyleHasExactKeys(value, keys)) return evaluatorParserValueFailure('style_evidence_shape');
  const framing = count(value.professionalFramingOperations);
  const cohesion = count(value.cohesionClarityOperations);
  const marker = bool(value.markerOnlyChangeDetected);
  const jargon = bool(value.jargonOrFillerDetected);
  const fulfilled = bool(value.professionalFulfilled);
  const noOpDetected = bool(value.noOpDetected);
  if ([framing, cohesion, marker, jargon, fulfilled, noOpDetected].some((item) => item === null)) return evaluatorParserValueFailure('style_evidence_shape');
  return immutableCopy({
    ok: true as const,
    value: immutableCopy({
      style: 'professional', professionalFramingOperations: framing!, cohesionClarityOperations: cohesion!,
      markerOnlyChangeDetected: marker!, jargonOrFillerDetected: jargon!, professionalFulfilled: fulfilled!, noOpDetected: noOpDetected!,
    }) as ParsedProfessionalEvidence,
  }) as EvaluatorParserValue<ParsedStyleEvidence>;
}

function parseEvaluatorOutput(
  value: unknown,
  snapshot: SummaryV3StyleOperationSnapshot,
  candidate: SummaryV3StyleCandidate,
): EvaluatorParseResult {
  if (!isSummaryV3StyleRecord(value)
    || !summaryV3StyleHasExactKeys(value, ['toolName', 'contentBlockCount', 'textBlockCount', 'toolBlockCount', 'input'])) {
    return evaluatorFailure('envelope_keyset');
  }
  if (value.toolName !== SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME
    || value.contentBlockCount !== 1 || value.textBlockCount !== 0 || value.toolBlockCount !== 1
    || !isSummaryV3StyleRecord(value.input)) {
    return evaluatorFailure('envelope_metadata');
  }
  const payload = value.input;
  if (!summaryV3StyleHasExactKeys(payload, [
    'operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'candidateHash', 'candidateUnitHashes', 'phases', 'representedFactIdHashes', 'missingFactIdHashes', 'roleIdentityResolution', 'styleEvidence',
  ])) {
    return evaluatorFailure('payload_keyset');
  }
  if (!exactIdentity(payload, snapshot)) {
    return evaluatorFailure('immutable_identity');
  }
  if (!isSummaryV3StyleRecord(payload.phases)) {
    return evaluatorFailure('phase_shape');
  }
  const candidateUnitHashes = payload.candidateUnitHashes;
  const expectedCandidateUnitHashes = candidate.units.map(summaryV3StyleCandidateUnitHash);
  if (payload.candidateHash !== candidate.hash
    || !Array.isArray(candidateUnitHashes)
    || candidateUnitHashes.length !== expectedCandidateUnitHashes.length
    || candidateUnitHashes.some((hash, index) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80 || hash !== expectedCandidateUnitHashes[index])) {
    return evaluatorFailure('candidate_identity');
  }
  const representedFactIdHashes = payload.representedFactIdHashes;
  const missingFactIdHashes = payload.missingFactIdHashes;
  const roleIdentityResolution = payload.roleIdentityResolution;
  if (!Array.isArray(representedFactIdHashes) || !Array.isArray(missingFactIdHashes)
    || representedFactIdHashes.length > 256 || missingFactIdHashes.length > 256
    || representedFactIdHashes.some((hash) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80)
    || missingFactIdHashes.some((hash) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80)) {
    return evaluatorFailure('fact_reference_shape');
  }
  if (new Set(representedFactIdHashes).size !== representedFactIdHashes.length
    || new Set(missingFactIdHashes).size !== missingFactIdHashes.length) {
    return evaluatorFailure('fact_reference_duplicates');
  }
  if (typeof roleIdentityResolution !== 'string'
    || !(SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS as readonly string[]).includes(roleIdentityResolution)) {
    return evaluatorFailure('role_identity');
  }
  const allowedFactHashes = new Set(snapshot.requiredFacts.map((fact) => fact.hash));
  if (representedFactIdHashes.some((hash) => !allowedFactHashes.has(hash))
    || missingFactIdHashes.some((hash) => !allowedFactHashes.has(hash))) {
    return evaluatorFailure('fact_reference_membership');
  }
  if (representedFactIdHashes.some((hash) => missingFactIdHashes.includes(hash))) {
    return evaluatorFailure('fact_reference_overlap');
  }
  if (new Set([...representedFactIdHashes, ...missingFactIdHashes]).size !== allowedFactHashes.size) {
    return evaluatorFailure('fact_reference_partition');
  }
  if (!summaryV3StyleHasExactKeys(payload.phases, REQUIRED_PHASES)) return evaluatorFailure('phase_keyset');
  const phases = {} as Record<SummaryV3StylePhase, Readonly<{ status: SummaryV3StylePhaseStatus; violations: readonly SummaryV3StyleViolation[] }>>;
  for (const name of REQUIRED_PHASES) {
    const phase = parsePhase(payload.phases[name]);
    if (!phase.ok) return evaluatorFailure(phase.evaluatorOutputContractFailureClass);
    const allowedUnitHashes = new Set(candidate.units.map(summaryV3StyleCandidateUnitHash));
    if (phase.value.violations.some((violation) => violation.factIdHashes.some((hash) => !allowedFactHashes.has(hash))
      || violation.unitHashes.some((hash) => !allowedUnitHashes.has(hash)))) {
      return evaluatorFailure('phase_violation_reference_membership');
    }
    phases[name] = phase.value;
  }
  const styleEvidence = parseStyleEvidence(payload.styleEvidence, snapshot);
  if (!styleEvidence.ok) return evaluatorFailure(styleEvidence.evaluatorOutputContractFailureClass);
  const semanticPhase = phases.semantic_grounding;
  const completeCoverage = representedFactIdHashes.length === allowedFactHashes.size
    && representedFactIdHashes.every((hash) => allowedFactHashes.has(hash))
    && missingFactIdHashes.length === 0;
  const missingFactViolationHashes = Array.from(new Set(semanticPhase.violations
    .filter((violation) => violation.code === 'missing_fact')
    .flatMap((violation) => violation.factIdHashes)));
  const missingPartitionMatchesViolations = missingFactViolationHashes.length === missingFactIdHashes.length
    && missingFactViolationHashes.every((hash) => missingFactIdHashes.includes(hash));
  if (!missingPartitionMatchesViolations) return evaluatorFailure('semantic_missing_fact_partition');
  // A parsed passed phase has no violations. Therefore any incomplete fact
  // coverage necessarily failed the preceding missing-partition predicate;
  // retain the defensive terminal with the same authoritative class.
  if (semanticPhase.status === 'passed' && !completeCoverage) return evaluatorFailure('semantic_missing_fact_partition');
  return immutableCopy({
    ok: true,
    evaluation: {
      phases,
      representedFactIdHashes,
      missingFactIdHashes,
      roleIdentityResolution: roleIdentityResolution as SummaryV3StyleRoleIdentityResolution,
      styleEvidence: styleEvidence.value,
    },
  });
}

function allViolations(evaluation: ParsedEvaluation): readonly SummaryV3StyleViolation[] {
  return REQUIRED_PHASES.flatMap((phase) => evaluation.phases[phase].violations);
}

function unsupportedClaimCategory(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
  evaluation: ParsedEvaluation | null = null,
): SummaryV3StyleUnsupportedClaimCategory {
  if (hasUnsupportedNumericMetric(snapshot, candidateText)) return 'unsupported_metric';
  if (hasUnattestedNonnumericMaterialResultRelation(snapshot, candidateText)) return 'unsupported_result_relation';
  if (hasUnsupportedAuthorityOrSeniority(snapshot, candidateText)) return 'unsupported_authority';
  if (hasInjectedManifestFact(snapshot, candidateText)) return 'manifest_ceiling_mismatch';
  if (hasUnsupportedSourceInconsistency(snapshot)
    || hasUnsupportedCandidateSemanticMaterial(snapshot, candidateText)
    || hasUnsupportedCandidateNamedToolSurface(snapshot, candidateText)
    || hasEmploymentStateContradiction(snapshot, candidateText)) return 'source_floor_mismatch';
  const codes = evaluation ? allViolations(evaluation).map((violation) => violation.code) : [];
  if (codes.includes('unsupported_metric')) return 'unsupported_metric';
  if (codes.includes('unsupported_authority')) return 'unsupported_authority';
  return codes.includes('unsupported_claim') ? 'other_typed_category' : 'other_typed_category';
}

/**
 * The category above is intentionally coarse for the public contract. This
 * finite subordinate class keeps each source-floor producer auditable without
 * carrying Summary text, provider output, or identity strings across the
 * diagnostic boundary.
 */
function sourceFloorMismatchClass(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
  evaluation: ParsedEvaluation | null = null,
  strongerNoOpRetentionDenied = false,
): SummaryV3StyleSourceFloorMismatchClass | null {
  if (strongerNoOpRetentionDenied) return 'stronger_noop_retention_denied';
  if (evaluation && roleIdentityResolutionFailure(snapshot, evaluation)) return 'role_identity_rejection';
  if (hasEmploymentStateContradiction(snapshot, candidateText)) return 'employment_state_contradiction';
  if (hasUnsupportedCandidateNamedToolSurface(snapshot, candidateText)) return 'candidate_named_tool_surface';
  if (hasUnsupportedCandidateSemanticMaterial(snapshot, candidateText)) return 'candidate_semantic_material';
  if (hasUnsupportedSourceNonnumericMaterialResultRelation(snapshot)) return 'source_material_result_relation';
  if (hasUnannotatedSourceRoleEmployerFrameInconsistency(snapshot)) return 'role_identity_rejection';
  if (hasUnsupportedSourceInconsistency(snapshot)) return 'source_inconsistency';
  return null;
}

function sourceRetainingSafeNoOpEligibilityReason(
  snapshot: SummaryV3StyleOperationSnapshot,
  evaluatorRoleIdentityResolution?: SummaryV3StyleRoleIdentityResolution,
): SummaryV3StyleSafeNoOpEligibilityReason {
  if (snapshot.style !== 'stronger') return 'wrong_style';
  if (snapshot.mode !== 'enhance_existing_content') return 'wrong_mode';
  if (!summaryV3StyleIsNonBlank(snapshot.sourceSummary)) return 'source_empty';
  if (!summaryV3StyleLocaleSurfaceMatches(snapshot.sourceSummary, snapshot.requestedLocale)) {
    return 'source_locale_surface_mismatch';
  }
  if (!summaryV3StyleLocaleContentMatches(snapshot.sourceSummary, snapshot.requestedLocale)) {
    return 'source_locale_content_mismatch';
  }
  // The visible Summary remains the source floor. Manifest facts are only a
  // validation ceiling, including when their persisted Experience locale is
  // different from the Summary locale; no Experience-locale comparison lives
  // in this source-retention decision.
  const roleIdentity = roleEmployerIdentityDecision(snapshot);
  if (roleIdentity.status === 'contradiction') {
    return 'role_employer_frame_inconsistency';
  }
  // A cross-locale role frame without a source-bound target surface is not a
  // contradiction, but it is not eligible for a silent source-retaining no-op.
  // The bounded M5 evaluator must establish equivalence for a real rewrite.
  if (roleIdentity.status === 'unresolved'
    && evaluatorRoleIdentityResolution !== 'equivalent') return 'source_inconsistency';
  if (hasUnsupportedSourceNonnumericMaterialResultRelation(snapshot)) {
    return 'source_material_result_relation';
  }
  if (hasUnsupportedSourceInconsistency(snapshot)) return 'source_inconsistency';
  return 'eligible';
}

function sourceRetainingSafeNoOpAllowed(
  snapshot: SummaryV3StyleOperationSnapshot,
  evaluatorRoleIdentityResolution?: SummaryV3StyleRoleIdentityResolution,
  observe?: (reason: SummaryStyleSafeNoOpEligibility) => void,
): boolean {
  const reason = sourceRetainingSafeNoOpEligibilityReason(snapshot, evaluatorRoleIdentityResolution);
  observe?.(reason);
  return reason === 'eligible';
}

function sourceRetainingSafeNoOpAllowedForCandidate(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
  evaluatorRoleIdentityResolution?: SummaryV3StyleRoleIdentityResolution,
  observe?: (reason: SummaryStyleSafeNoOpEligibility) => void,
): boolean {
  // A source-retaining no-op may preserve an unchanged source, but it must
  // never mask an explicit opposite employment state in the candidate.
  if (hasEmploymentStateContradiction(snapshot, candidateText)) {
    observe?.('employment_state_contradiction');
    return false;
  }
  return sourceRetainingSafeNoOpAllowed(snapshot, evaluatorRoleIdentityResolution, observe);
}

function sameOrderedFactIds(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((factId, index) => factId === right[index]);
}

/**
 * Repair is a bounded correction, not a second rewrite. Preserve the ordered
 * unit identity and declared fact attribution everywhere; only prose in a
 * unit explicitly affected by the initial finite evidence may change. A
 * fact-scoped violation cannot authorize a generic rewrite of a unit that
 * also carries unrelated fact labels: that unit needs direct unit evidence.
 */
function repairCandidateStaysWithinViolationScope(
  snapshot: SummaryV3StyleOperationSnapshot,
  original: SummaryV3StyleCandidate,
  repaired: SummaryV3StyleCandidate,
  violations: readonly SummaryV3StyleViolation[],
): boolean {
  if (original.units.length !== repaired.units.length) return false;
  const affectedUnitHashes = new Set(violations.flatMap((violation) => violation.unitHashes));
  const affectedFactHashes = new Set(violations.flatMap((violation) => violation.factIdHashes));
  const factHashById = new Map(snapshot.requiredFacts.map((fact) => [fact.id, fact.hash] as const));
  const affectedIndexes = new Set(original.units.flatMap((unit, index) => {
    const unitIsAffected = affectedUnitHashes.has(summaryV3StyleCandidateUnitHash(unit));
    const labeledFactIsAffected = unit.factIds.some((factId) => affectedFactHashes.has(factHashById.get(factId) || ''));
    return unitIsAffected || labeledFactIsAffected ? [index] : [];
  }));
  if (affectedIndexes.size === 0) return false;
  let changedAffectedUnit = false;
  const preservesScope = original.units.every((unit, index) => {
    const next = repaired.units[index];
    if (!next || next.unitId !== unit.unitId || !sameOrderedFactIds(next.factIds, unit.factIds)) return false;
    if (affectedIndexes.has(index)) {
      const hasDirectUnitScope = affectedUnitHashes.has(summaryV3StyleCandidateUnitHash(unit));
      const declaredFactHashes = unit.factIds.map((factId) => factHashById.get(factId) || '');
      // If finite evidence pinpoints facts rather than a whole unit, reject a
      // multi-fact prose rewrite rather than guessing which substring changed.
      if (!hasDirectUnitScope
        && declaredFactHashes.some((factHash) => !affectedFactHashes.has(factHash))) return false;
      changedAffectedUnit = changedAffectedUnit || next.text !== unit.text;
      return true;
    }
    return next.text === unit.text;
  });
  return preservesScope && changedAffectedUnit;
}

function allPhasesPassed(evaluation: ParsedEvaluation): boolean {
  return REQUIRED_PHASES.every((phase) => evaluation.phases[phase].status === 'passed');
}

function roleIdentityResolutionFailureClass(
  snapshot: SummaryV3StyleOperationSnapshot,
  evaluation: ParsedEvaluation,
): SummaryStyleRoleFailure | null {
  if (evaluation.roleIdentityResolution === 'contradiction') return 'evaluator_role_contradiction';
  if (evaluation.roleIdentityResolution === 'unresolved') return 'evaluator_role_unresolved';
  return roleEmployerIdentityDecision(snapshot).status === 'unresolved'
    && evaluation.roleIdentityResolution !== 'equivalent' ? 'snapshot_role_unresolved_without_equivalence' : null;
}

function roleIdentityResolutionFailure(
  snapshot: SummaryV3StyleOperationSnapshot,
  evaluation: ParsedEvaluation,
): Extract<SummaryV3StyleFailureReason, 'unsupported_claim'> | null {
  return roleIdentityResolutionFailureClass(snapshot, evaluation) ? 'unsupported_claim' : null;
}

function styleFulfilled(styleEvidence: ParsedStyleEvidence): boolean {
  if (styleEvidence.style === 'shorter') return styleEvidence.shorterFulfilled;
  if (styleEvidence.style === 'stronger') return styleEvidence.strongerFulfilled;
  return styleEvidence.professionalFulfilled;
}

function styleNoOp(styleEvidence: ParsedStyleEvidence): boolean {
  return styleEvidence.noOpDetected;
}

function localStyleFailure(snapshot: SummaryV3StyleOperationSnapshot, candidate: SummaryV3StyleCandidate, evidence: ParsedStyleEvidence): SummaryV3StyleFailureReason | null {
  const source = snapshot.sourceSummary;
  const normalizedSource = normalizeSummaryV3StyleText(source);
  const normalizedCandidate = normalizeSummaryV3StyleText(candidate.text);
  const materiallyDifferent = normalizedSource !== normalizedCandidate;
  const capitalizationOnlyChange = materiallyDifferent
    && normalizedSource.toLocaleLowerCase() === normalizedCandidate.toLocaleLowerCase();
  const hardRejection = localHardRejection(snapshot, candidate.text);
  if (hardRejection) return hardRejection;
  if (snapshot.mode === 'generate_from_context' && styleNoOp(evidence)) return 'style_not_fulfilled';
  const strategy = SUMMARY_V3_STYLE_STRATEGIES[snapshot.style];
  if (snapshot.mode === 'enhance_existing_content' && styleNoOp(evidence)) {
    if (materiallyDifferent || !safeNoOpEvidenceIsConsistent(snapshot, candidate, evidence)) return 'style_not_fulfilled';
    return null;
  }
  if (snapshot.mode === 'enhance_existing_content' && strategy.requiresExistingSourceMateriality && !materiallyDifferent) return 'style_not_fulfilled';
  if (snapshot.mode === 'enhance_existing_content' && capitalizationOnlyChange) return 'style_not_fulfilled';
  if (summaryV3StylePunctuationOnlyChange(source, candidate.text)) return 'style_not_fulfilled';
  if (!summaryV3StyleLocaleSurfaceMatches(candidate.text, snapshot.requestedLocale)
    || !summaryV3StyleLocaleContentMatches(candidate.text, snapshot.requestedLocale)) return 'invalid_language_or_native_surface';
  if (!styleFulfilled(evidence)) return 'style_not_fulfilled';
  if (evidence.style === 'shorter') {
    if (snapshot.mode === 'generate_from_context') return null;
    const sourceLength = normalizedSummaryV3StyleLength(source);
    const candidateLength = normalizedSummaryV3StyleLength(candidate.text);
    const sourceUnits = countSummaryV3StyleUnits(source);
    const candidateUnits = countSummaryV3StyleUnits(candidate.text);
    const sourceClauses = countSummaryV3StyleClauses(source);
    const candidateClauses = countSummaryV3StyleClauses(candidate.text);
    if (evidence.sourceNormalizedLength !== sourceLength || evidence.candidateNormalizedLength !== candidateLength
      || evidence.sourceUnitCount !== sourceUnits || evidence.candidateUnitCount !== candidateUnits
      || evidence.sourceClauseCount !== sourceClauses || evidence.candidateClauseCount !== candidateClauses) return 'evaluator_rejected';
    const reduction = sourceLength - candidateLength;
    const reductionPercent = sourceLength > 0 ? reduction / sourceLength : 0;
    const topologyReduced = candidateUnits < sourceUnits || candidateClauses < sourceClauses;
    const factCoverage = summarizeSummaryV3StyleFactCoverage(snapshot, candidate);
    if (reduction <= 0 || (reductionPercent < 0.03 && !topologyReduced)
      || (evidence.semanticCompressionOperations === 0 && !topologyReduced)
      || evidence.lengthDelta !== reduction
      || Math.abs(evidence.lengthDeltaPercent - reductionPercent) > 0.000001
      || evidence.factCoverage !== (factCoverage.missingFactCount === 0)) return 'style_not_fulfilled';
    return null;
  }
  if (evidence.style === 'stronger') {
    const groundedStrengthening = hasGroundedPredicateTransformation(snapshot, candidate.text)
      || hasGroundedAchievementFraming(snapshot, candidate.text);
    if (evidence.modifierOnlyTransformationDetected || evidence.repeatedStyleModifierCount > 0
      || evidence.stackedModifierDetected || evidence.unsupportedAuthorityDetected
      || evidence.structuralStrengtheningCount < 1
      || (evidence.strongerPredicateTransformations < 1 && !hasGroundedAchievementFraming(snapshot, candidate.text))
      || (snapshot.mode === 'enhance_existing_content' && strategy.requiresGroundedPredicateTransformation
        && !groundedStrengthening)) return 'style_not_fulfilled';
    if (JARGON_PATTERN.test(candidate.text) || hasOnlyRoleIntroductionChange(snapshot, candidate.text)) {
      return 'style_not_fulfilled';
    }
    return null;
  }
  if (evidence.markerOnlyChangeDetected || evidence.jargonOrFillerDetected
    || evidence.professionalFramingOperations < 1 || evidence.cohesionClarityOperations < 1
    || JARGON_PATTERN.test(candidate.text)
    || isSingleDecorativeLexicalSwap(snapshot, source, candidate.text)
    || (strategy.minimumExistingSourceLengthRatio > 0
      && candidate.normalizedLength < normalizedSummaryV3StyleLength(source) * strategy.minimumExistingSourceLengthRatio
      && candidate.unitCount < countSummaryV3StyleUnits(source))
  ) return 'style_not_fulfilled';
  return null;
}

interface EvidenceUpdate {
  readonly writerAttempts?: number;
  readonly evaluatorAttempts?: number;
  readonly repairWriterAttempts?: number;
  readonly repairEvaluatorAttempts?: number;
  readonly candidate?: SummaryV3StyleCandidate | null;
  readonly evaluation?: ParsedEvaluation | null;
  readonly localFailureReason?: SummaryV3StyleFailureReason | null;
  readonly unsupportedClaimCategory?: SummaryV3StyleUnsupportedClaimCategory | null;
  readonly writerOutputContractFailureClass?: SummaryV3StyleWriterOutputContractFailureClass | null;
  readonly candidateSourceFloorInspection?: SummaryV3StyleCandidateSourceFloorInspection | null;
  readonly sourceLockInspection?: SummaryV3StyleSourceLockInspection | null;
  readonly evaluatorOutputContractFailureClass?: SummaryV3StyleEvaluatorOutputContractFailureClass | null;
  readonly sourceFloorMismatchClass?: SummaryV3StyleSourceFloorMismatchClass | null;
  readonly employmentStateContradictionClass?: SummaryV3StyleEmploymentStateContradictionClass | null;
  readonly evaluatorNoOpClaimed?: boolean;
  readonly safeNoOpConsidered?: boolean;
  readonly safeNoOpSelected?: boolean;
  readonly safeNoOpEligibilityReason?: SummaryV3StyleSafeNoOpEligibilityReason;
  readonly m5ProviderFailure?: SummaryV3ProviderFailureEnvelope | null;
}

function orchestrationProviderFailure(
  error: unknown,
  phase: SummaryV3ProviderPhase,
): SummaryV3ProviderFailureEnvelope {
  return error instanceof SummaryV3ProviderTransportError
    ? error.envelope
    : classifySummaryV3ProviderFailure(error, phase, 'orchestration');
}

function localFailureViolationCode(reason: SummaryV3StyleFailureReason | null | undefined): SummaryV3StyleViolationCode | null {
  if (reason === 'unsupported_claim') return 'unsupported_claim';
  if (reason === 'lost_source_fact') return 'lost_source_fact';
  if (reason === 'invalid_language_or_native_surface') return 'invalid_native_surface';
  if (reason === 'style_not_fulfilled') return 'style_not_fulfilled';
  if (reason === 'stale_identity') return 'stale_identity';
  return null;
}

function localFailurePhase(reason: SummaryV3StyleFailureReason | null | undefined): SummaryV3StylePhase | null {
  if (reason === 'stale_identity') return 'structural';
  if (reason === 'lost_source_fact' || reason === 'unsupported_claim') return 'semantic_grounding';
  if (reason === 'invalid_language_or_native_surface') return 'language_native_quality';
  if (reason === 'style_not_fulfilled') return 'style_fulfillment';
  return null;
}

function makeEvidence(snapshot: SummaryV3StyleOperationSnapshot, update: EvidenceUpdate): SummaryV3StyleEvidence {
  const initial = createSummaryV3StyleInitialEvidence(snapshot);
  const candidate = update.candidate ?? null;
  const evaluation = update.evaluation ?? null;
  const candidateCoverage = candidate ? summarizeSummaryV3StyleFactCoverage(snapshot, candidate) : null;
  const coverage = evaluation
    ? { coveredFactCount: evaluation.representedFactIdHashes.length, missingFactCount: evaluation.missingFactIdHashes.length }
    : candidateCoverage;
  const violations = evaluation ? allViolations(evaluation) : [];
  const localViolation = localFailureViolationCode(update.localFailureReason);
  const localPhase = localFailurePhase(update.localFailureReason);
  const violationCodes: readonly SummaryV3StyleViolationCode[] = localViolation
    ? [...violations.map((violation) => violation.code), localViolation]
    : violations.map((violation) => violation.code);
  const phaseStatuses = REQUIRED_PHASES.reduce((result, phase) => {
    result[phase] = evaluation ? evaluation.phases[phase].status : 'not_evaluated';
    return result;
  }, {} as Record<SummaryV3StylePhase, SummaryV3StylePhaseStatus | 'not_evaluated'>);
  if (localPhase) phaseStatuses[localPhase] = 'failed';
  const meaningfulChangeDetected = update.safeNoOpSelected
    ? false
    : candidate
    ? snapshot.mode === 'generate_from_context'
      ? candidate.normalizedLength > 0
      : normalizeSummaryV3StyleText(candidate.text) !== normalizeSummaryV3StyleText(snapshot.sourceSummary)
    : false;
  const safeStyleEvidence = candidate && evaluation && coverage
    ? fulfillmentEvidence(
      snapshot,
      candidate,
      evaluation.styleEvidence,
      coverage.coveredFactCount,
      coverage.missingFactCount,
      meaningfulChangeDetected,
      violationCodes,
      !localViolation && styleFulfilled(evaluation.styleEvidence),
    )
    : null;
  const effectiveSourceFloorMismatchClass = update.sourceFloorMismatchClass
    ?? ((update.unsupportedClaimCategory ?? null) === 'source_floor_mismatch'
      ? sourceFloorMismatchClass(snapshot, candidate?.text || snapshot.sourceSummary, evaluation)
      : null);
  const employmentDecision = candidate
    ? employmentStateContradictionDecision(snapshot, candidate.text)
    : null;
  const evidence = immutableCopy({
    ...initial,
    writerAttempts: update.writerAttempts ?? 0,
    evaluatorAttempts: update.evaluatorAttempts ?? 0,
    repairWriterAttempts: update.repairWriterAttempts ?? 0,
    repairEvaluatorAttempts: update.repairEvaluatorAttempts ?? 0,
    phaseStatuses,
    candidateHash: candidate?.hash ?? null,
    candidateNormalizedLength: candidate?.normalizedLength ?? null,
    candidateUnitCount: candidate?.unitCount ?? null,
    candidateClauseCount: candidate?.clauseCount ?? null,
    coveredFactCount: coverage?.coveredFactCount ?? 0,
    missingFactCount: coverage?.missingFactCount ?? snapshot.requiredFacts.length,
    unsupportedClaimCount: violationCodes.filter((code) => UNSUPPORTED_CLAIM_CODES.has(code)).length,
    styleFulfilled: evaluation ? !localViolation && styleFulfilled(evaluation.styleEvidence) : null,
    styleEvidence: safeStyleEvidence,
    meaningfulChangeDetected,
    noOpDetected: update.safeNoOpSelected
      ? true
      : evaluation ? !localViolation && styleNoOp(evaluation.styleEvidence) : false,
    unsupportedClaimCategory: update.unsupportedClaimCategory ?? null,
    sourceFloorMismatchClass: effectiveSourceFloorMismatchClass,
    ...(update.candidateSourceFloorInspection ? {
      sourceFloorFailureStage: update.candidateSourceFloorInspection.sourceFloorFailureStage,
      factRepresentationFailureReason: update.candidateSourceFloorInspection.firstFailedFact?.failureReason ?? null,
      factRepresentationFailedFactIndex: update.candidateSourceFloorInspection.firstFailedFactIndex,
      factRepresentationFailedFactSemanticKind: update.candidateSourceFloorInspection.firstFailedFact?.semanticKind ?? null,
      requiredAnchorCount: update.candidateSourceFloorInspection.firstFailedFact?.requiredAnchorCount ?? null,
      missingAnchorCount: update.candidateSourceFloorInspection.firstFailedFact?.missingAnchorCount ?? null,
      requiredNumericAnchorCount: update.candidateSourceFloorInspection.firstFailedFact?.requiredNumericAnchorCount ?? null,
      missingNumericAnchorCount: update.candidateSourceFloorInspection.firstFailedFact?.missingNumericAnchorCount ?? null,
      durationDiagnosticStatus: update.candidateSourceFloorInspection.firstFailedFact?.durationStatus ?? null,
      transformableDutyAvailable: update.candidateSourceFloorInspection.firstFailedFact?.transformableDutyAvailable ?? null,
      predicateReplacementEligible: update.candidateSourceFloorInspection.firstFailedFact?.predicateReplacementEligible ?? null,
      groundedReplacementRecognized: update.candidateSourceFloorInspection.firstFailedFact?.groundedReplacementRecognized ?? null,
      newCandidateTokenPresent: update.candidateSourceFloorInspection.firstFailedFact?.newCandidateTokenPresent ?? null,
      multiFactFallbackResult: update.candidateSourceFloorInspection.multiFactFallback.passed ? 'pass' as const : 'fail' as const,
      multiFactFallbackFailureReason: update.candidateSourceFloorInspection.multiFactFallback.failureReason,
      multiFactFallbackFailedFactIndex: update.candidateSourceFloorInspection.multiFactFallback.failureReason === 'numeric_anchor_missing'
        || update.candidateSourceFloorInspection.multiFactFallback.failureReason === 'fact_overlap_below_threshold'
        ? update.candidateSourceFloorInspection.multiFactFallback.failedFactIndex
        : null,
    } : {}),
    ...(update.writerOutputContractFailureClass === 'source_lock_preservation' && update.sourceLockInspection ? {
      sourceLockFailureKind: update.sourceLockInspection.failureKind,
      sourceLockFailureReason: update.sourceLockInspection.failureReason,
      sourceLockFailedIndex: update.sourceLockInspection.failedIndex,
      ...(candidate ? summarizeSummaryV3StyleSourceLockDiagnostics(snapshot, candidate, update.sourceLockInspection) : {}),
    } : {}),
    employmentStateContradictionClass: effectiveSourceFloorMismatchClass === 'employment_state_contradiction'
      ? (update.employmentStateContradictionClass
        ?? employmentDecision?.class
        ?? employmentStateContradictionClass(snapshot, candidate?.text || snapshot.sourceSummary))
      : null,
    employmentOppositeFrameDetected: effectiveSourceFloorMismatchClass === 'employment_state_contradiction'
      ? employmentDecision?.explicitOppositeFrameDetected === true
      : false,
    evaluatorNoOpClaimed: update.evaluatorNoOpClaimed ?? false,
    writerOutputContractFailureClass: update.writerOutputContractFailureClass ?? null,
    evaluatorOutputContractFailureClass: update.evaluatorOutputContractFailureClass ?? null,
    writerCandidateReachedValidation: Boolean(candidate && (update.writerAttempts ?? 0) > 0),
    evaluatorReached: (update.evaluatorAttempts ?? 0) > 0,
    safeNoOpConsidered: update.safeNoOpConsidered ?? false,
    safeNoOpSelected: update.safeNoOpSelected ?? false,
    safeNoOpEligibilityReason: update.safeNoOpEligibilityReason
      ?? sourceRetainingSafeNoOpEligibilityReason(snapshot),
    roleIdentityResolution: evaluation?.roleIdentityResolution
      ?? (roleEmployerIdentityDecision(snapshot).status === 'unresolved' ? 'unresolved'
        : roleEmployerIdentityDecision(snapshot).status === 'contradiction' ? 'contradiction'
          : 'not_required'),
    m5ProviderFailure: update.m5ProviderFailure ?? null,
  }) as SummaryV3StyleEvidence;
  // All retained fields are bounded scalars, hashes, fixed phases, or finite
  // code sets. Keep the complete evidence so the terminal size gate can fail
  // closed instead of silently dropping attempts or phase truth.
  return evidence;
}

function fulfillmentEvidence(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidate: SummaryV3StyleCandidate,
  style: ParsedStyleEvidence,
  coveredFactCount: number,
  missingFactCount: number,
  materiallyDifferentFromSource: boolean,
  violationCodes: readonly SummaryV3StyleViolationCode[],
  finalFulfilled: boolean,
): SummaryV3StyleFulfillmentEvidence {
  const rejectionReasons = Array.from(new Set(violationCodes)).slice(0, 32);
  if (style.style === 'shorter') {
    const sourceLength = snapshot.sourceSummaryNormalizedLength;
    const candidateLength = candidate.normalizedLength;
    const delta = sourceLength - candidateLength;
    return immutableCopy({
      style: 'shorter',
      sourceNormalizedLength: sourceLength,
      candidateNormalizedLength: candidateLength,
      lengthDelta: delta,
      lengthDeltaPercent: sourceLength > 0 ? delta / sourceLength : 0,
      sourceUnitCount: snapshot.sourceUnits.length,
      candidateUnitCount: candidate.unitCount,
      sourceClauseCount: countSummaryV3StyleClauses(snapshot.sourceSummary),
      candidateClauseCount: candidate.clauseCount,
      semanticCompressionOperations: style.semanticCompressionOperations,
      factCoverage: missingFactCount === 0 && coveredFactCount === snapshot.requiredFacts.length,
      fulfilled: finalFulfilled && style.shorterFulfilled,
      rejectionReasons,
    }) as SummaryV3StyleFulfillmentEvidence;
  }
  if (style.style === 'stronger') {
    return immutableCopy({
      style: 'stronger',
      materiallyDifferentFromSource,
      strongerPredicateTransformations: style.strongerPredicateTransformations,
      structuralStrengtheningCount: style.structuralStrengtheningCount,
      modifierOnlyTransformationDetected: style.modifierOnlyTransformationDetected,
      repeatedStyleModifierCount: style.repeatedStyleModifierCount,
      stackedModifierDetected: style.stackedModifierDetected,
      unsupportedAuthorityDetected: style.unsupportedAuthorityDetected,
      fulfilled: finalFulfilled && style.strongerFulfilled,
      rejectionReasons,
    }) as SummaryV3StyleFulfillmentEvidence;
  }
  return immutableCopy({
    style: 'professional',
    materiallyDifferentFromSource,
    professionalFramingOperations: style.professionalFramingOperations,
    cohesionClarityOperations: style.cohesionClarityOperations,
    markerOnlyChangeDetected: style.markerOnlyChangeDetected,
    jargonOrFillerDetected: style.jargonOrFillerDetected,
    fulfilled: finalFulfilled && style.professionalFulfilled,
    rejectionReasons,
  }) as SummaryV3StyleFulfillmentEvidence;
}

function writerInput(snapshot: SummaryV3StyleOperationSnapshot): SummaryV3StyleWriterInput {
  const styleContract = SUMMARY_V3_STYLE_STRATEGIES[snapshot.style].writerContract;
  return immutableCopy({
    operationId: snapshot.operationId,
    snapshotHash: snapshot.snapshotHash,
    manifestHash: snapshot.manifestHash,
    style: snapshot.style,
    locale: snapshot.requestedLocale,
    mode: snapshot.mode,
    sourceKind: snapshot.sourceKind,
    sourceText: snapshot.sourceSummary,
    sourceUnits: snapshot.sourceUnits,
    selectedEntries: snapshot.selectedEntries,
    currentRoleEntryId: snapshot.currentRoleEntryId,
    currentRoleHash: snapshot.currentRoleHash,
    structuredDurationMonths: snapshot.structuredDurationMonths,
    requiredFacts: snapshot.requiredFacts,
    transformableDuty: snapshot.transformableDuty,
    entityLocks: snapshot.entityLocks,
    roleIdentity: roleEmployerIdentityDecision(snapshot),
    styleContract,
    forcedTool: {
      toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
      toolChoice: 'required',
      strict: true,
      expectedToolBlocks: 1,
      allowedTextBlocks: 0,
      schema: SUMMARY_V3_STYLE_M5_WRITER_TOOL,
    },
  }) as SummaryV3StyleWriterInput;
}

function evaluatorInput(snapshot: SummaryV3StyleOperationSnapshot, candidate: SummaryV3StyleCandidate): SummaryV3StyleEvaluatorInput {
  const roleIdentity = roleEmployerIdentityDecision(snapshot);
  const selectedEntry = roleIdentity.selectedEntryId
    ? snapshot.selectedEntries.find((entry) => entry.stableId === roleIdentity.selectedEntryId) || null
    : null;
  return immutableCopy({
    operationId: snapshot.operationId,
    snapshotHash: snapshot.snapshotHash,
    manifestHash: snapshot.manifestHash,
    style: snapshot.style,
    locale: snapshot.requestedLocale,
    mode: snapshot.mode,
    candidate,
    sourceText: snapshot.sourceSummary,
    sourceUnits: snapshot.sourceUnits,
    selectedEntries: snapshot.selectedEntries,
    currentRoleEntryId: snapshot.currentRoleEntryId,
    currentRoleHash: snapshot.currentRoleHash,
    structuredDurationMonths: snapshot.structuredDurationMonths,
    requiredFacts: snapshot.requiredFacts,
    transformableDuty: snapshot.transformableDuty,
    manifestValidationCeiling: snapshot.manifestFacts,
    entityLocks: snapshot.entityLocks,
    roleIdentity: {
      ...roleIdentity,
      structuredRole: selectedEntry
        ? snapshot.manifestFacts.find((fact) => fact.id === `${selectedEntry.stableId}:role`)?.text || null
        : null,
      roleSourceLocale: selectedEntry?.roleSourceLocale || null,
      employer: selectedEntry
        ? snapshot.manifestFacts.find((fact) => fact.id === `${selectedEntry.stableId}:employer`)?.text || null
        : null,
      rolePresentation: selectedEntry?.rolePresentation || null,
    },
    forcedTool: {
      toolName: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
      toolChoice: 'required',
      strict: true,
      expectedToolBlocks: 1,
      allowedTextBlocks: 0,
      schema: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
    },
  }) as SummaryV3StyleEvaluatorInput;
}

function canRepair(evaluation: ParsedEvaluation): boolean {
  const violations = allViolations(evaluation);
  return violations.length > 0
    && violations.every((violation) => violation.repairable && !UNREPAIRABLE_CODES.has(violation.code));
}

// The existing failureForEvaluation precedence is shared by the decision and
// its diagnostic projection. Within one priority group, phase/array order is
// only a diagnostic tie-break; it does not change the application reason.
const EVALUATOR_FAILURE_PRECEDENCE: readonly Readonly<{
  reason: SummaryV3StyleFailureReason;
  codes: ReadonlySet<string>;
}>[] = [
  { reason: 'unsupported_claim', codes: UNSUPPORTED_CLAIM_CODES },
  { reason: 'lost_source_fact', codes: new Set(['lost_source_fact', 'missing_fact']) },
  { reason: 'stale_identity', codes: new Set(['stale_identity']) },
  { reason: 'invalid_language_or_native_surface', codes: new Set(['invalid_language', 'invalid_native_surface']) },
  { reason: 'style_not_fulfilled', codes: new Set([
    'style_not_fulfilled', 'marker_only_change', 'modifier_only_change',
    'repeated_style_modifier', 'stacked_style_modifier', 'corporate_jargon',
  ]) },
];

function evaluatorFailureDecision(evaluation: ParsedEvaluation) {
  const violations = REQUIRED_PHASES.flatMap((phase) =>
    evaluation.phases[phase].violations.map((violation) => ({ phase, violation })));
  for (const priority of EVALUATOR_FAILURE_PRECEDENCE) {
    const selected = violations.find(({ violation }) => priority.codes.has(violation.code));
    if (selected) return { reason: priority.reason, selected };
  }
  return { reason: 'evaluator_rejected' as const, selected: violations[0] ?? null };
}

function failureForEvaluation(evaluation: ParsedEvaluation): SummaryV3StyleFailureReason {
  return evaluatorFailureDecision(evaluation).reason;
}

/** Attach only after the unchanged control flow selects a validation failure. */
function postEvaluatorFailureEvidence(
  evidence: SummaryV3StyleEvidence,
  evaluation: ParsedEvaluation,
  localFailure: SummaryV3StyleFailureReason | null,
): SummaryV3StyleEvidence {
  const selected = localFailure ? null : evaluatorFailureDecision(evaluation).selected;
  const localClass: SummaryV3StylePostEvaluatorLocalFailureClass | null = localFailure === 'lost_source_fact'
    ? 'employment_source_state_preservation'
    : localFailure === 'unsupported_claim' || localFailure === 'invalid_language_or_native_surface'
      || localFailure === 'style_not_fulfilled' || localFailure === 'evaluator_rejected'
      ? localFailure : null;
  return immutableCopy({
    ...evidence,
    evaluatorTerminalPhase: selected?.phase ?? null,
    evaluatorViolationCode: selected?.violation.code ?? null,
    evaluatorViolationRepairable: selected?.violation.repairable ?? null,
    postEvaluatorLocalFailureClass: localClass,
  }) as SummaryV3StyleEvidence;
}

function withLocalDecisionDiagnostics(
  result: SummaryV3StyleResult,
  snapshot: SummaryV3StyleOperationSnapshot,
  evaluation: ParsedEvaluation,
  hardDecision: LocalHardDecision,
  roleFailure: SummaryStyleRoleFailure | null,
  safeNoOpEligibility: SummaryStyleSafeNoOpEligibility,
): SummaryV3StyleResult {
  if (snapshot.style !== 'stronger') return result;
  const ownsUnsupportedTerminal = result.kind === 'handled_failure'
    && result.typedReason === 'unsupported_claim'
    && result.evidence.postEvaluatorLocalFailureClass === 'unsupported_claim';
  const owner = !ownsUnsupportedTerminal ? null
    : hardDecision.reason === 'unsupported_claim' ? 'hard_guard'
      : roleFailure ? 'role_identity_resolution' : null;
  const predicate = owner === 'hard_guard' ? hardDecision.predicate : null;
  // Existing category/mismatch helpers have different precedence. Publish an
  // existing value only if it is attributable to this captured winning branch;
  // never rerun those helpers (or any predicate) to manufacture provenance.
  const categoryForPredicate: Record<SummaryStyleHardPredicate, SummaryV3StyleUnsupportedClaimCategory> = {
    unsupported_source_inconsistency: 'source_floor_mismatch',
    injected_manifest_fact: 'manifest_ceiling_mismatch',
    unsupported_authority_or_seniority: 'unsupported_authority',
    unsupported_numeric_metric: 'unsupported_metric',
    unsupported_candidate_semantic_material: 'source_floor_mismatch',
    unsupported_named_tool_surface: 'source_floor_mismatch',
    employment_state_contradiction: 'source_floor_mismatch',
  };
  const mismatchForPredicate: Partial<Record<SummaryStyleHardPredicate, SummaryV3StyleSourceFloorMismatchClass>> = {
    unsupported_source_inconsistency: 'source_inconsistency',
    unsupported_candidate_semantic_material: 'candidate_semantic_material',
    unsupported_named_tool_surface: 'candidate_named_tool_surface',
    employment_state_contradiction: 'employment_state_contradiction',
  };
  const expectedCategory = predicate ? categoryForPredicate[predicate]
    : owner === 'role_identity_resolution' ? 'source_floor_mismatch' : null;
  const expectedMismatch = predicate ? mismatchForPredicate[predicate] ?? null
    : owner === 'role_identity_resolution' ? 'role_identity_rejection' : null;
  const evidence = result.kind === 'not_applicable' ? null : result.evidence;
  return recordSummaryStyleLocalDiagnostics(result, {
    postEvaluatorLocalOwner: owner,
    postEvaluatorHardPredicate: predicate,
    postEvaluatorRoleIdentityFailureClass: owner === 'role_identity_resolution' ? roleFailure : null,
    postEvaluatorUnsupportedClaimCategory: expectedCategory !== null
      && evidence?.unsupportedClaimCategory === expectedCategory ? expectedCategory : null,
    postEvaluatorSourceFloorMismatchClass: expectedMismatch !== null
      && evidence?.sourceFloorMismatchClass === expectedMismatch ? expectedMismatch : null,
    evaluatorAllPhasesPassed: allPhasesPassed(evaluation),
    evaluatorViolationCount: allViolations(evaluation).length,
    evaluatorRoleIdentityResolution: evaluation.roleIdentityResolution,
    strongerSafeNoOpEligibility: safeNoOpEligibility !== 'not_evaluated' || ownsUnsupportedTerminal
      ? safeNoOpEligibility : null,
  });
}

function candidateReady(snapshot: SummaryV3StyleOperationSnapshot, candidate: SummaryV3StyleCandidate, evidence: SummaryV3StyleEvidence): SummaryV3StyleResult {
  if (JSON.stringify(evidence).length > 8_192) return createSummaryV3StyleHandledFailure(snapshot, 'diagnostic_size_exceeded', evidence);
  return immutableCopy({ kind: 'candidate_ready', style: snapshot.style, mode: snapshot.mode, candidate, evidence }) as SummaryV3StyleResult;
}

function safeNoOpResult(
  snapshot: SummaryV3StyleOperationSnapshot,
  evidence: SummaryV3StyleEvidence,
  category: SummaryV3StyleUnsupportedClaimCategory | null = evidence.unsupportedClaimCategory,
): SummaryV3StyleResult {
  const selectedEvidence = immutableCopy({
    ...evidence,
    meaningfulChangeDetected: false,
    noOpDetected: true,
    unsupportedClaimCategory: category,
    safeNoOpConsidered: true,
    safeNoOpSelected: true,
  }) as SummaryV3StyleEvidence;
  if (JSON.stringify(selectedEvidence).length > 8_192) {
    return createSummaryV3StyleHandledFailure(snapshot, 'diagnostic_size_exceeded', selectedEvidence);
  }
  return immutableCopy({
    kind: 'safe_no_op',
    style: snapshot.style,
    mode: 'enhance_existing_content',
    typedReason: 'safe_no_op',
    evidence: selectedEvidence,
  }) as SummaryV3StyleResult;
}

/**
 * Runs exactly one shared writer/evaluator path and, only for finite repairable
 * evaluator findings, one shared repair pass. It contains no retry or fallback.
 */
export async function executeSummaryV3StyleServer(
  request: SummaryV3StyleRequest,
  dependencies: SummaryV3StyleServerDependencies,
): Promise<SummaryV3StyleResult> {
  // Decide ownership separately so malformed M5-owned input is a handled failure.
  if (!request || typeof request !== 'object') return createSummaryV3StyleNotApplicable('operation_not_m5_style');
  const ownership = decideSummaryV3StyleOwnership(request);
  if (ownership.kind === 'not_applicable') return createSummaryV3StyleNotApplicable(ownership.reason);
  const snapshotRequest = request.createdAt === undefined
    ? immutableCopy({ ...request, createdAt: dependencies.now ? dependencies.now() : Date.now() }) as SummaryV3StyleRequest
    : request;
  let snapshot: SummaryV3StyleOperationSnapshot;
  try {
    snapshot = createSummaryV3StyleOperationSnapshot(snapshotRequest);
  } catch (error) {
    // The request has already been determined M5-owned above; never fall through.
    const style = request.style as SummaryV3Style;
    const mode = request.visibleSummary === '' ? 'generate_from_context' as const : 'enhance_existing_content' as const;
    const placeholder = immutableCopy({
      operationId: summaryV3StyleIsNonBlank(request.operationId) ? request.operationId : 'invalid',
      style,
      mode,
      requestedLocale: canonicalSummaryV3StyleLocale(request.requestedLocale) || 'en',
      sourceLocale: canonicalSummaryV3StyleLocale(request.sourceLocale) || 'en',
      sourceKind: mode === 'generate_from_context' ? 'context_manifest' as const : 'visible_summary' as const,
      sourceSummary: '', sourceSummaryHash: hashSummaryV3StyleValue(''), sourceSummaryNormalizedLength: 0,
      sourceUnits: [], selectedEntries: [], currentRoleEntryId: null, currentRoleHash: null, manifestFacts: [], requiredFacts: [], transformableDuty: null, entityLocks: [], entityRelationBindings: [],
      structuredDurationMonths: 0, manifestHash: hashSummaryV3StyleValue('invalid'), contextHash: hashSummaryV3StyleValue('invalid'),
      snapshotHash: hashSummaryV3StyleValue('invalid'), requestIdentityHash: hashSummaryV3StyleValue('invalid'), createdAt: 0,
    }) as SummaryV3StyleOperationSnapshot;
    const reason = error && typeof error === 'object' && 'reason' in error
      ? (error as { reason: SummaryV3StyleFailureReason }).reason
      : 'malformed_request';
    return createSummaryV3StyleHandledFailure(placeholder, reason);
  }

  // A direct source identity mismatch or an unmanifested material-result
  // relation makes the transformation floor internally inconsistent. Reject
  // it before any injected provider boundary is called.
  if (hasUnannotatedSourceRoleEmployerFrameInconsistency(snapshot)
    || hasUnsupportedSourceNonnumericMaterialResultRelation(snapshot)) {
    return createSummaryV3StyleHandledFailure(snapshot, 'unsupported_claim', makeEvidence(snapshot, {
      localFailureReason: 'unsupported_claim',
      unsupportedClaimCategory: 'source_floor_mismatch',
      sourceFloorMismatchClass: sourceFloorMismatchClass(snapshot, snapshot.sourceSummary),
      safeNoOpEligibilityReason: sourceRetainingSafeNoOpEligibilityReason(snapshot),
    }));
  }

  let rawWriter: unknown;
  try {
    rawWriter = await dependencies.write(writerInput(snapshot));
  } catch (error) {
    return createSummaryV3StyleHandledFailure(snapshot, 'writer_request_failed', makeEvidence(snapshot, {
      writerAttempts: 1,
      m5ProviderFailure: orchestrationProviderFailure(error, 'initial_writer'),
    }));
  }
  const parsedWriter = parseWriterOutput(rawWriter, snapshot);
  if (!parsedWriter.ok) return createSummaryV3StyleHandledFailure(snapshot, parsedWriter.reason, makeEvidence(snapshot, {
    writerAttempts: 1,
    candidate: parsedWriter.reason === 'lost_source_fact' ? parsedWriter.candidate : null,
    writerOutputContractFailureClass: parsedWriter.reason === 'lost_source_fact'
      ? parsedWriter.writerOutputContractFailureClass
      : null,
    candidateSourceFloorInspection: parsedWriter.reason === 'lost_source_fact'
      ? parsedWriter.candidateSourceFloorInspection ?? null
      : null,
    sourceLockInspection: parsedWriter.reason === 'lost_source_fact'
      ? parsedWriter.sourceLockInspection ?? null
      : null,
  }));
  // A nonnumeric material-result injection is a source-floor failure that is
  // fully decidable from writer text. Reject it before it reaches evaluator
  // authority; the broader local style/authority checks retain their normal
  // post-evaluator evidence path below.
  if (hasUnattestedNonnumericMaterialResultRelation(snapshot, parsedWriter.candidate.text)) {
    const category = unsupportedClaimCategory(snapshot, parsedWriter.candidate.text);
    const evidence = makeEvidence(snapshot, {
      writerAttempts: 1,
      candidate: parsedWriter.candidate,
      localFailureReason: 'unsupported_claim',
      unsupportedClaimCategory: category,
      sourceFloorMismatchClass: category === 'source_floor_mismatch'
        ? sourceFloorMismatchClass(snapshot, parsedWriter.candidate.text)
        : null,
      safeNoOpConsidered: sourceRetainingSafeNoOpAllowedForCandidate(snapshot, parsedWriter.candidate.text),
    });
    return sourceRetainingSafeNoOpAllowedForCandidate(snapshot, parsedWriter.candidate.text)
      ? safeNoOpResult(snapshot, evidence, category)
      : createSummaryV3StyleHandledFailure(snapshot, 'unsupported_claim', evidence);
  }

  let rawEvaluator: unknown;
  try {
    rawEvaluator = await dependencies.evaluate(evaluatorInput(snapshot, parsedWriter.candidate));
  } catch (error) {
    return createSummaryV3StyleHandledFailure(snapshot, 'evaluator_request_failed', makeEvidence(snapshot, {
      writerAttempts: 1,
      evaluatorAttempts: 1,
      candidate: parsedWriter.candidate,
      m5ProviderFailure: orchestrationProviderFailure(error, 'initial_evaluator'),
    }));
  }
  const parsedEvaluator = parseEvaluatorOutput(rawEvaluator, snapshot, parsedWriter.candidate);
  if (!parsedEvaluator.ok) return createSummaryV3StyleHandledFailure(snapshot, parsedEvaluator.reason, makeEvidence(snapshot, {
    writerAttempts: 1,
    evaluatorAttempts: 1,
    candidate: parsedWriter.candidate,
    evaluatorOutputContractFailureClass: parsedEvaluator.reason === 'evaluator_transport_malformed'
      ? parsedEvaluator.evaluatorOutputContractFailureClass
      : null,
  }));
  let initialHardDecision: LocalHardDecision = { reason: null, predicate: null };
  const initialHardRejection = localHardRejection(snapshot, parsedWriter.candidate.text,
    (decision) => { initialHardDecision = decision; });
  const initialRoleFailureClass = roleIdentityResolutionFailureClass(snapshot, parsedEvaluator.evaluation);
  const initialRoleIdentityFailure = initialRoleFailureClass ? 'unsupported_claim' as const : null;
  let safeNoOpEligibility: SummaryStyleSafeNoOpEligibility = 'not_evaluated';
  const observeSafeNoOpEligibility = (reason: SummaryStyleSafeNoOpEligibility) => { safeNoOpEligibility = reason; };
  const finishInitial = (result: SummaryV3StyleResult) => withLocalDecisionDiagnostics(
    result, snapshot, parsedEvaluator.evaluation, initialHardDecision, initialRoleFailureClass, safeNoOpEligibility,
  );
  const initialStyleFailure = initialHardRejection || initialRoleIdentityFailure || (allPhasesPassed(parsedEvaluator.evaluation)
    ? localStyleFailure(snapshot, parsedWriter.candidate, parsedEvaluator.evaluation.styleEvidence)
    : null);
  const initialEvaluationFailure = allPhasesPassed(parsedEvaluator.evaluation)
    ? null
    : failureForEvaluation(parsedEvaluator.evaluation);
  const initialTerminalFailure = initialStyleFailure || initialEvaluationFailure;
  const initialUnsupportedCategory = initialTerminalFailure === 'unsupported_claim'
    ? initialRoleIdentityFailure ? 'source_floor_mismatch'
      : unsupportedClaimCategory(snapshot, parsedWriter.candidate.text, parsedEvaluator.evaluation)
    : null;
  const initialEvidence = makeEvidence(snapshot, {
    writerAttempts: 1, evaluatorAttempts: 1, candidate: parsedWriter.candidate, evaluation: parsedEvaluator.evaluation,
    localFailureReason: initialStyleFailure,
    unsupportedClaimCategory: initialUnsupportedCategory,
    sourceFloorMismatchClass: initialUnsupportedCategory === 'source_floor_mismatch'
      ? sourceFloorMismatchClass(snapshot, parsedWriter.candidate.text, parsedEvaluator.evaluation)
      : null,
    evaluatorNoOpClaimed: parsedEvaluator.evaluation.styleEvidence.noOpDetected,
    safeNoOpConsidered: initialTerminalFailure === 'unsupported_claim'
      && sourceRetainingSafeNoOpAllowedForCandidate(snapshot, parsedWriter.candidate.text),
  });
  if (initialHardRejection) {
    return finishInitial(initialHardRejection === 'unsupported_claim'
      && sourceRetainingSafeNoOpAllowedForCandidate(snapshot, parsedWriter.candidate.text, undefined, observeSafeNoOpEligibility)
      ? safeNoOpResult(snapshot, initialEvidence, initialUnsupportedCategory)
      : createSummaryV3StyleHandledFailure(snapshot, initialHardRejection,
        postEvaluatorFailureEvidence(initialEvidence, parsedEvaluator.evaluation, initialHardRejection)));
  }
  if (allPhasesPassed(parsedEvaluator.evaluation) && !initialStyleFailure) {
    if (snapshot.mode === 'enhance_existing_content' && parsedEvaluator.evaluation.styleEvidence.noOpDetected) {
      const evaluatorRoleIdentityResolution = parsedEvaluator.evaluation.roleIdentityResolution;
      const sourceRetainingAllowed = snapshot.style !== 'stronger'
        || sourceRetainingSafeNoOpAllowedForCandidate(
          snapshot,
          parsedWriter.candidate.text,
          evaluatorRoleIdentityResolution,
          observeSafeNoOpEligibility,
        );
      const effectiveEligibilityReason = sourceRetainingSafeNoOpEligibilityReason(
        snapshot,
        evaluatorRoleIdentityResolution,
      );
      return finishInitial(sourceRetainingAllowed
        ? safeNoOpResult(snapshot, makeEvidence(snapshot, {
          writerAttempts: 1,
          evaluatorAttempts: 1,
          candidate: parsedWriter.candidate,
          evaluation: parsedEvaluator.evaluation,
          safeNoOpEligibilityReason: effectiveEligibilityReason,
          evaluatorNoOpClaimed: true,
          sourceFloorMismatchClass: null,
        }))
        : createSummaryV3StyleHandledFailure(snapshot, 'unsupported_claim', makeEvidence(snapshot, {
          writerAttempts: 1,
          evaluatorAttempts: 1,
          candidate: parsedWriter.candidate,
          evaluation: parsedEvaluator.evaluation,
          localFailureReason: 'unsupported_claim',
          unsupportedClaimCategory: 'source_floor_mismatch',
          sourceFloorMismatchClass: sourceFloorMismatchClass(
            snapshot,
            parsedWriter.candidate.text,
            parsedEvaluator.evaluation,
            true,
          ),
          safeNoOpEligibilityReason: effectiveEligibilityReason,
          evaluatorNoOpClaimed: true,
        })));
    }
    return finishInitial(candidateReady(snapshot, parsedWriter.candidate, initialEvidence));
  }
  // A no-op is terminal.  A malformed or rejected no-op claim must fail closed,
  // never trigger a repair merely to manufacture a different Summary.
  if (snapshot.mode === 'enhance_existing_content' && parsedEvaluator.evaluation.styleEvidence.noOpDetected) {
    return finishInitial(createSummaryV3StyleHandledFailure(snapshot, initialTerminalFailure || 'evaluator_rejected',
      postEvaluatorFailureEvidence(initialEvidence, parsedEvaluator.evaluation, initialStyleFailure)));
  }
  if (initialTerminalFailure === 'unsupported_claim'
    && sourceRetainingSafeNoOpAllowedForCandidate(snapshot, parsedWriter.candidate.text, undefined, observeSafeNoOpEligibility)) {
    return finishInitial(safeNoOpResult(snapshot, initialEvidence, initialUnsupportedCategory));
  }
  if (!canRepair(parsedEvaluator.evaluation) || !dependencies.repairWrite || !dependencies.repairEvaluate) {
    return finishInitial(createSummaryV3StyleHandledFailure(snapshot, initialTerminalFailure || 'evaluator_rejected',
      postEvaluatorFailureEvidence(initialEvidence, parsedEvaluator.evaluation, initialStyleFailure)));
  }

  const violations = allViolations(parsedEvaluator.evaluation);
  let rawRepairWriter: unknown;
  try {
    rawRepairWriter = await dependencies.repairWrite(immutableCopy({
      ...writerInput(snapshot), originalCandidate: parsedWriter.candidate, violations, repairOnly: true as const,
    }) as SummaryV3StyleRepairWriterInput);
  } catch (error) {
    return createSummaryV3StyleHandledFailure(snapshot, 'repair_request_failed', makeEvidence(snapshot, {
      writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1, candidate: parsedWriter.candidate, evaluation: parsedEvaluator.evaluation,
      m5ProviderFailure: orchestrationProviderFailure(error, 'repair_writer'),
    }));
  }
  const parsedRepairWriter = parseWriterOutput(rawRepairWriter, snapshot);
  if (!parsedRepairWriter.ok) {
    const reason = parsedRepairWriter.reason === 'writer_identity_mismatch' ? 'repair_identity_mismatch' : 'repair_transport_malformed';
    return createSummaryV3StyleHandledFailure(snapshot, reason, makeEvidence(snapshot, {
      writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1, candidate: parsedWriter.candidate, evaluation: parsedEvaluator.evaluation,
    }));
  }
  if (!repairCandidateStaysWithinViolationScope(snapshot, parsedWriter.candidate, parsedRepairWriter.candidate, violations)) {
    return createSummaryV3StyleHandledFailure(snapshot, 'repair_scope_violation', makeEvidence(snapshot, {
      writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1,
      candidate: parsedRepairWriter.candidate, evaluation: parsedEvaluator.evaluation,
    }));
  }
  if (hasUnattestedNonnumericMaterialResultRelation(snapshot, parsedRepairWriter.candidate.text)) {
    return createSummaryV3StyleHandledFailure(snapshot, 'unsupported_claim', makeEvidence(snapshot, {
      writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1,
      candidate: parsedRepairWriter.candidate, evaluation: parsedEvaluator.evaluation,
      localFailureReason: 'unsupported_claim',
    }));
  }
  let rawRepairEvaluator: unknown;
  try {
    rawRepairEvaluator = await dependencies.repairEvaluate(evaluatorInput(snapshot, parsedRepairWriter.candidate));
  } catch (error) {
    return createSummaryV3StyleHandledFailure(snapshot, 'repair_evaluator_request_failed', makeEvidence(snapshot, {
      writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1, repairEvaluatorAttempts: 1,
      candidate: parsedRepairWriter.candidate,
      m5ProviderFailure: orchestrationProviderFailure(error, 'post_repair_evaluator'),
    }));
  }
  const parsedRepairEvaluator = parseEvaluatorOutput(rawRepairEvaluator, snapshot, parsedRepairWriter.candidate);
  if (!parsedRepairEvaluator.ok) {
    return createSummaryV3StyleHandledFailure(snapshot, 'repair_evaluator_transport_malformed', makeEvidence(snapshot, {
      writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1, repairEvaluatorAttempts: 1,
      candidate: parsedRepairWriter.candidate,
      evaluatorOutputContractFailureClass: parsedRepairEvaluator.reason === 'evaluator_transport_malformed'
        ? parsedRepairEvaluator.evaluatorOutputContractFailureClass
        : null,
    }));
  }
  const repairNoOpClaimed = snapshot.mode === 'enhance_existing_content' && parsedRepairEvaluator.evaluation.styleEvidence.noOpDetected;
  let repairHardDecision: LocalHardDecision = { reason: null, predicate: null };
  const repairHardRejection = localHardRejection(snapshot, parsedRepairWriter.candidate.text,
    (decision) => { repairHardDecision = decision; });
  const repairRoleFailureClass = roleIdentityResolutionFailureClass(snapshot, parsedRepairEvaluator.evaluation);
  const repairRoleIdentityFailure = repairRoleFailureClass ? 'unsupported_claim' as const : null;
  const finishRepair = (result: SummaryV3StyleResult) => withLocalDecisionDiagnostics(
    result, snapshot, parsedRepairEvaluator.evaluation, repairHardDecision, repairRoleFailureClass, safeNoOpEligibility,
  );
  const repairStyleFailure = repairNoOpClaimed
    ? 'repair_rejected' as const
    : repairHardRejection || repairRoleIdentityFailure || (allPhasesPassed(parsedRepairEvaluator.evaluation)
      ? localStyleFailure(snapshot, parsedRepairWriter.candidate, parsedRepairEvaluator.evaluation.styleEvidence)
      : 'repair_rejected');
  const repairEvidence = makeEvidence(snapshot, {
    writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1, repairEvaluatorAttempts: 1,
    candidate: parsedRepairWriter.candidate, evaluation: parsedRepairEvaluator.evaluation,
    localFailureReason: repairStyleFailure,
    evaluatorNoOpClaimed: repairNoOpClaimed,
  });
  if (!allPhasesPassed(parsedRepairEvaluator.evaluation) || repairStyleFailure) {
    return finishRepair(createSummaryV3StyleHandledFailure(snapshot, repairStyleFailure || 'repair_rejected',
      postEvaluatorFailureEvidence(repairEvidence, parsedRepairEvaluator.evaluation,
        repairStyleFailure === 'repair_rejected' ? null : repairStyleFailure)));
  }
  return finishRepair(candidateReady(snapshot, parsedRepairWriter.candidate, repairEvidence));
}
