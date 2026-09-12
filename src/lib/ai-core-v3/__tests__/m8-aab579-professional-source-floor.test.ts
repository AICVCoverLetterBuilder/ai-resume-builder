import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  createSummaryV3StyleCandidate,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  summaryV3StyleCandidatePreservesExactMaterialSurfaces,
  summaryV3StyleCandidateUnitHash,
  summaryV3StyleLocalSemanticDecision,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleServer,
  type SummaryV3StyleEvaluatorInput,
  type SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';

const fixtures = [
  { locale: 'sr', role: 'Inženjerka', employer: 'Nova', source: 'Inženjerka gradi API-je, koordinira zahteve i vodi evidenciju.', duties: ['gradi API-je', 'koordinira zahteve', 'vodi evidenciju'], candidate: 'Inženjerka izrađuje pouzdane API-je, usklađuje zahteve i vodi evidenciju.' },
  { locale: 'en', role: 'Engineer', employer: 'Nova', source: 'Engineer builds APIs, coordinates requests, and maintains records.', duties: ['builds APIs', 'coordinates requests', 'maintains records'], candidate: 'Engineer creates reliable interfaces, coordinates requests, and maintains records.' },
  { locale: 'hi', role: 'इंजीनियर', employer: 'नोवा', source: 'इंजीनियर एपीआई बनाती हैं, अनुरोधों का समन्वय करती हैं और रिकॉर्ड रखती हैं।', duties: ['एपीआई बनाती हैं', 'अनुरोधों का समन्वय करती हैं', 'रिकॉर्ड रखती हैं'], candidate: 'इंजीनियर विश्वसनीय एपीआई तैयार करती हैं, अनुरोधों का समन्वय करती हैं और रिकॉर्ड रखती हैं।' },
  { locale: 'ar', role: 'مهندسة', employer: 'نوفا', source: 'مهندسة تبني واجهات برمجة التطبيقات. تنسق الطلبات. تحافظ على السجلات.', duties: ['تبني واجهات برمجة التطبيقات', 'تنسق الطلبات', 'تحافظ على السجلات'], candidate: 'مهندسة تنشئ واجهات برمجة موثوقة. تنسق الطلبات. تحافظ على السجلات.' },
  { locale: 'ja', role: 'エンジニア', employer: 'ノヴァ', source: 'エンジニアとして API を構築し、依頼を調整し、記録を管理します。', duties: ['API を構築し', '依頼を調整し', '記録を管理します'], candidate: 'エンジニアとして信頼性の高い API を開発し、依頼を調整し、記録を管理します。' },
  { locale: 'de', role: 'Ingenieurin', employer: 'Nova', source: 'Ingenieurin entwickelt APIs, koordiniert Anfragen und pflegt Unterlagen.', duties: ['entwickelt APIs', 'koordiniert Anfragen', 'pflegt Unterlagen'], candidate: 'Ingenieurin erstellt belastbare Schnittstellen, koordiniert Anfragen und pflegt Unterlagen.', suffix: ' in professioneller Form' },
  { locale: 'fr', role: 'Ingénieure', employer: 'Nova', source: 'Ingénieure construit des API, coordonne les demandes et tient les dossiers.', duties: ['construit des API', 'coordonne les demandes', 'tient les dossiers'], candidate: 'Ingénieure développe des API fiables, coordonne les demandes et tient les dossiers.' },
  { locale: 'es', role: 'Ingeniera', employer: 'Nova', source: 'Ingeniera construye API, coordina solicitudes y mantiene registros.', duties: ['construye API', 'coordina solicitudes', 'mantiene registros'], candidate: 'Ingeniera desarrolla API sólidas, coordina solicitudes y mantiene registros.' },
  { locale: 'it', role: 'Ingegnera', employer: 'Nova', source: 'Ingegnera costruisce API, coordina le richieste e mantiene i registri.', duties: ['costruisce API', 'coordina le richieste', 'mantiene i registri'], candidate: 'Ingegnera sviluppa API affidabili, coordina le richieste e mantiene i registri.', suffix: ' con grande cura' },
  { locale: 'hr', role: 'Inženjerka', employer: 'Nova', source: 'Inženjerka izrađuje API-je, koordinira zahtjeve i vodi evidenciju.', duties: ['izrađuje API-je', 'koordinira zahtjeve', 'vodi evidenciju'], candidate: 'Inženjerka razvija pouzdane API-je, koordinira zahtjeve i vodi evidenciju.' },
  { locale: 'pt-BR', role: 'Engenheira', employer: 'Nova', source: 'Engenheira cria APIs, coordena solicitações e mantém registros.', duties: ['cria APIs', 'coordena solicitações', 'mantém registros'], candidate: 'Engenheira desenvolve APIs robustas, coordena solicitações e mantém registros.' },
  { locale: 'ru', role: 'Инженер', employer: 'Нова', source: 'Инженер создаёт API, координирует запросы и ведёт записи.', duties: ['создаёт API', 'координирует запросы', 'ведёт записи'], candidate: 'Инженер разрабатывает надёжные API, координирует запросы и ведёт записи.' },
] as const;

