'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useApp } from '@/lib/store';
import { exportToClipboard, exportCoverLetterToDOCX, exportCoverLetterToPDF } from '@/lib/export';
import { CoverLetterExportIncompleteError, contentMatchesRequestedLocale, getDefaultCoverLetterClosing, resolveExportCandidateName, sanitizeCoverLetterContent } from '@/lib/cover-letter-generation';
import type { Locale } from '@/lib/i18n/translations';
import {
  createCoverLetterRequestId,
  type ActiveCoverLetterRequest,
  type CoverLetterGenerationPhase,
  type CoverLetterGroundingStatus,
} from '@/lib/cover-letter-flow';
import { normalizeCoverLetterGender } from '@/lib/cover-letter-gender';
import {
  resolveCoverLetterGenerationResult,
} from '@/lib/cover-letter-generation-resolve';
import {
  clearCoverLetterStateTransitions,
  createCoverLetterActiveResult,
  detectCoverLetterContentLocale,
  isActiveCoverLetterResultEligible,
  recordCoverLetterStateTransition,
  snapshotCoverLetterState,
  type CoverLetterActiveResult,
} from '@/lib/cover-letter-active-result';
import {
  coverLetterAiUnavailable,
  coverLetterGroundingFailed,
  coverLetterStaleContent,
  coverLetterWrongLanguage,
} from '@/lib/cover-letter-messages';
import type { CoverLetterData, Tone } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Sparkles, FileText, Copy, Pencil, RefreshCw, Crown, Info, Loader2, Download, ChevronDown, File, User } from 'lucide-react';
import { CoverLetterProModal, FreeLimitModal } from '@/components/UpgradePro';
import { PremiumAIButton, AIBadge } from '@/components/PremiumAIButton';
import {
  CoverLetterArabicPdfDiagnosticsButton,
  CoverLetterGenerationDiagnosticsButton,
  CoverLetterGroundingDiagnosticsButton,
} from '@/components/CoverLetterDiagnosticControls';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { getAppUserId } from '@/lib/iap';
import { buildCoverLetterFactSet } from '@/lib/cover-letter-facts';
import {
  beginCoverLetterGroundingDiagnostics,
  countFactsByCategory,
  updateCoverLetterGroundingDiagnostics,
  COVER_LETTER_GROUNDING_BACKEND_REVISION,
} from '@/lib/cover-letter-grounding-diagnostics';
import { normalizeCoverLetterBody, prepareCoverLetterForDisplay } from '@/lib/cover-letter-header';

