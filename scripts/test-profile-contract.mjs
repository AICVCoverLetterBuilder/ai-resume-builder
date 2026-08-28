export const TEST_PROFILE_NORMAL = 'normal';
export const TEST_PROFILE_INTERNAL_SUMMARY_V2 = 'internal-summary-v2';
export const TEST_PROFILE_MAX_WORKERS = 4;

export const INTERNAL_SUMMARY_V2_TEST_FILES = Object.freeze([
  'src/lib/__tests__/test-profile-contract.test.ts',
  'src/lib/__tests__/cv-summary-v2-architecture.test.ts',
  'src/lib/__tests__/cv-summary-v2-enhance-noop-finalization.test.ts',
  'src/lib/__tests__/cv-summary-v2-preapply-diagnostic-snapshot.test.ts',
  'src/lib/__tests__/cv-summary-v2-tense-idempotence.test.ts',
  'src/lib/__tests__/cv-build380-german-summary-v2-preapply-completeness.test.ts',
  'src/lib/__tests__/cv-build381-german-summary-v2-visible-postwrite.test.ts',
  'src/lib/__tests__/cv-build382-german-summary-v2-first-person-surface.test.ts',
  'src/lib/__tests__/cv-build383-german-summary-v2-surface-finalizer.test.ts',
  'src/lib/__tests__/cv-build384-german-summary-v2-rewrite-style.test.ts',
  'src/lib/__tests__/cv-build385-universal-summary-v2-four-button.test.ts',
  'src/lib/__tests__/cv-build386-sr-hr-coordinated-predicates.test.ts',
  'src/lib/__tests__/cv-build387-summary-sequential-transactional-apply.test.ts',
  'src/lib/__tests__/cv-build388-stronger-duty-native-surface.test.ts',
  'src/lib/__tests__/cv-build389-native-realization-contract.test.ts',
  'src/lib/__tests__/cv-build389-permanent-diagnostics-contract.test.ts',
  'src/lib/__tests__/cv-build389-permanent-experience-matrix.test.ts',
  'src/lib/__tests__/cv-build389-permanent-gender-person-tense.test.ts',
  'src/lib/__tests__/cv-build389-permanent-idempotence.test.ts',
  'src/lib/__tests__/cv-build389-permanent-native-surface.test.ts',
  'src/lib/__tests__/cv-build389-permanent-negative-controls.test.ts',
  'src/lib/__tests__/cv-build389-permanent-sequential-apply.test.ts',
  'src/lib/__tests__/cv-build389-permanent-summary-matrix.test.ts',
  'src/lib/__tests__/cv-build390-cross-locale-fail-closed.test.ts',
  'src/lib/__tests__/cv-build390-cross-locale-ship-matrix.test.ts',
  'src/lib/__tests__/cv-build390-mixed-sequential-ship-gates.test.ts',
  'src/lib/__tests__/cv-build395-spanish-shorter-duration-native-surface.test.ts',
]);

export function resolveTestProfile(profileName) {
  if (profileName === TEST_PROFILE_NORMAL) {
    return {
      id: TEST_PROFILE_NORMAL,
      summaryV2Enabled: false,
      maxWorkers: TEST_PROFILE_MAX_WORKERS,
      files: null,
      scope: 'normal release suite (legacy-compatible runtime)',
    };
  }
  if (profileName === TEST_PROFILE_INTERNAL_SUMMARY_V2 || profileName === 'summary-v2') {
    return {
      id: TEST_PROFILE_INTERNAL_SUMMARY_V2,
      summaryV2Enabled: true,
      maxWorkers: TEST_PROFILE_MAX_WORKERS,
      files: [...INTERNAL_SUMMARY_V2_TEST_FILES],
      scope: 'intentional Internal Summary V2 contract files only',
    };
  }
  throw new Error(`Unknown test profile: ${profileName || '(missing)'}`);
}

export function buildTestProfileEnvironment(profileName, parentEnvironment = {}) {
  const profile = resolveTestProfile(profileName);
  return {
    ...parentEnvironment,
    CVPRO_TEST_PROFILE: profile.id,
    // Deliberately overwrite, rather than inherit, a global shell toggle.
    NEXT_PUBLIC_ENABLE_SUMMARY_V2: profile.summaryV2Enabled ? 'true' : 'false',
  };
}

export function formatTestProfileIdentity(profileName) {
  const profile = resolveTestProfile(profileName);
  return [
    `TEST_PROFILE=${profile.id}`,
    `SUMMARY_V2=${profile.summaryV2Enabled ? 'enabled' : 'disabled'}`,
    `SCOPE=${profile.scope}`,
    `FILES=${profile.files ? profile.files.length : 'normal-discovery'}`,
    `MAX_WORKERS=${profile.maxWorkers}`,
  ].join(' ');
}
