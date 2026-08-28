import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const root = process.cwd();
const aabPath = path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
const gradlePath = path.join(root, 'android/app/build.gradle');
const outDir = path.join(root, 'out');
const assetsPublic = path.join(root, 'android/app/src/main/assets/public');
const capAssets = path.join(root, 'android/app/src/main/assets/capacitor.config.json');
const commitShort = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
const commitFull = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

const markers323 = [
  'german-summary-current-duty-serialization-323-v1',
  'summary-entry-duty-coverage-323-v1',
  'german-summary-controlled-case-grammar-323-v1',
  'summary-repair-selection-truth-323-v1',
];
const retain = [
  'german-summary-structured-role-localization-322-v1',
  'summary-structured-entity-locale-validation-322-v1',
  'german-summary-employer-coverage-321-v1',
  'german-summary-employment-state-321-v1',
  'summary-repaired-provider-lineage-321-v1',
  'german-summary-recovery-dispatch-320-v1',
  'summary-explicit-skill-provenance-320-v1',
  'german-summary-competency-grounding-319-v1',
  'EXPERIENCE_AI_DIAG_V1',
  'SUMMARY_AI_DIAG_V1',
  'cv-ai-diagnostics-v2',
];
const stale322Only = [
  // none unique to 322-only that should be absent after 323; check old AAB-322-only omit phrase not required
];

function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

function scanDir(dir) {
  const found323 = Object.fromEntries(markers323.map((m) => [m, false]));
  const foundRetain = Object.fromEntries(retain.map((m) => [m, false]));
  let prodHost = false;
  let commit = false;
  let internalDiag = false;
  let files = 0;
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(js|html|json|txt)$/i.test(name)) {
        files += 1;
        const t = fs.readFileSync(p, 'utf8');
        if (t.includes('ai-resume-builder-six-gamma.vercel.app') || t.includes('/api/generate')) {
          prodHost = true;
        }
        if (t.includes(commitShort) || t.includes(commitFull.slice(0, 7))) commit = true;
        if (t.includes('internal-ai-diagnostics') || t.includes('INTERNAL_AI') || t.includes('cv-ai-diagnostics-v2')) {
          internalDiag = true;
        }
        for (const m of markers323) if (t.includes(m)) found323[m] = true;
        for (const m of retain) if (t.includes(m)) foundRetain[m] = true;
      }
    }
  }
  walk(dir);
  return {
    files,
    prodHost,
    commit,
    markers323: found323,
    markersRetain: foundRetain,
    markers323Ok: Object.values(found323).every(Boolean),
    markersRetainOk: Object.values(foundRetain).every(Boolean),
    internalDiag,
  };
}

function scanAab(aab) {
  const tmp = path.join(root, '.tmp-aab323-unzip');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execSync(`jar xf "${aab}"`, { cwd: tmp, stdio: 'ignore' });
  // assets live under base/assets/
  const publicDir = path.join(tmp, 'base/assets/public');
  const cap = path.join(tmp, 'base/assets/capacitor.config.json');
  const scanned = scanDir(publicDir);
  let serverUrlSet = false;
  let capSnippet = null;
  if (fs.existsSync(cap)) {
    const raw = fs.readFileSync(cap, 'utf8');
    capSnippet = raw.replace(/\s+/g, ' ').trim();
    try {
      const j = JSON.parse(raw);
      serverUrlSet = Boolean(j?.server?.url);
    } catch {
      serverUrlSet = /"url"\s*:/.test(raw);
    }
  }
  return { scanned, serverUrlSet, capSnippet, capExists: fs.existsSync(cap) };
}

const gradle = fs.readFileSync(gradlePath, 'utf8');
const versionCode = Number((gradle.match(/versionCode\s+(\d+)/) || [])[1] || 0);
const versionName = ((gradle.match(/versionName\s+"([^"]+)"/) || [])[1] || '');
const size = fs.statSync(aabPath).size;
const sha = sha256File(aabPath);

const outScan = scanDir(outDir);
const assetsScan = scanDir(assetsPublic);
const aabScan = scanAab(aabPath);

let capLocal = fs.existsSync(capAssets) ? fs.readFileSync(capAssets, 'utf8') : '';
let localServerUrl = false;
try {
  localServerUrl = Boolean(JSON.parse(capLocal)?.server?.url);
} catch {
  localServerUrl = /"url"\s*:/.test(capLocal);
}

console.log('path', aabPath);
console.log('size', size);
console.log('sha256', sha);
console.log('versionCode', versionCode);
console.log('versionName', versionName);
console.log('commitShort', commitShort);
console.log('commitFull', commitFull);
console.log('capacitor_exists', aabScan.capExists);
console.log('server.url_set', aabScan.serverUrlSet);
console.log('local_server.url_set', localServerUrl);
console.log('cap_snippet', aabScan.capSnippet);
console.log('=== out ===');
console.log(JSON.stringify(outScan, null, 2));
console.log('=== assets ===');
console.log(JSON.stringify(assetsScan, null, 2));
console.log('=== aab ===');
console.log(JSON.stringify(aabScan.scanned, null, 2));
console.log(
  'parity_323',
  outScan.markers323Ok && assetsScan.markers323Ok && aabScan.scanned.markers323Ok,
);
console.log(
  'parity_retain',
  outScan.markersRetainOk && assetsScan.markersRetainOk && aabScan.scanned.markersRetainOk,
);

// internal verifier
let verifierExit = null;
try {
  execSync('node scripts/verify-internal-ai-reset-builds.mjs --dir out --expect enabled', {
    stdio: 'inherit',
  });
  verifierExit = 0;
} catch (e) {
  verifierExit = e.status ?? 1;
}
console.log('internal_verifier_exit', verifierExit);
console.log('DONE');
