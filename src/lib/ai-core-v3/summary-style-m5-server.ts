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
  summaryV3StyleCandidatePreservesCalendarDateSurfaces,
  summaryV3StyleCandidatePreservesExactMaterialSurfaces,
  summaryV3StyleCandidatePreservesEntityFactBindings,
  summaryV3StyleCandidateUnitHash,
  summaryV3StyleCalendarDateRanges,
  summaryV3StyleCandidateRepresentsRequiredFacts,
  summaryV3StyleCandidateUnitsRepresentDeclaredFacts,
  summaryV3StyleCandidatePreservesLocks,
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
  type SummaryV3StylePhase,
  type SummaryV3StylePhaseStatus,
  type SummaryV3StyleRequest,
  type SummaryV3StyleResult,
  type SummaryV3StyleRoleIdentityResolution,
  type SummaryV3StyleSafeNoOpEligibilityReason,
  type SummaryV3StyleUnsupportedClaimCategory,
  type SummaryV3StyleWriterOutputContractFailureClass,
  type SummaryV3StyleViolation,
  type SummaryV3StyleViolationCode,
} from './summary-style-m5';
import { immutableCopy } from './immutability';
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
  | Readonly<{ ok: false; reason: 'lost_source_fact'; writerOutputContractFailureClass: SummaryV3StyleWriterOutputContractFailureClass }>;

type EvaluatorParseResult =
  | Readonly<{ ok: true; evaluation: ParsedEvaluation }>
  | Readonly<{ ok: false; reason: 'evaluator_transport_malformed' | 'evaluator_rejected' }>;

function writerFailure(
  reason: Extract<WriterParseResult, { ok: false }>['reason'],
  writerOutputContractFailureClass?: SummaryV3StyleWriterOutputContractFailureClass,
): WriterParseResult {
  return immutableCopy({
    ok: false as const,
    reason,
    ...(writerOutputContractFailureClass ? { writerOutputContractFailureClass } : {}),
  }) as WriterParseResult;
}

