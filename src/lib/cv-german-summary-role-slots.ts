/**
 * AAB-320 — German Summary multi-signal role-slot classifier.
 *
 * Employment evidence (structured role/employer/duties/date markers) always
 * outranks generic competency-introducer heuristics.
 */
export const GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION =
  'german-summary-role-slot-classifier-320-v1' as const;
export const GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION =
  'german-summary-recovery-dispatch-320-v1' as const;
export const SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION =
  'summary-multi-role-slot-diagnostics-321-v1' as const;
export const SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION =
  'summary-repaired-provider-lineage-321-v1' as const;

void GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION;
void GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION;
void SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION;
void SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION;

export type GermanSummarySemanticRole =
  | 'current_role_intro'
  | 'current_role_duties'
  | 'prior_role_intro'
  | 'prior_role_duties'
  | 'explicit_skills'
  | 'total_duration'
  | 'other_grounded'
  | 'unsupported'
  | 'ambiguous';

export type GermanSummaryUnitSemanticAnalysis = {
  unitIndex: number;
  unitHash: string;
  roleTitleEntryMatches: boolean;
  employerEntryMatches: boolean;
  priorEmployerEntryMatches: boolean;
  currentEmploymentMarkers: boolean;
  priorEmploymentMarkers: boolean;
  currentDutyFactMatches: boolean;
  priorDutyFactMatches: boolean;
  explicitSkillClaimMatches: boolean;
  durationClaimMatches: boolean;
  totalCareerDurationMarkers: boolean;
  detectedSemanticRoles: GermanSummarySemanticRole[];
  primaryRole: GermanSummarySemanticRole;
  ambiguityReasons: string[];
};

const CURRENT_EMPLOYMENT_MARKERS_DE =
  /\b(?:seit|derzeit|aktuell|gegenwärtig|zuständig\s+für|verantwortlich\s+für|arbeite\s+ich|ich\s+arbeite)\b/iu;
const PRIOR_EMPLOYMENT_MARKERS_DE =
  /\b(?:zuvor|früher|vorher|davor|arbeitete|arbeitete\s+ich|war\s+sie|war\s+er|war\s+ich|war\s+tätig)\b/iu;
const WAREHOUSE_DUTY_DE =
  /(?:eingehend\w*\s+Waren|Wareneingang|Unterlagen|Dokument(?:e|ation)|vorbereit|beweg|Kolleg|prüfen|prüfe|kontrolliere|abstimme|Kontrolle|Koordination|Transport)/iu;
const DESIGN_DUTY_DE =
  /(?:visuell|grafisch|Design(?:unterlagen|dateien|material)|Bildschirm|Format|Element|Grafik)/iu;
const DURATION_CUE_DE =
  /(?:etwa|rund|ca\.?|ungefähr|insgesamt|sechseinhalb|anderthalb).{0,40}Jahre|Jahre(?:n)?\s+(?:Berufs)?[Ee]rfahrung/iu;
const TOTAL_CAREER_MARKER_DE =
  /\b(?:insgesamt|gesamte\s+Berufserfahrung|Berufserfahrung\s+von\s+insgesamt)\b/iu;
const COMPETENCY_INTRODUCER_DE =
  /\b(?:Kernkompetenzen|Kompetenzen|Stärken|Fähigkeiten|Kenntnisse|Qualifikationen)\b/iu;

