import Ajv from 'ajv';
import { describe, expect, it, vi } from 'vitest';
import { applyCvContentQuality } from '../../cv-content-quality';
import { omitInvalidLocalizedFieldsForPreview } from '../../cv-field-locale-integrity';
import { normalizeLegacyCvRuntime } from '../../cv-legacy-runtime-migration';
import type { CVData } from '../../types';
import {
  SUMMARY_V3_GENERATE_ACTION,
  applySummaryV3GenerateTransaction,
  captureSummaryV3GenerateOperationSnapshot,
  classifySummaryV3GenerateRouting,
  executeSummaryV3GenerateServer,
  classifySummaryV3ProviderFailure,
  createSummaryV3ProviderTransportError,
  hashSummaryV3Value,
  parseSummaryV3EvaluatorToolResponse,
  parseSummaryV3WriterToolResponse,
  parseSummaryV3GenerateRequest,
  projectSummaryV3ImmediatePreviewModel,
  runSummaryV3GenerateAdapter,
  type SummaryV3GenerateAdapterInput,
  type SummaryV3GenerateSuccessResponse,
  type SummaryV3Manifest,
  type SummaryV3WriterOutput,
  SUMMARY_V3_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_WRITER_TOOL,
  SUMMARY_V3_WRITER_TOOL_NAME,
  SUMMARY_V3_WRITER_UNIT_CONTRACT,
  buildSummaryV3RepairPrompt,
  buildSummaryV3WriterPrompt,
} from '..';
import { M4_SUMMARY_GENERATE_DEVICE_OBSERVATION } from '../fixtures/m4-summary-generate-device-observation';
import { M4_SUMMARY_GENERATE_AAB545_OBSERVATION } from '../fixtures/m4-summary-generate-aab545-observation';
import { M4_SUMMARY_GENERATE_AAB546_OBSERVATION } from '../fixtures/m4-summary-generate-aab546-observation';
import { M4_SUMMARY_GENERATE_AAB547_TIMEOUT_OBSERVATION } from '../fixtures/m4-summary-generate-aab547-timeout-observation';
import { M4_SUMMARY_GENERATE_AAB548_WRITER_SCHEMA_OBSERVATION } from '../fixtures/m4-summary-generate-aab548-writer-schema-observation';
import { M4_SUMMARY_GENERATE_AAB549_DURATION_OBSERVATION } from '../fixtures/m4-summary-generate-aab549-duration-observation';
import { M4_SUMMARY_GENERATE_AAB550_STRICT_SCHEMA_OBSERVATION } from '../fixtures/m4-summary-generate-aab550-strict-schema-observation';
import { M4_SUMMARY_GENERATE_AAB551_INITIAL_EVALUATOR_TIMEOUT_OBSERVATION } from '../fixtures/m4-summary-generate-aab551-initial-evaluator-timeout-observation';
import { SummaryAiDiagnosticSession, formatSummaryAiDiagnosticForCopy } from '../../cv-summary-ai-diagnostics';
import { AI_PROVIDER_CALL_TIMEOUT_MS, callProviderWithDeadline } from '../../ai-request-timing';

function cv(): CVData {
  return {
    id: 'm4-cv', name: 'M4 CV',
    personal: { fullName: 'Ana Example', email: 'ana@example.com', phone: '', address: '', jobTitle: 'Engineer', gender: 'female' },
    summary: '', contentLocale: 'en', summaryOrigin: 'user', canonicalSummary: 'STALE SUMMARY MUST NEVER BE AUTHORITY',
    experience: [
      { id: 'prior-id', company: 'Prior Co', position: 'Analyst', startDate: '2020-01', endDate: '2023-01', isPresent: false,
        description: 'Analyzed operational records.\nPrepared weekly reports.', generatedDescription: 'STALE GENERATED',
        canonicalDescription: 'STALE CANONICAL', originalUserDescription: 'STALE ORIGINAL' },
      { id: 'current-id', company: 'Current Co', position: 'Engineer', startDate: '2023-02', endDate: '', isPresent: true,
        description: 'Designs reliable systems.\nReviews production changes.', generatedDescription: 'OLDER PROVIDER' },
    ],
    education: [{ id: 'edu-1', degree: 'BSc Engineering', school: 'Example University', startDate: '', endDate: '', description: '' }],
    skills: ['TypeScript', 'Reliability'], certifications: [], languages: [{ name: 'English', level: 'fluent' }],
    templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
  };
}

function input(overrides: Partial<SummaryV3GenerateAdapterInput> = {}): SummaryV3GenerateAdapterInput {
  return {
    enabled: true, operationKind: 'summary_generate', operationId: 'm4-operation', requestId: 'm4-request',
    cv: cv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
    referenceDateIso: '2026-08-28', jobContextHash: 'context-m4', usageCountBefore: 4,
    ...overrides,
  };
}

function snapshot(overrides: Partial<SummaryV3GenerateAdapterInput> = {}) {
  return captureSummaryV3GenerateOperationSnapshot(input(overrides));
}

function physicalShapeSnapshot() {
  const data = cv();
  data.experience = [{
    ...data.experience[1],
    description: 'Maintains systems.\nReviews changes.\nDocuments results.',
  }];
  return snapshot({ cv: data, requestedLocale: 'de', uiLocale: 'de', storedContentLocale: 'de' });
}

function output(manifest: SummaryV3Manifest, suffix = ''): SummaryV3WriterOutput {
  return {
    operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
    units: [
      { slot: 'duration', entryId: null, factIds: [], text: `I have approximately six and a half years of professional experience${suffix}.` },
      ...manifest.selectedEntries.map((entry) => ({
        slot: 'experience' as const, entryId: entry.entryId, factIds: entry.facts.map((fact) => fact.factId),
        text: entry.employmentState === 'present'
          ? `I currently work as ${entry.roleTitle} at ${entry.employer}. I design reliable systems and review production changes.`
          : `Previously, I worked as ${entry.roleTitle} at ${entry.employer}. I analyzed operational records and prepared weekly reports.`,
      })),
    ],
  };
}

function writerJson(manifest: SummaryV3Manifest, suffix = ''): string {
  return JSON.stringify(output(manifest, suffix));
}

function evaluatorJson(manifest: SummaryV3Manifest, category?: 'semantic' | 'language_quality', code = 'rejected'): string {
  const phase = (name: 'semantic' | 'language_quality') => category === name
    ? { status: 'failed', violations: [{ code, category: name, detail: `${code} evidence` }] }
    : { status: 'passed', violations: [] };
  return JSON.stringify({ operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash,
    locale: manifest.targetLocale, phases: { semantic: phase('semantic'), language_quality: phase('language_quality') },
    checks: {
      factRetention: !category, entryOwnership: !category, currentPriorSeparation: !category,
      unsupportedClaimsAbsent: !category, roleEmployerStateAccurate: !category,
      durationMeaningAndScope: !category, optionalAuthorityRespected: !category,
      targetLanguageAndScript: !category, firstPersonPerspective: !category,
      currentRoleTense: !category, priorRoleTense: !category, grammarAndClarity: !category,
      duplicationAndDegradationAbsent: !category, completeSummaryUsable: !category,
    } });
}

function writerResponse(manifest: SummaryV3Manifest, suffix = '') {
  return {
    stopReason: 'tool_use',
    content: [{ type: 'tool_use' as const, name: SUMMARY_V3_WRITER_TOOL_NAME, input: output(manifest, suffix) }],
  };
}

function evaluatorResponse(manifest: SummaryV3Manifest, category?: 'semantic' | 'language_quality', code = 'rejected') {
  return {
    stopReason: 'tool_use',
    content: [{ type: 'tool_use' as const, name: SUMMARY_V3_EVALUATOR_TOOL_NAME,
      input: JSON.parse(evaluatorJson(manifest, category, code)) }],
  };
}

async function accepted(manifest = snapshot().manifest): Promise<SummaryV3GenerateSuccessResponse> {
  const result = await executeSummaryV3GenerateServer({ manifest }, {
    write: vi.fn(async () => writerResponse(manifest)), evaluate: vi.fn(async () => evaluatorResponse(manifest)),
  });
  if (!result.ok) throw new Error(result.typedReason);
  return result;
}

function mutableManifest(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(snapshot().manifest)) as Record<string, unknown>;
}

