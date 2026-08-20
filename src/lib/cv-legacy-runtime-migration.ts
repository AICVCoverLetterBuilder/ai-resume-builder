import type {
  CVData,
  CvRuntimeMigrationRepair,
  CvSummaryOrigin,
  WorkExperience,
} from './types';
import { normalizeCvRegion } from './cv-region';
import type { Locale } from './i18n/translations';
import {
  buildExperienceSnapshotFromText,
  computeCanonicalSourceHash,
  detectContentLocale,
  inspectCanonicalSnapshotCoherence,
  type CanonicalCvSnapshot,
} from './cv-canonical-snapshot';
import {
  isAiDescriptionOrigin,
  isAiPollutedCanonicalDescription,
} from './cv-experience-provenance';
import { validateSummaryCompleteness } from './cv-semantic-fidelity';
import {
  recoverAuthoritativeDutiesFromVisibleText,
  legacyVisibleLooksLikeUserDuties,
} from './cv-legacy-grounding-recovery';

/** Bumped to 3: recover authoritative duties from classified legacy visible text. */
export const CV_RUNTIME_MIGRATION_VERSION = 3;

const LOCALES = new Set<Locale>([
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
]);

function asLocale(value?: string): Locale | undefined {
  return value && LOCALES.has(value as Locale) ? value as Locale : undefined;
}

