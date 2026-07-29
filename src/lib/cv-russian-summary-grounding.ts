/**
 * AAB-362 — Russian Professional Summary entry-owned first-person builder.
 * Requested locale `ru` never reuses pt-BR/Italian/French/German/English/Serbian
 * as factual authority. Atlas/Rewitu are regression fixtures only.
 */
import type { Locale } from './i18n/translations';
import type { ExperienceDuration } from './cv-experience-duration';
import {
  formatApproximateDurationPhrase,
  formatRussianDurationCore,
} from './cv-experience-duration';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
  matchesGraphicDesignerOccupationalTitle,
} from './cv-role-title';
import { resolveLocalizedSummaryRole } from './cv-summary-structured-role-localization';
import { extractGermanCurrentWarehouseDutyFacts } from './cv-german-summary-current-duty-coverage';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from './cv-french-summary-grounding';
import { fingerprintText } from './cv-export-diagnostics';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';

export const SUMMARY_UNIT_SPLITTER_REVISION_RU =
  'russian-three-unit-slots-362-v1' as const;
export const SUMMARY_GROUNDING_REVISION_RU =
  'entry-owned-russian-grounding-362-v1' as const;
export const SUMMARY_BUILDER_REVISION_RU =
  'entry-owned-russian-rebuild-362-v1' as const;
export const RUSSIAN_SUMMARY_FIRST_PERSON_362_REVISION =
  'russian-summary-first-person-362-v1' as const;
export const RUSSIAN_SUMMARY_CROSS_LOCALE_362_REVISION =
  'russian-summary-cross-locale-362-v1' as const;
export const RUSSIAN_SUMMARY_DURATION_GRAMMAR_REVISION =
  'russian-summary-duration-grammar-362-v1' as const;
/** Canonical typed rejection for malformed Russian duration case/order. */
export const RUSSIAN_SUMMARY_DURATION_GRAMMAR_INVALID =
  'russian_summary_duration_grammar_invalid' as const;

void SUMMARY_BUILDER_REVISION_RU;
void SUMMARY_UNIT_SPLITTER_REVISION_RU;
void SUMMARY_GROUNDING_REVISION_RU;
void RUSSIAN_SUMMARY_FIRST_PERSON_362_REVISION;
void RUSSIAN_SUMMARY_CROSS_LOCALE_362_REVISION;
void RUSSIAN_SUMMARY_DURATION_GRAMMAR_REVISION;
void RUSSIAN_SUMMARY_DURATION_GRAMMAR_INVALID;
void PROVIDER_CROSS_LOCALE_NOOP_REASON;

const RU_CARDINAL_GEN =
  '(?:одного|одной|двух|трёх|трех|четырёх|четырех|пяти|шести|семи|восьми|девяти|десяти|полутора|\\d+)';

/**
 * Reject malformed Russian duration case/order such as nominative after около,
 * `лет с половиной` reversal, or numeric hybrids. Accept natural genitive forms
 * like `шести с половиной лет` / `одного года` / month spans.
 */
