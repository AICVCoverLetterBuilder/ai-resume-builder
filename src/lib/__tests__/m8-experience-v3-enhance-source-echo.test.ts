import { describe, expect, it } from 'vitest';
import {
  decideExperienceV3EnhanceCanonicalCandidate,
  applyExperienceV3EnhanceTransaction,
  captureExperienceV3EnhanceOperationSnapshot,
  isExperienceV3EnhanceMaterialityKind,
  runExperienceV3EnhanceAdapter,
} from '../ai-core-v3/experience-enhance';
import type { ExperienceV3EnhanceAdapterInput } from '../ai-core-v3/experience-enhance';
import {
  executeExperienceV3EnhanceServer,
  EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME,
  EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME,
} from '../ai-core-v3/experience-enhance-server';
import type { CVData } from '../types';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
} from '../cv-ai-finalize-apply';
import {
  buildExperienceAiOutputProvenance,
  resolveExperienceTextareaProvenance,
} from '../cv-experience-ai-output-provenance';
import {
  decideExperienceCanonicalPreapply,
} from '../cv-experience-visible-noop-authority';
import {
  createExperienceAiOperationSnapshot,
  experienceAiSourcesEquivalent,
} from '../cv-experience-ai-operation-snapshot';

const SOURCE = [
  'Wartung an elektrischen Anlagen machen.',
  'Störungen suchen und beheben.',
  'Bei der Installation von elektrischen Komponenten helfen.',
].join('\n');

const IMPROVED = [
  'Führt Wartungsarbeiten an elektrischen Anlagen durch.',
  'Lokalisiert und behebt Störungen in elektrischen Systemen.',
  'Unterstützt die Installation elektrischer Komponenten.',
].join('\n');

function noApply(candidateText: string) {
  return decideExperienceV3EnhanceCanonicalCandidate({
    sourceText: SOURCE,
    candidateText,
    materialityKind: 'professional_phrasing',
  });
}

