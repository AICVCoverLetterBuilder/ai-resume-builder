'use client';

/**
 * Internal-only Experience AI diagnostics UI. Imported only from the
 * compile-time enabled branch of CvExportDiagnosticsControls so production
 * DCE can drop this chunk (and its marker strings) from disabled builds.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  clearExperienceAiDiagnostics,
  copyExperienceAiDiagnosticsToClipboard,
  getLatestExperienceAiDiagnostic,
  summarizeExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  getCvAiDiagnosticHistory,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER,
  getCvAiDiagnosticsLifecycleRevision,
  subscribeCvAiDiagnosticsChanged,
} from '@/lib/cv-ai-diagnostics-lifecycle';
import {
  EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL,
  EXPERIENCE_AI_COPY_FAIL,
  EXPERIENCE_AI_COPY_OK,
  EXPERIENCE_AI_FIELD_FALLBACK_COVERED,
  EXPERIENCE_AI_FIELD_FINAL_REASON,
  EXPERIENCE_AI_FIELD_SOURCE_KIND,
  EXPERIENCE_AI_SECTION_TITLE,
  EXPERIENCE_AI_TRACE_BUNDLE_MARKER,
} from '@/lib/build-channel';

export {
  EXPERIENCE_AI_TRACE_BUNDLE_MARKER,
  EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL,
  EXPERIENCE_AI_SECTION_TITLE,
  EXPERIENCE_AI_COPY_OK,
  EXPERIENCE_AI_COPY_FAIL,
};

function subscribeExperienceDiagnostics(onStoreChange: () => void): () => void {
  return subscribeCvAiDiagnosticsChanged(onStoreChange, { kind: 'experience' });
}

function getExperienceDiagnosticsRevision(): number {
  return getCvAiDiagnosticsLifecycleRevision();
}

export function InternalExperienceAiDiagnosticsPanel({
  refreshToken,
}: {
  refreshToken: number;
}) {
  const rev = useSyncExternalStore(
    subscribeExperienceDiagnostics,
    getExperienceDiagnosticsRevision,
    () => 0,
  );
  const full = useMemo(() => {
    void refreshToken;
    void rev;
    return getLatestExperienceAiDiagnostic();
  }, [refreshToken, rev]);
  const summary = useMemo(() => summarizeExperienceAiDiagnostic(full), [full]);
  const history = useMemo(() => {
    void rev;
    void refreshToken;
    return getCvAiDiagnosticHistory('experience');
  }, [rev, refreshToken]);

  const onCopy = useCallback(async () => {
    const ok = await copyExperienceAiDiagnosticsToClipboard();
    toast[ok ? 'success' : 'error'](
      ok ? EXPERIENCE_AI_COPY_OK : EXPERIENCE_AI_COPY_FAIL,
    );
  }, []);

  const onClear = useCallback(() => {
    clearExperienceAiDiagnostics();
    toast.success('Experience diagnostics cleared');
  }, []);

  const onClearHistory = useCallback(() => {
    clearCvAiDiagnosticHistory('experience');
    toast.success('Experience diagnostic history cleared');
  }, []);

  const warnings: string[] = [];
  if (full) {
    if (full.diagnosticInvariantCheckPassed === false) warnings.push('invariant check failed');
    if (full.diagnosticCompletenessPassed === false) warnings.push('completeness check failed');
    if (full.visibleApplySucceeded === false && full.countedAsSuccess) {
      warnings.push('final apply failed');
    }
    if (full.stableEntryIdentityMatched === false) warnings.push('target entry mismatch');
    if ((full.wrongLocaleBulletCount || 0) > 0) warnings.push('wrong locale');
    if ((full.unsupportedClaimCount || 0) > 0) warnings.push('unsupported claim');
    if ((full.usageCountAfter ?? 0) !== (full.usageCountBefore ?? 0) + (full.countedAsSuccess ? 1 : 0)) {
      warnings.push('usage mismatch');
    }
  }

  return (
    <div
      className="mb-4 border-b border-border pb-4"
      data-testid="experience-ai-diagnostics-section"
    >
      <span className="sr-only">{EXPERIENCE_AI_TRACE_BUNDLE_MARKER}</span>
      <span className="sr-only">{EXPERIENCE_AI_FIELD_FINAL_REASON}</span>
      <span className="sr-only">{EXPERIENCE_AI_FIELD_SOURCE_KIND}</span>
      <span className="sr-only">{EXPERIENCE_AI_FIELD_FALLBACK_COVERED}</span>
      <span className="sr-only">cv-ai-diagnostics-v2</span>
      <span className="sr-only">{CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER}</span>
      <h3 className="text-sm font-semibold">{EXPERIENCE_AI_SECTION_TITLE}</h3>
      {warnings.length > 0 && (
        <p
          className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300"
          data-testid="experience-ai-diagnostics-warnings"
        >
          Warning: {warnings.join('; ')}
        </p>
      )}
      {summary ? (
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>
            <dt className="inline font-medium text-foreground">operation: </dt>
            <dd className="inline">experience</dd>
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
            <dt className="inline font-medium text-foreground">final stage: </dt>
            <dd className="inline">{summary.finalStage}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">typed failure reason: </dt>
            <dd className="inline">{summary.typedFailureReason}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">source unit count: </dt>
            <dd className="inline">{summary.sourceUnitCount}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">required/covered: </dt>
            <dd className="inline">{summary.requiredCovered}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">provider/fallback bullets: </dt>
            <dd className="inline">{summary.providerFallbackCounts}</dd>
          </div>
          <div>
            <dt className="inline font-medium text-foreground">final scripts: </dt>
            <dd className="inline">{summary.finalScripts}</dd>
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
            <dt className="inline font-medium text-foreground">countedAsSuccess: </dt>
            <dd className="inline">{String(summary.countedAsSuccess)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No Experience AI attempt recorded yet. Run AI Improvements on Experience once.
        </p>
      )}
      {history.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground" data-testid="experience-ai-diag-history">
          <p className="font-medium text-foreground">Recent Experience ops ({history.length}/5)</p>
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
      {full ? (
        <button
          type="button"
          data-testid="experience-ai-diagnostics-copy"
          className="mt-3 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
          onClick={onCopy}
        >
          {EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL}
        </button>
      ) : null}
      <button
        type="button"
        data-testid="experience-ai-diagnostics-clear"
        className="mt-2 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
        onClick={onClear}
      >
        Clear diagnostics
      </button>
      <button
        type="button"
        data-testid="experience-ai-diagnostics-clear-history"
        className="mt-2 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
        onClick={onClearHistory}
      >
        Clear diagnostic history
      </button>
    </div>
  );
}

export function InternalExperienceAiCopyLink() {
  const rev = useSyncExternalStore(
    subscribeExperienceDiagnostics,
    getExperienceDiagnosticsRevision,
    () => 0,
  );
  const hasTrace = useMemo(() => {
    void rev;
    return Boolean(getLatestExperienceAiDiagnostic());
  }, [rev]);

  if (!hasTrace) return null;

  return (
    <button
      type="button"
      data-testid="experience-ai-copy-diagnostics"
      className="mt-2 block text-xs font-medium text-amber-800 underline underline-offset-2 dark:text-amber-300"
      onClick={async () => {
        const ok = await copyExperienceAiDiagnosticsToClipboard();
        toast[ok ? 'success' : 'error'](
          ok ? EXPERIENCE_AI_COPY_OK : EXPERIENCE_AI_COPY_FAIL,
        );
      }}
    >
      {EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL}
    </button>
  );
}
