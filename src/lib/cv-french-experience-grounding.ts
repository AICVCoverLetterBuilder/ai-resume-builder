/**
 * French Experience AI grounding (AAB-332).
 * Cross-locale warehouse fact coverage + predicate identity for the grounded
 * three-duty Atlas warehouse scenario. Builds from authoritative canonical
 * facts — never from raw visible Spanish/English soft shells.
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
export const FRENCH_EXPERIENCE_GROUNDING_332_REVISION =
  'french-experience-grounding-332-v1' as const;

void FRENCH_EXPERIENCE_GROUNDING_332_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_FR =
  /(?:marchandises?\s+entrant(?:e|es)?|marchandises?\s+re[cç]ues?|r[eé]ception\s+(?:de\s+)?marchandises?|dans\s+l['']entrep[oô]t)/iu;
const CHECK_VERB_FR =
  /\b(?:contr[oô]le|contr[oô]ler|contr[oô]l[eé]|v[eé]rifie|v[eé]rifier|v[eé]rifi[eé]|inspecte|inspecter)\b/iu;
const DOCUMENT_CHECK_FR =
  /(?:(?:documents?|documentation)\s+(?:associ[eé]s?|relatifs?|li[eé]s?|accompagnant)|(?:documents?|documentation).{0,32}(?:marchandises?\s+re[cç]ues?|re[cç]ues?)|\b(?:contr[oô]le|v[eé]rifie)\w*\b.{0,40}(?:documents?|documentation))/iu;
const GOODS_MOVEMENT_FR =
  /(?:(?:pr[eé]paration|pr[eé]parer|pr[eé]pare)\b.{0,48}(?:d[eé]placement|mouvement|transport).{0,40}marchand|(?:d[eé]placement|mouvement|transport).{0,40}marchand|marchand.{0,40}(?:pr[eé]paration|d[eé]placement|mouvement))/iu;
const COLLEAGUES_FR = /\bcoll[eè]gues?\b/iu;
const COORDINATE_FR = /\b(?:coordonne|coordonner|coordonn[eé]|coordination)\b/iu;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresFrenchWarehouseFactCoverage(sourceDescription: string): boolean {
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|entrep[oô]t|mercanc[ií]a|marchandise|incoming\s+goods|गोदाम|माल|आवाजाही|तैयारी|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type FrenchWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type FrenchWarehouseCoverageResult = {
  ok: boolean;
  required: FrenchWarehouseFactId[];
  covered: FrenchWarehouseFactId[];
  uncovered: FrenchWarehouseFactId[];
  reason: string | null;
  revision: typeof FRENCH_EXPERIENCE_GROUNDING_332_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): FrenchWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: FrenchWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|recepci[oó]n\s+de\s+mercanc)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|registros?\s+relacionad|documents?\s+associ)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|registros?\s+relacionad|documents?\s+associ)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n|d[eé]placement|mouvement)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc|marchand)|colleague.{0,40}(?:goods|rob|माल|mercanc|marchand)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc)|coll[eè]gue.{0,40}(?:pr[eé]paration|d[eé]placement|marchand))/iu
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

function bulletCoversFact(bullet: string, fact: FrenchWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_FR.test(bullet) && CHECK_VERB_FR.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_FR.test(bullet)
        && CHECK_VERB_FR.test(bullet)
        && !/(?:g[eè]re\s+(?:la\s+)?documentation|met\s+[aà]\s+jour\s+(?:la\s+)?documentation|suit\s+les\s+dossiers?\s+ouverts)/iu
          .test(bullet);
    case 'goods_prep_movement_colleagues':
      return COORDINATE_FR.test(bullet)
        && COLLEAGUES_FR.test(bullet)
        && GOODS_MOVEMENT_FR.test(bullet)
        && !/(?:[eé]change\s+d['']informations?|finalisation\s+[aà]\s+temps|communication\s+g[eé]n[eé]rale)/iu
          .test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for French Experience candidates.
 * Soft action-frame matching / English soft shells are not sufficient.
 */
export function validateFrenchWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): FrenchWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: FRENCH_EXPERIENCE_GROUNDING_332_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: FrenchWarehouseFactId[] = [];
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
    reason: ok ? null : 'french_experience_warehouse_fact_coverage_incomplete',
    revision: FRENCH_EXPERIENCE_GROUNDING_332_REVISION,
  };
}

