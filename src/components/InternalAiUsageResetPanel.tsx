'use client';

/**
 * Internal-only AI usage reset panel. Imported only from the compile-time
 * enabled branch of CvExportDiagnosticsControls so production DCE can drop it.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  INTERNAL_AI_RESET_BUNDLE_MARKER,
  INTERNAL_AI_RESET_CHANNEL_LABEL,
  INTERNAL_AI_RESET_STATUS_LABEL,
} from '@/lib/build-channel';
import {
  getProAiUsageDiagnosticsSnapshot,
  resetProAiTestUsageLedger,
  type ProAiUsageDiagnosticsSnapshot,
} from '@/lib/ai-usage-policy';

export function InternalAiUsageResetPanel({
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

  const confirmDialog = confirming && typeof document !== 'undefined'
    ? createPortal(
      <div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-label="Confirm AI test usage reset"
        data-testid="internal-ai-usage-reset-confirm-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) setConfirming(false);
        }}
      >
        <div
          className="w-full max-w-sm rounded-xl border border-border bg-background p-4 shadow-lg pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-sm font-semibold">Reset AI test usage?</h3>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Clear only the local AI safety-cap counter (`cvpro-ai-usage`). Saved CVs,
            Cover Letters, Pro entitlement, and other preferences are not changed.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              className="min-h-11 rounded-md border border-border px-4 py-2 text-sm pointer-events-auto"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="internal-ai-usage-reset-confirm"
              className="min-h-11 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white pointer-events-auto"
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
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div
      className="space-y-3 pointer-events-auto"
      data-testid="internal-ai-usage-reset-panel"
    >
      <p className="text-[10px] font-mono text-muted-foreground">{INTERNAL_AI_RESET_CHANNEL_LABEL}</p>
      <p className="text-[10px] font-mono text-muted-foreground">{INTERNAL_AI_RESET_STATUS_LABEL}</p>
      <span className="sr-only">{INTERNAL_AI_RESET_BUNDLE_MARKER}</span>
      <h3 className="text-xs font-semibold">Internal AI test usage</h3>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Storage: {snap.storageBackend} / {snap.storageKey}
      </p>
      <ul className="text-[10px] text-muted-foreground space-y-0.5 font-mono">
        <li data-testid="internal-ai-usage-count">count: {snap.count} / {snap.policyLimit}</li>
        <li>window start: {snap.windowStartIso ?? 'n/a'}</li>
        <li>window expires: {snap.windowExpiresIso ?? 'n/a'}</li>
        <li>blocked: {snap.blocked ? 'yes' : 'no'}</li>
      </ul>
      <button
        type="button"
        data-testid="internal-ai-usage-reset-button"
        className="min-h-11 w-full touch-manipulation rounded-md border border-amber-600/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-900 pointer-events-auto dark:text-amber-200"
        style={{ WebkitTapHighlightColor: 'transparent' }}
        onClick={() => setConfirming(true)}
      >
        Reset AI test usage
      </button>
      {confirmDialog}
    </div>
  );
}
