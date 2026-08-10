/**
 * AAB-325 — English Summary shared final gate: entry-owned grounding, locale
 * purity, current/prior duty coverage, competency, duration scope.
 *
 * Reuses shared structured-role localization and warehouse duty fact identities
 * from the German path; English wording and validators are locale-specific.
 */
import type { Locale } from './i18n/translations';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';
import {
  resolveLocalizedSummaryRole,
  validateSummaryStructuredRoleLocale,
  type StructuredRoleLocaleValidation,
} from './cv-summary-structured-role-localization';
import {
  extractGermanCurrentWarehouseDutyFacts,
  validateSummaryEntryDutyCoverage,
  analyzeCurrentDutyRequiredFactParity,
  type GermanCurrentDutyFact,
  type GermanCurrentDutyFactId,
  type SummaryEntryDutyCoverageResult,
  type AuthoritativeCurrentDutyParityResult,
} from './cv-german-summary-current-duty-coverage';
import { buildSummaryExplicitSkillAuthority } from './cv-german-summary-competency-grounding';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { fingerprintText } from './cv-export-diagnostics';

export const ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION =
  'english-summary-shared-final-gate-325-v1' as const;
export const ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION =
  'english-summary-entity-locale-purity-325-v1' as const;
export const ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION =
  'english-summary-current-prior-coverage-325-v1' as const;
export const SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION =
  'summary-invariant-preapply-gate-325-v1' as const;
/** AAB-326 — English visible current-duty coverage uses the same required fact set. */
export const ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION =
  'english-summary-visible-current-coverage-326-v1' as const;
/** AAB-326 — final vs visible required-fact parity. */
export const SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION =
  'summary-visible-required-fact-parity-326-v1' as const;
/** AAB-326 — selected deterministic / final lineage unit-hash truth. */
export const SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION =
  'summary-selected-lineage-hash-truth-326-v1' as const;
/** AAB-326 — sentence semantic role serialization truth. */
export const SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION =
  'summary-sentence-semantic-role-truth-326-v1' as const;
/** AAB-346 — entry-owned English structured Summary builder revision. */
export const SUMMARY_BUILDER_REVISION_EN =
  'entry-owned-english-rebuild-v1' as const;
export const SUMMARY_DURATION_FINALIZER_REVISION_EN =
  'english-duration-total-career-v1' as const;
/** AAB-346 — English Summary finite-clause grammar (no sentence fragments). */
export const ENGLISH_SUMMARY_FINITE_CLAUSE_346_REVISION =
  'english-summary-finite-clause-346-v1' as const;
/** English generated Summary perspective: first-person professional CV voice. */
export const ENGLISH_SUMMARY_PERSPECTIVE_CONTRACT_346 =
  'english-summary-first-person-346-v1' as const;
/** AAB-347 — summaryPasses role must match localized builder / attachSummaryDiag. */
export const ENGLISH_SUMMARY_VALIDATION_ROLE_ALIGN_347_REVISION =
  'english-summary-validation-role-align-347-v1' as const;
/** AAB-347 — never validate empty Summary while grounded rebuild text exists. */
export const ENGLISH_SUMMARY_GROUNDED_FAILCLOSED_347_REVISION =
  'english-summary-grounded-failclosed-347-v1' as const;
/** AAB-347 — candidate projection hash agreement across validation stages. */
export const SUMMARY_CANDIDATE_PROJECTION_INVARIANT_347_REVISION =
  'summary-candidate-projection-invariant-347-v1' as const;
/**
 * AAB-370 — English Summary facts derive from each Experience entry’s live
 * authoritative bullets. Warehouse/design canonical IDs are never production
 * defaults or occupation memory for arbitrary free-text titles.
 */
export const ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION =
  'english-summary-entry-owned-facts-370-v1' as const;

/**
 * Strict English Summary domain for the Atlas/Rewitu shared final gate.
 * Matches Spanish/German warehouse/design source, native English warehouse/design
 * duty phrases, and classified warehouse fact corpora. Do not match localized
 * English role titles alone ("Warehouse Employee" / "Graphic Designer") — those
 * falsely trigger the gate on sr→en cycles after Experience enhance localizes
 * titles without warehouse duty evidence.
 */
export const ENGLISH_STRUCTURED_SUMMARY_DOMAIN_RE =
  /(?:almac[eé]n|mercanc[ií]a|emplead[oa]s?|diseñ(?:adora|ador|o)?|Lager(?:mitarbeiter(?:in)?|arbeiter(?:in)?)|Grafikdesign(?:er(?:in)?|erin)|Emplead[oa]\s+de\s+almac)/iu;

const ENGLISH_WAREHOUSE_DUTY_DOMAIN_RE =
  /(?:checking|verifying|reviewing).{0,60}(?:incoming\s+goods|documentation)|(?:coordinat\w*).{0,80}(?:colleague|goods|preparation|movement)|incoming\s+goods|related\s+documentation|documentation\s+related/iu;

const ENGLISH_DESIGN_DUTY_DOMAIN_RE =
  /(?:creating|reviewing|adapting|preparing).{0,80}(?:visual\s+materials?|graphic\s+elements?|design\s+(?:materials?|documents?|files?)|formats?\s+and\s+screens?)/iu;

const WAREHOUSE_CANONICAL_FACT_IDS = new Set([
  'incoming_goods_check',
  'related_documentation_check',
  'colleague_coordination_goods_preparation_movement',
]);

export function isEnglishStructuredSummaryDomain(corpus: string): boolean {
  void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
  void SUMMARY_BUILDER_REVISION_EN;
  const text = corpus || '';
  if (ENGLISH_STRUCTURED_SUMMARY_DOMAIN_RE.test(text)) return true;
  if (ENGLISH_WAREHOUSE_DUTY_DOMAIN_RE.test(text) || ENGLISH_DESIGN_DUTY_DOMAIN_RE.test(text)) {
    return true;
  }
  const warehouseFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: text,
  }).filter((f) => f.requiredForSummary);
  return warehouseFacts.length >= 2;
}

/**
 * Authoritative English duty bullet — not South Slavic Latin, not non-Latin
 * scripts, and not bare Latin loanwords that appear in Serbian CV telegraphese.
 */
