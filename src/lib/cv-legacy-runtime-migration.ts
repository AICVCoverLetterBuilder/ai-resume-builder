import type { CVData, CvSummaryOrigin, WorkExperience } from './types';
import { normalizeCvRegion } from './cv-region';
import type { Locale } from './i18n/translations';
import {
  buildExperienceSnapshotFromText,
  computeCanonicalSourceHash,
  detectContentLocale,
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

/**
 * Older persisted snapshots predate `canonicalState`. Promote only a complete
 * revisioned, locale-bound snapshot; partial data remains untrusted.
 */
function isStructurallyValidPreStateCanonicalSnapshot(
  snapshot: CanonicalCvSnapshot | undefined,
): snapshot is CanonicalCvSnapshot {
  return Boolean(
    snapshot
    && snapshot.canonicalState === undefined
    && normalized(snapshot.canonicalSummary)
    && Array.isArray(snapshot.canonicalExperiences)
    && snapshot.canonicalExperiences.length > 0
    && snapshot.canonicalExperiences.every((experience) => (
      Boolean(normalized(experience.experienceId)) && Array.isArray(experience.bullets)
    ))
    && asLocale(snapshot.canonicalLocale)
    && Number.isInteger(snapshot.canonicalRevision)
    && snapshot.canonicalRevision >= 1
    && normalized(snapshot.canonicalSourceHash)
    && ['user_structured_input', 'validated_ai_result', 'legacy_migration']
      .includes(snapshot.canonicalCreatedFrom),
  );
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
  const canonicalSnapshot = isStructurallyValidPreStateCanonicalSnapshot(persistedCanonicalSnapshot)
    ? {
      ...persistedCanonicalSnapshot,
      canonicalState: 'valid' as const,
      canonicalStateSource: 'legacy_state_inferred' as const,
    }
    : persistedCanonicalSnapshot;
  const canonicalSnapshotWasUpgraded = canonicalSnapshot !== persistedCanonicalSnapshot;
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
    if (normalizedRegion === input.region && !canonicalSnapshotWasUpgraded) {
      return {
        cv: input,
        trace: {
          applied: false,
          fromVersion,
          toVersion: fromVersion,
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
        ...(canonicalSnapshotWasUpgraded ? { canonicalSnapshot } : {}),
      },
      trace: {
        applied: true,
        fromVersion,
        toVersion: fromVersion,
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
    ...(canonicalSnapshot !== persistedCanonicalSnapshot ? { canonicalSnapshot } : {}),
    runtimeMigrationVersion: CV_RUNTIME_MIGRATION_VERSION,
  };

  const hasAuthoritativeDuties = experience.some((exp) => Boolean((exp.canonicalDescription || '').trim()));
  const authoritativeSourceText = experience.map((exp) => exp.canonicalDescription || '').join('\n');
  const detectedAuthoritativeLocale = detectContentLocale(authoritativeSourceText);
  const canonicalSnapshotState = canonicalSnapshot?.canonicalState as CanonicalCvSnapshot['canonicalState'] | undefined;
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
  ) && (
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
