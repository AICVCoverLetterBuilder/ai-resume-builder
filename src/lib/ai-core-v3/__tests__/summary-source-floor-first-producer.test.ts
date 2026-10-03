import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type * as Domain from '../summary-style-m5';
import type * as Server from '../summary-style-m5-server';
import type * as Provider from '../summary-style-m5-provider';
import type * as Projector from '../summary-v3-production-observability';
import * as Sidecar from '../summary-style-m5-local-observability';
import { removeTask075ObservationFootprint } from './fixtures/summary-numeric-mismatch-observation-footprint';
import { assertCurrentTask084SourceFloorContract, historicalPreTask084Source } from './fixtures/task085-historical-current-contract';

const BASELINE = '1b7426f98c0dcc4806048beab4c04df1483d8d40';
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
type Snapshot = Domain.SummaryV3StyleOperationSnapshot;
type Hard = { reason: string | null; predicate: string | null; sourceFloorFirstProducer?: Sidecar.SummaryStyleSourceFloorFirstProducer };
type Graph = {
  domain: typeof Domain;
  server: typeof Server & { audit: {
    source: (snapshot: Snapshot) => boolean;
    first: (snapshot: Snapshot) => Sidecar.SummaryStyleSourceFloorFirstProducer | null;
    hard: (snapshot: Snapshot, text: string) => Hard;
    eligibility: (snapshot: Snapshot) => string;
    finish: (result: Domain.SummaryV3StyleResult, snapshot: Snapshot, evaluation: unknown, hard: Hard, role: null, eligibility: 'source_inconsistency') => Domain.SummaryV3StyleResult;
    callCount: () => number;
  } };
  provider: typeof Provider;
  projector: typeof Projector;
  sidecar: typeof Sidecar;
};
const changedModules = ['summary-style-m5-server.ts', 'summary-style-m5-local-observability.ts'];
// Actual immutable Git oracle and candidate in independent memory module graphs.
// Private audit exports/counter exist only in test memory, never in production.
function graph(baseline: boolean): Graph {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const hit = cache.get(file);
    if (hit) return hit.exports;
    const loaded = { exports: {} as Record<string, unknown> };
    cache.set(file, loaded);
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    const original = baseline && changedModules.some(name => relative === 'src/lib/ai-core-v3/' + name)
      ? execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, encoding: 'utf8' })
      : readFileSync(file, 'utf8');
    let code = ts.transpileModule(original, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    if (relative.endsWith('/summary-style-m5-server.ts')) {
      code += '\nlet auditCalls=0;'
        + (baseline
          ? 'const originalSource=hasUnsupportedSourceInconsistency;hasUnsupportedSourceInconsistency=(s)=>{auditCalls++;return originalSource(s);};'
          : 'const originalFirst=sourceFloorFirstPositiveProducer;sourceFloorFirstPositiveProducer=(s)=>{auditCalls++;return originalFirst(s);};')
        + 'exports.audit={source:hasUnsupportedSourceInconsistency,hard:localHardRejectionDecision,'
        + 'first:typeof sourceFloorFirstPositiveProducer==="function"?sourceFloorFirstPositiveProducer:null,'
        + 'eligibility:sourceRetainingSafeNoOpEligibilityReason,finish:withLocalDecisionDiagnostics,callCount:()=>auditCalls};';
    }
    const localRequire = (id: string): unknown => {
      if (!id.startsWith('.') && !id.startsWith('@/')) return nativeRequire(id);
      const target = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(file), id);
      const local = [target, target + '.ts', resolve(target, 'index.ts')].find(existsSync);
      if (!local) throw new Error('Missing offline module: ' + id);
      return local.endsWith('.json') ? JSON.parse(readFileSync(local, 'utf8')) : load(local);
    };
    new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  const loadModule = <T,>(name: string): T => load(resolve(root, 'src/lib/ai-core-v3', name + '.ts')) as T;
  return { domain: loadModule('summary-style-m5'), server: loadModule('summary-style-m5-server'),
    provider: loadModule('summary-style-m5-provider'), projector: loadModule('summary-v3-production-observability'),
    sidecar: loadModule('summary-style-m5-local-observability') };
}
const before = graph(true), after = graph(false);
function request(source = 'She checks goods.', manifest = source): Domain.SummaryV3StyleRequest {
  return { enabled: true, operation: 'summary_stronger', operationId: 'synthetic-first-068', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: source, protectedEntities: [],
    createdAt: 1_700_000_000_000,
    manifest: { manifestId: 'fictional-068', contextId: 'fictional-only', sourceLocale: 'en', currentRoleEntryId: 'entry',
      entries: [{ stableId: 'entry', role: 'Clerk', employer: 'FictionalLab', employmentState: 'present',
        durationMonths: 24, facts: [{ id: 'duty', text: manifest }] }] } };
}
function fact(req: Domain.SummaryV3StyleRequest, text: string, semanticKind: Domain.SummaryV3StyleVisibleFactKind) {
  return { ...req, visibleSummaryFacts: [{ id: 'source-fact', text, semanticKind }] };
}
const duration = request('Current Clerk at FictionalLab for 36 months.', 'She checks goods.');
const durationReq: Domain.SummaryV3StyleRequest = { ...duration, manifest: { ...duration.manifest!,
  entries: [...duration.manifest!.entries, { stableId: 'prior', role: 'Analyst', employer: 'OtherLab',
    employmentState: 'completed', durationMonths: 36, facts: [{ id: 'prior-duty', text: 'checks reports' }] }] } };
