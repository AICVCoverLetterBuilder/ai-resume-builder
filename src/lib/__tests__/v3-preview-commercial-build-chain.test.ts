import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const commercial = require('../../../scripts/android-commercial-state-contract.js');
const internalApi = require('../../../scripts/android-internal-api-contract.js');
const { runStaticInternalBuild } = require('../../../scripts/build-static-internal.js');
const { runProductionStaticBuild } = require('../../../scripts/build-static.js');
const { runAndroidInternalBuild } = require('../../../scripts/build-android-internal.js');
const { runVerifyAndroidReleaseAssets } = require('../../../scripts/verify-android-release-assets.js');
const { runAndroidCleanBuild } = require('../../../scripts/build-android-clean.js');

const PRODUCTION = 'https://ai-resume-builder-six-gamma.vercel.app';
const PREVIEW = 'https://example-project-random-team.vercel.app';
const PROTECTED = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';

type Environment = Record<string, string | undefined>;
type ChildCall = { command: string; args: string[]; options: { env?: Environment } };

function resolveProduction() {
  return internalApi.resolveAndroidInternalApiContract({});
}

function resolvePreview() {
  return internalApi.resolveAndroidInternalApiContract({
    CV_V3_ANDROID_API_MODE: 'preview',
    NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
  });
}

function expectedProduction() {
  return commercial.resolveExpectedAndroidCommercialState(resolveProduction());
}

function expectedPreview() {
  return commercial.resolveExpectedAndroidCommercialState(resolvePreview());
}

function manifest(expected = expectedProduction()) {
  return commercial.buildManifest({
    apiHost: expected.apiHost,
    keyFingerprint: expected.revenueCatAndroidKeyFingerprint,
  }, expected);
}

function environment(overrides: Environment = {}): Environment {
  return {
    NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'rc_public_test_key',
    NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'true',
    NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
    NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
    UNRELATED_SENTINEL: 'preserved',
    ...overrides,
  };
}

function staticExecution(overrides: Environment = {}) {
  const childCalls: ChildCall[] = [];
  const writes: unknown[] = [];
  const result = runStaticInternalBuild({
    environment: environment(overrides),
    dependencies: {
      execFileSync: (command: string, args: string[], options: ChildCall['options']) => {
        childCalls.push({ command, args, options });
      },
      loadEnvConfig: () => undefined,
      establishAndroidPackagingEnvironment: () => ({
        fingerprint: commercial.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint,
      }),
      validateCheckedInCommercialState: () => undefined,
      writeManifest: (_directory: string, value: unknown) => writes.push(value),
      treeContainsExactValue: () => true,
    },
  });
  return { result, childCalls, writes };
}

function androidExecution(expected: Record<string, string>, overrides: Environment = {}) {
  const childCalls: ChildCall[] = [];
  const fsWrites: string[] = [];
  const expectedManifest = manifest(expected);
  const result = runAndroidInternalBuild({
    environment: environment(overrides),
    dependencies: {
      loadEnvConfig: () => undefined,
      establishAndroidPackagingEnvironment: () => undefined,
      validateCheckedInCommercialState: () => undefined,
      runFile: (command: string, args: string[], options: ChildCall['options']) => {
        childCalls.push({ command, args, options });
      },
      treeContainsExactValue: (_root: string, value: string) => value !== PROTECTED,
      fs: {
        writeFileSync: () => fsWrites.push('captured'),
        existsSync: () => true,
        readFileSync: (file: string) => {
          if (file.endsWith('android-commercial-state.json')) return JSON.stringify(expectedManifest);
          if (file.endsWith('aab392-internal-diagnostics-packaging.txt')) {
            return 'aab392-internal-diagnostics-packaging-v1\n';
          }
          return '{}';
        },
      },
    },
  });
  return { result, childCalls, fsWrites, expectedManifest };
}

