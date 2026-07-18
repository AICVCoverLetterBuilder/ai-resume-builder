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
} from './cv-localized-fallback';
import { buildExperienceDurationSnapshot } from './cv-experience-duration';
import { applyCvContentQuality } from './cv-content-quality';
import {
  textMatchesRequestedFieldLocale,
  validateFinalLocalizedCvFields,
} from './cv-field-locale-integrity';
import { CvExportFailure } from './cv-export-error-message';
import { LEGACY_RECOVERED_DISPLAY_DUTIES } from './cv-legacy-grounding-recovery';
import {
  displayTextForSemanticRecovery,
  internalShellsFromSemanticDuties,
  resolveExperienceSemanticGrounding,
  semanticDutyKeys,
  type ExperienceSemanticGrounding,
  type SemanticDutyKey,
} from './cv-semantic-duty-facts';
import { splitExperienceBullets } from './cv-canonical-facts';

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
  summaryFactSetSource: 'semantic_duties' | 'modern_provenance' | 'none';
  summarySemanticDutyKeys: SemanticDutyKey[];
  summaryInitialValid?: boolean;
  summaryInitialReason?: string;
  summaryRecoverySource?: 'saved_summary' | 'deterministic_semantic_facts';
  summaryRecoveryReason?: string;
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
): string {
  const current = (exp.description || '').trim();
  if (current && experienceBulletsMatchRequestedLocale(current, requestedLocale, cv)) {
    return current;
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
  options?: { gender?: string; referenceDate?: Date | string },
): PrepareExportReadyResult {
  const selectedTemplateId = templateId || rawCv.templateId;
  const gender = options?.gender || rawCv.personal?.gender || '';
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
  const nextExperience: WorkExperience[] = (cv.experience || []).map((exp) => {
    const grounding = resolveExperienceSemanticGrounding(exp);
    groundingById.set(exp.id, grounding);
    recoveryInvoked = true;

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
          // Internal grounding only — keep visible Hindi display unchanged.
          originalUserDescription: shells,
          canonicalDescription: shells,
          groundingRecoverySource: LEGACY_RECOVERED_DISPLAY_DUTIES,
          descriptionOrigin: exp.descriptionOrigin || 'ai_generated',
          description: exp.description,
          recoveredSemanticDuties: grounding.duties,
        } as WorkExperience;
      }
      return {
        ...exp,
        recoveredSemanticDuties: grounding.duties,
      } as WorkExperience;
    }

    if (grounding.source === 'modern_provenance') {
      return {
        ...exp,
        recoveredSemanticDuties: grounding.duties,
      } as WorkExperience;
    }

    return {
      ...exp,
      recoveredSemanticDuties: grounding.duties,
    } as WorkExperience;
  });

  cv = { ...cv, experience: nextExperience };
  void changed;

  stage = 'produce_semantic_duties';
  const hadDisplay = (rawCv.experience || []).some((exp) => Boolean(
    (exp.description || '').trim() || (exp.generatedDescription || '').trim(),
  ));
  const allKeys = [...groundingById.values()].flatMap((g) => semanticDutyKeys(g));
  if (hadDisplay && allKeys.length === 0) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    return fail('legacy_export_recovery_no_safe_duties', stage, diagnostics);
  }

  stage = 'produce_localized_display';
  // requestedLocale is authoritative for the final exported display projection.
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
  const { factSet, source: factSource, keys: summaryKeys } = buildSemanticSummaryFactSet(cv, groundingById);
  if (hadDisplay && summaryKeys.length === 0) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    return fail('summary_fact_set_missing_recovered_duties', stage, diagnostics);
  }

  const durationSnapshot = buildExperienceDurationSnapshot(
    cv.experience || [],
    options?.referenceDate ?? new Date(),
  );

  stage = 'validate_summary';
  const initialSummaryValidation = validateSummaryExportCandidate(
    cv.summary || '',
    factSet,
    requestedLocale,
    gender,
    (cv.canonicalSummary || '').trim(),
    cv.canonicalSnapshot?.canonicalLocale,
    cv,
  );

  let summaryRecoverySource: ExportReadyDiagnostics['summaryRecoverySource'] = 'saved_summary';
  let summaryRecoveryReason: string | undefined;

  if (!initialSummaryValidation.valid) {
    stage = 'recover_summary';
    const recovered = deterministicLocalizedSummaryFromCanonical(
      factSet,
      requestedLocale,
      gender,
      durationSnapshot.total,
    );
    summaryRecoverySource = 'deterministic_semantic_facts';
    const recoveryValidation = validateSummaryExportCandidate(
      recovered,
      factSet,
      requestedLocale,
      gender,
      (cv.canonicalSummary || '').trim(),
      cv.canonicalSnapshot?.canonicalLocale,
      cv,
    );
    summaryRecoveryReason = recoveryValidation.reason;
    if (recovered && recoveryValidation.valid) {
      cv = {
        ...cv,
        summary: recovered,
        summaryOrigin: 'deterministic_fallback',
        contentLocale: requestedLocale,
        summaryGeneratedLocale: requestedLocale,
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
      return fail('summary_validation_failed_after_recovery', stage, diagnostics);
    }
  } else {
    // Valid text with possibly stale metadata — normalize export-snapshot locales.
    cv = {
      ...cv,
      contentLocale: requestedLocale,
      summaryGeneratedLocale: requestedLocale,
    };
  }

  const quality = applyCvContentQuality(cv, requestedLocale, {
    gender,
    durationSnapshot,
    referenceDate: options?.referenceDate || durationSnapshot.referenceDateIso,
    summaryOrigin: cv.summaryOrigin,
  });
  cv = quality.cv;

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
      // Modern provenance / semantic projection: never let quality reintroduce English.
      if (
        preserved
        && experienceBulletsMatchRequestedLocale(preserved, requestedLocale, cv)
      ) {
        return { ...exp, description: preserved };
      }
      return exp;
    }),
    // Quality must not reintroduce stale Summary locale metadata.
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
  // Re-check Experience projection after quality.
  for (const exp of cv.experience || []) {
    const grounding = groundingById.get(exp.id);
    if (!grounding || grounding.duties.length === 0) continue;
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
    // English padding in Hindi experience is a projection wiring bug, not content grounding.
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

  stage = 'complete';
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
    stage,
  };

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
  options?: { gender?: string; referenceDate?: Date | string },
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
        ? 'deterministic_authoritative_facts'
        : result.diagnostics.summaryRecoverySource,
      summaryRecoveryReason: result.diagnostics.summaryRecoveryReason,
    },
  };
}
