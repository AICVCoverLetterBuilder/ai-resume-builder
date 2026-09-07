import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const internalContract = require('../../../scripts/android-internal-api-contract.js') as {
  CV_V3_ANDROID_API_MODE: string;
  ANDROID_INTERNAL_API_CONTRACT_REVISION: string;
  AndroidInternalApiContractError: new (code: string, message: string) => Error & { code: string };
  resolveAndroidInternalApiContract: (environment: Record<string, string | undefined>) => {
    mode: 'production' | 'preview';
    apiBaseUrl: string;
    hostClass: 'production' | 'vercel_preview';
  };
  applyAndroidInternalApiContract: (environment: Record<string, string | undefined>) => {
    mode: 'production' | 'preview';
    apiBaseUrl: string;
    hostClass: 'production' | 'vercel_preview';
  };
};
const productionContract = require('../../../scripts/android-production-api-contract.js') as {
  ANDROID_PRODUCTION_API_BASE_URL: string;
  enforceAndroidProductionApiBaseUrl: (environment: Record<string, string | undefined>) => string;
};
const commercialContract = require('../../../scripts/android-commercial-state-contract.js') as {
  resolveExpectedAndroidCommercialState: (contract: {
    mode: 'production' | 'preview';
    apiBaseUrl: string;
    hostClass: 'production' | 'vercel_preview';
  }) => { apiHost: string };
};

const PRODUCTION = 'https://ai-resume-builder-six-gamma.vercel.app';
const PREVIEW = 'https://example-project-random-team.vercel.app';
const STATIC_SCRIPT = path.resolve('scripts/build-static-internal.js');
const ANDROID_SCRIPT = path.resolve('scripts/build-android-internal.js');
const PROTECTED = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';

type Environment = Record<string, string | undefined>;
type ChildCall = {
  command: string;
  args: string[];
  options: { env?: Environment; [key: string]: unknown };
};
type RunnerResult = {
  mode: 'production' | 'preview';
  apiBaseUrl: string;
  hostClass: 'production' | 'vercel_preview';
  childEnvironment: Environment;
};
type BuildRunner = (options: {
  environment: Environment;
  dependencies: Record<string, unknown>;
}) => RunnerResult;
type CommercialManifestAssertion = {
  actual: unknown;
  expectedState: { apiHost: string };
};

function importFreshBuildModule(
  modulePath: string,
  exportName: 'runStaticInternalBuild' | 'runAndroidInternalBuild',
) {
  const resolved = require.resolve(modulePath);
  delete require.cache[resolved];
  const loaded = require(resolved) as Record<string, unknown>;
  expect(loaded[exportName]).toBeTypeOf('function');
  return loaded[exportName] as BuildRunner;
}

function baseRunnerEnvironment(overrides: Environment = {}): Environment {
  return {
    NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'rc_test_public_key',
    NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'false',
    NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
    NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
    ANDROID_VERSION_CODE: '408',
    SIGNING_SENTINEL: 'unchanged',
    UNRELATED_SENTINEL: 'preserved',
    ...overrides,
  };
}

function staticRunnerDependencies(
  childCalls: ChildCall[],
  filesystemMutations: string[],
  sideEffects: string[] = [],
) {
  return {
    execFileSync: (command: string, args: string[], options: ChildCall['options']) => {
      sideEffects.push('child');
      childCalls.push({ command, args, options });
    },
    loadEnvConfig: () => sideEffects.push('load-env'),
    establishAndroidPackagingEnvironment: () => ({ fingerprint: 'test-fingerprint' }),
    validateCheckedInCommercialState: () => sideEffects.push('validate-commercial'),
    buildManifest: (value: unknown) => value,
    writeManifest: () => {
      sideEffects.push('filesystem');
      filesystemMutations.push('writeManifest');
    },
    treeContainsExactValue: () => true,
  };
}

function androidRunnerDependencies(
  childCalls: ChildCall[],
  filesystemMutations: string[],
  sideEffects: string[] = [],
  commercialManifestAssertions: CommercialManifestAssertion[] = [],
) {
  return {
    loadEnvConfig: () => sideEffects.push('load-env'),
    establishAndroidPackagingEnvironment: () => sideEffects.push('commercial-environment'),
    validateCheckedInCommercialState: () => sideEffects.push('validate-commercial'),
    assertManifest: (actual: unknown, expectedState: { apiHost: string }) => {
      commercialManifestAssertions.push({ actual, expectedState });
    },
    runFile: (command: string, args: string[], options: ChildCall['options']) => {
      sideEffects.push('child');
      childCalls.push({ command, args, options });
    },
    treeContainsExactValue: (_root: string, value: string) => value !== PROTECTED,
    fs: {
      writeFileSync: () => {
        sideEffects.push('filesystem');
        filesystemMutations.push('writeFileSync');
      },
      existsSync: () => true,
      readFileSync: (file: string) => (
        file.endsWith('aab392-internal-diagnostics-packaging.txt')
          ? 'aab392-internal-diagnostics-packaging-v1\n'
          : '{}'
      ),
    },
  };
}

