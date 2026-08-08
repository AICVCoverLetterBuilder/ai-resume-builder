import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const contract = require('../../../scripts/android-production-api-contract.js') as {
  ANDROID_PRODUCTION_API_BASE_URL: string;
  PROTECTED_ANDROID_API_BASE_URL: string;
  ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION: string;
  enforceAndroidProductionApiBaseUrl: (env: Record<string, string | undefined>) => string;
};

const PUBLIC = 'https://ai-resume-builder-six-gamma.vercel.app';
const PROTECTED = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';
const REVISION = 'android-production-api-public-host-contract-408-v2';

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
});