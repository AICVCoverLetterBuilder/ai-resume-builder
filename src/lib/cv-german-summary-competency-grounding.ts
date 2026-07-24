/**
 * AAB-319 — German Summary competency / methodology / leadership grounding
 * and explicit-skill-only authority.
 *
 * Soft skills and methodologies are supported ONLY when present as explicit
 * user-entered Skills (or unambiguous explicit CV evidence). Job titles and
 * duties never authorize soft skills.
 */
export const GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION =
  'german-summary-competency-grounding-319-v1' as const;
export const SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION =
  'summary-explicit-skill-authority-319-v1' as const;
export const GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION =
  'german-summary-duration-scope-319-v1' as const;
export const SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION =
  'summary-final-claim-acceptance-319-v1' as const;

void GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION;
void SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION;
void GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION;
void SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION;

export type SummaryCompetencyClaimKind =
  | 'soft_skill'
  | 'methodology'
  | 'leadership'
  | 'management'
  | 'professional_trait'
  | 'competency_block';

export type SummaryCompetencyClaimUnit = {
  label: string;
  canonicalId: string;
  kind: SummaryCompetencyClaimKind;
  unsupportedKind: string;
  sourceSentence: string;
};

export type SummaryExplicitSkillFact = {
  canonicalId: string;
  sourceLabel: string;
  localizedLabel: string;
  explicitUserFact: true;
};

/** German competency introducers (sentence-level block detectors). */
const COMPETENCY_INTRODUCER_DE =
  /\b(?:Kernkompetenzen|Kompetenzen|Stärken|Fähigkeiten|Kenntnisse|Qualifikationen|methodische\s+Kompetenzen|persönliche\s+Kompetenzen|fachliche\s+Kompetenzen)\b/iu;

type SkillFamily = {
  canonicalId: string;
  kind: SummaryCompetencyClaimKind;
  unsupportedKind: string;
  patterns: RegExp[];
  /** Labels that authorize this claim when present in explicit Skills. */
  authorizeLabels: string[];
};

