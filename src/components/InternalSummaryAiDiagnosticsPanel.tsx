'use client';

/**
 * Internal-only Summary AI diagnostics UI. Same DCE pattern as Experience panel.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  copySummaryAiDiagnosticsToClipboard,
  getLatestSummaryAiDiagnostic,
  summarizeSummaryAiDiagnostic,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  SUMMARY_AI_COPY_DIAGNOSTICS_LABEL,
  SUMMARY_AI_COPY_FAIL,
  SUMMARY_AI_COPY_OK,
  SUMMARY_AI_SECTION_TITLE,
  SUMMARY_AI_TRACE_BUNDLE_MARKER,
} from '@/lib/build-channel';

export {
  SUMMARY_AI_TRACE_BUNDLE_MARKER,
  SUMMARY_AI_COPY_DIAGNOSTICS_LABEL,
  SUMMARY_AI_SECTION_TITLE,
  SUMMARY_AI_COPY_OK,
  SUMMARY_AI_COPY_FAIL,
};

export function InternalSummaryAiDiagnosticsPanel({
  refreshToken,
}: {
  refreshToken: number;
}) {
  const [summary, setSummary] = useState<ReturnType<typeof summarizeSummaryAiDiagnostic>>(null);

  useEffect(() => {
    setSummary(summarizeSummaryAiDiagnostic(getLatestSummaryAiDiagnostic()));
  }, [refreshToken]);

  const onCopy = useCallback(async () => {
    const ok = await copySummaryAiDiagnosticsToClipboard();
    toast[ok ? 'success' : 'error'](
      ok ? SUMMARY_AI_COPY_OK : SUMMARY_AI_COPY_FAIL,
    );
  }, []);

  return (
    <div
      className="mb-4 border-b border-border pb-4"
      data-testid="summary-ai-diagnostics-section"
    >
      <span className="sr-only">{SUMMARY_AI_TRACE_BUNDLE_MARKER}</span>
      <h3 className="text-sm font-semibold">{SUMMARY_AI_SECTION_TITLE}</h3>
      {summary ? (
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">timestamp: </dt>
            <dd className="inline">{summary.timestamp}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">locale: </dt>
            <dd className="inline">{summary.locale}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">duration count: </dt>
            <dd className="inline">{summary.durationCount}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">typed failure reason: </dt>
            <dd className="inline">{summary.typedFailureReason}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">applied: </dt>
            <dd className="inline">{summary.applied ? 'yes' : 'no'}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No Summary AI attempt recorded yet.
        </p>
      )}
      <button
        type="button"
        data-testid="summary-ai-diagnostics-copy"
        className="mt-3 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
        onClick={onCopy}
      >
        {SUMMARY_AI_COPY_DIAGNOSTICS_LABEL}
      </button>
    </div>
  );
}

export function InternalSummaryAiCopyLink() {
  const [hasTrace, setHasTrace] = useState(false);

  useEffect(() => {
    setHasTrace(Boolean(getLatestSummaryAiDiagnostic()));
    const id = window.setInterval(() => {
      setHasTrace(Boolean(getLatestSummaryAiDiagnostic()));
    }, 800);
    return () => window.clearInterval(id);
  }, []);

  if (!hasTrace) return null;

  return (
    <button
      type="button"
      data-testid="summary-ai-copy-diagnostics"
      className="mt-2 block text-xs font-medium text-amber-800 underline underline-offset-2 dark:text-amber-300"
      onClick={async () => {
        const ok = await copySummaryAiDiagnosticsToClipboard();
        toast[ok ? 'success' : 'error'](
          ok ? SUMMARY_AI_COPY_OK : SUMMARY_AI_COPY_FAIL,
        );
      }}
    >
      {SUMMARY_AI_COPY_DIAGNOSTICS_LABEL}
    </button>
  );
}
