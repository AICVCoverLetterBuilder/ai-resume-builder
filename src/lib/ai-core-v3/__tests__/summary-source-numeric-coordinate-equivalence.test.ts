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
import { createSummaryV3StyleOperationSnapshot } from '../summary-style-m5';
import { findExactDurationMeasurements } from '../exact-duration-measurement';
import { bindTrustedEmploymentTenureRuntime, summaryDurationCandidateComparison,
  trustedEmploymentTenureAuthority } from '../summary-trusted-tenure-runtime';

const BASELINE = '8cd06554718c8a0fba232035e5c8cdf328774fed';
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
type Snapshot = Domain.SummaryV3StyleOperationSnapshot;
type Hard = { reason: string | null; predicate: string | null; sourceFloorFirstProducer?: Sidecar.SummaryStyleSourceFloorFirstProducer };
type Graph = {
  domain: typeof Domain;
  server: typeof Server & { audit: {
    source: (snapshot: Snapshot) => boolean;
    numeric: (text: string) => readonly string[];
    tokens: (snapshot: Snapshot, text: string, dates: boolean) => readonly string[];
    percent: (snapshot: Snapshot) => string;
    first: (snapshot: Snapshot) => Sidecar.SummaryStyleSourceFloorFirstProducer | null;
    hard: (snapshot: Snapshot, text: string) => Hard;
    eligibility: (snapshot: Snapshot) => string;
    finish: (result: Domain.SummaryV3StyleResult, snapshot: Snapshot, evaluation: unknown, hard: Hard, role: null, eligibility: 'source_inconsistency') => Domain.SummaryV3StyleResult;
    callCount: () => number;
    trace: () => readonly { owner: string; producer: Sidecar.SummaryStyleSourceFloorFirstProducer | null }[];
  } };
  provider: typeof Provider;
  projector: typeof Projector;
  sidecar: typeof Sidecar;
};
const changedModules = ['summary-style-m5-server.ts'];
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
    if (relative.endsWith('/summary-style-m5-server.ts')) code += "\nlet auditCalls=0; const auditOwners=[]; const auditTrace=[];\nconst track=(name,fn)=>(...args)=>{auditOwners.push(name);try{return fn(...args);}finally{auditOwners.pop();}};\nlocalHardRejectionDecision=track('localHardRejectionDecision',localHardRejectionDecision);\nunsupportedClaimCategory=track('unsupportedClaimCategory',unsupportedClaimCategory);\nsourceFloorMismatchClass=track('sourceFloorMismatchClass',sourceFloorMismatchClass);\nsourceRetainingSafeNoOpEligibilityReason=track('sourceRetainingSafeNoOpEligibilityReason',sourceRetainingSafeNoOpEligibilityReason);\nconst originalFirst=sourceFloorFirstPositiveProducer;\nsourceFloorFirstPositiveProducer=(s)=>{auditCalls++;const producer=originalFirst(s);auditTrace.push({owner:auditOwners.at(-1)||'direct',producer});return producer;};\nexports.audit={source:hasUnsupportedSourceInconsistency,hard:localHardRejectionDecision,numeric:numericTokens,tokens:numericTokensOutsideValidatedStructuredDurationSurfaces,percent:sourceManifestDecimalPercentComparison,first:sourceFloorFirstPositiveProducer,eligibility:sourceRetainingSafeNoOpEligibilityReason,finish:withLocalDecisionDiagnostics,callCount:()=>auditCalls,trace:()=>auditTrace};\n";
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
  return { enabled: true, operation: 'summary_stronger', operationId: 'synthetic-first-071', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: source, protectedEntities: [],
    createdAt: 1_700_000_000_000,
    manifest: { manifestId: 'fictional-071', contextId: 'fictional-only', sourceLocale: 'en', currentRoleEntryId: 'entry',
      entries: [{ stableId: 'entry', role: 'Clerk', employer: 'FictionalLab', employmentState: 'present',
        durationMonths: 24, facts: [{ id: 'duty', text: manifest }] }] } };
}
function projected(g: Graph, result: Domain.SummaryV3StyleResult) {
  return g.projector.createSummaryStrongerTerminalDiagnostic({ result, requestId: 'fra1::synthetic-071',
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
  const traceStart = g.server.audit.trace().length;
  const evaluatorOutcomes: ReturnType<typeof evaluation>[] = [];
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
      if ('candidate' in invocation.input) evaluatorOutcomes.push(response as ReturnType<typeof evaluation>);
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: response.toolName, input: response.input }] };
    },
  });
  return { result, invocations, evaluatorOutcomes, diagnostic: projected(g, result),
    sourceDecisionCalls: g.server.audit.callCount() - callCount,
    sourceDecisionTrace: g.server.audit.trace().slice(traceStart) };
}
async function parity(req: Domain.SummaryV3StyleRequest, text?: string, scenario?: string) {
  const a = await run(before, req, text, scenario), b = await run(after, req, text, scenario);
  expect(JSON.stringify(b.result)).toBe(JSON.stringify(a.result));
  expect(JSON.stringify(b.invocations)).toBe(JSON.stringify(a.invocations));
  expect(b.sourceDecisionCalls).toBe(a.sourceDecisionCalls);
  expect(b.sourceDecisionTrace).toEqual(a.sourceDecisionTrace);
  expect(b.diagnostic).toEqual(a.diagnostic);
  const aSnapshot = before.domain.createSummaryV3StyleOperationSnapshot(req);
  const bSnapshot = after.domain.createSummaryV3StyleOperationSnapshot(req);
  expect(bSnapshot).toEqual(aSnapshot);
  expect(bSnapshot.snapshotHash).toBe(aSnapshot.snapshotHash);
  expect(bSnapshot.manifestHash).toBe(aSnapshot.manifestHash);
  expect(after.server.audit.source(bSnapshot)).toBe(before.server.audit.source(aSnapshot));
  expect(after.server.audit.eligibility(bSnapshot)).toBe(before.server.audit.eligibility(aSnapshot));
  return b;
}

