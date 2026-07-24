/**
 * AAB-316 Phase 2 — final decision diagnostic truth.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  SUMMARY_RUNTIME_MARKER_SET,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData, WorkExperience } from '@/lib/types';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION,
  SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION,
  SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION,
  EXPERIENCE_FINAL_DECISION_TRUTH_316_REVISION,
} from '@/lib/cv-spanish-experience-semantic-delta';

const REF = '2026-07-24';

const ATLAS_PAST = formatExperienceBullets([
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const ATLAS_PRESENT = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

function spanishFixture(desc: string): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: desc,
    originalUserDescription: desc,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  return {
    personal: {
      fullName: 'Test User',
      jobTitle: localizeWarehouseEmployee('es', 'female'),
      email: 't@example.com',
      phone: '',
      location: '',
      summary: '',
    },
    experience: [current],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
  };
}

describe('AAB-316 Phase 2 markers', () => {
  it('keeps all four 316 markers in SUMMARY_RUNTIME_MARKER_SET', () => {
    for (const m of [
      EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION,
      SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION,
      SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION,
      EXPERIENCE_FINAL_DECISION_TRUTH_316_REVISION,
    ]) {
      expect(SUMMARY_RUNTIME_MARKER_SET).toContain(m);
    }
  });
});

describe('AAB-316 tense-normalizer success diagnostics', () => {
  it('successful tense normalizer reports bullet counts and no empty_fallback reason', () => {
    const cv = spanishFixture(ATLAS_PAST);
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: ATLAS_PAST,
      locale: 'es',
      requestId: 'req-316-diag-tense',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: ATLAS_PAST,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toMatch(/tense|deterministic/);
    expect(fin.diagnostics?.clientDeterministicFallbackBulletCount).toBe(3);
    expect(fin.diagnostics?.clientDeterministicFallbackCoveredFactCount).toBeGreaterThan(0);
    expect(fin.diagnostics?.typedFailureReason).not.toBe('empty_fallback');
    expect(fin.diagnostics?.canonicalAcceptancePassed).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_tense_fixed']);
  });
});

describe('AAB-316 already-valid no-op diagnostics', () => {
  it('exact present echo reports no-op without material improvement', () => {
    const cv = spanishFixture(ATLAS_PRESENT);
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-316-diag-noop',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PRESENT,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: ATLAS_PRESENT,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.blocked).toBe(true);
    expect(fin.diagnostics?.materialImprovementDetected).not.toBe(true);
    expect(fin.diagnostics?.sourceAlreadyValidForTarget).toBe(true);
  });
});
