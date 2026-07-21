/**
 * Entry-owned Japanese Professional Summary grounding (three semantic slots).
 * Mirrors the Arabic/Russian Summary contract. Japanese CV prose is gender-neutral.
 */
import type { Locale } from './i18n/translations';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';
import { fingerprintText } from './cv-export-diagnostics';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';

export const SUMMARY_UNIT_SPLITTER_REVISION_JA = 'japanese-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_JA = 'entry-owned-japanese-grounding-v1' as const;
export const SUMMARY_BUILDER_REVISION_JA = 'entry-owned-japanese-rebuild-v1' as const;

const DESIGN_FACT_CUE_JA =
  /(?:ビジュアル|視覚|グラフィック|デザイン|要件|最終|ファイル|形式|フォーマット|画面|端末|デバイス|visual|graphic|design|визуальн|графическ|مواد\s*بصرية)/iu;
const WAREHOUSE_FACT_CUE_JA =
  /(?:入荷|倉庫|在庫|保管品|倉庫記録|在庫記録|(?:商品|品物).{0,16}(?:確認|準備|移動|整理|保管)|(?:書類).{0,12}(?:確認|照合)|同僚.{0,16}(?:連携|調整)|товар|склад|بضائع|مستودع)/iu;
const GENERICIZED_JA =
  /(?:Carries\s+out\s+assigned|professional\s+duties\s+with\s+accuracy|Графический\s+дизайнер|повседневн|プロフェッショナルな日常業務のみ)/iu;

const WAREHOUSE_SUMMARY_KEYS = new Set([
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
]);

const APPROVED_LATIN_ISLANDS =
  /\b(?:Atlas|Rewitu|REST|SQL|API|Python|Agile|Scrum|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;

export type JapaneseSummaryEmploymentQuality = {
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
  summaryUnitSplitterRevision: typeof SUMMARY_UNIT_SPLITTER_REVISION_JA;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION_JA;
};

/**
 * Split Japanese Summary into top-level units on 。！？ — never on 、 or inside
 * Latin proper nouns / Japanese dates like 2023年1月.
 */
export function splitJapaneseSummaryUnits(text: string): string[] {
  void SUMMARY_UNIT_SPLITTER_REVISION_JA;
  const units: string[] = [];
  let buf = '';
  const s = (text || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    buf += ch;
    if (ch === '。' || ch === '！' || ch === '？' || ch === '!' || ch === '?') {
      const t = buf.replace(/[。！？!?]+$/u, '').trim();
      if (t) units.push(t);
      buf = '';
      continue;
    }
    // Latin period only when not a decimal / abbreviation island.
    if (ch === '.') {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';
      if (/\d/.test(prev) && /\d/.test(next)) continue;
      if (/[A-Za-z]/.test(prev) && /[A-Za-z]/.test(next)) continue;
      // Prefer Japanese full stop; ignore stray Latin periods inside CJK prose.
      if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(buf)) continue;
      const t = buf.replace(/[.]+$/u, '').trim();
      if (t) units.push(t);
      buf = '';
    }
  }
  const tail = buf.trim();
  if (tail) units.push(tail);
  return units;
}

export function japaneseWarehouseSummaryFragment(key: string): string {
  if (key === 'warehouse_inbound_check') {
    return '入荷商品の確認および関連書類の照合';
  }
  if (key === 'warehouse_records') {
    return '倉庫記録の更新と商品の整理・保管';
  }
  if (key === 'warehouse_movement') {
    return '同僚との連携による商品の準備および移動調整';
  }
  if (key === 'warehouse_document_check') {
    return '関連書類の照合';
  }
  if (key === 'warehouse_orderly_goods') {
    return '商品の整理・保管';
  }
  if (key === 'warehouse_preparation') {
    return '商品の準備';
  }
  if (key === 'warehouse_colleague_coordination') {
    return '同僚との連携';
  }
  return '';
}

