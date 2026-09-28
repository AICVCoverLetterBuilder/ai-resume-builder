import type {
  CVData,
  WorkExperience,
  ExportLocalizedTitleSurface,
  ExportLocalizedTitleSurfaceStore,
} from './types';
import type { Locale } from './i18n/translations';
import { resolveLocaleCandidate } from './i18n/translations';
import { detectTextLocale, localesEquivalent } from './cv-content-locale';
import { localizeOccupationalTitleForProjection } from './cv-role-title';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import type { SummaryV2LocalizationProviderResponse } from './cv-summary-v2';

export const CV_EXPORT_TITLE_LOCALIZATION_REVISION =
  'cv-export-title-localization-405-v1' as const;
export const CV_EXPORT_TITLE_SURFACE_SCHEMA = 1 as const;
export const CV_EXPORT_TITLE_PROVIDER_BATCH_SIZE = 8 as const;
export const CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION =
  'cv-export-title-batch-recovery-407-v3' as const;

export type { ExportLocalizedTitleSurface, ExportLocalizedTitleSurfaceStore } from './types';

export type ExportTitleLocalizationTransportInput = {
  targetLocale: Locale;
  gender: string;
  repair: boolean;
  entries: Array<{
    entryId: string;
    sourceLocale: Locale;
    roleTitle: string;
    employer: string;
    employmentState: 'present' | 'completed';
    facts: [];
  }>;
};

export type ExportTitleLocaleResolutionSource =
  | 'direct_title_detection'
  | 'persisted_position_source_locale'
  | 'authoritative_description_detection'
  | 'persisted_description_source_locale'
  | 'current_description_detection'
  | 'content_locale'
  | 'target_locale_fallback'
  | 'matching_experience_inheritance'
  | 'present_experience_inheritance'
  | 'first_experience_inheritance';

export type ExportTitleLocaleResolutionDiagnostic = {
  directTitleDetectionResult: Locale | null;
  persistedPositionSourceLocalePresent: boolean;
  persistedPositionSourceLocale: Locale | null;
  authoritativeDescriptionDetectionResult: Locale | null;
  persistedDescriptionSourceLocalePresent: boolean;
  persistedDescriptionSourceLocale: Locale | null;
  currentDescriptionDetectionResult: Locale | null;
  contentLocaleConsidered: Locale | null;
  targetLocale: Locale;
  finalSourceLocale: Locale;
  resolutionSource: ExportTitleLocaleResolutionSource;
  inheritedResolutionSource?: ExportTitleLocaleResolutionSource;
};

export type ExportTitleLocalizationFailureLayer =
  | 'server_translator_parse_or_parity'
  | 'server_independent_verifier'
  | 'http_or_transport'
  | 'client_manifest_validation';

export type ExportTitleClientValidationSubcode =
  | 'target_locale_mismatch'
  | 'entry_identity_count_mismatch'
  | 'missing_expected_identity'
  | 'facts_not_array'
  | 'facts_not_empty'
  | 'localized_title_empty'
  | 'localized_title_too_long'
  | 'localized_title_contains_newline'
  | 'unchanged_cross_locale_title'
  | 'wrong_script'
  | 'source_language_leakage'
  | 'target_locale_purity_failed';

export type ExportTitleLocalizationFailureEvidence = {
  titleFailureLayer?: ExportTitleLocalizationFailureLayer;
  titleFailureSubcode?: string;
  titleHttpStatus?: number | null;
  titleExpectedIdentityCount?: number | null;
  titleReturnedIdentityCount?: number | null;
  titleIdentityParityPassed?: boolean | null;
  titleCountParityPassed?: boolean | null;
};

export type ExportTitleProviderAttemptDiagnostic = {
  pass: 'initial' | 'repair';
  attempted: boolean;
  result: 'success' | 'failed' | 'not_attempted';
  batchKind: 'root_batch' | 'split_child';
  batchDiagnosticId: string;
  unitCount: number;
  failureLayer: ExportTitleLocalizationFailureLayer | null;
  failureSubcode: string | null;
  topLevelReason: string | null;
  httpStatus: number | null;
  httpCategory: 'success' | 'client_error' | 'server_error' | 'transport' | null;
  expectedIdentityCount: number;
  returnedIdentityCount: number | null;
  identityParityPassed: boolean | null;
  countParityPassed: boolean | null;
};

export type ExportTitleFieldIdentityDiagnostic = {
  diagnosticUnitId: string;
  sharedSourceTitleFieldCount: number;
  fieldsShareSourceUnit: boolean;
};

export type ExportTitleLocalizationAdapter = (
  input: ExportTitleLocalizationTransportInput,
) => Promise<SummaryV2LocalizationProviderResponse>;

export type ExportTitleLocalizationDiagnostics = {
  titleLocalizationRevision: typeof CV_EXPORT_TITLE_LOCALIZATION_REVISION;
  titleTargetLocale: Locale;
  titleFieldCount: number;
  titleUniqueSourceCount: number;
  titleSameLocaleCount: number;
  titleDeterministicCount: number;
  titleCacheReuseCount: number;
  titleProviderRequestCount: number;
  titleProviderRepairCount: number;
  titleBatchRecoveryRevision: typeof CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION;
  titleBatchSplitCount: number;
  titleSingletonFailureCount: number;
  titleLastProviderFailureReason?: string;
  titleLocalizedFieldCount: number;
  titleSummaryMentionReplacementCount: number;
  titleSourceLocaleByField: Record<string, Locale>;
  titleLocaleResolutionByField: Record<string, ExportTitleLocaleResolutionDiagnostic>;
  titleIdentityByField: Record<string, ExportTitleFieldIdentityDiagnostic>;
  titleProviderAttempts: ExportTitleProviderAttemptDiagnostic[];
  titleInitialRepairUnitIdentityMatched: boolean | null;
  titleTerminalBatchKind:
    | 'none'
    | 'failed_multi_unit_batch'
    | 'root_singleton_terminal_failure'
    | 'split_child_singleton_terminal_failure';
  titleProjectionPassed: boolean;
  employerIdentityStatus: 'not_reached' | 'passed' | 'failed';
  employerIdentityPassed?: boolean;
  titleFailureReason?: string;
};

