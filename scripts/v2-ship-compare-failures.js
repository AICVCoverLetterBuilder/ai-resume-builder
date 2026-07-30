/**
 * Compare vitest JSON failure identities across baseline/current runs.
 * Usage: node scripts/v2-ship-compare-failures.js b1.json b2.json c1.json c2.json
 */
const fs = require('fs');

function load(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function failuresFrom(report) {
  const out = [];
  for (const tr of report.testResults || []) {
    const file = String(tr.name || tr.file || '')
      .replace(/\\/g, '/')
      .replace(/^.*?(src\/)/, '$1');
    for (const t of tr.assertionResults || []) {
      if (t.status === 'failed') {
        out.push(`${file} :: ${t.fullName || t.title || t.name || ''}`);
      }
    }
  }
  return out;
}

function counts(report) {
  return {
    passed: report.numPassedTests ?? 0,
    failed: report.numFailedTests ?? 0,
    skipped: report.numPendingTests ?? 0,
  };
}

const [b1p, b2p, c1p, c2p] = process.argv.slice(2);
const b1 = load(b1p);
const b2 = load(b2p);
const c1 = load(c1p);
const c2 = load(c2p);

const b1Ids = new Set(failuresFrom(b1));
const b2Ids = new Set(failuresFrom(b2));
const c1Ids = new Set(failuresFrom(c1));
const c2Ids = new Set(failuresFrom(c2));
const bAll = new Set([...b1Ids, ...b2Ids]);
const cStable = new Set([...c1Ids].filter((x) => c2Ids.has(x)));
const stableCurrentOnly = [...cStable].filter((x) => !bAll.has(x)).sort();
const flakyCurrentOnly = [
  ...[...c1Ids].filter((x) => !c2Ids.has(x) && !bAll.has(x)),
  ...[...c2Ids].filter((x) => !c1Ids.has(x) && !bAll.has(x)),
].sort();
const baselineOnlyNowPassing = [...bAll].filter((x) => !c1Ids.has(x) && !c2Ids.has(x)).sort();
const shared = [...cStable].filter((x) => bAll.has(x)).sort();

const out = {
  counts: {
    b1: counts(b1),
    b2: counts(b2),
    c1: counts(c1),
    c2: counts(c2),
  },
  sharedStableCount: shared.length,
  stableCurrentOnlyCount: stableCurrentOnly.length,
  flakyCurrentOnlyCount: flakyCurrentOnly.length,
  baselineOnlyNowPassingCount: baselineOnlyNowPassing.length,
  stableCurrentOnly,
  flakyCurrentOnly,
  baselineOnlyNowPassing,
};

fs.writeFileSync('.v2-ship-failure-compare.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
