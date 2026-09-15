'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { CVData, CoverLetterData } from './types';
import {
  syncProEntitlement,
  type EntitlementSyncResult,
  type TokenSyncResult,
} from './iap';
import {
  AI_PRO_TOKEN_OPERATION_LEASE_MS,
  isUsableProToken,
  readProTokenEntitlementSource,
  type ProEntitlementSource,
} from './pro-token-client';
import { Capacitor } from '@capacitor/core';
import {
  fingerprintProToken,
  isInternalProAuthDiagnosticsEnabled,
  tokenLifetimeBucket,
  updateInternalProBootstrapObservation,
  type ProAuthObservation,
} from './pro-auth-diagnostics';
import {
  saveCvDraft,
  loadCvDraft,
  clearCvDraft,
  saveClDraft,
  loadClDraft,
  clearClDraft,
} from './draft-storage';
import { migrateLegacyCanonicalCv } from './cv-canonical-snapshot';
import {
  AI_USAGE_RESET_EVENT,
  PRO_AI_SAFETY_CAP,
  PRO_AI_WINDOW_MS,
  commitProAiUserAction,
  loadProAiRecord,
  type ProAiUsageCommitResult,
  type ProAiRecord,
} from './ai-usage-policy';

export { PRO_AI_SAFETY_CAP, PRO_AI_WINDOW_MS } from './ai-usage-policy';

// silence unused when only re-exported elsewhere
void PRO_AI_WINDOW_MS;

const PRO_TOKEN_KEY = 'cvpro-pro-token';

function observeAuthPlatform(): Pick<ProAuthObservation, 'authPlatformNative' | 'authPlatformName'> {
  try {
    if (isInternalProAuthDiagnosticsEnabled()) {
      const platform = Capacitor.getPlatform();
      return { authPlatformNative: Capacitor.isNativePlatform(),
        authPlatformName: platform === 'android' || platform === 'ios' || platform === 'web' ? platform : 'unknown' };
    }
  } catch { /* Missing platform evidence cannot affect auth. */ }
  return { authPlatformNative: null, authPlatformName: 'unknown' };
}

type PersonalPhotoFields = {
  originalPhoto?: string;
  circularPhoto?: string;
  rectangularPhoto?: string;
};

function cvPhotoDraftFields(cv: CVData, fallback?: { originalPhoto?: string; circularPhoto?: string; rectangularPhoto?: string }) {
  const personal = cv.personal as typeof cv.personal & PersonalPhotoFields;
  return {
    originalPhoto: personal.originalPhoto ?? fallback?.originalPhoto,
    circularPhoto: personal.circularPhoto ?? fallback?.circularPhoto,
    rectangularPhoto: personal.rectangularPhoto ?? fallback?.rectangularPhoto,
  };
}

export type AiGateResult =
  | { status: 'ready'; token: string }
  | { status: 'syncing'; reason: 'missing-token' | 'token-sync-failed' }
  | { status: 'free' };

interface SetIsProOptions {
  source?: 'purchase' | 'restore' | 'startup';
  entitlementResult?: EntitlementSyncResult;
  tokenSyncLastResult?: TokenSyncResult;
  tokenSyncLastError?: string;
}

