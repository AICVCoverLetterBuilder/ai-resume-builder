/**
 * Croatian Experience AI grounding (AAB-342+).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from visible Serbian soft/hard shells or merged HR soft frames.
 *
 * Soft HR shells historically collapsed incoming-goods + documentation into one
 * accuracy/check bullet and invented a separate warehouse-records /
 * orderly-storage duty, which produced requiredFactCount=2,
 * translatedFactCount=2, and null predicate coverage.
 * This module keeps three independent identities.
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
export const CROATIAN_EXPERIENCE_GROUNDING_342_REVISION =
  'croatian-experience-grounding-342-v1' as const;

void CROATIAN_EXPERIENCE_GROUNDING_342_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_HR =
  /(?:roba\s+koja\s+(?:stiže|pristiže|dolazi)\s+u\s+skladište|pristigl[aeu]\s+rob[aeu]|ulazn[aeu]\s+rob[aeu]|zaprimljen[aeu]\s+rob[aeu]|primljen[aeu]\s+rob[aeu]|primitak\s+robe|robu\s+koja\s+(?:stiže|pristiže|dolazi)|pristiglu\s+robu|ulaznu\s+robu|zaprimljenu\s+robu)/iu;
const CHECK_VERB_HR =
  /(?:provjerava|pregledava|kontrolira|obavlja\s+provjeru|obavlja\s+pregled|provjeravala|provjeravao|pregledala|pregledao|kontrolirala|kontrolirao)/iu;
const DOCUMENT_CHECK_HR =
  /(?:dokumentaciju\s+povezan[au]\s+s\s+primljenom\s+robom|dokumentaciju\s+vezan[au]\s+uz\s+primljenu\s+robu|prateć[aue]\s+dokumentaciju|pratecu\s+dokumentaciju|dokumente\s+uz\s+zaprimljenu\s+robu|dokumente\s+uz\s+primljenu\s+robu|robn[aue]\s+dokumentaciju|dokumentaciju\s+povezan|dokumente\s+uz\s+robu|prateć[aue]\s+dokument)/iu;
const GOODS_MOVEMENT_HR =
  /(?:priprem[aue]\s+(?:i\s+)?(?:premještanje|premjestanje|kretanje|prijenos)\s+robe|priprem[iu]\s+(?:i\s+)?(?:premještanju|premjestanju|kretanju|prijenosu)\s+robe|pripremu\s+i\s+premještanje\s+robe|pripremi\s+i\s+premještanju\s+robe|pripremu\s+i\s+kretanje\s+robe|pripremi\s+i\s+kretanju\s+robe|unutarnj(?:i|em)\s+transport\s+robe)/iu;
const COLLEAGUES_HR = /(?:kolegama|kolege|kolega)/iu;
const COORDINATE_HR =
  /(?:koordinira|surađuje|suradjuje|u\s+suradnji\s+s|zajedno\s+s\s+kolegama|usklađuje|uskladjuje|koordinirala|koordinirao|surađivala|surađivao)/iu;

/** Merged soft-shell: goods + docs in one bullet — must not cover both facts alone. */
const MERGED_GOODS_DOCS_SOFT_HR =
  /(?:zaprimljen[aeu]\s+rob[aeu]\s+i\s+prateć|pristigl[aeu]\s+rob[aeu]\s+i\s+prateć|pristiglu\s+robu\s+i\s+prateć|ulazn[aeu]\s+rob[aeu]\s+i\s+(?:prateć|dokument)|točnost\s+zaprimljen|ispravnost\s+pristigl|rob[aeu].{0,24}(?:i\s+)?(?:prateć[aue]\s+dokument|dokumentacij))/iu;

/** Soft invented duties / unsupported scope (incl. Serbian lexical leakage). */
const UNSUPPORTED_HR_SOFT =
  /(?:točnost\s+zaprimljen|točnost\s+pristigl|točnost\s+pripadajuć|ažurira\s+skladišn|azurira\s+skladisn|skladišnu\s+evidenciju|skladisnu\s+evidenciju|uredn[ao]\s+(?:i\s+)?organiziran|organiziran[ao]\s+skladištenje|uredan\s+raspored|rasporedu\s+robe|organizacij[aeu]\s+robe|upravljanje\s+zalihama|kvalitet|sigurnost|usaglašenost|usaglasenost|efikasnost|univerzaln|\bproverava\b|\bsarađuje\b|\bsa\s+kolegama\b|\bpremeštanj)/iu;

/**
 * True when the authoritative source encodes Atlas warehouse material duties.
 * Soft Croatian inventory/accuracy/merged shells (build-293b stylistic sources)
 * are not Atlas hard-triad authority — those keep the locative/stylistic path.
 * English (or keyed) triad authority still engages hard grounding.
 */
