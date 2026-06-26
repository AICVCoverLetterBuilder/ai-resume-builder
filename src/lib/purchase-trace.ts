import { Capacitor, registerPlugin } from '@capacitor/core';

export interface PurchaseTraceEvent {
  timestamp: number;
  phase: string;
  detail?: string;
  responseCode?: number;
}

export interface PurchaseTraceSnapshot {
  lastPhase: string;
  lastAt: number;
  events: PurchaseTraceEvent[];
}

export interface BillingProbeResult {
  connected: boolean;
  responseCode: number;
  productFound: boolean;
  productId?: string;
  productType?: string;
}

export type PurchaseTraceBridgeStatus = 'ok' | 'failed' | 'timeout';

export interface PurchaseTraceBridgeSelfTestResult {
  nativePlatform: boolean;
  platform: string;
  pluginAvailable: boolean;
  ping: PurchaseTraceBridgeStatus;
  mark: PurchaseTraceBridgeStatus;
  getTrace: PurchaseTraceBridgeStatus;
  lastPhase?: string;
  eventCount?: number;
  errorStage?: 'ping' | 'mark' | 'getTrace';
  errorMessage?: string;
  trace?: PurchaseTraceSnapshot;
}

interface PurchaseTracePlugin {
  clear(): Promise<void>;
  mark(options: { phase: string; detail?: string }): Promise<void>;
  getTrace(): Promise<PurchaseTraceSnapshot>;
  ping(): Promise<{ success: boolean; timestamp: number }>;
  armWatchdog(options: { timeoutMs: number }): Promise<{ armed: boolean; timeoutMs: number }>;
  cancelWatchdog(): Promise<void>;
  probeBilling(options: { productId: string }): Promise<BillingProbeResult>;
}

const PurchaseTrace = registerPlugin<PurchaseTracePlugin>('PurchaseTrace');

const DEFAULT_TIMEOUT_MS = 1_500;
const BRIDGE_SELF_TEST_TIMEOUT_MS = 2_000;

function isAndroidNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android'
  );
}

function timeout<T>(ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(fallback), ms);
  });
}

function sanitizeDiagnosticMessage(message: string): string {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(api[_-]?key|app[_-]?user[_-]?id|purchase[_-]?token|token|email)\s*[:=]\s*[^,\s}]+/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, '[redacted]')
    .slice(0, 180);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return sanitizeDiagnosticMessage(error.message || error.name);
  if (typeof error === 'string') return sanitizeDiagnosticMessage(error);
  return 'Unknown bridge error';
}

type DirectTraceCallResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'failed'; message: string }
  | { status: 'timeout'; message: string };

function directTraceCall<T>(
  stage: 'ping' | 'mark' | 'getTrace',
  call: () => Promise<T>,
  timeoutMs: number,
): Promise<DirectTraceCallResult<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: DirectTraceCallResult<T>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      finish({ status: 'timeout', message: `${stage} timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    Promise.resolve()
      .then(call)
      .then((value) => finish({ status: 'ok', value }))
      .catch((error) => finish({ status: 'failed', message: getErrorMessage(error) }));
  });
}

async function safeCall<T>(
  method: keyof PurchaseTracePlugin,
  call: () => Promise<T>,
  fallback: T,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  if (!isAndroidNative()) return fallback;
  if (typeof (PurchaseTrace as unknown as Record<string, unknown>)[method] !== 'function') return fallback;
  try {
    return await Promise.race([call(), timeout(timeoutMs, fallback)]);
  } catch {
    return fallback;
  }
}

export async function clearPurchaseTrace(timeoutMs?: number): Promise<void> {
  await safeCall('clear', () => PurchaseTrace.clear(), undefined, timeoutMs);
}

export async function markPurchaseTrace(phase: string, detail?: string, timeoutMs?: number): Promise<void> {
  await safeCall('mark', () => PurchaseTrace.mark({ phase, detail }), undefined, timeoutMs);
}

export async function getPurchaseTrace(timeoutMs?: number): Promise<PurchaseTraceSnapshot | null> {
  return safeCall('getTrace', () => PurchaseTrace.getTrace(), null, timeoutMs);
}

export async function runPurchaseTraceBridgeSelfTest(
  timeoutMs = BRIDGE_SELF_TEST_TIMEOUT_MS,
): Promise<PurchaseTraceBridgeSelfTestResult> {
  const result: PurchaseTraceBridgeSelfTestResult = {
    nativePlatform: typeof window !== 'undefined' ? Capacitor.isNativePlatform() : false,
    platform: typeof window !== 'undefined' ? Capacitor.getPlatform() : 'server',
    pluginAvailable:
      typeof window !== 'undefined' &&
      typeof Capacitor.isPluginAvailable === 'function' &&
      Capacitor.isPluginAvailable('PurchaseTrace'),
    ping: 'failed',
    mark: 'failed',
    getTrace: 'failed',
  };

  const ping = await directTraceCall('ping', () => PurchaseTrace.ping(), timeoutMs);
  result.ping = ping.status;
  if (ping.status !== 'ok' && !result.errorStage) {
    result.errorStage = 'ping';
    result.errorMessage = ping.message;
  }

  const mark = await directTraceCall(
    'mark',
    () => PurchaseTrace.mark({ phase: 'VIEWER_SELF_TEST', detail: 'bridge-write-check' }),
    timeoutMs,
  );
  result.mark = mark.status;
  if (mark.status !== 'ok' && !result.errorStage) {
    result.errorStage = 'mark';
    result.errorMessage = mark.message;
  }

  const trace = await directTraceCall('getTrace', () => PurchaseTrace.getTrace(), timeoutMs);
  result.getTrace = trace.status;
  if (trace.status === 'ok') {
    result.trace = trace.value;
    result.lastPhase = trace.value.lastPhase;
    result.eventCount = trace.value.events.length;
  } else if (!result.errorStage) {
    result.errorStage = 'getTrace';
    result.errorMessage = trace.message;
  }

  return result;
}

export async function pingPurchaseTrace(timeoutMs?: number): Promise<boolean> {
  const result = await safeCall('ping', () => PurchaseTrace.ping(), { success: false, timestamp: 0 }, timeoutMs);
  return result.success === true;
}

export async function armPurchaseTraceWatchdog(timeoutMs: number, callTimeoutMs?: number): Promise<void> {
  await safeCall(
    'armWatchdog',
    () => PurchaseTrace.armWatchdog({ timeoutMs }),
    { armed: false, timeoutMs },
    callTimeoutMs,
  );
}

export async function cancelPurchaseTraceWatchdog(timeoutMs?: number): Promise<void> {
  await safeCall('cancelWatchdog', () => PurchaseTrace.cancelWatchdog(), undefined, timeoutMs);
}

export async function probePurchaseBilling(productId: string, timeoutMs?: number): Promise<BillingProbeResult | null> {
  return safeCall('probeBilling', () => PurchaseTrace.probeBilling({ productId }), null, timeoutMs);
}
