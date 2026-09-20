import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isAiCoreV3Enabled,
  resetAiCoreV3TestOverride,
  resolveAiCoreV3Mode,
  setAiCoreV3TestOverride,
} from '../feature-flag';

const require = createRequire(import.meta.url);
const featureFlagSource = fs.readFileSync(path.resolve('src/lib/ai-core-v3/feature-flag.ts'), 'utf8');
const nextConfigSource = fs.readFileSync(path.resolve('next.config.ts'), 'utf8');
const pageSource = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
const routeSource = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
const androidContractPath = path.resolve('scripts/android-internal-v3-routing-contract.js');
const androidContractSource = fs.readFileSync(androidContractPath, 'utf8');
const androidContract = require(androidContractPath) as {
  enforceAndroidInternalV3RoutingContract: (environment: Record<string, string | undefined>) => {
    revision: string;
    publicFlag: 'true';
    summaryStyleOwner: 'm5';
  };
  assertAndroidInternalM5Assets: (blob: string) => {
    compiledPublicFlag: true;
    summaryStyleOwner: 'm5';
  };
};

function sourceBetween(source: string, start: string, end: string): string {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  expect(startAt).toBeGreaterThanOrEqual(0);
  expect(endAt).toBeGreaterThan(startAt);
  return source.slice(startAt, endAt);
}

function expectRollbackGuardBefore(block: string, ...laterMarkers: string[]): void {
  const guardAt = block.indexOf('if (!aiCoreV3Enabled)');
  const unavailableAt = block.indexOf("aiErrorMessage('ai_feature_unavailable'");
  expect(guardAt).toBeGreaterThanOrEqual(0);
  expect(unavailableAt).toBeGreaterThan(guardAt);
  for (const marker of laterMarkers) {
    expect(block.indexOf(marker)).toBeGreaterThan(unavailableAt);
  }
}