function verifierExecution(
  expected: Record<string, string>,
  overrides: Environment = {},
  layers: Partial<Record<'staticManifest' | 'syncedManifest' | 'extractedManifest', unknown>> = {},
) {
  const good = manifest(expected);
  return runVerifyAndroidReleaseAssets({
    environment: overrides,
    aabPath: 'captured.aab',
    dependencies: {
      verifySyncedAssets: () => ({
        staticManifest: layers.staticManifest ?? structuredClone(good),
        syncedManifest: layers.syncedManifest ?? structuredClone(good),
        webDir: 'out',
        jsFileCount: 1,
      }),
      verifyAab: () => ({
        extractedManifest: layers.extractedManifest ?? structuredClone(good),
        fullPath: 'captured.aab',
      }),
    },
  });
}

function cleanExecution(overrides: Environment = {}) {
  const calls: Array<{ command: string; environment: Environment }> = [];
  const result = runAndroidCleanBuild({
    environment: overrides,
    dependencies: {
      removeIfExists: () => undefined,
      run: (command: string, childEnvironment: Environment) => {
        calls.push({ command, environment: { ...childEnvironment } });
      },
      assertFile: () => undefined,
      assertCapacitorConfigNoServerUrl: () => undefined,
      verifySyncedAppChunks: () => undefined,
      verifyStaticFonts: () => [],
    },
  });
  return { result, calls };
}

describe('M4 preview commercial-state projection', () => {
  it('1. production projection returns the exact production singleton', () => {
    expect(expectedProduction()).toBe(commercial.COMMERCIAL_STATE);
    expect(expectedProduction().apiHost).toBe(PRODUCTION);
  });

  it('2. explicit production contract retains every production field', () => {
    expect(expectedProduction()).toEqual(commercial.COMMERCIAL_STATE);
  });

  it('3. preview projection returns a new immutable state', () => {
    const expected = expectedPreview();
    expect(expected).not.toBe(commercial.COMMERCIAL_STATE);
    expect(Object.isFrozen(expected)).toBe(true);
  });

  it('4. preview projection changes only apiHost', () => {
    const preview = expectedPreview();
    const differences = Object.keys(commercial.COMMERCIAL_STATE)
      .filter((key) => commercial.COMMERCIAL_STATE[key] !== preview[key]);
    expect(differences).toEqual(['apiHost']);
  });

  it('5. preview projection leaves the production singleton unchanged', () => {
    const before = JSON.stringify(commercial.COMMERCIAL_STATE);
    expectedPreview();
    expect(JSON.stringify(commercial.COMMERCIAL_STATE)).toBe(before);
  });

  it('6. preview projection uses the exact canonical preview origin', () => {
    expect(expectedPreview().apiHost).toBe(PREVIEW);
  });

  it('7. repeated preview projections are deterministic and independently immutable', () => {
    const first = expectedPreview();
    const second = expectedPreview();
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(Object.isFrozen(second)).toBe(true);
  });

  it('8. projection does not mutate its resolved input', () => {
    const resolved = resolvePreview();
    const before = JSON.stringify(resolved);
    commercial.resolveExpectedAndroidCommercialState(resolved);
    expect(JSON.stringify(resolved)).toBe(before);
  });
});

