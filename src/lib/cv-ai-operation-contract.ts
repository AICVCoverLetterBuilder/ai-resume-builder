/**
 * Universal AI button contract: generate vs enhance/regenerate.
 *
 * Shared by Experience, Summary, Cover Letter, stronger-content, and future
 * AI actions. Mode selection is content-emptiness only — never occupation
 * catalogues, locale special-cases, or per-title templates.
 */
import type { Locale } from './i18n/translations';
import type { AiErrorCode } from './ai-error-codes';

export type AiOperationMode =
  | 'generate_from_context'
  | 'enhance_existing_content'
  | 'regenerate_existing_content';

export type AiActionKind =
  | 'experience_bullets'
  | 'summary'
  | 'cover_letter'
  | 'stronger_content'
  | 'rewrite_style';

/** Every user-visible LLM-backed AI button in the product. */
export type AiLlmButtonId =
  | 'experience_ai_improvements'
  | 'summary_generate'
  | 'summary_shorter'
  | 'summary_stronger'
  | 'summary_professional'
  | 'cover_letter_generate'
  | 'cover_letter_regenerate';

export const AI_LLM_BUTTON_INVENTORY: readonly {
  id: AiLlmButtonId;
  uiSurface: string;
  apiAction: string;
  handler: string;
}[] = [
  {
    id: 'experience_ai_improvements',
    uiSurface: 'cv-builder Experience AI Improvements',
    apiAction: 'bullets',
    handler: 'handleGenBullets',
  },
  {
    id: 'summary_generate',
    uiSurface: 'cv-builder Professional Summary Generate',
    apiAction: 'summary',
    handler: 'handleGenSummary',
  },
  {
    id: 'summary_shorter',
    uiSurface: 'cv-builder Summary Shorter',
    apiAction: 'rewrite:shorter',
    handler: 'handleRewrite(shorter)',
  },
  {
    id: 'summary_stronger',
    uiSurface: 'cv-builder Summary Stronger',
    apiAction: 'rewrite:stronger',
    handler: 'handleRewrite(stronger)',
  },
  {
    id: 'summary_professional',
    uiSurface: 'cv-builder Summary Professional',
    apiAction: 'rewrite:professional',
    handler: 'handleRewrite(professional)',
  },
  {
    id: 'cover_letter_generate',
    uiSurface: 'cover-letter Generate',
    apiAction: 'cover-letter-gen',
    handler: 'handleGenerate → runCoverLetterGeneration',
  },
  {
    id: 'cover_letter_regenerate',
    uiSurface: 'cover-letter Regenerate',
    apiAction: 'cover-letter-regen',
    handler: 'handleRegenerate → runCoverLetterGeneration',
  },
] as const;

/**
 * Resolve operation mode for a specific LLM button from latest visible target.
 */
export function resolveAiButtonOperationMode(
  button: AiLlmButtonId,
  targetContent: string | null | undefined,
): AiOperationMode {
  const empty = !(targetContent || '').trim();
  switch (button) {
    case 'experience_ai_improvements':
    case 'summary_generate':
    case 'summary_shorter':
    case 'summary_stronger':
    case 'summary_professional':
    case 'cover_letter_generate':
      return empty ? 'generate_from_context' : 'enhance_existing_content';
    case 'cover_letter_regenerate':
      return empty ? 'generate_from_context' : 'regenerate_existing_content';
    default:
      return resolveAiOperationMode({ targetContent });
  }
}

export function summaryRewriteButtonId(
  style: 'shorter' | 'stronger' | 'professional',
): AiLlmButtonId {
  if (style === 'shorter') return 'summary_shorter';
  if (style === 'stronger') return 'summary_stronger';
  return 'summary_professional';
}

export const AI_SUPPORTED_LOCALES: readonly Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
] as const;

export const AI_INDUSTRY_VALUES = [
  'general', 'tech', 'data_ai', 'cybersecurity', 'sales_retail', 'sales_b2b',
  'marketing', 'finance', 'banking_fintech', 'healthcare', 'pharmacy',
  'education', 'human_resources', 'customer_service', 'logistics', 'operations',
  'executive', 'project_management', 'design', 'engineering', 'construction',
  'hospitality', 'legal', 'administration', 'sales',
] as const;

