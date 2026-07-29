/**
 * Shared Summary locale dispatch — builder revision, target script, perspective.
 * Requested locale always wins; source/provider Summary locale never selects the builder.
 */
import type { Locale } from './i18n/translations';
import {
  resolveTargetScriptForLocale,
  type AiContentScript,
} from './cv-ai-unit-locale-purity';
import {
  ARABIC_SUMMARY_FIRST_PERSON_354_REVISION,
  ARABIC_SUMMARY_TOPOLOGY_UNIVERSAL_354_REVISION,
  SUMMARY_BUILDER_REVISION_AR,
} from './cv-arabic-summary-grounding';
import { SUMMARY_BUILDER_REVISION_DE, detectGermanSummaryPerspective } from './cv-german-summary-grounding';
import {
  SUMMARY_BUILDER_REVISION_FR,
  detectFrenchSummaryPerspective,
} from './cv-french-summary-grounding';
import {
  SUMMARY_BUILDER_REVISION_IT,
  detectItalianSummaryPerspective,
} from './cv-italian-summary-grounding';
import {
  SUMMARY_BUILDER_REVISION_PT_BR,
  detectPortugueseBrazilSummaryPerspective,
} from './cv-portuguese-summary-grounding';
import { SUMMARY_BUILDER_REVISION_EN } from './cv-english-summary-grounding';
import { SUMMARY_BUILDER_REVISION_HR } from './cv-croatian-summary-grounding';
import { SUMMARY_BUILDER_REVISION_JA } from './cv-japanese-summary-grounding';
import { SUMMARY_BUILDER_REVISION_RU } from './cv-russian-summary-grounding';
import { SUMMARY_BUILDER_REVISION_SR } from './cv-serbian-summary-grounding';
import { SUMMARY_BUILDER_REVISION_HI_353 } from './cv-hindi-summary-grounding';
import { SUMMARY_BUILDER_REVISION } from './cv-summary-grounding';

export const SUMMARY_REQUESTED_LOCALE_DISPATCH_355_REVISION =
  'summary-requested-locale-dispatch-355-v1' as const;
export const SUMMARY_REQUESTED_LOCALE_DISPATCH_358_REVISION =
  'summary-requested-locale-dispatch-358-v1' as const;
export const SUMMARY_REQUESTED_LOCALE_DISPATCH_359_REVISION =
  'summary-requested-locale-dispatch-359-v1' as const;
/** Fail-closed marker when a locale has no dedicated Summary builder. */
export const SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION =
  'summary-locale-unsupported-failclosed-358-v1' as const;

void SUMMARY_REQUESTED_LOCALE_DISPATCH_355_REVISION;
void SUMMARY_REQUESTED_LOCALE_DISPATCH_358_REVISION;
void SUMMARY_REQUESTED_LOCALE_DISPATCH_359_REVISION;
void SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION;

export { detectGermanSummaryPerspective };

/** Canonical target script for the requested Summary locale. */
export function resolveSummaryTargetScript(
  requestedLocale: Locale | string,
): AiContentScript {
  return resolveTargetScriptForLocale(requestedLocale as Locale);
}

/**
 * Builder revision packaging for diagnostics — derived only from requestedLocale.
 * Never falls through to Hindi for German / Romance / other targets.
 */
export function resolveSummaryBuilderRevision(
  requestedLocale: Locale | string,
): string {
  void SUMMARY_REQUESTED_LOCALE_DISPATCH_355_REVISION;
  void SUMMARY_REQUESTED_LOCALE_DISPATCH_358_REVISION;
  void SUMMARY_REQUESTED_LOCALE_DISPATCH_359_REVISION;
  const locale = String(requestedLocale || '').toLowerCase();
  switch (locale) {
    case 'ar':
      return [
        SUMMARY_BUILDER_REVISION_AR,
        ARABIC_SUMMARY_FIRST_PERSON_354_REVISION,
        ARABIC_SUMMARY_TOPOLOGY_UNIVERSAL_354_REVISION,
      ].join('|');
    case 'de':
      return SUMMARY_BUILDER_REVISION_DE;
    case 'en':
      return SUMMARY_BUILDER_REVISION_EN;
    case 'fr':
      return SUMMARY_BUILDER_REVISION_FR;
    case 'it':
      return SUMMARY_BUILDER_REVISION_IT;
    case 'hi':
      // Preserve AAB-278/280/281 packaging (`live-hindi-material-rebuild-v3`).
      void SUMMARY_BUILDER_REVISION_HI_353;
      return SUMMARY_BUILDER_REVISION;
    case 'hr':
      return SUMMARY_BUILDER_REVISION_HR;
    case 'ja':
      return SUMMARY_BUILDER_REVISION_JA;
    case 'ru':
      return SUMMARY_BUILDER_REVISION_RU;
    case 'sr':
      return SUMMARY_BUILDER_REVISION_SR;
    case 'es':
      // Spanish has dedicated entry-owned packaging via Spanish grounding module.
      return 'entry-owned-spanish-rebuild-v1';
    case 'pt':
    case 'pt-br':
    case 'pt_br':
      return SUMMARY_BUILDER_REVISION_PT_BR;
    default:
      // Remaining locales (and unknown aliases) stay fail-closed.
      void SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION;
      return SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION;
  }
}

export type SummaryPerspectiveMode = 'first_person' | 'neutral_cv' | 'cv_third_person';

