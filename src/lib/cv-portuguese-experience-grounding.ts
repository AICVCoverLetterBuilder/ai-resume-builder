/**
 * Brazilian Portuguese Experience AI grounding (AAB-335+).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from visible Italian/French/Spanish soft shells.
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
export const PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION =
  'portuguese-experience-grounding-335-v1' as const;

void PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_PT =
  /(?:mercadorias?\s+(?:que\s+chegam|em\s+entrada|recebidas)|chegam\s+ao\s+armaz[eé]m|ao\s+armaz[eé]m|no\s+armaz[eé]m)/iu;
const CHECK_VERB_PT =
  /\b(?:verifica|verificar|verificou|confere|conferir|conferiu|checa|checar|inspeciona|inspecionar)\b/iu;
const DOCUMENT_CHECK_PT =
  /(?:documenta[cç][aã]o\s+(?:relacionada|relativa|associada)|documenta[cç][aã]o.{0,40}mercadorias?\s+recebidas|\b(?:verifica|confere)\w*\b.{0,40}documenta[cç][aã]o)/iu;
const GOODS_MOVEMENT_PT =
  /(?:(?:prepara[cç][aã]o|preparar|prepara)\b.{0,48}(?:movimenta[cç][aã]o|movimento).{0,40}mercador|(?:movimenta[cç][aã]o|movimento).{0,40}mercador|mercador.{0,40}(?:prepara[cç][aã]o|movimenta[cç][aã]o|movimento))/iu;
const COLLEAGUES_PT = /\bcolegas\b/iu;
const COORDINATE_PT =
  /\b(?:coordena|coordenar|coordenou|coordenando)\b/iu;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresPortugueseWarehouseFactCoverage(sourceDescription: string): boolean {
  if (!sourceHasWarehouseDomainApplicability(sourceDescription || '')) return false;
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|magazzino|armaz[eé]m|mercanc[ií]a|marchandise|merci|mercadoria|incoming\s+goods|गोदाम|माल|आवाजाही|तैयारी|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type PortugueseWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type PortugueseWarehouseCoverageResult = {
  ok: boolean;
  required: PortugueseWarehouseFactId[];
  covered: PortugueseWarehouseFactId[];
  uncovered: PortugueseWarehouseFactId[];
  reason: string | null;
  revision: typeof PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): PortugueseWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: PortugueseWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+(?:que\s+chegam|recebid|em\s+entrada)|recepci[oó]n\s+de\s+mercanc)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement|movimentazione|movimenta[cç][aã]o)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand|merci|mercador)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand|merci|mercador)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand)|collegh[ie].{0,40}(?:preparazione|movimentazione|merci)|colegas?.{0,40}(?:prepara[cç][aã]o|movimenta[cç][aã]o|mercador))/iu
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

function bulletCoversFact(bullet: string, fact: PortugueseWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_PT.test(bullet) && CHECK_VERB_PT.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_PT.test(bullet)
        && CHECK_VERB_PT.test(bullet)
        && !/(?:atualiza\s+(?:a\s+)?documenta[cç][aã]o|gerencia\s+(?:a\s+)?documenta[cç][aã]o|segue\s+os\s+dossi[eê]s)/iu
          .test(bullet);
    case 'goods_prep_movement_colleagues':
      return COORDINATE_PT.test(bullet)
        && COLLEAGUES_PT.test(bullet)
        && GOODS_MOVEMENT_PT.test(bullet)
        && !/(?:troca\s+de\s+informa[cç][oõ]es|finaliza[cç][aã]o\s+pontual|comunica[cç][aã]o\s+geral)/iu
          .test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Brazilian Portuguese Experience candidates.
 * Soft action-frame matching / English soft shells are not sufficient.
 */
export function validatePortugueseWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): PortugueseWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: PortugueseWarehouseFactId[] = [];
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
    reason: ok ? null : 'portuguese_experience_warehouse_fact_coverage_incomplete',
    revision: PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION,
  };
}

