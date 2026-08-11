import type { Locale } from '@/lib/i18n/translations';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { detectUnresolvedGenderPlaceholder } from './gender';
import { analyzeSpanishCoordinatedPredicateMorphology } from './native-surface';
import { dutyTokenStems, hashSummaryV2Text } from './facts';
import { localesAreDetectionCompatible } from './locale-authority';
import type { SummaryV2EntryOwned, SummaryV2SelectionManifest } from './types';

export const SUMMARY_V2_LOCALIZED_MANIFEST_REVISION =
  'summary-v2-localized-manifest-417-v1' as const;

export type SummaryV2LocalizationSource =
  | 'same_locale_authoritative'
  | 'provider'
  | 'provider_repair'
  | 'validated_cache'
  | 'summary_provider_recovery'
  | 'mixed_authoritative';

export type SummaryV2LocalizedFact = {
  factId: string;
  entryId: string;
  sourceLocale: Locale;
  sourceTextHash: string;
  localizedText: string;
  localizedTextHash: string;
  localizationSource: SummaryV2LocalizationSource;
  localizationValidationResult: 'passed';
};

export type SummaryV2LocalizedEntry = {
  entryId: string;
  sourceLocale: Locale;
  localizedRoleTitle: string;
  localizedRoleTitleHash: string;
  employer: string;
  employmentState: 'present' | 'completed';
  facts: SummaryV2LocalizedFact[];
};

export type SummaryV2LocalizedManifest = {
  revision: typeof SUMMARY_V2_LOCALIZED_MANIFEST_REVISION;
  sourceManifestHash: string;
  targetLocale: Locale;
  gender: string;
  localizationSource: SummaryV2LocalizationSource;
  localizationRepairAttempted: boolean;
  localizationRepairAccepted: boolean;
  entries: SummaryV2LocalizedEntry[];
  localizedManifestHash: string;
};

export type SummaryV2LocalizationProviderResponse = {
  targetLocale: string;
  entries: Array<{
    entryId: string;
    localizedRoleTitle: string;
    facts: Array<{ factId: string; localizedText: string }>;
  }>;
};

export function parseSummaryV2LocalizationProviderJson(
  raw: string,
): SummaryV2LocalizationProviderResponse | null {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '');
  try {
    const value = JSON.parse(cleaned) as SummaryV2LocalizationProviderResponse;
    if (!value || typeof value !== 'object' || typeof value.targetLocale !== 'string') return null;
    if (!Array.isArray(value.entries)) return null;
    if (value.entries.some((entry) => (
      !entry
      || typeof entry.entryId !== 'string'
      || typeof entry.localizedRoleTitle !== 'string'
      || !Array.isArray(entry.facts)
      || entry.facts.some((fact) => (
        !fact || typeof fact.factId !== 'string' || typeof fact.localizedText !== 'string'
      ))
    ))) return null;
    return value;
  } catch {
    return null;
  }
}

export type SummaryV2LocalizationValidation = {
  ok: boolean;
  reason: string | null;
  expectedEntryCount: number;
  localizedEntryCount: number;
  expectedFactCount: number;
  localizedFactCount: number;
  entryIdParityPassed: boolean;
  factIdParityPassed: boolean;
  factOwnershipParityPassed: boolean;
  targetLocalePurityPassed: boolean;
  targetScriptPurityPassed: boolean;
  sourceLanguageLeakageDetected: boolean;
};

const UNSUPPORTED_MATERIAL_RE = /\b(?:increased|improved|boosted|achieved|led|managed a team|certified|awarded)\b|\d+\s*%/iu;

function selectedEntries(manifest: SummaryV2SelectionManifest): SummaryV2EntryOwned[] {
  return [...(manifest.current ? [manifest.current] : []), ...manifest.priors];
}

function normalizedHash(text: string): string {
  return hashSummaryV2Text((text || '').replace(/\s+/g, ' ').trim());
}

