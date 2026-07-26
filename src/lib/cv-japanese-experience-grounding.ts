/**
 * Japanese Experience AI grounding (AAB-339+).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from visible Hindi soft shells or merged JA soft frames.
 *
 * Soft JA shells historically collapsed incoming-goods + documentation into one
 * `check_records` bullet (with accuracy claims) and invented a separate
 * `update_records` / orderly-placement duty, which produced requiredFactCount=2,
 * translatedFactCount=2, and null predicate coverage. This module keeps three
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

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const JAPANESE_EXPERIENCE_GROUNDING_339_REVISION =
  'japanese-experience-grounding-339-v1' as const;

void JAPANESE_EXPERIENCE_GROUNDING_339_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_JA =
  /(?:倉庫に入荷する商品|入荷した商品|倉庫に届く商品|入庫する商品|入荷品|入荷(?:する|した)?(?:商品|貨物)|商品を確認|貨物を確認|入荷品を確認|検品)/u;
const CHECK_VERB_JA = /(?:確認(?:します|する|した|し)|検品)/u;
const DOCUMENT_CHECK_JA =
  /(?:受領した商品に関連する書類|入荷商品に関する書類|関連書類|添付書類|書類を確認|文書を確認|(?:関連|添付)?書類.{0,12}確認)/u;
const GOODS_MOVEMENT_JA =
  /(?:商品の準備と移動|荷物の準備と移動|商品の準備および搬送|準備と移動|準備および搬送|搬送)/u;
const COLLEAGUES_JA = /(?:同僚)/u;
const COORDINATE_JA = /(?:と連携|と協力|を調整|について連携|連携します|連携する|連携した)/u;

/** Merged soft-shell: goods + docs in one bullet — must not cover both facts alone. */
const MERGED_GOODS_DOCS_SOFT_JA =
  /(?:入荷した商品と関連書類|入荷した商品および関連書類|入荷(?:した)?商品.{0,8}関連書類|商品と関連書類)/u;

/** Soft invented duties / unsupported scope. */
const UNSUPPORTED_JA_SOFT =
  /(?:正確性|倉庫記録を更新|保管品の整然|整然とした配置|在庫(?:を)?更新|記録管理|整理・保管|正確さを確認)/u;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresJapaneseWarehouseFactCoverage(sourceDescription: string): boolean {
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|magazzino|armaz[eé]m|mercanc[ií]a|marchandise|merci|mercadoria|склад|товар|incoming\s+goods|गोदाम|माल|倉庫|入荷|商品|準備と移動|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type JapaneseWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type JapaneseWarehouseCoverageResult = {
  ok: boolean;
  required: JapaneseWarehouseFactId[];
  covered: JapaneseWarehouseFactId[];
  uncovered: JapaneseWarehouseFactId[];
  reason: string | null;
  revision: typeof JAPANESE_EXPERIENCE_GROUNDING_339_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): JapaneseWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: JapaneseWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+(?:que\s+chegam|recebid|em\s+entrada)|поступающ|поступивш|recepci[oó]n\s+de\s+mercanc|入荷|倉庫に)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|сопроводительн|関連書類|添付書類|書類)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн|関連書類|添付書類|書類)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement|movimentazione|movimenta[cç][aã]o|перемещен|подготовк|स्थानांतरण|準備と移動|搬送)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|स्थानांतरण|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand|merci|mercador|товар)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand|merci|mercador|товар)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand)|collegh[ie].{0,40}(?:preparazione|movimentazione|merci)|colegas?.{0,40}(?:prepara[cç][aã]o|movimenta[cç][aã]o|mercador)|коллег.{0,40}(?:подготов|перемещен|товар)|सहकर्मि|सहयोगि|同僚.{0,24}(?:準備|移動|連携)|準備と移動)/iu
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
  return facts.length ? facts : (units.length >= 3
    ? ['incoming_goods_check', 'document_check', 'goods_prep_movement_colleagues']
    : facts);
}

function bulletCoversFact(bullet: string, fact: JapaneseWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_JA.test(bullet) && CHECK_VERB_JA.test(bullet)
        && !UNSUPPORTED_JA_SOFT.test(bullet)
        && !MERGED_GOODS_DOCS_SOFT_JA.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_JA.test(bullet)
        && CHECK_VERB_JA.test(bullet)
        && !UNSUPPORTED_JA_SOFT.test(bullet)
        && !(MERGED_GOODS_DOCS_SOFT_JA.test(bullet) && INCOMING_GOODS_JA.test(bullet)
          && !/(?:受領した商品に関連する書類|入荷商品に関する書類)/u.test(bullet));
    case 'goods_prep_movement_colleagues':
      return COORDINATE_JA.test(bullet)
        && COLLEAGUES_JA.test(bullet)
        && GOODS_MOVEMENT_JA.test(bullet)
        && !UNSUPPORTED_JA_SOFT.test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Japanese Experience candidates.
 * Soft action-frame matching / merged JA soft shells are not sufficient.
 */
export function validateJapaneseWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): JapaneseWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: JAPANESE_EXPERIENCE_GROUNDING_339_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: JapaneseWarehouseFactId[] = [];
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
    reason: ok ? null : 'japanese_experience_warehouse_fact_coverage_incomplete',
    revision: JAPANESE_EXPERIENCE_GROUNDING_339_REVISION,
  };
}

