/**
 * Hindi Summary — source-aware design-medium grounding + finite-sentence grammar.
 * Rejects unsupported print/branding/marketing expansion and incomplete CV prose.
 */

/** Retained AAB-297 medium/grammar package marker (must survive packaging). */
export const HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297 =
  'hindi-summary-medium-grammar-297-v1' as const;
/** AAB-298: bare nominal Summary fragment rejection (`का अनुभव।` etc.). */
export const HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION =
  'hindi-summary-nominal-grammar-298-v1' as const;
/** Active Hindi Summary medium+grammar revision (points at latest package). */
export const HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION =
  HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION;
void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297;
void HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION;
void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION;

export type HindiUnsupportedDesignMediumKind =
  | 'unsupported_print_medium'
  | 'unsupported_branding_claim'
  | 'unsupported_marketing_claim';

export type HindiDesignMediumScan = {
  sourcePrintFactPresent: boolean;
  sourceBrandingFactPresent: boolean;
  sourceMarketingFactPresent: boolean;
  providerUnsupportedDesignMediumCount: number;
  providerUnsupportedDesignMediumKinds: HindiUnsupportedDesignMediumKind[];
  providerPrintClaimDetected: boolean;
  providerBrandingClaimDetected: boolean;
  providerMarketingClaimDetected: boolean;
  finalUnsupportedDesignMediumCount: number;
  finalUnsupportedDesignMediumKinds: HindiUnsupportedDesignMediumKind[];
};

/** Print / printed-media claims — only reject when absent from authoritative facts. */
export const HINDI_PRINT_CLAIM_RE =
  /(?:प्रिंट|मुद्रित|मुद्रण|छपाई|print(?:ed|ing)?(?:\s+media)?|print\s+(?:and|&)\s+digital|प्रिंट\s*(?:और|&|व)?\s*डिजिटल|मुद्रित\s*सामग्री|प्रिंट\s*सामग्री)/iu;

const HINDI_BRANDING_CLAIM_RE =
  /(?:ब्रांड(?:\s*दिशानिर्देश|\s*की\s*दृश्य\s*पहचान)?|brand\s+(?:guidelines?|identity)|दृश्य\s*पहचान\s*बनाए)/iu;

const HINDI_MARKETING_CLAIM_RE =
  /(?:marketing|विज्ञापन|advertising|campaign|कैंपेन|प्रचार\s*अभियान)/iu;

/** Explicit source evidence that print/printed media is in entry-owned facts. */
export const HINDI_PRINT_SOURCE_SUPPORT_RE =
  /(?:प्रिंट|मुद्रित|मुद्रण|छपाई|print(?:ed|ing)?|print\s+(?:and|&)\s+digital|दोनों\s*माध्यम|मुद्रित\s*सामग्री|مواد\s*مطبوعة)/iu;

const HINDI_BRANDING_SOURCE_SUPPORT_RE =
  /(?:ब्रांड|brand\s+(?:guidelines?|identity)|दृश्य\s*पहचान|visual\s+identity)/iu;

const HINDI_MARKETING_SOURCE_SUPPORT_RE =
  /(?:marketing|विज्ञापन|advertising|campaign|कैंपेन)/iu;

export function sourceSupportsHindiPrintMedium(corpus: string): boolean {
  return HINDI_PRINT_SOURCE_SUPPORT_RE.test(corpus || '');
}

