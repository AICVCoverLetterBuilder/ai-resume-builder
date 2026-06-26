'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useI18n } from '@/lib/i18n/context';
import { useApp, checkProAccess } from '@/lib/store';
import { templateComponents } from '@/components/cv-templates';
import { analyzeJobDescription } from '@/lib/ai';
import { industryOptions, levelOptions, type BulletIndustry, type BulletLevel } from '@/lib/ai-bullets';
import { exportToClipboard, exportToDOCX, exportRirekishoToDOCX, exportToPDF, openPrintFallback } from '@/lib/export';
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
import type { CVData, WorkExperience, Education, Region, TemplateId } from '@/lib/types';
import { templateInfo, recommendTemplate } from '@/lib/types';
import { loadCvDraft } from '@/lib/draft-storage';
import { apiFetch } from '@/lib/api';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles, Plus, Trash2, Eye, FileText, Copy,
  Search, ChevronLeft, ChevronRight, Wand2, Crown, Star, Lock,
  Download, ChevronDown, File
} from 'lucide-react';
import { PhotoUpload } from '@/components/PhotoUpload';
import { MonthPicker } from '@/components/MonthPicker';
import { UpgradeBuilderBanner, FreeLimitModal, JobAnalyzerProModal, AiImprovementsProModal, SummaryAiProModal, ProTemplateModal, AiRecommendProModal } from '@/components/UpgradePro';
import { PremiumAIButton, ProBadge } from '@/components/PremiumAIButton';
import { JobAnalysisResultScreen, JobAnalysisLoadingState } from '@/components/JobAnalysisResultScreen';
import { TemplatePreview } from '@/components/TemplatePreview';

