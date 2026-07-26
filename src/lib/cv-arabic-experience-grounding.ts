/**
 * Arabic Experience AI grounding (AAB-340+).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from visible Japanese soft shells or merged AR soft frames.
 *
 * Soft AR shells historically collapsed incoming-goods + documentation into one
 * `check_records` bullet (with accurate-registration claims) and invented a
 * separate `update_records` / organization duty, which produced
 * requiredFactCount=2, translatedFactCount=0, and null predicate coverage.
 * This module keeps three independent identities.
 */
import {
  materialDutyKeysFromDescription,
  type MaterialDutyKey,
} from './cv-material-duty-coverage';
import {
  sourceHasWarehouseDomainApplicability,
} from './cv-warehouse-domain-applicability';
import {
  extractSourceDutyUnits,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import { splitExperienceBullets, formatExperienceBullets } from './cv-canonical-facts';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const ARABIC_EXPERIENCE_GROUNDING_340_REVISION =
  'arabic-experience-grounding-340-v1' as const;

void ARABIC_EXPERIENCE_GROUNDING_340_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_AR =
  /(?:البضائع\s+الواردة(?:\s+إلى\s+المستودع)?|بضائع\s+واردة|البضاعة\s+الواردة|الواردة\s+إلى\s+المستودع)/u;
const CHECK_VERB_AR =
  /(?:تفحص|تفحّص|يفحص|تتحقق|يتحقق|تحقّقت|تحقّق|فحص|تُفحص)/u;
const DOCUMENT_CHECK_AR =
  /(?:المستندات\s+المتعلقة\s+بالبضائع\s+المستلمة|الوثائق\s+المرفقة|المستندات\s+المتعلقة|الوثائق\s+المتعلقة|مستندات\s+البضائع|وثائق\s+البضائع)/u;
const GOODS_MOVEMENT_AR =
  /(?:إعداد\s+البضائع\s+ونقلها|إعداد\s+البضائع\s+وحركتها|نقل\s+البضائع|حركة\s+البضائع|إعداد\s+البضائع)/u;
const COLLEAGUES_AR = /(?:الزملاء|زملائها|زملائه|زملاء)/u;
const COORDINATE_AR = /(?:تنسّ?ق|ينسّ?ق|نسّ?قت|نسّ?ق|تنسيق)/u;

/** Merged soft-shell: goods + docs in one bullet — must not cover both facts alone. */
const MERGED_GOODS_DOCS_SOFT_AR =
  /(?:البضائع\s+الواردة\s+والوثائق|البضائع\s+الواردة\s+والمستندات|الواردة\s+والوثائق\s+المرفقة)/u;

/** Soft invented duties / unsupported scope. */
const UNSUPPORTED_AR_SOFT =
  /(?:التسجيل\s+الدقيق|لضمان\s+التسجيل|سجلات\s+المستودع|تحدّ?ث\s+سجلات|يحدّ?ث\s+سجلات|ترتيب\s+البضائع|تحافظ\s+على\s+ترتيب|يحافظ\s+على\s+ترتيب|دقة\s+السجلات|إدارة\s+المخزون|معايير|سلامة|كفاءة)/u;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresArabicWarehouseFactCoverage(sourceDescription: string): boolean {
  if (!sourceHasWarehouseDomainApplicability(sourceDescription || '')) return false;
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|magazzino|armaz[eé]m|mercanc[ií]a|marchandise|merci|mercadoria|склад|товар|incoming\s+goods|गोदाम|माल|倉庫|入荷|مستودع|بضائع|واردة|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type ArabicWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type ArabicWarehouseCoverageResult = {
  ok: boolean;
  required: ArabicWarehouseFactId[];
  covered: ArabicWarehouseFactId[];
  uncovered: ArabicWarehouseFactId[];
  reason: string | null;
  revision: typeof ARABIC_EXPERIENCE_GROUNDING_340_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): ArabicWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: ArabicWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+(?:que\s+chegam|recebid|em\s+entrada)|поступающ|поступивш|recepci[oó]n\s+de\s+mercanc|入荷|倉庫に|واردة|مستودع)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|сопроводительн|関連書類|添付書類|書類|وثائق|مستندات|مرفق)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн|関連書類|添付書類|書類|وثائق|مستندات|مرفق)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement|movimentazione|movimenta[cç][aã]o|перемещен|подготовк|स्थानांतरण|準備と移動|搬送|نقل|حركة|إعداد)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|स्थानांतरण|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand|merci|mercador|товар)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand|merci|mercador|товар)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand)|collegh[ie].{0,40}(?:preparazione|movimentazione|merci)|colegas?.{0,40}(?:prepara[cç][aã]o|movimenta[cç][aã]o|mercador)|коллег.{0,40}(?:подготов|перемещен|товар)|सहकर्मि|सहयोगि|同僚.{0,24}(?:準備|移動|連携)|準備と移動|زملاء|نقل|حركة)/iu
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
  if (
    !facts.length
    && units.length >= 3
    && sourceRequiresArabicWarehouseFactCoverage(sourceDescription)
  ) {
    return ['incoming_goods_check', 'document_check', 'goods_prep_movement_colleagues'];
  }
  return facts;
}

