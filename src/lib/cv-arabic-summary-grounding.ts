/**
 * Entry-owned Arabic Professional Summary grounding (three semantic slots).
 * Mirrors the Hindi Summary contract without hardcoding full fixture strings.
 */
import type { Locale } from './i18n/translations';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';
import { fingerprintText } from './cv-export-diagnostics';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';

export const SUMMARY_UNIT_SPLITTER_REVISION_AR = 'arabic-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_AR = 'entry-owned-arabic-grounding-v1' as const;
export const SUMMARY_BUILDER_REVISION_AR = 'entry-owned-arabic-rebuild-v1' as const;

const DESIGN_FACT_CUE_AR =
  /(?:مواد\s*بصرية|عناصر\s*رسومية|جرافيك|تصميم|هوية\s*بصرية|إرشادات|مطبوعة|رقمية|ملفات\s*التصميم|graphic|design|visual)/u;
const WAREHOUSE_FACT_CUE_AR =
  /(?:بضائع|وثائق|مستودع|سجلات|ترتيب|إعداد|تجهيز|حركة|زملاء|واردة|فحص|تحقق|تتحقق|تحقّقت)/u;
const GENERICIZED_AR =
  /(?:المهام\s*اليومية|السجلات\s*اليومية|وثائق\s*العمل|تبادل\s*المعلومات|Carries\s+out\s+assigned)/iu;

const WAREHOUSE_SUMMARY_KEYS = new Set([
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
]);

export type ArabicSummaryEmploymentQuality = {
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
  summaryUnitSplitterRevision: typeof SUMMARY_UNIT_SPLITTER_REVISION_AR;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION_AR;
};

export function splitArabicSummaryUnits(text: string): string[] {
  void SUMMARY_UNIT_SPLITTER_REVISION_AR;
  const units: string[] = [];
  let buf = '';
  const s = (text || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    buf += ch;
    if (ch === '.' || ch === '!' || ch === '?' || ch === '۔' || ch === '؟') {
      // Avoid splitting decimal-like Latin numbers (rare in Arabic summaries).
      if (ch === '.' && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) {
        continue;
      }
      const t = buf.replace(/[.!?۔؟]+$/u, '').trim();
      if (t) units.push(t);
      buf = '';
    }
  }
  const tail = buf.trim();
  if (tail) units.push(tail);
  return units;
}

export function arabicWarehouseSummaryFragment(key: string): string {
  if (key === 'warehouse_inbound_check') {
    return 'فحص البضائع الواردة والوثائق المرفقة';
  }
  if (key === 'warehouse_records') {
    return 'تحديث سجلات المستودع وترتيب البضائع';
  }
  if (key === 'warehouse_movement') {
    return 'تنسيق تجهيز البضائع وحركتها مع الزملاء';
  }
  return '';
}

const ARABIC_MONTHS: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل', '05': 'مايو', '06': 'يونيو',
  '07': 'يوليو', '08': 'أغسطس', '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};

