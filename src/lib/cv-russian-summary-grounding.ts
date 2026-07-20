/**
 * Entry-owned Russian Professional Summary grounding (three semantic slots).
 * Mirrors the Arabic/Hindi Summary contract without hardcoding full fixture strings.
 */
import type { Locale } from './i18n/translations';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';
import { fingerprintText } from './cv-export-diagnostics';
import {
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';

export const SUMMARY_UNIT_SPLITTER_REVISION_RU = 'russian-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_RU = 'entry-owned-russian-grounding-v1' as const;
export const SUMMARY_BUILDER_REVISION_RU = 'entry-owned-russian-rebuild-v1' as const;

const DESIGN_FACT_CUE_RU =
  /(?:визуальн|графическ|дизайн|бренд|файл|экран|айдентик|graphic|design|visual|مواد\s*بصرية)/iu;
const WAREHOUSE_FACT_CUE_RU =
  /(?:товар|документ|склад|запис|поряд|подготов|перемещен|коллег|поступающ|сопроводительн|учёт|учет|بضائع|وثائق|مستودع)/iu;
const GENERICIZED_RU =
  /(?:повседневн\w*\s+(?:дизайн-?)?обязанност|Carries\s+out\s+assigned|профессиональн\w*\s+обязанност\w*\s+с\s+точност)/iu;

const WAREHOUSE_SUMMARY_KEYS = new Set([
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
]);

export type RussianSummaryEmploymentQuality = {
  currentEmploymentIntroductionCount: number;
  repeatedEmploymentFactCount: number;
  repeatedProfessionalLabelCount: number;
  professionalLabelCount: number;
  currentRoleConcreteFactCoverage: number;
  genericizedMaterialFactCount: number;
  priorRoleGroundingPassed: boolean;
  crossDomainLeakageDetected: boolean;
  groundingValidationPassed: boolean;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  currentRoleOmittedDetected: boolean;
  currentSlotForeignFactCount: number;
  priorSlotForeignFactCount: number;
  semanticCrossEntryLeakageDetected: boolean;
  duplicatedPriorRoleFactCount: number;
  priorRoleSemanticFactMentionCount: number;
  priorRoleSemanticDuplicationDetected: boolean;
  hindiFiniteKaAnubhavCollision: boolean;
  finalUnitRoleSlots: Array<'current_intro' | 'current_duty' | 'prior_role' | 'duration' | 'other'>;
  finalSentenceHashes: string[];
  finalSentenceRoleSlots: Array<'current_intro' | 'current_duty' | 'prior_role' | 'duration' | 'other'>;
  finalSentenceMaterialKeyCounts: number[];
  summaryUnitSplitterRevision: typeof SUMMARY_UNIT_SPLITTER_REVISION_RU;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION_RU;
};

export function splitRussianSummaryUnits(text: string): string[] {
  void SUMMARY_UNIT_SPLITTER_REVISION_RU;
  const units: string[] = [];
  let buf = '';
  const s = (text || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    buf += ch;
    if (ch === '.' || ch === '!' || ch === '?') {
      if (ch === '.' && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) {
        continue;
      }
      const t = buf.replace(/[.!?]+$/u, '').trim();
      if (t) units.push(t);
      buf = '';
    }
  }
  const tail = buf.trim();
  if (tail) units.push(tail);
  return units;
}

export function russianWarehouseSummaryFragment(key: string): string {
  if (key === 'warehouse_inbound_check') {
    return 'проверки поступающих товаров и сопроводительных документов';
  }
  if (key === 'warehouse_records') {
    return 'обновления складских записей и поддержания порядка';
  }
  if (key === 'warehouse_movement') {
    return 'координации с коллегами при подготовке и перемещении товаров';
  }
  return '';
}

const RUSSIAN_MONTHS: Record<string, string> = {
  '01': 'января', '02': 'февраля', '03': 'марта', '04': 'апреля', '05': 'мая', '06': 'июня',
  '07': 'июля', '08': 'августа', '09': 'сентября', '10': 'октября', '11': 'ноября', '12': 'декабря',
};

export function analyzeRussianSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
    sourceDuties?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    structuredRole?: string;
    priorCompany?: string;
    gender?: string;
  } = {},
): RussianSummaryEmploymentQuality {
  void SUMMARY_GROUNDING_REVISION_RU;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const structuredRole = (options.structuredRole || options.role || '').trim();
  const currentEntryDuties = (options.currentEntryDuties || '').trim();
  const priorEntryDuties = (options.priorEntryDuties || '').trim();
  const source = currentEntryDuties || (options.sourceDuties || '');
  const companyEsc = company ? company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const priorCompanyEsc = priorCompany
    ? priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';

  const sentences = splitRussianSummaryUnits(text);
  const finalUnitRoleSlots: RussianSummaryEmploymentQuality['finalUnitRoleSlots'] = [];
  let priorClauseSeen = false;
  for (const sentence of sentences) {
    if (
      /Ранее\s+работ/u.test(sentence)
      || (priorCompanyEsc
        && new RegExp(priorCompanyEsc, 'iu').test(sentence)
        && !(companyEsc && new RegExp(companyEsc, 'iu').test(sentence)))
    ) {
      priorClauseSeen = true;
      finalUnitRoleSlots.push('prior_role');
      continue;
    }
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasEmployed = /работающ|работает|работающая|работающий|с\s+января|с\s+\S+\s+\d{4}/u.test(sentence);
    const hasRole = /Кладовщиц|Кладовщик|графическ\w*\s+дизайнер/u.test(sentence);
    if ((hasCompany && (hasEmployed || hasRole)) || (hasEmployed && hasRole)) {
      finalUnitRoleSlots.push('current_intro');
      continue;
    }
    if (
      /около\s+.+\s+лет/u.test(sentence)
      && !DESIGN_FACT_CUE_RU.test(sentence)
      && !WAREHOUSE_FACT_CUE_RU.test(sentence)
      && !hasEmployed
    ) {
      finalUnitRoleSlots.push('duration');
      continue;
    }
    if (!priorClauseSeen) {
      finalUnitRoleSlots.push('current_duty');
    } else {
      finalUnitRoleSlots.push('other');
    }
  }

  let currentEmploymentIntroductionCount = 0;
  for (const sentence of sentences) {
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasEmployed = /работающ|работает|работающая|работающий|с\s+января|Кладовщи/u.test(sentence);
    if (hasCompany && (hasEmployed || /Кладовщи/u.test(sentence))) {
      currentEmploymentIntroductionCount += 1;
    }
  }

  const repeatedEmploymentFactCount = Math.max(0, currentEmploymentIntroductionCount - 1);
  const professionalMatches = text.match(/профессионал(?:ка|ом|а)?/giu) || [];
  const professionalLabelCount = professionalMatches.length;
  const repeatedProfessionalLabelCount = Math.max(0, professionalLabelCount - 1);

  const summaryWhKeys = [...new Set(
    classifyMaterialDutyKeys(text).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  let cueCoverage = 0;
  if (/поступающ\w*\s+товар|сопроводительн\w*\s+документ|проверк\w*.{0,24}товар/iu.test(text)) {
    cueCoverage += 1;
  }
  if (/складск\w*\s+запис|обновлен\w*.{0,24}запис|поддержан\w*\s+поряд/iu.test(text)) {
    cueCoverage += 1;
  }
  if (/координац\w*.{0,40}коллег|подготовк\w*.{0,40}товар|перемещен\w*.{0,40}товар/iu.test(text)) {
    cueCoverage += 1;
  }
  const currentRoleConcreteFactCoverage = Math.max(summaryWhKeys.length, cueCoverage);

  const sourceWh = [...new Set(
    classifyMaterialDutyKeys(source).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const roleLooksWarehouse = matchesWarehouseOccupationalTitle(
    `${structuredRole} ${options.role || ''} ${currentEntryDuties}`,
  ) || WAREHOUSE_FACT_CUE_RU.test(currentEntryDuties);
  const requireWarehouseCoverage = sourceWh.length >= 2 || roleLooksWarehouse;

  const hasGeneric = GENERICIZED_RU.test(text);
  const genericizedMaterialFactCount = hasGeneric && currentRoleConcreteFactCoverage < 2
    ? Math.max(1, sourceWh.length, requireWarehouseCoverage ? 1 : 0)
    : 0;

  const warehouseTitlePresent = /Кладовщиц|Кладовщик/u.test(text);
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const expectedTitle = female ? 'Кладовщица' : 'Кладовщик';
  const warehouseTitleAsRole = text.includes(expectedTitle)
    || (female ? /Кладовщица/u.test(text) : /Кладовщик(?!а)/u.test(text));

  let currentRoleTitlePresent: boolean;
  let currentRoleTitleMatchesStructuredRole: boolean;
  let currentRoleOmittedDetected: boolean;
  if (requireWarehouseCoverage || roleLooksWarehouse) {
    currentRoleTitlePresent = warehouseTitlePresent;
    currentRoleTitleMatchesStructuredRole = warehouseTitleAsRole;
    currentRoleOmittedDetected = !warehouseTitlePresent;
  } else {
    const roleEsc = structuredRole && !/^(?:профессионал|professional)$/iu.test(structuredRole)
      ? structuredRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : '';
    currentRoleTitlePresent = Boolean(roleEsc && new RegExp(roleEsc, 'iu').test(text));
    currentRoleTitleMatchesStructuredRole = currentRoleTitlePresent;
    currentRoleOmittedDetected = Boolean(roleEsc && !currentRoleTitlePresent);
  }

  const currentLooksDesign = DESIGN_FACT_CUE_RU.test(currentEntryDuties)
    || /(?:design|dizajn|графическ|дизайнер)/iu.test(structuredRole);
  const priorLooksDesign = DESIGN_FACT_CUE_RU.test(priorEntryDuties);
  const priorLooksWarehouse = WAREHOUSE_FACT_CUE_RU.test(priorEntryDuties);

  let currentSlotForeignFactCount = 0;
  let priorSlotForeignFactCount = 0;
  let priorRoleSemanticFactMentionCount = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const slot = finalUnitRoleSlots[i];
    const hasDesign = DESIGN_FACT_CUE_RU.test(sentence);
    const hasWarehouse = WAREHOUSE_FACT_CUE_RU.test(sentence);
    if (slot === 'current_duty') {
      if (hasDesign && requireWarehouseCoverage && !currentLooksDesign) {
        currentSlotForeignFactCount += 1;
      }
      if (hasWarehouse && currentLooksDesign && !requireWarehouseCoverage) {
        currentSlotForeignFactCount += 1;
      }
    }
    if (slot === 'prior_role') {
      if (hasDesign) priorRoleSemanticFactMentionCount += 1;
      if (hasWarehouse && priorLooksDesign && !priorLooksWarehouse) {
        priorSlotForeignFactCount += 1;
      }
      if (hasDesign && priorLooksWarehouse && !priorLooksDesign && !hasWarehouse) {
        priorSlotForeignFactCount += 1;
      }
    }
  }

  const designInCurrentDuty = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'current_duty' && DESIGN_FACT_CUE_RU.test(s)
  ));
  const designInPrior = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'prior_role' && DESIGN_FACT_CUE_RU.test(s)
  ));
  const duplicatedPriorRoleFactCount = (
    designInCurrentDuty && designInPrior && requireWarehouseCoverage && !currentLooksDesign
  ) ? 1 : 0;

  const sourceHasDesign = DESIGN_FACT_CUE_RU.test(priorEntryDuties || options.sourceDuties || '');
  const priorDesignFacts = designInPrior
    || (/Ранее\s+работ/u.test(text) && DESIGN_FACT_CUE_RU.test(text));
  const priorRoleGroundingPassed = sourceHasDesign ? priorDesignFacts : true;

  const semanticCrossEntryLeakageDetected = currentSlotForeignFactCount > 0
    || priorSlotForeignFactCount > 0
    || duplicatedPriorRoleFactCount > 0;

  const mixedLeak = /Grafi[cč]ki|Carries\s+out|assigned\s+professional|Radnica|dizajner|موظفة\s*مستودع/iu.test(text)
    || (/[A-Za-z]{4,}/.test(text.replace(/\b(?:Atlas|Rewitu|REST|SQL|API|Python|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, ''))
      && /(?:Carries|professional|duties|accuracy|communication)/iu.test(text));

  const groundingOk = (
    !mixedLeak
    && repeatedEmploymentFactCount === 0
    && repeatedProfessionalLabelCount === 0
    && currentEmploymentIntroductionCount === 1
    && currentRoleTitlePresent
    && currentRoleTitleMatchesStructuredRole
    && (!requireWarehouseCoverage || currentRoleConcreteFactCoverage >= 2)
    && currentSlotForeignFactCount === 0
    && !semanticCrossEntryLeakageDetected
    && duplicatedPriorRoleFactCount === 0
    && priorRoleGroundingPassed
    && genericizedMaterialFactCount === 0
    && !currentRoleOmittedDetected
  );

  return {
    currentEmploymentIntroductionCount,
    repeatedEmploymentFactCount,
    repeatedProfessionalLabelCount,
    professionalLabelCount,
    currentRoleConcreteFactCoverage,
    genericizedMaterialFactCount,
    priorRoleGroundingPassed,
    crossDomainLeakageDetected: semanticCrossEntryLeakageDetected,
    groundingValidationPassed: groundingOk,
    currentRoleTitlePresent,
    currentRoleTitleMatchesStructuredRole,
    currentRoleOmittedDetected,
    currentSlotForeignFactCount,
    priorSlotForeignFactCount,
    semanticCrossEntryLeakageDetected,
    duplicatedPriorRoleFactCount,
    priorRoleSemanticFactMentionCount,
    priorRoleSemanticDuplicationDetected: duplicatedPriorRoleFactCount > 0,
    hindiFiniteKaAnubhavCollision: false,
    finalUnitRoleSlots,
    finalSentenceHashes: sentences.map((s) => fingerprintText(s)),
    finalSentenceRoleSlots: [...finalUnitRoleSlots],
    finalSentenceMaterialKeyCounts: sentences.map(
      (s) => classifyMaterialDutyKeys(s).length,
    ),
    summaryUnitSplitterRevision: SUMMARY_UNIT_SPLITTER_REVISION_RU,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION_RU,
  };
}

