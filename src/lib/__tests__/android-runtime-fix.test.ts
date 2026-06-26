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
  saveFile: vi.fn().mockResolvedValue({ result: 'saved', message: 'OK' }),
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
    savePlugin.saveFile.mockResolvedValue({ result: 'saved', message: 'OK' });

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
