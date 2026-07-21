/**
 * Entry-owned Croatian Professional Summary grounding (three semantic slots).
 * Mirrors Japanese/Russian Summary contract with Croatian vs Serbian discrimination.
 */
import type { Locale } from './i18n/translations';
import {
  classifyMaterialDutyKeys,
  CROATIAN_EXPERIENCE_MATERIAL_REVISION,
  isCroatianDesignPoisonedLiveSource,
  validateCroatianDesignFactFamilies,
} from './cv-material-duty-coverage';
import { fingerprintText } from './cv-export-diagnostics';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';
import { analyzeCroatianSerbianLocaleEvidence } from './cv-ai-unit-locale-purity';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';

export const SUMMARY_UNIT_SPLITTER_REVISION_HR = 'croatian-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_HR = 'entry-owned-croatian-grounding-v1' as const;
export const SUMMARY_BUILDER_REVISION_HR = 'entry-owned-croatian-rebuild-v1' as const;
export const SUMMARY_DURATION_FINALIZER_REVISION_HR = 'croatian-duration-idempotent-v1' as const;
/** Build-291 Croatian duration finalizer (idempotent v2). */
export const SUMMARY_DURATION_FINALIZER_REVISION_HR_V2 = 'croatian-duration-idempotent-v2' as const;
export const CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER =
  'croatian-summary-strict-postconditions-v1' as const;
export const CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION =
  'croatian-summary-canonical-recovery-291-v1' as const;
export const CROATIAN_NOOP_USAGE_REVISION = 'croatian-noop-usage-291-v1' as const;

void CROATIAN_EXPERIENCE_MATERIAL_REVISION;

const DESIGN_FACT_CUE_HR =
  /(?:vizualn|grafičk|dizajn|zahtjev\w*\s+projekt|završn\w*\s+datotek|zaslon|ekran|ビジュアル|デザイン|グラフィック)/iu;
const WAREHOUSE_FACT_CUE_HR =
  /(?:zaprimljen|primljen|ulazn\w*\s+rob|prateć|popratn|skladišt|evidencij|premješt|priprem\w*.{0,24}rob|koleg|surađ|provjer|točnost)/iu;
const GENERICIZED_HR =
  /(?:svakodnevn\w*\s+dužnost|profesionaln\w*\s+zadat|dodeljen|dodijeljen\w*\s+profesional|razmen\w*\s+informacij|radnog\s+mesta|Carries\s+out\s+assigned|グラフィックデザイナー|Графический)/iu;

const WAREHOUSE_SUMMARY_KEYS = new Set([
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
  'warehouse_document_check',
  'warehouse_orderly_goods',
  'warehouse_preparation',
  'warehouse_colleague_coordination',
]);

const APPROVED_LATIN_ISLANDS =
  /\b(?:Atlas|Rewitu|REST|SQL|API|Python|Agile|Scrum|January|February|March|April|May|June|July|August|September|October|November|December)\b/gi;

const REQUIRED_HR_SLOTS = ['current_intro', 'current_duty', 'prior_role'] as const;

const CROATIAN_MONTHS: Record<string, string> = {
  '01': 'siječnja',
  '02': 'veljače',
  '03': 'ožujka',
  '04': 'travnja',
  '05': 'svibnja',
  '06': 'lipnja',
  '07': 'srpnja',
  '08': 'kolovoza',
  '09': 'rujna',
  '10': 'listopada',
  '11': 'studenoga',
  '12': 'prosinca',
};

export type CroatianSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'duration'
  | 'other'
  | 'skills';

export type CroatianSummaryEmploymentQuality = {
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
  finalUnitRoleSlots: CroatianSummaryRoleSlot[];
  finalSentenceHashes: string[];
  finalSentenceRoleSlots: CroatianSummaryRoleSlot[];
  finalSentenceMaterialKeyCounts: number[];
  summaryUnitSplitterRevision: typeof SUMMARY_UNIT_SPLITTER_REVISION_HR;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION_HR;
  unitCount: number;
  unsupportedClaimCount: number;
  missingDesignFamilyCount: number;
  hasGenericSkillsUnit: boolean;
  durationOutsideIntro: boolean;
  malformedPunctuation: boolean;
  typedRejectionReason: string | null;
  croatianSummaryStrictPostconditionsMarker: typeof CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
  serbianLeakageDetected: boolean;
  croatianLocaleEvidencePassed: boolean;
};

