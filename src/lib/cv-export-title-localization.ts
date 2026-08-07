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
  titleLocalizedFieldCount: number;
  titleSummaryMentionReplacementCount: number;
  titleSourceLocaleByField: Record<string, Locale>;
  titleProjectionPassed: boolean;
  employerIdentityPassed: boolean;
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

function localeForExperience(cv: CVData, exp: WorkExperience, targetLocale: Locale): Locale {
  const titleDetected = asLocale(detectTextLocale(exp.position || ''));
  const authoritativeDescription = exp.originalUserDescription
    || exp.canonicalDescription
    || exp.description
    || '';
  const authoritativeDescriptionDetected = asLocale(detectTextLocale(authoritativeDescription));
  const currentDescriptionDetected = asLocale(detectTextLocale(exp.description || ''));
  return titleDetected
    || asLocale(exp.positionSourceLocale)
    || authoritativeDescriptionDetected
    || asLocale(exp.descriptionSourceLocale)
    || currentDescriptionDetected
    || asLocale(cv.contentLocale)
    || targetLocale;
}

function localeForHeader(cv: CVData, targetLocale: Locale): Locale {
  const header = canonical(cv.personal?.jobTitle || '');
  const matching = (cv.experience || []).find(
    (exp) => canonical(exp.position || '').toLocaleLowerCase() === header.toLocaleLowerCase(),
  );
  const current = matching
    || (cv.experience || []).find((exp) => exp.isPresent)
    || (cv.experience || [])[0];
  return asLocale(detectTextLocale(header))
    || (current ? localeForExperience(cv, current, targetLocale) : null)
    || asLocale(cv.contentLocale)
    || targetLocale;
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

function validLocalizedTitle(options: {
  sourceTitle: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  localizedTitle: string;
}): boolean {
  const localized = canonical(options.localizedTitle);
  if (!localized || localized.length > 500 || /[\r\n]/u.test(localized)) return false;
  if (
    !localesEquivalent(options.sourceLocale, options.targetLocale)
    && localized.toLocaleLowerCase() === canonical(options.sourceTitle).toLocaleLowerCase()
    && !invariantTitle(localized)
  ) return false;
  if (invariantTitle(localized)) return true;
  const purity = validateAiUnitLocalePurity(localized, options.targetLocale, {
    kind: 'summary_sentence',
    requireUnits: true,
  });
  if (purity.wrongScriptUnitCount > 0 || purity.sourceLanguageLeakageDetected) return false;
  const detected = asLocale(detectTextLocale(localized, { storedLocale: options.targetLocale }));
  return purity.targetLocalePurityPassed
    || detected === options.targetLocale
    || detected === null;
}

function fieldRefs(cv: CVData, targetLocale: Locale): TitleFieldRef[] {
  const refs: TitleFieldRef[] = [];
  const header = canonical(cv.personal?.jobTitle || '');
  if (header) {
    const current = (cv.experience || []).find((exp) => exp.isPresent)
      || (cv.experience || [])[0];
    refs.push({
      fieldKey: 'personal.jobTitle',
      kind: 'personal_job_title',
      sourceTitle: header,
      sourceLocale: localeForHeader(cv, targetLocale),
      employer: current?.company || '',
      employmentState: current?.isPresent ? 'present' : 'completed',
    });
  }
  for (const exp of cv.experience || []) {
    const title = canonical(exp.position || '');
    if (!title) continue;
    refs.push({
      fieldKey: `experience.${exp.id}.position`,
      kind: 'experience_position',
      experienceId: exp.id,
      sourceTitle: title,
      sourceLocale: localeForExperience(cv, exp, targetLocale),
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
}): Promise<PrepareExportLocalizedTitlesResult> {
  const gender = String(options.gender || '');
  const refs = fieldRefs(options.sourceCv, options.targetLocale);
  const units = buildUnits(refs, options.targetLocale, gender);
  const store = usableStore(options.sourceCv);
  const activeSourceHashes = new Set(units.map((unit) => hashText(unit.sourceTitle)));
  const nextSurfaces = Object.fromEntries(
    Object.entries(store.surfaces).filter(([, surface]) => (
      activeSourceHashes.has(surface.sourceTitleHash)
    )),
  );
  const localizedByUnit = new Map<string, string>();
  const sourceLocaleByField = Object.fromEntries(refs.map((ref) => [ref.fieldKey, ref.sourceLocale]));
  let sameLocaleCount = 0;
  let deterministicCount = 0;
  let cacheReuseCount = 0;
  let providerRequestCount = 0;
  let providerRepairCount = 0;
  const missing: TitleUnit[] = [];
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

  for (let offset = 0; offset < missing.length; offset += CV_EXPORT_TITLE_PROVIDER_BATCH_SIZE) {
    const batch = missing.slice(offset, offset + CV_EXPORT_TITLE_PROVIDER_BATCH_SIZE);
    let accepted: SummaryV2LocalizationProviderResponse | null = null;
    for (let pass = 0; pass < 2 && !accepted; pass += 1) {
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
      } catch {
        continue;
      }
      const actualById = new Map((response.entries || []).map((entry) => [entry.entryId, entry]));
      const valid = response.targetLocale === options.targetLocale
        && actualById.size === batch.length
        && batch.every((unit) => {
          const entry = actualById.get(unit.entryId);
          return Boolean(
            entry
            && Array.isArray(entry.facts)
            && entry.facts.length === 0
            && validLocalizedTitle({
              sourceTitle: unit.sourceTitle,
              sourceLocale: unit.sourceLocale,
              targetLocale: options.targetLocale,
              localizedTitle: entry.localizedRoleTitle,
            }),
          );
        });
      if (valid) accepted = response;
    }
    if (!accepted) {
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
        titleLocalizedFieldCount: 0,
        titleSummaryMentionReplacementCount: 0,
        titleSourceLocaleByField: sourceLocaleByField,
        titleProjectionPassed: false,
        employerIdentityPassed: false,
        titleFailureReason: 'export_title_localization_provider_failed',
      };
      return {
        ok: false,
        exportCv: options.exportCv,
        persistableCv: options.sourceCv,
        reason: 'export_title_localization_provider_failed',
        diagnostics,
      };
    }
    const acceptedById = new Map(accepted.entries.map((entry) => [entry.entryId, entry]));
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
      titleLocalizedFieldCount: 0,
      titleSummaryMentionReplacementCount: 0,
      titleSourceLocaleByField: sourceLocaleByField,
      titleProjectionPassed: false,
      employerIdentityPassed: false,
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
    titleLocalizedFieldCount: localizedByField.size,
    titleSummaryMentionReplacementCount,
    titleSourceLocaleByField: sourceLocaleByField,
    titleProjectionPassed,
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
