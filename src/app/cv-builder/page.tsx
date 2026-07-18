'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useI18n } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/translations';
import { useApp, checkProAccess } from '@/lib/store';
import {
  beginAiClientRequest,
  finishAiClientRequest,
  precheckAiCircuit,
  resolveAiHttpFailure,
} from '@/lib/ai-client-request';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import { logAiLocaleTransitionDiagnostics } from '@/lib/ai-usage-policy';
import {
  AI_CLIENT_TIMEOUT_MS,
  logAiClientRequestTiming,
  resolveClientAbortTimeoutMs,
} from '@/lib/ai-request-timing';
import { templateComponents } from '@/components/cv-templates';
import { analyzeJobDescription } from '@/lib/ai';
import { industryOptions, levelOptions, type BulletIndustry, type BulletLevel } from '@/lib/ai-bullets';
import { exportAtsStandardPdf, exportCleanSimplePdf, exportContemporaryBoldPdf, exportCorporateNavyPdf, exportCreativeArtisticPdf, exportCreativeBoldPdf, exportElegantFormalPdf, exportExecutivePremiumPdf, exportModernMinimalPdf, exportNordicCleanPdf, exportProfessionalClassicPdf, exportRirekishoPdf, exportTechSidebarPdf, exportToClipboard, exportToDOCX, exportRirekishoToDOCX, exportToPDF, openPrintFallback, assertDedicatedPdfRouteWasHandled, readPdfExportTemplateIdFromPreview, recordCvPdfExportRuntimeTrace, resolveCvForPdfExport, resolveCvPdfExportRoute } from '@/lib/export';
import { makeCvExportBaseName } from '@/lib/export-filename';
import { getCvExportSuccessToast, type ExportFileFormat } from '@/lib/export-success-toast';
import {
  CvExportFailure,
  extractCvExportFailureReason,
  formatCvExportIntegrityToast,
  wrapCvExportFailure,
} from '@/lib/cv-export-error-message';
import {
  buildAndStoreCvExportDiagnostic,
  copyCvExportDiagnosticsToClipboard,
  resolveAppVersionInfo,
  resolveNextBuildId,
} from '@/lib/cv-export-diagnostics';
import {
  copyExperienceAiDiagnosticsToClipboard,
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import { INTERNAL_AI_RESET_ENABLED } from '@/lib/build-channel';
import { ExperienceAiCopyDiagnosticsButton } from '@/components/CvExportDiagnosticsControls';
import type { SaveFileResult } from '@/lib/native-save';
import {
  CV_RUNTIME_MIGRATION_VERSION,
  normalizeLegacyCvRuntime,
} from '@/lib/cv-legacy-runtime-migration';
import {
  filterCvLanguageOptions,
  getLocalizedCvLanguageName,
  resolveStoredCvLanguageName,
  type CvLanguageOption,
} from '@/lib/cv-language-options';
import {
  filterCvSkillOptions,
  getLocalizedCvSkillName,
  resolveStoredCvSkillName,
  getSkillSuggestionsByJobTitle,
  getSkillSuggestionsByJobTitles,
  getSkillSuggestionsByIndustry,
  getSkillCategory,
  type CvSkillOption,
} from '@/lib/cv-skill-options';
import { createEmptyCv } from '@/lib/cv-defaults';
import type { CVData, WorkExperience, Education, Region, TemplateId } from '@/lib/types';
import { templateInfo, recommendTemplate } from '@/lib/types';
import {
  ensureCanonicalExperienceFrozen,
  freezeCanonicalExperienceDescription,
} from '@/lib/cv-canonical-facts';
import {
  applyCanonicalExperienceEdit,
  applyCanonicalSkillsLanguagesEducationEdit,
  applyCanonicalSummaryEdit,
} from '@/lib/cv-canonical-snapshot';
import { buildExperienceDurationSnapshot, durationToPromptToken } from '@/lib/cv-experience-duration';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import {
  applyFinalizedBulletsToCv,
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildExperienceJobContext,
  experienceJobContextsMatch,
  resolveExperienceAiGrounding,
  candidateConflictsWithJobContext,
  type ExperienceAiJobContextTrace,
} from '@/lib/cv-experience-job-context';
import {
  localizeCvLanguageLevel,
  normalizeCvLanguagesProficiency,
  normalizeLanguageProficiencyToCanonical,
} from '@/lib/cv-language-levels';
import {
  omitInvalidLocalizedFieldsForPreview,
} from '@/lib/cv-field-locale-integrity';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { prepareCorporateNavyExport } from '@/lib/corporate-navy-export-integrity';
import {
  prepareExportReadyCv,
  type PrepareExportReadyResult,
} from '@/lib/prepare-export-ready-cv';
import { loadCvDraft } from '@/lib/draft-storage';
import { apiFetch } from '@/lib/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles, Plus, Trash2, Eye, FileText, Copy,
  Search, ChevronLeft, ChevronRight, Wand2, Crown, Star, Lock,
  Download, ChevronDown, File, Maximize2
} from 'lucide-react';
import { PhotoUpload } from '@/components/PhotoUpload';
import { MonthPicker } from '@/components/MonthPicker';
import { UpgradeBuilderBanner, FreeLimitModal, JobAnalyzerProModal, AiImprovementsProModal, SummaryAiProModal, ProTemplateModal, AiRecommendProModal } from '@/components/UpgradePro';
import { PremiumAIButton, ProBadge } from '@/components/PremiumAIButton';
import { JobAnalysisResultScreen, JobAnalysisLoadingState } from '@/components/JobAnalysisResultScreen';
import { TemplatePreview } from '@/components/TemplatePreview';
import { CvExportCopyDiagnosticsButton } from '@/components/CvExportDiagnosticsControls';
import { TemplatePreviewFullscreenModal } from '@/components/TemplatePreviewFullscreenModal';
import {
  createElegantFormalPortraitPhoto,
  isCleanElegantFormalPortraitPhoto,
  prepareElegantFormalCanonicalPhoto,
  type ElegantFormalCanonicalPhotoResult,
} from '@/lib/elegant-formal-photo';

const emptyCV = createEmptyCv;

const emptyExp = (): WorkExperience => ({
  id: crypto.randomUUID(),
  company: '',
  position: '',
  startDate: '',
  endDate: '',
  isPresent: false,
  description: '',
  canonicalDescription: '',
});

const emptyEdu = (): Education => ({
  id: crypto.randomUUID(), school: '', degree: '', startDate: '', endDate: '', description: '',
});

const RECT_PHOTO_TEMPLATES: TemplateId[] = ['elegant-formal', 'executive-premium'];

type PersonalPhotoVariants = {
  originalPhoto?: string;
  rectangularPhoto?: string;
  circularPhoto?: string;
};

function getPersonalPhotoVariants(cvData: CVData): PersonalPhotoVariants {
  const personal = cvData.personal as typeof cvData.personal & PersonalPhotoVariants;
  return {
    originalPhoto: personal.originalPhoto,
    rectangularPhoto: personal.rectangularPhoto,
    circularPhoto: personal.circularPhoto,
  };
}

function describeElegantFormalPhotoField(fieldName: string, value?: string): string {
  if (!value) return `${fieldName}=missing`;
  const mime = value.match(/^data:([^;,]+)/i)?.[1] ?? 'unknown';
  return `${fieldName}=present mime=${mime} length=${value.length}`;
}

function stripPhotoCacheFragment(value?: string): string | undefined {
  return value?.split('#')[0];
}