const producers: readonly [Sidecar.SummaryStyleSourceFloorFirstProducer, Domain.SummaryV3StyleRequest][] = [
  ['explicit_source_identity_inconsistency', fact(request('She is a Manager at FictionalLab.', 'She checks goods.'), 'Manager', 'role')],
  ['unannotated_source_role_employer_frame_inconsistency', request('She is a Clerk at OtherLab.', 'She checks goods.')],
  ['unsupported_source_nonnumeric_material_result_relation', request('She generates revenue.', 'She checks goods.')],
  ['source_numeric_membership_mismatch', request('She improves accuracy by 12.5%.', 'She improves accuracy by 12.6%.')],
  ['role_local_source_duration_contradiction', durationReq],
  ['source_semantic_claim_membership_mismatch', request('She checks 20% of goods.', 'She checks 20 goods.')],
  ['unmanifested_material_numeric_relation_term', request('She generates revenue over 24 months.', 'She checks goods over 24 months.')],
  ['explicit_source_tool_without_manifest_authority', fact(request('She uses Rust.', 'She checks goods.'), 'Rust', 'tool')],
  ['unmanifested_named_source_tool_surface', request('She uses Rust.', 'She checks goods.')],
  ['source_authority_term_membership_mismatch', request('She leads a team.', 'She checks goods.')],
];
function strip(value: unknown): Record<string, unknown> {
  const result = { ...value as Record<string, unknown> };
  delete result.sourceFloorFirstProducer;
  delete result.sourceNumericMismatchClass;
  delete result.sourceNumericMismatchComparisonClass;
  return result;
}
function projected(g: Graph, result: Domain.SummaryV3StyleResult) {
  return g.projector.createSummaryStrongerTerminalDiagnostic({ result, requestId: 'fra1::synthetic-068',
    requestedLocale: 'en', mode: 'enhance_existing_content',
    httpStatus: result.kind === 'candidate_ready' || result.kind === 'safe_no_op' ? 200 : 422 });
}
function envelope(input: Server.SummaryV3StyleWriterInput, text: string) {
  return { toolName: input.forcedTool.toolName, input: { operationId: input.operationId,
    snapshotHash: input.snapshotHash, manifestHash: input.manifestHash, style: input.style, locale: input.locale,
    units: [{ unitId: 'unit', text, factIds: input.requiredFacts.map(f => f.id) }] } };
}
function evaluation(input: Server.SummaryV3StyleEvaluatorInput, failing = false, rewritten = false) {
  return { toolName: input.forcedTool.toolName, input: { operationId: input.operationId,
    snapshotHash: input.snapshotHash, manifestHash: input.manifestHash, style: input.style, locale: input.locale,
    candidateHash: input.candidate.hash, candidateUnitHashes: input.candidate.units.map(after.domain.summaryV3StyleCandidateUnitHash),
    phases: Object.fromEntries(after.domain.SUMMARY_V3_STYLE_M5_PHASES.map(phase => [phase, {
      status: failing && phase === 'style_fulfillment' ? 'failed' : 'passed',
      violations: failing && phase === 'style_fulfillment' ? [{ code: 'style_not_fulfilled', repairable: true,
        factIdHashes: [input.requiredFacts[0]!.hash],
        unitHashes: [after.domain.summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)] }] : [],
    }])), representedFactIdHashes: input.requiredFacts.map(f => f.hash), missingFactIdHashes: [],
    roleIdentityResolution: 'not_required', styleEvidence: { style: 'stronger', strongerPredicateTransformations: rewritten ? 1 : 0,
      structuralStrengtheningCount: rewritten ? 1 : 0, modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0,
      stackedModifierDetected: false, unsupportedAuthorityDetected: false, strongerFulfilled: !failing, noOpDetected: !failing && !rewritten } } };
}
async function run(g: Graph, req: Domain.SummaryV3StyleRequest, text = req.visibleSummary, scenario = 'normal') {
  const invocations: Provider.SummaryV3StyleProviderInvocation[] = [];
  const callCount = g.server.audit.callCount();
  const result = await g.provider.executeSummaryV3StyleRoute(req, {
    now: () => 1_700_000_000_000, timeoutForPhase: () => 20_000,
    async invoke(invocation) {
      invocations.push(invocation);
      if (scenario === invocation.role + '_error') throw new Error('fictional transport failure');
      if (scenario === 'malformed_writer' && invocation.role === 'writer') return { stop_reason: 'tool_use', content: [] };
      const response = 'candidate' in invocation.input
        ? evaluation(invocation.input, scenario === 'repair' && invocation.phase === 'initial_evaluator',
          scenario === 'repair' && invocation.phase === 'repair_evaluator')
        : envelope(invocation.input, scenario === 'repair' && invocation.phase === 'repair_writer'
          ? text.replace('builds', 'engineers') : text);
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: response.toolName, input: response.input }] };
    },
  });
  return { result, invocations, diagnostic: projected(g, result), sourceDecisionCalls: g.server.audit.callCount() - callCount };
}
async function parity(req: Domain.SummaryV3StyleRequest, text?: string, scenario?: string) {
  const a = await run(before, req, text, scenario), b = await run(after, req, text, scenario);
  expect(JSON.stringify(b.result)).toBe(JSON.stringify(a.result));
  expect(JSON.stringify(b.invocations)).toBe(JSON.stringify(a.invocations));
  expect(b.sourceDecisionCalls).toBe(a.sourceDecisionCalls);
  expect(strip(b.diagnostic)).toEqual(a.diagnostic);
  const aSnapshot = before.domain.createSummaryV3StyleOperationSnapshot(req);
  const bSnapshot = after.domain.createSummaryV3StyleOperationSnapshot(req);
  expect(bSnapshot).toEqual(aSnapshot);
  expect(bSnapshot.snapshotHash).toBe(aSnapshot.snapshotHash);
  expect(bSnapshot.manifestHash).toBe(aSnapshot.manifestHash);
  expect(after.server.audit.source(bSnapshot)).toBe(before.server.audit.source(aSnapshot));
  expect(after.server.audit.eligibility(bSnapshot)).toBe(before.server.audit.eligibility(aSnapshot));
  return b;
}

