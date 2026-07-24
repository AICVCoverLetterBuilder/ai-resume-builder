/**
 * AAB-318 Phase 2 — terminal diagnostic consistency (stages, bullets, apply N/A).
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  SUMMARY_RUNTIME_MARKER_SET,
  finalizeCvAiFieldForApply,
  EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION,
  EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION,
  EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION,
  EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION,
} from '@/lib/cv-ai-finalize-apply';
import {
  EXPERIENCE_CLEAN_NOOP_STAGE_PLAN,
} from '@/lib/cv-experience-terminal-outcome';
import type { CVData, WorkExperience } from '@/lib/types';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceAiOutputProvenance,
} from '@/lib/cv-experience-ai-output-provenance';
import {
  checkExperienceDiagnosticInvariants,
  checkExperienceDiagnosticCompleteness,
  CV_AI_DIAGNOSTIC_REQUIRED_ASSET_STRINGS,
} from '@/lib/cv-ai-diagnostics-contract';
import { ExperienceAiDiagnosticSession } from '@/lib/cv-experience-ai-diagnostics';

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

function atlasCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: ATLAS_PRESENT,
    preAiFactText: ATLAS_PAST,
    sourceLocale: 'es',
    targetLocale: 'es',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'pre_ai_snapshot',
  });
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: ATLAS_PRESENT,
    originalUserDescription: ATLAS_PAST,
    generatedDescription: ATLAS_PRESENT,
    descriptionOrigin: 'ai_generated',
    contentLocale: 'es',
    aiOutputProvenance: provenance,
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

describe('AAB-318 Phase 2 markers / assets', () => {
  it('keeps 318 markers reachable in runtime and asset strings', () => {
    for (const m of [
      EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION,
      EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION,
      EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION,
      EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION,
    ]) {
      expect(SUMMARY_RUNTIME_MARKER_SET).toContain(m);
      expect(CV_AI_DIAGNOSTIC_REQUIRED_ASSET_STRINGS).toContain(m);
    }
  });
});

describe('AAB-318 terminal stage / usage consistency', () => {
  it('clean no-op stages skip apply/usage without reject wording', () => {
    const cv = atlasCv();
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-318-stages',
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
      candidate: '',
      experienceId: 'exp-atlas',
      industry: 'logistics',
      level: 'mid',
      operationSnapshot: snap,
      earlyUneditedRerunNoOp: true,
    });
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'es',
      requestedLocale: 'es',
      contentLocale: 'es',
      templateId: 'modern',
      jobContextHash: 'j',
      requestId: 'req-318-stages',
      usageCountBefore: 30,
    });
    session.patch({ appVersionCode: '318', appVersionName: '1.0.318' });
    session.recordExperienceEntryTarget({
      experienceEntryId: 'exp-atlas',
      isPresent: true,
    });
    session.recordFinalizeResult(fin);
    // Legacy callers may still invoke recordVisibleApply(false) — must not corrupt.
    session.recordVisibleApply(false, 30);
    const trace = session.commit();
    expect(trace.usageCountBefore).toBe(30);
    expect(trace.usageCountAfter).toBe(30);
    expect(trace.applyAttempted).toBe(false);
    expect(trace.raceGuardResult).toBe('not_required');
    expect(trace.finalTypedFailureReason).toBeNull();
    expect(trace.rejectionStage).toBeNull();
    const stages = Array.isArray(trace.stages) ? trace.stages : [];
    expect(stages.some((s) => s.result === 'fail')).toBe(false);
    for (const plan of EXPERIENCE_CLEAN_NOOP_STAGE_PLAN) {
      const hit = stages.find((s) => s.stage === plan.stage);
      expect(hit, plan.stage).toBeTruthy();
      expect(hit?.result).toBe(plan.result);
      if (plan.typedReason) expect(hit?.typedReason).toBe(plan.typedReason);
    }
    expect(stages.some((s) => String(s.typedReason || '').includes('reject'))).toBe(false);
    const inv = checkExperienceDiagnosticInvariants(trace as Record<string, unknown>);
    expect(inv.passed, JSON.stringify(inv.failures)).toBe(true);
    const comp = checkExperienceDiagnosticCompleteness(trace as Record<string, unknown>);
    expect(comp.passed, JSON.stringify(comp)).toBe(true);
  });

  it('count/script pairs stay consistent on clean no-op', () => {
    const cv = atlasCv();
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-318-scripts',
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
      candidate: '',
      experienceId: 'exp-atlas',
      industry: 'logistics',
      level: 'mid',
      operationSnapshot: snap,
      earlyUneditedRerunNoOp: true,
    });
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'es',
      requestedLocale: 'es',
      contentLocale: 'es',
      templateId: 'modern',
      jobContextHash: 'j',
      requestId: 'req-318-scripts',
      usageCountBefore: 30,
    });
    session.patch({ appVersionCode: '318', appVersionName: '1.0.318' });
    session.recordExperienceEntryTarget({ experienceEntryId: 'exp-atlas', isPresent: true });
    session.recordFinalizeResult(fin);
    const trace = session.commit();
    expect(trace.finalBulletCount).toBe(0);
    expect(trace.finalBulletScripts).toEqual([]);
    expect(trace.finalCandidateBulletCount).toBe(0);
    expect(trace.finalCandidateBulletScripts).toEqual([]);
    expect(trace.appliedFinalBulletCount).toBe(0);
    expect(trace.appliedFinalBulletScripts).toEqual([]);
    expect(trace.providerBulletCount).toBe(0);
    expect(trace.providerBulletScripts).toEqual([]);
  });
});
