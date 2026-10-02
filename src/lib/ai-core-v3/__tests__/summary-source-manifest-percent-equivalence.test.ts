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

const BASELINE = '95f519c67cb2b4cf8fc19eabc8191e9e307f429f';
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
type Snapshot = Domain.SummaryV3StyleOperationSnapshot;
type Audit = {
  source: (snapshot: Snapshot) => boolean;
  hard: (snapshot: Snapshot, text: string) => { reason: string | null; predicate: string | null };
  eligibility: (snapshot: Snapshot) => string;
  parseWriter: (value: unknown, snapshot: Snapshot) => { ok: boolean; writerOutputContractFailureClass?: string };
  percent: ((snapshot: Snapshot) => string) | null;
};
type Graph = {
  domain: typeof Domain;
  server: typeof Server & { audit: Audit };
  provider: typeof Provider;
  projector: typeof Projector;
};

// Exact pre-task Git oracle and candidate execute in separate memory graphs.
// No checkout, temporary source, SDK/network invocation, or shared global hook.
function graph(baseline: boolean): Graph {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const loadedModule = { exports: {} as Record<string, unknown> };
    cache.set(file, loadedModule);
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    const original = baseline && relative === 'src/lib/ai-core-v3/summary-style-m5-server.ts'
      ? execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, encoding: 'utf8' })
      : readFileSync(file, 'utf8');
    let code = ts.transpileModule(original, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    if (relative.endsWith('/summary-style-m5-server.ts')) {
      code += '\nexports.audit={source:hasUnsupportedSourceInconsistency,hard:localHardRejectionDecision,'
        + 'eligibility:sourceRetainingSafeNoOpEligibilityReason,parseWriter:parseWriterOutput,'
        + 'percent:typeof sourceManifestDecimalPercentComparison==="function"?sourceManifestDecimalPercentComparison:null};';
    }
    const localRequire = (id: string): unknown => {
      if (!id.startsWith('.') && !id.startsWith('@/')) return nativeRequire(id);
      const target = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(file), id);
      const local = [target, target + '.ts', resolve(target, 'index.ts')].find(existsSync);
      if (!local) throw new Error('Unavailable offline module: ' + id);
      return local.endsWith('.json') ? JSON.parse(readFileSync(local, 'utf8')) : load(local);
    };
    new Function('require', 'module', 'exports', code)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return {
    domain: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5.ts')) as typeof Domain,
    server: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-server.ts')) as Graph['server'],
    provider: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-provider.ts')) as typeof Provider,
    projector: load(resolve(root, 'src/lib/ai-core-v3/summary-v3-production-observability.ts')) as typeof Projector,
  };
}
const baseline = graph(true);
const candidate = graph(false);