function requestFor(fixture: typeof fixtures[number]): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: 'summary_professional',
    operationId: `m8-aab579-${fixture.locale}`,
    style: 'professional',
    requestedLocale: fixture.locale,
    sourceLocale: fixture.locale,
    visibleSummary: fixture.source,
    protectedEntities: undefined,
    visibleSummaryFacts: fixture.duties.map((text, index) => ({
      id: `duty-${fixture.locale}-${index + 1}`,
      text,
      semanticKind: 'duty' as const,
    })),
    manifest: {
      manifestId: `manifest-${fixture.locale}`,
      contextId: `context-${fixture.locale}`,
      sourceLocale: fixture.locale,
      currentRoleEntryId: `entry-${fixture.locale}`,
      entries: [{
        stableId: `entry-${fixture.locale}`,
        role: fixture.role,
        employer: fixture.employer,
        employmentState: 'present',
        durationMonths: 24,
        facts: fixture.duties.map((text, index) => ({ id: `duty-${fixture.locale}-${index + 1}`, text })),
      }],
    },
    createdAt: 1_757_672_000_000,
  };
}

function writerEnvelope(input: SummaryV3StyleWriterInput, text: string) {
  return {
    toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
    contentBlockCount: 1,
    textBlockCount: 0,
    toolBlockCount: 1,
    input: {
      operationId: input.operationId,
      snapshotHash: input.snapshotHash,
      manifestHash: input.manifestHash,
      style: input.style,
      locale: input.locale,
      units: [{ unitId: 'professional-candidate', text, factIds: input.requiredFacts.map((fact) => fact.id) }],
    },
  };
}

function evaluatorEnvelope(
  input: SummaryV3StyleEvaluatorInput,
  missing: readonly string[] = [],
  options: { roleIdentityResolution?: 'not_required' | 'equivalent' | 'contradiction' | 'unresolved'; professionalFulfilled?: boolean } = {},
) {
  const missingHashes = new Set(missing);
  const represented = input.requiredFacts.map((fact) => fact.hash).filter((hash) => !missingHashes.has(hash));
  const phases = {
    structural: { status: 'passed' as const, violations: [] as unknown[] },
    semantic_grounding: missing.length === 0
      ? { status: 'passed' as const, violations: [] as unknown[] }
      : {
        status: 'failed' as const,
        violations: [{
          code: 'missing_fact',
          factIdHashes: [...missing],
          unitHashes: [input.candidate.units.map(summaryV3StyleCandidateUnitHash)[0]!],
          repairable: false,
        }],
      },
    language_native_quality: { status: 'passed' as const, violations: [] as unknown[] },
    style_fulfillment: { status: 'passed' as const, violations: [] as unknown[] },
  };
  return {
    toolName: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
    contentBlockCount: 1,
    textBlockCount: 0,
    toolBlockCount: 1,
    input: {
      operationId: input.operationId,
      snapshotHash: input.snapshotHash,
      manifestHash: input.manifestHash,
      style: input.style,
      locale: input.locale,
      candidateHash: input.candidate.hash,
      candidateUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
      phases,
      representedFactIdHashes: represented,
      missingFactIdHashes: [...missing],
      roleIdentityResolution: options.roleIdentityResolution ?? 'not_required',
      styleEvidence: {
        style: 'professional',
        professionalFramingOperations: 1,
        cohesionClarityOperations: 1,
        markerOnlyChangeDetected: false,
        jargonOrFillerDetected: false,
        professionalFulfilled: options.professionalFulfilled ?? true,
        noOpDetected: false,
      },
    },
  };
}

const physicalSummary = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';
const physicalDutyTexts = [
  'carry out maintenance work on electrical systems',
  'locate and resolve faults in electrical systems',
  'support the installation of electrical components',
] as const;
const physicalCandidate = 'With approximately three years of experience, I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, servicing power infrastructure, diagnosing and correcting malfunctions, and assisting with equipment fitting.';

