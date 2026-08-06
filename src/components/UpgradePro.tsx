'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Check, X, Crown, Shield, ArrowRight, Lock } from 'lucide-react';

import { useI18n } from '@/lib/i18n/context';
import { TranslationKeys } from '@/lib/i18n/translations';
import { useIAP } from '@/lib/iap';
import { useApp } from '@/lib/store';
import { toast } from 'sonner';

// --- Shared data ------------------------------------------------------------------

const PRO_BENEFITS = (t: TranslationKeys) => t.pricing.pro.features;

const COMPARISON_ROWS = (t: TranslationKeys) => [
  { name: t.pricing.tableRowCV,             free: t.pricing.oneCount,          pro: t.pricing.unlimited },
  { name: t.pricing.tableRowCoverLetter,   free: t.pricing.coverLetterFreeValue, pro: t.pricing.coverLetterProValue },
  { name: t.pricing.tableRowTemplates,                free: t.pricing.threeStandard, pro: t.pricing.proTemplatesCount },
  { name: t.pricing.tableRowAI,    free: true,         pro: true },
  { name: t.pricing.tableRowRewrite,         free: false,        pro: true },
  { name: t.pricing.tableRowAnalyzer, free: false,        pro: true },
  { name: t.pricing.tableRowLanguages,            free: true,         pro: true },
  { name: t.pricing.tableRowSupport,         free: false,        pro: true },
];


function localizedIapFailure(
  t: TranslationKeys,
  result: { errorCode?: string; message?: string },
): string {
  if (result.errorCode === 'purchase_system_unavailable') {
    return t.common.purchaseSystemUnavailable;
  }
  return result.message || t.common.error;
}

// --- Shared upgrade button ---------------------------------------------------------

interface UpgradeButtonProps {
  label: string;
  className?: string;
  onClose?: () => void;
}

