/**
 * AAB-322 — Shared Summary structured-role localization + entity-span locale checks.
 *
 * Current and prior roles use the same resolver. Raw foreign role labels must not
 * leak into a different target Summary locale.
 */
import type { Locale } from './i18n/translations';
import {
  foldLatinDiacritics,
  localizeGraphicDesigner,
  localizeOccupationalTitleForProjection,
  localizeWarehouseEmployee,
  matchesGraphicDesignerOccupationalTitle,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';

export const GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION =
  'german-summary-structured-role-localization-322-v1' as const;
export const SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION =
  'summary-shared-role-localization-322-v1' as const;
export const SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION =
  'summary-structured-entity-locale-validation-322-v1' as const;
export const SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION =
  'summary-visible-role-locale-verification-322-v1' as const;

void GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION;
void SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION;
void SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION;
void SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION;

function hashOpaque(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeGender(gender?: string): 'female' | 'male' | 'unspecified' {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f' || g === 'weiblich') return 'female';
  if (g === 'male' || g === 'm' || g === 'männlich') return 'male';
  return 'unspecified';
}

/** Heuristic source-locale cue for role labels (not full MT). */
export function detectRoleLabelSourceLocale(role: string): string | null {
  const t = (role || '').trim();
  if (!t) return null;
  if (/[\u0900-\u097F]/.test(t)) return 'hi';
  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  if (/[\u3040-\u30FF\u3400-\u9FFF]/.test(t)) return 'ja';
  if (/[\u0400-\u04FF]/.test(t)) return 'ru';
  const folded = foldLatinDiacritics(t);
  if (/\b(?:diseñador|disenador|gráfic|grafic|emplead[oa]|almac[eé]n)\b/iu.test(t)
    || /ñ/.test(t)) {
    return 'es';
  }
  if (/\b(?:grafikdesigner(?:in)?|lagermitarbeiter(?:in)?|fachkraft)\b/iu.test(folded)) {
    return 'de';
  }
  if (/\b(?:graphic\s*designer|warehouse\s*employee|baker|cook)\b/iu.test(folded)) {
    return 'en';
  }
  if (/\b(?:dizajner(?:ka)?|radnik|skladistar)\b/iu.test(folded)) return 'hr';
  return null;
}

function looksLikeTargetLocaleRole(role: string, targetLocale: Locale): boolean {
  const detected = detectRoleLabelSourceLocale(role);
  if (!detected) {
    // ASCII free-text may be English; treat as target-compatible only for `en`.
    if (targetLocale === 'en' && /^[A-Za-z0-9\s/&'’.-]+$/u.test(role)) return true;
    if (targetLocale === 'de' && /\b(?:in|er|erin|kraft)\b/iu.test(role)
      && !/[ñáéíóúü]/iu.test(role)) {
      return /^[\p{L}\p{M}\s/&'’.-]+$/u.test(role);
    }
    return false;
  }
  return detected === targetLocale;
}

function resolveCanonicalOccupationId(role: string): string | null {
  if (matchesGraphicDesignerOccupationalTitle(role)) return 'graphic_designer';
  if (matchesWarehouseOccupationalTitle(role)) return 'warehouse_employee';
  return null;
}

export type LocalizedSummaryRoleResult = {
  canonicalRoleIdentity: string | null;
  canonicalRoleIdentityHash: string | null;
  sourceRoleLabelHash: string;
  sourceRoleLocale: string | null;
  requestedTargetLocale: Locale;
  localizedTargetRoleLabel: string;
  localizedTargetRoleLabelHash: string;
  grammaticalGender: 'female' | 'male' | 'unspecified';
  sourceEntryIdHash: string | null;
  localizationSource:
    | 'canonical_occupation_dictionary'
    | 'validated_localized_mapping'
    | 'deterministic_locale_morphology'
    | 'target_locale_already'
    | 'free_text_rejected'
    | 'empty';
  localizationConfidence: 'high' | 'medium' | 'low' | 'none';
  localizationValidationPassed: boolean;
  rejectionReasons: string[];
};

/**
 * Shared current/prior Summary role localization.
 * Never returns a raw foreign label as the accepted target when localization fails.
 */
export function resolveLocalizedSummaryRole(options: {
  role: string;
  sourceLocale?: string | null;
  targetLocale: Locale;
  gender?: string;
  entryId?: string | null;
  canonicalRoleId?: string | null;
}): LocalizedSummaryRoleResult {
  void SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION;
  void GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION;
  const sourceRole = (options.role || '').replace(/\s+/g, ' ').trim();
  const targetLocale = options.targetLocale;
  const gender = normalizeGender(options.gender);
  const sourceLocale = (options.sourceLocale || detectRoleLabelSourceLocale(sourceRole) || null);
  const entryIdHash = options.entryId ? hashOpaque(options.entryId) : null;
  const emptyBase = {
    canonicalRoleIdentity: null as string | null,
    canonicalRoleIdentityHash: null as string | null,
    sourceRoleLabelHash: hashOpaque(sourceRole || 'empty'),
    sourceRoleLocale: sourceLocale,
    requestedTargetLocale: targetLocale,
    localizedTargetRoleLabel: '',
    localizedTargetRoleLabelHash: hashOpaque(''),
    grammaticalGender: gender,
    sourceEntryIdHash: entryIdHash,
    localizationSource: 'empty' as const,
    localizationConfidence: 'none' as const,
    localizationValidationPassed: false,
    rejectionReasons: ['empty_role'] as string[],
  };
  if (!sourceRole) return emptyBase;

  const canonicalId = options.canonicalRoleId || resolveCanonicalOccupationId(sourceRole);
  const canonicalHash = canonicalId ? hashOpaque(canonicalId) : null;

  // Known occupations — dictionary / morphology.
  if (canonicalId === 'graphic_designer') {
    const localized = localizeGraphicDesigner(targetLocale, options.gender);
    return {
      ...emptyBase,
      canonicalRoleIdentity: canonicalId,
      canonicalRoleIdentityHash: canonicalHash,
      localizedTargetRoleLabel: localized,
      localizedTargetRoleLabelHash: hashOpaque(localized),
      localizationSource: 'canonical_occupation_dictionary',
      localizationConfidence: 'high',
      localizationValidationPassed: true,
      rejectionReasons: [],
    };
  }
  if (canonicalId === 'warehouse_employee') {
    const localized = localizeWarehouseEmployee(targetLocale, options.gender);
    return {
      ...emptyBase,
      canonicalRoleIdentity: canonicalId,
      canonicalRoleIdentityHash: canonicalHash,
      localizedTargetRoleLabel: localized,
      localizedTargetRoleLabelHash: hashOpaque(localized),
      localizationSource: 'canonical_occupation_dictionary',
      localizationConfidence: 'high',
      localizationValidationPassed: true,
      rejectionReasons: [],
    };
  }

  const projected = localizeOccupationalTitleForProjection(
    sourceRole,
    targetLocale,
    options.gender,
  );
  if (projected && projected !== sourceRole) {
    // Guard: projected must not invent seniority/management wording.
    if (/\b(?:senior|lead|head|director|manager|chief|principal)\b/iu.test(projected)
      && !/\b(?:senior|lead|head|director|manager|chief|principal)\b/iu.test(sourceRole)) {
      return {
        ...emptyBase,
        canonicalRoleIdentity: canonicalId,
        canonicalRoleIdentityHash: canonicalHash,
        localizationSource: 'free_text_rejected',
        localizationConfidence: 'none',
        localizationValidationPassed: false,
        rejectionReasons: ['unsafe_broadened_translation'],
      };
    }
    return {
      ...emptyBase,
      canonicalRoleIdentity: canonicalId,
      canonicalRoleIdentityHash: canonicalHash,
      localizedTargetRoleLabel: projected,
      localizedTargetRoleLabelHash: hashOpaque(projected),
      localizationSource: 'validated_localized_mapping',
      localizationConfidence: 'medium',
      localizationValidationPassed: true,
      rejectionReasons: [],
    };
  }

  if (looksLikeTargetLocaleRole(sourceRole, targetLocale)
    || (sourceLocale && sourceLocale === targetLocale)) {
    return {
      ...emptyBase,
      canonicalRoleIdentity: canonicalId,
      canonicalRoleIdentityHash: canonicalHash,
      localizedTargetRoleLabel: sourceRole,
      localizedTargetRoleLabelHash: hashOpaque(sourceRole),
      localizationSource: 'target_locale_already',
      localizationConfidence: 'medium',
      localizationValidationPassed: true,
      rejectionReasons: [],
    };
  }

  // Free-text foreign role with no safe mapping — fail closed (do not leak raw label).
  return {
    ...emptyBase,
    canonicalRoleIdentity: canonicalId,
    canonicalRoleIdentityHash: canonicalHash,
    localizationSource: 'free_text_rejected',
    localizationConfidence: 'none',
    localizationValidationPassed: false,
    rejectionReasons: ['raw_source_role_leakage_forbidden', 'no_safe_localized_role'],
  };
}

export type StructuredRoleLocaleValidation = {
  structuredRoleLocaleValidationPassed: boolean;
  currentRoleLocalizationValidationPassed: boolean;
  priorRoleLocalizationValidationPassed: boolean;
  foreignStructuredRoleTitleCount: number;
  foreignCurrentRoleTitleDetected: boolean;
  foreignPriorRoleTitleCount: number;
  foreignPriorRoleEntryIdHashes: string[];
  rawSourceRoleLeakageDetected: boolean;
  sourceRoleAliasLeakageCount: number;
  finalWrongLocaleStructuredRoleCount: number;
  failureKinds: string[];
  currentRoleCanonicalIdentityHash: string | null;
  currentRoleSourceLocale: string | null;
  currentRoleTargetLocale: Locale;
  currentRoleLocalizationSource: string | null;
  priorRoleCanonicalIdentityHashes: string[];
  priorRoleSourceLocales: string[];
  priorRoleTargetLocales: string[];
  priorRoleLocalizationSources: string[];
};

function roleSpanPresent(text: string, role: string): boolean {
  const r = (role || '').trim();
  if (!r) return false;
  return new RegExp(escapeRe(r), 'iu').test(text || '');
}

/**
 * Validate that structured current/prior role titles appear in the target locale
 * (not as raw source-locale aliases) inside the Summary candidate.
 */
export function validateSummaryStructuredRoleLocale(options: {
  summary: string;
  targetLocale: Locale;
  gender?: string;
  currentRole?: string;
  currentEntryId?: string | null;
  priorRole?: string;
  priorEntryId?: string | null;
  currentLocalized?: LocalizedSummaryRoleResult | null;
  priorLocalized?: LocalizedSummaryRoleResult | null;
}): StructuredRoleLocaleValidation {
  void SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION;
  const text = (options.summary || '').replace(/\s+/g, ' ').trim();
  const targetLocale = options.targetLocale;
  const currentResolved = options.currentLocalized || resolveLocalizedSummaryRole({
    role: options.currentRole || '',
    targetLocale,
    gender: options.gender,
    entryId: options.currentEntryId,
  });
  const priorResolved = options.priorLocalized || resolveLocalizedSummaryRole({
    role: options.priorRole || '',
    targetLocale,
    gender: options.gender,
    entryId: options.priorEntryId,
  });

  const failureKinds: string[] = [];
  let foreignCurrent = false;
  let foreignPriorCount = 0;
  let aliasLeakCount = 0;
  const foreignPriorHashes: string[] = [];

  const currentSource = (options.currentRole || '').trim();
  const priorSource = (options.priorRole || '').trim();

  if (currentSource) {
    if (!currentResolved.localizationValidationPassed) {
      failureKinds.push('current_role_locale_mismatch');
    }
    const expected = currentResolved.localizedTargetRoleLabel;
    const hasExpected = expected ? roleSpanPresent(text, expected) : false;
    const hasRawForeign = currentSource
      && currentSource !== expected
      && roleSpanPresent(text, currentSource)
      && detectRoleLabelSourceLocale(currentSource) !== null
      && detectRoleLabelSourceLocale(currentSource) !== targetLocale;
    if (hasRawForeign) {
      foreignCurrent = true;
      aliasLeakCount += 1;
      failureKinds.push('foreign_current_role_title');
      failureKinds.push('raw_source_role_leakage');
    } else if (expected && !hasExpected && roleSpanPresent(text, currentSource)) {
      // Source equals something in text but not localized form.
      if (detectRoleLabelSourceLocale(currentSource) !== targetLocale) {
        foreignCurrent = true;
        failureKinds.push('current_role_locale_mismatch');
      }
    }
  }

  if (priorSource) {
    if (!priorResolved.localizationValidationPassed) {
      failureKinds.push('prior_role_locale_mismatch');
    }
    const expected = priorResolved.localizedTargetRoleLabel;
    const hasExpected = expected ? roleSpanPresent(text, expected) : false;
    const hasRawForeign = priorSource
      && priorSource !== expected
      && roleSpanPresent(text, priorSource)
      && detectRoleLabelSourceLocale(priorSource) !== null
      && detectRoleLabelSourceLocale(priorSource) !== targetLocale;
    if (hasRawForeign) {
      foreignPriorCount += 1;
      aliasLeakCount += 1;
      if (priorResolved.sourceEntryIdHash) {
        foreignPriorHashes.push(priorResolved.sourceEntryIdHash);
      }
      failureKinds.push('foreign_prior_role_title');
      failureKinds.push('raw_source_role_leakage');
    } else if (expected && !hasExpected) {
      // Prior role missing or still foreign.
      if (roleSpanPresent(text, priorSource)
        && detectRoleLabelSourceLocale(priorSource) !== targetLocale) {
        foreignPriorCount += 1;
        failureKinds.push('prior_role_locale_mismatch');
      }
    }
    // Also catch Spanish graphic-designer forms even if structured priorRole was already German.
    if (
      targetLocale === 'de'
      && /diseñador(?:a)?\s+gráfic(?:a|o)|disenador(?:a)?\s+grafic(?:a|o)/iu.test(text)
    ) {
      foreignPriorCount = Math.max(foreignPriorCount, 1);
      aliasLeakCount += 1;
      failureKinds.push('foreign_prior_role_title');
      failureKinds.push('raw_source_role_leakage');
    }
  }

  const foreignCount = (foreignCurrent ? 1 : 0) + foreignPriorCount;
  const passed = foreignCount === 0
    && (!currentSource || currentResolved.localizationValidationPassed)
    && (!priorSource || priorResolved.localizationValidationPassed)
    && failureKinds.length === 0;

  return {
    structuredRoleLocaleValidationPassed: passed,
    currentRoleLocalizationValidationPassed: !currentSource
      || (currentResolved.localizationValidationPassed && !foreignCurrent),
    priorRoleLocalizationValidationPassed: !priorSource
      || (priorResolved.localizationValidationPassed && foreignPriorCount === 0),
    foreignStructuredRoleTitleCount: foreignCount,
    foreignCurrentRoleTitleDetected: foreignCurrent,
    foreignPriorRoleTitleCount: foreignPriorCount,
    foreignPriorRoleEntryIdHashes: [...new Set(foreignPriorHashes)],
    rawSourceRoleLeakageDetected: aliasLeakCount > 0,
    sourceRoleAliasLeakageCount: aliasLeakCount,
    finalWrongLocaleStructuredRoleCount: foreignCount,
    failureKinds: [...new Set(failureKinds)],
    currentRoleCanonicalIdentityHash: currentResolved.canonicalRoleIdentityHash,
    currentRoleSourceLocale: currentResolved.sourceRoleLocale,
    currentRoleTargetLocale: targetLocale,
    currentRoleLocalizationSource: currentResolved.localizationSource,
    priorRoleCanonicalIdentityHashes: priorResolved.canonicalRoleIdentityHash
      ? [priorResolved.canonicalRoleIdentityHash]
      : [],
    priorRoleSourceLocales: priorResolved.sourceRoleLocale
      ? [priorResolved.sourceRoleLocale]
      : [],
    priorRoleTargetLocales: priorSource ? [targetLocale] : [],
    priorRoleLocalizationSources: priorSource
      ? [priorResolved.localizationSource]
      : [],
  };
}

export type GermanRoleLocaleRepairResult = {
  attempted: boolean;
  applied: boolean;
  text: string;
  transformationKinds: string[];
  rejectionReasons: string[];
};

/** Post-apply: visible Summary must match final structured-role locale purity. */
export function verifyVisibleSummaryStructuredRoleLocale(options: {
  visibleSummary: string;
  targetLocale: Locale;
  gender?: string;
  currentRole?: string;
  priorRole?: string;
  currentEntryId?: string | null;
  priorEntryId?: string | null;
  finalStructuredRoleLocaleValidationPassed?: boolean | null;
}): {
  visibleStructuredRoleLocaleValidationPassed: boolean;
  visibleWrongLocaleStructuredRoleCount: number;
  visibleRoleLocalizationMismatch: boolean;
  failureKind: string | null;
} {
  void SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION;
  const validation = validateSummaryStructuredRoleLocale({
    summary: options.visibleSummary,
    targetLocale: options.targetLocale,
    gender: options.gender,
    currentRole: options.currentRole,
    priorRole: options.priorRole,
    currentEntryId: options.currentEntryId,
    priorEntryId: options.priorEntryId,
  });
  const mismatch = options.finalStructuredRoleLocaleValidationPassed === true
    && !validation.structuredRoleLocaleValidationPassed;
  return {
    visibleStructuredRoleLocaleValidationPassed:
      validation.structuredRoleLocaleValidationPassed,
    visibleWrongLocaleStructuredRoleCount:
      validation.finalWrongLocaleStructuredRoleCount,
    visibleRoleLocalizationMismatch: mismatch,
    failureKind: mismatch
      ? 'visible_role_localization_mismatch'
      : (validation.structuredRoleLocaleValidationPassed
        ? null
        : (validation.failureKinds[0] || 'structured_role_locale_failed')),
  };
}

/**
 * Narrow repair: replace foreign structured role-title spans with validated
 * target-locale labels. Does not invent duties/employers/status.
 */
export function repairGermanSummaryStructuredRoleLocales(
  summary: string,
  options: {
    currentRole?: string;
    priorRole?: string;
    gender?: string;
    currentEntryId?: string | null;
    priorEntryId?: string | null;
  },
): GermanRoleLocaleRepairResult {
  void GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return {
      attempted: false,
      applied: false,
      text: '',
      transformationKinds: [],
      rejectionReasons: ['empty_summary'],
    };
  }

  const currentResolved = resolveLocalizedSummaryRole({
    role: options.currentRole || '',
    targetLocale: 'de',
    gender: options.gender,
    entryId: options.currentEntryId,
  });
  const priorResolved = resolveLocalizedSummaryRole({
    role: options.priorRole || '',
    targetLocale: 'de',
    gender: options.gender,
    entryId: options.priorEntryId,
  });

  let out = text;
  const transformations: string[] = [];
  const currentSource = (options.currentRole || '').trim();
  const priorSource = (options.priorRole || '').trim();

  if (
    currentSource
    && currentResolved.localizationValidationPassed
    && currentResolved.localizedTargetRoleLabel
    && currentSource !== currentResolved.localizedTargetRoleLabel
    && roleSpanPresent(out, currentSource)
  ) {
    out = out.replace(
      new RegExp(escapeRe(currentSource), 'giu'),
      currentResolved.localizedTargetRoleLabel,
    );
    transformations.push('current_role_title_localized');
    transformations.push('foreign_role_title_replaced');
  }

  if (
    priorSource
    && priorResolved.localizationValidationPassed
    && priorResolved.localizedTargetRoleLabel
    && priorSource !== priorResolved.localizedTargetRoleLabel
    && roleSpanPresent(out, priorSource)
  ) {
    out = out.replace(
      new RegExp(escapeRe(priorSource), 'giu'),
      priorResolved.localizedTargetRoleLabel,
    );
    transformations.push('prior_role_title_localized');
    transformations.push('foreign_role_title_replaced');
  }

  // Catch Spanish graphic-designer aliases even when structured priorRole was already localized.
  if (/diseñador(?:a)?\s+gráfic(?:a|o)|disenador(?:a)?\s+grafic(?:a|o)/iu.test(out)) {
    const deLabel = localizeGraphicDesigner('de', options.gender);
    out = out
      .replace(/diseñadora\s+gráfica/giu, deLabel)
      .replace(/diseñador\s+gráfico/giu, deLabel)
      .replace(/disenadora\s+grafica/giu, deLabel)
      .replace(/disenador\s+grafico/giu, deLabel);
    if (!transformations.includes('prior_role_title_localized')) {
      transformations.push('prior_role_title_localized');
    }
    if (!transformations.includes('foreign_role_title_replaced')) {
      transformations.push('foreign_role_title_replaced');
    }
  }

  if (transformations.length === 0) {
    const validation = validateSummaryStructuredRoleLocale({
      summary: out,
      targetLocale: 'de',
      gender: options.gender,
      currentRole: options.currentRole,
      priorRole: options.priorRole,
      currentEntryId: options.currentEntryId,
      priorEntryId: options.priorEntryId,
      currentLocalized: currentResolved,
      priorLocalized: priorResolved,
    });
    if (validation.structuredRoleLocaleValidationPassed) {
      return {
        attempted: false,
        applied: false,
        text: out,
        transformationKinds: [],
        rejectionReasons: [],
      };
    }
    return {
      attempted: true,
      applied: false,
      text: out,
      transformationKinds: [],
      rejectionReasons: validation.failureKinds,
    };
  }

  const validation = validateSummaryStructuredRoleLocale({
    summary: out,
    targetLocale: 'de',
    gender: options.gender,
    currentRole: options.currentRole,
    priorRole: options.priorRole,
    currentEntryId: options.currentEntryId,
    priorEntryId: options.priorEntryId,
    currentLocalized: currentResolved,
    priorLocalized: priorResolved,
  });
  if (!validation.structuredRoleLocaleValidationPassed) {
    return {
      attempted: true,
      applied: false,
      text: out,
      transformationKinds: [...new Set(transformations)],
      rejectionReasons: validation.failureKinds,
    };
  }

  return {
    attempted: true,
    applied: true,
    text: out,
    transformationKinds: [...new Set(transformations)],
    rejectionReasons: [],
  };
}
