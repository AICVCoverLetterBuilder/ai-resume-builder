/**
 * Shared warehouse-domain applicability (AAB-344+).
 *
 * Dedicated warehouse fact/predicate validators must not activate from a single
 * generic action combination (preparation + colleagues, coordination + movement,
 * checking + documents, organization + goods). Require positive warehouse-domain
 * evidence from the authoritative source (and optional job context).
 *
 * Precedence:
 * 1. Decide whether a dedicated warehouse validator is genuinely applicable.
 * 2. When applicable, use the strict dedicated validator unchanged.
 * 3. When not applicable, use shared occupation-agnostic grounding.
 */

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION =
  'warehouse-domain-applicability-344-v1' as const;

void WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION;

export type WarehouseDomainApplicabilityOptions = {
  /** Optional job title / position (e.g. Cook, Warehouse Worker). */
  position?: string | null;
  /** Optional industry / domain (e.g. hospitality, logistics). */
  industry?: string | null;
};

/**
 * Facility / occupation warehouse stems.
 * Latin `skladište` / `skladiste` — not `skladištenje` (act of storing food).
 * Cyrillic `склад…` uses `\p{L}` because JS `\w` is ASCII-only even with `/u`.
 */
const WAREHOUSE_FACILITY_LATIN =
  /(?:\bwarehouse\b|\bstorekeeper\b|\bstore\s*keeper\b|\bwarehouseman\b|\bwarehouse\s+worker\b|\bgoods\s+receiver\b|\breceiving\s+clerk\b|\binventory\s+(?:clerk|associate|specialist|role)\b|\breceiving\s+(?:role|clerk|associate)\b|skladišt(?!enj)\p{L}*|skladist(?!enj)\p{L}*|\bmagacin\p{L}*|\bmagazin\p{L}*|\blager\b|almac[eé]n|entrep[oô]t|magazzino|armaz[eé]m)/iu;

const WAREHOUSE_FACILITY_NONLATIN =
  /(?:склад\p{L}*|गोदाम|倉庫|مستودع)/u;

/**
 * Explicit warehouse occupation / facility / goods-receiver vocabulary.
 * A single match is sufficient for applicability (contract A).
 */
const EXPLICIT_WAREHOUSE_DOMAIN = new RegExp(
  `(?:${WAREHOUSE_FACILITY_LATIN.source}|${WAREHOUSE_FACILITY_NONLATIN.source}|zaprimljen\\p{L}*)`,
  'iu',
);

/** Cooking / hospitality signals that must not alone imply warehouse work. */
const COOKING_HOSPITALITY_SOURCE =
  /(?:\bmeals?\b|\bdishes?\b|\bkitchen\b|\bcook(?:ing|s)?\b|\bchef\b|\bfood\s+preparation\b|\bcleanliness\b.{0,48}\bkitchen\b|\bhygiene\b.{0,48}\bkitchen\b|\bhospitality\b|\brestaurants?\b|restoran\p{L}*|kuhinj\p{L}*|\bjela\b|\bnamirnic\p{L}*|\bkuvar\p{L}*|\bkuhar\p{L}*|higijen\p{L}*|व्यंजन|भोजन|रसोई|खाना|पकवान|कुक|शेफ)/iu;

/** Independent warehouse-specific anchor groups (contract B — need ≥ 2). */
const ANCHOR_INCOMING_GOODS =
  /(?:incoming\s+(?:merchandise|goods|deliveries)|received\s+(?:merchandise|goods)|inbound\s+(?:merchandise|goods)|goods?\s+received|merchandise\s+upon\s+arrival|आने\s*वाल[ेी]\s+(?:माल|वस्तु)|поступающ\p{L}*\s+товар\p{L}*|поступивш\p{L}*\s+товар\p{L}*|eingehend\p{L}*\s+Waren|mercanc[ií]a\s+(?:entrant|recibid)|marchandises?\s+entrant|merci\s+in\s+entrata|mercadorias?\s+(?:que\s+chegam|recebid|em\s+entrada)|البضائع\s*الواردة|入荷|zaprimljen\p{L}*|pristigl\p{L}*\s+rob)/iu;

const ANCHOR_WAREHOUSE_STORAGE = new RegExp(
  `(?:\\bwarehouse\\b|\\bstorage\\b(?:\\s+(?:area|facility|room))?|${WAREHOUSE_FACILITY_LATIN.source}|${WAREHOUSE_FACILITY_NONLATIN.source})`,
  'iu',
);

const ANCHOR_GOODS_DOCUMENTATION =
  /(?:(?:related|associated|accompanying|shipping)\s+(?:documents?|documentation|paperwork|records?)|(?:documents?|documentation|paperwork).{0,32}(?:goods|merchandise|received|incoming|delivery)|documentaci[oó]n\s+relacionad|documents?\s+associ|documentazione\s+di\s+accompagnamento|documenta[cç][aã]o\s+(?:associad|relacionad)|сопроводительн\p{L}*\s+документ\p{L}*|संबंधित\s+दस्तावे|الوثائق\s*المرفقة|関連書類|prateć\p{L}*\s+dokument|popratn\p{L}*\s+dokument)/iu;

