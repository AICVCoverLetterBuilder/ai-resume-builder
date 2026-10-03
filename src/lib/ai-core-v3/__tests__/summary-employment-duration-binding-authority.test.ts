import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type * as Domain from '../summary-style-m5';
import type * as Server from '../summary-style-m5-server';
import type { CVData } from '../../types';

// Task080 STOP evidence: exercise the existing authority, not a fake binding
// implementation. No project/tenure classifier or production waiver is added.
type Snapshot = Domain.SummaryV3StyleOperationSnapshot;
type Graph = {
  domain: typeof Domain;
  server: typeof Server & { audit: {
    entryIds: (snapshot: Snapshot, clause: string) => ReadonlySet<string>;
    sourceDuration: (snapshot: Snapshot) => boolean;
    first: (snapshot: Snapshot) => string | null;
    hard: (snapshot: Snapshot, text: string) => { reason: string | null; predicate: string | null };
    numeric: (snapshot: Snapshot, text: string) => boolean;
    writer: (snapshot: Snapshot) => Server.SummaryV3StyleWriterInput;
    parseWriter: (output: unknown, snapshot: Snapshot) => { ok: boolean; reason?: string };
  } };
};
type Harness = {
  before: Graph; after: Graph; source: string; cv: () => CVData;
  request: (graph: Graph, reference: string, value?: CVData) => Domain.SummaryV3StyleRequest;
  snapshot: (graph: Graph, reference: string, value?: CVData) => Snapshot;
  writer: (input: Server.SummaryV3StyleWriterInput, text: string) => object;
};
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
const retained = readFileSync(resolve(root,
  'src/lib/ai-core-v3/__tests__/summary-current-role-stale-duration-reconciliation.test.ts'), 'utf8');
