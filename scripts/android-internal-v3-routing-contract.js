#!/usr/bin/env node
/**
 * One fail-closed authority for AI Core V3 routing in internal Android builds.
 *
 * Internal device candidates exercise M5 Summary styles. A caller may omit the
 * flags because this contract owns their build-time value, but it may not
 * explicitly disable or otherwise override them. The asset assertion proves
 * that Next compiled the public flag and that the M5 diagnostic path survived
 * bundling before Capacitor packaging can continue.
 */
const ANDROID_INTERNAL_V3_ROUTING_CONTRACT_REVISION =
  'android-internal-v3-routing-contract-m9-v1';
const AI_CORE_V3_PUBLIC_FLAG = 'NEXT_PUBLIC_AI_CORE_V3_ENABLED';
const AI_CORE_V3_REQUIRED_VALUE = 'true';
const ANDROID_INTERNAL_M5_ASSET_MARKERS = Object.freeze([
  'm5Operation',
  'summary_style',
  'summary_stronger',
  'notApplicableDiagnosticFieldViolations',
]);

class AndroidInternalV3RoutingContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AndroidInternalV3RoutingContractError';
    this.code = code;
  }
}

function normalizedFlag(environment, name) {
  return String(environment[name] || '').trim();
}

function assertMutableEnvironment(environment) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new AndroidInternalV3RoutingContractError(
      'invalid_environment',
      'Android internal V3 routing requires a mutable environment object',
    );
  }
}

function enforceAndroidInternalV3RoutingContract(environment) {
  assertMutableEnvironment(environment);
  const declared = normalizedFlag(environment, AI_CORE_V3_PUBLIC_FLAG);
  if (declared && declared !== AI_CORE_V3_REQUIRED_VALUE) {
    throw new AndroidInternalV3RoutingContractError(
      `invalid_${AI_CORE_V3_PUBLIC_FLAG.toLowerCase()}`,
      `${AI_CORE_V3_PUBLIC_FLAG} must be exactly "true" for an internal Android M5 candidate`,
    );
  }

  environment[AI_CORE_V3_PUBLIC_FLAG] = AI_CORE_V3_REQUIRED_VALUE;
  return Object.freeze({
    revision: ANDROID_INTERNAL_V3_ROUTING_CONTRACT_REVISION,
    publicFlag: AI_CORE_V3_REQUIRED_VALUE,
    summaryStyleOwner: 'm5',
  });
}

function assertAndroidInternalM5Assets(blob) {
  if (typeof blob !== 'string' || !blob) {
    throw new AndroidInternalV3RoutingContractError(
      'empty_asset_blob',
      'Android internal asset verification received no text assets',
    );
  }
  for (const marker of ANDROID_INTERNAL_M5_ASSET_MARKERS) {
    if (!blob.includes(marker)) {
      throw new AndroidInternalV3RoutingContractError(
        'missing_m5_asset_marker',
        `Android internal assets are missing M5 marker "${marker}"`,
      );
    }
  }
  if (new RegExp(`(?:process|runtime)\\.env\\.${AI_CORE_V3_PUBLIC_FLAG}`, 'u').test(blob)) {
    throw new AndroidInternalV3RoutingContractError(
      'unresolved_public_v3_flag',
      `${AI_CORE_V3_PUBLIC_FLAG} remained a runtime lookup in Android internal assets`,
    );
  }
  if (!/(?:["']?NEXT_PUBLIC_AI_CORE_V3_ENABLED["']?)\s*:\s*["']true["']/u.test(blob)) {
    throw new AndroidInternalV3RoutingContractError(
      'm5_route_not_compiled_enabled',
      'Android internal assets do not contain the compiled AI Core V3 enabled route',
    );
  }
  return Object.freeze({
    revision: ANDROID_INTERNAL_V3_ROUTING_CONTRACT_REVISION,
    compiledPublicFlag: true,
    summaryStyleOwner: 'm5',
    markers: ANDROID_INTERNAL_M5_ASSET_MARKERS,
  });
}

module.exports = {
  ANDROID_INTERNAL_V3_ROUTING_CONTRACT_REVISION,
  AI_CORE_V3_PUBLIC_FLAG,
  AI_CORE_V3_REQUIRED_VALUE,
  ANDROID_INTERNAL_M5_ASSET_MARKERS,
  AndroidInternalV3RoutingContractError,
  enforceAndroidInternalV3RoutingContract,
  assertAndroidInternalM5Assets,
};
