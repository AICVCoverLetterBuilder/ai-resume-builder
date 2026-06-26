'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, X, Shield, ArrowRight, ChevronDown, ChevronUp, RotateCcw, Copy, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useState } from 'react';
import { useApp } from '@/lib/store';
import { useIAP } from '@/lib/iap';
import {
  clearPurchaseTrace,
  getPurchaseTrace,
  runPurchaseTraceBridgeSelfTest,
  type PurchaseTraceBridgeSelfTestResult,
  type PurchaseTraceSnapshot,
} from '@/lib/purchase-trace';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };
const TRACE_READ_TIMEOUT_MS = 1_000;
const BRIDGE_SELF_TEST_TIMEOUT_MS = 2_000;

function isAndroidNativeApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    Capacitor.isNativePlatform() &&
    Capacitor.getPlatform() === 'android'
  );
}

function formatTraceTime(timestamp?: number): string {
  if (!timestamp) return 'Unknown time';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
}

function sanitizeTraceDetail(detail?: string): string {
  if (!detail) return '';
  return detail
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(api[_-]?key|app[_-]?user[_-]?id|purchase[_-]?token|token|email)\s*[:=]\s*[^,\s}]+/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{28,}\b/g, '[redacted]')
    .slice(0, 140);
}

function traceToText(trace: PurchaseTraceSnapshot | null): string {
  if (!trace) return 'PurchaseTrace unavailable';
  const lines = [`last phase: ${trace.lastPhase || 'None'}`];
  for (const event of trace.events) {
    const responseCode = typeof event.responseCode === 'number' ? ` responseCode=${event.responseCode}` : '';
    const detail = sanitizeTraceDetail(event.detail);
    lines.push(`${formatTraceTime(event.timestamp)} ${event.phase}${responseCode}${detail ? ` detail=${detail}` : ''}`);
  }
  return lines.join('\n');
}

