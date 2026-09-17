import {
  AI_PROVIDER_CALL_TIMEOUT_MS,
  type ProviderCallOptions,
} from '@/lib/ai-request-timing';
import type {
  ContentLocalizeM6EvaluatorRequest,
  ContentLocalizeM6RepairRequest,
  ContentLocalizeM6ServerDependencies,
  ContentLocalizeM6WriterRequest,
} from './content-localize-m6-server';
import type { ContentLocalizeV3DiagnosticPhase } from './content-localize-v3-terminal-diagnostics';

export const CONTENT_LOCALIZE_V3_OPERATION = 'content-localize-v3' as const;

export type ContentLocalizeV3ProviderPhase = 'writer' | 'evaluator' | 'repair';
export type ContentLocalizeV3ProviderRequest =
  | ContentLocalizeM6WriterRequest
  | ContentLocalizeM6EvaluatorRequest
  | ContentLocalizeM6RepairRequest;

export type ContentLocalizeV3ForcedTool = Readonly<{
  name: string;
  description: string;
  strict: true;
  input_schema: Record<string, unknown>;
}>;

export type ContentLocalizeV3ProviderInvocation = Readonly<{
  phase: ContentLocalizeV3ProviderPhase;
  role: 'writer' | 'evaluator';
  request: ContentLocalizeV3ProviderRequest;
  prompt: string;
  system: string;
  tool: ContentLocalizeV3ForcedTool;
  timeoutMs: number;
  toolChoice: Readonly<{ type: 'tool'; name: string; disable_parallel_tool_use: true }>;
}>;

export interface ContentLocalizeV3ProviderTransport {
  readonly invoke: (
    invocation: ContentLocalizeV3ProviderInvocation,
    options: ProviderCallOptions,
  ) => Promise<unknown>;
}

export interface ContentLocalizeV3ProviderDependenciesOptions {
  readonly invoke: ContentLocalizeV3ProviderTransport['invoke'];
}

const PROVIDER_OBSERVATION = '__contentLocalizeV3Observation';

type ProviderResponseRecord = {
  stop_reason?: unknown;
  content?: unknown;
};

function withProviderObservation(value: unknown, observation: Partial<ContentLocalizeV3DiagnosticPhase>): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    // Keep malformed values parser-ineligible while carrying only request-local,
    // non-enumerable observation data. The array is unreachable with the caller's
    // result and therefore cannot accumulate in process-global state.
    const sentinel: unknown[] = [];
    Object.defineProperty(sentinel, PROVIDER_OBSERVATION, {
      value: observation,
      enumerable: false,
      configurable: false,
    });
    return sentinel;
  }
  const output = value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
  Object.defineProperty(output, PROVIDER_OBSERVATION, {
    value: observation,
    enumerable: false,
    configurable: false,
  });
  return output;
}

export function readContentLocalizeV3ProviderObservation(value: unknown): Partial<ContentLocalizeV3DiagnosticPhase> | null {
  if (!value || typeof value !== 'object') return null;
  const observation = (value as Record<string, unknown>)[PROVIDER_OBSERVATION];
  return observation && typeof observation === 'object' && !Array.isArray(observation)
    ? observation as Partial<ContentLocalizeV3DiagnosticPhase>
    : null;
}

const WRITER_TOOL_NAME = 'content_localize_m6_writer';
const EVALUATOR_TOOL_NAME = 'content_localize_m6_evaluator';
const REPAIR_TOOL_NAME = 'content_localize_m6_repair';

const WRITER_TOOL: ContentLocalizeV3ForcedTool = {
  name: WRITER_TOOL_NAME,
  description: 'Return the translated candidate with the exact request identity.',
  strict: true,
  input_schema: {
    type: 'object', additionalProperties: false,
    properties: {
      operationId: { type: 'string' }, requestId: { type: 'string' }, kind: { type: 'string' },
      sourceLocale: { type: 'string' }, targetLocale: { type: 'string' }, sourceTextHash: { type: 'string' },
      translatedText: { type: 'string' }, experienceEntryId: { type: 'string' },
    },
    required: ['operationId', 'requestId', 'kind', 'sourceLocale', 'targetLocale', 'sourceTextHash', 'translatedText'],
  },
};

const EVALUATOR_TOOL: ContentLocalizeV3ForcedTool = {
  name: EVALUATOR_TOOL_NAME,
  description: 'Return independent typed evidence for the exact candidate.',
  strict: true,
  input_schema: {
    type: 'object', additionalProperties: false,
    properties: {
      operationId: { type: 'string' }, requestId: { type: 'string' }, kind: { type: 'string' },
      sourceLocale: { type: 'string' }, targetLocale: { type: 'string' }, sourceTextHash: { type: 'string' },
      candidateTextHash: { type: 'string' }, accepted: { type: 'boolean' },
      meaningPreserved: { type: 'boolean' }, noFactsAdded: { type: 'boolean' }, noFactsRemoved: { type: 'boolean' },
      factualAnchorsPreserved: { type: 'boolean' }, targetLocaleSatisfied: { type: 'boolean' },
      professionalCvQuality: { type: 'boolean' }, noLeakage: { type: 'boolean' },
      reasonCodes: { type: 'array', items: { type: 'string' } }, experienceEntryId: { type: 'string' },
    },
    required: [
      'operationId', 'requestId', 'kind', 'sourceLocale', 'targetLocale', 'sourceTextHash', 'candidateTextHash',
      'accepted', 'meaningPreserved', 'noFactsAdded', 'noFactsRemoved', 'factualAnchorsPreserved',
      'targetLocaleSatisfied', 'professionalCvQuality', 'noLeakage', 'reasonCodes',
    ],
  },
};