const boundary = retained.indexOf("describe('Task078");
if (boundary < 0) throw new Error('Retained Task078 offline harness not found');
const compiled = ts.transpileModule(retained.slice(0, boundary), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const loaded: { exports: { task080?: Harness } } = { exports: {} };
new Function('require', 'module', 'exports', compiled
  + '\nexports.task080={before,after,source,cv,request,snapshot,writer};\n')(
  (id: string) => id === 'vitest' ? {} : nativeRequire(id), loaded, loaded.exports);
const h = loaded.exports.task080!;
const code = (relative: string) => readFileSync(resolve(root, relative), 'utf8');
const serverCode = code('src/lib/ai-core-v3/summary-style-m5-server.ts');
const domainCode = code('src/lib/ai-core-v3/summary-style-m5.ts');
function state(text: string, reference = '2026-10-01', value = h.cv()): Snapshot {
  return h.snapshot(h.after, reference, { ...value, summary: text });
}
function observed(snapshot: Snapshot, text: string) {
  return {
    entryCount: h.after.server.audit.entryIds(snapshot, text).size,
    states: h.after.server.employmentRelationDecision(snapshot, text).entries.map((entry) => entry.candidateState),
    months: h.after.domain.summaryV3StyleFactAnchorTokens(text)
      .filter((token) => token.startsWith('span:'))
      .map(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan)
      .filter((months) => months !== null),
  };
}
function parsed(snapshot: Snapshot, text: string) {
  return h.after.server.audit.parseWriter({
    ...h.writer(h.after.server.audit.writer(snapshot), text),
    contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
  }, snapshot);
}
const tenure = 'I currently work as a Clerk at FictionalLab for approximately 8 months.';
const projectAfter = 'I currently work as a Clerk at FictionalLab and worked on Project X for 8 months.';
const projectBefore = 'I worked on Project X for 8 months and currently work as a Clerk at FictionalLab.';

describe('Task080 deterministic employment-duration binding decision (offline; no production repair)', () => {
  it('does not prove tenure ownership for the mandatory physical-like unique-role-only claim', () => {
    const text = 'I work as a Clerk for approximately 8 months.';
    expect(observed(state(text), text)).toEqual({ entryCount: 1, states: ['neutral'], months: [8] });
  });

  it('does not prove tenure ownership for a unique-employer-only claim', () => {
    const text = 'I work at FictionalLab for approximately 8 months.';
    expect(observed(state(text), text)).toEqual({ entryCount: 1, states: ['neutral'], months: [8] });
  });

  it.each([
    'I work as a Clerk and worked on Project X for 8 months.',
    'I worked on Project X for 8 months and work as a Clerk.',
  ])('does not convert the mandatory role-only project fixture into tenure: %s', (text) => {
    const physicalLike = 'I work as a Clerk for approximately 8 months.';
    expect(observed(state(text), text)).toEqual(observed(state(physicalLike), physicalLike));
    expect(h.after.server.audit.first(state(text))).toBe('source_numeric_membership_mismatch');
  });

  it('recognizes a complete CURRENT frame but returns state, not temporal-predicate ownership', () => {
    const snapshot = state(tenure);
    expect(observed(snapshot, tenure)).toEqual({ entryCount: 1, states: ['present'], months: [8] });
    expect(Object.keys(h.after.server.employmentRelationDecision(snapshot, tenure).entries[0]!).sort())
      .toEqual(['candidateState', 'entryId', 'explicitOpposite', 'sourceState']);
    const frame = serverCode.slice(serverCode.indexOf('function employmentFrameStateForClause('),
      serverCode.indexOf('type EmploymentRelationState'));
    expect(frame).toContain("if (!roleSurface || !employerSurface) return 'neutral'");
    expect(frame).not.toContain('summaryV3StyleDurationMonthsFromSemanticSpan');
  });

  it.each([
    ['after the employment predicate', projectAfter],
    ['before the employment predicate', projectBefore],
  ])('cannot distinguish same-unit project duration %s from tenure using existing structural outputs', (_label, text) => {
    expect(observed(state(text), text)).toEqual(observed(state(tenure), tenure));
    // Identical quantity, unique entry match and employment state are NOT a
    // binding. Granting an exemption from those outputs would admit a project.
    expect(h.after.server.audit.sourceDuration(state(text))).toBe(true);
    expect(h.after.server.audit.first(state(text))).toBe('source_numeric_membership_mismatch');
  });

  it.each([
    'I currently work as a Clerk at FictionalLab; I worked on Project X for 8 months.',
    'I worked on Project X for 8 months; I currently work as a Clerk at FictionalLab.',
    'I currently work as a Clerk at FictionalLab. I worked on Project X for 8 months.',
  ])('keeps separate project clauses fail closed without claiming a safe temporal binding: %s', (text) => {
    expect(observed(state(text), text)).toEqual({ entryCount: 1, states: ['present'], months: [8] });
    expect(h.after.server.audit.first(state(text))).toBe('source_numeric_membership_mismatch');
  });

  it.each([
    ['duplicate role', 'Clerk', 'OtherFictionalLab', 'I work as a Clerk for 8 months.'],
    ['duplicate employer', 'Mentor', 'FictionalLab', 'I work at FictionalLab for 8 months.'],
    ['repeated role/employer at different periods', 'Clerk', 'FictionalLab', tenure],
  ])('does not choose first/latest/current to cure %s ambiguity', (_label, role, employer, text) => {
    const value = h.cv();
    value.experience.push({ ...value.experience[0]!, id: 'fictional-prior-entry',
      position: role, company: employer, startDate: '2024-01', endDate: '2024-09', isPresent: false });
    const snapshot = state(text, '2026-10-01', value);
    expect(snapshot.selectedEntries).toHaveLength(2);
    expect(h.after.server.audit.entryIds(snapshot, text).size).toBe(2);
    expect(h.after.server.audit.sourceDuration(snapshot)).toBe(true);
    expect(h.after.server.audit.first(snapshot)).not.toBeNull();
  });

  it('does not cross-bind a matching duration from a different role', () => {
    const value = h.cv();
    value.experience.push({ ...value.experience[0]!, id: 'fictional-other-entry',
      position: 'Mentor', company: 'OtherFictionalLab', startDate: '2026-02' });
    const snapshot = h.snapshot(h.after, '2026-10-01', value);
    expect(snapshot.selectedEntries.map((entry) => entry.durationMonths)).toEqual([9, 8]);
    expect(h.after.server.audit.sourceDuration(snapshot)).toBe(true);
  });

  it('has no typed duration referent in source units, entity bindings, fact anchors or client input', () => {
    const snapshot = h.snapshot(h.after, '2026-10-01');
    for (const unit of snapshot.sourceUnits) expect(Object.keys(unit).sort()).toEqual(['hash', 'id']);
    for (const binding of snapshot.entityRelationBindings) expect(Object.keys(binding).sort())
      .toEqual(['entityHash', 'hash', 'sourceFactHashes', 'sourceUnitHash']);
    const spans = h.after.domain.summaryV3StyleFactAnchorTokens(projectAfter).filter((token) => token.startsWith('span:'));
    expect(spans.map(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan)).toContain(8);
    expect(snapshot).not.toHaveProperty('employmentDurationBindings');
    const request = h.request(h.after, '2026-10-01');
    expect(request).not.toHaveProperty('employmentDurationBindings');
    for (const fact of request.visibleSummaryFacts || []) {
      expect(Object.keys(fact).every((key) => ['id', 'text', 'semanticKind', 'transformableDuty'].includes(key))).toBe(true);
    }
    const inputs = domainCode.slice(domainCode.indexOf('export interface SummaryV3StyleFactInput'),
      domainCode.indexOf('export interface SummaryV3StyleRequest'));
    expect(inputs).not.toContain('temporalRelation');
    expect(inputs).not.toContain('claimKind');
  });

  it('does not obtain the missing claim relation by relabelling generated versus user Summary', () => {
    const generated = h.cv(), user = { ...generated, summaryOrigin: 'user' as const };
    expect(h.request(h.after, '2026-10-01', user)).toEqual(h.request(h.after, '2026-10-01', generated));
    // Task080 permits dates-canonical refresh once binding is proven. This
    // test is not an objection to that policy; it identifies missing binding.
  });

  it('keeps current exact duration and source representation unchanged', () => {
    const text = h.source.replace('8 months', '9 months');
    const snapshot = state(text);
    expect(h.after.server.audit.first(snapshot)).toBeNull();
    expect(h.after.server.audit.sourceDuration(snapshot)).toBe(false);
    expect(parsed(snapshot, text).ok).toBe(true);
    expect(h.after.server.audit.hard(snapshot, text).reason).toBeNull();
  });

  it.each([
    ['one-month', '2026-10-01', 9],
    ['multi-month', '2026-12-01', 11],
    ['year rollover', '2027-01-01', 12],
  ])('retains accepted Task078 %s stale-source topology and truthful Task075 reason', (_name, ref, months) => {
    const snapshot = h.snapshot(h.after, ref);
    expect(snapshot.selectedEntries[0]!.durationMonths).toBe(months);
    expect(h.after.server.audit.first(snapshot)).toBe('source_numeric_membership_mismatch');
    expect(h.after.server.audit.sourceDuration(snapshot)).toBe(true);
    expect(h.after.server.audit.hard(snapshot, h.source)).toMatchObject({
      reason: 'unsupported_claim', predicate: 'unsupported_source_inconsistency',
    });
    expect(snapshot).toEqual(h.snapshot(h.before, ref));
  });

  it('does not falsely report that the old source lock permits a stale-to-current replacement', () => {
    const snapshot = h.snapshot(h.after, '2026-10-01');
    expect(parsed(snapshot, h.source.replace('8 months', '9 months'))).toMatchObject({
      ok: false, reason: 'lost_source_fact',
    });
  });

  it.each([
    ['role', 'Clerk', 'Mentor'],
    ['employer', 'FictionalLab', 'OtherFictionalLab'],
    ['unrelated duty', 'checks goods', 'checks awards'],
  ])('keeps existing required-fact rejection for changed %s', (_label, before, after) => {
    expect(parsed(h.snapshot(h.after, '2026-09-01'), h.source.replace(before, after)).ok).toBe(false);
  });

  it('retains all required duration facts and rejects omission', () => {
    const snapshot = h.snapshot(h.after, '2026-09-01');
    expect(snapshot.requiredFacts.some((fact) => fact.text.includes('8 months'))).toBe(true);
    expect(parsed(snapshot, h.source.replace(' for about 8 months', '')).ok).toBe(false);
    expect(h.after.server.audit.writer(snapshot).requiredFacts).toEqual(snapshot.requiredFacts);
  });

  it('does not claim an independent CURRENT candidate validator after simply bypassing source inconsistency', () => {
    const snapshot = h.snapshot(h.after, '2026-10-01');
    expect(parsed(snapshot, h.source).ok).toBe(true);
    expect(h.after.domain.inspectSummaryV3StyleCandidatePreservesLocks(snapshot, h.source).preserved).toBe(true);
    expect(h.after.server.audit.numeric(snapshot, h.source)).toBe(false);
    expect(h.after.server.audit.hard(snapshot, h.source).reason).toBe('unsupported_claim');
    // Production is protected by source inconsistency, but stale candidate
    // rejection by a new independent employment-duration owner is NOT proven.
  });

  it.each(['77 months', '8 years'])('keeps invented or wrong-unit candidate %s rejected', (duration) => {
    const snapshot = h.snapshot(h.after, '2026-10-01');
    const candidate = h.source.replace('8 months', duration);
    // The generic numeric guard does not reject every wrong unit. The writer
    // still rejects the changed required source duration; do not invent a
    // stronger independent duration validator than production actually has.
    expect(h.after.server.audit.numeric(snapshot, candidate))
      .toBe(h.before.server.audit.numeric(snapshot, candidate));
    expect(parsed(snapshot, candidate).ok).toBe(false);
  });

  it('supports CLOSED employment state without changing fixed duration or authorizing refresh', () => {
    const value = h.cv();
    value.experience[0]!.isPresent = false;
    value.experience[0]!.endDate = '2026-09';
    value.summary = 'I worked as a Clerk at FictionalLab for 8 months.';
    const snapshot = h.snapshot(h.after, '2027-01-01', value);
    expect(observed(snapshot, value.summary)).toEqual({ entryCount: 1, states: ['completed'], months: [8] });
    expect(snapshot.selectedEntries[0]!.durationMonths).toBe(8);
    expect(h.after.server.audit.sourceDuration(snapshot)).toBe(false);
    expect(h.after.server.audit.first(snapshot)).toBe('unannotated_source_role_employer_frame_inconsistency');
    expect(h.after.server.audit.first(snapshot))
      .toBe(h.before.server.audit.first(h.snapshot(h.before, '2027-01-01', value)));
    const wrong = state(value.summary.replace('8 months', '9 months'), '2027-01-01', value);
    expect(h.after.server.audit.sourceDuration(wrong)).toBe(true);
    expect(h.after.server.audit.first(wrong)).not.toBeNull();
  });

  it('retains immutable baseline/disk snapshots, provider input and every tested functional decision', () => {
    for (const text of [tenure, projectAfter, projectBefore]) {
      for (const reference of ['2026-09-01', '2026-10-01', '2027-01-01']) {
        const value = { ...h.cv(), summary: text };
        const original = h.snapshot(h.before, reference, value);
        const current = h.snapshot(h.after, reference, value);
        expect(current).toEqual(original);
        expect(h.after.server.audit.writer(current)).toEqual(h.before.server.audit.writer(original));
        expect(h.after.server.employmentRelationDecision(current, text))
          .toEqual(h.before.server.employmentRelationDecision(original, text));
        expect(h.after.server.audit.first(current)).toBe(h.before.server.audit.first(original));
        expect(h.after.server.audit.hard(current, text)).toEqual(h.before.server.audit.hard(original, text));
      }
    }
  });
});