const SKILL_FAMILIES_DE: SkillFamily[] = [
  {
    canonicalId: 'leadership',
    kind: 'leadership',
    unsupportedKind: 'unsupported_leadership_claim',
    patterns: [/\bFührung(?:sstärke)?\b/iu, /\bFührungs(?:kraft|kompetenz)\b/iu, /\bLeadership\b/iu],
    authorizeLabels: ['führung', 'führungsstärke', 'leadership'],
  },
  {
    canonicalId: 'management',
    kind: 'management',
    unsupportedKind: 'unsupported_management_claim',
    patterns: [
      /\b(?:Personal|Team|Prozess)verantwortung\b/iu,
      /\bLeitung\b/iu,
      /\bManagement\b/iu,
      /\bStrategie\b/iu,
    ],
    authorizeLabels: ['leitung', 'management', 'strategie', 'personalverantwortung', 'teamverantwortung'],
  },
  {
    canonicalId: 'organisation',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bOrganisation(?:sfähigkeit)?\b/iu],
    authorizeLabels: ['organisation', 'organisationsfähigkeit', 'organization', 'organisational skills'],
  },
  {
    canonicalId: 'critical_thinking',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bkritische[sm]?\s+Denken\b/iu],
    authorizeLabels: ['kritisches denken', 'critical thinking'],
  },
  {
    canonicalId: 'adaptability',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bAnpassungsfähigkeit\b/iu],
    authorizeLabels: ['anpassungsfähigkeit', 'adaptability'],
  },
  {
    canonicalId: 'problem_solving',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bProblemlösung(?:skompetenz)?\b/iu],
    authorizeLabels: ['problemlösung', 'problemlösungskompetenz', 'problem solving', 'problem-solving'],
  },
  {
    canonicalId: 'time_management',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bZeitmanagement\b/iu],
    authorizeLabels: ['zeitmanagement', 'time management'],
  },
  {
    canonicalId: 'emotional_intelligence',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bemotionale\s+Intelligenz\b/iu],
    authorizeLabels: ['emotionale intelligenz', 'emotional intelligence'],
  },
  {
    canonicalId: 'attention_to_detail',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bDetailgenauigkeit\b/iu],
    authorizeLabels: ['detailgenauigkeit', 'attention to detail'],
  },
  {
    canonicalId: 'communication',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bKommunikation(?:sfähigkeit|sstärke)?\b/iu],
    authorizeLabels: [
      'kommunikation',
      'kommunikationsfähigkeit',
      'kommunikationsstärke',
      'communication',
    ],
  },
  {
    canonicalId: 'teamwork',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bTeamfähigkeit\b/iu],
    authorizeLabels: ['teamfähigkeit'],
  },
  {
    canonicalId: 'resilience',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bBelastbarkeit\b/iu],
    authorizeLabels: ['belastbarkeit'],
  },
  {
    canonicalId: 'creativity',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bKreativität\b/iu],
    authorizeLabels: ['kreativität'],
  },
  {
    canonicalId: 'initiative',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bEigeninitiative\b/iu],
    authorizeLabels: ['eigeninitiative'],
  },
  {
    canonicalId: 'reliability',
    kind: 'soft_skill',
    unsupportedKind: 'unsupported_soft_skill_claim',
    patterns: [/\bZuverlässigkeit\b/iu],
    authorizeLabels: ['zuverlässigkeit'],
  },
  {
    // Combo before bare Agile/Scrum so "Agile/Scrum" is one methodology claim.
    canonicalId: 'agile_scrum_combo',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bAgile\s*\/\s*Scrum\b/iu, /\bScrum\s*\/\s*Agile\b/iu],
    authorizeLabels: ['agile / scrum', 'agile/scrum', 'scrum / agile', 'agile und scrum'],
  },
  {
    canonicalId: 'agile',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bAgile\b/iu, /\bagile\s+Methoden\b/iu],
    authorizeLabels: ['agile', 'agile methoden'],
  },
  {
    canonicalId: 'scrum',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bScrum\b/iu],
    authorizeLabels: ['scrum'],
  },
  {
    canonicalId: 'kanban',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bKanban\b/iu],
    authorizeLabels: ['kanban'],
  },
  {
    canonicalId: 'lean',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bLean\b/iu],
    authorizeLabels: ['lean'],
  },
  {
    canonicalId: 'six_sigma',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bSix\s*Sigma\b/iu],
    authorizeLabels: ['six sigma', 'sixsigma'],
  },
  {
    canonicalId: 'design_thinking',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bDesign\s*Thinking\b/iu],
    authorizeLabels: ['design thinking'],
  },
  {
    canonicalId: 'project_management',
    kind: 'methodology',
    unsupportedKind: 'unsupported_methodology_claim',
    patterns: [/\bProjektmanagement\b/iu, /\bProject\s*Management\b/iu],
    authorizeLabels: [
      'projektmanagement',
      'project management',
      'projectmanagement',
      'upravljanje projektima',
      'upravljanje projektom',
      'gestión de proyectos',
      'gestion de projets',
      'gestione progetti',
    ],
  },
];

