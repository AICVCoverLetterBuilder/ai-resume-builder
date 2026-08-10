/**
 * Per-unit target-locale / script purity for AI-generated semantic units.
 *
 * Validates each Experience bullet / Summary sentence independently so one
 * correct target-language unit cannot hide a foreign-language unit.
 *
 * Proper nouns and technical tokens are exempted; complete foreign clauses are not.
 */
import type { Locale } from './i18n/translations';
import { splitExperienceBullets } from './cv-canonical-facts';
import { isWrongLanguageAiOutput } from './cv-ai-locale-guard';
import { splitJapaneseSummaryUnits } from './cv-japanese-summary-grounding';
import { splitItalianSummaryUnits } from './cv-italian-summary-grounding';
import { CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION } from './cv-material-duty-coverage';
import { analyzeSerbianCroatianLocaleEvidence } from './cv-serbian-summary-grounding';

void CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION;

export type AiContentScript =
  | 'latin'
  | 'latin_diacritic_sc'
  | 'cyrillic'
  | 'devanagari'
  | 'arabic'
  | 'cjk'
  | 'mixed'
  | 'unknown';

export type UnitLocalePurityHit = {
  index: number;
  textPreviewHash: string;
  detectedLocale: string | null;
  detectedScript: AiContentScript;
  wrongLocale: boolean;
  wrongScript: boolean;
  mixedLanguage: boolean;
};

export type UnitLocalePurityResult = {
  ok: boolean;
  unitCount: number;
  detectedLocaleByUnit: Array<string | null>;
  detectedScriptByUnit: AiContentScript[];
  wrongLocaleUnitCount: number;
  wrongScriptUnitCount: number;
  mixedLanguageUnitCount: number;
  sourceLanguageLeakageDetected: boolean;
  /** Confirmed foreign/source locale evidence that participates in purity. */
  unexpectedLocaleCodes: string[];
  /** Same-script detector guesses without enough evidence to fail purity. */
  ambiguousLocaleCodes?: string[];
  targetLocalePurityPassed: boolean;
  units: UnitLocalePurityHit[];
  reason?: string;
  croatianExclusiveCueCount?: number;
  serbianExclusiveCueCount?: number;
  croatianLocaleEvidencePassed?: boolean;
  serbianLeakageDetected?: boolean;
};

/** Approved neutral / technical tokens that must not trigger mixed-language. */
const NEUTRAL_TECH_TOKEN_RE =
  /\b(?:SQL|Python|Java(?:Script)?|TypeScript|REST|API|APIs|SDK|UI|UX|CRM|ERP|Agile|Scrum|Kanban|HTML|CSS|AWS|Azure|GCP|Git|Linux|Docker|Kubernetes|Excel|Word|PowerPoint|Figma|Photoshop|Illustrator|Jira|Confluence|SAP|Oracle|MySQL|PostgreSQL|MongoDB|React|Angular|Vue|Node\.?js|CI\/CD|SEO|KPI|OKR|PDF|DOCX)\b/giu;

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s]+/gi;
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;

const DEVANAGARI = /[\u0900-\u097F]/u;
const ARABIC = /[\u0600-\u06FF]/u;
const CJK = /[\u3040-\u30FF\u3400-\u9FFF]/u;
const CYRILLIC = /[\u0400-\u04FF]/u;
const SC_DIACRITIC = /[čćžšđČĆŽŠĐ]/u;
const LATIN_LETTER = /[A-Za-zÀ-ÖØ-öø-ÿ]/u;

/** Serbian-preferred forms that must not dominate under requested locale `hr`. */
const SERBIAN_EXCLUSIVE_CUE_RE =
  /(?:\bprover(?:a|u|ava|avala|avao|avati)\b|\btačnost\w*\b|\bkoordinisa(?:la|o|ti)\b|\brazmen(?:a|u|e)\b|\bdodeljen\w*\b|\bradnog\s+mesta\b|\bradno\s+mesto\b|\bmagacin\w*\b|\bjanuar(?:a|u)?\b|\bkompanij\w*\b|\bsarađ(?:uje|iv)\w*\b|\bsa\s+kolegama\b|\bpremeštanj\w*\b)/iu;

/** Croatian-preferred forms for positive evidence under `hr`. */
const CROATIAN_EXCLUSIVE_CUE_RE =
  /(?:\bprovjer(?:a|u|ava|avala|avao|avati)\b|\btočnost\w*\b|\bkoordinira(?:la|o|ti)?\b|\brazmjen(?:a|u|e)\b|\bdodijeljen\w*\b|\bradnog\s+mjesta\b|\bradno\s+mjesto\b|\bskladišt\w*\b|\bsiječn(?:jaj|ja|ju)?\b|\btvrtk\w*\b|\bsurađ\w*\b|\bs\s+kolegama\b|\bprilagođav\w*\b|\bzaprimljen\w*\b|\bpremještanj\w*\b|\bkolegicama\b|\bprateć\w*\b|\bpopratn\w*\b)/iu;

export type CroatianSerbianLocaleEvidence = {
  croatianExclusiveCueCount: number;
  serbianExclusiveCueCount: number;
  croatianLocaleEvidencePassed: boolean;
  serbianLeakageDetected: boolean;
  croatianSerbianLocaleDiscriminationRevision: typeof CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION;
};

