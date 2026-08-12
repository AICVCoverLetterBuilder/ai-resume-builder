import { fingerprintText } from '@/lib/cv-export-diagnostics';
import type {
  SummaryV2CandidateSourceKind,
  SummaryV2EntryOwned,
  SummaryV2FinalUnitOwnershipEvidence,
  SummaryV2SelectionManifest,
} from './types';

export const SUMMARY_V2_ENTRY_OWNED_FINAL_UNITS_REVISION =
  'summary-v2-entry-owned-final-units-420-v1' as const;

export type SummaryV2UnitOwnershipOptions = {
  candidateSource?: SummaryV2CandidateSourceKind;
  /** Deterministic builders preserve current/prior manifest order by construction. */
  preserveConstructionOrder?: boolean;
};

export type SummaryV2UnitOwnershipResult = {
  passed: boolean;
  reason: string | null;
  units: string[];
  evidence: SummaryV2FinalUnitOwnershipEvidence[];
};

function containsExactSurface(unit: string, surface: string): boolean {
  const value = (surface || '').trim();
  if (!value) return true;
  // Some locale builders inflect the final token of a role/employer surface
  // (for example a case suffix on a proper noun). Requiring the complete
  // normalized source surface preserves arbitrary free text while permitting
  // that locale grammar; ambiguity still fails closed below.
  return unit.normalize('NFKC').toLocaleLowerCase()
    .includes(value.normalize('NFKC').toLocaleLowerCase());
}

export function splitSummaryV2FinalUnits(text: string): string[] {
  return (text || '')
    .split(/(?<=[.!?。؟।])\s+/u)
    .map((unit) => unit.trim())
    .filter(Boolean);
}

function selectedEntries(manifest: SummaryV2SelectionManifest): SummaryV2EntryOwned[] {
  return [...(manifest.current ? [manifest.current] : []), ...manifest.priors];
}

function currentMarker(unit: string): boolean {
  return /\b(?:currently|derzeit|actuellement|attualmente|actualmente|atualmente|trenutno)\b/iu
    .test(unit)
    || ['сейчас', 'حاليا', 'حاليًا', 'वर्तमान', '現在', '現職', 'أعمل'].some(
      (marker) => unit.toLocaleLowerCase().includes(marker.toLocaleLowerCase()),
    );
}

function priorMarker(unit: string): boolean {
  return /\b(?:previously|formerly|zuvor|anteriormente|auparavant|in\s+precedenza|prethodno|ranije|before\s+that)\b/iu
    .test(unit)
    || ['ранее', 'سابقا', 'سابقًا', 'इससे पहले', 'पहले', '以前', '前職'].some(
      (marker) => unit.toLocaleLowerCase().includes(marker.toLocaleLowerCase()),
    );
}

function evidenceFor(options: {
  unit: string;
  unitIndex: number;
  entry: SummaryV2EntryOwned | null;
  manifest: SummaryV2SelectionManifest;
}): SummaryV2FinalUnitOwnershipEvidence {
  const priorIndex = options.entry
    ? options.manifest.priors.findIndex((entry) => entry.entryId === options.entry!.entryId)
    : -1;
  return {
    unitIndex: options.unitIndex,
    unitHash: fingerprintText(options.unit),
    roleSlot: options.entry
      ? (options.manifest.current?.entryId === options.entry.entryId ? 'current_role' : 'prior_role')
      : 'duration',
    owningEntryId: options.entry?.entryId || null,
    owningEntryHash: options.entry ? fingerprintText(options.entry.entryId) : null,
    priorOrdinal: priorIndex >= 0 ? priorIndex + 1 : null,
  };
}

function unitCandidateScore(
  unit: string,
  entry: SummaryV2EntryOwned,
  manifest: SummaryV2SelectionManifest,
): number | null {
  if (!containsExactSurface(unit, entry.role)) return null;
  if (entry.employer && !containsExactSurface(unit, entry.employer)) return null;
  let score = entry.role.trim().length + entry.employer.trim().length;
  const isCurrent = manifest.current?.entryId === entry.entryId;
  if (isCurrent && currentMarker(unit)) score += 10_000;
  if (!isCurrent && priorMarker(unit)) score += 10_000;
  if (isCurrent && priorMarker(unit) && !currentMarker(unit)) score -= 10_000;
  if (!isCurrent && currentMarker(unit) && !priorMarker(unit)) score -= 10_000;
  return score;
}

