import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type * as Client from '../summary-style-m5-client';
import type * as Domain from '../summary-style-m5';
import type * as Server from '../summary-style-m5-server';
import type * as Provider from '../summary-style-m5-provider';
import type * as Projector from '../summary-v3-production-observability';
import type * as Duration from '../../cv-experience-duration';
import type { CVData } from '../../types';
import type { SummaryStyleSourceNumericMismatchEvidence, SummaryStyleSourceFloorFirstProducer } from '../summary-style-m5-local-observability';

// Task078 safety-gate evidence only. No production repair is permitted by
// these tests: durable duration provenance and an independent later candidate
// duration validator must both exist before reconciliation can be admitted.
const BASELINE = '76bb389448a510eeca2d8485b857d60586d00a21';
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
type Snapshot = Domain.SummaryV3StyleOperationSnapshot;
type Hard = { reason: string | null; predicate: string | null; sourceFloorFirstProducer?: SummaryStyleSourceFloorFirstProducer };
type Audit = {
  first: (snapshot: Snapshot, observe?: (evidence: SummaryStyleSourceNumericMismatchEvidence) => void) => SummaryStyleSourceFloorFirstProducer | null;
  hard: (snapshot: Snapshot, text: string) => Hard;
  numeric: (snapshot: Snapshot, text: string) => boolean;
  sourceDuration: (snapshot: Snapshot) => boolean;
  entryIds: (snapshot: Snapshot, clause: string) => ReadonlySet<string>;
  parseWriter: (value: unknown, snapshot: Snapshot) => { ok: boolean; reason?: string; writerOutputContractFailureClass?: string };
  writer: (snapshot: Snapshot) => Server.SummaryV3StyleWriterInput;
  remainingHardWithoutSourceGate: (snapshot: Snapshot, text: string) => Hard;
};
type Graph = {
  domain: typeof Domain;
  server: typeof Server & { audit: Audit };
  client: typeof Client & { audit: { request: (
    input: Client.SummaryV3StyleClientInput,
    requested: Domain.SummaryV3StyleSupportedLocale,
    source: Domain.SummaryV3StyleSupportedLocale,
  ) => Domain.SummaryV3StyleRequest } };
  provider: typeof Provider;
  projector: typeof Projector;
  duration: typeof Duration;
};
function graph(baseline: boolean): Graph {
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  function load(file: string): Record<string, unknown> {
    const hit = cache.get(file);
    if (hit) return hit.exports;
    const loaded = { exports: {} as Record<string, unknown> };
    cache.set(file, loaded);
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    const original = baseline
      ? execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 })
      : readFileSync(file, 'utf8');
    let code = ts.transpileModule(original, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText;
    if (relative === 'src/lib/ai-core-v3/summary-style-m5-client.ts') {
      code += '\nexports.audit={request:buildSummaryV3StyleRequest};\n';
    }
    if (relative === 'src/lib/ai-core-v3/summary-style-m5-server.ts') {
      // Private test-memory exposure, never an on-disk production mutation.
      // The counterfactual skips ONLY the source-inconsistency call to inspect
      // the remaining late candidate predicates, not production acceptance.
      code += '\nexports.audit={first:sourceFloorFirstPositiveProducer,hard:localHardRejectionDecision,'
        + 'numeric:hasUnsupportedNumericMetric,sourceDuration:hasRoleLocalSourceDurationContradiction,'
        + 'entryIds:exactEntryIdsInSummaryV3StyleClause,parseWriter:parseWriterOutput,writer:writerInput,'
        + 'remainingHardWithoutSourceGate:(snapshot,text)=>{const original=sourceFloorFirstPositiveProducer;'
        + 'try{sourceFloorFirstPositiveProducer=()=>null;return localHardRejectionDecision(snapshot,text);}'
        + 'finally{sourceFloorFirstPositiveProducer=original;}}};\n';
    }
    const localRequire = (id: string): unknown => {
      if (!id.startsWith('.') && !id.startsWith('@/')) return nativeRequire(id);
      const target = id.startsWith('@/') ? resolve(root, 'src', id.slice(2)) : resolve(dirname(file), id);
      const local = [target, target + '.ts', target + '.tsx', resolve(target, 'index.ts')]
        .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      if (!local) throw new Error('Missing offline module: ' + id);
      return local.endsWith('.json') ? JSON.parse(readFileSync(local, 'utf8')) : load(local);
    };
    new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  const loadModule = <T,>(relative: string): T => load(resolve(root, relative)) as T;
  return {
    domain: loadModule('src/lib/ai-core-v3/summary-style-m5.ts'),
    client: loadModule('src/lib/ai-core-v3/summary-style-m5-client.ts'),
    server: loadModule('src/lib/ai-core-v3/summary-style-m5-server.ts'),
    provider: loadModule('src/lib/ai-core-v3/summary-style-m5-provider.ts'),
    projector: loadModule('src/lib/ai-core-v3/summary-v3-production-observability.ts'),
    duration: loadModule('src/lib/cv-experience-duration.ts'),
  };
}
const before = graph(true), after = graph(false);
const source = 'SyntheticPerson currently works as a Clerk at FictionalLab for about 8 months. SyntheticPerson checks goods.';
function cv(): CVData {
  return {
    id: 'fictional-cv', name: 'Fictional only', personal: {
      fullName: 'SyntheticPerson', jobTitle: '', email: '', phone: '', address: '',
      linkedIn: '', website: '', photo: '', gender: 'female',
    },
    contentLocale: 'en', summary: source, summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: 'en', summaryGenerationContextKey: 'synthetic-only',
    experience: [{
      id: 'fictional-entry', position: 'Clerk', company: 'FictionalLab',
      startDate: '2026-01', endDate: '', isPresent: true, description: 'Checks goods.',
      descriptionSourceLocale: 'en', positionSourceLocale: 'en',
    }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU', createdAt: '2026-01-01', updatedAt: '2026-09-01',
  };
}
function input(referenceDateIso: string, value = cv()): Client.SummaryV3StyleClientInput {
  return {
    enabled: true, style: 'stronger', operationId: 'fictional-rollover',
    requestId: 'fictional-rollover', cv: value,
    currentRoleExperienceId: value.experience[0]!.isPresent ? 'fictional-entry' : null,
    requestedLocale: 'en', sourceLocale: 'en', jobContextKey: 'synthetic-only',
    referenceDateIso, usageCountBefore: 0, proToken: 'offline-placeholder',
    createdAt: 1_700_000_000_000,
  };
}
function request(g: Graph, referenceDateIso: string, value = cv()) {
  return g.client.audit.request(input(referenceDateIso, value), 'en', 'en');
}
function snapshot(g: Graph, referenceDateIso: string, value = cv()): Snapshot {
  return g.domain.createSummaryV3StyleOperationSnapshot(request(g, referenceDateIso, value));
}
function observe(g: Graph, ref: string, value = cv()) {
  const state = snapshot(g, ref, value);
  let numeric: SummaryStyleSourceNumericMismatchEvidence | null = null;
  const producer = g.server.audit.first(state, (evidence) => { numeric = evidence; });
  return { state, producer, numeric };
}
function writer(input: Server.SummaryV3StyleWriterInput, text: string) {
  return { toolName: input.forcedTool.toolName, input: {
    operationId: input.operationId, snapshotHash: input.snapshotHash,
    manifestHash: input.manifestHash, style: input.style, locale: input.locale,
    units: [{ unitId: 'fictional-unit', text, factIds: input.requiredFacts.map((fact) => fact.id) }],
  } };
}
function evaluator(g: Graph, input: Server.SummaryV3StyleEvaluatorInput) {
  return { toolName: input.forcedTool.toolName, input: {
    operationId: input.operationId, snapshotHash: input.snapshotHash,
    manifestHash: input.manifestHash, style: input.style, locale: input.locale,
    candidateHash: input.candidate.hash,
    candidateUnitHashes: input.candidate.units.map(g.domain.summaryV3StyleCandidateUnitHash),
    phases: Object.fromEntries(g.domain.SUMMARY_V3_STYLE_M5_PHASES.map((phase) => [phase, { status: 'passed', violations: [] }])),
    representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash), missingFactIdHashes: [],
    roleIdentityResolution: 'not_required',
    styleEvidence: { style: 'stronger', strongerPredicateTransformations: 0,
      structuralStrengtheningCount: 0, modifierOnlyTransformationDetected: false,
      repeatedStyleModifierCount: 0, stackedModifierDetected: false,
      unsupportedAuthorityDetected: false, strongerFulfilled: true, noOpDetected: true },
  } };
}
async function run(g: Graph, ref: string) {
  const invocations: Provider.SummaryV3StyleProviderInvocation[] = [];
  const result = await g.provider.executeSummaryV3StyleRoute(request(g, ref), {
    now: () => 1_700_000_000_000, timeoutForPhase: () => 20_000,
    async invoke(invocation) {
      invocations.push(invocation);
      const value = 'candidate' in invocation.input
        ? evaluator(g, invocation.input) : writer(invocation.input, source);
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: value.toolName, input: value.input }] };
    },
  });
  const diagnostic = g.projector.createSummaryStrongerTerminalDiagnostic({
    result, requestId: 'fra1::fictional-rollover', requestedLocale: 'en',
    mode: 'enhance_existing_content',
    httpStatus: result.kind === 'candidate_ready' || result.kind === 'safe_no_op' ? 200 : 422,
  });
  return { result, diagnostic, invocations };
}
describe('Task078 stale CURRENT role duration safety audit (offline; no production repair)', () => {
  it('uses the exact existing click-time UTC client reference, not a second server clock', () => {
    const page = readFileSync(resolve(root, 'src/app/cv-builder/page.tsx'), 'utf8');
    const handler = page.slice(page.indexOf('const handleSummaryV3Style ='), page.indexOf('const handleSummaryV3Style =') + 5500);
    expect(handler).toContain('referenceDateIso: new Date().toISOString().slice(0, 10)');
    expect(request(after, '2026-09-01').manifest.entries[0]!.durationMonths).toBe(8);
    expect(request(after, '2026-10-01').manifest.entries[0]!.durationMonths).toBe(9);
    expect(request(after, '2026-10-31').manifest.entries[0]!.durationMonths).toBe(9);
  });
  it('advances only the existing reference month while preserving start/current/source and request timestamp', () => {
    const value = cv(), original = JSON.stringify(value);
    const first = request(after, '2026-09-01', value), next = request(after, '2026-10-01', value);
    expect(JSON.stringify(value)).toBe(original);
    expect(first.visibleSummary).toBe(next.visibleSummary);
    expect(first.createdAt).toBe(next.createdAt);
    expect(first.manifest.entries[0]!.stableId).toBe(next.manifest.entries[0]!.stableId);
    expect(first.manifest.entries[0]!.employmentState).toBe('present');
    expect(next.manifest.entries[0]!.employmentState).toBe('present');
    expect(next.manifest.entries[0]!.durationMonths - first.manifest.entries[0]!.durationMonths).toBe(1);
  });
  it('reproduces the baseline exact source mismatch and both finite subtype fields after rollover', () => {
    const first = observe(before, '2026-09-01'), next = observe(before, '2026-10-01');
    expect(first.producer).toBeNull();
    expect(next.producer).toBe('source_numeric_membership_mismatch');
    expect(next.numeric).toEqual({ sourceNumericMismatchClass: 'duration_component',
      sourceNumericMismatchComparisonClass: 'exact_manifest_token_absent' });
    expect(after.server.audit.hard(next.state, source)).toMatchObject({
      reason: 'unsupported_claim', predicate: 'unsupported_source_inconsistency',
      sourceFloorFirstProducer: 'source_numeric_membership_mismatch',
    });
  });
  it('executes the actual offline adapter topology: writer/evaluator pass, October terminal remains 422 with zero apply eligibility', async () => {
    const first = await run(before, '2026-09-01'), next = await run(before, '2026-10-01');
    expect(first.result.kind).toBe('safe_no_op');
    expect(first.diagnostic!.httpStatus).toBe(200);
    expect(next.result.kind).toBe('handled_failure');
    expect(next.diagnostic).toMatchObject({
      httpStatus: 422, writerResult: 'accepted', evaluatorAllPhasesPassed: true,
      evaluatorViolationCount: 0, postEvaluatorLocalOwner: 'hard_guard',
      postEvaluatorHardPredicate: 'unsupported_source_inconsistency',
      sourceFloorFirstProducer: 'source_numeric_membership_mismatch',
      sourceNumericMismatchClass: 'duration_component',
      sourceNumericMismatchComparisonClass: 'exact_manifest_token_absent',
      repairAttempted: false, finalApplyEligible: false, usageDecision: 'no_increment',
    });
    expect(next.invocations.map((call) => call.phase)).toEqual(['initial_writer', 'initial_evaluator']);
  });
  it('preserves historical no-repair proof and exact current contracts except authorized legacy remediation', async () => {
    for (const ref of ['2026-09-01', '2026-10-01']) {
      const baseline = await run(before, ref), current = await run(after, ref);
      expect(baseline.result).not.toHaveProperty('remediation');
      if (ref === '2026-09-01') expect(current).toEqual(baseline);
      else {
        // The historical rollover rejection above remains proven. With no
        // trusted relation, today's product preserves rather than refreshes 8.
        expect(baseline.result.kind).toBe('handled_failure');
        expect(current.result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op',
          evidence: { safeNoOpSelected: true, writerAttempts: 1, evaluatorAttempts: 1 } });
        expect(current.diagnostic).toMatchObject({ httpStatus: 200, finalApplyEligible: false, usageDecision: 'no_increment' });
      }
      expect(current.result).not.toHaveProperty('remediation');
      expect(current.result).not.toHaveProperty('tenureOperationFingerprint');
      expect(current.result).not.toHaveProperty('candidate');
      expect(current.invocations).toEqual(baseline.invocations);
      expect(JSON.stringify(current.invocations)).toBe(JSON.stringify(baseline.invocations));
      for (const call of current.invocations) expect(call.input).not.toHaveProperty('trustedTenureClaims');
      expect(snapshot(after, ref)).toEqual(snapshot(before, ref));
      const value = cv(), original = JSON.stringify(value);
      const req = request(after, ref, value);
      expect(req.manifest.entries[0]!.durationMonths).toBe(ref === '2026-09-01' ? 8 : 9);
      const opaque = bindTrustedEmploymentTenureRuntime(createSummaryV3StyleOperationSnapshot(req), { status: 'absent', reason: null, relations: [] });
      expect(trustedEmploymentTenureAuthority(opaque)).toBeNull();
      expect(opaque.sourceSummary).toBe(source);
      expect(summaryDurationCandidateComparison(opaque, source)).not.toBeNull();
      expect(summaryDurationCandidateComparison(opaque, source.replace('8 months', '9 months'))).toBeNull();
      expect(value.summaryEmploymentTenureRelations).toBeUndefined();
      expect(JSON.stringify(value)).toBe(original);
    }
  });
  it('binds an explicitly named fictional duration clause to one stable current entry', () => {
    const state = snapshot(after, '2026-10-01');
    const ids = after.server.audit.entryIds(state, source.split('.')[0]!);
    expect([...ids]).toEqual([state.currentRoleEntryId]);
    expect(state.selectedEntries[0]!.employmentState).toBe('present');
  });
  it('does not guess one owner when two current entries share the same role/employer identity', () => {
    const value = cv();
    value.experience.push({ ...value.experience[0]!, id: 'fictional-duplicate', startDate: '2026-03' });
    const state = snapshot(after, '2026-10-01', value);
    expect(after.server.audit.entryIds(state, source.split('.')[0]!).size).toBe(2);
    expect(after.server.audit.sourceDuration(state)).toBe(true);
  });
  it('does not authorize role A duration merely because role B has that number', () => {
    const value = cv();
    value.experience.push({ ...value.experience[0]!, id: 'fictional-other', position: 'Mentor', company: 'OtherLab', startDate: '2026-02' });
    const state = snapshot(after, '2026-10-01', value);
    expect(state.selectedEntries.map((entry) => entry.durationMonths)).toEqual([9, 8]);
    expect(after.server.audit.sourceDuration(state)).toBe(true);
    expect(after.server.audit.first(state)).toBe('role_local_source_duration_contradiction');
  });
  it('proves generated and user-authored origins are indistinguishable in the current outbound M5 contract', () => {
    const generated = cv(), authored = { ...generated, summaryOrigin: 'user' as const, summaryGenerationContextKey: undefined };
    expect(request(after, '2026-10-01', generated)).toEqual(request(after, '2026-10-01', authored));
    expect(snapshot(after, '2026-10-01', generated)).toEqual(snapshot(after, '2026-10-01', authored));
    expect(after.server.audit.first(snapshot(after, '2026-10-01', authored))).toBe('source_numeric_membership_mismatch');
  });
  it('does not transmit a duration generation timestamp, source start date, or reference date to the server snapshot', () => {
    const req = request(after, '2026-10-01'), state = snapshot(after, '2026-10-01');
    expect(req).not.toHaveProperty('referenceDateIso');
    expect(req).not.toHaveProperty('summaryOrigin');
    expect(req.manifest.entries[0]).not.toHaveProperty('startDate');
    expect(state).not.toHaveProperty('summaryOrigin');
    expect(state).not.toHaveProperty('durationGenerationTimestamp');
  });
  it('proves the supposed later role-local duration validator inspects source, not the replacement candidate', () => {
    const state = snapshot(after, '2026-10-01');
    expect(after.server.audit.sourceDuration(state)).toBe(true);
    expect(after.server.audit.sourceDuration.length).toBe(1);
    const refreshed = cv(); refreshed.summary = source.replace('8 months', '9 months');
    expect(after.server.audit.sourceDuration(snapshot(after, '2026-10-01', refreshed))).toBe(false);
  });
  it('proves remaining late candidate checks do not independently reject retention of the stale duration', () => {
    const state = snapshot(after, '2026-10-01');
    expect(after.server.audit.numeric(state, source)).toBe(false);
    expect(after.domain.inspectSummaryV3StyleCandidatePreservesLocks(state, source).preserved).toBe(true);
    expect(state.entityLocks.filter((lock) => lock.kind === 'duration')).toHaveLength(0);
    expect(after.server.audit.remainingHardWithoutSourceGate(state, source)).toEqual({ reason: null, predicate: null });
    // The unchanged production path remains fail-closed, not vulnerable to this
    // counterfactual. This assertion records why bypassing it is NOT authorized.
    expect(after.server.audit.hard(state, source).reason).toBe('unsupported_claim');
  });
  it('does not falsely claim that existing late candidate rules admit the correct refreshed duration', () => {
    const state = snapshot(after, '2026-10-01');
    expect(after.server.audit.numeric(state, source.replace('8 months', '9 months'))).toBe(true);
    const input = after.server.audit.writer(state), output = writer(input, source.replace('8 months', '9 months'));
    expect(after.server.audit.parseWriter({ ...output, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1 }, state))
      .toMatchObject({ ok: false, reason: 'lost_source_fact' });
  });
  it('retains rejection of an invented current-role candidate duration', () => {
    const state = snapshot(after, '2026-10-01');
    expect(after.server.audit.numeric(state, source.replace('8 months', '77 months'))).toBe(true);
  });
  it('keeps completed-role duration invariant when only the clock advances', () => {
    const value = cv();
    value.experience[0]!.isPresent = false; value.experience[0]!.endDate = '2026-09';
    value.summary = 'SyntheticPerson checks goods for about 8 months.';
    expect(request(after, '2026-09-01', value).manifest.entries[0]!.durationMonths).toBe(8);
    expect(request(after, '2026-10-01', value).manifest.entries[0]!.durationMonths).toBe(8);
    value.summary = value.summary.replace('8 months', '77 months');
    expect(observe(after, '2026-10-01', value).producer).toBe('source_numeric_membership_mismatch');
  });
  it('keeps exact CURRENT match unchanged in October', () => {
    const value = cv(); value.summary = source.replace('8 months', '9 months');
    expect(observe(after, '2026-10-01', value).producer).toBeNull();
    expect(snapshot(after, '2026-10-01', value)).toEqual(snapshot(before, '2026-10-01', value));
  });
  it.each([
    ['impossible duration', '77 months'],
    ['wrong unit', '8 years'],
    ['negative duration', '-8 months'],
  ])('keeps %s fail closed without a production repair', (_name, duration) => {
    const value = cv(); value.summary = source.replace('8 months', duration);
    expect(observe(after, '2026-10-01', value).producer).not.toBeNull();
  });
  it('does not create authority from a future start date', () => {
    const value = cv(); value.experience[0]!.startDate = '2027-01';
    expect(request(after, '2026-10-01', value).manifest.entries[0]!.durationMonths).toBe(0);
    expect(observe(after, '2026-10-01', value).producer).toBe('source_numeric_membership_mismatch');
  });
  it('keeps plain integer, percent, currency, technical and dotted-calendar mismatch controls unchanged', () => {
    // Preserve the existing Task075 raw request control, rather than using the
    // client envelope that independently protects a recognized calendar date.
    for (const claim of ['99 goods', '12.5% of goods', '$99', 'v2.4', 'goods on 01.05.2020']) {
      const req: Domain.SummaryV3StyleRequest = {
        enabled: true, operation: 'summary_stronger', operationId: 'fictional-control', style: 'stronger',
        requestedLocale: 'en', sourceLocale: 'en',
        visibleSummary: (claim.startsWith('goods on') ? 'She  checks ' : 'She checks ') + claim + '.',
        protectedEntities: [], createdAt: 1_700_000_000_000,
        manifest: { manifestId: 'fictional-controls', contextId: 'fictional-only', sourceLocale: 'en', currentRoleEntryId: 'entry',
          entries: [{ stableId: 'entry', role: 'Clerk', employer: 'FictionalLab', employmentState: 'present',
            durationMonths: 24, facts: [{ id: 'duty', text: 'She checks goods.' }] }] },
      };
      const original = before.domain.createSummaryV3StyleOperationSnapshot(req);
      const current = after.domain.createSummaryV3StyleOperationSnapshot(req);
      expect(current).toEqual(original);
      expect(after.server.audit.first(current), claim).toBe(before.server.audit.first(original));
      expect(after.server.audit.first(current), claim).toBe('source_numeric_membership_mismatch');
    }
  });
  it('does not cross-exempt a second same-valued metric by matching a valid duration', () => {
    const value = cv();
    value.summary = source.replace('8 months', '9 months').replace('checks goods', 'checks 9 goods');
    const state = snapshot(after, '2026-10-01', value);
    expect(after.server.audit.numeric(state, value.summary.replace('9 goods', '10 goods'))).toBe(true);
  });
  it('uses UTC completed month differences across nonphysical years/months, without hard-coded runtime September/October behavior', () => {
    const entry = { startDate: '2031-11', endDate: '', isPresent: true };
    expect(after.duration.computeExperienceDuration(entry, '2032-01-01').totalMonths).toBe(2);
    expect(after.duration.computeExperienceDuration(entry, '2032-02-01').totalMonths).toBe(3);
    expect(after.duration.referenceDateToYearMonth(new Date('2032-02-01T00:15:00Z'))).toBe('2032-02');
  });
  it('pins historical Task078 bytes, current ordered guards and unchanged duration CRLF representation', () => {
    assertCurrentTask084SourceFloorContract();
    for (const relative of [
      'src/lib/ai-core-v3/summary-style-m5-server.ts',
      'src/lib/ai-core-v3/summary-style-m5.ts',
      'src/lib/ai-core-v3/summary-style-m5-client.ts',
      'src/lib/ai-core-v3/summary-style-m5-local-observability.ts',
      'src/lib/ai-core-v3/summary-style-m5-provider.ts',
      'src/lib/ai-core-v3/summary-v3-production-observability.ts',
      'src/lib/cv-experience-duration.ts',
      'src/app/cv-builder/page.tsx',
    ]) {
      const disk = readFileSync(resolve(root, relative));
      const baseline = execFileSync('git', ['show', BASELINE + ':' + relative], { cwd: root, maxBuffer: 20_000_000 });
      if (relative === 'src/lib/cv-experience-duration.ts') {
        // This exact 900-CRLF checkout representation existed before Task078.
        // Pin its physical bytes; do not rewrite the file or hide source drift.
        expect(disk.length).toBe(42226);
        expect(createHash('sha256').update(disk).digest('hex'))
          .toBe('1a3acca13195d30b9b6717a609921ed318a955859b412c393f3be163b7e3f962');
        expect((disk.toString('utf8').match(/\r\n/g) || []).length).toBe(900);
        expect(disk.toString('utf8').replaceAll('\r\n', '\n')).toBe(baseline.toString('utf8'));
      } else {
        // Historical no-edit evidence remains immutable. Task084 is allowed
        // to supersede those bytes; actual current parity is checked above.
        expect(createHash('sha256').update(baseline).digest('hex')).toBe(historicalSourcePins[relative]);
        expect(historicalPreTask084Source(relative)).toBe(baseline.toString('utf8'));
        if (relative.includes('observability')) expect(disk.equals(baseline), relative).toBe(true);
      }
    }
  });
});

// After the reusable harness boundary so Task082-084 extraction stays unchanged.
import { assertCurrentTask084SourceFloorContract,
  historicalPreTask084Source, historicalSourcePins } from './fixtures/task085-historical-current-contract';
import { createSummaryV3StyleOperationSnapshot } from '../summary-style-m5';
import { bindTrustedEmploymentTenureRuntime, summaryDurationCandidateComparison,
  trustedEmploymentTenureAuthority } from '../summary-trusted-tenure-runtime';