export function analyzeCroatianSerbianLocaleEvidence(text: string): CroatianSerbianLocaleEvidence {
  void CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION;
  const t = text || '';
  const croatianExclusiveCueCount = (t.match(new RegExp(CROATIAN_EXCLUSIVE_CUE_RE.source, 'giu')) || []).length;
  const serbianExclusiveCueCount = (t.match(new RegExp(SERBIAN_EXCLUSIVE_CUE_RE.source, 'giu')) || []).length;
  const serbianLeakageDetected = serbianExclusiveCueCount > 0
    && serbianExclusiveCueCount >= croatianExclusiveCueCount;
  const croatianLocaleEvidencePassed = !serbianLeakageDetected
    && (croatianExclusiveCueCount > 0 || !SERBIAN_EXCLUSIVE_CUE_RE.test(t));
  return {
    croatianExclusiveCueCount,
    serbianExclusiveCueCount,
    croatianLocaleEvidencePassed,
    serbianLeakageDetected,
    croatianSerbianLocaleDiscriminationRevision: CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION,
  };
}

/** Distinctive English function-word clauses (complete foreign sentence cue). */
const EN_CLAUSE_RE =
  /\b(?:the|and|with|for|from|that|this|these|those|was|were|are|is|been|being|have|has|had|will|would|should|could|created|reviewed|updated|coordinated|delivered|developed|prepared|maintained|ensured|supported|managed|worked|using|across|during|within)\b/iu;

/** Distinctive Serbian/Croatian clause cues (short words are exact; stems allow endings). */
const SR_CLAUSE_RE =
  /\b(?:(?:je|su|sam|si|smo|ste|sa|za|od|do|na|u|koji|koja|koje|te|ili|da|kako|oko)\b|(?:radi|prilikom|tokom|približno|godin|iskustv|proverav|ažurir|azurir|koordin|kreiral|sarađiv|saradiv|pripremal|isporučiv|isporuciv|robu|skladišt)\w*)/iu;

// First-person Professional Summary cues (Ich/verfüge/Derzeit/…) — avoid bare
// `als`/`wo`, which false-hit other Latin locales under JS `\b` edge cases.
const DE_CLAUSE_RE = /\b(?:und|der|die|das|mit|für|von|bei|wurde|wurden|eine|einen|einem|einer|während|sowie|ich|über|insgesamt|Jahre|Berufserfahrung|verfüge|arbeite|arbeitete|Derzeit|Zuvor)\b/iu;
/**
 * Spanish clause cues. Prefer exclusive forms over shared articles (`la`/`una`)
 * that also appear in French — shared articles alone + Latin accents must not
 * classify French text as Spanish (AAB-333: `la` + `é` in "ses collègues…la
 * préparation" false-hit `es` before French ran).
 */
const ES_EXCLUSIVE_CLAUSE_RE =
  /(?<![\p{L}\p{N}_])(?:el|los|las|con|para|por|unos|durante|seg[uú]n|tambi[eé]n|revisa|revis[oó]|comprueba|comprob[oó]|coordina|coordin[oó]|mercanc[ií]a|documentaci[oó]n|compa[nñ]er\w*)(?![\p{L}\p{N}_])/iu;
const ES_SHARED_ARTICLE_RE = /(?<![\p{L}\p{N}_])(?:la|una)(?![\p{L}\p{N}_])/iu;
/** Spanish-exclusive orthography — not French acute `é` alone. */
const ES_EXCLUSIVE_MARK_RE = /[ñ¿¡]/u;
const ES_CLAUSE_RE = /\b(?:el|la|los|las|con|para|por|una|unos|durante|según|también)\b/iu;
/**
 * French exclusive cues. Includes warehouse CV verbs so target-locale French
 * bullets classify as `fr` even when a shared article (`la`) is present.
 */
const FR_EXCLUSIVE_CLAUSE_RE =
  /(?<![\p{L}\p{N}_])(?:le|les|des|avec|pour|dans|pendant|[eé]galement|ainsi|contr[oô]le|contr[oô]l[eé]|v[eé]rifie|v[eé]rifi[eé]|coordonne|coordonn[eé]|marchandises?|coll[eè]gues?|entrep[oô]t|préparation|déplacement)(?![\p{L}\p{N}_])/iu;
const FR_CLAUSE_RE = /\b(?:le|la|les|des|une|avec|pour|dans|pendant|également|ainsi)\b/iu;
const FR_ACCENT_RE = /[àâçéèêëïîôùûüÿœ]/iu;
/**
 * Italian exclusive warehouse / CV cues. Prefer over shared Romance articles
 * (`la`/`una`) that also appear in French and Spanish.
 */
const IT_EXCLUSIVE_CLAUSE_RE =
  /(?<![\p{L}\p{N}_])(?:il|lo|gli|nel|delle|dei|controlla|controllato|controllo|verifica|verificato|verifico|documentazione|magazzino|colleghi|movimentazione|merci|compiti|assegnati|esigenze|ruolo|pazienti|informazioni|farmaceutiche|richieste|aggiorna|schermi|gestisce|dispongo|complessivamente|esperienza\s+professionale|attualmente|lavoro|precedenza|presso)(?![\p{L}\p{N}_])/iu;
const IT_CLAUSE_RE = /\b(?:il|lo|la|gli|con|per|durante|anche|nonché|nel|delle)\b/iu;
const IT_ACCENT_RE = /[àèéìòù]/iu;
/**
 * Brazilian Portuguese exclusive warehouse / CV cues. Prefer over:
 * - Italian bare `verifica` (shared Romance cognate)
 * - German article `das` colliding with Portuguese contraction `das`
 */