describe('M4 fail-closed projection input', () => {
  const rejects = (value: unknown) => {
    expect(() => commercial.resolveExpectedAndroidCommercialState(value))
      .toThrow(commercial.AndroidCommercialStateContractError);
  };

  it('9. missing resolved contract rejects', () => rejects(undefined));
  it('10. unknown mode rejects', () => rejects(Object.freeze({ mode: 'staging', hostClass: 'production', apiBaseUrl: PRODUCTION })));
  it('11. preview mode with production hostClass rejects', () => rejects(Object.freeze({ mode: 'preview', hostClass: 'production', apiBaseUrl: PREVIEW })));
  it('12. production mode with preview hostClass rejects', () => rejects(Object.freeze({ mode: 'production', hostClass: 'vercel_preview', apiBaseUrl: PRODUCTION })));
  it('13. preview mode with production host rejects', () => rejects(Object.freeze({ mode: 'preview', hostClass: 'vercel_preview', apiBaseUrl: PRODUCTION })));
  it('14. production mode with preview host rejects', () => rejects(Object.freeze({ mode: 'production', hostClass: 'production', apiBaseUrl: PREVIEW })));
  it('15. additional authority-expanding fields reject', () => rejects(Object.freeze({ ...resolvePreview(), allowAnyApiHost: true })));
  it('16. noncanonical or non-Vercel preview origins reject', () => {
    for (const apiBaseUrl of [`${PREVIEW}/`, 'https://preview.example.com', 'http://localhost:3000']) {
      rejects(Object.freeze({ mode: 'preview', hostClass: 'vercel_preview', apiBaseUrl }));
    }
  });

  it('16b. a mutable lookalike contract cannot impersonate resolved authority', () => {
    rejects({ mode: 'preview', hostClass: 'vercel_preview', apiBaseUrl: PREVIEW });
  });
});

describe('M4 mode-aware commercial manifests', () => {
  it('17. default production manifest creation and assertion remain strict', () => {
    const value = manifest();
    expect(() => commercial.assertManifest(value)).not.toThrow();
    expect(value.apiHost).toBe(PRODUCTION);
  });

  it('18. exact preview manifest passes with explicit preview expectation', () => {
    const expected = expectedPreview();
    expect(() => commercial.assertManifest(manifest(expected), expected)).not.toThrow();
  });

  it('19. preview manifest rejects under default production expectation', () => {
    expect(() => commercial.assertManifest(manifest(expectedPreview())))
      .toThrow(commercial.AndroidCommercialStateContractError);
  });

  it('20. production manifest rejects under preview expectation', () => {
    expect(() => commercial.assertManifest(manifest(), expectedPreview()))
      .toThrow(commercial.AndroidCommercialStateContractError);
  });

  it('21. a different preview deployment host rejects', () => {
    const expected = expectedPreview();
    const value = manifest(expected);
    value.apiHost = 'https://different-team.vercel.app';
    expect(() => commercial.assertManifest(value, expected))
      .toThrow(/COMMERCIAL_STATE_MISMATCH manifest.apiHost/);
  });

  it('22. a non-host mismatch rejects in preview mode', () => {
    const expected = expectedPreview();
    const value = manifest(expected);
    value.productId = 'wrong-product';
    expect(() => commercial.assertManifest(value, expected))
      .toThrow(/COMMERCIAL_STATE_MISMATCH manifest.productId/);
  });

  it('23. assertion mutates neither actual nor expected state', () => {
    const expected = expectedPreview();
    const value = manifest(expected);
    const beforeActual = JSON.stringify(value);
    const beforeExpected = JSON.stringify(expected);
    commercial.assertManifest(value, expected);
    expect(JSON.stringify(value)).toBe(beforeActual);
    expect(JSON.stringify(expected)).toBe(beforeExpected);
  });

  it('24. an unapproved caller-fabricated expected state rejects', () => {
    const fabricated = Object.freeze({ ...commercial.COMMERCIAL_STATE, apiHost: PREVIEW });
    expect(() => commercial.assertManifest(manifest(expectedPreview()), fabricated))
      .toThrow(/expectedState/);
  });
});

