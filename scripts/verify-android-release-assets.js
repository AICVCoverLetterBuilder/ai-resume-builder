#!/usr/bin/env node
/**
 * Release safety checks for Capacitor Android bundles.
 * Exits 1 if production assets/config would prevent the WebView from loading.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`[verify:android:release] FAIL: ${message}`);
  process.exit(1);
}

function readJson(relPath) {
  const full = path.join(repoRoot, relPath);
  if (!fs.existsSync(full)) fail(`missing ${relPath}`);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    fail(`invalid JSON in ${relPath}: ${err.message}`);
  }
}

function assertNoDevServerUrl(config, label) {
  const server = config.server;
  if (!server) return;
  if (typeof server.url === 'string' && server.url.trim().length > 0) {
    fail(`${label} must not set server.url for production (found "${server.url}")`);
  }
}

function assertFile(relPath, label) {
  const full = path.join(repoRoot, relPath);
  if (!fs.existsSync(full)) fail(`${label} missing: ${relPath}`);
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

function verifySyncedAssets() {
  const rootConfig = readJson('capacitor.config.json');
  const androidConfig = readJson('android/app/src/main/assets/capacitor.config.json');

  assertNoDevServerUrl(rootConfig, 'capacitor.config.json');
  assertNoDevServerUrl(androidConfig, 'android/app/src/main/assets/capacitor.config.json');

  if (rootConfig.webDir !== 'out') {
    fail(`capacitor.config.json webDir must be "out", got "${rootConfig.webDir}"`);
  }

  assertFile('out/index.html', 'static export');
  assertFile('android/app/src/main/assets/public/index.html', 'synced Android web assets');

  const publicDir = path.join(repoRoot, 'android', 'app', 'src', 'main', 'assets', 'public');
  const jsFiles = collectJsFiles(publicDir);
  if (jsFiles.length === 0) {
    fail('no .js files under android/app/src/main/assets/public — cap sync did not copy app chunks');
  }

  const hasNextChunks = fs.existsSync(path.join(publicDir, '_next'));
  if (!hasNextChunks) {
    fail('android/app/src/main/assets/public/_next is missing');
  }

  console.log('[verify:android:release] synced assets OK');
  console.log(`  webDir: ${rootConfig.webDir}`);
  console.log(`  server.url: (not set)`);
  console.log(`  android JS bundles: ${jsFiles.length} files`);
}

function verifyAab(aabPath) {
  const full = path.isAbsolute(aabPath) ? aabPath : path.join(repoRoot, aabPath);
  if (!fs.existsSync(full)) fail(`AAB not found: ${full}`);

  const isWindows = process.platform === 'win32';
  let listing;
  try {
    listing = execSync(`jar tf "${full}"`, { encoding: 'utf8', shell: isWindows });
  } catch (err) {
    fail(`unable to read AAB listing: ${err.message}`);
  }

  const required = [
    'base/assets/public/index.html',
    'base/assets/public/_next/',
    'base/assets/capacitor.config.json',
  ];

  for (const entry of required) {
    if (!listing.includes(entry)) {
      fail(`AAB ${full} is missing ${entry}`);
    }
  }

  if (/server\.url|"url"\s*:\s*"https?:\/\//.test(listing)) {
    // jar listing won't include config body; extract and inspect separately below.
  }

  const extractDir = path.join(repoRoot, '.tmp-aab-verify');
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  try {
    execSync(`jar xf "${full}" base/assets/capacitor.config.json`, {
      cwd: extractDir,
      stdio: 'pipe',
      shell: isWindows,
    });
    const bundledConfig = JSON.parse(
      fs.readFileSync(path.join(extractDir, 'base', 'assets', 'capacitor.config.json'), 'utf8'),
    );
    assertNoDevServerUrl(bundledConfig, 'AAB bundled capacitor.config.json');
  } finally {
    fs.rmSync(extractDir, { recursive: true, force: true });
  }

  console.log('[verify:android:release] AAB assets OK');
  console.log(`  ${full}`);
  console.log('  base/assets/public/index.html: present');
  console.log('  base/assets/public/_next/: present');
}

function main() {
  verifySyncedAssets();
  const aabArg = process.argv.find((arg) => arg.startsWith('--aab='));
  if (aabArg) verifyAab(aabArg.slice('--aab='.length));
}

main();
