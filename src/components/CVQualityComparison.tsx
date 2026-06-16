'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Star, Mail, Phone } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { TranslationKeys } from '@/lib/i18n/translations';

/**
 * A professional, side-by-side "Before / After" preview that shows
 * the visual difference between a FREE and a PRO template.
 */

/* ─── helpers ──────────────────────────────────────────────────────────────── */

function Bar({ w, h = 'h-1.5', opacity = 'bg-gray-200' }: { w: string; h?: string; opacity?: string }) {
  return <div className={`${h} ${w} rounded-full ${opacity}`} />;
}

function SectionLabel({ text, color = 'text-gray-400' }: { text: string; color?: string }) {
  return <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${color}`}>{text}</p>;
}

/* ─── FREE template mock (One Column, B&W, Simple) ─────────────────────────── */

function FreeMock({ t }: { t: TranslationKeys }) {
  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden text-black font-sans shadow-sm select-none p-6 h-[420px]">
      {/* Plain header */}
      <div className="mb-6 text-center border-b border-black pb-4">
        <h2 className="text-xl font-bold uppercase tracking-tight">{t.previews.name}</h2>
        <div className="mt-2 flex flex-col gap-0.5 text-[10px] text-gray-600">
          <span>{t.previews.email} | {t.previews.phone}</span>
          <span>{t.previews.location}</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* Simple Experience */}
        <div>
          <p className="text-xs font-bold uppercase border-b border-gray-300 mb-2">{t.comparison.experience}</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-baseline font-bold text-[11px]">
                <span>{t.previews.headOfProduct}</span>
                <span>{t.previews.techCorpYears}</span>
              </div>
              <p className="text-[10px]">{t.previews.techCorp}</p>
              <div className="mt-2 space-y-1.5">
                <div className="h-1 w-full bg-gray-100" />
                <div className="h-1 w-5/6 bg-gray-100" />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-baseline font-bold text-[11px]">
                <span>{t.previews.productManager}</span>
                <span>{t.previews.startupYears}</span>
              </div>
              <p className="text-[10px]">{t.previews.startupXY}</p>
            </div>
          </div>
        </div>

        {/* Simple Skills (No bars, just text) */}
        <div>
          <p className="text-xs font-bold uppercase border-b border-gray-300 mb-2">{t.cv.skills}</p>
          <p className="text-[10px] text-gray-600 leading-relaxed">
            {t.comparison.chips.join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── PRO template mock (Two Columns, Elegant, Modern) ────────────────────── */

function ProMock({ t }: { t: TranslationKeys }) {
  return (
    <div className="bg-white rounded-xl border border-primary/10 overflow-hidden text-gray-800 font-sans shadow-xl select-none flex h-[420px]">
      {/* Elegant sidebar */}
      <div className="w-[35%] bg-slate-50 border-r border-gray-100 p-5 flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <Star className="h-7 w-7 fill-current" />
          </div>
          <SectionLabel text={t.previews.contact} color="text-primary" />
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-[9px] text-gray-500">
              <Mail className="h-3 w-3 text-primary/60" />
              <span className="truncate">{t.previews.email}</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] text-gray-500">
              <Phone className="h-3 w-3 text-primary/60" />
              {t.previews.phone}
            </div>
          </div>
        </div>

        <div>
          <SectionLabel text={t.comparison.expertise} color="text-primary" />
          <div className="space-y-2">
            {t.comparison.chips.slice(0, 3).map((s: string, i: number) => (
              <div key={s} className="space-y-1">
                <div className="flex justify-between text-[8px] font-medium text-gray-600">
                  <span>{s}</span>
                  <span>{95 - i * 5}%</span>
                </div>
                <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    whileInView={{ width: `${95 - i * 5}%` }}
                    viewport={{ once: true }}
                    className="h-full bg-primary" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{t.previews.name}</h2>
          <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mt-1.5">{t.previews.role}</p>
        </div>

        <div className="space-y-5">
          <div>
            <SectionLabel text={t.comparison.experience} color="text-gray-400" />
            <div className="space-y-5">
              <div className="relative pl-4 border-l-2 border-primary/20">
                <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary" />
                <div className="flex justify-between items-baseline mb-1">
                  <p className="text-[11px] font-bold text-gray-900">{t.previews.headOfProduct}</p>
                  <p className="text-[9px] font-medium text-gray-400">{t.previews.techCorpYears}</p>
                </div>
                <p className="text-[10px] font-bold text-primary mb-2">{t.previews.techCorp}</p>
                <div className="space-y-1.5">
                  <Bar w="w-full" h="h-1.5" opacity="bg-slate-100" />
                  <Bar w="w-5/6" h="h-1.5" opacity="bg-slate-100" />
                </div>
              </div>

              <div className="relative pl-4 border-l-2 border-primary/20">
                <div className="absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-primary/40" />
                <div className="flex justify-between items-baseline mb-1">
                  <p className="text-[11px] font-bold text-gray-900">{t.previews.productManager}</p>
                  <p className="text-[9px] font-medium text-gray-400">{t.previews.startupYears}</p>
                </div>
                <p className="text-[10px] font-bold text-primary/70 mb-2">{t.previews.startupXY}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Exported comparison block ─────────────────────────────────────────────── */

interface CVQualityComparisonProps {
  /** Show a section-level heading and intro. Set false when embedding inside a modal. */
  showHeading?: boolean;
  /** Compact variant — smaller padding, used inside modals */
  compact?: boolean;
}

export function CVQualityComparison({ showHeading = true, compact = false }: CVQualityComparisonProps) {
  const { t } = useI18n();

  return (
    <div className={compact ? '' : 'py-2'}>
      {showHeading && (
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.45 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.comparison.title}</h2>
          <p className="mt-4 text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {t.comparison.subtitle}
          </p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:gap-16 items-start">
        {/* ── FREE card ── */}
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center justify-center sm:justify-start">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
              {t.comparison.freePlan}
            </h3>
          </div>

          <FreeMock t={t} />

          <ul className="space-y-3 px-2">
            {t.comparison.freeFeatures.map(item => (
              <li key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* ── PRO card ── */}
        <motion.div
          initial={false}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <h3 className="text-sm font-bold uppercase tracking-[0.15em] text-primary">
              {t.comparison.proPlan}
            </h3>
            <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-sm">
              {t.comparison.proBadge}
            </span>
          </div>

          <div className="relative">
            <ProMock t={t} />
          </div>

          <ul className="space-y-3 px-2">
            {t.comparison.proFeatures.map(item => (
              <li key={item} className="flex items-center gap-3 text-sm font-medium text-foreground">
                <CheckCircle2 className="h-4.5 w-4.5 flex-shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {showHeading && (
        <motion.div
          initial={false}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-20 text-center"
        >
          <p className="text-sm font-medium text-muted-foreground">
            {t.comparison.persuasiveText}
          </p>
        </motion.div>
      )}
    </div>
  );
}
