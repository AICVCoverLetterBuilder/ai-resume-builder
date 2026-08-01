/**
 * AAB-384 — Summary V2 rewrite-style contract (shorter / stronger / professional).
 * Transforms existing Summary for enhance rewrites; never invents material claims.
 */
import type { Locale } from '@/lib/i18n/translations';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { SUMMARY_V2_REVISION } from './flag';
import type { SummaryV2SelectionManifest } from './types';
import { buildSummaryV2DeterministicText } from './builder';
import {
  buildGermanSummaryV2FromManifest,
  bulletToGermanWoIchClause,
} from './german-surface';
import { dutyTenseFromEmploymentState } from './tense';
import {
  evaluateSummaryV2NativeSurface,
  evaluateNativeRealizationContract,
  type SummaryV2NativeSurfaceResult,
} from './native-surface';

export const SUMMARY_V2_REWRITE_STYLE_384_REVISION =
  'summary-v2-rewrite-style-384-v1' as const;

/** Universal 12-locale four-button style contract (extends 384). */
export const SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION =
  'summary-v2-universal-four-button-385-v1' as const;

/**
 * Stronger strengthens grounded duty predicates — not role/employer shell markers.
 * Role intros stay natural/neutral across all 12 locales.
 */
export const SUMMARY_V2_STRONGER_DUTY_SURFACE_388_REVISION =
  'summary-v2-stronger-duty-surface-388-v1' as const;

/** Sparse Stronger: structure/verb-first; no intensifier sprinkling. */
export const SUMMARY_V2_STRONGER_SPARSE_MODIFIER_388_REVISION =
  'summary-v2-stronger-sparse-modifier-388-v1' as const;

export type SummaryV2RewriteStyle = 'shorter' | 'stronger' | 'professional';

export type SummaryV2SemanticOperation =
  | 'duration_hedge_compress'
  | 'duty_list_merge'
  | 'soft_filler_strip'
  | 'active_role_framing'
  | 'duty_predicate_strengthen'
  | 'formal_role_framing'
  | 'balanced_clarity_openers'
  | 'cohesion_transition';

export type SummaryV2StyleFulfillment = {
  shorterStyleFulfilled: boolean;
  strongerStyleFulfilled: boolean;
  professionalStyleFulfilled: boolean;
  styleValidationPassed: boolean;
  styleRejectionReasons: string[];
  selectedCandidateMateriallyDiffersFromSource: boolean;
  selectedCandidateDiffersFromOtherStyleFixtures?: boolean | null;
  sourceNormalizedLength: number;
  candidateNormalizedLength: number;
  lengthDelta: number;
  lengthDeltaPercent: number;
  sourceUnitCount: number;
  candidateUnitCount: number;
  sourceClauseCount: number;
  candidateClauseCount: number;
  unitDelta: number;
  clauseDelta: number;
  localeAwareShorterThresholdPercent: number | null;
  semanticStyleOperationsApplied: SummaryV2SemanticOperation[];
  markerOnlyStyleChange: boolean;
  styleMaterialityPassed: boolean;
  nativeSurfaceValidationPassed: boolean;
  nativeSurfaceRejectionReasons: string[];
  capitalizationValidationPassed: boolean;
  grammaticalPersonValidationPassed: boolean;
  currentTenseValidationPassed: boolean;
  priorTenseValidationPassed: boolean;
  finiteClauseValidationPassed: boolean;
  nativePunctuationValidationPassed: boolean;
  internalMarkerLeakageDetected: boolean;
  englishMorphologyLeakageDetected: boolean;
  /** Shared native realization contract (AAB-389). */
  unresolvedGenderPlaceholderDetected?: boolean;
  finiteDurationSentencePassed?: boolean;
  firstPersonPredicateChainPassed?: boolean;
  localeVerbMorphologyPassed?: boolean;
  roleCaseValidationPassed?: boolean;
  nativeCoordinationValidationPassed?: boolean;
  sentenceCompletenessPassed?: boolean;
  structuralCompressionCount: number;
  coordinatedPredicateCount?: number;
  transformedCoordinatedPredicateCount?: number;
  untransformedFinitePredicateCount?: number;
  mixedPersonPredicateDetected?: boolean;
  mixedTensePredicateDetected?: boolean;
  predicateChainValidationPassed?: boolean;
  predicateChainRejectionReasons?: string[];
  sourcePredicateChainHash?: string;
  finalPredicateChainHash?: string;
  /** Stronger sparse-modifier / structure diagnostics (AAB-388). */
  repeatedStyleModifierCount?: number;
  repeatedStyleModifierLemmas?: string[];
  stackedModifierDetected?: boolean;
  modifierOnlyTransformationDetected?: boolean;
  strongerVerbTransformationCount?: number;
  structuralStrengtheningCount?: number;
  nativeStrongSurfacePassed?: boolean;
  nativeStrongSurfaceRejectionReasons?: string[];
};

export type SummaryV2StyleTransformResult = {
  text: string;
  transformationKind: string | null;
  beforeHash: string | null;
  afterHash: string | null;
  styleFulfilled: boolean;
  styleRejectionReasons: string[];
  noSafeMaterialChange: boolean;
};

void SUMMARY_V2_REVISION;

export function normalizeSummaryV2RewriteStyle(
  raw: unknown,
): SummaryV2RewriteStyle | null {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'shorter' || s === 'stronger' || s === 'professional') return s;
  return null;
}

function normalizeComparable(text: string): string {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/[“”«»„]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .trim()
    .toLowerCase();
}

function hashNorm(text: string): string {
  return fingerprintText(normalizeComparable(text) || 'empty');
}

/** Soft / redundant German adjectives safe to drop for shorter. */
const DE_SHORTER_SOFT = /\b(?:herzlich|kompetent|serviceorientiert|freundlich|zuverlässig|sorgfältig|fundiert|zielgerichtet|insgesamt)\b/giu;

/** Duty-predicate Stronger markers — structural joins and sparse modifiers. */
const DE_STRONGER_MARKERS =
  /\b(?:sowie|sorgfältig|zuverlässig)\b/iu;
const DE_PROFESSIONAL_MARKERS =
  /\b(?:tätig|darüber\s+hinaus|in\s+dieser\s+Funktion|im\s+Rahmen)\b/iu;

const EN_STRONGER_MARKERS =
  /\b(?:as\s+well\s+as|carefully|thoroughly|I\s+bring|carry\s+out|carried\s+out)\b/iu;
const EN_PROFESSIONAL_MARKERS =
  /\b(?:employed\s+as|in\s+this\s+capacity|additionally)\b/iu;

/** Locale-family stronger markers — structural joins preferred over adverbs. */
const LOCALE_STRONGER_MARKERS: Partial<Record<Locale, RegExp>> = {
  es: /\b(?:a\s+la\s+vez\s+que|así\s+como|con\s+rigor)\b/iu,
  fr: /\b(?:ainsi\s+que|avec\s+rigueur)\b/iu,
  it: /(?:^|[^\p{L}])(?:nonché|con\s+rigore)(?=[^\p{L}]|$)/iu,
  'pt-BR': /\b(?:bem\s+como|com\s+rigor)\b/iu,
  // Avoid \\b — JS word boundaries are ASCII-only even with the /u flag.
  ru: /(?:а\s+также|тщательно)/u,
  sr: /\b(?:\ste\s|pouzdano|uredno)\b/iu,
  hr: /\b(?:\ste\s|pouzdano|uredno)\b/iu,
  ar: /(?: كما | ثم |بعناية|بكفاءة)/u,
  hi: /(?: तथा | साथ ही |सावधानीपूर्वक|निरंतर)/u,
  ja: /(?:においては|着実に|丁寧に)/u,
};

/** Unnatural / incomplete Stronger role-shell patterns — always reject. */
const UNNATURAL_STRONGER_ROLE_INTRO_RE =
  /zielgerichtet\s+als|\bübernahm(?:\s+\p{L}+){0,4}\s+als\b|\bdeliver(?:s|ed)?\s+as\b|carried\s+out\s+the\s+role\s+of|con\s+determinación\s+como|me\s+desempeño\s+con\s+determinación|aporto\s+como|m['’]investis(?:\s+\p{L}+){0,3}\s+comme|m['’]engageais\s+comme|con\s+determinazione\s+come|portato\s+avanti\s+il\s+ruolo|com\s+determinação\s+como|atuei\s+com\s+foco\s+como|веду\s+работу\s+как|уверенно\s+выполнял(?:\(а\))?\s+роль|doprinosim\s+kao|pridonosim\s+kao|pouzdano\s+izvršavao\/la\s+ulogu|أساهم\s+حالياً\s+بكفاءة\s+كـ|أسهمت\s+كـ|सक्रिय\s+रूप\s+से\s+कार्य\s+करता\/करती\s+हूँ|निर्णायक\s+रूप\s+से\s+कार्य|責任を持って推進|主体的に推進/iu;

const UNSUPPORTED_STRONGER_AUTHORITY_RE =
  /\b(?:Teamleiter|Leadership|owned\s+work|accountable\s+for|verantwortlich\s+für|verantwortlich\b|gewährleiste|stelle\s+sicher)\b|веду\s+команду|руковод|قيادة الفريق|チームを率/iu;