function physicalRequest(overrides: Partial<SummaryV3StyleRequest> = {}): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: 'summary_professional',
    operationId: 'm8-aab579-physical-equivalent',
    style: 'professional',
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: physicalSummary,
    visibleSummaryFacts: physicalDutyTexts.map((text, index) => ({
      id: `physical-duty-${index + 1}`,
      text,
      semanticKind: 'duty' as const,
    })),
    protectedEntities: undefined,
    manifest: {
      manifestId: 'm8-aab579-physical-manifest',
      contextId: 'm8-aab579-physical-context',
      sourceLocale: 'en',
      currentRoleEntryId: 'physical-current',
      entries: [{
        stableId: 'physical-current',
        role: 'Servicetechniker Elektrotechnik',
        roleSourceLocale: 'de',
        rolePresentation: {
          text: 'Electrical Service Technician',
          sourceLocale: 'de',
          targetLocale: 'en',
          sourceRoleHash: hashSummaryV3StyleValue('Servicetechniker Elektrotechnik'),
          provenance: 'validated_localized_projection',
        },
        employer: 'NordWerk Elektroservice Test',
        employmentState: 'present',
        durationMonths: 36,
        facts: [
          { id: 'physical-maintenance', text: 'Wartung elektrischer Anlagen' },
          { id: 'physical-faults', text: 'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen' },
          { id: 'physical-installation', text: 'Unterstützung bei der Installation elektrischer Komponenten' },
        ],
      }],
    },
    createdAt: 1_757_672_000_000,
    ...overrides,
  };
}

