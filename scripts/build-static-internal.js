#!/usr/bin/env node
/**
 * Internal static export for Capacitor Android device validation.
 *
 * Forces the established internal-build contract and fails before packaging
 * when the native RevenueCat public key or production API base URL is absent.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const {
  ANDROID_PRODUCTION_API_BASE_URL,
  enforceAndroidProductionApiBaseUrl,
} = require('./android-production-api-contract');
const {
  applyAndroidInternalApiContract,
} = require('./android-internal-api-contract');
const {
  establishAndroidPackagingEnvironment,
  validateCheckedInCommercialState,
  buildManifest,
  writeManifest,
} = require('./android-commercial-state-contract');

const repoRoot = path.resolve(__dirname, '..');
const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const verify = path.join(__dirname, 'verify-internal-ai-reset-assets.mjs');
const outDir = path.join(repoRoot, 'out');

function readRequiredEnv(environment, name) {
  const value = String(environment[name] || '').trim();
  if (!value) {
    console.error(`[build:static:internal] FAIL: missing required ${name}`);
    process.exit(1);
  }
  return value;
}

function treeContainsExactValue(root, value) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/\.(?:js|html|txt)$/i.test(entry.name)
        && fs.readFileSync(full, 'utf8').includes(value)) return true;
    }
  }
  return false;
}

function runStaticInternalBuild(options = {}) {
  const dependencies = {
    execFileSync,
    loadEnvConfig,
    establishAndroidPackagingEnvironment,
    validateCheckedInCommercialState,
    buildManifest,
    writeManifest,
    treeContainsExactValue,
    ...options.dependencies,
  };
  const usesProcessEnvironment = options.environment === undefined;
  if (usesProcessEnvironment) dependencies.loadEnvConfig(repoRoot);
  const childEnvironment = usesProcessEnvironment
    ? process.env
    : { ...options.environment };
  const requiredEnv = (name) => readRequiredEnv(childEnvironment, name);

  const apiContract = usesProcessEnvironment
    ? applyAndroidInternalApiContract(process.env)
    : applyAndroidInternalApiContract(childEnvironment);
  if (usesProcessEnvironment) {
    if (apiContract.mode === 'production') enforceAndroidProductionApiBaseUrl(process.env);
  }
  if (apiContract.mode === 'production' && !usesProcessEnvironment) {
    enforceAndroidProductionApiBaseUrl(childEnvironment);
  }

  const commercialKey = dependencies.establishAndroidPackagingEnvironment(childEnvironment);
  dependencies.validateCheckedInCommercialState(repoRoot);
  const revenueCatAndroidKey = requiredEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY');
  const apiBaseUrl = requiredEnv('NEXT_PUBLIC_API_BASE_URL');
  if (apiBaseUrl !== apiContract.apiBaseUrl) {
    console.error('[build:static:internal] FAIL: resolved Android API base URL changed after validation');
    process.exit(1);
  }

  childEnvironment.NEXT_PUBLIC_STATIC_EXPORT = 'true';
  childEnvironment.NEXT_PUBLIC_BUILD_CHANNEL = 'internal';
  childEnvironment.NEXT_PUBLIC_ENABLE_AI_TEST_RESET = 'true';
  // Internal device validation only — do not set this in production/web builds.
  childEnvironment.NEXT_PUBLIC_ENABLE_SUMMARY_V2 = 'true';

  console.log(
    '[build:static:internal] channel=internal enableAiTestReset=true staticExport=true enableSummaryV2=true',
  );
  dependencies.execFileSync(process.execPath, [nextBin, 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: childEnvironment,
  });
  dependencies.writeManifest(outDir, dependencies.buildManifest({
    apiHost: apiBaseUrl,
    keyFingerprint: commercialKey.fingerprint,
  }));
  dependencies.execFileSync(process.execPath, [verify, '--dir', 'out', '--expect', 'enabled'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: childEnvironment,
  });
  if (!dependencies.treeContainsExactValue(outDir, revenueCatAndroidKey)) {
    console.error('[build:static:internal] FAIL: RevenueCat Android public key is absent from built assets');
    process.exit(1);
  }
  console.log('[build:static:internal] OK — internal diagnostics and RevenueCat configuration are present in out/');

  return Object.freeze({
    ...apiContract,
    childEnvironment,
  });
}

if (require.main === module) {
  runStaticInternalBuild();
}

module.exports = {
  runStaticInternalBuild,
};
