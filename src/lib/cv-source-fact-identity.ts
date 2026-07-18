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

/** Strip leading list syntax only (bullets / numbered prefixes). */
export function stripDutyListPrefix(text: string): string {
  return (text || '')
    .replace(/^[•\-\u2013\u2014\*\u2022\u25CF\u25E6]\s*/u, '')
    .replace(/^\d+[.)]\s+/u, '')
    .trim();
}

/** True when Professional Summary prose still contains list-marker leakage. */
export function summaryContainsListMarkerLeakage(summary: string): boolean {
  const t = summary || '';
  if (/[•\u2022\u25CF\u25E6]/.test(t)) return true;
  if (/(^|\n)\s*[-–—*]\s+\S/m.test(t)) return true;
  if (/(^|\n)\s*\d+[.)]\s+\S/m.test(t)) return true;
  return false;
}

/** Remove leaked list markers from Summary prose without altering mid-sentence punctuation. */
export function sanitizeSummaryListMarkers(summary: string): string {
  return (summary || '')
    .replace(/[•\u2022\u25CF\u25E6]/gu, ' ')
    .replace(/(^|\n)\s*[-–—*]\s+/gm, '$1')
    .replace(/(^|\n)\s*\d+[.)]\s+/gm, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

/** Split authoritative Experience text into ordered source duty units. */
export function extractSourceDutyUnits(description: string): string[] {
  let units = splitExperienceBullets(description || '')
    .map((l) => stripDutyListPrefix(l))
    .filter(Boolean);
  if (units.length <= 1 && (description || '').trim()) {
    const block = stripDutyListPrefix(description || '');
    const sentenced = block
      .split(/(?<=[.!?।])\s+/)
      .map((p) => stripDutyListPrefix(p))
      .filter((p) => p.length > 8);
    if (sentenced.length > 1) units = sentenced;
    else if (block) units = [block];
  }
  return units;
}

export function normalizeSourceFactText(text: string): string {
  return stripDutyListPrefix(text || '')
    .normalize('NFKC')
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
  const stem = (t: string) => t
    .replace(/(?:ing|ed|es|s)$/u, '')
    .replace(/(?:tion|ment|ness)$/u, '');
  const hayStems = new Set(hay.split(/\s+/).map(stem).filter((t) => t.length >= 3));
  let hit = 0;
  for (const t of required) {
    if (hay.includes(t) || hayStems.has(stem(t))) hit += 1;
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

export type SummarySourceFactCoverage = {
  ok: boolean;
  requiredIds: string[];
  coveredIds: string[];
  missingIds: string[];
  reason?: 'summary_material_fact_coverage_incomplete';
};

/**
 * Compare dynamic source-fact identities against Professional Summary prose.
 * Each material Experience unit must be semantically represented at least once.
 */
export function validateSummarySourceFactCoverage(
  sourceDescription: string,
  summary: string,
): SummarySourceFactCoverage {
  const required = sourceFactIdentitiesFromDescription(sourceDescription);
  const requiredIds = required.map((r) => r.id);
  if (!required.length) {
    return { ok: true, requiredIds: [], coveredIds: [], missingIds: [] };
  }
  const hay = summary || '';
  const coveredIds: string[] = [];
  for (const req of required) {
    const tokens = req.tokens.filter((t) => t.length >= 4);
    const score = tokenCoverageRatio(tokens.length ? tokens : req.tokens, hay);
      if (score >= 0.4) {
        coveredIds.push(req.id);
        continue;
      }
    const keys = materialDutyKeysFromDescription(req.unit).filter((k) => k !== 'generic_duty');
    if (keys.length && validateMaterialDutyCoverage(req.unit, hay).valid) {
      coveredIds.push(req.id);
    }
  }
  const missingIds = requiredIds.filter((id) => !coveredIds.includes(id));
  const ok = missingIds.length === 0;
  return {
    ok,
    requiredIds,
    coveredIds,
    missingIds,
    reason: ok ? undefined : 'summary_material_fact_coverage_incomplete',
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
  const raw = stripDutyListPrefix(sourceUnit || '');
  if (!raw) return '';
  return applyEnglishEmploymentTense(raw, Boolean(options?.isPresent));
}

/**
 * Convert a duty line into an English gerund fragment for Summary prose
 * (e.g. "Review reports" → "reviewing reports").
 * Also converts coordinated verbs: "Review X and mark Y" → "reviewing X and marking Y".
 */
export function dutyToEnglishGerundFragment(sourceUnit: string): string {
  let t = stripDutyListPrefix(sourceUnit || '').replace(/[.。۔।!?…]\s*$/u, '').trim();
  if (!t) return '';
  t = t.replace(/^(I|We)\s+/i, '');

  const toGerundWord = (verb: string): string => {
    let gerund = verb.toLowerCase();
    if (/ing$/i.test(gerund)) return gerund;
    if (/ied$/i.test(gerund)) return `${gerund.slice(0, -3)}ying`;
    if (/ed$/i.test(gerund) && gerund.length > 3) {
      const stem = gerund.slice(0, -2);
      if (/e$/i.test(stem)) return `${stem}ing`;
      return `${stem}ing`;
    }
    if (/es$/i.test(gerund) && /(ches|shes|sses|xes|zes)$/i.test(gerund)) {
      return `${gerund.slice(0, -2)}ing`;
    }
    if (/ies$/i.test(gerund)) return `${gerund.slice(0, -3)}ying`;
    if (/s$/i.test(gerund) && !/(ss|us|is)$/i.test(gerund)) {
      gerund = gerund.slice(0, -1);
    }
    if (/e$/i.test(gerund) && !/(ee|ye|oe)$/i.test(gerund)) {
      return `${gerund.slice(0, -1)}ing`;
    }
    if (/[^aeiou][aeiou][td]$/i.test(gerund)) {
      return `${gerund}${gerund.slice(-1)}ing`;
    }
    return `${gerund}ing`;
  };

  const gerundPairs: Array<[RegExp, string]> = [
    [/^(Respond(?:ed|s|ing)?)\b/i, 'responding'],
    [/^(Record(?:ed|s|ing)?)\b/i, 'recording'],
    [/^(Coordinat(?:e|ed|es|ing))\b/i, 'coordinating'],
    [/^(Collaborat(?:e|ed|es|ing))\b/i, 'collaborating'],
    [/^(Provid(?:e|ed|es|ing))\b/i, 'providing'],
    [/^(Handl(?:e|ed|es|ing))\b/i, 'handling'],
    [/^(Resolv(?:e|ed|es|ing))\b/i, 'resolving'],
    [/^(Log(?:ged|s|ging)?)\b/i, 'logging'],
    [/^(Document(?:ed|s|ing)?)\b/i, 'documenting'],
    [/^(Assist(?:ed|s|ing)?)\b/i, 'assisting'],
    [/^(Support(?:ed|s|ing)?)\b/i, 'supporting'],
    [/^(Maintain(?:ed|s|ing)?)\b/i, 'maintaining'],
    [/^(Manag(?:e|ed|es|ing))\b/i, 'managing'],
    [/^(Review(?:ed|s|ing)?)\b/i, 'reviewing'],
    [/^(Updat(?:e|ed|es|ing))\b/i, 'updating'],
    [/^(Mark(?:ed|s|ing)?)\b/i, 'marking'],
    [/^(Prepar(?:e|ed|es|ing))\b/i, 'preparing'],
    [/^(Operat(?:e|ed|es|ing))\b/i, 'operating'],
    [/^(Monitor(?:ed|s|ing)?)\b/i, 'monitoring'],
    [/^(Install(?:ed|s|ing)?)\b/i, 'installing'],
    [/^(Teach(?:es|ing)?|Taught)\b/i, 'teaching'],
    [/^(Design(?:ed|s|ing)?)\b/i, 'designing'],
    [/^(Calculat(?:e|ed|es|ing))\b/i, 'calculating'],
    [/^(Clean(?:ed|s|ing)?)\b/i, 'cleaning'],
    [/^(Load(?:ed|s|ing)?)\b/i, 'loading'],
    [/^(Deliver(?:ed|s|ing)?)\b/i, 'delivering'],
    [/^(Test(?:ed|s|ing)?)\b/i, 'testing'],
    [/^(Inspect(?:ed|s|ing)?)\b/i, 'inspecting'],
    [/^(Creat(?:e|ed|es|ing))\b/i, 'creating'],
    [/^(Writ(?:e|es|ing)|Wrote)\b/i, 'writing'],
    [/^(Check(?:ed|s|ing)?)\b/i, 'checking'],
    [/^(Ensuring|Ensure(?:d|s)?)\b/i, 'ensuring'],
  ];
  let converted = false;
  for (const [re, gerund] of gerundPairs) {
    if (re.test(t)) {
      t = t.replace(re, gerund);
      converted = true;
      break;
    }
  }
  if (!converted) {
    const m = /^([A-Za-z]+)\b(.*)$/.exec(t);
    if (m) {
      t = `${toGerundWord(m[1])}${m[2] || ''}`;
    } else {
      t = t.charAt(0).toLowerCase() + t.slice(1);
    }
  }

  // Coordinated second verb: "reviewing X and mark Y" → "… and marking Y"
  // Only rewrite known duty verbs — never adjectives like "incomplete".
  const coordinatedVerb = new Set([
    'respond', 'responded', 'responds',
    'record', 'recorded', 'records',
    'coordinate', 'coordinated', 'coordinates',
    'collaborate', 'collaborated', 'collaborates',
    'provide', 'provided', 'provides',
    'handle', 'handled', 'handles',
    'resolve', 'resolved', 'resolves',
    'log', 'logged', 'logs',
    'document', 'documented', 'documents',
    'assist', 'assisted', 'assists',
    'support', 'supported', 'supports',
    'maintain', 'maintained', 'maintains',
    'manage', 'managed', 'manages',
    'review', 'reviewed', 'reviews',
    'update', 'updated', 'updates',
    'mark', 'marked', 'marks',
    'prepare', 'prepared', 'prepares',
    'operate', 'operated', 'operates',
    'monitor', 'monitored', 'monitors',
    'install', 'installed', 'installs',
    'teach', 'taught', 'teaches',
    'design', 'designed', 'designs',
    'calculate', 'calculated', 'calculates',
    'clean', 'cleaned', 'cleans',
    'load', 'loaded', 'loads',
    'deliver', 'delivered', 'delivers',
    'test', 'tested', 'tests',
    'inspect', 'inspected', 'inspects',
    'create', 'created', 'creates',
    'write', 'wrote', 'writes',
    'check', 'checked', 'checks',
    'ensure', 'ensured', 'ensures',
    'flag', 'flagged', 'flags',
    'verify', 'verified', 'verifies',
  ]);
  t = t.replace(
    /\band\s+([A-Za-z]+)\b/g,
    (full, verb: string) => {
      if (!coordinatedVerb.has(verb.toLowerCase())) return full;
      return `and ${toGerundWord(verb)}`;
    },
  );
  return t;
}
