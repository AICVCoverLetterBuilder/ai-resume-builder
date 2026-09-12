import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL,
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
  SUMMARY_V3_STYLE_M5_STYLES,
  SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_SHORTER_SERVER_DERIVED_EVIDENCE_FIELDS,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  normalizedSummaryV3StyleLength,
  projectSummaryV3StyleToolForProvider,
  projectSummaryV3StyleEvaluatorToolForProvider,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3Style,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleRoute,
  normalizeSummaryV3StyleEvaluatorProviderResponse,
  type SummaryV3StyleProviderInvocation,
} from '../summary-style-m5-provider';
import type { SummaryV3StyleEvaluatorInput } from '../summary-style-m5-server';

type AnthropicTool = NonNullable<Parameters<Anthropic['messages']['create']>[0]['tools']>[number];

const SOURCE = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';

function requestFor(style: SummaryV3Style = 'stronger'): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: `summary_${style}`,
    operationId: `m8-aab572-schema-${style}`,
    style,
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: SOURCE,
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' },
      { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' },
      { id: 'duty-api', text: 'builds reliable APIs' },
      { id: 'duty-mentor', text: 'mentors peers' },
      { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' },
    ],
    protectedEntities: ['Ava Patel'],
    manifest: {
      manifestId: 'm8-aab572-schema-manifest',
      contextId: 'm8-aab572-schema-context',
      sourceLocale: 'en',
      currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current',
        role: 'Product Engineer',
        employer: 'Atlas',
        employmentState: 'present',
        durationMonths: 24,
        facts: [
          { id: 'duty-api', text: 'builds reliable APIs' },
          { id: 'duty-mentor', text: 'mentors peers' },
          { id: 'metric', text: 'improved delivery by 20%' },
          { id: 'context-only-tool', text: 'Kubernetes' },
        ],
      }],
    },
    createdAt: 1_757_000_000_000,
  };
}

function styleEvidence(style: SummaryV3Style) {
  if (style === 'shorter') {
    return {
      style,
      semanticCompressionOperations: 0,
      sourceNormalizedLength: normalizedSummaryV3StyleLength(SOURCE),
      candidateNormalizedLength: normalizedSummaryV3StyleLength(SOURCE),
      lengthDelta: 0,
      lengthDeltaPercent: 0,
      sourceUnitCount: countSummaryV3StyleUnits(SOURCE),
      candidateUnitCount: countSummaryV3StyleUnits(SOURCE),
      sourceClauseCount: countSummaryV3StyleClauses(SOURCE),
      candidateClauseCount: countSummaryV3StyleClauses(SOURCE),
      factCoverage: true,
      shorterFulfilled: true,
      noOpDetected: true,
    };
  }
  if (style === 'stronger') {
    return {
      style,
      strongerPredicateTransformations: 0,
      structuralStrengtheningCount: 0,
      modifierOnlyTransformationDetected: false,
      repeatedStyleModifierCount: 0,
      stackedModifierDetected: false,
      unsupportedAuthorityDetected: false,
      strongerFulfilled: true,
      noOpDetected: true,
    };
  }
  return {
    style,
    professionalFramingOperations: 0,
    cohesionClarityOperations: 0,
    markerOnlyChangeDetected: false,
    jargonOrFillerDetected: false,
    professionalFulfilled: true,
    noOpDetected: true,
  };
}

function providerMessage(invocation: SummaryV3StyleProviderInvocation): unknown {
  if (invocation.role === 'writer') {
    const input = invocation.input;
    return {
      stop_reason: 'tool_use',
      content: [{
        type: 'tool_use',
        name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
        input: {
          operationId: input.operationId,
          snapshotHash: input.snapshotHash,
          manifestHash: input.manifestHash,
          style: input.style,
          locale: input.locale,
          units: [{ unitId: 'unit-0', text: input.sourceText, factIds: input.requiredFacts.map((fact) => fact.id) }],
        },
      }],
    };
  }
  const input = invocation.input;
  if (!('candidate' in input)) throw new Error('expected evaluator input');
  const evidence = styleEvidence(input.style) as Record<string, unknown>;
  delete evidence.style;
  if (input.style === 'shorter') {
    for (const field of SUMMARY_V3_STYLE_M5_SHORTER_SERVER_DERIVED_EVIDENCE_FIELDS) {
      delete evidence[field];
    }
  }
  return {
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
      input: {
        structuralStatus: 'passed',
        structuralViolations: [],
        semantic_groundingStatus: 'passed',
        semantic_groundingViolations: [],
        language_native_qualityStatus: 'passed',
        language_native_qualityViolations: [],
        style_fulfillmentStatus: 'passed',
        style_fulfillmentViolations: [],
        representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash),
        missingFactIdHashes: [],
        roleIdentityResolution: input.roleIdentity.status === 'unresolved' ? 'equivalent' : 'not_required',
        styleEvidence: evidence,
      },
    }],
  };
}