function request(source: string, manifest = source, locale = 'sr'): Domain.SummaryV3StyleRequest {
  return {
    enabled: true, operation: 'summary_stronger', operationId: 'synthetic-percent-062', style: 'stronger',
    requestedLocale: locale, sourceLocale: locale, visibleSummary: source, protectedEntities: [],
    createdAt: 1_700_000_000_000,
    manifest: { manifestId: 'fictional-percent', contextId: 'synthetic-only', sourceLocale: locale,
      currentRoleEntryId: 'current', entries: [{ stableId: 'current', role: 'Kontrolor', employer: 'FictionalLab',
        employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: manifest }] }] },
  };
}
const comma = 'Ona poboljšava tačnost za 12,5%.';
const dot = 'Ona poboljšava tačnost za 12.5%.';
type Fixture = { id: string; source: string; manifest: string; locale?: string; changed?: boolean; rejected?: boolean; text?: string };
const fixtures: readonly Fixture[] = [
  { id: 'A sr comma/dot', source: comma, manifest: dot, changed: true },
  { id: 'B reverse direction', source: dot, manifest: comma, changed: true },
  { id: 'C trailing zero', source: comma.replace('12,5', '12,50'), manifest: dot, changed: true },
  { id: 'D comma control', source: comma, manifest: comma, rejected: false },
  { id: 'D dot control', source: dot, manifest: dot, rejected: false },
  { id: 'E different value', source: comma, manifest: dot.replace('12.5', '12.6'), rejected: true },
  { id: 'F different unit', source: comma, manifest: dot.replace('%', ' jedinica'), rejected: true },
  { id: 'G raw decimal', source: comma, manifest: dot.replace('%', ''), rejected: true },
  { id: 'H different relation', source: comma, manifest: 'Ona skraćuje putanju za 12.5%.', rejected: true },
  { id: 'I grouping comma/dot', source: comma.replace('12,5', '1,000'), manifest: dot.replace('12.5', '1.000'), rejected: true },
  { id: 'I grouping reverse', source: dot.replace('12.5', '1.000'), manifest: comma.replace('12,5', '1,000'), rejected: true },
  { id: 'J dates', source: 'Ona beleži datum 01.05.2020.', manifest: 'Ona beleži datum 01,05,2020.' },
  { id: 'K technical identifier', source: 'Ona koristi ModelX12.5.', manifest: 'Ona koristi ModelX12,5.' },
  { id: 'L currency', source: 'Ona beleži €12,5.', manifest: 'Ona beleži €12.5.', rejected: true },
  { id: 'M structured duration', source: 'Ona radi 2 godine.', manifest: 'Ona radi 24 meseca.', rejected: false },
  { id: 'N candidate-only decimal', source: dot, manifest: dot, text: comma },
  { id: 'O candidate number order', source: 'Ona proverava 4 paketa i priprema 8 porudžbina.',
    manifest: 'Ona proverava 4 paketa i priprema 8 porudžbina.', text: 'Ona priprema 8 porudžbina i proverava 4 paketa.' },
  { id: 'P unsupported candidate metric', source: 'Ona proverava robu.', manifest: 'Ona proverava robu.', text: 'Ona proverava robu. Ona postiže 70%.' },
  { id: 'Q role source inconsistency', source: 'She is a Manager at FictionalLab.', manifest: 'She checks goods.', locale: 'en', rejected: true },
  { id: 'R source material result', source: 'She generates revenue.', manifest: 'She checks goods.', locale: 'en', rejected: true },
  { id: 'S named tool', source: 'She uses Rust.', manifest: 'She checks goods.', locale: 'en', rejected: true },
  { id: 'S authority', source: 'She leads a team.', manifest: 'She checks goods.', locale: 'en', rejected: true },
  { id: 'shared en', source: 'She improves accuracy by 12,5%.', manifest: 'She improves accuracy by 12.5%.', locale: 'en', changed: true },
  { id: 'shared de', source: 'Sie verbessert die Genauigkeit um 12,5%.', manifest: 'Sie verbessert die Genauigkeit um 12.5%.', locale: 'de', changed: true },
  { id: 'shared fr', source: 'Elle améliore la précision de 12,5%.', manifest: 'Elle améliore la précision de 12.5%.', locale: 'fr', changed: true },
  { id: 'repeated numeral outside percentage', source: comma + ' Ona beleži 12,5 jedinica.', manifest: dot + ' Ona beleži 12.5 jedinica.', rejected: true },
  { id: 'separate technical span', source: comma + ' Ona koristi 12,5Model.', manifest: dot + ' Ona koristi 12.5Model.', rejected: true },
  { id: 'compound separators', source: comma.replace('12,5', '1.234,5'), manifest: dot.replace('12.5', '1,234.5'), rejected: true },
];

