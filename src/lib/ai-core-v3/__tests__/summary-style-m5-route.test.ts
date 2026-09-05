import { describe, expect, it, vi } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  normalizedSummaryV3StyleLength,
  summaryV3StyleCandidateUnitHash,
  decideSummaryV3StyleOwnership,
  type SummaryV3Style,
  type SummaryV3StyleCandidate,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  isSummaryV3StyleRouteAction,
  normalizeSummaryV3StyleRouteRequest,
  type SummaryV3StyleProviderInvocation,
} from '../summary-style-m5-provider';

const actions = ['summary_shorter', 'summary_stronger', 'summary_professional'] as const;
const locales = ['en', 'de', 'sr', 'hi', 'ar', 'ja', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru'] as const;
const source = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
const repairText = 'Ava Patel is a Product Engineer at Atlas. She improved delivery by 20% over 24 months, builds reliable APIs, and mentors peers.';

function routeParams(locale = 'en'): Record<string, unknown> {
  return {
    enabled: true,
    operationId: 'm52-route-001',
    requestedLocale: locale,
    sourceLocale: locale,
    visibleSummary: source,
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel', semanticKind: 'entity' },
      { id: 'role', text: 'Product Engineer', semanticKind: 'role' },
      { id: 'employer', text: 'Atlas', semanticKind: 'employer' },
      { id: 'duty-api', text: 'builds reliable APIs', semanticKind: 'duty' },
      { id: 'duty-mentor', text: 'mentors peers', semanticKind: 'duty' },
      { id: 'metric', text: 'improved delivery by 20%', semanticKind: 'metric' },
      { id: 'duration', text: '24 months', semanticKind: 'duration' },
    ],
    protectedEntities: ['Ava Patel'],
    manifest: {
      manifestId: 'm52-route-manifest',
      contextId: 'm52-route-context',
      sourceLocale: locale,
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
          { id: 'duration', text: '24 months' },
        ],
      }],
    },
  };
}

function styleEvidence(style: SummaryV3Style, input: SummaryV3StyleProviderInvocation['input'], fulfilled: boolean, noOp: boolean) {
  if (style === 'shorter') {
    const sourceLength = normalizedSummaryV3StyleLength(input.sourceText);
    const candidate = 'candidate' in input ? input.candidate.text : input.sourceText;
    const candidateLength = normalizedSummaryV3StyleLength(candidate);
    return {
      style, semanticCompressionOperations: noOp ? 0 : fulfilled ? 1 : 0,
      sourceNormalizedLength: sourceLength, candidateNormalizedLength: candidateLength,
      lengthDelta: sourceLength - candidateLength,
      lengthDeltaPercent: sourceLength > 0 ? (sourceLength - candidateLength) / sourceLength : 0,
      sourceUnitCount: countSummaryV3StyleUnits(input.sourceText), candidateUnitCount: countSummaryV3StyleUnits(candidate),
      sourceClauseCount: countSummaryV3StyleClauses(input.sourceText), candidateClauseCount: countSummaryV3StyleClauses(candidate),
      factCoverage: true, shorterFulfilled: fulfilled, noOpDetected: noOp,
    };
  }
  if (style === 'stronger') {
    return {
      style, strongerPredicateTransformations: noOp ? 0 : fulfilled ? 1 : 0,
      structuralStrengtheningCount: noOp ? 0 : fulfilled ? 1 : 0,
      modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0,
      stackedModifierDetected: false, unsupportedAuthorityDetected: false,
      strongerFulfilled: fulfilled, noOpDetected: noOp,
    };
  }
  return {
    style, professionalFramingOperations: noOp ? 0 : fulfilled ? 1 : 0,
    cohesionClarityOperations: noOp ? 0 : fulfilled ? 1 : 0,
    markerOnlyChangeDetected: false, jargonOrFillerDetected: false,
    professionalFulfilled: fulfilled, noOpDetected: noOp,
  };
}