function normalized(text?: string): string {
  return (text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function sameText(a?: string, b?: string): boolean {
  return Boolean(normalized(a)) && normalized(a) === normalized(b);
}

export type LegacyCanonicalSnapshotUpgradeResult =
  | 'accepted'
  | 'already_accepted'
  | 'rejected'
  | 'not_applicable';

export type LegacyCanonicalSnapshotUpgradeSkipReason =
  | 'snapshot_absent'
  | 'canonical_state_present'
  | 'canonical_summary_missing'
  | 'canonical_entries_missing'
  | 'canonical_entry_binding_invalid'
  | 'canonical_locale_invalid'
  | 'canonical_revision_invalid'
  | 'canonical_source_hash_missing';

export type CanonicalSnapshotStatePresence =
  | 'valid'
  | 'needs_rebuild'
  | 'absent'
  | 'invalid';

type LegacyCanonicalSnapshotInspection = {
  present: boolean;
  canonicalStateBefore: CanonicalSnapshotStatePresence;
  structurallyValid: boolean;
  upgradeAttempted: boolean;
  upgradeResult: LegacyCanonicalSnapshotUpgradeResult;
  skipReason: LegacyCanonicalSnapshotUpgradeSkipReason | null;
};

function canonicalStatePresence(snapshot: CanonicalCvSnapshot | undefined): CanonicalSnapshotStatePresence {
  if (!snapshot || snapshot.canonicalState === undefined || snapshot.canonicalState === null) return 'absent';
  if (snapshot.canonicalState === 'valid' || snapshot.canonicalState === 'needs_rebuild') {
    return snapshot.canonicalState;
  }
  return 'invalid';
}

/**
 * Persisted snapshots from before state/provenance labels still have enough
 * immutable evidence to be trusted.  Do not require a later descriptive
 * label: trust is based on the revisioned Summary and entry bindings only.
 */
function inspectPreStateCanonicalSnapshot(
  snapshot: CanonicalCvSnapshot | undefined,
  experience: WorkExperience[],
): LegacyCanonicalSnapshotInspection {
  if (!snapshot) {
    return {
      present: false,
      canonicalStateBefore: 'absent',
      structurallyValid: false,
      upgradeAttempted: false,
      upgradeResult: 'not_applicable',
      skipReason: 'snapshot_absent',
    };
  }

  const state = canonicalStatePresence(snapshot);
  if (state !== 'absent') {
    const alreadyAccepted = state === 'valid'
      && snapshot.canonicalStateSource === 'legacy_state_inferred';
    return {
      present: true,
      canonicalStateBefore: state,
      structurallyValid: alreadyAccepted,
      upgradeAttempted: false,
      upgradeResult: alreadyAccepted ? 'already_accepted' : 'not_applicable',
      skipReason: 'canonical_state_present',
    };
  }

  const canonicalEntries = Array.isArray(snapshot.canonicalExperiences)
    ? snapshot.canonicalExperiences
    : [];
  const liveIds = new Set((experience || []).map((item) => item.id));
  const snapshotIds = canonicalEntries.map((item) => normalized(item.experienceId));
  const bindingsValid = canonicalEntries.length > 0
    && snapshotIds.every(Boolean)
    && new Set(snapshotIds).size === snapshotIds.length
    && snapshotIds.length === liveIds.size
    && snapshotIds.every((id) => liveIds.has(id))
    && canonicalEntries.every((item) => (
      Array.isArray(item.bullets)
      && item.bullets.every((bullet) => (
        Boolean(normalized(bullet.factId))
        && Boolean(normalized(bullet.sourceText))
      ))
    ));

  const skipReason: LegacyCanonicalSnapshotUpgradeSkipReason | null =
    !normalized(snapshot.canonicalSummary)
      ? 'canonical_summary_missing'
      : canonicalEntries.length === 0
        ? 'canonical_entries_missing'
        : !bindingsValid
          ? 'canonical_entry_binding_invalid'
          : !asLocale(snapshot.canonicalLocale)
            ? 'canonical_locale_invalid'
            : !Number.isInteger(snapshot.canonicalRevision) || snapshot.canonicalRevision < 1
              ? 'canonical_revision_invalid'
              : !normalized(snapshot.canonicalSourceHash)
                ? 'canonical_source_hash_missing'
                : null;
  const structurallyValid = skipReason === null;
  return {
    present: true,
    canonicalStateBefore: 'absent',
    structurallyValid,
    upgradeAttempted: true,
    upgradeResult: structurallyValid ? 'accepted' : 'rejected',
    skipReason,
  };
}

/**
 * Older persisted snapshots predate `canonicalState`. Promote only a complete
 * revisioned, locale-bound snapshot; partial data remains untrusted.
 */
function isStructurallyValidPreStateCanonicalSnapshot(
  snapshot: CanonicalCvSnapshot | undefined,
  experience: WorkExperience[],
): snapshot is CanonicalCvSnapshot {
  return inspectPreStateCanonicalSnapshot(snapshot, experience).structurallyValid;
}

function acceptedStructuralRepair(input: CVData, canonicalSnapshot: CanonicalCvSnapshot | undefined):
  CvRuntimeMigrationRepair | undefined {
  const repair = input.runtimeMigrationRepair;
  return repair
    && repair.revision === 1
    && repair.structuralUpgradeResult === 'accepted'
    && canonicalSnapshot?.canonicalState === 'valid'
    && canonicalSnapshot.canonicalStateSource === 'legacy_state_inferred'
    ? repair
    : undefined;
}

function snapshotDuties(cv: CVData, exp: WorkExperience): string {
  const snap = cv.canonicalSnapshot?.canonicalExperiences.find((item) => item.experienceId === exp.id);
  return (snap?.bullets || []).map((bullet) => bullet.sourceText.trim()).filter(Boolean).join('\n');
}

function inferVisibleDescriptionOrigin(exp: WorkExperience, authoritative: string): WorkExperience['descriptionOrigin'] {
  if (exp.descriptionOrigin) return exp.descriptionOrigin;
  const visible = (exp.description || '').trim();
  const generated = (exp.generatedDescription || '').trim();
  if (
    (generated && sameText(generated, visible))
    || (exp.generatedLocale && visible && !sameText(visible, authoritative))
  ) {
    return 'ai_generated';
  }
  if (authoritative && visible && !sameText(authoritative, visible)) {
    const sourceLocale = detectContentLocale(authoritative);
    const visibleLocale = detectContentLocale(visible);
    if (sourceLocale && visibleLocale && sourceLocale !== visibleLocale) return 'ai_generated';
  }
  return 'user';
}

function selectAuthoritativeDuties(cv: CVData, exp: WorkExperience): {
  text: string;
  source: LegacyExperienceRecoverySource;
} {
  const original = (exp.originalUserDescription || '').trim();
  if (original) return { text: original, source: 'originalUserDescription' };

  const snapshot = snapshotDuties(cv, exp);
  if (snapshot) return { text: snapshot, source: 'canonicalSnapshot' };

  const canonical = (exp.canonicalDescription || '').trim();
  const visible = (exp.description || '').trim();
  const generated = (exp.generatedDescription || '').trim();
  const canonicalLooksGenerated = canonical && (
    sameText(canonical, generated)
    || (
      sameText(canonical, visible)
      && (isAiDescriptionOrigin(exp.descriptionOrigin) || Boolean(exp.generatedLocale))
    )
  );
  if (canonical && !canonicalLooksGenerated) {
    return { text: canonical, source: 'canonicalDescription' };
  }

  // Last-resort legacy source. It is retained only when no separate generated
  // display marker or authoritative canonical source survived the old schema.
  if (visible && !generated && !isAiDescriptionOrigin(exp.descriptionOrigin)) {
    return { text: visible, source: 'legacyDescription' };
  }

  // Build-244/245: AI display replaced the only surviving duties. Narrowly
  // classify visible/generated text into English authoritative shells — never
  // store the AI display string itself as ordinary user-confirmed canonical prose.
  const classified = recoverAuthoritativeDutiesFromVisibleText(visible)
    || recoverAuthoritativeDutiesFromVisibleText(generated);
  if (classified) {
    return { text: classified, source: 'legacy_recovered_display_duties' };
  }

  // Latin/source duties that still classify cleanly but were mis-tagged AI.
  if (visible && legacyVisibleLooksLikeUserDuties(visible) && detectContentLocale(visible) === 'en') {
    return { text: visible, source: 'legacyDescription' };
  }

  return { text: '', source: 'none' };
}

export type LegacyExperienceRecoverySource =
  | 'originalUserDescription'
  | 'canonicalSnapshot'
  | 'canonicalDescription'
  | 'legacyDescription'
  | 'legacy_recovered_display_duties'
  | 'classifiedVisibleDuties'
  | 'none';

export type LegacyCvMigrationTrace = {
  applied: boolean;
  fromVersion: number;
  toVersion: number;
  legacyCanonicalSnapshotPresent: boolean;
  legacyCanonicalSnapshotStructurallyValid: boolean;
  legacyCanonicalSnapshotStructuralUpgradeAttempted: boolean;
  legacyCanonicalSnapshotStructuralUpgradeResult: LegacyCanonicalSnapshotUpgradeResult;
  legacyCanonicalSnapshotStructuralUpgradeSkipReason: LegacyCanonicalSnapshotUpgradeSkipReason | null;
  canonicalSnapshotStateBefore: CanonicalSnapshotStatePresence;
  canonicalSnapshotStateAfter: CanonicalSnapshotStatePresence;
  canonicalSnapshotStructurallyPopulated: boolean;
  canonicalSnapshotStructurallyVerified: boolean | null;
  canonicalSnapshotSemanticallyCoherent: boolean | null;
  canonicalSnapshotSemanticFailureReasons: string[];
  canonicalSnapshotCoherenceRebuildAttempted: boolean;
  contentLocaleBefore?: string;
  contentLocaleAfter?: string;
  summaryOriginBefore?: string;
  summaryOriginAfter?: string;
  generatedSummaryLocale?: string;
  experienceSources: LegacyExperienceRecoverySource[];
  clearedLocalizedProjections: boolean;
  rebuiltCanonicalSnapshot: boolean;
};

export function normalizeLegacyCvRuntimeWithTrace(
  input: CVData,
  localeHint?: Locale,
): { cv: CVData; trace: LegacyCvMigrationTrace } {
  const fromVersion = Number(input.runtimeMigrationVersion || 0);
  const normalizedRegion = normalizeCvRegion(input.region);
  const persistedCanonicalSnapshot = input.canonicalSnapshot;
  const structuralInspection = inspectPreStateCanonicalSnapshot(
    persistedCanonicalSnapshot,
    input.experience || [],
  );
  const canonicalSnapshot = isStructurallyValidPreStateCanonicalSnapshot(
    persistedCanonicalSnapshot,
    input.experience || [],
  )
    ? {
      ...persistedCanonicalSnapshot,
      canonicalCreatedFrom: persistedCanonicalSnapshot.canonicalCreatedFrom
        || 'legacy_migration' as const,
      canonicalState: 'valid' as const,
      canonicalStateSource: 'legacy_state_inferred' as const,
    }
    : persistedCanonicalSnapshot;
  const canonicalCoherence = inspectCanonicalSnapshotCoherence(input, canonicalSnapshot);
  // A valid state label and a self-consistent hash are not proof that the
  // Summary still belongs to these entry-bound facts.  Only app-owned Summary
  // authority is eligible for automatic rebuild; user-authored text remains
  // explicitly preserved and is evaluated at the normal final boundary.
  const canonicalSnapshotCoherenceRejected = Boolean(
    canonicalSnapshot?.canonicalState === 'valid'
    && input.summaryOrigin !== 'user'
    && canonicalCoherence.structurallyValid
    && !canonicalCoherence.semanticallyCoherent
    && canonicalCoherence.summaryForeignEmployerAnchorDetected,
  );
  // Do not rewrite the persisted snapshot merely to record the verdict: the
  // existing export-only Experience projection may still need its immutable
  // source facts. The final Summary authority resolver consumes this explicit
  // coherence verdict and excludes only the stale app-owned Summary surface.
  const coherenceAdjustedCanonicalSnapshot = canonicalSnapshot;
  const canonicalSnapshotWasUpgraded = canonicalSnapshot !== persistedCanonicalSnapshot;
  const canonicalSnapshotWasAdjusted = canonicalSnapshotWasUpgraded;
  const structuralRepair = canonicalSnapshotWasUpgraded
    ? {
      revision: 1 as const,
      migrationVersionBefore: fromVersion,
      migrationVersionAfter: fromVersion,
      legacyCanonicalSnapshotPresent: true as const,
      legacyCanonicalSnapshotStructurallyValid: true as const,
      structuralUpgradeAttempted: true as const,
      structuralUpgradeResult: 'accepted' as const,
      structuralUpgradeSkipReason: null,
      canonicalSnapshotStateBefore: 'absent' as const,
      canonicalSnapshotStateAfter: 'valid' as const,
    }
    : acceptedStructuralRepair(input, canonicalSnapshot);
  const traceStructuralFields = structuralRepair
    ? {
      legacyCanonicalSnapshotPresent: structuralRepair.legacyCanonicalSnapshotPresent,
      legacyCanonicalSnapshotStructurallyValid:
        structuralRepair.legacyCanonicalSnapshotStructurallyValid,
      legacyCanonicalSnapshotStructuralUpgradeAttempted:
        structuralRepair.structuralUpgradeAttempted,
      legacyCanonicalSnapshotStructuralUpgradeResult:
        structuralRepair.structuralUpgradeResult as LegacyCanonicalSnapshotUpgradeResult,
      legacyCanonicalSnapshotStructuralUpgradeSkipReason:
        structuralRepair.structuralUpgradeSkipReason as LegacyCanonicalSnapshotUpgradeSkipReason | null,
      canonicalSnapshotStateBefore:
        structuralRepair.canonicalSnapshotStateBefore as CanonicalSnapshotStatePresence,
      canonicalSnapshotStateAfter:
        structuralRepair.canonicalSnapshotStateAfter as CanonicalSnapshotStatePresence,
    }
    : {
      legacyCanonicalSnapshotPresent: structuralInspection.present,
      legacyCanonicalSnapshotStructurallyValid: structuralInspection.structurallyValid,
      legacyCanonicalSnapshotStructuralUpgradeAttempted: structuralInspection.upgradeAttempted,
      legacyCanonicalSnapshotStructuralUpgradeResult: structuralInspection.upgradeResult,
      legacyCanonicalSnapshotStructuralUpgradeSkipReason: structuralInspection.skipReason,
      canonicalSnapshotStateBefore: structuralInspection.canonicalStateBefore,
      canonicalSnapshotStateAfter: canonicalStatePresence(coherenceAdjustedCanonicalSnapshot),
    };
  const canRecoverMissingGrounding = (input.experience || []).some((exp) => {
    if ((exp.originalUserDescription || '').trim()) return false;
    const visible = (exp.description || '').trim();
    const generated = (exp.generatedDescription || '').trim();
    return Boolean(
      recoverAuthoritativeDutiesFromVisibleText(visible)
      || recoverAuthoritativeDutiesFromVisibleText(generated),
    );
  });
  if (fromVersion >= CV_RUNTIME_MIGRATION_VERSION && !canRecoverMissingGrounding) {
    // Idempotent safety: even after a prior migration, never leave an invalid region
    // that crashes Corporate Navy PDF/DOCX on regionSettings[region].showAddress.
    if (normalizedRegion === input.region && !canonicalSnapshotWasAdjusted) {
      return {
        cv: input,
        trace: {
          applied: false,
          fromVersion,
          toVersion: fromVersion,
          ...traceStructuralFields,
          canonicalSnapshotStructurallyPopulated: canonicalCoherence.structurallyPopulated,
          canonicalSnapshotStructurallyVerified: canonicalSnapshot
            ? canonicalCoherence.structurallyValid
            : null,
          canonicalSnapshotSemanticallyCoherent: canonicalSnapshot
            ? canonicalCoherence.semanticallyCoherent
            : null,
          canonicalSnapshotSemanticFailureReasons: canonicalCoherence.failureReasons,
          canonicalSnapshotCoherenceRebuildAttempted: canonicalSnapshotCoherenceRejected,
          contentLocaleBefore: input.contentLocale,
          contentLocaleAfter: input.contentLocale,
          summaryOriginBefore: input.summaryOrigin,
          summaryOriginAfter: input.summaryOrigin,
          generatedSummaryLocale: input.summaryGeneratedLocale,
          experienceSources: (input.experience || []).map(() => 'none'),
          clearedLocalizedProjections: false,
          rebuiltCanonicalSnapshot: false,
        },
      };
    }
    return {
      cv: {
        ...input,
        region: normalizedRegion,
        ...(canonicalSnapshotWasAdjusted ? { canonicalSnapshot: coherenceAdjustedCanonicalSnapshot } : {}),
        ...(canonicalSnapshotWasUpgraded ? { runtimeMigrationRepair: structuralRepair } : {}),
      },
      trace: {
        applied: true,
        fromVersion,
        toVersion: fromVersion,
        ...traceStructuralFields,
        canonicalSnapshotStructurallyPopulated: canonicalCoherence.structurallyPopulated,
        canonicalSnapshotStructurallyVerified: canonicalSnapshot
          ? canonicalCoherence.structurallyValid
          : null,
        canonicalSnapshotSemanticallyCoherent: canonicalSnapshot
          ? canonicalCoherence.semanticallyCoherent
          : null,
        canonicalSnapshotSemanticFailureReasons: canonicalCoherence.failureReasons,
        canonicalSnapshotCoherenceRebuildAttempted: canonicalSnapshotCoherenceRejected,
        contentLocaleBefore: input.contentLocale,
        contentLocaleAfter: input.contentLocale,
        summaryOriginBefore: input.summaryOrigin,
        summaryOriginAfter: input.summaryOrigin,
        generatedSummaryLocale: input.summaryGeneratedLocale,
        experienceSources: (input.experience || []).map(() => 'none'),
        clearedLocalizedProjections: false,
        rebuiltCanonicalSnapshot: false,
      },
    };
  }

  const summaryLocale = detectContentLocale(input.summary || '');
  const storedLocale = asLocale(input.contentLocale);
  // Visible content beats stale metadata. A UI hint is only a fallback when the
  // visible summary itself is ambiguous.
  const contentLocale = summaryLocale || localeHint || storedLocale;
  const experienceSources: LegacyExperienceRecoverySource[] = [];
  let provenanceChanged = false;

  const experience = (input.experience || []).map((exp) => {
    const selected = selectAuthoritativeDuties(input, exp);
    experienceSources.push(selected.source);
    const origin = inferVisibleDescriptionOrigin(exp, selected.text);
    const generatedDescription = isAiDescriptionOrigin(origin)
      ? ((exp.generatedDescription || exp.description || '').trim() || undefined)
      : exp.generatedDescription;
    const generatedLocale = isAiDescriptionOrigin(origin)
      ? (asLocale(exp.generatedLocale) || detectContentLocale(generatedDescription || '') || contentLocale)
      : asLocale(exp.generatedLocale);
    const canonicalWasPolluted = Boolean(
      selected.text
      && (
        !sameText(exp.canonicalDescription, selected.text)
        || (
          exp.originalUserDescription
          && isAiPollutedCanonicalDescription(exp)
        )
      ),
    );
    provenanceChanged ||= canonicalWasPolluted
      || !exp.descriptionOrigin
      || (!exp.originalUserDescription && Boolean(selected.text));
    return {
      ...exp,
      ...(selected.text ? {
        originalUserDescription: selected.text,
        canonicalDescription: selected.text,
        ...(selected.source === 'legacy_recovered_display_duties'
          ? { groundingRecoverySource: 'legacy_recovered_display_duties' as const }
          : {}),
      } : {}),
      descriptionOrigin: origin,
      ...(generatedDescription ? { generatedDescription } : {}),
      ...(generatedLocale ? { generatedLocale } : {}),
    };
  });

  let summaryOrigin: CvSummaryOrigin = input.summaryOrigin || 'user';
  if (!input.summaryOrigin) {
    const canonicalDiffers = Boolean(
      input.canonicalSummary
      && !sameText(input.canonicalSummary, input.summary),
    );
    const localizedGeneratedExperience = experience.some((exp) =>
      isAiDescriptionOrigin(exp.descriptionOrigin)
      && asLocale(exp.generatedLocale) === contentLocale,
    );
    if (canonicalDiffers || localizedGeneratedExperience) summaryOrigin = 'ai_generated';
  }
  const summaryGeneratedLocale = summaryOrigin === 'user'
    ? input.summaryGeneratedLocale
    : (asLocale(input.summaryGeneratedLocale) || contentLocale);

  const staleLocale = Boolean(contentLocale && storedLocale && contentLocale !== storedLocale);
  const canonicalSummary = summaryOrigin === 'user'
    ? ((input.canonicalSummary || input.summary || '').trim() || undefined)
    : (
      input.summaryOrigin
      && input.canonicalSummary
      && !sameText(input.canonicalSummary, input.summary)
        ? input.canonicalSummary.trim()
        : undefined
    );

  let next: CVData = {
    ...input,
    experience,
    region: normalizedRegion,
    ...(contentLocale ? { contentLocale } : {}),
    ...(summaryGeneratedLocale ? { summaryGeneratedLocale } : {}),
    summaryOrigin,
    canonicalSummary,
    ...(coherenceAdjustedCanonicalSnapshot !== persistedCanonicalSnapshot
      ? { canonicalSnapshot: coherenceAdjustedCanonicalSnapshot }
      : {}),
    ...(canonicalSnapshotWasUpgraded ? { runtimeMigrationRepair: structuralRepair } : {}),
    runtimeMigrationVersion: CV_RUNTIME_MIGRATION_VERSION,
  };

  const hasAuthoritativeDuties = experience.some((exp) => Boolean((exp.canonicalDescription || '').trim()));
  const authoritativeSourceText = experience.map((exp) => exp.canonicalDescription || '').join('\n');
  const detectedAuthoritativeLocale = detectContentLocale(authoritativeSourceText);
  const canonicalSnapshotState = coherenceAdjustedCanonicalSnapshot?.canonicalState as CanonicalCvSnapshot['canonicalState'] | undefined;
  const hasTrustedExistingLocale = canonicalSnapshotState === 'valid';
  const summaryCanSupportRecovery = validateSummaryCompleteness(input.summary || '', {
    locale: contentLocale || localeHint || 'en',
  }).valid;
  let rebuiltCanonicalSnapshot = false;
  if (hasAuthoritativeDuties && (
    provenanceChanged
    || staleLocale
    || !canonicalSnapshot
    || canonicalSnapshotState !== 'valid'
  ) && !canonicalSnapshotCoherenceRejected && (
    canonicalSnapshotState !== 'needs_rebuild'
    || summaryCanSupportRecovery
  ) && (Boolean(detectedAuthoritativeLocale) || hasTrustedExistingLocale)) {
    const canonicalLocale = detectedAuthoritativeLocale
      || canonicalSnapshot?.canonicalLocale
      || contentLocale
      || localeHint
      || 'en';
    const canonicalExperiences = experience.map((exp, index) =>
      buildExperienceSnapshotFromText(exp, index));
    const snapshotBase = {
      canonicalSummary: canonicalSummary || '',
      canonicalExperiences,
      canonicalLocale,
      canonicalRevision: Math.max(1, canonicalSnapshot?.canonicalRevision || 0),
      canonicalCreatedFrom: 'legacy_migration' as const,
      canonicalState: 'valid' as const,
    };
    const rebuiltSnapshot: CanonicalCvSnapshot = {
      ...snapshotBase,
      canonicalSourceHash: computeCanonicalSourceHash({
        canonicalLocale,
        canonicalSummary: snapshotBase.canonicalSummary,
        canonicalExperiences,
        skills: input.skills || [],
        education: input.education || [],
        languages: input.languages || [],
      }),
    };
    next = { ...next, canonicalSnapshot: rebuiltSnapshot };
    rebuiltCanonicalSnapshot = true;
  }

  const clearLocalizedProjections = Boolean(
    input.localizedProjections
    && (provenanceChanged || staleLocale || rebuiltCanonicalSnapshot),
  );
  if (clearLocalizedProjections) {
    const { localizedProjections: _stale, ...withoutStale } = next;
    next = withoutStale as CVData;
  }

  return {
    cv: next,
    trace: {
      applied: true,
      fromVersion,
      toVersion: CV_RUNTIME_MIGRATION_VERSION,
      ...traceStructuralFields,
      canonicalSnapshotStructurallyPopulated: canonicalCoherence.structurallyPopulated,
      canonicalSnapshotStructurallyVerified: canonicalSnapshot
        ? canonicalCoherence.structurallyValid
        : null,
      canonicalSnapshotSemanticallyCoherent: canonicalSnapshot
        ? canonicalCoherence.semanticallyCoherent
        : null,
      canonicalSnapshotSemanticFailureReasons: canonicalCoherence.failureReasons,
      canonicalSnapshotCoherenceRebuildAttempted: canonicalSnapshotCoherenceRejected,
      contentLocaleBefore: input.contentLocale,
      contentLocaleAfter: next.contentLocale,
      summaryOriginBefore: input.summaryOrigin,
      summaryOriginAfter: next.summaryOrigin,
      generatedSummaryLocale: next.summaryGeneratedLocale,
      experienceSources,
      clearedLocalizedProjections: clearLocalizedProjections,
      rebuiltCanonicalSnapshot,
    },
  };
}

export function normalizeLegacyCvRuntime(input: CVData, localeHint?: Locale): CVData {
  return normalizeLegacyCvRuntimeWithTrace(input, localeHint).cv;
}
