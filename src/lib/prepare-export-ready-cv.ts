/**
 * Single authoritative export-ready snapshot for all templates and formats.
 * Semantic duty facts are the grounding identity — not English shell counts.
 */
import type { CVData, TemplateId, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import { normalizeLegacyCvRuntime } from './cv-legacy-runtime-migration';
import { normalizeCvRegion } from './cv-region';
import {
  buildCvCanonicalFactSet,
  formatExperienceBullets,
  type CvCanonicalFactSet,
} from './cv-canonical-facts';
import { validateSummaryExportCandidate } from './cv-export-integrity';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
  localizeCanonicalBulletLine,
  buildSourcePreservingExperienceBullets,
} from './cv-localized-fallback';
import { buildCrossLocaleExperienceFallback } from './cv-cross-locale-experience';
import { buildSummaryCompositionDiagnostics } from './cv-summary-grounding';
import { buildExperienceDurationSnapshot, formatApproximateDurationPhrase } from './cv-experience-duration';
import { applyCvContentQuality } from './cv-content-quality';
import {
  textMatchesRequestedFieldLocale,
  validateFinalLocalizedCvFields,
} from './cv-field-locale-integrity';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { auditCvExportIntegrity } from './cv-export-integrity-audit';
import { detectTextLocale, isCrossLocaleOperation } from './cv-content-locale';
import { CvExportFailure } from './cv-export-error-message';
import { LEGACY_RECOVERED_DISPLAY_DUTIES } from './cv-legacy-grounding-recovery';
import {
  displayTextForSemanticRecovery,
  internalShellsFromSemanticDuties,
  LEGACY_USER_ORIGIN_DUTIES,
  resolveExperienceSemanticGrounding,
  recoveredUserOriginNeedsSourceBoundLocalization,
  semanticDutyKeys,
  type ExperienceSemanticGrounding,
  type SemanticDutyKey,
} from './cv-semantic-duty-facts';
import { splitExperienceBullets } from './cv-canonical-facts';
import {
  buildExperienceJobContext,
  buildOccupationAwareExperienceFallback,
  buildOccupationAwareSummaryFallback,
  filterSemanticDutiesForJobContext,
  hasGenuineUserExperienceGrounding,
  hasUnsupportedRegulatedPharmacyClaims,
  isSummaryStaleForJobContext,
  scrubOrphanDurationFragments,
  textLooksLikeCookingDuties,
} from './cv-experience-job-context';
import {
  materialDutyKeysFromDescription,
  validateExperienceApplyMaterialPostcondition,
  validateMaterialDutyCoverage,
} from './cv-material-duty-coverage';
import { validateSourceFactIdentityCoverage } from './cv-source-fact-identity';
import { projectExperienceFromLocalizedSurfaces } from './cv-experience-localized-surfaces';

function classifyMaterialBulletScript(bullet: string): 'hi' | 'en' | 'mixed' | 'empty' {
  const t = (bullet || '').trim();
  if (!t) return 'empty';
  const dev = (t.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  if (dev > 0 && lat >= 4) return 'mixed';
  if (dev > 0) return 'hi';
  if (lat > 0) return 'en';
  return 'empty';
}

export type ExportReadyStage =
  | 'normalize_runtime'
  | 'normalize_region'
  | 'resolve_provenance'
  | 'recover_legacy_grounding'
  | 'produce_semantic_duties'
  | 'produce_localized_display'
  | 'construct_summary_fact_set'
  | 'validate_summary'
  | 'recover_summary'
  | 'validate_locale_integrity'
  | 'complete';

export type ExportReadyDiagnostics = {
  selectedTemplateId: TemplateId | string;
  requestedLocale: Locale;
  runtimeMigrationVersion?: number;
  experienceCount: number;
  recoveryInvoked: boolean;
  experienceProvenance: Array<{
    id: string;
    hasOriginalUserDescription: boolean;
    hasCanonicalDescription: boolean;
    hasCanonicalSnapshot: boolean;
    hasGeneratedDescription: boolean;
    descriptionOrigin?: string;
    generatedLocale?: string;
    groundingRecoverySource?: string;
    source: ExperienceSemanticGrounding['source'];
    semanticDutyKeys: SemanticDutyKey[];
    visibleBulletCount: number;
    groundingBulletCount: number;
    exportBulletCount: number;
  }>;
  summaryFactSetSource: 'semantic_duties' | 'modern_provenance' | 'occupation_generic' | 'none';
  summarySemanticDutyKeys: SemanticDutyKey[];
  summaryInitialValid?: boolean;
  summaryInitialReason?: string;
  summaryRecoverySource?: 'saved_summary' | 'deterministic_semantic_facts' | 'occupation_generic_fallback';
  summaryRecoveryReason?: string;
  /** Non-PII job-context / Summary invalidation diagnostics. */
  experienceGenerationContextKey?: string;
  summaryGenerationContextKey?: string;
  summaryContextMatch?: boolean;
  staleSummaryExcluded?: boolean;
  summaryFactKeysBefore?: string[];
  summaryFactKeysUsed?: string[];
  occupationGenericFallbackUsed?: boolean;
  unsupportedRoleSpecificClaimReason?: string;
  durationCompositionSource?: string;
  summarySourceFactCount?: number;
  summaryCoveredFactCount?: number;
  summaryBulletMarkersRemoved?: number;
  summarySkillsIncludedCount?: number;
  summarySkillsCompositionMode?: 'grammatical_sentence' | 'omitted' | 'none';
  summaryFallbackReason?: string;
  summaryMaterialCoverageResult?: 'complete' | 'incomplete' | 'empty_source';
  /** Non-mutating export integrity audit (build 271/272). */
  exportIntegrityOk?: boolean;
  exportIntegrityReasons?: string[];
  exportIntegrityMarker?: string;
  stage: ExportReadyStage;
};

export type PrepareExportReadyResult =
  | {
    ok: true;
    cv: CVData;
    diagnostics: ExportReadyDiagnostics;
  }
  | {
    ok: false;
    reason: string;
    stage: ExportReadyStage;
    diagnostics: ExportReadyDiagnostics;
  };

function fail(
  reason: string,
  stage: ExportReadyStage,
  diagnostics: ExportReadyDiagnostics,
): PrepareExportReadyResult {
  return {
    ok: false,
    reason,
    stage,
    diagnostics: { ...diagnostics, stage },
  };
}

const COOKING_TRIAD: SemanticDutyKey[] = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
];

