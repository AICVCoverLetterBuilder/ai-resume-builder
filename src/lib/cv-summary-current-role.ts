/**
 * Shared Summary current-role authority.
 *
 * Multiple entries may be marked current. The newest structured start month is
 * authoritative; source-array order is the deterministic tie-breaker and the
 * fallback when dates are absent or invalid. When no entry is current, the same
 * rule selects the most recent completed role.
 */
export const SUMMARY_CURRENT_ROLE_RESOLVER_REVISION =
  'summary-current-role-resolver-417-v1' as const;

type SummaryRoleCandidate = {
  isPresent?: boolean;
  startDate?: string;
};

function structuredStartMonth(value: string | undefined): number | null {
  const match = /^(\d{4})(?:-(\d{2}))?/u.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] || '1');
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return year * 12 + month;
}

export function resolveSummaryCurrentRole<T extends SummaryRoleCandidate>(
  entries: readonly T[],
): T | null {
  const indexed = entries.map((entry, index) => ({
    entry,
    index,
    startMonth: structuredStartMonth(entry.startDate),
  }));
  if (indexed.length === 0) return null;
  const current = indexed.filter(({ entry }) => entry.isPresent === true);
  const candidates = current.length > 0 ? current : indexed;
  candidates.sort((a, b) => {
    if (a.startMonth != null && b.startMonth != null && a.startMonth !== b.startMonth) {
      return b.startMonth - a.startMonth;
    }
    if (a.startMonth != null && b.startMonth == null) return -1;
    if (a.startMonth == null && b.startMonth != null) return 1;
    return a.index - b.index;
  });
  return candidates[0]?.entry || null;
}
