import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findExactDurationMeasurements as find, parseExactDurationMeasurement as parse } from '../exact-duration-measurement';
import {
  SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES,
  normalizeSummaryV3StyleNumericSurface,
  summaryV3StyleDurationMonthsFromSemanticSpan,
  summaryV3StyleFactAnchorTokens,
} from '../summary-style-m5';
import type * as Domain from '../summary-style-m5';
import type * as Server from '../summary-style-m5-server';
import type { CVData } from '../../types';

// Measurement-only synthetic fixtures, not retained physical CV text.
const nativeMonths = [
  ['sr', '9 meseci', 9], ['en', '9 months', 9], ['hi', '९ महीने', 9],
  ['ar', '٩ أشهر', null], ['ja', '9か月', 9], ['de', '9 Monaten', 9],
  ['fr', '9 mois', null], ['es', '9 meses', null], ['it', '9 mesi', null],
  ['hr', '9 mjeseci', null], ['pt-BR', '9 meses', null], ['ru', '9 месяцев', 9],
] as const;
const singularMonths = [
  ['sr', '1 mesec'], ['en', '1 month'], ['hi', '१ महीना'], ['ar', '١ شهر'],
  ['ja', '1か月'], ['de', '1 Monat'], ['fr', '1 mois'], ['es', '1 mes'],
  ['it', '1 mese'], ['hr', '1 mjesec'], ['pt-BR', '1 mês'], ['ru', '1 месяц'],
] as const;
const nativeYears = [
  ['sr', '2 godine'], ['en', '2 years'], ['hi', '२ वर्ष'], ['ar', '٢ سنوات'],
  ['ja', '2年'], ['de', '2 Jahren'], ['fr', '2 ans'], ['es', '2 años'],
  ['it', '2 anni'], ['hr', '2 godine'], ['pt-BR', '2 anos'], ['ru', '2 года'],
] as const;

describe('Task082 A-F native exact measurement grammar', () => {
  it.each(nativeMonths)('%s retained native month surface parses strictly', (_locale, surface) => {
    expect(parse(surface)).toBe(9);
    expect(find(surface)).toEqual([{ start: 0, end: surface.length, totalMonths: 9 }]);
  });
  it.each(singularMonths)('%s native singular month surface is enumerated', (_locale, surface) => {
    expect(parse(surface)).toBe(1);
  });
  it.each(nativeMonths)('%s accepts existing ASCII numeral policy', (_locale, surface) => {
    expect(parse(normalizeSummaryV3StyleNumericSurface(surface))).toBe(9);
  });
  it.each(nativeYears)('%s integer years use literal multiplication, never approximate policy', (_locale, surface) => {
    expect(parse(surface)).toBe(24);
  });
  it.each([
    ['2 meseca', 2], ['3 mesecu', 3], ['4 mesecima', 4], ['9 месеци', 9],
    ['2 mjeseca', 2], ['3 mjesecu', 3], ['4 mjesecima', 4],
    ['9 Monate', 9], ['1 Monats', 1], ['2 месяца', 2], ['9 महीनों', 9],
    ['2 شهرين', 2], ['9ヶ月', 9], ['9カ月', 9], ['9箇月', 9],
    ['1 année', 12], ['2 années', 24], ['1 año', 12], ['1 anno', 12],
    ['1 ano', 12], ['1 год', 12], ['5 лет', 60], ['1 سنة', 12],
    ['2 سنتين', 24], ['2 वर्षों', 24], ['1 godinu', 12], ['2 године', 24],
    ['1 Jahres', 12],
  ] as const)('explicit existing morphology %s -> %i', (surface, months) => {
    expect(parse(surface)).toBe(months);
  });
  it('covers exactly the twelve product locales without twelve parser branches', () => {
    expect(new Set(nativeMonths.map(([locale]) => locale))).toEqual(new Set(SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES));
  });
  it.each(['9 months', '९ months', '٩ months', '۹ months', '９ months'])('reuses supported numeric script %s', (surface) => {
    expect(parse(surface)).toBe(9);
  });
  it.each(['९ महीनों', '9 महीने', '9 أشهر', '٩ أشهر', '۹ أشهر', '９か月'])('native/ASCII compatibility %s', (surface) => {
    expect(parse(surface)).toBe(9);
  });
  it('is case-insensitive only within the exact unit lexicon', () => {
    expect(parse('9 MONTHS')).toBe(9);
    expect(parse('9 МЕСЯЦЕВ')).toBe(9);
    expect(parse('9 MoNtHsXYZ')).toBeNull();
  });
  it('accepts zero as a measurement without granting semantic tenure validity', () => {
    expect(parse('0 months')).toBe(0);
    expect(find('0 months')).toEqual([{ start: 0, end: 8, totalMonths: 0 }]);
  });
});

