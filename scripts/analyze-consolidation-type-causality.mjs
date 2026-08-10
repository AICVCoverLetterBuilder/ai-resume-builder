import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repositoryRoot = process.cwd();
const outputPath = path.join(
  repositoryRoot,
  '.artifacts',
  'consolidation-pass',
  'type-causality.json',
);

const consolidationTrackedFiles = execFileSync('git', ['diff', '--name-only'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
  .split(/\r?\n/u)
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => ![
    'android/app/build.gradle',
    'src/app/cv-builder/page.tsx',
  ].includes(file));

const preConsolidationOverlay = new Map();
for (const relativeFile of consolidationTrackedFiles) {
  if (!/\.[cm]?[jt]sx?$/u.test(relativeFile)) continue;
  const absoluteFile = path.resolve(repositoryRoot, relativeFile);
  preConsolidationOverlay.set(
    path.normalize(absoluteFile),
    execFileSync('git', ['show', `HEAD:${relativeFile}`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }),
  );
}

const configPath = ts.findConfigFile(repositoryRoot, ts.sys.fileExists, 'tsconfig.json');
if (!configPath) throw new Error('tsconfig.json not found.');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repositoryRoot, {
  incremental: false,
  noEmit: true,
}, configPath);

function collectDiagnostics({ overlay = new Map(), omitFiles = new Set() } = {}) {
  const host = ts.createCompilerHost(parsed.options, true);
  const originalReadFile = host.readFile.bind(host);
  host.readFile = (fileName) => overlay.get(path.normalize(fileName)) ?? originalReadFile(fileName);
  const rootNames = parsed.fileNames.filter((fileName) => !omitFiles.has(path.normalize(fileName)));
  const program = ts.createProgram({ rootNames, options: parsed.options, host });
  return [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
}

function diagnosticRecord(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  const normalizedCausalMessage = message.replace(/\.\.\. \d+ more \.\.\./gu, '... N more ...');
  const file = diagnostic.file
    ? path.relative(repositoryRoot, diagnostic.file.fileName).replaceAll('\\', '/')
    : null;
  let line = null;
  let column = null;
  if (diagnostic.file && diagnostic.start !== undefined) {
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    line = position.line + 1;
    column = position.character + 1;
  }
  return {
    file,
    code: diagnostic.code,
    category: ts.DiagnosticCategory[diagnostic.category],
    line,
    column,
    message,
    // Exclude source position so harmless line movement in edited tests cannot
    // masquerade as a new type failure. Multiplicity is compared separately.
    causalIdentity: `${file ?? '(config)'}|TS${diagnostic.code}|${normalizedCausalMessage}`,
  };
}

function multiset(records) {
  const counts = new Map();
  for (const record of records) {
    counts.set(record.causalIdentity, (counts.get(record.causalIdentity) ?? 0) + 1);
  }
  return counts;
}

function subtract(leftRecords, rightRecords) {
  const remaining = multiset(rightRecords);
  const result = [];
  for (const record of leftRecords) {
    const count = remaining.get(record.causalIdentity) ?? 0;
    if (count > 0) remaining.set(record.causalIdentity, count - 1);
    else result.push(record);
  }
  return result;
}

const newProfileContractTest = path.normalize(path.resolve(
  repositoryRoot,
  'src/lib/__tests__/test-profile-contract.test.ts',
));
const current = collectDiagnostics().map(diagnosticRecord);
const counterfactualPreConsolidation = collectDiagnostics({
  overlay: preConsolidationOverlay,
  omitFiles: new Set([newProfileContractTest]),
}).map(diagnosticRecord);
const introducedByConsolidation = subtract(current, counterfactualPreConsolidation);
const removedByConsolidation = subtract(counterfactualPreConsolidation, current);

const result = {
  schemaVersion: 1,
  comparison: 'Current dirty worktree versus the same dirty worktree with consolidation-tracked TypeScript files overlaid from HEAD',
  assumptions: [
    'Milestone-0 prestate recorded android/app/build.gradle and src/app/cv-builder/page.tsx as the only pre-existing actual tracked diffs; both remain current in both sides.',
    'Untracked and stat-only pre-existing WIP remains current in both sides.',
    'The new profile contract test is omitted from the counterfactual pre-consolidation side.',
  ],
  consolidationTrackedTypeScriptFilesOverlaid: [...preConsolidationOverlay.keys()]
    .map((file) => path.relative(repositoryRoot, file).replaceAll('\\', '/')),
  counts: {
    current: current.length,
    counterfactualPreConsolidation: counterfactualPreConsolidation.length,
    introducedByConsolidation: introducedByConsolidation.length,
    removedByConsolidation: removedByConsolidation.length,
  },
  introducedByConsolidation,
  removedByConsolidation,
  currentDiagnostics: current,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ outputPath, counts: result.counts }, null, 2)}\n`);