describe('M4 actual static and Android runner chain', () => {
  it('24b. production clean static authority writes the exact production manifest', () => {
    const childCalls: Array<{ env?: Environment }> = [];
    const writes: unknown[] = [];
    const result = runProductionStaticBuild({
      environment: { UNRELATED_SENTINEL: 'preserved' },
      dependencies: {
        execSync: (_command: string, options: { env?: Environment }) => childCalls.push(options),
        writeManifest: (_directory: string, value: unknown) => writes.push(value),
      },
    });
    expect(childCalls).toHaveLength(1);
    expect(childCalls[0].env?.NEXT_PUBLIC_API_BASE_URL).toBe(PRODUCTION);
    expect(result.expectedCommercialState.apiHost).toBe(PRODUCTION);
    expect(result.commercialManifest.apiHost).toBe(PRODUCTION);
    expect(writes).toHaveLength(1);
  });

  it('25. static production runner aligns resolved, expected, child, and manifest hosts', () => {
    const execution = staticExecution();
    expect(execution.childCalls).toHaveLength(2);
    expect(new Set(execution.childCalls.map((call) => call.options.env?.NEXT_PUBLIC_API_BASE_URL)))
      .toEqual(new Set([PRODUCTION]));
    expect(execution.result.apiBaseUrl).toBe(PRODUCTION);
    expect(execution.result.expectedCommercialState.apiHost).toBe(PRODUCTION);
    expect(execution.result.commercialManifest.apiHost).toBe(PRODUCTION);
    expect(execution.writes).toHaveLength(1);
  });

  it('26. static preview runner aligns resolved, expected, child, and manifest hosts', () => {
    const execution = staticExecution({
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
    });
    expect(execution.childCalls).toHaveLength(2);
    expect(new Set(execution.childCalls.map((call) => call.options.env?.NEXT_PUBLIC_API_BASE_URL)))
      .toEqual(new Set([PREVIEW]));
    expect(execution.result.apiBaseUrl).toBe(PREVIEW);
    expect(execution.result.expectedCommercialState.apiHost).toBe(PREVIEW);
    expect(execution.result.commercialManifest.apiHost).toBe(PREVIEW);
    expect(execution.writes).toHaveLength(1);
  });

  it('27. Android production runner aligns every child and synced manifest host', () => {
    const execution = androidExecution(expectedProduction());
    expect(execution.childCalls).toHaveLength(4);
    expect(new Set(execution.childCalls.map((call) => call.options.env?.NEXT_PUBLIC_API_BASE_URL)))
      .toEqual(new Set([PRODUCTION]));
    expect(execution.result.expectedCommercialState.apiHost).toBe(PRODUCTION);
    expect(execution.result.syncedCommercialManifest.apiHost).toBe(PRODUCTION);
  });

  it('28. Android preview runner aligns every child and synced manifest host', () => {
    const expected = expectedPreview();
    const execution = androidExecution(expected, {
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
    });
    expect(execution.childCalls).toHaveLength(4);
    expect(new Set(execution.childCalls.map((call) => call.options.env?.NEXT_PUBLIC_API_BASE_URL)))
      .toEqual(new Set([PREVIEW]));
    expect(execution.result.expectedCommercialState.apiHost).toBe(PREVIEW);
    expect(execution.result.syncedCommercialManifest.apiHost).toBe(PREVIEW);
  });
});