export default function CVBuilderPage() {
  const { t, locale } = useI18n();
  const { currentCv, setCurrentCv, isPro, canDownload, incrementDownloads, markAiRecommendUsed, recordProAiSuccess, getProAiUsageCount, lastCvSavedAt, getAiGate } = useApp();
  const [cv, setCv] = useState<CVData>(currentCv || emptyCV());
  const cvRef = useRef<CVData>(cv);
  /** Last prepareExportReadyCv result for release diagnostics (non-PII). */
  const lastExportPrepareRef = useRef<PrepareExportReadyResult | null>(null);
  const lastExportRawCvRef = useRef<CVData | null>(null);
  const [exportDiagTick, setExportDiagTick] = useState(0);
  // Stale-response correlation: each AI action tracks the requestId of its
  // most-recently-started request. An in-flight request whose id no longer
  // matches when its response arrives is a stale/out-of-order response and
  // must never be applied, regardless of which locale it was requested in.
  const latestSummaryRequestIdRef = useRef<string | null>(null);
  const latestBulletsRequestIdRef = useRef<Record<string, string>>({});
  /** Race guard: latest job-context key per experience for bullets AI. */
  const latestBulletsContextKeyRef = useRef<Record<string, string>>({});
  const latestRewriteRequestIdRef = useRef<string | null>(null);
  const commitCvUpdate = useCallback((updater: (prev: CVData) => CVData) => {
    setCv((prev) => {
      const next = updater(prev);
      cvRef.current = next;
      if (next.templateId !== prev.templateId) {
        setCurrentCv(next);
      }
      return next;
    });
  }, [setCurrentCv]);
  const [step, setStep] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [certInput, setCertInput] = useState('');
  const [langName, setLangName] = useState('');
  const [langLevel, setLangLevel] = useState('');
  const [selectedLanguageName, setSelectedLanguageName] = useState<string | null>(null);
  const [showLanguageSuggestions, setShowLanguageSuggestions] = useState(false);
  const [jobDesc, setJobDesc] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{ missingSkills: string[]; keywords: string[]; suggestions: string[] } | null>(null);
  const [limitModal, setLimitModal] = useState<{ open: boolean; type: 'cv' | 'cl' }>({ open: false, type: 'cv' });
  const [jobAnalyzerModal, setJobAnalyzerModal] = useState(false);
  const [aiImprovementsModal, setAiImprovementsModal] = useState(false);
  const [summaryAiModal, setSummaryAiModal] = useState(false);
  const [proTemplateModal, setProTemplateModal] = useState(false);
  const [aiRecommendModal, setAiRecommendModal] = useState(false);
  const [expIndustry, setExpIndustry] = useState<Record<string, BulletIndustry>>({});
  const [expLevel, setExpLevel] = useState<Record<string, BulletLevel>>({});
  const [isSummaryGenerating, setIsSummaryGenerating] = useState(false);
  const [rewritingStyle, setRewritingStyle] = useState<string | null>(null);
  const [generatingBulletsId, setGeneratingBulletsId] = useState<string | null>(null);
  const [activeLanguageSuggestionIndex, setActiveLanguageSuggestionIndex] = useState(-1);
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const [recommendedTemplateId, setRecommendedTemplateId] = useState<TemplateId | null>(null);
  const [fullscreenTemplateId, setFullscreenTemplateId] = useState<TemplateId | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isWordExporting, setIsWordExporting] = useState(false);
  const stepButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const skillInputRef = useRef<HTMLInputElement | null>(null);
  const skillAutocompleteRef = useRef<HTMLDivElement | null>(null);
  const langInputRef = useRef<HTMLInputElement | null>(null);
  const langAutocompleteRef = useRef<HTMLDivElement | null>(null);
  const langSuggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (currentCv) {
      setCv(currentCv);
      cvRef.current = currentCv;
    }
  }, [currentCv]);

  useEffect(() => {
    cvRef.current = cv;
  }, [cv]);

  // Commit legacy runtime migration atomically to React state, cvRef, and draft storage
  // so preview/PDF/DOCX cannot read a stale pre-migration snapshot.
  useEffect(() => {
    const source = cvRef.current;
    if (Number(source.runtimeMigrationVersion || 0) >= CV_RUNTIME_MIGRATION_VERSION) return;
    const migrated = normalizeLegacyCvRuntime(source, locale);
    cvRef.current = migrated;
    setCv(migrated);
    setCurrentCv(migrated);
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[CV runtime migration] committed', {
        fromVersion: Number(source.runtimeMigrationVersion || 0),
        toVersion: migrated.runtimeMigrationVersion,
        templateId: migrated.templateId,
        region: migrated.region,
        contentLocale: migrated.contentLocale,
        summaryOrigin: migrated.summaryOrigin,
        experienceCount: (migrated.experience || []).length,
      });
    }
  }, [locale, setCurrentCv, cv.id]);

  // ── Autosave: debounce-save to context (which persists to localStorage) ──────
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      setCurrentCv(cv);
    }, 800);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv]);

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

  const steps = [
    t.cv.personal,
    t.cv.experience,
    t.cv.education,
    t.cv.skills + ' & ' + t.cv.languages,
    t.cv.summary,
    t.cv.selectTemplate,
    t.cv.preview,
  ];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (langAutocompleteRef.current?.contains(event.target) || skillAutocompleteRef.current?.contains(event.target)) return;
      setShowLanguageSuggestions(false);
      setActiveLanguageSuggestionIndex(-1);
      setShowSkillSuggestions(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    stepButtonRefs.current[step]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [step]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;

      const tagName = target.tagName;
      return target.isContentEditable
        || tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT'
        || !!target.closest('[contenteditable="true"]');
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (showPreview || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target)) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStep(prev => Math.max(0, prev - 1));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStep(prev => Math.min(steps.length - 1, prev + 1));
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setStep(0);
      }

      if (event.key === 'End') {
        event.preventDefault();
        setStep(steps.length - 1);
      }

      if (event.key === 'PageUp') {
        event.preventDefault();
        setStep(prev => Math.max(0, prev - 1));
      }

      if (event.key === 'PageDown') {
        event.preventDefault();
        setStep(prev => Math.min(steps.length - 1, prev + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreview, steps.length]);

  const updatePersonal = (field: string, value: string) => {
    setCv(prev => ({ ...prev, personal: { ...prev.personal, [field]: value }, updatedAt: new Date().toISOString() }));
  };

  const addExperience = () => setCv(prev => ({ ...prev, experience: [...prev.experience, emptyExp()] }));
  const removeExperience = (id: string) => setCv(prev => ({ ...prev, experience: prev.experience.filter(e => e.id !== id) }));
  const updateExperience = (id: string, field: string, value: string | boolean) => {
    setCv((prev) => applyCanonicalExperienceEdit(prev, id, field, value, locale));
  };

  const addEducation = () => setCv(prev => ({ ...prev, education: [...prev.education, emptyEdu()] }));
  const removeEducation = (id: string) => setCv(prev => ({ ...prev, education: prev.education.filter(e => e.id !== id) }));
  const updateEducation = (id: string, field: string, value: string) => {
    setCv((prev) => applyCanonicalSkillsLanguagesEducationEdit(prev, {
      education: prev.education.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  };

  const addSkill = (option?: CvSkillOption) => {
    const typedSkill = skillInput.trim();
    const resolvedSkill = option?.canonicalName ?? resolveStoredCvSkillName(typedSkill) ?? typedSkill;
    if (!resolvedSkill) return;

    setCv((prev) => {
      const normalizedNextSkill = (resolveStoredCvSkillName(resolvedSkill) ?? resolvedSkill).trim().toLocaleLowerCase();

      if (prev.skills.some((skill) => (resolveStoredCvSkillName(skill) ?? skill).trim().toLocaleLowerCase() === normalizedNextSkill)) {
        return prev;
      }

      return applyCanonicalSkillsLanguagesEducationEdit(prev, {
        skills: [...prev.skills, resolvedSkill],
      });
    });

    setSkillInput('');
    setShowSkillSuggestions(false);
  };
  const removeSkill = (idx: number) => setCv((prev) => applyCanonicalSkillsLanguagesEducationEdit(prev, {
    skills: prev.skills.filter((_, i) => i !== idx),
  }));

  const addCert = () => { if (certInput.trim()) { setCv(prev => ({ ...prev, certifications: [...prev.certifications, certInput.trim()] })); setCertInput(''); } };

  const skillSuggestions = useMemo(
    () => filterCvSkillOptions(skillInput, locale, cv.skills),
    [cv.skills, locale, skillInput],
  );

  // Get the most recently set industry across all work experiences (or undefined)
  const latestSelectedIndustry = useMemo(() => {
    const values = Object.values(expIndustry);
    return values.length > 0 ? values[values.length - 1] : undefined;
  }, [expIndustry]);

  const smartSkillSuggestions = useMemo(() => {
    // If an industry is selected, prioritize industry-based suggestions
    if (latestSelectedIndustry && latestSelectedIndustry !== 'general') {
      const industrySuggestions = getSkillSuggestionsByIndustry(latestSelectedIndustry, locale, cv.skills, 10);
      if (industrySuggestions.length > 0) return industrySuggestions;
    }
    // Use ALL work experience positions for a combined skill pool
    const jobTitles = cv.experience.map((exp) => exp.position).filter(Boolean);
    if (jobTitles.length > 0) {
      const result = getSkillSuggestionsByJobTitles(jobTitles, locale, cv.skills, 15);
      return result;
    }
    // Fall back to the overall job title if no experience entries exist
    return getSkillSuggestionsByJobTitle(cv.personal.jobTitle || '', locale, cv.skills, 10);
  }, [cv.experience, cv.personal.jobTitle, cv.skills, locale, latestSelectedIndustry]);

  const languageSuggestions = useMemo(
    () => filterCvLanguageOptions(langName, locale, cv.languages.map((language) => language.name)),
    [cv.languages, langName, locale],
  );

  // ── Three-source photo state ─────────────────────────────────────────────────
  // originalPhotoDataUrl: raw file from disk — NEVER circular/rect cropped.
  //   Set when PhotoUpload calls onChange with the third argument.
  // circularPhotoDataUrl: circular-clip PNG, used by circle-shaped templates.
  // rectangularPhotoDataUrl: 3:4 JPEG derived from originalPhotoDataUrl (not from the circular crop).
  const [originalPhotoDataUrl, setOriginalPhotoDataUrl] = useState<string | undefined>(
    () => {
      const draft = loadCvDraft();
      return getPersonalPhotoVariants(draft?.cv ?? cv).originalPhoto ?? draft?.originalPhoto;
    },
  );
  const [circularPhotoDataUrl, setCircularPhotoDataUrl] = useState<string | undefined>(
    () => {
      const draft = loadCvDraft();
      return getPersonalPhotoVariants(draft?.cv ?? cv).circularPhoto ?? draft?.circularPhoto;
    },
  );
  const [rectangularPhotoDataUrl, setRectangularPhotoDataUrl] = useState<string | undefined>(
    () => {
      const draft = loadCvDraft();
      return getPersonalPhotoVariants(draft?.cv ?? cv).rectangularPhoto ?? draft?.rectangularPhoto;
    },
  );
  const [validatedElegantFormalFallbackPhoto, setValidatedElegantFormalFallbackPhoto] = useState<string | undefined>(undefined);

  useEffect(() => {
    cvRef.current = cv;
  }, [cv]);

  // Migrate polluted translated proficiency strings → canonical enum keys once on hydrate / locale churn.
  useEffect(() => {
    setCv((prev) => {
      const next = normalizeCvLanguagesProficiency(prev);
      const same = (prev.languages || []).every((lang, i) => lang.level === next.languages?.[i]?.level)
        && (prev.languages || []).length === (next.languages || []).length;
      return same ? prev : next;
    });
  }, [locale]);

  // rectangularPhotoDataUrl is set directly by handlePhotoChange from the crop modal output.
  // No useEffect re-generation — the crop modal produces it with the user's exact framing.
  useEffect(() => {
    const variants = getPersonalPhotoVariants(cv);
    const sourceOriginal = variants.originalPhoto;
    if (cv.templateId !== 'elegant-formal' || !sourceOriginal || variants.rectangularPhoto) return;
    let cancelled = false;
    createElegantFormalPortraitPhoto(sourceOriginal)
      .then(({ dataUrl }) => {
        if (cancelled) return;
        setRectangularPhotoDataUrl(prev => (prev === dataUrl ? prev : dataUrl));
        setCv(prev => {
          if (getPersonalPhotoVariants(prev).rectangularPhoto === dataUrl) return prev;
          const next = { ...prev, personal: { ...prev.personal, rectangularPhoto: dataUrl }, updatedAt: new Date().toISOString() };
          cvRef.current = next;
          setCurrentCv(next);
          return next;
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [cv, cv.templateId, setCurrentCv]);

  useEffect(() => {
    const variants = getPersonalPhotoVariants(cv);
    const rectPhoto = variants.rectangularPhoto;
    if (cv.templateId !== 'elegant-formal' || variants.originalPhoto || !rectPhoto) {
      setValidatedElegantFormalFallbackPhoto(undefined);
      return;
    }
    let cancelled = false;
    isCleanElegantFormalPortraitPhoto(rectPhoto)
      .then((isClean) => {
        if (!cancelled) setValidatedElegantFormalFallbackPhoto(isClean ? rectPhoto : undefined);
      })
      .catch(() => {
        if (!cancelled) setValidatedElegantFormalFallbackPhoto(undefined);
      });
    return () => { cancelled = true; };
  }, [cv, cv.templateId]);

  const photoForCurrentTemplate = useMemo(() => (
    cv.templateId === 'elegant-formal'
      ? (getPersonalPhotoVariants(cv).originalPhoto ? getPersonalPhotoVariants(cv).rectangularPhoto : validatedElegantFormalFallbackPhoto)
      : RECT_PHOTO_TEMPLATES.includes(cv.templateId)
      ? (getPersonalPhotoVariants(cv).rectangularPhoto ?? rectangularPhotoDataUrl ?? cv.personal.photo)
      : (getPersonalPhotoVariants(cv).circularPhoto ?? circularPhotoDataUrl ?? cv.personal.photo)
  ), [circularPhotoDataUrl, cv, rectangularPhotoDataUrl, validatedElegantFormalFallbackPhoto]);

  const hasLoadedElegantFormalPreviewPhoto = useCallback((preferredPreviewId?: string): boolean => {
    if (typeof document === 'undefined') return false;
    const roots = [
      preferredPreviewId ? document.getElementById(preferredPreviewId) : null,
      document.getElementById('cv-preview'),
      document.getElementById('cv-inline-preview'),
    ].filter(Boolean) as HTMLElement[];
    return roots.some((root) => {
      const img = root.querySelector<HTMLImageElement>('[data-template-id="elegant-formal"] img');
      return Boolean(img?.src && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
    });
  }, []);

  const getElegantFormalPreviewPhotoSrc = useCallback((preferredPreviewId?: string): string | undefined => {
    if (typeof document === 'undefined') return undefined;
    const roots = [
      preferredPreviewId ? document.getElementById(preferredPreviewId) : null,
      document.getElementById('cv-preview'),
      document.getElementById('cv-inline-preview'),
    ].filter(Boolean) as HTMLElement[];
    for (const root of roots) {
      const img = root.querySelector<HTMLImageElement>('[data-template-id="elegant-formal"] img');
      const src = stripPhotoCacheFragment(img?.currentSrc || img?.src || img?.getAttribute('src') || undefined);
      if (src) return src;
    }
    return undefined;
  }, []);

  const ensureElegantFormalPhotoForExport = useCallback(async (preferredPreviewId?: string): Promise<ElegantFormalCanonicalPhotoResult | null> => {
    const liveCv = cvRef.current;
    if (liveCv.templateId !== 'elegant-formal') return null;
    const draft = loadCvDraft();
    const personalVariants = getPersonalPhotoVariants(liveCv);
    const draftVariants = draft ? getPersonalPhotoVariants(draft.cv) : {};
    const originalPhoto = personalVariants.originalPhoto ?? draftVariants.originalPhoto ?? draft?.originalPhoto;
    const rectangularPhoto = personalVariants.rectangularPhoto ?? draftVariants.rectangularPhoto ?? draft?.rectangularPhoto;
    const previewPhoto = getElegantFormalPreviewPhotoSrc(preferredPreviewId);
    const currentPhoto = stripPhotoCacheFragment(liveCv.personal.photo);

    const metadata = [
      describeElegantFormalPhotoField('cv.personal.originalPhoto', personalVariants.originalPhoto),
      describeElegantFormalPhotoField('cv.personal.rectangularPhoto', personalVariants.rectangularPhoto),
      describeElegantFormalPhotoField('cv.personal.circularPhoto', personalVariants.circularPhoto),
      describeElegantFormalPhotoField('cv.personal.photo', liveCv.personal.photo),
      describeElegantFormalPhotoField('local.originalPhotoDataUrl', originalPhotoDataUrl),
      describeElegantFormalPhotoField('local.rectangularPhotoDataUrl', rectangularPhotoDataUrl),
      describeElegantFormalPhotoField('preview.img.src', previewPhoto),
    ];

    const tryPrepare = async (
      input: Parameters<typeof prepareElegantFormalCanonicalPhoto>[0],
      sourceField: string,
    ): Promise<ElegantFormalCanonicalPhotoResult | null> => {
      try {
        const result = await prepareElegantFormalCanonicalPhoto(input);
        if (result) {
          if (process.env.NODE_ENV !== 'production') {
            console.info('[Elegant Formal export photo]', [...metadata, `selectedSource=${sourceField}`, 'code=ELEGANT_FORMAL_PHOTO_READY'].join(' | '));
          }
          return result;
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Elegant Formal export photo]', [...metadata, `selectedSource=${sourceField}`, `code=ELEGANT_FORMAL_PHOTO_PREPARE_FAILED`, `detail=${err instanceof Error ? err.message : 'unknown'}`].join(' | '));
        }
      }
      return null;
    };

    const preparedPhoto =
      await tryPrepare({ originalPhoto, rectangularPhoto }, originalPhoto ? 'cv.personal.originalPhoto' : rectangularPhoto ? 'cv.personal.rectangularPhoto' : 'none')
      ?? await tryPrepare({ rectangularPhoto: previewPhoto }, 'preview.img.src')
      ?? await tryPrepare({ rectangularPhoto: currentPhoto }, 'cv.personal.photo');

    if (preparedPhoto) {
      const { dataUrl } = preparedPhoto;
      setRectangularPhotoDataUrl(prev => (prev === dataUrl ? prev : dataUrl));
      setCv(prev => {
        const next = {
          ...prev,
          personal: {
            ...prev.personal,
            originalPhoto: originalPhoto ?? getPersonalPhotoVariants(prev).originalPhoto,
            rectangularPhoto: dataUrl,
            photo: dataUrl,
            photoEnabled: prev.personal.photoEnabled ?? true,
          },
          updatedAt: new Date().toISOString(),
        };
        cvRef.current = next;
        setCurrentCv(next);
        return next;
      });
      return preparedPhoto;
    }

    const variants = getPersonalPhotoVariants(liveCv);
    const hasPersistedPhotoField = Boolean(
      variants.originalPhoto
      || variants.rectangularPhoto
      || variants.circularPhoto
      || liveCv.personal.photo
    );
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Elegant Formal export photo]', [
        ...metadata,
        `selectedSource=${hasPersistedPhotoField || hasLoadedElegantFormalPreviewPhoto(preferredPreviewId) ? 'recoverable-source-rejected' : 'none'}`,
        `code=${hasPersistedPhotoField || previewPhoto ? 'ELEGANT_FORMAL_PHOTO_STATE_MISMATCH' : 'ELEGANT_FORMAL_NO_PHOTO'}`,
      ].join(' | '));
    }
    return null;
  }, [getElegantFormalPreviewPhotoSrc, hasLoadedElegantFormalPreviewPhoto, originalPhotoDataUrl, rectangularPhotoDataUrl, setCurrentCv]);

  const prepareElegantFormalPdfPhotoDataUrl = useCallback(async (): Promise<string | null> => {
    const liveCv = cvRef.current;
    if (liveCv.templateId !== 'elegant-formal') return null;
    const personalVariants = getPersonalPhotoVariants(liveCv);
    const originalPhoto = personalVariants.originalPhoto;
    const rectangularPhoto = originalPhoto ? undefined : personalVariants.rectangularPhoto;
    const selectedSource = originalPhoto
      ? 'cv.personal.originalPhoto'
      : rectangularPhoto
        ? 'cv.personal.rectangularPhoto'
        : 'none';

    try {
      const prepared = await prepareElegantFormalCanonicalPhoto({ originalPhoto, rectangularPhoto });
      if (!prepared) {
        if (originalPhoto) throw new Error('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
        if (process.env.NODE_ENV !== 'production') {
          console.info('[Elegant Formal PDF photo]', `selectedSource=${selectedSource} | code=ELEGANT_FORMAL_PDF_NO_VALID_SOURCE`);
        }
        return null;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.info('[Elegant Formal PDF photo]', [
          `selectedSource=${selectedSource}`,
          `sourceType=${prepared.source}`,
          `sourceDimensions=${prepared.metrics?.sourceWidth ?? 'unknown'}x${prepared.metrics?.sourceHeight ?? 'unknown'}`,
          `canonicalDimensions=${prepared.width}x${prepared.height}`,
          `mime=${prepared.mimeType}`,
          'code=ELEGANT_FORMAL_PDF_PHOTO_READY',
        ].join(' | '));
      }

      setRectangularPhotoDataUrl(prev => (prev === prepared.dataUrl ? prev : prepared.dataUrl));
      setCv(prev => {
        const next = {
          ...prev,
          personal: {
            ...prev.personal,
            originalPhoto: originalPhoto ?? getPersonalPhotoVariants(prev).originalPhoto,
            rectangularPhoto: prepared.dataUrl,
            photoEnabled: prev.personal.photoEnabled ?? true,
          },
          updatedAt: new Date().toISOString(),
        };
        cvRef.current = next;
        setCurrentCv(next);
        return next;
      });
      return prepared.dataUrl;
    } catch (err) {
      if (originalPhoto) throw new Error('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Elegant Formal PDF photo]', [
          `selectedSource=${selectedSource}`,
          'code=ELEGANT_FORMAL_PDF_PHOTO_PREPARE_FAILED',
          `detail=${err instanceof Error ? err.message : 'unknown'}`,
        ].join(' | '));
      }
      return null;
    }
  }, [setCurrentCv]);

  const localizedPreviewCv = useMemo<CVData>(
    () => {
      const migratedCv = normalizeLegacyCvRuntime(cv, locale);
      const qualityCv = applyCvContentQuality(migratedCv, locale, {
        gender: migratedCv.personal?.gender,
        summaryOrigin: migratedCv.summaryOrigin,
      }).cv;
      const localeSafeCv = omitInvalidLocalizedFieldsForPreview(qualityCv, locale);
      const base = {
        ...localeSafeCv,
        skills: localeSafeCv.skills.map((skill) => getLocalizedCvSkillName(skill, locale)),
        languages: localeSafeCv.languages.map((language) => ({
          ...language,
          name: getLocalizedCvLanguageName(language.name, locale),
        })),
      };
      if (RECT_PHOTO_TEMPLATES.includes(cv.templateId)) {
        // Rectangle templates: use rectangular photo derived from the original upload.
        // Append '#rect' cache-buster so the browser never reuses a stale circular decode.
        const rectUrl = cv.templateId === 'elegant-formal'
          ? (getPersonalPhotoVariants(cv).originalPhoto ? getPersonalPhotoVariants(cv).rectangularPhoto : validatedElegantFormalFallbackPhoto)
          : (getPersonalPhotoVariants(cv).rectangularPhoto ?? rectangularPhotoDataUrl ?? cv.personal.photo);
        if (rectUrl) {
          const cacheBustedUrl = rectUrl.includes('#') ? rectUrl : rectUrl + '#rect';
          return { ...base, personal: { ...base.personal, photo: cacheBustedUrl } };
        }
        // No original available — hide photo rather than show circular crop in a rect frame
        return { ...base, personal: { ...base.personal, photo: undefined } };
      }
      // Circle templates: use the circular crop stored in circularPhotoDataUrl.
      // Fall back to cv.personal.photo for any existing data loaded from storage.
      const circleUrl = getPersonalPhotoVariants(cv).circularPhoto ?? circularPhotoDataUrl;
      if (circleUrl) {
        return { ...base, personal: { ...base.personal, photo: circleUrl } };
      }
      return base;
    },
    [cv, locale, circularPhotoDataUrl, rectangularPhotoDataUrl, validatedElegantFormalFallbackPhoto],
  );

  useEffect(() => {
    if (!selectedLanguageName) return;
    setLangName(getLocalizedCvLanguageName(selectedLanguageName, locale));
  }, [locale, selectedLanguageName]);

  const selectLanguageSuggestion = (option: CvLanguageOption) => {
    setSelectedLanguageName(option.canonicalName);
    setLangName(option.localizedLabel);
    setShowLanguageSuggestions(false);
    setActiveLanguageSuggestionIndex(-1);
  };

  const focusLanguageInput = () => {
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => langInputRef.current?.focus());
      return;
    }

    langInputRef.current?.focus();
  };

  const addLanguage = (option?: CvLanguageOption) => {
    const resolvedName = option?.canonicalName
      ?? selectedLanguageName
      ?? resolveStoredCvLanguageName(langName);

    if (!resolvedName) return;

    setCv((prev) => {
      if (prev.languages.some((language) => language.name === resolvedName)) return prev;
      const canonicalLevel = normalizeLanguageProficiencyToCanonical(
        langLevel || 'intermediate',
      );
      return applyCanonicalSkillsLanguagesEducationEdit(prev, {
        languages: [
          ...prev.languages,
          { name: resolvedName, level: canonicalLevel || 'intermediate' },
        ],
      });
    });

    setLangName('');
    setLangLevel('');
    setSelectedLanguageName(null);
    setShowLanguageSuggestions(false);
  };

  const handlePhotoChange = (photo: string | undefined, enabled: boolean, originalPhoto?: string, rectPhoto?: string) => {
    // photo        = circle PNG (or rect JPEG when photoShape='rectangle' during the crop session)
    // originalPhoto = raw file data URL — kept for reference / re-crop
    // rectPhoto    = 300×400 JPEG generated with the exact same zoom/offset the user chose
    if (photo === undefined) {
      setOriginalPhotoDataUrl(undefined);
      setCircularPhotoDataUrl(undefined);
      setRectangularPhotoDataUrl(undefined);
      setCv(prev => {
        const next = {
          ...prev,
          personal: {
            ...prev.personal,
            photo: undefined,
            photoEnabled: enabled,
            originalPhoto: undefined,
            circularPhoto: undefined,
            rectangularPhoto: undefined,
          },
          updatedAt: new Date().toISOString(),
        };
        cvRef.current = next;
        setCurrentCv(next);
        return next;
      });
      return;
    }

    const nextOriginal = originalPhoto;
    const nextCircular = photo;
    const nextRectangular = rectPhoto;
    if (nextOriginal) setOriginalPhotoDataUrl(nextOriginal);
    setCircularPhotoDataUrl(nextCircular);
    if (nextRectangular) setRectangularPhotoDataUrl(nextRectangular);

    setCv(prev => {
      const next = {
        ...prev,
        personal: {
          ...prev.personal,
          photo,
          photoEnabled: enabled,
          originalPhoto: nextOriginal ?? getPersonalPhotoVariants(prev).originalPhoto,
          circularPhoto: nextCircular ?? getPersonalPhotoVariants(prev).circularPhoto,
          rectangularPhoto: nextRectangular ?? getPersonalPhotoVariants(prev).rectangularPhoto,
        },
        updatedAt: new Date().toISOString(),
      };
      cvRef.current = next;
      setCurrentCv(next);
      return next;
    });
  };

  const getCurrentProTokenOrToast = (openUpgradeModal: () => void) => {
    const aiGate = getAiGate();
    const usageCount = getProAiUsageCount();
    const gateAccess = checkProAccess(aiGate.status !== 'free', usageCount);
    if (gateAccess !== 'allowed') {
      if (gateAccess === 'upgrade') {
        openUpgradeModal();
        return null;
      }
      toast.error(aiErrorMessage('pro_safety_limit_reached', locale));
      return null;
    }
    if (aiGate.status === 'syncing') {
      toast.error(t.common.proAuthorizationUnavailable);
      return null;
    }
    const circuitErr = precheckAiCircuit(locale);
    if (circuitErr) {
      toast.error(aiErrorMessage(circuitErr.code, locale, circuitErr.retryAfterSec));
      return null;
    }
    return aiGate.status === 'ready' ? aiGate.token : null;
  };

  const handleGenSummary = async () => {
    const proToken = getCurrentProTokenOrToast(() => setSummaryAiModal(true));
    if (!proToken) return;
    if (isSummaryGenerating) return;
    setIsSummaryGenerating(true);
    const controller = new AbortController();
    const clientTimeoutMs = resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS);
    const timer = setTimeout(() => controller.abort(), clientTimeoutMs);
    // Immutable request context: `reqCtx.locale` is captured once, at button-press
    // time, and is the ONLY locale used for the API call, validation, and apply
    // below — never re-read the (possibly since-changed) `locale` closure/UI value
    // partway through the request.
    const reqCtx = beginAiClientRequest('summary', locale);
    const requestedLocale = reqCtx.locale as Locale;
    const previousContentLocale = cv.canonicalSnapshot?.canonicalLocale ?? null;
    latestSummaryRequestIdRef.current = reqCtx.requestId;
    const countBefore = getProAiUsageCount();
    try {
      // Shared deterministic duration — never let each locale estimate independently.
      const referenceDateIso = new Date().toISOString().slice(0, 10);
      const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, referenceDateIso);
      const experienceDuration = durationToPromptToken(durationSnapshot.total);
      const experienceEntries = cv.experience.slice(0, 4).map(exp => ({
        position: exp.position,
        company: exp.company,
        startDate: exp.startDate,
        endDate: exp.isPresent ? 'present' : exp.endDate,
        // Always ground summaries on frozen canonical duties, not a prior locale rewrite.
        description: freezeCanonicalExperienceDescription(exp).slice(0, 300),
        isPresent: exp.isPresent,
        duration: durationSnapshot.byExperienceId[exp.id],
      }));

      const { data: summaryData, response: res } = await apiFetch<{ result?: string; error?: string; code?: string; retryAfter?: number }>('/api/generate', {
        body: {
          action: 'summary',
          proToken,
          jobTitle: cv.personal.jobTitle,
          experienceDuration,
          experienceDurationSnapshot: durationSnapshot,
          referenceDateIso,
          experienceEntries,
          skills: cv.skills.slice(0, 10),
          languages: cv.languages.slice(0, 4),
          education: cv.education.slice(0, 2).map(e => ({ degree: e.degree, school: e.school })),
          locale: requestedLocale,
          gender: cv.personal.gender || '',
          canonicalSummary: cv.canonicalSummary || '',
          requestId: reqCtx.requestId,
        },
        signal: controller.signal,
      });
      if (!res.ok || summaryData?.error) {
        if (res.status === 403) {
          const payload = resolveAiHttpFailure({ response: res, body: summaryData ?? null });
          const msg = finishAiClientRequest({
            ctx: reqCtx,
            isProVerified: getAiGate().status === 'ready',
            countBefore,
            countAfter: countBefore,
            httpStatus: res.status,
            error: payload,
          });
          if (getAiGate().status !== 'free') toast.error(msg ?? t.common.proAuthorizationUnavailable);
          else setSummaryAiModal(true);
          return;
        }
        const payload = resolveAiHttpFailure({ response: res, body: summaryData });
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: payload,
        });
        toast.error(msg ?? aiErrorMessage('provider_temporarily_unavailable', locale));
        return;
      }
      // Stale-response guard: if another summary request started after this one
      // (e.g. the user pressed Generate again), drop this response silently —
      // it must never overwrite a newer request's result or locale.
      if (latestSummaryRequestIdRef.current !== reqCtx.requestId) {
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'summary_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_request_superseded',
        });
        return;
      }
      const nextSummary = (summaryData?.result ?? '').trim();
      const finalizedGate = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale,
        gender: cv.personal.gender || '',
        cv,
        candidate: nextSummary,
        durationSnapshot,
      });
      if (finalizedGate.blocked || !finalizedGate.countedAsSuccess) {
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'generation_validation_failed', httpStatus: 422 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'summary_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: finalizedGate.reason || 'generation_validation_failed',
        });
        toast.error(msg ?? aiErrorMessage('generation_validation_failed', locale));
        return;
      }
      commitCvUpdate((prev) => applyFinalizedSummaryToCv(prev, requestedLocale, finalizedGate));
      recordProAiSuccess();
      finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore + 1,
        httpStatus: res.status,
        error: null,
        fallbackUsed: finalizedGate.origin === 'deterministic_fallback',
        responseSource: finalizedGate.origin === 'deterministic_fallback' ? 'deterministic_fallback' : 'provider',
      });
      logAiLocaleTransitionDiagnostics({
        requestId: reqCtx.requestId,
        action: 'summary_generate',
        uiLocale: locale,
        requestedLocale,
        previousContentLocale,
        apiLocale: requestedLocale,
        finalValidationLocale: requestedLocale,
        applied: true,
        newContentLocale: requestedLocale,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'summary_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: false,
        applied: true,
      });
      toast.success(t.cv.genSuccess);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[Professional Summary] Generate error');
      const payload = resolveAiHttpFailure({ response: null, error: err });
      const msg = finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore,
        httpStatus: null,
        error: payload,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'summary_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: err instanceof Error && err.name === 'AbortError',
        applied: false,
        reason: payload.code,
      });
      toast.error(msg ?? aiErrorMessage(payload.code === 'network_error' ? 'network_error' : 'provider_temporarily_unavailable', locale));
    } finally {
      clearTimeout(timer);
      setIsSummaryGenerating(false);
    }
  };

  const handleGenBullets = async (expId: string) => {
    // Always read the latest committed CV — never a stale closure snapshot.
    const liveCv = cvRef.current;
    const exp = liveCv.experience.find(e => e.id === expId);
    if (!exp) return;
    if (generatingBulletsId) return; // Prevent multiple concurrent requests

    const industry = expIndustry[expId] ?? 'general';
    const level = expLevel[expId] ?? 'mid';
    const requestContext = buildExperienceJobContext({
      position: exp.position,
      industry,
      locale,
      level,
    });

    // Capture user grounding before AI — never promote AI display text to canonical.
    const expFrozen = ensureCanonicalExperienceFrozen(exp);
    const aiGrounding = resolveExperienceAiGrounding(
      expFrozen,
      requestContext,
      freezeCanonicalExperienceDescription,
    );

    // Empty-description guard: require either valid grounding or a position for
    // occupation-aware generation. Never block solely because stale AI duties
    // were excluded after an occupation change.
    if (!aiGrounding.sourceDescription.trim() && !String(exp.position || '').trim()) {
      toast.error(aiErrorMessage('experience_description_required', locale));
      return;
    }

    const proToken = getCurrentProTokenOrToast(() => setAiImprovementsModal(true));
    if (!proToken) return;

    setGeneratingBulletsId(expId);
    const controller = new AbortController();
    const clientTimeoutMs = resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS);
    const timer = setTimeout(() => controller.abort(), clientTimeoutMs);
    // Immutable request context — see handleGenSummary for the same pattern.
    const reqCtx = beginAiClientRequest('bullets', locale);
    const requestedLocale = reqCtx.locale as Locale;
    const previousContentLocale = liveCv.canonicalSnapshot?.canonicalLocale ?? null;
    latestBulletsRequestIdRef.current = { ...latestBulletsRequestIdRef.current, [expId]: reqCtx.requestId };
    latestBulletsContextKeyRef.current = {
      ...latestBulletsContextKeyRef.current,
      [expId]: requestContext.key,
    };
    const countBefore = getProAiUsageCount();

    const diagSession = new ExperienceAiDiagnosticSession({
      uiLocale: locale,
      requestedLocale,
      contentLocale: previousContentLocale,
      templateId: String(liveCv.templateId || ''),
      gender: liveCv.personal.gender || '',
      industryNorm: requestContext.industryNorm,
      levelNorm: requestContext.levelNorm,
      jobContextHash: requestContext.key,
      requestId: reqCtx.requestId,
      usageCountBefore: countBefore,
    });
    diagSession.stage('button_pressed', 'ok');
    diagSession.recordLiveExperience(expFrozen, Boolean(exp.isPresent));
    diagSession.recordSourceSelection(expFrozen, aiGrounding);
    diagSession.recordPayloadBuilt({
      locale: requestedLocale,
      industryNorm: requestContext.industryNorm,
      levelNorm: requestContext.levelNorm,
      isPresent: Boolean(exp.isPresent),
    });
    void diagSession.resolveVersions();

    const showExperienceAiRejectToast = (message: string) => {
      if (INTERNAL_AI_RESET_ENABLED) {
        void import('@/components/InternalExperienceAiDiagnosticsPanel').then((mod) => {
          toast.error(message, {
            duration: 20_000,
            action: {
              label: mod.EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL,
              onClick: () => {
                void copyExperienceAiDiagnosticsToClipboard().then((ok) => {
                  toast[ok ? 'success' : 'error'](
                    ok ? mod.EXPERIENCE_AI_COPY_OK : mod.EXPERIENCE_AI_COPY_FAIL,
                  );
                });
              },
            },
          });
        });
      } else {
        toast.error(message);
      }
    };

    const logExperienceAiTrace = (partial: Partial<ExperienceAiJobContextTrace>) => {
      if (process.env.NODE_ENV === 'production') return;
      const payload: ExperienceAiJobContextTrace = {
        previousContextKey: exp.generationJobContextKey || exp.groundingJobContextKey,
        requestContextKey: requestContext.key,
        normalizedPositionClass: requestContext.positionClass,
        normalizedIndustry: requestContext.industryNorm,
        locale: requestedLocale,
        level: requestContext.levelNorm,
        descriptionOrigin: exp.descriptionOrigin,
        groundingSource: aiGrounding.groundingSource,
        staleGeneratedContentExcluded: aiGrounding.staleGeneratedContentExcluded,
        semanticDutyKeysBefore: aiGrounding.semanticDutyKeysBefore,
        semanticDutyKeysUsed: aiGrounding.semanticDutyKeysUsed,
        requestIdMatch: true,
        contextMatch: true,
        resultApplied: false,
        aiUsageIncremented: false,
        ...partial,
      };
      console.info('[ExperienceAIJobContext]', payload);
    };

    try {
      if (
        expFrozen.originalUserDescription !== exp.originalUserDescription
        || expFrozen.canonicalDescription !== exp.canonicalDescription
        || expFrozen.descriptionOrigin !== exp.descriptionOrigin
      ) {
        commitCvUpdate((prev) => ({
          ...prev,
          experience: prev.experience.map((e) =>
            e.id === expId ? ensureCanonicalExperienceFrozen(e) : e,
          ),
        }));
      }
      const requestCv = {
        ...liveCv,
        experience: liveCv.experience.map((e) =>
          e.id === expId ? aiGrounding.experienceForAi : e,
        ),
      };
      const requestBody = {
        action: 'bullets',
        proToken,
        position: exp.position,
        company: exp.company,
        industry,
        level,
        locale: requestedLocale,
        gender: liveCv.personal.gender || '',
        // Never send stale AI/legacy cooking duties after occupation change.
        sourceDescription: aiGrounding.sourceDescription,
        jobContextKey: requestContext.key,
        // Structured date status is authoritative for employment tense.
        isPresent: Boolean(exp.isPresent),
        endDate: exp.isPresent ? 'present' : (exp.endDate || ''),
        requestId: reqCtx.requestId,
      };

      const { data: bulletsData, response: res } = await apiFetch<{ result?: string; error?: string; code?: string; retryAfter?: number; repairAttempted?: boolean; fallbackUsed?: boolean }>('/api/generate', {
        body: requestBody,
        signal: controller.signal,
      });

      if (!res.ok || bulletsData?.error) {
        if (res.status === 403) {
          const payload = resolveAiHttpFailure({ response: res, body: bulletsData });
          const msg = finishAiClientRequest({
            ctx: reqCtx,
            isProVerified: getAiGate().status === 'ready',
            countBefore,
            countAfter: countBefore,
            httpStatus: res.status,
            error: payload,
          });
          diagSession.recordApiResponse({
            httpStatus: res.status,
            errorCode: 'http_403',
          });
          diagSession.recordVisibleApply(false, countBefore);
          diagSession.commit();
          showExperienceAiRejectToast(
            getAiGate().status !== 'free' ? (msg ?? t.common.proAuthorizationUnavailable) : t.common.proAccessRequired,
          );
          logExperienceAiTrace({
            resultApplied: false,
            rejectedReason: 'http_403',
            aiUsageIncremented: false,
          });
          return;
        }
        const payload = resolveAiHttpFailure({ response: res, body: bulletsData });
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: payload,
        });
        diagSession.recordApiResponse({
          httpStatus: res.status,
          errorCode: payload.code || 'http_error',
        });
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        showExperienceAiRejectToast(msg ?? aiErrorMessage('provider_temporarily_unavailable', locale));
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: payload.code || 'http_error',
          aiUsageIncremented: false,
        });
        return;
      }

      // Stale-response guard: requestId + job-context must both still match.
      const latestId = latestBulletsRequestIdRef.current[expId];
      const latestCtx = latestBulletsContextKeyRef.current[expId];
      const liveNow = cvRef.current;
      const expNow = liveNow.experience.find((e) => e.id === expId);
      const liveContext = buildExperienceJobContext({
        position: expNow?.position,
        industry: expIndustry[expId] ?? industry,
        locale,
        level: expLevel[expId] ?? level,
      });
      diagSession.recordApiResponse({
        httpStatus: res.status,
        repairAttempted: Boolean(bulletsData.repairAttempted),
        fallbackUsed: Boolean(bulletsData.fallbackUsed),
        resultText: bulletsData.result || '',
      });
      if (
        latestId !== reqCtx.requestId
        || latestCtx !== requestContext.key
        || !experienceJobContextsMatch(liveContext.key, requestContext.key)
      ) {
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'bullets_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_request_superseded',
        });
        diagSession.recordRaceCheck(false, 'stale_request_or_context_mismatch', liveContext.key);
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: 'stale_request_or_context_mismatch',
          requestIdMatch: latestId === reqCtx.requestId,
          contextMatch: experienceJobContextsMatch(liveContext.key, requestContext.key),
          aiUsageIncremented: false,
        });
        return;
      }
      diagSession.recordRaceCheck(true, undefined, liveContext.key);
      const newDescription = bulletsData.result || '';
      const finalizedBullets = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale,
        gender: liveNow.personal.gender || '',
        cv: {
          ...liveNow,
          experience: liveNow.experience.map((e) =>
            e.id === expId ? aiGrounding.experienceForAi : e,
          ),
        },
        candidate: newDescription,
        experienceId: expId,
        industry,
        level,
        jobContext: requestContext,
        originHint: bulletsData.fallbackUsed
          ? 'deterministic_fallback'
          : bulletsData.repairAttempted
            ? 'ai_repaired'
            : 'ai_generated',
      });
      diagSession.recordFinalizeResult(finalizedBullets);
      if (
        finalizedBullets.countedAsSuccess
        && candidateConflictsWithJobContext(finalizedBullets.text, requestContext)
        && aiGrounding.staleGeneratedContentExcluded
      ) {
        // Hard reject cooking survival under pharmacist context.
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'generation_validation_failed', httpStatus: 422 },
          responseSource: 'blocked',
        });
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: 'cooking_duties_under_pharmacist',
          aiUsageIncremented: false,
        });
        diagSession.patch({
          finalTypedFailureReason: 'cooking_duties_under_pharmacist',
          rejectionStage: 'final_apply_postcondition',
        });
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        showExperienceAiRejectToast(msg ?? aiErrorMessage('generation_validation_failed', locale));
        return;
      }
      if (finalizedBullets.blocked || !finalizedBullets.countedAsSuccess) {
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'generation_validation_failed', httpStatus: 422 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: 'bullets_generate',
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: finalizedBullets.reason || 'generation_validation_failed',
        });
        logExperienceAiTrace({
          resultApplied: false,
          rejectedReason: finalizedBullets.reason || 'generation_validation_failed',
          aiUsageIncremented: false,
          ...(finalizedBullets.diagnostics || {}),
        });
        diagSession.recordVisibleApply(false, countBefore);
        diagSession.commit();
        showExperienceAiRejectToast(msg ?? aiErrorMessage('generation_validation_failed', locale));
        return;
      }
      commitCvUpdate((prev) => applyFinalizedBulletsToCv(
        prev,
        requestedLocale,
        expId,
        finalizedBullets,
        requestContext,
      ));
      recordProAiSuccess();
      finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore + 1,
        httpStatus: res.status,
        error: null,
        automaticRepairCount: bulletsData.repairAttempted ? 1 : 0,
        fallbackUsed: Boolean(bulletsData.fallbackUsed) || finalizedBullets.origin === 'deterministic_fallback',
        responseSource: finalizedBullets.origin === 'deterministic_fallback' || bulletsData.fallbackUsed
          ? 'deterministic_fallback'
          : bulletsData.repairAttempted
            ? 'repair'
            : 'provider',
      });
      logAiLocaleTransitionDiagnostics({
        requestId: reqCtx.requestId,
        action: 'bullets_generate',
        uiLocale: locale,
        requestedLocale,
        previousContentLocale,
        apiLocale: requestedLocale,
        finalValidationLocale: requestedLocale,
        applied: true,
        newContentLocale: requestedLocale,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'bullets_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: false,
        applied: true,
      });
      logExperienceAiTrace({
        appliedContextKey: requestContext.key,
        resultApplied: true,
        aiUsageIncremented: true,
        semanticDutyKeysUsed: [],
        ...(finalizedBullets.diagnostics || {}),
      });
      diagSession.recordVisibleApply(true, countBefore + 1);
      diagSession.commit();
      toast.success(t.cv.bulletsSuccess);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[AI Improvements Error]', err);
      const payload = resolveAiHttpFailure({ response: null, error: err });
      const msg = finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore,
        httpStatus: null,
        error: payload,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: 'bullets_generate',
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: err instanceof Error && err.name === 'AbortError',
        applied: false,
        reason: payload.code,
      });
      logExperienceAiTrace({
        resultApplied: false,
        rejectedReason: payload.code || 'exception',
        aiUsageIncremented: false,
      });
      diagSession.recordApiResponse({
        httpStatus: null,
        errorCode: payload.code || 'exception',
      });
      diagSession.recordVisibleApply(false, countBefore);
      diagSession.commit();
      showExperienceAiRejectToast(
        msg ?? aiErrorMessage(payload.code === 'network_error' ? 'network_error' : 'provider_temporarily_unavailable', locale),
      );
    } finally {
      clearTimeout(timer);
      setGeneratingBulletsId(null);
    }
  };

  const handleRewrite = async (style: 'shorter' | 'stronger' | 'professional') => {
    if (rewritingStyle || !cv.summary.trim()) return;
    const proToken = getCurrentProTokenOrToast(() => setSummaryAiModal(true));
    if (!proToken) return;
    setRewritingStyle(style);
    const controller = new AbortController();
    const clientTimeoutMs = resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS);
    const timer = setTimeout(() => controller.abort(), clientTimeoutMs);
    // Immutable request context — see handleGenSummary for the same pattern.
    const reqCtx = beginAiClientRequest(`rewrite:${style}`, locale);
    const requestedLocale = reqCtx.locale as Locale;
    const previousContentLocale = cv.canonicalSnapshot?.canonicalLocale ?? null;
    latestRewriteRequestIdRef.current = reqCtx.requestId;
    const countBefore = getProAiUsageCount();
    try {
      const { data: rewriteData, response: res } = await apiFetch<{ result?: string; error?: string; code?: string; retryAfter?: number; repairAttempted?: boolean; fallbackUsed?: boolean }>('/api/generate', {
        body: {
          action: 'rewrite',
          proToken,
          text: cv.summary,
          style,
          locale: requestedLocale,
          gender: cv.personal.gender || '',
          requestId: reqCtx.requestId,
          cvContext: {
            personal: cv.personal,
            summary: cv.canonicalSummary || cv.summary,
            canonicalSummary: cv.canonicalSummary || '',
            experience: cv.experience.map((e) => ({
              ...e,
              description: freezeCanonicalExperienceDescription(e),
              canonicalDescription: e.canonicalDescription || freezeCanonicalExperienceDescription(e),
            })),
            education: cv.education,
            skills: cv.skills,
            languages: cv.languages,
            certifications: cv.certifications,
          },
        },
        signal: controller.signal,
      });
      if (!res.ok || rewriteData?.error) {
        const payload = resolveAiHttpFailure({ response: res, body: rewriteData });
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: payload,
        });
        toast.error(msg ?? aiErrorMessage('provider_temporarily_unavailable', locale));
        return;
      }
      // Stale-response guard: only the most recently started rewrite may apply.
      if (latestRewriteRequestIdRef.current !== reqCtx.requestId) {
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: `rewrite_${style}`,
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: 'stale_request_superseded',
        });
        return;
      }
      const referenceDateIso = new Date().toISOString().slice(0, 10);
      const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, referenceDateIso);
      const rewriteAction = style === 'shorter'
        ? 'summary_shorter'
        : style === 'stronger'
          ? 'summary_stronger'
          : 'summary_professional';
      const finalizedGate = finalizeCvAiFieldForApply({
        action: rewriteAction,
        field: 'summary',
        requestedLocale,
        gender: cv.personal.gender || '',
        cv,
        candidate: (rewriteData.result ?? cv.summary).trim(),
        durationSnapshot,
        originHint: rewriteData.fallbackUsed
          ? 'deterministic_fallback'
          : rewriteData.repairAttempted
            ? 'ai_repaired'
            : 'ai_generated',
      });
      if (finalizedGate.blocked || !finalizedGate.countedAsSuccess) {
        const msg = finishAiClientRequest({
          ctx: reqCtx,
          isProVerified: true,
          countBefore,
          countAfter: countBefore,
          httpStatus: res.status,
          error: { code: 'generation_validation_failed', httpStatus: 422 },
          responseSource: 'blocked',
        });
        logAiLocaleTransitionDiagnostics({
          requestId: reqCtx.requestId,
          action: `rewrite_${style}`,
          uiLocale: locale,
          requestedLocale,
          previousContentLocale,
          apiLocale: requestedLocale,
          finalValidationLocale: requestedLocale,
          applied: false,
          reason: finalizedGate.reason || 'generation_validation_failed',
        });
        toast.error(msg ?? aiErrorMessage('generation_validation_failed', locale));
        return;
      }
      commitCvUpdate((prev) => applyFinalizedSummaryToCv(prev, requestedLocale, finalizedGate));
      recordProAiSuccess();
      finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore + 1,
        httpStatus: res.status,
        error: null,
        automaticRepairCount: rewriteData.repairAttempted ? 1 : 0,
        fallbackUsed: Boolean(rewriteData.fallbackUsed) || finalizedGate.origin === 'deterministic_fallback',
        responseSource: finalizedGate.origin === 'deterministic_fallback' || rewriteData.fallbackUsed
          ? 'deterministic_fallback'
          : rewriteData.repairAttempted
            ? 'repair'
            : 'provider',
      });
      logAiLocaleTransitionDiagnostics({
        requestId: reqCtx.requestId,
        action: `rewrite_${style}`,
        uiLocale: locale,
        requestedLocale,
        previousContentLocale,
        apiLocale: requestedLocale,
        finalValidationLocale: requestedLocale,
        applied: true,
        newContentLocale: requestedLocale,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: `rewrite_${style}`,
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: false,
        applied: true,
      });
      toast.success(`${t.cv.rewriteSuccess} (${t.cv[style === 'shorter' ? 'short' : style === 'stronger' ? 'strong' : 'professional']})`);
    } catch (err) {
      const payload = resolveAiHttpFailure({ response: null, error: err });
      const msg = finishAiClientRequest({
        ctx: reqCtx,
        isProVerified: true,
        countBefore,
        countAfter: countBefore,
        httpStatus: null,
        error: payload,
      });
      logAiClientRequestTiming({
        requestId: reqCtx.requestId,
        action: `rewrite_${style}`,
        requestedLocale,
        clientStartedAt: reqCtx.startedAt,
        clientTimeoutMs,
        clientAborted: err instanceof Error && err.name === 'AbortError',
        applied: false,
        reason: payload.code,
      });
      toast.error(msg ?? aiErrorMessage(payload.code === 'network_error' ? 'network_error' : 'provider_temporarily_unavailable', locale));
    } finally {
      clearTimeout(timer);
      setRewritingStyle(null);
    }
  };

  const handleAnalyzeJob = () => {
    if (!jobDesc.trim()) return;
    if (!getCurrentProTokenOrToast(() => setJobAnalyzerModal(true))) return;
    setShowAnalysis(false);
    setAnalysis(null);
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = analyzeJobDescription(jobDesc, locale);
      setAnalysis(result);
      setIsAnalyzing(false);
      setShowAnalysis(true);
      // Local heuristic only — does not consume Pro AI safety-cap quota.
    }, 1300);
  };

    const handleSave = () => {
    setCurrentCv(cv);
    toast.success(t.cv.saved);
  };

    const showCvExportSuccessToast = (
      saveResult: SaveFileResult,
      format: ExportFileFormat,
      fallbackFileName: string,
    ) => {
      const copy = getCvExportSuccessToast(saveResult, format, fallbackFileName, t.cv);
      if (!copy) return;
      toast.success(copy.title, { description: copy.description });
    };

    const showExportFailureToast = (
      err: unknown,
      format: 'pdf' | 'docx',
    ) => {
      const message = formatCvExportIntegrityToast(err, locale, format)
        || (format === 'pdf' ? t.cv.pdfExportFailed : t.cv.wordExportFailed);
      toast.error(message, {
        duration: 20_000,
        action: {
          label: 'Copy diagnostics',
          onClick: () => {
            void copyCvExportDiagnosticsToClipboard(format).then((ok) => {
              toast[ok ? 'success' : 'error'](
                ok ? 'Export diagnostics copied' : 'Could not copy diagnostics',
              );
            });
          },
        },
      });
      setExportDiagTick((n) => n + 1);
    };

    const recordExportDiagnostic = async (args: {
      format: 'pdf' | 'docx';
      rawCv: CVData;
      prepared: PrepareExportReadyResult | null;
      originalFailureReason?: string;
      finalError?: unknown;
      rendererReached?: boolean;
      blobProduced?: boolean;
      blobSize?: number | null;
      blobMimeType?: string | null;
      androidSaveReached?: boolean;
      saveResult?: SaveFileResult | null;
      extraStages?: Parameters<typeof buildAndStoreCvExportDiagnostic>[0]['extraStages'];
    }) => {
      const app = await resolveAppVersionInfo();
      buildAndStoreCvExportDiagnostic({
        format: args.format,
        locale,
        rawCv: args.rawCv,
        prepared: args.prepared,
        originalFailureReason: args.originalFailureReason,
        finalError: args.finalError,
        rendererReached: args.rendererReached,
        blobProduced: args.blobProduced,
        blobSize: args.blobSize,
        blobMimeType: args.blobMimeType,
        androidSaveReached: args.androidSaveReached,
        saveResult: args.saveResult,
        appVersionCode: app.versionCode,
        appVersionName: app.versionName,
        nextBuildId: resolveNextBuildId(),
        extraStages: args.extraStages,
      });
      setExportDiagTick((n) => n + 1);
    };

    const prepareFinalLocaleSafeCv = (sourceCv: CVData): CVData => {
      lastExportRawCvRef.current = sourceCv;
      try {
        // Single export-ready snapshot for all templates/formats before branching.
        const prepared = prepareExportReadyCv(sourceCv, locale, sourceCv.templateId, {
          gender: sourceCv.personal?.gender,
        });
        lastExportPrepareRef.current = prepared;
        if (!prepared.ok) {
          // Preserve the exact typed reason for diagnostics before any remapping.
          const originalReason = prepared.reason;
          if (
            sourceCv.templateId === 'modern-minimal'
            && /stale|overwritten|not_invoked|projection_incomplete/i.test(prepared.reason)
          ) {
            throw new CvExportFailure(
              'modern_minimal_stale_snapshot',
              `${originalReason} @ ${prepared.stage}`,
            );
          }
          throw new CvExportFailure(prepared.reason, `${prepared.reason} @ ${prepared.stage}`);
        }
        const recoveredCv = prepared.cv;
        const diagnostics = prepared.diagnostics;
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[CV export] prepareExportReadyCv', {
            templateId: recoveredCv.templateId,
            recoveryInvoked: diagnostics.recoveryInvoked,
            semanticDutyKeys: diagnostics.summarySemanticDutyKeys,
            summaryFactSetSource: diagnostics.summaryFactSetSource,
            summaryInitialReason: diagnostics.summaryInitialReason,
            summaryRecoverySource: diagnostics.summaryRecoverySource,
            stage: diagnostics.stage,
          });
        }
        // Persist repaired metadata; export uses recoveredCv (not a later cvRef re-read).
        const groundingPersisted: CVData = {
          ...sourceCv,
          region: recoveredCv.region,
          runtimeMigrationVersion: recoveredCv.runtimeMigrationVersion,
          contentLocale: recoveredCv.contentLocale ?? sourceCv.contentLocale,
          summaryOrigin: recoveredCv.summaryOrigin ?? sourceCv.summaryOrigin,
          experience: (sourceCv.experience || []).map((exp) => {
            const matched = (recoveredCv.experience || []).find((item) => item.id === exp.id);
            if (!matched) return exp;
            return {
              ...exp,
              originalUserDescription:
                matched.originalUserDescription ?? exp.originalUserDescription,
              canonicalDescription:
                matched.canonicalDescription ?? exp.canonicalDescription,
              groundingRecoverySource:
                matched.groundingRecoverySource ?? exp.groundingRecoverySource,
              descriptionOrigin: matched.descriptionOrigin ?? exp.descriptionOrigin,
              recoveredSemanticDuties:
                matched.recoveredSemanticDuties ?? exp.recoveredSemanticDuties,
            };
          }),
        };
        setCv(groundingPersisted);
        setCurrentCv(groundingPersisted);

        if (recoveredCv.templateId === 'creative-artistic') {
          return prepareCreativeArtisticExport(recoveredCv, locale, {
            gender: recoveredCv.personal?.gender,
          }).cv;
        }
        if (recoveredCv.templateId === 'corporate-navy') {
          return prepareCorporateNavyExport(recoveredCv, locale, {
            gender: recoveredCv.personal?.gender,
          }).cv;
        }
        return recoveredCv;
      } catch (err) {
        throw wrapCvExportFailure(err, 'legacy_export_recovery_not_invoked');
      }
    };

    const handleDOCXDownload = async () => {
      if (!canDownload('cv')) {
        setLimitModal({ open: true, type: 'cv' });
        return;
      }
      if (isWordExporting) return;
      setShowDownloadMenu(false);
      setIsWordExporting(true);
      try {
        const liveCv = cvRef.current;
        let saveResult: SaveFileResult;
        let fallbackFileName: string;
        if (liveCv.templateId === 'rirekisho') {
          const exportBaseName = liveCv.personal.fullName || '履歴書';
          saveResult = await exportRirekishoToDOCX(liveCv, exportBaseName);
          fallbackFileName = `${exportBaseName}.docx`;
        } else {
          // For rect-photo templates, use rectangularPhotoDataUrl (derived from original upload).
          // For circle templates, use circularPhotoDataUrl or cv.personal.photo.
          let photoForExport: string | undefined;
          let elegantFormalPhoto: ElegantFormalCanonicalPhotoResult | null = null;
          if (liveCv.templateId === 'elegant-formal') {
            elegantFormalPhoto = await ensureElegantFormalPhotoForExport();
            photoForExport = elegantFormalPhoto?.dataUrl;
          } else if (RECT_PHOTO_TEMPLATES.includes(liveCv.templateId)) {
            photoForExport = rectangularPhotoDataUrl ?? liveCv.personal.photo; // clean JPEG from original when available
          } else if (liveCv.templateId === 'corporate-navy' || liveCv.templateId === 'contemporary-bold') {
            photoForExport = (liveCv.personal as typeof liveCv.personal & { originalPhoto?: string }).originalPhoto
              ?? circularPhotoDataUrl
              ?? liveCv.personal.photo;
          } else {
            photoForExport = circularPhotoDataUrl ?? liveCv.personal.photo;
          }
          const selectedTemplateId = cv.templateId;
          const latestCv = {
            ...cvRef.current,
            ...cv,
            templateId: selectedTemplateId,
          };
          const cvForExport = prepareFinalLocaleSafeCv({
            ...latestCv,
            personal: { ...latestCv.personal, photo: photoForExport },
          });
          // Synchronize cvRef with the export snapshot (same object PDF uses).
          // Do not write localized export text back into editor React state.
          cvRef.current = cvForExport;
          const exportBaseName = makeCvExportBaseName(cvForExport.personal.fullName);
          saveResult = await exportToDOCX(cvForExport, exportBaseName, locale, cvForExport.templateId, { elegantFormalPhoto });
          fallbackFileName = `${exportBaseName}.docx`;
          await recordExportDiagnostic({
            format: 'docx',
            rawCv: lastExportRawCvRef.current || latestCv,
            prepared: lastExportPrepareRef.current,
            rendererReached: true,
            blobProduced: true,
            blobMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            androidSaveReached: true,
            saveResult,
            extraStages: [
              { stage: 'render_blob', result: 'ok' },
              { stage: 'android_save', result: saveResult.result === 'saved' ? 'ok' : 'fail' },
            ],
          });
        }
        showCvExportSuccessToast(saveResult, 'docx', fallbackFileName);
        incrementDownloads('cv');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'SaveCancelledError') return;
        if (process.env.NODE_ENV !== 'production') console.error('[CV DOCX export] failed:', err);
        const prepared = lastExportPrepareRef.current;
        const originalReason = prepared && !prepared.ok ? prepared.reason : undefined;
        await recordExportDiagnostic({
          format: 'docx',
          rawCv: lastExportRawCvRef.current || cvRef.current,
          prepared,
          originalFailureReason: originalReason,
          finalError: err,
          rendererReached: Boolean(prepared?.ok),
          blobProduced: false,
          androidSaveReached: /android_file_save_failed/i.test(extractCvExportFailureReason(err)),
          extraStages: prepared?.ok
            ? [{ stage: 'render_blob', result: 'fail', reason: extractCvExportFailureReason(err) }]
            : undefined,
        });
        showExportFailureToast(err, 'docx');
      } finally {
        setIsWordExporting(false);
      }
    };

    const handlePDFDownload = async (previewId: string) => {
      if (!canDownload('cv')) {
        setLimitModal({ open: true, type: 'cv' });
        return;
      }
      if (isPdfExporting) return;
      setShowDownloadMenu(false);
      setIsPdfExporting(true);
      try {
        // selectedTemplateId is the live UI selection and is authoritative over any
        // stale cvRef.current/localStorage templateId (hard requirement — do not
        // let a stale ref silently redirect Modern Minimal into another renderer).
        const selectedTemplateId = cv.templateId;
        const cvRefTemplateId = cvRef.current.templateId;
        const previewTemplateId = readPdfExportTemplateIdFromPreview(previewId);
        if (cvRefTemplateId !== selectedTemplateId) {
          console.error(
            `[CV PDF export] cvRef.current.templateId (${cvRefTemplateId}) !== selectedTemplateId (${selectedTemplateId}) — overwriting before export`,
          );
        }
        // Force templateId from the live UI selection; cvRef.current can only supply
        // the rest of the data, never the template choice.
        const cvForExport = prepareFinalLocaleSafeCv({
          ...cvRef.current,
          ...cv,
          templateId: selectedTemplateId,
        });
        cvRef.current = cvForExport;
        const route = resolveCvPdfExportRoute(selectedTemplateId);

        if (process.env.NODE_ENV !== 'production') {
          console.debug('[CV PDF export] tap', {
            selectedTemplateId,
            cvRefTemplateId,
            previewTemplateId,
            route: route.kind,
          });
        }

        const exportFunctionForTrace =
          selectedTemplateId === 'modern-minimal'
            ? 'exportModernMinimalPdf'
            : route.kind === 'generic-preview'
              ? 'exportToPDF'
              : `dedicated-${selectedTemplateId}`;

        recordCvPdfExportRuntimeTrace({
          selectedTemplateId,
          cvRefTemplateId,
          exportTemplateId: selectedTemplateId,
          previewTemplateId,
          routeKind: route.kind,
          exportFunction: exportFunctionForTrace,
          at: new Date().toISOString(),
        });

        const exportFilename = makeCvExportBaseName(cvForExport.personal.fullName);

        if (selectedTemplateId === 'modern-minimal') {
          if (route.kind !== 'dedicated-modern-minimal') {
            toast.error(t.cv.pdfExportFailed);
            throw new Error(`Modern Minimal route mismatch: ${route.kind}`);
          }
          if (previewTemplateId && previewTemplateId !== 'modern-minimal') {
            toast.error(t.cv.pdfExportFailed);
            throw new Error(`Modern Minimal preview mismatch: ${previewTemplateId}`);
          }
          const saveResult = await exportModernMinimalPdf(cvForExport, exportFilename, locale);
          await recordExportDiagnostic({
            format: 'pdf',
            rawCv: lastExportRawCvRef.current || cvForExport,
            prepared: lastExportPrepareRef.current,
            rendererReached: true,
            blobProduced: true,
            blobMimeType: 'application/pdf',
            androidSaveReached: true,
            saveResult,
            extraStages: [
              { stage: 'render_blob', result: 'ok' },
              { stage: 'android_save', result: saveResult.result === 'saved' ? 'ok' : 'fail' },
            ],
          });
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }

        if (previewTemplateId === 'modern-minimal') {
          toast.error(t.cv.pdfExportFailed);
          throw new Error('Modern Minimal preview detected outside dedicated export path');
        }

        const pdfResolution = resolveCvForPdfExport(cvForExport, {
          previewElementId: previewId,
          uiTemplateId: selectedTemplateId,
        });
        const liveCv = pdfResolution.exportCv;
        cvRef.current = liveCv;
        if (pdfResolution.route.kind === 'dedicated-clean-simple') {
          const saveResult = await exportCleanSimplePdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'professional-classic') {
          const saveResult = await exportProfessionalClassicPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'creative-bold') {
          const saveResult = await exportCreativeBoldPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'creative-artistic') {
          const saveResult = await exportCreativeArtisticPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'elegant-formal') {
          const photoDataUrl = await prepareElegantFormalPdfPhotoDataUrl();
          const saveResult = await exportElegantFormalPdf(liveCv, exportFilename, locale, { photoDataUrl });
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'ats-standard') {
          const saveResult = await exportAtsStandardPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'executive-premium') {
          const saveResult = await exportExecutivePremiumPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'nordic-clean') {
          const saveResult = await exportNordicCleanPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'tech-sidebar') {
          const saveResult = await exportTechSidebarPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'corporate-navy') {
          const saveResult = await exportCorporateNavyPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'contemporary-bold') {
          const saveResult = await exportContemporaryBoldPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        if (liveCv.templateId === 'rirekisho') {
          const saveResult = await exportRirekishoPdf(liveCv, exportFilename, locale);
          showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
          incrementDownloads('cv');
          return;
        }
        // ── Guard: for rect-photo templates, wait until rectangularPhotoDataUrl has been
        //    computed AND React has committed it to the DOM <img src> attribute.
        //    Poll for up to 3 s in 50 ms increments, then proceed regardless.
        if (RECT_PHOTO_TEMPLATES.includes(liveCv.templateId) && photoForCurrentTemplate) {
          const expectedFragment = '#rect';
          const deadline = Date.now() + 3000;
          while (Date.now() < deadline) {
            const exportNode = document.getElementById(previewId);
            const firstImg = exportNode?.querySelector('img');
            if (firstImg && (firstImg.src.includes(expectedFragment) || firstImg.complete)) break;
            await new Promise(r => setTimeout(r, 50));
          }
          // Extra two rAFs to let the browser finish painting the new src
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }

        assertDedicatedPdfRouteWasHandled(pdfResolution);

        const saveResult = await exportToPDF(previewId, exportFilename);
        showCvExportSuccessToast(saveResult, 'pdf', `${exportFilename}.pdf`);
        incrementDownloads('cv');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'SaveCancelledError') return;
        if (process.env.NODE_ENV !== 'production') console.error('[CV PDF export] failed:', err);
        const prepared = lastExportPrepareRef.current;
        const originalReason = prepared && !prepared.ok ? prepared.reason : undefined;
        await recordExportDiagnostic({
          format: 'pdf',
          rawCv: lastExportRawCvRef.current || cvRef.current,
          prepared,
          originalFailureReason: originalReason,
          finalError: err,
          rendererReached: Boolean(prepared?.ok),
          blobProduced: false,
          androidSaveReached: /android_file_save_failed/i.test(extractCvExportFailureReason(err)),
          extraStages: prepared?.ok
            ? [{ stage: 'render_blob', result: 'fail', reason: extractCvExportFailureReason(err) }]
            : undefined,
        });
        const cv = { templateId: cvRef.current.templateId, personal: { fullName: cvRef.current.personal.fullName } };
        if (cv.templateId === 'modern-minimal' || cv.templateId === 'clean-simple' || cv.templateId === 'professional-classic' || cv.templateId === 'creative-bold' || cv.templateId === 'creative-artistic' || cv.templateId === 'elegant-formal' || cv.templateId === 'ats-standard' || cv.templateId === 'executive-premium' || cv.templateId === 'nordic-clean' || cv.templateId === 'tech-sidebar' || cv.templateId === 'corporate-navy' || cv.templateId === 'contemporary-bold' || cv.templateId === 'rirekisho') {
          toast.error(formatCvExportIntegrityToast(err, locale, 'pdf') || t.cv.pdfExportFailed, {
            duration: 20_000,
            action: {
              label: 'Copy diagnostics',
              onClick: () => {
                void copyCvExportDiagnosticsToClipboard('pdf').then((ok) => {
                  toast[ok ? 'success' : 'error'](
                    ok ? 'Export diagnostics copied' : 'Could not copy diagnostics',
                  );
                });
              },
            },
          });
          setExportDiagTick((n) => n + 1);
          return;
        }
        // Fallback: attempt print-ready window once so user can Save as PDF via browser.
        // Do NOT increment downloads here — we cannot confirm the user actually saves the file.
        try {
          await openPrintFallback(previewId, cv.personal.fullName || 'CV');
        } catch (fallbackErr) {
          // Cancellation by user is silent — no error toast
          if (fallbackErr instanceof Error &&
              (fallbackErr.name === 'PrintCancelledError' || fallbackErr.name === 'SaveCancelledError')) {
            if (process.env.NODE_ENV !== 'production') console.error('[CV PDF export] fallback was cancelled:', fallbackErr.message);
            return;
          }
          if (process.env.NODE_ENV !== 'production') console.error('[CV PDF export] print fallback also failed:', fallbackErr);
          showExportFailureToast(fallbackErr, 'pdf');
        }
      } finally {
        setIsPdfExporting(false);
      }
    };

    const handleTemplateRecommend = () => {
      if (!getCurrentProTokenOrToast(() => setAiRecommendModal(true))) return;
      const recommended = recommendTemplate(cv);
      commitCvUpdate(prev => ({ ...prev, templateId: recommended }));
      setRecommendedTemplateId(recommended);
      markAiRecommendUsed();
      // Local recommend — does not consume Pro AI safety-cap quota.
      toast.success(`${t.cv.recommendedToast}: ${t.templates.items[recommended].name}`);
    };

    const handleTemplateSelect = (id: TemplateId) => {
      const info = templateInfo[id];
      if (info.isPro && !isPro) {
        setProTemplateModal(true);
        return;
      }
      commitCvUpdate(prev => ({ ...prev, templateId: id }));
    };

  const TemplateComponent = templateComponents[cv.templateId];
  const trimmedSkillQuery = skillInput.trim();
  const shouldShowSkillSuggestions = showSkillSuggestions
    && trimmedSkillQuery.length >= 2
    && skillSuggestions.length > 0;
  const trimmedLanguageQuery = langName.trim();
  const shouldShowLanguageSuggestions = showLanguageSuggestions
    && trimmedLanguageQuery.length >= 2
    && languageSuggestions.length > 0;
  const canAddLanguage = Boolean(selectedLanguageName || resolveStoredCvLanguageName(langName));

  useEffect(() => {
    if (!shouldShowLanguageSuggestions) {
      setActiveLanguageSuggestionIndex(-1);
      return;
    }

    setActiveLanguageSuggestionIndex((currentIndex) => {
      if (languageSuggestions.length === 0) return -1;
      if (currentIndex >= 0 && currentIndex < languageSuggestions.length) return currentIndex;
      return 0;
    });
  }, [languageSuggestions.length, shouldShowLanguageSuggestions]);

  useEffect(() => {
    if (activeLanguageSuggestionIndex < 0) return;
    langSuggestionRefs.current[activeLanguageSuggestionIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [activeLanguageSuggestionIndex]);

  const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";
  const textareaClass = "w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-y";
  const btnPrimary = "inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";
  const btnSecondary = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent";

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">{t.cv.title}</h1>
                <div className="flex items-center gap-3">
                  {/* "Draft saved" indicator — appears briefly after autosave */}
                  {lastCvSavedAt > 0 && Date.now() - lastCvSavedAt < 3000 && (
                    <span className="text-xs text-muted-foreground animate-pulse" key={lastCvSavedAt}>
                      {t.cv.draftSaved || 'Draft saved'}
                    </span>
                  )}
                  <button onClick={() => setShowPreview(!showPreview)} className={btnSecondary}>
                    <Eye className="h-4 w-4" />{showPreview ? t.cv.edit : t.cv.preview}
                  </button>
                  <button onClick={handleSave} className={btnPrimary}>
                    {t.common.save}
                  </button>
                </div>
              </div>

            {/* Steps Navigation - Responsive Scrollable Chips */}
              <div className="mb-8 flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide scroll-smooth">
              {steps.map((s, i) => (
                <button 
                  key={i} 
                  ref={element => {
                    stepButtonRefs.current[i] = element;
                  }}
                  onClick={() => setStep(i)}
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                    step === i 
                      ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background' 
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

              {/* Subtle upgrade banner — only shown to free users */}
              {!isPro && (
                <UpgradeBuilderBanner />
              )}

              {showPreview ? (
                      <div>
                          <div className="mb-4 flex gap-2 flex-wrap items-center">
                          {/* Download dropdown */}
                          <div className="relative" ref={downloadMenuRef}>
                            <button
                              onClick={() => setShowDownloadMenu(v => !v)}
                              className={btnPrimary + ' flex items-center gap-1'}
                              disabled={isPdfExporting || isWordExporting}
                            >
                              <Download className="h-4 w-4" />
                              {isPdfExporting || isWordExporting ? '...' : t.cv.downloadCv}
                              <ChevronDown className="h-3 w-3 ml-0.5" />
                            </button>
                            {showDownloadMenu && (
                              <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                                <button
                                  onClick={() => handlePDFDownload('cv-preview')}
                                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                                  disabled={isPdfExporting}
                                >
                                  <File className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                  <div>
                                    <div className="font-semibold text-sm">{t.cv.downloadPdf}</div>
                                    <div className="text-xs text-muted-foreground">{t.cv.downloadPdfDesc}</div>
                                  </div>
                                </button>
                                <button
                                  onClick={handleDOCXDownload}
                                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-t border-border"
                                  disabled={isWordExporting}
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
                          <div key={`diag-preview-${exportDiagTick}`}>
                            <CvExportCopyDiagnosticsButton />
                          </div>
                          <button onClick={() => { exportToClipboard('cv-preview'); toast.success(t.cv.copied); }} className={btnSecondary}>
                            <Copy className="h-4 w-4" />{t.cv.copy}
                          </button>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">{t.cv.downloadNote}</p>
                  <div id="cv-preview" className="overflow-auto rounded-xl border border-border shadow-lg">
                    {TemplateComponent && (
                      <TemplateComponent
                        key={`${cv.templateId}-${photoForCurrentTemplate?.slice(-20) ?? 'no-photo'}`}
                        data={localizedPreviewCv}
                        locale={locale}
                      />
                    )}
                  </div>
                </div>
              ) : (
              <div className="rounded-xl border border-border bg-card p-6">
                {/* Step 0: Personal */}
                  {step === 0 && (
                    <div className="space-y-4">
                      <div className="mb-4">
                        <label className="mb-1.5 block text-sm font-medium">{t.cv.region}</label>
                        <select value={cv.region} onChange={e => {
                          const region = e.target.value as Region;
                          commitCvUpdate(prev => ({
                            ...prev,
                            region,
                            templateId: region === 'Japan' ? 'rirekisho' : (prev.templateId === 'rirekisho' ? 'modern-minimal' : prev.templateId),
                          }));
                        }} className={inputClass}>
                            <option value="US">{t.cv.regions.us}</option>
                            <option value="EU">{t.cv.regions.eu}</option>
                            <option value="Balkan">{t.cv.regions.balkan}</option>
                            <option value="MiddleEast">{t.cv.regions.middleEast}</option>
                  <option value="India">{t.cv.regions.india}</option>
                  <option value="Japan">{t.cv.regions.japan}</option>
                            </select>
                      </div>
                      <PhotoUpload
                        photo={cv.personal.photo}
                        photoEnabled={cv.personal.photoEnabled}
                        region={cv.region}
                        isPro={isPro}
                        photoShape={RECT_PHOTO_TEMPLATES.includes(cv.templateId) ? 'rectangle' : 'circle'}
                        onChange={handlePhotoChange}
                        onUpgradeRequest={() => setProTemplateModal(true)}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.fullName}</label><input value={cv.personal.fullName} onChange={e => updatePersonal('fullName', e.target.value)} className={inputClass} placeholder={t.cv.fullNamePlaceholder} /></div>
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.jobTitle}</label><input value={cv.personal.jobTitle} onChange={e => updatePersonal('jobTitle', e.target.value)} className={inputClass} placeholder={t.cv.jobTitlePlaceholder} /></div>
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.email}</label><input type="email" value={cv.personal.email} onChange={e => updatePersonal('email', e.target.value)} className={inputClass} /></div>
                      <div><label className="mb-1.5 block text-sm font-medium">{t.cv.phone}</label><input value={cv.personal.phone} onChange={e => updatePersonal('phone', e.target.value)} className={inputClass} /></div>
                        <div className="sm:col-span-2"><label className="mb-1.5 block text-sm font-medium">{t.cv.address}</label><input value={cv.personal.address} onChange={e => updatePersonal('address', e.target.value)} className={inputClass} /></div>
                      </div>
                        {cv.region === 'India' && (
                          <div className="grid gap-4 sm:grid-cols-2 mt-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                            <div><label className="mb-1.5 block text-sm font-medium">{t.cv.fathersName}</label><input value={cv.personal.fathersName || ''} onChange={e => updatePersonal('fathersName', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1.5 block text-sm font-medium">{t.cv.nationality}</label><input value={cv.personal.nationality || ''} onChange={e => updatePersonal('nationality', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1.5 block text-sm font-medium">{t.cv.dateOfBirth}</label><input value={cv.personal.dateOfBirth || ''} onChange={e => updatePersonal('dateOfBirth', e.target.value)} className={inputClass} placeholder="DD/MM/YYYY" /></div>
                          </div>
                        )}
                        {cv.region === 'Japan' && (
                          <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-4 space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-sm font-medium">{t.cv.dateOfBirth} <span className="text-muted-foreground text-xs">(YYYY/MM/DD)</span></label>
                                <input
                                  value={cv.personal.dateOfBirth || ''}
                                  onChange={e => updatePersonal('dateOfBirth', e.target.value)}
                                  className={inputClass}
                                  placeholder="例: 1990/04/15"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-sm font-medium">{t.cv.gender || '性別'}</label>
                                <div className="flex gap-4 h-10 items-center">
                                  {[
                                    { val: '男', label: t.cv.genderMale || '男' },
                                    { val: '女', label: t.cv.genderFemale || '女' },
                                    { val: 'その他', label: t.cv.genderOther || 'その他' },
                                  ].map(({ val, label }) => (
                                    <label key={val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                      <input
                                        type="radio"
                                        name="gender"
                                        value={val}
                                        checked={cv.personal.gender === val}
                                        onChange={() => updatePersonal('gender', val)}
                                        className="accent-primary"
                                      />
                                      {label}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Gender field for all non-Japan regions */}
                        {cv.region !== 'Japan' && (
                          <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-4">
                            <label className="mb-2 block text-sm font-medium">{t.cv.gender}</label>
                            <div className="flex gap-6 h-10 items-center">
                              {[
                                { val: 'male', label: t.cv.genderMale },
                                { val: 'female', label: t.cv.genderFemale },
                              ].map(({ val, label }) => (
                                <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                                  <input
                                    type="radio"
                                    name="gender-general"
                                    value={val}
                                    checked={cv.personal.gender === val}
                                    onChange={() => updatePersonal('gender', val)}
                                    className="accent-primary"
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                {/* Step 1: Experience */}
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]" style={{backgroundImage:'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 60%)'}}>
                      <p className="text-sm font-semibold text-[#d4aa50]">{t.cv.aiExperienceIntro}</p>
                      <p className="mt-0.5 text-xs text-[#7a8499] leading-snug">{t.cv.aiExperienceIntroSub}</p>
                    </div>
                    {cv.experience.map((exp, idx) => (
                      <div key={exp.id} className="rounded-lg border border-border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">#{idx + 1}</span>
                            <button onClick={() => removeExperience(exp.id)} className="text-destructive hover:underline text-xs"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.position}</label><input value={exp.position} onChange={e => updateExperience(exp.id, 'position', e.target.value)} className={inputClass} /></div>
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.company}</label><input value={exp.company} onChange={e => updateExperience(exp.id, 'company', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1 block text-xs font-medium">{t.cv.startDate}</label><MonthPicker value={exp.startDate} onChange={val => updateExperience(exp.id, 'startDate', val)} locale={locale} templateId={cv.templateId} /></div>
                            <div>
                              <label className="mb-1 block text-xs font-medium">{t.cv.endDate}</label>
                              <div className="flex items-center gap-2">
                                <MonthPicker value={exp.endDate} onChange={val => updateExperience(exp.id, 'endDate', val)} locale={locale} templateId={cv.templateId} disabled={exp.isPresent} className="flex-1" />
                                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                                  <input type="checkbox" checked={exp.isPresent} onChange={e => updateExperience(exp.id, 'isPresent', e.target.checked)} className="rounded" />
                                  {t.cv.present}
                                </label>
                              </div>
                            </div>
                        </div>
                        <div><label className="mb-1 block text-xs font-medium">{t.cv.description}</label><textarea value={exp.description} onChange={e => updateExperience(exp.id, 'description', e.target.value)} className={textareaClass} /></div>
                        {/* AI Improvements panel */}
                        <div className="rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] p-4 space-y-3 shadow-[0_4px_20px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.03)]" style={{backgroundImage:'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 50%)'}}>
                          <p className="text-xs font-bold tracking-[0.08em] text-[#d4aa50] flex items-center gap-1.5 uppercase">
                            <Sparkles className="h-3.5 w-3.5 text-[#d4aa50]" />{t.cv.aiBullets}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.cv.industryLabel}</label>
                              <select
                                value={expIndustry[exp.id] ?? 'general'}
                                onChange={e => setExpIndustry(prev => ({ ...prev, [exp.id]: e.target.value as BulletIndustry }))}
                                className={inputClass + ' h-9 text-xs'}
                              >
                                {industryOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {t.cv.industries[opt.value as keyof typeof t.cv.industries]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.cv.levelLabel}</label>
                              <select
                                value={expLevel[exp.id] ?? 'mid'}
                                onChange={e => setExpLevel(prev => ({ ...prev, [exp.id]: e.target.value as BulletLevel }))}
                                className={inputClass + ' h-9 text-xs'}
                              >
                                {levelOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {t.cv.bulletLevels[opt.value as keyof typeof t.cv.bulletLevels]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <PremiumAIButton
                            onClick={() => handleGenBullets(exp.id)}
                            disabled={generatingBulletsId === exp.id}
                            className="w-full"
                            icon={Wand2}
                            label={generatingBulletsId === exp.id ? t.common.loading : t.cv.aiBullets}
                            subtitle={generatingBulletsId === exp.id ? undefined : t.cv.aiBulletsSubtext}
                            showArrow
                          />
                          {INTERNAL_AI_RESET_ENABLED ? <ExperienceAiCopyDiagnosticsButton /> : null}
                        </div>
                      </div>
                    ))}
                    <button onClick={addExperience} className={btnSecondary}><Plus className="h-4 w-4" />{t.cv.addMore}</button>
                  </div>
                )}

                {/* Step 2: Education */}
                {step === 2 && (
                  <div className="space-y-6">
                    {cv.education.map((edu, idx) => (
                      <div key={edu.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">#{idx + 1}</span>
                          <button onClick={() => removeEducation(edu.id)} className="text-destructive hover:underline text-xs"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.degree}</label><input value={edu.degree} onChange={e => updateEducation(edu.id, 'degree', e.target.value)} className={inputClass} /></div>
                          <div><label className="mb-1 block text-xs font-medium">{t.cv.school}</label><input value={edu.school} onChange={e => updateEducation(edu.id, 'school', e.target.value)} className={inputClass} /></div>
                            <div><label className="mb-1 block text-xs font-medium">{t.cv.startDate}</label><MonthPicker value={edu.startDate} onChange={val => updateEducation(edu.id, 'startDate', val)} locale={locale} templateId={cv.templateId} /></div>
                            <div><label className="mb-1 block text-xs font-medium">{t.cv.endDate}</label><MonthPicker value={edu.endDate} onChange={val => updateEducation(edu.id, 'endDate', val)} locale={locale} templateId={cv.templateId} /></div>
                        </div>
                      </div>
                    ))}
                    <button onClick={addEducation} className={btnSecondary}><Plus className="h-4 w-4" />{t.cv.addMore}</button>
                  </div>
                )}

                {/* Step 3: Skills & Languages */}
                {step === 3 && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="font-semibold mb-3">{t.cv.skills}</h3>
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div ref={skillAutocompleteRef} className="relative min-w-0 flex-1">
                          <input
                            ref={skillInputRef}
                            value={skillInput}
                            onChange={e => {
                              const nextValue = e.target.value;
                              setSkillInput(nextValue);
                              setShowSkillSuggestions(nextValue.trim().length >= 2);
                            }}
                            onFocus={() => setShowSkillSuggestions(trimmedSkillQuery.length >= 2)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addSkill();
                              }

                              if (e.key === 'Escape') {
                                setShowSkillSuggestions(false);
                              }
                            }}
                            autoComplete="off"
                            role="combobox"
                            aria-autocomplete="list"
                            aria-controls="cv-skill-suggestions"
                            aria-expanded={shouldShowSkillSuggestions}
                            aria-haspopup="listbox"
                            className={inputClass + ' min-h-11'}
                            placeholder={t.cv.skillPlaceholder}
                          />
                          {shouldShowSkillSuggestions && (
                            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                              <div
                                id="cv-skill-suggestions"
                                role="listbox"
                                className="max-h-72 overflow-y-auto overscroll-contain py-1"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                              >
                                {skillSuggestions.map((option) => (
                                  <button
                                    key={option.canonicalName}
                                    type="button"
                                    onClick={() => addSkill(option)}
                                    className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-foreground"
                                  >
                                    {option.localizedLabel}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button onClick={() => addSkill()} className={btnSecondary + ' min-h-11 w-full justify-center sm:w-auto'}><Plus className="h-4 w-4" /></button>
                      </div>
                      {cv.skills.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {cv.skills.map((s, i) => {
                            const cat = getSkillCategory(s);
                            return (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                                  cat === 'soft'
                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                                    : 'bg-primary/10 text-primary'
                                }`}
                              >
                                {getLocalizedCvSkillName(s, locale)}
                                <button onClick={() => removeSkill(i)} className="hover:text-destructive ml-0.5"><Trash2 className="h-3 w-3" /></button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {smartSkillSuggestions.length > 0 && (
                        <div className="mt-4 rounded-lg border border-border/60 bg-muted/30 p-3">
                          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            {t.cv.suggestedSkills || 'Suggested Skills'}
                          </p>
                          {(() => {
                            const techSuggestions = smartSkillSuggestions.filter(o => o.category === 'technical');
                            const softSuggestions = smartSkillSuggestions.filter(o => o.category === 'soft');
                            const renderSuggestionChips = (options: CvSkillOption[]) => (
                              <div className="flex flex-wrap gap-2">
                                {options.map((option) => (
                                  <button
                                    key={option.canonicalName}
                                    type="button"
                                    onClick={() => {
                                      setCv((prev) => {
                                        const normalized = option.canonicalName.trim().toLocaleLowerCase();
                                        if (prev.skills.some((s) => (resolveStoredCvSkillName(s) ?? s).trim().toLocaleLowerCase() === normalized)) return prev;
                                        return { ...prev, skills: [...prev.skills, option.canonicalName] };
                                      });
                                    }}
                                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                                  >
                                    <Plus className="h-3 w-3" />
                                    {option.localizedLabel}
                                  </button>
                                ))}
                              </div>
                            );
                            return (
                              <div className="space-y-3">
                                {techSuggestions.length > 0 && (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.cv.skillCategories?.technical || 'Technical Skills'}</p>
                                    {renderSuggestionChips(techSuggestions)}
                                  </div>
                                )}
                                {softSuggestions.length > 0 && (
                                  <div>
                                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t.cv.skillCategories?.soft || 'Soft Skills'}</p>
                                    {renderSuggestionChips(softSuggestions)}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">{t.cv.certifications}</h3>
                      <div className="flex gap-2 mb-3">
                        <input value={certInput} onChange={e => setCertInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCert()} className={inputClass} placeholder={t.cv.certPlaceholder} />
                        <button onClick={addCert} className={btnSecondary}><Plus className="h-4 w-4" /></button>
                      </div>
                      <div className="space-y-1">
                        {cv.certifications.map((c, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            {c}
                            <button onClick={() => setCv(prev => ({ ...prev, certifications: prev.certifications.filter((_, idx) => idx !== i) }))} className="text-destructive hover:underline"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">{t.cv.languages}</h3>
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div ref={langAutocompleteRef} className="relative min-w-0 flex-1">
                          <div
                            className="flex min-h-11 w-full cursor-text items-center rounded-lg border border-input bg-background px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                            onPointerDown={(event) => {
                              if (event.target !== langInputRef.current) {
                                event.preventDefault();
                              }

                              focusLanguageInput();
                            }}
                          >
                            <input
                              ref={langInputRef}
                              value={langName}
                              onChange={e => {
                                const nextValue = e.target.value;
                                setLangName(nextValue);
                                setSelectedLanguageName(null);
                                setShowLanguageSuggestions(nextValue.trim().length >= 2);
                              }}
                              onFocus={() => setShowLanguageSuggestions(trimmedLanguageQuery.length >= 2)}
                              onKeyDown={e => {
                                if (e.key === 'ArrowDown' && shouldShowLanguageSuggestions) {
                                  e.preventDefault();
                                  setActiveLanguageSuggestionIndex((currentIndex) => Math.min(languageSuggestions.length - 1, currentIndex + 1));
                                }

                                if (e.key === 'ArrowUp' && shouldShowLanguageSuggestions) {
                                  e.preventDefault();
                                  setActiveLanguageSuggestionIndex((currentIndex) => Math.max(0, currentIndex - 1));
                                }

                                if (e.key === 'Enter') {
                                  e.preventDefault();

                                  if (shouldShowLanguageSuggestions && activeLanguageSuggestionIndex >= 0) {
                                    selectLanguageSuggestion(languageSuggestions[activeLanguageSuggestionIndex]);
                                    return;
                                  }

                                  addLanguage();
                                }

                                if (e.key === 'Escape') {
                                  setShowLanguageSuggestions(false);
                                  setActiveLanguageSuggestionIndex(-1);
                                }
                              }}
                              autoComplete="off"
                              role="combobox"
                              aria-autocomplete="list"
                              aria-controls="cv-language-suggestions"
                              aria-expanded={shouldShowLanguageSuggestions}
                              aria-haspopup="listbox"
                              aria-activedescendant={activeLanguageSuggestionIndex >= 0 ? `cv-language-suggestion-${languageSuggestions[activeLanguageSuggestionIndex]?.code}` : undefined}
                              className="h-11 w-full min-w-0 border-0 bg-transparent px-0 text-sm outline-none placeholder:text-muted-foreground"
                              placeholder={t.cv.langPlaceholder}
                            />
                          </div>
                          {shouldShowLanguageSuggestions && (
                            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                              <div
                                id="cv-language-suggestions"
                                role="listbox"
                                className="max-h-72 overflow-y-auto overscroll-contain py-1"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                              >
                                {languageSuggestions.map((option, index) => (
                                  <button
                                    key={option.code}
                                    id={`cv-language-suggestion-${option.code}`}
                                    ref={(element) => {
                                      langSuggestionRefs.current[index] = element;
                                    }}
                                    type="button"
                                    onClick={() => selectLanguageSuggestion(option)}
                                    onMouseEnter={() => setActiveLanguageSuggestionIndex(index)}
                                    className={`flex min-h-11 w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-foreground ${activeLanguageSuggestionIndex === index ? 'bg-accent text-foreground' : ''}`}
                                  >
                                    {option.localizedLabel}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex w-full gap-3 sm:w-auto sm:flex-none">
                          <select
                            value={langLevel}
                            onChange={e => setLangLevel(e.target.value)}
                            className={inputClass + ' min-h-11 flex-1 sm:w-52 sm:flex-none'}
                          >
                            <option value="">{t.cv.levelPlaceholder}</option>
                            <option value="native">{t.cv.levels.native}</option>
                            <option value="fluent">{t.cv.levels.fluent}</option>
                            <option value="advanced">{t.cv.levels.advanced}</option>
                            <option value="intermediate">{t.cv.levels.intermediate}</option>
                            <option value="basic">{t.cv.levels.basic}</option>
                          </select>
                          <button
                            onClick={() => addLanguage()}
                            disabled={!canAddLanguage}
                            className={btnSecondary + ' min-h-11 min-w-11 shrink-0 justify-center px-3 disabled:cursor-not-allowed disabled:opacity-50'}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {cv.languages.map((l, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            {getLocalizedCvLanguageName(l.name, locale)} - {localizeCvLanguageLevel(l.level, locale)}
                            <button onClick={() => setCv(prev => applyCanonicalSkillsLanguagesEducationEdit(prev, {
                              languages: prev.languages.filter((_, idx) => idx !== i),
                            }))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Summary */}
                {step === 4 && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-[rgba(212,178,84,0.20)] bg-[#080b12] px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.03)]" style={{backgroundImage:'linear-gradient(180deg,rgba(255,255,255,0.025) 0%,transparent 60%)'}}>
                      <p className="text-sm font-semibold text-[#d4aa50]">{t.cv.aiSummaryIntro}</p>
                      <p className="mt-0.5 text-xs text-[#7a8499] leading-snug">{t.cv.aiSummaryIntroSub}</p>
                    </div>
                    <PremiumAIButton
                      onClick={handleGenSummary}
                      disabled={isSummaryGenerating}
                      icon={Sparkles}
                      label={isSummaryGenerating ? t.common.loading : t.cv.generate}
                      subtitle={isSummaryGenerating ? undefined : t.cv.generateSubtext}
                      showArrow
                    />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground/60">{t.cv.rewrite}:</p>
                      <div className="space-y-2">
                        {(['shorter', 'stronger', 'professional'] as const).map(style => (
                          <PremiumAIButton
                            key={style}
                            onClick={() => handleRewrite(style)}
                            disabled={!!rewritingStyle}
                            icon={Wand2}
                            label={rewritingStyle === style ? t.common.loading : (style === 'shorter' ? t.cv.short : style === 'stronger' ? t.cv.strong : t.cv.professional)}
                            subtitle={rewritingStyle === style ? undefined : (style === 'shorter' ? t.cv.shorterSubtext : style === 'stronger' ? t.cv.strongerSubtext : t.cv.professionalSubtext)}
                            badge={!isPro ? <ProBadge /> : undefined}
                            showArrow
                          />
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={cv.summary}
                      onChange={e => setCv(prev => applyCanonicalSummaryEdit(prev, e.target.value, locale))}
                      className={textareaClass + ' min-h-[180px]'}
                      placeholder={t.cv.summaryPlaceholder}
                    />
                      <div className="border-t border-border pt-4 mt-4 space-y-3">
                        <h4 className="font-semibold text-sm">{t.cv.analyzeJob}</h4>
                        {!isPro ? (
                          <PremiumAIButton
                            onClick={() => setJobAnalyzerModal(true)}
                            icon={Search}
                            label={t.cv.analyzeJob}
                            subtitle={t.cv.analyzeJobSubtext}
                            hint={t.cv.proHint}
                            badge={<ProBadge />}
                            showArrow
                          />
                          ) : (
                            <>
                              <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)} className={textareaClass} placeholder={t.cv.jobDescPlaceholder} />
                              <PremiumAIButton
                                onClick={handleAnalyzeJob}
                                className="mt-2"
                                icon={Search}
                                label={t.cv.analyzeJob}
                                subtitle={t.cv.analyzeJobSubtext}
                                hint={t.cv.proHint}
                                badge={<ProBadge />}
                                showArrow
                              />

                            {isAnalyzing && <JobAnalysisLoadingState />}
                            {showAnalysis && analysis && !isAnalyzing && (
                              <JobAnalysisResultScreen
                                result={analysis}
                                isPro={isPro}
                                onClose={() => { setShowAnalysis(false); setAnalysis(null); }}
                              />
                            )}
                          </>
                        )}
                      </div>
                  </div>
                )}

                {/* Step 5: Template Selection */}
                  {step === 5 && (
                    <div>
                      <div className="mb-4 space-y-3">
                        <h3 className="font-semibold">{t.cv.selectTemplate}</h3>
                        <PremiumAIButton
                          onClick={handleTemplateRecommend}
                          icon={Sparkles}
                          label={t.cv.aiRecommend}
                          subtitle={t.cv.aiRecommendSubtext}
                          showArrow
                        />
                      </div>
                      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                        {(Object.entries(templateInfo) as [TemplateId, typeof templateInfo[TemplateId]][]).map(([id, info]) => {
                          const translated = t.templates.items[id];
                          const isSelected = cv.templateId === id;
                          const isRecommended = recommendedTemplateId === id;
                          const categoryKey = info.category.toLowerCase().replace('-friendly', '').replace('japanese', 'japanese') as keyof typeof t.templates.categories;
                          const translatedCategory = translated?.category || t.templates.categories[categoryKey] || info.category;
                          return (
                            <div
                              key={id}
                              className={`group rounded-xl border-2 transition-all overflow-hidden flex flex-col ${isSelected ? 'border-primary shadow-md' : isRecommended ? 'border-amber-400 shadow-md' : 'border-border hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5'}`}
                            >
                              {/* Visual preview area — tap to open fullscreen */}
                              <div className="relative aspect-[210/297] w-full bg-muted/30 overflow-hidden shrink-0">
                                {info.isPro && (
                                  <div className="absolute top-2 end-2 z-10 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-md">
                                    <Crown className="h-2.5 w-2.5" />
                                    {t.templates.proBadge}
                                  </div>
                                )}
                                {isRecommended && (
                                  <div className="absolute top-2 start-2 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-md">
                                    <Star className="h-2.5 w-2.5 fill-amber-900" />
                                    {t.cv.recommendedForYou}
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="absolute inset-0 border-2 border-primary rounded-[0.6rem] pointer-events-none z-20" />
                                )}
                                <button
                                  type="button"
                                  aria-label={`${t.cv.preview}: ${translated?.name || info.name}`}
                                  onClick={() => setFullscreenTemplateId(id)}
                                  className="absolute inset-0 z-[15] flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                                >
                                  <div className="absolute inset-0 p-0.5 sm:p-1.5 transition-transform duration-300 ease-out group-hover:scale-[1.02]">
                                    <TemplatePreview templateId={id} lazy maxScale={0.72} />
                                  </div>
                                  <span className="absolute bottom-2 end-2 z-20 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                                    <Maximize2 className="h-3 w-3" />
                                    {t.cv.preview}
                                  </span>
                                </button>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
                              </div>
                              {/* Card info — tap to select template */}
                              <button
                                type="button"
                                onClick={() => handleTemplateSelect(id)}
                                className={`p-3 border-t border-border flex flex-col gap-1 flex-1 min-w-0 text-start w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${isSelected ? 'bg-primary/5' : 'bg-card hover:bg-muted/30'}`}
                              >
                                <div className="flex items-center justify-between gap-1 min-w-0">
                                  <h4 className="text-xs font-bold text-foreground leading-tight truncate">{translated?.name || info.name}</h4>
                                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary whitespace-nowrap shrink-0">
                                    {translatedCategory}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed min-w-0">
                                  {translated?.description || info.description}
                                </p>
                                {isRecommended && (
                                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                                    {info.isPro ? t.cv.optimizedForProfile : t.cv.bestResultsTemplate}
                                  </p>
                                )}
                                {info.isPro && !isPro && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Lock className="h-2.5 w-2.5 text-primary/60 shrink-0" />
                                    <span className="text-[9px] text-primary/70 font-medium">{t.cv.unlockWithPro}</span>
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                        {/* Step 6: Preview */}
                        {step === 6 && (
                          <div>
                                <div className="mb-4 flex gap-2 flex-wrap items-center">
                                  {/* Download dropdown */}
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowDownloadMenu(v => !v)}
                                      className={btnPrimary + ' flex items-center gap-1'}
                                      disabled={isPdfExporting || isWordExporting}
                                    >
                                      <Download className="h-4 w-4" />
                                      {isPdfExporting || isWordExporting ? '...' : t.cv.downloadCv}
                                      <ChevronDown className="h-3 w-3 ml-0.5" />
                                    </button>
                                    {showDownloadMenu && (
                                      <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                                        <button
                                          onClick={() => handlePDFDownload('cv-inline-preview')}
                                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left"
                                          disabled={isPdfExporting}
                                        >
                                          <File className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                          <div>
                                            <div className="font-semibold text-sm">{t.cv.downloadPdf}</div>
                                            <div className="text-xs text-muted-foreground">{t.cv.downloadPdfDesc}</div>
                                          </div>
                                        </button>
                                        <button
                                          onClick={handleDOCXDownload}
                                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors text-left border-t border-border"
                                          disabled={isWordExporting}
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
                                  <div key={`diag-inline-${exportDiagTick}`}>
                                    <CvExportCopyDiagnosticsButton />
                                  </div>
                                <button onClick={() => { exportToClipboard('cv-inline-preview'); toast.success(t.cv.copied); }} className={btnSecondary}>
                                  <Copy className="h-4 w-4" />{t.cv.copy}
                                </button>
                              </div>
                        <div id="cv-inline-preview" className="overflow-auto rounded-xl border border-border shadow-lg">
                          {TemplateComponent && (
                            <TemplateComponent
                              key={`${cv.templateId}-${photoForCurrentTemplate?.slice(-20) ?? 'no-photo'}`}
                              data={localizedPreviewCv}
                              locale={locale}
                            />
                          )}
                        </div>
                      </div>
                    )}

                {/* Navigation */}
                <div className="mt-6 flex justify-between">
                  <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className={btnSecondary + ' disabled:opacity-30'}>
                    <ChevronLeft className="h-4 w-4" />{t.common.back}
                  </button>
                  <button onClick={() => setStep(Math.min(steps.length - 1, step + 1))} disabled={step === steps.length - 1} className={btnPrimary + ' disabled:opacity-30'}>
                    {t.common.next}<ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
        </main>
      <Footer />
      <FreeLimitModal
        open={limitModal.open}
        type={limitModal.type}
        onClose={() => setLimitModal(prev => ({ ...prev, open: false }))}
      />
      <JobAnalyzerProModal
        open={jobAnalyzerModal}
        onClose={() => setJobAnalyzerModal(false)}
      />
      <AiImprovementsProModal
        open={aiImprovementsModal}
        onClose={() => setAiImprovementsModal(false)}
      />
      <SummaryAiProModal
        open={summaryAiModal}
        onClose={() => setSummaryAiModal(false)}
      />
      <ProTemplateModal
        open={proTemplateModal}
        onClose={() => setProTemplateModal(false)}
      />
      <AiRecommendProModal
        open={aiRecommendModal}
        onClose={() => setAiRecommendModal(false)}
      />
      <TemplatePreviewFullscreenModal
        open={fullscreenTemplateId !== null}
        templateId={fullscreenTemplateId}
        templateName={
          fullscreenTemplateId
            ? (t.templates.items[fullscreenTemplateId]?.name || templateInfo[fullscreenTemplateId].name)
            : ''
        }
        selectLabel={t.cv.selectTemplate}
        previewLabel={t.cv.preview}
        onClose={() => setFullscreenTemplateId(null)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
}
