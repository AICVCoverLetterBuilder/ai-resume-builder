import { describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '@/lib/cv-defaults';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import type { CVData } from '@/lib/types';
import type { SummaryV3CommitReceipt } from '../summary-generate';
import { findExactDurationMeasurements } from '../exact-duration-measurement';
import { createConfirmedEmploymentTenureRelation } from '../summary-employment-tenure-relation';
import { summaryV3StyleCandidateUnitHash, type SummaryV3Style } from '../summary-style-m5';
import { SUMMARY_V3_STYLE_M5_ACTION } from '../summary-style-m5-client';
import { runSummaryV3StyleClientOperation } from '../summary-style-m5-client';
import type { SummaryV3StyleClientInput } from '../summary-style-m5-client';
import { executeSummaryV3StyleRoute, normalizeSummaryV3StyleRouteRequest,
  type SummaryV3StyleProviderInvocation, type SummaryV3StyleRouteAction } from '../summary-style-m5-provider';
import { createSummaryV3StyleM5RouteFailure } from '../summary-style-m5-transport';
import { emitSummaryStyleTerminalDiagnostic } from '../summary-style-m5-terminal-observability';
import type { SummaryV3StyleEvaluatorInput, SummaryV3StyleWriterInput } from '../summary-style-m5-server';

const sourceSummary = 'Imam oko 9 meseci iskustva. Trenutno radim kao magacioner u Primer Logistici, gde primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.';
const candidates: Readonly<Record<'shorter' | 'professional', string>> = {
  shorter: 'Imam oko 9 meseci iskustva. Radim kao magacioner u Primer Logistici: primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.',
  professional: 'Imam oko 9 meseci iskustva. Radim kao magacioner u Primer Logistici. U tom poslu primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.',
};

function cvFor(style: SummaryV3Style, summary = sourceSummary, trustedRelation = true): CVData {
  const empty = createEmptyCv();
  const value: CVData = {
    ...empty,
    id: `synthetic-cv-${style}`,
    summary,
    contentLocale: 'sr',
    experience: [{ id: 'synthetic-entry', position: 'magacioner', company: 'Primer Logistika',
      startDate: '2026-01', endDate: '', isPresent: true,
      description: 'Prima robu, proverava količine prema dokumentima isporuke, smešta artikle na dodeljene lokacije i priprema porudžbine za otpremu.',
      positionSourceLocale: 'sr' }],
  };
  if (!trustedRelation) return { ...value, summaryEmploymentTenureRelations: [] };
  const confirmed = createConfirmedEmploymentTenureRelation({ confirmation: 'employment_tenure', cv: value,
    measurement: findExactDurationMeasurements(summary)[0]!, explicitlySelectedExperienceStableId: 'synthetic-entry' });
  if (confirmed.status !== 'created') throw new Error('synthetic trusted tenure fixture was not created');
  return { ...value, summaryEmploymentTenureRelations: confirmed.relations };
}

function clientInput(style: 'shorter' | 'professional', value: CVData): SummaryV3StyleClientInput {
  return { enabled: true, style, operationId: `task092-${style}`, requestId: `task092-${style}-request`,
    cv: value, currentRoleExperienceId: 'synthetic-entry', requestedLocale: 'sr', sourceLocale: 'sr',
    jobContextKey: 'synthetic-context', referenceDateIso: '2026-10-01', usageCountBefore: 7,
    proToken: 'offline-only-placeholder', createdAt: 1_791_534_000_000 };
}

function providerResponse(invocation: SummaryV3StyleProviderInvocation, candidate: string): unknown {
  if (invocation.role === 'writer') {
    const input = invocation.input as SummaryV3StyleWriterInput;
    return { content: [{ type: 'tool_use', name: invocation.toolName, input: {
      operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale,
      units: [{ unitId: 'synthetic-unit', text: candidate, factIds: input.requiredFacts.map((fact) => fact.id) }],
    } }] };
  }
  const input = invocation.input as SummaryV3StyleEvaluatorInput;
  const styleEvidence = input.style === 'shorter'
    ? { semanticCompressionOperations: 1, shorterFulfilled: true, noOpDetected: false }
    : { professionalFramingOperations: 1, cohesionClarityOperations: 1,
      markerOnlyChangeDetected: false, jargonOrFillerDetected: false, professionalFulfilled: true, noOpDetected: false };
  return { content: [{ type: 'tool_use', name: invocation.toolName, input: {
    structuralStatus: 'passed', structuralViolations: [],
    semantic_groundingStatus: 'passed', semantic_groundingViolations: [],
    language_native_qualityStatus: 'passed', language_native_qualityViolations: [],
    style_fulfillmentStatus: 'passed', style_fulfillmentViolations: [],
    representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash), missingFactIdHashes: [],
    roleIdentityResolution: 'not_required', styleEvidence,
  } }] };
}

