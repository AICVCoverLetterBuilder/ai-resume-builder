/**
 * Same-window + cross-window notification for CV AI diagnostics storage.
 * CustomEvent detail is intentionally non-PII (kind/action/timestamp only).
 */

export const CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER = 'internal-diagnostics-lifecycle-v1' as const;

export const CV_AI_DIAGNOSTICS_CHANGED_EVENT = 'cvpro-cv-ai-diagnostics-changed' as const;

/** Canonical latest-record + history keys. */
export const SUMMARY_AI_DIAG_STORAGE_KEY = 'cvpro-summary-ai-diag-v1' as const;
export const EXPERIENCE_AI_DIAG_STORAGE_KEY = 'cvpro-experience-ai-diag-v1' as const;
/** Must match `CV_AI_DIAG_HISTORY_STORAGE_KEY` in cv-ai-diagnostics-contract.ts */
export const CV_AI_DIAG_HISTORY_STORAGE_KEY_LIFECYCLE = 'cvpro-cv-ai-diag-history-v1' as const;

export type CvAiDiagnosticsKind = 'summary' | 'experience';
export type CvAiDiagnosticsChangedAction = 'commit' | 'clear_latest' | 'clear_history';

export type CvAiDiagnosticsChangedDetail = {
  kind: CvAiDiagnosticsKind;
  action: CvAiDiagnosticsChangedAction;
  at: string;
};

let revision = 0;

/** Retain marker for asset verification (internal builds). */
export const CV_AI_DIAGNOSTICS_LIFECYCLE_ASSET_STRINGS = [
  CV_AI_DIAGNOSTICS_LIFECYCLE_MARKER,
  CV_AI_DIAGNOSTICS_CHANGED_EVENT,
  'clear_latest',
  'clear_history',
  'Copy Summary AI diagnostics',
  'Copy Experience AI diagnostics',
  'Clear diagnostics',
  'Clear diagnostic history',
] as const;
void CV_AI_DIAGNOSTICS_LIFECYCLE_ASSET_STRINGS;

export function getCvAiDiagnosticsLifecycleRevision(): number {
  return revision;
}

export function emitCvAiDiagnosticsChanged(
  detail: Omit<CvAiDiagnosticsChangedDetail, 'at'> & { at?: string },
): void {
  revision += 1;
  if (typeof window === 'undefined') return;
  const payload: CvAiDiagnosticsChangedDetail = {
    kind: detail.kind,
    action: detail.action,
    at: detail.at || new Date().toISOString(),
  };
  try {
    window.dispatchEvent(
      new CustomEvent<CvAiDiagnosticsChangedDetail>(CV_AI_DIAGNOSTICS_CHANGED_EVENT, {
        detail: payload,
      }),
    );
  } catch {
    /* ignore */
  }
}

function storageKeyForKind(kind: CvAiDiagnosticsKind): string {
  return kind === 'summary' ? SUMMARY_AI_DIAG_STORAGE_KEY : EXPERIENCE_AI_DIAG_STORAGE_KEY;
}

export function subscribeCvAiDiagnosticsChanged(
  onStoreChange: () => void,
  filter?: { kind?: CvAiDiagnosticsKind },
): () => void {
  if (typeof window === 'undefined') return () => {};

  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent<CvAiDiagnosticsChangedDetail>).detail;
    if (filter?.kind && detail?.kind !== filter.kind) return;
    onStoreChange();
  };

  const onStorage = (event: StorageEvent) => {
    if (!event.key) return;
    if (event.key === CV_AI_DIAG_HISTORY_STORAGE_KEY_LIFECYCLE) {
      onStoreChange();
      return;
    }
    if (filter?.kind) {
      if (event.key !== storageKeyForKind(filter.kind)) return;
    } else if (
      event.key !== SUMMARY_AI_DIAG_STORAGE_KEY
      && event.key !== EXPERIENCE_AI_DIAG_STORAGE_KEY
    ) {
      return;
    }
    onStoreChange();
  };

  window.addEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onCustom as EventListener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onCustom as EventListener);
    window.removeEventListener('storage', onStorage);
  };
}
