import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  normalizedSummaryV3StyleLength,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3Style,
  type SummaryV3StyleCandidate,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleRoute,
  normalizeSummaryV3StyleProviderResponse,
  type SummaryV3StyleProviderInvocation,
} from '../summary-style-m5-provider';

const source = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';

class RateLimitError extends Error {
  readonly status = 429;
  readonly error = { code: 'rate_limit_error' };
  readonly requestID = 'req_test_known_rate_limit';
}

class APIConnectionTimeoutError extends Error {}

class AuthenticationError extends Error {
  readonly status = 401;
  readonly error = { code: 'authentication_error' };
}

function requestFor(style: SummaryV3Style = 'shorter'): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: `summary_${style}`,
    operationId: `m52-provider-${style}`,
    style,
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: source,
    protectedEntities: ['Ava Patel'],
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' },
      { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' },
      { id: 'duty-api', text: 'builds reliable APIs' },
      { id: 'duty-mentor', text: 'mentors peers' },
      { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' },
    ],
    manifest: {
      manifestId: 'm52-provider-manifest',
      contextId: 'm52-provider-context',
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
    createdAt: 1_700_000_000_000,
  };
}

function unresolvedRoleRequest(): SummaryV3StyleRequest {
  const base = requestFor('stronger');
  return {
    ...base,
    manifest: {
      ...base.manifest,
      entries: [{
        ...base.manifest.entries[0]!,
        role: 'Produktingenieur',
        roleSourceLocale: 'de',
      }],
    },
  };
}

function styleEvidence(style: SummaryV3Style) {
  if (style === 'shorter') {
    return {
      style,
      semanticCompressionOperations: 0,
      sourceNormalizedLength: normalizedSummaryV3StyleLength(source),
      candidateNormalizedLength: normalizedSummaryV3StyleLength(source),
      lengthDelta: 0,
      lengthDeltaPercent: 0,
      sourceUnitCount: countSummaryV3StyleUnits(source),
      candidateUnitCount: countSummaryV3StyleUnits(source),
      sourceClauseCount: countSummaryV3StyleClauses(source),
      candidateClauseCount: countSummaryV3StyleClauses(source),
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
  const input = invocation.input as Extract<typeof invocation.input, { candidate: SummaryV3StyleCandidate }>;
  return {
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
      input: {
        operationId: input.operationId,
        snapshotHash: input.snapshotHash,
        manifestHash: input.manifestHash,
        style: input.style,
        locale: input.locale,
        candidateHash: input.candidate.hash,
        candidateUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
        phases: {
          structural: { status: 'passed', violations: [] },
          semantic_grounding: { status: 'passed', violations: [] },
          language_native_quality: { status: 'passed', violations: [] },
          style_fulfillment: { status: 'passed', violations: [] },
        },
        representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash),
        missingFactIdHashes: [],
        roleIdentityResolution: input.roleIdentity.status === 'unresolved' ? 'equivalent' : 'not_required',
        styleEvidence: styleEvidence(input.style),
      },
    }],
  };
}