type Graph = {
  client: Pick<typeof import('../summary-style-m5-client'), 'runSummaryV3StyleClientOperation'>;
  provider: Pick<typeof import('../summary-style-m5-provider'), 'executeSummaryV3StyleRoute' | 'normalizeSummaryV3StyleRouteRequest'>;
};
const currentGraph: Graph = { client: { runSummaryV3StyleClientOperation },
  provider: { executeSummaryV3StyleRoute, normalizeSummaryV3StyleRouteRequest } };
const RELEASE_614_HEAD = 'c98893a4916f316b6c73e5914ea7cd57784cf95d';
function frozenRelease614Graph(): Graph {
  const root = process.cwd();
  const nativeRequire = createRequire(resolve(root, 'package.json'));
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const prior = cache.get(file);
    if (prior) return prior.exports;
    const loaded = { exports: {} as Record<string, unknown> };
    cache.set(file, loaded);
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    const source = execFileSync('git', ['show', `${RELEASE_614_HEAD}:${relative}`], { encoding: 'utf8', cwd: root });
    const localRequire = (id: string): unknown => {
      if (!id.startsWith('.') && !id.startsWith('@/')) return nativeRequire(id);
      const target = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(file), id);
      const next = [target, `${target}.ts`, resolve(target, 'index.ts')].find(existsSync);
      if (!next) throw new Error(`Missing frozen release module: ${id}`);
      return next.endsWith('.json') ? JSON.parse(readFileSync(next, 'utf8')) : load(next);
    };
    new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return {
    client: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-client.ts')) as Graph['client'],
    provider: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-provider.ts')) as Graph['provider'],
  };
}

