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

const BASELINE = '8972b75b79969c8ae3e33cddbffd3104c01882c8';
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
type Snapshot = Domain.SummaryV3StyleOperationSnapshot;
type Graph = {
  domain: typeof Domain & { audit: {
    origin: (snapshot: Snapshot, index: number) => Domain.SummaryV3StyleSourceLockOrigin;
    identity: (snapshot: Snapshot, text: string, value: string, kind: 'entity', origin: Domain.SummaryV3StyleSourceLockOrigin) => { preserved: boolean; failureReason: string | null };
  } };
  server: typeof Server;
  provider: typeof Provider;
  projector: typeof Projector;
};

// Independent memory graphs execute real production code, never a copied validator.
// Only the domain module differs; the Git baseline is read without checkout/write.
function graph(baseline: boolean): Graph {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const loaded = { exports: {} as Record<string, unknown> };
    cache.set(file, loaded);
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    const original = baseline && relative === 'src/lib/ai-core-v3/summary-style-m5.ts'
      ? execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, encoding: 'utf8' })
      : readFileSync(file, 'utf8');
    let code = ts.transpileModule(original, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    if (relative === 'src/lib/ai-core-v3/summary-style-m5.ts') {
      code += '\nexports.audit={origin:(snapshot,index)=>sourceLockOrigins.get(snapshot)?.[index]??"unknown",'
        + 'identity:inspectCandidatePreservesUnexpandedIdentityLock};';
    }
    const localRequire = (id: string): unknown => {
      if (!id.startsWith('.') && !id.startsWith('@/')) return nativeRequire(id);
      const target = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(file), id);
      const local = [target, target + '.ts', resolve(target, 'index.ts')].find(existsSync);
      if (!local) throw new Error('Unavailable offline module: ' + id);
      return local.endsWith('.json') ? JSON.parse(readFileSync(local, 'utf8')) : load(local);
    };
    new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  return {
    domain: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5.ts')) as Graph['domain'],
    server: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-server.ts')) as typeof Server,
    provider: load(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-provider.ts')) as typeof Provider,
    projector: load(resolve(root, 'src/lib/ai-core-v3/summary-v3-production-observability.ts')) as typeof Projector,
  };
}
const baseline = graph(true), candidate = graph(false);
const source = 'Atlas checks goods. Nora prepares reports.';
function request(text = source, protectedEntities: readonly string[] = []): Domain.SummaryV3StyleRequest {
  return { enabled: true, operation: 'summary_stronger', operationId: 'synthetic-case-065', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: text, protectedEntities,
    createdAt: 1_700_000_000_000,
    manifest: { manifestId: 'fictional-case', contextId: 'fictional-only', sourceLocale: 'en',
      currentRoleEntryId: 'entry', entries: [{ stableId: 'entry', role: 'Clerk', employer: 'FictionalLab',
        durationMonths: 24, employmentState: 'present', facts: [{ id: 'goods', text: 'checks goods' }] }] } };
}
type Fixture = { id: string; req: Domain.SummaryV3StyleRequest; text: string; changed?: boolean; detached?: boolean; preserved: boolean };
const fixtures: readonly Fixture[] = [
  { id: 'A exact control', req: request(), text: source, preserved: true },
  { id: 'B lowercase', req: request(), text: source.replace('Atlas', 'atlas'), changed: true, preserved: true },
  { id: 'D uppercase', req: request(), text: source.replace('Atlas', 'ATLAS'), changed: true, preserved: true },
  { id: 'D uppercase source', req: request(source.replace('Atlas', 'ATLAS')), text: source, changed: true, preserved: true },
  { id: 'D accented Unicode', req: request(source.replace('Atlas', 'Živa')), text: source.replace('Atlas', 'živa'), changed: true, preserved: true },
  { id: 'D Greek Unicode', req: request(source.replace('Atlas', 'Σίγμα')), text: source.replace('Atlas', 'σίγμα'), changed: true, preserved: true },
  { id: 'D supplementary case', req: request(source.replace('Atlas', '𐐀ra')), text: source.replace('Atlas', '𐐨ra'), changed: true, preserved: true },
  { id: 'F absent', req: request(), text: source.replace('Atlas', 'she'), preserved: false },
  { id: 'G larger token', req: request(), text: source.replace('Atlas', 'AtlasPro'), preserved: false },
  { id: 'G recased larger token', req: request(), text: source.replace('Atlas', 'atlasPro'), preserved: false },
  { id: 'G Unicode prefix', req: request(), text: source.replace('Atlas', 'Жatlas'), preserved: false },
  { id: 'G numeric suffix', req: request(), text: source.replace('Atlas', 'atlas2'), preserved: false },
  { id: 'G supplementary prefix', req: request(), text: source.replace('Atlas', '𐐀atlas'), preserved: false },
  { id: 'G supplementary suffix', req: request(), text: source.replace('Atlas', 'atlas𐐀'), preserved: false },
  { id: 'H protected case', req: request(source, ['Atlas']), text: source.replace('Atlas', 'atlas'), preserved: false },
  { id: 'H protected exact', req: request(source, ['Atlas']), text: source, preserved: true },
  { id: 'L unknown origin', req: request(), text: source.replace('Atlas', 'atlas'), detached: true, preserved: false },
  { id: 'M lexical difference', req: request(), text: source.replace('Atlas', 'Atlass'), preserved: false },
  { id: 'N punctuation', req: request(), text: source.replace('Atlas', 'At-las'), preserved: false },
  { id: 'O script difference', req: request(), text: source.replace('Atlas', 'Атлас'), preserved: false },
  { id: 'P removed diacritic', req: request(source.replace('Atlas', 'Živa')), text: source.replace('Atlas', 'Ziva'), preserved: false },
  { id: 'P full-fold expansion', req: request(source.replace('Atlas', 'Straße')), text: source.replace('Atlas', 'STRASSE'), preserved: false },
  { id: 'Q exact context failure', req: request(), text: source.replace('Atlas', 'Ren Atlas'), preserved: false },
  { id: 'Q exact occurrence dominates', req: request(), text: source + ' ren atlas checks goods.', preserved: true },
];
function inspect(g: Graph, f: Fixture) {
  const original = g.domain.createSummaryV3StyleOperationSnapshot(f.req);
  const snapshot = f.detached ? { ...original } : original;
  const before = JSON.stringify(snapshot);
  const built = g.domain.createSummaryV3StyleCandidate(snapshot, [{ unitId: 'unit', text: f.text,
    factIds: snapshot.requiredFacts.map(fact => fact.id) }]);
  const result = g.domain.inspectSummaryV3StyleCandidatePreservesLocks(snapshot, f.text);
  const diagnostic = g.domain.summarizeSummaryV3StyleSourceLockDiagnostics(snapshot, built, result);
  expect(JSON.stringify(snapshot)).toBe(before);
  return { snapshot, result, diagnostic, origins: snapshot.entityLocks.map((_lock, i) => g.domain.audit.origin(snapshot, i)) };
}
function writer(input: Server.SummaryV3StyleWriterInput, text: string) {
  return { toolName: input.forcedTool.toolName, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale, units: [{ unitId: 'unit', text, factIds: input.requiredFacts.map(f => f.id) }] } };
}
const physicalSource = 'Mila Petrović radi kao tehničar u firmi Atlas tokom 24 meseca. Održava uređaje. Otklanja kvarove. Priprema dokumentaciju. Pomaže kolegama.';
const physicalRequest: Domain.SummaryV3StyleRequest = { ...request(physicalSource, ['Mila Petrović']), requestedLocale: 'sr', sourceLocale: 'sr',
  manifest: { ...request().manifest, sourceLocale: 'sr', entries: [{ ...request().manifest.entries[0]!,
    role: 'tehničar', employer: 'Atlas', facts: [{ id: 'duty', text: 'Održava uređaje' }] }] } };
