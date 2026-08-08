import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const contract = require('../../../scripts/android-production-api-contract.js') as {
  ANDROID_PRODUCTION_API_BASE_URL: string;
  LEGACY_ANDROID_API_BASE_URL: string;
  ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION: string;
  enforceAndroidProductionApiBaseUrl: (env: Record<string, string | undefined>) => string;
};

const CANONICAL = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';
const LEGACY = 'https://ai-resume-builder-six-gamma.vercel.app';
const REVISION = 'android-production-api-host-contract-408-v1';

describe('AAB-408 Android Production API host contract', () => {
  it('pins future Android packaging directly to the canonical Production alias', () => {
    expect(contract.ANDROID_PRODUCTION_API_BASE_URL).toBe(CANONICAL);
    expect(contract.LEGACY_ANDROID_API_BASE_URL).toBe(LEGACY);
    expect(contract.ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION).toBe(REVISION);

    const env: Record<string, string | undefined> = {
      NEXT_PUBLIC_API_BASE_URL: LEGACY,
    };

    expect(contract.enforceAndroidProductionApiBaseUrl(env)).toBe(CANONICAL);
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe(CANONICAL);

  });

  it('forces both internal Android build paths through the shared canonical contract', () => {
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

    expect(androidBuild).toContain('LEGACY_ANDROID_API_BASE_URL');
    expect(androidBuild).toContain(
      'deprecated Android API alias is present in copied Android assets',
    );
  });

  it('rejects the deprecated Android alias from final copied assets', () => {
    const androidBuild = fs.readFileSync(
      path.resolve('scripts/build-android-internal.js'),
      'utf8',
    );

    expect(androidBuild).toContain(
      'treeContainsExactValue(copied, LEGACY_ANDROID_API_BASE_URL)',
    );
    expect(CANONICAL).not.toBe(LEGACY);
  });
});