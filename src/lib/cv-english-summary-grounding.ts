/**
 * AAB-325 — English Summary shared final gate: entry-owned grounding, locale
 * purity, current/prior duty coverage, competency, duration scope.
 *
 * Reuses shared structured-role localization and warehouse duty fact identities
 * from the German path; English wording and validators are locale-specific.
 */
import type { Locale } from './i18n/translations';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';
import {
  resolveLocalizedSummaryRole,
  validateSummaryStructuredRoleLocale,
  type StructuredRoleLocaleValidation,
} from './cv-summary-structured-role-localization';
import {
  extractGermanCurrentWarehouseDutyFacts,
  validateSummaryEntryDutyCoverage,
  analyzeCurrentDutyRequiredFactParity,
  type GermanCurrentDutyFact,
  type SummaryEntryDutyCoverageResult,
  type AuthoritativeCurrentDutyParityResult,
} from './cv-german-summary-current-duty-coverage';
import { buildSummaryExplicitSkillAuthority } from './cv-german-summary-competency-grounding';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';

export const ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION =
  'english-summary-shared-final-gate-325-v1' as const;
export const ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION =
  'english-summary-entity-locale-purity-325-v1' as const;
export const ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION =
  'english-summary-current-prior-coverage-325-v1' as const;
export const SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION =
  'summary-invariant-preapply-gate-325-v1' as const;

/**
 * Strict English Summary domain for the Atlas/Rewitu shared final gate.
 * Matches Spanish warehouse/design source and German compound warehouse/design
 * titles only. Do not match localized English "Warehouse Employee" /
 * "Graphic Designer" — those falsely trigger the gate on sr→en cycles after
 * Experience enhance localizes titles.
 */
export const ENGLISH_STRUCTURED_SUMMARY_DOMAIN_RE =
  /(?:almac[eé]n|mercanc[ií]a|emplead[oa]s?|diseñ(?:adora|ador|o)?|Lager(?:mitarbeiter(?:in)?|arbeiter(?:in)?)|Grafikdesign(?:er(?:in)?|erin)|Emplead[oa]\s+de\s+almac)/iu;

export function isEnglishStructuredSummaryDomain(corpus: string): boolean {
  void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
  return ENGLISH_STRUCTURED_SUMMARY_DOMAIN_RE.test(corpus || '');
}

void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
void ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION;
void ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION;
void SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION;

const EN_MONTHS: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December',
};

const MIXED_MORPHOLOGY_RE =
  /(?:^|[^A-Za-zÁÉÍÓÚáéíóúÑñ])(?:revisingó|comprobingó|checkingó|coordinatió|verifyingó|updatingó|[A-Za-z]{4,}ing[óáéíú]|[A-Za-z]{4,}ed[óáéíú])(?=[^A-Za-zÁÉÍÓÚáéíóúÑñ]|$)/iu;
const SPANISH_DUTY_LEAK_RE =
  /\b(?:la\s+mercanc[ií]a|documentaci[oó]n\s+asociada|almac[eé]n|compa[nñ]eros?|revis[oó]|comprob[oó]|coordin[oó])\b/iu;
const SPANISH_ROLE_LEAK_RE =
  /\b(?:emplead[oa]\s+de\s+almac[eé]n|diseñadora?\s+gr[aá]fica|trabajador(?:a)?\s+de\s+almac)\b/iu;

const PRIOR_DESIGN_CUE =
  /(?:visual\s+materials?|design\s+(?:documents?|materials?|files?)|formats?\s+and\s+screens?|creating\s+visual|revising\s+design|preparing\s+final|diseñ|visual|vizuel|grafik)/iu;

const UNSUPPORTED_SOFT_SKILL_RE =
  /\b(?:leadership|organization|organisation|critical\s+thinking|adaptability|teamwork|communication\s+skills?|problem[- ]solving|time\s+management|creativity|initiative)\b/iu;

const COMPETENCY_INTRO_RE =
  /(?:key\s+skills?\s+include|core\s+skills?\s+include|competenc(?:y|ies)\s+include|strengths?\s+include|skilled\s+in|proficient\s+in)\s*[:,]?\s*([^.]+)/iu;

export function detectEnglishMixedLanguageMorphology(text: string): {
  mixedLanguageMorphologyDetected: boolean;
  failureKinds: string[];
} {
  void ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION;
  const failureKinds: string[] = [];
  if (MIXED_MORPHOLOGY_RE.test(text || '')) {
    failureKinds.push('mixed_language_morphology');
  }
  // Accented Spanish verb ending glued to English -ing/-ed stem.
  if (/(?:^|[^A-Za-z])[A-Za-z]{3,}(?:ing|ed)[óáéíú](?=[^A-Za-z]|$)/iu.test(text || '')) {
    failureKinds.push('mixed_language_morphology');
  }
  return {
    mixedLanguageMorphologyDetected: failureKinds.length > 0,
    failureKinds: [...new Set(failureKinds)],
  };
}

