/**
 * English Experience warehouse fact coverage (AAB-327 / AAB-328).
 *
 * Cross-locale (e.g. Spanish→English) and same-locale English warehouse
 * operations must require one identity per material source unit — never one
 * collapsed material-category key for inbound+docs+coordination.
 *
 * AAB-328: strengthen incoming-goods semantic family (merchandise / inspect /
 * upon arrival), keep fact identities independent, and emit a deterministic
 * three-bullet fallback that passes its own coverage validator.
 *
 * Does not change Spanish/German grounding modules or validated English wording.
 */
import {
  materialDutyKeysFromDescription,
  type MaterialDutyKey,
} from './cv-material-duty-coverage';
import {
  extractSourceDutyUnits,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION =
  'english-experience-three-fact-coverage-327-v1' as const;

/** AAB-328 — incoming-goods matcher + aliases (merchandise / inspect / arrival). */
export const ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION =
  'english-experience-incoming-goods-matcher-328-v1' as const;

/** AAB-328 — deterministic three-fact English warehouse fallback. */
export const ENGLISH_EXPERIENCE_DETERMINISTIC_THREE_FACT_328_REVISION =
  'english-experience-deterministic-three-fact-328-v1' as const;

void ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION;
void ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION;
void ENGLISH_EXPERIENCE_DETERMINISTIC_THREE_FACT_328_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

/**
 * Incoming / received goods object + inbound receipt context.
 * Merchandise is a first-class goods alias (AAB-328 device bullet).
 */
const INCOMING_OBJECT_EN =
  /(?:incoming\s+(?:merchandise|goods|deliveries)|received\s+(?:merchandise|goods|deliveries)|inbound\s+(?:merchandise|goods|deliveries)|(?:merchandise|goods|deliveries)\s+received|goods\s+received\s+at\s+the\s+warehouse)/iu;
const INBOUND_CONTEXT_EN =
  /(?:upon\s+arrival|on\s+arrival|when\s+(?:received|arriving)|at\s+receipt|during\s+(?:goods\s+)?(?:receipt|intake)|(?:received|arriving|arrival)\s+at\s+the\s+warehouse|merchandise\s+upon\s+arrival)/iu;
const INCOMING_GOODS_EN =
  /(?:incoming\s+(?:merchandise|goods|deliveries)|received\s+(?:merchandise|goods|deliveries)|inbound\s+(?:merchandise|goods|deliveries)|(?:merchandise|goods)\s+upon\s+arrival|goods\s+received\s+at\s+the\s+warehouse|arrival\s+at\s+the\s+warehouse|mercanc[ií]a\s+(?:entrant|recibid)|recepci[oó]n\s+de\s+mercanc)/iu;
/** Inspection / check / verify / examine — review only with clear goods object. */
const CHECK_VERB_EN =
  /(?:inspects?|inspected|inspecting|checks?|checked|checking|verifies?|verified|verifying|examines?|examined|examining|revisa|revisó|comprueba|comprobó|controla|controló|verifica|verificó)/iu;
const REVIEW_VERB_EN = /(?:reviews?|reviewed|reviewing)/iu;
/** Word-bounded doc tokens — do not treat "recording" as documentation. */
const DOC_TOKEN_EN = /\b(?:documentation|documents?|paperwork|records?)\b/iu;
const DOCUMENT_CHECK_EN =
  /(?:(?:\b(?:documentation|documents?|paperwork|records?)\b).{0,40}(?:associated|related|accompanying|received|receiving|incoming)|(?:associated|related|accompanying|receiving).{0,24}(?:\b(?:documentation|documents?|paperwork|records?)\b)|(?:verifies?|checks?|reviews?|examines?).{0,32}(?:\b(?:documentation|documents?|paperwork|records?)\b)|documentaci[oó]n|documentos|registros?\s+relacionad)/iu;
const GOODS_MOVEMENT_EN =
  /(?:(?:preparation|preparing|prepared).{0,48}(?:movement|moving|handling).{0,40}(?:merchandise|goods)|(?:movement|moving|handling).{0,40}(?:merchandise|goods)|(?:merchandise|goods).{0,40}(?:preparation|movement)|prepare\s+and\s+move\s+(?:merchandise|goods)|preparaci[oó]n.{0,48}movimiento.{0,40}mercanc|movimiento.{0,40}mercanc)/iu;
const COLLEAGUES_EN =
  /(?:colleagues?|coworkers?|team\s+members?|compa[nñ]er[oa]s?|colegas?)/iu;
const COORDINATE_EN =
  /(?:coordinates?|coordinated|collaborates?|collaborated|works?\s+with|coordina|coordinó|coordinar|coordinaci[oó]n)/iu;

/** Generic warehouse shell that must not cover all three duties alone. */
const GENERIC_WAREHOUSE_SHELL_EN =
  /^(?:handles?|manages?|performs?|supports?)\s+warehouse\s+operations\.?$/iu;

/** Docs-primary bullets must not satisfy the incoming-goods fact. */
function hasDocumentationPrimaryObject(text: string): boolean {
  const t = text || '';
  if (!DOC_TOKEN_EN.test(t)) return false;
  // Combined inbound+docs shells are documentation-bearing for exclusion.
  if (DOCUMENT_CHECK_EN.test(t)) return true;
  return DOC_TOKEN_EN.test(t) && !INCOMING_OBJECT_EN.test(t);
}

export type EnglishWarehouseFactId =
  | 'incoming_goods_inspection'
  | 'related_documentation_verification'
  | 'colleague_coordination_goods_preparation_movement';

/** Legacy Spanish/German id aliases used in shared diagnostic hashes. */
export type EnglishWarehouseFactIdAlias =
  | EnglishWarehouseFactId
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type EnglishWarehouseCoverageResult = {
  ok: boolean;
  required: EnglishWarehouseFactId[];
  covered: EnglishWarehouseFactId[];
  uncovered: EnglishWarehouseFactId[];
  reason: string | null;
  revision: typeof ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION
    | typeof ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION;
};

export type EnglishWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type EnglishWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: EnglishWarehousePredicateFamily[];
  predicateFamiliesCandidate: EnglishWarehousePredicateFamily[];
};

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresEnglishWarehouseFactCoverage(sourceDescription: string): boolean {
  void ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION;
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|mercanc[ií]a|incoming\s+goods|merchandise|received\s+goods|गोदाम|माल|आवाजाही|तैयारी|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

/**
 * Strict English 3-fact warehouse gate applies to Spanish→English (and English
 * Atlas-style) sources. Serbian/Hindi/etc. soft cross-locale paths keep the
 * existing semantic/material coverage contract.
 */
export function sourceRequiresStrictEnglishWarehouseFactCoverage(
  sourceDescription: string,
): boolean {
  void ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION;
  if (!sourceRequiresEnglishWarehouseFactCoverage(sourceDescription || '')) return false;
  const src = sourceDescription || '';
  const spanishWarehouse = /(?:mercanc[ií]a|almac[eé]n|documentaci[oó]n|compa[nñ]er|revis[oó]|comprob[oó]|coordina)/iu
    .test(src);
  const englishAtlas = /(?:incoming\s+(?:merchandise|goods)|received\s+goods|documentation\s+associated|coordinates?\s+with\s+colleagues)/iu
    .test(src);
  return spanishWarehouse || englishAtlas;
}

function sourceWarehouseFacts(sourceDescription: string): EnglishWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: EnglishWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|merchandise|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|recepci[oó]n\s+de\s+mercanc)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|registros?\s+relacionad)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|registros?\s+relacionad)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|preparation|colleague|compa[nñ]er)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|preparation.{0,24}(?:movement|goods|merchandise)|koordin.{0,40}(?:rob|goods|माल|mercanc|merchandise)|colleague.{0,40}(?:goods|rob|माल|mercanc|merchandise)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc))/iu
      .test(joined);

  if (hasInbound) facts.push('incoming_goods_inspection');
  if (hasDocs || docUnit) {
    if (!facts.includes('related_documentation_verification')) {
      facts.push('related_documentation_verification');
    }
  }
  if (hasMovement) facts.push('colleague_coordination_goods_preparation_movement');

  // Established three-fact warehouse fixture: if inbound+movement present, require docs too.
  if (
    facts.includes('incoming_goods_inspection')
    && facts.includes('colleague_coordination_goods_preparation_movement')
    && !facts.includes('related_documentation_verification')
    && units.length >= 2
  ) {
    facts.splice(1, 0, 'related_documentation_verification');
  }

  // One identity per material source unit when three warehouse units are present.
  if (units.length >= 3 && facts.length < 3) {
    return [
      'incoming_goods_inspection',
      'related_documentation_verification',
      'colleague_coordination_goods_preparation_movement',
    ];
  }
  return facts.length
    ? facts
    : (units.length >= 3
      ? [
        'incoming_goods_inspection',
        'related_documentation_verification',
        'colleague_coordination_goods_preparation_movement',
      ]
      : facts);
}

