import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_SHORTER_SERVER_DERIVED_EVIDENCE_FIELDS,
  SUMMARY_V3_STYLE_STRATEGIES,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  normalizedSummaryV3StyleLength,
  projectSummaryV3StyleEvaluatorToolForProvider,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3StyleProviderTool,
  type SummaryV3Style,
  type SummaryV3StyleRequest,
  type SummaryV3StyleResult,
} from './summary-style-m5';
import {
  executeSummaryV3StyleServer,
  type SummaryV3StyleEvaluatorInput,
  type SummaryV3StyleRepairWriterInput,
  type SummaryV3StyleServerDependencies,
  type SummaryV3StyleWriterInput,
} from './summary-style-m5-server';
import { createSummaryV3ProviderTransportError } from './summary-generate-server';
import type { SummaryV3ProviderPhase } from './summary-generate';

/** The only route actions owned by M5.2. */
export const SUMMARY_V3_STYLE_M5_ROUTE_ACTIONS = {
  summary_shorter: 'shorter',
  summary_stronger: 'stronger',
  summary_professional: 'professional',
} as const satisfies Readonly<Record<string, SummaryV3Style>>;

export type SummaryV3StyleRouteAction = keyof typeof SUMMARY_V3_STYLE_M5_ROUTE_ACTIONS;

export function isSummaryV3StyleRouteAction(value: unknown): value is SummaryV3StyleRouteAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SUMMARY_V3_STYLE_M5_ROUTE_ACTIONS, value);
}

export interface SummaryV3StyleRouteParams {
  readonly enabled?: unknown;
  readonly operationId?: unknown;
  readonly requestedLocale?: unknown;
  readonly sourceLocale?: unknown;
  readonly locale?: unknown;
  readonly visibleSummary?: unknown;
  readonly visibleSummaryFacts?: unknown;
  readonly protectedEntities?: unknown;
  readonly manifest?: unknown;
  readonly requestIdentity?: unknown;
}

/**
 * Route normalization owns only the action/style identity. The committed M5.1
 * executor remains the authority for every other request invariant.
 */
export function normalizeSummaryV3StyleRouteRequest(
  action: SummaryV3StyleRouteAction,
  params: SummaryV3StyleRouteParams,
  createdAt: number,
): SummaryV3StyleRequest {
  const requestedLocale = params.requestedLocale ?? params.locale;
  const sourceLocale = params.sourceLocale ?? params.locale;
  return {
    enabled: params.enabled as boolean,
    operation: action,
    operationId: params.operationId as string,
    style: SUMMARY_V3_STYLE_M5_ROUTE_ACTIONS[action],
    requestedLocale: requestedLocale as string,
    sourceLocale: sourceLocale as string,
    visibleSummary: params.visibleSummary as string,
    visibleSummaryFacts: Array.isArray(params.visibleSummaryFacts)
      ? params.visibleSummaryFacts as SummaryV3StyleRequest['visibleSummaryFacts']
      : undefined,
    protectedEntities: Array.isArray(params.protectedEntities)
      ? params.protectedEntities.filter((value): value is string => typeof value === 'string')
      : undefined,
    manifest: params.manifest as SummaryV3StyleRequest['manifest'],
    requestIdentity: typeof params.requestIdentity === 'string' ? params.requestIdentity : undefined,
    createdAt,
  };
}

export type SummaryV3StyleProviderPhase =
  | 'initial_writer'
  | 'initial_evaluator'
  | 'repair_writer'
  | 'repair_evaluator';

export type SummaryV3StyleProviderRole = 'writer' | 'evaluator';

export type SummaryV3StyleProviderInput =
  | SummaryV3StyleWriterInput
  | SummaryV3StyleEvaluatorInput
  | SummaryV3StyleRepairWriterInput;

export interface SummaryV3StyleProviderInvocation {
  readonly role: SummaryV3StyleProviderRole;
  readonly phase: SummaryV3StyleProviderPhase;
  readonly input: SummaryV3StyleProviderInput;
  readonly prompt: string;
  readonly toolName: typeof SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME | typeof SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME;
  readonly toolChoice: Readonly<{
    type: 'tool';
    name: string;
    disable_parallel_tool_use: true;
  }>;
  readonly strict: true;
  readonly expectedToolBlocks: 1;
  readonly allowedTextBlocks: 0;
  /** Provider-safe projection; input.forcedTool.schema remains authoritative for local validation. */
  readonly tool: SummaryV3StyleProviderTool;
  readonly timeoutMs: number;
}

