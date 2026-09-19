import { describe, expect, it, vi } from 'vitest';
import { hashExperienceSourceLocaleText } from '../../cv-experience-source-locale';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import type { ContentLocalizeM6Snapshot } from '../content-localize-m6';
import {
  CONTENT_LOCALIZE_V3_OPERATION,
  CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES,
  createContentLocalizeV3ProviderDependencies,
  type ContentLocalizeV3ProviderInvocation,
  type ContentLocalizeV3ProviderPhase,
  type ContentLocalizeV3ProviderRequest,
} from '../content-localize-v3-provider';
import type { ContentLocalizeM6EvaluatorRequest, ContentLocalizeM6WriterRequest } from '../content-localize-m6-server';
import { executeContentLocalizeM6Server } from '../content-localize-m6-server';
import {
  CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS,
} from '../../ai-request-timing';

const summaryText = 'Mila builds reliable APIs at Atlas and improved delivery by 20%.';
const experienceText = 'Led a team of 12 engineers and reduced release time by 30%.';

function summarySnapshot(sourceLocale: ContentLocalizeM6Snapshot['sourceLocale'] = 'de', targetLocale: ContentLocalizeM6Snapshot['targetLocale'] = 'fr'): ContentLocalizeM6Snapshot {
  return {
    operationId: 'm6-route-operation', requestId: 'm6-route-request', kind: 'summary', sourceLocale, targetLocale,
    sourceText: summaryText, sourceTextHash: hashSummarySourceLocaleText(summaryText),
  };
}

function experienceSnapshot(): ContentLocalizeM6Snapshot {
  return {
    operationId: 'm6-route-experience-operation', requestId: 'm6-route-experience-request', kind: 'experience_description',
    experienceEntryId: 'experience-7', sourceLocale: 'en', targetLocale: 'ja', sourceText: experienceText,
    sourceTextHash: hashExperienceSourceLocaleText(experienceText),
  };
}

function toolResponse(name: string, input: Record<string, unknown>): unknown {
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name, input }] };
}

function requestFromPrompt(prompt: unknown): Record<string, unknown> {
  const text = String(prompt);
  return JSON.parse(text.slice(text.lastIndexOf('REQUEST_JSON:\n') + 'REQUEST_JSON:\n'.length)) as Record<string, unknown>;
}

function writerOutput(request: ContentLocalizeM6WriterRequest, translatedText: string): Record<string, unknown> {
  return {
    operationId: request.operationId, requestId: request.requestId, kind: request.kind,
    sourceLocale: request.sourceLocale, targetLocale: request.targetLocale, sourceTextHash: request.sourceTextHash,
    translatedText, ...(request.experienceEntryId ? { experienceEntryId: request.experienceEntryId } : {}),
  };
}

function evaluatorOutput(request: ContentLocalizeM6EvaluatorRequest, accepted: boolean, failedCriterion: string | boolean = false): Record<string, unknown> {
  const failed = typeof failedCriterion === 'string' ? failedCriterion : failedCriterion ? 'targetLocaleSatisfied' : undefined;
  return {
    operationId: request.operationId, requestId: request.requestId, kind: request.kind,
    sourceLocale: request.sourceLocale, targetLocale: request.targetLocale, sourceTextHash: request.sourceTextHash,
    candidateTextHash: request.candidateTextHash, accepted,
    meaningPreserved: failed !== 'meaningPreserved', noFactsAdded: failed !== 'noFactsAdded', noFactsRemoved: failed !== 'noFactsRemoved', factualAnchorsPreserved: failed !== 'factualAnchorsPreserved',
    targetLocaleSatisfied: failed !== 'targetLocaleSatisfied', professionalCvQuality: failed !== 'professionalCvQuality', noLeakage: failed !== 'noLeakage',
    reasonCodes: failed ? ['criterion_failed'] : [], ...(request.experienceEntryId ? { experienceEntryId: request.experienceEntryId } : {}),
  };
}

type ProviderMode = 'pass' | 'reject-primary' | 'reject-repair' | 'malformed-writer' | 'malformed-repair' | 'identity-drift' | 'accepted-false' | 'accepted-true-false-criterion' | 'provider-error' | 'abort';

