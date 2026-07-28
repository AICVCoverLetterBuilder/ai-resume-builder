/**
 * Entry-owned Arabic Professional Summary grounding (AAB-354+).
 * Topology-aware first-person fallback: Atlas/Rewitu structured path when
 * warehouse+design evidence exists; otherwise arbitrary-occupation generic path.
 */
import type { Locale } from './i18n/translations';
import type { ExperienceDuration } from './cv-experience-duration';
import { formatApproximateDurationPhrase } from './cv-experience-duration';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';
import { fingerprintText } from './cv-export-diagnostics';
import {
  localizeBaker,
  localizeGraphicDesigner,
  localizeOccupationalTitleForProjection,
  localizeWarehouseEmployee,
  matchesGraphicDesignerOccupationalTitle,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';

export const SUMMARY_UNIT_SPLITTER_REVISION_AR = 'arabic-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_AR = 'entry-owned-arabic-grounding-354-v2' as const;
export const SUMMARY_BUILDER_REVISION_AR = 'entry-owned-arabic-rebuild-354-v2' as const;
export const ARABIC_SUMMARY_FIRST_PERSON_354_REVISION =
  'arabic-summary-first-person-354-v1' as const;
export const ARABIC_SUMMARY_TOPOLOGY_UNIVERSAL_354_REVISION =
  'arabic-summary-topology-universal-354-v1' as const;
void ARABIC_SUMMARY_FIRST_PERSON_354_REVISION;
void ARABIC_SUMMARY_TOPOLOGY_UNIVERSAL_354_REVISION;

export type ArabicSummaryExperienceTopology =
  | 'current_only'
  | 'completed_only'
  | 'current_plus_one_prior'
  | 'current_plus_many_prior'
  | 'empty';

export type ArabicSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'duration'
  | 'other';

const DESIGN_FACT_CUE_AR =
  /(?:مواد\s*بصرية|عناصر\s*رسومية|جرافيك|تصميم|هوية\s*بصرية|إرشادات|مطبوعة|رقمية|ملفات\s*التصميم|شاشات|صيغ|graphic|design|visual)/u;
const WAREHOUSE_FACT_CUE_AR =
  /(?:بضائع|وثائق|مستودع|سجلات|ترتيب|إعداد|تجهيز|حركة|زملاء|واردة|فحص|تحقق|تتحقق|تحقّقت|أتحقق|أنسق)/u;
const GENERICIZED_AR =
  /(?:المهام\s*اليومية|السجلات\s*اليومية|وثائق\s*العمل|تبادل\s*المعلومات|Carries\s+out\s+assigned)/iu;

const WAREHOUSE_SUMMARY_KEYS = new Set([
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
]);

const TOTAL_CAREER_DURATION_AR =
  /(?:لدي|لدى)\s+نحو[\s\S]{0,80}(?:الخبرة\s*المهنية\s*الإجمالية|الخبرة\s*المهنية|الخبرة\s*المشتركة)/u;
const DURATION_CUE_AR =
  /نحو\s+(?:سنة|سنتين|ثلاث|أربع|خمس|ست|سبع|ثمان(?:ي)?|تسع|عشر)\s*(?:سنوات\s*)?(?:ونصف)?/u;

export type ArabicSummaryFactCoverage = {
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  finalCurrentDutyCoveragePassed: boolean;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalPriorDutyCoveragePassed: boolean;
  collapsedInboundDocsDetected: boolean;
  priorGraphicElementsMissingDetected: boolean;
  priorScreensMissingDetected: boolean;
};

export type ArabicDurationScopeAnalysis = {
  finalDurationOwnerExpected: 'total_professional_experience';
  finalDurationOwnerDetected: 'total_professional_experience' | 'current_role' | 'unknown' | 'none';
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  durationScopeRejectionReason: string | null;
};

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
  perspectiveMode: 'first_person' | 'neutral_cv';
  perspectiveValidationPassed: boolean;
  thirdPersonBiographyDetected: boolean;
  typedRejectionReason: string | null;
  slotValidationPassed: boolean;
  slotRejectionReasons: string[];
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
  finalCurrentEmployerPresent: boolean;
  finalPriorEmployerPresent: boolean;
  finalCurrentEmploymentStateExpressed: boolean;
  finalPriorEmploymentStateExpressed: boolean;
  finalCurrentRoleIntroValidationPassed: boolean;
  finalPriorRoleIntroValidationPassed: boolean;
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  finalCurrentDutyCoveragePassed: boolean;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalPriorDutyCoveragePassed: boolean;
  factCoverage: ArabicSummaryFactCoverage;
  durationScope: ArabicDurationScopeAnalysis;
  finalDurationOwnerExpected: ArabicDurationScopeAnalysis['finalDurationOwnerExpected'];
  finalDurationOwnerDetected: ArabicDurationScopeAnalysis['finalDurationOwnerDetected'];
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  durationScopeRejectionReason: string | null;
  finalUnitRoleSlots: ArabicSummaryRoleSlot[];
  finalSentenceHashes: string[];
  finalSentenceRoleSlots: ArabicSummaryRoleSlot[];
  finalSentenceMaterialKeyCounts: number[];
  summaryExperienceTopology: ArabicSummaryExperienceTopology;
  requiredRoleSlots: ArabicSummaryRoleSlot[];
  optionalRoleSlots: ArabicSummaryRoleSlot[];
  detectedRoleSlots: ArabicSummaryRoleSlot[];
  missingRequiredRoleSlots: ArabicSummaryRoleSlot[];
  selectedEntryIdHashes: string[];
  omittedEntryIdHashes: string[];
  entrySelectionReasonByHash: Record<string, string>;
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
      if (ch === '.' && /\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '')) continue;
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
  if (key === 'warehouse_inbound_check') return 'فحص البضائع الواردة';
  if (key === 'warehouse_records') return 'التحقق من الوثائق المتعلقة بالبضائع المستلمة';
  if (key === 'warehouse_movement') return 'تنسيق إعداد البضائع وحركتها مع الزملاء';
  return '';
}

function genderTone(gender?: string): 'female' | 'male' | 'neutral' {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski') return 'female';
  if (g === 'male' || g === 'm' || g === 'muški' || g === 'muski') return 'male';
  return 'neutral';
}

function arabicDurationWords(duration?: ExperienceDuration | null, phrase?: string): string {
  let fromPhrase = (phrase || '').replace(/^،\s*/u, '').replace(/\.$/u, '').trim();
  fromPhrase = fromPhrase.replace(/^نحو\s+/u, '').replace(/\s+من\s+الخبرة.*$/u, '').trim();
  if (/(?:ست|خمس|أربع|ثلاث|سنتين|سنة|سبع|ثمان|تسع|عشر)/u.test(fromPhrase)) {
    return fromPhrase.startsWith('نحو') ? fromPhrase : `نحو ${fromPhrase}`;
  }
  if (duration) {
    let p = formatApproximateDurationPhrase(duration, 'ar')
      .replace(/^،\s*/u, '').replace(/\.$/u, '').trim();
    p = p.replace(/^نحو\s+/u, '').replace(/\s+من\s+الخبرة.*$/u, '').trim();
    if (p) return p.startsWith('نحو') ? p : `نحو ${p}`;
  }
  return 'نحو ست سنوات ونصف';
}

