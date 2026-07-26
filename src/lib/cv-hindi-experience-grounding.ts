/**
 * Hindi Experience AI grounding (AAB-338+).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from visible Russian soft shells or merged HI soft frames.
 *
 * Soft HI shells historically collapsed incoming-goods + documentation into one
 * `check_records` bullet (with accuracy/record claims) and invented a separate
 * `update_records` / organization duty, which produced requiredFactCount=2,
 * translatedFactCount=0, and null predicate coverage. This module keeps three
 * independent identities.
 */
import {
  materialDutyKeysFromDescription,
  type MaterialDutyKey,
} from './cv-material-duty-coverage';
import {
  extractSourceDutyUnits,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import { splitExperienceBullets, formatExperienceBullets } from './cv-canonical-facts';
import {
  sourceHasWarehouseDomainApplicability,
  sourceIsCookingHospitalityWithoutWarehouseEvidence,
  WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION,
} from './cv-warehouse-domain-applicability';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const HINDI_EXPERIENCE_GROUNDING_338_REVISION =
  'hindi-experience-grounding-338-v1' as const;

/** Packaging proof — Hindi cooking Experience fallback (AAB-344 domain routing). */
export const HINDI_COOKING_EXPERIENCE_FALLBACK_344_REVISION =
  'hindi-cooking-experience-fallback-344-v1' as const;

void HINDI_EXPERIENCE_GROUNDING_338_REVISION;
void HINDI_COOKING_EXPERIENCE_FALLBACK_344_REVISION;
void WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_HI =
  /(?:आने\s*वाल[ेी]\s+(?:माल|वस्तुओं)|प्राप्त\s+होने\s+वाल[ेी]\s+माल|गोदाम\s+में\s+आने|आने\s+वाले\s+माल|माल.{0,24}आने)/u;
const CHECK_VERB_HI =
  /(?:जाँच|जांच|निरीक्षण)\s*(?:करती\s*(?:हैं|है)|करते\s*(?:हैं|है)|करता\s*(?:है|हैं)|की|कर)/u;
const DOCUMENT_CHECK_HI =
  /(?:संबंधित\s+दस्तावे[ज़ज]|दस्तावे[ज़ज]ों\s+की\s+(?:जाँच|जांच)|प्राप्त\s+माल\s+से\s+संबंधित|माल\s+से\s+संबंधित\s+दस्तावे)/u;
const GOODS_MOVEMENT_HI =
  /(?:(?:तैयारी|तैयार).{0,40}(?:स्थानांतरण|आवाजाही)|(?:स्थानांतरण|आवाजाही).{0,40}माल|माल\s+(?:की\s+)?तैयारी|माल\s+को\s+तैयार)/u;
const COLLEAGUES_HI = /(?:सहकर्मियों|सहयोगियों)/u;
const COORDINATE_HI = /(?:समन्वय|समन्वय\s+कर)/u;

/** Merged soft-shell: goods + docs in one bullet — must not cover both facts alone. */
const MERGED_GOODS_DOCS_SOFT_HI =
  /(?:आने\s*वाल[ेी]\s+माल.{0,32}संबंधित\s+दस्तावे|माल\s+और\s+संबंधित\s+दस्तावे)/u;

/** Soft invented duties / unsupported scope. */
const UNSUPPORTED_HI_SOFT =
  /(?:सही\s+रिक[ॉो]र्ड\s+सुनिश्चित|रिक[ॉो]र्ड\s+अद्यतन|गोदाम\s+के\s+रिक[ॉो]र्ड|व्यवस्थित\s+रख|संगठित\s+रख)/u;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresHindiWarehouseFactCoverage(sourceDescription: string): boolean {
  const src = sourceDescription || '';
  // Applicability first — never activate from prep+colleagues / kitchen alone.
  if (!sourceHasWarehouseDomainApplicability(src)) return false;
  const keys = materialDutyKeysFromDescription(src);
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|magazzino|armaz[eé]m|mercanc[ií]a|marchandise|merci|mercadoria|склад|товар|incoming\s+goods|गोदाम|माल|आवाजाही|स्थानांतरण|zaprimljen|robu)/iu
      .test(src);
}

/**
 * Exact AAB-344 Cook / Test Kitchen English structured-canonical triad.
 * Used for grounded Hindi cooking fallback when the provider is invalid.
 */