export type SummaryV3StyleProviderCall = (
  invocation: SummaryV3StyleProviderInvocation,
) => Promise<unknown>;

export interface SummaryV3StyleProviderAdapterOptions {
  readonly invoke: SummaryV3StyleProviderCall;
  readonly timeoutForPhase: (phase: SummaryV3StyleProviderPhase) => number;
  readonly now?: () => number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isWriterInput(
  input: SummaryV3StyleProviderInput,
): input is SummaryV3StyleWriterInput | SummaryV3StyleRepairWriterInput {
  return input.forcedTool.toolName === SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME;
}

function providerPrompt(input: SummaryV3StyleProviderInput): string {
  const strongerWriterInstruction = isWriterInput(input) && input.style === 'stronger'
    ? [
      'STRONGER SOURCE AUTHORITY: sourceText is the sole fact authority for enhance_existing_content.',
      'Strengthen grounded predicates and wording first. Preserve duties as duties.',
      'Do not turn duties into achievements, accomplishments, results, impact, metrics, savings, revenue, efficiency gains, performance gains, leadership, or broader authority.',
      'Those claims are allowed only when sourceText explicitly contains them.',
      'If no meaningful grounded strengthening is possible, submit sourceText unchanged as the single safe-no-op candidate.',
    ].join('\n')
    : null;
  const evaluatorReferenceDomainInstruction = !isWriterInput(input)
    ? [
      'IMMUTABLE EVALUATOR REFERENCE DOMAIN: representedFactIdHashes and missingFactIdHashes may contain only allowedFactHashes. Every violation factIdHashes may contain only allowedFactHashes. Every violation unitHashes may contain only allowedUnitHashes. Select from these exact values; do not invent identifiers.',
      JSON.stringify({
        allowedFactHashes: input.requiredFacts.map((fact) => fact.hash),
        allowedUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
      }),
    ].join('\n')
    : null;
  const unresolvedRoleIdentityInstruction = !isWriterInput(input) && input.roleIdentity.status === 'unresolved'
    ? [
      'UNRESOLVED ROLE IDENTITY OBLIGATION: semantically compare the selected Experience structuredRole with the role expressed in sourceText and candidate for the same employer and selectedEntryId.',
      'Use requested locale, roleSourceLocale, and the current-entry rolePresentation only as bounded evidence. Do not infer from another entry, personal/header job title, or external knowledge.',
      'Return roleIdentityResolution=equivalent only when the candidate role is semantically the same current Experience role; return contradiction for a different role and unresolved when the bounded evidence cannot establish either result.',
      'A generic semantic_grounding pass is not a substitute for this required role identity resolution.',
    ].join('\n')
    : null;
  return [
    'M5 SUMMARY STYLE OPERATION. Return only the required forced tool call.',
    'The tool input is the sole candidate/evidence transport. Do not return prose.',
    strongerWriterInstruction,
    evaluatorReferenceDomainInstruction,
    unresolvedRoleIdentityInstruction,
    JSON.stringify(input),
  ].filter((value): value is string => value !== null).join('\n\n');
}

function invocationFor(
  input: SummaryV3StyleProviderInput,
  phase: SummaryV3StyleProviderPhase,
  timeoutMs: number,
): SummaryV3StyleProviderInvocation {
  const forcedTool = input.forcedTool;
  const role: SummaryV3StyleProviderRole = isWriterInput(input) ? 'writer' : 'evaluator';
  return {
    role,
    phase,
    input,
    prompt: providerPrompt(input),
    toolName: forcedTool.toolName,
    toolChoice: { type: 'tool', name: forcedTool.toolName, disable_parallel_tool_use: true },
    strict: true,
    expectedToolBlocks: 1,
    allowedTextBlocks: 0,
    tool: role === 'writer'
      ? SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL
      : projectSummaryV3StyleEvaluatorToolForProvider(input.style, {
        allowedFactHashes: (input as SummaryV3StyleEvaluatorInput).requiredFacts.map((fact) => fact.hash),
        allowedUnitHashes: (input as SummaryV3StyleEvaluatorInput).candidate.units.map(summaryV3StyleCandidateUnitHash),
      }),
    timeoutMs,
  };
}

/**
 * Convert a raw provider message into the exact envelope consumed by the
 * committed M5.1 parser. There is intentionally no text/prose fallback.
 */
export function normalizeSummaryV3StyleProviderResponse(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    return {
      toolName: null,
      contentBlockCount: 0,
      textBlockCount: 0,
      toolBlockCount: 0,
      input: null,
    };
  }
  const content = value.content;
  const toolBlocks = content.filter((block) => isRecord(block) && block.type === 'tool_use');
  const textBlockCount = content.filter((block) => isRecord(block) && block.type === 'text').length;
  const toolName = toolBlocks.length === 1 && typeof toolBlocks[0].name === 'string'
    ? toolBlocks[0].name
    : null;
  return {
    toolName,
    contentBlockCount: content.length,
    textBlockCount,
    toolBlockCount: toolBlocks.length,
    input: toolBlocks.length === 1 ? toolBlocks[0].input : null,
  };
}

