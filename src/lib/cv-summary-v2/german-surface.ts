/**
 * AAB-382 — German Summary V2 first-person surface grammar.
 * Converts live duty bullets into finite "wo ich …" clauses and builds
 * complete first-person German Summary sentences (duration + current + prior).
 */
import { formatGermanTotalProfessionalDurationSentence } from '@/lib/cv-german-summary-competency-grounding';
import { formatGermanEmployerPrepositional } from '@/lib/cv-german-summary-grounding';
import type { SummaryV2EmploymentState, SummaryV2EntryFact, SummaryV2SelectionManifest } from './types';
import { dutyTenseFromEmploymentState, type SummaryV2DutyTense } from './tense';

export const GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION =
  'german-summary-v2-first-person-surface-382-v1' as const;
/** AAB-383 — German surface → finalizer integration (grammar/duration/lineage). */
export const GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION =
  'german-summary-v2-surface-finalizer-383-v1' as const;
void GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION;
void GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION;

const SEPARABLE_PREFIXES = [
  'zurück', 'weiter', 'heran', 'herum', 'entgegen', 'durch', 'mit', 'nach',
  'vor', 'aus', 'auf', 'ein', 'ab', 'an', 'zu', 'um', 'bei', 'her', 'hin',
] as const;

/** Irregular present 3sg → 1sg (stem already without -t where listed). */
const IRREGULAR_PRESENT_1SG: Record<string, string> = {
  spricht: 'spreche',
  nimmt: 'nehme',
  gibt: 'gebe',
  schreibt: 'schreibe',
  hält: 'halte',
  haelt: 'halte',
  lässt: 'lasse',
  laesst: 'lasse',
  sieht: 'sehe',
  liest: 'lese',
  trägt: 'trage',
  traegt: 'trage',
  fährt: 'fahre',
  faehrt: 'fahre',
  läuft: 'laufe',
  laeuft: 'laufe',
  hilft: 'helfe',
  wirft: 'werfe',
  isst: 'esse',
  trifft: 'treffe',
  gilt: 'gelte',
};

const IRREGULAR_PAST_1SG: Record<string, string> = {
  nahm: 'nahm',
  sprach: 'sprach',
  gab: 'gab',
  schrieb: 'schrieb',
  hielt: 'hielt',
  ließ: 'ließ',
  liess: 'liess',
  sah: 'sah',
  las: 'las',
  trug: 'trug',
  fuhr: 'fuhr',
  lief: 'lief',
  half: 'half',
  warf: 'warf',
  aß: 'aß',
  ass: 'ass',
  traf: 'traf',
  nahmte: 'nahm',
  nimmte: 'nahm',
};

/** Keep German noun capitalization from live Experience object phrases. */
function preserveObjectCasing(rest: string): string {
  return (rest || '').replace(/\s+/g, ' ').trim();
}

function present1sgFromFiniteOrInfinitive(verb: string): string {
  const v = (verb || '').toLowerCase().trim();
  if (!v) return v;
  if (IRREGULAR_PRESENT_1SG[v]) return IRREGULAR_PRESENT_1SG[v];
  // Past irregular used under present request — keep known present.
  if (v === 'nahm') return 'nehme';
  // Infinitive: prüfen / koordinieren / erstellen
  if (v.endsWith('ieren') && v.length > 6) return `${v.slice(0, -1)}e`; // koordinieren → koordiniere
  if (v.endsWith('en') && v.length > 3) return `${v.slice(0, -1)}`; // prüfen → prüfe
  // 3sg -iert: koordiniert → koordiniere
  if (v.endsWith('iert') && v.length > 5) return `${v.slice(0, -1)}e`;
  // 3sg -tet / -det keep stem + e: arbeitet → arbeite; redet → rede
  if (/(?:tet|det)$/u.test(v) && v.length > 4) return `${v.slice(0, -1)}`;
  // 3sg "passt" / "fasst" — ends with -sst/-ßt, not 2sg -st
  if (/(?:sst|ßt)$/u.test(v) && v.length > 3) return `${v.slice(0, -1)}e`;
  // 3sg -t: prüft → prüfe; führt → führe; tauscht → tausche
  if (v.endsWith('t') && v.length > 2 && !v.endsWith('st')) return `${v.slice(0, -1)}e`;
  if (v.endsWith('e')) return v;
  return `${v}e`;
}

