#!/usr/bin/env node
/**
 * Internal Android packaging order is deliberate: a normal web build may
 * replace `out/`, so it must happen before the final internal static export.
 * The verifier runs only after Capacitor has copied that final export.
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const {
  enforceAndroidProductionApiBaseUrl,
} = require('./android-production-api-contract');
const {
  applyAndroidInternalApiContract,
} = require('./android-internal-api-contract');
const {
  establishAndroidPackagingEnvironment,
  validateCheckedInCommercialState,
  assertManifest,
  resolveExpectedAndroidCommercialState,
} = require('./android-commercial-state-contract');

const root = path.resolve(__dirname, '..');
const win = process.platform === 'win32';
const copied = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public');
const capacitorConfig = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
const packagingMarker = 'aab392-internal-diagnostics-packaging-v1';
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const staticBuildScript = path.join(root, 'scripts', 'build-static-internal.js');
const verifyScript = path.join(root, 'scripts', 'verify-internal-ai-reset-assets.mjs');

function fail(message) {
  console.error(`[build:android:internal] FAIL: ${message}`);
  process.exit(1);
}

function readRequiredEnv(environment, name) {
  const value = String(environment[name] || '').trim();
  if (!value) fail(`missing required ${name}`);
  return value;
}

function runFile(command, args, options = {}) {
  console.log(`[build:android:internal] ${path.basename(command)} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    ...options,
  });
}

function treeContainsExactValue(rootDir, value) {
  const stack = [rootDir];
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

function runAndroidInternalBuild(options = {}) {
  const dependencies = {
    fs,
    loadEnvConfig,
    establishAndroidPackagingEnvironment,
    validateCheckedInCommercialState,
    assertManifest,
    runFile,
    treeContainsExactValue,
    ...options.dependencies,
    resolveExpectedAndroidCommercialState,
  };
  const usesProcessEnvironment = options.environment === undefined;
  if (usesProcessEnvironment) dependencies.loadEnvConfig(root);
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
  const expectedCommercialState = dependencies.resolveExpectedAndroidCommercialState(apiContract);
  if (childEnvironment.NEXT_PUBLIC_API_BASE_URL !== expectedCommercialState.apiHost) {
    throw new Error('COMMERCIAL_STATE_MISMATCH childEnvironment.apiHost');
  }

  dependencies.establishAndroidPackagingEnvironment(childEnvironment);
  dependencies.validateCheckedInCommercialState(root);
  const apiBaseUrl = requiredEnv('NEXT_PUBLIC_API_BASE_URL');
  if (apiBaseUrl !== apiContract.apiBaseUrl) {
    fail('resolved Android API base URL changed after validation');
  }
  const revenueCatAndroidKey = requiredEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY');

  // execFileSync keeps `C:\Program Files\nodejs\node.exe` intact on Windows.
  dependencies.runFile(process.execPath, [nextBin, 'build'], { env: childEnvironment });
  dependencies.runFile(process.execPath, [staticBuildScript], { env: childEnvironment });
  dependencies.fs.writeFileSync(
    path.join(root, 'out', 'aab392-internal-diagnostics-packaging.txt'),
    `${packagingMarker}\n`,
    'utf8',
  );
  dependencies.runFile(
    win ? 'npx.cmd' : 'npx',
    ['cap', 'sync', 'android'],
    { shell: win, env: childEnvironment },
  );
  dependencies.runFile(
    process.execPath,
    [verifyScript, '--dir', copied, '--expect', 'enabled'],
    { env: childEnvironment },
  );

  if (!dependencies.fs.existsSync(capacitorConfig)) fail('missing copied Capacitor config');
  if (JSON.parse(dependencies.fs.readFileSync(capacitorConfig, 'utf8')).server?.url) {
    fail('Capacitor server.url must be absent from packaged internal assets');
  }
  const commercialManifestPath = path.join(copied, 'android-commercial-state.json');
  if (!dependencies.fs.existsSync(commercialManifestPath)) {
    fail('missing copied Android commercial state manifest');
  }
  let syncedCommercialManifest;
  try {
    syncedCommercialManifest = JSON.parse(
      dependencies.fs.readFileSync(commercialManifestPath, 'utf8'),
    );
    dependencies.assertManifest(syncedCommercialManifest, expectedCommercialState);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (!dependencies.treeContainsExactValue(copied, revenueCatAndroidKey)) {
    fail('RevenueCat Android public key is absent from copied Android assets');
  }
  const copiedMarker = path.join(copied, 'aab392-internal-diagnostics-packaging.txt');
  if (!dependencies.fs.existsSync(copiedMarker)
    || !dependencies.fs.readFileSync(copiedMarker, 'utf8').includes(packagingMarker)) {
    fail(`missing copied packaging marker ${packagingMarker}`);
  }
  console.log('[build:android:internal] OK copied Android assets are internal, V2-on, diagnostic-enabled, API-host verified, and RevenueCat-configured');

  return Object.freeze({
    ...apiContract,
    childEnvironment,
    expectedCommercialState,
    syncedCommercialManifest,
  });
}

if (require.main === module) {
  runAndroidInternalBuild();
}

module.exports = {
  runAndroidInternalBuild,
};
