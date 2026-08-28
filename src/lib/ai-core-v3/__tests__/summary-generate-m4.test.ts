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
  hashSummaryV3Value,
  parseSummaryV3EvaluatorOutput,
  parseSummaryV3GenerateRequest,
  parseSummaryV3WriterOutput,
  projectSummaryV3ImmediatePreviewModel,
  runSummaryV3GenerateAdapter,
  type SummaryV3GenerateAdapterInput,
  type SummaryV3GenerateSuccessResponse,
  type SummaryV3Manifest,
  type SummaryV3WriterOutput,
} from '..';

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

async function accepted(manifest = snapshot().manifest): Promise<SummaryV3GenerateSuccessResponse> {
  const result = await executeSummaryV3GenerateServer({ manifest }, {
    write: vi.fn(async () => writerJson(manifest)), evaluate: vi.fn(async () => evaluatorJson(manifest)),
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
    expect(parseSummaryV3WriterOutput(writerJson(manifest), manifest)?.units).toHaveLength(3);
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
    expect(parseSummaryV3WriterOutput(factory(manifest), manifest)).toBeNull();
  });

  it('42. evaluator accepts violations-only phase evidence', () => {
    const manifest = snapshot().manifest;
    expect(parseSummaryV3EvaluatorOutput(evaluatorJson(manifest), manifest)?.phases.semantic.status).toBe('passed');
  });

  it.each([
    ['replacement prose', { replacement: 'rewrite' }],
    ['apply authority', { apply: true }],
    ['usage authority', { incrementUsage: true }],
  ])('43-45. evaluator rejects %s', (_name, extra) => {
    const manifest = snapshot().manifest;
    const parsed = JSON.parse(evaluatorJson(manifest));
    Object.assign(parsed, extra);
    expect(parseSummaryV3EvaluatorOutput(JSON.stringify(parsed), manifest)).toBeNull();
  });

  it('46. structurally invalid primary invokes evaluator zero times', async () => {
    const manifest = snapshot().manifest; const evaluate = vi.fn();
    const result = await executeSummaryV3GenerateServer({ manifest }, { write: vi.fn(async () => '{}'), evaluate });
    expect(result.ok).toBe(false); expect(evaluate).toHaveBeenCalledTimes(0);
  });

  it('47. structurally valid primary invokes one writer and one independent evaluator', async () => {
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerJson(manifest));
    const evaluate = vi.fn(async () => evaluatorJson(manifest));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(true); expect(write).toHaveBeenCalledTimes(1); expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('48. accepted primary invokes no repair', async () => {
    expect((await accepted()).repairAttempted).toBe(false);
  });

  it('49. eligible primary rejection invokes exactly one repair writer and repair evaluator', async () => {
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerJson(manifest, write.mock.calls.length ? ' repaired' : ''));
    const evaluate = vi.fn(async () => evaluate.mock.calls.length === 1
      ? evaluatorJson(manifest, 'semantic', 'unsupported_metric') : evaluatorJson(manifest));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(true); expect(write).toHaveBeenCalledTimes(2); expect(evaluate).toHaveBeenCalledTimes(2);
    expect(result.repairAttempted).toBe(true);
  });

  it('50. repair receives exact manifest, candidate, violations, and identities', async () => {
    const manifest = snapshot().manifest; const prompts: string[] = [];
    const write = vi.fn(async (prompt: string) => { prompts.push(prompt); return writerJson(manifest, prompts.length > 1 ? ' repaired' : ''); });
    let calls = 0; const evaluate = vi.fn(async () => (++calls === 1
      ? evaluatorJson(manifest, 'semantic', 'duration_mismatch') : evaluatorJson(manifest)));
    await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(prompts[1]).toContain(manifest.manifestHash); expect(prompts[1]).toContain('duration_mismatch');
    expect(prompts[1]).toContain(manifest.operationId);
  });

  it('51. malformed repair invokes repair evaluator zero additional times and no third writer', async () => {
    const manifest = snapshot().manifest; let writes = 0;
    const write = vi.fn(async () => (++writes === 1 ? writerJson(manifest) : '{}'));
    const evaluate = vi.fn(async () => evaluatorJson(manifest, 'semantic', 'unsupported_claim'));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(false); expect(write).toHaveBeenCalledTimes(2); expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('52. repair rejection stops after two writers with no deterministic or V2 fallback', async () => {
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerJson(manifest));
    const evaluate = vi.fn(async () => evaluatorJson(manifest, 'language_quality', 'wrong_perspective'));
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
    const manifest = snapshot().manifest; const write = vi.fn(async () => writerJson(manifest));
    const evaluate = vi.fn(async () => evaluatorJson(manifest, category as 'semantic' | 'language_quality', code));
    const result = await executeSummaryV3GenerateServer({ manifest }, { write, evaluate });
    expect(result.ok).toBe(false); expect(result.repairAttempted).toBe(true);
  });

  it('73. evaluator exception fails closed with validator_exception and no repair', async () => {
    const manifest = snapshot().manifest;
    const result = await executeSummaryV3GenerateServer({ manifest }, {
      write: vi.fn(async () => writerJson(manifest)), evaluate: vi.fn(async () => { throw new Error('validator'); }),
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
});
