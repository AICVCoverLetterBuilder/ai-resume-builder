const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const contract = require('../android-commercial-state-contract');

function withFingerprintStub(fingerprint, fn) {
  const original = crypto.createHash;
  crypto.createHash = () => ({ update: () => ({ digest: () => fingerprint }) });
  try { fn(); } finally { crypto.createHash = original; }
}

function makeCommercialStateRoot({ declaration = '^13.1.1', lockVersion = '13.1.7', installedVersion = '13.1.7', nativeDependency = contract.COMMERCIAL_STATE.revenueCatNativeDependency } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commercial-lock-'));
  fs.mkdirSync(path.join(root, 'android', 'app'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', '@revenuecat', 'purchases-capacitor', 'android'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { '@revenuecat/purchases-capacitor': declaration } }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: { 'node_modules/@revenuecat/purchases-capacitor': { version: lockVersion, dependencies: { '@revenuecat/purchases-typescript-internal-esm': '18.14.1' } } } }));
  fs.writeFileSync(path.join(root, 'android', 'app', 'build.gradle'), 'applicationId "com.cvproai.app"');
  fs.writeFileSync(path.join(root, 'src', 'lib', 'iap.ts'), "const PRO_ENTITLEMENT = 'CV Pro AI Pro'; const PRO_PRODUCT_ID = 'cv_pro_lifetime'; const PACKAGE_IDENTIFIER = '$rc_lifetime'; const OFFERING_IDENTIFIER = 'default';");
  fs.writeFileSync(path.join(root, 'capacitor.config.json'), JSON.stringify({ webDir: 'out' }));
  fs.writeFileSync(path.join(root, 'node_modules', '@revenuecat', 'purchases-capacitor', 'package.json'), JSON.stringify({ version: installedVersion }));
  fs.writeFileSync(path.join(root, 'node_modules', '@revenuecat', 'purchases-capacitor', 'android', 'build.gradle'), `implementation '${nativeDependency}'`);
  return root;
}

test('declaration, lockfile, installed module, and generated Android dependency agree', () => {
  const root = makeCommercialStateRoot();
  try { assert.doesNotThrow(() => contract.validateCheckedInCommercialState(root)); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});

for (const [name, options] of [
  ['package declaration disagreement fails', { declaration: '^13.1.0' }],
  ['lockfile disagreement fails', { lockVersion: '13.1.6' }],
  ['installed module disagreement fails', { installedVersion: '13.1.6' }],
  ['generated Android disagreement fails', { nativeDependency: 'com.revenuecat.purchases:purchases-hybrid-common:unexpected' }],
]) {
  test(name, () => {
    const root = makeCommercialStateRoot(options);
    try { assert.throws(() => contract.validateCheckedInCommercialState(root), /COMMERCIAL_STATE_MISMATCH/); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('valid authoritative key fingerprint passes and becomes the public build value', () => {
  withFingerprintStub(contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint, () => {
    const env = { [contract.AUTHORITATIVE_KEY_ENV]: 'goog_valid' };
    const result = contract.establishAndroidPackagingEnvironment(env);
    assert.equal(result.fingerprint, contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint);
    assert.equal(env[contract.PUBLIC_KEY_ENV], 'goog_valid');
  });
});

test('known bad AAB-428 fingerprint 2F5C790F91D7D560 fails', () => {
  withFingerprintStub('2F5C790F91D7D560', () => {
    assert.throws(
      () => contract.establishAndroidPackagingEnvironment({ [contract.AUTHORITATIVE_KEY_ENV]: 'goog_bad_aab_428' }),
      /REVENUECAT_ANDROID_KEY_MISMATCH expected=2AD4F583E994A26C actual=2F5C790F91D7D560/,
    );
  });
});

for (const [name, env] of [
  ['missing key fails', {}],
  ['wrong platform key fails', { [contract.AUTHORITATIVE_KEY_ENV]: 'appl_bad' }],
  ['another goog key with wrong fingerprint fails', { [contract.AUTHORITATIVE_KEY_ENV]: 'goog_other' }],
  ['stale process key overriding authoritative source fails', { [contract.AUTHORITATIVE_KEY_ENV]: 'goog_valid', [contract.PUBLIC_KEY_ENV]: 'goog_stale' }],
]) {
  test(name, () => {
    assert.throws(() => contract.establishAndroidPackagingEnvironment(env), /REVENUECAT_ANDROID_KEY_MISMATCH/);
  });
}

test('Summary-only releases retain the fixed RevenueCat fingerprint', () => {
  const manifest = contract.buildManifest({
    apiHost: contract.COMMERCIAL_STATE.apiHost,
    keyFingerprint: contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint,
  });
  assert.equal(manifest.revenueCatAndroidKey.fingerprint, '2AD4F583E994A26C');
});

test('commercial manifest accepts only all locked values', () => {
  const manifest = contract.buildManifest({ apiHost: contract.COMMERCIAL_STATE.apiHost, keyFingerprint: contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint });
  assert.doesNotThrow(() => contract.assertManifest(manifest));
});

for (const field of ['applicationId', 'entitlementId', 'productId', 'offeringId', 'packageId', 'revenueCatPlugin', 'releaseSigningCertificateFingerprint', 'apiHost']) {
  test(`${field} change fails`, () => {
    const manifest = contract.buildManifest({ apiHost: contract.COMMERCIAL_STATE.apiHost, keyFingerprint: contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint });
    manifest[field] = 'unexpected';
    assert.throws(() => contract.assertManifest(manifest), /COMMERCIAL_STATE_MISMATCH/);
  });
}

test('different packaged native RevenueCat dependency fails', () => {
  const manifest = contract.buildManifest({ apiHost: contract.COMMERCIAL_STATE.apiHost, keyFingerprint: contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint });
  manifest.revenueCatNativeDependency = 'com.revenuecat.purchases:purchases-hybrid-common:unexpected';
  assert.throws(() => contract.assertManifest(manifest), /COMMERCIAL_STATE_MISMATCH/);
});

test('server.url state change fails', () => {
  const manifest = contract.buildManifest({ apiHost: contract.COMMERCIAL_STATE.apiHost, keyFingerprint: contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint });
  manifest.capacitorServerUrl = 'https://unexpected.example';
  assert.throws(() => contract.assertManifest(manifest), /COMMERCIAL_STATE_MISMATCH/);
});
