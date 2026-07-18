/**
 * Dynamic source-fact identities for Experience preservation.
 * Required facts are derived from user-authored units — not occupation catalogues.
 */
import { splitExperienceBullets } from './cv-canonical-facts';
import {
  applyEnglishEmploymentTense,
  validateDistinctExperienceBullets,
  validateNoExtraGeneratedDuties,
  materialDutyKeysFromDescription,
  validateMaterialDutyCoverage,
} from './cv-material-duty-coverage';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'by',
  'at', 'from', 'as', 'into', 'their', 'them', 'they', 'this', 'that', 'when',
  'while', 'during', 'using', 'via', 'per', 'sam', 'sa', 'za', 'na', 'i', 'u',
  'je', 'se', 'the', 'are', 'was', 'were', 'be', 'been', 'is', 'am',
]);

/** Split authoritative Experience text into ordered source duty units. */
export function extractSourceDutyUnits(description: string): string[] {
  let units = splitExperienceBullets(description || '')
    .map((l) => l.replace(/^[•\-\*\u2022]\s*/u, '').trim())
    .filter(Boolean);
  if (units.length <= 1 && (description || '').trim()) {
    const block = (description || '').replace(/^[•\-\*\u2022]\s*/u, '').trim();
    const sentenced = block
      .split(/(?<=[.!?।])\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 8);
    if (sentenced.length > 1) units = sentenced;
    else if (block) units = [block];
  }
  return units;
}

export function normalizeSourceFactText(text: string): string {
  return (text || '')
    .normalize('NFKC')
    .replace(/^[•\-\*\u2022]\s*/u, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function contentTokensFromDuty(text: string): string[] {
  return normalizeSourceFactText(text)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Stable non-PII identity from normalized semantic content (FNV-1a 32-bit). */
export function sourceFactIdentityId(unit: string): string {
  const norm = normalizeSourceFactText(unit);
  let hash = 0x811c9dc5;
  for (let i = 0; i < norm.length; i += 1) {
    hash ^= norm.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sf_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export type SourceFactIdentity = {
  id: string;
  unit: string;
  normalized: string;
  tokens: string[];
};

export function sourceFactIdentitiesFromDescription(description: string): SourceFactIdentity[] {
  const seen = new Set<string>();
  const out: SourceFactIdentity[] = [];
  for (const unit of extractSourceDutyUnits(description)) {
    const id = sourceFactIdentityId(unit);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      unit,
      normalized: normalizeSourceFactText(unit),
      tokens: contentTokensFromDuty(unit),
    });
  }
  return out;
}

function tokenCoverageRatio(required: string[], haystack: string): number {
  if (!required.length) return 1;
  const hay = normalizeSourceFactText(haystack);
  let hit = 0;
  for (const t of required) {
    if (hay.includes(t)) hit += 1;
  }
  return hit / required.length;
}

export type SourceFactIdentityCoverage = {
  ok: boolean;
  requiredIds: string[];
  coveredIds: string[];
  missingIds: string[];
  duplicatedIds: string[];
  reason?: 'experience_material_fact_coverage_incomplete';
};

/**
 * Best-effort bipartite match: each source identity ↔ at most one candidate bullet.
 * Greedy by token-overlap score so shared words (e.g. "features") do not collapse
 * two duties onto one line.
 */
export function validateSourceFactIdentityCoverage(
  sourceDescription: string,
  candidateDescription: string,
): SourceFactIdentityCoverage {
  const required = sourceFactIdentitiesFromDescription(sourceDescription);
  const requiredIds = required.map((r) => r.id);
  if (!required.length) {
    return { ok: true, requiredIds: [], coveredIds: [], missingIds: [], duplicatedIds: [] };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  type Pair = { ri: number; bi: number; score: number };
  const pairs: Pair[] = [];
  for (let ri = 0; ri < required.length; ri += 1) {
    for (let bi = 0; bi < bullets.length; bi += 1) {
      const tokens = required[ri].tokens.filter((t) => t.length >= 4);
      const score = tokenCoverageRatio(tokens.length ? tokens : required[ri].tokens, bullets[bi]);
      if (score >= 0.5) pairs.push({ ri, bi, score });
      else {
        const keys = materialDutyKeysFromDescription(required[ri].unit)
          .filter((k) => k !== 'generic_duty');
        if (keys.length && validateMaterialDutyCoverage(required[ri].unit, bullets[bi]).valid) {
          pairs.push({ ri, bi, score: 0.55 });
        }
      }
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const usedR = new Set<number>();
  const usedB = new Set<number>();
  const coveredIds: string[] = [];
  for (const p of pairs) {
    if (usedR.has(p.ri) || usedB.has(p.bi)) continue;
    usedR.add(p.ri);
    usedB.add(p.bi);
    coveredIds.push(required[p.ri].id);
  }

  const missingIds = requiredIds.filter((id) => !coveredIds.includes(id));
  const dup = validateDistinctExperienceBullets(candidateDescription);
  if (!dup.ok && required.length >= 2) {
    return {
      ok: false,
      requiredIds,
      coveredIds,
      missingIds: requiredIds.filter((id) => !coveredIds.includes(id)),
      duplicatedIds: requiredIds,
      reason: 'experience_material_fact_coverage_incomplete',
    };
  }

  const ok = missingIds.length === 0;
  return {
    ok,
    requiredIds,
    coveredIds,
    missingIds,
    duplicatedIds: [],
    reason: ok ? undefined : 'experience_material_fact_coverage_incomplete',
  };
}

/**
 * Whether an optional template/shell is at least as faithful as keeping the source.
 * Templates must not invent extras and must cover most source content tokens
 * (same-script) or material keys (when registered).
 */
export function optionalTemplatePreservesSourceUnit(
  sourceUnit: string,
  templateLine: string,
): boolean {
  if (!templateLine.trim()) return false;
  if (!validateNoExtraGeneratedDuties(sourceUnit, templateLine).valid) return false;
  const tokens = contentTokensFromDuty(sourceUnit);
  if (!tokens.length) return true;

  const templateHasDevanagari = /\p{Script=Devanagari}/u.test(templateLine);
  const sourceHasDevanagari = /\p{Script=Devanagari}/u.test(sourceUnit);
  const sameLatin = !templateHasDevanagari && !sourceHasDevanagari;

  // Same-script: token overlap is the primary fidelity signal. Material keys alone
  // are too coarse (e.g. "field reports" → reporting ≠ "Analyze business data").
  if (sameLatin) {
    const coverage = tokenCoverageRatio(tokens, templateLine);
    if (coverage < 0.45) return false;
    const distinctive = tokens.filter((t) => t.length >= 5);
    if (distinctive.length >= 2 && tokenCoverageRatio(distinctive, templateLine) < 0.7) {
      return false;
    }
    return true;
  }

  const keys = materialDutyKeysFromDescription(sourceUnit).filter((k) => k !== 'generic_duty');
  if (keys.length && validateMaterialDutyCoverage(sourceUnit, templateLine).valid) {
    return true;
  }
  return false;
}

/**
 * Universal source-unit fallback: preserve meaning + apply structured tense.
 * Does not require occupation categories or catalogues.
 */
export function universalPreserveSourceUnit(
  sourceUnit: string,
  options?: { isPresent?: boolean },
): string {
  const raw = (sourceUnit || '').replace(/^[•\-\*\u2022]\s*/u, '').trim();
  if (!raw) return '';
  return applyEnglishEmploymentTense(raw, Boolean(options?.isPresent));
}
