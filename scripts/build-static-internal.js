#!/usr/bin/env node
/**
 * Internal static export for Capacitor Android device validation.
 *
 * Forces the established internal-build contract:
 *   NEXT_PUBLIC_BUILD_CHANNEL=internal
 *   NEXT_PUBLIC_ENABLE_AI_TEST_RESET=true
 *   NEXT_PUBLIC_STATIC_EXPORT=true
 *
 * Then verifies Reset + Experience/Summary AI diagnostics markers are present.
 * Production `build` / `build:static` remain disabled by default.
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC_EXPORT: 'true',
  NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
  NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
};

const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const verify = path.join(__dirname, 'verify-internal-ai-reset-assets.mjs');
const command = `"${process.execPath}" "${nextBin}" build`;

console.log('[build:static:internal] channel=internal enableAiTestReset=true staticExport=true');
execSync(command, { cwd: repoRoot, stdio: 'inherit', env, shell: isWindows });
execSync(`"${process.execPath}" "${verify}" --dir out --expect enabled`, {
  cwd: repoRoot,
  stdio: 'inherit',
  env,
  shell: isWindows,
});
console.log('[build:static:internal] OK — internal diagnostics markers present in out/');
