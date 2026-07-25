/**
 * @vitest-environment jsdom
 *
 * AAB-328 Phase 1 — English Experience incoming-goods matcher + deterministic
 * three-fact fallback self-consistency.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION,
  ENGLISH_EXPERIENCE_DETERMINISTIC_THREE_FACT_328_REVISION,
  ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION,
  validateEnglishWarehouseExperienceCoverage,
  scanEnglishWarehousePredicates,
  buildEnglishWarehouseExperienceFallback,
  countEnglishWarehouseTranslatedFacts,
  englishWarehouseFactDiagId,
} from '@/lib/cv-english-experience-warehouse-grounding';
import { buildCrossLocaleExperienceFallback } from '@/lib/cv-cross-locale-experience';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { clearExperienceAiDiagnosticsForTests } from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';

const REF = '2026-07-25';

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

const LEGACY_COMBINED_SHELL = [
  'Checks incoming goods and related documentation for accurate recording.',
  'Updates warehouse records and maintains orderly arrangement of goods.',
  'Coordinates preparation and movement of goods with colleagues.',
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
    id: 'cv-en-328',
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
    requestId: 'req-328-atlas',
    jobContextHash: 'job-atlas',
    experienceEntryId: 'exp-atlas',
    authoritativeTextOverride: authoritative,
    provenanceOriginOverride: 'originalUserDescription',
  });
}

describe('English Experience incoming-goods coverage (AAB-328 Phase 1)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes AAB-328 matcher and fallback markers', () => {
    expect(ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION)
      .toBe('english-experience-incoming-goods-matcher-328-v1');
    expect(ENGLISH_EXPERIENCE_DETERMINISTIC_THREE_FACT_328_REVISION)
      .toBe('english-experience-deterministic-three-fact-328-v1');
    expect(ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION)
      .toBe('english-experience-three-fact-coverage-327-v1');
  });

  it('1–8. Incoming-goods semantic aliases match independently', () => {
    const aliases = [
      'Inspects incoming merchandise upon arrival at the warehouse.',
      'Checks incoming goods at the warehouse.',
      'Verifies received goods during warehouse intake.',
      'Examines incoming deliveries when they arrive.',
      'Reviews goods received at the warehouse.',
    ];
    for (const line of aliases) {
      const cov = validateEnglishWarehouseExperienceCoverage(
        ES_ATLAS,
        [
          line,
          'Verifies documentation associated with received goods.',
          'Coordinates with colleagues on the preparation and movement of merchandise.',
        ].join('\n'),
      );
      expect(cov.ok, line).toBe(true);
      expect(cov.covered).toContain('incoming_goods_inspection');
      expect(cov.revision).toBe(ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION);
    }
    expect(validateEnglishWarehouseExperienceCoverage(
      ES_ATLAS,
      '• Moves merchandise through the warehouse.',
    ).covered).not.toContain('incoming_goods_inspection');
    expect(validateEnglishWarehouseExperienceCoverage(
      ES_ATLAS,
      '• Reviews documentation.',
    ).covered).not.toContain('incoming_goods_inspection');
    expect(validateEnglishWarehouseExperienceCoverage(
      ES_ATLAS,
      '• Coordinates the movement of goods.',
    ).covered).not.toContain('incoming_goods_inspection');
  });

  it('9–14. Exact device inspection bullet yields inspection predicate 3/3', () => {
    const pred = scanEnglishWarehousePredicates(ES_ATLAS, EN_AAB326);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.predicateFamiliesCandidate).toContain('inspect_incoming');
    const movementOnly = scanEnglishWarehousePredicates(
      ES_ATLAS,
      '• Coordinates with colleagues on the preparation and movement of merchandise.',
    );
    expect(movementOnly.predicateFamiliesCandidate).not.toContain('inspect_incoming');
  });

  it('15–20. Provider coverage 3/3 and partials fail', () => {
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, EN_AAB326).ok).toBe(true);
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, EN_AAB326).covered.length)
      .toBe(3);
    const missingIncoming = [
      '• Handles warehouse paperwork daily.',
      '• Verifies documentation associated with received goods.',
      '• Coordinates with colleagues on the preparation and movement of merchandise.',
    ].join('\n');
    const miss = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, missingIncoming);
    expect(miss.ok).toBe(false);
    expect(miss.covered.length).toBe(2);
    expect(miss.uncovered).toEqual(['incoming_goods_inspection']);
    expect(englishWarehouseFactDiagId(miss.uncovered[0]!))
      .toBe('en_wh_incoming_goods_inspection');
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, '• Handles warehouse operations.').ok)
      .toBe(false);
    const dup = [
      '• Inspects incoming merchandise upon arrival at the warehouse.',
      '• Inspects incoming merchandise upon arrival at the warehouse.',
      '• Inspects incoming merchandise upon arrival at the warehouse.',
    ].join('\n');
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, dup).covered.length).toBe(1);
  });

  it('21–23. Translation coverage is 3 distinct facts', () => {
    expect(countEnglishWarehouseTranslatedFacts(ES_ATLAS, EN_AAB326)).toBe(3);
    const miss = countEnglishWarehouseTranslatedFacts(
      ES_ATLAS,
      [
        '• Verifies documentation associated with received goods.',
        '• Coordinates with colleagues on the preparation and movement of merchandise.',
      ].join('\n'),
    );
    expect(miss).toBe(2);
  });

  it('24–29. Deterministic fallback builds 3/3 self-consistent units', () => {
    const fb = buildEnglishWarehouseExperienceFallback({
      sourceDescription: ES_ATLAS,
      isPresent: true,
    });
    const units = splitExperienceBullets(fb).filter(Boolean);
    expect(units.length).toBe(3);
    const cov = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, fb);
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    const pred = scanEnglishWarehousePredicates(ES_ATLAS, fb);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    // Legacy combined shell must not pass 3/3 (documents why AAB-327 fallback failed).
    const legacy = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, LEGACY_COMBINED_SHELL);
    expect(legacy.ok).toBe(false);
    expect(legacy.uncovered).toContain('incoming_goods_inspection');
  });

  it('cross-locale English warehouse shells are independent facts', () => {
    const fb = buildCrossLocaleExperienceFallback({
      sourceDescription: ES_ATLAS,
      sourceLocale: 'es',
      targetLocale: 'en',
      gender: 'female',
      isPresent: true,
      position: 'Empleada de almacén',
    });
    expect(validateEnglishWarehouseExperienceCoverage(ES_ATLAS, fb).ok).toBe(true);
  });

  it('30. Provider 2/3 → dedicated English warehouse fallback selected', () => {
    const cv = atlasCv();
    cv.experience[0]!.description = ES_ATLAS;
    cv.experience[0]!.generatedDescription = ES_ATLAS;
    cv.experience[0]!.descriptionOrigin = 'user';
    const incomplete = [
      '• Verifies documentation associated with received goods.',
      '• Coordinates with colleagues on the preparation and movement of merchandise.',
      '• Handles warehouse operations.',
    ].join('\n');
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: incomplete,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'provider',
      operationSnapshot: atlasSnap(ES_ATLAS, ES_ATLAS),
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    const cov = validateEnglishWarehouseExperienceCoverage(ES_ATLAS, fin.text || '');
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    expect(cv.experience.find((e) => e.id === 'exp-rewitu')?.description)
      .toContain('Apoyó');
  });

  it('46. Valid provider 3/3 applies', () => {
    const cv = atlasCv();
    cv.experience[0]!.description = ES_ATLAS;
    cv.experience[0]!.generatedDescription = ES_ATLAS;
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
      operationSnapshot: atlasSnap(ES_ATLAS, ES_ATLAS),
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toContain('Inspects incoming merchandise');
  });
});