export function scanHindiUnsupportedDesignMediumClaims(
  summary: string,
  authoritativePriorDuties: string,
): HindiDesignMediumScan {
  void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION;
  const text = summary || '';
  const corpus = authoritativePriorDuties || '';
  const kinds: HindiUnsupportedDesignMediumKind[] = [];
  const printClaimDetected = HINDI_PRINT_CLAIM_RE.test(text);
  if (printClaimDetected && !sourceSupportsHindiPrintMedium(corpus)) {
    kinds.push('unsupported_print_medium');
  }
  if (HINDI_BRANDING_CLAIM_RE.test(text) && !HINDI_BRANDING_SOURCE_SUPPORT_RE.test(corpus)) {
    kinds.push('unsupported_branding_claim');
  }
  if (HINDI_MARKETING_CLAIM_RE.test(text) && !HINDI_MARKETING_SOURCE_SUPPORT_RE.test(corpus)) {
    kinds.push('unsupported_marketing_claim');
  }
  const unique = [...new Set(kinds)];
  return {
    sourcePrintFactPresent: sourceSupportsHindiPrintMedium(corpus),
    sourceBrandingFactPresent: HINDI_BRANDING_SOURCE_SUPPORT_RE.test(corpus),
    sourceMarketingFactPresent: HINDI_MARKETING_SOURCE_SUPPORT_RE.test(corpus),
    providerUnsupportedDesignMediumCount: unique.length,
    providerUnsupportedDesignMediumKinds: unique,
    providerPrintClaimDetected: printClaimDetected,
    providerBrandingClaimDetected: HINDI_BRANDING_CLAIM_RE.test(text),
    providerMarketingClaimDetected: HINDI_MARKETING_CLAIM_RE.test(text),
    finalUnsupportedDesignMediumCount: unique.length,
    finalUnsupportedDesignMediumKinds: unique,
  };
}

export type HindiSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'duration'
  | 'other';

export type HindiSummaryGrammarRejectionReason =
  | 'current_intro_copula_missing'
  | 'current_duty_auxiliary_missing'
  | 'standalone_relative_fragment'
  | 'nominal_experience_fragment';

export type HindiSummaryGrammarValidation = {
  ok: boolean;
  hindiCurrentIntroFiniteVerbPresent: boolean;
  hindiCurrentDutyAuxiliaryPresent: boolean;
  hindiStandaloneJahanFragmentDetected: boolean;
  hindiNominalExperienceFragmentDetected: boolean;
  /** Per-unit: sentence closes with a finite copula (है/हैं/…) or finite verb. */
  hindiSentenceHasFiniteCopulaOrVerb: boolean[];
  hindiIncompleteSentenceCount: number;
  hindiGrammarRejectionReason: HindiSummaryGrammarRejectionReason | null;
};

const INTRO_NOMINAL_PROFESSIONAL_RE =
  /(?:रखने\s+वाल[ीा]|पेशेवर|उम्मीदवार|अभ्यर्थी)\s*$/u;
const INTRO_FINITE_COPULA_RE = /(?:हैं|है|हूँ|हूं)\s*$/u;
const INTRO_WORKS_FINITE_RE = /कार्यरत\s+(?:हैं|है|हूँ|हूं)\s*$/u;

/** Bare feminine/masculine participle before danda — missing हैं/है/past aux. */
const BARE_PARTICIPLE_END_RE =
  /(?:जाँच\s+)?(?:करती|करता|रखती|रखता|अद्यतन\s+करती|अद्यतन\s+करता|समन्वय\s+करती|समन्वय\s+करता|कार्य\s+करती|कार्य\s+करता)\s*$/u;

/**
 * Bare nominal Professional Summary closings — NOT complete finite sentences.
 * Do not globally ban these phrases; only reject when they end the unit without
 * a following finite copula / finite verb.
 */
const BARE_NOMINAL_SUMMARY_END_RE =
  /(?:का\s+अनुभव|का\s+कार्य|की\s+जिम्मेदारी|की\s+ज़िम्मेदारी|में\s+दक्षता)\s*$/u;

/** Accepted finite completions of experience/duty nominals. */
const FINITE_NOMINAL_EXPERIENCE_RE =
  /(?:का\s+(?:व्यापक\s+)?अनुभव|का\s+कार्य|की\s+जिम्मेदारी|की\s+ज़िम्मेदारी|में\s+दक्षता)\s+(?:है|हैं|रखती\s+हैं|रखता\s+है|रखते\s+हैं)\s*$/u;

const DUTY_FINITE_AUX_RE =
  /(?:हैं|है|थीं|थे|था|हूँ|हूं|किया|की|कीं|किए|करती\s+हैं|करता\s+है|करते\s+हैं|रखती\s+हैं|रखता\s+है)\s*$/u;

const ANY_FINITE_END_RE =
  /(?:हैं|है|हूँ|हूं|थीं|थे|था|किया|की|कीं|किए|करती\s+हैं|करता\s+है|करते\s+हैं|रखती\s+हैं|रखता\s+है|रखते\s+हैं)\s*$/u;

