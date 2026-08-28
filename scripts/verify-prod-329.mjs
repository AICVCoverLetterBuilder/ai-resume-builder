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
  'experience-selected-final-coverage-329-v1',
  'experience-phased-diagnostic-completeness-329-v1',
  'experience-transactional-apply-truth-329-v1',
  'experience-final-visible-predicate-truth-329-v1',
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
  'ad896a7',
];

const home = await get(`${alias}/`);
const api = await get(`${alias}/api/generate`);
const cvBuilder = await get(`${alias}/cv-builder`);
const urls = [
  ...home.body.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g),
  ...cvBuilder.body.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g),
].map((m) => m[0]);
const found = Object.fromEntries(markers.map((m) => [m, false]));
for (const u of new Set(urls)) {
  const r = await get(`${alias}${u}`);
  for (const m of markers) {
    if (r.body.includes(m)) found[m] = true;
  }
}
const htmlHasInternal = /INTERNAL_AI_TEST_RESET|ai-internal-reset|internalDiagnostics/i
  .test(home.body + cvBuilder.body);
console.log(JSON.stringify({
  home: home.status,
  api: api.status,
  cvBuilder: cvBuilder.status,
  htmlHasInternal,
  found,
  all329: markers.slice(0, 4).every((m) => found[m]),
  urls: [...new Set(urls)].length,
}, null, 2));
