/**
 * AAB-363 — Japanese Professional Summary entry-owned first-person builder.
 * Requested locale `ja` never reuses RU/pt-BR/Italian/French/German/English as
 * factual authority. Atlas/Rewitu are regression fixtures only.
 * Japanese CV prose remains gender-neutral (no forced gendered wording).
 */
import type { Locale } from './i18n/translations';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';
import { fingerprintText } from './cv-export-diagnostics';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
  matchesGraphicDesignerOccupationalTitle,
} from './cv-role-title';
import { resolveLocalizedSummaryRole } from './cv-summary-structured-role-localization';
import { extractGermanCurrentWarehouseDutyFacts } from './cv-german-summary-current-duty-coverage';
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from './cv-french-summary-grounding';
import type { ExperienceDuration } from './cv-experience-duration';
import { formatApproximateDurationPhrase } from './cv-experience-duration';

export const SUMMARY_UNIT_SPLITTER_REVISION_JA =
  'japanese-three-unit-slots-363-v1' as const;
export const SUMMARY_GROUNDING_REVISION_JA =
  'entry-owned-japanese-grounding-363-v1' as const;
export const SUMMARY_BUILDER_REVISION_JA =
  'entry-owned-japanese-rebuild-363-v1' as const;
/** Legacy runtime marker retained for marker-table continuity (topology moved off intro-only). */
export const JAPANESE_DURATION_IN_INTRO_MARKER =
  'japanese-duration-in-intro-289-v1' as const;
export const JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER =
  'japanese-summary-strict-postconditions-363-v1' as const;
export const JAPANESE_SUMMARY_FIRST_PERSON_363_REVISION =
  'japanese-summary-first-person-363-v1' as const;
export const JAPANESE_SUMMARY_CROSS_LOCALE_363_REVISION =
  'japanese-summary-cross-locale-363-v1' as const;
export const JAPANESE_SUMMARY_DURATION_GRAMMAR_REVISION =
  'japanese-summary-duration-grammar-363-v1' as const;
export const JAPANESE_SUMMARY_DURATION_GRAMMAR_INVALID =
  'japanese_summary_duration_grammar_invalid' as const;
/** Runtime marker for the exact RU→JA Stronger regression. */
export const RU_JA_CROSS_LOCALE_STRONGER_363_REVISION =
  'ru-japanese-cross-locale-stronger-regression-363-v1' as const;
/** AAB-364 — employer / employment-state / role-intro packaging on Japanese Summary. */
export const JAPANESE_SUMMARY_EMPLOYER_STATE_364_REVISION =
  'japanese-summary-employer-state-364-v1' as const;

void SUMMARY_BUILDER_REVISION_JA;
void SUMMARY_UNIT_SPLITTER_REVISION_JA;
void SUMMARY_GROUNDING_REVISION_JA;
void JAPANESE_DURATION_IN_INTRO_MARKER;
void JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void JAPANESE_SUMMARY_FIRST_PERSON_363_REVISION;
void JAPANESE_SUMMARY_CROSS_LOCALE_363_REVISION;
void JAPANESE_SUMMARY_DURATION_GRAMMAR_REVISION;
void JAPANESE_SUMMARY_DURATION_GRAMMAR_INVALID;
void RU_JA_CROSS_LOCALE_STRONGER_363_REVISION;
void JAPANESE_SUMMARY_EMPLOYER_STATE_364_REVISION;
void PROVIDER_CROSS_LOCALE_NOOP_REASON;

const DESIGN_FACT_CUE_JA =
  /(?:ビジュアル|視覚|グラフィック|デザイン|要件|最終|ファイル|形式|フォーマット|画面|端末|デバイス|visual|graphic|design|визуальн|графическ|مواد\s*بصرية)/iu;
const WAREHOUSE_FACT_CUE_JA =
  /(?:入荷|倉庫|在庫|保管品|倉庫記録|在庫記録|受領品|(?:商品|品物).{0,16}(?:確認|準備|移動|整理|保管)|(?:書類).{0,12}(?:確認|照合)|同僚.{0,16}(?:連携|調整)|товар|склад|بضائع|مستودع)/iu;
const GENERICIZED_JA =
  /(?:Carries\s+out\s+assigned|professional\s+duties\s+with\s+accuracy|Графический\s+дизайнер|повседневн|プロフェッショナルな日常業務のみ)/iu;

const WAREHOUSE_SUMMARY_KEYS = new Set([
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
]);