function writer(input: Server.SummaryV3StyleWriterInput, text: string) {
  return { toolName: input.forcedTool.toolName, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale, units: [{ unitId: 'unit-1', text, factIds: input.requiredFacts.map(f => f.id) }] } };
}
function evaluation(input: Server.SummaryV3StyleEvaluatorInput) {
  return { toolName: input.forcedTool.toolName, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale, candidateHash: input.candidate.hash,
      candidateUnitHashes: input.candidate.units.map(candidate.domain.summaryV3StyleCandidateUnitHash),
      phases: Object.fromEntries(candidate.domain.SUMMARY_V3_STYLE_M5_PHASES.map(p => [p, { status: 'passed', violations: [] }])),
      representedFactIdHashes: input.requiredFacts.map(f => f.hash), missingFactIdHashes: [], roleIdentityResolution: 'not_required',
      styleEvidence: { style: 'stronger', strongerPredicateTransformations: 0, structuralStrengtheningCount: 0,
        modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0, stackedModifierDetected: false,
        unsupportedAuthorityDetected: false, strongerFulfilled: true, noOpDetected: true } } };
}
function assess(g: Graph, f: Fixture) {
  const snapshot = g.domain.createSummaryV3StyleOperationSnapshot(request(f.source, f.manifest, f.locale));
  const text = f.text ?? f.source;
  const raw = writer({ operationId: snapshot.operationId, snapshotHash: snapshot.snapshotHash, manifestHash: snapshot.manifestHash,
    style: snapshot.style, locale: snapshot.requestedLocale, requiredFacts: snapshot.requiredFacts,
    forcedTool: { toolName: g.domain.SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME } } as Server.SummaryV3StyleWriterInput, text);
  const parsed = g.server.audit.parseWriter(raw, snapshot);
  const before = JSON.stringify(snapshot);
  // Task 068 adds only same-execution diagnostic provenance to this private
  // decision. Keep every original functional field in the Task 062 oracle.
  const hard = { ...g.server.audit.hard(snapshot, text) } as ReturnType<Audit['hard']> & { sourceFloorFirstProducer?: unknown };
  delete hard.sourceFloorFirstProducer;
  const result = { source: g.server.audit.source(snapshot), hard,
    eligibility: g.server.audit.eligibility(snapshot), floor: g.domain.summaryV3StyleCandidateSourceFloorDecision(snapshot, text),
    writerAccepted: parsed.ok, writerFailure: parsed.writerOutputContractFailureClass ?? null };
  expect(JSON.stringify(snapshot)).toBe(before);
  return { snapshot, result };
}