function bulletCoversIncomingGoodsInspection(bullet: string): boolean {
  void ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION;
  const t = (bullet || '').trim();
  if (!t || GENERIC_WAREHOUSE_SHELL_EN.test(t)) return false;
  // Movement / coordination alone must not satisfy inspection.
  if (COORDINATE_EN.test(t) && COLLEAGUES_EN.test(t) && GOODS_MOVEMENT_EN.test(t)
    && !INCOMING_OBJECT_EN.test(t) && !INBOUND_CONTEXT_EN.test(t)) {
    return false;
  }
  // Documentation-only / documentation-primary must not satisfy inspection.
  if (hasDocumentationPrimaryObject(t) && !INCOMING_OBJECT_EN.test(t)) return false;
  if (DOCUMENT_CHECK_EN.test(t) && !INCOMING_OBJECT_EN.test(t) && !INBOUND_CONTEXT_EN.test(t)) {
    return false;
  }
  // Exclude combined inbound+docs shells from covering the incoming-only fact.
  if (DOCUMENT_CHECK_EN.test(t) && DOC_TOKEN_EN.test(t) && INCOMING_OBJECT_EN.test(t)) {
    return false;
  }
  const hasAction = CHECK_VERB_EN.test(t)
    || (REVIEW_VERB_EN.test(t) && (INCOMING_OBJECT_EN.test(t) || INBOUND_CONTEXT_EN.test(t)));
  if (!hasAction) return false;
  // Require goods object and/or clear inbound receipt context (not bare warehouse location).
  if (INCOMING_OBJECT_EN.test(t)) return true;
  if (INBOUND_CONTEXT_EN.test(t) && /(?:merchandise|goods|deliveries)/iu.test(t)) return true;
  if (INCOMING_GOODS_EN.test(t) && /(?:merchandise|goods|deliveries|mercanc)/iu.test(t)) return true;
  return false;
}

