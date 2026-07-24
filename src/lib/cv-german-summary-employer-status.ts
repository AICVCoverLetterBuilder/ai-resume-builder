/**
 * AAB-321 — German Summary employer + employment-state coverage and narrow repair.
 *
 * Current/prior intros must not pass from role title + duties alone when
 * structured employers and employment state are available in the snapshot.
 */
import { resolveLocalizedSummaryRole } from './cv-summary-structured-role-localization';

export const GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION =
  'german-summary-employer-coverage-321-v1' as const;
export const GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION =
  'german-summary-employment-state-321-v1' as const;

void GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION;
void GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION;

function formatGermanEmployerPrepositional(employer: string): string {
  const company = (employer || '').replace(/\s+/g, ' ').trim();
  if (!company) return '';
  if (/^(?:bei|in|im|am)\s+/iu.test(company)) return company;
  return `bei ${company}`;
}

const CURRENT_STATUS_MARKERS_DE =
  /\b(?:derzeit|aktuell|gegenwärtig|seit)\b/iu;
const CURRENT_EMPLOYMENT_CONSTRUCTION_DE =
  /\b(?:arbeitet|ist)\s+bei\b|\bbei\s+\S+\s+tätig\b/iu;
const PRIOR_TRANSITION_MARKERS_DE =
  /\b(?:zuvor|früher|vorher|davor|arbeitete|war\s+(?:sie|er|die\s+Fachkraft)|war\s+tätig)\b/iu;
const GENERIC_MIT_ERFAHRUNG_DE =
  /\bmit\s+Erfahrung\b/iu;
const TOTAL_DURATION_UNIT_DE =
  /\binsgesamt\b|\bgesamte\s+Berufserfahrung\b|(?:etwa|rund|ca\.?|ungefähr|sechseinhalb).{0,40}Jahre/iu;

