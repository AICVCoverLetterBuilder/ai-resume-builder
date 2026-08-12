/**
 * Hard Arabic current/completed-role employment-tense validation.
 * Present roles must keep feminine/masculine present forms; completed roles
 * must use natural past forms — never apply present verbs for past roles.
 */

export type ArabicEmploymentTenseResult = {
  providerTensePassed: boolean;
  normalizedTensePassed: boolean;
  finalTensePassed: boolean;
  finalEmploymentState: 'current' | 'completed';
  finalGenderAgreementPassed: boolean;
  finalArabicVerbForms: string[];
  reason?: string;
};

export type ArabicExperiencePersonMode =
  | 'first_singular'
  | 'third_singular'
  | 'neutral'
  | 'unknown';

type ArabicVerbForms = {
  firstPerson: RegExp;
  presentFemale: string;
  presentMale: string;
  pastFemale: string;
  pastMale: string;
};

/**
 * Locale grammar projection for user-authored Arabic Experience duties.
 *
 * Arabic first-person imperfect verbs use a stable أ-prefix while CV bullets
 * require gendered third-person present or completed-role past forms. Keeping
 * this morphology beside the validator prevents a source-preserving fallback
 * from being rejected merely because it faithfully retained "أراجع/أحدّث".
 * The table is grammatical verb morphology, not an occupation catalogue.
 */
const ARABIC_CV_VERB_FORMS: ArabicVerbForms[] = [
  { firstPerson: /أراجع/gu, presentFemale: 'تراجع', presentMale: 'يراجع', pastFemale: 'راجعتْ', pastMale: 'راجع' },
  { firstPerson: /أحدّث/gu, presentFemale: 'تحدّث', presentMale: 'يحدّث', pastFemale: 'حدّثتْ', pastMale: 'حدّث' },
  { firstPerson: /أنسّ?ق/gu, presentFemale: 'تنسّق', presentMale: 'ينسّق', pastFemale: 'نسّقتْ', pastMale: 'نسّق' },
  { firstPerson: /أتحقّ?ق/gu, presentFemale: 'تتحقّق', presentMale: 'يتحقّق', pastFemale: 'تحقّقتْ', pastMale: 'تحقّق' },
  { firstPerson: /أعدّ(?!ت)/gu, presentFemale: 'تعدّ', presentMale: 'يعدّ', pastFemale: 'أعدّتْ', pastMale: 'أعدّ' },
  { firstPerson: /أحافظ/gu, presentFemale: 'تحافظ', presentMale: 'يحافظ', pastFemale: 'حافظتْ', pastMale: 'حافظ' },
  { firstPerson: /أنشئ/gu, presentFemale: 'تنشئ', presentMale: 'ينشئ', pastFemale: 'أنشأتْ', pastMale: 'أنشأ' },
  { firstPerson: /أؤدّي/gu, presentFemale: 'تؤدّي', presentMale: 'يؤدّي', pastFemale: 'أدّتْ', pastMale: 'أدّى' },
  { firstPerson: /أتعاون/gu, presentFemale: 'تتعاون', presentMale: 'يتعاون', pastFemale: 'تعاونتْ', pastMale: 'تعاون' },
  { firstPerson: /أعلّ?م/gu, presentFemale: 'تعلّم', presentMale: 'يعلّم', pastFemale: 'علّمتْ', pastMale: 'علّم' },
];

const ARABIC_TOKEN_RE = /[\p{Script=Arabic}\p{M}]+/gu;
const ARABIC_LETTER_RE = /\p{Script=Arabic}/u;
const ARABIC_EXPLICIT_FIRST_PAST_RE = /تُ$/u;
const ARABIC_EXPLICIT_THIRD_FEMALE_PAST_RE = /تْ$/u;

function arabicTokens(text: string): string[] {
  return (String(text || '').normalize('NFKC').match(ARABIC_TOKEN_RE) || [])
    .filter((token) => ARABIC_LETTER_RE.test(token));
}

function leadingArabicPredicateTokens(text: string): string[] {
  return String(text || '')
    .normalize('NFKC')
    .split(/\r?\n/u)
    .map((line) => line
      .trim()
      .replace(/^(?:[•●◦*\-–—]|\d+[.)])\s*/u, '')
      .match(/^[\p{Script=Arabic}\p{M}]+/u)?.[0] || '')
    .filter(Boolean);
}

function stripArabicMarks(token: string): string {
  return String(token || '').normalize('NFKC').replace(/\p{M}/gu, '');
}

type GenericArabicPredicateMorphology = {
  presentFemale: string[];
  presentMale: string[];
  pastFemale: string[];
  pastMale: string[];
};

/**
 * Infer tense/person only from repeated sentence-initial predicate morphology.
 * This deliberately avoids an occupation verb catalogue: optional Arabic
 * marks do not change the classification, while explicit تُ remains a 1sg
 * signal before this helper is consulted.
 */