/** Unsupported Summary claims for non-food / non-logistics Experience packages. */
function summaryHasUnsupportedDomainClaims(summary: string, experienceBlob: string): boolean {
  const s = (summary || '').normalize('NFKC');
  if (!s.trim()) return false;
  const src = (experienceBlob || '').normalize('NFKC');
  const cookingClaim = /(?:restaurant\s+standard|kitchen\s+standard|إعداد\s*الأطباق|تحضير\s*(?:الأطباق|الطعام)|طبق|أطباق|طعام|مطبخ|مطعم|dish(?:es)?|cuisine|jel\w*|kuhinj)/iu.test(s);
  const cookingSupport = /(?:restaurant|kitchen|dish|cuisine|jel\w*|kuhinj|مطبخ|مطعم|طبق|أطباق|طعام|व्यंजन|रसोई)/iu.test(src);
  if (cookingClaim && !cookingSupport) return true;
  const transportClaim = /(?:transport(?:ing|ed)?|loading|deliver(?:y|ing|ed)?|نقل|تحميل|تسليم|تحميل\s*البضائع|توصيل)/iu.test(s)
    && !/(?:design\s+deliver|deliverable)/iu.test(s);
  const transportSupport = /(?:transport|loading|deliver(?!able)|نقل|تحميل|تسليم|prevoz|isporuč|परिवहन|डिलीवरी)/iu.test(src);
  if (transportClaim && !transportSupport) return true;
  return false;
}

function structuredExemptions(cv: CVData) {
  return {
    fullName: cv.personal?.fullName || '',
    email: cv.personal?.email || '',
    phone: cv.personal?.phone || '',
    companies: (cv.experience || []).map((e) => e.company || '').filter(Boolean),
    jobTitles: [
      cv.personal?.jobTitle || '',
      ...(cv.experience || []).map((e) => e.position || ''),
    ].filter(Boolean),
  };
}

