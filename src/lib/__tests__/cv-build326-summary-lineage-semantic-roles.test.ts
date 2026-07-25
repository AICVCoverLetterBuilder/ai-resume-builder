/**
 * AAB-326 Phase 2 — selected lineage hash truth + sentence semantic role truth.
 */
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION,
  SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION,
  analyzeEnglishSummaryEmploymentQuality,
} from '@/lib/cv-english-summary-grounding';
import { finalizeCvAiFieldForApply, SUMMARY_RUNTIME_MARKER_SET } from '@/lib/cv-ai-finalize-apply';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import type { CVData } from '@/lib/types';

const WH_ES = [
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
].join('\n');

const GD_ES = [
  'Crea materiales visuales y gráficos',
  'Revisa y adapta documentos de diseño',
  'Prepara archivos de diseño finales para formatos y pantallas',
].join('\n');

function englishFixture(): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Empleada de almacén',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'atlas',
        position: 'Empleada de almacén',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_ES,
        canonicalDescription: WH_ES,
      },
      {
        id: 'rewitu',
        position: 'Diseñadora gráfica',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_ES,
        canonicalDescription: GD_ES,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
  };
}

describe('AAB-326 Summary selected lineage and semantic roles', () => {
  it('markers reachable', () => {
    expect(SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION)
      .toBe('summary-selected-lineage-hash-truth-326-v1');
    expect(SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION)
      .toBe('summary-sentence-semantic-role-truth-326-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION);
  });

  it('21-26. selected deterministic hashes equal final_selected; visible equals final', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 't',
      gender: 'female',
      requestId: 'req-326-lineage',
      usageCountBefore: 60,
      operationMode: 'generate',
      jobContextHash: 'j',
    });
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, 61, fin.text);
    const trace = session.commit();
    const lineage = (trace.candidateLineage || []) as Array<Record<string, unknown>>;
    const det = lineage.find((c) => c.candidateKind === 'client_deterministic')!;
    const finalSel = lineage.find((c) => c.candidateKind === 'final_selected')!;
    expect(det.present).toBe(true);
    expect(det.accepted).toBe(true);
    expect(finalSel.selectedSource).toBe('client_deterministic');
    expect(det.hash).toBe(finalSel.hash);
    expect(det.finalizedHash || det.hash).toBe(finalSel.finalizedHash || finalSel.hash);
    expect(det.unitHashes).toEqual(finalSel.unitHashes);
    expect(det.sentenceHashes).toEqual(finalSel.sentenceHashes);
    expect(trace.finalValidatedCandidateHash).toBe(finalSel.hash);
    expect(trace.visibleCandidateHashAfterApply).toBe(trace.finalValidatedCandidateHash);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);

    // Final-selected unit hashes reconstruct final normalized text.
    const units = (fin.text || '')
      .split(/(?<=[.!?])\s+(?=\S)/u)
      .map((s) => s.trim())
      .filter(Boolean);
    expect(finalSel.unitHashes).toEqual(units.map((u) => fingerprintText(u)));
  });

  it('23. provider hashes cannot appear in rejected-provider final-selected lineage', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: [
        'Warehouse Employee at Atlas since January 2023, with approximately six and a',
        'half years of experience revisingó la mercancía entrante.',
      ].join(' '),
    });
    expect(fin.origin).toBe('deterministic_fallback');
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 't',
      gender: 'female',
      requestId: 'req-326-prov',
      usageCountBefore: 62,
      operationMode: 'generate',
      jobContextHash: 'j',
    });
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, 63, fin.text);
    const trace = session.commit();
    const lineage = (trace.candidateLineage || []) as Array<Record<string, unknown>>;
    const provider = lineage.find((c) => String(c.candidateKind).includes('provider'));
    const finalSel = lineage.find((c) => c.candidateKind === 'final_selected')!;
    expect(trace.providerAccepted).not.toBe(true);
    expect(finalSel.selectedSource).toBe('client_deterministic');
    if (provider && Array.isArray(provider.unitHashes) && (provider.unitHashes as string[]).length) {
      expect(finalSel.unitHashes).not.toEqual(provider.unitHashes);
    }
  });

  it('27. one changed final sentence changes the corresponding unit hash', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    const q1 = analyzeEnglishSummaryEmploymentQuality(fin.text!, {
      company: 'Atlas',
      role: 'Empleada de almacén',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      gender: 'female',
    });
    const units = (fin.text || '')
      .split(/(?<=[.!?])\s+(?=\S)/u)
      .map((s) => s.trim())
      .filter(Boolean);
    const mutated = [...units];
    mutated[2] = 'Overall, she has approximately seven years of professional experience.';
    const q2 = analyzeEnglishSummaryEmploymentQuality(mutated.join(' '), {
      company: 'Atlas',
      role: 'Empleada de almacén',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      gender: 'female',
    });
    expect(q1.finalSentenceHashes![0]).toBe(q2.finalSentenceHashes![0]);
    expect(q1.finalSentenceHashes![1]).toBe(q2.finalSentenceHashes![1]);
    expect(q1.finalSentenceHashes![2]).not.toBe(q2.finalSentenceHashes![2]);
  });

  it('28-32. semantic roles map current/prior/duration; generic summary_unit insufficient', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    const roles = fin.diagnostics?.finalUnitSemanticRolesByUnit || [];
    expect(roles[0]).toEqual(expect.arrayContaining(['current_role_intro', 'current_role_duties']));
    expect(roles[1]).toEqual(expect.arrayContaining(['prior_role_intro', 'prior_role_duties']));
    expect(roles[2]).toEqual(expect.arrayContaining(['total_duration']));
    expect(fin.diagnostics?.finalSentenceRoleSlots).toEqual([
      'current_intro',
      'prior_role',
      'total_duration',
    ]);
    expect(fin.diagnostics?.finalUnitRoleSlots).not.toEqual([
      'summary_unit',
      'summary_unit',
      'summary_unit',
    ]);

    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      requiredCurrentDutyFactCount: 3,
      requiredPriorDutyFactCount: 3,
      finalUnitRoleSlots: ['summary_unit', 'summary_unit', 'summary_unit'],
      finalUnitSemanticRolesByUnit: [
        ['current_role_intro', 'current_role_duties'],
        ['prior_role_intro', 'prior_role_duties'],
        ['total_duration'],
      ],
      currentRoleConcreteFactCoverage: 3,
      priorRoleGroundingPassed: true,
      currentRoleTitlePresent: true,
      finalCurrentEmployerPresent: true,
      finalPriorEmployerPresent: true,
      finalCurrentDutyCoveragePassed: true,
      finalPriorDutyCoveragePassed: true,
      finalSlotValidationPassed: true,
      structuredRoleLocaleValidationPassed: true,
      finalUnsupportedCompetencyCount: 0,
      finalDurationOwnerDetected: 'total_professional_experience',
      finalDurationScopeValidationPassed: true,
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0]);
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) => String(f.invariantCode).includes('generic_summary_unit'))).toBe(
      true,
    );
  });

  it('36. lineage invariant failure blocks counted success path', () => {
    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      providerAccepted: false,
      candidateLineage: [
        {
          candidateKind: 'client_deterministic',
          present: true,
          accepted: true,
          hash: 'same',
          unitHashes: ['a', 'b', 'c'],
          sentenceHashes: ['a', 'b', 'c'],
        },
        {
          candidateKind: 'final_selected',
          present: true,
          accepted: true,
          selectedSource: 'client_deterministic',
          hash: 'same',
          unitHashes: ['x', 'y', 'z'],
          sentenceHashes: ['x', 'y', 'z'],
        },
      ],
      finalUnitSemanticRolesByUnit: [
        ['current_role_intro'],
        ['prior_role_intro'],
        ['total_duration'],
      ],
      finalUnitRoleSlots: ['current_intro', 'prior_role', 'total_duration'],
      currentRoleConcreteFactCoverage: 3,
      priorRoleGroundingPassed: true,
      currentRoleTitlePresent: true,
      finalCurrentEmployerPresent: true,
      finalPriorEmployerPresent: true,
      finalCurrentDutyCoveragePassed: true,
      finalPriorDutyCoveragePassed: true,
      finalSlotValidationPassed: true,
      structuredRoleLocaleValidationPassed: true,
      finalUnsupportedCompetencyCount: 0,
      finalDurationOwnerDetected: 'total_professional_experience',
      finalDurationScopeValidationPassed: true,
      requiredPriorDutyFactCount: 3,
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0]);
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) => String(f.invariantCode).includes('unit_hash_mismatch'))).toBe(
      true,
    );
  });
});