function providerMessage(invocation: SummaryV3StyleProviderInvocation, mode: 'pass' | 'reject' | 'malformed' | 'throw' = 'pass'): unknown {
  if (mode === 'throw') throw new Error('synthetic 503 provider failure');
  if (mode === 'malformed') return { stop_reason: 'tool_use', content: [{ type: 'text', text: 'prose is not a tool response' }] };
  if (invocation.role === 'writer') {
    const input = invocation.input;
    const text = invocation.phase === 'repair_writer' ? repairText : input.sourceText;
    return {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: {
        operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
        style: input.style, locale: input.locale,
        units: [{ unitId: 'unit-0', text, factIds: input.requiredFacts.map((fact) => fact.id) }],
      } }],
    };
  }
  const input = invocation.input as Extract<typeof invocation.input, { candidate: SummaryV3StyleCandidate }>;
  const rejected = mode === 'reject' && invocation.phase === 'initial_evaluator';
  const candidateUnitHashes = input.candidate.units.map(summaryV3StyleCandidateUnitHash);
  const violation = {
    code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [candidateUnitHashes[0]], repairable: true,
  } as const;
  const phases = {
    structural: { status: 'passed', violations: [] },
    semantic_grounding: { status: 'passed', violations: [] },
    language_native_quality: { status: 'passed', violations: [] },
    style_fulfillment: { status: rejected ? 'failed' : 'passed', violations: rejected ? [violation] : [] },
  } as const;
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, input: {
      operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale, candidateHash: input.candidate.hash, candidateUnitHashes,
      phases, representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash), missingFactIdHashes: [],
      styleEvidence: styleEvidence(input.style, input, !rejected, !rejected && invocation.phase !== 'repair_evaluator'),
    } }],
  };
}

