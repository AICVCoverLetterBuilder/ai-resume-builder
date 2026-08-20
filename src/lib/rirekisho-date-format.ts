/**
 * Rirekisho keeps its native Japanese range notation independent from the
 * western CV templates. A separator is meaningful only when both sides of a
 * non-current range exist.
 */
export function formatRirekishoDateRange(
  startDate?: string,
  endDate?: string,
  isPresent?: boolean,
): string {
  const start = String(startDate || '').trim();
  const end = String(endDate || '').trim();
  if (isPresent) return start ? `${start}〜現在` : '現在';
  if (start && end) return `${start}〜${end}`;
  return start || end;
}
