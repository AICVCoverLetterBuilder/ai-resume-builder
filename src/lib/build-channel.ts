/**
 * Build-time channel gates for internal testing controls.
 *
 * Source flags (both required at build time):
 * - NEXT_PUBLIC_BUILD_CHANNEL=internal
 * - NEXT_PUBLIC_ENABLE_AI_TEST_RESET=true
 *
 * next.config.ts compiles those into a single inlined public value:
 * - NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED=true|false
 *
 * Client code MUST read that value only via a static literal property access
 * (`process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED`). Dynamic keys such as
 * `process.env[name]` are NOT replaced by Next and evaluate to undefined in
 * Android WebView (no Node process.env).
 */

/** Pure gate used by next.config (and unit tests of source-flag policy). */
export function computeInternalAiResetEnabledFromSourceFlags(
  channel: string | undefined | null,
  enableFlag: string | undefined | null,
): boolean {
  return channel === 'internal' && enableFlag === 'true';
}

/**
 * Compile-time boolean. Next replaces the literal env reference at build time.
 * Do not change this to bracket access, destructuring, or a helper that receives
 * the env var name dynamically.
 */
export const INTERNAL_AI_RESET_ENABLED =
  process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED === 'true';

/** Shared helper — returns the already-compiled boolean only. */
export function isInternalAiResetEnabled(): boolean {
  return INTERNAL_AI_RESET_ENABLED;
}

/**
 * Stable marker only when the compile-time gate is true.
 * Ternary keeps the literal out of disabled production bundles after DCE.
 */
export const INTERNAL_AI_RESET_BUNDLE_MARKER = INTERNAL_AI_RESET_ENABLED
  ? 'CVPRO_INTERNAL_AI_RESET_ENABLED_V1'
  : '';

/** AAB-298 internal diagnostics packaging revision — empty in production DCE. */
export const INTERNAL_AI_DIAGNOSTICS_REVISION = INTERNAL_AI_RESET_ENABLED
  ? 'internal-ai-diagnostics-298-v1'
  : '';
void INTERNAL_AI_DIAGNOSTICS_REVISION;

/** Visible labels — empty when disabled so production assets omit the strings. */
export const INTERNAL_AI_RESET_CHANNEL_LABEL = INTERNAL_AI_RESET_ENABLED
  ? 'Build channel: internal'
  : '';

export const INTERNAL_AI_RESET_STATUS_LABEL = INTERNAL_AI_RESET_ENABLED
  ? 'AI test reset: enabled'
  : '';

/** Experience AI diagnostics markers — empty in production-disabled bundles. */
export const EXPERIENCE_AI_TRACE_BUNDLE_MARKER = INTERNAL_AI_RESET_ENABLED
  ? 'CVPRO_EXPERIENCE_AI_TRACE_V1'
  : '';

export const EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL = INTERNAL_AI_RESET_ENABLED
  ? 'Copy Experience AI diagnostics'
  : '';

export const SUMMARY_AI_TRACE_BUNDLE_MARKER = INTERNAL_AI_RESET_ENABLED
  ? 'CVPRO_SUMMARY_AI_TRACE_V1'
  : '';

export const SUMMARY_AI_COPY_DIAGNOSTICS_LABEL = INTERNAL_AI_RESET_ENABLED
  ? 'Copy Summary AI diagnostics'
  : '';

export const SUMMARY_AI_SECTION_TITLE = INTERNAL_AI_RESET_ENABLED
  ? 'Summary AI diagnostics'
  : '';

export const SUMMARY_AI_COPY_OK = INTERNAL_AI_RESET_ENABLED
  ? 'Summary AI diagnostics copied'
  : '';

export const SUMMARY_AI_COPY_FAIL = INTERNAL_AI_RESET_ENABLED
  ? 'Could not copy Summary AI diagnostics'
  : '';

export const EXPERIENCE_AI_SECTION_TITLE = INTERNAL_AI_RESET_ENABLED
  ? 'Experience AI diagnostics'
  : '';

export const EXPERIENCE_AI_FIELD_FINAL_REASON = INTERNAL_AI_RESET_ENABLED
  ? 'finalTypedFailureReason'
  : '';

export const EXPERIENCE_AI_FIELD_SOURCE_KIND = INTERNAL_AI_RESET_ENABLED
  ? 'selectedSourceKind'
  : '';

export const EXPERIENCE_AI_FIELD_FALLBACK_COVERED = INTERNAL_AI_RESET_ENABLED
  ? 'fallbackCoveredFactCount'
  : '';

export const EXPERIENCE_AI_COPY_OK = INTERNAL_AI_RESET_ENABLED
  ? 'Experience AI diagnostics copied'
  : '';

export const EXPERIENCE_AI_COPY_FAIL = INTERNAL_AI_RESET_ENABLED
  ? 'Could not copy Experience AI diagnostics'
  : '';