async function invokeActualRoute(options: {
  action?: string; requestedLocale?: string; sourceLocale?: string;
  auth?: 'valid' | 'invalid'; providerMode?: 'pass' | 'reject' | 'repair-fail' | 'malformed' | 'throw';
  serverEnabled?: boolean; clientEnabled?: unknown; omitEnabled?: boolean;
  calls?: { count: number; retries: number; tools: string[]; choices: unknown[]; maxRetries: Array<number | undefined> };
}) {
  const keys = ['AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'PRO_SIGNING_KEY'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const calls = options.calls ?? { count: 0, retries: 0, tools: [], choices: [], maxRetries: [] };
  const mode = options.providerMode ?? 'pass';
  try {
    const serverEnabled = options.serverEnabled ?? true;
    process.env.AI_CORE_V3_ENABLED = serverEnabled ? 'true' : 'false';
    process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = serverEnabled ? 'true' : 'false';
    process.env.ANTHROPIC_API_KEY = 'm52-route-test-key'; process.env.PRO_SIGNING_KEY = 'm52-signing-key';
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    vi.resetModules();
    const create = vi.fn(async (params: { tools?: Array<{ name?: string }>; tool_choice?: unknown; messages?: Array<{ content?: unknown }> }, requestOptions?: { maxRetries?: number }) => {
      calls.count += 1; calls.retries += requestOptions?.maxRetries ?? 0; calls.maxRetries.push(requestOptions?.maxRetries);
      calls.tools.push(params.tools?.[0]?.name ?? 'none'); calls.choices.push(params.tool_choice);
      const role = params.tools?.[0]?.name === SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME ? 'writer' : 'evaluator';
      const phase = calls.count === 3 ? 'repair_writer' : calls.count === 4 ? 'repair_evaluator' : role === 'writer' ? 'initial_writer' : 'initial_evaluator';
      const prompt = String(params.messages?.[0]?.content ?? '');
      const input = JSON.parse(prompt.slice(prompt.lastIndexOf('\n\n') + 2)) as SummaryV3StyleProviderInvocation['input'];
      const invocation = { role, phase, input } as SummaryV3StyleProviderInvocation;
      if (mode === 'throw' || (mode === 'repair-fail' && calls.count === 4)) return providerMessage(invocation, 'throw');
      if (mode === 'malformed') return providerMessage(invocation, 'malformed');
      return providerMessage(invocation, mode === 'reject' || mode === 'repair-fail' ? 'reject' : 'pass');
    });
    vi.doMock('@anthropic-ai/sdk', () => { class MockAnthropic { readonly messages = { create }; } return { default: MockAnthropic }; });
    vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => options.auth === 'invalid' ? null : { subject: 'm52-test' }) }));
    const { POST } = await import('@/app/api/generate/route');
    const body = {
      action: options.action ?? 'summary_professional', proToken: options.auth === 'invalid' ? 'invalid' : 'valid',
      ...routeParams(options.requestedLocale ?? 'en'), sourceLocale: options.sourceLocale ?? options.requestedLocale ?? 'en',
    };
    if (options.omitEnabled) delete (body as Record<string, unknown>).enabled;
    else if ('clientEnabled' in options) (body as Record<string, unknown>).enabled = options.clientEnabled;
    const request = new Request('http://localhost/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), calls };
  } finally {
    vi.restoreAllMocks(); vi.doUnmock('@anthropic-ai/sdk'); vi.doUnmock('@/lib/pro-token'); vi.resetModules();
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

describe('M5.2 Summary style route ownership', () => {
  it('recognizes exactly the three M5 actions and preserves compact locale ownership', () => {
    expect(actions.every((action) => isSummaryV3StyleRouteAction(action))).toBe(true);
    expect(isSummaryV3StyleRouteAction('summary_generate')).toBe(false);
    expect(isSummaryV3StyleRouteAction('rewrite')).toBe(false);
    expect(actions.map((action) => normalizeSummaryV3StyleRouteRequest(action, routeParams(), 10).style)).toEqual(['shorter', 'stronger', 'professional']);
    for (const locale of locales) for (const action of actions) {
      const request = normalizeSummaryV3StyleRouteRequest(action, routeParams(locale), 10);
      expect(decideSummaryV3StyleOwnership(request), `${action}/${locale}`).toMatchObject({ kind: 'owned' });
    }
  });

  it('keeps cross-locale and non-M5 ownership outside the provider path', () => {
    const crossLocale = normalizeSummaryV3StyleRouteRequest('summary_shorter', { ...routeParams('de'), sourceLocale: 'en', requestedLocale: 'de' }, 10) as SummaryV3StyleRequest;
    expect(decideSummaryV3StyleOwnership(crossLocale)).toEqual({ kind: 'not_applicable', reason: 'cross_locale' });
    expect(decideSummaryV3StyleOwnership({ ...crossLocale, operation: 'summary_generate', style: 'shorter' })).toEqual({ kind: 'not_applicable', reason: 'm4_generate_owned_elsewhere' });
  });

  it('does not claim page, persistence, apply, diagnostics, or usage ownership', () => {
    const request = normalizeSummaryV3StyleRouteRequest('summary_professional', routeParams(), 10);
    expect(request).not.toHaveProperty('cv'); expect(request).not.toHaveProperty('store'); expect(request).not.toHaveProperty('usage');
    expect(request).not.toHaveProperty('apply'); expect(request).not.toHaveProperty('diagnostics');
  });
});

describe('M5.2 actual production route boundary', () => {
  it('blocks a server-disabled M5 request even when the client sends enabled=true', async () => {
    const run = await invokeActualRoute({ serverEnabled: false, clientEnabled: true });
    expect(run.response.status).toBe(409); expect(run.body.typedReason).toBe('v3_feature_disabled');
    expect(run.calls.count).toBe(0); expect(run.calls.retries).toBe(0);
  });

  it('blocks a server-disabled M5 request when the client omits enabled', async () => {
    const run = await invokeActualRoute({ serverEnabled: false, omitEnabled: true });
    expect(run.response.status).toBe(409); expect(run.body.typedReason).toBe('v3_feature_disabled');
    expect(run.calls.count).toBe(0); expect(run.calls.retries).toBe(0);
  });

  it('blocks a server-disabled M5 request when the client sends enabled=false', async () => {
    const run = await invokeActualRoute({ serverEnabled: false, clientEnabled: false });
    expect(run.response.status).toBe(409); expect(run.body.typedReason).toBe('v3_feature_disabled');
    expect(run.calls.count).toBe(0); expect(run.calls.retries).toBe(0);
  });

  it('blocks an unverified M5 request before any provider call', async () => {
    const run = await invokeActualRoute({ auth: 'invalid' });
    expect(run.response.status).toBe(403); expect(run.body.code).toBe('invalid_pro_token'); expect(run.calls.count).toBe(0);
  });

  it.each(actions)('dispatches %s through the real forced writer/evaluator route', async (action) => {
    const run = await invokeActualRoute({ action });
    expect(run.response.status).toBe(200); expect(run.calls.count).toBe(2);
    expect(run.calls.tools).toEqual([SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME]);
    expect(run.calls.maxRetries).toEqual([0, 0]);
    expect(run.calls.choices.every((choice) => (choice as { type?: string }).type === 'tool')).toBe(true);
    expect(run.body).not.toHaveProperty('applied'); expect(run.body).not.toHaveProperty('persisted');
    expect(run.body).not.toHaveProperty('usageIncremented'); expect(run.body).not.toHaveProperty('canonicalPersisted');
  });

  it('returns truthful 502 for malformed writer transport with one call and no retry/fallback/V2', async () => {
    const run = await invokeActualRoute({ providerMode: 'malformed' });
    expect(run.response.status).toBe(502); expect(run.body.typedReason).toBe('writer_transport_malformed');
    expect(run.calls.count).toBe(1); expect(run.calls.retries).toBe(0);
    expect(run.calls.maxRetries).toEqual([0]);
  });

  it('returns truthful 502 for provider failure and proves callWithRetry makes no retry', async () => {
    const run = await invokeActualRoute({ providerMode: 'throw' });
    expect(run.response.status).toBe(502); expect(run.body.typedReason).toBe('writer_request_failed');
    expect(run.calls.count).toBe(1); expect(run.calls.retries).toBe(0);
    expect(run.calls.maxRetries).toEqual([0]);
  });

  it('rejects cross-locale input before provider invocation', async () => {
    const run = await invokeActualRoute({ requestedLocale: 'de', sourceLocale: 'en' });
    expect(run.response.status).toBe(422); expect(run.body.reason).toBe('cross_locale'); expect(run.calls.count).toBe(0);
  });

  it('proves the real four-call repair topology and no fifth call', async () => {
    const run = await invokeActualRoute({ action: 'summary_professional', providerMode: 'reject' });
    expect(run.response.status).toBe(200); expect(run.calls.count).toBe(4); expect(run.calls.retries).toBe(0);
    expect(run.calls.maxRetries).toEqual([0, 0, 0, 0]);
    expect(run.calls.tools).toEqual([SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME]);
  });

  it('fails a repair at four calls without a second repair, retry, fallback, or V2', async () => {
    const run = await invokeActualRoute({ action: 'summary_professional', providerMode: 'repair-fail' });
    expect(run.response.status).toBe(502); expect(run.body.typedReason).toBe('repair_evaluator_request_failed');
    expect(run.calls.count).toBe(4); expect(run.calls.retries).toBe(0);
    expect(run.calls.maxRetries).toEqual([0, 0, 0, 0]);
  });

  it('keeps a representative legacy Summary rewrite outside the M5 provider adapter', async () => {
    const keys = ['AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY', 'PRO_SIGNING_KEY'] as const;
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    let providerCalls = 0;
    const m5Execute = vi.fn();
    try {
      process.env.AI_CORE_V3_ENABLED = 'true'; process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
      process.env.ANTHROPIC_API_KEY = 'm52-legacy-route-test'; process.env.PRO_SIGNING_KEY = 'm52-signing-key';
      vi.resetModules();
      const create = vi.fn(async () => {
        providerCalls += 1;
        return { content: [{ type: 'text', text: source }] };
      });
      vi.doMock('@anthropic-ai/sdk', () => { class MockAnthropic { readonly messages = { create }; } return { default: MockAnthropic }; });
      vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => ({ subject: 'm52-legacy-test' })) }));
      vi.doMock('@/lib/ai-core-v3/summary-style-m5-provider', async () => {
        const actual = await vi.importActual<typeof import('../summary-style-m5-provider')>('@/lib/ai-core-v3/summary-style-m5-provider');
        return { ...actual, executeSummaryV3StyleRoute: m5Execute };
      });
      const { POST } = await import('@/app/api/generate/route');
      const request = new Request('http://localhost/api/generate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'rewrite', proToken: 'valid', text: source, style: 'professional', locale: 'en' }),
      });
      const response = await POST(request as Parameters<typeof POST>[0]);
      const body = await response.json();
      expect(response.status).toBe(200); expect(body.result).toBe(source);
      expect(providerCalls).toBeGreaterThan(0); expect(m5Execute).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks(); vi.doUnmock('@anthropic-ai/sdk'); vi.doUnmock('@/lib/pro-token');
      vi.doUnmock('@/lib/ai-core-v3/summary-style-m5-provider'); vi.resetModules();
      for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    }
  });

  it('keeps the existing M4 Generate boundary outside the M5 branch', async () => {
    const keys = ['AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY', 'PRO_SIGNING_KEY'] as const;
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]])); let providerCalls = 0;
    try {
      process.env.AI_CORE_V3_ENABLED = 'false'; process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'false'; process.env.ANTHROPIC_API_KEY = 'm52-m4-boundary'; process.env.PRO_SIGNING_KEY = 'm52-signing-key';
      vi.resetModules(); const create = vi.fn(async () => { providerCalls += 1; return { content: [] }; });
      vi.doMock('@anthropic-ai/sdk', () => { class MockAnthropic { readonly messages = { create }; } return { default: MockAnthropic }; });
      vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => ({ subject: 'm52-test' })) }));
      const { POST } = await import('@/app/api/generate/route');
      const request = new Request('http://localhost/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'summary_v3_generate', proToken: 'valid' }) });
      const response = await POST(request as Parameters<typeof POST>[0]); const body = await response.json();
      expect(response.status).toBe(409); expect(body.typedReason).toBe('v3_feature_disabled'); expect(providerCalls).toBe(0);
    } finally {
      vi.restoreAllMocks(); vi.doUnmock('@anthropic-ai/sdk'); vi.doUnmock('@/lib/pro-token'); vi.resetModules();
      for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    }
  });
});
