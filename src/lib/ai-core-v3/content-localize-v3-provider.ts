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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as { stop_reason?: unknown; content?: unknown };
  if (response.stop_reason !== 'tool_use' || !Array.isArray(response.content) || response.content.length !== 1) return null;
  const block = response.content[0];
  if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
  const candidate = block as { type?: unknown; name?: unknown; input?: unknown };
  return candidate.type === 'tool_use' && candidate.name === expectedToolName && 'input' in candidate
    ? candidate.input
    : null;
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
