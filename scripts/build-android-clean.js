#!/usr/bin/env node
/**
 * build:android:clean
 *
 * Hard-delete stale build artifacts, run a production static export into out/,
 * sync bundled assets into the Android Capacitor project, then verify the
 * synced assets are sufficient for release WebView startup (no dev server).
 *
 * Exits non-zero if any release safety check fails.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

function log(msg) {
  console.log(`[build:android:clean] ${msg}`);
}

function fail(msg) {
  console.error(`[build:android:clean] FAIL: ${msg}`);
  process.exit(1);
}

function removeIfExists(relPath) {
  const target = path.join(repoRoot, relPath);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    log(`removed ${relPath}`);
  } else {
    log(`skip (does not exist) ${relPath}`);
  }
}

function run(commandLine) {
  log(`running: ${commandLine}`);
  execSync(commandLine, { cwd: repoRoot, stdio: 'inherit' });
}

function assertFile(relPath) {
  const full = path.join(repoRoot, relPath);
  if (!fs.existsSync(full)) fail(`missing required file: ${relPath}`);
  log(`OK  ${relPath}`);
}

function assertCapacitorConfigNoServerUrl(relPath) {
  const full = path.join(repoRoot, relPath);
  if (!fs.existsSync(full)) fail(`missing ${relPath}`);
  const config = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (config.server?.url) {
    fail(`${relPath} must not set server.url for production (found "${config.server.url}")`);
  }
  log(`OK  ${relPath} has no server.url`);
}

function collectJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function verifySyncedAppChunks() {
  const publicDir = path.join(repoRoot, 'android', 'app', 'src', 'main', 'assets', 'public');
  const jsFiles = collectJsFiles(publicDir);
  if (jsFiles.length === 0) {
    fail('no .js files under android/app/src/main/assets/public — cap sync did not copy app chunks');
  }
  if (!fs.existsSync(path.join(publicDir, '_next'))) {
    fail('android/app/src/main/assets/public/_next is missing');
  }
  log(`OK  synced Android assets contain ${jsFiles.length} JS files and _next/`);
}

function main() {
  removeIfExists('.next');
  removeIfExists('out');
  removeIfExists(path.join('android', 'app', 'src', 'main', 'assets', 'public'));

  run(isWindows ? 'node scripts/build-static.js' : 'node scripts/build-static.js');

  assertFile('out/index.html');

  run(isWindows ? 'npx.cmd cap sync android' : 'npx cap sync android');

  assertFile('android/app/src/main/assets/public/index.html');
  assertCapacitorConfigNoServerUrl('android/app/src/main/assets/capacitor.config.json');
  verifySyncedAppChunks();

  run(isWindows ? 'node scripts/verify-android-release-assets.js' : 'node scripts/verify-android-release-assets.js');

  log('done — production static export synced and verified for Android release startup.');
}

main();