interface AppContextType {
  isPro: boolean;
  /** Diagnostic source of the canonical server-issued token. */
  proEntitlementSource: ProEntitlementSource;
  setIsPro: (val: boolean, token?: string | null, options?: SetIsProOptions) => void;
  /** HMAC-signed Pro token for server-side verification. Refreshed every 24h. */
  getProToken: () => string | null;
  getProEntitlementSource: () => ProEntitlementSource;
  /** Current AI authorization gate, read at click time from canonical Pro state. */
  getAiGate: () => AiGateResult;
  /** Internal snapshot of the canonical owner; never authorizes or refreshes. */
  getProAuthObservation: (capturedToken: string) => Promise<ProAuthObservation | undefined>;
  saveCv: (cv: CVData) => void;
  deleteCv: (id: string) => void;
  saveCoverLetter: (cl: CoverLetterData) => void;
  deleteCoverLetter: (id: string) => void;
  currentCv: CVData | null;
  setCurrentCv: (cv: CVData | null) => void;
  /** Persist one complete CV snapshot before publishing it to React state. */
  persistCurrentCvTransactionally: (cv: CVData) => boolean;
  currentCoverLetter: CoverLetterData | null;
  setCurrentCoverLetter: (cl: CoverLetterData | null) => void;
  canDownload: (type: 'cv' | 'cl') => boolean;
  incrementDownloads: (type: 'cv' | 'cl') => void;
  // Cover letter generation tracking
  clGenerationCount: number;
  canGenerateCoverLetter: () => boolean;
  incrementClGeneration: () => void;
  // AI Recommend usage (free = 1 use total)
  aiRecommendUsed: boolean;
  canUseAiRecommend: () => boolean;
  markAiRecommendUsed: () => void;
  // Cover letter regeneration tracking (free = 1 total, persisted)
  clRegenCount: number;
  canRegenerateCoverLetter: () => boolean;
  incrementClRegen: () => void;
  resetClRegen: () => void;
  // Pro safety cap (hidden — configured PRO_AI_SAFETY_CAP per rolling window)
  canUseProAi: () => boolean;
  /** Legacy fire-and-forget Pro AI accounting surface for non-M4 callers. */
  recordProAiSuccess: () => void;
  /** Typed authoritative M4/V3 usage transaction. */
  commitProAiSuccess: () => ProAiUsageCommitResult;
  /** Current Pro AI usage count in the active rolling window (0 when window expired). */
  getProAiUsageCount: () => number;
  // Draft persistence — timestamps for "Draft saved" indicators
  lastCvSavedAt: number;
  lastClSavedAt: number;
  // Clear all persisted drafts
  clearAllDrafts: () => void;
  // Persist CV draft with optional photo data (called by CV builder page)
  persistCurrentDraft: (extra?: { originalPhoto?: string; circularPhoto?: string; rectangularPhoto?: string }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadIsPro(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('cvpro-plan') === 'pro' && isUsableProToken(localStorage.getItem(PRO_TOKEN_KEY));
}

function persistIsPro(val: boolean) {
  if (typeof window === 'undefined') return;
  if (val) localStorage.setItem('cvpro-plan', 'pro');
  else localStorage.removeItem('cvpro-plan');
}

function loadProToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PRO_TOKEN_KEY);
}

function persistProToken(token: string | null | undefined) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(PRO_TOKEN_KEY, token);
  else if (token === null) localStorage.removeItem(PRO_TOKEN_KEY);
}

function loadDownloads(): { cv: number; cl: number } {
  if (typeof window === 'undefined') return { cv: 0, cl: 0 };
  const stored = localStorage.getItem('cvpro-downloads');
  return stored ? JSON.parse(stored) : { cv: 0, cl: 0 };
}

function persistDownloads(d: { cv: number; cl: number }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cvpro-downloads', JSON.stringify(d));
}

function loadClGenerationCount(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem('cvpro-cl-generations');
  return stored ? parseInt(stored, 10) : 0;
}

function persistClGenerationCount(count: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cvpro-cl-generations', String(count));
}

function loadAiRecommendUsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('cvpro-ai-recommend-used') === '1';
}

function persistAiRecommendUsed() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cvpro-ai-recommend-used', '1');
}

function loadClRegenCount(): number {
  if (typeof window === 'undefined') return 0;
  const stored = localStorage.getItem('cvpro-cl-regenerations');
  return stored ? parseInt(stored, 10) : 0;
}

function persistClRegenCount(count: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cvpro-cl-regenerations', String(count));
}

const FREE_DOWNLOAD_LIMIT = 1; // 1 CV/CL download for free users
const FREE_CL_GENERATION_LIMIT = 1; // 1 initial generation for free users
const FREE_CL_REGEN_LIMIT = 1; // 1 cover letter regeneration for free users (persisted)
const FREE_AI_RECOMMEND_LIMIT = 1; // 1 AI template recommend for free users

