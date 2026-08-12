/**
 * AAB-329 — Experience selected-final coverage, phased diagnostic completeness,
 * and transactional apply-state truth.
 *
 * Pre-apply must not require post-apply visible fields.
 * Selected-final fact/predicate diagnostics must be independently materialized
 * before the pre-apply gate. Applied/committed fields must not be optimistic.
 */
import { fingerprintText } from './cv-export-diagnostics';
import { splitExperienceBullets } from './cv-canonical-facts';
import {
  validateEnglishWarehouseExperienceCoverage,
  scanEnglishWarehousePredicates,
  sourceRequiresStrictEnglishWarehouseFactCoverage,
  ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION,
} from './cv-english-experience-warehouse-grounding';
import {
  validateGermanWarehouseExperienceCoverage,
  scanGermanWarehousePredicates,
  sourceRequiresGermanWarehouseFactCoverage,
  GERMAN_EXPERIENCE_GROUNDING_303_REVISION,
} from './cv-german-experience-grounding';
import {
  validateSpanishWarehouseExperienceCoverage,
  scanSpanishWarehousePredicates,
  sourceRequiresSpanishWarehouseFactCoverage,
  SPANISH_CV_AI_305_REVISION,
} from './cv-spanish-experience-grounding';
import {
  validateFrenchWarehouseExperienceCoverage,
  scanFrenchWarehousePredicates,
  sourceRequiresFrenchWarehouseFactCoverage,
  FRENCH_EXPERIENCE_GROUNDING_332_REVISION,
} from './cv-french-experience-grounding';
import {
  validateItalianWarehouseExperienceCoverage,
  scanItalianWarehousePredicates,
  sourceRequiresItalianWarehouseFactCoverage,
  italianWarehouseFactDiagId,
  ITALIAN_EXPERIENCE_GROUNDING_334_REVISION,
} from './cv-italian-experience-grounding';
import {
  validatePortugueseWarehouseExperienceCoverage,
  scanPortugueseWarehousePredicates,
  sourceRequiresPortugueseWarehouseFactCoverage,
  portugueseWarehouseFactDiagId,
  PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION,
} from './cv-portuguese-experience-grounding';
import {
  validateRussianWarehouseExperienceCoverage,
  scanRussianWarehousePredicates,
  sourceRequiresRussianWarehouseFactCoverage,
  russianWarehouseFactDiagId,
  RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION,
} from './cv-russian-experience-grounding';
import {
  validateHindiWarehouseExperienceCoverage,
  scanHindiWarehousePredicates,
  sourceRequiresHindiWarehouseFactCoverage,
  hindiWarehouseFactDiagId,
  HINDI_EXPERIENCE_GROUNDING_338_REVISION,
} from './cv-hindi-experience-grounding';
import {
  validateJapaneseWarehouseExperienceCoverage,
  scanJapaneseWarehousePredicates,
  sourceRequiresJapaneseWarehouseFactCoverage,
  japaneseWarehouseFactDiagId,
  JAPANESE_EXPERIENCE_GROUNDING_339_REVISION,
} from './cv-japanese-experience-grounding';
import {
  validateArabicWarehouseExperienceCoverage,
  scanArabicWarehousePredicates,
  sourceRequiresArabicWarehouseFactCoverage,
  arabicWarehouseFactDiagId,
  ARABIC_EXPERIENCE_GROUNDING_340_REVISION,
} from './cv-arabic-experience-grounding';
import {
  validateSerbianWarehouseExperienceCoverage,
  scanSerbianWarehousePredicates,
  sourceRequiresSerbianWarehouseFactCoverage,
  serbianWarehouseFactDiagId,
  SERBIAN_EXPERIENCE_GROUNDING_341_REVISION,
} from './cv-serbian-experience-grounding';
import {
  validateCroatianWarehouseExperienceCoverage,
  scanCroatianWarehousePredicates,
  sourceRequiresCroatianWarehouseFactCoverage,
  croatianWarehouseFactDiagId,
  CROATIAN_EXPERIENCE_GROUNDING_342_REVISION,
} from './cv-croatian-experience-grounding';
import {
  GENERIC_EXPERIENCE_PREDICATE_343_REVISION,
  sourceRequiresGenericExperiencePredicates,
  scanGenericExperiencePredicates,
} from './cv-generic-experience-predicate-grounding';
import {
  validateCrossLocaleSemanticCoverage,
} from './cv-cross-locale-experience';
import {
  isPortugueseBrazilLocale,
  canonicalizeContentLocale,
  localesEquivalent,
} from './cv-content-locale';
import { resolveLocaleCandidate } from './i18n/translations';
import { textMatchesRequestedFieldLocale } from './cv-field-locale-integrity';
import { isWrongLanguageAiOutput } from './cv-ai-locale-guard';
import { validateExperienceCvPerspective } from './cv-experience-perspective';
import { validateArabicExperienceNativeMorphology } from './cv-arabic-experience-tense';

export const EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION =
  'experience-selected-final-coverage-329-v1' as const;
export const EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION =
  'experience-phased-diagnostic-completeness-329-v1' as const;
export const EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION =
  'experience-transactional-apply-truth-329-v1' as const;
export const EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION =
  'experience-final-visible-predicate-truth-329-v1' as const;
/** Empty-source generate_from_job_context: predicate coverage N/A (AAB-365/366). */
export const ENGLISH_EMPTY_SOURCE_GENERATION_365_REVISION =
  'english-empty-source-generation-365-v1' as const;

void EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION;
void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
void EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION;
void EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION;
void ENGLISH_EMPTY_SOURCE_GENERATION_365_REVISION;
void ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION;
void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
void SPANISH_CV_AI_305_REVISION;
void FRENCH_EXPERIENCE_GROUNDING_332_REVISION;
void GENERIC_EXPERIENCE_PREDICATE_343_REVISION;

export type ExperienceSelectedFinalCandidateSnapshot = {
  revision: typeof EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION;
  candidateKind: string;
  source: string;
  rawHash: string;
  normalizedHash: string;
  bulletCount: number;
  bulletScripts: string[];
  targetLocale: string;
  targetEntryIdHash: string | null;
  employmentState: 'current' | 'completed' | null;
  requiredFactCount: number;
  coveredFactCount: number;
  uncoveredFactIdentityHashes: string[];
  requiredFactSetHash: string;
  factCoveragePassed: boolean;
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  addedPredicateCount: number;
  addedPredicateIdentityHashes: string[];
  predicateCoveragePassed: boolean;
  unsupportedClaimCount: number;
  localeValidationPassed: boolean;
  tenseValidationPassed: boolean;
  perspectiveValidationPassed: boolean;
  meaningfulChangeDetected: boolean;
  capturedBeforeApply: true;
};

