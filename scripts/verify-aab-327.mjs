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

const markers327 = [
  'english-experience-three-fact-coverage-327-v1',
  'experience-fact-authority-truth-327-v1',
  'experience-visible-snapshot-truth-327-v1',
  'experience-invariant-preapply-gate-327-v1',
];
const markers326 = [
  'english-summary-visible-current-coverage-326-v1',
  'summary-visible-required-fact-parity-326-v1',
  'summary-selected-lineage-hash-truth-326-v1',
  'summary-sentence-semantic-role-truth-326-v1',
];
const retain = [
  ...markers326,
  'english-summary-shared-final-gate-325-v1',
  'english-summary-entity-locale-purity-325-v1',
  'english-summary-current-prior-coverage-325-v1',
  'summary-invariant-preapply-gate-325-v1',
  'german-summary-third-current-duty-324-v1',
  'summary-authoritative-duty-parity-324-v1',
  'summary-visible-duty-parity-324-v1',
  'summary-duty-parity-apply-gate-324-v1',
  'german-summary-current-duty-serialization-323-v1',
  'summary-entry-duty-coverage-323-v1',
  'german-summary-controlled-case-grammar-323-v1',
  'summary-repair-selection-truth-323-v1',
  'EXPERIENCE_AI_DIAG_V1',
  'SUMMARY_AI_DIAG_V1',
  'cv-ai-diagnostics-v2',
];

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function scanDir(dir) {
  const found327 = Object.fromEntries(markers327.map((m) => [m, false]));
  const foundRetain = Object.fromEntries(retain.map((m) => [m, false]));
  let prodHost = false;
  let commit = false;
  let internalDiag = false;
  let stale326Only = false;
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
        for (const m of markers327) if (t.includes(m)) found327[m] = true;
        for (const m of retain) if (t.includes(m)) foundRetain[m] = true;
      }
    }
  }
  walk(dir);
  const has326 = foundRetain['english-summary-visible-current-coverage-326-v1'];
  const has327 = Object.values(found327).every(Boolean);
  stale326Only = Boolean(has326 && !has327);
  return {
    prodHost,
    commit,
    markers327: found327,
    markersRetain: foundRetain,
    markers327Ok: Object.values(found327).every(Boolean),
    markersRetainOk: Object.values(foundRetain).every(Boolean),
    internalDiag,
    stale326Only,
  };
}

function scanAab(aab) {
  const tmp = path.join(root, '.tmp-aab327-unzip');
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
  'parity_327',
  outScan.markers327Ok && assetsScan.markers327Ok && aabScan.scanned.markers327Ok,
);
console.log(
  'parity_retain',
  outScan.markersRetainOk && assetsScan.markersRetainOk && aabScan.scanned.markersRetainOk,
);
console.log(
  'stale_326_only_absent',
  !outScan.stale326Only && !assetsScan.stale326Only && !aabScan.scanned.stale326Only,
);
execSync('node scripts/verify-internal-ai-reset-assets.mjs --dir out --expect enabled', {
  stdio: 'inherit',
});
console.log('internal_verifier_exit', 0);
console.log('DONE');