function classifyGenericArabicPredicateMorphology(
  leadingTokens: string[],
): GenericArabicPredicateMorphology {
  const normalized = leadingTokens.map((token) => ({
    raw: token,
    bare: stripArabicMarks(token),
  }));
  const repeated = (items: string[]) => items.length >= 2 ? items : [];
  const presentFemale = repeated(normalized
    .filter(({ bare }) => /^ت(?!ل).{2,}$/u.test(bare) && !bare.endsWith('ت'))
    .map(({ raw }) => raw));
  const presentMale = repeated(normalized
    .filter(({ bare }) => /^ي(?!ل).{2,}$/u.test(bare))
    .map(({ raw }) => raw));
  const pastFemale = repeated(normalized
    .filter(({ bare }) => bare.length >= 3 && bare.endsWith('ت'))
    .map(({ raw }) => raw));
  // A bare 3sg masculine perfect has no universal suffix. Repeated predicate
  // position plus the absence of imperfect prefixes is the portable evidence.
  // Known irregular ت-/أ-initial perfect forms remain covered by the table.
  const pastMale = repeated(normalized
    .filter(({ bare }) => bare.length >= 3 && !/^[يتأ]/u.test(bare) && !bare.endsWith('ت'))
    .map(({ raw }) => raw));
  return { presentFemale, presentMale, pastFemale, pastMale };
}

function regexpMatchesToken(pattern: RegExp, token: string): boolean {
  pattern.lastIndex = 0;
  const matched = pattern.test(token);
  pattern.lastIndex = 0;
  return matched;
}

function isKnownFirstPersonPresentToken(token: string): boolean {
  return ARABIC_CV_VERB_FORMS.some((forms) => regexpMatchesToken(forms.firstPerson, token));
}

function isKnownThirdPersonPresentToken(token: string): boolean {
  return ARABIC_CV_VERB_FORMS.some((forms) => (
    token.startsWith(forms.presentFemale) || token.startsWith(forms.presentMale)
  ));
}

function isKnownThirdPersonMalePastToken(token: string): boolean {
  return ARABIC_CV_VERB_FORMS.some((forms) => token === forms.pastMale);
}

function isUnambiguousThirdPersonFemalePastToken(token: string): boolean {
  if (ARABIC_EXPLICIT_THIRD_FEMALE_PAST_RE.test(token)) return true;
  // Geminate third-person feminine forms contract the doubled radical before
  // ت (أعددتُ -> أعدّتْ). That contracted spelling is not a 1sg surface even
  // when the final sukūn is omitted.
  return /ّت$/u.test(token) && !ARABIC_EXPLICIT_FIRST_PAST_RE.test(token);
}

/**
 * Classify Arabic Experience person without stripping the final case/mood mark
 * that distinguishes 1sg past تُ from 3sg feminine past تْ. Undiacritized past
 * forms such as راجعت remain neutral unless another unambiguous cue exists.
 */
export function detectArabicExperiencePersonMode(
  text: string,
  options?: { isPresent?: boolean },
): ArabicExperiencePersonMode {
  const raw = String(text || '').normalize('NFKC').trim();
  if (!raw) return 'unknown';
  const tokens = arabicTokens(raw);
  if (!tokens.length) return 'unknown';

  if (tokens.includes('أنا')) return 'first_singular';
  if (tokens.some((token) => ARABIC_EXPLICIT_FIRST_PAST_RE.test(token))) {
    return 'first_singular';
  }

  const leading = leadingArabicPredicateTokens(raw)
    .map((token) => token.startsWith('و') ? token.slice(1) : token)
    .filter(Boolean);
  const morphology = classifyGenericArabicPredicateMorphology(leading);
  const knownFirstPresent = tokens.filter(isKnownFirstPersonPresentToken).length;
  const genericFirstPresent = leading.filter((token) => (
    /^أ(?!ل)[\p{Script=Arabic}\p{M}]{2,}$/u.test(token)
  )).length;

  if (options?.isPresent !== false && (knownFirstPresent > 0 || genericFirstPresent >= 2)) {
    return 'first_singular';
  }

  if (tokens.includes('هي') || tokens.includes('هو')) return 'third_singular';
  if (tokens.some(isUnambiguousThirdPersonFemalePastToken)) return 'third_singular';
  if (options?.isPresent === false && (
    tokens.some(isKnownThirdPersonMalePastToken)
    || morphology.pastFemale.length > 0
    || morphology.pastMale.length > 0
  )) {
    return 'third_singular';
  }

  if (options?.isPresent !== false) {
    const knownThirdPresent = tokens.filter(isKnownThirdPersonPresentToken).length;
    const genericThirdPresent = leading.filter((token) => (
      /^[تي](?!ل)[\p{Script=Arabic}\p{M}]{2,}$/u.test(token)
    )).length;
    if (knownThirdPresent > 0 || genericThirdPresent >= 2) return 'third_singular';
  }

  return 'neutral';
}