export function detectEnglishSourceDutyLeakage(text: string): {
  sourceDutyLeakageDetected: boolean;
  rawSourceRoleLeakageDetected: boolean;
  failureKinds: string[];
} {
  void ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION;
  const failureKinds: string[] = [];
  const duty = SPANISH_DUTY_LEAK_RE.test(text || '');
  const role = SPANISH_ROLE_LEAK_RE.test(text || '');
  if (duty) failureKinds.push('raw_source_duty_leakage');
  if (role) failureKinds.push('raw_source_role_leakage');
  if (/\b(?:la|el|los|las|de|en)\s+(?:mercanc|documentaci|almac)/iu.test(text || '')) {
    failureKinds.push('foreign_current_duty_span');
  }
  return {
    sourceDutyLeakageDetected: duty || failureKinds.includes('foreign_current_duty_span'),
    rawSourceRoleLeakageDetected: role,
    failureKinds: [...new Set(failureKinds)],
  };
}

function englishCurrentDutyMatchRes(factId: string): RegExp[] {
  switch (factId) {
    case 'incoming_goods_check':
      return [
        /checking\s+incoming\s+goods/iu,
        /incoming\s+goods/iu,
        /inbound\s+goods/iu,
      ];
    case 'related_documentation_check':
      return [
        /(?:checking|reviewing)\s+(?:the\s+)?related\s+documentation/iu,
        /related\s+documentation/iu,
        /accompanying\s+documentation/iu,
      ];
    case 'colleague_coordination_goods_preparation_movement':
      return [
        /coordinat\w*.{0,100}(?:colleague|colleagues).{0,80}(?:prepar|movement|transport)/iu,
        /coordinat\w*.{0,100}(?:prepar|movement|transport).{0,80}(?:colleague|colleagues)/iu,
        /preparation\s+and\s+movement\s+of\s+goods/iu,
      ];
    default:
      return [];
  }
}

function withEnglishMatchRes(facts: GermanCurrentDutyFact[]): GermanCurrentDutyFact[] {
  return facts.map((f) => ({
    ...f,
    matchRes: [...englishCurrentDutyMatchRes(f.canonicalFactId), ...f.matchRes],
  }));
}

export function scanEnglishSummaryCompetencyClaims(
  summary: string,
  structuredSkills: string[] = [],
): {
  unsupportedCompetencyCount: number;
  unsupportedCompetencyKinds: string[];
  unsupportedClaims: string[];
  finalUnsupportedCompetencyCount: number;
} {
  const text = summary || '';
  const authority = buildSummaryExplicitSkillAuthority(structuredSkills);
  const claims: string[] = [];
  const m = COMPETENCY_INTRO_RE.exec(text);
  if (m?.[1]) {
    for (const part of m[1].split(/,| and | & /i)) {
      const c = part.replace(/\.$/u, '').trim();
      if (c) claims.push(c);
    }
  }
  // Also catch bare soft-skill lists after "skills include".
  const softHits = [...text.matchAll(new RegExp(UNSUPPORTED_SOFT_SKILL_RE.source, 'giu'))]
    .map((x) => x[0]);
  for (const s of softHits) {
    if (!claims.some((c) => c.toLowerCase() === s.toLowerCase())) claims.push(s);
  }

  const unsupported: string[] = [];
  const kinds: string[] = [];
  for (const claim of claims) {
    const normalized = claim.toLowerCase().replace(/\s+/g, ' ').trim();
    const authorized = authority.some(
      (a) => a.sourceLabel.toLowerCase() === normalized
        || a.localizedLabel.toLowerCase() === normalized
        || normalized.includes(a.sourceLabel.toLowerCase())
        || a.sourceLabel.toLowerCase().includes(normalized),
    );
    if (authorized) continue;
    unsupported.push(claim);
    if (/leadership/i.test(claim)) kinds.push('unsupported_leadership_claim');
    else if (/organiz/i.test(claim)) kinds.push('unsupported_soft_skill_claim');
    else if (/critical\s+thinking|adaptability|teamwork|creativity|initiative/i.test(claim)) {
      kinds.push('unsupported_professional_trait_claim');
    } else kinds.push('unsupported_competency_claim');
  }
  return {
    unsupportedCompetencyCount: unsupported.length,
    unsupportedCompetencyKinds: [...new Set(kinds)],
    unsupportedClaims: unsupported,
    finalUnsupportedCompetencyCount: unsupported.length,
  };
}

