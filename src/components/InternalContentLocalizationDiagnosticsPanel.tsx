'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import {
  clearContentLocalizeV3Diagnostics,
  copyContentLocalizeV3DiagnosticsToClipboard,
  getContentLocalizeV3DiagnosticHistory,
  getLatestContentLocalizeV3TerminalDiagnostic,
} from '@/lib/ai-core-v3/content-localize-v3-terminal-diagnostics';
import {
  getCvAiDiagnosticsLifecycleRevision,
  subscribeCvAiDiagnosticsChanged,
} from '@/lib/cv-ai-diagnostics-lifecycle';

function subscribe(onStoreChange: () => void): () => void {
  return subscribeCvAiDiagnosticsChanged(onStoreChange);
}
export function InternalContentLocalizationDiagnosticsPanel({ refreshToken }: { refreshToken: number }) {
  const revision = useSyncExternalStore(subscribe, getCvAiDiagnosticsLifecycleRevision, () => 0);
  const latest = useMemo(() => {
    void refreshToken;
    void revision;
    return getLatestContentLocalizeV3TerminalDiagnostic();
  }, [refreshToken, revision]);
  const history = useMemo(() => {
    void refreshToken;
    void revision;
    return getContentLocalizeV3DiagnosticHistory();
  }, [refreshToken, revision]);
  const onCopy = useCallback(async () => {
    const ok = await copyContentLocalizeV3DiagnosticsToClipboard();
    toast[ok ? 'success' : 'error'](ok ? 'Content Localization diagnostics copied' : 'Could not copy diagnostics');
  }, []);
  const onClear = useCallback(() => {
    clearContentLocalizeV3Diagnostics();
    toast.success('Content Localization diagnostics cleared');
  }, []);

  return (
    <div className="mb-4 border-b border-border pb-4" data-testid="content-localization-diagnostics-section">
      <span className="sr-only">CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC</span>
      <h3 className="text-sm font-semibold">Content localization diagnostics</h3>
      {latest ? (
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div><dt className="inline font-medium text-foreground">operation: </dt><dd className="inline">{latest.operation}</dd></div>
          <div><dt className="inline font-medium text-foreground">captured: </dt><dd className="inline">{latest.capturedAt}</dd></div>
          <div><dt className="inline font-medium text-foreground">locale: </dt><dd className="inline">{latest.sourceLocale} → {latest.targetLocale}</dd></div>
          <div><dt className="inline font-medium text-foreground">terminal result: </dt><dd className="inline">{latest.finalDecision}</dd></div>
          <div><dt className="inline font-medium text-foreground">HTTP: </dt><dd className="inline">{latest.routeHttpStatus ?? 'n/a'}</dd></div>
          <div><dt className="inline font-medium text-foreground">usage: </dt><dd className="inline">{latest.usageBefore} → {latest.usageAfter}</dd></div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No content localization operation recorded yet.</p>
      )}
      {history.length > 0 ? (
        <div className="mt-2 text-xs text-muted-foreground" data-testid="content-localization-diagnostics-history">
          <p className="font-medium text-foreground">Recent Content Localization ops ({history.length}/5)</p>
          <ul className="mt-1 list-disc pl-4">
            {history.map((item) => <li key={`${item.capturedAt}-${item.operation}`}>{item.capturedAt.slice(0, 19)} · {item.operation} · {item.sourceLocale} → {item.targetLocale} · {item.finalDecision} · {item.usageBefore} → {item.usageAfter}</li>)}
          </ul>
        </div>
      ) : null}
      {latest ? (
        <button type="button" data-testid="content-localization-diagnostics-copy" className="mt-3 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto" onClick={onCopy}>
          Copy Content Localization diagnostics
        </button>
      ) : null}
      <button type="button" data-testid="content-localization-diagnostics-clear" className="mt-2 min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-xs font-medium pointer-events-auto" onClick={onClear}>
        Clear Content Localization diagnostics
      </button>
    </div>
  );
}

export function InternalContentLocalizationCopyLink() {
  const revision = useSyncExternalStore(subscribe, getCvAiDiagnosticsLifecycleRevision, () => 0);
  const latest = useMemo(() => {
    void revision;
    return getLatestContentLocalizeV3TerminalDiagnostic();
  }, [revision]);
  if (!latest) return null;
  return <button type="button" data-testid="content-localization-ai-copy-diagnostics" className="mt-2 block text-xs font-medium text-amber-800 underline underline-offset-2 dark:text-amber-300" onClick={async () => {
    const ok = await copyContentLocalizeV3DiagnosticsToClipboard();
    toast[ok ? 'success' : 'error'](ok ? 'Content Localization diagnostics copied' : 'Could not copy diagnostics');
  }}>Copy Content Localization diagnostics</button>;
}