function collapseFinalDoubledRadical(base: string): string {
  return base.replace(/([\p{Script=Arabic}])\1$/u, '$1ّ');
}

function normalizeExplicitArabicFirstPersonPastToken(
  token: string,
  female: boolean,
): string {
  if (!ARABIC_EXPLICIT_FIRST_PAST_RE.test(token)) return token;
  const base = collapseFinalDoubledRadical(token.replace(/تُ$/u, ''));
  return female ? `${base}تْ` : base;
}

function normalizeLeadingArabicFirstPersonPresent(
  text: string,
  female: boolean,
): string {
  return text
    .split(/(\r?\n)/u)
    .map((part) => {
      if (/^\r?\n$/u.test(part)) return part;
      return part.replace(
        /^(\s*(?:[•●◦*\-–—]|\d+[.)])?\s*)أ(?!ل)(?=[\p{Script=Arabic}\p{M}]{2,})/u,
        `$1${female ? 'ت' : 'ي'}`,
      );
    })
    .join('');
}

/**
 * Emit explicit selected-person evidence for Arabic text produced by a trusted
 * locale realization builder. An unvocalized past form ending in ت is ambiguous
 * in isolation; the builder knows it selected 3sg feminine, so serialize sukūn
 * rather than relying on hidden construction history at final/visible checks.
 */
export function realizeArabicBuiltExperiencePersonEvidence(
  text: string,
  options: { isPresent?: boolean; gender?: string },
): string {
  if (options.isPresent !== false || normalizeGender(options.gender) !== 'female') {
    return text;
  }
  return String(text || '')
    .normalize('NFKC')
    .split(/(\r?\n)/u)
    .map((part) => {
      if (/^\r?\n$/u.test(part)) return part;
      return part.replace(
        /^(\s*(?:[•●◦*\-–—]|\d+[.)])?\s*)([\p{Script=Arabic}\p{M}]*ت)(?![\p{L}\p{M}])/u,
        '$1$2ْ',
      );
    })
    .join('');
}

export function normalizeArabicExperienceEmploymentGrammar(
  text: string,
  options: { isPresent?: boolean; gender?: string },
): string {
  const isPresent = options.isPresent !== false;
  const female = normalizeGender(options.gender) === 'female';
  let normalized = (text || '').normalize('NFKC');
  for (const forms of ARABIC_CV_VERB_FORMS) {
    const replacement = isPresent
      ? (female ? forms.presentFemale : forms.presentMale)
      : (female ? forms.pastFemale : forms.pastMale);
    normalized = normalized.replace(forms.firstPerson, replacement);
  }
  if (isPresent) {
    normalized = normalizeLeadingArabicFirstPersonPresent(normalized, female);
  } else {
    normalized = normalized.replace(ARABIC_TOKEN_RE, (token) => (
      normalizeExplicitArabicFirstPersonPastToken(token, female)
    ));
  }
  return normalized.trim();
}

/** Feminine / masculine present stems common in warehouse + design shells. */
const AR_PRESENT_FEMALE =
  /(?<![\p{L}\p{M}])(?:تعدّ|تراجع|تتحقّ?ق|تحدّث|تنسّق|تحافظ|تنشئ|تؤدي|تتعاون)(?![\p{L}\p{M}])/u;
const AR_PRESENT_MALE =
  /(?<![\p{L}\p{M}])(?:يعدّ|يراجع|يتحقّ?ق|يحدّث|ينسّق|يحافظ|ينشئ|يؤدي|يتعاون)(?![\p{L}\p{M}])/u;
/** Natural past forms (female + male) for completed roles. */
const AR_PAST_FEMALE =
  /(?<![\p{L}\p{M}])(?:أعدّت|راجعت|كيّفت|نسّقت|حافظت|تحقّقت|حدّثت|أنشأت|أدّت|تعاونت|ضبطت)(?:ْ)?(?![\p{L}\p{M}])/u;
const AR_PAST_MALE =
  /(?<![\p{L}\p{M}])(?:أعدّ(?!ت)|راجع(?!ت)|كيّف(?!ت)|نسّق(?!ت)|حافظ(?!ت)|تحقّق(?!ت)|حدّث(?!ت)|أنشأ(?!ت)|أدّى|تعاون(?!ت)|ضبط(?!ت))(?![\p{L}\p{M}])/u;

function collectForms(text: string): string[] {
  const forms: string[] = [];
  const patterns = [AR_PRESENT_FEMALE, AR_PRESENT_MALE, AR_PAST_FEMALE, AR_PAST_MALE];
  for (const re of patterns) {
    const copy = new RegExp(re.source, 'gu');
    let m: RegExpExecArray | null;
    while ((m = copy.exec(text))) {
      if (!forms.includes(m[0])) forms.push(m[0]);
    }
  }
  return forms;
}

