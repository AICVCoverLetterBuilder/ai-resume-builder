import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  buildCvAiDiagnosticBuildIdentity,
  classifyApiHostClass,
  readAiApiHostClassificationContract,
} from '@/lib/cv-ai-diagnostics-contract';

const require = createRequire(import.meta.url);
const contract = require('../../../scripts/android-production-api-contract.js') as {
  ANDROID_PRODUCTION_API_BASE_URL: string;
  PROTECTED_ANDROID_API_BASE_URL: string;
  ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION: string;
  readAndroidProductionApiHostContract: (value: unknown) => {
    revision: string;
    publicProductionApiOrigin: string;
    protectedProjectApiOrigin: string;
    previewDeploymentHostSuffixes: readonly string[];
  };
  enforceAndroidProductionApiBaseUrl: (env: Record<string, string | undefined>) => string;
};

const PUBLIC = 'https://ai-resume-builder-six-gamma.vercel.app';
const PROTECTED = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';
const REVISION = 'android-production-api-host-contract-408-v3';
const PREVIEW_SUFFIX = '-aicvcoverletterbuilders-projects.vercel.app';

const validContract = {
  revision: REVISION,
  publicProductionApiOrigin: PUBLIC,
  protectedProjectApiOrigin: PROTECTED,
  previewDeploymentHostSuffixes: [PREVIEW_SUFFIX],
};

