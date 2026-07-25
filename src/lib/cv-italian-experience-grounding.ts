/**
 * Italian Experience AI grounding (AAB-334).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from raw visible French/Spanish/English soft shells.
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
export const ITALIAN_EXPERIENCE_GROUNDING_334_REVISION =
  'italian-experience-grounding-334-v1' as const;

void ITALIAN_EXPERIENCE_GROUNDING_334_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_IT =
  /(?:merci\s+in\s+entrata|merci\s+ricevute|ricezione\s+(?:di\s+)?merci|nel\s+magazzino)/iu;
const CHECK_VERB_IT =
  /\b(?:controlla|controllare|controllato|controllati|verifica|verificare|verificato|verificati|ispeziona|ispezionare)\b/iu;
const DOCUMENT_CHECK_IT =
  /(?:(?:documentazione|documenti)\s+(?:relativa|relative|relativi|associat\w*|accompagnant\w*)|(?:documentazione|documenti).{0,32}(?:merci\s+ricevute|ricevute)|\b(?:controlla|verifica)\w*\b.{0,40}(?:documentazione|documenti))/iu;
const GOODS_MOVEMENT_IT =
  /(?:(?:preparazione|preparare|prepara)\b.{0,48}(?:movimentazione|movimento|spostamento).{0,40}merc|(?:movimentazione|movimento|spostamento).{0,40}merc|merc.{0,40}(?:preparazione|movimentazione|movimento))/iu;
const COLLEAGUES_IT = /\bcollegh[ie]\b/iu;
const COORDINATE_IT =
  /\b(?:si\s+coordina|coordina|coordinare|coordinato|coordinamento)\b/iu;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresItalianWarehouseFactCoverage(sourceDescription: string): boolean {
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|magazzino|mercanc[ií]a|marchandise|merci|incoming\s+goods|गोदाम|माल|आवाजाही|तैयारी|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type ItalianWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type ItalianWarehouseCoverageResult = {
  ok: boolean;
  required: ItalianWarehouseFactId[];
  covered: ItalianWarehouseFactId[];
  uncovered: ItalianWarehouseFactId[];
  reason: string | null;
  revision: typeof ITALIAN_EXPERIENCE_GROUNDING_334_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): ItalianWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: ItalianWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|recepci[oó]n\s+de\s+mercanc)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|documentazione|registros?\s+relacionad|documents?\s+associ)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|documentazione|registros?\s+relacionad|documents?\s+associ)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement|movimentazione)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand|merci)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand|merci)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand)|collegh[ie].{0,40}(?:preparazione|movimentazione|merci))/iu
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

function bulletCoversFact(bullet: string, fact: ItalianWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_IT.test(bullet) && CHECK_VERB_IT.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_IT.test(bullet)
        && CHECK_VERB_IT.test(bullet)
        && !/(?:gestisce\s+(?:la\s+)?documentazione|aggiorna\s+(?:la\s+)?documentazione|segue\s+i\s+dossier\s+aperti)/iu
          .test(bullet);
    case 'goods_prep_movement_colleagues':
      return COORDINATE_IT.test(bullet)
        && COLLEAGUES_IT.test(bullet)
        && GOODS_MOVEMENT_IT.test(bullet)
        && !/(?:scambio\s+di\s+informazioni|finalizzazione\s+puntuale|comunicazione\s+generale)/iu
          .test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Italian Experience candidates.
 * Soft action-frame matching / English soft shells are not sufficient.
 */
export function validateItalianWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): ItalianWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: ITALIAN_EXPERIENCE_GROUNDING_334_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: ItalianWarehouseFactId[] = [];
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
    reason: ok ? null : 'italian_experience_warehouse_fact_coverage_incomplete',
    revision: ITALIAN_EXPERIENCE_GROUNDING_334_REVISION,
  };
}

/** Deterministic Italian warehouse bullets from material keys (present/completed). */
export function buildItalianWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
}): string {
  void ITALIAN_EXPERIENCE_GROUNDING_334_REVISION;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? 'Controlla le merci in entrata nel magazzino.'
        : 'Ha controllato le merci in entrata nel magazzino.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Verifica la documentazione relativa alle merci ricevute.'
        : 'Ha verificato la documentazione relativa alle merci ricevute.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Si coordina con i colleghi per la preparazione e la movimentazione delle merci.'
        : 'Si è coordinato con i colleghi per la preparazione e la movimentazione delle merci.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Controlla le merci in entrata nel magazzino.',
        'Verifica la documentazione relativa alle merci ricevute.',
        'Si coordina con i colleghi per la preparazione e la movimentazione delle merci.',
      ]
      : [
        'Ha controllato le merci in entrata nel magazzino.',
        'Ha verificato la documentazione relativa alle merci ricevute.',
        'Si è coordinato con i colleghi per la preparazione e la movimentazione delle merci.',
      ]);
  }
  return formatExperienceBullets(lines);
}

export type ItalianWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type ItalianWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: ItalianWarehousePredicateFamily[];
  predicateFamiliesCandidate: ItalianWarehousePredicateFamily[];
};

function italianWarehousePredicateIdentity(
  family: ItalianWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `it_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function italianPredicateFamilyFromUnit(unit: string): ItalianWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || INCOMING_GOODS_IT.test(t)
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand|merci)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie|controlla).{0,24}(?:incoming|eingehend|entrant|merci)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|revisa\s+la\s+mercanc|controlla\s+le\s+merci)/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_IT.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|documentazione|registros?\s+relacionad|documents?\s+associ)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_IT.test(t) && COLLEAGUES_IT.test(t) && GOODS_MOVEMENT_IT.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue|collegh).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand|movimentazione|merci)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordina\s+con\s+sus\s+compa|si\s+coordina\s+con\s+i\s+collegh)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le|controlla).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant|merci\s+in\s+entrata/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie|verifica).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci|documentazione)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne|si\s+coordina).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement|movimentazione)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for Italian warehouse Experience.
 * Source units may be English, German, Spanish, French, or Italian (A→B→C lineage).
 */
export function scanItalianWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): ItalianWarehousePredicateScan {
  void ITALIAN_EXPERIENCE_GROUNDING_334_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: ItalianWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = italianPredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(italianWarehousePredicateIdentity(fam, u));
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: ItalianWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(italianWarehousePredicateIdentity(fam, sourceUnits[i] || fam));
      }
    }
  }
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<ItalianWarehouseFactId, ItalianWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(italianWarehousePredicateIdentity(fam, fact));
      }
    }
  }

  const candFamilies: ItalianWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = italianPredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validateItalianWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<ItalianWarehouseFactId, ItalianWarehousePredicateFamily> = {
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
      added.push(italianWarehousePredicateIdentity(fam, fam));
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
export function italianWarehouseFactDiagId(id: ItalianWarehouseFactId): string {
  return `it_wh_${id}`;
}
