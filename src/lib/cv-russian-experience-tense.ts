/**
 * Russian Experience employment tense / gender postconditions.
 * Present roles use 3rd-person present; completed roles use past.
 */
export type RussianExperienceTenseResult = {
  finalTensePassed: boolean;
  finalGenderAgreementPassed: boolean;
  reason?: string;
};

const PRESENT_3SG =
  /(?:проверяет|обновляет|поддерживает|координирует|согласовывает|созда[её]т|адаптирует|подготавливает|готовит|обеспечивает|разрабатывает|внедряет|сотрудничает|анализирует|планирует|транспортирует|загружает|доставляет)/iu;
const PAST_FEMALE =
  /(?:проверяла|обновляла|поддерживала|координировала|согласовывала|создавала|адаптировала|подготавливала|готовила|обеспечивала|выполняла|работала|разрабатывала|внедряла|сотрудничала|анализировала|планировала|транспортировала|загружала|доставляла)/iu;
const PAST_MALE =
  /(?:проверял|обновлял|поддерживал|координировал|согласовывал|создавал|адаптировал|подготавливал|готовил|обеспечивал|выполнял|работал|разрабатывал|внедрял|сотрудничал|анализировал|планировал|транспортировал|загружал|доставлял)(?!а)/iu;
const FIRST_PERSON = /(?:\bя\b|работаю|работала\s+я|я\s+работа)/iu;

export function validateRussianExperienceEmploymentTense(
  text: string,
  options: { isPresent?: boolean; gender?: string },
): RussianExperienceTenseResult {
  const raw = (text || '').trim();
  if (!raw) {
    return {
      finalTensePassed: false,
      finalGenderAgreementPassed: false,
      reason: 'russian_employment_tense_empty',
    };
  }
  if (FIRST_PERSON.test(raw)) {
    return {
      finalTensePassed: false,
      finalGenderAgreementPassed: false,
      reason: 'russian_employment_first_person',
    };
  }
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const present = options.isPresent !== false;

  if (present) {
    const ok = PRESENT_3SG.test(raw) && !PAST_FEMALE.test(raw) && !PAST_MALE.test(raw);
    return {
      finalTensePassed: ok,
      finalGenderAgreementPassed: ok,
      reason: ok ? undefined : 'russian_employment_tense_mismatch',
    };
  }

  if (female) {
    const ok = PAST_FEMALE.test(raw) && !PRESENT_3SG.test(raw);
    return {
      finalTensePassed: ok,
      finalGenderAgreementPassed: ok,
      reason: ok ? undefined : 'russian_employment_tense_mismatch',
    };
  }

  const ok = PAST_MALE.test(raw) && !PRESENT_3SG.test(raw) && !PAST_FEMALE.test(raw);
  return {
    finalTensePassed: ok,
    finalGenderAgreementPassed: ok,
    reason: ok ? undefined : 'russian_employment_tense_mismatch',
  };
}
