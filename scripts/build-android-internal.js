#!/usr/bin/env node
/**
 * Internal Android packaging order is deliberate: a normal web build may
 * replace `out/`, so it must happen before the final internal static export.
 * The verifier runs only after Capacitor has copied that final export.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const win = process.platform === 'win32';
const copied = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'public');
const capacitorConfig = path.join(root, 'android', 'app', 'src', 'main', 'assets', 'capacitor.config.json');
const host = 'https://ai-resume-builder-six-gamma.vercel.app';
const packagingMarker = 'aab392-internal-diagnostics-packaging-v1';

function run(command) {
  console.log(`[build:android:internal] ${command}`);
  execSync(command, { cwd: root, stdio: 'inherit' });
}

function fail(message) {
  console.error(`[build:android:internal] FAIL: ${message}`);
  process.exit(1);
}

run(`${process.execPath} node_modules/next/dist/bin/next build`);
run(`${process.execPath} scripts/build-static-internal.js`);
fs.writeFileSync(path.join(root, 'out', 'aab392-internal-diagnostics-packaging.txt'), `${packagingMarker}\n`, 'utf8');
run(win ? 'npx.cmd cap sync android' : 'npx cap sync android');
run(`${process.execPath} scripts/verify-internal-ai-reset-assets.mjs --dir "${copied}" --expect enabled`);

if (!fs.existsSync(capacitorConfig)) fail('missing copied Capacitor config');
if (JSON.parse(fs.readFileSync(capacitorConfig, 'utf8')).server?.url) {
  fail('Capacitor server.url must be absent from packaged internal assets');
}

const stack = [copied];
let hasHost = false;
while (stack.length) {
  const dir = stack.pop();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) stack.push(full);
    else if (/\.(?:js|html|txt)$/i.test(entry.name)
      && fs.readFileSync(full, 'utf8').includes(host)) hasHost = true;
  }
}
if (!hasHost) fail(`missing production API host ${host} in copied Android assets`);
if (!fs.existsSync(path.join(copied, 'aab392-internal-diagnostics-packaging.txt'))
  || !fs.readFileSync(path.join(copied, 'aab392-internal-diagnostics-packaging.txt'), 'utf8').includes(packagingMarker)) {
  fail(`missing copied packaging marker ${packagingMarker}`);
}
console.log('[build:android:internal] OK copied Android assets are internal, V2-on, diagnostic-enabled, and API-host verified');
