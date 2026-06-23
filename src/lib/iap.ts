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
import { Capacitor } from '@capacitor/core';
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

// --- RevenueCat lazy-loader ------------------------------------------------------

let _purchasesModule: typeof import('@revenuecat/purchases-capacitor') | null = null;

async function getPurchases() {
  if (!_purchasesModule) {
    _purchasesModule = await import('@revenuecat/purchases-capacitor');
  }
  return _purchasesModule.Purchases;
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

export function getStorePrice(): string | null {
  return _storePrice;
}

export async function refreshStorePrice(): Promise<string | null> {
  const platform = getPlatform();
  if (platform === 'web') return null;

  try {
    const Purchases = await getPurchases();
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
    throw new Error('RevenueCat API key not configured. Check NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY.');
  }

  const Purchases = await getPurchases();

  try {
    const appUserId = getAppUserId();
    diagLog('initIAP: configuring SDK...');
    await withTimeout(
      Purchases.configure({ apiKey, appUserID: appUserId }),
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('[IAP] ' + label + ' timed out after ' + ms + 'ms')), ms),
    ),
  ]);
}

// --- Core operations ----------------------------------------------------------------

export type IAPResult =
  | { success: true; isPro: boolean; token?: string }
  | { success: false; cancelled: boolean; message: string };

const PRO_TOKEN_KEY = 'cvpro-pro-token';

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
    try {
      localStorage.setItem(PRO_TOKEN_KEY, data.token);
    } catch {}

    let isPro = false;
    try {
      const payloadPart = data.token.split('.')[0];
      if (payloadPart) {
        const decoded = JSON.parse(base64UrlDecode(payloadPart));
        isPro = decoded.isPro === true;
      }
    } catch {}

    diagLog('verifyProWithServer: isPro =', isPro);
    return { success: true, isPro, token: data.token };
  } catch (err) {
    diagError('verifyProWithServer: fetch threw:', err);
    return { success: false, cancelled: false, message: err instanceof Error ? err.message : 'Verification failed.' };
  }
}

export async function purchasePro(): Promise<IAPResult> {
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
      return { success: false, cancelled: false, message: msg };
    }
    if (!_initialized) {
      diagError('purchasePro: SDK still not initialised after initIAP call');
      return { success: false, cancelled: false, message: 'Purchase system is not ready. Please try again later.' };
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
    const msg = rcErr && typeof rcErr['message'] === 'string' ? rcErr['message'] : 'Purchase failed. Please try again.';
    diagError('purchasePro: error:', msg);
    return { success: false, cancelled: false, message: msg };
  }
}

async function corePurchaseFlow(): Promise<IAPResult> {
  const Purchases = await getPurchases();

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

  _storePrice = purchasePackageObj.product.priceString ?? null;
  diagLog('corePurchaseFlow: price:', _storePrice);
  diagLog('corePurchaseFlow: selected package:', purchasePackageObj.identifier);
  diagLog('corePurchaseFlow: selected product:', purchasePackageObj.product.identifier);

  diagLog('corePurchaseFlow: launching purchase sheet...');
  // No timeout around the active Google Play purchase sheet.
  // The user controls how long the purchase sheet stays open.
  const result = await Purchases.purchasePackage({ aPackage: purchasePackageObj });

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

  diagLog('corePurchaseFlow: verifying with server...');
  const serverResult = await verifyProWithServer();
  const serverToken = 'token' in serverResult ? serverResult.token : undefined;

  if (!serverResult.success || !serverResult.isPro) {
    diagError('corePurchaseFlow: server verification failed');
    return { success: true, isPro: false, token: serverToken };
  }

  diagLog('corePurchaseFlow: fully verified - Pro active');
  return { success: true, isPro: true, token: serverToken };
}

export async function restorePro(): Promise<IAPResult> {
  diagLog('restorePro: started');
  if (!isNative()) {
    const hadPro = typeof window !== 'undefined' && localStorage.getItem('cvpro-plan') === 'pro';
    return { success: true, isPro: hadPro };
  }
  try {
    const Purchases = await getPurchases();
    diagLog('restorePro: calling restorePurchases...');
    const { customerInfo } = await Purchases.restorePurchases();
    const hasEntitlement = customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;
    diagLog('restorePro: entitlement found:', hasEntitlement);
    if (!hasEntitlement) return { success: true, isPro: false };
    return await verifyProWithServer();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Restore failed. Please try again.';
    diagError('restorePro: failed:', msg);
    return { success: false, cancelled: false, message: msg };
  }
}

export async function checkProEntitlement(): Promise<boolean> {
  if (!isNative()) {
    try {
      const token = localStorage.getItem(PRO_TOKEN_KEY);
      if (!token) return false;
      const payloadPart = token.split('.')[0];
      if (!payloadPart) return false;
      const decoded = JSON.parse(base64UrlDecode(payloadPart));
      const { isPro, exp } = decoded as { isPro?: boolean; exp?: number };
      if (isPro !== true) return false;
      if (exp && Date.now() >= exp) {
        localStorage.removeItem(PRO_TOKEN_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  try {
    const Purchases = await getPurchases();
    await Purchases.getCustomerInfo();
    const result = await verifyProWithServer();
    return result.success && result.isPro;
  } catch {
    return false;
  }
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
