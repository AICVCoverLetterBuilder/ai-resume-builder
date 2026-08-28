import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const root = process.cwd();
const aabPath = path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab');
const gradlePath = path.join(root, 'android/app/build.gradle');
const outDir = path.join(root, 'out');
const assetsPublic = path.join(root, 'android/app/src/main/assets/public');
const capAssets = path.join(root, 'android/app/src/main/assets/capacitor.config.json');
const commitShort = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
const commitFull = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

const markers324 = [
  'german-summary-third-current-duty-324-v1',
  'summary-authoritative-duty-parity-324-v1',
  'summary-visible-duty-parity-324-v1',
  'summary-duty-parity-apply-gate-324-v1',
];
const retain = [
  'german-summary-current-duty-serialization-323-v1',
  'summary-entry-duty-coverage-323-v1',
  'german-summary-controlled-case-grammar-323-v1',
  'summary-repair-selection-truth-323-v1',
  'german-summary-structured-role-localization-322-v1',
  'summary-structured-entity-locale-validation-322-v1',
  'german-summary-employer-coverage-321-v1',
  'EXPERIENCE_AI_DIAG_V1',
  'SUMMARY_AI_DIAG_V1',
  'cv-ai-diagnostics-v2',
];

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function scanDir(dir) {
  const found324 = Object.fromEntries(markers324.map((m) => [m, false]));
  const foundRetain = Object.fromEntries(retain.map((m) => [m, false]));
  let prodHost = false;
  let commit = false;
  let internalDiag = false;
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(js|html|json|txt)$/i.test(name)) {
        const t = fs.readFileSync(p, 'utf8');
        if (t.includes('ai-resume-builder-six-gamma.vercel.app') || t.includes('/api/generate')) {
          prodHost = true;
        }
        if (t.includes(commitShort) || t.includes(commitFull.slice(0, 7))) commit = true;
        if (t.includes('internal-ai-diagnostics') || t.includes('cv-ai-diagnostics-v2')) {
          internalDiag = true;
        }
        for (const m of markers324) if (t.includes(m)) found324[m] = true;
        for (const m of retain) if (t.includes(m)) foundRetain[m] = true;
      }
    }
  }
  walk(dir);
  return {
    prodHost,
    commit,
    markers324: found324,
    markersRetain: foundRetain,
    markers324Ok: Object.values(found324).every(Boolean),
    markersRetainOk: Object.values(foundRetain).every(Boolean),
    internalDiag,
  };
}

function scanAab(aab) {
  const tmp = path.join(root, '.tmp-aab324-unzip');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  execSync(`jar xf "${aab}"`, { cwd: tmp, stdio: 'ignore' });
  const publicDir = path.join(tmp, 'base/assets/public');
  const cap = path.join(tmp, 'base/assets/capacitor.config.json');
  const scanned = scanDir(publicDir);
  let serverUrlSet = false;
  let capSnippet = null;
  if (fs.existsSync(cap)) {
    const raw = fs.readFileSync(cap, 'utf8');
    capSnippet = raw.replace(/\s+/g, ' ').trim();
    try {
      serverUrlSet = Boolean(JSON.parse(raw)?.server?.url);
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
let localServerUrl = false;
try {
  localServerUrl = Boolean(JSON.parse(fs.readFileSync(capAssets, 'utf8'))?.server?.url);
} catch {
  localServerUrl = false;
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
console.log('=== out ===', JSON.stringify(outScan));
console.log('=== assets ===', JSON.stringify(assetsScan));
console.log('=== aab ===', JSON.stringify(aabScan.scanned));
console.log(
  'parity_324',
  outScan.markers324Ok && assetsScan.markers324Ok && aabScan.scanned.markers324Ok,
);
console.log(
  'parity_retain',
  outScan.markersRetainOk && assetsScan.markersRetainOk && aabScan.scanned.markersRetainOk,
);
execSync('node scripts/verify-internal-ai-reset-assets.mjs --dir out --expect enabled', {
  stdio: 'inherit',
});
console.log('internal_verifier_exit', 0);
console.log('DONE');
