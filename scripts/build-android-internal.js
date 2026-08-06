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

const root = path.resolve(__dirname, '..');
loadEnvConfig(root);

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

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) fail(`missing required ${name}`);
  return value;
}

const apiBaseUrl = requiredEnv('NEXT_PUBLIC_API_BASE_URL');
const revenueCatAndroidKey = requiredEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY');

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

// execFileSync keeps `C:\\Program Files\\nodejs\\node.exe` intact on Windows.
runFile(process.execPath, [nextBin, 'build']);
runFile(process.execPath, [staticBuildScript]);
fs.writeFileSync(path.join(root, 'out', 'aab392-internal-diagnostics-packaging.txt'), `${packagingMarker}\n`, 'utf8');
runFile(win ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android'], { shell: win });
runFile(process.execPath, [verifyScript, '--dir', copied, '--expect', 'enabled']);

if (!fs.existsSync(capacitorConfig)) fail('missing copied Capacitor config');
if (JSON.parse(fs.readFileSync(capacitorConfig, 'utf8')).server?.url) {
  fail('Capacitor server.url must be absent from packaged internal assets');
}
if (!treeContainsExactValue(copied, apiBaseUrl)) {
  fail('configured production API base URL is absent from copied Android assets');
}
if (!treeContainsExactValue(copied, revenueCatAndroidKey)) {
  fail('RevenueCat Android public key is absent from copied Android assets');
}
if (!fs.existsSync(path.join(copied, 'aab392-internal-diagnostics-packaging.txt'))
  || !fs.readFileSync(path.join(copied, 'aab392-internal-diagnostics-packaging.txt'), 'utf8').includes(packagingMarker)) {
  fail(`missing copied packaging marker ${packagingMarker}`);
}
console.log('[build:android:internal] OK copied Android assets are internal, V2-on, diagnostic-enabled, API-host verified, and RevenueCat-configured');