describe('Task 062 local source/manifest decimal-percent repair', () => {
  it.each(fixtures)('$id: baseline/candidate differential and immutable snapshot parity', (f) => {
    const before = assess(baseline, f), after = assess(candidate, f);
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.snapshot.snapshotHash).toBe(before.snapshot.snapshotHash);
    expect(after.snapshot.manifestHash).toBe(before.snapshot.manifestHash);
    if (f.changed) {
      expect(before.result.source).toBe(true);
      expect(before.result.hard.predicate).toBe('unsupported_source_inconsistency');
      expect(after.result.source).toBe(false);
      expect(after.result.hard.predicate).not.toBe('unsupported_source_inconsistency');
      expect(after.result.writerAccepted).toBe(before.result.writerAccepted);
      expect(after.result.floor).toBe(before.result.floor);
    } else {
      expect(after.result).toEqual(before.result);
      if (f.rejected !== undefined) expect(after.result.source).toBe(f.rejected);
    }
  });

  it('shares one comparison view across numeric and span layers without broad decimal rewriting', () => {
    const snapshot = candidate.domain.createSummaryV3StyleOperationSnapshot(request(comma, dot));
    expect(candidate.server.audit.percent!(snapshot)).toBe(dot);
    expect(candidate.server.audit.source(snapshot)).toBe(false);
    for (const f of fixtures.filter(f => !f.changed && !f.text && f.id !== 'M structured duration')) {
      const s = candidate.domain.createSummaryV3StyleOperationSnapshot(request(f.source, f.manifest, f.locale));
      const comparison = candidate.server.audit.percent!(s);
      const expected = f.id === 'repeated numeral outside percentage' || f.id === 'separate technical span'
        ? f.source.replace('12,5%', '12.5%') : f.source;
      expect(comparison).toBe(expected);
      if (expected !== f.source) expect(candidate.server.audit.source(s)).toBe(true);
    }
  });

  it.each([false, true])('five-fact topology, genuinely different value=%s', async (different) => {
    const source = comma + ' Ona proverava robu. Ona priprema porudžbine. Ona sređuje pakete.';
    const req = request(source, source.replace('12,5', different ? '12.6' : '12.5'));
    async function run(g: Graph) {
      const calls: string[] = [];
      const result = await g.server.executeSummaryV3StyleServer(req, {
        async write(input) { calls.push('writer'); return writer(input, source); },
        async evaluate(input) { calls.push('evaluator'); return evaluation(input); },
        async repairWrite() { calls.push('repair_writer'); throw new Error('unexpected repair'); },
        async repairEvaluate() { calls.push('repair_evaluator'); throw new Error('unexpected repair'); },
      });
      const diagnostic = g.projector.createSummaryStrongerTerminalDiagnostic({ result, requestId: 'fra1::synthetic-062',
        requestedLocale: 'sr', mode: 'enhance_existing_content', httpStatus: result.kind === 'safe_no_op' || result.kind === 'candidate_ready' ? 200 : 422 });
      return { result, calls, diagnostic };
    }
    const before = await run(baseline), after = await run(candidate);
    expect(before.calls).toEqual(['writer', 'evaluator']);
    expect(after.calls).toEqual(before.calls);
    expect(before.diagnostic).toMatchObject({ coveredFactCount: 5, missingFactCount: 0, writerResult: 'accepted',
      evaluatorAllPhasesPassed: true, evaluatorViolationCount: 0, postEvaluatorHardPredicate: 'unsupported_source_inconsistency' });
    if (different) {
      const withoutProducer = (value: typeof after) => {
        const diagnostic: Record<string, unknown> = { ...value.diagnostic };
        delete diagnostic.sourceFloorFirstProducer;
        delete diagnostic.sourceNumericMismatchClass;
        delete diagnostic.sourceNumericMismatchComparisonClass;
        return { ...value, diagnostic };
      };
      expect(withoutProducer(after)).toEqual(withoutProducer(before));
      expect(after.diagnostic).toMatchObject({ postEvaluatorLocalOwner: 'hard_guard',
        postEvaluatorSourceFloorMismatchClass: 'source_inconsistency', finalApplyEligible: false, usageDecision: 'no_increment' });
    } else {
      expect(after.diagnostic.postEvaluatorHardPredicate).not.toBe('unsupported_source_inconsistency');
      expect(after.result.kind).toBe('safe_no_op');
      expect(after.diagnostic).toMatchObject({ strongerSafeNoOpEligibility: 'eligible', finalApplyEligible: false,
        usageDecision: 'no_increment', repairAttempted: false });
    }
  });

  it('preserves exact provider invocations/prompts/tools/metadata/count/order at the mocked adapter seam', async () => {
    const req = request(comma, dot);
    async function run(g: Graph) {
      const invocations: Provider.SummaryV3StyleProviderInvocation[] = [];
      const result = await g.provider.executeSummaryV3StyleRoute(req, {
        now: () => 1_700_000_000_000, timeoutForPhase: () => 1000,
        async invoke(invocation) {
          invocations.push(invocation);
          const response = 'candidate' in invocation.input
            ? evaluation(invocation.input) : writer(invocation.input, comma);
          return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: response.toolName, input: response.input }] };
        },
      });
      return { invocations, result };
    }
    const before = await run(baseline), after = await run(candidate);
    expect(before.invocations.map(i => i.role)).toEqual(['writer', 'evaluator']);
    expect(JSON.stringify(after.invocations)).toBe(JSON.stringify(before.invocations));
    expect(before.result.kind).toBe('handled_failure');
    expect(after.result.kind).toBe('safe_no_op');
    // Task 065 changes only identity-lock comparison in the domain module.
    // Keep the Task 062 snapshot/source-floor authorities byte-exact instead
    // of incorrectly treating the whole module as permanently immutable.
    const domainPath = resolve(root, 'src/lib/ai-core-v3/summary-style-m5.ts');
    const domainBefore = execFileSync('git', ['show', BASELINE + ':src/lib/ai-core-v3/summary-style-m5.ts'], { cwd: root, encoding: 'utf8' });
    const functionText = (text: string, name: string) => {
      const file = ts.createSourceFile(domainPath, text, ts.ScriptTarget.Latest, true);
      const declaration = file.statements.filter(ts.isFunctionDeclaration).find(node => node.name?.text === name);
      if (!declaration) throw new Error('Missing decimal-percent authority: ' + name);
      return declaration.getText(file).replaceAll('\r\n', '\n');
    };
    for (const name of ['createSummaryV3StyleOperationSnapshot', 'inspectSummaryV3StyleCandidateSourceFloor',
      'summaryV3StyleCandidateSourceFloorDecision']) {
      expect(functionText(readFileSync(domainPath, 'utf8'), name)).toBe(functionText(domainBefore, name));
    }
    // Task 068's sidecar-only extension is checked against its exact Git
    // baseline by that task's declaration/functional parity gate. The
    // provider and terminal projector remain byte-exact here.
    for (const relative of ['summary-style-m5-provider.ts', 'summary-v3-production-observability.ts']) {
      expect(readFileSync(resolve(root, 'src/lib/ai-core-v3', relative), 'utf8')).toBe(
        execFileSync('git', ['show', BASELINE + ':src/lib/ai-core-v3/' + relative], { cwd: root, encoding: 'utf8' }));
    }
  });
});
