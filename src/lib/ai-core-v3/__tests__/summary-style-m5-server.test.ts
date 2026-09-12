import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  hashSummaryV3StyleValue,
  normalizedSummaryV3StyleLength,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3Style,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleServer,
  type SummaryV3StyleEvaluatorInput,
  type SummaryV3StyleRepairWriterInput,
  type SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';

const source = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';

function requestFor(style: SummaryV3Style, overrides: Partial<SummaryV3StyleRequest> = {}): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: `summary_${style}`,
    operationId: `server-${style}-001`,
    style,
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: source,
    protectedEntities: ['Ava Patel'],
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' }, { id: 'role', text: 'Product Engineer' }, { id: 'employer', text: 'Atlas' },
      { id: 'duty-api', text: 'builds reliable APIs' }, { id: 'duty-mentor', text: 'mentors peers' },
      { id: 'metric', text: 'improved delivery by 20%' }, { id: 'duration', text: '24 months' },
    ],
    manifest: {
      manifestId: 'server-manifest', contextId: 'server-context', sourceLocale: 'en', currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24,
        facts: [
          { id: 'duty-api', text: 'builds reliable APIs' }, { id: 'duty-mentor', text: 'mentors peers' },
          { id: 'metric', text: 'improved delivery by 20%' }, { id: 'context-only-tool', text: 'Kubernetes' },
        ],
      }],
    },
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

const candidateByStyle: Record<SummaryV3Style, string> = {
  shorter: 'Ava Patel is a Product Engineer at Atlas, builds reliable APIs, mentors peers, improved delivery by 20% over 24 months.',
  stronger: 'Ava Patel is a Product Engineer at Atlas. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.',
  professional: 'Ava Patel is a Product Engineer at Atlas who builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.',
};

const emptyLocaleFixtures = {
  en: { role: 'Product Engineer', employer: 'Atlas', fact: 'builds reliable APIs', candidate: 'Product Engineer at Atlas builds reliable APIs for 24 months.' },
  de: { role: 'Produktentwicklerin', employer: 'Atlas', fact: 'entwickelt zuverlässige APIs', candidate: 'Produktentwicklerin bei Atlas entwickelt zuverlässige APIs seit 24 Monaten.' },
  sr: { role: 'Softverska inženjerka', employer: 'Atlas', fact: 'izrađuje pouzdane API-je', candidate: 'Softverska inženjerka u Atlasu izrađuje pouzdane API-je 24 meseca.' },
  hi: { role: 'सॉफ्टवेयर इंजीनियर', employer: 'एटलस', fact: 'विश्वसनीय एपीआई बनाती हैं', candidate: 'एटलस में सॉफ्टवेयर इंजीनियर विश्वसनीय एपीआई २४ महीनों से बनाती हैं।' },
  ar: { role: 'مهندسة برمجيات', employer: 'أطلس', fact: 'تبني واجهات برمجة موثوقة', candidate: 'مهندسة برمجيات في أطلس تبني واجهات برمجة موثوقة منذ ٢٤ شهرا.' },
  ja: { role: 'ソフトウェアエンジニア', employer: 'アトラス', fact: '信頼性の高いAPIを構築', candidate: 'アトラスのソフトウェアエンジニアとして信頼性の高いAPIを２４か月間構築しました。' },
} as const;

function emptyLocaleRequest(locale: keyof typeof emptyLocaleFixtures): SummaryV3StyleRequest {
  const base = requestFor('professional');
  const fixture = emptyLocaleFixtures[locale];
  return {
    ...base,
    requestedLocale: locale,
    sourceLocale: locale,
    visibleSummary: '',
    visibleSummaryFacts: undefined,
    protectedEntities: undefined,
    manifest: {
      manifestId: `locale-${locale}-manifest`,
      contextId: `locale-${locale}-context`,
      sourceLocale: locale,
      currentRoleEntryId: `locale-${locale}-current`,
      entries: [{
        stableId: `locale-${locale}-current`,
        role: fixture.role,
        employer: fixture.employer,
        employmentState: 'present',
        durationMonths: 24,
        facts: [{ id: `locale-${locale}-fact`, text: fixture.fact }],
      }],
    },
  };
}

function writerEnvelopeWithUnits(
  input: SummaryV3StyleWriterInput,
  units: readonly Readonly<{ unitId: string; text: string; factIds: readonly string[] }>[],
) {
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
      units: units.map((unit) => ({ unitId: unit.unitId, text: unit.text, factIds: [...unit.factIds] })),
    },
  };
}

function writerEnvelope(input: SummaryV3StyleWriterInput, text: string, factIds = input.requiredFacts.map((fact) => fact.id)) {
  return writerEnvelopeWithUnits(input, [{ unitId: 'candidate-1', text, factIds }]);
}

type TestPhaseMap = Record<'structural' | 'semantic_grounding' | 'language_native_quality' | 'style_fulfillment', {
  status: 'passed' | 'failed';
  violations: unknown[];
}>;

function passingPhases(): TestPhaseMap {
  return {
    structural: { status: 'passed' as const, violations: [] },
    semantic_grounding: { status: 'passed' as const, violations: [] },
    language_native_quality: { status: 'passed' as const, violations: [] },
    style_fulfillment: { status: 'passed' as const, violations: [] },
  };
}

function styleEvidence(input: SummaryV3StyleEvaluatorInput, noOpDetected = false) {
  if (input.style === 'shorter') {
    const sourceLength = normalizedSummaryV3StyleLength(input.sourceText);
    const candidateLength = input.candidate.normalizedLength;
    return {
      style: 'shorter', semanticCompressionOperations: 1,
      sourceNormalizedLength: sourceLength, candidateNormalizedLength: candidateLength,
      lengthDelta: sourceLength - candidateLength, lengthDeltaPercent: sourceLength > 0 ? (sourceLength - candidateLength) / sourceLength : 0,
      sourceUnitCount: countSummaryV3StyleUnits(input.sourceText), candidateUnitCount: input.candidate.unitCount,
      sourceClauseCount: countSummaryV3StyleClauses(input.sourceText), candidateClauseCount: input.candidate.clauseCount,
      factCoverage: true, shorterFulfilled: true, noOpDetected,
    };
  }
  if (input.style === 'stronger') {
    return {
      style: 'stronger', strongerPredicateTransformations: noOpDetected ? 0 : 1, structuralStrengtheningCount: noOpDetected ? 0 : 1,
      modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0, stackedModifierDetected: false,
      unsupportedAuthorityDetected: false, strongerFulfilled: true, noOpDetected,
    };
  }
  return {
    style: 'professional', professionalFramingOperations: noOpDetected ? 0 : 1, cohesionClarityOperations: noOpDetected ? 0 : 1,
      markerOnlyChangeDetected: false, jargonOrFillerDetected: false, professionalFulfilled: true, noOpDetected,
  };
}

function evaluatorEnvelope(input: SummaryV3StyleEvaluatorInput, options: {
  noOpDetected?: boolean;
  phases?: TestPhaseMap;
  evidence?: Record<string, unknown>;
  representedFactIdHashes?: readonly string[];
  missingFactIdHashes?: readonly string[];
  candidateHash?: string;
  candidateUnitHashes?: readonly string[];
  roleIdentityResolution?: unknown;
} = {}) {
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
      candidateHash: options.candidateHash || input.candidate.hash,
      candidateUnitHashes: options.candidateUnitHashes || input.candidate.units.map(summaryV3StyleCandidateUnitHash),
      phases: options.phases || passingPhases(),
      representedFactIdHashes: options.representedFactIdHashes || input.requiredFacts.map((fact) => fact.hash),
      missingFactIdHashes: options.missingFactIdHashes || [],
      roleIdentityResolution: Object.prototype.hasOwnProperty.call(options, 'roleIdentityResolution')
        ? options.roleIdentityResolution
        : input.roleIdentity.status === 'unresolved' ? 'equivalent' : 'not_required',
      styleEvidence: options.evidence || styleEvidence(input, options.noOpDetected),
    },
  };
}

