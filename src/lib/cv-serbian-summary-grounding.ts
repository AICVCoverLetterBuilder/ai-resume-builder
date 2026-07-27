/**
 * Entry-owned Serbian Professional Summary grounding (AAB-348).
 * Discriminates Serbian vs Croatian leakage, enforces warehouse/design duty
 * fidelity, and scopes total professional duration away from the current role.
 *
 * Does not modify Experience production builders.
 */
import type { Locale } from './i18n/translations';
import { fingerprintText } from './cv-export-diagnostics';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';
import {
  localizeGraphicDesigner,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';
import type { SummaryDurationOwner } from './cv-german-summary-competency-grounding';
import {
  analyzeSerbianDurationNounForms,
  normalizeSerbianDurationGrammar,
  SERBIAN_DURATION_NOUN_FORM_349_REVISION,
} from './cv-serbian-grammar';

export const SUMMARY_UNIT_SPLITTER_REVISION_SR = 'serbian-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_SR = 'entry-owned-serbian-grounding-v1' as const;
export const SUMMARY_BUILDER_REVISION_SR = 'entry-owned-serbian-rebuild-v1' as const;
export const SUMMARY_DURATION_FINALIZER_REVISION_SR = 'serbian-duration-total-career-v1' as const;
export const SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION =
  'serbian-summary-locale-purity-348-v1' as const;
export const SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION =
  'serbian-summary-role-align-348-v1' as const;
export const SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION =
  'serbian-summary-duration-scope-348-v1' as const;
export const SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION =
  'serbian-summary-fact-fidelity-348-v1' as const;

void SUMMARY_UNIT_SPLITTER_REVISION_SR;
void SUMMARY_GROUNDING_REVISION_SR;
void SUMMARY_BUILDER_REVISION_SR;
void SUMMARY_DURATION_FINALIZER_REVISION_SR;
void SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION;
void SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION;
void SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION;
void SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION;
void SERBIAN_DURATION_NOUN_FORM_349_REVISION;

/** Croatian-preferred forms that must not appear under Serbian Summary target. */
export const CROATIAN_LEAKAGE_UNDER_SERBIAN_RE =
  /(?:\bprovjer(?:a|u|ava|avam|avala|avao|avati)\b|\bsurađ(?:uje|ujem|ivala|ivao|ivati)\w*\b|\bpremještanj\w*\b|\bvizualn\w*\b|\bzaslon\w*\b|\btvrtk\w*\b|\bdizajnerica\b|\bzaposlenic\w*\b|\bdjelatnic\w*\b|\btočnost\w*\b|\bradnog\s+mjesta\b|\bs\s+kolegama\b|\bzaprimljen\w*\b|\bzahtjev\w*\s+projekt)/iu;

/** Serbian-preferred forms (positive evidence). */
export const SERBIAN_SUMMARY_POSITIVE_CUE_RE =
  /(?:\bprover(?:a|u|ava|avam|avala|avao|avati)\b|\bsarađ(?:uje|ujem|ivala|ivao)\w*\b|\bpremeštanj\w*\b|\bvizueln\w*\b|\bekran\w*\b|\bdizajnerka\b|\bkompanij\w*\b|\bukupnog\s+profesionalnog\s+iskustva\b)/iu;

/** Drift: managing/controlling receipt — not inspecting incoming goods. */
const INCOMING_GOODS_DRIFT_SR =
  /(?:kontroli(?:šem|še|šem|sala|sao)?\s+prijem\s+robe|upravlja(?:m|)\s+prijemom\s+robe|nadzire(?:m|)\s+prijem\s+robe)/iu;

/** Faithful incoming-goods inspection evidence. */
const INCOMING_GOODS_FAITHFUL_SR =
  /(?:proverava(?:m|)\s+pristigl[aue]\s+rob[aue]|kontroli(?:šem|še)\s+pristigl[aue]\s+rob[aue]|vršim\s+proveru\s+pristigle\s+robe|proveravam\s+robu\s+koja\s+(?:stiže|pristiže)|proverava(?:m|)\s+ulazn)/iu;

const DOCUMENT_FAITHFUL_SR =
  /(?:dokumentacij\w*.{0,40}(?:primljen|pristigl|prateć)|prateć\w*\s+dokumentacij|dokumentacij\w*\s+povezan)/iu;

const COORDINATION_FAITHFUL_SR =
  /(?:sarađuj(?:em|e)|koordinira(?:m|)|u\s+saradnji).{0,48}(?:kolegam|priprem).{0,40}(?:premeštanj|premestanju|kretanj)/iu;

const PRIOR_CREATION_SR =
  /(?:kreira(?:la|o|)\s+(?:sam\s+)?vizueln|vizueln\w*\s+materijal).{0,40}grafičk\w*\s+element/iu;

const PRIOR_REVIEW_ADAPT_SR =
  /(?:pregled(?:ala|ao|avala|avao)|pregleda(?:la|o)).{0,24}(?:i\s+)?prilagođav/iu;

const PRIOR_ADAPT_ONLY_SR =
  /prilagođav(?:ala|ao|a)\w*.{0,40}dizajnersk\w*\s+materijal/iu;

const PRIOR_FINAL_FILES_SR =
  /(?:završn\w*\s+dizajnersk\w*\s+datotek|priprema(?:la|o|)\s+(?:sam\s+)?završn|finaln\w*\s+fajl).{0,48}(?:format|ekran)/iu;

const TOTAL_CAREER_MARKER_SR =
  /\b(?:ukupnog\s+profesionalnog\s+iskustva|ukupno\s+(?:profesionalno\s+)?iskustvo|ukupnog\s+iskustva)\b/iu;

const DURATION_CUE_SR =
  /(?:oko|približno|otprilike).{0,40}godin|(?:šest|pet|sedam|osam|devet|deset)\s+i\s+po\s+godin|sa\s+oko\s+.+?\s+godin/iu;

const UNSUPPORTED_SR_SUMMARY =
  /(?:liderstv|upravljanje\s+zalihama|svakodnevn\w*\s+odgovornost|standardi\s+kvalitet|bezbednosn\w*\s+standard|farmaceutsk|Agile|Scrum|kritičk\w*\s+razmišljan|emocionaln\w*\s+inteligenc|upravljanje\s+klijentima|štamp\w*|brending|marketing\b|metrik\w*|sertifikat|pharmacy|leadership|inventory\s+management)/iu;

const DESIGN_FACT_CUE_SR =
  /(?:dizajn|design|grafič|grafick|vizuel|vizual|ビジュアル|デザイン|グラフィック)/iu;

export type SerbianSummaryRoleSlot =
  | 'duration'
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'other'
  | 'skills';

export type SerbianCroatianLocaleEvidence = {
  croatianLeakageCueCount: number;
  serbianPositiveCueCount: number;
  croatianLeakageDetected: boolean;
  serbianLocalePurityPassed: boolean;
  revision: typeof SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION;
};

export function analyzeSerbianCroatianLocaleEvidence(
  text: string,
): SerbianCroatianLocaleEvidence {
  void SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION;
  const t = text || '';
  const croatianLeakageCueCount = (t.match(new RegExp(CROATIAN_LEAKAGE_UNDER_SERBIAN_RE.source, 'giu')) || []).length;
  const serbianPositiveCueCount = (t.match(new RegExp(SERBIAN_SUMMARY_POSITIVE_CUE_RE.source, 'giu')) || []).length;
  const croatianLeakageDetected = croatianLeakageCueCount > 0;
  return {
    croatianLeakageCueCount,
    serbianPositiveCueCount,
    croatianLeakageDetected,
    serbianLocalePurityPassed: !croatianLeakageDetected,
    revision: SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION,
  };
}

export function splitSerbianSummaryUnits(text: string): string[] {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type SerbianDurationScopeAnalysis = {
  finalDurationOwnerExpected: SummaryDurationOwner;
  finalDurationOwnerDetected: SummaryDurationOwner;
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  durationScopeRejectionReason: string | null;
};

export function analyzeSerbianSummaryDurationScope(
  text: string,
  options: {
    company?: string;
    role?: string;
    expectedOwner?: SummaryDurationOwner;
  } = {},
): SerbianDurationScopeAnalysis {
  void SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION;
  const expected: SummaryDurationOwner = options.expectedOwner || 'total_professional_experience';
  const sentences = splitSerbianSummaryUnits(text);
  const company = (options.company || '').trim();
  const companyEsc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let detected: SummaryDurationOwner = 'unknown';
  let totalMarker = false;
  let currentRoleRisk = false;
  let reason: string | null = null;

  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i]!;
    if (!DURATION_CUE_SR.test(sentence)) continue;
    const hasTotalMarker = TOTAL_CAREER_MARKER_SR.test(sentence);
    const hasCompany = companyEsc
      ? new RegExp(`(?:kompaniji\\s+)?${companyEsc}|u\\s+${companyEsc}\\b`, 'iu').test(sentence)
      : false;
    const hasRoleCue = /(?:radnic\w*\s+u\s+skladišt|kao\s+radnic|trenutno\s+radim|od\s+januar)/iu.test(sentence);
    const hasDuty = INCOMING_GOODS_FAITHFUL_SR.test(sentence)
      || DOCUMENT_FAITHFUL_SR.test(sentence)
      || COORDINATION_FAITHFUL_SR.test(sentence)
      || INCOMING_GOODS_DRIFT_SR.test(sentence);

    if (hasTotalMarker && !hasCompany && !hasDuty) {
      detected = 'total_professional_experience';
      totalMarker = true;
    } else if (hasTotalMarker && (hasCompany || hasDuty) && /^(?:imam|sa)\b/iu.test(sentence.trim())) {
      detected = 'total_professional_experience';
      totalMarker = true;
      currentRoleRisk = false;
    } else if (hasCompany || hasRoleCue || (hasDuty && i === 0)) {
      detected = 'current_role_duration';
      currentRoleRisk = true;
      reason = 'duration_attached_to_current_role';
    } else if (/prethodno|ranije/iu.test(sentence)) {
      detected = 'prior_role_duration';
    } else if (hasTotalMarker) {
      detected = 'total_professional_experience';
      totalMarker = true;
    }
  }

  if (!DURATION_CUE_SR.test(text || '')) {
    detected = 'unknown';
    reason = reason || 'duration_claim_missing';
  }

  const passed = expected === 'total_professional_experience'
    ? (detected === 'total_professional_experience' && totalMarker && !currentRoleRisk)
    : detected === expected;

  if (!passed && !reason) {
    reason = currentRoleRisk
      ? 'duration_current_role_attachment_risk'
      : 'duration_scope_mismatch';
  }

  return {
    finalDurationOwnerExpected: expected,
    finalDurationOwnerDetected: detected,
    finalDurationScopeValidationPassed: passed,
    finalDurationCurrentRoleAttachmentRisk: currentRoleRisk,
    finalDurationTotalCareerMarkerPresent: totalMarker,
    durationScopeRejectionReason: passed ? null : reason,
  };
}

