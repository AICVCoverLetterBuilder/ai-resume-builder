const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const out = process.argv[3] || '.v2delta-out.json';
const dirs = path.join(root, 'src/lib/__tests__');
const names = fs.readdirSync(dirs).filter((n) =>
  /^(cv-build.*-summary|cv-summary|cv-build.*-experience|cv-experience).*\.test\.ts$/.test(n)
);
const files = names.map((n) => path.join('src/lib/__tests__', n).replace(/\\/g, '/'));
const listFile = path.join(root, '.v2delta-filelist.txt');
fs.writeFileSync(listFile, files.join('\n'), 'utf8');
// vitest accepts a directory + filter via --dir; use node to spawn with arg file via env
process.chdir(root);
delete process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
const cmd = `npx vitest run --reporter=json --outputFile=${JSON.stringify(out)} ${files.map((f) => JSON.stringify(f)).join(' ')}`;
// Avoid Windows command-line length: run via vitest programmatic API instead
const { createVitest } = require('vitest/node');

(async () => {
  const vitest = await createVitest('test', {
    watch: false,
    reporters: ['json'],
    outputFile: out,
    include: files,
  });
  await vitest.start();
  await vitest.close();
  const j = JSON.parse(fs.readFileSync(path.resolve(root, out), 'utf8'));
  console.log(out, 'passed', j.numPassedTests, 'failed', j.numFailedTests);
  process.exit(j.numFailedTests ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
