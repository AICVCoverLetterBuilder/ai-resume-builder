import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type * as Domain from '../summary-style-m5';
import type * as Client from '../summary-style-m5-client';
import type { CVData } from '../../types';

// Task084 PRE-IMPLEMENTATION gate. Nothing here grants runtime authority.
// Test only the existing content-derived source/candidate contract, including
// an adversarial relocation that must not acquire the user's source ownership.
type Harness = {
  after: { domain: typeof Domain; client: typeof Client };
  cv: () => CVData;
  source: string;
  snapshot: (graph: Harness['after'], reference: string, value?: CVData) => Domain.SummaryV3StyleOperationSnapshot;
};
const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
const retained = readFileSync(resolve(root,
  'src/lib/ai-core-v3/__tests__/summary-current-role-stale-duration-reconciliation.test.ts'), 'utf8');
const boundary = retained.indexOf("describe('Task078");
if (boundary < 0) throw new Error('Missing retained offline harness');
const moduleMemory: { exports: { gate?: Harness } } = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(retained.slice(0, boundary), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText + '\nexports.gate={after,cv,source,snapshot};\n')(
  (id: string) => id === 'vitest' ? {} : nativeRequire(id), moduleMemory, moduleMemory.exports);
const h = moduleMemory.exports.gate!;

describe('Task084 existing claim-slot continuity precondition (no functional implementation)', () => {
  it('can reconstruct a unique exact masked source fact for the synthetic incident', () => {
    const source = h.source;
    const snapshot = h.snapshot(h.after, '2026-10-01');
    const start = source.indexOf('8 months');
    const facts = snapshot.requiredFacts.filter((fact) => {
      const index = source.indexOf(fact.text);
      return index >= 0 && index <= start && index + fact.text.length >= start + '8 months'.length;
    });
    expect(facts).toHaveLength(1);
    expect(source.split(facts[0]!.text)).toHaveLength(2);
    expect(facts[0]!.text.replace('8 months', '[duration-slot]'))
      .toBe(facts[0]!.text.replace('8 months', '9 months').replace('9 months', '[duration-slot]'));
  });

  it('does not mistake content-derived source IDs for stable candidate claim-slot references', () => {
    const snapshot = h.snapshot(h.after, '2026-10-01');
    const unit = snapshot.sourceUnits[0]!;
    expect(Object.keys(unit).sort()).toEqual(['hash', 'id']);
    const units = [{ unitId: 'synthetic-candidate', text: h.source,
      factIds: snapshot.requiredFacts.map((fact) => fact.id) }];
    const candidate = h.after.domain.createSummaryV3StyleCandidate(snapshot, units);
    expect(candidate.units[0]).not.toHaveProperty('sourceUnitId');
    expect(candidate.units[0]).not.toHaveProperty('durationSlot');
    const next = h.snapshot(h.after, '2026-10-01', { ...h.cv(), summary: h.source.replace('8 months', '9 months') });
    expect(next.sourceUnits[0]!.id).not.toBe(unit.id);
  });

  it('cannot preserve claim-slot position when two independent claims are merged into the same provider unit', () => {
    const source = 'SyntheticPerson checks goods for 8 months; SyntheticPerson sorts goods for 9 months.';
    const snapshot = h.snapshot(h.after, '2026-10-01', { ...h.cv(), summary: source });
    expect(snapshot.sourceUnits).toHaveLength(1);
    expect(snapshot.requiredFacts).toHaveLength(2);
    const moved = 'SyntheticPerson checks goods; SyntheticPerson sorts goods for 9 months.';
    const candidate = h.after.domain.createSummaryV3StyleCandidate(snapshot, [{
      unitId: 'synthetic-merged', text: moved, factIds: snapshot.requiredFacts.map((fact) => fact.id),
    }]);
    expect(candidate.units[0]!.factIds).toHaveLength(2);
    expect(candidate.units[0]).not.toHaveProperty('sourceUnitId');
    // An exact mask would reject this text; the EXISTING provider fact-ID
    // declaration alone supplies no relation-bearing claim position.
    expect(source.replace('8 months', '[duration-slot]')).not.toBe(moved.replace('9 months', '[duration-slot]'));
  });
});
