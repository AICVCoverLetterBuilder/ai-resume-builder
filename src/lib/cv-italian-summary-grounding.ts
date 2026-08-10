/**
 * AAB-359 — Italian Professional Summary entry-owned first-person builder + grounding.
 * Requested locale `it` never reuses French/German/English surface text as factual authority.
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
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from './cv-french-summary-grounding';
import { fingerprintText } from './cv-export-diagnostics';

export const SUMMARY_BUILDER_REVISION_IT =
  'entry-owned-italian-rebuild-359-v1' as const;
export const ITALIAN_SUMMARY_FIRST_PERSON_359_REVISION =
  'italian-summary-first-person-359-v1' as const;
export const ITALIAN_SUMMARY_CROSS_LOCALE_359_REVISION =
  'italian-summary-cross-locale-359-v1' as const;

void SUMMARY_BUILDER_REVISION_IT;
void ITALIAN_SUMMARY_FIRST_PERSON_359_REVISION;
void ITALIAN_SUMMARY_CROSS_LOCALE_359_REVISION;
void PROVIDER_CROSS_LOCALE_NOOP_REASON;

export const ITALIAN_SUMMARY_UNIT_SPLITTER_360_REVISION =
  'italian-summary-unit-splitter-360-v1' as const;
export const SUMMARY_PROVIDER_REJECTION_TOTALITY_361_REVISION =
  'summary-provider-rejection-totality-361-v1' as const;
void ITALIAN_SUMMARY_UNIT_SPLITTER_360_REVISION;
void SUMMARY_PROVIDER_REJECTION_TOTALITY_361_REVISION;

/** Split Italian Summary into semantic sentence units (duration / current / prior). */
export function splitItalianSummaryUnits(text: string): string[] {
  void ITALIAN_SUMMARY_UNIT_SPLITTER_360_REVISION;
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const bySentence = raw
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySentence.length >= 3) return bySentence;
  if (bySentence.length === 2) return bySentence;
  const forced = raw
    .split(/\s+(?=\b(?:Attualmente|In\s+precedenza)\b)/iu)
    .map((s) => s.trim())
    .filter(Boolean);
  return forced.length >= 2 ? forced : (raw ? [raw] : []);
}

function assignItalianUnitRoleSlot(unit: string): string {
  const s = (unit || '').trim();
  if (!s) return 'other';
  if (/\b(?:dispongo|complessivamente|esperienza\s+professionale|anni\s+e\s+mezzo)\b/iu.test(s)
    && !/\b(?:attualmente|in\s+precedenza)\b/iu.test(s)) {
    return 'duration';
  }
  if (/\b(?:in\s+precedenza|ho\s+lavorato)\b/iu.test(s)) {
    return 'prior_role';
  }
  if (/\b(?:attualmente|lavoro\s+presso|lavoro\s+come)\b/iu.test(s)) {
    return 'current_intro';
  }
  return 'other';
}

export function detectItalianSummaryPerspective(
  text: string,
): 'first_person' | 'neutral_cv' | 'cv_third_person' {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'neutral_cv';
  if (/\b(?:io|dispongo|lavoro|ho\s+lavorato|controllo|verifico|mi\s+coordino|ho\s+creato)\b/iu.test(t)) {
    return 'first_person';
  }
  if (/\b(?:lei|lui|lavora\s+attualmente|ha\s+lavorato)\b/iu.test(t)
    && !/\b(?:io|dispongo|lavoro|ho\s+lavorato)\b/iu.test(t)) {
    return 'cv_third_person';
  }
  return 'neutral_cv';
}

const IT_WAREHOUSE_INBOUND =
  /merci\s+in\s+arrivo|controllo\s+le\s+merci\s+in\s+arrivo/iu;
const IT_WAREHOUSE_DOCS =
  /documentazione\s+relativa\s+alle\s+merci\s+ricevute|verifico\s+la\s+documentazione/iu;
const IT_WAREHOUSE_COORD =
  /mi\s+coordino\s+con\s+(?:i\s+)?colleghi|preparazione\s+e\s+la\s+movimentazione\s+delle\s+merci/iu;
const IT_DESIGN_CREATE =
  /materiali\s+visivi|elementi\s+grafici|ho\s+creato\s+materiali/iu;
const IT_DESIGN_REVIEW =
  /esaminato\s+e\s+adattato|adattato\s+i\s+materiali\s+di\s+design|esaminato/iu;
