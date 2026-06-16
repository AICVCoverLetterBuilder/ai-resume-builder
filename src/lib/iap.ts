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

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { apiFetch } from './api';

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRO_PRODUCT_ID = 'cv_pro_lifetime';
export const PRO_ENTITLEMENT = 'CV Pro AI Pro';
export const PACKAGE_IDENTIFIER = '$rc_lifetime';
export const OFFERING_IDENTIFIER = 'default';

// ─── App User ID ──────────────────────────────────────────────────────────────

const APP_USER_ID_KEY = 'cvpro_rc_user_id';

/**
 * Generates a random UUID v4 string.
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers), fallback to Math.random
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns a stable anonymous RevenueCat appUserID.
 * The ID is generated once on first call and persisted in localStorage.
 * This ensures the same user identity across app restarts.
 */
export function getAppUserId(): string {
  if (typeof window === 'undefined') return 'web-anonymous';
  try {
    const stored = localStorage.getItem(APP_USER_ID_KEY);
    if (stored) return stored;
  } catch {
    // localStorage unavailable
  }
  const id = generateUUID();
  try {
    localStorage.setItem(APP_USER_ID_KEY, id);
  } catch {
    // localStorage unavailable
  }
  return id;
}

// ─── Platform detection ───────────────────────────────────────────────────────

/**
 * Returns true when running inside a Capacitor native shell (Android or iOS).
 * Returns false when running as a plain web page (browser / SSR).
 */
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

// ─── RevenueCat lazy-loader ───────────────────────────────────────────────────
// We import dynamically so the SDK bundle is not loaded in SSR or plain-web builds.

let _purchasesModule: typeof import('@revenuecat/purchases-capacitor') | null =
  null;

async function getPurchases() {
  if (!_purchasesModule) {
    _purchasesModule = await import('@revenuecat/purchases-capacitor');
  }
  return _purchasesModule.Purchases;
}

// ─── SDK initializer (call once at app startup) ───────────────────────────────

let _initialized = false;
let _storePrice: string | null = null;

// Development-only logging helper — stripped in production builds.
function devLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
}

/**
 * Returns the last-fetched RevenueCat product price string (localized currency).
 * Returns null if not yet fetched or if RevenueCat is unavailable.
 */
export function getStorePrice(): string | null {
  return _storePrice;
}

/**
 * Fetches the lifetime package price from RevenueCat offerings and stores it.
 * Safe to call even before init — will attempt to fetch after init.
 * Returns the price string, or null if unavailable.
 */
