const { createVitest } = require('vitest/node');
const fs = require('fs');
const path = require('path');

const dir = path.join('src', 'lib', '__tests__');
const files = fs.readdirSync(dir)
  .filter((n) => /^(cv-summary-v2|cv-build.*-summary|cv-summary-).*\.test\.ts$/.test(n))
  .map((n) => path.posix.join('src/lib/__tests__', n));
const out = process.argv[2] || '.v2on-385-matrix.json';
console.log('FILES', files.length);

(async () => {
  process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 = 'true';
  const vitest = await createVitest('test', {
    watch: false,
    reporters: ['json'],
    outputFile: out,
    include: files,
  });
  await vitest.start();
  await vitest.close();
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  console.log(
    'V2ON_PASSED', j.numPassedTests,
    'FAILED', j.numFailedTests,
    'TOTAL', j.numTotalTests,
    'SUITES', j.numPassedTestSuites, '/', j.numTotalTestSuites,
  );
  process.exit(j.numFailedTests ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
