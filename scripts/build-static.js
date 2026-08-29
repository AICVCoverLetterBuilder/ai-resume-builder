#!/usr/bin/env node
/**
 * Production static export for Capacitor Android/iOS.
 * Must set NEXT_PUBLIC_STATIC_EXPORT so next.config.ts writes to webDir (out/).
 */
const { execSync } = require('node:child_process');
const path = require('node:path');
const { enforceAndroidProductionApiBaseUrl } = require('./android-production-api-contract');
const { applyAndroidInternalApiContract } = require('./android-internal-api-contract');
const {
  COMMERCIAL_STATE,
  buildManifest,
  writeManifest,
  assertManifest,
  resolveExpectedAndroidCommercialState,
} = require('./android-commercial-state-contract');

const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const outDir = path.join(repoRoot, 'out');

function runProductionStaticBuild(options = {}) {
  const usesProcessEnvironment = options.environment === undefined;
  const environment = usesProcessEnvironment ? process.env : { ...options.environment };
  const dependencies = {
    execSync,
    writeManifest,
    ...options.dependencies,
    buildManifest,
    assertManifest,
    resolveExpectedAndroidCommercialState,
  };
  const apiContract = applyAndroidInternalApiContract(environment);
  if (apiContract.mode !== 'production') {
    throw new Error('COMMERCIAL_STATE_MISMATCH productionStatic.mode expected=production actual=preview');
  }
  if (usesProcessEnvironment) enforceAndroidProductionApiBaseUrl(process.env);
  else enforceAndroidProductionApiBaseUrl(environment);
  const expectedCommercialState = dependencies.resolveExpectedAndroidCommercialState(apiContract);
  const childEnvironment = {
    ...environment,
    NEXT_PUBLIC_STATIC_EXPORT: 'true',
  };

  const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const command = isWindows
    ? `"${process.execPath}" "${nextBin}" build`
    : `"${process.execPath}" "${nextBin}" build`;

  console.log('[build:static] NEXT_PUBLIC_STATIC_EXPORT=true');
  dependencies.execSync(command, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: childEnvironment,
    shell: isWindows,
  });
  const commercialManifest = dependencies.buildManifest({
    apiHost: expectedCommercialState.apiHost,
    keyFingerprint: COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint,
  }, expectedCommercialState);
  dependencies.writeManifest(outDir, commercialManifest);
  dependencies.assertManifest(commercialManifest, expectedCommercialState);
  return Object.freeze({
    ...apiContract,
    childEnvironment,
    expectedCommercialState,
    commercialManifest,
  });
}

if (require.main === module) {
  runProductionStaticBuild();
}

module.exports = {
  runProductionStaticBuild,
};