const LOCALE_PROFESSIONAL_MARKERS: Partial<Record<Locale, RegExp>> = {
  es: /\b(?:ejerzo|ejercí|en\s+calidad\s+de)\b/iu,
  fr: /\b(?:j['’]exerce|exercé|en\s+qualité\s+de)\b/iu,
  it: /\b(?:svolgo|ricoperto|in\s+qualità\s+di)\b/iu,
  'pt-BR': /\b(?:exerço|exerci|na\s+função\s+de)\b/iu,
  ru: /(?:занимаю\s+должность|занимал(?:\(а\))?\s+должность|в\s+качестве)/u,
  sr: /\b(?:obavljam|obavljao|u\s+svojstvu)\b/iu,
  hr: /\b(?:obavljam|obavljao|u\s+svojstvu)\b/iu,
  ar: /(?:أشغل|شغلت|بصفتي)/u,
  hi: /(?:पद\s+पर|के\s+रूप\s+में\s+सेवा)/u,
  ja: /(?:従事|就任|として職務)/u,
};

/**
 * Locale-aware shorter materiality. Normal substantial fixtures must show a
 * clearly noticeable reduction — mild 1–3% opener-only cuts do not pass.
 */
export function summaryV2ShorterMinLengthDeltaPercent(locale: Locale): number {
  if (locale === 'de') return -10;
  if (locale === 'en') return -8;
  // Dense scripts: character/clause reduction; still require ≥5% when possible.
  if (locale === 'ar' || locale === 'hi' || locale === 'ja') {
    return -5;
  }
  // Whitespace-tokenized languages: require ≥5% token/length reduction.
  return -5;
}

/** Token-ish count for whitespace languages; character count for ja/ar/hi. */
export function summaryV2CountUnits(text: string, locale: Locale): number {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  if (locale === 'ja') {
    return t.replace(/\s+/g, '').length;
  }
  if (locale === 'ar' || locale === 'hi') {
    return t.replace(/\s+/g, '').length;
  }
  return t.split(/\s+/u).filter(Boolean).length;
}

export function summaryV2ClauseCount(text: string): number {
  return (text || '')
    .split(/(?<=[.!?。؟।])\s+/u)
    .map((u) => u.trim())
    .filter(Boolean).length;
}

export function listSemanticStyleOperations(options: {
  style: SummaryV2RewriteStyle | 'balanced' | null;
  sourceText: string;
  candidateText: string;
  locale: Locale;
}): SummaryV2SemanticOperation[] {
  const src = (options.sourceText || '').replace(/\s+/g, ' ').trim();
  const cand = (options.candidateText || '').replace(/\s+/g, ' ').trim();
  const ops: SummaryV2SemanticOperation[] = [];
  if (!src || !cand || hashNorm(src) === hashNorm(cand)) return ops;
  if (/\s+[—–]\s+/.test(src) && !/\s+[—–]\s+/.test(cand)) {
    ops.push('duty_list_merge');
  }
  if (/;\s+/.test(src) && !/;\s+/.test(cand) && /,\s+/.test(cand)) {
    if (!ops.includes('duty_list_merge')) ops.push('duty_list_merge');
  }
  if (
    /,\s*where I\b/iu.test(src)
    && !/,\s*where I\b/iu.test(cand)
  ) {
    if (!ops.includes('duty_list_merge')) ops.push('duty_list_merge');
  }
  if (
    /\bsowie\b/iu.test(src)
    && !/\bsowie\b/iu.test(cand)
  ) {
    if (!ops.includes('duty_list_merge')) ops.push('duty_list_merge');
  }
  if (
    /alrededor de|environ |circa |iskustva| संयुक्त |通算で|insgesamt |aproximadamente|approximately/iu.test(src)
    && cand.length < src.length
  ) {
    ops.push('duration_hedge_compress');
  }
  if (options.style === 'shorter' && cand.length < src.length) {
    if (!ops.includes('soft_filler_strip') && src.length - cand.length >= 8) {
      ops.push('soft_filler_strip');
    }
  }
  if (options.style === 'stronger') {
    if (hasStrengthenedDutyPredicates(src, cand, options.locale)) {
      ops.push('duty_predicate_strengthen');
    } else if (strongerMarkerFor(options.locale)?.test(cand)) {
      // Legacy marker hit without duty-segment change — not a valid Stronger op.
      ops.push('active_role_framing');
    }
  }
  if (options.style === 'professional' && professionalMarkerFor(options.locale)?.test(cand)) {
    ops.push('formal_role_framing');
  }
  if (options.style === 'balanced') {
    ops.push('balanced_clarity_openers');
    if (/In my current role|In a previous role|En mi rol actual|Dans mon rôle|Nel mio ruolo|Na minha função atual|В текущей роли|U trenutnoj ulozi|في دوري الحالي|वर्तमान भूमिका|現職では/u.test(cand)) {
      ops.push('cohesion_transition');
    }
  }
  return ops;
}

/**
 * True when styled text differs only by removable style adverbs/ornaments.
 * Verb/framing changes (desempeño/ejerzo/tätig/employed) keep letter-core different.
 */
export function isSummaryV2MarkerOnlyStyleChange(
  base: string,
  styled: string,
  locale: Locale,
  style: SummaryV2RewriteStyle,
): boolean {
  void locale;
  const b = (base || '').replace(/\s+/g, ' ').trim();
  const s = (styled || '').replace(/\s+/g, ' ').trim();
  if (!b || !s || hashNorm(b) === hashNorm(s)) return false;
  let stripped = s;
  if (style === 'stronger') {
    // Strip removable intensifiers only. Verb/particle rewrites in duty clauses
    // (führe … durch, as well as, etc.) keep letter-cores distinct.
    stripped = stripped
      .replace(/\b(?:sorgfältig|zuverlässig|carefully|thoroughly|consistently)\b/giu, '')
      .replace(/\bcon rigor\b/giu, '')
      .replace(/\bde forma constante\b/giu, '')
      .replace(/\bavec rigueur\b/giu, '')
      .replace(/\bde façon assidue\b/giu, '')
      .replace(/\bcon rigore\b/giu, '')
      .replace(/\bin modo costante\b/giu, '')
      .replace(/\bcom rigor\b/giu, '')
      .replace(/тщательно\s*/gu, '')
      .replace(/уверенно\s*/gu, '')
      .replace(/\bpouzdano\b/giu, '')
      .replace(/\bpažljivo\b/giu, '')
      // Keep SR/HR "uredno" / " te " — material Stronger signals (not adverb-only).
      // Do not reverse " te " → " i " here or duty Stronger is falsely marker-only.
      .replace(/بعناية\s*/gu, '')
      .replace(/بكفاءة\s*/gu, '')
      .replace(/सावधानीपूर्वक\s*/gu, '')
      .replace(/निरंतर\s*/gu, '')
      .replace(/着実に/gu, '')
      .replace(/丁寧に/gu, '');
      // Keep structural joins (as well as / así como / ainsi que / nonché / bem como /
      // sowie / te / ثم / 、また) — reversing them falsely marks duty Stronger as
      // marker-only when intensifiers are stripped.
  } else if (style === 'professional') {
    stripped = stripped
      .replace(/\bin this capacity\b/giu, '')
      .replace(/\badditionally\b/giu, '')
      .replace(/\ben calidad de\b/giu, '')
      .replace(/\ben qualité de\b/giu, '')
      .replace(/\bin qualità di\b/giu, '')
      .replace(/\bna função de\b/giu, '')
      .replace(/\bu svojstvu\b/giu, '')
      .replace(/в качестве\s*/gu, '');
  }
  stripped = stripped.replace(/\s+/g, ' ').trim();
  const baseLetters = normalizeComparable(b).replace(/[^\p{L}\p{N}]+/gu, '');
  const stripLetters = normalizeComparable(stripped).replace(/[^\p{L}\p{N}]+/gu, '');
  return Boolean(stripLetters) && stripLetters === baseLetters;
}

function strongerMarkerFor(locale: Locale): RegExp | null {
  if (locale === 'de') return DE_STRONGER_MARKERS;
  if (locale === 'en') return EN_STRONGER_MARKERS;
  return LOCALE_STRONGER_MARKERS[locale] || null;
}

function professionalMarkerFor(locale: Locale): RegExp | null {
  if (locale === 'de') return DE_PROFESSIONAL_MARKERS;
  if (locale === 'en') return EN_PROFESSIONAL_MARKERS;
  return LOCALE_PROFESSIONAL_MARKERS[locale] || null;
}

/** Shared soft-filler strip for shorter (never touches roles/employers/facts/duration hedges). */
function stripSharedSoftFillers(text: string, locale: Locale): string {
  let t = text;
  if (locale === 'de') return stripDeSoft(t);
  t = t
    .replace(/\b(?:really|very|quite|rather|très|muy|molto|bastante)\b/giu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:。、])/gu, '$1')
    .trim();
  return t;
}