const STANDALONE_JAHAN_RE = /^जहाँ(?:\s|$)/u;
const VALID_JAHAN_WAHAN_RE = /जहाँ[\s\S]{0,120}वहाँ/u;

export function validateHindiSummaryFiniteGrammar(
  units: string[],
  slots: HindiSummaryRoleSlot[],
): HindiSummaryGrammarValidation {
  void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION;
  let hindiCurrentIntroFiniteVerbPresent = true;
  let hindiCurrentDutyAuxiliaryPresent = true;
  let hindiStandaloneJahanFragmentDetected = false;
  let hindiNominalExperienceFragmentDetected = false;
  let hindiIncompleteSentenceCount = 0;
  let hindiGrammarRejectionReason: HindiSummaryGrammarRejectionReason | null = null;
  const hindiSentenceHasFiniteCopulaOrVerb: boolean[] = [];

  for (let i = 0; i < units.length; i += 1) {
    const raw = (units[i] || '').replace(/\s+/g, ' ').trim();
    if (!raw) {
      hindiSentenceHasFiniteCopulaOrVerb.push(true);
      continue;
    }
    const slot = slots[i] || 'other';
    const hasValidJahanWahan = VALID_JAHAN_WAHAN_RE.test(raw);
    const hasFiniteEnd = ANY_FINITE_END_RE.test(raw) || FINITE_NOMINAL_EXPERIENCE_RE.test(raw);
    hindiSentenceHasFiniteCopulaOrVerb.push(hasFiniteEnd);

    if (STANDALONE_JAHAN_RE.test(raw) && !hasValidJahanWahan) {
      hindiStandaloneJahanFragmentDetected = true;
      hindiIncompleteSentenceCount += 1;
      if (!hindiGrammarRejectionReason) {
        hindiGrammarRejectionReason = 'standalone_relative_fragment';
      }
    }

    // Bare `… का अनुभव` / `… का कार्य` / etc. — reject for Summary prose slots.
    if (
      (slot === 'current_duty' || slot === 'current_intro' || slot === 'other')
      && BARE_NOMINAL_SUMMARY_END_RE.test(raw)
      && !FINITE_NOMINAL_EXPERIENCE_RE.test(raw)
    ) {
      hindiNominalExperienceFragmentDetected = true;
      hindiCurrentDutyAuxiliaryPresent = slot === 'current_duty'
        ? false
        : hindiCurrentDutyAuxiliaryPresent;
      hindiIncompleteSentenceCount += 1;
      if (!hindiGrammarRejectionReason) {
        hindiGrammarRejectionReason = 'nominal_experience_fragment';
      }
    }

    if (slot === 'current_intro') {
      const finite = INTRO_FINITE_COPULA_RE.test(raw) || INTRO_WORKS_FINITE_RE.test(raw);
      // Nominal professional / bare कार्यरत without copula.
      const bareProfessional = INTRO_NOMINAL_PROFESSIONAL_RE.test(raw) && !finite;
      const bareKaryarat = /कार्यरत\s*$/u.test(raw) && !finite;
      if (bareProfessional || bareKaryarat) {
        hindiCurrentIntroFiniteVerbPresent = false;
        hindiIncompleteSentenceCount += 1;
        if (!hindiGrammarRejectionReason) {
          hindiGrammarRejectionReason = 'current_intro_copula_missing';
        }
      } else if (!finite && /(?:पेशेवर|कार्यरत|उम्मीदवार)/u.test(raw)) {
        // Employment intro mentioning professional/employed must close with copula.
        hindiCurrentIntroFiniteVerbPresent = false;
        hindiIncompleteSentenceCount += 1;
        if (!hindiGrammarRejectionReason) {
          hindiGrammarRejectionReason = 'current_intro_copula_missing';
        }
      }
    }

    if (slot === 'current_duty') {
      if (BARE_PARTICIPLE_END_RE.test(raw) && !DUTY_FINITE_AUX_RE.test(raw)) {
        hindiCurrentDutyAuxiliaryPresent = false;
        hindiIncompleteSentenceCount += 1;
        if (!hindiGrammarRejectionReason) {
          hindiGrammarRejectionReason = 'current_duty_auxiliary_missing';
        }
      }
    }
  }

  const ok = hindiIncompleteSentenceCount === 0
    && hindiCurrentIntroFiniteVerbPresent
    && hindiCurrentDutyAuxiliaryPresent
    && !hindiStandaloneJahanFragmentDetected
    && !hindiNominalExperienceFragmentDetected;

  return {
    ok,
    hindiCurrentIntroFiniteVerbPresent,
    hindiCurrentDutyAuxiliaryPresent,
    hindiStandaloneJahanFragmentDetected,
    hindiNominalExperienceFragmentDetected,
    hindiSentenceHasFiniteCopulaOrVerb,
    hindiIncompleteSentenceCount,
    hindiGrammarRejectionReason: ok ? null : hindiGrammarRejectionReason,
  };
}