describe('M4 physical verifier and clean-build chain', () => {
  it('29. production verifier accepts matching static, synced, and extracted manifests', () => {
    const result = verifierExecution(expectedProduction());
    expect(result.mode).toBe('production');
    expect(result.expectedCommercialState.apiHost).toBe(PRODUCTION);
    expect(result.staticManifest.apiHost).toBe(PRODUCTION);
    expect(result.syncedManifest.apiHost).toBe(PRODUCTION);
    expect(result.extractedAabManifest.apiHost).toBe(PRODUCTION);
  });

  it('30. preview verifier accepts matching static, synced, and extracted manifests', () => {
    const result = verifierExecution(expectedPreview(), {
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
    });
    expect(result.mode).toBe('preview');
    expect(result.expectedCommercialState.apiHost).toBe(PREVIEW);
    expect(result.staticManifest.apiHost).toBe(PREVIEW);
    expect(result.syncedManifest.apiHost).toBe(PREVIEW);
    expect(result.extractedAabManifest.apiHost).toBe(PREVIEW);
  });

  it('31. production verifier rejects preview manifests', () => {
    const wrong = manifest(expectedPreview());
    expect(() => verifierExecution(expectedProduction(), {}, { staticManifest: wrong }))
      .toThrow(/COMMERCIAL_STATE_MISMATCH manifest.apiHost/);
  });

  it('32. preview verifier rejects production manifests', () => {
    const wrong = manifest();
    expect(() => verifierExecution(expectedPreview(), {
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    }, { syncedManifest: wrong })).toThrow(/COMMERCIAL_STATE_MISMATCH manifest.apiHost/);
  });

  it('33. one wrong extracted host blocks physical verifier success', () => {
    const expected = expectedPreview();
    const wrong = manifest(expected);
    wrong.apiHost = 'https://wrong-preview.vercel.app';
    expect(() => verifierExecution(expected, {
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    }, { extractedManifest: wrong })).toThrow(/COMMERCIAL_STATE_MISMATCH manifest.apiHost/);
  });

  it('34. one non-host physical manifest mismatch blocks readiness', () => {
    const expected = expectedPreview();
    const wrong = manifest(expected);
    wrong.applicationId = 'wrong.application';
    expect(() => verifierExecution(expected, {
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    }, { staticManifest: wrong })).toThrow(/COMMERCIAL_STATE_MISMATCH manifest.applicationId/);
  });

  it('35. default clean-build path remains production and preserves its child environment', () => {
    const execution = cleanExecution({ UNRELATED_SENTINEL: 'preserved' });
    expect(execution.result.mode).toBe('production');
    expect(execution.calls.map((call) => call.command)).toEqual([
      'node scripts/build-static.js',
      process.platform === 'win32' ? 'npx.cmd cap sync android' : 'npx cap sync android',
      'node scripts/verify-android-release-assets.js',
    ]);
    expect(execution.calls.every((call) => call.environment.NEXT_PUBLIC_API_BASE_URL === PRODUCTION))
      .toBe(true);
  });

  it('36. explicit preview clean-build path uses the internal static runner and preserves preview', () => {
    const execution = cleanExecution({
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
    });
    expect(execution.result.mode).toBe('preview');
    expect(execution.calls.map((call) => call.command)).toEqual([
      'node scripts/build-static-internal.js',
      process.platform === 'win32' ? 'npx.cmd cap sync android' : 'npx cap sync android',
      'node scripts/verify-android-release-assets.js',
    ]);
    expect(execution.calls.every((call) => call.environment.NEXT_PUBLIC_API_BASE_URL === PREVIEW))
      .toBe(true);
    expect(execution.calls.every((call) => call.environment.CV_V3_ANDROID_API_MODE === 'preview'))
      .toBe(true);
  });

  it('37. importing the physical verifier performs no command or filesystem mutation', () => {
    const modulePath = path.resolve('scripts/verify-android-release-assets.js');
    const childProcess = require('node:child_process') as typeof import('node:child_process');
    const execSpy = vi.spyOn(childProcess, 'execSync').mockImplementation((() => '') as never);
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation((() => undefined) as never);
    const rmSpy = vi.spyOn(fs, 'rmSync').mockImplementation((() => undefined) as never);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation((() => undefined) as never);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    delete require.cache[require.resolve(modulePath)];
    require(modulePath);
    expect(execSpy).toHaveBeenCalledTimes(0);
    expect(writeSpy).toHaveBeenCalledTimes(0);
    expect(rmSpy).toHaveBeenCalledTimes(0);
    expect(mkdirSpy).toHaveBeenCalledTimes(0);
    expect(exitSpy).toHaveBeenCalledTimes(0);
    vi.restoreAllMocks();
  });

  it('38. capture-only chain performs zero real commands and physical filesystem mutations', () => {
    const staticRun = staticExecution({
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    });
    const androidRun = androidExecution(expectedPreview(), {
      CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    });
    expect(staticRun.childCalls).toHaveLength(2);
    expect(androidRun.childCalls).toHaveLength(4);
    expect(staticRun.writes).toHaveLength(1);
    expect(androidRun.fsWrites).toEqual(['captured']);
  });
});