describe('M4 source authority and manifest', () => {
  it('1. exact empty visible Summary is selected as operation authority', () => {
    const captured = snapshot();
    expect(captured.exactVisibleSummary).toBe('');
    expect(captured.rawSummarySourceHash).toBe(hashSummaryV3Value(''));
  });

  it('2. stale cvRef, persisted, canonical, and previous-provider Summary text is excluded', () => {
    const captured = snapshot();
    expect(JSON.stringify(captured.manifest)).not.toContain('STALE SUMMARY');
    expect(captured.manifest.selectedEntries.flatMap((entry) => entry.sourceUnits)).not.toContain('OLDER PROVIDER');
  });

  it('3. mounted Experience textarea wins over lagging committed state', () => {
    const captured = snapshot({ visibleExperienceSources: { 'current-id': 'Mounted current source.', 'prior-id': 'Mounted prior source.' } });
    expect(captured.manifest.selectedEntries.find((entry) => entry.entryId === 'current-id')?.exactSourceDescription).toBe('Mounted current source.');
    expect(captured.manifest.selectedEntries.every((entry) => entry.sourceKind === 'mounted_textarea')).toBe(true);
  });

  it('4. committed cvRef Experience description is used when textarea is not mounted', () => {
    const entry = snapshot().manifest.selectedEntries.find((item) => item.entryId === 'current-id');
    expect(entry?.sourceKind).toBe('committed_cv_ref');
    expect(entry?.exactSourceDescription).toBe('Designs reliable systems.\nReviews production changes.');
  });

  it('5. generated, canonical, and original Experience alternatives cannot override live authority', () => {
    const serialized = JSON.stringify(snapshot().manifest);
    expect(serialized).not.toContain('STALE GENERATED');
    expect(serialized).not.toContain('STALE CANONICAL');
    expect(serialized).not.toContain('STALE ORIGINAL');
  });

  it('6. selected source kind and hash are recorded per stable entry', () => {
    for (const entry of snapshot().manifest.selectedEntries) {
      expect(entry.entryId).toMatch(/-id$/u);
      expect(entry.sourceKind).toBe('committed_cv_ref');
      expect(entry.sourceHash).toBe(hashSummaryV3Value(entry.exactSourceDescription));
    }
  });

  it('7. stable IDs are authority and array index is diagnostic only', () => {
    const captured = snapshot();
    expect(captured.selectedEntryIds).toEqual(['current-id', 'prior-id']);
    expect(captured.manifest.selectedEntries.map((entry) => entry.indexDiagnostic)).toEqual([1, 0]);
  });

  it('8. snapshot and every nested manifest record are deeply immutable', () => {
    const captured = snapshot();
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.manifest.selectedEntries[0].facts)).toBe(true);
    expect(Object.isFrozen(captured.manifest.skillAuthorities[0])).toBe(true);
  });

  it('9. current role resolves from structured present state rather than array order', () => {
    expect(snapshot().currentRoleEntryId).toBe('current-id');
    expect(snapshot().currentRoleResolutionEvidence).toContain('present:current-id');
  });

  it('10. missing current role fails closed', () => {
    const data = cv(); data.experience.forEach((entry) => { entry.isPresent = false; });
    expect(classifySummaryV3GenerateRouting(input({ cv: data }))).toBe('not_applicable');
  });

  it('11. multiple current roles fail closed', () => {
    const data = cv(); data.experience.forEach((entry) => { entry.isPresent = true; entry.endDate = ''; entry.startDate = '2023-02'; });
    expect(classifySummaryV3GenerateRouting(input({ cv: data }))).toBe('not_applicable');
  });

  it('12. malformed structured dates fail closed', () => {
    const data = cv(); data.experience[0].startDate = 'not-a-date';
    expect(classifySummaryV3GenerateRouting(input({ cv: data }))).toBe('not_applicable');
  });

  it('13. structured total duration is calculated from selected entries', () => {
    expect(snapshot().structuredTotalDurationMonths).toBeGreaterThan(70);
    expect(snapshot().manifest.structuredTotalDurationMonths).toBe(snapshot().structuredTotalDurationMonths);
  });

  it('14. explicit skills, education, and languages own IDs and hashes', () => {
    const manifest = snapshot().manifest;
    expect(manifest.skillAuthorities).toHaveLength(2);
    expect(manifest.educationAuthorities[0].id).toContain('education:1:');
    expect(manifest.languageAuthorities[0].hash).toBe(hashSummaryV3Value('English — fluent'));
  });

  it('15. every non-empty source unit owns one stable required fact ID', () => {
    for (const entry of snapshot().manifest.selectedEntries) {
      expect(entry.facts).toHaveLength(entry.sourceUnits.length);
      expect(entry.facts.every((fact) => fact.required && fact.factId.includes(entry.entryId))).toBe(true);
    }
  });
});

describe('M4 exact routing', () => {
  it.each([
    ['flag disabled', { enabled: false }],
    ['non-empty Summary', { exactVisibleSummary: 'User text' }],
    ['Stronger operation', { operationKind: 'summary_stronger' }],
    ['Professional operation', { operationKind: 'summary_professional' }],
    ['Shorter operation', { operationKind: 'summary_shorter' }],
    ['cross-locale UI', { uiLocale: 'de' }],
    ['cross-locale stored content', { storedContentLocale: 'de' }],
  ])('16-22. %s is not applicable and remains V2-owned', (_name, override) => {
    expect(classifySummaryV3GenerateRouting(input(override as Partial<SummaryV3GenerateAdapterInput>))).toBe('not_applicable');
  });

  it('23. enabled empty same-locale general Summary Generate is M4-owned', () => {
    expect(classifySummaryV3GenerateRouting(input())).toBe('owned');
  });
});