const emptyCV = (): CVData => ({
  id: crypto.randomUUID(),
  name: '',
  personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '' },
  summary: '',
  experience: [],
  education: [],
  skills: [],
  certifications: [],
  languages: [],
  templateId: 'modern-minimal',
  region: 'US',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const emptyExp = (): WorkExperience => ({
  id: crypto.randomUUID(), company: '', position: '', startDate: '', endDate: '', isPresent: false, description: '',
});

const emptyEdu = (): Education => ({
  id: crypto.randomUUID(), school: '', degree: '', startDate: '', endDate: '', description: '',
});

export default function CVBuilderPage() {
  const { t, locale } = useI18n();
  const { currentCv, setCurrentCv, isPro, canDownload, incrementDownloads, markAiRecommendUsed, recordProAiSuccess, lastCvSavedAt, persistCurrentDraft, getAiGate } = useApp();
  const [cv, setCv] = useState<CVData>(currentCv || emptyCV());
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
    if (currentCv) setCv(currentCv);
  }, [currentCv]);

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
    setCv(prev => {
      const updated = { ...prev, experience: prev.experience.map(e => {
        if (e.id === id) {
          return { ...e, [field]: value };
        }
        return e;
      })};
      return updated;
    });
  };

  const addEducation = () => setCv(prev => ({ ...prev, education: [...prev.education, emptyEdu()] }));
  const removeEducation = (id: string) => setCv(prev => ({ ...prev, education: prev.education.filter(e => e.id !== id) }));
  const updateEducation = (id: string, field: string, value: string) => {
    setCv(prev => ({ ...prev, education: prev.education.map(e => e.id === id ? { ...e, [field]: value } : e) }));
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

      return { ...prev, skills: [...prev.skills, resolvedSkill] };
    });

    setSkillInput('');
    setShowSkillSuggestions(false);
  };
  const removeSkill = (idx: number) => setCv(prev => ({ ...prev, skills: prev.skills.filter((_, i) => i !== idx) }));

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

  // Templates that need a rectangular photo (no circular mask/transparency artifacts).
  const RECT_PHOTO_TEMPLATES: TemplateId[] = ['elegant-formal', 'executive-premium'];

  // ── Three-source photo state ─────────────────────────────────────────────────
  // originalPhotoDataUrl: raw file from disk — NEVER circular/rect cropped.
  //   Set when PhotoUpload calls onChange with the third argument.
  // circularPhotoDataUrl: circular-clip PNG, used by circle-shaped templates.
  // rectangularPhotoDataUrl: 3:4 JPEG derived from originalPhotoDataUrl (not from the circular crop).
  const [originalPhotoDataUrl, setOriginalPhotoDataUrl] = useState<string | undefined>(
    () => loadCvDraft()?.originalPhoto ?? undefined,
  );
  const [circularPhotoDataUrl, setCircularPhotoDataUrl] = useState<string | undefined>(
    () => loadCvDraft()?.circularPhoto ?? undefined,
  );
  const [rectangularPhotoDataUrl, setRectangularPhotoDataUrl] = useState<string | undefined>(
    () => loadCvDraft()?.rectangularPhoto ?? undefined,
  );

  // rectangularPhotoDataUrl is set directly by handlePhotoChange from the crop modal output.
  // No useEffect re-generation — the crop modal produces it with the user's exact framing.

  const localizedPreviewCv = useMemo<CVData>(
    () => {
      const base = {
        ...cv,
        skills: cv.skills.map((skill) => getLocalizedCvSkillName(skill, locale)),
        languages: cv.languages.map((language) => ({
          ...language,
          name: getLocalizedCvLanguageName(language.name, locale),
        })),
      };
      if (RECT_PHOTO_TEMPLATES.includes(cv.templateId)) {
        // Rectangle templates: use rectangular photo derived from the original upload.
        // Append '#rect' cache-buster so the browser never reuses a stale circular decode.
        const rectUrl = rectangularPhotoDataUrl;
        if (rectUrl) {
          const cacheBustedUrl = rectUrl.includes('#') ? rectUrl : rectUrl + '#rect';
          return { ...base, personal: { ...base.personal, photo: cacheBustedUrl } };
        }
        // No original available — hide photo rather than show circular crop in a rect frame
        return { ...base, personal: { ...base.personal, photo: undefined } };
      }
      // Circle templates: use the circular crop stored in circularPhotoDataUrl.
      // Fall back to cv.personal.photo for any existing data loaded from storage.
      if (circularPhotoDataUrl) {
        return { ...base, personal: { ...base.personal, photo: circularPhotoDataUrl } };
      }
      return base;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cv, locale, circularPhotoDataUrl, rectangularPhotoDataUrl],
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

    setCv(prev => {
      if (prev.languages.some((language) => language.name === resolvedName)) return prev;

      return {
        ...prev,
        languages: [
          ...prev.languages,
          { name: resolvedName, level: langLevel || t.cv.levels.intermediate },
        ],
      };
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
    setCv(prev => ({ ...prev, personal: { ...prev.personal, photo, photoEnabled: enabled } }));
    let orig: string | undefined;
    let circ: string | undefined;
    let rect: string | undefined;
    if (photo === undefined) {
      setOriginalPhotoDataUrl(undefined);
      setCircularPhotoDataUrl(undefined);
      setRectangularPhotoDataUrl(undefined);
    } else {
      if (originalPhoto) {
        setOriginalPhotoDataUrl(originalPhoto);
        orig = originalPhoto;
      }
      setCircularPhotoDataUrl(photo);
      circ = photo;
      if (rectPhoto) {
        setRectangularPhotoDataUrl(rectPhoto);
        rect = rectPhoto;
      }
    }
    // Persist photo data URLs to the draft immediately
    persistCurrentDraft({ originalPhoto: orig, circularPhoto: circ, rectangularPhoto: rect });
  };

  const getCurrentProTokenOrToast = (openUpgradeModal: () => void) => {
    const aiGate = getAiGate();
    const gateAccess = checkProAccess(aiGate.status !== 'free', 0);
    if (gateAccess !== 'allowed') {
      if (gateAccess === 'upgrade') {
        openUpgradeModal();
        return null;
      }
      toast.error('AI service is temporarily unavailable. Please try again later.');
      return null;
    }
    if (aiGate.status === 'syncing') {
      toast.error(t.common.proAuthorizationUnavailable);
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
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      // Calculate real total experience duration from actual dates
      const calculateExperienceSummary = (): string => {
        if (cv.experience.length === 0) return '';
        let totalMonths = 0;
        let hasValidDates = false;
        const now = new Date();
        for (const exp of cv.experience) {
          if (!exp.startDate) continue;
          const start = new Date(exp.startDate + '-01');
          if (isNaN(start.getTime())) continue;
          const end = exp.isPresent || !exp.endDate
            ? now
            : new Date(exp.endDate + '-01');
          if (isNaN(end.getTime())) continue;
          const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          if (months > 0) { totalMonths += months; hasValidDates = true; }
        }
        if (!hasValidDates) return '';
        if (totalMonths < 6) return 'practical';
        if (totalMonths < 12) return 'under-one-year';
        const years = Math.floor(totalMonths / 12);
        const remainingMonths = totalMonths % 12;
        if (remainingMonths === 0) return `${years}`;
        if (remainingMonths < 6) return `${years}`;
        return `${years}.5`;
      };

      const experienceDuration = calculateExperienceSummary();
      const experienceEntries = cv.experience.slice(0, 4).map(exp => ({
        position: exp.position,
        company: exp.company,
        startDate: exp.startDate,
        endDate: exp.isPresent ? 'present' : exp.endDate,
        description: exp.description?.slice(0, 300) || '',
      }));

      const { data: summaryData, response: res } = await apiFetch<{ result?: string; error?: string }>('/api/generate', {
        body: {
          action: 'summary',
          proToken,
          jobTitle: cv.personal.jobTitle,
          experienceDuration,
          experienceEntries,
          skills: cv.skills.slice(0, 10),
          languages: cv.languages.slice(0, 4),
          education: cv.education.slice(0, 2).map(e => ({ degree: e.degree, school: e.school })),
          locale,
          gender: cv.personal.gender || '',
        },
        signal: controller.signal,
      });
      if (!res.ok || summaryData.error) {
        if (res.status === 403) {
          if (getAiGate().status !== 'free') toast.error(t.common.proAuthorizationUnavailable);
          else setSummaryAiModal(true);
          return;
        }
        throw new Error(summaryData.error || 'AI error');
      }
      setCv(prev => ({ ...prev, summary: summaryData.result ?? '' }));
      recordProAiSuccess();
      toast.success(t.cv.genSuccess);
    } catch {
      if (process.env.NODE_ENV !== 'production') console.error('[Professional Summary] Generate error');
      toast.error('AI service is temporarily unavailable. Please try again later.');
    } finally {
      clearTimeout(timer);
      setIsSummaryGenerating(false);
    }
  };

  const handleGenBullets = async (expId: string) => {
    const exp = cv.experience.find(e => e.id === expId);
    if (!exp) return;
    if (generatingBulletsId) return; // Prevent multiple concurrent requests

    const proToken = getCurrentProTokenOrToast(() => setAiImprovementsModal(true));
    if (!proToken) return;

    const industry = expIndustry[expId] ?? 'general';
    const level = expLevel[expId] ?? 'mid';

    setGeneratingBulletsId(expId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const requestBody = {
        action: 'bullets',
        proToken,
        position: exp.position,
        company: exp.company,
        industry,
        level,
        locale,
        gender: cv.personal.gender || '',
      };

      const { data: bulletsData, response: res } = await apiFetch<{ result?: string; error?: string }>('/api/generate', {
        body: requestBody,
        signal: controller.signal,
      });

      if (!res.ok || bulletsData.error) {
        if (res.status === 403) {
          toast.error(getAiGate().status !== 'free' ? t.common.proAuthorizationUnavailable : t.common.proAccessRequired);
          return;
        }
        throw new Error(bulletsData.error || 'AI error');
      }

      // Completely replace existing description with new localized bullets
      const newDescription = bulletsData.result || '';
      updateExperience(expId, 'description', newDescription);
      recordProAiSuccess();
      toast.success(t.cv.bulletsSuccess);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[AI Improvements Error]', err);
      toast.error('AI service is temporarily unavailable. Please try again later.');
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
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const { data: rewriteData, response: res } = await apiFetch<{ result?: string; error?: string }>('/api/generate', {
        body: { action: 'rewrite', proToken, text: cv.summary, style, locale, gender: cv.personal.gender || '' },
        signal: controller.signal,
      });
      if (!res.ok || rewriteData.error) throw new Error(rewriteData.error || 'AI error');
      setCv(prev => ({ ...prev, summary: rewriteData.result ?? cv.summary }));
      recordProAiSuccess();
      toast.success(`${t.cv.rewriteSuccess} (${t.cv[style === 'shorter' ? 'short' : style === 'stronger' ? 'strong' : 'professional']})`);
    } catch {
      toast.error('AI service is temporarily unavailable. Please try again later.');
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
      recordProAiSuccess();
    }, 1300);
  };

    const handleSave = () => {
    setCurrentCv(cv);
    toast.success(t.cv.saved);
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
        if (cv.templateId === 'rirekisho') {
          await exportRirekishoToDOCX(cv, cv.personal.fullName || '履歴書');
        } else {
          // For rect-photo templates, use rectangularPhotoDataUrl (derived from original upload).
          // For circle templates, use circularPhotoDataUrl or cv.personal.photo.
          let photoForExport: string | undefined;
          if (RECT_PHOTO_TEMPLATES.includes(cv.templateId)) {
            photoForExport = rectangularPhotoDataUrl; // clean JPEG from original, no circular clip
          } else {
            photoForExport = circularPhotoDataUrl ?? cv.personal.photo;
          }
          const cvForExport = { ...cv, personal: { ...cv.personal, photo: photoForExport } };
          await exportToDOCX(cvForExport, cv.personal.fullName || 'CV', locale, cv.templateId);
        }
        incrementDownloads('cv');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'SaveCancelledError') return;
        if (process.env.NODE_ENV !== 'production') console.error('[CV DOCX export] failed:', err);
        toast.error(t.cv.wordExportFailed);
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
        // ── Guard: for rect-photo templates, wait until rectangularPhotoDataUrl has been
        //    computed AND React has committed it to the DOM <img src> attribute.
        //    Poll for up to 3 s in 50 ms increments, then proceed regardless.
        if (RECT_PHOTO_TEMPLATES.includes(cv.templateId) && originalPhotoDataUrl) {
          const expectedFragment = '#rect';
          const deadline = Date.now() + 3000;
          while (Date.now() < deadline) {
            const exportNode = document.getElementById(previewId);
            const firstImg = exportNode?.querySelector('img');
            if (firstImg && firstImg.src.includes(expectedFragment)) break;
            await new Promise(r => setTimeout(r, 50));
          }
          // Extra two rAFs to let the browser finish painting the new src
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }

        // Unique filename per export: cv-<templateId>-<timestamp>.pdf
        const exportFilename = `cv-${cv.templateId}-${Date.now()}`;
        await exportToPDF(previewId, exportFilename);
        incrementDownloads('cv');
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'SaveCancelledError') return;
        if (process.env.NODE_ENV !== 'production') console.error('[CV PDF export] failed:', err);
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
          toast.error(t.cv.pdfExportFailed);
        }
      } finally {
        setIsPdfExporting(false);
      }
    };

    const handleTemplateRecommend = () => {
      if (!getCurrentProTokenOrToast(() => setAiRecommendModal(true))) return;
      if (cv.personal.jobTitle) {
        const recommended = recommendTemplate(cv.personal.jobTitle);
        setCv(prev => ({ ...prev, templateId: recommended }));
        setRecommendedTemplateId(recommended);
        markAiRecommendUsed();
        recordProAiSuccess();
        toast.success(`${t.cv.recommendedToast}: ${t.templates.items[recommended].name}`);
      }
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
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
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
                        <button onClick={() => { exportToClipboard('cv-preview'); toast.success(t.cv.copied); }} className={btnSecondary}>
                          <Copy className="h-4 w-4" />{t.cv.copy}
                        </button>
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">{t.cv.downloadNote}</p>
                  <div id="cv-preview" className="overflow-auto rounded-xl border border-border shadow-lg">
                    {TemplateComponent && (
                      <TemplateComponent
                        key={`${cv.templateId}-${RECT_PHOTO_TEMPLATES.includes(cv.templateId) ? (rectangularPhotoDataUrl?.slice(-20) ?? 'no-rect') : (circularPhotoDataUrl?.slice(-20) ?? 'no-photo')}`}
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
                          setCv(prev => ({
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
                        photoShape={(['elegant-formal', 'executive-premium'] as TemplateId[]).includes(cv.templateId) ? 'rectangle' : 'circle'}
                        onChange={handlePhotoChange}
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
                            <option value={t.cv.levels.native}>{t.cv.levels.native}</option>
                            <option value={t.cv.levels.fluent}>{t.cv.levels.fluent}</option>
                            <option value={t.cv.levels.advanced}>{t.cv.levels.advanced}</option>
                            <option value={t.cv.levels.intermediate}>{t.cv.levels.intermediate}</option>
                            <option value={t.cv.levels.basic}>{t.cv.levels.basic}</option>
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
                            {getLocalizedCvLanguageName(l.name, locale)} - {l.level}
                            <button onClick={() => setCv(prev => ({ ...prev, languages: prev.languages.filter((_, idx) => idx !== i) }))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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
                      onChange={e => setCv(prev => ({ ...prev, summary: e.target.value }))}
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
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {(Object.entries(templateInfo) as [TemplateId, typeof templateInfo[TemplateId]][]).map(([id, info]) => {
                          const translated = t.templates.items[id];
                          const isSelected = cv.templateId === id;
                          const isRecommended = recommendedTemplateId === id;
                          const categoryKey = info.category.toLowerCase().replace('-friendly', '').replace('japanese', 'japanese') as keyof typeof t.templates.categories;
                          const translatedCategory = translated?.category || t.templates.categories[categoryKey] || info.category;
                          return (
                            <button
                              key={id}
                              onClick={() => {
                                if (info.isPro && !isPro) {
                                  setProTemplateModal(true);
                                  return;
                                }
                                setCv(prev => ({ ...prev, templateId: id }));
                              }}
                              className={`group rounded-xl border-2 text-start transition-all overflow-hidden flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'border-primary shadow-md' : isRecommended ? 'border-amber-400 shadow-md' : 'border-border hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5'}`}
                            >
                              {/* Visual preview area */}
                              <div className="relative aspect-[3/4] w-full bg-muted/40 overflow-hidden shrink-0">
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
                                <div className="absolute inset-0 p-3 transition-transform duration-300 ease-out group-hover:scale-[1.04]">
                                  <TemplatePreview templateId={id} />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                              </div>
                              {/* Card info */}
                              <div className="p-3 border-t border-border flex flex-col gap-1 flex-1 min-w-0">
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
                              </div>
                            </button>
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
                                <button onClick={() => { exportToClipboard('cv-inline-preview'); toast.success(t.cv.copied); }} className={btnSecondary}>
                                  <Copy className="h-4 w-4" />{t.cv.copy}
                                </button>
                              </div>
                        <div id="cv-inline-preview" className="overflow-auto rounded-xl border border-border shadow-lg">
                          {TemplateComponent && (
                            <TemplateComponent
                              key={`${cv.templateId}-${RECT_PHOTO_TEMPLATES.includes(cv.templateId) ? (rectangularPhotoDataUrl?.slice(-20) ?? 'no-rect') : (circularPhotoDataUrl?.slice(-20) ?? 'no-photo')}`}
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
    </div>
  );
}
