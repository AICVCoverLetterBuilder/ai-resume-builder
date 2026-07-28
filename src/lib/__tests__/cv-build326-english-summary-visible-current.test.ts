/**
 * AAB-326 Phase 1 — English Summary visible current-duty wiring, parity, 0/0 fail-closed.
 */
import { describe, expect, it } from 'vitest';
import {
  ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION,
  SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION,
  analyzeEnglishSummaryEmploymentQuality,
  rebuildEnglishDutyFactsFromIds,
  hashCurrentDutyRequiredFactSet,
} from '@/lib/cv-english-summary-grounding';
import { validateSummaryEntryDutyCoverage } from '@/lib/cv-german-summary-current-duty-coverage';
import { finalizeCvAiFieldForApply, SUMMARY_RUNTIME_MARKER_SET } from '@/lib/cv-ai-finalize-apply';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import {
  checkSummaryDiagnosticInvariants,
  checkSummaryDiagnosticCompleteness,
} from '@/lib/cv-ai-diagnostics-contract';
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

/** AAB-346 first-person finite-clause English Summary (must remain passing). */
const AAB346_EN_VISIBLE = [
  'I am a warehouse employee with approximately six and a half years of',
  'professional experience, currently working at Atlas, where I check incoming',
  'goods, verify related documentation, and coordinate with colleagues on the',
  'preparation and movement of goods. Previously, I worked as a graphic designer',
  'at Rewitu, creating visual materials and graphic elements, reviewing and adapting',
  'design materials, and preparing final design files for different formats and screens.',
].join(' ');

/** Alias retained for AAB-325/326 fixtures that reference the canonical visible text. */
const AAB325_EN_VISIBLE = AAB346_EN_VISIBLE;

const REQUIRED_IDS = [
  'incoming_goods_check',
  'related_documentation_check',
  'colleague_coordination_goods_preparation_movement',
] as const;

function englishFixture(summary = ''): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Empleada de almacén',
      gender: 'female',
    },
    summary,
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

function sessionWithFinal(fin: ReturnType<typeof finalizeCvAiFieldForApply>, usageBefore = 39) {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'en',
    requestedLocale: 'en',
    contentLocale: 'en',
    templateId: 't',
    gender: 'female',
    requestId: `req-326-${usageBefore}`,
    usageCountBefore: usageBefore,
    operationMode: 'generate',
    jobContextHash: 'j',
  });
  session.recordFinalizeResult(fin);
  return session;
}

