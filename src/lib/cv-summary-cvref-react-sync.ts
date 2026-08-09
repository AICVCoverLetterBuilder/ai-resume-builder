import type { CVData } from './types';

export const SUMMARY_CVREF_REACT_SYNC_REVISION =
  'summary-cvref-react-sync-411-v1' as const;

export type SummaryCvRefReactSyncResult = {
  accepted: boolean;
  reason:
    | 'accepted'
    | 'authoritative_summary_hash_mismatch';
};

export function syncCvRefFromReactState(options: {
  cvRef: { current: CVData };
  ownership: {
    authoritativeSummaryHash?: string | null;
  };
  nextCv: CVData;
  currentSummaryHash: string;
  nextSummaryHash: string;
}): SummaryCvRefReactSyncResult {
  const authoritativeHash =
    options.ownership.authoritativeSummaryHash;

  if (
    authoritativeHash
    && options.currentSummaryHash === authoritativeHash
    && options.nextSummaryHash !== authoritativeHash
  ) {
    return {
      accepted: false,
      reason:
        'authoritative_summary_hash_mismatch',
    };
  }

  options.cvRef.current = options.nextCv;

  return {
    accepted: true,
    reason: 'accepted',
  };
}