/**
 * Build a prior-role design clause from entry-owned material facts only.
 * Never invents print/branding unless present in priorSourceDuties.
 */
export function buildHindiPriorDesignSentence(options: {
  priorRole: string;
  priorEmployer: string;
  priorSourceDuties: string;
}): string {
  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const duties = options.priorSourceDuties || '';
  if (!priorRole) return '';
  if (!/dizajn|design|ग्राफिक|डिज़ाइन|visual|दृश्य|grafick/i.test(`${priorRole} ${duties}`)) {
    return '';
  }
  const priorLabel = /dizajn|design|grafick|ग्राफिक|डिज़ाइन/i.test(priorRole)
    ? 'ग्राफिक डिज़ाइनर'
    : priorRole;

  const parts: string[] = [];
  const hasVisual = /दृश्य\s*सामग्री|visual\s+materials?|विज़ुअल/iu.test(duties);
  const hasGraphic = /ग्राफिक\s*तत्व|graphic\s+elements?/iu.test(duties);
  const hasDigital = /डिजिटल|digital\s+(?:products?|platforms?)|प्लेटफ़ॉर्म|प्लेटफॉर्म/iu.test(duties);
  const hasPrint = sourceSupportsHindiPrintMedium(duties);
  const hasReview = /समीक्षा|अनुकूलन|review|adapt|आवश्यकताओं/iu.test(duties);
  const hasFiles = /फ़ाइल|फाइल|files?|प्रारूप|formats?|स्क्रीन|screens?/iu.test(duties);

  if (hasPrint && hasDigital) {
    parts.push('प्रिंट और डिजिटल सामग्री तैयार की');
  } else if (hasPrint) {
    parts.push('प्रिंट सामग्री तैयार की');
  } else if (hasVisual || hasGraphic) {
    const visualBit = hasVisual && hasGraphic
      ? 'दृश्य सामग्री और ग्राफिक तत्व'
      : hasVisual
        ? 'दृश्य सामग्री'
        : 'ग्राफिक तत्व';
    parts.push(`${visualBit} तैयार किए`);
  } else if (hasDigital) {
    parts.push('डिजिटल उत्पादों और प्लेटफ़ॉर्म के लिए डिज़ाइन तैयार किए');
  } else {
    parts.push('डिज़ाइन सामग्री तैयार की');
  }

  if (hasReview) {
    parts.push('डिज़ाइन सामग्री की समीक्षा व अनुकूलन किया');
  }
  if (hasFiles) {
    parts.push('अंतिम डिज़ाइन फ़ाइलें विभिन्न प्रारूपों और स्क्रीन के लिए तैयार कीं');
  }

  // Branding only when source supports it.
  if (HINDI_BRANDING_SOURCE_SUPPORT_RE.test(duties) && parts.length < 3) {
    parts.push('ब्रांड की दृश्य पहचान बनाए रखी');
  }

  const body = parts.length >= 3
    ? `${parts[0]}, ${parts[1]} तथा ${parts[2]}`
    : parts.length === 2
      ? `${parts[0]} तथा ${parts[1]}`
      : parts[0] || 'डिज़ाइन कार्य किए';

  return priorEmployer
    ? `इससे पहले ${priorEmployer} में ${priorLabel} के रूप में ${body}।`
    : `इससे पहले ${priorLabel} के रूप में ${body}।`;
}
