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
}));

const mockPurchases = vi.hoisted(() => ({
  configure: vi.fn().mockResolvedValue(undefined),
  setLogLevel: vi.fn().mockResolvedValue(undefined),
  canMakePayments: vi.fn().mockResolvedValue({ canMakePayments: true }),
  getOfferings: vi.fn(),
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

    mockPurchases.configure.mockReset();
    mockPurchases.configure.mockResolvedValue(undefined);
    mockPurchases.setLogLevel.mockReset();
    mockPurchases.setLogLevel.mockResolvedValue(undefined);
    mockPurchases.canMakePayments.mockReset();
    mockPurchases.canMakePayments.mockResolvedValue({ canMakePayments: true });
    mockPurchases.getOfferings.mockReset();
    mockPurchases.getOfferings.mockResolvedValue(makeOfferings());
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
    expect(source.indexOf('registerPlugin(SaveFilePlugin.class)')).toBeLessThan(
      source.indexOf('super.onCreate(savedInstanceState)'),
    );
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
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  });

  test('pre-sheet watchdog returns instead of leaving purchase stuck forever', async () => {
    vi.useFakeTimers();
    mockPurchases.purchasePackage.mockReturnValue(new Promise(() => {}));
    const { purchasePro } = await import('../iap');

    const resultPromise = purchasePro();
    await vi.advanceTimersByTimeAsync(15_001);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.success === false && result.message).toContain('STORE_DID_NOT_OPEN');
    expect(appListeners.remove).toHaveBeenCalled();
  });

  test('watchdog is removed when native store activity opens and does not time out purchase', async () => {
    vi.useFakeTimers();
    const pending = deferred<ReturnType<typeof makePurchaseResult>>();
    mockPurchases.purchasePackage.mockReturnValue(pending.promise);
    const { purchasePro } = await import('../iap');

    const resultPromise = purchasePro();
    await vi.advanceTimersByTimeAsync(1);
    expect(appListeners.callback).not.toBeNull();
    appListeners.callback?.({ isActive: false });
    await vi.advanceTimersByTimeAsync(20_000);

    pending.resolve(makePurchaseResult());
    const result = await resultPromise;
    expect(result.success).toBe(true);
    expect(appListeners.remove).toHaveBeenCalled();
  });
});
