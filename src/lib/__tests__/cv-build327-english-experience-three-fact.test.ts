/**
 * @vitest-environment jsdom
 *
 * AAB-327 — English Experience three-fact warehouse coverage.
 * Spanish Atlas → English Stronger AI must require 3/3 independent facts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION,
  sourceRequiresEnglishWarehouseFactCoverage,
  validateEnglishWarehouseExperienceCoverage,
  scanEnglishWarehousePredicates,
  countEnglishWarehouseTranslatedFacts,
} from '@/lib/cv-english-experience-warehouse-grounding';
import { countTranslatedFactUnits } from '@/lib/cv-cross-locale-experience';
import { materialDutyKeysFromDescription } from '@/lib/cv-material-duty-coverage';
import { sourceFactIdentitiesFromDescription } from '@/lib/cv-source-fact-identity';
import { clearExperienceAiDiagnosticsForTests } from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';

const REF = '2026-07-20';

const ES_ATLAS = [
  'Revisó la mercancía entrante al llegar al almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
].join('\n');

const EN_AAB326 = [
  'Inspects incoming merchandise upon arrival at the warehouse.',
  'Verifies documentation associated with received goods.',
  'Coordinates with colleagues on the preparation and movement of merchandise.',
].join('\n');

function atlasCv(description = ES_ATLAS): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: EN_AAB326,
    preAiFactText: description,
    sourceLocale: 'es',
    targetLocale: 'en',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'pre_ai_snapshot',
  });
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'Empleada de almacén',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: EN_AAB326,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'en',
    generatedDescription: EN_AAB326,
    aiOutputProvenance: provenance,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: 'Asistente',
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: 'Apoyó tareas administrativas básicas.',
    originalUserDescription: 'Apoyó tareas administrativas básicas.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-en-327',
    name: 'CV',
    personal: {
      fullName: 'Ana Test',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: 'Warehouse employee',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'en',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

function atlasSnap(live = EN_AAB326, authoritative = ES_ATLAS) {
  return createExperienceAiOperationSnapshot({
    liveText: live,
    locale: 'en',
    requestId: 'req-327-atlas',
    jobContextHash: 'job-atlas',
    experienceEntryId: 'exp-atlas',
    authoritativeTextOverride: authoritative,
    provenanceOriginOverride: 'originalUserDescription',
  });
}

describe('English Experience three-fact coverage (AAB-327)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes english-experience-three-fact-coverage-327-v1 marker', () => {
    expect(ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION)
      .toBe('english-experience-three-fact-coverage-327-v1');
  });

  it('1–6. Three Spanish Atlas units create three source fact identities', () => {
    const identities = sourceFactIdentitiesFromDescription(ES_ATLAS);
    expect(identities.length).toBe(3);
    expect(sourceRequiresEnglishWarehouseFactCoverage(ES_ATLAS)).toBe(true);
    const cov = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, EN_AAB326);
    expect(cov.required.length).toBe(3);
    expect(cov.required).toEqual([
      'incoming_goods_inspection',
      'related_documentation_verification',
      'colleague_coordination_goods_preparation_movement',
    ]);
    // Material category grouping must not reduce required fact count.
    const keys = materialDutyKeysFromDescription(ES_ATLAS);
    expect(keys.length).toBeLessThanOrEqual(3);
    expect(cov.required.length).toBe(3);
    expect(cov.ok).toBe(true);
    expect(
      cov.revision === 'english-experience-three-fact-coverage-327-v1'
      || cov.revision === 'english-experience-incoming-goods-matcher-328-v1',
    ).toBe(true);
  });

  it('7. Exact AAB-326 bullets cover 3/3', () => {
    const cov = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, EN_AAB326);
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    expect(cov.uncovered).toEqual([]);
  });

  it('8–11. Partial coverage fails', () => {
    const incomingOnly = '• Inspects incoming merchandise upon arrival at the warehouse.';
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, incomingOnly).covered.length)
      .toBe(1);
    const docsOnly = '• Verifies documentation associated with received goods.';
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, docsOnly).covered.length)
      .toBe(1);
    const coordOnly = '• Coordinates with colleagues on the preparation and movement of merchandise.';
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, coordOnly).covered.length)
      .toBe(1);
    const two = [
      '• Inspects incoming merchandise upon arrival at the warehouse.',
      '• Verifies documentation associated with received goods.',
    ].join('\n');
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, two).ok).toBe(false);
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, two).covered.length).toBe(2);
  });

  it('12. Generic warehouse bullet does not cover 3/3', () => {
    const generic = '• Handles warehouse operations.';
    const cov = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, generic);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBe(0);
  });

  it('13. Duplicate one duty does not inflate coverage', () => {
    const dup = [
      '• Inspects incoming merchandise upon arrival at the warehouse.',
      '• Inspects incoming merchandise upon arrival at the warehouse.',
      '• Inspects incoming merchandise upon arrival at the warehouse.',
    ].join('\n');
    const cov = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, dup);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBe(1);
  });

  it('14. Three valid semantic aliases pass', () => {
    const aliases2 = [
      '• Inspects incoming goods upon arrival at the warehouse.',
      '• Checks documents associated with received goods.',
      '• Works with colleagues on the preparation and movement of merchandise.',
    ].join('\n');
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, aliases2).ok).toBe(true);
  });

  it('15–17. Cross-locale translation coverage is 3', () => {
    expect(countEnglishWarehouseTranslatedFacts(ES_ATLAS, EN_AAB326)).toBe(3);
    expect(countTranslatedFactUnits(ES_ATLAS, EN_AAB326)).toBe(3);
    const one = '• Inspects incoming merchandise upon arrival at the warehouse.';
    expect(countTranslatedFactUnits(ES_ATLAS, one)).toBe(1);
  });

  it('18–22. Predicate identity coverage is truthful 3/0', () => {
    const scan = scanEnglishWarehousePredicates(ES_ATLAS, EN_AAB326);
    expect(scan.sourcePredicateIdentityCount).toBe(3);
    expect(scan.candidatePredicateIdentityCount).toBe(3);
    expect(scan.candidateAddedPredicateCount).toBe(0);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(scan.finalCandidatePredicateValidationApplicable).toBe(true);
    const bad = [
      EN_AAB326,
      '• Ensures safety compliance across the warehouse floor.',
    ].join('\n');
    const badScan = scanEnglishWarehousePredicates(ES_ATLAS, bad);
    expect(badScan.candidateAddedPredicateCount).toBeGreaterThan(0);
  });

  it('38. Valid 3/3 provider candidate applies with requiredFactCount 3', () => {
    // Visible starts as Spanish (or incomplete EN) so the EN candidate is a
    // material improvement, not an unedited-rerun no-op.
    const visibleEs = ES_ATLAS;
    const cv = atlasCv();
    cv.experience[0]!.description = visibleEs;
    cv.experience[0]!.generatedDescription = visibleEs;
    cv.experience[0]!.descriptionOrigin = 'user';
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: EN_AAB326,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'provider',
      operationSnapshot: atlasSnap(visibleEs, ES_ATLAS),
    });
    if (fin.blocked || !fin.countedAsSuccess) {
      // eslint-disable-next-line no-console
      console.log('fin fail', {
        blocked: fin.blocked,
        reason: fin.reason,
        required: fin.diagnostics?.requiredFactCount,
        covered: fin.diagnostics?.coveredFactCount,
        providerReq: fin.diagnostics?.providerRequiredFactCount,
        providerCov: fin.diagnostics?.providerCoveredFactCount,
        reject: fin.diagnostics?.rejectionStage,
        typed: fin.diagnostics?.typedFailureReason,
        noop: fin.diagnostics?.semanticNoOpDetected,
        early: fin.diagnostics?.earlyNoOpPreflightPassed,
      });
    }
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.requiredFactCount).toBe(3);
    expect(fin.diagnostics?.coveredFactCount).toBe(3);
    expect(fin.diagnostics?.providerRequiredFactCount ?? fin.diagnostics?.requiredFactCount)
      .toBe(3);
    expect(fin.diagnostics?.providerCoveredFactCount ?? fin.diagnostics?.coveredFactCount)
      .toBe(3);
    expect(fin.diagnostics?.translatedFactCount).toBe(3);
    expect(fin.text).toContain('Inspects incoming merchandise');
    expect(fin.text).toContain('Verifies documentation');
    expect(fin.text).toContain('Coordinates with colleagues');
    expect(fin.diagnostics?.englishExperienceThreeFactCoverageRevision
      || ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION)
      .toBe('english-experience-three-fact-coverage-327-v1');
  });

  it('8b. Incoming-only provider recovers via deterministic 3/3 fallback', () => {
    const visibleEs = ES_ATLAS;
    const cv = atlasCv();
    cv.experience[0]!.description = visibleEs;
    cv.experience[0]!.generatedDescription = visibleEs;
    cv.experience[0]!.descriptionOrigin = 'user';
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: '• Inspects incoming merchandise upon arrival at the warehouse.',
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'provider',
      operationSnapshot: atlasSnap(visibleEs, ES_ATLAS),
    });
    // AAB-328: incomplete provider must not apply as-is; dedicated fallback may complete 3/3.
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.requiredFactCount ?? 0).toBe(3);
    expect(fin.diagnostics?.coveredFactCount ?? 0).toBe(3);
    expect(
      fin.diagnostics?.providerRequiredFactCount
      ?? fin.diagnostics?.requiredFactCount
      ?? 0,
    ).toBe(3);
  });

  it('40. Rewitu entry is not in Atlas apply payload', () => {
    const cv = atlasCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: EN_AAB326,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'provider',
      operationSnapshot: atlasSnap(),
    });
    expect(fin.text).not.toMatch(/Rewitu|administrativas/i);
    expect(cv.experience.find((e) => e.id === 'exp-rewitu')?.description)
      .toMatch(/administrativas/i);
  });
});