const physicalCandidate = physicalSource.replace('. Održava', '. održava');
async function providerRun(g: Graph, req: Domain.SummaryV3StyleRequest, text: string) {
  const invocations: Provider.SummaryV3StyleProviderInvocation[] = [];
  const result = await g.provider.executeSummaryV3StyleRoute(req, {
    now: () => 1_700_000_000_000, timeoutForPhase: () => 20_000,
    async invoke(invocation) {
      invocations.push(invocation);
      // Later evaluator remains independently failing; never manufacture success.
      if (invocation.role !== 'writer') throw new Error('synthetic evaluator failure');
      const reply = writer(invocation.input as Server.SummaryV3StyleWriterInput, text);
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: reply.toolName, input: reply.input }] };
    },
  });
  const diagnostic = g.projector.createSummaryStrongerTerminalDiagnostic({ result, requestId: 'fra1::synthetic-065',
    requestedLocale: req.requestedLocale, mode: 'enhance_existing_content', httpStatus: result.kind === 'handled_failure' ? 422 : 200 });
  return { result, diagnostic, invocations };
}

describe('Task 065 construction-bound automatic subject case equivalence', () => {
  it.each(fixtures)('$id: exact baseline/candidate differential', f => {
    const before = inspect(baseline, f), after = inspect(candidate, f);
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.origins).toEqual(before.origins);
    expect(after.result.preserved).toBe(f.preserved);
    if (f.changed) {
      expect(before.result).toMatchObject({ preserved: false, failureReason: 'identity_surface_missing', failureKind: 'entity' });
      expect(before.diagnostic).toMatchObject({ sourceLockOrigin: 'automatic_relation_subject', sourceLockSurfaceMatchClass: 'case_variant_only' });
      expect(after.result).toMatchObject({ preserved: true, failureReason: null });
    } else {
      expect(after.result).toEqual(before.result);
      expect(after.diagnostic).toEqual(before.diagnostic);
    }
  });

  it('C reverse direction uses the actual automatic provenance without changing extraction', () => {
    const snapshot = candidate.domain.createSummaryV3StyleOperationSnapshot(request());
    const index = snapshot.entityLocks.findIndex(lock => lock.value === 'Atlas');
    const origin = candidate.domain.audit.origin(snapshot, index);
    expect(origin).toBe('automatic_relation_subject');
    // Lowercase extraction is intentionally not added. Test the comparator with
    // the same construction origin and source-attested lowercase context only.
    const reversed = { ...snapshot, sourceSummary: source.replace('Atlas', 'atlas') };
    expect(baseline.domain.audit.identity(reversed, source, 'atlas', 'entity', origin).failureReason).toBe('identity_surface_missing');
    expect(candidate.domain.audit.identity(reversed, source, 'atlas', 'entity', origin).preserved).toBe(true);
  });

  it.each(['role', 'employer', 'duration'] as const)('I/J/K manifest %s behavior unchanged', kind => {
    const req = request(kind === 'duration' ? source.replace('goods', '24 goods') : source);
    const f = { ...req, manifest: { ...req.manifest, entries: [{ ...req.manifest.entries[0]!,
      ...(kind === 'role' ? { role: 'Atlas' } : kind === 'employer' ? { employer: 'Atlas' } : {}) }] } };
    const text = f.visibleSummary.replace(kind === 'duration' ? '24' : 'Atlas', kind === 'duration' ? '36' : 'atlas');
    const before = inspect(baseline, { id: kind, req: f, text, preserved: kind !== 'duration' });
    const after = inspect(candidate, { id: kind, req: f, text, preserved: kind !== 'duration' });
    expect(after).toEqual(before);
    expect(after.result.preserved).toBe(kind !== 'duration');
    expect(after.origins[0]).toBe('manifest_' + kind);
  });

  it.each([
    ['Ren Atlas', 'Ren atlas', 'identity_unattested_prefix'],
    ['Atlas Prime', 'atlas Prime', 'identity_unattested_suffix'],
  ])('Q surface admission retains %s context rejection', (exact, recased, reason) => {
    const exactBefore = inspect(baseline, { id: exact, req: request(), text: source.replace('Atlas', exact), preserved: false });
    const after = inspect(candidate, { id: recased, req: request(), text: source.replace('Atlas', recased), preserved: false });
    expect(exactBefore.result.failureReason).toBe(reason);
    expect(after.result.failureReason).toBe(reason);
    expect(after.diagnostic.sourceLockOrigin).toBe('automatic_relation_subject');
  });

  it('Q a terminal source occurrence still rejects a newly attached extension', () => {
    const req = request(source.replace('Nora prepares reports.', 'Nora helps Atlas.'));
    const exact = req.visibleSummary.replace('helps Atlas.', 'helps Atlas Prime.');
    const recased = exact.replaceAll('Atlas', 'atlas');
    expect(inspect(baseline, { id: 'exact terminal', req, text: exact, preserved: false }).result.failureReason).toBe('identity_unattested_terminal_extension');
    expect(inspect(candidate, { id: 'recased terminal', req, text: recased, preserved: false }).result.failureReason).toBe('identity_unattested_terminal_extension');
  });

  it('E / Device 064 topology: 5/5 writer-only case rejection clears only this lock', async () => {
    const before = await providerRun(baseline, physicalRequest, physicalCandidate);
    const after = await providerRun(candidate, physicalRequest, physicalCandidate);
    expect(before.diagnostic).toMatchObject({ writerCandidateReachedValidation: true, coveredFactCount: 5, missingFactCount: 0,
      writerFailureClass: 'source_lock_preservation', sourceLockFailureKind: 'entity', sourceLockFailureReason: 'identity_surface_missing',
      sourceLockOrigin: 'automatic_relation_subject', sourceLockSurfaceMatchClass: 'case_variant_only',
      sourceLockRequiredFactBindingCount: 1, sourceLockDeclaredFactBindingCount: 1, evaluatorAttempted: false, repairAttempted: false });
    expect(inspect(candidate, { id: 'physical topology', req: physicalRequest, text: physicalCandidate, preserved: true }).result.preserved).toBe(true);
    expect(after.diagnostic.writerFailureClass).not.toBe('source_lock_preservation');
    expect(after.diagnostic.sourceLockFailureReason).toBeUndefined();
    expect(after.diagnostic.sourceLockOrigin).toBeNull();
    expect(after.diagnostic.finalApplyEligible).toBe(false);
    expect(after.diagnostic.usageDecision).toBe('no_increment');
    expect(JSON.stringify(after.invocations)).toBe(JSON.stringify(before.invocations));
  });

  it('provider payload/order and snapshot parity for unchanged exact and protected paths', async () => {
    for (const [req, text] of [[request(), source], [request(source, ['Atlas']), source.replace('Atlas', 'atlas')]] as const) {
      const before = await providerRun(baseline, req, text), after = await providerRun(candidate, req, text);
      expect(after).toEqual(before);
      expect(candidate.domain.createSummaryV3StyleOperationSnapshot(req)).toEqual(baseline.domain.createSummaryV3StyleOperationSnapshot(req));
    }
  });
});
