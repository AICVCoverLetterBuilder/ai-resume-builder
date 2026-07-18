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
import type { Locale } from './i18n/translations';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'with', 'by',
  'at', 'from', 'as', 'into', 'their', 'them', 'they', 'this', 'that', 'when',
  'while', 'during', 'using', 'via', 'per', 'sam', 'sa', 'za', 'na', 'i', 'u',
  'je', 'se', 'the', 'are', 'was', 'were', 'be', 'been', 'is', 'am',
  'kada', 'kad', 'što', 'sto', 'koji', 'koja', 'koje', 'ili', 'ali',
]);

/** Light multilingual stem for coverage matching (not a full morphological analyser). */
export function stemTokenForCoverage(token: string): string {
  let t = foldCoverageToken(token || '');
  if (t.length < 4) return t;
  // Serbian / Croatian verb pairs: pregledam↔pregleda, ažuriram↔ažurira, koordinišem↔koordiniše.
  // Past participles from -avam/-iram stems: označavao↔označavam, ažurirao↔ažuriram.
  t = t.replace(/(?:avao|avala|avali|avale)$/u, '');
  t = t.replace(/(?:irao|irala|irali|irale)$/u, 'ir');
  t = t.replace(/(?:avam|ava|avati)$/u, '');
  t = t.replace(/(?:iram|ira|irati)$/u, 'ir');
  t = t.replace(/(?:isem|ise|isem|ise|sem|se)$/u, ''); // folded š→s forms
  t = t.replace(/(?:ijem|uje|ujem|ajem)$/u, '');
  t = t.replace(/(?:ivao|ivala|ivali|ivale)$/u, '');
  t = t.replace(/(?:ao|ala|ali|ale|io|ila|ili|ile)$/u, '');
  t = t.replace(/(?:ama|ima|ove|ovi|eva|eve|om)$/u, '');
  t = t.replace(/(?:am|em|im)$/u, '');
  // Cyrillic Serbian stems
  t = t.replace(/(?:авао|авала|авали|авале)$/u, '');
  t = t.replace(/(?:ирао|ирала|ирали|ирале)$/u, 'ир');
  t = t.replace(/(?:авам|ава|авати)$/u, '');
  t = t.replace(/(?:ирам|ира|ирати)$/u, 'ир');
  t = t.replace(/(?:ишем|ише|шем|ше)$/u, '');
  t = t.replace(/(?:ијем|ује|ујем|ајем)$/u, '');
  t = t.replace(/(?:ивао|ивала|ивали|ивале)$/u, '');
  t = t.replace(/(?:ао|ала|али|але|ио|ила|или|иле)$/u, '');
  t = t.replace(/(?:ама|има|ове|ови|ева|еве|ом)$/u, '');
  t = t.replace(/(?:ам|ем|им)$/u, '');
  // Noun/adjective endings common in Serbian duties
  t = t.replace(/(?:ovima|evima|ama|ima)$/u, '');
  t = t.replace(/(?:ovi|eve|ova|eva)$/u, '');
  if (t.length >= 5) t = t.replace(/[aeiuаеиу]$/u, '');
  // English
  t = t.replace(/(?:ing|ed|es|s)$/u, '');
  t = t.replace(/(?:tion|ment|ness)$/u, '');
  return t.length >= 3 ? t : foldCoverageToken(token);
}

/**
 * Fold diacritics for coverage matching so Serbian Latin izveštaj ↔ izvestaj
 * and š/č/ć/ž/đ variants remain compatible without requiring English tokens.
 */
export function foldCoverageToken(token: string): string {
  return (token || '')
    .toLowerCase()
    .normalize('NFKC')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'dj')
    .replace(/ђ/g, 'dj')
    .replace(/ј/g, 'j');
}

/**
 * Convert Serbian/Croatian first-person duty verbs to CV-style 3rd person.
 * Present: Pregledam → Pregleda; Koordinišem → Koordiniše.
 * Past (completed): Pregledam → Pregledao/Pregledala (gendered).
 */