function providerRequest(invocation: SummaryV3StyleProviderInvocation) {
  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    temperature: 0,
    system: invocation.prompt,
    tools: [invocation.tool as AnthropicTool],
    tool_choice: invocation.toolChoice,
    messages: [{ role: 'user' as const, content: invocation.prompt }],
  };
}

function syntheticResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(status === 400 ? { 'request-id': 'req_m8_aab572_synthetic' } : {}),
    },
  });
}

type SchemaMetrics = {
  serializedBytes: number;
  objectNodeCount: number;
  arrayNodeCount: number;
  propertyCount: number;
  requiredParameterCount: number;
  optionalParameterCount: number;
  maximumNestingDepth: number;
  enumCount: number;
  totalEnumMemberCount: number;
  anyOfCount: number;
  anyOfBranchCount: number;
  unionParameterCount: number;
  unsupportedKeyCount: number;
};

function schemaMetrics(schema: unknown): SchemaMetrics {
  const unsupported = new Set([
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'minLength', 'maxLength', 'maxItems', 'maxContains', 'uniqueItems', 'contains',
    'minProperties', 'maxProperties', 'oneOf',
  ]);
  const metrics: SchemaMetrics = {
    serializedBytes: Buffer.byteLength(JSON.stringify(schema), 'utf8'),
    objectNodeCount: 0,
    arrayNodeCount: 0,
    propertyCount: 0,
    requiredParameterCount: 0,
    optionalParameterCount: 0,
    maximumNestingDepth: 0,
    enumCount: 0,
    totalEnumMemberCount: 0,
    anyOfCount: 0,
    anyOfBranchCount: 0,
    unionParameterCount: 0,
    unsupportedKeyCount: 0,
  };
  const visit = (value: unknown, depth: number, parentKey?: string): void => {
    metrics.maximumNestingDepth = Math.max(metrics.maximumNestingDepth, depth);
    if (Array.isArray(value)) {
      metrics.arrayNodeCount += 1;
      value.forEach((entry) => visit(entry, depth + 1, parentKey));
      return;
    }
    if (!value || typeof value !== 'object') return;
    metrics.objectNodeCount += 1;
    const record = value as Record<string, unknown>;
    if (record.properties && typeof record.properties === 'object' && !Array.isArray(record.properties)) {
      metrics.propertyCount += Object.keys(record.properties).length;
      const required = Array.isArray(record.required) ? record.required : [];
      metrics.requiredParameterCount += required.length;
      metrics.optionalParameterCount += Object.keys(record.properties).length - required.length;
    }
    if (Array.isArray(record.enum)) {
      metrics.enumCount += 1;
      metrics.totalEnumMemberCount += record.enum.length;
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === 'anyOf') {
        metrics.anyOfCount += 1;
        if (Array.isArray(child)) metrics.anyOfBranchCount += child.length;
      }
      if (key === 'anyOf' || key === 'type' && Array.isArray(child)) metrics.unionParameterCount += 1;
      if (unsupported.has(key)) metrics.unsupportedKeyCount += 1;
      visit(child, depth + 1, key);
    }
  };
  visit(schema, 0);
  return metrics;
}

function requestMetrics(body: Record<string, unknown>): SchemaMetrics {
  const tools = body.tools as Array<{ input_schema: unknown }>;
  return schemaMetrics(tools[0]?.input_schema);
}

