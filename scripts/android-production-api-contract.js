'use strict';

const apiHostClassificationContract = require('../src/lib/ai-api-host-classification-contract.json');

function requireHttpsOrigin(value, key) {
  if (typeof value !== 'string') throw new Error(`API host contract ${key} must be a string`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`API host contract ${key} must be a valid HTTPS origin`);
  }
  if (parsed.protocol !== 'https:' || value !== parsed.origin) {
    throw new Error(`API host contract ${key} must be a canonical HTTPS origin`);
  }
  return parsed.origin;
}

function requirePreviewDeploymentHostSuffixes(value) {
  const key = 'previewDeploymentHostSuffixes';
  if (!Array.isArray(value)) throw new Error(`API host contract ${key} must be an array`);
  if (value.length === 0) throw new Error(`API host contract ${key} must not be empty`);
  const seen = new Set();
  const suffixes = value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new Error(`API host contract ${key}[${index}] must be a non-empty string`);
    }
    if (entry !== entry.toLowerCase()) {
      throw new Error(`API host contract ${key}[${index}] must be lowercase`);
    }
    if (entry === 'vercel.app' || entry === '.vercel.app') {
      throw new Error(`API host contract ${key}[${index}] is too broad`);
    }
    if (!/^-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.vercel\.app$/u.test(entry)) {
      throw new Error(`API host contract ${key}[${index}] must be a lowercase Vercel hostname suffix beginning with -`);
    }
    if (seen.has(entry)) throw new Error(`API host contract ${key} must not contain duplicates`);
    seen.add(entry);
    return entry;
  });
  return Object.freeze(suffixes);
}

function readAndroidProductionApiHostContract(candidate = apiHostClassificationContract) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('API host contract must be an object');
  }
  const revision = String(candidate.revision || '').trim();
  if (!revision) throw new Error('API host contract revision is required');
  const publicProductionApiOrigin = requireHttpsOrigin(
    candidate.publicProductionApiOrigin,
    'publicProductionApiOrigin',
  );
  const protectedProjectApiOrigin = requireHttpsOrigin(
    candidate.protectedProjectApiOrigin,
    'protectedProjectApiOrigin',
  );
  if (publicProductionApiOrigin === protectedProjectApiOrigin) {
    throw new Error('API host contract public and protected origins must differ');
  }
  const previewDeploymentHostSuffixes = requirePreviewDeploymentHostSuffixes(
    candidate.previewDeploymentHostSuffixes,
  );
  return Object.freeze({
    revision,
    publicProductionApiOrigin,
    protectedProjectApiOrigin,
    previewDeploymentHostSuffixes,
  });
}

const namedApiHostContract = readAndroidProductionApiHostContract();
const ANDROID_PRODUCTION_API_BASE_URL = namedApiHostContract.publicProductionApiOrigin;
const PROTECTED_ANDROID_API_BASE_URL = namedApiHostContract.protectedProjectApiOrigin;
const ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION = namedApiHostContract.revision;

function enforceAndroidProductionApiBaseUrl(env = process.env) {
  env.NEXT_PUBLIC_API_BASE_URL = ANDROID_PRODUCTION_API_BASE_URL;
  return ANDROID_PRODUCTION_API_BASE_URL;
}

module.exports = {
  ANDROID_PRODUCTION_API_BASE_URL,
  PROTECTED_ANDROID_API_BASE_URL,
  ANDROID_PRODUCTION_API_HOST_CONTRACT_REVISION,
  readAndroidProductionApiHostContract,
  enforceAndroidProductionApiBaseUrl,
};