export function sourceRequiresCroatianWarehouseFactCoverage(sourceDescription: string): boolean {
  const text = sourceDescription || '';
  // Soft shells often still extract warehouse_* material keys; exclude by text.
  if (UNSUPPORTED_HR_SOFT.test(text) || MERGED_GOODS_DOCS_SOFT_HR.test(text)) {
    return false;
  }
  const keys = materialDutyKeysFromDescription(text);
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|magazzino|armaz[eé]m|mercanc[ií]a|marchandise|merci|mercadoria|склад|товар|incoming\s+goods|गोदाम|माल|倉庫|入荷|مستودع|بضائع|واردة|zaprimljen|robu|skladište|skladiste)/iu
      .test(text);
}

export type CroatianWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type CroatianWarehouseCoverageResult = {
  ok: boolean;
  required: CroatianWarehouseFactId[];
  covered: CroatianWarehouseFactId[];
  uncovered: CroatianWarehouseFactId[];
  reason: string | null;
  revision: typeof CROATIAN_EXPERIENCE_GROUNDING_342_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): CroatianWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: CroatianWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+(?:que\s+chegam|recebid|em\s+entrada)|поступающ|поступивш|recepci[oó]n\s+de\s+mercanc|入荷|倉庫に|واردة|مستودع|pristigl|ulazn|prijem\s+robe|roba\s+koja\s+(?:stiže|pristiže|dolazi)|proverava\s+pristigl|provjerava\s+pristigl)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|сопроводительн|関連書類|添付書類|書類|وثائق|مستندات|مرفق|dokumentacij)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн|関連書類|添付書類|書類|وثائق|مستندات|مرفق|dokumentacij)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement|movimentazione|movimenta[cç][aã]o|перемещен|подготовк|स्थानांतरण|準備と移動|搬送|نقل|حركة|إعداد|premešt|premest|kretanje|prijenos|prenos)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|स्थानांतरण|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand|merci|mercador|товар)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand|merci|mercador|товар)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand)|collegh[ie].{0,40}(?:preparazione|movimentazione|merci)|colegas?.{0,40}(?:prepara[cç][aã]o|movimenta[cç][aã]o|mercador)|коллег.{0,40}(?:подготов|перемещен|товар)|सहकर्मि|सहयोगि|同僚.{0,24}(?:準備|移動|連携)|準備と移動|زملاء|نقل|حركة|kolegama|priprem|premešt|premješt|kretanje)/iu
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
    && sourceRequiresCroatianWarehouseFactCoverage(sourceDescription)
  ) {
    return ['incoming_goods_check', 'document_check', 'goods_prep_movement_colleagues'];
  }
  return facts;
}

function bulletCoversFact(bullet: string, fact: CroatianWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_HR.test(bullet) && CHECK_VERB_HR.test(bullet)
        && !UNSUPPORTED_HR_SOFT.test(bullet)
        && !MERGED_GOODS_DOCS_SOFT_HR.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_HR.test(bullet)
        && CHECK_VERB_HR.test(bullet)
        && !UNSUPPORTED_HR_SOFT.test(bullet)
        && !(MERGED_GOODS_DOCS_SOFT_HR.test(bullet) && INCOMING_GOODS_HR.test(bullet)
          && !/(?:dokumentaciju\s+povezan[au]\s+s\s+primljenom\s+robom)/iu.test(bullet));
    case 'goods_prep_movement_colleagues':
      return COORDINATE_HR.test(bullet)
        && COLLEAGUES_HR.test(bullet)
        && GOODS_MOVEMENT_HR.test(bullet)
        && !UNSUPPORTED_HR_SOFT.test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Croatian Experience candidates.
 * Soft action-frame matching / merged HR soft shells are not sufficient.
 */
export function validateCroatianWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): CroatianWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: CROATIAN_EXPERIENCE_GROUNDING_342_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: CroatianWarehouseFactId[] = [];
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
    reason: ok ? null : 'croatian_experience_warehouse_fact_coverage_incomplete',
    revision: CROATIAN_EXPERIENCE_GROUNDING_342_REVISION,
  };
}

/**
 * Deterministic Croatian Latin warehouse bullets from material keys.
 * Present-tense third-person singular forms are naturally gender-neutral.
 * Uses Croatian lexical forms (provjerava / surađuje / s kolegama / premještanje),
 * never Serbian (proverava / sarađuje / sa kolegama / premeštanje).
 */
