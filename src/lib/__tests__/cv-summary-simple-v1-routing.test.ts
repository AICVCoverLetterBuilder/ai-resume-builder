import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCvSimpleV1Enabled } from '@/lib/cv-simple-v1';

const pageSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/cv-builder/page.tsx'),
  'utf8',
);
const routeSource = fs.readFileSync(
  path.join(process.cwd(), 'src/app/api/generate/route.ts'),
  'utf8',
);

describe('Simple V1 Summary feature routing', () => {
  it('24. flag OFF preserves the existing Generate and rewrite provider actions', () => {
    expect(isCvSimpleV1Enabled('false')).toBe(false);
    expect(isCvSimpleV1Enabled('0')).toBe(false);
    expect(pageSource).toContain("action: 'summary'");
    expect(pageSource).toContain("action: 'rewrite'");
  });

  it('25. flag ON routes Generate exclusively through the Simple V1 shared function', () => {
    expect(isCvSimpleV1Enabled('true')).toBe(true);
    const handler = pageSource.slice(
      pageSource.indexOf('const handleGenSummary = async () => {'),
      pageSource.indexOf("const handleGenBullets = async", pageSource.indexOf('const handleGenSummary = async () => {')),
    );
    expect(handler).toMatch(/if \(simpleCvV1Enabled\) \{\s*await handleSimpleSummaryOperation\('generate'\);\s*return;/u);
    expect(handler.indexOf("handleSimpleSummaryOperation('generate')"))
      .toBeLessThan(handler.indexOf("action: 'summary'"));
  });

  it('routes all three rewrite buttons through the same function with a style parameter', () => {
    const handlerStart = pageSource.indexOf("const handleRewrite = async (style: 'shorter' | 'stronger' | 'professional') => {");
    const handler = pageSource.slice(handlerStart, pageSource.indexOf('const handleAnalyzeJob', handlerStart));
    expect(handler).toMatch(/if \(simpleCvV1Enabled\) \{\s*await handleSimpleSummaryOperation\('rewrite', style\);\s*return;/u);
    expect(handler.indexOf("handleSimpleSummaryOperation('rewrite', style)"))
      .toBeLessThan(handler.indexOf("action: 'rewrite'"));
  });

  it('keeps the new server action isolated from legacy localization, recovery, and repair', () => {
    const simpleStart = routeSource.indexOf("if (action === 'summary-simple-v1')");
    const legacyStart = routeSource.indexOf("if (action === 'summary')", simpleStart);
    const simpleBranch = routeSource.slice(simpleStart, legacyStart);
    expect(simpleBranch).toContain('await callWithRetry');
    expect(simpleBranch).not.toMatch(/localiz|deterministic|canonicalSummary|repairAttempted|finalize/iu);
  });
});