const ANCHOR_GOODS_PREP_MOVEMENT =
  /(?:(?:preparation|preparing|prepared).{0,40}(?:movement|moving|transfer|handling).{0,40}(?:merchandise|goods|rob)|(?:movement|moving|transfer).{0,40}(?:merchandise|goods|rob)|(?:merchandise|goods|rob).{0,40}(?:preparation|movement|transfer)|prepare\s+and\s+move\s+(?:merchandise|goods)|माल\s+(?:की\s+)?तैयारी.{0,40}(?:आवाजाही|स्थानांतरण)|(?:आवाजाही|स्थानांतरण).{0,40}माल|подготов\p{L}*.{0,48}(?:товар\p{L}*.{0,48})?перемещен\p{L}*|Vorbereitung.{0,40}(?:Bewegung|Transport).{0,40}Waren|preparaci[oó]n.{0,40}movimiento.{0,40}mercanc|pr[eé]paration.{0,40}(?:d[eé]placement|mouvement).{0,40}marchand|preparazione.{0,40}movimentazione.{0,40}merci|prepara[cç][aã]o.{0,40}movimenta[cç][aã]o.{0,40}mercador|商品の準備と移動)/iu;

// Serbian source forms used by receiving/logistics roles. They are semantic
// warehouse anchors, not occupation/title fixtures.
const ANCHOR_SERBIAN_INCOMING_GOODS =
  /dolazn\p{L}*\s+rob\p{L}*/iu;

const ANCHOR_SERBIAN_GOODS_PREP_MOVEMENT =
  /(?:priprem\p{L}*.{0,48}kretanj\p{L}*.{0,48}rob\p{L}*|priprem\p{L}*.{0,48}rob\p{L}*.{0,48}kretanj\p{L}*|rob\p{L}*.{0,48}(?:priprem\p{L}*|kretanj\p{L}*))/iu;

function corpusFrom(
  sourceDescription: string,
  options?: WarehouseDomainApplicabilityOptions,
): string {
  return [
    sourceDescription || '',
    options?.position || '',
    options?.industry || '',
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('\n');
}

/** Count how many independent warehouse anchor groups fire on the corpus. */
export function countWarehouseDomainAnchorGroups(
  sourceDescription: string,
  options?: WarehouseDomainApplicabilityOptions,
): number {
  void WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION;
  const text = corpusFrom(sourceDescription, options);
  if (!text.trim()) return 0;
  let n = 0;
  if (ANCHOR_INCOMING_GOODS.test(text) || ANCHOR_SERBIAN_INCOMING_GOODS.test(text)) n += 1;
  if (ANCHOR_WAREHOUSE_STORAGE.test(text)) n += 1;
  if (ANCHOR_GOODS_DOCUMENTATION.test(text)) n += 1;
  if (ANCHOR_GOODS_PREP_MOVEMENT.test(text)
    || ANCHOR_SERBIAN_GOODS_PREP_MOVEMENT.test(text)) n += 1;
  return n;
}

/**
 * True when dedicated warehouse fact/predicate grounding may run.
 * Generic verbs (prepare / colleagues / coordinate / movement / check /
 * documents / kitchen / meals / food) alone are never enough.
 */
export function sourceHasWarehouseDomainApplicability(
  sourceDescription: string,
  options?: WarehouseDomainApplicabilityOptions,
): boolean {
  void WAREHOUSE_DOMAIN_APPLICABILITY_344_REVISION;
  const text = corpusFrom(sourceDescription, options);
  if (!text.trim()) return false;

  const explicit = EXPLICIT_WAREHOUSE_DOMAIN.test(text);
  const anchors = countWarehouseDomainAnchorGroups(sourceDescription, options);
  const cooking = COOKING_HOSPITALITY_SOURCE.test(text);

  // Cooking / hospitality without warehouse evidence must stay on the generic path.
  // Explicit warehouse occupation/facility (contract A) or ≥2 anchors (B) still apply.
  if (cooking && !explicit && anchors < 2) {
    return false;
  }

  if (explicit) return true;
  return anchors >= 2;
}

/**
 * Convenience: true when the source looks like cooking/hospitality work and
 * warehouse specialization must stay off.
 */
export function sourceIsCookingHospitalityWithoutWarehouseEvidence(
  sourceDescription: string,
  options?: WarehouseDomainApplicabilityOptions,
): boolean {
  const text = corpusFrom(sourceDescription, options);
  return COOKING_HOSPITALITY_SOURCE.test(text)
    && !sourceHasWarehouseDomainApplicability(sourceDescription, options);
}
