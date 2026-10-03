import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type * as Domain from '../summary-style-m5';
import type * as Client from '../summary-style-m5-client';
import type { CVData } from '../../types';

// Architecture decision-gate evidence, not a reconciliation implementation.
// Reuse the unchanged Task078 offline graph in test memory. Never alter the
// production module, retained audit, request, snapshot, or provider input.
type Snapshot = Domain.SummaryV3StyleOperationSnapshot;
type Graph = {
  domain: typeof Domain;
  server: { audit: {
    entryIds: (snapshot: Snapshot, clause: string) => ReadonlySet<string>;
    sourceDuration: (snapshot: Snapshot) => boolean;
    first: (snapshot: Snapshot) => string | null;
    writer: (snapshot: Snapshot) => { sourceKind: string; requiredFacts: readonly Domain.SummaryV3StyleFact[] };
  } };
  client: typeof Client;
};
type Harness = {
  before: Graph; after: Graph; source: string;
  cv: () => CVData;
  request: (graph: Graph, reference: string, value?: CVData) => Domain.SummaryV3StyleRequest;
  snapshot: (graph: Graph, reference: string, value?: CVData) => Snapshot;
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
const loaded: { exports: { task079?: Harness } } = { exports: {} };
new Function('require', 'module', 'exports', compiled
  + '\nexports.task079={before,after,source,cv,request,snapshot};\n')(
  (id: string) => id === 'vitest' ? {} : nativeRequire(id), loaded, loaded.exports);
const h = loaded.exports.task079!;
const code = (relative: string) => readFileSync(resolve(root, relative), 'utf8');
const domainCode = code('src/lib/ai-core-v3/summary-style-m5.ts');
const canonical = code('src/lib/cv-canonical-snapshot.ts');
const quality = code('src/lib/cv-content-quality.ts');

describe('Task079 canonical-owner architecture decision gate (offline; production frozen)', () => {
  it('distinguishes legacy total-career duration authority from same-entry CURRENT claim ownership', () => {
    const finalizer = code('src/lib/cv-ai-finalize-apply.ts');
    const start = finalizer.indexOf('const durationResolved = resolveSummaryWithDurationPolicy(');
    expect(start).toBeGreaterThan(0);
    const call = finalizer.slice(start, start + 450);
    expect(call).toContain('durationSnapshot.total');
    expect(call).toContain('forceDurationPhrase: true');
    expect(call).toContain('requireDurationClaim: true');
    expect(quality).toContain("expectedOwner: 'total_professional_experience'");
    expect(quality).toContain('total-duration must not remain attached to the current-role clause');
  });

  it('preserves manual canonical Summary independently from generated display acceptance', () => {
    const edit = canonical.slice(canonical.indexOf('export function applyCanonicalSummaryEdit('),
      canonical.indexOf('export function applyCanonicalExperienceEdit('));
    expect(edit).toContain("summaryOrigin: 'user'");
    expect(edit).toContain('canonicalSummary: summary');
    expect(edit).not.toContain('enforceAuthoritativeSummaryDuration');
    const accept = canonical.slice(canonical.indexOf('export function acceptValidatedAiContent('));
    expect(accept).toContain('AI may update visible summary only');
    expect(accept).toContain('never promote into canonicalSummary');
    expect(accept).toContain('Seal must read user summary');
    // Preservation alone is NOT proof that a contradictory duration may be
    // accepted by an AI validator. The separate M5 rejection below is retained.
  });

  it('does not confuse absence/injection policy with an independently bound role-duration policy', () => {
    expect(code('src/lib/types.ts')).toContain('user-written summaries must not be force-injected');
    const resolved = quality.slice(quality.indexOf('export function resolveSummaryWithDurationPolicy('));
    expect(resolved).toContain('options?.forceDurationPhrase || options?.requireDurationClaim');
    expect(resolved).toContain('enforceAuthoritativeSummaryDuration');
    expect(quality).toContain("expectedOwner: 'total_professional_experience'");
  });

  it('keeps generated and user-authored requests and snapshots identical', () => {
    const generated = h.cv();
    const user = { ...generated, summaryOrigin: 'user' as const, summaryGenerationContextKey: undefined };
    expect(h.request(h.after, '2032-02-01', generated)).toEqual(h.request(h.after, '2032-02-01', user));
    expect(h.snapshot(h.after, '2032-02-01', generated)).toEqual(h.snapshot(h.after, '2032-02-01', user));
  });

  it('retains stable structured identity, employment state and numeric duration in the existing manifest', () => {
    const req = h.request(h.after, '2026-10-01');
    const state = h.snapshot(h.after, '2026-10-01');
    expect(state.currentRoleEntryId).toBe(req.manifest.entries[0]!.stableId);
    expect(state.selectedEntries[0]!.employmentState).toBe('present');
    expect(state.selectedEntries[0]!.durationMonths).toBe(9);
    expect(req.manifest.entries[0]).not.toHaveProperty('referenceDateIso');
    expect(req.manifest.entries[0]).not.toHaveProperty('startDate');
  });

  it('does not supply a duration-span-to-Experience identity in source-unit metadata', () => {
    const state = h.snapshot(h.after, '2026-10-01');
    expect(state.sourceUnits.length).toBeGreaterThan(0);
    for (const unit of state.sourceUnits) expect(Object.keys(unit).sort()).toEqual(['hash', 'id']);
    expect(domainCode).toContain('Content-derived identity deliberately avoids positional/array-index identity');
    expect(state).not.toHaveProperty('currentRoleDurationBindings');
    expect(state).not.toHaveProperty('summaryDurationProvenance');
  });

  it('does not mistake person/source-unit relation bindings for Experience duration ownership', () => {
    const state = h.snapshot(h.after, '2026-10-01');
    for (const binding of state.entityRelationBindings) {
      expect(Object.keys(binding).sort()).toEqual([
        'entityHash', 'hash', 'sourceFactHashes', 'sourceUnitHash',
      ]);
    }
    expect(domainCode).toContain('const entityLocks = Array.from(new Map(locks');
    expect(domainCode).toContain(".filter((lock) => lock.kind === 'entity')");
  });

  it('shows the existing entry matcher can match a role alone or employer alone, not a duration attachment', () => {
    const state = h.snapshot(h.after, '2026-10-01');
    const id = state.selectedEntries[0]!.stableId;
    expect([...h.after.server.audit.entryIds(state, 'Clerk')]).toEqual([id]);
    expect([...h.after.server.audit.entryIds(state, 'FictionalLab')]).toEqual([id]);
    expect([...h.after.server.audit.entryIds(state, 'Clerk at FictionalLab')]).toEqual([id]);
  });

  it('exposes shared-employer ambiguity rather than claiming the existing matcher proves an exact complete frame', () => {
    const value = h.cv();
    value.experience.push({ ...value.experience[0]!, id: 'fictional-other-role', position: 'Mentor' });
    const state = h.snapshot(h.after, '2026-10-01', value);
    expect(h.after.server.audit.entryIds(state, 'Clerk at FictionalLab').size).toBe(2);
    expect(h.after.server.audit.sourceDuration(state)).toBe(true);
  });

  it('does not classify every duration near one employment identity as tenure of that role', () => {
    const state = h.snapshot(h.after, '2026-10-01');
    const clause = 'Clerk at FictionalLab maintains a project for 8 months';
    expect(h.after.server.audit.entryIds(state, clause).size).toBe(1);
    const spans = h.after.domain.summaryV3StyleFactAnchorTokens(clause).filter((token) => token.startsWith('span:'));
    expect(spans.map(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan)).toContain(8);
    // The parser yields quantity/unit only, while the entry matcher yields
    // identity presence only. Combining those two facts does not prove the
    // temporal predicate's referent. No duration is waived in this test.
  });

  it('retains the old visible duration fact and rejects it as inconsistent, rather than relabelling it derived', () => {
    const state = h.snapshot(h.after, '2026-10-01');
    expect(state.requiredFacts.some((fact) => fact.origin === 'visible_summary'
      && fact.text.includes('8 months'))).toBe(true);
    expect(h.after.server.audit.first(state)).toBe('source_numeric_membership_mismatch');
    expect(h.after.server.audit.sourceDuration(state)).toBe(true);
    const writer = h.after.server.audit.writer(state);
    expect(writer.sourceKind).toBe('visible_summary');
    expect(writer.requiredFacts).toEqual(state.requiredFacts);
  });

  it('keeps semantic month equivalence distinct from canonical duration ownership', () => {
    expect(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan('span:2 years')).toBe(24);
    expect(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan('span:24 months')).toBe(24);
    expect(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan('span:2 awards')).toBeNull();
    // Quantity equivalence is available; it supplies neither a role binding
    // nor authority to replace an unrelated source fact.
  });

  it('retains baseline/disk snapshot, hash, provider-input and source-decision parity', () => {
    for (const reference of ['2026-09-01', '2026-10-01', '2027-01-01']) {
      const baseline = h.snapshot(h.before, reference);
      const current = h.snapshot(h.after, reference);
      expect(current).toEqual(baseline);
      expect(h.after.server.audit.writer(current)).toEqual(h.before.server.audit.writer(baseline));
      expect(h.after.server.audit.first(current)).toBe(h.before.server.audit.first(baseline));
    }
  });

  it('does not add a second runtime clock, request schema, or persisted ownership through an audit test', () => {
    const baseline = h.request(h.before, '2026-10-01');
    const current = h.request(h.after, '2026-10-01');
    expect(current).toEqual(baseline);
    expect(Object.keys(current).sort()).toEqual(Object.keys(baseline).sort());
    expect(current).not.toHaveProperty('summaryOrigin');
    expect(current).not.toHaveProperty('durationGenerationTimestamp');
  });
});
