'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  copyCvExportDiagnosticsToClipboard,
  getLatestCvExportDiagnostic,
  type CvExportFormat,
} from '@/lib/cv-export-diagnostics';
import { INTERNAL_AI_RESET_ENABLED } from '@/lib/build-channel';

/**
 * Release-safe "Copy diagnostics" control for CV export failures.
 * Always available in production Android AABs (not gated by NODE_ENV).
 */
export function CvExportCopyDiagnosticsButton({
  format,
  label = 'Copy diagnostics',
}: {
  format?: CvExportFormat;
  label?: string;
}) {
  const [hasTrace, setHasTrace] = useState(false);

  useEffect(() => {
    setHasTrace(Boolean(getLatestCvExportDiagnostic(format)));
    const id = window.setInterval(() => {
      setHasTrace(Boolean(getLatestCvExportDiagnostic(format)));
    }, 800);
    return () => window.clearInterval(id);
  }, [format]);

  if (!hasTrace) return null;

  return (
    <button
      type="button"
      className="mt-2 block text-xs font-medium text-amber-800 underline underline-offset-2 dark:text-amber-300"
      onClick={async () => {
        const ok = await copyCvExportDiagnosticsToClipboard(format);
        toast[ok ? 'success' : 'error'](
          ok ? 'Export diagnostics copied' : 'Could not copy diagnostics',
        );
      }}
    >
      {label}
    </button>
  );
}

/** Internal-only copy link — dynamically loaded so markers stay out of production. */
export function ExperienceAiCopyDiagnosticsButton() {
  const [Link, setLink] = useState<null | typeof import('./InternalExperienceAiDiagnosticsPanel').InternalExperienceAiCopyLink>(null);

  useEffect(() => {
    if (!INTERNAL_AI_RESET_ENABLED) return;
    let cancelled = false;
    void import('./InternalExperienceAiDiagnosticsPanel').then((mod) => {
      if (!cancelled) setLink(() => mod.InternalExperienceAiCopyLink);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!INTERNAL_AI_RESET_ENABLED || !Link) return null;
  return <Link />;
}

/** Internal-only Summary AI diagnostics copy control. */
export function SummaryAiCopyDiagnosticsButton() {
  const [Link, setLink] = useState<null | typeof import('./InternalSummaryAiDiagnosticsPanel').InternalSummaryAiCopyLink>(null);

  useEffect(() => {
    if (!INTERNAL_AI_RESET_ENABLED) return;
    let cancelled = false;
    void import('./InternalSummaryAiDiagnosticsPanel').then((mod) => {
      if (!cancelled) setLink(() => mod.InternalSummaryAiCopyLink);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!INTERNAL_AI_RESET_ENABLED || !Link) return null;
  return <Link />;
}

/** Hidden diagnostics modal opened via seven taps on the About version label. */
export function CvExportDiagnosticsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [json, setJson] = useState('');
  const [panelTick, setPanelTick] = useState(0);
  const [showJson, setShowJson] = useState(false);
  const [EnabledPanel, setEnabledPanel] = useState<null | typeof import('./InternalAiUsageResetPanel').InternalAiUsageResetPanel>(null);
  const [ExpAiPanel, setExpAiPanel] = useState<null | typeof import('./InternalExperienceAiDiagnosticsPanel').InternalExperienceAiDiagnosticsPanel>(null);
  const [SumAiPanel, setSumAiPanel] = useState<null | typeof import('./InternalSummaryAiDiagnosticsPanel').InternalSummaryAiDiagnosticsPanel>(null);

  useEffect(() => {
    if (!open) return;
    const pdf = getLatestCvExportDiagnostic('pdf');
    const docx = getLatestCvExportDiagnostic('docx');
    setJson(JSON.stringify({ pdf, docx }, null, 2));
    setPanelTick((n) => n + 1);
    setShowJson(!INTERNAL_AI_RESET_ENABLED);
  }, [open]);

  useEffect(() => {
    if (!INTERNAL_AI_RESET_ENABLED) return;
    let cancelled = false;
    void import('./InternalAiUsageResetPanel').then((mod) => {
      if (!cancelled) setEnabledPanel(() => mod.InternalAiUsageResetPanel);
    });
    void import('./InternalExperienceAiDiagnosticsPanel').then((mod) => {
      if (!cancelled) setExpAiPanel(() => mod.InternalExperienceAiDiagnosticsPanel);
    });
    void import('./InternalSummaryAiDiagnosticsPanel').then((mod) => {
      if (!cancelled) setSumAiPanel(() => mod.InternalSummaryAiDiagnosticsPanel);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onCopy = useCallback(async () => {
    const ok = await copyCvExportDiagnosticsToClipboard();
    toast[ok ? 'success' : 'error'](
      ok ? 'Export diagnostics copied' : 'Could not copy diagnostics',
    );
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Export diagnostics"
      data-testid="cv-export-diagnostics-overlay"
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg"
        data-testid="cv-export-diagnostics-dialog"
        style={{
          maxHeight:
            'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Export diagnostics</h2>
          <button type="button" className="min-h-11 min-w-11 text-xs text-muted-foreground" onClick={onClose}>
            Close
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3"
          data-testid="cv-export-diagnostics-body"
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}
        >
          {INTERNAL_AI_RESET_ENABLED && EnabledPanel ? (
            <div className="mb-4 border-b border-border pb-4">
              <EnabledPanel refreshToken={panelTick} />
            </div>
          ) : null}

          {INTERNAL_AI_RESET_ENABLED && ExpAiPanel ? (
            <ExpAiPanel refreshToken={panelTick} />
          ) : null}

          {INTERNAL_AI_RESET_ENABLED && SumAiPanel ? (
            <SumAiPanel refreshToken={panelTick} />
          ) : null}

          <p className="text-xs text-muted-foreground">
            Non-PII metadata only (no CV text). Copy and send this JSON when reporting an export failure.
          </p>

          {INTERNAL_AI_RESET_ENABLED ? (
            <button
              type="button"
              data-testid="cv-export-diagnostics-toggle-json"
              className="mt-3 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
              onClick={() => setShowJson((v) => !v)}
            >
              {showJson ? 'Hide diagnostics JSON' : 'Show diagnostics JSON'}
            </button>
          ) : null}

          {(showJson || !INTERNAL_AI_RESET_ENABLED) ? (
            <pre
              className="mt-3 max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 text-[10px] leading-relaxed sm:max-h-52"
              data-testid="cv-export-diagnostics-json"
            >
              {json || 'No export diagnostics recorded yet. Try PDF or DOCX export once.'}
            </pre>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            className="min-h-11 rounded-md border border-border px-3 py-2 text-xs pointer-events-auto"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground pointer-events-auto"
            onClick={onCopy}
          >
            Copy diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}

/** Seven-tap detector for revealing the diagnostics modal (About version label). */
export function useSevenTapDiagnosticsOpener() {
  const [open, setOpen] = useState(false);
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    if (taps === 0) return;
    const timer = window.setTimeout(() => setTaps(0), 2500);
    return () => window.clearTimeout(timer);
  }, [taps]);

  const onVersionTap = useCallback(() => {
    setTaps((n) => {
      const next = n + 1;
      if (next >= 7) {
        setOpen(true);
        return 0;
      }
      return next;
    });
  }, []);

  return {
    diagnosticsOpen: open,
    closeDiagnostics: () => setOpen(false),
    onVersionTap,
  };
}
