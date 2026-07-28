/**
 * AAB-323/324 — German Summary per-fact current-duty serialization + coverage +
 * controlled case-grammar validation + authoritative/required fact parity.
 *
 * Material keys may group related duties, but each canonical fact remains
 * independently required for final/visible acceptance.
 */
export const GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION =
  'german-summary-current-duty-serialization-323-v1' as const;
export const SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION =
  'summary-entry-duty-coverage-323-v1' as const;
export const GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION =
  'german-summary-controlled-case-grammar-323-v1' as const;
export const SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION =
  'summary-repair-selection-truth-323-v1' as const;
export const GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION =
  'german-summary-third-current-duty-324-v1' as const;
export const SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION =
  'summary-authoritative-duty-parity-324-v1' as const;
export const SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION =
  'summary-visible-duty-parity-324-v1' as const;
export const SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION =
  'summary-duty-parity-apply-gate-324-v1' as const;

void GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION;
void SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION;
void GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION;
void SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION;
void GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION;
void SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION;
void SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION;
void SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION;

export type GermanCurrentDutyFactId =
  | 'incoming_goods_check'
  | 'related_documentation_check'
  | 'colleague_coordination_goods_preparation_movement';

export type GermanCurrentDutyFact = {
  canonicalFactId: GermanCurrentDutyFactId;
  sourceEntryIdHash: string | null;
  sourceFactHash: string;
  sourceLocale: string | null;
  targetLocale: 'de' | 'en';
  semanticKind: GermanCurrentDutyFactId;
  materialCategory: 'warehouse_movement' | 'warehouse_inbound' | 'warehouse_records';
  localizedClauseHash: string;
  requiredForSummary: boolean;
  /** Dative NP usable after "Erfahrung in …" */
  dativeClause: string;
  /** Match cues for candidate/visible text (German + common source aliases). */
  matchRes: RegExp[];
};