function detectBulletScriptsLocal(text: string): string[] {
  const bullets = splitExperienceBullets(text || '').map((b) => b.trim()).filter(Boolean);
  if (!bullets.length) return /[A-Za-z]/.test(text || '') ? ['latin'] : [];
  return bullets.map((b) => {
    if (/\p{Script=Devanagari}/u.test(b)) return 'devanagari';
    if (/\p{Script=Arabic}/u.test(b)) return 'arabic';
    if (/[\u3040-\u30ff\u3400-\u9fff]/.test(b)) return 'cjk';
    if (/\p{Script=Cyrillic}/u.test(b)) return 'cyrillic';
    if (/[čćžšđČĆŽŠĐ]/.test(b)) return 'latin_diacritic';
    return 'latin';
  });
}

function hashFactSet(ids: string[]): string {
  return fingerprintText([...ids].sort().join('|'));
}

/**
 * Independently recompute selected-final fact + predicate coverage for the
 * accepted candidate text (never copy provider-stage mutable counters alone).
 */
export function buildExperienceSelectedFinalCandidateSnapshot(options: {
  candidateText: string;
  sourceDescription: string;
  candidateKind?: string;
  source?: string;
  targetLocale: string;
  targetEntryIdHash?: string | null;
  employmentState?: 'current' | 'completed' | null;
  unsupportedClaimCount?: number;
  localeValidationPassed?: boolean;
  tenseValidationPassed?: boolean;
  perspectiveValidationPassed?: boolean;
  meaningfulChangeDetected?: boolean;
  requiredFactCountFallback?: number;
  coveredFactCountFallback?: number;
  uncoveredFactIdentityHashesFallback?: string[];
  sourcePredicateIdentityCountFallback?: number;
  candidatePredicateIdentityCountFallback?: number;
  predicateCoveragePassedFallback?: boolean | null;
}): ExperienceSelectedFinalCandidateSnapshot {
  void EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION;
  void EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION;
  const text = (options.candidateText || '').trim();
  const source = options.sourceDescription || '';
  const locale = (options.targetLocale || 'en').toLowerCase();
  const bullets = splitExperienceBullets(text).map((b) => b.trim()).filter(Boolean);
  const normalized = text.replace(/\s+/g, ' ').trim();

  let requiredFactCount = Number(options.requiredFactCountFallback ?? 0);
  let coveredFactCount = Number(options.coveredFactCountFallback ?? 0);
  let uncovered: string[] = [...(options.uncoveredFactIdentityHashesFallback || [])];
  // Vacuous truth: requiredFactCount=0 (empty-source generation) passes coverage
  // when uncovered is empty — never invent source-predicate coverage as true.
  let factCoveragePassed = coveredFactCount === requiredFactCount
    && uncovered.length === 0;
  let sourcePredicateIdentityCount = Number(options.sourcePredicateIdentityCountFallback ?? 0);
  let candidatePredicateIdentityCount = Number(
    options.candidatePredicateIdentityCountFallback ?? 0,
  );
  let addedPredicateCount = 0;
  let addedPredicateIdentityHashes: string[] = [];
  let predicateCoveragePassed = options.predicateCoveragePassedFallback === true
    && candidatePredicateIdentityCount > 0
    && candidatePredicateIdentityCount >= sourcePredicateIdentityCount;

  if (locale === 'en' && sourceRequiresStrictEnglishWarehouseFactCoverage(source)) {
    const cov = validateEnglishWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `en_wh_${id}`);
    factCoveragePassed = cov.ok;
    const pred = scanEnglishWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (locale === 'de' && sourceRequiresGermanWarehouseFactCoverage(source)) {
    const cov = validateGermanWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `de_wh_${id}`);
    factCoveragePassed = cov.ok;
    const pred = scanGermanWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (locale === 'es' && sourceRequiresSpanishWarehouseFactCoverage(source)) {
    const cov = validateSpanishWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `es_wh_${id}`);
    factCoveragePassed = cov.ok;
    const pred = scanSpanishWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (locale === 'fr' && sourceRequiresFrenchWarehouseFactCoverage(source)) {
    const cov = validateFrenchWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `fr_wh_${id}`);
    factCoveragePassed = cov.ok;
    const pred = scanFrenchWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (locale === 'it' && sourceRequiresItalianWarehouseFactCoverage(source)) {
    void ITALIAN_EXPERIENCE_GROUNDING_334_REVISION;
    const cov = validateItalianWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => italianWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanItalianWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (
    isPortugueseBrazilLocale(locale)
    && sourceRequiresPortugueseWarehouseFactCoverage(source)
  ) {
    void PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION;
    const cov = validatePortugueseWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => portugueseWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanPortugueseWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (
    locale === 'ru'
    && sourceRequiresRussianWarehouseFactCoverage(source)
  ) {
    void RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION;
    const cov = validateRussianWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => russianWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanRussianWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (
    locale === 'hi'
    && sourceRequiresHindiWarehouseFactCoverage(source)
  ) {
    void HINDI_EXPERIENCE_GROUNDING_338_REVISION;
    const cov = validateHindiWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => hindiWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanHindiWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (
    locale === 'ja'
    && sourceRequiresJapaneseWarehouseFactCoverage(source)
  ) {
    void JAPANESE_EXPERIENCE_GROUNDING_339_REVISION;
    const cov = validateJapaneseWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => japaneseWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanJapaneseWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (
    locale === 'ar'
    && sourceRequiresArabicWarehouseFactCoverage(source)
  ) {
    void ARABIC_EXPERIENCE_GROUNDING_340_REVISION;
    const cov = validateArabicWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => arabicWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanArabicWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (
    locale === 'sr'
    && sourceRequiresSerbianWarehouseFactCoverage(source)
  ) {
    void SERBIAN_EXPERIENCE_GROUNDING_341_REVISION;
    const cov = validateSerbianWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => serbianWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanSerbianWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (
    locale === 'hr'
    && sourceRequiresCroatianWarehouseFactCoverage(source)
  ) {
    void CROATIAN_EXPERIENCE_GROUNDING_342_REVISION;
    const cov = validateCroatianWarehouseExperienceCoverage(source, text);
    requiredFactCount = cov.required.length;
    coveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => croatianWarehouseFactDiagId(id));
    factCoveragePassed = cov.ok;
    const pred = scanCroatianWarehousePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
  } else if (sourceRequiresGenericExperiencePredicates(source)) {
    const pred = scanGenericExperiencePredicates(source, text);
    sourcePredicateIdentityCount = pred.sourcePredicateIdentityCount;
    candidatePredicateIdentityCount = pred.candidatePredicateIdentityCount;
    addedPredicateCount = pred.candidateAddedPredicateCount;
    addedPredicateIdentityHashes = [...pred.candidateAddedPredicateIdentityHashes];
    predicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && candidatePredicateIdentityCount >= sourcePredicateIdentityCount
      && candidatePredicateIdentityCount > 0;
    if (!(requiredFactCount > 0 && coveredFactCount === requiredFactCount && uncovered.length === 0)) {
      const semantic = validateCrossLocaleSemanticCoverage(source, text);
      requiredFactCount = semantic.requiredCount;
      coveredFactCount = semantic.coveredCount;
      uncovered = [];
      factCoveragePassed = semantic.ok
        && semantic.coveredCount === semantic.requiredCount
        && semantic.requiredCount > 0;
    }
  }

  // Dedicated locale scanners remain the semantic authority for their facts,
  // while the shared scanner is an additive no-new-predicate gate for every
  // non-empty Experience source. This keeps diagnostics truthful when a
  // locale-specific scanner covers all source facts but misses an inserted
  // material action in the selected candidate.
  if (sourceRequiresGenericExperiencePredicates(source)) {
    const sharedPred = scanGenericExperiencePredicates(source, text);
    addedPredicateIdentityHashes = Array.from(new Set([
      ...addedPredicateIdentityHashes,
      ...sharedPred.candidateAddedPredicateIdentityHashes,
    ]));
    addedPredicateCount = addedPredicateIdentityHashes.length;
    predicateCoveragePassed = predicateCoveragePassed
      && sharedPred.candidateAddedPredicateCount === 0;
  }

  return {
    revision: EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION,
    candidateKind: options.candidateKind || options.source || 'provider',
    source: options.source || options.candidateKind || 'provider',
    rawHash: fingerprintText(text),
    normalizedHash: fingerprintText(normalized),
    bulletCount: bullets.length,
    bulletScripts: detectBulletScriptsLocal(text),
    targetLocale: locale,
    targetEntryIdHash: options.targetEntryIdHash ?? null,
    employmentState: options.employmentState ?? null,
    requiredFactCount,
    coveredFactCount,
    uncoveredFactIdentityHashes: uncovered,
    requiredFactSetHash: hashFactSet(
      locale === 'en' && sourceRequiresStrictEnglishWarehouseFactCoverage(source)
        ? validateEnglishWarehouseExperienceCoverage(source, text).required.map((id) => `en_wh_${id}`)
        : (
          locale === 'de' && sourceRequiresGermanWarehouseFactCoverage(source)
            ? validateGermanWarehouseExperienceCoverage(source, text).required.map((id) => `de_wh_${id}`)
            : (
              locale === 'es' && sourceRequiresSpanishWarehouseFactCoverage(source)
                ? validateSpanishWarehouseExperienceCoverage(source, text).required.map((id) => `es_wh_${id}`)
                : (
                  locale === 'fr' && sourceRequiresFrenchWarehouseFactCoverage(source)
                    ? validateFrenchWarehouseExperienceCoverage(source, text).required.map((id) => `fr_wh_${id}`)
                    : (
                      locale === 'it' && sourceRequiresItalianWarehouseFactCoverage(source)
                        ? validateItalianWarehouseExperienceCoverage(source, text).required
                          .map((id) => italianWarehouseFactDiagId(id))
                        : (
                          isPortugueseBrazilLocale(locale)
                          && sourceRequiresPortugueseWarehouseFactCoverage(source)
                            ? validatePortugueseWarehouseExperienceCoverage(source, text).required
                              .map((id) => portugueseWarehouseFactDiagId(id))
                            : (
                              locale === 'ru'
                              && sourceRequiresRussianWarehouseFactCoverage(source)
                                ? validateRussianWarehouseExperienceCoverage(source, text).required
                                  .map((id) => russianWarehouseFactDiagId(id))
                                : (
                                  locale === 'hi'
                                  && sourceRequiresHindiWarehouseFactCoverage(source)
                                    ? validateHindiWarehouseExperienceCoverage(source, text).required
                                      .map((id) => hindiWarehouseFactDiagId(id))
                                    : (
                                      locale === 'ja'
                                      && sourceRequiresJapaneseWarehouseFactCoverage(source)
                                        ? validateJapaneseWarehouseExperienceCoverage(source, text).required
                                          .map((id) => japaneseWarehouseFactDiagId(id))
                                        : (
                                          locale === 'ar'
                                          && sourceRequiresArabicWarehouseFactCoverage(source)
                                            ? validateArabicWarehouseExperienceCoverage(source, text).required
                                              .map((id) => arabicWarehouseFactDiagId(id))
                                            : (
                                              locale === 'sr'
                                              && sourceRequiresSerbianWarehouseFactCoverage(source)
                                                ? validateSerbianWarehouseExperienceCoverage(source, text).required
                                                  .map((id) => serbianWarehouseFactDiagId(id))
                                                : Array.from({ length: requiredFactCount }, (_, i) => `req_${i}`)
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        ),
    ),
    factCoveragePassed,
    sourcePredicateIdentityCount,
    candidatePredicateIdentityCount,
    addedPredicateCount,
    addedPredicateIdentityHashes,
    predicateCoveragePassed,
    unsupportedClaimCount: Math.max(
      Number(options.unsupportedClaimCount ?? 0),
      addedPredicateCount,
    ),
    localeValidationPassed: options.localeValidationPassed !== false,
    tenseValidationPassed: options.tenseValidationPassed !== false,
    perspectiveValidationPassed: options.perspectiveValidationPassed !== false,
    meaningfulChangeDetected: Boolean(options.meaningfulChangeDetected),
    capturedBeforeApply: true,
  };
}

export function selectedFinalSnapshotToDiagnostics(
  snap: ExperienceSelectedFinalCandidateSnapshot,
): Record<string, unknown> {
  void EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION;
  // Source-predicate coverage is enhancement-only. Empty-source / zero source
  // predicates → explicitly not applicable (null pass), never a fake true.
  const predicateValidationApplicable = snap.sourcePredicateIdentityCount > 0;
  return {
    experienceSelectedFinalCoverageRevision: EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION,
    experienceFinalVisiblePredicateTruthRevision:
      EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION,
    finalCandidatePresent: true,
    finalCandidateSource: snap.source,
    finalNormalizedHash: snap.normalizedHash,
    finalCandidateBulletCount: snap.bulletCount,
    finalCandidateBulletScripts: [...snap.bulletScripts],
    finalBulletCount: snap.bulletCount,
    finalBulletScripts: [...snap.bulletScripts],
    finalRequiredFactCount: snap.requiredFactCount,
    finalCoveredFactCount: snap.coveredFactCount,
    finalUncoveredFactIdentityHashes: [...snap.uncoveredFactIdentityHashes],
    finalRequiredFactSetHash: snap.requiredFactSetHash,
    finalFactCoveragePassed: snap.factCoveragePassed,
    finalCandidatePredicateValidationApplicable: predicateValidationApplicable,
    finalCandidatePredicateIdentityCount: snap.candidatePredicateIdentityCount,
    finalAddedPredicateCount: snap.addedPredicateCount,
    finalAddedPredicateIdentityHashes: [...snap.addedPredicateIdentityHashes],
    finalSourceUnitPredicateCoveragePassed: predicateValidationApplicable
      ? snap.predicateCoveragePassed
      : null,
    sourcePredicateIdentityCount: snap.sourcePredicateIdentityCount,
    // Keep required/covered aliases aligned for legacy readers.
    requiredFactCount: snap.requiredFactCount,
    coveredFactCount: snap.coveredFactCount,
  };
}

/** Pre-apply invariants for selected-final decision fields (before any write). */
export function checkExperiencePreapplyDiagnosticInvariants(
  trace: Record<string, unknown>,
): {
  passed: boolean;
  failures: Array<{
    invariantCode: string;
    observed: Record<string, string | number | boolean | null>;
  }>;
} {
  void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
  const failures: Array<{
    invariantCode: string;
    observed: Record<string, string | number | boolean | null>;
  }> = [];
  const asObs = (v: unknown): string | number | boolean | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    return String(v);
  };
  const push = (
    code: string,
    observed: Record<string, unknown>,
  ) => {
    const clean: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(observed)) clean[k] = asObs(v);
    failures.push({ invariantCode: code, observed: clean });
  };

  if (trace.finalCandidatePresent === true) {
    if (!trace.finalNormalizedHash) {
      push('final_candidate_present_without_hash', {
        finalCandidatePresent: true,
        finalNormalizedHash: trace.finalNormalizedHash ?? null,
      });
    }
    if (typeof trace.finalRequiredFactCount !== 'number'
      || typeof trace.finalCoveredFactCount !== 'number'
      || typeof trace.finalFactCoveragePassed !== 'boolean') {
      push('final_candidate_missing_fact_diagnostics', {
        finalRequiredFactCount: trace.finalRequiredFactCount ?? null,
        finalCoveredFactCount: trace.finalCoveredFactCount ?? null,
        finalFactCoveragePassed: trace.finalFactCoveragePassed ?? null,
      });
    }
  }

  if (trace.finalFactCoveragePassed === true) {
    const req = Number(trace.finalRequiredFactCount ?? 0);
    const cov = Number(trace.finalCoveredFactCount ?? 0);
    const uncovered = Array.isArray(trace.finalUncoveredFactIdentityHashes)
      ? (trace.finalUncoveredFactIdentityHashes as unknown[])
      : null;
    // Allow vacuous pass when requiredFactCount=0 (empty-source generation).
    if (!(cov === req && uncovered && uncovered.length === 0)) {
      push('final_fact_coverage_pass_inconsistent', {
        finalRequiredFactCount: req,
        finalCoveredFactCount: cov,
        finalUncoveredCount: uncovered ? uncovered.length : -1,
      });
    }
  }

  if (trace.finalSourceUnitPredicateCoveragePassed === true) {
    const src = Number(trace.sourcePredicateIdentityCount ?? 0);
    const fin = Number(trace.finalCandidatePredicateIdentityCount ?? 0);
    if (!(fin > 0 && fin >= src)) {
      push('final_predicate_pass_with_insufficient_count', {
        sourcePredicateIdentityCount: src,
        finalCandidatePredicateIdentityCount: fin,
        finalSourceUnitPredicateCoveragePassed: true,
      });
    }
  }

  if (Number(trace.finalCandidatePredicateIdentityCount ?? 0) === 0
    && Number(trace.sourcePredicateIdentityCount ?? 0) > 0
    && (trace.finalCandidatePresent === true || trace.providerAccepted === true)) {
    push('final_predicate_count_zero_while_source_nonzero', {
      sourcePredicateIdentityCount: trace.sourcePredicateIdentityCount,
      finalCandidatePredicateIdentityCount: 0,
    });
  }

  if (Array.isArray(trace.finalCandidateBulletScripts)
    && typeof trace.finalCandidateBulletCount === 'number'
    && (trace.finalCandidateBulletScripts as unknown[]).length
      !== Number(trace.finalCandidateBulletCount)) {
    push('final_bullet_scripts_length_mismatch', {
      finalCandidateBulletCount: trace.finalCandidateBulletCount,
      finalCandidateBulletScriptsLength:
        (trace.finalCandidateBulletScripts as unknown[]).length,
    });
  }

  if (trace.applyAuthorized === true
    && (trace.preapplyDiagnosticInvariantCheckPassed === false
      || trace.preapplyDiagnosticCompletenessPassed === false)) {
    push('apply_authorized_without_preapply_pass', {
      applyAuthorized: true,
      preapplyDiagnosticInvariantCheckPassed: trace.preapplyDiagnosticInvariantCheckPassed ?? null,
      preapplyDiagnosticCompletenessPassed: trace.preapplyDiagnosticCompletenessPassed ?? null,
    });
  }

  if (trace.targetContentApplied === true && trace.applyCommitted !== true) {
    push('target_content_applied_without_commit', {
      targetContentApplied: true,
      applyCommitted: trace.applyCommitted ?? null,
    });
  }

  if (trace.appliedExperienceEntryIdHash
    && trace.applyCommitted !== true) {
    push('applied_entry_hash_without_commit', {
      appliedExperienceEntryIdHash: trace.appliedExperienceEntryIdHash,
      applyCommitted: trace.applyCommitted ?? null,
    });
  }

  if (trace.contentLocaleUpdatedAfterApply === true && trace.applyCommitted !== true) {
    push('content_locale_updated_without_commit', {
      contentLocaleUpdatedAfterApply: true,
      applyCommitted: trace.applyCommitted ?? null,
    });
  }

  if (
    trace.applyCommitted === true
    && trace.targetContentApplied === true
    && trace.requestedTargetLocale
    && trace.appliedVisibleContentLocale
  ) {
    const appliedRaw = String(trace.appliedVisibleContentLocale);
    const requestedRaw = String(trace.requestedTargetLocale);
    const appliedCanon = String(canonicalizeContentLocale(appliedRaw));
    const requestedCanon = String(canonicalizeContentLocale(requestedRaw));
    // Alias-equivalent internal keys remain acceptable for mismatch detection.
    if (appliedCanon && requestedCanon && !localesEquivalent(appliedCanon, requestedCanon)) {
      push('applied_visible_locale_mismatch_after_commit', {
        appliedVisibleContentLocale: appliedRaw,
        requestedTargetLocale: requestedRaw,
      });
    }
    // Public appliedVisibleContentLocale must itself be the canonical string.
    if (
      resolveLocaleCandidate(requestedRaw)
      && appliedRaw
      && appliedRaw !== appliedCanon
    ) {
      push('applied_visible_locale_not_canonical_after_commit', {
        appliedVisibleContentLocale: appliedRaw,
        canonicalAppliedVisibleContentLocale: appliedCanon,
        requestedTargetLocale: requestedRaw,
      });
    }
  }

  if (trace.translationFallbackApplied === true && trace.applyCommitted !== true) {
    push('translation_fallback_applied_without_commit', {
      translationFallbackApplied: true,
      applyCommitted: trace.applyCommitted ?? null,
    });
  }

  if (
    trace.contentLocaleUpdatedAfterApply === true
    && trace.applyCommitted === true
    && trace.requestedTargetLocale
    && trace.appliedVisibleContentLocale
  ) {
    const appliedCanon = String(
      canonicalizeContentLocale(String(trace.appliedVisibleContentLocale)),
    );
    const requestedCanon = String(
      canonicalizeContentLocale(String(trace.requestedTargetLocale)),
    );
    if (appliedCanon && requestedCanon && !localesEquivalent(appliedCanon, requestedCanon)) {
      push('content_locale_updated_but_applied_locale_not_target', {
        appliedVisibleContentLocale: String(trace.appliedVisibleContentLocale),
        requestedTargetLocale: String(trace.requestedTargetLocale),
      });
    }
  }

  if (typeof trace.experienceCanonicalPreapplyDecisionRevision === 'string') {
    const semanticNoOp = trace.semanticNoOpDetected === true
      && trace.materialImprovementDetected === false;
    if (semanticNoOp && (
      trace.finalDecisionKind !== 'semantic_noop'
      || trace.finalVisibleDecisionAcceptedForApply !== false
      || trace.canonicalExperienceDecisionAllowsApply !== false
      || trace.canonicalExperienceDecisionAllowsUsage !== false
    )) {
      push('semantic_noop_canonical_decision_inconsistent', {
        semanticNoOpDetected: true,
        materialImprovementDetected: false,
        finalDecisionKind: trace.finalDecisionKind ?? null,
        finalVisibleDecisionAcceptedForApply:
          trace.finalVisibleDecisionAcceptedForApply ?? null,
      });
    }
    if (trace.canonicalExperienceDecisionAllowsApply === true && (
      trace.finalDecisionKind !== 'material_improvement'
      || trace.materialImprovementDetected !== true
      || trace.semanticNoOpDetected === true
      || trace.finalVisibleDecisionAcceptedForApply !== true
      || trace.canonicalExperienceDecisionAllowsUsage !== true
    )) {
      push('canonical_apply_without_material_improvement', {
        finalDecisionKind: trace.finalDecisionKind ?? null,
        materialImprovementDetected: trace.materialImprovementDetected ?? null,
        semanticNoOpDetected: trace.semanticNoOpDetected ?? null,
      });
    }
  }

  return { passed: failures.length === 0, failures };
}

/** Build immutable pre-apply decision snapshot hashes (no raw text). */
export function buildExperiencePreapplyDecisionSnapshot(trace: Record<string, unknown>): {
  preapplyDecisionSnapshotHash: string;
  preapplyDecisionCandidateHash: string | null;
  preapplyDecisionTargetEntryIdHash: string | null;
  preapplyDecisionCreated: true;
  preapplyDecisionUsedForApplyAuthorization: true;
} {
  void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
  const candidateHash = typeof trace.finalNormalizedHash === 'string'
    ? trace.finalNormalizedHash
    : null;
  const targetHash = typeof trace.selectedExperienceEntryIdHash === 'string'
    ? trace.selectedExperienceEntryIdHash
    : (typeof trace.clickedExperienceEntryIdHash === 'string'
      ? trace.clickedExperienceEntryIdHash
      : null);
  const snapshotHash = fingerprintText([
    candidateHash || '',
    targetHash || '',
    String(trace.finalRequiredFactCount ?? ''),
    String(trace.finalCoveredFactCount ?? ''),
    String(trace.finalCandidatePredicateIdentityCount ?? ''),
    String(trace.finalFactCoveragePassed ?? ''),
    String(trace.finalSourceUnitPredicateCoveragePassed ?? ''),
    String(trace.semanticNoOpDetected ?? ''),
    String(trace.semanticNoOpReason ?? ''),
    String(trace.materialImprovementDetected ?? ''),
    JSON.stringify(trace.materialImprovementKinds ?? []),
    String(trace.neutralRestyleDetected ?? ''),
    String(trace.finalDecisionKind ?? ''),
    String(trace.canonicalExperienceDecisionAllowsApply ?? ''),
    String(trace.canonicalExperienceDecisionAllowsUsage ?? ''),
  ].join('|'));
  return {
    preapplyDecisionSnapshotHash: snapshotHash,
    preapplyDecisionCandidateHash: candidateHash,
    preapplyDecisionTargetEntryIdHash: targetHash,
    preapplyDecisionCreated: true,
    preapplyDecisionUsedForApplyAuthorization: true,
  };
}

/** Pre-apply completeness: selected-final + authority fields; NO visible post-write fields. */
export function checkExperiencePreapplyDiagnosticCompleteness(
  trace: Record<string, unknown>,
): {
  passed: boolean;
  missingRequiredDiagnosticFields: string[];
  nullRequiredDiagnosticFields: string[];
} {
  void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
  const missing: string[] = [];
  const nullish: string[] = [];
  const require = (key: string) => {
    if (!(key in trace)) missing.push(key);
    else if (trace[key] === null || trace[key] === undefined) nullish.push(key);
  };
  const requireNonEmptyString = (key: string) => {
    require(key);
    if (typeof trace[key] === 'string' && !(trace[key] as string).trim()) {
      nullish.push(key);
    }
  };

  for (const key of [
    'diagnosticContractRevision',
    'schemaVersion',
    'requestedLocale',
    'selectedSourceKind',
    'clickedExperienceEntryIdHash',
    'authoritativeFactSourceKind',
    'visibleComparisonProvenance',
    'requiredFactCount',
  ] as const) {
    require(key);
  }
  // factAuthorityKind may be reconciled later; require at least one authority kind.
  if (
    (trace.factAuthorityKind === null || trace.factAuthorityKind === undefined)
    && (trace.authoritativeFactSourceKind === null
      || trace.authoritativeFactSourceKind === undefined)
  ) {
    nullish.push('factAuthorityKind');
  }
  if (!(
    typeof trace.sourceFactCount === 'number'
    || typeof trace.requiredFactCount === 'number'
  )) {
    missing.push('sourceFactCount');
  }

  if (typeof trace.experienceCanonicalPreapplyDecisionRevision === 'string') {
    for (const key of [
      'canonicalExperienceDecisionCreated',
      'providerCandidateValidationAccepted',
      'finalVisibleDecisionAcceptedForApply',
      'canonicalExperienceDecisionAllowsApply',
      'canonicalExperienceDecisionAllowsUsage',
      'semanticNoOpDetected',
      'materialImprovementDetected',
      'neutralRestyleDetected',
      'finalDecisionKind',
      'meaningfulChangeDetected',
    ] as const) {
      require(key);
    }
    if (!('semanticNoOpReason' in trace)) missing.push('semanticNoOpReason');
    if (!('materialImprovementKinds' in trace)) missing.push('materialImprovementKinds');
  }

  if (trace.finalCandidatePresent === true || trace.finalCandidateSource === 'provider'
    || trace.finalCandidateSource === 'deterministic_fallback'
    || (typeof trace.finalNormalizedHash === 'string' && trace.finalNormalizedHash)) {
    const predicateApplicable = trace.finalCandidatePredicateValidationApplicable !== false
      && !(
        trace.sourceWasEmpty === true
        || trace.operationMode === 'generate_from_job_context'
        || (
          Number(trace.sourceFactCount ?? -1) === 0
          && Number(trace.sourcePredicateIdentityCount ?? 0) === 0
          && Number(trace.requiredFactCount ?? -1) === 0
        )
      );
    for (const key of [
      'finalCandidatePresent',
      'finalCandidateSource',
      'finalNormalizedHash',
      'finalCandidateBulletCount',
      'finalCandidateBulletScripts',
      'finalRequiredFactCount',
      'finalCoveredFactCount',
      'finalUncoveredFactIdentityHashes',
      'finalFactCoveragePassed',
      'finalCandidatePredicateIdentityCount',
      'finalAddedPredicateCount',
      'finalUnsupportedClaimCount',
    ] as const) {
      require(key);
    }
    // Enhancement-only: require non-null predicate coverage pass only when applicable.
    if (predicateApplicable) {
      require('finalSourceUnitPredicateCoveragePassed');
    }
    requireNonEmptyString('finalNormalizedHash');
    if (Number(trace.finalCandidatePredicateIdentityCount ?? 0) <= 0
      && Number(trace.sourcePredicateIdentityCount ?? 0) > 0) {
      nullish.push('finalCandidatePredicateIdentityCount_must_cover_source');
    }
    if (trace.finalSourceUnitPredicateCoveragePassed === true
      && Number(trace.finalCandidatePredicateIdentityCount ?? 0) <= 0) {
      nullish.push('final_predicate_pass_with_zero_count');
    }
    if (Array.isArray(trace.finalCandidateBulletScripts)
      && typeof trace.finalCandidateBulletCount === 'number'
      && (trace.finalCandidateBulletScripts as unknown[]).length
        !== Number(trace.finalCandidateBulletCount)) {
      nullish.push('finalCandidateBulletScripts_length_mismatch');
    }
  }

  // Explicitly do NOT require post-apply visible fields here.
  return {
    passed: missing.length === 0 && nullish.length === 0,
    missingRequiredDiagnosticFields: [...new Set(missing)],
    nullRequiredDiagnosticFields: [...new Set(nullish)],
  };
}

/** Post-apply completeness: visible validation + commit fields. */
export function checkExperiencePostapplyDiagnosticCompleteness(
  trace: Record<string, unknown>,
): {
  passed: boolean;
  missingRequiredDiagnosticFields: string[];
  nullRequiredDiagnosticFields: string[];
} {
  void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
  const missing: string[] = [];
  const nullish: string[] = [];
  const require = (key: string) => {
    if (!(key in trace)) missing.push(key);
    else if (trace[key] === null || trace[key] === undefined) nullish.push(key);
  };
  for (const key of [
    'applyAuthorized',
    'applyAttempted',
    'applyWriteSucceeded',
    'visibleValidationAttempted',
    'visibleValidationPassed',
    'applyCommitted',
    'visibleDescriptionMatchesFinalHash',
    'visibleRequiredFactCount',
    'visibleCoveredFactCount',
    'visibleUncoveredFactIdentityHashes',
    'visibleFactCoveragePassed',
    'visibleRequiredPredicateCount',
    'visibleCoveredPredicateCount',
    'visiblePredicateCoveragePassed',
    'visibleNormalizedHash',
    'visibleLocaleValidationPassed',
    'visibleTenseValidationPassed',
  ] as const) {
    require(key);
  }
  return {
    passed: missing.length === 0 && nullish.length === 0,
    missingRequiredDiagnosticFields: [...new Set(missing)],
    nullRequiredDiagnosticFields: [...new Set(nullish)],
  };
}

export function combineExperienceDiagnosticCompleteness(options: {
  preapplyPassed: boolean | null | undefined;
  postapplyPassed: boolean | null | undefined;
  /** When post-apply was never reached (pre-apply reject). */
  postapplyApplicable?: boolean;
}): boolean {
  void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
  if (options.preapplyPassed !== true) return false;
  if (options.postapplyApplicable === false) return false;
  if (options.postapplyPassed == null) return false;
  return options.postapplyPassed === true;
}

export type ExperienceTransactionalApplyState = {
  revision: typeof EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION;
  applyAuthorized: boolean;
  applyAttempted: boolean;
  applyWriteSucceeded: boolean;
  visibleValidationAttempted: boolean;
  visibleValidationPassed: boolean;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean | null;
  applyCommitted: boolean;
  targetContentApplied: boolean;
  contentLocaleUpdatedAfterApply: boolean;
  attemptedApplyExperienceEntryIdHash: string | null;
  attemptedApplyEmploymentState: string | null;
  attemptedApplyCandidateHash: string | null;
  appliedExperienceEntryIdHash: string | null;
  appliedEmploymentState: string | null;
  appliedFinalBulletCount: number;
  appliedFinalBulletScripts: string[];
  visibleApplySucceeded: boolean;
};

export function emptyTransactionalApplyState(): ExperienceTransactionalApplyState {
  void EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION;
  return {
    revision: EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION,
    applyAuthorized: false,
    applyAttempted: false,
    applyWriteSucceeded: false,
    visibleValidationAttempted: false,
    visibleValidationPassed: false,
    rollbackAttempted: false,
    rollbackSucceeded: null,
    applyCommitted: false,
    targetContentApplied: false,
    contentLocaleUpdatedAfterApply: false,
    attemptedApplyExperienceEntryIdHash: null,
    attemptedApplyEmploymentState: null,
    attemptedApplyCandidateHash: null,
    appliedExperienceEntryIdHash: null,
    appliedEmploymentState: null,
    appliedFinalBulletCount: 0,
    appliedFinalBulletScripts: [],
    visibleApplySucceeded: false,
  };
}

export function validateVisibleExperienceCoverage(options: {
  sourceDescription: string;
  visibleText: string;
  targetLocale: string;
  finalNormalizedHash: string;
  isPresent?: boolean;
}): {
  visibleRequiredFactCount: number;
  visibleCoveredFactCount: number;
  visibleUncoveredFactIdentityHashes: string[];
  visibleFactCoveragePassed: boolean;
  visibleRequiredFactSetHash: string;
  visibleRequiredPredicateCount: number;
  visibleCoveredPredicateCount: number;
  visibleMissingPredicateIdentityHashes: string[];
  visiblePredicateCoveragePassed: boolean;
  visiblePredicateValidationApplicable: boolean;
  visibleNormalizedHash: string;
  visibleDescriptionMatchesFinalHash: boolean;
  visibleLocaleValidationPassed: boolean;
  visiblePersonMode: string;
  visiblePerspectiveValidationPassed: boolean;
  visibleNativeMorphologyValidationPassed: boolean;
} {
  void EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION;
  const visible = (options.visibleText || '').trim();
  const normalized = visible.replace(/\s+/g, ' ').trim();
  const visibleNormalizedHash = fingerprintText(normalized);
  const locale = (options.targetLocale || 'en').toLowerCase();
  const resolvedLocale = resolveLocaleCandidate(options.targetLocale || 'en') || 'en';
  const visiblePerspective = validateExperienceCvPerspective(visible, resolvedLocale, {
    isPresent: options.isPresent,
  });
  const visibleNativeMorphology = resolvedLocale === 'ar'
    ? validateArabicExperienceNativeMorphology(visible, {
      isPresent: options.isPresent,
    })
    : null;
  let visibleRequiredFactCount = 0;
  let visibleCoveredFactCount = 0;
  let uncovered: string[] = [];
  let visibleFactCoveragePassed = false;
  let visibleRequiredPredicateCount = 0;
  let visibleCoveredPredicateCount = 0;
  let visiblePredicateCoveragePassed = false;
  let applicable = false;

  if (locale === 'en' && sourceRequiresStrictEnglishWarehouseFactCoverage(options.sourceDescription)) {
    applicable = true;
    const cov = validateEnglishWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `en_wh_${id}`);
    visibleFactCoveragePassed = cov.ok;
    const pred = scanEnglishWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    locale === 'de'
    && sourceRequiresGermanWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    const cov = validateGermanWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `de_wh_${id}`);
    visibleFactCoveragePassed = cov.ok;
    const pred = scanGermanWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    locale === 'es'
    && sourceRequiresSpanishWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    const cov = validateSpanishWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `es_wh_${id}`);
    visibleFactCoveragePassed = cov.ok;
    const pred = scanSpanishWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    locale === 'fr'
    && sourceRequiresFrenchWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    const cov = validateFrenchWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => `fr_wh_${id}`);
    visibleFactCoveragePassed = cov.ok;
    const pred = scanFrenchWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    locale === 'it'
    && sourceRequiresItalianWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void ITALIAN_EXPERIENCE_GROUNDING_334_REVISION;
    const cov = validateItalianWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => italianWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanItalianWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    isPortugueseBrazilLocale(options.targetLocale || locale)
    && sourceRequiresPortugueseWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION;
    const cov = validatePortugueseWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => portugueseWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanPortugueseWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    (options.targetLocale || locale) === 'ru'
    && sourceRequiresRussianWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION;
    const cov = validateRussianWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => russianWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanRussianWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    (options.targetLocale || locale) === 'hi'
    && sourceRequiresHindiWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void HINDI_EXPERIENCE_GROUNDING_338_REVISION;
    const cov = validateHindiWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => hindiWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanHindiWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    (options.targetLocale || locale) === 'ja'
    && sourceRequiresJapaneseWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void JAPANESE_EXPERIENCE_GROUNDING_339_REVISION;
    const cov = validateJapaneseWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => japaneseWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanJapaneseWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    (options.targetLocale || locale) === 'ar'
    && sourceRequiresArabicWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void ARABIC_EXPERIENCE_GROUNDING_340_REVISION;
    const cov = validateArabicWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => arabicWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanArabicWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    (options.targetLocale || locale) === 'sr'
    && sourceRequiresSerbianWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void SERBIAN_EXPERIENCE_GROUNDING_341_REVISION;
    const cov = validateSerbianWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => serbianWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanSerbianWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (
    (options.targetLocale || locale) === 'hr'
    && sourceRequiresCroatianWarehouseFactCoverage(options.sourceDescription)
  ) {
    applicable = true;
    void CROATIAN_EXPERIENCE_GROUNDING_342_REVISION;
    const cov = validateCroatianWarehouseExperienceCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = cov.required.length;
    visibleCoveredFactCount = cov.covered.length;
    uncovered = cov.uncovered.map((id) => croatianWarehouseFactDiagId(id));
    visibleFactCoveragePassed = cov.ok;
    const pred = scanCroatianWarehousePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  } else if (sourceRequiresGenericExperiencePredicates(options.sourceDescription)) {
    applicable = true;
    void GENERIC_EXPERIENCE_PREDICATE_343_REVISION;
    const semantic = validateCrossLocaleSemanticCoverage(options.sourceDescription, visible);
    visibleRequiredFactCount = semantic.requiredCount;
    visibleCoveredFactCount = semantic.coveredCount;
    uncovered = [];
    visibleFactCoveragePassed = semantic.ok
      && semantic.coveredCount === semantic.requiredCount
      && semantic.requiredCount > 0;
    const pred = scanGenericExperiencePredicates(options.sourceDescription, visible);
    visibleRequiredPredicateCount = pred.sourcePredicateIdentityCount;
    visibleCoveredPredicateCount = pred.candidatePredicateIdentityCount;
    visiblePredicateCoveragePassed = pred.sourceUnitPredicateCoveragePassed
      && visibleCoveredPredicateCount >= visibleRequiredPredicateCount
      && visibleCoveredPredicateCount > 0;
  }

  // Re-run the shared additive predicate gate even when a dedicated locale
  // validator was applicable. Visible truth must match selected-final truth
  // for material additions, not just for source fact coverage.
  if (sourceRequiresGenericExperiencePredicates(options.sourceDescription)) {
    const sharedPred = scanGenericExperiencePredicates(options.sourceDescription, visible);
    applicable = true;
    visiblePredicateCoveragePassed = visiblePredicateCoveragePassed
      && sharedPred.candidateAddedPredicateCount === 0;
  }

  return {
    visibleRequiredFactCount,
    visibleCoveredFactCount,
    visibleUncoveredFactIdentityHashes: uncovered,
    visibleFactCoveragePassed,
    visibleRequiredFactSetHash: hashFactSet(
      locale === 'en' && sourceRequiresStrictEnglishWarehouseFactCoverage(options.sourceDescription)
        ? validateEnglishWarehouseExperienceCoverage(options.sourceDescription, visible)
          .required.map((id) => `en_wh_${id}`)
        : (
          locale === 'de' && sourceRequiresGermanWarehouseFactCoverage(options.sourceDescription)
            ? validateGermanWarehouseExperienceCoverage(options.sourceDescription, visible)
              .required.map((id) => `de_wh_${id}`)
            : (
              locale === 'es' && sourceRequiresSpanishWarehouseFactCoverage(options.sourceDescription)
                ? validateSpanishWarehouseExperienceCoverage(options.sourceDescription, visible)
                  .required.map((id) => `es_wh_${id}`)
                : (
                  locale === 'fr' && sourceRequiresFrenchWarehouseFactCoverage(options.sourceDescription)
                    ? validateFrenchWarehouseExperienceCoverage(options.sourceDescription, visible)
                      .required.map((id) => `fr_wh_${id}`)
                    : (
                      locale === 'it' && sourceRequiresItalianWarehouseFactCoverage(options.sourceDescription)
                        ? validateItalianWarehouseExperienceCoverage(options.sourceDescription, visible)
                          .required.map((id) => italianWarehouseFactDiagId(id))
                        : (
                          isPortugueseBrazilLocale(options.targetLocale || locale)
                          && sourceRequiresPortugueseWarehouseFactCoverage(options.sourceDescription)
                            ? validatePortugueseWarehouseExperienceCoverage(options.sourceDescription, visible)
                              .required.map((id) => portugueseWarehouseFactDiagId(id))
                            : (
                              (options.targetLocale || locale) === 'ru'
                              && sourceRequiresRussianWarehouseFactCoverage(options.sourceDescription)
                                ? validateRussianWarehouseExperienceCoverage(options.sourceDescription, visible)
                                  .required.map((id) => russianWarehouseFactDiagId(id))
                                : (
                                  (options.targetLocale || locale) === 'hi'
                                  && sourceRequiresHindiWarehouseFactCoverage(options.sourceDescription)
                                    ? validateHindiWarehouseExperienceCoverage(options.sourceDescription, visible)
                                      .required.map((id) => hindiWarehouseFactDiagId(id))
                                    : (
                                      (options.targetLocale || locale) === 'ja'
                                      && sourceRequiresJapaneseWarehouseFactCoverage(options.sourceDescription)
                                        ? validateJapaneseWarehouseExperienceCoverage(options.sourceDescription, visible)
                                          .required.map((id) => japaneseWarehouseFactDiagId(id))
                                        : (
                                          (options.targetLocale || locale) === 'ar'
                                          && sourceRequiresArabicWarehouseFactCoverage(options.sourceDescription)
                                            ? validateArabicWarehouseExperienceCoverage(options.sourceDescription, visible)
                                              .required.map((id) => arabicWarehouseFactDiagId(id))
                                            : (
                                              (options.targetLocale || locale) === 'sr'
                                              && sourceRequiresSerbianWarehouseFactCoverage(options.sourceDescription)
                                                ? validateSerbianWarehouseExperienceCoverage(options.sourceDescription, visible)
                                                  .required.map((id) => serbianWarehouseFactDiagId(id))
                                                : (
                                                  (options.targetLocale || locale) === 'hr'
                                                  && sourceRequiresCroatianWarehouseFactCoverage(options.sourceDescription)
                                                    ? validateCroatianWarehouseExperienceCoverage(options.sourceDescription, visible)
                                                      .required.map((id) => croatianWarehouseFactDiagId(id))
                                                    : Array.from({ length: visibleRequiredFactCount }, (_, i) => `vis_${i}`)
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        ),
    ),
    visibleRequiredPredicateCount,
    visibleCoveredPredicateCount,
    visibleMissingPredicateIdentityHashes: [],
    visiblePredicateCoveragePassed,
    visiblePredicateValidationApplicable: applicable,
    visibleNormalizedHash,
    visibleDescriptionMatchesFinalHash: visibleNormalizedHash === options.finalNormalizedHash,
    visibleLocaleValidationPassed: Boolean(visible)
      && textMatchesRequestedFieldLocale(visible, resolvedLocale, 'experience_bullet')
      && !isWrongLanguageAiOutput(visible, resolvedLocale),
    visiblePersonMode: visiblePerspective.finalPersonMode,
    visiblePerspectiveValidationPassed:
      visiblePerspective.ok && (visibleNativeMorphology?.ok ?? true),
    visibleNativeMorphologyValidationPassed: visibleNativeMorphology?.ok ?? true,
  };
}
