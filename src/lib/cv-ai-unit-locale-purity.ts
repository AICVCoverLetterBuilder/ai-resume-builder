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
  unexpectedLocaleCodes: string[];
  targetLocalePurityPassed: boolean;
  units: UnitLocalePurityHit[];
  reason?: string;
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

/** Distinctive English function-word clauses (complete foreign sentence cue). */
const EN_CLAUSE_RE =
  /\b(?:the|and|with|for|from|that|this|these|those|was|were|are|is|been|being|have|has|had|will|would|should|could|created|reviewed|updated|coordinated|delivered|developed|prepared|maintained|ensured|supported|managed|worked|using|across|during|within)\b/iu;

/** Distinctive Serbian/Croatian clause cues (short words are exact; stems allow endings). */
const SR_CLAUSE_RE =
  /\b(?:(?:je|su|sam|si|smo|ste|sa|za|od|do|na|u|koji|koja|koje|te|ili|da|kako|oko)\b|(?:radi|prilikom|tokom|približno|godin|iskustv|proverav|ažurir|azurir|koordin|kreiral|sarađiv|saradiv|pripremal|isporučiv|isporuciv|robu|skladišt)\w*)/iu;

const DE_CLAUSE_RE = /\b(?:und|der|die|das|mit|für|von|bei|wurde|wurden|eine|einen|einem|einer|während|sowie)\b/iu;
const ES_CLAUSE_RE = /\b(?:el|la|los|las|con|para|por|una|unos|durante|según|también)\b/iu;
const FR_CLAUSE_RE = /\b(?:le|la|les|des|une|avec|pour|dans|pendant|également|ainsi)\b/iu;
const IT_CLAUSE_RE = /\b(?:il|lo|la|gli|con|per|durante|anche|nonché)\b/iu;
const PT_CLAUSE_RE = /\b(?:o|os|as|uma|com|para|durante|também|através)\b/iu;

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
  if (!t) return 'unknown';
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
    case 'hr':
      return ['latin', 'latin_diacritic_sc', 'cyrillic'];
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
      // Serbian/Croatian default export script is Latin; Cyrillic is also valid.
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
  // Cyrillic: prefer Serbian when SC morphology is present; otherwise Russian.
  if (CYRILLIC.test(t)) {
    if (
      /(?:преглед|ажурир|координ|извешта|одељен|евиденц|пристигл|означав|непотпун|заједнич|статус|информац|сарађ|припрем|креир|искуств|годин)/iu.test(t)
    ) {
      return 'sr';
    }
    return 'ru';
  }
  // Prefer SC diacritics / clear stems over short function words (which false-hit English).
  // Avoid international stems like "koordin" (German Koordinierte, French coordonne).
  if (
    SC_DIACRITIC.test(t)
    || /(?:proverav|ažurir|azurir|kreiral|sarađiv|saradiv|pripremal|isporuč|isporuc|skladišt|godin\w*\s+iskustv)/iu.test(t)
  ) {
    return 'sr';
  }
  if (DE_CLAUSE_RE.test(t) && !EN_CLAUSE_RE.test(t)) return 'de';
  if (ES_CLAUSE_RE.test(t) && /[áéíóúñ¿¡]/iu.test(t)) return 'es';
  if (FR_CLAUSE_RE.test(t) && /[àâçéèêëïîôùûüÿœ]/iu.test(t)) return 'fr';
  if (IT_CLAUSE_RE.test(t) && /[àèéìòù]/iu.test(t)) return 'it';
  if (PT_CLAUSE_RE.test(t) && /[áàâãéêíóôõúç]/iu.test(t)) return 'pt-BR';
  if (EN_CLAUSE_RE.test(t)) return 'en';
  // Soft SR: several exact function words without English clause cues.
  if (SR_CLAUSE_RE.test(t) && !EN_CLAUSE_RE.test(t) && !DE_CLAUSE_RE.test(t)) return 'sr';
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

  if (target === 'sr' || target === 'hr') {
    // Complete English prose under Serbian/Croatian target.
    if (
      guessed === 'en'
      && EN_CLAUSE_RE.test(stripped)
      && !SC_DIACRITIC.test(text)
      && !SR_CLAUSE_RE.test(stripped)
    ) {
      return true;
    }
    if (guessed === 'en' && EN_CLAUSE_RE.test(stripped)) return true;
    // Serbian Cyrillic is a valid sr/hr script mode — never treat as Russian leakage.
    if (guessed === 'ru' && CYRILLIC.test(text)) return false;
    if (['hi', 'ar', 'ja', 'de', 'es', 'fr', 'it', 'pt-BR'].includes(guessed)) return true;
    if (guessed === 'ru') return true;
    return false;
  }

  if (target === 'en') {
    if (guessed === 'sr' || guessed === 'hr') return true;
    if (['hi', 'ar', 'ja', 'ru'].includes(guessed)) return true;
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
  // Sibling Latin-locale mis-guesses (fr↔es↔de) are not reliable enough to reject.
  if (
    target === 'de' || target === 'es' || target === 'fr' || target === 'it' || target === 'pt-BR'
  ) {
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
      && !(targetLocale === 'hr' && detectedLocale === 'sr')
    ) {
      unexpected.add(detectedLocale);
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

  const sourceLanguageLeakageDetected = wrongLocaleUnitCount > 0 || mixedLanguageUnitCount > 0;
  const targetLocalePurityPassed = units.length === 0
    ? options?.requireUnits === false
    : wrongLocaleUnitCount === 0
      && wrongScriptUnitCount === 0
      && mixedLanguageUnitCount === 0;

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
    targetLocalePurityPassed,
    units: hits,
    reason: targetLocalePurityPassed
      ? undefined
      : (wrongLocaleUnitCount > 0
        ? 'wrong_language'
        : (wrongScriptUnitCount > 0 ? 'wrong_script' : 'mixed_language')),
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
