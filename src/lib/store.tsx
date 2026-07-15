'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { CVData, CoverLetterData } from './types';
import {
  initIAP,
  syncProEntitlement,
  type EntitlementSyncResult,
  type TokenSyncResult,
} from './iap';
import {
  saveCvDraft,
  loadCvDraft,
  clearCvDraft,
  saveClDraft,
  loadClDraft,
  clearClDraft,
} from './draft-storage';
import { migrateLegacyCanonicalCv } from './cv-canonical-snapshot';

const PRO_TOKEN_KEY = 'cvpro-pro-token';

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
  setIsPro: (val: boolean, token?: string | null, options?: SetIsProOptions) => void;
  /** HMAC-signed Pro token for server-side verification. Refreshed every 24h. */
  getProToken: () => string | null;
  /** Current AI authorization gate, read at click time from canonical Pro state. */
  getAiGate: () => AiGateResult;
  saveCv: (cv: CVData) => void;
  deleteCv: (id: string) => void;
  saveCoverLetter: (cl: CoverLetterData) => void;
  deleteCoverLetter: (id: string) => void;
  currentCv: CVData | null;
  setCurrentCv: (cv: CVData | null) => void;
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
  // Pro safety cap (hidden, high limit — normal users never reach it)
  canUseProAi: () => boolean;
  recordProAiSuccess: () => void;
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
  return localStorage.getItem('cvpro-plan') === 'pro' && Boolean(localStorage.getItem(PRO_TOKEN_KEY));
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

// Hidden Pro safety cap — 20 successful AI actions per 30 days.
// Normal users never reach this. No UI exposure.
const PRO_AI_SAFETY_CAP = 20;
const PRO_AI_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
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


interface ProAiRecord {
  count: number;
  windowStart: number; // epoch ms
}

function loadProAiRecord(): ProAiRecord {
  if (typeof window === 'undefined') return { count: 0, windowStart: Date.now() };
  try {
    const stored = localStorage.getItem('cvpro-ai-usage');
    if (stored) {
      const parsed = JSON.parse(stored) as ProAiRecord;
      // If the 30-day window has expired, start fresh
      if (Date.now() - parsed.windowStart >= PRO_AI_WINDOW_MS) {
        return { count: 0, windowStart: Date.now() };
      }
      return parsed;
    }
  } catch { /* ignore parse errors */ }
  return { count: 0, windowStart: Date.now() };
}

function persistProAiRecord(record: ProAiRecord) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('cvpro-ai-usage', JSON.stringify(record));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // internal state is only used when not forced by test env var
  const [internalIsPro, setInternalIsPro] = useState<boolean>(() => loadIsPro());
  const isPro = internalIsPro;
  const [proToken, setProToken] = useState<string | null>(() => (loadIsPro() ? loadProToken() : null));
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
  // Timestamps for "Draft saved" indicator
  const [lastCvSavedAt, setLastCvSavedAt] = useState<number>(() => (currentCv ? Date.now() : 0));
  const [lastClSavedAt, setLastClSavedAt] = useState<number>(() => (currentCoverLetter ? Date.now() : 0));
  const [tokenSyncLastResult, setTokenSyncLastResult] = useState<TokenSyncResult | 'not-run'>('not-run');
  const isProRef = useRef(isPro);
  const proTokenRef = useRef(proToken);
  const tokenSyncLastResultRef = useRef<TokenSyncResult | 'not-run'>(tokenSyncLastResult);

  isProRef.current = isPro;
  proTokenRef.current = proToken;
  tokenSyncLastResultRef.current = tokenSyncLastResult;

  const setIsPro = useCallback((val: boolean, token?: string | null, options?: SetIsProOptions) => {
    if (options?.tokenSyncLastResult) {
      tokenSyncLastResultRef.current = options.tokenSyncLastResult;
      setTokenSyncLastResult(options.tokenSyncLastResult);
    }

    if (val) {
      const nextToken = token || loadProToken();
      if (!nextToken) {
        isProRef.current = false;
        proTokenRef.current = null;
        tokenSyncLastResultRef.current = 'failed';
        setInternalIsPro(false);
        persistIsPro(false);
        persistProToken(null);
        setProToken(null);
        setTokenSyncLastResult('failed');
        return;
      }
      isProRef.current = true;
      proTokenRef.current = nextToken;
      tokenSyncLastResultRef.current = options?.tokenSyncLastResult || 'success';
      setInternalIsPro(true);
      persistIsPro(true);
      persistProToken(nextToken);
      setProToken(nextToken);
      setTokenSyncLastResult(options?.tokenSyncLastResult || 'success');
      return;
    }

    isProRef.current = false;
    proTokenRef.current = null;
    setInternalIsPro(false);
    persistIsPro(false);
    persistProToken(null);
    setProToken(null);
  }, []);

  // On mount: initialise RevenueCat SDK and sync Pro entitlement from the store.
  // This ensures Pro status is always authoritative from Google Play / Apple IAP.
  useEffect(() => {
    (async () => {
      try {
        await initIAP();
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
        proTokenRef.current = null;
        tokenSyncLastResultRef.current = 'failed';
        setInternalIsPro(false);
        persistIsPro(false);
        persistProToken(null);
        setProToken(null);
        setTokenSyncLastResult('failed');
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

    if (currentToken) {
      return { status: 'ready', token: currentToken };
    }

    const reason: 'missing-token' | 'token-sync-failed' =
      tokenSyncLastResultRef.current === 'failed' ? 'token-sync-failed' : 'missing-token';

    return { status: 'syncing', reason };
  }, []);

  const getAiGate = useCallback((): AiGateResult => readAiGateState(), [readAiGateState]);

  // Expose token synchronously from the same click-time gate used by AI callers.
  const getProToken = useCallback((): string | null => {
    const gate = readAiGateState();
    return gate.status === 'ready' ? gate.token : null;
  }, [readAiGateState]);

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
  const canUseProAi = useCallback((): boolean => {
    if (readAiGateState().status !== 'ready') return false;
    // Re-read from storage to ensure freshness across re-renders
    const fresh = loadProAiRecord();
    if (fresh.windowStart !== proAiRecord.windowStart || fresh.count !== proAiRecord.count) {
      setProAiRecord(fresh);
    }
    return fresh.count < PRO_AI_SAFETY_CAP;
  }, [proAiRecord, readAiGateState]);

  const recordProAiSuccess = useCallback(() => {
    if (readAiGateState().status !== 'ready') return; // only track for Pro users
    setProAiRecord(prev => {
      const now = Date.now();
      // Reset window if expired
      const base = now - prev.windowStart >= PRO_AI_WINDOW_MS
        ? { count: 0, windowStart: now }
        : prev;
      const updated: ProAiRecord = { count: base.count + 1, windowStart: base.windowStart };
      persistProAiRecord(updated);
      return updated;
    });
  }, [readAiGateState]);

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
      isPro, setIsPro, getProToken, getAiGate,
      saveCv, deleteCv, saveCoverLetter, deleteCoverLetter,
      currentCv, setCurrentCv, currentCoverLetter, setCurrentCoverLetter,
      canDownload, incrementDownloads,
      clGenerationCount, canGenerateCoverLetter, incrementClGeneration,
      aiRecommendUsed, canUseAiRecommend, markAiRecommendUsed,
      clRegenCount, canRegenerateCoverLetter, incrementClRegen, resetClRegen,
      canUseProAi, recordProAiSuccess,
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
