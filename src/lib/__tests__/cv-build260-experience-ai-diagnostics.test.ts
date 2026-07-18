/**
 * @vitest-environment jsdom
 *
 * Build 260: non-PII Experience AI diagnostic trace — observation only.
 * Does not assert or alter validation outcomes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  assertExperienceAiDiagnosticHasNoCvText,
  clearExperienceAiDiagnosticsForTests,
  classifyExperienceScript,
  diagnoseExperienceSourceSelection,
  ExperienceAiDiagnosticSession,
  EXPERIENCE_AI_DIAG_STORAGE_KEY,
  getLatestExperienceAiDiagnostic,
  summarizeExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  resolveExperienceAiGrounding,
} from '@/lib/cv-experience-job-context';
import { freezeCanonicalExperienceDescription, formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL,
  EXPERIENCE_AI_TRACE_BUNDLE_MARKER,
  INTERNAL_AI_RESET_ENABLED,
} from '@/lib/build-channel';

const SR_DUTIES = [
  'Pregledam pristigle terenske izveštaje i označavam nepotpune unose.',
  'Ažuriram zajedničku tabelu sa najnovijim statusom.',
  'Koordinišem sa dva interna odeljenja kada nedostaju informacije.',
];
const SR_BLOCK = SR_DUTIES.join('\n');
const EN_BLOCK = [
  'Review incoming field reports and mark incomplete entries.',
  'Update the shared tracking sheet with the latest status.',
  'Coordinate with two internal departments when information is missing.',
].join('\n');

function baseExp(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp-1',
    company: 'Atlas',
    position: 'Koordinatorka terenske dokumentacije',
    startDate: '2025-03',
    endDate: '',
    isPresent: true,
    description: SR_BLOCK,
    originalUserDescription: SR_BLOCK,
    canonicalDescription: SR_BLOCK,
    descriptionOrigin: 'user',
    ...overrides,
  };
}

function device260Cv(expOverrides?: Partial<WorkExperience>): CVData {
  return {
    id: 'cv-260',
    name: 'CV',
    personal: {
      fullName: 'Ana Test',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: 'Koordinatorka terenske dokumentacije',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'sr',
    experience: [baseExp(expOverrides)],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    createdAt: '',
    updatedAt: '',
  };
}

describe('Build 260 Experience AI non-PII diagnostics', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exact Serbian fixture: session records source units and identities without PII', () => {
    const cv = device260Cv();
    const exp = cv.experience[0];
    const ctx = buildExperienceJobContext({
      position: exp.position,
      industry: 'other',
      locale: 'sr',
      level: 'mid',
    });
    const grounding = resolveExperienceAiGrounding(
      exp,
      ctx,
      freezeCanonicalExperienceDescription,
    );
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      contentLocale: 'sr',
      templateId: 'modern-minimal',
      gender: 'female',
      industryNorm: ctx.industryNorm,
      levelNorm: ctx.levelNorm,
      jobContextHash: ctx.key,
      requestId: 'req-260-a',
      usageCountBefore: 3,
    });
    session.stage('button_pressed', 'ok');
    session.recordLiveExperience(exp, true);
    session.recordSourceSelection(exp, grounding);
    session.recordPayloadBuilt({
      locale: 'sr',
      industryNorm: ctx.industryNorm,
      levelNorm: ctx.levelNorm,
      isPresent: true,
    });
    const trace = session.commit();
    expect(trace.sourceUnitCount).toBe(3);
    expect(trace.sourceFactIdentityCount).toBe(3);
    expect(trace.sourceUnitHashes).toHaveLength(3);
    expect(trace.sourceScript).toBe('latin_diacritic');
    expect(trace.factLockEnabled).toBe(true);
    expect(trace.selectedSourceKind).not.toBe('none');
    expect(assertExperienceAiDiagnosticHasNoCvText(trace)).toEqual([]);
    expect(JSON.stringify(trace)).not.toMatch(/Atlas|Ana Test|Koordinatorka|Pregledam/);
  });

  it('stale English metadata + Serbian textarea: selection metadata surfaces override', () => {
    const exp = baseExp({
      description: SR_BLOCK,
      originalUserDescription: EN_BLOCK,
      canonicalDescription: EN_BLOCK,
      descriptionOrigin: 'user',
    });
    const ctx = buildExperienceJobContext({
      position: exp.position,
      industry: 'other',
      locale: 'sr',
      level: 'mid',
    });
    const grounding = resolveExperienceAiGrounding(
      exp,
      ctx,
      freezeCanonicalExperienceDescription,
    );
    const selection = diagnoseExperienceSourceSelection(
      exp,
      grounding.sourceDescription,
      grounding.groundingSource,
    );
    // Textarea Serbian must appear among candidates (hash present in rejected or selected).
    const textareaHash = fingerprintText(SR_BLOCK);
    expect(
      selection.selectedSourceHash === textareaHash
      || selection.currentTextareaIgnoredOrOverridden,
    ).toBe(true);
    // When English canonical/original wins, diagnostics must flag the override.
    if (selection.selectedSourceHash !== textareaHash) {
      expect(selection.currentTextareaIgnoredOrOverridden).toBe(true);
      expect(selection.englishSourceStillAuthoritative).toBe(true);
      expect(selection.rejectedStaleSourceKinds).toContain('description');
    }
  });

  it('provider rejection path records fail stage and usage +0', () => {
    const cv = device260Cv();
    const exp = cv.experience[0];
    const ctx = buildExperienceJobContext({
      position: exp.position,
      industry: 'other',
      locale: 'sr',
      level: 'mid',
    });
    const grounding = resolveExperienceAiGrounding(
      exp,
      ctx,
      freezeCanonicalExperienceDescription,
    );
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      templateId: 'modern-minimal',
      gender: 'female',
      industryNorm: ctx.industryNorm,
      levelNorm: ctx.levelNorm,
      jobContextHash: ctx.key,
      requestId: 'req-reject',
      usageCountBefore: 5,
    });
    session.stage('button_pressed', 'ok');
    session.recordLiveExperience(exp, true);
    session.recordSourceSelection(exp, grounding);
    session.recordPayloadBuilt({
      locale: 'sr',
      industryNorm: ctx.industryNorm,
      levelNorm: ctx.levelNorm,
      isPresent: true,
    });
    session.recordApiResponse({
      httpStatus: 200,
      resultText: formatExperienceBullets([SR_DUTIES[0]]),
    });
    session.recordRaceCheck(true, undefined, ctx.key);
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: 'Completely unrelated English invention with guests and rapport.',
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
      jobContext: ctx,
    });
    session.recordFinalizeResult(finalized);
    // Observation only — do not assert validation outcome; record whatever happened.
    if (finalized.blocked || !finalized.countedAsSuccess) {
      session.recordVisibleApply(false, 5);
    } else {
      session.recordVisibleApply(true, 6);
    }
    const trace = session.commit();
    expect(trace.usageCountBefore).toBe(5);
    if (!trace.countedAsSuccess) {
      expect(trace.usageCountAfter).toBe(5);
      expect(trace.finalTypedFailureReason).toBeTruthy();
      expect(trace.rejectionStage).toBeTruthy();
    }
    expect(assertExperienceAiDiagnosticHasNoCvText(trace)).toEqual([]);
  });

  it('race-context rejection records raceGuardResult=fail', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      templateId: 'modern-minimal',
      jobContextHash: 'ctx-a',
      requestId: 'req-race',
      usageCountBefore: 0,
    });
    session.stage('button_pressed', 'ok');
    session.recordRaceCheck(false, 'stale_request_or_context_mismatch', 'ctx-b');
    session.recordVisibleApply(false, 0);
    const trace = session.commit();
    expect(trace.raceGuardResult).toBe('fail');
    expect(trace.rejectionStage).toBe('race_context_check');
    expect(trace.finalTypedFailureReason).toBe('stale_request_or_context_mismatch');
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountAfter).toBe(0);
  });

  it('locale mismatch / incomplete coverage / success apply leave typed fields', () => {
    const cv = device260Cv();
    const sessionOk = new ExperienceAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      templateId: 'modern-minimal',
      jobContextHash: 'ctx',
      requestId: 'req-ok',
      usageCountBefore: 1,
    });
    const grounding = resolveExperienceAiGrounding(
      cv.experience[0],
      buildExperienceJobContext({
        position: cv.experience[0].position,
        industry: 'other',
        locale: 'sr',
        level: 'mid',
      }),
      freezeCanonicalExperienceDescription,
    );
    sessionOk.recordSourceSelection(cv.experience[0], grounding);
    sessionOk.recordApiResponse({ httpStatus: 200, resultText: '' });
    const applied = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: '',
      experienceId: 'exp-1',
      industry: 'other',
      level: 'mid',
    });
    sessionOk.recordFinalizeResult(applied);
    if (applied.countedAsSuccess) {
      sessionOk.recordVisibleApply(true, 2);
      const t = sessionOk.commit();
      expect(t.countedAsSuccess).toBe(true);
      expect(t.usageCountAfter).toBe(2);
      expect(t.fallbackSelected || t.finalBulletCount >= 1).toBe(true);
    } else {
      sessionOk.recordVisibleApply(false, 1);
      const t = sessionOk.commit();
      expect(t.countedAsSuccess).toBe(false);
      expect(t.finalTypedFailureReason).toBeTruthy();
    }
  });

  it('diagnostics persist across simulated navigation/restart via localStorage', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      templateId: 'modern-minimal',
      jobContextHash: 'ctx-persist',
      requestId: 'req-persist',
      usageCountBefore: 2,
    });
    session.stage('button_pressed', 'ok');
    session.patch({
      finalTypedFailureReason: 'experience_material_fact_coverage_incomplete',
      rejectionStage: 'final_apply_postcondition',
      sourceUnitCount: 3,
      requiredFactCount: 3,
      coveredFactCount: 1,
      selectedSourceKind: 'canonicalDescription',
      fallbackCoveredFactCount: 0,
    });
    session.recordVisibleApply(false, 2);
    const committed = session.commit();
    expect(localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY)).toBeTruthy();
    // Simulate in-memory loss while storage survives (navigation / cold start).
    // clearExperienceAiDiagnosticsForTests wipes both — rehydrate storage only.
    const raw = localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    clearExperienceAiDiagnosticsForTests();
    expect(getLatestExperienceAiDiagnostic()).toBeNull();
    localStorage.setItem(EXPERIENCE_AI_DIAG_STORAGE_KEY, raw || JSON.stringify(committed));
    const restored = getLatestExperienceAiDiagnostic();
    expect(restored?.finalTypedFailureReason).toBe('experience_material_fact_coverage_incomplete');
    expect(restored?.selectedSourceKind).toBe('canonicalDescription');
    expect(restored?.sourceUnitCount).toBe(3);
    expect(summarizeExperienceAiDiagnostic(restored)?.typedFailureReason).toBe(
      'experience_material_fact_coverage_incomplete',
    );
  });

  it('script classifier covers Latin diacritic Serbian', () => {
    expect(classifyExperienceScript(SR_BLOCK)).toBe('latin_diacritic');
    expect(classifyExperienceScript(EN_BLOCK)).toBe('latin');
  });

  it('production-disabled build omits Experience AI diagnostics UI strings when gate false', async () => {
    if (!INTERNAL_AI_RESET_ENABLED) {
      expect(EXPERIENCE_AI_TRACE_BUNDLE_MARKER).toBe('');
      expect(EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL).toBe('');
    } else {
      expect(EXPERIENCE_AI_TRACE_BUNDLE_MARKER).toBe('CVPRO_EXPERIENCE_AI_TRACE_V1');
      expect(EXPERIENCE_AI_COPY_DIAGNOSTICS_LABEL).toBe('Copy Experience AI diagnostics');
    }
  });

  it('modal section is absent when gate disabled; present strings only when enabled', async () => {
    const React = await import('react');
    const mod = await import('@/components/CvExportDiagnosticsControls');
    render(
      React.createElement(mod.CvExportDiagnosticsModal, {
        open: true,
        onClose: () => {},
      }),
    );
    if (!INTERNAL_AI_RESET_ENABLED) {
      expect(screen.queryByTestId('experience-ai-diagnostics-section')).toBeNull();
    } else {
      expect(screen.getByTestId('experience-ai-diagnostics-section')).toBeTruthy();
      expect(screen.getByText('Experience AI diagnostics')).toBeTruthy();
      expect(screen.getByText('Copy Experience AI diagnostics')).toBeTruthy();
    }
  });
});
