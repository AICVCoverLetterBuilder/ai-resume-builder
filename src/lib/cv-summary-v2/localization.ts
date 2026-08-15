import type { Locale } from '@/lib/i18n/translations';
import {
  detectAiContentScript,
  guessUnitLocale,
  validateAiUnitLocalePurity,
  type AiContentScript,
} from '@/lib/cv-ai-unit-locale-purity';
import { detectUnresolvedGenderPlaceholder } from './gender';
import { analyzeSpanishCoordinatedPredicateMorphology } from './native-surface';
import { dutyTokenStems, hashSummaryV2Text } from './facts';
import { detectDominantLocale, localesAreDetectionCompatible } from './locale-authority';
import type { SummaryV2EntryOwned, SummaryV2SelectionManifest } from './types';

export const SUMMARY_V2_LOCALIZED_MANIFEST_REVISION =
  'summary-v2-localized-manifest-419-v1' as const;

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
  sourceRoleTitleHash: string;
  localizedRoleTitleLocalizationSource: SummaryV2LocalizationSource;
  localizedRoleTitleValidationResult: 'passed';
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
  /** Privacy-safe first failing surface. Raw role/fact text is never retained. */
  failureEvidence: SummaryV2LocalizationFailureEvidence | null;
  protectedEntityTokenClasses: SummaryV2ProtectedEntityTokenClass[];
};

export type SummaryV2ProtectedEntityTokenClass =
  | 'employer_entity'
  | 'technical_acronym'
  | 'structured_identifier'
  | 'structured_date'
  | 'proper_noun_entity';

export type SummaryV2LocalizationFailureEvidence = {
  entryId: string;
  factId: string | null;
  surfaceKind: 'localized_role_title' | 'localized_fact';
  textPreviewHash: string;
  detectedLocale: string | null;
  detectedScript: AiContentScript;
  tokenClass:
    | 'translatable_surface_wrong_script'
    | 'translatable_surface_wrong_locale'
    | 'translatable_surface_incomplete';
  protectedEntityTokenClasses: SummaryV2ProtectedEntityTokenClass[];
};

type LocalizationValidationOptions = {
  /** Per-entry accepted authority must survive mixed-manifest assembly. */
  sourceByEntryId?: Partial<Record<string, SummaryV2LocalizationSource>>;
  roleSourceByEntryId?: Partial<Record<string, SummaryV2LocalizationSource>>;
  factSourceByFactId?: Partial<Record<string, SummaryV2LocalizationSource>>;
};

