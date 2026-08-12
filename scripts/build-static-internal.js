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
  establishAndroidPackagingEnvironment,
  validateCheckedInCommercialState,
  buildManifest,
  writeManifest,
} = require('./android-commercial-state-contract');

const repoRoot = path.resolve(__dirname, '..');
loadEnvConfig(repoRoot);
enforceAndroidProductionApiBaseUrl(process.env);
const commercialKey = establishAndroidPackagingEnvironment(process.env);
validateCheckedInCommercialState(repoRoot);

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    console.error(`[build:static:internal] FAIL: missing required ${name}`);
    process.exit(1);
  }
  return value;
}

const revenueCatAndroidKey = requiredEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY');
const apiBaseUrl = requiredEnv('NEXT_PUBLIC_API_BASE_URL');
if (apiBaseUrl !== ANDROID_PRODUCTION_API_BASE_URL) {
  console.error('[build:static:internal] FAIL: Android static build must use the public Production API base URL');
  process.exit(1);
}

const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC_EXPORT: 'true',
  NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
  NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
  // Internal device validation only — do not set this in production/web builds.
  NEXT_PUBLIC_ENABLE_SUMMARY_V2: 'true',
};

const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const verify = path.join(__dirname, 'verify-internal-ai-reset-assets.mjs');
const outDir = path.join(repoRoot, 'out');

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

console.log(
  '[build:static:internal] channel=internal enableAiTestReset=true staticExport=true enableSummaryV2=true',
);
execFileSync(process.execPath, [nextBin, 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env,
});
writeManifest(outDir, buildManifest({
  apiHost: apiBaseUrl,
  keyFingerprint: commercialKey.fingerprint,
}));
execFileSync(process.execPath, [verify, '--dir', 'out', '--expect', 'enabled'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env,
});
if (!treeContainsExactValue(outDir, revenueCatAndroidKey)) {
  console.error('[build:static:internal] FAIL: RevenueCat Android public key is absent from built assets');
  process.exit(1);
}
console.log('[build:static:internal] OK — internal diagnostics and RevenueCat configuration are present in out/');
