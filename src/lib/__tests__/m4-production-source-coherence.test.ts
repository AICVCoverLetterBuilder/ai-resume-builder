import { describe, expect, it } from 'vitest';
import {
  buildArabicWarehouseExperienceFallback,
  scanArabicWarehousePredicates,
  validateArabicWarehouseExperienceCoverage,
} from '../cv-arabic-experience-grounding';
import { buildEntryOwnedFactsFromLiveDescription, hashSummaryV2Text } from '../cv-summary-v2/facts';
import { analyzeSummaryV2FinalUnitOwnership } from '../cv-summary-v2/unit-ownership';
import {
  auditSummaryV2MaterialClaims,
} from '../cv-summary-v2/material-claims';
import { SUMMARY_V2_PRINT_MATERIAL_CATEGORY } from '../cv-summary-v2/types';
import type {
  SummaryV2CandidateSourceKind,
  SummaryV2FinalUnitOwnershipEvidence,
  SummaryV2MaterialAuthorityResult,
  SummaryV2MaterialClaimCategory,
  SummaryV2SelectedEntrySourceContentFingerprint,
  SummaryV2SelectionManifest,
  SummaryV2SourceMaterialAuthorityEvidence,
} from '../cv-summary-v2/types';

const SOURCE = [
  'Inspect incoming goods at the warehouse.',
  'Verify documents related to received goods.',
  'Coordinate with colleagues to prepare and move goods.',
].join('\n');

function summaryManifest(): SummaryV2SelectionManifest {
  const role = 'Archive workflow steward';
  const employer = 'Protected Entity';
  const duty = 'I prepare materials for print.';
  const current = {
    entryId: 'current-source-entry',
    role,
    employer,
    startDate: '2024-01',
    endDate: '',
    isPresent: true,
    employmentState: 'present' as const,
    sourceRoleTitleHash: hashSummaryV2Text(role),
    sourceLocale: 'en' as const,
    descriptionHash: hashSummaryV2Text(duty),
    facts: buildEntryOwnedFactsFromLiveDescription({
      entryId: 'current-source-entry',
      liveDescription: duty,
      sourceLocale: 'en',
    }),
  };
  return {
    revision: 'm4-production-source-coherence',
    snapshotHash: hashSummaryV2Text(`${role}|${employer}|${duty}`),
    locale: 'en',
    gender: 'female',
    totalDurationMonths: 0,
    durationPhrase: '',
    styleHintUsed: false,
    current,
    priors: [],
    requiredCurrentFacts: current.facts.map((fact) => ({ ...fact })),
    requiredPriorFacts: [],
    maxDutiesPerEntry: 3,
  };
}

function compileRestoredContracts(options: {
  candidateSource: SummaryV2CandidateSourceKind;
  ownership: SummaryV2FinalUnitOwnershipEvidence[];
  material: SummaryV2MaterialAuthorityResult;
  category: SummaryV2MaterialClaimCategory;
  fingerprints: SummaryV2SelectedEntrySourceContentFingerprint[];
  authority: SummaryV2SourceMaterialAuthorityEvidence[];
}): void {
  void options;
}

describe('M4 production source coherence', () => {
  it('executes Arabic grounding for current and completed female employment states', () => {
    const current = buildArabicWarehouseExperienceFallback({
      sourceDescription: SOURCE,
      isPresent: true,
      gender: 'female',
    });
    const completed = buildArabicWarehouseExperienceFallback({
      sourceDescription: SOURCE,
      isPresent: false,
      gender: 'female',
    });
    const currentEvidence = scanArabicWarehousePredicates(SOURCE, current);
    const completedEvidence = scanArabicWarehousePredicates(SOURCE, completed);

    expect(currentEvidence).toMatchObject({
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
      finalCandidatePredicateValidationApplicable: true,
    });
    expect(completedEvidence).toMatchObject({
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
      finalCandidatePredicateValidationApplicable: true,
    });
    expect(current).not.toMatch(/^[•\s]*[\p{Script=Arabic}\p{M}]*تْ/mu);
    expect(completed).toMatch(/^[•\s]*[\p{Script=Arabic}\p{M}]*تْ/mu);
  });

  it('keeps malformed or missing Arabic candidate evidence fail-closed', () => {
    const coverage = validateArabicWarehouseExperienceCoverage(SOURCE, '');
    const evidence = scanArabicWarehousePredicates(SOURCE, '');

    expect(coverage.ok).toBe(false);
    expect(coverage.uncovered).toHaveLength(3);
    expect(evidence.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(evidence.candidateAddedPredicateCount).toBe(0);
    expect(Object.keys(evidence).sort()).toEqual([
      'candidateAddedPredicateCount',
      'candidateAddedPredicateIdentityHashes',
      'candidatePredicateIdentityCount',
      'finalCandidatePredicateValidationApplicable',
      'predicateFamiliesCandidate',
      'predicateFamiliesSource',
      'sourcePredicateIdentityCount',
      'sourceUnitPredicateCoveragePassed',
    ]);
    expect(JSON.stringify(evidence)).not.toMatch(/summary|replacement|usage|persist|apply/iu);
  });

  it('executes real Summary V2 ownership and material-authority consumers', () => {
    const manifest = summaryManifest();
    const text = 'Currently I work as Archive workflow steward at Protected Entity, where I prepare materials for print.';
    const ownership = analyzeSummaryV2FinalUnitOwnership(text, manifest, {
      candidateSource: 'deterministic',
      preserveConstructionOrder: true,
    });
    const material = auditSummaryV2MaterialClaims(text, manifest, ownership.evidence);

    expect(SUMMARY_V2_PRINT_MATERIAL_CATEGORY).toBe('design_medium_print');
    expect(ownership.passed).toBe(true);
    expect(ownership.reason).toBeNull();
    expect(ownership.evidence).toHaveLength(1);
    expect(material).toMatchObject({
      printClaimDetected: true,
      sourcePrintFactPresent: true,
      unsupportedPrintClaimCount: 0,
      unsupportedMaterialClaimCount: 0,
      invariantPassed: true,
    });
    expect(material.finalClaimAuthorityEvidence[0]).toMatchObject({
      canonicalCategory: SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
      authorityMatchPassed: true,
      unsupportedReason: null,
    });

    compileRestoredContracts({
      candidateSource: 'deterministic',
      ownership: ownership.evidence,
      material,
      category: SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
      fingerprints: material.selectedEntrySourceContentFingerprints,
      authority: material.sourceAuthorityEvidence,
    });
    expect(JSON.stringify({ ownership, material })).not.toMatch(/usage|persist|applyAuthority|writePath/iu);
  });
});