describe('M8 AAB572 evaluator strict-schema fix', () => {
  it('narrows the real SDK evaluator wire schema to exactly one active style branch', async () => {
    const captured: Array<{ style: SummaryV3Style; body: Record<string, unknown> }> = [];
    let current: SummaryV3StyleProviderInvocation | null = null;
    const client = new Anthropic({
      apiKey: 'synthetic-test-key',
      maxRetries: 0,
      fetch: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        if (!current) throw new Error('missing invocation');
        captured.push({ style: current.input.style, body });
        return syntheticResponse(providerMessage(current));
      },
    });

    for (const style of SUMMARY_V3_STYLE_M5_STYLES) {
      current = null;
      const result = await executeSummaryV3StyleRoute(requestFor(style), {
        timeoutForPhase: () => 30_000,
        invoke: async (invocation) => {
          current = invocation;
          return client.messages.create(providerRequest(invocation));
        },
      });
      expect(result.kind, style).toBe('safe_no_op');
      const evaluator = captured.findLast((entry) => entry.style === style && (entry.body.tools as Array<{ name: string }>)[0]?.name === SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME);
      expect(evaluator, style).toBeDefined();
      const schema = ((evaluator?.body.tools as Array<{ input_schema: Record<string, unknown> }>)[0]).input_schema;
      const metrics = schemaMetrics(schema);
      expect(metrics.anyOfCount, style).toBe(0);
      expect(metrics.anyOfBranchCount, style).toBe(0);
      expect(metrics.unionParameterCount, style).toBe(0);
      expect(schema).toMatchObject({ type: 'object', required: expect.arrayContaining(['roleIdentityResolution', 'styleEvidence']) });
      expect((schema.properties as Record<string, unknown>).style).toBeUndefined();
      expect((schema.properties as Record<string, unknown>).operationId).toBeUndefined();
      expect((schema.properties as Record<string, unknown>).phases).toBeUndefined();
      expect((schema.properties as Record<string, unknown>).structuralStatus).toBeDefined();
      const styleEvidence = (schema.properties as Record<string, Record<string, unknown>>).styleEvidence;
      expect(styleEvidence).toMatchObject({ type: 'object' });
      expect((styleEvidence.properties as Record<string, unknown>).style).toBeUndefined();
      expect((schema.required as string[])).not.toEqual(expect.arrayContaining(['operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'candidateHash', 'candidateUnitHashes', 'phases']));
    }

    const writerBodies = captured.filter((entry) => (entry.body.tools as Array<{ name: string }>)[0]?.name === SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME);
    expect(writerBodies).toHaveLength(3);
    expect(JSON.stringify((writerBodies[0]?.body.tools as Array<{ input_schema: unknown }>)[0]?.input_schema)).toBe(
      JSON.stringify(SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL.input_schema),
    );
  });

  it('uses the live-passing shallow evaluator wire and rehydrates immutable context only', async () => {
    const tool = projectSummaryV3StyleEvaluatorToolForProvider('stronger');
    const schema = tool.input_schema as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown>;
    expect(properties.operationId).toBeUndefined();
    expect(properties.snapshotHash).toBeUndefined();
    expect(properties.manifestHash).toBeUndefined();
    expect(properties.style).toBeUndefined();
    expect(properties.locale).toBeUndefined();
    expect(properties.candidateHash).toBeUndefined();
    expect(properties.candidateUnitHashes).toBeUndefined();
    expect(properties.phases).toBeUndefined();
    expect(properties.structuralStatus).toBeDefined();
    expect(properties.structuralViolations).toBeDefined();
    expect((properties.styleEvidence as Record<string, unknown>).properties).not.toHaveProperty('style');

    let evaluatorInvocation: SummaryV3StyleProviderInvocation | null = null;
    const result = await executeSummaryV3StyleRoute(requestFor('stronger'), {
      timeoutForPhase: () => 30_000,
      invoke: async (invocation) => {
        if (invocation.role === 'evaluator') evaluatorInvocation = invocation;
        return providerMessage(invocation);
      },
    });
    expect(result.kind).toBe('safe_no_op');
    expect(evaluatorInvocation).not.toBeNull();
    const invocation = evaluatorInvocation!;
    const evaluatorInput = invocation.input as SummaryV3StyleEvaluatorInput;
    const normalized = normalizeSummaryV3StyleEvaluatorProviderResponse(providerMessage(invocation), evaluatorInput) as { input: SummaryV3StyleEvaluatorInput };
    expect(normalized.input.operationId).toBe(evaluatorInput.operationId);
    expect(normalized.input.snapshotHash).toBe(evaluatorInput.snapshotHash);
    expect(normalized.input.manifestHash).toBe(evaluatorInput.manifestHash);
    expect(normalized.input.style).toBe('stronger');
    expect(normalized.input.locale).toBe(evaluatorInput.locale);
    expect(normalized.input.candidateHash).toBe(evaluatorInput.candidate.hash);
    expect(normalized.input.candidateUnitHashes).toEqual(evaluatorInput.candidate.units.map(summaryV3StyleCandidateUnitHash));
    expect(normalized.input.phases.structural.status).toBe('passed');
    expect(normalized.input.styleEvidence.style).toBe('stronger');

    for (const spoofField of ['operationId', 'snapshotHash', 'manifestHash', 'style', 'locale', 'candidateHash', 'candidateUnitHashes']) {
      const spoofResult = await executeSummaryV3StyleRoute(requestFor('stronger'), {
        timeoutForPhase: () => 30_000,
        invoke: async (spoofInvocation) => {
          const message = providerMessage(spoofInvocation) as { content: Array<{ input: Record<string, unknown> }> };
          if (spoofInvocation.role === 'evaluator') message.content[0].input[spoofField] = 'spoofed';
          return message;
        },
      });
      expect(spoofResult, spoofField).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    }
  });

  it('records bounded before/after grammar metrics and preserves the authoritative evaluator union', async () => {
    const captured: Record<string, unknown>[] = [];
    const client = new Anthropic({
      apiKey: 'synthetic-test-key',
      maxRetries: 0,
      fetch: async (_input, init) => {
        captured.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return syntheticResponse({
          id: 'msg_schema_metrics', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6',
          content: [{ type: 'text', text: 'synthetic' }], stop_reason: 'end_turn', stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      },
    });
    await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 64, temperature: 0, system: 'pre-fix baseline',
      tools: [SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL as AnthropicTool],
      tool_choice: { type: 'tool', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, disable_parallel_tool_use: true },
      messages: [{ role: 'user', content: 'pre-fix baseline' }],
    });
    const baseline = requestMetrics(captured[0]!);
    expect(JSON.stringify(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL.input_schema)).toContain('oneOf');
    expect(baseline.anyOfCount).toBe(1);
    expect(baseline.anyOfBranchCount).toBe(3);

    const narrowedClient = new Anthropic({
      apiKey: 'synthetic-test-key',
      maxRetries: 0,
      fetch: async (_input, init) => {
        captured.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return syntheticResponse({
          id: 'msg_schema_metrics_narrowed', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6',
          content: [{ type: 'text', text: 'synthetic' }], stop_reason: 'end_turn', stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        });
      },
    });
    const activeTool = projectSummaryV3StyleToolForProvider(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL, 'stronger');
    await narrowedClient.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 64, temperature: 0, system: 'post-fix active style',
      tools: [activeTool as AnthropicTool],
      tool_choice: { type: 'tool', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, disable_parallel_tool_use: true },
      messages: [{ role: 'user', content: 'post-fix active style' }],
    });
    const narrowed = requestMetrics(captured[1]!);
    expect(narrowed.anyOfCount).toBe(0);
    expect(narrowed.anyOfBranchCount).toBe(0);
    expect(narrowed.unionParameterCount).toBe(0);
    expect(narrowed.propertyCount).toBeLessThan(baseline.propertyCount);
    expect(narrowed.serializedBytes).toBeLessThan(baseline.serializedBytes);
  });

  it('fails closed when an active style has zero or multiple authoritative branches', () => {
    const clone = (): Record<string, unknown> => JSON.parse(JSON.stringify(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL));
    const zeroMatch = clone();
    const zeroProperties = ((zeroMatch.input_schema as Record<string, unknown>).properties as Record<string, unknown>);
    ((zeroProperties.styleEvidence as Record<string, unknown>).oneOf as Array<Record<string, unknown>>).splice(1);
    expect(() => projectSummaryV3StyleToolForProvider(
      zeroMatch as typeof SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
      'stronger',
    )).toThrow(/active style stronger must match exactly one|lacks a disjoint style discriminator/u);

    const multipleMatch = clone();
    const multipleProperties = ((multipleMatch.input_schema as Record<string, unknown>).properties as Record<string, unknown>);
    const branches = (multipleProperties.styleEvidence as Record<string, unknown>).oneOf as Array<Record<string, unknown>>;
    branches[1] = JSON.parse(JSON.stringify(branches[0]));
    expect(() => projectSummaryV3StyleToolForProvider(
      multipleMatch as typeof SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
      'stronger',
    )).toThrow(/active style stronger must match exactly one|lacks a disjoint style discriminator/u);
  });

  it('maps an intercepted evaluator HTTP 400 to the typed terminal with one evaluator attempt and no retry', async () => {
    const phases: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    let current: SummaryV3StyleProviderInvocation | null = null;
    const client = new Anthropic({
      apiKey: 'synthetic-test-key',
      maxRetries: 0,
      fetch: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        if (!current) throw new Error('missing invocation');
        return current.role === 'evaluator'
          ? syntheticResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'synthetic strict-schema rejection' } }, 400)
          : syntheticResponse(providerMessage(current));
      },
    });
    const result = await executeSummaryV3StyleRoute(requestFor('stronger'), {
      timeoutForPhase: () => 30_000,
      invoke: async (invocation) => {
        current = invocation;
        phases.push(invocation.phase);
        return client.messages.create(providerRequest(invocation));
      },
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'evaluator_request_failed',
      evidence: {
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        writerAttempts: 1,
        evaluatorAttempts: 1,
        m5ProviderFailure: {
          phase: 'initial_evaluator',
          failureStage: 'sdk_request',
          providerHttpStatus: 400,
          providerHttpResponseReceived: true,
        },
      },
    });
    expect(phases).toEqual(['initial_writer', 'initial_evaluator']);
    expect(bodies).toHaveLength(2);
    expect(requestMetrics(bodies[1]!).anyOfCount).toBe(0);
  });
});