function duplicate(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export function validateSummaryV2LocalizationResponse(
  manifest: SummaryV2SelectionManifest,
  response: SummaryV2LocalizationProviderResponse,
): SummaryV2LocalizationValidation {
  const expectedEntries = selectedEntries(manifest);
  const expectedEntryIds = expectedEntries.map((entry) => entry.entryId);
  const actualEntries = Array.isArray(response?.entries) ? response.entries : [];
  const actualEntryIds = actualEntries.map((entry) => String(entry?.entryId || ''));
  const expectedFacts = [...manifest.requiredCurrentFacts, ...manifest.requiredPriorFacts];
  const expectedFactOwner = new Map(expectedFacts.map((fact) => [fact.factId, fact.entryId]));
  const actualFacts = actualEntries.flatMap((entry) => (
    Array.isArray(entry?.facts)
      ? entry.facts.map((fact) => ({ ...fact, entryId: String(entry.entryId || '') }))
      : []
  ));
  const actualFactIds = actualFacts.map((fact) => String(fact?.factId || ''));
  const entryIdParityPassed = !duplicate(actualEntryIds)
    && expectedEntryIds.length === actualEntryIds.length
    && expectedEntryIds.every((id) => actualEntryIds.includes(id))
    && actualEntryIds.every((id) => expectedEntryIds.includes(id));
  const factIdParityPassed = !duplicate(actualFactIds)
    && expectedFacts.length === actualFacts.length
    && expectedFacts.every((fact) => actualFactIds.includes(fact.factId))
    && actualFactIds.every((id) => expectedFactOwner.has(id));
  const factOwnershipParityPassed = factIdParityPassed && actualFacts.every(
    (fact) => expectedFactOwner.get(String(fact.factId || '')) === fact.entryId,
  );
  const targetLocaleMatches = response?.targetLocale === manifest.locale;
  let targetLocalePurityPassed = targetLocaleMatches;
  let targetScriptPurityPassed = targetLocaleMatches;
  let sourceLanguageLeakageDetected = false;
  let surfaceComplete = true;
  let unsupportedMaterial = false;
  let mixedPredicateMorphology = false;
  const sourceEntriesById = new Map(expectedEntries.map((entry) => [entry.entryId, entry]));

  for (const entry of actualEntries) {
    const sourceEntry = sourceEntriesById.get(entry.entryId);
    if (
      sourceEntry
      && !localesAreDetectionCompatible(sourceEntry.sourceLocale, manifest.locale)
      && entry.localizedRoleTitle.trim().toLocaleLowerCase() === sourceEntry.role.trim().toLocaleLowerCase()
    ) sourceLanguageLeakageDetected = true;
    const surfaces = [entry.localizedRoleTitle, ...(entry.facts || []).map((f) => f.localizedText)];
    const sourceFactsById = new Map((sourceEntry?.facts || []).map((fact) => [fact.factId, fact]));
    for (const fact of entry.facts || []) {
      const sourceFact = sourceFactsById.get(fact.factId);
      if (
        sourceFact
        && !localesAreDetectionCompatible(sourceFact.sourceLocale, manifest.locale)
        && fact.localizedText.trim().toLocaleLowerCase() === sourceFact.bulletText.trim().toLocaleLowerCase()
      ) sourceLanguageLeakageDetected = true;
    }
    for (const surface of surfaces) {
      const text = String(surface || '').trim();
      if (!text || detectUnresolvedGenderPlaceholder(text)) surfaceComplete = false;
      if (UNSUPPORTED_MATERIAL_RE.test(text)) unsupportedMaterial = true;
      const purity = validateAiUnitLocalePurity(text, manifest.locale, {
        kind: 'summary_sentence', requireUnits: true,
      });
      targetLocalePurityPassed = targetLocalePurityPassed && purity.targetLocalePurityPassed;
      targetScriptPurityPassed = targetScriptPurityPassed && purity.wrongScriptUnitCount === 0;
      sourceLanguageLeakageDetected = sourceLanguageLeakageDetected
        || purity.sourceLanguageLeakageDetected;
      if (manifest.locale === 'es') {
        const morphology = analyzeSpanishCoordinatedPredicateMorphology(text);
        mixedPredicateMorphology = mixedPredicateMorphology
          || morphology.mixedPersonPredicateChain
          || morphology.mixedTensePredicateChain;
      }
    }
  }

  let reason: string | null = null;
  if (!targetLocaleMatches) reason = 'localization_wrong_target_locale';
  else if (!entryIdParityPassed) reason = 'localization_entry_id_parity_failed';
  else if (!factIdParityPassed) reason = 'localization_fact_id_parity_failed';
  else if (!factOwnershipParityPassed) reason = 'localization_fact_ownership_failed';
  else if (!surfaceComplete) reason = 'localization_incomplete_surface';
  else if (unsupportedMaterial) reason = 'localization_unsupported_material_claim';
  else if (mixedPredicateMorphology) reason = 'mixed_person_predicate_chain';
  else if (!targetScriptPurityPassed) reason = 'localization_wrong_script';
  else if (!targetLocalePurityPassed || sourceLanguageLeakageDetected) reason = 'locale_impurity';

  return {
    ok: reason === null,
    reason,
    expectedEntryCount: expectedEntries.length,
    localizedEntryCount: actualEntries.length,
    expectedFactCount: expectedFacts.length,
    localizedFactCount: actualFacts.length,
    entryIdParityPassed,
    factIdParityPassed,
    factOwnershipParityPassed,
    targetLocalePurityPassed,
    targetScriptPurityPassed,
    sourceLanguageLeakageDetected,
  };
}

export function acceptSummaryV2LocalizationResponse(options: {
  manifest: SummaryV2SelectionManifest;
  response: SummaryV2LocalizationProviderResponse;
  source: SummaryV2LocalizationSource;
}): { manifest: SummaryV2LocalizedManifest | null; validation: SummaryV2LocalizationValidation } {
  const validation = validateSummaryV2LocalizationResponse(options.manifest, options.response);
  const sameLocaleAuthoritative = options.source === 'same_locale_authoritative'
    && selectedEntries(options.manifest).every((entry) => entry.sourceLocale === options.manifest.locale);
  const effectiveValidation = sameLocaleAuthoritative
    && validation.entryIdParityPassed
    && validation.factIdParityPassed
    && validation.factOwnershipParityPassed
    ? {
      ...validation,
      ok: true,
      reason: null,
      targetLocalePurityPassed: true,
      targetScriptPurityPassed: true,
      sourceLanguageLeakageDetected: false,
    }
    : validation;
  if (!effectiveValidation.ok) return { manifest: null, validation: effectiveValidation };
  const sourceEntries = new Map(selectedEntries(options.manifest).map((entry) => [entry.entryId, entry]));
  const entries: SummaryV2LocalizedEntry[] = options.response.entries.map((entry) => {
    const sourceEntry = sourceEntries.get(entry.entryId)!;
    const sourceFacts = new Map(sourceEntry.facts.map((fact) => [fact.factId, fact]));
    return {
      entryId: sourceEntry.entryId,
      sourceLocale: sourceEntry.sourceLocale,
      localizedRoleTitle: entry.localizedRoleTitle.trim(),
      localizedRoleTitleHash: normalizedHash(entry.localizedRoleTitle),
      employer: sourceEntry.employer,
      employmentState: sourceEntry.employmentState,
      facts: entry.facts.map((fact) => {
        const sourceFact = sourceFacts.get(fact.factId)!;
        return {
          factId: sourceFact.factId,
          entryId: sourceEntry.entryId,
          sourceLocale: sourceFact.sourceLocale,
          sourceTextHash: sourceFact.sourceFactHash,
          localizedText: fact.localizedText.trim(),
          localizedTextHash: normalizedHash(fact.localizedText),
          localizationSource: options.source,
          localizationValidationResult: 'passed' as const,
        };
      }),
    };
  });
  const material = entries.flatMap((entry) => [
    entry.entryId, entry.sourceLocale, entry.localizedRoleTitleHash, entry.employer,
    ...entry.facts.flatMap((fact) => [fact.factId, fact.sourceTextHash, fact.localizedTextHash]),
  ]).join('|');
  return {
    validation: effectiveValidation,
    manifest: {
      revision: SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
      sourceManifestHash: options.manifest.snapshotHash,
      targetLocale: options.manifest.locale,
      gender: options.manifest.gender,
      localizationSource: options.source,
      localizationRepairAttempted: options.source === 'provider_repair',
      localizationRepairAccepted: options.source === 'provider_repair',
      entries,
      localizedManifestHash: normalizedHash(material),
    },
  };
}

export function buildSameLocaleLocalizedManifest(
  manifest: SummaryV2SelectionManifest,
): SummaryV2LocalizedManifest | null {
  const entries = selectedEntries(manifest);
  // Detection compatibility (for example sr/hr) is not localization authority:
  // only an exact source/target locale match may bypass structured localization.
  if (entries.some((entry) => entry.sourceLocale !== manifest.locale)) {
    return null;
  }
  const response: SummaryV2LocalizationProviderResponse = {
    targetLocale: manifest.locale,
    entries: entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle: entry.role,
      facts: entry.facts.slice(0, 3).map((fact) => ({
        factId: fact.factId,
        localizedText: fact.bulletText,
      })),
    })),
  };
  return acceptSummaryV2LocalizationResponse({
    manifest, response, source: 'same_locale_authoritative',
  }).manifest;
}