const numericMismatch = 'source_numeric_membership_mismatch';
const equivalent: readonly [string, string, number][] = [
  ['duration/spaces', 'She checks goods for 2   years.', 24],
  ['duration/tab', 'She checks goods for 2\tyears.', 24],
  ['duration/newline', 'She checks goods for 2\nyears.', 24],
  ['duration/NBSP', 'She checks goods for 2\u00a0\u00a0years.', 24],
  ['duration/typed decimal', 'She checks goods for 1,5  years.', 18],
  ['calendar/year offset', 'She   checks goods since 2020.', 8],
  ['calendar/named date offset', 'She   checks goods since May 5, 2020.', 8],
];
function withMonths(source: string, months: number, manifest = 'She checks goods.') {
  const req = request(source, manifest);
  return { ...req, manifest: { ...req.manifest!, entries: req.manifest!.entries.map(entry =>
    ({ ...entry, durationMonths: months })) } };
}
const unchanged: readonly [string, string, string, number][] = [
  ['integer/20', 'She served 20 customers.', 'She served 20 customers.', 8],
  ['integer/3', 'She handled 3 categories.', 'She handled 3 categories.', 8],
  ['integer/2', 'She maintained 2 displays.', 'She maintained 2 displays.', 8],
  ['missing count', 'She served 20 customers.', 'She served 21 customers.', 8],
  ['wrong duration', 'She checks goods for 2   years.', 'She checks goods.', 36],
  ['wrong unit', 'She checks goods for 2   months.', 'She checks goods.', 24],
  ['unrelated relation', 'She checks 2   products.', 'She checks goods.', 24],
  ['equal value in another relation', 'She checks 2   products.', 'She checks goods for 2 years.', 24],
  ['unrelated number plus valid duration', 'She checks 99 goods for 2   years.', 'She checks goods.', 24],
  ['grouping-like fraction', 'She checks goods for 1,500  years.', 'She checks goods.', 18],
  ['signed duration', 'She checks goods for -2   years.', 'She checks goods.', 24],
  ['compound separators', 'She checks goods for 1,2,5   years.', 'She checks goods.', 30],
  ['arbitrary decimal', 'She measures 1,5 kg.', 'She measures 1.5 kg.', 8],
  ['currency exact', 'She tracks $12.50.', 'She tracks $12.50.', 8],
  ['currency comma/dot', 'She tracks $12,50.', 'She tracks $12.50.', 8],
  ['version exact', 'She uses Version 2.0.', 'She uses Version 2.0.', 8],
  ['version significant surface', 'She uses Version 2.00.', 'She uses Version 2.0.', 8],
  ['ISO', 'She follows ISO 9001.', 'She follows ISO 9001.', 8],
  ['model', 'She uses Model 300.', 'She uses Model 300.', 8],
  ['embedded identifier', 'She handles Widget300.', 'She handles Widget300.', 8],
  ['quantity exact', 'She moves 20 kg.', 'She moves 20 kg.', 8],
  ['quantity cross-unit', 'She moves 20 kg.', 'She moves 20 lbs.', 8],
  ['range exact', 'She checks 2-3 items.', 'She checks 2-3 items.', 8],
  ['ordinal', 'She is in 2nd place.', 'She is in 2nd place.', 8],
  ['date plus missing count', 'She   checks 99 goods since 2020.', 'She checks goods.', 8],
  ['date followed by missing count', 'She   checks goods since 2020 and 99 products.', 'She checks goods.', 8],
  ['percent equivalent/062', 'She checks 12,5% of goods.', 'She checks 12.5% of goods.', 8],
  ['percent different/062', 'She checks 12,5% of goods.', 'She checks 12.6% of goods.', 8],
  ['percent unsupported glyph', 'She checks 12,5\u066a of goods.', 'She checks 12.5% of goods.', 8],
  ['percent locale decimal', 'She checks 12\u066b5\u066a of goods.', 'She checks 12.5% of goods.', 8],
];
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