describe('AAB-408 Android Production API host contract', () => {
  it('pins future Android packaging directly to the public Production API alias', () => {
    expect(contract.ANDROID_PRODUCTION_API_BASE_URL).toBe(PUBLIC);
    expect(contract.PROTECTED_ANDROID_API_BASE_URL).toBe(PROTECTED);
    expect(contract.ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION).toBe(REVISION);

    const env: Record<string, string | undefined> = {
      NEXT_PUBLIC_API_BASE_URL: PROTECTED,
    };

    expect(contract.enforceAndroidProductionApiBaseUrl(env)).toBe(PUBLIC);
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe(PUBLIC);
  });

  it('uses named JSON semantics without a positional origin-order dependency', () => {
    const json = JSON.parse(fs.readFileSync(
      path.resolve('src/lib/ai-api-host-classification-contract.json'),
      'utf8',
    ));
    expect(json.revision).toBe(REVISION);
    expect(json.publicProductionApiOrigin).toBe(PUBLIC);
    expect(json.protectedProjectApiOrigin).toBe(PROTECTED);
    expect(contract.readAndroidProductionApiHostContract(json)).toEqual({
      revision: REVISION,
      publicProductionApiOrigin: PUBLIC,
      protectedProjectApiOrigin: PROTECTED,
      previewDeploymentHostSuffixes: [PREVIEW_SUFFIX],
    });
    expect(contract.readAndroidProductionApiHostContract({
      ...validContract,
      protectedProjectApiOrigin: PROTECTED,
      additionalProductionApiOrigin: 'https://future.example.test',
    })).toMatchObject({
      publicProductionApiOrigin: PUBLIC,
      protectedProjectApiOrigin: PROTECTED,
    });
    expect(() => contract.readAndroidProductionApiHostContract({
      ...validContract,
      publicProductionApiOrigin: undefined,
    })).toThrow('publicProductionApiOrigin');
    expect(() => contract.readAndroidProductionApiHostContract({
      ...validContract,
      publicProductionApiOrigin: 'http://ai-resume-builder-six-gamma.vercel.app',
    })).toThrow('canonical HTTPS origin');
    expect(readAiApiHostClassificationContract(json)).toEqual(
      contract.readAndroidProductionApiHostContract(json),
    );
  });

  it.each([
    ['missing', undefined],
    ['non-array', PREVIEW_SUFFIX],
    ['empty array', []],
    ['empty string', ['']],
    ['bare vercel.app', ['vercel.app']],
    ['broad .vercel.app', ['.vercel.app']],
    ['protocol', [`https://${PREVIEW_SUFFIX}`]],
    ['slash', [`${PREVIEW_SUFFIX}/path`]],
    ['query', [`${PREVIEW_SUFFIX}?x=1`]],
    ['fragment', [`${PREVIEW_SUFFIX}#x`]],
    ['whitespace', [`${PREVIEW_SUFFIX} `]],
    ['port', [`${PREVIEW_SUFFIX}:443`]],
    ['uppercase', [PREVIEW_SUFFIX.toUpperCase()]],
    ['duplicate', [PREVIEW_SUFFIX, PREVIEW_SUFFIX]],
  ])('rejects malformed Preview suffix contract: %s', (_name, previewDeploymentHostSuffixes) => {
    const candidate = { ...validContract, previewDeploymentHostSuffixes };
    expect(() => contract.readAndroidProductionApiHostContract(candidate)).toThrow(/previewDeploymentHostSuffixes/u);
    expect(() => readAiApiHostClassificationContract(candidate)).toThrow(/previewDeploymentHostSuffixes/u);
    expect(classifyApiHostClass('https://unrelated.vercel.app')).toBe('unknown');
  });

  it('classifies only named HTTPS origins and supported immutable Preview shapes', () => {
    expect(classifyApiHostClass('https://ai-resume-builder-881wxzajh-aicvcoverletterbuilders-projects.vercel.app')).toBe('preview');
    expect(classifyApiHostClass('https://ai-resume-builder-jgw67jqu2-aicvcoverletterbuilders-projects.vercel.app')).toBe('preview');
    expect(classifyApiHostClass('https://ai-resume-builder-git-branch-aicvcoverletterbuilders-projects.vercel.app')).toBe('preview');
    expect(classifyApiHostClass(PUBLIC)).toBe('production');
    expect(classifyApiHostClass(PROTECTED)).toBe('production');
    expect(classifyApiHostClass('')).toBe('relative');
    expect(classifyApiHostClass('not a URL')).toBe('unknown');
    expect(classifyApiHostClass('https://unrelated.example.test')).toBe('unknown');
    expect(classifyApiHostClass('http://ai-resume-builder-881wxzajh-aicvcoverletterbuilders-projects.vercel.app')).toBe('unknown');
    expect(classifyApiHostClass('http://ai-resume-builder-six-gamma.vercel.app')).toBe('unknown');
    expect(buildCvAiDiagnosticBuildIdentity({ apiBaseUrlConfigured: true })
      .apiHostClassificationContractRevision).toBe(REVISION);
  });

  it('forces both internal Android build paths through the shared public-host contract', () => {
    const androidBuild = fs.readFileSync(
      path.resolve('scripts/build-android-internal.js'),
      'utf8',
    );
    const staticBuild = fs.readFileSync(
      path.resolve('scripts/build-static-internal.js'),
      'utf8',
    );

    for (const source of [androidBuild, staticBuild]) {
      expect(source).toContain("require('./android-production-api-contract')");
      expect(source).toContain('enforceAndroidProductionApiBaseUrl(process.env)');
      expect(source).toContain('ANDROID_PRODUCTION_API_BASE_URL');
    }

    expect(androidBuild).toContain('PROTECTED_ANDROID_API_BASE_URL');
    expect(androidBuild).toContain(
      'Vercel-protected API host is present in copied Android assets',
    );
  });

  it('rejects the Vercel-protected project domain from final copied assets', () => {
    const androidBuild = fs.readFileSync(
      path.resolve('scripts/build-android-internal.js'),
      'utf8',
    );

    expect(androidBuild).toContain(
      'treeContainsExactValue(copied, PROTECTED_ANDROID_API_BASE_URL)',
    );
    expect(PUBLIC).not.toBe(PROTECTED);
  });

  it('forces production static export through the same public API-host contract', () => {
    const productionStaticBuild = fs.readFileSync(
      path.resolve('scripts/build-static.js'),
      'utf8',
    );

    expect(productionStaticBuild).toContain("require('./android-production-api-contract')");
    expect(productionStaticBuild).toContain('enforceAndroidProductionApiBaseUrl(process.env)');
  });

  it('does not change the API resolver implementation or introduce networking', () => {
    const api = fs.readFileSync(path.resolve('src/lib/api.ts'), 'utf8');
    expect(api).toContain('export function getApiBaseUrl');
    expect(api).toContain('export function resolveApiUrl');
    expect(api).not.toContain('ai-api-host-classification-contract');
  });
});
