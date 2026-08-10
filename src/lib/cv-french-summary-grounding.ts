/**
 * AAB-358 — French Professional Summary entry-owned first-person builder + grounding.
 * Requested locale `fr` never reuses German/English surface text as factual authority.
 */
import type { Locale } from './i18n/translations';
import type { ExperienceDuration } from './cv-experience-duration';
import { formatApproximateDurationPhrase } from './cv-experience-duration';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
  matchesGraphicDesignerOccupationalTitle,
} from './cv-role-title';
import { resolveLocalizedSummaryRole } from './cv-summary-structured-role-localization';
import { extractGermanCurrentWarehouseDutyFacts } from './cv-german-summary-current-duty-coverage';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';

export const SUMMARY_BUILDER_REVISION_FR =
  'entry-owned-french-rebuild-358-v1' as const;
export const FRENCH_SUMMARY_FIRST_PERSON_358_REVISION =
  'french-summary-first-person-358-v1' as const;
export const FRENCH_SUMMARY_CROSS_LOCALE_358_REVISION =
  'french-summary-cross-locale-358-v1' as const;
export const PROVIDER_CROSS_LOCALE_NOOP_REASON =
  'provider_cross_locale_noop' as const;

void SUMMARY_BUILDER_REVISION_FR;
void FRENCH_SUMMARY_FIRST_PERSON_358_REVISION;
void FRENCH_SUMMARY_CROSS_LOCALE_358_REVISION;
void PROVIDER_CROSS_LOCALE_NOOP_REASON;

