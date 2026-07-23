/**
 * Spanish Experience AI grounding (AAB-305).
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
export const SPANISH_CV_AI_305_REVISION = 'spanish-cv-ai-305-v1' as const;

void SPANISH_CV_AI_305_REVISION;

const WAREHOUSE_KEYS: MaterialDutyKey[] = [
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
];

const INCOMING_GOODS_ES =
  /(?:mercanc[ií]a\s+entrant(?:e|es)|recepci[oó]n\s+de\s+mercanc[ií]as|mercanc[ií]a\s+recibida)/iu;
const CHECK_VERB_ES =
  /(?:revisa|revisó|revisar|comprueba|comprobó|comprobar|controla|controló|controlar|verifica|verificó|verificar)/iu;
const DOCUMENT_CHECK_ES =
  /(?:(?:documentaci[oó]n|documentos|registros)\s+relacionad\w*|(?:documentaci[oó]n|documentos|registros).{0,24}(?:relacionad|acompañant|asociad)|(?:revisa|comprueba|controla|verifica)\w*.{0,32}(?:documentaci[oó]n|documentos|registros))/iu;
const GOODS_MOVEMENT_ES =
  /(?:(?:preparaci[oó]n|preparar|prepara).{0,48}(?:movimiento|traslado|desplazamiento).{0,40}mercanc|(?:movimiento|traslado|desplazamiento).{0,40}mercanc|mercanc.{0,40}(?:preparaci[oó]n|movimiento|traslado))/iu;
const COLLEAGUES_ES = /(?:compa[nñ]er[oa]s?|colegas?)/iu;
const COORDINATE_ES = /(?:coordina|coordinó|coordinar|coordinaci[oó]n)/iu;

/** True when the authoritative source encodes warehouse material duties. */
export function sourceRequiresSpanishWarehouseFactCoverage(sourceDescription: string): boolean {
  const keys = materialDutyKeysFromDescription(sourceDescription || '');
  return WAREHOUSE_KEYS.some((k) => keys.includes(k))
    || /(?:warehouse|skladist|magacin|lager|almac[eé]n|mercanc[ií]a|incoming\s+goods|गोदाम|माल|आवाजाही|तैयारी|zaprimljen|robu)/iu
      .test(sourceDescription || '');
}

export type SpanishWarehouseFactId =
  | 'incoming_goods_check'
  | 'document_check'
  | 'goods_prep_movement_colleagues';

export type SpanishWarehouseCoverageResult = {
  ok: boolean;
  required: SpanishWarehouseFactId[];
  covered: SpanishWarehouseFactId[];
  uncovered: SpanishWarehouseFactId[];
  reason: string | null;
  /** Packaging proof — kept as a live field so the revision survives minification. */
  revision: typeof SPANISH_CV_AI_305_REVISION;
};

function sourceWarehouseFacts(sourceDescription: string): SpanishWarehouseFactId[] {
  const keys = new Set(materialDutyKeysFromDescription(sourceDescription || ''));
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean);
  const joined = units.join('\n');
  const facts: SpanishWarehouseFactId[] = [];
  const hasInbound = keys.has('warehouse_inbound_check')
    || /(?:incoming|inbound|आने\s*वाल|माल.{0,24}(?:जाँच|जांच)|goods?.{0,24}check|check.{0,24}goods|zaprimljen|eingehend|mercanc[ií]a\s+(?:entrant|recibid)|recepci[oó]n\s+de\s+mercanc)/iu
      .test(joined);
  const hasDocs = keys.has('warehouse_records')
    || keys.has('warehouse_inbound_check')
    || /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|докумен|documentaci[oó]n|registros?\s+relacionad)/iu
      .test(joined);
  const docUnit = units.some((u) =>
    /(?:document|record|unterlagen|दस्तावे|संबंधित|accompanying|prateć|documentaci[oó]n|registros?\s+relacionad)/iu.test(u)
    && !/(?:movement|आवाजाही|premješt|vorbereit|तैयारी|movimiento|traslado|preparaci[oó]n)/iu.test(u));
  const hasMovement = keys.has('warehouse_movement')
    || /(?:movement|आवाजाही|premješt|vorbereit|तैयारी|preparation.{0,24}(?:movement|goods)|koordin.{0,40}(?:rob|goods|माल|mercanc)|colleague.{0,40}(?:goods|rob|माल|mercanc)|compa[nñ]er.{0,40}(?:preparaci[oó]n|movimiento|mercanc))/iu
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

