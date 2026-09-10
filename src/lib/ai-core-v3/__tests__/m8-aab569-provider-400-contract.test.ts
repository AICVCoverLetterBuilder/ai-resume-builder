import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL,
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
  SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleRoute,
} from '../summary-style-m5-provider';

type AnthropicTool = NonNullable<Parameters<Anthropic['messages']['create']>[0]['tools']>[number];

const UNSUPPORTED_PROVIDER_KEYS = new Set([
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
  'oneOf',
]);

function expectSupportedProviderSchema(value: unknown, path = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => expectSupportedProviderSchema(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    expect(UNSUPPORTED_PROVIDER_KEYS.has(key), `${path}.${key} must not be sent to Anthropic`).toBe(false);
    if (key === 'minItems') expect([0, 1], `${path}.minItems must be 0 or 1`).toContain(child);
    expectSupportedProviderSchema(child, `${path}.${key}`);
  }
}

function syntheticMessageResponse(): Response {
  return new Response(JSON.stringify({
    id: 'msg_synthetic_contract',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: [{ type: 'text', text: 'synthetic transport response' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function syntheticBadRequestResponse(): Response {
  return new Response(JSON.stringify({
    type: 'error',
    error: { type: 'invalid_request_error', message: 'synthetic strict-schema rejection' },
  }), {
    status: 400,
    headers: { 'content-type': 'application/json', 'request-id': 'req_synthetic_contract' },
  });
}

function request(overrides: Partial<SummaryV3StyleRequest> = {}): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: 'summary_stronger',
    operationId: 'm8-aab569-contract-001',
    style: 'stronger',
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: 'I maintain electrical systems and resolve faults in electrical systems.',
    visibleSummaryFacts: undefined,
    protectedEntities: undefined,
    manifest: {
      manifestId: 'm8-aab569-manifest',
      contextId: 'm8-aab569-context',
      sourceLocale: 'en',
      currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current',
        role: 'Electrical Service Technician',
        employer: 'NordWerk Elektroservice Test',
        employmentState: 'present',
        durationMonths: 36,
        facts: [
          { id: 'maintenance', text: 'I maintain electrical systems.' },
          { id: 'faults', text: 'I resolve faults in electrical systems.' },
        ],
      }],
    },
    requestIdentity: 'm8-aab569-request-001',
    createdAt: 1_757_000_000_000,
    ...overrides,
  };
}

function providerRequest(tool: unknown, toolName: string) {
  return {
    model: 'claude-sonnet-4-6',
    max_tokens: 64,
    temperature: 0,
    system: 'synthetic contract test',
    tools: [tool as AnthropicTool],
    tool_choice: { type: 'tool' as const, name: toolName, disable_parallel_tool_use: true as const },
    messages: [{ role: 'user' as const, content: 'synthetic contract input' }],
  };
}

describe('M8 AAB569 provider HTTP 400 contract', () => {
  it('keeps local safety bounds authoritative while projecting a supported strict wire schema', async () => {
    const captured: { body: unknown[] } = { body: [] };
    const client = new Anthropic({
      apiKey: 'synthetic-test-key',
      maxRetries: 0,
      fetch: async (_input, init) => {
        captured.body.push(JSON.parse(String(init?.body)));
        return syntheticMessageResponse();
      },
    });

    await client.messages.create(providerRequest(
      SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL,
      SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL.name,
    ));

    const requestBody = captured.body[0] as { tools: Array<{ input_schema: unknown }> };
    expect(captured.body).toHaveLength(1);
    expect(requestBody.tools).toHaveLength(1);
    expectSupportedProviderSchema(requestBody.tools[0].input_schema);
    expectSupportedProviderSchema(SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL.input_schema);
    expect(JSON.stringify(requestBody.tools[0].input_schema)).not.toContain('oneOf');
    expect(JSON.stringify(requestBody.tools[0].input_schema)).toContain('anyOf');
    expect(JSON.stringify(SUMMARY_V3_STYLE_M5_WRITER_TOOL.input_schema)).toContain('maxItems');
    expect(JSON.stringify(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL.input_schema)).toContain('oneOf');
    expect(JSON.stringify(SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL.input_schema)).not.toContain('oneOf');
  });

  it('surfaces a synthetic SDK 400 as a typed BadRequestError without retrying', async () => {
    let calls = 0;
    const client = new Anthropic({
      apiKey: 'synthetic-test-key',
      maxRetries: 0,
      fetch: async () => {
        calls += 1;
        return syntheticBadRequestResponse();
      },
    });

    let caught: unknown;
    try {
      await client.messages.create(providerRequest(
        SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL,
        SUMMARY_V3_STYLE_M5_EVALUATOR_PROVIDER_TOOL.name,
      ));
    } catch (error) {
      caught = error;
    }

    expect(calls).toBe(1);
    expect(caught).toMatchObject({
      status: 400,
      error: { type: 'error', error: { type: 'invalid_request_error' } },
      requestID: 'req_synthetic_contract',
    });
    expect(caught).toBeInstanceOf(Anthropic.BadRequestError);
  });

  it('records a writer sdk_request 400 and never reaches evaluator or apply', async () => {
    let sdkCalls = 0;
    const invocations: string[] = [];
    const wireBodies: unknown[] = [];
    const client = new Anthropic({
      apiKey: 'synthetic-test-key',
      maxRetries: 0,
      fetch: async (_input, init) => {
        sdkCalls += 1;
        wireBodies.push(JSON.parse(String(init?.body)));
        return syntheticBadRequestResponse();
      },
    });

    const result = await executeSummaryV3StyleRoute(request(), {
      timeoutForPhase: () => 8_000,
      invoke: async (invocation) => {
        invocations.push(invocation.phase);
        return client.messages.create(providerRequest(
          invocation.tool,
          invocation.toolName,
        ));
      },
    });

    expect(result.kind).toBe('handled_failure');
    if (result.kind !== 'handled_failure') return;
    expect(result.typedReason).toBe('writer_request_failed');
    expect(result.evidence.writerCandidateReachedValidation).toBe(false);
    expect(result.evidence.evaluatorReached).toBe(false);
    expect(result.evidence.candidateHash).toBeNull();
    expect(result.evidence.m5ProviderFailure?.failureStage).toBe('sdk_request');
    expect(result.evidence.m5ProviderFailure?.providerHttpStatus).toBe(400);
    expect(result.evidence.m5ProviderFailure?.providerHttpResponseReceived).toBe(true);
    expect(invocations).toEqual(['initial_writer']);
    expect(sdkCalls).toBe(1);
    const writerWire = wireBodies[0] as { tools: Array<{ input_schema: unknown }> };
    expectSupportedProviderSchema(writerWire.tools[0].input_schema);
  });
});
