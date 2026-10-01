import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as domain from '../summary-style-m5';
import type * as Server from '../summary-style-m5-server';
import type * as Provider from '../summary-style-m5-provider';
import type * as Projector from '../summary-v3-production-observability';
import * as sidecar from '../summary-style-m5-local-observability';

const BASELINE = 'c5964c62ade95429f7ae57b89b0278a1d66bea76';
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
const source = 'Ava Patel currently works as a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
const strengthened = source.replace('builds reliable', 'engineers reliable');
const opposite = ' Previously I worked as a Product Engineer at Atlas.';
type Snapshot = domain.SummaryV3StyleOperationSnapshot;
type Evaluation = Parameters<typeof Server.executeSummaryV3StyleServer>[1];
type HardDecision = { reason: 'unsupported_claim' | 'lost_source_fact' | null; predicate: sidecar.SummaryStyleHardPredicate | null };
type Audit = {
  hard: (snapshot: Snapshot, text: string, observe?: (decision: HardDecision) => void) => HardDecision['reason'];
  predicates: readonly ((snapshot: Snapshot, text: string) => boolean)[];
};
type Loaded = {
  domain: typeof domain;
  server: typeof Server & { audit: Audit };
  provider: typeof Provider;
  projector: typeof Projector;
  sidecar?: typeof sidecar;
};

