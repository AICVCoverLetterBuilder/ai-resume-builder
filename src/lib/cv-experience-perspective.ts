/**
 * Experience AI grammatical-person / CV-perspective normalization.
 *
 * Tense (present|past) and person (1sg vs CV 3sg) are separate dimensions.
 * `tense_normalization: ok` must never be treated as proof of CV perspective.
 */
import type { Locale } from './i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { applyEnglishEmploymentTense } from './cv-material-duty-coverage';
import { normalizeArabicExperienceEmploymentGrammar } from './cv-arabic-experience-tense';
import {
  applySerbianCvEmploymentTense,
  stripDutyListPrefix,
} from './cv-source-fact-identity';
import {
  experienceAiSourcesEquivalent,
  normalizeExperienceAiSourceText,
} from './cv-experience-ai-operation-snapshot';

export type ExperiencePersonMode =
  | 'first_singular'
  | 'third_singular'
  | 'neutral'
  | 'unknown';

export type ExperiencePerspectiveMode = 'cv_third_person';

export type ExperiencePerspectiveNormalizeResult = {
  text: string;
  bullets: string[];
  sourcePersonMode: ExperiencePersonMode;
  providerPersonMode: ExperiencePersonMode;
  normalizedPersonMode: ExperiencePersonMode;
  perspectiveMode: ExperiencePerspectiveMode;
  perspectiveNormalizationAttempted: boolean;
  perspectiveNormalizationApplied: boolean;
  perspectiveValidationPassed: boolean;
  changed: boolean;
};

/** Safe morphological cues for Serbian/Croatian first-person singular verbs. */
const SR_1SG_STEM_RE =
  /(?:pregledam|označavam|oznacavam|ažuriram|azuriram|koordinišem|koordinisem|pripremam|organizujem|proveravam|unosim|komuniciram|sarađujem|saradujem|vodim|radim|analiziram|učestvujem|ucestvujem|obavljam|transportujem|održavam|odrzavam|pratim)/iu;

const SR_1SG_STEM_CYR_RE =
  /(?:прегледам|означавам|ажурирам|координишем|припремам|организујем|проверавам|уносим|комуницирам|сарађујем|водим|радим)/u;

const SR_1SG_PRONOUN_RE = /(?:^|[^\p{L}])(ja|ја)(?=[^\p{L}]|$)/iu;
/** Participle + sam, or sam + participle (e.g. Sigurno sam isporučivala). */
const SR_1SG_PAST_AUX_RE =
  /(?:^|[^\p{L}])(?:(\p{L}+(?:ao|ala|io|ila|eo|ela|sao|sala|ао|ала|ио|ила|ео|ела|сао|сала))\s+(sam|сам)|(sam|сам)\s+(\p{L}+(?:ao|ala|io|ila|eo|ela|sao|sala|ао|ала|ио|ила|ео|ела|сао|сала)))(?=[^\p{L}]|$)/iu;

// Require capital "I" / contractions — never match Serbian conjunction "i".
const EN_1SG_RE = /(?:^|[^\p{L}])(I(?:'m|'ve|’m|’ve)?|my)\b/u;

/** Spanish finite first-person forms that are unambiguous in a duty predicate. */
const ES_1SG_DUTY_RE = /(?:^|\n|[•\-*]\s*|[.!?]\s*)(?:reviso|marco|actualizo|coordino|compruebo|verifico|colaboro|gestiono|preparo|creo|adapto|recibo|muevo)(?=[^\p{L}]|$)/iu;