function UpgradeButton({ label, className, onClose }: UpgradeButtonProps) {
  const { t } = useI18n();
  const { purchase, purchasing, isNativeApp, productPrice } = useIAP();
  const { setIsPro } = useApp();
  const [localLoading, setLocalLoading] = useState(false);

  const handleClick = async () => {
    if (!isNativeApp) return;
    setLocalLoading(true);
    try {
      const result = await purchase();
      if (result.success && result.isPro) {
        setIsPro(true, result.token, { source: 'purchase', entitlementResult: 'active', tokenSyncLastResult: 'success' });
        toast.success(t.pricing.proActive);
        onClose?.();
      } else if (result.success && !result.isPro) {
        toast.error('Server verification failed. If charged, contact support to restore your purchase.');
      } else if (!result.success) {
        if (result.cancelled) {
          // Cancellation: silent, modal stays open
        } else {
          toast.error(localizedIapFailure(t, result));
        }
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const isBusy = localLoading || purchasing;

  const displayLabel = isNativeApp && productPrice
    ? label.replace(/—\s*\$[\d.,]+/, '— ' + productPrice)
    : label;

  if (!isNativeApp) {
    return (
      <Link
        href="/pricing"
        onClick={onClose}
        className={className}
      >
        {label}
        <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isBusy}
      className={className}
    >
      {isBusy ? '...' : displayLabel}
      {!isBusy && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}

// --- Full upgrade section (used on pricing page) -----------------------------------

export function UpgradeProSection() {
  const { t } = useI18n();
  const benefits = PRO_BENEFITS(t);
  const rows = COMPARISON_ROWS(t);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-foreground/20 bg-card p-8 sm:p-10 shadow-sm"
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">{t.pricing.pro.badge}</p>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-5xl font-bold text-foreground">{t.pricing.pro.price}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-1">{t.pricing.pro.desc}</p>
          <p className="text-xs text-muted-foreground/60 italic mb-8">{t.pricing.pro.noSubscription}</p>

          <ul className="space-y-3 mb-8">
            {benefits.map((b: string, i: number) => (
              <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                {b}
              </li>
            ))}
          </ul>

          <UpgradeButton
            label={t.pricing.pro.cta}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-7 text-sm font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
          />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            {t.pricing.pro.footer}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.pricing.tableHeaderFeature}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.pricing.tableHeaderFree}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-primary">{t.pricing.tableHeaderPro}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3.5 text-sm font-medium">{row.name}</td>
                  <td className="px-4 py-3.5 text-center">
                    {typeof row.free === 'boolean'
                      ? row.free
                        ? <Check className="mx-auto h-4 w-4 text-foreground/40" />
                        : <X className="mx-auto h-4 w-4 text-foreground/15" />
                      : <span className="text-sm text-muted-foreground">{row.free}</span>
                    }
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {typeof row.pro === 'boolean'
                      ? row.pro
                        ? <Check className="mx-auto h-4 w-4 text-primary" />
                        : <X className="mx-auto h-4 w-4 text-foreground/15" />
                      : <span className="text-sm font-semibold text-primary">{row.pro}</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}

// --- UpgradeProModal (CV builder / dashboard) -------------------------------------

interface UpgradeProModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpgradeProModal({ open, onClose }: UpgradeProModalProps) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' as const }}
              className="relative w-full max-w-sm my-auto overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-primary" />
              <div className="p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{t.dashboard.upgrade}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {t.cv.aiBullets} {t.cv.proHint}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-muted/30 px-4 py-3 mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t.pricing.pro.badge}</p>
                  <span className="text-3xl font-bold text-foreground">{t.pricing.pro.price}</span>
                  <p className="text-xs text-muted-foreground mt-1">{t.pricing.pro.noSubscription}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <UpgradeButton
                    label={t.pricing.pro.cta + ' — ' + t.pricing.pro.price}
                    onClose={onClose}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
                  />
                  <button
                    onClick={onClose}
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {t.common.cancel}
                  </button>
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  {t.pricing.pro.footer}
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Job Analyzer PRO-only modal ---------------------------------------------------

interface JobAnalyzerProModalProps {
  open: boolean;
  onClose: () => void;
}

export function JobAnalyzerProModal({ open, onClose }: JobAnalyzerProModalProps) {
  return (
    <UpgradeProModal open={open} onClose={onClose} />
  );
}

// --- Free Limit Modal (used by CV builder and Cover Letter) --------------------

interface FreeLimitModalProps {
  open: boolean;
  onClose: () => void;
  type?: 'cv' | 'cl' | 'coverletter';
}

export function FreeLimitModal({ open, onClose, type: _type }: FreeLimitModalProps) {
  const { t } = useI18n();
  const { isNativeApp, purchase, purchasing } = useIAP();
  const { setIsPro } = useApp();
  const [localLoading, setLocalLoading] = useState(false);

  const handlePurchase = useCallback(async () => {
    if (!isNativeApp) return;
    setLocalLoading(true);
    try {
      const result = await purchase();
      if (result.success && result.isPro) {
        setIsPro(true, result.token, { source: 'purchase', entitlementResult: 'active', tokenSyncLastResult: 'success' });
        toast.success(t.pricing.proActive);
        onClose();
      } else if (result.success && !result.isPro) {
        toast.error('Server verification failed. If charged, contact support to restore your purchase.');
      } else if (!result.success) {
        if (!result.cancelled) {
          toast.error(localizedIapFailure(t, result));
        }
      }
      // Cancellation: silent, modal stays open
    } finally {
      setLocalLoading(false);
    }
  }, [isNativeApp, purchase, setIsPro, t, onClose]);

  const isBusy = localLoading || purchasing;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="fl-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              key="fl-panel"
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' as const }}
              className="relative w-full max-w-sm my-auto overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-primary" />
              <div className="p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{t.dashboard.upgrade}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {t.common.proUpgradeUnlimited}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-muted/30 px-4 py-3 mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t.pricing.pro.badge}</p>
                  <span className="text-3xl font-bold text-foreground">{t.pricing.pro.price}</span>
                  <p className="text-xs text-muted-foreground mt-1">{t.pricing.pro.noSubscription}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handlePurchase}
                    disabled={isBusy}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
                  >
                    {isBusy ? '...' : (t.pricing.pro.cta + ' — ' + t.pricing.pro.price)}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {t.common.cancel}
                  </button>
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  {t.pricing.pro.footer}
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Cover Letter Pro Modal ----------------------------------------------------

interface CoverLetterProModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export function CoverLetterProModal({ open, onClose, reason }: CoverLetterProModalProps) {
  const { t } = useI18n();
  const { purchase, purchasing, isNativeApp } = useIAP();
  const { setIsPro } = useApp();
  const [localLoading, setLocalLoading] = useState(false);

  const handlePurchase = useCallback(async () => {
    if (!isNativeApp) return;
    setLocalLoading(true);
    try {
      const result = await purchase();
      if (result.success && result.isPro) {
        setIsPro(true, result.token, { source: 'purchase', entitlementResult: 'active', tokenSyncLastResult: 'success' });
        toast.success(t.pricing.proActive);
        onClose();
      } else if (result.success && !result.isPro) {
        toast.error('Server verification failed. If charged, contact support to restore your purchase.');
      } else if (!result.success) {
        if (!result.cancelled) {
          toast.error(localizedIapFailure(t, result));
        }
      }
      // Cancellation: silent, modal stays open
    } finally {
      setLocalLoading(false);
    }
  }, [isNativeApp, purchase, setIsPro, t, onClose]);

  const isBusy = localLoading || purchasing;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="cl-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              key="cl-panel"
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' as const }}
              className="relative w-full max-w-sm my-auto overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="h-1 w-full bg-primary" />
              <div className="p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{t.dashboard.upgrade}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {reason || 'Upgrade to Pro for unlimited cover letters.'}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-foreground/10 bg-muted/30 px-4 py-3 mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{t.pricing.pro.badge}</p>
                  <span className="text-3xl font-bold text-foreground">{t.pricing.pro.price}</span>
                  <p className="text-xs text-muted-foreground mt-1">{t.pricing.pro.noSubscription}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handlePurchase}
                    disabled={isBusy}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
                  >
                    {isBusy ? '...' : (t.pricing.pro.cta + ' — ' + t.pricing.pro.price)}
                  </button>
                  <button
                    onClick={onClose}
                    className="flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                  >
                    {t.common.cancel}
                  </button>
                </div>
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  {t.pricing.pro.footer}
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Upgrade Builder Banner (CV builder) ---------------------------------------

export function UpgradeBuilderBanner() {
  const { t } = useI18n();
  const { purchase, purchasing, isNativeApp } = useIAP();
  const { setIsPro } = useApp();
  const [localLoading, setLocalLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (!isNativeApp) return;
    setLocalLoading(true);
    try {
      const result = await purchase();
      if (result.success && result.isPro) {
        setIsPro(true, result.token, { source: 'purchase', entitlementResult: 'active', tokenSyncLastResult: 'success' });
        toast.success(t.pricing.proActive);
      } else if (result.success && !result.isPro) {
        toast.error('Server verification failed. If charged, contact support to restore your purchase.');
      } else if (!result.success) {
        if (!result.cancelled) {
          toast.error(localizedIapFailure(t, result));
        }
      }
    } finally {
      setLocalLoading(false);
    }
  }, [isNativeApp, purchase, setIsPro, t]);

  const isBusy = localLoading || purchasing;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">{t.dashboard.upgrade}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t.pricing.pro.desc}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">{t.pricing.pro.price}</span>
            <span className="text-xs text-muted-foreground">{t.pricing.pro.noSubscription}</span>
          </div>
          <button
            onClick={handleClick}
            disabled={isBusy}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-4 text-xs font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
          >
            {isBusy ? '...' : (t.pricing.pro.cta + ' — ' + t.pricing.pro.price)}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- AI Improvements Pro Modal --------------------------------------------------

interface AiImprovementsProModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiImprovementsProModal({ open, onClose }: AiImprovementsProModalProps) {
  return (
    <UpgradeProModal open={open} onClose={onClose} />
  );
}

// --- Summary AI Pro Modal -------------------------------------------------------

interface SummaryAiProModalProps {
  open: boolean;
  onClose: () => void;
}

export function SummaryAiProModal({ open, onClose }: SummaryAiProModalProps) {
  return (
    <UpgradeProModal open={open} onClose={onClose} />
  );
}

// --- Pro Template Modal ---------------------------------------------------------

interface ProTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProTemplateModal({ open, onClose }: ProTemplateModalProps) {
  return (
    <UpgradeProModal open={open} onClose={onClose} />
  );
}

// --- AI Recommend Pro Modal ------------------------------------------------------

interface AiRecommendProModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiRecommendProModal({ open, onClose }: AiRecommendProModalProps) {
  return (
    <UpgradeProModal open={open} onClose={onClose} />
  );
}
