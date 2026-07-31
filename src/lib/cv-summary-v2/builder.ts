import type { Locale } from '@/lib/i18n/translations';
import { SUMMARY_V2_REVISION } from './flag';
import type {
  SummaryV2EmploymentState,
  SummaryV2EntryFact,
  SummaryV2SelectionManifest,
} from './types';
import {
  bulletToWhereClauseEn,
  dutyBulletForLocaleShell,
  dutyTenseFromEmploymentState,
} from './tense';
import { buildGermanSummaryV2FromManifest } from './german-surface';

export { bulletToWhereClauseEn } from './tense';
export {
  buildGermanSummaryV2FromManifest,
  bulletToGermanWoIchClause,
  GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION,
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
): string {
  const duties = facts
    .map((f) => dutyBulletForLocaleShell(f.bulletText, employmentState))
    .filter(Boolean);
  return duties.length ? ` — ${duties.join('; ')}` : '';
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

  const current = manifest.current;
  if (current) {
    const role = current.role || 'Professional';
    const employer = current.employer;
    const dutyTail = localeDutyTail(manifest.requiredCurrentFacts, current.employmentState);
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
      units.push(
        employer
          ? `Сейчас я работаю как ${role} в ${employer}${dutyTail}.`
          : `Сейчас я работаю как ${role}${dutyTail}.`,
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
          ? `أعمل حالياً كـ ${role} في ${employer}${dutyTail}.`
          : `أعمل حالياً كـ ${role}${dutyTail}.`,
      );
    } else if (locale === 'hi') {
      units.push(
        employer
          ? `मैं वर्तमान में ${employer} में ${role} के रूप में काम करता/करती हूँ${dutyTail}.`
          : `मैं वर्तमान में ${role} के रूप में काम करता/करती हूँ${dutyTail}.`,
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
    const dutyTail = localeDutyTail(priorFacts, prior.employmentState);
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
      units.push(
        employer
          ? `Ранее я работал(а) как ${role} в ${employer}${dutyTail}.`
          : `Ранее я работал(а) как ${role}${dutyTail}.`,
      );
    } else if (locale === 'sr' || locale === 'hr') {
      units.push(
        employer
          ? `Prethodno sam radio/la kao ${role} u ${employer}${dutyTail}.`
          : `Prethodno sam radio/la kao ${role}${dutyTail}.`,
      );
    } else if (locale === 'ar') {
      units.push(
        employer
          ? `سابقاً عملت كـ ${role} في ${employer}${dutyTail}.`
          : `سابقاً عملت كـ ${role}${dutyTail}.`,
      );
    } else if (locale === 'hi') {
      units.push(
        employer
          ? `इससे पहले मैं ${employer} में ${role} के रूप में काम करता/करती था/थी${dutyTail}.`
          : `इससे पहले मैं ${role} के रूप में काम करता/करती था/थी${dutyTail}.`,
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
    // Duration exactly once — prepend as its own unit for non-EN shells.
    units.unshift(`${dur.replace(/\.$/u, '')}.`);
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
