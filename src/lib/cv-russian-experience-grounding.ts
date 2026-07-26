/**
 * Russian Experience AI grounding (AAB-337+).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from visible Portuguese soft shells or merged RU soft frames.
 *
 * Soft RU shells historically collapsed incoming-goods + documentation into one
 * `check_records` bullet and invented a separate `update_records` duty, which
 * produced requiredFactCount=2 and null predicate coverage. This module keeps
 * three independent identities.
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
export const RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION =
  'russian-experience-grounding-337-v1' as const;

void RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_RU =
  /(?:поступающ\w*\s+(?:на\s+склад\s+)?товар|поступивш\w*\s+товар|входящ\w*\s+товар|товар\w*.{0,32}(?:поступа|прибыв|поступи|входящ|на\s+склад)|на\s+склад\w*\s+товар|(?:проверяет|контролирует|осматривает).{0,40}(?:поступивш|поступающ|входящ)\w*\s+товар)/iu;
const CHECK_VERB_RU =
  /(?:проверяет|проверил[аи]?|проверяла|проверял|проверять|контролирует|контролировал[аи]?|осматривает|осмотрел[аи]?)/iu;
const DOCUMENT_CHECK_RU =
  /(?:документац\w*.{0,40}(?:связанн|относящ|полученн|получ|товар)|(?:связанн\w*|относящ\w*).{0,24}документац|(?:проверяет|проверил|контролирует).{0,40}документац|сопроводительн\w*\s+документ)/iu;
const GOODS_MOVEMENT_RU =
  /(?:(?:подготовк\w*|подготов\w*).{0,48}(?:перемещен\w*|перемещ\w*).{0,40}товар|(?:перемещен\w*|перемещ\w*).{0,40}товар|товар\w*.{0,40}(?:подготовк|перемещен))/iu;
const COLLEAGUES_RU = /коллег/iu;
const COORDINATE_RU =
  /(?:координирует|координировал[аи]?|координировать|согласовывает|согласовывал[аи]?)/iu;

/** Merged soft-shell: goods + docs in one bullet — must not cover both facts alone. */
const MERGED_GOODS_DOCS_SOFT_RU =
  /(?:поступ(?:ающ|ивш)\w*\s+товар\w*.{0,48}(?:сопроводительн\w*\s+)?документ|товар\w*.{0,32}и\s+(?:сопроводительн\w*\s+)?документ)/iu;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresRussianWarehouseFactCoverage(sourceDescription: string): boolean {
  if (!sourceHasWarehouseDomainApplicability(sourceDescription || '')) return false;
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|magazzino|armaz[eé]m|mercanc[ií]a|marchandise|merci|mercadoria|склад|товар|incoming\s+goods|गोदाम|माल|आवाजाही|तैयारी|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type RussianWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type RussianWarehouseCoverageResult = {
  ok: boolean;
  required: RussianWarehouseFactId[];
  covered: RussianWarehouseFactId[];
  uncovered: RussianWarehouseFactId[];
  reason: string | null;
  revision: typeof RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): RussianWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: RussianWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+(?:que\s+chegam|recebid|em\s+entrada)|поступающ|поступивш|recepci[oó]n\s+de\s+mercanc)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|сопроводительн)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement|movimentazione|movimenta[cç][aã]o|перемещен|подготовк)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand|merci|mercador|товар)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand|merci|mercador|товар)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand)|collegh[ie].{0,40}(?:preparazione|movimentazione|merci)|colegas?.{0,40}(?:prepara[cç][aã]o|movimenta[cç][aã]o|mercador)|коллег.{0,40}(?:подготов|перемещен|товар))/iu
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

