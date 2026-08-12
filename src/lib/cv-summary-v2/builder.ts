import type { Locale } from '@/lib/i18n/translations';
import { SUMMARY_V2_REVISION } from './flag';
import type {
  SummaryV2EmploymentState,
  SummaryV2EntryFact,
  SummaryV2SelectionManifest,
} from './types';
import {
  bulletToWhereClauseEn,
  dutyTenseFromEmploymentState,
} from './tense';
import { buildGermanSummaryV2FromManifest } from './german-surface';
import {
  buildNativeFirstPersonDutyTail,
  formatNativeDurationSentence,
} from './native-surface';
import { resolveSummaryV2GenderMode, pickGenderedForm } from './gender';

/**
 * Russian / South-Slavic role titles are arbitrary free text and cannot be
 * declined safely, so the shell quotes the citation form after a case-stable
 * head noun (`на должности «…»` / `na poziciji «…»`).
 */
export function quoteRoleCitation(role: string): string {
  const r = (role || '').trim();
  if (!r) return r;
  if (/^[«"'„].*[»"'“]$/u.test(r)) return r;
  return `«${r}»`;
}

/**
 * Arabic "as <role>": the kaf prefix attaches directly to an Arabic word and
 * keeps the tatweel + space only before a non-Arabic (Latin) role title.
 */
export function arabicAsRole(role: string): string {
  const r = (role || '').trim();
  if (!r) return 'كـ';
  return /^[\u0600-\u06FF]/u.test(r) ? `كـ${r}` : `كـ ${r}`;
}

export { bulletToWhereClauseEn } from './tense';
export {
  buildGermanSummaryV2FromManifest,
  bulletToGermanWoIchClause,
  GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION,
  GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION,
} from './german-surface';

function joinDutyClauses(
  facts: SummaryV2EntryFact[],
  employmentState: SummaryV2EmploymentState,
): string {
  const tense = dutyTenseFromEmploymentState(employmentState);
  const parts = facts
    .map((f) => bulletToWhereClauseEn(f.bulletText, tense))
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function normalizeDurationCore(phrase: string): string {
  return (phrase || '')
    .replace(/^(?:with|bringing|having)\s+/iu, '')
    .replace(/\s+of\s+(?:professional\s+)?experience.*$/iu, '')
    .replace(/[.,]$/u, '')
    .trim();
}

function articleFor(role: string): string {
  return /^[aeiou]/i.test((role || '').trim()) ? 'an' : 'a';
}

function buildEnglishFromManifest(manifest: SummaryV2SelectionManifest): string {
  const units: string[] = [];
  const durCore = normalizeDurationCore(manifest.durationPhrase);
  if (durCore) {
    units.push(`I have ${durCore} of experience.`);
  }

  const current = manifest.current;
  if (current) {
    const role = current.role || 'professional';
    const employer = current.employer;
    const duties = joinDutyClauses(
      manifest.requiredCurrentFacts,
      current.employmentState,
    );
    let unit = employer
      ? `I currently work as ${articleFor(role)} ${role} at ${employer}`
      : `I currently work as ${articleFor(role)} ${role}`;
    if (duties) unit = `${unit}, where I ${duties}`;
    units.push(`${unit}.`);
  }

  for (let i = 0; i < manifest.priors.length; i += 1) {
    const prior = manifest.priors[i];
    const priorFacts = manifest.requiredPriorFacts.filter((f) => f.entryId === prior.entryId);
    const role = prior.role || 'professional';
    const employer = prior.employer;
    const duties = joinDutyClauses(priorFacts, prior.employmentState);
    const opener = i === 0 ? 'Previously' : 'Before that';
    let unit = employer
      ? `${opener}, I worked as ${articleFor(role)} ${role} at ${employer}`
      : `${opener}, I worked as ${articleFor(role)} ${role}`;
    if (duties) unit = `${unit}, where I ${duties}`;
    units.push(`${unit}.`);
  }

  return units.join(' ').replace(/\s+/g, ' ').trim();
}

function localeDutyTail(
  facts: SummaryV2EntryFact[],
  employmentState: SummaryV2EmploymentState,
  locale: Locale,
  gender?: string | null,
): string {
  const bullets = facts.map((f) => f.bulletText).filter(Boolean);
  return buildNativeFirstPersonDutyTail(bullets, locale, employmentState, gender);
}

/**
 * Non-EN locales: same fact authority / structure; duration from structured
 * dates; roles/employers/duties from the live snapshot (proper nouns + live
 * bullet text). Duty tense follows each entry's employmentState.
 */
function buildLocaleShellFromManifest(manifest: SummaryV2SelectionManifest): string {
  const locale = manifest.locale;
  const units: string[] = [];
  const dur = (manifest.durationPhrase || '').replace(/[.,]$/u, '').trim();
  const genderMode = resolveSummaryV2GenderMode(manifest.gender);
  const scWorked = pickGenderedForm(genderMode, { male: 'radio', female: 'radila' });
  const ruWorked = pickGenderedForm(genderMode, { male: 'работал', female: 'работала' });
  const hiDoes = pickGenderedForm(genderMode, { male: 'करता', female: 'करती' });
  const hiWas = pickGenderedForm(genderMode, { male: 'था', female: 'थी' });

  const current = manifest.current;
  if (current) {
    const role = current.role || 'Professional';
    const employer = current.employer;
    const dutyTail = localeDutyTail(
      manifest.requiredCurrentFacts,
      current.employmentState,
      locale,
      manifest.gender,
    );
    if (locale === 'de') {
      units.push(
        employer
          ? `Ich arbeite derzeit als ${role} bei ${employer}${dutyTail}.`
          : `Ich arbeite derzeit als ${role}${dutyTail}.`,
      );
    } else if (locale === 'es') {
      units.push(
        employer
          ? `Actualmente trabajo como ${role} en ${employer}${dutyTail}.`
          : `Actualmente trabajo como ${role}${dutyTail}.`,
      );
    } else if (locale === 'fr') {
      units.push(
        employer
          ? `Je travaille actuellement comme ${role} chez ${employer}${dutyTail}.`
          : `Je travaille actuellement comme ${role}${dutyTail}.`,
      );
    } else if (locale === 'it') {
      units.push(
        employer
          ? `Attualmente lavoro come ${role} presso ${employer}${dutyTail}.`
          : `Attualmente lavoro come ${role}${dutyTail}.`,
      );
    } else if (locale === 'pt-BR') {
      units.push(
        employer
          ? `Atualmente trabalho como ${role} na ${employer}${dutyTail}.`
          : `Atualmente trabalho como ${role}${dutyTail}.`,
      );
    } else if (locale === 'ru') {
      const title = quoteRoleCitation(role);
      units.push(
        employer
          ? `Сейчас я работаю на должности ${title} в ${employer}${dutyTail}.`
          : `Сейчас я работаю на должности ${title}${dutyTail}.`,
      );
    } else if (locale === 'sr' || locale === 'hr') {
      units.push(
        employer
          ? `Trenutno radim kao ${role} u ${employer}${dutyTail}.`
          : `Trenutno radim kao ${role}${dutyTail}.`,
      );
    } else if (locale === 'ar') {
      units.push(
        employer
          ? `أعمل حالياً ${arabicAsRole(role)} في ${employer}${dutyTail}.`
          : `أعمل حالياً ${arabicAsRole(role)}${dutyTail}.`,
      );
    } else if (locale === 'hi') {
      units.push(
        employer
          ? `मैं वर्तमान में ${employer} में ${role} के रूप में काम ${hiDoes} हूँ${dutyTail}।`
          : `मैं वर्तमान में ${role} के रूप में काम ${hiDoes} हूँ${dutyTail}।`,
      );
    } else if (locale === 'ja') {
      units.push(
        employer
          ? `現在、${employer}で${role}として勤務しています${dutyTail}。`
          : `現在、${role}として勤務しています${dutyTail}。`,
      );
    } else {
      units.push(
        employer
          ? `I currently work as a ${role} at ${employer}${dutyTail}.`
          : `I currently work as a ${role}${dutyTail}.`,
      );
    }
  }

  for (const prior of manifest.priors) {
    const priorFacts = manifest.requiredPriorFacts.filter((f) => f.entryId === prior.entryId);
    const role = prior.role || 'Professional';
    const employer = prior.employer;
    const dutyTail = localeDutyTail(priorFacts, prior.employmentState, locale, manifest.gender);
    // Hindi perfectives require an ergative first-person frame (मैंने). Keep
    // habitual completed clauses in the ordinary मैं ... करती/करता थी/था frame.
    // This is morphology-only and intentionally has no role/duty vocabulary.
    const hindiPriorUsesPerfective = locale === 'hi'
      && /(?:[\p{Script=Devanagari}\p{M}]+(?:या|यी|ाई|ए|ीं)|की)(?=\s*(?:[,।.!?]|और|तथा|$))/u.test(dutyTail);
    if (locale === 'de') {
      units.push(
        employer
          ? `Zuvor arbeitete ich als ${role} bei ${employer}${dutyTail}.`
          : `Zuvor arbeitete ich als ${role}${dutyTail}.`,
      );
    } else if (locale === 'es') {
      units.push(
        employer
          ? `Anteriormente trabajé como ${role} en ${employer}${dutyTail}.`
          : `Anteriormente trabajé como ${role}${dutyTail}.`,
      );
    } else if (locale === 'fr') {
      units.push(
        employer
          ? `Auparavant, j'ai travaillé comme ${role} chez ${employer}${dutyTail}.`
          : `Auparavant, j'ai travaillé comme ${role}${dutyTail}.`,
      );
    } else if (locale === 'it') {
      units.push(
        employer
          ? `In precedenza ho lavorato come ${role} presso ${employer}${dutyTail}.`
          : `In precedenza ho lavorato come ${role}${dutyTail}.`,
      );
    } else if (locale === 'pt-BR') {
      units.push(
        employer
          ? `Anteriormente trabalhei como ${role} na ${employer}${dutyTail}.`
          : `Anteriormente trabalhei como ${role}${dutyTail}.`,
      );
    } else if (locale === 'ru') {
      const title = quoteRoleCitation(role);
      units.push(
        employer
          ? `Ранее я ${ruWorked} на должности ${title} в ${employer}${dutyTail}.`
          : `Ранее я ${ruWorked} на должности ${title}${dutyTail}.`,
      );
    } else if (locale === 'sr' || locale === 'hr') {
      units.push(
        employer
          ? `Prethodno sam ${scWorked} kao ${role} u ${employer}${dutyTail}.`
          : `Prethodno sam ${scWorked} kao ${role}${dutyTail}.`,
      );
    } else if (locale === 'ar') {
      units.push(
        employer
          ? `سابقاً عملت ${arabicAsRole(role)} في ${employer}${dutyTail}.`
          : `سابقاً عملت ${arabicAsRole(role)}${dutyTail}.`,
      );
    } else if (locale === 'hi') {
      units.push(
        employer
          ? (hindiPriorUsesPerfective
            ? `इससे पहले मैंने ${employer} में ${role} के रूप में काम किया${dutyTail}।`
            : `इससे पहले मैं ${employer} में ${role} के रूप में काम ${hiDoes} ${hiWas}${dutyTail}।`)
          : (hindiPriorUsesPerfective
            ? `इससे पहले मैंने ${role} के रूप में काम किया${dutyTail}।`
            : `इससे पहले मैं ${role} के रूप में काम ${hiDoes} ${hiWas}${dutyTail}।`),
      );
    } else if (locale === 'ja') {
      units.push(
        employer
          ? `以前は${employer}で${role}として勤務していました${dutyTail}。`
          : `以前は${role}として勤務していました${dutyTail}。`,
      );
    } else {
      units.push(
        employer
          ? `Previously, I worked as a ${role} at ${employer}${dutyTail}.`
          : `Previously, I worked as a ${role}${dutyTail}.`,
      );
    }
  }

  if (dur) {
    // Duration exactly once — complete capitalized sentence (never a lowercase fragment).
    const durationSentence = formatNativeDurationSentence(dur, locale)
      || `${dur.replace(/\.$/u, '')}.`;
    units.unshift(durationSentence);
  }

  return units.join(' ').replace(/\s+/g, ' ').trim();
}

export function buildSummaryV2DeterministicText(
  manifest: SummaryV2SelectionManifest,
): string {
  void SUMMARY_V2_REVISION;
  if (manifest.locale === 'en') {
    return buildEnglishFromManifest(manifest);
  }
  if (manifest.locale === 'de') {
    return buildGermanSummaryV2FromManifest(manifest);
  }
  return buildLocaleShellFromManifest(manifest);
}

export function isSupportedSummaryV2Locale(locale: Locale): boolean {
  return [
    'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
  ].includes(locale);
}