/**
 * Assign final role units before coverage. Provider candidates require unique
 * source-bound role/employer/slot evidence. Deterministic builders may use the
 * immutable manifest order, but must still contain the corresponding surfaces.
 */
export function analyzeSummaryV2FinalUnitOwnership(
  text: string,
  manifest: SummaryV2SelectionManifest,
  options: SummaryV2UnitOwnershipOptions = {},
): SummaryV2UnitOwnershipResult {
  void SUMMARY_V2_ENTRY_OWNED_FINAL_UNITS_REVISION;
  const units = splitSummaryV2FinalUnits(text);
  const entries = selectedEntries(manifest);
  const durationRequired = manifest.totalDurationMonths > 0;
  const standaloneDurationCount = durationRequired && units.length === entries.length + 1 ? 1 : 0;
  const durationIntegratedIntoRoleUnit = durationRequired && units.length === entries.length;
  if (units.length !== entries.length + standaloneDurationCount
    || (durationRequired && !standaloneDurationCount && !durationIntegratedIntoRoleUnit)) {
    return { passed: false, reason: 'final_unit_count_mismatch', units, evidence: [] };
  }

  const deterministicOrder = options.preserveConstructionOrder === true
    || options.candidateSource === 'deterministic';
  if (deterministicOrder) {
    const evidence: SummaryV2FinalUnitOwnershipEvidence[] = [];
    let roleOffset = 0;
    if (standaloneDurationCount === 1) {
      evidence.push(evidenceFor({ unit: units[0]!, unitIndex: 0, entry: null, manifest }));
      roleOffset = 1;
    }
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      const unitIndex = index + roleOffset;
      const unit = units[unitIndex]!;
      if (unitCandidateScore(unit, entry, manifest) === null) {
        return {
          passed: false,
          reason: 'deterministic_unit_entry_surface_mismatch',
          units,
          evidence,
        };
      }
      evidence.push(evidenceFor({ unit, unitIndex, entry, manifest }));
    }
    return { passed: true, reason: null, units, evidence };
  }

  const assignedEntryIds = new Set<string>();
  const evidence: SummaryV2FinalUnitOwnershipEvidence[] = [];
  const unassignedUnitIndexes: number[] = [];
  for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
    const unit = units[unitIndex]!;
    const scored = entries
      .map((entry) => ({ entry, score: unitCandidateScore(unit, entry, manifest) }))
      .filter((candidate): candidate is { entry: SummaryV2EntryOwned; score: number } => (
        candidate.score !== null
      ))
      .sort((a, b) => b.score - a.score);
    if (scored.length === 0) {
      unassignedUnitIndexes.push(unitIndex);
      continue;
    }
    const best = scored[0]!;
    if (scored[1]?.score === best.score) {
      return { passed: false, reason: 'final_unit_entry_ownership_ambiguous', units, evidence };
    }
    if (assignedEntryIds.has(best.entry.entryId)) {
      return { passed: false, reason: 'duplicate_final_unit_for_entry', units, evidence };
    }
    assignedEntryIds.add(best.entry.entryId);
    evidence.push(evidenceFor({ unit, unitIndex, entry: best.entry, manifest }));
  }

  if (unassignedUnitIndexes.length !== standaloneDurationCount) {
    return { passed: false, reason: 'unowned_final_role_unit', units, evidence };
  }
  if (standaloneDurationCount === 1) {
    const durationIndex = unassignedUnitIndexes[0]!;
    evidence.push(evidenceFor({
      unit: units[durationIndex]!, unitIndex: durationIndex, entry: null, manifest,
    }));
  }
  if (assignedEntryIds.size !== entries.length) {
    return { passed: false, reason: 'selected_entry_final_unit_missing', units, evidence };
  }
  evidence.sort((a, b) => a.unitIndex - b.unitIndex);
  return { passed: true, reason: null, units, evidence };
}