function bulletCoversFact(bullet: string, fact: EnglishWarehouseFactId): boolean {
  const t = (bullet || '').trim();
  if (!t || GENERIC_WAREHOUSE_SHELL_EN.test(t)) return false;
  switch (fact) {
    case 'incoming_goods_inspection':
      return bulletCoversIncomingGoodsInspection(t);
    case 'related_documentation_verification':
      // "documentation associated with received goods" is valid docs evidence;
      // do not exclude merely because "received goods" appears as document context.
      return DOCUMENT_CHECK_EN.test(t)
        && (CHECK_VERB_EN.test(t) || REVIEW_VERB_EN.test(t))
        && DOC_TOKEN_EN.test(t)
        && !bulletCoversIncomingGoodsInspection(t)
        && !/(?:manages?\s+(?:the\s+)?documentation|updates?\s+(?:the\s+)?(?:work\s+)?documentation|tracks?\s+open\s+(?:items|cases))/iu
          .test(t);
    case 'colleague_coordination_goods_preparation_movement':
      return COORDINATE_EN.test(t)
        && COLLEAGUES_EN.test(t)
        && GOODS_MOVEMENT_EN.test(t)
        && !/(?:information\s+exchange|timely\s+completion|general\s+(?:operations|tasks))/iu
          .test(t);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for English Experience candidates.
 * Soft action-frame / material-key aggregation is not sufficient.
 */
export function validateEnglishWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): EnglishWarehouseCoverageResult {
  void ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION;
  void ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION;
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: EnglishWarehouseFactId[] = [];
  for (const fact of required) {
    let hit = -1;
    for (let i = 0; i < bullets.length; i += 1) {
      if (used.has(i)) continue;
      if (bulletCoversFact(bullets[i]!, fact)) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) {
      used.add(hit);
      covered.push(fact);
    }
  }
  const uncovered = required.filter((f) => !covered.includes(f));
  const ok = uncovered.length === 0 && covered.length === required.length;
  return {
    ok,
    required,
    covered,
    uncovered,
    reason: ok ? null : 'english_experience_warehouse_fact_coverage_incomplete',
    revision: ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION,
  };
}

function predicateFamilyFromUnit(unit: string): EnglishWarehousePredicateFamily | null {
  void ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION;
  const t = unit || '';
  if (bulletCoversIncomingGoodsInspection(t)) {
    return 'inspect_incoming';
  }
  if (
    (CHECK_VERB_EN.test(t) || REVIEW_VERB_EN.test(t))
    && DOCUMENT_CHECK_EN.test(t)
    && DOC_TOKEN_EN.test(t)
    && !bulletCoversIncomingGoodsInspection(t)
  ) {
    return 'verify_documentation';
  }
  if (COORDINATE_EN.test(t) && COLLEAGUES_EN.test(t) && GOODS_MOVEMENT_EN.test(t)) {
    return 'coordinate_colleagues';
  }
  // Spanish source units (Atlas fixture).
  if (/(?:revis|comprob|verific|control).{0,40}mercanc[ií]a\s+(?:entrant|recibid)|mercanc[ií]a\s+entrant/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:revis|comprob|verific|control).{0,40}document|documentaci[oó]n|registros?\s+relacionad/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:coordina|coordinó).{0,48}compa[nñ]er|compa[nñ]er.{0,48}(?:preparaci[oó]n|movimiento)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

function predicateIdentity(family: EnglishWarehousePredicateFamily, surface: string): string {
  const norm = (surface || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  let h = 2166136261;
  const key = `${family}:${norm}`;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `en_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

/**
 * Predicate identity coverage for English warehouse Experience.
 * One predicate family per material source unit for the Atlas three-duty fixture.
 */
export function scanEnglishWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): EnglishWarehousePredicateScan {
  void ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: EnglishWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = predicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(predicateIdentity(fam, u));
    }
  }
  // Three warehouse units → three predicates even when category heuristics miss one.
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: EnglishWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(predicateIdentity(fam, sourceUnits[i] || fam));
      }
    }
  }

  const candFamilies: EnglishWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = predicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }

  const added: string[] = [];
  for (const fam of candFamilies) {
    if (!sourceFamilies.includes(fam)) {
      added.push(predicateIdentity(fam, fam));
    }
  }
  // Unsupported fourth duty predicates (safety/inventory/leadership shells).
  for (const u of candUnits) {
    if (/(?:ensures?\s+safety|optimizes?|leads?\s+the\s+team|manages?\s+inventory|packs?\s+and\s+ships)/iu.test(u)) {
      const id = predicateIdentity('inspect_incoming', `unsupported:${u.slice(0, 48)}`);
      if (!added.includes(id)) added.push(id);
    }
  }

  const coverageOk = sourceFamilies.every((f) => candFamilies.includes(f));
  return {
    sourcePredicateIdentityCount: sourceFamilies.length || sourceIds.length,
    candidatePredicateIdentityCount: candFamilies.length,
    candidateAddedPredicateCount: added.length,
    candidateAddedPredicateIdentityHashes: added,
    sourceUnitPredicateCoveragePassed: coverageOk && added.length === 0,
    finalCandidatePredicateValidationApplicable: true,
    predicateFamiliesSource: sourceFamilies,
    predicateFamiliesCandidate: candFamilies,
  };
}

/** Distinct source fact identities successfully expressed in the English candidate. */
export function countEnglishWarehouseTranslatedFacts(
  sourceDescription: string,
  candidateDescription: string,
): number {
  const cov = validateEnglishWarehouseExperienceCoverage(sourceDescription, candidateDescription);
  return cov.covered.length;
}

export function englishWarehouseFactDiagId(fact: EnglishWarehouseFactId): string {
  return `en_wh_${fact}`;
}

/**
 * Deterministic English warehouse bullets from the three canonical fact identities.
 * Must pass `validateEnglishWarehouseExperienceCoverage` against the same source
 * (development invariant enforced by callers / tests).
 */
export function buildEnglishWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
}): string {
  void ENGLISH_EXPERIENCE_DETERMINISTIC_THREE_FACT_328_REVISION;
  void ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription || '');
  const required = facts.length >= 3
    ? facts
    : ([
      'incoming_goods_inspection',
      'related_documentation_verification',
      'colleague_coordination_goods_preparation_movement',
    ] as EnglishWarehouseFactId[]);
  const lines: string[] = [];
  for (const fact of required) {
    if (fact === 'incoming_goods_inspection') {
      lines.push(present
        ? 'Inspects incoming merchandise upon arrival at the warehouse.'
        : 'Inspected incoming merchandise upon arrival at the warehouse.');
    } else if (fact === 'related_documentation_verification') {
      lines.push(present
        ? 'Verifies documentation associated with received goods.'
        : 'Verified documentation associated with received goods.');
    } else if (fact === 'colleague_coordination_goods_preparation_movement') {
      lines.push(present
        ? 'Coordinates with colleagues on the preparation and movement of merchandise.'
        : 'Coordinated with colleagues on the preparation and movement of merchandise.');
    }
  }
  const text = formatExperienceBullets(lines.length
    ? lines
    : (present
      ? [
        'Inspects incoming merchandise upon arrival at the warehouse.',
        'Verifies documentation associated with received goods.',
        'Coordinates with colleagues on the preparation and movement of merchandise.',
      ]
      : [
        'Inspected incoming merchandise upon arrival at the warehouse.',
        'Verified documentation associated with received goods.',
        'Coordinated with colleagues on the preparation and movement of merchandise.',
      ]));
  // Development invariant: emitted fallback must cover every required fact.
  const self = validateEnglishWarehouseExperienceCoverage(
    options.sourceDescription || text,
    text,
  );
  if (!self.ok && typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    throw new Error(
      `english_warehouse_fallback_self_coverage_failed:${self.uncovered.join(',')}`,
    );
  }
  return text;
}
