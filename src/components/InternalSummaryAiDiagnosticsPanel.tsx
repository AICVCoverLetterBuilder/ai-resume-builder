'use client';

/**
 * Internal-only Summary AI diagnostics UI. Same DCE pattern as Experience panel.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  clearSummaryAiDiagnostics,
  copySummaryAiDiagnosticsToClipboard,
  getLatestSummaryAiDiagnostic,
  summarizeSummaryAiDiagnostic,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  getCvAiDiagnosticHistory,
} from '@/lib/cv-ai-diagnostics-contract';
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
  const [full, setFull] = useState(getLatestSummaryAiDiagnostic());
  const [history, setHistory] = useState(() => getCvAiDiagnosticHistory('summary'));

  useEffect(() => {
    const latest = getLatestSummaryAiDiagnostic();
    setFull(latest);
    setSummary(summarizeSummaryAiDiagnostic(latest));
    setHistory(getCvAiDiagnosticHistory('summary'));
  }, [refreshToken]);

  const onCopy = useCallback(async () => {
    const ok = await copySummaryAiDiagnosticsToClipboard();
    toast[ok ? 'success' : 'error'](
      ok ? SUMMARY_AI_COPY_OK : SUMMARY_AI_COPY_FAIL,
    );
  }, []);

  const onClear = useCallback(() => {
    clearSummaryAiDiagnostics();
    setFull(null);
    setSummary(null);
    toast.success('Summary diagnostics cleared');
  }, []);

  const onClearHistory = useCallback(() => {
    clearCvAiDiagnosticHistory('summary');
    setHistory([]);
    toast.success('Summary diagnostic history cleared');
  }, []);

  const warnings: string[] = [];
  if (full) {
    if (full.diagnosticInvariantCheckPassed === false) warnings.push('invariant check failed');
    if (full.diagnosticCompletenessPassed === false) warnings.push('completeness check failed');
    if (full.visibleApplySucceeded === false && full.countedAsSuccess) {
      warnings.push('final apply failed');
    }
    if ((full.wrongLocaleUnitCount || 0) > 0) warnings.push('wrong locale');
    if ((full.unsupportedClaimCount || 0) > 0) warnings.push('unsupported claim');
    if ((full.usageCountAfter ?? 0) !== (full.usageCountBefore ?? 0) + (full.countedAsSuccess ? 1 : 0)) {
      warnings.push('usage mismatch');
    }
  }

  return (
    <div
      className="mb-4 border-b border-border pb-4"
      data-testid="summary-ai-diagnostics-section"
    >
      <span className="sr-only">{SUMMARY_AI_TRACE_BUNDLE_MARKER}</span>
      <span className="sr-only">cv-ai-diagnostics-v2</span>
      <h3 className="text-sm font-semibold">{SUMMARY_AI_SECTION_TITLE}</h3>
      {warnings.length > 0 && (
        <p
          className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300"
          data-testid="summary-ai-diagnostics-warnings"
        >
          Warning: {warnings.join('; ')}
        </p>
      )}
      {summary ? (
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">operation: </dt>
            <dd className="inline">summary</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">timestamp: </dt>
            <dd className="inline">{summary.timestamp}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">success: </dt>
            <dd className="inline">{summary.success ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">final candidate source: </dt>
            <dd className="inline">{summary.finalCandidateSource || 'n/a'}</dd>
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
            <dt className="inline font-medium text-foreground">independent final duration: </dt>
            <dd className="inline">{summary.independentFinalDurationClaimCount}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">visible duration after apply: </dt>
            <dd className="inline">{summary.visibleDurationClaimCountAfterApply ?? 'n/a'}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">duration validation: </dt>
            <dd className="inline">{summary.durationValidationPassed ? 'pass' : 'fail'}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">race guard: </dt>
            <dd className="inline">{summary.raceGuardResult}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">typed failure reason: </dt>
            <dd className="inline">{summary.typedFailureReason}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">invariant: </dt>
            <dd className="inline">
              {summary.invariantPassed == null ? 'n/a' : (summary.invariantPassed ? 'pass' : 'fail')}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">completeness: </dt>
            <dd className="inline">
              {summary.completenessPassed == null
                ? 'n/a'
                : (summary.completenessPassed ? 'pass' : 'fail')}
            </dd>
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
      {history.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground" data-testid="summary-ai-diag-history">
          <p className="font-medium text-foreground">Recent Summary ops ({history.length}/5)</p>
          <ul className="mt-1 list-disc pl-4">
            {history.map((h) => (
              <li key={`${h.timestamp}-${h.requestIdHash}`}>
                {h.timestamp.slice(0, 19)} · {h.targetLocale} · {h.success ? 'ok' : 'fail'} ·{' '}
                {h.finalCandidateSource || 'n/a'}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        data-testid="summary-ai-diagnostics-copy"
        className="mt-3 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
        onClick={onCopy}
      >
        {SUMMARY_AI_COPY_DIAGNOSTICS_LABEL}
      </button>
      <button
        type="button"
        data-testid="summary-ai-diagnostics-clear"
        className="mt-2 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
        onClick={onClear}
      >
        Clear diagnostics
      </button>
      <button
        type="button"
        data-testid="summary-ai-diagnostics-clear-history"
        className="mt-2 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
        onClick={onClearHistory}
      >
        Clear diagnostic history
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