function normalizeSkillLabel(label: string): string {
  return (label || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Build explicit-skill authority from CV Skills section labels. */
export function buildSummaryExplicitSkillAuthority(
  structuredSkills: string[] | undefined | null,
): SummaryExplicitSkillFact[] {
  void SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION;
  const out: SummaryExplicitSkillFact[] = [];
  for (const raw of structuredSkills || []) {
    const sourceLabel = String(raw || '').trim();
    if (!sourceLabel) continue;
    const norm = normalizeSkillLabel(sourceLabel);
    let canonicalId = `skill:${norm}`;
    for (const fam of SKILL_FAMILIES_DE) {
      if (fam.authorizeLabels.some((a) => norm === a || norm.includes(a) || a.includes(norm))) {
        canonicalId = fam.canonicalId;
        break;
      }
    }
    out.push({
      canonicalId,
      sourceLabel,
      localizedLabel: sourceLabel,
      explicitUserFact: true,
    });
  }
  return out;
}

function skillAuthorized(
  family: SkillFamily,
  authority: SummaryExplicitSkillFact[],
): boolean {
  if (authority.some((a) => a.canonicalId === family.canonicalId)) return true;
  // Agile/Scrum combo requires both methodologies (or an exact combo label).
  if (family.canonicalId === 'agile_scrum_combo') {
    const agileOk = skillAuthorized(
      SKILL_FAMILIES_DE.find((f) => f.canonicalId === 'agile')!,
      authority,
    );
    const scrumOk = skillAuthorized(
      SKILL_FAMILIES_DE.find((f) => f.canonicalId === 'scrum')!,
      authority,
    );
    if (agileOk && scrumOk) return true;
  }
  const norms = authority.map((a) => normalizeSkillLabel(a.sourceLabel));
  // Exact canonical label match only — no loose duty/title inference.
  return family.authorizeLabels.some((label) => norms.some((n) => n === label));
}

/**
 * Split a German competency list sentence into individual claim labels.
 * Handles commas, "sowie", "und", and slash compounds like Agile/Scrum.
 */
export function splitGermanCompetencyListItems(sentence: string): string[] {
  void GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION;
  let body = (sentence || '').replace(/\s+/g, ' ').trim();
  if (!body) return [];
  // Drop introducer prefix: "Zu ihren Kernkompetenzen zählen X, Y sowie Z."
  body = body
    .replace(/^.*?\b(?:zählen|gehören|sind|umfassen|beinhalten)\b\s*/iu, '')
    .replace(/^[:\-–—]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!body) return [];
  // Split on commas / sowie / und (not inside slash compounds first).
  const parts = body
    .split(/\s*(?:,|;|sowie|und)\s+/iu)
    .map((p) => p.trim())
    .filter(Boolean);
  const expanded: string[] = [];
  for (const part of parts) {
    if (/\bAgile\s*\/\s*Scrum\b/iu.test(part) || /\bScrum\s*\/\s*Agile\b/iu.test(part)) {
      expanded.push(part);
      continue;
    }
    if (/\//.test(part) && !/\d/.test(part)) {
      expanded.push(...part.split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean));
    } else {
      expanded.push(part);
    }
  }
  return expanded;
}

/** Extract all competency/methodology/leadership claim units from German Summary text. */
export function extractGermanSummaryCompetencyClaims(
  text: string,
): SummaryCompetencyClaimUnit[] {
  void GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION;
  const units: SummaryCompetencyClaimUnit[] = [];
  const sentences = (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    const isBlock = COMPETENCY_INTRODUCER_DE.test(sentence);
    if (isBlock) {
      units.push({
        label: 'competency_block',
        canonicalId: 'competency_block',
        kind: 'competency_block',
        unsupportedKind: 'unsupported_competency_claim',
        sourceSentence: sentence,
      });
      const items = splitGermanCompetencyListItems(sentence);
      for (const item of items) {
        let matched = false;
        for (const fam of SKILL_FAMILIES_DE) {
          if (fam.patterns.some((re) => re.test(item))) {
            units.push({
              label: item,
              canonicalId: fam.canonicalId,
              kind: fam.kind,
              unsupportedKind: fam.unsupportedKind,
              sourceSentence: sentence,
            });
            matched = true;
            break;
          }
        }
        if (!matched && item.length >= 3) {
          units.push({
            label: item,
            canonicalId: `unknown:${normalizeSkillLabel(item)}`,
            kind: 'professional_trait',
            unsupportedKind: 'unsupported_professional_trait_claim',
            sourceSentence: sentence,
          });
        }
      }
      continue;
    }
    // Non-block sentences: still scan for methodology/leadership cues.
    for (const fam of SKILL_FAMILIES_DE) {
      if (fam.patterns.some((re) => re.test(sentence))) {
        units.push({
          label: fam.canonicalId,
          canonicalId: fam.canonicalId,
          kind: fam.kind,
          unsupportedKind: fam.unsupportedKind,
          sourceSentence: sentence,
        });
      }
    }
  }
  return units;
}

export type GermanSummaryCompetencyScan = {
  competencyClaimCount: number;
  competencyClaims: SummaryCompetencyClaimUnit[];
  unsupportedCompetencyCount: number;
  unsupportedCompetencyKinds: string[];
  methodologyClaimCount: number;
  unsupportedMethodologyCount: number;
  leadershipClaimCount: number;
  unsupportedLeadershipCount: number;
  providerRejectionStage: string | null;
  explicitSkillFactCount: number;
  competencyInferenceFromRoleForbidden: true;
};

/** Scan German Summary for unsupported competency/methodology/leadership claims. */
export function scanGermanSummaryCompetencyClaims(
  text: string,
  options: {
    structuredSkills?: string[] | null;
  } = {},
): GermanSummaryCompetencyScan {
  void GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION;
  void SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION;
  const authority = buildSummaryExplicitSkillAuthority(options.structuredSkills);
  const claims = extractGermanSummaryCompetencyClaims(text);
  const unsupportedKinds = new Set<string>();
  let unsupportedCompetencyCount = 0;
  let methodologyClaimCount = 0;
  let unsupportedMethodologyCount = 0;
  let leadershipClaimCount = 0;
  let unsupportedLeadershipCount = 0;

  for (const claim of claims) {
    if (claim.kind === 'competency_block') {
      // Block itself is unsupported when any child item is unsupported, or when
      // the block exists with zero authorized skills.
      continue;
    }
    const family = SKILL_FAMILIES_DE.find((f) => f.canonicalId === claim.canonicalId);
    const authorized = family
      ? skillAuthorized(family, authority)
      : authority.some((a) => normalizeSkillLabel(a.sourceLabel) === normalizeSkillLabel(claim.label));

    if (claim.kind === 'methodology') methodologyClaimCount += 1;
    if (claim.kind === 'leadership' || claim.kind === 'management') leadershipClaimCount += 1;

    if (!authorized) {
      unsupportedCompetencyCount += 1;
      unsupportedKinds.add(claim.unsupportedKind);
      unsupportedKinds.add('unsupported_competency_claim');
      if (claim.kind === 'methodology') unsupportedMethodologyCount += 1;
      if (claim.kind === 'leadership' || claim.kind === 'management') {
        unsupportedLeadershipCount += 1;
      }
    }
  }

  // A Kernkompetenzen block with unsupported children (or empty authority) is itself unsupported.
  const hasBlock = claims.some((c) => c.kind === 'competency_block');
  if (hasBlock && (unsupportedCompetencyCount > 0 || authority.length === 0)) {
    unsupportedKinds.add('unsupported_competency_claim');
  }

  return {
    competencyClaimCount: claims.filter((c) => c.kind !== 'competency_block').length,
    competencyClaims: claims,
    unsupportedCompetencyCount,
    unsupportedCompetencyKinds: [...unsupportedKinds],
    methodologyClaimCount,
    unsupportedMethodologyCount,
    leadershipClaimCount,
    unsupportedLeadershipCount,
    providerRejectionStage: unsupportedCompetencyCount > 0
      ? 'competency_grounding_validation'
      : null,
    explicitSkillFactCount: authority.length,
    competencyInferenceFromRoleForbidden: true,
  };
}

export function isGermanGenericCompetencyUnit(sentence: string): boolean {
  return COMPETENCY_INTRODUCER_DE.test(sentence || '');
}

/** Remove whole unsupported competency sentences (never word-strip). */
export function stripGermanUnsupportedCompetencyUnits(text: string): string {
  const sentences = (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences
    .filter((s) => !isGermanGenericCompetencyUnit(s))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type SummaryDurationOwner =
  | 'total_professional_experience'
  | 'current_role_duration'
  | 'prior_role_duration'
  | 'education_duration'
  | 'unknown';

export type GermanDurationScopeAnalysis = {
  finalDurationOwnerExpected: SummaryDurationOwner;
  finalDurationOwnerDetected: SummaryDurationOwner;
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  durationScopeRejectionReason: string | null;
};

const TOTAL_CAREER_MARKER_DE =
  /\b(?:insgesamt|gesamte\s+Berufserfahrung|Berufserfahrung\s+von\s+insgesamt|insgesamt\s+verfügt|insgesamt\s+bringt|mit\s+insgesamt)\b/iu;

const DURATION_CUE_DE =
  /(?:etwa|rund|ca\.?|ungefähr|sechseinhalb|anderthalb|zweieinhalb|dreieinhalb).{0,40}Jahre|Jahre(?:n)?\s+(?:Berufs)?[Ee]rfahrung|(?:sechseinhalb|anderthalb|zweieinhalb|dreieinhalb)\s+Jahre/iu;

/**
 * Standalone German total-professional-experience duration sentence.
 * Never attach this phrase inside a current-role / employer clause.
 */
export function formatGermanTotalProfessionalDurationSentence(
  durationPhraseOrWord: string,
  gender?: string,
): string {
  void GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION;
  let core = (durationPhraseOrWord || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!core) return '';
  // Normalize "mit etwa X Jahren Erfahrung" → "etwa X Jahre Berufserfahrung".
  core = core
    .replace(/^mit\s+/iu, '')
    .replace(/\bJahren\s+Erfahrung\b/iu, 'Jahre Berufserfahrung')
    .replace(/\bJahre\s+Erfahrung\b/iu, 'Jahre Berufserfahrung')
    .replace(/\bBerufserfahrung\b/iu, 'Berufserfahrung')
    .trim();
  if (!/\bBerufserfahrung\b/iu.test(core)) {
    core = `${core} Berufserfahrung`.replace(/\s+/g, ' ').trim();
  }
  if (!/\binsgesamt\b/iu.test(core)) {
    const g = String(gender || '').toLowerCase();
    const female = g === 'female' || g === 'f' || g === 'weiblich';
    const male = g === 'male' || g === 'm' || g === 'männlich';
    if (female) return `Insgesamt verfügt sie über ${core}.`;
    if (male) return `Insgesamt verfügt er über ${core}.`;
    return `Insgesamt besteht ${core}.`;
  }
  if (!/[.]$/u.test(core)) return `${core}.`;
  return core;
}

/** Append a clearly scoped total-duration sentence (never merge into role clause). */
export function injectGermanTotalDurationSentence(
  summary: string,
  durationPhrase: string,
  gender?: string,
): string {
  void GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const sentence = formatGermanTotalProfessionalDurationSentence(durationPhrase, gender);
  if (!sentence) return text;
  if (!text) return sentence;
  if (TOTAL_CAREER_MARKER_DE.test(text) && DURATION_CUE_DE.test(text)) return text;
  return `${text.replace(/[.!?]\s*$/u, '.')} ${sentence}`.replace(/\s+/g, ' ').trim();
}

/**
 * Analyze whether a German total-duration claim is clearly scoped to total
 * professional experience vs ambiguously attached to the current role.
 */
export function analyzeGermanSummaryDurationScope(
  text: string,
  options: {
    company?: string;
    role?: string;
    expectedOwner?: SummaryDurationOwner;
  } = {},
): GermanDurationScopeAnalysis {
  void GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION;
  const expected: SummaryDurationOwner = options.expectedOwner || 'total_professional_experience';
  const sentences = (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const company = (options.company || '').trim();
  const companyEsc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const role = (options.role || '').trim();

  let detected: SummaryDurationOwner = 'unknown';
  let totalMarker = false;
  let currentRoleRisk = false;
  let reason: string | null = null;

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    if (!DURATION_CUE_DE.test(sentence)) continue;
    const hasTotalMarker = TOTAL_CAREER_MARKER_DE.test(sentence);
    const hasCompany = companyEsc ? new RegExp(`\\b(?:bei)\\s+${companyEsc}\\b`, 'iu').test(sentence) : false;
    const hasSeit = /\bseit\s+(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|\d)/iu
      .test(sentence);
    const hasAlsRole = role
      ? new RegExp(`\\bals\\s+${role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(sentence)
      : /\bals\s+\p{L}+/iu.test(sentence);
    const hasDutyParticiple = /\bzuständig\s+für\b|\bmit\s+Erfahrung\s+in\b/iu.test(sentence);

    if (hasTotalMarker && !hasCompany && !hasSeit) {
      detected = 'total_professional_experience';
      totalMarker = true;
    } else if (hasTotalMarker && (hasCompany || hasSeit)) {
      // Combined sentence with explicit total marker — allow if marker dominates.
      detected = 'total_professional_experience';
      totalMarker = true;
      currentRoleRisk = hasDutyParticiple && !/\binsgesamt\b/iu.test(sentence);
    } else if (hasCompany || hasSeit || hasAlsRole || (i === 0 && hasDutyParticiple)) {
      detected = 'current_role_duration';
      currentRoleRisk = true;
      reason = 'duration_attached_to_current_role';
    } else if (/\bzuvor\b|\bfrüher\b/iu.test(sentence)) {
      detected = 'prior_role_duration';
    } else if (hasTotalMarker) {
      detected = 'total_professional_experience';
      totalMarker = true;
    }
  }

  if (!DURATION_CUE_DE.test(text || '')) {
    detected = 'unknown';
    reason = reason || 'duration_claim_missing';
  }

  const passed = expected === 'total_professional_experience'
    ? (detected === 'total_professional_experience' && totalMarker && !currentRoleRisk)
    : detected === expected;

  if (!passed && !reason) {
    reason = currentRoleRisk
      ? 'duration_current_role_attachment_risk'
      : 'duration_scope_mismatch';
  }

  return {
    finalDurationOwnerExpected: expected,
    finalDurationOwnerDetected: detected,
    finalDurationScopeValidationPassed: passed,
    finalDurationCurrentRoleAttachmentRisk: currentRoleRisk,
    finalDurationTotalCareerMarkerPresent: totalMarker,
    durationScopeRejectionReason: passed ? null : reason,
  };
}