const emptyCL = (): CoverLetterData => ({
  id: crypto.randomUUID(),
  name: '',
  firstName: '',
  lastName: '',
  gender: '',
  jobTitle: '',
  companyName: '',
  tone: 'formal',
  content: '',
  templateId: 'modern-minimal',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

async function callGenerateAI(params: {
  jobTitle: string;
  companyName: string;
  tone: Tone;
  locale: string;
  personalName?: string;
  personalEmail?: string;
  personalPhone?: string;
  variant?: number;
  gender?: string;
  proToken?: string | null;
  freeUserId?: string;
  action?: string;
  signal?: AbortSignal;
  experienceEntries?: unknown[];
  skills?: string[];
  education?: unknown[];
  languages?: unknown[];
  certifications?: string[];
  summary?: string;
  jobDescription?: string;
}): Promise<{
  content: string;
  status: number;
  groundingStatus?: unknown;
  coverLetterBackendRevision?: unknown;
  repairAttempted?: unknown;
  fallbackUsed?: unknown;
  usedFactIds?: unknown;
  groundingViolations?: unknown;
  contentLocale?: unknown;
}> {
  const ownsController = !params.signal;
  const controller = ownsController ? new AbortController() : null;
  const timer = ownsController ? setTimeout(() => controller!.abort(), 45000) : null;
  const signal = params.signal ?? controller!.signal;
  try {
    const { data, response: res } = await apiFetch<{
      result?: string;
      error?: string;
      groundingStatus?: unknown;
      coverLetterBackendRevision?: unknown;
      repairAttempted?: unknown;
      fallbackUsed?: unknown;
      usedFactIds?: unknown;
      groundingViolations?: unknown;
      contentLocale?: unknown;
    }>('/api/generate', {
      body: { action: params.action || 'cover-letter-gen', ...params },
      signal,
    });
    if (!data || !res.ok || (data as { error?: string }).error) {
      throw Object.assign(new Error((data as { error?: string } | null)?.error || 'AI service error'), {
        status: res.status,
      });
    }
    if (typeof data.result !== 'string') {
      throw Object.assign(new Error('malformed_response'), {
        status: res.status,
        name: 'MalformedResponseError',
      });
    }
    return {
      content: data.result,
      status: res.status,
      groundingStatus: data.groundingStatus,
      coverLetterBackendRevision: data.coverLetterBackendRevision,
      repairAttempted: data.repairAttempted,
      fallbackUsed: data.fallbackUsed,
      usedFactIds: data.usedFactIds,
      groundingViolations: data.groundingViolations,
      contentLocale: data.contentLocale,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default function CoverLetterPage() {
  const { t, locale } = useI18n();
  const { currentCoverLetter, setCurrentCoverLetter, isPro, canGenerateCoverLetter, incrementClGeneration, canDownload, incrementDownloads, canRegenerateCoverLetter, incrementClRegen, resetClRegen, currentCv, canUseProAi, recordProAiSuccess, lastClSavedAt, getAiGate } = useApp();
  const [cl, setCl] = useState<CoverLetterData>(currentCoverLetter || emptyCL());
  const [editing, setEditing] = useState(false);
  const [proModal, setProModal] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'generate' | 'regenerate'>('generate');
  const [downloadLimitModal, setDownloadLimitModal] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [contentLocale, setContentLocale] = useState<Locale | null>(null);
  const [generationPhase, setGenerationPhase] = useState<CoverLetterGenerationPhase>('idle');
  const [groundingStatus, setGroundingStatus] = useState<CoverLetterGroundingStatus>('unknown');
  const [activeResult, setActiveResult] = useState<CoverLetterActiveResult | null>(null);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isWordExporting, setIsWordExporting] = useState(false);
  const [showArabicPdfDiagnostics, setShowArabicPdfDiagnostics] = useState(false);
  const [showGroundingDiagnostics, setShowGroundingDiagnostics] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const activeGenerationRef = useRef<ActiveCoverLetterRequest | null>(null);
  const generationAbortRef = useRef<AbortController | null>(null);
  const prevUiLocaleRef = useRef(locale);
  const prevGenderRef = useRef(normalizeCoverLetterGender((currentCoverLetter || emptyCL()).gender));
  const skipNextCoverLetterStoreSyncRef = useRef(false);
  const preservedActiveResultRef = useRef<CoverLetterActiveResult | null>(null);
  const activeResultRef = useRef<CoverLetterActiveResult | null>(null);
  activeResultRef.current = activeResult;

  // Auto-fill identity fields from CV personal info on mount or when CV changes
  useEffect(() => {
    // Autosave echoes must not re-detect locale (jp+Latin was misclassified as en and blanked preview).
    if (skipNextCoverLetterStoreSyncRef.current) {
      skipNextCoverLetterStoreSyncRef.current = false;
      return;
    }

    if (currentCoverLetter) {
      const sanitized = currentCoverLetter.content
        ? sanitizeCoverLetterContent(currentCoverLetter.content)
        : '';
      setCl(sanitized ? { ...currentCoverLetter, content: sanitized } : currentCoverLetter);
      if (sanitized) {
        const preferred = (locale as Locale) || null;
        const existing = activeResultRef.current;
        // Preserve a trusted activation when the stored body still matches it.
        if (
          existing &&
          existing.content === sanitized &&
          contentMatchesRequestedLocale(sanitized, existing.locale)
        ) {
          setContentLocale(existing.locale);
          setGroundingStatus(existing.groundingStatus);
          setHasGenerated(true);
          return;
        }
        const detected = detectCoverLetterContentLocale(sanitized, preferred);
        setContentLocale(detected);
        if (detected) setHasGenerated(true);
      }
    } else if (currentCv?.personal) {
      // Pre-fill from CV if no existing cover letter
      const fullName = currentCv.personal.fullName?.trim() || '';
      const parts = fullName.split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const gender = (currentCv.personal.gender as CoverLetterData['gender']) || '';
      setCl(prev => ({
        ...prev,
        firstName: prev.firstName || firstName,
        lastName: prev.lastName || lastName,
        gender: prev.gender || gender,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCoverLetter]);

  // When CV data changes and CL identity fields are still empty, sync them
  useEffect(() => {
    if (!currentCv?.personal) return;
    setCl(prev => {
      if (prev.firstName || prev.lastName) return prev; // user has set them manually
      const fullName = currentCv.personal.fullName?.trim() || '';
      const parts = fullName.split(' ');
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const gender = (currentCv.personal.gender as CoverLetterData['gender']) || '';
      if (!firstName && !lastName && !gender) return prev;
      return { ...prev, firstName, lastName, gender };
    });
  }, [currentCv]);

  // Close download menu on outside click
  useEffect(() => {
    if (!showDownloadMenu) return;
    const handler = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDownloadMenu]);

  // ── Autosave: debounce-save cover letter to context (persists to localStorage) ──
  const clAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (clAutosaveTimerRef.current) clearTimeout(clAutosaveTimerRef.current);
    clAutosaveTimerRef.current = setTimeout(() => {
      skipNextCoverLetterStoreSyncRef.current = true;
      setCurrentCoverLetter(cl);
    }, 800);
    return () => {
      if (clAutosaveTimerRef.current) clearTimeout(clAutosaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cl]);

  // UI locale change intentionally invalidates content generated for another language.
  useEffect(() => {
    if (prevUiLocaleRef.current !== locale) {
      if (contentLocale && contentLocale !== locale) {
        const before = snapshotCoverLetterState({
          selectedLocale: locale as Locale,
          contentLocale,
          groundingStatus,
          generationPhase,
          contentLength: cl.content.length,
          resultSource: activeResult?.source ?? null,
          lastActivationTimestamp: activeResult?.activatedAt ?? null,
          downloadsAllowed: false,
          copyAllowed: false,
          selectedGenderNormalized: normalizeCoverLetterGender(cl.gender),
        });
        setGenerationPhase('idle');
        setHasGenerated(false);
        setActiveResult(null);
        setGroundingStatus('unknown');
        recordCoverLetterStateTransition('ui_locale_changed_invalidate', before, {
          ...before,
          generationPhase: 'idle',
          groundingStatus: 'unknown',
          resultSource: null,
          lastActivationTimestamp: null,
          contentLocale,
        });
      }
      prevUiLocaleRef.current = locale;
    }
  }, [locale, contentLocale, groundingStatus, generationPhase, cl.content.length, cl.gender, activeResult]);

  // Gender change intentionally invalidates the previous grammatical-gender snapshot.
  useEffect(() => {
    const nextGender = normalizeCoverLetterGender(cl.gender);
    if (prevGenderRef.current === nextGender) return;
    prevGenderRef.current = nextGender;
    if (!activeResultRef.current) return;
    if (activeResultRef.current.gender === nextGender) return;
    const before = snapshotCoverLetterState({
      selectedLocale: locale as Locale,
      contentLocale,
      groundingStatus,
      generationPhase,
      contentLength: cl.content.length,
      resultSource: activeResultRef.current.source,
      lastActivationTimestamp: activeResultRef.current.activatedAt,
      selectedGenderNormalized: nextGender,
      downloadsAllowed: false,
      copyAllowed: false,
    });
    setActiveResult(null);
    setGroundingStatus('unknown');
    setGenerationPhase('idle');
    recordCoverLetterStateTransition('gender_changed_invalidate', before, {
      ...before,
      groundingStatus: 'unknown',
      generationPhase: 'idle',
      resultSource: null,
      lastActivationTimestamp: null,
    });
  }, [cl.gender, contentLocale, groundingStatus, generationPhase, cl.content.length, locale]);

  const selectedLocale = locale as Locale;
  const selectedGenderNormalized = normalizeCoverLetterGender(cl.gender);
  const exportCandidateNameForPreview = (() => {
    const first = cl.firstName.trim();
    const last = cl.lastName.trim();
    if (first && last) return `${first} ${last}`;
    return first || last || currentCv?.personal?.fullName?.trim() || '';
  })();

  const eligibleActiveResult = isActiveCoverLetterResultEligible(
    activeResult,
    selectedLocale,
    selectedGenderNormalized,
    generationPhase,
  )
    ? activeResult
    : null;

  const rawPreviewContent = eligibleActiveResult?.content ?? '';
  const previewContent = rawPreviewContent
    ? prepareCoverLetterForDisplay(rawPreviewContent, exportCandidateNameForPreview, selectedLocale)
    : '';
  const exportBodyContent = rawPreviewContent
    ? normalizeCoverLetterBody(rawPreviewContent, exportCandidateNameForPreview)
    : '';
  const downloadsAllowed = Boolean(eligibleActiveResult);
  const previewIsRtl = selectedLocale === 'ar';
  const isGenerationBusy = isGenerating || isRegenerating;

  const captureStateSnapshot = (overrides?: Partial<Parameters<typeof snapshotCoverLetterState>[0]>) =>
    snapshotCoverLetterState({
      requestId: activeGenerationRef.current?.requestId ?? activeResult?.requestId ?? null,
      activeRequestPresent: activeGenerationRef.current != null,
      activeRequestLocale: activeGenerationRef.current?.locale ?? null,
      activeRequestGender: activeGenerationRef.current?.gender ?? null,
      generationPhase,
      isGenerating: isGenerationBusy,
      contentLength: (activeResult?.content ?? cl.content).length,
      contentLocale: activeResult?.locale ?? contentLocale,
      groundingStatus: activeResult?.groundingStatus ?? groundingStatus,
      resultSource: activeResult?.source ?? null,
      downloadsAllowed: Boolean(eligibleActiveResult),
      copyAllowed: Boolean(eligibleActiveResult),
      selectedLocale,
      selectedGenderNormalized,
      lastActivationTimestamp: activeResult?.activatedAt ?? null,
      ...overrides,
    });

  const runCoverLetterGeneration = async (
    action: 'cover-letter-gen' | 'cover-letter-regen',
    mode: 'generate' | 'regenerate',
  ) => {
    const aiGate = getAiGate();
    const isCurrentPro = aiGate.status !== 'free';

    if (mode === 'generate' && !isCurrentPro && !canGenerateCoverLetter()) {
      setPaywallReason('generate');
      setProModal(true);
      return;
    }
    if (mode === 'regenerate' && !isCurrentPro && !canRegenerateCoverLetter()) {
      setPaywallReason('regenerate');
      setProModal(true);
      return;
    }
    if (aiGate.status === 'syncing') {
      toast.error(t.common.proAuthorizationUnavailable);
      return;
    }
    if (isCurrentPro && !canUseProAi()) {
      toast.error(coverLetterAiUnavailable(selectedLocale));
      return;
    }
    if (isGenerationBusy) return;

    generationAbortRef.current?.abort();
    const abortController = new AbortController();
    generationAbortRef.current = abortController;
    const requestId = createCoverLetterRequestId();
    const requestedLocale = selectedLocale;
    const requestedGender = normalizeCoverLetterGender(cl.gender);
    clearCoverLetterStateTransitions();
    preservedActiveResultRef.current = activeResultRef.current;
    const beforeStart = captureStateSnapshot();
    activeGenerationRef.current = {
      requestId,
      locale: requestedLocale,
      gender: requestedGender,
    };

    setGenerationPhase('loading');
    // Keep groundingStatus / activeResult until replaced — only loading phase hides preview.
    if (mode === 'generate') setIsGenerating(true);
    else setIsRegenerating(true);
    recordCoverLetterStateTransition('generation_started', beforeStart, captureStateSnapshot({
      requestId,
      activeRequestPresent: true,
      activeRequestLocale: requestedLocale,
      activeRequestGender: requestedGender,
      generationPhase: 'loading',
      isGenerating: true,
      downloadsAllowed: false,
      copyAllowed: false,
    }));

    const proToken = aiGate.status === 'ready' ? aiGate.token : null;
    const fullName = getFullName();
    const experienceEntries = currentCv?.experience ?? [];
    const skills = currentCv?.skills ?? [];
    const education = currentCv?.education ?? [];
    const languages = currentCv?.languages ?? [];
    const certifications = currentCv?.certifications ?? [];
    const summary = currentCv?.summary ?? '';
    const factSet = buildCoverLetterFactSet({
      personalName: fullName || currentCv?.personal?.fullName || '',
      jobTitle: cl.jobTitle,
      companyName: cl.companyName,
      jobDescription: '',
      summary,
      experience: experienceEntries,
      education,
      skills,
      certifications,
      languages,
    });
    const factCounts = countFactsByCategory(factSet);
    beginCoverLetterGroundingDiagnostics({
      apiBaseUrl: getApiBaseUrl(),
      apiPath: '/api/generate',
      locale: requestedLocale,
      requestId,
      requestFactCounts: factCounts,
      leadershipEvidence: factSet.facts.some((f) => f.type === 'leadership'),
      groundingValidatorStarted: true,
    });

    try {
      const {
        content,
        groundingStatus: responseGrounding,
        coverLetterBackendRevision,
        repairAttempted,
        fallbackUsed,
        groundingViolations,
        contentLocale: responseContentLocale,
        status: httpStatus,
      } = await callGenerateAI({
        action,
        jobTitle: cl.jobTitle,
        companyName: cl.companyName,
        tone: cl.tone,
        locale: requestedLocale,
        variant: mode === 'regenerate' ? Date.now() : 0,
        gender: requestedGender,
        personalName: fullName || currentCv?.personal?.fullName || '',
        personalEmail: currentCv?.personal?.email || '',
        personalPhone: currentCv?.personal?.phone || '',
        experienceEntries,
        skills,
        education,
        languages,
        certifications,
        summary,
        proToken,
        freeUserId: isCurrentPro ? undefined : getAppUserId(),
        signal: abortController.signal,
      });

      const resolved = resolveCoverLetterGenerationResult({
        active: activeGenerationRef.current,
        requestId,
        requestedLocale,
        selectedLocale: requestedLocale,
        selectedGenderRaw: cl.gender || '',
        requestedGenderNormalized: requestedGender,
        serverContent: content,
        serverGroundingRaw: responseGrounding,
        backendRevision: coverLetterBackendRevision,
        repairAttempted,
        fallbackUsed,
        httpStatus,
        responseKeys: [
          'result',
          'groundingStatus',
          'coverLetterBackendRevision',
          'repairAttempted',
          'fallbackUsed',
          'contentLocale',
        ],
        responseContentLocale,
        candidateName: fullName || currentCv?.personal?.fullName || '',
        jobTitle: cl.jobTitle,
        companyName: cl.companyName,
        factSet,
        tone: cl.tone,
      });

      updateCoverLetterGroundingDiagnostics({
        serverGroundingStatus: String(responseGrounding ?? 'n/a'),
        finalGroundingStatus: resolved.groundingStatus,
        groundingValidatorStarted: true,
        groundingValidatorCompleted: true,
        repairAttempted: Boolean(repairAttempted) || resolved.clientFallbackUsed,
        fallbackUsed: Boolean(fallbackUsed) || resolved.clientFallbackUsed,
        clientFallbackUsed: resolved.clientFallbackUsed,
        backendRevision: typeof coverLetterBackendRevision === 'string' ? coverLetterBackendRevision : null,
        schemaMismatch:
          resolved.diagnostics.schemaMismatch ||
          coverLetterBackendRevision !== COVER_LETTER_GROUNDING_BACKEND_REVISION,
        contentLocale: requestedLocale,
        violationCount: typeof groundingViolations === 'number' ? groundingViolations : 0,
      });

      if (resolved.outcome === 'stale') {
        recordCoverLetterStateTransition(
          'stale_response_ignored',
          captureStateSnapshot(),
          captureStateSnapshot(),
        );
        return;
      }

      if (resolved.outcome === 'rejected' || !resolved.content.trim()) {
        const beforeReject = captureStateSnapshot();
        const restored = preservedActiveResultRef.current;
        if (restored && isActiveCoverLetterResultEligible(restored, requestedLocale, requestedGender, 'success')) {
          setActiveResult(restored);
          setCl(prev => ({ ...prev, content: restored.content }));
          setContentLocale(restored.locale);
          setGroundingStatus(restored.groundingStatus);
          setGenerationPhase('success');
          setHasGenerated(true);
          recordCoverLetterStateTransition('generation_failed_restore_previous', beforeReject, captureStateSnapshot({
            generationPhase: 'success',
            groundingStatus: restored.groundingStatus,
            resultSource: restored.source,
            contentLocale: restored.locale,
            contentLength: restored.content.length,
            lastActivationTimestamp: restored.activatedAt,
            downloadsAllowed: true,
            copyAllowed: true,
          }));
        } else {
          setGenerationPhase('error');
          setGroundingStatus(resolved.groundingStatus);
          recordCoverLetterStateTransition('generation_rejected', beforeReject, captureStateSnapshot({
            generationPhase: 'error',
            groundingStatus: resolved.groundingStatus,
            downloadsAllowed: false,
            copyAllowed: false,
          }));
        }
        setShowGroundingDiagnostics(true);
        if (resolved.toastKind === 'wrong_language') {
          toast.error(coverLetterWrongLanguage(requestedLocale));
        } else if (resolved.toastKind === 'grounding_failed') {
          toast.error(coverLetterGroundingFailed(requestedLocale));
        } else if (resolved.toastKind === 'api_unavailable') {
          toast.error(coverLetterAiUnavailable(requestedLocale));
        }
        return;
      }

      const beforeActivate = captureStateSnapshot();
      const normalizedContent = normalizeCoverLetterBody(
        resolved.content,
        fullName || currentCv?.personal?.fullName || '',
      );
      const source =
        resolved.groundingStatus === 'fallback' || resolved.clientFallbackUsed
          ? 'fallback'
          : resolved.groundingStatus === 'repaired'
            ? 'repaired'
            : 'passed';
      const nextActive = createCoverLetterActiveResult({
        content: normalizedContent,
        locale: requestedLocale,
        gender: requestedGender,
        groundingStatus: resolved.groundingStatus,
        requestId,
        source,
      });
      if (!nextActive) {
        setGenerationPhase('error');
        setGroundingStatus('failed');
        setShowGroundingDiagnostics(true);
        toast.error(coverLetterGroundingFailed(requestedLocale));
        return;
      }

      setCl(prev => ({
        ...prev,
        content: normalizedContent,
        updatedAt: new Date().toISOString(),
      }));
      setActiveResult(nextActive);
      setContentLocale(requestedLocale);
      setGroundingStatus(nextActive.groundingStatus);
      setGenerationPhase('success');
      setHasGenerated(true);
      if (resolved.clientFallbackUsed || resolved.diagnostics.schemaMismatch) {
        setShowGroundingDiagnostics(true);
      }
      recordCoverLetterStateTransition(
        resolved.outcome === 'recovered' ? 'activation_recovered_fallback' : 'activation_success',
        beforeActivate,
        captureStateSnapshot({
          generationPhase: 'success',
          groundingStatus: nextActive.groundingStatus,
          resultSource: nextActive.source,
          contentLocale: requestedLocale,
          contentLength: normalizedContent.length,
          lastActivationTimestamp: nextActive.activatedAt,
          downloadsAllowed: true,
          copyAllowed: true,
          isGenerating: false,
        }),
      );

      if (!isCurrentPro) {
        if (mode === 'generate') {
          resetClRegen();
          incrementClGeneration();
        } else {
          incrementClRegen();
        }
      } else {
        recordProAiSuccess();
      }
      toast.success(t.coverLetter.genSuccess);
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'AbortError') return;

      const resolved = resolveCoverLetterGenerationResult({
        active: activeGenerationRef.current,
        requestId,
        requestedLocale,
        selectedLocale: requestedLocale,
        selectedGenderRaw: cl.gender || '',
        requestedGenderNormalized: requestedGender,
        apiError: {
          message: String((err as Error)?.message ?? err),
          status: (err as { status?: number }).status,
          name: (err as { name?: string }).name,
        },
        httpStatus: (err as { status?: number }).status ?? null,
        candidateName: fullName || currentCv?.personal?.fullName || '',
        jobTitle: cl.jobTitle,
        companyName: cl.companyName,
        factSet,
        tone: cl.tone,
      });

      updateCoverLetterGroundingDiagnostics({
        serverGroundingStatus: 'n/a',
        finalGroundingStatus: resolved.groundingStatus,
        groundingValidatorStarted: true,
        groundingValidatorCompleted: true,
        repairAttempted: false,
        fallbackUsed: resolved.clientFallbackUsed,
        clientFallbackUsed: resolved.clientFallbackUsed,
        contentLocale: requestedLocale,
      });

      if (resolved.outcome === 'stale') {
        recordCoverLetterStateTransition(
          'stale_error_ignored',
          captureStateSnapshot(),
          captureStateSnapshot(),
        );
        return;
      }

      if (resolved.toastKind === 'auth') {
        if (getAiGate().status !== 'free') {
          toast.error(t.common.proAuthorizationUnavailable);
        } else {
          setPaywallReason(mode);
          setProModal(true);
        }
        const restored = preservedActiveResultRef.current;
        if (restored) {
          setActiveResult(restored);
          setContentLocale(restored.locale);
          setGroundingStatus(restored.groundingStatus);
          setGenerationPhase('success');
        } else {
          setGenerationPhase('error');
          setGroundingStatus('failed');
        }
        return;
      }

      if (resolved.outcome === 'recovered' && resolved.content.trim()) {
        const beforeRecover = captureStateSnapshot();
        const normalizedContent = normalizeCoverLetterBody(
          resolved.content,
          fullName || currentCv?.personal?.fullName || '',
        );
        const nextActive = createCoverLetterActiveResult({
          content: normalizedContent,
          locale: requestedLocale,
          gender: requestedGender,
          groundingStatus: 'fallback',
          requestId,
          source: 'fallback',
        });
        if (nextActive) {
          setCl(prev => ({
            ...prev,
            content: normalizedContent,
            updatedAt: new Date().toISOString(),
          }));
          setActiveResult(nextActive);
          setContentLocale(requestedLocale);
          setGroundingStatus(nextActive.groundingStatus);
          setGenerationPhase('success');
          setHasGenerated(true);
          setShowGroundingDiagnostics(true);
          recordCoverLetterStateTransition('api_error_recovered_fallback', beforeRecover, captureStateSnapshot({
            generationPhase: 'success',
            groundingStatus: 'fallback',
            resultSource: 'fallback',
            contentLocale: requestedLocale,
            contentLength: normalizedContent.length,
            lastActivationTimestamp: nextActive.activatedAt,
            downloadsAllowed: true,
            copyAllowed: true,
          }));
          if (!isCurrentPro) {
            if (mode === 'generate') {
              resetClRegen();
              incrementClGeneration();
            } else {
              incrementClRegen();
            }
          } else {
            recordProAiSuccess();
          }
          toast.success(t.coverLetter.genSuccess);
          return;
        }
      }

      if (process.env.NODE_ENV !== 'production') console.error('[Cover Letter] Generation error:', err);
      const beforeFail = captureStateSnapshot();
      const restored = preservedActiveResultRef.current;
      if (restored && isActiveCoverLetterResultEligible(restored, requestedLocale, requestedGender, 'success')) {
        setActiveResult(restored);
        setCl(prev => ({ ...prev, content: restored.content }));
        setContentLocale(restored.locale);
        setGroundingStatus(restored.groundingStatus);
        setGenerationPhase('success');
        setHasGenerated(true);
        recordCoverLetterStateTransition('api_error_restore_previous', beforeFail, captureStateSnapshot({
          generationPhase: 'success',
          groundingStatus: restored.groundingStatus,
          resultSource: restored.source,
          downloadsAllowed: true,
          copyAllowed: true,
        }));
      } else {
        setGenerationPhase('error');
        setGroundingStatus(resolved.groundingStatus);
        setShowGroundingDiagnostics(true);
        recordCoverLetterStateTransition('api_error_no_recovery', beforeFail, captureStateSnapshot({
          generationPhase: 'error',
          downloadsAllowed: false,
          copyAllowed: false,
        }));
        if (resolved.toastKind === 'grounding_failed') {
          toast.error(coverLetterGroundingFailed(requestedLocale));
        } else if (resolved.toastKind === 'wrong_language') {
          toast.error(coverLetterWrongLanguage(requestedLocale));
        } else {
          toast.error(coverLetterAiUnavailable(requestedLocale));
        }
      }
    } finally {
      if (activeGenerationRef.current?.requestId === requestId) {
        const beforeCleanup = captureStateSnapshot();
        setIsGenerating(false);
        setIsRegenerating(false);
        activeGenerationRef.current = null;
        generationAbortRef.current = null;
        recordCoverLetterStateTransition('request_cleanup_finally', beforeCleanup, captureStateSnapshot({
          activeRequestPresent: false,
          requestId: activeResultRef.current?.requestId ?? null,
          isGenerating: false,
          // content / grounding / active result intentionally unchanged
          contentLength: (activeResultRef.current?.content ?? cl.content).length,
          groundingStatus: activeResultRef.current?.groundingStatus ?? groundingStatus,
          resultSource: activeResultRef.current?.source ?? null,
          lastActivationTimestamp: activeResultRef.current?.activatedAt ?? null,
          contentLocale: activeResultRef.current?.locale ?? contentLocale,
          downloadsAllowed: isActiveCoverLetterResultEligible(
            activeResultRef.current,
            requestedLocale,
            requestedGender,
            generationPhase === 'loading' ? 'success' : generationPhase,
          ),
          copyAllowed: isActiveCoverLetterResultEligible(
            activeResultRef.current,
            requestedLocale,
            requestedGender,
            generationPhase === 'loading' ? 'success' : generationPhase,
          ),
        }));
      }
    }
  };

  /** Derive the full candidate name from the CL identity fields */
  const getFullName = (): string => {
    const first = cl.firstName.trim();
    const last = cl.lastName.trim();
    if (first && last) return `${first} ${last}`;
    return first || last || '';
  };

  const getExportCandidateName = (): string => {
    const formName = getFullName();
    if (formName) return formName;
    const cvName = currentCv?.personal?.fullName?.trim();
    if (cvName) return cvName;
    return resolveExportCandidateName(
      exportBodyContent || cl.content,
      '',
      locale,
      getDefaultCoverLetterClosing(locale),
    );
  };

  const handleClPDFDownload = async () => {
    if (!downloadsAllowed) {
      toast.error(coverLetterStaleContent(selectedLocale));
      return;
    }
    if (!canDownload('cl')) {
      setShowDownloadMenu(false);
      setDownloadLimitModal(true);
      return;
    }
    if (isPdfExporting) return;
    setShowDownloadMenu(false);
    setIsPdfExporting(true);
    const filename = cl.companyName
      ? `${t.coverLetter.filename} - ${cl.companyName}`
      : t.coverLetter.filename;
    try {
      await exportCoverLetterToPDF(getExportCandidateName(), exportBodyContent, filename, locale, cl.companyName);
      incrementDownloads('cl');
      setShowArabicPdfDiagnostics(false);
    } catch (err: unknown) {
      if (err instanceof CoverLetterExportIncompleteError) {
        toast.error('Cover letter is incomplete. Please regenerate before exporting.');
        return;
      }
      if (err instanceof Error && err.name === 'SaveCancelledError') return;
      if (process.env.NODE_ENV !== 'production') console.error('[Cover Letter PDF export] failed:', err);
      if (selectedLocale === 'ar') setShowArabicPdfDiagnostics(true);
      toast.error(t.cv.pdfExportFailed);
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleClDOCXDownload = async () => {
    if (!downloadsAllowed) {
      toast.error(coverLetterStaleContent(selectedLocale));
      return;
    }
    if (!canDownload('cl')) {
      setShowDownloadMenu(false);
      setDownloadLimitModal(true);
      return;
    }
    if (isWordExporting) return;
    setShowDownloadMenu(false);
    setIsWordExporting(true);
    try {
      await exportCoverLetterToDOCX(exportBodyContent, `${t.coverLetter.filename} - ${cl.companyName}`, getExportCandidateName(), locale, cl.companyName);
      incrementDownloads('cl');
    } catch (err: unknown) {
      if (err instanceof CoverLetterExportIncompleteError) {
        toast.error('Cover letter is incomplete. Please regenerate before exporting.');
        return;
      }
      if (err instanceof Error && err.name === 'SaveCancelledError') return;
      if (process.env.NODE_ENV !== 'production') console.error('[Cover Letter DOCX export] failed:', err);
      toast.error(t.cv.wordExportFailed);
    } finally {
      setIsWordExporting(false);
    }
  };

  const handleGenerate = async () => {
    await runCoverLetterGeneration('cover-letter-gen', 'generate');
  };

  const handleRegenerate = async () => {
    await runCoverLetterGeneration('cover-letter-regen', 'regenerate');
  };

  const handleSave = () => {
    setCurrentCoverLetter(cl);
    toast.success(t.coverLetter.saved);
  };

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";
  const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed";
  const btnSecondary = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent";

  const regenExhausted = !canRegenerateCoverLetter();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">{t.coverLetter.title}</h1>
              <div className="flex items-center gap-3">
                {/* "Draft saved" indicator — appears briefly after autosave */}
                {lastClSavedAt > 0 && Date.now() - lastClSavedAt < 3000 && (
                  <span className="text-xs text-muted-foreground animate-pulse" key={lastClSavedAt}>
                    {t.coverLetter.draftSaved || 'Draft saved'}
                  </span>
                )}
                <button onClick={handleSave} className={btnPrimary}>{t.common.save}</button>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Form */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">

                {/* Identity section */}
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <User className="h-3.5 w-3.5" />
                    {t.coverLetter.identitySection}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">{t.coverLetter.firstName}</label>
                      <input
                        value={cl.firstName}
                        onChange={e => setCl(prev => ({ ...prev, firstName: e.target.value }))}
                        className={inputClass}
                        placeholder={t.coverLetter.firstNamePlaceholder}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">{t.coverLetter.lastName}</label>
                      <input
                        value={cl.lastName}
                        onChange={e => setCl(prev => ({ ...prev, lastName: e.target.value }))}
                        className={inputClass}
                        placeholder={t.coverLetter.lastNamePlaceholder}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">{t.coverLetter.gender}</label>
                    <div className="flex gap-2">
                      {([
                        { value: 'male', label: t.coverLetter.genderMale },
                        { value: 'female', label: t.coverLetter.genderFemale },
                        { value: 'prefer_not_to_say', label: t.coverLetter.genderPreferNot },
                      ] as { value: CoverLetterData['gender']; label: string }[]).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCl(prev => ({ ...prev, gender: prev.gender === opt.value ? '' : opt.value }))}
                          className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${cl.gender === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-accent'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t.coverLetter.jobTitle}</label>
                  <input value={cl.jobTitle} onChange={e => setCl(prev => ({ ...prev, jobTitle: e.target.value }))} className={inputClass} placeholder={t.cv.jobTitlePlaceholder} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t.coverLetter.companyName}</label>
                  <input value={cl.companyName} onChange={e => setCl(prev => ({ ...prev, companyName: e.target.value }))} className={inputClass} placeholder={t.coverLetter.companyPlaceholder} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">{t.coverLetter.tone}</label>
                  <div className="flex gap-2">
                    {(['formal', 'confident', 'friendly'] as Tone[]).map(tone => (
                      <button
                        key={tone}
                        onClick={() => setCl(prev => ({ ...prev, tone }))}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${cl.tone === tone ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-accent'}`}
                      >
                        {t.coverLetter.tones[tone]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <div className="relative">
                  <PremiumAIButton
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    icon={Sparkles}
                    label={isGenerating ? t.common.loading : t.coverLetter.generate}
                    subtitle={isGenerating ? undefined : t.coverLetter.generateSubtitle}
                    badge={<AIBadge />}
                    showArrow
                  />
                  {!isGenerating && (
                    <button
                      type="button"
                      onClick={() => setShowAiTooltip(v => !v)}
                      className={cn(
                        'absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#c9a84c]/30 bg-[#141208] text-[#8b95aa] transition-colors',
                        'hover:text-[#c9a84c]'
                      )}
                      aria-label={t.about.aiDisclosure.title}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <AnimatePresence>
                    {showAiTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/60 px-3 py-2.5 shadow-md"
                      >
                        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                          {t.about.ageAndContent.disclaimer}
                        </p>
                        <button onClick={() => setShowAiTooltip(false)} className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 underline">{t.common.cancel}</button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Free limit notice */}
                {!isPro && !canGenerateCoverLetter() && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 flex items-start gap-2">
                    <Crown className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">{t.coverLetter.paywallMessage}</p>
                  </div>
                )}

                {/* AI badge + disclaimer */}
                <div className="rounded-lg border border-blue-100 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-3 py-2.5 space-y-1">
                  <p className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 font-medium">
                    <Sparkles className="h-3 w-3 flex-shrink-0" />
                    {t.about.aiDisclosure.items[1]}
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed">
                    {t.about.aiDisclosure.items[0]}
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{t.coverLetter.preview}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(!editing)} className={btnSecondary}>
                      <Pencil className="h-4 w-4" />{editing ? t.coverLetter.preview : t.coverLetter.edit}
                    </button>
                  </div>
                </div>
                {editing ? (
                  <textarea
                    value={cl.content}
                    onChange={e => {
                      const next = e.target.value;
                      setCl(prev => ({ ...prev, content: next }));
                      setContentLocale(selectedLocale);
                      setGenerationPhase('success');
                      const edited = createCoverLetterActiveResult({
                        content: next,
                        locale: selectedLocale,
                        gender: selectedGenderNormalized,
                        groundingStatus: 'passed',
                        requestId: activeResult?.requestId ?? 'user-edit',
                        source: 'passed',
                      });
                      setActiveResult(edited);
                      setGroundingStatus(edited ? 'passed' : 'unknown');
                    }}
                    dir={previewIsRtl ? 'rtl' : 'ltr'}
                    className={cn(
                      'w-full rounded-lg border border-input bg-background p-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[400px] resize-y',
                      previewIsRtl ? 'text-right' : 'font-mono',
                    )}
                    style={previewIsRtl ? { unicodeBidi: 'plaintext' } : undefined}
                  />
                ) : (
                  <div
                    id="cl-preview"
                    data-cl-arabic-preview={previewIsRtl ? 'true' : undefined}
                    dir={previewIsRtl ? 'rtl' : 'ltr'}
                    className={cn(
                      'min-h-[400px] whitespace-pre-line rounded-lg bg-white p-6 text-sm text-gray-800 shadow-inner border border-gray-100 relative',
                      previewIsRtl && 'text-right',
                    )}
                    style={previewIsRtl ? { unicodeBidi: 'plaintext', letterSpacing: 'normal' } : undefined}
                  >
                    {isGenerationBusy ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/80">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">{t.coverLetter.generating}</p>
                      </div>
                    ) : null}
                    {previewContent || <span className="text-gray-400 italic">{t.coverLetter.placeholder}</span>}
                  </div>
                )}

                <CoverLetterGenerationDiagnosticsButton
                  show={
                    generationPhase === 'success' ||
                    generationPhase === 'error' ||
                    showGroundingDiagnostics
                  }
                />

                {/* Regenerate section — shown after first generation */}
                {hasGenerated && (
                  <div className="mt-4 rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] p-3 shadow-[0_4px_20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)]" style={{backgroundImage:'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 60%)'}}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <PremiumAIButton
                          onClick={handleRegenerate}
                          disabled={regenExhausted || isRegenerating}
                          icon={RefreshCw}
                          label={isRegenerating ? t.coverLetter.regenerating : t.coverLetter.regenerate}
                          subtitle={isRegenerating ? undefined : t.coverLetter.regenerateSubtitle}
                          badge={
                            !isPro && !regenExhausted
                              ? <span className="inline-flex items-center rounded-full border border-[rgba(212,178,84,0.32)] bg-[#12100a] px-2 py-[3px] text-[10px] font-bold tracking-[0.14em] text-[#c9a84c] whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">1 {t.coverLetter.regenLeft}</span>
                              : <AIBadge />
                          }
                          showArrow
                        />
                    </div>
                    {regenExhausted && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t.coverLetter.regenExhausted}
                      </p>
                    )}
                  </div>
                )}

                {(previewContent || isGenerationBusy) && (
                  <>
                    <div className="mt-4 flex gap-2 flex-wrap items-center">
                      {/* Download dropdown */}
                      <div className="relative" ref={downloadMenuRef}>
                        <button
                          onClick={() => setShowDownloadMenu(v => !v)}
                          className={btnPrimary + ' flex items-center gap-1'}
                          disabled={!downloadsAllowed || isPdfExporting || isWordExporting}
                        >
                          <Download className="h-4 w-4" />
                          {isPdfExporting || isWordExporting ? '...' : t.coverLetter.downloadCl}
                          <ChevronDown className="h-3 w-3 ml-0.5" />
                        </button>
                        {showDownloadMenu && (
                          <div className="absolute left-0 top-full mt-1 z-50 min-w-[220px] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                            <button
                              onClick={handleClPDFDownload}
                              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                              disabled={!downloadsAllowed || isPdfExporting}
                            >
                              <File className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                              <div>
                                <div className="font-semibold text-sm">{t.cv.downloadPdf}</div>
                                <div className="text-xs text-muted-foreground">{t.cv.downloadPdfDesc}</div>
                              </div>
                            </button>
                            <button
                              onClick={handleClDOCXDownload}
                              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-t border-border"
                              disabled={!downloadsAllowed || isWordExporting}
                            >
                              <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="font-semibold text-sm">{t.cv.downloadDocx}</div>
                                <div className="text-xs text-muted-foreground">{t.cv.downloadDocxDesc}</div>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (!previewContent) return;
                          exportToClipboard('cl-preview');
                          toast.success(t.cv.copied);
                        }}
                        className={btnSecondary}
                        disabled={!downloadsAllowed}
                      >
                        <Copy className="h-4 w-4" />{t.cv.copy}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">{t.cv.downloadNote}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground italic">
                      {t.coverLetter.aiDisclaimer}
                    </p>
                    <CoverLetterArabicPdfDiagnosticsButton
                      show={selectedLocale === 'ar' && showArabicPdfDiagnostics}
                    />
                    <CoverLetterGroundingDiagnosticsButton show={showGroundingDiagnostics} />
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      <Footer />
      <CoverLetterProModal
        open={proModal}
        onClose={() => setProModal(false)}
        reason={paywallReason}
      />
      <FreeLimitModal
        open={downloadLimitModal}
        type="cl"
        onClose={() => setDownloadLimitModal(false)}
      />
    </div>
  );
}