const ES_1SG_TO_CV_PRESENT: Array<[RegExp, string]> = [
  [/(?<!\p{L})reviso(?!\p{L})/giu, 'revisa'],
  [/(?<!\p{L})marco(?!\p{L})/giu, 'marca'],
  [/(?<!\p{L})actualizo(?!\p{L})/giu, 'actualiza'],
  [/(?<!\p{L})coordino(?!\p{L})/giu, 'coordina'],
  [/(?<!\p{L})compruebo(?!\p{L})/giu, 'comprueba'],
  [/(?<!\p{L})verifico(?!\p{L})/giu, 'verifica'],
  [/(?<!\p{L})colaboro(?!\p{L})/giu, 'colabora'],
  [/(?<!\p{L})gestiono(?!\p{L})/giu, 'gestiona'],
  [/(?<!\p{L})preparo(?!\p{L})/giu, 'prepara'],
  [/(?<!\p{L})creo(?!\p{L})/giu, 'crea'],
  [/(?<!\p{L})adapto(?!\p{L})/giu, 'adapta'],
  [/(?<!\p{L})recibo(?!\p{L})/giu, 'recibe'],
  [/(?<!\p{L})muevo(?!\p{L})/giu, 'mueve'],
];

const ES_1SG_TO_CV_PAST: Array<[RegExp, string]> = [
  [/(?<!\p{L})reviso(?!\p{L})/giu, 'revisó'],
  [/(?<!\p{L})marco(?!\p{L})/giu, 'marcó'],
  [/(?<!\p{L})actualizo(?!\p{L})/giu, 'actualizó'],
  [/(?<!\p{L})coordino(?!\p{L})/giu, 'coordinó'],
  [/(?<!\p{L})compruebo(?!\p{L})/giu, 'comprobó'],
  [/(?<!\p{L})verifico(?!\p{L})/giu, 'verificó'],
  [/(?<!\p{L})colaboro(?!\p{L})/giu, 'colaboró'],
  [/(?<!\p{L})gestiono(?!\p{L})/giu, 'gestionó'],
  [/(?<!\p{L})preparo(?!\p{L})/giu, 'preparó'],
  [/(?<!\p{L})creo(?!\p{L})/giu, 'creó'],
  [/(?<!\p{L})adapto(?!\p{L})/giu, 'adaptó'],
  [/(?<!\p{L})recibo(?!\p{L})/giu, 'recibió'],
  [/(?<!\p{L})muevo(?!\p{L})/giu, 'movió'],
];

function normalizeSpanishCvPerspective(line: string, isPresent: boolean): string {
  let out = line.replace(/^yo\s+/iu, '');
  for (const [pattern, replacement] of isPresent
    ? ES_1SG_TO_CV_PRESENT
    : ES_1SG_TO_CV_PAST) {
    out = out.replace(pattern, (match) => (
      /^\p{Lu}/u.test(match)
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement
    ));
  }
  return out;
}

function leadingTokenLooks1sg(token: string): boolean {
  const t = (token || '').trim();
  if (!t || t.length < 4) return false;
  if (SR_1SG_STEM_RE.test(t) || SR_1SG_STEM_CYR_RE.test(t)) return true;
  // Guarded finite 1sg endings — require verb-like length and avoid case endings
  // such as "najnovijim" by also checking coordinated duty-verb stems when possible.
  if (/(?:avam|iram|ujem|ijem|šem|ćem|авам|ирам|ујем|ијем|шем|ћем)$/iu.test(t)) return true;
  if (/(?:am|em|im|ам|ем|им)$/iu.test(t) && t.length >= 6) {
    // Reject common adjective/noun case endings mistaken for 1sg.
    if (/(?:ijim|ovim|evim|skim|nim|tom|ima|ama)$/iu.test(t)) return false;
    return true;
  }
  return false;
}

