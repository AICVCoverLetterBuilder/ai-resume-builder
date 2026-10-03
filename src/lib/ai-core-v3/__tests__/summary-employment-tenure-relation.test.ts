import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConfirmedEmploymentTenureRelation as confirm,
  prepareSummaryEmploymentTenureServerRequest as prepare,
  projectSummaryEmploymentTenureRequest as project,
  pruneSummaryEmploymentTenureRelations as prune,
  resolveSummaryEmploymentTenureRelations as validate,
  type SummaryEmploymentTenureRelation as Relation,
  type SummaryTenureM5Request,
} from '../summary-employment-tenure-relation';
import { findExactDurationMeasurements as find } from '../exact-duration-measurement';
import { hashSummaryV3StyleValue as hash, createSummaryV3StyleOperationSnapshot } from '../summary-style-m5';
import { bindTrustedEmploymentTenureRuntime, summaryDurationCandidateComparison,
  trustedEmploymentTenureAuthority } from '../summary-trusted-tenure-runtime';
import { CV_DRAFT_STORAGE_KEY, loadCvDraft, saveCvDraft } from '../../draft-storage';
import { buildCanonicalSnapshotFromCv } from '../../cv-canonical-snapshot';
import type * as Domain from '../summary-style-m5';
import type * as Server from '../summary-style-m5-server';
import type * as Provider from '../summary-style-m5-provider';
import type { CVData } from '../../types';

// Immutable baseline graph loaded from Git, candidate graph from disk. The
// retained harness is reused in memory, never rewritten and never networked.
type Graph = {
  domain: typeof Domain;
  server: typeof Server & { audit: {
    first: (snapshot: Domain.SummaryV3StyleOperationSnapshot) => string | null;
    hard: (snapshot: Domain.SummaryV3StyleOperationSnapshot, text: string) => unknown;
    writer: (snapshot: Domain.SummaryV3StyleOperationSnapshot) => Server.SummaryV3StyleWriterInput;
  } };
  provider: typeof Provider;
};
type Harness = {
  before: Graph; after: Graph; cv: () => CVData;
  request: (graph: Graph, reference: string, cv?: CVData) => Domain.SummaryV3StyleRequest;
  writer: (input: Server.SummaryV3StyleWriterInput, text: string) => { toolName: string; input: unknown };
  evaluator: (graph: Graph, input: Server.SummaryV3StyleEvaluatorInput) => { toolName: string; input: unknown };
};
const root = process.cwd(), requireLocal = createRequire(resolve(root, 'package.json'));
const retained = readFileSync(resolve(root,
  'src/lib/ai-core-v3/__tests__/summary-current-role-stale-duration-reconciliation.test.ts'), 'utf8');