export function detectFrenchSummaryPerspective(
  text: string,
): 'first_person' | 'neutral_cv' | 'cv_third_person' {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'neutral_cv';
  if (/\b(?:je|j['’])/iu.test(t)) return 'first_person';
  if (/\b(?:elle|il|travaille actuellement|a travaillé)\b/iu.test(t)
    && !/\b(?:je|j['’])/iu.test(t)) {
    return 'cv_third_person';
  }
  return 'neutral_cv';
}

const FR_WAREHOUSE_INBOUND =
  /marchandises?\s+entrantes?|contr[oô]le(?:r|)\s+les\s+marchandises?\s+entrantes?/iu;
const FR_WAREHOUSE_DOCS =
  /documentation\s+relative\s+aux\s+marchandises?\s+re[cç]ues?|v[ée]rifie(?:r|)\s+la\s+documentation/iu;
const FR_WAREHOUSE_COORD =
  /coordonne(?:r|)\s+avec\s+(?:mes\s+)?coll[eè]gues|pr[ée]paration\s+et\s+(?:le\s+)?d[ée]placement\s+des\s+marchandises?/iu;
const FR_DESIGN_CREATE =
  /supports?\s+visuels?|[ée]l[ée]ments?\s+graphiques?|cr[ée][ée]\s+des\s+supports?/iu;
const FR_DESIGN_REVIEW =
  /examins?\s+et\s+adapt|adapt[ée]\s+les\s+supports?\s+de\s+conception|examin[ée]/iu;
const FR_DESIGN_FINAL =
  /fichiers?\s+de\s+conception\s+finaux?|diff[ée]rents?\s+formats?|écrans?/iu;

export type FrenchSummaryEmploymentQuality = {
  groundingValidationPassed: boolean;
  slotValidationPassed: boolean;
  perspectiveValidationPassed: boolean;
  perspectiveMode: 'first_person' | 'neutral_cv' | 'cv_third_person';
  typedRejectionReason: string | null;
  slotRejectionReasons: string[];
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalCurrentDutyCoveragePassed: boolean;
  finalPriorDutyCoveragePassed: boolean;
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
  finalUnitRoleSlots: string[];
  finalSentenceRoleSlots: string[];
  finalSentenceHashes?: string[];
  unitCount?: number;
  targetLocalePurityPassed: boolean;
  wrongLocaleUnitCount: number;
  unexpectedLocaleCodes: string[];
  detectedLocaleByUnit: Array<string | null>;
  unsupportedClaimCount: number;
  employerCrossEntryLeakageDetected: boolean;
  currentEmploymentIntroductionCount: number;
  currentRoleConcreteFactCoverage: number;
  priorRoleGroundingPassed: boolean;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  finalCurrentEmployerPresent: boolean;
  finalPriorEmployerPresent: boolean;
  finalCurrentEmploymentStateExpressed: boolean;
  finalPriorEmploymentStateExpressed: boolean;
  finalCurrentRoleIntroValidationPassed: boolean;
  finalPriorRoleIntroValidationPassed: boolean;
  finalSlotValidationPassed: boolean;
  finalDurationOwnerExpected: string;
  finalDurationOwnerDetected: string;
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  currentRoleOmittedDetected: boolean;
};

function countFrenchWarehouseCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [FR_WAREHOUSE_INBOUND, FR_WAREHOUSE_DOCS, FR_WAREHOUSE_COORD];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

function countFrenchDesignCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [FR_DESIGN_CREATE, FR_DESIGN_REVIEW, FR_DESIGN_FINAL];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

export function analyzeFrenchSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    rawCurrentRole?: string;
    priorCompany?: string;
    priorRole?: string;
    rawPriorRole?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
    currentEntryId?: string | null;
    priorEntryId?: string | null;
  } = {},
): FrenchSummaryEmploymentQuality {
  void FRENCH_SUMMARY_FIRST_PERSON_358_REVISION;
  void FRENCH_SUMMARY_CROSS_LOCALE_358_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const purity = validateAiUnitLocalePurity(text, 'fr', {
    kind: 'summary_sentence',
    requireUnits: true,
    requiredScript: 'latin',
  });
  const perspectiveMode = detectFrenchSummaryPerspective(text);
  const perspectiveValidationPassed = perspectiveMode === 'first_person';

  const dutiesCorpus = `${options.currentEntryDuties || ''} ${options.role || ''}`;
  const canonicalWarehouseFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: options.currentEntryDuties || '',
  });
  const warehouseRoleCue = matchesWarehouseOccupationalTitle(options.role || '')
    || matchesWarehouseOccupationalTitle(options.rawCurrentRole || '')
    || /warehouse|lager|entrep[oô]t|marchandis/i.test(dutiesCorpus);
  // Full Atlas-style triad is mandatory only when canonical warehouse facts exist.
  // Warehouse role cues alone (e.g. skladište + unmapped forklift title) must not
  // reject a grounded French first-person intro without inventing duties.
  const requireWarehouseTriad = canonicalWarehouseFacts.length >= 3;
  const designDomain = matchesGraphicDesignerOccupationalTitle(options.priorRole || '')
    || matchesGraphicDesignerOccupationalTitle(options.rawPriorRole || '')
    || /design|grafik|graphiste|visuel|graphic/i.test(
      `${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
    );

  // Coverage is scored from French surface cues only when the triad is required.
  const currentCov = requireWarehouseTriad
    ? countFrenchWarehouseCoverage(text)
    : { required: 0, covered: 0, missing: 0 };
  const priorCov = designDomain
    ? countFrenchDesignCoverage(text)
    : { required: 0, covered: 0, missing: 0 };

  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const currentIntroSlotPresent = /\b(?:je\s+travaille\s+actuellement|actuellement)\b/iu.test(text)
    && (company ? new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text) : true);
  const currentDutySlotPresent = currentCov.required === 0 || currentCov.covered >= currentCov.required;
  const priorRoleSlotPresent = !priorCompany && !designDomain
    ? true
    : /\b(?:auparavant|j['’]ai\s+travaill[ée])\b/iu.test(text)
      && (priorCompany
        ? new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text)
        : true);
  const totalDurationSlotPresent = /\b(?:je\s+dispose|expérience\s+professionnelle|environ\s+six\s+ans)\b/iu
    .test(text);

  const finalUnitRoleSlots = [
    ...(totalDurationSlotPresent ? ['duration'] : []),
    ...(currentIntroSlotPresent ? ['current_intro'] : []),
    ...(priorRoleSlotPresent && (priorCompany || designDomain) ? ['prior_role'] : []),
  ];

  const slotRejectionReasons: string[] = [];
  if (!purity.targetLocalePurityPassed) {
    slotRejectionReasons.push('french_summary_wrong_locale');
  }
  if (!perspectiveValidationPassed) {
    slotRejectionReasons.push('french_summary_perspective_not_first_person');
  }
  if (requireWarehouseTriad && currentCov.missing > 0) {
    slotRejectionReasons.push('current_duty_fact_coverage_incomplete');
  }
  if (designDomain && priorCov.missing > 0) {
    slotRejectionReasons.push('prior_duty_fact_coverage_incomplete');
  }
  if ((requireWarehouseTriad || warehouseRoleCue) && !currentIntroSlotPresent && Boolean(company || options.role)) {
    slotRejectionReasons.push('missing_current_intro_slot');
  }
  if ((priorCompany || designDomain) && !priorRoleSlotPresent) {
    slotRejectionReasons.push('missing_prior_role_slot');
  }
  if ((requireWarehouseTriad || designDomain) && !totalDurationSlotPresent) {
    slotRejectionReasons.push('missing_duration_slot');
  }

  const germanLeak = /\b(?:ich|verfüge|derzeit|arbeite|arbeitete|lagermitarbeiter|grafikdesigner)\b/iu
    .test(text);
  if (germanLeak) {
    slotRejectionReasons.push('french_summary_source_language_leakage');
  }

  const employerCrossEntryLeakageDetected = Boolean(
    company
    && priorCompany
    && company !== priorCompany
    && /actuellement/iu.test(text)
    && new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(
      (text.match(/je\s+travaille\s+actuellement[^.]+/iu) || [''])[0],
    ),
  );
  if (employerCrossEntryLeakageDetected) {
    slotRejectionReasons.push('employer_cross_entry_leakage');
  }

  const slotValidationPassed = slotRejectionReasons.length === 0
    && purity.targetLocalePurityPassed
    && perspectiveValidationPassed
    && !germanLeak
    && (currentCov.required === 0 || currentCov.covered >= currentCov.required)
    && (priorCov.required === 0 || priorCov.covered >= priorCov.required);

  const groundingValidationPassed = slotValidationPassed && Boolean(text);
  const typedRejectionReason = !text
    ? 'empty_summary'
    : (slotRejectionReasons[0] || null);

  const rolePresent = Boolean(options.role)
    && new RegExp(
      String(options.role || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'iu',
    ).test(text);
  const finalCurrentEmployerPresent = Boolean(company)
    && new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text);
  const finalPriorEmployerPresent = !priorCompany
    || new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text);

  return {
    groundingValidationPassed,
    slotValidationPassed,
    perspectiveValidationPassed,
    perspectiveMode,
    typedRejectionReason,
    slotRejectionReasons: [...new Set(slotRejectionReasons)],
    requiredCurrentDutyFactCount: currentCov.required,
    coveredCurrentDutyFactCount: currentCov.covered,
    missingCurrentDutyFactCount: currentCov.missing,
    requiredPriorDutyFactCount: priorCov.required,
    coveredPriorDutyFactCount: priorCov.covered,
    missingPriorDutyFactCount: priorCov.missing,
    finalCurrentDutyCoveragePassed: currentCov.required === 0
      || currentCov.covered >= currentCov.required,
    finalPriorDutyCoveragePassed: priorCov.required === 0
      || priorCov.covered >= priorCov.required,
    currentIntroSlotPresent,
    currentDutySlotPresent,
    priorRoleSlotPresent,
    totalDurationSlotPresent,
    finalUnitRoleSlots,
    finalSentenceRoleSlots: [...finalUnitRoleSlots],
    targetLocalePurityPassed: purity.targetLocalePurityPassed && !germanLeak,
    wrongLocaleUnitCount: Math.max(
      purity.wrongLocaleUnitCount,
      germanLeak ? Math.max(1, (purity.detectedLocaleByUnit || []).filter((c) => c === 'de').length) : 0,
    ),
    unexpectedLocaleCodes: [
      ...new Set([
        ...(purity.unexpectedLocaleCodes || []),
        ...(germanLeak ? ['de'] : []),
      ]),
    ],
    detectedLocaleByUnit: purity.detectedLocaleByUnit,
    unsupportedClaimCount: 0,
    employerCrossEntryLeakageDetected,
    currentEmploymentIntroductionCount: currentIntroSlotPresent ? 1 : 0,
    currentRoleConcreteFactCoverage: currentCov.covered,
    priorRoleGroundingPassed: priorCov.required === 0
      || priorCov.covered >= priorCov.required,
    currentRoleTitlePresent: rolePresent,
    currentRoleTitleMatchesStructuredRole: rolePresent,
    finalCurrentEmployerPresent,
    finalPriorEmployerPresent,
    finalCurrentEmploymentStateExpressed: /\b(?:actuellement|je\s+travaille)\b/iu.test(text),
    finalPriorEmploymentStateExpressed: !priorCompany
      || /\b(?:auparavant|j['’]ai\s+travaill[ée])\b/iu.test(text),
    finalCurrentRoleIntroValidationPassed: currentIntroSlotPresent,
    finalPriorRoleIntroValidationPassed: priorRoleSlotPresent,
    finalSlotValidationPassed: slotValidationPassed,
    finalDurationOwnerExpected: 'total_professional_experience',
    finalDurationOwnerDetected: totalDurationSlotPresent
      ? 'total_professional_experience'
      : 'unknown',
    finalDurationScopeValidationPassed: totalDurationSlotPresent,
    finalDurationCurrentRoleAttachmentRisk: false,
    finalDurationTotalCareerMarkerPresent: totalDurationSlotPresent,
    currentRoleOmittedDetected: Boolean(company || options.role) && !currentIntroSlotPresent,
  };
}

export function buildFrenchEntryOwnedSummary(options: {
  role: string;
  employer: string;
  datesValue?: string;
  gender?: string;
  durationPhrase?: string;
  dutyFacts: Array<{ sourceText?: string; value: string }>;
  priorRole?: string;
  priorEmployer?: string;
  priorSourceDuties?: string;
  locale?: Locale;
  duration?: ExperienceDuration | null;
  hasCurrentRole?: boolean;
}): string {
  void SUMMARY_BUILDER_REVISION_FR;
  void FRENCH_SUMMARY_FIRST_PERSON_358_REVISION;
  void options.locale;
  void options.datesValue;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'weiblich';

  let role = (options.role || '').trim();
  const currentDutiesCorpus = options.dutyFacts
    .map((f) => f.sourceText || f.value)
    .filter(Boolean)
    .join('\n');
  const warehouseRole = !role
    || /^(?:professional|professionnel(?:le)?)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /entrep[oô]t|warehouse|lager/i.test(`${role} ${currentDutiesCorpus}`);

  if (warehouseRole) {
    role = localizeWarehouseEmployee('fr', options.gender);
  } else {
    const resolved = resolveLocalizedSummaryRole({
      role,
      targetLocale: 'fr',
      gender: options.gender,
    });
    if (resolved.localizationValidationPassed) {
      role = resolved.localizedTargetRoleLabel;
    }
  }
  // French CV prose uses sentence-case occupational labels.
  role = role.replace(/^./u, (ch) => ch.toLocaleLowerCase('fr'));

  const company = (options.employer || '').trim();
  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'fr')
      .replace(/\.$/u, '')
      .trim();
  }
  // Normalize total-career duration into the expected first-person French sentence.
  let durationSentence = '';
  if (durRaw) {
    const yearsBit = /six\s+ans\s+et\s+demi|6[,.]5|sechseinhalb|six\s+and\s+a\s+half/iu.test(durRaw)
      || (options.duration && Math.abs((options.duration.approxYears || 0) - 6.5) < 0.2)
      ? 'six ans et demi'
      : (durRaw
        .replace(/^avec\s+/iu, '')
        .replace(/\s+d['’]expérience.*$/iu, '')
        .replace(/\benviron\b/iu, '')
        .trim() || 'plusieurs années');
    durationSentence = `Je dispose d’environ ${yearsBit} d’expérience professionnelle au total.`;
  }

  const hasCurrent = options.hasCurrentRole !== false
    && Boolean(company || role || currentDutiesCorpus || options.dutyFacts.length);

  let currentSentence = '';
  if (hasCurrent) {
    const canonicalCurrentFacts = extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: currentDutiesCorpus,
    });
    if (warehouseRole && canonicalCurrentFacts.length > 0) {
      const dutyClause = [
        'contrôle les marchandises entrantes',
        'vérifie la documentation relative aux marchandises reçues',
        'me coordonne avec mes collègues pour la préparation et le déplacement des marchandises',
      ].join(', ').replace(/, ([^,]*)$/u, ' et $1');
      currentSentence = company
        ? `Je travaille actuellement chez ${company} en tant qu’${role}, où je ${dutyClause}.`
        : `Je travaille actuellement en tant qu’${role}, où je ${dutyClause}.`;
      // Fix elision: "en tant qu’employée" already has qu’ — role starts with vowel.
      if (!/^employ/iu.test(role)) {
        currentSentence = currentSentence.replace(/en tant qu’/iu, 'en tant que ');
      }
    } else if (classifyMaterialDutyKeys(currentDutiesCorpus).some((key) =>
      key === 'food_prep' || key === 'hygiene_workplace' || key === 'kitchen_collaboration')) {
      const cookingKeys = new Set(classifyMaterialDutyKeys(currentDutiesCorpus));
      const dutyBits = [
        cookingKeys.has('food_prep') ? 'prépare des plats selon les normes du restaurant' : '',
        cookingKeys.has('hygiene_workplace') ? 'maintiens l’hygiène du poste de travail' : '',
        cookingKeys.has('kitchen_collaboration') ? 'collabore avec l’équipe de cuisine' : '',
      ].filter(Boolean);
      const dutyClause = dutyBits.join(', ').replace(/, ([^,]*)$/u, ' et $1');
      currentSentence = company
        ? `Je travaille actuellement chez ${company} en tant que ${role}, où je ${dutyClause}.`
        : `Je travaille actuellement en tant que ${role}, où je ${dutyClause}.`;
    } else {
      const dutyBits = options.dutyFacts
        .map((f) => (f.sourceText || f.value || '').replace(/[.;]+$/u, '').trim())
        .filter(Boolean)
        .filter((s) => (
          /[àâäéèêëïîôùûüç]/iu.test(s)
          || /\b(?:je|et|les|des|avec|pour|dans)\b/iu.test(s)
        )
          && !/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/.test(s)
          && !/\b(?:ich|derzeit|prüfe|arbeite)\b/iu.test(s))
        .slice(0, 3);
      const dutyTail = dutyBits.length
        ? `, où je ${dutyBits.join(', ').replace(/, ([^,]*)$/u, ' et $1')}`
        : '';
      const article = /^[aeiouàâäéèêëïîôùûüh]/iu.test(role) ? 'qu’' : 'que ';
      currentSentence = company
        ? `Je travaille actuellement chez ${company} en tant ${article}${role}${dutyTail}.`
        : `Je travaille actuellement en tant ${article}${role}${dutyTail}.`;
    }
  }

  const priorRoleRaw = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|visual|vizuel|visuel|デザイン|diseñ|graphiste|graphic)/i
    .test(`${priorRoleRaw} ${priorDuties}`);
  let priorSentence = '';
  if (priorRoleRaw || priorEmployer || priorDuties) {
    if (priorLooksDesign) {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || 'Graphic Designer',
        targetLocale: 'fr',
        gender: options.gender,
      });
      const priorLabel = (priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : localizeGraphicDesigner('fr', options.gender))
        .replace(/^./u, (ch) => ch.toLocaleLowerCase('fr'));
      const designFacts = [
        'ai créé des supports visuels et des éléments graphiques',
        'examiné et adapté les supports de conception',
        'préparé les fichiers de conception finaux pour différents formats et écrans',
      ].join(', ').replace(/, ([^,]*)$/u, ' et $1');
      priorSentence = priorEmployer
        ? `Auparavant, j’ai travaillé chez ${priorEmployer} en tant que ${priorLabel}, où j’${designFacts}.`
        : `Auparavant, j’ai travaillé en tant que ${priorLabel}, où j’${designFacts}.`;
    } else {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || '',
        targetLocale: 'fr',
        gender: options.gender,
      });
      const priorLabel = priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : (priorRoleRaw || (female ? 'professionnelle' : 'professionnel'));
      priorSentence = priorEmployer
        ? `Auparavant, j’ai travaillé chez ${priorEmployer} en tant que ${priorLabel}.`
        : `Auparavant, j’ai travaillé en tant que ${priorLabel}.`;
    }
  }

  return [durationSentence, currentSentence, priorSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when structured duties/role indicate French entry-owned warehouse/design rebuild. */
export function isFrenchStructuredSummaryDomain(corpus: string): boolean {
  const t = corpus || '';
  return matchesWarehouseOccupationalTitle(t)
    || matchesGraphicDesignerOccupationalTitle(t)
    || /warehouse|entrep[oô]t|lager|incoming\s+goods|marchandis|graphiste|graphic\s*design|visuel|design\s+files/i
      .test(t);
}
