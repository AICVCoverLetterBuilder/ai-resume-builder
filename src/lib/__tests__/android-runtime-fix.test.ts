/**
 * @vitest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mockCapacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => 'android'),
  isPluginAvailable: vi.fn(() => true),
}));

const savePlugin = vi.hoisted(() => ({
  healthCheck: vi.fn().mockResolvedValue({
    pluginAvailable: true,
    cacheWritable: true,
    pluginVersion: '1.1.0',
  }),
  saveFile: vi.fn(async (options?: { expectedBytes?: number }) => ({
    result: 'saved',
    message: 'OK',
    bytesWritten: options?.expectedBytes ?? 1,
    verifiedSize: options?.expectedBytes ?? 1,
  })),
  getDiagnostics: vi.fn().mockResolvedValue({ events: [] }),
  clearDiagnostics: vi.fn().mockResolvedValue({ cleared: true }),
}));

const appListeners = vi.hoisted(() => ({
  callback: null as null | ((state: { isActive: boolean }) => void),
  remove: vi.fn().mockResolvedValue(undefined),
}));

const mockApp = vi.hoisted(() => ({
  addListener: vi.fn(async (_event: string, callback: (state: { isActive: boolean }) => void) => {
    appListeners.callback = callback;
    return { remove: appListeners.remove };
  }),
  getState: vi.fn().mockResolvedValue({ isActive: true }),
}));

const mockPurchases = vi.hoisted(() => ({
  configure: vi.fn().mockResolvedValue(undefined),
  setLogLevel: vi.fn().mockResolvedValue(undefined),
  setLogHandler: vi.fn().mockResolvedValue(undefined),
  canMakePayments: vi.fn().mockResolvedValue({ canMakePayments: true }),
  getOfferings: vi.fn(),
  purchaseStoreProduct: vi.fn(),
  purchasePackage: vi.fn(),
  getCustomerInfo: vi.fn(),
  restorePurchases: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor,
  registerPlugin: vi.fn(() => savePlugin),
}));

vi.mock('@capacitor/app', () => ({ App: mockApp }));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: mockPurchases,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

function makeOfferings() {
  const pkg = {
    identifier: '$rc_lifetime',
    packageType: 'LIFETIME',
    offeringIdentifier: 'default',
    product: {
      identifier: 'cv_pro_lifetime',
      priceString: '$3.99',
      currencyCode: 'USD',
    },
  };
  const offering = {
    identifier: 'default',
    serverDescription: 'Default',
    availablePackages: [pkg],
  };
  return { current: offering, all: { default: offering } };
}

function makePurchaseResult() {
  return {
    customerInfo: {
      entitlements: {
        active: {
          'CV Pro AI Pro': { productIdentifier: 'cv_pro_lifetime' },
        },
      },
    },
  };
}

describe('Android runtime fixes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_android_key');
    vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'test_ios_key');

    mockCapacitor.isNativePlatform.mockReturnValue(true);
    mockCapacitor.getPlatform.mockReturnValue('android');
    mockCapacitor.isPluginAvailable.mockReturnValue(true);

    savePlugin.healthCheck.mockReset();
    savePlugin.healthCheck.mockResolvedValue({
      pluginAvailable: true,
      cacheWritable: true,
      pluginVersion: '1.1.0',
    });
    savePlugin.saveFile.mockReset();
    savePlugin.saveFile.mockImplementation(async (options?: { expectedBytes?: number }) => ({
      result: 'saved',
      message: 'OK',
      bytesWritten: options?.expectedBytes ?? 1,
      verifiedSize: options?.expectedBytes ?? 1,
    }));
    savePlugin.getDiagnostics.mockReset();
    savePlugin.getDiagnostics.mockResolvedValue({ events: [] });
    savePlugin.clearDiagnostics.mockReset();
    savePlugin.clearDiagnostics.mockResolvedValue({ cleared: true });

    appListeners.callback = null;
    appListeners.remove.mockReset();
    appListeners.remove.mockResolvedValue(undefined);
    mockApp.addListener.mockClear();
    mockApp.getState.mockReset();
    mockApp.getState.mockResolvedValue({ isActive: true });

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    mockPurchases.configure.mockReset();
    mockPurchases.configure.mockResolvedValue(undefined);
    mockPurchases.setLogLevel.mockReset();
    mockPurchases.setLogLevel.mockResolvedValue(undefined);
    mockPurchases.canMakePayments.mockReset();
    mockPurchases.canMakePayments.mockResolvedValue({ canMakePayments: true });
    mockPurchases.getOfferings.mockReset();
    mockPurchases.getOfferings.mockResolvedValue(makeOfferings());
    mockPurchases.purchaseStoreProduct.mockReset();
    mockPurchases.purchaseStoreProduct.mockResolvedValue(makePurchaseResult());
    mockPurchases.purchasePackage.mockReset();
    mockPurchases.purchasePackage.mockResolvedValue(makePurchaseResult());

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        token: 'eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ',
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  test('custom plugins are registered before BridgeActivity creates the bridge', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/MainActivity.java'),
      'utf8',
    );
    expect(source.indexOf('registerPlugin(SaveFilePlugin.class)')).toBeGreaterThan(-1);
    expect(source.indexOf('registerPlugin(PrintPdfPlugin.class)')).toBeGreaterThan(-1);
    expect(source).not.toContain('Purchase' + 'TracePlugin');
    expect(source.indexOf('registerPlugin(SaveFilePlugin.class)')).toBeLessThan(
      source.indexOf('super.onCreate(savedInstanceState)'),
    );
    expect(source.indexOf('registerPlugin(PrintPdfPlugin.class)')).toBeLessThan(
      source.indexOf('super.onCreate(savedInstanceState)'),
    );
  });

  test('generated Capacitor plugin registration still uses RevenueCat PurchasesPlugin', () => {
    const plugins = fs.readFileSync('android/app/src/main/assets/capacitor.plugins.json', 'utf8');
    expect(plugins).toContain('com.revenuecat.purchases.capacitor.PurchasesPlugin');
    expect(plugins).not.toContain('TracedPurchasesPlugin');
    expect(plugins).not.toContain('Purchase' + 'TracePlugin');
  });

  test('temporary purchase trace plugin and direct BillingClient dependency are absent', () => {
    const pluginPath = 'android/app/src/main/java/com/cvproai/app/plugins/Purchase' + 'TracePlugin.java';
    const buildGradle = fs.readFileSync('android/app/build.gradle', 'utf8');

    expect(fs.existsSync(pluginPath)).toBe(false);
    expect(buildGradle).not.toContain('com.android.billingclient:billing');
  });

  test('MainActivity uses RevenueCat-compatible singleTop launch mode', () => {
    const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
    expect(manifest).toContain('android:launchMode="singleTop"');
    expect(manifest).not.toContain('android:launchMode="singleTask"');
  });

  test('native save verifies plugin health before sending the file', async () => {
    const { saveFileViaPlatform } = await import('../native-save');
    const blob = new Blob(['hello'], { type: 'application/pdf' });
    await saveFileViaPlatform(blob, 'test.pdf', 'application/pdf');

    expect(savePlugin.healthCheck).toHaveBeenCalledTimes(1);
    expect(savePlugin.saveFile).toHaveBeenCalledTimes(1);
  });

  test('SaveFile source uses matching annotation, method name, and manual registration', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const activity = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/MainActivity.java'),
      'utf8',
    );

    expect(source).toContain('@CapacitorPlugin(name = "SaveFile")');
    expect(source).toContain('public void saveFile(PluginCall call)');
    expect(source).toContain('private void saveFileResult(PluginCall call, ActivityResult activityResult)');
    expect(activity).toContain('registerPlugin(SaveFilePlugin.class)');
  });

  test('SaveFile API 29+ path returns through MediaStore before any SAF picker is created', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const mediaStoreBranch = source.indexOf('if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)');
    const mediaStoreCall = source.indexOf('saveToMediaStoreDownloads(call, decodedBytes, fileName, mimeType');
    const intentIndex = source.indexOf('new Intent(Intent.ACTION_CREATE_DOCUMENT)');

    expect(mediaStoreBranch).toBeGreaterThan(-1);
    expect(mediaStoreCall).toBeGreaterThan(mediaStoreBranch);
    expect(intentIndex).toBeGreaterThan(mediaStoreCall);
    expect(source.slice(mediaStoreBranch, intentIndex)).toContain('return;');
  });

  test('SaveFile legacy API 24-28 fallback keeps SAF pending data without modern storage permissions', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

    expect(source).toContain('pendingFiles.put(callbackId, tempFile)');
    expect(source).toContain('pendingExpectedBytes.put(callbackId');
    expect(source).toContain('pendingFormats.put(callbackId, format)');
    expect(source).toContain('persistPendingSave(callbackId, tempFile');
    expect(source).toContain('PENDING_PREFS');
    expect(source).toContain('PENDING_TEMP_PATH_KEY');
    expect(source).toContain('PENDING_EXPECTED_BYTES_KEY');
    expect(source).toContain('recoverPendingSave(callbackId)');
    expect(source).toContain('isAppPrivateCacheFile(tempFile)');
    expect(source).toContain('File.createTempFile("cvpro-export-"');
    expect(source).toContain('startActivityForResult(call, intent, SAVE_FILE_CALLBACK)');
    expect(manifest).not.toContain('WRITE_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('READ_EXTERNAL_STORAGE');
    expect(manifest).not.toContain('MANAGE_EXTERNAL_STORAGE');
  });

  test('SaveFile legacy SAF launch uses the exact annotated Capacitor callback name', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const callbackName = /SAVE_FILE_CALLBACK\s*=\s*"([^"]+)"/.exec(source)?.[1];

    expect(callbackName).toBe('saveFileResult');
    expect(source).toContain('@ActivityCallback');
    expect(source).toContain('private void saveFileResult(PluginCall call, ActivityResult activityResult)');
    expect(source).toContain('startActivityForResult(call, intent, SAVE_FILE_CALLBACK)');
    expect(source).not.toContain('getActivity().startActivityForResult');
    expect(source).not.toContain('Activity.startActivityForResult');
  });

  test('SaveFile MediaStore path inserts pending Downloads rows with PDF and DOCX MIME support', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );

    expect(source).toContain('MediaStore.Downloads.EXTERNAL_CONTENT_URI');
    expect(source).toContain('values.put(MediaStore.MediaColumns.DISPLAY_NAME, finalDisplayName)');
    expect(source).toContain('values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType)');
    expect(source).toContain('values.put(MediaStore.MediaColumns.RELATIVE_PATH, DOWNLOAD_RELATIVE_PATH)');
    expect(source).toContain('values.put(MediaStore.MediaColumns.IS_PENDING, 1)');
    expect(source).toContain('private static final String DOWNLOAD_RELATIVE_PATH = Environment.DIRECTORY_DOWNLOADS + "/CV Pro AI"');
    expect(source).toContain('if ("application/pdf".equals(mimeType)) return "pdf"');
    expect(source).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });

  test('SaveFile MediaStore path writes all bytes, syncs, reads back, then publishes', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const mediaStoreMethod = source.indexOf('private void saveToMediaStoreDownloads');
    const writeIndex = source.indexOf('output.write(decodedBytes)', mediaStoreMethod);
    const syncIndex = source.indexOf('output.getFD().sync()', mediaStoreMethod);
    const readbackIndex = source.indexOf('MEDIASTORE_READBACK_STARTED', mediaStoreMethod);
    const verifyIndex = source.indexOf('bytesWritten != expectedBytes || verifiedSize != expectedBytes', mediaStoreMethod);
    const publishIndex = source.indexOf('publishValues.put(MediaStore.MediaColumns.IS_PENDING, 0)', mediaStoreMethod);
    const successIndex = source.indexOf('MEDIASTORE_SAVE_SUCCESS', mediaStoreMethod);

    expect(writeIndex).toBeGreaterThan(mediaStoreMethod);
    expect(source).toContain('bytesWritten = decodedBytes.length');
    expect(syncIndex).toBeGreaterThan(writeIndex);
    expect(readbackIndex).toBeGreaterThan(syncIndex);
    expect(source).toContain('long verifiedSize = readBackByteCount(destination)');
    expect(source).toContain('bytesWritten <= 0 || verifiedSize <= 0');
    expect(verifyIndex).toBeGreaterThan(readbackIndex);
    expect(publishIndex).toBeGreaterThan(verifyIndex);
    expect(successIndex).toBeGreaterThan(publishIndex);
  });

  test('SaveFile MediaStore failures delete pending rows and never publish zero or mismatched files', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const mediaStoreMethod = source.indexOf('private void saveToMediaStoreDownloads');
    const zeroGuard = source.indexOf('bytesWritten <= 0 || verifiedSize <= 0', mediaStoreMethod);
    const mismatchGuard = source.indexOf('bytesWritten != expectedBytes || verifiedSize != expectedBytes', mediaStoreMethod);
    const publishIndex = source.indexOf('publishValues.put(MediaStore.MediaColumns.IS_PENDING, 0)', mediaStoreMethod);

    expect(source).toContain('MEDIASTORE_FAILED_ROW_DELETED');
    expect(source).toContain('recordMediaStoreFailure');
    expect(source).toContain('deleteDestinationQuietly(destination)');
    expect(zeroGuard).toBeGreaterThan(mediaStoreMethod);
    expect(mismatchGuard).toBeGreaterThan(zeroGuard);
    expect(publishIndex).toBeGreaterThan(mismatchGuard);
  });

  test('SaveFile MediaStore duplicate filenames receive safe numeric suffixes', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );

    expect(source).toContain('makeUniqueDisplayName');
    expect(source).toContain('displayNameExistsInDownloadsFolder');
    expect(source).toContain('baseName + " (" + index + ")" + extension');
    expect(source).toContain('MediaStore.MediaColumns.DISPLAY_NAME + "=?";');
    expect(source).toContain('normalizeRelativePath(DOWNLOAD_RELATIVE_PATH)');
  });

  test('SaveFile callback records entry, call presence and data presence before processing result', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const callbackIndex = source.indexOf('private void saveFileResult');
    const enteredIndex = source.indexOf('SAF_CALLBACK_ENTERED', callbackIndex);
    const callPresentIndex = source.indexOf('SAF_CALLBACK_CALL_PRESENT', callbackIndex);
    const dataPresentIndex = source.indexOf('SAF_CALLBACK_DATA_PRESENT', callbackIndex);
    const uriReturnedIndex = source.indexOf('SAF_URI_RETURNED', callbackIndex);
    const cancelledIndex = source.indexOf('SAF_RESULT_CANCELLED', callbackIndex);

    expect(enteredIndex).toBeGreaterThan(callbackIndex);
    expect(callPresentIndex).toBeGreaterThan(enteredIndex);
    expect(dataPresentIndex).toBeGreaterThan(callPresentIndex);
    expect(uriReturnedIndex).toBeGreaterThan(dataPresentIndex);
    expect(cancelledIndex).toBeGreaterThan(dataPresentIndex);
    expect(source).toContain('event.put("resultCode", resultCode)');
    expect(source).toContain('event.put("callPresent", callPresent)');
    expect(source).toContain('event.put("dataPresent", dataPresent)');
  });

  test('SaveFile callback handles RESULT_OK, cancellation and missing pending data safely', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );

    expect(source).toContain('activityResult.getResultCode() == Activity.RESULT_CANCELED');
    expect(source).toContain('recordDiagnostic("SAF_RESULT_CANCELLED"');
    expect(source).toContain('activityResult.getResultCode() != Activity.RESULT_OK || destination == null');
    expect(source).toContain('recordDiagnostic("SAF_URI_RETURNED"');
    expect(source).toContain('recordDiagnostic("PENDING_SAVE_MISSING"');
    expect(source).toContain('recordDiagnostic("PENDING_SAVE_RECOVERED"');
    expect(source).toContain('call.reject("Prepared file data is unavailable")');
    expect(source).toContain('FAILED_DESTINATION_DELETE_RESULT');
  });

  test('SaveFile source rejects decoded byte mismatch before launching picker', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const mismatchIndex = source.indexOf('decodedBytes.length != expectedBytes');
    const pickerIndex = source.indexOf('SAF_PICKER_LAUNCHED');

    expect(mismatchIndex).toBeGreaterThan(-1);
    expect(pickerIndex).toBeGreaterThan(-1);
    expect(mismatchIndex).toBeLessThan(pickerIndex);
    expect(source).toContain('call.reject("Decoded file size does not match expected byte count")');
  });

  test('SaveFile source requires close/readback and matching sizes before native success', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    const closeIndex = source.indexOf('DESTINATION_STREAM_CLOSED');
    const readbackIndex = source.indexOf('DESTINATION_READBACK_COMPLETED');
    const successIndex = source.indexOf('NATIVE_SAVE_SUCCESS');

    expect(source).toContain('ParcelFileDescriptor descriptor');
    expect(source).toContain('new FileOutputStream(descriptor.getFileDescriptor())');
    expect(source).toContain('output.getFD().sync()');
    expect(source).toContain('readBackByteCount(destination)');
    expect(source).toContain('bytesWritten <= 0 || verifiedSize <= 0');
    expect(source).toContain('bytesWritten != expectedBytes || verifiedSize != expectedBytes');
    expect(closeIndex).toBeGreaterThan(-1);
    expect(readbackIndex).toBeGreaterThan(closeIndex);
    expect(successIndex).toBeGreaterThan(readbackIndex);
  });

  test('SaveFile source persists sanitized native diagnostic phases', () => {
    const source = fs.readFileSync(
      path.resolve('android/app/src/main/java/com/cvproai/app/plugins/SaveFilePlugin.java'),
      'utf8',
    );
    for (const phase of [
      'NATIVE_PLUGIN_ENTERED',
      'NATIVE_EXPECTED_BYTES',
      'NATIVE_BASE64_RECEIVED',
      'NATIVE_BASE64_DECODED',
      'MEDIASTORE_SAVE_ENTERED',
      'MEDIASTORE_VALUES_READY',
      'MEDIASTORE_INSERT_STARTED',
      'MEDIASTORE_INSERT_COMPLETED',
      'MEDIASTORE_WRITE_STARTED',
      'MEDIASTORE_WRITE_COMPLETED',
      'MEDIASTORE_SYNC_COMPLETED',
      'MEDIASTORE_READBACK_STARTED',
      'MEDIASTORE_READBACK_COMPLETED',
      'MEDIASTORE_PUBLISHED',
      'MEDIASTORE_SAVE_SUCCESS',
      'MEDIASTORE_SAVE_FAILED',
      'MEDIASTORE_FAILED_ROW_DELETED',
      'SAF_PICKER_LAUNCHED',
      'SAF_CALLBACK_ENTERED',
      'SAF_CALLBACK_CALL_PRESENT',
      'SAF_CALLBACK_DATA_PRESENT',
      'SAF_RESULT_CANCELLED',
      'SAF_URI_RETURNED',
      'PENDING_SAVE_RECOVERED',
      'PENDING_SAVE_MISSING',
      'TEMP_FILE_WRITTEN',
      'DESTINATION_OPEN_STARTED',
      'DESTINATION_OPENED',
      'DESTINATION_COPY_STARTED',
      'DESTINATION_COPY_COMPLETED',
      'DESTINATION_FLUSH_COMPLETED',
      'DESTINATION_STREAM_CLOSED',
      'DESTINATION_READBACK_STARTED',
      'DESTINATION_READBACK_COMPLETED',
      'NATIVE_SAVE_SUCCESS',
      'NATIVE_SAVE_FAILED',
      'FAILED_DESTINATION_DELETE_RESULT',
    ]) {
      expect(source).toContain(phase);
    }
    expect(source).toContain('destination.getAuthority()');
    expect(source).not.toContain('destination.toString()');
  });

  test('native save fails clearly when custom plugin is not registered', async () => {
    mockCapacitor.isPluginAvailable.mockReturnValue(false);
    const { saveFileViaPlatform, SaveFailedError } = await import('../native-save');
    const blob = new Blob(['hello'], { type: 'application/pdf' });

    await expect(saveFileViaPlatform(blob, 'test.pdf', 'application/pdf')).rejects.toBeInstanceOf(
      SaveFailedError,
    );
    expect(savePlugin.saveFile).not.toHaveBeenCalled();
  });

  test('purchase preflight stops immediately when billing is unavailable', async () => {
    mockPurchases.canMakePayments.mockResolvedValue({ canMakePayments: false });
    const { purchasePro } = await import('../iap');
    const result = await purchasePro();

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toContain('billing is unavailable');
    expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
    expect(mockPurchases.purchaseStoreProduct).not.toHaveBeenCalled();
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  test('Android purchases the selected RevenueCat Offering package', async () => {
    const { purchasePro } = await import('../iap');
    const result = await purchasePro();

    expect(result.success).toBe(true);
    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith({
      aPackage: expect.objectContaining({ identifier: '$rc_lifetime' }),
    });
    expect(mockPurchases.purchaseStoreProduct).not.toHaveBeenCalled();
  });

  test('iOS keeps the package purchase path', async () => {
    mockCapacitor.getPlatform.mockReturnValue('ios');
    const { purchasePro } = await import('../iap');
    const result = await purchasePro();

    expect(result.success).toBe(true);
    expect(mockPurchases.purchasePackage).toHaveBeenCalledWith({
      aPackage: expect.objectContaining({ identifier: '$rc_lifetime' }),
    });
    expect(mockPurchases.purchaseStoreProduct).not.toHaveBeenCalled();
  });

  test('pre-sheet watchdog returns instead of leaving purchase stuck forever', async () => {
    vi.useFakeTimers();
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => {}));
    mockApp.getState.mockResolvedValue({ isActive: true });
    const { purchasePro } = await import('../iap');

    const resultPromise = purchasePro();
    await vi.advanceTimersByTimeAsync(15_001);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toContain('STORE_DID_NOT_OPEN');
    expect(appListeners.remove).toHaveBeenCalled();
  });

  test('a transient inactive event does not disable the 15-second watchdog', async () => {
    vi.useFakeTimers();
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => {}));
    mockApp.getState.mockResolvedValue({ isActive: true });
    const { purchasePro } = await import('../iap');

    const resultPromise = purchasePro();
    await vi.advanceTimersByTimeAsync(1);
    appListeners.callback?.({ isActive: false });
    appListeners.callback?.({ isActive: true });
    await vi.advanceTimersByTimeAsync(15_000);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toContain('STORE_DID_NOT_OPEN');
    expect(appListeners.remove).toHaveBeenCalled();
  });

  test('visible WebView wins over a stale inactive app state', async () => {
    vi.useFakeTimers();
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => {}));
    mockApp.getState.mockResolvedValue({ isActive: false });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    const { purchasePro } = await import('../iap');

    const resultPromise = purchasePro();
    await vi.advanceTimersByTimeAsync(15_001);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toContain('STORE_DID_NOT_OPEN');
    expect(appListeners.remove).toHaveBeenCalled();
  });

  test('returning from a confirmed store screen times out a missing RevenueCat callback', async () => {
    vi.useFakeTimers();
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => {}));
    mockApp.getState.mockResolvedValue({ isActive: false });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    const { purchasePro } = await import('../iap');

    const resultPromise = purchasePro();
    await vi.advanceTimersByTimeAsync(15_001);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    appListeners.callback?.({ isActive: true });
    await vi.advanceTimersByTimeAsync(8_001);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toContain('PURCHASE_CALLBACK_TIMEOUT');
    expect(appListeners.remove).toHaveBeenCalled();
  });


  test('listener cleanup can never keep the purchase UI stuck', async () => {
    vi.useFakeTimers();
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => {}));
    mockApp.getState.mockResolvedValue({ isActive: true });
    appListeners.remove.mockReturnValue(new Promise(() => {}));
    const { purchasePro } = await import('../iap');

    const resultPromise = purchasePro();
    await vi.advanceTimersByTimeAsync(15_001);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toContain('STORE_DID_NOT_OPEN');
    expect(result.success === false && result.message).toContain('phase=PURCHASE_CALLED');
    expect(appListeners.remove).toHaveBeenCalled();
  });

  test('diagnostic log handler failure does not block SDK configuration', async () => {
    mockPurchases.setLogHandler.mockRejectedValueOnce(new Error('handler unavailable'));
    const { initIAP, purchasePro } = await import('../iap');

    await initIAP();
    const result = await purchasePro();

    expect(result.success).toBe(true);
    expect(mockPurchases.configure).toHaveBeenCalled();
  });

});