// Execute actual Git baseline and worktree modules in separate in-memory
// CommonJS graphs. No checkout, generated source file, network or global hooks.
function loadGraph(baseline: boolean): Loaded {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(path: string): Record<string, unknown> {
    const hit = cache.get(path);
    if (hit) return hit.exports;
    const loadedModule = { exports: {} as Record<string, unknown> };
    cache.set(path, loadedModule);
    const relative = path.slice(root.length + 1).replaceAll('\\', '/');
    const original = baseline && [
      'src/lib/ai-core-v3/summary-style-m5-server.ts',
      'src/lib/ai-core-v3/summary-v3-production-observability.ts',
    ].includes(relative)
      ? execFileSync('git', ['show', `${BASELINE}:${relative}`], { cwd: root, encoding: 'utf8' })
      : readFileSync(path, 'utf8');
    const audit = relative.endsWith('/summary-style-m5-server.ts')
      ? '\nexports.audit = { hard: localHardRejection, predicates: [hasUnsupportedSourceInconsistency, hasInjectedManifestFact, hasUnsupportedAuthorityOrSeniority, hasUnsupportedNumericMetric, hasUnsupportedCandidateSemanticMaterial, hasUnsupportedCandidateNamedToolSurface, hasEmploymentStateContradiction] };'
      : '';
    const code = ts.transpileModule(original, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText + audit;
    const localRequire = (id: string): unknown => {
      if (!id.startsWith('.') && !id.startsWith('@/')) return nativeRequire(id);
      const target = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(path), id);
      const file = [target, `${target}.ts`, resolve(target, 'index.ts')].find(existsSync);
      if (!file) throw new Error(`Offline module unavailable: ${id}`);
      return file.endsWith('.json') ? JSON.parse(readFileSync(file, 'utf8')) : load(file);
    };
    new Function('require', 'module', 'exports', code)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return {
    domain: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5.ts')) as typeof domain,
    server: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-server.ts')) as Loaded['server'],
    provider: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-provider.ts')) as Loaded['provider'],
    projector: load(resolve(root, 'src/lib/ai-core-v3/summary-v3-production-observability.ts')) as Loaded['projector'],
    sidecar: baseline ? undefined : load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-local-observability.ts')) as typeof sidecar,
  };
}
const baseline = loadGraph(true);
const candidate = loadGraph(false);

// Entirely fictional audit fixtures; never physical CV content.
function request(): domain.SummaryV3StyleRequest {
  return {
    enabled: true, operation: 'summary_stronger', operationId: 'local-discriminator-058', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: source, protectedEntities: ['Ava Patel'],
    createdAt: 1_700_000_000_000,
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' }, { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' }, { id: 'api', text: 'builds reliable APIs' },
      { id: 'mentor', text: 'mentors peers' }, { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' },
    ],
    manifest: {
      manifestId: 'audit-manifest', contextId: 'audit-context', sourceLocale: 'en', currentRoleEntryId: 'current',
      entries: [{ stableId: 'current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24,
        facts: [{ id: 'api', text: 'builds reliable APIs' }, { id: 'mentor', text: 'mentors peers' },
          { id: 'metric', text: 'improved delivery by 20%' }] }],
    },
  };
}
type Finding = { phase: domain.SummaryV3StylePhase; code: domain.SummaryV3StyleViolationCode; repairable: boolean };
type Scenario = {
  text?: string; request?: domain.SummaryV3StyleRequest; findings?: readonly Finding[];
  role?: domain.SummaryV3StyleRoleIdentityResolution; noOp?: boolean;
  repairText?: string; repairFindings?: readonly Finding[]; repairRole?: domain.SummaryV3StyleRoleIdentityResolution; repairNoOp?: boolean;
  failure?: 'writer' | 'evaluator'; malformedEvaluator?: boolean;
};
function writer(input: Server.SummaryV3StyleWriterInput, text: string) {
  return { toolName: domain.SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale,
      units: [{ unitId: 'unit-1', text, factIds: input.requiredFacts.map((fact) => fact.id) }] } };
}
function evaluator(input: Server.SummaryV3StyleEvaluatorInput, findings: readonly Finding[] = [],
  role: domain.SummaryV3StyleRoleIdentityResolution = 'not_required', noOp = false) {
  return { toolName: domain.SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale, candidateHash: input.candidate.hash,
      candidateUnitHashes: input.candidate.units.map(domain.summaryV3StyleCandidateUnitHash),
      phases: Object.fromEntries(domain.SUMMARY_V3_STYLE_M5_PHASES.map((phase) => {
        const selected = findings.filter((finding) => finding.phase === phase);
        return [phase, { status: selected.length ? 'failed' : 'passed', violations: selected.map((finding) => ({
          code: finding.code, repairable: finding.repairable, factIdHashes: [input.requiredFacts[0]!.hash],
          unitHashes: [domain.summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)],
        })) }];
      })),
      representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash), missingFactIdHashes: [], roleIdentityResolution: role,
      styleEvidence: { style: 'stronger', strongerPredicateTransformations: noOp ? 0 : 1, structuralStrengtheningCount: noOp ? 0 : 1,
        modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0, stackedModifierDetected: false,
        unsupportedAuthorityDetected: false, strongerFulfilled: true, noOpDetected: noOp } } };
}
async function run(graph: Loaded, options: Scenario = {}) {
  const calls: { phase: string; input: unknown }[] = [];
  const dependencies: Evaluation = {
    async write(input) { calls.push({ phase: 'writer', input });
      if (options.failure === 'writer') throw new Error('offline fixture');
      return writer(input, options.text ?? strengthened); },
    async evaluate(input) { calls.push({ phase: 'evaluator', input });
      if (options.failure === 'evaluator') throw new Error('offline fixture');
      return options.malformedEvaluator ? {} : evaluator(input, options.findings, options.role, options.noOp); },
    async repairWrite(input) { calls.push({ phase: 'repair_writer', input }); return writer(input, options.repairText ?? strengthened); },
    async repairEvaluate(input) { calls.push({ phase: 'repair_evaluator', input });
      return evaluator(input, options.repairFindings, options.repairRole, options.repairNoOp); },
  };
  const result = await graph.server.executeSummaryV3StyleServer(options.request ?? request(), dependencies);
  const diagnostic = graph.projector.createSummaryStrongerTerminalDiagnostic({ result,
    requestId: 'fra1::synthetic-058', requestedLocale: options.request?.requestedLocale ?? 'en',
    mode: 'enhance_existing_content', httpStatus: result.kind === 'candidate_ready' || result.kind === 'safe_no_op' ? 200 : 422 });
  return { result, calls, diagnostic };
}
function stripNew(event: unknown) {
  const record = { ...event as Record<string, unknown> };
  for (const key of Object.keys(sidecar.readSummaryStyleLocalDiagnostics({}))) delete record[key];
  return record;
}
async function parity(options: Scenario = {}) {
  const before = await run(baseline, options);
  const after = await run(candidate, options);
  expect(JSON.stringify(after.result)).toBe(JSON.stringify(before.result));
  expect(JSON.stringify(after.calls)).toBe(JSON.stringify(before.calls));
  expect(stripNew(after.diagnostic)).toEqual(before.diagnostic);
  return after;
}

