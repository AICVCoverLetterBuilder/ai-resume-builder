'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { TemplateId } from '@/lib/types';

const pickerLabels: Record<string, { placeholder: string; dialog: string; prevYear: string; nextYear: string }> = {
  en: { placeholder: 'MM / YYYY', dialog: 'Month picker', prevYear: 'Previous year', nextYear: 'Next year' },
  'pt-BR': { placeholder: 'MM / AAAA', dialog: 'Seletor de mês', prevYear: 'Ano anterior', nextYear: 'Próximo ano' },
  de: { placeholder: 'MM / JJJJ', dialog: 'Monatsauswahl', prevYear: 'Vorheriges Jahr', nextYear: 'Nächstes Jahr' },
  es: { placeholder: 'MM / AAAA', dialog: 'Selector de mes', prevYear: 'Año anterior', nextYear: 'Año siguiente' },
  fr: { placeholder: 'MM / AAAA', dialog: 'Sélecteur de mois', prevYear: 'Année précédente', nextYear: 'Année suivante' },
  it: { placeholder: 'MM / AAAA', dialog: 'Selettore mese', prevYear: 'Anno precedente', nextYear: 'Anno successivo' },
  ar: { placeholder: 'شهر / سنة', dialog: 'اختيار الشهر', prevYear: 'السنة السابقة', nextYear: 'السنة التالية' },
  sr: { placeholder: 'MM / GGGG', dialog: 'Birač meseca', prevYear: 'Prethodna godina', nextYear: 'Sledeća godina' },
  hr: { placeholder: 'MM / GGGG', dialog: 'Odabir mjeseca', prevYear: 'Prethodna godina', nextYear: 'Sljedeća godina' },
  ru: { placeholder: 'ММ / ГГГГ', dialog: 'Выбор месяца', prevYear: 'Предыдущий год', nextYear: 'Следующий год' },
  hi: { placeholder: 'माह / वर्ष', dialog: 'माह चयन', prevYear: 'पिछला वर्ष', nextYear: 'अगला वर्ष' },
  ja: { placeholder: '月 / 年', dialog: '月の選択', prevYear: '前の年', nextYear: '次の年' },
};

// Map app locale codes to Intl-safe locale strings.
// 'sr' defaults to Cyrillic in most browsers; force Latin script with 'sr-Latn'.
const INTL_LOCALE_MAP: Record<string, string> = {
  sr: 'sr-Latn',
};

function toIntlLocale(locale: string): string {
  return INTL_LOCALE_MAP[locale] ?? locale;
}

function buildMonthNames(locale: string, month: 'short' | 'long'): string[] {
  const intlLocale = toIntlLocale(locale);
  const formatter = new Intl.DateTimeFormat(intlLocale, { month, timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(Date.UTC(2026, index, 1))));
}

// ─── Template style configs ────────────────────────────────────────────────────

type PickerVariant = 'modern' | 'executive' | 'creative' | 'simple';

function getVariant(templateId?: TemplateId): PickerVariant {
  if (!templateId) return 'modern';
  if (templateId === 'executive-premium' || templateId === 'elegant-formal') return 'executive';
  if (templateId === 'creative-bold' || templateId === 'creative-artistic') return 'creative';
  if (templateId === 'clean-simple' || templateId === 'ats-standard') return 'simple';
  return 'modern'; // modern-minimal, professional-classic
}

interface VariantStyles {
  container: string;
  header: string;
  yearBtn: string;
  navBtn: string;
  monthBtn: string;
  selectedMonth: string;
  todayIndicator: string;
  triggerClass: string;
}

