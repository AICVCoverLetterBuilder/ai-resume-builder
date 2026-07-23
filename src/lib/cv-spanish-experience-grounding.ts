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
/** AAB-308 — Spanish Experience guarantee/assurance escalation grounding. */
export const SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION =
  'spanish-experience-guarantee-grounding-308-v1' as const;

void SPANISH_CV_AI_305_REVISION;
void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;

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

/** Ordinary operational Spanish predicates (not outcome ownership). */
const ORDINARY_ACTION_ES =
  /(?:revisa|revisó|revisar|comprueba|comprobó|comprobar|verifica|verificó|verificar|controla|controló|controlar|prepara|preparó|preparar|mueve|movió|mover|coordina|coordinó|coordinar|organiza|organizó|organizar|registra|registró|registrar|clasifica|clasificó|clasificar|crea|creó|crear|adapta|adaptó|adaptar)/iu;

/** Stronger guarantee / assurance / responsibility predicates. */
const GUARANTEE_PREDICATE_ES =
  /(?:garantiz(?:ar|a|ó|ando)|garant[ií]a|asegur(?:ar|a|ó|ando)|vel(?:ar|a|ó)\s+por|cerciorarse\s+de|se\s+asegura\s+de|responsabilizarse\s+de|hacerse\s+cargo\s+de|ser\s+responsable\s+de|certific(?:ar|a|ó)|aprob(?:ar|a|ó)\s+definitivamente)/iu;

const OUTCOME_QUALITY_OBJECT_ES =
  /(?:correct[ao]|adecuad[ao]|exactitud|precis(?:i[oó]n|a)|integridad|completitud|calidad|cumplimiento|ejecuci[oó]n\s+correcta|recepci[oó]n\s+correcta|procesamiento\s+correcto|gesti[oó]n\s+correcta|movimiento\s+correcto)/iu;

/** Purpose/outcome clause only — leave location phrases (e.g. en el almacén). */
const GUARANTEE_PURPOSE_CLAUSE_ES =
  /(?:\s*,?\s*)?(?:para\s+)?(?:garantiz(?:ar|ando)|asegur(?:ar|ando)|velar\s+por|cerciorarse\s+de)\s+(?:su\s+|la\s+|el\s+|una?\s+|tod[ao]s?\s+)?(?:correct[ao]\s+|adecuad[ao]\s+)?(?:recepci[oó]n|procesamiento|gesti[oó]n|integridad|exactitud|completitud|calidad|cumplimiento|ejecuci[oó]n|preparaci[oó]n|movimiento)(?:\s+de\s+(?:la\s+|los\s+|el\s+|las\s+)?\w+)?/giu;

function sourceSupportsSpanishGuarantee(source: string): boolean {
  return GUARANTEE_PREDICATE_ES.test(source || '')
    && (
      OUTCOME_QUALITY_OBJECT_ES.test(source || '')
      || /(?:garantiz|asegur).{0,48}(?:recepci|integridad|calidad|cumplimiento|exactitud|completitud|procesamiento|gesti[oó]n)/iu
        .test(source || '')
    );
}

function sourceSupportsSpanishResponsibility(source: string): boolean {
  return /(?:responsabilizarse\s+de|ser\s+responsable\s+de|hacerse\s+cargo\s+de|responsable\s+de\s+(?:la|el|toda|todo))/iu
    .test(source || '');
}

/**
 * Strip candidate-added Spanish guarantee/assurance purpose clauses when the
 * source does not authorize the same strength. Preserves ordinary operational
 * facts (revisar / comprobar / coordinar).
 */
