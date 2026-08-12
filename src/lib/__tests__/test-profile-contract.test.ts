import { describe, expect, it } from 'vitest';
import { isSummaryV2Enabled } from '@/lib/cv-summary-v2';
import {
  INTERNAL_SUMMARY_V2_TEST_FILES,
  TEST_PROFILE_MAX_WORKERS,
  buildTestProfileEnvironment,
  formatTestProfileIdentity,
  resolveTestProfile,
} from '../../../scripts/test-profile-contract.mjs';

describe('explicit Vitest runtime profiles', () => {
  it('normal profile overwrites an inherited global V2 toggle', () => {
    const env = buildTestProfileEnvironment('normal', {
      NEXT_PUBLIC_ENABLE_SUMMARY_V2: 'true',
      UNRELATED_VALUE: 'preserved',
    }) as Record<string, string>;
    expect(env.NEXT_PUBLIC_ENABLE_SUMMARY_V2).toBe('false');
    expect(env.CVPRO_TEST_PROFILE).toBe('normal');
    expect(env.UNRELATED_VALUE).toBe('preserved');
    expect(resolveTestProfile('normal').maxWorkers).toBe(TEST_PROFILE_MAX_WORKERS);
  });

  it('internal profile enables V2 and contains only an explicit V2-aware allowlist', () => {
    const profile = resolveTestProfile('internal-summary-v2');
    expect(profile.summaryV2Enabled).toBe(true);
    expect(profile.files).toEqual(INTERNAL_SUMMARY_V2_TEST_FILES);
    if (!profile.files) {
      throw new Error('Internal Summary V2 profile must expose its explicit file allowlist.');
    }
    expect(profile.files).not.toContain('src/lib/__tests__/cv-locale-switch-regression.test.ts');
    expect(profile.files).not.toContain('src/lib/__tests__/cv-summary-grounding-e2e.test.ts');
    expect(profile.files.every((file: string) =>
      /(?:summary-v2|test-profile-contract|cv-build38|cv-build390|cv-build395|aab421-material-authority)/u.test(file),
    )).toBe(true);
  });

  it('profile identity is explicit in test output', () => {
    expect(formatTestProfileIdentity('normal')).toContain('TEST_PROFILE=normal');
    expect(formatTestProfileIdentity('normal')).toContain('SUMMARY_V2=disabled');
    expect(formatTestProfileIdentity('normal')).toContain(`MAX_WORKERS=${TEST_PROFILE_MAX_WORKERS}`);
    expect(formatTestProfileIdentity('internal-summary-v2'))
      .toContain('TEST_PROFILE=internal-summary-v2');
    expect(formatTestProfileIdentity('internal-summary-v2')).toContain('SUMMARY_V2=enabled');
  });

  it('the active runner environment agrees with the Summary V2 runtime flag', () => {
    if (process.env.CVPRO_TEST_PROFILE === 'normal') {
      expect(isSummaryV2Enabled()).toBe(false);
    } else if (process.env.CVPRO_TEST_PROFILE === 'internal-summary-v2') {
      expect(isSummaryV2Enabled()).toBe(true);
    }
  });
});