// ─── Shared Pro gating helper ──────────────────────────────────────────────
// Returns one of:
//   'upgrade'    -> Free user: show Pro upgrade modal
//   'safety_cap' -> Pro user at hidden safety cap: show toast
//   'allowed'    -> Pro user below cap: proceed

export type AccessResult = 'upgrade' | 'safety_cap' | 'allowed';

export function checkProAccess(isPro: boolean, usageCount: number): AccessResult {
  if (!isPro) return 'upgrade';
  if (usageCount >= PRO_AI_SAFETY_CAP) return 'safety_cap';
  return 'allowed';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // internal state is only used when not forced by test env var
  const [internalIsPro, setInternalIsPro] = useState<boolean>(() => loadIsPro());
  const isPro = internalIsPro;
  const [proToken, setProToken] = useState<string | null>(() => (loadIsPro() ? loadProToken() : null));
  const [proEntitlementSource, setProEntitlementSource] = useState<ProEntitlementSource>(() => (
    loadIsPro() ? readProTokenEntitlementSource(loadProToken()) : 'none'
  ));
  const [downloads, setDownloads] = useState<{ cv: number; cl: number }>(() => loadDownloads());
  // Initialize from localStorage drafts for persistence across sessions.
  // Controlled idempotent migration only — never invents English or rewrites on autosave.
  const [currentCv, internalSetCurrentCv] = useState<CVData | null>(() => {
    const draft = loadCvDraft()?.cv ?? null;
    return draft ? migrateLegacyCanonicalCv(draft) : null;
  });
  const [currentCoverLetter, internalSetCurrentCoverLetter] = useState<CoverLetterData | null>(
    () => loadClDraft()?.coverLetter ?? null,
  );
  const [clGenerationCount, setClGenerationCount] = useState<number>(() => loadClGenerationCount());
  const [aiRecommendUsed, setAiRecommendUsed] = useState<boolean>(() => loadAiRecommendUsed());
  const [clRegenCount, setClRegenCount] = useState<number>(() => loadClRegenCount());
  const [proAiRecord, setProAiRecord] = useState<ProAiRecord>(() => loadProAiRecord());

  // Internal-test reset writes localStorage then dispatches this event.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onReset = () => setProAiRecord(loadProAiRecord());
    window.addEventListener(AI_USAGE_RESET_EVENT, onReset);
    return () => window.removeEventListener(AI_USAGE_RESET_EVENT, onReset);
  }, []);
  // Timestamps for "Draft saved" indicator
  // The server cannot see a persisted browser draft. Keep the first client
  // render identical to SSR; real saves update this timestamp below.
  const [lastCvSavedAt, setLastCvSavedAt] = useState<number>(0);
  const [lastClSavedAt, setLastClSavedAt] = useState<number>(() => (currentCoverLetter ? Date.now() : 0));
  const [tokenSyncLastResult, setTokenSyncLastResult] = useState<TokenSyncResult | 'not-run'>('not-run');
  const isProRef = useRef(isPro);
  const proTokenRef = useRef(proToken);
  const tokenSyncLastResultRef = useRef<TokenSyncResult | 'not-run'>(tokenSyncLastResult);
  const proEntitlementSourceRef = useRef<ProEntitlementSource>(proEntitlementSource);
  const tokenSyncSourceRef = useRef<ProAuthObservation['authSyncSource']>('unknown');
  const authPlatformAtSyncRef = useRef<ReturnType<typeof observeAuthPlatform>>({ authPlatformNative: null, authPlatformName: 'unknown' });

  isProRef.current = isPro;
  proTokenRef.current = proToken;
  tokenSyncLastResultRef.current = tokenSyncLastResult;
  proEntitlementSourceRef.current = proEntitlementSource;

  const setIsPro = useCallback((val: boolean, token?: string | null, options?: SetIsProOptions) => {
    tokenSyncSourceRef.current = options?.source ?? 'unknown';
    if (options?.source !== 'startup') authPlatformAtSyncRef.current = observeAuthPlatform();
    if (options?.tokenSyncLastResult) {
      tokenSyncLastResultRef.current = options.tokenSyncLastResult;
      setTokenSyncLastResult(options.tokenSyncLastResult);
    }

    if (val) {
      // A failed/not-run authoritative sync must never preserve a stale token.
      // The provisional persisted state is allowed only while startup sync is pending.
      if (options?.tokenSyncLastResult && options.tokenSyncLastResult !== 'success') {
        isProRef.current = false;
        proTokenRef.current = null;
        setInternalIsPro(false);
        persistIsPro(false);
        persistProToken(null);
        setProToken(null);
        proEntitlementSourceRef.current = 'none';
        setProEntitlementSource('none');
        updateInternalProBootstrapObservation({ canonicalIsPro: false, proEntitlementSource: 'none' });
        return;
      }
      const nextToken = token || loadProToken();
      if (!isUsableProToken(nextToken)) {
        isProRef.current = false;
        proTokenRef.current = null;
        tokenSyncLastResultRef.current = 'failed';
        setInternalIsPro(false);
        persistIsPro(false);
        persistProToken(null);
        setProToken(null);
        setTokenSyncLastResult('failed');
        proEntitlementSourceRef.current = 'none';
        setProEntitlementSource('none');
        updateInternalProBootstrapObservation({ canonicalIsPro: false, proEntitlementSource: 'none' });
        return;
      }
      // Derive diagnostics from the signed token payload itself; caller-supplied
      // metadata can never relabel the canonical entitlement source.
      const nextSource = readProTokenEntitlementSource(nextToken);
      isProRef.current = true;
      proTokenRef.current = nextToken;
      proEntitlementSourceRef.current = nextSource;
      tokenSyncLastResultRef.current = options?.tokenSyncLastResult || 'success';
      setInternalIsPro(true);
      persistIsPro(true);
      persistProToken(nextToken);
      setProToken(nextToken);
      setProEntitlementSource(nextSource);
      setTokenSyncLastResult(options?.tokenSyncLastResult || 'success');
      updateInternalProBootstrapObservation({ canonicalIsPro: true, proEntitlementSource: nextSource });
      return;
    }

    isProRef.current = false;
    proTokenRef.current = null;
    setInternalIsPro(false);
    persistIsPro(false);
    persistProToken(null);
    setProToken(null);
    proEntitlementSourceRef.current = 'none';
    setProEntitlementSource('none');
    updateInternalProBootstrapObservation({ canonicalIsPro: false, proEntitlementSource: 'none' });
  }, []);

  // On mount: run the canonical entitlement sync. Internal QA bootstrap is the
  // first branch inside syncProEntitlement; commercial fallback owns RevenueCat
  // initialization so an unavailable store cannot block the QA issuer request.
  useEffect(() => {
    (async () => {
      try {
        // Capture at sync entry, not at the later AI click: platform bootstrap
        // drift must not disguise an earlier web-persistence branch as native.
        authPlatformAtSyncRef.current = observeAuthPlatform();
        const syncResult = await syncProEntitlement();
        if (syncResult.isPro && syncResult.token) {
          setIsPro(true, syncResult.token, {
            source: 'startup',
            entitlementResult: syncResult.entitlementResult,
            tokenSyncLastResult: syncResult.tokenSyncLastResult,
            tokenSyncLastError: syncResult.tokenSyncLastError || '',
          });
        } else {
          setIsPro(false, null, {
            source: 'startup',
            entitlementResult: syncResult.entitlementResult,
            tokenSyncLastResult: syncResult.tokenSyncLastResult,
            tokenSyncLastError: syncResult.tokenSyncLastError || '',
          });
        }
      } catch {
        isProRef.current = false;
        tokenSyncSourceRef.current = 'startup';
        proTokenRef.current = null;
        proEntitlementSourceRef.current = 'none';
        tokenSyncLastResultRef.current = 'failed';
        setInternalIsPro(false);
        persistIsPro(false);
        persistProToken(null);
        setProToken(null);
        setProEntitlementSource('none');
        setTokenSyncLastResult('failed');
        updateInternalProBootstrapObservation({ canonicalIsPro: false, proEntitlementSource: 'none' });
      }
    })();
  }, [setIsPro]);

  // Token refresh is owned by the startup/purchase/restore entitlement sync path.
  useEffect(() => {
    (async () => {
      try {
        return;
        /*
        if (false) {
          // User downgraded — clear stored token
          localStorage.removeItem(PRO_TOKEN_KEY);
          setProToken(null);
          return;
        }
        // Fetch a fresh token from the server, sending RevenueCat appUserID
        const { data, response: res } = await removedTokenRefresh<{ token?: string }>(
          '',
          {
            method: 'POST',
            body: { revenueCatAppUserId: removedRevenueCatAppUserId() },
          },
        );
        if (!res.ok) return;
        const { token } = data;
        if (token) {
          persistProToken(token);
          setProToken(token);
        }
        */
      } catch {
        // Token refresh is non-critical — server falls back gracefully
      }
    })();
  }, [isPro]);

  const readAiGateState = useCallback((): AiGateResult => {
    const currentIsPro = isProRef.current;
    const currentToken = proTokenRef.current || loadProToken();

    if (!currentIsPro) {
      return { status: 'free' };
    }

    // Persisted token payloads are provisional. Only the existing canonical
    // startup/purchase/restore sync owner can make a token authoritative for
    // this app session; the server still owns signature verification.
    if (tokenSyncLastResultRef.current !== 'success') {
      return {
        status: 'syncing',
        reason: tokenSyncLastResultRef.current === 'failed' ? 'token-sync-failed' : 'missing-token',
      };
    }

    if (currentToken && isUsableProToken(currentToken, Date.now(), AI_PRO_TOKEN_OPERATION_LEASE_MS)) {
      return { status: 'ready', token: currentToken };
    }

    return { status: 'syncing', reason: 'missing-token' };
  }, []);

  const getAiGate = useCallback((): AiGateResult => readAiGateState(), [readAiGateState]);

  const getProAuthObservation = useCallback(async (capturedToken: string): Promise<ProAuthObservation | undefined> => {
    if (!isInternalProAuthDiagnosticsEnabled()) return undefined;
    try {
      // Read refs before the first await; a later sync cannot rewrite this click's evidence.
      const canonicalToken = proTokenRef.current;
      const snapshot: Omit<ProAuthObservation, 'authTokenFingerprint' | 'authTokenFingerprintAtClick'> = {
        ...authPlatformAtSyncRef.current,
        authSyncLastResult: tokenSyncLastResultRef.current,
        authSyncSource: tokenSyncSourceRef.current,
        proEntitlementSource: proEntitlementSourceRef.current,
        authTokenRemainingLifetimeBucket: tokenLifetimeBucket(capturedToken, Date.now()),
      };
      const [authTokenFingerprint, authTokenFingerprintAtClick] = await Promise.all([
        fingerprintProToken(canonicalToken), fingerprintProToken(capturedToken),
      ]);
      return { ...snapshot, authTokenFingerprint, authTokenFingerprintAtClick };
    } catch { return undefined; }
  }, []);

  // Expose token synchronously from the same click-time gate used by AI callers.
  const getProToken = useCallback((): string | null => {
    const gate = readAiGateState();
    return gate.status === 'ready' ? gate.token : null;
  }, [readAiGateState]);

  const getProEntitlementSource = useCallback((): ProEntitlementSource => (
    proEntitlementSourceRef.current
  ), []);

  const canDownload = useCallback((type: 'cv' | 'cl') => {
    if (isProRef.current) return true;
    const used = type === 'cv' ? downloads.cv : downloads.cl;
    return used < FREE_DOWNLOAD_LIMIT;
  }, [downloads]);

  const incrementDownloads = useCallback((type: 'cv' | 'cl') => {
    if (isProRef.current) return;
    setDownloads(prev => {
      const updated = { ...prev, [type]: prev[type] + 1 };
      persistDownloads(updated);
      return updated;
    });
  }, []);

  const canGenerateCoverLetter = useCallback(() => {
    if (isProRef.current) return true;
    return clGenerationCount < FREE_CL_GENERATION_LIMIT;
  }, [clGenerationCount]);

  const incrementClGeneration = useCallback(() => {
    if (isProRef.current) return;
    setClGenerationCount(prev => {
      const updated = prev + 1;
      persistClGenerationCount(updated);
      return updated;
    });
  }, []);

  const canUseAiRecommend = useCallback(() => {
    if (isProRef.current) return true;
    return !aiRecommendUsed;
  }, [aiRecommendUsed]);

  const markAiRecommendUsed = useCallback(() => {
    if (isProRef.current) return;
    setAiRecommendUsed(true);
    persistAiRecommendUsed();
  }, []);

  const canRegenerateCoverLetter = useCallback(() => {
    if (isProRef.current) return true;
    return clRegenCount < FREE_CL_REGEN_LIMIT;
  }, [clRegenCount]);

  const incrementClRegen = useCallback(() => {
    if (isProRef.current) return;
    setClRegenCount(prev => {
      const updated = prev + 1;
      persistClRegenCount(updated);
      return updated;
    });
  }, []);

  const resetClRegen = useCallback(() => {
    if (isProRef.current) return;
    setClRegenCount(0);
    persistClRegenCount(0);
  }, []);

  // Pro safety cap helpers — only active for Pro users; free users are never checked here.
  const getProAiUsageCount = useCallback((): number => {
    const fresh = loadProAiRecord();
    if (fresh.windowStart !== proAiRecord.windowStart || fresh.count !== proAiRecord.count) {
      setProAiRecord(fresh);
    }
    return fresh.count;
  }, [proAiRecord]);

  const canUseProAi = useCallback((): boolean => {
    if (readAiGateState().status !== 'ready') return false;
    const fresh = loadProAiRecord();
    if (fresh.windowStart !== proAiRecord.windowStart || fresh.count !== proAiRecord.count) {
      setProAiRecord(fresh);
    }
    return fresh.count < PRO_AI_SAFETY_CAP;
  }, [proAiRecord, readAiGateState]);

  const commitProAiSuccess = useCallback((): ProAiUsageCommitResult => {
    const result = commitProAiUserAction({ aiGateReady: readAiGateState().status === 'ready' });
    // React observes only a record returned by the authoritative storage transaction.
    if (result.record) setProAiRecord(result.record);
    return result;
  }, [readAiGateState]);

  const recordProAiSuccess = useCallback((): void => {
    void commitProAiSuccess();
  }, [commitProAiSuccess]);

  const saveCv = useCallback((cv: CVData) => {
    const existingDraft = loadCvDraft();
    const photoFields = cvPhotoDraftFields(cv, existingDraft ?? undefined);
    internalSetCurrentCv(cv);
    saveCvDraft({
      cv,
      ...photoFields,
      savedAt: new Date().toISOString(),
    });
    setLastCvSavedAt(Date.now());
  }, []);

  const deleteCv = useCallback((id: string) => {
    void id;
    internalSetCurrentCv(null);
    clearCvDraft();
    setLastCvSavedAt(0);
  }, []);

  const saveCoverLetter = useCallback((cl: CoverLetterData) => {
    internalSetCurrentCoverLetter(cl);
    saveClDraft({ coverLetter: cl, savedAt: new Date().toISOString() });
    setLastClSavedAt(Date.now());
  }, []);

  const deleteCoverLetter = useCallback((id: string) => {
    void id;
    internalSetCurrentCoverLetter(null);
    clearClDraft();
    setLastClSavedAt(0);
  }, []);

  // Wrapped setters used by pages — persist to localStorage on every call
  const setCurrentCv = useCallback((cv: CVData | null) => {
    internalSetCurrentCv(cv);
    if (cv) {
      const existingDraft = loadCvDraft();
      const photoFields = cvPhotoDraftFields(cv, existingDraft ?? undefined);
      saveCvDraft({
        cv,
        ...photoFields,
        savedAt: new Date().toISOString(),
      });
    } else {
      clearCvDraft();
    }
    setLastCvSavedAt(Date.now());
  }, []);

  const persistCurrentCvTransactionally = useCallback((cv: CVData): boolean => {
    const existingDraft = loadCvDraft();
    const photoFields = cvPhotoDraftFields(cv, existingDraft ?? undefined);
    const persisted = saveCvDraft({
      cv,
      ...photoFields,
      savedAt: new Date().toISOString(),
    });
    if (!persisted) return false;
    internalSetCurrentCv(cv);
    setLastCvSavedAt(Date.now());
    return true;
  }, []);

  const setCurrentCoverLetter = useCallback((cl: CoverLetterData | null) => {
    internalSetCurrentCoverLetter(cl);
    if (cl) {
      saveClDraft({ coverLetter: cl, savedAt: new Date().toISOString() });
    } else {
      clearClDraft();
    }
    setLastClSavedAt(Date.now());
  }, []);

  // Persist the current CV draft with optional photo data (called by CV builder page)
  const persistCurrentDraft = useCallback(
    (extra?: { originalPhoto?: string; circularPhoto?: string; rectangularPhoto?: string }) => {
      if (!currentCv) return;
      const existingDraft = loadCvDraft();
      const clearPhotos = Boolean(
        extra
        && extra.originalPhoto === undefined
        && extra.circularPhoto === undefined
        && extra.rectangularPhoto === undefined,
      );
      const currentPersonal = currentCv.personal as typeof currentCv.personal & PersonalPhotoFields;
      const originalPhoto = clearPhotos ? undefined : (extra?.originalPhoto ?? currentPersonal.originalPhoto ?? existingDraft?.originalPhoto);
      const circularPhoto = clearPhotos ? undefined : (extra?.circularPhoto ?? currentPersonal.circularPhoto ?? existingDraft?.circularPhoto);
      const rectangularPhoto = clearPhotos ? undefined : (extra?.rectangularPhoto ?? currentPersonal.rectangularPhoto ?? existingDraft?.rectangularPhoto);
      const cvWithPhotoFields: CVData = {
        ...currentCv,
        personal: {
          ...currentCv.personal,
          originalPhoto,
          circularPhoto,
          rectangularPhoto,
        } as CVData['personal'] & PersonalPhotoFields,
      };
      saveCvDraft({
        cv: cvWithPhotoFields,
        originalPhoto,
        circularPhoto,
        rectangularPhoto,
        savedAt: new Date().toISOString(),
      });
      setLastCvSavedAt(Date.now());
    },
    [currentCv],
  );

  // Clear all persisted drafts
  const clearAllDrafts = useCallback(() => {
    clearCvDraft();
    clearClDraft();
    internalSetCurrentCv(null);
    internalSetCurrentCoverLetter(null);
    setLastCvSavedAt(0);
    setLastClSavedAt(0);
  }, []);

  void FREE_AI_RECOMMEND_LIMIT; // used via canUseAiRecommend logic above
  return (
    <AppContext.Provider value={{
      isPro, proEntitlementSource, setIsPro, getProToken, getProEntitlementSource,
      getAiGate, getProAuthObservation,
      saveCv, deleteCv, saveCoverLetter, deleteCoverLetter,
      currentCv, setCurrentCv, persistCurrentCvTransactionally,
      currentCoverLetter, setCurrentCoverLetter,
      canDownload, incrementDownloads,
      clGenerationCount, canGenerateCoverLetter, incrementClGeneration,
      aiRecommendUsed, canUseAiRecommend, markAiRecommendUsed,
      clRegenCount, canRegenerateCoverLetter, incrementClRegen, resetClRegen,
      canUseProAi, recordProAiSuccess, commitProAiSuccess, getProAiUsageCount,
      lastCvSavedAt, lastClSavedAt, clearAllDrafts, persistCurrentDraft,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
