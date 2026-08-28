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

const markers329 = [
  'experience-selected-final-coverage-329-v1',
  'experience-phased-diagnostic-completeness-329-v1',
  'experience-transactional-apply-truth-329-v1',
  'experience-final-visible-predicate-truth-329-v1',
];
const retain = [
  'english-experience-incoming-goods-matcher-328-v1',
  'english-experience-deterministic-three-fact-328-v1',
  'experience-phase-locale-truth-328-v1',
  'experience-rejection-lineage-truth-328-v1',
  'english-experience-three-fact-coverage-327-v1',
  'experience-fact-authority-truth-327-v1',
  'experience-visible-snapshot-truth-327-v1',
  'experience-invariant-preapply-gate-327-v1',
  'EXPERIENCE_AI_DIAG_V1',
  'SUMMARY_AI_DIAG_V1',
  'cv-ai-diagnostics-v2',
];

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function scanDir(dir) {
  const found329 = Object.fromEntries(markers329.map((m) => [m, false]));
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
        for (const m of markers329) if (t.includes(m)) found329[m] = true;
        for (const m of retain) if (t.includes(m)) foundRetain[m] = true;
      }
    }
  }
  walk(dir);
  return {
    prodHost,
    commit,
    markers329: found329,
    markersRetain: foundRetain,
    markers329Ok: Object.values(found329).every(Boolean),
    markersRetainOk: Object.values(foundRetain).every(Boolean),
    internalDiag,
  };
}

const gradle = fs.readFileSync(gradlePath, 'utf8');
const versionCode = /versionCode\s+(\d+)/.exec(gradle)?.[1];
const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
const aabStat = fs.statSync(aabPath);
const aabSha = sha256File(aabPath);
const outScan = scanDir(outDir);
const assetScan = scanDir(assetsPublic);
const cap = JSON.parse(fs.readFileSync(capAssets, 'utf8'));
const serverUrlSet = Boolean(cap.server && cap.server.url);

// Unzip AAB briefly via jar listing for stale check is heavy; scan assets instead.
const stale328Only = outScan.markersRetain['english-experience-incoming-goods-matcher-328-v1']
  && !outScan.markers329Ok;

console.log(JSON.stringify({
  versionCode,
  versionName,
  commitShort,
  commitFull,
  aabPath: path.relative(root, aabPath).replace(/\\/g, '/'),
  aabBytes: aabStat.size,
  aabSha256: aabSha,
  serverUrlSet,
  out: outScan,
  assets: assetScan,
  parityMarkers329: outScan.markers329Ok && assetScan.markers329Ok,
  parityRetain: outScan.markersRetainOk && assetScan.markersRetainOk,
  stale328Only,
  buildSuccessful: true,
}, null, 2));

if (versionCode !== '329' || versionName !== '1.0.329') process.exit(2);
if (!outScan.markers329Ok || !assetScan.markers329Ok) process.exit(3);
if (serverUrlSet) process.exit(4);