const PT_EXCLUSIVE_CLAUSE_RE =
  /(?<![\p{L}\p{N}_])(?:mercadorias?|armaz[eé]m|documenta[cç][aã]o|recebidas|colegas|prepara[cç][aã]o|movimenta[cç][aã]o|confere|conferiu|chegam|atualiza|solicita[cç][oõ]es|farmacêutic\w*|atendimento|disponíveis|alinha|às|aos|atualmente|trabalho|trabalhei|tenho|anteriormente|cozinheir[ao]|funcion[aá]ri[ao]|experi[eê]ncia\s+profissional|no\s+total)(?![\p{L}\p{N}_])/iu;
const PT_CLAUSE_RE = /\b(?:o|os|as|uma|com|para|durante|também|através|às|aos|como|onde)\b/iu;
const PT_ACCENT_RE = /[áàâãéêíóôõúç]/iu;

/** Unicode-aware whole-token match — short cues must not hit inside longer words. */
export function tokenHasExactCue(text: string, cue: string): boolean {
  const escaped = cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu');
  return re.test(text || '');
}

function spanishEvidenceScore(text: string): number {
  const t = text || '';
  let score = 0;
  if (ES_EXCLUSIVE_CLAUSE_RE.test(t)) score += 2;
  if (ES_EXCLUSIVE_MARK_RE.test(t)) score += 2;
  if (ES_SHARED_ARTICLE_RE.test(t)) score += 1;
  return score;
}

function frenchEvidenceScore(text: string): number {
  const t = text || '';
  let score = 0;
  if (FR_EXCLUSIVE_CLAUSE_RE.test(t)) score += 2;
  if (FR_ACCENT_RE.test(t)) score += 1;
  if (FR_CLAUSE_RE.test(t)) score += 1;
  return score;
}

function italianEvidenceScore(text: string): number {
  const t = text || '';
  let score = 0;
  if (IT_EXCLUSIVE_CLAUSE_RE.test(t)) score += 2;
  if (IT_ACCENT_RE.test(t)) score += 1;
  if (IT_CLAUSE_RE.test(t)) score += 1;
  return score;
}

function portugueseEvidenceScore(text: string): number {
  const t = text || '';
  let score = 0;
  if (PT_EXCLUSIVE_CLAUSE_RE.test(t)) score += 3;
  if (PT_ACCENT_RE.test(t)) score += 1;
  if (PT_CLAUSE_RE.test(t)) score += 1;
  return score;
}

function looksConfidentSpanish(text: string): boolean {
  const t = text || '';
  if (ES_EXCLUSIVE_MARK_RE.test(t) && (ES_EXCLUSIVE_CLAUSE_RE.test(t) || ES_SHARED_ARTICLE_RE.test(t))) {
    return true;
  }
  if (ES_EXCLUSIVE_CLAUSE_RE.test(t)) return true;
  // Shared article alone is never enough — need a second exclusive Spanish cue.
  return false;
}

function looksConfidentFrench(text: string): boolean {
  const t = text || '';
  if (FR_EXCLUSIVE_CLAUSE_RE.test(t)) return true;
  if (FR_CLAUSE_RE.test(t) && FR_ACCENT_RE.test(t) && !ES_EXCLUSIVE_CLAUSE_RE.test(t)) {
    return true;
  }
  return false;
}

function looksConfidentItalian(text: string): boolean {
  const t = text || '';
  if (IT_EXCLUSIVE_CLAUSE_RE.test(t) && !PT_EXCLUSIVE_CLAUSE_RE.test(t)) return true;
  if (IT_CLAUSE_RE.test(t) && IT_ACCENT_RE.test(t) && !PT_EXCLUSIVE_CLAUSE_RE.test(t)) {
    return true;
  }
  return false;
}

function looksConfidentPortuguese(text: string): boolean {
  const t = text || '';
  if (PT_EXCLUSIVE_CLAUSE_RE.test(t)) return true;
  if (PT_CLAUSE_RE.test(t) && PT_ACCENT_RE.test(t) && !IT_EXCLUSIVE_CLAUSE_RE.test(t)) {
    return true;
  }
  return false;
}

function fingerprintPreview(text: string): string {
  const t = (text || '').trim().slice(0, 48);
  let h = 0;
  for (let i = 0; i < t.length; i += 1) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
  return `u${(h >>> 0).toString(16)}`;
}

