'use client';

/**
 * iap.ts — Native In-App Purchase layer via RevenueCat
 *
 * On Android: delegates to Google Play Billing via RevenueCat Capacitor SDK.
 * On iOS:     delegates to Apple In-App Purchase via RevenueCat Capacitor SDK.
 * On web:     graceful no-op (purchase UI is shown; transactions must complete in the native app).
 *
 * Product ID:    cv_pro_lifetime   (one-time, non-consumable)
 * Package ID:    $rc_lifetime
 * Offering ID:   default
 * Entitlement:   CV Pro AI Pro
 *
 * RevenueCat API keys must be configured as environment variables:
 *   NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY — Google Play public SDK key
 *   REVENUECAT_SECRET_API_KEY               — Server-only secret (used server-side)
 *
 * Security:
 *   Client-side purchase result is NEVER the source of truth for Pro status.
 *   After a successful purchase, the server is called (/api/verify-pro)
 *   which validates the entitlement via RevenueCat REST API. The server
 *   issues an HMAC-signed Pro token that the app uses to gate features.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LOG_LEVEL, Purchases as RevenueCatPurchases } from '@revenuecat/purchases-capacitor';
import { apiFetch } from './api';

// --- Constants ------------------------------------------------------------------

export const PRO_PRODUCT_ID = 'cv_pro_lifetime';
export const PRO_ENTITLEMENT = 'CV Pro AI Pro';
export const PACKAGE_IDENTIFIER = '$rc_lifetime';
export const OFFERING_IDENTIFIER = 'default';

// --- App User ID -----------------------------------------------------------------

const APP_USER_ID_KEY = 'cvpro_rc_user_id';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAppUserId(): string {
  if (typeof window === 'undefined') return 'web-anonymous';
  try {
    const stored = localStorage.getItem(APP_USER_ID_KEY);
    if (stored) return stored;
  } catch {}
  const id = generateUUID();
  try {
    localStorage.setItem(APP_USER_ID_KEY, id);
  } catch {}
  return id;
}

// --- Platform detection ----------------------------------------------------------

export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform();
}

function getPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const p = Capacitor.getPlatform();
  if (p === 'ios') return 'ios';
  if (p === 'android') return 'android';
  return 'web';
}

// --- RevenueCat plugin reference -------------------------------------------------

function getPurchases() {
  if (!RevenueCatPurchases) {
    throw new Error('RevenueCat Purchases plugin unavailable.');
  }
  return RevenueCatPurchases;
}

// --- SDK initializer --------------------------------------------------------------

let _initialized = false;
let _initializePromise: Promise<void> | null = null;
let _storePrice: string | null = null;

function diagLog(...args: unknown[]) {
  console.log('[IAP-DIAG]', ...args);
}

function diagError(...args: unknown[]) {
  console.error('[IAP-DIAG]', ...args);
}

type PurchasePhase =
  | 'IDLE'
  | 'INITIALIZING'
  | 'BILLING_CHECK'
  | 'OFFERINGS_FETCH'
  | 'PACKAGE_SELECTED'
  | 'PURCHASE_CALLED'
  | 'STORE_CONFIRMED_OPEN'
  | 'RETURNED_FROM_STORE'
  | 'PURCHASE_CALLBACK'
  | 'SERVER_VERIFY'
  | 'COMPLETE';

type RevenueCatHint =
  | 'NONE'
  | 'NO_CORE_LIBRARY_DESUGARING'
  | 'ITEM_ALREADY_OWNED'
  | 'DEVELOPER_ERROR'
  | 'BILLING_UNAVAILABLE'
  | 'SERVICE_DISCONNECTED'
  | 'NETWORK_ERROR';

let _purchasePhase: PurchasePhase = 'IDLE';
let _revenueCatHint: RevenueCatHint = 'NONE';

function setPurchasePhase(phase: PurchasePhase) {
  _purchasePhase = phase;
  diagLog('phase =', phase);
}

function classifyRevenueCatLog(message: string): RevenueCatHint {
  const text = message.toLowerCase();
  if (text.includes('nocorelibrarydesugaring') || text.includes('error building billingflowparams')) {
    return 'NO_CORE_LIBRARY_DESUGARING';
  }
  if (text.includes('item_already_owned') || text.includes('already owned')) return 'ITEM_ALREADY_OWNED';
  if (text.includes('developer_error') || text.includes('developer error')) return 'DEVELOPER_ERROR';
  if (text.includes('billing unavailable') || text.includes('billing_unavailable')) return 'BILLING_UNAVAILABLE';
  if (text.includes('service_disconnected') || text.includes('service disconnected')) return 'SERVICE_DISCONNECTED';
  if (text.includes('network_error') || text.includes('network error')) return 'NETWORK_ERROR';
  return 'NONE';
}

function diagnosticSuffix(): string {
  return ` [phase=${_purchasePhase}; hint=${_revenueCatHint}]`;
}

export function getStorePrice(): string | null {
  return _storePrice;
}

export async function refreshStorePrice(): Promise<string | null> {
  const platform = getPlatform();
  if (platform === 'web') return null;

  try {
    await withTimeout(initIAP(), INIT_TIMEOUT_MS, 'initIAP (from refreshStorePrice)');
    if (!_initialized) return null;
    const Purchases = getPurchases();
    diagLog('refreshStorePrice: fetching offerings...');
    const offerings = await withTimeout(
      Purchases.getOfferings(),
      PURCHASE_TIMEOUT_MS,
      'getOfferings (refreshStorePrice)',
    );
    const current = offerings.current;
    if (!current) {
      diagLog('refreshStorePrice: no current offering');
      return null;
    }
    diagLog('refreshStorePrice: current offering identifier:', current?.identifier ?? 'null');
    diagLog('refreshStorePrice: available packages:', current?.availablePackages?.map((p) => '(' + p.identifier + ', product=' + p.product.identifier + ', price=' + p.product.priceString + ')') ?? []);

    const lifetimePackage =
      current.availablePackages.find((pkg) => pkg.identifier === PACKAGE_IDENTIFIER) ??
      current.availablePackages.find((pkg) => pkg.product.identifier === PRO_PRODUCT_ID) ??
      null;

    if (lifetimePackage) {
      _storePrice = lifetimePackage.product.priceString ?? null;
      diagLog('refreshStorePrice: found price:', _storePrice);
      return _storePrice;
    }

    for (const offeringKey of Object.keys(offerings.all)) {
      const offering = offerings.all[offeringKey];
      const found = offering.availablePackages.find(
        (pkg) => pkg.identifier === PACKAGE_IDENTIFIER || pkg.product.identifier === PRO_PRODUCT_ID,
      );
      if (found) {
        _storePrice = found.product.priceString ?? null;
        diagLog('refreshStorePrice: found price in fallback offering:', offeringKey, _storePrice);
        return _storePrice;
      }
    }
    diagLog('refreshStorePrice: lifetime package not found in any offering');
  } catch (e) {
    diagError('refreshStorePrice failed:', e);
  }
  return null;
}

export async function initIAP(): Promise<void> {
  if (_initialized) return;
  if (_initializePromise) return _initializePromise;

  const platform = getPlatform();
  if (platform === 'web') {
    diagLog('initIAP: web platform, skipping');
    return;
  }

  _initializePromise = _initIAPImpl(platform);
  try {
    await _initializePromise;
  } finally {
    _initializePromise = null;
  }
}

async function _initIAPImpl(platform: 'ios' | 'android' | 'web'): Promise<void> {
  diagLog('initIAP: platform =', platform);
  diagLog('initIAP: RevenueCat API key configured =', !!process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY);

  const apiKey =
    platform === 'ios'
      ? (process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? '')
      : (process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '');

  if (!apiKey) {
    diagError('initIAP: RevenueCat API key not configured.');
    throw new IAPConfigurationError('RevenueCat public SDK key is not configured for this native build.');
  }

  const Purchases = getPurchases();

  try {
    setPurchasePhase('INITIALIZING');

    // Internal diagnostic capture. Only short, pre-classified hints are retained;
    // raw RevenueCat log text is never shown to the user.
    try {
      await withTimeout(
        Purchases.setLogHandler((_level, message) => {
          const hint = classifyRevenueCatLog(message);
          if (hint !== 'NONE') _revenueCatHint = hint;
        }),
        2_000,
        'Purchases.setLogHandler',
      );
    } catch (e) {
      diagError('initIAP: custom log handler unavailable:', e);
    }

    try {
      await withTimeout(
        Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG }),
        2_000,
        'Purchases.setLogLevel',
      );
    } catch (e) {
      diagError('initIAP: debug log level unavailable:', e);
    }

    const appUserId = getAppUserId();
    diagLog('initIAP: configuring SDK...');
    await withTimeout(
      Purchases.configure({ apiKey, appUserID: appUserId, diagnosticsEnabled: true }),
      PURCHASE_TIMEOUT_MS,
      'Purchases.configure',
    );
    _initialized = true;
    diagLog('initIAP: SDK initialised successfully');
  } catch (e) {
    diagError('initIAP: configure() failed:', e);
    _initialized = false;
    throw e;
  }
}

// --- Browser-safe base64url decoder ------------------------------------------------

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  return atob(base64);
}

// --- Helpers -----------------------------------------------------------------------

const PURCHASE_TIMEOUT_MS = 30_000;
const INIT_TIMEOUT_MS = 15_000;
const PRE_SHEET_WATCHDOG_MS = 15_000;
const PURCHASE_CALLBACK_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('[IAP] ' + label + ' timed out after ' + ms + 'ms')), ms),
    ),
  ]);
}

async function purchaseWithStoreOpeningWatchdog<T>(startPurchase: () => Promise<T>): Promise<T> {
  let listener: PluginListenerHandle | null = null;
  let preSheetTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let callbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  let storeConfirmedOpen = false;
  let lastKnownActive = true;
  let resolveReturnedFromStore: (() => void) | null = null;

  const returnedFromStorePromise = new Promise<void>((resolve) => {
    resolveReturnedFromStore = resolve;
  });

  const cleanup = () => {
    settled = true;
    if (preSheetTimeoutId !== null) clearTimeout(preSheetTimeoutId);
    if (callbackTimeoutId !== null) clearTimeout(callbackTimeoutId);

    // Never await native listener cleanup on the purchase result path. A stuck
    // Capacitor bridge cleanup must not keep the UI in the purchasing state.
    const handle = listener;
    listener = null;
    if (handle) {
      void handle.remove().catch((err) => {
        diagError('purchase: listener cleanup failed:', err);
      });
    }
  };

  try {
    listener = await withTimeout(
      App.addListener('appStateChange', ({ isActive }) => {
        lastKnownActive = isActive;

        // A single false event is not enough to prove that Google Play opened.
        // We confirm the real state after PRE_SHEET_WATCHDOG_MS below.
        if (isActive && storeConfirmedOpen && !settled) {
          setPurchasePhase('RETURNED_FROM_STORE');
          diagLog('purchase: app returned from native store');
          resolveReturnedFromStore?.();
        }
      }),
      2_000,
      'App.addListener(appStateChange)',
    );
  } catch (err) {
    diagError('purchase: appStateChange listener unavailable:', err);
  }

  // Install the listener before invoking the native SDK so fast Activity changes
  // cannot be missed.
  setPurchasePhase('PURCHASE_CALLED');
  const purchasePromise = startPurchase();
  const wrappedPurchase = purchasePromise.then(
    (result) => ({ kind: 'result' as const, result }),
    (error: unknown) => ({ kind: 'error' as const, error }),
  );

  const preSheetCheck = new Promise<
    { kind: 'store-confirmed' } | { kind: 'store-did-not-open' }
  >((resolve) => {
    preSheetTimeoutId = setTimeout(() => {
      void (async () => {
        let appIsActive = lastKnownActive;
        try {
          const state = await withTimeout(App.getState(), 2_000, 'App.getState');
          appIsActive = state.isActive;
          lastKnownActive = state.isActive;
        } catch (err) {
          diagError('purchase: unable to read current app state:', err);
        }

        const webViewVisible =
          typeof document === 'undefined' ||
          (document.visibilityState === 'visible' && document.hidden === false);

        // Treat the app as still visible when either lifecycle signal says it is.
        // Some Android devices can temporarily report App.getState().isActive=false
        // while the Capacitor WebView remains visible. Requiring both signals to be
        // visible would incorrectly confirm that Google Play opened and could leave
        // the purchase promise waiting forever.
        if (appIsActive || webViewVisible) {
          resolve({ kind: 'store-did-not-open' });
          return;
        }

        storeConfirmedOpen = true;
        setPurchasePhase('STORE_CONFIRMED_OPEN');
        diagLog('purchase: native store confirmed open after watchdog check');

        // The app may have returned between App.getState() and this assignment.
        if (lastKnownActive) resolveReturnedFromStore?.();
        resolve({ kind: 'store-confirmed' });
      })();
    }, PRE_SHEET_WATCHDOG_MS);
  });

  const first = await Promise.race([wrappedPurchase, preSheetCheck]);

  if (first.kind === 'result') {
    setPurchasePhase('PURCHASE_CALLBACK');
    cleanup();
    return first.result;
  }
  if (first.kind === 'error') {
    cleanup();
    throw first.error;
  }
  if (first.kind === 'store-did-not-open') {
    cleanup();
    throw new Error('[IAP] STORE_DID_NOT_OPEN: Google Play purchase screen did not open.' + diagnosticSuffix());
  }

  // Google Play was genuinely outside the visible app at the 15-second check.
  // Wait without a limit while the store UI is open. Once the app returns, the
  // native SDK gets 8 seconds to deliver its callback.
  const callbackTimeout = returnedFromStorePromise.then(
    () =>
      new Promise<{ kind: 'callback-timeout' }>((resolve) => {
        callbackTimeoutId = setTimeout(
          () => resolve({ kind: 'callback-timeout' }),
          PURCHASE_CALLBACK_TIMEOUT_MS,
        );
      }),
  );

  const afterStore = await Promise.race([wrappedPurchase, callbackTimeout]);

  if (afterStore.kind === 'result') {
    setPurchasePhase('PURCHASE_CALLBACK');
    cleanup();
    return afterStore.result;
  }
  if (afterStore.kind === 'error') {
    cleanup();
    throw afterStore.error;
  }

  cleanup();
  // A late native rejection is already observed by wrappedPurchase, so it cannot
  // become an unhandled promise rejection after the UI has reset.
  throw new Error('[IAP] PURCHASE_CALLBACK_TIMEOUT: Store closed but RevenueCat did not return a result.' + diagnosticSuffix());
}

// --- Core operations ----------------------------------------------------------------

export type IAPFailureCode =
  | 'purchase_system_unavailable'
  | 'restore_failed';

export type IAPResult =
  | { success: true; isPro: boolean; token?: string }
  | {
    success: false;
    cancelled: boolean;
    message: string;
    errorCode?: IAPFailureCode;
    entitlementActive?: boolean;
  };

const PRO_TOKEN_KEY = 'cvpro-pro-token';
const PURCHASE_SYSTEM_UNAVAILABLE_MESSAGE =
  'Purchases are temporarily unavailable. Please update the app or contact support.';

class IAPConfigurationError extends Error {
  readonly code = 'purchase_system_unavailable' as const;
}

function isPurchaseSystemConfigurationError(error: unknown): boolean {
  if (error instanceof IAPConfigurationError) return true;
  const message = error instanceof Error ? error.message : String(error || '');
  return /(?:must be configured|not configured|configure\(\)|purchases? plugin unavailable)/iu.test(message);
}

function purchaseSystemUnavailableResult(): IAPResult {
  return {
    success: false,
    cancelled: false,
    errorCode: 'purchase_system_unavailable',
    message: PURCHASE_SYSTEM_UNAVAILABLE_MESSAGE,
  };
}
const PRO_AUTHORIZATION_SYNC_ERROR =
  'Pro entitlement is active, but AI authorization is temporarily unavailable. Please try again in a moment.';

export type EntitlementSyncResult = 'active' | 'inactive' | 'failed';
export type TokenSyncResult = 'success' | 'failed' | 'not-run';

export interface ProEntitlementSyncResult {
  entitlementResult: EntitlementSyncResult;
  tokenSyncLastResult: TokenSyncResult;
  tokenSyncLastError?: string;
  isPro: boolean;
  token?: string;
}

function clearStoredProToken() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PRO_TOKEN_KEY);
  } catch {}
}

function persistStoredProToken(token: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRO_TOKEN_KEY, token);
  } catch {}
}

function decodeTokenIsPro(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const payloadPart = token.split('.')[0];
    if (!payloadPart) return false;
    const decoded = JSON.parse(base64UrlDecode(payloadPart));
    return decoded.isPro === true;
  } catch {
    return false;
  }
}

async function verifyProWithServer(): Promise<IAPResult> {
  const appUserId = getAppUserId();
  diagLog('verifyProWithServer: calling /api/verify-pro');
  try {
    const { data, response: res } = await apiFetch<{ token?: string; error?: string }>(
      '/api/verify-pro',
      { method: 'POST', body: { revenueCatAppUserId: appUserId } },
    );

    if (!res.ok || !data.token) {
      diagError('verifyProWithServer: server returned', res.status, data?.error ?? 'no token');
      return { success: false, cancelled: false, message: data?.error || 'Server verification failed.' };
    }

    diagLog('verifyProWithServer: token received');
    const isPro = decodeTokenIsPro(data.token);

    if (isPro) {
      persistStoredProToken(data.token);
    } else {
      clearStoredProToken();
    }

    diagLog('verifyProWithServer: isPro =', isPro);
    return { success: true, isPro, token: isPro ? data.token : undefined };
  } catch (err) {
    diagError('verifyProWithServer: fetch threw:', err);
    return { success: false, cancelled: false, message: err instanceof Error ? err.message : 'Verification failed.' };
  }
}

async function syncTokenForEntitlement(hasEntitlement: boolean): Promise<ProEntitlementSyncResult> {
  if (!hasEntitlement) {
    clearStoredProToken();
    return {
      entitlementResult: 'inactive',
      tokenSyncLastResult: 'not-run',
      isPro: false,
    };
  }

  const serverResult = await verifyProWithServer();
  if (serverResult.success && serverResult.isPro && serverResult.token) {
    return {
      entitlementResult: 'active',
      tokenSyncLastResult: 'success',
      isPro: true,
      token: serverResult.token,
    };
  }

  clearStoredProToken();
  const tokenSyncLastError = serverResult.success
    ? 'Server verification did not return a Pro token for the active entitlement.'
    : serverResult.message;
  return {
    entitlementResult: 'active',
    tokenSyncLastResult: 'failed',
    tokenSyncLastError,
    isPro: false,
  };
}

export async function syncProEntitlement(): Promise<ProEntitlementSyncResult> {
  if (!isNative()) {
    const token = typeof window !== 'undefined' ? localStorage.getItem(PRO_TOKEN_KEY) : null;
    if (decodeTokenIsPro(token)) {
      return {
        entitlementResult: 'active',
        tokenSyncLastResult: 'success',
        isPro: true,
        token: token ?? undefined,
      };
    }
    clearStoredProToken();
    return {
      entitlementResult: 'inactive',
      tokenSyncLastResult: 'not-run',
      isPro: false,
    };
  }

  try {
    await withTimeout(initIAP(), INIT_TIMEOUT_MS, 'initIAP (from syncProEntitlement)');
    if (!_initialized) {
      throw new IAPConfigurationError('RevenueCat did not become ready for entitlement sync.');
    }
    const Purchases = getPurchases();
    const { customerInfo } = await Purchases.getCustomerInfo();
    const hasEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
    return await syncTokenForEntitlement(hasEntitlement);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Entitlement check failed.';
    const message = isPurchaseSystemConfigurationError(err)
      ? PURCHASE_SYSTEM_UNAVAILABLE_MESSAGE
      : rawMessage;
    diagError('syncProEntitlement: failed:', rawMessage);
    return {
      entitlementResult: 'failed',
      tokenSyncLastResult: 'not-run',
      tokenSyncLastError: message,
      isPro: false,
    };
  }
}

export async function purchasePro(): Promise<IAPResult> {
  _revenueCatHint = 'NONE';
  setPurchasePhase('IDLE');
  diagLog('purchasePro: started');

  if (!isNative()) {
    diagLog('purchasePro: not native');
    return { success: false, cancelled: false, message: 'Native purchases are only available in the Android or iPhone app.' };
  }

  if (!_initialized) {
    diagLog('purchasePro: SDK not initialised — attempting init...');
    try {
      await withTimeout(initIAP(), INIT_TIMEOUT_MS, 'initIAP (from purchasePro)');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Purchase system init failed.';
      diagError('purchasePro: init failed:', msg);
      if (isPurchaseSystemConfigurationError(err)) return purchaseSystemUnavailableResult();
      return { success: false, cancelled: false, message: msg };
    }
    if (!_initialized) {
      diagError('purchasePro: SDK still not initialised after initIAP call');
      return purchaseSystemUnavailableResult();
    }
  }

  // No timeout around the active purchase sheet (requirement #8).
  // Timeout is allowed only for initialization and offerings retrieval.
  try {
    return await corePurchaseFlow();
  } catch (err: unknown) {
    // RevenueCat SDK throws structured errors with userCancelled.
    const rcErr = err as Record<string, unknown> | null;
    if (rcErr && rcErr['userCancelled'] === true) {
      diagLog('purchasePro: user cancelled');
      return { success: false, cancelled: true, message: 'Purchase cancelled.' };
    }
    const baseMessage = rcErr && typeof rcErr['message'] === 'string' ? rcErr['message'] : 'Purchase failed. Please try again.';
    const msg = baseMessage.includes('[phase=') ? baseMessage : baseMessage + diagnosticSuffix();
    diagError('purchasePro: error:', msg);
    if (isPurchaseSystemConfigurationError(err)) return purchaseSystemUnavailableResult();
    return { success: false, cancelled: false, message: msg };
  }
}

async function corePurchaseFlow(): Promise<IAPResult> {
  let Purchases: ReturnType<typeof getPurchases>;
  try {
    Purchases = getPurchases();
  } catch (err) {
    throw err;
  }

  setPurchasePhase('BILLING_CHECK');
  diagLog('corePurchaseFlow: checking billing availability...');
  try {
    const billing = await withTimeout(
      Purchases.canMakePayments(),
      INIT_TIMEOUT_MS,
      'canMakePayments',
    );
    if (!billing.canMakePayments) {
      return {
        success: false,
        cancelled: false,
        message: 'Google Play billing is unavailable on this device or account.',
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to check Google Play billing.';
    diagError('corePurchaseFlow: billing preflight failed:', message);
    return { success: false, cancelled: false, message };
  }

  setPurchasePhase('OFFERINGS_FETCH');
  diagLog('corePurchaseFlow: fetching offerings (with timeout)...');
  let offerings;
  try {
    offerings = await withTimeout(Purchases.getOfferings(), PURCHASE_TIMEOUT_MS, 'getOfferings');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch offerings.';
    diagError('corePurchaseFlow: getOfferings failed:', msg);
    return { success: false, cancelled: false, message: msg };
  }
  const current = offerings.current;

  if (!current) {
    diagError('corePurchaseFlow: no current offering found');
    diagLog('corePurchaseFlow: offering identifiers:', Object.keys(offerings.all));
    return { success: false, cancelled: false, message: 'No offerings available. Please try again later.' };
  }

  diagLog('corePurchaseFlow: current offering id:', current.identifier);
  diagLog('corePurchaseFlow: available package ids:', current.availablePackages.map((p) => p.identifier));
  diagLog('corePurchaseFlow: available product ids:', current.availablePackages.map((p) => p.product.identifier));

  const lifetimePackage =
    current.availablePackages.find((pkg) => pkg.identifier === PACKAGE_IDENTIFIER) ??
    current.availablePackages.find((pkg) => pkg.product.identifier === PRO_PRODUCT_ID) ??
    null;

  let purchasePackageObj = lifetimePackage;

  if (!purchasePackageObj) {
    diagLog('corePurchaseFlow: searching all offerings...');
    for (const offeringKey of Object.keys(offerings.all)) {
      const offering = offerings.all[offeringKey];
      const found = offering.availablePackages.find(
        (pkg) => pkg.identifier === PACKAGE_IDENTIFIER || pkg.product.identifier === PRO_PRODUCT_ID,
      );
      if (found) {
        purchasePackageObj = found;
        diagLog('corePurchaseFlow: found in offering:', offeringKey);
        break;
      }
    }
    if (!purchasePackageObj) {
      diagError('corePurchaseFlow: lifetime package not found');
      return { success: false, cancelled: false, message: 'Lifetime package not found in store. Check RevenueCat dashboard.' };
    }
  }

  if (purchasePackageObj.product.identifier !== PRO_PRODUCT_ID) {
    return {
      success: false,
      cancelled: false,
      message: 'Configured Google Play product does not match the Pro product.',
    };
  }

  _storePrice = purchasePackageObj.product.priceString ?? null;
  if (!_storePrice) {
    return {
      success: false,
      cancelled: false,
      message: 'Google Play product price is unavailable. Please try again later.',
    };
  }

  diagLog('corePurchaseFlow: price:', _storePrice);
  setPurchasePhase('PACKAGE_SELECTED');
  diagLog('corePurchaseFlow: selected package:', purchasePackageObj.identifier);
  diagLog('corePurchaseFlow: selected product:', purchasePackageObj.product.identifier);

  diagLog('corePurchaseFlow: launching purchase sheet...');
  // The selected item came from RevenueCat Offerings, so purchase the
  // PurchasesPackage itself on every platform. RevenueCat documents
  // purchaseStoreProduct for products fetched directly with getProducts().
  const result = await purchaseWithStoreOpeningWatchdog(() =>
    Purchases.purchasePackage({ aPackage: purchasePackageObj }),
  );

  const hasEntitlement = result.customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
  diagLog('corePurchaseFlow: purchase completed, entitlement found:', hasEntitlement);

  if (!hasEntitlement) {
    diagError('corePurchaseFlow: entitlement not found after purchase');
    diagLog('corePurchaseFlow: active entitlements:', Object.keys(result.customerInfo.entitlements.active));
    return {
      success: false, cancelled: false,
      message: 'Purchase completed but entitlement not found. Please try Restore or contact support.',
    };
  }

  setPurchasePhase('SERVER_VERIFY');
  diagLog('corePurchaseFlow: verifying with server...');
  const syncResult = await syncTokenForEntitlement(true);

  if (!syncResult.isPro || !syncResult.token) {
    diagError('corePurchaseFlow: server verification failed');
    return {
      success: false,
      cancelled: false,
      entitlementActive: true,
      message: syncResult.tokenSyncLastError || PRO_AUTHORIZATION_SYNC_ERROR,
    };
  }

  setPurchasePhase('COMPLETE');
  diagLog('corePurchaseFlow: fully verified - Pro active');
  return { success: true, isPro: true, token: syncResult.token };
}

export async function restorePro(): Promise<IAPResult> {
  diagLog('restorePro: started');
  if (!isNative()) {
    const token = typeof window !== 'undefined' ? localStorage.getItem(PRO_TOKEN_KEY) : null;
    return { success: true, isPro: decodeTokenIsPro(token), token: decodeTokenIsPro(token) ? token ?? undefined : undefined };
  }
  try {
    // Restore is a public entry point and may be called before the React hook's
    // mount effect finishes. Always share/await the same initialization promise
    // instead of calling the native SDK in an unconfigured state.
    await withTimeout(initIAP(), INIT_TIMEOUT_MS, 'initIAP (from restorePro)');
    if (!_initialized) {
      throw new IAPConfigurationError('RevenueCat did not become ready for restore.');
    }

    const Purchases = getPurchases();
    diagLog('restorePro: calling restorePurchases...');
    const { customerInfo } = await Purchases.restorePurchases();
    const hasEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
    diagLog('restorePro: entitlement found:', hasEntitlement);
    const syncResult = await syncTokenForEntitlement(hasEntitlement);
    if (!hasEntitlement) return { success: true, isPro: false };
    if (!syncResult.isPro || !syncResult.token) {
      return {
        success: false,
        cancelled: false,
        entitlementActive: true,
        message: syncResult.tokenSyncLastError || PRO_AUTHORIZATION_SYNC_ERROR,
      };
    }
    return { success: true, isPro: true, token: syncResult.token };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Restore failed. Please try again.';
    diagError('restorePro: failed:', msg);
    if (isPurchaseSystemConfigurationError(err)) return purchaseSystemUnavailableResult();
    return {
      success: false,
      cancelled: false,
      errorCode: 'restore_failed',
      message: 'Restore failed. Please try again or contact support.',
    };
  }
}

export async function checkProEntitlement(): Promise<boolean> {
  const result = await syncProEntitlement();
  return result.isPro === true && result.tokenSyncLastResult === 'success';
}

// --- React hook -------------------------------------------------------------------

export interface UseIAPReturn {
  isNativeApp: boolean;
  purchasing: boolean;
  purchase: () => Promise<IAPResult>;
  restore: () => Promise<IAPResult>;
  productPrice: string | null;
}

export function useIAP(): UseIAPReturn {
  const [purchasing, setPurchasing] = useState(false);
  const [productPrice, setProductPrice] = useState<string | null>(null);
  const purchaseLockRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        await initIAP();
        if (isNative()) {
          const price = await refreshStorePrice();
          if (price) setProductPrice(price);
        }
      } catch (e) {
        console.warn('[useIAP] initIAP failed (will retry on purchase):', e);
      }
    })();
  }, []);

  const purchase = useCallback(async (): Promise<IAPResult> => {
    if (purchaseLockRef.current) {
      diagLog('useIAP.purchase: duplicate tap ignored');
      return { success: false, cancelled: true, message: 'Purchase already in progress.' };
    }
    purchaseLockRef.current = true;
    setPurchasing(true);
    try {
      const result = await purchasePro();
      if (result.success && isNative()) {
        try {
          const price = await refreshStorePrice();
          if (price) setProductPrice(price);
        } catch {}
      }
      return result;
    } finally {
      // Always clear loading state. try/catch prevents React state updates
      // from throwing if the component has truly unmounted.
      try { setPurchasing(false); } catch {}
      purchaseLockRef.current = false;
    }
  }, []);

  const restore = useCallback(async (): Promise<IAPResult> => {
    if (purchaseLockRef.current) {
      return { success: false, cancelled: true, message: 'Purchase already in progress.' };
    }
    purchaseLockRef.current = true;
    setPurchasing(true);
    try {
      return await restorePro();
    } finally {
      try { setPurchasing(false); } catch {}
      purchaseLockRef.current = false;
    }
  }, []);

  return { isNativeApp: isNative(), purchasing, purchase, restore, productPrice };
}
