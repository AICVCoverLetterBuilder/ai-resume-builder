import https from 'https';

const alias = 'https://ai-resume-builder-six-gamma.vercel.app';

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

const markers = [
  'english-experience-three-fact-coverage-327-v1',
  'experience-fact-authority-truth-327-v1',
  'experience-visible-snapshot-truth-327-v1',
  'experience-invariant-preapply-gate-327-v1',
  'english-summary-visible-current-coverage-326-v1',
  'summary-visible-required-fact-parity-326-v1',
  'summary-selected-lineage-hash-truth-326-v1',
  'summary-sentence-semantic-role-truth-326-v1',
  'english-summary-shared-final-gate-325-v1',
  'SUMMARY_AI_DIAG_V1',
  'EXPERIENCE_AI_DIAG_V1',
  'cv-ai-diagnostics-v2',
];

const home = await get(`${alias}/`);
console.log('HOME', home.status, home.body.length);
const api = await get(`${alias}/api/generate`);
console.log('API_GET', api.status);
const cvBuilder = await get(`${alias}/cv-builder`);
console.log('CV_BUILDER', cvBuilder.status, cvBuilder.body.length);

for (const b of ['internalDiagnostics', 'INTERNAL_AI_TEST_RESET', 'ai-internal-reset']) {
  const hit = home.body.includes(b) || cvBuilder.body.includes(b);
  console.log(hit ? `HTML_HAS ${b}` : `HTML_OK_no ${b}`);
}

const urls = [
  ...home.body.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g),
  ...cvBuilder.body.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g),
].map((m) => m[0]);
console.log('JS_CHUNKS', new Set(urls).size);
const found = Object.fromEntries(markers.map((m) => [m, false]));
for (const u of new Set(urls)) {
  const r = await get(`${alias}${u}`);
  for (const m of markers) {
    if (r.body.includes(m)) found[m] = true;
  }
}
for (const [k, v] of Object.entries(found)) {
  console.log(v ? 'FOUND' : 'MISS', k);
}