/** Detect first-person Professional Summary perspective for the requested locale. */
export function detectSummaryPerspectiveForLocale(
  text: string,
  requestedLocale: Locale | string,
  empQPerspective?: string | null,
): SummaryPerspectiveMode {
  void SUMMARY_REQUESTED_LOCALE_DISPATCH_355_REVISION;
  const locale = String(requestedLocale || '').toLowerCase();
  const analyzed = text || '';
  if (empQPerspective === 'first_person') return 'first_person';
  if (empQPerspective === 'cv_third_person' || empQPerspective === 'third_person') {
    return 'cv_third_person';
  }
  if (empQPerspective === 'neutral_cv') return 'neutral_cv';

  switch (locale) {
    case 'en':
      return /\bI\b/.test(analyzed) ? 'first_person' : 'neutral_cv';
    case 'de':
      return detectGermanSummaryPerspective(analyzed);
    case 'fr':
      return detectFrenchSummaryPerspective(analyzed);
    case 'it':
      return detectItalianSummaryPerspective(analyzed);
    case 'hi':
      return /(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|मेरे\s+पास|कार्यरत\s+हूँ|करती\s+हूँ|करता\s+हूँ/u
        .test(analyzed)
        ? 'first_person'
        : 'neutral_cv';
    case 'ar':
      return /(?:^|[^\p{L}])(?:أنا|لدي|أعمل|أتحقق|أنسق|عملت|أعددت)(?:[^\p{L}]|$)/u
        .test(analyzed)
        ? 'first_person'
        : 'neutral_cv';
    case 'sr':
      return /(?:^|[^\p{L}])(?:ја|имам|радим|радио|радила)\b/u.test(analyzed)
        || /\b(?:imam|radim|radio|radila)\b/iu.test(analyzed)
        ? 'first_person'
        : 'neutral_cv';
    case 'pt':
    case 'pt-br':
    case 'pt_br':
      return detectPortugueseBrazilSummaryPerspective(analyzed);
    case 'ru':
      return /\b(?:я|работаю|имею)\b/iu.test(analyzed) ? 'first_person' : 'neutral_cv';
    case 'ja':
      return /(?:私は|です。|ます。)/u.test(analyzed) ? 'first_person' : 'neutral_cv';
    default:
      return 'neutral_cv';
  }
}

/** Invariant helper: German request must never report Hindi/Arabic builder revision. */
export function assertSummaryBuilderMatchesRequestedLocale(
  requestedLocale: Locale | string,
  summaryBuilderRevision: string | null | undefined,
): string | null {
  void SUMMARY_REQUESTED_LOCALE_DISPATCH_355_REVISION;
  void SUMMARY_REQUESTED_LOCALE_DISPATCH_358_REVISION;
  const locale = String(requestedLocale || '').toLowerCase();
  const rev = String(summaryBuilderRevision || '');
  if (locale === 'de') {
    if (/live-hindi-material-rebuild/i.test(rev)) {
      return 'german_request_routed_to_hindi_builder';
    }
    if (/entry-owned-arabic/i.test(rev) && !/german/i.test(rev)) {
      return 'german_request_routed_to_arabic_builder';
    }
    if (rev && rev !== SUMMARY_BUILDER_REVISION_DE && !/german/i.test(rev)) {
      return 'german_request_builder_revision_mismatch';
    }
    return null;
  }
  if (locale === 'fr') {
    if (/entry-owned-english-rebuild/i.test(rev)) {
      return 'french_request_routed_to_english_builder';
    }
    if (/entry-owned-german-rebuild/i.test(rev)) {
      return 'french_request_routed_to_german_builder';
    }
    if (rev && rev !== SUMMARY_BUILDER_REVISION_FR && !/french/i.test(rev)) {
      return 'french_request_builder_revision_mismatch';
    }
    return null;
  }
  if (locale === 'it') {
    if (/entry-owned-english-rebuild/i.test(rev)) {
      return 'italian_request_routed_to_english_builder';
    }
    if (/entry-owned-german-rebuild/i.test(rev)) {
      return 'italian_request_routed_to_german_builder';
    }
    if (/entry-owned-french-rebuild/i.test(rev)) {
      return 'italian_request_routed_to_french_builder';
    }
    if (rev && rev !== SUMMARY_BUILDER_REVISION_IT && !/italian/i.test(rev)) {
      return 'italian_request_builder_revision_mismatch';
    }
    return null;
  }
  if (locale === 'pt' || locale === 'pt-br' || locale === 'pt_br') {
    if (/entry-owned-english-rebuild/i.test(rev)) {
      return 'ptbr_request_routed_to_english_builder';
    }
    if (/entry-owned-german-rebuild/i.test(rev)) {
      return 'ptbr_request_routed_to_german_builder';
    }
    if (/entry-owned-french-rebuild/i.test(rev)) {
      return 'ptbr_request_routed_to_french_builder';
    }
    if (/entry-owned-italian-rebuild/i.test(rev)) {
      return 'ptbr_request_routed_to_italian_builder';
    }
    if (/entry-owned-spanish-rebuild/i.test(rev)) {
      return 'ptbr_request_routed_to_spanish_builder';
    }
    if (rev && rev !== SUMMARY_BUILDER_REVISION_PT_BR && !/ptbr|portuguese|pt-br/i.test(rev)) {
      return 'ptbr_request_builder_revision_mismatch';
    }
  }
  return null;
}
