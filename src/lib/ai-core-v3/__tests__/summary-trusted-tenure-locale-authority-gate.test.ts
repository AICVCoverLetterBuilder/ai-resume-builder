import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type * as Domain from '../summary-style-m5';
import type * as Duration from '../../cv-experience-duration';
import type * as Server from '../summary-style-m5-server';
import type { CVData } from '../../types';

// Task081 stop-gate evidence. No trusted relation implementation or inferred
// backfill is admitted while exact-month native prose cannot be validated.
// The unchanged Task078 harness loads immutable HEAD and working-tree graphs
// entirely in memory; all provider calls in retained tests are injected mocks.
type Graph = {
  domain: typeof Domain;
  duration: typeof Duration;
  server: typeof Server & { audit: {
    first: (snapshot: Domain.SummaryV3StyleOperationSnapshot) => string | null;
    writer: (snapshot: Domain.SummaryV3StyleOperationSnapshot) => Server.SummaryV3StyleWriterInput;
  } };
};
type Harness = {
  before: Graph; after: Graph;
  cv: () => CVData;
  request: (graph: Graph, reference: string, cv?: CVData) => Domain.SummaryV3StyleRequest;
  snapshot: (graph: Graph, reference: string, cv?: CVData) => Domain.SummaryV3StyleOperationSnapshot;
};
const root = process.cwd();
const requireLocal = createRequire(resolve(root, 'package.json'));
const retained = readFileSync(resolve(root,
  'src/lib/ai-core-v3/__tests__/summary-current-role-stale-duration-reconciliation.test.ts'), 'utf8');
const boundary = retained.indexOf("describe('Task078");
if (boundary < 0) throw new Error('Retained Task078 offline harness missing');
const compiled = ts.transpileModule(retained.slice(0, boundary), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const loaded: { exports: { task081?: Harness } } = { exports: {} };
new Function('require', 'module', 'exports', compiled
  + '\nexports.task081={before,after,cv,request,snapshot};\n')(
  (id: string) => id === 'vitest' ? {} : requireLocal(id), loaded, loaded.exports);
const h = loaded.exports.task081!;

// Measurement fixtures only: these surfaces do not assert employment ownership.
// No employer, role, Summary or numeric value from the physical event is used.
const cases = [
  { locale: 'sr', surface: '9 meseci', parsed: 9 },
  { locale: 'en', surface: '9 months', parsed: 9 },
  { locale: 'hi', surface: '९ महीने', parsed: 9 },
  { locale: 'ar', surface: '٩ أشهر', parsed: null },
  { locale: 'ja', surface: '9か月', parsed: 9 },
  { locale: 'de', surface: '9 Monaten', parsed: 9 },
  { locale: 'fr', surface: '9 mois', parsed: null },
  { locale: 'es', surface: '9 meses', parsed: null },
  { locale: 'it', surface: '9 mesi', parsed: null },
  { locale: 'hr', surface: '9 mjeseci', parsed: null },
  { locale: 'pt-BR', surface: '9 meses', parsed: null },
  { locale: 'ru', surface: '9 месяцев', parsed: 9 },
] as const;

describe('Task081 locale-safe exact tenure validation prerequisite (offline STOP gate)', () => {
  it.each(cases)('$locale native numeric month surface has the observed baseline interpretation', ({ surface, parsed }) => {
    expect(h.before.domain.summaryV3StyleDurationMonthsFromSemanticSpan(`span:${surface}`)).toBe(parsed);
    expect(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan(`span:${surface}`)).toBe(parsed);
  });

  it.each(cases)('$locale formatter is baseline-equivalent, not a newly admitted rewrite authority', ({ locale }) => {
    const duration = h.after.duration.applyApproximateDurationPolicy(9);
    expect(h.after.duration.formatApproximateDurationPhrase(duration, locale))
      .toBe(h.before.duration.formatApproximateDurationPhrase(duration, locale));
  });

  it.each(['ar', 'ja', 'de', 'fr', 'es', 'it'] as const)('%s months branch falls back to English, not locale-safe prose', (locale) => {
    expect(h.after.duration.formatApproximateDurationPhrase(h.after.duration.applyApproximateDurationPolicy(9), locale))
      .toBe('around 9 months');
  });

  it('the measurement matrix is complete but six native month units remain unparsed', () => {
    expect(new Set(cases.map((item) => item.locale))).toEqual(new Set(h.after.domain.SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES));
    expect(cases.filter((item) => item.parsed === null).map((item) => item.locale))
      .toEqual(['ar', 'fr', 'es', 'it', 'hr', 'pt-BR']);
  });

  it('existing approximate-year policy cannot become exact entry-month authority', () => {
    const duration = h.after.duration.applyApproximateDurationPolicy(13);
    expect(duration.totalMonths).toBe(13);
    expect(duration.unit).toBe('years');
    expect(duration.approxYears * 12).not.toBe(duration.totalMonths);
  });

  it('existing formatter intentionally omits durations below its threshold', () => {
    for (const { locale } of cases) {
      expect(h.after.duration.formatApproximateDurationPhrase(h.after.duration.applyApproximateDurationPolicy(3), locale)).toBe('');
    }
  });

  it('legacy year-claim extraction is not an exact native month parser', () => {
    for (const { surface } of cases) expect(h.after.duration.extractSummaryYearClaims(surface)).toEqual([]);
  });

  it('recognizing a value prefix is not a strict whole-span unit contract', () => {
    expect(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan('span:9 monthsXYZ')).toBe(9);
    expect(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan('span:9 yearsXYZ')).toBe(108);
  });

  it('provider prose cannot be treated as an alternative numeric validator', () => {
    // Correct, stale, invented and wrong-unit native values are all unknown,
    // not respectively accepted/rejected by the existing exact-month parser.
    for (const surface of ['9 mois', '8 mois', '11 mois', '9 ans']) {
      expect(h.after.domain.summaryV3StyleDurationMonthsFromSemanticSpan(`span:${surface}`)).toBeNull();
    }
  });

  it('legacy source remains fail-closed and creates no employment-tenure relation', () => {
    const before = h.snapshot(h.before, '2026-10-01');
    const after = h.snapshot(h.after, '2026-10-01');
    expect(h.after.server.audit.first(after)).toBe('source_numeric_membership_mismatch');
    expect(after).toEqual(before);
    expect(Object.keys(h.request(h.after, '2026-10-01'))).not.toContain('tenureContext');
    expect(Object.keys(h.cv())).not.toContain('summaryEmploymentTenureRelations');
  });

  it('request, provider input, snapshot and hashes remain immutable-baseline equivalent', () => {
    for (const reference of ['2026-09-01', '2026-10-01', '2027-02-01']) {
      const before = h.snapshot(h.before, reference);
      const after = h.snapshot(h.after, reference);
      expect(h.request(h.after, reference)).toEqual(h.request(h.before, reference));
      expect(after).toEqual(before);
      expect(h.after.server.audit.writer(after)).toEqual(h.before.server.audit.writer(before));
      expect(h.after.server.audit.first(after)).toBe(h.before.server.audit.first(before));
    }
  });

  it('STOP admits neither raw numeric replacement nor a partial trust/persistence contract', () => {
    const before = h.cv();
    const copied = structuredClone(before);
    h.snapshot(h.after, '2026-10-01', copied);
    expect(copied).toEqual(before);
    expect(readFileSync(resolve(root, 'src/lib/ai-core-v3/summary-style-m5.ts'), 'utf8'))
      .not.toContain('SummaryEmploymentTenureRelation');
  });
});