export function isExactHindiCookingThreeDutySource(sourceDescription: string): boolean {
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u).toLowerCase())
    .filter(Boolean);
  if (units.length !== 3) return false;
  const joined = units.join('\n');
  const hasMeals = /(?:prepares?|prepared)\s+meals?\s+and\s+dishes?/i.test(joined)
    || /भोजन|व्यंजन/.test(joined);
  const hasHygiene = /(?:maintains?|maintained).{0,40}(?:hygiene|cleanliness).{0,40}kitchen/i.test(joined)
    || /(?:hygiene|cleanliness).{0,40}kitchen/i.test(joined)
    || /रसोई.{0,40}(?:स्वच्छता|साफ)/u.test(joined);
  const hasKitchenCollab = /(?:coordinates?|coordinated).{0,48}kitchen\s+colleagues.{0,48}food\s+preparation/i.test(joined)
    || /kitchen\s+colleagues.{0,40}food\s+preparation/i.test(joined)
    || /रसोई के सहकर्मियों/.test(joined);
  return hasMeals && hasHygiene && hasKitchenCollab;
}

function hindiCookingVerbForms(options: {
  isPresent?: boolean;
  gender?: string;
}): { prepare: string; maintain: string; coordinate: string } {
  const present = options.isPresent !== false;
  const g = String(options.gender || '').toLowerCase();
  const female = /^(female|f|ženski|zenski)$/i.test(g);
  const male = /^(male|m|muški|muski)$/i.test(g);
  if (!present) {
    if (female) {
      return { prepare: 'तैयार कीं', maintain: 'बनाए रखा', coordinate: 'समन्वय किया' };
    }
    if (male) {
      return { prepare: 'तैयार किए', maintain: 'बनाए रखा', coordinate: 'समन्वय किया' };
    }
    return { prepare: 'तैयार किए', maintain: 'बनाए रखा', coordinate: 'समन्वय किया' };
  }
  // Current / present: honorific plural CV register (matches warehouse Hindi).
  if (female) {
    return {
      prepare: 'तैयार करती हैं',
      maintain: 'बनाए रखती हैं',
      coordinate: 'समन्वय करती हैं',
    };
  }
  if (male) {
    return {
      prepare: 'तैयार करते हैं',
      maintain: 'बनाए रखते हैं',
      coordinate: 'समन्वय करते हैं',
    };
  }
  return {
    prepare: 'तैयार करते हैं',
    maintain: 'बनाए रखते हैं',
    coordinate: 'समन्वय करते हैं',
  };
}

/**
 * Deterministic Hindi cooking bullets for the exact three-duty cook fixture.
 * Never invents design or warehouse duties.
 */
export function buildHindiCookingExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
  gender?: string;
}): string {
  void HINDI_COOKING_EXPERIENCE_FALLBACK_344_REVISION;
  const present = options.isPresent !== false;
  const verbs = hindiCookingVerbForms(options);
  if (!isExactHindiCookingThreeDutySource(options.sourceDescription)
    && !sourceIsCookingHospitalityWithoutWarehouseEvidence(options.sourceDescription)) {
    return '';
  }
  if (present) {
    return formatExperienceBullets([
      `भोजन और व्यंजन ${verbs.prepare}।`,
      `रसोई में स्वच्छता और साफ-सफाई ${verbs.maintain}।`,
      `भोजन की तैयारी के दौरान रसोई के सहकर्मियों के साथ ${verbs.coordinate}।`,
    ]);
  }
  return formatExperienceBullets([
    `भोजन और व्यंजन ${verbs.prepare}।`,
    `रसोई में स्वच्छता और साफ-सफाई ${verbs.maintain}।`,
    `भोजन की तैयारी के दौरान रसोई के सहकर्मियों के साथ ${verbs.coordinate}।`,
  ]);
}

export type HindiWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type HindiWarehouseCoverageResult = {
  ok: boolean;
  required: HindiWarehouseFactId[];
  covered: HindiWarehouseFactId[];
  uncovered: HindiWarehouseFactId[];
  reason: string | null;
  revision: typeof HINDI_EXPERIENCE_GROUNDING_338_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): HindiWarehouseFactId[] {
  const src = sourceDescription || '';
  // Never invent warehouse facts for cooking / non-warehouse occupations.
  if (!sourceHasWarehouseDomainApplicability(src)) return [];
  const keys = new Set(materialDutyKeysFromDescription(src));
  const units = extractSourceDutyUnits(src)
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: HindiWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+(?:que\s+chegam|recebid|em\s+entrada)|поступающ|поступивш|recepci[oó]n\s+de\s+mercanc)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|сопроводительн)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement|movimentazione|movimenta[cç][aã]o|перемещен|подготовк|स्थानांतरण)/iu.test(u));
  // Movement requires goods / warehouse transfer evidence — not kitchen prep+colleagues.
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|स्थानांतरण|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand|merci|mercador|товар)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand|merci|mercador|товар)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand)|collegh[ie].{0,40}(?:preparazione|movimentazione|merci)|colegas?.{0,40}(?:prepara[cç][aã]o|movimenta[cç][aã]o|mercador)|коллег.{0,40}(?:подготов|перемещен|товар)|(?:सहकर्मि|सहयोगि).{0,40}(?:माल|आवाजाही|स्थानांतरण)|(?:माल|आवाजाही|स्थानांतरण).{0,40}(?:सहकर्मि|सहयोगि|समन्वय))/iu
      .test(joined);

  if (hasInbound) facts.push('incoming_goods_check');
  if (hasDocs || docUnit) {
    if (!facts.includes('document_check')) facts.push('document_check');
  }
  if (hasMovement) facts.push('goods_prep_movement_colleagues');

  if (facts.includes('incoming_goods_check')
    && facts.includes('goods_prep_movement_colleagues')
    && !facts.includes('document_check')
    && units.length >= 2) {
    facts.splice(1, 0, 'document_check');
  }
  // Genuine warehouse sources (applicability already held): when units clearly
  // encode multi-duty warehouse work but fact extraction under-fired, use the
  // grounded triad rather than blocking cross-locale translation (pre-344).
  if (!facts.length && units.length >= 3) {
    return ['incoming_goods_check', 'document_check', 'goods_prep_movement_colleagues'];
  }
  if (facts.length >= 1 && units.length >= 3 && facts.length < 3) {
    if (!facts.includes('document_check')) facts.splice(1, 0, 'document_check');
    if (!facts.includes('goods_prep_movement_colleagues')) {
      facts.push('goods_prep_movement_colleagues');
    }
    if (!facts.includes('incoming_goods_check')) {
      facts.unshift('incoming_goods_check');
    }
  }
  return facts;
}

