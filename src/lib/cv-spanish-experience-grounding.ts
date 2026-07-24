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
import {
  esWordRe,
  textLooksSpanishExperience,
  EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION,
} from './cv-spanish-experience-morphology';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const SPANISH_CV_AI_305_REVISION = 'spanish-cv-ai-305-v1' as const;
/** AAB-308 — Spanish Experience guarantee/assurance escalation grounding. */
export const SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION =
  'spanish-experience-guarantee-grounding-308-v1' as const;
/** AAB-309 — Spanish Experience post-repair performance/object grounding. */
export const SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION =
  'spanish-experience-repair-grounding-309-v1' as const;
/** AAB-310 — Spanish Experience candidate-added predicate grounding. */
export const SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION =
  'spanish-experience-predicate-grounding-310-v1' as const;
/** AAB-311 — Spanish Experience compliance/conformity object grounding. */
export const SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION =
  'spanish-experience-compliance-grounding-311-v1' as const;

void SPANISH_CV_AI_305_REVISION;
void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
void SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION;
void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
void SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION;

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
  /** AAB-310 privacy-safe predicate grounding evidence. */
  sourcePredicateIdentityCount?: number;
  candidatePredicateIdentityCount?: number;
  candidateAddedPredicateCount?: number;
  candidateAddedPredicateIdentityHashes?: string[];
  unsupportedPredicateKindCount?: number;
  coordinatedPredicateExpansionDetected?: boolean;
  sourceUnitPredicateCoveragePassed?: boolean;
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

/** Performance / efficiency / optimization modifiers (source-gated). */
const EFFICIENCY_CLAIM_ES =
  /\b(?:eficiente(?:mente)?|eficaz(?:mente)?|[oó]ptim[oa]s?|de\s+forma\s+[oó]ptima|de\s+manera\s+eficiente|de\s+forma\s+eficiente|con\s+eficiencia|con\s+eficacia)\b/iu;
const OPTIMIZATION_CLAIM_ES =
  /\b(?:agiliz(?:a|ó|ar)|optimiz(?:a|ó|ar)|mejora\s+(?:el\s+)?rendimiento|mejora\s+(?:la\s+)?productividad|reduce\s+(?:los\s+)?tiempos|minimiza\s+(?:los\s+)?errores)\b/iu;
const SPEED_CLAIM_ES =
  /\b(?:de\s+forma\s+r[aá]pida|r[aá]pidamente|con\s+rapidez|puntualmente)\b/iu;
const ACCURACY_CLAIM_ES =
  /\b(?:con\s+precisi[oó]n|con\s+exactitud|de\s+forma\s+precisa)\b/iu;
const ERROR_FREE_CLAIM_ES =
  /\b(?:sin\s+errores|libre\s+de\s+errores|cero\s+errores)\b/iu;

function sourceSupportsSpanishEfficiency(source: string): boolean {
  return EFFICIENCY_CLAIM_ES.test(source || '')
    || OPTIMIZATION_CLAIM_ES.test(source || '')
    || SPEED_CLAIM_ES.test(source || '');
}

function sourceSupportsSpanishAccuracy(source: string): boolean {
  return ACCURACY_CLAIM_ES.test(source || '')
    || /\b(?:precisi[oó]n|exactitud)\b/iu.test(source || '');
}

/**
 * Spanish Experience predicate families (AAB-310).
 * Safe verification synonyms share one family; stronger material actions do not.
 */
export type SpanishPredicateFamily =
  | 'verify'
  | 'prepare'
  | 'move'
  | 'coordinate'
  | 'create'
  | 'adapt'
  | 'manage_docs'
  | 'archive'
  | 'register'
  | 'report'
  | 'approve'
  | 'supervise'
  | 'guarantee'
  | 'receive'
  | 'dispatch'
  | 'distribute'
  | 'store'
  | 'inventory'
  | 'other';

export type SpanishPredicateStrength = 'ordinary' | 'broader' | 'authority' | 'ownership';

type SpanishPredicateLemma = {
  surface: string;
  family: SpanishPredicateFamily;
  strength: SpanishPredicateStrength;
  identity: string;
};