const variantStyles: Record<PickerVariant, VariantStyles> = {
  modern: {
    container: 'bg-white border border-gray-200 rounded-xl shadow-lg p-4',
    header: 'text-sm font-semibold text-indigo-700',
    yearBtn: 'text-sm font-semibold text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded hover:bg-indigo-50',
    navBtn: 'p-1 rounded hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 transition-colors',
    monthBtn: 'rounded-lg py-1.5 text-xs font-medium transition-all hover:bg-indigo-50 hover:text-indigo-700 text-gray-700',
    selectedMonth: 'bg-indigo-600 text-white hover:bg-indigo-700 hover:text-white shadow-sm',
    todayIndicator: 'ring-1 ring-indigo-400',
    triggerClass: 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 flex items-center justify-between cursor-pointer',
  },
  executive: {
    container: 'bg-white border border-gray-300 rounded-none shadow-xl p-4',
    header: 'text-xs font-bold uppercase tracking-widest text-amber-700',
    yearBtn: 'text-xs font-bold uppercase tracking-widest text-amber-700 hover:text-amber-900 px-2 py-1 hover:bg-amber-50',
    navBtn: 'p-1 hover:bg-amber-50 text-amber-600 hover:text-amber-800 transition-colors',
    monthBtn: 'rounded-none py-1.5 text-xs font-medium transition-all hover:bg-amber-50 hover:text-amber-800 text-gray-600 border border-transparent',
    selectedMonth: 'bg-gray-900 text-amber-400 border-gray-900 hover:bg-gray-800 hover:text-amber-300',
    todayIndicator: 'ring-1 ring-amber-500',
    triggerClass: 'h-10 w-full border border-gray-300 bg-white px-3 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-200 flex items-center justify-between cursor-pointer',
  },
  creative: {
    container: 'bg-white border border-rose-200 rounded-2xl shadow-xl p-4',
    header: 'text-sm font-bold text-rose-600',
    yearBtn: 'text-sm font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-full hover:bg-rose-50',
    navBtn: 'p-1 rounded-full hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-colors',
    monthBtn: 'rounded-full py-1.5 text-xs font-medium transition-all hover:bg-rose-50 hover:text-rose-700 text-gray-700',
    selectedMonth: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white hover:from-rose-600 hover:to-pink-700 hover:text-white shadow-md',
    todayIndicator: 'ring-2 ring-rose-400',
    triggerClass: 'h-10 w-full rounded-full border border-rose-200 bg-white px-4 text-sm outline-none transition-colors focus:border-rose-400 focus:ring-2 focus:ring-rose-100 flex items-center justify-between cursor-pointer',
  },
  simple: {
    container: 'bg-white border border-gray-200 rounded-lg shadow-md p-3',
    header: 'text-sm font-medium text-gray-700',
    yearBtn: 'text-sm font-medium text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-50',
    navBtn: 'p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors',
    monthBtn: 'rounded py-1.5 text-xs font-medium transition-all hover:bg-emerald-50 hover:text-emerald-700 text-gray-600',
    selectedMonth: 'bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white',
    todayIndicator: 'ring-1 ring-emerald-500',
    triggerClass: 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 flex items-center justify-between cursor-pointer',
  },
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MonthPickerProps {
  value: string; // "YYYY-MM" format (same as input type="month")
  onChange: (value: string) => void;
  disabled?: boolean;
  locale?: string;
  templateId?: TemplateId;
  className?: string;
  label?: string;
}

// Parse "YYYY-MM" → { year, month } (month is 1-indexed)
function parseValue(val: string): { year: number; month: number } | null {
  if (!val) return null;
  const [y, m] = val.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function formatDisplay(val: string, locale: string): string {
  const parsed = parseValue(val);
  if (!parsed) return '';
  const names = buildMonthNames(locale, 'short');
  return `${names[parsed.month - 1]} ${parsed.year}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MonthPicker({ value, onChange, disabled, locale = 'en', templateId, className }: MonthPickerProps) {
  const now = new Date();
  const parsed = parseValue(value);
  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? now.getFullYear());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const variant = getVariant(templateId);
  const styles = variantStyles[variant];
  const months = useMemo(() => buildMonthNames(locale, 'short'), [locale]);
  const labels = pickerLabels[locale] || pickerLabels.en;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Sync viewYear when value changes externally
  useEffect(() => {
    const p = parseValue(value);
    if (p) setViewYear(p.year);
  }, [value]);

  const handleMonthClick = useCallback((monthIdx: number) => {
    const mm = String(monthIdx + 1).padStart(2, '0');
    onChange(`${viewYear}-${mm}`);
    setOpen(false);
  }, [viewYear, onChange]);

  const handleYearPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear(y => y - 1);
  };
  const handleYearNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewYear(y => y + 1);
  };

  const displayText = value ? formatDisplay(value, locale) : <span className="text-muted-foreground text-xs">{labels.placeholder}</span>;

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`${styles.triggerClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? 'text-foreground' : ''}>{displayText}</span>
        <Calendar className="h-4 w-4 opacity-40 shrink-0" />
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div
          className={`absolute z-50 mt-1 w-64 ${styles.container}`}
          style={{ minWidth: '220px' }}
          role="dialog"
          aria-label={labels.dialog}
        >
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={handleYearPrev} className={styles.navBtn} aria-label={labels.prevYear}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className={styles.yearBtn}>{viewYear}</span>
            <button type="button" onClick={handleYearNext} className={styles.navBtn} aria-label={labels.nextYear}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1">
            {months.map((name, idx) => {
              const isSelected = parsed?.year === viewYear && parsed?.month === idx + 1;
              const isCurrentMonth = now.getFullYear() === viewYear && now.getMonth() === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleMonthClick(idx)}
                  className={[
                    styles.monthBtn,
                    isSelected ? styles.selectedMonth : '',
                    !isSelected && isCurrentMonth ? styles.todayIndicator : '',
                  ].filter(Boolean).join(' ')}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