function bulletCoversFact(bullet: string, fact: HindiWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_HI.test(bullet) && CHECK_VERB_HI.test(bullet)
        && !UNSUPPORTED_HI_SOFT.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_HI.test(bullet)
        && CHECK_VERB_HI.test(bullet)
        && !UNSUPPORTED_HI_SOFT.test(bullet)
        && !(MERGED_GOODS_DOCS_SOFT_HI.test(bullet) && INCOMING_GOODS_HI.test(bullet)
          && !/(?:प्राप्त\s+माल\s+से\s+संबंधित|संबंधित\s+दस्तावे[ज़ज]ों\s+की)/u.test(bullet));
    case 'goods_prep_movement_colleagues':
      return COORDINATE_HI.test(bullet)
        && COLLEAGUES_HI.test(bullet)
        && GOODS_MOVEMENT_HI.test(bullet)
        && !UNSUPPORTED_HI_SOFT.test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Hindi Experience candidates.
 * Soft action-frame matching / merged HI soft shells are not sufficient.
 */
export function validateHindiWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): HindiWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: HINDI_EXPERIENCE_GROUNDING_338_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: HindiWarehouseFactId[] = [];
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
    reason: ok ? null : 'hindi_experience_warehouse_fact_coverage_incomplete',
    revision: HINDI_EXPERIENCE_GROUNDING_338_REVISION,
  };
}

function hindiWarehouseVerbForms(options: {
  isPresent?: boolean;
  gender?: string;
}): { check: string; coordinate: string } {
  const present = options.isPresent !== false;
  const g = String(options.gender || '').toLowerCase();
  const female = /^(female|f|ženski|zenski)$/i.test(g);
  const male = /^(male|m|muški|muski)$/i.test(g);
  if (!present) {
    if (female) return { check: 'की', coordinate: 'किया' };
    if (male) return { check: 'की', coordinate: 'किया' };
    return { check: 'की', coordinate: 'किया' };
  }
  // Current / present: honorific plural forms used in Hindi CV prose.
  if (female) return { check: 'करती हैं', coordinate: 'करती हैं' };
  if (male) return { check: 'करते हैं', coordinate: 'करते हैं' };
  return { check: 'करते हैं', coordinate: 'करते हैं' };
}

/** Deterministic Hindi warehouse bullets from material keys + gender. */
export function buildHindiWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
  gender?: string;
}): string {
  void HINDI_EXPERIENCE_GROUNDING_338_REVISION;
  const present = options.isPresent !== false;
  const verbs = hindiWarehouseVerbForms(options);
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? `गोदाम में आने वाले माल की जाँच ${verbs.check}।`
        : 'गोदाम में आने वाले माल की जाँच की।');
    } else if (fact === 'document_check') {
      lines.push(present
        ? `प्राप्त माल से संबंधित दस्तावेज़ों की जाँच ${verbs.check}।`
        : 'प्राप्त माल से संबंधित दस्तावेज़ों की जाँच की।');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? `माल की तैयारी और स्थानांतरण के लिए सहकर्मियों के साथ समन्वय ${verbs.coordinate}।`
        : 'माल की तैयारी और स्थानांतरण के लिए सहकर्मियों के साथ समन्वय किया।');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        `गोदाम में आने वाले माल की जाँच ${verbs.check}।`,
        `प्राप्त माल से संबंधित दस्तावेज़ों की जाँच ${verbs.check}।`,
        `माल की तैयारी और स्थानांतरण के लिए सहकर्मियों के साथ समन्वय ${verbs.coordinate}।`,
      ]
      : [
        'गोदाम में आने वाले माल की जाँच की।',
        'प्राप्त माल से संबंधित दस्तावेज़ों की जाँच की।',
        'माल की तैयारी और स्थानांतरण के लिए सहकर्मियों के साथ समन्वय किया।',
      ]);
  }
  return formatExperienceBullets(lines);
}