/** Deterministic Brazilian Portuguese warehouse bullets from material keys. */
export function buildPortugueseWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
}): string {
  void PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? 'Verifica as mercadorias que chegam ao armazém.'
        : 'Verificou as mercadorias que chegam ao armazém.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Confere a documentação relacionada às mercadorias recebidas.'
        : 'Conferiu a documentação relacionada às mercadorias recebidas.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Coordena com os colegas a preparação e a movimentação das mercadorias.'
        : 'Coordenou com os colegas a preparação e a movimentação das mercadorias.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Verifica as mercadorias que chegam ao armazém.',
        'Confere a documentação relacionada às mercadorias recebidas.',
        'Coordena com os colegas a preparação e a movimentação das mercadorias.',
      ]
      : [
        'Verificou as mercadorias que chegam ao armazém.',
        'Conferiu a documentação relacionada às mercadorias recebidas.',
        'Coordenou com os colegas a preparação e a movimentação das mercadorias.',
      ]);
  }
  return formatExperienceBullets(lines);
}

export type PortugueseWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type PortugueseWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: PortugueseWarehousePredicateFamily[];
  predicateFamiliesCandidate: PortugueseWarehousePredicateFamily[];
};

function portugueseWarehousePredicateIdentity(
  family: PortugueseWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `pt_br_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function portuguesePredicateFamilyFromUnit(unit: string): PortugueseWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || INCOMING_GOODS_PT.test(t)
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand|merci|mercador)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie|controlla|verifica|confere).{0,24}(?:incoming|eingehend|entrant|merci|mercador)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|revisa\s+la\s+mercanc|controlla\s+le\s+merci|verifica\s+as\s+mercador)/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_PT.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_PT.test(t) && COLLEAGUES_PT.test(t) && GOODS_MOVEMENT_PT.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue|collegh|colegas).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand|movimentazione|merci|movimenta[cç][aã]o|mercador)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordina\s+con\s+sus\s+compa|si\s+coordina\s+con\s+i\s+collegh|coordena\s+com\s+os\s+colegas)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le|controlla|verifica|confere).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+que\s+chegam/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie|verifica|confere).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci|documentazione|documenta[cç][aã]o)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne|si\s+coordina|coordena).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement|movimentazione|movimenta[cç][aã]o)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for Brazilian Portuguese warehouse Experience.
 * Source units may be English, German, Spanish, French, Italian, or Portuguese.
 */
export function scanPortugueseWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): PortugueseWarehousePredicateScan {
  void PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: PortugueseWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = portuguesePredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(portugueseWarehousePredicateIdentity(fam, u));
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: PortugueseWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(portugueseWarehousePredicateIdentity(fam, sourceUnits[i] || fam));
      }
    }
  }
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<PortugueseWarehouseFactId, PortugueseWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(portugueseWarehousePredicateIdentity(fam, fact));
      }
    }
  }

  const candFamilies: PortugueseWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = portuguesePredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validatePortugueseWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<PortugueseWarehouseFactId, PortugueseWarehousePredicateFamily> = {
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
      added.push(portugueseWarehousePredicateIdentity(fam, fam));
    }
  }

  const coverageOk = sourceFamilies.length > 0
    && sourceFamilies.every((f) => candFamilies.includes(f))
    && added.length === 0;
  return {
    sourcePredicateIdentityCount: sourceFamilies.length || sourceIds.length,
    candidatePredicateIdentityCount: candFamilies.length,
    candidateAddedPredicateCount: added.length,
    candidateAddedPredicateIdentityHashes: added,
    sourceUnitPredicateCoveragePassed: coverageOk,
    finalCandidatePredicateValidationApplicable: true,
    predicateFamiliesSource: sourceFamilies,
    predicateFamiliesCandidate: candFamilies,
  };
}

/** Diagnostic fact identity prefix helper. */
export function portugueseWarehouseFactDiagId(id: PortugueseWarehouseFactId): string {
  return `pt_br_wh_${id}`;
}