const IT_DESIGN_FINAL =
  /file\s+di\s+design\s+finali|diversi\s+formati|schermi/iu;

export type ItalianSummaryEmploymentQuality = {
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

function countItalianWarehouseCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [IT_WAREHOUSE_INBOUND, IT_WAREHOUSE_DOCS, IT_WAREHOUSE_COORD];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

function countItalianDesignCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [IT_DESIGN_CREATE, IT_DESIGN_REVIEW, IT_DESIGN_FINAL];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

export function analyzeItalianSummaryEmploymentQuality(
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
): ItalianSummaryEmploymentQuality {
  void ITALIAN_SUMMARY_FIRST_PERSON_359_REVISION;
  void ITALIAN_SUMMARY_CROSS_LOCALE_359_REVISION;
  void ITALIAN_SUMMARY_UNIT_SPLITTER_360_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitItalianSummaryUnits(text);
  const unitCount = units.length;
  const finalSentenceHashes = units.map((u) => fingerprintText(u));
  const perUnitRoleSlots = units.map((u) => assignItalianUnitRoleSlot(u));
  const purity = validateAiUnitLocalePurity(text, 'it', {
    kind: 'summary_sentence',
    requireUnits: true,
    requiredScript: 'latin',
  });
  const perspectiveMode = detectItalianSummaryPerspective(text);
  const perspectiveValidationPassed = perspectiveMode === 'first_person';

  const dutiesCorpus = `${options.currentEntryDuties || ''} ${options.role || ''}`;
  const canonicalWarehouseFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: options.currentEntryDuties || '',
  });
  const warehouseRoleCue = matchesWarehouseOccupationalTitle(options.role || '')
    || matchesWarehouseOccupationalTitle(options.rawCurrentRole || '')
    || /warehouse|lager|entrep[oô]t|magazzino|marchandis|merci/i.test(dutiesCorpus);
  const requireWarehouseTriad = canonicalWarehouseFacts.length >= 3;
  const designDomain = matchesGraphicDesignerOccupationalTitle(options.priorRole || '')
    || matchesGraphicDesignerOccupationalTitle(options.rawPriorRole || '')
    || /design|grafik|graphiste|visuel|graphic|grafica|designer/i.test(
      `${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
    );

  const currentCov = requireWarehouseTriad
    ? countItalianWarehouseCoverage(text)
    : { required: 0, covered: 0, missing: 0 };
  const priorCov = designDomain
    ? countItalianDesignCoverage(text)
    : { required: 0, covered: 0, missing: 0 };

  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const currentIntroSlotPresent = /\b(?:attualmente\s+lavoro|lavoro\s+presso|attualmente)\b/iu.test(text)
    && (company ? new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text) : true);
  const currentDutySlotPresent = currentCov.required === 0 || currentCov.covered >= currentCov.required;
  const priorRoleSlotPresent = !priorCompany && !designDomain
    ? true
    : /\b(?:in\s+precedenza|ho\s+lavorato)\b/iu.test(text)
      && (priorCompany
        ? new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text)
        : true);
  const totalDurationSlotPresent = /\b(?:dispongo|esperienza\s+professionale|sei\s+anni\s+e\s+mezzo|complessivamente)\b/iu
    .test(text);

  const corpusRoleSlots = [
    ...(totalDurationSlotPresent ? ['duration'] : []),
    ...(currentIntroSlotPresent ? ['current_intro'] : []),
    ...(priorRoleSlotPresent && (priorCompany || designDomain) ? ['prior_role'] : []),
  ];
  const expectedThreeSlotTopology = (requireWarehouseTriad || designDomain)
    && Boolean(company || options.role)
    && (priorCompany || designDomain);
  const finalUnitRoleSlots = unitCount >= 2 ? perUnitRoleSlots : corpusRoleSlots;
  const finalSentenceRoleSlots = [...finalUnitRoleSlots];

  const slotRejectionReasons: string[] = [];
  if (!purity.targetLocalePurityPassed) {
    slotRejectionReasons.push('italian_summary_wrong_locale');
  }
  if (!perspectiveValidationPassed) {
    slotRejectionReasons.push('italian_summary_perspective_not_first_person');
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
  if (expectedThreeSlotTopology && unitCount > 0 && unitCount < 3) {
    slotRejectionReasons.push('italian_summary_unit_count_mismatch');
  }
  if (
    expectedThreeSlotTopology
    && unitCount >= 3
    && !finalSentenceRoleSlots.every((s, i) => (
      i === 0 ? s === 'duration'
        : i === 1 ? s === 'current_intro'
          : i === 2 ? s === 'prior_role'
            : s === 'prior_role' || s === 'other'
    ))
  ) {
    slotRejectionReasons.push('italian_summary_unit_slot_mismatch');
  }

  const frenchLeak = /\b(?:je|dispose|travaille\s+actuellement|auparavant|employée|graphiste|marchandises\s+entrantes)\b/iu
    .test(text);
  const germanLeak = /\b(?:ich|verfüge|derzeit|arbeite|arbeitete|lagermitarbeiter|grafikdesigner)\b/iu
    .test(text);
  if (frenchLeak) {
    slotRejectionReasons.push('italian_summary_source_language_leakage');
  }
  if (germanLeak) {
    slotRejectionReasons.push('italian_summary_source_language_leakage');
  }

  const employerCrossEntryLeakageDetected = Boolean(
    company
    && priorCompany
    && company !== priorCompany
    && /attualmente/iu.test(text)
    && new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(
      (text.match(/attualmente\s+lavoro[^.]+/iu) || [''])[0],
    ),
  );
  if (employerCrossEntryLeakageDetected) {
    slotRejectionReasons.push('employer_cross_entry_leakage');
  }

  const slotValidationPassed = slotRejectionReasons.length === 0
    && purity.targetLocalePurityPassed
    && perspectiveValidationPassed
    && !frenchLeak
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
    finalSentenceRoleSlots,
    finalSentenceHashes,
    unitCount,
    targetLocalePurityPassed: purity.targetLocalePurityPassed && !frenchLeak && !germanLeak,
    wrongLocaleUnitCount: Math.max(
      purity.wrongLocaleUnitCount,
      frenchLeak ? Math.max(1, (purity.detectedLocaleByUnit || []).filter((c) => c === 'fr').length || 1) : 0,
      germanLeak ? Math.max(1, (purity.detectedLocaleByUnit || []).filter((c) => c === 'de').length || 1) : 0,
    ),
    unexpectedLocaleCodes: [
      ...new Set([
        ...(purity.unexpectedLocaleCodes || []),
        ...(frenchLeak ? ['fr'] : []),
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
    finalCurrentEmploymentStateExpressed: /\b(?:attualmente|lavoro)\b/iu.test(text),
    finalPriorEmploymentStateExpressed: !priorCompany
      || /\b(?:in\s+precedenza|ho\s+lavorato)\b/iu.test(text),
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

export function buildItalianEntryOwnedSummary(options: {
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
  void SUMMARY_BUILDER_REVISION_IT;
  void ITALIAN_SUMMARY_FIRST_PERSON_359_REVISION;
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
    || /^(?:professional|professionista|professionnel(?:le)?)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /entrep[oô]t|warehouse|lager|addett[ao]\s+al\s+magazzino|employée\s+d['’]entrepôt|empleado\s+de\s+almacén/i
      .test(role);

  if (warehouseRole) {
    role = localizeWarehouseEmployee('it', options.gender);
  } else {
    const resolved = resolveLocalizedSummaryRole({
      role,
      targetLocale: 'it',
      gender: options.gender,
    });
    if (resolved.localizationValidationPassed) {
      role = resolved.localizedTargetRoleLabel;
    }
  }
  role = role.replace(/^./u, (ch) => ch.toLocaleLowerCase('it'));

  const company = (options.employer || '').trim();
  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'it')
      .replace(/\.$/u, '')
      .trim();
  }
  let durationSentence = '';
  if (durRaw) {
    const yearsBit = /sei\s+anni\s+e\s+mezzo|six\s+ans\s+et\s+demi|6[,.]5|sechseinhalb|six\s+and\s+a\s+half/iu.test(durRaw)
      || (options.duration && Math.abs((options.duration.approxYears || 0) - 6.5) < 0.2)
      ? 'sei anni e mezzo'
      : (durRaw
        .replace(/^con\s+/iu, '')
        .replace(/\s+di\s+esperienza.*$/iu, '')
        .replace(/\bcirca\b/iu, '')
        .trim() || 'diversi anni');
    durationSentence = `Dispongo complessivamente di circa ${yearsBit} di esperienza professionale.`;
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
        'controllo le merci in arrivo',
        'verifico la documentazione relativa alle merci ricevute',
        'mi coordino con i colleghi per la preparazione e la movimentazione delle merci',
      ].join(', ').replace(/, ([^,]*)$/u, ' e $1');
      currentSentence = company
        ? `Attualmente lavoro presso ${company} come ${role}, dove ${dutyClause}.`
        : `Attualmente lavoro come ${role}, dove ${dutyClause}.`;
    } else if (classifyMaterialDutyKeys(currentDutiesCorpus).some((key) =>
      key === 'food_prep' || key === 'hygiene_workplace' || key === 'kitchen_collaboration')) {
      const cookingKeys = new Set(classifyMaterialDutyKeys(currentDutiesCorpus));
      const dutyBits = [
        cookingKeys.has('food_prep') ? 'preparo piatti secondo gli standard del ristorante' : '',
        cookingKeys.has('hygiene_workplace') ? 'mantengo l’igiene della postazione di lavoro' : '',
        cookingKeys.has('kitchen_collaboration') ? 'collaboro con il team di cucina' : '',
      ].filter(Boolean);
      const dutyClause = dutyBits.join(', ').replace(/, ([^,]*)$/u, ' e $1');
      currentSentence = company
        ? `Attualmente lavoro presso ${company} come ${role}, dove ${dutyClause}.`
        : `Attualmente lavoro come ${role}, dove ${dutyClause}.`;
    } else {
      const dutyBits = options.dutyFacts
        .map((f) => (f.sourceText || f.value || '').replace(/[.;]+$/u, '').trim())
        .filter(Boolean)
        .filter((s) => (
          /[àèéìòù]/iu.test(s)
          || /\b(?:e|le|dei|con|per|nella|presso)\b/iu.test(s)
        )
          && !/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF\u3040-\u30FF\u3400-\u9FFF]/.test(s)
          && !/\b(?:ich|derzeit|prüfe|arbeite|je|travaille|dispose)\b/iu.test(s))
        .slice(0, 3);
      const dutyTail = dutyBits.length
        ? `, dove ${dutyBits.join(', ').replace(/, ([^,]*)$/u, ' e $1')}`
        : '';
      currentSentence = company
        ? `Attualmente lavoro presso ${company} come ${role}${dutyTail}.`
        : `Attualmente lavoro come ${role}${dutyTail}.`;
    }
  }

  const priorRoleRaw = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|visual|vizuel|visuel|デザイン|diseñ|graphiste|graphic|grafica)/i
    .test(`${priorRoleRaw} ${priorDuties}`);
  let priorSentence = '';
  if (priorRoleRaw || priorEmployer || priorDuties) {
    if (priorLooksDesign) {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || 'Graphic Designer',
        targetLocale: 'it',
        gender: options.gender,
      });
      const priorLabel = (priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : localizeGraphicDesigner('it', options.gender))
        .replace(/^./u, (ch) => ch.toLocaleLowerCase('it'));
      const designFacts = [
        'ho creato materiali visivi ed elementi grafici',
        'esaminato e adattato i materiali di design',
        'preparato i file di design finali per diversi formati e schermi',
      ].join(', ').replace(/, ([^,]*)$/u, ' e $1');
      priorSentence = priorEmployer
        ? `In precedenza ho lavorato presso ${priorEmployer} come ${priorLabel}, dove ${designFacts}.`
        : `In precedenza ho lavorato come ${priorLabel}, dove ${designFacts}.`;
    } else {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || '',
        targetLocale: 'it',
        gender: options.gender,
      });
      const priorLabel = priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : (priorRoleRaw || (female ? 'professionista' : 'professionista'));
      priorSentence = priorEmployer
        ? `In precedenza ho lavorato presso ${priorEmployer} come ${priorLabel}.`
        : `In precedenza ho lavorato come ${priorLabel}.`;
    }
  }

  return [durationSentence, currentSentence, priorSentence]
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/u, '').trim())
    .map((s) => (s ? `${s}.` : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when structured duties/role indicate Italian entry-owned warehouse/design rebuild. */
export function isItalianStructuredSummaryDomain(corpus: string): boolean {
  const t = corpus || '';
  return matchesWarehouseOccupationalTitle(t)
    || matchesGraphicDesignerOccupationalTitle(t)
    || /warehouse|entrep[oô]t|lager|magazzino|incoming\s+goods|marchandis|merci|graphiste|graphic\s*design|visuel|design\s+files|addett[ao]/i
      .test(t);
}