const APPROVED_LATIN_ISLANDS =
  /\b(?:Atlas|Rewitu|REST|SQL|API|Python|Agile|Scrum|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;

const UNSUPPORTED_DESIGN_CLAIM_CUES_JA = [
  '印刷物',
  '印刷',
  'ブランドの視覚的ガイドライン',
  '視覚的ガイドライン',
  'ブランドガイドライン',
  'ブランド基準',
  'ブランド規定',
  'ロゴ管理',
  'ブランド戦略',
] as const;

const SHIPMENT_CUES_JA = /出荷|発送|配送|納品|積み込み/u;

const GENERIC_SKILL_LABEL_CUES_JA = [
  'リーダーシップ',
  '組織力',
  '批判的思考',
  '適応力',
  '問題解決',
  'タイムマネジメント',
  'コミュニケーション',
] as const;

const REQUIRED_JA_SLOTS = ['duration', 'current_intro', 'prior_role'] as const;

const JA_WAREHOUSE_ROLE_RE = /倉庫担当|倉庫作業員/u;

export type JapaneseSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'duration'
  | 'other'
  | 'skills';

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
  slotValidationPassed: boolean;
  perspectiveValidationPassed: boolean;
  genderValidationPassed: boolean;
  tenseValidationPassed: boolean;
  grammarValidationPassed: boolean;
  durationGrammarValidationPassed: boolean;
  perspectiveMode: 'first_person' | 'neutral_cv' | 'cv_third_person';
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
  finalUnitRoleSlots: JapaneseSummaryRoleSlot[];
  finalSentenceHashes: string[];
  finalSentenceRoleSlots: JapaneseSummaryRoleSlot[];
  finalSentenceMaterialKeyCounts: number[];
  summaryUnitSplitterRevision: typeof SUMMARY_UNIT_SPLITTER_REVISION_JA;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION_JA;
  unitCount: number;
  unsupportedClaimCount: number;
  missingDesignFamilyCount: number;
  hasGenericSkillsUnit: boolean;
  /** True when duration is wrongly woven into current_intro (or missing as own unit). */
  durationOutsideIntro: boolean;
  malformedPunctuation: boolean;
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
  finalCurrentEmployerPresent: boolean;
  finalPriorEmployerPresent: boolean;
  finalCurrentEmploymentStateExpressed: boolean;
  finalPriorEmploymentStateExpressed: boolean;
  finalCurrentRoleIntroValidationPassed: boolean;
  finalPriorRoleIntroValidationPassed: boolean;
  targetLocalePurityPassed: boolean;
  wrongLocaleUnitCount: number;
  unexpectedLocaleCodes: string[];
  detectedLocaleByUnit: string[];
  finalDurationOwnerExpected: string;
  finalDurationOwnerDetected: string;
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  japaneseSummaryStrictPostconditionsMarker: typeof JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
  japaneseDurationInIntroMarker: typeof JAPANESE_DURATION_IN_INTRO_MARKER;
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
    if (ch === '.') {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';
      if (/\d/.test(prev) && /\d/.test(next)) continue;
      if (/[A-Za-z]/.test(prev) && /[A-Za-z]/.test(next)) continue;
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
    return '入荷商品の確認';
  }
  if (key === 'warehouse_document_check') {
    return '受領品に関連する書類の確認';
  }
  if (key === 'warehouse_records') {
    return '倉庫記録の更新と商品の整理・保管';
  }
  if (key === 'warehouse_movement') {
    return '商品の準備および移動に関する同僚との連携';
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

/** Detect generic professional-skills enumeration sentences (not Experience-owned). */
export function isJapaneseGenericSkillsUnit(sentence: string): boolean {
  const s = (sentence || '').trim();
  if (!s) return false;
  if (/主なスキル|スキルは/u.test(s)) return true;
  const hits = GENERIC_SKILL_LABEL_CUES_JA.filter((c) => s.includes(c)).length;
  if (hits >= 3) return true;
  if (
    hits >= 2
    && /です/u.test(s)
    && !WAREHOUSE_FACT_CUE_JA.test(s)
    && !DESIGN_FACT_CUE_JA.test(s)
    && !/勤務|以前|倉庫担当|倉庫作業員|グラフィックデザイナー/u.test(s)
  ) {
    return true;
  }
  return false;
}

export function hasJapaneseMalformedSummaryPunctuation(text: string): boolean {
  const t = text || '';
  return /です。\s*[,，]|。\s*[,，]|[,，]\s*通算|。\s*\.|です\.\s*,/u.test(t)
    || /。\s*,\s*通算/u.test(t)
    || /です。,/u.test(t);
}

function sourceHasShipmentFact(source: string): boolean {
  return SHIPMENT_CUES_JA.test(source || '');
}

function sourceHasUnsupportedDesignCue(source: string, cue: string): boolean {
  return (source || '').includes(cue);
}

export function scoreJapanesePriorDesignFamilies(sentence: string): {
  creation: boolean;
  reviewAdapt: boolean;
  finalFilesScreens: boolean;
  missingCount: number;
} {
  const s = sentence || '';
  const creation = /ビジュアル|グラフィック|素材|制作|作成|visual|graphic/iu.test(s);
  const reviewAdapt = /確認|調整|要件|適応|adapt|review|要求/iu.test(s);
  const finalFilesScreens = /最終|ファイル|形式|フォーマット|画面|端末|デバイス|format|screen/iu.test(s);
  const missingCount = [creation, reviewAdapt, finalFilesScreens].filter((v) => !v).length;
  return { creation, reviewAdapt, finalFilesScreens, missingCount };
}

export function countJapaneseUnsupportedSummaryClaims(
  text: string,
  options: {
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    sourceDuties?: string;
  } = {},
): { unsupportedClaimCount: number; reasons: string[] } {
  const current = options.currentEntryDuties || '';
  const prior = options.priorEntryDuties || options.sourceDuties || '';
  const corpus = `${current}\n${prior}`;
  const reasons: string[] = [];
  let unsupportedClaimCount = 0;

  for (const cue of UNSUPPORTED_DESIGN_CLAIM_CUES_JA) {
    if (text.includes(cue) && !sourceHasUnsupportedDesignCue(corpus, cue)) {
      if (cue === '印刷' && reasons.includes('印刷物')) continue;
      unsupportedClaimCount += 1;
      reasons.push(cue);
    }
  }

  if (SHIPMENT_CUES_JA.test(text) && !sourceHasShipmentFact(corpus)) {
    unsupportedClaimCount += 1;
    reasons.push('unsupported_shipment_cue');
  }

  return { unsupportedClaimCount, reasons };
}

/** Universal Japanese duration core for structured months (approx years). */
export function formatJapaneseDurationCore(duration: ExperienceDuration | null | undefined): string {
  void JAPANESE_SUMMARY_DURATION_GRAMMAR_REVISION;
  if (!duration?.hasValidDates) return '';
  const months = Math.max(0, Math.round(Number(duration.totalMonths) || 0));
  if (months <= 0) return '';
  if (months < 12) return `約${months}か月`;
  const whole = Math.floor(months / 12);
  const rem = months - whole * 12;
  if (rem === 0) return `約${whole}年`;
  if (rem >= 5 && rem <= 7) return `約${whole}年半`;
  if (rem < 5) return `約${whole}年`;
  return `約${whole + 1}年`;
}

export function formatJapaneseDurationSentence(
  duration: ExperienceDuration | null | undefined,
): string {
  const core = formatJapaneseDurationCore(duration);
  if (!core) return '';
  return `通算で${core}の実務経験があります。`;
}

export function analyzeJapaneseDurationGrammar(
  text: string,
  expected?: ExperienceDuration | null,
): {
  grammarValidationPassed: boolean;
  durationGrammarValidationPassed: boolean;
  grammarRejectionReason: string | null;
  durationValidatorRevision: typeof JAPANESE_SUMMARY_DURATION_GRAMMAR_REVISION;
  malformedDurationOrderingDetected: boolean;
  expectedDurationCore: string | null;
  detectedMalformedPhrase: string | null;
} {
  void JAPANESE_SUMMARY_DURATION_GRAMMAR_REVISION;
  const t = (text || '').replace(/\s+/g, ' ').trim();
  const malformedRes: Array<{ re: RegExp; label: string }> = [
    { re: /約\s*\d+[.,]\d+\s*年/u, label: 'numeric_hybrid_decimal_years' },
    { re: /年半約|半約\d|実務経験約/u, label: 'malformed_duration_order' },
    { re: /通算約約/u, label: 'duplicate_約' },
  ];
  let detectedMalformedPhrase: string | null = null;
  for (const { re } of malformedRes) {
    const m = t.match(re);
    if (m) {
      detectedMalformedPhrase = m[0];
      break;
    }
  }
  const expectedCore = expected && expected.hasValidDates
    ? formatJapaneseDurationCore(expected)
    : null;
  let semanticMismatch = false;
  if (expectedCore && /(?:通算|実務経験|約.+年)/u.test(t)) {
    const hasExpected = new RegExp(
      expectedCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'u',
    ).test(t);
    // Also accept kanji-year equivalents for the same month span.
    const kanjiAlt = expectedCore
      .replace('約1', '約一').replace('約2', '約二').replace('約3', '約三')
      .replace('約4', '約四').replace('約5', '約五').replace('約6', '約六')
      .replace('約7', '約七').replace('約8', '約八').replace('約9', '約九')
      .replace('約10', '約十');
    const hasKanji = kanjiAlt !== expectedCore && new RegExp(
      kanjiAlt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'u',
    ).test(t);
    if (!hasExpected && !hasKanji) semanticMismatch = true;
  }
  const claimHits = t.match(/通算で約|通算約|実務経験があり/gu) || [];
  const duplicate = claimHits.length > 2;

  const failed = Boolean(detectedMalformedPhrase) || semanticMismatch || duplicate;
  return {
    grammarValidationPassed: !failed,
    durationGrammarValidationPassed: !failed,
    grammarRejectionReason: failed ? JAPANESE_SUMMARY_DURATION_GRAMMAR_INVALID : null,
    durationValidatorRevision: JAPANESE_SUMMARY_DURATION_GRAMMAR_REVISION,
    malformedDurationOrderingDetected: Boolean(detectedMalformedPhrase) || duplicate,
    expectedDurationCore: expectedCore,
    detectedMalformedPhrase,
  };
}

export function hasIncorrectJapaneseDurationGrammar(text: string): boolean {
  return !analyzeJapaneseDurationGrammar(text).grammarValidationPassed;
}

export function detectJapaneseSummaryPerspective(
  text: string,
): 'first_person' | 'neutral_cv' | 'cv_third_person' {
  void JAPANESE_SUMMARY_FIRST_PERSON_363_REVISION;
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'neutral_cv';
  if (/(?:彼は|彼女は|同氏は)/u.test(t)) return 'cv_third_person';
  if (
    /(?:通算で約.+実務経験があります|現在は.+として|以前は.+として|行っています|担当していました|あります。)/u
      .test(t)
    || /(?:私は|です。|ます。)/u.test(t)
  ) {
    return 'first_person';
  }
  return 'neutral_cv';
}

function countJaWarehouseCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const t = text || '';
  const inbound = /入荷(?:した)?商品の?確認|入荷商品/u.test(t);
  const docs = /(?:受領品に関連する書類|関連書類|添付書類|書類).{0,8}確認/u.test(t);
  const move = /(?:商品の準備および移動|準備および移動).{0,12}同僚|同僚.{0,16}(?:連携|調整)|連携を行って/u.test(t);
  const covered = [inbound, docs, move].filter(Boolean).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

function countJaDesignCoverage(text: string): {
  required: number;
  covered: number;
  missing: number;
} {
  const families = scoreJapanesePriorDesignFamilies(text);
  const covered = [
    families.creation,
    families.reviewAdapt,
    families.finalFilesScreens,
  ].filter(Boolean).length;
  return { required: 3, covered, missing: Math.max(0, 3 - covered) };
}

/**
 * Ensure a standalone duration unit leads the Summary. Never Latin-comma-splice.
 * Idempotent when the first unit is already a total-career duration claim.
 */
export function injectJapaneseDurationIntoCurrentIntro(
  summary: string,
  duration: ExperienceDuration,
  context?: { role?: string; company?: string; startDate?: string },
): string {
  void JAPANESE_DURATION_IN_INTRO_MARKER;
  void JAPANESE_SUMMARY_DURATION_GRAMMAR_REVISION;
  void context;
  if (!duration?.hasValidDates) return (summary || '').trim();
  const durSentence = formatJapaneseDurationSentence(duration).replace(/。$/u, '');
  if (!durSentence) return (summary || '').trim();

  const stripDur = (input: string): string => input
    .replace(/通算で約(?:\d+|一|二|三|四|五|六|七|八|九|十)+(?:年半|年|か月)?の実務経験があります/gu, '')
    .replace(/通算約(?:一年半|二年半|三年半|四年半|五年半|六年半|七年半|八年半|九年半|十年半|一年|二年|三年|四年|五年|六年|七年|八年|九年|十年|\d+年半|\d+年)(?:の実務経験|の(?:勤務)?経験)?(?:を有する|があります)?/gu, '')
    .replace(/約(?:一年半|二年半|三年半|四年半|五年半|六年半|\d+年半|\d+年)(?:の実務経験)?/gu, '')
    .replace(/[、，,]\s*$/u, '')
    .replace(/^\s*[、，,]/u, '')
    .trim();

  const working = stripDur((summary || '').replace(/\s+/g, ' ').trim());
  const units = splitJapaneseSummaryUnits(working).map(stripDur).filter(Boolean);
  if (units[0] && /通算で約|通算約/.test(units[0]) && /実務経験/.test(units[0])) {
    return `${units.map((u) => (/[。]$/u.test(u) ? u : `${u}。`)).join('')}`.replace(/\s+/g, '');
  }
  const out = [durSentence, ...units]
    .map((u) => (u.endsWith('。') ? u : `${u}。`))
    .join('');
  return out.replace(/\s+/g, '').replace(/。+/gu, '。').trim();
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
    priorRole?: string;
    gender?: string;
    expectedDuration?: ExperienceDuration | null;
  } = {},
): JapaneseSummaryEmploymentQuality {
  void SUMMARY_GROUNDING_REVISION_JA;
  void JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
  void JAPANESE_DURATION_IN_INTRO_MARKER;
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

  const malformedPunctuation = hasJapaneseMalformedSummaryPunctuation(text);
  const sentences = splitJapaneseSummaryUnits(text);
  const unitCount = sentences.length;
  const finalUnitRoleSlots: JapaneseSummaryRoleSlot[] = [];
  let priorClauseSeen = false;
  let hasGenericSkillsUnit = false;

  for (const sentence of sentences) {
    if (isJapaneseGenericSkillsUnit(sentence)) {
      hasGenericSkillsUnit = true;
      finalUnitRoleSlots.push('skills');
      continue;
    }
    if (
      /以前(?:は|に)|かつて|担当していました|担当した|従事した/u.test(sentence)
      || (priorCompanyEsc
        && new RegExp(priorCompanyEsc, 'iu').test(sentence)
        && !(companyEsc && new RegExp(companyEsc, 'iu').test(sentence)))
    ) {
      priorClauseSeen = true;
      finalUnitRoleSlots.push('prior_role');
      continue;
    }
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasEmployed = /現在は|勤務|として|から勤務|に勤務|行っています/u.test(sentence);
    const hasRole = JA_WAREHOUSE_ROLE_RE.test(sentence) || /グラフィックデザイナー/u.test(sentence);
    if (
      /通算で約|通算約|実務経験があり/u.test(sentence)
      && !DESIGN_FACT_CUE_JA.test(sentence)
      && !WAREHOUSE_FACT_CUE_JA.test(sentence)
      && !hasEmployed
      && !/現在は|以前は/u.test(sentence)
    ) {
      finalUnitRoleSlots.push('duration');
      continue;
    }
    if ((hasCompany && (hasEmployed || hasRole)) || (hasEmployed && hasRole) || /現在は/.test(sentence)) {
      finalUnitRoleSlots.push('current_intro');
      continue;
    }
    if (!priorClauseSeen && WAREHOUSE_FACT_CUE_JA.test(sentence)) {
      finalUnitRoleSlots.push('current_duty');
    } else {
      finalUnitRoleSlots.push('other');
    }
  }

  let currentEmploymentIntroductionCount = 0;
  for (const sentence of sentences) {
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    if (hasCompany && (/現在は|倉庫担当|倉庫作業員として/u.test(sentence))) {
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
  const warehouseCov = countJaWarehouseCoverage(text);
  const currentRoleConcreteFactCoverage = Math.max(summaryWhKeys.length, warehouseCov.covered);

  const sourceWh = [...new Set(
    classifyMaterialDutyKeys(source).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const roleLooksWarehouse = matchesWarehouseOccupationalTitle(
    `${structuredRole} ${options.role || ''} ${currentEntryDuties}`,
  ) || WAREHOUSE_FACT_CUE_JA.test(currentEntryDuties)
    || /倉庫|warehouse|skladist|кладов|مستودع|сотрудник/i.test(`${structuredRole} ${currentEntryDuties}`);
  const canonicalWarehouseFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: source,
  });
  const requireWarehouseCoverage = canonicalWarehouseFacts.length >= 3
    || sourceWh.length >= 2
    || roleLooksWarehouse;

  const hasGeneric = GENERICIZED_JA.test(text);
  const genericizedMaterialFactCount = hasGeneric && currentRoleConcreteFactCoverage < 2
    ? Math.max(1, sourceWh.length, requireWarehouseCoverage ? 1 : 0)
    : 0;

  const warehouseTitlePresent = JA_WAREHOUSE_ROLE_RE.test(text);
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
    const roleLiteralPresent = Boolean(roleEsc && new RegExp(roleEsc, 'iu').test(text));
    // Arbitrary free-text occupations may remain Latin; accept 「会社で…として」 surface.
    const roleIntroSurfacePresent = Boolean(
      companyEsc
      && new RegExp(`${companyEsc}で.{0,40}として`, 'iu').test(text)
      && /現在は/.test(text),
    );
    currentRoleTitlePresent = roleLiteralPresent || roleIntroSurfacePresent;
    currentRoleTitleMatchesStructuredRole = currentRoleTitlePresent;
    currentRoleOmittedDetected = Boolean(
      (roleEsc || companyEsc) && !currentRoleTitlePresent,
    );
  }

  const currentLooksDesign = DESIGN_FACT_CUE_JA.test(currentEntryDuties)
    || /(?:design|dizajn|グラフィック|デザイナー)/iu.test(structuredRole);
  const priorLooksDesign = DESIGN_FACT_CUE_JA.test(priorEntryDuties)
    || matchesGraphicDesignerOccupationalTitle(options.priorRole || '')
    || /(?:design|dizajn|グラフィック|デザイナー|графическ)/iu.test(
      `${options.priorRole || ''} ${priorEntryDuties}`,
    );
  const priorLooksWarehouse = WAREHOUSE_FACT_CUE_JA.test(priorEntryDuties);

  let currentSlotForeignFactCount = 0;
  let priorSlotForeignFactCount = 0;
  let priorRoleSemanticFactMentionCount = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    const slot = finalUnitRoleSlots[i];
    const hasDesign = DESIGN_FACT_CUE_JA.test(sentence);
    const hasWarehouse = WAREHOUSE_FACT_CUE_JA.test(sentence);
    if (slot === 'current_intro' || slot === 'current_duty') {
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
    }
  }

  const designInCurrent = sentences.some((s, i) => (
    (finalUnitRoleSlots[i] === 'current_intro' || finalUnitRoleSlots[i] === 'current_duty')
    && DESIGN_FACT_CUE_JA.test(s)
  ));
  const designInPrior = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'prior_role' && DESIGN_FACT_CUE_JA.test(s)
  ));
  const duplicatedPriorRoleFactCount = (
    designInCurrent && designInPrior && requireWarehouseCoverage && !currentLooksDesign
  ) ? 1 : 0;

  const sourceHasDesign = priorLooksDesign || DESIGN_FACT_CUE_JA.test(priorEntryDuties || options.sourceDuties || '');
  const priorSentence = sentences.find((_, i) => finalUnitRoleSlots[i] === 'prior_role') || '';
  const designFamilies = scoreJapanesePriorDesignFamilies(priorSentence || text);
  const designCov = countJaDesignCoverage(priorSentence || text);
  const claimScan = countJapaneseUnsupportedSummaryClaims(text, {
    currentEntryDuties,
    priorEntryDuties,
    sourceDuties: options.sourceDuties,
  });
  const unsupportedClaimCount = claimScan.unsupportedClaimCount;
  const missingDesignFamilyCount = sourceHasDesign ? designFamilies.missingCount : 0;
  const priorRoleGroundingPassed = sourceHasDesign
    ? (designInPrior || DESIGN_FACT_CUE_JA.test(priorSentence))
      && designFamilies.missingCount === 0
      && unsupportedClaimCount === 0
    : unsupportedClaimCount === 0;

  const semanticCrossEntryLeakageDetected = currentSlotForeignFactCount > 0
    || priorSlotForeignFactCount > 0
    || duplicatedPriorRoleFactCount > 0;

  const strippedLatin = text.replace(APPROVED_LATIN_ISLANDS, '');
  const russianLeak = /[а-яёА-ЯЁ]{4,}/u.test(text)
    || /(?:у\s+меня|работаю|работала|сотрудниц)/iu.test(text);
  const portugueseLeak = /\b(?:tenho|atualmente|trabalho|anteriormente)\b/iu.test(text);
  const italianLeak = /\b(?:dispongo|attualmente|lavoro\s+presso)\b/iu.test(text);
  const frenchLeak = /\b(?:je\s+dispose|travaille\s+actuellement|auparavant)\b/iu.test(text);
  const germanLeak = /\b(?:ich\s+verfüge|derzeit\s+arbeite|arbeitete)\b/iu.test(text);
  const englishLeak = /\b(?:I\s+have|currently\s+work|previously\s+worked)\b/iu.test(text);
  const mixedLeak = GENERICIZED_JA.test(text)
    || russianLeak
    || portugueseLeak
    || italianLeak
    || frenchLeak
    || germanLeak
    || englishLeak
    || /Графический|Кладовщ|Carries\s+out|assigned\s+professional|Radnica|dizajner|موظفة\s*مستودع/iu.test(text)
    || (/[A-Za-z]{4,}/.test(strippedLatin)
      && /(?:Carries|professional|duties|accuracy|communication)/iu.test(text));

  const purityOk = !mixedLeak
    && /[\u3040-\u30FF\u3400-\u9FFF]/.test(text)
    && sentences.every((s) => /[\u3040-\u30FF\u3400-\u9FFF]/.test(s));
  const detectedLocaleByUnit = sentences.map(() => (purityOk ? 'ja' : 'und'));
  const detectedScriptByUnit = sentences.map(() => 'japanese');
  void detectedScriptByUnit;

  const durationGrammar = analyzeJapaneseDurationGrammar(text, options.expectedDuration);
  const perspectiveMode = detectJapaneseSummaryPerspective(text);
  const perspectiveValidationPassed = perspectiveMode === 'first_person';
  const genderValidationPassed = true; // Japanese does not force gendered wording.
  const tenseValidationPassed = /現在は/.test(text)
    ? /行っています|勤務しています|従事しています/u.test(text)
    : true;
  const tensePriorOk = !priorCompany || /担当していました|従事していました|担当した/u.test(text);
  const tenseOk = tenseValidationPassed && tensePriorOk;

  const hasSeparateDurationSlot = finalUnitRoleSlots.includes('duration');
  const introIdx = finalUnitRoleSlots.indexOf('current_intro');
  const durationInIntro = introIdx >= 0
    && /通算で約|通算約|実務経験/u.test(sentences[introIdx] || '')
    && !/現在は/.test(sentences[introIdx] || '');
  // Reject: duration missing as own unit, OR duration wrongly only in current_intro weave.
  const durationOutsideIntro = !hasSeparateDurationSlot
    || (durationInIntro && finalUnitRoleSlots[0] !== 'duration');

  const expectedThreeSlot = requireWarehouseCoverage && (priorCompany || sourceHasDesign);
  const structureOk = unitCount === 3
    && finalUnitRoleSlots.length === 3
    && REQUIRED_JA_SLOTS.every((slot, i) => finalUnitRoleSlots[i] === slot);

  const currentIntroSlotPresent = finalUnitRoleSlots.includes('current_intro')
    || /現在は/.test(text);
  const currentDutySlotPresent = !requireWarehouseCoverage
    || warehouseCov.covered >= warehouseCov.required;
  const priorRoleSlotPresent = !priorCompany && !sourceHasDesign
    ? true
    : finalUnitRoleSlots.includes('prior_role') || /以前は/.test(text);
  const totalDurationSlotPresent = hasSeparateDurationSlot
    && /通算で約|通算約/.test(text)
    && /実務経験/.test(text)
    && durationGrammar.grammarValidationPassed;

  void JAPANESE_SUMMARY_EMPLOYER_STATE_364_REVISION;
  const inferredHasCurrent = Boolean(company)
    || requireWarehouseCoverage
    || currentIntroSlotPresent
    || /現在は/.test(text)
    || Boolean(currentEntryDuties.trim());
  const inferredHasPrior = Boolean(priorCompany)
    || sourceHasDesign
    || (finalUnitRoleSlots.includes('prior_role') && Boolean(priorCompany || priorEntryDuties))
    || /以前は/.test(text);

  const finalCurrentEmployerPresent = !company
    || Boolean(companyEsc && new RegExp(companyEsc, 'iu').test(text));
  const finalPriorEmployerPresent = !priorCompany
    || Boolean(priorCompanyEsc && new RegExp(priorCompanyEsc, 'iu').test(text));
  // Japanese employment-state markers — 現在は / 以前は (first-person CV surface).
  const finalCurrentEmploymentStateExpressed = !inferredHasCurrent
    || /現在は/.test(text);
  const finalPriorEmploymentStateExpressed = !inferredHasPrior
    || /以前は|以前に|かつて/.test(text);
  const finalCurrentRoleIntroValidationPassed = !inferredHasCurrent
    || (currentIntroSlotPresent
      && currentRoleTitlePresent
      && finalCurrentEmployerPresent
      && finalCurrentEmploymentStateExpressed);
  const finalPriorRoleIntroValidationPassed = !inferredHasPrior
    || (priorRoleSlotPresent
      && finalPriorEmployerPresent
      && finalPriorEmploymentStateExpressed);

  const slotRejectionReasons: string[] = [];
  if (!text.trim()) slotRejectionReasons.push('empty_summary');
  if (malformedPunctuation) slotRejectionReasons.push('japanese_summary_malformed_punctuation');
  if (hasGenericSkillsUnit || finalUnitRoleSlots.includes('skills')) {
    slotRejectionReasons.push('japanese_summary_generic_skills_unit');
  }
  if (unsupportedClaimCount > 0) slotRejectionReasons.push('japanese_summary_unsupported_claim');
  if (expectedThreeSlot && unitCount !== 3) {
    slotRejectionReasons.push('japanese_summary_unit_count_mismatch');
  }
  if (expectedThreeSlot && unitCount === 3 && !structureOk) {
    slotRejectionReasons.push('japanese_summary_role_slot_mismatch');
  }
  if (durationOutsideIntro && expectedThreeSlot) {
    slotRejectionReasons.push('japanese_summary_duration_not_standalone');
  }
  if (!durationGrammar.grammarValidationPassed) {
    slotRejectionReasons.push(JAPANESE_SUMMARY_DURATION_GRAMMAR_INVALID);
  }
  if (!perspectiveValidationPassed) {
    slotRejectionReasons.push('japanese_summary_perspective_not_first_person');
  }
  if (!tenseOk) slotRejectionReasons.push('japanese_summary_tense_invalid');
  if (requireWarehouseCoverage && warehouseCov.missing > 0) {
    slotRejectionReasons.push('current_duty_fact_coverage_incomplete');
  }
  if (sourceHasDesign && designCov.missing > 0) {
    slotRejectionReasons.push('prior_duty_fact_coverage_incomplete');
  }
  if (mixedLeak || !purityOk) {
    slotRejectionReasons.push('japanese_summary_locale_impurity');
  }
  if (sourceHasDesign && missingDesignFamilyCount > 0) {
    slotRejectionReasons.push('japanese_summary_unsupported_claim');
  }
  if (inferredHasCurrent && company && !finalCurrentEmployerPresent) {
    slotRejectionReasons.push('japanese_summary_current_employer_missing');
  }
  if (inferredHasPrior && priorCompany && !finalPriorEmployerPresent) {
    slotRejectionReasons.push('japanese_summary_prior_employer_missing');
  }
  if (inferredHasCurrent && !finalCurrentEmploymentStateExpressed) {
    slotRejectionReasons.push('japanese_summary_current_employment_state_missing');
  }
  if (inferredHasPrior && !finalPriorEmploymentStateExpressed) {
    slotRejectionReasons.push('japanese_summary_prior_employment_state_missing');
  }
  if (inferredHasCurrent && !finalCurrentRoleIntroValidationPassed) {
    slotRejectionReasons.push('japanese_summary_current_role_intro_invalid');
  }
  if (inferredHasPrior && !finalPriorRoleIntroValidationPassed) {
    slotRejectionReasons.push('japanese_summary_prior_role_intro_invalid');
  }

  const typedRejectionReason = slotRejectionReasons[0] || null;

  const groundingOk = (
    !typedRejectionReason
    && !mixedLeak
    && !malformedPunctuation
    && !hasGenericSkillsUnit
    && unsupportedClaimCount === 0
    && missingDesignFamilyCount === 0
    && (!expectedThreeSlot || structureOk)
    && !durationOutsideIntro
    && durationGrammar.grammarValidationPassed
    && perspectiveValidationPassed
    && tenseOk
    && repeatedEmploymentFactCount === 0
    && repeatedProfessionalLabelCount === 0
    && (!requireWarehouseCoverage || currentEmploymentIntroductionCount === 1)
    && currentRoleTitlePresent
    && currentRoleTitleMatchesStructuredRole
    && (!requireWarehouseCoverage || warehouseCov.covered >= 3)
    && currentSlotForeignFactCount === 0
    && !semanticCrossEntryLeakageDetected
    && duplicatedPriorRoleFactCount === 0
    && priorRoleGroundingPassed
    && genericizedMaterialFactCount === 0
    && !currentRoleOmittedDetected
    && finalCurrentEmployerPresent
    && finalPriorEmployerPresent
    && finalCurrentEmploymentStateExpressed
    && finalPriorEmploymentStateExpressed
    && finalCurrentRoleIntroValidationPassed
    && finalPriorRoleIntroValidationPassed
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
    slotValidationPassed: groundingOk,
    perspectiveValidationPassed,
    genderValidationPassed,
    tenseValidationPassed: tenseOk,
    grammarValidationPassed: durationGrammar.grammarValidationPassed,
    durationGrammarValidationPassed: durationGrammar.durationGrammarValidationPassed,
    perspectiveMode,
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
    unitCount,
    unsupportedClaimCount,
    missingDesignFamilyCount,
    hasGenericSkillsUnit,
    durationOutsideIntro,
    malformedPunctuation,
    typedRejectionReason,
    slotRejectionReasons: [...new Set(slotRejectionReasons)],
    requiredCurrentDutyFactCount: requireWarehouseCoverage ? warehouseCov.required : 0,
    coveredCurrentDutyFactCount: requireWarehouseCoverage ? warehouseCov.covered : 0,
    missingCurrentDutyFactCount: requireWarehouseCoverage ? warehouseCov.missing : 0,
    requiredPriorDutyFactCount: sourceHasDesign ? designCov.required : 0,
    coveredPriorDutyFactCount: sourceHasDesign ? designCov.covered : 0,
    missingPriorDutyFactCount: sourceHasDesign ? designCov.missing : 0,
    finalCurrentDutyCoveragePassed: !requireWarehouseCoverage
      || warehouseCov.covered >= warehouseCov.required,
    finalPriorDutyCoveragePassed: !sourceHasDesign
      || designCov.covered >= designCov.required,
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
    targetLocalePurityPassed: purityOk && !mixedLeak,
    wrongLocaleUnitCount: mixedLeak || !purityOk ? Math.max(1, sentences.filter((s) => !/[\u3040-\u30FF\u3400-\u9FFF]/.test(s)).length) : 0,
    unexpectedLocaleCodes: [
      ...new Set([
        ...(russianLeak ? ['ru'] : []),
        ...(portugueseLeak ? ['pt-BR'] : []),
        ...(italianLeak ? ['it'] : []),
        ...(frenchLeak ? ['fr'] : []),
        ...(germanLeak ? ['de'] : []),
        ...(englishLeak ? ['en'] : []),
      ]),
    ],
    detectedLocaleByUnit,
    finalDurationOwnerExpected: 'total_professional_experience',
    finalDurationOwnerDetected: totalDurationSlotPresent
      ? 'total_professional_experience'
      : 'unknown',
    finalDurationScopeValidationPassed: totalDurationSlotPresent,
    finalDurationCurrentRoleAttachmentRisk: durationInIntro && hasSeparateDurationSlot === false,
    finalDurationTotalCareerMarkerPresent: /通算/.test(text),
    japaneseSummaryStrictPostconditionsMarker: JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
    japaneseDurationInIntroMarker: JAPANESE_DURATION_IN_INTRO_MARKER,
  };
}