describe('M4 strict writer, evaluator, and repair server', () => {
  it('24. a complete request parses and preserves immutable manifest identity', () => {
    const manifest = snapshot().manifest;
    const parsed = parseSummaryV3GenerateRequest({ manifest });
    expect(parsed?.manifestHash).toBe(manifest.manifestHash);
    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it.each([
    ['foreign manifest field', (m: Record<string, unknown>) => { m.foreign = true; }],
    ['wrong operation kind', (m: Record<string, unknown>) => { m.operationKind = 'summary_stronger'; }],
    ['wrong source locale', (m: Record<string, unknown>) => { m.sourceLocale = 'de'; }],
    ['wrong manifest hash', (m: Record<string, unknown>) => { m.manifestHash = 'wrong'; }],
  ])('25-28. request parser rejects %s', (_name, mutate) => {
    const manifest = mutableManifest(); mutate(manifest);
    expect(parseSummaryV3GenerateRequest({ manifest })).toBeNull();
  });

  it('29. strict writer accepts exactly one duration and ordered owned Experience units', () => {
    const manifest = snapshot().manifest;
    const parsed = parseSummaryV3WriterToolResponse(writerResponse(manifest), manifest);
    expect(parsed.ok && parsed.value.units).toHaveLength(3);
  });

  it.each([
    ['malformed JSON', () => '{'],
    ['markdown wrapper', (m: SummaryV3Manifest) => `\`\`\`${writerJson(m)}\`\`\``],
    ['wrong operation ID', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), operationId: 'wrong' })],
    ['wrong snapshot hash', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), snapshotHash: 'wrong' })],
    ['wrong locale', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), locale: 'de' })],
    ['missing duration', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), units: output(m).units.slice(1) })],
    ['duplicate duration', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), units: [output(m).units[0], ...output(m).units] })],
    ['foreign entry ID', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), units: output(m).units.map((u, i) => i === 1 ? { ...u, entryId: 'foreign' } : u) })],
    ['missing fact ID', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), units: output(m).units.map((u, i) => i === 1 ? { ...u, factIds: [] } : u) })],
    ['fact ID under wrong entry', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), units: output(m).units.map((u, i) => i === 1 ? { ...u, factIds: output(m).units[2].factIds } : u) })],
    ['heading prose', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), units: output(m).units.map((u, i) => i === 0 ? { ...u, text: '# Summary' } : u) })],
    ['bullet prose', (m: SummaryV3Manifest) => JSON.stringify({ ...output(m), units: output(m).units.map((u, i) => i === 0 ? { ...u, text: '• Six years' } : u) })],
  ])('30-41. strict writer rejects %s', (_name, factory) => {
    const manifest = snapshot().manifest;
    const raw = factory(manifest);
    const response = typeof raw === 'string'
      ? { stopReason: 'end_turn', content: [{ type: 'text' as const, text: raw }] }
      : { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: SUMMARY_V3_WRITER_TOOL_NAME, input: raw }] };
    expect(parseSummaryV3WriterToolResponse(response, manifest).ok).toBe(false);
  });

  it('42. evaluator accepts violations-only phase evidence', () => {
    const manifest = snapshot().manifest;
    const parsed = parseSummaryV3EvaluatorToolResponse(evaluatorResponse(manifest), manifest);
    expect(parsed.ok && parsed.value.phases.semantic.status).toBe('passed');
  });

  it.each([
    ['replacement prose', { replacement: 'rewrite' }],
    ['apply authority', { apply: true }],
    ['usage authority', { incrementUsage: true }],
  ])('43-45. evaluator rejects %s', (_name, extra) => {
    const manifest = snapshot().manifest;
    const parsed = JSON.parse(evaluatorJson(manifest));
    Object.assign(parsed, extra);
    expect(parseSummaryV3EvaluatorToolResponse({ stopReason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_EVALUATOR_TOOL_NAME, input: parsed }] }, manifest).ok).toBe(false);
  });

  describe('forced structured transport seam', () => {
    it('46a. valid writer tool input preserves the existing logical output', () => {
      const manifest = snapshot().manifest;
      const result = parseSummaryV3WriterToolResponse(writerResponse(manifest), manifest);
      expect(result.ok).toBe(true);
      expect(result.ok && result.value.units).toHaveLength(3);
      expect(result.ok && result.diagnosticMetadata.toolNameMatched).toBe(true);
    });

    it.each([
      ['valid raw JSON text (pre-fix text seam)', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: writerJson(snapshot().manifest) }] }, 'writer_unexpected_text_block'],
      ['text-only JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: writerJson(snapshot().manifest) }] }, 'writer_unexpected_text_block'],
      ['fenced JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: `\`\`\`json\n${writerJson(snapshot().manifest)}\n\`\`\`` }] }, 'writer_unexpected_text_block'],
      ['commentary plus JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: `commentary\n${writerJson(snapshot().manifest)}` }] }, 'writer_unexpected_text_block'],
      ['multiple JSON objects', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: `${writerJson(snapshot().manifest)}${writerJson(snapshot().manifest)}` }] }, 'writer_unexpected_text_block'],
      ['multiple text blocks', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: 'one' }, { type: 'text' as const, text: 'two' }] }, 'writer_unexpected_text_block'],
      ['empty text', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: '' }] }, 'writer_unexpected_text_block'],
      ['truncated JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: '{"operationId"' }] }, 'writer_unexpected_text_block'],
      ['zero tool blocks', { stopReason: 'tool_use', content: [] }, 'writer_tool_missing'],
      ['multiple tool blocks', { stopReason: 'tool_use', content: [writerResponse(snapshot().manifest).content[0], writerResponse(snapshot().manifest).content[0]] }, 'writer_multiple_tools'],
      ['wrong tool', { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: 'wrong_summary_tool', input: output(snapshot().manifest) }] }, 'writer_wrong_tool'],
      ['text plus tool', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: 'commentary' }, writerResponse(snapshot().manifest).content[0]] }, 'writer_unexpected_text_block'],
      ['malformed tool input', { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: SUMMARY_V3_WRITER_TOOL_NAME, input: null }] }, 'writer_tool_input_malformed'],
      ['max_tokens', { stopReason: 'max_tokens', content: [writerResponse(snapshot().manifest).content[0]] }, 'writer_max_tokens'],
    ])('46b-46k. writer rejects %s', (_name, response, reason) => {
      const manifest = snapshot().manifest;
      const result = parseSummaryV3WriterToolResponse(response, manifest);
      expect(result).toMatchObject({ ok: false, typedReason: reason });
    });

    it('46l. writer identity mismatch is rejected without changing the schema', () => {
      const manifest = snapshot().manifest;
      const input = { ...output(manifest), operationId: 'foreign-operation' };
      const result = parseSummaryV3WriterToolResponse({ stopReason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_WRITER_TOOL_NAME, input }] }, manifest);
      expect(result).toMatchObject({ ok: false, typedReason: 'writer_identity_mismatch', diagnosticMetadata: { toolInputSchemaPassed: true, identityPassed: false } });
    });

    it.each([
      ['valid raw JSON text (pre-fix text seam)', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: evaluatorJson(snapshot().manifest) }] }, 'evaluator_unexpected_text_block'],
      ['text-only JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: evaluatorJson(snapshot().manifest) }] }, 'evaluator_unexpected_text_block'],
      ['fenced JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: `\`\`\`json\n${evaluatorJson(snapshot().manifest)}\n\`\`\`` }] }, 'evaluator_unexpected_text_block'],
      ['commentary plus JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: `commentary\n${evaluatorJson(snapshot().manifest)}` }] }, 'evaluator_unexpected_text_block'],
      ['multiple text blocks', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: 'one' }, { type: 'text' as const, text: 'two' }] }, 'evaluator_unexpected_text_block'],
      ['empty text', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: '' }] }, 'evaluator_unexpected_text_block'],
      ['truncated JSON', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: '{"operationId"' }] }, 'evaluator_unexpected_text_block'],
      ['zero tool blocks', { stopReason: 'tool_use', content: [] }, 'evaluator_tool_missing'],
      ['multiple tool blocks', { stopReason: 'tool_use', content: [evaluatorResponse(snapshot().manifest).content[0], evaluatorResponse(snapshot().manifest).content[0]] }, 'evaluator_multiple_tools'],
      ['wrong tool', { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: 'wrong_summary_validator', input: JSON.parse(evaluatorJson(snapshot().manifest)) }] }, 'evaluator_wrong_tool'],
      ['text plus tool', { stopReason: 'tool_use', content: [{ type: 'text' as const, text: 'commentary' }, evaluatorResponse(snapshot().manifest).content[0]] }, 'evaluator_unexpected_text_block'],
      ['malformed tool input', { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: SUMMARY_V3_EVALUATOR_TOOL_NAME, input: null }] }, 'evaluator_tool_input_malformed'],
      ['max_tokens', { stopReason: 'max_tokens', content: [evaluatorResponse(snapshot().manifest).content[0]] }, 'evaluator_max_tokens'],
    ])('46m-46u. evaluator rejects %s', (_name, response, reason) => {
      const manifest = snapshot().manifest;
      const result = parseSummaryV3EvaluatorToolResponse(response, manifest);
      expect(result).toMatchObject({ ok: false, typedReason: reason });
    });

    it('46v. evaluator identity mismatch is rejected without changing validation meaning', () => {
      const manifest = snapshot().manifest;
      const input = { ...JSON.parse(evaluatorJson(manifest)), locale: 'de' };
      const result = parseSummaryV3EvaluatorToolResponse({ stopReason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_EVALUATOR_TOOL_NAME, input }] }, manifest);
      expect(result).toMatchObject({ ok: false, typedReason: 'evaluator_identity_mismatch', diagnosticMetadata: { toolInputSchemaPassed: true, identityPassed: false } });
    });
  });

  it('47. structurally invalid primary invokes evaluator zero times', async () => {
    const manifest = snapshot().manifest; const evaluate = vi.fn();
    const result = await executeSummaryV3GenerateServer({ manifest }, { write: vi.fn(async () => ({ stopReason: 'tool_use', content: [] })), evaluate });
    expect(result.ok).toBe(false); expect(evaluate).toHaveBeenCalledTimes(0);
  });

  it('48. structurally valid primary invokes one writer and one independent evaluator', async () => {
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerResponse(manifest));
    const evaluate = vi.fn(async () => evaluatorResponse(manifest));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(true); expect(write).toHaveBeenCalledTimes(1); expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('48. accepted primary invokes no repair', async () => {
    expect((await accepted()).repairAttempted).toBe(false);
  });

  it('49. eligible primary rejection invokes exactly one repair writer and repair evaluator', async () => {
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerResponse(manifest, write.mock.calls.length ? ' repaired' : ''));
    const evaluate = vi.fn(async () => evaluate.mock.calls.length === 1
      ? evaluatorResponse(manifest, 'semantic', 'unsupported_metric') : evaluatorResponse(manifest));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(true); expect(write).toHaveBeenCalledTimes(2); expect(evaluate).toHaveBeenCalledTimes(2);
    expect(result.repairAttempted).toBe(true);
  });

  it('50. repair receives exact manifest, candidate, violations, and identities', async () => {
    const manifest = snapshot().manifest; const prompts: string[] = [];
    const write = vi.fn(async (prompt: string) => { prompts.push(prompt); return writerResponse(manifest, prompts.length > 1 ? ' repaired' : ''); });
    let calls = 0; const evaluate = vi.fn(async () => (++calls === 1
      ? evaluatorResponse(manifest, 'semantic', 'duration_mismatch') : evaluatorResponse(manifest, undefined)));
    await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(prompts[1]).toContain(manifest.manifestHash); expect(prompts[1]).toContain('duration_mismatch');
    expect(prompts[1]).toContain(manifest.operationId);
  });

  it('51. malformed repair invokes repair evaluator zero additional times and no third writer', async () => {
    const manifest = snapshot().manifest; let writes = 0;
    const write = vi.fn(async () => (++writes === 1 ? writerResponse(manifest) : ({ stopReason: 'tool_use', content: [{ type: 'text' as const }] })));
    const evaluate = vi.fn(async () => evaluatorResponse(manifest, 'semantic', 'unsupported_claim'));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(false); expect(write).toHaveBeenCalledTimes(2); expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('52. repair rejection stops after two writers with no deterministic or V2 fallback', async () => {
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerResponse(manifest));
    const evaluate = vi.fn(async () => evaluatorResponse(manifest, 'language_quality', 'wrong_perspective'));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(false); expect(write).toHaveBeenCalledTimes(2); expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['unsupported metric', 'unsupported_metric', 'semantic'], ['unsupported achievement', 'unsupported_achievement', 'semantic'],
    ['unsupported tool or certification', 'unsupported_tool', 'semantic'], ['unsupported leadership or scope', 'unsupported_leadership', 'semantic'],
    ['unsupported skill', 'unsupported_skill', 'semantic'], ['unsupported education', 'unsupported_education', 'semantic'],
    ['unsupported language', 'unsupported_language', 'semantic'], ['previous Summary leakage', 'previous_summary_leakage', 'semantic'],
    ['wrong language or script', 'wrong_language_script', 'language_quality'], ['mixed-language unit', 'mixed_language', 'language_quality'],
    ['wrong first-person perspective', 'wrong_perspective', 'language_quality'], ['current-role wrong tense', 'current_tense', 'language_quality'],
    ['prior-role wrong tense', 'prior_tense', 'language_quality'], ['incomplete sentence', 'fragment', 'language_quality'],
    ['German fused morphology', 'german_fused_morphology', 'language_quality'], ['Japanese malformed fixture', 'japanese_malformed', 'language_quality'],
    ['near-duplicate clauses', 'duplicate_clause', 'language_quality'], ['duration mismatch', 'duration_mismatch', 'semantic'],
    ['current-employer-only duration', 'duration_scope', 'semantic'], ['conflicting duration', 'duration_conflict', 'semantic'],
  ])('53-72. %s is rejected unless one bounded repair independently passes', async (_name, code, category) => {
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerResponse(manifest));
    const evaluate = vi.fn(async () => evaluatorResponse(manifest, category as 'semantic' | 'language_quality', code));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(false); expect(result.repairAttempted).toBe(true);
  });

  it('73. evaluator exception fails closed with validator_exception and no repair', async () => {
    const manifest = snapshot().manifest;
    const result = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => writerResponse(manifest)), evaluate: vi.fn(async () => { throw new Error('validator'); }),
    });
    expect(result).toMatchObject({ ok: false, typedReason: 'validator_exception', repairAttempted: false });
  });
});