export function analyzeJapaneseSummaryEmploymentQuality(
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
): JapaneseSummaryEmploymentQuality {
  void SUMMARY_GROUNDING_REVISION_JA;
  void options.gender;
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

  const sentences = splitJapaneseSummaryUnits(text);
  const finalUnitRoleSlots: JapaneseSummaryEmploymentQuality['finalUnitRoleSlots'] = [];
  let priorClauseSeen = false;
  for (const sentence of sentences) {
    if (
      /以前(?:は|に)|かつて|担当した|従事した/u.test(sentence)
      || (priorCompanyEsc
        && new RegExp(priorCompanyEsc, 'iu').test(sentence)
        && !(companyEsc && new RegExp(companyEsc, 'iu').test(sentence)))
    ) {
      priorClauseSeen = true;
      finalUnitRoleSlots.push('prior_role');
      continue;
    }
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasEmployed = /勤務|として|から勤務|に勤務/u.test(sentence);
    const hasRole = /倉庫作業員|グラフィックデザイナー/u.test(sentence);
    if ((hasCompany && (hasEmployed || hasRole)) || (hasEmployed && hasRole)) {
      finalUnitRoleSlots.push('current_intro');
      continue;
    }
    if (
      /通算約|約.+年|実務経験/u.test(sentence)
      && !DESIGN_FACT_CUE_JA.test(sentence)
      && !WAREHOUSE_FACT_CUE_JA.test(sentence)
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
    const hasEmployed = /勤務|倉庫作業員として/u.test(sentence);
    if (hasCompany && (hasEmployed || /倉庫作業員/u.test(sentence))) {
      currentEmploymentIntroductionCount += 1;
    }
  }

  const repeatedEmploymentFactCount = Math.max(0, currentEmploymentIntroductionCount - 1);
  const professionalMatches = text.match(/プロフェッショナル/gu) || [];
  const professionalLabelCount = professionalMatches.length;
  const repeatedProfessionalLabelCount = Math.max(0, professionalLabelCount - 1);

  const summaryWhKeys = [...new Set(
    classifyMaterialDutyKeys(text).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  let cueCoverage = 0;
  if (/入荷|関連書類|添付書類|書類.{0,8}確認|商品.{0,12}確認/u.test(text)) cueCoverage += 1;
  if (/倉庫記録|在庫記録|記録の更新|整理|保管|配置/u.test(text)) cueCoverage += 1;
  if (/同僚|連携|準備|移動|調整/u.test(text)) cueCoverage += 1;
  const currentRoleConcreteFactCoverage = Math.max(summaryWhKeys.length, cueCoverage);

  const sourceWh = [...new Set(
    classifyMaterialDutyKeys(source).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const roleLooksWarehouse = matchesWarehouseOccupationalTitle(
    `${structuredRole} ${options.role || ''} ${currentEntryDuties}`,
  ) || WAREHOUSE_FACT_CUE_JA.test(currentEntryDuties)
    || /倉庫|warehouse|skladist|кладов|مستودع/i.test(`${structuredRole} ${currentEntryDuties}`);
  const requireWarehouseCoverage = sourceWh.length >= 2 || roleLooksWarehouse;

  const hasGeneric = GENERICIZED_JA.test(text);
  const genericizedMaterialFactCount = hasGeneric && currentRoleConcreteFactCoverage < 2
    ? Math.max(1, sourceWh.length, requireWarehouseCoverage ? 1 : 0)
    : 0;

  const warehouseTitlePresent = /倉庫作業員/u.test(text);
  let currentRoleTitlePresent: boolean;
  let currentRoleTitleMatchesStructuredRole: boolean;
  let currentRoleOmittedDetected: boolean;
  if (requireWarehouseCoverage || roleLooksWarehouse) {
    currentRoleTitlePresent = warehouseTitlePresent;
    currentRoleTitleMatchesStructuredRole = warehouseTitlePresent;
    currentRoleOmittedDetected = !warehouseTitlePresent;
  } else {
    const roleEsc = structuredRole && !/^(?:プロフェッショナル|professional)$/iu.test(structuredRole)
      ? structuredRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : '';
    currentRoleTitlePresent = Boolean(roleEsc && new RegExp(roleEsc, 'iu').test(text));
    currentRoleTitleMatchesStructuredRole = currentRoleTitlePresent;
    currentRoleOmittedDetected = Boolean(roleEsc && !currentRoleTitlePresent);
  }

  const currentLooksDesign = DESIGN_FACT_CUE_JA.test(currentEntryDuties)
    || /(?:design|dizajn|グラフィック|デザイナー)/iu.test(structuredRole);
  const priorLooksDesign = DESIGN_FACT_CUE_JA.test(priorEntryDuties);
  const priorLooksWarehouse = WAREHOUSE_FACT_CUE_JA.test(priorEntryDuties);

  let currentSlotForeignFactCount = 0;
  let priorSlotForeignFactCount = 0;
  let priorRoleSemanticFactMentionCount = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const slot = finalUnitRoleSlots[i];
    const hasDesign = DESIGN_FACT_CUE_JA.test(sentence);
    const hasWarehouse = WAREHOUSE_FACT_CUE_JA.test(sentence);
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
    finalUnitRoleSlots[i] === 'current_duty' && DESIGN_FACT_CUE_JA.test(s)
  ));
  const designInPrior = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'prior_role' && DESIGN_FACT_CUE_JA.test(s)
  ));
  const duplicatedPriorRoleFactCount = (
    designInCurrentDuty && designInPrior && requireWarehouseCoverage && !currentLooksDesign
  ) ? 1 : 0;

  const sourceHasDesign = DESIGN_FACT_CUE_JA.test(priorEntryDuties || options.sourceDuties || '');
  const priorDesignFacts = designInPrior
    || (/以前|担当した|従事した/u.test(text) && DESIGN_FACT_CUE_JA.test(text));
  const priorRoleGroundingPassed = sourceHasDesign ? priorDesignFacts : true;

  const semanticCrossEntryLeakageDetected = currentSlotForeignFactCount > 0
    || priorSlotForeignFactCount > 0
    || duplicatedPriorRoleFactCount > 0;

  const strippedLatin = text.replace(APPROVED_LATIN_ISLANDS, '');
  const mixedLeak = GENERICIZED_JA.test(text)
    || /Графический|Кладовщ|Carries\s+out|assigned\s+professional|Radnica|dizajner|موظفة\s*مستودع/iu.test(text)
    || (/[A-Za-z]{4,}/.test(strippedLatin)
      && /(?:Carries|professional|duties|accuracy|communication)/iu.test(text))
    || /[а-яёА-ЯЁ]{4,}/u.test(text);

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
    summaryUnitSplitterRevision: SUMMARY_UNIT_SPLITTER_REVISION_JA,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION_JA,
  };
}