describe('Tasks 071/072 bounded source numeric coordinate equivalence', () => {
  it.each(equivalent)('proves immutable baseline false positive and bounded correction: %s', (_label, source, months) => {
    const req = withMonths(source, months), a = before.domain.createSummaryV3StyleOperationSnapshot(req);
    const b = after.domain.createSummaryV3StyleOperationSnapshot(req);
    expect(before.server.audit.first(a)).toBe(numericMismatch);
    expect(after.server.audit.first(b)).toBeNull();
    expect(before.server.audit.source(a)).toBe(true);
    expect(after.server.audit.source(b)).toBe(false);
    expect(b).toEqual(a);
    expect(b.snapshotHash).toBe(a.snapshotHash);
    expect(b.manifestHash).toBe(a.manifestHash);
    // The candidate validator retains the original raw-source collector.
    expect(after.server.audit.tokens(b, source, false)).toEqual(before.server.audit.tokens(a, source, false));
    expect(before.server.audit.hard(a, source).reason).toBe('unsupported_claim');
    expect(after.server.audit.hard(b, source).reason).toBeNull();
  });

  it('KNOWN_PROVEN_FALSE_POSITIVE_NOT_REPAIRED_BY_TASK_071_SCOPE: dotted calendar ambiguity stays fail-closed', async () => {
    const req = withMonths('She   checks goods since 01.05.2020.', 8);
    const a = before.domain.createSummaryV3StyleOperationSnapshot(req);
    const b = after.domain.createSummaryV3StyleOperationSnapshot(req);
    expect(before.server.audit.first(a)).toBe(numericMismatch);
    expect(after.server.audit.first(b)).toBe(numericMismatch);
    expect(after.server.audit.hard(b, req.visibleSummary).reason).toBe('unsupported_claim');
    await parity(req);
    expect(equivalent).toHaveLength(7); // seven repaired + this eighth explicitly unfixed case
  });

  it.each([
    ['She checks goods for 2 years.', 24, 'She checks goods.'],
    ['She checks goods for 24 months.', 24, 'She checks goods for 2 years.'],
    ['She checks goods for 1,5 years.', 18, 'She checks goods.'],
    ['She checks goods since 2020.', 8, 'She checks goods.'],
  ] as const)('canonical/reverse supported representation remains unchanged: %s', async (source, months, manifest) => {
    const req = withMonths(source, months, manifest);
    expect(after.server.audit.first(after.domain.createSummaryV3StyleOperationSnapshot(req))).toBeNull();
    await parity(req);
  });

  it.each(unchanged)('exact numeric/provider/snapshot parity: %s', async (_label, source, manifest, months) => {
    const req = withMonths(source, months, manifest), a = before.domain.createSummaryV3StyleOperationSnapshot(req);
    const b = after.domain.createSummaryV3StyleOperationSnapshot(req);
    expect(after.server.audit.first(b)).toBe(before.server.audit.first(a));
    expect(after.server.audit.hard(b, source)).toEqual(before.server.audit.hard(a, source));
    expect(after.server.audit.tokens(b, source, false)).toEqual(before.server.audit.tokens(a, source, false));
    if (_label === 'wrong duration' || _label === 'wrong unit') {
      // No comparator relaxation for any other numeric family. Only these
      // two Task082 exact, unbound source measurements have opaque admission.
      expect(findExactDurationMeasurements(source)).toHaveLength(1);
      const prior = await run(before, req), current = await run(after, req);
      expect(prior.result.kind).toBe('handled_failure');
      expect(current.result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op',
        evidence: { safeNoOpSelected: true, writerAttempts: 1, evaluatorAttempts: 1 } });
      expect(current.invocations).toEqual(prior.invocations);
      expect(JSON.stringify(current.invocations)).toBe(JSON.stringify(prior.invocations));
      expect(current.invocations.map((call) => call.role)).toEqual(['writer', 'evaluator']);
      expect(b).toEqual(a);
      expect(current.result).not.toHaveProperty('tenureOperationFingerprint');
      expect(current.result).not.toHaveProperty('remediation');
      expect(current.diagnostic).toMatchObject({ finalApplyEligible: false, usageDecision: 'no_increment' });
      const opaque = bindTrustedEmploymentTenureRuntime(createSummaryV3StyleOperationSnapshot(req), { status: 'absent', reason: null, relations: [] });
      expect(trustedEmploymentTenureAuthority(opaque)).toBeNull();
      expect(opaque.sourceSummary).toBe(source);
      expect(summaryDurationCandidateComparison(opaque, source)).not.toBeNull();
      const mutated = source.replace('2   ', '3   ');
      expect(summaryDurationCandidateComparison(opaque, mutated)).toBeNull();
      expect((await run(after, req, mutated)).result.kind).toBe('handled_failure');
      for (const call of current.invocations) expect(call.input).not.toHaveProperty('trustedTenureClaims');
    } else await parity(req);
  });

  it('does not identify the physical Serbian 8-month clue as a defective membership', async () => {
    for (const source of ['Ona proverava robu oko 8 meseci.', 'Ona proverava robu oko 8   meseci.']) {
      const base = withMonths(source, 8, 'Ona proverava robu.');
      const req = { ...base, sourceLocale: 'sr' as const, requestedLocale: 'sr' as const,
        manifest: { ...base.manifest!, sourceLocale: 'sr' as const } };
      const a = before.domain.createSummaryV3StyleOperationSnapshot(req);
      expect(before.server.audit.numeric(a.manifestFacts.map(f => f.text).join(' '))).toContain('8');
      expect(before.server.audit.first(a)).toBeNull();
      expect(after.server.audit.first(after.domain.createSummaryV3StyleOperationSnapshot(req))).toBeNull();
      await parity(req);
    }
  });

  it('does not cross-authorize a prior role duration or aggregate multiple entries', () => {
    const req = withMonths('Current Clerk at FictionalLab for 3   years.', 24);
    const roles = { ...req, manifest: { ...req.manifest!, entries: [...req.manifest!.entries,
      { stableId: 'prior', role: 'Analyst', employer: 'OtherLab', employmentState: 'completed' as const,
        durationMonths: 36, facts: [{ id: 'prior-duty', text: 'She checks reports.' }] }] } };
    const a = before.domain.createSummaryV3StyleOperationSnapshot(roles);
    const b = after.domain.createSummaryV3StyleOperationSnapshot(roles);
    expect(before.server.audit.first(a)).toBe(numericMismatch);
    expect(after.server.audit.first(b)).toBe('role_local_source_duration_contradiction');
    expect(after.server.audit.hard(b, roles.visibleSummary).reason).toBe('unsupported_claim');
    const sum = withMonths('She checks goods for 5   years.', 24);
    const aggregate = { ...sum, manifest: roles.manifest };
    expect(after.server.audit.first(after.domain.createSummaryV3StyleOperationSnapshot(aggregate))).toBe(numericMismatch);
  });

  it.each([false, true])('actual five-fact topology proves existing downstream policy, secondary evaluator failure=%s', async failing => {
    const req = withMonths('She checks goods for 2   years. She prepares orders. She stores packages. She sorts records. She checks labels.', 24,
      'She checks goods. She prepares orders. She stores packages. She sorts records. She checks labels.');
    const scenario = failing ? 'repair' : 'normal';
    const a = await run(before, req, undefined, scenario);
    const b = await run(after, req, undefined, scenario);
    // Real immutable-baseline control, not a mocked admission override: the
    // same supported duration in canonical spacing already reaches this policy.
    const canonical = { ...req, visibleSummary: req.visibleSummary.replace('2   years', '2 years') };
    const control = await run(before, canonical, undefined, scenario);
    for (const observed of [a, b, control]) {
      expect(observed.diagnostic.coveredFactCount).toBe(5);
      expect(observed.diagnostic.missingFactCount).toBe(0);
      expect(observed.diagnostic.finalApplyEligible).toBe(false);
      expect(observed.diagnostic.usageDecision).toBe('no_increment');
    }
    expect(a.diagnostic).toMatchObject({ writerResult: 'accepted', writerCandidateReachedValidation: true,
      sourceFloorFirstProducer: numericMismatch, sourceLockOrigin: null, repairAttempted: false });
    expect(b.diagnostic.sourceFloorFirstProducer).toBeNull();
    expect(JSON.stringify(b.invocations.slice(0, 2))).toBe(JSON.stringify(a.invocations));
    expect(b.evaluatorOutcomes[0]).toEqual(a.evaluatorOutcomes[0]);
    const violationKind = (outcome: ReturnType<typeof evaluation>) => Object.entries(outcome.input.phases)
      .flatMap(([phase, value]) => value.violations.map(v => ({ phase, code: v.code,
        repairable: v.repairable, factBindingCount: v.factIdHashes.length, unitBindingCount: v.unitHashes.length })));
    expect(violationKind(b.evaluatorOutcomes[0]!)).toEqual(violationKind(control.evaluatorOutcomes[0]!));
    expect(b.invocations.map(i => i.phase)).toEqual(control.invocations.map(i => i.phase));
    expect(b.diagnostic.terminalReason).toBe(control.diagnostic.terminalReason);
    expect(b.result.kind).toBe(control.result.kind);
    expect(b.sourceDecisionTrace).toEqual(control.sourceDecisionTrace);
    expect(a.sourceDecisionTrace).toEqual([
      'localHardRejectionDecision', 'unsupportedClaimCategory', 'sourceFloorMismatchClass',
      'sourceRetainingSafeNoOpEligibilityReason', 'sourceRetainingSafeNoOpEligibilityReason',
      'sourceRetainingSafeNoOpEligibilityReason',
    ].map(owner => ({ owner, producer: numericMismatch })));
    expect(a.sourceDecisionCalls).toBe(6);
    const owners = failing
      ? ['localHardRejectionDecision', 'sourceRetainingSafeNoOpEligibilityReason', 'sourceRetainingSafeNoOpEligibilityReason']
      : ['localHardRejectionDecision', 'localHardRejectionDecision', 'sourceRetainingSafeNoOpEligibilityReason',
        'sourceRetainingSafeNoOpEligibilityReason', 'sourceRetainingSafeNoOpEligibilityReason'];
    expect(b.sourceDecisionTrace).toEqual(owners.map(owner => ({ owner, producer: null })));
    expect(b.sourceDecisionCalls).toBe(failing ? 3 : 5);
    if (failing) {
      expect(b.diagnostic).toMatchObject({ terminalReason: 'repair_scope_violation',
        repairAttempted: true, repairProviderRequestAttempted: true });
      expect(b.result.kind).toBe('handled_failure');
      expect(violationKind(b.evaluatorOutcomes[0]!)).toEqual([{ phase: 'style_fulfillment',
        code: 'style_not_fulfilled', repairable: true, factBindingCount: 1, unitBindingCount: 1 }]);
      expect(b.invocations.map(i => i.phase)).toEqual(['initial_writer', 'initial_evaluator', 'repair_writer']);
    } else {
      expect(b.diagnostic).toMatchObject({ repairAttempted: false, evaluatorAllPhasesPassed: true });
      expect(b.result.kind).toBe('safe_no_op');
      expect(JSON.stringify(b.invocations)).toBe(JSON.stringify(a.invocations));
      expect(b.invocations.map(i => i.phase)).toEqual(['initial_writer', 'initial_evaluator']);
    }
  });

  it.each(['writer_error', 'evaluator_error', 'malformed_writer', 'repair'])('unrelated %s behavior stays byte-exact', async scenario => {
    await parity(request('She builds reliable APIs.'), undefined, scenario);
  });

  it('historical coordinate-only footprint stays exact; current bounded coordinate and producer semantics remain intact', () => {
    assertCurrentTask084SourceFloorContract();
    const relative = 'src/lib/ai-core-v3/summary-style-m5-server.ts';
    const original = execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, encoding: 'utf8' }).replaceAll('\r\n', '\n');
const current = removeTask075ObservationFootprint(historicalPreTask084Source(relative).replaceAll('\r\n', '\n'), 'summary-style-m5-server.ts');
    const restored = restoreTask071Comparison(current);
    expect(restored).toBe(original);
    const calls = (text: string) => {
      const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
      const result: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ['sourceFloorFirstPositiveProducer',
          'hasUnsupportedSourceInconsistency', 'dependencies.write', 'dependencies.evaluate',
          'dependencies.repairWrite', 'dependencies.repairEvaluate'].includes(node.expression.getText(source))) {
          result.push(node.expression.getText(source));
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      return result;
    };
    expect(calls(current)).toEqual(calls(original));
    expect(calls(current)).toContain('dependencies.repairWrite');
    expect(calls(current)).toContain('dependencies.repairEvaluate');
    for (const file of ['src/lib/ai-core-v3/summary-style-m5.ts',
      'src/lib/ai-core-v3/summary-style-m5-client.ts', 'src/lib/ai-core-v3/summary-style-m5-provider.ts',
      'src/lib/ai-core-v3/summary-style-m5-local-observability.ts',
      'src/lib/ai-core-v3/summary-v3-production-observability.ts',
      'src/app/api/generate/route.ts', 'src/app/cv-builder/page.tsx', 'android/app/build.gradle']) {
const actual = Buffer.from(historicalPreTask084Source(file));
      const comparable = file.endsWith('/summary-style-m5-local-observability.ts')
        ? Buffer.from(removeTask075ObservationFootprint(actual.toString('utf8'), 'summary-style-m5-local-observability.ts')) : actual;
      expect(comparable).toEqual(execFileSync('git', ['show', BASELINE + ':' + file], { cwd: root }));
    }
  });

  it('new correction never exports source surfaces or introduces provider/diagnostic fields', async () => {
    const req = withMonths(equivalent[0]![1], 24), result = await run(after, req);
    const serialized = JSON.stringify(result.diagnostic);
    for (const surface of [req.visibleSummary, req.manifest!.entries[0]!.role,
      req.manifest!.entries[0]!.employer, '2   years', 'sourceText', 'numericComparisonSource']) {
      expect(serialized).not.toContain(surface);
    }
    expect(Object.keys(result.diagnostic).sort()).toEqual(Object.keys((await run(before, req)).diagnostic).sort());
  });
});