/** Strip neutrals so they do not skew language detection. */
export function stripNeutralAiTokens(text: string): string {
  return (text || '')
    .replace(EMAIL_RE, ' ')
    .replace(URL_RE, ' ')
    .replace(PHONE_RE, ' ')
    .replace(NEUTRAL_TECH_TOKEN_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip Latin proper-noun / brand islands that are not English prose.
 * Company names like "Ztrew" or "Atlas" must not flip Hindi/Arabic/CJK to mixed script.
 * Includes Latin letters with diacritics (Serbian/French domain phrases embedded in HI/AR/JA).
 */
export function stripLatinProperNounIslands(text: string): string {
  const t = stripNeutralAiTokens(text);
  if (!t) return '';
  // If the Latin span contains English clause cues, keep it (real foreign prose).
  return t
    .replace(/\b[\p{Script=Latin}][\p{Script=Latin}0-9.&'’-]{0,48}\b/gu, (tok) => {
      if (EN_CLAUSE_RE.test(tok)) return tok;
      // Latin tokens without English function words ⇒ proper noun / brand / domain label.
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectAiContentScript(text: string): AiContentScript {
  const raw = (text || '').trim();
  // Devanagari + Serbian/Croatian diacritic Latin (e.g. job title injected into Hindi)
  // is mixed prose — do not treat the Latin span as a brand island.
  if (DEVANAGARI.test(raw) && SC_DIACRITIC.test(raw)) {
    return 'mixed';
  }
  if (DEVANAGARI.test(raw) && LATIN_LETTER.test(raw) && SR_CLAUSE_RE.test(raw)) {
    return 'mixed';
  }
  // Prefer script after removing brands/tech so "Hindi + Ztrew" is still Hindi.
  const t = stripLatinProperNounIslands(text) || stripNeutralAiTokens(text);
  // Brand-island stripping of pure Serbian/Croatian Latin often leaves only "." —
  // treat letter-less residue as empty and recover script from the Latin surface.
  const tHasLetters = /[\p{L}\p{N}]/u.test(t || '');
  if (!t || !tHasLetters) {
    // Pure Latin prose (e.g. Serbian/Croatian warehouse bullets) is fully removed by
    // brand-island stripping. Recover Latin / SC-diacritic from the neutral-stripped
    // surface so detectedScriptByBullet is not left as unknown while purity still passes.
    const latinSurface = stripNeutralAiTokens(text);
    if (!latinSurface) return 'unknown';
    const nonLatin = DEVANAGARI.test(latinSurface)
      || ARABIC.test(latinSurface)
      || CJK.test(latinSurface)
      || CYRILLIC.test(latinSurface);
    if (nonLatin) return 'unknown';
    if (SC_DIACRITIC.test(latinSurface) && LATIN_LETTER.test(latinSurface)) {
      return 'latin_diacritic_sc';
    }
    if (LATIN_LETTER.test(latinSurface)) return 'latin';
    return 'unknown';
  }
  const hasDev = DEVANAGARI.test(t);
  const hasAr = ARABIC.test(t);
  const hasCjk = CJK.test(t);
  const hasCyr = CYRILLIC.test(t);
  const hasSc = SC_DIACRITIC.test(t);
  const hasLat = LATIN_LETTER.test(t);
  const nonLatScripts = [hasDev, hasAr, hasCjk, hasCyr].filter(Boolean).length;
  // Real mixed prose requires English (or other Latin) clause cues — not brand islands.
  if (nonLatScripts > 0 && hasLat && EN_CLAUSE_RE.test(t)) {
    return 'mixed';
  }
  if (nonLatScripts > 0 && hasSc && EN_CLAUSE_RE.test(t)) {
    return 'mixed';
  }
  if (hasDev) return 'devanagari';
  if (hasAr) return 'arabic';
  if (hasCjk) return 'cjk';
  if (hasCyr) return 'cyrillic';
  if (hasSc) return 'latin_diacritic_sc';
  if (hasLat) return 'latin';
  return 'unknown';
}

function expectedScriptsForLocale(locale: Locale): AiContentScript[] {
  switch (locale) {
    case 'hi':
      return ['devanagari'];
    case 'ar':
      return ['arabic'];
    case 'ja':
      return ['cjk'];
    case 'ru':
      return ['cyrillic'];
    case 'sr':
      return ['latin', 'latin_diacritic_sc', 'cyrillic'];
    case 'hr':
      return ['latin', 'latin_diacritic_sc'];
    default:
      return ['latin'];
  }
}

/**
 * Authoritative target-script mapping for diagnostics and validation.
 * Never returns null for a supported locale.
 */
export function resolveTargetScriptForLocale(locale: Locale): AiContentScript {
  switch (locale) {
    case 'hi':
      return 'devanagari';
    case 'ar':
      return 'arabic';
    case 'ja':
      return 'cjk';
    case 'ru':
      return 'cyrillic';
    case 'sr':
    case 'hr':
      // Serbian/Croatian default export script is Latin; Cyrillic is also valid for sr.
      return 'latin';
    default:
      return 'latin';
  }
}

/** Distinctive Marathi morphology / lexicon (not typical Hindi CV bullets). */
const MARATHI_SIGNAL_RE =
  /(?:आहे|होते|करतो|केले|केली|त्यांना|त्यांनी|आम्ही|तुम्ही|मराठी|पुणे)/u;

/** Distinctive Nepali morphology / lexicon (not typical Hindi CV bullets). */
const NEPALI_SIGNAL_RE =
  /(?:छन्|थियो|गरेको|गरिन्|हुन्छ|नेपाली|काठमाडौं|गर्छिन्|राख्छिन्|गर्छ(?:िन्)?)/u;

/** Soft Hindi CV morphology (finite verb / CV phrasing — not shared nouns). */
const HINDI_CV_SIGNAL_RE =
  /(?:करती\s*है|करता\s*है|सुनिश्चित\s*कर|व्यवस्थित\s*रख|समन्वय\s*कर|कर\s*रही\s*हूँ|कर\s*रहा\s*हूँ|अद्यतन\s*कर)/u;

/** Shared Devanagari CV nouns (Hindi/Marathi/Nepali) — not language-decisive alone. */
const DEVANAGARI_SHARED_CV_NOUN_RE =
  /(?:गोदाम|माल|सामान|रिकॉर्ड|दस्तावे|जाँच|समन्वय|तैयारी)/u;

/**
 * Soft locale guess for a single unit (not authoritative for proper nouns alone).
 * Devanagari: prefer Hindi when requested provenance is hi and Marathi/Nepali
 * signals are absent; do not reject short Hindi CV bullets for lacking a tiny lexicon.
 */
export function guessUnitLocale(text: string, targetLocale?: Locale): string | null {
  const t = stripNeutralAiTokens(text);
  if (!t || t.length < 8) return null;
  if (DEVANAGARI.test(t)) {
    const hasHiMorph = HINDI_CV_SIGNAL_RE.test(t);
    const hasMr = MARATHI_SIGNAL_RE.test(t);
    const hasNe = NEPALI_SIGNAL_RE.test(t);
    // Clear Marathi/Nepali morphology wins over shared warehouse nouns.
    if (hasMr && !hasHiMorph) return 'mr';
    if (hasNe && !hasHiMorph) return 'ne';
    if (hasHiMorph || targetLocale === 'hi' || DEVANAGARI_SHARED_CV_NOUN_RE.test(t) || (!hasMr && !hasNe)) {
      return 'hi';
    }
    return 'hi';
  }
  if (ARABIC.test(t)) return 'ar';
  if (CJK.test(t)) return 'ja';
  // Cyrillic: Serbian-specific letters win; otherwise Russian CV morphology /
  // target-locale context. Never classify Russian bullets as Serbian merely
  // because they share stems like координ/припрем/статус with Serbian.
  if (CYRILLIC.test(t)) {
    const hasSrLetters = /[јљњћђџЈЉЊЋЂЏ]/u.test(t);
    const hasRuLetters = /[ёыэъщЁЫЭЪЩ]/u.test(t);
    const hasRuCv =
      /(?:проверя|обновл|поддержива|координир|согласов|созда[её]|адаптир|подготавли|подготов|поступающ|сопроводительн|складск|товар|документ|запис|файл|экран|визуальн|графическ|дизайн|работал|работала|выполнял|имеет\s+опыт|кладовщ|обеспечивая|размещен|перемещен|учёт|учет)/iu.test(t);
    const hasSrDistinct =
      /(?:преглед|ажурир|извешта|одељен|евиденц|пристигл|означав|непотпун|заједнич|сарађ)/iu.test(t);
    if (hasSrLetters && !hasRuLetters && !hasRuCv) return 'sr';
    if (hasRuLetters || hasRuCv || targetLocale === 'ru') return 'ru';
    if (hasSrDistinct) return 'sr';
    return 'ru';
  }
  // Prefer SC diacritics / clear stems over short function words (which false-hit English).
  // Avoid international stems like "koordin" (German Koordinierte, French coordonne).
  if (
    SC_DIACRITIC.test(t)
    || /(?:proverav|provjerav|ažurir|azurir|kreiral|sarađiv|surađiv|saradiv|pripremal|isporuč|isporuc|skladišt|godin\w*\s+iskustv)/iu.test(t)
  ) {
    const hrEvidence = analyzeCroatianSerbianLocaleEvidence(t);
    if (targetLocale === 'hr') {
      if (hrEvidence.serbianLeakageDetected) return 'sr';
      if (hrEvidence.croatianExclusiveCueCount > 0) return 'hr';
      return 'hr';
    }
    if (targetLocale === 'sr') {
      if (hrEvidence.croatianExclusiveCueCount > hrEvidence.serbianExclusiveCueCount
        && hrEvidence.croatianExclusiveCueCount > 0
        && hrEvidence.serbianExclusiveCueCount === 0) {
        return 'hr';
      }
      return 'sr';
    }
    if (hrEvidence.serbianExclusiveCueCount > hrEvidence.croatianExclusiveCueCount) return 'sr';
    if (hrEvidence.croatianExclusiveCueCount > 0) return 'hr';
    return 'sr';
  }
  if (DE_CLAUSE_RE.test(t) && !EN_CLAUSE_RE.test(t) && !looksConfidentPortuguese(t) && !PT_EXCLUSIVE_CLAUSE_RE.test(t)) {
    return 'de';
  }
  // AAB-333 — classify French before Spanish. Shared `la` + French `é` must not
  // return `es` (false positive on "…avec ses collègues la préparation…").
  // AAB-334 — Italian exclusive warehouse cues before ambiguous Romance.
  // AAB-335 — Brazilian Portuguese warehouse cues before Italian `verifica` and
  // German `das` collisions.
  const frScore = frenchEvidenceScore(t);
  const esScore = spanishEvidenceScore(t);
  const itScore = italianEvidenceScore(t);
  const ptScore = portugueseEvidenceScore(t);
  if (looksConfidentPortuguese(t) && (targetLocale === 'pt-BR' || ptScore >= itScore && ptScore >= frScore && ptScore >= esScore)) {
    return 'pt-BR';
  }
  if (looksConfidentItalian(t) && (targetLocale === 'it' || itScore >= frScore && itScore >= esScore && itScore > ptScore)) {
    return 'it';
  }
  if (looksConfidentFrench(t) && (targetLocale === 'fr' || frScore >= esScore)) {
    return 'fr';
  }
  if (looksConfidentSpanish(t) && esScore > frScore && esScore > itScore && esScore > ptScore) {
    return 'es';
  }
  if (looksConfidentPortuguese(t)) return 'pt-BR';
  if (looksConfidentItalian(t)) return 'it';
  if (looksConfidentFrench(t)) return 'fr';
  if (looksConfidentSpanish(t)) return 'es';
  // Ambiguous shared-article Latin: prefer target when it matches, else unknown.
  if (targetLocale === 'pt-BR' && (PT_CLAUSE_RE.test(t) || PT_ACCENT_RE.test(t) || PT_EXCLUSIVE_CLAUSE_RE.test(t))) {
    return 'pt-BR';
  }
  if (targetLocale === 'it' && (IT_CLAUSE_RE.test(t) || IT_ACCENT_RE.test(t) || IT_EXCLUSIVE_CLAUSE_RE.test(t))) {
    return 'it';
  }
  if (targetLocale === 'fr' && (FR_CLAUSE_RE.test(t) || FR_ACCENT_RE.test(t))) return 'fr';
  if (targetLocale === 'es' && (ES_CLAUSE_RE.test(t) || ES_EXCLUSIVE_MARK_RE.test(t) || /[áéíóú]/iu.test(t))) {
    return 'es';
  }
  if (IT_CLAUSE_RE.test(t) && /[àèéìòù]/iu.test(t) && !PT_EXCLUSIVE_CLAUSE_RE.test(t)) return 'it';
  if (PT_CLAUSE_RE.test(t) && PT_ACCENT_RE.test(t)) return 'pt-BR';
  if (EN_CLAUSE_RE.test(t)) return 'en';
  // Soft SR: several exact function words without English clause cues.
  // Never classify Brazilian Portuguese first-person CV prose as Serbian merely
  // because shared short prepositions (`na`/`u`) appear.
  if (
    SR_CLAUSE_RE.test(t)
    && !EN_CLAUSE_RE.test(t)
    && !DE_CLAUSE_RE.test(t)
    && !(targetLocale === 'pt-BR' && (
      PT_EXCLUSIVE_CLAUSE_RE.test(t)
      || looksConfidentPortuguese(t)
      || /\b(?:atualmente|trabalho|tenho|cozinheir)/iu.test(t)
    ))
  ) {
    const hrEvidence = analyzeCroatianSerbianLocaleEvidence(t);
    if (targetLocale === 'hr' && !hrEvidence.serbianLeakageDetected) return 'hr';
    if (targetLocale === 'sr') {
      if (
        hrEvidence.croatianExclusiveCueCount > 0
        && hrEvidence.serbianExclusiveCueCount === 0
      ) return 'hr';
      return 'sr';
    }
    return 'sr';
  }
  return null;
}

function unitLooksMixedLanguage(text: string, target: Locale): boolean {
  const t = stripNeutralAiTokens(text);
  if (!t) return false;
  const hasEn = EN_CLAUSE_RE.test(t);
  const hasSrDiacritic = SC_DIACRITIC.test(t);
  const hasSrClause = SR_CLAUSE_RE.test(t);
  // Require diacritics or a clear SR stem — not short words alone — before
  // calling English+Latin text "mixed".
  const hasSr = hasSrDiacritic || (hasSrClause && /(?:proverav|ažurir|koordin|kreiral|sarađiv|pripremal|isporuč|robu|skladišt|godin|iskustv)/iu.test(t));
  if ((target === 'sr' || target === 'hr') && hasEn && hasSr) return true;
  if (target === 'en' && hasSrDiacritic) return true;
  if (target === 'en' && hasSr && hasEn) return true;
  if (detectAiContentScript(t) === 'mixed') return true;
  return false;
}

function unitWrongLocale(text: string, target: Locale): boolean {
  if (isWrongLanguageAiOutput(text, target)) return true;
  const stripped = stripNeutralAiTokens(text);
  const guessed = guessUnitLocale(text, target);
  if (!guessed) return false;

  if (target === 'hi') {
    // Clear Marathi/Nepali prose under Hindi target.
    if (guessed === 'mr' || guessed === 'ne') return true;
    if (guessed === 'hi') return false;
    if (guessed === 'sr' || guessed === 'hr' || guessed === 'en') return true;
    if (['ar', 'ja', 'ru', 'de', 'es', 'fr', 'it', 'pt-BR'].includes(guessed)) return true;
    return false;
  }

  if (target === 'hr') {
    const evidence = analyzeCroatianSerbianLocaleEvidence(text);
    if (evidence.serbianLeakageDetected) return true;
    if (guessed === 'sr') return true;
    if (
      guessed === 'en'
      && EN_CLAUSE_RE.test(stripped)
      && !SC_DIACRITIC.test(text)
      && !SR_CLAUSE_RE.test(stripped)
      && !CROATIAN_EXCLUSIVE_CUE_RE.test(stripped)
    ) {
      return true;
    }
    if (guessed === 'en' && EN_CLAUSE_RE.test(stripped)) return true;
    if (guessed === 'ru' && CYRILLIC.test(text)) return true;
    if (['hi', 'ar', 'ja', 'de', 'es', 'fr', 'it', 'pt-BR', 'ru'].includes(guessed)) return true;
    if (guessed === 'hr') return false;
    return false;
  }

  if (target === 'sr') {
    const evidence = analyzeSerbianCroatianLocaleEvidence(text);
    if (evidence.croatianLeakageDetected) return true;
    // Complete English prose under Serbian target.
    if (
      guessed === 'en'
      && EN_CLAUSE_RE.test(stripped)
      && !SC_DIACRITIC.test(text)
      && !SR_CLAUSE_RE.test(stripped)
    ) {
      return true;
    }
    if (guessed === 'en' && EN_CLAUSE_RE.test(stripped)) return true;
    // Serbian Cyrillic is a valid sr script mode — never treat as Russian leakage.
    if (guessed === 'ru' && CYRILLIC.test(text)) return false;
    if (['hi', 'ar', 'ja', 'de', 'es', 'fr', 'it', 'pt-BR'].includes(guessed)) return true;
    if (guessed === 'ru') return true;
    if (guessed === 'hr' && evidence.croatianLeakageDetected) return true;
    return false;
  }

  if (target === 'en') {
    if (guessed === 'sr' || guessed === 'hr') return true;
    if (['hi', 'ar', 'ja', 'ru'].includes(guessed)) return true;
    // AAB-325: Spanish units are wrong under English target.
    if (guessed === 'es') return true;
    if (guessed === 'de' || guessed === 'fr' || guessed === 'it' || guessed === 'pt-BR') {
      return true;
    }
    return false;
  }

  if (target === 'ru') {
    // Accept Russian; reject clear Serbian Cyrillic letters / Latin SC prose.
    if (guessed === 'ru') return false;
    if (guessed === 'sr' || guessed === 'hr') {
      if (/[јљњћђџЈЉЊЋЂЏ]/u.test(text)) return true;
      if (SC_DIACRITIC.test(text) && !CYRILLIC.test(text)) return true;
      // Soft SR guess from shared stems under Russian target is not a reject.
      return false;
    }
    if (guessed === 'en' && EN_CLAUSE_RE.test(stripped) && !CYRILLIC.test(text)) return true;
    if (['hi', 'ar', 'ja'].includes(guessed)) return true;
    return false;
  }

  if (target === 'ja') {
    if (guessed === 'ja') return false;
    // Full Russian or English clauses must never pass under Japanese.
    if (CYRILLIC.test(text)) return true;
    if (guessed === 'en' && EN_CLAUSE_RE.test(stripped)) return true;
    if (guessed === 'ru' || guessed === 'hi' || guessed === 'ar') return true;
    if (guessed === 'sr' || guessed === 'hr') return true;
    return false;
  }

  if (guessed === 'sr' || guessed === 'hr') return true;
  if (['hi', 'ar', 'ja', 'ru'].includes(guessed) && !['hi', 'ar', 'ja', 'ru'].includes(target)) {
    return true;
  }
  if (
    guessed === 'en'
    && EN_CLAUSE_RE.test(stripped)
    && (target === 'de' || target === 'es' || target === 'fr' || target === 'it' || target === 'pt-BR')
  ) {
    const targetCue =
      (target === 'de' && DE_CLAUSE_RE.test(text))
      || (target === 'es' && ES_CLAUSE_RE.test(text))
      || (target === 'fr' && FR_CLAUSE_RE.test(text))
      || (target === 'it' && IT_CLAUSE_RE.test(text))
      || (target === 'pt-BR' && PT_CLAUSE_RE.test(text));
    if (!targetCue) return true;
    return false;
  }
  // Sibling Latin locales: reject foreign-language units.
  // Script agreement (latin) is not locale agreement (de ≠ fr ≠ es ≠ it ≠ pt-BR).
  if (
    target === 'de' || target === 'es' || target === 'fr' || target === 'it' || target === 'pt-BR'
  ) {
    if (!guessed || guessed === target) return false;
    // Confident German under any Romance target (and vice versa) is always wrong.
    if (guessed === 'de' && (DE_CLAUSE_RE.test(text) || /\b(?:ich|derzeit|arbeite|prüfe|waren)\b/iu.test(text))) {
      return true;
    }
    if (target === 'de' && guessed === 'fr' && looksConfidentFrench(text)) return true;
    if (target === 'de' && guessed === 'es' && looksConfidentSpanish(text)) return true;
    if (target === 'fr' && guessed === 'es' && looksConfidentSpanish(text) && !looksConfidentFrench(text)) {
      return true;
    }
    if (target === 'fr' && guessed === 'en' && EN_CLAUSE_RE.test(stripped) && !looksConfidentFrench(text)) {
      return true;
    }
    if (target === 'es' && guessed === 'fr' && looksConfidentFrench(text) && !looksConfidentSpanish(text)) {
      return true;
    }
    if ((target === 'it' || target === 'pt-BR') && guessed === 'de' && DE_CLAUSE_RE.test(text)) {
      return true;
    }
    if ((target === 'it' || target === 'pt-BR') && guessed === 'fr' && looksConfidentFrench(text)) {
      return true;
    }
    if (target === 'it' && guessed === 'pt-BR' && looksConfidentPortuguese(text) && !looksConfidentItalian(text)) {
      return true;
    }
    if (target === 'pt-BR' && guessed === 'it' && looksConfidentItalian(text) && !looksConfidentPortuguese(text)) {
      return true;
    }
    return false;
  }
  return false;
}

function unitWrongScript(
  text: string,
  target: Locale,
  options?: { requiredScript?: AiContentScript | null },
): boolean {
  const script = detectAiContentScript(text);
  if (script === 'unknown') return false;
  if (options?.requiredScript) {
    if (options.requiredScript === 'latin' || options.requiredScript === 'latin_diacritic_sc') {
      return script !== 'latin' && script !== 'latin_diacritic_sc';
    }
    return script !== options.requiredScript;
  }
  const allowed = expectedScriptsForLocale(target);
  if (script === 'mixed') return true;
  return !allowed.includes(script);
}

export function splitAiSemanticUnits(
  text: string,
  kind: 'experience_bullet' | 'summary_sentence' | 'cover_letter_paragraph' = 'experience_bullet',
): string[] {
  const raw = (text || '').trim();
  if (!raw) return [];
  if (kind === 'experience_bullet') {
    return splitExperienceBullets(raw).map((b) => b.trim()).filter(Boolean);
  }
  if (kind === 'cover_letter_paragraph') {
    return raw.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
  }
  // Japanese Summary does not use spaces — split on 。！？.
  if (/[。！？]/.test(raw) && /[\u3040-\u30FF\u3400-\u9FFF]/.test(raw)) {
    return splitJapaneseSummaryUnits(raw);
  }
  if (
    kind === 'summary_sentence'
    && /\b(?:dispongo|attualmente|in\s+precedenza)\b/iu.test(raw)
    && !/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF]/.test(raw)
  ) {
    return splitItalianSummaryUnits(raw);
  }
  if (/[।]/.test(raw) && /\p{Script=Devanagari}/u.test(raw)) {
    return raw
      .split(/(?<=[।.!?])\s*/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return raw
    .split(/(?<=[.!?।۔])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Validate every semantic unit independently against the requested target locale.
 */
export function validateAiUnitLocalePurity(
  text: string,
  targetLocale: Locale,
  options?: {
    kind?: 'experience_bullet' | 'summary_sentence' | 'cover_letter_paragraph';
    requiredScript?: AiContentScript | null;
    requireUnits?: boolean;
  },
): UnitLocalePurityResult {
  const kind = options?.kind || 'experience_bullet';
  const units = splitAiSemanticUnits(text, kind);
  const hits: UnitLocalePurityHit[] = [];
  let wrongLocaleUnitCount = 0;
  let wrongScriptUnitCount = 0;
  let mixedLanguageUnitCount = 0;
  const unexpected = new Set<string>();
  const ambiguous = new Set<string>();

  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    const detectedLocale = guessUnitLocale(unit, targetLocale);
    const detectedScript = detectAiContentScript(unit);
    const wrongLocale = unitWrongLocale(unit, targetLocale);
    const wrongScript = unitWrongScript(unit, targetLocale, {
      requiredScript: options?.requiredScript,
    });
    const mixedLanguage = unitLooksMixedLanguage(unit, targetLocale);
    if (wrongLocale) wrongLocaleUnitCount += 1;
    if (wrongScript) wrongScriptUnitCount += 1;
    if (mixedLanguage) mixedLanguageUnitCount += 1;
    if (
      detectedLocale
      && detectedLocale !== targetLocale
      && !(targetLocale === 'sr' && detectedLocale === 'hr')
    ) {
      if (wrongLocale || mixedLanguage) unexpected.add(detectedLocale);
      else ambiguous.add(detectedLocale);
    }
    hits.push({
      index: i,
      textPreviewHash: fingerprintPreview(unit),
      detectedLocale,
      detectedScript,
      wrongLocale,
      wrongScript,
      mixedLanguage,
    });
  }

  const hrEvidence = targetLocale === 'hr'
    ? analyzeCroatianSerbianLocaleEvidence(text)
    : null;
  if (hrEvidence?.serbianLeakageDetected) {
    wrongLocaleUnitCount = Math.max(wrongLocaleUnitCount, 1);
  }

  const sourceLanguageLeakageDetected = wrongLocaleUnitCount > 0
    || mixedLanguageUnitCount > 0
    || Boolean(hrEvidence?.serbianLeakageDetected)
    // AAB-325: unexpected Spanish under English is leakage even if a soft guess.
    || (targetLocale === 'en' && unexpected.has('es'))
    // AAB-358: unexpected German under French/Italian/pt-BR is leakage.
    || ((targetLocale === 'fr' || targetLocale === 'it' || targetLocale === 'pt-BR')
      && unexpected.has('de'));
  const targetLocalePurityPassed = units.length === 0
    ? options?.requireUnits === false
    : wrongLocaleUnitCount === 0
      && wrongScriptUnitCount === 0
      && mixedLanguageUnitCount === 0
      && !hrEvidence?.serbianLeakageDetected
      && !(targetLocale === 'en' && unexpected.has('es'))
      && !((targetLocale === 'fr' || targetLocale === 'it' || targetLocale === 'pt-BR')
        && unexpected.has('de'));

  // Ensure wrongLocaleUnitCount reflects unexpected Spanish under English.
  if (targetLocale === 'en' && unexpected.has('es')) {
    wrongLocaleUnitCount = Math.max(wrongLocaleUnitCount, 1);
  }
  if ((targetLocale === 'fr' || targetLocale === 'it' || targetLocale === 'pt-BR') && unexpected.has('de')) {
    const deUnits = hits.filter((h) => h.detectedLocale === 'de').length;
    wrongLocaleUnitCount = Math.max(wrongLocaleUnitCount, deUnits || 1);
  }

  return {
    ok: targetLocalePurityPassed,
    unitCount: units.length,
    detectedLocaleByUnit: hits.map((h) => h.detectedLocale),
    detectedScriptByUnit: hits.map((h) => h.detectedScript),
    wrongLocaleUnitCount,
    wrongScriptUnitCount,
    mixedLanguageUnitCount,
    sourceLanguageLeakageDetected,
    unexpectedLocaleCodes: [...unexpected],
    ambiguousLocaleCodes: [...ambiguous],
    targetLocalePurityPassed,
    units: hits,
    croatianExclusiveCueCount: hrEvidence?.croatianExclusiveCueCount,
    serbianExclusiveCueCount: hrEvidence?.serbianExclusiveCueCount,
    croatianLocaleEvidencePassed: hrEvidence?.croatianLocaleEvidencePassed,
    serbianLeakageDetected: hrEvidence?.serbianLeakageDetected,
    reason: targetLocalePurityPassed
      ? undefined
      : (hrEvidence?.serbianLeakageDetected
        ? 'croatian_serbian_locale_leakage'
        : (wrongLocaleUnitCount > 0
          ? 'wrong_language'
          : (wrongScriptUnitCount > 0 ? 'wrong_script' : 'mixed_language'))),
  };
}

export function experienceBulletsFailTargetLocalePurity(
  description: string,
  locale: Locale,
): boolean {
  return !validateAiUnitLocalePurity(description, locale, {
    kind: 'experience_bullet',
    requireUnits: true,
  }).ok;
}