export type PrepareExportLocalizedTitlesResult =
  | {
    ok: true;
    exportCv: CVData;
    persistableCv: CVData;
    diagnostics: ExportTitleLocalizationDiagnostics;
  }
  | {
    ok: false;
    exportCv: CVData;
    persistableCv: CVData;
    reason: string;
    diagnostics: ExportTitleLocalizationDiagnostics;
  };

type TitleFieldRef = {
  fieldKey: string;
  kind: 'personal_job_title' | 'experience_position';
  sourceTitle: string;
  sourceLocale: Locale;
  localeResolution: ExportTitleLocaleResolutionDiagnostic;
  experienceId?: string;
  employer: string;
  employmentState: 'present' | 'completed';
};

type TitleUnit = {
  unitKey: string;
  entryId: string;
  sourceTitle: string;
  sourceLocale: Locale;
  employer: string;
  employmentState: 'present' | 'completed';
  refs: TitleFieldRef[];
};

function canonical(text: string): string {
  return String(text || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function hashText(text: string): string {
  const value = canonical(text);
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}_l${value.length}`;
}

function asLocale(value?: string | null): Locale | null {
  return resolveLocaleCandidate(value);
}

function localeForExperience(
  cv: CVData,
  exp: WorkExperience,
  targetLocale: Locale,
): { locale: Locale; diagnostic: ExportTitleLocaleResolutionDiagnostic } {
  const titleDetected = asLocale(detectTextLocale(exp.position || ''));
  const authoritativeDescription = exp.originalUserDescription
    || exp.canonicalDescription
    || exp.description
    || '';
  const authoritativeDescriptionDetected = asLocale(detectTextLocale(authoritativeDescription));
  const currentDescriptionDetected = asLocale(detectTextLocale(exp.description || ''));
  const persistedPositionSourceLocale = asLocale(exp.positionSourceLocale);
  const persistedDescriptionSourceLocale = asLocale(exp.descriptionSourceLocale);
  const contentLocale = asLocale(cv.contentLocale);
  const selected = titleDetected
    ? { locale: titleDetected, source: 'direct_title_detection' as const }
    : persistedPositionSourceLocale
      ? { locale: persistedPositionSourceLocale, source: 'persisted_position_source_locale' as const }
      : authoritativeDescriptionDetected
        ? { locale: authoritativeDescriptionDetected, source: 'authoritative_description_detection' as const }
        : persistedDescriptionSourceLocale
          ? { locale: persistedDescriptionSourceLocale, source: 'persisted_description_source_locale' as const }
          : currentDescriptionDetected
            ? { locale: currentDescriptionDetected, source: 'current_description_detection' as const }
            : contentLocale
              ? { locale: contentLocale, source: 'content_locale' as const }
              : { locale: targetLocale, source: 'target_locale_fallback' as const };
  return {
    locale: selected.locale,
    diagnostic: {
      directTitleDetectionResult: titleDetected,
      persistedPositionSourceLocalePresent: Boolean(exp.positionSourceLocale),
      persistedPositionSourceLocale,
      authoritativeDescriptionDetectionResult: authoritativeDescriptionDetected,
      persistedDescriptionSourceLocalePresent: Boolean(exp.descriptionSourceLocale),
      persistedDescriptionSourceLocale,
      currentDescriptionDetectionResult: currentDescriptionDetected,
      contentLocaleConsidered: contentLocale,
      targetLocale,
      finalSourceLocale: selected.locale,
      resolutionSource: selected.source,
    },
  };
}

function localeForHeader(
  cv: CVData,
  targetLocale: Locale,
): { locale: Locale; diagnostic: ExportTitleLocaleResolutionDiagnostic } {
  const header = canonical(cv.personal?.jobTitle || '');
  const matching = (cv.experience || []).find(
    (exp) => canonical(exp.position || '').toLocaleLowerCase() === header.toLocaleLowerCase(),
  );
  const current = matching
    || (cv.experience || []).find((exp) => exp.isPresent)
    || (cv.experience || [])[0];
  const titleDetected = asLocale(detectTextLocale(header));
  const inherited = current ? localeForExperience(cv, current, targetLocale) : null;
  const contentLocale = asLocale(cv.contentLocale);
  if (titleDetected) {
    return {
      locale: titleDetected,
      diagnostic: {
        ...(inherited?.diagnostic || {
          persistedPositionSourceLocalePresent: false,
          persistedPositionSourceLocale: null,
          authoritativeDescriptionDetectionResult: null,
          persistedDescriptionSourceLocalePresent: false,
          persistedDescriptionSourceLocale: null,
          currentDescriptionDetectionResult: null,
        }),
        directTitleDetectionResult: titleDetected,
        contentLocaleConsidered: contentLocale,
        targetLocale,
        finalSourceLocale: titleDetected,
        resolutionSource: 'direct_title_detection',
      },
    };
  }
  if (current && inherited) {
    const resolutionSource = matching
      ? 'matching_experience_inheritance' as const
      : current.isPresent
        ? 'present_experience_inheritance' as const
        : 'first_experience_inheritance' as const;
    return {
      locale: inherited.locale,
      diagnostic: {
        ...inherited.diagnostic,
        directTitleDetectionResult: null,
        finalSourceLocale: inherited.locale,
        resolutionSource,
        inheritedResolutionSource: inherited.diagnostic.resolutionSource,
      },
    };
  }
  const locale = contentLocale || targetLocale;
  return {
    locale,
    diagnostic: {
      directTitleDetectionResult: null,
      persistedPositionSourceLocalePresent: false,
      persistedPositionSourceLocale: null,
      authoritativeDescriptionDetectionResult: null,
      persistedDescriptionSourceLocalePresent: false,
      persistedDescriptionSourceLocale: null,
      currentDescriptionDetectionResult: null,
      contentLocaleConsidered: contentLocale,
      targetLocale,
      finalSourceLocale: locale,
      resolutionSource: contentLocale ? 'content_locale' : 'target_locale_fallback',
    },
  };
}

function invariantTitle(text: string): boolean {
  const value = canonical(text);
  if (!value) return false;
  if (/^(?:https?:\/\/|www\.)\S+$/iu.test(value)) return true;
  if (/^[A-Z0-9][A-Z0-9._:/+#-]*(?:\s+[A-Z0-9][A-Z0-9._:/+#-]*)*$/u.test(value)) {
    return /[A-Z0-9]/u.test(value);
  }
  return false;
}

export function classifyExportLocalizedTitleFailure(options: {
  sourceTitle: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  localizedTitle: string;
}): ExportTitleClientValidationSubcode | null {
  const localized = canonical(options.localizedTitle);
  if (!localized) return 'localized_title_empty';
  if (localized.length > 500) return 'localized_title_too_long';
  if (
    !localesEquivalent(options.sourceLocale, options.targetLocale)
    && localized.toLocaleLowerCase() === canonical(options.sourceTitle).toLocaleLowerCase()
    && !invariantTitle(localized)
  ) return 'unchanged_cross_locale_title';
  if (invariantTitle(localized)) return null;
  const purity = validateAiUnitLocalePurity(localized, options.targetLocale, {
    kind: 'summary_sentence',
    requireUnits: true,
  });
  if (purity.wrongScriptUnitCount > 0) return 'wrong_script';
  if (purity.sourceLanguageLeakageDetected) return 'source_language_leakage';
  const detected = asLocale(detectTextLocale(localized, { storedLocale: options.targetLocale }));
  return purity.targetLocalePurityPassed
    || detected === options.targetLocale
    || detected === null
    ? null
    : 'target_locale_purity_failed';
}

function validLocalizedTitle(options: {
  sourceTitle: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  localizedTitle: string;
}): boolean {
  return classifyExportLocalizedTitleFailure(options) === null;
}

function fieldRefs(
  cv: CVData,
  targetLocale: Locale,
  options?: { experienceIds?: ReadonlySet<string>; includePersonalTitle?: boolean },
): TitleFieldRef[] {
  const refs: TitleFieldRef[] = [];
  const header = canonical(cv.personal?.jobTitle || '');
  if (header && options?.includePersonalTitle !== false) {
    const current = (cv.experience || []).find((exp) => exp.isPresent)
      || (cv.experience || [])[0];
    const localeResolution = localeForHeader(cv, targetLocale);
    refs.push({
      fieldKey: 'personal.jobTitle',
      kind: 'personal_job_title',
      sourceTitle: header,
      sourceLocale: localeResolution.locale,
      localeResolution: localeResolution.diagnostic,
      employer: current?.company || '',
      employmentState: current?.isPresent ? 'present' : 'completed',
    });
  }
  for (const exp of cv.experience || []) {
    if (options?.experienceIds && !options.experienceIds.has(exp.id)) continue;
    const title = canonical(exp.position || '');
    if (!title) continue;
    const localeResolution = localeForExperience(cv, exp, targetLocale);
    refs.push({
      fieldKey: `experience.${exp.id}.position`,
      kind: 'experience_position',
      experienceId: exp.id,
      sourceTitle: title,
      sourceLocale: localeResolution.locale,
      localeResolution: localeResolution.diagnostic,
      employer: exp.company || '',
      employmentState: exp.isPresent ? 'present' : 'completed',
    });
  }
  return refs;
}

function buildUnits(refs: TitleFieldRef[], targetLocale: Locale, gender: string): TitleUnit[] {
  const units = new Map<string, TitleUnit>();
  for (const ref of refs) {
    const unitKey = [
      CV_EXPORT_TITLE_LOCALIZATION_REVISION,
      hashText(ref.sourceTitle),
      ref.sourceLocale,
      targetLocale,
      gender,
    ].join('|');
    const current = units.get(unitKey);
    if (current) {
      current.refs.push(ref);
      if (!current.employer && ref.employer) current.employer = ref.employer;
      continue;
    }
    units.set(unitKey, {
      unitKey,
      entryId: `export_title_${hashText(unitKey)}`,
      sourceTitle: ref.sourceTitle,
      sourceLocale: ref.sourceLocale,
      employer: ref.employer,
      employmentState: ref.employmentState,
      refs: [ref],
    });
  }
  return [...units.values()];
}

function usableStore(cv: CVData): ExportLocalizedTitleSurfaceStore {
  const store = cv.exportLocalizedTitleSurfaces;
  if (store?.schemaVersion === CV_EXPORT_TITLE_SURFACE_SCHEMA && store.surfaces) return store;
  return { schemaVersion: CV_EXPORT_TITLE_SURFACE_SCHEMA, surfaces: {} };
}

function bindingKey(unit: TitleUnit, targetLocale: Locale, gender: string): string {
  return [unit.unitKey, targetLocale, gender].join('|');
}

function titleAdapterFailureReason(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  const reason = canonical(raw);
  return /^[a-z0-9_:-]+$/iu.test(reason)
    ? reason
    : 'export_title_localization_provider_failed';
}

function titleAdapterFailureEvidence(error: unknown): ExportTitleLocalizationFailureEvidence {
  if (!error || typeof error !== 'object') return {};
  const candidate = error as ExportTitleLocalizationFailureEvidence;
  return {
    titleFailureLayer: candidate.titleFailureLayer,
    titleFailureSubcode: candidate.titleFailureSubcode,
    titleHttpStatus: typeof candidate.titleHttpStatus === 'number'
      ? candidate.titleHttpStatus
      : candidate.titleHttpStatus === null
        ? null
        : undefined,
    titleExpectedIdentityCount: typeof candidate.titleExpectedIdentityCount === 'number'
      ? candidate.titleExpectedIdentityCount
      : candidate.titleExpectedIdentityCount === null
        ? null
        : undefined,
    titleReturnedIdentityCount: typeof candidate.titleReturnedIdentityCount === 'number'
      ? candidate.titleReturnedIdentityCount
      : candidate.titleReturnedIdentityCount === null
        ? null
        : undefined,
    titleIdentityParityPassed: typeof candidate.titleIdentityParityPassed === 'boolean'
      ? candidate.titleIdentityParityPassed
      : candidate.titleIdentityParityPassed === null
        ? null
        : undefined,
    titleCountParityPassed: typeof candidate.titleCountParityPassed === 'boolean'
      ? candidate.titleCountParityPassed
      : candidate.titleCountParityPassed === null
        ? null
        : undefined,
  };
}

function httpCategory(status: number | null): ExportTitleProviderAttemptDiagnostic['httpCategory'] {
  if (status === null) return 'transport';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  if (status >= 200 && status < 300) return 'success';
  return null;
}

function validateProviderResponse(options: {
  response: SummaryV2LocalizationProviderResponse;
  batch: TitleUnit[];
  targetLocale: Locale;
}): {
  failureSubcode: ExportTitleClientValidationSubcode | null;
  returnedIdentityCount: number;
  identityParityPassed: boolean;
  countParityPassed: boolean;
} {
  const actualById = new Map(
    (options.response.entries || []).map((entry) => [entry.entryId, entry]),
  );
  const countParityPassed = actualById.size === options.batch.length;
  const identityParityPassed = countParityPassed
    && options.batch.every((unit) => actualById.has(unit.entryId));
  if (options.response.targetLocale !== options.targetLocale) {
    return {
      failureSubcode: 'target_locale_mismatch',
      returnedIdentityCount: actualById.size,
      identityParityPassed,
      countParityPassed,
    };
  }
  if (!countParityPassed) {
    return {
      failureSubcode: 'entry_identity_count_mismatch',
      returnedIdentityCount: actualById.size,
      identityParityPassed,
      countParityPassed,
    };
  }
  for (const unit of options.batch) {
    const entry = actualById.get(unit.entryId);
    if (!entry) {
      return {
        failureSubcode: 'missing_expected_identity',
        returnedIdentityCount: actualById.size,
        identityParityPassed,
        countParityPassed,
      };
    }
    if (!Array.isArray(entry.facts)) {
      return {
        failureSubcode: 'facts_not_array',
        returnedIdentityCount: actualById.size,
        identityParityPassed,
        countParityPassed,
      };
    }
    if (entry.facts.length !== 0) {
      return {
        failureSubcode: 'facts_not_empty',
        returnedIdentityCount: actualById.size,
        identityParityPassed,
        countParityPassed,
      };
    }
    const titleFailure = classifyExportLocalizedTitleFailure({
      sourceTitle: unit.sourceTitle,
      sourceLocale: unit.sourceLocale,
      targetLocale: options.targetLocale,
      localizedTitle: entry.localizedRoleTitle,
    });
    if (titleFailure) {
      return {
        failureSubcode: titleFailure,
        returnedIdentityCount: actualById.size,
        identityParityPassed,
        countParityPassed,
      };
    }
  }
  return {
    failureSubcode: null,
    returnedIdentityCount: actualById.size,
    identityParityPassed,
    countParityPassed,
  };
}

function batchFailureCanBeIsolated(reason: string): boolean {
  return reason === 'export_title_localization_provider_malformed'
    || reason === 'export_title_localization_independent_verification_failed';
}

function cachedMatches(
  surface: ExportLocalizedTitleSurface | undefined,
  unit: TitleUnit,
  targetLocale: Locale,
  gender: string,
): boolean {
  return Boolean(
    surface
    && surface.revision === CV_EXPORT_TITLE_LOCALIZATION_REVISION
    && surface.sourceTitleHash === hashText(unit.sourceTitle)
    && surface.sourceLocale === unit.sourceLocale
    && surface.targetLocale === targetLocale
    && surface.gender === gender
    && validLocalizedTitle({
      sourceTitle: unit.sourceTitle,
      sourceLocale: unit.sourceLocale,
      targetLocale,
      localizedTitle: surface.localizedTitle,
    }),
  );
}

function sourceSnapshotHash(cv: CVData): string {
  return hashText(JSON.stringify({
    id: cv.id,
    personal: {
      fullName: cv.personal?.fullName || '',
      email: cv.personal?.email || '',
      phone: cv.personal?.phone || '',
      address: cv.personal?.address || '',
      linkedIn: cv.personal?.linkedIn || '',
      website: cv.personal?.website || '',
      jobTitle: cv.personal?.jobTitle || '',
      gender: cv.personal?.gender || '',
    },
    summary: cv.summary || '',
    summaryOrigin: cv.summaryOrigin || '',
    summaryGeneratedLocale: cv.summaryGeneratedLocale || '',
    summaryGenerationContextKey: cv.summaryGenerationContextKey || '',
    contentLocale: cv.contentLocale || '',
    experience: (cv.experience || []).map((exp) => ({
      id: exp.id,
      company: exp.company,
      position: exp.position,
      positionProvenance: exp.positionProvenance,
      positionUserEdited: exp.positionUserEdited,
      positionSourceLocale: exp.positionSourceLocale,
      positionSourceKey: exp.positionSourceKey,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isPresent: exp.isPresent,
      description: exp.description,
      descriptionOrigin: exp.descriptionOrigin,
      generatedDescription: exp.generatedDescription,
      generatedLocale: exp.generatedLocale,
      descriptionSourceLocale: exp.descriptionSourceLocale,
      descriptionSourceLocaleTextHash: exp.descriptionSourceLocaleTextHash,
    })),
  }));
}

function replaceTitleMentionsInSummary(options: {
  summary: string;
  refs: TitleFieldRef[];
  localizedByField: Map<string, string>;
}): { summary: string; replacementCount: number } {
  let summary = String(options.summary || '');
  let replacementCount = 0;
  const replacements = new Map<string, string>();
  for (const ref of options.refs) {
    const localized = options.localizedByField.get(ref.fieldKey);
    if (!localized || localized === ref.sourceTitle) continue;
    replacements.set(ref.sourceTitle, localized);
  }
  for (const [sourceTitle, localizedTitle] of [...replacements.entries()]
    .sort(([a], [b]) => b.length - a.length)) {
    if (!summary.includes(sourceTitle)) continue;
    const occurrences = summary.split(sourceTitle).length - 1;
    summary = summary.split(sourceTitle).join(localizedTitle);
    replacementCount += occurrences;
  }
  return { summary, replacementCount };
}

function applyLocalizedTitles(options: {
  sourceCv: CVData;
  exportCv: CVData;
  localizedByField: Map<string, string>;
  refs: TitleFieldRef[];
  targetLocale: Locale;
}): { cv: CVData; summaryMentionReplacementCount: number } {
  const sourceById = new Map((options.sourceCv.experience || []).map((exp) => [exp.id, exp]));
  const summaryProjection = replaceTitleMentionsInSummary({
    summary: options.exportCv.summary,
    refs: options.refs,
    localizedByField: options.localizedByField,
  });
  return {
    cv: {
      ...options.exportCv,
      summary: summaryProjection.summary,
      contentLocale: options.targetLocale,
      personal: {
        ...options.exportCv.personal,
        fullName: options.sourceCv.personal.fullName,
        email: options.sourceCv.personal.email,
        phone: options.sourceCv.personal.phone,
        address: options.sourceCv.personal.address,
        linkedIn: options.sourceCv.personal.linkedIn,
        website: options.sourceCv.personal.website,
        jobTitle: options.localizedByField.get('personal.jobTitle')
          || options.sourceCv.personal.jobTitle,
      },
      experience: (options.exportCv.experience || []).map((exp) => {
        const source = sourceById.get(exp.id);
        if (!source) return exp;
        const localizedPosition = options.localizedByField.get(`experience.${exp.id}.position`)
          || source.position;
        const projectedAcrossLocale = canonical(localizedPosition).toLocaleLowerCase()
          !== canonical(source.position).toLocaleLowerCase();
        return {
          ...exp,
          company: source.company,
          startDate: source.startDate,
          endDate: source.endDate,
          isPresent: source.isPresent,
          position: localizedPosition,
          ...(projectedAcrossLocale
            ? {
              positionProvenance: 'localized_generated' as const,
              positionUserEdited: false,
              positionSourceLocale: options.targetLocale,
            }
            : {
              positionProvenance: source.positionProvenance,
              positionUserEdited: source.positionUserEdited,
              positionSourceLocale: source.positionSourceLocale,
            }),
        };
      }),
    },
    summaryMentionReplacementCount: summaryProjection.replacementCount,
  };
}

export async function prepareExportLocalizedTitles(options: {
  sourceCv: CVData;
  exportCv: CVData;
  targetLocale: Locale;
  gender?: string;
  adapter: ExportTitleLocalizationAdapter;
  getCurrentCv?: () => CVData;
  experienceIds?: ReadonlySet<string>;
  includePersonalTitle?: boolean;
}): Promise<PrepareExportLocalizedTitlesResult> {
  const gender = String(options.gender || '');
  const refs = fieldRefs(options.sourceCv, options.targetLocale, {
    experienceIds: options.experienceIds,
    includePersonalTitle: options.includePersonalTitle,
  });
  const units = buildUnits(refs, options.targetLocale, gender);
  const store = usableStore(options.sourceCv);
  const activeSourceHashes = new Set(units.map((unit) => hashText(unit.sourceTitle)));
  const nextSurfaces = options.experienceIds
    ? { ...store.surfaces }
    : Object.fromEntries(
      Object.entries(store.surfaces).filter(([, surface]) => (
        activeSourceHashes.has(surface.sourceTitleHash)
      )),
    );
  const localizedByUnit = new Map<string, string>();
  const sourceLocaleByField = Object.fromEntries(refs.map((ref) => [ref.fieldKey, ref.sourceLocale]));
  const localeResolutionByField = Object.fromEntries(
    refs.map((ref) => [ref.fieldKey, ref.localeResolution]),
  );
  const unitByField = new Map<string, TitleUnit>();
  const diagnosticUnitIdByUnitKey = new Map<string, string>();
  for (const unit of units) {
    diagnosticUnitIdByUnitKey.set(unit.unitKey, `u${diagnosticUnitIdByUnitKey.size}`);
    for (const ref of unit.refs) unitByField.set(ref.fieldKey, unit);
  }
  const titleIdentityByField = Object.fromEntries(refs.map((ref) => {
    const unit = unitByField.get(ref.fieldKey)!;
    return [ref.fieldKey, {
      diagnosticUnitId: diagnosticUnitIdByUnitKey.get(unit.unitKey) || 'u-unknown',
      sharedSourceTitleFieldCount: unit.refs.length,
      fieldsShareSourceUnit: unit.refs.length > 1,
    } satisfies ExportTitleFieldIdentityDiagnostic];
  }));
  let sameLocaleCount = 0;
  let deterministicCount = 0;
  let cacheReuseCount = 0;
  let providerRequestCount = 0;
  let providerRepairCount = 0;
  let titleBatchSplitCount = 0;
  let titleSingletonFailureCount = 0;
  let titleLastProviderFailureReason: string | undefined;
  const titleProviderAttempts: ExportTitleProviderAttemptDiagnostic[] = [];
  let titleTerminalBatchKind: ExportTitleLocalizationDiagnostics['titleTerminalBatchKind'] = 'none';
  const missing: TitleUnit[] = [];
  const diagnosticBatchIdByBatchKey = new Map<string, string>();
  const diagnosticBatchId = (batch: TitleUnit[]): string => {
    const key = batch.map((unit) => unit.unitKey).join('\u001f');
    const existing = diagnosticBatchIdByBatchKey.get(key);
    if (existing) return existing;
    const next = `b${diagnosticBatchIdByBatchKey.size}`;
    diagnosticBatchIdByBatchKey.set(key, next);
    return next;
  };
  const initialSnapshotHash = sourceSnapshotHash(options.sourceCv);

  for (const unit of units) {
    // Known occupational titles are projected first. This remains correct even
    // when legacy description metadata claims the target locale while the
    // current visible title is still a foreign-language source title.
    const deterministic = canonical(
      localizeOccupationalTitleForProjection(
        unit.sourceTitle,
        options.targetLocale,
        gender,
      ),
    );
    if (
      deterministic
      && deterministic.toLocaleLowerCase() !== unit.sourceTitle.toLocaleLowerCase()
      && validLocalizedTitle({
        sourceTitle: unit.sourceTitle,
        sourceLocale: unit.sourceLocale,
        targetLocale: options.targetLocale,
        localizedTitle: deterministic,
      })
    ) {
      localizedByUnit.set(unit.unitKey, deterministic);
      deterministicCount += 1;
      continue;
    }
    if (localesEquivalent(unit.sourceLocale, options.targetLocale)) {
      localizedByUnit.set(unit.unitKey, unit.sourceTitle);
      sameLocaleCount += 1;
      continue;
    }
    const key = bindingKey(unit, options.targetLocale, gender);
    const cached = nextSurfaces[key];
    if (cachedMatches(cached, unit, options.targetLocale, gender)) {
      localizedByUnit.set(unit.unitKey, cached!.localizedTitle);
      cacheReuseCount += 1;
      continue;
    }
    missing.push(unit);
  }

  const resolveProviderBatch = async (batch: TitleUnit[], depth: number): Promise<{
    ok: true;
    accepted: SummaryV2LocalizationProviderResponse;
  } | {
    ok: false;
    reason: string;
  }> => {
    let lastReason = 'export_title_localization_provider_failed';
    const batchDiagnosticId = diagnosticBatchId(batch);
    const batchKind = depth === 0 ? 'root_batch' as const : 'split_child' as const;
    for (let pass = 0; pass < 2; pass += 1) {
      providerRequestCount += 1;
      if (pass === 1) providerRepairCount += 1;
      let response: SummaryV2LocalizationProviderResponse;
      try {
        response = await options.adapter({
          targetLocale: options.targetLocale,
          gender,
          repair: pass === 1,
          entries: batch.map((unit) => ({
            entryId: unit.entryId,
            sourceLocale: unit.sourceLocale,
            roleTitle: unit.sourceTitle,
            employer: unit.employer,
            employmentState: unit.employmentState,
            facts: [],
          })),
        });
      } catch (error) {
        lastReason = titleAdapterFailureReason(error);
        titleLastProviderFailureReason = lastReason;
        const evidence = titleAdapterFailureEvidence(error);
        const inferredLayer: ExportTitleLocalizationFailureLayer = evidence.titleFailureLayer
          || (lastReason === 'export_title_localization_independent_verification_failed'
            ? 'server_independent_verifier'
            : lastReason === 'export_title_localization_provider_malformed'
              ? 'server_translator_parse_or_parity'
              : 'http_or_transport');
        const status = evidence.titleHttpStatus ?? null;
        titleProviderAttempts.push({
          pass: pass === 0 ? 'initial' : 'repair',
          attempted: true,
          result: 'failed',
          batchKind,
          batchDiagnosticId,
          unitCount: batch.length,
          failureLayer: inferredLayer,
          failureSubcode: evidence.titleFailureSubcode || 'diagnostic_unavailable_legacy',
          topLevelReason: lastReason,
          httpStatus: status,
          httpCategory: httpCategory(status),
          expectedIdentityCount: evidence.titleExpectedIdentityCount ?? batch.length,
          returnedIdentityCount: evidence.titleReturnedIdentityCount ?? null,
          identityParityPassed: evidence.titleIdentityParityPassed ?? null,
          countParityPassed: evidence.titleCountParityPassed ?? null,
        });
        continue;
      }
      const validation = validateProviderResponse({
        response,
        batch,
        targetLocale: options.targetLocale,
      });
      if (!validation.failureSubcode) {
        titleProviderAttempts.push({
          pass: pass === 0 ? 'initial' : 'repair',
          attempted: true,
          result: 'success',
          batchKind,
          batchDiagnosticId,
          unitCount: batch.length,
          failureLayer: null,
          failureSubcode: null,
          topLevelReason: null,
          httpStatus: 200,
          httpCategory: 'success',
          expectedIdentityCount: batch.length,
          returnedIdentityCount: validation.returnedIdentityCount,
          identityParityPassed: validation.identityParityPassed,
          countParityPassed: validation.countParityPassed,
        });
        if (pass === 0) {
          titleProviderAttempts.push({
            pass: 'repair',
            attempted: false,
            result: 'not_attempted',
            batchKind,
            batchDiagnosticId,
            unitCount: batch.length,
            failureLayer: null,
            failureSubcode: null,
            topLevelReason: null,
            httpStatus: null,
            httpCategory: null,
            expectedIdentityCount: batch.length,
            returnedIdentityCount: null,
            identityParityPassed: null,
            countParityPassed: null,
          });
        }
        return { ok: true, accepted: response };
      }
      titleProviderAttempts.push({
        pass: pass === 0 ? 'initial' : 'repair',
        attempted: true,
        result: 'failed',
        batchKind,
        batchDiagnosticId,
        unitCount: batch.length,
        failureLayer: 'client_manifest_validation',
        failureSubcode: validation.failureSubcode,
        topLevelReason: 'export_title_localization_provider_malformed',
        httpStatus: 200,
        httpCategory: 'success',
        expectedIdentityCount: batch.length,
        returnedIdentityCount: validation.returnedIdentityCount,
        identityParityPassed: validation.identityParityPassed,
        countParityPassed: validation.countParityPassed,
      });
      lastReason = 'export_title_localization_provider_malformed';
      titleLastProviderFailureReason = lastReason;
    }
    return { ok: false, reason: lastReason };
  };

  const resolveAndStageBatch = async (batch: TitleUnit[], depth = 0): Promise<{
    ok: true;
  } | {
    ok: false;
    reason: string;
  }> => {
    const resolved = await resolveProviderBatch(batch, depth);
    if (!resolved.ok) {
      if (batch.length > 1 && batchFailureCanBeIsolated(resolved.reason)) {
        titleBatchSplitCount += 1;
        const midpoint = Math.ceil(batch.length / 2);
        const left = await resolveAndStageBatch(batch.slice(0, midpoint), depth + 1);
        if (!left.ok) return left;
        const right = await resolveAndStageBatch(batch.slice(midpoint), depth + 1);
        if (!right.ok) return right;
        return { ok: true };
      }
      if (batch.length === 1 && batchFailureCanBeIsolated(resolved.reason)) {
        titleSingletonFailureCount += 1;
        titleTerminalBatchKind = depth === 0
          ? 'root_singleton_terminal_failure'
          : 'split_child_singleton_terminal_failure';
      } else if (batch.length > 1) {
        titleTerminalBatchKind = 'failed_multi_unit_batch';
      }
      return resolved;
    }

    const acceptedById = new Map(
      resolved.accepted.entries.map((entry) => [entry.entryId, entry]),
    );
    for (const unit of batch) {
      const localizedTitle = canonical(acceptedById.get(unit.entryId)!.localizedRoleTitle);
      localizedByUnit.set(unit.unitKey, localizedTitle);
      const key = bindingKey(unit, options.targetLocale, gender);
      nextSurfaces[key] = {
        bindingKey: key,
        sourceTitle: unit.sourceTitle,
        sourceTitleHash: hashText(unit.sourceTitle),
        sourceLocale: unit.sourceLocale,
        targetLocale: options.targetLocale,
        gender,
        localizedTitle,
        localizedTitleHash: hashText(localizedTitle),
        revision: CV_EXPORT_TITLE_LOCALIZATION_REVISION,
      };
    }
    return { ok: true };
  };

  const initialRepairUnitIdentityMatched = (): boolean | null => {
    const repairs = titleProviderAttempts.filter((attempt) => (
      attempt.pass === 'repair' && attempt.attempted
    ));
    if (repairs.length === 0) return null;
    return repairs.every((repairAttempt) => titleProviderAttempts.some((attempt) => (
      attempt.pass === 'initial'
      && attempt.attempted
      && attempt.batchDiagnosticId === repairAttempt.batchDiagnosticId
    )));
  };

  for (let offset = 0; offset < missing.length; offset += CV_EXPORT_TITLE_PROVIDER_BATCH_SIZE) {
    const batch = missing.slice(offset, offset + CV_EXPORT_TITLE_PROVIDER_BATCH_SIZE);
    const resolved = await resolveAndStageBatch(batch);
    if (!resolved.ok) {
      const diagnostics: ExportTitleLocalizationDiagnostics = {
        titleLocalizationRevision: CV_EXPORT_TITLE_LOCALIZATION_REVISION,
        titleTargetLocale: options.targetLocale,
        titleFieldCount: refs.length,
        titleUniqueSourceCount: units.length,
        titleSameLocaleCount: sameLocaleCount,
        titleDeterministicCount: deterministicCount,
        titleCacheReuseCount: cacheReuseCount,
        titleProviderRequestCount: providerRequestCount,
        titleProviderRepairCount: providerRepairCount,
        titleBatchRecoveryRevision: CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
        titleBatchSplitCount,
        titleSingletonFailureCount,
        titleLastProviderFailureReason,
        titleLocalizedFieldCount: 0,
        titleSummaryMentionReplacementCount: 0,
        titleSourceLocaleByField: sourceLocaleByField,
        titleLocaleResolutionByField: localeResolutionByField,
        titleIdentityByField,
        titleProviderAttempts,
        titleInitialRepairUnitIdentityMatched: initialRepairUnitIdentityMatched(),
        titleTerminalBatchKind,
        titleProjectionPassed: false,
        employerIdentityStatus: 'not_reached',
        titleFailureReason: resolved.reason,
      };
      return {
        ok: false,
        exportCv: options.exportCv,
        persistableCv: options.sourceCv,
        reason: resolved.reason,
        diagnostics,
      };
    }
  }

  if (options.getCurrentCv && sourceSnapshotHash(options.getCurrentCv()) !== initialSnapshotHash) {
    const diagnostics: ExportTitleLocalizationDiagnostics = {
      titleLocalizationRevision: CV_EXPORT_TITLE_LOCALIZATION_REVISION,
      titleTargetLocale: options.targetLocale,
      titleFieldCount: refs.length,
      titleUniqueSourceCount: units.length,
      titleSameLocaleCount: sameLocaleCount,
      titleDeterministicCount: deterministicCount,
      titleCacheReuseCount: cacheReuseCount,
      titleProviderRequestCount: providerRequestCount,
      titleProviderRepairCount: providerRepairCount,
      titleBatchRecoveryRevision: CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
      titleBatchSplitCount,
      titleSingletonFailureCount,
      titleLastProviderFailureReason,
      titleLocalizedFieldCount: 0,
      titleSummaryMentionReplacementCount: 0,
      titleSourceLocaleByField: sourceLocaleByField,
      titleLocaleResolutionByField: localeResolutionByField,
      titleIdentityByField,
      titleProviderAttempts,
      titleInitialRepairUnitIdentityMatched: initialRepairUnitIdentityMatched(),
      titleTerminalBatchKind,
      titleProjectionPassed: false,
      employerIdentityStatus: 'not_reached',
      titleFailureReason: 'export_title_localization_stale_snapshot',
    };
    return {
      ok: false,
      exportCv: options.exportCv,
      persistableCv: options.sourceCv,
      reason: 'export_title_localization_stale_snapshot',
      diagnostics,
    };
  }

  const localizedByField = new Map<string, string>();
  for (const unit of units) {
    const localized = localizedByUnit.get(unit.unitKey);
    if (!localized) continue;
    for (const ref of unit.refs) localizedByField.set(ref.fieldKey, localized);
  }
  const titleProjection = applyLocalizedTitles({
    sourceCv: options.sourceCv,
    exportCv: options.exportCv,
    localizedByField,
    refs,
    targetLocale: options.targetLocale,
  });
  const exportCv = titleProjection.cv;
  const titleSummaryMentionReplacementCount = titleProjection.summaryMentionReplacementCount;
  const sourceById = new Map((options.sourceCv.experience || []).map((exp) => [exp.id, exp]));
  const employerIdentityPassed = (exportCv.experience || []).every(
    (exp) => sourceById.get(exp.id)?.company === exp.company,
  );
  const titleProjectionPassed = refs.every((ref) => {
    const localized = localizedByField.get(ref.fieldKey);
    return Boolean(localized && validLocalizedTitle({
      sourceTitle: ref.sourceTitle,
      sourceLocale: ref.sourceLocale,
      targetLocale: options.targetLocale,
      localizedTitle: localized,
    }));
  });
  const persistableCv: CVData = {
    ...options.sourceCv,
    exportLocalizedTitleSurfaces: {
      schemaVersion: CV_EXPORT_TITLE_SURFACE_SCHEMA,
      surfaces: nextSurfaces,
    },
  };
  const diagnostics: ExportTitleLocalizationDiagnostics = {
    titleLocalizationRevision: CV_EXPORT_TITLE_LOCALIZATION_REVISION,
    titleTargetLocale: options.targetLocale,
    titleFieldCount: refs.length,
    titleUniqueSourceCount: units.length,
    titleSameLocaleCount: sameLocaleCount,
    titleDeterministicCount: deterministicCount,
    titleCacheReuseCount: cacheReuseCount,
    titleProviderRequestCount: providerRequestCount,
    titleProviderRepairCount: providerRepairCount,
    titleBatchRecoveryRevision: CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
    titleBatchSplitCount,
    titleSingletonFailureCount,
    titleLastProviderFailureReason,
    titleLocalizedFieldCount: localizedByField.size,
    titleSummaryMentionReplacementCount,
    titleSourceLocaleByField: sourceLocaleByField,
    titleLocaleResolutionByField: localeResolutionByField,
    titleIdentityByField,
    titleProviderAttempts,
    titleInitialRepairUnitIdentityMatched: initialRepairUnitIdentityMatched(),
    titleTerminalBatchKind,
    titleProjectionPassed,
    employerIdentityStatus: employerIdentityPassed ? 'passed' : 'failed',
    employerIdentityPassed,
    ...(titleProjectionPassed && employerIdentityPassed
      ? {}
      : { titleFailureReason: 'export_title_projection_validation_failed' }),
  };
  if (!titleProjectionPassed || !employerIdentityPassed) {
    return {
      ok: false,
      exportCv: options.exportCv,
      persistableCv,
      reason: 'export_title_projection_validation_failed',
      diagnostics,
    };
  }
  return { ok: true, exportCv, persistableCv, diagnostics };
}