/** Deterministic French warehouse bullets from material keys (present/completed). */
export function buildFrenchWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
}): string {
  void FRENCH_EXPERIENCE_GROUNDING_332_REVISION;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? 'Contrôle les marchandises entrantes dans l’entrepôt.'
        : 'A contrôlé les marchandises entrantes dans l’entrepôt.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Vérifie les documents associés aux marchandises reçues.'
        : 'A vérifié les documents associés aux marchandises reçues.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Coordonne avec ses collègues la préparation et le déplacement des marchandises.'
        : 'A coordonné avec ses collègues la préparation et le déplacement des marchandises.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Contrôle les marchandises entrantes dans l’entrepôt.',
        'Vérifie les documents associés aux marchandises reçues.',
        'Coordonne avec ses collègues la préparation et le déplacement des marchandises.',
      ]
      : [
        'A contrôlé les marchandises entrantes dans l’entrepôt.',
        'A vérifié les documents associés aux marchandises reçues.',
        'A coordonné avec ses collègues la préparation et le déplacement des marchandises.',
      ]);
  }
  return formatExperienceBullets(lines);
}

export type FrenchWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type FrenchWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: FrenchWarehousePredicateFamily[];
  predicateFamiliesCandidate: FrenchWarehousePredicateFamily[];
};

function frenchWarehousePredicateIdentity(
  family: FrenchWarehousePredicateFamily,
  surface: string,
): string {
  let h = 2166136261;
  const s = `${family}:${(surface || '').toLowerCase()}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fr_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

function frenchPredicateFamilyFromUnit(unit: string): FrenchWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || INCOMING_GOODS_FR.test(t)
    || /(?:incoming|inbound|eingehend|entrant).{0,24}(?:goods|waren|mercanc|marchand)|(?:checks?|prüf|kontroll|revisa|comprueba|contr[oô]le|v[eé]rifie).{0,24}(?:incoming|eingehend|entrant)/iu
      .test(t)
    || /(?:checks?\s+incoming\s+goods|prüft\s+eingehende\s+waren|revisa\s+la\s+mercanc)/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_FR.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?|documentaci[oó]n|registros?\s+relacionad|documents?\s+associ)/iu
      .test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_FR.test(t) && COLLEAGUES_FR.test(t) && GOODS_MOVEMENT_FR.test(t))
    || /(?:colleague|kolleg|compa[nñ]er|colega|coll[eè]gue).{0,48}(?:prepare|vorbereit|movement|bewegung|movimiento|move\s+goods|mercanc|d[eé]placement|marchand)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|koordiniert\s+mit\s+kolleg|coordina\s+con\s+sus\s+compa)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  if (/(?:checks?|inspects?|prüft|revisa|contr[oô]le).{0,40}incoming\s+goods|incoming\s+goods|eingehende\s+waren|mercanc[ií]a\s+entrant|marchandises?\s+entrant/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|kontrolliert|comprueba|v[eé]rifie).{0,40}(?:related\s+)?(?:documents?|unterlagen|documentaci)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|koordiniert|coordina|coordonne).{0,60}(?:prepare|vorbereit|movement|bewegung|movimiento|d[eé]placement)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

/**
 * Predicate identity coverage for French warehouse Experience.
 * Source units may be English, Spanish, German, or French (A→B→C lineage).
 */
export function scanFrenchWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): FrenchWarehousePredicateScan {
  void FRENCH_EXPERIENCE_GROUNDING_332_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: FrenchWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = frenchPredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(frenchWarehousePredicateIdentity(fam, u));
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: FrenchWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(frenchWarehousePredicateIdentity(fam, sourceUnits[i] || fam));
      }
    }
  }
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<FrenchWarehouseFactId, FrenchWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(frenchWarehousePredicateIdentity(fam, fact));
      }
    }
  }

  const candFamilies: FrenchWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = frenchPredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  const cov = validateFrenchWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<FrenchWarehouseFactId, FrenchWarehousePredicateFamily> = {
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
      added.push(frenchWarehousePredicateIdentity(fam, fam));
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