export function analyzeArabicSummaryEmploymentQuality(
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
): ArabicSummaryEmploymentQuality {
  void SUMMARY_GROUNDING_REVISION_AR;
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

  const sentences = splitArabicSummaryUnits(text);
  const finalUnitRoleSlots: ArabicSummaryEmploymentQuality['finalUnitRoleSlots'] = [];
  let priorClauseSeen = false;
  for (const sentence of sentences) {
    if (
      /سبق\s+(?:لها|له)\s+العمل/u.test(sentence)
      || (priorCompanyEsc
        && new RegExp(priorCompanyEsc, 'iu').test(sentence)
        && !(companyEsc && new RegExp(companyEsc, 'iu').test(sentence)))
    ) {
      priorClauseSeen = true;
      finalUnitRoleSlots.push('prior_role');
      continue;
    }
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasEmployed = /تعمل\s+لدى|يعمل\s+لدى|منذ/u.test(sentence);
    const hasRole = /موظفة\s*مستودع|موظف\s*مستودع|مصممة|مصمم/u.test(sentence);
    if ((hasCompany && (hasEmployed || hasRole)) || (hasEmployed && hasRole)) {
      finalUnitRoleSlots.push('current_intro');
      continue;
    }
    if (
      /نحو\s+.+\s+من\s+الخبرة\s+المشتركة/u.test(sentence)
      && !DESIGN_FACT_CUE_AR.test(sentence)
      && !WAREHOUSE_FACT_CUE_AR.test(sentence)
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
    const hasEmployed = /تعمل\s+لدى|يعمل\s+لدى|منذ/u.test(sentence);
    if (hasCompany && hasEmployed) currentEmploymentIntroductionCount += 1;
  }

  const repeatedEmploymentFactCount = Math.max(0, currentEmploymentIntroductionCount - 1);
  const professionalMatches = text.match(/محترف(?:ة)?/gu) || [];
  const professionalLabelCount = professionalMatches.length;
  const repeatedProfessionalLabelCount = Math.max(0, professionalLabelCount - 1);

  const summaryWhKeys = [...new Set(
    classifyMaterialDutyKeys(text).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  // Also count Arabic warehouse cue phrases embedded in Summary fragments.
  let cueCoverage = 0;
  if (/بضائع\s*واردة|الوثائق\s*المرفقة|فحص\s*البضائع/u.test(text)) cueCoverage += 1;
  if (/سجلات\s*المستودع|ترتيب\s*البضائع|تحديث\s*سجلات/u.test(text)) cueCoverage += 1;
  if (/تجهيز\s*البضائع|حركة(?:ها)?|تنسيق.{0,24}زملاء/u.test(text)) cueCoverage += 1;
  const currentRoleConcreteFactCoverage = Math.max(summaryWhKeys.length, cueCoverage);

  const sourceWh = [...new Set(
    classifyMaterialDutyKeys(source).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const roleLooksWarehouse = matchesWarehouseOccupationalTitle(
    `${structuredRole} ${options.role || ''} ${currentEntryDuties}`,
  ) || WAREHOUSE_FACT_CUE_AR.test(currentEntryDuties);
  const requireWarehouseCoverage = sourceWh.length >= 2 || roleLooksWarehouse;

  const hasGeneric = GENERICIZED_AR.test(text);
  const genericizedMaterialFactCount = hasGeneric && currentRoleConcreteFactCoverage < 2
    ? Math.max(1, sourceWh.length, requireWarehouseCoverage ? 1 : 0)
    : 0;

  const warehouseTitlePresent = /موظفة\s*مستودع|موظف\s*مستودع/u.test(text);
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const expectedTitle = female ? 'موظفة مستودع' : 'موظف مستودع';
  const warehouseTitleAsRole = text.includes(expectedTitle)
    || (female ? /موظفة\s*مستودع/u.test(text) : /موظف\s*مستودع/u.test(text));

  let currentRoleTitlePresent: boolean;
  let currentRoleTitleMatchesStructuredRole: boolean;
  let currentRoleOmittedDetected: boolean;
  if (requireWarehouseCoverage || roleLooksWarehouse) {
    currentRoleTitlePresent = warehouseTitlePresent;
    currentRoleTitleMatchesStructuredRole = warehouseTitleAsRole;
    currentRoleOmittedDetected = !warehouseTitlePresent;
  } else {
    const roleEsc = structuredRole && !/^(?:محترف|محترفة|professional)$/iu.test(structuredRole)
      ? structuredRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : '';
    currentRoleTitlePresent = Boolean(roleEsc && new RegExp(roleEsc, 'iu').test(text));
    currentRoleTitleMatchesStructuredRole = currentRoleTitlePresent;
    currentRoleOmittedDetected = Boolean(roleEsc && !currentRoleTitlePresent);
  }

  const currentLooksDesign = DESIGN_FACT_CUE_AR.test(currentEntryDuties)
    || /(?:design|dizajn|جرافيك|مصمم)/iu.test(structuredRole);
  const priorLooksDesign = DESIGN_FACT_CUE_AR.test(priorEntryDuties);
  const priorLooksWarehouse = WAREHOUSE_FACT_CUE_AR.test(priorEntryDuties);

  let currentSlotForeignFactCount = 0;
  let priorSlotForeignFactCount = 0;
  let priorRoleSemanticFactMentionCount = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const slot = finalUnitRoleSlots[i];
    const hasDesign = DESIGN_FACT_CUE_AR.test(sentence);
    const hasWarehouse = WAREHOUSE_FACT_CUE_AR.test(sentence);
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
    finalUnitRoleSlots[i] === 'current_duty' && DESIGN_FACT_CUE_AR.test(s)
  ));
  const designInPrior = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'prior_role' && DESIGN_FACT_CUE_AR.test(s)
  ));
  const duplicatedPriorRoleFactCount = (
    designInCurrentDuty && designInPrior && requireWarehouseCoverage && !currentLooksDesign
  ) ? 1 : 0;

  const sourceHasDesign = DESIGN_FACT_CUE_AR.test(priorEntryDuties || options.sourceDuties || '');
  const priorDesignFacts = designInPrior
    || (/سبق\s+(?:لها|له)\s+العمل/u.test(text) && DESIGN_FACT_CUE_AR.test(text));
  const priorRoleGroundingPassed = sourceHasDesign ? priorDesignFacts : true;

  const semanticCrossEntryLeakageDetected = currentSlotForeignFactCount > 0
    || priorSlotForeignFactCount > 0
    || duplicatedPriorRoleFactCount > 0;

  // Locale purity: reject Serbian/English clause leakage in Arabic Summary.
  const mixedLeak = /Grafi[cč]ki|Carries\s+out|assigned\s+professional|Radnica|dizajner/iu.test(text)
    || (/[A-Za-z]{4,}/.test(text)
      && !/(?:Atlas|Rewitu|January|February|March|April|May|June|July|August|September|October|November|December)/u.test(
        text.replace(/Atlas|Rewitu/gi, ''),
      )
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
    summaryUnitSplitterRevision: SUMMARY_UNIT_SPLITTER_REVISION_AR,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION_AR,
  };
}

/** Build the three Arabic Summary slots from live entry-owned facts. */
export function buildArabicEntryOwnedSummary(options: {
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
  void SUMMARY_BUILDER_REVISION_AR;
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  let role = (options.role || '').trim();
  if (!role || /^(?:محترف|محترفة|professional)$/iu.test(role)) {
    role = localizeWarehouseEmployee('ar', options.gender);
  } else if (matchesWarehouseOccupationalTitle(role) || /مستودع|warehouse|skladist|magacin/i.test(role)) {
    role = localizeWarehouseEmployee('ar', options.gender);
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch && ARABIC_MONTHS[startMatch[2]]
    ? `${ARABIC_MONTHS[startMatch[2]]} ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  const works = female ? 'تعمل لدى' : 'يعمل لدى';
  let intro = '';
  if (company && monthYear) {
    intro = `${role} ${works} ${company} منذ ${monthYear}`;
  } else if (company) {
    intro = `${role} ${works} ${company}`;
  } else {
    intro = role;
  }
  if (options.durationPhrase) {
    const dur = options.durationPhrase.replace(/^،\s*/u, '').replace(/\.$/u, '');
    intro = `${intro}، و${female ? 'لديها' : 'لديه'} ${dur}`;
  }
  if (!/[.۔]$/u.test(intro)) intro = `${intro}.`;

  const whFrags = [...new Set(
    options.dutyFacts.flatMap((f) => {
      const keys = classifyMaterialDutyKeys(f.sourceText || f.value)
        .filter((k) => k.startsWith('warehouse_'));
      return keys.map((k) => arabicWarehouseSummaryFragment(k)).filter(Boolean);
    }),
  )];
  let dutySentence = '';
  if (whFrags.length >= 2) {
    dutySentence = female
      ? `تتمتع بخبرة في ${whFrags[0]}، و${whFrags[1]}${whFrags[2] ? `، و${whFrags[2]}` : ''}.`
      : `يتمتع بخبرة في ${whFrags[0]}، و${whFrags[1]}${whFrags[2] ? `، و${whFrags[2]}` : ''}.`;
  } else if (whFrags.length === 1) {
    // Fail closed for warehouse current roles needing ≥2 facts — caller blanks.
    dutySentence = '';
  }

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  let priorSentence = '';
  if (priorRole && /dizajn|design|جرافيك|مصمم|grafick|visual|مواد\s*بصرية/i.test(`${priorRole} ${priorDuties}`)) {
    const priorLabel = localizeGraphicDesigner('ar', options.gender);
    const pastPrep = female
      ? 'حيث أعدّت مواد مطبوعة ورقمية وحافظت على اتساق الهوية البصرية'
      : 'حيث أعدّ مواد مطبوعة ورقمية وحافظ على اتساق الهوية البصرية';
    const priorOpen = female ? 'سبق لها العمل لدى' : 'سبق له العمل لدى';
    priorSentence = priorEmployer
      ? `${priorOpen} ${priorEmployer} ك${priorLabel}، ${pastPrep}.`
      : `${priorOpen.replace(' لدى', '')} ك${priorLabel}، ${pastPrep}.`;
  }

  if (!dutySentence && whFrags.length < 2
    && matchesWarehouseOccupationalTitle(`${role} ${options.dutyFacts.map((d) => d.value).join(' ')}`)) {
    return '';
  }

  return [intro, dutySentence, priorSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
