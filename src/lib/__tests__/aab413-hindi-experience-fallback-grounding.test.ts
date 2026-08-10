/**
 * @vitest-environment jsdom
 *
 * AAB413 device regression: a non-empty Experience source must never be
 * replaced by a title-derived deterministic shell. Predicate truth is checked
 * per authoritative unit, including for cross-locale deterministic recovery.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { scanGenericExperiencePredicates } from '@/lib/cv-generic-experience-predicate-grounding';
import { buildHindiWarehouseExperienceFallback } from '@/lib/cv-hindi-experience-grounding';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceSelectedFinalCandidateSnapshot,
  validateVisibleExperienceCoverage,
} from '@/lib/cv-experience-phased-apply-329';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { buildSourcePreservingExperienceBulletsWithProvenance } from '@/lib/cv-localized-fallback';
import { validateProvenancedDeterministicFallbackCoverage } from '@/lib/cv-source-fact-identity';

const DEVICE_SOURCE = [
  'Proveravam dolaznu robu.',
  'Proveravam prateću dokumentaciju za primljenu robu.',
  'Koordiniram sa kolegama pripremu i kretanje robe.',
].join('\n');

const DEVICE_UNSAFE_HI = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const SAFE_HI = buildHindiWarehouseExperienceFallback({
  sourceDescription: DEVICE_SOURCE,
  isPresent: true,
  gender: 'female',
});

const ARBITRARY_SOFTWARE_SOURCE = [
  'Develop application features and APIs for the product.',
  'Test features with unit and integration checks.',
  'Document APIs and implementation details for the team.',
].join('\n');

const ARBITRARY_SOFTWARE_DE = formatExperienceBullets([
  'Entwickelt Anwendungsfunktionen und APIs für das Produkt.',
  'Testet Funktionen mit Unit- und Integrationstests.',
  'Dokumentiert APIs und Implementierungsdetails für das Team.',
]);

function deviceCv(): CVData {
  const current: WorkExperience = {
    id: 'exp-device-413',
    company: 'Current employer',
    position: 'Operater prijema robe',
    startDate: '2025-01',
    endDate: '',
    isPresent: true,
    description: DEVICE_SOURCE,
    originalUserDescription: DEVICE_SOURCE,
    canonicalDescription: DEVICE_SOURCE,
    descriptionOrigin: 'user',
  };
  const prior: WorkExperience = {
    id: 'exp-prior-413',
    company: 'Prior employer',
    position: 'Laboratory assistant',
    startDate: '2022-01',
    endDate: '2024-12',
    isPresent: false,
    description: 'Prepared laboratory samples.\nRecorded test observations.',
    originalUserDescription: 'Prepared laboratory samples.\nRecorded test observations.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-aab413',
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '',
      address: '',
      jobTitle: 'Operater prijema robe',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'sr',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

function finalizeDevice(candidate = DEVICE_UNSAFE_HI) {
  const cv = deviceCv();
  const operationSnapshot = createExperienceAiOperationSnapshot({
    liveText: DEVICE_SOURCE,
    locale: 'hi',
    requestId: 'req-aab413',
    jobContextHash: 'job-aab413',
    experienceEntryId: 'exp-device-413',
    authoritativeTextOverride: DEVICE_SOURCE,
    provenanceOriginOverride: 'originalUserDescription',
  });
  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'hi',
    gender: 'female',
    cv,
    candidate,
    originHint: 'deterministic_fallback',
    experienceId: 'exp-device-413',
    industry: 'general',
    level: 'mid',
    operationSnapshot,
  });
  return { cv, finalized };
}

describe('AAB413 shared deterministic Experience grounding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('rejects source-fact merge plus an invented replacement unit', () => {
    const scan = scanGenericExperiencePredicates(DEVICE_SOURCE, DEVICE_UNSAFE_HI);
    expect(scan.sourcePredicateIdentityCount).toBe(3);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(scan.candidateAddedPredicateCount).toBeGreaterThan(0);
    expect(scan.candidateAddedPredicateIdentityHashes.length).toBeGreaterThan(0);
  });

  it('accepts translated synonyms/paraphrases without a new material action', () => {
    const scan = scanGenericExperiencePredicates(
      ARBITRARY_SOFTWARE_SOURCE,
      ARBITRARY_SOFTWARE_DE,
    );
    expect(scan.sourcePredicateIdentityCount).toBe(3);
    expect(scan.candidatePredicateIdentityCount).toBe(3);
    expect(scan.candidateAddedPredicateCount).toBe(0);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('accepts a one-to-one safe Hindi projection', () => {
    const scan = scanGenericExperiencePredicates(DEVICE_SOURCE, SAFE_HI);
    expect(scan.sourcePredicateIdentityCount).toBe(3);
    expect(scan.candidatePredicateIdentityCount).toBe(3);
    expect(scan.candidateAddedPredicateCount).toBe(0);
    expect(scan.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('reports added predicates and unsupported claims truthfully for the shown unsafe candidate', () => {
    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: DEVICE_UNSAFE_HI,
      sourceDescription: DEVICE_SOURCE,
      candidateKind: 'deterministic_fallback',
      source: 'deterministic_fallback',
      targetLocale: 'hi',
      employmentState: 'current',
      meaningfulChangeDetected: true,
    });
    expect(snap.addedPredicateCount).toBeGreaterThan(0);
    expect(snap.unsupportedClaimCount).toBeGreaterThan(0);
    expect(snap.predicateCoveragePassed).toBe(false);
  });

  it('rejects an invented material action even when fallback provenance claims one-to-one mapping', () => {
    const mapped = buildSourcePreservingExperienceBulletsWithProvenance(
      DEVICE_SOURCE,
      'hi',
      'female',
      { isPresent: true },
    );
    const unsafeUnits = splitExperienceBullets(DEVICE_UNSAFE_HI);
    const rows: Array<{ unsupportedAdditionResult: boolean }> = [];
    const coverage = validateProvenancedDeterministicFallbackCoverage(
      DEVICE_SOURCE,
      mapped.bullets.map((bullet, index) => ({
        ...bullet,
        text: unsafeUnits[index] || bullet.text,
      })),
      { onFactResult: (row) => rows.push(row) },
    );
    expect(coverage.ok).toBe(false);
    expect(rows.some((row) => row.unsupportedAdditionResult)).toBe(true);
  });

  it('rejects an unsafe server fallback, selects the safe fallback, and is billable once', () => {
    const { finalized } = finalizeDevice();
    expect(finalized.diagnostics?.providerAccepted).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(finalized.text).toBe(SAFE_HI);
    expect(Number(finalized.diagnostics?.finalAddedPredicateCount)).toBe(0);
    expect(finalized.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('fails closed and stays non-billable when both provider and fallback are unsafe', () => {
    const source = [
      'Calibrates spectrometers for optical measurements.',
      'Replaces worn sensor housings.',
      'Labels sealed sample containers.',
    ].join('\n');
    const cv = deviceCv();
    cv.experience![0] = {
      ...cv.experience![0]!,
      position: 'Optical laboratory technician',
      description: source,
      originalUserDescription: source,
      canonicalDescription: source,
    };
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_UNSAFE_HI,
      originHint: 'deterministic_fallback',
      experienceId: 'exp-device-413',
      industry: 'general',
      level: 'mid',
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: source,
        locale: 'hi',
        requestId: 'req-aab413-unsafe',
        jobContextHash: 'job-aab413-unsafe',
        experienceEntryId: 'exp-device-413',
      }),
    });
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.blocked).toBe(true);
  });

  it('keeps multiple Experience entries isolated during safe apply', () => {
    const { cv, finalized } = finalizeDevice();
    const priorBefore = cv.experience![1]!.description;
    const applied = applyFinalizedBulletsToCv(cv, 'hi', 'exp-device-413', finalized);
    expect(applied.experience![0]!.description).toBe(SAFE_HI);
    expect(applied.experience![1]!.description).toBe(priorBefore);
  });

  it('makes visible post-write predicate truth match selected-final truth', () => {
    const { cv, finalized } = finalizeDevice();
    const applied = applyFinalizedBulletsToCv(cv, 'hi', 'exp-device-413', finalized);
    const visible = applied.experience![0]!.description;
    const truth = validateVisibleExperienceCoverage({
      sourceDescription: DEVICE_SOURCE,
      visibleText: visible,
      targetLocale: 'hi',
      finalNormalizedHash: fingerprintText((finalized.text || '').replace(/\s+/g, ' ').trim()),
    });
    expect(truth.visibleDescriptionMatchesFinalHash).toBe(true);
    expect(truth.visibleFactCoveragePassed).toBe(true);
    expect(truth.visiblePredicateCoveragePassed).toBe(true);

    const unsafeTruth = validateVisibleExperienceCoverage({
      sourceDescription: DEVICE_SOURCE,
      visibleText: DEVICE_UNSAFE_HI,
      targetLocale: 'hi',
      finalNormalizedHash: fingerprintText(DEVICE_UNSAFE_HI.replace(/\s+/g, ' ').trim()),
    });
    expect(unsafeTruth.visiblePredicateCoveragePassed).toBe(false);
  });
});