const fixtureBase = request();
const inconsistent: domain.SummaryV3StyleRequest = { ...fixtureBase,
  manifest: { ...fixtureBase.manifest!, entries: [{ ...fixtureBase.manifest!.entries[0]!,
    facts: fixtureBase.manifest!.entries[0]!.facts.filter((fact) => fact.id !== 'metric') }] } };
const injected: domain.SummaryV3StyleRequest = { ...fixtureBase,
  manifest: { ...fixtureBase.manifest!, entries: [{ ...fixtureBase.manifest!.entries[0]!,
    facts: [...fixtureBase.manifest!.entries[0]!.facts, { id: 'extra', text: 'Kubernetes' }] }] } };
const hardCases: readonly [sidecar.SummaryStyleHardPredicate, Scenario][] = [
  ['unsupported_source_inconsistency', { request: inconsistent, text: strengthened + opposite }],
  ['injected_manifest_fact', { request: injected, text: strengthened + ' She uses Kubernetes.' + opposite }],
  ['unsupported_authority_or_seniority', { text: strengthened + ' She is a senior leader.' + opposite }],
  ['unsupported_numeric_metric', { text: strengthened + ' She increased output by 80%.' + opposite }],
  ['unsupported_candidate_semantic_material', { text: strengthened + ' She handles $20.' + opposite }],
  ['unsupported_named_tool_surface', { text: strengthened + ' She uses Rust.' + opposite }],
  ['employment_state_contradiction', { text: strengthened + opposite }],
];

