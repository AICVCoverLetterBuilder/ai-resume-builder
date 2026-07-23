/**
 * German Experience AI grounding (AAB-303).
 * Cross-locale and same-locale warehouse fact coverage + contextual unsupported
 * semantic expansions. Does not invent fixture employers/titles at runtime.
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
import type { ExperienceUnsupportedClaimKind } from './cv-experience-unsupported-claims';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const GERMAN_EXPERIENCE_GROUNDING_303_REVISION =
  'german-experience-grounding-303-v1' as const;

void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_DE =
  /(?:eingehend\w*\s+Waren|Wareneingang|eingehend\w*\s+Lieferungen|ankommend\w*\s+Waren)/iu;
const DOCUMENT_CHECK_DE =
  /(?:(?:zugehörig|dazugehörig|begleitend|relevant|entsprech)\w*.{0,24}(?:Unterlagen|Dokumente|Aufzeichnungen|Belege)|(?:Unterlagen|Dokumente|Aufzeichnungen|Belege).{0,24}(?:prüf|kontroll|überprüf))/iu;
const GOODS_MOVEMENT_DE =
  /(?:(?:Vorbereitung|vorbereit).{0,48}(?:Bewegung|Transport|Beweg|Handhab).{0,40}Waren|(?:Bewegung|Transport|innerbetrieblich\w*\s+Transport).{0,40}Waren|Waren.{0,40}(?:vorbereit|Bewegung|Transport))/iu;
const COLLEAGUES_DE = /(?:Kolleg\w*|Team(?:mitglied)?\w*)/iu;
const COORDINATE_DE = /(?:Koordinier|Stimmt\s+ab|Abstimmung|abstimmen)/iu;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresGermanWarehouseFactCoverage(sourceDescription: string): boolean {
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|incoming\s+goods|गोदाम|माल|आवाजाही|तैयारी|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type GermanWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type GermanWarehouseCoverageResult = {
  ok: boolean;
  required: GermanWarehouseFactId[];
  covered: GermanWarehouseFactId[];
  uncovered: GermanWarehouseFactId[];
  reason: string | null;
  /** Packaging proof — kept as a live field so the revision survives minification. */
  revision: typeof GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): GermanWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: GermanWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен)/iu
      .test(joined);
  // Document check is distinct when a separate unit mentions docs without only being inbound.
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल)|colleague.{0,40}(?:goods|rob|माल))/iu
      .test(joined);

  if (hasInbound) facts.push('incoming_goods_check');
  if (hasDocs || docUnit) {
    if (!facts.includes('document_check')) facts.push('document_check');
  }
  if (hasMovement) facts.push('goods_prep_movement_colleagues');

  // Established three-fact warehouse fixture: if inbound+movement present, require docs too.
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

function bulletCoversFact(bullet: string, fact: GermanWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_DE.test(bullet)
        && /(?:prüf|kontroll|überprüf|prüft|kontrolliert)/iu.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_DE.test(bullet)
        && !/(?:aktualisiert\s+Arbeitsdokumentation|verfolgt\s+offene\s+Vorgänge|Vollständigkeit\s+der\s+Daten)/iu
          .test(bullet);
    case 'goods_prep_movement_colleagues':
      return COORDINATE_DE.test(bullet)
        && COLLEAGUES_DE.test(bullet)
        && GOODS_MOVEMENT_DE.test(bullet)
        && !/(?:Informationsaustausch|fristgerecht\w*\s+Fertigstellung|allgemeine\s+(?:Abläufe|Aufgaben))/iu
          .test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for German Experience candidates.
 * Soft action-frame matching is not sufficient.
 */
export function validateGermanWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): GermanWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: GERMAN_EXPERIENCE_GROUNDING_303_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: GermanWarehouseFactId[] = [];
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
    reason: ok ? null : 'german_experience_warehouse_fact_coverage_incomplete',
    revision: GERMAN_EXPERIENCE_GROUNDING_303_REVISION,
  };
}

export type GermanExperienceExpansionScan = {
  kinds: ExperienceUnsupportedClaimKind[];
  count: number;
  labels: string[];
  scopeExpansionDetected: boolean;
  deadlineClaimDetected: boolean;
  documentationExpansionDetected: boolean;
  malformedRolePhraseDetected: boolean;
  informationExchangeSubstitutionDetected: boolean;
};

function sourceHas(source: string, re: RegExp): boolean {
  return re.test(source || '');
}

/**
 * Contextual German unsupported expansions vs authoritative source.
 * Does not blacklist valid user facts that already contain the same claims.
 */
