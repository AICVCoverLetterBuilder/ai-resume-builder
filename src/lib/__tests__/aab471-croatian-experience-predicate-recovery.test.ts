import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { buildCrossLocaleExperienceFallback } from '@/lib/cv-cross-locale-experience';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import { scanCroatianWarehousePredicates } from '@/lib/cv-croatian-experience-grounding';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';

const SR_SOURCE = [
  'Proverava pristiglu robu.',
  'Proverava prateću dokumentaciju.',
  'Sarađuje sa kolegama na pripremi i premeštanju robe.',
].join('\n');

const OLD_DUPLICATE_HR = [
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Surađuje s kolegama na pripremi i premještanju robe.',
].join('\n');

function fixture(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: SR_SOURCE,
    preAiFactText: SR_SOURCE,
    sourceLocale: 'sr',
    targetLocale: 'hr',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'pre_ai_snapshot',
  });
  const current: WorkExperience = {
    id: 'exp-atlas', company: 'Atlas', position: 'Warehouse employee',
    startDate: '2023-01', endDate: '', isPresent: true,
    description: SR_SOURCE, originalUserDescription: SR_SOURCE,
    canonicalDescription: SR_SOURCE, descriptionOrigin: 'ai_generated',
    generatedLocale: 'sr', generatedDescription: SR_SOURCE,
    aiOutputProvenance: provenance,
  };
  return {
    id: 'aab471-croatian', name: 'AAB471', personal: {
      fullName: 'AAB471', email: '', phone: '', address: '',
      jobTitle: 'Warehouse employee', gender: 'female', photoEnabled: false,
    }, summary: '', contentLocale: 'hr', education: [], skills: [],
    certifications: [], languages: [], experience: [current],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  } as CVData;
}

describe('AAB471 Croatian current-role predicate recovery', () => {
  it('reproduces the Serbian-authority Croatian fallback predicate decision', () => {
    const candidate = buildCrossLocaleExperienceFallback({
      sourceDescription: SR_SOURCE,
      sourceLocale: 'sr', targetLocale: 'hr', gender: 'female', isPresent: true,
      position: 'Warehouse employee',
    });
    const scan = scanGenericExperiencePredicates(SR_SOURCE, candidate, {
      allowValidatedCrossLocaleBridge: true,
    });
    expect(candidate).toBeTruthy();
    expect(candidate).toContain('dokumentaciju povezanu');
    expect(candidate).not.toMatch(/točnost zaprimljene.*prateće/iu);
    expect(scan).toMatchObject({
      sourcePredicateIdentityCount: 3,
      candidatePredicateIdentityCount: 3,
      candidateAddedPredicateCount: 0,
      sourceUnitPredicateCoveragePassed: true,
    });
  });

  it('accepts the fact-preserving Croatian fallback after a rejected 2/3 provider', () => {
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description',
      requestedLocale: 'hr', gender: 'female', cv: fixture(),
      candidate: OLD_DUPLICATE_HR, experienceId: 'exp-atlas',
      industry: 'general', level: 'mid', referenceDateIso: '2026-08-17',
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SR_SOURCE, locale: 'hr', requestId: 'aab471',
        jobContextHash: 'aab471', experienceEntryId: 'exp-atlas',
        authoritativeTextOverride: SR_SOURCE,
        provenanceOriginOverride: 'originalUserDescription',
      }),
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      staleGeneratedDescriptionIgnored: true,
      providerPhaseDiagnostics: {
        candidatePresent: true, requiredFactCount: 3, coveredFactCount: 2,
        uncoveredSourceIndexes: [2], accepted: false,
      },
    });
    const d = result.diagnostics as Record<string, unknown>;
    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    expect(result.text).toBe(buildCrossLocaleExperienceFallback({
      sourceDescription: SR_SOURCE,
      sourceLocale: 'sr', targetLocale: 'hr', gender: 'female', isPresent: true,
      position: 'Warehouse employee',
    }));
    expect(d.finalCandidateSource).toBe('deterministic_fallback');
    expect(d.finalRequiredFactCount).toBe(3);
    expect(d.finalCoveredFactCount).toBe(3);
    expect(d.finalCandidatePredicateIdentityCount).toBe(3);
    expect(d.finalAddedPredicateCount).toBe(0);
    expect(d.providerAccepted).toBe(false);
    expect(d.providerCoveredFactCount).toBe(2);
    expect(d.providerRejectionReason).toBe('croatian_experience_warehouse_fact_coverage_incomplete');
  });

  it('keeps duplicate, extra-action and cross-fact predicate controls rejected', () => {
    const valid = buildCrossLocaleExperienceFallback({
      sourceDescription: SR_SOURCE,
      sourceLocale: 'sr', targetLocale: 'hr', gender: 'female', isPresent: true,
      position: 'Warehouse employee',
    });
    const duplicate = valid.replace(
      'Provjerava dokumentaciju povezanu s primljenom robom.',
      'Provjerava robu koja pristiže u skladište.',
    );
    const extra = `${valid}\n• Upravlja proračunom i vodi tim.`;
    const foreign = valid.replace(
      'Surađuje s kolegama na pripremi i premještanju robe.',
      'Razvija marketinške kampanje za klijente.',
    );
    for (const [index, candidate] of [duplicate, extra, foreign].entries()) {
      const scan = scanGenericExperiencePredicates(SR_SOURCE, candidate, {
        allowValidatedCrossLocaleBridge: true,
      });
      const warehouseScan = scanCroatianWarehousePredicates(SR_SOURCE, candidate);
      expect(
        scan.sourceUnitPredicateCoveragePassed
        && warehouseScan.sourceUnitPredicateCoveragePassed,
      ).toBe(false);
      if (index < 2) {
        expect(scan.reason).toMatch(/added_action|split_or_duplicate/);
      }
    }
  });

  it('keeps coordinated predicates inside one arbitrary source duty unit', () => {
    const source = 'Coordinates client onboarding and reviews handoff notes.';
    const candidate = 'Koordinira onboarding klijenata i pregledava bilješke o primopredaji.';
    const scan = scanGenericExperiencePredicates(source, candidate, {
      allowValidatedCrossLocaleBridge: true,
    });
    expect(scan.sourcePredicateIdentityCount).toBe(1);
    expect(scan.candidatePredicateIdentityCount).toBe(1);
    expect(scan.candidateAddedPredicateCount).toBe(0);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(true);
  });
});