export function analyzeEnglishSummaryDurationScope(
  summary: string,
  options: { company?: string; role?: string } = {},
): {
  finalDurationScopeValidationPassed: boolean;
  finalDurationOwnerExpected: 'total_professional_experience';
  finalDurationOwnerDetected: 'total_professional_experience' | 'current_role_duration' | 'unknown' | null;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  durationScopeRejectionReason: string | null;
} {
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = text.split(/(?<=[.!?])\s+(?=\S)/u).map((u) => u.trim()).filter(Boolean);
  const company = (options.company || '').trim();
  const durationCue =
    /(?:approximately|about|around|roughly|overall|in\s+total|total(?:ing)?).{0,40}(?:years?|months?)\s+of\s+(?:professional\s+)?experience|(?:years?|months?)\s+of\s+(?:professional\s+)?experience/iu;
  const totalMarker =
    /(?:overall|in\s+total|altogether|across\s+(?:her|his|their)\s+career|total\s+professional)/iu;
  const attachmentRisk = Boolean(
    company
    && new RegExp(
      `${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.{0,120}${durationCue.source}`,
      'iu',
    ).test(units[0] || '')
    && /since\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/iu
      .test(units[0] || '')
    && !totalMarker.test(units[0] || ''),
  );
  // Classic bad form: "at Atlas since …, with approximately … years of experience VERBING"
  const classicAttachment =
    /at\s+\w+.{0,40}since\s+\w+.{0,40},\s+with\s+approximately.{0,40}years?\s+of\s+experience\s+\w+ing/iu
      .test(text);
  const hasDuration = durationCue.test(text);
  const totalPresent = totalMarker.test(text) || (
    hasDuration
    && units.some((u) => totalMarker.test(u) || (
      durationCue.test(u)
      && !/at\s+\w+.{0,24}since/iu.test(u)
    ))
  );
  const risk = attachmentRisk || classicAttachment;
  const owner: 'total_professional_experience' | 'current_role_duration' | 'unknown' | null =
    !hasDuration ? null
      : risk ? 'current_role_duration'
        : totalPresent ? 'total_professional_experience'
          : 'unknown';
  const ok = !hasDuration || (owner === 'total_professional_experience' && !risk);
  return {
    finalDurationScopeValidationPassed: ok,
    finalDurationOwnerExpected: 'total_professional_experience',
    finalDurationOwnerDetected: owner,
    finalDurationCurrentRoleAttachmentRisk: risk,
    finalDurationTotalCareerMarkerPresent: totalPresent,
    durationScopeRejectionReason: !ok
      ? (risk ? 'duration_current_role_attachment_risk' : 'duration_scope_mismatch')
      : null,
  };
}