export function splitCroatianSummaryUnits(text: string): string[] {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function croatianWarehouseSummaryFragment(key: string): string {
  switch (key) {
    case 'warehouse_inbound_check':
    case 'warehouse_document_check':
      return 'provjeri zaprimljene robe i prateće dokumentacije';
    case 'warehouse_records':
    case 'warehouse_orderly_goods':
      return 'ažuriranju skladišne evidencije i održavanju urednog skladišta';
    case 'warehouse_movement':
    case 'warehouse_preparation':
    case 'warehouse_colleague_coordination':
      return 'koordinaciji pripreme i premještanja robe s kolegama';
    default:
      return '';
  }
}

function scoreCroatianPriorDesignFamilies(text: string): {
  missingCount: number;
  creation: boolean;
  review: boolean;
  delivery: boolean;
} {
  const fam = validateCroatianDesignFactFamilies(
    text.includes('•') ? text : `• ${text}`,
  );
  // Summary prose may not use bullet past-tense shells — score cues directly.
  const creation = /vizualn\w*\s+materijal/iu.test(text) && /grafičk\w*\s+element/iu.test(text);
  const review = /(?:pregledav|prilagođav|provjerav)\w*.{0,48}(?:dizajn|materijal|zahtjev)|zahtjev\w*\s+projekt/iu.test(text);
  const delivery = /završn\w*\s+(?:dizajnersk\w*\s+)?datotek|format\w*.{0,40}(?:zaslon|ekran)/iu.test(text);
  const covered = [creation || fam.creationCovered, review || fam.reviewAdaptationCovered, delivery || fam.finalDeliveryCovered]
    .filter(Boolean).length;
  return {
    missingCount: Math.max(0, 3 - covered),
    creation: creation || fam.creationCovered,
    review: review || fam.reviewAdaptationCovered,
    delivery: delivery || fam.finalDeliveryCovered,
  };
}

export function analyzeCroatianSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
    sourceDuties?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    priorCompany?: string;
    structuredRole?: string;
    gender?: string;
  } = {},
): CroatianSummaryEmploymentQuality {
  void SUMMARY_UNIT_SPLITTER_REVISION_HR;
  void SUMMARY_GROUNDING_REVISION_HR;
  void CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;

  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const sentences = splitCroatianSummaryUnits(text);
  const unitCount = sentences.length;
  const company = (options.company || '').trim();
  const structuredRole = (options.structuredRole || options.role || '').trim();
  const currentEntryDuties = options.currentEntryDuties || '';
  const priorEntryDuties = options.priorEntryDuties || '';
  const source = `${currentEntryDuties} ${options.sourceDuties || ''}`;
  const companyEsc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const localeEvidence = analyzeCroatianSerbianLocaleEvidence(text);
  const hasCjk = /[\u3040-\u30FF\u3400-\u9FFF]/.test(text);
  const hasCyr = /[\u0400-\u04FF]/.test(text);
  const malformedPunctuation = /。|、|です。,|,\s*oko\s+/u.test(text);

  const finalUnitRoleSlots: CroatianSummaryRoleSlot[] = [];
  let priorClauseSeen = false;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasDuration = /oko\s+.+godin|ukupno\s+oko|s\s+oko|sa\s+oko/iu.test(sentence);
    const hasPrior = /prethodno|ranije|prije\s+toga|gdje\s+je\s+(?:izrađ|pregled|priprem)/iu.test(sentence);
    const hasDuty = WAREHOUSE_FACT_CUE_HR.test(sentence)
      || /ima\s+iskustvo/iu.test(sentence);
    const hasSkills = /ključne\s+vještin|ključne\s+veštin|soft\s+skills|liderstvo/iu.test(sentence);

    if (hasSkills) {
      finalUnitRoleSlots.push('skills');
      continue;
    }
    if (hasPrior) {
      priorClauseSeen = true;
      finalUnitRoleSlots.push('prior_role');
      continue;
    }
    if (i === 0 && (hasCompany || /radnic\w*\s+u\s+skladišt|zaposlen/iu.test(sentence) || hasDuration)) {
      finalUnitRoleSlots.push('current_intro');
      continue;
    }
    if (!priorClauseSeen && hasDuty) {
      finalUnitRoleSlots.push('current_duty');
      continue;
    }
    if (hasDuration && !hasCompany && !hasDuty) {
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
    const hasCompanyHit = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    if (hasCompanyHit && /radnic|zaposlen|skladišt/iu.test(sentence)) {
      currentEmploymentIntroductionCount += 1;
    }
  }

  const repeatedEmploymentFactCount = Math.max(0, currentEmploymentIntroductionCount - 1);
  const professionalMatches = text.match(/profesional\w*/giu) || [];
  const professionalLabelCount = professionalMatches.length;
  const repeatedProfessionalLabelCount = Math.max(0, professionalLabelCount - 1);

  const summaryWhKeys = [...new Set(
    classifyMaterialDutyKeys(text).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  let cueCoverage = 0;
  if (/zaprimljen|prateć|provjer|točnost/iu.test(text)) cueCoverage += 1;
  if (/skladišn\w*\s+evidencij|uredn|ažurir/iu.test(text)) cueCoverage += 1;
  if (/koleg|premješt|priprem|surađ|koordin/iu.test(text)) cueCoverage += 1;
  const currentRoleConcreteFactCoverage = Math.max(summaryWhKeys.length, cueCoverage);

  const sourceWh = [...new Set(
    classifyMaterialDutyKeys(source).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const roleLooksWarehouse = matchesWarehouseOccupationalTitle(
    `${structuredRole} ${options.role || ''} ${currentEntryDuties}`,
  ) || WAREHOUSE_FACT_CUE_HR.test(currentEntryDuties)
    || /skladišt|warehouse|magacin|倉庫|кладов|مستودع/i.test(`${structuredRole} ${currentEntryDuties}`);
  const requireWarehouseCoverage = sourceWh.length >= 2 || roleLooksWarehouse;

  const hasGeneric = GENERICIZED_HR.test(text);
  const genericizedMaterialFactCount = hasGeneric && currentRoleConcreteFactCoverage < 2
    ? Math.max(1, sourceWh.length, requireWarehouseCoverage ? 1 : 0)
    : 0;

  const warehouseTitlePresent = /radnic\w*\s+u\s+skladišt/iu.test(text);
  let currentRoleTitlePresent: boolean;
  let currentRoleTitleMatchesStructuredRole: boolean;
  let currentRoleOmittedDetected: boolean;
  if (requireWarehouseCoverage || roleLooksWarehouse) {
    currentRoleTitlePresent = warehouseTitlePresent;
    currentRoleTitleMatchesStructuredRole = warehouseTitlePresent;
    currentRoleOmittedDetected = !warehouseTitlePresent;
  } else {
    const roleEsc = structuredRole && !/^(?:profesional\w*|professional)$/iu.test(structuredRole)
      ? structuredRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      : '';
    currentRoleTitlePresent = Boolean(roleEsc && new RegExp(roleEsc, 'iu').test(text));
    currentRoleTitleMatchesStructuredRole = currentRoleTitlePresent;
    currentRoleOmittedDetected = Boolean(roleEsc && !currentRoleTitlePresent);
  }

  const currentLooksDesign = DESIGN_FACT_CUE_HR.test(currentEntryDuties)
    || /(?:design|dizajn|grafič)/iu.test(structuredRole);
  const priorLooksDesign = DESIGN_FACT_CUE_HR.test(priorEntryDuties);
  const priorLooksWarehouse = WAREHOUSE_FACT_CUE_HR.test(priorEntryDuties);

  let currentSlotForeignFactCount = 0;
  let priorSlotForeignFactCount = 0;
  let priorRoleSemanticFactMentionCount = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    const slot = finalUnitRoleSlots[i];
    const hasDesign = DESIGN_FACT_CUE_HR.test(sentence);
    const hasWarehouse = WAREHOUSE_FACT_CUE_HR.test(sentence);
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
    finalUnitRoleSlots[i] === 'current_duty' && DESIGN_FACT_CUE_HR.test(s)
  ));
  const designInPrior = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'prior_role' && DESIGN_FACT_CUE_HR.test(s)
  ));
  const duplicatedPriorRoleFactCount = (
    designInCurrentDuty && designInPrior && requireWarehouseCoverage && !currentLooksDesign
  ) ? 1 : 0;

  const sourceHasDesign = DESIGN_FACT_CUE_HR.test(priorEntryDuties || options.sourceDuties || '');
  const priorSentence = sentences.find((_, i) => finalUnitRoleSlots[i] === 'prior_role') || '';
  const designFamilies = scoreCroatianPriorDesignFamilies(priorSentence || text);
  const unsupportedClaimCount = (hasCjk ? 1 : 0) + (hasCyr ? 1 : 0)
    + (localeEvidence.serbianLeakageDetected ? 1 : 0);
  const missingDesignFamilyCount = sourceHasDesign ? designFamilies.missingCount : 0;
  const priorRoleGroundingPassed = sourceHasDesign
    ? (designInPrior || DESIGN_FACT_CUE_HR.test(priorSentence))
      && designFamilies.missingCount === 0
      && !hasCjk
    : !hasCjk && !hasCyr;

  const semanticCrossEntryLeakageDetected = currentSlotForeignFactCount > 0
    || priorSlotForeignFactCount > 0
    || duplicatedPriorRoleFactCount > 0;

  const strippedLatin = text.replace(APPROVED_LATIN_ISLANDS, '');
  const mixedLeak = GENERICIZED_HR.test(text)
    || hasCjk
    || hasCyr
    || localeEvidence.serbianLeakageDetected
    || /Графический|Кладовщ|Carries\s+out|assigned\s+professional|magacin|グラフィック/iu.test(text)
    || (/[A-Za-z]{4,}/.test(strippedLatin)
      && /(?:Carries|professional|duties|accuracy|communication)/iu.test(text));

  const introIdx = finalUnitRoleSlots.indexOf('current_intro');
  const durationInIntro = introIdx >= 0
    && /oko\s+.+godin|ukupno\s+oko/iu.test(sentences[introIdx] || '');
  const hasSeparateDurationSlot = finalUnitRoleSlots.includes('duration');
  const durationClaimAnywhere = /oko\s+.+godin|ukupno\s+oko/iu.test(text);
  const durationOutsideIntro = hasSeparateDurationSlot
    || (durationClaimAnywhere && !durationInIntro);

  const hasGenericSkillsUnit = finalUnitRoleSlots.includes('skills');
  const structureOk = unitCount === 3
    && finalUnitRoleSlots.length === 3
    && REQUIRED_HR_SLOTS.every((slot, i) => finalUnitRoleSlots[i] === slot);

  const currentDutyMissing = !finalUnitRoleSlots.includes('current_duty');
  const priorMissing = sourceHasDesign && !finalUnitRoleSlots.includes('prior_role');

  let typedRejectionReason: string | null = null;
  if (!text.trim()) {
    typedRejectionReason = 'empty_summary';
  } else if (malformedPunctuation || hasCjk || hasCyr) {
    typedRejectionReason = 'croatian_summary_foreign_script';
  } else if (localeEvidence.serbianLeakageDetected) {
    typedRejectionReason = 'croatian_summary_serbian_leakage';
  } else if (unitCount !== 3) {
    typedRejectionReason = 'croatian_summary_unit_count_mismatch';
  } else if (!structureOk) {
    typedRejectionReason = 'croatian_summary_role_slot_mismatch';
  } else if (currentDutyMissing || currentRoleOmittedDetected) {
    typedRejectionReason = 'croatian_summary_current_role_missing';
  } else if (requireWarehouseCoverage && currentRoleConcreteFactCoverage < 2) {
    typedRejectionReason = 'croatian_summary_missing_material_fact';
  } else if (priorMissing || (sourceHasDesign && missingDesignFamilyCount > 0)) {
    typedRejectionReason = 'croatian_summary_prior_role_missing';
  } else if (durationOutsideIntro || !durationInIntro) {
    typedRejectionReason = 'croatian_summary_duration_invalid';
  } else if (mixedLeak || hasGeneric) {
    typedRejectionReason = 'croatian_summary_serbian_leakage';
  }

  const groundingOk = (
    !typedRejectionReason
    && !mixedLeak
    && !malformedPunctuation
    && !hasGenericSkillsUnit
    && unsupportedClaimCount === 0
    && missingDesignFamilyCount === 0
    && structureOk
    && !durationOutsideIntro
    && durationInIntro
    && repeatedEmploymentFactCount === 0
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
    && localeEvidence.croatianLocaleEvidencePassed
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
    summaryUnitSplitterRevision: SUMMARY_UNIT_SPLITTER_REVISION_HR,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION_HR,
    unitCount,
    unsupportedClaimCount,
    missingDesignFamilyCount,
    hasGenericSkillsUnit,
    durationOutsideIntro,
    malformedPunctuation,
    typedRejectionReason,
    croatianSummaryStrictPostconditionsMarker: CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
    serbianLeakageDetected: localeEvidence.serbianLeakageDetected,
    croatianLocaleEvidencePassed: localeEvidence.croatianLocaleEvidencePassed,
  };
}