function expectEveryChildUrl(childCalls: ChildCall[], expected: string) {
  expect(childCalls.length).toBeGreaterThan(0);
  for (const call of childCalls) {
    expect(call.options.env?.NEXT_PUBLIC_API_BASE_URL).toBe(expected);
  }
}

function assertImportSafe(
  modulePath: string,
  exportName: 'runStaticInternalBuild' | 'runAndroidInternalBuild',
) {
  const childProcess = require('node:child_process') as typeof import('node:child_process');
  const beforeCwd = process.cwd();
  const beforeEnvironment = {
    mode: process.env.CV_V3_ANDROID_API_MODE,
    api: process.env.NEXT_PUBLIC_API_BASE_URL,
    v3: process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED,
  };
  const beforeOutputs = [
    fs.existsSync(path.resolve('.next')),
    fs.existsSync(path.resolve('out')),
    fs.existsSync(path.resolve('android/app/build')),
  ];
  const childSpy = vi.spyOn(childProcess, 'execFileSync')
    .mockImplementation((() => undefined) as never);
  const writeSpy = vi.spyOn(fs, 'writeFileSync')
    .mockImplementation((() => undefined) as never);
  const copySpy = vi.spyOn(fs, 'copyFileSync')
    .mockImplementation((() => undefined) as never);
  const mkdirSpy = vi.spyOn(fs, 'mkdirSync')
    .mockImplementation((() => undefined) as never);
  const rmSpy = vi.spyOn(fs, 'rmSync')
    .mockImplementation((() => undefined) as never);
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('unexpected process.exit during import');
  }) as never);

  try {
    importFreshBuildModule(modulePath, exportName);
    expect(childSpy).toHaveBeenCalledTimes(0);
    expect(writeSpy).toHaveBeenCalledTimes(0);
    expect(copySpy).toHaveBeenCalledTimes(0);
    expect(mkdirSpy).toHaveBeenCalledTimes(0);
    expect(rmSpy).toHaveBeenCalledTimes(0);
    expect(exitSpy).toHaveBeenCalledTimes(0);
    expect(process.cwd()).toBe(beforeCwd);
    expect({
      mode: process.env.CV_V3_ANDROID_API_MODE,
      api: process.env.NEXT_PUBLIC_API_BASE_URL,
      v3: process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED,
    }).toEqual(beforeEnvironment);
    expect([
      fs.existsSync(path.resolve('.next')),
      fs.existsSync(path.resolve('out')),
      fs.existsSync(path.resolve('android/app/build')),
    ]).toEqual(beforeOutputs);
  } finally {
    vi.restoreAllMocks();
    delete require.cache[require.resolve(modulePath)];
  }
}

function resolve(environment: Record<string, string | undefined> = {}) {
  return internalContract.resolveAndroidInternalApiContract(environment);
}

function expectContractError(
  operation: () => unknown,
  code: string,
) {
  try {
    operation();
    throw new Error('expected AndroidInternalApiContractError');
  } catch (error) {
    expect(error).toBeInstanceOf(internalContract.AndroidInternalApiContractError);
    expect((error as { code?: string }).code).toBe(code);
  }
}