/** Unicode-safe bounds — ASCII `\b` fails after accented preterite (Revisó). */
const VERIFY_LEMMA_RE = esWordRe(
  'revis(?:a|ó|aba|aron|ar|ando|ado)?|comprueb(?:a|o|an|as)|comprob(?:ó|aba|aron|ar|ando|ado)?|verific(?:a|ó|aba|aron|ar|ando|ado)?|inspeccion(?:a|ó|aba|aron|ar|ando|ado)?|examin(?:a|ó|aba|aron|ar|ando|ado)?|control(?:a|ó|aba|aron|ar|ando|ado)?',
);
const PREPARE_LEMMA_RE = esWordRe(
  'prepar(?:a|ó|aba|aron|ar|ando|ado)?|dispon(?:e|ía|er|iendo)',
);
const MOVE_LEMMA_RE = esWordRe(
  'muev(?:e|o|en)|mov(?:ió|ía|ieron|er|iendo|ido)?|traslad(?:a|ó|aba|aron|ar|ando|ado)?|desplaz(?:a|ó|aba|aron|ar|ando|ado)?',
);
const COORDINATE_LEMMA_RE = esWordRe(
  'coordin(?:a|ó|aba|aron|ar|ando|ado)?|colabor(?:a|ó|aba|aron|ar|ando|ado)?',
);
const CREATE_LEMMA_RE = esWordRe('cre(?:a|ó|aba|aron|ar|ando|ado)?');
const ADAPT_LEMMA_RE = esWordRe('adapt(?:a|ó|aba|aron|ar|ando|ado)?');
const MANAGE_DOCS_LEMMA_RE = esWordRe(
  'gestion(?:a|ó|aba|aron|ar|ando|ado)?|administr(?:a|ó|aba|aron|ar|ando|ado)?|tramit(?:a|ó|aba|aron|ar|ando|ado)?|proces(?:a|ó|aba|aron|ar|ando|ado)?|manej(?:a|ó|aba|aron|ar|ando|ado)?|manten(?:er|iendo|ía)|organiz(?:a|ó|aba|aron|ar|ando|ado)?\\s+(?:la\\s+)?document|clasific(?:a|ó|aba|aron|ar|ando|ado)?\\s+(?:document|archivo)|custodi(?:a|ó|aba|aron|ar|ando|ado)?|document(?:a|ó|aba|aron|ar|ando|ado)?',
);
const ARCHIVE_LEMMA_RE = esWordRe('archiv(?:a|ó|aba|aron|ar|ando|ado)?');
const REGISTER_LEMMA_RE = esWordRe(
  'registr(?:a|ó|aba|aron|ar|ando|ado)?|actualiz(?:a|ó|aba|aron|ar|ando|ado)?\\s+(?:los\\s+|las\\s+|el\\s+|la\\s+)?registros?',
);
const REPORT_LEMMA_RE = esWordRe(
  '(?:prepar|elabor)(?:a|ó|aba|aron|ar|ando|ado)?\\s+(?:informes?|reportes?)',
);
const APPROVE_LEMMA_RE = esWordRe(
  'aprueb(?:a|o|an|as|e|en)?|aprob(?:ó|aba|aron|ar|ando|ado)|autoriz(?:a|ó|aba|aron|ar|ando|ado)?|certific(?:a|ó|aba|aron|ar|ando|ado)?|firm(?:a|ó|aba|aron|ar|ando|ado)?|acept(?:a|ó|aba|aron|ar|ando|ado)?|rechaz(?:a|ó|aba|aron|ar|ando|ado)?|decid(?:e|ió|ir|iendo)|resolv(?:er|iendo|ió)|dar\\s+conformidad|valid(?:a|ó|aba|aron|ar|ando|ado)?\\s+definitiv',
);
const SUPERVISE_LEMMA_RE = esWordRe(
  'supervis(?:a|ó|aba|aron|ar|ando|ado)?|dirig(?:e|ió|ía|ieron|ir|iendo)|lider(?:a|ó|aba|aron|ar|ando|ado)?|responsabiliz(?:arse|a|ó)|hacerse\\s+cargo|control(?:a|ó|ar)\\s+el\\s+proceso',
);
const GUARANTEE_LEMMA_RE = esWordRe(
  'garantiz(?:a|ó|aba|aron|ar|ando|ado)?|asegur(?:a|ó|aba|aron|ar|ando|ado)?',
);
const RECEIVE_LEMMA_RE = esWordRe('recib(?:e|ió|ía|ieron|ir|iendo)');
const DISPATCH_LEMMA_RE = esWordRe(
  'despach(?:a|ó|aba|aron|ar|ando|ado)?|exped(?:e|ió|ir|iendo)|envi(?:a|ó|aba|aron|ar|ando|ado)?|entreg(?:a|ó|aba|aron|ar|ando|ado)?',
);
const DISTRIBUTE_LEMMA_RE = esWordRe(
  'distribuy(?:e|ó)|distribu(?:ir|yendo)|transport(?:a|ó|aba|aron|ar|ando|ado)?',
);
const STORE_LEMMA_RE = esWordRe('almacen(?:a|ó|aba|aron|ar|ando|ado)?');
const INVENTORY_LEMMA_RE = esWordRe(
  'inventari(?:a|ó|aba|aron|ar|ando|ado)?|repon(?:e|ía|er|iendo)',
);

const PREDICATE_FAMILY_PATTERNS: Array<{
  family: SpanishPredicateFamily;
  strength: SpanishPredicateStrength;
  re: RegExp;
}> = [
  { family: 'manage_docs', strength: 'broader', re: MANAGE_DOCS_LEMMA_RE },
  { family: 'archive', strength: 'broader', re: ARCHIVE_LEMMA_RE },
  { family: 'register', strength: 'broader', re: REGISTER_LEMMA_RE },
  { family: 'report', strength: 'broader', re: REPORT_LEMMA_RE },
  { family: 'approve', strength: 'authority', re: APPROVE_LEMMA_RE },
  { family: 'supervise', strength: 'authority', re: SUPERVISE_LEMMA_RE },
  { family: 'guarantee', strength: 'ownership', re: GUARANTEE_LEMMA_RE },
  { family: 'receive', strength: 'broader', re: RECEIVE_LEMMA_RE },
  { family: 'dispatch', strength: 'broader', re: DISPATCH_LEMMA_RE },
  { family: 'distribute', strength: 'broader', re: DISTRIBUTE_LEMMA_RE },
  { family: 'store', strength: 'broader', re: STORE_LEMMA_RE },
  { family: 'inventory', strength: 'broader', re: INVENTORY_LEMMA_RE },
  { family: 'verify', strength: 'ordinary', re: VERIFY_LEMMA_RE },
  { family: 'prepare', strength: 'ordinary', re: PREPARE_LEMMA_RE },
  { family: 'move', strength: 'ordinary', re: MOVE_LEMMA_RE },
  { family: 'coordinate', strength: 'ordinary', re: COORDINATE_LEMMA_RE },
  { family: 'create', strength: 'ordinary', re: CREATE_LEMMA_RE },
  { family: 'adapt', strength: 'ordinary', re: ADAPT_LEMMA_RE },
];