function hashOpaque(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

function detectDutySourceLocale(text: string): string | null {
  const t = text || '';
  if (/[ñáéíóúü¿¡]/iu.test(t) || /\b(?:mercanc|documentaci|coordina|comprueba|verifica)\w*/iu.test(t)) {
    return 'es';
  }
  if (/\b(?:Waren|Dokumentation|Unterlagen|Abstimmung|Prüfung|Koordination)\b/u.test(t)) {
    return 'de';
  }
  if (/\b(?:goods|documentation|coordinat|incoming)\b/iu.test(t)) return 'en';
  return null;
}

const INCOMING_RE = /(?:eingehend\w*\s+Waren|Wareneingang|Warenannahme|(?:Prüfung|Kontrolle|prüfen|kontroll)\w*.{0,40}(?:eingehend|Wareneingang)|(?:incoming|inbound)\s+goods|mercanc[ií]as?\s+entrant(?:es)?|(?:verifica|comprueba|revisa|controla|comprob[oó]|revis[oó])\w*.{0,40}mercanc|(?:prüf|kontroll)\w*.{0,24}Waren)/iu;
const DOCUMENT_RE = /(?:zugehörig\w*\s+(?:Dokumentation|Unterlagen|Dokumente|Belege)|Dokumentenprüfung|(?:Prüfung|Kontrolle)\w*.{0,40}(?:Dokumentation|Unterlagen|Dokumente|Belege)|(?:Dokumentation|Unterlagen|Dokumente|Belege).{0,40}(?:Prüfung|Kontrolle|prüfen|kontroll)|(?:documentaci[oó]n|documentos|registros).{0,40}(?:relacionad|asociad|acompañ)|(?:verifica|comprueba|revisa|controla|comprob[oó]|revis[oó]|prüf|kontroll)\w*.{0,40}(?:documentaci|documentos|Dokumentation|Unterlagen)|(?:documentaci|documentos|Unterlagen|Dokumentation).{0,40}(?:verifica|comprueba|revisa|controla|comprob[oó]|revis[oó]|prüf|kontroll)|related\s+document|documentation\s+related|(?:checking|verifying|reviewing)\s+(?:the\s+)?(?:related\s+)?documentation)/iu;
/**
 * AAB-324: Spanish past-tense Coordinó (ó) must match — bare `coordina` does not.
 * Also accept compañeros / colleagues as coordination participants.
 */
const COORD_RE = /(?:Abstimmung|Koordination|abstimme|abstimm\w*).{0,80}(?:Kolleg|Vorbereitung|Bewegung|Transport)|(?:Kolleg\w*).{0,80}(?:Vorbereitung|Bewegung|Transport|Abstimmung|vorbereiten|bewegen|abstimme)|(?:coordin[aoó]|koordin)\w*.{0,100}(?:prepar|movim|mercanc|coleg|compa[nñ]er|colleague|Kolleg|Vorbereitung|Bewegung|Transport|goods|Waren)|(?:compa[nñ]er\w*|colleague\w*|Kolleg\w*).{0,100}(?:prepar|movim|mercanc|Vorbereitung|Bewegung|Transport|goods|Waren)|(?:Vorbereitung\s+und\s+(?:Bewegung|Transport)\s+(?:von\s+)?Waren)|(?:Bewegung\s+der\s+Waren)|(?:Waren).{0,40}(?:Kolleg\w*).{0,40}(?:vorbereit|beweg|Transport|abstimm)|(?:Kolleg\w*).{0,40}(?:Waren).{0,40}(?:vorbereit|beweg|Transport|abstimm)|(?:vorbereiten\s+und\s+bewegen)/iu;

function splitDutyBullets(text: string): string[] {
  return (text || '')
    .split(/\n+|;\s+|(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Extract ordered canonical current warehouse duties from entry source text.
 * One material category may appear on multiple facts; each fact stays distinct.
 *
 * AAB-324: Spanish past-tense Coordinó must classify as
 * colleague_coordination_goods_preparation_movement — never silently drop it.
 */
export function extractGermanCurrentWarehouseDutyFacts(options: {
  currentEntryDuties?: string;
  entryId?: string | null;
}): GermanCurrentDutyFact[] {
  void GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION;
  void GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION;
  const raw = (options.currentEntryDuties || '').trim();
  const bullets = splitDutyBullets(raw);
  const corpus = bullets.join('\n') || raw;
  const sourceLocale = detectDutySourceLocale(corpus);
  const entryHash = options.entryId ? hashOpaque(options.entryId) : null;

  const defs: Array<{
    id: GermanCurrentDutyFactId;
    category: GermanCurrentDutyFact['materialCategory'];
    detect: RegExp;
    dativeClause: string;
    matchRes: RegExp[];
  }> = [
    {
      id: 'incoming_goods_check',
      category: 'warehouse_inbound',
      detect: INCOMING_RE,
      dativeClause: 'der Prüfung eingehender Waren',
      matchRes: [
        /Prüfung\s+eingehender\s+Waren/iu,
        /Kontrolle\s+eingehender\s+Waren/iu,
        /eingehende\s+Waren\s+prüfe/iu,
        /prüfe.{0,24}eingehende\s+Waren/iu,
        /Warenannahme(?:\s+und\s+-?prüfung)?/iu,
        /Wareneingang/iu,
        INCOMING_RE,
      ],
    },
    {
      id: 'related_documentation_check',
      category: 'warehouse_records',
      detect: DOCUMENT_RE,
      dativeClause: 'der Prüfung der zugehörigen Dokumentation',
      matchRes: [
        /Prüfung\s+der\s+zugehörigen\s+Dokumentation/iu,
        /Prüfung\s+(?:der\s+)?zugehörigen\s+(?:Unterlagen|Dokumente|Belege)/iu,
        /Dokumentenprüfung/iu,
        /Kontrolle\s+der\s+zugehörigen\s+(?:Dokumentation|Unterlagen)/iu,
        /(?:gehörende|zugehörig\w*)\s+Dokumentation/iu,
        /Dokumentation\s+kontrolliere/iu,
        DOCUMENT_RE,
      ],
    },
    {
      id: 'colleague_coordination_goods_preparation_movement',
      category: 'warehouse_movement',
      detect: COORD_RE,
      dativeClause:
        'der Abstimmung mit Kolleginnen und Kollegen bei der Vorbereitung und Bewegung von Waren',
      matchRes: [
        /Abstimmung\s+mit\s+Kolleg/iu,
        /Koordination\s+mit\s+Kolleg/iu,
        /abstimme.{0,60}Kolleg/iu,
        /Kolleg\w*.{0,60}abstimme/iu,
        /(?:Vorbereitung\s+und\s+(?:Bewegung|Transport)\s+(?:von\s+|der\s+)?Waren)/iu,
        COORD_RE,
      ],
    },
  ];

  const out: GermanCurrentDutyFact[] = [];
  for (const def of defs) {
    const matchedBullet = bullets.find((b) => def.detect.test(b))
      || (def.detect.test(corpus) ? corpus : '');
    if (!matchedBullet) continue;
    out.push({
      canonicalFactId: def.id,
      sourceEntryIdHash: entryHash,
      sourceFactHash: hashOpaque(`${def.id}:${matchedBullet}`),
      sourceLocale,
      targetLocale: 'de',
      semanticKind: def.id,
      materialCategory: def.category,
      localizedClauseHash: hashOpaque(def.dativeClause),
      requiredForSummary: true,
      dativeClause: def.dativeClause,
      matchRes: def.matchRes,
    });
  }
  return out;
}

export type AuthoritativeCurrentDutyParityResult = {
  authoritativeCurrentDutyFactCount: number;
  authoritativeCanonicalCurrentDutyFactCount: number;
  requiredCurrentDutyFactCount: number;
  classifiedRequiredCurrentDutyFactCount: number;
  unclassifiedAuthoritativeCurrentDutyFactCount: number;
  requiredFactSetMatchesAuthoritativeFactSet: boolean;
  currentDutyRequiredFactParityPassed: boolean;
  currentMaterialCategoryCount: number;
  authoritativeBulletHashes: string[];
  classifiedFactIds: GermanCurrentDutyFactId[];
  unclassifiedAuthoritativeBulletHashes: string[];
  currentDutyFactClassificationKindsByFactHash: Record<string, string>;
  rejectionReason: 'current_duty_required_fact_parity_failed'
    | 'authoritative_current_duty_unclassified'
    | null;
};

/**
 * Count authoritative warehouse duty bullets that must appear in the required set.
 * AAB-324: do not shrink this list to whatever the classifier already knows —
 * Spanish Coordinó-style bullets remain authoritative even when a detector misses.
 */
export function listAuthoritativeCurrentWarehouseDutyBullets(
  currentEntryDuties?: string,
): string[] {
  const bullets = splitDutyBullets(currentEntryDuties || '');
  const warehouseish = (b: string) => (
    INCOMING_RE.test(b)
    || DOCUMENT_RE.test(b)
    || COORD_RE.test(b)
    || /(?:mercanc|Waren|Wareneingang|goods|almac[eé]n|Lager|warehouse|documentaci|Dokumentation|Unterlagen|coordin|Kolleg|colleague|compa[nñ]er|preparaci|Vorbereitung|movim|Bewegung|Transport|Abstimmung)/iu
      .test(b)
  );
  if (!bullets.some(warehouseish)) return [];
  return bullets.filter(warehouseish);
}

/**
 * Authoritative source/canonical/required parity for current warehouse duties.
 * Fail closed when any authoritative bullet lacks a classified required identity.
 */
export function analyzeCurrentDutyRequiredFactParity(options: {
  currentEntryDuties?: string;
  requiredFacts?: GermanCurrentDutyFact[];
  entryId?: string | null;
}): AuthoritativeCurrentDutyParityResult {
  void SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION;
  void SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION;
  const authoritativeBullets = listAuthoritativeCurrentWarehouseDutyBullets(
    options.currentEntryDuties,
  );
  const requiredFacts = options.requiredFacts
    ?? extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: options.currentEntryDuties,
      entryId: options.entryId,
    });
  const classified = requiredFacts.filter((f) => f.requiredForSummary);
  const classifiedIds = classified.map((f) => f.canonicalFactId);
  const classificationKinds: Record<string, string> = {};
  for (const f of classified) {
    classificationKinds[f.sourceFactHash] = f.canonicalFactId;
  }

  // Prefer specific family detectors; fall back to exclusive assignment order.
  const claimed = new Set<GermanCurrentDutyFactId>();
  const unclassifiedHashes: string[] = [];
  for (const bullet of authoritativeBullets) {
    let kind: GermanCurrentDutyFactId | null = null;
    if (COORD_RE.test(bullet) && !claimed.has('colleague_coordination_goods_preparation_movement')) {
      // Check coordination before inbound: Spanish coordination bullets mention mercancías.
      kind = 'colleague_coordination_goods_preparation_movement';
    } else if (
      DOCUMENT_RE.test(bullet)
      && !INCOMING_RE.test(bullet)
      && !claimed.has('related_documentation_check')
    ) {
      kind = 'related_documentation_check';
    } else if (
      INCOMING_RE.test(bullet)
      && !claimed.has('incoming_goods_check')
    ) {
      kind = 'incoming_goods_check';
    } else if (
      DOCUMENT_RE.test(bullet)
      && !claimed.has('related_documentation_check')
    ) {
      kind = 'related_documentation_check';
    } else if (
      !claimed.has('incoming_goods_check')
      && /(?:entrant|eingehend|incoming|inbound|Wareneingang)/iu.test(bullet)
    ) {
      kind = 'incoming_goods_check';
    } else if (
      !claimed.has('related_documentation_check')
      && /(?:documentaci|Dokumentation|Unterlagen|document)/iu.test(bullet)
    ) {
      kind = 'related_documentation_check';
    } else if (
      !claimed.has('colleague_coordination_goods_preparation_movement')
      && /(?:coordin|Abstimmung|Kolleg|compa[nñ]er|colleague|prepar|movim|Bewegung)/iu.test(bullet)
    ) {
      kind = 'colleague_coordination_goods_preparation_movement';
    }
    if (kind && classifiedIds.includes(kind)) {
      claimed.add(kind);
    } else if (kind && !classifiedIds.includes(kind)) {
      unclassifiedHashes.push(hashOpaque(bullet));
    } else {
      unclassifiedHashes.push(hashOpaque(bullet));
    }
  }

  const authoritativeCount = authoritativeBullets.length;
  const authoritativeCanonicalCount = claimed.size;
  const requiredCount = classified.length;
  const classifiedRequiredCount = classified.length;
  const parityOk = unclassifiedHashes.length === 0
    && authoritativeCount === requiredCount
    && authoritativeCanonicalCount === requiredCount
    && requiredCount === classifiedRequiredCount
    && authoritativeCount === authoritativeCanonicalCount;
  const matches = parityOk;

  let rejectionReason: AuthoritativeCurrentDutyParityResult['rejectionReason'] = null;
  if (!parityOk) {
    rejectionReason = unclassifiedHashes.length > 0 || authoritativeCount > requiredCount
      ? 'authoritative_current_duty_unclassified'
      : 'current_duty_required_fact_parity_failed';
  }

  const categories = new Set(classified.map((f) => f.materialCategory));

  return {
    authoritativeCurrentDutyFactCount: authoritativeCount,
    authoritativeCanonicalCurrentDutyFactCount: authoritativeCanonicalCount,
    requiredCurrentDutyFactCount: requiredCount,
    classifiedRequiredCurrentDutyFactCount: classifiedRequiredCount,
    unclassifiedAuthoritativeCurrentDutyFactCount: unclassifiedHashes.length,
    requiredFactSetMatchesAuthoritativeFactSet: matches,
    currentDutyRequiredFactParityPassed: parityOk,
    currentMaterialCategoryCount: categories.size,
    authoritativeBulletHashes: authoritativeBullets.map((b) => hashOpaque(b)),
    classifiedFactIds: classifiedIds,
    unclassifiedAuthoritativeBulletHashes: unclassifiedHashes,
    currentDutyFactClassificationKindsByFactHash: classificationKinds,
    rejectionReason,
  };
}

/** Compose "mit Erfahrung in …" using compatible dative NPs. */
export function buildGermanCurrentDutyExperiencePhrase(
  facts: GermanCurrentDutyFact[],
): string {
  void GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION;
  const clauses = facts.map((f) => f.dativeClause).filter(Boolean);
  if (clauses.length === 0) return '';
  if (clauses.length === 1) return `mit Erfahrung in ${clauses[0]}`;
  if (clauses.length === 2) {
    return `mit Erfahrung in ${clauses[0]} und ${clauses[1]}`;
  }
  // Prefer: in A und B sowie in C — all dative.
  return `mit Erfahrung in ${clauses[0]} und ${clauses[1]} sowie in ${clauses[2]}`;
}

export type GermanControlledCaseGrammarResult = {
  germanControlledCaseGrammarPassed: boolean;
  failureKinds: string[];
  invalidErfahrungInAccusativeDetected: boolean;
};

/**
 * Narrow validator for controlled German Summary constructions emitted by this app.
 * Not a full German parser.
 */
export function validateGermanGeneratedCaseGrammar(
  summary: string,
): GermanControlledCaseGrammarResult {
  void GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const failureKinds: string[] = [];
  let invalidErfahrungInAccusativeDetected = false;

  // Accusative after "Erfahrung in" — classic AAB-322 defect.
  if (/Erfahrung\s+in\s+die\s+Abstimmung\b/iu.test(text)) {
    invalidErfahrungInAccusativeDetected = true;
    failureKinds.push('erfahrung_in_accusative_abstimmung');
  }
  if (/Erfahrung\s+in\s+die\s+Prüfung\b/iu.test(text)) {
    invalidErfahrungInAccusativeDetected = true;
    failureKinds.push('erfahrung_in_accusative_pruefung');
  }
  if (/Erfahrung\s+in\s+den\s+Prüfung\b/iu.test(text)) {
    invalidErfahrungInAccusativeDetected = true;
    failureKinds.push('erfahrung_in_malformed_article');
  }
  // "Erfahrung in dem/der" is fine; reject bare "in die" for known duty nouns.
  if (/Erfahrung\s+in\s+die\s+(?:Koordination|Vorbereitung|Bewegung)\b/iu.test(text)) {
    invalidErfahrungInAccusativeDetected = true;
    failureKinds.push('erfahrung_in_accusative_duty_np');
  }

  return {
    germanControlledCaseGrammarPassed: failureKinds.length === 0,
    failureKinds: [...new Set(failureKinds)],
    invalidErfahrungInAccusativeDetected,
  };
}

export type SummaryEntryDutyCoverageResult = {
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  missingCurrentDutyFactIdHashes: string[];
  duplicateCurrentDutyMatchCount: number;
  ambiguousCurrentDutyMatchCount: number;
  currentDutyFactMatchCountsByFactHash: Record<string, number>;
  currentDutyFactMatchedUnitHashesByFactHash: Record<string, string[]>;
  finalCurrentDutyCoveragePassed: boolean;
  currentMaterialCategoryMatchCount: number;
  currentCanonicalDutyFactMatchCount: number;
  materialCategoryCoverageUsedForFinalAcceptance: false;
  currentRoleConcreteFactCoverage: number;
};

function unitHash(text: string): string {
  return hashOpaque(text.replace(/\s+/g, ' ').trim());
}

/**
 * Match each required current duty fact independently against candidate text.
 * One material-key / coarse warehouse cue must not cover multiple facts.
 */
export function validateSummaryEntryDutyCoverage(options: {
  requiredFacts: GermanCurrentDutyFact[];
  candidateText: string;
  locale?: string;
  entryId?: string | null;
}): SummaryEntryDutyCoverageResult {
  void SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION;
  const text = (options.candidateText || '').replace(/\s+/g, ' ').trim();
  const required = options.requiredFacts.filter((f) => f.requiredForSummary);
  const matchCounts: Record<string, number> = {};
  const matchUnits: Record<string, string[]> = {};
  const covered: GermanCurrentDutyFact[] = [];
  const missingHashes: string[] = [];
  let duplicate = 0;

  const units = text
    ? text.split(/(?<=[.!?])\s+(?=\S)/u).map((u) => u.trim()).filter(Boolean)
    : [];
  const searchUnits = units.length ? units : (text ? [text] : []);

  for (const fact of required) {
    const matchedUnitHashes: string[] = [];
    for (const u of searchUnits) {
      if (fact.matchRes.some((re) => re.test(u))) {
        matchedUnitHashes.push(unitHash(u));
      }
    }
    // Also allow whole-text match when units split awkwardly.
    if (matchedUnitHashes.length === 0 && fact.matchRes.some((re) => re.test(text))) {
      matchedUnitHashes.push(unitHash(text));
    }
    const count = matchedUnitHashes.length;
    matchCounts[fact.sourceFactHash] = count;
    matchUnits[fact.sourceFactHash] = [...new Set(matchedUnitHashes)];
    if (count > 1) duplicate += count - 1;
    if (count >= 1) covered.push(fact);
    else missingHashes.push(fact.sourceFactHash);
  }

  // Coarse material category presence (diagnostic only — never final acceptance).
  const categories = new Set(required.map((f) => f.materialCategory));
  let categoryHits = 0;
  for (const cat of categories) {
    if (cat === 'warehouse_inbound' && INCOMING_RE.test(text)) categoryHits += 1;
    if (cat === 'warehouse_records' && DOCUMENT_RE.test(text)) categoryHits += 1;
    if (cat === 'warehouse_movement' && COORD_RE.test(text)) categoryHits += 1;
  }

  const coveredCount = covered.length;
  const requiredCount = required.length;
  return {
    requiredCurrentDutyFactCount: requiredCount,
    coveredCurrentDutyFactCount: coveredCount,
    missingCurrentDutyFactCount: Math.max(0, requiredCount - coveredCount),
    missingCurrentDutyFactIdHashes: missingHashes,
    duplicateCurrentDutyMatchCount: duplicate,
    ambiguousCurrentDutyMatchCount: 0,
    currentDutyFactMatchCountsByFactHash: matchCounts,
    currentDutyFactMatchedUnitHashesByFactHash: matchUnits,
    finalCurrentDutyCoveragePassed: requiredCount > 0
      ? coveredCount === requiredCount
      : true,
    currentMaterialCategoryMatchCount: categoryHits,
    currentCanonicalDutyFactMatchCount: coveredCount,
    materialCategoryCoverageUsedForFinalAcceptance: false,
    currentRoleConcreteFactCoverage: coveredCount,
  };
}

export function verifyVisibleSummaryCurrentDutyCoverage(options: {
  visibleSummary: string;
  requiredFacts: GermanCurrentDutyFact[];
}): SummaryEntryDutyCoverageResult & {
  visibleRequiredCurrentDutyFactCount: number;
  visibleCoveredCurrentDutyFactCount: number;
  visibleMissingCurrentDutyFactCount: number;
  visibleMissingCurrentDutyFactIdHashes: string[];
  visibleCurrentDutyCoveragePassed: boolean;
  visibleCurrentDutyFactMatchCountsByFactHash: Record<string, number>;
} {
  void SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION;
  const base = validateSummaryEntryDutyCoverage({
    requiredFacts: options.requiredFacts,
    candidateText: options.visibleSummary,
  });
  return {
    ...base,
    visibleRequiredCurrentDutyFactCount: base.requiredCurrentDutyFactCount,
    visibleCoveredCurrentDutyFactCount: base.coveredCurrentDutyFactCount,
    visibleMissingCurrentDutyFactCount: base.missingCurrentDutyFactCount,
    visibleMissingCurrentDutyFactIdHashes: base.missingCurrentDutyFactIdHashes,
    visibleCurrentDutyCoveragePassed: base.finalCurrentDutyCoveragePassed,
    visibleCurrentDutyFactMatchCountsByFactHash: base.currentDutyFactMatchCountsByFactHash,
  };
}

/** Distinct German warehouse fragments keyed by fact (no shared merged string). */
export function germanCurrentDutyDativeClause(
  factId: GermanCurrentDutyFactId,
): string {
  switch (factId) {
    case 'incoming_goods_check':
      return 'der Prüfung eingehender Waren';
    case 'related_documentation_check':
      return 'der Prüfung der zugehörigen Dokumentation';
    case 'colleague_coordination_goods_preparation_movement':
      return 'der Abstimmung mit Kolleginnen und Kollegen bei der Vorbereitung und Bewegung von Waren';
    default:
      return '';
  }
}