describe('M4 transactional apply, preview, rollback, and usage', () => {
  async function harness(options: { mutateLive?: (value: CVData) => void; persist?: boolean; active?: string; previewMutation?: boolean } = {}) {
    const captured = snapshot(); const response = await accepted(captured.manifest);
    let live = cv(); options.mutateLive?.(live); let usage = 4; const writes: CVData[] = []; const events: string[] = [];
    const result = applySummaryV3GenerateTransaction(captured, response, {
      getLiveState: () => ({ cv: live, requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en',
        exactVisibleSummary: live.summary, referenceDateIso: '2026-08-28', jobContextHash: 'context-m4' }),
      getActiveOperationId: () => options.active ?? 'm4-operation',
      writeCv: (next) => { live = next; writes.push(next); events.push('write'); },
      projectPreviewSummary: (next) => options.previewMutation ? `${next.summary} mutated` : next.summary,
      persistCv: () => { events.push('persist'); return options.persist ?? true; },
      incrementUsage: () => { events.push('usage'); usage += 1; },
    });
    return { captured, response, result, live, usage, writes, events };
  }

  it('74. successful write changes only approved Summary-specific fields', async () => {
    const run = await harness();
    expect(run.result.kind).toBe('handled_success'); expect(run.live.summary).toBe(run.response.candidate.text);
    expect(run.live.summaryOrigin).toBe('ai_generated'); expect(run.live.summaryGeneratedLocale).toBe('en');
    expect(run.live.summaryGenerationContextKey).toBe('context-m4'); expect(run.live.canonicalSummary).toContain('STALE SUMMARY');
  });

  it('75. every Experience entry remains byte-identical', async () => {
    const before = cv().experience; const run = await harness();
    expect(hashSummaryV3Value(run.live.experience)).toBe(hashSummaryV3Value(before));
  });

  it('76. immediate preview model preserves accepted Summary byte-for-byte', async () => {
    const run = await harness();
    const migrated = normalizeLegacyCvRuntime(projectSummaryV3ImmediatePreviewModel(run.live), 'en');
    const quality = applyCvContentQuality(migrated, 'en', {
      gender: migrated.personal.gender,
      summaryOrigin: migrated.summaryOrigin,
    }).cv;
    const actualPreviewModel = omitInvalidLocalizedFieldsForPreview(quality, 'en');
    expect(actualPreviewModel.summary).toBe(run.response.candidate.text);
  });

  it('76b. preview semantic mutation blocks readiness, rolls back, and increments usage zero', async () => {
    const run = await harness({ previewMutation: true });
    expect(run.result).toEqual({ kind: 'handled_failure', typedReason: 'visible_readback_failed' });
    expect(hashSummaryV3Value(run.live)).toBe(hashSummaryV3Value(cv()));
    expect(run.usage).toBe(4);
  });

  it('77. persistence occurs before the only usage increment and success increments exactly once', async () => {
    const run = await harness(); expect(run.events.slice(-2)).toEqual(['persist', 'usage']); expect(run.usage).toBe(5);
  });

  it.each([
    ['superseded operation', { active: 'newer' }],
    ['Summary source race', { mutateLive: (value: CVData) => { value.summary = 'typed while pending'; } }],
    ['Experience source race', { mutateLive: (value: CVData) => { value.experience[0].description = 'edited'; } }],
    ['entry deletion', { mutateLive: (value: CVData) => { value.experience.shift(); } }],
    ['role mutation', { mutateLive: (value: CVData) => { value.experience[1].position = 'Changed'; } }],
    ['duration mutation', { mutateLive: (value: CVData) => { value.experience[0].startDate = '2022-01'; } }],
  ])('78-83. %s blocks apply with usage +0', async (_name, options) => {
    const run = await harness(options); expect(run.result.kind).toBe('handled_failure'); expect(run.usage).toBe(4);
  });

  it('84. persistence failure rolls back complete pre-write CV and increments usage zero', async () => {
    const run = await harness({ persist: false });
    expect(run.result.kind).toBe('handled_failure'); expect(hashSummaryV3Value(run.live)).toBe(hashSummaryV3Value(cv()));
    expect(run.usage).toBe(4);
  });

  it('85. stable-ID array reordering remains safe', async () => {
    const captured = snapshot(); const response = await accepted(captured.manifest); let live = cv(); live.experience.reverse(); let usage = 0;
    const result = applySummaryV3GenerateTransaction(captured, response, {
      getLiveState: () => ({ cv: live, requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
        referenceDateIso: '2026-08-28', jobContextHash: 'context-m4' }), getActiveOperationId: () => 'm4-operation',
      writeCv: (next) => { live = next; }, projectPreviewSummary: (next) => next.summary,
      persistCv: () => true, incrementUsage: () => { usage += 1; },
    });
    expect(result.kind).toBe('handled_success'); expect(usage).toBe(1);
  });

  it('86. adapter handled failure never invokes apply, persistence, usage, or V2 recovery', async () => {
    const captured = snapshot(); const writeCv = vi.fn(); const persistCv = vi.fn(); const incrementUsage = vi.fn();
    const result = await runSummaryV3GenerateAdapter(input(), {
      request: vi.fn(async () => ({ ok: false, action: SUMMARY_V3_GENERATE_ACTION, typedReason: 'validation_rejected' })),
      getLiveState: () => ({ cv: cv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
        referenceDateIso: captured.referenceDateIso, jobContextHash: 'context-m4' }), getActiveOperationId: () => 'm4-operation',
      writeCv, projectPreviewSummary: (next) => next.summary, persistCv, incrementUsage,
    });
    expect(result).toEqual({ kind: 'handled_failure', typedReason: 'validation_rejected' });
    expect(writeCv).not.toHaveBeenCalled(); expect(persistCv).not.toHaveBeenCalled(); expect(incrementUsage).not.toHaveBeenCalled();
  });

  it('86b. initial malformed writer fails closed before evaluator, repair, apply, persistence, usage, or fallthrough', async () => {
    const captured = snapshot(); const write = vi.fn(async () => ({ stopReason: 'tool_use', content: [] }));
    const evaluate = vi.fn(); const writeCv = vi.fn(); const persistCv = vi.fn(); const incrementUsage = vi.fn();
    const events: unknown[] = [];
    const result = await runSummaryV3GenerateAdapter(input(), {
      request: vi.fn(async () => executeSummaryV3GenerateServer({ manifest: captured.manifest }, { write, evaluate })),
      getLiveState: () => ({ cv: cv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
        referenceDateIso: captured.referenceDateIso, jobContextHash: 'context-m4' }),
      getActiveOperationId: () => 'm4-operation', writeCv, projectPreviewSummary: (next) => next.summary,
      persistCv, incrementUsage, onTerminal: (event) => events.push(event),
    });
    expect(result).toEqual({ kind: 'handled_failure', typedReason: 'writer_tool_missing' });
    expect(write).toHaveBeenCalledTimes(1); expect(evaluate).not.toHaveBeenCalled();
    expect(writeCv).not.toHaveBeenCalled(); expect(persistCv).not.toHaveBeenCalled(); expect(incrementUsage).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    const event = events[0] as import('../summary-generate').SummaryV3GenerateTerminalEvent;
    expect(event.evidence.candidatePresent).toBe(false);
    expect(event.evidence.writer).toMatchObject({ attempted: true, result: 'malformed', stopReason: 'tool_use', contentBlockCount: 0, toolBlockCount: 0, expectedToolCount: 1 });
    expect(event.evidence.evaluator).toMatchObject({ attempted: false, result: 'not_attempted' });
    expect(event.applyCommitted).toBe(false);
  });

  it('87. M4 terminal seam emits one safe success record with candidate evidence', async () => {
    const captured = snapshot(); const events: unknown[] = []; let live = cv();
    const result = await runSummaryV3GenerateAdapter(input(), {
      request: vi.fn(async () => accepted(captured.manifest)),
      getLiveState: () => ({ cv: live, requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: live.summary,
        referenceDateIso: captured.referenceDateIso, jobContextHash: 'context-m4' }),
      getActiveOperationId: () => 'm4-operation', writeCv: (next) => { live = next; }, projectPreviewSummary: (next) => next.summary,
      persistCv: vi.fn(() => true), incrementUsage: vi.fn(), getUsageCount: () => 5,
      getRouteHttpStatus: () => 200, onTerminal: (event) => events.push(event),
    });
    expect(result).toEqual({ kind: 'handled_success' });
    expect(events).toHaveLength(1);
    const event = events[0] as import('../summary-generate').SummaryV3GenerateTerminalEvent;
    expect(event.evidence.candidatePresent).toBe(true);
    expect(event.evidence.candidateUnitCount).toBe(3);
    expect(event.evidence.writer.result).toBe('succeeded');
    expect(event.evidence.evaluator.result).toBe('succeeded');
    expect(event.applyCommitted).toBe(true);
    expect(event.routeHttpStatus).toBe(200);
    expect(JSON.stringify(event.evidence)).not.toContain(event.internalRejectionAudit?.candidate.text || 'never');
  });

  it('88. M4 validation rejection emits candidate audit without leaking prose into safe evidence', async () => {
    const captured = snapshot(); const events: unknown[] = [];
    const result = await runSummaryV3GenerateAdapter(input(), {
      request: vi.fn(async () => executeSummaryV3GenerateServer({ manifest: captured.manifest }, {
        write: vi.fn(async () => writerResponse(captured.manifest)),
        evaluate: vi.fn(async () => evaluatorResponse(captured.manifest, 'semantic', 'unsupported_metric')),
      })),
      getLiveState: () => ({ cv: cv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
        referenceDateIso: captured.referenceDateIso, jobContextHash: 'context-m4' }),
      getActiveOperationId: () => 'm4-operation', writeCv: vi.fn(), projectPreviewSummary: (next) => next.summary,
      persistCv: vi.fn(() => true), incrementUsage: vi.fn(), onTerminal: (event) => events.push(event),
    });
    expect(result).toEqual({ kind: 'handled_failure', typedReason: 'repair_validation_rejected' });
    expect(events).toHaveLength(1);
    const event = events[0] as import('../summary-generate').SummaryV3GenerateTerminalEvent;
    expect(event.evidence.semanticViolationCodes).toContain('unsupported_metric');
    expect(event.applyCommitted).toBe(false);
    if (event.internalRejectionAudit) {
      expect(event.evidence.candidatePresent).toBe(true);
      expect(event.internalRejectionAudit.candidate.text).toBeTruthy();
      expect(event.internalRejectionAudit.evaluator.semanticViolations[0]?.code).toBe('unsupported_metric');
      expect(JSON.stringify(event.evidence)).not.toContain(event.internalRejectionAudit.candidate.text);
    } else {
      expect(event.evidence.candidatePresent).toBe(false);
    }
  });

  it('89. device observation fixture is non-PII and captures the pre-fix false-green', () => {
    expect(M4_SUMMARY_GENERATE_DEVICE_OBSERVATION.operation).toBe('summary_v3_generate');
    expect(M4_SUMMARY_GENERATE_DEVICE_OBSERVATION.diagnosticPresentBeforeToast).toBe(false);
    expect(JSON.stringify(M4_SUMMARY_GENERATE_DEVICE_OBSERVATION)).not.toMatch(/@|Ana|Example|Current/u);
  });

  it('90. AAB 545 physical fixture maps to owned malformed-writer terminal truth', () => {
    expect(M4_SUMMARY_GENERATE_AAB545_OBSERVATION).toMatchObject({
      ownershipResult: 'owned', writer: { attempted: true, result: 'malformed' },
      evaluator: { attempted: false, result: 'not_attempted' }, candidatePresent: false,
      usageDelta: 0, v2FallthroughCount: 0, apply: false,
    });
    expect(JSON.stringify(M4_SUMMARY_GENERATE_AAB545_OBSERVATION)).not.toMatch(/@|Ana|Example|Current|employer|role/u);
  });

  it('91. both AAB 546 physical observations remain terminal provider failures', () => {
    expect(M4_SUMMARY_GENERATE_AAB546_OBSERVATION).toMatchObject({
      attemptCount: 2, ownershipResult: 'owned', writer: { attempted: true, result: 'failed' },
      evaluator: { attempted: false, result: 'not_attempted' }, candidatePresent: false,
      usageDelta: 0, v2FallthroughCount: 0, apply: false, exactProviderCauseAvailable: false,
      application502ProvenProvider502: false,
    });
    expect(M4_SUMMARY_GENERATE_AAB546_OBSERVATION.attempts).toHaveLength(2);
    expect(M4_SUMMARY_GENERATE_AAB546_OBSERVATION.attempts.every((attempt) => attempt.routeHttpStatus === 502)).toBe(true);
    expect(JSON.stringify(M4_SUMMARY_GENERATE_AAB546_OBSERVATION)).not.toMatch(/@|Ana|Example|Current|employer|role|prompt|token/u);
  });

  it('92. AAB 548 physical writer schema observation remains fail-closed and immutable', () => {
    expect(M4_SUMMARY_GENERATE_AAB548_WRITER_SCHEMA_OBSERVATION).toMatchObject({
      package: '1.0.548 / 548', sourceMarker: '7cabc82', operation: 'summary_v3_generate',
      routeHttpStatus: 502, ownershipResult: 'owned',
      writer: { attempted: true, result: 'malformed', stopReason: 'tool_use', contentBlockCount: 1,
        textBlockCount: 0, toolBlockCount: 1, expectedToolCount: 1, toolNameMatched: true,
        toolInputObject: true, toolInputSchemaPassed: false, identityPassed: true },
      evaluator: { attempted: false, result: 'not_attempted' }, candidatePresent: false,
      repairAttempted: false, fallbackAttempted: false, apply: false, persistence: 'not_attempted',
      usageDelta: 0, v2FallthroughCount: 0, summaryUnchanged: true, experienceUnchanged: true,
      terminalRecordPresentBeforeToast: true, summaryCopyPresent: true,
      m4ProviderFailure: { phase: 'initial_writer', failureStage: 'tool_validation', providerHttpStatus: null,
        providerErrorCode: null, providerStructuralFieldPath: null, providerMessageFingerprint: 'v3s-f8b6c81c',
        providerHttpResponseReceived: true },
    });
    expect(Object.isFrozen(M4_SUMMARY_GENERATE_AAB548_WRITER_SCHEMA_OBSERVATION)).toBe(true);
    expect(JSON.stringify(M4_SUMMARY_GENERATE_AAB548_WRITER_SCHEMA_OBSERVATION)).not.toMatch(/@|fullName|email|phone|address|employer|role|prompt|token|credential|raw/u);
  });
});

