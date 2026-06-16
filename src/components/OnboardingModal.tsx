'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Crown, Shield, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/context';
import { useIAP } from '@/lib/iap';
import { useApp } from '@/lib/store';
import { toast } from 'sonner';

const ONBOARDING_KEY = 'cvpro-onboarding-seen';

export function OnboardingModal() {
  const { t } = useI18n();
  const { purchase, purchasing, isNativeApp } = useIAP();
  const { setIsPro } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      // Small delay so app loads first
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setOpen(false);
  }, []);

  // Close on Escape key (triggered by Android back button handler)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, dismiss]);

  const handleUpgrade = async () => {
    if (!isNativeApp) return; // web: Link handles navigation
    dismiss();
    const result = await purchase();
    if (result.success && result.isPro) {
      setIsPro(true);
      toast.success(t.pricing.proActive);
    } else if (!result.success && !result.cancelled) {
      toast.error(result.message);
    }
  };

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
            onClick={dismiss}
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative w-full max-w-lg my-auto overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Top gradient bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

              {/* Close button */}
              <button
                onClick={dismiss}
                className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label={t.common.cancel}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="p-6 sm:p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground leading-tight">
                      {t.onboarding.title}
                    </h2>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  {t.onboarding.subtitle}
                </p>

                {/* Free vs Pro comparison */}
                <div className="grid gap-3 sm:grid-cols-2 mb-6">
                  {/* Free */}
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.onboarding.freeLabel}</p>
                    <ul className="space-y-2">
                      {t.onboarding.freeFeatures.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-foreground/40" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pro */}
                  <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 relative">
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {t.onboarding.proRecommendedBadge}
                      </span>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{t.onboarding.proLabel}</p>
                    <ul className="space-y-2">
                      {t.onboarding.proFeatures.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-foreground/80">
                          <Check className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-[10px] text-muted-foreground italic">{t.onboarding.oneTimePayment}</p>
                  </div>
                </div>

                {/* AI notice */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3 mb-6">
                  <p className="flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">
                    <Sparkles className="h-3 w-3 flex-shrink-0" />
                    {t.onboarding.aiFeatureTitle}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    {t.onboarding.aiFeatureDesc}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={dismiss}
                    className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {t.onboarding.startFree}
                  </button>
                  {isNativeApp ? (
                    <button
                      onClick={handleUpgrade}
                      disabled={purchasing}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 disabled:opacity-50"
                    >
                      <Crown className="h-4 w-4" />
                      {purchasing ? '...' : t.onboarding.upgradeToPro}
                      {!purchasing && <ArrowRight className="h-4 w-4" />}
                    </button>
                  ) : (
                    <Link
                      href="/pricing"
                      onClick={dismiss}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85"
                    >
                      <Crown className="h-4 w-4" />
                      {t.onboarding.upgradeToPro}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  {t.onboarding.secureCheckout}
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
