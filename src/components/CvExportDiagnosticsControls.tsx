'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  copyCvExportDiagnosticsToClipboard,
  getLatestCvExportDiagnostic,
  type CvExportFormat,
} from '@/lib/cv-export-diagnostics';
import { isInternalAiResetEnabled } from '@/lib/build-channel';
import {
  getProAiUsageDiagnosticsSnapshot,
  resetProAiTestUsageLedger,
  type ProAiUsageDiagnosticsSnapshot,
} from '@/lib/ai-usage-policy';

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

function InternalAiUsageResetPanel({
  refreshToken,
}: {
  refreshToken: number;
}) {
  const [snap, setSnap] = useState<ProAiUsageDiagnosticsSnapshot | null>(null);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(() => {
    setSnap(getProAiUsageDiagnosticsSnapshot());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshToken]);

  if (!snap) return null;

  return (
    <div
      className="border-t border-border px-4 py-3 space-y-2"
      data-testid="internal-ai-usage-reset-panel"
    >
      <h3 className="text-xs font-semibold">Internal AI test usage</h3>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Storage: {snap.storageBackend} / {snap.storageKey}
      </p>
      <ul className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
        <li>count: {snap.count} / {snap.policyLimit}</li>
        <li>window start: {snap.windowStartIso ?? 'n/a'}</li>
        <li>window expires: {snap.windowExpiresIso ?? 'n/a'}</li>
        <li>blocked: {snap.blocked ? 'yes' : 'no'}</li>
      </ul>
      {!confirming ? (
        <button
          type="button"
          data-testid="internal-ai-usage-reset-button"
          className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200"
          onClick={() => setConfirming(true)}
        >
          Reset AI test usage
        </button>
      ) : (
        <div className="space-y-2 rounded-md border border-amber-600/30 bg-amber-500/5 p-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Clear only the local AI safety-cap counter (`cvpro-ai-usage`). Saved CVs,
            Cover Letters, Pro entitlement, and other preferences are not changed.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="internal-ai-usage-reset-confirm"
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
              onClick={() => {
                const result = resetProAiTestUsageLedger();
                setConfirming(false);
                refresh();
                if (result.ok) {
                  toast.success('AI test usage counter cleared.');
                } else {
                  toast.error(`AI test reset failed (${result.reason}).`);
                }
              }}
            >
              Confirm clear local counter
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
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
  // Evaluate once per open so production builds never mount reset UI.
  const showInternalReset = isInternalAiResetEnabled();

  useEffect(() => {
    if (!open) return;
    const pdf = getLatestCvExportDiagnostic('pdf');
    const docx = getLatestCvExportDiagnostic('docx');
    setJson(JSON.stringify({ pdf, docx }, null, 2));
    setPanelTick((n) => n + 1);
  }, [open]);

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
        {showInternalReset ? <InternalAiUsageResetPanel refreshToken={panelTick} /> : null}
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