export function projectLocalizedSummaryV2Manifest(options: {
  manifest: SummaryV2SelectionManifest;
  localized: SummaryV2LocalizedManifest;
}): SummaryV2SelectionManifest | null {
  if (
    options.localized.sourceManifestHash !== options.manifest.snapshotHash
    || options.localized.targetLocale !== options.manifest.locale
  ) return null;
  const localizedEntries = new Map(options.localized.entries.map((entry) => [entry.entryId, entry]));
  const projectEntry = (entry: SummaryV2EntryOwned): SummaryV2EntryOwned | null => {
    const localized = localizedEntries.get(entry.entryId);
    if (!localized || localized.employer !== entry.employer) return null;
    const localizedFacts = new Map(localized.facts.map((fact) => [fact.factId, fact]));
    const facts = entry.facts.map((fact) => {
      const localizedFact = localizedFacts.get(fact.factId);
      if (!localizedFact || localizedFact.entryId !== entry.entryId) return null;
      return {
        ...fact,
        bulletText: localizedFact.localizedText,
        tokenStems: dutyTokenStems(localizedFact.localizedText),
      };
    });
    if (facts.some((fact) => fact === null)) return null;
    return { ...entry, role: localized.localizedRoleTitle, facts: facts as SummaryV2EntryOwned['facts'] };
  };
  const current = options.manifest.current ? projectEntry(options.manifest.current) : null;
  const priors = options.manifest.priors.map(projectEntry);
  if ((options.manifest.current && !current) || priors.some((entry) => !entry)) return null;
  const all = [...(current ? [current] : []), ...(priors as SummaryV2EntryOwned[])];
  const byId = new Map(all.map((entry) => [entry.entryId, entry]));
  const requiredCurrentFacts = options.manifest.requiredCurrentFacts.map((fact) => (
    byId.get(fact.entryId)?.facts.find((candidate) => candidate.factId === fact.factId)
  )).filter(Boolean) as SummaryV2SelectionManifest['requiredCurrentFacts'];
  const requiredPriorFacts = options.manifest.requiredPriorFacts.map((fact) => (
    byId.get(fact.entryId)?.facts.find((candidate) => candidate.factId === fact.factId)
  )).filter(Boolean) as SummaryV2SelectionManifest['requiredPriorFacts'];
  if (
    requiredCurrentFacts.length !== options.manifest.requiredCurrentFacts.length
    || requiredPriorFacts.length !== options.manifest.requiredPriorFacts.length
  ) return null;
  return { ...options.manifest, current, priors: priors as SummaryV2EntryOwned[], requiredCurrentFacts, requiredPriorFacts };
}