export const AI_LEVEL_VALUES = ['entry', 'mid', 'senior', 'lead'] as const;

export type ResolveAiOperationModeInput = {
  /** Latest visible target field text (empty → generation). */
  targetContent: string | null | undefined;
  /**
   * Optional unit extractor (Experience duties). When omitted, non-whitespace
   * trimmed length decides emptiness.
   */
  contentUnits?: string[];
  /** Explicit regenerate button (e.g. Summary regenerate with existing text). */
  forceRegenerate?: boolean;
};

/**
 * Universal mode decision — identical for every AI button.
 */
export function resolveAiOperationMode(
  input: ResolveAiOperationModeInput,
): AiOperationMode {
  if (input.forceRegenerate) return 'regenerate_existing_content';
  const units = input.contentUnits;
  if (units) {
    return units.filter((u) => (u || '').trim()).length === 0
      ? 'generate_from_context'
      : 'enhance_existing_content';
  }
  const text = (input.targetContent || '').trim();
  return text.length === 0
    ? 'generate_from_context'
    : 'enhance_existing_content';
}

export function aiTargetContentWasEmpty(
  targetContent: string | null | undefined,
  contentUnits?: string[],
): boolean {
  return resolveAiOperationMode({ targetContent, contentUnits }) === 'generate_from_context';
}