describe('M9 V3-default and explicit V2 rollback architecture', () => {
  afterEach(() => resetAiCoreV3TestOverride());

  it('A-D. resolves absent, true, false, and invalid values through one fail-closed policy', () => {
    expect(resolveAiCoreV3Mode()).toBe('v3_default');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: undefined })).toBe('v3_default');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: '' })).toBe('v3_default');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'true' })).toBe('v3_default');
    expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'false' })).toBe('v2_rollback');
    for (const invalid of ['TRUE', 'False', '1', ' true ', 'disabled']) {
      expect(resolveAiCoreV3Mode({ NEXT_PUBLIC_AI_CORE_V3_ENABLED: invalid })).toBe('v2_rollback');
    }
  });

  it('E-H. keeps the override module-local and the policy free of persisted/user-domain ownership', () => {
    setAiCoreV3TestOverride(false);
    expect(isAiCoreV3Enabled()).toBe(false);
    resetAiCoreV3TestOverride();
    expect(isAiCoreV3Enabled()).toBe(true);
    expect(featureFlagSource).not.toMatch(/localStorage|sessionStorage|isPro|entitlement|usage|locale|currentCv|CVData/u);
    expect(featureFlagSource.match(/function resolveAiCoreV3Mode/g)).toHaveLength(1);
  });

  it('I-J. compiles and consumes one public selector with no private server route authority', () => {
    const runtimeSources = [featureFlagSource, nextConfigSource, pageSource, routeSource, androidContractSource];
    expect(nextConfigSource).toContain('resolveAiCoreV3Mode');
    expect(nextConfigSource).toContain('NEXT_PUBLIC_AI_CORE_V3_ENABLED: compiledAiCoreV3Selector');
    expect(pageSource.match(/isAiCoreV3Enabled\s*\(/g)).toHaveLength(1);
    expect(routeSource.match(/isAiCoreV3Enabled\s*\(/g)).toHaveLength(1);
    expect(runtimeSources.join('\n')).not.toMatch(/\bAI_CORE_V3_ENABLED\b/u);
    expect(runtimeSources.join('\n')).not.toMatch(/localStorage[^\n]*(?:AI_CORE|V3)|(?:AI_CORE|V3)[^\n]*localStorage/u);
  });

  it('K. retains the exact V2 Summary, rewrite, and bullets route actions', () => {
    expect(routeSource).toContain("if (action === 'summary')");
    expect(routeSource).toContain("if (action === 'rewrite')");
    expect(routeSource).toContain("if (action === 'bullets')");
    expect(pageSource).toContain("action: 'summary'");
    expect(pageSource).toContain("action: 'rewrite'");
    expect(pageSource).toContain("action: 'bullets'");
  });

  it('L-M. makes Summary localization explicitly unavailable before auth, request, provider, or usage work', () => {
    const open = sourceBetween(pageSource, 'const openSummaryTranslateDialog', 'const confirmSummaryTranslate');
    const confirm = sourceBetween(pageSource, 'const confirmSummaryTranslate', 'const closeExperienceTranslateDialog');
    expectRollbackGuardBefore(open, 'const liveCv = cvRef.current');
    expectRollbackGuardBefore(
      confirm,
      'getCurrentProTokenOrToast',
      'beginAiClientRequest',
      'getProAiUsageCount',
      'runContentLocalizeV3ClientOperation',
    );
    expect(confirm).not.toMatch(/action:\s*['"](?:summary|rewrite|bullets)['"]/u);
  });

  it('L-M. makes Experience localization explicitly unavailable before auth, request, provider, or usage work', () => {
    const open = sourceBetween(pageSource, 'const openExperienceTranslateDialog', 'const confirmExperienceTranslate');
    const confirm = sourceBetween(pageSource, 'const confirmExperienceTranslate', 'const handleRewrite');
    expectRollbackGuardBefore(open, 'const liveCv = cvRef.current');
    expectRollbackGuardBefore(
      confirm,
      'getCurrentProTokenOrToast',
      'beginAiClientRequest',
      'getProAiUsageCount',
      'runContentLocalizeV3ExperienceClientOperation',
    );
    expect(confirm).not.toMatch(/action:\s*['"](?:summary|rewrite|bullets)['"]/u);
  });

  it('N. internal Android forcing uses the same one public selector', () => {
    const environment: Record<string, string | undefined> = { UNRELATED_SENTINEL: 'preserved' };
    expect(androidContract.enforceAndroidInternalV3RoutingContract(environment)).toEqual({
      revision: 'android-internal-v3-routing-contract-m9-v1',
      publicFlag: 'true',
      summaryStyleOwner: 'm5',
    });
    expect(environment).toEqual({
      UNRELATED_SENTINEL: 'preserved',
      NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'true',
    });
    expect(androidContractSource).not.toMatch(/\bAI_CORE_V3_ENABLED\b/u);
  });

  it('N. rejects unresolved or rollback Android assets and accepts compiled V3 assets', () => {
    const enabled = [
      'm5Operation',
      'summary_style',
      'summary_stronger',
      'notApplicableDiagnosticFieldViolations',
      'NEXT_PUBLIC_AI_CORE_V3_ENABLED:"true"',
    ].join(' ');
    expect(androidContract.assertAndroidInternalM5Assets(enabled)).toMatchObject({ compiledPublicFlag: true });
    expect(() => androidContract.assertAndroidInternalM5Assets(
      enabled.replace('"true"', 'runtime.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED'),
    )).toThrow(/remained a runtime lookup/u);
    expect(() => androidContract.assertAndroidInternalM5Assets(
      enabled.replace('"true"', '"false"'),
    )).toThrow(/compiled AI Core V3 enabled route/u);
  });

  it('O. commercial/static absent-selector semantics resolve V3 and all page dispatch owners consume that mode', () => {
    expect(isAiCoreV3Enabled({})).toBe(true);
    expect(pageSource).toContain('const summaryV3Enabled = aiCoreV3Enabled');
    expect(pageSource).toContain('const experienceV3Enabled = aiCoreV3Enabled');
    expect(pageSource).toContain('if (aiCoreV3Enabled) {\n      await handleSummaryV3Style(style);');
    expect(pageSource).toContain('runContentLocalizeV3ClientOperation');
    expect(pageSource).toContain('runContentLocalizeV3ExperienceClientOperation');
  });
});
