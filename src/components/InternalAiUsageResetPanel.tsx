'use client';

/**
 * Internal-only AI usage reset panel. Imported only from the compile-time
 * enabled branch of CvExportDiagnosticsControls so production DCE can drop it.
 */
import { useCallback, useEffect, useState } from 'react';
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

  return (
    <div
      className="border-t border-border px-4 py-3 space-y-2"
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
