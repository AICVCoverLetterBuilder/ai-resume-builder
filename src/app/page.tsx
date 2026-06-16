'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useI18n } from '@/lib/i18n/context';
import { TranslationKeys } from '@/lib/i18n/translations';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Globe, LayoutTemplate, Zap, Check, ChevronDown, ChevronUp, ArrowRight, Shield, MapPin, Mail, Phone, ClipboardList, Wand2, Download, Users, Lock, Tag } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { CVQualityComparison } from '@/components/CVQualityComparison';
import { TemplatePreview } from '@/components/TemplatePreview';
import { TemplateId } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
          <main className="flex-1">
            <HeroSection />
            <FeaturesSection />
            <TemplatesSection />
            <CVQualitySection />
            <HowItWorksSection />
            <WhoIsThisForSection />
            <PrivacyFirstSection />
            <SimplePricingSection />
            <PricingSection />
            <FAQSection />
            <CTASection />
          </main>
      <Footer />
    </div>
  );
}

/* ─── CV Preview Slides ─────────────────────────────────────────────────────── */

function SlideBasic({ t }: { t: TranslationKeys; initials: string }) {
  return (
    <div className="bg-white text-gray-900 rounded-lg overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-200">
        <h2 className="text-lg font-bold tracking-tight text-gray-900">{t.previews.name}</h2>
        <p className="text-xs font-medium text-gray-500 mt-0.5">{t.previews.role}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><Mail className="h-2.5 w-2.5" />{t.previews.email}</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><Phone className="h-2.5 w-2.5" />{t.previews.phone}</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><MapPin className="h-2.5 w-2.5" />{t.previews.location}</span>
        </div>
      </div>
      {/* Body */}
      <div className="px-5 py-3 flex-1 space-y-3">
        {/* Experience */}
        <div>
          <SectionLabel text={t.previews.experience} color="text-gray-400" />
          <div className="space-y-2">
            <div>
                <div className="flex justify-between items-baseline">
                  <p className="text-[11px] font-semibold text-gray-800">{t.previews.headOfProduct} · {t.previews.techCorp}</p>
                  <p className="text-[9px] text-gray-400">{t.previews.techCorpYears}</p>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{t.previews.techCorpDesc}</p>
              </div>
              <div>
                <div className="flex justify-between items-baseline">
                  <p className="text-[11px] font-semibold text-gray-800">{t.previews.productManager} · {t.previews.startupXY}</p>
                  <p className="text-[9px] text-gray-400">{t.previews.startupYears}</p>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{t.previews.startupDesc}</p>
              </div>
            </div>
          </div>
          {/* Education */}
          <div>
            <SectionLabel text={t.previews.education} color="text-gray-400" />
            <div className="flex justify-between items-baseline">
              <p className="text-[11px] font-semibold text-gray-800">{t.previews.mba} · {t.previews.columbia}</p>
              <p className="text-[9px] text-gray-400">{t.previews.educationYears}</p>
            </div>
        </div>
        {/* Skills */}
        <div>
          <SectionLabel text={t.previews.skills} color="text-gray-400" />
          <div className="flex flex-wrap gap-1">
            {[t.previews.productStrategy, t.previews.agile, t.previews.dataAnalysis, t.previews.uxResearch].map(s => (
              <span key={s} className="rounded border border-gray-200 px-1.5 py-0.5 text-[9px] text-gray-600">{s}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return <p className={`text-[9px] font-bold uppercase tracking-widest ${color} mb-1.5`}>{text}</p>;
}

function SlideExecutive({ t, initials }: { t: TranslationKeys; initials: string }) {
  const skills = [
    { name: t.previews.productVision, pct: 95 },
    { name: t.previews.teamLeadership, pct: 90 },
    { name: t.previews.gtm, pct: 85 },
    { name: t.previews.dataAnalysis, pct: 80 },
  ];
  return (
    <div className="bg-white text-gray-900 rounded-lg overflow-hidden h-full flex flex-col">
      {/* Dark header */}
      <div className="bg-gray-900 px-5 pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">{initials}</div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">{t.previews.name}</h2>
            <p className="text-[10px] text-amber-400 font-medium mt-0.5">{t.previews.role}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-3">
          <span className="flex items-center gap-1 text-[9px] text-gray-300"><Mail className="h-2 w-2" />{t.previews.email}</span>
          <span className="flex items-center gap-1 text-[9px] text-gray-300"><Phone className="h-2 w-2" />{t.previews.phone}</span>
          <span className="flex items-center gap-1 text-[9px] text-gray-300"><MapPin className="h-2 w-2" />{t.previews.location}</span>
        </div>
      </div>
      {/* Body */}
      <div className="px-5 py-3 flex-1 space-y-3">
        {/* Experience */}
        <div>
          <SectionLabel text={t.previews.experience} color="text-amber-500" />
            <div className="space-y-2">
              <div>
                <div className="flex justify-between items-baseline">
                  <p className="text-[11px] font-semibold text-gray-800">{t.previews.headOfProduct} · {t.previews.techCorp}</p>
                  <p className="text-[9px] text-gray-400">{t.previews.techCorpYears}</p>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{t.previews.techCorpDesc}</p>
              </div>
              <div>
                <div className="flex justify-between items-baseline">
                  <p className="text-[11px] font-semibold text-gray-800">{t.previews.productManager} · {t.previews.startupXY}</p>
                  <p className="text-[9px] text-gray-400">{t.previews.startupYears}</p>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{t.previews.startupDesc}</p>
              </div>
            </div>
          </div>
          <div>
            <SectionLabel text={t.previews.skills} color="text-amber-500" />
            <div className="space-y-1.5">
              {skills.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-600 w-24 flex-shrink-0">{s.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel text={t.previews.education} color="text-amber-500" />
            <p className="text-[11px] font-semibold text-gray-800">{t.previews.mba} · {t.previews.columbia} <span className="text-[9px] text-gray-400 font-normal">{t.previews.educationYears}</span></p>
          </div>
      </div>
    </div>
  );
}

function SlideCreative({ t, initials }: { t: TranslationKeys; initials: string }) {
  const skills = [
    { name: t.previews.productStrategy, pct: 95 },
    { name: t.previews.uxResearch, pct: 85 },
    { name: t.previews.agile, pct: 90 },
  ];
  return (
    <div className="bg-white text-gray-900 rounded-lg overflow-hidden h-full flex flex-row">
      {/* Sidebar */}
      <div className="w-[38%] bg-gradient-to-b from-rose-500 to-pink-600 px-3 py-4 flex flex-col gap-3">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center text-white font-bold text-base">{initials}</div>
          <h2 className="text-[11px] font-bold text-white mt-2 leading-tight">{t.previews.name}</h2>
          <p className="text-[9px] text-rose-100 mt-0.5">{t.previews.jrPm}</p>
        </div>
        <div>
          <SectionLabel text={t.previews.contact} color="text-rose-200" />
          <div className="space-y-1">
            <p className="text-[9px] text-white/90 flex items-center gap-1"><Mail className="h-2 w-2 flex-shrink-0" />{t.previews.email}</p>
            <p className="text-[9px] text-white/90 flex items-center gap-1"><Phone className="h-2 w-2 flex-shrink-0" />{t.previews.phone}</p>
            <p className="text-[9px] text-white/90 flex items-center gap-1"><MapPin className="h-2 w-2 flex-shrink-0" />{t.previews.location}</p>
          </div>
        </div>
        <div>
          <SectionLabel text={t.previews.skills} color="text-rose-200" />
          <div className="space-y-1.5">
            {skills.map(s => (
              <div key={s.name}>
                <p className="text-[8px] text-white/80 mb-0.5">{s.name}</p>
                <div className="h-1 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
          <div>
            <SectionLabel text={t.previews.education} color="text-rose-200" />
            <p className="text-[9px] text-white/90 font-semibold">{t.previews.mba}</p>
            <p className="text-[8px] text-rose-100">{t.previews.columbia}</p>
            <p className="text-[8px] text-rose-200">{t.previews.educationYears}</p>
          </div>
        </div>
        {/* Main content */}
        <div className="flex-1 px-3 py-4 flex flex-col gap-2.5 overflow-hidden">
          <div>
            <SectionLabel text={t.previews.experience} color="text-rose-500" />
            <div className="space-y-2">
              <div>
                <div className="flex justify-between items-baseline">
                  <p className="text-[10px] font-bold text-gray-800">{t.previews.headOfProduct}</p>
                  <p className="text-[8px] text-gray-400">{t.previews.techCorpYears}</p>
                </div>
                <p className="text-[9px] text-rose-500 font-medium">{t.previews.techCorp}</p>
                <p className="text-[9px] text-gray-500 mt-0.5 leading-relaxed">{t.previews.techCorpDesc}</p>
              </div>
              <div>
                <div className="flex justify-between items-baseline">
                  <p className="text-[10px] font-bold text-gray-800">{t.previews.productManager}</p>
                  <p className="text-[8px] text-gray-400">{t.previews.startupYears}</p>
                </div>
                <p className="text-[9px] text-rose-500 font-medium">{t.previews.startupXY}</p>
                <p className="text-[9px] text-gray-500 mt-0.5 leading-relaxed">{t.previews.startupDesc}</p>
              </div>
              <div>
                <div className="flex justify-between items-baseline">
                  <p className="text-[10px] font-bold text-gray-800">{t.previews.jrPm} · {t.previews.digitalAgency}</p>
                  <p className="text-[8px] text-gray-400">{t.previews.agencyYears}</p>
                </div>
                <p className="text-[9px] text-gray-500 mt-0.5">{t.previews.agencyDesc}</p>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}

const CV_SLIDES = (t: TranslationKeys) => [
  {
    id: 'basic',
    label: t.common.previewBadge,
    labelColor: 'bg-gray-700 text-white',
    component: SlideBasic,
  },
  {
    id: 'executive',
    label: t.templates.proBadge,
    labelColor: 'bg-amber-500 text-white',
    component: SlideExecutive,
  },
  {
    id: 'creative',
    label: t.templates.proBadge,
    labelColor: 'bg-rose-500 text-white',
    component: SlideCreative,
  },
];

function CVPreviewSlider() {
  const { t } = useI18n();
  const slides = CV_SLIDES(t);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const total = slides.length;

  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, 3000);
    return () => clearInterval(id);
  }, [paused, next]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  const getInitials = (name: string) => {
    if (!name) return 'AJ';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const Slide = slides[current].component;

  const badge = slides[current];

  return (
    <div
      className="relative mx-auto w-full max-w-sm select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Browser chrome */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/10">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
            <span className="ms-2 text-xs text-muted-foreground">{t.common.appName} — {t.cv.preview}</span>
          </div>


        {/* CV slide area */}
        <div className="relative overflow-hidden bg-gray-50" style={{ height: 360 }}>
          {/* Template badge */}
          <div className="absolute top-3 left-3 z-10">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide shadow-sm ${badge.labelColor}`}>
              {badge.label}
            </span>
          </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="absolute inset-0 p-3"
              >
                <Slide t={t} initials={getInitials(t.previews.name)} />
              </motion.div>
            </AnimatePresence>
        </div>

        {/* Dots + nav */}
        <div className="flex items-center justify-center gap-3 border-t border-border bg-muted/30 px-4 py-2.5">
          <button
            onClick={prev}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t.common.back}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => { setCurrent(i); setPaused(true); setTimeout(() => setPaused(false), 5000); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-5 bg-foreground' : 'w-1.5 bg-foreground/25'}`}
                aria-label={`${t.common.slide} ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t.common.next}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────────── */
function HeroSection() {
  const { t } = useI18n();
  const mounted = useMounted();
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />

      <div className="relative mx-auto max-w-4xl px-4 py-28 sm:px-6 sm:py-36 lg:px-8 text-center">
        <motion.div initial={mounted ? "hidden" : false} animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t.hero.badge}
          </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-tight">
              {t.hero.title}
            </motion.h1>

            <motion.p variants={fadeUp} className="mt-3 text-sm font-medium text-primary/80 tracking-wide uppercase sm:text-base">
              {t.hero.tagline}
            </motion.p>

            <motion.p variants={fadeUp} className="mt-4 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto leading-relaxed">
              {t.hero.valueDesc}
            </motion.p>

            <motion.p variants={fadeUp} className="mt-6 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto leading-relaxed">
              {t.hero.subtitle}
            </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/cv-builder"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-7 text-sm font-semibold text-background transition-all hover:opacity-85"
            >
              {t.hero.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/templates"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-7 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              {t.hero.ctaSecondary}
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-5 text-xs text-muted-foreground">
            {t.hero.footerText}
          </motion.p>

          {/* CV Preview Slider */}
          <motion.div variants={fadeUp} className="mt-16">
            <CVPreviewSlider />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Features ──────────────────────────────────────────────────────────────── */
function FeaturesSection() {
  const { t } = useI18n();
  const features = [
    {
      icon: Sparkles,
      title: t.features.ai.title,
      desc: t.features.ai.desc,
    },
    {
      icon: LayoutTemplate,
      title: t.features.templates.title,
      desc: t.features.templates.desc,
    },
    {
      icon: Zap,
      title: t.features.analyzer.title,
      desc: t.features.analyzer.desc,
      pro: true,
    },
    {
      icon: Globe,
      title: t.features.multilingual.title,
      desc: t.features.multilingual.desc,
    },
  ];

  return (
    <section className="py-20 sm:py-28 border-b border-border">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
        >
          <motion.p variants={fadeUp} className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t.features.badge}
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-center text-3xl font-bold tracking-tight sm:text-4xl mb-14">
            {t.features.title}
          </motion.h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="relative rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                {f.pro && (
                  <span className="absolute top-4 right-4 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    {t.templates.proBadge}
                  </span>
                )}
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Templates ─────────────────────────────────────────────────────────────── */
function TemplatesSection() {
  const { t } = useI18n();
  const [hoveredIdx, setHoveredIdx] = useState<string | null>(null);

  const free: { id: TemplateId; name: string; desc: string }[] = [
    { id: 'modern-minimal', name: t.templates.items['modern-minimal'].name, desc: t.templates.items['modern-minimal'].description },
    { id: 'clean-simple', name: t.templates.items['clean-simple'].name, desc: t.templates.items['clean-simple'].description },
    { id: 'professional-classic', name: t.templates.items['professional-classic'].name, desc: t.templates.items['professional-classic'].description },
  ];
  const pro: { id: TemplateId; name: string; desc: string }[] = [
    { id: 'executive-premium', name: t.templates.items['executive-premium'].name, desc: t.templates.items['executive-premium'].description },
    { id: 'creative-bold', name: t.templates.items['creative-bold'].name, desc: t.templates.items['creative-bold'].description },
    { id: 'corporate-navy', name: t.templates.items['corporate-navy'].name, desc: t.templates.items['corporate-navy'].description },
    { id: 'nordic-clean', name: t.templates.items['nordic-clean'].name, desc: t.templates.items['nordic-clean'].description },
    { id: 'tech-sidebar', name: t.templates.items['tech-sidebar'].name, desc: t.templates.items['tech-sidebar'].description },
    { id: 'elegant-formal', name: t.templates.items['elegant-formal'].name, desc: t.templates.items['elegant-formal'].description },
    { id: 'creative-artistic', name: t.templates.items['creative-artistic'].name, desc: t.templates.items['creative-artistic'].description },
    { id: 'ats-standard', name: t.templates.items['ats-standard'].name, desc: t.templates.items['ats-standard'].description },
    { id: 'contemporary-bold', name: t.templates.items['contemporary-bold'].name, desc: t.templates.items['contemporary-bold'].description },
    { id: 'rirekisho', name: t.templates.items['rirekisho'].name, desc: t.templates.items['rirekisho'].description },
  ];

  return (
    <section className="py-20 sm:py-28 border-b border-border bg-muted/20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.templates.showcase}</h2>
            <p className="mt-3 text-muted-foreground">{t.templates.showcaseSubtitle}</p>
          </motion.div>

          {/* Free templates */}
          <motion.div variants={fadeUp} className="mb-10">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t.templates.freeCount}</p>
            <div className="grid gap-4 grid-cols-3">
              {free.map((tItem, i) => (
                <TemplateTile
                  key={i}
                  templateId={tItem.id}
                  name={tItem.name}
                  badge={null}
                  desc={tItem.desc}
                  hovered={hoveredIdx === `free-${i}`}
                  onHover={() => setHoveredIdx(`free-${i}`)}
                  onLeave={() => setHoveredIdx(null)}
                />
              ))}
            </div>
          </motion.div>

          {/* Pro templates */}
          <motion.div variants={fadeUp}>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              {t.templates.proCount}
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary normal-case tracking-normal">{t.pricing.oneTime}</span>
            </p>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {pro.map((tItem, i) => (
                <TemplateTile
                  key={i}
                  templateId={tItem.id}
                  name={tItem.name}
                  badge={t.templates.proBadge}
                  desc={tItem.desc}
                  hovered={hoveredIdx === `pro-${i}`}
                  onHover={() => setHoveredIdx(`pro-${i}`)}
                  onLeave={() => setHoveredIdx(null)}
                />
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-muted-foreground">
              {t.templates.unlockPro}
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 text-center">
            <Link href="/templates" className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent">
              {t.templates.browseAll}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

interface TemplateTileProps {
  templateId: TemplateId;
  name: string;
  badge: string | null;
  desc: string;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function TemplateTile({ templateId, name, badge, desc, hovered, onHover, onLeave }: TemplateTileProps) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 cursor-pointer select-none"
      style={{ transform: hovered ? 'scale(1.035)' : 'scale(1)', boxShadow: hovered ? '0 12px 30px rgba(0,0,0,0.12)' : '0 4px 12px rgba(0,0,0,0.03)' }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onTouchStart={onHover}
      onTouchEnd={onLeave}
    >
      {badge && (
        <span className="absolute right-2 top-2 z-20 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
          {badge}
        </span>
      )}
      <div className="relative aspect-[1/1.4] overflow-hidden bg-muted/30">
        <div className="absolute inset-0 p-3 transition-transform duration-500 ease-out" style={{ transform: hovered ? 'scale(1.05)' : 'scale(1)' }}>
            <TemplatePreview templateId={templateId} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
      </div>
      <div className="px-3 py-2.5 bg-card">
        <p className="text-xs font-semibold text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Pricing ───────────────────────────────────────────────────────────────── */
function PricingSection() {
  const { t } = useI18n();

  return (
    <section id="pricing" className="py-20 sm:py-28 border-b border-border">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.pricing.title}</h2>
            <p className="mt-3 text-muted-foreground">{t.pricing.subtitle}</p>
          </motion.div>

            <motion.div variants={fadeUp} className="grid gap-5 sm:grid-cols-2">
              {/* Free */}
              <div className="rounded-xl border border-border bg-card p-8 transition-colors hover:border-border/80">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{t.pricing.free.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold text-foreground">{t.pricing.free.price}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8">{t.pricing.free.desc}</p>
                <ul className="space-y-3 mb-8">
                  {t.pricing.free.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                      <Check className="h-4 w-4 flex-shrink-0 text-foreground/40" />
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
              <div className="relative rounded-xl border border-primary/20 bg-card p-8 shadow-lg shadow-black/5 transition-all hover:border-primary/40">
                {/* Popular Badge */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary rounded-full shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                    {t.pricing.popularBadge}
                  </p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">{t.pricing.pro.badge}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold text-foreground">{t.pricing.pro.price}</span>
                </div>
                  <p className="text-sm text-muted-foreground mb-2">{t.pricing.pro.desc}</p>
                  <p className="text-xs text-muted-foreground/70 mb-8 italic">{t.pricing.pro.noSubscription}</p>
                  <ul className="space-y-3 mb-8">
                  {t.pricing.pro.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-foreground">
                      <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className="flex h-10 w-full items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background transition-all hover:opacity-85 shadow-sm"
                >
                  {t.pricing.pro.cta}
                </Link>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  {t.pricing.pro.footer}
                </p>
              </div>
            </motion.div>

        </motion.div>
      </div>
    </section>
  );
}

/* ─── CV Quality Comparison ─────────────────────────────────────────────────── */
function CVQualitySection() {
  return (
    <section className="py-20 sm:py-28 border-b border-border bg-muted/20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <CVQualityComparison showHeading />
      </div>
    </section>
  );
}

/* ─── How It Works ──────────────────────────────────────────────────────────── */
function HowItWorksSection() {
  const { t } = useI18n();
  const steps = [
    { icon: ClipboardList, num: '1', title: t.howItWorks.step1.title, desc: t.howItWorks.step1.desc },
    { icon: Wand2,         num: '2', title: t.howItWorks.step2.title, desc: t.howItWorks.step2.desc },
    { icon: Download,      num: '3', title: t.howItWorks.step3.title, desc: t.howItWorks.step3.desc },
  ];
  return (
    <section className="py-20 sm:py-28 border-b border-border">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-center text-3xl font-bold tracking-tight sm:text-4xl mb-14">
            {t.howItWorks.title}
          </motion.h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="relative rounded-xl border border-border bg-card p-6 flex flex-col gap-4 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary flex-shrink-0">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t.howItWorks.step} {step.num}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Who Is This For ───────────────────────────────────────────────────────── */
function WhoIsThisForSection() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-28 border-b border-border bg-muted/20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-10 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary flex-shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.whoIsThisFor.title}</h2>
              </div>
              <ul className="space-y-3">
                {t.whoIsThisFor.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-foreground/80">
                    <Check className="h-4 w-4 flex-shrink-0 text-foreground/40" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Privacy First ─────────────────────────────────────────────────────────── */
function PrivacyFirstSection() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-28 border-b border-border">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="rounded-xl border border-border bg-card p-8 sm:p-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary flex-shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.privacyFirst.title}</h2>
            </div>
            <p className="text-base text-muted-foreground leading-relaxed mb-4">{t.privacyFirst.desc}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.privacyFirst.local}</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Simple Pricing Message ────────────────────────────────────────────────── */
function SimplePricingSection() {
  const { t } = useI18n();
  return (
    <section className="py-14 sm:py-20 border-b border-border bg-muted/20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-5 rounded-xl border border-primary/20 bg-card px-8 py-6 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/8 text-primary flex-shrink-0">
              <Tag className="h-5 w-5" />
            </div>
            <div className="text-center sm:text-start">
              <p className="text-base font-semibold text-foreground mb-1">{t.simplePricing.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.simplePricing.desc}</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── FAQ ───────────────────────────────────────────────────────────────────── */
function FAQSection() {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-20 sm:py-28 border-b border-border">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-center text-3xl font-bold tracking-tight sm:text-4xl mb-10">
            {t.faq.title}
          </motion.h2>
          <motion.div variants={fadeUp} className="space-y-2">
            {t.faq.items.map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
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
                  <div className="border-t border-border px-5 py-4 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── CTA ───────────────────────────────────────────────────────────────────── */
function CTASection() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.div initial={false} whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t.cv.ready}
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-muted-foreground text-lg">
            {t.cv.readySubtitle}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/cv-builder"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-foreground px-7 text-sm font-semibold text-background transition-all hover:opacity-85"
            >
              {t.cv.generate}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-7 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              {t.nav.pricing}
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="mt-5 text-xs text-muted-foreground">
            {t.hero.footerText}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
