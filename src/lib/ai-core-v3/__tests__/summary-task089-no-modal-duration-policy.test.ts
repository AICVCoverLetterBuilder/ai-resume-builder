import { describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '@/lib/cv-defaults';
import type { CVData } from '@/lib/types';
import { findExactDurationMeasurements } from '../exact-duration-measurement';
import { createConfirmedEmploymentTenureRelation, projectSummaryEmploymentTenureRequest,
  prepareSummaryEmploymentTenureServerRequest, resolveSummaryEmploymentTenureRelations } from '../summary-employment-tenure-relation';
import { bindTrustedEmploymentTenureRuntime, summaryDurationCandidateComparison,
  trustedTenureSourceComparison, trustedEmploymentTenureAuthority } from '../summary-trusted-tenure-runtime';
import { createSummaryV3StyleOperationSnapshot, summaryV3StyleCandidateUnitHash, type SummaryV3StyleResult,
  type SummaryV3StyleRequest, SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME } from '../summary-style-m5';
import { executeSummaryV3StyleServer, type SummaryV3StyleWriterInput, type SummaryV3StyleEvaluatorInput } from '../summary-style-m5-server';
import { executeSummaryV3StyleRoute, normalizeSummaryV3StyleRouteRequest, type SummaryV3StyleProviderInvocation } from '../summary-style-m5-provider';
import { runSummaryV3StyleClientOperation, type SummaryV3StyleClientInput } from '../summary-style-m5-client';
import { readSummaryStyleLocalDiagnostics } from '../summary-style-m5-local-observability';
import * as durationRuntime from '../summary-trusted-tenure-runtime';
import { languages, translations } from '@/lib/i18n/translations';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const BASELINE = '56993cade3e995ec186a8f7695a19d626b3e9e52';
const SOURCE = 'SyntheticPerson currently works as a Clerk at FictionalLab for about 8 months. SyntheticPerson builds reliable APIs.';
const CURRENT = SOURCE.replace('8 months', '9 months').replace('builds reliable APIs', 'engineers reliable APIs');
function cv(summary = SOURCE, trusted = true): CVData {
  const empty = createEmptyCv();
  const value: CVData = { ...empty, id: 'synthetic-cv', summary, contentLocale: 'en',
    personal: { ...empty.personal, fullName: 'SyntheticPerson' },
    experience: [{ id: 'synthetic-entry', position: 'Clerk', company: 'FictionalLab', startDate: '2026-01',
      endDate: '', isPresent: true, description: 'builds reliable APIs', positionSourceLocale: 'en' }] };
  if (!trusted) return value;
  const confirmation = createConfirmedEmploymentTenureRelation({ confirmation: 'employment_tenure', cv: value,
    measurement: findExactDurationMeasurements(summary)[0]!, explicitlySelectedExperienceStableId: 'synthetic-entry' });
  if (confirmation.status !== 'created') throw new Error('Synthetic v1 relation invalid');
  return { ...value, summaryEmploymentTenureRelations: confirmation.relations };
}
function input(value: CVData): SummaryV3StyleClientInput {
  return { enabled: true, style: 'stronger', operationId: 'synthetic-operation', requestId: 'synthetic-request',
    cv: value, currentRoleExperienceId: 'synthetic-entry', requestedLocale: 'en', sourceLocale: 'en',
    jobContextKey: 'synthetic-context', referenceDateIso: '2026-10-01', usageCountBefore: 4,
    proToken: 'offline-placeholder', createdAt: 2000 };
}
function message(i: SummaryV3StyleProviderInvocation, text: string) {
  if (i.role === 'writer') return { content: [{ type: 'tool_use', name: i.toolName, input: {
    operationId: i.input.operationId, snapshotHash: i.input.snapshotHash, manifestHash: i.input.manifestHash,
    style: i.input.style, locale: i.input.locale,
    units: [{ unitId: 'synthetic-unit', text, factIds: i.input.requiredFacts.map((f) => f.id) }],
  } }] };
  const e = i.input as import('../summary-style-m5-server').SummaryV3StyleEvaluatorInput;
  return { content: [{ type: 'tool_use', name: i.toolName, input: {
    operationId: e.operationId, snapshotHash: e.snapshotHash, manifestHash: e.manifestHash,
    style: e.style, locale: e.locale, candidateHash: e.candidate.hash,
    candidateUnitHashes: e.candidate.units.map(summaryV3StyleCandidateUnitHash),
    phases: Object.fromEntries(['structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment']
      .map((p) => [p, { status: 'passed', violations: [] }])),
    representedFactIdHashes: e.requiredFacts.map((f) => f.hash), missingFactIdHashes: [],
    roleIdentityResolution: 'not_required', styleEvidence: { style: 'stronger',
      strongerPredicateTransformations: 1, structuralStrengtheningCount: 1, modifierOnlyTransformationDetected: false,
      repeatedStyleModifierCount: 0, stackedModifierDetected: false, unsupportedAuthorityDetected: false,
      strongerFulfilled: true, noOpDetected: false },
  } }] };
}
type Graph = { client: typeof import('../summary-style-m5-client'); provider: typeof import('../summary-style-m5-provider');
  server: typeof import('../summary-style-m5-server');
  sidecar: Pick<typeof import('../summary-style-m5-local-observability'), 'readSummaryStyleLocalDiagnostics'> };
const currentGraph: Graph = { client: { runSummaryV3StyleClientOperation } as Graph['client'],
  provider: { executeSummaryV3StyleRoute, normalizeSummaryV3StyleRouteRequest } as Graph['provider'],
  server: { executeSummaryV3StyleServer } as Graph['server'], sidecar: { readSummaryStyleLocalDiagnostics } };
function frozenGraph(): Graph {
  const root = process.cwd(), native = createRequire(resolve(root, 'package.json'));
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const prior = cache.get(file); if (prior) return prior.exports;
    const mod = { exports: {} as Record<string, unknown> }; cache.set(file, mod);
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    const source = execFileSync('git', ['show', BASELINE + ':' + relative], { encoding: 'utf8', cwd: root });
    const local = (id: string): unknown => {
      if (!id.startsWith('.') && !id.startsWith('@/')) return native(id);
      const target = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(file), id);
      const next = [target, target + '.ts', resolve(target, 'index.ts')].find(existsSync);
      if (!next) throw new Error('Missing frozen module: ' + id);
      return next.endsWith('.json') ? JSON.parse(readFileSync(next, 'utf8')) : load(next);
    };
    new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText)(local, mod, mod.exports);
    return mod.exports;
  }
  return { client: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-client.ts')) as Graph['client'],
    provider: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-provider.ts')) as Graph['provider'],
    server: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-server.ts')) as Graph['server'],
    sidecar: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-local-observability.ts')) as Graph['sidecar'] };
}
async function flow(options: { value?: CVData; text?: string; graph?: Graph; drift?: number;
  mutateRequest?: (body: Record<string, unknown>) => Record<string, unknown>;
  mutateResult?: (result: SummaryV3StyleResult) => unknown; mutateLive?: (value: CVData) => CVData;
  active?: string; failCommit?: boolean } = {}) {
  const value = options.value ?? cv(), graph = options.graph ?? currentGraph;
  let live = value, usage = 4, seen: Record<string, unknown> = {}, server: SummaryV3StyleResult | null = null;
  const calls: SummaryV3StyleProviderInvocation[] = [];
  const commit = vi.fn((c: Parameters<Parameters<typeof runSummaryV3StyleClientOperation>[1]['commitCandidate']>[0]) => {
    // Minimal client-boundary port; the separate physical-equivalent harness
    // exercises the actual page transaction and its complete commit receipt.
    if (options.failCommit) return { kind: 'failed' as const, reason: 'canonical_apply_failed' as const } as never;
    live = c.nextCv; usage++;
    return { kind: 'committed', operationId: c.operationId, requestId: c.requestId } as never;
  });
  const outcome = await graph.client.runSummaryV3StyleClientOperation(input(value), {
    async request(body) {
      seen = body;
      const req = graph.provider.normalizeSummaryV3StyleRouteRequest('summary_stronger',
        options.mutateRequest ? options.mutateRequest(body) : body, 2000 + (options.drift ?? 450));
      server = await graph.provider.executeSummaryV3StyleRoute(req, { timeoutForPhase: () => 60000, async invoke(i) {
        calls.push(i); return message(i, options.text ?? CURRENT);
      } });
      if (options.mutateLive) live = options.mutateLive(live);
      return { data: options.mutateResult ? options.mutateResult(server) : server,
        status: server.kind === 'candidate_ready' || server.kind === 'safe_no_op' ? 200 : 422 };
    }, getLiveCv: () => live, getActiveOperationId: () => options.active ?? 'synthetic-operation',
    commitCandidate: commit,
  });
  return { outcome, server: server as SummaryV3StyleResult | null, commit, usageDelta: usage - 4, live, seen, calls, original: value };
}
function boundSnapshot(value: CVData) {
  // Actual client projection, not a parallel request implementation.
  const current = createEmptyCv();
  const stableId = 'entry-' + hash(value.experience[0]!.id);
  const request = { enabled: true, operation: 'summary_stronger' as const, operationId: 'synthetic-operation',
    style: 'stronger' as const, requestedLocale: 'en', sourceLocale: 'en', visibleSummary: value.summary,
    createdAt: 2000, manifest: { manifestId: 'synthetic-manifest', contextId: current.id,
      sourceLocale: 'en', currentRoleEntryId: value.experience[0]!.isPresent ? stableId : null,
      entries: [{ stableId, role: 'Clerk', employer: 'FictionalLab',
        employmentState: value.experience[0]!.isPresent ? 'present' as const : 'completed' as const,
        durationMonths: 9, facts: [{ id: 'duty', text: 'builds reliable APIs' }] }] } };
  const prepared = prepareSummaryEmploymentTenureServerRequest(projectSummaryEmploymentTenureRequest(request, value));
  return bindTrustedEmploymentTenureRuntime(createSummaryV3StyleOperationSnapshot(prepared.contentRequest), prepared.resolution);
}
import { hashSummaryV3StyleValue as hash } from '../summary-style-m5';

