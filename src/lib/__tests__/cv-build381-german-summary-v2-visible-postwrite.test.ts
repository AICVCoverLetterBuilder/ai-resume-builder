/**
 * AAB-381 — German Summary V2 post-write visible validation.
 * Device failure: valid DE candidate rolled back with
 * visible_current_duty_required_set_missing because visible path rebuilt
 * warehouse canonical facts from V2 entry-owned IDs (empty set).
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  normalizeSummaryCandidateText,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
  GERMAN_SUMMARY_V2_VISIBLE_POSTWRITE_381_REVISION,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  setSummaryV2EnabledForTests,
  SUMMARY_V2_REVISION,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';

const REF = '2026-07-01';

const WH_DE = [
  'prüft eingehende Waren',
  'prüft Dokumentation zu erhaltenen Waren',
  'koordiniert mit Kolleginnen die Vorbereitung und Bewegung der Waren',
].join('\n');

const GD_DE = [
  'erstellte visuelle Materialien und grafische Elemente',
  'überprüfte und passte Designmaterialien an',
  'bereitete finale Designdateien für Formate und Bildschirme vor',
].join('\n');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function twoEntryEmptyGermanCv(): CVData {
  return {
    id: 'aab-381-de-v2-visible',
    name: 'DE V2 Visible',
    personal: {
      fullName: 'Anna Beispiel',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'atlas',
        position: 'Lagermitarbeiterin',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_DE,
        canonicalDescription: WH_DE,
        descriptionOrigin: 'user',
        generatedLocale: 'de',
      },
      {
        id: 'rewitu',
        position: 'Grafikdesignerin',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_DE,
        canonicalDescription: GD_DE,
        descriptionOrigin: 'user',
        generatedLocale: 'de',
      },
    ],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern',
    region: 'EU',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    contentLocale: 'de',
  };
}

describe('AAB-381 German Summary V2 post-write visible validation', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(11);
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('marker is reachable', () => {
    expect(GERMAN_SUMMARY_V2_VISIBLE_POSTWRITE_381_REVISION).toBe(
      'german-summary-v2-visible-postwrite-381-v1',
    );
  });

  it('stale React empty Summary must not be used after temporary write', () => {
    const cv = twoEntryEmptyGermanCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.origin).toBe('deterministic_fallback');

    // Temporary write into operation-owned CV/ref.
    const written = applyFinalizedSummaryToCv(cv, 'de', fin);
    expect((written.summary || '').trim().length).toBeGreaterThan(40);

    // Device-shaped stale pre-write React/render snapshot.
    const staleReactSummary = '';
    expect(staleReactSummary).toBe('');

    const visibleFromOwned = resolveAuthoritativeVisibleSummaryText({
      operationOwnedSummary: written.summary,
      staleReactSummary,
    });
    expect(visibleFromOwned).toBe(written.summary);
    expect(visibleFromOwned).not.toBe(staleReactSummary);

    // Reproducing the bug: feeding stale empty text fails visible gates.
    const badSession = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-381-stale-empty',
      usageCountBefore: 11,
      operationMode: 'generate_from_context',
    });
    badSession.recordFinalizeResult(fin);
    expect(badSession.evaluatePreApplyDecisionGates().passed).toBe(true);
    badSession.recordVisibleApply(true, 11, staleReactSummary);
    expect(badSession.visibleApplySucceeded).toBe(false);
  });

  it('two-entry empty Summary: post-write visible 3/3+3/3, hash match, usage 11→12', () => {
    const cv = twoEntryEmptyGermanCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_V2_REVISION);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.requiredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(
      (fin.diagnostics?.requiredCurrentDutyFactIds || []).every((id) =>
        String(id).startsWith('v2_entry_')),
    ).toBe(true);

    const written = applyFinalizedSummaryToCv(cv, 'de', fin);
    const staleReactSummary = ''; // empty pre-write React state
    const visibleText = resolveAuthoritativeVisibleSummaryText({
      operationOwnedSummary: written.summary,
      staleReactSummary,
    });

    const before = getProAiUsageCount();
    expect(before).toBe(11);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-381-de-v2-postwrite',
      usageCountBefore: before,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed).toBe(true);
    expect(pre.diagnosticInvariantCheckPassed).toBe(true);
    expect(pre.diagnosticCompletenessPassed).toBe(true);

    session.recordVisibleApply(true, before, visibleText);
    expect(session.visibleApplySucceeded).toBe(true);
    expect(session.draft.visibleRequiredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleRequiredPriorDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredPriorDutyFactCount).toBe(3);
    expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(true);
    expect(session.draft.visiblePriorDutyCoveragePassed).toBe(true);
    expect(session.draft.visibleCurrentDutyRequiredFactParityPassed).toBe(true);
    expect(session.draft.visibleSummaryMatchesFinalHash).toBe(true);
    expect(session.draft.visibleDurationScopeValidationPassed).toBe(true);
    expect(session.draft.raceGuardResult).toBe('ok');
    expect(session.draft.visibleCandidateHashAfterApply).toBe(
      fingerprintText(normalizeSummaryCandidateText(visibleText) || 'empty'),
    );
    expect(session.draft.visibleCandidateHashAfterApply).toBe(
      fin.diagnostics?.finalValidatedCandidateHash
      ?? fin.diagnostics?.finalNormalizedHash,
    );

    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: before + 1 });
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(12);
    expect(getProAiUsageCount()).toBe(12);
    expect(trace.rejectionStage).toBeNull();
    expect(trace.finalTypedFailureReason).toBeNull();
  });

  it('real visible hash mismatch still rolls back without usage', () => {
    const cv = twoEntryEmptyGermanCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });
    const written = applyFinalizedSummaryToCv(cv, 'de', fin);
    const mutated = `${written.summary || ''} Zusätzliche ungeprüfte Aussage.`;

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-381-hash-mismatch',
      usageCountBefore: 11,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    session.recordVisibleApply(true, 11, mutated);
    expect(session.visibleApplySucceeded).toBe(false);
    const draft = (session as unknown as {
      draft: {
        visibleSummaryMatchesFinalHash?: boolean | null;
        raceGuardResult?: string | null;
        actualRaceDetected?: boolean | null;
        finalTypedFailureReason?: string | null;
        visibleApplyFailureStage?: string | null;
      };
    }).draft;
    expect(draft.visibleSummaryMatchesFinalHash).toBe(false);
    // AAB-387: visible/persisted mismatch is a state-commit failure, not a source race.
    expect(draft.raceGuardResult).toBe('ok');
    expect(draft.actualRaceDetected).toBe(false);
    expect(draft.finalTypedFailureReason).toBe('summary_state_write_failed');
    expect(draft.visibleApplyFailureStage).toBe('post_write_visible_hash_mismatch');
    expect(getProAiUsageCount()).toBe(11);
  });
});