/** Strip structured proper nouns before script classification. */
function stripStructuredProperNouns(text: string, cv: CVData): string {
  let t = text;
  const exemptions = structuredExemptions(cv);
  for (const value of [
    exemptions.fullName,
    exemptions.email,
    exemptions.phone,
    ...exemptions.companies,
    ...exemptions.jobTitles,
  ]) {
    const v = (value || '').trim();
    if (v.length >= 2) {
      t = t.split(v).join(' ');
    }
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Material final Experience bullets must match requested locale.
 * en / mixed / empty after proper-noun strip ⇒ incomplete projection.
 * Per-bullet target-locale purity (build 271/272) — one English bullet fails sr.
 */
function experienceBulletsMatchRequestedLocale(
  description: string,
  requestedLocale: Locale,
  cv: CVData,
): boolean {
  const bullets = splitExperienceBullets(description);
  if (!bullets.length) return false;
  const exemptions = structuredExemptions(cv);
  for (const bullet of bullets) {
    const stripped = stripStructuredProperNouns(bullet, cv);
    if (!stripped) continue;
    if (requestedLocale === 'hi') {
      const script = classifyMaterialBulletScript(stripped);
      if (script === 'en' || script === 'mixed' || script === 'empty') return false;
    }
    if (!textMatchesRequestedFieldLocale(stripped, requestedLocale, 'experience_bullet', exemptions)) {
      return false;
    }
  }
  const purity = validateAiUnitLocalePurity(description, requestedLocale, {
    kind: 'experience_bullet',
    requireUnits: true,
  });
  if (!purity.ok) return false;
  return true;
}

/**
 * Project Experience display into requestedLocale from semantic duties.
 * Does not mutate canonical user facts (originalUserDescription / canonicalSnapshot).
 * Two Hindi lines may cover the cooking triad — never pad with English shells.
 */
function projectExperienceDisplayFromSemanticDuties(
  exp: WorkExperience,
  grounding: ExperienceSemanticGrounding,
  requestedLocale: Locale,
  gender: string,
  cv: CVData,
  exportContext?: { industry?: string; level?: string },
): string {
  const current = (exp.description || '').trim();
  if (grounding.source === 'user_origin_recovered') {
    const sourceBoundProjection = projectExperienceFromLocalizedSurfaces({
      cv,
      exp,
      grounding,
      targetLocale: requestedLocale,
    });
    if (sourceBoundProjection !== null) return sourceBoundProjection;
  }
  const jobCtx = buildExperienceJobContext({
    position: exp.position || cv.personal?.jobTitle,
    locale: requestedLocale,
    industry: exportContext?.industry,
    level: exportContext?.level,
  });
  const authoritativeSourceRaw = (
    exp.originalUserDescription
    || exp.canonicalDescription
    || ''
  ).trim();
  // Do not rebuild from prior-occupation cooking shells under pharmacist/tech roles.
  const authoritativeSource = (
    textLooksLikeCookingDuties(authoritativeSourceRaw)
    && jobCtx.positionClass !== 'baker_food'
    && jobCtx.positionClass !== 'hospitality_service'
    && jobCtx.industryNorm !== 'hospitality'
  ) || (
    hasUnsupportedRegulatedPharmacyClaims(authoritativeSourceRaw)
    && !hasGenuineUserExperienceGrounding(exp)
  )
    ? ''
    : authoritativeSourceRaw;

  // Prefer domain-aware cross-locale shells over line-localizers that can
  // mis-map generic verbs into the wrong occupation domain.
  if (current && !experienceBulletsMatchRequestedLocale(current, requestedLocale, cv)) {
    const sourceLocale = detectTextLocale(authoritativeSource || current, {
      storedLocale: exp.generatedLocale || cv.contentLocale,
      generatedLocale: exp.generatedLocale,
    });
    if (isCrossLocaleOperation(sourceLocale, requestedLocale) || sourceLocale === 'unknown') {
      const translated = buildCrossLocaleExperienceFallback({
        sourceDescription: authoritativeSource || current,
        sourceLocale: sourceLocale === 'unknown' ? (exp.generatedLocale || null) : sourceLocale,
        targetLocale: requestedLocale,
        gender,
        isPresent: Boolean(exp.isPresent),
        position: exp.position || cv.personal?.jobTitle,
      });
      if (
        translated
        && experienceBulletsMatchRequestedLocale(translated, requestedLocale, cv)
      ) {
        return translated;
      }
    }
  }

  if (authoritativeSource) {
    const post = validateExperienceApplyMaterialPostcondition(authoritativeSource, current);
    if (!post.ok || !current) {
      const rebuilt = buildSourcePreservingExperienceBullets(
        authoritativeSource,
        requestedLocale,
        gender,
        { isPresent: Boolean(exp.isPresent) },
      );
      if (
        rebuilt
        && validateExperienceApplyMaterialPostcondition(authoritativeSource, rebuilt).ok
        && validateSourceFactIdentityCoverage(authoritativeSource, rebuilt).ok
      ) {
        // Accept source-preserving rebuild even when locale projection cannot
        // translate unknown occupations — never invent role stereotypes instead.
        return rebuilt;
      }
    }
  } else if (
    textLooksLikeCookingDuties(current)
    && jobCtx.positionClass !== 'baker_food'
    && jobCtx.positionClass !== 'hospitality_service'
    && jobCtx.industryNorm !== 'hospitality'
  ) {
    return buildOccupationAwareExperienceFallback({
      locale: requestedLocale,
      gender,
      position: exp.position,
      industry: jobCtx.industryNorm,
      isPresent: exp.isPresent,
    });
  }

  if (current && experienceBulletsMatchRequestedLocale(current, requestedLocale, cv)) {
    if (
      !authoritativeSource
      || validateExperienceApplyMaterialPostcondition(authoritativeSource, current).ok
    ) {
      return current;
    }
  }

  const keys = semanticDutyKeys(grounding);
  const hasCookingTriad = COOKING_TRIAD.every((k) => keys.includes(k));

  // Compact Hindi cooking triad: 2 display lines, 3 semantic meanings.
  if (requestedLocale === 'hi' && hasCookingTriad) {
    const isPresent = Boolean(exp.isPresent);
    const prep = localizeCanonicalBulletLine(
      'Prepare dishes according to restaurant standards.',
      'hi',
      gender,
      { isPresent },
    );
    const hygieneCollab = localizeCanonicalBulletLine(
      'Maintain workplace hygiene and collaborate with the kitchen team.',
      'hi',
      gender,
      { isPresent },
    );
    const compact = formatExperienceBullets(
      [prep, hygieneCollab].map((l) => l.replace(/^मैं\s+/u, '').trim()).filter(Boolean),
    );
    if (compact && experienceBulletsMatchRequestedLocale(compact, 'hi', cv)) {
      return compact;
    }
  }

  if (grounding.duties.length > 0) {
    const shells = internalShellsFromSemanticDuties(grounding.duties);
    const facts = splitExperienceBullets(shells).map((sourceText, i) => ({
      id: `export-duty-${exp.id}-${i}`,
      type: 'experience_bullet' as const,
      value: sourceText,
      sourceText,
      category: undefined,
      source: 'export_semantic' as const,
    }));
    const projected = deterministicLocalizedBulletsFromCanonical(
      facts,
      requestedLocale,
      gender,
      { isPresent: Boolean(exp.isPresent) },
    );
    if (projected && experienceBulletsMatchRequestedLocale(projected, requestedLocale, cv)) {
      return projected;
    }
  }

  // Last resort: localize each current visible line in place.
  if (current) {
    const localized = formatExperienceBullets(
      splitExperienceBullets(current)
        .map((line) => localizeCanonicalBulletLine(line, requestedLocale, gender, {
          isPresent: Boolean(exp.isPresent),
        }) || '')
        .filter(Boolean),
    );
    if (localized && experienceBulletsMatchRequestedLocale(localized, requestedLocale, cv)) {
      return localized;
    }
  }

  return current;
}

function buildSemanticSummaryFactSet(
  cv: CVData,
  groundingById: Map<string, ExperienceSemanticGrounding>,
): { factSet: CvCanonicalFactSet; source: ExportReadyDiagnostics['summaryFactSetSource']; keys: SemanticDutyKey[] } {
  const keys: SemanticDutyKey[] = [];
  const experience = (cv.experience || []).map((exp) => {
    const grounding = groundingById.get(exp.id) || { source: 'none' as const, duties: [] };
    keys.push(...semanticDutyKeys(grounding));
    const shells = internalShellsFromSemanticDuties(grounding.duties);
    return {
      ...exp,
      // Fact-set only: never write these shells into the returned export description.
      description: shells || exp.description,
    };
  });
  const factSet = buildCvCanonicalFactSet({
    ...cv,
    experience,
    summary: cv.canonicalSummary || (cv.summaryOrigin === 'user' ? cv.summary : ''),
  });
  const bulletCount = factSet.facts.filter((f) => f.type === 'experience_bullet').length;
  const source: ExportReadyDiagnostics['summaryFactSetSource'] = bulletCount > 0
    ? (keys.length > 0 ? 'semantic_duties' : 'modern_provenance')
    : 'none';
  return { factSet, source, keys: [...new Set(keys)] };
}

/**
 * Prepare one immutable export-ready CV for PDF and DOCX.
 * Must run before any template renderer branch.
 */
export function prepareExportReadyCv(
  rawCv: CVData,
  requestedLocale: Locale,
  templateId?: TemplateId | string,
  options?: {
    gender?: string;
    referenceDate?: Date | string;
    /** UI industry token used when Experience AI stamped generationJobContextKey. */
    industry?: string;
    /** UI level token used when Experience AI stamped generationJobContextKey. */
    level?: string;
  },
): PrepareExportReadyResult {
  const selectedTemplateId = templateId || rawCv.templateId;
  const gender = options?.gender || rawCv.personal?.gender || '';
  const exportIndustry = options?.industry;
  const exportLevel = options?.level;
  const jobContextForExport = (position?: string) => buildExperienceJobContext({
    position,
    locale: requestedLocale,
    industry: exportIndustry,
    level: exportLevel,
  });
  let stage: ExportReadyStage = 'normalize_runtime';

  const baseDiagnostics = (): ExportReadyDiagnostics => ({
    selectedTemplateId,
    requestedLocale,
    runtimeMigrationVersion: undefined,
    experienceCount: (rawCv.experience || []).length,
    recoveryInvoked: false,
    experienceProvenance: [],
    summaryFactSetSource: 'none',
    summarySemanticDutyKeys: [],
    stage,
  });

  let cv = normalizeLegacyCvRuntime(rawCv, requestedLocale);
  stage = 'normalize_region';
  cv = { ...cv, region: normalizeCvRegion(cv.region), templateId: selectedTemplateId as TemplateId };

  stage = 'resolve_provenance';
  const groundingById = new Map<string, ExperienceSemanticGrounding>();
  let recoveryInvoked = false;
  let changed = false;

  stage = 'recover_legacy_grounding';
  const summaryFactKeysBefore: string[] = [];
  let occupationGenericFallbackUsed = false;
  let unsupportedRoleSpecificClaimReason: string | undefined;
  let staleSummaryExcluded = false;

  const nextExperience: WorkExperience[] = (cv.experience || []).map((exp) => {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    let grounding = resolveExperienceSemanticGrounding(exp, {
      canonicalSnapshot: cv.canonicalSnapshot,
    });
    summaryFactKeysBefore.push(...semanticDutyKeys(grounding));
    const filteredDuties = filterSemanticDutiesForJobContext(grounding.duties, jobCtx);
    if (filteredDuties.length !== grounding.duties.length) {
      grounding = {
        ...grounding,
        duties: filteredDuties,
        source: filteredDuties.length > 0 ? grounding.source : 'none',
      };
    }
    groundingById.set(exp.id, grounding);
    recoveryInvoked = true;

    let description = exp.description;
    const cookingConflict = textLooksLikeCookingDuties(description || '')
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality';
    const userAllowsRegulated = hasGenuineUserExperienceGrounding(exp)
      && hasUnsupportedRegulatedPharmacyClaims(
        exp.originalUserDescription || exp.canonicalDescription || '',
      );
    const regulatedConflict = hasUnsupportedRegulatedPharmacyClaims(description || '')
      && !userAllowsRegulated
      && (jobCtx.positionClass === 'pharmacist_pharmacy' || jobCtx.industryNorm === 'pharmacy');

    if (cookingConflict || regulatedConflict) {
      description = buildOccupationAwareExperienceFallback({
        locale: requestedLocale,
        gender,
        position: exp.position,
        industry: jobCtx.industryNorm,
        isPresent: exp.isPresent,
      });
      occupationGenericFallbackUsed = true;
      if (cookingConflict) unsupportedRoleSpecificClaimReason = 'stale_cooking_duties_excluded';
      if (regulatedConflict) unsupportedRoleSpecificClaimReason = 'unsupported_regulated_pharmacy_claim';
      changed = true;
    }

    if (grounding.source === 'legacy_recovered_display_duties' && grounding.duties.length > 0) {
      const shells = internalShellsFromSemanticDuties(grounding.duties);
      const prevShells = (exp.originalUserDescription || '').trim();
      const needsWrite = !prevShells
        || exp.groundingRecoverySource !== LEGACY_RECOVERED_DISPLAY_DUTIES
        || splitExperienceBullets(prevShells).length < grounding.duties.length;
      if (needsWrite) {
        changed = true;
        return {
          ...exp,
          originalUserDescription: shells,
          canonicalDescription: shells,
          groundingRecoverySource: LEGACY_RECOVERED_DISPLAY_DUTIES,
          descriptionOrigin: exp.descriptionOrigin || 'ai_generated',
          description,
          recoveredSemanticDuties: grounding.duties,
        } as WorkExperience;
      }
      return {
        ...exp,
        description,
        recoveredSemanticDuties: grounding.duties,
      } as WorkExperience;
    }

    if (grounding.source === 'user_origin_recovered' && grounding.duties.length > 0) {
      return {
        ...exp,
        description,
        groundingRecoverySource: LEGACY_USER_ORIGIN_DUTIES,
        recoveredSemanticDuties: grounding.duties,
      } as WorkExperience;
    }

    return {
      ...exp,
      description,
      recoveredSemanticDuties: grounding.duties,
    } as WorkExperience;
  });

  cv = { ...cv, experience: nextExperience };
  void changed;

  stage = 'produce_semantic_duties';
  const failedUserOriginRecovery = [...groundingById.values()]
    .find((grounding) => Boolean(grounding.recoveryFailureReason));
  if (failedUserOriginRecovery?.recoveryFailureReason) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
    return fail(failedUserOriginRecovery.recoveryFailureReason, stage, diagnostics);
  }
  const hadDisplay = (rawCv.experience || []).some((exp) => Boolean(
    (exp.description || '').trim() || (exp.generatedDescription || '').trim(),
  ));
  const allKeys = [...groundingById.values()].flatMap((g) => semanticDutyKeys(g));
  const hasContextSafeEmptyDutyDisplay = (cv.experience || []).some((exp) => {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    const desc = (exp.description || '').trim();
    if (!desc) return false;
    if (
      textLooksLikeCookingDuties(desc)
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality'
    ) {
      return false;
    }
    if (
      hasUnsupportedRegulatedPharmacyClaims(desc)
      && !hasGenuineUserExperienceGrounding(exp)
    ) {
      return false;
    }
    const contextOk = Boolean(
      exp.generationJobContextKey
      && exp.generationJobContextKey === jobCtx.key,
    );
    const fallbackOrigin = exp.descriptionOrigin === 'deterministic_fallback';
    if (!contextOk && !fallbackOrigin && !occupationGenericFallbackUsed) return false;
    return experienceBulletsMatchRequestedLocale(desc, requestedLocale, cv);
  });
  const hasMaterialSourceFacts = (cv.experience || []).some((exp) => {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    const source = (exp.originalUserDescription || exp.canonicalDescription || '').trim();
    if (!source) return false;
    // Cooking material under a non-food role is not a safe export grounding source.
    if (
      textLooksLikeCookingDuties(source)
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality'
    ) {
      return false;
    }
    return materialDutyKeysFromDescription(source).some((k) => k !== 'generic_duty');
  });
  if (
    hadDisplay
    && allKeys.length === 0
    && !occupationGenericFallbackUsed
    && !hasContextSafeEmptyDutyDisplay
    && !hasMaterialSourceFacts
  ) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
    return fail('legacy_export_recovery_no_safe_duties', stage, diagnostics);
  }

  stage = 'produce_localized_display';
  // Exact recovered manual clauses may be projected cross-locale only from a
  // validated persisted surface whose immutable binding still matches.
  const unboundCrossLocaleUserOrigin = (cv.experience || []).find((exp) => {
    const grounding = groundingById.get(exp.id);
    if (!grounding || !recoveredUserOriginNeedsSourceBoundLocalization(
      grounding,
      requestedLocale,
    )) return false;
    return projectExperienceFromLocalizedSurfaces({
      cv,
      exp,
      grounding,
      targetLocale: requestedLocale,
    }) === null;
  });
  if (unboundCrossLocaleUserOrigin) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summarySemanticDutyKeys = [...new Set(allKeys)];
    return fail(
      'experience_localization_source_binding_missing',
      stage,
      diagnostics,
    );
  }
  // Fail closed on impure AI-managed units before any export rewrite/projection.
  {
    const preIntegrity = auditCvExportIntegrity(cv, requestedLocale, {
      requireSummaryDuration: false,
    });
    const hardEntries = preIntegrity.entries.filter((e) =>
      !e.ok
      && (
        e.mixedLanguageBulletCount > 0
        || e.crossDomainLeakageDetected
        || e.crossEntryLeakageDetected
      ));
    // Do not hard-fail Summary impurity here — Summary recovery may rebuild it.
    if (hardEntries.length) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.exportIntegrityOk = false;
      diagnostics.exportIntegrityReasons = preIntegrity.reasons;
      diagnostics.exportIntegrityMarker = preIntegrity.marker;
      return fail(
        hardEntries[0]?.reasons[0]
          || preIntegrity.reasons[0]
          || 'export_integrity_failed',
        'validate_locale_integrity',
        diagnostics,
      );
    }
  }
  cv = {
    ...cv,
    experience: (cv.experience || []).map((exp) => {
      const grounding = groundingById.get(exp.id) || { source: 'none' as const, duties: [] };
      const projected = projectExperienceDisplayFromSemanticDuties(
        exp,
        grounding,
        requestedLocale,
        gender,
        cv,
        { industry: exportIndustry, level: exportLevel },
      );
      return { ...exp, description: projected };
    }),
  };

  // Hard postcondition: never report projection ok with English/mixed bullets.
  for (const exp of cv.experience || []) {
    const grounding = groundingById.get(exp.id);
    if (!grounding || grounding.duties.length === 0) continue;
    if (!experienceBulletsMatchRequestedLocale(exp.description || '', requestedLocale, cv)) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summarySemanticDutyKeys = [...new Set(allKeys)];
      return fail('localized_display_projection_incomplete', stage, diagnostics);
    }
  }

  const preservedDescriptions = new Map(
    (cv.experience || []).map((exp) => [exp.id, exp.description]),
  );

  stage = 'construct_summary_fact_set';
  const { factSet, source: factSourceRaw, keys: summaryKeys } = buildSemanticSummaryFactSet(cv, groundingById);
  let factSource: ExportReadyDiagnostics['summaryFactSetSource'] = summaryKeys.length === 0 && (
    occupationGenericFallbackUsed || hasContextSafeEmptyDutyDisplay
  )
    ? 'occupation_generic'
    : factSourceRaw;
  if (
    hadDisplay
    && summaryKeys.length === 0
    && !occupationGenericFallbackUsed
    && !hasContextSafeEmptyDutyDisplay
    && !hasMaterialSourceFacts
  ) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
    return fail('summary_fact_set_missing_recovered_duties', stage, diagnostics);
  }

  const durationSnapshot = buildExperienceDurationSnapshot(
    cv.experience || [],
    options?.referenceDate ?? new Date(),
  );

  const primaryExp = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const primaryJobCtx = jobContextForExport(primaryExp?.position || cv.personal?.jobTitle);
  const summaryContextMatch = Boolean(
    cv.summaryGenerationContextKey
    && cv.summaryGenerationContextKey === primaryJobCtx.key,
  );
  const summaryStale = isSummaryStaleForJobContext(cv.summary || '', primaryJobCtx, {
    summaryOrigin: cv.summaryOrigin,
    summaryGenerationContextKey: cv.summaryGenerationContextKey,
  }) || (
    textLooksLikeCookingDuties(cv.summary || '')
    && primaryJobCtx.positionClass !== 'baker_food'
    && primaryJobCtx.positionClass !== 'hospitality_service'
  );

  stage = 'validate_summary';
  const experienceBlobForSummary = (cv.experience || [])
    .map((e) => `${e.position || ''}\n${e.description || ''}`)
    .join('\n');
  if (summaryHasUnsupportedDomainClaims(cv.summary || '', experienceBlobForSummary)) {
    return fail(
      'summary_unsupported_domain_claims',
      stage,
      {
        ...baseDiagnostics(),
        summaryFactKeysBefore: [...new Set(summaryFactKeysBefore)],
      },
    );
  }
  let initialSummaryValidation = validateSummaryExportCandidate(
    cv.summary || '',
    factSet,
    requestedLocale,
    gender,
    (cv.canonicalSummary || '').trim(),
    cv.canonicalSnapshot?.canonicalLocale,
    cv,
    durationSnapshot.total,
  );
  if (summaryStale) {
    staleSummaryExcluded = true;
    initialSummaryValidation = {
      valid: false,
      reason: 'stale_summary_job_context',
      violations: ['stale_summary_job_context'],
    };
  }

  let summaryRecoverySource: ExportReadyDiagnostics['summaryRecoverySource'] = 'saved_summary';
  let summaryRecoveryReason: string | undefined;
  let durationCompositionSource = 'saved_summary';

  const rebuildOccupationSummary = (): string => {
    const durationPhrase = formatApproximateDurationPhrase(durationSnapshot.total, requestedLocale);
    durationCompositionSource = 'occupation_aware_summary_fallback';
    return scrubOrphanDurationFragments(
      buildOccupationAwareSummaryFallback({
        locale: requestedLocale,
        gender,
        position: primaryExp?.position || cv.personal?.jobTitle,
        industry: primaryJobCtx.industryNorm,
        company: primaryExp?.company,
        startDate: primaryExp?.startDate,
        durationPhrase,
        isPresent: primaryExp?.isPresent,
      }),
    );
  };

  if (!initialSummaryValidation.valid) {
    stage = 'recover_summary';
    let recovered = '';
    const bulletCount = factSet.facts.filter((f) => f.type === 'experience_bullet').length;
    // Universal: recover from authoritative Experience bullets even when no
    // catalogue SemanticDutyKey matched (unknown free-text titles).
    if (!summaryStale && (summaryKeys.length > 0 || bulletCount > 0)) {
      recovered = deterministicLocalizedSummaryFromCanonical(
        factSet,
        requestedLocale,
        gender,
        durationSnapshot.total,
      );
      summaryRecoverySource = 'deterministic_semantic_facts';
      durationCompositionSource = 'deterministic_semantic_facts';
    }
    const recoveredLooksCooking = textLooksLikeCookingDuties(recovered);
    const cookingOccupationMismatch = recoveredLooksCooking
      && primaryJobCtx.positionClass !== 'baker_food'
      && primaryJobCtx.positionClass !== 'hospitality_service'
      && primaryJobCtx.industryNorm !== 'hospitality';
    // Occupation-generic only when there are no source duty bullets to preserve,
    // or when cooking shells leaked into a non-food role / stale context.
    if (
      summaryStale
      || cookingOccupationMismatch
      || (!recovered.trim() && bulletCount === 0)
      || (!recovered.trim() && summaryKeys.length === 0 && bulletCount === 0)
    ) {
      recovered = rebuildOccupationSummary();
      summaryRecoverySource = 'occupation_generic_fallback';
      occupationGenericFallbackUsed = true;
      factSource = 'occupation_generic';
    } else if (!recovered.trim() && bulletCount > 0) {
      // Last resort: still try grounded builder once more (should be rare).
      recovered = deterministicLocalizedSummaryFromCanonical(
        factSet,
        requestedLocale,
        gender,
        durationSnapshot.total,
      );
      summaryRecoverySource = 'deterministic_semantic_facts';
      durationCompositionSource = 'deterministic_semantic_facts';
      if (!recovered.trim()) {
        recovered = rebuildOccupationSummary();
        summaryRecoverySource = 'occupation_generic_fallback';
        occupationGenericFallbackUsed = true;
        factSource = 'occupation_generic';
      }
    }
    const recoveryValidation = validateSummaryExportCandidate(
      recovered,
      // Occupation-generic summaries ground on role/duration, not cooking shells.
      summaryRecoverySource === 'occupation_generic_fallback'
        ? buildCvCanonicalFactSet({
          ...cv,
          experience: (cv.experience || []).map((e) => ({
            ...e,
            description: e.description,
            originalUserDescription: undefined,
            canonicalDescription: undefined,
          })),
          summary: '',
          canonicalSummary: '',
        })
        : factSet,
      requestedLocale,
      gender,
      (cv.canonicalSummary || '').trim(),
      cv.canonicalSnapshot?.canonicalLocale,
      cv,
      durationSnapshot.total,
    );
    if (summaryHasUnsupportedDomainClaims(recovered, experienceBlobForSummary)) {
      return fail(
        'summary_unsupported_domain_claims',
        stage,
        {
          ...baseDiagnostics(),
          summaryRecoverySource,
          summaryRecoveryReason: 'recovered_summary_unsupported_domain_claims',
        },
      );
    }
    summaryRecoveryReason = recoveryValidation.reason;
    // Occupation-generic rebuild is authoritative after context change even when
    // semantic validator is strict about missing duty shells.
    const acceptOccupationGeneric = summaryRecoverySource === 'occupation_generic_fallback'
      && Boolean(recovered.trim())
      && !textLooksLikeCookingDuties(recovered)
      && textMatchesRequestedFieldLocale(recovered, requestedLocale, 'summary', structuredExemptions(cv));
    if ((recovered && recoveryValidation.valid) || acceptOccupationGeneric) {
      cv = {
        ...cv,
        summary: recovered,
        summaryOrigin: 'deterministic_fallback',
        contentLocale: requestedLocale,
        summaryGeneratedLocale: requestedLocale,
        summaryGenerationContextKey: primaryJobCtx.key,
        // Do not keep a cooking canonical Summary as authoritative after occupation change.
        canonicalSummary: textLooksLikeCookingDuties(cv.canonicalSummary || '')
          ? undefined
          : cv.canonicalSummary,
      };
    } else {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      diagnostics.summaryInitialValid = false;
      diagnostics.summaryInitialReason = initialSummaryValidation.reason;
      diagnostics.summaryRecoverySource = summaryRecoverySource;
      diagnostics.summaryRecoveryReason = summaryRecoveryReason;
      diagnostics.staleSummaryExcluded = staleSummaryExcluded;
      diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
      diagnostics.summaryFactKeysUsed = summaryKeys;
      return fail('summary_validation_failed_after_recovery', stage, diagnostics);
    }
  } else {
    cv = {
      ...cv,
      contentLocale: requestedLocale,
      summaryGeneratedLocale: requestedLocale,
      summaryGenerationContextKey: cv.summaryGenerationContextKey || primaryJobCtx.key,
    };
  }

  const quality = applyCvContentQuality(cv, requestedLocale, {
    gender,
    durationSnapshot,
    referenceDate: options?.referenceDate || durationSnapshot.referenceDateIso,
    summaryOrigin: cv.summaryOrigin,
  });
  cv = {
    ...quality.cv,
    summary: scrubOrphanDurationFragments(quality.cv.summary || ''),
  };

  // Enforce: quality must not restore English padding over projected display.
  cv = {
    ...cv,
    experience: (cv.experience || []).map((exp) => {
      const preserved = preservedDescriptions.get(exp.id);
      const grounding = groundingById.get(exp.id);
      if (
        grounding?.source === 'legacy_recovered_display_duties'
        && preserved
        && /[A-Za-z]{4,}/.test(exp.description || '')
        && !/[A-Za-z]{4,}/.test(preserved)
      ) {
        return { ...exp, description: preserved };
      }
      if (grounding?.source === 'legacy_recovered_display_duties' && preserved) {
        return { ...exp, description: preserved };
      }
      if (
        preserved
        && experienceBulletsMatchRequestedLocale(preserved, requestedLocale, cv)
      ) {
        return { ...exp, description: preserved };
      }
      return exp;
    }),
    contentLocale: requestedLocale,
    summaryGeneratedLocale: requestedLocale,
  };

  // Guard against stale overwrite of semantic grounding.
  for (const exp of cv.experience || []) {
    const grounding = groundingById.get(exp.id);
    if (
      grounding?.source === 'legacy_recovered_display_duties'
      && grounding.duties.length > 0
      && !(exp.originalUserDescription || '').trim()
    ) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      return fail('legacy_export_recovery_snapshot_overwritten', 'produce_semantic_duties', diagnostics);
    }
  }

  stage = 'validate_locale_integrity';
  for (const exp of cv.experience || []) {
    const grounding = groundingById.get(exp.id);
    if (!grounding || grounding.duties.length === 0) {
      // Occupation-generic Experience still must match requested locale.
      if (
        (exp.description || '').trim()
        && !experienceBulletsMatchRequestedLocale(exp.description || '', requestedLocale, cv)
      ) {
        const diagnostics = baseDiagnostics();
        diagnostics.recoveryInvoked = recoveryInvoked;
        diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
        diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
        return fail('localized_display_projection_incomplete', 'produce_localized_display', diagnostics);
      }
      continue;
    }
    if (!experienceBulletsMatchRequestedLocale(exp.description || '', requestedLocale, cv)) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      diagnostics.summaryInitialValid = initialSummaryValidation.valid;
      diagnostics.summaryInitialReason = initialSummaryValidation.reason;
      diagnostics.summaryRecoverySource = summaryRecoverySource;
      diagnostics.summaryRecoveryReason = summaryRecoveryReason;
      return fail('localized_display_projection_incomplete', 'produce_localized_display', diagnostics);
    }
  }

  const localeCheck = validateFinalLocalizedCvFields(cv, requestedLocale);
  if (!localeCheck.valid) {
    const first = localeCheck.violations[0];
    if (first.path.includes('experience') && first.kind === 'mixed_locale_field') {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      diagnostics.summaryInitialValid = initialSummaryValidation.valid;
      diagnostics.summaryInitialReason = initialSummaryValidation.reason;
      diagnostics.summaryRecoverySource = summaryRecoverySource;
      diagnostics.summaryRecoveryReason = summaryRecoveryReason;
      return fail('localized_display_projection_incomplete', 'produce_localized_display', diagnostics);
    }
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactSetSource = factSource;
    diagnostics.summarySemanticDutyKeys = summaryKeys;
    diagnostics.summaryInitialValid = initialSummaryValidation.valid;
    diagnostics.summaryInitialReason = initialSummaryValidation.reason;
    diagnostics.summaryRecoverySource = summaryRecoverySource;
    diagnostics.summaryRecoveryReason = summaryRecoveryReason;
    return fail(
      `summary_export_contract_mismatch: ${first.kind}: ${first.path}`,
      stage,
      diagnostics,
    );
  }

  if (!recoveryInvoked) {
    return fail('legacy_export_recovery_not_invoked', 'recover_legacy_grounding', baseDiagnostics());
  }

  // Summary↔Experience parity: material facts present in Summary grounding must
  // still survive in finalized Experience (Summary must not be the only copy).
  for (const exp of cv.experience || []) {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    const source = (exp.originalUserDescription || exp.canonicalDescription || '').trim();
    if (!source) continue;
    if (
      textLooksLikeCookingDuties(source)
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality'
    ) {
      continue;
    }
    // Material-key overlap is same-locale. After a partial locale switch, source
    // facts may still be Serbian while the display is English (or vice versa).
    const sourceLocale = detectTextLocale(source, {
      storedLocale: exp.generatedLocale || cv.contentLocale,
      generatedLocale: exp.generatedLocale,
    });
    const displayLocale = detectTextLocale(exp.description || '', {
      storedLocale: exp.generatedLocale || requestedLocale,
      generatedLocale: exp.generatedLocale,
    });
    if (
      isCrossLocaleOperation(sourceLocale, displayLocale)
      || isCrossLocaleOperation(sourceLocale, requestedLocale)
    ) {
      continue;
    }
    const required = materialDutyKeysFromDescription(source).filter((k) => k !== 'generic_duty');
    if (!required.length) continue;
    const coverage = validateMaterialDutyCoverage(source, exp.description || '');
    if (!coverage.valid) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      return fail(
        'experience_material_fact_coverage_incomplete',
        'validate_locale_integrity',
        diagnostics,
      );
    }
  }

  stage = 'complete';
  const summaryDiag = buildSummaryCompositionDiagnostics(factSet, cv.summary || '', {
    fallbackReason: summaryRecoverySource === 'saved_summary'
      ? undefined
      : (summaryRecoverySource || summaryRecoveryReason),
  });
  const diagnostics: ExportReadyDiagnostics = {
    selectedTemplateId,
    requestedLocale,
    runtimeMigrationVersion: cv.runtimeMigrationVersion,
    experienceCount: (cv.experience || []).length,
    recoveryInvoked: true,
    experienceProvenance: buildProvenanceRows(cv, groundingById),
    summaryFactSetSource: factSource,
    summarySemanticDutyKeys: summaryKeys,
    summaryInitialValid: initialSummaryValidation.valid,
    summaryInitialReason: initialSummaryValidation.reason,
    summaryRecoverySource,
    summaryRecoveryReason,
    experienceGenerationContextKey: primaryExp?.generationJobContextKey,
    summaryGenerationContextKey: cv.summaryGenerationContextKey || primaryJobCtx.key,
    summaryContextMatch: Boolean(
      (cv.summaryGenerationContextKey || primaryJobCtx.key) === primaryJobCtx.key,
    ) && !staleSummaryExcluded,
    staleSummaryExcluded,
    summaryFactKeysBefore: [...new Set(summaryFactKeysBefore)],
    summaryFactKeysUsed: summaryKeys,
    occupationGenericFallbackUsed,
    unsupportedRoleSpecificClaimReason,
    durationCompositionSource,
    ...summaryDiag,
    stage,
  };
  void summaryContextMatch;

  // Non-mutating integrity audit — never rewrite; fail closed on mixed/cross-domain AI units.
  const integrity = auditCvExportIntegrity(cv, requestedLocale, {
    requireSummaryDuration: Boolean(cv.summaryOrigin && cv.summaryOrigin !== 'user'),
  });
  diagnostics.exportIntegrityOk = integrity.ok;
  diagnostics.exportIntegrityReasons = integrity.reasons;
  diagnostics.exportIntegrityMarker = integrity.marker;
  const hardEntries = integrity.entries.filter((e) =>
    !e.ok
    && (
      e.mixedLanguageBulletCount > 0
      || e.crossDomainLeakageDetected
      || e.crossEntryLeakageDetected
    ));
  const hardSummary = (!integrity.summaryOk && (
    integrity.reasons.includes('summary_locale_impurity')
    || integrity.reasons.includes('summary_duration_count')
  ));
  if (hardEntries.length || hardSummary) {
    return fail(
      hardEntries[0]?.reasons[0]
        || integrity.reasons[0]
        || 'export_integrity_failed',
      'validate_locale_integrity',
      diagnostics,
    );
  }

  return { ok: true, cv, diagnostics };
}

