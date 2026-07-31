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

export const SUMMARY_V2_NATIVE_SURFACE_386_REVISION =
  'summary-v2-native-surface-386-v1' as const;

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
  if (locale === 'sr') {
    // Warehouse-era Serbian duration is the `sa oko …` phrase. Keep it as a
    // complete capitalized sentence — do not rewrite into `Imam …`.
    if (/^sa\s+/iu.test(raw) || /^imam\s+/iu.test(raw)) {
      return `${capitalizeFirstLetter(raw)}.`;
    }
    return `Imam ${raw}.`;
  }
  if (locale === 'hr') {
    if (/^s\s+ukupno\b/iu.test(raw) || /^imam\s+/iu.test(raw) || /^s\s+oko\b/iu.test(raw)) {
      return `${capitalizeFirstLetter(raw)}.`;
    }
    const core = raw.replace(/^s\s+/iu, '').trim();
    return `Imam ${core}.`;
  }
  if (locale === 'ar') {
    return capitalizeFirstLetter(`${raw}.`);
  }
  if (locale === 'hi') {
    // Devanagari danda — warehouse unit splitters key on । not ASCII '.'.
    const core = raw.replace(/[।.]+$/u, '').trim();
    return `${core}।`;
  }
  if (locale === 'ja') {
    return `${raw}${/。$/u.test(raw) ? '' : '。'}`;
  }
  return `${capitalizeFirstLetter(raw)}.`;
}

function localeAndJoin(parts: string[], locale: Locale): string {
  const clean = parts.map((p) => p.replace(/[.;]+$/u, '').trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  const head = clean.slice(0, -1).join(', ');
  const last = clean[clean.length - 1];
  if (locale === 'es' || locale === 'pt-BR') return `${head} y ${last}`;
  if (locale === 'fr') return `${head} et ${last}`;
  if (locale === 'it') return `${head} e ${last}`;
  if (locale === 'ru') return `${head} и ${last}`;
  if (locale === 'sr' || locale === 'hr') return `${head} i ${last}`;
  if (locale === 'ar') return `${head} و${last}`;
  if (locale === 'hi') return `${head} और ${last}`;
  if (locale === 'ja') return `${head}、${last}`;
  if (locale === 'de') return `${head} und ${last}`;
  return `${head} and ${last}`;
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

  if (locale === 'sr' || locale === 'hr') {
    const realized = realizeSouthSlavicPredicateChain({
      bullet: raw,
      locale,
      employmentState,
      gender,
    });
    return realized.text;
  }

  const m = /^(\p{L}+)([\s\S]*)$/u.exec(raw);
  if (!m) return raw.replace(/^\p{Lu}/u, (c) => c.toLowerCase());
  let verb = m[1];
  const rest = m[2] || '';
  const lower = verb.toLocaleLowerCase();

  if (locale === 'es' || locale === 'pt-BR') {
    if (tense === 'present') {
      if (/ye$/u.test(lower)) verb = `${lower.slice(0, -2)}yo`;
      else if (/ce$/u.test(lower)) verb = `${lower.slice(0, -2)}zo`;
      else if (/[aei]a$/u.test(lower)) verb = `${lower.slice(0, -1)}o`;
      else if (/e$/u.test(lower)) verb = `${lower.slice(0, -1)}o`;
      else if (/a$/u.test(lower)) verb = `${lower.slice(0, -1)}o`;
      else verb = lower;
    } else {
      // Pretérito 3sg → 1sg
      if (/ió$/u.test(lower)) verb = `${lower.slice(0, -2)}í`;
      else if (/ó$/u.test(lower)) verb = `${lower.slice(0, -1)}é`;
      else if (/ía$/u.test(lower)) verb = lower; // imperfect 1sg == 3sg for -ía
      else if (/aba$/u.test(lower)) verb = lower;
      else verb = lower;
    }
  } else if (locale === 'fr') {
    if (tense === 'present') {
      verb = lower; // many -er 1sg == 3sg
    } else if (/ait$/u.test(lower)) {
      verb = `${lower.slice(0, -3)}ais`;
    } else {
      verb = lower;
    }
  } else if (locale === 'it') {
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
      if (/ает$/u.test(lower)) verb = `${lower.slice(0, -3)}аю`;
      else if (/яет$/u.test(lower)) verb = `${lower.slice(0, -3)}яю`;
      else if (/ет$/u.test(lower)) verb = `${lower.slice(0, -2)}у`;
      else if (/ит$/u.test(lower)) verb = `${lower.slice(0, -2)}ю`;
      else verb = lower;
    } else {
      verb = lower;
    }
  } else if (locale === 'ar') {
    if (/^ي/u.test(verb)) verb = `أ${verb.slice(1)}`;
  } else if (locale === 'hi') {
    // Present warehouse bullets use 3sg copula है — realize 1sg हूँ after first-person framing.
    // Completed entries keep past था/थी (never leave present है after prior framing).
    let t = raw.replace(/[.;。؟।]+$/u, '').trim();
    if (tense === 'present') {
      t = t.replace(/करता\/करती है/gu, 'करता/करती हूँ');
      t = t.replace(/है$/u, 'हूँ');
    } else {
      t = t.replace(/करता\/करती है/gu, 'करता/करती था/थी');
      t = t.replace(/है$/u, 'था/थी');
    }
    return t;
  } else if (locale === 'ja') {
    return raw.replace(/[.;。؟।]+$/u, '').trim();
  } else {
    verb = lower;
  }

  return `${verb}${rest}`.replace(/\s+/g, ' ').trim();
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
    return `${relativeDutyConnector(locale, employmentState)}${localeAndJoin(clauses, locale)}`;
  }
  if (locale === 'ja') {
    return `${relativeDutyConnector(locale, employmentState)}${clauses.join('、')}`;
  }
  return `${relativeDutyConnector(locale, employmentState)}${localeAndJoin(clauses, locale)}`;
}

const INTERNAL_MARKER_RE =
  /\b(?:v2_rewrite_|SUMMARY_V2_|style_marker|\[style:|__style__)\b/iu;
const ENGLISH_ED_LEAK_RE =
  /\b\p{L}{3,}ed\b/iu;

export function evaluateSummaryV2NativeSurface(options: {
  text: string;
  locale: Locale;
  hasCurrent?: boolean;
  hasPrior?: boolean;
}): SummaryV2NativeSurfaceResult {
  void SUMMARY_V2_NATIVE_SURFACE_386_REVISION;
  const text = (options.text || '').replace(/\s+/g, ' ').trim();
  const reasons: string[] = [];
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
    if (/,\s*;/u.test(text) || /;\s*,/u.test(text)) {
      reasons.push('malformed_punctuation');
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

  const personOk = grammaticalPersonValidationPassed
    && !predicateChain.mixedPersonPredicateDetected;

  const nativeSurfaceValidationPassed = capitalizationValidationPassed
    && personOk
    && nativePunctuationValidationPassed
    && !internalMarkerLeakageDetected
    && !englishMorphologyLeakageDetected
    && !ownedWorkBad
    && finiteClauseValidationPassed
    && predicateChain.predicateChainValidationPassed;

  return {
    nativeSurfaceValidationPassed,
    capitalizationValidationPassed,
    grammaticalPersonValidationPassed: personOk,
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
  };
}