describe('M4 provider-failure observability envelope', () => {
  it('keeps duration ownership in the shared prompt/tool contract while runtime parsing remains final authority', () => {
    const manifest = physicalShapeSnapshot().manifest;
    const initial = buildSummaryV3WriterPrompt(manifest);
    const repair = buildSummaryV3RepairPrompt(manifest, {
      operationId: manifest.operationId,
      candidateId: 'synthetic-candidate',
      operationKind: 'summary_generate',
      sourceSnapshotHash: manifest.sourceSnapshotHash,
      targetLocale: manifest.targetLocale,
      text: 'Synthetic candidate.',
    }, [{ code: 'duration_mismatch', category: 'semantic', detail: 'finite synthetic evidence' }]);
    expect(initial).toContain(SUMMARY_V3_WRITER_UNIT_CONTRACT);
    expect(repair).toContain(SUMMARY_V3_WRITER_UNIT_CONTRACT);
    expect(SUMMARY_V3_WRITER_UNIT_CONTRACT).toContain('exactly one duration unit first');
    expect(SUMMARY_V3_WRITER_UNIT_CONTRACT).toContain('entryId=null');
    expect(SUMMARY_V3_WRITER_UNIT_CONTRACT).toContain('factIds=[]');
    expect(SUMMARY_V3_WRITER_UNIT_CONTRACT).toContain('supplied entryId');
    expect(SUMMARY_V3_WRITER_UNIT_CONTRACT).toContain('exactly the supplied factIds');
    expect(SUMMARY_V3_WRITER_TOOL.description).toContain(SUMMARY_V3_WRITER_UNIT_CONTRACT);
  });

  it('uses the flat provider schema for type-shape validation while runtime parsing owns duration semantics', () => {
    const manifest = physicalShapeSnapshot().manifest;
    const validate = new Ajv({ allErrors: true }).compile(SUMMARY_V3_WRITER_TOOL.input_schema);
    const valid = output(manifest);
    expect(validate(valid), JSON.stringify(validate.errors)).toBe(true);

    const nonNullEntryId = { ...valid, units: [{ ...valid.units[0], entryId: 'synthetic-entry' }, ...valid.units.slice(1)] };
    expect(validate(nonNullEntryId), JSON.stringify(validate.errors)).toBe(true);

    const nonEmptyFactIds = { ...valid, units: [{ ...valid.units[0], factIds: ['synthetic-fact'] }, ...valid.units.slice(1)] };
    expect(validate(nonEmptyFactIds), JSON.stringify(validate.errors)).toBe(true);

    const bothInvalid = { ...valid, units: [{ ...valid.units[0], entryId: 'synthetic-entry', factIds: ['synthetic-fact'] }, ...valid.units.slice(1)] };
    expect(validate(bothInvalid), JSON.stringify(validate.errors)).toBe(true);

    const invalidExperienceOwnershipTypes = { ...valid, units: [valid.units[0], { ...valid.units[1], entryId: null }] };
    expect(validate(invalidExperienceOwnershipTypes), JSON.stringify(validate.errors)).toBe(true);

    const missingUnitKey = { ...valid, units: valid.units.map(({ text: _text, ...unit }) => unit) };
    expect(validate(missingUnitKey)).toBe(false);
    const extraUnitKey = { ...valid, units: valid.units.map((unit) => ({ ...unit, extra: true })) };
    expect(validate(extraUnitKey)).toBe(false);
    const wrongPrimitive = { ...valid, locale: 1 };
    expect(validate(wrongPrimitive)).toBe(false);
    const invalidSlot = { ...valid, units: [{ ...valid.units[0], slot: 'other' }, ...valid.units.slice(1)] };
    expect(validate(invalidSlot)).toBe(false);
    const invalidFactId = { ...valid, units: [{ ...valid.units[0], factIds: [1] }, ...valid.units.slice(1)] };
    expect(validate(invalidFactId)).toBe(false);
  });

  function providerError(status?: number, code = 'invalid_request'): Error {
    const error = new Error('raw provider message must never persist') as Error & Record<string, unknown>;
    if (status !== undefined) error.status = status;
    error.requestID = 'raw-provider-request-id';
    error.error = { code };
    return error;
  }

  it('maps every safe provider boundary without copying route status', () => {
    const cases: Array<[number, string, boolean | null]> = [
      [400, 'invalid_request', false], [401, 'authentication', false], [403, 'permission', false],
      [429, 'rate_limit', true], [500, 'provider_5xx', true],
    ];
    for (const [status, type, retryable] of cases) {
      const envelope = classifySummaryV3ProviderFailure(providerError(status), 'initial_writer', 'sdk_request');
      expect(envelope).toMatchObject({ phase: 'initial_writer', failureStage: 'sdk_request', providerHttpStatus: status,
        providerErrorType: type, providerRetryable: retryable, providerHttpResponseReceived: true });
      expect(JSON.stringify(envelope)).not.toContain('raw provider message');
      expect(JSON.stringify(envelope)).not.toContain('raw-provider-request-id');
    }
    const unknown = classifySummaryV3ProviderFailure(new Error('unknown provider'), 'initial_writer', 'sdk_request');
    expect(unknown).toMatchObject({ providerHttpStatus: null, providerErrorType: null, providerRetryable: null,
      providerHttpResponseReceived: null });
    const timeout = new DOMException('aborted', 'AbortError');
    expect(classifySummaryV3ProviderFailure(timeout, 'initial_writer', 'sdk_request')).toMatchObject({ providerErrorType: 'timeout', providerRetryable: false });
    const extraction = classifySummaryV3ProviderFailure(providerError(502), 'initial_writer', 'response_extraction');
    expect(extraction).toMatchObject({ failureStage: 'response_extraction', providerErrorType: 'response_extraction', providerHttpStatus: 502 });
  });

  it('preserves the original cause in memory but serializes only the envelope', () => {
    const cause = providerError(429, 'rate_limit_error');
    const wrapped = createSummaryV3ProviderTransportError(cause, 'repair_writer', 'sdk_request');
    expect((wrapped as Error & { cause?: unknown }).cause).toBe(cause);
    expect(JSON.stringify(wrapped)).not.toContain('raw provider message');
    expect(wrapped.envelope.phase).toBe('repair_writer');
  });

  it('attributes initial writer, initial evaluator, repair writer, and post-repair evaluator failures', async () => {
    const manifest = snapshot().manifest;
    const initialWriter = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => { throw providerError(400); }), evaluate: vi.fn(),
    });
    expect(initialWriter).toMatchObject({ ok: false, typedReason: 'provider_request_failed', m4ProviderFailure: { phase: 'initial_writer', failureStage: 'sdk_request', providerHttpStatus: 400 } });

    const initialEvaluator = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => writerResponse(manifest)), evaluate: vi.fn(async () => { throw providerError(401); }),
    });
    expect(initialEvaluator).toMatchObject({ ok: false, typedReason: 'validator_exception', m4ProviderFailure: { phase: 'initial_evaluator', providerHttpStatus: 401 } });

    let writes = 0;
    const repairWriter = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => { writes += 1; if (writes === 2) throw providerError(500); return writerResponse(manifest); }),
      evaluate: vi.fn(async () => evaluatorResponse(manifest, 'semantic', 'unsupported_metric')),
    });
    expect(repairWriter).toMatchObject({ ok: false, typedReason: 'repair_provider_failed', m4ProviderFailure: { phase: 'repair_writer', providerHttpStatus: 500 } });

    let evaluations = 0;
    const postRepairEvaluator = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => writerResponse(manifest)),
      evaluate: vi.fn(async () => { evaluations += 1; if (evaluations === 2) throw providerError(403); return evaluatorResponse(manifest, 'semantic', 'unsupported_metric'); }),
    });
    expect(postRepairEvaluator).toMatchObject({ ok: false, typedReason: 'repair_validator_exception', m4ProviderFailure: { phase: 'post_repair_evaluator', providerHttpStatus: 403 } });
  });

  it('retains typed tool-validation rejection without rewriting it as provider request failure', async () => {
    const manifest = snapshot().manifest;
    const result = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => ({ stopReason: 'tool_use', content: [] })), evaluate: vi.fn(),
    });
    expect(result).toMatchObject({ ok: false, typedReason: 'writer_tool_missing', m4ProviderFailure: { phase: 'initial_writer', failureStage: 'tool_validation', providerHttpStatus: null } });
  });

  it('projects the exact safe writer schema code and path into the terminal failure envelope', async () => {
    const manifest = snapshot().manifest;
    const malformed = output(manifest);
    malformed.units = {} as unknown as SummaryV3WriterOutput['units'];
    const result = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => ({ stopReason: 'tool_use', content: [{
        type: 'tool_use', name: SUMMARY_V3_WRITER_TOOL_NAME, input: malformed,
      }] })), evaluate: vi.fn(),
    });
    expect(result).toMatchObject({
      ok: false,
      typedReason: 'writer_tool_input_malformed',
      m4ProviderFailure: {
        phase: 'initial_writer', failureStage: 'tool_validation', providerHttpStatus: null,
        providerErrorCode: 'units_type', providerStructuralFieldPath: 'units',
        providerHttpResponseReceived: true,
      },
    });
  });

  it('projects finite safe writer schema code and path without accepting malformed input', () => {
    const manifest = snapshot().manifest;
    const valid = output(manifest);
    const cases: Array<[string, unknown, string, string | null]> = [
      ['non-object', null, 'input_not_object', null],
      ['missing top-level field', (() => { const v = { ...valid }; delete (v as Record<string, unknown>).units; return v; })(), 'top_level_keys', 'root'],
      ['extra top-level field', { ...valid, extra: true }, 'top_level_keys', 'root'],
      ['units wrong type', { ...valid, units: {} }, 'units_type', 'units'],
      ['units too short', { ...valid, units: valid.units.slice(0, 1) }, 'units_length', 'units'],
      ['missing nested field', { ...valid, units: [(() => { const unit = { ...(valid.units[0] as object) }; delete (unit as Record<string, unknown>).text; return unit; })(), ...valid.units.slice(1)] }, 'unit_keys', 'units.0'],
      ['extra nested field', { ...valid, units: [{ ...(valid.units[0] as object), extra: true }, ...valid.units.slice(1)] }, 'unit_keys', 'units.0'],
      ['wrong slot enum', { ...valid, units: [{ ...(valid.units[0] as object), slot: 'other' }, ...valid.units.slice(1)] }, 'slot_type_or_enum', 'units.0.slot'],
      ['wrong fact item type', { ...valid, units: [{ ...(valid.units[0] as object), factIds: [1] }, ...valid.units.slice(1)] }, 'fact_id_type', 'units.0.factIds'],
      ['wrong text type', { ...valid, units: [{ ...(valid.units[0] as object), text: 1 }, ...valid.units.slice(1)] }, 'text_type', 'units.0.text'],
      ['unsafe text', { ...valid, units: [{ ...(valid.units[0] as object), text: '# Summary' }, ...valid.units.slice(1)] }, 'text_content', 'units.0.text'],
      ['wrong order', { ...valid, units: [valid.units[1], valid.units[0], ...valid.units.slice(2)] }, 'unit_order', 'units'],
      ['duration ownership', { ...valid, units: [{ ...(valid.units[0] as object), entryId: 'wrong' }, ...valid.units.slice(1)] }, 'duration_entry_id_contract', 'units.0.entryId'],
      ['duration fact ownership', { ...valid, units: [{ ...(valid.units[0] as object), factIds: ['foreign-fact'] }, ...valid.units.slice(1)] }, 'duration_fact_ids_contract', 'units.0.factIds'],
      ['experience ownership', { ...valid, units: [valid.units[0], { ...(valid.units[1] as object), entryId: 'wrong' }, ...valid.units.slice(2)] }, 'entry_ownership', 'units.1.entryId'],
      ['wrong fact ownership', { ...valid, units: [valid.units[0], { ...(valid.units[1] as object), factIds: (valid.units[2] as { factIds: string[] }).factIds }, ...valid.units.slice(2)] }, 'fact_ownership', 'units.1.factIds'],
    ];
    for (const [name, toolInput, code, fieldPath] of cases) {
      const result = parseSummaryV3WriterToolResponse({ stopReason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_WRITER_TOOL_NAME, input: toolInput }] }, manifest);
      expect(result.ok, name).toBe(false);
      if (!result.ok) expect(result.toolValidation, name).toEqual({ code, fieldPath });
    }
    const accepted = parseSummaryV3WriterToolResponse(writerResponse(manifest), manifest);
    expect(accepted.ok).toBe(true);
  });

  it('keeps the shared writer contract for a valid repair-writer response', () => {
    const manifest = snapshot().manifest;
    const result = parseSummaryV3WriterToolResponse(writerResponse(manifest), manifest);
    expect(result).toMatchObject({ ok: true, diagnosticMetadata: { toolInputSchemaPassed: true, identityPassed: true } });
  });

  it.each([
    ['duration entryId is non-null', (valid: SummaryV3WriterOutput) => ({ ...valid, units: [
      { ...valid.units[0], entryId: 'synthetic-entry' }, ...valid.units.slice(1),
    ] }), 'duration_entry_id_contract', 'units.0.entryId'],
    ['duration factIds is non-empty', (valid: SummaryV3WriterOutput) => ({ ...valid, units: [
      { ...valid.units[0], factIds: ['synthetic-fact'] }, ...valid.units.slice(1),
    ] }), 'duration_fact_ids_contract', 'units.0.factIds'],
    ['both duration ownership fields are invalid', (valid: SummaryV3WriterOutput) => ({ ...valid, units: [
      { ...valid.units[0], entryId: 'synthetic-entry', factIds: ['synthetic-fact'] }, ...valid.units.slice(1),
    ] }), 'duration_entry_id_contract', 'units.0.entryId'],
  ])('projects the exact finite branch for %s', async (_name, mutate, code, fieldPath) => {
    const manifest = physicalShapeSnapshot().manifest;
    expect(manifest.selectedEntries).toHaveLength(1);
    expect(manifest.selectedEntries[0].facts).toHaveLength(3);
    const evaluate = vi.fn();
    const result = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => ({ stopReason: 'tool_use', content: [{
        type: 'tool_use', name: SUMMARY_V3_WRITER_TOOL_NAME, input: mutate(output(manifest)),
      }] })),
      evaluate,
    });
    expect(result).toMatchObject({
      ok: false,
      typedReason: 'writer_tool_input_malformed',
      repairAttempted: false,
      m4ProviderFailure: {
        phase: 'initial_writer', failureStage: 'tool_validation',
        providerErrorCode: code, providerStructuralFieldPath: fieldPath,
        providerMessageFingerprint: 'v3s-f8b6c81c', providerRetryable: false,
      },
      transportEvidence: { writer: { identityPassed: true, result: 'malformed' } },
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect('candidate' in result).toBe(false);
  });

  it('uses the same exact duration observability for a malformed repair without changing repair eligibility', async () => {
    const manifest = physicalShapeSnapshot().manifest;
    let writes = 0;
    const write = vi.fn(async () => {
      writes += 1;
      if (writes === 1) return writerResponse(manifest);
      const invalid = output(manifest);
      return { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: SUMMARY_V3_WRITER_TOOL_NAME,
        input: { ...invalid, units: [{ ...invalid.units[0], factIds: ['synthetic-fact'] }, ...invalid.units.slice(1)] } }] };
    });
    const evaluate = vi.fn(async () => evaluatorResponse(manifest, 'semantic', 'duration_mismatch'));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result).toMatchObject({
      ok: false, typedReason: 'repair_output_malformed', repairAttempted: true,
      m4ProviderFailure: { phase: 'repair_writer', providerErrorCode: 'duration_fact_ids_contract',
        providerStructuralFieldPath: 'units.0.factIds' },
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('records the immutable AAB 549 ambiguity without retaining CV content or inventing duration months', () => {
    expect(M4_SUMMARY_GENERATE_AAB549_DURATION_OBSERVATION).toMatchObject({
      package: '1.0.549 / 549', sourceMarker: '8548540', operation: 'summary_v3_generate',
      selectedExperienceCount: 1, availableFactCount: 3, requiredFactCount: 3,
      expectedWriterManifest: {
        totalUnitCount: 2, durationUnitCount: 1, durationUnitIndex: 0,
        durationEntryIdMustBeNull: true, durationFactIdsCount: 0,
        experienceUnitCount: 1, slotOrder: ['duration', 'experience'],
        structuredDurationAvailable: true, structuredDurationMonths: null,
      },
      m4ProviderFailure: { providerErrorCode: 'duration_contract', providerStructuralFieldPath: 'units' },
      exactDurationSubcondition: 'not_proven',
      reachableHistoricalSubconditions: ['duration_entry_id_contract', 'duration_fact_ids_contract'],
    });
    expect(M4_SUMMARY_GENERATE_AAB549_DURATION_OBSERVATION).not.toHaveProperty('deploymentId');
    expect(Object.isFrozen(M4_SUMMARY_GENERATE_AAB549_DURATION_OBSERVATION)).toBe(true);
    expect(JSON.stringify(M4_SUMMARY_GENERATE_AAB549_DURATION_OBSERVATION))
      .not.toMatch(/@|fullName|email|phone|address|employer|roleTitle|generatedText|rawToolInput|credential|bearer/iu);
  });

  it('records the immutable AAB 550 strict-schema provider 400 without raw request, response, or CV data', () => {
    expect(M4_SUMMARY_GENERATE_AAB550_STRICT_SCHEMA_OBSERVATION).toMatchObject({
      package: '1.0.550 / 550', sourceMarker: '9f69bbc', operation: 'summary_v3_generate',
      routeHttpStatus: 502, ownershipResult: 'owned',
      writer: { attempted: true, result: 'failed', stopReason: null, contentBlockCount: null,
        textBlockCount: null, toolBlockCount: null, toolNameMatched: null, toolInputObject: null,
        toolInputSchemaPassed: null, identityPassed: null },
      evaluator: { attempted: false, result: 'not_attempted' }, candidatePresent: false,
      repairAttempted: false, apply: false, persistence: 'not_attempted', usageBefore: 0,
      usageAfter: 0, usageDelta: 0, v2FallthroughCount: 0, summaryUnchanged: true,
      experienceUnchanged: true, terminalRecordPresentBeforeToast: true,
      m4ProviderFailure: { phase: 'initial_writer', failureStage: 'sdk_request', providerHttpStatus: 400,
        providerErrorType: 'invalid_request', providerErrorCode: null, providerRequestIdHash: 'v3s-ede10895',
        providerMessageFingerprint: 'v3s-de94804f', providerStructuralFieldPath: null,
        providerHttpResponseReceived: true },
    });
    expect(Object.isFrozen(M4_SUMMARY_GENERATE_AAB550_STRICT_SCHEMA_OBSERVATION)).toBe(true);
    expect(JSON.stringify(M4_SUMMARY_GENERATE_AAB550_STRICT_SCHEMA_OBSERVATION)).not.toMatch(/@|Ana|Example|Current|employer|role|prompt|token|credential|raw/u);
  });

  it('keeps route HTTP status separate from provider status in terminal diagnostics and copy', async () => {
    const captured = snapshot();
    const events: import('../summary-generate').SummaryV3GenerateTerminalEvent[] = [];
    const envelope = classifySummaryV3ProviderFailure(providerError(400), 'initial_writer', 'sdk_request');
    await runSummaryV3GenerateAdapter(input(), {
      request: vi.fn(async () => ({ ok: false, action: SUMMARY_V3_GENERATE_ACTION, typedReason: 'provider_request_failed', m4ProviderFailure: envelope })),
      getLiveState: () => ({ cv: cv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
        referenceDateIso: captured.referenceDateIso, jobContextHash: 'context-m4' }),
      getActiveOperationId: () => 'm4-operation', writeCv: vi.fn(), projectPreviewSummary: (next) => next.summary,
      persistCv: vi.fn(), incrementUsage: vi.fn(), getRouteHttpStatus: () => 502,
      onTerminal: (event) => events.push(event),
    });
    const session = new SummaryAiDiagnosticSession({ uiLocale: 'en', requestedLocale: 'en', templateId: 'test', requestId: 'safe-request', usageCountBefore: 4 });
    session.recordM4Terminal(events[0]);
    const trace = session.commit();
    expect(trace.m4RouteHttpStatus).toBe(502);
    expect(trace.providerHttpStatus).toBe(400);
    expect(trace.m4ProviderFailure).toMatchObject({ phase: 'initial_writer', providerHttpStatus: 400 });
    const copy = formatSummaryAiDiagnosticForCopy(trace);
    expect(copy).toContain('m4ProviderFailure');
    expect(copy).not.toContain('raw provider message');
    expect(copy).not.toContain('raw-provider-request-id');
  });

  it('carries safe writer schema code and path into the Summary terminal copy', async () => {
    const captured = snapshot();
    const events: import('../summary-generate').SummaryV3GenerateTerminalEvent[] = [];
    const envelope = {
      phase: 'initial_writer' as const, failureStage: 'tool_validation' as const,
      errorClass: null, providerHttpStatus: null, providerErrorType: null,
      providerErrorCode: 'units_type', providerRequestIdHash: null, providerRetryable: false,
      providerMessageFingerprint: 'v3s-f8b6c81c', providerStructuralFieldPath: 'units',
      providerHttpResponseReceived: true,
    };
    await runSummaryV3GenerateAdapter(input(), {
      request: vi.fn(async () => ({ ok: false, action: SUMMARY_V3_GENERATE_ACTION,
        typedReason: 'writer_tool_input_malformed', m4ProviderFailure: envelope })),
      getLiveState: () => ({ cv: cv(), requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en', exactVisibleSummary: '',
        referenceDateIso: captured.referenceDateIso, jobContextHash: 'context-m4' }),
      getActiveOperationId: () => 'm4-operation', writeCv: vi.fn(), projectPreviewSummary: (next) => next.summary,
      persistCv: vi.fn(), incrementUsage: vi.fn(), getRouteHttpStatus: () => 502,
      onTerminal: (event) => events.push(event),
    });
    const session = new SummaryAiDiagnosticSession({ uiLocale: 'en', requestedLocale: 'en', templateId: 'test', requestId: 'safe-request', usageCountBefore: 4 });
    session.recordM4Terminal(events[0]);
    const trace = session.commit();
    expect(trace.m4ProviderFailure).toMatchObject({ providerErrorCode: 'units_type', providerStructuralFieldPath: 'units' });
    expect(formatSummaryAiDiagnosticForCopy(trace)).toContain('"providerStructuralFieldPath": "units"');
    expect(formatSummaryAiDiagnosticForCopy(trace)).toContain('"providerErrorCode": "units_type"');
  });
});