export type HindiWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type HindiWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: HindiWarehousePredicateFamily[];
  predicateFamiliesCandidate: HindiWarehousePredicateFamily[];
};

function hindiWarehousePredicateIdentity(
  family: HindiWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `hi_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function hindiPredicateFamilyFromUnit(unit: string): HindiWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || INCOMING_GOODS_HI.test(t)
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand|merci|mercador|товар|माल)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie|controlla|verifica|confere|проверя|जाँच|जांच).{0,24}(?:incoming|eingehend|entrant|merci|mercador|поступа|товар|माल|आने)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|verifica\s+as\s+mercador|проверяет\s+поступающ|गोदाम\s+में\s+आने\s+वाले\s+माल)/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_HI.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн|दस्तावे|संबंधित)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_HI.test(t) && COLLEAGUES_HI.test(t) && GOODS_MOVEMENT_HI.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue|collegh|colegas|коллег|सहकर्मि|सहयोगि).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand|movimentazione|merci|movimenta[cç][aã]o|mercador|подготов|перемещен|товар|तैयारी|आवाजाही|स्थानांतरण)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordena\s+com\s+os\s+colegas|координирует\s+с\s+коллег|सहकर्मियों\s+के\s+साथ\s+समन्वय).{0,48}(?:goods|माल|rob|mercanc|marchand|merci|mercador|товар|Waren|आवाजाही|स्थानांतरण|movement)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le|controlla|verifica|confere|проверя|जाँच|जांच).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+que\s+chegam|поступающ\w*\s+товар|आने\s*वाल[ेी]\s+माल/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie|verifica|confere|проверя|जाँच|जांच).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci|documentazione|documenta[cç][aã]o|документац|दस्तावे)/iu.test(t)) {
    return 'verify_documentation';
  }
  // Require goods/warehouse transfer evidence — kitchen food-prep + colleagues is not warehouse.
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne|si\s+coordina|coordena|координирует|समन्वय).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement|movimentazione|movimenta[cç][aã]o|подготов|перемещен|तैयारी|आवाजाही|स्थानांतरण).{0,40}(?:goods|माल|rob|mercanc|marchand|merci|mercador|товар|Waren|आवाजाही|स्थानांतरण)/iu.test(t)
    || /(?:goods|माल|rob|mercanc|marchand|merci|mercador|товар|Waren).{0,40}(?:prepare|movement|तैयारी|आवाजाही|स्थानांतरण).{0,40}(?:colleague|kolleg|compa[nñ]er|सहकर्मि|коллег)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for Hindi warehouse Experience.
 * Source units may be EN/DE/ES/FR/IT/PT-BR/RU/HI.
 */
export function scanHindiWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): HindiWarehousePredicateScan {
  void HINDI_EXPERIENCE_GROUNDING_338_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: HindiWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = hindiPredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(hindiWarehousePredicateIdentity(fam, u));
    }
  }
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  // Pad warehouse predicate families only when the hard triad is required —
  // never invent warehouse predicates from a single prep+colleagues match.
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<HindiWarehouseFactId, HindiWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(hindiWarehousePredicateIdentity(fam, fact));
      }
    }
  }

  const candFamilies: HindiWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = hindiPredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validateHindiWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<HindiWarehouseFactId, HindiWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of cov.covered) {
      const fam = map[fact];
      if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
    }
  }

  const added: string[] = [];
  for (const fam of candFamilies) {
    if (!sourceFamilies.includes(fam)) {
      added.push(hindiWarehousePredicateIdentity(fam, `added:${fam}`));
    }
  }
  const sourceUnitPredicateCoveragePassed = sourceFamilies.length > 0
    && sourceFamilies.every((f) => candFamilies.includes(f))
    && added.length === 0;

  return {
    sourcePredicateIdentityCount: sourceFamilies.length,
    candidatePredicateIdentityCount: candFamilies.length,
    candidateAddedPredicateCount: added.length,
    candidateAddedPredicateIdentityHashes: added,
    sourceUnitPredicateCoveragePassed,
    finalCandidatePredicateValidationApplicable: true,
    predicateFamiliesSource: sourceFamilies,
    predicateFamiliesCandidate: candFamilies,
  };
}

/** Diagnostic fact identity prefix helper. */
export function hindiWarehouseFactDiagId(id: HindiWarehouseFactId): string {
  return `hi_wh_${id}`;
}