const REPAIR_TOOL: ContentLocalizeV3ForcedTool = {
  ...WRITER_TOOL,
  name: REPAIR_TOOL_NAME,
  description: 'Return one repaired translated candidate with the exact request identity.',
};

const WRITER_SYSTEM = `Invoke only the ${WRITER_TOOL_NAME} tool. Translate only exact sourceText into targetLocale. Preserve every supported fact and add no commentary. Preserve names, brands, URLs, email addresses, numbers, dates, percentages, and currency values. Do not translate an Experience position/title or company.`;
const EVALUATOR_SYSTEM = `Invoke only the ${EVALUATOR_TOOL_NAME} tool. Independently evaluate the candidate against every criterion in criteria. Return a separate accepted boolean.`;
const REPAIR_SYSTEM = `Invoke only the ${REPAIR_TOOL_NAME} tool. Repair only the supplied primary candidate using the supplied reason codes and failed criteria. Preserve the exact source identity.`;

function toolForPhase(phase: ContentLocalizeV3ProviderPhase): ContentLocalizeV3ForcedTool {
  return phase === 'evaluator' ? EVALUATOR_TOOL : phase === 'repair' ? REPAIR_TOOL : WRITER_TOOL;
}

function roleForPhase(phase: ContentLocalizeV3ProviderPhase): 'writer' | 'evaluator' {
  return phase === 'evaluator' ? 'evaluator' : 'writer';
}

function systemForPhase(phase: ContentLocalizeV3ProviderPhase): string {
  return phase === 'evaluator' ? EVALUATOR_SYSTEM : phase === 'repair' ? REPAIR_SYSTEM : WRITER_SYSTEM;
}

function extractToolInput(value: unknown, expectedToolName: string): unknown {
  const response = value && typeof value === 'object' && !Array.isArray(value)
    ? value as ProviderResponseRecord
    : null;
  const content = response && Array.isArray(response.content) ? response.content : [];
  const blocks = content.filter((block) => block && typeof block === 'object' && !Array.isArray(block)) as Array<Record<string, unknown>>;
  const toolBlocks = blocks.filter((block) => block.type === 'tool_use');
  const matched = toolBlocks.find((block) => block.name === expectedToolName);
  const singleBlock = content.length === 1 && blocks.length === 1 ? blocks[0] : null;
  const strictMatch = response?.stop_reason === 'tool_use'
    && singleBlock?.type === 'tool_use'
    && singleBlock.name === expectedToolName
    && Object.prototype.hasOwnProperty.call(singleBlock, 'input');
  const matchedInput = matched && Object.prototype.hasOwnProperty.call(matched, 'input')
    ? matched.input
    : null;
  const input = strictMatch ? singleBlock.input : null;
  const observation: Partial<ContentLocalizeV3DiagnosticPhase> = {
    stopReason: typeof response?.stop_reason === 'string' ? response.stop_reason : null,
    contentBlockCount: content.length,
    textBlockCount: blocks.filter((block) => block.type === 'text').length,
    toolBlockCount: toolBlocks.length,
    expectedToolCount: 1,
    toolNameMatched: Boolean(matched),
    toolInputObject: Boolean(matchedInput && typeof matchedInput === 'object' && !Array.isArray(matchedInput)),
    toolInputSchemaPassed: null,
  };
  if (!strictMatch || !input || typeof input !== 'object' || Array.isArray(input)) {
    return withProviderObservation(null, observation);
  }
  return withProviderObservation(input, observation);
}

function invocationFor(
  phase: ContentLocalizeV3ProviderPhase,
  request: ContentLocalizeV3ProviderRequest,
): ContentLocalizeV3ProviderInvocation {
  const tool = toolForPhase(phase);
  return {
    phase,
    role: roleForPhase(phase),
    request,
    prompt: `M6 logical operation ${CONTENT_LOCALIZE_V3_OPERATION}. Follow the forced structured tool contract exactly.\n\nREQUEST_JSON:\n${JSON.stringify(request)}`,
    system: systemForPhase(phase),
    tool,
    timeoutMs: AI_PROVIDER_CALL_TIMEOUT_MS,
    toolChoice: { type: 'tool', name: tool.name, disable_parallel_tool_use: true },
  };
}

export function createContentLocalizeV3ProviderDependencies(
  options: ContentLocalizeV3ProviderDependenciesOptions,
): ContentLocalizeM6ServerDependencies {
  const invoke = (phase: ContentLocalizeV3ProviderPhase) => async (request: ContentLocalizeV3ProviderRequest): Promise<unknown> => {
    const invocation = invocationFor(phase, request);
    const response = await options.invoke(invocation, {});
    return extractToolInput(response, invocation.tool.name);
  };
  return {
    writer: invoke('writer') as ContentLocalizeM6ServerDependencies['writer'],
    evaluator: invoke('evaluator') as ContentLocalizeM6ServerDependencies['evaluator'],
    repair: invoke('repair') as ContentLocalizeM6ServerDependencies['repair'],
  };
}

export const CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES = Object.freeze({
  writer: WRITER_TOOL_NAME,
  evaluator: EVALUATOR_TOOL_NAME,
  repair: REPAIR_TOOL_NAME,
});