/** Deterministic Japanese warehouse bullets from material keys (gender-neutral). */
export function buildJapaneseWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
  gender?: string;
}): string {
  void JAPANESE_EXPERIENCE_GROUNDING_339_REVISION;
  void options.gender;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? '倉庫に入荷する商品を確認します。'
        : '倉庫に入荷する商品を確認しました。');
    } else if (fact === 'document_check') {
      lines.push(present
        ? '受領した商品に関連する書類を確認します。'
        : '受領した商品に関連する書類を確認しました。');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? '商品の準備と移動について同僚と連携します。'
        : '商品の準備と移動について同僚と連携しました。');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        '倉庫に入荷する商品を確認します。',
        '受領した商品に関連する書類を確認します。',
        '商品の準備と移動について同僚と連携します。',
      ]
      : [
        '倉庫に入荷する商品を確認しました。',
        '受領した商品に関連する書類を確認しました。',
        '商品の準備と移動について同僚と連携しました。',
      ]);
  }
  return formatExperienceBullets(lines);
}

export type JapaneseWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type JapaneseWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: JapaneseWarehousePredicateFamily[];
  predicateFamiliesCandidate: JapaneseWarehousePredicateFamily[];
};

function japaneseWarehousePredicateIdentity(
  family: JapaneseWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ja_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function japanesePredicateFamilyFromUnit(unit: string): JapaneseWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || (INCOMING_GOODS_JA.test(t) && !MERGED_GOODS_DOCS_SOFT_JA.test(t))
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand|merci|mercador|товар|माल)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie|controlla|verifica|confere|проверя|जाँच|जांच|確認).{0,24}(?:incoming|eingehend|entrant|merci|mercador|поступа|товар|माल|आने|入荷)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|verifica\s+as\s+mercador|проверяет\s+поступающ|गोदाम\s+में\s+आने\s+वाले\s+माल|倉庫に入荷する商品)/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_JA.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн|दस्तावे|संबंधित|関連書類|添付書類)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_JA.test(t) && COLLEAGUES_JA.test(t) && GOODS_MOVEMENT_JA.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue|collegh|colegas|коллег|सहकर्मि|सहयोगि|同僚).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand|movimentazione|merci|movimenta[cç][aã]o|mercador|подготов|перемещен|товар|तैयारी|आवाजाही|स्थानांतरण|準備|移動)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordena\s+com\s+os\s+colegas|координирует\s+с\s+коллег|सहकर्मियों\s+के\s+साथ\s+समन्वय|同僚と連携)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le|controlla|verifica|confere|проверя|जाँच|जांच|確認).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+que\s+chegam|поступающ\w*\s+товар|आने\s*वाल[ेी]\s+माल|入荷した商品|倉庫に入荷/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie|verifica|confere|проверя|जाँच|जांच|確認).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci|documentazione|documenta[cç][aã]o|документац|दस्तावे|書類)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne|si\s+coordina|coordena|координирует|समन्वय|同僚と連携|同僚と協力).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement|movimentazione|movimenta[cç][aã]o|подготов|перемещен|तैयारी|आवाजाही|स्थानांतरण|準備|移動)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for Japanese warehouse Experience.
 * Source units may be EN/DE/ES/FR/IT/PT-BR/RU/HI/JA.
 */
export function scanJapaneseWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): JapaneseWarehousePredicateScan {
  void JAPANESE_EXPERIENCE_GROUNDING_339_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: JapaneseWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = japanesePredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(japaneseWarehousePredicateIdentity(fam, u));
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: JapaneseWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(japaneseWarehousePredicateIdentity(fam, sourceUnits[i] || fam));
      }
    }
  }
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<JapaneseWarehouseFactId, JapaneseWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(japaneseWarehousePredicateIdentity(fam, fact));
      }
    }
  }

  const candFamilies: JapaneseWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = japanesePredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validateJapaneseWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<JapaneseWarehouseFactId, JapaneseWarehousePredicateFamily> = {
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
      added.push(japaneseWarehousePredicateIdentity(fam, `added:${fam}`));
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
export function japaneseWarehouseFactDiagId(id: JapaneseWarehouseFactId): string {
  return `ja_wh_${id}`;
}