function past1sgFromFinite(verb: string): string {
  const v = (verb || '').toLowerCase().trim();
  if (!v) return v;
  if (IRREGULAR_PAST_1SG[v]) return IRREGULAR_PAST_1SG[v];
  // Present irregular used under past tense request → map via present stem + known past.
  if (v === 'nimmt') return 'nahm';
  // Already past-looking: erstellte / überprüfte / passte / bereitete
  if (/(?:te|ete|tte)$/u.test(v)) return v;
  // Weak present → weak past: prüft → prüfte; erstellt → erstellte
  if (v.endsWith('iert')) return `${v}e`; // koordiniert → koordinierte (approx)
  if (v.endsWith('en')) {
    // infinitive → past: prüfen → prüfte; erstellen → erstellte
    const stem = v.slice(0, -2);
    if (stem.endsWith('ier')) return `${stem}te`;
    return `${stem}te`;
  }
  if (v.endsWith('t') && !v.endsWith('st')) {
    const stem = v.slice(0, -1);
    return `${stem}te`;
  }
  return v;
}

function splitLeadingSeparable(
  rest: string,
): { prefix: string; remainder: string } | null {
  const tokens = (rest || '').trim().split(/\s+/u);
  if (tokens.length < 2) return null;
  const last = tokens[tokens.length - 1].replace(/[.,;:!?]+$/u, '').toLowerCase();
  if ((SEPARABLE_PREFIXES as readonly string[]).includes(last)) {
    return {
      prefix: last,
      remainder: tokens.slice(0, -1).join(' '),
    };
  }
  return null;
}

/**
 * Convert a live German duty bullet into a subordinate "wo ich …" clause body
 * (no leading "wo ich"). Prefers verb-final first-person agreement.
 */
export function bulletToGermanWoIchClause(
  bullet: string,
  tense: SummaryV2DutyTense = 'present',
): string {
  void GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION;
  void GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION;
  const s = (bullet || '').replace(/[.;]+$/u, '').trim();
  if (!s) return '';
  // Non-German script → do not invent morphology.
  if (/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/u.test(s)) {
    return preserveObjectCasing(s);
  }

  // Coordinated leading verbs: "überprüfte und passte Designmaterialien an"
  // also "Erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen"
  const coordSep = /^(\p{L}+)\s+und\s+(\p{L}+)\s+(.+)$/u.exec(s);
  if (coordSep) {
    const leftRaw = coordSep[1];
    const rightRaw = coordSep[2];
    const rest = coordSep[3].trim();
    const sep = splitLeadingSeparable(rest);
    if (sep) {
      const left = tense === 'past'
        ? past1sgFromFinite(leftRaw)
        : present1sgFromFiniteOrInfinitive(leftRaw);
      const rightStem = tense === 'past'
        ? past1sgFromFinite(rightRaw)
        : present1sgFromFiniteOrInfinitive(rightRaw);
      const right = `${sep.prefix}${rightStem}`;
      return `${preserveObjectCasing(sep.remainder)} ${left} und ${right}`.replace(/\s+/g, ' ').trim();
    }
    const left = tense === 'past'
      ? past1sgFromFinite(leftRaw)
      : present1sgFromFiniteOrInfinitive(leftRaw);
    const right = tense === 'past'
      ? past1sgFromFinite(rightRaw)
      : present1sgFromFiniteOrInfinitive(rightRaw);
    return `${preserveObjectCasing(rest)} ${left} und ${right}`.replace(/\s+/g, ' ').trim();
  }

  // Separable: "bereitete finale Designdateien … vor" / "passt X an" / "Tauscht X aus"
  const lead = /^(\p{L}+)\s+(.+)$/u.exec(s);
  if (lead) {
    const verbRaw = lead[1];
    const rest = lead[2].trim();
    const sep = splitLeadingSeparable(rest);
    if (sep) {
      const finite = tense === 'past'
        ? past1sgFromFinite(verbRaw)
        : present1sgFromFiniteOrInfinitive(verbRaw);
      const joined = `${sep.prefix}${finite}`;
      return `${preserveObjectCasing(sep.remainder)} ${joined}`.replace(/\s+/g, ' ').trim();
    }
    // Leading finite/infinitive + object: "prüft eingehende Waren"
    if (
      /^(?:[A-ZÄÖÜ]|[a-zäöü])/u.test(verbRaw)
      && /(?:t|te|en|iert)$/iu.test(verbRaw)
      && !/^(?:die|der|das|den|dem|des|ein|eine|einer|eines|einem|einen|mit|für|bei|und|oder|sowie)$/iu.test(verbRaw)
    ) {
      const finite = tense === 'past'
        ? past1sgFromFinite(verbRaw)
        : present1sgFromFiniteOrInfinitive(verbRaw);
      return `${preserveObjectCasing(rest)} ${finite}`.replace(/\s+/g, ' ').trim();
    }
  }

  // Object-first infinitive: "Eingehende Waren prüfen"
  const trailInf = /^(.+)\s+(\p{L}+en)$/u.exec(s);
  if (trailInf && tense === 'present') {
    return `${preserveObjectCasing(trailInf[1])} ${present1sgFromFiniteOrInfinitive(trailInf[2])}`
      .replace(/\s+/g, ' ')
      .trim();
  }

  return preserveObjectCasing(s);
}