function buildProvenanceRows(
  cv: CVData,
  groundingById: Map<string, ExperienceSemanticGrounding>,
): ExportReadyDiagnostics['experienceProvenance'] {
  return (cv.experience || []).map((exp) => {
    const grounding = groundingById.get(exp.id) || { source: 'none' as const, duties: [] };
    const visible = displayTextForSemanticRecovery(exp);
    return {
      id: exp.id,
      hasOriginalUserDescription: Boolean((exp.originalUserDescription || '').trim()),
      hasCanonicalDescription: Boolean((exp.canonicalDescription || '').trim()),
      hasCanonicalSnapshot: Boolean(cv.canonicalSnapshot),
      hasGeneratedDescription: Boolean((exp.generatedDescription || '').trim()),
      descriptionOrigin: exp.descriptionOrigin,
      generatedLocale: exp.generatedLocale,
      groundingRecoverySource: exp.groundingRecoverySource,
      source: grounding.source,
      semanticDutyKeys: semanticDutyKeys(grounding),
      visibleBulletCount: splitExperienceBullets(visible).length,
      groundingBulletCount: grounding.duties.length,
      exportBulletCount: splitExperienceBullets(exp.description || '').length,
    };
  });
}

/** Throw CvExportFailure when prepareExportReadyCv fails (page/export boundary). */
export function unwrapExportReadyCv(result: PrepareExportReadyResult): CVData {
  if (result.ok) return result.cv;
  throw new CvExportFailure(result.reason, `${result.reason} @ ${result.stage}`);
}