const badSurfaces = [
  '9 monthsXYZ', 'XYZ9 months', 'v9 months', '9 months%', '9 months %', '9 months％',
  '9 months_tech', 'tech_9 months', '9 months9', '9 months\u200d', '\u200d9 months',
  '9 projects', '9%', '$9', 'version 9.1', 'v9.1 months', '9months.com',
  'person@9months', '9months@example.invalid', 'example.9months', '9monthss',
  '9 mesXYZ', '9 weeks', '9 days', '9 hours', '9 fortnight', '9', 'months',
  '-9 months', '+9 months', '−9 months', '±9 months', '9-10 months', '9–10 months',
  '- 9 months', '9 months - 10', '$ 9 months', '9 months €', '9 months / ref',
  '9/months', 'ref#9 months', '9 months\\tech', '1.5 months', '1,5 months',
  '١٫٥ أشهر', '1.5 years', '1,5 years', '1.2.9 months', '1,009 months', '1 009 months',
  'Ⅸ months', '⑨ months', '𝟡 months', '๙ months', '九か月', '9月', '9か月半',
  '9 moisXYZ', '9 mesesXYZ', '9 mesiXYZ', '9 mjeseciXYZ', '٩ أشهرXYZ',
  '9 months\u2066', '9 months\u0301', '9 months.technical', '9 months,technical',
] as const;
describe('Task082 G-I strict complete-token and numeric negatives', () => {
  it.each(['1 شهرين', '3 شهرين', '1 سنتين', '3 سنتين'])('explicit dual noun cannot contradict quantity: %s', (surface) => {
    expect(parse(surface)).toBeNull();
    expect(find(surface)).toEqual([]);
  });
  it.each(badSurfaces)('rejects contaminated/non-duration surface %s without a partial clean span', (surface) => {
    expect(parse(surface)).toBeNull();
    expect(find(surface)).toEqual([]);
  });
  it.each(nativeMonths)('%s full native unit cannot use a permissive prefix', (_locale, surface) => {
    expect(find(`${surface}XYZ`)).toEqual([]);
    expect(find(`XYZ${surface}`)).toEqual([]);
  });
  it('rejects unsafe integer multiplication rather than rounding', () => {
    expect(parse('9007199254740993 months')).toBeNull();
    expect(parse('750599937895083 years')).toBeNull();
    expect(parse('9007199254740991 months')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parse('750599937895082 years')).toBe(9007199254740984);
  });
  it('supports whole measurement with outer whitespace, but not arbitrary prose or punctuation stripping', () => {
    expect(parse('\t 9\u00a0months \n')).toBe(9);
    expect(parse('(9 months)')).toBeNull();
    expect(parse('about 9 months')).toBeNull();
    expect(parse('9 months.')).toBeNull();
  });
  it('does not invent compound grammar or add separate measurements', () => {
    const input = '1 year and 2 months';
    expect(parse(input)).toBeNull();
    expect(find(input)).toEqual([{ start: 0, end: 6, totalMonths: 12 }, { start: 11, end: 19, totalMonths: 2 }]);
  });
});