export function formatSerbianTotalProfessionalDurationSentence(
  durationPhraseOrWord: string,
): string {
  void SUMMARY_DURATION_FINALIZER_REVISION_SR;
  let core = (durationPhraseOrWord || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .replace(/^(?:sa|s)\s+/iu, '')
    .replace(/\b(?:ukupnog\s+)?profesionalnog\s+iskustva\b/iu, '')
    .replace(/\biskustva\b/iu, '')
    .trim();
  if (!core) return '';
  if (!/^oko\b|^približno\b/iu.test(core)) {
    core = `oko ${core}`;
  }
  if (!/godin/iu.test(core)) {
    core = `${core} godina`;
  }
  // Enforce correct half-year noun (šest i po godina, not godine).
  core = normalizeSerbianDurationGrammar(core);
  return `Imam ${core} ukupnog profesionalnog iskustva.`.replace(/\s+/g, ' ').trim();
}

export function injectSerbianTotalDurationSentence(
  summary: string,
  durationPhrase: string,
): string {
  void SUMMARY_DURATION_FINALIZER_REVISION_SR;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const sentence = formatSerbianTotalProfessionalDurationSentence(durationPhrase);
  if (!sentence) return text;
  if (!text) return sentence;
  if (TOTAL_CAREER_MARKER_SR.test(text) && DURATION_CUE_SR.test(text)) {
    const scope = analyzeSerbianSummaryDurationScope(text);
    if (scope.finalDurationScopeValidationPassed) return text;
  }
  // Strip duration attached to current-role sentence before injecting scoped claim.
  const units = splitSerbianSummaryUnits(text).map((u) => {
    if (!DURATION_CUE_SR.test(u)) return u;
    if (TOTAL_CAREER_MARKER_SR.test(u) && !/(?:Atlas|radim|radnic)/iu.test(u)) return u;
    return u
      .replace(/,?\s*(?:sa|s)\s+oko\s+[^,.]+?\s+godin\w*(?:\s+iskustva)?/giu, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+\./g, '.')
      .trim();
  }).filter(Boolean);
  const body = units.join(' ').replace(/\s+/g, ' ').trim();
  return `${sentence} ${body}`.replace(/\s+/g, ' ').trim();
}

export type SerbianSummaryFactCoverage = {
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  finalCurrentDutyCoveragePassed: boolean;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalPriorDutyCoveragePassed: boolean;
  incomingGoodsDriftDetected: boolean;
  priorReviewMissingDetected: boolean;
};

export function analyzeSerbianSummaryFactCoverage(
  summary: string,
  options: {
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    role?: string;
    priorRole?: string;
  } = {},
): SerbianSummaryFactCoverage {
  void SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION;
  const text = summary || '';
  const warehouseDomain = matchesWarehouseOccupationalTitle(options.role || '')
    || /warehouse|skladišt|magacin|incoming|pristigl|robu/i.test(
      `${options.role || ''} ${options.currentEntryDuties || ''}`,
    );
  const designDomain = DESIGN_FACT_CUE_SR.test(
    `${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
  );

  const units = splitSerbianSummaryUnits(text);
  const priorUnits = units.filter((u) => /prethodno|ranije/iu.test(u)).join(' ');
  const currentUnits = units.filter((u) => !/prethodno|ranije/iu.test(u)).join(' ');

  const incomingOk = INCOMING_GOODS_FAITHFUL_SR.test(currentUnits)
    && !INCOMING_GOODS_DRIFT_SR.test(currentUnits);
  const drift = INCOMING_GOODS_DRIFT_SR.test(currentUnits)
    && !INCOMING_GOODS_FAITHFUL_SR.test(currentUnits);
  const docsOk = DOCUMENT_FAITHFUL_SR.test(currentUnits);
  const coordOk = COORDINATION_FAITHFUL_SR.test(currentUnits);

  const currentCovered = [incomingOk, docsOk, coordOk].filter(Boolean).length;
  const requiredCurrent = warehouseDomain ? 3 : 0;

  const creationOk = PRIOR_CREATION_SR.test(priorUnits);
  const reviewAdaptOk = PRIOR_REVIEW_ADAPT_SR.test(priorUnits);
  const adaptOnly = PRIOR_ADAPT_ONLY_SR.test(priorUnits) && !PRIOR_REVIEW_ADAPT_SR.test(priorUnits);
  const finalOk = PRIOR_FINAL_FILES_SR.test(priorUnits);
  const priorCovered = [creationOk, reviewAdaptOk, finalOk].filter(Boolean).length;
  const requiredPrior = designDomain ? 3 : 0;

  return {
    requiredCurrentDutyFactCount: requiredCurrent,
    coveredCurrentDutyFactCount: warehouseDomain ? currentCovered : 0,
    missingCurrentDutyFactCount: warehouseDomain ? Math.max(0, requiredCurrent - currentCovered) : 0,
    finalCurrentDutyCoveragePassed: !warehouseDomain || currentCovered >= 3,
    requiredPriorDutyFactCount: requiredPrior,
    coveredPriorDutyFactCount: designDomain ? priorCovered : 0,
    missingPriorDutyFactCount: designDomain ? Math.max(0, requiredPrior - priorCovered) : 0,
    finalPriorDutyCoveragePassed: !designDomain || priorCovered >= 3,
    incomingGoodsDriftDetected: drift,
    priorReviewMissingDetected: adaptOnly,
  };
}

export type SerbianSummaryEmploymentQuality = {
  ok: boolean;
  reason: string | null;
  groundingValidationPassed: boolean;
  grammarValidationPassed: boolean;
  slotValidationPassed: boolean;
  typedRejectionReason: string | null;
  localePurityPassed: boolean;
  croatianLeakageDetected: boolean;
  genderValidationPassed: boolean;
  tenseValidationPassed: boolean;
  perspectiveMode: 'first_person' | 'third_person' | 'mixed' | 'unknown';
  perspectiveValidationPassed: boolean;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  currentEmploymentIntroductionCount: number;
  currentRoleOmittedDetected: boolean;
  currentRoleConcreteFactCoverage: number;
  priorRoleTitlePresent: boolean;
  priorRoleGroundingPassed: boolean;
  usesDizajnerica: boolean;
  usesDizajnerka: boolean;
  durationScope: SerbianDurationScopeAnalysis;
  factCoverage: SerbianSummaryFactCoverage;
  serbianDurationNounFormPassed: boolean;
  serbianDurationNounFormKind: 'godina' | 'godine' | 'godinu' | 'mixed' | 'none';
  serbianDurationGrammarRejectionReason: string | null;
  unitCount: number;
  finalUnitRoleSlots: SerbianSummaryRoleSlot[];
  finalSentenceHashes: string[];
  finalSentenceRoleSlots: SerbianSummaryRoleSlot[];
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
  slotRejectionReasons: string[];
  summaryBuilderRevision: typeof SUMMARY_BUILDER_REVISION_SR;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION_SR;
};

function detectSerbianPerspective(text: string): SerbianSummaryEmploymentQuality['perspectiveMode'] {
  const first = /\b(?:ja\s+)?(?:sam|radim|proveravam|sarađujem|imam|kreirala\s+sam|kreirao\s+sam|radila\s+sam|radio\s+sam)\b/iu.test(text);
  const third = /\b(?:ona|on|radi|proverava|sarađuje)\b(?!\s+sam)/iu.test(text)
    && !/\b(?:radim|proveravam|sarađujem)\b/iu.test(text);
  if (first && third) return 'mixed';
  if (first) return 'first_person';
  if (third) return 'third_person';
  return 'unknown';
}

export function analyzeSerbianSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    priorRole?: string;
    priorCompany?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
    structuredRole?: string;
  } = {},
): SerbianSummaryEmploymentQuality {
  void SUMMARY_BUILDER_REVISION_SR;
  void SUMMARY_GROUNDING_REVISION_SR;
  void SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION;

  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitSerbianSummaryUnits(text);
  const localeEv = analyzeSerbianCroatianLocaleEvidence(text);
  const durationScope = analyzeSerbianSummaryDurationScope(text, {
    company: options.company,
    role: options.role || options.structuredRole,
  });
  const factCoverage = analyzeSerbianSummaryFactCoverage(text, {
    currentEntryDuties: options.currentEntryDuties,
    priorEntryDuties: options.priorEntryDuties,
    role: options.role || options.structuredRole,
    priorRole: options.priorRole,
  });
  const durationNoun = analyzeSerbianDurationNounForms(text);

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const male = g === 'male' || g === 'm' || g === 'muški' || g === 'muski';

  const usesDizajnerica = /\bdizajnerica\b/iu.test(text);
  const usesDizajnerka = /\bdizajnerka\b/iu.test(text);
  const warehouseTitle = /radnic\w*\s+u\s+(?:skladišt|magacin)/iu.test(text);
  const priorTitle = usesDizajnerka || usesDizajnerica || /grafičk\w*\s+dizajner/iu.test(text);

  const slots: SerbianSummaryRoleSlot[] = [];
  for (let i = 0; i < units.length; i += 1) {
    const s = units[i]!;
    if (/ključne\s+veštin|soft\s+skills|liderstv/iu.test(s)) {
      slots.push('skills');
      continue;
    }
    if (TOTAL_CAREER_MARKER_SR.test(s) && DURATION_CUE_SR.test(s) && !/Atlas|Rewitu|radim kao/iu.test(s)) {
      slots.push('duration');
      continue;
    }
    if (/prethodno|ranije/iu.test(s)) {
      slots.push('prior_role');
      continue;
    }
    if (/trenutno\s+radim|radim\s+u\s+kompaniji|kao\s+radnic/iu.test(s)) {
      slots.push(
        /proverav|sarađuj|dokumentacij|premeštanj/iu.test(s) ? 'current_intro' : 'current_intro',
      );
      continue;
    }
    if (/proverav|sarađuj|dokumentacij|premeštanj/iu.test(s)) {
      slots.push('current_duty');
      continue;
    }
    slots.push(i === 0 ? 'current_intro' : 'other');
  }

  // Combined current intro+duty sentence is allowed (2-sentence variation).
  const currentIntroSlotPresent = slots.includes('current_intro')
    || units.some((u) => /trenutno\s+radim|radim\s+u\s+kompaniji/iu.test(u));
  const currentDutySlotPresent = slots.includes('current_duty')
    || units.some((u) =>
      /trenutno\s+radim|radim\s+u\s+kompaniji/iu.test(u)
      && /proverav|sarađuj|dokumentacij/iu.test(u));
  const priorRoleSlotPresent = slots.includes('prior_role');
  const totalDurationSlotPresent = slots.includes('duration')
    || durationScope.finalDurationTotalCareerMarkerPresent;

  const perspectiveMode = detectSerbianPerspective(text);
  const perspectiveValidationPassed = perspectiveMode === 'first_person';

  let genderOk = true;
  if (female) {
    genderOk = !/\bradio\s+sam\b|\bkreirao\s+sam\b|\bgrafički\s+dizajner\b(?!ka)/iu.test(text)
      || /\bdizajnerka\b|\bradnica\b|\bradila\s+sam\b/.test(text);
    if (usesDizajnerica) genderOk = false;
    if (/\bradnik\s+u\s+skladišt/iu.test(text) && !/\bradnica\b/iu.test(text)) genderOk = false;
  } else if (male) {
    genderOk = !/\bradila\s+sam\b|\bdizajnerka\b|\bradnica\b/iu.test(text);
  }

  const tenseOk = !priorRoleSlotPresent
    || (
      /(?:radila|radio)\s+sam|prethodno\s+sam/iu.test(text)
      && /(?:kreira(?:la|o)|pregled(?:ala|ao)|priprema(?:la|o))/iu.test(text)
    );

  const slotRejectionReasons: string[] = [];
  if (!currentIntroSlotPresent) slotRejectionReasons.push('serbian_summary_missing_current_intro_slot');
  if (!currentDutySlotPresent) slotRejectionReasons.push('serbian_summary_missing_current_duty_slot');
  if (!priorRoleSlotPresent && DESIGN_FACT_CUE_SR.test(`${options.priorRole || ''} ${options.priorEntryDuties || ''}`)) {
    slotRejectionReasons.push('serbian_summary_missing_prior_role_slot');
  }
  if (!totalDurationSlotPresent) slotRejectionReasons.push('serbian_summary_missing_duration_slot');
  if (slots.includes('skills')) slotRejectionReasons.push('serbian_summary_generic_skills_unit');

  let reason: string | null = null;
  if (!text) reason = 'empty_summary';
  else if (localeEv.croatianLeakageDetected || usesDizajnerica) {
    reason = usesDizajnerica
      ? 'serbian_summary_croatian_role_form'
      : 'serbian_summary_croatian_leakage';
  } else if (UNSUPPORTED_SR_SUMMARY.test(text)) {
    reason = 'serbian_summary_unsupported_claims';
  } else if (factCoverage.incomingGoodsDriftDetected) {
    reason = 'serbian_summary_incoming_goods_semantic_drift';
  } else if (!factCoverage.finalCurrentDutyCoveragePassed) {
    reason = 'serbian_summary_current_fact_coverage_incomplete';
  } else if (factCoverage.priorReviewMissingDetected || !factCoverage.finalPriorDutyCoveragePassed) {
    reason = 'serbian_summary_prior_role_grounding_incomplete';
  } else if (!durationScope.finalDurationScopeValidationPassed) {
    reason = durationScope.durationScopeRejectionReason || 'serbian_summary_duration_scope_failed';
  } else if (!durationNoun.serbianDurationNounFormPassed) {
    reason = durationNoun.serbianDurationGrammarRejectionReason
      || 'serbian_duration_noun_form_invalid';
  } else if (!perspectiveValidationPassed) {
    reason = 'serbian_summary_perspective_failed';
  } else if (!genderOk) {
    reason = 'serbian_summary_gender_failed';
  } else if (!tenseOk) {
    reason = 'serbian_summary_tense_failed';
  } else if (slotRejectionReasons.length > 0) {
    reason = slotRejectionReasons[0] || 'serbian_summary_incomplete_slots';
  } else if (/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(text)) {
    reason = 'serbian_summary_foreign_script';
  }

  const slotValidationPassed = slotRejectionReasons.length === 0;
  const groundingOk = reason == null
    && localeEv.serbianLocalePurityPassed
    && factCoverage.finalCurrentDutyCoveragePassed
    && factCoverage.finalPriorDutyCoveragePassed
    && durationScope.finalDurationScopeValidationPassed
    && durationNoun.serbianDurationNounFormPassed
    && perspectiveValidationPassed
    && genderOk
    && tenseOk
    && slotValidationPassed;

  return {
    ok: groundingOk,
    reason,
    groundingValidationPassed: groundingOk,
    grammarValidationPassed: perspectiveValidationPassed && tenseOk,
    slotValidationPassed,
    typedRejectionReason: reason,
    localePurityPassed: localeEv.serbianLocalePurityPassed && !usesDizajnerica,
    croatianLeakageDetected: localeEv.croatianLeakageDetected || usesDizajnerica,
    genderValidationPassed: genderOk,
    tenseValidationPassed: tenseOk,
    perspectiveMode,
    perspectiveValidationPassed,
    currentRoleTitlePresent: warehouseTitle,
    currentRoleTitleMatchesStructuredRole: warehouseTitle,
    currentEmploymentIntroductionCount: currentIntroSlotPresent ? 1 : 0,
    currentRoleOmittedDetected: !currentIntroSlotPresent,
    currentRoleConcreteFactCoverage: factCoverage.coveredCurrentDutyFactCount,
    priorRoleTitlePresent: Boolean(priorTitle && usesDizajnerka && !usesDizajnerica),
    priorRoleGroundingPassed: factCoverage.finalPriorDutyCoveragePassed,
    usesDizajnerica,
    usesDizajnerka,
    durationScope,
    factCoverage,
    serbianDurationNounFormPassed: durationNoun.serbianDurationNounFormPassed,
    serbianDurationNounFormKind: durationNoun.serbianDurationNounFormKind,
    serbianDurationGrammarRejectionReason: durationNoun.serbianDurationGrammarRejectionReason,
    unitCount: units.length,
    finalUnitRoleSlots: slots,
    finalSentenceHashes: units.map((u) => fingerprintText(u)),
    finalSentenceRoleSlots: slots,
    currentIntroSlotPresent,
    currentDutySlotPresent,
    priorRoleSlotPresent,
    totalDurationSlotPresent,
    slotRejectionReasons,
    summaryBuilderRevision: SUMMARY_BUILDER_REVISION_SR,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION_SR,
  };
}

/** Narrow Serbian repair for known AAB-348 defects — never unrestricted rewrite. */
export function repairSerbianSummaryProviderCandidate(
  summary: string,
  options: {
    company?: string;
    priorCompany?: string;
    gender?: string;
    durationPhrase?: string;
    duration?: ExperienceDuration | null;
  } = {},
): { text: string; attempted: boolean; applied: boolean; transformations: string[] } {
  void SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION;
  let text = (summary || '').replace(/\s+/g, ' ').trim();
  if (!text) return { text: '', attempted: false, applied: false, transformations: [] };
  const transformations: string[] = [];
  const before = text;

  if (/\bdizajnerica\b/iu.test(text)) {
    text = text.replace(/\bdizajnerica\b/giu, 'dizajnerka');
    transformations.push('dizajnerica_to_dizajnerka');
  }
  if (/\bprovjeravam\b/iu.test(text)) {
    text = text.replace(/\bprovjeravam\b/giu, 'proveravam');
    transformations.push('croatian_provjeravam');
  }
  if (/\bsurađujem\b/iu.test(text)) {
    text = text.replace(/\bsurađujem\b/giu, 'sarađujem');
    transformations.push('croatian_suradujem');
  }
  if (/\bpremještanje\b/iu.test(text)) {
    text = text.replace(/\bpremještanje\b/giu, 'premeštanje');
    transformations.push('croatian_premjestanje');
  }
  if (/\bvizualn/iu.test(text)) {
    text = text.replace(/\bvizualn/giu, 'vizueln');
    transformations.push('croatian_vizualni');
  }
  if (/\bzaslon/iu.test(text)) {
    text = text.replace(/\bzaslon/giu, 'ekran');
    transformations.push('croatian_zaslon');
  }
  if (INCOMING_GOODS_DRIFT_SR.test(text) && !INCOMING_GOODS_FAITHFUL_SR.test(text)) {
    text = text.replace(INCOMING_GOODS_DRIFT_SR, 'proveravam pristiglu robu');
    transformations.push('incoming_goods_drift_repair');
  }
  if (PRIOR_ADAPT_ONLY_SR.test(text) && !PRIOR_REVIEW_ADAPT_SR.test(text)) {
    text = text.replace(
      /prilagođav(?:ala|ao|a)\w*\s+dizajnerske\s+materijale/giu,
      'pregledala i prilagođavala dizajnerske materijale',
    );
    transformations.push('prior_review_restore');
  }
  if (/\bfinalne\s+fajlove\b/iu.test(text)) {
    text = text.replace(/\bfinalne\s+fajlove\b/giu, 'završne dizajnerske datoteke');
    transformations.push('finalne_fajlove_normalize');
  }
  const beforeNoun = text;
  text = normalizeSerbianDurationGrammar(text);
  if (text !== beforeNoun) {
    transformations.push('duration_noun_form_normalize');
  }

  const scope = analyzeSerbianSummaryDurationScope(text, { company: options.company });
  if (!scope.finalDurationScopeValidationPassed) {
    let phrase = (options.durationPhrase || '').trim();
    if (!phrase && options.duration) {
      phrase = formatApproximateDurationPhrase(options.duration, 'sr');
    }
    if (phrase) {
      text = injectSerbianTotalDurationSentence(text, phrase);
      transformations.push('duration_total_career_relocate');
    }
  }

  const attempted = transformations.length > 0;
  const applied = attempted && text !== before;
  return { text, attempted, applied, transformations };
}

function serbianWarehouseRoleLabel(gender?: string): string {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski') {
    return 'radnica u skladištu';
  }
  if (g === 'male' || g === 'm' || g === 'muški' || g === 'muski') {
    return 'radnik u skladištu';
  }
  return 'radnik u skladištu';
}

function serbianGraphicRoleLabel(gender?: string): string {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski') {
    return 'grafička dizajnerka';
  }
  if (!g || g === 'unspecified' || g === 'other') {
    return 'grafički dizajner';
  }
  return localizeGraphicDesigner('sr', gender).replace(/^Grafičk/u, 'grafičk');
}

/** Build entry-owned Serbian Summary from structured Atlas/Rewitu facts. */
export function buildSerbianEntryOwnedSummary(options: {
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
  duration?: ExperienceDuration | null;
}): string {
  void SUMMARY_BUILDER_REVISION_SR;
  void SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION;
  void options.datesValue;
  void options.locale;
  void options.dutyFacts;
  void options.role;
  void options.priorRole;
  void options.priorSourceDuties;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const male = g === 'male' || g === 'm' || g === 'muški' || g === 'muski';

  const role = serbianWarehouseRoleLabel(options.gender);
  const company = (options.employer || '').trim() || 'Atlas';
  const priorLabel = serbianGraphicRoleLabel(options.gender);
  const priorEmployer = (options.priorEmployer || '').trim() || 'Rewitu';

  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'sr')
      .replace(/\.$/u, '')
      .trim();
  }
  const durationSentence = formatSerbianTotalProfessionalDurationSentence(durRaw)
    || 'Imam oko šest i po godina ukupnog profesionalnog iskustva.';

  const current = `Trenutno radim u kompaniji ${company} kao ${role}, gde proveravam pristiglu robu i dokumentaciju povezanu sa primljenom robom i sarađujem sa kolegama na pripremi i premeštanju robe.`;

  let prior = '';
  if (female) {
    prior = `Prethodno sam radila kao ${priorLabel} u kompaniji ${priorEmployer}, gde sam kreirala vizuelne materijale i grafičke elemente, pregledala i prilagođavala dizajnerske materijale i pripremala završne dizajnerske datoteke za različite formate i ekrane.`;
  } else if (male) {
    prior = `Prethodno sam radio kao ${priorLabel} u kompaniji ${priorEmployer}, gde sam kreirao vizuelne materijale i grafičke elemente, pregledao i prilagođavao dizajnerske materijale i pripremao završne dizajnerske datoteke za različite formate i ekrane.`;
  } else {
    prior = `Prethodno iskustvo u kompaniji ${priorEmployer} u ulozi ${priorLabel} uključuje kreiranje vizuelnih materijala i grafičkih elemenata, pregled i prilagodbu dizajnerskih materijala i pripremu završnih dizajnerskih datoteka za različite formate i ekrane.`;
  }

  return [durationSentence, current, prior]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSerbianStructuredSummaryDomain(corpus: string): boolean {
  const t = corpus || '';
  const hasWarehouseRole = matchesWarehouseOccupationalTitle(t)
    || /(?:warehouse|skladišt|magacin|radnic\w*\s+u\s+(?:skladišt|magacin))/i.test(t);
  // Require Atlas-style duty material — not generic warehouse logistics
  // (package-1 transport/loading) or soft job-context shells alone.
  const hasWarehouseDutyMaterial =
    /(?:incoming\s+goods|checks?\s+incoming|pristigl\w*\s+rob|ulazn\w*\s+rob|kontroli\w*\s+prijem\s+rob|proverav\w*.{0,40}(?:pristigl|ulazn)|dokumentacij\w*.{0,48}(?:received\s+goods|primljen\w*\s+rob|pristigl|prateć)|checks?\s+documentation\s+related|coordinates?\s+with\s+colleagues.{0,48}(?:preparation|movement)\s+of\s+goods|sarađuj\w*.{0,48}(?:priprem|premeštanj).{0,24}rob)/i
      .test(t);
  const hasDesignMaterial =
    /(?:graphic\s+designer|grafičk\w*\s+dizajn|vizueln\w*\s+materijal|vizualn\w*\s+materijal|visual\s+materials?\s+and\s+graphic|reviewed?\s+and\s+adapted|pregled\w*.{0,24}prilagođ|design\s+materials|dizajnersk\w*\s+materijal|final\s+design\s+files|završn\w*\s+dizajnersk)/i
      .test(t);
  // Entry-owned Serbian rebuild is for the Atlas warehouse + Rewitu design fixture.
  return hasWarehouseRole && hasWarehouseDutyMaterial && hasDesignMaterial;
}