export function buildCroatianWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
  gender?: string;
}): string {
  void CROATIAN_EXPERIENCE_GROUNDING_342_REVISION;
  void options.gender;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? 'Provjerava robu koja pristiže u skladište.'
        : 'Provjeravala je robu koja je pristizala u skladište.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Provjerava dokumentaciju povezanu s primljenom robom.'
        : 'Provjeravala je dokumentaciju povezanu s primljenom robom.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Surađuje s kolegama na pripremi i premještanju robe.'
        : 'Surađivala je s kolegama na pripremi i premještanju robe.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Provjerava robu koja pristiže u skladište.',
        'Provjerava dokumentaciju povezanu s primljenom robom.',
        'Surađuje s kolegama na pripremi i premještanju robe.',
      ]
      : [
        'Provjeravala je robu koja je pristizala u skladište.',
        'Provjeravala je dokumentaciju povezanu s primljenom robom.',
        'Surađivala je s kolegama na pripremi i premještanju robe.',
      ]);
  }
  return formatExperienceBullets(lines);
}

export type CroatianWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type CroatianWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: CroatianWarehousePredicateFamily[];
  predicateFamiliesCandidate: CroatianWarehousePredicateFamily[];
};

function croatianWarehousePredicateIdentity(
  family: CroatianWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `hr_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function croatianPredicateFamilyFromUnit(unit: string): CroatianWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || (INCOMING_GOODS_HR.test(t) && !MERGED_GOODS_DOCS_SOFT_HR.test(t))
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand|merci|mercador|товар|مال)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie|controlla|verifica|confere|проверя|जाँच|जांच|確認|تفحص|تتحقق|provjerava|pregledava|proverava).{0,24}(?:incoming|eingehend|entrant|merci|mercador|поступа|товар|مال|आने|入荷|واردة|pristigl|ulazn|zaprimljen|skladišt)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|verifica\s+as\s+mercador|проверяет\s+поступающ|गोदाम\s+में\s+आने\s+वाले\s+माल|倉庫に入荷する商品|البضائع\s+الواردة\s+إلى\s+المستودع|provjerava\s+(?:pristiglu\s+robu|robu\s+koja\s+pristiže|zaprimljenu\s+robu)|proverava\s+(?:pristiglu\s+robu|robu\s+koja\s+pristiže))/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_HR.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн|दस्तावे|संबंधित|関連書類|添付書類|وثائق|مستندات|dokumentacij|prateć)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_HR.test(t) && COLLEAGUES_HR.test(t) && GOODS_MOVEMENT_HR.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue|collegh|colegas|коллег|सहकर्मि|सहयोगि|同僚|زملاء|kolegama).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand|movimentazione|merci|movimenta[cç][aã]o|mercador|подготов|перемещен|товар|तैयारी|आवाजाही|स्थानांतरण|準備|移動|إعداد|نقل|priprem|premešt|premješt|kretanje)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordena\s+com\s+os\s+colegas|координирует\s+с\s+коллег|सहकर्मियों\s+के\s+साथ\s+समन्वय|同僚と連携|تنسق\s+مع\s+الزملاء|koordinira\s+s\s+kolegama|surađuje\s+s\s+kolegama|sarađuje\s+sa\s+kolegama)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le|controlla|verifica|confere|проверя|जाँच|जांच|確認|تفحص|تتحقق|provjerava|pregledava|proverava).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+que\s+chegam|поступающ\w*\s+товар|आने\s*वाल[ेी]\s+माल|入荷した商品|倉庫に入荷|البضائع\s+الواردة|pristiglu\s+robu|robu\s+koja\s+pristiže|zaprimljenu\s+robu/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie|verifica|confere|проверя|जाँच|जांच|確認|تتحقق|provjerava|proverava).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci|documentazione|documenta[cç][aã]o|документац|दस्तावे|書類|مستندات|وثائق|dokumentacij|prateć)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne|si\s+coordina|coordena|координирует|समन्वय|同僚と連携|تنسّ?ق|ينسّ?ق|koordinira|surađuje|sarađuje).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement|movimentazione|movimenta[cç][aã]o|подготов|перемещен|तैयारी|आवाजाही|स्थानांतरण|準備|移動|إعداد|نقل|priprem|premešt|premješt|kretanje)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for Croatian warehouse Experience.
 * Source units may be EN/DE/ES/FR/IT/PT-BR/RU/HI/JA/AR/SR/HR.
 */
export function scanCroatianWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): CroatianWarehousePredicateScan {
  void CROATIAN_EXPERIENCE_GROUNDING_342_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: CroatianWarehousePredicateFamily[] = [];
  for (const u of sourceUnits) {
    const fam = croatianPredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: CroatianWarehousePredicateFamily[] = [
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
    const map: Record<CroatianWarehouseFactId, CroatianWarehousePredicateFamily> = {
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

  const candFamilies: CroatianWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = croatianPredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validateCroatianWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<CroatianWarehouseFactId, CroatianWarehousePredicateFamily> = {
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
      added.push(croatianWarehousePredicateIdentity(fam, `added:${fam}`));
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
export function croatianWarehouseFactDiagId(id: CroatianWarehouseFactId): string {
  return `hr_wh_${id}`;
}
