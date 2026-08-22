import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCvSimpleV1Enabled } from '@/lib/cv-simple-v1';

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const roleSource = source('src/lib/cv-known-role-simple-v1.ts');
const mappingSource = source('src/lib/cv-known-role-title-mappings.ts');
const summarySource = source('src/lib/cv-summary-simple-v1.ts');
const renderSource = source('src/lib/cv-render-model-simple-v1.ts');
const builderSource = source('src/app/cv-builder/page.tsx');
const coverLetterSource = source('src/app/cover-letter/page.tsx');
const typesSource = source('src/lib/types.ts');

describe('Simple V1 M4 routing and final legacy separation', () => {
  it('27. the existing positionSourceKey field is the typed known-role identity', () => {
    expect(typesSource).toContain("export type KnownRoleKey = 'graphic_designer' | 'warehouse_worker'");
    expect(typesSource).toContain('positionSourceKey?: KnownRoleKey;');
    expect(typesSource).not.toContain('roleKey?:');
  });

  it('28. one resolver consumes one neutral mapping source without heuristics', () => {
    const imports = roleSource.split('\n').filter((line) => line.startsWith('import ')).join('\n');
    expect(roleSource).toContain('export function getRoleDisplayTitle');
    expect(roleSource).toContain("from './cv-known-role-title-mappings'");
    expect(imports).not.toMatch(/cv-summary|cv-role-title|recovery|provider|ai-|translate/iu);
    expect(roleSource).not.toMatch(/fetch\(|\/api\/generate|RegExp|\.match\(|\.test\(/u);
  });

  it('29. the extracted mapping source is deterministic and contains all 12 locale branches', () => {
    for (const locale of ['sr', 'en', 'hi', 'ar', 'ja', 'de', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru']) {
      expect(mappingSource, locale).toContain(`locale === '${locale}'`);
    }
    expect(mappingSource).not.toMatch(/fetch\(|\/api\/|provider|recovery|summary-v2/iu);
  });

  it('30. M2 builds structured role context through the shared resolver', () => {
    expect(summarySource).toContain("from './cv-known-role-simple-v1'");
    expect(summarySource).toContain('position: resolveExperienceRoleDisplayTitle(');
    expect(summarySource).toContain('const facts = buildSimpleSummaryFacts(sourceCv, contentLocale)');
    expect(summarySource).not.toMatch(/cv-summary-v2|summary recovery|deterministicSummary/iu);
  });

  it('31. M3 derives presentation titles through the same resolver before rendering', () => {
    const imports = renderSource.split('\n').filter((line) => line.startsWith('import ')).join('\n');
    expect(renderSource).toContain("from './cv-known-role-simple-v1'");
    expect(renderSource).toContain('position: resolveExperienceRoleDisplayTitle(entry, contentLocale, gender)');
    expect(imports).not.toMatch(/cv-summary-v2|prepareExportReady|recovery/iu);
    expect(renderSource).not.toMatch(/fetch\(|\/api\/generate/iu);
  });

  it('32. Cover Letter uses projected Experience context only when Simple V1 is ON', () => {
    const start = coverLetterSource.indexOf('const rawExperienceEntries =');
    const branch = coverLetterSource.slice(start, coverLetterSource.indexOf('const skills =', start));
    expect(branch).toContain('simpleCvV1Enabled && currentCv');
    expect(branch).toContain('projectExperienceRoleDisplayTitles(');
    expect(branch).toContain('getCvContentLocale(currentCv, { uiLocale: locale })');
    expect(branch).toContain(': rawExperienceEntries');
  });

  it('33. manual editor typing clears identity only inside the feature-ON branch', () => {
    const start = builderSource.indexOf('const updateExperience =');
    const branch = builderSource.slice(start, builderSource.indexOf('const addEducation', start));
    expect(branch).toContain("simpleCvV1Enabled && field === 'position'");
    expect(branch).toContain('clearKnownRoleIdentityForManualPositionEdit(edited, id)');
    expect(branch).toContain(': edited');
  });

  it('34. all four Summary buttons retain the single M2 handler boundary', () => {
    expect(builderSource).toContain("await handleSimpleSummaryOperation('generate')");
    expect(builderSource).toContain("await handleSimpleSummaryOperation('rewrite', style)");
    expect((builderSource.match(/const handleSimpleSummaryOperation = async/gu) || [])).toHaveLength(1);
  });

  it('35. feature ON role, Summary, and render modules import no legacy Summary V2', () => {
    const simpleRuntime = [roleSource, mappingSource, summarySource, renderSource].join('\n');
    expect(simpleRuntime).not.toMatch(/from ['"].*cv-summary-v2|from ['"].*summary-(?:locale|recovery)|prepare-export-ready-cv/iu);
    expect(simpleRuntime).not.toMatch(/canonicalSummary|summaryGeneratedLocale|generatedLocale arbitration/iu);
  });

  it('36. feature OFF remains available and keeps raw Cover Letter Experience context', () => {
    expect(isCvSimpleV1Enabled('false')).toBe(false);
    expect(isCvSimpleV1Enabled(undefined)).toBe(false);
    expect(coverLetterSource).toContain(': rawExperienceEntries');
    expect(builderSource).toContain('normalizeLegacyCvRuntime(source, locale)');
    expect(builderSource).toContain("action: 'summary'");
    expect(builderSource).toContain("action: 'rewrite'");
  });
});