function joinGermanWoIchClauses(
  facts: SummaryV2EntryFact[],
  employmentState: SummaryV2EmploymentState,
): string {
  const tense = dutyTenseFromEmploymentState(employmentState);
  const parts = facts
    .map((f) => bulletToGermanWoIchClause(f.bulletText, tense))
    .filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} und ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} und ${parts[parts.length - 1]}`;
}

/** Deterministic German V2 Summary — complete first-person finite sentences. */
export function buildGermanSummaryV2FromManifest(
  manifest: SummaryV2SelectionManifest,
): string {
  void GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION;
  void GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION;
  const units: string[] = [];
  const dur = (manifest.durationPhrase || '').replace(/[.,]$/u, '').trim();
  if (dur) {
    units.push(formatGermanTotalProfessionalDurationSentence(dur));
  }

  const current = manifest.current;
  if (current) {
    const role = (current.role || 'Fachkraft').trim() || 'Fachkraft';
    const bei = formatGermanEmployerPrepositional(current.employer || '') || '';
    const clauses = joinGermanWoIchClauses(
      manifest.requiredCurrentFacts,
      current.employmentState,
    );
    const dutyTail = clauses ? `, wo ich ${clauses}` : '';
    // Canonical present intro: "Derzeit arbeite ich als … bei …, wo ich …"
    units.push(
      bei
        ? `Derzeit arbeite ich als ${role} ${bei}${dutyTail}.`
        : `Derzeit arbeite ich als ${role}${dutyTail}.`,
    );
  }

  for (const prior of manifest.priors) {
    const priorFacts = manifest.requiredPriorFacts.filter((f) => f.entryId === prior.entryId);
    const role = (prior.role || 'Fachkraft').trim() || 'Fachkraft';
    const bei = formatGermanEmployerPrepositional(prior.employer || '') || '';
    const clauses = joinGermanWoIchClauses(priorFacts, prior.employmentState);
    const dutyTail = clauses ? `, wo ich ${clauses}` : '';
    units.push(
      bei
        ? `Zuvor arbeitete ich als ${role} ${bei}${dutyTail}.`
        : `Zuvor arbeitete ich als ${role}${dutyTail}.`,
    );
  }

  return units.join(' ').replace(/\s+/g, ' ').trim();
}