const UNSUPPORTED_MATERIAL_RE = /\b(?:increased|improved|boosted|achieved|led|managed a team|certified|awarded)\b|\d+\s*%/iu;
const STRUCTURED_DATE_TOKEN_RE = /^(?:19|20|21|22)\d{2}(?:[-/.](?:0?[1-9]|1[0-2]))?(?:[-/.](?:0?[1-9]|[12]\d|3[01]))?$/u;
const TECHNICAL_ACRONYM_TOKEN_RE = /^(?=.*[\p{Lu}])[\p{Lu}\d][\p{Lu}\d.+#&/_-]{1,}$/u;
const STRUCTURED_IDENTIFIER_TOKEN_RE = /^(?=.*(?:\d|[@+/#_]))[\p{L}\p{N}][\p{L}\p{N}.@+/#_-]{1,}$/u;
const TOKEN_RE = /[\p{L}\p{N}][\p{L}\p{N}.@+/#&'â€™_-]*/gu;

function selectedEntries(manifest: SummaryV2SelectionManifest): SummaryV2EntryOwned[] {
  return [...(manifest.current ? [manifest.current] : []), ...manifest.priors];
}

function normalizedHash(text: string): string {
  return hashSummaryV2Text((text || '').replace(/\s+/g, ' ').trim());
}

function duplicate(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function protectedEntityTokens(options: {
  employer: string;
  sourceSurface: string;
  protectSourceProperNouns?: boolean;
}): Array<{ token: string; tokenClass: SummaryV2ProtectedEntityTokenClass }> {
  const values = new Map<string, SummaryV2ProtectedEntityTokenClass>();
  const add = (token: string, tokenClass: SummaryV2ProtectedEntityTokenClass) => {
    const normalized = token.trim();
    if (normalized.length >= 2) values.set(normalized.toLocaleLowerCase(), tokenClass);
  };
  for (const token of options.employer.match(TOKEN_RE) || []) add(token, 'employer_entity');
  for (const token of options.sourceSurface.match(TOKEN_RE) || []) {
    if (STRUCTURED_DATE_TOKEN_RE.test(token)) add(token, 'structured_date');
    else if (TECHNICAL_ACRONYM_TOKEN_RE.test(token)) add(token, 'technical_acronym');
    else if (STRUCTURED_IDENTIFIER_TOKEN_RE.test(token)) add(token, 'structured_identifier');
    else if (
      options.protectSourceProperNouns
      && options.sourceSurface.trim() === token
      && /^\p{Lu}[\p{L}\p{M}'’.-]+$/u.test(token)
    ) {
      add(token, 'proper_noun_entity');
    }
  }
  return [...values].map(([token, tokenClass]) => ({ token, tokenClass }));
}

export function inspectSummaryV2TranslatableSurface(options: {
  localizedText: string;
  sourceText: string;
  employer: string;
  targetLocale: Locale;
  protectSourceProperNouns?: boolean;
}): {
  localized: string;
  source: string;
  protectedClasses: SummaryV2ProtectedEntityTokenClass[];
  detectedLocale: string | null;
  detectedScript: AiContentScript;
  targetLocaleNativeSurfacePassed: boolean;
} {
  const protectedTokens = protectedEntityTokens({
    employer: options.employer,
    sourceSurface: options.sourceText,
    protectSourceProperNouns: options.protectSourceProperNouns,
  });
  const strip = (text: string) => protectedTokens.reduce((value, protectedToken) => (
    value.replace(
      new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(protectedToken.token)}(?![\\p{L}\\p{N}_])`, 'giu'),
      ' ',
    )
  ), text).replace(/\s+/g, ' ').trim();
  const localized = strip(options.localizedText);
  const source = strip(options.sourceText);
  const purity = validateAiUnitLocalePurity(localized, options.targetLocale, {
    kind: 'summary_sentence', requireUnits: source.length > 0,
  });
  return {
    localized,
    source,
    protectedClasses: [...new Set(protectedTokens
      .filter(({ token }) => new RegExp(
        `(?<![\\p{L}\\p{N}_])${escapeRegExp(token)}(?![\\p{L}\\p{N}_])`,
        'iu',
      ).test(options.localizedText))
      .map(({ tokenClass }) => tokenClass))],
    detectedLocale: guessUnitLocale(localized, options.targetLocale),
    detectedScript: detectAiContentScript(localized),
    targetLocaleNativeSurfacePassed: (!source && !localized)
      || (Boolean(localized)
        && purity.targetLocalePurityPassed
        && purity.wrongScriptUnitCount === 0),
  };
}

function scriptIsNativeForLocale(script: AiContentScript, locale: Locale): boolean {
  if (script === 'unknown') return false;
  if (locale === 'ar') return script === 'arabic';
  if (locale === 'hi') return script === 'devanagari';
  if (locale === 'ja') return script === 'cjk';
  if (locale === 'ru') return script === 'cyrillic';
  if (locale === 'sr') return script === 'latin' || script === 'latin_diacritic_sc' || script === 'cyrillic';
  if (locale === 'hr') return script === 'latin' || script === 'latin_diacritic_sc';
  return script === 'latin' || script === 'latin_diacritic_sc';
}

export type SummaryV2EntrySurfaceAuthority = {
  entryId: string;
  roleTitleTargetNative: boolean;
  roleTitleAuthority: SummaryV2SurfaceAuthorityState;
  targetNativeFactIds: string[];
  localizationRequiredFactIds: string[];
  uncertainFactIds: string[];
  allTranslatableSurfacesTargetNative: boolean;
};

export type SummaryV2SurfaceAuthorityState =
  | 'target_native_authoritative'
  | 'foreign_localization_required'
  | 'uncertain_rejected';

export type SummaryV2EntrySurfaceTransportPlan = {
  revision: 'summary-v2-surface-transport-plan-420-v1';
  entryId: string;
  entryHash: string;
  aggregateSourceLocale: Locale;
  targetLocale: Locale;
  role: {
    sourceHash: string;
    authority: SummaryV2SurfaceAuthorityState;
  };
  facts: Array<{
    factId: string;
    sourceHash: string;
    authority: SummaryV2SurfaceAuthorityState;
  }>;
  roleSurfaceCount: number;
  factSurfaceCount: number;
  bypassedSurfaceCount: number;
  protectedSurfaceCount: number;
};

function decideSurfaceAuthority(options: {
  surface: ReturnType<typeof inspectSummaryV2TranslatableSurface>;
  sourceLocale: Locale;
  targetLocale: Locale;
  presentationTrusted?: boolean;
  presentationLocale?: Locale;
}): SummaryV2SurfaceAuthorityState {
  if (!options.surface.source.trim() && !options.surface.localized.trim()) {
    return 'target_native_authoritative';
  }
  if (!/[\p{L}\p{M}]/u.test(options.surface.source)) return 'uncertain_rejected';
  // A provenance/hash-matched AI surface is presentation only: its immutable
  // source locale still owns the fact, while the visible surface may bypass
  // translation only when the actual text is native to the requested locale.
  // Never trust the locale label without inspecting the visible text/script.
  if (options.presentationTrusted) {
    const nativePresentation = options.presentationLocale === options.targetLocale
      && options.surface.targetLocaleNativeSurfacePassed
      && scriptIsNativeForLocale(options.surface.detectedScript, options.targetLocale);
    return nativePresentation
      ? 'target_native_authoritative'
      : 'foreign_localization_required';
  }
  const detected = detectDominantLocale(options.surface.source);
  const sourceCompatible = options.sourceLocale === options.targetLocale;
  const detectedForeign = detected.confidence === 'high'
    && Boolean(detected.locale)
    && !localesAreDetectionCompatible(detected.locale, options.targetLocale);
  if (detectedForeign) return 'foreign_localization_required';
  const detectedTarget = detected.confidence === 'high'
    && Boolean(detected.locale)
    && detected.locale === options.targetLocale;
  if (detectedTarget && options.surface.targetLocaleNativeSurfacePassed) {
    return 'target_native_authoritative';
  }
  if (
    options.surface.detectedScript !== 'unknown'
    && !scriptIsNativeForLocale(options.surface.detectedScript, options.targetLocale)
  ) return 'foreign_localization_required';
  if (options.surface.targetLocaleNativeSurfacePassed && sourceCompatible) {
    return 'target_native_authoritative';
  }
  if (sourceCompatible && scriptIsNativeForLocale(
    options.surface.detectedScript,
    options.targetLocale,
  )) return 'target_native_authoritative';
  if (!sourceCompatible) return 'foreign_localization_required';
  if (options.surface.targetLocaleNativeSurfacePassed) return 'target_native_authoritative';
  return 'uncertain_rejected';
}

/** Surface-level authority: employers/IDs are protected; roles and duties are linguistic. */
export function classifySummaryV2EntrySurfaceAuthority(options: {
  manifest: SummaryV2SelectionManifest;
  entry: SummaryV2EntryOwned;
}): SummaryV2EntrySurfaceAuthority {
  const required = [...options.manifest.requiredCurrentFacts, ...options.manifest.requiredPriorFacts]
    .filter((fact) => fact.entryId === options.entry.entryId);
  const presentationRole = options.entry.presentationRoleTrusted
    && options.entry.presentationRole
    ? options.entry.presentationRole
    : options.entry.role;
  const role = inspectSummaryV2TranslatableSurface({
    localizedText: presentationRole,
    sourceText: options.entry.role,
    employer: options.entry.employer,
    targetLocale: options.manifest.locale,
  });
  const roleAuthority = decideSurfaceAuthority({
    surface: role,
    sourceLocale: options.entry.roleSourceLocale || options.entry.sourceLocale,
    targetLocale: options.manifest.locale,
    presentationTrusted: options.entry.presentationRoleTrusted === true,
    presentationLocale: options.entry.presentationRoleLocale,
  });
  const facts = required.map((fact) => {
    const presentationText = fact.presentationTrusted && fact.presentationText
      ? fact.presentationText
      : fact.bulletText;
    const surface = inspectSummaryV2TranslatableSurface({
      localizedText: presentationText,
      sourceText: fact.bulletText,
      employer: options.entry.employer,
      targetLocale: options.manifest.locale,
      protectSourceProperNouns: true,
    });
    return {
      factId: fact.factId,
      authority: decideSurfaceAuthority({
        surface,
        sourceLocale: fact.sourceLocale,
        targetLocale: options.manifest.locale,
        presentationTrusted: fact.presentationTrusted === true,
        presentationLocale: fact.presentationLocale,
      }),
    };
  });
  return {
    entryId: options.entry.entryId,
    roleTitleTargetNative: roleAuthority === 'target_native_authoritative',
    roleTitleAuthority: roleAuthority,
    targetNativeFactIds: facts.filter((fact) => fact.authority === 'target_native_authoritative').map((fact) => fact.factId),
    localizationRequiredFactIds: facts.filter((fact) => fact.authority === 'foreign_localization_required').map((fact) => fact.factId),
    uncertainFactIds: facts.filter((fact) => fact.authority === 'uncertain_rejected').map((fact) => fact.factId),
    allTranslatableSurfacesTargetNative: roleAuthority === 'target_native_authoritative'
      && facts.every((fact) => fact.authority === 'target_native_authoritative'),
  };
}

/**
 * Immutable, source-ID-bound transport authority. Aggregate entry locale is
 * deliberately recorded for diagnostics only; it never decides a sibling
 * role/fact surface.
 */
export function buildSummaryV2EntrySurfaceTransportPlan(options: {
  manifest: SummaryV2SelectionManifest;
  entry: SummaryV2EntryOwned;
}): SummaryV2EntrySurfaceTransportPlan {
  const authority = classifySummaryV2EntrySurfaceAuthority(options);
  const required = [...options.manifest.requiredCurrentFacts, ...options.manifest.requiredPriorFacts]
    .filter((fact) => fact.entryId === options.entry.entryId);
  const roleAuthority = authority.roleTitleAuthority;
  const facts = required.map((fact) => ({
    factId: fact.factId,
    sourceHash: fact.sourceFactHash,
    authority: (authority.targetNativeFactIds.includes(fact.factId)
      ? 'target_native_authoritative'
      : authority.localizationRequiredFactIds.includes(fact.factId)
        ? 'foreign_localization_required'
        : 'uncertain_rejected') as SummaryV2SurfaceAuthorityState,
  }));
  const roleSurfaceCount = roleAuthority === 'foreign_localization_required' ? 1 : 0;
  const factSurfaceCount = facts.filter((fact) => fact.authority === 'foreign_localization_required').length;
  return {
    revision: 'summary-v2-surface-transport-plan-420-v1',
    entryId: options.entry.entryId,
    entryHash: normalizedHash(options.entry.entryId),
    aggregateSourceLocale: options.entry.sourceLocale,
    targetLocale: options.manifest.locale,
    role: { sourceHash: normalizedHash(options.entry.role), authority: roleAuthority },
    facts,
    roleSurfaceCount,
    factSurfaceCount,
    bypassedSurfaceCount: 1 + facts.length - roleSurfaceCount - factSurfaceCount,
    protectedSurfaceCount: options.entry.employer.trim() ? 1 : 0,
  };
}

export function validateSummaryV2LocalizationResponse(
  manifest: SummaryV2SelectionManifest,
  response: SummaryV2LocalizationProviderResponse,
  options: LocalizationValidationOptions = {},
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
  let incompleteEvidence: SummaryV2LocalizationFailureEvidence | null = null;
  let wrongScriptEvidence: SummaryV2LocalizationFailureEvidence | null = null;
  let wrongLocaleEvidence: SummaryV2LocalizationFailureEvidence | null = null;
  const protectedEntityTokenClasses = new Set<SummaryV2ProtectedEntityTokenClass>();
  const sourceEntriesById = new Map(expectedEntries.map((entry) => [entry.entryId, entry]));
  const authorityByEntryId = new Map(expectedEntries.map((entry) => [
    entry.entryId,
    buildSummaryV2EntrySurfaceTransportPlan({ manifest, entry }),
  ]));

  for (const entry of actualEntries) {
    const sourceEntry = sourceEntriesById.get(entry.entryId);
    const sourceFactsById = new Map((sourceEntry?.facts || []).map((fact) => [fact.factId, fact]));
    const surfaces = [
      {
        text: entry.localizedRoleTitle,
        sourceText: sourceEntry?.role || '',
        presentationText: sourceEntry?.presentationRole,
        presentationTrusted: sourceEntry?.presentationRoleTrusted === true,
        presentationLocale: sourceEntry?.presentationRoleLocale || null,
        sourceLocale: sourceEntry?.roleSourceLocale || sourceEntry?.sourceLocale || null,
        factId: null,
        surfaceKind: 'localized_role_title' as const,
      },
      ...(entry.facts || []).map((fact) => ({
        text: fact.localizedText,
        sourceText: sourceFactsById.get(fact.factId)?.bulletText || '',
        presentationText: sourceFactsById.get(fact.factId)?.presentationText,
        presentationTrusted: sourceFactsById.get(fact.factId)?.presentationTrusted === true,
        presentationLocale: sourceFactsById.get(fact.factId)?.presentationLocale || null,
        sourceLocale: sourceFactsById.get(fact.factId)?.sourceLocale || null,
        factId: fact.factId,
        surfaceKind: 'localized_fact' as const,
      })),
    ];
    for (const surface of surfaces) {
      const text = String(surface.text || '').trim();
      if (!text || detectUnresolvedGenderPlaceholder(text)) {
        surfaceComplete = false;
        incompleteEvidence ||= {
          entryId: entry.entryId,
          factId: surface.factId,
          surfaceKind: surface.surfaceKind,
          textPreviewHash: normalizedHash(text || 'empty'),
          detectedLocale: null,
          detectedScript: 'unknown',
          tokenClass: 'translatable_surface_incomplete',
          protectedEntityTokenClasses: [],
        };
      }
      if (UNSUPPORTED_MATERIAL_RE.test(text)) unsupportedMaterial = true;
      const translatable = inspectSummaryV2TranslatableSurface({
        localizedText: text,
        sourceText: surface.sourceText,
        employer: sourceEntry?.employer || '',
        targetLocale: manifest.locale,
        protectSourceProperNouns: surface.surfaceKind === 'localized_fact',
      });
      translatable.protectedClasses.forEach((tokenClass) => protectedEntityTokenClasses.add(tokenClass));
      if (!translatable.localized && translatable.source) {
        surfaceComplete = false;
        incompleteEvidence ||= {
          entryId: entry.entryId,
          factId: surface.factId,
          surfaceKind: surface.surfaceKind,
          textPreviewHash: normalizedHash(text || 'empty'),
          detectedLocale: null,
          detectedScript: 'unknown',
          tokenClass: 'translatable_surface_incomplete',
          protectedEntityTokenClasses: translatable.protectedClasses,
        };
      }
      const purity = validateAiUnitLocalePurity(translatable.localized, manifest.locale, {
        kind: 'summary_sentence', requireUnits: translatable.source.length > 0,
      });
      const planned = authorityByEntryId.get(entry.entryId);
      const sourceLineage = surface.surfaceKind === 'localized_role_title'
        ? options.roleSourceByEntryId?.[entry.entryId]
        : options.factSourceByFactId?.[surface.factId || ''];
      const plannedAuthority = surface.surfaceKind === 'localized_role_title'
        ? planned?.role.authority
        : planned?.facts.find((fact) => fact.factId === surface.factId)?.authority;
      if (
        text.toLocaleLowerCase() === surface.sourceText.trim().toLocaleLowerCase()
        && translatable.source.length > 0
        && plannedAuthority === 'foreign_localization_required'
        && !localesAreDetectionCompatible(surface.sourceLocale, manifest.locale)
      ) sourceLanguageLeakageDetected = true;
      const exactTargetNativeAuthority = (
        text === surface.sourceText.trim()
        && (sourceLineage === 'same_locale_authoritative'
          || (!sourceLineage && plannedAuthority === 'target_native_authoritative'))
        && scriptIsNativeForLocale(translatable.detectedScript, manifest.locale)
      ) || (
        surface.presentationTrusted
        && surface.presentationLocale === manifest.locale
        && plannedAuthority === 'target_native_authoritative'
        && text === String(surface.presentationText || '').trim()
        && scriptIsNativeForLocale(translatable.detectedScript, manifest.locale)
      );
      targetLocalePurityPassed = targetLocalePurityPassed
        && (exactTargetNativeAuthority || purity.targetLocalePurityPassed);
      targetScriptPurityPassed = targetScriptPurityPassed && purity.wrongScriptUnitCount === 0;
      sourceLanguageLeakageDetected = sourceLanguageLeakageDetected
        || (!exactTargetNativeAuthority && purity.sourceLanguageLeakageDetected);
      const scriptHit = purity.units.find((hit) => hit.wrongScript);
      if (scriptHit) {
        wrongScriptEvidence ||= {
          entryId: entry.entryId,
          factId: surface.factId,
          surfaceKind: surface.surfaceKind,
          textPreviewHash: scriptHit.textPreviewHash,
          detectedLocale: scriptHit.detectedLocale,
          detectedScript: scriptHit.detectedScript,
          tokenClass: 'translatable_surface_wrong_script',
          protectedEntityTokenClasses: translatable.protectedClasses,
        };
      }
      const localeHit = exactTargetNativeAuthority
        ? undefined
        : purity.units.find((hit) => hit.wrongLocale || hit.mixedLanguage);
      if (localeHit) {
        wrongLocaleEvidence ||= {
          entryId: entry.entryId,
          factId: surface.factId,
          surfaceKind: surface.surfaceKind,
          textPreviewHash: localeHit.textPreviewHash,
          detectedLocale: localeHit.detectedLocale,
          detectedScript: localeHit.detectedScript,
          tokenClass: 'translatable_surface_wrong_locale',
          protectedEntityTokenClasses: translatable.protectedClasses,
        };
      }
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

  const failureEvidence = reason === 'localization_incomplete_surface'
    ? incompleteEvidence
    : reason === 'localization_wrong_script'
      ? wrongScriptEvidence
      : reason === 'locale_impurity'
        ? wrongLocaleEvidence
        : null;

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
    failureEvidence,
    protectedEntityTokenClasses: [...protectedEntityTokenClasses],
  };
}

export function acceptSummaryV2LocalizationResponse(options: {
  manifest: SummaryV2SelectionManifest;
  response: SummaryV2LocalizationProviderResponse;
  source: SummaryV2LocalizationSource;
  sourceByEntryId?: Partial<Record<string, SummaryV2LocalizationSource>>;
  roleSourceByEntryId?: Partial<Record<string, SummaryV2LocalizationSource>>;
  factSourceByFactId?: Partial<Record<string, SummaryV2LocalizationSource>>;
}): { manifest: SummaryV2LocalizedManifest | null; validation: SummaryV2LocalizationValidation } {
  const sourceByEntryId = options.sourceByEntryId || Object.fromEntries(
    selectedEntries(options.manifest).map((entry) => [entry.entryId, options.source]),
  );
  const validation = validateSummaryV2LocalizationResponse(options.manifest, options.response, {
    sourceByEntryId,
    roleSourceByEntryId: options.roleSourceByEntryId,
    factSourceByFactId: options.factSourceByFactId,
  });
  if (!validation.ok) return { manifest: null, validation };
  const sourceEntries = new Map(selectedEntries(options.manifest).map((entry) => [entry.entryId, entry]));
  const entries: SummaryV2LocalizedEntry[] = options.response.entries.map((entry) => {
    const sourceEntry = sourceEntries.get(entry.entryId)!;
    const sourceFacts = new Map(sourceEntry.facts.map((fact) => [fact.factId, fact]));
    return {
      entryId: sourceEntry.entryId,
      sourceLocale: sourceEntry.sourceLocale,
      localizedRoleTitle: entry.localizedRoleTitle.trim(),
      localizedRoleTitleHash: normalizedHash(entry.localizedRoleTitle),
      sourceRoleTitleHash: normalizedHash(sourceEntry.role),
      localizedRoleTitleLocalizationSource: options.roleSourceByEntryId?.[sourceEntry.entryId]
        || sourceByEntryId[sourceEntry.entryId]
        || options.source,
      localizedRoleTitleValidationResult: 'passed' as const,
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
          localizationSource: options.factSourceByFactId?.[sourceFact.factId]
            || sourceByEntryId[sourceEntry.entryId]
            || options.source,
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
    validation,
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
  // Whole-entry bypass is an optimization only after every translatable
  // surface has independently established target-native authority.
  if (entries.some((entry) => !classifySummaryV2EntrySurfaceAuthority({ manifest, entry })
    .allTranslatableSurfacesTargetNative)) {
    return null;
  }
  const response: SummaryV2LocalizationProviderResponse = {
    targetLocale: manifest.locale,
    entries: entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle: entry.presentationRoleTrusted && entry.presentationRole
        ? entry.presentationRole
        : entry.role,
      facts: entry.facts.slice(0, 3).map((fact) => ({
        factId: fact.factId,
        localizedText: fact.presentationTrusted && fact.presentationText
          ? fact.presentationText
          : fact.bulletText,
      })),
    })),
  };
  const accepted = acceptSummaryV2LocalizationResponse({
    manifest,
    response,
    source: 'same_locale_authoritative',
    roleSourceByEntryId: Object.fromEntries(entries.map((entry) => [
      entry.entryId, 'same_locale_authoritative' as const,
    ])),
    factSourceByFactId: Object.fromEntries([
      ...manifest.requiredCurrentFacts,
      ...manifest.requiredPriorFacts,
    ].map((fact) => [fact.factId, 'same_locale_authoritative' as const])),
  });
  return accepted.manifest;
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
        // Authority is copied by immutable fact identity/category only. Never
        // derive a new source category from translated projection output.
        sourcePrintFactPresent: fact.sourcePrintFactPresent === true,
        sourceMaterialClaimCategories: [...(fact.sourceMaterialClaimCategories || [])],
        sourceMaterialAuthorityDetectorRevision:
          fact.sourceMaterialAuthorityDetectorRevision,
        sourceMaterialAuthorityPhase: fact.sourceMaterialAuthorityPhase,
      };
    });
    if (facts.some((fact) => fact === null)) return null;
    return {
      ...entry,
      role: localized.localizedRoleTitle,
      roleTitleLocalizationSource: localized.localizedRoleTitleLocalizationSource,
      sourceRoleTitleHash: localized.sourceRoleTitleHash,
      facts: facts as SummaryV2EntryOwned['facts'],
    };
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