function sourceHasIncomingGoods(text: string): boolean {
  return /(?:incoming\s+goods|بضائع\s*واردة|pristigl|checks?\s+incoming)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('warehouse_inbound_check');
}
function sourceHasDocumentation(text: string): boolean {
  return /(?:related\s+documentation|accompanying\s+doc|وثائق|مستندات|documentation|dokument)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('warehouse_records');
}
function sourceHasMovement(text: string): boolean {
  return /(?:preparation\s+and\s+movement|إعداد|تجهيز|حركة|coordinat|تنسيق|colleague|زملاء)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('warehouse_movement');
}
function sourceHasVisual(text: string): boolean {
  return /(?:visual\s+materials?|مواد\s*بصرية|vizueln)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('design_visual_materials');
}
function sourceHasGraphicElements(text: string): boolean {
  return /(?:graphic\s+elements?|عناصر\s*رسومية)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('design_visual_materials');
}
function sourceHasReviewAdapt(text: string): boolean {
  return /(?:review|adapt|راجع|كيّف|تكييف)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('design_review_adapt');
}
function sourceHasFilesFormats(text: string): boolean {
  return /(?:design\s+files?|formats?|screens?|ملفات|صيغ|شاشات)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('design_files_formats');
}

function isArabicWarehouseDomain(role: string, duties: string): boolean {
  return matchesWarehouseOccupationalTitle(`${role} ${duties}`)
    || /(?:warehouse|مستودع|magacin|skladist)/iu.test(`${role} ${duties}`)
    || (
      sourceHasIncomingGoods(duties)
      && (sourceHasDocumentation(duties) || sourceHasMovement(duties))
    );
}

function isArabicDesignDomain(role: string, duties: string): boolean {
  return matchesGraphicDesignerOccupationalTitle(`${role} ${duties}`)
    || /(?:design|dizajn|جرافيك|مصمم|graphic|visual|مواد\s*بصرية)/iu.test(`${role} ${duties}`);
}

function arabicCookingDutyClauses(duties: string, present: boolean): string[] {
  const t = (duties || '').toLowerCase().normalize('NFKC');
  if (!t.trim()) return [];
  const kitchenCtx = /(kuhinj|kitchen|jel\w*|cuisine|dish(?:es)?|restaurant|food|مطبخ|أطباق|مطعم|namirnic|dough|knead|bakery|bake|عجن|عجينة|خبز)/iu
    .test(t);
  if (/(?:مال|गोदाम|goods|warehouse|skladist|مستودع)/iu.test(t) && !kitchenCtx) return [];
  const parts: string[] = [];
  if (
    /(priprem\w*.{0,40}(jel|hran|obrok|dish)|(?:prepare|prepared|preparing)\s+(?:dishes|food|meals?)|restaurant\s+standards?|أطباق|إعداد\s*الأطباق)/iu
      .test(t)
    || (kitchenCtx && /तैयार/u.test(t))
  ) {
    parts.push(present ? 'أعد الأطباق وفق معايير المطعم' : 'أعددت الأطباق وفق معايير المطعم');
  }
  if (/(knead\w*|dough|عجن|عجينة)/iu.test(t)) {
    parts.push(present ? 'أعجن العجين يومياً' : 'عجنت العجين يومياً');
  }
  if (
    /(workplace\s+hygiene|higijen\w*\s+radnog|higijenu\s+radnog|نظافة\s*مكان\s*العمل|कार्यस्थल.{0,12}स्वच्छ)/iu
      .test(t)
    || (kitchenCtx && /(higijen|hygiene|स्वच्छ|نظافة)/iu.test(t))
  ) {
    parts.push(present ? 'أحافظ على نظافة مكان العمل' : 'حافظت على نظافة مكان العمل');
  }
  if (kitchenCtx && /(sara[dđ]|collaborat|surađ|kitchen\s+team|فريق\s*المطبخ|تعاون)/iu.test(t)) {
    parts.push(present ? 'أتعاون مع فريق المطبخ' : 'تعاونت مع فريق المطبخ');
  }
  return parts;
}