async function executeStyle(
  style: 'shorter' | 'professional',
  graph: Graph = currentGraph,
  options: { candidate?: string; noOp?: boolean; unsupported?: boolean; sourceSummary?: string; trustedRelation?: boolean } = {},
) {
  const value = cvFor(style, options.sourceSummary ?? sourceSummary, options.trustedRelation ?? true);
  const input = clientInput(style, value);
  let usage = input.usageCountBefore;
  let serverResult: Awaited<ReturnType<typeof executeSummaryV3StyleRoute>> | null = null;
  const roles: string[] = [];
  const outcome = await graph.client.runSummaryV3StyleClientOperation(input, {
    async request(body) {
      const action = SUMMARY_V3_STYLE_M5_ACTION[style] as SummaryV3StyleRouteAction;
      const request = graph.provider.normalizeSummaryV3StyleRouteRequest(action, body, input.createdAt + 1);
      serverResult = await graph.provider.executeSummaryV3StyleRoute(request, {
        timeoutForPhase: () => 60_000,
        async invoke(invocation) {
          roles.push(invocation.role);
          if (invocation.role === 'writer') return providerResponse(invocation, options.candidate ?? candidates[style]);
          const response = providerResponse(invocation, options.candidate ?? candidates[style]) as { content: Array<{ input: Record<string, unknown> }> };
          const input = invocation.input as SummaryV3StyleEvaluatorInput;
          if (options.unsupported) {
            response.content[0]!.input.semantic_groundingStatus = 'failed';
            response.content[0]!.input.semantic_groundingViolations = [{
              code: 'unsupported_claim', factIdHashes: [],
              unitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash), repairable: false,
            }];
          }
          if (!options.noOp) return response;
          const styleEvidence = style === 'shorter'
            ? { semanticCompressionOperations: 0, shorterFulfilled: false, noOpDetected: true }
            : { professionalFramingOperations: 0, cohesionClarityOperations: 0,
              markerOnlyChangeDetected: true, jargonOrFillerDetected: false, professionalFulfilled: false, noOpDetected: true };
          response.content[0]!.input.styleEvidence = styleEvidence;
          response.content[0]!.input.representedFactIdHashes = input.requiredFacts.map((fact) => fact.hash);
          return response;
        },
      });
      const status = serverResult.kind === 'candidate_ready' || serverResult.kind === 'safe_no_op' ? 200 : 422;
      return { data: serverResult, status };
    },
    getLiveCv: () => value,
    getActiveOperationId: () => input.operationId,
    commitCandidate(receipt): SummaryV3CommitReceipt {
      usage += 1;
      return {
        kind: 'committed', operationId: receipt.operationId, requestId: receipt.requestId,
        canonicalAccepted: true, intendedCandidateHash: receipt.candidateHash,
        committedSummaryHash: receipt.candidateHash, committedContentLocale: receipt.requestedLocale,
        candidateMatched: true, persistenceAttempted: true, persistenceResult: 'passed',
        canonicalApplyAttempted: true, canonicalApplyResult: 'passed', usageAttempted: true,
        usageResult: 'passed', usageForwardWriteResult: 'succeeded', usageVerificationResult: 'passed',
        usageRollbackAttempted: false, usageRollbackResult: 'not_required',
        actualUsageBefore: receipt.usageCountBefore, actualUsageAfter: usage, actualUsageDelta: 1,
        rollbackAttempted: false, rollbackResult: 'not_required',
      };
    },
  });
  return { outcome, serverResult: serverResult as Awaited<ReturnType<typeof executeSummaryV3StyleRoute>> | null,
    roles, usageDelta: usage - input.usageCountBefore };
}