export function detectExperiencePersonMode(text: string, locale?: Locale): ExperiencePersonMode {
  const raw = (text || '').trim();
  if (!raw) return 'unknown';
  const loc = locale || 'en';

  if (loc === 'sr' || loc === 'hr') {
    if (SR_1SG_PRONOUN_RE.test(raw) || SR_1SG_PAST_AUX_RE.test(raw)) {
      return 'first_singular';
    }
    const lines = splitExperienceBullets(raw);
    let firstHits = 0;
    let thirdHits = 0;
    for (const line of lines) {
      const body = stripDutyListPrefix(line);
      const lead = body.match(/^(\p{L}+)/u)?.[1] || '';
      if (leadingTokenLooks1sg(lead)) firstHits += 1;
      else if (
        lead.length >= 4
        && (
          /(?:ava|ira|uje|ije|še|će|ава|ира|ује|ије|ше|ће)$/iu.test(lead)
          || /(?:[aeiаеи])$/u.test(lead)
        )
        && !leadingTokenLooks1sg(lead)
      ) {
        thirdHits += 1;
      }
      // Coordinated verbs: "… i označavam …"
      const coord = body.match(/(?:^|[^\p{L}])(?:i|и)\s+(\p{L}+)/gu) || [];
      for (const m of coord) {
        const verb = m.replace(/^(?:.*?)(?:i|и)\s+/u, '');
        if (leadingTokenLooks1sg(verb)) firstHits += 1;
      }
    }
    if (firstHits > 0) return 'first_singular';
    if (thirdHits > 0) return 'third_singular';
    return /[a-zA-ZčćžšđČĆŽŠĐа-яА-Я]/.test(raw) ? 'neutral' : 'unknown';
  }

  if (loc === 'en') {
    if (EN_1SG_RE.test(raw)) return 'first_singular';
    return 'neutral';
  }

  if (/\b(ich|yo)\b/i.test(raw) && (loc === 'de' || loc === 'es')) {
    return 'first_singular';
  }
  if (loc === 'es' && ES_1SG_DUTY_RE.test(raw)) return 'first_singular';

  if (loc === 'hi') {
    return detectHindiExperiencePersonMode(raw);
  }

  return 'neutral';
}