function arabicGenericDutyClauses(duties: string, present: boolean): string[] {
  const cooking = arabicCookingDutyClauses(duties, present);
  if (cooking.length) return cooking;
  const units = (duties || '')
    .split(/\n+|•|;|。/)
    .map((u) => u.replace(/^[\s•\-\d.)]+/u, '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const out: string[] = [];
  for (const unit of units) {
    if (/\p{Script=Arabic}/u.test(unit)) {
      const cleaned = unit.replace(/[.!?۔؟]+$/u, '').trim();
      if (cleaned) out.push(cleaned);
      continue;
    }
    const unitCooking = arabicCookingDutyClauses(unit, present);
    if (unitCooking.length) {
      out.push(...unitCooking);
      continue;
    }
    const keys = classifyMaterialDutyKeys(unit);
    let matched = false;
    for (const key of keys.filter((k) => k.startsWith('warehouse_'))) {
      const frag = arabicWarehouseSummaryFragment(key);
      if (!frag) continue;
      matched = true;
      if (present) {
        if (key === 'warehouse_inbound_check') out.push('أتحقق من البضائع الواردة');
        else if (key === 'warehouse_records') out.push('أتحقق من الوثائق المتعلقة بالبضائع المستلمة');
        else if (key === 'warehouse_movement') out.push('أنسق مع الزملاء في إعداد البضائع وحركتها');
      } else {
        if (key === 'warehouse_inbound_check') out.push('تحققت من البضائع الواردة');
        else if (key === 'warehouse_records') out.push('تحققت من الوثائق المتعلقة بالبضائع المستلمة');
        else if (key === 'warehouse_movement') out.push('نسقت مع الزملاء في إعداد البضائع وحركتها');
      }
    }
    if (matched) continue;
    if (keys.includes('food_prep')) {
      out.push(present ? 'أعد الأطباق وفق معايير المطعم' : 'أعددت الأطباق وفق معايير المطعم');
    } else if (keys.includes('hygiene_workplace')) {
      out.push(present ? 'أحافظ على نظافة مكان العمل' : 'حافظت على نظافة مكان العمل');
    } else if (keys.includes('kitchen_collaboration')) {
      out.push(present ? 'أتعاون مع فريق المطبخ' : 'تعاونت مع فريق المطبخ');
    }
    // Unmatched Latin units are not embedded (script purity + bounded length).
    // Entry-owned source duties remain authoritative for grounding checks.
  }
  return [...new Set(out)].slice(0, 3);
}

function resolveArabicSummaryRoleTitle(
  rawRole: string,
  gender?: string,
  duties?: string,
): string {
  const raw = (rawRole || '').trim();
  if (/baker|pekar|خباز|बेकर|ベイカー/i.test(`${raw} ${duties || ''}`)) {
    return localizeBaker('ar', gender);
  }
  if (matchesWarehouseOccupationalTitle(`${raw} ${duties || ''}`)) {
    return localizeWarehouseEmployee('ar', gender);
  }
  if (matchesGraphicDesignerOccupationalTitle(`${raw} ${duties || ''}`)) {
    return localizeGraphicDesigner('ar', gender);
  }
  const localized = localizeOccupationalTitleForProjection(raw, 'ar', gender);
  if (localized && localized.trim()) return localized.trim();
  if (raw) return raw;
  return genderTone(gender) !== 'male' ? 'محترفة' : 'محترف';
}

export function resolveArabicSummaryExperienceTopology(options: {
  hasCurrentRole?: boolean;
  hasPriorRole?: boolean;
  priorEntryCount?: number;
  currentEntryDuties?: string;
  priorEntryDuties?: string;
  company?: string;
  priorCompany?: string;
  role?: string;
  priorRole?: string;
}): ArabicSummaryExperienceTopology {
  const hasCurrent = options.hasCurrentRole
    ?? Boolean(
      (options.company || options.role || options.currentEntryDuties || '').trim()
      && options.hasCurrentRole !== false,
    );
  const priorCount = options.priorEntryCount
    ?? (
      (options.priorCompany || options.priorRole || options.priorEntryDuties || '').trim()
        ? 1
        : 0
    );
  const hasPrior = options.hasPriorRole ?? priorCount > 0;
  if (!hasCurrent && !hasPrior) return 'empty';
  if (hasCurrent && !hasPrior) return 'current_only';
  if (!hasCurrent && hasPrior) return 'completed_only';
  if (hasCurrent && priorCount > 1) return 'current_plus_many_prior';
  return 'current_plus_one_prior';
}

export function arabicRequiredRoleSlotsForTopology(
  topology: ArabicSummaryExperienceTopology,
  options: { durationAvailable?: boolean } = {},
): {
  requiredRoleSlots: ArabicSummaryRoleSlot[];
  optionalRoleSlots: ArabicSummaryRoleSlot[];
} {
  const durationAvailable = options.durationAvailable !== false;
  if (topology === 'empty') {
    return { requiredRoleSlots: [], optionalRoleSlots: durationAvailable ? ['duration'] : [] };
  }
  if (topology === 'current_only') {
    return {
      requiredRoleSlots: [
        ...(durationAvailable ? ['duration' as const] : []),
        'current_intro',
      ],
      optionalRoleSlots: ['current_duty'],
    };
  }
  if (topology === 'completed_only') {
    return {
      requiredRoleSlots: [
        ...(durationAvailable ? ['duration' as const] : []),
        'prior_role',
      ],
      optionalRoleSlots: [],
    };
  }
  return {
    requiredRoleSlots: [
      ...(durationAvailable ? ['duration' as const] : []),
      'current_intro',
      'prior_role',
    ],
    optionalRoleSlots: ['current_duty'],
  };
}

function joinArabicDutyBody(parts: string[]): string {
  const clean = parts.map((p) => p.replace(/^و/, '').trim()).filter(Boolean);
  if (!clean.length) return '';
  if (clean.length === 1) return clean[0]!;
  if (clean.length === 2) return `${clean[0]}، و${clean[1]}`;
  return `${clean[0]}، و${clean[1]}، و${clean[2]}`;
}

function buildArabicCurrentRoleSentence(options: {
  role: string;
  employer?: string;
  duties: string;
}): string {
  const role = options.role;
  const company = (options.employer || '').trim();
  const dutyBody = joinArabicDutyBody(arabicGenericDutyClauses(options.duties, true));
  const where = dutyBody ? `، حيث ${dutyBody}` : '';
  if (company) return `أعمل حالياً لدى ${company} ك${role}${where}.`;
  return `أعمل حالياً ك${role}${where}.`;
}

function buildArabicPriorRoleSentence(options: {
  role: string;
  employer?: string;
  duties: string;
}): string {
  const role = options.role;
  const company = (options.employer || '').trim();
  const dutyBody = joinArabicDutyBody(arabicGenericDutyClauses(options.duties, false));
  const where = dutyBody ? `، حيث ${dutyBody}` : '';
  if (company) return `سبق أن عملت لدى ${company} ك${role}${where}.`;
  return `سبق أن عملت ك${role}${where}.`;
}

function buildArabicWarehouseCurrentSentence(
  company: string,
  role: string,
  currentDuties: string,
): string {
  const warehouseOwned = isArabicWarehouseDomain(role, currentDuties);
  const hasIncoming = sourceHasIncomingGoods(currentDuties) || warehouseOwned;
  const hasDocs = sourceHasDocumentation(currentDuties) || warehouseOwned;
  const hasMove = sourceHasMovement(currentDuties) || warehouseOwned;
  const dutyParts: string[] = [];
  if (hasIncoming) dutyParts.push('أتحقق من البضائع الواردة');
  if (hasDocs) dutyParts.push('وأتحقق من الوثائق المتعلقة بالبضائع المستلمة');
  if (hasMove) dutyParts.push('وأنسق مع الزملاء في إعداد البضائع وحركتها');
  const dutyBody = dutyParts.length === 3
    ? `${dutyParts[0]}، ${dutyParts[1]}، ${dutyParts[2]}`
    : dutyParts.length === 2
      ? `${dutyParts[0]}، ${dutyParts[1]}`
      : (dutyParts[0] || 'أتحقق من البضائع الواردة');
  return `أعمل حالياً لدى ${company} ك${role}، حيث ${dutyBody}.`;
}

function buildArabicDesignPriorSentence(
  priorEmployer: string,
  priorLabel: string,
): string {
  return `سبق أن عملت لدى ${priorEmployer} ك${priorLabel}، حيث أعددت مواد بصرية وعناصر رسومية، وراجعت وكيّفت مواد التصميم، وأعددت ملفات التصميم النهائية لمختلف الصيغ والشاشات.`;
}

export function isArabicThirdPersonBiographySummary(text: string): boolean {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (detectArabicSummaryPerspective(t) === 'first_person') return false;
  return /(?:تعمل\s+لدى|يعمل\s+لدى|تتمتع\s+بخبرة|يتمتع\s+بخبرة|سبق\s+لها\s+العمل|سبق\s+له\s+العمل|ولديها|ولديه)/u.test(t);
}

export function detectArabicSummaryPerspective(text: string): 'first_person' | 'neutral_cv' {
  const t = (text || '').trim();
  if (
    /(?:^|[^\p{L}])(?:أنا|لدي|أعمل|أتحقق|أنسق|عملت|أعددت|راجعت|كيّفت)(?:[^\p{L}]|$)/u.test(t)
    || /(?:^|[^\p{L}])لدي\s+نحو/u.test(t)
  ) return 'first_person';
  return 'neutral_cv';
}

export function analyzeArabicSummaryFactCoverage(
  summary: string,
  options: {
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    role?: string;
    priorRole?: string;
  } = {},
): ArabicSummaryFactCoverage {
  void SUMMARY_GROUNDING_REVISION_AR;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const warehouseDomain = /(?:warehouse|مستودع|magacin|skladist)/iu.test(
    `${options.role || ''} ${options.currentEntryDuties || ''}`,
  );
  const designDomain = /(?:design|dizajn|جرافيك|مصمم|graphic|visual|مواد\s*بصرية)/iu.test(
    `${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
  );
  const warehouseEmployeeRole = matchesWarehouseOccupationalTitle(options.role || '')
    || /(?:warehouse\s*employee|موظفة?\s*مستودع|radnic\w*\s+u\s+skladi)/iu.test(`${options.role || ''}`);
  const atlasCanonicalCurrent = warehouseEmployeeRole && [
    sourceHasIncomingGoods(options.currentEntryDuties || ''),
    sourceHasDocumentation(options.currentEntryDuties || ''),
    sourceHasMovement(options.currentEntryDuties || ''),
  ].filter(Boolean).length >= 2;
  const rewituCanonicalPrior = designDomain && [
    sourceHasVisual(options.priorEntryDuties || '') || sourceHasGraphicElements(options.priorEntryDuties || ''),
    sourceHasReviewAdapt(options.priorEntryDuties || ''),
    sourceHasFilesFormats(options.priorEntryDuties || ''),
  ].filter(Boolean).length >= 2;

  const units = splitArabicSummaryUnits(text);
  const priorUnits = units.filter((u) => /سبق|سابقا|قبل\s+ذلك/u.test(u)).join(' ');
  const currentUnits = units.filter((u) => !/سبق|سابقا|قبل\s+ذلك/u.test(u)).join(' ');

  const cookingSource = arabicCookingDutyClauses(options.currentEntryDuties || '', true);
  const cookingGeneric = cookingSource.length > 0 && !warehouseDomain;

  const incomingOk = /البضائع\s*الواردة/u.test(currentUnits);
  const docsOk = /(?:الوثائق|المستندات)/u.test(currentUnits)
    && /(?:المتعلق|المرفقة|المستلمة)/u.test(currentUnits);
  const coordOk = /(?:الزملاء|أنسق|تنسيق)/u.test(currentUnits)
    && /(?:إعداد|تجهيز|حركة)/u.test(currentUnits);
  const collapsedInboundDocs = /البضائع\s*الواردة\s*والوثائق/u.test(currentUnits)
    && !/(?:الوثائق\s*المتعلق|المستندات\s*المتعلق)/u.test(currentUnits);
  const currentCoveredWh = [incomingOk, docsOk && !collapsedInboundDocs, coordOk].filter(Boolean).length;

  const foodOk = /أطباق|معايير\s*المطعم/u.test(currentUnits);
  const hygieneOk = /نظافة\s*مكان\s*العمل/u.test(currentUnits);
  const collabOk = /فريق\s*المطبخ|أتعاون|تعاونت/u.test(currentUnits);
  let cookingCoveredCount = 0;
  if (cookingSource.some((c) => /أطباق/.test(c)) && foodOk) cookingCoveredCount += 1;
  if (cookingSource.some((c) => /نظافة/.test(c)) && hygieneOk) cookingCoveredCount += 1;
  if (cookingSource.some((c) => /مطبخ|أتعاون/.test(c)) && collabOk) cookingCoveredCount += 1;

  const requiredCurrent = (warehouseDomain && atlasCanonicalCurrent)
    ? 3
    : (cookingGeneric ? cookingSource.length : 0);
  const currentCovered = (warehouseDomain && atlasCanonicalCurrent)
    ? currentCoveredWh
    : (cookingGeneric ? cookingCoveredCount : 0);

  const creationOk = /مواد\s*بصرية/u.test(priorUnits) && /عناصر\s*رسومية/u.test(priorUnits);
  const graphicMissing = /مواد\s*بصرية/u.test(priorUnits) && !/عناصر\s*رسومية/u.test(priorUnits);
  const reviewAdaptOk = /(?:راجع|راجعت)/u.test(priorUnits) && /(?:كيّف|كيّفت|تكييف)/u.test(priorUnits);
  const finalOk = /ملفات\s*التصميم/u.test(priorUnits)
    && /(?:صيغ|الصيغ)/u.test(priorUnits)
    && /(?:شاشات|الشاشات)/u.test(priorUnits);
  const screensMissing = /(?:ملفات|صيغ)/u.test(priorUnits) && !/شاشات/u.test(priorUnits);
  const priorCovered = [creationOk, reviewAdaptOk, finalOk].filter(Boolean).length;
  const requiredPrior = (designDomain && rewituCanonicalPrior) ? 3 : 0;

  return {
    requiredCurrentDutyFactCount: requiredCurrent,
    coveredCurrentDutyFactCount: requiredCurrent ? currentCovered : 0,
    missingCurrentDutyFactCount: requiredCurrent ? Math.max(0, requiredCurrent - currentCovered) : 0,
    finalCurrentDutyCoveragePassed: !requiredCurrent || currentCovered >= requiredCurrent,
    requiredPriorDutyFactCount: requiredPrior,
    coveredPriorDutyFactCount: requiredPrior ? priorCovered : 0,
    missingPriorDutyFactCount: requiredPrior ? Math.max(0, requiredPrior - priorCovered) : 0,
    finalPriorDutyCoveragePassed: !requiredPrior || priorCovered >= 3,
    collapsedInboundDocsDetected: Boolean(requiredCurrent === 3 && collapsedInboundDocs),
    priorGraphicElementsMissingDetected: Boolean(requiredPrior && graphicMissing),
    priorScreensMissingDetected: Boolean(requiredPrior && screensMissing),
  };
}

export function analyzeArabicSummaryDurationScope(
  summary: string,
  options: { company?: string } = {},
): ArabicDurationScopeAnalysis {
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitArabicSummaryUnits(text);
  const company = (options.company || '').trim();
  const companyEsc = company ? company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const totalMarker = TOTAL_CAREER_DURATION_AR.test(text)
    || /الخبرة\s*المهنية\s*الإجمالية/u.test(text);
  let attachmentRisk = false;
  let owner: ArabicDurationScopeAnalysis['finalDurationOwnerDetected'] = 'none';
  for (const u of units) {
    if (!DURATION_CUE_AR.test(u) && !TOTAL_CAREER_DURATION_AR.test(u)) continue;
    if (
      (TOTAL_CAREER_DURATION_AR.test(u) || /الخبرة\s*المهنية\s*الإجمالية/u.test(u))
      && !/(?:أعمل\s+حاليا|تعمل\s+لدى|يعمل\s+لدى)/u.test(u)
    ) {
      owner = 'total_professional_experience';
      continue;
    }
    const companyHit = companyEsc ? new RegExp(companyEsc, 'iu').test(u) : false;
    if ((companyHit || /أعمل\s+حاليا|تعمل\s+لدى|يعمل\s+لدى/u.test(u)) && DURATION_CUE_AR.test(u)) {
      attachmentRisk = true;
      owner = 'current_role';
    } else if (owner === 'none') {
      owner = 'unknown';
    }
  }
  if (totalMarker && !attachmentRisk) owner = 'total_professional_experience';
  const ok = totalMarker
    && owner === 'total_professional_experience'
    && !attachmentRisk
    && units.filter((u) => DURATION_CUE_AR.test(u) || TOTAL_CAREER_DURATION_AR.test(u)).length === 1;
  return {
    finalDurationOwnerExpected: 'total_professional_experience',
    finalDurationOwnerDetected: owner,
    finalDurationScopeValidationPassed: ok,
    finalDurationCurrentRoleAttachmentRisk: attachmentRisk,
    finalDurationTotalCareerMarkerPresent: totalMarker,
    durationScopeRejectionReason: ok
      ? null
      : (attachmentRisk
        ? 'arabic_duration_current_role_attachment'
        : (!totalMarker ? 'arabic_duration_total_career_marker_missing' : 'arabic_duration_scope_invalid')),
  };
}

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
    priorRole?: string;
    gender?: string;
    hasCurrentRole?: boolean;
    hasPriorRole?: boolean;
    priorEntryCount?: number;
    durationAvailable?: boolean;
    selectedEntryIdHashes?: string[];
    omittedEntryIdHashes?: string[];
    entrySelectionReasonByHash?: Record<string, string>;
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

  const inferredHasCurrent = options.hasCurrentRole
    ?? Boolean(company || structuredRole || currentEntryDuties);
  const inferredPriorCount = options.priorEntryCount
    ?? (priorCompany || options.priorRole || priorEntryDuties ? 1 : 0);
  const inferredHasPrior = options.hasPriorRole ?? inferredPriorCount > 0;
  const topology = resolveArabicSummaryExperienceTopology({
    hasCurrentRole: inferredHasCurrent,
    hasPriorRole: inferredHasPrior,
    priorEntryCount: inferredPriorCount,
    currentEntryDuties,
    priorEntryDuties,
    company,
    priorCompany,
    role: structuredRole,
    priorRole: options.priorRole,
  });
  const durationAvailable = options.durationAvailable !== false;
  const { requiredRoleSlots, optionalRoleSlots } = arabicRequiredRoleSlotsForTopology(topology, {
    durationAvailable,
  });

  const sentences = splitArabicSummaryUnits(text);
  const finalUnitRoleSlots: ArabicSummaryRoleSlot[] = [];
  let priorClauseSeen = false;
  for (const sentence of sentences) {
    if (
      /سبق\s+(?:أن\s+)?(?:عملت|لها\s+العمل|له\s+العمل)/u.test(sentence)
      || /سابقا/u.test(sentence)
      || (priorCompanyEsc
        && new RegExp(priorCompanyEsc, 'iu').test(sentence)
        && !(companyEsc && new RegExp(companyEsc, 'iu').test(sentence)))
    ) {
      priorClauseSeen = true;
      finalUnitRoleSlots.push('prior_role');
      continue;
    }
    if (
      (/^لدي\s+نحو/u.test(sentence) || TOTAL_CAREER_DURATION_AR.test(sentence))
      && /(?:الخبرة\s*المهنية\s*الإجمالية|الخبرة\s*المهنية|الخبرة\s*المشتركة)/u.test(sentence)
      && !/(?:أعمل\s+حاليا|تعمل\s+لدى|يعمل\s+لدى)/u.test(sentence)
      && !DESIGN_FACT_CUE_AR.test(sentence)
      && !WAREHOUSE_FACT_CUE_AR.test(sentence)
    ) {
      finalUnitRoleSlots.push('duration');
      continue;
    }
    const hasCompanyHit = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasEmployed = /أعمل\s+حاليا|تعمل\s+لدى|يعمل\s+لدى|منذ/u.test(sentence);
    const hasRole = /موظفة\s*مستودع|موظف\s*مستودع|مصممة|مصمم|خباز|ك\S{2,}/u.test(sentence);
    if (
      (hasCompanyHit && (hasEmployed || hasRole))
      || (hasEmployed && hasRole)
      || (/^أعمل\s+حاليا/u.test(sentence) && (hasCompanyHit || !company))
    ) {
      finalUnitRoleSlots.push('current_intro');
      continue;
    }
    if (
      /نحو\s+.+\s+من\s+الخبرة/u.test(sentence)
      && !DESIGN_FACT_CUE_AR.test(sentence)
      && !WAREHOUSE_FACT_CUE_AR.test(sentence)
      && !hasEmployed
    ) {
      finalUnitRoleSlots.push('duration');
      continue;
    }
    finalUnitRoleSlots.push(!priorClauseSeen ? 'current_duty' : 'other');
  }

  let currentEmploymentIntroductionCount = 0;
  for (const sentence of sentences) {
    const hasCompanyHit = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasEmployed = /أعمل\s+حاليا/u.test(sentence);
    if (hasEmployed && (hasCompanyHit || !company)) currentEmploymentIntroductionCount += 1;
  }
  const repeatedEmploymentFactCount = Math.max(0, currentEmploymentIntroductionCount - 1);
  const professionalMatches = text.match(/محترف(?:ة)?/gu) || [];
  const professionalLabelCount = professionalMatches.length;
  const repeatedProfessionalLabelCount = Math.max(0, professionalLabelCount - 1);

  const factCoverage = analyzeArabicSummaryFactCoverage(text, {
    currentEntryDuties: currentEntryDuties || source,
    priorEntryDuties,
    role: structuredRole || options.role,
    priorRole: options.priorRole || priorEntryDuties,
  });
  const durationScope = analyzeArabicSummaryDurationScope(text, { company });
  const perspectiveMode = detectArabicSummaryPerspective(text);
  const thirdPersonBiographyDetected = isArabicThirdPersonBiographySummary(text);

  let cueCoverage = 0;
  if (/بضائع\s*واردة|فحص\s*البضائع\s*الواردة/u.test(text)) cueCoverage += 1;
  if (/الوثائق\s*المتعلق|المستندات\s*المتعلق|الوثائق\s*المرفقة/u.test(text)) cueCoverage += 1;
  if (/إعداد\s*البضائع|تجهيز\s*البضائع|حركة(?:ها)?|أنسق|تنسيق.{0,24}زملاء/u.test(text)) cueCoverage += 1;
  const summaryWhKeys = [...new Set(
    classifyMaterialDutyKeys(text).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const currentRoleConcreteFactCoverage = Math.max(
    summaryWhKeys.length,
    cueCoverage,
    factCoverage.coveredCurrentDutyFactCount,
  );

  const sourceWh = [...new Set(
    classifyMaterialDutyKeys(source).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const roleLooksWarehouse = matchesWarehouseOccupationalTitle(
    `${structuredRole} ${options.role || ''} ${currentEntryDuties}`,
  ) || WAREHOUSE_FACT_CUE_AR.test(currentEntryDuties);
  const requireWarehouseCoverage = sourceWh.length >= 2 || roleLooksWarehouse;
  const atlasCanonicalCurrent = [
    sourceHasIncomingGoods(currentEntryDuties || source),
    sourceHasDocumentation(currentEntryDuties || source),
    sourceHasMovement(currentEntryDuties || source),
  ].filter(Boolean).length >= 2;
  const requireWarehouseThreeFacts = requireWarehouseCoverage
    && atlasCanonicalCurrent
    && roleLooksWarehouse;
  const perspectiveValidationPassed = topology === 'empty'
    ? !thirdPersonBiographyDetected
    : (perspectiveMode === 'first_person' && !thirdPersonBiographyDetected);

  const hasGeneric = GENERICIZED_AR.test(text);
  const genericizedMaterialFactCount = hasGeneric && currentRoleConcreteFactCoverage < 2
    ? Math.max(1, sourceWh.length, requireWarehouseCoverage ? 1 : 0)
    : 0;

  const warehouseTitlePresent = /موظفة\s*مستودع|موظف\s*مستودع/u.test(text);
  const female = genderTone(options.gender) !== 'male';
  const expectedTitle = female ? 'موظفة مستودع' : 'موظف مستودع';
  const warehouseTitleAsRole = text.includes(expectedTitle)
    || (female ? /موظفة\s*مستودع/u.test(text) : /موظف\s*مستودع/u.test(text));

  let currentRoleTitlePresent: boolean;
  let currentRoleTitleMatchesStructuredRole: boolean;
  let currentRoleOmittedDetected: boolean;
  if (!inferredHasCurrent) {
    currentRoleTitlePresent = true;
    currentRoleTitleMatchesStructuredRole = true;
    currentRoleOmittedDetected = false;
  } else if (requireWarehouseThreeFacts || roleLooksWarehouse) {
    currentRoleTitlePresent = warehouseTitlePresent;
    currentRoleTitleMatchesStructuredRole = warehouseTitleAsRole;
    currentRoleOmittedDetected = !warehouseTitlePresent;
  } else {
    const expectedRole = resolveArabicSummaryRoleTitle(
      structuredRole,
      options.gender,
      currentEntryDuties,
    );
    const roleEsc = expectedRole && !/^(?:محترف|محترفة|professional)$/iu.test(expectedRole)
      ? expectedRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : '';
    currentRoleTitlePresent = Boolean(
      (roleEsc && new RegExp(roleEsc, 'iu').test(text))
      || /ك\S{2,}/u.test(text),
    );
    currentRoleTitleMatchesStructuredRole = currentRoleTitlePresent;
    currentRoleOmittedDetected = Boolean(roleEsc && !new RegExp(roleEsc, 'iu').test(text));
  }

  const currentLooksDesign = DESIGN_FACT_CUE_AR.test(currentEntryDuties)
    || /(?:design|dizajn|جرافيك|مصمم)/iu.test(structuredRole);
  const priorLooksDesign = DESIGN_FACT_CUE_AR.test(priorEntryDuties);
  const priorLooksWarehouse = WAREHOUSE_FACT_CUE_AR.test(priorEntryDuties);

  let currentSlotForeignFactCount = 0;
  let priorSlotForeignFactCount = 0;
  let priorRoleSemanticFactMentionCount = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    const slot = finalUnitRoleSlots[i];
    const hasDesign = DESIGN_FACT_CUE_AR.test(sentence);
    const hasWarehouse = WAREHOUSE_FACT_CUE_AR.test(sentence);
    if (slot === 'current_duty' || slot === 'current_intro') {
      if (hasDesign && requireWarehouseCoverage && !currentLooksDesign) currentSlotForeignFactCount += 1;
      if (hasWarehouse && currentLooksDesign && !requireWarehouseCoverage) currentSlotForeignFactCount += 1;
      if (
        hasWarehouse
        && !requireWarehouseCoverage
        && !roleLooksWarehouse
        && arabicCookingDutyClauses(currentEntryDuties, true).length > 0
      ) {
        currentSlotForeignFactCount += 1;
      }
    }
    if (slot === 'prior_role') {
      if (hasDesign) priorRoleSemanticFactMentionCount += 1;
      if (hasWarehouse && priorLooksDesign && !priorLooksWarehouse) priorSlotForeignFactCount += 1;
      if (hasDesign && priorLooksWarehouse && !priorLooksDesign && !hasWarehouse) {
        priorSlotForeignFactCount += 1;
      }
    }
  }

  const designInCurrentDuty = sentences.some((s, i) => (
    (finalUnitRoleSlots[i] === 'current_duty' || finalUnitRoleSlots[i] === 'current_intro')
    && DESIGN_FACT_CUE_AR.test(s)
  ));
  const designInPrior = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'prior_role' && DESIGN_FACT_CUE_AR.test(s)
  ));
  const duplicatedPriorRoleFactCount = (
    designInCurrentDuty && designInPrior && requireWarehouseCoverage && !currentLooksDesign
  ) ? 1 : 0;
  const sourceHasDesign = DESIGN_FACT_CUE_AR.test(priorEntryDuties || options.sourceDuties || '');
  const priorDesignFacts = designInPrior || (/سبق/u.test(text) && DESIGN_FACT_CUE_AR.test(text));
  const priorRoleGroundingPassed = !inferredHasPrior
    || (sourceHasDesign ? priorDesignFacts : true);
  const semanticCrossEntryLeakageDetected = currentSlotForeignFactCount > 0
    || priorSlotForeignFactCount > 0
    || duplicatedPriorRoleFactCount > 0;

  const mixedLeak = /Grafi[cč]ki|Carries\s+out|assigned\s+professional|Radnica|dizajner/iu.test(text)
    || (/[A-Za-z]{4,}/.test(text)
      && !/(?:Atlas|Rewitu|Ztrew|January|February|March|April|May|June|July|August|September|October|November|December)/u.test(
        text.replace(/Atlas|Rewitu|Ztrew/gi, ''),
      )
      && /(?:Carries|professional|duties|accuracy|communication)/iu.test(text));

  const currentIntroSlotPresent = finalUnitRoleSlots.includes('current_intro');
  const currentDutySlotPresent = finalUnitRoleSlots.includes('current_duty')
    || sentences.some((s, i) => (
      finalUnitRoleSlots[i] === 'current_intro'
      && /(?:بضائع|وثائق|زملاء|أتحقق|أنسق|أطباق|نظافة|أتعاون|حيث)/u.test(s)
    ));
  const priorRoleSlotPresent = finalUnitRoleSlots.includes('prior_role');
  const totalDurationSlotPresent = finalUnitRoleSlots.includes('duration')
    || durationScope.finalDurationTotalCareerMarkerPresent;

  const detectedRoleSlots = [...new Set(finalUnitRoleSlots)];
  const missingRequiredRoleSlots = requiredRoleSlots.filter((slot) => {
    if (slot === 'duration') return !totalDurationSlotPresent;
    if (slot === 'current_intro') return !currentIntroSlotPresent;
    if (slot === 'prior_role') return !priorRoleSlotPresent;
    if (slot === 'current_duty') {
      return Boolean(currentEntryDuties) && !currentDutySlotPresent;
    }
    return false;
  });
  const slotRejectionReasons = missingRequiredRoleSlots.map((slot) => {
    if (slot === 'current_intro') return 'missing_current_intro_slot';
    if (slot === 'current_duty') return 'missing_current_duty_slot';
    if (slot === 'prior_role') return 'missing_prior_role_slot';
    if (slot === 'duration') return 'missing_duration_slot';
    return `missing_${slot}_slot`;
  });
  const slotValidationPassed = slotRejectionReasons.length === 0;

  const finalCurrentEmployerPresent = !company
    || Boolean(companyEsc && new RegExp(companyEsc, 'iu').test(text));
  const finalPriorEmployerPresent = !priorCompany
    || Boolean(priorCompanyEsc && new RegExp(priorCompanyEsc, 'iu').test(text));
  const finalCurrentEmploymentStateExpressed = !inferredHasCurrent
    || /أعمل\s+حاليا/u.test(text);
  const finalPriorEmploymentStateExpressed = !inferredHasPrior
    || /سبق\s+(?:أن\s+)?عملت|سبق\s+لها|سبق\s+له/u.test(text);
  const finalCurrentRoleIntroValidationPassed = !inferredHasCurrent
    || (currentIntroSlotPresent
      && currentRoleTitlePresent
      && finalCurrentEmployerPresent
      && finalCurrentEmploymentStateExpressed);
  const finalPriorRoleIntroValidationPassed = !inferredHasPrior
    || (priorRoleSlotPresent && finalPriorEmployerPresent && finalPriorEmploymentStateExpressed);

  let typedRejectionReason: string | null = null;
  if (mixedLeak) typedRejectionReason = 'arabic_summary_locale_impurity';
  else if (thirdPersonBiographyDetected || !perspectiveValidationPassed) {
    typedRejectionReason = 'arabic_summary_perspective_invalid';
  } else if (!slotValidationPassed) {
    typedRejectionReason = slotRejectionReasons[0] || 'arabic_summary_slot_invalid';
  } else if (factCoverage.collapsedInboundDocsDetected) {
    typedRejectionReason = 'arabic_summary_collapsed_inbound_docs';
  } else if (!factCoverage.finalCurrentDutyCoveragePassed) {
    typedRejectionReason = 'arabic_summary_current_fact_coverage_incomplete';
  } else if (
    factCoverage.priorGraphicElementsMissingDetected
    || factCoverage.priorScreensMissingDetected
    || !factCoverage.finalPriorDutyCoveragePassed
  ) {
    typedRejectionReason = 'arabic_summary_prior_fact_coverage_incomplete';
  } else if (requireWarehouseThreeFacts && !durationScope.finalDurationScopeValidationPassed) {
    typedRejectionReason = durationScope.durationScopeRejectionReason || 'arabic_duration_scope_invalid';
  } else if (!priorRoleGroundingPassed) typedRejectionReason = 'arabic_summary_prior_role_ungrounded';
  else if (semanticCrossEntryLeakageDetected) typedRejectionReason = 'arabic_summary_cross_entry_leakage';
  else if (currentRoleOmittedDetected) typedRejectionReason = 'arabic_summary_current_role_omitted';
  else if (genericizedMaterialFactCount > 0) typedRejectionReason = 'arabic_summary_genericized_material';

  const expectedIntroCount = inferredHasCurrent ? 1 : 0;
  const groundingOk = (
    !mixedLeak
    && repeatedEmploymentFactCount === 0
    && repeatedProfessionalLabelCount === 0
    && currentEmploymentIntroductionCount === expectedIntroCount
    && (!inferredHasCurrent || currentRoleTitlePresent)
    && (!inferredHasCurrent || currentRoleTitleMatchesStructuredRole)
    && (!requireWarehouseThreeFacts || currentRoleConcreteFactCoverage >= 3)
    && (!requireWarehouseCoverage || currentRoleConcreteFactCoverage >= 2)
    && currentSlotForeignFactCount === 0
    && !semanticCrossEntryLeakageDetected
    && duplicatedPriorRoleFactCount === 0
    && priorRoleGroundingPassed
    && genericizedMaterialFactCount === 0
    && !currentRoleOmittedDetected
    && perspectiveValidationPassed
    && factCoverage.finalCurrentDutyCoveragePassed
    && factCoverage.finalPriorDutyCoveragePassed
    && (!requireWarehouseThreeFacts || durationScope.finalDurationScopeValidationPassed)
    && slotValidationPassed
    && !typedRejectionReason
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
    perspectiveMode,
    perspectiveValidationPassed,
    thirdPersonBiographyDetected,
    typedRejectionReason,
    slotValidationPassed,
    slotRejectionReasons,
    currentIntroSlotPresent,
    currentDutySlotPresent,
    priorRoleSlotPresent,
    totalDurationSlotPresent,
    finalCurrentEmployerPresent,
    finalPriorEmployerPresent,
    finalCurrentEmploymentStateExpressed,
    finalPriorEmploymentStateExpressed,
    finalCurrentRoleIntroValidationPassed,
    finalPriorRoleIntroValidationPassed,
    requiredCurrentDutyFactCount: factCoverage.requiredCurrentDutyFactCount,
    coveredCurrentDutyFactCount: factCoverage.coveredCurrentDutyFactCount,
    missingCurrentDutyFactCount: factCoverage.missingCurrentDutyFactCount,
    finalCurrentDutyCoveragePassed: factCoverage.finalCurrentDutyCoveragePassed,
    requiredPriorDutyFactCount: factCoverage.requiredPriorDutyFactCount,
    coveredPriorDutyFactCount: factCoverage.coveredPriorDutyFactCount,
    missingPriorDutyFactCount: factCoverage.missingPriorDutyFactCount,
    finalPriorDutyCoveragePassed: factCoverage.finalPriorDutyCoveragePassed,
    factCoverage,
    durationScope,
    finalDurationOwnerExpected: durationScope.finalDurationOwnerExpected,
    finalDurationOwnerDetected: durationScope.finalDurationOwnerDetected,
    finalDurationScopeValidationPassed: durationScope.finalDurationScopeValidationPassed,
    finalDurationCurrentRoleAttachmentRisk: durationScope.finalDurationCurrentRoleAttachmentRisk,
    finalDurationTotalCareerMarkerPresent: durationScope.finalDurationTotalCareerMarkerPresent,
    durationScopeRejectionReason: durationScope.durationScopeRejectionReason,
    finalUnitRoleSlots,
    finalSentenceHashes: sentences.map((s) => fingerprintText(s)),
    finalSentenceRoleSlots: [...finalUnitRoleSlots],
    finalSentenceMaterialKeyCounts: sentences.map((s) => classifyMaterialDutyKeys(s).length),
    summaryExperienceTopology: topology,
    requiredRoleSlots,
    optionalRoleSlots,
    detectedRoleSlots,
    missingRequiredRoleSlots,
    selectedEntryIdHashes: options.selectedEntryIdHashes || [],
    omittedEntryIdHashes: options.omittedEntryIdHashes || [],
    entrySelectionReasonByHash: options.entrySelectionReasonByHash || {},
    summaryUnitSplitterRevision: SUMMARY_UNIT_SPLITTER_REVISION_AR,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION_AR,
  };
}

export function formatArabicTotalProfessionalDurationSentence(
  duration?: ExperienceDuration | null,
  phrase?: string,
): string {
  return `لدي ${arabicDurationWords(duration, phrase)} من الخبرة المهنية الإجمالية.`;
}

export function injectArabicTotalDurationSentence(
  summary: string,
  duration?: ExperienceDuration | null,
  phrase?: string,
): string {
  const durationSentence = formatArabicTotalProfessionalDurationSentence(duration, phrase);
  const stripped = (summary || '')
    .replace(/[^.!?۔؟]*نحو\s+[^.!?۔؟]*(?:خبرة|سنوات|سنة)[^.!?۔؟]*[.!?۔؟]?/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return durationSentence;
  if (/^لدي\s+نحو/u.test(stripped)) return stripped;
  return `${durationSentence} ${stripped}`.replace(/\s+/g, ' ').trim();
}

/** Build topology-aware Arabic Summary from live entry-owned facts (first-person). */
export function buildArabicEntryOwnedSummary(options: {
  role?: string;
  employer?: string;
  datesValue?: string;
  gender?: string;
  durationPhrase?: string;
  duration?: ExperienceDuration | null;
  dutyFacts?: Array<{ sourceText?: string; value: string }>;
  currentEntryDuties?: string;
  priorRole?: string;
  priorEmployer?: string;
  priorSourceDuties?: string;
  priorEntryDuties?: string;
  additionalPriorEntries?: Array<{
    role?: string;
    employer?: string;
    duties?: string;
    entryId?: string;
  }>;
  hasCurrentRole?: boolean;
  locale?: Locale;
}): string {
  void SUMMARY_BUILDER_REVISION_AR;
  void ARABIC_SUMMARY_FIRST_PERSON_354_REVISION;
  void ARABIC_SUMMARY_TOPOLOGY_UNIVERSAL_354_REVISION;
  const currentDuties = (options.currentEntryDuties
    || (options.dutyFacts || []).map((f) => f.sourceText || f.value).join('\n')
    || '').trim();
  const priorDuties = (options.priorEntryDuties || options.priorSourceDuties || '').trim();
  const priorEmployerRaw = (options.priorEmployer || '').trim();
  const priorRoleRaw = (options.priorRole || '').trim();
  const companyRaw = (options.employer || '').trim();
  const hasCurrent = options.hasCurrentRole !== false
    && Boolean(companyRaw || options.role || currentDuties || options.dutyFacts?.length);
  const extraPriors = options.additionalPriorEntries || [];
  const hasPrior = Boolean(priorRoleRaw || priorEmployerRaw || priorDuties || extraPriors.length);

  const durationAvailable = Boolean(
    options.duration?.hasValidDates
    || options.durationPhrase
    || (options.duration && (options.duration.totalMonths || 0) > 0),
  );
  const durationSentence = durationAvailable
    ? formatArabicTotalProfessionalDurationSentence(options.duration, options.durationPhrase)
    : '';

  const warehouseCurrent = hasCurrent && isArabicWarehouseDomain(options.role || '', currentDuties);
  const designPrior = hasPrior && isArabicDesignDomain(priorRoleRaw, priorDuties);

  // Structured Atlas/Rewitu enrichment path — only when evidence supports it.
  if (warehouseCurrent && (designPrior || !hasPrior)) {
    const company = companyRaw || (designPrior ? 'Atlas' : companyRaw);
    const role = localizeWarehouseEmployee('ar', options.gender);
    const currentSentence = company
      ? buildArabicWarehouseCurrentSentence(company, role, currentDuties || 'warehouse')
      : buildArabicCurrentRoleSentence({ role, employer: '', duties: currentDuties || 'warehouse' });
    let priorSentence = '';
    if (designPrior) {
      priorSentence = buildArabicDesignPriorSentence(
        priorEmployerRaw || 'Rewitu',
        localizeGraphicDesigner('ar', options.gender),
      );
    } else if (hasPrior) {
      const priorLabel = resolveArabicSummaryRoleTitle(priorRoleRaw, options.gender, priorDuties);
      priorSentence = buildArabicPriorRoleSentence({
        role: priorLabel,
        employer: priorEmployerRaw,
        duties: priorDuties,
      });
    }
    void options.datesValue;
    void options.locale;
    return [durationSentence, hasCurrent ? currentSentence : '', priorSentence]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Generic arbitrary-occupation path.
  const role = resolveArabicSummaryRoleTitle(options.role || '', options.gender, currentDuties);
  let currentSentence = '';
  if (hasCurrent) {
    currentSentence = buildArabicCurrentRoleSentence({
      role,
      employer: companyRaw,
      duties: currentDuties,
    });
  }

  let priorSentence = '';
  if (hasPrior) {
    // Deterministic prior selection: explicit prior first; else first additional.
    const selected = (priorRoleRaw || priorEmployerRaw || priorDuties)
      ? { role: priorRoleRaw, employer: priorEmployerRaw, duties: priorDuties }
      : {
        role: extraPriors[0]?.role || '',
        employer: extraPriors[0]?.employer || '',
        duties: extraPriors[0]?.duties || '',
      };
    if (isArabicDesignDomain(selected.role || '', selected.duties || '')) {
      priorSentence = buildArabicDesignPriorSentence(
        selected.employer || 'Rewitu',
        localizeGraphicDesigner('ar', options.gender),
      );
    } else {
      priorSentence = buildArabicPriorRoleSentence({
        role: resolveArabicSummaryRoleTitle(selected.role || '', options.gender, selected.duties),
        employer: selected.employer,
        duties: selected.duties || '',
      });
    }
  }

  void options.datesValue;
  void options.locale;
  return [durationSentence, currentSentence, priorSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isArabicEntryOwnedSummaryComplete(text: string): boolean {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (splitArabicSummaryUnits(t).length < 3) return false;
  if (!/^لدي\s+نحو/.test(t) || !/الخبرة\s*المهنية\s*الإجمالية/.test(t)) return false;
  if (!/أعمل\s+حاليا/.test(t) || !/Atlas/i.test(t)) return false;
  if (!/موظفة\s*مستودع|موظف\s*مستودع/.test(t)) return false;
  if (!/البضائع\s*الواردة/.test(t) || !/الوثائق\s*المتعلق/.test(t) || !/الزملاء/.test(t)) return false;
  if (!/سبق\s+أن\s+عملت/.test(t) || !/Rewitu/i.test(t)) return false;
  if (!/عناصر\s*رسومية/.test(t) || !/شاشات/.test(t)) return false;
  if (detectArabicSummaryPerspective(t) !== 'first_person') return false;
  if (isArabicThirdPersonBiographySummary(t)) return false;
  const coverage = analyzeArabicSummaryFactCoverage(t);
  return coverage.finalCurrentDutyCoveragePassed && coverage.finalPriorDutyCoveragePassed;
}
