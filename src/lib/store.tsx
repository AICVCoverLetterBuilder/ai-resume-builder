'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { CVData, CoverLetterData } from './types';
import { checkProEntitlement, getAppUserId, initIAP } from './iap';
import {
  saveCvDraft,
  loadCvDraft,
  clearCvDraft,
  saveClDraft,
  loadClDraft,
  clearClDraft,
} from './draft-storage';
import { apiFetch } from './api';

const PRO_TOKEN_KEY = 'cvpro-pro-token';

interface AppContextType {
  isPro: boolean;
  setIsPro: (val: boolean) => void;
  /** HMAC-signed Pro token for server-side verification. Refreshed every 24h. */
  getProToken: () => string | null;
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
  return localStorage.getItem('cvpro-plan') === 'pro';
}

function persistIsPro(val: boolean) {
  if (typeof window === 'undefined') return;
  if (val) localStorage.setItem('cvpro-plan', 'pro');
  else localStorage.removeItem('cvpro-plan');
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
  const [proToken, setProToken] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<{ cv: number; cl: number }>(() => loadDownloads());
  // Initialize from localStorage drafts for persistence across sessions
  const [currentCv, internalSetCurrentCv] = useState<CVData | null>(() => loadCvDraft()?.cv ?? null);
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

  // On mount: initialise RevenueCat SDK and sync Pro entitlement from the store.
  // This ensures Pro status is always authoritative from Google Play / Apple IAP.
  useEffect(() => {
    (async () => {
      try {
        await initIAP();
        const storeIsPro = await checkProEntitlement();
        if (storeIsPro) {
          setInternalIsPro(true);
          persistIsPro(true);
        }
      } catch {
        // Silently ignore — fallback to localStorage value already loaded
      }
    })();
  }, []);

  // Fetch/refresh Pro token on mount and whenever isPro changes.
  // The server determines Pro eligibility (not the client claim).
  // The signed token is sent with API requests for server-side Pro verification.
  useEffect(() => {
    (async () => {
      try {
        const cached = localStorage.getItem(PRO_TOKEN_KEY);
        if (cached && !isPro) {
          // User downgraded — clear stored token
          localStorage.removeItem(PRO_TOKEN_KEY);
          setProToken(null);
          return;
        }
        // Fetch a fresh token from the server, sending RevenueCat appUserID
        const { data, response: res } = await apiFetch<{ token?: string }>(
          '/api/verify-pro',
          {
            method: 'POST',
            body: { revenueCatAppUserId: getAppUserId() },
          },
        );
        if (!res.ok) return;
        const { token } = data;
        if (token) {
          localStorage.setItem(PRO_TOKEN_KEY, token);
          setProToken(token);
        }
      } catch {
        // Token refresh is non-critical — server falls back gracefully
      }
    })();
  }, [isPro]);

  // Expose token synchronously (reads from cache for perf, falls back to state)
  const getProToken = useCallback((): string | null => {
    return proToken || (typeof window !== 'undefined' ? localStorage.getItem(PRO_TOKEN_KEY) : null);
  }, [proToken]);

  const setIsPro = useCallback((val: boolean) => {
    setInternalIsPro(val);
    persistIsPro(val);
  }, []);

  const canDownload = useCallback((type: 'cv' | 'cl') => {
    if (isPro) return true;
    const used = type === 'cv' ? downloads.cv : downloads.cl;
    return used < FREE_DOWNLOAD_LIMIT;
  }, [isPro, downloads]);

  const incrementDownloads = useCallback((type: 'cv' | 'cl') => {
    setDownloads(prev => {
      const updated = { ...prev, [type]: prev[type] + 1 };
      persistDownloads(updated);
      return updated;
    });
  }, []);

  const canGenerateCoverLetter = useCallback(() => {
    if (isPro) return true;
    return clGenerationCount < FREE_CL_GENERATION_LIMIT;
  }, [isPro, clGenerationCount]);

  const incrementClGeneration = useCallback(() => {
    setClGenerationCount(prev => {
      const updated = prev + 1;
      persistClGenerationCount(updated);
      return updated;
    });
  }, []);

  const canUseAiRecommend = useCallback(() => {
    if (isPro) return true;
    return !aiRecommendUsed;
  }, [isPro, aiRecommendUsed]);

  const markAiRecommendUsed = useCallback(() => {
    setAiRecommendUsed(true);
    persistAiRecommendUsed();
  }, []);

  const canRegenerateCoverLetter = useCallback(() => {
    if (isPro) return true;
    return clRegenCount < FREE_CL_REGEN_LIMIT;
  }, [isPro, clRegenCount]);

  const incrementClRegen = useCallback(() => {
    setClRegenCount(prev => {
      const updated = prev + 1;
      persistClRegenCount(updated);
      return updated;
    });
  }, []);

  const resetClRegen = useCallback(() => {
    setClRegenCount(0);
    persistClRegenCount(0);
  }, []);

  // Pro safety cap helpers — only active for Pro users; free users are never checked here.
  const canUseProAi = useCallback((): boolean => {
    if (!isPro) return true; // free-user gate is handled separately
    // Re-read from storage to ensure freshness across re-renders
    const fresh = loadProAiRecord();
    if (fresh.windowStart !== proAiRecord.windowStart || fresh.count !== proAiRecord.count) {
      setProAiRecord(fresh);
    }
    return fresh.count < PRO_AI_SAFETY_CAP;
  }, [isPro, proAiRecord]);

  const recordProAiSuccess = useCallback(() => {
    if (!isPro) return; // only track for Pro users
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
  }, [isPro]);

  const saveCv = useCallback((cv: CVData) => {
    internalSetCurrentCv(cv);
    saveCvDraft({ cv, savedAt: new Date().toISOString() });
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
      saveCvDraft({ cv, savedAt: new Date().toISOString() });
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
      saveCvDraft({
        cv: currentCv,
        originalPhoto: extra?.originalPhoto,
        circularPhoto: extra?.circularPhoto,
        rectangularPhoto: extra?.rectangularPhoto,
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
      isPro, setIsPro, getProToken,
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