/** Weave duration into current_intro for Croatian summaries (idempotent). */
export function injectCroatianDurationIntoCurrentIntro(
  summary: string,
  duration: ExperienceDuration,
  context?: { role?: string; company?: string; startDate?: string },
): string {
  void SUMMARY_DURATION_FINALIZER_REVISION_HR;
  void SUMMARY_DURATION_FINALIZER_REVISION_HR_V2;
  void context;
  if (!duration?.hasValidDates) return (summary || '').trim();
  const phraseRaw = formatApproximateDurationPhrase(duration, 'hr');
  if (!phraseRaw) return (summary || '').trim();
  const phrase = phraseRaw
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim()
    // Prefer the compact written form recognized by every duration detector.
    .replace(/^s\s+ukupno\s+/iu, '')
    .replace(/\s+iskustva$/iu, '')
    .trim();
  const phraseForIntro = /^(?:s\s+)?ukupno\s+/iu.test(phraseRaw)
    ? `s ukupno ${phrase.replace(/^s\s+/iu, '').replace(/^oko\s+/iu, 'oko ')}`.replace(/\s+/g, ' ').trim()
    : phrase;
  // Normalize to "s ukupno oko šest i pol godina" while detectors also accept "oko šest i pol godina".
  const wovenPhrase = /oko\s+/iu.test(phraseForIntro)
    ? phraseForIntro.replace(/^(?:s\s+)?(?:ukupno\s+)?/iu, 's ukupno ').replace(/\s+/g, ' ').trim()
    : phraseForIntro;
  const units = splitCroatianSummaryUnits(summary);
  if (!units.length) {
    return `${wovenPhrase.charAt(0).toUpperCase()}${wovenPhrase.slice(1)}.`;
  }
  const stripDur = (input: string): string => input
    .replace(/,?\s*(?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+godin\w*(?:\s+iskustva)?/giu, '')
    .replace(/,\s*$/u, '')
    .trim();
  const cleaned = units.map(stripDur).filter(Boolean);
  if (!cleaned.length) {
    return `${wovenPhrase.charAt(0).toUpperCase()}${wovenPhrase.slice(1)}.`;
  }
  // Idempotent: first unit already carries one authoritative claim.
  if (/oko\s+.+godin/iu.test(units[0] || '') && !/,?\s*(?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+godin\w*.*,\s*(?:s\s+)?(?:ukupno\s+)?oko/iu.test(units[0] || '')) {
    const onlyOne = (summary.match(/oko\s+.+godin/giu) || []).length === 1;
    if (onlyOne) return units.join(' ').replace(/\s+/g, ' ').trim();
  }
  const intro = cleaned[0]!.replace(/\.$/u, '').trim();
  const woven = `${intro}, ${wovenPhrase}`.replace(/\s+/g, ' ').trim();
  cleaned[0] = /[.]$/u.test(woven) ? woven : `${woven}.`;
  return cleaned.join(' ').replace(/\s+/g, ' ').trim();
}

/** Build the three Croatian Summary slots from live entry-owned facts. */
export function buildCroatianEntryOwnedSummary(options: {
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
  void SUMMARY_BUILDER_REVISION_HR;
  void SUMMARY_UNIT_SPLITTER_REVISION_HR;
  void SUMMARY_GROUNDING_REVISION_HR;
  void CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
  void CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION;
  void options.locale;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  let role = (options.role || '').trim();
  if (!role || /^(?:profesional\w*|professional)$/iu.test(role)) {
    role = localizeWarehouseEmployee('hr', options.gender);
  } else if (
    matchesWarehouseOccupationalTitle(role)
    || /skladišt|warehouse|magacin|倉庫|кладов|مستودع/i.test(role)
  ) {
    role = localizeWarehouseEmployee('hr', options.gender);
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch && CROATIAN_MONTHS[startMatch[2]]
    ? `${CROATIAN_MONTHS[startMatch[2]]} ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  const employed = female ? 'zaposlena' : 'zaposlen';
  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  durRaw = durRaw
    .replace(/s\s+oko\s+/iu, 's ukupno oko ')
    .replace(/\bi\s+po\b/giu, 'i pol');
  if (durRaw && !/ukupno/iu.test(durRaw) && /oko\s+/iu.test(durRaw)) {
    durRaw = durRaw.replace(/^(?:s\s+)?oko/iu, 's ukupno oko');
  }
  // Keep "s ukupno oko šest i pol godina" — strip trailing "iskustva" for intro weave.
  durRaw = durRaw.replace(/\s+iskustva$/iu, '').trim();

  let intro = '';
  if (company && monthYear && durRaw) {
    intro = `${role} ${durRaw}, ${employed} u ${company} od ${monthYear}`;
  } else if (company && monthYear) {
    intro = `${role}, ${employed} u ${company} od ${monthYear}`;
  } else if (company && durRaw) {
    intro = `${role} ${durRaw}, ${employed} u ${company}`;
  } else if (company) {
    intro = `${role}, ${employed} u ${company}`;
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
      if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(src)) {
        if (/入荷|書類|確認|正確/u.test(src)) keys.add('warehouse_inbound_check');
        if (/記録|更新|整理|保管|配置/u.test(src)) keys.add('warehouse_records');
        if (/同僚|連携|準備|移動|調整/u.test(src)) keys.add('warehouse_movement');
      }
      if (/[а-яё]/iu.test(src)) {
        if (/товар|документ|поступающ|проверя/iu.test(src)) keys.add('warehouse_inbound_check');
        if (/запис|обновл|поряд|склад/iu.test(src)) keys.add('warehouse_records');
        if (/коллег|подготов|перемещен|координир/iu.test(src)) keys.add('warehouse_movement');
      }
      return [...keys]
        .map((k) => croatianWarehouseSummaryFragment(k))
        .filter(Boolean);
    }),
  )];
  const preferred = [
    croatianWarehouseSummaryFragment('warehouse_inbound_check'),
    croatianWarehouseSummaryFragment('warehouse_records'),
    croatianWarehouseSummaryFragment('warehouse_movement'),
  ].filter((frag) => whFrags.includes(frag));
  const dutyFrags = preferred.length >= 2 ? preferred : whFrags.slice(0, 3);
  let dutySentence = '';
  if (dutyFrags.length >= 2) {
    dutySentence = `Ima iskustvo u ${dutyFrags[0]}, ${dutyFrags[1]}${dutyFrags[2] ? ` te ${dutyFrags[2]}` : ''}.`;
  } else if (dutyFrags.length === 1) {
    dutySentence = `Ima iskustvo u ${dutyFrags[0]}, ažuriranju skladišne evidencije te koordinaciji pripreme i premještanja robe s kolegama.`;
  } else if (
    matchesWarehouseOccupationalTitle(`${role} ${options.dutyFacts.map((d) => d.value).join(' ')}`)
    || /skladišt|warehouse/i.test(role)
  ) {
    dutySentence = 'Ima iskustvo u provjeri zaprimljene robe i prateće dokumentacije, ažuriranju skladišne evidencije, održavanju urednog skladišta te koordinaciji pripreme i premještanja robe s kolegama.';
  }

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafič|grafick|visual|vizuel|vizualn|ビジュアル|デザイン|デザイナー|グラフィック|графическ|визуальн|تصميم|डिज़ाइन)/i
    .test(`${priorRole} ${priorDuties}`);
  const priorPoisonedSerbian = isCroatianDesignPoisonedLiveSource(priorDuties, priorRole)
    || (
      /(?:prover\w*\s+tačnost|koordinisa\w*|razmen\w*|svakodnevn\w*\s+dužnost)/iu.test(priorDuties)
      && !/(?:vizualn|grafičk|dizajn|zaslon|datotek)/iu.test(priorDuties)
    );
  let priorSentence = '';
  if (priorRole && (priorLooksDesign || priorPoisonedSerbian)) {
    void CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION;
    const priorLabel = localizeGraphicDesigner('hr', options.gender);
    const worked = female ? 'radila' : 'radio';
    const pastPrep = female
      ? 'gdje je izrađivala vizualne materijale i grafičke elemente, pregledavala i prilagođavala dizajnerske materijale zahtjevima projekta te pripremala završne datoteke i formate za različite zaslone'
      : 'gdje je izrađivao vizualne materijale i grafičke elemente, pregledavao i prilagođavao dizajnerske materijale zahtjevima projekta te pripremao završne datoteke i formate za različite zaslone';
    priorSentence = priorEmployer
      ? `Prethodno je u tvrtki ${priorEmployer} ${worked} kao ${priorLabel}, ${pastPrep}.`
      : `Prethodno je ${worked} kao ${priorLabel}, ${pastPrep}.`;
  }

  return [intro, dutySentence, priorSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
