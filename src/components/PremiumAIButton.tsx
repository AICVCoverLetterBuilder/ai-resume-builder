import * as React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface PremiumAIButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: LucideIcon;
  badge?: React.ReactNode;
  rightSlot?: React.ReactNode;
  showArrow?: boolean;
  /** Optional conversion hint shown in the bottom row (e.g. "Most popular") */
  hint?: React.ReactNode;
}

// ─── Design Tokens ─────────────────────────────────────────────────────────────
//  BG_BASE       #080b12  — deep near-black, cool blue-black
//  BG_HOVER      #0d1120  — subtly lifted on hover
//  BG_ACTIVE     #060810  — pressed inset
//  BORDER_REST   rgba(212,178,84,0.18)  — whisper-thin gold
//  BORDER_HOVER  rgba(212,178,84,0.42)  — gold lifts on hover
//  ICON_BG       #10152a  — deep navy for icon container
//  ICON_GOLD     #d4aa50  — warm refined gold
//  ICON_HOVER    #e8c26a  — brighter on hover
//  LABEL         #f0ead8  — warm white
//  SUBTITLE      rgba(240,234,216,0.55) — muted, secondary
//  HINT          #c9a84c  — accent gold for hint/badge row
//  GLOW_HOVER    rgba(212,178,84,0.07) — barely-there warm glow
// ───────────────────────────────────────────────────────────────────────────────

export function PremiumAIButton({
  label,
  subtitle,
  hint,
  icon: Icon,
  badge,
  rightSlot,
  showArrow = false,
  className,
  ...props
}: PremiumAIButtonProps) {
  return (
    <button
      className={cn(
        // Base layout — card style, full width; min-w-0 so long locale labels cannot widen parents
        'group relative flex w-full max-w-full min-w-0 items-start gap-3 overflow-hidden text-left',
        // Border radius — premium card (16–18px range)
        'rounded-[17px]',
        // Padding — compact, breathable (12–14px)
        'px-4 py-3',
        // Surface — deep dark gradient (dark → slightly lighter)
        'bg-[#080b12]',
        '[background-image:linear-gradient(160deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.008)_50%,transparent_100%)]',
        // Border — ultra-thin gold accent
        'border border-[rgba(212,178,84,0.18)]',
        // Shadow — depth without noise
        'shadow-[0_2px_20px_rgba(0,0,0,0.55),0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.04)]',
        // Transition — 150ms as spec
        'transition-all duration-150 ease-out',
        // ── Hover ──
        'hover:border-[rgba(212,178,84,0.42)]',
        'hover:bg-[#0d1120]',
        'hover:shadow-[0_4px_28px_rgba(0,0,0,0.60),0_0_0_1px_rgba(212,178,84,0.10),inset_0_1px_0_rgba(255,255,255,0.06)]',
        // ── Active / Press — scale 0.97 as spec ──
        'active:scale-[0.97]',
        'active:bg-[#060810]',
        'active:shadow-[inset_0_2px_10px_rgba(0,0,0,0.65)]',
        'active:border-[rgba(212,178,84,0.30)]',
        // ── Focus ──
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[rgba(212,178,84,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]',
        // ── Disabled ──
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30',
        className,
      )}
      {...props}
    >
      {/* Hover glow — warm gold shimmer intensifies on tap */}
      <span
        className="pointer-events-none absolute inset-0 rounded-[17px] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-[1.5]"
        style={{
          background: 'radial-gradient(ellipse at 25% 40%, rgba(212,178,84,0.09) 0%, transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Icon — rounded square, 18–20px icon, soft glow */}
      <span
        className={cn(
          'relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          // Deep navy background — contrast from body
          'bg-[#10152a]',
          // Ultra-thin gold border
          'border border-[rgba(212,178,84,0.20)]',
          // Icon color — warm gold
          'text-[#d4aa50]',
          // Soft glow + depth
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_8px_rgba(0,0,0,0.45),0_0_0_0_rgba(212,178,84,0)]',
          'transition-all duration-150 ease-out',
          // Hover: glow intensifies
          'group-hover:border-[rgba(212,178,84,0.42)] group-hover:text-[#e8c26a]',
          'group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_2px_10px_rgba(0,0,0,0.55),0_0_10px_rgba(212,178,84,0.10)]',
          'group-active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.60)]',
        )}
        aria-hidden="true"
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      {/* Text column — full layout */}
      <span className="relative flex min-w-0 flex-1 flex-col gap-[3px]">
        {/* Title — 15px, weight 600, single line */}
        <span
          className="min-w-0 text-[15px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#f0ead8] whitespace-normal break-words sm:truncate"
        >
          {label}
        </span>

        {/* Description — 12–13px, muted, max 2 lines, no overflow */}
        {subtitle && (
          <span
            className="min-w-0 text-[12px] font-normal leading-[1.4] text-[rgba(240,234,216,0.55)] line-clamp-2 break-words"
          >
            {typeof subtitle === 'string'
              ? subtitle.replace(/ · /g, ' · ')
              : subtitle}
          </span>
        )}

        {/* Bottom row — hint pill + badge + arrow */}
        {(hint || badge || rightSlot || showArrow) && (
          <span className="mt-[5px] flex items-center gap-1.5 flex-wrap">
            {hint && (
              <span className="inline-flex items-center rounded-full bg-[rgba(212,178,84,0.08)] border border-[rgba(212,178,84,0.18)] px-[7px] py-[2px] text-[10px] font-semibold tracking-[0.06em] text-[#c9a84c] transition-all duration-150 group-hover:border-[rgba(212,178,84,0.30)] group-hover:text-[#d4b860] whitespace-nowrap">
                {hint}
              </span>
            )}
            {badge ?? rightSlot}
            {showArrow && (
              <ChevronRight
                className="ml-auto h-3.5 w-3.5 text-[rgba(212,178,84,0.45)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[rgba(212,178,84,0.75)]"
                aria-hidden="true"
              />
            )}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── ProBadge ──────────────────────────────────────────────────────────────────
// Luxury pill: deep dark bg, hairline gold border, warm gold text.
export function ProBadge({ label = 'PRO' }: { label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full',
        // Deep warm-black background
        'bg-[#12100a]',
        // Hairline gold border
        'border border-[rgba(212,178,84,0.32)]',
        'px-[7px] py-[3px]',
        // Refined gold text
        'text-[10px] font-bold tracking-[0.16em] uppercase text-[#c9a84c]',
        // Depth
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.30)]',
        'whitespace-nowrap',
        'transition-all duration-150 ease-out',
        'group-hover:border-[rgba(212,178,84,0.55)] group-hover:text-[#dfc06a]',
      )}
    >
      {label}
    </span>
  );
}

// ─── AIBadge ───────────────────────────────────────────────────────────────────
// Same pill structure as ProBadge, cooler blue undertone.
export function AIBadge({ label = 'AI' }: { label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full',
        // Deep cool-dark background
        'bg-[#0d1122]',
        // Hairline gold border — cooler undertone
        'border border-[rgba(212,178,84,0.26)]',
        'px-[7px] py-[3px]',
        'text-[10px] font-bold tracking-[0.14em] uppercase text-[#b8a878]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_3px_rgba(0,0,0,0.28)]',
        'whitespace-nowrap',
        'transition-all duration-150 ease-out',
        'group-hover:border-[rgba(212,178,84,0.48)] group-hover:text-[#cfc090]',
      )}
    >
      {label}
    </span>
  );
}
