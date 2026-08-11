/**
 * Shared Summary current-role authority.
 *
 * Multiple entries may be marked current. The newest structured start month is
 * authoritative; source-array order is the deterministic tie-breaker and the
 * fallback when dates are absent or invalid. When no entry is current, the same
 * rule selects the most recent completed role.
 */
export const SUMMARY_CURRENT_ROLE_RESOLVER_REVISION =
  'summary-current-role-resolver-419-v1' as const;

type SummaryRoleCandidate = {
  isPresent?: boolean;
  startDate?: string;
};

export type SummaryCurrentRoleDateAuthority =
  | 'structured_year_month'
  | 'structured_year'
  | 'invalid_or_missing';

export type SummaryCurrentRoleRankingEvidence<T> = {
  entry: T;
  sourceIndex: number;
  dateAuthority: SummaryCurrentRoleDateAuthority;
  normalizedStartYear: number | null;
  normalizedStartMonth: number | null;
  comparisonKey: number | null;
  valid: boolean;
  rank: number;
  tieFallbackUsed: boolean;
  isWinner: boolean;
};

export type SummaryCurrentRoleResolution<T> = {
  selected: T | null;
  candidates: SummaryCurrentRoleRankingEvidence<T>[];
  currentCandidateCount: number;
  usedCurrentCandidates: boolean;
  tieRule: 'source_array_order';
  tieFallbackUsed: boolean;
};

function structuredStartDate(value: string | undefined): {
  authority: SummaryCurrentRoleDateAuthority;
  year: number | null;
  month: number | null;
  comparisonKey: number | null;
} {
  const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/u.exec(String(value || '').trim());
  if (!match) return { authority: 'invalid_or_missing', year: null, month: null, comparisonKey: null };
  const year = Number(match[1]);
  const month = Number(match[2] || '1');
  const day = match[3] == null ? null : Number(match[3]);
  if (
    !Number.isInteger(year)
    || year < 1900
    || year > 2200
    || !Number.isInteger(month)
    || month < 1
    || month > 12
    || (day != null && (!Number.isInteger(day) || day < 1 || day > 31))
  ) return { authority: 'invalid_or_missing', year: null, month: null, comparisonKey: null };
  return {
    authority: match[2] ? 'structured_year_month' : 'structured_year',
    year,
    month,
    comparisonKey: year * 12 + month,
  };
}

export function resolveSummaryCurrentRoleWithEvidence<T extends SummaryRoleCandidate>(
  entries: readonly T[],
): SummaryCurrentRoleResolution<T> {
  const indexed = entries.map((entry, sourceIndex) => ({
    entry,
    sourceIndex,
    parsed: structuredStartDate(entry.startDate),
  }));
  const current = indexed.filter(({ entry }) => entry.isPresent === true);
  const candidates = current.length > 0 ? current : indexed;
  const ranked = [...candidates].sort((a, b) => {
    if (
      a.parsed.comparisonKey != null
      && b.parsed.comparisonKey != null
      && a.parsed.comparisonKey !== b.parsed.comparisonKey
    ) return b.parsed.comparisonKey - a.parsed.comparisonKey;
    if (a.parsed.comparisonKey != null && b.parsed.comparisonKey == null) return -1;
    if (a.parsed.comparisonKey == null && b.parsed.comparisonKey != null) return 1;
    return a.sourceIndex - b.sourceIndex;
  });
  const winner = ranked[0] || null;
  const tieFallbackUsed = Boolean(winner && ranked.some((candidate, index) => (
    index > 0 && candidate.parsed.comparisonKey === winner.parsed.comparisonKey
  )));
  return {
    selected: winner?.entry || null,
    candidates: ranked.map((candidate, rank) => ({
      entry: candidate.entry,
      sourceIndex: candidate.sourceIndex,
      dateAuthority: candidate.parsed.authority,
      normalizedStartYear: candidate.parsed.year,
      normalizedStartMonth: candidate.parsed.month,
      comparisonKey: candidate.parsed.comparisonKey,
      valid: candidate.parsed.comparisonKey != null,
      rank: rank + 1,
      tieFallbackUsed: ranked.some((peer) => (
        peer !== candidate && peer.parsed.comparisonKey === candidate.parsed.comparisonKey
      )),
      isWinner: candidate === winner,
    })),
    currentCandidateCount: current.length,
    usedCurrentCandidates: current.length > 0,
    tieRule: 'source_array_order',
    tieFallbackUsed,
  };
}

export function resolveSummaryCurrentRole<T extends SummaryRoleCandidate>(
  entries: readonly T[],
): T | null {
  return resolveSummaryCurrentRoleWithEvidence(entries).selected;
}
