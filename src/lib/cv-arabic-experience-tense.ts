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
  { firstPerson: /أراجع/gu, presentFemale: 'تراجع', presentMale: 'يراجع', pastFemale: 'راجعت', pastMale: 'راجع' },
  { firstPerson: /أحدّث/gu, presentFemale: 'تحدّث', presentMale: 'يحدّث', pastFemale: 'حدّثت', pastMale: 'حدّث' },
  { firstPerson: /أنسّ?ق/gu, presentFemale: 'تنسّق', presentMale: 'ينسّق', pastFemale: 'نسّقت', pastMale: 'نسّق' },
  { firstPerson: /أتحقّ?ق/gu, presentFemale: 'تتحقّق', presentMale: 'يتحقّق', pastFemale: 'تحقّقت', pastMale: 'تحقّق' },
  { firstPerson: /أعدّ/gu, presentFemale: 'تعدّ', presentMale: 'يعدّ', pastFemale: 'أعدّت', pastMale: 'أعدّ' },
  { firstPerson: /أحافظ/gu, presentFemale: 'تحافظ', presentMale: 'يحافظ', pastFemale: 'حافظت', pastMale: 'حافظ' },
  { firstPerson: /أنشئ/gu, presentFemale: 'تنشئ', presentMale: 'ينشئ', pastFemale: 'أنشأت', pastMale: 'أنشأ' },
  { firstPerson: /أؤدّي/gu, presentFemale: 'تؤدّي', presentMale: 'يؤدّي', pastFemale: 'أدّت', pastMale: 'أدّى' },
  { firstPerson: /أتعاون/gu, presentFemale: 'تتعاون', presentMale: 'يتعاون', pastFemale: 'تعاونت', pastMale: 'تعاون' },
  { firstPerson: /أعلّ?م/gu, presentFemale: 'تعلّم', presentMale: 'يعلّم', pastFemale: 'علّمت', pastMale: 'علّم' },
];

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
  return normalized.trim();
}

/** Feminine / masculine present stems common in warehouse + design shells. */
const AR_PRESENT_FEMALE =
  /(?:تعدّ|تراجع|تتحقق|تحدّث|تنسّق|تحافظ|تنشئ|تؤدي|تتعاون)/u;
const AR_PRESENT_MALE =
  /(?:يعدّ|يراجع|يتحقق|يحدّث|ينسّق|يحافظ|ينشئ|يؤدي|يتعاون)/u;
/** Natural past forms (female + male) for completed roles. */
const AR_PAST_FEMALE =
  /(?:أعدّت|راجعت|كيّفت|نسّقت|حافظت|تحقّقت|حدّثت|أنشأت|أدّت|تعاونت|ضبطت)/u;
const AR_PAST_MALE =
  /(?:أعدّ(?!ت)|راجع(?!ت)|كيّف(?!ت)|نسّق(?!ت)|حافظ(?!ت)|تحقّق(?!ت)|حدّث(?!ت)|أنشأ(?!ت)|أدّى|تعاون(?!ت)|ضبط(?!ت))/u;

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
  const forms = collectForms(raw);

  const hasPresentFemale = AR_PRESENT_FEMALE.test(raw);
  const hasPresentMale = AR_PRESENT_MALE.test(raw);
  const hasPastFemale = AR_PAST_FEMALE.test(raw);
  const hasPastMale = AR_PAST_MALE.test(raw);
  const hasPresent = hasPresentFemale || hasPresentMale;
  const hasPast = hasPastFemale || hasPastMale;

  let providerTensePassed = true;
  let reason: string | undefined;

  if (isPresent) {
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