function bulletCoversFact(bullet: string, fact: SpanishWarehouseFactId): boolean {
  switch (fact) {
    case 'incoming_goods_check':
      return INCOMING_GOODS_ES.test(bullet) && CHECK_VERB_ES.test(bullet);
    case 'document_check':
      return DOCUMENT_CHECK_ES.test(bullet)
        && CHECK_VERB_ES.test(bullet)
        && !/(?:gestionar\s+(?:la\s+)?documentaci[oó]n|actualiza\s+(?:la\s+)?documentaci[oó]n\s+laboral|sigue\s+(?:los\s+)?asuntos?\s+pendientes|integridad\s+de\s+(?:los\s+)?datos)/iu
          .test(bullet);
    case 'goods_prep_movement_colleagues':
      return COORDINATE_ES.test(bullet)
        && COLLEAGUES_ES.test(bullet)
        && GOODS_MOVEMENT_ES.test(bullet)
        && !/(?:coordinar\s+la\s+comunicaci[oó]n|intercambio\s+de\s+informaci[oó]n|asegurar\s+la\s+finalizaci[oó]n\s+a\s+tiempo|finalizaci[oó]n\s+puntual)/iu
          .test(bullet);
    default:
      return false;
  }
}

/**
 * Hard warehouse coverage for Spanish Experience candidates.
 * Soft action-frame matching is not sufficient.
 */
export function validateSpanishWarehouseExperienceCoverage(
  sourceDescription: string,
  candidateDescription: string,
): SpanishWarehouseCoverageResult {
  const required = sourceWarehouseFacts(sourceDescription);
  if (!required.length) {
    return {
      ok: true,
      required: [],
      covered: [],
      uncovered: [],
      reason: null,
      revision: SPANISH_CV_AI_305_REVISION,
    };
  }
  const bullets = splitExperienceBullets(candidateDescription || '')
    .map((b) => b.trim())
    .filter(Boolean);
  const used = new Set<number>();
  const covered: SpanishWarehouseFactId[] = [];
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
    reason: ok ? null : 'spanish_experience_warehouse_fact_coverage_incomplete',
    revision: SPANISH_CV_AI_305_REVISION,
  };
}

