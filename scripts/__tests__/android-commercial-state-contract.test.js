const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const contract = require('../android-commercial-state-contract');

function withFingerprintStub(fingerprint, fn) {
  const original = crypto.createHash;
  crypto.createHash = () => ({ update: () => ({ digest: () => fingerprint }) });
  try { fn(); } finally { crypto.createHash = original; }
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

test('server.url state change fails', () => {
  const manifest = contract.buildManifest({ apiHost: contract.COMMERCIAL_STATE.apiHost, keyFingerprint: contract.COMMERCIAL_STATE.revenueCatAndroidKeyFingerprint });
  manifest.capacitorServerUrl = 'https://unexpected.example';
  assert.throws(() => contract.assertManifest(manifest), /COMMERCIAL_STATE_MISMATCH/);
});
