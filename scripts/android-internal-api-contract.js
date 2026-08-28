'use strict';

const { isIP } = require('node:net');
const {
  ANDROID_PRODUCTION_API_BASE_URL,
} = require('./android-production-api-contract');

const CV_V3_ANDROID_API_MODE = 'CV_V3_ANDROID_API_MODE';
const ANDROID_INTERNAL_API_CONTRACT_REVISION =
  'android-internal-preview-api-host-contract-v1';

class AndroidInternalApiContractError extends Error {
  constructor(code, message) {
    super(`[android-internal-api-contract:${code}] ${message}`);
    this.name = 'AndroidInternalApiContractError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new AndroidInternalApiContractError(code, message);
}

function isUnsafeLocalHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === 'host.docker.internal'
    || normalized === '10.0.2.2'
    || normalized === '10.0.3.2') return true;

  const ipVersion = isIP(normalized);
  if (ipVersion === 6) {
    return normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb');
  }
  if (ipVersion !== 4) return false;

  const octets = normalized.split('.').map(Number);
  return octets[0] === 0
    || octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function validatePreviewOrigin(value) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('preview_url_required', 'preview mode requires NEXT_PUBLIC_API_BASE_URL');
  }
  if (/[\s\u0000-\u001f\u007f]/u.test(value)) {
    fail('invalid_preview_url', 'preview URL must not contain whitespace or control characters');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail('invalid_preview_url', 'preview URL must be one absolute URL');
  }

  if (parsed.protocol !== 'https:') {
    fail('invalid_preview_protocol', 'preview URL protocol must be https:');
  }
  if (parsed.username || parsed.password) {
    fail('preview_credentials_forbidden', 'preview URL credentials are forbidden');
  }
  if (parsed.search || parsed.hash) {
    fail('preview_suffix_forbidden', 'preview URL query and fragment are forbidden');
  }
  if (parsed.pathname !== '/') {
    fail('preview_path_forbidden', 'preview URL path must be empty or /');
  }
  if (parsed.port) {
    fail('preview_port_forbidden', 'preview URL must not use a nonstandard port');
  }

  const hostname = parsed.hostname.toLowerCase();
  const productionHostname = new URL(ANDROID_PRODUCTION_API_BASE_URL).hostname;
  if (!hostname || hostname.includes('*') || isUnsafeLocalHost(hostname) || isIP(hostname)) {
    fail('unsafe_preview_host', 'preview hostname is local, literal, wildcard, or otherwise unsafe');
  }
  if (!hostname.endsWith('.vercel.app')) {
    fail('invalid_preview_host', 'preview hostname must end with .vercel.app');
  }
  if (hostname === productionHostname) {
    fail('production_host_forbidden_in_preview', 'preview mode must not use the production origin');
  }

  return parsed.origin;
}

function resolveAndroidInternalApiContract(environment) {
  if (!environment || typeof environment !== 'object') {
    fail('invalid_environment', 'an explicit environment object is required');
  }

  const rawMode = environment[CV_V3_ANDROID_API_MODE];
  if (rawMode === undefined || rawMode === null || rawMode === '' || rawMode === 'production') {
    return Object.freeze({
      mode: 'production',
      apiBaseUrl: ANDROID_PRODUCTION_API_BASE_URL,
      hostClass: 'production',
    });
  }
  if (rawMode !== 'preview') {
    fail('invalid_mode', `${CV_V3_ANDROID_API_MODE} must be absent, empty, production, or preview`);
  }

  return Object.freeze({
    mode: 'preview',
    apiBaseUrl: validatePreviewOrigin(environment.NEXT_PUBLIC_API_BASE_URL),
    hostClass: 'vercel_preview',
  });
}

function applyAndroidInternalApiContract(environment) {
  const contract = resolveAndroidInternalApiContract(environment);
  environment.NEXT_PUBLIC_API_BASE_URL = contract.apiBaseUrl;
  return contract;
}

module.exports = {
  CV_V3_ANDROID_API_MODE,
  ANDROID_INTERNAL_API_CONTRACT_REVISION,
  AndroidInternalApiContractError,
  resolveAndroidInternalApiContract,
  applyAndroidInternalApiContract,
};