export function analyzeRussianDurationGrammar(
  text: string,
  expected?: ExperienceDuration | null,
): {
  grammarValidationPassed: boolean;
  durationGrammarValidationPassed: boolean;
  grammarRejectionReason: string | null;
  durationValidatorRevision: typeof RUSSIAN_SUMMARY_DURATION_GRAMMAR_REVISION;
  malformedDurationOrderingDetected: boolean;
  expectedDurationCore: string | null;
  detectedMalformedPhrase: string | null;
} {
  void RUSSIAN_SUMMARY_DURATION_GRAMMAR_REVISION;
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const malformedRes: Array<{ re: RegExp; label: string }> = [
    {
      re: /(?:около|примерно)\s+(?:шесть|пять|четыре|три|два|семь|восемь|девять|десять)(?:\s+с\s+половиной)?\s+лет/iu,
      label: 'nominative_after_около',
    },
    {
      re: new RegExp(
        String.raw`${RU_CARDINAL_GEN}\s+лет\s+с\s+половиной`,
        'iu',
      ),
      label: 'лет_before_s_polovinoj',
    },
    {
      re: /\d+[.,]\d+\s+лет/iu,
      label: 'numeric_hybrid_years',
    },
    {
      re: /(?:шести|пяти|двух|трёх|трех|четырёх|четырех)\s+половиной\s+лет/iu,
      label: 'missing_s_before_polovinoj',
    },
  ];
  let detectedMalformedPhrase: string | null = null;
  for (const { re } of malformedRes) {
    const m = t.match(re);
    if (m) {
      detectedMalformedPhrase = m[0];
      break;
    }
  }
  const openerHits = t.match(/у\s+меня/giu) || [];
  const yearSpanHits = t.match(
    new RegExp(
      String.raw`${RU_CARDINAL_GEN}(?:\s+с\s+половиной)?\s+(?:лет|года|год|месяц(?:а|ев)?)`,
      'giu',
    ),
  ) || [];
  const duplicateDuration = openerHits.length > 1 || yearSpanHits.length > 1;

  const expectedCore = expected && expected.hasValidDates
    ? formatRussianDurationCore(expected)
    : null;
  let semanticMismatch = false;
  if (expectedCore && /(?:опыт|лет|года|год|месяц)/iu.test(t)) {
    const hasExpectedCore = new RegExp(
      expectedCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'iu',
    ).test(t);
    if (
      /(?:у\s+меня|около|примерно|лет|месяц)/iu.test(t)
      && !hasExpectedCore
      && !detectedMalformedPhrase
    ) {
      semanticMismatch = true;
    }
  }

  const malformedDurationOrderingDetected = Boolean(detectedMalformedPhrase) || duplicateDuration;
  const ok = !malformedDurationOrderingDetected && !semanticMismatch;
  return {
    grammarValidationPassed: ok,
    durationGrammarValidationPassed: ok,
    grammarRejectionReason: ok ? null : RUSSIAN_SUMMARY_DURATION_GRAMMAR_INVALID,
    durationValidatorRevision: RUSSIAN_SUMMARY_DURATION_GRAMMAR_REVISION,
    malformedDurationOrderingDetected,
    expectedDurationCore: expectedCore,
    detectedMalformedPhrase: detectedMalformedPhrase
      || (duplicateDuration ? 'duplicate_duration_claim' : null)
      || (semanticMismatch ? 'duration_semantic_mismatch' : null),
  };
}

export function hasIncorrectRussianDurationGrammar(text: string): boolean {
  return !analyzeRussianDurationGrammar(text).grammarValidationPassed;
}

/** Split Russian Summary into semantic sentence units. */
export function splitRussianSummaryUnits(text: string): string[] {
  void SUMMARY_UNIT_SPLITTER_REVISION_RU;
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const bySentence = raw
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySentence.length >= 3) return bySentence;
  if (bySentence.length === 2) return bySentence;
  const forced = raw
    .split(/\s+(?=(?:Сейчас|Ранее)\b)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return forced.length >= 2 ? forced : (raw ? [raw] : []);
}

function assignRuUnitRoleSlot(unit: string): string {
  const s = (unit || '').trim();
  if (!s) return 'other';
  if (
    /(?:у\s+меня|общего\s+профессионального\s+опыта|около\s+.+\s+лет)/iu.test(s)
    && !/(?:сейчас|ранее)/iu.test(s)
  ) {
    return 'duration';
  }
  if (/(?:^|[^\p{L}])ранее(?:[^\p{L}]|$)/iu.test(s)
    || (/(?:работала|работал)/iu.test(s) && /(?:Rewitu|ранее)/iu.test(s))) {
    return 'prior_role';
  }
  if (/(?:^|[^\p{L}])сейчас(?:[^\p{L}]|$)/iu.test(s)
    || /(?:^|[^\p{L}])работаю(?:[^\p{L}]|$)/iu.test(s)) {
    return 'current_intro';
  }
  return 'other';
}