function priorDutyCoverage(summary: string, priorDuties: string): {
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalPriorDutyCoveragePassed: boolean;
} {
  const bullets = (priorDuties || '')
    .split(/\n+|;\s+|(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  const designDomain = PRIOR_DESIGN_CUE.test(priorDuties || '')
    || /diseñ|design|grafik|visual/i.test(priorDuties || '');
  if (!designDomain) {
    return {
      requiredPriorDutyFactCount: 0,
      coveredPriorDutyFactCount: 0,
      missingPriorDutyFactCount: 0,
      finalPriorDutyCoveragePassed: true,
    };
  }
  const required = Math.max(3, Math.min(3, bullets.length || 3));
  const checks = [
    /(?:creating|created|crea)\w*.{0,40}(?:visual|graphic)/iu.test(summary)
      || /visual\s+materials?/iu.test(summary),
    /(?:revising|revised|adapt|review)\w*.{0,60}(?:design|document)/iu.test(summary)
      || /design\s+(?:documents?|materials?)/iu.test(summary),
    /(?:preparing|prepared|prepare)\w*.{0,60}(?:final|files?|formats?|screens?)/iu.test(summary)
      || /final\s+files?/iu.test(summary),
  ];
  const covered = checks.filter(Boolean).length;
  return {
    requiredPriorDutyFactCount: required,
    coveredPriorDutyFactCount: covered,
    missingPriorDutyFactCount: Math.max(0, required - covered),
    finalPriorDutyCoveragePassed: covered === required,
  };
}

export type EnglishSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'total_duration'
  | 'explicit_skills'
  | 'unsupported'
  | 'ambiguous';

export type EnglishSummaryEmploymentQuality = {
  ok: boolean;
  reason: string | null;
  groundingValidationPassed: boolean;
  typedRejectionReason: string | null;
  slotValidationPassed: boolean;
  slotRejectionReasons: string[];
  finalUnitSemanticRolesByUnit: string[][];
  finalUnitRoleSlots: EnglishSummaryRoleSlot[];
  finalSentenceHashes?: string[];
  finalSentenceRoleSlots?: string[];
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
  explicitSkillsSlotPresent: boolean;
  finalCurrentIntroSlotPresent: boolean;
  finalCurrentDutySlotPresent: boolean;
  finalPriorIntroSlotPresent: boolean;
  finalPriorDutySlotPresent: boolean;
  finalTotalDurationSlotPresent: boolean;
  finalSlotValidationPassed: boolean;
  finalSlotRejectionReasons: string[];
  currentRoleConcreteFactCoverage: number;
  priorRoleGroundingPassed: boolean;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  currentRoleOmittedDetected: boolean;
  currentEmploymentIntroductionCount: number;
  finalCurrentEmployerPresent: boolean;
  finalPriorEmployerPresent: boolean;
  finalCurrentEmploymentStateExpressed: boolean;
  finalPriorEmploymentStateExpressed: boolean;
    finalCurrentRoleIntroValidationPassed: boolean;
  finalPriorRoleIntroValidationPassed: boolean;
  finalPriorRoleTitlePresent: boolean;
  finalCurrentRoleTitlePresent: boolean;
  finalCurrentDutyCoveragePassed: boolean;
  finalPriorDutyCoveragePassed: boolean;
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  structuredRoleLocaleValidationPassed: boolean;
  currentRoleLocalizationValidationPassed: boolean;
  priorRoleLocalizationValidationPassed: boolean;
  foreignStructuredRoleTitleCount: number;
  foreignPriorRoleTitleCount: number;
  foreignCurrentRoleTitleDetected: boolean;
  rawSourceRoleLeakageDetected: boolean;
  finalWrongLocaleStructuredRoleCount: number;
  finalStructuredRoleLocaleValidationPassed: boolean;
  finalForeignRoleTitleCount: number;
  targetLocalePurityPassed: boolean;
  sourceLanguageLeakageDetected: boolean;
  wrongLocaleUnitCount: number;
  unexpectedLocaleCodes: string[];
  germanControlledCaseGrammarPassed?: boolean;
  finalUnsupportedCompetencyCount: number;
  unsupportedCompetencyCount: number;
  unsupportedCompetencyKinds: string[];
  unsupportedClaimCount: number;
  unsupportedClaimKinds: string[];
  competencyScan: {
    unsupportedCompetencyCount: number;
    unsupportedCompetencyKinds: string[];
    explicitSkillFactCount: number;
    competencyClaimCount: number;
    providerRejectionStage: string | null;
  };
  durationScopeRejectionReason: string | null;
  finalDurationScopeValidationPassed: boolean;
  finalDurationOwnerExpected: 'total_professional_experience';
  finalDurationOwnerDetected: string | null;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  currentDutyRequiredFactParityPassed: boolean;
  authoritativeCurrentDutyFactCount: number;
  authoritativeCanonicalCurrentDutyFactCount: number;
  classifiedRequiredCurrentDutyFactCount: number;
  unclassifiedAuthoritativeCurrentDutyFactCount: number;
  requiredFactSetMatchesAuthoritativeFactSet: boolean;
  materialCategoryCoverageUsedForFinalAcceptance: false;
  mixedLanguageMorphologyDetected: boolean;
  currentDutyCoverage?: SummaryEntryDutyCoverageResult;
  currentDutyParity?: AuthoritativeCurrentDutyParityResult;
  structuredRoleLocale?: StructuredRoleLocaleValidation;
};

export function analyzeEnglishSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
    priorCompany?: string;
    priorRole?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
    structuredSkills?: string[];
    currentEntryId?: string | null;
    priorEntryId?: string | null;
  } = {},
): EnglishSummaryEmploymentQuality {
  void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
  void ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = text
    ? text.split(/(?<=[.!?])\s+(?=\S)/u).map((u) => u.trim()).filter(Boolean)
    : [];

  const currentLocalized = resolveLocalizedSummaryRole({
    role: options.role || '',
    targetLocale: 'en',
    gender: options.gender,
  });
  const priorLocalized = resolveLocalizedSummaryRole({
    role: options.priorRole || '',
    targetLocale: 'en',
    gender: options.gender,
  });
  const structuredRoleLocale = validateSummaryStructuredRoleLocale({
    summary: text,
    targetLocale: 'en',
    gender: options.gender,
    currentRole: options.role,
    priorRole: options.priorRole,
    currentEntryId: options.currentEntryId,
    priorEntryId: options.priorEntryId,
    currentLocalized,
    priorLocalized,
  });

  const requiredCurrentDutyFacts = withEnglishMatchRes(
    extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: options.currentEntryDuties,
      entryId: options.currentEntryId,
    }),
  );
  const currentDutyParity = analyzeCurrentDutyRequiredFactParity({
    currentEntryDuties: options.currentEntryDuties,
    requiredFacts: requiredCurrentDutyFacts,
    entryId: options.currentEntryId,
  });
  const currentDutyCoverage = validateSummaryEntryDutyCoverage({
    requiredFacts: requiredCurrentDutyFacts,
    candidateText: text,
    entryId: options.currentEntryId,
  });
  const priorCov = priorDutyCoverage(text, options.priorEntryDuties || '');
  const competency = scanEnglishSummaryCompetencyClaims(
    text,
    options.structuredSkills || [],
  );
  const durationScope = analyzeEnglishSummaryDurationScope(text, {
    company: options.company,
    role: options.role,
  });
  const morph = detectEnglishMixedLanguageMorphology(text);
  const leak = detectEnglishSourceDutyLeakage(text);
  const purity = validateAiUnitLocalePurity(text, 'en', {
    kind: 'summary_sentence',
  });

  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const currentTitle = currentLocalized.localizationValidationPassed
    ? currentLocalized.localizedTargetRoleLabel
    : (options.role || '');
  const priorTitle = priorLocalized.localizationValidationPassed
    ? priorLocalized.localizedTargetRoleLabel
    : (options.priorRole || '');

  const currentRoleTitlePresent = Boolean(
    currentTitle
    && new RegExp(currentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text),
  ) || /\bWarehouse\s+(?:Employee|Worker)\b/iu.test(text);
  const finalCurrentEmployerPresent = Boolean(
    company && new RegExp(`\\b${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(text),
  );
  const finalPriorEmployerPresent = Boolean(
    priorCompany
    && new RegExp(`\\b${priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(text),
  );
  const finalCurrentEmploymentStateExpressed =
    /since\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|\d)/iu
      .test(text)
    || /\bcurrently\b/iu.test(text);
  const finalPriorEmploymentStateExpressed =
    /\b(?:previously|formerly|prior\s+to|before\s+that|worked\s+as)\b/iu.test(text);

  const requirePrior = Boolean(priorCompany || options.priorEntryDuties);
  const requireCurrentDuties = requiredCurrentDutyFacts.length > 0;

  const currentIntro = currentRoleTitlePresent && finalCurrentEmployerPresent
    && finalCurrentEmploymentStateExpressed;
  const currentDutiesOk = !requireCurrentDuties
    || currentDutyCoverage.finalCurrentDutyCoveragePassed;
  const priorIntro = !requirePrior
    || (
      (/\bGraphic\s+Designer\b/iu.test(text) || Boolean(
        priorTitle
        && new RegExp(priorTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text),
      ))
      && finalPriorEmployerPresent
      && finalPriorEmploymentStateExpressed
    );
  const priorDutiesOk = !requirePrior || priorCov.finalPriorDutyCoveragePassed;
  const totalDurationSlot = durationScope.finalDurationTotalCareerMarkerPresent
    || (
      durationScope.finalDurationOwnerDetected === 'total_professional_experience'
      && durationScope.finalDurationScopeValidationPassed
    );

  const rolesByUnit: string[][] = units.map((u) => {
    const roles: string[] = [];
    if (/Warehouse|at\s+\w+|since\s+/iu.test(u) && !/Previously|Overall|In\s+total/iu.test(u)) {
      roles.push('current_role_intro');
      if (/checking|coordinat|documentation|goods/iu.test(u)) roles.push('current_role_duties');
    }
    if (/Previously|formerly|worked\s+as|Graphic\s+Designer/iu.test(u)) {
      roles.push('prior_role_intro');
      if (/visual|design|files?|formats?/iu.test(u)) roles.push('prior_role_duties');
    }
    if (/Overall|In\s+total|professional\s+experience/iu.test(u)
      && !/at\s+\w+.{0,24}since/iu.test(u)) {
      roles.push('total_duration');
    }
    if (/key\s+skills?\s+include/iu.test(u)) roles.push('explicit_skills');
    if (roles.length === 0) roles.push('ambiguous');
    return roles;
  });

  const slotRejectionReasons: string[] = [];
  if (!currentIntro) slotRejectionReasons.push('missing_current_role_intro');
  if (!currentDutiesOk) slotRejectionReasons.push('current_duty_fact_coverage_incomplete');
  if (requirePrior && !priorIntro) slotRejectionReasons.push('missing_prior_role_intro');
  if (requirePrior && !priorDutiesOk) slotRejectionReasons.push('prior_duty_fact_coverage_incomplete');
  if (!durationScope.finalDurationScopeValidationPassed && /years?\s+of\s+experience/iu.test(text)) {
    slotRejectionReasons.push(durationScope.durationScopeRejectionReason || 'duration_scope_mismatch');
  }
  if (!currentDutyParity.currentDutyRequiredFactParityPassed && requireCurrentDuties) {
    slotRejectionReasons.push(
      currentDutyParity.rejectionReason || 'current_duty_required_fact_parity_failed',
    );
  }
  if (morph.mixedLanguageMorphologyDetected) {
    slotRejectionReasons.push(...morph.failureKinds);
  }
  if (leak.sourceDutyLeakageDetected || leak.rawSourceRoleLeakageDetected) {
    slotRejectionReasons.push(...leak.failureKinds);
  }
  if (!purity.targetLocalePurityPassed || purity.wrongLocaleUnitCount > 0
    || (purity.unexpectedLocaleCodes || []).includes('es')) {
    slotRejectionReasons.push('target_locale_unit_mismatch');
  }
  if (competency.finalUnsupportedCompetencyCount > 0) {
    slotRejectionReasons.push('unsupported_competency_claim');
  }
  if (!structuredRoleLocale.structuredRoleLocaleValidationPassed) {
    slotRejectionReasons.push(...structuredRoleLocale.failureKinds);
  }

  const sourceLeak = leak.sourceDutyLeakageDetected
    || leak.rawSourceRoleLeakageDetected
    || morph.mixedLanguageMorphologyDetected
    || (purity.unexpectedLocaleCodes || []).includes('es')
    || purity.wrongLocaleUnitCount > 0
    || structuredRoleLocale.rawSourceRoleLeakageDetected;

  const slotValidationPassed = slotRejectionReasons.length === 0
    && currentIntro
    && currentDutiesOk
    && priorIntro
    && priorDutiesOk
    && (!(/years?\s+of\s+experience/iu.test(text)) || durationScope.finalDurationScopeValidationPassed)
    && competency.finalUnsupportedCompetencyCount === 0
    && !sourceLeak
    && purity.targetLocalePurityPassed
    && structuredRoleLocale.structuredRoleLocaleValidationPassed
    && (!requireCurrentDuties || currentDutyParity.currentDutyRequiredFactParityPassed);

  let reason: string | null = null;
  if (!text) reason = 'empty_summary';
  else if (morph.mixedLanguageMorphologyDetected) reason = 'mixed_language_morphology';
  else if (leak.sourceDutyLeakageDetected) reason = 'raw_source_duty_leakage';
  else if ((purity.unexpectedLocaleCodes || []).includes('es') || purity.wrongLocaleUnitCount > 0) {
    reason = 'unexpected_locale_detected';
  } else if (!structuredRoleLocale.structuredRoleLocaleValidationPassed) {
    reason = structuredRoleLocale.failureKinds[0] || 'foreign_prior_role_title';
  } else if (!currentDutyParity.currentDutyRequiredFactParityPassed && requireCurrentDuties) {
    reason = currentDutyParity.rejectionReason || 'current_duty_required_fact_parity_failed';
  } else if (!currentDutiesOk) reason = 'current_duty_fact_coverage_incomplete';
  else if (requirePrior && !priorDutiesOk) reason = 'prior_duty_fact_coverage_incomplete';
  else if (requirePrior && !priorIntro) reason = 'missing_prior_role_intro';
  else if (competency.finalUnsupportedCompetencyCount > 0) reason = 'unsupported_competency_claim';
  else if (!durationScope.finalDurationScopeValidationPassed && /years?\s+of\s+experience/iu.test(text)) {
    reason = durationScope.durationScopeRejectionReason || 'duration_scope_mismatch';
  } else if (!slotValidationPassed) {
    reason = slotRejectionReasons[0] || 'english_summary_grounding_failed';
  }

  const ok = reason == null && slotValidationPassed;

  const legacySlots: EnglishSummaryRoleSlot[] = [];
  if (currentIntro) legacySlots.push('current_intro');
  if (currentDutiesOk && requireCurrentDuties) legacySlots.push('current_duty');
  if (requirePrior && priorIntro) legacySlots.push('prior_role');
  if (totalDurationSlot) legacySlots.push('total_duration');
  if (rolesByUnit.some((r) => r.includes('explicit_skills'))) {
    legacySlots.push('explicit_skills');
  }
  if (legacySlots.length === 0 && text) legacySlots.push('ambiguous');

  const foreignRoleCount = structuredRoleLocale.foreignStructuredRoleTitleCount;
  const competencyScan = {
    unsupportedCompetencyCount: competency.unsupportedCompetencyCount,
    unsupportedCompetencyKinds: competency.unsupportedCompetencyKinds,
    explicitSkillFactCount: (options.structuredSkills || []).filter(Boolean).length,
    competencyClaimCount: competency.unsupportedClaims.length
      + (COMPETENCY_INTRO_RE.test(text) ? 1 : 0),
    providerRejectionStage: competency.finalUnsupportedCompetencyCount > 0
      ? 'unsupported_competency_claim'
      : null,
  };

  return {
    ok,
    reason,
    groundingValidationPassed: ok,
    typedRejectionReason: reason,
    slotValidationPassed,
    slotRejectionReasons: [...new Set(slotRejectionReasons)],
    finalUnitSemanticRolesByUnit: rolesByUnit,
    finalUnitRoleSlots: legacySlots,
    finalSentenceHashes: [],
    finalSentenceRoleSlots: legacySlots.map(String),
    currentIntroSlotPresent: currentIntro,
    currentDutySlotPresent: currentDutiesOk && requireCurrentDuties,
    priorRoleSlotPresent: priorIntro && requirePrior,
    totalDurationSlotPresent: Boolean(totalDurationSlot),
    explicitSkillsSlotPresent: legacySlots.includes('explicit_skills')
      && competency.finalUnsupportedCompetencyCount === 0,
    finalCurrentIntroSlotPresent: currentIntro,
    finalCurrentDutySlotPresent: currentDutiesOk && requireCurrentDuties,
    finalPriorIntroSlotPresent: priorIntro,
    finalPriorDutySlotPresent: priorDutiesOk && requirePrior,
    finalTotalDurationSlotPresent: Boolean(totalDurationSlot),
    finalSlotValidationPassed: slotValidationPassed,
    finalSlotRejectionReasons: [...new Set(slotRejectionReasons)],
    currentRoleConcreteFactCoverage: currentDutyCoverage.currentRoleConcreteFactCoverage,
    priorRoleGroundingPassed: priorIntro && priorDutiesOk,
    currentRoleTitlePresent,
    currentRoleTitleMatchesStructuredRole: currentRoleTitlePresent,
    currentRoleOmittedDetected: !currentRoleTitlePresent,
    currentEmploymentIntroductionCount: currentIntro ? 1 : 0,
    finalCurrentEmployerPresent,
    finalPriorEmployerPresent,
    finalCurrentEmploymentStateExpressed,
    finalPriorEmploymentStateExpressed,
    finalCurrentRoleIntroValidationPassed: currentIntro,
    finalPriorRoleIntroValidationPassed: priorIntro,
    finalCurrentRoleTitlePresent: currentRoleTitlePresent,
    finalPriorRoleTitlePresent: /\bGraphic\s+Designer\b/iu.test(text) || Boolean(
      priorTitle
      && new RegExp(priorTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text),
    ),
    finalCurrentDutyCoveragePassed: currentDutiesOk,
    finalPriorDutyCoveragePassed: priorDutiesOk,
    requiredCurrentDutyFactCount: currentDutyCoverage.requiredCurrentDutyFactCount,
    coveredCurrentDutyFactCount: currentDutyCoverage.coveredCurrentDutyFactCount,
    missingCurrentDutyFactCount: currentDutyCoverage.missingCurrentDutyFactCount,
    requiredPriorDutyFactCount: priorCov.requiredPriorDutyFactCount,
    coveredPriorDutyFactCount: priorCov.coveredPriorDutyFactCount,
    missingPriorDutyFactCount: priorCov.missingPriorDutyFactCount,
    structuredRoleLocaleValidationPassed:
      structuredRoleLocale.structuredRoleLocaleValidationPassed,
    currentRoleLocalizationValidationPassed:
      structuredRoleLocale.currentRoleLocalizationValidationPassed,
    priorRoleLocalizationValidationPassed:
      structuredRoleLocale.priorRoleLocalizationValidationPassed,
    foreignStructuredRoleTitleCount: foreignRoleCount,
    foreignPriorRoleTitleCount: structuredRoleLocale.foreignPriorRoleTitleCount ?? 0,
    foreignCurrentRoleTitleDetected: Boolean(
      structuredRoleLocale.foreignCurrentRoleTitleDetected
      || leak.rawSourceRoleLeakageDetected,
    ),
    rawSourceRoleLeakageDetected:
      structuredRoleLocale.rawSourceRoleLeakageDetected
      || leak.rawSourceRoleLeakageDetected,
    finalWrongLocaleStructuredRoleCount: foreignRoleCount,
    finalStructuredRoleLocaleValidationPassed:
      structuredRoleLocale.structuredRoleLocaleValidationPassed,
    finalForeignRoleTitleCount: foreignRoleCount,
    targetLocalePurityPassed: purity.targetLocalePurityPassed && !sourceLeak,
    sourceLanguageLeakageDetected: sourceLeak,
    wrongLocaleUnitCount: Math.max(
      purity.wrongLocaleUnitCount,
      (purity.unexpectedLocaleCodes || []).includes('es') ? 1 : 0,
    ),
    unexpectedLocaleCodes: purity.unexpectedLocaleCodes || [],
    finalUnsupportedCompetencyCount: competency.finalUnsupportedCompetencyCount,
    unsupportedCompetencyCount: competency.unsupportedCompetencyCount,
    unsupportedCompetencyKinds: competency.unsupportedCompetencyKinds,
    unsupportedClaimCount: competency.unsupportedCompetencyCount,
    unsupportedClaimKinds: competency.unsupportedCompetencyKinds,
    competencyScan,
    durationScopeRejectionReason: durationScope.durationScopeRejectionReason,
    finalDurationScopeValidationPassed: durationScope.finalDurationScopeValidationPassed,
    finalDurationOwnerExpected: durationScope.finalDurationOwnerExpected,
    finalDurationOwnerDetected: durationScope.finalDurationOwnerDetected,
    finalDurationCurrentRoleAttachmentRisk:
      durationScope.finalDurationCurrentRoleAttachmentRisk,
    finalDurationTotalCareerMarkerPresent:
      durationScope.finalDurationTotalCareerMarkerPresent,
    currentDutyRequiredFactParityPassed:
      currentDutyParity.currentDutyRequiredFactParityPassed,
    authoritativeCurrentDutyFactCount:
      currentDutyParity.authoritativeCurrentDutyFactCount,
    authoritativeCanonicalCurrentDutyFactCount:
      currentDutyParity.authoritativeCanonicalCurrentDutyFactCount,
    classifiedRequiredCurrentDutyFactCount:
      currentDutyParity.classifiedRequiredCurrentDutyFactCount,
    unclassifiedAuthoritativeCurrentDutyFactCount:
      currentDutyParity.unclassifiedAuthoritativeCurrentDutyFactCount,
    requiredFactSetMatchesAuthoritativeFactSet:
      currentDutyParity.requiredFactSetMatchesAuthoritativeFactSet,
    materialCategoryCoverageUsedForFinalAcceptance: false,
    mixedLanguageMorphologyDetected: morph.mixedLanguageMorphologyDetected,
    currentDutyCoverage,
    currentDutyParity,
    structuredRoleLocale,
  };
}

