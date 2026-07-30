/**
 * Summary V2 — internal feature flag.
 * Default OFF: legacy Summary engine remains the production path.
 * Enable via NEXT_PUBLIC_ENABLE_SUMMARY_V2=true or setSummaryV2EnabledForTests.
 */
export const SUMMARY_V2_REVISION = 'summary-v2-architecture-371-v1' as const;

let testOverride: boolean | null = null;

export function isSummaryV2Enabled(): boolean {
  if (testOverride !== null) return testOverride;
  return process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 === 'true';
}

/** Test-only override. Pass null to restore env/default. */
export function setSummaryV2EnabledForTests(enabled: boolean | null): void {
  testOverride = enabled;
}

export function summaryV2BundleMarker(): string {
  return isSummaryV2Enabled() ? SUMMARY_V2_REVISION : '';
}