export function applySerbianCvEmploymentTense(
  line: string,
  isPresent: boolean,
  gender?: string,
): string {
  let t = stripDutyListPrefix(line || '');
  if (!t) return t;
  const female = /^(female|f|ženski|zenski)$/i.test(String(gender || ''));
  const male = /^(male|m|muški|muski)$/i.test(String(gender || ''));

  const to3sgPresent = (verb: string): string => {
    const v = verb;
    // Latin
    if (/šem$/i.test(v)) return `${v.slice(0, -3)}še`;
    if (/ćem$/i.test(v)) return `${v.slice(0, -3)}će`;
    if (/ijem$/i.test(v)) return `${v.slice(0, -4)}ije`;
    if (/ujem$/i.test(v)) return `${v.slice(0, -4)}uje`;
    if (/avam$/i.test(v)) return `${v.slice(0, -2)}a`; // označavam → označava
    if (/iram$/i.test(v)) return `${v.slice(0, -2)}a`; // ažuriram → ažurira
    if (/am$/i.test(v)) return `${v.slice(0, -2)}a`; // pregledam → pregleda
    if (/em$/i.test(v)) return `${v.slice(0, -2)}e`;
    if (/im$/i.test(v)) return `${v.slice(0, -2)}i`;
    // Cyrillic 1sg → 3sg
    if (/шем$/u.test(v)) return `${v.slice(0, -3)}ше`;
    if (/ћем$/u.test(v)) return `${v.slice(0, -3)}ће`;
    if (/ијем$/u.test(v)) return `${v.slice(0, -4)}ије`;
    if (/ујем$/u.test(v)) return `${v.slice(0, -4)}ује`;
    if (/авам$/u.test(v)) return `${v.slice(0, -2)}а`;
    if (/ирам$/u.test(v)) return `${v.slice(0, -2)}а`;
    if (/ам$/u.test(v)) return `${v.slice(0, -2)}а`;
    if (/ем$/u.test(v)) return `${v.slice(0, -2)}е`;
    if (/им$/u.test(v)) return `${v.slice(0, -2)}и`;
    return v;
  };

  const toPast = (verb: string): string => {
    const base = to3sgPresent(verb);
    const cyr = /\p{Script=Cyrillic}/u.test(base);
    let stem: string;
    let maleEnd: string;
    let femaleEnd: string;
    if (/še$/i.test(base) || /ше$/u.test(base)) {
      stem = base.slice(0, -2);
      maleEnd = cyr ? 'сао' : 'sao';
      femaleEnd = cyr ? 'сала' : 'sala';
    } else if (/[aа]$/u.test(base)) {
      stem = base.slice(0, -1);
      maleEnd = cyr ? 'ао' : 'ao';
      femaleEnd = cyr ? 'ала' : 'ala';
    } else if (/[eе]$/u.test(base)) {
      stem = base.slice(0, -1);
      maleEnd = cyr ? 'ео' : 'eo';
      femaleEnd = cyr ? 'ела' : 'ela';
    } else if (/[iи]$/u.test(base)) {
      stem = base.slice(0, -1);
      maleEnd = cyr ? 'ио' : 'io';
      femaleEnd = cyr ? 'ила' : 'ila';
    } else {
      stem = base;
      maleEnd = cyr ? 'о' : 'o';
      femaleEnd = cyr ? 'ла' : 'la';
    }
    if (female) return `${stem}${femaleEnd}`;
    if (male) return `${stem}${maleEnd}`;
    return `${stem}${maleEnd}/${femaleEnd}`;
  };

  const transformVerb = (verb: string): string => {
    if (!/(am|em|im|šem|ćem|ijem|ujem|avam|ам|ем|им|шем|ћем|ијем|ујем|авам)$/iu.test(verb)) {
      return verb;
    }
    return isPresent ? to3sgPresent(verb) : toPast(verb);
  };

  // Leading verb
  t = t.replace(/^(\p{L}+)/u, (_m, verb: string) => {
    const next = transformVerb(verb);
    return verb[0] === verb[0].toUpperCase()
      ? next.charAt(0).toUpperCase() + next.slice(1)
      : next;
  });
  // Coordinated verbs: "… i označavam …" / "… и означавам …"
  // Avoid \\b — it does not treat Cyrillic letters as word characters in JS.
  t = t.replace(/(^|[^\p{L}])(i|и)\s+(\p{L}+)/gu, (_m, pre: string, conj: string, verb: string) =>
    `${pre}${conj} ${transformVerb(verb)}`);
  return t;
}

