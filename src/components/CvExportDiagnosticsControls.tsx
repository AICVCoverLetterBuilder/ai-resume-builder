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
  const [EnabledPanel, setEnabledPanel] = useState<null | typeof import('./InternalAiUsageResetPanel').InternalAiUsageResetPanel>(null);

  useEffect(() => {
    if (!open) return;
    const pdf = getLatestCvExportDiagnostic('pdf');
    const docx = getLatestCvExportDiagnostic('docx');
    setJson(JSON.stringify({ pdf, docx }, null, 2));
    setPanelTick((n) => n + 1);
  }, [open]);

  useEffect(() => {
    // Compile-time gate: when false, this branch is DCE'd and the panel chunk
    // is never referenced from production bundles.
    if (!INTERNAL_AI_RESET_ENABLED) return;
    let cancelled = false;
    void import('./InternalAiUsageResetPanel').then((mod) => {
      if (!cancelled) setEnabledPanel(() => mod.InternalAiUsageResetPanel);
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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Export diagnostics"
    >
      <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Export diagnostics</h2>
          <button type="button" className="text-xs text-muted-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          Non-PII metadata only (no CV text). Copy and send this JSON when reporting an export failure.
        </p>
        <pre className="mx-4 my-3 max-h-[45vh] overflow-auto rounded-lg bg-muted/40 p-3 text-[10px] leading-relaxed">
          {json || 'No export diagnostics recorded yet. Try PDF or DOCX export once.'}
        </pre>
        {INTERNAL_AI_RESET_ENABLED && EnabledPanel ? (
          <EnabledPanel refreshToken={panelTick} />
        ) : null}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
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