describe('M4 AAB 547 immutable timeout authority', () => {
  it('maps the physical fixture to the exact initial-writer fail-closed result', () => {
    expect(M4_SUMMARY_GENERATE_AAB547_TIMEOUT_OBSERVATION).toMatchObject({
      package: '1.0.547 / 547', sourceMarker: 'd9067d3', operation: 'summary_v3_generate',
      sourceWasEmpty: true, selectedExperienceCount: 1, availableFactCount: 3, requiredFactCount: 3,
      routeHttpStatus: 502,
      m4ProviderFailure: { phase: 'initial_writer', failureStage: 'sdk_request', errorClass: 'Error',
        providerHttpStatus: null, providerErrorType: 'timeout', providerErrorCode: null,
        providerRequestIdHash: null, providerRetryable: false, providerMessageFingerprint: 'v3s-75034834',
        providerStructuralFieldPath: null, providerHttpResponseReceived: null },
      writer: { attempted: true, result: 'failed' }, evaluator: { attempted: false, result: 'not_attempted' },
      candidatePresent: false, repairAttempted: false, fallbackAttempted: false,
      apply: false, persistence: 'not_attempted', usageBefore: 0, usageAfter: 0, usageDelta: 0,
      v2FallthroughCount: 0, summaryUnchanged: true, experienceUnchanged: true,
      terminalRecordPresentBeforeToast: true, summaryCopyPresent: true, toastShown: true,
    });
    expect(Object.values(M4_SUMMARY_GENERATE_AAB547_TIMEOUT_OBSERVATION.phases)
      .every((phase) => phase === 'not_evaluated')).toBe(true);
  });

  it('ties the historical fingerprint only to the committed 8000ms provider timeout message', () => {
    expect(hashSummaryV3Value('provider_transport_timeout after 8000ms')).toBe('v3s-75034834');
    expect(hashSummaryV3Value('verifier_transport_timeout after 8000ms')).not.toBe('v3s-75034834');
    expect(hashSummaryV3Value('route_deadline_exceeded after 8000ms')).not.toBe('v3s-75034834');
  });

  it('contains no CV prose, identity, raw request ID, provider message, token, or credential', () => {
    expect(Object.isFrozen(M4_SUMMARY_GENERATE_AAB547_TIMEOUT_OBSERVATION)).toBe(true);
    const serialized = JSON.stringify(M4_SUMMARY_GENERATE_AAB547_TIMEOUT_OBSERVATION);
    expect(serialized).not.toMatch(/@|fullName|email|phone|address|employer|roleTitle|raw request|api[_-]?key|credential|bearer/iu);
    expect(M4_SUMMARY_GENERATE_AAB547_TIMEOUT_OBSERVATION.m4ProviderFailure.providerRequestIdHash).toBeNull();
  });
});

