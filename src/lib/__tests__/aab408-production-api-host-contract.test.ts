/** @vitest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCvAiDiagnosticBuildIdentity,
  classifyApiHostClass,
  readAiApiHostClassificationContract,
} from '@/lib/cv-ai-diagnostics-contract';

const require = createRequire(import.meta.url);
const production = require('../../../scripts/android-production-api-contract.js') as {
  ANDROID_PRODUCTION_API_BASE_URL: string;
  PROTECTED_ANDROID_API_BASE_URL: string;
  ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION: string;
  readAndroidProductionApiHostContract: (value: unknown) => unknown;
  enforceAndroidProductionApiBaseUrl: (env: Record<string, string | undefined>) => string;
};
const internal = require('../../../scripts/android-internal-api-contract.js') as {
  resolveAndroidInternalApiContract: (env: Record<string, string | undefined>) => {
    mode: 'production' | 'preview';
    apiBaseUrl: string;
    hostClass: 'production' | 'vercel_preview';
  };
};
const commercial = require('../../../scripts/android-commercial-state-contract.js') as {
  COMMERCIAL_STATE: Record<string, string>;
  AndroidCommercialStateContractError: new (...args: never[]) => Error;
  resolveExpectedAndroidCommercialState: (contract: unknown) => Record<string, string>;
  buildManifest: (input: { apiHost: string; keyFingerprint: string }, expected: Record<string, string>) => Record<string, unknown>;
  assertManifest: (manifest: unknown, expected: Record<string, string>) => void;
};
const { runAndroidInternalBuild } = require('../../../scripts/build-android-internal.js') as {
  runAndroidInternalBuild: (options: {
    environment: Record<string, string | undefined>;
    dependencies: Record<string, unknown>;
  }) => {
    apiBaseUrl: string;
    expectedCommercialState: Record<string, string>;
    childEnvironment: Record<string, string | undefined>;
  };
};
const { runVerifyAndroidReleaseAssets } = require('../../../scripts/verify-android-release-assets.js') as {
  runVerifyAndroidReleaseAssets: (options: {
    environment: Record<string, string | undefined>;
    aabPath?: string;
    dependencies: Record<string, unknown>;
  }) => unknown;
};

const PUBLIC = 'https://ai-resume-builder-six-gamma.vercel.app';
const PROTECTED = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';
const PREVIEW = 'https://ai-resume-builder-kafmauyal-aicvcoverletterbuilders-projects.vercel.app';
const SECOND_PREVIEW = 'https://ai-resume-builder-oldfixture-aicvcoverletterbuilders-projects.vercel.app';
const REVISION = 'android-production-api-host-contract-408-v3';
const PREVIEW_SUFFIX = '-aicvcoverletterbuilders-projects.vercel.app';

function expectedCommercial(environment: Record<string, string | undefined>) {
  return commercial.resolveExpectedAndroidCommercialState(
    internal.resolveAndroidInternalApiContract(environment),
  );
}

function manifest(expected: Record<string, string>) {
  return commercial.buildManifest({
    apiHost: expected.apiHost,
    keyFingerprint: expected.revenueCatAndroidKeyFingerprint,
  }, expected);
}

function captureAndroidRunner(environment: Record<string, string | undefined>) {
  const expected = expectedCommercial(environment);
  const synced = manifest(expected);
  const childUrls: Array<string | undefined> = [];
  const assertions: Array<{ actual: unknown; expectedState: Record<string, string> }> = [];
  const result = runAndroidInternalBuild({
    environment: {
      NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'rc_test_public_key',
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
      NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
      ANDROID_VERSION_CODE: '408',
      ...environment,
    },
    dependencies: {
      loadEnvConfig: () => undefined,
      establishAndroidPackagingEnvironment: () => undefined,
      validateCheckedInCommercialState: () => undefined,
      assertManifest: (actual: unknown, expectedState: Record<string, string>) => {
        assertions.push({ actual, expectedState });
        commercial.assertManifest(actual, expectedState);
      },
      runFile: (_command: string, _args: string[], options: { env?: Record<string, string | undefined> }) => {
        childUrls.push(options.env?.NEXT_PUBLIC_API_BASE_URL);
      },
      treeContainsExactValue: () => true,
      fs: {
        writeFileSync: () => undefined,
        existsSync: () => true,
        readFileSync: (file: string) => {
          if (file.endsWith('android-commercial-state.json')) return JSON.stringify(synced);
          if (file.endsWith('aab392-internal-diagnostics-packaging.txt')) {
            return 'aab392-internal-diagnostics-packaging-v1\n';
          }
          return '{}';
        },
      },
    },
  });
  return { result, expected, synced, childUrls, assertions };
}

function verifyPhysicalManifest(
  environment: Record<string, string | undefined>,
  extractedManifest: unknown,
) {
  const expected = expectedCommercial(environment);
  const good = manifest(expected);
  return runVerifyAndroidReleaseAssets({
    environment,
    aabPath: 'captured.aab',
    dependencies: {
      verifySyncedAssets: () => ({
        staticManifest: structuredClone(good),
        syncedManifest: structuredClone(good),
        webDir: 'out',
        jsFileCount: 1,
      }),
      verifyAab: () => ({ extractedManifest, fullPath: 'captured.aab' }),
    },
  });
}

describe('AAB-408 M8 single commercial-state host authority', () => {
  it('keeps the named host contract and Production enforcement exact', () => {
    const json = JSON.parse(fs.readFileSync(
      path.resolve('src/lib/ai-api-host-classification-contract.json'),
      'utf8',
    ));
    const expectedContract = {
      revision: REVISION,
      publicProductionApiOrigin: PUBLIC,
      protectedProjectApiOrigin: PROTECTED,
      previewDeploymentHostSuffixes: [PREVIEW_SUFFIX],
    };
    expect(production.readAndroidProductionApiHostContract(json)).toEqual(expectedContract);
    expect(readAiApiHostClassificationContract(json)).toEqual(expectedContract);
    expect(production.ANDROID_PRODUCTION_API_BASE_URL).toBe(PUBLIC);
    expect(production.PROTECTED_ANDROID_API_BASE_URL).toBe(PROTECTED);
    expect(production.ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION).toBe(REVISION);
    expect(classifyApiHostClass(PREVIEW)).toBe('preview');
    expect(classifyApiHostClass(PUBLIC)).toBe('production');
    expect(buildCvAiDiagnosticBuildIdentity({ apiBaseUrlConfigured: true })
      .apiHostClassificationContractRevision).toBe(REVISION);

    const environment: Record<string, string | undefined> = { NEXT_PUBLIC_API_BASE_URL: PROTECTED };
    expect(production.enforceAndroidProductionApiBaseUrl(environment)).toBe(PUBLIC);
    expect(environment.NEXT_PUBLIC_API_BASE_URL).toBe(PUBLIC);
  });

  it('uses one immutable commercial-state projection for exact Preview packaging', () => {
    const expected = expectedCommercial({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
    });
    const packaged = manifest(expected);
    expect(expected.apiHost).toBe(PREVIEW);
    expect(Object.isFrozen(expected)).toBe(true);
    expect(packaged.apiHost).toBe(PREVIEW);
    expect(() => commercial.assertManifest(packaged, expected)).not.toThrow();
  });

  it('fails closed through the established commercial-state owner', () => {
    const previewExpected = expectedCommercial({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    });
    const previewManifest = manifest(previewExpected);
    const productionExpected = expectedCommercial({});

    expect(() => commercial.resolveExpectedAndroidCommercialState(undefined))
      .toThrow(commercial.AndroidCommercialStateContractError);
    expect(() => commercial.assertManifest(previewManifest, Object.freeze({ ...previewExpected })))
      .toThrow(commercial.AndroidCommercialStateContractError);
    expect(() => commercial.assertManifest(previewManifest, productionExpected))
      .toThrow(commercial.AndroidCommercialStateContractError);
    expect(() => commercial.assertManifest(manifest(productionExpected), previewExpected))
      .toThrow(commercial.AndroidCommercialStateContractError);
    previewManifest.apiHost = SECOND_PREVIEW;
    expect(() => commercial.assertManifest(previewManifest, previewExpected))
      .toThrow(/manifest.apiHost/u);
  });

  it.each([
    ['Production', {}, PUBLIC],
    ['Preview', { CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PREVIEW }, PREVIEW],
  ])('binds resolved %s host to child environment and synced commercial manifest', (_mode, environment, host) => {
    const capture = captureAndroidRunner(environment);
    expect(capture.result.apiBaseUrl).toBe(host);
    expect(capture.result.expectedCommercialState.apiHost).toBe(host);
    expect(capture.expected.apiHost).toBe(host);
    expect(capture.synced.apiHost).toBe(host);
    expect(capture.result.childEnvironment.NEXT_PUBLIC_API_BASE_URL).toBe(host);
    expect(capture.childUrls).toHaveLength(4);
    expect(new Set(capture.childUrls)).toEqual(new Set([host]));
    expect(capture.assertions).toEqual([{ actual: capture.synced, expectedState: capture.expected }]);
  });

  it('uses the same commercial-state expectation for physical AAB manifest validation', () => {
    const environment = {
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    };
    expect(() => verifyPhysicalManifest(environment, manifest(expectedCommercial(environment))))
      .not.toThrow();
    const wrong = manifest(expectedCommercial(environment));
    wrong.apiHost = PROTECTED;
    expect(() => verifyPhysicalManifest(environment, wrong)).toThrow(/manifest.apiHost/u);
  });
});

describe('Android runtime API base precedence', () => {
  const originalBuildTimeApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    if (originalBuildTimeApiBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalBuildTimeApiBaseUrl;
  });

  async function resolveRuntimeApiBaseUrl(buildTimeApiBaseUrl: string | undefined, stored: string | null) {
    if (buildTimeApiBaseUrl === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = buildTimeApiBaseUrl;
    if (stored !== null) localStorage.setItem('cvpro_api_base_url', stored);
    vi.resetModules();
    const { getApiBaseUrl } = await import('@/lib/api');
    return getApiBaseUrl();
  }

  it.each([
    ['build-time Production over stored protected', PUBLIC, PROTECTED, PUBLIC],
    ['build-time Preview over stored protected', PREVIEW, PROTECTED, PREVIEW],
    ['build-time Preview over stored localhost', PREVIEW, 'http://localhost:3000', PREVIEW],
    ['build-time Preview over stored second Preview', PREVIEW, SECOND_PREVIEW, PREVIEW],
    ['no build-time value preserves valid stored fallback', undefined, PROTECTED, PROTECTED],
    ['no build-time value rejects invalid stored fallback', undefined, 'http://localhost:3000', ''],
  ])('resolves %s', async (_name, buildTimeApiBaseUrl, stored, expected) => {
    await expect(resolveRuntimeApiBaseUrl(buildTimeApiBaseUrl, stored)).resolves.toBe(expected);
  });
});
