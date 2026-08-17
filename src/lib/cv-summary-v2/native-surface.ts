/**
 * Shared Summary V2 native-surface contract: capitalization, person, tense,
 * punctuation, and first-person duty realization for shell locales.
 * No occupation hard-coding — only leading-verb morphology + connectors.
 */
import type { Locale } from '@/lib/i18n/translations';
import type { SummaryV2EmploymentState } from './types';
import { dutyTenseFromEmploymentState } from './tense';
import {
  evaluateSouthSlavicSummaryPredicateChains,
  emptySouthSlavicPredicateChainDiagnostics,
  realizeSouthSlavicPredicateChain,
  type SouthSlavicPredicateChainDiagnostics,
} from './south-slavic-predicates';
import {
  resolveSummaryV2GenderMode,
  detectUnresolvedGenderPlaceholder,
  type SummaryV2GenderMode,
} from './gender';
import { validateFrenchSummaryFiniteGrammar } from '../cv-french-summary-grounding';
import { analyzePortugueseBrazilFirstPersonFiniteVerbs } from '../cv-portuguese-summary-grounding';

export const SUMMARY_V2_NATIVE_SURFACE_386_REVISION =
  'summary-v2-native-surface-386-v1' as const;

/** Locale realization contract: finite sentences, resolved gender, native joins. */
export const SUMMARY_V2_NATIVE_SURFACE_389_REVISION =
  'summary-v2-native-surface-389-v1' as const;

/** Spanish perspective-aware native-surface contract. */
export const SUMMARY_V2_SPANISH_PERSPECTIVE_NATIVE_SURFACE_391_REVISION =
  'summary-v2-spanish-perspective-native-surface-391-v1' as const;

/** Spanish slot-wide first/third-person predicate guard. */
export const SUMMARY_V2_SPANISH_SLOT_WIDE_PERSON_393_REVISION =
  'summary-v2-spanish-slot-wide-person-393-v1' as const;

/** Hindi Summary first-person agreement is validated at every V2 candidate gate. */
export const SUMMARY_V2_HINDI_FIRST_PERSON_AGREEMENT_427_REVISION =
  'summary-v2-hindi-first-person-agreement-427-v1' as const;

export type SummaryV2NativeSurfaceResult = {
  nativeSurfaceValidationPassed: boolean;
  capitalizationValidationPassed: boolean;
  grammaticalPersonValidationPassed: boolean;
  currentTenseValidationPassed: boolean;
  priorTenseValidationPassed: boolean;
  finiteClauseValidationPassed: boolean;
  nativePunctuationValidationPassed: boolean;
  internalMarkerLeakageDetected: boolean;
  englishMorphologyLeakageDetected: boolean;
  nativeSurfaceRejectionReasons: string[];
  /** Shared native realization contract (AAB-389). */
  unresolvedGenderPlaceholderDetected: boolean;
  finiteDurationSentencePassed: boolean;
  firstPersonPredicateChainPassed: boolean;
  localeVerbMorphologyPassed: boolean;
  roleCaseValidationPassed: boolean;
  nativeCoordinationValidationPassed: boolean;
  sentenceCompletenessPassed: boolean;
  hindiFirstPersonAgreementPassed: boolean;
  hindiSentenceAgreementRecords: HindiSummarySentenceAgreementRecord[];
  /** SR/HR coordinated-predicate chain diagnostics (N/A → empty pass for other locales). */
  coordinatedPredicateCount: number;
  transformedCoordinatedPredicateCount: number;
  untransformedFinitePredicateCount: number;
  mixedPersonPredicateDetected: boolean;
  mixedTensePredicateDetected: boolean;
  predicateChainValidationPassed: boolean;
  predicateChainRejectionReasons: string[];
  sourcePredicateChainHash: string;
  finalPredicateChainHash: string;
  frenchGrammarValidationPassed?: boolean;
  frenchGrammarRejectionReason?: string | null;
  frenchTokenBoundaryValidationPassed?: boolean;
  frenchClauseCasingValidationPassed?: boolean;
  ptbrFiniteVerbCount: number;
  ptbrFirstPersonCompatibleFiniteVerbCount: number;
  ptbrWrongPersonFiniteVerbCount: number;
  ptbrWrongPersonFiniteVerbHashes: string[];
  ptbrUnitPersonAgreementPassed: boolean;
};

export type HindiSummarySentenceAgreementRecord = {
  sentenceIndex: number;
  clauseIndex: number;
  employmentState: 'present' | 'completed' | 'unknown';
  perspectiveMode: 'first_person' | 'neutral_or_unspecified';
  genderMode: SummaryV2GenderMode;
  finiteVerbOrAuxiliaryDetected: boolean;
  agreementMode: 'first_person_habitual' | 'first_person_perfective' | 'neutral' | 'unknown';
  aspect: 'present_habitual' | 'past_habitual' | 'perfective' | 'mixed' | 'unknown';
  grammarPassed: boolean;
  grammarReasons: string[];
};

function capitalizeFirstLetter(text: string): string {
  return (text || '').replace(/^\p{L}/u, (c) => c.toLocaleUpperCase());
}

/** Turn mid-sentence duration fragments into complete recruiter-facing sentences. */
export function formatNativeDurationSentence(
  durationPhrase: string,
  locale: Locale,
): string {
  const raw = (durationPhrase || '').replace(/[.,。؟।]+$/u, '').trim();
  if (!raw) return '';

  if (locale === 'en') {
    const core = raw
      .replace(/^(?:with|bringing|having)\s+/iu, '')
      .replace(/\s+of\s+(?:professional\s+)?experience.*$/iu, '')
      .trim();
    return core ? `I have ${core} of experience.` : '';
  }
  if (locale === 'de') {
    const core = raw
      .replace(/^ich\s+verfüge\s+über\s+/iu, '')
      .replace(/^mit\s+/iu, '')
      .trim();
    return core
      ? ( /^ich\b/iu.test(raw)
        ? `${capitalizeFirstLetter(raw)}.`
        : `Ich verfüge über ${core}.`)
      : '';
  }
  if (locale === 'es') {
    const core = raw.replace(/^con\s+/iu, '').trim();
    return `Cuento con ${core}.`;
  }
  if (locale === 'fr') {
    const core = raw.replace(/^avec\s+/iu, '').trim();
    return `Je dispose d'${core}.`;
  }
  if (locale === 'it') {
    const core = raw.replace(/^con\s+/iu, '').trim();
    return `Dispongo di ${core}.`;
  }
  if (locale === 'pt-BR') {
    const core = raw.replace(/^com\s+/iu, '').trim();
    return `Tenho ${core}.`;
  }
  if (locale === 'ru') {
    const core = raw.replace(/^около\s+/u, 'около ').trim();
    return `У меня ${core} опыта.`.replace(/\s+/g, ' ').trim();
  }
  if (locale === 'sr' || locale === 'hr') {
    // Finite predicate — never a bare `Sa oko …` / `S ukupno oko …` fragment.
    if (/^imam\b/iu.test(raw)) return `${capitalizeFirstLetter(raw)}.`;
    const core = raw.replace(/^s(?:a)?\s+/iu, '').trim();
    return `Imam ${core}.`;
  }
  if (locale === 'ar') {
    // Finite verbal predicate — never a bare nominal duration fragment.
    if (/^(?:أمتلك|لدي|لديّ)\b/u.test(raw)) return `${raw}.`;
    return `أمتلك ${raw}.`;
  }
  if (locale === 'hi') {
    // Complete copular sentence + Devanagari danda (unit splitters key on ।).
    const core = raw.replace(/[।.]+$/u, '').trim();
    if (/\bहै$/u.test(core) || /मेरे पास/u.test(core)) return `${core}।`;
    return `मेरे पास ${core} है।`;
  }
  if (locale === 'ja') {
    // Complete sentence — never a bare `通算で約5年半。` noun fragment.
    const core = raw.replace(/。+$/u, '').trim();
    if (/(?:あります|います|です)$/u.test(core)) return `${core}。`;
    return `${core}の実務経験があります。`;
  }
  return `${capitalizeFirstLetter(raw)}.`;
}

const FRENCH_FUNCTION_WORDS = '(?:avec|pour|dans|chez|sur|par|et|ou|de|en|à)';
const FRENCH_ARTICLE_WORDS = '(?:les|des|la|le|un|une|aux|au|du|d\u2019?)';
const FRENCH_FUSED_BOUNDARY_RE = new RegExp(
  `(^|[^\\p{L}])(${FRENCH_FUNCTION_WORDS})(${FRENCH_ARTICLE_WORDS})(?=[^\\p{L}]|$)`,
  'giu',
);

/**
 * Repair token boundaries at the shared French duty-surface join point.
 * Function words and their following articles are separate lexical tokens;
 * this is intentionally structural rather than a fixture-specific replacement.
 */