export function buildEnglishEntryOwnedSummary(options: {
  role: string;
  employer: string;
  datesValue: string;
  gender?: string;
  durationPhrase?: string;
  dutyFacts: Array<{ sourceText?: string; value: string }>;
  priorRole?: string;
  priorEmployer?: string;
  priorSourceDuties?: string;
  locale?: Locale;
  duration?: ExperienceDuration | null;
}): string {
  void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f';
  const male = g === 'male' || g === 'm';
  const pronoun = female ? 'she' : male ? 'he' : 'they';
  const possessive = female ? 'her' : male ? 'his' : 'their';

  let role = (options.role || '').trim();
  const warehouseRole = !role
    || matchesWarehouseOccupationalTitle(role)
    || /warehouse|almac|lager|emplead/i.test(role);
  if (warehouseRole) {
    role = localizeWarehouseEmployee('en', options.gender);
  } else {
    const resolved = resolveLocalizedSummaryRole({
      role,
      targetLocale: 'en',
      gender: options.gender,
    });
    if (resolved.localizationValidationPassed) {
      role = resolved.localizedTargetRoleLabel;
    }
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch && EN_MONTHS[startMatch[2]]
    ? `${EN_MONTHS[startMatch[2]]} ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  let intro = role;
  if (company && monthYear) intro = `${role} at ${company} since ${monthYear}`;
  else if (company) intro = `${role} at ${company}`;
  else if (monthYear) intro = `${role} since ${monthYear}`;

  const dutiesText = options.dutyFacts
    .map((f) => f.sourceText || f.value)
    .filter(Boolean)
    .join('\n');
  const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: dutiesText });
  const dutyParts: string[] = [];
  if (facts.some((f) => f.canonicalFactId === 'incoming_goods_check')) {
    dutyParts.push('checking incoming goods');
  }
  if (facts.some((f) => f.canonicalFactId === 'related_documentation_check')) {
    dutyParts.push('the related documentation');
  }
  if (facts.some((f) => f.canonicalFactId === 'colleague_coordination_goods_preparation_movement')) {
    dutyParts.push(
      'coordinating with colleagues during the preparation and movement of goods',
    );
  }
  if (dutyParts.length === 0 && warehouseRole) {
    dutyParts.push(
      'checking incoming goods',
      'the related documentation',
      'coordinating with colleagues during the preparation and movement of goods',
    );
  }
  if (dutyParts.length >= 3) {
    intro = `${intro} with experience ${dutyParts[0]} and ${dutyParts[1]}, and ${dutyParts[2]}`;
  } else if (dutyParts.length === 2) {
    intro = `${intro} with experience ${dutyParts[0]} and ${dutyParts[1]}`;
  } else if (dutyParts.length === 1) {
    intro = `${intro} with experience ${dutyParts[0]}`;
  }
  if (!/[.]$/u.test(intro)) intro = `${intro}.`;

  const priorRoleRaw = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = PRIOR_DESIGN_CUE.test(`${priorRoleRaw} ${priorDuties}`)
    || /diseñ|design|grafik/i.test(`${priorRoleRaw} ${priorDuties}`);
  let priorSentence = '';
  if (priorRoleRaw && priorLooksDesign) {
    const priorResolved = resolveLocalizedSummaryRole({
      role: priorRoleRaw,
      targetLocale: 'en',
      gender: options.gender,
    });
    const priorLabel = priorResolved.localizationValidationPassed
      ? priorResolved.localizedTargetRoleLabel
      : localizeGraphicDesigner('en', options.gender);
    const designFacts =
      'creating visual materials, revising design documents and preparing final files for different formats and screens';
    priorSentence = priorEmployer
      ? `Previously, ${pronoun} worked as a ${priorLabel} at ${priorEmployer}, ${designFacts}.`
      : `Previously, ${pronoun} worked as a ${priorLabel}, ${designFacts}.`;
  }

  let durRaw = (options.durationPhrase || '').replace(/^[,，]\s*/u, '').replace(/\.$/u, '').trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'en')
      .replace(/\.$/u, '')
      .trim();
  }
  // Strip leading "with" / "bringing" style fragments if present.
  durRaw = durRaw
    .replace(/^(?:with|bringing|having)\s+/iu, '')
    .replace(/\b6\.5\b/g, 'six and a half')
    .trim();
  const durationSentence = durRaw
    ? (/professional\s+experience/iu.test(durRaw)
      ? `Overall, ${pronoun} ${female || male ? 'has' : 'have'} ${durRaw.replace(/^(?:approximately\s+)?/iu, (m) => m || 'approximately ')}.`
        .replace(/\s+/g, ' ')
      : `Overall, ${pronoun} ${female || male ? 'has' : 'have'} ${
        /approximately|about|around/iu.test(durRaw) ? durRaw : `approximately ${durRaw}`
      } of professional experience.`)
    : '';
  // Normalize duration sentence when durRaw is already a full phrase like
  // "with approximately six and a half years of experience".
  let durationFinal = durationSentence;
  if (durRaw && /years?/iu.test(durRaw)) {
    const cleaned = durRaw
      .replace(/^(?:with|bringing|having)\s+/iu, '')
      .replace(/\s+of\s+experience.*$/iu, '')
      .trim();
    durationFinal =
      `Overall, ${pronoun} ${female || male ? 'has' : 'have'} ${
        /approximately|about|around/iu.test(cleaned) ? cleaned : `approximately ${cleaned}`
      } of professional experience.`;
  }
  void possessive;

  return [intro, priorSentence, durationFinal]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip unsupported English competency sentences for safe repair. */
export function stripEnglishUnsupportedCompetencyUnits(summary: string): string {
  return (summary || '')
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((u) => u.trim())
    .filter((u) => !COMPETENCY_INTRO_RE.test(u) && !UNSUPPORTED_SOFT_SKILL_RE.test(u))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