describe('Task 058 same-execution local predicate provenance', () => {
  it.each(hardCases)('captures actual first %s through the production server', async (predicate, options) => {
    const { result, calls, diagnostic } = await parity(options);
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(calls.map((call) => call.phase)).toEqual(['writer', 'evaluator']);
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: 'hard_guard', postEvaluatorHardPredicate: predicate,
      postEvaluatorRoleIdentityFailureClass: null, evaluatorAllPhasesPassed: true, evaluatorViolationCount: 0,
      terminalLayer: 'evaluator_validation', terminalReason: 'unsupported_claim', repairAttempted: false,
      finalApplyEligible: false, usageDecision: 'no_increment', strongerSafeNoOpEligibility: 'employment_state_contradiction' });
  });
  it('does not report a later true predicate or a differently ordered category', async () => {
    const options = { request: inconsistent, text: strengthened + ' She is a senior leader using 80%.' + opposite };
    const snapshot = domain.createSummaryV3StyleOperationSnapshot(inconsistent);
    expect(candidate.server.audit.predicates[0]!(snapshot, options.text)).toBe(true);
    expect(candidate.server.audit.predicates[2]!(snapshot, options.text)).toBe(true);
    expect(candidate.server.audit.predicates[3]!(snapshot, options.text)).toBe(true);
    const { diagnostic } = await parity(options);
    expect(diagnostic).toMatchObject({ postEvaluatorHardPredicate: 'unsupported_source_inconsistency',
      postEvaluatorUnsupportedClaimCategory: null });
  });
  it.each([
    ['contradiction', 'evaluator_role_contradiction'], ['unresolved', 'evaluator_role_unresolved'],
    ['not_required', 'snapshot_role_unresolved_without_equivalence'],
  ] as const)('records actual role branch %s without a hard winner', async (role, failureClass) => {
    const base = request();
    const fixture: domain.SummaryV3StyleRequest = { ...base,
      manifest: { ...base.manifest!, entries: [{ ...base.manifest!.entries[0]!,
        role: 'Produktingenieurin', roleSourceLocale: 'de' }] } };
    const { diagnostic, result } = await parity({ request: fixture, role });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: 'role_identity_resolution', postEvaluatorHardPredicate: null,
      postEvaluatorRoleIdentityFailureClass: failureClass, evaluatorAllPhasesPassed: true, evaluatorRoleIdentityResolution: role });
  });
  it('keeps parsed evaluator findings even when local priority clears selected evaluator fields', async () => {
    const { diagnostic } = await parity({ text: strengthened + opposite,
      findings: [{ phase: 'semantic_grounding', code: 'unsupported_metric', repairable: false }] });
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: 'hard_guard', evaluatorAllPhasesPassed: false,
      evaluatorViolationCount: 1, evaluatorTerminalPhase: null, evaluatorViolationCode: null, evaluatorViolationRepairable: null });
  });
  it('keeps evaluator-only selection distinct from any local owner', async () => {
    const { diagnostic } = await parity({ findings: [{ phase: 'semantic_grounding', code: 'lost_source_fact', repairable: false }] });
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: null, postEvaluatorHardPredicate: null,
      postEvaluatorRoleIdentityFailureClass: null, evaluatorViolationCode: 'lost_source_fact', evaluatorViolationCount: 1 });
  });
  it('does not label candidate success as a local rejection', async () => {
    const { result, diagnostic } = await parity();
    expect(result.kind).toBe('candidate_ready');
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: null, postEvaluatorHardPredicate: null,
      evaluatorAllPhasesPassed: true, strongerSafeNoOpEligibility: null });
  });
  it('observes the actual eligible retention gate without treating no-op as terminal rejection', async () => {
    const { result, diagnostic } = await parity({ text: strengthened + ' She is a senior leader.' });
    expect(result.kind).toBe('safe_no_op');
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: null, postEvaluatorHardPredicate: null,
      strongerSafeNoOpEligibility: 'eligible', usageDecision: 'no_increment' });
  });
  it('retains evaluator-selected safe no-op and its actual admission reason', async () => {
    const { result, diagnostic } = await parity({ text: source, noOp: true });
    expect(result.kind).toBe('safe_no_op');
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: null, strongerSafeNoOpEligibility: 'eligible' });
  });
  it.each(['writer', 'evaluator'] as const)('leaves unrelated %s transport context null', async (failure) => {
    const { diagnostic } = await parity({ failure });
    for (const key of Object.keys(sidecar.readSummaryStyleLocalDiagnostics({}))) {
      expect(diagnostic?.[key as keyof NonNullable<typeof diagnostic>]).toBeNull();
    }
  });
  it('leaves unparsed evaluator context null', async () => {
    const { diagnostic } = await parity({ malformedEvaluator: true });
    expect(diagnostic).toMatchObject({ evaluatorAllPhasesPassed: null, evaluatorViolationCount: null,
      evaluatorRoleIdentityResolution: null, strongerSafeNoOpEligibility: null });
  });
  it('preserves successful repair, provider ordering and repair input bytes', async () => {
    const { result, calls, diagnostic } = await parity({ text: source,
      findings: [{ phase: 'style_fulfillment', code: 'style_not_fulfilled', repairable: true }] });
    expect(result.kind).toBe('candidate_ready');
    expect(calls.map((call) => call.phase)).toEqual(['writer', 'evaluator', 'repair_writer', 'repair_evaluator']);
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: null, evaluatorViolationCount: 0 });
  });
  it('binds a repair-local owner to the repaired candidate/evaluator, not the initial one', async () => {
    const { diagnostic } = await parity({ text: source, repairText: strengthened + opposite,
      findings: [{ phase: 'style_fulfillment', code: 'style_not_fulfilled', repairable: true }] });
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: 'hard_guard',
      postEvaluatorHardPredicate: 'employment_state_contradiction', evaluatorViolationCount: 0, repairAttempted: true });
  });
  it('captures a repair role owner without inventing an unexecuted no-op admission check', async () => {
    // Initial local no-op admission is not evaluated for this repairable style failure.
    const { diagnostic } = await parity({ text: source, repairRole: 'contradiction',
      findings: [{ phase: 'style_fulfillment', code: 'style_not_fulfilled', repairable: true }] });
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: 'role_identity_resolution',
      postEvaluatorRoleIdentityFailureClass: 'evaluator_role_contradiction', strongerSafeNoOpEligibility: 'not_evaluated' });
  });
  it('does not select a captured hard winner when repair-no-op has higher terminal priority', async () => {
    const { result, diagnostic } = await parity({ text: source, repairText: strengthened + opposite, repairNoOp: true,
      findings: [{ phase: 'style_fulfillment', code: 'style_not_fulfilled', repairable: true }] });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_rejected' });
    expect(diagnostic).toMatchObject({ postEvaluatorLocalOwner: null, postEvaluatorHardPredicate: null,
      evaluatorAllPhasesPassed: true, strongerSafeNoOpEligibility: null });
  });
  it('projects only winner-associated finite categories, not a later mismatch producer', async () => {
    const { diagnostic } = await parity(hardCases[4]![1]);
    expect(diagnostic).toMatchObject({ postEvaluatorHardPredicate: 'unsupported_candidate_semantic_material',
      postEvaluatorUnsupportedClaimCategory: 'source_floor_mismatch', postEvaluatorSourceFloorMismatchClass: null });
    const employment = await parity(hardCases[6]![1]);
    expect(employment.diagnostic).toMatchObject({ postEvaluatorSourceFloorMismatchClass: 'employment_state_contradiction' });
  });
  it('preserves exact same-execution hard short-circuit behavior and reason wrapper', () => {
    const snapshot = domain.createSummaryV3StyleOperationSnapshot(inconsistent);
    const text = strengthened + ' She is a senior leader using 80%.' + opposite;
    const observations: HardDecision[] = [];
    const reason = candidate.server.audit.hard(snapshot, text, (decision) => observations.push(decision));
    expect(reason).toBe(baseline.server.audit.hard(snapshot, text));
    expect(observations).toEqual([{ reason: 'unsupported_claim', predicate: 'unsupported_source_inconsistency',
      sourceFloorFirstProducer: 'source_numeric_membership_mismatch' }]);
  });
  it('counts all four validated phase collections before local terminal suppression', async () => {
    const findings = domain.SUMMARY_V3_STYLE_M5_PHASES.flatMap((phase) =>
      Array.from({ length: 32 }, () => ({ phase, code: 'unsupported_metric' as const, repairable: false })));
    const { diagnostic } = await parity({ text: strengthened + opposite, findings });
    expect(diagnostic).toMatchObject({ evaluatorViolationCount: 128, evaluatorAllPhasesPassed: false,
      postEvaluatorLocalOwner: 'hard_guard', evaluatorViolationCode: null });
  });
});

