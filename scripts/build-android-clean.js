#!/usr/bin/env node
/**
 * build:android:clean
 *
 * Hard-delete stale build artifacts, rebuild the web app, sync into the Android
 * Capacitor project, then PROVE the freshly synced Android assets actually
 * contain the current Modern Minimal dedicated PDF export path — instead of
 * silently shipping a stale bundle that still contains an old renderer.
 *
 * This exists because "npm run build && npx cap sync android passed" is not
 * proof the fix is in the shipped bundle — a stale `out/` dir, a cached
 * `.next`, or a partially-synced `android/app/src/main/assets/public` can all
 * produce a "successful" build/sync while still shipping old code.
 *
 * Exits non-zero (and does NOT proceed) if any required marker string is
 * missing from the synced Android JS assets.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

// NOTE: production builds are minified, so *local* function identifiers like
// `buildModernMinimalPagedPdfBlob` get renamed by Terser and will NOT survive as
// literal text even when the function's compiled body is present verbatim in the
// bundle. Only check for markers that are guaranteed to survive minification:
// string literals (canary text, route kind, error message fragments) and
// identifiers that are actually imported/referenced by name across module
// boundaries (which webpack/Next keep stable as property keys).
const REQUIRED_MARKERS = [
  'exportModernMinimalPdf',
  'dedicated-modern-minimal',
  'requires dedicated-modern-minimal route',
  'exportModernMinimalPdf requires templateId modern-minimal',
];

const FORBIDDEN_MARKERS = [
  'MM_DIRECT_158',
  'Modern Minimal Direct PDF',
];

function log(msg) {
  console.log(`[build:android:clean] ${msg}`);
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

function collectJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function verifyAndroidAssetsContainMarkers() {
  const publicDir = path.join(repoRoot, 'android', 'app', 'src', 'main', 'assets', 'public');
  const jsFiles = collectJsFiles(publicDir);
  if (jsFiles.length === 0) {
    console.error(`[build:android:clean] FAIL: no .js files found under ${publicDir} — sync did not produce assets.`);
    process.exit(1);
  }

  const missingByMarker = new Map(REQUIRED_MARKERS.map((m) => [m, true]));
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const marker of REQUIRED_MARKERS) {
      if (missingByMarker.get(marker) && content.includes(marker)) {
        missingByMarker.set(marker, false);
      }
    }
  }

  const missing = [...missingByMarker.entries()].filter(([, isMissing]) => isMissing).map(([marker]) => marker);
  if (missing.length > 0) {
    console.error('[build:android:clean] FAIL: synced Android assets are missing required markers:');
    for (const marker of missing) console.error(`  - ${marker}`);
    console.error(
      '[build:android:clean] The Android app would still be running a stale/wrong Modern Minimal PDF renderer. ' +
      'Do NOT build an AAB from these assets.',
    );
    process.exit(1);
  }

  const combined = jsFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const staleCanary = FORBIDDEN_MARKERS.filter((marker) => combined.includes(marker));
  if (staleCanary.length > 0) {
    console.error('[build:android:clean] FAIL: synced Android assets still contain removed debug canary markers:');
    for (const marker of staleCanary) console.error(`  - ${marker}`);
    process.exit(1);
  }

  log('all required Modern Minimal execution-path markers found in synced Android assets:');
  for (const marker of REQUIRED_MARKERS) log(`  OK  ${marker}`);
}

function main() {
  removeIfExists('.next');
  removeIfExists('out');
  removeIfExists(path.join('android', 'app', 'src', 'main', 'assets', 'public'));

  run(isWindows ? 'npm.cmd run build' : 'npm run build');
  run(isWindows ? 'npx.cmd cap sync android' : 'npx cap sync android');

  verifyAndroidAssetsContainMarkers();

  log('done — synced Android assets verified to contain the current Modern Minimal dedicated PDF export path.');
}

main();