describe('Task082 J-L original coordinates and measurement-only authority', () => {
  it('identical values have ordered, distinct original positions', () => {
    expect(find('9 months ... 9 months')).toEqual([
      { start: 0, end: 8, totalMonths: 9 }, { start: 13, end: 21, totalMonths: 9 },
    ]);
  });
  it.each(nativeMonths)('%s coordinates preserve native units, numeral scripts, NBSP and a surrogate-pair prefix', (_locale, surface) => {
    const token = surface.replace(' ', '\u00a0');
    const input = `😀 [${token}]; ${token}.`;
    const first = input.indexOf(token);
    const second = input.lastIndexOf(token);
    const measurements = find(input);
    expect(measurements).toEqual([
      { start: first, end: first + token.length, totalMonths: 9 },
      { start: second, end: second + token.length, totalMonths: 9 },
    ]);
    for (const m of measurements) expect(input.slice(m.start, m.end)).toBe(token);
  });
  it('bounded unit NFC interpretation preserves decomposed original bytes and indices', () => {
    const token = '1 me\u0302s';
    const input = `😀 (${token})`;
    expect(find(input)).toEqual([{ start: 4, end: 4 + token.length, totalMonths: 1 }]);
    expect(parse(token)).toBe(1);
  });
  it.each(['Project lasted 9 months.', 'Education lasted 9 months.', 'Other activity lasted 9 months.'])('recognizes %s without assigning ownership', (input) => {
    const start = input.indexOf('9 months');
    const result = find(input);
    expect(result).toEqual([{ start, end: start + 8, totalMonths: 9 }]);
    expect(Object.keys(result[0]!)).toEqual(['start', 'end', 'totalMonths']);
  });
  it('independent calls have no global regex cursor or retained relation state', () => {
    expect(find('9 months')).toEqual(find('9 months'));
    expect(find('')).toEqual([]);
    expect(find('1 year')).toEqual([{ start: 0, end: 6, totalMonths: 12 }]);
  });
  it('normal punctuation can delimit a span, but contiguous CJK prose is not guessed', () => {
    expect(find('(9か月)')).toEqual([{ start: 1, end: 4, totalMonths: 9 }]);
    expect(find('勤続9か月')).toEqual([]);
    expect(find('9か月勤務')).toEqual([]);
  });
});

describe('Task082 M-N legacy helper and semantic extraction audit', () => {
  it.each(nativeMonths)('%s old helper interpretation remains historically truthful', (_locale, surface, legacyResult) => {
    expect(summaryV3StyleDurationMonthsFromSemanticSpan(`span:${surface}`)).toBe(legacyResult);
  });
  it('retains the old prefix evidence without delegating strict parsing to it', () => {
    expect(summaryV3StyleDurationMonthsFromSemanticSpan('span:9 monthsXYZ')).toBe(9);
    expect(summaryV3StyleDurationMonthsFromSemanticSpan('span:9 yearsXYZ')).toBe(108);
    expect(parse('9 monthsXYZ')).toBeNull();
    expect(parse('9 yearsXYZ')).toBeNull();
  });
  it.each(nativeMonths)('%s existing M5 extraction surfaces the native measurement independently of its legacy interpretation', (_locale, surface) => {
    const normalized = normalizeSummaryV3StyleNumericSurface(surface).toLowerCase();
    expect(summaryV3StyleFactAnchorTokens(surface)).toContain(`span:${normalized}`);
  });
});

// Reuse the retained offline immutable HEAD graph loader, never a live provider.
type Graph = {
  domain: typeof Domain;
  server: typeof Server & { audit: {
    first: (snapshot: Domain.SummaryV3StyleOperationSnapshot) => string | null;
    writer: (snapshot: Domain.SummaryV3StyleOperationSnapshot) => Server.SummaryV3StyleWriterInput;
  } };
};
type Harness = {
  before: Graph; after: Graph; cv: () => CVData;
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
const loaded: { exports: { task082?: Harness } } = { exports: {} };
new Function('require', 'module', 'exports', compiled + '\nexports.task082={before,after,cv,request,snapshot};\n')(
  (id: string) => id === 'vitest' ? {} : requireLocal(id), loaded, loaded.exports);
const h = loaded.exports.task082!;

describe('Task082 O immutable baseline differential / no runtime wiring', () => {
  it.each(['2026-09-01', '2026-10-01', '2027-02-01'])('snapshot/hash/request/provider input and source-floor parity at %s', (reference) => {
    const before = h.snapshot(h.before, reference);
    const after = h.snapshot(h.after, reference);
    expect(after).toEqual(before);
    expect(h.request(h.after, reference)).toEqual(h.request(h.before, reference));
    expect(h.after.server.audit.writer(after)).toEqual(h.before.server.audit.writer(before));
    expect(h.after.server.audit.first(after)).toBe(h.before.server.audit.first(before));
  });
  it('cannot confer a relation, refresh source or mutate CV persistence', () => {
    const cv = h.cv();
    const prior = structuredClone(cv);
    find('9 months');
    h.snapshot(h.after, '2026-10-01', cv);
    expect(cv).toEqual(prior);
    expect(Object.keys(h.request(h.after, '2026-10-01'))).not.toContain('tenureContext');
    expect(Object.keys(cv)).not.toContain('summaryEmploymentTenureRelations');
  });
});
