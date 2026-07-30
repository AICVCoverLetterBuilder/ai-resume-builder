import type { SummaryV2EmploymentState } from './types';

/** Duty clause tense derived only from the owning entry's employmentState. */
export type SummaryV2DutyTense = 'present' | 'past';

export function dutyTenseFromEmploymentState(
  state: SummaryV2EmploymentState | undefined | null,
): SummaryV2DutyTense {
  return state === 'completed' ? 'past' : 'present';
}

const IRREGULAR_PAST: Record<string, string> = {
  be: 'was',
  have: 'had',
  do: 'did',
  make: 'made',
  write: 'wrote',
  lead: 'led',
  read: 'read',
  set: 'set',
  put: 'put',
  cut: 'cut',
  keep: 'kept',
  leave: 'left',
  build: 'built',
  send: 'sent',
  spend: 'spent',
  meet: 'met',
  get: 'got',
  take: 'took',
  give: 'gave',
  sell: 'sold',
  tell: 'told',
  find: 'found',
  hold: 'held',
  bring: 'brought',
  teach: 'taught',
  catch: 'caught',
  think: 'thought',
};

/** Inflect a bare English verb lemma to simple past. */
export function toEnglishPastVerb(lemma: string): string {
  let w = (lemma || '').toLowerCase().trim();
  if (!w) return w;
  // Strip leftover gerund before past inflection (adapting → adapt).
  if (w.endsWith('ing') && w.length > 5) {
    const stem = w.slice(0, -3);
    w = /(?:eat|at|et|it)$/iu.test(stem) && !stem.endsWith('e') ? `${stem}e` : stem;
  }
  if (IRREGULAR_PAST[w]) return IRREGULAR_PAST[w];
  if (w.endsWith('e')) return `${w}d`;
  if (/[b-df-hj-np-tv-z]y$/iu.test(w)) return `${w.slice(0, -1)}ied`;
  if (/[^aeiou][aeiou][bdfglmnprst]$/iu.test(w) && w.length >= 3) {
    return `${w}${w[w.length - 1]}ed`;
  }
  return `${w}ed`;
}

/**
 * Convert a live Experience bullet into a finite "where I …" clause.
 * Tense comes from employmentState — never from occupation labels.
 */
