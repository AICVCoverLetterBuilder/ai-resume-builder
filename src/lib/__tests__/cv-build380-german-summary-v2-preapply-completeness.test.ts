/**
 * AAB-380 — German Summary V2 deterministic preapply diagnostic completeness.
 * Two-entry Generate must populate required DE fields before the preapply gate.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import {
  buildGermanSummaryV2PreapplyCompletenessFields,
  GERMAN_SUMMARY_V2_PREAPPLY_COMPLETENESS_380_REVISION,
  validateGermanGeneratedCaseGrammar,
} from '@/lib/cv-german-summary-grounding';
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

function twoEntryGermanCv(summary = ''): CVData {
  return {
    id: 'aab-380-de-summary-v2',
    name: 'DE V2 Fixture',
    personal: {
      fullName: 'Anna Beispiel',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary,
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

function runGenerate(cv: CVData, candidate = '') {
  const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
  return finalizeCvAiFieldForApply({
    action: 'summary_generate',
    field: 'summary',
    requestedLocale: 'de',
    gender: 'female',
    cv,
    candidate,
    referenceDateIso: REF,
    durationSnapshot: duration,
  });
}

describe('AAB-380 German Summary V2 preapply diagnostic completeness', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(8);
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('marker is reachable', () => {
    expect(GERMAN_SUMMARY_V2_PREAPPLY_COMPLETENESS_380_REVISION).toBe(
      'german-summary-v2-preapply-completeness-380-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      GERMAN_SUMMARY_V2_PREAPPLY_COMPLETENESS_380_REVISION,
    );
  });

  it('two-entry Generate: deterministic applies once; usage 8→9; fields non-null', () => {
    const cv = twoEntryGermanCv();
    const fin = runGenerate(cv);

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_V2_REVISION);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.requiredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);

    expect(fin.diagnostics?.germanControlledCaseGrammarPassed).toBe(true);
    expect(fin.diagnostics?.materialCategoryCoverageUsedForFinalAcceptance).toBe(false);
    expect(fin.diagnostics?.authoritativeCanonicalCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.classifiedRequiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.unclassifiedAuthoritativeCurrentDutyFactCount).toBe(0);
    expect(fin.diagnostics?.requiredFactSetMatchesAuthoritativeFactSet).toBe(true);
    expect(fin.diagnostics?.currentDutyRequiredFactParityPassed).toBe(true);

    const before = getProAiUsageCount();
    expect(before).toBe(8);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-380-de-v2-generate',
      usageCountBefore: before,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed).toBe(true);
    expect(pre.diagnosticInvariantCheckPassed).toBe(true);
    expect(pre.diagnosticCompletenessPassed).toBe(true);
    expect(pre.reason).toBeNull();
    expect(session.draft.nullRequiredDiagnosticFields || []).toEqual([]);

    const applied = applyFinalizedSummaryToCv(cv, 'de', fin);
    expect((applied.summary || '').trim().length).toBeGreaterThan(40);
    expect(applied.summary).toMatch(/Atlas/i);
    expect(applied.summary).toMatch(/Rewitu/i);

    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(9);
  });

  it('invalid German grammar still blocks apply and usage', () => {
    const cv = twoEntryGermanCv();
    // One duration-bearing unit so V2 accepts the provider; grammar still fails.
    const badGrammarProvider = [
      'Ich arbeite derzeit als Lagermitarbeiterin bei Atlas mit etwa sechseinhalb Jahren',
      'Erfahrung in die Abstimmung der Vorbereitung und Bewegung von Waren und',
      'prüft eingehende Waren, prüft Dokumentation zu erhaltenen Waren,',
      'koordiniert mit Kolleginnen die Vorbereitung und Bewegung der Waren.',
      'Zuvor war ich als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien und grafische Elemente,',
      'überprüfte und passte Designmaterialien an und bereitete finale Designdateien für Formate und Bildschirme vor.',
    ].join(' ');

    expect(
      validateGermanGeneratedCaseGrammar(badGrammarProvider).germanControlledCaseGrammarPassed,
    ).toBe(false);

    const fin = runGenerate(cv, badGrammarProvider);
    expect(fin.diagnostics?.germanControlledCaseGrammarPassed).toBe(false);
    expect(fin.blocked).toBe(true);
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.reason).toBe('german_controlled_case_grammar_failed');
    expect(fin.diagnostics?.materialCategoryCoverageUsedForFinalAcceptance).toBe(false);
    expect(fin.diagnostics?.authoritativeCanonicalCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.currentDutyRequiredFactParityPassed).toBe(true);
    expect(fin.diagnostics?.rejectionStage).toBe('summary_v2_german_preapply_completeness');

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-380-de-grammar-block',
      usageCountBefore: getProAiUsageCount(),
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed).toBe(false);
    expect(getProAiUsageCount()).toBe(8);
  });

  it('fact-set parity failure blocks acceptance', () => {
    const fields = buildGermanSummaryV2PreapplyCompletenessFields({
      finalCandidateText:
        'Ich verfüge über insgesamt etwa sechseinhalb Jahre Berufserfahrung. '
        + 'Ich arbeite derzeit als Lagermitarbeiterin bei Atlas.',
      requiredCurrentFacts: [
        { factId: 'v2_entry_atlas_a' },
        { factId: 'v2_entry_atlas_b' },
        { factId: 'v2_entry_atlas_c' },
      ],
      // Extra authoritative row without a fact id → unclassified + set mismatch.
      authoritativeCurrentFacts: [
        { factId: 'v2_entry_atlas_a' },
        { factId: 'v2_entry_atlas_b' },
        { factId: 'v2_entry_atlas_c' },
        { factId: '' },
      ],
    });
    expect(fields.materialCategoryCoverageUsedForFinalAcceptance).toBe(false);
    expect(fields.unclassifiedAuthoritativeCurrentDutyFactCount).toBe(1);
    expect(fields.requiredFactSetMatchesAuthoritativeFactSet).toBe(false);
    expect(fields.currentDutyRequiredFactParityPassed).toBe(false);
    expect(fields.blocksAcceptance).toBe(true);
    expect(fields.blockReason).toBe('current_duty_required_fact_parity_failed');
  });

  it('English Summary Generate path remains unchanged (no DE-only fields forced)', () => {
    const enCv: CVData = {
      ...twoEntryGermanCv(),
      contentLocale: 'en',
      personal: {
        ...twoEntryGermanCv().personal!,
        jobTitle: 'Warehouse Employee',
      },
      experience: [
        {
          id: 'atlas',
          position: 'Warehouse Employee',
          company: 'Atlas',
          startDate: '2023-01',
          endDate: '',
          isPresent: true,
          description: [
            'checks incoming goods',
            'checks documentation related to received goods',
            'coordinates with colleagues on preparation and movement of goods',
          ].join('\n'),
          canonicalDescription: '',
          descriptionOrigin: 'user',
          generatedLocale: 'en',
        },
        {
          id: 'rewitu',
          position: 'Graphic Designer',
          company: 'Rewitu',
          startDate: '2020-01',
          endDate: '2022-12',
          isPresent: false,
          description: [
            'created visual materials and graphic elements',
            'reviewed and adapted design materials',
            'prepared final design files for various formats and screens',
          ].join('\n'),
          canonicalDescription: '',
          descriptionOrigin: 'user',
          generatedLocale: 'en',
        },
      ],
    };
    const duration = buildExperienceDurationSnapshot(enCv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: enCv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.germanControlledCaseGrammarPassed).toBeUndefined();
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_V2_REVISION);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-380-en-unchanged',
      usageCountBefore: getProAiUsageCount(),
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
  });
});