function bulletCoversFact(bullet: string, fact: RussianWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      // Merged soft shell may mention goods+docs together — still may cover incoming,
      // but never also claim document_check from the same used bullet.
      return INCOMING_GOODS_RU.test(bullet) && CHECK_VERB_RU.test(bullet)
        && !/(?:обновляет\s+складск|поддерживает\s+упорядочен)/iu.test(bullet);
    case 'document_check':
      // Dedicated documentation bullet required — merged soft shell alone is insufficient
      // once another bullet already consumed incoming coverage.
      return DOCUMENT_CHECK_RU.test(bullet)
        && CHECK_VERB_RU.test(bullet)
        && !/(?:обновляет\s+(?:складск|учёт|учет)|поддерживает\s+(?:порядок|упорядочен)|герирует\s+документац)/iu
          .test(bullet)
        // Pure merged soft shell without separated documentation duty fails when
        // the same surface tries to satisfy both facts (one bullet / one use).
        && !(MERGED_GOODS_DOCS_SOFT_RU.test(bullet) && INCOMING_GOODS_RU.test(bullet)
          && !/(?:связанн\w*\s+с\s+полученн|относящ\w*\s+к\s+полученн|документац\w*,\s*связанн)/iu.test(bullet));
    case 'goods_prep_movement_colleagues':
      return COORDINATE_RU.test(bullet)
        && COLLEAGUES_RU.test(bullet)
        && GOODS_MOVEMENT_RU.test(bullet)
        && !/(?:обмен\s+информац|своевременн\w*\s+завершен|общ\w*\s+коммуникац)/iu
          .test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Russian Experience candidates.
 * Soft action-frame matching / merged RU soft shells are not sufficient.
 */
export function validateRussianWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): RussianWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: RussianWarehouseFactId[] = [];
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
    reason: ok ? null : 'russian_experience_warehouse_fact_coverage_incomplete',
    revision: RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION,
  };
}

/** Deterministic Russian warehouse bullets from material keys. */
export function buildRussianWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
}): string {
  void RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? 'Проверяет поступающие на склад товары.'
        : 'Проверяла поступающие на склад товары.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Проверяет документацию, связанную с полученными товарами.'
        : 'Проверяла документацию, связанную с полученными товарами.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Координирует с коллегами подготовку и перемещение товаров.'
        : 'Координировала с коллегами подготовку и перемещение товаров.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Проверяет поступающие на склад товары.',
        'Проверяет документацию, связанную с полученными товарами.',
        'Координирует с коллегами подготовку и перемещение товаров.',
      ]
      : [
        'Проверяла поступающие на склад товары.',
        'Проверяла документацию, связанную с полученными товарами.',
        'Координировала с коллегами подготовку и перемещение товаров.',
      ]);
  }
  return formatExperienceBullets(lines);
}

export type RussianWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type RussianWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: RussianWarehousePredicateFamily[];
  predicateFamiliesCandidate: RussianWarehousePredicateFamily[];
};

function russianWarehousePredicateIdentity(
  family: RussianWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ru_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function russianPredicateFamilyFromUnit(unit: string): RussianWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || INCOMING_GOODS_RU.test(t)
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand|merci|mercador|товар)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie|controlla|verifica|confere|проверя).{0,24}(?:incoming|eingehend|entrant|merci|mercador|поступа|товар)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|revisa\s+la\s+mercanc|controlla\s+le\s+merci|verifica\s+as\s+mercador|проверяет\s+поступающ)/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_RU.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|documentazione|documenta[cç][aã]o|registros?\s+relacionad|documents?\s+associ|документац|сопроводительн)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_RU.test(t) && COLLEAGUES_RU.test(t) && GOODS_MOVEMENT_RU.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue|collegh|colegas|коллег).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand|movimentazione|merci|movimenta[cç][aã]o|mercador|подготов|перемещен|товар)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordina\s+con\s+sus\s+compa|si\s+coordina\s+con\s+i\s+collegh|coordena\s+com\s+os\s+colegas|координирует\s+с\s+коллег)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le|controlla|verifica|confere|проверя).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+que\s+chegam|поступающ\w*\s+товар/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie|verifica|confere|проверя).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci|documentazione|documenta[cç][aã]o|документац)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne|si\s+coordina|coordena|координирует).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement|movimentazione|movimenta[cç][aã]o|подготов|перемещен)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for Russian warehouse Experience.
 * Source units may be English, German, Spanish, French, Italian, Portuguese, or Russian.
 */
export function scanRussianWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): RussianWarehousePredicateScan {
  void RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: RussianWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = russianPredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(russianWarehousePredicateIdentity(fam, u));
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: RussianWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(russianWarehousePredicateIdentity(fam, sourceUnits[i] || fam));
      }
    }
  }
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<RussianWarehouseFactId, RussianWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(russianWarehousePredicateIdentity(fam, fact));
      }
    }
  }

  const candFamilies: RussianWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = russianPredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validateRussianWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<RussianWarehouseFactId, RussianWarehousePredicateFamily> = {
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
      added.push(russianWarehousePredicateIdentity(fam, fam));
    }
  }

  const coverageOk = sourceFamilies.length > 0
    && sourceFamilies.every((f) => candFamilies.includes(f))
    && added.length === 0
    && cov.ok;
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
export function russianWarehouseFactDiagId(id: RussianWarehouseFactId): string {
  return `ru_wh_${id}`;
}