const EVALUATOR_PROVIDER_KEYS = [
  'structuralStatus', 'structuralViolations',
  'semantic_groundingStatus', 'semantic_groundingViolations',
  'language_native_qualityStatus', 'language_native_qualityViolations',
  'style_fulfillmentStatus', 'style_fulfillmentViolations',
  'representedFactIdHashes', 'missingFactIdHashes', 'roleIdentityResolution', 'styleEvidence',
] as const;

const LEGACY_EVALUATOR_KEYS = [
  'operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'candidateHash', 'candidateUnitHashes',
  'phases', 'representedFactIdHashes', 'missingFactIdHashes', 'roleIdentityResolution', 'styleEvidence',
] as const;

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

/**
 * Rehydrates only immutable evaluator context omitted from the provider wire,
 * and reconstructs phases for the existing authoritative local parser. Any
 * extra/missing provider key is preserved as malformed so local validation
 * fails closed instead of silently accepting an altered shape.
 */
export function normalizeSummaryV3StyleEvaluatorProviderResponse(
  value: unknown,
  input: SummaryV3StyleEvaluatorInput,
): unknown {
  const envelope = normalizeSummaryV3StyleProviderResponse(value);
  if (!isRecord(envelope) || !isRecord(envelope.input)) return envelope;
  const raw = envelope.input;
  // Anthropic's strict evaluator tool has physically omitted the empty
  // style_fulfillmentViolations array while returning the corresponding
  // status as "passed". Treat that one implied-empty case as a bounded C2
  // transport normalization; every extra key and every other omission stays
  // fail-closed at the exact-key gate below.
  const normalizedRaw = !Object.prototype.hasOwnProperty.call(raw, 'style_fulfillmentViolations')
    && raw.style_fulfillmentStatus === 'passed'
    && hasExactKeys(raw, EVALUATOR_PROVIDER_KEYS.filter((key) => key !== 'style_fulfillmentViolations'))
    ? { ...raw, style_fulfillmentViolations: [] }
    : raw;
  // Synthetic/offline callers from the pre-minimization contract may still
  // provide the full local envelope. Keep that shape parser-compatible while
  // all real evaluator requests use the strict shallow provider projection.
  if (hasExactKeys(raw, LEGACY_EVALUATOR_KEYS)) return envelope;
  if (!hasExactKeys(normalizedRaw, EVALUATOR_PROVIDER_KEYS)) return envelope;
  if (!isRecord(normalizedRaw.styleEvidence)) return envelope;

  let styleEvidence: Record<string, unknown>;
  if (input.style === 'shorter') {
    const providerKeys = SUMMARY_V3_STYLE_STRATEGIES.shorter.requiredEvidenceKeys.filter(
      (key) => key !== 'style'
        && !SUMMARY_V3_STYLE_M5_SHORTER_SERVER_DERIVED_EVIDENCE_FIELDS.includes(
          key as typeof SUMMARY_V3_STYLE_M5_SHORTER_SERVER_DERIVED_EVIDENCE_FIELDS[number],
        ),
    );
    if (!hasExactKeys(normalizedRaw.styleEvidence, providerKeys)) return envelope;
    const sourceNormalizedLength = normalizedSummaryV3StyleLength(input.sourceText);
    const candidateNormalizedLength = input.candidate.normalizedLength;
    const lengthDelta = sourceNormalizedLength - candidateNormalizedLength;
    styleEvidence = {
      ...normalizedRaw.styleEvidence,
      style: input.style,
      sourceNormalizedLength,
      candidateNormalizedLength,
      lengthDelta,
      lengthDeltaPercent: sourceNormalizedLength > 0 ? lengthDelta / sourceNormalizedLength : 0,
      sourceUnitCount: countSummaryV3StyleUnits(input.sourceText),
      candidateUnitCount: input.candidate.unitCount,
      sourceClauseCount: countSummaryV3StyleClauses(input.sourceText),
      candidateClauseCount: input.candidate.clauseCount,
      factCoverage: Array.isArray(normalizedRaw.missingFactIdHashes)
        && normalizedRaw.missingFactIdHashes.length === 0,
    };
  } else {
    styleEvidence = { ...normalizedRaw.styleEvidence, style: input.style };
  }
  const phases: Record<string, unknown> = {};
  for (const phase of ['structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment'] as const) {
    phases[phase] = {
      status: normalizedRaw[`${phase}Status`],
      violations: normalizedRaw[`${phase}Violations`],
    };
  }
  return {
    ...envelope,
    input: {
      operationId: input.operationId,
      snapshotHash: input.snapshotHash,
      manifestHash: input.manifestHash,
      style: input.style,
      locale: input.locale,
      candidateHash: input.candidate.hash,
      candidateUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
      phases,
      representedFactIdHashes: normalizedRaw.representedFactIdHashes,
      missingFactIdHashes: normalizedRaw.missingFactIdHashes,
      roleIdentityResolution: normalizedRaw.roleIdentityResolution,
      styleEvidence,
    },
  };
}

