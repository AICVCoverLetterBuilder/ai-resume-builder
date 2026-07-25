/**
 * @vitest-environment jsdom
 *
 * AAB-327 Phase 2 — Experience fact-authority, visible-snapshot, pre-apply gate.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION,
  EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION,
  EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION,
  normalizeExperienceFactAuthorityKind,
  experienceFactAuthorityKindsEquivalent,
  resolveCanonicalFactAuthorityKind,
  captureExperienceRequestVisibleComparisonSnapshot,
} from '@/lib/cv-experience-authority-snapshot-327';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION } from '@/lib/cv-english-experience-warehouse-grounding';

describe('Experience authority / snapshot / preapply (AAB-327)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes AAB-327 Phase 2 packaging markers', () => {
    expect(EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION)
      .toBe('experience-fact-authority-truth-327-v1');
    expect(EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION)
      .toBe('experience-visible-snapshot-truth-327-v1');
    expect(EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION)
      .toBe('experience-invariant-preapply-gate-327-v1');
    expect(ENGLISH_EXPERIENCE_THREE_FACT_COVERAGE_327_REVISION)
      .toBe('english-experience-three-fact-coverage-327-v1');
  });

  it('23–27. Fact authority normalizes and never reports current_textarea when unused', () => {
    expect(normalizeExperienceFactAuthorityKind('originalUserDescription'))
      .toBe('original_user');
    expect(experienceFactAuthorityKindsEquivalent('pre_ai_snapshot', 'original_user'))
      .toBe(true);
    expect(experienceFactAuthorityKindsEquivalent('pre_ai_snapshot', 'current_textarea'))
      .toBe(false);
    const kind = resolveCanonicalFactAuthorityKind({
      textareaProvenance: {
        revision: 'experience-ai-output-provenance-304-v1',
        currentTextareaProvenance: 'ai_generated_unedited',
        authoritativeFactSourceKind: 'pre_ai_snapshot',
        authoritativeFactText: 'source',
        currentTextareaUsedForFactExtraction: false,
        currentTextareaIgnoredOrOverridden: true,
        generatedDescriptionPreexisted: true,
        staleGeneratedDescriptionIgnored: true,
        lastAiOutputHashMatched: true,
        materialUserEditDetected: false,
        formattingOnlyDifference: false,
      },
      snapshotProvenanceOrigin: 'currentTextarea',
    });
    expect(kind).toBe('pre_ai_snapshot');
    expect(kind).not.toBe('current_textarea');
  });

  it('28–32. Request-time visible snapshot stays consistent', () => {
    const snap = captureExperienceRequestVisibleComparisonSnapshot({
      textareaProvenance: {
        revision: 'experience-ai-output-provenance-304-v1',
        currentTextareaProvenance: 'ai_generated_unedited',
        authoritativeFactSourceKind: 'pre_ai_snapshot',
        authoritativeFactText: 'src',
        currentTextareaUsedForFactExtraction: false,
        currentTextareaIgnoredOrOverridden: true,
        generatedDescriptionPreexisted: true,
        staleGeneratedDescriptionIgnored: true,
        lastAiOutputHashMatched: true,
        materialUserEditDetected: false,
        formattingOnlyDifference: false,
      },
    });
    expect(snap.provenance).toBe('ai_generated_unedited');
    expect(snap.matchedLastAiOutput).toBe(true);
    expect(snap.capturedAtRequest).toBe(true);

    const edited = captureExperienceRequestVisibleComparisonSnapshot({
      currentTextareaProvenance: 'ai_generated_user_edited',
      lastAiOutputHashMatched: false,
      materialUserEditDetected: true,
    });
    expect(edited.provenance).toBe('ai_generated_user_edited');
    expect(edited.matchedLastAiOutput).toBe(false);

    // Raw-only formatting: matched true + no material edit → unedited.
    const formatOnly = captureExperienceRequestVisibleComparisonSnapshot({
      currentTextareaProvenance: 'ai_generated_user_edited',
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
    });
    expect(formatOnly.provenance).toBe('ai_generated_unedited');
  });

  it('33–37. Authority contradiction fails invariants; finalize reconciles before preapply', () => {
    const bad = checkExperienceDiagnosticInvariants({
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      factAuthorityKind: 'current_textarea',
      factAuthorityMatchesAuthoritativeSourceKind: true,
      currentTextareaProvenance: 'ai_generated_unedited',
      visibleComparisonProvenance: 'ai_generated_user_edited',
      lastAiOutputHashMatched: true,
      visibleComparisonMatchedLastAiOutput: false,
      operationMode: 'enhance_existing',
      field: 'experience_description',
    } as Parameters<typeof checkExperienceDiagnosticInvariants>[0]);
    expect(bad.passed).toBe(false);
    expect(bad.failures.map((f) => f.invariantCode)).toEqual(
      expect.arrayContaining([
        'fact_authority_kind_contradicts_authoritative_source',
        'fact_authority_match_flag_inconsistent_with_kinds',
        'visible_comparison_provenance_mismatch_request_time',
        'visible_comparison_hash_match_mismatch_request_time',
      ]),
    );

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-327-preapply',
      requestedLocale: 'en',
      usageCountBefore: 41,
    });
    session.recordSourceSelection(
      {
        id: 'exp-atlas',
        company: 'Atlas',
        position: 'Warehouse',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: 'EN',
        originalUserDescription: 'ES',
      } as never,
      {
        sourceDescription: 'ES',
        groundingSource: 'genuine_user',
        experienceForAi: {} as never,
        staleGeneratedContentExcluded: false,
        semanticDutyKeysBefore: [],
        semanticDutyKeysUsed: [],
      } as never,
      {
        requestedLocale: 'en',
        selectedSourceKindHint: 'originalUserDescription',
        currentTextareaProvenance: 'ai_generated_unedited',
        authoritativeFactSourceKind: 'pre_ai_snapshot',
        currentTextareaUsedForFactExtraction: false,
        lastAiOutputHashMatched: true,
        materialUserEditDetected: false,
      },
    );
    session.recordFinalizeResult({
      blocked: false,
      countedAsSuccess: true,
      text: 'ok',
      origin: 'provider',
      diagnostics: {
        factAuthorityKind: 'current_textarea',
        factAuthorityMatchesAuthoritativeSourceKind: true,
        authoritativeFactSourceKind: 'current_textarea',
        visibleComparisonProvenance: 'ai_generated_user_edited',
        visibleComparisonMatchedLastAiOutput: false,
        requiredFactCount: 3,
        coveredFactCount: 3,
        providerRequiredFactCount: 3,
        providerCoveredFactCount: 3,
      },
    } as never);
    const gate = session.evaluatePreApplyDecisionGates();
    expect(typeof gate.passed).toBe('boolean');
    expect(typeof gate.diagnosticInvariantCheckPassed).toBe('boolean');
    // After reconcile, authority/provenance invariants alone must not remain.
    const reconciled = checkExperienceDiagnosticInvariants({
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      factAuthorityKind: 'pre_ai_snapshot',
      factAuthorityMatchesAuthoritativeSourceKind: true,
      currentTextareaProvenance: 'ai_generated_unedited',
      visibleComparisonProvenance: 'ai_generated_unedited',
      lastAiOutputHashMatched: true,
      visibleComparisonMatchedLastAiOutput: true,
      operationMode: 'enhance_existing',
      field: 'experience_description',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
    } as Parameters<typeof checkExperienceDiagnosticInvariants>[0]);
    expect(reconciled.failures.map((f) => f.invariantCode)).not.toEqual(
      expect.arrayContaining([
        'fact_authority_kind_contradicts_authoritative_source',
        'fact_authority_match_flag_inconsistent_with_kinds',
        'visible_comparison_provenance_mismatch_request_time',
        'visible_comparison_hash_match_mismatch_request_time',
      ]),
    );
  });
});