function terminalInput(sourceText = SOURCE, usageCountBefore = 8): ExperienceV3EnhanceAdapterInput {
  const cv: CVData = {
    id: 'm8-terminal-cv', name: 'M8 terminal',
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Support Specialist', gender: '' },
    summary: '', contentLocale: 'en',
    experience: [{
      id: 'm8-terminal-entry', company: 'Example', position: 'Support Specialist',
      startDate: '2024-01', endDate: '', isPresent: true, description: sourceText,
    }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
  };
  return {
    enabled: true, operationKind: 'experience_enhance',
    operationId: 'm8-terminal-operation', requestId: 'm8-terminal-request',
    entryId: 'm8-terminal-entry', entryIndexDiagnostic: 0, cv,
    industry: 'customer-service', level: 'mid', gender: '',
    requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en',
    exactVisibleDescription: sourceText, jobContextHash: 'm8-terminal-job',
    usageCountBefore,
  };
}

async function runTerminalDiagnostic(
  candidateUnits: readonly string[],
  materialityKind: 'professional_phrasing' | 'grammar_correction' = 'professional_phrasing',
  sourceText = SOURCE,
  options: {
    usageCountBefore?: number;
    observedUsageAtStart?: number;
    usageReader?: 'available' | 'missing' | 'throwing';
  } = {},
) {
  const input = terminalInput(sourceText, options.usageCountBefore ?? 8);
  let cv = input.cv;
  let usage = options.observedUsageAtStart ?? input.usageCountBefore;
  let writeCount = 0;
  let persistCount = 0;
  let usageIncrementCalls = 0;
  const dependencies = {
    request: async ({ manifest }) => {
      const units = candidateUnits.map((text, index) => ({
        factId: manifest.facts[index].factId,
        text,
      }));
      return {
        ok: true as const,
        action: 'experience_v3_enhance' as const,
        providerOutput: {
          operationId: manifest.operationId, entryId: manifest.entryId,
          snapshotHash: manifest.snapshotHash, locale: manifest.locale, units,
        },
        candidate: {
          operationId: manifest.operationId, candidateId: 'm8-terminal-candidate',
          operationKind: 'experience_enhance' as const, targetLocale: manifest.locale,
          sourceSnapshotHash: manifest.snapshotHash,
          text: units.map((unit) => `• ${unit.text}`).join('\n'),
          units: units.map((unit, index) => ({
            unitId: `m8-terminal-unit-${index + 1}`, entryId: manifest.entryId,
            text: unit.text, factIds: [unit.factId],
          })),
        },
        validation: {
          decision: 'accept' as const,
          phases: {
            structural: { status: 'passed' as const, violations: [] },
            semantic: { status: 'passed' as const, violations: [] },
            language_quality: { status: 'passed' as const, violations: [] },
          },
        },
        materiality: {
          status: 'material' as const, kind: materialityKind,
          sourceEquivalent: false as const, degradationDetected: false as const,
        },
      };
    },
    getLiveState: () => ({
      cv, requestedLocale: input.requestedLocale, uiLocale: input.uiLocale,
      storedContentLocale: input.storedContentLocale,
      exactVisibleDescription: sourceText, industry: input.industry,
      level: input.level, jobContextHash: input.jobContextHash,
    }),
    getActiveOperationId: () => input.operationId,
    writeCv: (next) => { writeCount += 1; cv = next; },
    persistCv: () => { persistCount += 1; return true; },
    incrementUsage: () => { usageIncrementCalls += 1; usage += 1; },
    ...(options.usageReader === 'missing'
      ? {}
      : {
        getUsageCount: () => {
          if (options.usageReader === 'throwing') throw new Error('controlled_usage_reader_failure');
          return usage;
        },
      }),
  } satisfies Parameters<typeof runExperienceV3EnhanceAdapter>[1];
  const result = await runExperienceV3EnhanceAdapter(input, dependencies);
  return { result, writeCount, persistCount, usage, usageIncrementCalls };
}

describe('M8 Experience V3 Enhance source-equivalence gate', () => {
  it('A: rejects an exact normalized source echo', () => {
    expect(noApply(SOURCE)).toMatchObject({
      sourceEquivalentToAuthoritativeSource: true,
      materialImprovementDetected: false,
      finalDecisionKind: 'semantic_noop',
      shouldApply: false,
      shouldIncrementUsage: false,
    });
  });

  it('B: rejects formatting-only source changes', () => {
    expect(noApply('• Wartung an elektrischen Anlagen machen.\n2) Störungen suchen und beheben!\n- Bei der Installation von elektrischen Komponenten helfen.'))
      .toMatchObject({
        sourceEquivalentToAuthoritativeSource: true,
        materialImprovementDetected: false,
        shouldApply: false,
        shouldIncrementUsage: false,
      });
  });

  it('C: rejects a complete deterministic fallback when the provider was incomplete', () => {
    const providerCovered = 2;
    const providerRequired = 3;
    const fallback = noApply(SOURCE);
    expect(providerCovered).toBeLessThan(providerRequired);
    expect(fallback.finalDecisionKind).toBe('semantic_noop');
    expect(fallback.shouldApply).toBe(false);
    expect(fallback.shouldIncrementUsage).toBe(false);
  });

  it('C2: source-equivalent fallback cannot reach apply or usage transaction', () => {
    const cv: CVData = {
      id: 'm8-cv', name: 'M8',
      personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Techniker', gender: '' },
      summary: '', contentLocale: 'de',
      experience: [{
        id: 'm8-entry', company: 'Example', position: 'Techniker',
        startDate: '2024-01', endDate: '', isPresent: true, description: SOURCE,
      }],
      education: [], skills: [], certifications: [], languages: [],
      templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
    };
    const snapshot = captureExperienceV3EnhanceOperationSnapshot({
      enabled: true, operationKind: 'experience_enhance', operationId: 'm8-op', requestId: 'm8-op',
      entryId: 'm8-entry', entryIndexDiagnostic: 0, cv, industry: 'engineering', level: 'mid', gender: '',
      requestedLocale: 'de', uiLocale: 'de', storedContentLocale: 'de', exactVisibleDescription: SOURCE,
      jobContextHash: 'm8-job', usageCountBefore: 8,
    });
    const units = SOURCE.split('\n').map((text, index) => ({
      factId: snapshot.requiredFactIds[index], text,
    }));
    const response = {
      ok: true as const,
      action: 'experience_v3_enhance' as const,
      providerOutput: {
        operationId: snapshot.operationId, entryId: snapshot.entryId,
        snapshotHash: snapshot.manifest.snapshotHash, locale: 'de', units,
      },
      candidate: {
        operationId: snapshot.operationId, candidateId: 'm8-candidate',
        operationKind: 'experience_enhance' as const, targetLocale: 'de',
        sourceSnapshotHash: snapshot.manifest.snapshotHash,
        text: units.map((unit) => `• ${unit.text}`).join('\n'),
        units: units.map((unit, index) => ({
          unitId: `unit-${index + 1}`, entryId: snapshot.entryId, text: unit.text,
          factIds: [unit.factId],
        })),
      },
      validation: {} as never,
      materiality: {
        status: 'material' as const, kind: 'professional_phrasing' as const,
        sourceEquivalent: false as const, degradationDetected: false as const,
      },
    };
    let writes = 0;
    let usage = 8;
    const result = applyExperienceV3EnhanceTransaction(snapshot, response, {
      getLiveState: () => ({
        cv, requestedLocale: 'de', uiLocale: 'de', storedContentLocale: 'de',
        exactVisibleDescription: SOURCE, industry: 'engineering', level: 'mid', jobContextHash: 'm8-job',
      }),
      getActiveOperationId: () => 'm8-op',
      writeCv: () => { writes += 1; },
      persistCv: () => true,
      incrementUsage: () => { usage += 1; },
    });
    expect(result).toEqual({ kind: 'handled_failure', typedReason: 'no_material_improvement' });
    expect(writes).toBe(0);
    expect(usage).toBe(8);
  });

  it('C3: server rejects source-equivalent output even when evaluator says material', async () => {
    const cv: CVData = {
      id: 'm8-server-cv', name: 'M8',
      personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Techniker', gender: '' },
      summary: '', contentLocale: 'de',
      experience: [{
        id: 'm8-server-entry', company: 'Example', position: 'Techniker',
        startDate: '2024-01', endDate: '', isPresent: true, description: SOURCE,
      }],
      education: [], skills: [], certifications: [], languages: [],
      templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
    };
    const snapshot = captureExperienceV3EnhanceOperationSnapshot({
      enabled: true, operationKind: 'experience_enhance', operationId: 'm8-server-op', requestId: 'm8-server-op',
      entryId: 'm8-server-entry', entryIndexDiagnostic: 0, cv, industry: 'engineering', level: 'mid', gender: '',
      requestedLocale: 'de', uiLocale: 'de', storedContentLocale: 'de', exactVisibleDescription: SOURCE,
      jobContextHash: 'm8-server-job', usageCountBefore: 8,
    });
    const units = SOURCE.split('\n').map((text, index) => ({
      factId: snapshot.requiredFactIds[index], text,
    }));
    const writerResponse = {
      stopReason: 'tool_use',
      content: [{
        type: 'tool_use', name: EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME,
        input: {
          operationId: snapshot.operationId, entryId: snapshot.entryId,
          snapshotHash: snapshot.manifest.snapshotHash, locale: 'de', units,
        },
      }],
    } as never;
    const evaluatorResponse = {
      stopReason: 'tool_use',
      content: [{
        type: 'tool_use', name: EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME,
        input: {
          operationId: snapshot.operationId, entryId: snapshot.entryId,
          snapshotHash: snapshot.manifest.snapshotHash, locale: 'de',
          phases: {
            semantic: { status: 'passed', violations: [] },
            language_quality: { status: 'passed', violations: [] },
          },
          materiality: {
            status: 'material', kind: 'professional_phrasing',
            sourceEquivalent: false, degradationDetected: false,
          },
        },
      }],
    } as never;
    const result = await executeExperienceV3EnhanceServer(
      { manifest: snapshot.manifest },
      { generate: async () => writerResponse, evaluate: async () => evaluatorResponse },
    );
    expect(result).toMatchObject({ ok: false, typedReason: 'no_material_improvement' });
  });

  it('D: accepts a genuinely grounded enhancement', () => {
    expect(noApply(IMPROVED)).toMatchObject({
      sourceEquivalentToAuthoritativeSource: false,
      materialImprovementDetected: true,
      finalDecisionKind: 'material_improvement',
      shouldApply: true,
      shouldIncrementUsage: true,
    });
  });

  it('E: preserves visible-text no-op protection as a separate canonical input', () => {
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: true,
      sourceEquivalentToAuthoritativeSource: false,
      semanticNoOpDetected: true,
      semanticNoOpReason: 'semantic_equivalent_visible',
      materialImprovementDetected: false,
      materialImprovementKinds: [],
    });
    expect(decision).toMatchObject({
      semanticNoOpDetected: true,
      finalDecisionKind: 'semantic_noop',
      shouldApply: false,
      shouldIncrementUsage: false,
    });
  });

  it('E2: authoritative source echo overrides a visible-text difference', () => {
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: true,
      sourceEquivalentToAuthoritativeSource: true,
      semanticNoOpDetected: false,
      materialImprovementDetected: true,
      materialImprovementKinds: ['grounded_phrasing_enhancement'],
    });
    expect(decision).toMatchObject({
      sourceEquivalentToAuthoritativeSource: true,
      semanticNoOpDetected: true,
      materialImprovementDetected: false,
      finalDecisionKind: 'semantic_noop',
      shouldApply: false,
      shouldIncrementUsage: false,
    });
  });

  it('F: keeps authoritative source provenance distinct from generated content', () => {
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: 'Generated visible text.',
      canonicalText: SOURCE,
      originalText: SOURCE,
      authoritativeTextOverride: SOURCE,
      provenanceOriginOverride: 'originalUserDescription',
      visibleComparisonProvenance: 'ai_generated_unedited',
      locale: 'de',
      requestId: 'm8-source-echo',
      jobContextHash: 'm8-context',
      experienceEntryId: 'm8-entry',
    });
    expect(snapshot.provenanceOrigin).toBe('originalUserDescription');
    expect(snapshot.authoritativeRawText).toBe(SOURCE);
    expect(snapshot.visibleComparisonRawText).toBe('Generated visible text.');
    expect(experienceAiSourcesEquivalent(snapshot.authoritativeRawText, SOURCE)).toBe(true);
  });

  it('G: diagnostics cannot claim material improvement for equal normalized units', () => {
    const decision = noApply('1. Wartung an elektrischen Anlagen machen.\n\n* Störungen suchen und beheben.\n• Bei der Installation von elektrischen Komponenten helfen.');
    expect(decision.sourceEquivalentToAuthoritativeSource).toBe(true);
    expect(decision.materialImprovementDetected).toBe(false);
    expect(decision.finalDecisionKind).not.toBe('material_improvement');
  });

  it('H: usage authorization is transactional with the canonical decision', () => {
    const rejected = noApply(SOURCE);
    const accepted = noApply(IMPROVED);
    let usage = 8;
    if (rejected.shouldIncrementUsage) usage += 1;
    expect(usage).toBe(8);
    if (accepted.shouldIncrementUsage) usage += 1;
    expect(usage).toBe(9);
  });

  it('I: terminal source-echo truth follows the canonical no-op outcome', async () => {
    const run = await runTerminalDiagnostic(SOURCE.split('\n'));
    expect(run.result.kind).toBe('handled_failure');
    if (run.result.kind !== 'handled_failure') return;
    expect(run.result.diagnostic).toMatchObject({
      rawResponseAccepted: true,
      sourceEquivalentToAuthoritativeSource: true,
      materialImprovementDetected: false,
      finalDecisionKind: 'semantic_noop',
      canonicalDecisionAllowsApply: false,
      canonicalDecisionAllowsUsage: false,
      applyAuthorized: false,
      applyAttempted: false,
      applyCommitted: false,
      persistenceResult: 'not_attempted',
      usageBefore: 8,
      usageAfter: 8,
      usageDelta: 0,
      finalDecision: 'reject',
      rejectionReasonCodes: ['no_material_improvement'],
    });
  });

  it('J: terminal genuine enhancement truth records one committed transaction', async () => {
    const run = await runTerminalDiagnostic(IMPROVED.split('\n'));
    expect(run.result.kind).toBe('handled_success');
    if (run.result.kind !== 'handled_success') return;
    expect(run.result.diagnostic).toMatchObject({
      rawResponseAccepted: true,
      sourceEquivalentToAuthoritativeSource: false,
      materialImprovementDetected: true,
      finalDecisionKind: 'material_improvement',
      canonicalDecisionAllowsApply: true,
      canonicalDecisionAllowsUsage: true,
      applyAuthorized: true,
      applyAttempted: true,
      applyCommitted: true,
      persistenceResult: 'succeeded',
      usageBefore: 8,
      usageAfter: 9,
      usageDelta: 1,
      finalDecision: 'accept',
      rejectionReasonCodes: [],
    });
  });

  it('K: raw acceptance is explicit and may coexist with canonical no-op rejection', async () => {
    const run = await runTerminalDiagnostic(SOURCE.split('\n'));
    expect(run.result.kind).toBe('handled_failure');
    if (run.result.kind !== 'handled_failure') return;
    expect(run.result.diagnostic.rawResponseAccepted).toBe(true);
    expect(run.result.diagnostic.finalDecision).toBe('reject');
    expect(run.result.diagnostic.finalDecisionKind).toBe('semantic_noop');
    expect(run.result.diagnostic.persistenceResult).toBe('not_attempted');
  });

  it('L: canonical source echo performs no write, persistence, or usage side effect', async () => {
    const run = await runTerminalDiagnostic(SOURCE.split('\n'));
    expect([run.writeCount, run.persistCount, run.usage]).toEqual([0, 0, 8]);
  });

  it('M: exact echo marked grammar correction remains a semantic no-op', () => {
    expect(decideExperienceV3EnhanceCanonicalCandidate({
      sourceText: 'supports customers.\nkeeps records.',
      candidateText: 'supports customers.\nkeeps records.',
      materialityKind: 'grammar_correction',
    })).toMatchObject({
      sourceComparisonClass: 'EXACT_OR_FORMATTING_EQUIVALENT',
      finalDecisionKind: 'semantic_noop', shouldApply: false, shouldIncrementUsage: false,
    });
  });

  it('N: formatting-only grammar correction remains a no-op', () => {
    expect(decideExperienceV3EnhanceCanonicalCandidate({
      sourceText: 'supports customers.\nkeeps records.',
      candidateText: '• supports customers.\n  - keeps records.',
      materialityKind: 'grammar_correction',
    })).toMatchObject({
      sourceComparisonClass: 'EXACT_OR_FORMATTING_EQUIVALENT',
      finalDecisionKind: 'semantic_noop', shouldApply: false, shouldIncrementUsage: false,
    });
  });

  it('O: punctuation-only grammar correction remains a no-op', () => {
    expect(decideExperienceV3EnhanceCanonicalCandidate({
      sourceText: 'supports customers.\nkeeps records.',
      candidateText: 'supports customers!\nkeeps records?',
      materialityKind: 'grammar_correction',
    })).toMatchObject({
      sourceComparisonClass: 'PUNCTUATION_ONLY_EQUIVALENT',
      finalDecisionKind: 'semantic_noop', shouldApply: false, shouldIncrementUsage: false,
    });
  });

  it('P: genuine case-only grammar correction is accepted by the adapter', async () => {
    const decision = decideExperienceV3EnhanceCanonicalCandidate({
      sourceText: 'supports customers.\nkeeps records.',
      candidateText: 'Supports customers.\nKeeps records.',
      materialityKind: 'grammar_correction',
    });
    expect(decision).toMatchObject({
      sourceComparisonClass: 'CASE_ONLY_DIFFERENCE',
      sourceEquivalentToAuthoritativeSource: true,
      finalDecisionKind: 'material_improvement', shouldApply: true, shouldIncrementUsage: true,
    });
    const grammarSource = 'supports customers.\nkeeps records.';
    const run = await runTerminalDiagnostic(['Supports customers.', 'Keeps records.'], 'grammar_correction', grammarSource);
    expect(run.result.kind).toBe('handled_success');
  });

  it('Q: case-only professional phrasing remains a semantic no-op', () => {
    expect(decideExperienceV3EnhanceCanonicalCandidate({
      sourceText: 'supports customers.\nkeeps records.',
      candidateText: 'Supports customers.\nKeeps records.',
      materialityKind: 'professional_phrasing',
    })).toMatchObject({
      sourceComparisonClass: 'CASE_ONLY_DIFFERENCE',
      finalDecisionKind: 'semantic_noop', shouldApply: false, shouldIncrementUsage: false,
    });
  });

  it('R: the physical AAB586 German source echo remains blocked', async () => {
    const run = await runTerminalDiagnostic(SOURCE.split('\n'));
    expect([run.result.kind, run.writeCount, run.persistCount, run.usage])
      .toEqual(['handled_failure', 0, 0, 8]);
  });

  it('S: terminal grammar-correction truth records one accepted transaction', async () => {
    const grammarSource = 'supports customers.\nkeeps records.';
    const run = await runTerminalDiagnostic(['Supports customers.', 'Keeps records.'], 'grammar_correction', grammarSource);
    expect(run.result).toMatchObject({ kind: 'handled_success' });
    if (run.result.kind !== 'handled_success') return;
    expect(run.result.diagnostic).toMatchObject({
      rawResponseAccepted: true,
      sourceComparisonClass: 'CASE_ONLY_DIFFERENCE',
      finalDecision: 'accept', finalDecisionKind: 'material_improvement',
      canonicalDecisionAllowsApply: true, canonicalDecisionAllowsUsage: true,
      applyCommitted: true, persistenceResult: 'succeeded', usageBefore: 8, usageAfter: 9,
    });
  });

  it('T: terminal exact-source truth remains a rejected zero-usage transaction', async () => {
    const run = await runTerminalDiagnostic(SOURCE.split('\n'), 'grammar_correction');
    expect(run.result).toMatchObject({ kind: 'handled_failure' });
    if (run.result.kind !== 'handled_failure') return;
    expect(run.result.diagnostic).toMatchObject({
      sourceComparisonClass: 'EXACT_OR_FORMATTING_EQUIVALENT',
      finalDecision: 'reject', finalDecisionKind: 'semantic_noop',
      applyCommitted: false, persistenceResult: 'not_attempted', usageBefore: 8, usageAfter: 8,
    });
  });

  it('U: visible improvement vocabulary is not a V3 materiality value', () => {
    expect(isExperienceV3EnhanceMaterialityKind('grammar_correction')).toBe(true);
    expect(isExperienceV3EnhanceMaterialityKind('grammar_error_fixed')).toBe(false);
    expect(isExperienceV3EnhanceMaterialityKind('grounded_phrasing_enhancement')).toBe(false);
    expect(isExperienceV3EnhanceMaterialityKind(null)).toBe(false);
  });

  it('V: normal no-op keeps policy, observation, and increment side effect distinct', async () => {
    const run = await runTerminalDiagnostic(
      SOURCE.split('\n'),
      'professional_phrasing',
      SOURCE,
      { usageCountBefore: 7 },
    );
    expect(run.usageIncrementCalls).toBe(0);
    expect(run.result).toMatchObject({ kind: 'handled_failure' });
    if (run.result.kind !== 'handled_failure') return;
    expect(run.result.diagnostic).toMatchObject({
      applyCommitted: false,
      canonicalDecisionAllowsUsage: false,
      usageBefore: 7,
      usageAfter: 7,
      usageDelta: 0,
      usageMeasurementStatus: 'observed',
      observedUsageAfter: 7,
      observedUsageDelta: 0,
      usageAfterBasis: 'observed',
      usageIncrementAttempted: false,
    });
  });

  it('W: rejected no-op preserves an unexpected observed global counter change without attribution', async () => {
    const run = await runTerminalDiagnostic(
      SOURCE.split('\n'),
      'professional_phrasing',
      SOURCE,
      { usageCountBefore: 7, observedUsageAtStart: 8 },
    );
    expect([run.usage, run.usageIncrementCalls]).toEqual([8, 0]);
    expect(run.result).toMatchObject({ kind: 'handled_failure' });
    if (run.result.kind !== 'handled_failure') return;
    expect(run.result.diagnostic).toMatchObject({
      applyCommitted: false,
      canonicalDecisionAllowsUsage: false,
      usageBefore: 7,
      usageAfter: 8,
      usageDelta: 1,
      usageMeasurementStatus: 'observed',
      observedUsageAfter: 8,
      observedUsageDelta: 1,
      usageAfterBasis: 'observed',
      usageIncrementAttempted: false,
    });
  });

  it('X: genuine enhancement commits and invokes the usage owner exactly once', async () => {
    const run = await runTerminalDiagnostic(
      IMPROVED.split('\n'),
      'professional_phrasing',
      SOURCE,
      { usageCountBefore: 7 },
    );
    expect([run.writeCount, run.persistCount, run.usageIncrementCalls, run.usage])
      .toEqual([1, 1, 1, 8]);
    expect(run.result).toMatchObject({ kind: 'handled_success' });
    if (run.result.kind !== 'handled_success') return;
    expect(run.result.diagnostic).toMatchObject({
      applyCommitted: true,
      canonicalDecisionAllowsUsage: true,
      usageBefore: 7,
      usageAfter: 8,
      observedUsageAfter: 8,
      observedUsageDelta: 1,
      usageMeasurementStatus: 'observed',
      usageIncrementAttempted: true,
    });
  });

  it.each([
    ['missing', 'reader_unavailable'],
    ['throwing', 'reader_threw'],
  ] as const)(
    'Y: %s counter reader is explicit and does not synthesize a measured delta',
    async (usageReader, failureReason) => {
      const run = await runTerminalDiagnostic(
        IMPROVED.split('\n'),
        'professional_phrasing',
        SOURCE,
        { usageCountBefore: 7, usageReader },
      );
      expect([run.usageIncrementCalls, run.usage]).toEqual([1, 8]);
      expect(run.result).toMatchObject({ kind: 'handled_success' });
      if (run.result.kind !== 'handled_success') return;
      expect(run.result.diagnostic).toMatchObject({
        canonicalDecisionAllowsUsage: true,
        usageIncrementAttempted: true,
        usageMeasurementStatus: 'unavailable',
        observedUsageAfter: null,
        observedUsageDelta: null,
        usageMeasurementFailureReason: failureReason,
        usageAfterBasis: 'compatibility_unmeasured_before',
        usageAfter: 7,
        usageDelta: 0,
      });
    },
  );

  it('Z: real legacy finalizer rejects controlled 2/3 coverage and source-echo fallback without a billable apply', () => {
    const controlledVisibleAi = IMPROVED;
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'legacy-source-echo-entry',
      appliedOutput: controlledVisibleAi,
      preAiFactText: SOURCE,
      sourceLocale: 'de',
      targetLocale: 'de',
      operationMode: 'enhance',
      sourceAuthorityKind: 'original_user',
      requestHash: 'controlled-legacy-source-echo',
      appliedAt: '2026-09-15T00:00:00.000Z',
    });
    const cv: CVData = {
      id: 'legacy-source-echo-cv', name: 'Controlled legacy regression',
      personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Elektroservicetechniker', gender: 'male' },
      summary: '', contentLocale: 'de',
      experience: [{
        id: 'legacy-source-echo-entry', company: 'Controlled Fixture GmbH',
        position: 'Elektroservicetechniker', startDate: '2024-01', endDate: '', isPresent: true,
        description: controlledVisibleAi, generatedDescription: controlledVisibleAi,
        generatedLocale: 'de', canonicalDescription: SOURCE, originalUserDescription: SOURCE,
        descriptionOrigin: 'ai_generated', aiOutputProvenance: provenance,
      }],
      education: [], skills: [], certifications: [], languages: [],
      templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
    };
    expect(resolveExperienceTextareaProvenance(cv.experience[0]!))
      .toMatchObject({ currentTextareaProvenance: 'ai_generated_unedited' });
    const operationSnapshot = createExperienceAiOperationSnapshot({
      liveText: controlledVisibleAi,
      canonicalText: SOURCE,
      originalText: SOURCE,
      authoritativeTextOverride: SOURCE,
      provenanceOriginOverride: 'originalUserDescription',
      visibleComparisonProvenance: 'ai_generated_unedited',
      locale: 'de', requestId: 'controlled-legacy-request',
      jobContextHash: 'controlled-legacy-job', experienceEntryId: 'legacy-source-echo-entry',
    });
    const controlledTwoOfThreeProvider = SOURCE.split('\n').slice(0, 2).join('\n');
    const provider = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description', requestedLocale: 'de',
      gender: 'male', cv, candidate: controlledTwoOfThreeProvider,
      originHint: 'ai_generated', experienceId: 'legacy-source-echo-entry',
      operationSnapshot, jobContextHash: 'controlled-legacy-job',
    });
    expect(provider.diagnostics).toMatchObject({
      providerRequiredFactCount: 3,
      providerCoveredFactCount: 2,
      providerAccepted: false,
    });
    expect(provider.countedAsSuccess).toBe(false);

    const fallback = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description', requestedLocale: 'de',
      gender: 'male', cv, candidate: SOURCE, originHint: 'deterministic_fallback',
      experienceId: 'legacy-source-echo-entry', operationSnapshot,
      jobContextHash: 'controlled-legacy-job',
    });
    const afterApply = applyFinalizedBulletsToCv(
      cv,
      'de',
      'legacy-source-echo-entry',
      fallback,
    );
    let usage = 7;
    let usageIncrementCalls = 0;
    if (fallback.countedAsSuccess) {
      usageIncrementCalls += 1;
      usage += 1;
    }
    expect(fallback).toMatchObject({ countedAsSuccess: false });
    expect(fallback.diagnostics).not.toMatchObject({ finalDecisionKind: 'material_improvement' });
    expect(afterApply).toBe(cv);
    expect(afterApply.experience[0]?.description).toBe(controlledVisibleAi);
    expect([usageIncrementCalls, usage]).toEqual([0, 7]);
  });
});
