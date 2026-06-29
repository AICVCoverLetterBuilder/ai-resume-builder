'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, X, Shield, ArrowRight, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useState } from 'react';
import { useApp } from '@/lib/store';
import { useIAP } from '@/lib/iap';
import { toast } from 'sonner';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

export default function PricingPage() {
  const { t } = useI18n();
  const { isPro, setIsPro } = useApp();
  const { purchase, restore, purchasing, isNativeApp } = useIAP();
  const [restoring, setRestoring] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  // ── Purchase handler (native IAP / web fallback) ──────────────────────────
  const [localPurchasing, setLocalPurchasing] = useState(false);

  const handleUpgrade = async () => {
    setLocalPurchasing(true);
    try {
      const result = await purchase();
      if (result.success && result.isPro) {
        if (result.token) {
          setIsPro(true, result.token, {
            source: 'purchase',
            entitlementResult: 'active',
            tokenSyncLastResult: 'success',
          });
          toast.success(t.pricing.proActive);
        } else {
          setIsPro(false, null, {
            source: 'purchase',
            entitlementResult: 'active',
            tokenSyncLastResult: 'failed',
            tokenSyncLastError: 'Signed Pro authorization token was not returned.',
          });
          toast.error(t.common.proAuthorizationUnavailable);
        }
      } else if (result.success && !result.isPro) {
        toast.error('Server verification failed. If charged, contact support to restore your purchase.');
      } else if (!result.success) {
        if (result.entitlementActive) {
          setIsPro(false, null, {
            source: 'purchase',
            entitlementResult: 'active',
            tokenSyncLastResult: 'failed',
            tokenSyncLastError: result.message,
          });
        }
        if (!result.cancelled) {
          toast.error(result.message);
        }
      }
    } finally {
      setLocalPurchasing(false);
    }
  };

  // ── Restore handler ───────────────────────────────────────────────────────
  const handleRestorePurchase = async () => {
    setRestoring(true);
    try {
      const result = await restore();
      if (result.success && result.isPro) {
        if (result.token) {
          setIsPro(true, result.token, {
            source: 'restore',
            entitlementResult: 'active',
            tokenSyncLastResult: 'success',
          });
          toast.success(t.pricing.proActive);
        } else {
          setIsPro(false, null, {
            source: 'restore',
            entitlementResult: 'active',
            tokenSyncLastResult: 'failed',
            tokenSyncLastError: 'Signed Pro authorization token was not returned.',
          });
          toast.error(t.common.proAuthorizationUnavailable);
        }
      } else if (result.success && !result.isPro) {
        setIsPro(false, null, {
          source: 'restore',
          entitlementResult: 'inactive',
          tokenSyncLastResult: 'not-run',
        });
        toast.error(
          'No previous purchase found. If you believe this is an error, contact help.cvappai@gmail.com',
        );
      } else if (!result.success) {
        setIsPro(false, null, {
          source: 'restore',
          entitlementResult: result.entitlementActive ? 'active' : 'failed',
          tokenSyncLastResult: result.entitlementActive ? 'failed' : 'not-run',
          tokenSyncLastError: result.message,
        });
        toast.error(result.message);
      }
    } finally {
      setRestoring(false);
    }
  };

  const comparisonRows = [
    { name: t.pricing.tableRowCV,            free: t.pricing.oneCount,        pro: t.pricing.unlimited },
    { name: t.pricing.tableRowCoverLetter,  free: t.pricing.coverLetterFreeValue, pro: t.pricing.coverLetterProValue },
    { name: t.pricing.tableRowTemplates,     free: t.pricing.threeStandard, pro: t.pricing.proTemplatesCount },
    { name: t.pricing.tableRowAI,            free: true,       pro: true },
    { name: t.pricing.tableRowRewrite,       free: false,      pro: true },
    { name: t.pricing.tableRowAnalyzer,      free: false,      pro: true },
    { name: t.pricing.tableRowLanguages,     free: true,       pro: true },
    { name: t.pricing.tableRowSupport,       free: false,      pro: true },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 space-y-20"
        >

          {/* ── Page header ── */}
          <motion.div variants={fadeUp} className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t.pricing.title}</h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              {t.pricing.subtitle}
            </p>
          </motion.div>

          {/* ── Pricing cards ── */}
          <motion.div variants={fadeUp} className="grid gap-5 sm:grid-cols-2">

            {/* Free */}
            <div className="flex flex-col rounded-xl border border-border bg-card p-8 transition-colors hover:border-border/80">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">{t.pricing.free.name}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-bold text-foreground">{t.pricing.free.price}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-8">{t.pricing.free.desc}</p>
              <ul className="space-y-3 mb-10 flex-1">
                {t.pricing.free.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-foreground/75">
                    <Check className="h-4 w-4 flex-shrink-0 text-foreground/30" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/cv-builder"
                className="flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              >
                {t.pricing.free.cta}
              </Link>
            </div>

            {/* Pro */}
            <div className="flex flex-col relative rounded-xl border border-primary/20 bg-card p-8 shadow-md shadow-black/5 transition-all hover:border-primary/40">
              {/* Popular Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary rounded-full shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                  {t.pricing.popularBadge}
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-6">{t.pricing.pro.badge}</p>

              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-5xl font-bold text-foreground">{t.pricing.pro.price}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t.pricing.pro.desc}</p>
              <p className="text-xs text-muted-foreground/60 italic mb-8">{t.pricing.pro.noSubscription}</p>

              <ul className="space-y-3 mb-10 flex-1">
                {t.pricing.pro.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Pro CTA — native IAP on device, link on web */}
              {isPro ? (
                <div className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
                  ✓ {t.pricing.proActive}
                </div>
              ) : isNativeApp ? (
                <button
                  onClick={handleUpgrade}
                  disabled={localPurchasing || purchasing}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 shadow-sm disabled:opacity-50"
                >
                  {(localPurchasing || purchasing) ? '...' : t.pricing.pro.cta}
                  {!(localPurchasing || purchasing) && <ArrowRight className="h-4 w-4" />}
                </button>
              ) : (
                /* Web: purchase coming soon — show modal */
                <button
                  onClick={() => setShowComingSoon(true)}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 shadow-sm"
                >
                  {t.pricing.pro.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                {t.pricing.pro.footer}
              </p>
            </div>
          </motion.div>

          {/* ── Restore Purchase ── */}
          <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 px-6 py-5">
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground mb-1">{t.pricing.restoreTitle}</p>
              <p className="text-xs text-muted-foreground">{t.pricing.restoreDesc}</p>
            </div>
            <button
              onClick={handleRestorePurchase}
              disabled={restoring || isPro}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className={`h-4 w-4 ${restoring ? 'animate-spin' : ''}`} />
              {isPro ? t.pricing.proActive : restoring ? t.pricing.restoringText : t.pricing.restoreButton}
            </button>
            <p className="text-xs text-muted-foreground">
              {t.pricing.needHelp} <a href="mailto:help.cvappai@gmail.com" className="text-primary hover:underline">help.cvappai@gmail.com</a>
            </p>
          </motion.div>

          {/* ── Feature comparison table ── */}
          <motion.div variants={fadeUp}>
            <h2 className="text-center text-2xl font-bold tracking-tight mb-8">{t.pricing.tableTitle}</h2>

            {/* Unified card-style comparison — works on all screen sizes */}
            <div className="rounded-xl border border-border">
              {/* Header row */}
              <div className="flex items-center border-b border-border bg-muted/30 px-4 sm:px-5 py-3.5 gap-2">
                <div className="min-w-0 flex-[2] text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.pricing.tableHeaderFeature}
                </div>
                <div className="min-w-0 w-[90px] shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.pricing.tableHeaderFree}
                </div>
                <div className="min-w-0 w-[90px] shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-primary">
                  {t.pricing.tableHeaderPro}
                </div>
              </div>

              {/* Data rows */}
              {comparisonRows.map((row, i) => (
                <div key={i} className="flex items-start border-b border-border last:border-0 hover:bg-muted/10 transition-colors px-4 sm:px-5 py-3.5 gap-2">
                  <div className="min-w-0 flex-[2]">
                    <span className="text-sm text-foreground font-medium break-words">{row.name}</span>
                  </div>
                  <div className="min-w-0 w-[90px] shrink-0 text-center text-sm leading-tight">
                    {typeof row.free === 'boolean' ? (
                      row.free
                        ? <Check className="mx-auto h-4 w-4 text-foreground/40 flex-shrink-0" />
                        : <X className="mx-auto h-4 w-4 text-foreground/15 flex-shrink-0" />
                    ) : (
                      <span className="text-muted-foreground break-words">{row.free}</span>
                    )}
                  </div>
                  <div className="min-w-0 w-[90px] shrink-0 text-center text-sm leading-tight">
                    {typeof row.pro === 'boolean' ? (
                      row.pro
                        ? <Check className="mx-auto h-4 w-4 text-primary flex-shrink-0" />
                        : <X className="mx-auto h-4 w-4 text-foreground/15 flex-shrink-0" />
                    ) : (
                      <span className="font-semibold text-primary break-words">{row.pro}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── FAQ Section ── */}
          <motion.div variants={fadeUp}>
            <FAQSection />
          </motion.div>

          {/* ── Bottom CTA ── */}
          <motion.div variants={fadeUp} className="text-center space-y-4 bg-muted/20 rounded-2xl p-10 border border-border">
            <p className="text-sm text-muted-foreground">
              {t.pricing.footerText}
            </p>
            <Link
              href="/cv-builder"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-foreground px-8 text-sm font-semibold text-background transition-all hover:opacity-85 shadow-lg"
            >
              {t.pricing.getStarted}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="flex items-center justify-center gap-6 pt-4">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{t.pricing.bestValueBadge}</span>
            </div>
          </motion.div>

          {/* ── Fair-use notice ── */}
          <motion.div variants={fadeUp} className="text-center">
            <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-xl mx-auto">
              {t.pricing.fairUse}
            </p>
          </motion.div>

        </motion.div>

        {/* ── Coming Soon modal ── */}
        {showComingSoon && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowComingSoon(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' as const }}
                className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowComingSoon(false)}
                  className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight text-foreground">
                      {t.pricing.pro.cta}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      Purchases are coming soon.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowComingSoon(false)}
                  className="mt-2 flex h-10 w-full items-center justify-center rounded-lg border border-border text-sm font-medium transition-colors hover:bg-accent"
                >
                  {t.common?.cancel || 'Close'}
                </button>
              </motion.div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

function FAQSection() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-8">
      <h2 className="text-center text-2xl font-bold tracking-tight">{t.faq.title}</h2>
      <div className="space-y-2 max-w-2xl mx-auto w-full">
        {t.faq.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border bg-card overflow-hidden transition-colors hover:border-border/80">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-start text-sm font-medium transition-colors hover:bg-accent/40"
            >
              <span>{item.q}</span>
              {openIndex === i
                ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              }
            </button>
            {openIndex === i && (
              <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground leading-relaxed bg-muted/5">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