/** True when source text is already written in the requested locale script/language. */
export function sourceUsableInLocale(text: string, locale: Locale): boolean {
  const t = text || '';
  if (!t.trim()) return false;
  if (locale === 'hi') return /\p{Script=Devanagari}/u.test(t);
  if (locale === 'ar') return /\p{Script=Arabic}/u.test(t);
  if (locale === 'ja') return /[\u3040-\u30ff\u3400-\u9fff]/u.test(t);
  if (locale === 'ru') return /\p{Script=Cyrillic}/u.test(t);
  if (locale === 'sr' || locale === 'hr') {
    if (/\p{Script=Devanagari}|\p{Script=Arabic}/u.test(t)) return false;
    // Cyrillic Serbian
    if (/\p{Script=Cyrillic}/u.test(t)) return true;
    // Latin Serbian/Croatian with diacritics or typical 1sg verb endings
    if (/[čćžšđČĆŽŠĐ]/u.test(t)) return true;
    if (/\b\p{L}+(?:am|em|im|šem)\b/u.test(t) && /\b(?:i|sa|za|na|u|kada|kad)\b/u.test(t)) {
      return true;
    }
    return false;
  }
  if (locale === 'en') {
    return !/\p{Script=Devanagari}|\p{Script=Arabic}|\p{Script=Cyrillic}/u.test(t)
      && !/[čćžšđČĆŽŠĐ]/u.test(t);
  }
  // Other Latin locales (de/es/fr/it/pt-BR): accept Latin text but NEVER treat
  // Serbian/Croatian diacritic or Cyrillic source as already-localized — that
  // would preserve sr wording under a de/es request (cross-locale regressions).
  if (/[čćžšđČĆŽŠĐ]/u.test(t) || /\p{Script=Cyrillic}/u.test(t)) return false;
  return !/\p{Script=Devanagari}|\p{Script=Arabic}/u.test(t);
}
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

/**
 * Split authoritative Experience text into ordered source duty units.
 * Accepts plain textarea lines, bullet-formatted canonical, CRLF, and
 * concatenated sentences without whitespace after terminal punctuation
 * (Android soft-wrap / lost-newline shape: length == sum of unit lengths).
 */