async function invokeActualRoute(options: {
  snapshot?: ContentLocalizeM6Snapshot;
  auth?: 'valid' | 'invalid';
  enabled?: boolean;
  mode?: ProviderMode;
  malformedJson?: boolean;
}) {
  const keys = ['AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'PRO_SIGNING_KEY'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const calls: Array<{ tool: string; strict: boolean | undefined; choice: unknown; invocation: ContentLocalizeV3ProviderInvocation }> = [];
  const mode = options.mode ?? 'pass';
  try {
    process.env.AI_CORE_V3_ENABLED = options.enabled === false ? 'false' : 'true';
    process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = process.env.AI_CORE_V3_ENABLED;
    process.env.ANTHROPIC_API_KEY = 'm6-route-deterministic-test-key';
    process.env.PRO_SIGNING_KEY = 'm6-route-signing-key';
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    vi.resetModules();
    const create = vi.fn(async (params: { tools?: Array<{ name?: string; strict?: boolean }>; tool_choice?: { type?: string; name?: string; disable_parallel_tool_use?: boolean }; messages?: Array<{ content?: unknown }> }, requestOptions?: { maxRetries?: number; timeout?: number }) => {
      const tool = params.tools?.[0]?.name ?? 'unknown';
      const request = requestFromPrompt(params.messages?.[0]?.content);
      const phase: ContentLocalizeV3ProviderPhase = tool === CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer
        ? 'writer'
        : tool === CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.repair
          ? 'repair_writer'
          : (request as { candidateOrigin?: string }).candidateOrigin === 'repair'
            ? 'repair_evaluator'
            : 'evaluator';
      calls.push({ tool, strict: params.tools?.[0]?.strict, choice: params.tool_choice, invocation: { phase, role: phase === 'evaluator' || phase === 'repair_evaluator' ? 'evaluator' : 'writer', request: request as ContentLocalizeV3ProviderRequest, prompt: String(params.messages?.[0]?.content), system: '', tool: { name: tool, description: '', strict: true, input_schema: {} }, timeoutMs: requestOptions?.timeout ?? 0, toolChoice: { type: 'tool', name: tool, disable_parallel_tool_use: true } } });
      expect(requestOptions?.maxRetries).toBe(0);
      if (mode === 'abort') throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      if (mode === 'provider-error') throw new Error('provider HTTP 503');
      if (mode === 'malformed-writer' && phase === 'writer') return { stop_reason: 'tool_use', content: [{ type: 'text', text: 'malformed' }] };
      if (mode === 'malformed-repair' && phase === 'repair_writer') return { stop_reason: 'tool_use', content: [{ type: 'text', text: 'malformed repair' }] };
      if (phase === 'writer' || phase === 'repair_writer') {
        const writer = request as ContentLocalizeM6WriterRequest;
        return toolResponse(tool, writerOutput(writer, phase === 'repair_writer' ? 'Mila a construit des API fiables chez Atlas et a amélioré la livraison de 20 %.' : 'Mila construit des API fiables chez Atlas et a amélioré la livraison de 20 %.'));
      }
      const evaluator = request as ContentLocalizeM6EvaluatorRequest;
      if (mode === 'identity-drift') return toolResponse(tool, { ...evaluatorOutput(evaluator, true), candidateTextHash: 'foreign-hash' });
      const evaluatorCount = calls.filter((call) => call.invocation.role === 'evaluator').length;
      const rejected = mode === 'reject-primary'
        ? evaluatorCount === 1
        : mode === 'malformed-repair'
          ? evaluatorCount === 1
        : mode === 'reject-repair'
          ? true
          : false;
      const falseCriterion = mode === 'accepted-true-false-criterion';
      return toolResponse(tool, evaluatorOutput(evaluator, mode === 'accepted-false' || falseCriterion ? (falseCriterion ? true : false) : !rejected, falseCriterion ? 'noFactsAdded' : rejected));
    });
    vi.doMock('@anthropic-ai/sdk', () => { class MockAnthropic { readonly messages = { create }; } return { default: MockAnthropic }; });
    vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => options.auth === 'invalid' ? null : { subject: 'm6-route-test' }) }));
    const { POST } = await import('@/app/api/generate/route');
    const body = options.malformedJson
      ? '{bad'
      : JSON.stringify({ action: CONTENT_LOCALIZE_V3_OPERATION, proToken: options.auth === 'invalid' ? 'invalid' : 'valid', snapshot: options.snapshot ?? summarySnapshot() });
    const response = await POST(new Request('http://localhost/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body }) as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), calls };
  } finally {
    vi.restoreAllMocks(); vi.doUnmock('@anthropic-ai/sdk'); vi.doUnmock('@/lib/pro-token'); vi.resetModules();
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
}

describe('M6.4 provider adapter contract', () => {
  it('maps forced tool transport into the frozen server dependencies without owning provider config', async () => {
    const calls: ContentLocalizeV3ProviderPhase[] = [];
    const dependencies = createContentLocalizeV3ProviderDependencies({
      invoke: async (invocation) => {
        calls.push(invocation.phase);
        if (invocation.phase === 'writer' || invocation.phase === 'repair_writer') {
          return toolResponse(invocation.tool.name, writerOutput(invocation.request as ContentLocalizeM6WriterRequest, 'Texte traduit fidèle.'));
        }
        const request = invocation.request as ContentLocalizeM6EvaluatorRequest;
        return toolResponse(invocation.tool.name, evaluatorOutput(request, true));
      },
    });
    const result = await executeContentLocalizeM6Server(summarySnapshot(), dependencies);
    expect(result.status).toBe('candidate_ready');
    expect(calls).toEqual(['writer', 'evaluator']);
  });
});

describe('M6.4 actual /api/generate route boundary', () => {
  it('dispatches a valid Summary through the shared auth/provider boundary', async () => {
    const run = await invokeActualRoute({});
    expect(run.response.status).toBe(200); expect(run.body.status).toBe('candidate_ready');
    expect(run.calls.map((call) => call.tool)).toEqual([CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer, CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.evaluator]);
    expect(run.calls.every((call) => call.strict === true)).toBe(true);
    expect(run.calls.every((call) => (call.choice as { type?: string }).type === 'tool')).toBe(true);
    expect(run.calls.every((call) => (call.choice as { name?: string }).name === call.tool)).toBe(true);
    expect(run.calls.every((call) => (call.choice as { disable_parallel_tool_use?: boolean }).disable_parallel_tool_use === true)).toBe(true);
    expect(run.calls.map((call) => call.invocation.timeoutMs)).toEqual([
      CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS,
      CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS,
    ]);
  });

  it('preserves Experience entry identity and excludes title/company ownership', async () => {
    const run = await invokeActualRoute({ snapshot: experienceSnapshot() });
    expect(run.response.status).toBe(200);
    expect(run.calls[0]?.invocation.request).toMatchObject({ experienceEntryId: 'experience-7' });
    expect(run.calls[0]?.invocation.request).not.toHaveProperty('position');
    expect(run.calls[0]?.invocation.request).not.toHaveProperty('company');
  });

  it('covers representative cross-locale directions through the same route branch', async () => {
    for (const [sourceLocale, targetLocale] of [['sr', 'en'], ['en', 'ja'], ['ar', 'de'], ['de', 'es'], ['pt-BR', 'it'], ['hi', 'fr']] as const) {
      const run = await invokeActualRoute({ snapshot: summarySnapshot(sourceLocale, targetLocale) });
      expect(run.response.status, `${sourceLocale}->${targetLocale}`).toBe(200);
      expect(run.calls).toHaveLength(2);
    }
  });

  it('executes exactly one repair and second evaluator after primary rejection', async () => {
    const run = await invokeActualRoute({ mode: 'reject-primary' });
    expect(run.response.status).toBe(200); expect(run.calls).toHaveLength(4);
    expect(run.calls.map((call) => call.invocation.phase)).toEqual(['writer', 'evaluator', 'repair_writer', 'repair_evaluator']);
    expect(run.calls.map((call) => call.tool)).toEqual([
      CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer,
      CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.evaluator,
      CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.repair,
      CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.evaluator,
    ]);
    expect(run.calls.map((call) => call.invocation.timeoutMs)).toEqual([
      CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS,
      CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS,
      CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS,
      CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS,
    ]);
    expect(run.calls.every((call) => call.strict === true)).toBe(true);
    expect(run.calls.every((call) => (call.choice as { type?: string }).type === 'tool')).toBe(true);
    expect(run.calls.every((call) => (call.choice as { name?: string }).name === call.tool)).toBe(true);
    expect(run.calls.every((call) => (call.choice as { disable_parallel_tool_use?: boolean }).disable_parallel_tool_use === true)).toBe(true);
  });

  it('rejects a repaired candidate without a fifth semantic call', async () => {
    const run = await invokeActualRoute({ mode: 'reject-repair' });
    expect(run.response.status).toBe(422); expect(run.calls).toHaveLength(4);
  });

  it('maps a normal provider exception to 502 with one attempt and no repair', async () => {
    const run = await invokeActualRoute({ mode: 'provider-error' });
    expect(run.response.status).toBe(502); expect(run.body.reason).toBe('writer_failed'); expect(run.calls).toHaveLength(1);
    expect(run.calls[0]?.strict).toBe(true); expect(run.calls[0]?.choice).toMatchObject({ type: 'tool', disable_parallel_tool_use: true });
  });

  it('blocks missing/invalid Pro authorization before provider invocation', async () => {
    const run = await invokeActualRoute({ auth: 'invalid' });
    expect(run.response.status).toBe(403); expect(run.body.code).toBe('invalid_pro_token'); expect(run.calls).toHaveLength(0);
  });

  it('blocks a disabled feature before provider invocation', async () => {
    const run = await invokeActualRoute({ enabled: false });
    expect(run.response.status).toBe(409);
    expect(run.body).toMatchObject({ status: 'handled_failure', reason: 'v3_feature_disabled' });
    expect(run.body).toHaveProperty('diagnostic');
    expect(run.calls).toHaveLength(0);
  });

  it('blocks malformed JSON before provider invocation', async () => {
    const run = await invokeActualRoute({ malformedJson: true });
    expect(run.calls).toHaveLength(0); expect(run.response.status).not.toBe(200);
  });

  it.each([
    ['invalid hash', { ...summarySnapshot(), sourceTextHash: 'wrong' }],
    ['same locale', summarySnapshot('de', 'de')],
  ])('blocks %s snapshot before provider invocation', async (_label, snapshot) => {
    const run = await invokeActualRoute({ snapshot: snapshot as ContentLocalizeM6Snapshot });
    expect(run.response.status).toBe(422); expect(run.body.reason).toBe('invalid_authorization_snapshot'); expect(run.calls).toHaveLength(0);
  });

  it('fails closed for malformed writer output and evaluator identity drift', async () => {
    const malformed = await invokeActualRoute({ mode: 'malformed-writer' });
    expect(malformed.response.status).toBe(502); expect(malformed.body.reason).toBe('writer_failed');
    const drift = await invokeActualRoute({ mode: 'identity-drift' });
    expect(drift.response.status).toBe(502); expect(drift.body.reason).toBe('evaluator_identity_mismatch');
    const malformedRepair = await invokeActualRoute({ mode: 'malformed-repair' });
    expect(malformedRepair.response.status).toBe(502); expect(malformedRepair.body.reason).toBe('repair_failed');
    expect(malformedRepair.calls.map((call) => call.invocation.phase)).toEqual(['writer', 'evaluator', 'repair_writer']);
  });

  it('keeps accepted=false as a separate rejection gate', async () => {
    const acceptedFalse = await invokeActualRoute({ mode: 'accepted-false' });
    expect(acceptedFalse.response.status).toBe(422); expect(acceptedFalse.body.reason).toBe('candidate_rejected');
  });

  it('proves accepted=true plus a false mandatory criterion cannot false-green', async () => {
    const run = await invokeActualRoute({ mode: 'accepted-true-false-criterion' });
    expect(run.response.status).toBe(422); expect(run.body.reason).toBe('candidate_rejected');
    expect(run.calls.map((call) => call.invocation.phase)).toEqual(['writer', 'evaluator', 'repair_writer', 'repair_evaluator']);
    expect(run.calls).toHaveLength(4);
  });

  it('keeps provider-originated AbortError as a non-deadline transport failure', async () => {
    const run = await invokeActualRoute({ mode: 'abort' });
    expect(run.response.status).toBe(502); expect(run.body.reason).toBe('writer_failed'); expect(run.calls).toHaveLength(1);
    expect(run.body.diagnostic.deadlineExceeded).toBe(false);
    expect(run.body.diagnostic.deadlineOwner).toBe('unknown');
  });
});