describe('AAB-326 English visible current duty validation', () => {
  it('markers are reachable in runtime marker set', () => {
    expect(ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION)
      .toBe('english-summary-visible-current-coverage-326-v1');
    expect(SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION)
      .toBe('summary-visible-required-fact-parity-326-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION,
    );
  });

  it('1-5. English visible validator receives all three required facts with entry ID', () => {
    const q = analyzeEnglishSummaryEmploymentQuality(AAB325_EN_VISIBLE, {
      company: 'Atlas',
      role: 'Empleada de almacén',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      gender: 'female',
      currentEntryId: 'atlas',
    });
    expect(q.requiredCurrentDutyFactIds).toEqual([...REQUIRED_IDS]);
    expect(q.requiredCurrentDutyFactCount).toBe(3);
    expect(q.authoritativeCurrentDutyFactCount).toBe(3);

    const facts = rebuildEnglishDutyFactsFromIds(q.requiredCurrentDutyFactIds, {
      currentEntryId: 'atlas',
    });
    expect(facts).toHaveLength(3);
    expect(facts.every((f) => f.requiredForSummary)).toBe(true);
    expect(facts.every((f) => f.targetLocale === 'en')).toBe(true);
    expect(facts.every((f) => f.sourceEntryIdHash === 'entry_atlas')).toBe(true);
    expect(facts.map((f) => f.canonicalFactId)).toEqual([...REQUIRED_IDS]);
    // German-only rebuilders are not used — EN match overlays cover the fixture.
    const duty = validateSummaryEntryDutyCoverage({
      requiredFacts: facts,
      candidateText: AAB325_EN_VISIBLE,
      locale: 'en',
    });
    expect(duty.requiredCurrentDutyFactCount).toBe(3);
    expect(duty.coveredCurrentDutyFactCount).toBe(3);
    expect(hashCurrentDutyRequiredFactSet(q.requiredCurrentDutyFactIds))
      .toBe(q.finalCurrentDutyRequiredFactSetHash);
  });

  it('6. Exact AAB-325 output → visible 3/3 with parity', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.requiredCurrentDutyFactIds).toEqual([...REQUIRED_IDS]);
    // Visible content may match exact AAB-325 text.
    expect(fin.text.replace(/\s+/g, ' ').trim()).toBe(
      AAB325_EN_VISIBLE.replace(/\s+/g, ' ').trim(),
    );

    const session = sessionWithFinal(fin);
    session.recordVisibleApply(true, 39, fin.text);
    expect(session.draft.visibleRequiredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleMissingCurrentDutyFactCount).toBe(0);
    expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(true);
    expect(session.draft.visibleCurrentDutyRequiredFactParityPassed).toBe(true);
    expect(session.draft.visibleCurrentDutyRequiredFactCountMatchesFinal).toBe(true);
    expect(session.draft.visibleCurrentDutyRequiredFactSetHash)
      .toBe(session.draft.finalCurrentDutyRequiredFactSetHash);
    expect(session.draft.visibleRequiredPriorDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredPriorDutyFactCount).toBe(3);
    expect(session.draft.visiblePriorDutyRequiredFactParityPassed).toBe(true);
    expect(session.draft.visibleApplySucceeded).toBe(true);
    expect(session.draft.countedAsSuccess).toBe(true);
    expect(session.draft.visibleCurrentDutyFactMatchCountsByFactHash).toBeTruthy();
    expect(session.draft.visibleMissingCurrentDutyFactIdHashes).toEqual([]);
  });

  it.each([
    {
      name: '7. missing incoming goods',
      mutate: (t: string) => t.replace(/check incoming goods,\s*/iu, ''),
    },
    {
      name: '8. missing documentation',
      mutate: (t: string) => t.replace(/verify related documentation,\s*/iu, ''),
    },
    {
      name: '9. missing coordination',
      mutate: (t: string) => t.replace(
        /,\s*and coordinate with colleagues on the preparation and movement of goods/iu,
        '',
      ),
    },
  ])('$name → 2/3 fail, no success', ({ mutate }) => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    const mutated = mutate(fin.text || '');
    const session = sessionWithFinal(fin, 40);
    session.recordVisibleApply(true, 40, mutated);
    expect(session.draft.visibleRequiredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(2);
    expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(false);
    expect(session.draft.visibleApplySucceeded).toBe(false);
    expect(session.draft.countedAsSuccess).toBe(false);
    expect(session.draft.usageCountAfter).toBe(40); // unchanged from argument; page blocks +1
  });

  it('10. no duties → 0/3 fail, never 0/0 pass', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    const noDuties = [
      'Warehouse Employee at Atlas since January 2023.',
      'Previously, she worked as a Graphic Designer at Rewitu, creating visual materials,',
      'revising design documents and preparing final files for different formats and screens.',
      'Overall, she has approximately six and a half years of professional experience.',
    ].join(' ');
    const session = sessionWithFinal(fin, 41);
    session.recordVisibleApply(true, 41, noDuties);
    expect(session.draft.visibleRequiredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(0);
    expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(false);
    expect(session.draft.visibleApplySucceeded).toBe(false);
    expect(session.draft.countedAsSuccess).toBe(false);
  });

  it('11-12. empty required set with authoritative 3 → fail; 0/0 cannot pass', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    const session = sessionWithFinal(fin, 42);
    session.patch({
      requiredCurrentDutyFactIds: [],
      // Keep final required count authoritative so empty visible set is a parity fail.
      requiredCurrentDutyFactCount: 3,
      authoritativeCurrentDutyFactCount: 3,
    });
    session.recordVisibleApply(true, 42, fin.text);
    expect(session.draft.visibleRequiredCurrentDutyFactCount).toBe(0);
    expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(0);
    expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(false);
    expect(session.draft.visibleCurrentDutyRequiredFactParityPassed).toBe(false);
    expect(session.draft.visibleApplySucceeded).toBe(false);
    expect(session.draft.countedAsSuccess).toBe(false);
    expect(String(session.draft.finalTypedFailureReason || '')).toMatch(
      /visible_current_duty_required_set_missing|parity/,
    );
  });

  it('13-14. visible coverage is independent of final 3/3', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    const session = sessionWithFinal(fin, 43);
    session.recordVisibleApply(
      true,
      43,
      fin.text!.replace(/check incoming goods,\s*/iu, ''),
    );
    expect(session.draft.coveredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(2);
    expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(false);
  });

  it('15-18. final/visible required parity invariants', () => {
    const base = {
      requestedLocale: 'en',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      visibleCandidateHashAfterApply: 'visible-hash',
      authoritativeCurrentDutyFactCount: 3,
      requiredCurrentDutyFactCount: 3,
      usageCountBefore: 39,
      usageCountAfter: 40,
      finalUnitRoleSlots: ['current_intro', 'current_duty', 'prior_role'],
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
      requiredPriorDutyFactCount: 3,
      finalCurrentDutyRequiredFactSetHash: hashCurrentDutyRequiredFactSet([...REQUIRED_IDS]),
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0];

    expect(checkSummaryDiagnosticInvariants({
      ...base,
      visibleRequiredCurrentDutyFactCount: 0,
      visibleCoveredCurrentDutyFactCount: 0,
      visibleCurrentDutyCoveragePassed: true,
      visibleCurrentDutyRequiredFactParityPassed: false,
    }).passed).toBe(false);

    expect(checkSummaryDiagnosticInvariants({
      ...base,
      visibleRequiredCurrentDutyFactCount: 2,
      visibleCoveredCurrentDutyFactCount: 2,
      visibleCurrentDutyCoveragePassed: true,
      visibleCurrentDutyRequiredFactParityPassed: false,
    }).passed).toBe(false);

    const wrongHash = hashCurrentDutyRequiredFactSet(['incoming_goods_check']);
    expect(checkSummaryDiagnosticInvariants({
      ...base,
      visibleRequiredCurrentDutyFactCount: 3,
      visibleCoveredCurrentDutyFactCount: 3,
      visibleMissingCurrentDutyFactCount: 0,
      visibleCurrentDutyCoveragePassed: true,
      visibleCurrentDutyRequiredFactParityPassed: true,
      visibleCurrentDutyRequiredFactSetHash: wrongHash,
    }).passed).toBe(false);

    const goodHash = hashCurrentDutyRequiredFactSet([...REQUIRED_IDS]);
    const good = checkSummaryDiagnosticInvariants({
      ...base,
      finalCandidateSource: 'deterministic_fallback',
      providerCandidatePresent: false,
      deterministicCandidatePresent: true,
      deterministicCandidateHash: 'visible-hash',
      visibleCandidateHashAfterApply: 'visible-hash',
      finalValidatedCandidateHash: 'visible-hash',
      visibleSummaryMatchesFinalHash: true,
      visibleRequiredCurrentDutyFactCount: 3,
      visibleCoveredCurrentDutyFactCount: 3,
      visibleMissingCurrentDutyFactCount: 0,
      visibleCurrentDutyCoveragePassed: true,
      visibleCurrentDutyRequiredFactParityPassed: true,
      visibleCurrentDutyRequiredFactCountMatchesFinal: true,
      visibleCurrentDutyRequiredFactSetHash: goodHash,
      finalCurrentDutyRequiredFactSetHash: goodHash,
    });
    expect(good.failures.map((f) => f.invariantCode)).toEqual([]);
    expect(good.passed).toBe(true);
  });

  it('19-20. completeness fails on missing visible current maps; usage parity', () => {
    const c = checkSummaryDiagnosticCompleteness({
      operationKind: 'summary',
      marker: 'SUMMARY_AI_DIAG_V1',
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1,
      requestedLocale: 'en',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      visibleCandidateHashAfterApply: 'h',
      finalCandidateSource: 'deterministic_fallback',
      providerCandidatePresent: false,
      deterministicCandidatePresent: true,
      grammarValidationPassed: true,
      groundingValidationPassed: true,
      durationValidationPassed: true,
      usageCountBefore: 39,
      usageCountAfter: 40,
      meaningfulChangeDetected: true,
      noOpDetected: false,
      apiResponseKind: 'ok',
      serverFallbackUsed: false,
      clientFallbackUsed: true,
      apiBaseUrlConfigured: true,
      capacitorServerUrlConfigured: false,
      sourceCommitStatus: 'ok',
      finalUnitRoleSlots: ['current_intro'],
      finalUnitSemanticRolesByUnit: [['current_role_intro']],
      currentIntroSlotPresent: true,
      currentDutySlotPresent: true,
      priorRoleSlotPresent: true,
      currentRoleConcreteFactCoverage: 3,
      priorRoleGroundingPassed: true,
      currentRoleTitlePresent: true,
      finalCurrentEmployerPresent: true,
      finalPriorEmployerPresent: true,
      finalCurrentEmploymentStateExpressed: true,
      finalPriorEmploymentStateExpressed: true,
      finalCurrentDutyCoveragePassed: true,
      finalPriorDutyCoveragePassed: true,
      requiredCurrentDutyFactCount: 3,
      requiredPriorDutyFactCount: 3,
      finalSlotValidationPassed: true,
      structuredRoleLocaleValidationPassed: true,
      finalUnsupportedCompetencyCount: 0,
      finalDurationOwnerDetected: 'total_professional_experience',
      finalDurationScopeValidationPassed: true,
      competencyInferenceFromRoleForbidden: true,
      visibleCurrentDutyCoveragePassed: true,
      visiblePriorDutyCoveragePassed: true,
      visibleStructuredRoleLocaleValidationPassed: true,
      visibleDurationScopeValidationPassed: true,
      // Missing parity / maps intentionally.
    });
    expect(c.passed).toBe(false);
    expect(
      c.missingRequiredDiagnosticFields.some((f) => f.includes('visibleCurrentDuty')
        || f.includes('Parity')
        || f.includes('FactSetHash')),
    ).toBe(true);

    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      visibleCandidateHashAfterApply: 'h',
      authoritativeCurrentDutyFactCount: 3,
      requiredCurrentDutyFactCount: 3,
      visibleRequiredCurrentDutyFactCount: 3,
      visibleCoveredCurrentDutyFactCount: 3,
      visibleCurrentDutyCoveragePassed: true,
      visibleCurrentDutyRequiredFactParityPassed: false,
      usageCountBefore: 39,
      usageCountAfter: 40,
      finalUnitSemanticRolesByUnit: [['current_role_intro'], ['prior_role_intro'], ['total_duration']],
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
    expect(inv.failures.some((f) => String(f.invariantCode).includes('usage_without_visible')
      || String(f.invariantCode).includes('parity'))).toBe(true);
  });

  it('33. valid visible 3/3 + 3/3 → apply success', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    const session = sessionWithFinal(fin, 50);
    session.recordVisibleApply(true, 51, fin.text);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(51);
    expect(trace.visibleRequiredCurrentDutyFactCount).toBe(3);
    expect(trace.visibleRequiredPriorDutyFactCount).toBe(3);
    expect(trace.visibleCurrentDutyRequiredFactParityPassed).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
  });

  it('34-35. visible 2/3 or 0/0 → no counted success', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    const s2 = sessionWithFinal(fin, 51);
    s2.recordVisibleApply(true, 51, fin.text!.replace(/related documentation/iu, 'records'));
    expect(s2.draft.countedAsSuccess).toBe(false);

    const s0 = sessionWithFinal(fin, 52);
    s0.patch({
      requiredCurrentDutyFactIds: [],
      requiredCurrentDutyFactCount: 3,
      authoritativeCurrentDutyFactCount: 3,
    });
    s0.recordVisibleApply(true, 52, fin.text);
    expect(s0.draft.visibleRequiredCurrentDutyFactCount).toBe(0);
    expect(s0.draft.countedAsSuccess).toBe(false);
  });

  it('prior facts do not replace current facts', () => {
    const facts = rebuildEnglishDutyFactsFromIds([...REQUIRED_IDS]);
    expect(facts.map((f) => f.canonicalFactId)).not.toContain('visual_materials');
    expect(facts).toHaveLength(3);
  });
});