function createDependencies(options: SummaryV3StyleProviderAdapterOptions): SummaryV3StyleServerDependencies {
  const sharedPhase = (phase: SummaryV3StyleProviderPhase): SummaryV3ProviderPhase => (
    phase === 'repair_evaluator' ? 'post_repair_evaluator' : phase
  );
  const invoke = async (
    input: SummaryV3StyleProviderInput,
    phase: SummaryV3StyleProviderPhase,
  ): Promise<unknown> => {
    let invocation: SummaryV3StyleProviderInvocation;
    try {
      invocation = invocationFor(input, phase, options.timeoutForPhase(phase));
    } catch (error) {
      throw createSummaryV3ProviderTransportError(error, sharedPhase(phase), 'request_construction');
    }
    let response: unknown;
    try {
      response = await options.invoke(invocation);
    } catch (error) {
      throw createSummaryV3ProviderTransportError(error, sharedPhase(phase), 'sdk_request');
    }
    try {
      return isWriterInput(input)
        ? normalizeSummaryV3StyleProviderResponse(response)
        : normalizeSummaryV3StyleEvaluatorProviderResponse(response, input as SummaryV3StyleEvaluatorInput);
    } catch (error) {
      throw createSummaryV3ProviderTransportError(error, sharedPhase(phase), 'response_extraction');
    }
  };

  return {
    write: (input) => invoke(input, 'initial_writer'),
    evaluate: (input) => invoke(input, 'initial_evaluator'),
    repairWrite: (input) => invoke(input, 'repair_writer'),
    repairEvaluate: (input) => invoke(input, 'repair_evaluator'),
    now: options.now,
  };
}

/**
 * One shared route/provider integration entry point for all three M5 styles.
 * The route supplies the existing deadline-aware provider call; this module
 * owns only transport adaptation and delegates domain semantics to M5.1.
 */
export async function executeSummaryV3StyleRoute(
  request: SummaryV3StyleRequest,
  options: SummaryV3StyleProviderAdapterOptions,
): Promise<SummaryV3StyleResult> {
  return executeSummaryV3StyleServer(request, createDependencies(options));
}