const opaqueFixture089R = 'Ava Patel currently works as a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
function request089R(source = opaqueFixture089R): SummaryV3StyleRequest {
  return { enabled: true, operation: 'summary_stronger', operationId: 'opaque-089r', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: source, protectedEntities: ['Ava Patel'], createdAt: 2000,
    visibleSummaryFacts: [{ id: 'name', text: 'Ava Patel' }, { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' }, { id: 'api', text: 'builds reliable APIs' },
      { id: 'mentor', text: 'mentors peers' }, { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' }],
    manifest: { manifestId: 'opaque-manifest', contextId: 'opaque-context', sourceLocale: 'en', currentRoleEntryId: 'current',
      entries: [{ stableId: 'current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24,
        facts: [{ id: 'api', text: 'builds reliable APIs' }, { id: 'mentor', text: 'mentors peers' },
          { id: 'metric', text: 'improved delivery by 20%' }] }] } };
}
function writer089R(i: SummaryV3StyleWriterInput, text: string) {
  return { toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: i.operationId, snapshotHash: i.snapshotHash, manifestHash: i.manifestHash,
      style: i.style, locale: i.locale, units: [{ unitId: 'opaque-unit', text, factIds: i.requiredFacts.map((f) => f.id) }] } };
}
function evaluator089R(i: SummaryV3StyleEvaluatorInput, mode: 'pass' | 'no_op' | 'reject' | 'repair' = 'pass') {
  return { toolName: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: i.operationId, snapshotHash: i.snapshotHash, manifestHash: i.manifestHash,
      style: i.style, locale: i.locale, candidateHash: i.candidate.hash,
      candidateUnitHashes: i.candidate.units.map(summaryV3StyleCandidateUnitHash),
      phases: Object.fromEntries(['structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment'].map((phase) => {
        const failed = mode === 'reject' && phase === 'semantic_grounding' || mode === 'repair' && phase === 'style_fulfillment';
        return [phase, { status: failed ? 'failed' : 'passed', violations: failed ? [{
          code: mode === 'reject' ? 'lost_source_fact' : 'style_not_fulfilled', factIdHashes: [],
          unitHashes: [summaryV3StyleCandidateUnitHash(i.candidate.units[0]!)], repairable: mode === 'repair',
        }] : [] }];
      })),
      representedFactIdHashes: i.requiredFacts.map((f) => f.hash), missingFactIdHashes: [], roleIdentityResolution: 'not_required',
      styleEvidence: { style: 'stronger', strongerPredicateTransformations: mode === 'repair' || mode === 'no_op' ? 0 : 1,
        structuralStrengtheningCount: mode === 'repair' || mode === 'no_op' ? 0 : 1, modifierOnlyTransformationDetected: false,
        repeatedStyleModifierCount: 0, stackedModifierDetected: false, unsupportedAuthorityDetected: false,
        strongerFulfilled: mode !== 'repair', noOpDetected: mode === 'no_op' } } };
}

describe('Task089R exact opaque slots and historical execution precedence', () => {
  const graph = frozenGraph();
  it.each([
    { locale: 'en', name: 'Mira', role: 'Engineer', employer: 'Atlas', duty: 'builds reliable APIs', predicate: 'builds',
      source: 'Mira is an Engineer at Atlas. Mira builds reliable APIs for 24 months.',
      candidate: 'Mira is an Engineer at Atlas. Mira engineers reliable APIs for 24 months.' },
    { locale: 'hi', name: 'मीरा', role: 'इंजीनियर', employer: 'एटलस', duty: 'विश्वसनीय एपीआई बनाती हैं', predicate: 'बनाती',
      source: 'मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई बनाती हैं और 24 महीनों से काम करती हैं।',
      candidate: 'मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई विकसित करती हैं और 24 महीनों से काम करती हैं।' },
  ] as const)('permits existing SAME-unit %s rewrite without freezing other words', async (fixture) => {
    const request: SummaryV3StyleRequest = { ...request089R(), requestedLocale: fixture.locale, sourceLocale: fixture.locale,
      visibleSummary: fixture.source, protectedEntities: [fixture.name],
      visibleSummaryFacts: [{ id: 'marked', text: fixture.duty, semanticKind: 'duty',
        transformableDuty: { sourcePredicate: fixture.predicate, predicateAnchor: fixture.predicate } }],
      manifest: { manifestId: 'native-manifest', contextId: 'native-context', sourceLocale: fixture.locale, currentRoleEntryId: 'native',
        entries: [{ stableId: 'native', role: fixture.role, employer: fixture.employer, employmentState: 'present',
          durationMonths: 24, facts: [{ id: 'native-duty', text: fixture.duty }] }] } };
    const runs = [];
    for (const server of [graph.server.executeSummaryV3StyleServer, executeSummaryV3StyleServer]) {
      const calls: unknown[] = [];
      const result = await server(request, { async write(i) { calls.push(['writer', i]); return writer089R(i, fixture.candidate); },
        async evaluate(i) { calls.push(['evaluator', i]); return evaluator089R(i); } });
      expect(result.kind).toBe('candidate_ready'); runs.push({ result, calls });
    }
    expect(runs[1]).toEqual(runs[0]);
  });
  it('allows non-duration rewrite in a same-unit opaque slot, but not 8 to 9', () => {
    const source = 'SyntheticPerson builds reliable APIs for 8 months.';
    const snapshot = boundSnapshot(cv(source, false));
    expect(summaryDurationCandidateComparison(snapshot, source.replace('builds', 'engineers'))).not.toBeNull();
    expect(summaryDurationCandidateComparison(snapshot, source.replace('builds', 'engineers').replace('8 months', '9 months'))).toBeNull();
  });
  it.each([
    ['preserved', 'Led work on A for 8 months and B for 7 months.', true],
    ['mutated', 'Led work on A for 8 months and B for 8 months.', false],
    ['swapped', 'Led work on A for 7 months and B for 8 months.', false],
    ['duplicated', 'Led work on A for 8 months and B for 7 months and C for 8 months.', false],
    ['deleted', 'Led work on A for 8 months and B.', false],
    ['moved', 'Led work on A for 8 months. Worked on B for 7 months.', false],
  ] as const)('preserves ordered multi-slot identity: %s', (_label, candidate, accepted) => {
    const snapshot = boundSnapshot(cv('Worked on A for 8 months and B for 7 months.', false));
    expect(summaryDurationCandidateComparison(snapshot, candidate) !== null).toBe(accepted);
  });
  it('excludes trusted candidate measurements from SAME-unit opaque ownership', () => {
    const source = SOURCE.replace('8 months.', '8 months and worked on Project X for 7 months.');
    const snapshot = boundSnapshot(cv(source)), current = source.replace('8 months', '9 months');
    expect(summaryDurationCandidateComparison(snapshot, current)).not.toBeNull();
    for (const candidate of [source, current.replace('7 months', '9 months'), current.replace('7 months', '8 months'),
      current.replace('9 months and worked on Project X for 7 months', '7 months and worked on Project X for 9 months')]) {
      expect(summaryDurationCandidateComparison(snapshot, candidate)).toBeNull();
    }
  });
  it.each(['candidate_ready', 'safe_no_op', 'evaluator_rejection', 'successful_repair', 'source_lock', 'hard_predicate'] as const)
    ('keeps frozen provider/evaluator/repair and terminal precedence: %s', async (scenario) => {
      const request = request089R(), strengthened = opaqueFixture089R.replace('builds', 'engineers');
      const runs = [];
      for (const owner of [graph, currentGraph]) {
        const calls: unknown[] = [];
        const text = scenario === 'safe_no_op' || scenario === 'successful_repair' ? opaqueFixture089R
          : scenario === 'source_lock' ? strengthened.replace('Atlas', 'OtherSynthetic')
          : scenario === 'hard_predicate' ? strengthened + ' She is a senior leader.' : strengthened;
        const result = await owner.server.executeSummaryV3StyleServer(request, {
          async write(i) { calls.push(['writer', i]); return writer089R(i, text); },
          async evaluate(i) { calls.push(['evaluator', i]); return evaluator089R(i, scenario === 'safe_no_op' ? 'no_op'
            : scenario === 'evaluator_rejection' ? 'reject' : scenario === 'successful_repair' ? 'repair' : 'pass'); },
          async repairWrite(i) { calls.push(['repair_writer', i]); return writer089R(i, strengthened); },
          async repairEvaluate(i) { calls.push(['repair_evaluator', i]); return evaluator089R(i); },
        });
        const expected = scenario === 'candidate_ready' || scenario === 'successful_repair' ? 'candidate_ready'
          : scenario === 'safe_no_op' || scenario === 'hard_predicate' ? 'safe_no_op' : 'handled_failure';
        expect(result.kind).toBe(expected);
        expect(calls.map((value) => (value as unknown[])[0])).toEqual(scenario === 'successful_repair'
          ? ['writer', 'evaluator', 'repair_writer', 'repair_evaluator'] : scenario === 'source_lock' ? ['writer'] : ['writer', 'evaluator']);
        runs.push({ result, calls, diagnostics: owner.sidecar.readSummaryStyleLocalDiagnostics(result) });
      }
      expect(runs[1]).toEqual(runs[0]);
    });
  it('rejects self-consistent forged candidate-ready opaque mutation before client commit or usage', async () => {
    const guard = vi.spyOn(durationRuntime, 'summaryDurationCandidateComparison');
    let callbackCompleted = false;
    let forged: SummaryV3StyleResult | undefined;
    try {
    const r = await flow({ value: cv(SOURCE, false), text: SOURCE.replace('builds', 'engineers'), mutateResult: (result) => {
      if (result.kind !== 'candidate_ready') throw new Error('Expected genuine candidate-ready control');
      const units = result.candidate.units.map((unit) => ({ ...unit, text: unit.text.replace('8 months', '9 months') }));
      const text = units.map((unit) => unit.text).join(' ').trim();
      const candidateHash = hash(JSON.stringify(units.map((unit) => [unit.unitId, unit.text, unit.factIds])));
      forged = { ...result, candidate: { ...result.candidate, units, text, hash: candidateHash },
        evidence: { ...result.evidence, candidateHash } };
      callbackCompleted = true;
      return forged;
    } });
    expect(callbackCompleted).toBe(true);
    expect(forged?.kind).toBe('candidate_ready');
    expect(r.server?.kind).toBe('candidate_ready');
    expect(r.outcome).toMatchObject({ kind: 'terminal', reason: 'candidate_identity_mismatch' });
    expect(r.outcome).not.toMatchObject({ reason: 'network_error' });
    expect(guard.mock.calls.some(([, text]) => text.includes('9 months'))).toBe(true);
    expect(r.commit).not.toHaveBeenCalled(); expect(r.usageDelta).toBe(0); expect(r.live).toEqual(r.original);
    } finally { guard.mockRestore(); }
  });
  it('opaque success creates no relation and uses no hidden confirmation', async () => {
    const r = await flow({ value: cv(SOURCE, false), text: SOURCE.replace('builds', 'engineers') });
    expect(r.outcome.kind).toBe('committed'); expect(r.usageDelta).toBe(1);
    expect(r.live.summaryEmploymentTenureRelations?.length ?? 0).toBe(0);
    expect(r.live.summary).toContain('about 8 months');
    expect(JSON.stringify(r.calls)).not.toContain('trustedTenureClaims');
  });
});

describe('Task089 actual clock identity, client commit, and immutable baseline differential', () => {
  it('reproduces frozen pre-fix and fixes the SAME unequal-clock real client/route/provider/server operation', async () => {
    const before = await flow({ graph: frozenGraph() }), after = await flow();
    expect(before.server?.kind).toBe('candidate_ready');
    expect(before.outcome).toMatchObject({ kind: 'terminal', reason: 'candidate_identity_mismatch' });
    expect(before.commit).not.toHaveBeenCalled(); expect(before.usageDelta).toBe(0);
    expect(after.server?.kind).toBe('candidate_ready'); expect(after.outcome.kind).toBe('committed');
    expect(after.commit).toHaveBeenCalledTimes(1); expect(after.usageDelta).toBe(1);
    expect(after.seen).toEqual(before.seen); expect(after.seen.createdAt).toBe(2000);
    expect(after.live.summary).toBe(CURRENT);
    expect(resolveSummaryEmploymentTenureRelations(after.live.summaryEmploymentTenureRelations, {
      cvId: after.live.id, summary: after.live.summary, experienceStableIds: after.live.experience.map((e) => e.id),
    }).status).toBe('valid');
    for (const key of Object.keys(after.original) as (keyof CVData)[]) {
      if (!key.startsWith('summary')) expect(after.live[key]).toEqual(after.original[key]);
    }
  }, 30000);
  it.each([1, 1000, 198000])('does not require independent clock equality with drift %s', async (drift) => {
    const r = await flow({ drift }); expect(r.outcome.kind).toBe('committed');
    expect(r.commit).toHaveBeenCalledTimes(1); expect(r.usageDelta).toBe(1);
  });
  it.each([NaN, Infinity, -1, null, '2000'])('rejects malformed supplied request time %s without provider/commit', async (time) => {
    const r = await flow({ mutateRequest: (b) => ({ ...b, createdAt: time }) });
    expect(r.outcome.kind).toBe('terminal'); expect(r.calls).toHaveLength(0);
    expect(r.commit).not.toHaveBeenCalled(); expect(r.usageDelta).toBe(0);
  });
  it('retains safe server-time normalization for old callers missing createdAt', () => {
    expect(normalizeSummaryV3StyleRouteRequest('summary_stronger', {}, 777).createdAt).toBe(777);
  });
  it('failed atomic commit never advances usage', async () => {
    const r = await flow({ failCommit: true }); expect(r.outcome.kind).toBe('terminal');
    expect(r.commit).toHaveBeenCalledTimes(1); expect(r.usageDelta).toBe(0); expect(r.live).toEqual(r.original);
  });
  const negatives = ['operation', 'request', 'manifest', 'fingerprint', 'relation_removed', 'relation_other',
    'summary_edit', 'entry_delete', 'entry_replace', 'another_candidate', 'stale', 'invented', 'wrong_unit',
    'moved', 'ambiguous', 'forged_continuation', 'replay', 'closed_current_refresh'] as const;
  it.each(negatives)('keeps bounded race/replay rejection: %s', async (kind) => {
    const options: Parameters<typeof flow>[0] = {};
    if (kind === 'operation') options.mutateRequest = (b) => ({ ...b, operationId: 'other-operation' });
    if (kind === 'request') options.mutateRequest = (b) => ({ ...b, requestIdentity: 'other-request' });
    if (kind === 'manifest') options.mutateRequest = (b) => ({ ...b, manifest: { ...b.manifest as object, manifestId: 'other-manifest' } });
    if (kind === 'fingerprint' || kind === 'forged_continuation') options.mutateResult = (r) => ({ ...r,
      tenureOperationFingerprint: 'forged', forgedContinuation: [{ durationSpanStart: 0, durationSpanEnd: 1 }] });
    if (kind === 'relation_removed') options.mutateLive = (v) => ({ ...v, summaryEmploymentTenureRelations: [] });
    if (kind === 'relation_other') options.mutateLive = (v) => ({ ...v,
      summaryEmploymentTenureRelations: v.summaryEmploymentTenureRelations!.map((r) => ({ ...r, experienceStableId: 'other-entry' })) });
    if (kind === 'summary_edit' || kind === 'replay') options.mutateLive = (v) => ({ ...v, summary: v.summary + ' Edited.' });
    if (kind === 'entry_delete') options.mutateLive = (v) => ({ ...v, experience: [] });
    if (kind === 'entry_replace') options.mutateLive = (v) => ({ ...v,
      experience: v.experience.map((e) => ({ ...e, id: 'replacement-entry', company: 'OtherSynthetic' })) });
    if (kind === 'another_candidate') options.active = 'newer-operation';
    if (kind === 'stale') options.text = CURRENT.replace('9 months', '8 months');
    if (kind === 'invented') options.text = CURRENT.replace('9 months', '11 months');
    if (kind === 'wrong_unit') options.text = CURRENT.replace('9 months', '9 years');
    if (kind === 'moved') options.text = CURRENT.replace(' for about 9 months', '') + ' Project duration was 9 months.';
    if (kind === 'ambiguous') options.text = CURRENT + ' ' + CURRENT.split('. ')[0] + '.';
    if (kind === 'closed_current_refresh') {
      const value = cv(); value.experience[0]!.isPresent = false; value.experience[0]!.endDate = '2026-09';
      options.value = value; options.text = CURRENT.replace('9 months', '11 months');
    }
    const r = await flow(options);
    expect(r.outcome.kind).toBe('terminal'); expect(r.commit).not.toHaveBeenCalled(); expect(r.usageDelta).toBe(0);
  });
});

describe('Task089 opaque preservation without tenure inference', () => {
  it('one real legacy Stronger apply preserves 8, creates no relation and commits once', async () => {
    const r = await flow({ value: cv(SOURCE, false), text: SOURCE.replace('builds reliable APIs', 'engineers reliable APIs') });
    expect(r.server?.kind).toBe('candidate_ready'); expect(r.outcome.kind).toBe('committed');
    expect(r.live.summary).toContain('about 8 months'); expect(r.live.summaryEmploymentTenureRelations).toBeUndefined();
    expect(r.commit).toHaveBeenCalledTimes(1); expect(r.usageDelta).toBe(1);
    expect(readSummaryStyleLocalDiagnostics(r.server!).sourceFloorFirstProducer).toBeNull();
    expect(JSON.stringify(r.calls)).not.toContain('trustedTenureClaims');
  });
  it.each(['9 months', '7 months', '8 years', ''])('rejects opaque measurement mutation/removal %s', async (surface) => {
    const r = await flow({ value: cv(SOURCE, false),
      text: SOURCE.replace('8 months', surface).replace('builds reliable APIs', 'engineers reliable APIs') });
    expect(r.outcome.kind).toBe('terminal'); expect(r.commit).not.toHaveBeenCalled(); expect(r.usageDelta).toBe(0);
  });
  it.each([SOURCE.replace(' for about 8 months', '') + ' Project lasted 8 months.',
    SOURCE.replace('8 months', '9 months') + ' Another claim has 8 months.', SOURCE + ' ' + SOURCE.split('. ')[0] + '.'])
    ('does not satisfy a preserved slot by relocation, another numeral or duplicated claim', (text) => {
      expect(summaryDurationCandidateComparison(boundSnapshot(cv(SOURCE, false)), text)).toBeNull();
    });
  it('project duration is preserved, never refreshed from current employment', async () => {
    const project = 'SyntheticPerson worked on Project X for 8 months. SyntheticPerson builds reliable APIs.';
    const r = await flow({ value: cv(project, false), text: project.replace('builds reliable APIs', 'engineers reliable APIs') });
    expect(r.outcome.kind).toBe('committed'); expect(r.live.summaryEmploymentTenureRelations).toBeUndefined();
    expect(summaryDurationCandidateComparison(boundSnapshot(cv(project, false)), project.replace('8 months', '9 months'))).toBeNull();
  });
  it.each([false, true])('mixed independent slots (trusted=%s) require both exact authorities', async (trusted) => {
    const mixed = SOURCE + ' SyntheticPerson worked on Project X for 7 months.';
    const expected = (trusted ? CURRENT : SOURCE.replace('builds reliable APIs', 'engineers reliable APIs'))
      + ' SyntheticPerson worked on Project X for 7 months.';
    const value = cv(mixed, trusted), r = await flow({ value, text: expected });
    expect(r.outcome.kind).toBe('committed'); expect(r.usageDelta).toBe(1);
    expect(r.live.summaryEmploymentTenureRelations?.length ?? 0).toBe(trusted ? 1 : 0);
    expect(summaryDurationCandidateComparison(boundSnapshot(value), expected.replace('7 months', '8 months'))).toBeNull();
    expect(summaryDurationCandidateComparison(boundSnapshot(value), expected.replace('7 months', '9 months'))).toBeNull();
  });
  it('trusted and opaque measurements in the SAME unit never cross-bind', () => {
    const mixed = SOURCE.replace('8 months.', '8 months and worked on Project X for 7 months.');
    const snapshot = boundSnapshot(cv(mixed));
    expect(summaryDurationCandidateComparison(snapshot, mixed.replace('8 months', '9 months'))).not.toBeNull();
    expect(summaryDurationCandidateComparison(snapshot, mixed)).toBeNull();
    expect(summaryDurationCandidateComparison(snapshot, mixed.replace('8 months', '9 months').replace('7 months', '8 months'))).toBeNull();
  });
  const nativeMonths = { en: 'months', de: 'Monaten', es: 'meses', fr: 'mois', it: 'mesi', ar: 'أشهر',
    sr: 'meseci', hr: 'mjeseci', ru: 'месяцев', 'pt-BR': 'meses', hi: 'महीने', ja: 'か月' } as const;
  it.each(languages.map(({ code }) => code))('Task082 exact opaque preservation across %s', (locale) => {
    const surface = (n: number) => n + (locale === 'ja' ? '' : ' ') + nativeMonths[locale];
    const source = SOURCE.replace('8 months', surface(8)), snapshot = boundSnapshot(cv(source, false));
    expect(summaryDurationCandidateComparison(snapshot, source.replace('builds reliable APIs', 'engineers reliable APIs'))).not.toBeNull();
    expect(summaryDurationCandidateComparison(snapshot, source.replace(surface(8), surface(9)))).toBeNull();
    expect(trustedTenureSourceComparison(snapshot).sourceSummary).not.toContain(surface(8));
    expect(trustedEmploymentTenureAuthority(snapshot)).toBeNull();
    expect(translations[locale]).not.toHaveProperty('employmentTenureConfirmation');
  });
  it.each(['77 tools', '30%', '$70', 'X99'])('does not exempt unrelated source %s', async (value) => {
    const summary = SOURCE + ' SyntheticPerson uses ' + value + '.';
    const r = await flow({ value: cv(summary, false), text: summary.replace('builds reliable APIs', 'engineers reliable APIs') });
    expect(r.outcome.kind).toBe('terminal'); expect(r.commit).not.toHaveBeenCalled(); expect(r.usageDelta).toBe(0);
  });
  it('retains the existing calendar-token policy rather than granting a new date exemption', async () => {
    const summary = SOURCE.replace('8 months', '9 months') + ' SyntheticPerson uses 2025.';
    const text = summary.replace('builds reliable APIs', 'engineers reliable APIs');
    const before = await flow({ value: cv(summary, false), text, graph: frozenGraph(), drift: 0 });
    const after = await flow({ value: cv(summary, false), text, drift: 0 });
    expect(after.outcome.kind).toBe(before.outcome.kind); expect(after.usageDelta).toBe(before.usageDelta);
    expect(after.calls).toEqual(before.calls);
  }, 30000);
  it('closed valid v1 relation never becomes opaque CURRENT refresh permission', () => {
    const value = cv(); value.experience[0]!.isPresent = false; value.experience[0]!.endDate = '2026-09';
    const snapshot = boundSnapshot(value);
    expect(trustedEmploymentTenureAuthority(snapshot)).toBeNull();
    expect(trustedTenureSourceComparison(snapshot)).toBe(snapshot);
  });
});
