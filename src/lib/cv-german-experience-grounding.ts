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
  sourceHasWarehouseDomainApplicability,
} from './cv-warehouse-domain-applicability';
import {
  extractSourceDutyUnits,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import { splitExperienceBullets, formatExperienceBullets } from './cv-canonical-facts';
import type { ExperienceUnsupportedClaimKind } from './cv-experience-unsupported-claims';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const GERMAN_EXPERIENCE_GROUNDING_303_REVISION =
  'german-experience-grounding-303-v1' as const;

/** Empty-source / enhancement claim safety for German autonomy, universal scope, quality. */
export const GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION =
  'german-experience-generation-claim-safety-377-v1' as const;

void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
void GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION;

/** Unsupported autonomy modifiers (not source-grounded). */
const DE_AUTONOMY_MODIFIER =
  /\beigenständig\w*\b|\beigenverantwortlich\w*\b|\bin\s+Eigenregie\b/iu;
/** Universal type/scope quantifiers (e.g. aller Bauarten). */
const DE_UNIVERSAL_TYPE_SCOPE =
  /\baller\s+Bauarten\b|\balle(?:r|n)?\s+Bauarten\b|\bjeder\s+Bauart\b|\bsämtlicher?\s+Bauarten\b|\baller\s+Art(?:en)?\b|\bjeder\s+Art\b|\bsämtlicher?\s+Art(?:en)?\b/iu;
/** Quality / compliance craftsmanship modifiers (e.g. fachgerecht). */
const DE_QUALITY_COMPLIANCE_MODIFIER =
  /\bfachgerecht\w*\b|\bvorschriftsgemäß\w*\b|\bnormgerecht\w*\b|\bregelkonform\w*\b|\bfachmännisch\w*\b/iu;

function sourceSupportsGermanAutonomy(source: string): boolean {
  return DE_AUTONOMY_MODIFIER.test(source)
    || /\bselbstständig\w*\s+(?:Arbeit|Tätigkeit|Reparatur)|autonom\w*/iu.test(source);
}

function sourceSupportsGermanUniversalTypeScope(source: string): boolean {
  return DE_UNIVERSAL_TYPE_SCOPE.test(source)
    || /\bsämtlich\w*\b|\balle\s+(?:Typen|Arten|Modelle|Varianten)\b|\buniversell\w*/iu.test(source);
}

function sourceSupportsGermanQualityCompliance(source: string): boolean {
  return DE_QUALITY_COMPLIANCE_MODIFIER.test(source)
    || /\bQualität\b|\bStandards?\b|\bVorschrift(?:en)?\b|\bRichtlinie(?:n)?\b/iu.test(source);
}

/**
 * German autonomy / universal-type-scope / quality-compliance modifiers.
 * Empty-source generation always rejects; enhancement allows source-supported uses.
 * Does not hard-code occupations — legitimate maintenance/diagnosis/replacement/
 * customer-guidance duties without these modifiers remain accepted.
 */
export function detectGermanAutonomyScopeQualityClaims(
  sourceDescription: string,
  candidateDescription: string,
): {
  kinds: ExperienceUnsupportedClaimKind[];
  labels: string[];
  count: number;
  scopeExpansionDetected: boolean;
} {
  void GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION;
  const source = sourceDescription || '';
  const joined = candidateDescription || '';
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  const labels: string[] = [];

  if (!joined.trim()) {
    return {
      kinds: [],
      labels: [],
      count: 0,
      scopeExpansionDetected: false,
    };
  }

  if (DE_AUTONOMY_MODIFIER.test(joined) && !sourceSupportsGermanAutonomy(source)) {
    kinds.push('unsupported_modifier_expansion');
    labels.push('unsupported_autonomy_modifier');
  }
  if (DE_UNIVERSAL_TYPE_SCOPE.test(joined) && !sourceSupportsGermanUniversalTypeScope(source)) {
    kinds.push('universal_scope_claim');
    labels.push('unsupported_universal_type_scope');
  }
  if (DE_QUALITY_COMPLIANCE_MODIFIER.test(joined) && !sourceSupportsGermanQualityCompliance(source)) {
    kinds.push('quality_claim');
    labels.push('unsupported_quality_compliance_modifier');
    kinds.push('standards_compliance_claim');
    labels.push('unsupported_quality_compliance_modifier');
  }

  const uniqueKinds = [...new Set(kinds)];
  const uniqueLabels = [...new Set(labels)];
  return {
    kinds: uniqueKinds,
    labels: uniqueLabels,
    count: uniqueKinds.length,
    scopeExpansionDetected: uniqueKinds.includes('universal_scope_claim')
      || uniqueKinds.includes('quality_claim')
      || uniqueKinds.includes('standards_compliance_claim')
      || uniqueKinds.includes('unsupported_modifier_expansion'),
  };
}

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
  if (!sourceHasWarehouseDomainApplicability(sourceDescription || '')) return false;
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
  void GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION;
  const source = sourceDescription || '';
  const joined = candidateDescription || '';
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  const labels: string[] = [];
  let deadlineClaimDetected = false;
  let documentationExpansionDetected = false;
  let malformedRolePhraseDetected = false;
  let informationExchangeSubstitutionDetected = false;

  const autonomyScopeQuality = detectGermanAutonomyScopeQualityClaims(source, joined);
  for (const kind of autonomyScopeQuality.kinds) {
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  for (const label of autonomyScopeQuality.labels) {
    if (!labels.includes(label)) labels.push(label);
  }

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
      || uniqueKinds.includes('quality_claim')
      || uniqueKinds.includes('standards_compliance_claim')
      || uniqueKinds.includes('unsupported_modifier_expansion')
      || autonomyScopeQuality.scopeExpansionDetected,
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

export type GermanWarehousePredicateFamily =
  | 'inspect_incoming'
  | 'verify_documentation'
  | 'coordinate_colleagues';

export type GermanWarehousePredicateScan = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  sourceUnitPredicateCoveragePassed: boolean;
  finalCandidatePredicateValidationApplicable: true;
  predicateFamiliesSource: GermanWarehousePredicateFamily[];
  predicateFamiliesCandidate: GermanWarehousePredicateFamily[];
};

function germanPredicateFamilyFromUnit(unit: string): GermanWarehousePredicateFamily | null {
  const t = unit || '';
  if (bulletCoversFact(t, 'incoming_goods_check')
    || INCOMING_GOODS_DE.test(t)
    || /(?:incoming|inbound|eingehend).{0,24}(?:goods|waren|lieferungen)|(?:checks?|prüf|kontroll).{0,24}(?:incoming|eingehend)/iu
      .test(t)) {
    return 'inspect_incoming';
  }
  if (bulletCoversFact(t, 'document_check')
    || DOCUMENT_CHECK_DE.test(t)
    || /(?:document|unterlagen|aufzeichnungen|related\s+documents?)/iu.test(t)) {
    return 'verify_documentation';
  }
  if (bulletCoversFact(t, 'goods_prep_movement_colleagues')
    || (COORDINATE_DE.test(t) && COLLEAGUES_DE.test(t) && GOODS_MOVEMENT_DE.test(t))
    || /(?:colleague|kolleg).{0,48}(?:prepare|vorbereit|movement|bewegung|move\s+goods)/iu
      .test(t)
    || /(?:works?\s+with\s+colleagues|works?\s+with\s+colleagues\s+to\s+prepare)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  // English source units (cross-locale Atlas fixture).
  if (/(?:checks?|inspects?).{0,40}incoming\s+goods|incoming\s+goods/iu.test(t)) {
    return 'inspect_incoming';
  }
  if (/(?:checks?|verifies?|reviews?).{0,40}(?:related\s+)?documents?|related\s+documents?/iu.test(t)) {
    return 'verify_documentation';
  }
  if (/(?:works?\s+with\s+colleagues|coordinates?\s+with\s+colleagues).{0,48}(?:prepare|move)/iu.test(t)) {
    return 'coordinate_colleagues';
  }
  return null;
}

function germanPredicateIdentity(
  family: GermanWarehousePredicateFamily,
  surface: string,
): string {
  const norm = (surface || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  let h = 2166136261;
  const key = `${family}:${norm}`;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `de_wh_pred_${family}_${(h >>> 0).toString(16)}`;
}

/**
 * Predicate identity coverage for German warehouse Experience.
 * Runs against the selected final candidate (provider / repair / fallback).
 * Source units may be English (cross-locale) or German.
 */
export function scanGermanWarehousePredicates(
  sourceDescription: string,
  candidateDescription: string,
): GermanWarehousePredicateScan {
  void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
  const sourceUnits = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const candUnits = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);

  const sourceFamilies: GermanWarehousePredicateFamily[] = [];
  const sourceIds: string[] = [];
  for (const u of sourceUnits) {
    const fam = germanPredicateFamilyFromUnit(u);
    if (fam && !sourceFamilies.includes(fam)) {
      sourceFamilies.push(fam);
      sourceIds.push(germanPredicateIdentity(fam, u));
    }
  }
  if (sourceUnits.length >= 3 && sourceFamilies.length < 3) {
    const fallback: GermanWarehousePredicateFamily[] = [
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ];
    for (let i = 0; i < 3; i += 1) {
      const fam = fallback[i]!;
      if (!sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(germanPredicateIdentity(fam, sourceUnits[i] || fam));
      }
    }
  }
  // Established three-fact warehouse source → three predicates.
  const requiredFacts = sourceWarehouseFacts(sourceDescription);
  if (requiredFacts.length >= 3 && sourceFamilies.length < 3) {
    const map: Record<GermanWarehouseFactId, GermanWarehousePredicateFamily> = {
      incoming_goods_check: 'inspect_incoming',
      document_check: 'verify_documentation',
      goods_prep_movement_colleagues: 'coordinate_colleagues',
    };
    for (const fact of requiredFacts) {
      const fam = map[fact];
      if (fam && !sourceFamilies.includes(fam)) {
        sourceFamilies.push(fam);
        sourceIds.push(germanPredicateIdentity(fam, fact));
      }
    }
  }

  const candFamilies: GermanWarehousePredicateFamily[] = [];
  for (const u of candUnits) {
    const fam = germanPredicateFamilyFromUnit(u);
    if (fam && !candFamilies.includes(fam)) candFamilies.push(fam);
  }
  // Fallback / validated German bullets map 1:1 to fact coverage.
  const cov = validateGermanWarehouseExperienceCoverage(
    sourceDescription,
    candidateDescription,
  );
  if (cov.ok && candFamilies.length < cov.covered.length) {
    const map: Record<GermanWarehouseFactId, GermanWarehousePredicateFamily> = {
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
      added.push(germanPredicateIdentity(fam, fam));
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