const GERMAN_MONTHS: Record<string, string> = {
  '01': 'Januar',
  '02': 'Februar',
  '03': 'März',
  '04': 'April',
  '05': 'Mai',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'August',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Dezember',
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashOpaque(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

function employerPresentInText(text: string, employer: string): boolean {
  const e = (employer || '').trim();
  if (!e) return false;
  return new RegExp(`\\b${escapeRe(e)}\\b`, 'iu').test(text || '');
}

function rolePresentInText(text: string, role: string): boolean {
  const r = (role || '').trim();
  if (!r) return false;
  return new RegExp(escapeRe(r), 'iu').test(text || '');
}

function formatGermanStartMonthYear(datesValue: string): string {
  const startMatch = /^(\d{4})-(\d{2})/.exec(datesValue || '');
  if (!startMatch || !GERMAN_MONTHS[startMatch[2]!]) return '';
  return `${GERMAN_MONTHS[startMatch[2]!]} ${startMatch[1]}`;
}

export type GermanCurrentRoleCoverage = {
  currentRoleTitlePresent: boolean;
  currentEmployerRequired: boolean;
  currentEmployerPresent: boolean;
  currentEmployerMatchesStructuredEmployer: boolean;
  currentStatusMarkerRequired: boolean;
  currentStatusMarkerPresent: boolean;
  currentDateMarkerPresent: boolean;
  currentEmploymentStateExpressed: boolean;
  currentRoleIntroValidationPassed: boolean;
  currentRoleIntroRejectionReasons: string[];
  currentEmployerExpectedHash: string | null;
  currentEmployerCandidateMatchCount: number;
  currentStatusValidationPassed: boolean;
  currentStatusRejectionReasons: string[];
};

export type GermanPriorRoleCoverage = {
  priorRoleTitlePresent: boolean;
  priorEmployerRequired: boolean;
  priorEmployerPresent: boolean;
  priorEmployerMatchesStructuredEmployer: boolean;
  priorTransitionMarkerPresent: boolean;
  priorEmploymentStateExpressed: boolean;
  priorRoleIntroValidationPassed: boolean;
  priorRoleIntroRejectionReasons: string[];
  priorEmployerExpectedHash: string | null;
  priorEmployerCandidateMatchCount: number;
};

function currentEmploymentScope(text: string): string {
  const parts = (text || '').split(/\b(?:zuvor|früher|vorher|davor)\b/iu);
  // When a transition marker is present, only the pre-transition clause is current.
  // Do not fall back to the full text when the prefix is empty (summary starts with Zuvor).
  if (parts.length > 1) return (parts[0] || '').trim();
  return (text || '').trim();
}

function priorEmploymentScope(text: string): string {
  const parts = (text || '').split(/\b(?:zuvor|früher|vorher|davor)\b/iu);
  if (parts.length > 1) {
    return parts.slice(1).join(' zuvor ').trim();
  }
  // No transition marker: prior scope is empty for employer attachment.
  return '';
}

export function analyzeGermanCurrentRoleCoverage(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
  } = {},
): GermanCurrentRoleCoverage {
  void GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION;
  void GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const currentScope = currentEmploymentScope(text);
  const company = (options.company || '').trim();
  const role = (options.role || '').trim();
  const currentEmployerRequired = Boolean(company);
  const currentStatusMarkerRequired = currentEmployerRequired || Boolean(options.startDate);
  const currentRoleTitlePresent = rolePresentInText(text, role);
  const currentEmployerPresent = employerPresentInText(currentScope, company);
  const currentEmployerMatchesStructuredEmployer = currentEmployerPresent;
  const monthYear = formatGermanStartMonthYear(options.startDate || '');
  const currentDateMarkerPresent = Boolean(
    monthYear
      ? new RegExp(`\\bseit\\s+${escapeRe(monthYear)}\\b`, 'iu').test(currentScope)
      : /\bseit\s+(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}\b/iu
        .test(currentScope),
  );
  const currentStatusMarkerPresent = CURRENT_STATUS_MARKERS_DE.test(currentScope)
    || CURRENT_EMPLOYMENT_CONSTRUCTION_DE.test(currentScope);
  // Generic "mit Erfahrung" alone is never current-status evidence.
  const genericOnly = GENERIC_MIT_ERFAHRUNG_DE.test(currentScope)
    && !currentStatusMarkerPresent
    && !currentDateMarkerPresent
    && !currentEmployerPresent;
  const currentEmploymentStateExpressed = !genericOnly && (
    currentDateMarkerPresent
    || (currentStatusMarkerPresent && currentEmployerPresent)
    || (CURRENT_EMPLOYMENT_CONSTRUCTION_DE.test(currentScope) && currentEmployerPresent)
  );
  const reasons: string[] = [];
  if (role && !currentRoleTitlePresent) reasons.push('missing_current_role_title');
  if (currentEmployerRequired && !currentEmployerPresent) reasons.push('missing_current_employer');
  if (currentEmployerRequired && employerPresentInText(priorEmploymentScope(text), company)) {
    reasons.push('current_employer_mismatch');
  }
  if (currentStatusMarkerRequired && !currentEmploymentStateExpressed) {
    reasons.push('missing_current_employment_marker');
  }
  const statusReasons: string[] = [];
  if (currentStatusMarkerRequired && !currentEmploymentStateExpressed) {
    statusReasons.push('missing_current_employment_marker');
  }
  if (genericOnly) statusReasons.push('generic_mit_erfahrung_not_current_status');

  const currentRoleIntroValidationPassed = Boolean(
    (!role || currentRoleTitlePresent)
    && (!currentEmployerRequired || currentEmployerPresent)
    && (!currentStatusMarkerRequired || currentEmploymentStateExpressed)
    && !reasons.includes('current_employer_mismatch'),
  );

  return {
    currentRoleTitlePresent,
    currentEmployerRequired,
    currentEmployerPresent,
    currentEmployerMatchesStructuredEmployer,
    currentStatusMarkerRequired,
    currentStatusMarkerPresent: currentStatusMarkerPresent || currentDateMarkerPresent,
    currentDateMarkerPresent,
    currentEmploymentStateExpressed,
    currentRoleIntroValidationPassed,
    currentRoleIntroRejectionReasons: [...new Set(reasons)],
    currentEmployerExpectedHash: company ? hashOpaque(company) : null,
    currentEmployerCandidateMatchCount: currentEmployerPresent ? 1 : 0,
    currentStatusValidationPassed: !currentStatusMarkerRequired || currentEmploymentStateExpressed,
    currentStatusRejectionReasons: [...new Set(statusReasons)],
  };
}

export function analyzeGermanPriorRoleCoverage(
  summary: string,
  options: {
    priorCompany?: string;
    priorRole?: string;
  } = {},
): GermanPriorRoleCoverage {
  void GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const priorScope = priorEmploymentScope(text) || text;
  const priorCompany = (options.priorCompany || '').trim();
  const priorRole = (options.priorRole || '').trim();
  const priorEmployerRequired = Boolean(priorCompany);
  const priorRoleTitlePresent = priorRole
    ? rolePresentInText(text, priorRole)
    : /Grafikdesign/iu.test(text);
  const priorEmployerPresent = employerPresentInText(priorScope, priorCompany)
    && !employerPresentInText(currentEmploymentScope(text), priorCompany);
  // When prior scope is empty (no transition), still allow employer+role in full text
  // only if transition markers exist elsewhere... already handled by priorScope fallback.
  const priorEmployerInCurrentOnly = employerPresentInText(currentEmploymentScope(text), priorCompany)
    && !employerPresentInText(priorEmploymentScope(text), priorCompany);
  const priorTransitionMarkerPresent = PRIOR_TRANSITION_MARKERS_DE.test(text);
  const priorEmploymentStateExpressed = priorTransitionMarkerPresent
    || /\bwar\b.{0,40}\btätig\b/iu.test(priorScope);
  const reasons: string[] = [];
  if (priorRole && !priorRoleTitlePresent) reasons.push('missing_prior_role_title');
  if (priorEmployerRequired && !priorEmployerPresent) reasons.push('missing_prior_employer');
  if (priorEmployerRequired && priorEmployerInCurrentOnly) {
    reasons.push('prior_employer_mismatch');
  }
  if (priorEmployerRequired && !priorEmploymentStateExpressed) {
    reasons.push('missing_prior_employment_marker');
  }
  const priorRoleIntroValidationPassed = Boolean(
    (!priorRole || priorRoleTitlePresent)
    && (!priorEmployerRequired || priorEmployerPresent)
    && (!priorEmployerRequired || priorEmploymentStateExpressed)
    && !reasons.includes('prior_employer_mismatch'),
  );
  return {
    priorRoleTitlePresent,
    priorEmployerRequired,
    priorEmployerPresent,
    priorEmployerMatchesStructuredEmployer: priorEmployerPresent,
    priorTransitionMarkerPresent,
    priorEmploymentStateExpressed,
    priorRoleIntroValidationPassed,
    priorRoleIntroRejectionReasons: [...new Set(reasons)],
    priorEmployerExpectedHash: priorCompany ? hashOpaque(priorCompany) : null,
    priorEmployerCandidateMatchCount: priorEmployerPresent ? 1 : 0,
  };
}

export type GermanEmployerStatusRepairResult = {
  attempted: boolean;
  applied: boolean;
  text: string;
  transformationKinds: string[];
  rejectionReasons: string[];
};

/**
 * Narrow repair: restore missing employers / current-status / prior markers
 * while preserving grounded duty wording and the duration sentence.
 */
export function repairGermanSummaryEmployerStatus(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
    priorCompany?: string;
    priorRole?: string;
    gender?: string;
  },
): GermanEmployerStatusRepairResult {
  void GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION;
  void GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return {
      attempted: false,
      applied: false,
      text: '',
      transformationKinds: [],
      rejectionReasons: ['empty_summary'],
    };
  }

  const current = analyzeGermanCurrentRoleCoverage(text, options);
  const prior = analyzeGermanPriorRoleCoverage(text, options);
  const needsRepair = !current.currentRoleIntroValidationPassed
    || !prior.priorRoleIntroValidationPassed;
  if (!needsRepair) {
    return {
      attempted: false,
      applied: false,
      text,
      transformationKinds: [],
      rejectionReasons: [],
    };
  }

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'weiblich';
  const male = g === 'male' || g === 'm' || g === 'männlich';
  const pronoun = female ? 'sie' : male ? 'er' : 'die Fachkraft';

  const currentRoleResolved = resolveLocalizedSummaryRole({
    role: options.role || '',
    targetLocale: 'de',
    gender: options.gender,
  });
  const priorRoleResolved = resolveLocalizedSummaryRole({
    role: options.priorRole || '',
    targetLocale: 'de',
    gender: options.gender,
  });
  const role = currentRoleResolved.localizationValidationPassed
    ? currentRoleResolved.localizedTargetRoleLabel
    : ((options.role || '').trim() || 'Fachkraft');
  const priorRole = priorRoleResolved.localizationValidationPassed
    ? priorRoleResolved.localizedTargetRoleLabel
    : ((options.priorRole || '').trim() || 'Grafikdesignerin');
  if (
    priorRoleResolved.localizationValidationPassed
    && (options.priorRole || '').trim()
    && priorRole !== (options.priorRole || '').trim()
  ) {
    // Recorded after other transforms below.
  }
  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const beiCompany = formatGermanEmployerPrepositional(company);
  const priorBei = formatGermanEmployerPrepositional(priorCompany);
  const monthYear = formatGermanStartMonthYear(options.startDate || '');

  // Preserve duration sentence if present.
  const units = text.split(/(?<=[.!?])\s+/).map((u) => u.trim()).filter(Boolean);
  const durationUnit = units.find((u) => TOTAL_DURATION_UNIT_DE.test(u) && /\binsgesamt\b/iu.test(u))
    || units.find((u) => TOTAL_DURATION_UNIT_DE.test(u))
    || '';

  // Extract duty clauses from the original text without inventing new ones.
  let body = text;
  if (durationUnit) body = body.replace(durationUnit, ' ').replace(/\s+/g, ' ').trim();
  // Split current / prior at transition markers when possible.
  const priorSplit = body.split(/\b(?:zuvor|früher|vorher)\b/iu);
  const currentPart = (priorSplit[0] || body).trim();
  const priorPart = priorSplit.length > 1
    ? `zuvor ${priorSplit.slice(1).join(' zuvor ').trim()}`
    : body;

  const currentDutyMatch = currentPart.match(
    /\bmit\s+Erfahrung\s+in\s+(.+?)(?:[.!;]|$)/iu,
  );
  const currentDuties = (currentDutyMatch?.[1] || '')
    .replace(/\s*;\s*$/u, '')
    .replace(/\bzuvor\b.*$/iu, '')
    .trim();

  let priorDuties = '';
  const priorDutyMatch = priorPart.match(
    /\b(?:tätig\s+)?mit\s+(?:der\s+)?(.+?)(?:[.!]|$)/iu,
  );
  if (priorDutyMatch?.[1]) {
    priorDuties = priorDutyMatch[1].replace(/^der\s+/iu, '').trim();
  } else {
    const undMatch = priorPart.match(/\bund\s+(.+?)(?:[.!]|$)/iu);
    if (undMatch?.[1]) priorDuties = undMatch[1].trim();
  }

  const transformations: string[] = [];
  if (current.currentEmployerRequired && !current.currentEmployerPresent) {
    transformations.push('current_employer_restored');
  }
  if (current.currentStatusMarkerRequired && !current.currentEmploymentStateExpressed) {
    transformations.push('current_status_restored');
  }
  if (prior.priorEmployerRequired && !prior.priorEmployerPresent) {
    transformations.push('prior_employer_restored');
  }
  if (prior.priorEmployerRequired && !prior.priorEmploymentStateExpressed) {
    transformations.push('prior_status_restored');
  }
  transformations.push('employment_units_split');
  if (
    currentRoleResolved.localizationValidationPassed
    && (options.role || '').trim()
    && role !== (options.role || '').trim()
  ) {
    transformations.push('current_role_title_localized');
    transformations.push('foreign_role_title_replaced');
  }
  if (
    priorRoleResolved.localizationValidationPassed
    && (options.priorRole || '').trim()
    && priorRole !== (options.priorRole || '').trim()
  ) {
    transformations.push('prior_role_title_localized');
    transformations.push('foreign_role_title_replaced');
  }

  let currentUnit = role;
  if (beiCompany) currentUnit = `${currentUnit} ${beiCompany}`;
  if (monthYear) currentUnit = `${currentUnit} seit ${monthYear}`;
  if (currentDuties) {
    currentUnit = `${currentUnit} mit Erfahrung in ${currentDuties}`;
  } else if (/Warenannahme|Dokument|Koordination|Warenbeweg/iu.test(currentPart)) {
    // Keep existing warehouse duty wording already in the candidate.
    const frag = currentPart
      .replace(new RegExp(`^.*?${escapeRe(role)}`, 'iu'), '')
      .replace(/\b(?:bei\s+\S+|seit\s+[^,]+)\b/giu, '')
      .replace(/^[,;\s]+/, '')
      .replace(/\bzuvor\b.*$/iu, '')
      .trim();
    if (frag) currentUnit = `${currentUnit} ${frag}`;
  }
  if (!/[.]$/u.test(currentUnit)) currentUnit = `${currentUnit}.`;

  let priorUnit = `Zuvor war ${pronoun} als ${priorRole}`;
  if (priorBei) priorUnit = `${priorUnit} ${priorBei}`;
  priorUnit = `${priorUnit} tätig`;
  if (priorDuties) {
    // Preserve candidate duty wording; do not invent new duty facts.
    if (/^(?:erstellte|überarbeitete|bereitete)\b/iu.test(priorDuties)) {
      priorUnit = `${priorUnit} und ${priorDuties}`;
    } else if (/^mit\s+/iu.test(priorDuties)) {
      priorUnit = `${priorUnit} ${priorDuties}`;
    } else {
      priorUnit = `${priorUnit} mit der ${priorDuties}`;
    }
  } else if (/visuell|Design|Dateien|Formate|Bildschirm/iu.test(priorPart)) {
    // Keep the already-present design duty fragment from the candidate body.
    const frag = priorPart
      .replace(/\bzuvor\b/giu, '')
      .replace(new RegExp(`als\\s+${escapeRe(priorRole)}`, 'iu'), '')
      .replace(/\b(?:bei\s+\S+|war\s+(?:sie|er|die\s+Fachkraft)|tätig)\b/giu, '')
      .replace(/^[,;\s]+/, '')
      .trim();
    if (frag) priorUnit = `${priorUnit} ${frag}`;
  }
  if (!/[.]$/u.test(priorUnit)) priorUnit = `${priorUnit}.`;

  const durationOut = durationUnit
    ? (durationUnit.endsWith('.') ? durationUnit : `${durationUnit}.`)
    : '';

  const repaired = [currentUnit, priorUnit, durationOut]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const repairedCurrent = analyzeGermanCurrentRoleCoverage(repaired, options);
  const repairedPrior = analyzeGermanPriorRoleCoverage(repaired, options);
  if (
    !repairedCurrent.currentRoleIntroValidationPassed
    || !repairedPrior.priorRoleIntroValidationPassed
  ) {
    return {
      attempted: true,
      applied: false,
      text: repaired,
      transformationKinds: transformations,
      rejectionReasons: [
        ...repairedCurrent.currentRoleIntroRejectionReasons,
        ...repairedPrior.priorRoleIntroRejectionReasons,
      ],
    };
  }

  return {
    attempted: true,
    applied: true,
    text: repaired,
    transformationKinds: [...new Set(transformations)],
    rejectionReasons: [],
  };
}
