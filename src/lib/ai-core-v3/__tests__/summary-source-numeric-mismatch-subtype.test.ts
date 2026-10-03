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

const BASELINE = 'cfb1eaee24261f9b0117893309f5858fbc79ab1d';
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
    first: (snapshot: Snapshot, observe?: (evidence: Sidecar.SummaryStyleSourceNumericMismatchEvidence) => void) => Sidecar.SummaryStyleSourceFloorFirstProducer | null;
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
    if (relative.endsWith('/summary-style-m5-server.ts')) code += "\nlet auditCalls=0; const auditOwners=[]; const auditTrace=[];\nconst track=(name,fn)=>(...args)=>{auditOwners.push(name);try{return fn(...args);}finally{auditOwners.pop();}};\nlocalHardRejectionDecision=track('localHardRejectionDecision',localHardRejectionDecision);\nunsupportedClaimCategory=track('unsupportedClaimCategory',unsupportedClaimCategory);\nsourceFloorMismatchClass=track('sourceFloorMismatchClass',sourceFloorMismatchClass);\nsourceRetainingSafeNoOpEligibilityReason=track('sourceRetainingSafeNoOpEligibilityReason',sourceRetainingSafeNoOpEligibilityReason);\nconst originalFirst=sourceFloorFirstPositiveProducer;\nsourceFloorFirstPositiveProducer=(...args)=>{auditCalls++;const producer=originalFirst(...args);auditTrace.push({owner:auditOwners.at(-1)||'direct',producer});return producer;};\nexports.audit={source:hasUnsupportedSourceInconsistency,hard:localHardRejectionDecision,numeric:numericTokens,tokens:numericTokensOutsideValidatedStructuredDurationSurfaces,percent:sourceManifestDecimalPercentComparison,first:sourceFloorFirstPositiveProducer,eligibility:sourceRetainingSafeNoOpEligibilityReason,finish:withLocalDecisionDiagnostics,callCount:()=>auditCalls,trace:()=>auditTrace};\n";
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
  return { enabled: true, operation: 'summary_stronger', operationId: 'synthetic-numeric-075', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: source, protectedEntities: [],
    createdAt: 1_700_000_000_000,
    manifest: { manifestId: 'fictional-075', contextId: 'fictional-only', sourceLocale: 'en', currentRoleEntryId: 'entry',
      entries: [{ stableId: 'entry', role: 'Clerk', employer: 'FictionalLab', employmentState: 'present',
        durationMonths: 24, facts: [{ id: 'duty', text: manifest }] }] } };
}
function projected(g: Graph, result: Domain.SummaryV3StyleResult) {
  return g.projector.createSummaryStrongerTerminalDiagnostic({ result, requestId: 'fra1::synthetic-075',
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

const newFields = ['sourceNumericMismatchClass', 'sourceNumericMismatchComparisonClass'] as const;
function withoutNewFields(value: object) {
  const result = { ...value } as Record<string, unknown>;
  for (const key of newFields) delete result[key];
  return result;
}
function direct(req: Domain.SummaryV3StyleRequest): {
  snapshot: Snapshot;
  producer: Sidecar.SummaryStyleSourceFloorFirstProducer | null;
  diagnostic: Sidecar.SummaryStyleSourceNumericMismatchEvidence | null;
} {
  const snapshot = after.domain.createSummaryV3StyleOperationSnapshot(req);
  let diagnostic: Sidecar.SummaryStyleSourceNumericMismatchEvidence | null = null;
  const producer = after.server.audit.first(snapshot, value => { diagnostic = value; });
  const original = before.domain.createSummaryV3StyleOperationSnapshot(req);
  expect(producer).toBe(before.server.audit.first(original));
  expect(after.server.audit.source(snapshot)).toBe(before.server.audit.source(original));
  expect(snapshot).toEqual(original);
  expect(snapshot.snapshotHash).toBe(original.snapshotHash);
  expect(snapshot.manifestHash).toBe(original.manifestHash);
  return { snapshot, producer, diagnostic };
}
async function parity(req: Domain.SummaryV3StyleRequest, scenario = 'normal', text = req.visibleSummary) {
  const a = await run(before, req, text, scenario), b = await run(after, req, text, scenario);
  expect(b.result).toEqual(a.result);
  expect(JSON.stringify(b.result)).toBe(JSON.stringify(a.result));
  expect(b.invocations).toEqual(a.invocations);
  expect(JSON.stringify(b.invocations)).toBe(JSON.stringify(a.invocations));
  expect(b.evaluatorOutcomes).toEqual(a.evaluatorOutcomes);
  expect(b.sourceDecisionCalls).toBe(a.sourceDecisionCalls);
  expect(b.sourceDecisionTrace).toEqual(a.sourceDecisionTrace);
  expect(withoutNewFields(b.diagnostic)).toEqual(a.diagnostic);
  const snapshots = [before, after].map(g => g.domain.createSummaryV3StyleOperationSnapshot(req));
  expect(snapshots[1]).toEqual(snapshots[0]);
  expect(after.server.audit.eligibility(snapshots[1]!)).toBe(before.server.audit.eligibility(snapshots[0]!));
  return b;
}
const mismatch = 'source_numeric_membership_mismatch';
const exact = 'exact_manifest_token_absent';
const cases: readonly [string, string, Sidecar.SummaryStyleSourceNumericMismatchClass, Sidecar.SummaryStyleSourceNumericMismatchComparisonClass][] = [
  ['A integer surface (no invented count semantics)', 'She checks 99 goods.', 'plain_integer_surface', exact],
  ['B decimal surface', 'She checks 3.5 goods.', 'decimal_number', exact],
  ['C unsupported percentage', 'She checks 12.5% of goods.', 'percentage', exact],
  ['C percent whitespace', 'She checks 12.5 % of goods.', 'percentage', exact],
  ['H dotted calendar remains fail closed', 'She  checks goods on 01.05.2020.', 'year_component', exact],
  ['I currency before', 'She checks $99.', 'currency_amount', exact],
  ['I currency whitespace', 'She checks $ 99.', 'currency_amount', exact],
  ['I currency after', 'She checks 99 €.', 'currency_amount', exact],
  ['J quantity has no dedicated typed parser', 'She checks 99 kg.', 'plain_integer_surface', exact],
  ['K technical/version span', 'She checks v2.4.', 'technical_identifier', exact],
  ['L embedded identifier unsupported as typed identity', 'She checks Part99.', 'unclassified', exact],
  ['M ordinal has no dedicated parser', 'She checks 99th.', 'unclassified', exact],
  ['M signed/range ambiguity', 'She checks 99-100 goods.', 'unclassified', 'ambiguous_numeric_surface'],
  ['locale residual numeral (unsupported normalization script)', 'She checks ৯৯ goods.', 'locale_numeric_surface', exact],
  ['ambiguous grouping-like fraction', 'She checks 1,500 goods.', 'unclassified', 'ambiguous_numeric_surface'],
];
const withMonths = (source: string, months: number, manifest = 'She checks goods.') => {
  const req = request(source, manifest);
  return { ...req, manifest: { ...req.manifest!, entries: req.manifest!.entries.map(e => ({ ...e, durationMonths: months })) } };
};
describe('Task075 first source numeric mismatch subtype (offline only)', () => {
  it.each(cases)('%s: real authoritative branch and finite first-token evidence', (_label, source, family, comparison) => {
    const observed = direct(request(source, 'She checks goods.'));
    expect(observed.producer).toBe(mismatch);
    expect(observed.diagnostic).toEqual({ sourceNumericMismatchClass: family, sourceNumericMismatchComparisonClass: comparison });
  });
  it.each([
    ['D Task062 decimal percent', request('She checks 12,5% of goods.', 'She checks 12.5% of goods.')],
    ['E canonical typed duration', withMonths('She checks goods for 2 years.', 24)],
    ['F Task073 whitespace duration', withMonths('She checks goods for 2   years.', 24)],
    ['F Task073 decimal duration', withMonths('She checks goods for 1,5  years.', 18)],
    ['G Task073 calendar year offset', withMonths('She   checks goods since 2020.', 8)],
    ['G Task073 calendar named offset', withMonths('She   checks goods since May 5, 2020.', 8)],
    ['O no mismatch', request()],
  ] as const)('%s: no numeric diagnostic and existing producer unchanged', (_label, req) => {
    const observed = direct(req);
    expect(observed.producer).not.toBe(mismatch);
    expect(observed.diagnostic).toBeNull();
  });
  it('typed duration evidence uses existing month authority without waiving the mismatch', () => {
    // The unrelated ambiguous numeric surface retains Task073's exact-coordinate
    // path; whitespace can still leave a structured equivalent duration token.
    const req = withMonths('She  checks goods for 2   years and checks 1,500 goods.', 24);
    const observed = direct(req);
    expect(observed.producer).toBe(mismatch);
    expect(observed.diagnostic).toEqual({ sourceNumericMismatchClass: 'duration_component',
      sourceNumericMismatchComparisonClass: 'typed_duration_equivalent_not_excluded' });
  });
  it('N authoritative first token: later class cannot replace it; removal moves naturally', () => {
    const first = request('She checks 99 goods and 12.5% of goods.', 'She checks goods.');
    const secondChanged = request('She checks 99 goods and $55.', 'She checks goods.');
    expect(direct(first).diagnostic).toEqual(direct(secondChanged).diagnostic);
    expect(direct(first).diagnostic?.sourceNumericMismatchClass).toBe('plain_integer_surface');
    expect(direct(request('She checks 12.5% of goods.', 'She checks goods.')).diagnostic?.sourceNumericMismatchClass).toBe('percentage');
    const source = after.server.audit.percent(direct(first).snapshot);
    const tokens = after.server.audit.tokens(direct(first).snapshot, source, true);
    expect(tokens).toEqual(['99', '12.5']);
    const manifest = new Set(after.server.audit.numeric('She checks goods.'));
    expect(tokens.find(token => !manifest.has(token))).toBe('99');
    expect(before.server.audit.tokens(before.domain.createSummaryV3StyleOperationSnapshot(first), source, true)).toEqual(tokens);
  });
  it('N repeated token value in different contexts uses its first location, not a later percent', () => {
    expect(direct(request('She checks 99 goods and 99% of goods.', 'She checks goods.')).diagnostic?.sourceNumericMismatchClass)
      .toBe('plain_integer_surface');
    expect(direct(request('She checks 99% of goods and 99 goods.', 'She checks goods.')).diagnostic?.sourceNumericMismatchClass)
      .toBe('percentage');
  });
  it('N an earlier manifest-present token is skipped exactly once', () => {
    const req = request('She checks 7 goods and 12.5% of goods.', 'She checks 7 goods.');
    const observed = direct(req);
    expect(observed.diagnostic?.sourceNumericMismatchClass).toBe('percentage');
    const source = after.server.audit.percent(observed.snapshot);
    expect(after.server.audit.tokens(observed.snapshot, source, true)).toEqual(['7', '12.5']);
    expect(new Set(after.server.audit.numeric(req.manifest!.entries[0]!.facts[0]!.text)).has('7')).toBe(true);
  });
  it.each(cases.filter(c => !c[0].startsWith('locale')))('T/S real route functional/provider/evaluator/hash parity: %s', async (_label, source) => {
    const req = request(source, 'She checks goods.');
    const observed = await parity(req);
    if (observed.diagnostic.sourceFloorFirstProducer === mismatch) {
      expect(observed.diagnostic.sourceNumericMismatchClass).not.toBeNull();
      expect(observed.diagnostic.sourceNumericMismatchComparisonClass).not.toBeNull();
    }
    const serialized = JSON.stringify(observed.diagnostic);
    for (const token of after.server.audit.numeric(source)) expect(serialized).not.toContain(token);
    for (const privateValue of [source, req.manifest!.entries[0]!.employer, req.manifest!.entries[0]!.role,
      req.manifest!.entries[0]!.facts[0]!.text, 'sourceNumberLocations', 'factIds', 'sourceText', 'manifestText']) {
      expect(serialized).not.toContain(privateValue);
    }
    expect(JSON.stringify(observed.result)).not.toContain('sourceNumericMismatch');
    expect(JSON.stringify(observed.invocations)).not.toContain('sourceNumericMismatch');
  });
  it.each([
    ['O success/no-op', request()],
    ['P earlier role/employer owner', request('She is a Clerk at OtherLab and checks 99 goods.', 'She checks goods.')],
    ['P unrelated numeric-looking semantic owner', request('She generates revenue. She checks 99 goods.', 'She checks goods.')],
  ] as const)('%s: unrelated owner/no mismatch emits nulls and preserves full result', async (_label, req) => {
    const result = await parity(req);
    expect(result.diagnostic.sourceNumericMismatchClass).toBeNull();
    expect(result.diagnostic.sourceNumericMismatchComparisonClass).toBeNull();
  });
  it.each(['writer_error', 'malformed_writer', 'evaluator_error', 'repair'])('Q/R %s: both fields null, full route parity', async scenario => {
    const result = await parity(request('She builds reliable APIs.'), scenario);
    expect(result.diagnostic.sourceNumericMismatchClass).toBeNull();
    expect(result.diagnostic.sourceNumericMismatchComparisonClass).toBeNull();
  });
  it('Q source-lock/required-fact writer failure cannot acquire numeric evidence', async () => {
    const result = await parity(request('She checks 99 goods.', 'She checks goods.'), 'normal', 'She checks items.');
    expect(result.diagnostic.sourceNumericMismatchClass).toBeNull();
    expect(result.diagnostic.sourceNumericMismatchComparisonClass).toBeNull();
    expect(result.diagnostic.sourceFloorFirstProducer).toBeNull();
  });
  it('R evaluator-only safety failure has no source numeric owner', async () => {
    const result = await parity(request('She builds reliable APIs.'), 'repair');
    expect(result.diagnostic.evaluatorAttempted).toBe(true);
    expect(result.diagnostic.sourceFloorFirstProducer).toBeNull();
    expect(result.diagnostic.sourceNumericMismatchClass).toBeNull();
    expect(result.diagnostic.sourceNumericMismatchComparisonClass).toBeNull();
  });
  it('finite pair and owner gating rejects arbitrary strings and mismatched ownership', () => {
    const s = after.domain.createSummaryV3StyleOperationSnapshot(request());
    for (const owner of ['hard_guard', 'role_identity_resolution', null] as const) {
      for (const producer of [mismatch, 'explicit_source_identity_inconsistency', null] as const) {
        const result = after.domain.createSummaryV3StyleHandledFailure(s, 'unsupported_claim',
          after.domain.createSummaryV3StyleInitialEvidence(s));
        after.sidecar.recordSummaryStyleLocalDiagnostics(result, {
          ...after.sidecar.readSummaryStyleLocalDiagnostics({}),
          postEvaluatorLocalOwner: owner, postEvaluatorHardPredicate: 'unsupported_source_inconsistency',
          sourceFloorFirstProducer: producer, sourceNumericMismatchClass: 'percentage',
          sourceNumericMismatchComparisonClass: exact,
        });
        const event = projected(after, result), allowed = owner === 'hard_guard' && producer === mismatch;
        expect(event.sourceNumericMismatchClass).toBe(allowed ? 'percentage' : null);
        expect(event.sourceNumericMismatchComparisonClass).toBe(allowed ? exact : null);
      }
    }
    const result = after.domain.createSummaryV3StyleHandledFailure(s, 'unsupported_claim',
      after.domain.createSummaryV3StyleInitialEvidence(s));
    after.sidecar.recordSummaryStyleLocalDiagnostics(result, {
      ...after.sidecar.readSummaryStyleLocalDiagnostics({}), postEvaluatorLocalOwner: 'hard_guard',
      postEvaluatorHardPredicate: 'unsupported_source_inconsistency', sourceFloorFirstProducer: mismatch,
      sourceNumericMismatchClass: 'PRIVATE_998877' as Sidecar.SummaryStyleSourceNumericMismatchClass,
      sourceNumericMismatchComparisonClass: exact,
    });
    const event = projected(after, result);
    expect(event.sourceNumericMismatchClass).toBeNull();
    expect(event.sourceNumericMismatchComparisonClass).toBeNull();
    expect(JSON.stringify(event)).not.toContain('PRIVATE');
    expect('sourceNumericMismatchOrdinal' in event).toBe(false);
  });
  it('historical restoration removes exactly observation footprint; current guards and telemetry remain strict', () => {
    assertCurrentTask084SourceFloorContract();
    for (const moduleName of changedModules) {
      const path = 'src/lib/ai-core-v3/' + moduleName;
      const current = historicalPreTask084Source(path);
      const expected = execFileSync('git', ['show', BASELINE + ':' + path], { cwd: root, encoding: 'utf8' });
      expect(removeTask075ObservationFootprint(current, moduleName)).toBe(expected);
      expect(() => removeTask075ObservationFootprint(current.replace(moduleName.includes('server') ? '!manifestNumbers.has(number)' : "'exact_manifest_token_absent'", moduleName.includes('server') ? 'manifestNumbers.has(number)' : "'unclassified'"), moduleName))
        .toThrow(); // For sidecar, no predicate occurs: separately control a finite field below.
    }
  });
  it('historical and current gates cannot erase membership, ordering or diagnostic predicate mutations', () => {
    const path = 'src/lib/ai-core-v3/summary-style-m5-server.ts';
    const current = historicalPreTask084Source(path);
    const live = readFileSync(resolve(root, path), 'utf8');
    assertCurrentTask084SourceFloorContract(live);
    for (const mutated of [
      live.replace('!manifestNumbers.has(number)', 'manifestNumbers.has(number)'),
      live.replace('if (unmatched) firstUnmatchedIndex = index;', 'if (unmatched) firstUnmatchedIndex = 0;'),
      live.replace('sourceNumberLocations[firstUnmatchedIndex]!', 'sourceNumberLocations[0]!'),
    ]) {
      expect(mutated).not.toBe(live);
      expect(() => assertCurrentTask084SourceFloorContract(mutated)).toThrow();
    }
    for (const mutated of [
      current.replace('!manifestNumbers.has(number)', 'manifestNumbers.has(number)'),
      current.replace('if (unmatched) firstUnmatchedIndex = index;', 'if (unmatched) firstUnmatchedIndex = 0;'),
      current.replace("'exact_manifest_token_absent'", "'unclassified'"),
    ]) expect(() => removeTask075ObservationFootprint(mutated, 'summary-style-m5-server.ts')).toThrow();
    for (const path of ['src/lib/ai-core-v3/summary-style-m5.ts', 'src/lib/ai-core-v3/summary-style-m5-client.ts',
      'src/lib/ai-core-v3/summary-style-m5-provider.ts', 'src/lib/ai-core-v3/summary-v3-production-observability.ts',
      'src/app/api/generate/route.ts', 'src/app/cv-builder/page.tsx', 'android/app/build.gradle']) {
expect(Buffer.from(historicalPreTask084Source(path))).toEqual(execFileSync('git', ['show', BASELINE + ':' + path], { cwd: root }));
    }
  });
});
