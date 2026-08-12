#!/usr/bin/env node
/**
 * Release safety checks for Capacitor Android bundles.
 * Exits 1 if production assets/config would prevent the WebView from loading.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { REQUIRED_PDF_FONT_FILES, MIN_FONT_BYTES } = require('./pdf-font-manifest');
const {
  COMMERCIAL_STATE,
  safeFingerprint,
  validateCheckedInCommercialState,
  assertManifest,
} = require('./android-commercial-state-contract');

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

function assertSensitiveDataBackupDisabled() {
  const manifestPath = path.join(repoRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) fail(`missing ${manifestPath}`);
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  if (/android:allowBackup\s*=\s*"true"/.test(manifest)) {
    fail('AndroidManifest must set android:allowBackup="false" to prevent CV draft cloud restore');
  }
  if (!/android:allowBackup\s*=\s*"false"/.test(manifest)) {
    fail('AndroidManifest must explicitly set android:allowBackup="false"');
  }
  const rulesPath = path.join(repoRoot, 'android', 'app', 'src', 'main', 'res', 'xml', 'data_extraction_rules.xml');
  if (!fs.existsSync(rulesPath)) {
    fail('missing android/app/src/main/res/xml/data_extraction_rules.xml');
  }
  console.log('[verify:android:release] sensitive CV backup disabled (allowBackup=false)');
}

function assertPdfFontBundle(relDir, label) {
  for (const fileName of REQUIRED_PDF_FONT_FILES) {
    const relPath = path.join(relDir, 'fonts', fileName);
    const full = path.join(repoRoot, relPath);
    if (!fs.existsSync(full)) {
      fail(`${label} missing multilingual PDF font: ${relPath}`);
    }
    const size = fs.statSync(full).size;
    if (size < MIN_FONT_BYTES) {
      fail(`${label} PDF font too small (${size} bytes): ${relPath}`);
    }
  }
  console.log(`[verify:android:release] ${label} PDF fonts OK (${REQUIRED_PDF_FONT_FILES.length} files)`);
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

function collectRevenueCatKeys(dir, keys = new Set()) {
  if (!fs.existsSync(dir)) return keys;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectRevenueCatKeys(full, keys);
    else if (/\.(?:js|html)$/i.test(entry.name)) {
      const matches = fs.readFileSync(full, 'utf8').match(/goog_[A-Za-z0-9_]+/g) || [];
      for (const match of matches) keys.add(match);
    }
  }
  return keys;
}

function assertRevenueCatKey(dir, label) {
  const keys = [...collectRevenueCatKeys(dir)];
  if (keys.length !== 1) fail(`${label} must contain exactly one RevenueCat Android public key`);
  const fingerprint = safeFingerprint(keys[0]);
  if (fingerprint !== COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint) {
    fail(`REVENUECAT_ANDROID_KEY_MISMATCH expected=${COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint} actual=${fingerprint}`);
  }
  console.log(`[verify:android:release] ${label} RevenueCat Android key fingerprint OK (${fingerprint})`);
}

function assertCommercialManifest(fullPath, label) {
  if (!fs.existsSync(fullPath)) fail(`${label} commercial state manifest is missing`);
  try {
    assertManifest(JSON.parse(fs.readFileSync(fullPath, 'utf8')));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function verifySyncedAssets() {
  try {
    validateCheckedInCommercialState(repoRoot);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  const rootConfig = readJson('capacitor.config.json');
  const androidConfig = readJson('android/app/src/main/assets/capacitor.config.json');

  assertNoDevServerUrl(rootConfig, 'capacitor.config.json');
  assertNoDevServerUrl(androidConfig, 'android/app/src/main/assets/capacitor.config.json');

  if (rootConfig.webDir !== 'out') {
    fail(`capacitor.config.json webDir must be "out", got "${rootConfig.webDir}"`);
  }

  assertFile('out/index.html', 'static export');
  assertPdfFontBundle('out', 'static export');
  assertFile('android/app/src/main/assets/public/index.html', 'synced Android web assets');
  assertPdfFontBundle(path.join('android', 'app', 'src', 'main', 'assets', 'public'), 'synced Android web assets');
  assertSensitiveDataBackupDisabled();

  const publicDir = path.join(repoRoot, 'android', 'app', 'src', 'main', 'assets', 'public');
  assertCommercialManifest(path.join(repoRoot, 'out', 'android-commercial-state.json'), 'static export');
  assertCommercialManifest(path.join(publicDir, 'android-commercial-state.json'), 'synced Android assets');
  assertRevenueCatKey(publicDir, 'synced Android assets');
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
    'base/assets/public/fonts/',
  ];

  for (const entry of required) {
    if (!listing.includes(entry)) {
      fail(`AAB ${full} is missing ${entry}`);
    }
  }

  for (const fileName of REQUIRED_PDF_FONT_FILES) {
    const entry = `base/assets/public/fonts/${fileName}`;
    if (!listing.includes(entry)) {
      fail(`AAB ${full} is missing multilingual PDF font ${entry}`);
    }
  }
  console.log(`[verify:android:release] AAB PDF fonts OK (${REQUIRED_PDF_FONT_FILES.length} files)`);

  if (/server\.url|"url"\s*:\s*"https?:\/\//.test(listing)) {
    // jar listing won't include config body; extract and inspect separately below.
  }

  const extractDir = path.join(repoRoot, '.tmp-aab-verify');
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  try {
    execSync(`jar xf "${full}"`, {
      cwd: extractDir,
      stdio: 'pipe',
      shell: isWindows,
    });
    const bundledConfig = JSON.parse(
      fs.readFileSync(path.join(extractDir, 'base', 'assets', 'capacitor.config.json'), 'utf8'),
    );
    assertNoDevServerUrl(bundledConfig, 'AAB bundled capacitor.config.json');
    const aabPublicDir = path.join(extractDir, 'base', 'assets', 'public');
    assertCommercialManifest(path.join(aabPublicDir, 'android-commercial-state.json'), 'AAB bundled');
    assertRevenueCatKey(aabPublicDir, 'AAB bundled');
    let certificate;
    try {
      const keytool = process.env.JAVA_HOME
        ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool')
        : 'keytool';
      certificate = execSync(`"${keytool}" -printcert -jarfile "${full}"`, { encoding: 'utf8', shell: isWindows });
    } catch (error) {
      fail(`unable to read AAB signing certificate: ${error.message}`);
    }
    const fingerprint = (certificate.match(/SHA256:\s*([A-F0-9:]+)/i) || [])[1]?.replace(/:/g, '');
    if (fingerprint !== COMMERCIAL_STATE.releaseSigningCertificateFingerprint) {
      fail(`COMMERCIAL_STATE_MISMATCH releaseSigningCertificateFingerprint expected=${COMMERCIAL_STATE.releaseSigningCertificateFingerprint} actual=${fingerprint || 'missing'}`);
    }
    console.log('[verify:android:release] AAB release signing certificate fingerprint OK');
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
