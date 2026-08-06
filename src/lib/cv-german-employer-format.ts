/**
 * Shared German employer formatting.
 * Keeps the employer string byte-for-byte apart from whitespace normalization
 * and adds the natural `bei` preposition when no preposition is already present.
 */
export function formatGermanEmployerPrepositional(employer: string): string | null {
  const company = (employer || '').replace(/\s+/g, ' ').trim();
  if (!company) return null;
  if (/^(?:bei|in|im|am)\s+/iu.test(company)) return company;
  return `bei ${company}`;
}
