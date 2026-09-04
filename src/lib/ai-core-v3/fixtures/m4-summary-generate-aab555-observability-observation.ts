/**
 * Non-PII observation retained from the single AAB 555 M4 device attempt.
 * It documents diagnostic truth only; it is not a request fixture and cannot
 * be used to reproduce or authorize another device action.
 */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export const M4_SUMMARY_GENERATE_AAB555_OBSERVABILITY_OBSERVATION = deepFreeze({
  app: Object.freeze({ versionCode: 555, versionName: '1.0.555', internal: true }),
  sourceCommitShort: 'b62f4df',
  capturedAt: '2026-09-03T15:03:45.216Z',
  operation: 'summary_v3_generate',
  requestedLocale: 'de',
  input: Object.freeze({ summaryWasEmpty: true, resolvedCurrentRoleCount: 1, authoritativeFactCount: 3 }),
  candidate: Object.freeze({ hash: 'v3s-dde1f1a2', length: 342, unitCount: 2, proseRetained: false }),
  physicalCoreResult: 'PASS',
  usage: Object.freeze({ before: 0, after: 1, delta: 1 }),
  m4Phases: Object.freeze({ structural: 'passed', semantic: 'passed', languageQuality: 'passed' }),
  commit: Object.freeze({ applied: true, persisted: true, canonical: true, invariant: true, completeness: true, privacy: true }),
  routing: Object.freeze({
    packageResolverClassification: 'preview',
    observedDiagnosticApiHostClass: 'production',
    packageEvidenceClaimedCorrectedPreview: true,
  }),
  legacyV2FieldsWereVisibleAsFalse: true,
  personalDataRetained: false,
} as const);