export default function PricingPage() {
  const { t } = useI18n();
  const { isPro, setIsPro, proDiagnostics } = useApp();
  const { purchase, restore, purchasing, isNativeApp } = useIAP();
  const [restoring, setRestoring] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceSnapshot, setTraceSnapshot] = useState<PurchaseTraceSnapshot | null>(null);
  const [traceError, setTraceError] = useState('');
  const [bridgeSelfTestLoading, setBridgeSelfTestLoading] = useState(false);
  const [bridgeSelfTestResult, setBridgeSelfTestResult] = useState<PurchaseTraceBridgeSelfTestResult | null>(null);
  const showPurchaseDiagnostics = isAndroidNativeApp();

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

  const loadPurchaseTrace = async () => {
    setTraceLoading(true);
    setTraceError('');
    try {
      const trace = await getPurchaseTrace(TRACE_READ_TIMEOUT_MS);
      setTraceSnapshot(trace);
      if (!trace) setTraceError('Trace unavailable or timed out.');
    } catch {
      setTraceSnapshot(null);
      setTraceError('Trace read failed.');
    } finally {
      setTraceLoading(false);
    }
  };

  const openPurchaseDiagnostics = async () => {
    setTraceOpen(true);
    setBridgeSelfTestResult(null);
    await loadPurchaseTrace();
  };

  const runBridgeSelfTest = async () => {
    setBridgeSelfTestLoading(true);
    try {
      const result = await runPurchaseTraceBridgeSelfTest(BRIDGE_SELF_TEST_TIMEOUT_MS);
      setBridgeSelfTestResult(result);
      if (result.trace) setTraceSnapshot(result.trace);
    } catch (error) {
      setBridgeSelfTestResult({
        nativePlatform: false,
        platform: 'unknown',
        pluginAvailable: false,
        ping: 'failed',
        mark: 'failed',
        getTrace: 'failed',
        errorStage: 'ping',
        errorMessage: sanitizeTraceDetail(error instanceof Error ? error.message : String(error)) || 'Bridge self-test failed.',
      });
    } finally {
      setBridgeSelfTestLoading(false);
    }
  };

  const copyPurchaseTrace = async () => {
    try {
      await navigator.clipboard?.writeText(traceToText(traceSnapshot));
      toast.success('Purchase trace copied.');
    } catch {
      toast.error('Could not copy purchase trace.');
    }
  };

  const clearPurchaseDiagnostics = async () => {
    setTraceLoading(true);
    setTraceError('');
    try {
      await clearPurchaseTrace(TRACE_READ_TIMEOUT_MS);
      setTraceSnapshot({ lastPhase: '', lastAt: 0, events: [] });
    } catch {
      setTraceError('Trace clear failed.');
    } finally {
      setTraceLoading(false);
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
            {showPurchaseDiagnostics && (
              <button
                type="button"
                onClick={openPurchaseDiagnostics}
                className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Purchase diagnostics (test build)
              </button>
            )}
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
        {traceOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setTraceOpen(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' as const }}
                className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card p-5 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold leading-tight text-foreground">
                      Purchase diagnostics (test build)
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Read-only persisted PurchaseTrace snapshot.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTraceOpen(false)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="Close purchase diagnostics"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-3 rounded-lg border border-border bg-muted/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Bridge self-test</p>
                    <button
                      type="button"
                      onClick={runBridgeSelfTest}
                      disabled={bridgeSelfTestLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${bridgeSelfTestLoading ? 'animate-spin' : ''}`} />
                      Run bridge self-test
                    </button>
                  </div>
                  {bridgeSelfTestResult && (
                    <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Native platform: {String(bridgeSelfTestResult.nativePlatform)}</p>
                      <p>Platform: {bridgeSelfTestResult.platform}</p>
                      <p>Plugin available: {String(bridgeSelfTestResult.pluginAvailable)}</p>
                      <p>Ping: {bridgeSelfTestResult.ping}</p>
                      <p>Mark: {bridgeSelfTestResult.mark}</p>
                      <p>Get trace: {bridgeSelfTestResult.getTrace}</p>
                      {bridgeSelfTestResult.lastPhase && (
                        <p>Self-test last phase: {bridgeSelfTestResult.lastPhase}</p>
                      )}
                      {typeof bridgeSelfTestResult.eventCount === 'number' && (
                        <p>Self-test event count: {bridgeSelfTestResult.eventCount}</p>
                      )}
                      {bridgeSelfTestResult.errorStage && (
                        <p>Failed stage: {bridgeSelfTestResult.errorStage}</p>
                      )}
                      {bridgeSelfTestResult.errorMessage && (
                        <p className="break-words sm:col-span-2">Error: {bridgeSelfTestResult.errorMessage}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mb-3 rounded-lg border border-border bg-muted/10 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Pro token state</p>
                  <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>clientIsPro: {String(proDiagnostics.clientIsPro)}</p>
                    <p>storedTokenPresent: {String(proDiagnostics.storedTokenPresent)}</p>
                    <p>memoryTokenPresent: {String(proDiagnostics.memoryTokenPresent)}</p>
                    <p>tokenSyncLastResult: {proDiagnostics.tokenSyncLastResult}</p>
                    <p>startupEntitlementResult: {proDiagnostics.startupEntitlementResult}</p>
                    <p>restoreEntitlementResult: {proDiagnostics.restoreEntitlementResult}</p>
                    <p>aiGateStatus: {proDiagnostics.aiGateStatus}</p>
                    <p>aiGateTokenPresent: {String(proDiagnostics.aiGateTokenPresent)}</p>
                    <p>aiGateIsPro: {String(proDiagnostics.aiGateIsPro)}</p>
                    <p>aiGateBlockingReason: {proDiagnostics.aiGateBlockingReason}</p>
                    {proDiagnostics.tokenSyncLastError && (
                      <p className="break-words sm:col-span-2">
                        tokenSyncLastError: {sanitizeTraceDetail(proDiagnostics.tokenSyncLastError)}
                      </p>
                    )}
                  </div>
                </div>

                {traceError && (
                  <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {traceError}
                  </div>
                )}

                <div className="mb-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Last phase</p>
                  <p className="mt-1 break-words text-sm text-foreground">{traceSnapshot?.lastPhase || 'None'}</p>
                </div>

                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                  <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                    Events
                  </div>
                  {traceLoading ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading trace...</div>
                  ) : traceSnapshot?.events.length ? (
                    <ol className="divide-y divide-border">
                      {traceSnapshot.events.map((event, index) => (
                        <li key={`${event.timestamp}-${event.phase}-${index}`} className="space-y-1 px-3 py-3 text-sm">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium text-foreground">{event.phase}</span>
                            <span className="text-xs text-muted-foreground">{formatTraceTime(event.timestamp)}</span>
                            {typeof event.responseCode === 'number' && (
                              <span className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                                responseCode {event.responseCode}
                              </span>
                            )}
                          </div>
                          {sanitizeTraceDetail(event.detail) && (
                            <p className="break-words text-xs text-muted-foreground">
                              {sanitizeTraceDetail(event.detail)}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">No trace events found.</div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={loadPurchaseTrace}
                    disabled={traceLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <RotateCcw className={`h-3.5 w-3.5 ${traceLoading ? 'animate-spin' : ''}`} />
                    Refresh trace
                  </button>
                  <button
                    type="button"
                    onClick={copyPurchaseTrace}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy trace
                  </button>
                  <button
                    type="button"
                    onClick={clearPurchaseDiagnostics}
                    disabled={traceLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear trace
                  </button>
                  <button
                    type="button"
                    onClick={() => setTraceOpen(false)}
                    className="rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-85"
                  >
                    Close
                  </button>
                </div>
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