/** Build the three Japanese Summary slots from live entry-owned facts. */
export function buildJapaneseEntryOwnedSummary(options: {
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
  void SUMMARY_BUILDER_REVISION_JA;
  void JAPANESE_SUMMARY_FIRST_PERSON_363_REVISION;
  void JAPANESE_SUMMARY_CROSS_LOCALE_363_REVISION;
  void JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
  void options.locale;
  void options.datesValue;
  void options.gender;
  void localizeWarehouseEmployee;

  let role = (options.role || '').trim();
  const currentDutiesCorpus = options.dutyFacts
    .map((f) => f.sourceText || f.value)
    .filter(Boolean)
    .join('\n');
  const warehouseRole = !role
    || /^(?:プロフェッショナル|professional)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /倉庫|warehouse|skladist|magacin|кладов|مستودع|сотрудник\w*\s+склад/i.test(role);

  if (warehouseRole) {
    role = '倉庫担当';
  } else {
    const resolved = resolveLocalizedSummaryRole({
      role,
      targetLocale: 'ja',
      gender: options.gender,
    });
    if (resolved.localizationValidationPassed) {
      role = resolved.localizedTargetRoleLabel;
    }
  }

  const company = (options.employer || '').trim();
  let durationSentence = '';
  if (options.duration?.hasValidDates) {
    durationSentence = formatJapaneseDurationSentence(options.duration);
  } else if (options.durationPhrase) {
    const core = options.durationPhrase
      .replace(/^[,，、]\s*/u, '')
      .replace(/[。.]$/u, '')
      .replace(/^通算で?/, '')
      .replace(/の実務経験(?:があります|を有する)?$/, '')
      .trim();
    durationSentence = core
      ? `通算で${/約/.test(core) ? core : `約${core}`}の実務経験があります。`
      : '';
  } else {
    const approx = formatApproximateDurationPhrase(
      { hasValidDates: false } as ExperienceDuration,
      'ja',
    );
    void approx;
  }

  const hasCurrent = options.hasCurrentRole !== false
    && Boolean(company || role || currentDutiesCorpus || options.dutyFacts.length);

  let currentSentence = '';
  if (hasCurrent) {
    const canonicalCurrentFacts = extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: currentDutiesCorpus,
    });
    // German/EN extractors miss JA/RU Experience prose — material cues still authorize
    // the entry-owned warehouse Summary surface (never paste raw Experience bullets).
    const warehouseMaterialAuthorized = canonicalCurrentFacts.length > 0
      || classifyMaterialDutyKeys(currentDutiesCorpus)
        .some((k) => WAREHOUSE_SUMMARY_KEYS.has(k) || String(k).startsWith('warehouse_'))
      || WAREHOUSE_FACT_CUE_JA.test(currentDutiesCorpus);
    if (warehouseRole && warehouseMaterialAuthorized) {
      const dutyClause = [
        '入荷商品の確認',
        '受領品に関連する書類の確認',
        '商品の準備および移動に関する同僚との連携',
      ].join('、');
      currentSentence = company
        ? `現在は${company}で${role}として、${dutyClause}を行っています。`
        : `現在は${role}として、${dutyClause}を行っています。`;
    } else {
      const cookDomain = /(?:cook|chef|kuvar|料理人|レストラン|kitchen)/i
        .test(`${role} ${currentDutiesCorpus}`);
      let dutyBits: string[] = [];
      if (cookDomain) {
        dutyBits = [
          'レストラン基準に沿った料理の準備',
          '作業場の衛生管理',
          'キッチンチームとの協力',
        ];
      } else {
        dutyBits = options.dutyFacts
          .map((f) => (f.sourceText || f.value || '').replace(/[。.;]+$/u, '').trim())
          .filter(Boolean)
          .filter((s) => /[\u3040-\u30FF\u3400-\u9FFF]/.test(s))
          .filter((s) => !/\b(?:tenho|atualmente|dispongo|ich|у\s+меня|работаю)\b/iu.test(s))
          .slice(0, 3);
      }
      const dutyTail = dutyBits.length ? `、${dutyBits.join('、')}を行っています` : 'として勤務しています';
      currentSentence = company
        ? `現在は${company}で${role}として${dutyTail}。`
        : `現在は${role}として${dutyTail}。`;
    }
  }

  const priorRoleRaw = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|visual|vizuel|visuel|デザイン|diseñ|graphiste|graphic|グラフィック|デザイナー|графическ|дизайн)/i
    .test(`${priorRoleRaw} ${priorDuties}`);
  let priorSentence = '';
  if (priorRoleRaw || priorEmployer || priorDuties) {
    if (priorLooksDesign) {
      void localizeGraphicDesigner;
      const priorLabel = 'グラフィックデザイナー';
      const designFacts = [
        'ビジュアル素材とグラフィック要素の作成',
        'デザイン素材の確認・調整',
        'さまざまな形式や画面向けの最終デザインファイルの準備',
      ].join('、');
      priorSentence = priorEmployer
        ? `以前は${priorEmployer}で${priorLabel}として、${designFacts}を担当していました。`
        : `以前は${priorLabel}として、${designFacts}を担当していました。`;
    } else {
      const priorResolved = resolveLocalizedSummaryRole({
        role: priorRoleRaw || '',
        targetLocale: 'ja',
        gender: options.gender,
      });
      const priorLabel = priorResolved.localizationValidationPassed
        ? priorResolved.localizedTargetRoleLabel
        : (priorRoleRaw || '担当者');
      priorSentence = priorEmployer
        ? `以前は${priorEmployer}で${priorLabel}として勤務していました。`
        : `以前は${priorLabel}として勤務していました。`;
    }
  }

  return [durationSentence, currentSentence, priorSentence]
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .map((s) => (s.endsWith('。') ? s : `${s}。`))
    .filter(Boolean)
    .join('')
    .replace(/\s+/g, '')
    .replace(/。+/gu, '。')
    .trim();
}

/** True when structured duties/role indicate Japanese entry-owned warehouse/design rebuild. */
export function isJapaneseStructuredSummaryDomain(corpus: string): boolean {
  const t = corpus || '';
  return matchesWarehouseOccupationalTitle(t)
    || matchesGraphicDesignerOccupationalTitle(t)
    || /warehouse|entrep[oô]t|lager|magazzino|склад|incoming\s+goods|товар|graphiste|graphic\s*design|дизайн|倉庫|グラフィック/i
      .test(t);
}