export async function refreshStorePrice(): Promise<string | null> {
  const platform = getPlatform();
  if (platform === 'web') return null;

  try {
    const Purchases = await getPurchases();
    const offerings = await withTimeout(
      Purchases.getOfferings(),
      PURCHASE_TIMEOUT_MS,
      'getOfferings',
    );
    const current = offerings.current;
    if (!current) return null;

    const lifetimePackage =
      current.availablePackages.find(
        (pkg) => pkg.identifier === PACKAGE_IDENTIFIER,
      ) ??
      current.availablePackages.find(
        (pkg) => pkg.product.identifier === PRO_PRODUCT_ID,
      ) ??
      null;

    if (lifetimePackage) {
      _storePrice = lifetimePackage.product.priceString ?? null;
      devLog('[IAP] store price:', _storePrice);
      return _storePrice;
    }

    // Fallback: search all offerings
    for (const offeringKey of Object.keys(offerings.all)) {
      const offering = offerings.all[offeringKey];
      const found = offering.availablePackages.find(
        (pkg) =>
          pkg.identifier === PACKAGE_IDENTIFIER ||
          pkg.product.identifier === PRO_PRODUCT_ID,
      );
      if (found) {
        _storePrice = found.product.priceString ?? null;
        devLog('[IAP] store price (from all offerings):', _storePrice);
        return _storePrice;
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[IAP] refreshStorePrice failed:', e);
  }
  return null;
}

/**
 * Initialises the RevenueCat SDK.
 * Safe to call multiple times — subsequent calls are no-ops.
 * Must be called before any purchase or restore operation.
 *
 * On native: configures RevenueCat with the platform-specific API key
 *            and the stable anonymous appUserID.
 * On web:    no-op.
 *
 * Throws if the SDK fails to initialise (caller should catch).
 */
export async function initIAP(): Promise<void> {
  if (_initialized) return;
  const platform = getPlatform();
  if (platform === 'web') return; // Nothing to initialise on web

  // Use the public Android API key from env var
  const apiKey =
    platform === 'ios'
      ? (process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? '')
      : (process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '');

  if (!apiKey) {
    console.warn(
      '[IAP] RevenueCat API key not configured. ' +
        'Set NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY / NEXT_PUBLIC_REVENUECAT_IOS_KEY.',
    );
    throw new Error('RevenueCat API key not configured. Check NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY.');
  }

  const Purchases = await getPurchases();

  try {
    // Use stable appUserID so RevenueCat remembers the user across launches
    const appUserId = getAppUserId();
    await withTimeout(
      Purchases.configure({ apiKey, appUserID: appUserId }),
      PURCHASE_TIMEOUT_MS,
      'Purchases.configure',
    );
    _initialized = true;
    devLog('[IAP] SDK initialised successfully');
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.error('[IAP] configure() failed:', e);
    _initialized = false;
    throw e; // Re-throw so the caller can surface the error
  }
}

// ─── Browser-safe base64url decoder ───────────────────────────────────────────

function base64UrlDecode(str: string): string {
  // Convert base64url (RFC 4648 §5) to standard base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (base64.length % 4 !== 0) base64 += '=';
  return atob(base64);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PURCHASE_TIMEOUT_MS = 30_000;
const GLOBAL_PURCHASE_TIMEOUT_MS = 60_000; // 60s global timeout for the entire flow

/**
 * Wraps a promise with a timeout rejection.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[IAP] ${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ─── Core operations ──────────────────────────────────────────────────────────

export type IAPResult =
  | { success: true; isPro: boolean; token?: string }
  | { success: false; cancelled: boolean; message: string };

const PRO_TOKEN_KEY = 'cvpro-pro-token';

/**
 * Calls /api/verify-pro with the current RevenueCat appUserID.
 * The server validates the entitlement via RevenueCat REST API and
 * returns an HMAC-signed Pro token. The token is the authoritative
 * source of Pro status — the client never trusts its local state.
 */
async function verifyProWithServer(): Promise<IAPResult> {
  const appUserId = getAppUserId();
  try {
    const { data, response: res } = await apiFetch<{
      token?: string;
      error?: string;
    }>('/api/verify-pro', {
      method: 'POST',
      body: { revenueCatAppUserId: appUserId },
    });

    if (!res.ok || !data.token) {
      return {
        success: false,
        cancelled: false,
        message: data.error || 'Server verification failed.',
      };
    }

    // Store the signed token
    try {
      localStorage.setItem(PRO_TOKEN_KEY, data.token);
    } catch {
      // localStorage unavailable
    }

    // The token encodes isPro — we decode it here to return a quick result
    // but the authoritative check always happens server-side via verifyProToken
    let isPro = false;
    try {
      const payloadPart = data.token.split('.')[0];
      if (payloadPart) {
        const decoded = JSON.parse(base64UrlDecode(payloadPart));
        isPro = decoded.isPro === true;
      }
    } catch {
      // Malformed token — treat as non-Pro
    }

    return { success: true, isPro, token: data.token };
  } catch (err) {
    return {
      success: false,
      cancelled: false,
      message:
        err instanceof Error ? err.message : 'Verification failed. Please try again.',
    };
  }
}

/**
 * Triggers the native in-app purchase flow for the `cv_pro_lifetime` product.
 *
 * After a successful purchase, calls /api/verify-pro for server-side
 * entitlement validation and returns the signed Pro token.
 *
 * Returns:
 *   { success: true, isPro: true, token }  — purchase verified & Pro token issued
 *   { success: false, cancelled }           — user cancelled or purchase failed
 */
export async function purchasePro(): Promise<IAPResult> {
  if (!isNative()) {
    return {
      success: false,
      cancelled: false,
      message:
        'Native purchases are only available in the Android or iPhone app.',
    };
  }

  // Ensure the SDK is initialised before proceeding.
  // If initIAP() has not been called (or failed), try once more.
  if (!_initialized) {
    devLog('[IAP] purchasePro: SDK not initialised — attempting init...');
    try {
      await initIAP();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Purchase system init failed.';
      if (process.env.NODE_ENV !== 'production') console.error('[IAP] purchasePro: init failed:', msg);
      return { success: false, cancelled: false, message: msg };
    }
    if (!_initialized) {
      return {
        success: false,
        cancelled: false,
        message: 'Purchase system is not ready. Please try again later.',
      };
    }
  }

  try {
    // Wrap the entire purchase flow in a global timeout
    return await withTimeout(corePurchaseFlow(), GLOBAL_PURCHASE_TIMEOUT_MS, 'purchasePro');
  } catch (err: unknown) {
    // Timeout errors (includes global timeout)
    if (err instanceof Error && err.message.startsWith('[IAP]')) {
      if (process.env.NODE_ENV !== 'production') console.error('[IAP] purchasePro error:', err.message);
      return {
        success: false,
        cancelled: false,
        message: 'The purchase timed out. Please try again.',
      };
    }
    // RevenueCat throws an object with `userCancelled` when the user dismisses
    const rcErr = err as Record<string, unknown> | null;
    if (rcErr && rcErr['userCancelled'] === true) {
      devLog('[IAP] purchasePro: user cancelled');
      return { success: false, cancelled: true, message: 'Purchase cancelled.' };
    }
    const msg =
      rcErr && typeof rcErr['message'] === 'string'
        ? rcErr['message']
        : 'Purchase failed. Please try again.';
    if (process.env.NODE_ENV !== 'production') console.error('[IAP] purchasePro error:', msg);
    return { success: false, cancelled: false, message: msg };
  }
}

async function corePurchaseFlow(): Promise<IAPResult> {
  const Purchases = await getPurchases();

  devLog('[IAP] purchasePro: fetching offerings...');
  const offerings = await withTimeout(
    Purchases.getOfferings(),
    PURCHASE_TIMEOUT_MS,
    'getOfferings',
  );
  const current = offerings.current;

  if (!current) {
    if (process.env.NODE_ENV !== 'production') console.warn('[IAP] purchasePro: no current offering found');
    return {
      success: false,
      cancelled: false,
      message: 'No offerings available. Please try again later.',
    };
  }

  // Find the $rc_lifetime package in the default offering
  const lifetimePackage =
    current.availablePackages.find(
      (pkg) => pkg.identifier === PACKAGE_IDENTIFIER,
    ) ??
    current.availablePackages.find(
      (pkg) => pkg.product.identifier === PRO_PRODUCT_ID,
    ) ??
    null;

  let purchasePackage = lifetimePackage;

  if (!purchasePackage) {
    // Fallback: search all offerings
    devLog('[IAP] purchasePro: searching all offerings for lifetime package...');
    for (const offeringKey of Object.keys(offerings.all)) {
      const offering = offerings.all[offeringKey];
      const found = offering.availablePackages.find(
        (pkg) =>
          pkg.identifier === PACKAGE_IDENTIFIER ||
          pkg.product.identifier === PRO_PRODUCT_ID,
      );
      if (found) {
        purchasePackage = found;
        break;
      }
    }
    if (!purchasePackage) {
      if (process.env.NODE_ENV !== 'production') console.warn('[IAP] purchasePro: lifetime package not found in any offering');
      return {
        success: false,
        cancelled: false,
        message: `Lifetime package not found in store. Check RevenueCat dashboard.`,
      };
    }
  }

  // Store the price for display
  _storePrice = purchasePackage.product.priceString ?? null;
  devLog('[IAP] purchasePro: product price:', _storePrice);

  devLog('[IAP] purchasePro: launching purchase sheet...');
  const result = await withTimeout(
    Purchases.purchasePackage({ aPackage: purchasePackage }),
    PURCHASE_TIMEOUT_MS,
    'purchasePackage',
  );

  // Check local entitlement as a quick confirmation
  const hasEntitlement =
    result.customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

  if (!hasEntitlement) {
    if (process.env.NODE_ENV !== 'production') console.warn('[IAP] purchasePro: entitlement not found after purchase');
    return {
      success: false,
      cancelled: false,
      message:
        'Purchase completed but entitlement not found. Please try Restore or contact support.',
    };
  }

  devLog('[IAP] purchasePro: purchase succeeded, verifying with server...');

  // ═══════════════════════════════════════════════════════════════
  // Server-side verification — the authoritative Pro status check
  // ═══════════════════════════════════════════════════════════════
  const serverResult = await verifyProWithServer();
  const serverToken = 'token' in serverResult ? serverResult.token : undefined;

  if (!serverResult.success || !serverResult.isPro) {
    if (process.env.NODE_ENV !== 'production') console.warn('[IAP] purchasePro: server verification failed after client success');
    return {
      success: true,
      isPro: false,
      token: serverToken,
    };
  }

  devLog('[IAP] purchasePro: fully verified — Pro active');
  return { success: true, isPro: true, token: serverToken };
}

/**
 * Restores previous purchases and validates Pro entitlement via the server.
 *
 * Returns:
 *   { success: true, isPro: true, token }  — entitlement restored and verified
 *   { success: true, isPro: false }        — restore succeeded but no active Pro
 *   { success: false, ... }                — restore failed
 */
export async function restorePro(): Promise<IAPResult> {
  if (!isNative()) {
    // Web fallback
    const hadPro =
      typeof window !== 'undefined' &&
      localStorage.getItem('cvpro-plan') === 'pro';
    return { success: true, isPro: hadPro };
  }

  try {
    const Purchases = await getPurchases();
    const { customerInfo } = await Purchases.restorePurchases();

    // Quick local check
    const hasEntitlement =
      customerInfo.entitlements.active[PRO_ENTITLEMENT] !== undefined;

    if (!hasEntitlement) {
      return {
        success: true,
        isPro: false,
      };
    }

    // Server-side verification
    const serverResult = await verifyProWithServer();

    if (!serverResult.success) {
      return {
        success: true,
        isPro: false,
      };
    }

    return serverResult;
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : 'Restore failed. Please try again.';
    return { success: false, cancelled: false, message: msg };
  }
}

/**
 * Checks the current customer's entitlements without making a purchase.
 * On native: refreshes customer info from RevenueCat and calls the server
 *            for authoritative verification.
 * On web:    checks the cached Pro token in localStorage.
 */
export async function checkProEntitlement(): Promise<boolean> {
  if (!isNative()) {
    // On web, check if a valid Pro token exists in localStorage
    try {
      const token = localStorage.getItem(PRO_TOKEN_KEY);
      if (!token) return false;
      const payloadPart = token.split('.')[0];
      if (!payloadPart) return false;
      const decoded = JSON.parse(base64UrlDecode(payloadPart));
      const { isPro, exp } = decoded as { isPro?: boolean; exp?: number };
      if (isPro !== true) return false;
      if (exp && Date.now() >= exp) {
        // Token expired — clear it
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

    // Call server for authoritative check
    const result = await verifyProWithServer();
    return result.success && result.isPro;
  } catch {
    return false;
  }
}

// ─── React hook ───────────────────────────────────────────────────────────────

export interface UseIAPReturn {
  /** True when running inside a native Capacitor shell */
  isNativeApp: boolean;
  /** True while a purchase or restore is in progress */
  purchasing: boolean;
  /** Initiate purchase of cv_pro_lifetime */
  purchase: () => Promise<IAPResult>;
  /** Restore previous purchase */
  restore: () => Promise<IAPResult>;
  /** Localized store price string from RevenueCat (e.g. "$3.99"), or null */
  productPrice: string | null;
}

/**
 * React hook that exposes the IAP purchase and restore actions.
 *
 * Usage:
 *   const { purchase, restore, purchasing, productPrice } = useIAP();
 *   const result = await purchase();
 *   if (result.success && result.isPro) {
 *     // Pro unlocked — token is stored; set isPro in app state
 *   }
 */
export function useIAP(): UseIAPReturn {
  const [purchasing, setPurchasing] = useState(false);
  const [productPrice, setProductPrice] = useState<string | null>(null);

  // Initialise SDK once on mount (native only)
  useEffect(() => {
    (async () => {
      try {
        await initIAP();
        if (isNative()) {
          const price = await refreshStorePrice();
          if (price) setProductPrice(price);
        }
      } catch (e) {
        // initIAP already logs the error; nothing more to surface here.
        // purchasePro() will attempt re-init and return a user-facing error.
        console.warn('[useIAP] initIAP failed (will retry on purchase):', e);
      }
    })();
  }, []);

  const purchase = useCallback(async (): Promise<IAPResult> => {
    setPurchasing(true);
    try {
      const result = await purchasePro();
      // Refresh price after purchase in case product info changed
      if (result.success && isNative()) {
        const price = await refreshStorePrice();
        if (price) setProductPrice(price);
      }
      return result;
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async (): Promise<IAPResult> => {
    setPurchasing(true);
    try {
      return await restorePro();
    } finally {
      setPurchasing(false);
    }
  }, []);

  return { isNativeApp: isNative(), purchasing, purchase, restore, productPrice };
}