describe('M4 AAB 551 immutable initial-evaluator timeout authority', () => {
  it('preserves the physical writer-success/evaluator-timeout boundary without CV data', () => {
    expect(M4_SUMMARY_GENERATE_AAB551_INITIAL_EVALUATOR_TIMEOUT_OBSERVATION).toMatchObject({
      applicationId: 'com.cvproai.app', versionCode: 551, versionName: '1.0.551', sourceMarker: '0f8a14a',
      locale: 'de', sourceWasEmpty: true, selectedExperienceCount: 1, authoritativeFactCount: 3,
      routeHttpStatus: 502,
      writer: { attempted: true, result: 'succeeded', stopReason: 'tool_use', contentBlockCount: 1,
        textBlockCount: 0, toolBlockCount: 1, expectedToolCount: 1, toolNameMatched: true,
        toolInputObject: true, schemaPassed: true, identityPassed: true },
      evaluator: { attempted: true, result: 'failed', responseMetadataAvailable: false },
      m4ProviderFailure: { phase: 'initial_evaluator', failureStage: 'sdk_request', errorClass: 'Error',
        providerHttpStatus: null, providerErrorType: 'timeout', providerErrorCode: null,
        providerRequestIdHash: null, providerRetryable: false, providerMessageFingerprint: 'v3s-de5a1d01',
        providerStructuralFieldPath: null, providerHttpResponseReceived: null },
      candidateApplied: false, applyAttempted: false, persistenceAttempted: false,
      usageBefore: 0, usageAfter: 0, usageDelta: 0, v2FallthroughCount: 0,
      summaryUnchanged: true, experienceUnchanged: true, terminalRecordPresentBeforeToast: true,
    });
  });

  it('reproduces v3s-de5a1d01 through the actual historical verifier transport seam', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const pending = callProviderWithDeadline(
        () => new Promise<never>(() => undefined), null, AI_PROVIDER_CALL_TIMEOUT_MS, 'verifier',
      ).catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(8_000);
      const error = await pending;
      expect(error).toMatchObject({ name: 'AbortError', deadlineOwner: 'verifier_transport',
        configuredTimeoutMs: 8_000, effectiveTimeoutMs: 8_000 });
      expect(classifySummaryV3ProviderFailure(error, 'initial_evaluator', 'sdk_request')).toMatchObject({
        phase: 'initial_evaluator', failureStage: 'sdk_request', errorClass: 'Error',
        providerHttpStatus: null, providerErrorType: 'timeout', providerRetryable: false,
        providerMessageFingerprint: 'v3s-de5a1d01', providerHttpResponseReceived: null,
      });
      expect(classifySummaryV3ProviderFailure(error, 'post_repair_evaluator', 'sdk_request').phase)
        .toBe('post_repair_evaluator');
      expect(hashSummaryV3Value('provider_transport_timeout after 8000ms')).not.toBe('v3s-de5a1d01');
      expect(hashSummaryV3Value('route_deadline_exceeded after 8000ms')).not.toBe('v3s-de5a1d01');
      expect(hashSummaryV3Value('generic ordinary error')).not.toBe('v3s-de5a1d01');
    } finally {
      vi.useRealTimers();
    }
  });

  it('contains no prose, identity, prompt, provider payload, request ID, or secret', () => {
    expect(Object.isFrozen(M4_SUMMARY_GENERATE_AAB551_INITIAL_EVALUATOR_TIMEOUT_OBSERVATION)).toBe(true);
    const serialized = JSON.stringify(M4_SUMMARY_GENERATE_AAB551_INITIAL_EVALUATOR_TIMEOUT_OBSERVATION);
    expect(serialized).not.toMatch(/@|fullName|email|phone|address|employer|role|prompt|rawProviderRequest|providerRequestPayload|providerResponsePayload|raw|api[_-]?key|credential|token|cookie|header|deployment/iu);
  });
});
