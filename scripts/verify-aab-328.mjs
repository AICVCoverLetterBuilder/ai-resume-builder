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

const markers328 = [
  'english-experience-incoming-goods-matcher-328-v1',
  'english-experience-deterministic-three-fact-328-v1',
  'experience-phase-locale-truth-328-v1',
  'experience-rejection-lineage-truth-328-v1',
];
const retain = [
  'english-experience-three-fact-coverage-327-v1',
  'experience-fact-authority-truth-327-v1',
  'experience-visible-snapshot-truth-327-v1',
  'experience-invariant-preapply-gate-327-v1',
  'english-summary-visible-current-coverage-326-v1',
  'summary-visible-required-fact-parity-326-v1',
  'summary-selected-lineage-hash-truth-326-v1',
  'summary-sentence-semantic-role-truth-326-v1',
  'english-summary-shared-final-gate-325-v1',
  'EXPERIENCE_AI_DIAG_V1',
  'SUMMARY_AI_DIAG_V1',
  'cv-ai-diagnostics-v2',
];

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function scanDir(dir) {
  const found328 = Object.fromEntries(markers328.map((m) => [m, false]));
  const foundRetain = Object.fromEntries(retain.map((m) => [m, false]));
  let prodHost = false;
  let commit = false;
  let internalDiag = false;
  let stale327Only = false;
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
        for (const m of markers328) if (t.includes(m)) found328[m] = true;
        for (const m of retain) if (t.includes(m)) foundRetain[m] = true;
      }
    }
  }
  walk(dir);
  const has327 = foundRetain['english-experience-three-fact-coverage-327-v1'];
  const has328 = Object.values(found328).every(Boolean);
  stale327Only = Boolean(has327 && !has328);
  return {
    prodHost,
    commit,
    markers328: found328,
    markersRetain: foundRetain,
    markers328Ok: Object.values(found328).every(Boolean),
    markersRetainOk: Object.values(foundRetain).every(Boolean),
    internalDiag,
    stale327Only,
  };
}

function scanAab(aab) {
  const tmp = path.join(root, '.tmp-aab328-unzip');
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
  'parity_328',
  outScan.markers328Ok && assetsScan.markers328Ok && aabScan.scanned.markers328Ok,
);
console.log(
  'parity_retain',
  outScan.markersRetainOk && assetsScan.markersRetainOk && aabScan.scanned.markersRetainOk,
);
console.log(
  'stale_327_only_absent',
  !outScan.stale327Only && !assetsScan.stale327Only && !aabScan.scanned.stale327Only,
);
execSync('node scripts/verify-internal-ai-reset-assets.mjs --dir out --expect enabled', {
  stdio: 'inherit',
});
console.log('internal_verifier_exit', 0);
console.log('DONE');
