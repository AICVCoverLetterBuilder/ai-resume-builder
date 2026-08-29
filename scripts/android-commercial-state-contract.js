#!/usr/bin/env node
/*
 * Commercial release invariants for every internal Android package.
 * This file deliberately contains fingerprints and public identifiers only.
 * It must never receive, write, or log the raw RevenueCat public key.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const COMMERCIAL_STATE = Object.freeze({
  revenueCatAndroidKeyFingerprint: '2AD4F583E994A26C',
  applicationId: 'com.cvproai.app',
  entitlementId: 'CV Pro AI Pro',
  productId: 'cv_pro_lifetime',
  offeringId: 'default',
  packageId: '$rc_lifetime',
  revenueCatPlugin: '@revenuecat/purchases-capacitor',
  // This is the exact wrapper version resolved by the committed lockfile used
  // throughout the verified AAB-427 release lineage. package.json intentionally
  // retains its compatible declaration range below.
  revenueCatPluginDeclaration: '^13.1.1',
  revenueCatPluginVersion: '13.1.7',
  revenueCatNativeDependency: 'com.revenuecat.purchases:purchases-hybrid-common:18.14.1',
  releaseSigningCertificateFingerprint: 'D9B3428B6A5EA8244BEC6EB53109140B57920247F64F8C033A28261504DEF023',
  apiHost: 'https://ai-resume-builder-six-gamma.vercel.app',
});

class AndroidCommercialStateContractError extends Error {
  constructor(label, expected, actual) {
    super(`COMMERCIAL_STATE_MISMATCH ${label} expected=${expected} actual=${actual || 'missing'}`);
    this.name = 'AndroidCommercialStateContractError';
    this.code = 'commercial_state_mismatch';
    this.label = label;
  }
}

const approvedCommercialStates = new WeakSet([COMMERCIAL_STATE]);

function commercialMismatch(label, expected, actual) {
  throw new AndroidCommercialStateContractError(label, expected, actual);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function resolveExpectedAndroidCommercialState(apiContract) {
  if (!apiContract || typeof apiContract !== 'object' || Array.isArray(apiContract)) {
    commercialMismatch('apiContract', 'resolved_object', typeof apiContract);
  }
  if (!Object.isFrozen(apiContract)) {
    commercialMismatch('apiContract.mutability', 'frozen_resolved_contract', 'mutable');
  }
  const keys = Object.keys(apiContract).sort();
  const expectedKeys = ['apiBaseUrl', 'hostClass', 'mode'];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    commercialMismatch('apiContract.shape', expectedKeys.join(','), keys.join(','));
  }

  const { mode, apiBaseUrl, hostClass } = apiContract;
  if (mode === 'production') {
    if (hostClass !== 'production') {
      commercialMismatch('apiContract.hostClass', 'production', hostClass);
    }
    if (apiBaseUrl !== COMMERCIAL_STATE.apiHost) {
      commercialMismatch('apiContract.apiBaseUrl', COMMERCIAL_STATE.apiHost, apiBaseUrl);
    }
    return COMMERCIAL_STATE;
  }
  if (mode !== 'preview') {
    commercialMismatch('apiContract.mode', 'production|preview', mode);
  }
  if (hostClass !== 'vercel_preview') {
    commercialMismatch('apiContract.hostClass', 'vercel_preview', hostClass);
  }
  if (typeof apiBaseUrl !== 'string' || !apiBaseUrl) {
    commercialMismatch('apiContract.apiBaseUrl', 'canonical_https_vercel_preview_origin', apiBaseUrl);
  }

  let parsed;
  try {
    parsed = new URL(apiBaseUrl);
  } catch {
    commercialMismatch('apiContract.apiBaseUrl', 'canonical_https_vercel_preview_origin', apiBaseUrl);
  }
  if (parsed.protocol !== 'https:'
    || parsed.origin !== apiBaseUrl
    || !parsed.hostname.endsWith('.vercel.app')
    || apiBaseUrl === COMMERCIAL_STATE.apiHost) {
    commercialMismatch('apiContract.apiBaseUrl', 'canonical_https_vercel_preview_origin', apiBaseUrl);
  }

  const expectedState = deepFreeze({ ...COMMERCIAL_STATE, apiHost: apiBaseUrl });
  approvedCommercialStates.add(expectedState);
  return expectedState;
}

function requireApprovedCommercialState(expectedState) {
  if (!expectedState || typeof expectedState !== 'object' || !approvedCommercialStates.has(expectedState)) {
    commercialMismatch('expectedState', 'approved_commercial_projection', 'unapproved');
  }
  return expectedState;
}

const AUTHORITATIVE_KEY_ENV = 'CVPRO_ANDROID_REVENUECAT_PUBLIC_KEY';
const PUBLIC_KEY_ENV = 'NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY';

function safeFingerprint(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'missing';
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').toUpperCase().slice(0, 16);
}

function mismatch(actual) {
  const error = new Error(
    `REVENUECAT_ANDROID_KEY_MISMATCH expected=${COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint} actual=${actual}`,
  );
  error.code = 'REVENUECAT_ANDROID_KEY_MISMATCH';
  throw error;
}

function resolveAndroidRevenueCatKey(env) {
  const authoritativeKey = String(env[AUTHORITATIVE_KEY_ENV] || '').trim();
  const inheritedPublicKey = String(env[PUBLIC_KEY_ENV] || '').trim();

  if (!authoritativeKey || !authoritativeKey.startsWith('goog_')) {
    mismatch(safeFingerprint(authoritativeKey));
  }
  const authoritativeFingerprint = safeFingerprint(authoritativeKey);
  if (authoritativeFingerprint !== COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint) {
    mismatch(authoritativeFingerprint);
  }
  // A public build-time value may be supplied only when it is exactly the
  // approved source. Any stale inherited value fails closed before Next runs.
  if (inheritedPublicKey && inheritedPublicKey !== authoritativeKey) {
    mismatch(safeFingerprint(inheritedPublicKey));
  }
  return { key: authoritativeKey, fingerprint: authoritativeFingerprint };
}

function establishAndroidPackagingEnvironment(env) {
  const resolved = resolveAndroidRevenueCatKey(env);
  env[PUBLIC_KEY_ENV] = resolved.key;
  return { fingerprint: resolved.fingerprint };
}

function requireExact(value, expected, label) {
  if (value !== expected) {
    commercialMismatch(label, expected, value);
  }
}

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function validateCheckedInCommercialState(root) {
  const gradle = readText(root, 'android/app/build.gradle');
  const runtime = readText(root, 'src/lib/iap.ts');
  const capacitor = JSON.parse(readText(root, 'capacitor.config.json'));
  const packageJson = JSON.parse(readText(root, 'package.json'));
  const lock = JSON.parse(readText(root, 'package-lock.json'));
  const lockPlugin = lock.packages?.['node_modules/@revenuecat/purchases-capacitor'];
  const pluginVersion = lockPlugin?.version;
  const installedPackagePath = path.join(root, 'node_modules', '@revenuecat', 'purchases-capacitor', 'package.json');
  const installedPluginVersion = fs.existsSync(installedPackagePath)
    ? JSON.parse(fs.readFileSync(installedPackagePath, 'utf8')).version
    : 'missing';
  const generatedPluginGradle = readText(root, 'node_modules/@revenuecat/purchases-capacitor/android/build.gradle');

  requireExact((gradle.match(/applicationId\s+"([^"]+)"/) || [])[1], COMMERCIAL_STATE.applicationId, 'applicationId');
  requireExact((runtime.match(/PRO_ENTITLEMENT\s*=\s*'([^']+)'/) || [])[1], COMMERCIAL_STATE.entitlementId, 'entitlementId');
  requireExact((runtime.match(/PRO_PRODUCT_ID\s*=\s*'([^']+)'/) || [])[1], COMMERCIAL_STATE.productId, 'productId');
  requireExact((runtime.match(/PACKAGE_IDENTIFIER\s*=\s*'([^']+)'/) || [])[1], COMMERCIAL_STATE.packageId, 'packageId');
  requireExact((runtime.match(/OFFERING_IDENTIFIER\s*=\s*'([^']+)'/) || [])[1], COMMERCIAL_STATE.offeringId, 'offeringId');
  requireExact(packageJson.dependencies?.[COMMERCIAL_STATE.revenueCatPlugin], COMMERCIAL_STATE.revenueCatPluginDeclaration, 'revenueCatPluginDeclaration');
  requireExact(pluginVersion, COMMERCIAL_STATE.revenueCatPluginVersion, 'revenueCatPluginLockVersion');
  requireExact(installedPluginVersion, COMMERCIAL_STATE.revenueCatPluginVersion, 'revenueCatPluginInstalledVersion');
  requireExact(lockPlugin?.dependencies?.['@revenuecat/purchases-typescript-internal-esm'], '18.14.1', 'revenueCatPluginLockNativeVersion');
  if (!generatedPluginGradle.includes(COMMERCIAL_STATE.revenueCatNativeDependency)) {
    throw new Error(`COMMERCIAL_STATE_MISMATCH revenueCatGeneratedAndroidDependency expected=${COMMERCIAL_STATE.revenueCatNativeDependency} actual=missing`);
  }
  if (capacitor.server?.url) {
    throw new Error('COMMERCIAL_STATE_MISMATCH capacitor.server.url expected=absent actual=set');
  }
}

function buildManifest({ apiHost, signingCertificateFingerprint, keyFingerprint }, expectedState = COMMERCIAL_STATE) {
  const expected = requireApprovedCommercialState(expectedState);
  const expectedSigningFingerprint = signingCertificateFingerprint === undefined
    ? expected.releaseSigningCertificateFingerprint
    : signingCertificateFingerprint;
  requireExact(apiHost, expected.apiHost, 'apiHost');
  requireExact(expectedSigningFingerprint, expected.releaseSigningCertificateFingerprint, 'releaseSigningCertificateFingerprint');
  requireExact(keyFingerprint, expected.revenueCatAndroidKeyFingerprint, 'revenueCatAndroidKeyFingerprint');
  return {
    schemaVersion: 1,
    revenueCatAndroidKey: { present: true, prefix: 'goog_', fingerprint: keyFingerprint },
    applicationId: expected.applicationId,
    entitlementId: expected.entitlementId,
    productId: expected.productId,
    offeringId: expected.offeringId,
    packageId: expected.packageId,
    revenueCatPlugin: `${expected.revenueCatPlugin}@${expected.revenueCatPluginVersion}`,
    revenueCatNativeDependency: expected.revenueCatNativeDependency,
    releaseSigningCertificateFingerprint: expectedSigningFingerprint,
    apiHost,
    capacitorServerUrl: null,
  };
}

function writeManifest(outputDirectory, manifest) {
  fs.writeFileSync(path.join(outputDirectory, 'android-commercial-state.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

function assertManifest(manifest, expectedState = COMMERCIAL_STATE) {
  const expected = requireApprovedCommercialState(expectedState);
  requireExact(manifest?.revenueCatAndroidKey?.fingerprint, expected.revenueCatAndroidKeyFingerprint, 'manifest.revenueCatAndroidKeyFingerprint');
  requireExact(manifest?.revenueCatAndroidKey?.prefix, 'goog_', 'manifest.revenueCatAndroidKeyPrefix');
  requireExact(manifest?.applicationId, expected.applicationId, 'manifest.applicationId');
  requireExact(manifest?.entitlementId, expected.entitlementId, 'manifest.entitlementId');
  requireExact(manifest?.productId, expected.productId, 'manifest.productId');
  requireExact(manifest?.offeringId, expected.offeringId, 'manifest.offeringId');
  requireExact(manifest?.packageId, expected.packageId, 'manifest.packageId');
  requireExact(manifest?.revenueCatPlugin, `${expected.revenueCatPlugin}@${expected.revenueCatPluginVersion}`, 'manifest.revenueCatPlugin');
  requireExact(manifest?.revenueCatNativeDependency, expected.revenueCatNativeDependency, 'manifest.revenueCatNativeDependency');
  requireExact(manifest?.releaseSigningCertificateFingerprint, expected.releaseSigningCertificateFingerprint, 'manifest.releaseSigningCertificateFingerprint');
  requireExact(manifest?.apiHost, expected.apiHost, 'manifest.apiHost');
  if (manifest?.capacitorServerUrl !== null) {
    commercialMismatch('manifest.capacitorServerUrl', 'absent', manifest?.capacitorServerUrl);
  }
}

module.exports = {
  AUTHORITATIVE_KEY_ENV,
  PUBLIC_KEY_ENV,
  COMMERCIAL_STATE,
  AndroidCommercialStateContractError,
  resolveExpectedAndroidCommercialState,
  safeFingerprint,
  resolveAndroidRevenueCatKey,
  establishAndroidPackagingEnvironment,
  validateCheckedInCommercialState,
  buildManifest,
  writeManifest,
  assertManifest,
};