export type SummaryV2ProviderExperienceEntry = {
  id: string;
  position: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
  isPresent: boolean;
  sourceLocale: Locale;
};

/**
 * Provider input must be the same localized, entry-owned manifest later used by
 * finalization. This prevents the Summary provider from receiving Hindi/Serbian/
 * English text after a target-locale manifest has already been accepted.
 */
export function buildSummaryV2ProviderExperienceEntries(options: {
  manifest: SummaryV2SelectionManifest;
  localized: SummaryV2LocalizedManifest;
}): SummaryV2ProviderExperienceEntry[] | null {
  const projected = projectLocalizedSummaryV2Manifest(options);
  if (!projected) return null;
  const required = [...projected.requiredCurrentFacts, ...projected.requiredPriorFacts];
  const selected = [...(projected.current ? [projected.current] : []), ...projected.priors];
  return selected.map((entry) => ({
    id: entry.entryId,
    position: entry.role,
    company: entry.employer,
    startDate: entry.startDate,
    endDate: entry.isPresent ? 'present' : entry.endDate,
    description: required
      .filter((fact) => fact.entryId === entry.entryId)
      .map((fact) => `• ${fact.bulletText.replace(/^[•\-*]\s*/u, '').trim()}`)
      .join('\n'),
    isPresent: entry.isPresent,
    sourceLocale: projected.locale,
  }));
}
