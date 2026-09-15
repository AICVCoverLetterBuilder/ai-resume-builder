/**
 * Security gates for the internal-test Pro entitlement.
 *
 * The public flag is only a compile-time request capability.  The server-only
 * flag and the deployment channel are the authority that may issue a token.
 */

export const INTERNAL_TEST_PRO_TOKEN_AUDIENCE = 'm8-preview-internal-test';
export const INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY_MAX_LENGTH = 256;

export type InternalTestEntitlementEnv = Record<string, string | undefined>;

/**
 * Reads the per-build bearer capability without persisting or logging it.
 * The value is public client build material, not a production secret.
 */
export function getInternalTestBootstrapCapability(
  env?: InternalTestEntitlementEnv,
): string | null {
  const value = env
    ? env.NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY
    : process.env.NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY;
  if (typeof value !== 'string' || value.length === 0
    || value.trim().length === 0
    || value.length > INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY_MAX_LENGTH) {
    return null;
  }
  return value;
}

export function isInternalTestClientCapabilityEnabled(
  env?: InternalTestEntitlementEnv,
): boolean {
  if (!env) {
    // Keep literal property access so Next statically inlines the client gate.
    return process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal'
      && process.env.NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT === 'true'
      && getInternalTestBootstrapCapability() !== null;
  }
  return env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal'
    && env.NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT === 'true'
    && getInternalTestBootstrapCapability(env) !== null;
}

export function isInternalTestServerCapabilityEnabled(
  env?: InternalTestEntitlementEnv,
): boolean {
  if (!env) {
    return process.env.AI_INTERNAL_TEST_PRO_ENTITLEMENT === 'true'
      && process.env.VERCEL_ENV === 'preview'
      && process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal';
  }
  return env.AI_INTERNAL_TEST_PRO_ENTITLEMENT === 'true'
    && env.VERCEL_ENV === 'preview'
    && env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal';
}

/** Runtime authority used by the server verifier and internal token issuer. */
export function isInternalTestTokenRuntimeAllowed(
  env?: InternalTestEntitlementEnv,
): boolean {
  return isInternalTestServerCapabilityEnabled(env);
}