function restoreTask071Comparison(text: string): string {
  const source = ts.createSourceFile('task-071-oracle.ts', text, ts.ScriptTarget.Latest, true);
  const owner = source.statements.filter(ts.isFunctionDeclaration)
    .find(node => node.name?.text === 'sourceFloorFirstPositiveProducer');
  if (!owner?.body) throw new Error('Missing authoritative source-floor owner');
  const find = (name: string) => {
    const matches = owner.body!.statements.filter(ts.isVariableStatement).filter(node =>
      node.declarationList.declarations.some(declaration =>
        ts.isIdentifier(declaration.name) && declaration.name.text === name));
    expect(matches).toHaveLength(1);
    return matches[0]!;
  };
  const comparison = find('numericComparisonSource');
  const approved = ts.createSourceFile('approved.ts', "const numericComparisonSource = /[.,٫]\\p{N}{3,}|[\\p{Pd}−±+]\\s*\\p{N}/u.test(percentComparisonSource)\n    ? percentComparisonSource : percentComparisonSource.replace(/\\s+/gu, ' ').trim();", ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ removeComments: true });
  expect(printer.printNode(ts.EmitHint.Unspecified, comparison, source))
    .toBe(printer.printNode(ts.EmitHint.Unspecified, approved.statements[0]!, approved));
  const initializer = find('sourceNumbers').declarationList.declarations[0]!.initializer!;
  const call = 'numericTokensOutsideValidatedStructuredDurationSurfaces(snapshot, numericComparisonSource, true)';
  expect(initializer.getText(source)).toBe(call);
  expect(text.split(call)).toHaveLength(2);
  // Remove only the approved declaration/trivia; AST offsets are indentation-independent.
  return (text.slice(0, comparison.getFullStart()) + text.slice(comparison.getEnd()))
    .replace(call, 'numericTokensOutsideValidatedStructuredDurationSurfaces(snapshot, percentComparisonSource, true)');
}

