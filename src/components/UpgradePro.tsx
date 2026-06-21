'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Check, X, Crown, Zap, Shield, ArrowRight, Lock, Sparkles } from 'lucide-react';
import { CVQualityComparison } from '@/components/CVQualityComparison';
import { useI18n } from '@/lib/i18n/context';
import { TranslationKeys } from '@/lib/i18n/translations';
import { useIAP } from '@/lib/iap';
import { useApp } from '@/lib/store';
import { toast } from 'sonner';

// ─── Shared data ─────────────────────────────────────────────────────────────

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

// ─── Shared upgrade button ────────────────────────────────────────────────────
// On native: triggers in-app purchase. On web: navigates to /pricing.

interface UpgradeButtonProps {
  label: string;
  className?: string;
  onClose?: () => void;
}

function UpgradeButton({ label, className, onClose }: UpgradeButtonProps) {
  const { t } = useI18n();
  const { purchase, purchasing, isNativeApp, productPrice } = useIAP();
  const { setIsPro } = useApp();

  const handleClick = async () => {
    if (!isNativeApp) return; // web: Link handles navigation
    const result = await purchase();
    onClose?.();
    if (result.success && result.isPro) {
      setIsPro(true);
      toast.success(t.pricing.proActive);
    } else if (!result.success) {
      if (!result.cancelled) {
        toast.error(result.message);
      }
      // User cancelled — silent
    }
  };

  // On native, replace hardcoded price in label with RevenueCat's localized price
  const displayLabel = isNativeApp && productPrice
    ? label.replace(/—\s*\$[\d.,]+/, `— ${productPrice}`)
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
      disabled={purchasing}
      className={className}
    >
      {purchasing ? '...' : displayLabel}
      {!purchasing && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}

// ─── Full upgrade section (used on pricing page) ──────────────────────────────

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
        {/* Left: benefits + CTA */}
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

        {/* Right: comparison table */}
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
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-xs text-foreground">{row.name}</td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    {typeof row.free === 'boolean' ? (
                      row.free
                        ? <Check className="mx-auto h-3.5 w-3.5 text-foreground/40" />
                        : <X className="mx-auto h-3.5 w-3.5 text-foreground/15" />
                    ) : (
                      <span className="text-muted-foreground">{row.free}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center text-xs">
                    {typeof row.pro === 'boolean' ? (
                      row.pro
                        ? <Check className="mx-auto h-3.5 w-3.5 text-primary" />
                        : <X className="mx-auto h-3.5 w-3.5 text-foreground/15" />
                    ) : (
                      <span className="font-semibold text-primary">{row.pro}</span>
                    )}
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

// ─── Subtle builder banner ────────────────────────────────────────────────────

interface UpgradeBuilderBannerProps {
  onUpgradeClick?: () => void;
}

export function UpgradeBuilderBanner({ onUpgradeClick }: UpgradeBuilderBannerProps) {
  const { t } = useI18n();
  const { purchase, purchasing, isNativeApp, productPrice } = useIAP();
  const { setIsPro } = useApp();

  const dynamicPrice = isNativeApp && productPrice ? productPrice : t.pricing.pro.price;

  const handleNativeUpgrade = async () => {
    onUpgradeClick?.();
    const result = await purchase();
    if (result.success && result.isPro) {
      setIsPro(true);
      toast.success(t.pricing.proActive);
    } else if (!result.success && !result.cancelled) {
      toast.error(result.message);
    }
  };

  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2.5">
        <Zap className="h-4 w-4 flex-shrink-0 text-primary" />
        <div>
          <span className="text-sm font-medium">{t.pricing.tableHeaderFree} {t.dashboard.plan.toLowerCase()}:</span>
          <span className="ml-1 text-sm text-muted-foreground">{t.dashboard.upgradeBanner}</span>
        </div>
      </div>
      {isNativeApp ? (
        <button
          onClick={handleNativeUpgrade}
          disabled={purchasing}
          className="whitespace-nowrap rounded-lg border border-foreground/20 bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
        >
          {purchasing ? '...' : `${t.dashboard.upgrade} — ${dynamicPrice}`}
        </button>
      ) : (
        <Link
          href="/pricing"
          onClick={onUpgradeClick}
          className="whitespace-nowrap rounded-lg border border-foreground/20 bg-foreground px-4 py-1.5 text-xs font-semibold text-background transition-all hover:opacity-85"
        >
          {t.dashboard.upgrade} — {dynamicPrice}
        </Link>
      )}
    </div>
  );
}