/** First-person singular present / past auxiliaries (हूँ / हूं). */
const HI_1SG_RE =
  /(?:करती|करता|रखती|रखता|बनाए\s+रखती|बनाए\s+रखता|समन्वय\s+करती|समन्वय\s+करता|तैयार\s+करती|तैयार\s+करता)\s+(?:हूँ|हूं)|(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|(?:^|[^\p{L}])(?:हूँ|हूं)(?:[^\p{L}]|$)/u;

/** Third-person / honorific CV present (है / हैं). */
const HI_3_RE =
  /(?:करती|करता|करते|रखती|रखता|रखते|बनाए\s+रखती|बनाए\s+रखता|बनाए\s+रखते|समन्वय\s+करती|समन्वय\s+करते|समन्वय\s+करता|तैयार\s+करती|तैयार\s+करते|तैयार\s+करता)\s+(?:हैं|है)/u;

export function detectHindiExperiencePersonMode(text: string): ExperiencePersonMode {
  const raw = (text || '').trim();
  if (!raw) return 'unknown';
  if (HI_1SG_RE.test(raw)) return 'first_singular';
  if (HI_3_RE.test(raw)) return 'third_singular';
  if (/[\u0900-\u097F]/.test(raw)) return 'neutral';
  return 'unknown';
}

/**
 * Normalize Hindi Experience bullets to CV third-person / honorific surface.
 * Preserves facts and predicate identities — only grammatical person changes.
 */
export function normalizeHindiExperiencePerspective(
  text: string,
  options?: { isPresent?: boolean; gender?: string },
): string {
  let out = (text || '').trim();
  if (!out) return out;
  out = out
    .replace(/मैंने\s+/gu, '')
    .replace(/मैं\s+/gu, '')
    .replace(/तैयार\s+करती\s+(?:हूँ|हूं)/gu, 'तैयार करती हैं')
    .replace(/तैयार\s+करता\s+(?:हूँ|हूं)/gu, 'तैयार करते हैं')
    .replace(/बनाए\s+रखती\s+(?:हूँ|हूं)/gu, 'बनाए रखती हैं')
    .replace(/बनाए\s+रखता\s+(?:हूँ|हूं)/gu, 'बनाए रखते हैं')
    .replace(/समन्वय\s+करती\s+(?:हूँ|हूं)/gu, 'समन्वय करती हैं')
    .replace(/समन्वय\s+करता\s+(?:हूँ|हूं)/gu, 'समन्वय करते हैं')
    .replace(/सहयोग\s+करती\s+(?:हूँ|हूं)/gu, 'सहयोग करती हैं')
    .replace(/सहयोग\s+करता\s+(?:हूँ|हूं)/gu, 'सहयोग करते हैं')
    .replace(/करती\s+(?:हूँ|हूं)/gu, 'करती हैं')
    .replace(/करता\s+(?:हूँ|हूं)/gu, 'करते हैं')
    .replace(/रखती\s+(?:हूँ|हूं)/gu, 'रखती हैं')
    .replace(/रखता\s+(?:हूँ|हूं)/gu, 'रखते हैं')
    .replace(/\s+(?:हूँ|हूं)।/gu, ' हैं।')
    .replace(/\s+(?:हूँ|हूं),/gu, ' हैं,')
    .replace(/\s+(?:हूँ|हूं)\s+/gu, ' ')
    .replace(/\s+(?:हूँ|हूं)$/gu, ' हैं')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (options?.isPresent === false) {
    const female = String(options.gender || '').toLowerCase() === 'female';
    out = female
      ? out
        .replace(/करती हैं/gu, 'करती थीं')
        .replace(/रखती हैं/gu, 'रखती थीं')
      : out
        .replace(/करते हैं/gu, 'करते थे')
        .replace(/रखते हैं/gu, 'रखते थे');
  }
  return out;
}

/**
 * Strip Serbian first-person past auxiliary "sam/сам" while keeping the participle.
 * "Pregledao sam izveštaje" → "Pregledao izveštaje"
 */
export function stripSerbianFirstPersonPastAuxiliary(line: string): string {
  return stripDutyListPrefix(line || '')
    .replace(
      /(^|[^\p{L}])(\p{L}+(?:ao|ala|io|ila|eo|ela|sao|sala|ао|ала|ио|ила|ео|ела|сао|сала))\s+(sam|сам)(?=[^\p{L}]|$)/giu,
      '$1$2',
    )
    .replace(
      /(^|[^\p{L}])(sam|сам)\s+(\p{L}+(?:ao|ala|io|ila|eo|ela|sao|sala|ао|ала|ио|ила|ео|ела|сао|сала))(?=[^\p{L}]|$)/giu,
      '$1$3',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeLeading(line: string, original: string): string {
  if (!line) return line;
  const origLead = stripDutyListPrefix(original).match(/^\p{L}/u)?.[0];
  if (origLead && origLead === origLead.toUpperCase()) {
    return line.charAt(0).toUpperCase() + line.slice(1);
  }
  return line;
}

/** Normalize one Experience bullet to CV perspective for the locale. */
export function normalizeExperienceBulletPerspective(
  line: string,
  options: {
    locale: Locale;
    isPresent: boolean;
    gender?: string;
  },
): string {
  const raw = stripDutyListPrefix(line || '').trim();
  if (!raw) return '';
  const { locale, isPresent, gender } = options;

  if (locale === 'sr' || locale === 'hr') {
    let t = stripSerbianFirstPersonPastAuxiliary(raw);
    // Drop leading "Ja/Ја "
    t = t.replace(/^(ja|ја)\s+/iu, '');
    t = applySerbianCvEmploymentTense(t, isPresent, gender);
    return capitalizeLeading(t, raw);
  }

  if (locale === 'en') {
    let t = raw.replace(/^(i|i'm|i’m)\s+/i, '');
    t = t.replace(/\bmy\b/gi, 'the');
    t = applyEnglishEmploymentTense(t, isPresent);
    return capitalizeLeading(t, raw);
  }

  // de/es/hi/ar/ja: do not force Serbian morphology; light pronoun strip only.
  if (locale === 'de') {
    return capitalizeLeading(raw.replace(/^ich\s+/i, ''), raw);
  }
  if (locale === 'es') {
    return capitalizeLeading(normalizeSpanishCvPerspective(raw, isPresent), raw);
  }
  if (locale === 'hi') {
    return capitalizeLeading(normalizeHindiExperiencePerspective(raw, {
      isPresent,
      gender,
    }), raw);
  }
  if (locale === 'ar') {
    return normalizeArabicExperienceEmploymentGrammar(raw, {
      isPresent,
      gender,
    });
  }
  return raw;
}

export function experienceRequiresCvThirdPerson(locale: Locale): boolean {
  return locale === 'sr' || locale === 'hr' || locale === 'en' || locale === 'es' || locale === 'hi';
}

/**
 * True when text still contains clear first-person singular markers unsuitable
 * for a Serbian/English CV Experience bullet list.
 */
export function hasDisallowedCvFirstPerson(
  text: string,
  locale: Locale,
): boolean {
  if (!experienceRequiresCvThirdPerson(locale)) return false;
  return detectExperiencePersonMode(text, locale) === 'first_singular';
}

export function validateExperienceCvPerspective(
  text: string,
  locale: Locale,
): { ok: boolean; finalPersonMode: ExperiencePersonMode; reason?: string } {
  const finalPersonMode = detectExperiencePersonMode(text, locale);
  if (!experienceRequiresCvThirdPerson(locale)) {
    return { ok: true, finalPersonMode };
  }
  if (finalPersonMode === 'first_singular') {
    return {
      ok: false,
      finalPersonMode,
      reason: 'experience_cv_perspective_first_person',
    };
  }
  return { ok: true, finalPersonMode };
}

/**
 * Normalize a full Experience bullet block to CV perspective.
 * Returns formatted bullets ready for validation/apply.
 */
export function normalizeExperienceBulletsPerspective(
  text: string,
  options: {
    locale: Locale;
    isPresent: boolean;
    gender?: string;
    sourceDescription?: string;
  },
): ExperiencePerspectiveNormalizeResult {
  const locale = options.locale;
  const sourcePersonMode = detectExperiencePersonMode(
    options.sourceDescription || text,
    locale,
  );
  const providerPersonMode = detectExperiencePersonMode(text, locale);
  const perspectiveNormalizationAttempted = experienceRequiresCvThirdPerson(locale)
    && Boolean((text || '').trim());

  const lines = splitExperienceBullets(text || '');
  const normalizedLines = lines.map((line) =>
    normalizeExperienceBulletPerspective(line, {
      locale,
      isPresent: options.isPresent,
      gender: options.gender,
    }));
  const changed = normalizedLines.some((line, i) =>
    normalizeExperienceAiSourceText(line) !== normalizeExperienceAiSourceText(lines[i] || ''));
  const outText = normalizedLines.length
    ? formatExperienceBullets(normalizedLines)
    : '';
  const normalizedPersonMode = detectExperiencePersonMode(outText, locale);
  const perspectiveValidationPassed = validateExperienceCvPerspective(outText, locale).ok;

  return {
    text: outText,
    bullets: normalizedLines,
    sourcePersonMode,
    providerPersonMode,
    normalizedPersonMode,
    perspectiveMode: 'cv_third_person',
    perspectiveNormalizationAttempted,
    perspectiveNormalizationApplied: perspectiveNormalizationAttempted && changed,
    perspectiveValidationPassed,
    changed,
  };
}

/**
 * Meaningful Experience AI change: not a pure bullet/whitespace no-op of the source.
 * Perspective conversion (1sg → CV 3sg) counts because verb forms differ under
 * shared normalization (pregledam ≠ pregleda). Hindi हूँ→हैं is invisible to
 * normalizeSourceFactText (Mn marks stripped) — surface inequality still counts
 * when perspectiveApplied.
 */
export function experienceAiHasMeaningfulChange(
  sourceDescription: string,
  finalText: string,
  options?: { perspectiveApplied?: boolean },
): boolean {
  const source = (sourceDescription || '').trim();
  const final = (finalText || '').trim();
  if (!final) return false;
  // Pure formatting-only equivalence (bullets / CRLF / whitespace) → no-op.
  if (experienceAiSourcesEquivalent(source, final)) {
    if (options?.perspectiveApplied) {
      const a = source.replace(/\s+/g, ' ').trim();
      const b = final.replace(/\s+/g, ' ').trim();
      if (a !== b) return true;
    }
    return false;
  }
  return true;
}