describe('Task 068 first positive source-floor producer', () => {
  it.each(producers)('A: real isolated %s is the first positive branch', (producer, req) => {
    const snapshot = after.domain.createSummaryV3StyleOperationSnapshot(req);
    const baseline = before.domain.createSummaryV3StyleOperationSnapshot(req);
    const immutable = JSON.stringify(snapshot);
    expect(after.server.audit.first(snapshot)).toBe(producer);
    expect(after.server.audit.source(snapshot)).toBe(true);
    expect(before.server.audit.source(baseline)).toBe(true);
    const count = after.server.audit.callCount();
    const decision = after.server.audit.hard(snapshot, req.visibleSummary);
    expect(after.server.audit.callCount() - count).toBe(1);
    expect(decision).toEqual({ reason: 'unsupported_claim', predicate: 'unsupported_source_inconsistency', sourceFloorFirstProducer: producer });
    expect(strip(decision)).toEqual(before.server.audit.hard(baseline, req.visibleSummary));
    const result = after.domain.createSummaryV3StyleHandledFailure(snapshot, 'unsupported_claim',
      { ...after.domain.createSummaryV3StyleInitialEvidence(snapshot), postEvaluatorLocalFailureClass: 'unsupported_claim' });
    const completed = after.server.audit.finish(result, snapshot, { phases: Object.fromEntries(
      after.domain.SUMMARY_V3_STYLE_M5_PHASES.map(phase => [phase, { status: 'passed', violations: [] }])),
      roleIdentityResolution: 'not_required' }, decision, null, 'source_inconsistency');
    expect(projected(after, completed).sourceFloorFirstProducer).toBe(producer);
    expect(after.server.audit.callCount() - count).toBe(1); // projection never revalidates
    expect(JSON.stringify(snapshot)).toBe(immutable);
  });

  it.each([
    ['explicit_source_identity_inconsistency', fact(request('She is a Manager at FictionalLab. She uses Rust. She leads 99 teams.', 'She checks goods.'), 'Manager', 'role')],
    ['unannotated_source_role_employer_frame_inconsistency', request('She is a Clerk at OtherLab. She uses Rust.', 'She checks goods.')],
    ['source_numeric_membership_mismatch', request('She uses Rust and checks 99 goods.', 'She checks goods.')],
  ] as const)('B: multiple true producers preserve first %s', (producer, req) => {
    const s = after.domain.createSummaryV3StyleOperationSnapshot(req);
    expect(after.server.audit.first(s)).toBe(producer);
    expect(strip(after.server.audit.hard(s, req.visibleSummary)))
      .toEqual(before.server.audit.hard(before.domain.createSummaryV3StyleOperationSnapshot(req), req.visibleSummary));
  });

  it.each(['consistent', 'context'] as const)('C: %s has no positive producer', kind => {
    const req = { ...request(), ...(kind === 'context' ? { visibleSummary: '' } : {}) };
    const s = after.domain.createSummaryV3StyleOperationSnapshot(req);
    expect(after.server.audit.first(s)).toBeNull();
    expect(after.server.audit.source(s)).toBe(false);
    expect(projected(after, after.domain.createSummaryV3StyleHandledFailure(s, 'invalid_language_or_native_surface',
      after.domain.createSummaryV3StyleInitialEvidence(s))).sourceFloorFirstProducer).toBeNull();
  });

  const comma = 'Ona pobolj\u0161ava ta\u010dnost za 12,5%.';
  const percentRequest = (different: boolean): Domain.SummaryV3StyleRequest => {
    const text = comma + ' Ona proverava robu. Ona priprema porud\u017ebine. Ona sre\u0111uje pakete.';
    const req = request(text, text.replace('12,5', different ? '12.6' : '12.5'));
    return { ...req, sourceLocale: 'sr', requestedLocale: 'sr', manifest: { ...req.manifest!, sourceLocale: 'sr' } };
  };
  it.each([false, true])('D/E/G: five-fact physical topology, different percentage=%s', async different => {
    const req = percentRequest(different);
    const run = await parity(req);
    expect(run.invocations.map(i => i.role)).toEqual(['writer', 'evaluator']);
    expect(run.diagnostic).toMatchObject({ writerResult: 'accepted', writerCandidateReachedValidation: true,
      sourceLockOrigin: null, coveredFactCount: 5, missingFactCount: 0,
      evaluatorAllPhasesPassed: true, evaluatorViolationCount: 0, repairAttempted: false });
    if (different) {
      expect(run.diagnostic).toMatchObject({ postEvaluatorLocalOwner: 'hard_guard',
        postEvaluatorHardPredicate: 'unsupported_source_inconsistency', sourceFloorFirstProducer: 'source_numeric_membership_mismatch',
        postEvaluatorSourceFloorMismatchClass: 'source_inconsistency', finalApplyEligible: false, usageDecision: 'no_increment' });
    } else {
      expect(run.result.kind).toBe('safe_no_op');
      expect(run.diagnostic.sourceFloorFirstProducer).toBeNull();
      expect(after.server.audit.first(after.domain.createSummaryV3StyleOperationSnapshot(req))).toBeNull();
    }
  });

  it('F: Task 065 automatic relation-subject case has no fabricated producer', async () => {
    const req = request('Atlas checks goods. Nora prepares reports.', 'checks goods');
    const s = after.domain.createSummaryV3StyleOperationSnapshot(req);
    const text = req.visibleSummary.replace('Atlas', 'atlas');
    expect(after.domain.inspectSummaryV3StyleCandidatePreservesLocks(s, text).preserved).toBe(true);
    expect(after.server.audit.first(s)).toBeNull();
    expect((await parity(req, text)).diagnostic.sourceFloorFirstProducer).toBeNull();
  });

  it.each(['normal', 'writer_error', 'evaluator_error', 'malformed_writer', 'repair'])(
    'H: unrelated %s terminal retains exact baseline contract with null producer', async scenario => {
      const req = request('She builds reliable APIs.', 'She builds reliable APIs.');
      const run = await parity(req, undefined, scenario);
      expect(run.diagnostic.sourceFloorFirstProducer).toBeNull();
      if (scenario === 'repair') expect(run.invocations.map(i => i.phase)).toEqual(['initial_writer', 'initial_evaluator', 'repair_writer', 'repair_evaluator']);
    });

  it.each(['hard_guard', 'role_identity_resolution', null] as const)('I: finite allowlist/owner gating for %s', owner => {
    const snapshot = after.domain.createSummaryV3StyleOperationSnapshot(request());
    for (const predicate of [null, 'unsupported_source_inconsistency', 'injected_manifest_fact'] as const) {
      for (const producer of [...Sidecar.SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS, 'PRIVATE arbitrary fact/tool/number text']) {
        const result = after.domain.createSummaryV3StyleHandledFailure(snapshot, 'unsupported_claim',
          after.domain.createSummaryV3StyleInitialEvidence(snapshot));
        after.sidecar.recordSummaryStyleLocalDiagnostics(result, {
          ...after.sidecar.readSummaryStyleLocalDiagnostics({}), postEvaluatorLocalOwner: owner,
          postEvaluatorHardPredicate: predicate, sourceFloorFirstProducer: producer as Sidecar.SummaryStyleSourceFloorFirstProducer,
        });
        const event = projected(after, result);
        const expected = owner === 'hard_guard' && predicate === 'unsupported_source_inconsistency'
          && Sidecar.SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS.includes(producer as Sidecar.SummaryStyleSourceFloorFirstProducer)
          ? producer : null;
        expect(event.sourceFloorFirstProducer).toBe(expected);
        expect(JSON.stringify(event)).not.toContain('PRIVATE');
        expect(JSON.stringify(result)).not.toContain('sourceFloorFirstProducer');
      }
    }
  });

  it('I: real failing topology serializes no source/manifest/candidate/fact surfaces', async () => {
    const req = percentRequest(true);
    const { diagnostic, invocations } = await parity(req);
    const serialized = JSON.stringify(diagnostic);
    for (const value of [req.visibleSummary, req.manifest!.entries[0]!.employer,
      req.manifest!.entries[0]!.role, ...req.manifest!.entries[0]!.facts.map(f => f.text), '12,5', '12.6']) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).not.toContain('sourceText');
    expect(serialized).not.toContain('factIds');
    expect(JSON.stringify(invocations)).not.toContain('sourceFloorFirstProducer');
  });

  it('historical footprint restores exact declarations; current producer and diagnostic semantics stay ordered', () => {
    assertCurrentTask084SourceFloorContract();
    const relative = 'src/lib/ai-core-v3/summary-style-m5-server.ts';
    const old = execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, encoding: 'utf8' });
const current = removeTask075ObservationFootprint(historicalPreTask084Source(relative), 'summary-style-m5-server.ts');
    const declarations = (text: string) => {
      const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
      return new Map(source.statements.filter(ts.isFunctionDeclaration).map(node => [node.name!.text,
        node.getText(source).replaceAll('\r\n', '\n')]));
    };
    const a = declarations(old), b = declarations(current);
    const restore068 = (text: string) => restoreTask071Comparison(text)
      .replace('sourceFloorFirstPositiveProducer', 'hasUnsupportedSourceInconsistency')
      .replace('SummaryStyleSourceFloorFirstProducer | null', 'boolean')
      .replace('return null;', 'return false;')
      .replace(/return '[a-z_]+';/gu, 'return true;')
      .replace(/\n    \? 'source_authority_term_membership_mismatch' : null;/u, ';');
    const decision = b.get('sourceFloorFirstPositiveProducer')!;
    const restored = restore068(decision);
    expect(restored).toBe(a.get('hasUnsupportedSourceInconsistency'));
    // Mutation controls: the bounded adapter cannot erase order or predicate defects.
    const first = "  if (hasExplicitSourceIdentityInconsistency(snapshot)) return 'explicit_source_identity_inconsistency';";
    const second = "  if (hasUnannotatedSourceRoleEmployerFrameInconsistency(snapshot)) return 'unannotated_source_role_employer_frame_inconsistency';";
    expect(decision).toContain(first + '\n' + second);
    expect(restore068(decision.replace(first + '\n' + second, second + '\n' + first))).not.toBe(a.get('hasUnsupportedSourceInconsistency'));
    expect(restore068(decision.replace('!manifestNumbers.has(number)', 'manifestNumbers.has(number)'))).not.toBe(a.get('hasUnsupportedSourceInconsistency'));
    const allowed = new Set(['hasUnsupportedSourceInconsistency', 'localHardRejectionDecision', 'withLocalDecisionDiagnostics']);
    for (const [name, body] of a) if (!allowed.has(name)) expect(b.get(name), name).toBe(body);
    expect([...b.keys()].filter(name => !a.has(name))).toEqual(['sourceFloorFirstPositiveProducer']);
    for (const moduleName of ['summary-style-m5.ts', 'summary-style-m5-provider.ts', 'summary-v3-production-observability.ts']) {
      const path = 'src/lib/ai-core-v3/' + moduleName;
expect(historicalPreTask084Source(path)).toBe(execFileSync('git', ['show', BASELINE + ':' + path], { cwd: root, encoding: 'utf8' }));
    }
    expect(Sidecar.SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS).toEqual(producers.map(p => p[0]));
  });

  it('sidecar extension retains every previous declaration/property after removing only authorized field/type', () => {
    const relative = 'src/lib/ai-core-v3/summary-style-m5-local-observability.ts';
    const old = execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, encoding: 'utf8' }).replaceAll('\r\n', '\n');
    const current = removeTask075ObservationFootprint(readFileSync(resolve(root, relative), 'utf8').replaceAll('\r\n', '\n'), 'summary-style-m5-local-observability.ts');
    const restored = current
      .replace(/\/\/ One value per positive source-consistency branch, in execution order\.\nexport const SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS = \[[\s\S]*?\] as const;\nexport type SummaryStyleSourceFloorFirstProducer = [^\n]+\n/u, '')
      .replace('  readonly sourceFloorFirstProducer: SummaryStyleSourceFloorFirstProducer | null;\n', '')
      .replace("  value: Omit<SummaryStyleLocalDiagnostics, 'sourceFloorFirstProducer'> & {\n    readonly sourceFloorFirstProducer?: SummaryStyleSourceFloorFirstProducer | null;\n  },", '  value: SummaryStyleLocalDiagnostics,')
      .replace(/    sourceFloorFirstProducer: owner === 'hard_guard'\n      && value.postEvaluatorHardPredicate === 'unsupported_source_inconsistency'\n      \? finite\(value.sourceFloorFirstProducer, SUMMARY_STYLE_SOURCE_FLOOR_FIRST_PRODUCERS\) : null,\n/u, '')
      .replace('    sourceFloorFirstProducer: null,\n', '');
    expect(restored).toBe(old);
  });
});