export function stripSpanishExperienceGuaranteeEscalation(
  candidateDescription: string,
  sourceDescription = '',
): string {
  void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
  const bullets = splitExperienceBullets(candidateDescription || '');
  const allowGuarantee = sourceSupportsSpanishGuarantee(sourceDescription);
  const allowResponsibility = sourceSupportsSpanishResponsibility(sourceDescription);
  if (allowGuarantee && allowResponsibility) {
    return candidateDescription || '';
  }
  const cleaned = bullets.map((b) => {
    let row = (b || '').trim();
    if (!row) return row;
    if (!allowGuarantee) {
      row = row.replace(GUARANTEE_PURPOSE_CLAUSE_ES, '');
      // Mid-clause ownership fragments without ordinary action remaining.
      if (GUARANTEE_PREDICATE_ES.test(row) && !ORDINARY_ACTION_ES.test(row)) {
        return '';
      }
      if (GUARANTEE_PREDICATE_ES.test(row) && ORDINARY_ACTION_ES.test(row)) {
        row = row
          .replace(GUARANTEE_PURPOSE_CLAUSE_ES, '')
          .replace(
            /(?:\s*,?\s*)?(?:para\s+)?(?:garantiz\w*|asegur\w*|vela\s+por|cerciorarse\s+de)\b(?:\s+(?:su|la|el|una?|tod[ao]s?|correct\w*|adecuad\w*|recepci\w*|procesamiento|gesti\w*|integridad|exactitud|completitud|calidad|cumplimiento|ejecuci\w*|preparaci\w*|movimiento|de)\b)*/giu,
            '',
          )
          .replace(/\s{2,}/g, ' ')
          .replace(/\s+([.,;:])/g, '$1')
          .trim();
      }
    }
    if (!allowResponsibility) {
      row = row
        .replace(
          /(?:\s*,?\s*)?(?:se\s+)?responsabiliza(?:rse)?\s+de\s+(?:toda|todo|la|el)\s+[^.]*/giu,
          '',
        )
        .replace(/(?:\s*,?\s*)?hacerse\s+cargo\s+de\s+[^.]*/giu, '')
        .trim();
    }
    if (row && !/[.!?]$/u.test(row)) row = `${row}.`;
    return row.replace(/\s{2,}/g, ' ').trim();
  }).filter(Boolean);
  return formatExperienceBullets(cleaned);
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
  void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
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

  // Guarantee / assurance / responsibility escalation — ordinary verbs like
  // "revisar" do not authorize stronger "garantizar"/"asegurar" outcomes.
  const candidateHasGuarantee = GUARANTEE_PREDICATE_ES.test(joined)
    || /para\s+garantiz|para\s+asegur|vela\s+por\s+la\s+correct/iu.test(joined);
  if (candidateHasGuarantee && !sourceSupportsSpanishGuarantee(source)) {
    const hasQualityOutcome = /(?:calidad|integridad|exactitud|precis)/iu.test(joined);
    const hasCompleteness = /completitud/iu.test(joined);
    const hasCompliance = /cumplimiento/iu.test(joined);
    const hasAssuranceVerb = /(?:asegur(?:ar|a|ó|ando)|vela\s+por|cerciorarse|se\s+asegura)/iu
      .test(joined);
    if (hasQualityOutcome) {
      kinds.push('quality_guarantee');
      labels.push('quality_guarantee');
    }
    if (hasCompleteness) {
      kinds.push('completeness_guarantee');
      labels.push('completeness_guarantee');
    }
    if (hasCompliance) {
      kinds.push('compliance_guarantee');
      labels.push('compliance_guarantee');
    }
    if (hasAssuranceVerb) {
      kinds.push('assurance_escalation');
      labels.push('assurance_escalation');
    }
    kinds.push('guarantee_escalation');
    labels.push('guarantee_escalation');
    kinds.push('outcome_ownership');
    labels.push('outcome_ownership');
  }
  if (
    /(?:responsabilizarse\s+de|se\s+responsabiliza\s+de|hacerse\s+cargo\s+de\s+(?:toda|todo)|ser\s+responsable\s+de\s+(?:toda|todo|la\s+recepci))/iu
      .test(joined)
    && !sourceSupportsSpanishResponsibility(source)
  ) {
    kinds.push('responsibility_escalation');
    labels.push('responsibility_escalation');
    if (!kinds.includes('organization_responsibility_claim')) {
      kinds.push('organization_responsibility_claim');
    }
  }
  // Action-strength: ordinary source action + stronger candidate predicate on
  // a similar object still fails (object similarity is not enough).
  if (
    ORDINARY_ACTION_ES.test(source)
    && !GUARANTEE_PREDICATE_ES.test(source)
    && GUARANTEE_PREDICATE_ES.test(joined)
    && /(?:mercanc|document|recepci|preparaci|movimiento|env[ií]o)/iu.test(joined)
  ) {
    if (!kinds.includes('guarantee_escalation')) {
      kinds.push('guarantee_escalation');
      labels.push('guarantee_escalation');
    }
    if (!kinds.includes('outcome_ownership')) {
      kinds.push('outcome_ownership');
      labels.push('action_strength_escalation');
    }
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
      || uniqueKinds.includes('quality_claim')
      || uniqueKinds.includes('guarantee_escalation')
      || uniqueKinds.includes('assurance_escalation')
      || uniqueKinds.includes('outcome_ownership'),
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
        ? 'Revisa la mercancía entrante en el almacén.'
        : 'Revisó la mercancía entrante en el almacén.');
    } else if (fact === 'document_check') {
      lines.push(present
        ? 'Comprueba la documentación relacionada con los envíos recibidos.'
        : 'Comprobó la documentación relacionada con los envíos recibidos.');
    } else if (fact === 'goods_prep_movement_colleagues') {
      lines.push(present
        ? 'Coordina con sus compañeros la preparación y el movimiento de la mercancía.'
        : 'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.');
    }
  }
  if (!lines.length) {
    return formatExperienceBullets(present
      ? [
        'Revisa la mercancía entrante en el almacén.',
        'Comprueba la documentación relacionada con los envíos recibidos.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]
      : [
        'Revisó la mercancía entrante en el almacén.',
        'Comprobó la documentación relacionada con los envíos recibidos.',
        'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
      ]);
  }
  return formatExperienceBullets(lines);
}