export function extractSourceDutyUnits(description: string): string[] {
  let units = splitExperienceBullets(description || '')
    .map((l) => stripDutyListPrefix(l))
    .filter(Boolean);
  if (units.length <= 1 && (description || '').trim()) {
    const block = stripDutyListPrefix(
      (description || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim(),
    );
    // Prefer whitespace after terminator; also allow zero-width gap before a
    // new capital-letter duty (build-263 live 183-char concatenated form).
    const sentenced = block
      .split(/(?<=[.!?।])\s*(?=[A-ZČĆŽŠĐА-ЯЁІЇЄĞÜÖÄ\u0900-\u097F])/u)
      .map((p) => stripDutyListPrefix(p.trim()))
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

/** Lightweight synonym stems so coverage tolerates natural paraphrase. */
const COVERAGE_SYNONYM_STEMS: Record<string, string[]> = {
  tabel: ['evidenc', 'tabel'],
  evidenc: ['tabel', 'evidenc'],
  intern: ['unutrasnj', 'intern'],
  unutrasnj: ['intern', 'unutrasnj'],
  nedostaj: ['nedostajuc', 'nedostaj'],
  nedostajuc: ['nedostaj', 'nedostajuc'],
  odelen: ['odelenj', 'odelen', 'odeljen', 'odeljenj'],
  odelenj: ['odelen', 'odelenj'],
  odeljen: ['odelen', 'odeljen', 'odeljenj'],
  odeljenj: ['odeljen', 'odelen', 'odeljenj'],
  informacij: ['informac', 'informacij'],
  informac: ['informacij', 'informac'],
  izvestaj: ['izvestaj'],
  status: ['statu', 'status'],
  statu: ['status', 'statu'],
  unos: ['uno', 'unos'],
  uno: ['unos', 'uno'],
};

function expandCoverageStem(stem: string): string[] {
  const s = foldCoverageToken(stem);
  const syn = COVERAGE_SYNONYM_STEMS[s];
  return syn ? [...new Set([s, ...syn.map(foldCoverageToken)])] : [s];
}

function tokenCoverageRatio(required: string[], haystack: string): number {
  if (!required.length) return 1;
  const hay = normalizeSourceFactText(haystack);
  const hayFolded = foldCoverageToken(hay);
  const hayStems = new Set(
    hay
      .split(/\s+/)
      .flatMap((t) => expandCoverageStem(stemTokenForCoverage(t)))
      .filter((t) => t.length >= 3),
  );
  let hit = 0;
  for (const t of required) {
    const folded = foldCoverageToken(t);
    const reqStems = expandCoverageStem(stemTokenForCoverage(t));
    if (
      hay.includes(t)
      || hayFolded.includes(folded)
      || reqStems.some((s) => hayStems.has(s))
    ) {
      hit += 1;
    }
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
 * After identity coverage, require each matched source unit to preserve compound
 * clauses (e.g. "… i označavam nepotpune unose"). Used for provider output so a
 * partial rewrite cannot pass token-overlap alone.
 */
export function validateSourceUnitsMateriallyPreserved(
  sourceDescription: string,
  candidateDescription: string,
): SourceFactIdentityCoverage {
  const base = validateSourceFactIdentityCoverage(sourceDescription, candidateDescription);
  if (!base.ok) return base;
  const required = sourceFactIdentitiesFromDescription(sourceDescription);
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  type Pair = { ri: number; bi: number; score: number };
  const pairs: Pair[] = [];
  for (let ri = 0; ri < required.length; ri += 1) {
    for (let bi = 0; bi < bullets.length; bi += 1) {
      const tokens = required[ri].tokens.filter((t) => t.length >= 4);
      const score = tokenCoverageRatio(tokens.length ? tokens : required[ri].tokens, bullets[bi]);
      if (score >= 0.45) pairs.push({ ri, bi, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedR = new Set<number>();
  const usedB = new Set<number>();
  const coveredIds: string[] = [];
  for (const p of pairs) {
    if (usedR.has(p.ri) || usedB.has(p.bi)) continue;
    if (!deterministicBulletPreservesSourceUnit(required[p.ri].unit, bullets[p.bi])) {
      continue;
    }
    usedR.add(p.ri);
    usedB.add(p.bi);
    coveredIds.push(required[p.ri].id);
  }
  const requiredIds = required.map((r) => r.id);
  const missingIds = requiredIds.filter((id) => !coveredIds.includes(id));
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

export type DeterministicFallbackTransformationKind =
  | 'universal_preserve_tense'
  | 'localize_projection'
  | 'identity';

/** One deterministic fallback bullet with immutable source-unit provenance. */
export type ProvenancedFallbackBullet = {
  text: string;
  sourceUnitId: string;
  sourceFactIds: string[];
  sourceUnit: string;
  transformationKind: DeterministicFallbackTransformationKind;
  locale: Locale;
  tenseMode: 'present' | 'past';
  operationSnapshotId?: string;
  materialClauses?: string[];
  preservationChecks?: {
    materialPreserved: boolean;
    clausePreserved: boolean;
    unsupportedAddition: boolean;
    duplicate: boolean;
  };
};

export type ProvenancedDeterministicFallback = {
  text: string;
  bullets: ProvenancedFallbackBullet[];
  requiredFactIds: string[];
};

/** Split compound duties on coordinating conjunctions for clause-preservation checks. */
export function splitCompoundDutyClauses(unit: string): string[] {
  const t = stripDutyListPrefix(unit || '').replace(/[.!?।۔…]\s*$/u, '').trim();
  if (!t) return [];
  const parts = t
    .split(/\s+(?:i|и|and|und|y|et|&)\s+/iu)
    .map((p) => p.trim())
    .filter((p) => contentTokensFromDuty(p).some((tok) => tok.length >= 4));
  return parts.length > 1 ? parts : [t];
}

/**
 * Material preservation for a one-to-one deterministic transform.
 * Provenance already names the intended source unit — this verifies clauses,
 * objects and qualifiers were not dropped.
 */
export function deterministicBulletPreservesSourceUnit(
  sourceUnit: string,
  bulletText: string,
): boolean {
  const bullet = (bulletText || '').trim();
  if (!bullet) return false;
  const clauses = splitCompoundDutyClauses(sourceUnit);
  for (const clause of clauses) {
    const toks = contentTokensFromDuty(clause).filter((t) => t.length >= 4);
    if (toks.length > 0 && tokenCoverageRatio(toks, bullet) < 0.55) {
      return false;
    }
    // Distinctive tokens (length ≥ 5) are material objects/qualifiers — dropping
    // any majority of them means the clause was hollowed out.
    const distinctive = toks.filter((t) => t.length >= 5);
    if (distinctive.length >= 1 && tokenCoverageRatio(distinctive, bullet) < 0.8) {
      return false;
    }
  }
  const all = contentTokensFromDuty(sourceUnit).filter((t) => t.length >= 4);
  if (all.length === 0) return normalizeSourceFactText(bullet).length > 0;
  if (tokenCoverageRatio(all, bullet) < 0.6) return false;
  const distinctiveAll = all.filter((t) => t.length >= 5);
  if (distinctiveAll.length >= 2 && tokenCoverageRatio(distinctiveAll, bullet) < 0.8) {
    return false;
  }
  return true;
}

/**
 * Validate deterministic fallback using explicit source-unit provenance.
 * Does not rediscover mappings via weak global token overlap alone.
 * Provider/server output must continue using validateSourceFactIdentityCoverage.
 *
 * When `expectedOperationSnapshotId` is set, bullets whose snapshot id differs
 * are rejected (prevents mixing identities across representations).
 */
export function validateProvenancedDeterministicFallbackCoverage(
  sourceDescription: string,
  provenanced: ProvenancedFallbackBullet[],
  options?: {
    expectedOperationSnapshotId?: string;
    /** Per-fact rejection diagnostics (non-PII). */
    onFactResult?: (row: ProvenancedFactCoverageDiag) => void;
  },
): SourceFactIdentityCoverage {
  const required = sourceFactIdentitiesFromDescription(sourceDescription);
  const requiredIds = required.map((r) => r.id);
  if (!required.length) {
    return { ok: true, requiredIds: [], coveredIds: [], missingIds: [], duplicatedIds: [] };
  }

  const usedFactIds = new Set<string>();
  const coveredIds: string[] = [];
  const candidateText = provenanced.map((b) => b.text).filter(Boolean).join('\n');
  const expectedSnap = options?.expectedOperationSnapshotId;

  for (let bulletIndex = 0; bulletIndex < provenanced.length; bulletIndex += 1) {
    const bullet = provenanced[bulletIndex];
    if (!bullet.text.trim()) continue;
    const mapped = bullet.sourceFactIds.filter((id) => requiredIds.includes(id));
    const sourceIdentity = mapped.length === 1
      ? required.find((r) => r.id === mapped[0])
      : undefined;
    const snapshotMatch = !expectedSnap
      || !bullet.operationSnapshotId
      || bullet.operationSnapshotId === expectedSnap;
    let rejectionReason: string | undefined;
    let covered = false;

    if (!mapped.length) {
      rejectionReason = 'source_fact_id_not_in_required_set';
    } else if (mapped.length !== 1) {
      rejectionReason = 'multiple_source_fact_ids_on_one_bullet';
    } else if (!snapshotMatch) {
      rejectionReason = 'operation_snapshot_id_mismatch';
    } else if (usedFactIds.has(mapped[0])) {
      rejectionReason = 'duplicate_source_fact_id_mapping';
    } else if (!sourceIdentity) {
      rejectionReason = 'source_identity_missing';
    } else if (!deterministicBulletPreservesSourceUnit(sourceIdentity.unit, bullet.text)) {
      rejectionReason = 'material_or_clause_preservation_failed';
    } else {
      usedFactIds.add(mapped[0]);
      coveredIds.push(mapped[0]);
      covered = true;
    }

    options?.onFactResult?.({
      requiredSourceFactId: mapped[0] || requiredIds[bulletIndex] || '',
      parentSourceUnitId: bullet.sourceUnitId,
      fallbackBulletIndex: bulletIndex,
      fallbackMappedSourceUnitId: bullet.sourceUnitId,
      fallbackMappedSourceFactIds: bullet.sourceFactIds,
      operationSnapshotIdMatch: snapshotMatch,
      transformationKind: bullet.transformationKind,
      materialPreservationResult: sourceIdentity
        ? deterministicBulletPreservesSourceUnit(sourceIdentity.unit, bullet.text)
        : false,
      clausePreservationResult: sourceIdentity
        ? deterministicBulletPreservesSourceUnit(sourceIdentity.unit, bullet.text)
        : false,
      unsupportedAdditionResult: false,
      duplicateResult: Boolean(mapped[0] && usedFactIds.has(mapped[0]) && !covered),
      finalCovered: covered,
      rejectionReason,
    });
  }

  const dup = validateDistinctExperienceBullets(candidateText);
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

  const missingIds = requiredIds.filter((id) => !coveredIds.includes(id));
  const ok = missingIds.length === 0 && coveredIds.length === requiredIds.length;
  return {
    ok,
    requiredIds,
    coveredIds,
    missingIds,
    duplicatedIds: [],
    reason: ok ? undefined : 'experience_material_fact_coverage_incomplete',
  };
}

export type ProvenancedFactCoverageDiag = {
  requiredSourceFactId: string;
  parentSourceUnitId: string;
  fallbackBulletIndex: number;
  fallbackMappedSourceUnitId: string;
  fallbackMappedSourceFactIds: string[];
  operationSnapshotIdMatch: boolean;
  transformationKind: string;
  materialPreservationResult: boolean;
  clausePreservationResult: boolean;
  unsupportedAdditionResult: boolean;
  duplicateResult: boolean;
  finalCovered: boolean;
  rejectionReason?: string;
};

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
 * Works for English and same-locale non-English free-text duties.
 */
export function universalPreserveSourceUnit(
  sourceUnit: string,
  options?: { isPresent?: boolean; locale?: Locale; gender?: string },
): string {
  const raw = stripDutyListPrefix(sourceUnit || '');
  if (!raw) return '';
  const isPresent = Boolean(options?.isPresent);
  const locale = options?.locale || 'en';
  if (locale === 'sr' || locale === 'hr') {
    return applySerbianCvEmploymentTense(raw, isPresent, options?.gender);
  }
  if (locale === 'en' || sourceUsableInLocale(raw, 'en')) {
    return applyEnglishEmploymentTense(raw, isPresent);
  }
  // Other locales: keep user wording; do not force English tense transforms.
  return raw;
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