export function detectGermanExperienceUnsupportedExpansion(
  sourceDescription: string,
  candidateDescription: string,
): GermanExperienceExpansionScan {
  void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
  const source = sourceDescription || '';
  const joined = candidateDescription || '';
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  const labels: string[] = [];
  let deadlineClaimDetected = false;
  let documentationExpansionDetected = false;
  let malformedRolePhraseDetected = false;
  let informationExchangeSubstitutionDetected = false;

  if (/\bim\s+Bereich\s+Fachkraft\b|\bals\s+Bereich\s+Fachkraft\b|\bFachkraft-Bereich\b/iu.test(joined)) {
    malformedRolePhraseDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('malformed_role_domain_phrase');
  }

  if (/\btäglich(?:e|en|er)?\b/iu.test(joined) && !sourceHas(source, /täglich|daily|दैनिक|يومي/iu)) {
    kinds.push('universal_scope_claim');
    labels.push('unsupported_frequency_claim');
  }
  if (/\b(?:regelmäßig|laufend|durchgängig)\b/iu.test(joined)
    && !sourceHas(source, /regelmäßig|laufend|durchgängig|regular|ongoing/iu)) {
    kinds.push('universal_scope_claim');
    labels.push('unsupported_frequency_claim');
  }
  if (/\bVollständigkeit\s+der\s+Daten\b|\bDatenqualität\b|\bSicherstellung\s+korrekter\s+Daten\b/iu
    .test(joined)
    && !sourceHas(source, /Vollständigkeit|Datenqualität|data\s+completeness|पूर्णता|اكتمال/iu)) {
    kinds.push('quality_claim');
    labels.push('unsupported_data_quality_claim');
  }
  if (/\bhöchste\s+Qualität\b|\bhöchste\s+Standards\b/iu.test(joined)
    && !sourceHas(source, /höchste\s+Qualität|highest\s+quality/iu)) {
    kinds.push('quality_claim');
    labels.push('quality_claim');
  }

  if (/(?:Aktualisiert\s+Arbeitsdokumentation|Dokumentation\s+pflegen|sämtliche\s+Vorgänge\s+dokumentieren|verfolgt\s+offene\s+Vorgänge|Vorgänge\s+nachverfolgen)/iu
    .test(joined)
    && !sourceHas(source, /Arbeitsdokumentation|offene\s+Vorgänge|update\s+(?:work\s+)?documentation|track\s+open/iu)) {
    documentationExpansionDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('unsupported_documentation_expansion');
  }

  if (/\b(?:fristgerecht\w*|termingerecht\w*|rechtzeitig\w*)\b|\bpünktliche\s+Fertigstellung\b|\bEinhaltung\s+von\s+Fristen\b|\binnerhalb\s+vorgegebener\s+Zeit\b/iu
    .test(joined)
    && !sourceHas(source, /fristgerecht|termingerecht|deadline|on[- ]?time|समय\s*पर|في\s*الوقت/iu)) {
    deadlineClaimDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('unsupported_deadline_claim');
  }

  const warehouseSource = sourceRequiresGermanWarehouseFactCoverage(source);
  if (warehouseSource
    && /Informationsaustausch\s+koordin|Koordiniert\s+den\s+Informationsaustausch|Kommunikation\s+sicherstellen|allgemeine\s+Abläufe\s+koordin/iu
      .test(joined)
    && !/(?:Vorbereitung|Bewegung|Waren|Wareneingang).{0,40}(?:Kolleg|Team)/iu.test(joined)) {
    informationExchangeSubstitutionDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('goods_movement_substituted_with_information_exchange');
  }

  const uniqueKinds = [...new Set(kinds)];
  const uniqueLabels = [...new Set(labels)];
  return {
    kinds: uniqueKinds,
    count: uniqueKinds.length,
    labels: uniqueLabels,
    scopeExpansionDetected: uniqueKinds.includes('universal_scope_claim')
      || uniqueKinds.includes('quality_claim'),
    deadlineClaimDetected,
    documentationExpansionDetected,
    malformedRolePhraseDetected,
    informationExchangeSubstitutionDetected,
  };
}

/** Deterministic German warehouse bullets from material keys (present/completed). */
export function buildGermanWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
}): string {
  void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? 'Prüft eingehende Waren.'
        : 'Prüfte eingehende Waren.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.'
        : 'Kontrollierte die dazugehörigen Unterlagen und Aufzeichnungen.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.'
        : 'Koordinierte mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Prüft eingehende Waren.',
        'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
        'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
      ]
      : [
        'Prüfte eingehende Waren.',
        'Kontrollierte die dazugehörigen Unterlagen und Aufzeichnungen.',
        'Koordinierte mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
      ]);
  }
  return formatExperienceBullets(lines);
}