describe('AI Core V3 internal preview API-host build contract', () => {
  it('1. absent mode resolves the exact production origin', () => {
    expect(resolve()).toEqual({
      mode: 'production',
      apiBaseUrl: PRODUCTION,
      hostClass: 'production',
    });
  });

  it('2. empty mode resolves the exact production origin', () => {
    expect(resolve({ CV_V3_ANDROID_API_MODE: '' }).apiBaseUrl).toBe(PRODUCTION);
  });

  it('3. explicit production resolves the exact production origin', () => {
    expect(resolve({ CV_V3_ANDROID_API_MODE: 'production' })).toEqual({
      mode: 'production',
      apiBaseUrl: PRODUCTION,
      hostClass: 'production',
    });
  });

  it('4. preview URL alone does not activate preview mode', () => {
    const environment = { NEXT_PUBLIC_API_BASE_URL: PREVIEW };
    const result = internalContract.applyAndroidInternalApiContract(environment);
    expect(result.mode).toBe('production');
    expect(environment.NEXT_PUBLIC_API_BASE_URL).toBe(PRODUCTION);
  });

  it('5. existing production contract still overwrites a non-production host', () => {
    const environment = { NEXT_PUBLIC_API_BASE_URL: PREVIEW };
    expect(productionContract.enforceAndroidProductionApiBaseUrl(environment)).toBe(PRODUCTION);
    expect(environment.NEXT_PUBLIC_API_BASE_URL).toBe(PRODUCTION);
  });

  it('6. production hostname constant remains unchanged', () => {
    expect(productionContract.ANDROID_PRODUCTION_API_BASE_URL).toBe(PRODUCTION);
  });

  it('7. Preview resolution projects the exact packaged commercial API host', () => {
    const resolved = resolve({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    });
    expect(commercialContract.resolveExpectedAndroidCommercialState(resolved).apiHost).toBe(PREVIEW);
  });

  it('8. invalid mode true rejects', () => {
    expectContractError(() => resolve({ CV_V3_ANDROID_API_MODE: 'true' }), 'invalid_mode');
  });

  it('9. invalid mode 1 rejects', () => {
    expectContractError(() => resolve({ CV_V3_ANDROID_API_MODE: '1' }), 'invalid_mode');
  });

  it('10. uppercase preview modes reject', () => {
    for (const mode of ['Preview', 'PREVIEW']) {
      expectContractError(() => resolve({ CV_V3_ANDROID_API_MODE: mode }), 'invalid_mode');
    }
  });

  it('11. whitespace-padded preview and production modes reject', () => {
    for (const mode of [' preview ', 'production ']) {
      expectContractError(
        () => resolve({ CV_V3_ANDROID_API_MODE: mode, NEXT_PUBLIC_API_BASE_URL: PREVIEW }),
        'invalid_mode',
      );
    }
  });

  it('12. unknown mode rejects', () => {
    expectContractError(() => resolve({ CV_V3_ANDROID_API_MODE: 'staging' }), 'invalid_mode');
  });

  it('13. explicit preview plus canonical non-production Vercel origin passes', () => {
    expect(resolve({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    }).apiBaseUrl).toBe(PREVIEW);
  });

  it('14. accepted preview is normalized to its origin without a trailing slash', () => {
    expect(resolve({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
    }).apiBaseUrl).toBe(PREVIEW);
  });

  it('15. accepted preview returns mode preview', () => {
    expect(resolve({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    }).mode).toBe('preview');
  });

  it('16. accepted preview returns hostClass vercel_preview', () => {
    expect(resolve({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    }).hostClass).toBe('vercel_preview');
  });

  it('17. preview resolution does not mutate the production constant', () => {
    resolve({ CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PREVIEW });
    expect(productionContract.ANDROID_PRODUCTION_API_BASE_URL).toBe(PRODUCTION);
  });

  it('18. missing preview URL rejects', () => {
    for (const url of [undefined, '']) {
      expectContractError(
        () => resolve({ CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: url }),
        'preview_url_required',
      );
    }
  });

  it('19. production URL in preview mode rejects', () => {
    expectContractError(
      () => resolve({ CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: PRODUCTION }),
      'production_host_forbidden_in_preview',
    );
  });

  it('20. HTTP preview rejects', () => {
    expectContractError(
      () => resolve({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: 'http://example-project-random-team.vercel.app',
      }),
      'invalid_preview_protocol',
    );
  });

  it('21. custom non-Vercel domain rejects', () => {
    expectContractError(
      () => resolve({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: 'https://preview.example.com',
      }),
      'invalid_preview_host',
    );
  });

  it('22. localhost, IP, private, and emulator hosts reject', () => {
    for (const url of [
      'https://localhost',
      'https://127.0.0.1',
      'https://0.0.0.0',
      'https://[::1]',
      'https://10.0.2.2',
      'https://10.0.3.2',
      'https://192.168.1.5',
    ]) {
      expectContractError(
        () => resolve({ CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: url }),
        'unsafe_preview_host',
      );
    }
  });

  it('23. URL credentials reject', () => {
    for (const url of [
      'https://user:pass@example-project-random-team.vercel.app',
      'https://user%40example.com@example-project-random-team.vercel.app',
    ]) {
      expectContractError(
        () => resolve({ CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: url }),
        'preview_credentials_forbidden',
      );
    }
  });

  it('24. non-root path rejects', () => {
    expectContractError(
      () => resolve({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/api/generate`,
      }),
      'preview_path_forbidden',
    );
  });

  it('25. query or fragment rejects', () => {
    for (const suffix of ['?next=https://example.com', '#fragment']) {
      expectContractError(
        () => resolve({
          CV_V3_ANDROID_API_MODE: 'preview',
          NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/${suffix}`,
        }),
        'preview_suffix_forbidden',
      );
    }
  });

  it('26. nonstandard port rejects', () => {
    expectContractError(
      () => resolve({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: 'https://example-project-random-team.vercel.app:8443',
      }),
      'preview_port_forbidden',
    );
  });

  it('27. whitespace and control-character input reject', () => {
    for (const url of [` ${PREVIEW}`, `${PREVIEW} `, `${PREVIEW}\n`]) {
      expectContractError(
        () => resolve({ CV_V3_ANDROID_API_MODE: 'preview', NEXT_PUBLIC_API_BASE_URL: url }),
        'invalid_preview_url',
      );
    }
  });

  it('28. malformed and multi-URL input reject', () => {
    for (const url of ['not-a-url', `${PREVIEW}https://other.vercel.app`]) {
      expect(() => resolve({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: url,
      })).toThrow(internalContract.AndroidInternalApiContractError);
    }
  });

  it('29. static internal build prepares the exact production URL by default', () => {
    const environment: Record<string, string | undefined> = {};
    expect(internalContract.applyAndroidInternalApiContract(environment).mode).toBe('production');
    expect(environment.NEXT_PUBLIC_API_BASE_URL).toBe(PRODUCTION);
    expect(fs.readFileSync(STATIC_SCRIPT, 'utf8')).toContain(
      'applyAndroidInternalApiContract(process.env)',
    );
  });

  it('30. Android internal build prepares the exact production URL by default', () => {
    const environment: Record<string, string | undefined> = {};
    expect(internalContract.applyAndroidInternalApiContract(environment).hostClass).toBe('production');
    expect(environment.NEXT_PUBLIC_API_BASE_URL).toBe(PRODUCTION);
    expect(fs.readFileSync(ANDROID_SCRIPT, 'utf8')).toContain(
      'applyAndroidInternalApiContract(process.env)',
    );
  });

  it('31. static internal build prepares a preview URL only in explicit preview mode', () => {
    const environment = {
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
    };
    expect(internalContract.applyAndroidInternalApiContract(environment).mode).toBe('preview');
    expect(environment.NEXT_PUBLIC_API_BASE_URL).toBe(PREVIEW);
  });

  it('32. Android internal build prepares a preview URL only in explicit preview mode', () => {
    const environment = {
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
    };
    expect(internalContract.applyAndroidInternalApiContract(environment).hostClass).toBe('vercel_preview');
    expect(environment.NEXT_PUBLIC_API_BASE_URL).toBe(PREVIEW);
  });

  it('33. invalid preview configuration fails in both scripts before child build commands', () => {
    for (const script of [STATIC_SCRIPT, ANDROID_SCRIPT]) {
      const result = spawnSync(process.execPath, [script], {
        cwd: path.resolve('.'),
        encoding: 'utf8',
        env: {
          ...process.env,
          CV_V3_ANDROID_API_MODE: 'preview',
          NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('AndroidInternalApiContractError');
      expect(result.stdout).not.toContain('[build:android:internal] node.exe');
      expect(result.stdout).not.toContain('[build:static] NEXT_PUBLIC_STATIC_EXPORT=true');
    }
  });

  it('34. neither script overwrites a validated preview URL later', () => {
    for (const script of [STATIC_SCRIPT, ANDROID_SCRIPT]) {
      const source = fs.readFileSync(script, 'utf8');
      expect(source).toContain(
        "if (apiContract.mode === 'production') enforceAndroidProductionApiBaseUrl(process.env);",
      );
      expect(source).toContain('apiBaseUrl !== apiContract.apiBaseUrl');
      expect(source).not.toContain('apiBaseUrl !== ANDROID_PRODUCTION_API_BASE_URL');
    }
  });

  it('35. both build scripts call the same shared resolver exactly once', () => {
    for (const script of [STATIC_SCRIPT, ANDROID_SCRIPT]) {
      const source = fs.readFileSync(script, 'utf8');
      expect(source).toContain("require('./android-internal-api-contract')");
      expect(source.match(/applyAndroidInternalApiContract\(process\.env\)/g)).toHaveLength(1);
    }
  });

  it('36. host resolution changes no Android, V3, diagnostics, or reset authority', () => {
    const environment = {
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
      NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'false',
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
      NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
      ANDROID_VERSION_CODE: '408',
    };
    internalContract.applyAndroidInternalApiContract(environment);
    expect(environment).toEqual({
      CV_V3_ANDROID_API_MODE: 'preview',
      NEXT_PUBLIC_API_BASE_URL: PREVIEW,
      NEXT_PUBLIC_AI_CORE_V3_ENABLED: 'false',
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
      NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
      ANDROID_VERSION_CODE: '408',
    });
  });

  it('importing the static internal build script performs no build side effects', () => {
    assertImportSafe(STATIC_SCRIPT, 'runStaticInternalBuild');
  });

  it('importing the Android internal build script performs no build side effects', () => {
    assertImportSafe(ANDROID_SCRIPT, 'runAndroidInternalBuild');
  });

  it('the static internal runner forwards the resolved production environment to every child command', () => {
    const runner = importFreshBuildModule(STATIC_SCRIPT, 'runStaticInternalBuild');
    const childCalls: ChildCall[] = [];
    const filesystemMutations: string[] = [];
    const result = runner({
      environment: baseRunnerEnvironment(),
      dependencies: staticRunnerDependencies(childCalls, filesystemMutations),
    });

    expect(result.mode).toBe('production');
    expect(result.hostClass).toBe('production');
    expect(result.apiBaseUrl).toBe(PRODUCTION);
    expect(childCalls).toHaveLength(2);
    expectEveryChildUrl(childCalls, PRODUCTION);
    expect(result.childEnvironment.UNRELATED_SENTINEL).toBe('preserved');
    expect(result.childEnvironment.NEXT_PUBLIC_AI_CORE_V3_ENABLED).toBe('false');
    expect(result.childEnvironment.NEXT_PUBLIC_BUILD_CHANNEL).toBe('internal');
    expect(result.childEnvironment.NEXT_PUBLIC_ENABLE_AI_TEST_RESET).toBe('true');
    expect(result.childEnvironment.ANDROID_VERSION_CODE).toBe('408');
    expect(filesystemMutations).toEqual(['writeManifest']);
  });

  it('the static internal runner forwards the validated preview environment to every child command', () => {
    const runner = importFreshBuildModule(STATIC_SCRIPT, 'runStaticInternalBuild');
    const childCalls: ChildCall[] = [];
    const filesystemMutations: string[] = [];
    const result = runner({
      environment: baseRunnerEnvironment({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
      }),
      dependencies: staticRunnerDependencies(childCalls, filesystemMutations),
    });

    expect(result.mode).toBe('preview');
    expect(result.hostClass).toBe('vercel_preview');
    expect(result.apiBaseUrl).toBe(PREVIEW);
    expect(childCalls).toHaveLength(2);
    expectEveryChildUrl(childCalls, PREVIEW);
    expect(new Set(childCalls.map((call) => call.options.env?.NEXT_PUBLIC_API_BASE_URL)))
      .toEqual(new Set([PREVIEW]));
    expect(result.childEnvironment.UNRELATED_SENTINEL).toBe('preserved');
    expect(result.childEnvironment.NEXT_PUBLIC_AI_CORE_V3_ENABLED).toBe('false');
    expect(result.childEnvironment.NEXT_PUBLIC_BUILD_CHANNEL).toBe('internal');
    expect(result.childEnvironment.NEXT_PUBLIC_ENABLE_AI_TEST_RESET).toBe('true');
    expect(result.childEnvironment.SIGNING_SENTINEL).toBe('unchanged');
    expect(result.childEnvironment.ANDROID_VERSION_CODE).toBe('408');
  });

  it('the Android internal runner forwards the resolved production environment to every child command', () => {
    const runner = importFreshBuildModule(ANDROID_SCRIPT, 'runAndroidInternalBuild');
    const childCalls: ChildCall[] = [];
    const filesystemMutations: string[] = [];
    const commercialManifestAssertions: CommercialManifestAssertion[] = [];
    const result = runner({
      environment: baseRunnerEnvironment(),
      dependencies: androidRunnerDependencies(
        childCalls,
        filesystemMutations,
        [],
        commercialManifestAssertions,
      ),
    });

    expect(result.mode).toBe('production');
    expect(result.hostClass).toBe('production');
    expect(result.apiBaseUrl).toBe(PRODUCTION);
    expect(childCalls).toHaveLength(4);
    expectEveryChildUrl(childCalls, PRODUCTION);
    expect(result.childEnvironment.UNRELATED_SENTINEL).toBe('preserved');
    expect(result.childEnvironment.NEXT_PUBLIC_AI_CORE_V3_ENABLED).toBe('false');
    expect(result.childEnvironment.NEXT_PUBLIC_BUILD_CHANNEL).toBe('internal');
    expect(result.childEnvironment.NEXT_PUBLIC_ENABLE_AI_TEST_RESET).toBe('true');
    expect(result.childEnvironment.SIGNING_SENTINEL).toBe('unchanged');
    expect(result.childEnvironment.ANDROID_VERSION_CODE).toBe('408');
    expect(filesystemMutations).toEqual(['writeFileSync']);
    expect(commercialManifestAssertions).toHaveLength(1);
    expect(commercialManifestAssertions[0].expectedState.apiHost).toBe(PRODUCTION);
  });

  it('the Android internal runner forwards the validated preview environment to every child command', () => {
    const runner = importFreshBuildModule(ANDROID_SCRIPT, 'runAndroidInternalBuild');
    const childCalls: ChildCall[] = [];
    const filesystemMutations: string[] = [];
    const commercialManifestAssertions: CommercialManifestAssertion[] = [];
    const result = runner({
      environment: baseRunnerEnvironment({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: `${PREVIEW}/`,
      }),
      dependencies: androidRunnerDependencies(
        childCalls,
        filesystemMutations,
        [],
        commercialManifestAssertions,
      ),
    });

    expect(result.mode).toBe('preview');
    expect(result.hostClass).toBe('vercel_preview');
    expect(result.apiBaseUrl).toBe(PREVIEW);
    expect(childCalls).toHaveLength(4);
    expectEveryChildUrl(childCalls, PREVIEW);
    expect(new Set(childCalls.map((call) => call.options.env?.NEXT_PUBLIC_API_BASE_URL)))
      .toEqual(new Set([PREVIEW]));
    expect(result.childEnvironment.UNRELATED_SENTINEL).toBe('preserved');
    expect(result.childEnvironment.NEXT_PUBLIC_AI_CORE_V3_ENABLED).toBe('false');
    expect(result.childEnvironment.NEXT_PUBLIC_BUILD_CHANNEL).toBe('internal');
    expect(result.childEnvironment.NEXT_PUBLIC_ENABLE_AI_TEST_RESET).toBe('true');
    expect(result.childEnvironment.SIGNING_SENTINEL).toBe('unchanged');
    expect(result.childEnvironment.ANDROID_VERSION_CODE).toBe('408');
    expect(commercialManifestAssertions).toHaveLength(1);
    expect(commercialManifestAssertions[0].expectedState.apiHost).toBe(PREVIEW);
  });

  it('the static internal runner rejects invalid preview configuration before every side effect', () => {
    const runner = importFreshBuildModule(STATIC_SCRIPT, 'runStaticInternalBuild');
    const childCalls: ChildCall[] = [];
    const filesystemMutations: string[] = [];
    const sideEffects: string[] = [];
    const beforeCwd = process.cwd();

    expectContractError(() => runner({
      environment: baseRunnerEnvironment({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
      }),
      dependencies: staticRunnerDependencies(childCalls, filesystemMutations, sideEffects),
    }), 'invalid_preview_protocol');

    expect(childCalls).toHaveLength(0);
    expect(filesystemMutations).toHaveLength(0);
    expect(sideEffects).toHaveLength(0);
    expect(process.cwd()).toBe(beforeCwd);
  });

  it('the Android internal runner rejects invalid preview configuration before every side effect', () => {
    const runner = importFreshBuildModule(ANDROID_SCRIPT, 'runAndroidInternalBuild');
    const childCalls: ChildCall[] = [];
    const filesystemMutations: string[] = [];
    const sideEffects: string[] = [];
    const beforeCwd = process.cwd();

    expectContractError(() => runner({
      environment: baseRunnerEnvironment({
        CV_V3_ANDROID_API_MODE: 'preview',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3000',
      }),
      dependencies: androidRunnerDependencies(childCalls, filesystemMutations, sideEffects),
    }), 'invalid_preview_protocol');

    expect(childCalls).toHaveLength(0);
    expect(filesystemMutations).toHaveLength(0);
    expect(sideEffects).toHaveLength(0);
    expect(process.cwd()).toBe(beforeCwd);
  });
});
