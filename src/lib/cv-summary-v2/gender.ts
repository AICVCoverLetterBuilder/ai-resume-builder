/**
 * AAB-389 — shared selected-gender resolution for Summary V2 surface realization.
 *
 * Visible Summary text must never contain slash (`radio/la`, `करता/करती`) or
 * parenthetical (`работал(а)`) gender placeholders. `selectedGender` is the only
 * authority; when it is absent the realizers use the grammatically unmarked
 * (generic) form of the locale instead of a placeholder.
 */

export const SUMMARY_V2_GENDER_SURFACE_389_REVISION =
  'summary-v2-gender-surface-389-v1' as const;

export type SummaryV2GenderMode = 'male' | 'female' | 'unspecified';

const FEMALE_RE = /^(?:female|f|w|weiblich|femenino|féminin|feminino|femminile|женский|жен|ženski|zenski|ž|z|أنثى|महिला|女性)$/i;
const MALE_RE = /^(?:male|m|männlich|mannlich|masculino|masculin|maschile|мужской|муж|muški|muski|ذكر|पुरुष|男性)$/i;

export function resolveSummaryV2GenderMode(
  gender?: string | null,
): SummaryV2GenderMode {
  const raw = String(gender ?? '').trim();
  if (!raw) return 'unspecified';
  if (FEMALE_RE.test(raw)) return 'female';
  if (MALE_RE.test(raw)) return 'male';
  return 'unspecified';
}

/**
 * Pick a single realized form. `unspecified` resolves to the unmarked form —
 * never a slash/parenthetical placeholder.
 */
export function pickGenderedForm(
  mode: SummaryV2GenderMode,
  forms: { male: string; female: string; unmarked?: string },
): string {
  if (mode === 'female') return forms.female;
  if (mode === 'male') return forms.male;
  return forms.unmarked ?? forms.male;
}

/**
 * Slash / parenthetical gender placeholders that must never reach the user.
 * Combining marks count as part of a word (Devanagari matras, Arabic shadda).
 */
export const UNRESOLVED_GENDER_PLACEHOLDER_RE =
  /[\p{L}\p{M}]+\s*\/\s*[\p{L}\p{M}]{1,6}(?=[^\p{L}\p{M}]|$)|[\p{L}\p{M}]+\((?:[\p{L}\p{M}]{1,3})\)/u;

export function detectUnresolvedGenderPlaceholder(text: string): boolean {
  const t = (text || '').replace(/\s+/g, ' ');
  if (!t) return false;
  // Cyrillic / Latin parenthetical suffix: работал(а), radio(la), arbeitete(r)
  if (/[\p{L}\p{M}]\((?:[\p{L}\p{M}]{1,3})\)/u.test(t)) return true;
  // Slash pairs where both sides are inflections of the same stem or short endings.
  const slashRe = /([\p{L}\p{M}]{2,})\s*\/\s*([\p{L}\p{M}]{1,8})(?=[^\p{L}\p{M}]|$)/gu;
  let m: RegExpExecArray | null = slashRe.exec(t);
  while (m) {
    const left = m[1];
    const right = m[2];
    // URLs / date ranges are filtered by requiring letters on both sides already.
    if (right.length <= 4) return true;
    if (left.slice(0, 3).toLocaleLowerCase() === right.slice(0, 3).toLocaleLowerCase()) {
      return true;
    }
    m = slashRe.exec(t);
  }
  return false;
}