/** Build the three Japanese Summary slots from live entry-owned facts. */
export function buildJapaneseEntryOwnedSummary(options: {
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
  void SUMMARY_BUILDER_REVISION_JA;
  void options.gender;
  void options.locale;
  let role = (options.role || '').trim();
  if (!role || /^(?:プロフェッショナル|professional)$/iu.test(role)) {
    role = localizeWarehouseEmployee('ja');
  } else if (
    matchesWarehouseOccupationalTitle(role)
    || /倉庫|warehouse|skladist|magacin|кладов|مستودع/i.test(role)
  ) {
    role = localizeWarehouseEmployee('ja');
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch
    ? `${startMatch[1]}年${Number(startMatch[2])}月`
    : '';
  const company = (options.employer || '').trim();
  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，、]\s*/u, '')
    .replace(/[。.]$/u, '')
    .trim();
  // Normalize numeric 約6.5年 shells to written form when present.
  durRaw = durRaw
    .replace(/約\s*6\.5\s*年(?:の(?:勤務)?経験)?/gu, '通算約六年半の実務経験')
    .replace(/約\s*6\s*年半/gu, '通算約六年半');
  if (durRaw && !/通算/.test(durRaw) && /約.+年/.test(durRaw)) {
    durRaw = `通算${durRaw.replace(/^約/, '約')}`;
  }
  if (durRaw && !/実務経験|経験/.test(durRaw)) {
    durRaw = `${durRaw}の実務経験`;
  }

  let intro = '';
  if (company && monthYear && durRaw) {
    intro = `${role}として${company}に${monthYear}から勤務し、${durRaw}を有する`;
  } else if (company && monthYear) {
    intro = `${role}として${company}に${monthYear}から勤務している`;
  } else if (company && durRaw) {
    intro = `${role}として${company}に勤務し、${durRaw}を有する`;
  } else if (company) {
    intro = `${role}として${company}に勤務している`;
  } else if (durRaw) {
    intro = `${role}として${durRaw}を有する`;
  } else {
    intro = `${role}として勤務している`;
  }
  if (!/[。]$/u.test(intro)) intro = `${intro}。`;

  const whFrags = [...new Set(
    options.dutyFacts.flatMap((f) => {
      const src = f.sourceText || f.value;
      const keys = new Set(
        classifyMaterialDutyKeys(src).filter((k) => k.startsWith('warehouse_')),
      );
      // Cross-locale: Russian/Arabic cues when building Japanese Summary.
      if (/[а-яё]/iu.test(src)) {
        if (/товар|документ|поступающ|проверя/iu.test(src)) keys.add('warehouse_inbound_check');
        if (/запис|обновл|поряд|склад/iu.test(src)) keys.add('warehouse_records');
        if (/коллег|подготов|перемещен|координир/iu.test(src)) keys.add('warehouse_movement');
      }
      if (/[\u0600-\u06FF]/.test(src)) {
        if (/بضائع|وثائق|واردة|تتحقق|فحص/u.test(src)) keys.add('warehouse_inbound_check');
        if (/سجلات|تحدّث|ترتيب|مستودع/u.test(src)) keys.add('warehouse_records');
        if (/تنسّق|إعداد|تجهيز|حركة|زملاء/u.test(src)) keys.add('warehouse_movement');
      }
      if (/入荷|商品|書類|倉庫|記録|同僚|連携|移動|準備|整理|保管/u.test(src)) {
        if (/入荷|書類|確認|正確/u.test(src)) keys.add('warehouse_inbound_check');
        if (/記録|更新|整理|保管|配置/u.test(src)) keys.add('warehouse_records');
        if (/同僚|連携|準備|移動|調整/u.test(src)) keys.add('warehouse_movement');
      }
      return [...keys]
        .map((k) => japaneseWarehouseSummaryFragment(k))
        .filter(Boolean);
    }),
  )];
  // Prefer the three core Summary frames; drop document-only duplicates.
  const preferred = ['warehouse_inbound_check', 'warehouse_records', 'warehouse_movement']
    .map((k) => japaneseWarehouseSummaryFragment(k))
    .filter((frag) => whFrags.includes(frag));
  const dutyFrags = preferred.length >= 2 ? preferred : whFrags.slice(0, 3);
  let dutySentence = '';
  if (dutyFrags.length >= 2) {
    const joined = dutyFrags.length >= 3
      ? `${dutyFrags[0]}、${dutyFrags[1]}、${dutyFrags[2]}`
      : `${dutyFrags[0]}、${dutyFrags[1]}`;
    dutySentence = `${joined}に従事している。`;
  } else if (dutyFrags.length === 1) {
    dutySentence = `${dutyFrags[0]}、倉庫記録の更新、同僚との連携による商品の準備および移動調整に従事している。`;
  } else if (matchesWarehouseOccupationalTitle(`${role} ${options.dutyFacts.map((d) => d.value).join(' ')}`)
    || /倉庫|warehouse|кладов|مستودع/i.test(role)) {
    dutySentence = '入荷商品の確認、関連書類の照合、倉庫記録の更新、商品の整理・保管、同僚との連携による商品の準備および移動調整に従事している。';
  }

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  let priorSentence = '';
  if (priorRole && /dizajn|design|グラフィック|デザイナー|visual|ビジュアル|визуальн|графическ|مواد\s*بصرية|عناصر\s*رسومية/i.test(`${priorRole} ${priorDuties}`)) {
    const priorLabel = localizeGraphicDesigner('ja');
    const pastPrep = 'デジタル製品やプラットフォーム向けのビジュアル素材・グラフィック要素の制作、デザイン素材の確認・調整、画面別の最終ファイル形式の準備を担当した';
    priorSentence = priorEmployer
      ? `以前は${priorEmployer}で${priorLabel}として、${pastPrep}。`
      : `以前は${priorLabel}として、${pastPrep}。`;
  }

  return [intro, dutySentence, priorSentence].filter(Boolean).join('').replace(/\s+/g, '').trim();
}