function evaluatorFailure(reason: Extract<EvaluatorParseResult, { ok: false }>['reason']): EvaluatorParseResult {
  return immutableCopy({ ok: false as const, reason }) as EvaluatorParseResult;
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

const PRIOR_STATE_MARKERS = /(?:former|previous|past|completed|ehemalig(?:e|er|es|en)?|früher|bivš\w*|prethod\w*|पूर्व|सابق|前職|以前)/iu;
const CURRENT_STATE_MARKERS = /(?:current(?:ly)?|present|ongoing|aktuell(?:e|er|es|en)?|trenutn\w*|वर्तमान|حالي(?:ة|ا)?|現在)/iu;

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

/** Compact fail-closed state bound, including a role-local mixed-state check. */
function hasEmploymentStateContradiction(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  const states = snapshot.selectedEntries.map((entry) => entry.employmentState);
  if (states.length === 0) return false;
  const candidateClauses = summaryV3StyleIdentityClauses(candidateText);
  for (const entry of snapshot.selectedEntries) {
    const sameClause = candidateClauses.filter((clause) =>
      exactEntryIdsInSummaryV3StyleClause(snapshot, clause).has(entry.stableId));
    if (entry.employmentState === 'present' && sameClause.some((clause) => PRIOR_STATE_MARKERS.test(clause))) return true;
    if (entry.employmentState === 'completed' && sameClause.some((clause) => CURRENT_STATE_MARKERS.test(clause))) return true;
  }
  if (snapshot.mode === 'enhance_existing_content') {
    const sourceHasPrior = PRIOR_STATE_MARKERS.test(snapshot.sourceSummary);
    const sourceHasCurrent = CURRENT_STATE_MARKERS.test(snapshot.sourceSummary);
    if (PRIOR_STATE_MARKERS.test(candidateText) !== sourceHasPrior) return true;
    if (CURRENT_STATE_MARKERS.test(candidateText) !== sourceHasCurrent) return true;
  }
  if (states.every((state) => state === 'present')) return PRIOR_STATE_MARKERS.test(candidateText);
  if (states.every((state) => state === 'completed')) return CURRENT_STATE_MARKERS.test(candidateText);
  return false;
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
        && (unmatchedKeywords.length === 0 || candidateRelationUsesMarkedPredicateReplacement(
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
function localHardRejection(
  snapshot: SummaryV3StyleOperationSnapshot,
  candidateText: string,
): Extract<SummaryV3StyleFailureReason, 'unsupported_claim'> | null {
  // Language/native surface has the more specific typed terminal. Let the
  // regular local style guard classify it before considering ceiling facts.
  if (!summaryV3StyleLocaleSurfaceMatches(candidateText, snapshot.requestedLocale)
    || !summaryV3StyleLocaleContentMatches(candidateText, snapshot.requestedLocale)) return null;
  if (hasUnsupportedSourceInconsistency(snapshot)
    || hasInjectedManifestFact(snapshot, candidateText)
    || hasUnsupportedAuthorityOrSeniority(snapshot, candidateText)
    || hasUnsupportedNumericMetric(snapshot, candidateText)
    || hasUnsupportedCandidateSemanticMaterial(snapshot, candidateText)
    || hasUnsupportedCandidateNamedToolSurface(snapshot, candidateText)
    || hasEmploymentStateContradiction(snapshot, candidateText)) return 'unsupported_claim';
  return null;
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

function isSingleDecorativeLexicalSwap(source: string, candidate: string): boolean {
  if (countSummaryV3StyleUnits(source) !== countSummaryV3StyleUnits(candidate)
    || countSummaryV3StyleClauses(source) !== countSummaryV3StyleClauses(candidate)) return false;
  const tokens = (value: string) => new Set((normalizeSummaryV3StyleText(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
  const sourceTokens = tokens(source);
  const candidateTokens = tokens(candidate);
  const removed = Array.from(sourceTokens).filter((token) => !candidateTokens.has(token));
  const added = Array.from(candidateTokens).filter((token) => !sourceTokens.has(token));
  return removed.length <= 1 && added.length <= 1 && removed.length + added.length > 0;
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
): SummaryV3StyleWriterOutputContractFailureClass | null {
  if (coverage.missingFactCount > 0) return 'required_fact_coverage';
  if (!summaryV3StyleCandidatePreservesLocks(snapshot, candidate.text)) return 'source_lock_preservation';
  if (!summaryV3StyleCandidatePreservesCalendarDateSurfaces(snapshot, candidate.text)) return 'calendar_date_source_floor';
  if (!summaryV3StyleCandidatePreservesExactMaterialSurfaces(snapshot, candidate.text)) return 'exact_material_source_floor';
  if (!summaryV3StyleCandidatePreservesEntityFactBindings(snapshot, candidate.text)) return 'entity_fact_binding_preservation';
  if (!summaryV3StyleCandidateRepresentsRequiredFacts(snapshot, candidate.text)) return 'candidate_source_floor';
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
  const writerOutputContractFailureClass = classifyWriterOutputContractFailure(snapshot, candidate, coverage);
  if (writerOutputContractFailureClass) return writerFailure('lost_source_fact', writerOutputContractFailureClass);
  return immutableCopy({ ok: true, candidate });
}

function parseViolation(value: unknown): SummaryV3StyleViolation | null {
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
    || new Set(value.factIdHashes).size !== value.factIdHashes.length
    || new Set(value.unitHashes).size !== value.unitHashes.length
    || typeof value.repairable !== 'boolean') {
    return null;
  }
  return immutableCopy({
    code: value.code,
    factIdHashes: value.factIdHashes,
    unitHashes: value.unitHashes,
    repairable: value.repairable,
  }) as SummaryV3StyleViolation;
}

function parsePhase(value: unknown): Readonly<{ status: SummaryV3StylePhaseStatus; violations: readonly SummaryV3StyleViolation[] }> | null {
  if (!isSummaryV3StyleRecord(value) || !summaryV3StyleHasExactKeys(value, ['status', 'violations'])
    || (value.status !== 'passed' && value.status !== 'failed') || !Array.isArray(value.violations) || value.violations.length > 32) return null;
  const violations: SummaryV3StyleViolation[] = [];
  for (const violation of value.violations) {
    const parsed = parseViolation(violation);
    if (!parsed) return null;
    violations.push(parsed);
  }
  if ((value.status === 'passed' && violations.length > 0) || (value.status === 'failed' && violations.length === 0)) return null;
  return immutableCopy({ status: value.status, violations }) as Readonly<{ status: SummaryV3StylePhaseStatus; violations: readonly SummaryV3StyleViolation[] }>;
}

function parseStyleEvidence(value: unknown, snapshot: SummaryV3StyleOperationSnapshot): ParsedStyleEvidence | null {
  if (!isSummaryV3StyleRecord(value) || value.style !== snapshot.style) return null;
  if (snapshot.style === 'shorter') {
    const keys = SUMMARY_V3_STYLE_STRATEGIES.shorter.requiredEvidenceKeys;
    if (!summaryV3StyleHasExactKeys(value, keys)) return null;
    const values = [
      count(value.semanticCompressionOperations), count(value.sourceNormalizedLength), count(value.candidateNormalizedLength), signedCount(value.lengthDelta, 12_000),
      count(value.sourceUnitCount), count(value.candidateUnitCount), count(value.sourceClauseCount), count(value.candidateClauseCount),
    ];
    const lengthDeltaPercent = typeof value.lengthDeltaPercent === 'number' && Number.isFinite(value.lengthDeltaPercent)
      && value.lengthDeltaPercent >= -1 && value.lengthDeltaPercent <= 1 ? value.lengthDeltaPercent : null;
    const factCoverage = bool(value.factCoverage);
    const shorterFulfilled = bool(value.shorterFulfilled);
    const noOpDetected = bool(value.noOpDetected);
    if (values.some((item) => item === null) || lengthDeltaPercent === null || factCoverage === null || shorterFulfilled === null || noOpDetected === null) return null;
    return immutableCopy({
      style: 'shorter', semanticCompressionOperations: values[0]!, sourceNormalizedLength: values[1]!,
      candidateNormalizedLength: values[2]!, lengthDelta: values[3]!, lengthDeltaPercent, sourceUnitCount: values[4]!, candidateUnitCount: values[5]!,
      sourceClauseCount: values[6]!, candidateClauseCount: values[7]!, factCoverage, shorterFulfilled, noOpDetected,
    }) as ParsedShorterEvidence;
  }
  if (snapshot.style === 'stronger') {
    const keys = SUMMARY_V3_STYLE_STRATEGIES.stronger.requiredEvidenceKeys;
    if (!summaryV3StyleHasExactKeys(value, keys)) return null;
    const transformationCount = count(value.strongerPredicateTransformations);
    const structuralCount = count(value.structuralStrengtheningCount);
    const repeatedCount = count(value.repeatedStyleModifierCount);
    const modifierOnly = bool(value.modifierOnlyTransformationDetected);
    const stacked = bool(value.stackedModifierDetected);
    const unsupportedAuthority = bool(value.unsupportedAuthorityDetected);
    const fulfilled = bool(value.strongerFulfilled);
    const noOpDetected = bool(value.noOpDetected);
    if ([transformationCount, structuralCount, repeatedCount, modifierOnly, stacked, unsupportedAuthority, fulfilled, noOpDetected].some((item) => item === null)) return null;
    return immutableCopy({
      style: 'stronger', strongerPredicateTransformations: transformationCount!, structuralStrengtheningCount: structuralCount!,
      modifierOnlyTransformationDetected: modifierOnly!, repeatedStyleModifierCount: repeatedCount!, stackedModifierDetected: stacked!,
      unsupportedAuthorityDetected: unsupportedAuthority!, strongerFulfilled: fulfilled!, noOpDetected: noOpDetected!,
    }) as ParsedStrongerEvidence;
  }
  const keys = SUMMARY_V3_STYLE_STRATEGIES.professional.requiredEvidenceKeys;
  if (!summaryV3StyleHasExactKeys(value, keys)) return null;
  const framing = count(value.professionalFramingOperations);
  const cohesion = count(value.cohesionClarityOperations);
  const marker = bool(value.markerOnlyChangeDetected);
  const jargon = bool(value.jargonOrFillerDetected);
  const fulfilled = bool(value.professionalFulfilled);
  const noOpDetected = bool(value.noOpDetected);
  if ([framing, cohesion, marker, jargon, fulfilled, noOpDetected].some((item) => item === null)) return null;
  return immutableCopy({
    style: 'professional', professionalFramingOperations: framing!, cohesionClarityOperations: cohesion!,
    markerOnlyChangeDetected: marker!, jargonOrFillerDetected: jargon!, professionalFulfilled: fulfilled!, noOpDetected: noOpDetected!,
  }) as ParsedProfessionalEvidence;
}

function parseEvaluatorOutput(
  value: unknown,
  snapshot: SummaryV3StyleOperationSnapshot,
  candidate: SummaryV3StyleCandidate,
): EvaluatorParseResult {
  if (!isSummaryV3StyleRecord(value)
    || !summaryV3StyleHasExactKeys(value, ['toolName', 'contentBlockCount', 'textBlockCount', 'toolBlockCount', 'input'])) {
    return evaluatorFailure('evaluator_transport_malformed');
  }
  if (value.toolName !== SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME
    || value.contentBlockCount !== 1 || value.textBlockCount !== 0 || value.toolBlockCount !== 1
    || !isSummaryV3StyleRecord(value.input)) {
    return evaluatorFailure('evaluator_transport_malformed');
  }
  const payload = value.input;
  if (!summaryV3StyleHasExactKeys(payload, [
    'operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'candidateHash', 'candidateUnitHashes', 'phases', 'representedFactIdHashes', 'missingFactIdHashes', 'roleIdentityResolution', 'styleEvidence',
  ])
    || !exactIdentity(payload, snapshot) || !isSummaryV3StyleRecord(payload.phases)) {
    return evaluatorFailure('evaluator_transport_malformed');
  }
  const candidateUnitHashes = payload.candidateUnitHashes;
  const expectedCandidateUnitHashes = candidate.units.map(summaryV3StyleCandidateUnitHash);
  if (payload.candidateHash !== candidate.hash
    || !Array.isArray(candidateUnitHashes)
    || candidateUnitHashes.length !== expectedCandidateUnitHashes.length
    || candidateUnitHashes.some((hash, index) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80 || hash !== expectedCandidateUnitHashes[index])) {
    return evaluatorFailure('evaluator_transport_malformed');
  }
  const representedFactIdHashes = payload.representedFactIdHashes;
  const missingFactIdHashes = payload.missingFactIdHashes;
  const roleIdentityResolution = payload.roleIdentityResolution;
  if (!Array.isArray(representedFactIdHashes) || !Array.isArray(missingFactIdHashes)
    || representedFactIdHashes.length > 256 || missingFactIdHashes.length > 256
    || representedFactIdHashes.some((hash) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80)
    || missingFactIdHashes.some((hash) => !summaryV3StyleIsNonBlank(hash) || hash.length > 80)
    || new Set(representedFactIdHashes).size !== representedFactIdHashes.length
    || new Set(missingFactIdHashes).size !== missingFactIdHashes.length
    || typeof roleIdentityResolution !== 'string'
    || !(SUMMARY_V3_STYLE_M5_ROLE_IDENTITY_RESOLUTIONS as readonly string[]).includes(roleIdentityResolution)) {
    return evaluatorFailure('evaluator_transport_malformed');
  }
  const allowedFactHashes = new Set(snapshot.requiredFacts.map((fact) => fact.hash));
  if (representedFactIdHashes.some((hash) => !allowedFactHashes.has(hash))
    || missingFactIdHashes.some((hash) => !allowedFactHashes.has(hash))
    || representedFactIdHashes.some((hash) => missingFactIdHashes.includes(hash))
    || new Set([...representedFactIdHashes, ...missingFactIdHashes]).size !== allowedFactHashes.size) {
    return evaluatorFailure('evaluator_transport_malformed');
  }
  if (!summaryV3StyleHasExactKeys(payload.phases, REQUIRED_PHASES)) return evaluatorFailure('evaluator_transport_malformed');
  const phases = {} as Record<SummaryV3StylePhase, Readonly<{ status: SummaryV3StylePhaseStatus; violations: readonly SummaryV3StyleViolation[] }>>;
  for (const name of REQUIRED_PHASES) {
    const phase = parsePhase(payload.phases[name]);
    if (!phase) return evaluatorFailure('evaluator_transport_malformed');
    const allowedUnitHashes = new Set(candidate.units.map(summaryV3StyleCandidateUnitHash));
    if (phase.violations.some((violation) => violation.factIdHashes.some((hash) => !allowedFactHashes.has(hash))
      || violation.unitHashes.some((hash) => !allowedUnitHashes.has(hash)))) {
      return evaluatorFailure('evaluator_transport_malformed');
    }
    phases[name] = phase;
  }
  const styleEvidence = parseStyleEvidence(payload.styleEvidence, snapshot);
  if (!styleEvidence) return evaluatorFailure('evaluator_transport_malformed');
  const semanticPhase = phases.semantic_grounding;
  const completeCoverage = representedFactIdHashes.length === allowedFactHashes.size
    && representedFactIdHashes.every((hash) => allowedFactHashes.has(hash))
    && missingFactIdHashes.length === 0;
  const missingFactViolationHashes = Array.from(new Set(semanticPhase.violations
    .filter((violation) => violation.code === 'missing_fact')
    .flatMap((violation) => violation.factIdHashes)));
  const missingPartitionMatchesViolations = missingFactViolationHashes.length === missingFactIdHashes.length
    && missingFactViolationHashes.every((hash) => missingFactIdHashes.includes(hash));
  if (!missingPartitionMatchesViolations) return evaluatorFailure('evaluator_transport_malformed');
  if (semanticPhase.status === 'passed' && !completeCoverage) return evaluatorFailure('evaluator_transport_malformed');
  return immutableCopy({
    ok: true,
    evaluation: {
      phases,
      representedFactIdHashes,
      missingFactIdHashes,
      roleIdentityResolution: roleIdentityResolution as SummaryV3StyleRoleIdentityResolution,
      styleEvidence,
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

function sourceRetainingSafeNoOpEligibilityReason(
  snapshot: SummaryV3StyleOperationSnapshot,
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
  if (roleIdentity.status === 'unresolved') return 'source_inconsistency';
  if (hasUnsupportedSourceNonnumericMaterialResultRelation(snapshot)) {
    return 'source_material_result_relation';
  }
  if (hasUnsupportedSourceInconsistency(snapshot)) return 'source_inconsistency';
  return 'eligible';
}

function sourceRetainingSafeNoOpAllowed(snapshot: SummaryV3StyleOperationSnapshot): boolean {
  return sourceRetainingSafeNoOpEligibilityReason(snapshot) === 'eligible';
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

function roleIdentityResolutionFailure(
  snapshot: SummaryV3StyleOperationSnapshot,
  evaluation: ParsedEvaluation,
): Extract<SummaryV3StyleFailureReason, 'unsupported_claim'> | null {
  if (evaluation.roleIdentityResolution === 'contradiction'
    || evaluation.roleIdentityResolution === 'unresolved') return 'unsupported_claim';
  return roleEmployerIdentityDecision(snapshot).status === 'unresolved'
    && evaluation.roleIdentityResolution !== 'equivalent' ? 'unsupported_claim' : null;
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
    || JARGON_PATTERN.test(candidate.text) || isSingleDecorativeLexicalSwap(source, candidate.text)
    || (strategy.minimumExistingSourceLengthRatio > 0 && candidate.normalizedLength < normalizedSummaryV3StyleLength(source) * strategy.minimumExistingSourceLengthRatio)
    || hasGroundedPredicateTransformation(snapshot, candidate.text)) return 'style_not_fulfilled';
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
    writerOutputContractFailureClass: update.writerOutputContractFailureClass ?? null,
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

function failureForEvaluation(evaluation: ParsedEvaluation): SummaryV3StyleFailureReason {
  const violations = allViolations(evaluation);
  if (violations.some((violation) => UNSUPPORTED_CLAIM_CODES.has(violation.code))) return 'unsupported_claim';
  if (violations.some((violation) => violation.code === 'lost_source_fact' || violation.code === 'missing_fact')) return 'lost_source_fact';
  if (violations.some((violation) => violation.code === 'stale_identity')) return 'stale_identity';
  if (violations.some((violation) => violation.code === 'invalid_language' || violation.code === 'invalid_native_surface')) return 'invalid_language_or_native_surface';
  if (violations.some((violation) => [
    'style_not_fulfilled', 'marker_only_change', 'modifier_only_change',
    'repeated_style_modifier', 'stacked_style_modifier', 'corporate_jargon',
  ].includes(violation.code))) return 'style_not_fulfilled';
  return 'evaluator_rejected';
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
    writerOutputContractFailureClass: parsedWriter.reason === 'lost_source_fact'
      ? parsedWriter.writerOutputContractFailureClass
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
      safeNoOpConsidered: sourceRetainingSafeNoOpAllowed(snapshot),
    });
    return sourceRetainingSafeNoOpAllowed(snapshot)
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
  if (!parsedEvaluator.ok) return createSummaryV3StyleHandledFailure(snapshot, parsedEvaluator.reason, makeEvidence(snapshot, { writerAttempts: 1, evaluatorAttempts: 1, candidate: parsedWriter.candidate }));
  const initialHardRejection = localHardRejection(snapshot, parsedWriter.candidate.text);
  const initialRoleIdentityFailure = roleIdentityResolutionFailure(snapshot, parsedEvaluator.evaluation);
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
    safeNoOpConsidered: initialTerminalFailure === 'unsupported_claim'
      && sourceRetainingSafeNoOpAllowed(snapshot),
  });
  if (initialHardRejection) {
    return sourceRetainingSafeNoOpAllowed(snapshot)
      ? safeNoOpResult(snapshot, initialEvidence, initialUnsupportedCategory)
      : createSummaryV3StyleHandledFailure(snapshot, initialHardRejection, initialEvidence);
  }
  if (allPhasesPassed(parsedEvaluator.evaluation) && !initialStyleFailure) {
    if (snapshot.mode === 'enhance_existing_content' && parsedEvaluator.evaluation.styleEvidence.noOpDetected) {
      const sourceRetainingAllowed = snapshot.style !== 'stronger' || sourceRetainingSafeNoOpAllowed(snapshot);
      return sourceRetainingAllowed
        ? safeNoOpResult(snapshot, initialEvidence)
        : createSummaryV3StyleHandledFailure(snapshot, 'unsupported_claim', makeEvidence(snapshot, {
          writerAttempts: 1,
          evaluatorAttempts: 1,
          candidate: parsedWriter.candidate,
          evaluation: parsedEvaluator.evaluation,
          localFailureReason: 'unsupported_claim',
          unsupportedClaimCategory: 'source_floor_mismatch',
        }));
    }
    return candidateReady(snapshot, parsedWriter.candidate, initialEvidence);
  }
  // A no-op is terminal.  A malformed or rejected no-op claim must fail closed,
  // never trigger a repair merely to manufacture a different Summary.
  if (snapshot.mode === 'enhance_existing_content' && parsedEvaluator.evaluation.styleEvidence.noOpDetected) {
    return createSummaryV3StyleHandledFailure(snapshot, initialTerminalFailure || 'evaluator_rejected', initialEvidence);
  }
  if (initialTerminalFailure === 'unsupported_claim' && sourceRetainingSafeNoOpAllowed(snapshot)) {
    return safeNoOpResult(snapshot, initialEvidence, initialUnsupportedCategory);
  }
  if (!canRepair(parsedEvaluator.evaluation) || !dependencies.repairWrite || !dependencies.repairEvaluate) {
    return createSummaryV3StyleHandledFailure(snapshot, initialTerminalFailure || 'evaluator_rejected', initialEvidence);
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
    }));
  }
  const repairNoOpClaimed = snapshot.mode === 'enhance_existing_content' && parsedRepairEvaluator.evaluation.styleEvidence.noOpDetected;
  const repairHardRejection = localHardRejection(snapshot, parsedRepairWriter.candidate.text);
  const repairRoleIdentityFailure = roleIdentityResolutionFailure(snapshot, parsedRepairEvaluator.evaluation);
  const repairStyleFailure = repairNoOpClaimed
    ? 'repair_rejected' as const
    : repairHardRejection || repairRoleIdentityFailure || (allPhasesPassed(parsedRepairEvaluator.evaluation)
      ? localStyleFailure(snapshot, parsedRepairWriter.candidate, parsedRepairEvaluator.evaluation.styleEvidence)
      : 'repair_rejected');
  const repairEvidence = makeEvidence(snapshot, {
    writerAttempts: 1, evaluatorAttempts: 1, repairWriterAttempts: 1, repairEvaluatorAttempts: 1,
    candidate: parsedRepairWriter.candidate, evaluation: parsedRepairEvaluator.evaluation,
    localFailureReason: repairStyleFailure,
  });
  if (!allPhasesPassed(parsedRepairEvaluator.evaluation) || repairStyleFailure) {
    return createSummaryV3StyleHandledFailure(snapshot, repairStyleFailure || 'repair_rejected', repairEvidence);
  }
  return candidateReady(snapshot, parsedRepairWriter.candidate, repairEvidence);
}