describe('M8 AAB579 Professional source-floor closure', () => {
  it.each(fixtures)('passes a non-identical grounded paraphrase through the single evaluator for $locale', async (fixture) => {
    const request = requestFor(fixture);
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const candidateText = fixture.candidate + ('suffix' in fixture ? fixture.suffix : '');
    expect(candidateText).not.toBe(fixture.source);
    expect(summaryV3StyleLocalSemanticDecision(snapshot, candidateText)).toBe('unresolved');
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, candidateText); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result.kind).toBe('candidate_ready');
    expect(evaluatorCalls).toBe(1);
  });

  it.each(fixtures)('keeps material loss fail-closed for $locale', async (fixture) => {
    const request = requestFor(fixture);
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const missingFact = snapshot.requiredFacts.find((fact) => fact.id === `duty-${fixture.locale}-2`)!;
    const sourceFactHash = missingFact.hash;
    const candidateText = fixture.candidate.replace(fixture.duties[1]!, '');
    expect(summaryV3StyleLocalSemanticDecision(snapshot, candidateText)).toBe('unresolved');
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, candidateText); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, [sourceFactHash]); },
    });
    expect(result.kind).toBe('handled_failure');
    if (result.kind === 'handled_failure') expect(result.typedReason).toBe('lost_source_fact');
    expect(evaluatorCalls).toBe(1);
  });

  it('routes true duty loss and a 2-of-3 candidate to evaluator-owned rejection', async () => {
    const request: SummaryV3StyleRequest = {
      ...requestFor(fixtures[1]!),
      operationId: 'm8-aab579-three-duty',
      visibleSummary: 'Engineer builds APIs. Engineer coordinates requests. Engineer maintains records.',
      visibleSummaryFacts: [
        { id: 'builds', text: 'Engineer builds APIs.', semanticKind: 'duty' },
        { id: 'coordinates', text: 'Engineer coordinates requests.', semanticKind: 'duty' },
        { id: 'maintains', text: 'Engineer maintains records.', semanticKind: 'duty' },
      ],
      manifest: {
        ...requestFor(fixtures[1]!).manifest,
        entries: [{
          ...requestFor(fixtures[1]!).manifest.entries[0]!,
          facts: [
            { id: 'builds', text: 'Engineer builds APIs.' },
            { id: 'coordinates', text: 'Engineer coordinates requests.' },
            { id: 'maintains', text: 'Engineer maintains records.' },
          ],
        }],
      },
    };
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const candidateText = 'Engineer creates APIs. Engineer coordinates requests.';
    expect(summaryV3StyleLocalSemanticDecision(snapshot, candidateText)).toBe('unresolved');
    const missing = snapshot.requiredFacts
      .filter((fact) => fact.id === 'maintains')
      .map((fact) => fact.hash);
    expect(missing).toHaveLength(1);
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, candidateText); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, missing); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(1);
  });

  it('proves the pre-fix exact-material gate could reject a Professional duty rewrite, while the final owner reaches evaluator', async () => {
    const casedDutySource = physicalSummary.replace('electrical components', 'Electrical Components');
    const request = physicalRequest({
      operationId: 'm8-aab579-cased-duty-gate',
      visibleSummary: casedDutySource,
      visibleSummaryFacts: [{ id: 'cased-duty', text: 'support the installation of Electrical Components', semanticKind: 'duty' }],
    });
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    // The pre-fix gate treated this Professional snapshot as Stronger and
    // therefore rejected the cased duty surface before evaluator authority.
    expect(summaryV3StyleCandidatePreservesExactMaterialSurfaces(
      { ...snapshot, style: 'stronger' },
      physicalCandidate,
    )).toBe(false);
    expect(summaryV3StyleCandidatePreservesExactMaterialSurfaces(snapshot, physicalCandidate)).toBe(true);
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, physicalCandidate); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'professional' });
    expect(evaluatorCalls).toBe(1);
  });

  it('matches the physical 303-character fixture topology and accepts a polished equivalent', async () => {
    const request = physicalRequest();
    expect(physicalSummary).toHaveLength(303);
    expect(hashSummaryV3StyleValue(physicalSummary)).toBe('m5_a904149c');
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const dutyFacts = snapshot.requiredFacts.filter((fact) => fact.semanticKind === 'duty');
    expect(dutyFacts.map((fact) => fact.text)).toEqual([...physicalDutyTexts]);
    expect(dutyFacts).toHaveLength(3);
    expect(snapshot.manifestFacts.find((fact) => fact.id === 'physical-current:role')?.text).toBe('Servicetechniker Elektrotechnik');
    expect(snapshot.selectedEntries[0]?.rolePresentation?.text).toBe('Electrical Service Technician');
    expect(snapshot.manifestFacts.find((fact) => fact.id === 'physical-current:employer')?.text).toBe('NordWerk Elektroservice Test');
    expect(summaryV3StyleLocalSemanticDecision(snapshot, physicalCandidate)).toBe('unresolved');
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, physicalCandidate); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'professional' });
    if (result.kind === 'candidate_ready') expect(result.evidence.roleIdentityResolution).toBe('equivalent');
    expect(evaluatorCalls).toBe(1);
  });

  it('rejects each independent physical duty loss and a true 2-of-3 candidate', async () => {
    const request = physicalRequest();
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const dutyHashes = snapshot.requiredFacts
      .filter((fact) => fact.semanticKind === 'duty')
      .map((fact) => fact.hash);
    const candidates = [
      physicalCandidate.replace('servicing power infrastructure, ', ''),
      physicalCandidate.replace('diagnosing and correcting malfunctions, ', ''),
      physicalCandidate.replace('and assisting with equipment fitting.', ''),
      physicalCandidate.replace('diagnosing and correcting malfunctions, ', '').replace('and assisting with equipment fitting.', ''),
    ];
    for (const [index, candidate] of candidates.entries()) {
      let evaluatorCalls = 0;
      const missing = index === 3 ? dutyHashes.slice(1) : [dutyHashes[index]!];
      const result = await executeSummaryV3StyleServer(request, {
        async write(input) { return writerEnvelope(input, candidate); },
        async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, missing, { roleIdentityResolution: 'equivalent' }); },
      });
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
      expect(evaluatorCalls).toBe(1);
    }
  });

  it('allows a no-common-anchor duty paraphrase for one entity and keeps reattribution evaluator-rejected', async () => {
    const request: SummaryV3StyleRequest = {
      enabled: true,
      operation: 'summary_professional',
      operationId: 'm8-aab579-no-common-anchor',
      style: 'professional',
      requestedLocale: 'en',
      sourceLocale: 'en',
      visibleSummary: 'Ava builds APIs at Atlas. Ben mentors peers at Nova.',
      visibleSummaryFacts: [
        { id: 'duty-a', text: 'builds APIs', semanticKind: 'duty' },
        { id: 'duty-b', text: 'mentors peers', semanticKind: 'duty' },
      ],
      protectedEntities: ['Ava', 'Ben'],
      manifest: {
        manifestId: 'm8-aab579-two-entry-manifest',
        contextId: 'm8-aab579-two-entry-context',
        sourceLocale: 'en',
        currentRoleEntryId: 'ava-entry',
        entries: [
          { stableId: 'ava-entry', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty-a', text: 'builds APIs' }] },
          { stableId: 'ben-entry', role: 'Mentor', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'duty-b', text: 'mentors peers' }] },
        ],
      },
      createdAt: 1_757_672_000_000,
    };
    const positive = 'Ava architects resilient systems at Atlas. Ben mentors peers at Nova.';
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const dutyAHash = snapshot.requiredFacts.find((fact) => fact.id === 'duty-a')!.hash;
    let positiveEvaluatorCalls = 0;
    const positiveResult = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, positive); },
      async evaluate(input) { positiveEvaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(positiveResult).toMatchObject({ kind: 'candidate_ready' });
    expect(positiveEvaluatorCalls).toBe(1);
    const reattributed = 'Ava mentors peers at Atlas. Ben architects resilient systems at Nova.';
    let negativeEvaluatorCalls = 0;
    const negativeResult = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, reattributed); },
      async evaluate(input) { negativeEvaluatorCalls += 1; return evaluatorEnvelope(input, [dutyAHash], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(negativeResult).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(negativeEvaluatorCalls).toBe(1);
  });

  it('keeps decorative-only Professional changes rejected while semantic changes remain evaluator-owned', async () => {
    const request = physicalRequest({ operationId: 'm8-aab579-style-fulfillment' });
    const decorative = physicalSummary.replace('I bring', 'I clearly bring');
    let decorativeEvaluatorCalls = 0;
    const decorativeResult = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, decorative); },
      async evaluate(input) { decorativeEvaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(decorativeResult).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    expect(decorativeEvaluatorCalls).toBe(1);
    let semanticEvaluatorCalls = 0;
    const semanticResult = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, physicalCandidate); },
      async evaluate(input) { semanticEvaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(semanticResult).toMatchObject({ kind: 'candidate_ready' });
    expect(semanticEvaluatorCalls).toBe(1);
  });

  it('directly exercises the exact physical employment-state matrix', async () => {
    const snapshot = createSummaryV3StyleOperationSnapshot(physicalRequest());
    const cases = [
      {
        name: 'current-to-current',
        candidate: physicalCandidate,
        expected: { kind: 'candidate_ready' as const },
      },
      {
        name: 'current-to-neutral',
        candidate: physicalCandidate.replace(
          'I currently work as an Electrical Service Technician',
          'My background includes the Electrical Service Technician role',
        ),
        expected: { kind: 'handled_failure' as const, typedReason: 'lost_source_fact' as const },
      },
      {
        name: 'current-to-former',
        candidate: physicalCandidate.replace('I currently work as', 'I formerly worked as'),
        expected: { kind: 'handled_failure' as const, typedReason: 'unsupported_claim' as const },
      },
      {
        name: 'current-plus-completed',
        candidate: `${physicalCandidate} I formerly worked as an Electrical Service Technician at NordWerk Elektroservice Test.`,
        expected: { kind: 'handled_failure' as const, typedReason: 'unsupported_claim' as const },
      },
    ] as const;
    for (const item of cases) {
      let evaluatorCalls = 0;
      const result = await executeSummaryV3StyleServer({ ...physicalRequest(), operationId: `m8-aab579-physical-employment-${item.name}` }, {
        async write(input) { return writerEnvelope(input, item.candidate); },
        async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
      });
      expect(result.kind).toBe(item.expected.kind);
      if (item.expected.kind === 'handled_failure' && result.kind === 'handled_failure') {
        expect(result.typedReason).toBe(item.expected.typedReason);
        if (item.name === 'current-to-neutral') {
          expect(result.evidence.employmentStateContradictionClass).toBeNull();
        } else {
          expect(result.evidence.sourceFloorMismatchClass).toBe('employment_state_contradiction');
          expect(result.evidence.employmentStateContradictionClass).toBe('present_entry_prior_marker');
        }
      }
      expect(evaluatorCalls).toBe(1);
    }
    expect(snapshot.selectedEntries[0]?.employmentState).toBe('present');
  });

  it('keeps the physical identity hard locks fail-closed while accepting the validated role presentation', async () => {
    const cases = [
      {
        name: 'changed-employer',
        candidate: physicalCandidate.replace('NordWerk Elektroservice Test', 'Andere Elektroservice GmbH'),
        expected: 'source_lock_preservation' as const,
      },
      {
        name: 'non-equivalent-role',
        candidate: physicalCandidate.replace('Electrical Service Technician', 'Mechanical Service Technician'),
        expected: 'exact_material_source_floor' as const,
      },
    ] as const;
    for (const item of cases) {
      let evaluatorCalls = 0;
      const result = await executeSummaryV3StyleServer({ ...physicalRequest(), operationId: `m8-aab579-physical-identity-${item.name}` }, {
        async write(input) { return writerEnvelope(input, item.candidate); },
        async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
      });
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
      if (result.kind === 'handled_failure') expect(result.evidence.writerOutputContractFailureClass).toBe(item.expected);
      expect(evaluatorCalls).toBe(0);
    }
    const valid = await executeSummaryV3StyleServer({ ...physicalRequest(), operationId: 'm8-aab579-physical-validated-role' }, {
      async write(input) { return writerEnvelope(input, physicalCandidate); },
      async evaluate(input) { return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(valid.kind).toBe('candidate_ready');
  });

  it('routes a meaning-changing Professional predicate to the single evaluator for semantic rejection', async () => {
    const request = physicalRequest({ operationId: 'm8-aab579-meaning-changing-predicate' });
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const maintenanceHash = snapshot.requiredFacts.find((fact) => fact.text === physicalDutyTexts[0])!.hash;
    const candidate = physicalCandidate.replace('servicing power infrastructure', 'administering contracts');
    expect(summaryV3StyleLocalSemanticDecision(snapshot, candidate)).toBe('unresolved');
    let evaluatorCalls = 0;
    let evaluatorMissingFactHashes: readonly string[] = [];
    const result = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate(input) {
        evaluatorCalls += 1;
        evaluatorMissingFactHashes = [maintenanceHash];
        return evaluatorEnvelope(input, evaluatorMissingFactHashes, { roleIdentityResolution: 'equivalent' });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    if (result.kind === 'handled_failure') {
      expect(result.evidence.evaluatorReached).toBe(true);
      expect(result.evidence.missingFactCount).toBe(1);
    }
    expect(evaluatorMissingFactHashes).toEqual([maintenanceHash]);
    expect(evaluatorCalls).toBe(1);
  });

  it('proves the existing named-tool hard-lock owner preserves immutable technical identifiers inside duties', async () => {
    const source = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I use SAP to manage electrical maintenance.';
    const duty = 'use SAP to manage electrical maintenance';
    const request = physicalRequest({
      operationId: 'm8-aab579-technical-hard-lock',
      visibleSummary: source,
      visibleSummaryFacts: [{ id: 'technical-duty', text: duty, semanticKind: 'duty' }],
      manifest: {
        ...physicalRequest().manifest,
        entries: [{
          ...physicalRequest().manifest.entries[0]!,
          facts: [{ id: 'technical-duty', text: duty }],
        }],
      },
    });
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    const positive = 'With approximately three years of experience, I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I use SAP to coordinate electrical maintenance operations.';
    const negative = 'With approximately three years of experience, I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I coordinate electrical maintenance operations.';
    expect(summaryV3StyleLocalSemanticDecision(snapshot, positive)).toBe('unresolved');
    expect(summaryV3StyleCandidatePreservesExactMaterialSurfaces(snapshot, positive)).toBe(true);
    expect(summaryV3StyleCandidatePreservesExactMaterialSurfaces(snapshot, negative)).toBe(false);
    let positiveEvaluatorCalls = 0;
    const positiveResult = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, positive); },
      async evaluate(input) { positiveEvaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(positiveResult).toMatchObject({ kind: 'candidate_ready' });
    expect(positiveEvaluatorCalls).toBe(1);
    let negativeEvaluatorCalls = 0;
    const negativeResult = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, negative); },
      async evaluate(input) { negativeEvaluatorCalls += 1; return evaluatorEnvelope(input, [], { roleIdentityResolution: 'equivalent' }); },
    });
    expect(negativeResult).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    if (negativeResult.kind === 'handled_failure') expect(negativeResult.evidence.writerOutputContractFailureClass).toBe('exact_material_source_floor');
    expect(negativeEvaluatorCalls).toBe(0);
  });

  it('keeps the candidate identity bound to the immutable source snapshot', () => {
    const fixture = fixtures[1]!;
    const snapshot = createSummaryV3StyleOperationSnapshot(requestFor(fixture));
    const candidate = createSummaryV3StyleCandidate(snapshot, [{
      unitId: 'candidate',
      text: fixture.source.replace('builds', 'creates'),
      factIds: snapshot.requiredFacts.map((fact) => fact.id),
    }]);
    expect(candidate.snapshotHash).toBe(snapshot.snapshotHash);
    expect(candidate.manifestHash).toBe(snapshot.manifestHash);
  });
});
