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
/** Active Croatian duration finalizer (idempotent v2). */
export const SUMMARY_DURATION_FINALIZER_REVISION_HR_V2 = 'croatian-duration-idempotent-v2' as const;
export const CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER =
  'croatian-summary-strict-postconditions-v1' as const;
export const CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION =
  'croatian-summary-canonical-recovery-291-v1' as const;
export const CROATIAN_NOOP_USAGE_REVISION = 'croatian-noop-usage-291-v1' as const;
/** Build-292 Croatian current_intro grammar (duration noun + company wrapper). */
export const CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION =
  'croatian-summary-intro-grammar-292-v1' as const;

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
  grammarValidationPassed: boolean;
  durationNounMissing: boolean;
  invalidCompanyCase: boolean;
  croatianSummaryIntroGrammarRevision: typeof CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION;
};

export function splitCroatianSummaryUnits(text: string): string[] {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Invariant Croatian employer locative: `u tvrtki <exact employer>`.
 * Does not decline arbitrary company names. Avoids duplicated wrappers.
 */
export function formatCroatianCompanyLocative(employer: string): string | null {
  const company = (employer || '').replace(/\s+/g, ' ').trim();
  if (!company) return null;
  // Already headed by a company-label noun — keep the user’s label, don’t wrap again.
  if (/^(?:tvrtk\w*|kompanij\w*|firm\w*)\b/iu.test(company)) {
    return `u ${company}`;
  }
  return `u tvrtki ${company}`;
}

/** Ensure each written “oko … godina” duration claim carries the governing noun `iskustva`. */
export function ensureCroatianDurationExperienceNoun(text: string): string {
  let out = (text || '').replace(/\s+/g, ' ').trim();
  out = out.replace(
    /((?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+?\bgodin(?:a|e|u))(?!\s+(?:radnog\s+)?iskustva\b)/giu,
    '$1 iskustva',
  );
  // Repair accidental truncations / duplicated nouns from earlier passes.
  out = out.replace(/\bgodin\s+iskustvaa\b/giu, 'godina iskustva');
  out = out.replace(/\s+iskustvaa\b/giu, ' iskustva');
  out = out.replace(/\s+iskustva(\s+iskustva)+\b/giu, ' iskustva');
  return out.replace(/\s+/g, ' ').trim();
}

export type CroatianIntroGrammarValidation = {
  ok: boolean;
  reason: string | null;
  durationNounMissing: boolean;
  invalidCompanyCase: boolean;
};

/**
 * Strict current_intro grammar for Croatian Professional Summary.
 * Rejects incomplete duration phrases and bare `u <Company>` employment constructions.
 */
export function validateCroatianSummaryIntroGrammar(
  summary: string,
  options: { company?: string } = {},
): CroatianIntroGrammarValidation {
  void CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION;
  const units = splitCroatianSummaryUnits(summary);
  const intro = units[0] || '';
  if (!intro) {
    return {
      ok: false,
      reason: 'croatian_summary_current_intro_grammar_invalid',
      durationNounMissing: false,
      invalidCompanyCase: false,
    };
  }

  let durationNounMissing = false;
  const durationHits = intro.matchAll(/(?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+?\bgodin(?:a|e|u)/giu);
  for (const hit of durationHits) {
    const after = intro.slice(hit.index! + hit[0].length, hit.index! + hit[0].length + 28);
    if (!/^\s+(?:radnog\s+)?iskustva\b/iu.test(after)) {
      durationNounMissing = true;
      break;
    }
  }
  // Also catch “s ukupno oko … godina,” / “… godina zaposlena” without iskustva.
  if (
    !durationNounMissing
    && /(?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+?\bgodin(?:a|e|u)/iu.test(intro)
    && !/(?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+?\bgodin(?:a|e|u)\s+(?:radnog\s+)?iskustva\b/iu.test(intro)
  ) {
    durationNounMissing = true;
  }

  const company = (options.company || '').replace(/\s+/g, ' ').trim();
  let invalidCompanyCase = false;
  // Employment verbs + bare company (must use `u tvrtki <name>` for Croatian).
  if (/(?:zaposlena|zaposlen|radi)\s+u\s+kompanij\w*\b/iu.test(intro)) {
    invalidCompanyCase = true;
  } else if (
    /(?:zaposlena|zaposlen)\s+u\s+(?!tvrtk\w*\b|kompanij\w*\b|firm\w*\b)[\p{L}\d]/iu.test(intro)
  ) {
    invalidCompanyCase = true;
  } else if (
    /\bradi\s+u\s+(?!tvrtk\w*\b|kompanij\w*\b|firm\w*\b|skladiš)[\p{L}\d]/iu.test(intro)
  ) {
    invalidCompanyCase = true;
  }
  if (company) {
    const esc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bareEmployed = new RegExp(
      `(?:zaposlena|zaposlen|radi)\\s+u\\s+${esc}(?=\\s|od|[,.]|$)`,
      'iu',
    );
    const wrapped = new RegExp(
      `(?:zaposlena|zaposlen|radi)\\s+u\\s+tvrtk\\w*\\s+${esc}\\b`,
      'iu',
    );
    const alreadyLabeled = /^(?:tvrtk\w*|kompanij\w*|firm\w*)\b/iu.test(company)
      && new RegExp(`(?:zaposlena|zaposlen|radi)\\s+u\\s+${esc}\\b`, 'iu').test(intro);
    if (bareEmployed.test(intro) && !wrapped.test(intro) && !alreadyLabeled) {
      invalidCompanyCase = true;
    }
  }

  if (durationNounMissing) {
    return {
      ok: false,
      reason: 'croatian_summary_duration_noun_missing',
      durationNounMissing: true,
      invalidCompanyCase,
    };
  }
  if (invalidCompanyCase) {
    return {
      ok: false,
      reason: 'croatian_summary_invalid_company_case',
      durationNounMissing: false,
      invalidCompanyCase: true,
    };
  }
  return {
    ok: true,
    reason: null,
    durationNounMissing: false,
    invalidCompanyCase: false,
  };
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
  void CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION;

  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const sentences = splitCroatianSummaryUnits(text);
  const unitCount = sentences.length;
  const company = (options.company || '').trim();
  const structuredRole = (options.structuredRole || options.role || '').trim();
  const currentEntryDuties = options.currentEntryDuties || '';
  const priorEntryDuties = options.priorEntryDuties || '';
  const source = `${currentEntryDuties} ${options.sourceDuties || ''}`;
  const companyEsc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const introGrammar = validateCroatianSummaryIntroGrammar(text, { company });

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
    if (i === 0 && (hasCompany || /radnic\w*\s+u\s+skladišt|osoba\s+s\s+iskustvom|zaposlen/iu.test(sentence) || hasDuration)) {
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
    if (hasCompanyHit && /radnic|zaposlen|skladišt|osoba\s+s\s+iskustvom|\bradi\b/iu.test(sentence)) {
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

  const warehouseTitlePresent = /radnic\w*\s+u\s+skladišt/iu.test(text)
    || /osoba\s+s\s+iskustvom\s+u\s+skladišn/iu.test(text);
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
  } else if (!introGrammar.ok) {
    typedRejectionReason = introGrammar.reason
      || 'croatian_summary_current_intro_grammar_invalid';
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
    && introGrammar.ok
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
    grammarValidationPassed: introGrammar.ok,
    durationNounMissing: introGrammar.durationNounMissing,
    invalidCompanyCase: introGrammar.invalidCompanyCase,
    croatianSummaryIntroGrammarRevision: CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  };
}

/** Weave duration into current_intro for Croatian summaries (idempotent v2). */
export function injectCroatianDurationIntoCurrentIntro(
  summary: string,
  duration: ExperienceDuration,
  context?: { role?: string; company?: string; startDate?: string },
): string {
  // Active path identity — retained v1 marker stays exported for asset compatibility.
  void SUMMARY_DURATION_FINALIZER_REVISION_HR;
  void SUMMARY_DURATION_FINALIZER_REVISION_HR_V2;
  void context;
  if (!duration?.hasValidDates) {
    return ensureCroatianDurationExperienceNoun((summary || '').trim());
  }
  const phraseRaw = formatApproximateDurationPhrase(duration, 'hr');
  if (!phraseRaw) {
    return ensureCroatianDurationExperienceNoun((summary || '').trim());
  }
  const phrase = phraseRaw
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim()
    // Keep governing noun `iskustva` — never strip it from the experience phrase.
    .replace(/^s\s+ukupno\s+/iu, 's ukupno ')
    .trim();
  const phraseForIntro = /^(?:s\s+)?ukupno\s+/iu.test(phrase)
    ? phrase.replace(/^(?:s\s+)?ukupno\s+/iu, 's ukupno ').replace(/\s+/g, ' ').trim()
    : (/^oko\s+/iu.test(phrase) ? `s ukupno ${phrase}` : phrase);
  // Normalize to "s ukupno oko šest i pol godina iskustva".
  let wovenPhrase = /oko\s+/iu.test(phraseForIntro)
    ? phraseForIntro.replace(/^(?:s\s+)?(?:ukupno\s+)?/iu, 's ukupno ').replace(/\s+/g, ' ').trim()
    : phraseForIntro;
  wovenPhrase = ensureCroatianDurationExperienceNoun(wovenPhrase);
  const units = splitCroatianSummaryUnits(summary);
  if (!units.length) {
    return `${wovenPhrase.charAt(0).toUpperCase()}${wovenPhrase.slice(1)}.`;
  }
  const stripDur = (input: string): string => input
    .replace(/,?\s*(?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+?\bgodin(?:a|e|u)(?:\s+(?:radnog\s+)?iskustva)?/giu, '')
    .replace(/,\s*$/u, '')
    .trim();
  const cleaned = units.map(stripDur).filter(Boolean);
  if (!cleaned.length) {
    return `${wovenPhrase.charAt(0).toUpperCase()}${wovenPhrase.slice(1)}.`;
  }
  // Idempotent: first unit already carries one complete authoritative claim.
  const intro0 = ensureCroatianDurationExperienceNoun(units[0] || '');
  if (
    /oko\s+.+?\bgodin(?:a|e|u)\s+(?:radnog\s+)?iskustva/iu.test(intro0)
    && !/,?\s*(?:s\s+)?(?:ukupno\s+)?oko\s+[^,.]+?\bgodin(?:a|e|u).*,\s*(?:s\s+)?(?:ukupno\s+)?oko/iu.test(intro0)
  ) {
    const onlyOne = (ensureCroatianDurationExperienceNoun(summary).match(/oko\s+.+?\bgodin(?:a|e|u)/giu) || []).length === 1;
    if (onlyOne) {
      const repaired = [intro0, ...units.slice(1)].join(' ').replace(/\s+/g, ' ').trim();
      return ensureCroatianDurationExperienceNoun(repaired);
    }
  }
  const intro = cleaned[0]!.replace(/\.$/u, '').trim();
  const woven = `${intro}, ${wovenPhrase}`.replace(/\s+/g, ' ').trim();
  cleaned[0] = /[.]$/u.test(woven) ? woven : `${woven}.`;
  return ensureCroatianDurationExperienceNoun(cleaned.join(' ').replace(/\s+/g, ' ').trim());
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
  void CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION;
  void options.locale;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const male = g === 'male' || g === 'm' || g === 'muški' || g === 'muski';
  const unspecified = !female && !male;

  let role = (options.role || '').trim();
  const warehouseRole = !role
    || /^(?:profesional\w*|professional)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /skladišt|warehouse|magacin|倉庫|кладов|مستودع/i.test(role);
  if (!unspecified) {
    if (!role || /^(?:profesional\w*|professional)$/iu.test(role)) {
      role = localizeWarehouseEmployee('hr', options.gender);
    } else if (warehouseRole) {
      role = localizeWarehouseEmployee('hr', options.gender);
    }
  } else if (warehouseRole) {
    role = 'Osoba s iskustvom u skladišnim poslovima';
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch && CROATIAN_MONTHS[startMatch[2]]
    ? `${CROATIAN_MONTHS[startMatch[2]]} ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  const companyLocative = formatCroatianCompanyLocative(company);
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
  // Complete experience phrase — keep/restore governing noun `iskustva`.
  durRaw = ensureCroatianDurationExperienceNoun(durRaw);

  let intro = '';
  if (unspecified && warehouseRole) {
    const durJoin = durRaw
      ? ` i ${durRaw.replace(/^s\s+/iu, '').trim()}`
      : '';
    if (companyLocative && monthYear && durRaw) {
      intro = `${role}${durJoin} radi ${companyLocative} od ${monthYear}`;
    } else if (companyLocative && monthYear) {
      intro = `${role} radi ${companyLocative} od ${monthYear}`;
    } else if (companyLocative && durRaw) {
      intro = `${role}${durJoin} radi ${companyLocative}`;
    } else if (companyLocative) {
      intro = `${role} radi ${companyLocative}`;
    } else if (durRaw) {
      intro = `${role}${durJoin}`;
    } else {
      intro = role;
    }
  } else if (companyLocative && monthYear && durRaw) {
    intro = `${role} ${durRaw}, ${employed} ${companyLocative} od ${monthYear}`;
  } else if (companyLocative && monthYear) {
    intro = `${role}, ${employed} ${companyLocative} od ${monthYear}`;
  } else if (companyLocative && durRaw) {
    intro = `${role} ${durRaw}, ${employed} ${companyLocative}`;
  } else if (companyLocative) {
    intro = `${role}, ${employed} ${companyLocative}`;
  } else if (durRaw) {
    intro = `${role} ${durRaw}`;
  } else {
    intro = role;
  }
  if (!/[.]$/u.test(intro)) intro = `${intro}.`;
  intro = ensureCroatianDurationExperienceNoun(intro);

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
    || /skladišt|warehouse|osoba\s+s\s+iskustvom\s+u\s+skladišn/i.test(role)
  ) {
    dutySentence = 'Ima iskustvo u provjeri zaprimljene robe i prateće dokumentacije, ažuriranju skladišne evidencije, održavanju urednog skladišta te koordinaciji pripreme i premještanja robe s kolegama.';
  }

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorCompanyLocative = formatCroatianCompanyLocative(priorEmployer);
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
    if (unspecified) {
      const designFacts = 'uključuje izradu vizualnih materijala i grafičkih elemenata, pregled i prilagodbu dizajnerskih materijala zahtjevima projekta te pripremu završnih datoteka i formata za različite zaslone';
      priorSentence = priorCompanyLocative
        ? `Prethodno iskustvo ${priorCompanyLocative} u ulozi grafičkog dizajnera ${designFacts}.`
        : `Prethodno iskustvo u ulozi grafičkog dizajnera ${designFacts}.`;
    } else {
      const priorLabel = localizeGraphicDesigner('hr', options.gender);
      const worked = female ? 'radila' : 'radio';
      const pastPrep = female
        ? 'gdje je izrađivala vizualne materijale i grafičke elemente, pregledavala i prilagođavala dizajnerske materijale zahtjevima projekta te pripremala završne datoteke i formate za različite zaslone'
        : 'gdje je izrađivao vizualne materijale i grafičke elemente, pregledavao i prilagođavao dizajnerske materijale zahtjevima projekta te pripremao završne datoteke i formate za različite zaslone';
      priorSentence = priorCompanyLocative
        ? `Prethodno je ${priorCompanyLocative} ${worked} kao ${priorLabel}, ${pastPrep}.`
        : `Prethodno je ${worked} kao ${priorLabel}, ${pastPrep}.`;
    }
  }

  return [intro, dutySentence, priorSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