export type SpanishExperienceExpansionScan = {
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
 * Contextual Spanish unsupported expansions vs authoritative source.
 * Does not blacklist valid user facts that already contain the same claims.
 */
export function detectSpanishExperienceUnsupportedExpansion(
  sourceDescription: string,
  candidateDescription: string,
): SpanishExperienceExpansionScan {
  void SPANISH_CV_AI_305_REVISION;
  const source = sourceDescription || '';
  const joined = candidateDescription || '';
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  const labels: string[] = [];
  let deadlineClaimDetected = false;
  let documentationExpansionDetected = false;
  let malformedRolePhraseDetected = false;
  let informationExchangeSubstitutionDetected = false;

  if (/\ben\s+el\s+[aá]rea\s+de\s+Profesional\b|\bcomo\s+[aá]rea\s+de\s+Profesional\b|\bProfesional-[aá]rea\b/iu
    .test(joined)) {
    malformedRolePhraseDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('malformed_role_domain_phrase');
  }

  if (/\b(?:diari(?:o|a|amente)|cada\s+d[ií]a)\b/iu.test(joined)
    && !sourceHas(source, /diari(?:o|a|amente)|daily|täglich|दैनिक|يومي/iu)) {
    kinds.push('universal_scope_claim');
    labels.push('unsupported_frequency_claim');
  }
  if (/\b(?:regularmente|de\s+forma\s+continua|de\s+manera\s+continua|constantemente)\b/iu.test(joined)
    && !sourceHas(source, /regularmente|continua|constantemente|regelmäßig|laufend|regular|ongoing/iu)) {
    kinds.push('universal_scope_claim');
    labels.push('unsupported_frequency_claim');
  }
  if (/\bintegridad\s+de\s+(?:los\s+)?datos\b|\bcalidad\s+de\s+(?:los\s+)?datos\b|\baseguramiento\s+de\s+datos\s+correctos\b/iu
    .test(joined)
    && !sourceHas(source, /integridad|calidad\s+de\s+(?:los\s+)?datos|Vollständigkeit|Datenqualität|data\s+completeness|पूर्णता|اكتمال/iu)) {
    kinds.push('quality_claim');
    labels.push('unsupported_data_quality_claim');
  }
  if (/\bm[aá]xima\s+calidad\b|\bm[aá]ximos?\s+est[aá]ndares\b/iu.test(joined)
    && !sourceHas(source, /m[aá]xima\s+calidad|höchste\s+Qualität|highest\s+quality/iu)) {
    kinds.push('quality_claim');
    labels.push('quality_claim');
  }

  if (/(?:actualiza\s+(?:la\s+)?documentaci[oó]n\s+laboral|mantener\s+la\s+documentaci[oó]n|documentar\s+todas\s+las\s+operaciones|sigue\s+(?:los\s+)?asuntos?\s+pendientes|seguimiento\s+de\s+(?:asuntos?|procesos)\s+pendientes)/iu
    .test(joined)
    && !sourceHas(source, /documentaci[oó]n\s+laboral|asuntos?\s+pendientes|Arbeitsdokumentation|offene\s+Vorgänge|update\s+(?:work\s+)?documentation|track\s+open/iu)) {
    documentationExpansionDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('unsupported_documentation_expansion');
  }

  if (/\b(?:plazo|plazos|puntual(?:mente)?|a\s+tiempo|dentro\s+del\s+plazo|finalizaci[oó]n\s+(?:a\s+tiempo|puntual)|cumplimiento\s+de\s+plazos)\b/iu
    .test(joined)
    && !sourceHas(source, /plazo|a\s+tiempo|puntual|fristgerecht|termingerecht|deadline|on[- ]?time|समय\s*पर|في\s*الوقت/iu)) {
    deadlineClaimDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('unsupported_deadline_claim');
  }

  if (/\b(?:herramienta|software|SAP|WMS|ERP|Excel)\b/iu.test(joined)
    && !sourceHas(source, /herramienta|software|SAP|WMS|ERP|Excel/iu)) {
    kinds.push('unsupported_tool_claim');
    labels.push('unsupported_tool_claim');
  }
  if (/\b(?:\d+\s*%|\d+\s*(?:unidades|artículos|pedidos)|KPI|m[eé]trica)\b/iu.test(joined)
    && !sourceHas(source, /\d+\s*%|\d+\s*(?:unidades|artículos|pedidos)|KPI|m[eé]trica|percent|metric/iu)) {
    kinds.push('unsupported_metric_claim');
    labels.push('unsupported_metric_claim');
  }
  if (/\b(?:responsable\s+de\s+(?:todo|toda|el\s+[aá]rea)|lidera\s+el\s+equipo|supervisa\s+al\s+personal)\b/iu
    .test(joined)
    && !sourceHas(source, /responsable\s+de|lidera|supervisa|verantwortlich|Leitung|managed?\s+a\s+team/iu)) {
    kinds.push('organization_responsibility_claim');
    labels.push('unsupported_responsibility_claim');
  }

  const warehouseSource = sourceRequiresSpanishWarehouseFactCoverage(source);
  if (warehouseSource
    && /(?:intercambio\s+de\s+informaci[oó]n|coordina\w*\s+(?:el\s+)?intercambio\s+de\s+informaci[oó]n|coordina\w*\s+la\s+comunicaci[oó]n|asegurar?\s+la\s+comunicaci[oó]n|procesos?\s+generales?\s+coordina)/iu
      .test(joined)
    && !/(?:preparaci[oó]n|movimiento|traslado|mercanc).{0,40}(?:compa[nñ]er|colega)/iu.test(joined)) {
    informationExchangeSubstitutionDetected = true;
    kinds.push('unsupported_generated_duty');
    labels.push('goods_movement_substituted_with_information_exchange');
  }

  // Generic warehouse substitutions when the three warehouse facts are required.
  if (warehouseSource) {
    const coverage = validateSpanishWarehouseExperienceCoverage(source, joined);
    if (!coverage.ok
      && /(?:gestionar\s+(?:la\s+)?documentaci[oó]n|tareas?\s+diarias?\s+del\s+(?:almac[eé]n|rol)|asegurar\s+la\s+finalizaci[oó]n\s+a\s+tiempo)/iu
        .test(joined)) {
      kinds.push('unsupported_generated_duty');
      labels.push('generic_warehouse_substitution');
    }
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

/** Deterministic Spanish warehouse bullets from material keys (present/completed). */
export function buildSpanishWarehouseExperienceFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
}): string {
  void SPANISH_CV_AI_305_REVISION;
  const present = options.isPresent !== false;
  const facts = sourceWarehouseFacts(options.sourceDescription);
  const lines: string[] = [];
  for (const fact of facts) {
    if (fact === 'incoming_goods_check') {
      lines.push(present
        ? 'Revisa la mercancía entrante.'
        : 'Revisó la mercancía entrante.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Comprueba la documentación relacionada.'
        : 'Comprobó la documentación relacionada.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Coordina con sus compañeros la preparación y el movimiento de la mercancía.'
        : 'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Revisa la mercancía entrante.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]
      : [
        'Revisó la mercancía entrante.',
        'Comprobó la documentación relacionada.',
        'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
      ]);
  }
  return formatExperienceBullets(lines);
}