function normalizeGender(gender?: string): 'female' | 'male' | 'unknown' {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski') return 'female';
  if (g === 'male' || g === 'm' || g === 'muški' || g === 'muski') return 'male';
  return 'unknown';
}

/**
 * Validate Arabic Experience bullets against employment state + gender.
 */
export function validateArabicExperienceEmploymentTense(
  text: string,
  options: { isPresent?: boolean; gender?: string },
): ArabicEmploymentTenseResult {
  const raw = (text || '').normalize('NFKC');
  const isPresent = options.isPresent !== false;
  const gender = normalizeGender(options.gender);
  const finalEmploymentState = isPresent ? 'current' : 'completed';
  const knownForms = collectForms(raw);
  const leading = leadingArabicPredicateTokens(raw)
    .map((token) => token.startsWith('و') ? token.slice(1) : token)
    .filter(Boolean);
  const morphology = classifyGenericArabicPredicateMorphology(leading);
  // Arbitrary current-role duties use the same imperfect-person prefixes as
  // the curated realization table. Require repeated leading-predicate
  // evidence before treating an unknown stem as tense/gender proof, avoiding
  // a single Arabic noun beginning with ت/ي from becoming a verb claim.
  const provenGenericPresentFemale = morphology.presentFemale;
  const provenGenericPresentMale = morphology.presentMale;
  const provenGenericPastFemale = morphology.pastFemale;
  const provenGenericPastMale = morphology.pastMale;
  const forms = [...new Set([
    ...knownForms,
    ...provenGenericPresentFemale,
    ...provenGenericPresentMale,
    ...provenGenericPastFemale,
    ...provenGenericPastMale,
  ])];

  const hasPresentFemale = AR_PRESENT_FEMALE.test(raw)
    || provenGenericPresentFemale.length > 0;
  const hasPresentMale = AR_PRESENT_MALE.test(raw)
    || provenGenericPresentMale.length > 0;
  const hasPastFemale = AR_PAST_FEMALE.test(raw)
    || provenGenericPastFemale.length > 0;
  const hasPastMale = AR_PAST_MALE.test(raw)
    || provenGenericPastMale.length > 0;
  const hasPresent = hasPresentFemale || hasPresentMale;
  const hasPast = hasPastFemale || hasPastMale;
  const hasExplicitFirstPersonPast = arabicTokens(raw)
    .some((token) => ARABIC_EXPLICIT_FIRST_PAST_RE.test(token));

  let providerTensePassed = true;
  let reason: string | undefined;

  if (hasExplicitFirstPersonPast) {
    providerTensePassed = false;
    reason = 'arabic_experience_first_person';
  } else if (isPresent) {
    // Current role: require present forms; reject completed-only past shells.
    if (hasPast && !hasPresent) {
      providerTensePassed = false;
      reason = 'arabic_employment_tense_mismatch';
    } else if (!hasPresent && forms.length === 0) {
      // No recognizable verbs — fail closed for Arabic hard validation.
      providerTensePassed = false;
      reason = 'arabic_employment_tense_unknown';
    }
  } else if (hasPresent) {
    // Completed role must not remain in present tense.
    providerTensePassed = false;
    reason = 'arabic_completed_role_present_tense';
  } else if (!hasPast && forms.length === 0) {
    providerTensePassed = false;
    reason = 'arabic_employment_tense_unknown';
  }

  let finalGenderAgreementPassed = true;
  if (gender === 'female') {
    if (isPresent && hasPresentMale && !hasPresentFemale) finalGenderAgreementPassed = false;
    if (!isPresent && hasPastMale && !hasPastFemale) finalGenderAgreementPassed = false;
    if (isPresent && hasPresentFemale) finalGenderAgreementPassed = true;
    if (!isPresent && hasPastFemale) finalGenderAgreementPassed = true;
  } else if (gender === 'male') {
    if (isPresent && hasPresentFemale && !hasPresentMale) finalGenderAgreementPassed = false;
    if (!isPresent && hasPastFemale && !hasPastMale) finalGenderAgreementPassed = false;
  }

  if (!finalGenderAgreementPassed) {
    reason = reason || 'arabic_gender_agreement_failed';
  }

  const normalizedTensePassed = providerTensePassed;
  const finalTensePassed = providerTensePassed && normalizedTensePassed;

  return {
    providerTensePassed,
    normalizedTensePassed,
    finalTensePassed,
    finalEmploymentState,
    finalGenderAgreementPassed,
    finalArabicVerbForms: forms,
    reason: finalTensePassed && finalGenderAgreementPassed ? undefined : reason,
  };
}
