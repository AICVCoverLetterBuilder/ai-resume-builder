import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const baselinePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : 'C:/Users/Q/Desktop/cvpro-current-patched-failures.json';
const outputDirectory = path.join(repositoryRoot, '.artifacts', 'consolidation-pass');
const finalFullRunPath = path.join(outputDirectory, 'normal-full-final.json');

const report = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const failures = [];

function assertionIdentity(suite, assertion) {
  const absoluteTestFile = path.normalize(suite.name);
  const relativeTestFile = path.relative(repositoryRoot, absoluteTestFile).replaceAll('\\', '/');
  const exactTestName = [...(assertion.ancestorTitles ?? []), assertion.title]
    .filter(Boolean)
    .join(' > ');
  return `${relativeTestFile}::${exactTestName}`;
}

const finalFullFailureIdentities = new Set();
if (fs.existsSync(finalFullRunPath)) {
  const finalFullRun = JSON.parse(fs.readFileSync(finalFullRunPath, 'utf8'));
  for (const suite of finalFullRun.testResults ?? []) {
    for (const assertion of suite.assertionResults ?? []) {
      if (assertion.status === 'failed') {
        finalFullFailureIdentities.add(assertionIdentity(suite, assertion));
      }
    }
  }
}

for (const suite of report.testResults ?? []) {
  for (const assertion of suite.assertionResults ?? []) {
    if (assertion.status !== 'failed') continue;
    failures.push({
      suite,
      assertion,
    });
  }
}

if (failures.length !== 37) {
  throw new Error(`Expected exactly 37 failed assertions; found ${failures.length}.`);
}

function metadataFor(index) {
  if (index === 1) {
    return {
      featureLayer: 'tooling',
      runtimePath: 'Vitest full-suite scheduling -> internal reset policy -> diagnostics modal loading state',
      classification: 'C. FLAKE_OR_TEST_ENVIRONMENT',
      evidence: 'The combined policy/UI test exceeded the full-suite timeout under load but passed in serial triage; the reset policy and loading lifecycle are deterministic when isolated.',
      plannedAction: 'Split policy from UI loading coverage and use a static component-level contract so the test does not depend on full-suite scheduling latency.',
      productionCodeChangeRequired: false,
    };
  }
  if (index >= 2 && index <= 18) {
    return {
      featureLayer: 'Experience',
      runtimePath: 'entry-owned authority snapshot -> source fact/predicate extraction -> localized provider/fallback candidate -> canonical Experience finalizer -> validators -> visible apply/usage/diagnostics',
      classification: 'A. REAL_RUNTIME_DEFECT',
      evidence: 'The assertion exercises runtime candidate selection and failed consistently in focused reproduction. The shared pipeline lost or misclassified source predicates, tense, locale, relevance, or arbitrary-title facts before canonical apply.',
      plannedAction: 'Repair shared Experience authority, generic fact/predicate grounding, localized fallback, morphology, and canonical finalization; prove arbitrary titles, unknown domains, repeated locale cycles, and entry isolation.',
      productionCodeChangeRequired: true,
    };
  }
  if (index >= 19 && index <= 31) {
    return {
      featureLayer: 'Legacy Summary',
      runtimePath: 'entry-owned CV facts -> localized deterministic Summary builder -> duration/grounding/locale validators -> activation/finalization -> transactional visible apply',
      classification: 'A. REAL_RUNTIME_DEFECT',
      evidence: 'The assertion calls the public Summary localization/finalization path and exposed reproducible cross-locale title, duty, duration, or grounding loss; it is not an Internal Summary V2 profile mismatch.',
      plannedAction: 'Repair shared localized Summary fact extraction, title resolution, duty coverage, language morphology, and fallback grounding while retaining transaction-owned visible state.',
      productionCodeChangeRequired: true,
    };
  }
  if (index === 32) {
    return {
      featureLayer: 'Legacy Summary',
      runtimePath: 'cv-builder Generate Summary orchestration -> transactional Summary apply',
      classification: 'B. STALE_OR_IMPLEMENTATION_DETAIL_TEST',
      evidence: 'The failure searched page.tsx for an obsolete call expression even though locale capture and transaction-owned apply behavior are exposed through shared runtime contracts.',
      plannedAction: 'Replace the source-shape regex with behavioral assertions for one captured request locale and transaction-owned visible apply.',
      productionCodeChangeRequired: false,
    };
  }
  if (index === 33) {
    return {
      featureLayer: 'Legacy Summary',
      runtimePath: 'Package-1 Summary generate -> finalize -> apply -> persisted CV contract',
      classification: 'D. BRITTLE_LEXICAL_ASSERTION',
      evidence: 'The output retained the grounded role and employment facts; only the optional English adjective “professional” was absent.',
      plannedAction: 'Assert role/fact identity, grounded meaning, locale, and unsupported-claim absence instead of one stylistic adjective.',
      productionCodeChangeRequired: false,
    };
  }
  if (index >= 34 && index <= 36) {
    return {
      featureLayer: 'Legacy Summary',
      runtimePath: 'entry-owned CV facts -> localized deterministic Summary builder -> duration/grounding/locale validators -> activation/finalization -> transactional visible apply',
      classification: 'A. REAL_RUNTIME_DEFECT',
      evidence: 'Independent material-duty validation showed that localized duty/role facts were missing or rejected in the real Summary finalization path; exact wording was not the only failing invariant.',
      plannedAction: 'Repair shared localized duty coverage and morphology, then express lexical alternatives semantically while retaining independent fact-coverage validation.',
      productionCodeChangeRequired: true,
    };
  }
  if (index === 37) {
    return {
      featureLayer: 'export',
      runtimePath: 'Elegant Formal app export -> shared locale-safe CV preparation -> renderer/export projection',
      classification: 'B. STALE_OR_IMPLEMENTATION_DETAIL_TEST',
      evidence: 'The test searched for an old local variable declaration after export preparation moved behind the shared prepareFinalLocaleSafeCv contract; behavior-level export coverage remained applicable.',
      plannedAction: 'Assert routing through the shared locale-safe preparation/export behavior rather than the obsolete source text.',
      productionCodeChangeRequired: false,
    };
  }
  throw new Error(`No classification metadata for failure ${index}.`);
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/gu, '');
}

