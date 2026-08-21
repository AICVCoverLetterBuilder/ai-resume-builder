import { SUMMARY_V2_REVISION } from './flag';
import { hashSummaryV2Text } from './facts';
import type {
  SummaryV2EntryFact,
  SummaryV2EntryOwned,
  SummaryV2SelectionManifest,
  SummaryV2Snapshot,
} from './types';
import { resolveSummaryCurrentRole } from '@/lib/cv-summary-current-role';

/** Max duties required per selected entry (3/3 for the acceptance fixture). */
export const SUMMARY_V2_MAX_DUTIES_PER_ENTRY = 3;

/** Max prior completed roles selected into the Summary (current always preferred). */
export const SUMMARY_V2_MAX_PRIOR_ENTRIES = 2;

function selectRequiredFacts(entry: SummaryV2EntryOwned): SummaryV2EntryFact[] {
  return entry.facts
    .slice(0, SUMMARY_V2_MAX_DUTIES_PER_ENTRY)
    .map((f) => ({ ...f }));
}

/**
 * Deterministic selection manifest — single source of truth for provider,
 * repair, deterministic fallback, and validators.
 */
export function buildSummaryV2SelectionManifest(
  snapshot: SummaryV2Snapshot,
): SummaryV2SelectionManifest {
  const entries = snapshot.entries.filter((e) => e.entryId || e.role || e.employer || e.facts.length);
  const current = resolveSummaryCurrentRole(entries);
  const priorCandidates = entries
    .filter((e) => current && e.entryId !== current.entryId);

  // Prefer completed priors across the whole immutable snapshot. Slicing before
  // this partition could let earlier extra-current entries crowd completed
  // history out of the bounded two-prior contract.
  const completedPriors = priorCandidates.filter((e) => !e.isPresent);
  const extraCurrentRoles = priorCandidates.filter((e) => e.isPresent);
  const selectedPriors = (completedPriors.length ? completedPriors : extraCurrentRoles)
    .slice(0, SUMMARY_V2_MAX_PRIOR_ENTRIES);

  const requiredCurrentFacts = current ? selectRequiredFacts(current) : [];
  const requiredPriorFacts = selectedPriors.flatMap((e) => selectRequiredFacts(e));

  const snapshotHash = hashSummaryV2Text(
    [
      snapshot.referenceDateIso,
      snapshot.locale,
      snapshot.totalDurationMonths,
      ...entries.map((e) => [
        e.entryId,
        e.role,
        e.employer,
        e.startDate,
        e.endDate,
        e.employmentState,
        e.sourceLocale,
        e.rolePresentationIsUserAuthoritative ? 'user_role_surface' : 'derived_role_surface',
        e.descriptionHash,
        ...e.facts.map((f) => `${f.sourceLocale}:${f.sourceFactHash}`),
      ].join('|')),
    ].join('||'),
  );

  return {
    revision: SUMMARY_V2_REVISION,
    snapshotHash,
    locale: snapshot.locale,
    gender: snapshot.gender,
    totalDurationMonths: snapshot.totalDurationMonths,
    durationPhrase: snapshot.durationPhrase,
    styleHintUsed: Boolean(snapshot.styleHintSummary),
    current,
    priors: selectedPriors,
    allEntries: entries,
    requiredCurrentFacts,
    requiredPriorFacts,
    maxDutiesPerEntry: SUMMARY_V2_MAX_DUTIES_PER_ENTRY,
  };
}
