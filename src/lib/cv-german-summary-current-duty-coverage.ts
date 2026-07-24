/**
 * AAB-323 — German Summary per-fact current-duty serialization + coverage +
 * controlled case-grammar validation.
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

void GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION;
void SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION;
void GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION;
void SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION;

export type GermanCurrentDutyFactId =
  | 'incoming_goods_check'
  | 'related_documentation_check'
  | 'colleague_coordination_goods_preparation_movement';

export type GermanCurrentDutyFact = {
  canonicalFactId: GermanCurrentDutyFactId;
  sourceEntryIdHash: string | null;
  sourceFactHash: string;
  sourceLocale: string | null;
  targetLocale: 'de';
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

const INCOMING_RE = /(?:eingehend\w*\s+Waren|Wareneingang|Warenannahme|(?:Prüfung|Kontrolle|prüfen|kontroll)\w*.{0,40}(?:eingehend|Wareneingang)|(?:incoming|inbound)\s+goods|mercanc[ií]as?\s+entrant(?:es)?|(?:verifica|comprueba|revisa|controla)\w*.{0,40}mercanc|(?:prüf|kontroll)\w*.{0,24}Waren)/iu;
const DOCUMENT_RE = /(?:zugehörig\w*\s+(?:Dokumentation|Unterlagen|Dokumente|Belege)|Dokumentenprüfung|(?:Prüfung|Kontrolle)\w*.{0,40}(?:Dokumentation|Unterlagen|Dokumente|Belege)|(?:documentaci[oó]n|documentos|registros).{0,40}(?:relacionad|asociad|acompañ)|(?:verifica|comprueba|revisa|controla|prüf|kontroll)\w*.{0,40}(?:documentaci|documentos|Dokumentation|Unterlagen)|related\s+document)/iu;
const COORD_RE = /(?:Abstimmung|Koordination).{0,80}(?:Kolleg|Vorbereitung|Bewegung|Transport)|(?:Kolleg\w*).{0,80}(?:Vorbereitung|Bewegung|Transport|Abstimmung)|(?:coordina|koordin)\w*.{0,80}(?:prepar|movim|mercanc|coleg|Kolleg|Vorbereitung|Bewegung)|(?:Vorbereitung\s+und\s+(?:Bewegung|Transport)\s+von\s+Waren)/iu;

function splitDutyBullets(text: string): string[] {
  return (text || '')
    .split(/\n+|;\s+|(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Extract ordered canonical current warehouse duties from entry source text.
 * One material category may appear on multiple facts; each fact stays distinct.
 */
export function extractGermanCurrentWarehouseDutyFacts(options: {
  currentEntryDuties?: string;
  entryId?: string | null;
}): GermanCurrentDutyFact[] {
  void GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION;
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
        /(?:Vorbereitung\s+und\s+(?:Bewegung|Transport)\s+von\s+Waren)/iu,
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