function bulletCoversFact(bullet: string, fact: ArabicWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_AR.test(bullet) && CHECK_VERB_AR.test(bullet)
        && !UNSUPPORTED_AR_SOFT.test(bullet)
        && !MERGED_GOODS_DOCS_SOFT_AR.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_AR.test(bullet)
        && CHECK_VERB_AR.test(bullet)
        && !UNSUPPORTED_AR_SOFT.test(bullet)
        && !(MERGED_GOODS_DOCS_SOFT_AR.test(bullet) && INCOMING_GOODS_AR.test(bullet)
          && !/(?:المستندات\s+المتعلقة\s+بالبضائع\s+المستلمة)/u.test(bullet));
    case 'goods_prep_movement_colleagues':
      return COORDINATE_AR.test(bullet)
        && COLLEAGUES_AR.test(bullet)
        && GOODS_MOVEMENT_AR.test(bullet)
        && !UNSUPPORTED_AR_SOFT.test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Arabic Experience candidates.
 * Soft action-frame matching / merged AR soft shells are not sufficient.
 */
export function validateArabicWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): ArabicWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: ARABIC_EXPERIENCE_GROUNDING_340_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: ArabicWarehouseFactId[] = [];
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
    reason: ok ? null : 'arabic_experience_warehouse_fact_coverage_incomplete',
    revision: ARABIC_EXPERIENCE_GROUNDING_340_REVISION,
  };
}

function arabicWarehouseVerbForms(options: {
  isPresent?: boolean;
  gender?: string;
}): {
  inspect: string;
  verify: string;
  coordinate: string;
} {
  const present = options.isPresent !== false;
  const g = String(options.gender || '').toLowerCase();
  const male = /^(male|m|muški|muski)$/i.test(g);
  // Female / unspecified share the unvocalized third-person feminine CV forms
  // used across the Arabic package (تـ…). Male uses يـ… present / past.
  if (!present) {
    if (male) {
      return { inspect: 'فحص', verify: 'تحقّق من', coordinate: 'نسّق مع' };
    }
    return { inspect: 'فحصت', verify: 'تحقّقت من', coordinate: 'نسّقت مع' };
  }
  if (male) {
    return { inspect: 'يفحص', verify: 'يتحقق من', coordinate: 'ينسق مع' };
  }
  return { inspect: 'تفحص', verify: 'تتحقق من', coordinate: 'تنسق مع' };
}