/** Fold free-text for soft stem matching (any script). */
export function foldAiTextToken(token: string): string {
  return (token || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Peel a German compound occupation into object stem + agentive head.
 * Morphology only — not an occupation catalogue.
 */
export function peelGermanAgentiveCompound(foldedTitle: string): {
  objectStem: string;
  agentive: string;
} | null {
  const t = (foldedTitle || '').toLowerCase();
  if (t.length < 8) return null;
  const suffixes = [
    'mechanikerin', 'mechaniker',
    'monteurin', 'monteur',
    'technikerin', 'techniker',
    'installateurin', 'installateur',
    'assistentin', 'assistent',
    'managerin', 'manager',
    'koordinatorin', 'koordinator',
    'beraterin', 'berater',
    'helferin', 'helfer',
    'arbeiterin', 'arbeiter',
    'prueferin', 'pruefer', 'prüferin', 'prüfer',
    'mitarbeiterin', 'mitarbeiter',
    'pflegerin', 'pfleger',
    'lehrerin', 'lehrer',
    'fahrerin', 'fahrer',
    'halterin', 'halter',
    'fachkraft',
  ];
  for (const suf of suffixes) {
    const foldedSuf = foldAiTextToken(suf);
    if (t.length <= foldedSuf.length + 3) continue;
    if (t.endsWith(foldedSuf)) {
      let objectStem = t.slice(0, t.length - foldedSuf.length);
      // Drop compound-link -s- (Bibliotheksassistent → bibliothek).
      if (objectStem.endsWith('s') && objectStem.length > 4) {
        objectStem = objectStem.slice(0, -1);
      }
      if (objectStem.length >= 3) {
        return { objectStem, agentive: foldedSuf };
      }
    }
  }
  return null;
}

/**
 * Title stems from the user's free-text occupation — not a catalogue.
 * Tokens length ≥ 3 (or ≥ 2 for CJK) become soft relevance anchors.
 */
export function freeTextTitleStems(position: string): string[] {
  const raw = (position || '').trim();
  if (!raw) return [];
  const parts = raw
    .split(/[\s/|,;·•\-–—]+/u)
    .map(foldAiTextToken)
    .filter((t) => {
      if (!t) return false;
      if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) return t.length >= 1;
      return t.length >= 3;
    });
  // German single-token compounds: also keep the peeled object stem (Fahrrad…).
  for (const p of [...parts]) {
    const peeled = peelGermanAgentiveCompound(p);
    if (peeled?.objectStem && peeled.objectStem.length >= 3) {
      parts.push(peeled.objectStem);
    }
  }
  return [...new Set(parts)].slice(0, 16);
}

/**
 * Soft semantic domain from an arbitrary free-text job title.
 * Not an occupation catalogue — only coarse action-frame families for
 * generation relevance and locale-pure fallback shells.
 */
export type FreeTextJobDomain =
  | 'design'
  | 'warehouse'
  | 'software'
  | 'hospitality'
  | 'healthcare'
  | 'documentation'
  | 'general';

export function classifyFreeTextJobDomain(position?: string | null): FreeTextJobDomain {
  const raw = position || '';
  const t = foldAiTextToken(raw);
  if (!t && !raw.trim()) return 'general';
  // Match against both folded Latin and raw CJK — NFKD dakuten stripping turns
  // グラフィック/デザイン into クラフィック/テサイン and must not miss design titles.
  const designRe =
    /(?:dizajn|design|grafick|graphic|visual|vizuel|ui\b|ux\b|일러스트|デザイン|デザイナー|グラフィック|グラフォ|クラフィック|テサイナ|تصميم|डिज़ाइन|дизайн|графическ)/i;
  if (designRe.test(t) || designRe.test(raw)) {
    return 'design';
  }
  // Logistics analysts/coordinators can describe information flows rather than
  // physical warehouse handling. Do not invent goods/inventory duties from the
  // broad "logistics" stem alone.
  if (/(?:analitic|analyst).{0,24}logist|logist.{0,24}(?:tok|flow)/i.test(t)) {
    return 'general';
  }
  const warehouseRe =
    /(?:skladist|warehouse|magacin|lager|logist|inventar|inventory|robu|goods|кладов|склад|倉庫|入荷|almacen|almacén|empleado de almacen|empleada de almacen|trabajador de almacen|trabajadora de almacen|mozo de almacen|moza de almacen)/i;
  if (warehouseRe.test(t) || warehouseRe.test(raw)) {
    return 'warehouse';
  }
  if (/(software|developer|programer|engineer|frontend|backend|devops|coder)/.test(t)) {
    return 'software';
  }
  if (/(cook|chef|kuvar|kuhar|bartender|waiter|konobar|baker|pekar|restaurant)/.test(t)) {
    return 'hospitality';
  }
  if (/(nurse|doctor|physician|medic|terapeut|pharmacist|apotekar)/.test(t)) {
    return 'healthcare';
  }
  if (/(administr|document|dokument|office|računovod|accounting|sekretar|assistant|توثيق|وثائق)/.test(t)) {
    return 'documentation';
  }
  return 'general';
}

const DOMAIN_CUE_RE: Record<FreeTextJobDomain, RegExp> = {
  design: /(?:vizuel|visual|grafick|graphic|dizajn|design|identitet|identity|materijal|material|format|ekran|screen|platform|दृश्य|ग्राफिक|डिज़ाइन|تصميم|بصرية|رسومية|ビジュアル|グラフィック|визуал|графическ|дизайн)/iu,
  warehouse: /(?:skladist|warehouse|rob\w*|goods|inventar|inventory|dokument|document|गोदाम|माल|مستودع|بضائع|倉庫|商品|товар|склад|Waren|Wareneingang|Lager|Unterlagen|Aufzeichnungen|Kolleg|almac[eé]n|mercanc[ií]a|documentaci[oó]n|compa[nñ]er)/iu,
  software: /(?:code|api|feature|aplikativ|software|developer|開発|विकास)/iu,
  hospitality: /(?:jel\w*|dish|cuisine|kitchen|kuhinj|bar|guest|hygiene|व्यंजन|रसोई|Speisen|Zutaten|Küchen|Rezeptur)/iu,
  healthcare: /(?:patient|pacijen|care|nurs|record|chart|zdravstven|пациент|pazient|farmaceut|farmaci)/iu,
  documentation: /(?:dokument|document|evidenc|record|status|информац|दस्तावे|रिकॉर्ड|توثيق|وثائق|سجلات|書類|文書|記録|документ|запис)/iu,
  // Role-work cues only — documentation/admin language is not material for general titles.
  general: /(?:dut(?:y|ies)|tasks?|work\s+activit|role\s+work|as\s+assigned|role\s+needs?|zadat|poslov|aktivnost|koleg|obavlja|dodeljen|dodijeljen|業務|役割|कार्य|सौंपे|دور|задач|Arbeit(?:en|s)?|Tätig|colleagues|коллег|زملاء|同僚|सहकर्मी|compiti|tareas|tâches|tarefas|Aufgaben|mansioni|Wartung|wartungs|Prüft|pruft|Reparier|Montier|Bauteile|Diagnostiz|Tauscht|Montiert)/iu,
};

/**
 * Classic empty-source administrative/documentation shell.
 * Not materially related to non-documentation occupations even when a title
 * stem is pasted into one bullet ("related to …").
 */
export const EXPERIENCE_GENERATION_RELEVANCE_367_REVISION =
  'experience-generation-relevance-367-v1' as const;

/** Packaged asset marker — empty-source generation fallback quality (AAB-368). */
export const EXPERIENCE_GENERATION_FALLBACK_QUALITY_368_REVISION =
  'experience-generation-fallback-quality-368-v1' as const;

/** Packaged asset marker — empty-source fallback surface prose quality (AAB-369). */
export const EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION =
  'experience-generation-fallback-surface-369-v1' as const;

/** German empty-source fallback quality — reject title-echo / generic task shells. */
export const EXPERIENCE_GENERATION_FALLBACK_QUALITY_378_REVISION =
  'experience-generation-fallback-quality-378-v1' as const;

void EXPERIENCE_GENERATION_RELEVANCE_367_REVISION;
void EXPERIENCE_GENERATION_FALLBACK_QUALITY_368_REVISION;
void EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION;
void EXPERIENCE_GENERATION_FALLBACK_QUALITY_378_REVISION;

export function generationLooksGenericAdministrativeOnly(text: string): boolean {
  void EXPERIENCE_GENERATION_RELEVANCE_367_REVISION;
  const joined = text || '';
  if (!joined.trim()) return false;
  const signals = [
    /day-to-day\s+records/iu,
    /work\s+documentation/iu,
    /information\s+sharing/iu,
    /(?:verif(?:y|ies|ied)|kontroll\w*|provjer\w*|prover\w*).{0,24}(?:data\s+)?completeness|potpunost\s+podataka|Vollständigkeit|intégrité|exhaustivité|completezza|completude|اكتمال\s+البيانات|データの完全性|полноту?\s+данных/iu,
    /(?:tracks?|tracked|prati|pratila|pratilo|verfolgt|sigue|suit|segue|acompanha|يتابع|تابعت|未完了|открыт).{0,40}(?:open\s+items|offene|dossiers?\s+ouvert|pratiche\s+aperte|بنود\s+مفتوحة|खुली\s+मद)/iu,
    /complete\s+documentation|dovršavanja?\s+dokumentacije|kompletiranja?\s+dokumentacije|Fertigstellung|finaliser\s+la\s+documentation|completare\s+la\s+documentazione|concluir\s+a\s+documentação|إكمال\s+التوثيق|文書を期限内|завершения?\s+документации|दस्तावेज़\s+समय\s+पर/iu,
    /(?:Pregledava|Pregleda|Ažurira|Koordinira|Koordiniše).{0,80}dokument/iu,
    /سجل(?:ات)?\s+اليومية|وثائق\s+العمل|تبادل\s+المعلومات/iu,
    /日常業務に関する記録|業務文書を更新|関係者と情報を調整/iu,
    /повседневные\s+рабочие\s+записи|рабочую\s+документацию|обмен\s+информацией/iu,
    /दैनिक\s+कार्य\s+रिकॉर्ड|कार्य\s+दस्तावेज़|जानकारी\s+का\s+समन्वय/iu,
  ];
  return signals.filter((re) => re.test(joined)).length >= 2;
}

/**
 * Tautological empty-source shells that only restate role/duties/tasks/activities
 * without distinct action-grounded duties.
 */
export function generationLooksTautologicalRoleShellOnly(text: string): boolean {
  void EXPERIENCE_GENERATION_FALLBACK_QUALITY_368_REVISION;
  void EXPERIENCE_GENERATION_FALLBACK_QUALITY_378_REVISION;
  // Administrative shells are classified separately — do not conflate with tautology.
  if (generationLooksGenericAdministrativeOnly(text)) return false;
  const lines = (text || '')
    .split(/\r?\n|•/)
    .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  const tautRe =
    /(?:\bday-to-day\b.{0,48}\bduties\b(?:\s+as\s+assigned)?|\bassigned role tasks\b|\bshared role work activities\b|\bcompletes? assigned role\b|\brole work activities\b|\bperforms? day-to-day\b.{0,40}\bduties\b|zugewiesene\s+Aufgaben|Arbeitsaufgaben|Rollenanforderungen|Arbeitstätigkeiten\s+mit\s+Kolleg)/iu;
  const hits = lines.filter((l) => tautRe.test(l)).length;
  if (hits >= 2) return true;
  // Whole field is only generic duty/task/activity restatement.
  const joined = lines.join('\n');
  const genericOnly =
    /(?:duties|tasks|activities|role needs|as assigned|zugewiesene\s+Aufgaben|Arbeitsaufgaben|Rollenanforderungen)/iu.test(joined)
    && !/(?:\binstalls?\b|\bpositions?\b|\bsecures?\b|\boperates?\b|\bmonitors?\b|\banalyz(?:e|es|ed)\b|\bcreates?\b|\bprepares?\b|\breviews?\b(?!\s+day-to-day\s+records)|\bproduces?\b|\bdelivers?\b|\btracks?\b(?!\s+open\s+items)|Wartungsarbeiten|Prüft\b|Reparier|Montier|Tauscht\b|Diagnostiz)/iu
      .test(joined);
  return genericOnly && hits >= 1;
}

/**
 * Weak title-echo / filler shells: "for the X role", bare "as assigned",
 * "according to role requirements" — not CV-ready even when action verbs exist.
 * German: "im Bereich {title}", zugewiesene Aufgaben, Arbeitsaufgaben,
 * Rollenanforderungen.
 */
export function generationLooksRoleTitleEchoFillerOnly(text: string): boolean {
  void EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION;
  void EXPERIENCE_GENERATION_FALLBACK_QUALITY_378_REVISION;
  const lines = (text || '')
    .split(/\r?\n|•/)
    .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  const fillerRe =
    /(?:\bfor the\b.+\brole\b|\bas assigned(?:\s+for\b)?|\baccording to role requirements\b|im\s+Bereich\s+\S+|zugewiesene\s+Aufgaben|Arbeitsaufgaben|Rollenanforderungen)/iu;
  return lines.filter((l) => fillerRe.test(l)).length >= 2;
}

function titleAndTextLookCrossScript(position: string, text: string): boolean {
  const p = position || '';
  const t = text || '';
  if (!p.trim() || !t.trim()) return false;
  const titleLat = /[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/u.test(p);
  const titleCjk = /[\u3040-\u30FF\u3400-\u9FFF]/u.test(p);
  const titleAr = /[\u0600-\u06FF]/u.test(p);
  const titleDev = /[\u0900-\u097F]/u.test(p);
  const titleCyr = /[\u0400-\u04FF]/u.test(p);
  const textLat = /[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/u.test(t);
  const textCjk = /[\u3040-\u30FF\u3400-\u9FFF]/u.test(t);
  const textAr = /[\u0600-\u06FF]/u.test(t);
  const textDev = /[\u0900-\u097F]/u.test(t);
  const textCyr = /[\u0400-\u04FF]/u.test(t);
  if (titleLat && !textLat && (textCjk || textAr || textDev || textCyr)) return true;
  if (titleCjk && textLat && !textCjk) return true;
  if (titleAr && textLat && !textAr) return true;
  if (titleDev && textLat && !textDev) return true;
  if (titleCyr && textLat && !textCyr) return true;
  return false;
}

function looksLikeLocalePureRoleWorkShell(text: string): boolean {
  if (generationLooksGenericAdministrativeOnly(text)) return false;
  if (generationLooksTautologicalRoleShellOnly(text)) return false;
  if (generationLooksRoleTitleEchoFillerOnly(text)) return false;
  return /(?:\binstalls?\b|\bpositions?\s+and\s+secures?\b|\boperates?\b|\bmonitors?\b|\banalyz(?:es|ed)\b|\bcreates?\b|\bprepares?\b|\bproduces?\s+concrete\b|\breviews?\b.+\bfollow-ups\b|\btracks?\b.+\bfollow-ups\b|\bcoordinates?\s+(?:installation|operational|technical|analysis)?\s*activit|\bcoordinates?\s+with\s+colleagues\b|\baligns?\s+with\s+colleagues\b|\bcoordinates?\s+\S.{0,40}\bworkstreams\b|Wartungsarbeiten|Prüft\b|Reparier|Montier|Tauscht\b|Diagnostiz|Stimmt\s+(?:Montage|Reparatur|Arbeits)|Unterstützt\b)/iu
    .test(text || '');
}

/**
 * Soft relevance: generated text should share ≥1 stem with the free-text title
 * when stems exist. Empty title → pass (context may be industry/level only).
 * Cross-script titles use semantic domain cues instead of literal stem overlap.
 * Generic admin/docs shells and tautological role/duty shells are never relevant
 * unless the title is documentation (admin only).
 */
export function textLooksRelevantToFreeTextTitle(
  text: string,
  position: string,
): boolean {
  const domain = classifyFreeTextJobDomain(position);
  if (
    generationLooksGenericAdministrativeOnly(text)
    && domain !== 'documentation'
  ) {
    return false;
  }
  if (generationLooksTautologicalRoleShellOnly(text)) {
    return false;
  }
  if (generationLooksRoleTitleEchoFillerOnly(text)) {
    return false;
  }
  const stems = freeTextTitleStems(position);
  if (!stems.length) return true;
  const folded = foldAiTextToken(text);
  if (!folded) return false;
  if (stems.some((stem) => {
    const needle = stem.slice(0, Math.min(stem.length, Math.max(4, Math.floor(stem.length * 0.75))));
    return needle.length >= 2 && folded.includes(needle);
  })) {
    return true;
  }
  if (DOMAIN_CUE_RE[domain].test(text) || DOMAIN_CUE_RE[domain].test(folded)) {
    return true;
  }
  if (titleAndTextLookCrossScript(position, text)) {
    return DOMAIN_CUE_RE.general.test(text) || DOMAIN_CUE_RE.general.test(folded);
  }
  return looksLikeLocalePureRoleWorkShell(text);
}

/** True when `position` uses a script family incompatible with embedding in `locale` prose. */
export function jobTitleScriptConflictsWithLocale(position: string, locale: Locale): boolean {
  const p = (position || '').trim();
  if (!p) return false;
  const hasDev = /[\u0900-\u097F]/u.test(p);
  const hasAr = /[\u0600-\u06FF]/u.test(p);
  const hasCjk = /[\u3040-\u30FF\u3400-\u9FFF]/u.test(p);
  const hasCyr = /[\u0400-\u04FF]/u.test(p);
  const hasLat = /[A-Za-zÀ-ÖØ-öø-ÿŠšŽžĆćČčĐđ]/u.test(p);
  if (locale === 'hi') return hasLat || hasAr || hasCjk || hasCyr;
  if (locale === 'ar') return hasLat || hasDev || hasCjk || hasCyr;
  if (locale === 'ja') return hasLat || hasDev || hasAr || hasCyr;
  if (locale === 'ru') return hasDev || hasAr || hasCjk || (hasLat && /[čćžšđ]/iu.test(p));
  // Serbian/Croatian accept Latin or Cyrillic titles in local prose.
  if (locale === 'sr' || locale === 'hr') return hasDev || hasAr || hasCjk;
  // Other Latin targets: never paste Devanagari/Arabic/CJK/Cyrillic titles into prose.
  if (hasDev || hasAr || hasCjk || hasCyr) return true;
  return false;
}

const GENERIC_FILLER_RE =
  /obavlja\s+dodeljene\s+profesionalne\s+(?:poslove|zadatke)|obavlja\s+svakodnevne\s+zadatke|u\s+ulozi\s+\p{L}|vezanih\s+za\s+rad\s+kao|blagovremen(?:o|og)?\s+zatvaranja?\s+zadataka|carry\s+out\s+assigned\s+professional\s+duties|सौंपे\s+गए\s+पेशेवर\s+कार्य|führt\s+zugewiesene\s+aufgaben|realiza\s+tareas\s+asignadas|exécute\s+les\s+tâches\s+assignées/iu;

const UNSAFE_INVENTION_RE =
  /(?:\bKPI\b|\bOKR\b|\bExcel\b|\bSalesforce\b|\bSAP\b|\bCRM\b|\bJira\b|\bSlack\b|%\s*(?:poveć|increase|growth|steigerung)|lead(?:ership|er)?\s+team|managed\s+\d+|tim\s+od\s+\d+|team\s+of\s+\d+|klijent(?:ima|e)|clients?|achievement|nagrada|award|certificat|ISO\s*\d+|increased\s+revenue)/iu;

/** Full job title repeated unnaturally across multiple bullets. */
export function aiOutputRepeatsFullTitleUnnaturally(
  text: string,
  position?: string,
): boolean {
  const title = (position || '').trim();
  if (title.length < 6) return false;
  const foldedTitle = foldAiTextToken(title);
  if (foldedTitle.length < 6) return false;
  const lines = (text || '')
    .split(/\r?\n|•/)
    .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  const hits = lines.filter((l) => foldAiTextToken(l).includes(foldedTitle)).length;
  if (hits >= 2) return true;
  return /u\s+ulozi\s+/iu.test(text) || /vezanih\s+za\s+rad\s+kao\s+/iu.test(text);
}

export function aiOutputLooksGenericFillerOnly(text: string): boolean {
  const lines = (text || '')
    .split(/\r?\n|•/)
    .map((l) => l.replace(/^[•\-\*]\s*/, '').trim())
    .filter(Boolean);
  if (!lines.length) return true;
  if (lines.every((l) => GENERIC_FILLER_RE.test(l))) return true;
  // Title-as-filler patterns count as generic even when not every line matches.
  const fillerHits = lines.filter((l) => GENERIC_FILLER_RE.test(l)).length;
  return fillerHits >= 2;
}

export function countAiUnsafeInventionClaims(text: string): number {
  const t = text || '';
  if (!t.trim()) return 0;
  return UNSAFE_INVENTION_RE.test(t) ? 1 : 0;
}

export type AiTypedFailureReason =
  | 'experience_generation_failed'
  | 'experience_generation_not_relevant'
  | 'experience_generation_locale_invalid'
  | 'experience_generation_unsafe_claims'
  | 'experience_enhancement_failed'
  | 'experience_enhancement_fact_coverage_incomplete'
  | 'summary_generation_failed'
  | 'summary_grounding_failed'
  | 'summary_rewrite_failed'
  | 'cover_letter_generation_failed'
  | 'cover_letter_regeneration_failed'
  | 'stronger_content_generation_failed'
  | 'ai_output_locale_invalid'
  | 'ai_output_unsafe_claims'
  | 'ai_request_stale'
  | 'ai_noop'
  | 'generation_validation_failed';

/** Map typed failure → user-facing AiErrorCode (localized separately). */
export function mapAiOperationFailureToErrorCode(
  reason: string | null | undefined,
  action?: AiActionKind,
): AiErrorCode {
  switch (reason) {
    case 'experience_generation_failed':
      return 'experience_generation_failed';
    case 'experience_generation_not_relevant':
      return 'experience_generation_not_relevant';
    case 'experience_generation_locale_invalid':
    case 'ai_output_locale_invalid':
      return 'experience_generation_locale_invalid';
    case 'experience_generation_unsafe_claims':
    case 'ai_output_unsafe_claims':
      return 'experience_generation_unsafe_claims';
    case 'experience_enhancement_failed':
    case 'experience_enhancement_fact_coverage_incomplete':
    case 'experience_material_fact_coverage_incomplete':
      return 'experience_enhancement_fact_coverage_incomplete';
    case 'summary_generation_failed':
      return 'summary_generation_failed';
    case 'summary_grounding_failed':
      return 'summary_grounding_failed';
    case 'summary_rewrite_failed':
      return 'summary_rewrite_failed';
    case 'cover_letter_generation_failed':
      return 'cover_letter_generation_failed';
    case 'cover_letter_regeneration_failed':
      return 'cover_letter_regeneration_failed';
    case 'stronger_content_generation_failed':
      return 'stronger_content_generation_failed';
    case 'ai_noop':
    case 'experience_ai_noop':
    case 'summary_noop_after_normalization':
      return 'ai_noop';
    case 'ai_request_stale':
      return 'ai_request_stale';
    default:
      if (action === 'rewrite_style' || action === 'stronger_content') {
        return 'summary_rewrite_failed';
      }
      if (action === 'summary') return 'summary_generation_failed';
      if (action === 'cover_letter') return 'cover_letter_generation_failed';
      return 'generation_validation_failed';
  }
}

/** Experience-compat aliases (existing diagnostics / callers). */
export type ExperienceAiOperationModeCompat =
  | 'generate_from_job_context'
  | 'enhance_existing_description';

export function toExperienceAiOperationModeCompat(
  mode: AiOperationMode,
): ExperienceAiOperationModeCompat {
  if (mode === 'generate_from_context') return 'generate_from_job_context';
  return 'enhance_existing_description';
}

export function fromExperienceAiOperationModeCompat(
  mode: ExperienceAiOperationModeCompat | AiOperationMode | string | null | undefined,
): AiOperationMode {
  if (mode === 'generate_from_job_context' || mode === 'generate_from_context') {
    return 'generate_from_context';
  }
  if (mode === 'regenerate_existing_content') return 'regenerate_existing_content';
  return 'enhance_existing_content';
}

/** Local heuristics — not LLM-backed; outside Pro AI usage counting. */
export const AI_NON_LLM_BUTTON_INVENTORY: readonly {
  id: string;
  uiSurface: string;
  handler: string;
}[] = [
  {
    id: 'template_ai_recommend',
    uiSurface: 'cv-builder AI Recommend template',
    handler: 'recommendTemplate (local heuristic)',
  },
  {
    id: 'job_description_analyzer',
    uiSurface: 'cv-builder Job description analyzer',
    handler: 'analyzeJobDescription (local heuristic)',
  },
] as const;

/** True when CV has enough structured context to generate a grounded Summary. */
export function hasSufficientSummaryGenerationContext(cv: {
  personal?: { jobTitle?: string } | null;
  experience?: Array<{
    position?: string;
    company?: string;
    description?: string;
  }> | null;
  skills?: string[] | null;
}): boolean {
  if ((cv.personal?.jobTitle || '').trim()) return true;
  if ((cv.skills || []).some((s) => (s || '').trim())) return true;
  return (cv.experience || []).some(
    (e) =>
      (e.position || '').trim()
      || (e.company || '').trim()
      || (e.description || '').trim(),
  );
}

/**
 * Deterministic, claim-safe style shaping for Summary rewrite fallbacks.
 * Never invents tools, metrics, leadership, or clients.
 */
export function applySummaryRewriteStyleDeterministic(
  text: string,
  style: 'shorter' | 'stronger' | 'professional',
): string {
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (style === 'shorter') {
    const parts = raw.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
    return (parts.slice(0, 2).join(' ') || raw).trim();
  }
  if (style === 'stronger') {
    return raw
      .replace(/\bhelped\b/gi, 'delivered')
      .replace(/\bworked on\b/gi, 'owned')
      .replace(/\bresponsible for\b/gi, 'drove')
      .replace(/\bgood\b/gi, 'solid');
  }
  // professional: strip casual softeners without inventing facts
  return raw
    .replace(/\breally\b/gi, '')
    .replace(/\bvery\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