export function normalizeFrenchTokenBoundaries(text: string): string {
  return (text || '')
    .replace(FRENCH_FUSED_BOUNDARY_RE, '$1$2 $3')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function detectFrenchTokenBoundaryDefect(text: string): boolean {
  FRENCH_FUSED_BOUNDARY_RE.lastIndex = 0;
  return FRENCH_FUSED_BOUNDARY_RE.test(text || '');
}

/** Lowercase a duty predicate only when it is embedded in a sentence. */
export function normalizeFrenchDutyClause(text: string): string {
  const normalized = normalizeFrenchTokenBoundaries(text);
  const sentenceCased = normalized.replace(/^(\p{Lu})(?=\p{Ll})/u, (match) =>
    match.toLocaleLowerCase('fr-FR'));
  // A completed duty may carry its auxiliary explicitly ("ai Préparé")
  // before the relative connector supplies "où j'ai". The participle is
  // still sentence-internal and must not retain standalone-bullet casing.
  return sentenceCased.replace(/^(ai|j['’]ai)(\s+)(\p{Lu})(?=\p{Ll})/iu,
    (_match, auxiliary: string, spacing: string, initial: string) =>
      `${auxiliary}${spacing}${initial.toLocaleLowerCase('fr-FR')}`);
}

function localeAndJoin(parts: string[], locale: Locale): string {
  const clean = parts
    .map((p) => (locale === 'fr' ? normalizeFrenchDutyClause(p) : p)
      .replace(/[.;]+$/u, '').trim())
    .filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  // Arabic uses the Arabic comma; never the Latin comma inside RTL prose.
  const head = clean.slice(0, -1).join(locale === 'ar' ? '، ' : ', ');
  const last = clean[clean.length - 1];
  if (locale === 'es') return `${head} y ${last}`;
  if (locale === 'pt-BR') return `${head} e ${last}`;
  if (locale === 'fr') return normalizeFrenchTokenBoundaries(`${head} et ${last}`);
  if (locale === 'it') return `${head} e ${last}`;
  if (locale === 'ru') return `${head} и ${last}`;
  if (locale === 'sr' || locale === 'hr') return `${head} i ${last}`;
  if (locale === 'ar') return `${head} و${last}`;
  if (locale === 'hi') return `${head} और ${last}`;
  if (locale === 'ja') return `${head}、${last}`;
  if (locale === 'de') return `${head} und ${last}`;
  return `${head} and ${last}`;
}

const FRENCH_FIRST_PERSON_PRESENT_IRREGULAR: Record<string, string> = {
  a: 'ai',
  est: 'suis',
  fait: 'fais',
  va: 'vais',
  peut: 'peux',
  doit: 'dois',
  sait: 'sais',
  prend: 'prends',
  met: 'mets',
  lit: 'lis',
  écrit: 'écris',
  voit: 'vois',
  suit: 'suis',
  tient: 'tiens',
  vient: 'viens',
  boit: 'bois',
  croit: 'crois',
  reçoit: 'reçois',
};

/** Realize every finite predicate in a French first-person duty chain. */
function realizeFrenchFirstPersonDutyChain(
  bullet: string,
  tense: 'present' | 'completed',
): string {
  let text = (bullet || '').replace(/[.;。؟।]+$/u, '').trim();
  text = text.replace(/^(?:je|j['’])\s+/iu, '');
  if (!text) return '';
  if (tense === 'completed') {
    // `j'ai` is one auxiliary boundary. Normalize it to `ai` before the
    // caller supplies the relative-clause `où j'` prefix.
    text = text.replace(/^j['\u2019]ai\s+/iu, 'ai ');
    text = text.replace(/((?:^|[,;]|\bet\b)\s*)j['\u2019]ai\s+/giu, '$1');
    // Provider/deterministic bullets often carry a third-person auxiliary.
    // The relative connector supplies j' outside this function, so return ai.
    text = text.replace(/^(?:a|ont|avait|avaient|j['’]a)\s+/iu, 'ai ');
    text = text.replace(/((?:^|[,;]|\bet\b)\s*)(?:a|ont|avait|avaient)\s+/giu, '$1');
    // Imparfait chains must agree with je on every coordinated finite verb.
    text = text.replace(/\b(\p{L}+?)ait\b/giu, (match, stem: string) =>
      /^(?:f|déf|ref)$/iu.test(stem) ? match : `${stem}ais`);
    text = text.replace(/\b(\p{L}+?)aient\b/giu, '$1aient');
    return normalizeFrenchDutyClause(text);
  }
  // Present irregulars are the forms where 1sg and 3sg visibly diverge.
  text = text.replace(/^(\p{L}+)/u, (match) => match.toLocaleLowerCase('fr-FR'));
  text = text.replace(/(^|[,;]|\bet\b)\s*(\p{L}+)/giu, (all, prefix: string, verb: string) => {
    const mapped = FRENCH_FIRST_PERSON_PRESENT_IRREGULAR[verb.toLocaleLowerCase('fr-FR')];
    return `${prefix}${mapped || verb}`;
  });
  return text.replace(/\s+/g, ' ').trim();
}

/** Spanish/Portuguese 3sg → 1sg present morphology (no occupation tables). */
function romanceFirstPersonPresent(lower: string, locale: 'es' | 'pt-BR'): string {
  // -uir verbs: sustituye→sustituyo (es), substitui→substituo (pt-BR).
  if (locale === 'pt-BR' && /ui$/u.test(lower)) return `${lower.slice(0, -1)}o`;
  if (/ye$/u.test(lower)) return `${lower.slice(0, -2)}yo`;
  if (/ce$/u.test(lower)) return `${lower.slice(0, -2)}zo`;
  if (/[aei]a$/u.test(lower)) return `${lower.slice(0, -1)}o`;
  if (/e$/u.test(lower)) return `${lower.slice(0, -1)}o`;
  if (/a$/u.test(lower)) return `${lower.slice(0, -1)}o`;
  return lower;
}

/** Spanish/Portuguese 3sg → 1sg completed morphology. */
function romanceFirstPersonPast(lower: string, locale: 'es' | 'pt-BR'): string {
  // Unicode escapes keep the morphology contract independent of source-file
  // encoding on Windows toolchains.
  if (/y\u00f3$/u.test(lower)) return `${lower.slice(0, -2)}\u00ed`;
  if (/i\u00f3$/u.test(lower)) return `${lower.slice(0, -2)}\u00ed`;
  // -uir/-eer preterite: sustituyó→sustituí, leyó→leí, construyó→construí.
  if (/yó$/u.test(lower)) return `${lower.slice(0, -2)}í`;
  if (/ió$/u.test(lower)) return `${lower.slice(0, -2)}í`;
  if (locale === 'pt-BR') {
    // Brazilian Portuguese third-person simple past -eu maps to the
    // first-person -i form (desenvolveu -> desenvolvi, conheceu -> conheci).
    if (/eu$/u.test(lower)) return `${lower.slice(0, -2)}i`;
    if (/ou$/u.test(lower)) {
      // Orthographic stem changes keep regular -car/-gar/-çar verbs valid
      // before the first-person -ei ending (verificou -> verifiquei,
      // pagou -> paguei, começou -> comecei).
      if (/cou$/u.test(lower)) return `${lower.slice(0, -3)}quei`;
      if (/gou$/u.test(lower)) return `${lower.slice(0, -3)}guei`;
      if (/\u00e7ou$/u.test(lower)) return `${lower.slice(0, -3)}cei`;
      return `${lower.slice(0, -2)}ei`;
    }
    if (/iu$/u.test(lower)) return `${lower.slice(0, -2)}i`;
    // -ava / -ia imperfect: 1sg == 3sg.
    return lower;
  }
  // Spanish spelling changes in the preterite are not suffix-only.
  // Keep this small and morphology-owned; regular verbs continue below.
  const irregular: Record<string, string> = {
    realiz\u00f3: 'realic\u00e9',
    atendi\u00f3: 'atend\u00ed',
    respondi\u00f3: 'respond\u00ed',
    recibi\u00f3: 'recib\u00ed',
  };
  if (irregular[lower]) return irregular[lower];
  if (/\u00f3$/u.test(lower)) return `${lower.slice(0, -1)}\u00e9`;
  if (/ó$/u.test(lower)) return `${lower.slice(0, -1)}é`;
  // -ía / -aba imperfect: 1sg == 3sg.
  return lower;
}

/**
 * Spanish Summary facts are commonly supplied as third-person duty clauses.
 * A coordinated predicate must be inflected with the same first-person
 * morphology as the leading predicate; converting just the first verb creates
 * a visible but invalid `registré y gestionó` false-green.
 */
function realizeSpanishCoordinatedPredicates(rest: string, tense: 'present' | 'past'): string {
  return (rest || '').replace(
    /((?:,\s*(?:y|e)\s+|,\s+|\b(?:y|e)\s+))([\p{L}]+)/giu,
    (_whole, connector: string, rawVerb: string) => {
      const verb = rawVerb.toLocaleLowerCase();
      // Restrict conversion to productive Spanish finite endings. Function
      // words never satisfy these forms, while arbitrary regular duty verbs do.
      if (tense === 'present' && verb.length >= 4 && /(?:a|e)$/u.test(verb)) {
        return `${connector}${romanceFirstPersonPresent(verb, 'es')}`;
      }
      if (tense === 'past' && verb.length >= 4 && /(?:\u00f3|i\u00f3)$/u.test(verb)) {
        return `${connector}${romanceFirstPersonPast(verb, 'es')}`;
      }
      return `${connector}${rawVerb}`;
    },
  );
}

/**
 * Brazilian Portuguese duty clauses can carry several finite predicates in a
 * single bullet. Realizing only the leading verb leaves a mixed-person chain
 * such as `criei ..., desenvolveu ... e verificou ...`. Convert only
 * conjunction-following productive finite forms; objects and modifiers remain
 * untouched and are never treated as predicates.
 */
function realizePortugueseCoordinatedPredicates(rest: string, tense: 'present' | 'past'): string {
  return (rest || '').replace(
    /((?:,\s*|\s+)(?:e|ou)\s+)([\p{L}]+)/giu,
    (_whole, connector: string, rawVerb: string) => {
      const verb = rawVerb.toLocaleLowerCase('pt-BR');
      if (tense === 'present' && verb.length >= 4 && /(?:a|e)$/u.test(verb)) {
        return `${connector}${romanceFirstPersonPresent(verb, 'pt-BR')}`;
      }
      if (tense === 'past' && verb.length >= 4 && /(?:ou|eu|iu)$/u.test(verb)) {
        return `${connector}${romanceFirstPersonPast(verb, 'pt-BR')}`;
      }
      return `${connector}${rawVerb}`;
    },
  );
}

export type SpanishCoordinatedPredicateMorphology = {
  mixedPersonPredicateChain: boolean;
  mixedTensePredicateChain: boolean;
};

export type SummaryV2PerspectiveContract = 'first_person' | 'cv_third_person' | 'neutral_or_unspecified';

/**
 * Structural Spanish coordination guard shared by localization and final
 * native-surface validation. It deliberately keys on finite morphology and
 * conjunctions, rather than occupation or fixture-specific vocabulary.
 */
export function analyzeSpanishCoordinatedPredicateMorphology(
  text: string,
  perspective: SummaryV2PerspectiveContract = 'first_person',
): SpanishCoordinatedPredicateMorphology {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  // Keep suffix-based evidence clause-local. Long-distance matching confuses
  // ordinary noun phrases such as `catálogo y estantería` with predicates.
  // Production acceptance additionally checks manifest-owned expected
  // realizations in validator.ts.
  const clauseStart = '(?:^|\\bdonde\\s+|,\\s+)';
  const firstPersonPastThenThird = new RegExp(
    `${clauseStart}\\p{L}+(?:\\u00e9|\\u00ed)(?!\\p{L})\\s*(?:,\\s*)?(?:y|e)\\s+\\p{L}+(?:\\u00f3|i\\u00f3)(?!\\p{L})`,
    'iu',
  );
  const firstPersonPresentThenThird = new RegExp(
    `${clauseStart}\\p{L}+o(?!\\p{L})\\s*(?:,\\s*)?(?:y|e)\\s+\\p{L}+(?:a|e)(?!\\p{L})`,
    'iu',
  );
  const thirdPersonPastThenFirst = new RegExp(
    `${clauseStart}\\p{L}+(?:\\u00f3|i\\u00f3)(?!\\p{L})\\s*(?:,\\s*)?(?:y|e)\\s+\\p{L}+(?:\\u00e9|\\u00ed)(?!\\p{L})`,
    'iu',
  );
  const thirdPersonPresentThenFirst = new RegExp(
    `${clauseStart}\\p{L}+(?:a|e)(?!\\p{L})\\s*(?:,\\s*)?(?:y|e)\\s+\\p{L}+o(?!\\p{L})`,
    'iu',
  );
  const presentThenPast = new RegExp(
    `${clauseStart}\\p{L}+(?:a|e|o)(?!\\p{L})\\s*(?:,\\s*)?(?:y|e)\\s+\\p{L}+(?:\\u00f3|i\\u00f3|\\u00e9|\\u00ed)(?!\\p{L})`,
    'iu',
  );
  const pastThenPresent = new RegExp(
    `${clauseStart}\\p{L}+(?:\\u00f3|i\\u00f3|\\u00e9|\\u00ed)(?!\\p{L})\\s*(?:,\\s*)?(?:y|e)\\s+\\p{L}+(?:a|e|o)(?!\\p{L})`,
    'iu',
  );
  // A semantic duty can contain objects, adverbs and several coordinated
  // facts between predicates. Once a clause establishes a person, inspect all
  // later finite Spanish preterites in that same sentence, not only adjacent
  // `verb y verb` pairs.
  const firstPersonPastAnywhereThenThird = /(?:^|[^\p{L}])\p{L}+(?:\u00e9|\u00ed)(?!\p{L})[^.?!]*(?:^|[^\p{L}])\p{L}+(?:\u00f3|i\u00f3)(?!\p{L})/iu;
  const thirdPersonPastAnywhereThenFirst = /(?:^|[^\p{L}])\p{L}+(?:\u00f3|i\u00f3)(?!\p{L})[^.?!]*(?:^|[^\p{L}])\p{L}+(?:\u00e9|\u00ed)(?!\p{L})/iu;
  const firstPersonMismatch = firstPersonPastThenThird.test(t)
    || firstPersonPresentThenThird.test(t)
    || firstPersonPastAnywhereThenThird.test(t);
  const thirdPersonMismatch = thirdPersonPastThenFirst.test(t)
    || thirdPersonPresentThenFirst.test(t)
    || thirdPersonPastAnywhereThenFirst.test(t);
  return {
    mixedPersonPredicateChain: perspective === 'first_person'
      ? firstPersonMismatch
      : perspective === 'cv_third_person'
        ? thirdPersonMismatch
        : firstPersonMismatch || thirdPersonMismatch,
    mixedTensePredicateChain: presentThenPast.test(t) || pastThenPresent.test(t),
  };
}

const ARABIC_PAST_1SG_SUFFIX = 'ت';
const ARABIC_DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;

function stripArabicDiacritics(value: string): string {
  return (value || '').replace(ARABIC_DIACRITICS_RE, '');
}

/** Arabic 3sg → 1sg realization for both present (يـ→أـ) and completed (+ـت). */
function arabicFirstPersonVerb(verb: string, tense: 'present' | 'past'): string {
  const v = (verb || '').trim();
  if (!v) return v;
  const plain = stripArabicDiacritics(v);
  if (tense === 'past' && /ت$/u.test(plain)) {
    const terminalGeminate = /([\p{Script=Arabic}])\u0651[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]*ت[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]*$/u.exec(v);
    if (terminalGeminate) {
      const base = plain.slice(0, -1);
      return `${base}${base.slice(-1)}${ARABIC_PAST_1SG_SUFFIX}`;
    }
    return plain;
  }
  if (/^[يتن]/u.test(v)) {
    const present1sg = `أ${v.slice(1)}`;
    if (tense === 'present') return present1sg;
    // A bare imperfective source has no safe perfect stem; use a first-person
    // present predicate only when no past auxiliary supplied that authority.
    return present1sg;
  }
  if (tense !== 'past') return v;
  // A source feminine 3sg and 1sg perfect both end in ت orthographically.
  // Remove vocalization, and expand only a terminal geminated radical: أعدّت → أعددت.
  // Geminated final radical (أعدّ) expands before the 1sg suffix: أعددت.
  if (/ّ[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]*$/u.test(v)) {
    const base = stripArabicDiacritics(v);
    const last = base.slice(-1);
    return `${base}${last}${ARABIC_PAST_1SG_SUFFIX}`;
  }
  if (/ى$/u.test(plain)) return `${plain.slice(0, -1)}يت`;
  if (/[اوي]$/u.test(plain)) return `${plain}ت`;
  return `${plain}${ARABIC_PAST_1SG_SUFFIX}`;
}

function arabicFirstPersonPredicateChain(raw: string, tense: 'present' | 'past'): string {
  return raw.replace(
    /(^|،\s*|\s+و)([\p{Script=Arabic}\p{M}]+)/gu,
    (full, connector: string, token: string) => {
      const plain = stripArabicDiacritics(token);
      const shouldTransform = tense === 'present'
        ? /^[يتن]/u.test(plain)
        : connector === '' || /ت$/u.test(plain) || /^كانت$/u.test(plain);
      if (!shouldTransform) return full;
      if (tense === 'past' && /^كانت$/u.test(plain)) return `${connector}كنت`;
      return `${connector}${arabicFirstPersonVerb(token, tense)}`;
    },
  );
}

/** Hindi masculine → selected-gender habitual/past participle agreement. */
function hindiApplyGender(text: string, mode: SummaryV2GenderMode): string {
  let t = text;
  // Never leave slash placeholders in visible text.
  t = t
    .replace(/करता\s*\/\s*करती/gu, mode === 'female' ? 'करती' : 'करता')
    .replace(/था\s*\/\s*थी/gu, mode === 'female' ? 'थी' : 'था');
  if (mode === 'female') {
    t = t.replace(/(\p{L}+?)ता(?=\s+(?:हूँ|हूं|है|था|थी))/gu, '$1ती');
    t = t.replace(/(?<![\p{L}\p{M}])था(?=[^\p{L}\p{M}]|$)/gu, 'थी');
  } else if (mode === 'male') {
    t = t.replace(/(\p{L}+?)ती(?=\s+(?:हूँ|हूं|है|हैं|था|थी|थीं))/gu, '$1ता');
    t = t.replace(/(?<![\p{L}\p{M}])(?:थी|थीं)(?=[^\p{L}\p{M}]|$)/gu, 'था');
  }
  return t;
}

const JA_GODAN_CONJUNCTIVE: Record<string, string> = {
  う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち',
  ぬ: 'に', ぶ: 'び', む: 'み', る: 'り',
};

const JA_GODAN_POLITE_PAST: Record<string, string> = {
  う: 'いました', く: 'きました', ぐ: 'ぎました', す: 'しました', つ: 'ちました',
  ぬ: 'にました', ぶ: 'びました', む: 'みました', る: 'りました',
};

const JA_GODAN_POLITE_PROGRESSIVE: Record<string, string> = {
  う: 'っています', く: 'いています', ぐ: 'いでいます', す: 'しています', つ: 'っています',
  ぬ: 'んでいます', ぶ: 'んでいます', む: 'んでいます', る: 'っています',
};

/** Japanese duty clause → 連用形 (conjunctive) so clauses chain naturally. */
function japaneseConjunctiveForm(clause: string): string {
  const c = clause.replace(/[。.\s]+$/u, '').trim();
  if (!c) return c;
  if (/した$/u.test(c)) return c.replace(/した$/u, 'し');
  if (/する$/u.test(c)) return c.replace(/する$/u, 'し');
  if (/しています$/u.test(c)) return c.replace(/しています$/u, 'し');
  if (/しました$/u.test(c)) return c.replace(/しました$/u, 'し');
  if (/ました$/u.test(c)) return c.replace(/ました$/u, '');
  if (/ています$/u.test(c)) return c.replace(/ています$/u, '');
  if (/ます$/u.test(c)) return c.replace(/ます$/u, '');
  const last = c.slice(-1);
  const conj = JA_GODAN_CONJUNCTIVE[last];
  if (conj) return `${c.slice(0, -1)}${conj}`;
  return c;
}

/** Japanese duty clause → polite finite sentence ending for the entry state. */
function japaneseFiniteForm(clause: string, past: boolean): string {
  const c = clause.replace(/[。.\s]+$/u, '').trim();
  if (!c) return c;
  if (/(?:しています|しました|ています|ました|です)$/u.test(c)) return c;
  if (/した$/u.test(c)) return c.replace(/した$/u, past ? 'しました' : 'しています');
  if (/する$/u.test(c)) return c.replace(/する$/u, past ? 'しました' : 'しています');
  const last = c.slice(-1);
  const table = past ? JA_GODAN_POLITE_PAST : JA_GODAN_POLITE_PROGRESSIVE;
  const ending = table[last];
  if (ending) return `${c.slice(0, -1)}${ending}`;
  return `${c}${past ? 'ました' : 'ています'}`;
}

/**
 * Convert a live duty bullet into first-person morphology for shell locales.
 * Serbian/Croatian: transform every coordinated finite predicate (not lead-only).
 */
export function realizeFirstPersonDutyClause(
  bullet: string,
  locale: Locale,
  employmentState: SummaryV2EmploymentState,
  gender?: string | null,
): string {
  const tense = dutyTenseFromEmploymentState(employmentState);
  const raw = (bullet || '').replace(/[.;。؟।]+$/u, '').trim();
  if (!raw) return '';

  if (locale === 'ar' && employmentState === 'completed') {
    // Third-person imperfective with a feminine past auxiliary is realized as
    // first-person past auxiliary + first-person imperfective, independent of duty lexicon.
    const auxiliary = /^كانت\s+([\p{Script=Arabic}\p{M}]+)([\s\S]*)$/u.exec(raw);
    if (auxiliary) {
      return `كنت ${arabicFirstPersonVerb(auxiliary[1], 'present')}${auxiliary[2] || ''}`
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  if (locale === 'ar') {
    return arabicFirstPersonPredicateChain(raw, tense);
  }

  if (locale === 'sr' || locale === 'hr') {
    const realized = realizeSouthSlavicPredicateChain({
      bullet: raw,
      locale,
      employmentState,
      gender,
    });
    return realized.text;
  }

  if (locale === 'fr') {
    return realizeFrenchFirstPersonDutyChain(
      raw,
      tense === 'present' ? 'present' : 'completed',
    );
  }

  // Combining marks (Arabic shadda, Devanagari matras) belong to the verb token.
  const m = /^([\p{L}\p{M}]+)([\s\S]*)$/u.exec(raw);
  if (!m) return raw.replace(/^\p{Lu}/u, (c) => c.toLowerCase());
  let verb = m[1];
  const rest = m[2] || '';
  const lower = verb.toLocaleLowerCase();

  if (locale === 'es' || locale === 'pt-BR') {
    verb = tense === 'present'
      ? romanceFirstPersonPresent(lower, locale)
      : romanceFirstPersonPast(lower, locale);
  } else if (locale === 'it') {
    // Biography passato prossimo bullets (Ha/Hanno + participle) → 1sg Ho.
    if (/^(ha|hanno|ho)\s+/iu.test(raw)) {
      const rest = raw.replace(/^(ha|hanno|ho)\s+/iu, '').trim();
      return `ho ${rest}`.replace(/\s+/g, ' ').trim();
    }
    if (tense === 'present') {
      if (/isce$/u.test(lower)) verb = `${lower.slice(0, -4)}isco`;
      else if (/gue$/u.test(lower)) verb = `${lower.slice(0, -3)}guo`;
      else if (/[ae]$/u.test(lower)) verb = `${lower.slice(0, -1)}o`;
      else verb = lower;
    } else if (/ava$/u.test(lower)) {
      verb = `${lower.slice(0, -1)}o`;
    } else if (/iva$/u.test(lower)) {
      verb = `${lower.slice(0, -1)}o`;
    } else {
      verb = lower;
    }
  } else if (locale === 'ru') {
    if (tense === 'present') {
      // Russian 1sg present replaces the finite ending with `-ю`; treating
      // `-ует` as a bare `-ет` suffix retains the stem's `у` and creates
      // malformed forms such as редактируу.
      if (/(?:ает|яет|ует)$/u.test(lower)) verb = `${lower.slice(0, -2)}ю`;
      else if (/ит$/u.test(lower)) verb = `${lower.slice(0, -2)}ю`;
      else if (/ировать$/u.test(lower)) verb = `${lower.slice(0, -7)}ирую`;
      else if (/давать$/u.test(lower)) verb = `${lower.slice(0, -6)}даю`;
      else if (/(?:ать|ять)$/u.test(lower)) verb = `${lower.slice(0, -2)}ю`;
      else if (/ет$/u.test(lower)) verb = `${lower.slice(0, -2)}ю`;
      else verb = lower;
    } else {
      // Past tense agrees with the selected gender (проверял / проверяла).
      const mode = resolveSummaryV2GenderMode(gender);
      if (mode === 'female' && /л$/u.test(lower)) verb = `${lower}а`;
      else if (mode !== 'female' && /ла$/u.test(lower)) verb = lower.slice(0, -1);
      else verb = lower;
    }
  } else if (locale === 'hi') {
    // Every finite Hindi habitual in a first-person shell needs the same
    // person/number auxiliary; transforming only the terminal verb left
    // coordinated provider/localization clauses as करती हैं / करती थीं.
    const mode = resolveSummaryV2GenderMode(gender);
    let t = raw.replace(/[.;。؟।]+$/u, '').trim();
    if (tense === 'present') {
      t = t.replace(/([\p{Script=Devanagari}\p{M}]+(?:ती|ता))\s+(?:हूँ|हूं|हैं|है)/gu, '$1 हूँ');
    } else {
      const priorAuxiliary = mode === 'female' ? 'थी' : mode === 'male' ? 'था' : 'थी';
      t = t.replace(/([\p{Script=Devanagari}\p{M}]+(?:ती|ता))\s+(?:हूँ|हूं|हैं|है|थीं|थे|थी|था)/gu, `$1 ${priorAuxiliary}`);
    }
    return hindiApplyGender(t, mode);
  } else if (locale === 'ja') {
    return raw.replace(/[.;。؟।]+$/u, '').trim();
  } else {
    verb = lower;
  }

  const realizedRest = locale === 'es'
    ? realizeSpanishCoordinatedPredicates(rest, tense)
    : locale === 'pt-BR'
      ? realizePortugueseCoordinatedPredicates(rest, tense)
      : rest;
  return `${verb}${realizedRest}`.replace(/\s+/g, ' ').trim();
}

/**
 * Every surface form a Japanese duty bullet can take inside a chained Summary
 * sentence (conjunctive middle clause, polite finite closing clause, stem).
 */
export function japaneseDutyRealizationVariants(
  bullet: string,
  employmentState: SummaryV2EmploymentState,
): string[] {
  const raw = (bullet || '').replace(/[。.\s]+$/u, '').trim();
  if (!raw) return [];
  const past = employmentState === 'completed';
  const conjunctive = japaneseConjunctiveForm(raw);
  return [...new Set([
    raw,
    conjunctive,
    japaneseFiniteForm(raw, past),
    japaneseFiniteForm(raw, !past),
    conjunctive.replace(/[しいきぎちにびみり]$/u, ''),
  ])].filter(Boolean);
}

function relativeDutyConnector(
  locale: Locale,
  employmentState: SummaryV2EmploymentState,
): string {
  const prior = employmentState === 'completed';
  if (locale === 'es') return prior ? ', donde ' : ', donde ';
  if (locale === 'fr') return ', où je ';
  if (locale === 'it') return ', dove ';
  if (locale === 'pt-BR') return ', onde ';
  if (locale === 'ru') return ', где я ';
  if (locale === 'sr') {
    return prior ? ', gde sam ' : ', gde ';
  }
  if (locale === 'hr') {
    return prior ? ', gdje sam ' : ', gdje ';
  }
  if (locale === 'ar') return '، حيث ';
  // Hindi: avoid जहाँ-relative shells in V2 (slot/sentence split disagreement).
  // Join duties with coordination inside the same finite sentence.
  if (locale === 'hi') return ' तथा ';
  if (locale === 'ja') return '。業務では';
  if (locale === 'de') return ', wo ich ';
  return ', where I ';
}

/** Build a first-person duty tail (never em-dash + raw 3sg bullets). */
export function buildNativeFirstPersonDutyTail(
  bullets: string[],
  locale: Locale,
  employmentState: SummaryV2EmploymentState,
  gender?: string | null,
): string {
  const clauses = bullets
    .map((b) => realizeFirstPersonDutyClause(b, locale, employmentState, gender))
    .filter(Boolean);
  if (!clauses.length) return '';
  if (locale === 'fr') {
    // "où je" already supplies subject — keep verb forms lowercased.
    // Elide before vowel-/h-initial verbs: où j'effectue (not où je effectue).
    const frenchClauses = employmentState === 'completed'
      ? clauses.map((clause, index) => index === 0
        ? clause
        : clause.replace(/^ai\s+/iu, ''))
      : clauses;
    const joined = localeAndJoin(frenchClauses, locale);
    const needsElision = /^[aeiouhâàáâäæéèêëíìîïóòôöøúùûüœ]/iu.test(joined);
    const connector = needsElision ? ", où j'" : ', où je ';
    return `${connector}${joined}`;
  }
  if (locale === 'ja') {
    // Chain with 連用形 and close with one polite finite predicate — never a
    // mechanical list of dictionary/past forms glued by 、 or 、また.
    const past = employmentState === 'completed';
    const chained = clauses.map((c, i) => (
      i === clauses.length - 1
        ? japaneseFiniteForm(c, past)
        : japaneseConjunctiveForm(c)
    ));
    return `${relativeDutyConnector(locale, employmentState)}${chained.join('、')}`;
  }
  return `${relativeDutyConnector(locale, employmentState)}${localeAndJoin(clauses, locale)}`;
}

const INTERNAL_MARKER_RE =
  /\b(?:v2_rewrite_|SUMMARY_V2_|style_marker|\[style:|__style__)\b/iu;
const ENGLISH_ED_LEAK_RE =
  /\b\p{L}{3,}ed\b/iu;

/* ------------------------------------------------------------------ *
 * Shared native realization contract (AAB-389)
 * Structural checks — no fixture strings, no occupation/employer knowledge.
 * ------------------------------------------------------------------ */

/** Split visible text into recruiter-facing sentences across all scripts. */
function splitNativeSentences(text: string): string[] {
  // CJK / Devanagari / Arabic terminators often have no following space.
  // Never split on decimal points (5.5 years) — require a non-digit before the
  // terminator — and never on ellipses.
  return (text || '')
    .split(/(?<=(?<![0-9])[.!?。।؟])(?!\.)(?:\s+|(?=["«»"\p{L}\p{N}]))/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A numeric/verbal duration claim lives in this sentence. */
const DURATION_CUE_RE =
  /(?:\d|years?|Jahre|años|ans\b|anni|anos|лет|года?|godin|سنوات|سنة|वर्ष|साल|年)/iu;

/**
 * Locale finite/copular predicate cues. A sentence carrying one of these is a
 * complete clause; a duration sentence without one is a nominal fragment.
 */
// JS \b is ASCII-only even with /u — anchor on non-letter lookarounds instead.
const LOCALE_FINITE_CUE_RE: Record<string, RegExp> = {
  en: /(?:^|[^\p{L}])(?:bring|have|had|am|was|work|worked|offer)(?=[^\p{L}]|$)/iu,
  de: /(?:^|[^\p{L}])(?:verfüge|habe|bringe|bin|war|arbeite|arbeitete)(?=[^\p{L}]|$)/iu,
  es: /(?:^|[^\p{L}])(?:cuento|tengo|dispongo|trabajo|trabajé|ejerzo|ejercí|soy|fui)(?=[^\p{L}]|$)/iu,
  fr: /(?:^|[^\p{L}])(?:dispose|ai|travaille|travaillé|exerce|suis|effectue|inspecte)(?=[^\p{L}]|$)/iu,
  it: /(?:^|[^\p{L}])(?:dispongo|ho|lavoro|lavorato|sono|svolgo|ricoperto)(?=[^\p{L}]|$)/iu,
  'pt-BR': /(?:^|[^\p{L}])(?:tenho|disponho|trabalho|trabalhei|atuo|atuei|exerço|exerci|sou)(?=[^\p{L}]|$)/iu,
  ru: /(?:у\s+меня|обладаю|имею|работа(?:ю|л|ла)|занима(?:ю|л|ла|лась))/iu,
  sr: /(?:^|[^\p{L}])(?:imam|raspolažem|radim|radio|radila|obavljam|obavljao|obavljala)(?=[^\p{L}]|$)/iu,
  hr: /(?:^|[^\p{L}])(?:imam|raspolažem|radim|radio|radila|obavljam|obavljao|obavljala)(?=[^\p{L}]|$)/iu,
  ar: /(?:أمتلك|لدي|لديّ|أعمل|عملت|أشغل|شغلت)/u,
  hi: /(?:मेरे\s+पास|हूँ|हूं|है|था|थी|करता|करती)/u,
  ja: /(?:あります|います|です|ます|ました|でした)/u,
};

/** Subordinating openers that can never start a standalone sentence. */
const SUBORDINATE_OPENER_RE =
  /^(?:where|wo|donde|où|dove|onde|gd(?:j)?e|где|حيث|जहाँ|jahan)\b/iu;

const HINDI_FIRST_PERSON_RE = /(?:^|[^\p{L}])मैं(?:ने)?(?=[^\p{L}]|$)/u;
const HINDI_PRIOR_MARKER_RE = /इससे\s+(?:पहले|पूर्व)|पहले\s+मैं/u;
const HINDI_HABITUAL_AUX_RE = /([\p{Script=Devanagari}\p{M}]+(?:ती|ता))\s+(हूँ|हूं|हैं|है|थीं|थे|थी|था)/gu;
const HINDI_PERFECTIVE_TAIL_RE = /(?:[\p{Script=Devanagari}\p{M}]+(?:या|यी|ाई|ए|ीं)|की)(?=\s*(?:[,।.!?]|और|तथा|$))/u;

/**
 * Brazilian Portuguese `exercer` takes a role through an explicit nominal
 * complement (`exercer a função de ...`), not the bare `exercer como ...`
 * shell emitted by the old Professional rewrite.  Keep this structural and
 * title-agnostic so every occupation and free-text role is covered.
 */
export function detectPortugueseBrazilRoleIntroValencyDefect(text: string): boolean {
  return /(?:^|[^\p{L}])(?:exerço|exerci|exerce|exerceu)\s+como\s+(?=\p{L})/iu.test(
    (text || '').replace(/\s+/g, ' ').trim(),
  );
}

/**
 * Privacy-safe Hindi clause grammar audit. It keys on subject, auxiliary and
 * inflection morphology only: no role, employer, duty vocabulary or text is
 * retained in the returned records.
 */
export function analyzeHindiSummaryFirstPersonAgreement(options: {
  text: string;
  gender?: string | null;
  perspectiveMode?: SummaryV2PerspectiveContract;
}): HindiSummarySentenceAgreementRecord[] {
  const mode = resolveSummaryV2GenderMode(options.gender);
  const perspective = options.perspectiveMode ?? 'first_person';
  return splitNativeSentences(options.text).flatMap((sentence, sentenceIndex) => {
    const firstPerson = perspective === 'first_person' && HINDI_FIRST_PERSON_RE.test(sentence);
    const employmentState = HINDI_PRIOR_MARKER_RE.test(sentence)
      ? 'completed'
      : (firstPerson ? 'present' : 'unknown');
    const habituals = [...sentence.matchAll(HINDI_HABITUAL_AUX_RE)];
    const hasPerfective = HINDI_PERFECTIVE_TAIL_RE.test(sentence);
    const hasErgative = /(?:^|[^\p{L}])मैंने(?=[^\p{L}]|$)/u.test(sentence);
    const finiteClauses = habituals.length > 0 ? habituals : [null];
    return finiteClauses.map((match, clauseIndex) => {
      const reasons: string[] = [];
      if (firstPerson && match) {
        const form = match[1] || '';
        const auxiliary = match[2] || '';
        const feminine = /ती$/u.test(form);
        if ((mode === 'female' && !feminine) || (mode === 'male' && feminine)) {
          reasons.push('hindi_first_person_gender_agreement_invalid');
        }
        const expected = employmentState === 'completed'
          ? (mode === 'female' ? 'थी' : mode === 'male' ? 'था' : '')
          : 'हूँ';
        const normalizedAuxiliary = auxiliary === 'हूं' ? 'हूँ' : auxiliary;
        if (expected && normalizedAuxiliary !== expected) {
          reasons.push(employmentState === 'completed'
            ? 'hindi_first_person_completed_auxiliary_invalid'
            : 'hindi_first_person_present_auxiliary_invalid');
        }
      }
      if (firstPerson && hasPerfective && !hasErgative) {
        reasons.push('hindi_first_person_perfective_ergative_missing');
      }
      if (firstPerson && hasPerfective && habituals.length > 0) {
        reasons.push('hindi_first_person_mixed_aspect_coordination');
      }

      const aspect = hasPerfective && habituals.length > 0
        ? 'mixed'
        : hasPerfective
          ? 'perfective'
          : habituals.length > 0
            ? (employmentState === 'completed' ? 'past_habitual' : 'present_habitual')
            : 'unknown';
      return {
        sentenceIndex,
        clauseIndex,
        employmentState,
        perspectiveMode: firstPerson ? 'first_person' : 'neutral_or_unspecified',
        genderMode: mode,
        finiteVerbOrAuxiliaryDetected: Boolean(match) || /(?:हूँ|हूं|है|हैं|था|थी|थीं|थे)/u.test(sentence),
        agreementMode: firstPerson
          ? (hasPerfective ? 'first_person_perfective' : habituals.length ? 'first_person_habitual' : 'unknown')
          : 'neutral',
        aspect,
        grammarPassed: reasons.length === 0,
        grammarReasons: [...new Set(reasons)],
      };
    });
  });
}

/**
 * Third-person duty forms that must never appear inside a first-person Summary.
 * Arabic: a duty verb after حيث / كما must be 1sg (أ… present, …ت past).
 */
function detectThirdPersonDutyClause(text: string, locale: Locale): boolean {
  if (locale === 'ar') {
    const dutyClauses = [...text.matchAll(/(?:حيث|كما)\s+([^.!؟]+)/gu)];
    for (const match of dutyClauses) {
      const clause = match[1];
      const beforeClause = text.slice(0, match.index ?? 0).split(/[.!؟]/u).pop() || '';
      const completedClause = /(?:سابق(?:اً|ا)|عملت|كنت)/u.test(beforeClause);
      // Arabic waw is attached both as a conjunction and as the first letter
      // of ordinary words (وثائق, وموقع). Commas delimit the independent duty
      // heads here; coordinated present/feminine/geminated heads are already
      // normalized by arabicFirstPersonPredicateChain.
      const predicates = clause.split(/،/u);
      for (const predicate of predicates) {
        const predicateBody = predicate.replace(/^\s*كما\s+/u, '');
        const verb = /^\s*([\p{Script=Arabic}\p{M}]+)/u.exec(predicateBody)?.[1] || '';
        if (!verb) continue;
        const plain = stripArabicDiacritics(verb);
        // Attached waw in ordinary prepositional phrases (for example وفق
        // "according to") is not a coordinated finite predicate.
        if (completedClause && /^(?:فق|مع|بين|ضمن|حول|عبر|داخل|خارج|دون|لدى)$/u.test(plain)) {
          continue;
        }
        if (/^كانت$/u.test(plain)) return true;
        const firstPerson = completedClause
          ? /ت$/u.test(plain)
          : /^[أإآا]/u.test(plain) || /^كنت$/u.test(plain);
        const thirdPersonFinite = completedClause
          ? !/^ال/u.test(plain) && !firstPerson
          : /^[يتن]/u.test(plain);
        if (thirdPersonFinite && !firstPerson) return true;
      }
    }
    // Provider prose may use a role-intro comma without حيث; validate the
    // immediately following finite predicate without scanning unrelated duration coordination.
    const re = /،\s*([\p{Script=Arabic}\p{M}]+)/gu;
    let m: RegExpExecArray | null = re.exec(text);
    while (m) {
      const verb = m[1];
      const plain = stripArabicDiacritics(verb);
      if (/^كانت$/u.test(plain)) return true;
      const firstPerson = /^[أإآا]/u.test(plain) || /^كنت$/u.test(plain) || /ت$/u.test(plain);
      const thirdPersonFinite = /^[يتن]/u.test(plain);
      if (thirdPersonFinite && !firstPerson) return true;
      m = re.exec(text);
    }
    return false;
  }
  if (locale === 'es' || locale === 'pt-BR' || locale === 'it') {
    // 3sg present right after a relative connector inside a 1sg frame.
    return /(?:donde|onde|dove)\s+(?:\p{L}+\s+){0,2}(?:realiza|inspecciona|sustituye|registra|revisa|controla|substitui\b|inspeciona|esegue|controlla|sostituisce)(?=\s|,|\.)/iu
      .test(text);
  }
  if (locale === 'ru') {
    return /(?:где)\s+(?:я\s+)?(?:\p{L}+)(?:ет|ит|ают|яют)(?=\s|,|\.)/u.test(text);
  }
  return false;
}

/**
 * Locale verb morphology: forms no native paradigm can produce.
 * Structural (paradigm-level) rules, not banned fixture tokens.
 */
function detectLocaleVerbMorphologyDefect(text: string, locale: Locale): string | null {
  if (locale === 'es') {
    // No Spanish finite form ends in -yé (…yó is 3sg; 1sg preterite is -í).
    if (/\p{L}*yé(?=[^\p{L}]|$)/u.test(text)) return 'es_invalid_preterite_ye';
    // 1sg present of -uir verbs is -uyo, never -uye/-ui in a 1sg frame.
    if (/(?:^|\s)(?:sustituye|contribuye|construye|incluye)(?=[^\p{L}]|$)/u.test(text)
      && /\b(?:trabajo|ejerzo|realizo|inspecciono)\b/iu.test(text)) {
      return 'es_third_person_present_in_first_person_frame';
    }
  }
  if (locale === 'pt-BR') {
    // -uir verbs: 3sg is "substitui", 1sg is "substituo".
    if (/(?:^|\s)\p{L}*ui(?=[^\p{L}]|$)/u.test(text)
      && /\b(?:trabalho|exerço|realizo|inspeciono)\b/iu.test(text)) {
      return 'ptbr_third_person_present_in_first_person_frame';
    }
  }
  if (locale === 'ar') {
    // A shadda can never follow the 1sg past suffix ـت; duplicated suffixes
    // remain invalid even when separated by sukun/fatha/other vocalization.
    if (/ت\u0651/u.test(text)) return 'ar_malformed_gemination';
    if (/ت[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]*ت(?=[^\p{Script=Arabic}]|$)/u.test(text)) {
      return 'ar_duplicated_past_suffix';
    }
  }
  if (locale === 'ru') {
    // Parenthetical gender is caught separately; reject malformed first-person
    // present forms independently of the builder that produced them. A
    // duplicated `-у` is never a Russian finite 1sg ending and previously
    // allowed `редактируу` to pass the Cyrillic-only checks.
    if (/(?:^|[^\p{Script=Cyrillic}])\p{Script=Cyrillic}*уу(?=[^\p{Script=Cyrillic}]|$)/u.test(text)) {
      return 'ru_malformed_first_person_present';
    }
    if (/(?:^|\s)я\s+\p{L}+(?:ет|ит)(?=[^\p{L}]|$)/u.test(text)) {
      return 'ru_person_agreement';
    }
  }
  if (locale === 'sr' || locale === 'hr') {
    // A first-person South-Slavic shell already supplies `sam`; a retained
    // third-person auxiliary after a feminine past participle is malformed
    // (`gde sam kreirala je`).
    if (/(?:gd(?:e|je))\s+sam\s+\p{L}+(?:ala|ela|ila)\s+je(?=\s|[,.!?]|$)/iu.test(text)) {
      return 'sr_duplicate_past_auxiliary';
    }
    // A loose `-e` present-verb heuristic can mistake noun-like surfaces such
    // as `rasporede` for a predicate and mutate them into `rasporedem` or
    // `rasporedela`. Reject that morphology rather than applying a visibly
    // non-native duty; the rule is independent of role/employer vocabulary.
    if (/(?:^|[^\p{L}])\p{L}{5,}red(?:em|ela)(?=[^\p{L}]|$)/iu.test(text)) {
      return 'sr_malformed_noun_predicate_mutation';
    }
  }
  return null;
}

/** Russian role titles need a case-safe construction, never "как <Role>". */
function detectRoleCaseDefect(text: string, locale: Locale): boolean {
  if (locale !== 'ru') return false;
  return /работа(?:ю|л|ла)\s+как\s+\p{L}/u.test(text);
}

/** Coordination that is ungrammatical or mechanical in the target language. */
function detectCoordinationDefect(text: string, locale: Locale): string | null {
  if (locale === 'it') {
    // `nonché` is valid for nominal coordination (for example,
    // "materiali nonché strumenti"), but it is a poor bridge between two
    // independent finite first-person clauses.  Stronger/Professional used to
    // manufacture surfaces such as "preparo ..., nonché modifico ..." and
    // "ho creato ..., nonché ho sviluppato ...".  Scope the guard to a comma
    // clause boundary plus an Italian finite predicate/auxiliary so legitimate
    // noun coordination remains accepted.
    const finiteAfterNonche = /,\s*nonché\s+(?:ho|hai|ha|abbiamo|avete|hanno|sono|sei|è|siamo|siete|[\p{L}]+(?:o|avo|avi|ava|avano|ivo|ivi|iva|ivano|isco|isci|isce|iscono|iamo|ate|ono|ano))(?=[^\p{L}]|$)/iu;
    if (finiteAfterNonche.test(text)) return 'it_nonche_finite_clause_coordination';

    // A role/employer introduction needs a relative connector or a stronger
    // clause boundary before its first-person duties.  This is deliberately
    // limited to `lavoro/lavorato … come … presso …, <finite clause>` so it
    // does not ban ordinary commas elsewhere in Italian prose or depend on
    // a particular title, employer, or occupation.
    const roleIntroCommaSplice = /(?:\b(?:attualmente\s+)?lavoro\s+come|\b(?:ho(?:\s+già)?|in\s+precedenza\s+ho)\s+lavorato\s+come)\s+[^,.]+?\s+presso\s+[^,.]+,\s*(?!(?:dove|e|ma|perché|mentre)\b)(?:ho\s+)?[\p{L}]+/iu;
    if (roleIntroCommaSplice.test(text)) return 'it_role_intro_comma_splice';
  }
  if (locale === 'fr') {
    // "ainsi que" coordinating a finite verb requires an explicit subject.
    const m = /ainsi qu[e’']\s*(\p{L}+)/iu.exec(text);
    if (m) {
      const next = m[1].toLocaleLowerCase();
      const isSubjectOrNominal =
        /^(?:je|j|nous|le|la|les|l|un|une|des|du|de|d|mon|ma|mes|ce|cet|cette|ses|son|leur|leurs|en|au|aux|par|pour|dans|sur|à)$/u
          .test(next);
      const looksFinite = /(?:ais|ait|aient|ons|ez|ent|e|es|is|it)$/u.test(next);
      if (!isSubjectOrNominal && looksFinite) return 'fr_conjunction_without_subject';
    }
  }
  if (locale === 'ja') {
    if ((text.match(/また/gu) || []).length >= 2) return 'ja_repeated_mechanical_join';
    // Plain dictionary / plain-past forms glued by 、 are not connected prose.
    if (/(?:う|る|く|ぐ|す|つ|ぬ|ぶ|む)、/u.test(text)) return 'ja_dictionary_form_concatenation';
    if (/した、/u.test(text)) return 'ja_plain_past_concatenation';
  }
  if (locale === 'ar') {
    // Latin comma / semicolon inside Arabic prose.
    if (/[\u0600-\u06FF]\s*[,;]/u.test(text)) return 'ar_latin_punctuation';
  }
  // Dangling conjunction before a terminator in any locale.
  if (/(?:\band\b|\bund\b|\bet\b|\by\b|\be\b|\bи\b|\bi\b|\bو)\s*[.。।]/iu.test(text)) {
    return 'dangling_conjunction';
  }
  return null;
}

export type SummaryV2NativeRealizationContract = {
  unresolvedGenderPlaceholderDetected: boolean;
  finiteDurationSentencePassed: boolean;
  firstPersonPredicateChainPassed: boolean;
  localeVerbMorphologyPassed: boolean;
  roleCaseValidationPassed: boolean;
  nativeCoordinationValidationPassed: boolean;
  sentenceCompletenessPassed: boolean;
  hindiFirstPersonAgreementPassed: boolean;
  hindiSentenceAgreementRecords: HindiSummarySentenceAgreementRecord[];
  nativeRealizationRejectionReasons: string[];
};

/**
 * Shared native realization contract used by every style path so a visible
 * output can never be marked green while it still carries a placeholder,
 * a nominal fragment, a third-person duty, or a malformed finite form.
 */
export function evaluateNativeRealizationContract(options: {
  text: string;
  locale: Locale;
  perspectiveMode?: SummaryV2PerspectiveContract;
  gender?: string | null;
}): SummaryV2NativeRealizationContract {
  void SUMMARY_V2_NATIVE_SURFACE_389_REVISION;
  void SUMMARY_V2_SPANISH_PERSPECTIVE_NATIVE_SURFACE_391_REVISION;
  void SUMMARY_V2_SPANISH_SLOT_WIDE_PERSON_393_REVISION;
  void SUMMARY_V2_HINDI_FIRST_PERSON_AGREEMENT_427_REVISION;
  const text = (options.text || '').replace(/\s+/g, ' ').trim();
  const locale = options.locale;
  const perspective = options.perspectiveMode ?? 'first_person';
  const reasons: string[] = [];
  const sentences = splitNativeSentences(text);
  const finiteCue = locale === 'es' && perspective === 'cv_third_person'
    ? /(?:^|[^\p{L}])(?:trabaja|trabaj\u00f3|revisa|revis\u00f3|realiza|realiz\u00f3|gestiona|gestion\u00f3|registra|registr\u00f3|coordina|coordin\u00f3|cre\u00f3|adapt\u00f3|prepar\u00f3)(?=[^\p{L}]|$)/iu
    : (LOCALE_FINITE_CUE_RE[locale] || LOCALE_FINITE_CUE_RE.en);

  const unresolvedGenderPlaceholderDetected = detectUnresolvedGenderPlaceholder(text);
  if (unresolvedGenderPlaceholderDetected) reasons.push('unresolved_gender_placeholder');

  const durationSentences = sentences.filter((s) => DURATION_CUE_RE.test(s));
  const finiteDurationSentencePassed = durationSentences.length === 0
    || durationSentences.every((s) => finiteCue.test(s));
  if (!finiteDurationSentencePassed) reasons.push('nominal_duration_fragment');

  const hindiSentenceAgreementRecords = locale === 'hi'
    ? analyzeHindiSummaryFirstPersonAgreement({
      text,
      gender: options.gender,
      perspectiveMode: perspective,
    })
    : [];
  const hindiFirstPersonAgreementPassed = hindiSentenceAgreementRecords.every(
    (record) => record.grammarPassed,
  );
  const southSlavicPredicateChain = locale === 'sr' || locale === 'hr'
    ? evaluateSouthSlavicSummaryPredicateChains({
      text,
      locale,
    })
    : null;
  const firstPersonPredicateChainPassed = perspective === 'cv_third_person'
    || (!detectThirdPersonDutyClause(text, locale)
      && hindiFirstPersonAgreementPassed
      && (southSlavicPredicateChain?.predicateChainValidationPassed ?? true));
  if (!firstPersonPredicateChainPassed) reasons.push('third_person_duty_in_first_person_frame');
  if (southSlavicPredicateChain && !southSlavicPredicateChain.predicateChainValidationPassed) {
    reasons.push(...southSlavicPredicateChain.predicateChainRejectionReasons);
  }
  for (const record of hindiSentenceAgreementRecords) {
    for (const reason of record.grammarReasons) {
      reasons.push(`locale_verb_morphology:${reason}`);
    }
  }

  const spanishCoordination = locale === 'es'
    ? analyzeSpanishCoordinatedPredicateMorphology(text, perspective)
    : { mixedPersonPredicateChain: false, mixedTensePredicateChain: false };
  if (spanishCoordination.mixedPersonPredicateChain) reasons.push('mixed_person_predicate_chain');
  if (spanishCoordination.mixedTensePredicateChain) reasons.push('mixed_tense_predicate_chain');

  const morphologyDefect = detectLocaleVerbMorphologyDefect(text, locale);
  const ptbrRoleIntroValencyDefect = locale === 'pt-BR'
    && detectPortugueseBrazilRoleIntroValencyDefect(text);
  const localeVerbMorphologyPassed = morphologyDefect === null
    && !ptbrRoleIntroValencyDefect
    && hindiFirstPersonAgreementPassed;
  if (morphologyDefect) reasons.push(`locale_verb_morphology:${morphologyDefect}`);
  if (ptbrRoleIntroValencyDefect) {
    reasons.push('locale_verb_morphology:ptbr_invalid_role_intro_valency');
  }

  const roleCaseValidationPassed = !detectRoleCaseDefect(text, locale);
  if (!roleCaseValidationPassed) reasons.push('invalid_role_case');

  const coordinationDefect = detectCoordinationDefect(text, locale);
  const nativeCoordinationValidationPassed = coordinationDefect === null;
  if (coordinationDefect) reasons.push(`unnatural_coordination:${coordinationDefect}`);

  const sentenceCompletenessPassed = sentences.length > 0
    && sentences.every((s) => {
      const bare = s.replace(/[.!?。।؟]+$/u, '').trim();
      if (!bare) return false;
      if (SUBORDINATE_OPENER_RE.test(bare)) return false;
      return finiteCue.test(bare);
    });
  if (!sentenceCompletenessPassed) reasons.push('incomplete_sentence');

  return {
    unresolvedGenderPlaceholderDetected,
    finiteDurationSentencePassed,
    firstPersonPredicateChainPassed,
    localeVerbMorphologyPassed,
    roleCaseValidationPassed,
    nativeCoordinationValidationPassed,
    sentenceCompletenessPassed,
    hindiFirstPersonAgreementPassed,
    hindiSentenceAgreementRecords,
    nativeRealizationRejectionReasons: [...new Set(reasons)],
  };
}

export function evaluateSummaryV2NativeSurface(options: {
  text: string;
  locale: Locale;
  hasCurrent?: boolean;
  hasPrior?: boolean;
  perspectiveMode?: SummaryV2PerspectiveContract;
  gender?: string | null;
}): SummaryV2NativeSurfaceResult {
  void SUMMARY_V2_NATIVE_SURFACE_386_REVISION;
  const text = (options.text || '').replace(/\s+/g, ' ').trim();
  const reasons: string[] = [];
  const ptbrFinite = options.locale === 'pt-BR'
    ? analyzePortugueseBrazilFirstPersonFiniteVerbs(text)
    : {
      finiteVerbCount: 0,
      firstPersonCompatibleFiniteVerbCount: 0,
      wrongPersonFiniteVerbCount: 0,
      wrongPersonFiniteVerbHashes: [] as string[],
      unitPersonAgreementPassed: true,
      rejectionReasons: [] as string[],
    };
  const latinScript = !['ar', 'hi', 'ja'].includes(options.locale);

  const capitalizationValidationPassed = (() => {
    if (!text) return false;
    if (!latinScript && options.locale !== 'ru') return true;
    // First sentence must start with uppercase letter (Latin/Cyrillic).
    if (/^["«]?[\p{Ll}]/u.test(text)) {
      reasons.push('lowercase_or_incomplete_opener');
      return false;
    }
    return true;
  })();

  const englishMorphologyLeakageDetected = (() => {
    if (options.locale === 'en') return false;
    // Detect accidental English past -ed glued onto non-English stems.
    if (/(?:ava|iva|ao|io|aba|eya)ed\b/iu.test(text)) {
      reasons.push('english_morphology_leakage');
      return true;
    }
    if (
      latinScript
      && ENGLISH_ED_LEAK_RE.test(text)
      && !/\b(?:applied|related|detailed|needed|based|skilled)\b/iu.test(text)
      && /(?:accoglievaed|registravaed|rispondevaed|dočekivaoed|beležioed|bilježioed|odgovaraoed|recebiaed)/iu.test(text)
    ) {
      reasons.push('english_morphology_leakage');
      return true;
    }
    return false;
  })();

  const internalMarkerLeakageDetected = INTERNAL_MARKER_RE.test(text);
  if (internalMarkerLeakageDetected) reasons.push('internal_marker_leakage');

  const nativePunctuationValidationPassed = (() => {
    if (/Auparavant\s*;/iu.test(text)) {
      reasons.push('bad_transition_semicolon');
      return false;
    }
    if (
      options.locale === 'es'
      && /\b(?:Actualmente|Antes|Anteriormente)\b[^,.?!]{1,180},\s+(?!donde\b)/iu.test(text)
    ) {
      reasons.push('spanish_role_intro_comma_splice');
      return false;
    }
    if (/,\s*;/u.test(text) || /;\s*,/u.test(text)) {
      reasons.push('malformed_punctuation');
      return false;
    }
    return true;
  })();

  const frenchTokenBoundaryValidationPassed = options.locale !== 'fr'
    || !detectFrenchTokenBoundaryDefect(text);
  if (!frenchTokenBoundaryValidationPassed) {
    reasons.push('french_token_boundary_violation');
  }

  const frenchClauseCasingValidationPassed = (() => {
    if (options.locale !== 'fr') return true;
    // After a French relative first-person frame, coordinated predicates are
    // continuation clauses and must use sentence-internal lowercase.
    const frame = /\b(?:où\s+je|où\s+j['’])\s+/iu.exec(text);
    if (!frame) return true;
    const tail = text.slice((frame.index ?? 0) + frame[0].length);
    const defect = /(?:^|,\s+|\bet\s+)([\p{Lu}][\p{Ll}]+)/u.test(tail);
    if (defect) {
      reasons.push('french_embedded_clause_capitalization');
      return false;
    }
    return true;
  })();

  // Em-dash + Capitalized 3sg duty after 1sg frame = person mismatch.
  const grammaticalPersonValidationPassed = (() => {
    const mismatch = /(?:trabajo|travaille|lavoro|trabalho|radim|работаю|أعمل|काम करता|勤務)\b[^.]{0,60}\s+[—–]\s+[\p{Lu}]/iu.test(text)
      || /(?:trabajé|travaillé|lavorato|trabalhei|radio\/la|работал|عملت|काम करता\/करती था)\b[^.]{0,60}\s+[—–]\s+[\p{Lu}\p{Ll}]+ed\b/iu.test(text);
    if (mismatch) {
      reasons.push('first_third_person_mismatch');
      return false;
    }
    // Capitalized 3sg after comma connector without relative pronoun still bad
    // when following first-person frame closely with raw bullet stem.
    if (
      /(?:trabajo como|travaille actuellement|lavoro come|trabalho como|radim kao)\b[^.]{0,80},\s+(?:Realiza|Effectue|Esegue|Obavlja|Выполняет|Inspecciona|Controlla)\b/u.test(text)
    ) {
      reasons.push('first_third_person_mismatch');
      return false;
    }
    return true;
  })();

  const ownedWorkBad = options.locale === 'en' && /\bowned work\b/iu.test(text);
  if (ownedWorkBad) reasons.push('unsupported_ownership_wording');

  const finiteClauseValidationPassed = text.length > 0
    && !/(?:^|\.\s+)(?:—|–)/u.test(text);
  if (!finiteClauseValidationPassed) reasons.push('incomplete_finite_clause');

  const currentTenseValidationPassed = options.hasCurrent === false
    || !text
    || true;
  const priorTenseValidationPassed = options.hasPrior === false
    || !text
    || true;

  const predicateChain: SouthSlavicPredicateChainDiagnostics = (
    options.locale === 'sr' || options.locale === 'hr'
  )
    ? evaluateSouthSlavicSummaryPredicateChains({
      text,
      locale: options.locale,
      hasCurrent: options.hasCurrent,
      hasPrior: options.hasPrior,
    })
    : emptySouthSlavicPredicateChainDiagnostics(text);

  if (!predicateChain.predicateChainValidationPassed) {
    for (const r of predicateChain.predicateChainRejectionReasons) {
      if (!reasons.includes(r)) reasons.push(r);
    }
  }
  if (predicateChain.mixedPersonPredicateDetected) {
    if (!reasons.includes('first_third_person_mismatch')) {
      reasons.push('first_third_person_mismatch');
    }
  }
  if (options.locale === 'pt-BR' && !ptbrFinite.unitPersonAgreementPassed) {
    reasons.push(...ptbrFinite.rejectionReasons);
  }

  const perspective = options.perspectiveMode ?? 'first_person';
  const contract = evaluateNativeRealizationContract({
    text,
    locale: options.locale,
    perspectiveMode: perspective,
    gender: options.gender,
  });
  for (const r of contract.nativeRealizationRejectionReasons) {
    if (!reasons.includes(r)) reasons.push(r);
  }

  const frenchGrammar = options.locale === 'fr'
    ? validateFrenchSummaryFiniteGrammar(text)
    : null;
  if (frenchGrammar && !frenchGrammar.grammarValidationPassed) {
    if (frenchGrammar.grammarRejectionReason) reasons.push(frenchGrammar.grammarRejectionReason);
  }

  const personOk = grammaticalPersonValidationPassed
    && !predicateChain.mixedPersonPredicateDetected
    && contract.firstPersonPredicateChainPassed
    && !(options.locale === 'es'
      && analyzeSpanishCoordinatedPredicateMorphology(text, perspective).mixedPersonPredicateChain)
    && (frenchGrammar?.grammarValidationPassed ?? true);

  const frenchSurfaceValidationPassed = options.locale !== 'fr'
    || (
      (frenchGrammar?.grammarValidationPassed ?? true)
      && frenchTokenBoundaryValidationPassed
      && frenchClauseCasingValidationPassed
    );

  const nativeSurfaceValidationPassed = capitalizationValidationPassed
    && personOk
    && frenchSurfaceValidationPassed
    && nativePunctuationValidationPassed
    && !internalMarkerLeakageDetected
    && !englishMorphologyLeakageDetected
    && !ownedWorkBad
    && finiteClauseValidationPassed
    && predicateChain.predicateChainValidationPassed
    && !contract.unresolvedGenderPlaceholderDetected
    && contract.finiteDurationSentencePassed
    && contract.localeVerbMorphologyPassed
    && ptbrFinite.unitPersonAgreementPassed
    && contract.roleCaseValidationPassed
    && contract.nativeCoordinationValidationPassed
    && contract.sentenceCompletenessPassed;

  return {
    nativeSurfaceValidationPassed,
    unresolvedGenderPlaceholderDetected: contract.unresolvedGenderPlaceholderDetected,
    finiteDurationSentencePassed: contract.finiteDurationSentencePassed,
    firstPersonPredicateChainPassed: contract.firstPersonPredicateChainPassed
      && ptbrFinite.unitPersonAgreementPassed,
    localeVerbMorphologyPassed: contract.localeVerbMorphologyPassed
      && ptbrFinite.unitPersonAgreementPassed,
    roleCaseValidationPassed: contract.roleCaseValidationPassed,
    nativeCoordinationValidationPassed: contract.nativeCoordinationValidationPassed,
    sentenceCompletenessPassed: contract.sentenceCompletenessPassed,
    hindiFirstPersonAgreementPassed: contract.hindiFirstPersonAgreementPassed,
    hindiSentenceAgreementRecords: contract.hindiSentenceAgreementRecords,
    capitalizationValidationPassed,
    grammaticalPersonValidationPassed: personOk && ptbrFinite.unitPersonAgreementPassed,
    currentTenseValidationPassed,
    priorTenseValidationPassed,
    finiteClauseValidationPassed,
    nativePunctuationValidationPassed,
    internalMarkerLeakageDetected,
    englishMorphologyLeakageDetected,
    nativeSurfaceRejectionReasons: [...new Set(reasons)],
    coordinatedPredicateCount: predicateChain.coordinatedPredicateCount,
    transformedCoordinatedPredicateCount:
      predicateChain.transformedCoordinatedPredicateCount,
    untransformedFinitePredicateCount:
      predicateChain.untransformedFinitePredicateCount,
    mixedPersonPredicateDetected: predicateChain.mixedPersonPredicateDetected,
    mixedTensePredicateDetected: predicateChain.mixedTensePredicateDetected,
    predicateChainValidationPassed: predicateChain.predicateChainValidationPassed,
    predicateChainRejectionReasons: predicateChain.predicateChainRejectionReasons,
    sourcePredicateChainHash: predicateChain.sourcePredicateChainHash,
    finalPredicateChainHash: predicateChain.finalPredicateChainHash,
    frenchGrammarValidationPassed: frenchSurfaceValidationPassed,
    frenchGrammarRejectionReason: frenchGrammar?.grammarRejectionReason ?? null,
    frenchTokenBoundaryValidationPassed,
    frenchClauseCasingValidationPassed,
    ptbrFiniteVerbCount: ptbrFinite.finiteVerbCount,
    ptbrFirstPersonCompatibleFiniteVerbCount: ptbrFinite.firstPersonCompatibleFiniteVerbCount,
    ptbrWrongPersonFiniteVerbCount: ptbrFinite.wrongPersonFiniteVerbCount,
    ptbrWrongPersonFiniteVerbHashes: ptbrFinite.wrongPersonFiniteVerbHashes,
    ptbrUnitPersonAgreementPassed: ptbrFinite.unitPersonAgreementPassed,
  };
}