/** Deterministic Arabic warehouse bullets from material keys + gender. */
export function buildArabicWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
  gender?: string;
}): string {
  void ARABIC_EXPERIENCE_GROUNDING_340_REVISION;
  const present = options.isPresent !== false;
  const verbs = arabicWarehouseVerbForms(options);
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? `${verbs.inspect} البضائع الواردة إلى المستودع.`
        : `${verbs.inspect} البضائع الواردة إلى المستودع.`);
    } else if (fact === 'document_check') {
      lines.push(present
        ? `${verbs.verify} المستندات المتعلقة بالبضائع المستلمة.`
        : `${verbs.verify} المستندات المتعلقة بالبضائع المستلمة.`);
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? `${verbs.coordinate} الزملاء لإعداد البضائع ونقلها.`
        : `${verbs.coordinate} الزملاء لإعداد البضائع ونقلها.`);
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        `${verbs.inspect} البضائع الواردة إلى المستودع.`,
        `${verbs.verify} المستندات المتعلقة بالبضائع المستلمة.`,
        `${verbs.coordinate} الزملاء لإعداد البضائع ونقلها.`,
      ]
      : [
        `${verbs.inspect} البضائع الواردة إلى المستودع.`,
        `${verbs.verify} المستندات المتعلقة بالبضائع المستلمة.`,
        `${verbs.coordinate} الزملاء لإعداد البضائع ونقلها.`,
      ]);
  }
  return formatExperienceBullets(lines);
}

export type ArabicWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type ArabicWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: ArabicWarehousePredicateFamily[];
  predicateFamiliesCandidate: ArabicWarehousePredicateFamily[];
};

function arabicWarehousePredicateIdentity(
  family: ArabicWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ar_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function arabicPredicateFamilyFromUnit(unit: string): ArabicWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || (INCOMING_GOODS_AR.test(t) && !MERGED_GOODS_DOCS_SOFT_AR.test(t))
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand|merci|mercador|товар|مال)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie|controlla|verifica|confere|проверя|जाँच|जांच|確認|تفحص|تتحقق).{0,24}(?:incoming|eingehend|entrant|merci|mercador|поступа|товар|مال|आने|入荷|واردة)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|verifica\s+as\s+mercador|проверяет\s+поступающ|गोदाम\s+में\s+आने\s+वाले\s+माल|倉庫に入荷する商品|البضائع\s+الواردة\s+إلى\s+المستودع)/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_AR.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн|दस्तावे|संबंधित|関連書類|添付書類|وثائق|مستندات)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_AR.test(t) && COLLEAGUES_AR.test(t) && GOODS_MOVEMENT_AR.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue|collegh|colegas|коллег|सहकर्मि|सहयोगि|同僚|زملاء).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand|movimentazione|merci|movimenta[cç][aã]o|mercador|подготов|перемещен|товар|तैयारी|आवाजाही|स्थानांतरण|準備|移動|إعداد|نقل)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordena\s+com\s+os\s+colegas|координирует\s+с\s+коллег|सहकर्मियों\s+के\s+साथ\s+समन्वय|同僚と連携|تنسق\s+مع\s+الزملاء)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le|controlla|verifica|confere|проверя|जाँच|जांच|確認|تفحص|تتحقق).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+que\s+chegam|поступающ\w*\s+товар|आने\s*वाल[ेी]\s+माल|入荷した商品|倉庫に入荷|البضائع\s+الواردة/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie|verifica|confere|проверя|जाँच|जांच|確認|تتحقق).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci|documentazione|documenta[cç][aã]o|документац|दस्तावे|書類|مستندات|وثائق)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne|si\s+coordina|coordena|координирует|समन्वय|同僚と連携|تنسّ?ق|ينسّ?ق).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement|movimentazione|movimenta[cç][aã]o|подготов|перемещен|तैयारी|आवाजाही|स्थानांतरण|準備|移動|إعداد|نقل)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for Arabic warehouse Experience.
 * Source units may be EN/DE/ES/FR/IT/PT-BR/RU/HI/JA/AR.
 */
export function scanArabicWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): ArabicWarehousePredicateScan {
  void ARABIC_EXPERIENCE_GROUNDING_340_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: ArabicWarehousePredicateFamily[] = [];
  for (const u of sourceUnits) {
    const fam = arabicPredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: ArabicWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
      }
    }
  }
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<ArabicWarehouseFactId, ArabicWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
      }
    }
  }

  const candFamilies: ArabicWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = arabicPredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validateArabicWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<ArabicWarehouseFactId, ArabicWarehousePredicateFamily> = {
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
      added.push(arabicWarehousePredicateIdentity(fam, `added:${fam}`));
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
export function arabicWarehouseFactDiagId(id: ArabicWarehouseFactId): string {
  return `ar_wh_${id}`;
}