describe('M5.2 Summary style provider adapter', () => {
  it('normalizes only the forced tool envelope and never accepts prose fallback', () => {
    expect(normalizeSummaryV3StyleProviderResponse({
      content: [{ type: 'text', text: 'Here is your improved summary.' }],
    })).toEqual({
      toolName: null, contentBlockCount: 1, textBlockCount: 1, toolBlockCount: 0, input: null,
    });
    expect(normalizeSummaryV3StyleProviderResponse({
      content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: { ok: true } }],
    })).toEqual({
      toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
      contentBlockCount: 1,
      textBlockCount: 0,
      toolBlockCount: 1,
      input: { ok: true },
    });
    expect(normalizeSummaryV3StyleProviderResponse({
      content: [
        { type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: {} },
        { type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: {} },
      ],
    })).toMatchObject({ contentBlockCount: 2, textBlockCount: 0, toolBlockCount: 2, input: null });
  });

  it('fails closed for compact malformed forced-tool transport variants', async () => {
    const malformedCases: Array<[string, unknown]> = [
      ['wrong forced tool name', { content: [{ type: 'tool_use', name: 'wrong_tool', input: {} }] }],
      ['zero tool blocks', { content: [] }],
      ['multiple tool blocks', { content: [
        { type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: {} },
        { type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: {} },
      ] }],
      ['text plus one tool block', { content: [
        { type: 'text', text: 'prose must not become a candidate' },
        { type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: {} },
      ] }],
      ['malformed unknown tool payload field', { content: [
        { type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: { unexpected: true } },
      ] }],
    ];
    for (const [label, raw] of malformedCases) {
      let calls = 0;
      const result = await executeSummaryV3StyleRoute(requestFor(), {
        timeoutForPhase: () => 1_000,
        invoke: async () => { calls += 1; return raw; },
      });
      expect(result, label).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_transport_malformed' });
      expect(calls, label).toBe(1);
    }
  });

  it('uses one forced writer/evaluator adapter path and returns a safe no-op without side effects', async () => {
    const invocations: SummaryV3StyleProviderInvocation[] = [];
    const result = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => 1_000,
      invoke: async (invocation) => {
        invocations.push(invocation);
        return providerMessage(invocation);
      },
    });
    expect(result.kind).toBe('safe_no_op');
    expect(invocations.map((invocation) => invocation.role)).toEqual(['writer', 'evaluator']);
    expect(invocations.every((invocation) => invocation.strict
      && invocation.expectedToolBlocks === 1
      && invocation.allowedTextBlocks === 0
      && invocation.toolChoice.type === 'tool')).toBe(true);
    expect(invocations[0]?.toolName).toBe(SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME);
    expect(invocations[1]?.toolName).toBe(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME);
  });

  it('gives Stronger a duty-first source-authority prompt with an explicit safe-no-op instruction', async () => {
    const invocations: SummaryV3StyleProviderInvocation[] = [];
    const result = await executeSummaryV3StyleRoute(requestFor('stronger'), {
      timeoutForPhase: () => 1_000,
      invoke: async (invocation) => {
        invocations.push(invocation);
        return providerMessage(invocation);
      },
    });
    expect(result.kind).toBe('safe_no_op');
    const writer = invocations[0];
    expect(writer?.role).toBe('writer');
    if (!writer || writer.role !== 'writer') throw new Error('expected Stronger writer invocation');
    if (!('styleContract' in writer.input)) throw new Error('expected Stronger writer input');
    expect(writer?.prompt).toContain('sourceText is the sole fact authority');
    expect(writer?.prompt).toContain('Preserve duties as duties');
    expect(writer?.prompt).toContain('Do not turn duties into achievements');
    expect(writer?.prompt).toContain('submit sourceText unchanged as the single safe-no-op candidate');
    expect(writer?.input.styleContract).toEqual(expect.arrayContaining([
      expect.stringContaining('never convert a duty into an achievement'),
      expect.stringContaining('return sourceText unchanged'),
    ]));
  });

  it('makes unresolved current-entry role equivalence an explicit single-evaluator obligation', async () => {
    const invocations: SummaryV3StyleProviderInvocation[] = [];
    const result = await executeSummaryV3StyleRoute(unresolvedRoleRequest(), {
      timeoutForPhase: () => 1_000,
      invoke: async (invocation) => {
        invocations.push(invocation);
        return providerMessage(invocation);
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(invocations.map((invocation) => invocation.role)).toEqual(['writer', 'evaluator']);
    const evaluator = invocations[1];
    expect(evaluator?.role).toBe('evaluator');
    if (!evaluator || evaluator.role !== 'evaluator') throw new Error('expected unresolved-role evaluator invocation');
    expect(evaluator.toolName).toBe(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME);
    expect(evaluator).toMatchObject({
      strict: true,
      expectedToolBlocks: 1,
      allowedTextBlocks: 0,
      toolChoice: { type: 'tool', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME },
      input: {
        locale: 'en',
        sourceText: source,
        roleIdentity: {
          status: 'unresolved',
          selectedEntryId: 'entry-current',
          structuredRole: 'Produktingenieur',
          roleSourceLocale: 'de',
          employer: 'Atlas',
          rolePresentation: null,
        },
      },
    });
    if (!('candidate' in evaluator.input)) throw new Error('expected evaluator candidate input');
    expect(evaluator.input.candidate.text).toBe(source);
    expect(evaluator.prompt).toContain('UNRESOLVED ROLE IDENTITY OBLIGATION');
    expect(evaluator.prompt).toContain('semantically compare the selected Experience structuredRole');
    expect(evaluator.prompt).toContain('Do not infer from another entry, personal/header job title, or external knowledge');
    expect(evaluator.prompt).toContain('roleIdentityResolution=equivalent');
    expect(invocations).toHaveLength(2);
  });

  it('fails closed on malformed transport, provider exceptions, and never retries', async () => {
    let calls = 0;
    const malformed = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => 1_000,
      invoke: async () => {
        calls += 1;
        return { content: [{ type: 'text', text: 'free text must not become a candidate' }] };
      },
    });
    expect(malformed).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_transport_malformed' });
    expect(calls).toBe(1);

    calls = 0;
    const providerFailure = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => 1_000,
      invoke: async () => {
        calls += 1;
        throw new Error('provider HTTP 503');
      },
    });
    expect(providerFailure).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_request_failed' });
    expect(providerFailure).toMatchObject({
      evidence: {
        writerAttempts: 1,
        writerCandidateReachedValidation: false,
        evaluatorReached: false,
        m5ProviderFailure: {
          phase: 'initial_writer',
          failureStage: 'sdk_request',
          providerHttpStatus: null,
          providerErrorType: null,
          providerHttpResponseReceived: null,
        },
      },
    });
    expect(calls).toBe(1);
  });

  it('preserves a known provider cause across the server catch without raw error data', async () => {
    let calls = 0;
    const result = await executeSummaryV3StyleRoute(unresolvedRoleRequest(), {
      timeoutForPhase: () => 1_000,
      invoke: async () => {
        calls += 1;
        throw new RateLimitError('provider message must be fingerprinted, not serialized');
      },
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'writer_request_failed',
      evidence: {
        writerAttempts: 1,
        writerCandidateReachedValidation: false,
        evaluatorReached: false,
        roleIdentityResolution: 'unresolved',
        safeNoOpEligibilityReason: 'source_inconsistency',
        m5ProviderFailure: {
          phase: 'initial_writer',
          failureStage: 'sdk_request',
          errorClass: 'RateLimitError',
          providerHttpStatus: 429,
          providerErrorType: 'rate_limit',
          providerErrorCode: 'rate_limit_error',
          providerHttpResponseReceived: true,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('provider message must be fingerprinted');
    expect(JSON.stringify(result)).not.toContain('req_test_known_rate_limit');
    expect(calls).toBe(1);
  });

  it('separates construction failure, timeout, access rejection, and unknown SDK exceptions', async () => {
    let outboundCalls = 0;
    const construction = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => { throw new TypeError('local timeout contract failure'); },
      invoke: async () => { outboundCalls += 1; return {}; },
    });
    expect(construction).toMatchObject({
      kind: 'handled_failure', typedReason: 'writer_request_failed',
      evidence: { m5ProviderFailure: {
        phase: 'initial_writer', failureStage: 'request_construction',
        providerHttpStatus: null, providerErrorType: null, providerHttpResponseReceived: null,
      } },
    });
    expect(outboundCalls).toBe(0);

    for (const [error, expected] of [
      [new APIConnectionTimeoutError('deadline'), { providerErrorType: 'timeout', providerHttpStatus: null }],
      [new AuthenticationError('denied'), { providerErrorType: 'authentication', providerHttpStatus: 401 }],
      [new TypeError('local bug'), { providerErrorType: null, providerHttpStatus: null }],
    ] as const) {
      const result = await executeSummaryV3StyleRoute(requestFor(), {
        timeoutForPhase: () => 1_000,
        invoke: async () => { throw error; },
      });
      expect(result).toMatchObject({
        kind: 'handled_failure', typedReason: 'writer_request_failed',
        evidence: { m5ProviderFailure: { failureStage: 'sdk_request', ...expected } },
      });
    }
  });

  it('retains completed writer evidence when the evaluator SDK seam throws', async () => {
    let calls = 0;
    const result = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => 1_000,
      invoke: async (invocation) => {
        calls += 1;
        if (invocation.role === 'evaluator') throw new APIConnectionTimeoutError('evaluator deadline');
        return providerMessage(invocation);
      },
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'evaluator_request_failed',
      evidence: {
        writerAttempts: 1,
        evaluatorAttempts: 1,
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        m5ProviderFailure: {
          phase: 'initial_evaluator',
          failureStage: 'sdk_request',
          providerErrorType: 'timeout',
          providerHttpStatus: null,
        },
      },
    });
    expect(calls).toBe(2);
  });
});