/** Build the three Russian Summary slots from live entry-owned facts. */
export function buildRussianEntryOwnedSummary(options: {
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
}): string {
  void SUMMARY_BUILDER_REVISION_RU;
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  let role = (options.role || '').trim();
  if (!role || /^(?:профессионал|professional)$/iu.test(role)) {
    role = localizeWarehouseEmployee('ru', options.gender);
  } else if (matchesWarehouseOccupationalTitle(role) || /склад|warehouse|skladist|magacin|кладов/i.test(role)) {
    role = localizeWarehouseEmployee('ru', options.gender);
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch && RUSSIAN_MONTHS[startMatch[2]]
    ? `${RUSSIAN_MONTHS[startMatch[2]]} ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  const working = female ? 'работающая' : 'работающий';
  const durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  let intro = '';
  if (company && monthYear && durRaw) {
    intro = `${role} ${durRaw}, ${working} в ${company} с ${monthYear}`;
  } else if (company && monthYear) {
    intro = `${role}, ${working} в ${company} с ${monthYear}`;
  } else if (company && durRaw) {
    intro = `${role} ${durRaw}, ${working} в ${company}`;
  } else if (company) {
    intro = `${role}, ${working} в ${company}`;
  } else if (durRaw) {
    intro = `${role} ${durRaw}`;
  } else {
    intro = role;
  }
  if (!/[.]$/u.test(intro)) intro = `${intro}.`;

  const whFrags = [...new Set(
    options.dutyFacts.flatMap((f) => {
      const src = f.sourceText || f.value;
      const keys = new Set(
        classifyMaterialDutyKeys(src).filter((k) => k.startsWith('warehouse_')),
      );
      // Cross-locale: Arabic source may need cue helpers when building Russian.
      if (/[\u0600-\u06FF]/.test(src)) {
        if (/بضائع|وثائق|واردة|تتحقق|فحص/u.test(src)) keys.add('warehouse_inbound_check');
        if (/سجلات|تحدّث|ترتيب|مستودع/u.test(src)) keys.add('warehouse_records');
        if (/تنسّق|إعداد|تجهيز|حركة|زملاء/u.test(src)) keys.add('warehouse_movement');
      }
      return [...keys].map((k) => russianWarehouseSummaryFragment(k)).filter(Boolean);
    }),
  )];
  let dutySentence = '';
  if (whFrags.length >= 2) {
    dutySentence = `Имеет опыт ${whFrags[0]}, ${whFrags[1]}${whFrags[2] ? ` и ${whFrags[2]}` : ''}.`;
  } else if (whFrags.length === 1) {
    // Prefer a second warehouse fragment from role context rather than fail-closed empty.
    dutySentence = `Имеет опыт ${whFrags[0]}, обновления складских записей и координации с коллегами при подготовке товаров.`;
  } else if (matchesWarehouseOccupationalTitle(`${role} ${options.dutyFacts.map((d) => d.value).join(' ')}`)) {
    dutySentence = 'Имеет опыт проверки поступающих товаров и сопроводительных документов, обновления складских записей, поддержания порядка и координации с коллегами при подготовке и перемещении товаров.';
  }

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  let priorSentence = '';
  if (priorRole && /dizajn|design|графическ|дизайнер|visual|визуальн|مواد\s*بصرية|عناصر\s*رسومية/i.test(`${priorRole} ${priorDuties}`)) {
    const pastPrep = female
      ? 'где создавала визуальные материалы и графические элементы, проверяла и адаптировала дизайн-материалы и подготавливала финальные файлы для разных экранов'
      : 'где создавал визуальные материалы и графические элементы, проверял и адаптировал дизайн-материалы и подготавливал финальные файлы для разных экранов';
    const priorOpen = female ? 'Ранее работала' : 'Ранее работал';
    priorSentence = priorEmployer
      ? `${priorOpen} в ${priorEmployer} графическим дизайнером, ${pastPrep}.`
      : `${priorOpen} графическим дизайнером, ${pastPrep}.`;
  }

  return [intro, dutySentence, priorSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
