/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockPlugin = vi.hoisted(() => ({
  clear: vi.fn().mockResolvedValue(undefined),
  mark: vi.fn().mockResolvedValue(undefined),
  getTrace: vi.fn().mockResolvedValue({ lastPhase: 'X', lastAt: 1, events: [] }),
  ping: vi.fn().mockResolvedValue({ success: true, timestamp: 1 }),
  armWatchdog: vi.fn().mockResolvedValue({ armed: true, timeoutMs: 20_000 }),
  cancelWatchdog: vi.fn().mockResolvedValue(undefined),
  probeBilling: vi.fn().mockResolvedValue({
    connected: true,
    responseCode: 0,
    productFound: true,
    productId: 'cv_pro_lifetime',
    productType: 'inapp',
  }),
}));

const mockCapacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => 'android'),
  isPluginAvailable: vi.fn(() => true),
}));

const mockRegisterPlugin = vi.hoisted(() => vi.fn(() => mockPlugin));

vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor,
  registerPlugin: mockRegisterPlugin,
}));

describe('PurchaseTrace wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    mockCapacitor.isNativePlatform.mockReturnValue(true);
    mockCapacitor.getPlatform.mockReturnValue('android');
    mockCapacitor.isPluginAvailable.mockReturnValue(true);
    mockRegisterPlugin.mockClear();
    mockPlugin.clear.mockReset();
    mockPlugin.clear.mockResolvedValue(undefined);
    mockPlugin.mark.mockReset();
    mockPlugin.mark.mockResolvedValue(undefined);
    mockPlugin.getTrace.mockReset();
    mockPlugin.getTrace.mockResolvedValue({ lastPhase: 'X', lastAt: 1, events: [] });
    mockPlugin.ping.mockReset();
    mockPlugin.ping.mockResolvedValue({ success: true, timestamp: 1 });
    mockPlugin.armWatchdog.mockReset();
    mockPlugin.armWatchdog.mockResolvedValue({ armed: true, timeoutMs: 20_000 });
    mockPlugin.cancelWatchdog.mockReset();
    mockPlugin.cancelWatchdog.mockResolvedValue(undefined);
    mockPlugin.probeBilling.mockReset();
    mockPlugin.probeBilling.mockResolvedValue({
      connected: true,
      responseCode: 0,
      productFound: true,
      productId: 'cv_pro_lifetime',
      productType: 'inapp',
    });
  });

  test('registers the PurchaseTrace Capacitor plugin', async () => {
    await import('../purchase-trace');
    expect(mockRegisterPlugin).toHaveBeenCalledWith('PurchaseTrace');
  });

  test('forwards Android native calls to the plugin', async () => {
    const trace = await import('../purchase-trace');
    await trace.clearPurchaseTrace();
    await trace.markPurchaseTrace('JS_PURCHASE_CALL');
    await trace.armPurchaseTraceWatchdog(20_000);
    await trace.cancelPurchaseTraceWatchdog();
    const probe = await trace.probePurchaseBilling('cv_pro_lifetime');

    expect(mockPlugin.clear).toHaveBeenCalledTimes(1);
    expect(mockPlugin.mark).toHaveBeenCalledWith({ phase: 'JS_PURCHASE_CALL', detail: undefined });
    expect(mockPlugin.armWatchdog).toHaveBeenCalledWith({ timeoutMs: 20_000 });
    expect(mockPlugin.cancelWatchdog).toHaveBeenCalledTimes(1);
    expect(mockPlugin.probeBilling).toHaveBeenCalledWith({ productId: 'cv_pro_lifetime' });
    expect(probe?.productId).toBe('cv_pro_lifetime');
  });

  test('attempts diagnostics even when Capacitor plugin availability reports false', async () => {
    mockCapacitor.isPluginAvailable.mockReturnValue(false);
    const trace = await import('../purchase-trace');

    await trace.clearPurchaseTrace();
    await trace.markPurchaseTrace('JS_PURCHASE_CALL');
    const ping = await trace.pingPurchaseTrace();

    expect(ping).toBe(true);
    expect(mockPlugin.clear).toHaveBeenCalledTimes(1);
    expect(mockPlugin.mark).toHaveBeenCalledWith({ phase: 'JS_PURCHASE_CALL', detail: undefined });
    expect(mockPlugin.ping).toHaveBeenCalledTimes(1);
  });

  test('safe helpers no-op outside Android native builds', async () => {
    mockCapacitor.getPlatform.mockReturnValue('web');
    const trace = await import('../purchase-trace');

    await trace.clearPurchaseTrace();
    await trace.markPurchaseTrace('JS_PURCHASE_CALL');
    const ping = await trace.pingPurchaseTrace();
    const probe = await trace.probePurchaseBilling('cv_pro_lifetime');

    expect(ping).toBe(false);
    expect(probe).toBeNull();
    expect(mockPlugin.clear).not.toHaveBeenCalled();
    expect(mockPlugin.mark).not.toHaveBeenCalled();
    expect(mockPlugin.probeBilling).not.toHaveBeenCalled();
  });

  test('bridge self-test directly calls ping, mark, and getTrace in order', async () => {
    mockPlugin.getTrace.mockResolvedValue({
      lastPhase: 'VIEWER_SELF_TEST',
      lastAt: 2,
      events: [
        { timestamp: 1, phase: 'JS_PURCHASE_CALL' },
        { timestamp: 2, phase: 'VIEWER_SELF_TEST', detail: 'bridge-write-check' },
      ],
    });
    const trace = await import('../purchase-trace');

    const result = await trace.runPurchaseTraceBridgeSelfTest();

    expect(mockCapacitor.isNativePlatform).toHaveBeenCalled();
    expect(mockCapacitor.getPlatform).toHaveBeenCalled();
    expect(mockCapacitor.isPluginAvailable).toHaveBeenCalledWith('PurchaseTrace');
    expect(mockPlugin.ping).toHaveBeenCalledTimes(1);
    expect(mockPlugin.mark).toHaveBeenCalledWith({
      phase: 'VIEWER_SELF_TEST',
      detail: 'bridge-write-check',
    });
    expect(mockPlugin.getTrace).toHaveBeenCalledTimes(1);
    expect(mockPlugin.ping.mock.invocationCallOrder[0]).toBeLessThan(mockPlugin.mark.mock.invocationCallOrder[0]);
    expect(mockPlugin.mark.mock.invocationCallOrder[0]).toBeLessThan(mockPlugin.getTrace.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({
      nativePlatform: true,
      platform: 'android',
      pluginAvailable: true,
      ping: 'ok',
      mark: 'ok',
      getTrace: 'ok',
      lastPhase: 'VIEWER_SELF_TEST',
      eventCount: 2,
    });
    expect(mockPlugin.probeBilling).not.toHaveBeenCalled();
    expect(mockPlugin.armWatchdog).not.toHaveBeenCalled();
    expect(mockPlugin.cancelWatchdog).not.toHaveBeenCalled();
    expect(mockPlugin.clear).not.toHaveBeenCalled();
  });

  test('bridge self-test reports plugin availability explicitly', async () => {
    mockCapacitor.isPluginAvailable.mockReturnValue(false);
    const trace = await import('../purchase-trace');

    const result = await trace.runPurchaseTraceBridgeSelfTest();

    expect(result.pluginAvailable).toBe(false);
    expect(result.ping).toBe('ok');
  });

  test('bridge self-test reports timeout stage and continues remaining direct calls', async () => {
    vi.useFakeTimers();
    mockPlugin.ping.mockImplementationOnce(() => new Promise(() => undefined));
    const trace = await import('../purchase-trace');

    const pending = trace.runPurchaseTraceBridgeSelfTest(25);
    await vi.advanceTimersByTimeAsync(25);
    const result = await pending;

    expect(result.ping).toBe('timeout');
    expect(result.mark).toBe('ok');
    expect(result.getTrace).toBe('ok');
    expect(result.errorStage).toBe('ping');
    expect(result.errorMessage).toBe('ping timed out after 25ms');
    expect(mockPlugin.mark).toHaveBeenCalledWith({
      phase: 'VIEWER_SELF_TEST',
      detail: 'bridge-write-check',
    });
    vi.useRealTimers();
  });

  test('bridge self-test reports rejection stage with sanitized error message', async () => {
    mockPlugin.mark.mockRejectedValueOnce(
      new Error('Native rejected purchaseToken=abcdefghijklmnopqrstuvwxyz123456 email=test@example.com'),
    );
    const trace = await import('../purchase-trace');

    const result = await trace.runPurchaseTraceBridgeSelfTest();

    expect(result.ping).toBe('ok');
    expect(result.mark).toBe('failed');
    expect(result.getTrace).toBe('ok');
    expect(result.errorStage).toBe('mark');
    expect(result.errorMessage).toContain('Native rejected');
    expect(result.errorMessage).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(result.errorMessage).not.toContain('test@example.com');
    expect(mockPlugin.getTrace).toHaveBeenCalledTimes(1);
  });
});