// ─── Free-limit-reached modal ─────────────────────────────────────────────────

interface FreeLimitModalProps {
  open: boolean;
  type: 'cv' | 'cl';
  onClose: () => void;
}

export function FreeLimitModal({ open, type, onClose }: FreeLimitModalProps) {
  const { t } = useI18n();
  const benefits = PRO_BENEFITS(t);
  const usageLabel = type === 'cv' ? 'CV' : 'Cover Letter';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' as const }}
              className="relative w-full max-w-md my-auto overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Top stripe */}
              <div className="h-1 w-full bg-foreground" />

              <div className="p-6 sm:p-8">
                {/* Heading */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/8 border border-border">
                    <Crown className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">
                      {usageLabel} · {t.dashboard.plan}: {t.pricing.tableHeaderFree}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {t.templates.unlockPro}
                    </p>
                  </div>
                </div>

                {/* Before / After comparison — compact */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 mb-6">
                  <CVQualityComparison showHeading={false} compact />
                </div>

                {/* Price callout */}
                <div className="rounded-xl border border-foreground/15 bg-card px-5 py-4 mb-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.pricing.pro.badge}</p>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold text-foreground">{t.pricing.pro.price}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{t.pricing.pro.noSubscription}</p>
                  <ul className="space-y-2">
                    {benefits.slice(0, 4).map((b: string, i: number) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                        <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <UpgradeButton
                    label={`${t.pricing.pro.cta} — ${t.pricing.pro.price}`}
                    onClose={onClose}
                    className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
                  />
                  <button
                    onClick={onClose}
                    className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium transition-colors hover:bg-accent"
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

// ─── Cover Letter AI PRO-only modal ───────────────────────────────────────────

interface CoverLetterProModalProps {
  open: boolean;
  onClose: () => void;
  reason?: 'generate' | 'regenerate';
}

export function CoverLetterProModal({ open, onClose, reason = 'generate' }: CoverLetterProModalProps) {
  const { t } = useI18n();
  const actionLabel = reason === 'regenerate' ? t.coverLetter.regenerate : t.coverLetter.generate;
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
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{t.dashboard.upgrade} · {actionLabel}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {t.coverLetter.paywallMessage}
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
                    label={`${t.pricing.pro.cta} — ${t.pricing.pro.price}`}
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

// ─── Pro Template PRO-only modal ─────────────────────────────────────────────

interface ProTemplateModalProps {
  open: boolean;
  onClose: () => void;
}

export function ProTemplateModal({ open, onClose }: ProTemplateModalProps) {
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
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{t.dashboard.upgrade}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {t.cv.unlockWithPro}
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
                    label={`${t.pricing.pro.cta} — ${t.pricing.pro.price}`}
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

// ─── AI Recommend PRO-only modal (shown after 1 free use) ─────────────────────

interface AiRecommendProModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiRecommendProModal({ open, onClose }: AiRecommendProModalProps) {
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
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{t.dashboard.upgrade}</h2>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {t.cv.aiRecommend} {t.cv.proHint}
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
                    label={`${t.pricing.pro.cta} — ${t.pricing.pro.price}`}
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

// ─── Professional Summary PRO-only modal ──────────────────────────────────────

interface SummaryAiProModalProps {
  open: boolean;
  onClose: () => void;
}

export function SummaryAiProModal({ open, onClose }: SummaryAiProModalProps) {
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
                      {t.cv.aiSummaryIntro} {t.cv.proHint}
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
                    label={`${t.pricing.pro.cta} — ${t.pricing.pro.price}`}
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

// ─── AI Improvements PRO-only modal ───────────────────────────────────────────

interface AiImprovementsProModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiImprovementsProModal({ open, onClose }: AiImprovementsProModalProps) {
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
                    label={`${t.pricing.pro.cta} — ${t.pricing.pro.price}`}
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

// ─── Job Analyzer PRO-only modal ──────────────────────────────────────────────

interface JobAnalyzerProModalProps {
  open: boolean;
  onClose: () => void;
}

export function JobAnalyzerProModal({ open, onClose }: JobAnalyzerProModalProps) {
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
                      {t.cv.analyzeJobProOnly}
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
                    label={`${t.pricing.pro.cta} — ${t.pricing.pro.price}`}
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