/**
 * Back-compat wrapper used by existing call sites/tests.
 * Prefer prepareExportReadyCv for new code.
 */
export function prepareLegacyRecoveredFinalLocaleSafeCv(
  sourceCv: CVData,
  locale: Locale,
  options?: {
    gender?: string;
    referenceDate?: Date | string;
    industry?: string;
    level?: string;
  },
): {
  cv: CVData;
  diagnostics: {
    recoveryInvoked: boolean;
    experienceSourcesBefore: string[];
    experienceSourcesAfter: string[];
    recoveredDutyKeys: string[];
    summaryInitialReason?: string;
    summaryRecoverySource?: 'saved_summary' | 'deterministic_authoritative_facts';
    summaryRecoveryReason?: string;
  };
} {
  const result = prepareExportReadyCv(sourceCv, locale, sourceCv.templateId, options);
  if (!result.ok) {
    throw new CvExportFailure(result.reason, `${result.reason} @ ${result.stage}`);
  }
  return {
    cv: result.cv,
    diagnostics: {
      recoveryInvoked: result.diagnostics.recoveryInvoked,
      experienceSourcesBefore: result.diagnostics.experienceProvenance.map((p) =>
        (p.hasOriginalUserDescription ? (p.groundingRecoverySource || 'originalUserDescription') : 'none')),
      experienceSourcesAfter: result.diagnostics.experienceProvenance.map((p) => p.source),
      recoveredDutyKeys: result.diagnostics.summarySemanticDutyKeys,
      summaryInitialReason: result.diagnostics.summaryInitialReason,
      summaryRecoverySource: result.diagnostics.summaryRecoverySource === 'deterministic_semantic_facts'
        || result.diagnostics.summaryRecoverySource === 'occupation_generic_fallback'
        ? 'deterministic_authoritative_facts'
        : result.diagnostics.summaryRecoverySource === 'saved_summary'
          ? 'saved_summary'
          : undefined,
      summaryRecoveryReason: result.diagnostics.summaryRecoveryReason,
    },
  };
}
