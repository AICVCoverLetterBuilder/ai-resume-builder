/**
 * Experience AI grammatical-person / CV-perspective normalization.
 *
 * Tense (present|past) and person (1sg vs CV 3sg) are separate dimensions.
 * `tense_normalization: ok` must never be treated as proof of CV perspective.
 */
import type { Locale } from './i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { applyEnglishEmploymentTense } from './cv-material-duty-coverage';
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
const SR_1SG_PAST_AUX_RE =
  /(?:^|[^\p{L}])(\p{L}+(?:ao|ala|io|ila|eo|ela|sao|sala|ао|ала|ио|ила|ео|ела|сао|сала))\s+(sam|сам)(?=[^\p{L}]|$)/iu;

const EN_1SG_RE = /(?:^|[^\p{L}])(i|i'm|i’m|i’ve|i've|my)\b/iu;

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
  return 'neutral';
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
    return capitalizeLeading(raw.replace(/^yo\s+/i, ''), raw);
  }
  return raw;
}

export function experienceRequiresCvThirdPerson(locale: Locale): boolean {
  return locale === 'sr' || locale === 'hr' || locale === 'en';
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
 * shared normalization (pregledam ≠ pregleda).
 */
export function experienceAiHasMeaningfulChange(
  sourceDescription: string,
  finalText: string,
  _options?: { perspectiveApplied?: boolean },
): boolean {
  const source = (sourceDescription || '').trim();
  const final = (finalText || '').trim();
  if (!final) return false;
  // Pure formatting-only equivalence (bullets / CRLF / whitespace) → no-op.
  if (experienceAiSourcesEquivalent(source, final)) return false;
  return true;
}