/** Drop soft German adjectives without leaving dangling conjunctions. */
function stripDeSoft(text: string): string {
  return text
    .replace(/\b(?:kompetent|serviceorientiert)\s+und\s+(?:kompetent|serviceorientiert)\b/giu, '')
    .replace(DE_SHORTER_SOFT, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/\s+und\s+und\b/giu, ' und ')
    .replace(/\s+und\s+(?=[,.]|$)/giu, ' ')
    .replace(/(\s+und)\s+(?=\p{L}+\s+(?:beantwortete|begrüßte|prüfe|durchführe))/giu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Extract relative-clause duty bodies (after wo ich / where I / donde / …). */
function extractDutySegments(text: string, locale: Locale): string[] {
  const t = text || '';
  const out: string[] = [];
  const pushMatches = (re: RegExp) => {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null = global.exec(t);
    while (m) {
      if (m[1]) out.push(m[1]);
      m = global.exec(t);
    }
  };
  if (locale === 'de') {
    pushMatches(/,\s*wo ich\s+([^.]+)/giu);
  } else if (locale === 'en') {
    pushMatches(/,\s*where I\s+([^.]+)/giu);
  } else if (locale === 'es') {
    pushMatches(/,\s*donde\s+([^.]+)/giu);
  } else if (locale === 'fr') {
    pushMatches(/,\s*où j(?:e\s+|')([^.]+)/giu);
  } else if (locale === 'it') {
    pushMatches(/,\s*dove\s+([^.]+)/giu);
  } else if (locale === 'pt-BR') {
    pushMatches(/,\s*onde\s+([^.]+)/giu);
  } else if (locale === 'ru') {
    pushMatches(/,\s*где я\s+([^.]+)/gu);
  } else if (locale === 'sr') {
    pushMatches(/,\s*gde(?:\s+sam)?\s+([^.]+)/giu);
  } else if (locale === 'hr') {
    pushMatches(/,\s*gdje(?:\s+sam)?\s+([^.]+)/giu);
  } else if (locale === 'ar') {
    pushMatches(/،\s*حيث\s+([^.。]+)/gu);
  } else if (locale === 'hi') {
    pushMatches(/तथा\s+([^।]+)/gu);
  } else if (locale === 'ja') {
    // Capture the duty opener too — the Stronger register shift lives there.
    pushMatches(/。業務((?:では|においては、)[^。]+)/gu);
  }
  return out;
}

function lettersOnly(text: string): string {
  return normalizeComparable(text).replace(/[^\p{L}\p{N}]+/gu, '');
}

/** True when duty-clause letter cores differ (role shells may match). */
function hasStrengthenedDutyPredicates(
  source: string,
  candidate: string,
  locale: Locale,
): boolean {
  const srcSegs = extractDutySegments(source, locale);
  const candSegs = extractDutySegments(candidate, locale);
  if (candSegs.length === 0) return false;
  if (UNNATURAL_STRONGER_ROLE_INTRO_RE.test(candidate)) return false;
  // Cross-locale enhance: source may be another script without target duty
  // connectors. Accept when candidate has duty markers + material duty text.
  if (srcSegs.length === 0) {
    const markerOk = strongerMarkerFor(locale)?.test(candidate) === true;
    const structural = /(?:\bsowie\b|\bas well as\b|\ba la vez que\b|\basí como\b|\bainsi que\b|nonché|\bbem como\b|а также|\s+te\s+| كما | ثم |においては| तथा | साथ ही )/iu
      .test(candSegs.join(' '));
    return markerOk && (structural || candSegs.some((s) => s.length >= 12));
  }
  const n = Math.min(srcSegs.length, candSegs.length);
  for (let i = 0; i < n; i += 1) {
    if (lettersOnly(srcSegs[i]) !== lettersOnly(candSegs[i])) return true;
  }
  return candSegs.length !== srcSegs.length;
}

type StrongerClauseTransform = {
  text: string;
  structuralCount: number;
  verbCount: number;
  intensifierLemma: string | null;
};

const STYLE_INTENSIFIER_LEMMAS: Array<{ lemma: string; re: RegExp }> = [
  { lemma: 'zuverlässig', re: /\bzuverlässig\b/giu },
  { lemma: 'sorgfältig', re: /\bsorgfältig\b/giu },
  { lemma: 'carefully', re: /\bcarefully\b/giu },
  { lemma: 'thoroughly', re: /\bthoroughly\b/giu },
  { lemma: 'con rigor', re: /\bcon\s+rigor\b/giu },
  { lemma: 'avec rigueur', re: /\bavec\s+rigueur\b/giu },
  { lemma: 'con rigore', re: /\bcon\s+rigore\b/giu },
  { lemma: 'com rigor', re: /\bcom\s+rigor\b/giu },
  { lemma: 'тщательно', re: /тщательно/gu },
  { lemma: 'pouzdano', re: /\bpouzdano\b/giu },
  { lemma: 'uredno', re: /\buredno\b/giu },
  { lemma: 'بعناية', re: /بعناية/gu },
  { lemma: 'بكفاءة', re: /بكفاءة/gu },
  { lemma: 'सावधानीपूर्वक', re: /सावधानीपूर्वक/gu },
  { lemma: '着実に', re: /着実に/gu },
  { lemma: '丁寧に', re: /丁寧に/gu },
];

const PREEXISTING_SOFT_MODIFIER_RE =
  /\b(?:herzlich|kompetent|serviceorientiert|freundlich|sorgfältig|zuverlässig|carefully|thoroughly|consistently|con\s+rigor|avec\s+rigueur|con\s+rigore|com\s+rigor|pouzdano|uredno)\b|тщательно|بعناية|بكفاءة|सावधानीपूर्वक|着実に|丁寧に/iu;

const DE_FINITE_1SG_RE =
  /^(?:durchführe|durchführte|prüfe|prüfte|austausche|austauschte|begrüßte|erfasste|bearbeitete|beantwortete|kontrolliere|kontrollierte|abstimme|abstimmte|koordinierte|erstellte)$/iu;

const DE_SOFT_PAIR_RE =
  /^(?:kompetent|serviceorientiert|herzlich|freundlich|sorgfältig|zuverlässig)$/iu;

const STRUCTURAL_JOIN_RE =
  /(?:^|[^\p{L}])(?:sowie|as\s+well\s+as|a\s+la\s+vez\s+que|así\s+como|ainsi\s+que|nonché|bem\s+como)(?=[^\p{L}]|$)|а\s+также|\s+te\s+| كما | ثم |においては| तथा | साथ ही /iu;

const STACKED_MODIFIER_RE =
  /\b(?:herzlich|kompetent|serviceorientiert|freundlich)\b[^.]{0,50}\b(?:zuverlässig|sorgfältig)\b|\b(?:zuverlässig|sorgfältig)\b[^.]{0,50}\b(?:herzlich|kompetent|serviceorientiert|freundlich)\b|\b(?:kompetent\s+und\s+serviceorientiert)\s+zuverlässig\b|\b(?:carefully|thoroughly)\s+(?:carefully|thoroughly)\b|\bpouzdano\s+uredno\b|\buredno\s+pouzdano\b/iu;

/** Misspelled / cross-locale intensifiers that must never pass Stronger checks. */
const MISSPELLED_STYLE_MODIFIER_RES: Array<{
  token: string;
  re: RegExp;
  /** If set, the misspelling only applies in these locales. */
  locales?: Locale[];
}> = [
  { token: 'con ricore', re: /\bcon\s+ricore\b/giu },
  { token: 'con rigour', re: /\bcon\s+rigour\b/giu },
  { token: 'avec riguer', re: /\bavec\s+riguer\b/giu },
  { token: 'avec rigor', re: /\bavec\s+rigor\b/giu },
  { token: 'com rigour', re: /\bcom\s+rigour\b/giu },
  // Spanish "con rigor" is invalid Italian; Italian "con rigore" is invalid Spanish.
  { token: 'con rigor', re: /\bcon\s+rigor\b/giu, locales: ['it'] },
  { token: 'con rigore', re: /\bcon\s+rigore\b/giu, locales: ['es', 'pt-BR', 'fr'] },
  { token: 'sorgfaltig', re: /\bsorgfaltig\b/giu },
  { token: 'zuverlassig', re: /\bzuverlassig\b/giu },
  { token: 'carefuly', re: /\bcarefuly\b/giu },
  { token: 'thorougly', re: /\bthorougly\b/giu },
];

/** Per-locale allowlist of Stronger intensifier lemmas. */
const LOCALE_ALLOWED_INTENSIFIER_LEMMAS: Partial<Record<Locale, string[]>> = {
  de: ['sorgfältig', 'zuverlässig'],
  en: ['carefully', 'thoroughly'],
  es: ['con rigor'],
  fr: ['avec rigueur'],
  it: ['con rigore'],
  'pt-BR': ['com rigor'],
  ru: ['тщательно'],
  sr: ['pouzdano', 'uredno'],
  hr: ['pouzdano', 'uredno'],
  ar: ['بعناية', 'بكفاءة'],
  hi: ['सावधानीपूर्वक'],
  ja: ['着実に', '丁寧に'],
};

function countRegexMatches(text: string, re: RegExp): number {
  const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  return [...(text || '').matchAll(global)].length;
}

/** Analyze Stronger surface for sprinkling / stacking / modifier-only transforms. */
export function analyzeStrongerNativeSurface(options: {
  sourceText: string;
  candidateText: string;
  locale: Locale;
}): {
  repeatedStyleModifierCount: number;
  repeatedStyleModifierLemmas: string[];
  stackedModifierDetected: boolean;
  modifierOnlyTransformationDetected: boolean;
  strongerVerbTransformationCount: number;
  structuralStrengtheningCount: number;
  nativeStrongSurfacePassed: boolean;
  nativeStrongSurfaceRejectionReasons: string[];
} {
  void SUMMARY_V2_STRONGER_SPARSE_MODIFIER_388_REVISION;
  const source = (options.sourceText || '').replace(/\s+/g, ' ').trim();
  const candidate = (options.candidateText || '').replace(/\s+/g, ' ').trim();
  const reasons: string[] = [];

  const repeatedLemmas: string[] = [];
  let repeatedCount = 0;
  for (const { lemma, re } of STYLE_INTENSIFIER_LEMMAS) {
    const n = countRegexMatches(candidate, re);
    if (n > 1) {
      repeatedLemmas.push(lemma);
      repeatedCount += n - 1;
    }
  }

  const stackedModifierDetected = STACKED_MODIFIER_RE.test(candidate);

  for (const { token, re, locales } of MISSPELLED_STYLE_MODIFIER_RES) {
    if (locales && !locales.includes(options.locale)) continue;
    if (countRegexMatches(candidate, re) > 0) {
      reasons.push(`misspelled_style_modifier:${token}`);
    }
  }

  const allowed = LOCALE_ALLOWED_INTENSIFIER_LEMMAS[options.locale];
  if (allowed) {
    for (const { lemma, re } of STYLE_INTENSIFIER_LEMMAS) {
      if (countRegexMatches(candidate, re) > 0 && !allowed.includes(lemma)) {
        reasons.push(`unknown_modifier_token:${lemma}`);
      }
    }
  }

  const srcSegs = extractDutySegments(source, options.locale);
  const candSegs = extractDutySegments(candidate, options.locale);
  const srcDuty = srcSegs.join(' || ');
  const candDuty = candSegs.join(' || ');
  // Cross-locale enhance: source may be another script without target duty
  // connectors. Do not let foreign structural tokens cancel target joins.
  const srcStructural = srcSegs.length > 0
    ? countRegexMatches(srcDuty, STRUCTURAL_JOIN_RE)
    : 0;
  const candStructural = countRegexMatches(
    candSegs.length > 0 ? candDuty : candidate,
    STRUCTURAL_JOIN_RE,
  );
  const structuralStrengtheningCount = Math.max(0, candStructural - srcStructural);

  const verbPairs: Array<[RegExp, RegExp]> = [
    [/\bperform\b/iu, /\bcarry\s+out\b/iu],
    [/\bperformed\b/iu, /\bcarried\s+out\b/iu],
    [/\bI have\b/iu, /\bI bring\b/iu],
  ];
  let strongerVerbTransformationCount = 0;
  for (const [from, to] of verbPairs) {
    if (from.test(source) && to.test(candidate) && !to.test(source)) {
      strongerVerbTransformationCount += 1;
    }
  }
  // Duration opener I have → I bring counts as verb/rhythm strengthening.
  if (/\bI bring\b/iu.test(candidate) && /\bI have\b/iu.test(source)) {
    strongerVerbTransformationCount = Math.max(strongerVerbTransformationCount, 1);
  }

  let sourceIntensifiers = 0;
  let candIntensifiers = 0;
  for (const { re } of STYLE_INTENSIFIER_LEMMAS) {
    sourceIntensifiers += countRegexMatches(source, re);
    candIntensifiers += countRegexMatches(candidate, re);
  }
  const modifierOnlyTransformationDetected = candIntensifiers > sourceIntensifiers
    && structuralStrengtheningCount === 0
    && strongerVerbTransformationCount === 0
    && hashNorm(source) !== hashNorm(candidate);

  if (repeatedCount > 0) reasons.push('repeated_style_modifier');
  if (stackedModifierDetected) reasons.push('stacked_modifier');
  if (modifierOnlyTransformationDetected) reasons.push('modifier_only_transformation');

  // Shared native realization contract — a Stronger candidate can never be
  // green while it still carries a placeholder, fragment or malformed form.
  const realization = evaluateNativeRealizationContract({
    text: candidate,
    locale: options.locale,
  });
  for (const r of realization.nativeRealizationRejectionReasons) {
    if (!reasons.includes(r)) reasons.push(r);
  }

  const nativeStrongSurfacePassed = reasons.length === 0
    && (structuralStrengtheningCount > 0 || strongerVerbTransformationCount > 0);

  if (!nativeStrongSurfacePassed && reasons.length === 0) {
    reasons.push('stronger_needs_structure_or_verb');
  }

  return {
    repeatedStyleModifierCount: repeatedCount,
    repeatedStyleModifierLemmas: repeatedLemmas,
    stackedModifierDetected,
    modifierOnlyTransformationDetected,
    strongerVerbTransformationCount,
    structuralStrengtheningCount,
    nativeStrongSurfacePassed,
    nativeStrongSurfaceRejectionReasons: reasons,
  };
}

/**
 * Strengthen one duty clause: structure/verb first; at most one sparse intensifier.
 * Never stack onto preexisting soft modifiers; never reuse a lemma already used.
 */
function strengthenDutyClauseBody(
  body: string,
  locale: Locale,
  usedIntensifierLemmas: Set<string>,
): StrongerClauseTransform {
  let b = (body || '').replace(/\s+/g, ' ').trim();
  if (!b) {
    return { text: b, structuralCount: 0, verbCount: 0, intensifierLemma: null };
  }

  let structuralCount = 0;
  const verbCount = 0;
  let intensifierLemma: string | null = null;
  const allowIntensifier = (lemma: string): boolean => (
    !usedIntensifierLemmas.has(lemma) && !PREEXISTING_SOFT_MODIFIER_RE.test(b)
  );

  if (locale === 'de') {
    const before = b;
    b = b.replace(/(\p{L}+)\s+und\s+(\p{L}+)/gu, (full, left: string, right: string) => {
      if (DE_SOFT_PAIR_RE.test(left) || DE_SOFT_PAIR_RE.test(right)) return full;
      if (DE_FINITE_1SG_RE.test(right)) return full;
      return `${left} sowie ${right}`;
    });
    if (b !== before) structuralCount += 1;
    // Prefer comma→sowie when und→sowie did not fire (and body lacks sowie).
    if (structuralCount === 0 && !/\bsowie\b/iu.test(b) && /,\s+\S+/u.test(b)) {
      b = b.replace(/,\s+([^,]+)$/u, ' sowie $1');
      structuralCount += 1;
    }
    // Sparse intensifier only after structure, never onto soft-modified phrases.
    if (
      structuralCount > 0
      && allowIntensifier('sorgfältig')
      && /\bprüfe\b/iu.test(b)
    ) {
      b = b.replace(/\bprüfe\b/iu, 'sorgfältig prüfe');
      intensifierLemma = 'sorgfältig';
    } else if (
      structuralCount > 0
      && allowIntensifier('sorgfältig')
      && /\bprüfte\b/iu.test(b)
    ) {
      b = b.replace(/\bprüfte\b/iu, 'sorgfältig prüfte');
      intensifierLemma = 'sorgfältig';
    }
    return {
      text: b.replace(/\s+/g, ' ').trim(),
      structuralCount,
      verbCount,
      intensifierLemma,
    };
  }

  if (locale === 'en') {
    if (/,\s+and\s+/iu.test(b)) {
      b = b.replace(/,\s+and\s+/iu, ', as well as ');
      structuralCount += 1;
    } else if (/,\s+/u.test(b) && !/\bas well as\b/iu.test(b)) {
      b = b.replace(/,\s+([^,]+)$/u, ', as well as $1');
      structuralCount += 1;
    }
    // Sparse intensifier only after structure.
    if (structuralCount > 0 && allowIntensifier('carefully') && /\bperform\b/iu.test(b)) {
      b = b.replace(/\bperform\b/iu, 'carefully perform');
      intensifierLemma = 'carefully';
    } else if (structuralCount > 0 && allowIntensifier('carefully') && /\bperformed\b/iu.test(b)) {
      b = b.replace(/\bperformed\b/iu, 'carefully performed');
      intensifierLemma = 'carefully';
    } else if (structuralCount > 0 && allowIntensifier('thoroughly') && /\binspect\b/iu.test(b)) {
      b = b.replace(/\binspect\b/iu, 'thoroughly inspect');
      intensifierLemma = 'thoroughly';
    } else if (structuralCount > 0 && allowIntensifier('thoroughly') && /\binspected\b/iu.test(b)) {
      b = b.replace(/\binspected\b/iu, 'thoroughly inspected');
      intensifierLemma = 'thoroughly';
    }
    return {
      text: b.replace(/\s+/g, ' ').trim(),
      structuralCount,
      verbCount,
      intensifierLemma,
    };
  }

  const sparseJoin = (
    joinRe: RegExp,
    joinTo: string,
    intensifier: string,
    prefix: boolean,
  ): StrongerClauseTransform => {
    let t = b;
    let structural = 0;
    let intens: string | null = null;
    if (joinRe.test(t) || /,\s+/u.test(t)) {
      const parts = t.split(/,\s*/u).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        t = `${parts.slice(0, -1).join(', ')}${joinTo}${parts[parts.length - 1]}`;
        structural += 1;
      } else {
        const next = t.replace(joinRe, joinTo);
        if (next !== t) {
          t = next;
          structural += 1;
        }
      }
    }
    // Intensifier only when structure already changed — never adverb-only Stronger.
    if (structural > 0 && allowIntensifier(intensifier)) {
      const bumped = t.replace(
        /^((?:ho|ha|he|hei|havía|havia)\s+)?(\p{L}+)(?=[^\p{L}]|$)/iu,
        (_m, aux: string | undefined, verb: string) => {
          const head = aux || '';
          return prefix
            ? `${head}${intensifier} ${verb}`
            : `${head}${verb} ${intensifier}`;
        },
      );
      if (bumped !== t) {
        t = bumped;
        intens = intensifier;
      }
    }
    return {
      text: t.replace(/\s+/g, ' ').trim(),
      structuralCount: structural,
      verbCount: 0,
      intensifierLemma: intens,
    };
  };

  // "así como" before a finite verb is stilted; "a la vez que" coordinates
  // finite predicates naturally in professional Spanish.
  if (locale === 'es') {
    const transformed = sparseJoin(/\s+y\s+/iu, ', a la vez que ', 'con rigor', false);
    return {
      ...transformed,
      text: transformed.text.replace(/\ba la vez que\s+y\s+/iu, 'a la vez que '),
    };
  }
  if (locale === 'fr') {
    // "ainsi que" coordinating finite predicates requires an explicit subject —
    // "ainsi que remplace" is ungrammatical; "ainsi que je remplace" is natural.
    const withSubject = (tail: string): string => {
      const body = tail.replace(/^\s+/u, '');
      return /^[aeiouâàáäæéèêëíìîïóòôöøúùûüœh]/iu.test(body)
        ? `, ainsi que j'${body}`
        : `, ainsi que je ${body}`;
    };
    let t = b;
    let structural = 0;
    let intens: string | null = null;
    if (/\s+et\s+/iu.test(t)) {
      t = t.replace(/^(.*)\s+et\s+(.*)$/iu, (_m, head: string, tail: string) => (
        `${head}${withSubject(tail)}`
      ));
      structural += 1;
    } else if (/,\s+/u.test(t)) {
      const parts = t.split(/,\s*/u).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        t = `${parts.slice(0, -1).join(', ')}${withSubject(parts[parts.length - 1])}`;
        structural += 1;
      }
    }
    if (structural > 0 && allowIntensifier('avec rigueur')) {
      const bumped = t.replace(
        /^(\p{L}+)(?=[^\p{L}]|$)/iu,
        (verb: string) => `${verb} avec rigueur`,
      );
      if (bumped !== t) {
        t = bumped;
        intens = 'avec rigueur';
      }
    }
    // Repair accidental "je effectue" if a non-elided connector leaked in.
    t = t
      .replace(/\bje\s+(?=[aeiouhâàáâäæéèêëíìîïóòôöøúùûüœ])/giu, "j'")
      .replace(/\s+/g, ' ')
      .replace(/\s+,/gu, ',')
      .trim();
    return {
      text: t,
      structuralCount: structural,
      verbCount: 0,
      intensifierLemma: intens,
    };
  }
  if (locale === 'it') {
    // Normalize residual biography auxiliaries inside relative clauses.
    b = b.replace(/\bha\s+/giu, 'ho ');
    return sparseJoin(/\s+e\s+/iu, ', nonché ', 'con rigore', false);
  }
  if (locale === 'pt-BR') {
    const result = sparseJoin(/\s+(?:e|y)\s+/iu, ', bem como ', 'com rigor', false);
    return {
      ...result,
      text: result.text.replace(/\s+y\s+/giu, ' e ').replace(/\s+/g, ' ').trim(),
    };
  }
  if (locale === 'ru') {
    return sparseJoin(/\s+и\s+/u, ', а также ', 'тщательно', true);
  }
  if (locale === 'sr' || locale === 'hr') {
    const parts = b.split(/,\s*/u).map((p) => p.trim()).filter(Boolean);
    let t = b;
    let structural = 0;
    let intens: string | null = null;
    if (parts.length >= 2) {
      t = parts.join(' te ');
      structural += 1;
    } else {
      // No commas: keep the first coordinated "i" (dual 1sg pair), promote the
      // final duty-level "i" to "te" when multiple "i" joins exist.
      const iMatches = [...t.matchAll(/\s+i\s+/giu)];
      if (iMatches.length >= 2) {
        t = t.replace(/^(.*)(\s+i\s+)(.*)$/iu, '$1 te $3');
        structural += 1;
      } else if (iMatches.length === 1) {
        // Two duties joined by a single "i" (not an intra-bullet dual pair only).
        t = t.replace(/\s+i\s+/iu, ' te ');
        structural += 1;
      }
    }
    if (structural > 0 && allowIntensifier('pouzdano')) {
      const bumped = t.replace(/^(\p{L}+)(?=[^\p{L}]|$)/u, 'pouzdano $1');
      if (bumped !== t) {
        t = bumped;
        intens = 'pouzdano';
      }
    }
    return {
      text: t.replace(/\s+/g, ' ').trim(),
      structuralCount: structural,
      verbCount: 0,
      intensifierLemma: intens,
    };
  }
  if (locale === 'ar') {
    let t = b;
    let structural = 0;
    let intens: string | null = null;
    // "كما" coordinates clauses without implying temporal sequence (unlike "ثم").
    if (/،\s*/u.test(t)) {
      t = t.replace(/،\s*/u, '، كما ');
      structural += 1;
    } else if (/ و/u.test(t)) {
      t = t.replace(/ و/u, ' كما ');
      structural += 1;
    }
    if (structural > 0 && allowIntensifier('بعناية')) {
      const bumped = t.replace(/(^|،\s*|ثم\s*)(أ[\u0600-\u06FF]+)/u, (m, lead: string, verb: string) => (
        /بعناية/.test(m) ? m : `${lead}${verb} بعناية`
      ));
      if (bumped !== t) {
        t = bumped;
        intens = 'بعناية';
      }
    }
    return {
      text: t.replace(/\s+/g, ' ').trim(),
      structuralCount: structural,
      verbCount: 0,
      intensifierLemma: intens,
    };
  }
  if (locale === 'hi') {
    let t = b;
    let structural = 0;
    let intens: string | null = null;
    // The duty tail already opens with "तथा" — use "साथ ही" so Stronger never
    // repeats the same connector twice in one sentence.
    if (/ और /u.test(t)) {
      t = t.replace(/ और /u, ', साथ ही ');
      structural += 1;
    } else if (/,\s+/u.test(t)) {
      t = t.replace(/,\s+([^,]+)$/u, ', साथ ही $1');
      structural += 1;
    }
    if (structural > 0 && allowIntensifier('सावधानीपूर्वक')) {
      const bumped = t.replace(
        /(करता\/करती हूँ|करता\/करती था\/थी|करता हूँ|करती हूँ|जाँच करता हूँ|बदलता हूँ)/u,
        (m) => (/सावधानीपूर्वक/.test(m) ? m : `सावधानीपूर्वक ${m}`),
      );
      if (bumped !== t) {
        t = bumped;
        intens = 'सावधानीपूर्वक';
      } else if (!/सावधानीपूर्वक/u.test(t)) {
        t = `सावधानीपूर्वक ${t}`;
        intens = 'सावधानीपूर्वक';
      }
    }
    return {
      text: t.replace(/\s+/g, ' ').trim(),
      structuralCount: structural,
      verbCount: 0,
      intensifierLemma: intens,
    };
  }
  if (locale === 'ja') {
    // Formal register shift on the duty opener — never repeated mechanical 「また」.
    let t = b;
    let structural = 0;
    let intens: string | null = null;
    if (/^では/u.test(t)) {
      t = t.replace(/^では/u, 'においては、');
      structural += 1;
    }
    t = t.replace(/、また/gu, '、');
    if (structural > 0 && allowIntensifier('着実に') && !/着実に/u.test(t)) {
      t = t.replace(/、([^、]+?)(し|い|き|ぎ|ち|び|み|り)(?=、)/u, '、着実に$1$2');
      if (!/着実に/u.test(t)) {
        t = t.replace(/(においては、)/u, '$1着実に');
      }
      if (/着実に/u.test(t)) intens = '着実に';
    }
    return {
      text: t.replace(/\s+/g, ' ').trim(),
      structuralCount: structural,
      verbCount: 0,
      intensifierLemma: intens,
    };
  }

  return {
    text: b.replace(/\s+/g, ' ').trim(),
    structuralCount: 0,
    verbCount: 0,
    intensifierLemma: null,
  };
}

/**
 * Map relative-clause duty segments through sparse strengthenDutyClauseBody.
 * Never rewrites role/employer introductions. At most one intensifier lemma
 * per Summary; at most one intensifier per role sentence.
 */
function applyStrongerDutyPredicateSurface(text: string, locale: Locale): string {
  void SUMMARY_V2_STRONGER_DUTY_SURFACE_388_REVISION;
  void SUMMARY_V2_STRONGER_SPARSE_MODIFIER_388_REVISION;
  let t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;

  const usedLemmas = new Set<string>();
  const rewrite = (lead: string, body: string): string => {
    const result = strengthenDutyClauseBody(body, locale, usedLemmas);
    if (result.intensifierLemma) usedLemmas.add(result.intensifierLemma);
    return `${lead}${result.text}`;
  };

  if (locale === 'de') {
    t = t.replace(/(,\s*wo ich\s+)([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'en') {
    t = t
      .replace(/\bI have\b/giu, 'I bring')
      .replace(/(,\s*where I\s+)([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'es') {
    t = t.replace(/(,\s*donde\s+)([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'fr') {
    t = t.replace(/(,\s*où j(?:e\s+|'))([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'it') {
    const before = t;
    t = t.replace(/(,\s*dove\s+)([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
    if (t === before) {
      // Shorter may strip "dove" — still strengthen post-employer duty lists.
      t = t.replace(
        /(presso\s+[^,]+,\s*)(?!dove\s)([^.]+)/giu,
        (_m, lead: string, body: string) => rewrite(lead, body),
      );
    }
  } else if (locale === 'pt-BR') {
    const before = t;
    t = t.replace(/(,\s*onde\s+)([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
    if (t === before) {
      t = t.replace(
        /(na\s+[^,]+,\s*|em\s+[^,]+,\s*)(?!onde\s)([^.]+)/giu,
        (_m, lead: string, body: string) => rewrite(lead, body),
      );
    }
  } else if (locale === 'ru') {
    t = t.replace(/(,\s*где я\s+)([^.]+)/gu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'sr') {
    t = t.replace(/(,\s*gde(?:\s+sam)?\s+)([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'hr') {
    t = t.replace(/(,\s*gdje(?:\s+sam)?\s+)([^.]+)/giu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'ar') {
    t = t.replace(/(،\s*حيث\s+)([^.。]+)/gu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'hi') {
    t = t.replace(/(तथा\s+)([^।]+)/gu, (_m, lead: string, body: string) => rewrite(lead, body));
  } else if (locale === 'ja') {
    t = t.replace(
      /(。業務)((?:では|においては、)[^。]+)/gu,
      (_m, lead: string, body: string) => rewrite(lead, body),
    );
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Style transforms start from the canonical German V2 surface so duty clauses,
 * tense, and entry ownership stay intact — then apply claim-safe wording edits.
 */
function buildGermanStyledFromManifest(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  void dutyTenseFromEmploymentState;
  void bulletToGermanWoIchClause;
  const base = buildGermanSummaryV2FromManifest(manifest);

  if (style === 'shorter') {
    // Keep the three-unit topology (duration / current / prior) so slot lineage
    // stays aligned; compress via duration wording + soft adjectives + sowie→und.
    // Do not strip "wo ich" finite-clause openers (German grammar gate).
    // Do not rewrite duty stems — tense/coverage matching requires live bullet cores.
    let t = base
      .replace(/\binsgesamt\s+/giu, '')
      .replace(/Ich verfüge über etwa/iu, 'Ich habe')
      .replace(/Ich verfüge über/iu, 'Ich habe')
      .replace(/\betwa\s+/giu, '')
      .replace(/\bBerufserfahrung\b/giu, 'Erfahrung')
      .replace(/Derzeit arbeite ich als/iu, 'Derzeit bin ich als')
      .replace(/Zuvor arbeitete ich als/iu, 'Zuvor war ich als')
      .replace(
        /\b(anderthalb|zweieinhalb|dreieinhalb|viereinhalb|fünfeinhalb|sechseinhalb|siebeneinhalb|achteinhalb|neuneinhalb|zehneinhalb)\b/giu,
        (m: string) => {
          const map: Record<string, string> = {
            anderthalb: '1,5',
            zweieinhalb: '2,5',
            dreieinhalb: '3,5',
            viereinhalb: '4,5',
            fünfeinhalb: '5,5',
            sechseinhalb: '6,5',
            siebeneinhalb: '7,5',
            achteinhalb: '8,5',
            neuneinhalb: '9,5',
            zehneinhalb: '10,5',
          };
          return map[m.toLowerCase()] || m;
        },
      );
    t = stripDeSoft(t);
    t = t.replace(/\ssowie\s+/giu, ' und ');
    t = t.replace(/\s+des Hotels\b/giu, '');
    return t.replace(/\s+/g, ' ').trim();
  }

  if (style === 'stronger') {
    // Keep natural role intros; strengthen grounded duty predicates only.
    return applyStrongerDutyPredicateSurface(base, 'de');
  }

  // professional — formal tätig framing; keep duty clauses verbatim.
  return base
    .replace(
      /Derzeit arbeite ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
      'Derzeit bin ich als $1 bei $2 tätig, wo ich',
    )
    .replace(
      /Derzeit arbeite ich als ([^,]+?), wo ich/iu,
      'Derzeit bin ich als $1 tätig, wo ich',
    )
    .replace(
      /Zuvor arbeitete ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
      'Zuvor war ich als $1 bei $2 tätig, wo ich',
    )
    .replace(
      /Zuvor arbeitete ich als ([^,]+?), wo ich/iu,
      'Zuvor war ich als $1 tätig, wo ich',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEnglishStyledFromManifest(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  const base = buildSummaryV2DeterministicText(manifest);
  if (style === 'shorter') {
    return base
      .replace(/\bapproximately\b/giu, 'about')
      .replace(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten) and a half years\b/giu,
        (_, n: string) => {
          const map: Record<string, string> = {
            one: '1.5', two: '2.5', three: '3.5', four: '4.5', five: '5.5',
            six: '6.5', seven: '7.5', eight: '8.5', nine: '9.5', ten: '10.5',
          };
          return `${map[String(n).toLowerCase()] || n} years`;
        },
      )
      .replace(/\bPreviously,\s+I worked as\b/giu, 'Previously I worked as')
      .replace(/, where I /giu, ', ')
      .replace(/, and /giu, ' and ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (style === 'stronger') {
    // Keep natural role intros; strengthen duty predicates + duration rhythm.
    return applyStrongerDutyPredicateSurface(base, 'en');
  }
  return base
    .replace(/\bI currently work as\b/giu, 'I am currently employed as')
    .replace(/\bPreviously, I worked as\b/giu, 'Previously, I was employed as')
    .replace(/\s+/g, ' ')
    .trim();
}

function localeAndJoin(duties: string[], locale: Locale): string {
  const parts = duties.map((d) => d.replace(/[.;]+$/u, '').trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const head = parts.slice(0, -1).join(', ');
  const last = parts[parts.length - 1];
  if (locale === 'de') return `${head} und ${last}`;
  if (locale === 'es' || locale === 'pt-BR') return `${head} y ${last}`;
  if (locale === 'fr') return `${head} et ${last}`;
  if (locale === 'it') return `${head} e ${last}`;
  if (locale === 'ru') return `${head} и ${last}`;
  if (locale === 'sr' || locale === 'hr') return `${head} i ${last}`;
  if (locale === 'ar') return `${head} و${last}`;
  if (locale === 'hi') return `${head} और ${last}`;
  if (locale === 'ja') return `${head}、${last}`;
  return `${head} and ${last}`;
}

function compressDutyEmDashList(text: string, locale: Locale): string {
  // Legacy em-dash lists
  let t = text.replace(
    /\s+[—–]\s+([^.。؟!]+)/gu,
    (_m, body: string) => {
      const duties = String(body).split(/\s*;\s*/u).map((x) => x.trim()).filter(Boolean);
      if (duties.length < 2) {
        return `, ${String(body).replace(/;\s+/gu, ', ').trim()}`;
      }
      return `, ${localeAndJoin(duties, locale)}`;
    },
  );
  // Native relative-clause duty lists: compress "donde/où/dove/gdje/gde …, …, y …"
  t = t.replace(
    /(,\s+(?:donde|dove|onde|gdje(?:\s+sam)?|gde(?:\s+sam)?|где\s+я|où\s+je)\s+)([^.。؟!]+)/giu,
    (_m, lead: string, body: string) => {
      const duties = String(body).split(/\s*,\s*/u).map((x) => x.trim()).filter(Boolean);
      if (duties.length < 2) return `${lead}${body}`;
      // Drop soft parenthetical fillers inside duty list and rejoin tightly.
      const tight = duties
        .map((d) => d.replace(/\b(?:herzlich|kompetent|serviceorientiert|freundlich)\b/giu, '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return `${lead}${localeAndJoin(tight, locale)}`;
    },
  );
  return t;
}

function compressLocaleDurationToCompact(text: string, locale: Locale): string {
  let t = text;
  // Keep duration approximators + year nouns so warehouse duration scanners still
  // count exactly one claim. Compress half-year wording and experience tails.
  if (locale === 'fr') {
    t = t
      .replace(/Je dispose d['\u2019]environ/giu, "J'ai environ")
      .replace(/Je dispose d['\u2019]/giu, "J'ai ")
      .replace(/\s+et demi\b/giu, '')
      .replace(/,\s+où je\s+/giu, ', ')
      .replace(/\bdans (?:ce|un) rôle(?:\s+précédent)?\s*/giu, '');
  } else if (locale === 'es') {
    t = t
      .replace(/Cuento con alrededor de/giu, 'Cuento con unos')
      .replace(/con alrededor de/giu, 'con unos')
      .replace(/\s+y medio\b/giu, '')
      .replace(/,\s+donde\s+/giu, ', ')
      .replace(/\ben (?:este|un) rol(?:\s+previo)?\s*/giu, '');
  } else if (locale === 'it') {
    t = t
      .replace(/Dispongo di circa/giu, 'Ho circa')
      .replace(/\s+e mezzo\b/giu, '')
      .replace(/,\s+dove\s+/giu, ', ')
      .replace(/\bin questo ruolo\s*/giu, '')
      .replace(/\bin un ruolo precedente,\s*/giu, '');
  } else if (locale === 'pt-BR') {
    t = t
      .replace(/\s+e meio\b/giu, '')
      .replace(/,\s+onde\s+/giu, ', ')
      .replace(/\bnesta função\s*/giu, '');
  } else if (locale === 'ru') {
    // Keep the finite `У меня … опыта.` predicate — never a bare `Около пяти лет.`
    t = t
      .replace(/с половиной\s+/gu, '')
      .replace(/,\s+где я\s+/gu, ', ')
      .replace(/в этой роли\s*/gu, '');
  } else if (locale === 'sr') {
    t = t
      .replace(/Imam sa oko/giu, 'Imam oko')
      .replace(/\s+i po\b/giu, '')
      .replace(/,\s+gde(?:\s+sam)?\s+/giu, ', ')
      .replace(/,\s+gdje(?:\s+sam)?\s+/giu, ', ')
      .replace(/\bu ovoj ulozi\s*/giu, '');
  } else if (locale === 'hr') {
    t = t
      .replace(/Imam ukupno oko/giu, 'Imam oko')
      .replace(/Imam s ukupno oko/giu, 'Imam oko')
      .replace(/\s+i pol\b/giu, '')
      .replace(/,\s+gdje(?:\s+sam)?\s+/giu, ', ')
      .replace(/\bu ovoj ulozi\s*/giu, '');
  } else if (locale === 'ar') {
    t = t
      .replace(/ونصف/gu, '')
      // Keep the genitive "من الخبرة" — "خمس سنوات خبرة" is not idiomatic MSA.
      .replace(/من الخبرة المشتركة/gu, 'من الخبرة')
      // Same relative-connector drop the other locales use for shorter.
      .replace(/،\s*حيث\s+/gu, '، ');
  } else if (locale === 'hi') {
    t = t
      .replace(/लगभग\s+/gu, '')
      .replace(/का संयुक्त अनुभव/gu, 'का अनुभव')
      .replace(/साढ़े पाँच वर्षों/gu, 'साढ़े 5 वर्षों');
  } else if (locale === 'ja') {
    t = t
      .replace(/通算で/gu, '')
      .replace(/年半/gu, '年')
      .replace(/の実務経験があります/gu, 'の経験があります');
  }
  return t.replace(/\s+/g, ' ').trim();
}

function shortenLocaleRoleOpeners(text: string, locale: Locale): string {
  let t = text;
  // Keep current-state markers (actuellement/trenutno/…) — validator requires them.
  // Compress prior openers and soft current phrasing only.
  if (locale === 'es') {
    t = t.replace(/Anteriormente trabajé como/iu, 'Antes trabajé como');
  } else if (locale === 'fr') {
    t = t.replace(/Auparavant, j'ai travaillé comme/iu, "J'ai déjà travaillé comme");
  } else if (locale === 'it') {
    t = t.replace(/In precedenza ho lavorato come/iu, 'Ho già lavorato come');
  } else if (locale === 'pt-BR') {
    t = t.replace(/Anteriormente trabalhei como/iu, 'Antes trabalhei como');
  } else if (locale === 'ru') {
    t = t.replace(/Ранее я (работала|работал)(?=\s)/u, 'Ранее $1');
  } else if (locale === 'sr') {
    t = t.replace(/Prethodno sam (radi(?:o|la)) kao/iu, 'Ranije sam $1 kao');
  } else if (locale === 'hr') {
    t = t.replace(/Prethodno sam (radi(?:o|la)) kao/iu, 'Prije sam $1 kao');
  } else if (locale === 'ar') {
    t = t.replace(/سابقاً عملت كـ/u, 'عملت سابقاً كـ');
  } else if (locale === 'hi') {
    t = t.replace(/इससे पहले मैं/u, 'पहले मैं');
  } else if (locale === 'ja') {
    t = t.replace(/以前は/u, '前は');
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Formal role framing shared by the professional builder and the professional
 * repair path. Gender-resolved forms only — never slash/parenthetical shells.
 */
function applyProfessionalRoleFraming(text: string, locale: Locale): string {
  const t = text;
  if (locale === 'de') {
    return t
      .replace(
        /Derzeit arbeite ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
        'Derzeit bin ich als $1 bei $2 tätig, wo ich',
      )
      .replace(
        /Zuvor arbeitete ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
        'Zuvor war ich als $1 bei $2 tätig, wo ich',
      );
  }
  if (locale === 'en') {
    return t
      .replace(/\bI currently work as\b/giu, 'I am currently employed as')
      .replace(/\bPreviously, I worked as\b/giu, 'Previously, I was employed as');
  }
  if (locale === 'es') {
    return t
      .replace(/Actualmente trabajo como/iu, 'Actualmente ejerzo como')
      .replace(/Anteriormente trabajé como/iu, 'Anteriormente ejercí como');
  }
  if (locale === 'fr') {
    return t
      .replace(/Je travaille actuellement comme/iu, "J'exerce actuellement comme")
      .replace(/Auparavant, j'ai travaillé comme/iu, "Auparavant, j'ai exercé comme");
  }
  if (locale === 'it') {
    return t
      .replace(/Attualmente lavoro come/iu, 'Attualmente svolgo il ruolo di')
      .replace(/In precedenza ho lavorato come/iu, 'In precedenza ho ricoperto il ruolo di');
  }
  if (locale === 'pt-BR') {
    return t
      .replace(/Atualmente trabalho como/iu, 'Atualmente exerço como')
      .replace(/Anteriormente trabalhei como/iu, 'Anteriormente exerci como');
  }
  if (locale === 'ru') {
    return t
      .replace(/Сейчас я работаю на должности/u, 'Сейчас я занимаю должность')
      .replace(/Ранее я работал на должности/u, 'Ранее я занимал должность')
      .replace(/Ранее я работала на должности/u, 'Ранее я занимала должность');
  }
  if (locale === 'sr' || locale === 'hr') {
    // `kao` + nominative keeps arbitrary free-text roles case-safe; only the
    // predicate moves to the formal register.
    return t
      .replace(/Trenutno radim kao/iu, 'Trenutno obavljam poslove kao')
      .replace(/Prethodno sam radio kao/iu, 'Prethodno sam obavljao poslove kao')
      .replace(/Prethodno sam radila kao/iu, 'Prethodno sam obavljala poslove kao');
  }
  if (locale === 'ar') {
    return t
      .replace(/أعمل حالياً كـ\s*/u, 'أشغل حالياً منصب ')
      .replace(/سابقاً عملت كـ\s*/u, 'سابقاً شغلت منصب ');
  }
  if (locale === 'hi') {
    return t
      .replace(/के रूप में काम (करता|करती) हूँ/u, 'के पद पर सेवा $1 हूँ')
      .replace(/के रूप में काम (करता|करती) (था|थी)/u, 'के पद पर सेवा $1 $2');
  }
  if (locale === 'ja') {
    return t
      .replace(/として勤務しています/u, 'として職務に従事しています')
      .replace(/として勤務していました/u, 'として職務に従事していました');
  }
  return t;
}

/**
 * Shared shell-locale style transforms (es/fr/it/pt-BR/ru/sr/hr/ar/hi/ja).
 * Preserve duration unit, current/prior state markers, roles, employers, duties.
 */
function buildLocaleShellStyled(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  void SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION;
  const locale = manifest.locale;
  const base = buildSummaryV2DeterministicText(manifest);

  if (style === 'shorter') {
    let t = stripSharedSoftFillers(base, locale);
    t = compressLocaleDurationToCompact(t, locale);
    t = shortenLocaleRoleOpeners(t, locale);
    // Real clause compression: merge em-dash duty lists into natural and-joins.
    t = compressDutyEmDashList(t, locale);
    t = t.replace(/;\s+/gu, ',');
    if (locale === 'ja') {
      // Keep polite finite predicates — `…として勤務。` would be a noun fragment.
      t = t
        .replace(/として勤務しています/gu, 'として勤務中です')
        .replace(/として勤務していました/gu, 'として勤務しました')
        .replace(/。+/gu, '。');
    } else if (locale === 'ru') {
      // Pro-drop compression keeps the finite verb (never a bare participle).
      t = t
        .replace(/Сейчас я работаю/u, 'Сейчас работаю')
        .replace(/Ранее я (работала|работал)(?=\s)/u, 'Ранее $1');
    }
    return t.replace(/\s+/g, ' ').replace(/\s+([.。])/gu, '$1').trim();
  }

  if (style === 'stronger') {
    // Keep natural role intros; strengthen grounded duty predicates only.
    let t = applyStrongerDutyPredicateSurface(base, locale);
    t = t.replace(/\s+[—–]\s+/gu, ' — ');
    t = t.replace(/;\s+/gu, '; ');
    return t.replace(/\s+/g, ' ').trim();
  }

  // professional — formal role framing; keep full duty topology (not shorter merge).
  let t = applyProfessionalRoleFraming(base, locale);
  // Formal cohesion via relative connectors only — never turn "Auparavant," into "Auparavant;".
  t = t.replace(/\s+[—–]\s+/gu, ', ');
  t = t.replace(
    // JS \b is ASCII-only even with /u — anchor the connector exclusion on space.
    /(?<!\b(?:Auparavant|Anteriormente|Previously|Zuvor|In precedenza|Prethodno|Ранее|سابقاً|इससे पहले|以前は))\s*,\s+(?!(?:donde|dove|onde|où|gde|gdje|где|wo|where)\s)(?=\p{L})/gu,
    '; ',
  );
  // Restore transition commas if a lookbehind-unsafe engine mangled them.
  t = t
    .replace(/\bAuparavant;\s*/giu, 'Auparavant, ')
    .replace(/\bAnteriormente;\s*/giu, 'Anteriormente, ')
    .replace(/\bPreviously;\s*/giu, 'Previously, ')
    .replace(/\bZuvor;\s*/giu, 'Zuvor, ')
    .replace(/\bIn precedenza;\s*/giu, 'In precedenza, ')
    .replace(/\bPrethodno;\s*/giu, 'Prethodno, ');
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Balanced Generate-enhance surface — clarity/cohesion without dedicated style markers.
 * Must differ from Generate-empty canonical and from shorter/stronger/professional.
 */
export function buildSummaryV2BalancedEnhanceText(
  manifest: SummaryV2SelectionManifest,
): string {
  void SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION;
  const locale = manifest.locale;
  let t = buildSummaryV2DeterministicText(manifest);
  // Keep employment-state markers (currently/derzeit/…) intact for validators.
  if (locale === 'en') {
    t = t
      .replace(/\bI currently work as\b/giu, 'I currently work in this role as')
      .replace(/\bPreviously, I worked as\b/giu, 'Previously, in an earlier role, I worked as');
  } else if (locale === 'de') {
    t = t
      .replace(/Derzeit arbeite ich als/iu, 'Derzeit arbeite ich in dieser Rolle als')
      .replace(/Zuvor arbeitete ich als/iu, 'Zuvor arbeitete ich in einer früheren Rolle als');
  } else if (locale === 'es') {
    t = t
      .replace(/Actualmente trabajo como/iu, 'Actualmente trabajo en este rol como')
      .replace(/Anteriormente trabajé como/iu, 'Anteriormente, en un rol previo, trabajé como');
  } else if (locale === 'fr') {
    t = t
      .replace(/Je travaille actuellement comme/iu, 'Je travaille actuellement dans ce rôle comme')
      .replace(/Auparavant, j'ai travaillé comme/iu, "Auparavant, dans un rôle précédent, j'ai travaillé comme");
  } else if (locale === 'it') {
    t = t
      .replace(/Attualmente lavoro come/iu, 'Attualmente lavoro in questo ruolo come')
      .replace(/In precedenza ho lavorato come/iu, 'In precedenza, in un ruolo precedente, ho lavorato come');
  } else if (locale === 'pt-BR') {
    t = t
      .replace(/Atualmente trabalho como/iu, 'Atualmente trabalho nesta função como')
      .replace(/Anteriormente trabalhei como/iu, 'Anteriormente, em uma função prévia, trabalhei como');
  } else if (locale === 'ru') {
    t = t
      .replace(/Сейчас я работаю на должности/u, 'Сейчас я работаю в этой роли на должности')
      .replace(/Ранее я (работал(?:а)?) на должности/u, 'Ранее, в предыдущей роли, я $1 на должности');
  } else if (locale === 'sr' || locale === 'hr') {
    t = t
      .replace(/Trenutno radim kao/iu, 'Trenutno radim u ovoj ulozi kao')
      .replace(/Prethodno sam (radi(?:o|la)) kao/iu, 'Prethodno, u ranijoj ulozi, sam $1 kao');
  } else if (locale === 'ar') {
    t = t
      .replace(/أعمل حالياً كـ/u, 'أعمل حالياً في هذا الدور كـ')
      .replace(/سابقاً عملت كـ/u, 'سابقاً، في دور سابق، عملت كـ');
  } else if (locale === 'hi') {
    t = t
      .replace(/मैं वर्तमान में/u, 'मैं वर्तमान में इस भूमिका में')
      .replace(/इससे पहले मैं/u, 'इससे पहले, पिछली भूमिका में, मैं');
  } else if (locale === 'ja') {
    t = t
      .replace(/現在、/u, '現在、この役割で')
      .replace(/以前は/u, '以前は、前の役割で');
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Build styled deterministic Summary from the immutable manifest.
 * Does not hard-code occupations; uses entry-owned facts only.
 */
export function buildSummaryV2StyledDeterministicText(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  if (manifest.locale === 'de') return buildGermanStyledFromManifest(manifest, style);
  if (manifest.locale === 'en') return buildEnglishStyledFromManifest(manifest, style);
  return buildLocaleShellStyled(manifest, style);
}

/**
 * Attempt claim-safe style repair on a near-valid provider candidate.
 * Only applies soft, reversible wording — never invents duties/metrics.
 */
export function repairSummaryV2RewriteStyle(
  candidate: string,
  style: SummaryV2RewriteStyle,
  locale: Locale,
): string {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  let t = (candidate || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  if (style === 'shorter') {
    if (locale === 'de') {
      // Prefer full styled rebuild semantics via soft + sowie cleanup on candidate.
      t = t
        .replace(/\binsgesamt\s+/giu, '')
        .replace(/Ich verfüge über etwa/iu, 'Ich habe etwa')
        .replace(/Ich verfüge über/iu, 'Ich habe');
      t = stripDeSoft(t);
      t = t.replace(/\ssowie\s+/giu, ' und ');
      t = t.replace(/\s+des Hotels\b/giu, '');
    } else {
      t = t
        .replace(/\b(?:really|very|quite|rather|approximately)\b/giu, (m) => (
          /approximately/iu.test(m) ? 'about' : ''
        ))
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    return t.replace(/\s+/g, ' ').trim();
  }
  if (style === 'stronger') {
    // Strip legacy unnatural role-intro intensifiers, then strengthen duties.
    t = t
      .replace(/\bzielgerichtet\s+als\b/giu, 'als')
      .replace(/\bübernahm ich zuverlässig als\b/giu, 'arbeitete ich als')
      .replace(/\bübernahm ich als\b/giu, 'arbeitete ich als')
      .replace(/\bI currently deliver as\b/giu, 'I currently work as')
      .replace(/\bPreviously, I carried out the role of\b/giu, 'Previously, I worked as')
      .replace(/Actualmente me desempeño con determinación como/giu, 'Actualmente trabajo como')
      .replace(/Anteriormente aporté como/giu, 'Anteriormente trabajé como')
      .replace(/Je m['’]investis actuellement avec rigueur comme/giu, 'Je travaille actuellement comme')
      .replace(/Auparavant, je m['’]engageais comme/giu, "Auparavant, j'ai travaillé comme")
      .replace(/Attualmente opero con determinazione come/giu, 'Attualmente lavoro come')
      .replace(/In precedenza ho portato avanti il ruolo di/giu, 'In precedenza ho lavorato come')
      .replace(/Atualmente desempenho com determinação como/giu, 'Atualmente trabalho como')
      .replace(/Anteriormente atuei com foco como/giu, 'Anteriormente trabalhei como')
      .replace(/Сейчас я веду работу как/gu, 'Сейчас я работаю на должности')
      .replace(/Ранее я уверенно выполнял\(а\) роль/gu, 'Ранее я работал на должности')
      .replace(/Trenutno doprinosim kao/giu, 'Trenutno radim kao')
      .replace(/Trenutno pridonosim kao/giu, 'Trenutno radim kao')
      .replace(/Prethodno sam pouzdano izvršavao\/la ulogu/giu, 'Prethodno sam radio kao')
      .replace(/أساهم حالياً بكفاءة كـ/gu, 'أعمل حالياً كـ')
      .replace(/سابقاً أسهمت كـ/gu, 'سابقاً عملت كـ')
      .replace(/के रूप में सक्रिय रूप से कार्य (करता|करती) हूँ/gu, 'के रूप में काम $1 हूँ')
      .replace(/के रूप में निर्णायक रूप से कार्य (करता|करती) (था|थी)/gu, 'के रूप में काम $1 $2')
      .replace(/として責任を持って推進しています/gu, 'として勤務しています')
      .replace(/として主体的に推進していました/gu, 'として勤務していました');
    const marker = strongerMarkerFor(locale);
    const alreadyDutyStrong = marker?.test(t)
      && hasStrengthenedDutyPredicates(
        // Compare against a neutralized copy without duty markers.
        t.replace(/\b(?:sorgfältig|zuverlässig|carefully|thoroughly)\b/giu, ''),
        t,
        locale,
      );
    if (alreadyDutyStrong && !UNNATURAL_STRONGER_ROLE_INTRO_RE.test(t)) {
      return t.replace(/\s+/g, ' ').trim();
    }
    return applyStrongerDutyPredicateSurface(t, locale);
  }
  // professional
  const profMarker = professionalMarkerFor(locale);
  if (profMarker && profMarker.test(t)) return t.replace(/\s+/g, ' ').trim();
  return applyProfessionalRoleFraming(t, locale).replace(/\s+/g, ' ').trim();
}

export function evaluateSummaryV2StyleFulfillment(options: {
  style: SummaryV2RewriteStyle | null;
  sourceText: string;
  candidateText: string;
  locale: Locale;
}): SummaryV2StyleFulfillment {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  const source = (options.sourceText || '').replace(/\s+/g, ' ').trim();
  const candidate = (options.candidateText || '').replace(/\s+/g, ' ').trim();
  const sourceLen = normalizeComparable(source).length;
  const candLen = normalizeComparable(candidate).length;
  const lengthDelta = candLen - sourceLen;
  const lengthDeltaPercent = sourceLen > 0
    ? Math.round((lengthDelta / sourceLen) * 1000) / 10
    : 0;
  const materiallyDifferent = Boolean(
    candidate
    && source
    && hashNorm(candidate) !== hashNorm(source),
  );
  const whitespaceOnly = Boolean(
    source
    && candidate
    && normalizeComparable(source) === normalizeComparable(candidate),
  );

  let shorterStyleFulfilled = false;
  let strongerStyleFulfilled = false;
  let professionalStyleFulfilled = false;
  const styleRejectionReasons: string[] = [];
  const sourceUnitCount = summaryV2CountUnits(source, options.locale);
  const candidateUnitCount = summaryV2CountUnits(candidate, options.locale);
  const sourceClauseCount = summaryV2ClauseCount(source);
  const candidateClauseCount = summaryV2ClauseCount(candidate);
  const unitDelta = candidateUnitCount - sourceUnitCount;
  const clauseDelta = candidateClauseCount - sourceClauseCount;
  let semanticStyleOperationsApplied: SummaryV2SemanticOperation[] = [];
  let markerOnlyStyleChange = false;
  let strongSurface = analyzeStrongerNativeSurface({
    sourceText: source,
    candidateText: candidate,
    locale: options.locale,
  });
  // For non-Stronger styles, surface diagnostics stay informational-only defaults.
  if (options.style !== 'stronger') {
    strongSurface = {
      repeatedStyleModifierCount: 0,
      repeatedStyleModifierLemmas: [],
      stackedModifierDetected: false,
      modifierOnlyTransformationDetected: false,
      strongerVerbTransformationCount: 0,
      structuralStrengtheningCount: 0,
      nativeStrongSurfacePassed: true,
      nativeStrongSurfaceRejectionReasons: [],
    };
  }
  const localeAwareShorterThresholdPercent = options.style === 'shorter'
    ? summaryV2ShorterMinLengthDeltaPercent(options.locale)
    : null;

  const metrics = {
    sourceUnitCount,
    candidateUnitCount,
    sourceClauseCount,
    candidateClauseCount,
    unitDelta,
    clauseDelta,
    localeAwareShorterThresholdPercent,
  };

  if (!options.style) {
    const native = evaluateSummaryV2NativeSurface({
      text: candidate,
      locale: options.locale,
    });
    const nativeOk = native.nativeSurfaceValidationPassed;
    return {
      shorterStyleFulfilled: false,
      strongerStyleFulfilled: false,
      professionalStyleFulfilled: false,
      // Generate/enhance still must not emit mixed-person SC predicate chains.
      styleValidationPassed: nativeOk,
      styleRejectionReasons: nativeOk
        ? []
        : native.nativeSurfaceRejectionReasons.map((r) => `native_${r}`),
      selectedCandidateMateriallyDiffersFromSource: materiallyDifferent,
      sourceNormalizedLength: sourceLen,
      candidateNormalizedLength: candLen,
      lengthDelta,
      lengthDeltaPercent,
      ...metrics,
      semanticStyleOperationsApplied: [],
      markerOnlyStyleChange: false,
      styleMaterialityPassed: true,
      nativeSurfaceValidationPassed: native.nativeSurfaceValidationPassed,
      nativeSurfaceRejectionReasons: native.nativeSurfaceRejectionReasons,
      capitalizationValidationPassed: native.capitalizationValidationPassed,
      grammaticalPersonValidationPassed: native.grammaticalPersonValidationPassed,
      currentTenseValidationPassed: native.currentTenseValidationPassed,
      priorTenseValidationPassed: native.priorTenseValidationPassed,
      finiteClauseValidationPassed: native.finiteClauseValidationPassed,
      nativePunctuationValidationPassed: native.nativePunctuationValidationPassed,
      internalMarkerLeakageDetected: native.internalMarkerLeakageDetected,
      englishMorphologyLeakageDetected: native.englishMorphologyLeakageDetected,
      unresolvedGenderPlaceholderDetected: native.unresolvedGenderPlaceholderDetected,
      finiteDurationSentencePassed: native.finiteDurationSentencePassed,
      firstPersonPredicateChainPassed: native.firstPersonPredicateChainPassed,
      localeVerbMorphologyPassed: native.localeVerbMorphologyPassed,
      roleCaseValidationPassed: native.roleCaseValidationPassed,
      nativeCoordinationValidationPassed: native.nativeCoordinationValidationPassed,
      sentenceCompletenessPassed: native.sentenceCompletenessPassed,
      structuralCompressionCount: 0,
      coordinatedPredicateCount: native.coordinatedPredicateCount,
      transformedCoordinatedPredicateCount: native.transformedCoordinatedPredicateCount,
      untransformedFinitePredicateCount: native.untransformedFinitePredicateCount,
      mixedPersonPredicateDetected: native.mixedPersonPredicateDetected,
      mixedTensePredicateDetected: native.mixedTensePredicateDetected,
      predicateChainValidationPassed: native.predicateChainValidationPassed,
      predicateChainRejectionReasons: native.predicateChainRejectionReasons,
      sourcePredicateChainHash: native.sourcePredicateChainHash,
      finalPredicateChainHash: native.finalPredicateChainHash,
    };
  }

  if (options.style === 'shorter') {
    const minPercent = summaryV2ShorterMinLengthDeltaPercent(options.locale);
    semanticStyleOperationsApplied = listSemanticStyleOperations({
      style: 'shorter',
      sourceText: source,
      candidateText: candidate,
      locale: options.locale,
    });
    const hasCompressOp = semanticStyleOperationsApplied.some((o) => (
      o === 'duty_list_merge'
      || o === 'duration_hedge_compress'
      || o === 'soft_filler_strip'
    ));
    // Length threshold is authoritative; unit/clause reduction is supporting evidence
    // (some locales replace em-dashes with and-joins without lowering token count).
    const enough = sourceLen > 0
      && lengthDeltaPercent <= minPercent
      && materiallyDifferent
      && hasCompressOp
      && (unitDelta < 0 || clauseDelta < 0 || lengthDeltaPercent <= minPercent);
    shorterStyleFulfilled = enough && !whitespaceOnly;
    if (!shorterStyleFulfilled) {
      styleRejectionReasons.push(
        !hasCompressOp
          ? 'shorter_no_semantic_compression'
          : (enough ? 'shorter_whitespace_only' : 'shorter_insufficient_compression'),
      );
    }
  } else if (options.style === 'stronger') {
    const marker = strongerMarkerFor(options.locale);
    const markerOk = marker ? marker.test(candidate) : materiallyDifferent;
    markerOnlyStyleChange = isSummaryV2MarkerOnlyStyleChange(
      source,
      candidate,
      options.locale,
      'stronger',
    );
    semanticStyleOperationsApplied = listSemanticStyleOperations({
      style: 'stronger',
      sourceText: source,
      candidateText: candidate,
      locale: options.locale,
    });
    const unnaturalRoleIntro = UNNATURAL_STRONGER_ROLE_INTRO_RE.test(candidate);
    const unsupportedAuthority = UNSUPPORTED_STRONGER_AUTHORITY_RE.test(candidate);
    const dutyStrengthenOk = semanticStyleOperationsApplied.includes('duty_predicate_strengthen');
    strongerStyleFulfilled = materiallyDifferent
      && markerOk
      && !whitespaceOnly
      && !markerOnlyStyleChange
      && dutyStrengthenOk
      && !unnaturalRoleIntro
      && !unsupportedAuthority
      && strongSurface.nativeStrongSurfacePassed
      && !strongSurface.modifierOnlyTransformationDetected
      && strongSurface.repeatedStyleModifierCount === 0
      && !strongSurface.stackedModifierDetected;
    if (!strongerStyleFulfilled) {
      if (unnaturalRoleIntro) {
        styleRejectionReasons.push('stronger_unnatural_role_intro');
      } else if (unsupportedAuthority) {
        styleRejectionReasons.push('stronger_unsupported_authority');
      } else if (!materiallyDifferent) {
        styleRejectionReasons.push('stronger_not_materially_different');
      } else if (markerOnlyStyleChange) {
        styleRejectionReasons.push('stronger_marker_only');
      } else if (!dutyStrengthenOk) {
        styleRejectionReasons.push('stronger_no_duty_predicate_strengthen');
      } else if (!strongSurface.nativeStrongSurfacePassed) {
        styleRejectionReasons.push(
          ...strongSurface.nativeStrongSurfaceRejectionReasons.map((r) => `stronger_${r}`),
        );
      } else {
        styleRejectionReasons.push('stronger_markers_missing');
      }
    }
  } else {
    const marker = professionalMarkerFor(options.locale);
    const markerOk = marker ? marker.test(candidate) : materiallyDifferent;
    markerOnlyStyleChange = isSummaryV2MarkerOnlyStyleChange(
      source,
      candidate,
      options.locale,
      'professional',
    );
    semanticStyleOperationsApplied = listSemanticStyleOperations({
      style: 'professional',
      sourceText: source,
      candidateText: candidate,
      locale: options.locale,
    });
    professionalStyleFulfilled = materiallyDifferent
      && markerOk
      && !whitespaceOnly
      && !markerOnlyStyleChange
      && semanticStyleOperationsApplied.includes('formal_role_framing');
    if (!professionalStyleFulfilled) {
      styleRejectionReasons.push(
        !materiallyDifferent
          ? 'professional_not_materially_different'
          : (markerOnlyStyleChange ? 'professional_marker_only' : 'professional_markers_missing'),
      );
    }
  }

  const styleMaterialityPassed = (
    (options.style === 'shorter' && shorterStyleFulfilled)
    || (options.style === 'stronger' && strongerStyleFulfilled)
    || (options.style === 'professional' && professionalStyleFulfilled)
  );

  const native = evaluateSummaryV2NativeSurface({
    text: candidate,
    locale: options.locale,
  });
  if (/\bowned work\b/iu.test(candidate)) {
    native.nativeSurfaceRejectionReasons.push('unsupported_ownership_wording');
    native.nativeSurfaceValidationPassed = false;
  }
  if (options.style === 'stronger' && UNNATURAL_STRONGER_ROLE_INTRO_RE.test(candidate)) {
    native.nativeSurfaceRejectionReasons.push('unnatural_stronger_role_intro');
    native.nativeSurfaceValidationPassed = false;
  }
  if (options.style === 'stronger' && UNSUPPORTED_STRONGER_AUTHORITY_RE.test(candidate)) {
    native.nativeSurfaceRejectionReasons.push('unsupported_ownership_wording');
    native.nativeSurfaceValidationPassed = false;
  }
  if (!native.nativeSurfaceValidationPassed) {
    styleRejectionReasons.push(...native.nativeSurfaceRejectionReasons.map((r) => `native_${r}`));
  }

  const structuralCompressionCount = semanticStyleOperationsApplied.filter((o) => (
    o === 'duty_list_merge'
    || o === 'duration_hedge_compress'
    || o === 'soft_filler_strip'
  )).length;

  const styleValidationPassed = styleMaterialityPassed
    && native.nativeSurfaceValidationPassed;

  return {
    shorterStyleFulfilled: shorterStyleFulfilled && native.nativeSurfaceValidationPassed,
    strongerStyleFulfilled: strongerStyleFulfilled && native.nativeSurfaceValidationPassed,
    professionalStyleFulfilled: professionalStyleFulfilled && native.nativeSurfaceValidationPassed,
    styleValidationPassed,
    styleRejectionReasons,
    selectedCandidateMateriallyDiffersFromSource: materiallyDifferent,
    sourceNormalizedLength: sourceLen,
    candidateNormalizedLength: candLen,
    lengthDelta,
    lengthDeltaPercent,
    ...metrics,
    semanticStyleOperationsApplied,
    markerOnlyStyleChange,
    styleMaterialityPassed,
    nativeSurfaceValidationPassed: native.nativeSurfaceValidationPassed,
    nativeSurfaceRejectionReasons: native.nativeSurfaceRejectionReasons,
    capitalizationValidationPassed: native.capitalizationValidationPassed,
    grammaticalPersonValidationPassed: native.grammaticalPersonValidationPassed,
    currentTenseValidationPassed: native.currentTenseValidationPassed,
    priorTenseValidationPassed: native.priorTenseValidationPassed,
    finiteClauseValidationPassed: native.finiteClauseValidationPassed,
    nativePunctuationValidationPassed: native.nativePunctuationValidationPassed,
    internalMarkerLeakageDetected: native.internalMarkerLeakageDetected,
    englishMorphologyLeakageDetected: native.englishMorphologyLeakageDetected,
    unresolvedGenderPlaceholderDetected: native.unresolvedGenderPlaceholderDetected,
    finiteDurationSentencePassed: native.finiteDurationSentencePassed,
    firstPersonPredicateChainPassed: native.firstPersonPredicateChainPassed,
    localeVerbMorphologyPassed: native.localeVerbMorphologyPassed,
    roleCaseValidationPassed: native.roleCaseValidationPassed,
    nativeCoordinationValidationPassed: native.nativeCoordinationValidationPassed,
    sentenceCompletenessPassed: native.sentenceCompletenessPassed,
    structuralCompressionCount,
    coordinatedPredicateCount: native.coordinatedPredicateCount,
    transformedCoordinatedPredicateCount: native.transformedCoordinatedPredicateCount,
    untransformedFinitePredicateCount: native.untransformedFinitePredicateCount,
    mixedPersonPredicateDetected: native.mixedPersonPredicateDetected,
    mixedTensePredicateDetected: native.mixedTensePredicateDetected,
    predicateChainValidationPassed: native.predicateChainValidationPassed,
    predicateChainRejectionReasons: native.predicateChainRejectionReasons,
    sourcePredicateChainHash: native.sourcePredicateChainHash,
    finalPredicateChainHash: native.finalPredicateChainHash,
    repeatedStyleModifierCount: strongSurface.repeatedStyleModifierCount,
    repeatedStyleModifierLemmas: strongSurface.repeatedStyleModifierLemmas,
    stackedModifierDetected: strongSurface.stackedModifierDetected,
    modifierOnlyTransformationDetected: strongSurface.modifierOnlyTransformationDetected,
    strongerVerbTransformationCount: strongSurface.strongerVerbTransformationCount,
    structuralStrengtheningCount: strongSurface.structuralStrengtheningCount,
    nativeStrongSurfacePassed: strongSurface.nativeStrongSurfacePassed,
    nativeStrongSurfaceRejectionReasons: strongSurface.nativeStrongSurfaceRejectionReasons,
  };
}

/**
 * Produce a style-aware deterministic candidate from source + manifest.
 */
export function transformSummaryV2ForRewriteStyle(options: {
  manifest: SummaryV2SelectionManifest;
  style: SummaryV2RewriteStyle;
  sourceSummary: string;
}): SummaryV2StyleTransformResult {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  const source = (options.sourceSummary || '').replace(/\s+/g, ' ').trim();
  const beforeHash = source ? hashNorm(source) : null;
  const styled = buildSummaryV2StyledDeterministicText(options.manifest, options.style);
  const fulfillment = evaluateSummaryV2StyleFulfillment({
    style: options.style,
    sourceText: source,
    candidateText: styled,
    locale: options.manifest.locale,
  });
  const afterHash = styled ? hashNorm(styled) : null;
  const identicalToSource = Boolean(source && styled && beforeHash === afterHash);

  // True no-op only when the surface already matches the styled result — i.e.
  // the source is already style-saturated and no safe material edit exists.
  if (identicalToSource) {
    return {
      text: source,
      transformationKind: null,
      beforeHash,
      afterHash: beforeHash,
      styleFulfilled: false,
      styleRejectionReasons: ['style_no_safe_material_change'],
      noSafeMaterialChange: true,
    };
  }

  return {
    text: styled,
    transformationKind: `v2_rewrite_${options.style}`,
    beforeHash,
    afterHash,
    styleFulfilled: fulfillment.styleValidationPassed,
    styleRejectionReasons: fulfillment.styleRejectionReasons,
    noSafeMaterialChange: false,
  };
}

/** True when stronger vs professional transforms differ for this manifest. */
export function summaryV2StylePairDistinct(
  manifest: SummaryV2SelectionManifest,
): boolean {
  const a = buildSummaryV2StyledDeterministicText(manifest, 'stronger');
  const b = buildSummaryV2StyledDeterministicText(manifest, 'professional');
  return hashNorm(a) !== hashNorm(b);
}