const boundary = retained.indexOf("describe('Task078");
if (boundary < 0) throw new Error('Retained offline harness missing');
const compiled = ts.transpileModule(retained.slice(0, boundary), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;
const loaded: { exports: { task083?: Harness } } = { exports: {} };
new Function('require', 'module', 'exports', compiled + '\nexports.task083={before,after,cv,request,writer,evaluator};\n')(
  (id: string) => id === 'vitest' ? {} : requireLocal(id), loaded, loaded.exports);
const h = loaded.exports.task083!;

function context(cv: CVData) {
  return { cvId: cv.id, summary: cv.summary, experienceStableIds: cv.experience.map((entry) => entry.id) };
}
function bound(cv = h.cv(), selected = cv.experience[0]!.id, index = 0) {
  const result = confirm({ confirmation: 'employment_tenure', cv,
    measurement: find(cv.summary)[index]!, explicitlySelectedExperienceStableId: selected });
  if (result.status !== 'created') throw new Error('Synthetic confirmation failed: ' + result.status);
  return { ...cv, summaryEmploymentTenureRelations: result.relations };
}
function request(cv: CVData, reference = '2026-10-01') {
  return project(h.request(h.after, reference, cv), cv);
}
function relation(cv: CVData = bound()): Relation { return cv.summaryEmploymentTenureRelations![0]!; }
function wire(value: SummaryTenureM5Request): SummaryTenureM5Request {
  return JSON.parse(JSON.stringify(value)) as SummaryTenureM5Request;
}

describe('Task083 creation / finite model / no inference', () => {
  it('stores exactly the eight minimal identity fields without duplicate content/value/date/locale', () => {
    expect(Object.keys(relation()).sort()).toEqual([
      'version', 'relationKind', 'cvId', 'experienceStableId', 'summaryHash',
      'durationSpanStart', 'durationSpanEnd', 'durationSpanHash',
    ].sort());
    expect(relation().version).toBe(1);
    expect(relation().relationKind).toBe('employment_tenure');
  });
  it('explicit call binds a stale value without comparing it with current duration', () => {
    const cv = bound(), req = request(cv);
    expect(find(cv.summary)[0]!.totalMonths).toBe(8);
    expect(req.manifest.entries[0]!.durationMonths).toBe(9);
    expect(prepare(req).resolution.status).toBe('valid');
  });
  it.each(['', 'missing', ' fictional-entry ', undefined, null])('requires an explicit existing ID, never a default: %s', (selected) => {
    const cv = h.cv();
    const result = confirm({ confirmation: 'employment_tenure', cv, measurement: find(cv.summary)[0]!,
      explicitlySelectedExperienceStableId: selected as string });
    expect(result.status).toBe('invalid');
    expect(cv.summaryEmploymentTenureRelations).toBeUndefined();
  });
  it.each([undefined, null, false, 'inferred', 'provider_confirmed'])('requires the explicit confirmation discriminant: %s', (confirmation) => {
    const cv = h.cv();
    expect(confirm({ confirmation: confirmation as 'employment_tenure', cv, measurement: find(cv.summary)[0]!,
      explicitlySelectedExperienceStableId: cv.experience[0]!.id }).status).toBe('invalid');
  });
  it('negative confirmation returns no relation and leaves existing CV byte-identical', () => {
    const cv = bound(), before = JSON.stringify(cv);
    expect(confirm({ confirmation: 'not_employment_tenure', cv, measurement: find(cv.summary)[0]!,
      explicitlySelectedExperienceStableId: cv.experience[0]!.id })).toEqual({ status: 'declined' });
    expect(JSON.stringify(cv)).toBe(before);
  });
  it.each(['single_matching_entry', 'role_employer_prose', 'provider_proposed_id'])('does not infer from %s on use/projection', () => {
    const cv = h.cv(), before = JSON.stringify(cv);
    expect(validate(undefined, context(cv)).relations).toEqual([]);
    expect(project(h.request(h.after, '2026-10-01', cv), cv).summaryEmploymentTenure).toBeUndefined();
    expect(JSON.stringify(cv)).toBe(before);
  });
  it('project duration is bindable ONLY as an explicit user assertion; no semantic NLP is added', () => {
    const cv = { ...h.cv(), summary: 'A project lasted 8 months.' };
    expect(prune(cv).summaryEmploymentTenureRelations).toBeUndefined();
    expect(validate(bound(cv).summaryEmploymentTenureRelations, context(cv)).status).toBe('valid');
  });
  it.each(['9 meseci', '9 months', '९ महीने', '٩ أشهر', '9か月', '9 Monaten',
    '9 mois', '9 meses', '9 mesi', '9 mjeseci', '9 meses', '9 месяцев'])('one locale-neutral relation for %s', (surface) => {
    const cv = { ...h.cv(), summary: `(${surface})` };
    expect(validate(bound(cv).summaryEmploymentTenureRelations, context(cv)).status).toBe('valid');
  });
  it('UTF-16 span remains original across surrogate pairs and non-normalized whitespace', () => {
    const cv = bound({ ...h.cv(), summary: '🙂 (8\tmonths).' });
    const r = relation(cv);
    expect(cv.summary.slice(r.durationSpanStart, r.durationSpanEnd)).toBe('8\tmonths');
    expect(r.durationSpanStart).toBe(4);
    expect(validate(cv.summaryEmploymentTenureRelations, context(cv)).status).toBe('valid');
  });
  it.each(['8 monthsXYZ', '-8 months', '8.5 months', '8 weeks'])('cannot confirm contaminated/non-exact %s', (summary) => {
    const cv = { ...h.cv(), summary };
    expect(confirm({ confirmation: 'employment_tenure', cv, measurement: { start: 0, end: 8, totalMonths: 8 },
      explicitlySelectedExperienceStableId: cv.experience[0]!.id }).status).toBe('invalid');
  });
  it('cannot confirm a fabricated parser numeric result', () => {
    const cv = h.cv(), measurement = find(cv.summary)[0]!;
    expect(confirm({ confirmation: 'employment_tenure', cv, measurement: { ...measurement, totalMonths: 99 },
      explicitlySelectedExperienceStableId: cv.experience[0]!.id }).status).toBe('invalid');
  });
});

const tamper: readonly [string, (r: Relation) => unknown][] = [
  ['forged Experience', (r) => ({ ...r, experienceStableId: 'forged-entry' })],
  ['stale Summary hash', (r) => ({ ...r, summaryHash: hash('another Summary') })],
  ['copied CV scope', (r) => ({ ...r, cvId: 'another-cv' })],
  ['out-of-range start', (r) => ({ ...r, durationSpanStart: -1 })],
  ['out-of-range end', (r) => ({ ...r, durationSpanEnd: 12_001 })],
  ['reverse span', (r) => ({ ...r, durationSpanStart: r.durationSpanEnd + 1 })],
  ['zero-length span', (r) => ({ ...r, durationSpanEnd: r.durationSpanStart })],
  ['fractional coordinate', (r) => ({ ...r, durationSpanStart: 1.5 })],
  ['partial token', (r) => ({ ...r, durationSpanEnd: r.durationSpanEnd - 1,
    durationSpanHash: hash(h.cv().summary.slice(r.durationSpanStart, r.durationSpanEnd - 1)) })],
  ['numeric-only span', (r) => ({ ...r, durationSpanEnd: r.durationSpanStart + 1, durationSpanHash: hash('8') })],
  ['span hash', (r) => ({ ...r, durationSpanHash: hash('9 months') })],
  ['unsupported kind', (r) => ({ ...r, relationKind: 'project_duration' })],
  ['future version', (r) => ({ ...r, version: 2 })],
  ['missing field', (r) => { const { cvId: _scope, ...rest } = r; return rest; }],
  ['extra raw field', (r) => ({ ...r, rawSummary: 'synthetic unrelated text' })],
  ['malformed hash', (r) => ({ ...r, summaryHash: 'arbitrary' })],
];
describe('Task083 integrity and independent SERVER tampering POLICY 2', () => {
  it.each(tamper)('client authority rejects %s', (_name, alter) => {
    const cv = bound();
    expect(validate([alter(relation(cv))], context(cv))).toMatchObject({ status: 'invalid', relations: [] });
  });
  it.each(tamper)('SERVER independently rejects %s, keeps baseline content request', (_name, alter) => {
    const cv = bound(), base = h.request(h.after, '2026-10-01', cv), req = request(cv);
    const forged = { ...req, summaryEmploymentTenure: { cvId: cv.id, relations: [alter(relation(cv))] } };
    const result = prepare(wire(forged as SummaryTenureM5Request));
    expect(result.resolution).toMatchObject({ status: 'invalid', relations: [] });
    expect(result.contentRequest).toEqual(base);
  });
  it.each([null, {}, 'text', Array(33).fill(relation())])('bounded invalid collection rejected: %s', (relations) => {
    const cv = bound(), req = request(cv);
    const altered = { ...req, summaryEmploymentTenure: { cvId: cv.id, relations } };
    expect(prepare(wire(altered as SummaryTenureM5Request)).resolution).toMatchObject({ status: 'invalid', relations: [] });
  });
  it('manifest raw/hashed IDs must agree and cannot rebind through array position', () => {
    const cv = bound(), req = request(cv);
    const changed = { ...req, manifest: { ...req.manifest,
      entries: req.manifest.entries.map((entry) => ({ ...entry, experienceStableId: 'forged' })) } };
    expect(prepare(changed).resolution.reason).toBe('manifest_identity_mismatch');
  });
  it('missing raw ID cannot be filled from a hashed ID or current/latest position', () => {
    const cv = bound(), req = request(cv), base = h.request(h.after, '2026-10-01', cv);
    expect(prepare({ ...base, summaryEmploymentTenure: req.summaryEmploymentTenure }).resolution.status).toBe('invalid');
  });
  it('deleted entry fails on both canonical use and immutable server manifest', () => {
    const cv = bound(), req = request(cv), deleted = { ...cv, experience: [] };
    expect(prune(deleted).summaryEmploymentTenureRelations).toEqual([]);
    expect(prepare({ ...req, manifest: { ...req.manifest, currentRoleEntryId: null, entries: [] } }).resolution.relations).toEqual([]);
  });
  it.each(['9 months', '8 years', '8  months'])('changed source number/unit/bytes invalidates old relation: %s', (surface) => {
    const cv = bound(), altered = { ...cv, summary: cv.summary.replace('8 months', surface) };
    expect(validate(cv.summaryEmploymentTenureRelations, context(altered)).reason).toBe('summary_mismatch');
    const req = request(cv);
    expect(prepare({ ...req, visibleSummary: altered.summary }).resolution.relations).toEqual([]);
  });
  it('identical duplicates canonicalize to one independently of insertion order', () => {
    const cv = bound(), r = relation(cv);
    expect(validate([r, { ...r }], context(cv)).relations).toEqual([r]);
    expect(prepare({ ...request(cv), summaryEmploymentTenure: { cvId: cv.id, relations: [r, r] } }).resolution.relations).toEqual([r]);
  });
  it('multiple measurements canonicalize by original coordinate, never array position', () => {
    const cv = { ...h.cv(), summary: 'A project lasted 1 year. A role lasted 8 months.' };
    const first = bound(cv, cv.experience[0]!.id, 1);
    const both = bound(first, cv.experience[0]!.id, 0);
    expect(both.summaryEmploymentTenureRelations!.map((r) => r.durationSpanStart)).toEqual(find(cv.summary).map((m) => m.start));
    expect(validate([...both.summaryEmploymentTenureRelations!].reverse(), context(cv)).relations).toEqual(both.summaryEmploymentTenureRelations);
  });
  it('conflicting same-span ownership invalidates whole set, never first or latest', () => {
    const cv = bound(), r = relation(cv), second = { ...cv.experience[0]!, id: 'second-entry' };
    const two = { ...cv, experience: [...cv.experience, second] }, other = { ...r, experienceStableId: second.id };
    for (const values of [[r, other], [other, r]]) {
      expect(validate(values, context(two)).reason).toBe('conflicting_ownership');
      const req = project(h.request(h.after, '2026-10-01', two), two);
      expect(prepare({ ...req, summaryEmploymentTenure: { cvId: cv.id, relations: values } }).resolution.reason).toBe('conflicting_ownership');
    }
    expect(confirm({ confirmation: 'employment_tenure', cv: two, measurement: find(two.summary)[0]!,
      explicitlySelectedExperienceStableId: second.id })).toMatchObject({ status: 'invalid', reason: 'conflicting_ownership' });
  });
  it('ambiguous duplicate stable CV IDs fail closed instead of guessing an entry', () => {
    const cv = bound();
    expect(validate(cv.summaryEmploymentTenureRelations, context({ ...cv, experience: [...cv.experience, ...cv.experience] })).status).toBe('invalid');
  });
  it('immutable resolution is detached from mutable request metadata', () => {
    const cv = bound(), req = wire(request(cv)), result = prepare(req);
    (req.summaryEmploymentTenure!.relations as Relation[]).length = 0;
    expect(result.resolution.relations).toHaveLength(1);
    expect(Object.isFrozen(result.resolution.relations[0])).toBe(true);
    expect(Object.isFrozen(result.contentRequest.manifest)).toBe(true);
  });
});

describe('Task083 invalidation, stable identity and empty legacy default', () => {
  it.each(['startDate', 'endDate', 'isPresent', 'description', 'position', 'company'] as const)('same durable ID survives %s edit', (field) => {
    const cv = bound(), changed = { ...cv, experience: cv.experience.map((entry) => ({ ...entry,
      [field]: field === 'isPresent' ? false : 'changed synthetic field' })) };
    expect(validate(cv.summaryEmploymentTenureRelations, context(changed)).status).toBe('valid');
  });
  it.each(['2026-09-01', '2026-10-01', '2027-02-01'])('calendar %s does not change ownership integrity', (reference) => {
    const cv = bound();
    expect(prepare(request(cv, reference)).resolution.relations).toEqual(cv.summaryEmploymentTenureRelations);
  });
  it.each([
    { startDate: '2025-12' }, { endDate: '2026-06', isPresent: false }, { isPresent: false },
  ])('server ownership also survives same-entry structured-date edit %j', (edit) => {
    const cv = bound(), changed = { ...cv, experience: cv.experience.map((entry) => ({ ...entry, ...edit })) };
    expect(prepare(request(changed)).resolution.relations).toEqual(cv.summaryEmploymentTenureRelations);
  });
  it('reorder keeps ownership; replacing deleted entry with different ID cannot rebind', () => {
    const cv = bound(), second = { ...cv.experience[0]!, id: 'second-entry' };
    expect(validate(cv.summaryEmploymentTenureRelations, context({ ...cv, experience: [second, ...cv.experience] })).status).toBe('valid');
    expect(validate(cv.summaryEmploymentTenureRelations, context({ ...cv, experience: [second] })).reason).toBe('experience_missing');
  });
  it('manual Summary edit invalidates even whitespace-only change; canonical use prunes without mutating input', () => {
    const cv = { ...bound(), summary: h.cv().summary + ' ' }, original = JSON.stringify(cv);
    expect(prune(cv).summaryEmploymentTenureRelations).toEqual([]);
    expect(JSON.stringify(cv)).toBe(original);
  });
  it('copied CV identity invalidates persisted relation', () => {
    expect(prune({ ...bound(), id: 'another-cv' }).summaryEmploymentTenureRelations).toEqual([]);
  });
  it('absent/empty metadata never scans Summary or auto-backfills', () => {
    const cv = h.cv();
    expect(prune(cv)).toBe(cv);
    expect(validate(undefined, context(cv)).relations).toEqual([]);
    expect(validate([], context(cv)).relations).toEqual([]);
  });
  it('unrelated canonical content hash does not change for unused relation metadata', () => {
    const cv = h.cv();
    const options = { canonicalLocale: 'en' as const, createdFrom: 'user_structured_input' as const };
    expect(buildCanonicalSnapshotFromCv(bound(cv), options)).toEqual(buildCanonicalSnapshotFromCv(cv, options));
  });
});

describe('Task083 actual existing CV draft persistence / reload owner', () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each(['true', 'false'])('valid relation survives normal save/reload under existing CV profile %s', (flag) => {
    vi.stubEnv('NEXT_PUBLIC_CV_SIMPLE_V1', flag);
    // Let the existing content migration establish its canonical Summary FIRST.
    expect(saveCvDraft({ cv: { ...h.cv(), summaryOrigin: 'user' }, savedAt: 'synthetic' })).toBe(true);
    const canonical = loadCvDraft()!.cv, cv = bound(canonical), r = relation(cv);
    expect(saveCvDraft({ cv, savedAt: 'synthetic' })).toBe(true);
    const loadedCv = loadCvDraft()!.cv;
    expect(loadedCv.id).toBe(cv.id);
    expect(loadedCv.experience[0]!.id).toBe(r.experienceStableId);
    expect(loadedCv.summaryEmploymentTenureRelations).toEqual([r]);
    expect([...storage.keys()]).toEqual([CV_DRAFT_STORAGE_KEY]);
  });
  it.each(['true', 'false'])('legacy absent field loads as empty logical set without inference %s', (flag) => {
    vi.stubEnv('NEXT_PUBLIC_CV_SIMPLE_V1', flag);
    expect(saveCvDraft({ cv: h.cv(), savedAt: 'synthetic' })).toBe(true);
    const cv = loadCvDraft()!.cv;
    expect(cv.summaryEmploymentTenureRelations).toBeUndefined();
    expect(validate(cv.summaryEmploymentTenureRelations, context(cv)).relations).toEqual([]);
  });
  it('invalid relation is physically pruned on canonical reload, not a second side-channel', () => {
    vi.stubEnv('NEXT_PUBLIC_CV_SIMPLE_V1', 'true');
    const cv = { ...bound(), summary: 'Changed Summary.' };
    storage.set(CV_DRAFT_STORAGE_KEY, JSON.stringify({ cv, savedAt: 'synthetic' }));
    expect(loadCvDraft()!.cv.summaryEmploymentTenureRelations).toEqual([]);
    expect(JSON.parse(storage.get(CV_DRAFT_STORAGE_KEY)!).cv.summaryEmploymentTenureRelations).toEqual([]);
    expect([...storage.keys()]).toEqual([CV_DRAFT_STORAGE_KEY]);
  });
  it('unknown future persisted version prunes to empty and cannot backfill on repeated reload', () => {
    vi.stubEnv('NEXT_PUBLIC_CV_SIMPLE_V1', 'true');
    const cv = bound();
    storage.set(CV_DRAFT_STORAGE_KEY, JSON.stringify({ cv: { ...cv,
      summaryEmploymentTenureRelations: [{ ...relation(cv), version: 2 }] }, savedAt: 'synthetic' }));
    expect(loadCvDraft()!.cv.summaryEmploymentTenureRelations).toEqual([]);
    expect(loadCvDraft()!.cv.summaryEmploymentTenureRelations).toEqual([]);
    expect(loadCvDraft()!.cv.experience[0]!.id).toBe(cv.experience[0]!.id);
  });
});

