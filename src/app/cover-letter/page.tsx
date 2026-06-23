'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useApp } from '@/lib/store';
import { exportToClipboard, exportCoverLetterToDOCX, exportCoverLetterToPDF } from '@/lib/export';
import type { CoverLetterData, Tone } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Sparkles, FileText, Copy, Pencil, RefreshCw, Crown, Info, Loader2, Download, ChevronDown, File, User } from 'lucide-react';
import { CoverLetterProModal, FreeLimitModal } from '@/components/UpgradePro';
import { PremiumAIButton, AIBadge } from '@/components/PremiumAIButton';
import { apiFetch } from '@/lib/api';
import { getAppUserId } from '@/lib/iap';

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
}): Promise<{ content: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const { data, response: res } = await apiFetch<{ result?: string; error?: string }>('/api/generate', {
      body: { action: params.action || 'cover-letter-gen', ...params },
      signal: controller.signal,
    });
    if (!res.ok || data.error) {
      throw Object.assign(new Error(data.error || 'AI service error'), { status: res.status });
    }
    return { content: data.result as string, status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export default function CoverLetterPage() {
  const { t, locale } = useI18n();
  const { currentCoverLetter, setCurrentCoverLetter, isPro, canGenerateCoverLetter, incrementClGeneration, canDownload, incrementDownloads, canRegenerateCoverLetter, incrementClRegen, resetClRegen, currentCv, canUseProAi, recordProAiSuccess, lastClSavedAt, getProToken } = useApp();
  const [cl, setCl] = useState<CoverLetterData>(currentCoverLetter || emptyCL());
  const [editing, setEditing] = useState(false);
  const [proModal, setProModal] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'generate' | 'regenerate'>('generate');
  const [downloadLimitModal, setDownloadLimitModal] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isWordExporting, setIsWordExporting] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  // Auto-fill identity fields from CV personal info on mount or when CV changes
  useEffect(() => {
    if (currentCoverLetter) {
      setCl(currentCoverLetter);
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
      setCurrentCoverLetter(cl);
    }, 800);
    return () => {
      if (clAutosaveTimerRef.current) clearTimeout(clAutosaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cl]);

  /** Derive the full candidate name from the CL identity fields */
  const getFullName = (): string => {
    const first = cl.firstName.trim();
    const last = cl.lastName.trim();
    if (first && last) return `${first} ${last}`;
    return first || last || '';
  };

  const handleClPDFDownload = async () => {
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
      await exportCoverLetterToPDF(getFullName(), cl.content, filename, locale);
      incrementDownloads('cl');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'SaveCancelledError') return;
      if (process.env.NODE_ENV !== 'production') console.error('[Cover Letter PDF export] failed:', err);
      toast.error(t.cv.pdfExportFailed);
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleClDOCXDownload = async () => {
    if (!canDownload('cl')) {
      setShowDownloadMenu(false);
      setDownloadLimitModal(true);
      return;
    }
    if (isWordExporting) return;
    setShowDownloadMenu(false);
    setIsWordExporting(true);
    try {
      await exportCoverLetterToDOCX(cl.content, `${t.coverLetter.filename} - ${cl.companyName}`, getFullName(), locale);
      incrementDownloads('cl');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'SaveCancelledError') return;
      if (process.env.NODE_ENV !== 'production') console.error('[Cover Letter DOCX export] failed:', err);
      toast.error(t.cv.wordExportFailed);
    } finally {
      setIsWordExporting(false);
    }
  };

  const handleGenerate = async () => {
    if (!isPro && !canGenerateCoverLetter()) {
      setPaywallReason('generate');
      setProModal(true);
      return;
    }
    if (isPro && !canUseProAi()) {
      toast.error('AI service is temporarily unavailable. Please try again later.');
      return;
    }
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const fullName = getFullName();
      const { content } = await callGenerateAI({
        jobTitle: cl.jobTitle,
        companyName: cl.companyName,
        tone: cl.tone,
        locale,
        variant: 0,
        gender: cl.gender || '',
        personalName: fullName || currentCv?.personal?.fullName || '',
        personalEmail: currentCv?.personal?.email || '',
        personalPhone: currentCv?.personal?.phone || '',
        proToken: getProToken(),
        freeUserId: !isPro ? getAppUserId() : undefined,
      });
      setCl(prev => ({ ...prev, content, updatedAt: new Date().toISOString() }));
      resetClRegen();
      setHasGenerated(true);
      if (!isPro) {
        incrementClGeneration();
      } else {
        recordProAiSuccess();
      }
      toast.success(t.coverLetter.genSuccess);
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 403) {
        setPaywallReason('generate');
        setProModal(true);
      } else {
        if (process.env.NODE_ENV !== 'production') console.error('[Cover Letter] Generate error:', err);
        toast.error('AI service is temporarily unavailable. Please try again later.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!canRegenerateCoverLetter()) {
      setPaywallReason('regenerate');
      setProModal(true);
      return;
    }
    if (isPro && !canUseProAi()) {
      toast.error('AI service is temporarily unavailable. Please try again later.');
      return;
    }
    if (isRegenerating) return;

    setIsRegenerating(true);
    try {
      const fullName = getFullName();
      const { content } = await callGenerateAI({
        action: 'cover-letter-regen',
        jobTitle: cl.jobTitle,
        companyName: cl.companyName,
        tone: cl.tone,
        locale,
        variant: Date.now(), // unique variant per call
        gender: cl.gender || '',
        personalName: fullName || currentCv?.personal?.fullName || '',
        personalEmail: currentCv?.personal?.email || '',
        personalPhone: currentCv?.personal?.phone || '',
        proToken: getProToken(),
        freeUserId: !isPro ? getAppUserId() : undefined,
      });
      setCl(prev => ({ ...prev, content, updatedAt: new Date().toISOString() }));
      if (!isPro) {
        incrementClRegen();
      } else {
        recordProAiSuccess();
      }
      toast.success(t.coverLetter.genSuccess);
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 403) {
        setPaywallReason('regenerate');
        setProModal(true);
      } else {
        if (process.env.NODE_ENV !== 'production') console.error('[Cover Letter] Regenerate error:', err);
        toast.error('AI service is temporarily unavailable. Please try again later.');
      }
    } finally {
      setIsRegenerating(false);
    }
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
                    onChange={e => setCl(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background p-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[400px] resize-y font-mono"
                  />
                ) : (
                  <div id="cl-preview" className="min-h-[400px] whitespace-pre-line rounded-lg bg-white p-6 text-sm text-gray-800 shadow-inner border border-gray-100 relative">
                    {isGenerating ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/80">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">{t.coverLetter.generating}</p>
                      </div>
                    ) : null}
                    {cl.content || <span className="text-gray-400 italic">{t.coverLetter.placeholder}</span>}
                  </div>
                )}

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

                {cl.content && (
                  <>
                    <div className="mt-4 flex gap-2 flex-wrap items-center">
                      {/* Download dropdown */}
                      <div className="relative" ref={downloadMenuRef}>
                        <button
                          onClick={() => setShowDownloadMenu(v => !v)}
                          className={btnPrimary + ' flex items-center gap-1'}
                          disabled={isPdfExporting || isWordExporting}
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
                              disabled={isPdfExporting}
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
                      <button onClick={() => { exportToClipboard('cl-preview'); toast.success(t.cv.copied); }} className={btnSecondary}>
                        <Copy className="h-4 w-4" />{t.cv.copy}
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">{t.cv.downloadNote}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground italic">
                      {t.coverLetter.aiDisclaimer}
                    </p>
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