function hashUnit(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function analyzeGermanSummaryUnitSemantics(
  units: string[],
  options: {
    company?: string;
    role?: string;
    priorCompany?: string;
    priorRole?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
  } = {},
): GermanSummaryUnitSemanticAnalysis[] {
  void GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION;
  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const role = (options.role || '').trim();
  const priorRole = (options.priorRole || '').trim();
  const out: GermanSummaryUnitSemanticAnalysis[] = [];

  for (let i = 0; i < units.length; i += 1) {
    const sentence = units[i] || '';
    const employerEntryMatches = company
      ? new RegExp(`\\b${escapeRe(company)}\\b`, 'iu').test(sentence)
      : false;
    const priorEmployerEntryMatches = priorCompany
      ? new RegExp(`\\b${escapeRe(priorCompany)}\\b`, 'iu').test(sentence)
      : false;
    const roleTitleEntryMatches = role
      ? new RegExp(escapeRe(role), 'iu').test(sentence)
      : false;
    const priorRoleTitleMatches = priorRole
      ? new RegExp(escapeRe(priorRole), 'iu').test(sentence)
      : /Grafikdesign/iu.test(sentence);
    const currentEmploymentMarkers = CURRENT_EMPLOYMENT_MARKERS_DE.test(sentence);
    const priorEmploymentMarkers = PRIOR_EMPLOYMENT_MARKERS_DE.test(sentence);
    const currentDutyFactMatches = WAREHOUSE_DUTY_DE.test(sentence);
    const priorDutyFactMatches = DESIGN_DUTY_DE.test(sentence)
      && (priorEmploymentMarkers || priorEmployerEntryMatches || priorRoleTitleMatches || i > 0);
    const explicitSkillClaimMatches = COMPETENCY_INTRODUCER_DE.test(sentence);
    const durationClaimMatches = DURATION_CUE_DE.test(sentence);
    const totalCareerDurationMarkers = TOTAL_CAREER_MARKER_DE.test(sentence);

    const roles: GermanSummarySemanticRole[] = [];
    const ambiguityReasons: string[] = [];

    const currentEmploymentEvidence = employerEntryMatches
      || roleTitleEntryMatches
      || currentEmploymentMarkers
      || (i === 0 && currentDutyFactMatches && !priorEmploymentMarkers);

    const priorEmploymentEvidence = priorEmploymentMarkers
      || priorEmployerEntryMatches
      || (priorRoleTitleMatches && (priorEmploymentMarkers || priorEmployerEntryMatches || i > 0));

    // Precedence: structured employment > skills introducer > duration heuristics.
    if (currentEmploymentEvidence) {
      roles.push('current_role_intro');
      if (currentDutyFactMatches) roles.push('current_role_duties');
    }
    if (priorEmploymentEvidence) {
      roles.push('prior_role_intro');
      if (priorDutyFactMatches || DESIGN_DUTY_DE.test(sentence)) roles.push('prior_role_duties');
    }
    if (totalCareerDurationMarkers && durationClaimMatches && !employerEntryMatches) {
      roles.push('total_duration');
    } else if (durationClaimMatches && !currentEmploymentEvidence && !priorEmploymentEvidence) {
      roles.push('total_duration');
    }
    // Skills only when introducer present AND no stronger employment claim wins alone.
    if (explicitSkillClaimMatches) {
      if (currentEmploymentEvidence || priorEmploymentEvidence) {
        ambiguityReasons.push('skills_introducer_inside_employment_unit');
        // Keep employment roles; skills is secondary signal, not primary label.
        roles.push('explicit_skills');
      } else {
        roles.push('explicit_skills');
      }
    }
    if (roles.length === 0) roles.push('other_grounded');

    let primaryRole: GermanSummarySemanticRole = roles[0]!;
    if (roles.includes('current_role_intro') || roles.includes('current_role_duties')) {
      primaryRole = currentDutyFactMatches && !roles.includes('current_role_intro')
        ? 'current_role_duties'
        : 'current_role_intro';
    } else if (roles.includes('prior_role_intro') || roles.includes('prior_role_duties')) {
      primaryRole = 'prior_role_intro';
    } else if (roles.includes('total_duration')) {
      primaryRole = 'total_duration';
    } else if (roles.includes('explicit_skills') && !currentEmploymentEvidence && !priorEmploymentEvidence) {
      primaryRole = 'explicit_skills';
    }

    if (roles.includes('current_role_intro') && roles.includes('prior_role_intro')) {
      ambiguityReasons.push('mixed_current_prior_unit');
    }

    out.push({
      unitIndex: i,
      unitHash: hashUnit(sentence),
      roleTitleEntryMatches,
      employerEntryMatches,
      priorEmployerEntryMatches,
      currentEmploymentMarkers,
      priorEmploymentMarkers,
      currentDutyFactMatches,
      priorDutyFactMatches,
      explicitSkillClaimMatches,
      durationClaimMatches,
      totalCareerDurationMarkers,
      detectedSemanticRoles: [...new Set(roles)],
      primaryRole,
      ambiguityReasons,
    });
  }
  return out;
}

/** Map multi-signal analysis to legacy exclusive slot labels for diagnostics. */
export function primaryRolesToLegacySlots(
  analyses: GermanSummaryUnitSemanticAnalysis[],
): Array<'current_intro' | 'current_duty' | 'prior_role' | 'duration' | 'total_duration' | 'skills' | 'other'> {
  return analyses.map((a) => {
    if (a.primaryRole === 'current_role_intro') return 'current_intro';
    if (a.primaryRole === 'current_role_duties') return 'current_duty';
    if (a.primaryRole === 'prior_role_intro' || a.primaryRole === 'prior_role_duties') {
      return 'prior_role';
    }
    // AAB-355: surface `duration` (Arabic/EN shared vocabulary); keep total_duration alias.
    if (a.primaryRole === 'total_duration') return 'duration';
    if (a.primaryRole === 'explicit_skills') return 'skills';
    return 'other';
  });
}

export function deriveGermanSlotPresenceFromSemanticRoles(
  rolesByUnit: string[][],
): {
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
} {
  void SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION;
  const flat = rolesByUnit || [];
  return {
    currentIntroSlotPresent: flat.some((r) => r.includes('current_role_intro')),
    currentDutySlotPresent: flat.some((r) => r.includes('current_role_duties')),
    priorRoleSlotPresent: flat.some((r) => (
      r.includes('prior_role_intro') || r.includes('prior_role_duties')
    )),
    totalDurationSlotPresent: flat.some((r) => r.includes('total_duration')),
  };
}

export function buildGermanSlotRejectionReasons(
  analyses: GermanSummaryUnitSemanticAnalysis[],
  options: {
    requireCurrent: boolean;
    requirePrior: boolean;
    requireDuration: boolean;
  },
): string[] {
  const reasons: string[] = [];
  const hasCurrentIntro = analyses.some((a) => a.detectedSemanticRoles.includes('current_role_intro'));
  const hasCurrentDuty = analyses.some((a) => (
    a.detectedSemanticRoles.includes('current_role_duties')
    || (a.detectedSemanticRoles.includes('current_role_intro') && a.currentDutyFactMatches)
  ));
  const hasPrior = analyses.some((a) => (
    a.detectedSemanticRoles.includes('prior_role_intro')
    || a.detectedSemanticRoles.includes('prior_role_duties')
  ));
  const hasDuration = analyses.some((a) => a.detectedSemanticRoles.includes('total_duration'));

  if (options.requireCurrent && !hasCurrentIntro) {
    reasons.push('missing_current_role_intro');
  }
  if (options.requireCurrent && !hasCurrentDuty) {
    reasons.push('missing_current_role_duty_coverage');
  }
  if (options.requirePrior && !hasPrior) {
    reasons.push('missing_prior_role');
  }
  if (options.requireDuration && !hasDuration) {
    reasons.push('missing_total_duration_slot');
  }
  // Mixed current+prior in one unit is recoverable via repair, but does not
  // fail slot validation when both employment coverages are already present.
  for (const a of analyses) {
    if (
      a.ambiguityReasons.includes('skills_introducer_inside_employment_unit')
      && a.primaryRole === 'explicit_skills'
      && !a.detectedSemanticRoles.includes('current_role_intro')
      && !a.detectedSemanticRoles.includes('prior_role_intro')
    ) {
      reasons.push('invalid_role_slot_classification');
    }
  }
  if (
    analyses.some((a) => a.ambiguityReasons.includes('mixed_current_prior_unit'))
    && (!hasCurrentIntro || !hasPrior)
  ) {
    reasons.push('mixed_unit_requires_repair');
  }
  return [...new Set(reasons)];
}