describe('Task092 release-614 offline baseline reproduction', () => {
  it.each(['shorter', 'professional'] as const)('reproduces release-614 %s 422 through the frozen client and server', async (style) => {
    const result = await executeStyle(style, frozenRelease614Graph());
    expect(result.serverResult).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact',
      evidence: { writerAttempts: 1, evaluatorAttempts: 0, writerOutputContractFailureClass: 'source_lock_preservation',
        writerCandidateReachedValidation: true, repairWriterAttempts: 0, repairEvaluatorAttempts: 0,
        sourceLockFailureKind: 'entity', sourceLockFailureReason: 'identity_surface_missing',
        sourceLockOrigin: 'automatic_relation_subject', sourceLockSurfaceMatchClass: 'absent_exact_surface' } });
    expect(result.roles).toEqual(['writer']);
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 422, reason: 'lost_source_fact' });
    expect(result.usageDelta).toBe(0);
    expect(result.outcome).not.toHaveProperty('remediation');
  }, 20000);

  it.each(['shorter', 'professional'] as const)('accepts and client-commits a valid %s candidate after bounded locale correction', async (style) => {
    const result = await executeStyle(style);
    expect(result.serverResult).toMatchObject({ kind: 'candidate_ready', style, mode: 'enhance_existing_content' });
    expect(result.outcome).toMatchObject({ kind: 'committed', status: 200 });
    expect(result.roles).toEqual(['writer', 'evaluator']);
    expect(result.usageDelta).toBe(1);
  });

  it.each(['shorter', 'professional'] as const)('rejects a %s no-op without apply or usage', async (style) => {
    const result = await executeStyle(style, currentGraph, { candidate: sourceSummary, noOp: true });
    expect(result.serverResult?.kind).toBe('handled_failure');
    expect(result.serverResult).toMatchObject({ typedReason: 'style_not_fulfilled' });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 422, reason: 'style_not_fulfilled' });
    expect(result.roles).toEqual(['writer', 'evaluator']);
    expect(result.usageDelta).toBe(0);
  });

  it.each(['shorter', 'professional'] as const)('preserves the trusted tenure relation for %s and rejects a dropped owned claim', async (style) => {
    const result = await executeStyle(style, currentGraph, {
      candidate: 'Radim kao magacioner u Primer Logistici, primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.',
    });
    expect(result.serverResult).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(result.roles).toEqual(['writer']);
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 422, reason: 'lost_source_fact' });
    expect(result.usageDelta).toBe(0);
  });

  it.each(['shorter', 'professional'] as const)('rejects a %s duration mutation before client commit', async (style) => {
    const result = await executeStyle(style, currentGraph, {
      candidate: candidates[style].replace('9 meseci', '10 meseci'),
    });
    expect(result.serverResult).toMatchObject({ kind: 'handled_failure' });
    expect(result.roles).toEqual(['writer']);
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 422 });
    expect(result.usageDelta).toBe(0);
  });

  it.each(['shorter', 'professional'] as const)('rejects an unsupported %s claim with no usage increment', async (style) => {
    const result = await executeStyle(style, currentGraph, {
      candidate: `${candidates[style]} Vodim tim od deset ljudi.`, unsupported: true,
    });
    expect(result.serverResult).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 422, reason: 'unsupported_claim' });
    expect(result.usageDelta).toBe(0);
  });

  it.each(['shorter', 'professional'] as const)('preserves an opaque project duration for %s without creating a tenure relation', async (style) => {
    const source = 'Na projektu sam radio oko 9 meseci. Trenutno radim kao magacioner u Primer Logistici, gde primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.';
    const candidate = 'Na projektu sam radio oko 9 meseci. Radim kao magacioner u Primer Logistici: primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.';
    const result = await executeStyle(style, currentGraph, { sourceSummary: source, trustedRelation: false, candidate });
    expect(result.serverResult).toMatchObject({ kind: 'candidate_ready', style });
    expect(result.outcome).toMatchObject({ kind: 'committed', status: 200 });
    expect(result.usageDelta).toBe(1);
  });

  it.each(['shorter', 'professional'] as const)('fails closed on multiple opaque durations for %s without binding either to employment', async (style) => {
    const source = 'Na projektu sam radio oko 9 meseci. Imam 2 godine iskustva u maloprodaji. Trenutno radim kao magacioner u Primer Logistici, gde primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.';
    const candidate = 'Na projektu sam radio oko 9 meseci. Imam 2 godine iskustva u maloprodaji. Radim kao magacioner u Primer Logistici: primam robu, proveravam količine prema dokumentima isporuke, smeštam artikle na dodeljene lokacije i pripremam porudžbine za otpremu.';
    const result = await executeStyle(style, currentGraph, { sourceSummary: source, trustedRelation: false, candidate });
    expect(result.serverResult).toMatchObject({ kind: 'handled_failure', style });
    expect(result.outcome).toMatchObject({ kind: 'terminal', status: 422 });
    expect(result.usageDelta).toBe(0);
  });
});

describe('Task092 privacy-safe style terminal coverage', () => {
  it.each(['shorter', 'stronger', 'professional'] as const)('emits one compatible terminal event tagged %s', (style) => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const event = emitSummaryStyleTerminalDiagnostic({ requestId: 'safe-task092-correlation',
      requestedLocale: 'sr', mode: 'enhance_existing_content', httpStatus: 422,
      result: createSummaryV3StyleM5RouteFailure('generation_validation_failed'), style });
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(JSON.stringify(event));
    expect(event).toMatchObject({ event: 'summary_stronger_terminal', operation: 'summary_style', style,
      terminalReason: 'generation_validation_failed', httpStatus: 422 });
    expect(JSON.stringify(event)).not.toContain('candidateText');
    expect(JSON.stringify(event)).not.toContain('Primer Logistika');
    info.mockRestore();
  });
});