describe('Task 058 privacy, provider and identity noninterference', () => {
  it('keeps complete snapshot bytes/hash/equality unchanged and excludes sidecar fields', () => {
    const before = baseline.domain.createSummaryV3StyleOperationSnapshot(request());
    const after = candidate.domain.createSummaryV3StyleOperationSnapshot(request());
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(after.snapshotHash).toBe(before.snapshotHash);
    expect(after.manifestHash).toBe(before.manifestHash);
    expect(Object.isFrozen(after)).toBe(true);
    for (const key of Object.keys(sidecar.readSummaryStyleLocalDiagnostics({}))) {
      expect(JSON.stringify(after)).not.toContain(key);
    }
  });
  it.each([0, 128, -1, 129, 0.5, NaN, Infinity, null])('enforces schema-derived count bound for %s', async (count) => {
    const { result } = await run(candidate);
    const original = JSON.stringify(result);
    expect(sidecar.SUMMARY_STYLE_MAX_EVALUATOR_VIOLATIONS).toBe(4 * 32);
    const returned = candidate.sidecar!.recordSummaryStyleLocalDiagnostics(result, {
      ...sidecar.readSummaryStyleLocalDiagnostics({}), evaluatorViolationCount: count,
    });
    expect(returned).toBe(result);
    expect(JSON.stringify(result)).toBe(original);
    expect(candidate.sidecar!.readSummaryStyleLocalDiagnostics(result).evaluatorViolationCount)
      .toBe(count === 0 || count === 128 ? count : null);
  });
  it('rejects arbitrary diagnostic strings and incompatible owner fields at serialization', async () => {
    const { result } = await run(candidate, hardCases[6]![1]);
    const poison = 'PRIVATE AUDIT SOURCE employer role duty fact secret 987654';
    candidate.sidecar!.recordSummaryStyleLocalDiagnostics(result, {
      ...Object.fromEntries(Object.keys(sidecar.readSummaryStyleLocalDiagnostics({})).map((key) => [key, poison])),
      postEvaluatorLocalOwner: 'hard_guard', evaluatorViolationCount: 129,
    } as unknown as sidecar.SummaryStyleLocalDiagnostics);
    const diagnostic = candidate.projector.createSummaryStrongerTerminalDiagnostic({ result,
      requestId: 'fra1::privacy-058', requestedLocale: 'en', mode: 'enhance_existing_content', httpStatus: 422 });
    const serialized = JSON.stringify(diagnostic);
    for (const prohibited of [poison, source, strengthened, 'Ava Patel', 'Atlas', 'Product Engineer', '987654']) {
      expect(serialized).not.toContain(prohibited);
    }
    expect(diagnostic).toMatchObject({ postEvaluatorHardPredicate: null, postEvaluatorRoleIdentityFailureClass: null,
      postEvaluatorUnsupportedClaimCategory: null, postEvaluatorSourceFloorMismatchClass: null,
      evaluatorAllPhasesPassed: null, evaluatorViolationCount: null, evaluatorRoleIdentityResolution: null,
      strongerSafeNoOpEligibility: null });
  });
  it('serializes only the ten approved finite fields for an actual local terminal', async () => {
    const { result, diagnostic } = await parity(hardCases[6]![1]);
    const local = candidate.sidecar!.readSummaryStyleLocalDiagnostics(result);
    expect(Object.keys(local)).toHaveLength(10);
    expect(local.sourceFloorFirstProducer).toBeNull();
    expect(Object.isFrozen(local)).toBe(true);
    const serialized = JSON.stringify(diagnostic);
    for (const prohibited of [source, strengthened, 'Ava Patel', 'Atlas', 'Product Engineer', 'Kubernetes', 'factIds', 'snapshotHash']) {
      expect(serialized).not.toContain(prohibited);
    }
    expect(JSON.stringify(result)).not.toContain('postEvaluatorLocalOwner');
    expect(domain.hashSummaryV3StyleValue(JSON.stringify(result)))
      .toBe(domain.hashSummaryV3StyleValue(JSON.stringify((await run(baseline, hardCases[6]![1])).result)));
  });
  it.each([false, true])('preserves provider-visible prompt/schema/metadata/repair bytes, repair=%s', async (repair) => {
    async function invokeGraph(graph: Loaded) {
      const invocations: Provider.SummaryV3StyleProviderInvocation[] = [];
      const result = await graph.provider.executeSummaryV3StyleRoute(request(), {
        timeoutForPhase: () => 30_000,
        async invoke(invocation) {
          invocations.push(invocation);
          const isWriter = invocation.role === 'writer';
          const output = isWriter
            ? writer(invocation.input as Server.SummaryV3StyleWriterInput,
              repair && invocation.phase === 'initial_writer' ? source : strengthened)
            : evaluator(invocation.input as Server.SummaryV3StyleEvaluatorInput,
              repair && invocation.phase === 'initial_evaluator'
                ? [{ phase: 'style_fulfillment', code: 'style_not_fulfilled', repairable: true }] : []);
          return { content: [{ type: 'tool_use', name: output.toolName, input: output.input }] };
        },
      });
      return { invocations, result };
    }
    const before = await invokeGraph(baseline);
    const after = await invokeGraph(candidate);
    expect(after.result.kind).toBe('candidate_ready');
    expect(after.invocations).toHaveLength(repair ? 4 : 2);
    expect(JSON.stringify(after.invocations)).toBe(JSON.stringify(before.invocations));
    expect(JSON.stringify(after.result)).toBe(JSON.stringify(before.result));
    for (const key of Object.keys(sidecar.readSummaryStyleLocalDiagnostics({}))) {
      expect(JSON.stringify(after.invocations)).not.toContain(key);
    }
    expect(Object.isFrozen(after.invocations[0]!.input)).toBe(true);
  });
  it('preserves source-lock rejection before evaluator and leaves new context absent', async () => {
    const { result, diagnostic, calls } = await parity({ text: strengthened.replace('Atlas', 'Beacon') });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(calls).toHaveLength(1);
    expect(diagnostic).toMatchObject({ sourceLockFailureKind: 'employer', postEvaluatorLocalOwner: null,
      evaluatorAllPhasesPassed: null, evaluatorViolationCount: null });
  });
  it.each(['decimal', 'order', 'duration'] as const)('retains Task 057 current Serbian numeric sensitivity: %s', async (variant) => {
    const fixture: domain.SummaryV3StyleRequest = {
      ...request(), requestedLocale: 'sr', sourceLocale: 'sr', protectedEntities: [], visibleSummaryFacts: [],
      visibleSummary: 'Trenutno radim kao Inženjerka u Atlasu. Održavam sisteme i pripremam porudžbine. Smanjujem greške za 20,5% tokom 24 meseca.',
      manifest: { manifestId: 'sr-audit', contextId: 'sr-context', sourceLocale: 'sr', currentRoleEntryId: 'current',
        entries: [{ stableId: 'current', role: 'Inženjerka', employer: 'Atlasu', employmentState: 'present', durationMonths: 0,
          facts: [{ id: 'duty', text: 'Održavam sisteme i pripremam porudžbine' },
            { id: 'metric', text: 'Smanjujem greške za 20,5% tokom 24 meseca' }] }] },
    };
    const text = variant === 'decimal' ? fixture.visibleSummary.replace('20,5%', '20.5%')
      : variant === 'order' ? fixture.visibleSummary.replace('20,5% tokom 24 meseca', '24 meseca, uz smanjenje grešaka za 20,5%')
        : fixture.visibleSummary.replace('24 meseca', '2 godine');
    const snapshot = domain.createSummaryV3StyleOperationSnapshot(fixture);
    const observed: HardDecision[] = [];
    expect(candidate.server.audit.hard(snapshot, text, (decision) => observed.push(decision)))
      .toBe(baseline.server.audit.hard(snapshot, text));
    expect(observed).toEqual([{ reason: 'unsupported_claim', predicate: 'unsupported_numeric_metric' }]);
    const { result } = await parity({ request: fixture, text });
    // No decimal/order/duration normalization repair: current full-route
    // retention or writer rejection is exactly the baseline outcome.
    expect(result.kind).toBe(variant === 'decimal' ? 'safe_no_op' : 'handled_failure');
  });
});