const rows = failures.map(({ suite, assertion }, zeroBasedIndex) => {
  const index = zeroBasedIndex + 1;
  const absoluteTestFile = path.normalize(suite.name);
  const relativeTestFile = path.relative(repositoryRoot, absoluteTestFile).replaceAll('\\', '/');
  const exactTestName = [...(assertion.ancestorTitles ?? []), assertion.title]
    .filter(Boolean)
    .join(' > ');
  const resolved = !finalFullFailureIdentities.has(`${relativeTestFile}::${exactTestName}`);
  return {
    id: index,
    testFile: relativeTestFile,
    testFileAbsolute: absoluteTestFile,
    exactTestName,
    currentFailureReason: (assertion.failureMessages ?? []).join('\n\n'),
    ...metadataFor(index),
    resolved,
    resolutionEvidence: resolved
      ? '.artifacts/consolidation-pass/normal-full-final.json (final normal full run)'
      : '.artifacts/consolidation-pass/normal-full-final.json (identity still failed in the final normal full run; the later focused replay is not closure evidence)',
  };
});

const categoryOrder = [
  'A. REAL_RUNTIME_DEFECT',
  'B. STALE_OR_IMPLEMENTATION_DETAIL_TEST',
  'C. FLAKE_OR_TEST_ENVIRONMENT',
  'D. BRITTLE_LEXICAL_ASSERTION',
  'E. CONTRACT_REVIEW_REQUIRED',
];

const counts = Object.fromEntries(categoryOrder.map((category) => [category, {
  before: rows.filter((row) => row.classification === category).length,
  resolved: rows.filter((row) => row.classification === category && row.resolved).length,
  remaining: rows.filter((row) => row.classification === category && !row.resolved).length,
}]));

const jsonOutput = {
  schemaVersion: 1,
  generatedFrom: baselinePath,
  baseline: {
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    total: report.numTotalTests,
    failedAssertionsParsed: rows.length,
    failedFiles: new Set(rows.map((row) => row.testFile)).size,
  },
  counts,
  failures: rows,
};

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(
  path.join(outputDirectory, 'failure-classification.json'),
  `${JSON.stringify(jsonOutput, null, 2)}\n`,
  'utf8',
);

const markdown = [
  '# Normal-profile failure classification',
  '',
  `Source: \`${baselinePath}\``,
  '',
  `Parsed: ${rows.length} failed assertions in ${jsonOutput.baseline.failedFiles} files.`,
  '',
  '| Category | Before | Resolved | Remaining |',
  '|---|---:|---:|---:|',
  ...categoryOrder.map((category) => {
    const count = counts[category];
    return `| ${category} | ${count.before} | ${count.resolved} | ${count.remaining} |`;
  }),
  '',
  ...rows.flatMap((row) => [
    `## ${row.id}. ${row.classification}`,
    '',
    `- Test file: \`${row.testFile}\``,
    `- Exact test: ${row.exactTestName}`,
    `- Feature/layer: ${row.featureLayer}`,
    `- Runtime path: ${row.runtimePath}`,
    `- Failure reason: ${stripAnsi(row.currentFailureReason).replace(/\s+/gu, ' ').trim()}`,
    `- Evidence: ${row.evidence}`,
    `- Planned action: ${row.plannedAction}`,
    `- Production-code change required: ${row.productionCodeChangeRequired ? 'yes' : 'no'}`,
    `- Resolved: ${row.resolved ? 'yes' : 'no'}`,
    `- Resolution evidence: \`${row.resolutionEvidence}\``,
    '',
  ]),
];

fs.writeFileSync(
  path.join(outputDirectory, 'failure-classification.md'),
  `${markdown.join('\n')}\n`,
  'utf8',
);

process.stdout.write(`${JSON.stringify({ rows: rows.length, failedFiles: jsonOutput.baseline.failedFiles, counts })}\n`);
