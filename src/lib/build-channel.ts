/**
 * Build-time channel gates for internal testing controls.
 *
 * Internal AI test reset is available only when BOTH are exact:
 * - NEXT_PUBLIC_BUILD_CHANNEL=internal
 * - NEXT_PUBLIC_ENABLE_AI_TEST_RESET=true
 *
 * Missing, Preview/Production defaults, or any other casing/value → disabled.
 * Do not use NODE_ENV: Android release AABs also run in production mode.
 */

function readEnv(name: string): string {
  // Next inlines NEXT_PUBLIC_* at build time; also accept runtime for tests.
  const fromProcess =
    typeof process !== 'undefined' && process.env
      ? process.env[name]
      : undefined;
  return typeof fromProcess === 'string' ? fromProcess : '';
}

/**
 * Single shared gate for the internal AI usage-ledger reset control.
 * Scatter no other environment checks for this feature.
 */
export function isInternalAiResetEnabled(): boolean {
  const channel = readEnv('NEXT_PUBLIC_BUILD_CHANNEL');
  const flag = readEnv('NEXT_PUBLIC_ENABLE_AI_TEST_RESET');
  return channel === 'internal' && flag === 'true';
}

/** Build-time console line (called from next.config). No usage history / PII. */
export function logBuildChannelAiResetStatus(): void {
  if (isInternalAiResetEnabled()) {
    console.log('[build-channel] Internal AI test reset ENABLED');
  } else {
    console.log('[build-channel] Internal AI test reset disabled');
  }
}