async function execute(graph: Graph, req: Domain.SummaryV3StyleRequest) {
  const inputs: Provider.SummaryV3StyleProviderInvocation[] = [];
  const result = await graph.provider.executeSummaryV3StyleRoute(req, {
    now: () => 1_700_000_000_000, timeoutForPhase: () => 20_000,
    async invoke(invocation) {
      inputs.push(invocation);
      const tool = 'candidate' in invocation.input
        ? h.evaluator(graph, invocation.input) : h.writer(invocation.input, req.visibleSummary);
      return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: tool.toolName, input: tool.input }] };
    },
  });
  return { result, inputs };
}
describe('Task083 immutable baseline/candidate request/provider/decision parity', () => {
  it.each(['absent', 'empty', 'valid', 'invalid'] as const)('optional %s metadata preserves exact base content request', (kind) => {
    const cv = kind === 'absent' || kind === 'empty' ? h.cv() : bound();
    const base = h.request(h.before, '2026-10-01', cv);
    let req = request(cv);
    if (kind === 'empty') req = { ...req, summaryEmploymentTenure: { cvId: cv.id, relations: [] } };
    if (kind === 'invalid') req = { ...req, summaryEmploymentTenure: { cvId: cv.id,
      relations: [{ ...relation(cv), version: 2 } as unknown as Relation] } };
    expect(prepare(req).contentRequest).toEqual(base);
    if (kind === 'absent') expect(project(base, cv)).toBe(base);
  });
  it.each(['2026-09-01', '2026-10-01', '2027-02-01'])('unused relation leaves snapshot/source-floor/source-lock/candidate inputs identical at %s', (reference) => {
    const cv = bound(), base = h.before.domain.createSummaryV3StyleOperationSnapshot(h.request(h.before, reference, cv));
    const candidate = h.after.domain.createSummaryV3StyleOperationSnapshot(prepare(request(cv, reference)).contentRequest);
    expect(candidate).toEqual(base);
    expect(h.after.server.audit.first(candidate)).toBe(h.before.server.audit.first(base));
    expect(h.after.server.audit.writer(candidate)).toEqual(h.before.server.audit.writer(base));
    expect(h.after.server.audit.hard(candidate, cv.summary)).toEqual(h.before.server.audit.hard(base, cv.summary));
  });
  it.each(['valid', 'invalid', 'empty', 'absent'] as const)('actual offline server/route %s metadata preserves unauthorized behavior and admits only the exact Task084 delta', async (kind) => {
    for (const reference of ['2026-09-01', '2026-10-01']) {
      const cv = bound(), base = h.request(h.before, reference, cv);
      const originalCv = JSON.stringify(cv);
      let req = request(cv, reference);
      if (kind === 'invalid') req = { ...req, summaryEmploymentTenure: { cvId: cv.id,
        relations: [{ ...relation(cv), experienceStableId: 'forged' }] } };
      if (kind === 'empty') req = { ...req, summaryEmploymentTenure: { cvId: cv.id, relations: [] } };
      if (kind === 'absent') req = base;
      const prior = await execute(h.before, base), current = await execute(h.after, req);
      const resolution = prepare(req).resolution;
      if (kind === 'valid') {
        const snapshot = h.before.domain.createSummaryV3StyleOperationSnapshot(base);
        const fingerprint = hash(JSON.stringify({ summaryHash: snapshot.sourceSummaryHash,
          manifestHash: snapshot.manifestHash, relations: resolution.relations }));
        if (reference === '2026-09-01') {
          // Current-valid: local apply identity ONLY. Provider envelope, prompts,
          // tools, counts and order remain byte-exact; no refresh permission.
          const expected = { ...prior, result: { ...prior.result, tenureOperationFingerprint: fingerprint } };
          expect(current).toEqual(expected);
          expect(JSON.stringify(current.inputs)).toBe(JSON.stringify(prior.inputs));
          expect(current.inputs.map((call) => call.role)).toEqual(['writer', 'evaluator']);
        } else {
          // Stale CURRENT: ONLY these three guidance fields and the operation
          // fingerprint may change the writer invocation. The unchanged stale
          // candidate must fail before evaluator, not become safe no-op/success.
          expect(prior.inputs.map((call) => call.role)).toEqual(['writer', 'evaluator']);
          expect(current.inputs).toHaveLength(1);
          const historicalWriter = prior.inputs[0]!;
          if ('candidate' in historicalWriter.input) throw new Error('Expected writer boundary');
          const guidance = [{ sourceUnitIndex: 0, sourceUnitHash: snapshot.sourceUnits[0]!.hash,
            currentDurationMonths: snapshot.selectedEntries[0]!.durationMonths }];
          const { forcedTool, ...historicalInput } = historicalWriter.input;
          const expectedInput = { ...historicalInput,
            snapshotHash: hash(`${snapshot.snapshotHash}:trusted-tenure:${fingerprint}`),
            trustedTenureClaims: guidance, forcedTool };
          const tenureInstruction = 'TRUSTED TENURE CLAIM ONLY: preserve the identified source unit verbatim outside its exact tenure measurement. Refresh that complete measurement to currentDurationMonths using locale-native grammar; do not move/drop the claim. Other duties may be strengthened under the existing contract. A stale unchanged measurement is not a safe no-op. Local validation, not your output, owns this relation.';
          const oldInputText = JSON.stringify(historicalWriter.input);
          expect(historicalWriter.prompt.endsWith(oldInputText)).toBe(true);
          const expectedInvocation = { ...historicalWriter, input: expectedInput,
            prompt: historicalWriter.prompt.slice(0, -oldInputText.length)
              + tenureInstruction + '\n\n' + JSON.stringify(expectedInput) };
          expect(current.inputs).toEqual([expectedInvocation]);
          expect(JSON.stringify(current.inputs)).toBe(JSON.stringify([expectedInvocation]));
          expect(current.result.kind).toBe('handled_failure');
          if (current.result.kind !== 'handled_failure') throw new Error('Stale candidate accepted');
          expect(current.result.typedReason).toBe('lost_source_fact');
          expect(current.result.evidence.writerOutputContractFailureClass).toBe('candidate_source_floor');
          expect(current.result.tenureOperationFingerprint).toBe(fingerprint);
          expect(current.result.evidence.writerAttempts).toBe(1);
          expect(current.result.evidence.evaluatorAttempts).toBe(0);
          expect(current.result.evidence.safeNoOpSelected).toBe(false);
          expect(current.result).not.toHaveProperty('candidate');
          expect(current.result).not.toHaveProperty('remediation');
        }
      } else {
        // Discarded/absent metadata grants no employment owner or refresh.
        // Only the deliberate unbound stale-duration terminal is superseded.
        expect(resolution.relations).toEqual([]);
        if (reference === '2026-09-01') expect(current).toEqual(prior);
        else {
          expect(prior.result.kind).toBe('handled_failure');
          expect(current.result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op',
            evidence: { safeNoOpSelected: true, writerAttempts: 1, evaluatorAttempts: 1 } });
        }
        const opaque = bindTrustedEmploymentTenureRuntime(createSummaryV3StyleOperationSnapshot(prepare(req).contentRequest), resolution);
        expect(trustedEmploymentTenureAuthority(opaque)).toBeNull();
        expect(opaque.sourceSummary).toBe(cv.summary);
        expect(summaryDurationCandidateComparison(opaque, cv.summary)).not.toBeNull();
        expect(summaryDurationCandidateComparison(opaque, cv.summary.replace('8 months', '9 months'))).toBeNull();
        expect(JSON.stringify(current.inputs)).toBe(JSON.stringify(prior.inputs));
        expect(current.inputs.map((call) => call.role)).toEqual(['writer', 'evaluator']);
        expect(current.result).not.toHaveProperty('tenureOperationFingerprint');
        expect(current.result).not.toHaveProperty('remediation');
        expect(current.result).not.toHaveProperty('candidate');
        for (const call of current.inputs) expect(call.input).not.toHaveProperty('trustedTenureClaims');
      }
      expect(JSON.stringify(current.inputs)).not.toContain('summaryEmploymentTenure');
      expect(JSON.stringify(current.inputs)).not.toContain('durationSpanHash');
      expect(JSON.stringify(cv)).toBe(originalCv);
    }
  });
  it('closed valid relation preserves exact provider and result parity with no Task084 CURRENT authority', async () => {
    const cv = bound({ ...h.cv(), experience: h.cv().experience.map((entry) => ({
      ...entry, isPresent: false, endDate: '2026-09',
    })) });
    const base = h.request(h.before, '2026-10-01', cv), req = request(cv);
    expect(prepare(req).resolution.status).toBe('valid');
    const prior = await execute(h.before, base), current = await execute(h.after, req);
    expect(current).toEqual(prior);
    expect(JSON.stringify(current.inputs)).toBe(JSON.stringify(prior.inputs));
    // The pre-existing role-identity guard stops this historical closed-role
    // topology before dispatch. Preserve the exact zero-invocation contract,
    // plus compare the complete writer envelope independently (not a vacuous
    // empty-array prompt/tool check).
    expect(current.inputs).toEqual([]);
    const oldSnapshot = h.before.domain.createSummaryV3StyleOperationSnapshot(base);
    const newSnapshot = h.after.domain.createSummaryV3StyleOperationSnapshot(prepare(req).contentRequest);
    expect(h.after.server.audit.writer(newSnapshot)).toEqual(h.before.server.audit.writer(oldSnapshot));
    expect(JSON.stringify(h.after.server.audit.writer(newSnapshot)))
      .toBe(JSON.stringify(h.before.server.audit.writer(oldSnapshot)));
    for (const call of current.inputs) expect(call.input).not.toHaveProperty('trustedTenureClaims');
    expect(current.result).not.toHaveProperty('tenureOperationFingerprint');
    expect(current.result).not.toHaveProperty('remediation');
  });
  it('projection does not send stale/invalid relations or another Summary as trusted', () => {
    const cv = bound(), base = h.request(h.after, '2026-10-01', cv);
    expect(project({ ...base, visibleSummary: 'Different.' }, cv).summaryEmploymentTenure).toBeUndefined();
    expect(project(base, { ...cv, id: 'another-cv' }).summaryEmploymentTenure).toBeUndefined();
  });
  it('historical foundation inferred no authority; Task084 wires only validated metadata through the exact runtime boundary', async () => {
    const cv = bound(), req = request(cv), base = h.request(h.before, '2026-10-01', cv);
    const originalCv = JSON.stringify(cv);
    expect(prepare(req).contentRequest).toEqual(base);
    // Historical live route ignores the then-unused metadata. Foundation alone
    // still only validates/projects; it never binds runtime or mutates the CV.
    expect(await execute(h.before, req)).toEqual(await execute(h.before, base));
    expect(prepare(req).resolution.relations).toEqual(cv.summaryEmploymentTenureRelations);
    const current = await execute(h.after, req);
    expect(current.inputs.map((call) => call.role)).toEqual(['writer']);
    expect(current.result.kind).toBe('handled_failure');
    if (current.result.kind !== 'handled_failure') throw new Error('Stale safe-no-op accepted');
    expect(current.result.typedReason).toBe('lost_source_fact');
    expect(current.result.evidence.writerAttempts).toBe(1);
    expect(current.result.evidence.evaluatorAttempts).toBe(0);
    expect(current.result.evidence.safeNoOpSelected).toBe(false);
    expect(current.result.evidence.writerOutputContractFailureClass).toBe('candidate_source_floor');
    expect(current.result).not.toHaveProperty('candidate');
    expect(current.inputs[0]!.input.trustedTenureClaims).toEqual([{
      sourceUnitIndex: 0,
      sourceUnitHash: h.before.domain.createSummaryV3StyleOperationSnapshot(base).sourceUnits[0]!.hash,
      currentDurationMonths: 9,
    }]);
    expect(JSON.stringify(current.inputs)).not.toContain('summaryEmploymentTenure');
    expect(JSON.stringify(cv)).toBe(originalCv);
    const client = readFileSync(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-client.ts'), 'utf8');
    const server = readFileSync(resolve(root, 'src/lib/ai-core-v3/summary-style-m5-server.ts'), 'utf8');
    expect(client).toContain('projectSummaryEmploymentTenureRequest');
    expect(server).toContain('prepareSummaryEmploymentTenureServerRequest');
    expect(server).toContain('bindTrustedEmploymentTenureRuntime');
  });
});
