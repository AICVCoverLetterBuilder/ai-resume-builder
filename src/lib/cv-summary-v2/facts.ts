import type { SummaryV2EntryFact } from './types';

const STOP = new Set([
  'with', 'from', 'that', 'this', 'their', 'them', 'they', 'have', 'has', 'had',
  'were', 'into', 'onto', 'about', 'during', 'while', 'where', 'when', 'than',
  'then', 'also', 'and', 'the', 'for', 'are', 'was', 'part', 'work', 'role',
  'a', 'an', 'of', 'to', 'in', 'on', 'by', 'at', 'as', 'or',
]);

export function hashSummaryV2Text(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

export function splitLiveDutyBullets(text: string, limit = 12): string[] {
  return (text || '')
    .split(/\n+|;\s+|(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.replace(/^[•\-\*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 4)
    .slice(0, limit);
}

export function dutyTokenStems(bullet: string): string[] {
  return (bullet || '')
    .toLowerCase()
    .split(/[^a-z0-9\u0400-\u04FF\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]+/u)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function morphVariants(token: string): string[] {
  const t = (token || '').toLowerCase();
  const out = new Set<string>([t]);
  if (t.endsWith('ies') && t.length > 4) out.add(`${t.slice(0, -3)}y`);
  if (t.endsWith('ing') && t.length > 5) out.add(t.slice(0, -3));
  if (t.endsWith('ed') && t.length > 4) out.add(t.slice(0, -2));
  if (t.endsWith('es') && t.length > 4) out.add(t.slice(0, -2));
  if (t.endsWith('s') && t.length > 3) out.add(t.slice(0, -1));
  return [...out];
}

/**
 * Derive entry-owned facts from live Experience bullets only.
 * No warehouse/design occupation categories and no canonical/generated IDs.
 */
export function buildEntryOwnedFactsFromLiveDescription(options: {
  entryId: string;
  liveDescription: string;
}): SummaryV2EntryFact[] {
  const entryId = options.entryId || '';
  const bullets = splitLiveDutyBullets(options.liveDescription);
  return bullets.map((bullet) => {
    const stems = dutyTokenStems(bullet);
    const sourceFactHash = hashSummaryV2Text(`v2:${entryId}:${bullet}`);
    const factId = `v2_entry_${entryId || 'x'}_${sourceFactHash.replace(/^fnv1a_/, '')}`;
    return {
      factId,
      entryId,
      bulletText: bullet,
      tokenStems: stems,
      sourceFactHash,
    };
  });
}

export function factCoveredInText(fact: SummaryV2EntryFact, text: string): boolean {
  const corpus = (text || '').toLowerCase();
  if (!corpus) return false;
  const raw = fact.bulletText.replace(/[.;]+$/u, '').trim().toLowerCase();
  if (raw.length >= 8 && corpus.includes(raw)) return true;
  const deinflected = raw.replace(/\b(\p{L}+?)(?:es|s)\b/gu, (full, stem: string) => (
    stem.length >= 3 ? stem : full
  ));
  if (deinflected.length >= 8 && corpus.includes(deinflected)) return true;
  const tokens = fact.tokenStems;
  if (tokens.length === 0) return false;
  const hits = tokens.filter((t) => morphVariants(t).some((v) => corpus.includes(v))).length;
  return hits >= Math.min(2, tokens.length);
}