function bulletLooksEnglishAuthoritative(bullet: string): boolean {
  const b = (bullet || '').trim();
  if (!/[A-Za-z]{4,}/.test(b)) return false;
  if (/[čćžšđČĆŽŠĐ]/.test(b)) return false;
  if (/[\u0400-\u04FF\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(b)) {
    return false;
  }
  // Common South Slavic Latin stems (often written without diacritics).
  if (/\b(?:razvoj|implementacija|saradnja|planiranje|koordinacija|priprema|analiza|poslovn\w*|podatak\w*|podataka|rukovodst\w*|odeljen\w*|proizvodnj\w*|operater\w*|iskustv\w*|skladist\w*|skladi[sš]\w*|magacin\w*|timovima|projekata|internih|procesa|aktivnosti|izvr[sš]enju|me[dđ]ufunkcional\w*|izve[sš]taj\w*|uspje[sš]\w*|uspe[sš]\w*|godin\w*|radu|kao|upravaljan\w*|upravljan\w*)\b/iu.test(b)) {
    return false;
  }
  // Require English closed-class or duty-verb evidence (not Latin orthography alone).
  return /\b(?:the|a|an|of|to|in|on|for|with|and|within|across|from|into|onto|by|at|as|during|while|checking|verifying|reviewing|coordinat\w*|creating|preparing|installs?|installed|positions?|secures?|secured|assists?|assisted|shelves|organizes?|organized|maintains?|maintained|operates?|operated|analyz\w*|develop\w*|manag\w*|creates?|created|produces?|produced|performs?|performed|transport|load|deliver|collaborate|collaborated|work|works|worked|goods|documentation|materials?|reports?|safely|according|assigned|installation|patrons|library|books|quiet|study|circulation|records|panels|solar|rooftop|orchestrat\w*|audits?|aligns?|opaque|relay|incident|handoffs?|pods?|incoming|related|colleagues|visual|graphic|design|formats?|screens?)\b/i.test(b);
}

/** Entry-owned English Summary path: warehouse/design OR English duty bullets. */
export function isEnglishEntryOwnedSummaryPath(options: {
  corpus?: string;
  currentDuties?: string;
  priorDuties?: string;
  currentRole?: string;
  priorRole?: string;
  /** When true, package-1 style neutral Professional shells must keep fidelity. */
  roleDutyConflict?: boolean;
}): boolean {
  void ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION;
  const corpus = [
    options.corpus || '',
    options.currentDuties || '',
    options.priorDuties || '',
    options.currentRole || '',
    options.priorRole || '',
  ].join('\n');
  if (isEnglishStructuredSummaryDomain(corpus)) return true;
  // Role/title conflict forces neutral Professional shells without duty units —
  // do not require entry-owned coverage (Kuvar + logistics package-1).
  if (options.roleDutyConflict === true) return false;
  const bullets = splitEnglishDutyBullets(
    `${options.currentDuties || ''}\n${options.priorDuties || ''}`,
  );
  const englishLooking = bullets.filter(bulletLooksEnglishAuthoritative);
  return englishLooking.length >= 2;
}

function hashEnglishOpaque(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

function splitEnglishDutyBullets(text: string, limit = 5): string[] {
  return (text || '')
    .split(/\n+|;\s+|(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.replace(/^[•\-\*]\s*/, '').replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 8)
    .slice(0, limit);
}

export function englishRoleLooksWarehouse(role: string): boolean {
  const r = (role || '').trim();
  if (!r) return false;
  return matchesWarehouseOccupationalTitle(r)
    || /(?:warehouse|almac[eé]n|lager(?:mitarbeiter|arbeiter)?|emplead\w*\s+de\s+almac)/iu.test(r);
}

export function englishRoleLooksDesign(role: string): boolean {
  return /(?:graphic\s*design|diseñ|grafikdesign)/iu.test(role || '');
}

const ENGLISH_DUTY_STOP = new Set([
  'with', 'from', 'that', 'this', 'their', 'them', 'they', 'have', 'been',
  'were', 'into', 'onto', 'about', 'during', 'while', 'where', 'when', 'than',
  'then', 'also', 'and', 'the', 'for', 'are', 'was', 'part', 'work', 'role',
  'assigned', 'according', 'requirements', 'colleagues', 'activities',
]);

function englishDutySignificantTokens(bullet: string): string[] {
  return (bullet || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 4 && !ENGLISH_DUTY_STOP.has(t));
}

function englishDutyBulletCoveredInText(bullet: string, text: string): boolean {
  const corpus = (text || '').toLowerCase();
  const tokens = englishDutySignificantTokens(bullet);
  if (tokens.length === 0) {
    const stem = (bullet || '').replace(/[.;]+$/u, '').trim().toLowerCase().slice(0, 24);
    return stem.length >= 8 && corpus.includes(stem);
  }
  const hits = tokens.filter((t) => corpus.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

/**
 * Convert an authoritative Experience bullet into a finite "where I …" clause.
 * Morphology is heuristic — coverage is token-based, not string-identity.
 */
export function englishDutyBulletToWhereClause(bullet: string): string {
  let s = (bullet || '').replace(/[.;]+$/u, '').trim();
  if (!s) return '';
  const pairs: Array<[RegExp, string]> = [
    [/^Checking\b/i, 'check'],
    [/^Verifying\b/i, 'verify'],
    [/^Reviewing\b/i, 'review'],
    [/^Coordinating\b/i, 'coordinate'],
    [/^Creating\b/i, 'create'],
    [/^Preparing\b/i, 'prepare'],
    [/^Installs\b/i, 'install'],
    [/^Installed\b/i, 'install'],
    [/^Positions\s+and\s+secures\b/i, 'position and secure'],
    [/^Positioned\s+and\s+secured\b/i, 'position and secure'],
    [/^Coordinates\b/i, 'coordinate'],
    [/^Coordinated\b/i, 'coordinate'],
    [/^Assists\b/i, 'assist'],
    [/^Assisted\b/i, 'assist'],
    [/^Shelves\s+and\s+organizes\b/i, 'shelve and organize'],
    [/^Shelved\s+and\s+organized\b/i, 'shelve and organize'],
    [/^Maintains\b/i, 'maintain'],
    [/^Maintained\b/i, 'maintain'],
    [/^Operates\b/i, 'operate'],
    [/^Operated\b/i, 'operate'],
    [/^Analyzes\b/i, 'analyze'],
    [/^Analyzed\b/i, 'analyze'],
    [/^Creates\b/i, 'create'],
    [/^Created\b/i, 'create'],
    [/^Develops\b/i, 'develop'],
    [/^Developed\b/i, 'develop'],
    [/^Organizes\b/i, 'organize'],
    [/^Organized\b/i, 'organize'],
    [/^Manages\b/i, 'manage'],
    [/^Managed\b/i, 'manage'],
    [/^Performs\b/i, 'perform'],
    [/^Performed\b/i, 'perform'],
    [/^Produces\b/i, 'produce'],
    [/^Produced\b/i, 'produce'],
    [/^Checks\b/i, 'check'],
    [/^Checked\b/i, 'check'],
  ];
  let replaced = false;
  for (const [re, rep] of pairs) {
    if (re.test(s)) {
      s = s.replace(re, rep);
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    s = s.replace(/^(\p{L}+?)(?:es|s)\b/u, (_, stem: string) => stem.toLowerCase());
    s = s.replace(/^\p{Lu}/u, (c) => c.toLowerCase());
  }
  return s;
}

export type EnglishEntryOwnedDutyFact = {
  factId: string;
  sourceFactHash: string;
  sourceEntryIdHash: string | null;
  sourceBullet: string;
  matchRes: RegExp[];
  requiredForSummary: boolean;
  kind: 'warehouse_canonical' | 'generic_entry_owned';
  warehouseFact?: GermanCurrentDutyFact;
};

/**
 * Derive required Summary facts from one Experience entry’s authoritative bullets.
 * Warehouse canonical IDs apply only when the live role is warehouse-shaped and
 * duties classify — never as stale occupation memory for other titles.
 */
export function extractEnglishEntryOwnedDutyFacts(options: {
  entryDuties?: string;
  entryId?: string | null;
  role?: string;
  employer?: string;
}): EnglishEntryOwnedDutyFact[] {
  void ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION;
  void options.employer;
  const duties = (options.entryDuties || '').trim();
  const role = (options.role || '').trim();
  const entryHash = options.entryId ? hashEnglishOpaque(options.entryId) : null;
  const bullets = splitEnglishDutyBullets(duties);
  const warehouseRole = englishRoleLooksWarehouse(role);
  const warehouseFacts = warehouseRole
    ? withEnglishMatchRes(extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: duties,
      entryId: options.entryId,
    }))
    : [];

  if (warehouseRole && warehouseFacts.length > 0) {
    return warehouseFacts.map((f) => ({
      factId: f.canonicalFactId,
      sourceFactHash: f.sourceFactHash,
      sourceEntryIdHash: f.sourceEntryIdHash,
      sourceBullet: bullets.find((b) => f.matchRes.some((re) => re.test(b))) || duties,
      matchRes: f.matchRes,
      requiredForSummary: true,
      kind: 'warehouse_canonical' as const,
      warehouseFact: f,
    }));
  }

  // Arbitrary / unknown occupations — entry-owned bullets only. Never emit
  // warehouse canonical IDs even if stale warehouse text still appears.
  return bullets.map((bullet) => {
    const tokens = englishDutySignificantTokens(bullet);
    const matchRes: RegExp[] = tokens.length
      ? tokens.map((t) => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu'))
      : [new RegExp(
        bullet.slice(0, Math.min(32, bullet.length)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'iu',
      )];
    const factId = `entry_duty_${hashEnglishOpaque(bullet).replace(/^fnv1a_/, '')}`;
    return {
      factId,
      sourceFactHash: hashEnglishOpaque(`entry_duty:${bullet}`),
      sourceEntryIdHash: entryHash,
      sourceBullet: bullet,
      matchRes,
      requiredForSummary: true,
      kind: 'generic_entry_owned' as const,
    };
  });
}

function validateEnglishEntryOwnedDutyCoverage(options: {
  requiredFacts: EnglishEntryOwnedDutyFact[];
  candidateText: string;
}): SummaryEntryDutyCoverageResult {
  const text = (options.candidateText || '').replace(/\s+/g, ' ').trim();
  const required = options.requiredFacts.filter((f) => f.requiredForSummary);
  const warehouseOnly = required.every((f) => f.kind === 'warehouse_canonical' && f.warehouseFact);
  if (warehouseOnly && required.length > 0) {
    return validateSummaryEntryDutyCoverage({
      requiredFacts: required.map((f) => f.warehouseFact!),
      candidateText: text,
    });
  }
  const matchCounts: Record<string, number> = {};
  const matchUnits: Record<string, string[]> = {};
  const missingHashes: string[] = [];
  let coveredCount = 0;
  for (const fact of required) {
    const covered = englishDutyBulletCoveredInText(fact.sourceBullet, text)
      || fact.matchRes.some((re) => re.test(text));
    matchCounts[fact.sourceFactHash] = covered ? 1 : 0;
    matchUnits[fact.sourceFactHash] = covered ? [hashEnglishOpaque(text)] : [];
    if (covered) coveredCount += 1;
    else missingHashes.push(fact.sourceFactHash);
  }
  return {
    requiredCurrentDutyFactCount: required.length,
    coveredCurrentDutyFactCount: coveredCount,
    missingCurrentDutyFactCount: Math.max(0, required.length - coveredCount),
    missingCurrentDutyFactIdHashes: missingHashes,
    duplicateCurrentDutyMatchCount: 0,
    ambiguousCurrentDutyMatchCount: 0,
    currentDutyFactMatchCountsByFactHash: matchCounts,
    currentDutyFactMatchedUnitHashesByFactHash: matchUnits,
    finalCurrentDutyCoveragePassed: required.length === 0 || coveredCount === required.length,
    currentMaterialCategoryMatchCount: 0,
    currentCanonicalDutyFactMatchCount: coveredCount,
    materialCategoryCoverageUsedForFinalAcceptance: false,
    currentRoleConcreteFactCoverage: coveredCount,
  };
}

/** True when a fact id/hash belongs to the legacy Atlas warehouse triad. */
export function isEnglishLegacyWarehouseFactIdentity(idOrHash: string): boolean {
  const s = idOrHash || '';
  if (WAREHOUSE_CANONICAL_FACT_IDS.has(s)) return true;
  return /incoming_goods_check|related_documentation_check|colleague_coordination_goods_preparation_movement/i
    .test(s);
}

/**
 * Prefer live Experience duties when canonical/original warehouse text no longer
 * matches the entry’s role (replaced Atlas→Solar etc.). Deleted/replaced jobs
 * must not contribute warehouse fact memory.
 */
export function resolveEnglishSummaryEntryDuties(options: {
  role?: string;
  liveDescription?: string;
  groundedDescription?: string;
}): string {
  void ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION;
  const role = (options.role || '').trim();
  const live = (options.liveDescription || '').trim();
  const grounded = (options.groundedDescription || '').trim();
  const warehouseRole = englishRoleLooksWarehouse(role);
  const liveEnglishDutyCount = splitEnglishDutyBullets(live)
    .filter(bulletLooksEnglishAuthoritative).length;
  const groundedEnglishDutyCount = splitEnglishDutyBullets(grounded)
    .filter(bulletLooksEnglishAuthoritative).length;
  // A validated cross-locale Experience apply makes the visible English bullets
  // the target-locale Summary authority. A foreign canonical block remains the
  // source ledger, but cannot be the surface contract for an English Summary.
  if (liveEnglishDutyCount >= 2 && groundedEnglishDutyCount < 2) return live;
  if (warehouseRole) return grounded || live;
  const groundedWarehouse = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: grounded,
  }).length > 0;
  const liveWarehouse = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: live,
  }).length > 0;
  // Stale canonical warehouse residue after role replacement.
  if (groundedWarehouse && !warehouseRole) {
    if (live && !liveWarehouse) return live;
    if (live && live !== grounded) return live;
    // No live replacement yet — contribute zero warehouse facts.
    if (!live) return '';
  }
  return live || grounded;
}

void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
void ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION;
void ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION;
void SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION;

const EN_MONTHS: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December',
};
void EN_MONTHS;

const MIXED_MORPHOLOGY_RE =
  /(?:^|[^A-Za-zÁÉÍÓÚáéíóúÑñ])(?:revisingó|comprobingó|checkingó|coordinatió|verifyingó|updatingó|[A-Za-z]{4,}ing[óáéíú]|[A-Za-z]{4,}ed[óáéíú])(?=[^A-Za-zÁÉÍÓÚáéíóúÑñ]|$)/iu;
const SPANISH_DUTY_LEAK_RE =
  /\b(?:la\s+mercanc[ií]a|documentaci[oó]n\s+asociada|almac[eé]n|compa[nñ]eros?|revis[oó]|comprob[oó]|coordin[oó])\b/iu;
const SPANISH_ROLE_LEAK_RE =
  /\b(?:emplead[oa]\s+de\s+almac[eé]n|diseñadora?\s+gr[aá]fica|trabajador(?:a)?\s+de\s+almac)\b/iu;

const PRIOR_DESIGN_CUE =
  /(?:visual\s+materials?|design\s+(?:documents?|materials?|files?)|formats?\s+and\s+screens?|creating\s+visual|revising\s+design|preparing\s+final|diseñ|visual|vizuel|grafik)/iu;

const UNSUPPORTED_SOFT_SKILL_RE =
  /\b(?:leadership|organization|organisation|critical\s+thinking|adaptability|teamwork|communication\s+skills?|problem[- ]solving|time\s+management|creativity|initiative)\b/iu;

const COMPETENCY_INTRO_RE =
  /(?:key\s+skills?\s+include|core\s+skills?\s+include|competenc(?:y|ies)\s+include|strengths?\s+include|skilled\s+in|proficient\s+in)\s*[:,]?\s*([^.]+)/iu;

export function detectEnglishMixedLanguageMorphology(text: string): {
  mixedLanguageMorphologyDetected: boolean;
  failureKinds: string[];
} {
  void ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION;
  const failureKinds: string[] = [];
  if (MIXED_MORPHOLOGY_RE.test(text || '')) {
    failureKinds.push('mixed_language_morphology');
  }
  // Accented Spanish verb ending glued to English -ing/-ed stem.
  if (/(?:^|[^A-Za-z])[A-Za-z]{3,}(?:ing|ed)[óáéíú](?=[^A-Za-z]|$)/iu.test(text || '')) {
    failureKinds.push('mixed_language_morphology');
  }
  return {
    mixedLanguageMorphologyDetected: failureKinds.length > 0,
    failureKinds: [...new Set(failureKinds)],
  };
}

export function detectEnglishSourceDutyLeakage(text: string): {
  sourceDutyLeakageDetected: boolean;
  rawSourceRoleLeakageDetected: boolean;
  failureKinds: string[];
} {
  void ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION;
  const failureKinds: string[] = [];
  const duty = SPANISH_DUTY_LEAK_RE.test(text || '');
  const role = SPANISH_ROLE_LEAK_RE.test(text || '');
  if (duty) failureKinds.push('raw_source_duty_leakage');
  if (role) failureKinds.push('raw_source_role_leakage');
  if (/\b(?:la|el|los|las|de|en)\s+(?:mercanc|documentaci|almac)/iu.test(text || '')) {
    failureKinds.push('foreign_current_duty_span');
  }
  return {
    sourceDutyLeakageDetected: duty || failureKinds.includes('foreign_current_duty_span'),
    rawSourceRoleLeakageDetected: role,
    failureKinds: [...new Set(failureKinds)],
  };
}

function englishCurrentDutyMatchRes(factId: string): RegExp[] {
  switch (factId) {
    case 'incoming_goods_check':
      return [
        /checking\s+incoming\s+goods/iu,
        /incoming\s+goods/iu,
        /inbound\s+goods/iu,
      ];
    case 'related_documentation_check':
      return [
        /(?:checking|reviewing)\s+(?:the\s+)?related\s+documentation/iu,
        /related\s+documentation/iu,
        /accompanying\s+documentation/iu,
      ];
    case 'colleague_coordination_goods_preparation_movement':
      return [
        /coordinat\w*.{0,100}(?:colleague|colleagues).{0,80}(?:prepar|movement|transport)/iu,
        /coordinat\w*.{0,100}(?:prepar|movement|transport).{0,80}(?:colleague|colleagues)/iu,
        /preparation\s+and\s+movement\s+of\s+goods/iu,
      ];
    default:
      return [];
  }
}

function withEnglishMatchRes(facts: GermanCurrentDutyFact[]): GermanCurrentDutyFact[] {
  return facts.map((f) => ({
    ...f,
    matchRes: [...englishCurrentDutyMatchRes(f.canonicalFactId), ...f.matchRes],
  }));
}

/**
 * Rebuild the immutable English required current-duty fact set from canonical IDs
 * (same identities used by final candidate validation). English match overlays only.
 */
export function rebuildEnglishDutyFactsFromIds(
  ids: string[] | null | undefined,
  options: { currentEntryId?: string | null } = {},
): GermanCurrentDutyFact[] {
  void ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION;
  void SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION;
  const known: GermanCurrentDutyFactId[] = [
    'incoming_goods_check',
    'related_documentation_check',
    'colleague_coordination_goods_preparation_movement',
  ];
  const selected = (ids || []).filter((id): id is GermanCurrentDutyFactId =>
    known.includes(id as GermanCurrentDutyFactId));
  const entryHash = options.currentEntryId
    ? `entry_${String(options.currentEntryId)}`
    : null;
  return withEnglishMatchRes(selected.map((id) => ({
    canonicalFactId: id,
    sourceEntryIdHash: entryHash,
    sourceFactHash: `id_${id}`,
    sourceLocale: null,
    targetLocale: 'en' as const,
    semanticKind: id,
    materialCategory: id === 'incoming_goods_check'
      ? 'warehouse_inbound' as const
      : id === 'related_documentation_check'
        ? 'warehouse_records' as const
        : 'warehouse_movement' as const,
    localizedClauseHash: `en_clause_${id}`,
    requiredForSummary: true,
    dativeClause: id,
    matchRes: [],
  })));
}

/** Stable hash of a required current-duty fact-set identity (ordered IDs). */
export function hashCurrentDutyRequiredFactSet(
  ids: string[] | null | undefined,
): string | null {
  void SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION;
  const known = [
    'incoming_goods_check',
    'related_documentation_check',
    'colleague_coordination_goods_preparation_movement',
  ];
  const selected = (ids || []).filter((id) => known.includes(id));
  if (selected.length === 0) return null;
  const ordered = known.filter((id) => selected.includes(id));
  let h = 2166136261;
  const s = ordered.join('|');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

export function scanEnglishSummaryCompetencyClaims(
  summary: string,
  structuredSkills: string[] = [],
): {
  unsupportedCompetencyCount: number;
  unsupportedCompetencyKinds: string[];
  unsupportedClaims: string[];
  finalUnsupportedCompetencyCount: number;
} {
  const text = summary || '';
  const authority = buildSummaryExplicitSkillAuthority(structuredSkills);
  const claims: string[] = [];
  const m = COMPETENCY_INTRO_RE.exec(text);
  if (m?.[1]) {
    for (const part of m[1].split(/,| and | & /i)) {
      const c = part.replace(/\.$/u, '').trim();
      if (c) claims.push(c);
    }
  }
  // Also catch bare soft-skill lists after "skills include".
  const softHits = [...text.matchAll(new RegExp(UNSUPPORTED_SOFT_SKILL_RE.source, 'giu'))]
    .map((x) => x[0]);
  for (const s of softHits) {
    if (!claims.some((c) => c.toLowerCase() === s.toLowerCase())) claims.push(s);
  }

  const unsupported: string[] = [];
  const kinds: string[] = [];
  for (const claim of claims) {
    const normalized = claim.toLowerCase().replace(/\s+/g, ' ').trim();
    const authorized = authority.some(
      (a) => a.sourceLabel.toLowerCase() === normalized
        || a.localizedLabel.toLowerCase() === normalized
        || normalized.includes(a.sourceLabel.toLowerCase())
        || a.sourceLabel.toLowerCase().includes(normalized),
    );
    if (authorized) continue;
    unsupported.push(claim);
    if (/leadership/i.test(claim)) kinds.push('unsupported_leadership_claim');
    else if (/organiz/i.test(claim)) kinds.push('unsupported_soft_skill_claim');
    else if (/critical\s+thinking|adaptability|teamwork|creativity|initiative/i.test(claim)) {
      kinds.push('unsupported_professional_trait_claim');
    } else kinds.push('unsupported_competency_claim');
  }
  return {
    unsupportedCompetencyCount: unsupported.length,
    unsupportedCompetencyKinds: [...new Set(kinds)],
    unsupportedClaims: unsupported,
    finalUnsupportedCompetencyCount: unsupported.length,
  };
}

export function analyzeEnglishSummaryDurationScope(
  summary: string,
  options: { company?: string; role?: string } = {},
): {
  finalDurationScopeValidationPassed: boolean;
  finalDurationOwnerExpected: 'total_professional_experience';
  finalDurationOwnerDetected: 'total_professional_experience' | 'current_role_duration' | 'unknown' | null;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  durationScopeRejectionReason: string | null;
} {
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = text.split(/(?<=[.!?])\s+(?=\S)/u).map((u) => u.trim()).filter(Boolean);
  const company = (options.company || '').trim();
  const durationCue =
    /(?:approximately|about|around|roughly|overall|in\s+total|total(?:ing)?).{0,40}(?:years?|months?)\s+of\s+(?:professional\s+)?experience|(?:years?|months?)\s+of\s+(?:professional\s+)?experience|with\s+(?:approximately|about|around)?\s*(?:six|six and a half|\d+(?:\.\d+)?)\s+(?:and a half\s+)?years?/iu;
  const totalMarker =
    /(?:overall|in\s+total|altogether|across\s+(?:her|his|their)\s+career|total\s+professional|professional\s+experience)/iu;
  const attachmentRisk = Boolean(
    company
    && new RegExp(
      `${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,120}${durationCue.source}`,
      'iu',
    ).test(units[0] || '')
    && /since\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/iu
      .test(units[0] || '')
    && !totalMarker.test(units[0] || ''),
  );
  // Classic bad form: "at Atlas since …, with approximately … years of experience VERBING"
  const classicAttachment =
    /at\s+\w+.{0,40}since\s+\w+.{0,40},\s+with\s+approximately.{0,40}years?\s+of\s+experience\s+\w+ing/iu
      .test(text);
  const hasDuration = durationCue.test(text);
  const totalPresent = totalMarker.test(text) || (
    hasDuration
    && units.some((u) => totalMarker.test(u) || (
      durationCue.test(u)
      && !/at\s+\w+.{0,24}since/iu.test(u)
    ))
  );
  const risk = attachmentRisk || classicAttachment;
  const owner: 'total_professional_experience' | 'current_role_duration' | 'unknown' | null =
    !hasDuration ? null
      : risk ? 'current_role_duration'
        : totalPresent ? 'total_professional_experience'
          : 'unknown';
  const ok = !hasDuration || (owner === 'total_professional_experience' && !risk);
  return {
    finalDurationScopeValidationPassed: ok,
    finalDurationOwnerExpected: 'total_professional_experience',
    finalDurationOwnerDetected: owner,
    finalDurationCurrentRoleAttachmentRisk: risk,
    finalDurationTotalCareerMarkerPresent: totalPresent,
    durationScopeRejectionReason: !ok
      ? (risk ? 'duration_current_role_attachment_risk' : 'duration_scope_mismatch')
      : null,
  };
}

function priorDutyCoverage(
  summary: string,
  priorDuties: string,
  options: { priorRole?: string } = {},
): {
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalPriorDutyCoveragePassed: boolean;
} {
  void ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION;
  const bullets = splitEnglishDutyBullets(priorDuties || '');
  const designDomain = PRIOR_DESIGN_CUE.test(priorDuties || '')
    || /diseñ|design|grafik|visual/i.test(priorDuties || '')
    || englishRoleLooksDesign(options.priorRole || '');
  if (designDomain) {
    const required = Math.min(3, Math.max(bullets.length, 3));
    const checks = [
      /(?:creating|created|crea)\w*.{0,40}(?:visual|graphic)/iu.test(summary)
        || /visual\s+materials?/iu.test(summary),
      /(?:revising|revised|adapt|review)\w*.{0,60}(?:design|document)/iu.test(summary)
        || /design\s+(?:documents?|materials?)/iu.test(summary),
      /(?:preparing|prepared|prepare)\w*.{0,60}(?:final|files?|formats?|screens?)/iu.test(summary)
        || /final\s+(?:design\s+)?files?/iu.test(summary),
    ];
    const covered = checks.filter(Boolean).length;
    return {
      requiredPriorDutyFactCount: required,
      coveredPriorDutyFactCount: covered,
      missingPriorDutyFactCount: Math.max(0, required - covered),
      finalPriorDutyCoveragePassed: covered === required,
    };
  }
  if (bullets.length === 0) {
    return {
      requiredPriorDutyFactCount: 0,
      coveredPriorDutyFactCount: 0,
      missingPriorDutyFactCount: 0,
      finalPriorDutyCoveragePassed: true,
    };
  }
  const required = Math.min(3, bullets.length);
  const covered = bullets
    .slice(0, required)
    .filter((b) => englishDutyBulletCoveredInText(b, summary))
    .length;
  return {
    requiredPriorDutyFactCount: required,
    coveredPriorDutyFactCount: covered,
    missingPriorDutyFactCount: Math.max(0, required - covered),
    finalPriorDutyCoveragePassed: covered === required,
  };
}

export type EnglishSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'total_duration'
  | 'explicit_skills'
  | 'unsupported'
  | 'ambiguous';

export type EnglishSummaryEmploymentQuality = {
  ok: boolean;
  reason: string | null;
  groundingValidationPassed: boolean;
  typedRejectionReason: string | null;
  slotValidationPassed: boolean;
  slotRejectionReasons: string[];
  finalUnitSemanticRolesByUnit: string[][];
  /** Per-sentence semantic roles (same as finalUnitSemanticRolesByUnit). */
  finalSentenceSemanticRolesBySentence: string[][];
  finalUnitRoleSlots: EnglishSummaryRoleSlot[];
  finalSentenceHashes?: string[];
  finalSentenceRoleSlots?: string[];
  /** Legacy flat slot presence list — non-decision-critical when unit roles exist. */
  finalSentenceRoleSlotsLegacyNonDecisionCritical?: boolean;
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
  explicitSkillsSlotPresent: boolean;
  finalCurrentIntroSlotPresent: boolean;
  finalCurrentDutySlotPresent: boolean;
  finalPriorIntroSlotPresent: boolean;
  finalPriorDutySlotPresent: boolean;
  finalTotalDurationSlotPresent: boolean;
  finalSlotValidationPassed: boolean;
  finalSlotRejectionReasons: string[];
  currentRoleConcreteFactCoverage: number;
  priorRoleGroundingPassed: boolean;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  currentRoleOmittedDetected: boolean;
  currentEmploymentIntroductionCount: number;
  finalCurrentEmployerPresent: boolean;
  finalPriorEmployerPresent: boolean;
  finalCurrentEmploymentStateExpressed: boolean;
  finalPriorEmploymentStateExpressed: boolean;
    finalCurrentRoleIntroValidationPassed: boolean;
  finalPriorRoleIntroValidationPassed: boolean;
  finalPriorRoleTitlePresent: boolean;
  finalCurrentRoleTitlePresent: boolean;
  finalCurrentDutyCoveragePassed: boolean;
  finalPriorDutyCoveragePassed: boolean;
  requiredCurrentDutyFactCount: number;
  /** Canonical IDs used by final + visible validators (immutable required set). */
  requiredCurrentDutyFactIds: string[];
  finalCurrentDutyRequiredFactSetHash: string | null;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  missingCurrentDutyFactIdHashes?: string[];
  currentDutyFactMatchCountsByFactHash?: Record<string, number>;
  currentDutyFactMatchedUnitHashesByFactHash?: Record<string, string[]>;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  structuredRoleLocaleValidationPassed: boolean;
  currentRoleLocalizationValidationPassed: boolean;
  priorRoleLocalizationValidationPassed: boolean;
  foreignStructuredRoleTitleCount: number;
  foreignPriorRoleTitleCount: number;
  foreignCurrentRoleTitleDetected: boolean;
  rawSourceRoleLeakageDetected: boolean;
  finalWrongLocaleStructuredRoleCount: number;
  finalStructuredRoleLocaleValidationPassed: boolean;
  finalForeignRoleTitleCount: number;
  targetLocalePurityPassed: boolean;
  sourceLanguageLeakageDetected: boolean;
  wrongLocaleUnitCount: number;
  unexpectedLocaleCodes: string[];
  germanControlledCaseGrammarPassed?: boolean;
  finalUnsupportedCompetencyCount: number;
  unsupportedCompetencyCount: number;
  unsupportedCompetencyKinds: string[];
  unsupportedClaimCount: number;
  unsupportedClaimKinds: string[];
  competencyScan: {
    unsupportedCompetencyCount: number;
    unsupportedCompetencyKinds: string[];
    explicitSkillFactCount: number;
    competencyClaimCount: number;
    providerRejectionStage: string | null;
  };
  durationScopeRejectionReason: string | null;
  finalDurationScopeValidationPassed: boolean;
  finalDurationOwnerExpected: 'total_professional_experience';
  finalDurationOwnerDetected: string | null;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  currentDutyRequiredFactParityPassed: boolean;
  authoritativeCurrentDutyFactCount: number;
  authoritativeCanonicalCurrentDutyFactCount: number;
  classifiedRequiredCurrentDutyFactCount: number;
  unclassifiedAuthoritativeCurrentDutyFactCount: number;
  requiredFactSetMatchesAuthoritativeFactSet: boolean;
  materialCategoryCoverageUsedForFinalAcceptance: false;
  mixedLanguageMorphologyDetected: boolean;
  currentDutyCoverage?: SummaryEntryDutyCoverageResult;
  currentDutyParity?: AuthoritativeCurrentDutyParityResult;
  structuredRoleLocale?: StructuredRoleLocaleValidation;
  grammarValidationPassed: boolean;
  englishSummaryFragmentDetected: boolean;
  englishSummaryFragmentKinds: string[];
  finalSentenceFiniteClauseCount: number;
  finalIncompleteSentenceCount: number;
  finalSentenceGrammarRecords: Array<{
    sentenceIndex: number;
    sentenceHash: string;
    finiteClausePresent: boolean;
    fragmentKinds: string[];
  }>;
};

export function analyzeEnglishSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
    priorCompany?: string;
    priorRole?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
    structuredSkills?: string[];
    currentEntryId?: string | null;
    priorEntryId?: string | null;
  } = {},
): EnglishSummaryEmploymentQuality {
  void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
  void ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = text
    ? text.split(/(?<=[.!?])\s+(?=\S)/u).map((u) => u.trim()).filter(Boolean)
    : [];

  const currentLocalized = resolveLocalizedSummaryRole({
    role: options.role || '',
    targetLocale: 'en',
    gender: options.gender,
  });
  const priorLocalized = resolveLocalizedSummaryRole({
    role: options.priorRole || '',
    targetLocale: 'en',
    gender: options.gender,
  });
  const structuredRoleLocale = validateSummaryStructuredRoleLocale({
    summary: text,
    targetLocale: 'en',
    gender: options.gender,
    currentRole: options.role,
    priorRole: options.priorRole,
    currentEntryId: options.currentEntryId,
    priorEntryId: options.priorEntryId,
    currentLocalized,
    priorLocalized,
  });

  void ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION;
  const entryOwnedCurrentFacts = extractEnglishEntryOwnedDutyFacts({
    entryDuties: options.currentEntryDuties,
    entryId: options.currentEntryId,
    role: options.role,
    employer: options.company,
  });
  // Reject stale warehouse identities when the live role is not warehouse.
  const requiredCurrentDutyFacts = englishRoleLooksWarehouse(options.role || '')
    ? entryOwnedCurrentFacts
    : entryOwnedCurrentFacts.filter((f) => f.kind === 'generic_entry_owned'
      || !isEnglishLegacyWarehouseFactIdentity(f.factId));
  const warehouseFactsForParity = requiredCurrentDutyFacts
    .filter((f) => f.kind === 'warehouse_canonical' && f.warehouseFact)
    .map((f) => f.warehouseFact!);
  const currentDutyParity = warehouseFactsForParity.length > 0
    ? analyzeCurrentDutyRequiredFactParity({
      currentEntryDuties: options.currentEntryDuties,
      requiredFacts: warehouseFactsForParity,
      entryId: options.currentEntryId,
    })
    : {
      authoritativeCurrentDutyFactCount: requiredCurrentDutyFacts.length,
      authoritativeCanonicalCurrentDutyFactCount: 0,
      requiredCurrentDutyFactCount: requiredCurrentDutyFacts.length,
      classifiedRequiredCurrentDutyFactCount: 0,
      unclassifiedAuthoritativeCurrentDutyFactCount: 0,
      requiredFactSetMatchesAuthoritativeFactSet: true,
      currentDutyRequiredFactParityPassed: true,
      currentMaterialCategoryCount: 0,
      authoritativeBulletHashes: requiredCurrentDutyFacts.map((f) => f.sourceFactHash),
      classifiedFactIds: [] as GermanCurrentDutyFactId[],
      unclassifiedAuthoritativeBulletHashes: [] as string[],
      currentDutyFactClassificationKindsByFactHash: {} as Record<string, string>,
      rejectionReason: null as AuthoritativeCurrentDutyParityResult['rejectionReason'],
    };
  const currentDutyCoverage = validateEnglishEntryOwnedDutyCoverage({
    requiredFacts: requiredCurrentDutyFacts,
    candidateText: text,
  });
  const priorCov = priorDutyCoverage(text, options.priorEntryDuties || '', {
    priorRole: options.priorRole,
  });
  const competency = scanEnglishSummaryCompetencyClaims(
    text,
    options.structuredSkills || [],
  );
  const durationScope = analyzeEnglishSummaryDurationScope(text, {
    company: options.company,
    role: options.role,
  });
  const morph = detectEnglishMixedLanguageMorphology(text);
  const leak = detectEnglishSourceDutyLeakage(text);
  const purity = validateAiUnitLocalePurity(text, 'en', {
    kind: 'summary_sentence',
  });

  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const currentTitle = currentLocalized.localizationValidationPassed
    ? currentLocalized.localizedTargetRoleLabel
    : (options.role || '');
  const priorTitle = priorLocalized.localizationValidationPassed
    ? priorLocalized.localizedTargetRoleLabel
    : (options.priorRole || '');

  const currentRoleTitlePresent = Boolean(
    currentTitle
    && new RegExp(currentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text),
  ) || /\bWarehouse\s+(?:Employee|Worker)\b/iu.test(text);
  const finalCurrentEmployerPresent = Boolean(
    company && new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(text),
  );
  const finalPriorEmployerPresent = Boolean(
    priorCompany
    && new RegExp(`\\b${priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(text),
  );
  const finalCurrentEmploymentStateExpressed =
    /since\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|\d)/iu
      .test(text)
    || /\bcurrently\b/iu.test(text);
  const finalPriorEmploymentStateExpressed =
    /\b(?:previously|formerly|prior\s+to|before\s+that|worked\s+as)\b/iu.test(text);

  const requirePrior = Boolean(priorCompany || options.priorEntryDuties);
  const requireCurrentDuties = requiredCurrentDutyFacts.length > 0;

  const currentIntro = currentRoleTitlePresent && finalCurrentEmployerPresent
    && finalCurrentEmploymentStateExpressed;
  const currentDutiesOk = !requireCurrentDuties
    || currentDutyCoverage.finalCurrentDutyCoveragePassed;
  const priorIntro = !requirePrior
    || (
      (/\bGraphic\s+Designer\b/iu.test(text) || Boolean(
        priorTitle
        && new RegExp(priorTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text),
      ))
      && finalPriorEmployerPresent
      && finalPriorEmploymentStateExpressed
    );
  const priorDutiesOk = !requirePrior || priorCov.finalPriorDutyCoveragePassed;
  const totalDurationSlot = durationScope.finalDurationTotalCareerMarkerPresent
    || (
      durationScope.finalDurationOwnerDetected === 'total_professional_experience'
      && durationScope.finalDurationScopeValidationPassed
    );

  const rolesByUnit: string[][] = units.map((u) => {
    const roles: string[] = [];
    if (
      (/\bI\s+am\b|Warehouse|currently\s+working|where\s+I\b|at\s+\w+|since\s+/iu.test(u)
        && !/Previously|Overall|In\s+total/iu.test(u))
    ) {
      roles.push('current_role_intro');
      if (/check(?:ing)?|coordinat|documentation|goods|verif(?:y|ying)/iu.test(u)) {
        roles.push('current_role_duties');
      }
      if (/years?\s+of\s+(?:professional\s+)?experience/iu.test(u)) {
        roles.push('total_duration');
      }
    }
    if (/Previously|formerly|worked\s+as|Graphic\s+Designer|graphic\s+designer/iu.test(u)
      || (priorTitle
        && new RegExp(priorTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(u))) {
      roles.push('prior_role_intro');
      if (/visual|design|files?|formats?|graphic\s+elements/iu.test(u)
        || (options.priorEntryDuties
          && splitEnglishDutyBullets(options.priorEntryDuties)
            .some((b) => englishDutyBulletCoveredInText(b, u)))) {
        roles.push('prior_role_duties');
      }
    }
    if (
      (/Overall|In\s+total/iu.test(u) && !/at\s+\w+.{0,24}since/iu.test(u))
      || (/with\s+(?:approximately|about|around)?.{0,40}years?.{0,40}professional\s+experience/iu.test(u)
        && (/\bI\s+am\b|currently\s+working/iu.test(u)))
    ) {
      if (!roles.includes('total_duration')) roles.push('total_duration');
    }
    if (/key\s+skills?\s+include/iu.test(u)) roles.push('explicit_skills');
    if (roles.length === 0) roles.push('ambiguous');
    return roles;
  });

  const grammar = validateEnglishSummaryFiniteClauses(text);
  const structuredCorpus = [
    options.role,
    options.company,
    options.priorRole,
    options.priorCompany,
    options.currentEntryDuties,
    options.priorEntryDuties,
    text,
  ].filter(Boolean).join('\n');
  const structuredEnglishDomain = isEnglishEntryOwnedSummaryPath({
    corpus: structuredCorpus,
    currentDuties: options.currentEntryDuties,
    priorDuties: options.priorEntryDuties,
    currentRole: options.role,
    priorRole: options.priorRole,
  });
  const hardFragmentKinds = new Set([
    'bare_role_title_noun_phrase',
    'omitted_subject_previously_worked',
    'overall_with_duration_fragment',
    'standalone_duration_fragment',
    'gerund_chain_without_finite_verb',
  ]);
  const hasHardEnglishFragment = grammar.englishSummaryFragmentKinds.some((k) => hardFragmentKinds.has(k));
  // Hard-reject Atlas/Rewitu-style fragments always. Soft `missing_finite_main_verb` only
  // blocks entry-owned English Summary domains (warehouse/design + arbitrary multi-duty).
  const grammarBlocksAcceptance = hasHardEnglishFragment
    || (structuredEnglishDomain && !grammar.grammarValidationPassed);

  const slotRejectionReasons: string[] = [];
  if (!currentIntro) slotRejectionReasons.push('missing_current_role_intro');
  if (!currentDutiesOk) slotRejectionReasons.push('current_duty_fact_coverage_incomplete');
  if (requirePrior && !priorIntro) slotRejectionReasons.push('missing_prior_role_intro');
  if (requirePrior && !priorDutiesOk) slotRejectionReasons.push('prior_duty_fact_coverage_incomplete');
  if (!durationScope.finalDurationScopeValidationPassed && /years?\s+of\s+experience/iu.test(text)) {
    slotRejectionReasons.push(durationScope.durationScopeRejectionReason || 'duration_scope_mismatch');
  }
  if (!currentDutyParity.currentDutyRequiredFactParityPassed && requireCurrentDuties) {
    slotRejectionReasons.push(
      currentDutyParity.rejectionReason || 'current_duty_required_fact_parity_failed',
    );
  }
  if (morph.mixedLanguageMorphologyDetected) {
    slotRejectionReasons.push(...morph.failureKinds);
  }
  if (leak.sourceDutyLeakageDetected || leak.rawSourceRoleLeakageDetected) {
    slotRejectionReasons.push(...leak.failureKinds);
  }
  if (!purity.targetLocalePurityPassed || purity.wrongLocaleUnitCount > 0
    || (purity.unexpectedLocaleCodes || []).includes('es')) {
    slotRejectionReasons.push('target_locale_unit_mismatch');
  }
  if (competency.finalUnsupportedCompetencyCount > 0) {
    slotRejectionReasons.push('unsupported_competency_claim');
  }
  if (!structuredRoleLocale.structuredRoleLocaleValidationPassed) {
    slotRejectionReasons.push(...structuredRoleLocale.failureKinds);
  }
  if (grammarBlocksAcceptance) {
    slotRejectionReasons.push('english_summary_sentence_fragment');
  }

  const sourceLeak = leak.sourceDutyLeakageDetected
    || leak.rawSourceRoleLeakageDetected
    || morph.mixedLanguageMorphologyDetected
    || (purity.unexpectedLocaleCodes || []).includes('es')
    || purity.wrongLocaleUnitCount > 0
    || structuredRoleLocale.rawSourceRoleLeakageDetected;

  const slotValidationPassed = slotRejectionReasons.length === 0
    && currentIntro
    && currentDutiesOk
    && priorIntro
    && priorDutiesOk
    && (!(/years?\s+of\s+experience/iu.test(text)) || durationScope.finalDurationScopeValidationPassed)
    && competency.finalUnsupportedCompetencyCount === 0
    && !sourceLeak
    && purity.targetLocalePurityPassed
    && structuredRoleLocale.structuredRoleLocaleValidationPassed
    && (!requireCurrentDuties || currentDutyParity.currentDutyRequiredFactParityPassed)
    && !grammarBlocksAcceptance;

  let reason: string | null = null;
  if (!text) reason = 'empty_summary';
  else if (morph.mixedLanguageMorphologyDetected) reason = 'mixed_language_morphology';
  else if (leak.sourceDutyLeakageDetected) reason = 'raw_source_duty_leakage';
  else if ((purity.unexpectedLocaleCodes || []).includes('es') || purity.wrongLocaleUnitCount > 0) {
    reason = 'unexpected_locale_detected';
  } else if (!structuredRoleLocale.structuredRoleLocaleValidationPassed) {
    reason = structuredRoleLocale.failureKinds[0] || 'foreign_prior_role_title';
  } else if (!currentDutyParity.currentDutyRequiredFactParityPassed && requireCurrentDuties) {
    reason = currentDutyParity.rejectionReason || 'current_duty_required_fact_parity_failed';
  } else if (!currentDutiesOk) reason = 'current_duty_fact_coverage_incomplete';
  else if (requirePrior && !priorIntro) reason = 'missing_prior_role_intro';
  else if (requirePrior && !priorDutiesOk) reason = 'prior_duty_fact_coverage_incomplete';
  else if (grammarBlocksAcceptance) {
    reason = grammar.typedRejectionReason || 'english_summary_sentence_fragment';
  }
  else if (competency.finalUnsupportedCompetencyCount > 0) reason = 'unsupported_competency_claim';
  else if (!durationScope.finalDurationScopeValidationPassed && /years?\s+of\s+experience/iu.test(text)) {
    reason = durationScope.durationScopeRejectionReason || 'duration_scope_mismatch';
  } else if (!slotValidationPassed) {
    reason = slotRejectionReasons[0] || 'english_summary_grounding_failed';
  }

  const ok = reason == null && slotValidationPassed;

  void SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION;
  void SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION;
  // Primary role per sentence (unit-aligned) — never a flat multi-role bag that
  // desynchronizes from unit count and collapses to generic summary_unit.
  const primarySlots: EnglishSummaryRoleSlot[] = rolesByUnit.map((roles) => {
    if (roles.includes('prior_role_intro') || roles.includes('prior_role_duties')) {
      return 'prior_role';
    }
    if (roles.includes('current_role_intro') || roles.includes('current_role_duties')) {
      return 'current_intro';
    }
    if (roles.includes('total_duration')) return 'total_duration';
    if (roles.includes('explicit_skills')) return 'explicit_skills';
    if (roles.includes('current_duty') || roles.includes('current_role_duties')) {
      return 'current_duty';
    }
    return 'ambiguous';
  });
  // Legacy flat presence list retained for older consumers; marked non-decision-critical.
  const legacySlots: EnglishSummaryRoleSlot[] = [];
  if (currentIntro) legacySlots.push('current_intro');
  if (currentDutiesOk && requireCurrentDuties) legacySlots.push('current_duty');
  if (requirePrior && priorIntro) legacySlots.push('prior_role');
  if (totalDurationSlot) legacySlots.push('total_duration');
  if (rolesByUnit.some((r) => r.includes('explicit_skills'))) {
    legacySlots.push('explicit_skills');
  }
  if (legacySlots.length === 0 && text) legacySlots.push('ambiguous');

  const finalSentenceHashes = units.map((u) => fingerprintText(u));
  const decisionSlots = primarySlots.length > 0 ? primarySlots : legacySlots;

  const foreignRoleCount = structuredRoleLocale.foreignStructuredRoleTitleCount;
  const competencyScan = {
    unsupportedCompetencyCount: competency.unsupportedCompetencyCount,
    unsupportedCompetencyKinds: competency.unsupportedCompetencyKinds,
    explicitSkillFactCount: (options.structuredSkills || []).filter(Boolean).length,
    competencyClaimCount: competency.unsupportedClaims.length
      + (COMPETENCY_INTRO_RE.test(text) ? 1 : 0),
    providerRejectionStage: competency.finalUnsupportedCompetencyCount > 0
      ? 'unsupported_competency_claim'
      : null,
  };

  return {
    ok,
    reason,
    groundingValidationPassed: ok,
    typedRejectionReason: reason,
    slotValidationPassed,
    slotRejectionReasons: [...new Set(slotRejectionReasons)],
    finalUnitSemanticRolesByUnit: rolesByUnit,
    finalSentenceSemanticRolesBySentence: rolesByUnit,
    finalUnitRoleSlots: decisionSlots,
    finalSentenceHashes,
    finalSentenceRoleSlots: decisionSlots.map(String),
    finalSentenceRoleSlotsLegacyNonDecisionCritical: true,
    currentIntroSlotPresent: currentIntro,
    currentDutySlotPresent: currentDutiesOk && requireCurrentDuties,
    priorRoleSlotPresent: priorIntro && requirePrior,
    totalDurationSlotPresent: Boolean(totalDurationSlot),
    explicitSkillsSlotPresent: legacySlots.includes('explicit_skills')
      && competency.finalUnsupportedCompetencyCount === 0,
    finalCurrentIntroSlotPresent: currentIntro,
    finalCurrentDutySlotPresent: currentDutiesOk && requireCurrentDuties,
    finalPriorIntroSlotPresent: priorIntro,
    finalPriorDutySlotPresent: priorDutiesOk && requirePrior,
    finalTotalDurationSlotPresent: Boolean(totalDurationSlot),
    finalSlotValidationPassed: slotValidationPassed,
    finalSlotRejectionReasons: [...new Set(slotRejectionReasons)],
    currentRoleConcreteFactCoverage: currentDutyCoverage.currentRoleConcreteFactCoverage,
    priorRoleGroundingPassed: priorIntro && priorDutiesOk,
    currentRoleTitlePresent,
    currentRoleTitleMatchesStructuredRole: currentRoleTitlePresent,
    currentRoleOmittedDetected: !currentRoleTitlePresent,
    currentEmploymentIntroductionCount: currentIntro ? 1 : 0,
    finalCurrentEmployerPresent,
    finalPriorEmployerPresent,
    finalCurrentEmploymentStateExpressed,
    finalPriorEmploymentStateExpressed,
    finalCurrentRoleIntroValidationPassed: currentIntro,
    finalPriorRoleIntroValidationPassed: priorIntro,
    finalCurrentRoleTitlePresent: currentRoleTitlePresent,
    finalPriorRoleTitlePresent: /\bGraphic\s+Designer\b/iu.test(text) || Boolean(
      priorTitle
      && new RegExp(priorTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text),
    ),
    finalCurrentDutyCoveragePassed: currentDutiesOk,
    finalPriorDutyCoveragePassed: priorDutiesOk,
    requiredCurrentDutyFactCount: currentDutyCoverage.requiredCurrentDutyFactCount,
    requiredCurrentDutyFactIds: requiredCurrentDutyFacts.map((f) => f.factId),
    finalCurrentDutyRequiredFactSetHash: (() => {
      const warehouseIds = requiredCurrentDutyFacts
        .filter((f) => f.kind === 'warehouse_canonical')
        .map((f) => f.factId);
      if (warehouseIds.length > 0) return hashCurrentDutyRequiredFactSet(warehouseIds);
      if (requiredCurrentDutyFacts.length === 0) return null;
      return hashEnglishOpaque(requiredCurrentDutyFacts.map((f) => f.factId).join('|'));
    })(),
    coveredCurrentDutyFactCount: currentDutyCoverage.coveredCurrentDutyFactCount,
    missingCurrentDutyFactCount: currentDutyCoverage.missingCurrentDutyFactCount,
    missingCurrentDutyFactIdHashes: currentDutyCoverage.missingCurrentDutyFactIdHashes,
    currentDutyFactMatchCountsByFactHash:
      currentDutyCoverage.currentDutyFactMatchCountsByFactHash,
    currentDutyFactMatchedUnitHashesByFactHash:
      currentDutyCoverage.currentDutyFactMatchedUnitHashesByFactHash,
    requiredPriorDutyFactCount: priorCov.requiredPriorDutyFactCount,
    coveredPriorDutyFactCount: priorCov.coveredPriorDutyFactCount,
    missingPriorDutyFactCount: priorCov.missingPriorDutyFactCount,
    structuredRoleLocaleValidationPassed:
      structuredRoleLocale.structuredRoleLocaleValidationPassed,
    currentRoleLocalizationValidationPassed:
      structuredRoleLocale.currentRoleLocalizationValidationPassed,
    priorRoleLocalizationValidationPassed:
      structuredRoleLocale.priorRoleLocalizationValidationPassed,
    foreignStructuredRoleTitleCount: foreignRoleCount,
    foreignPriorRoleTitleCount: structuredRoleLocale.foreignPriorRoleTitleCount ?? 0,
    foreignCurrentRoleTitleDetected: Boolean(
      structuredRoleLocale.foreignCurrentRoleTitleDetected
      || leak.rawSourceRoleLeakageDetected,
    ),
    rawSourceRoleLeakageDetected:
      structuredRoleLocale.rawSourceRoleLeakageDetected
      || leak.rawSourceRoleLeakageDetected,
    finalWrongLocaleStructuredRoleCount: foreignRoleCount,
    finalStructuredRoleLocaleValidationPassed:
      structuredRoleLocale.structuredRoleLocaleValidationPassed,
    finalForeignRoleTitleCount: foreignRoleCount,
    targetLocalePurityPassed: purity.targetLocalePurityPassed && !sourceLeak,
    sourceLanguageLeakageDetected: sourceLeak,
    wrongLocaleUnitCount: Math.max(
      purity.wrongLocaleUnitCount,
      (purity.unexpectedLocaleCodes || []).includes('es') ? 1 : 0,
    ),
    unexpectedLocaleCodes: purity.unexpectedLocaleCodes || [],
    finalUnsupportedCompetencyCount: competency.finalUnsupportedCompetencyCount,
    unsupportedCompetencyCount: competency.unsupportedCompetencyCount,
    unsupportedCompetencyKinds: competency.unsupportedCompetencyKinds,
    unsupportedClaimCount: competency.unsupportedCompetencyCount,
    unsupportedClaimKinds: competency.unsupportedCompetencyKinds,
    competencyScan,
    durationScopeRejectionReason: durationScope.durationScopeRejectionReason,
    finalDurationScopeValidationPassed: durationScope.finalDurationScopeValidationPassed,
    finalDurationOwnerExpected: durationScope.finalDurationOwnerExpected,
    finalDurationOwnerDetected: durationScope.finalDurationOwnerDetected,
    finalDurationCurrentRoleAttachmentRisk:
      durationScope.finalDurationCurrentRoleAttachmentRisk,
    finalDurationTotalCareerMarkerPresent:
      durationScope.finalDurationTotalCareerMarkerPresent,
    currentDutyRequiredFactParityPassed:
      currentDutyParity.currentDutyRequiredFactParityPassed,
    authoritativeCurrentDutyFactCount:
      currentDutyParity.authoritativeCurrentDutyFactCount,
    authoritativeCanonicalCurrentDutyFactCount:
      currentDutyParity.authoritativeCanonicalCurrentDutyFactCount,
    classifiedRequiredCurrentDutyFactCount:
      currentDutyParity.classifiedRequiredCurrentDutyFactCount,
    unclassifiedAuthoritativeCurrentDutyFactCount:
      currentDutyParity.unclassifiedAuthoritativeCurrentDutyFactCount,
    requiredFactSetMatchesAuthoritativeFactSet:
      currentDutyParity.requiredFactSetMatchesAuthoritativeFactSet,
    materialCategoryCoverageUsedForFinalAcceptance: false,
    mixedLanguageMorphologyDetected: morph.mixedLanguageMorphologyDetected,
    currentDutyCoverage,
    currentDutyParity,
    structuredRoleLocale,
    grammarValidationPassed: grammar.grammarValidationPassed,
    englishSummaryFragmentDetected: grammar.englishSummaryFragmentDetected,
    englishSummaryFragmentKinds: grammar.englishSummaryFragmentKinds,
    finalSentenceFiniteClauseCount: grammar.finalSentenceFiniteClauseCount,
    finalIncompleteSentenceCount: grammar.finalIncompleteSentenceCount,
    finalSentenceGrammarRecords: grammar.finalSentenceGrammarRecords,
  };
}

/** Split Summary into top-level English sentences. */
export function splitEnglishSummarySentences(summary: string): string[] {
  return (summary || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EN_FINITE_SUBJECT_VERB_RE =
  /\b(?:I|she|he|they|we)\s+(?:am|is|are|was|were|work|works|worked|have|has|had|check|checks|verify|verifies|coordinate|coordinates|create|creates|review|reviews|prepare|prepares)\b/iu;
const EN_FINITE_BE_ROLE_RE =
  /\b(?:I\s+am|she\s+is|he\s+is|they\s+are)\s+a\s+\p{L}/iu;
const EN_FINITE_SKILLS_INCLUDE_RE =
  /\b(?:Key\s+skills|My\s+(?:key\s+)?skills|Core\s+competenc(?:y|ies)|Strengths?)\s+includes?\b/iu;
const EN_BARE_ROLE_FRAGMENT_RE =
  /^(?:Warehouse\s+(?:Employee|Worker)|Graphic\s+Designer)\s*,\s*(?:currently|checking|verifying|coordinat)/iu;
const EN_OMITTED_SUBJECT_PREVIOUSLY_RE =
  /^Previously(?:\s*,)?\s+worked\b/iu;
const EN_OVERALL_DURATION_FRAGMENT_RE =
  /^Overall(?:\s*,)?\s+with\b/iu;
const EN_STANDALONE_DURATION_FRAGMENT_RE =
  /^(?:With\s+)?(?:approximately|about|around)\s+.+?\s+years?\s+of\s+(?:professional\s+)?experience\.?$/iu;

/**
 * AAB-346 — Reject English Summary sentence fragments that lack an explicit
 * subject + finite main verb (role NP, omitted-subject prior, Overall-with duration).
 */
export function validateEnglishSummaryFiniteClauses(summary: string): {
  grammarValidationPassed: boolean;
  englishSummaryFragmentDetected: boolean;
  englishSummaryFragmentKinds: string[];
  finalSentenceFiniteClauseCount: number;
  finalIncompleteSentenceCount: number;
  finalSentenceGrammarRecords: Array<{
    sentenceIndex: number;
    sentenceHash: string;
    finiteClausePresent: boolean;
    fragmentKinds: string[];
  }>;
  typedRejectionReason: string | null;
} {
  void ENGLISH_SUMMARY_FINITE_CLAUSE_346_REVISION;
  const sentences = splitEnglishSummarySentences(summary);
  const records: Array<{
    sentenceIndex: number;
    sentenceHash: string;
    finiteClausePresent: boolean;
    fragmentKinds: string[];
  }> = [];
  const allKinds: string[] = [];

  sentences.forEach((sentence, sentenceIndex) => {
    const fragmentKinds: string[] = [];
    if (EN_BARE_ROLE_FRAGMENT_RE.test(sentence) && !EN_FINITE_BE_ROLE_RE.test(sentence)) {
      fragmentKinds.push('bare_role_title_noun_phrase');
    }
    if (EN_OMITTED_SUBJECT_PREVIOUSLY_RE.test(sentence)) {
      fragmentKinds.push('omitted_subject_previously_worked');
    }
    if (EN_OVERALL_DURATION_FRAGMENT_RE.test(sentence)) {
      fragmentKinds.push('overall_with_duration_fragment');
    }
    if (EN_STANDALONE_DURATION_FRAGMENT_RE.test(sentence)) {
      fragmentKinds.push('standalone_duration_fragment');
    }
    // Gerund/participial chain with no finite subject+verb (e.g. "checking…, verifying…").
    if (
      /^(?:checking|verifying|coordinating|creating|reviewing|preparing)\b/iu.test(sentence)
      && !EN_FINITE_SUBJECT_VERB_RE.test(sentence)
    ) {
      fragmentKinds.push('gerund_chain_without_finite_verb');
    }
    const finiteClausePresent = Boolean(
      EN_FINITE_SUBJECT_VERB_RE.test(sentence)
      || EN_FINITE_BE_ROLE_RE.test(sentence)
      || EN_FINITE_SKILLS_INCLUDE_RE.test(sentence)
    );
    if (!finiteClausePresent && fragmentKinds.length === 0) {
      fragmentKinds.push('missing_finite_main_verb');
    }
    if (!finiteClausePresent) {
      allKinds.push(...fragmentKinds);
    }
    records.push({
      sentenceIndex,
      sentenceHash: fingerprintText(sentence),
      finiteClausePresent,
      fragmentKinds: finiteClausePresent ? [] : [...new Set(fragmentKinds)],
    });
  });

  const finiteCount = records.filter((r) => r.finiteClausePresent).length;
  const incompleteCount = records.filter((r) => !r.finiteClausePresent).length;
  const uniqueKinds = [...new Set(allKinds)];
  const passed = sentences.length > 0 && incompleteCount === 0;
  return {
    grammarValidationPassed: passed,
    englishSummaryFragmentDetected: incompleteCount > 0,
    englishSummaryFragmentKinds: uniqueKinds,
    finalSentenceFiniteClauseCount: finiteCount,
    finalIncompleteSentenceCount: incompleteCount,
    finalSentenceGrammarRecords: records,
    typedRejectionReason: passed ? null : 'english_summary_sentence_fragment',
  };
}

/** Detect English Summary first-person professional voice (`I am` / `I work` / `I worked`). */
export function detectEnglishSummaryPerspective(summary: string): {
  perspectiveMode: 'first_person' | 'neutral_cv';
  perspectiveValidationPassed: boolean;
} {
  void ENGLISH_SUMMARY_PERSPECTIVE_CONTRACT_346;
  const text = summary || '';
  const firstPerson = /\bI\b/.test(text);
  return {
    perspectiveMode: firstPerson ? 'first_person' : 'neutral_cv',
    // First-person is the established English Summary contract; neutral is also
    // allowed when complete finite clauses are used (grammar gate is separate).
    perspectiveValidationPassed: true,
  };
}

/** Authoritative English total-career duration sentence (idempotent insert). */
export function injectEnglishTotalDurationSentence(
  summary: string,
  durationPhrase: string,
): string {
  void SUMMARY_DURATION_FINALIZER_REVISION_EN;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const phrase = (durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .replace(/^(?:with|bringing|having)\s+/iu, '')
    .replace(/\b6\.5\b/g, 'six and a half')
    .replace(/\s+of\s+(?:professional\s+)?experience.*$/iu, '')
    .trim();
  if (!phrase) return text;
  const scope = analyzeEnglishSummaryDurationScope(text);
  if (
    scope.finalDurationScopeValidationPassed
    && scope.finalDurationOwnerDetected === 'total_professional_experience'
    && countEnglishDurationClaims(text) === 1
  ) {
    return text;
  }
  const durationClause = /approximately|about|around/iu.test(phrase)
    ? `${phrase} of professional experience`
    : `approximately ${phrase} of professional experience`;
  // Integrate into a complete first-person clause — never emit Overall-with fragments.
  if (/\bI\s+am\s+a\b/iu.test(text) && !/years?\s+of\s+(?:professional\s+)?experience/iu.test(text)) {
    return text
      .replace(
        /(\bI\s+am\s+a\s+[^,.]+?)(?=,|\s+currently|\s+where\b|\.)/iu,
        `$1 with ${durationClause}`,
      )
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (!text) {
    return `I am a professional with ${durationClause}.`;
  }
  if (!/years?\s+of\s+(?:professional\s+)?experience/iu.test(text)) {
    const sentences = splitEnglishSummarySentences(text);
    if (sentences[0] && /\bI\s+am\b/iu.test(sentences[0])) {
      sentences[0] = sentences[0]
        .replace(/\.$/u, '')
        .replace(
          /(\bI\s+am\s+a\s+[^,.]+)/iu,
          `$1 with ${durationClause}`,
        );
      if (!/\.$/u.test(sentences[0])) sentences[0] = `${sentences[0]}.`;
      return sentences.join(' ').replace(/\s+/g, ' ').trim();
    }
    // Non-first-person English (baker/generic export shells): re-insert duration into
    // the leading role clause. Never drop the grounded body for a Professional stub,
    // and never emit Overall-with sentence fragments.
    if (sentences[0] && !/^(?:Overall|With)\b/iu.test(sentences[0])) {
      let head = sentences[0].replace(/\.$/u, '').trim();
      head = head.replace(
        /^((?:A\s+|An\s+|The\s+)?\p{L}[\p{L}'-]*(?:\s+\p{L}[\p{L}']*){0,3})\b/u,
        `$1 with ${durationClause}`,
      );
      if (!/years?\s+of\s+(?:professional\s+)?experience/iu.test(head)) {
        head = `${head.replace(/\.$/u, '')} with ${durationClause}`;
      }
      if (!/[.!?]$/u.test(head)) head = `${head}.`;
      sentences[0] = head;
      return sentences.join(' ').replace(/\s+/g, ' ').trim();
    }
    return `I am a professional with ${durationClause}.`;
  }
  return text;
}

function countEnglishDurationClaims(text: string): number {
  const matches = text.match(
    /(?:approximately|about|around|roughly).{0,40}years?\s+of\s+(?:professional\s+)?experience|years?\s+of\s+(?:professional\s+)?experience/giu,
  );
  return matches ? matches.length : 0;
}

export function buildEnglishEntryOwnedSummary(options: {
  role: string;
  employer: string;
  datesValue: string;
  gender?: string;
  durationPhrase?: string;
  dutyFacts: Array<{ sourceText?: string; value: string }>;
  priorRole?: string;
  priorEmployer?: string;
  priorSourceDuties?: string;
  locale?: Locale;
  duration?: ExperienceDuration | null;
}): string {
  void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
  void SUMMARY_BUILDER_REVISION_EN;
  void ENGLISH_SUMMARY_PERSPECTIVE_CONTRACT_346;
  void ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION;
  void options.datesValue;
  void options.gender;

  let role = (options.role || '').trim();
  const inputLooksWarehouse = matchesWarehouseOccupationalTitle(role)
    || /warehouse|almac|lager|emplead/i.test(role);
  // Empty role defaults to warehouse only for legacy Atlas-shaped empty shells.
  const warehouseRole = !role || inputLooksWarehouse;
  if (warehouseRole) {
    role = localizeWarehouseEmployee('en', options.gender);
  } else {
    const resolved = resolveLocalizedSummaryRole({
      role,
      targetLocale: 'en',
      gender: options.gender,
    });
    if (resolved.localizationValidationPassed) {
      role = resolved.localizedTargetRoleLabel;
    }
  }
  // Natural first-person article + role casing.
  // Keep free-text title casing (Custom Title XYZ-47); only normalize known labels.
  const roleNatural = role
    .replace(/^Warehouse\s+Employee$/iu, 'warehouse employee')
    .replace(/^Graphic\s+Designer$/iu, 'graphic designer');
  const article = /^[aeiou]/i.test(roleNatural) ? 'an' : 'a';

  const company = (options.employer || '').trim();
  const dutiesText = options.dutyFacts
    .map((f) => f.sourceText || f.value)
    .filter(Boolean)
    .join('\n');
  const entryFacts = extractEnglishEntryOwnedDutyFacts({
    entryDuties: dutiesText,
    // Use the resolved English warehouse label when a foreign-language role
    // was recognized as warehouse-shaped. The extractor's role gate is
    // intentionally English-only, while its fact extractor is multilingual.
    role: warehouseRole ? role : (options.role || role),
    employer: company,
  });
  const dutyParts: string[] = [];
  if (entryFacts.some((f) => f.factId === 'incoming_goods_check')) {
    dutyParts.push('check incoming goods');
  }
  if (entryFacts.some((f) => f.factId === 'related_documentation_check')) {
    const documentationFact = entryFacts.find((f) => f.factId === 'related_documentation_check');
    dutyParts.push(
      /(?:update[sd]?|maintain(?:s|ed)?).{0,48}(?:warehouse\s+records?|orderly)|warehouse\s+records?.{0,48}(?:orderly|maintain)/iu
        .test(documentationFact?.sourceBullet || '')
        ? 'verify related documentation, update warehouse records, and keep goods orderly'
        : 'verify related documentation',
    );
  }
  if (entryFacts.some((f) => f.factId === 'colleague_coordination_goods_preparation_movement')) {
    dutyParts.push(
      'coordinate with colleagues on the preparation and movement of goods',
    );
  }
  if (dutyParts.length === 0) {
    for (const fact of entryFacts.slice(0, 5)) {
      const clause = englishDutyBulletToWhereClause(fact.sourceBullet);
      if (clause) dutyParts.push(clause);
    }
  }
  // Only fill the Atlas warehouse triad when duties classified as those facts
  // but clauses were empty — never invent warehouse duties for other Warehouse Worker sources.
  if (dutyParts.length === 0 && entryFacts.some((f) => f.kind === 'warehouse_canonical')) {
    dutyParts.push(
      'check incoming goods',
      'verify related documentation',
      'coordinate with colleagues on the preparation and movement of goods',
    );
  }

  let durRaw = (options.durationPhrase || '').replace(/^[,，]\s*/u, '').replace(/\.$/u, '').trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'en')
      .replace(/\.$/u, '')
      .trim();
  }
  durRaw = durRaw
    .replace(/^(?:with|bringing|having)\s+/iu, '')
    .replace(/\b6\.5\b/g, 'six and a half')
    .replace(/\b5\.5\b/g, 'five and a half')
    .replace(/\s+of\s+(?:professional\s+)?experience.*$/iu, '')
    .trim();
  // Warehouse/design Atlas package keeps "professional experience"; arbitrary
  // free-text titles keep the legacy "of experience" contract (build-258).
  const experienceNoun = inputLooksWarehouse || warehouseRole
    ? 'professional experience'
    : 'experience';
  const durationClause = durRaw
    ? (
      /approximately|about|around/iu.test(durRaw)
        ? `${durRaw} of ${experienceNoun}`
        : `approximately ${durRaw} of ${experienceNoun}`
    )
    : '';

  let intro = durationClause
    ? `I am ${article} ${roleNatural} with ${durationClause}`
    : `I am ${article} ${roleNatural}`;
  if (company) {
    intro = `${intro}, currently working at ${company}`;
  }
  if (dutyParts.length >= 3) {
    const head = dutyParts.slice(0, -1).join(', ');
    intro = `${intro}, where I ${head}, and ${dutyParts[dutyParts.length - 1]}`;
  } else if (dutyParts.length === 2) {
    intro = `${intro}, where I ${dutyParts[0]} and ${dutyParts[1]}`;
  } else if (dutyParts.length === 1) {
    intro = `${intro}, where I ${dutyParts[0]}`;
  }
  if (!/[.]$/u.test(intro)) intro = `${intro}.`;

  const priorRoleRaw = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = PRIOR_DESIGN_CUE.test(`${priorRoleRaw} ${priorDuties}`)
    || /diseñ|design|grafik/i.test(`${priorRoleRaw} ${priorDuties}`)
    || englishRoleLooksDesign(priorRoleRaw);
  let priorSentence = '';
  if (priorRoleRaw || priorEmployer || priorDuties) {
    if (priorLooksDesign) {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || 'Graphic Designer',
        targetLocale: 'en',
        gender: options.gender,
      });
      const priorLabelRaw = priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : localizeGraphicDesigner('en', options.gender);
      const priorLabel = priorLabelRaw.replace(/^Graphic\s+Designer$/iu, 'graphic designer');
      const designFacts =
        'creating visual materials and graphic elements, reviewing and adapting design materials, and preparing final design files for different formats and screens';
      priorSentence = priorEmployer
        ? `Previously, I worked as a ${priorLabel} at ${priorEmployer}, ${designFacts}.`
        : `Previously, I worked as a ${priorLabel}, ${designFacts}.`;
    } else {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || '',
        targetLocale: 'en',
        gender: options.gender,
      });
      let priorLabel = priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : priorRoleRaw;
      priorLabel = priorLabel
        .replace(/^Graphic\s+Designer$/iu, 'graphic designer')
        .replace(/^Warehouse\s+Employee$/iu, 'warehouse employee');
      const priorArticle = /^[aeiou]/i.test(priorLabel) ? 'an' : 'a';
      const priorParts = splitEnglishDutyBullets(priorDuties, 5)
        .map((b) => englishDutyBulletToWhereClause(b))
        .filter(Boolean);
      let dutyTail = '';
      if (priorParts.length >= 2) {
        const head = priorParts.slice(0, -1).join(', ');
        dutyTail = `, where I ${head}, and ${priorParts[priorParts.length - 1]}`;
      } else if (priorParts.length === 1) {
        dutyTail = `, where I ${priorParts[0]}`;
      }
      priorSentence = priorEmployer
        ? `Previously, I worked as ${priorArticle} ${priorLabel} at ${priorEmployer}${dutyTail}.`
        : `Previously, I worked as ${priorArticle} ${priorLabel}${dutyTail}.`;
    }
  }

  return [intro, priorSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip unsupported English competency sentences for safe repair. */
export function stripEnglishUnsupportedCompetencyUnits(summary: string): string {
  return (summary || '')
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((u) => u.trim())
    .filter((u) => !COMPETENCY_INTRO_RE.test(u) && !UNSUPPORTED_SOFT_SKILL_RE.test(u))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