describe('M5 shared injected Summary style server executor', () => {
  it.each(['shorter', 'stronger', 'professional'] as const)('returns one candidate-ready result for grounded %s output', async (style) => {
    const calls = { writer: 0, evaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor(style), {
      async write(input) { calls.writer += 1; return writerEnvelope(input, candidateByStyle[style]); },
      async evaluate(input) { calls.evaluator += 1; return evaluatorEnvelope(input); },
    });
    expect(result.kind).toBe('candidate_ready');
    if (result.kind === 'candidate_ready') {
      expect(result.style).toBe(style);
      expect(result.candidate.units[0].factIds.length).toBeGreaterThanOrEqual(7);
      expect(result.evidence).toMatchObject({ writerAttempts: 1, evaluatorAttempts: 1, retries: 0, fallbacks: 0, v2Fallthrough: 0 });
      expect(Object.isFrozen(result.candidate)).toBe(true);
      expect(Object.isFrozen(result.candidate.units)).toBe(true);
      expect(Object.isFrozen(result.candidate.units[0])).toBe(true);
      expect(Object.isFrozen(result.candidate.units[0]?.factIds)).toBe(true);
      expect(Object.isFrozen(result.evidence)).toBe(true);
      expect(Object.isFrozen(result.evidence.phaseStatuses)).toBe(true);
      expect(Object.isFrozen(result.evidence.styleEvidence)).toBe(true);
      const diagnostics = JSON.stringify(result.evidence);
      expect(diagnostics).not.toMatch(/Ava Patel|Atlas|Product Engineer|builds reliable APIs|Authorization|cookie|bearer|provider body|prompt|sk-/iu);
    }
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('keeps source employment-state preservation independent from contradiction', async () => {
    const explicitCurrentSource = 'Ava Patel currently works as a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const neutralCandidate = 'Ava Patel, a Product Engineer at Atlas. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const result = await executeSummaryV3StyleServer(requestFor('stronger', { visibleSummary: explicitCurrentSource }), {
      async write(input) { return writerEnvelope(input, neutralCandidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result.kind).toBe('handled_failure');
    if (result.kind === 'handled_failure') {
      expect(result.typedReason).toBe('lost_source_fact');
      expect(result.evidence.sourceFloorMismatchClass).toBeNull();
      expect(result.evidence.employmentStateContradictionClass).toBeNull();
      expect(result.evidence.employmentOppositeFrameDetected).toBe(false);
    }
  });

  it('keeps execution terminals bound to the selected employment frame modifiers', async () => {
    const currentSource = 'Ava Patel currently works at Atlas as Product Engineer. Ava Patel previously used another tool. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const completedSource = 'Ava Patel formerly worked at Atlas as Product Engineer. Ava Patel currently supports a side project. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const makeRequest = (visibleSummary: string, employmentState: 'present' | 'completed') => {
      const base = requestFor('stronger');
      return {
        ...base,
        visibleSummary,
        manifest: {
          ...base.manifest,
          currentRoleEntryId: employmentState === 'present' ? 'entry-current' : null,
          entries: base.manifest.entries.map((entry) => ({ ...entry, employmentState })),
        },
      } satisfies SummaryV3StyleRequest;
    };
    const run = (request: SummaryV3StyleRequest, candidate: string) => executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });

    const currentPreserved = await run(makeRequest(currentSource, 'present'),
      'Ava Patel currently works at Atlas as Product Engineer. Ava Patel previously used another tool. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
    expect(currentPreserved.kind).toBe('candidate_ready');
    if (currentPreserved.kind === 'candidate_ready') {
      expect(currentPreserved.evidence.employmentStateContradictionClass).toBeNull();
      expect(currentPreserved.evidence.employmentOppositeFrameDetected).toBe(false);
    }

    const completedPreserved = await run(makeRequest(completedSource, 'completed'),
      'Ava Patel formerly worked at Atlas as Product Engineer. Ava Patel currently supports a side project. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
    expect(completedPreserved.kind).toBe('candidate_ready');
    if (completedPreserved.kind === 'candidate_ready') {
      expect(completedPreserved.evidence.employmentStateContradictionClass).toBeNull();
      expect(completedPreserved.evidence.employmentOppositeFrameDetected).toBe(false);
    }

    const neutral = await run(makeRequest(completedSource, 'completed'),
      'Ava Patel, a Product Engineer at Atlas. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
    expect(neutral).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });

    const completedToCurrent = await run(makeRequest(completedSource, 'completed'),
      'Ava Patel formerly worked at Atlas as Product Engineer. Ava Patel currently supports a side project. Ava Patel currently works at Atlas as Product Engineer. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
    expect(completedToCurrent).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    if (completedToCurrent.kind === 'handled_failure') {
      expect(completedToCurrent.evidence.employmentStateContradictionClass).toBe('completed_entry_current_marker');
      expect(completedToCurrent.evidence.employmentOppositeFrameDetected).toBe(true);
    }

    const currentToCompleted = await run(makeRequest(currentSource, 'present'),
      'Ava Patel currently works at Atlas as Product Engineer. Ava Patel previously used another tool. Ava Patel formerly worked at Atlas as Product Engineer. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
    expect(currentToCompleted).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    if (currentToCompleted.kind === 'handled_failure') {
      expect(currentToCompleted.evidence.employmentStateContradictionClass).toBe('present_entry_prior_marker');
      expect(currentToCompleted.evidence.employmentOppositeFrameDetected).toBe(true);
    }
  });

  it('keeps execution terminals fail-closed for bounded Hindi and Japanese postposed employment states', async () => {
    const cases = [
      {
        locale: 'hi' as const,
        role: 'सॉफ्टवेयर इंजीनियर',
        employer: 'एटलस',
        present: 'मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ।',
        completed: 'मैं एटलस में सॉफ्टवेयर इंजीनियर था।',
        neutral: 'एटलस में सॉफ्टवेयर इंजीनियर ने इंस्टॉलेशन पूरे किए।',
      },
      {
        locale: 'ja' as const,
        role: 'ソフトウェアエンジニア',
        employer: 'アトラス',
        present: 'アトラスのソフトウェアエンジニアとして働いています。',
        completed: 'アトラスのソフトウェアエンジニアとして働いていました。',
        neutral: 'アトラスのソフトウェアエンジニアとして構築しました。',
      },
    ] as const;
    const makeRequest = (item: typeof cases[number], source: string, employmentState: 'present' | 'completed') => {
      const base = emptyLocaleRequest(item.locale);
      return {
        ...base,
        operation: 'summary_professional' as const,
        operationId: `postposed-${item.locale}-${employmentState}`,
        style: 'professional' as const,
        visibleSummary: source,
        visibleSummaryFacts: undefined,
        manifest: {
          ...base.manifest,
          currentRoleEntryId: employmentState === 'present' ? base.manifest.currentRoleEntryId : null,
          entries: base.manifest.entries.map((entry) => ({
            ...entry,
            role: item.role,
            employer: item.employer,
            employmentState,
          })),
        },
      } satisfies SummaryV3StyleRequest;
    };
    const run = (request: SummaryV3StyleRequest, candidate: string, noOpDetected = false) => executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected }); },
    });

    for (const item of cases) {
      const present = await run(makeRequest(item, item.present, 'present'), item.present, true);
      expect(present.kind).toBe('safe_no_op');
      const presentNeutral = await run(makeRequest(item, item.present, 'present'), item.neutral);
      expect(presentNeutral).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
      if (presentNeutral.kind === 'handled_failure') {
        expect(presentNeutral.evidence.employmentStateContradictionClass).toBeNull();
        expect(presentNeutral.evidence.employmentOppositeFrameDetected).toBe(false);
      }
      const presentToCompleted = await run(makeRequest(item, item.present, 'present'), `${item.present} ${item.completed}`);
      expect(presentToCompleted).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
      if (presentToCompleted.kind === 'handled_failure') {
        expect(presentToCompleted.evidence.employmentStateContradictionClass).toBe('present_entry_prior_marker');
        expect(presentToCompleted.evidence.employmentOppositeFrameDetected).toBe(true);
      }

    }
  });

  it('fails closed on same-frame conflicting employment states in Enhance and Generate modes', async () => {
    const cases = [
      {
        locale: 'hi' as const,
        presentSource: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ। विश्वसनीय एपीआई बनाती हैं।',
        completedSource: 'सॉफ्टवेयर इंजीनियर। एटलस। विश्वसनीय एपीआई बनाती हैं।',
        presentConflict: 'मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर हूँ। मैं वर्तमान में एटलस में सॉफ्टवेयर इंजीनियर था। विश्वसनीय एपीआई बनाती हैं।',
        completedConflict: 'सॉफ्टवेयर इंजीनियर। एटलस। विश्वसनीय एपीआई बनाती हैं। मैं एटलस में सॉफ्टवेयर इंजीनियर थीं। मैं एटलस में सॉफ्टवेयर इंजीनियर हूँ।',
      },
      {
        locale: 'ja' as const,
        presentSource: '現在アトラスのソフトウェアエンジニアとして働いています。信頼性の高いAPIを構築。',
        completedSource: 'ソフトウェアエンジニア。アトラス。信頼性の高いAPIを構築。',
        presentConflict: '現在アトラスのソフトウェアエンジニアとして働いています。現在アトラスのソフトウェアエンジニアとして働いていました。信頼性の高いAPIを構築。',
        completedConflict: 'ソフトウェアエンジニア。アトラス。信頼性の高いAPIを構築。ソフトウェアエンジニアとしてアトラスで働いていました。ソフトウェアエンジニアとしてアトラスで働いています。',
      },
    ] as const;
    const enhancePresent = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) {
        return writerEnvelope(input, `${source} Ava Patel formerly worked at Atlas as Product Engineer.`);
      },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(enhancePresent).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim', mode: 'enhance_existing_content' });
    if (enhancePresent.kind === 'handled_failure') {
      expect(enhancePresent.evidence.sourceFloorMismatchClass).toBe('employment_state_contradiction');
      expect(enhancePresent.evidence.employmentStateContradictionClass).toBe('present_entry_prior_marker');
      expect(enhancePresent.evidence.employmentOppositeFrameDetected).toBe(true);
    }

    const enhanceCompletedSource = 'Ava Patel formerly worked at Atlas as Product Engineer. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const completedBase = requestFor('stronger');
    const enhanceCompletedRequest = {
      ...completedBase,
      operationId: 'same-frame-enhance-completed',
      visibleSummary: enhanceCompletedSource,
      manifest: {
        ...completedBase.manifest,
        currentRoleEntryId: null,
        entries: completedBase.manifest.entries.map((entry) => ({ ...entry, employmentState: 'completed' as const })),
      },
    } satisfies SummaryV3StyleRequest;
    const enhanceCompleted = await executeSummaryV3StyleServer(enhanceCompletedRequest, {
      async write(input) {
        return writerEnvelope(input, `${enhanceCompletedSource} Ava Patel currently works at Atlas as Product Engineer.`);
      },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(enhanceCompleted).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim', mode: 'enhance_existing_content' });
    if (enhanceCompleted.kind === 'handled_failure') {
      expect(enhanceCompleted.evidence.sourceFloorMismatchClass).toBe('employment_state_contradiction');
      expect(enhanceCompleted.evidence.employmentStateContradictionClass).toBe('completed_entry_current_marker');
      expect(enhanceCompleted.evidence.employmentOppositeFrameDetected).toBe(true);
    }

    for (const item of cases) {
      const generateBase = emptyLocaleRequest(item.locale);
      const generate = async (employmentState: 'present' | 'completed', candidate: string) => {
        const targetEntryId = `generate-${item.locale}-target`;
        const currentEntryId = `generate-${item.locale}-current`;
        const targetEntry = {
          stableId: targetEntryId,
          role: emptyLocaleFixtures[item.locale].role,
          employer: emptyLocaleFixtures[item.locale].employer,
          employmentState,
          durationMonths: 24,
          facts: [{ id: `${targetEntryId}-fact`, text: emptyLocaleFixtures[item.locale].fact }],
        };
        const currentEntry = {
          stableId: currentEntryId,
          role: item.locale === 'hi' ? 'सहायक इंजीनियर' : 'テストエンジニア',
          employer: item.locale === 'hi' ? 'नोवा' : 'ノヴァ',
          employmentState: 'present' as const,
          durationMonths: 12,
          facts: [{ id: `${currentEntryId}-fact`, text: item.locale === 'hi' ? 'टीमों का समर्थन' : 'チームを支援' }],
        };
        const entries = employmentState === 'present' ? [targetEntry] : [currentEntry, targetEntry];
        const generatedCandidate = employmentState === 'present'
          ? candidate
          : `${item.locale === 'hi' ? 'नोवा में सहायक इंजीनियर हूँ। टीमों का समर्थन।' : 'ノヴァのテストエンジニアとして働いています。チームを支援。'} ${candidate}`;
        const request = {
          ...generateBase,
          operation: 'summary_professional' as const,
          operationId: `same-frame-generate-${item.locale}-${employmentState}`,
          style: 'professional' as const,
          visibleSummary: '',
          visibleSummaryFacts: undefined,
          protectedEntities: undefined,
          manifest: {
            ...generateBase.manifest,
            currentRoleEntryId: employmentState === 'present' ? targetEntryId : currentEntryId,
            entries,
          },
        } satisfies SummaryV3StyleRequest;
        const calls = { writer: 0, evaluator: 0, repairWriter: 0, repairEvaluator: 0 };
        const result = await executeSummaryV3StyleServer(request, {
          async write(input) { calls.writer += 1; return writerEnvelope(input, generatedCandidate); },
          async evaluate(input) { calls.evaluator += 1; return evaluatorEnvelope(input); },
          async repairWrite() { calls.repairWriter += 1; return {}; },
          async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
        });
        return { result, calls };
      };

      const generatedPresent = await generate('present', item.presentConflict);
      expect(generatedPresent.result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim', mode: 'generate_from_context' });
      if (generatedPresent.result.kind === 'handled_failure') {
        expect(generatedPresent.result.evidence.sourceFloorMismatchClass).toBe('employment_state_contradiction');
        expect(generatedPresent.result.evidence.employmentStateContradictionClass).toBe('present_entry_prior_marker');
        expect(generatedPresent.result.evidence.employmentOppositeFrameDetected).toBe(true);
      }
      expect(generatedPresent.calls).toMatchObject({ writer: 1, evaluator: 1, repairWriter: 0, repairEvaluator: 0 });

      const generatedCompleted = await generate('completed', item.completedConflict);
      expect(generatedCompleted.result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim', mode: 'generate_from_context' });
      if (generatedCompleted.result.kind === 'handled_failure') {
        expect(generatedCompleted.result.evidence.sourceFloorMismatchClass).toBe('employment_state_contradiction');
        expect(generatedCompleted.result.evidence.employmentStateContradictionClass).toBe('completed_entry_current_marker');
        expect(generatedCompleted.result.evidence.employmentOppositeFrameDetected).toBe(true);
      }
      expect(generatedCompleted.calls).toMatchObject({ writer: 1, evaluator: 1, repairWriter: 0, repairEvaluator: 0 });
    }
  });

  it('closes role/employer directionality at the execution terminal', async () => {
    const employerFirstSource = 'Ava Patel works at Atlas as a Product Engineer. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const neutralCandidate = 'Ava Patel, a Product Engineer at Atlas. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const currentCandidate = employerFirstSource;
    const formerCandidate = 'Ava Patel works at Atlas as a Product Engineer. Ava Patel formerly worked at Atlas as a Product Engineer. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const base = requestFor('stronger', { visibleSummary: employerFirstSource });
    const run = (candidate: string) => executeSummaryV3StyleServer(base, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });

    const neutral = await run(neutralCandidate);
    expect(neutral).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    if (neutral.kind === 'handled_failure') {
      expect(neutral.evidence.sourceFloorMismatchClass).toBeNull();
      expect(neutral.evidence.employmentStateContradictionClass).toBeNull();
      expect(neutral.evidence.employmentOppositeFrameDetected).toBe(false);
    }

    const current = await run(currentCandidate);
    expect(current).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    if (current.kind === 'handled_failure') {
      expect(current.evidence.employmentStateContradictionClass).toBeNull();
      expect(current.evidence.employmentOppositeFrameDetected).toBe(false);
    }

    const former = await run(formerCandidate);
    expect(former).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    if (former.kind === 'handled_failure') {
      expect(former.evidence.employmentStateContradictionClass).toBe('present_entry_prior_marker');
      expect(former.evidence.employmentOppositeFrameDetected).toBe(true);
    }
  });

  it('uses the immutable context authority for empty source across all three styles', async () => {
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      const result = await executeSummaryV3StyleServer({
        ...requestFor(style), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
      }, {
        async write(input) {
          const text = 'Product Engineer at Atlas builds reliable APIs, mentors peers, improved delivery by 20%, uses Kubernetes, and has 24 months of experience.';
          return writerEnvelope(input, text);
        },
        async evaluate(input) { return evaluatorEnvelope(input); },
      });
      expect(result.kind).toBe('candidate_ready');
      if (result.kind === 'candidate_ready') expect(result.mode).toBe('generate_from_context');
    }
  });

  it('rejects heading, explanatory, and raw-object writer prose in empty mode before evaluator authority', async () => {
    const body = 'Product Engineer at Atlas builds reliable APIs, mentors peers, uses Kubernetes, and improved delivery by 20% over 24 months.';
    for (const candidate of [
      `Professional Summary — ${body}`,
      `Here is your summary: ${body}`,
      `Professional Summary\n${body}`,
      `{"toolName":"submit_summary_style_candidate"} ${body}`,
      `~~~\n${body}\n~~~`,
      `+ ${body}`,
      `> ${body}`,
      `${body}\n---\naudit`,
      `${body}\n| Field | Value |\n| --- | --- |\n| status | audit |`,
      `${body} ~~audit~~`,
      `${body} [audit][source]`,
      `${body} ![audit][source]`,
      `${body}\n___\naudit`,
      `${body}\n***\naudit`,
      `${body}\n[^note]: audit`,
      `${body} <operationId>audit</operationId>`,
      `${body} &lt;operationId&gt;audit&lt;/operationId&gt;`,
      `${body} {"enabled":true}`,
    ]) {
      let evaluatorCalls = 0;
      const result = await executeSummaryV3StyleServer({
        ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
      }, {
        async write(input) { return writerEnvelope(input, candidate); },
        async evaluate() { evaluatorCalls += 1; return {}; },
      });
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed', mode: 'generate_from_context' });
      expect(evaluatorCalls).toBe(0);
    }
  });

  it('rejects autolinks, inline footnotes, emphasis, and indented-code transport before evaluator authority', async () => {
    const body = 'Product Engineer at Atlas builds reliable APIs, mentors peers, uses Kubernetes, and improved delivery by 20% over 24 months.';
    const unsafeCandidates = [
      body + '[^note]',
      body + ' (**reliable**)',
      body + '(_reliable_)',
      body + ':*reliable*',
      body + ',*reliable*',
      body + ' “*reliable*”',
      body + '—*reliable*',
      body + ':***reliable***',
      body + ':___reliable___',
      body + ' (platform)*reliable*',
      body + ' [platform]*reliable*',
      body + ')*reliable*',
      body + '*reliable*',
      body + '**reliable**',
      body + ' <https://example.com>',
      body + ' <mailto:ava@example.com>',
      body + ' &lt;https://example.com&gt;',
      body + ' <ava@example.com>',
      body + ' &lt;ava@example.com&gt;',
      body + ' <ftp://example.com>',
      body + '\n\n    audit',
      body + '\n\taudit',
      'Professional Summary\u2028' + body,
      body + '\u2028Operation ID: audit-001',
      'Professional\u200b Summary\n' + body,
      body + ' Operation\u200b ID: audit-001',
    ];
    for (const candidate of unsafeCandidates) {
      let evaluatorCalls = 0;
      const result = await executeSummaryV3StyleServer({
        ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
      }, {
        async write(input) { return writerEnvelope(input, candidate); },
        async evaluate() { evaluatorCalls += 1; return {}; },
      });
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed', mode: 'generate_from_context' });
      expect(evaluatorCalls).toBe(0);
    }
  });

  it('rejects structural transport formed across ordered writer units before evaluator authority', async () => {
    const calls = { evaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) {
        const [firstFact, secondFact, ...remainingFacts] = input.requiredFacts;
        if (!firstFact || !secondFact) throw new Error('missing fixture authority');
        return writerEnvelopeWithUnits(input, [
          { unitId: 'candidate-1', text: 'project', factIds: [firstFact.id] },
          { unitId: 'candidate-2', text: 'overview', factIds: [secondFact.id] },
          {
            unitId: 'candidate-3',
            text: candidateByStyle.professional,
            factIds: remainingFacts.map((fact) => fact.id),
          },
        ]);
      },
      async evaluate() { calls.evaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(calls).toEqual({ evaluator: 0 });
  });

  it('rejects reserved metadata reconstituted across ordered writer units before evaluator authority', async () => {
    const calls = { evaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) {
        const [firstFact, ...remainingFacts] = input.requiredFacts;
        if (!firstFact) throw new Error('missing fixture authority');
        return writerEnvelopeWithUnits(input, [
          { unitId: 'candidate-1', text: 'Operation', factIds: [firstFact.id] },
          {
            unitId: 'candidate-2',
            text: 'ID: audit-001 ' + candidateByStyle.professional,
            factIds: remainingFacts.map((fact) => fact.id),
          },
        ]);
      },
      async evaluate() { calls.evaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(calls).toEqual({ evaluator: 0 });
  });

  it.each([
    ['de', 'Zusammenfassung'], ['de', 'Hier ist Ihre Zusammenfassung'],
    ['sr', 'Sažetak'], ['sr', 'Evo vašeg sažetka'],
    ['hi', 'सारांश'], ['hi', 'यह आपका सारांश है'],
    ['ar', 'ملخص'], ['ar', 'هذا ملخصك'],
    ['ar', 'المشاريع'],
    ['hi', 'परियोजनाएं'],
    ['ja', '職務要約'], ['ja', '以下が要約です'], ['ja', '経歴'], ['ja', 'プロジェクト概要'],
  ] as const)('rejects representative $locale heading or preamble writer prose before evaluator authority', async (locale, prefix) => {
    const base = emptyLocaleRequest(locale);
    const visibleSummary = emptyLocaleFixtures[locale].candidate;
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...base,
      visibleSummary,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, `${prefix}: ${visibleSummary}`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it('lets evaluator semantic grounding reject an empty-source candidate that injects a fact outside the manifest', async () => {
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Product Engineer at Atlas builds reliable APIs, mentors peers, uses Kubernetes and Rust, and improved delivery by 20% over 24 months.');
      },
      async evaluate(input) {
        const phases = passingPhases();
        phases.semantic_grounding = {
          status: 'failed',
          violations: [{ code: 'unsupported_claim', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: false }],
        };
        return evaluatorEnvelope(input, { phases });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim', mode: 'generate_from_context' });
  });

  it('terminalizes evaluator-proven missing empty-source manifest coverage without a repair or fallback', async () => {
    const calls = { evaluator: 0, repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Product Engineer at Atlas builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
      },
      async evaluate(input) {
        calls.evaluator += 1;
        const missing = input.requiredFacts.find((fact) => fact.text === 'Kubernetes');
        if (!missing) throw new Error('missing fixture authority');
        const phases = passingPhases();
        phases.semantic_grounding = {
          status: 'failed',
          violations: [{
            code: 'missing_fact', factIdHashes: [missing.hash],
            unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: false,
          }],
        };
        return evaluatorEnvelope(input, {
          phases,
          representedFactIdHashes: input.requiredFacts.filter((fact) => fact.hash !== missing.hash).map((fact) => fact.hash),
          missingFactIdHashes: [missing.hash],
        });
      },
      async repairWrite() { calls.repairWriter += 1; throw new Error('must not run'); },
      async repairEvaluate() { calls.repairEvaluator += 1; throw new Error('must not run'); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', mode: 'generate_from_context' });
    expect(calls).toEqual({ evaluator: 1, repairWriter: 0, repairEvaluator: 0 });
  });

  it('rejects an evaluator missing-fact violation that does not bind its declared missing partition', async () => {
    const calls = { repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Product Engineer at Atlas builds reliable APIs, mentors peers, uses Kubernetes, and improved delivery by 20% over 24 months.');
      },
      async evaluate(input) {
        const missing = input.requiredFacts[input.requiredFacts.length - 1]!;
        const mismatched = input.requiredFacts[0]!;
        const phases = passingPhases();
        phases.semantic_grounding = {
          status: 'failed',
          violations: [{
            code: 'missing_fact', factIdHashes: [mismatched.hash],
            unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true,
          }],
        };
        return evaluatorEnvelope(input, {
          phases,
          representedFactIdHashes: input.requiredFacts.filter((fact) => fact.hash !== missing.hash).map((fact) => fact.hash),
          missingFactIdHashes: [missing.hash],
        });
      },
      async repairWrite() { calls.repairWriter += 1; return {}; },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    expect(calls).toEqual({ repairWriter: 0, repairEvaluator: 0 });
  });

  it('rejects a text-only evaluator replay when unchanged candidate prose carries permuted unit fact labels', async () => {
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) {
        const factIds = input.requiredFacts.map((fact) => fact.id);
        return writerEnvelopeWithUnits(input, [
          {
            unitId: 'candidate-1', text: 'Product Engineer at Atlas builds reliable APIs.',
            factIds: factIds.slice(4),
          },
          {
            unitId: 'candidate-2', text: 'Mentors peers, uses Kubernetes, and improved delivery by 20% over 24 months.',
            factIds: factIds.slice(0, 4),
          },
        ]);
      },
      async evaluate(input) {
        // This was the old text-only identity shape. The prose is unchanged,
        // but it does not bind the ordered unit labels the evaluator received.
        return evaluatorEnvelope(input, {
          candidateHash: input.candidate.hash,
          candidateUnitHashes: input.candidate.units.map((unit) => hashSummaryV3StyleValue(unit.text)),
        });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
  });

  it('returns safe_no_op without repair or apply authority when an existing source is already suitable', async () => {
    const calls = { repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
      async repairWrite() { calls.repairWriter += 1; throw new Error('must not run'); },
      async repairEvaluate() { calls.repairEvaluator += 1; throw new Error('must not run'); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
    expect(calls).toEqual({ repairWriter: 0, repairEvaluator: 0 });
    if (result.kind === 'safe_no_op') expect(result.evidence).toMatchObject({ meaningfulChangeDetected: false, noOpDetected: true, v2Fallthrough: 0 });
  });

  it('keeps ordinary wrapped proper-name prose eligible for a safe no-op', async () => {
    const wrappedSource = 'Ava Patel\nis a Product Engineer at Atlas who builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    let writerCalls = 0;
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional', { visibleSummary: wrappedSource }), {
      async write(input) { writerCalls += 1; return writerEnvelope(input, wrappedSource); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
    expect(writerCalls).toBe(1);
    expect(evaluatorCalls).toBe(1);
  });

  it('keeps an ordered multi-unit complete-sentence candidate eligible for evaluation', async () => {
    const calls = { writer: 0, evaluator: 0 };
    const firstUnit = 'Product Engineer at Atlas builds reliable APIs.';
    const secondUnit = 'Mentors peers, uses Kubernetes, and improved delivery by 20% over 24 months.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) {
        calls.writer += 1;
        const firstFactIds = input.requiredFacts.slice(0, Math.ceil(input.requiredFacts.length / 2)).map((fact) => fact.id);
        return writerEnvelopeWithUnits(input, [
          { unitId: 'candidate-1', text: firstUnit, factIds: firstFactIds },
          {
            unitId: 'candidate-2',
            text: secondUnit,
            factIds: input.requiredFacts.filter((fact) => !firstFactIds.includes(fact.id)).map((fact) => fact.id),
          },
        ]);
      },
      async evaluate(input) { calls.evaluator += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', mode: 'generate_from_context' });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('keeps a grammatical wrap before a proper-noun tool eligible for a safe no-op', async () => {
    const wrappedSource = 'Ava Patel is a Product Engineer at Atlas who works with\nKubernetes to build reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const base = requestFor('professional');
    const result = await executeSummaryV3StyleServer({
      ...base,
      visibleSummary: wrappedSource,
      visibleSummaryFacts: [
        { id: 'name', text: 'Ava Patel' }, { id: 'role', text: 'Product Engineer' }, { id: 'employer', text: 'Atlas' },
        { id: 'duty-api', text: 'build reliable APIs' }, { id: 'duty-mentor', text: 'mentors peers' },
        { id: 'metric', text: 'improved delivery by 20%' }, { id: 'duration', text: '24 months' }, { id: 'tool', text: 'Kubernetes' },
      ],
      manifest: {
        ...base.manifest,
        entries: [{
          ...base.manifest.entries[0],
          facts: [
            { id: 'duty-api', text: 'build reliable APIs' }, { id: 'duty-mentor', text: 'mentors peers' },
            { id: 'metric', text: 'improved delivery by 20%' }, { id: 'tool', text: 'Kubernetes' },
          ],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, wrappedSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('treats an omitted visible source as an owned malformed request instead of silently generating', async () => {
    let writerCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('shorter'), visibleSummary: undefined as unknown as string,
    }, {
      async write() { writerCalls += 1; return {}; },
      async evaluate() { return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'malformed_request', mode: 'enhance_existing_content' });
    expect(writerCalls).toBe(0);
  });

  it.each(['shorter', 'stronger', 'professional'] as const)('keeps owned %s malformed and empty-context failures out of not_applicable paths', async (style) => {
    const noCalls = { writer: 0, evaluator: 0 };
    const malformed = await executeSummaryV3StyleServer({
      ...requestFor(style), enabled: 'enabled' as unknown as boolean,
    }, {
      async write() { noCalls.writer += 1; return {}; },
      async evaluate() { noCalls.evaluator += 1; return {}; },
    });
    expect(malformed).toMatchObject({ kind: 'handled_failure', typedReason: 'malformed_request', mode: 'enhance_existing_content' });
    const whitespace = await executeSummaryV3StyleServer({
      ...requestFor(style), visibleSummary: '   ', visibleSummaryFacts: undefined,
    }, {
      async write() { noCalls.writer += 1; return {}; },
      async evaluate() { noCalls.evaluator += 1; return {}; },
    });
    expect(whitespace).toMatchObject({ kind: 'handled_failure', typedReason: 'malformed_request', mode: 'enhance_existing_content' });
    const insufficient = await executeSummaryV3StyleServer({
      ...requestFor(style), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
      manifest: {
        ...requestFor(style).manifest,
        entries: [{ ...requestFor(style).manifest.entries[0]!, durationMonths: 0, facts: [] }],
      },
    }, {
      async write() { noCalls.writer += 1; return {}; },
      async evaluate() { noCalls.evaluator += 1; return {}; },
    });
    expect(insufficient).toMatchObject({ kind: 'handled_failure', typedReason: 'insufficient_context', mode: 'generate_from_context' });
    const ambiguous = await executeSummaryV3StyleServer({
      ...requestFor(style), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
      manifest: { ...requestFor(style).manifest, currentRoleEntryId: null },
    }, {
      async write() { noCalls.writer += 1; return {}; },
      async evaluate() { noCalls.evaluator += 1; return {}; },
    });
    expect(ambiguous).toMatchObject({ kind: 'handled_failure', typedReason: 'ambiguous_current_role', mode: 'generate_from_context' });
    expect(noCalls).toEqual({ writer: 0, evaluator: 0 });
  });

  it('uses only the explicit visible source at runtime and ignores stale/persisted/provider-shaped extra request fields', async () => {
    let observedSource = '';
    const runtimeRequest = {
      ...requestFor('professional'),
      persistedSummary: 'STALE SUMMARY MUST NOT BECOME AUTHORITY',
      priorProviderOutput: 'PRIOR PROVIDER OUTPUT MUST NOT BECOME AUTHORITY',
      rejectedCandidate: 'REJECTED CANDIDATE MUST NOT BECOME AUTHORITY',
    } as SummaryV3StyleRequest;
    const result = await executeSummaryV3StyleServer(runtimeRequest, {
      async write(input) { observedSource = input.sourceText; return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result.kind).toBe('candidate_ready');
    expect(observedSource).toBe(source);
    expect(observedSource).not.toMatch(/STALE|PRIOR|REJECTED/u);
  });

  it('passes raw source authority and enforced forced-tool metadata to the injected writer and evaluator only', async () => {
    const observed: {
      writer?: SummaryV3StyleWriterInput;
      evaluator?: SummaryV3StyleEvaluatorInput;
    } = {};
    const capturedRequest = requestFor('professional', {
      manifest: {
        ...requestFor('professional').manifest,
        entries: [
          ...requestFor('professional').manifest.entries,
          { stableId: 'entry-prior', role: 'Analyst', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'prior-duty', text: 'reviewed reports' }] },
        ],
      },
    });
    const result = await executeSummaryV3StyleServer(capturedRequest, {
      async write(input) { observed.writer = input; return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) { observed.evaluator = input; return evaluatorEnvelope(input); },
    });
    expect(result.kind).toBe('candidate_ready');
    if (!observed.writer || !observed.evaluator) throw new Error('expected injected contracts');
    const writerCapture = observed.writer;
    const evaluatorCapture = observed.evaluator;
    expect(writerCapture).toMatchObject({
      sourceText: source,
      currentRoleEntryId: 'entry-current',
      structuredDurationMonths: 36,
      forcedTool: { toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, toolChoice: 'required', strict: true, expectedToolBlocks: 1, allowedTextBlocks: 0 },
    });
    expect(writerCapture.requiredFacts.map((fact) => fact.text)).toContain('builds reliable APIs');
    expect(writerCapture.sourceUnits).toEqual(expect.arrayContaining([expect.objectContaining({ id: expect.any(String), hash: expect.any(String) })]));
    expect(writerCapture.selectedEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({ stableId: 'entry-current', employmentState: 'present', durationMonths: 24 }),
      expect.objectContaining({ stableId: 'entry-prior', employmentState: 'completed', durationMonths: 12 }),
    ]));
    expect(writerCapture.forcedTool.schema).toMatchObject({ strict: true, input_schema: { additionalProperties: false } });
    expect(evaluatorCapture).toMatchObject({
      sourceText: source,
      currentRoleEntryId: 'entry-current',
      structuredDurationMonths: 36,
      forcedTool: { toolName: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, toolChoice: 'required', strict: true, expectedToolBlocks: 1, allowedTextBlocks: 0 },
    });
    expect(evaluatorCapture.manifestValidationCeiling.map((fact) => fact.text)).toContain('Kubernetes');
    expect(evaluatorCapture.manifestValidationCeiling.map((fact) => fact.id)).toEqual(expect.arrayContaining(['entry-current:employment_state', 'entry-prior:employment_state']));
    expect(evaluatorCapture.selectedEntries).toEqual(writerCapture.selectedEntries);
    expect(evaluatorCapture.sourceUnits).toEqual(writerCapture.sourceUnits);
    expect(evaluatorCapture.forcedTool.schema).toMatchObject({ strict: true, input_schema: { additionalProperties: false } });
    expect(evaluatorCapture.entityLocks.map((lock) => lock.value)).toEqual(expect.arrayContaining(['Ava Patel', 'Product Engineer', 'Atlas', '24']));
    expect(Object.isFrozen(writerCapture)).toBe(true);
    expect(Object.isFrozen(evaluatorCapture)).toBe(true);
    expect(Object.isFrozen(writerCapture.requiredFacts)).toBe(true);
    expect(Object.isFrozen(writerCapture.requiredFacts[0])).toBe(true);
    expect(Object.isFrozen(writerCapture.selectedEntries)).toBe(true);
    expect(Object.isFrozen(writerCapture.selectedEntries[0])).toBe(true);
    expect(Object.isFrozen(writerCapture.sourceUnits)).toBe(true);
    expect(Object.isFrozen(writerCapture.sourceUnits[0])).toBe(true);
    expect(Object.isFrozen(writerCapture.entityLocks)).toBe(true);
    expect(Object.isFrozen(writerCapture.forcedTool)).toBe(true);
    expect(Object.isFrozen(writerCapture.forcedTool.schema)).toBe(true);
    expect(Object.isFrozen(evaluatorCapture.manifestValidationCeiling)).toBe(true);
    expect(Object.isFrozen(evaluatorCapture.manifestValidationCeiling[0])).toBe(true);
  });

  it('rejects inconsistent safe-no-op evidence rather than allowing a no-op bypass', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        return evaluatorEnvelope(input, {
          noOpDetected: true,
          evidence: { ...styleEvidence(input, true), professionalFulfilled: false },
        });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
  });

  it('rejects a non-empty source metric that contradicts the immutable manifest before a safe no-op can be accepted', async () => {
    const inconsistentSource = 'Ava Patel is a Product Engineer at Atlas. She improved revenue by 99% over 24 months.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: inconsistentSource, visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, inconsistentSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('rejects unannotated direct role/employer source frames that contradict the manifest before writer or evaluator authority', async () => {
    for (const inconsistentSource of [
      'Ava Patel is a Data Scientist at Atlas. She builds reliable APIs.',
      'Ava Patel works as a Product Engineer at Nova and builds reliable APIs.',
      'Ava Patel, a Data Scientist at Acme, builds reliable APIs.',
      'Ava Patel is a data scientist at Atlas. She builds reliable APIs.',
      'Ava Patel works as a product engineer at nova and builds reliable APIs.',
    ]) {
      let writerCalls = 0;
      let evaluatorCalls = 0;
      const result = await executeSummaryV3StyleServer({
        ...requestFor('professional'), visibleSummary: inconsistentSource, visibleSummaryFacts: undefined, protectedEntities: undefined,
      }, {
        async write(input) { writerCalls += 1; return writerEnvelope(input, inconsistentSource); },
        async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
      });
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
      expect(writerCalls).toBe(0);
      expect(evaluatorCalls).toBe(0);
    }

    let compatibleWriterCalls = 0;
    let compatibleEvaluatorCalls = 0;
    const compatibleSource = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs.';
    const compatible = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: compatibleSource, visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) { compatibleWriterCalls += 1; return writerEnvelope(input, compatibleSource); },
      async evaluate(input) { compatibleEvaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(compatible).toMatchObject({ kind: 'safe_no_op' });
    expect(compatibleWriterCalls).toBe(1);
    expect(compatibleEvaluatorCalls).toBe(1);

    const compatibleAppositional = 'Ava Patel, a Product Engineer at Atlas, builds reliable APIs.';
    const appositional = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: compatibleAppositional, visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, compatibleAppositional); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(appositional).toMatchObject({ kind: 'safe_no_op' });

    const compatibleLowercase = 'Ava Patel is a product engineer at atlas. She builds reliable APIs.';
    const lowercase = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: compatibleLowercase, visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, compatibleLowercase); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(lowercase).toMatchObject({ kind: 'safe_no_op' });

    const corporateSource = 'Ava Patel is a Data Scientist at Atlas, Inc. She builds reliable APIs.';
    let corporateWriterCalls = 0;
    let corporateEvaluatorCalls = 0;
    const corporate = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: corporateSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          role: 'Data Scientist',
          employer: 'Atlas, Inc.',
        }],
      },
    }, {
      async write(input) { corporateWriterCalls += 1; return writerEnvelope(input, corporateSource); },
      async evaluate(input) { corporateEvaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(corporate).toMatchObject({ kind: 'safe_no_op' });
    expect(corporateWriterCalls).toBe(1);
    expect(corporateEvaluatorCalls).toBe(1);
  });

  it('rejects an unannotated nonnumeric source material-result claim before writer or evaluator authority', async () => {
    const unsupportedSource = 'Ava Patel is a Product Engineer at Atlas. She generates revenue for customers.';
    let writerCalls = 0;
    let evaluatorCalls = 0;
    const unsupported = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: unsupportedSource, visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) { writerCalls += 1; return writerEnvelope(input, unsupportedSource); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(unsupported).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(writerCalls).toBe(0);
    expect(evaluatorCalls).toBe(0);

    const attestedSource = 'Ava Patel is a Product Engineer at Atlas. She generates revenue for customers.';
    const attestedRequest: SummaryV3StyleRequest = {
      ...requestFor('professional'), visibleSummary: attestedSource, visibleSummaryFacts: undefined, protectedEntities: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          facts: [{ id: 'attested-result', text: 'generates revenue for customers' }],
        }],
      },
    };
    const attested = await executeSummaryV3StyleServer(attestedRequest, {
      async write(input) { return writerEnvelope(input, attestedSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(attested).toMatchObject({ kind: 'safe_no_op' });
  });

  it('rejects an unannotated Japanese employer-role frame that contradicts the manifest before writer or evaluator authority', async () => {
    const sourceForLocale = '私はアトラスのソフトウェアエンジニアとしてAPIを構築します。';
    const base = emptyLocaleRequest('ja');
    let writerCalls = 0;
    let evaluatorCalls = 0;
    const inconsistent = await executeSummaryV3StyleServer({
      ...base,
      operation: 'summary_professional',
      operationId: 'japanese-unannotated-role-mismatch',
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        entries: [{
          ...base.manifest.entries[0]!,
          role: 'データサイエンティスト',
          employer: 'アトラス',
          facts: [{ id: 'japanese-duty', text: 'APIを構築します' }],
        }],
      },
    }, {
      async write(input) { writerCalls += 1; return writerEnvelope(input, sourceForLocale); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(inconsistent).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(writerCalls).toBe(0);
    expect(evaluatorCalls).toBe(0);

    let reverseWriterCalls = 0;
    let reverseEvaluatorCalls = 0;
    const reverseSource = '私はアトラスのデータサイエンティストとしてAPIを構築します。';
    const reverse = await executeSummaryV3StyleServer({
      ...base,
      operation: 'summary_professional',
      operationId: 'japanese-unannotated-role-reverse-mismatch',
      style: 'professional',
      visibleSummary: reverseSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        entries: [{
          ...base.manifest.entries[0]!,
          role: 'ソフトウェアエンジニア',
          employer: 'アトラス',
          facts: [{ id: 'japanese-duty', text: 'APIを構築します' }],
        }],
      },
    }, {
      async write(input) { reverseWriterCalls += 1; return writerEnvelope(input, reverseSource); },
      async evaluate(input) { reverseEvaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(reverse).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(reverseWriterCalls).toBe(0);
    expect(reverseEvaluatorCalls).toBe(0);

    const compatible = await executeSummaryV3StyleServer({
      ...base,
      operation: 'summary_professional',
      operationId: 'japanese-unannotated-role-compatible',
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        entries: [{
          ...base.manifest.entries[0]!,
          role: 'ソフトウェアエンジニア',
          employer: 'アトラス',
          facts: [{ id: 'japanese-duty', text: 'APIを構築します' }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, sourceForLocale); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(compatible).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it.each([
    { locale: 'de', source: 'Mila ist Softwareentwicklerin bei Atlas. Sie entwickelt APIs.', role: 'Softwareentwicklerin', wrongRole: 'Datenanalystin', employer: 'Atlas', fact: 'Sie entwickelt APIs.' },
    { locale: 'sr', source: 'Mila je softverska inženjerka u Atlasu. Ona izrađuje API-je.', role: 'Softverska inženjerka', wrongRole: 'Analitičarka', employer: 'Atlas', fact: 'Ona izrađuje API-je.' },
    { locale: 'hi', source: 'मीरा एटलस में सॉफ्टवेयर इंजीनियर हैं। वह एपीआई बनाती हैं।', role: 'सॉफ्टवेयर इंजीनियर', wrongRole: 'डेटा विश्लेषक', employer: 'एटलस', fact: 'वह एपीआई बनाती हैं।' },
    { locale: 'ar', source: 'ميرا مهندسة برمجيات في أطلس. تبني واجهات برمجة.', role: 'مهندسة برمجيات', wrongRole: 'محللة بيانات', employer: 'أطلس', fact: 'تبني واجهات برمجة.' },
  ] as const)('rejects an unannotated direct %s role-employer mismatch before provider authority while retaining the exact matching frame', async (fixture) => {
    const base = emptyLocaleRequest(fixture.locale);
    const requestWithRole = (role: string, operationId: string): SummaryV3StyleRequest => ({
      ...base,
      operation: 'summary_professional',
      operationId,
      style: 'professional',
      visibleSummary: fixture.source,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        entries: [{
          ...base.manifest.entries[0]!,
          role,
          employer: fixture.employer,
          facts: [{ id: `${fixture.locale}-direct-frame-duty`, text: fixture.fact }],
        }],
      },
    });
    const matching = await executeSummaryV3StyleServer(requestWithRole(fixture.role, `${fixture.locale}-direct-frame-compatible`), {
      async write(input) { return writerEnvelope(input, fixture.source); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(matching).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });

    let writerCalls = 0;
    let evaluatorCalls = 0;
    const mismatch = await executeSummaryV3StyleServer(requestWithRole(fixture.wrongRole, `${fixture.locale}-direct-frame-mismatch`), {
      async write(input) { writerCalls += 1; return writerEnvelope(input, fixture.source); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(mismatch).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(writerCalls).toBe(0);
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects internally inconsistent source metric/quantity/currency/duration relations and an explicit source-only tool before a permissive safe no-op can pass', async () => {
    const contradictoryMetric = 'Ava Patel is a Product Engineer at Atlas. She improved revenue by 24% over 20 months.';
    const metricResult = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: contradictoryMetric, visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, contradictoryMetric); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(metricResult).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const quantitySource = 'Ava Patel is a Product Engineer at Atlas. She delivered 24 reports over 20 months.';
    const quantityResult = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: quantitySource, visibleSummaryFacts: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          facts: [{ id: 'quantity', text: 'delivered 20 reports over 24 months' }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, quantitySource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(quantityResult).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const currencySource = 'Ava Patel is a Product Engineer at Atlas. She generated $20 revenue over 24 months.';
    const currencyResult = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: currencySource, visibleSummaryFacts: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{ ...requestFor('professional').manifest.entries[0]!, facts: [{ id: 'currency', text: 'saved $20 in costs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, currencySource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(currencyResult).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const mixedDurationSource = 'Current Product Engineer at Atlas for 24 months. Former Analyst at Nova for 12 months.';
    const mixedDurationResult = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: mixedDurationSource, visibleSummaryFacts: undefined, protectedEntities: undefined,
      manifest: {
        manifestId: 'duration-swap-manifest', contextId: 'duration-swap-context', sourceLocale: 'en', currentRoleEntryId: 'current',
        entries: [
          { stableId: 'current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 12, facts: [{ id: 'current-duty', text: 'builds reliable APIs' }] },
          { stableId: 'prior', role: 'Analyst', employer: 'Nova', employmentState: 'completed', durationMonths: 24, facts: [{ id: 'prior-duty', text: 'reviewed reports' }] },
        ],
      },
    }, {
      async write(input) { return writerEnvelope(input, mixedDurationSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(mixedDurationResult).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const sourceOnlyTool = `${source} It uses Rust.`;
    const toolResult = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: sourceOnlyTool,
      visibleSummaryFacts: [{ id: 'source-tool', text: 'Rust', semanticKind: 'tool' }],
    }, {
      async write(input) { return writerEnvelope(input, sourceOnlyTool); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(toolResult).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('fails closed before evaluator authority when explicit protected entities have their clause-local duties and employers reattributed', async () => {
    const relationSource = 'Ava builds APIs at Atlas, while Ben mentors peers at Nova.';
    const relationRequest: SummaryV3StyleRequest = {
      ...requestFor('professional'),
      visibleSummary: relationSource,
      visibleSummaryFacts: undefined,
      protectedEntities: ['Ava', 'Ben'],
      manifest: {
        manifestId: 'relation-manifest', contextId: 'relation-context', sourceLocale: 'en', currentRoleEntryId: 'ava-entry',
        entries: [
          { stableId: 'ava-entry', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'ava-duty', text: 'builds APIs' }] },
          { stableId: 'ben-entry', role: 'Mentor', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'ben-duty', text: 'mentors peers' }] },
        ],
      },
    };
    let evaluatorCalls = 0;
    const swapped = await executeSummaryV3StyleServer(relationRequest, {
      async write(input) { return writerEnvelope(input, 'Ava mentors peers at Nova, while Ben builds APIs at Atlas.'); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(swapped).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
    const unchanged = await executeSummaryV3StyleServer(relationRequest, {
      async write(input) { return writerEnvelope(input, relationSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(unchanged).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('rejects an unannotated named source-only tool and an unbound multi-entry duration before a permissive safe no-op can pass', async () => {
    for (const toolName of ['Rust', 'R']) {
      const sourceOnlyTool = `${source} It uses ${toolName}.`;
      const tool = await executeSummaryV3StyleServer({
        ...requestFor('professional'), visibleSummary: sourceOnlyTool, visibleSummaryFacts: undefined,
      }, {
        async write(input) { return writerEnvelope(input, sourceOnlyTool); },
        async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
      });
      expect(tool).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    }
    const ambiguousDuration = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: 'Ava served for 24 months.', visibleSummaryFacts: undefined, protectedEntities: undefined,
      manifest: {
        manifestId: 'ambiguous-duration', contextId: 'ambiguous-duration', sourceLocale: 'en', currentRoleEntryId: 'entry-a',
        entries: [
          { stableId: 'entry-a', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'a-duty', text: 'served clients' }] },
          { stableId: 'entry-b', role: 'Analyst', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'b-duty', text: 'reviewed reports' }] },
        ],
      },
    }, {
      async write(input) { return writerEnvelope(input, 'Ava served for 24 months.'); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(ambiguousDuration).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it.each([
    { tool: 'C#', id: 'context-csharp' },
    { tool: 'Go', id: 'context-go' },
    { tool: 'AI', id: 'context-ai' },
    { tool: 'R', id: 'context-r' },
  ])('rejects a short context-only $tool surface by exact token/span evidence', async ({ tool, id }) => {
    const candidate = `${candidateByStyle.professional} Uses ${tool}.`;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          facts: [...requestFor('professional').manifest.entries[0]!.facts, { id, text: tool }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('does not treat a longer manifest term as authorization for the distinct short Go source surface', async () => {
    const sourceWithGo = `${source} It uses Go.`;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceWithGo,
      visibleSummaryFacts: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          facts: [...requestFor('professional').manifest.entries[0]!.facts, { id: 'google-analytics', text: 'Google Analytics' }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, sourceWithGo); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it.each([
    { sourceTool: 'R', substitutedSurface: 'reliable APIs' },
    { sourceTool: 'Go', substitutedSurface: 'Google' },
  ])('rejects a supported compact $sourceTool fact when a larger lexical surface only contains its substring', async ({ sourceTool, substitutedSurface }) => {
    const sourceWithTool = `${source} It uses ${sourceTool}.`;
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('stronger'),
      visibleSummary: sourceWithTool,
      visibleSummaryFacts: undefined,
      manifest: {
        ...requestFor('stronger').manifest,
        entries: [{
          ...requestFor('stronger').manifest.entries[0]!,
          facts: [...requestFor('stronger').manifest.entries[0]!.facts, { id: `supported-${sourceTool.toLocaleLowerCase()}`, text: sourceTool }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.stronger} It uses ${substitutedSurface}.`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('permits an explicitly supported achievement to be structurally foregrounded as Stronger without inventing a predicate change', async () => {
    const achievementSource = 'Ava achieved a 20% improvement in delivery.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('stronger'),
      visibleSummary: achievementSource,
      protectedEntities: ['Ava'],
      visibleSummaryFacts: [{ id: 'achievement', text: achievementSource, semanticKind: 'achievement' }],
      manifest: {
        manifestId: 'achievement-manifest', contextId: 'achievement-context', sourceLocale: 'en', currentRoleEntryId: 'achievement-entry',
        entries: [{ stableId: 'achievement-entry', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'achievement', text: achievementSource }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, 'A 20% improvement in delivery was achieved by Ava.'); },
      async evaluate(input) {
        return evaluatorEnvelope(input, {
          evidence: { ...styleEvidence(input), strongerPredicateTransformations: 0, structuralStrengtheningCount: 1 },
        });
      },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'stronger' });
  });

  it('fails a source-floor fact omission before evaluator or repair', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('shorter'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.shorter, input.requiredFacts.slice(0, -1).map((fact) => fact.id)); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('does not trust writer fact labels when the candidate prose omits material source duties and metrics', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) {
        return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas who writes software for 24 months.');
      },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects writer fact labels that are assigned to a different candidate unit than their represented prose', async () => {
    let evaluatorCalls = 0;
    const firstUnit = 'Ava Patel is a Product Engineer at Atlas.';
    const secondUnit = 'She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) {
        const firstUnitFactIds = input.requiredFacts
          .filter((fact) => [firstUnit, 'Ava Patel', 'Product Engineer', 'Atlas'].includes(fact.text))
          .map((fact) => fact.id);
        const secondUnitFactIds = input.requiredFacts
          .filter((fact) => !firstUnitFactIds.includes(fact.id))
          .map((fact) => fact.id);
        const response = writerEnvelope(input, firstUnit);
        response.input.units = [
          { unitId: 'first-unit', text: firstUnit, factIds: secondUnitFactIds },
          { unitId: 'second-unit', text: secondUnit, factIds: firstUnitFactIds },
        ];
        return response;
      },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('keeps the automatic source-unit floor strict when optional page annotations are absent', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({ ...requestFor('shorter'), visibleSummaryFacts: undefined }, {
      async write(input) {
        return writerEnvelope(input, 'Ava Patel, Product Engineer at Atlas, builds reliable APIs and improved delivery by 20% over 24 months.');
      },
      async evaluate(input) {
        evaluatorCalls += 1;
        const missing = input.requiredFacts[input.requiredFacts.length - 1]!;
        const phases = passingPhases();
        phases.semantic_grounding = {
          status: 'failed',
          violations: [{ code: 'missing_fact', factIdHashes: [missing.hash], unitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash), repairable: false }],
        };
        return evaluatorEnvelope(input, {
          representedFactIdHashes: input.requiredFacts.filter((fact) => fact.hash !== missing.hash).map((fact) => fact.hash),
          missingFactIdHashes: [missing.hash],
          phases,
        });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true } });
    expect(evaluatorCalls).toBe(1);
  });

  it('rejects loss of every automatic visible anchor even when writer fact labels claim complete coverage', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: 'Ava is a Product Engineer at Atlas for 24 months. She builds APIs in Java.',
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Ava is a Product Engineer at Atlas for 24 months. She builds APIs.');
      },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('preserves a compact visible proper name without depending on optional page entity annotations', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: 'Li is a Product Engineer at Atlas. Li builds reliable APIs.',
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, 'A Product Engineer at Atlas builds reliable APIs.'); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    ['a leading subject', 'Li is a Product Engineer at Atlas. Li builds reliable APIs for 24 months.', 'Li Wei is a Product Engineer at Atlas. Li builds reliable APIs for 24 months.'],
    ['a leading subject with an inserted cased prefix', 'Li is a Product Engineer at Atlas. Li builds reliable APIs for 24 months.', 'Wei Li is a Product Engineer at Atlas. Li builds reliable APIs for 24 months.'],
    ['a leading subject with lowercase name connectors', 'Li is a Product Engineer at Atlas. Li builds reliable APIs for 24 months.', 'Li van der Meer is a Product Engineer at Atlas. Li builds reliable APIs for 24 months.'],
    ['a self-introduction', 'I am Li, a Product Engineer at Atlas. I build reliable APIs for 24 months.', 'I am Li Wei, a Product Engineer at Atlas. I build reliable APIs for 24 months.'],
  ])('preserves an unannotated compact cased identity in %s rather than allowing name expansion', async (_frame, sourceForIdentity, candidate) => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'compact-cased-identity', contextId: 'compact-cased-identity', sourceLocale: 'en', currentRoleEntryId: 'compact-cased-entry',
        entries: [{ stableId: 'compact-cased-entry', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'build reliable APIs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('keeps a title-cased role after an unannotated compact self-introduction eligible for a safe no-op', async () => {
    const sourceForIdentity = 'I am Li, Product Engineer at Atlas. I build reliable APIs for 24 months.';
    const request = {
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'compact-cased-title-role', contextId: 'compact-cased-title-role', sourceLocale: 'en', currentRoleEntryId: 'compact-cased-title-role',
        entries: [{ stableId: 'compact-cased-title-role', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present' as const, durationMonths: 24, facts: [{ id: 'duty', text: 'build reliable APIs' }] }],
      },
    };
    const result = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, sourceForIdentity); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('rejects a comma-delimited compact self-introduction name insertion while allowing the source role suffix', async () => {
    const sourceForIdentity = 'I am Li, Product Engineer at Atlas. I build reliable APIs for 24 months.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'compact-cased-comma-name', contextId: 'compact-cased-comma-name', sourceLocale: 'en', currentRoleEntryId: 'compact-cased-comma-name',
        entries: [{ stableId: 'compact-cased-comma-name', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'build reliable APIs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, 'I am Li, Wei, Product Engineer at Atlas. I build reliable APIs for 24 months.'); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    ['inserts a second cased token', 'Li Wei builds reliable APIs at Atlas for 24 months.'],
    ['inserts a parenthetical cased token', 'Li (Wei) builds reliable APIs at Atlas for 24 months.'],
    ['reorders the compact cased subject', 'Wei Li builds reliable APIs at Atlas for 24 months.'],
    ['changes the compact cased subject case', 'li builds reliable APIs at Atlas for 24 months.'],
  ])('rejects an unannotated compact cased action-frame identity when a candidate %s', async (_caseName, candidate) => {
    const sourceForIdentity = 'Li builds reliable APIs at Atlas for 24 months.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'compact-cased-action', contextId: 'compact-cased-action', sourceLocale: 'en', currentRoleEntryId: 'compact-cased-action',
        entries: [{ stableId: 'compact-cased-action', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'builds reliable APIs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('preserves an unannotated compact cased identity after a lowercase discourse prefix before evaluator authority', async () => {
    const sourceForIdentity = 'currently Li builds reliable APIs as Product Engineer at Atlas.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'compact-cased-discourse-name', contextId: 'compact-cased-discourse-name', sourceLocale: 'en', currentRoleEntryId: 'compact-cased-discourse-entry',
        entries: [{ stableId: 'compact-cased-discourse-entry', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'builds reliable APIs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, 'currently Li Wei builds reliable APIs as Product Engineer at Atlas with clarity and precision.'); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('keeps an unchanged unannotated compact cased action-frame identity eligible for a safe no-op', async () => {
    const sourceForIdentity = 'Li builds reliable APIs at Atlas for 24 months.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'compact-cased-action-safe-noop', contextId: 'compact-cased-action-safe-noop', sourceLocale: 'en', currentRoleEntryId: 'compact-cased-action-safe-noop',
        entries: [{ stableId: 'compact-cased-action-safe-noop', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'builds reliable APIs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, sourceForIdentity); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('preserves an explicitly protected entity with exact capitalization', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional.replace('Ava Patel', 'ava Patel')); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    ['parenthetical', 'Product Engineer (II) at'],
    ['comma-delimited', 'Product Engineer, II at'],
    ['bracketed', 'Product Engineer [II] at'],
    ['comma-appositional', 'Product Engineer, Architect at'],
    ['slash-appositional', 'Product Engineer/Architect at'],
  ])('rejects an unsupported %s role extension before evaluator authority', async (_shape, replacement) => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional.replace('Product Engineer at', replacement)); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('accepts a valid cased role surface when the source phrase ends at sentence punctuation', async () => {
    const sourceForIdentity = 'Atlas employs Li as Product Engineer. Li builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const candidate = 'Atlas employs Li as Product Engineer, who builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: ['Li'],
    }, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'professional' });
  });

  it.each([
    ['inserts a new cased token inside the source identity', candidateByStyle.professional.replace('Ava Patel', 'Ava Priya Patel')],
    ['reorders the source identity', candidateByStyle.professional.replace('Ava Patel', 'Patel Ava')],
    ['changes the source identity casing', candidateByStyle.professional.replace('Ava Patel', 'ava Patel')],
  ])('preserves an unannotated leading cased source identity and rejects a candidate that %s', async (_caseName, candidate) => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    ['inserts a cased token into a non-leading source identity', 'I am Ava Priya Patel, a Product Engineer at Atlas. I build reliable APIs for 24 months.'],
    ['reorders a non-leading source identity', 'I am Patel Ava, a Product Engineer at Atlas. I build reliable APIs for 24 months.'],
    ['changes the case of a non-leading source identity', 'I am ava Patel, a Product Engineer at Atlas. I build reliable APIs for 24 months.'],
  ])('preserves an unannotated non-leading cased source identity and rejects a candidate that %s', async (_caseName, candidate) => {
    const sourceForIdentity = 'I am Ava Patel, a Product Engineer at Atlas. I build reliable APIs for 24 months.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'non-leading-cased-name', contextId: 'non-leading-cased-name', sourceLocale: 'en', currentRoleEntryId: 'non-leading-cased-entry',
        entries: [{ stableId: 'non-leading-cased-entry', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'build reliable APIs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each(['R', 'Go'] as const)('preserves the exact case of an unannotated compact %s tool surface', async (tool) => {
    let evaluatorCalls = 0;
    const sourceWithTool = `${source} It uses ${tool}.`;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceWithTool,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          facts: [...requestFor('professional').manifest.entries[0]!.facts, { id: `tool-${tool}`, text: tool }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional} It uses ${tool.toLocaleLowerCase()}.`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects an unannotated source-only Python-to-Java tool substitution before evaluator authority', async () => {
    let evaluatorCalls = 0;
    const sourceWithTool = `${source} It uses Python.`;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('stronger'),
      visibleSummary: sourceWithTool,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...requestFor('stronger').manifest,
        entries: [{
          ...requestFor('stronger').manifest.entries[0]!,
          facts: [...requestFor('stronger').manifest.entries[0]!.facts, { id: 'python', text: 'Python' }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.stronger} It uses Java.`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    ['extends a compact tool', 'R', 'R Studio'],
    ['extends a compact language tool', 'Go', 'Go Lang'],
    ['extends a dotted tool', 'Node.js', 'Node.js Advanced'],
    ['adds a second compact tool', 'R', 'R and Python'],
  ] as const)('rejects a candidate that %s before evaluator authority', async (_caseName, sourceTool, candidateTool) => {
    let evaluatorCalls = 0;
    const sourceWithTool = `${source} It uses ${sourceTool} for analysis.`;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceWithTool,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          facts: [...requestFor('professional').manifest.entries[0]!.facts, { id: `tool-${sourceTool}`, text: sourceTool }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional} It uses ${candidateTool} for analysis.`); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(evaluatorCalls).toBe(1);
  });

  it('rejects a new technical span outside a named-tool relation before evaluator authority', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional} C# supports delivery.`); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(evaluatorCalls).toBe(1);
  });

  it('does not mistake a preserved source employer in a with-relation for a new named tool', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional.replace('at Atlas', 'with Atlas')); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'professional' });
  });

  it('does not authorize a new using-relation merely because its token appears inside a source employer', async () => {
    const sourceWithCollision = 'Ava Patel is a Product Engineer with Rust Labs. She builds reliable APIs for 24 months.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: sourceWithCollision,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'tool-employer-collision', contextId: 'tool-employer-collision', sourceLocale: 'en', currentRoleEntryId: 'tool-employer-collision',
        entries: [{ stableId: 'tool-employer-collision', role: 'Product Engineer', employer: 'Rust Labs', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'builds reliable APIs' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, 'Ava Patel is a Product Engineer with Rust Labs. She builds reliable APIs using Rust for 24 months.'); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(evaluatorCalls).toBe(1);
  });

  it('does not authorize using a preserved compact employer as a tool without source use evidence', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional} She builds reliable APIs using Atlas.`); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(evaluatorCalls).toBe(1);
  });

  it('rejects a metric relation swap even when both numeric tokens individually exist in the source', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) {
        return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas who builds reliable APIs, mentors peers, and improved delivery by 24% over 20 months.');
      },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
  });

  it('rejects candidate metric/currency relation additions that reuse a source numeral before evaluator authority', async () => {
    const calls = { currency: 0, percent: 0, quantity: 0, savings: 0 };
    const currency = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional} She generated $20 revenue.`); },
      async evaluate(input) { calls.currency += 1; return evaluatorEnvelope(input); },
    });
    expect(currency).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const percent = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional} She generated revenue by 20%.`); },
      async evaluate(input) { calls.percent += 1; return evaluatorEnvelope(input); },
    });
    expect(percent).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const quantity = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional} She served 24 clients.`); },
      async evaluate(input) { calls.quantity += 1; return evaluatorEnvelope(input); },
    });
    expect(quantity).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const currencySource = 'Ava Patel is a Product Engineer at Atlas. She generated $20 revenue over 24 months.';
    const savings = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      visibleSummary: currencySource,
      visibleSummaryFacts: undefined,
      manifest: {
        ...requestFor('professional').manifest,
        entries: [{
          ...requestFor('professional').manifest.entries[0]!,
          facts: [...requestFor('professional').manifest.entries[0]!.facts, { id: 'revenue', text: 'generated $20 revenue' }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, `${currencySource} She generated $20 savings.`); },
      async evaluate(input) { calls.savings += 1; return evaluatorEnvelope(input); },
    });
    expect(savings).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(calls).toEqual({ currency: 1, percent: 1, quantity: 1, savings: 1 });
  });

  it('permits only the explicitly marked Stronger predicate replacement inside a supported metric relation', async () => {
    const metricSource = 'Ava Patel is a Product Engineer at Atlas. Ava Patel improved delivery by 20% over 24 months.';
    const markedRequest = {
      ...requestFor('stronger'),
      visibleSummary: metricSource,
      protectedEntities: ['Ava Patel'],
      visibleSummaryFacts: [{
        id: 'marked-metric-duty', text: 'Ava Patel improved delivery by 20%', semanticKind: 'duty' as const,
        transformableDuty: { sourcePredicate: 'improved', predicateAnchor: 'improved' },
      }],
      manifest: {
        manifestId: 'marked-metric-predicate', contextId: 'marked-metric-predicate', sourceLocale: 'en', currentRoleEntryId: 'marked-metric-predicate',
        entries: [{ stableId: 'marked-metric-predicate', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present' as const, durationMonths: 24, facts: [{ id: 'metric-duty', text: 'Ava Patel improved delivery by 20%' }] }],
      },
    };
    const candidate = 'Ava Patel is a Product Engineer at Atlas. Ava Patel accelerated delivery by 20% over 24 months.';
    const marked = await executeSummaryV3StyleServer(markedRequest, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(marked).toMatchObject({ kind: 'candidate_ready', style: 'stronger' });
    let evaluatorCalls = 0;
    const unmarked = await executeSummaryV3StyleServer({ ...markedRequest, visibleSummaryFacts: undefined }, {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(unmarked).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects a mixed current/prior employment-state swap even when the evaluator reports a pass', async () => {
    const mixedSource = 'Current Product Engineer at Atlas for 24 months. Former Analyst at Nova for 12 months.';
    const base = requestFor('professional');
    const result = await executeSummaryV3StyleServer({
      ...base,
      visibleSummary: mixedSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        entries: [
          { stableId: 'entry-current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'current-duty', text: 'builds reliable APIs' }] },
          { stableId: 'entry-prior', role: 'Analyst', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'prior-duty', text: 'reviewed reports' }] },
        ],
      },
    }, {
      async write(input) { return writerEnvelope(input, 'Former Product Engineer at Atlas for 24 months. Current Analyst at Nova for 12 months.'); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('allows a correctly bound mixed current/prior source to remain a safe no-op', async () => {
    const mixedSource = 'Current Product Engineer at Atlas for 24 months. Former Analyst at Nova for 12 months.';
    const base = requestFor('professional');
    const result = await executeSummaryV3StyleServer({
      ...base,
      visibleSummary: mixedSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        entries: [
          { stableId: 'entry-current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'current-duty', text: 'builds reliable APIs' }] },
          { stableId: 'entry-prior', role: 'Analyst', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'prior-duty', text: 'reviewed reports' }] },
        ],
      },
    }, {
      async write(input) { return writerEnvelope(input, mixedSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('rejects an unannotated same-sentence multi-person duty swap before evaluator authority', async () => {
    const relationSource = 'Ava Patel builds reliable APIs as a Product Engineer at Atlas and Ben Jones mentors peers as an Analyst at Nova for 24 months.';
    const swappedCandidate = 'Ava Patel mentors peers as an Analyst at Nova and Ben Jones builds reliable APIs as a Product Engineer at Atlas for 24 months.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      operationId: 'automatic-same-sentence-relation-swap',
      visibleSummary: relationSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, swappedCandidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('keeps an ordinary same-person conjunction eligible for a safe no-op', async () => {
    const samePersonSource = 'Ava Patel builds reliable APIs and mentors peers as a Product Engineer at Atlas for 24 months.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      operationId: 'same-person-conjunction-safe-noop',
      visibleSummary: samePersonSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, samePersonSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('does not accept context-only fact IDs in a non-empty source', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.stronger, [...input.requiredFacts.map((fact) => fact.id), 'context-only-tool']); },
      async evaluate() { return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
  });

  it('rejects context-ceiling prose injection and retains a valid Stronger source', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.stronger} Kubernetes`); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({
      kind: 'safe_no_op',
      typedReason: 'safe_no_op',
      evidence: {
        unsupportedClaimCategory: 'manifest_ceiling_mismatch',
        safeNoOpConsidered: true,
        safeNoOpSelected: true,
        meaningfulChangeDetected: false,
        noOpDetected: true,
      },
    });
    expect(result).not.toHaveProperty('candidate');
  });

  it('rejects a nonnumeric invented revenue relation and retains the valid Stronger source before evaluator authority', async () => {
    const sourceWithoutResult = 'Ava Patel is a Product Engineer at Atlas. She builds APIs for customers.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('stronger'),
      operationId: 'stronger-invented-revenue-relation',
      visibleSummary: sourceWithoutResult,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She creates revenue from APIs for customers.');
      },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({
      kind: 'safe_no_op', typedReason: 'safe_no_op',
      evidence: { unsupportedClaimCategory: 'unsupported_result_relation', evaluatorReached: false, safeNoOpSelected: true },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(evaluatorCalls).toBe(0);
  });

  it('permits one grounded Stronger predicate replacement when the source-attested customer surface remains exact', async () => {
    const sourceWithoutResult = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs for customers.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('stronger'),
      operationId: 'stronger-grounded-customer-predicate',
      visibleSummary: sourceWithoutResult,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She engineers reliable APIs for customers.');
      },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'stronger' });
  });

  it('fails free-text/malformed writer transport closed without evaluator fallback', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write() { return { toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, contentBlockCount: 1, textBlockCount: 1, toolBlockCount: 0, input: {} }; },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_transport_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    ['wrong forced tool', 'writer_transport_malformed', (response: Record<string, unknown>) => ({ ...response, toolName: 'wrong_tool' })],
    ['wrong content block count', 'writer_transport_malformed', (response: Record<string, unknown>) => ({ ...response, contentBlockCount: 2 })],
    ['wrong text block count', 'writer_transport_malformed', (response: Record<string, unknown>) => ({ ...response, textBlockCount: 1 })],
    ['wrong tool block count', 'writer_transport_malformed', (response: Record<string, unknown>) => ({ ...response, toolBlockCount: 2 })],
    ['unknown envelope field', 'writer_transport_malformed', (response: Record<string, unknown>) => ({ ...response, prose: 'forbidden' })],
    ['unknown payload field', 'writer_transport_malformed', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), extra: true } })],
    ['operation identity drift', 'writer_identity_mismatch', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), operationId: 'server-wrong-001' } })],
    ['snapshot identity drift', 'writer_identity_mismatch', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), snapshotHash: 'm5_wrong' } })],
    ['style identity drift', 'writer_identity_mismatch', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), style: 'stronger' } })],
    ['locale identity drift', 'writer_identity_mismatch', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), locale: 'de' } })],
    ['manifest identity drift', 'writer_identity_mismatch', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), manifestHash: 'm5_wrong' } })],
    ['unknown candidate-unit field', 'candidate_malformed', (response: Record<string, unknown>) => {
      const input = response.input as Record<string, unknown>;
      const units = input.units as Array<Record<string, unknown>>;
      return { ...response, input: { ...input, units: [{ ...units[0], extra: true }] } };
    }],
  ] as const)('fails writer %s closed before evaluator authority', async (_name, typedReason, mutate) => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return mutate(writerEnvelope(input, candidateByStyle.professional) as unknown as Record<string, unknown>); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects fenced writer prose as a candidate transport boundary failure before evaluator authority', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `\`\`\`${candidateByStyle.professional}\`\`\``); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects inline Markdown candidate prose before evaluator authority is consulted', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `**${candidateByStyle.professional}**`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    `${candidateByStyle.professional} <!DOCTYPE html>`,
    `${candidateByStyle.professional} <!-- audit -->`,
    `${candidateByStyle.professional} Note: this version improves clarity.`,
    `${candidateByStyle.professional} “Note: this version improves clarity.”`,
    `Response: ${candidateByStyle.professional}`,
    `Here is the revised summary: ${candidateByStyle.professional}`,
    `“Here is the revised summary: ${candidateByStyle.professional}”`,
    `Updated summary: ${candidateByStyle.professional}`,
    `Career Profile\n${candidateByStyle.professional}`,
    `Professional Bio\n${candidateByStyle.professional}`,
    `Revised CV Summary:\n${candidateByStyle.professional}`,
    `A summary of qualifications\n${candidateByStyle.professional}`,
    `Career at a glance\n${candidateByStyle.professional}`,
   `A record of impact\n${candidateByStyle.professional}`,
    `Core Competencies\n${candidateByStyle.professional}`,
   `Key Contributions\n${candidateByStyle.professional}`,
    `key skills\n${candidateByStyle.professional}`,
    `major achievements\n${candidateByStyle.professional}`,
    `relevant experience\n${candidateByStyle.professional}`,
    `personal statement\n${candidateByStyle.professional}`,
    `professional strengths\n${candidateByStyle.professional}`,
   `${candidateByStyle.professional} {audit: "pass"}`,
    `${candidateByStyle.professional} (Note: rewritten for clarity).`,
  ])('rejects non-prose markup and explanatory writer wrappers before evaluator authority: %s', async (candidate) => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    ['ja', '主な成果', emptyLocaleFixtures.ja.candidate],
    ['ar', 'المهارات الأساسية', emptyLocaleFixtures.ar.candidate],
    ['hi', 'मुख्य कौशल', emptyLocaleFixtures.hi.candidate],
  ] as const)('rejects non-cased %s plain-text headings before evaluator authority', async (locale, heading, prose) => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(emptyLocaleRequest(locale), {
      async write(input) { return writerEnvelope(input, heading + '\n' + prose); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects a plain-text Summary heading before evaluator authority is consulted', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `Professional Summary: ${candidateByStyle.professional}`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects clause-delimited reserved transport metadata before evaluator authority is consulted', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional}; Operation ID: audit-001`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects non-colon reserved transport metadata before evaluator authority is consulted', async () => {
    const cases = [
      `${candidateByStyle.professional}; Operation ID — audit-001`,
      `${candidateByStyle.professional} — Operation ID — audit-001`,
      `${candidateByStyle.professional}; Validation passed.`,
      `${candidateByStyle.professional} {"operationId":"audit-001"}`,
      `${candidateByStyle.professional} (Operation ID: audit-001).`,
      `${candidateByStyle.professional} [Operation ID = audit-001].`,
      `${candidateByStyle.professional} (candidateHash: m5_test).`,
      `${candidateByStyle.professional} “Operation ID: audit-001”.`,
      `${candidateByStyle.professional} / Operation ID: audit-001`,
      `${candidateByStyle.professional} Operation ID, audit-001`,
      `${candidateByStyle.professional} operationId/audit-001`,
      `${candidateByStyle.professional} ({"operationId":"audit-001"}).`,
      `${candidateByStyle.professional} [{"candidateHash":"m5_test"}].`,
    ];
    for (const candidate of cases) {
      let evaluatorCalls = 0;
      const result = await executeSummaryV3StyleServer(requestFor('professional'), {
        async write(input) { return writerEnvelope(input, candidate); },
        async evaluate() { evaluatorCalls += 1; return {}; },
      });
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
      expect(evaluatorCalls).toBe(0);
    }
  });

  it('rejects line-delimited reserved transport metadata before evaluator authority is consulted', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.professional}\nOperation ID: audit-001`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'candidate_malformed' });
    expect(evaluatorCalls).toBe(0);
  });

  it('fails initial writer identity drift without another evaluator or fallback', async () => {
    let evaluatorCalls = 0;
    const initial = await executeSummaryV3StyleServer(requestFor('shorter'), {
      async write(input) {
        const response = writerEnvelope(input, candidateByStyle.shorter);
        response.input.snapshotHash = 'm5_wrong';
        return response;
      },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(initial).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_identity_mismatch' });
    expect(evaluatorCalls).toBe(0);
  });

  it('maps repair writer identity drift to repair_identity_mismatch without a repair evaluator', async () => {
    const calls = { repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }],
        };
        return evaluatorEnvelope(input, {
          phases,
          evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 },
        });
      },
      async repairWrite(input) {
        calls.repairWriter += 1;
        const response = writerEnvelope(input, candidateByStyle.stronger);
        response.input.snapshotHash = 'm5_wrong';
        return response;
      },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_identity_mismatch' });
    expect(calls).toEqual({ repairWriter: 1, repairEvaluator: 0 });
  });

  it('never repairs a rejected safe-no-op claim even when the violation is otherwise repairable', async () => {
    const calls = { repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{ code: 'style_not_fulfilled', factIdHashes: [input.requiredFacts[0]!.hash], unitHashes: [], repairable: true }],
        };
        return evaluatorEnvelope(input, {
          phases,
          evidence: { ...styleEvidence(input, true), professionalFulfilled: false },
        });
      },
      async repairWrite() { calls.repairWriter += 1; return {}; },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    expect(calls).toEqual({ repairWriter: 0, repairEvaluator: 0 });
  });

  it('rejects an impossible safe-no-op signal for an empty generate-from-context request', async () => {
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'), visibleSummary: '', visibleSummaryFacts: undefined, protectedEntities: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Product Engineer at Atlas builds reliable APIs, mentors peers, improved delivery by 20%, uses Kubernetes, and has 24 months of experience.');
      },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled', mode: 'generate_from_context' });
  });

  it('requires all four non-writing evaluator phases and rejects replacement prose fields', async () => {
    const missingPhase = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) {
        const response = evaluatorEnvelope(input);
        delete (response.input.phases as Record<string, unknown>).style_fulfillment;
        return response;
      },
    });
    expect(missingPhase).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    const proseAttempt = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) { return { ...evaluatorEnvelope(input), input: { ...evaluatorEnvelope(input).input, replacementSummary: 'forbidden' } }; },
    });
    expect(proseAttempt).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
  });

  it('binds evaluator evidence to the exact candidate hash and ordered candidate-unit hashes', async () => {
    const candidateHashReplay = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) { return evaluatorEnvelope(input, { candidateHash: 'm5_replayed' }); },
    });
    expect(candidateHashReplay).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    const unitHashReplay = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) { return evaluatorEnvelope(input, { candidateUnitHashes: ['m5_replayed'] }); },
    });
    expect(unitHashReplay).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
  });

  it('rejects generic evaluator success and evaluator apply/usage authority fields', async () => {
    for (const mutate of [
      (_input: Record<string, unknown>) => ({ success: true }),
      (input: Record<string, unknown>) => ({ ...input, applyAuthorized: true }),
      (input: Record<string, unknown>) => ({ ...input, usageAuthorized: true }),
    ]) {
      const result = await executeSummaryV3StyleServer(requestFor('professional'), {
        async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
        async evaluate(input) {
          const response = evaluatorEnvelope(input);
          return { ...response, input: mutate(response.input as Record<string, unknown>) };
        },
      });
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    }
  });

  it.each([
    ['wrong forced tool', (response: Record<string, unknown>) => ({ ...response, toolName: 'wrong_tool' })],
    ['wrong content block count', (response: Record<string, unknown>) => ({ ...response, contentBlockCount: 2 })],
    ['wrong text block count', (response: Record<string, unknown>) => ({ ...response, textBlockCount: 1 })],
    ['wrong tool block count', (response: Record<string, unknown>) => ({ ...response, toolBlockCount: 2 })],
    ['operation identity drift', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), operationId: 'server-wrong-001' } })],
    ['snapshot identity drift', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), snapshotHash: 'm5_wrong' } })],
    ['style identity drift', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), style: 'stronger' } })],
    ['locale identity drift', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), locale: 'de' } })],
    ['manifest identity drift', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), manifestHash: 'm5_wrong' } })],
    ['nested style evidence field', (response: Record<string, unknown>) => {
      const input = response.input as Record<string, unknown>;
      return { ...response, input: { ...input, styleEvidence: { ...(input.styleEvidence as Record<string, unknown>), extra: true } } };
    }],
    ['unknown violation code', (response: Record<string, unknown>) => {
      const input = response.input as Record<string, unknown>;
      const phases = input.phases as Record<string, Record<string, unknown>>;
      return { ...response, input: { ...input, phases: { ...phases, style_fulfillment: { status: 'failed', violations: [{ code: 'invented_code', factIdHashes: ['m5_unknown'], unitHashes: [], repairable: false }] } } } };
    }],
    ['foreign fact hash', (response: Record<string, unknown>) => ({ ...response, input: { ...(response.input as Record<string, unknown>), representedFactIdHashes: ['m5_foreign'] } })],
  ] as const)('fails evaluator %s as a strict non-writing transport boundary', async (_name, mutate) => {
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) { return mutate(evaluatorEnvelope(input) as unknown as Record<string, unknown>); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
  });

  it('exposes only closed per-style evaluator evidence branches to the injected evaluator', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) {
        expect(input.forcedTool.schema).toEqual(SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL);
        const evidenceSchema = input.forcedTool.schema.input_schema.properties.styleEvidence;
        expect(evidenceSchema).toMatchObject({ oneOf: expect.any(Array) });
        expect(evidenceSchema.oneOf.every((branch) => branch.additionalProperties === false)).toBe(true);
        return evaluatorEnvelope(input);
      },
    });
    expect(result.kind).toBe('candidate_ready');
  });

  it('requires finite, anchored evaluator violations and complete semantic fact coverage for a claimed pass', async () => {
    const unanchoredViolation = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = { status: 'failed', violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [], repairable: true }] };
        return evaluatorEnvelope(input, { phases, evidence: { ...styleEvidence(input), professionalFulfilled: false, professionalFramingOperations: 0, cohesionClarityOperations: 0 } });
      },
    });
    expect(unanchoredViolation).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    const incompleteCoverage = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) { return evaluatorEnvelope(input, { representedFactIdHashes: input.requiredFacts.slice(0, -1).map((fact) => fact.hash) }); },
    });
    expect(incompleteCoverage).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
  });

  it('uses an evaluator semantic fact partition for final coverage evidence rather than writer labels', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) {
        const phases = passingPhases();
        const missing = input.requiredFacts[input.requiredFacts.length - 1]!;
        phases.semantic_grounding = {
          status: 'failed',
          violations: [{ code: 'missing_fact', factIdHashes: [missing.hash], unitHashes: [], repairable: false }],
        };
        return evaluatorEnvelope(input, {
          phases,
          representedFactIdHashes: input.requiredFacts.slice(0, -1).map((fact) => fact.hash),
          missingFactIdHashes: [missing.hash],
        });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    if (result.kind === 'handled_failure') {
      expect(result.evidence.coveredFactCount).toBe(result.evidence.requiredFactCount - 1);
      expect(result.evidence.missingFactCount).toBe(1);
    }
  });

  it('retains bounded complete evidence rather than silently replacing a maximum evaluator record', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: Array.from({ length: 32 }, () => ({
            code: 'style_not_fulfilled', factIdHashes: [input.requiredFacts[0]!.hash], unitHashes: [], repairable: false,
          })),
        };
        return evaluatorEnvelope(input, {
          phases,
          evidence: { ...styleEvidence(input), professionalFulfilled: false, professionalFramingOperations: 0, cohesionClarityOperations: 0 },
        });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    if (result.kind === 'handled_failure') {
      expect(JSON.stringify(result.evidence).length).toBeLessThanOrEqual(8_192);
      expect(result.evidence).toMatchObject({ evaluatorAttempts: 1, candidateHash: expect.any(String), phaseStatuses: { style_fulfillment: 'failed' } });
    }
  });

  it('allows exactly one finite repair and fully revalidates it', async () => {
    const calls = { writer: 0, evaluator: 0, repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { calls.writer += 1; return writerEnvelope(input, source); },
      async evaluate(input) {
        calls.evaluator += 1;
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }],
        };
        return evaluatorEnvelope(input, { phases, evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 } });
      },
      async repairWrite(input) { calls.repairWriter += 1; return writerEnvelope(input, candidateByStyle.stronger); },
      async repairEvaluate(input) { calls.repairEvaluator += 1; return evaluatorEnvelope(input); },
    });
    expect(result.kind).toBe('candidate_ready');
    expect(calls).toEqual({ writer: 1, evaluator: 1, repairWriter: 1, repairEvaluator: 1 });
    if (result.kind === 'candidate_ready') expect(result.evidence).toMatchObject({ repairWriterAttempts: 1, repairEvaluatorAttempts: 1 });
  });

  it('rejects a repair that rewrites an unaffected unit outside the evaluator’s finite unit scope', async () => {
    const calls = { repairEvaluator: 0 };
    const firstUnit = 'Ava Patel is a Product Engineer at Atlas.';
    const secondUnit = 'She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const splitFactIds = (input: Pick<SummaryV3StyleWriterInput, 'requiredFacts'>) => {
      const firstFactIds = input.requiredFacts
        .filter((fact) => [firstUnit, 'Ava Patel', 'Product Engineer', 'Atlas'].includes(fact.text))
        .map((fact) => fact.id);
      return { firstFactIds, secondFactIds: input.requiredFacts.filter((fact) => !firstFactIds.includes(fact.id)).map((fact) => fact.id) };
    };
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) {
        const { firstFactIds, secondFactIds } = splitFactIds(input);
        return writerEnvelopeWithUnits(input, [
          { unitId: 'candidate-1', text: firstUnit, factIds: firstFactIds },
          { unitId: 'candidate-2', text: secondUnit, factIds: secondFactIds },
        ]);
      },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{
            code: 'style_not_fulfilled', factIdHashes: [],
            unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[1]!)], repairable: true,
          }],
        };
        return evaluatorEnvelope(input, {
          phases,
          evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 },
        });
      },
      async repairWrite(input) {
        const { firstFactIds, secondFactIds } = splitFactIds(input);
        return writerEnvelopeWithUnits(input, [
          // A generic rewrite of this non-violating unit must not reach the
          // repair evaluator, even though its source-floor facts still exist.
          { unitId: 'candidate-1', text: 'Ava Patel is a Principal Product Engineer at Atlas.', factIds: firstFactIds },
          { unitId: 'candidate-2', text: secondUnit, factIds: secondFactIds },
        ]);
      },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_scope_violation' });
    expect(calls).toEqual({ repairEvaluator: 0 });
  });

  it('rejects a generic rewrite of a one-unit multi-fact candidate when evidence names only one fact', async () => {
    const calls = { repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      // The regular one-unit envelope intentionally attributes every source
      // floor fact to one valid candidate unit.
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{
            code: 'style_not_fulfilled', factIdHashes: [input.requiredFacts[0]!.hash], unitHashes: [], repairable: true,
          }],
        };
        return evaluatorEnvelope(input, {
          phases,
          evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 },
        });
      },
      // The candidate retains labels but rewrites every unrelated fact too;
      // a fact-only violation cannot authorize that whole-unit change.
      async repairWrite(input) { return writerEnvelope(input, candidateByStyle.stronger); },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_scope_violation' });
    expect(calls).toEqual({ repairEvaluator: 0 });
  });

  it('requires one byte-level prose correction inside the finite repair scope before a repair evaluator can run', async () => {
    const calls = { repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{
            code: 'style_not_fulfilled', factIdHashes: [],
            unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true,
          }],
        };
        return evaluatorEnvelope(input, {
          phases,
          evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 },
        });
      },
      async repairWrite(input) { return writerEnvelope(input, source); },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_scope_violation' });
    expect(calls).toEqual({ repairEvaluator: 0 });
  });

  it('binds the one repair to the original immutable candidate, exact finite violations, and its original style', async () => {
    let repairInput: SummaryV3StyleRepairWriterInput | undefined;
    let repairEvaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }],
        };
        return evaluatorEnvelope(input, { phases, evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 } });
      },
      async repairWrite(input) {
        repairInput = input;
        const response = writerEnvelope(input, candidateByStyle.stronger);
        response.input.style = 'professional';
        return response;
      },
      async repairEvaluate() { repairEvaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_identity_mismatch' });
    expect(repairEvaluatorCalls).toBe(0);
    expect(repairInput).toMatchObject({ repairOnly: true, style: 'stronger', originalCandidate: { text: source } });
    expect(repairInput).toBeDefined();
    if (!repairInput) throw new Error('repair input was not captured');
    expect(repairInput.violations).toEqual([{
      code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(repairInput.originalCandidate.units[0]!)], repairable: true,
    }]);
    expect(Object.isFrozen(repairInput)).toBe(true);
    expect(Object.isFrozen(repairInput?.originalCandidate)).toBe(true);
    expect(Object.isFrozen(repairInput?.violations)).toBe(true);
  });

  it('never repairs unsupported claims and retains the valid source as the sole safe terminal', async () => {
    const calls = { repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.stronger); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.semantic_grounding = {
          status: 'failed',
          violations: [{ code: 'unsupported_claim', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: false }],
        };
        return evaluatorEnvelope(input, { phases });
      },
      async repairWrite() { calls.repairWriter += 1; return {}; },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({
      kind: 'safe_no_op', typedReason: 'safe_no_op',
      evidence: { unsupportedClaimCategory: 'other_typed_category', safeNoOpSelected: true },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ repairWriter: 0, repairEvaluator: 0 });
  });

  it('blocks repair and retains source when a local unsupported-authority guard contradicts repairable evaluator feedback', async () => {
    const calls = { repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) {
        return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She manages reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
      },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{ code: 'style_not_fulfilled', factIdHashes: [input.requiredFacts[0]!.hash], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }],
        };
        return evaluatorEnvelope(input, { phases, evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 } });
      },
      async repairWrite() { calls.repairWriter += 1; return {}; },
      async repairEvaluate() { calls.repairEvaluator += 1; return {}; },
    });
    expect(result).toMatchObject({
      kind: 'safe_no_op', typedReason: 'safe_no_op',
      evidence: { unsupportedClaimCategory: 'unsupported_authority', safeNoOpSelected: true },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ repairWriter: 0, repairEvaluator: 0 });
  });

  it.each(['request failure', 'transport failure'] as const)('keeps repaired-candidate evidence unambiguous after repair evaluator %s', async (kind) => {
    const result = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }],
        };
        return evaluatorEnvelope(input, { phases, evidence: { ...styleEvidence(input), strongerFulfilled: false, strongerPredicateTransformations: 0, structuralStrengtheningCount: 0 } });
      },
      async repairWrite(input) { return writerEnvelope(input, candidateByStyle.stronger); },
      async repairEvaluate() {
        if (kind === 'request failure') throw new Error('test-only evaluator failure');
        return {};
      },
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: kind === 'request failure' ? 'repair_evaluator_request_failed' : 'repair_evaluator_transport_malformed',
      evidence: {
        repairWriterAttempts: 1,
        repairEvaluatorAttempts: 1,
        candidateHash: expect.any(String),
        phaseStatuses: {
          structural: 'not_evaluated', semantic_grounding: 'not_evaluated', language_native_quality: 'not_evaluated', style_fulfillment: 'not_evaluated',
        },
      },
    });
    if (result.kind === 'handled_failure') {
      expect(result.evidence.candidateHash).not.toBe(hashSummaryV3StyleValue(candidateByStyle.stronger));
    }
  });

  it('never performs a second repair after the single repair evaluator rejects', async () => {
    const calls = { writer: 0, evaluator: 0, repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { calls.writer += 1; return writerEnvelope(input, source); },
      async evaluate(input) {
        calls.evaluator += 1;
        const phases = passingPhases();
        phases.style_fulfillment = { status: 'failed', violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }] };
        return evaluatorEnvelope(input, { phases, evidence: { ...styleEvidence(input), professionalFulfilled: false, professionalFramingOperations: 0, cohesionClarityOperations: 0 } });
      },
      async repairWrite(input) { calls.repairWriter += 1; return writerEnvelope(input, candidateByStyle.professional); },
      async repairEvaluate(input) {
        calls.repairEvaluator += 1;
        const phases = passingPhases();
        phases.style_fulfillment = { status: 'failed', violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }] };
        return evaluatorEnvelope(input, { phases, evidence: { ...styleEvidence(input), professionalFulfilled: false, professionalFramingOperations: 0, cohesionClarityOperations: 0 } });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_rejected' });
    expect(calls).toEqual({ writer: 1, evaluator: 1, repairWriter: 1, repairEvaluator: 1 });
  });

  it('never converts an already-spent repair path into a safe no-op', async () => {
    const calls = { repairWriter: 0, repairEvaluator: 0 };
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, source); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.style_fulfillment = {
          status: 'failed',
          violations: [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: true }],
        };
        return evaluatorEnvelope(input, {
          phases,
          evidence: { ...styleEvidence(input), professionalFulfilled: false, professionalFramingOperations: 0, cohesionClarityOperations: 0 },
        });
      },
      async repairWrite(input) { calls.repairWriter += 1; return writerEnvelope(input, candidateByStyle.professional); },
      async repairEvaluate(input) { calls.repairEvaluator += 1; return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'repair_rejected' });
    expect(calls).toEqual({ repairWriter: 1, repairEvaluator: 1 });
  });

  it('rejects style-specific false greens: punctuation Shorter, modifier-only Stronger, and jargon Professional', async () => {
    const shorter = await executeSummaryV3StyleServer(requestFor('shorter'), {
      async write(input) { return writerEnvelope(input, source.replace(/\./gu, '!')); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(shorter).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    const stronger = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.stronger); },
      async evaluate(input) { return evaluatorEnvelope(input, { evidence: { ...styleEvidence(input), modifierOnlyTransformationDetected: true } }); },
    });
    expect(stronger).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    const repeatedOrStacked = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.stronger); },
      async evaluate(input) { return evaluatorEnvelope(input, { evidence: { ...styleEvidence(input), repeatedStyleModifierCount: 1, stackedModifierDetected: true } }); },
    });
    expect(repeatedOrStacked).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    const professional = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional.replace('builds', 'builds world-class')); },
      async evaluate(input) { return evaluatorEnvelope(input, { evidence: { ...styleEvidence(input), jargonOrFillerDetected: true } }); },
    });
    expect(professional).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    const inventedMetric = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.stronger); },
      async evaluate(input) {
        const phases = passingPhases();
        phases.semantic_grounding = { status: 'failed', violations: [{ code: 'unsupported_metric', factIdHashes: [], unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)], repairable: false }] };
        return evaluatorEnvelope(input, { phases });
      },
    });
    expect(inventedMetric).toMatchObject({
      kind: 'safe_no_op', typedReason: 'safe_no_op',
      evidence: { unsupportedClaimCategory: 'unsupported_metric', safeNoOpSelected: true },
    });
    expect(inventedMetric).not.toHaveProperty('candidate');
    const provenOnly = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.stronger.replace('Product Engineer', 'proven Product Engineer')); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(provenOnly).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    const seniorProfessional = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.professional.replace('Product Engineer', 'Senior Product Engineer')); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(seniorProfessional).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const titleOnly = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, 'Ava Patel is an accomplished Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.'); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(titleOnly).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    const addedMetric = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.stronger} The work improved delivery by 30%.`); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(addedMetric).toMatchObject({
      kind: 'safe_no_op', typedReason: 'safe_no_op',
      evidence: { unsupportedClaimCategory: 'unsupported_metric', safeNoOpSelected: true },
    });
    expect(addedMetric).not.toHaveProperty('candidate');
    const shorterAddedMetric = await executeSummaryV3StyleServer(requestFor('shorter'), {
      async write(input) { return writerEnvelope(input, `${candidateByStyle.shorter} It improved delivery by 30%.`); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(shorterAddedMetric).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('rejects whitespace-only Shorter output even when evaluator evidence incorrectly claims semantic compression', async () => {
    const result = await executeSummaryV3StyleServer(requestFor('shorter'), {
      async write(input) { return writerEnvelope(input, `  ${source}  `); },
      async evaluate(input) { return evaluatorEnvelope(input, { evidence: { ...styleEvidence(input), semanticCompressionOperations: 1, shorterFulfilled: true } }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
  });

  it('rejects a sub-three-percent Shorter reduction with neither topology change nor semantic compression', async () => {
    const longSource = `${source.replace('builds reliable', 'builds the reliable')} ${source}`;
    const minimallyShorter = `${source} ${source}`;
    const result = await executeSummaryV3StyleServer({ ...requestFor('shorter'), visibleSummary: longSource, visibleSummaryFacts: undefined }, {
      async write(input) { return writerEnvelope(input, minimallyShorter); },
      async evaluate(input) {
        return evaluatorEnvelope(input, { evidence: { ...styleEvidence(input), semanticCompressionOperations: 0, shorterFulfilled: true } });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
  });

  it('permits dense fact-preserving Shorter compression without forcing an unsafe one- or two-sentence target', async () => {
    const denseSource = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs. She mentors peers. She improved delivery by 20% over 24 months.';
    const compact = 'Ava Patel is a Product Engineer at Atlas, builds reliable APIs. She mentors peers. She improved delivery by 20% over 24 months.';
    const result = await executeSummaryV3StyleServer({ ...requestFor('shorter'), visibleSummary: denseSource, visibleSummaryFacts: undefined }, {
      async write(input) { return writerEnvelope(input, compact); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'shorter' });
    if (result.kind === 'candidate_ready') expect(result.candidate.unitCount).toBe(3);
  });

  it('rejects a marker-only Professional change even when evaluator evidence falsely claims formal cohesion', async () => {
    const markerOnly = source.replace('a Product Engineer', 'a distinguished Product Engineer');
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, markerOnly); },
      async evaluate(input) { return evaluatorEnvelope(input, { evidence: { ...styleEvidence(input), markerOnlyChangeDetected: false, professionalFulfilled: true } }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
  });

  it('rejects a capitalization-only Professional candidate even when a permissive evaluator claims fulfillment', async () => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer(requestFor('professional'), {
      async write(input) { return writerEnvelope(input, source.replace('builds', 'Builds')); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
    expect(evaluatorCalls).toBe(1);
  });

  it('produces distinct hashes for a normal three-style source without forcing a no-op', async () => {
    const hashes: string[] = [];
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      const result = await executeSummaryV3StyleServer(requestFor(style), {
        async write(input) { return writerEnvelope(input, candidateByStyle[style]); },
        async evaluate(input) { return evaluatorEnvelope(input); },
      });
      expect(result.kind).toBe('candidate_ready');
      if (result.kind === 'candidate_ready') hashes.push(result.candidate.hash);
    }
    expect(new Set(hashes).size).toBe(3);
  });

  it('does not accept each normal candidate under either of the other two style contracts', async () => {
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      for (const otherStyle of ['shorter', 'stronger', 'professional'] as const) {
        if (style === otherStyle) continue;
        const result = await executeSummaryV3StyleServer(requestFor(otherStyle), {
          async write(input) { return writerEnvelope(input, candidateByStyle[style]); },
          async evaluate(input) { return evaluatorEnvelope(input); },
        });
        expect(result.kind, `${style} must not satisfy ${otherStyle}`).toBe('handled_failure');
      }
    }
  });

  it.each(Object.keys(emptyLocaleFixtures) as Array<keyof typeof emptyLocaleFixtures>)('keeps same-locale %s M5 requests in the one injected engine', async (locale) => {
    const result = await executeSummaryV3StyleServer(emptyLocaleRequest(locale), {
      async write(input) { return writerEnvelope(input, emptyLocaleFixtures[locale].candidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result.kind).toBe('candidate_ready');
  });

  it.each(Object.keys(emptyLocaleFixtures) as Array<keyof typeof emptyLocaleFixtures>)('runs a non-empty fact-preserving Shorter path for %s', async (locale) => {
    const emptyRequest = emptyLocaleRequest(locale);
    const sourceForLocale = `${emptyLocaleFixtures[locale].candidate} ${emptyLocaleFixtures[locale].candidate}`;
    const result = await executeSummaryV3StyleServer({
      ...emptyRequest,
      operation: 'summary_shorter',
      operationId: `nonempty-${locale}-shorter`,
      style: 'shorter',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, emptyLocaleFixtures[locale].candidate); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'shorter', mode: 'enhance_existing_content' });
  });

  it.each(['hi', 'ar', 'ja'] as const)('binds the native decimal duration surface for a valid non-empty %s Summary', async (locale) => {
    const sourceForLocale = emptyLocaleFixtures[locale].candidate;
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest(locale),
      operation: 'summary_professional',
      operationId: `native-duration-${locale}-professional`,
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForLocale); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it.each([
    ['en', 'Product Engineer at Atlas builds reliable APIs for 2 years.'],
    ['de', 'Produktentwicklerin bei Atlas entwickelt zuverlässige APIs seit 2 Jahren.'],
    ['sr', 'Softverska inženjerka u Atlasu izrađuje pouzdane API-je 2 godine.'],
    ['hi', 'एटलस में सॉफ्टवेयर इंजीनियर विश्वसनीय एपीआई २ वर्षों से बनाती हैं।'],
    ['ar', 'مهندسة برمجيات في أطلس تبني واجهات برمجة موثوقة منذ ٢ سنة.'],
    ['ja', 'アトラスのソフトウェアエンジニアとして信頼性の高いAPIを２年構築しました。'],
  ] as const)('accepts an equivalent two-year source duration for the structured 24-month %s manifest', async (locale, sourceForLocale) => {
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest(locale),
      operation: 'summary_professional',
      operationId: `equivalent-two-years-${locale}`,
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForLocale); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('preserves a Serbian `do` calendar range lexically and rejects its reordered endpoints before evaluation', async () => {
    const sourceForLocale = 'Mila je Softverska inženjerka u Atlasu od Jan 2020 do Feb 2022 i izrađuje pouzdane API-je.';
    const request = {
      ...emptyLocaleRequest('sr'),
      operation: 'summary_professional' as const,
      operationId: 'serbian-calendar-do-range',
      style: 'professional' as const,
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    };
    const unchanged = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, sourceForLocale); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(unchanged).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });

    let evaluatorCalls = 0;
    const reordered = await executeSummaryV3StyleServer({ ...request, operationId: 'serbian-calendar-do-reordered' }, {
      async write(input) {
        return writerEnvelope(input, sourceForLocale.replace('Jan 2020 do Feb 2022', 'Jan 2022 do Feb 2020'));
      },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(reordered).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);

    let appendedEvaluatorCalls = 0;
    const appendedConflict = await executeSummaryV3StyleServer({ ...request, operationId: 'serbian-calendar-do-appended-conflict' }, {
      async write(input) {
        return writerEnvelope(input, `${sourceForLocale} Jan 2022 do Feb 2020.`);
      },
      async evaluate() { appendedEvaluatorCalls += 1; return {}; },
    });
    expect(appendedConflict).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(appendedEvaluatorCalls).toBe(0);
  });

  it('treats a full month-day-year surface as a source ceiling before evaluator authority', async () => {
    const sourceForDate = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months on May 5, 2020.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      operationId: 'full-month-day-year-ceiling',
      visibleSummary: sourceForDate,
    }, {
      async write(input) { return writerEnvelope(input, `${sourceForDate} She also improved delivery on June 5, 2020.`); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('keeps an unchanged English full named date eligible for a safe no-op', async () => {
    const sourceForDate = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months on May 5, 2020.';
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      operationId: 'english-full-named-date-safe-noop',
      visibleSummary: sourceForDate,
    }, {
      async write(input) { return writerEnvelope(input, sourceForDate); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('keeps an unchanged German ordinal full named date eligible for a safe no-op', async () => {
    const sourceForDate = 'Produktentwicklerin bei Atlas entwickelt zuverlässige APIs seit 24 Monaten am 5. Mai 2020.';
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest('de'),
      operation: 'summary_professional',
      operationId: 'german-full-named-date-safe-noop',
      style: 'professional',
      visibleSummary: sourceForDate,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForDate); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it.each([
    ['de', 'Produktentwicklerin bei Atlas entwickelt zuverlässige APIs seit 24 Monaten am 01.05.2020.'],
    ['sr', 'Softverska inženjerka u Atlasu izrađuje pouzdane API-je 24 meseca od 01.05.2020.'],
  ] as const)('keeps an unchanged dotted day-first calendar date eligible for a %s safe no-op', async (locale, sourceForDate) => {
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest(locale),
      operation: 'summary_professional',
      operationId: `dotted-day-first-date-${locale}`,
      style: 'professional',
      visibleSummary: sourceForDate,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForDate); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('keeps an unchanged Serbian dotted date with a hyphenated duty eligible for a safe no-op', async () => {
    const sourceForDate = 'Ava Patel je softverska inženjerka u Atlasu. Izrađuje API-je od 01.05.2020.';
    const base = emptyLocaleRequest('sr');
    const result = await executeSummaryV3StyleServer({
      ...base,
      operation: 'summary_professional',
      operationId: 'serbian-dotted-date-hyphenated-duty-safe-noop',
      style: 'professional',
      visibleSummary: sourceForDate,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        entries: [{
          ...base.manifest.entries[0]!,
          role: 'Softverska inženjerka',
          employer: 'Atlas',
          facts: [{ id: 'serbian-duty', text: 'Izrađuje API-je' }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, sourceForDate); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('rejects a changed dotted day-first calendar date before evaluator authority', async () => {
    const sourceForDate = 'Produktentwicklerin bei Atlas entwickelt zuverlässige APIs seit 24 Monaten am 01.05.2020.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest('de'),
      operation: 'summary_professional',
      operationId: 'dotted-day-first-date-changed-de',
      style: 'professional',
      visibleSummary: sourceForDate,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForDate.replace('01.05.2020', '02.05.2020')); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('keeps an unchanged Japanese full calendar date and supported metric eligible for safe no-ops while rejecting a changed date before evaluator authority', async () => {
    const dateSource = '森はアトラスのエンジニアとして2020年5月1日にAPIを構築しました。';
    const dateRequest: SummaryV3StyleRequest = {
      ...emptyLocaleRequest('ja'),
      operation: 'summary_professional',
      operationId: 'japanese-full-calendar-date-safe-noop',
      style: 'professional',
      visibleSummary: dateSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...emptyLocaleRequest('ja').manifest,
        entries: [{
          ...emptyLocaleRequest('ja').manifest.entries[0]!,
          facts: [{ id: 'japanese-date', text: '2020年5月1日にAPIを構築しました' }],
        }],
      },
    };
    const unchangedDate = await executeSummaryV3StyleServer(dateRequest, {
      async write(input) { return writerEnvelope(input, dateSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(unchangedDate).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });

    let changedDateEvaluatorCalls = 0;
    const changedDate = await executeSummaryV3StyleServer({ ...dateRequest, operationId: 'japanese-full-calendar-date-changed' }, {
      async write(input) { return writerEnvelope(input, dateSource.replace('2020年5月1日', '2020年5月2日')); },
      async evaluate() { changedDateEvaluatorCalls += 1; return {}; },
    });
    expect(changedDate).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(changedDateEvaluatorCalls).toBe(0);

    const metricSource = 'ミラはアトラスのエンジニアとしてAPIの性能を20%改善しました。';
    const metric = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest('ja'),
      operation: 'summary_professional',
      operationId: 'japanese-supported-metric-safe-noop',
      style: 'professional',
      visibleSummary: metricSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...emptyLocaleRequest('ja').manifest,
        entries: [{
          ...emptyLocaleRequest('ja').manifest.entries[0]!,
          facts: [{ id: 'japanese-metric', text: 'APIの性能を20%改善しました' }],
        }],
      },
    }, {
      async write(input) { return writerEnvelope(input, metricSource); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(metric).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
  });

  it('rejects a non-equivalent one-year source duration before a permissive safe no-op can pass', async () => {
    const sourceForLocale = 'Product Engineer at Atlas builds reliable APIs for 1 year.';
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest('en'),
      operation: 'summary_professional',
      operationId: 'non-equivalent-one-year-en',
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForLocale); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('does not let a validated two-year duration mask an unrelated unsupported matching numeral', async () => {
    const sourceForLocale = 'Product Engineer at Atlas builds reliable APIs for 2 years and won 2 awards.';
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest('en'),
      operation: 'summary_professional',
      operationId: 'duration-does-not-mask-awards-en',
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForLocale); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it.each([
    ['sr', '24', '12'],
    ['hi', '२४', '१२'],
    ['ar', '٢٤', '١٢'],
    ['ja', '２４', '１２'],
  ] as const)('rejects a changed native duration value for %s before evaluator authority', async (locale, expectedNativeDuration, wrongNativeDuration) => {
    const sourceForLocale = emptyLocaleFixtures[locale].candidate;
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...emptyLocaleRequest(locale),
      operation: 'summary_professional',
      operationId: `native-duration-${locale}-negative`,
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, sourceForLocale.replace(expectedNativeDuration, wrongNativeDuration)); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each(Object.keys(emptyLocaleFixtures) as Array<keyof typeof emptyLocaleFixtures>)('rejects a punctuation-only Professional candidate for %s', async (locale) => {
    const emptyRequest = emptyLocaleRequest(locale);
    const sourceForLocale = emptyLocaleFixtures[locale].candidate;
    const result = await executeSummaryV3StyleServer({
      ...emptyRequest,
      operation: 'summary_professional',
      operationId: `negative-${locale}-professional`,
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, `${sourceForLocale}!`); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'style_not_fulfilled' });
  });

  it.each(Object.keys(emptyLocaleFixtures) as Array<keyof typeof emptyLocaleFixtures>)('rejects an invented numeric claim for %s without relying on an evaluator false green', async (locale) => {
    const emptyRequest = emptyLocaleRequest(locale);
    const sourceForLocale = emptyLocaleFixtures[locale].candidate;
    const result = await executeSummaryV3StyleServer({
      ...emptyRequest,
      operation: 'summary_professional',
      operationId: `metric-${locale}-professional`,
      style: 'professional',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
    }, {
      async write(input) { return writerEnvelope(input, `${sourceForLocale} 99`); },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('fails a claimed native-quality pass when a candidate mixes enough English prose to fall below the Arabic floor', async () => {
    const arabicSource = 'ميرا محللة في نوفا. حسنت التقارير خلال 12 شهرا.';
    const base = requestFor('professional');
    const result = await executeSummaryV3StyleServer({
      ...base,
      requestedLocale: 'ar',
      sourceLocale: 'ar',
      visibleSummary: arabicSource,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        ...base.manifest,
        sourceLocale: 'ar',
        entries: [{
          stableId: 'ar-current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24,
          facts: [{ id: 'ar-context', text: 'ميرا محللة في نوفا حسنت التقارير خلال 12 شهرا' }],
        }],
        currentRoleEntryId: 'ar-current',
      },
    }, {
      async write(input) {
        return writerEnvelope(input, `${arabicSource} Product Engineer at Atlas builds reliable APIs, mentors peers, and improves delivery with extensive English explanatory material.`);
      },
      async evaluate(input) { return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'invalid_language_or_native_surface' });
  });

  it.each([
    {
      locale: 'ar',
      source: 'لو مهندس في أطلس منذ 24 شهرا ويبني واجهات برمجة موثوقة.',
      candidate: 'مهندس في أطلس منذ 24 شهرا ويبني واجهات برمجة موثوقة.',
      role: 'مهندس', employer: 'أطلس', duty: 'يبني واجهات برمجة موثوقة', name: 'لو',
    },
    {
      locale: 'hi',
      source: 'ली एटलस में इंजीनियर हैं और 24 महीनों से एपीआई बनाती हैं।',
      candidate: 'एटलस में इंजीनियर हैं और 24 महीनों से एपीआई बनाती हैं।',
      role: 'इंजीनियर', employer: 'एटलस', duty: 'एपीआई बनाती हैं', name: 'ली',
    },
    {
      locale: 'ja',
      source: 'ミラはアトラスのエンジニアとして24か月間APIを構築しました。',
      candidate: 'アトラスのエンジニアとして24か月間APIを構築しました。',
      role: 'エンジニア', employer: 'アトラス', duty: 'APIを構築', name: 'ミラ',
    },
  ] as const)('rejects removal of an automatic compact %s source name before evaluator authority', async (fixture) => {
    const base = requestFor('stronger');
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...base,
      requestedLocale: fixture.locale,
      sourceLocale: fixture.locale,
      visibleSummary: fixture.source,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: `compact-${fixture.locale}-manifest`, contextId: `compact-${fixture.locale}-context`, sourceLocale: fixture.locale,
        currentRoleEntryId: `compact-${fixture.locale}-current`,
        entries: [{ stableId: `compact-${fixture.locale}-current`, role: fixture.role, employer: fixture.employer, employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: fixture.duty }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, fixture.candidate); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls, `${fixture.name} must stay in the automatic source floor`).toBe(0);
  });

  it.each([
    {
      locale: 'ar', name: 'لو', role: 'مهندس', employer: 'أطلس', duty: 'يبني واجهات برمجة موثوقة',
      source: 'لو مهندس في أطلس منذ 24 شهرا ويبني واجهات برمجة موثوقة.',
      candidate: 'لو أحمد مهندس في أطلس منذ 24 شهرا ويبني واجهات برمجة موثوقة.',
    },
    {
      locale: 'ar', name: 'لو', role: 'مهندس', employer: 'أطلس', duty: 'يبني واجهات برمجة موثوقة',
      source: 'لو مهندس في أطلس منذ 24 شهرا ويبني واجهات برمجة موثوقة.',
      candidate: 'أحمد لو مهندس في أطلس منذ 24 شهرا ويبني واجهات برمجة موثوقة.',
    },
    {
      locale: 'hi', name: 'ली', role: 'इंजीनियर', employer: 'एटलस', duty: 'एपीआई बनाती हैं',
      source: 'ली एटलस में इंजीनियर हैं और 24 महीनों से एपीआई बनाती हैं।',
      candidate: 'ली शर्मा एटलस में इंजीनियर हैं और 24 महीनों से एपीआई बनाती हैं।',
    },
    {
      locale: 'hi', name: 'ली', role: 'इंजीनियर', employer: 'एटलस', duty: 'एपीआई बनाती हैं',
      source: 'ली एटलस में इंजीनियर हैं और 24 महीनों से एपीआई बनाती हैं।',
      candidate: 'शर्मा ली एटलस में इंजीनियर हैं और 24 महीनों से एपीआई बनाती हैं।',
    },
    {
      locale: 'ar', name: 'ميرا', role: 'مهندسة', employer: 'أطلس', duty: 'تبني واجهات برمجة موثوقة',
      source: 'ميرا مهندسة في أطلس. ميرا تبني واجهات برمجة موثوقة منذ 24 شهرا.',
      candidate: 'ميرا مهندسة في أطلس. ميرا أحمد تبني واجهات برمجة موثوقة منذ 24 شهرا.',
    },
    {
      locale: 'hi', name: 'मीरा', role: 'इंजीनियर', employer: 'एटलस', duty: 'विश्वसनीय एपीआई बनाती हैं',
      source: 'मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई बनाती हैं और 24 महीनों से काम करती हैं।',
      candidate: 'मीरा एटलस में इंजीनियर हैं। मीरा शर्मा विश्वसनीय एपीआई बनाती हैं और 24 महीनों से काम करती हैं।',
    },
    {
      locale: 'ar', name: 'ميرا', role: 'مهندسة برمجيات', employer: 'أطلس', duty: 'تبني واجهات برمجة موثوقة',
      source: 'Currently, ميرا مهندسة برمجيات في أطلس. ميرا تبني واجهات برمجة موثوقة.',
      candidate: 'Currently, ميرا مهندسة برمجيات في أطلس. ميرا أحمد تبني واجهات برمجة موثوقة بأسلوب فعال.',
    },
    {
      locale: 'hi', name: 'मीरा', role: 'इंजीनियर', employer: 'एटलस', duty: 'विश्वसनीय एपीआई बनाती हैं',
      source: 'वर्तमान में, मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई बनाती हैं।',
      candidate: 'वर्तमान में, मीरा एटलस में इंजीनियर हैं। मीरा शर्मा विश्वसनीय एपीआई बनाती हैं।',
    },
  ] as const)('rejects unannotated compact %s identity expansion/reordering before evaluator authority', async (fixture) => {
    const base = requestFor('professional');
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...base,
      requestedLocale: fixture.locale,
      sourceLocale: fixture.locale,
      visibleSummary: fixture.source,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: `compact-expansion-${fixture.locale}`, contextId: `compact-expansion-${fixture.locale}`, sourceLocale: fixture.locale,
        currentRoleEntryId: `compact-expansion-${fixture.locale}`,
        entries: [{ stableId: `compact-expansion-${fixture.locale}`, role: fixture.role, employer: fixture.employer, employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: fixture.duty }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, fixture.candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls, `${fixture.name} expansion must stay in the local source floor`).toBe(0);
  });

  it('rejects an unannotated inline Arabic role-frame identity expansion before evaluator authority', async () => {
    const sourceForIdentity = 'أطلس توظف لو كمهندس.';
    const request = {
      ...requestFor('professional'),
      requestedLocale: 'ar' as const,
      sourceLocale: 'ar' as const,
      operationId: 'inline-arabic-role-frame-name',
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'inline-arabic-role-frame-name', contextId: 'inline-arabic-role-frame-name', sourceLocale: 'ar' as const, currentRoleEntryId: 'inline-arabic-role-frame-entry',
        entries: [{ stableId: 'inline-arabic-role-frame-entry', role: 'مهندس', employer: 'أطلس', employmentState: 'present' as const, durationMonths: 24, facts: [{ id: 'duty', text: 'توظف لو كمهندس' }] }],
      },
    };
    const unchanged = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, sourceForIdentity); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(unchanged).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });

    let evaluatorCalls = 0;
    const expanded = await executeSummaryV3StyleServer({ ...request, operationId: 'inline-arabic-role-frame-expanded' }, {
      async write(input) { return writerEnvelope(input, 'أطلس توظف لو أحمد كمهندس ويتمتع بخبرة مهنية واضحة.'); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(expanded).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects an unannotated inline Devanagari role-frame identity expansion before evaluator authority', async () => {
    const sourceForIdentity = 'एटलस ने ली को इंजीनियर नियुक्त किया।';
    const request = {
      ...requestFor('professional'),
      requestedLocale: 'hi' as const,
      sourceLocale: 'hi' as const,
      operationId: 'inline-devanagari-role-frame-name',
      visibleSummary: sourceForIdentity,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'inline-devanagari-role-frame-name', contextId: 'inline-devanagari-role-frame-name', sourceLocale: 'hi' as const, currentRoleEntryId: 'inline-devanagari-role-frame-entry',
        entries: [{ stableId: 'inline-devanagari-role-frame-entry', role: 'इंजीनियर', employer: 'एटलस', employmentState: 'present' as const, durationMonths: 24, facts: [{ id: 'duty', text: 'ली को इंजीनियर नियुक्त किया' }] }],
      },
    };
    const unchanged = await executeSummaryV3StyleServer(request, {
      async write(input) { return writerEnvelope(input, sourceForIdentity); },
      async evaluate(input) { return evaluatorEnvelope(input, { noOpDetected: true }); },
    });
    expect(unchanged).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });

    let evaluatorCalls = 0;
    const expanded = await executeSummaryV3StyleServer({ ...request, operationId: 'inline-devanagari-role-frame-expanded' }, {
      async write(input) { return writerEnvelope(input, 'एटलस ने ली शर्मा को इंजीनियर नियुक्त किया।'); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(expanded).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    {
      source: 'ミラはアトラスのエンジニアとして24か月間APIを構築しました。',
      candidate: 'ミラ・アキコはアトラスのエンジニアとして24か月間APIを構築しました。',
      role: 'エンジニア', employer: 'アトラス', duty: 'APIを構築',
    },
    {
      source: '森さんはアトラスのエンジニアとして24か月間APIを構築しています。',
      candidate: '森・田さんはアトラスのエンジニアとして24か月間APIを構築しています。',
      role: 'エンジニア', employer: 'アトラス', duty: 'APIを構築しています',
    },
    {
      source: '森はアトラスのエンジニアとして24か月間APIを構築しています。',
      candidate: '森（田）はアトラスのエンジニアとして24か月間APIを構築しています。',
      role: 'エンジニア', employer: 'アトラス', duty: 'APIを構築しています',
    },
  ] as const)('rejects Japanese compact subject expansions before evaluator authority', async (fixture) => {
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      requestedLocale: 'ja',
      sourceLocale: 'ja',
      visibleSummary: fixture.source,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'japanese-compact-expansion', contextId: 'japanese-compact-expansion', sourceLocale: 'ja', currentRoleEntryId: 'japanese-compact-expansion',
        entries: [{ stableId: 'japanese-compact-expansion', role: fixture.role, employer: fixture.employer, employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: fixture.duty }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, fixture.candidate); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('preserves an unannotated post-delimiter Japanese compact subject identity before evaluator authority', async () => {
    const sourceForLocale = '現在、森はアトラスのソフトウェアエンジニアです。また、森は信頼性の高いAPIを構築しています。さらに、森は信頼性の高いAPIを構築しています。';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('shorter'),
      requestedLocale: 'ja',
      sourceLocale: 'ja',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'post-delimiter-japanese-name', contextId: 'post-delimiter-japanese-name', sourceLocale: 'ja', currentRoleEntryId: 'post-delimiter-japanese-entry',
        entries: [{ stableId: 'post-delimiter-japanese-entry', role: 'ソフトウェアエンジニア', employer: 'アトラス', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: '信頼性の高いAPIを構築しています' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, '現在、森はアトラスのソフトウェアエンジニアです。また、さらに森田は信頼性の高いAPIを構築しています。'); },
      async evaluate(input) {
        evaluatorCalls += 1;
        const missing = input.requiredFacts[input.requiredFacts.length - 1]!;
        const phases = passingPhases();
        phases.semantic_grounding = {
          status: 'failed',
          violations: [{ code: 'missing_fact', factIdHashes: [missing.hash], unitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash), repairable: false }],
        };
        return evaluatorEnvelope(input, {
          representedFactIdHashes: input.requiredFacts.filter((fact) => fact.hash !== missing.hash).map((fact) => fact.hash),
          missingFactIdHashes: [missing.hash],
          phases,
        });
      },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true } });
    expect(evaluatorCalls).toBe(1);
  });

  it('preserves an unannotated leading one-character Japanese subject identity before evaluator authority', async () => {
    const sourceForLocale = '森はアトラスのエンジニアとして24か月間APIを構築しています。';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      requestedLocale: 'ja',
      sourceLocale: 'ja',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'single-han-name', contextId: 'single-han-name', sourceLocale: 'ja', currentRoleEntryId: 'single-han-entry',
        entries: [{ stableId: 'single-han-entry', role: 'エンジニア', employer: 'アトラス', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'APIを構築しています' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, 'アトラスのエンジニアとして24か月間APIを構築しています。'); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('preserves an unannotated leading one-character Japanese honorific identity before evaluator authority', async () => {
    const sourceForLocale = '森さんはアトラスのエンジニアとして24か月間APIを構築しています。';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('professional'),
      requestedLocale: 'ja',
      sourceLocale: 'ja',
      visibleSummary: sourceForLocale,
      visibleSummaryFacts: undefined,
      protectedEntities: undefined,
      manifest: {
        manifestId: 'single-han-honorific-name', contextId: 'single-han-honorific-name', sourceLocale: 'ja', currentRoleEntryId: 'single-han-honorific-entry',
        entries: [{ stableId: 'single-han-honorific-entry', role: 'エンジニア', employer: 'アトラス', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'APIを構築しています' }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, '田中さんはアトラスのエンジニアとして24か月間APIを構築しています。'); },
      async evaluate() { evaluatorCalls += 1; return {}; },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('does not waive an omitted source-only tool when Stronger replaces a grounded predicate', async () => {
    const sourceWithTool = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs using Python, mentors peers, and improved delivery by 20% over 24 months.';
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...requestFor('stronger'), visibleSummary: sourceWithTool, visibleSummaryFacts: undefined,
    }, {
      async write(input) {
        return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She engineers reliable APIs, mentors peers, and improved delivery by 20% over 24 months.');
      },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it.each([
    {
      locale: 'en', entity: 'Mira', role: 'Engineer', employer: 'Atlas', duty: 'builds',
      source: 'Mira is an Engineer at Atlas. Mira builds reliable APIs for 24 months.',
      candidate: 'Mira is an Engineer at Atlas. Mira engineers reliable APIs for 24 months.',
      predicateSpan: 'builds', predicateAnchor: 'builds', manifestFact: 'builds reliable APIs',
    },
    {
      locale: 'ar', entity: 'ميرا', role: 'مهندسة', employer: 'أطلس', duty: 'تبني',
      source: 'ميرا مهندسة في أطلس. ميرا تبني واجهات برمجة موثوقة منذ 24 شهرا.',
      candidate: 'ميرا مهندسة في أطلس. ميرا تطور واجهات برمجة موثوقة منذ 24 شهرا.',
      predicateSpan: 'تبني', predicateAnchor: 'تبني', manifestFact: 'تبني واجهات برمجة موثوقة',
    },
    {
      locale: 'hi', entity: 'मीरा', role: 'इंजीनियर', employer: 'एटलस', duty: 'बनाती',
      source: 'मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई बनाती हैं और 24 महीनों से काम करती हैं।',
      candidate: 'मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई विकसित करती हैं और 24 महीनों से काम करती हैं।',
      predicateSpan: 'बनाती', predicateAnchor: 'बनाती', manifestFact: 'विश्वसनीय एपीआई बनाती हैं',
    },
    {
      locale: 'ja', entity: 'ミラ', role: 'エンジニア', employer: 'アトラス', duty: '構築',
      source: 'ミラはアトラスのエンジニアです。ミラはAPIを構築しました。',
      candidate: 'ミラはアトラスのエンジニアです。ミラはAPIを実装しました。',
      predicateSpan: '構築しました', predicateAnchor: '構築', manifestFact: 'APIを構築しました',
    },
  ] as const)('permits one marked name-led %s Stronger predicate while preserving every other source anchor', async (fixture) => {
    const base = requestFor('stronger');
    const observed: { writer?: SummaryV3StyleWriterInput; evaluator?: SummaryV3StyleEvaluatorInput } = {};
    const result = await executeSummaryV3StyleServer({
      ...base,
      requestedLocale: fixture.locale,
      sourceLocale: fixture.locale,
      visibleSummary: fixture.source,
      protectedEntities: [fixture.entity],
      visibleSummaryFacts: [{
        id: 'marked-duty', text: fixture.manifestFact, semanticKind: 'duty',
        transformableDuty: { sourcePredicate: fixture.predicateSpan, predicateAnchor: fixture.predicateAnchor },
      }],
      manifest: {
        manifestId: `marked-${fixture.locale}-manifest`, contextId: `marked-${fixture.locale}-context`, sourceLocale: fixture.locale,
        currentRoleEntryId: `marked-${fixture.locale}-current`,
        entries: [{ stableId: `marked-${fixture.locale}-current`, role: fixture.role, employer: fixture.employer, employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: fixture.manifestFact }] }],
      },
    }, {
      async write(input) { observed.writer = input; return writerEnvelope(input, fixture.candidate); },
      async evaluate(input) { observed.evaluator = input; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'stronger' });
    expect(observed.writer?.transformableDuty).toMatchObject({ sourcePredicate: fixture.predicateSpan, predicateAnchor: fixture.predicateAnchor });
    expect(observed.evaluator?.transformableDuty?.hash).toBe(observed.writer?.transformableDuty?.hash);
  });

  it.each([
    {
      locale: 'en', entity: 'Mira', role: 'Engineer', employer: 'Atlas', duty: 'builds reliable APIs',
      source: 'Mira is an Engineer at Atlas. Mira builds reliable APIs for 24 months.',
      candidate: 'Mira is an Engineer at Atlas. Mira engineers reliable APIs for 24 months.',
    },
    {
      locale: 'ar', entity: 'ميرا', role: 'مهندسة', employer: 'أطلس', duty: 'تبني واجهات برمجة موثوقة',
      source: 'ميرا مهندسة في أطلس. ميرا تبني واجهات برمجة موثوقة منذ 24 شهرا.',
      candidate: 'ميرا مهندسة في أطلس. ميرا تطور واجهات برمجة موثوقة منذ 24 شهرا.',
    },
    {
      locale: 'hi', entity: 'मीरा', role: 'इंजीनियर', employer: 'एटलस', duty: 'विश्वसनीय एपीआई बनाती हैं',
      source: 'मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई बनाती हैं और 24 महीनों से काम करती हैं।',
      candidate: 'मीरा एटलस में इंजीनियर हैं। मीरा विश्वसनीय एपीआई विकसित करती हैं और 24 महीनों से काम करती हैं।',
    },
    {
      locale: 'ja', entity: 'ミラ', role: 'エンジニア', employer: 'アトラス', duty: 'APIを構築しました',
      source: 'ミラはアトラスのエンジニアです。ミラはAPIを構築しました。',
      candidate: 'ミラはアトラスのエンジニアです。ミラはAPIを実装しました。',
    },
  ] as const)('fails closed for the same name-led %s Stronger rewrite without explicit duty provenance', async (fixture) => {
    const base = requestFor('stronger');
    let evaluatorCalls = 0;
    const result = await executeSummaryV3StyleServer({
      ...base, requestedLocale: fixture.locale, sourceLocale: fixture.locale,
      visibleSummary: fixture.source, protectedEntities: [fixture.entity], visibleSummaryFacts: undefined,
      manifest: {
        manifestId: `unmarked-${fixture.locale}-manifest`, contextId: `unmarked-${fixture.locale}-context`, sourceLocale: fixture.locale,
        currentRoleEntryId: `unmarked-${fixture.locale}-current`,
        entries: [{ stableId: `unmarked-${fixture.locale}-current`, role: fixture.role, employer: fixture.employer, employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: fixture.duty }] }],
      },
    }, {
      async write(input) { return writerEnvelope(input, fixture.candidate); },
      async evaluate(input) { evaluatorCalls += 1; return evaluatorEnvelope(input); },
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(evaluatorCalls).toBe(0);
  });

  it('rejects local metric, technical-tool, dotted-tool, currency, duration-unit, later compact-name, and unsupported-led false greens before evaluation', async () => {
    const calls = { metric: 0, tool: 0, dottedTool: 0, currency: 0, duration: 0, laterName: 0, led: 0 };
    const metric = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, candidateByStyle.stronger.replace('20%', '20 dollars')); },
      async evaluate(input) { calls.metric += 1; return evaluatorEnvelope(input); },
    });
    expect(metric).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    const toolSource = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs using C# for 24 months.';
    const tool = await executeSummaryV3StyleServer({ ...requestFor('stronger'), visibleSummary: toolSource, visibleSummaryFacts: undefined }, {
      async write(input) { return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She engineers reliable APIs using C++ for 24 months.'); },
      async evaluate(input) { calls.tool += 1; return evaluatorEnvelope(input); },
    });
    expect(tool).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    const dottedToolSource = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs using Node.js for 24 months.';
    const dottedTool = await executeSummaryV3StyleServer({ ...requestFor('stronger'), visibleSummary: dottedToolSource, visibleSummaryFacts: undefined }, {
      async write(input) { return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She engineers reliable APIs using Node.py for 24 months.'); },
      async evaluate(input) { calls.dottedTool += 1; return evaluatorEnvelope(input); },
    });
    expect(dottedTool).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    const currencySource = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs that produced $20 revenue over 24 months.';
    const currency = await executeSummaryV3StyleServer({ ...requestFor('stronger'), visibleSummary: currencySource, visibleSummaryFacts: undefined }, {
      async write(input) { return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She engineers reliable APIs that produced €20 revenue over 24 months.'); },
      async evaluate(input) { calls.currency += 1; return evaluatorEnvelope(input); },
    });
    expect(currency).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    const japaneseBase = requestFor('professional');
    const duration = await executeSummaryV3StyleServer({
      ...japaneseBase, requestedLocale: 'ja', sourceLocale: 'ja', visibleSummary: 'ミラはアトラスのエンジニアとして24か月勤務しています。', visibleSummaryFacts: undefined, protectedEntities: undefined,
      manifest: { manifestId: 'duration-ja', contextId: 'duration-ja', sourceLocale: 'ja', currentRoleEntryId: 'ja-current', entries: [{ stableId: 'ja-current', role: 'エンジニア', employer: 'アトラス', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: '勤務しています' }] }] },
    }, {
      async write(input) { return writerEnvelope(input, 'ミラはアトラスのエンジニアとして24年勤務しています。'); },
      async evaluate(input) { calls.duration += 1; return evaluatorEnvelope(input); },
    });
    expect(duration).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    const arabicBase = requestFor('professional');
    const laterName = await executeSummaryV3StyleServer({
      ...arabicBase, requestedLocale: 'ar', sourceLocale: 'ar', visibleSummary: 'أطلس توظف لو كمهندس منذ 24 شهرا.', visibleSummaryFacts: undefined, protectedEntities: undefined,
      manifest: { manifestId: 'later-ar', contextId: 'later-ar', sourceLocale: 'ar', currentRoleEntryId: 'ar-current', entries: [{ stableId: 'ar-current', role: 'مهندس', employer: 'أطلس', employmentState: 'present', durationMonths: 24, facts: [{ id: 'duty', text: 'توظف لو كمهندس' }] }] },
    }, {
      async write(input) { return writerEnvelope(input, 'أطلس توظف كمهندس منذ 24 شهرا.'); },
      async evaluate(input) { calls.laterName += 1; return evaluatorEnvelope(input); },
    });
    expect(laterName).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    const led = await executeSummaryV3StyleServer(requestFor('stronger'), {
      async write(input) { return writerEnvelope(input, 'Ava Patel is a Product Engineer at Atlas. She led reliable APIs, mentors peers, and improved delivery by 20% over 24 months.'); },
      async evaluate(input) { calls.led += 1; return evaluatorEnvelope(input); },
    });
    expect(led).toMatchObject({
      kind: 'safe_no_op', typedReason: 'safe_no_op',
      evidence: { unsupportedClaimCategory: 'unsupported_authority', safeNoOpSelected: true },
    });
    expect(led).not.toHaveProperty('candidate');
    expect(calls).toEqual({ metric: 0, tool: 0, dottedTool: 0, currency: 0, duration: 0, laterName: 0, led: 1 });
  });

  it('has no V2 runtime import, route/page/store/usage integration, fetch, or fallback implementation', () => {
    const root = resolve(process.cwd(), 'src/lib/ai-core-v3');
    const domain = readFileSync(resolve(root, 'summary-style-m5.ts'), 'utf8');
    const server = readFileSync(resolve(root, 'summary-style-m5-server.ts'), 'utf8');
    const production = `${domain}\n${server}`;
    expect(production).not.toMatch(/cv-summary-v2/u);
    expect(production).not.toMatch(/src\/app|store\.tsx|ai-usage-policy|api\/generate/u);
    expect(production).not.toMatch(/\bfetch\s*\(/u);
    expect(production).not.toMatch(/deterministic prose fallback/u);
  });
});
