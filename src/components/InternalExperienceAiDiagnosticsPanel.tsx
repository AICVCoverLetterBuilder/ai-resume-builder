'use client';

/**
 * Internal-only Experience AI diagnostics UI. Imported only from the
 * compile-time enabled branch of CvExportDiagnosticsControls so production
 * DCE can drop this chunk (and its marker strings) from disabled builds.
 */
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  copyExperienceAiDiagnosticsToClipboard,
  getLatestExperienceAiDiagnostic,
  summarizeExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';
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

export function InternalExperienceAiDiagnosticsPanel({
  refreshToken,
}: {
  refreshToken: number;
}) {
  const [summary, setSummary] = useState<ReturnType<typeof summarizeExperienceAiDiagnostic>>(null);

  useEffect(() => {
    setSummary(summarizeExperienceAiDiagnostic(getLatestExperienceAiDiagnostic()));
  }, [refreshToken]);

  const onCopy = useCallback(async () => {
    const ok = await copyExperienceAiDiagnosticsToClipboard();
    toast[ok ? 'success' : 'error'](
      ok ? EXPERIENCE_AI_COPY_OK : EXPERIENCE_AI_COPY_FAIL,
    );
  }, []);

  return (
    <div
      className="mb-4 border-b border-border pb-4"
      data-testid="experience-ai-diagnostics-section"
    >
      <span className="sr-only">{EXPERIENCE_AI_TRACE_BUNDLE_MARKER}</span>
      <span className="sr-only">{EXPERIENCE_AI_FIELD_FINAL_REASON}</span>
      <span className="sr-only">{EXPERIENCE_AI_FIELD_SOURCE_KIND}</span>
      <span className="sr-only">{EXPERIENCE_AI_FIELD_FALLBACK_COVERED}</span>
      <h3 className="text-sm font-semibold">{EXPERIENCE_AI_SECTION_TITLE}</h3>
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
            <dt className="inline font-medium text-foreground">countedAsSuccess: </dt>
            <dd className="inline">{String(summary.countedAsSuccess)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No Experience AI attempt recorded yet. Run AI Improvements on Experience once.
        </p>
      )}
      <button
        type="button"
        data-testid="experience-ai-diagnostics-copy"
        className="mt-3 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto"
        onClick={onCopy}
      >
        {EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL}
      </button>
    </div>
  );
}

export function InternalExperienceAiCopyLink() {
  const [hasTrace, setHasTrace] = useState(false);

  useEffect(() => {
    setHasTrace(Boolean(getLatestExperienceAiDiagnostic()));
    const id = window.setInterval(() => {
      setHasTrace(Boolean(getLatestExperienceAiDiagnostic()));
    }, 800);
    return () => window.clearInterval(id);
  }, []);

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