const VERIFY_SYNONYM_STACK_RE = esWordRe(
  '((?:revisa|revisó|comprueba|comprobó|verifica|verificó|controla|controló))\\s+y\\s+(?:revisa|revisó|comprueba|comprobó|verifica|verificó|controla|controló)',
);

function predicateIdentity(family: SpanishPredicateFamily, surface: string): string {
  const norm = (surface || '').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  let h = 2166136261;
  const key = `${family}:${norm}`;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `es_pred_${family}_${(h >>> 0).toString(16)}`;
}

/** Extract material Spanish predicates from one Experience unit (all finite verbs). */
export function extractSpanishExperiencePredicates(unit: string): SpanishPredicateLemma[] {
  void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
  const text = unit || '';
  const found: SpanishPredicateLemma[] = [];
  const seen = new Set<string>();
  for (const entry of PREDICATE_FAMILY_PATTERNS) {
    entry.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = entry.re.exec(text)) !== null) {
      const surface = (m[0] || '').trim();
      if (!surface) continue;
      // Avoid treating "organizar documentación" twice via organize alone — already in manage_docs.
      const id = predicateIdentity(entry.family, surface);
      const key = `${entry.family}:${surface.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        surface,
        family: entry.family,
        strength: entry.strength,
        identity: id,
      });
    }
  }
  return found;
}

function unitObjectTokens(unit: string): Set<string> {
  const tokens = (unit || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9ñ]+/i)
    .filter((t) => t.length > 3);
  return new Set(tokens);
}

function alignCandidateUnitToSource(
  sourceUnits: string[],
  candidateUnit: string,
): number {
  const candPreds = new Set(extractSpanishExperiencePredicates(candidateUnit).map((p) => p.family));
  const candObj = unitObjectTokens(candidateUnit);
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < sourceUnits.length; i += 1) {
    const src = sourceUnits[i] || '';
    const srcPreds = extractSpanishExperiencePredicates(src);
    const srcObj = unitObjectTokens(src);
    let score = 0;
    for (const p of srcPreds) {
      if (candPreds.has(p.family)) score += 3;
    }
    for (const t of candObj) {
      if (srcObj.has(t)) score += 1;
    }
    if (/document/iu.test(src) && /document/iu.test(candidateUnit)) score += 2;
    if (/mercanc/iu.test(src) && /mercanc/iu.test(candidateUnit)) score += 2;
    if (/prepar|movim/iu.test(src) && /prepar|movim/iu.test(candidateUnit)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function familySupportedBySourceUnit(
  family: SpanishPredicateFamily,
  sourceUnit: string,
): boolean {
  const preds = extractSpanishExperiencePredicates(sourceUnit);
  if (preds.some((p) => p.family === family)) return true;
  // Safe verify synonym family: any verify lemma in source covers other verify lemmas.
  if (family === 'verify' && preds.some((p) => p.family === 'verify')) return true;
  return false;
}

function kindForAddedFamily(family: SpanishPredicateFamily): ExperienceUnsupportedClaimKind[] {
  switch (family) {
    case 'manage_docs':
    case 'archive':
    case 'register':
    case 'report':
      return ['action_scope_expansion', 'document_management_expansion', 'coordinated_predicate_expansion'];
    case 'approve':
      return ['action_scope_expansion', 'approval_authority_expansion', 'coordinated_predicate_expansion'];
    case 'supervise':
      return ['action_scope_expansion', 'supervision_expansion', 'responsibility_escalation', 'coordinated_predicate_expansion'];
    case 'guarantee':
      return ['action_scope_expansion', 'guarantee_escalation', 'coordinated_predicate_expansion'];
    case 'receive':
    case 'dispatch':
    case 'distribute':
    case 'store':
    case 'inventory':
      return ['action_scope_expansion', 'workflow_expansion', 'coordinated_predicate_expansion'];
    default:
      return ['action_scope_expansion', 'coordinated_predicate_expansion'];
  }
}

export type SpanishPredicateGroundingResult = {
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  unsupportedKinds: ExperienceUnsupportedClaimKind[];
  coordinatedPredicateExpansionDetected: boolean;
  sourceUnitPredicateCoveragePassed: boolean;
  sourcePredicateExtractionPassed: boolean;
  sourceUnitsWithPredicateCount: number;
  sourceUnitsMissingPredicateCount: number;
  sourcePredicateExtractionFailureReason: string | null;
};

/**
 * Per aligned source-unit predicate grounding.
 * Coverage of the original verb is not enough when a coordinated material
 * action is added (e.g. "comprueba y gestiona").
 */
export function detectSpanishExperiencePredicateExpansion(
  sourceDescription: string,
  candidateDescription: string,
): SpanishPredicateGroundingResult {
  void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
  const sourceUnits = splitExperienceBullets(sourceDescription || '').filter(Boolean);
  const candidateUnits = splitExperienceBullets(candidateDescription || '').filter(Boolean);
  const addedHashes: string[] = [];
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  let coordinated = false;
  let allUnitsCovered = true;
  /** Required source action units (one material finite-verb unit = one identity). */
  let sourcePredCount = 0;
  let candPredCount = 0;
  const sourcePrimaryByUnit: Array<SpanishPredicateFamily | null> = [];

  for (const su of sourceUnits) {
    const preds = extractSpanishExperiencePredicates(su);
    // Count units with ≥1 material predicate — not unique families across units
    // (verify+verify+coordinate must be 3, not 2).
    if (preds.length > 0) {
      sourcePredCount += 1;
      // Prefer ordinary/authority primary over incidental broader lemmas.
      const ordinary = preds.find((p) => p.strength === 'ordinary' || p.strength === 'authority');
      sourcePrimaryByUnit.push((ordinary || preds[0]).family);
    } else {
      sourcePrimaryByUnit.push(null);
    }
  }

  const coveredSourceUnitIndexes = new Set<number>();

  for (const cu of candidateUnits) {
    const candPreds = extractSpanishExperiencePredicates(cu);
    candPredCount += candPreds.length;
    const alignIdx = alignCandidateUnitToSource(sourceUnits, cu);
    const aligned = alignIdx >= 0 ? (sourceUnits[alignIdx] || '') : '';
    if (!aligned) {
      allUnitsCovered = false;
      continue;
    }
    const alignedFamilies = new Set(
      extractSpanishExperiencePredicates(aligned).map((p) => p.family),
    );
    // Coordinated multi-verb constructions on the candidate unit.
    if (/\b\w+\s+y\s+\w+/iu.test(cu) || /,\s*\w+\s+y\s+/iu.test(cu)
      || /\bantes\s+de\s+\w+/iu.test(cu) || /\bpara\s+(?:aprob|autoriz|certific)/iu.test(cu)
      || /\badem[aá]s\s+de\s+\w+/iu.test(cu)) {
      if (candPreds.length > 1) coordinated = true;
    }
    const supportedFamilies = new Set<SpanishPredicateFamily>();
    for (const p of candPreds) {
      if (familySupportedBySourceUnit(p.family, aligned)) {
        supportedFamilies.add(p.family);
        continue;
      }
      // Distinct material family not in the aligned source unit — never authorize
      // from a different source bullet's predicates.
      if (!alignedFamilies.has(p.family)) {
        addedHashes.push(p.identity);
        for (const k of kindForAddedFamily(p.family)) kinds.push(k);
      }
    }
    const primary = sourcePrimaryByUnit[alignIdx];
    if (primary && candPreds.some((p) => p.family === primary)) {
      coveredSourceUnitIndexes.add(alignIdx);
    }
    // If aligned source has only verify and candidate stacks verify synonyms only,
    // that is not an added material action (handled by synonym collapse in repair).
    void supportedFamilies;
  }

  for (let i = 0; i < sourceUnits.length; i += 1) {
    if (sourcePrimaryByUnit[i] && !coveredSourceUnitIndexes.has(i)) {
      allUnitsCovered = false;
    }
  }

  const uniqueHashes = [...new Set(addedHashes)];
  const uniqueKinds = [...new Set(kinds)];
  if (uniqueHashes.length > 0 && coordinated) {
    if (!uniqueKinds.includes('coordinated_predicate_expansion')) {
      uniqueKinds.push('coordinated_predicate_expansion');
    }
  }
  void EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION;
  const missingPredUnits = sourcePrimaryByUnit.filter((p) => p == null).length;
  const extractionPassed = sourceUnits.length === 0 || sourcePredCount > 0;
  // Non-vacuous: never treat "0/0 predicates covered" as a pass for non-empty Spanish.
  const coveragePassed = sourceUnits.length === 0
    ? uniqueHashes.length === 0
    : (extractionPassed
      && sourcePredCount > 0
      && allUnitsCovered
      && uniqueHashes.length === 0);
  return {
    sourcePredicateIdentityCount: sourcePredCount,
    candidatePredicateIdentityCount: candPredCount,
    candidateAddedPredicateCount: uniqueHashes.length,
    candidateAddedPredicateIdentityHashes: uniqueHashes,
    unsupportedKinds: uniqueKinds,
    coordinatedPredicateExpansionDetected: coordinated && uniqueHashes.length > 0,
    sourceUnitPredicateCoveragePassed: coveragePassed,
    sourcePredicateExtractionPassed: extractionPassed,
    sourceUnitsWithPredicateCount: sourcePredCount,
    sourceUnitsMissingPredicateCount: missingPredUnits,
    sourcePredicateExtractionFailureReason: extractionPassed
      ? null
      : 'source_predicate_extraction_failed',
  };
}

function stripUnsupportedCoordinatedPredicates(
  row: string,
  sourceUnit: string,
): string {
  let out = row;
  const unsupportedSurfaces: Array<{ re: RegExp; family: SpanishPredicateFamily }> = [
    { family: 'manage_docs', re: /\s+y\s+(?:gestiona|administra|tramita|procesa|maneja|mantiene|documenta)\b/giu },
    { family: 'archive', re: /\s+y\s+archiva\b/giu },
    { family: 'register', re: /\s+y\s+(?:registra|actualiza)\b/giu },
    { family: 'approve', re: /\s+y\s+(?:aprueba|apruebo|autoriza|certifica|firma|acepta|rechaza)\b/giu },
    { family: 'supervise', re: /\s+y\s+(?:supervisa|dirige|lidera)\b/giu },
    { family: 'distribute', re: /\s+y\s+(?:distribuye|transporta|expide|despacha|env[ií]a|entrega)\b/giu },
    { family: 'receive', re: /\s+y\s+recibe\b/giu },
    { family: 'store', re: /\s+y\s+almacena\b/giu },
    { family: 'inventory', re: /\s+y\s+(?:inventaria|reponer|reponte|repon)\b/giu },
  ];
  for (const entry of unsupportedSurfaces) {
    if (!familySupportedBySourceUnit(entry.family, sourceUnit)) {
      out = out.replace(entry.re, '');
    }
  }
  // Purpose / sequential authority expansions: "comprueba antes de autorizar", "verifica para certificar"
  if (!familySupportedBySourceUnit('approve', sourceUnit)) {
    out = out
      .replace(/\s+antes\s+de\s+(?:aprobar|autorizar|certificar|firmar|aceptar|rechazar)\b[^.]*/giu, '')
      .replace(/\s+para\s+(?:aprobar|autorizar|certificar|firmar)\b[^.]*/giu, '');
  }
  if (!familySupportedBySourceUnit('supervise', sourceUnit)) {
    out = out.replace(/\s+y\s+supervisa\s+integralmente\b/giu, '');
  }
  // Standalone broader document-management verbs when aligned source is verify-only.
  if (
    familySupportedBySourceUnit('verify', sourceUnit)
    && !familySupportedBySourceUnit('manage_docs', sourceUnit)
    && /^(?:gestiona|administra|tramita|procesa)\b/iu.test(out)
  ) {
    const verifySurface = sourceUnit.match(
      /\b(comprueba|revisa|verifica|comprobó|revisó|verificó)\b/iu,
    )?.[1] || 'Comprueba';
    out = out.replace(
      /^(?:gestiona|administra|tramita|procesa)\b/iu,
      verifySurface.charAt(0).toUpperCase() + verifySurface.slice(1).toLowerCase(),
    );
  }
  return out;
}

function collapseRedundantVerifySynonyms(row: string): string {
  return row.replace(VERIFY_SYNONYM_STACK_RE, '$1');
}

/**
 * Material logistics objects that require explicit source support.
 * Safe equivalents (mercancía/productos, documentación/documentos, compañeros/equipo)
 * are excluded from this list.
 */
const MATERIAL_OBJECT_PATTERNS: Array<{
  id: string;
  re: RegExp;
  sourceSupport: RegExp;
}> = [
  {
    id: 'entregas',
    re: /\bentregas?\b/iu,
    sourceSupport: /\bentregas?\b/iu,
  },
  {
    id: 'envios',
    re: /\benv[ií]os?\b/iu,
    sourceSupport: /\benv[ií]os?\b/iu,
  },
  {
    id: 'pedidos',
    re: /\bpedidos?\b/iu,
    sourceSupport: /\bpedidos?\b/iu,
  },
  {
    id: 'expediciones',
    re: /\bexpediciones?\b|\bexpedici[oó]n\b/iu,
    sourceSupport: /\bexpedici/iu,
  },
  {
    id: 'devoluciones',
    re: /\bdevoluciones?\b/iu,
    sourceSupport: /\bdevoluciones?\b/iu,
  },
  {
    id: 'proveedores',
    re: /\bproveedores?\b/iu,
    sourceSupport: /\bproveedores?\b/iu,
  },
  {
    id: 'clientes',
    re: /\bclientes?\b/iu,
    sourceSupport: /\bclientes?\b/iu,
  },
  {
    id: 'inventario',
    re: /\b(?:inventario|existencias|stock)\b/iu,
    sourceSupport: /\b(?:inventario|existencias|stock)\b/iu,
  },
  {
    id: 'facturas',
    re: /\bfacturas?\b/iu,
    sourceSupport: /\bfacturas?\b/iu,
  },
  {
    id: 'albaranes',
    re: /\balbaranes?\b/iu,
    sourceSupport: /\balbaranes?\b/iu,
  },
  {
    id: 'registros',
    // Safe equivalent: documentación/documentos ↔ registros when source has docs.
    re: /\bregistros?\b/iu,
    sourceSupport: /\b(?:registros?|documentaci[oó]n|documentos?)\b/iu,
  },
  {
    id: 'rutas',
    re: /\brutas?\b/iu,
    sourceSupport: /\brutas?\b/iu,
  },
  {
    id: 'transporte',
    re: /\btransporte\b/iu,
    sourceSupport: /\btransporte\b/iu,
  },
  {
    id: 'distribucion',
    re: /\bdistribuci[oó]n\b/iu,
    sourceSupport: /\bdistribuci[oó]n\b/iu,
  },
  {
    id: 'calidad',
    re: /\bcalidad\b/iu,
    sourceSupport: /\bcalidad\b/iu,
  },
  {
    id: 'cumplimiento',
    re: /\bcumplimiento\b/iu,
    sourceSupport: /\bcumplimiento\b/iu,
  },
  {
    id: 'plazos',
    re: /\bplazos?\b/iu,
    sourceSupport: /\bplazos?\b/iu,
  },
];

/** Compliance / conformity / certification / approval objects (AAB-311). */
const COMPLIANCE_OBJECT_PATTERNS: Array<{
  id: string;
  re: RegExp;
  sourceSupport: RegExp;
  kinds: ExperienceUnsupportedClaimKind[];
}> = [
  {
    id: 'conformidad',
    re: /\b(?:cada\s+)?conformidad(?:es)?\b|\bdeclaraci[oó]n(?:es)?\s+de\s+conformidad\b|\bcertificado(?:s)?\s+de\s+conformidad\b|\bno\s+conformidad(?:es)?\b/iu,
    sourceSupport: /\bconformidad|\bdeclaraci[oó]n(?:es)?\s+de\s+conformidad|\bcertificado(?:s)?\s+de\s+conformidad|\bno\s+conformidad/iu,
    kinds: [
      'conformity_object_expansion',
      'compliance_scope_expansion',
      'unsupported_object_expansion',
      'object_scope_expansion',
    ],
  },
  {
    id: 'cumplimiento_normativo',
    re: /\bcumplimiento(?:\s+normativo)?\b|\bdocumentaci[oó]n\s+de\s+cumplimiento\b|\brequisitos?\s+normativos?\b|\bnormativa\b|\bnormas?\b(?!\s+intern)/iu,
    sourceSupport: /\bcumplimiento|\bnormativ|\bnormas?\b|\brequisitos?\s+normativos?/iu,
    kinds: [
      'compliance_scope_expansion',
      'unsupported_object_expansion',
      'object_scope_expansion',
    ],
  },
  {
    id: 'certificacion',
    re: /\bcertificaci[oó]n(?:es)?\b|\bcertificados?\b(?!\s+de\s+entrega)/iu,
    sourceSupport: /\bcertificaci[oó]n|\bcertificados?\b/iu,
    kinds: [
      'certification_scope_expansion',
      'compliance_scope_expansion',
      'unsupported_object_expansion',
      'object_scope_expansion',
    ],
  },
  {
    id: 'aprobacion',
    re: /\baprobaci[oó]n(?:es)?\b|\bautorizaci[oó]n(?:es)?\b|\bhomologaci[oó]n(?:es)?\b/iu,
    sourceSupport: /\baprobaci[oó]n|\bautorizaci[oó]n|\bhomologaci[oó]n/iu,
    kinds: [
      'approval_scope_expansion',
      'compliance_scope_expansion',
      'unsupported_object_expansion',
      'object_scope_expansion',
    ],
  },
  {
    id: 'validacion_calidad',
    re: /\bvalidaci[oó]n(?:es)?\b|\bcontroles?\s+de\s+calidad\b|\brequisitos?\s+de\s+calidad\b|\bincidencias?\s+de\s+calidad\b/iu,
    sourceSupport: /\bvalidaci[oó]n|\bcontroles?\s+de\s+calidad|\brequisitos?\s+de\s+calidad|\bincidencias?\s+de\s+calidad/iu,
    kinds: [
      'quality_scope_expansion',
      'compliance_scope_expansion',
      'unsupported_object_expansion',
      'object_scope_expansion',
    ],
  },
];

function detectSpanishComplianceScopeExpansion(
  source: string,
  candidate: string,
): ExperienceUnsupportedClaimKind[] {
  void SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION;
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  for (const entry of COMPLIANCE_OBJECT_PATTERNS) {
    if (entry.re.test(candidate) && !entry.sourceSupport.test(source)) {
      for (const k of entry.kinds) kinds.push(k);
    }
  }
  return [...new Set(kinds)];
}

function detectSpanishObjectScopeExpansion(
  source: string,
  candidate: string,
): ExperienceUnsupportedClaimKind[] {
  const kinds: ExperienceUnsupportedClaimKind[] = [];
  // Conjunction expansion: envíos y entregas (or similar dual logistics lists).
  if (
    /env[ií]os?\s+y\s+entregas?/iu.test(candidate)
    && !(/env[ií]os?/iu.test(source) && /entregas?/iu.test(source))
  ) {
    kinds.push('logistics_scope_expansion');
    kinds.push('object_scope_expansion');
    kinds.push('unsupported_object_expansion');
  }
  for (const entry of MATERIAL_OBJECT_PATTERNS) {
    // Compliance terms are handled by dedicated AAB-311 detector (avoid double-count
    // and allow contextual source support for certificados de conformidad).
    if (entry.id === 'cumplimiento') continue;
    if (entry.re.test(candidate) && !entry.sourceSupport.test(source)) {
      kinds.push('object_scope_expansion');
      kinds.push('unsupported_object_expansion');
      if (/env[ií]o|entrega|pedido|expedici|devoluci|proveedor|cliente|inventario|stock|factura|albar[aá]n|ruta|transporte|distribuci/iu
        .test(entry.id)) {
        kinds.push('logistics_scope_expansion');
      }
      break;
    }
  }
  for (const k of detectSpanishComplianceScopeExpansion(source, candidate)) {
    kinds.push(k);
  }
  return [...new Set(kinds)];
}

/**
 * Strip candidate-added Spanish unsupported escalations (guarantee, efficiency,
 * material-object expansions) when the source does not authorize them.
 * Source-constrained: remove rejected spans; do not freely rewrite bullets.
 */
export function stripSpanishExperienceUnsupportedEscalation(
  candidateDescription: string,
  sourceDescription = '',
): string {
  void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
  void SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION;
  void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
  void SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION;
  const bullets = splitExperienceBullets(candidateDescription || '');
  const sourceUnits = splitExperienceBullets(sourceDescription || '').filter(Boolean);
  const allowGuarantee = sourceSupportsSpanishGuarantee(sourceDescription);
  const allowResponsibility = sourceSupportsSpanishResponsibility(sourceDescription);
  const allowEfficiency = sourceSupportsSpanishEfficiency(sourceDescription);
  const allowAccuracy = sourceSupportsSpanishAccuracy(sourceDescription);
  const cleaned = bullets.map((b) => {
    let row = (b || '').trim();
    if (!row) return row;
    const alignIdx = alignCandidateUnitToSource(sourceUnits, row);
    const alignedSource = alignIdx >= 0 ? (sourceUnits[alignIdx] || sourceDescription) : sourceDescription;
    if (!allowGuarantee) {
      row = row.replace(GUARANTEE_PURPOSE_CLAUSE_ES, '');
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
    if (!allowEfficiency) {
      row = row
        .replace(/\s+eficiente(?:mente)?\b/giu, '')
        .replace(/\s+eficaz(?:mente)?\b/giu, '')
        .replace(/\s+de\s+forma\s+(?:eficiente|[oó]ptima)\b/giu, '')
        .replace(/\s+de\s+manera\s+eficiente\b/giu, '')
        .replace(/\s+con\s+(?:eficiencia|eficacia)\b/giu, '')
        .replace(/\s+[oó]ptim[oa]s?\b/giu, '')
        .replace(/\b(?:agiliz\w*|optimiz\w*)\s+/giu, '')
        .replace(/\s+mejora\s+(?:el\s+)?rendimiento\b/giu, '')
        .replace(/\s+mejora\s+(?:la\s+)?productividad\b/giu, '')
        .replace(/\s+reduce\s+(?:los\s+)?tiempos?\b/giu, '')
        .replace(/\s+minimiza\s+(?:los\s+)?errores?\b/giu, '')
        .replace(/\s+de\s+forma\s+r[aá]pida\b/giu, '')
        .replace(/\s+r[aá]pidamente\b/giu, '')
        .trim();
    }
    if (!allowAccuracy) {
      row = row
        .replace(/\s+con\s+(?:precisi[oó]n|exactitud)\b/giu, '')
        .replace(/\s+sin\s+errores\b/giu, '')
        .replace(/\s+libre\s+de\s+errores\b/giu, '')
        .trim();
    }
    // Object/scope: strip unsupported logistics objects and dual conjunctions.
    for (const entry of MATERIAL_OBJECT_PATTERNS) {
      if (entry.id === 'cumplimiento') continue;
      if (entry.re.test(row) && !entry.sourceSupport.test(sourceDescription)) {
        // Prefer reducing "con los envíos y entregas…" → "con la mercancía recibida"
        // when the bullet is a document check over related docs.
        if (/documentaci[oó]n|documentos|registros/iu.test(row)) {
          row = row
            .replace(
              /\s+con\s+(?:los\s+|las\s+|el\s+|la\s+)?(?:env[ií]os?(?:\s+y\s+entregas?)?|entregas?|pedidos?|facturas?|albaranes?)(?:\s+(?:de\s+)?(?:mercanc\w*|recibid\w*|clientes?))?/giu,
              ' con la mercancía recibida',
            )
            .replace(
              /\s+y\s+entregas?(?:\s+de\s+mercanc\w*)?/giu,
              '',
            )
            .replace(entry.re, '')
            .trim();
        } else {
          row = row
            .replace(/\s+y\s+entregas?(?:\s+de\s+mercanc\w*)?/giu, '')
            .replace(
              new RegExp(`\\s+(?:de\\s+|con\\s+)?(?:los\\s+|las\\s+|el\\s+|la\\s+)?${entry.re.source}`, 'giu'),
              '',
            )
            .trim();
        }
      }
    }
    // AAB-311/313: strip unsupported compliance spans at CLAUSE level — never
    // delete only the noun and leave dangling "cada de" / "a cada de".
    void SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION;
    for (const entry of COMPLIANCE_OBJECT_PATTERNS) {
      if (entry.re.test(row) && !entry.sourceSupport.test(sourceDescription)) {
        row = row
          .replace(
            /\s+(?:asociad\w*|relacionad\w*)\s+(?:a|con)\s+cada\s+conformidad(?:es)?(?:\s+de\s+\w+)?/giu,
            '',
          )
          .replace(
            /\s+con\s+(?:cada\s+)?conformidad(?:es)?(?:\s+de\s+\w+)?/giu,
            '',
          )
          .replace(
            /\s+a\s+(?:cada\s+)?conformidad(?:es)?(?:\s+de\s+\w+)?/giu,
            '',
          )
          .replace(
            /\s+con\s+(?:los\s+|las\s+|el\s+|la\s+)?(?:certificados?|declaraciones?)\s+de\s+conformidad\b/giu,
            '',
          )
          .replace(
            /\s+con\s+(?:el\s+|la\s+|los\s+|las\s+)?(?:cumplimiento(?:\s+normativo)?|normativa|requisitos?\s+normativos?|certificaci[oó]n(?:es)?|aprobaci[oó]n(?:es)?|autorizaci[oó]n(?:es)?|validaci[oó]n(?:es)?|homologaci[oó]n(?:es)?|controles?\s+de\s+calidad|requisitos?\s+de\s+calidad|incidencias?\s+de\s+calidad|no\s+conformidad(?:es)?)\b/giu,
            '',
          )
          // Full quantified NP: "cada conformidad de mercancía…"
          .replace(
            /\bcada\s+conformidad(?:es)?(?:\s+de\s+(?:la\s+|el\s+|los\s+|las\s+)?\w+(?:\s+\w+){0,4})?/giu,
            '',
          )
          .replace(entry.re, '')
          // Orphan leftovers from partial historic strips.
          .replace(/\b(?:a|con|de|para)\s+cada\s+de\b/giu, '')
          .replace(/\bcada\s+de(?:l)?\b/giu, '')
          .trim();
      }
    }
    // Drop unsupported warehouse-location fillers absent from the aligned source.
    if (
      /\b(?:en|dentro\s+de(?:l)?)\s+(?:el\s+)?almac[eé]n\b/iu.test(row)
      && !/\balmac[eé]n\b/iu.test(alignedSource)
    ) {
      row = row
        .replace(/\s+(?:en|dentro\s+de(?:l)?)\s+(?:el\s+)?almac[eé]n\b/giu, '')
        .trim();
    }
    // AAB-310: strip candidate-added coordinated / broader predicates.
    row = stripUnsupportedCoordinatedPredicates(row, alignedSource);
    // Collapse redundant verification synonym stacks (revisa y verifica → revisa).
    row = collapseRedundantVerifySynonyms(row);
    row = row
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/\b(el|la|los|las|de|con|y)\s*\./giu, '.')
      .replace(/\b(?:a|con|de|para)\s+cada\s+de\b/giu, '')
      .replace(/\bcada\s+de(?:l)?\b/giu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (row && !/[.!?]$/u.test(row)) row = `${row}.`;
    // Drop units that still carry orphan post-strip fragments (AAB-313).
    if (/\bcada\s+de(?:l)?\b/iu.test(row) || /\b(?:a|con|de|para)\s+de\b/iu.test(row)) {
      return '';
    }
    return row.replace(/\s{2,}/g, ' ').trim();
  }).filter(Boolean);
  return formatExperienceBullets(cleaned);
}

/** @deprecated Prefer stripSpanishExperienceUnsupportedEscalation (AAB-309). */
export function stripSpanishExperienceGuaranteeEscalation(
  candidateDescription: string,
  sourceDescription = '',
): string {
  return stripSpanishExperienceUnsupportedEscalation(
    candidateDescription,
    sourceDescription,
  );
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
  void SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION;
  void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
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

  // Performance / efficiency / optimization (AAB-309).
  if (EFFICIENCY_CLAIM_ES.test(joined) && !sourceSupportsSpanishEfficiency(source)) {
    kinds.push('efficiency_claim');
    labels.push('efficiency_claim');
    kinds.push('performance_claim');
    labels.push('performance_claim');
  }
  if (OPTIMIZATION_CLAIM_ES.test(joined) && !sourceSupportsSpanishEfficiency(source)) {
    kinds.push('optimization_claim');
    labels.push('optimization_claim');
    if (/productividad|rendimiento/iu.test(joined)) {
      kinds.push('productivity_claim');
      labels.push('productivity_claim');
    }
    kinds.push('performance_claim');
    labels.push('performance_claim');
  }
  if (SPEED_CLAIM_ES.test(joined) && !sourceSupportsSpanishEfficiency(source)) {
    kinds.push('speed_claim');
    labels.push('speed_claim');
  }
  if (ACCURACY_CLAIM_ES.test(joined) && !sourceSupportsSpanishAccuracy(source)) {
    kinds.push('accuracy_claim');
    labels.push('accuracy_claim');
  }
  if (ERROR_FREE_CLAIM_ES.test(joined) && !ERROR_FREE_CLAIM_ES.test(source)) {
    kinds.push('error_free_claim');
    labels.push('error_free_claim');
  }
  // Outcome adverb "correctamente" as unsupported outcome when source lacks it.
  if (/\bcorrectamente\b/iu.test(joined)
    && !/\bcorrectamente\b|\bcorrect[ao]\b/iu.test(source)
    && !sourceSupportsSpanishGuarantee(source)) {
    kinds.push('outcome_ownership');
    labels.push('unsupported_outcome_adverb');
  }

  // Material object / logistics scope expansion (AAB-309).
  for (const k of detectSpanishObjectScopeExpansion(source, joined)) {
    kinds.push(k);
    labels.push(k);
  }

  // Candidate-added material predicates / coordinated actions (AAB-310 / 314).
  // Same-locale Spanish only — cross-locale Hindi/etc. → Spanish uses coverage/fallback
  // grounding and must not treat translated verbs as candidate-added actions.
  // Accented preterite / morphology must count as Spanish predicates (never vacuous pass).
  const sourceHasSpanishPredicates = extractSpanishExperiencePredicates(source).length > 0
    || textLooksSpanishExperience(source)
    || /(?:revisa|revisó|revisaba|comprueba|comprobó|coordina|coordinó|mercanc[ií]a|documentaci[oó]n|preparaci[oó]n|compa[nñ]er)/iu
      .test(source);
  const predicateScan = sourceHasSpanishPredicates
    ? detectSpanishExperiencePredicateExpansion(source, joined)
    : {
      sourcePredicateIdentityCount: 0,
      candidatePredicateIdentityCount: 0,
      candidateAddedPredicateCount: 0,
      candidateAddedPredicateIdentityHashes: [] as string[],
      unsupportedKinds: [] as ExperienceUnsupportedClaimKind[],
      coordinatedPredicateExpansionDetected: false,
      sourceUnitPredicateCoveragePassed: true,
      sourcePredicateExtractionPassed: true,
      sourceUnitsWithPredicateCount: 0,
      sourceUnitsMissingPredicateCount: 0,
      sourcePredicateExtractionFailureReason: null as string | null,
    };
  for (const k of predicateScan.unsupportedKinds) {
    kinds.push(k);
    labels.push(k);
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
      || uniqueKinds.includes('outcome_ownership')
      || uniqueKinds.includes('efficiency_claim')
      || uniqueKinds.includes('object_scope_expansion')
      || uniqueKinds.includes('logistics_scope_expansion')
      || uniqueKinds.includes('action_scope_expansion')
      || uniqueKinds.includes('document_management_expansion')
      || uniqueKinds.includes('coordinated_predicate_expansion')
      || uniqueKinds.includes('compliance_scope_expansion')
      || uniqueKinds.includes('conformity_object_expansion')
      || uniqueKinds.includes('certification_scope_expansion')
      || uniqueKinds.includes('approval_scope_expansion')
      || uniqueKinds.includes('quality_scope_expansion'),
    deadlineClaimDetected,
    documentationExpansionDetected,
    malformedRolePhraseDetected,
    informationExchangeSubstitutionDetected,
    sourcePredicateIdentityCount: predicateScan.sourcePredicateIdentityCount,
    candidatePredicateIdentityCount: predicateScan.candidatePredicateIdentityCount,
    candidateAddedPredicateCount: predicateScan.candidateAddedPredicateCount,
    candidateAddedPredicateIdentityHashes:
      predicateScan.candidateAddedPredicateIdentityHashes,
    unsupportedPredicateKindCount: predicateScan.unsupportedKinds.length,
    coordinatedPredicateExpansionDetected:
      predicateScan.coordinatedPredicateExpansionDetected,
    sourceUnitPredicateCoveragePassed: predicateScan.sourceUnitPredicateCoveragePassed,
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
        ? 'Comprueba la documentación relacionada con la mercancía recibida.'
        : 'Comprobó la documentación relacionada con la mercancía recibida.');
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
        'Comprueba la documentación relacionada con la mercancía recibida.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]
      : [
        'Revisó la mercancía entrante en el almacén.',
        'Comprobó la documentación relacionada con la mercancía recibida.',
        'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
      ]);
  }
  return formatExperienceBullets(lines);
}