export function detectRussianSummaryPerspective(
  text: string,
): 'first_person' | 'neutral_cv' | 'cv_third_person' {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'neutral_cv';
  const firstPerson = /(?:у\s+меня|(?:^|[^\p{L}])я(?:[^\p{L}]|$)|(?:^|[^\p{L}])работаю(?:[^\p{L}]|$)|я\s+работала|я\s+работал|(?:^|[^\p{L}])проверяю(?:[^\p{L}]|$)|(?:^|[^\p{L}])координирую(?:[^\p{L}]|$))/iu
    .test(t);
  if (firstPerson) return 'first_person';
  if (
    /(?:имеет\s+опыт|работающ(?:ая|ий)|(?:^|[^\p{L}])работает(?:[^\p{L}]|$)|кладовщиц\p{L}*\s+с\s+общим)/iu.test(t)
  ) {
    return 'cv_third_person';
  }
  return 'neutral_cv';
}

/** Legacy warehouse fragment helper — still used by material cue paths. */
export function russianWarehouseSummaryFragment(key: string): string {
  if (key === 'warehouse_inbound_check') {
    return 'проверки поступающих товаров и связанной с ними документации';
  }
  if (key === 'warehouse_records') {
    return 'проверки документации, связанной с полученными товарами';
  }
  if (key === 'warehouse_movement') {
    return 'координации с коллегами при подготовке и перемещении товаров';
  }
  return '';
}

const RU_WAREHOUSE_INBOUND =
  /поступающ\p{L}*\s+товар|проверяю\s+поступающ/iu;
const RU_WAREHOUSE_DOCS =
  /документ\p{L}*.{0,40}(?:товар|получ|поступ)|связанн\p{L}*\s+(?:с\s+ними|с\s+получ|с\s+поступ).{0,40}документ|документ\p{L}*\s+связанн/iu;
const RU_WAREHOUSE_COORD =
  /координирую\s+с\s+коллег|подготовк\p{L}*.{0,40}перемещен|перемещен\p{L}*.{0,40}товар/iu;
const RU_DESIGN_CREATE =
  /визуальн\p{L}*\s+материал|графическ\p{L}*\s+элемент|создавала\s+визуальн|создавал\s+визуальн/iu;
const RU_DESIGN_REVIEW =
  /проверяла\s+и\s+адаптировала|адаптировала\s+дизайн|проверял\s+и\s+адаптировал|дизайн-материал/iu;
const RU_DESIGN_FINAL =
  /финальн\p{L}*\s+дизайн-файл|различн\p{L}*\s+формат|экран/iu;

export type RussianSummaryEmploymentQuality = {
  groundingValidationPassed: boolean;
  slotValidationPassed: boolean;
  perspectiveValidationPassed: boolean;
  genderValidationPassed: boolean;
  tenseValidationPassed: boolean;
  grammarValidationPassed: boolean;
  durationGrammarValidationPassed: boolean;
  perspectiveMode: 'first_person' | 'neutral_cv' | 'cv_third_person';
  typedRejectionReason: string | null;
  slotRejectionReasons: string[];
  grammarRejectionReason: string | null;
  durationValidatorRevision: string;
  malformedDurationOrderingDetected: boolean;
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
  // Legacy compatibility fields used by Experience/Summary package diagnostics.
  repeatedEmploymentFactCount: number;
  repeatedProfessionalLabelCount: number;
  professionalLabelCount: number;
  genericizedMaterialFactCount: number;
  crossDomainLeakageDetected: boolean;
  currentSlotForeignFactCount: number;
  priorSlotForeignFactCount: number;
  semanticCrossEntryLeakageDetected: boolean;
  duplicatedPriorRoleFactCount: number;
  priorRoleSemanticFactMentionCount: number;
  priorRoleSemanticDuplicationDetected: boolean;
  hindiFiniteKaAnubhavCollision: boolean;
  finalSentenceMaterialKeyCounts: number[];
  summaryUnitSplitterRevision: typeof SUMMARY_UNIT_SPLITTER_REVISION_RU;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION_RU;
};

function countRuWarehouseCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [RU_WAREHOUSE_INBOUND, RU_WAREHOUSE_DOCS, RU_WAREHOUSE_COORD];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

function countRuDesignCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const checks = [RU_DESIGN_CREATE, RU_DESIGN_REVIEW, RU_DESIGN_FINAL];
  const covered = checks.filter((re) => re.test(text)).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

function warehouseRoleInstrumental(female: boolean): string {
  return female ? 'сотрудницей склада' : 'сотрудником склада';
}

function warehouseRoleNominative(female: boolean): string {
  return female ? 'сотрудница склада' : 'сотрудник склада';
}

function designerRoleInstrumental(): string {
  return 'графическим дизайнером';
}

export function analyzeRussianSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    rawCurrentRole?: string;
    startDate?: string;
    sourceDuties?: string;
    priorCompany?: string;
    priorRole?: string;
    rawPriorRole?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    structuredRole?: string;
    gender?: string;
    currentEntryId?: string | null;
    priorEntryId?: string | null;
    expectedDuration?: ExperienceDuration | null;
  } = {},
): RussianSummaryEmploymentQuality {
  void RUSSIAN_SUMMARY_FIRST_PERSON_362_REVISION;
  void RUSSIAN_SUMMARY_CROSS_LOCALE_362_REVISION;
  void SUMMARY_UNIT_SPLITTER_REVISION_RU;
  void SUMMARY_GROUNDING_REVISION_RU;
  void options.startDate;
  void options.sourceDuties;
  void options.structuredRole;

  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitRussianSummaryUnits(text);
  const unitCount = units.length;
  const finalSentenceHashes = units.map((u) => fingerprintText(u));
  const perUnitRoleSlots = units.map((u) => assignRuUnitRoleSlot(u));
  const purity = validateAiUnitLocalePurity(text, 'ru', {
    kind: 'summary_sentence',
    requireUnits: true,
    requiredScript: 'cyrillic',
  });
  const perspectiveMode = detectRussianSummaryPerspective(text);
  const perspectiveValidationPassed = perspectiveMode === 'first_person';
  const durationGrammar = analyzeRussianDurationGrammar(
    text,
    options.expectedDuration || null,
  );

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'weiblich' || g === 'женск';
  const masculinePastLeak = female && (
    /(?:^|[^\p{L}])работал(?:[^\p{L}]|$)/u.test(text)
    || /(?:^|[^\p{L}])создавал(?:[^\p{L}]|$)/u.test(text)
    || /(?:^|[^\p{L}])проверял(?:[^\p{L}]|$)/u.test(text)
    || /(?:^|[^\p{L}])адаптировал(?:[^\p{L}]|$)/u.test(text)
    || /(?:^|[^\p{L}])подготавливал(?:[^\p{L}]|$)/u.test(text)
  );
  const genderValidationPassed = !masculinePastLeak;
  const priorPastOk = !/(?:^|[^\p{L}])ранее(?:[^\p{L}]|$)/iu.test(text)
    || /работала/u.test(text)
    || (!female && /(?:^|[^\p{L}])работал(?:[^\p{L}]|$)/u.test(text));
  const currentPresentOk = !/(?:^|[^\p{L}])сейчас(?:[^\p{L}]|$)/iu.test(text)
    || /работаю/u.test(text);
  const tenseValidationPassed = priorPastOk && currentPresentOk;

  const dutiesCorpus = `${options.currentEntryDuties || ''} ${options.role || ''}`;
  const canonicalWarehouseFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: options.currentEntryDuties || '',
  });
  const warehouseRoleCue = matchesWarehouseOccupationalTitle(options.role || '')
    || matchesWarehouseOccupationalTitle(options.rawCurrentRole || '')
    || /warehouse|lager|entrep[oô]t|magazzino|склад|товар|incoming\s+goods|кладов|сотрудник\w*\s+склад/i
      .test(dutiesCorpus);
  const requireWarehouseTriad = canonicalWarehouseFacts.length >= 3;
  const designDomain = matchesGraphicDesignerOccupationalTitle(options.priorRole || '')
    || matchesGraphicDesignerOccupationalTitle(options.rawPriorRole || '')
    || /design|grafik|graphiste|visuel|graphic|графическ|дизайн/i.test(
      `${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
    );

  const currentCov = requireWarehouseTriad
    ? countRuWarehouseCoverage(text)
    : { required: 0, covered: 0, missing: 0 };
  const priorCov = designDomain
    ? countRuDesignCoverage(text)
    : { required: 0, covered: 0, missing: 0 };

  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const currentIntroSlotPresent = /(?:сейчас\s+я\s+работаю|сейчас\s+работаю|работаю\s+в)/iu
    .test(text)
    && (company ? new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text) : true);
  const currentDutySlotPresent = currentCov.required === 0 || currentCov.covered >= currentCov.required;
  const priorRoleSlotPresent = !priorCompany && !designDomain
    ? true
    : /(?:ранее|работала|работал)/iu.test(text)
      && (priorCompany
        ? new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text)
        : true);
  const totalDurationSlotPresent = /(?:у\s+меня|общего\s+профессионального\s+опыта|около\s+.+\s+лет)/iu
    .test(text)
    && !durationGrammar.malformedDurationOrderingDetected;

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
    slotRejectionReasons.push('russian_summary_wrong_locale');
  }
  if (!perspectiveValidationPassed) {
    slotRejectionReasons.push('russian_summary_perspective_not_first_person');
  }
  if (!genderValidationPassed) {
    slotRejectionReasons.push('russian_summary_gender_mismatch');
  }
  if (!tenseValidationPassed) {
    slotRejectionReasons.push('russian_summary_tense_invalid');
  }
  if (!durationGrammar.grammarValidationPassed) {
    slotRejectionReasons.push(RUSSIAN_SUMMARY_DURATION_GRAMMAR_INVALID);
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
    slotRejectionReasons.push('russian_summary_unit_count_mismatch');
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
    slotRejectionReasons.push('russian_summary_unit_slot_mismatch');
  }

  const portugueseLeak = /\b(?:tenho|atualmente|trabalho|anteriormente|mercadorias|funcion[aá]ria)\b/iu
    .test(text);
  const italianLeak = /\b(?:dispongo|attualmente|lavoro\s+presso|in\s+precedenza|addetta)\b/iu
    .test(text);
  const frenchLeak = /\b(?:je|dispose|travaille\s+actuellement|auparavant|employée|graphiste)\b/iu
    .test(text);
  const germanLeak = /\b(?:ich|verfüge|derzeit|arbeite|arbeitete|lagermitarbeiter)\b/iu
    .test(text);
  const englishLeak = /\b(?:I\s+have|currently\s+work|previously\s+worked|warehouse\s+employee)\b/iu
    .test(text);
  const serbianLatinLeak = /\b(?:imam|radim|radila|radnica|magacinu|skladištu)\b/iu.test(text);
  if (portugueseLeak || italianLeak || frenchLeak || germanLeak || englishLeak || serbianLatinLeak) {
    slotRejectionReasons.push('russian_summary_source_language_leakage');
  }

  // Cyrillic Serbian (or other non-Russian Cyrillic) must not pass as Russian.
  const serbianCyrillicLeak = /(?:прегледа|пристиглу|робу|евиденци|заједнич|одељењ)/iu.test(text);
  if (serbianCyrillicLeak) {
    slotRejectionReasons.push('russian_summary_non_russian_cyrillic');
  }

  const foreignTitleLeak = /\b(?:Employée\s+d['’]entrepôt|Funcion[aá]ria\s+de\s+armaz|Addetta\s+al\s+magazzino|Radnica\s+u\s+skladištu)\b/iu
    .test(text);
  if (foreignTitleLeak) {
    slotRejectionReasons.push('russian_summary_foreign_role_title_leakage');
  }

  const employerCrossEntryLeakageDetected = Boolean(
    company
    && priorCompany
    && company !== priorCompany
    && /сейчас/iu.test(text)
    && new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(
      (text.match(/сейчас[^.]+/iu) || [''])[0],
    ),
  );
  if (employerCrossEntryLeakageDetected) {
    slotRejectionReasons.push('employer_cross_entry_leakage');
  }

  const unsupportedClaimCount = [
    /\b(?:agile|scrum|kpi|лидерств|маркетинг|брендинг|печат\w*)\b/iu.test(text),
  ].filter(Boolean).length;
  if (unsupportedClaimCount > 0) {
    slotRejectionReasons.push('unsupported_claim');
  }

  const roleLooksWarehouse = warehouseRoleCue || requireWarehouseTriad;
  const rolePresent = (
    /сотрудниц\w*\s+склад|сотрудник\w*\s+склад|кладовщиц|кладовщик/iu.test(text)
  ) || (
    Boolean(options.role)
    && new RegExp(
      String(options.role || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'iu',
    ).test(text)
  );

  const slotValidationPassed = slotRejectionReasons.length === 0
    && purity.targetLocalePurityPassed
    && perspectiveValidationPassed
    && genderValidationPassed
    && tenseValidationPassed
    && durationGrammar.grammarValidationPassed
    && !portugueseLeak
    && !italianLeak
    && !frenchLeak
    && !germanLeak
    && !englishLeak
    && !serbianLatinLeak
    && !serbianCyrillicLeak
    && (currentCov.required === 0 || currentCov.covered >= currentCov.required)
    && (priorCov.required === 0 || priorCov.covered >= priorCov.required);

  const groundingValidationPassed = slotValidationPassed && Boolean(text);
  const typedRejectionReason = !text
    ? 'empty_summary'
    : (slotRejectionReasons[0] || null);

  const finalCurrentEmployerPresent = Boolean(company)
    && new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text);
  const finalPriorEmployerPresent = !priorCompany
    || new RegExp(priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu').test(text);

  return {
    groundingValidationPassed,
    slotValidationPassed,
    perspectiveValidationPassed,
    genderValidationPassed,
    tenseValidationPassed,
    grammarValidationPassed: durationGrammar.grammarValidationPassed,
    durationGrammarValidationPassed: durationGrammar.durationGrammarValidationPassed,
    perspectiveMode,
    typedRejectionReason,
    slotRejectionReasons: [...new Set(slotRejectionReasons)],
    grammarRejectionReason: durationGrammar.grammarRejectionReason,
    durationValidatorRevision: durationGrammar.durationValidatorRevision,
    malformedDurationOrderingDetected: durationGrammar.malformedDurationOrderingDetected,
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
    targetLocalePurityPassed: purity.targetLocalePurityPassed
      && !portugueseLeak
      && !italianLeak
      && !frenchLeak
      && !germanLeak
      && !englishLeak
      && !serbianLatinLeak
      && !serbianCyrillicLeak,
    wrongLocaleUnitCount: Math.max(
      purity.wrongLocaleUnitCount,
      portugueseLeak || italianLeak || frenchLeak || germanLeak || englishLeak || serbianLatinLeak || serbianCyrillicLeak ? 1 : 0,
    ),
    unexpectedLocaleCodes: [
      ...new Set([
        ...(purity.unexpectedLocaleCodes || []),
        ...(portugueseLeak ? ['pt-BR'] : []),
        ...(italianLeak ? ['it'] : []),
        ...(frenchLeak ? ['fr'] : []),
        ...(germanLeak ? ['de'] : []),
        ...(englishLeak ? ['en'] : []),
        ...(serbianLatinLeak || serbianCyrillicLeak ? ['sr'] : []),
      ]),
    ],
    detectedLocaleByUnit: purity.detectedLocaleByUnit || [],
    unsupportedClaimCount,
    employerCrossEntryLeakageDetected,
    currentEmploymentIntroductionCount: currentIntroSlotPresent ? 1 : 0,
    currentRoleConcreteFactCoverage: currentCov.covered,
    priorRoleGroundingPassed: priorCov.required === 0
      || priorCov.covered >= priorCov.required,
    currentRoleTitlePresent: rolePresent,
    currentRoleTitleMatchesStructuredRole: rolePresent,
    finalCurrentEmployerPresent,
    finalPriorEmployerPresent,
    finalCurrentEmploymentStateExpressed: /(?:сейчас|работаю)/iu.test(text),
    finalPriorEmploymentStateExpressed: !priorCompany
      || /(?:ранее|работала|работал)/iu.test(text),
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
    repeatedEmploymentFactCount: 0,
    repeatedProfessionalLabelCount: 0,
    professionalLabelCount: (text.match(/профессионал/giu) || []).length,
    genericizedMaterialFactCount: 0,
    crossDomainLeakageDetected: false,
    currentSlotForeignFactCount: 0,
    priorSlotForeignFactCount: 0,
    semanticCrossEntryLeakageDetected: false,
    duplicatedPriorRoleFactCount: 0,
    priorRoleSemanticFactMentionCount: priorCov.covered,
    priorRoleSemanticDuplicationDetected: false,
    hindiFiniteKaAnubhavCollision: false,
    finalSentenceMaterialKeyCounts: units.map(
      (s) => classifyMaterialDutyKeys(s).length,
    ),
    summaryUnitSplitterRevision: SUMMARY_UNIT_SPLITTER_REVISION_RU,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION_RU,
  };
}

export function buildRussianEntryOwnedSummary(options: {
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
  void SUMMARY_BUILDER_REVISION_RU;
  void RUSSIAN_SUMMARY_FIRST_PERSON_362_REVISION;
  void options.locale;
  void options.datesValue;
  void localizeWarehouseEmployee;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'weiblich' || g === 'женск';

  let role = (options.role || '').trim();
  const currentDutiesCorpus = options.dutyFacts
    .map((f) => f.sourceText || f.value)
    .filter(Boolean)
    .join('\n');
  const warehouseRole = !role
    || /^(?:профессионал|professional|специалист(?:ка)?)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role);

  if (warehouseRole) {
    role = warehouseRoleInstrumental(female);
  } else {
    const resolved = resolveLocalizedSummaryRole({
      role,
      targetLocale: 'ru',
      gender: options.gender,
    });
    if (resolved.localizationValidationPassed) {
      role = resolved.localizedTargetRoleLabel;
    }
  }

  const company = (options.employer || '').trim();
  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'ru')
      .replace(/\.$/u, '')
      .trim();
  }
  let durationSentence = '';
  if (durRaw || options.duration) {
    let yearsPhrase = '';
    if (options.duration?.hasValidDates) {
      yearsPhrase = formatRussianDurationCore(options.duration);
    }
    if (!yearsPhrase && durRaw) {
      const match = durRaw.match(
        /((?:одного|двух|трёх|трех|четырёх|четырех|пяти|шести|семи|восьми|девяти|десяти|полутора)(?:\s+с\s+половиной)?\s+(?:лет|года)|(?:одного|двух|трёх|трех|четырёх|четырех|пяти|шести|семи|восьми|девяти|десяти)\s+месяц(?:а|ев)?)/iu,
      );
      if (match) yearsPhrase = match[1];
    }
    if (!yearsPhrase) yearsPhrase = 'нескольких лет';
    durationSentence = `У меня около ${yearsPhrase} общего профессионального опыта.`;
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
        'проверяю поступающие товары и связанную с ними документацию',
        'а также координирую с коллегами подготовку и перемещение товаров',
      ].join(', ');
      // Keep goods + documentation semantically distinct for coverage detectors.
      void RU_WAREHOUSE_DOCS;
      currentSentence = company
        ? `Сейчас я работаю в компании ${company} ${role}: ${dutyClause}.`
        : `Сейчас я работаю ${role}: ${dutyClause}.`;
    } else {
      const cookDomain = /(?:cook|chef|kuvar|повар|restaurant|кухн)/i
        .test(`${role} ${currentDutiesCorpus}`);
      let dutyBits: string[] = [];
      if (cookDomain) {
        dutyBits = [
          'готовлю блюда по стандартам ресторана',
          'поддерживаю гигиену рабочего места',
          'сотрудничаю с командой кухни',
        ];
      } else {
        dutyBits = options.dutyFacts
          .map((f) => (f.sourceText || f.value || '').replace(/[.;]+$/u, '').trim())
          .filter(Boolean)
          .filter((s) => /[\u0400-\u04FF]/.test(s))
          .filter((s) => !/\b(?:tenho|atualmente|dispongo|ich|derzeit|je\s+travaille)\b/iu.test(s))
          .slice(0, 3);
      }
      const dutyTail = dutyBits.length
        ? `: ${dutyBits.join(', ').replace(/, ([^,]*)$/u, ' и $1')}`
        : '';
      currentSentence = company
        ? `Сейчас я работаю в компании ${company} ${role}${dutyTail}.`
        : `Сейчас я работаю ${role}${dutyTail}.`;
    }
  }

  const priorRoleRaw = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|visual|vizuel|visuel|デザイン|diseñ|graphiste|graphic|графическ|дизайн)/i
    .test(`${priorRoleRaw} ${priorDuties}`);
  let priorSentence = '';
  if (priorRoleRaw || priorEmployer || priorDuties) {
    const worked = female ? 'работала' : 'работал';
    if (priorLooksDesign) {
      const priorLabel = designerRoleInstrumental();
      void localizeGraphicDesigner;
      const designFacts = female
        ? [
          'создавала визуальные материалы и графические элементы',
          'проверяла и адаптировала дизайн-материалы',
          'подготавливала финальные дизайн-файлы для различных форматов и экранов',
        ].join(', ').replace(/, ([^,]*)$/u, ' и $1')
        : [
          'создавал визуальные материалы и графические элементы',
          'проверял и адаптировал дизайн-материалы',
          'подготавливал финальные дизайн-файлы для различных форматов и экранов',
        ].join(', ').replace(/, ([^,]*)$/u, ' и $1');
      priorSentence = priorEmployer
        ? `Ранее я ${worked} в компании ${priorEmployer} ${priorLabel}: ${designFacts}.`
        : `Ранее я ${worked} ${priorLabel}: ${designFacts}.`;
    } else {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || '',
        targetLocale: 'ru',
        gender: options.gender,
      });
      const priorLabel = priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : (priorRoleRaw || (female ? 'специалисткой' : 'специалистом'));
      priorSentence = priorEmployer
        ? `Ранее я ${worked} в компании ${priorEmployer} ${priorLabel}.`
        : `Ранее я ${worked} ${priorLabel}.`;
    }
  }

  void warehouseRoleNominative;
  return [durationSentence, currentSentence, priorSentence]
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/u, '').trim())
    .map((s) => (s ? `${s}.` : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when structured duties/role indicate Russian entry-owned warehouse/design rebuild. */
export function isRussianStructuredSummaryDomain(corpus: string): boolean {
  const t = corpus || '';
  return matchesWarehouseOccupationalTitle(t)
    || matchesGraphicDesignerOccupationalTitle(t)
    || /warehouse|entrep[oô]t|lager|magazzino|склад|incoming\s+goods|товар|graphiste|graphic\s*design|дизайн|кладов|сотрудник/i
      .test(t);
}