export function bulletToWhereClauseEn(
  bullet: string,
  tense: SummaryV2DutyTense = 'present',
): string {
  let s = (bullet || '').replace(/[.;]+$/u, '').trim();
  if (!s) return '';
  const pairs: Array<[RegExp, string]> = [
    [/^Installs\b/i, 'install'],
    [/^Installed\b/i, 'install'],
    [/^Positions\s+and\s+secures\b/i, 'position and secure'],
    [/^Positioned\s+and\s+secured\b/i, 'position and secure'],
    [/^Coordinates\b/i, 'coordinate'],
    [/^Coordinated\b/i, 'coordinate'],
    [/^Records\b/i, 'record'],
    [/^Recorded\b/i, 'record'],
    [/^Arranges\b/i, 'arrange'],
    [/^Arranged\b/i, 'arrange'],
    [/^Helps\b/i, 'help'],
    [/^Helped\b/i, 'help'],
    [/^Assists\b/i, 'assist'],
    [/^Assisted\b/i, 'assist'],
    [/^Maintains\b/i, 'maintain'],
    [/^Maintained\b/i, 'maintain'],
    [/^Creates\b/i, 'create'],
    [/^Created\b/i, 'create'],
    [/^Manages\b/i, 'manage'],
    [/^Managed\b/i, 'manage'],
    [/^Develops\b/i, 'develop'],
    [/^Developed\b/i, 'develop'],
    [/^Performs\b/i, 'perform'],
    [/^Performed\b/i, 'perform'],
    [/^Checking\b/i, 'check'],
    [/^Checked\b/i, 'check'],
    [/^Verifying\b/i, 'verify'],
    [/^Verified\b/i, 'verify'],
    [/^Reviewing\s+and\s+adapting\b/i, 'review and adapt'],
    [/^Reviewed\s+and\s+adapted\b/i, 'review and adapt'],
    [/^Reviewing\b/i, 'review'],
    [/^Reviewed\b/i, 'review'],
    [/^Coordinating\b/i, 'coordinate'],
    [/^Preparing\b/i, 'prepare'],
    [/^Prepared\b/i, 'prepare'],
    [/^Creating\b/i, 'create'],
    [/^Organizes\b/i, 'organize'],
    [/^Organized\b/i, 'organize'],
    [/^Adapting\b/i, 'adapt'],
    [/^Adapted\b/i, 'adapt'],
  ];
  let replaced = false;
  for (const [re, rep] of pairs) {
    if (re.test(s)) {
      s = s.replace(re, rep);
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    // Prefer "coordinates"/"supervises" → lemma ending in e, not stripping "es".
    if (/^(\p{L}+e)s\b/iu.test(s)) {
      s = s.replace(/^(\p{L}+e)s\b/iu, (_, stem: string) => stem.toLowerCase());
    } else if (/^(\p{L}+)ies\b/iu.test(s)) {
      s = s.replace(/^(\p{L}+)ies\b/iu, (_, stem: string) => `${stem.toLowerCase()}y`);
    } else if (/^(\p{L}+)ing\b/iu.test(s)) {
      s = s.replace(/^(\p{L}+)ing\b/iu, (_, stem: string) => {
        const base = stem.toLowerCase();
        // creating → create; checking → check
        if (/[aeiou]t$/iu.test(base) || /[^aeiou]at$/iu.test(base)) return `${base}e`;
        return base;
      });
    } else if (/^(\p{L}+)(ches|shes|sses|xes|zes)\b/iu.test(s)) {
      s = s.replace(/^(\p{L}+)(?:ches|shes|sses|xes|zes)\b/iu, (full: string) => (
        full.replace(/es$/iu, '').toLowerCase()
      ));
    } else {
      s = s.replace(/^(\p{L}+)s\b/u, (_, stem: string) => stem.toLowerCase());
    }
    s = s.replace(/^\p{Lu}/u, (c) => c.toLowerCase());
  }
  if (tense === 'present') return s;
  return applyPastToDutyClause(s);
}

/** Past-inflect coordinated leading verbs: "position and secure X" → "positioned and secured X". */
function applyPastToDutyClause(clause: string): string {
  const andCoord = /^(\p{L}+)\s+and\s+(\p{L}+)(\b[\s\S]*)?$/u.exec(clause);
  if (andCoord) {
    return `${toEnglishPastVerb(andCoord[1])} and ${toEnglishPastVerb(andCoord[2])}${andCoord[3] || ''}`;
  }
  const first = /^(\p{L}+)(\b[\s\S]*)?$/u.exec(clause);
  if (first) {
    return `${toEnglishPastVerb(first[1])}${first[2] || ''}`;
  }
  return clause;
}

/**
 * Duty text embedded in non-EN shells: present keeps live wording;
 * completed English bullets use past-inflected clauses. Non-English live
 * bullets keep their wording (never apply English past morphology).
 */
export function dutyBulletForLocaleShell(
  bullet: string,
  employmentState: SummaryV2EmploymentState,
): string {
  const tense = dutyTenseFromEmploymentState(employmentState);
  const raw = (bullet || '').replace(/[.;]+$/u, '').trim();
  if (!raw) return '';
  if (tense === 'present') return raw;
  // Only English-script live duties get English past inflection.
  if (!/^[A-Za-z0-9]/.test(raw) || /[àáâãäåæçèéêëìíîïñòóôõöùúûüýÿąćęłńśźżа-яё\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\u3400-\u9FFF]/i.test(raw)) {
    return raw;
  }
  return bulletToWhereClauseEn(bullet, 'past');
}
