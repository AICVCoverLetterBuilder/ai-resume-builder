'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Lock,
  Sparkles,
  ArrowRight,
  Shield,
  TrendingUp,
  Search,
  Lightbulb,
  Crown,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

// ─── Gold accent for premium feel ────────────────────────────────────────────
const GOLD = '#d4aa50';
const GOLD_DIM = 'rgba(212,170,80,0.18)';
const GOLD_MID = 'rgba(212,170,80,0.35)';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface JobAnalysisResult {
  missingSkills: string[];
  keywords: string[];
  suggestions: string[];
}

interface JobAnalysisResultScreenProps {
  result: JobAnalysisResult;
  isPro: boolean;
  /** Call when user closes / dismisses this screen */
  onClose?: () => void;
}

// ─── Score helper ─────────────────────────────────────────────────────────────
function computeScore(result: JobAnalysisResult): number {
  const keywordScore = Math.min(result.keywords.length * 8, 55);
  const missingPenalty = result.missingSkills.length * 6;
  const base = 45 + keywordScore - missingPenalty;
  return Math.max(28, Math.min(96, base));
}

function scoreLabel(score: number, t: ReturnType<typeof useI18n>['t']): string {
  if (score >= 70) return t.cv.jobAnalysis.matchGood;
  if (score >= 45) return t.cv.jobAnalysis.matchAverage;
  return t.cv.jobAnalysis.matchWeak;
}

function scoreColor(score: number): string {
  if (score >= 70) return GOLD;
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

// ─── Animated score counter ───────────────────────────────────────────────────
function ScoreCounter({ target, color }: { target: number; color: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setDisplayed(target);
        clearInterval(timer);
      } else {
        setDisplayed(start);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span style={{ color }} className="text-5xl sm:text-6xl font-black tabular-nums leading-none">
      {displayed}%
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function MatchBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1], delay: 0.4 }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
      />
    </div>
  );
}

// ─── Keyword pill ─────────────────────────────────────────────────────────────
function KeywordPill({ label, blurred }: { label: string; blurred?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
        blurred
          ? 'select-none border-border bg-muted/40 text-transparent blur-[4px]'
          : 'border-border bg-muted/60 text-foreground/90'
      }`}
    >
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function JobAnalysisResultScreen({
  result,
  isPro,
  onClose,
}: JobAnalysisResultScreenProps) {
  const { t } = useI18n();
  const ja = t.cv.jobAnalysis;
  const [visible, setVisible] = useState(false);

  const score = computeScore(result);
  const label = scoreLabel(score, t);
  const color = scoreColor(score);

  // Free: show first 5 keywords visible, rest blurred
  const FREE_VISIBLE = 5;
  const visibleKeywords = isPro ? result.keywords : result.keywords.slice(0, FREE_VISIBLE);
  const blurredKeywords = isPro
    ? []
    : ['TypeScript', 'Leadership', 'Agile', 'Communication', 'Problem-solving'].slice(
        0,
        Math.max(0, 8 - result.keywords.slice(0, FREE_VISIBLE).length),
      );

  const hasBlurred = !isPro && blurredKeywords.length > 0;

  // 3 fixed insights
  const insights = [
    { text: ja.insight1, ok: result.keywords.length > 0 },
    { text: ja.insight2, ok: result.missingSkills.length === 0 },
    { text: ja.insight3, ok: false },
  ];

  // Suggestions → show up to 3
  const improvements = [ja.improve1, ja.improve2, ja.improve3];

  useEffect(() => {
    // Small delay for "analysis feel"
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mt-4 w-full space-y-3"
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold leading-tight text-foreground">
                {ja.title}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{ja.subtitle}</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="flex-shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* ── Match Score ────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, duration: 0.35 }}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            style={{ borderColor: GOLD_MID }}
          >
            {/* Gold top stripe */}
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${GOLD}99, ${GOLD})` }} />

            <div className="p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {ja.matchScore}
                  </p>
                  <ScoreCounter target={score} color={color} />
                  <p className="mt-2 text-sm font-medium" style={{ color }}>
                    {label}
                  </p>
                </div>
                <div
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: GOLD_DIM, border: `1.5px solid ${GOLD_MID}` }}
                >
                  <TrendingUp className="h-6 w-6" style={{ color: GOLD }} />
                </div>
              </div>

              <div className="mt-4">
                <MatchBar score={score} color={color} />
              </div>
            </div>
          </motion.div>

          {/* ── Key Insights ───────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: GOLD }} />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {ja.keyInsights}
              </p>
            </div>
            <ul className="space-y-2.5">
              {insights.map((ins, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  {ins.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  )}
                  <span className="text-sm text-foreground/85 leading-snug">{ins.text}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* ── Keywords ───────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.35 }}
            className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" style={{ color: GOLD }} />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {ja.importantKeywords}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {visibleKeywords.map((kw, i) => (
                <KeywordPill key={i} label={kw} />
              ))}
              {blurredKeywords.map((kw, i) => (
                <KeywordPill key={`blur-${i}`} label={kw} blurred />
              ))}
            </div>

            {hasBlurred && (
              <div className="mt-3 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: GOLD }} />
                <p className="text-xs font-medium" style={{ color: GOLD }}>
                  {ja.unlockFull}
                </p>
              </div>
            )}
          </motion.div>

          {/* ── Suggested Improvements ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 flex-shrink-0" style={{ color: GOLD }} />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {ja.suggestedImprovements}
              </p>
            </div>
            <ul className="space-y-2">
              {improvements.map((imp, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: GOLD }}
                  />
                  <span className="text-sm text-foreground/80 leading-snug">{imp}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* ── Pro Upsell Card ────────────────────────────────────────── */}
          {!isPro && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.4 }}
              className="overflow-hidden rounded-xl shadow-sm"
              style={{
                background: 'linear-gradient(135deg, oklch(0.13 0.025 265) 0%, oklch(0.17 0.03 265) 100%)',
                border: `1.5px solid ${GOLD_MID}`,
              }}
            >
              {/* Gold top bar */}
              <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

              <div className="px-5 py-5">
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: GOLD_DIM, border: `1px solid ${GOLD_MID}` }}
                  >
                    <Crown className="h-4.5 w-4.5" style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight" style={{ color: '#f0ead8' }}>
                      {ja.proCardTitle}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(240,234,216,0.65)' }}>
                      {ja.proCardText}
                    </p>
                  </div>
                </div>

                <Link
                  href="/pricing"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}cc, ${GOLD})`,
                    color: '#080b12',
                  }}
                >
                  {ja.proCardCta} — {t.pricing.pro.price}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs" style={{ color: 'rgba(240,234,216,0.45)' }}>
                  <Shield className="h-3 w-3" />
                  {ja.proCardNote}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Loading state shown while "analyzing" ────────────────────────────────────
export function JobAnalysisLoadingState() {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-8 shadow-sm"
    >
      {/* Pulsing ring */}
      <div className="relative flex h-12 w-12 items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full"
          style={{ background: GOLD_DIM }}
        />
        <Search className="h-5 w-5 relative z-10" style={{ color: GOLD }} />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{t.cv.jobAnalysis.analyzing}</p>
        <div className="mt-2 flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
