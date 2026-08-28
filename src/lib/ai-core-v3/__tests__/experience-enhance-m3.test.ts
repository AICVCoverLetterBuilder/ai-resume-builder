import { describe, expect, it } from 'vitest';
import type { CVData } from '../../types';
import {
  EXPERIENCE_V3_ENHANCE_ACTION,
  captureExperienceV3EnhanceOperationSnapshot,
  classifyExperienceV3EnhanceRouting,
  resetAiCoreV3TestOverride,
  runExperienceV3EnhanceAdapter,
  setAiCoreV3TestOverride,
  type ExperienceV3EnhanceAdapterInput,
  type ExperienceV3EnhanceOperationSnapshot,
  type ExperienceV3EnhanceResponse,
} from '..';
import { executeExperienceV3EnhanceServer } from '../experience-enhance-server';

const SOURCE = 'help customers with service questions.\nkeep accurate records of requests.';
const IMPROVED = [
  'Supports customers by resolving service questions clearly.',
  'Maintains accurate records of customer requests.',
] as const;

function makeCv(locale = 'en'): CVData {
  return {
    id: 'cv-m3',
    name: 'M3 CV',
    personal: { fullName: 'Candidate', email: '', phone: '', address: '', jobTitle: 'Support Specialist', gender: 'female' },
    summary: 'User-owned summary.',
    contentLocale: locale as CVData['contentLocale'],
    experience: [
      {
        id: 'exp-target', company: 'Example Company', position: 'Support Specialist',
        startDate: '2024-01', endDate: '', isPresent: true, description: SOURCE,
        generatedDescription: 'Stale generated prose.', canonicalDescription: 'Stale canonical prose.',
        originalUserDescription: 'Stale original prose.',
      },
      {
        id: 'exp-other', company: 'Prior Company', position: 'Assistant',
        startDate: '2020-01', endDate: '2023-12', isPresent: false,
        description: 'User-owned prior duties.', originalUserDescription: 'User-owned prior duties.',
      },
    ],
    education: [], skills: [], certifications: [], languages: [], templateId: 'modern-minimal', region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function makeInput(overrides: Partial<ExperienceV3EnhanceAdapterInput> = {}): ExperienceV3EnhanceAdapterInput {
  const cv = overrides.cv ?? makeCv(overrides.requestedLocale ?? 'en');
  return {
    enabled: true,
    operationKind: 'experience_enhance',
    operationId: 'operation-m3',
    requestId: 'operation-m3',
    entryId: 'exp-target',
    entryIndexDiagnostic: 0,
    cv,
    industry: 'customer-service',
    level: 'mid',
    gender: 'female',
    requestedLocale: 'en',
    uiLocale: 'en',
    storedContentLocale: 'en',
    exactVisibleDescription: SOURCE,
    jobContextHash: 'job-context-m3',
    usageCountBefore: 9,
    ...overrides,
  };
}

function writerJson(
  snapshot: ExperienceV3EnhanceOperationSnapshot,
  options: {
    units?: readonly string[];
    operationId?: string;
    entryId?: string;
    snapshotHash?: string;
    locale?: string;
    factIds?: readonly string[];
    extra?: Record<string, unknown>;
  } = {},
): string {
  const units = options.units ?? IMPROVED;
  const factIds = options.factIds ?? snapshot.requiredFactIds;
  return JSON.stringify({
    operationId: options.operationId ?? snapshot.operationId,
    entryId: options.entryId ?? snapshot.entryId,
    snapshotHash: options.snapshotHash ?? snapshot.manifest.snapshotHash,
    locale: options.locale ?? snapshot.requestedLocale,
    units: units.map((text, index) => ({ factId: factIds[index], text })),
    ...(options.extra ?? {}),
  });
}

function evaluatorJson(
  snapshot: ExperienceV3EnhanceOperationSnapshot,
  options: {
    semanticStatus?: 'passed' | 'failed';
    languageStatus?: 'passed' | 'failed';
    code?: string;
    materialStatus?: 'material' | 'no_op' | 'degraded';
    materialKind?: string | null;
    sourceEquivalent?: boolean;
    degradationDetected?: boolean;
    extra?: Record<string, unknown>;
  } = {},
): string {
  const semanticStatus = options.semanticStatus ?? 'passed';
  const languageStatus = options.languageStatus ?? 'passed';
  const materialStatus = options.materialStatus ?? 'material';
  const violations = (status: 'passed' | 'failed', category: 'semantic' | 'language_quality') => status === 'passed' ? [] : [{
    code: options.code ?? `${category}_rejected`, category, detail: 'Independent evaluator rejected the candidate.',
    factIds: [...snapshot.requiredFactIds], entryIds: [snapshot.entryId],
  }];
  return JSON.stringify({
    operationId: snapshot.operationId,
    entryId: snapshot.entryId,
    snapshotHash: snapshot.manifest.snapshotHash,
    locale: snapshot.requestedLocale,
    phases: {
      semantic: { status: semanticStatus, violations: violations(semanticStatus, 'semantic') },
      language_quality: { status: languageStatus, violations: violations(languageStatus, 'language_quality') },
    },
    materiality: {
      status: materialStatus,
      kind: options.materialKind === undefined
        ? (materialStatus === 'material' ? 'clarity_improvement' : null)
        : options.materialKind,
      sourceEquivalent: options.sourceEquivalent ?? materialStatus === 'no_op',
      degradationDetected: options.degradationDetected ?? materialStatus === 'degraded',
    },
    ...(options.extra ?? {}),
  });
}

interface ServerOptions {
  writerThrows?: boolean;
  evaluatorThrows?: boolean;
  writerRaw?: string;
  evaluatorRaw?: string;
  writerUnits?: readonly string[];
  evaluator?: Parameters<typeof evaluatorJson>[1];
}

async function serverResponse(
  snapshot: ExperienceV3EnhanceOperationSnapshot,
  options: ServerOptions = {},
  counts = { writer: 0, evaluator: 0 },
): Promise<ExperienceV3EnhanceResponse> {
  return executeExperienceV3EnhanceServer({ manifest: snapshot.manifest }, {
    generate: async () => {
      counts.writer += 1;
      if (options.writerThrows) throw new Error('writer timeout');
      return options.writerRaw ?? writerJson(snapshot, { units: options.writerUnits });
    },
    evaluate: async () => {
      counts.evaluator += 1;
      if (options.evaluatorThrows) throw new Error('evaluator timeout');
      return options.evaluatorRaw ?? evaluatorJson(snapshot, options.evaluator);
    },
  });
}

interface HarnessOptions {
  input?: ExperienceV3EnhanceAdapterInput;
  server?: ServerOptions;
  duringRequest?: (control: {
    getCv: () => CVData; setCv: (value: CVData) => void; setVisible: (value: string) => void;
    setUiLocale: (value: string) => void; setStoredLocale: (value: string) => void;
    setJobContext: (value: string) => void; setActiveOperation: (value: string) => void;
  }) => void;
  mutateResponse?: (response: ExperienceV3EnhanceResponse) => unknown;
  persistResult?: boolean;
  corruptFirstWrite?: 'candidate' | 'locale' | 'provenance' | 'other';
  writeThrows?: boolean;
}

async function runHarness(options: HarnessOptions = {}) {
  const input = options.input ?? makeInput();
  let cv = input.cv;
  let persistedCv = input.cv;
  let visible = input.exactVisibleDescription;
  let uiLocale = input.uiLocale;
  let storedLocale = input.storedContentLocale;
  let jobContext = input.jobContextHash;
  let activeOperation = input.operationId;
  let usage = input.usageCountBefore;
  let requestCount = 0;
  let writeCount = 0;
  let persistCount = 0;
  let usageCallCount = 0;
  const events: string[] = [];
  const transportCounts = { writer: 0, evaluator: 0 };
  const result = await runExperienceV3EnhanceAdapter(input, {
    request: async () => {
      requestCount += 1;
      options.duringRequest?.({
        getCv: () => cv, setCv: (value) => { cv = value; }, setVisible: (value) => { visible = value; },
        setUiLocale: (value) => { uiLocale = value; }, setStoredLocale: (value) => { storedLocale = value; },
        setJobContext: (value) => { jobContext = value; }, setActiveOperation: (value) => { activeOperation = value; },
      });
      const snapshot = captureExperienceV3EnhanceOperationSnapshot(input);
      const response = await serverResponse(snapshot, options.server, transportCounts);
      return options.mutateResponse ? options.mutateResponse(response) : response;
    },
    getLiveState: () => ({
      cv, requestedLocale: input.requestedLocale, uiLocale, storedContentLocale: storedLocale,
      exactVisibleDescription: visible, industry: input.industry, level: input.level, jobContextHash: jobContext,
    }),
    getActiveOperationId: () => activeOperation,
    writeCv: (next) => {
      writeCount += 1;
      events.push('write');
      if (options.writeThrows && writeCount === 1) throw new Error('write failed');
      if (options.corruptFirstWrite && writeCount === 1) {
        cv = {
          ...next,
          experience: next.experience.map((entry) => {
            if (options.corruptFirstWrite === 'other' && entry.id === 'exp-other') {
              return { ...entry, description: 'corrupted other entry' };
            }
            if (entry.id !== input.entryId) return entry;
            if (options.corruptFirstWrite === 'candidate') return { ...entry, description: `${entry.description} corrupt` };
            if (options.corruptFirstWrite === 'locale') return { ...entry, generatedLocale: 'de' };
            if (options.corruptFirstWrite === 'provenance') {
              return { ...entry, aiOutputProvenance: entry.aiOutputProvenance ? { ...entry.aiOutputProvenance, operationMode: 'corrupt' } : undefined };
            }
            return entry;
          }),
        };
        return;
      }
      cv = next;
    },
    persistCv: (next) => {
      persistCount += 1;
      events.push('persist');
      if (options.persistResult === false) return false;
      persistedCv = next;
      return true;
    },
    incrementUsage: () => {
      usageCallCount += 1;
      usage += 1;
      events.push('usage');
    },
  });
  return {
    result, cv, persistedCv, usage, requestCount, writeCount, persistCount, usageCallCount,
    writerCount: transportCounts.writer, evaluatorCount: transportCounts.evaluator, events,
  };
}

describe('M3 A. routing and feature flag', () => {
  it('2. flag false leaves non-empty Experience Enhance on V2', async () => {
    const run = await runHarness({ input: makeInput({ enabled: false }) });
    expect(run.result).toEqual({ kind: 'not_applicable' });
    expect(run.requestCount).toBe(0);
  });

  it('6. flag reset restores false', async () => {
    setAiCoreV3TestOverride(true);
    resetAiCoreV3TestOverride();
    const { isAiCoreV3Enabled } = await import('..');
    expect(isAiCoreV3Enabled()).toBe(false);
  });

  it('7. empty source is not applicable to M3', () => {
    const cv = makeCv(); cv.experience[0].description = '';
    expect(classifyExperienceV3EnhanceRouting(makeInput({ cv, exactVisibleDescription: '' }))).toBe('not_applicable');
  });

  it('8. empty source remains eligible for M2 Generate', async () => {
    const module = await import('..');
    expect(module.classifyExperienceV3Routing({
      enabled: true, operationKind: 'experience_generate', requestedLocale: 'en', uiLocale: 'en',
      storedContentLocale: 'en', exactVisibleDescription: '',
    })).toBe('owned');
  });

  it('9. same-locale non-empty source is M3-applicable when enabled', () => {
    expect(classifyExperienceV3EnhanceRouting(makeInput())).toBe('owned');
  });

  it('10. cross-locale non-empty source is not applicable to M3', () => {
    expect(classifyExperienceV3EnhanceRouting(makeInput({ storedContentLocale: 'de' }))).toBe('not_applicable');
  });

  it('11. requested/UI/stored locale disagreement is not applicable', () => {
    expect(classifyExperienceV3EnhanceRouting(makeInput({ uiLocale: 'fr' }))).toBe('not_applicable');
  });
});

describe('M3 B. source authority and manifest', () => {
  it('13. exact live textarea is selected over stale cvRef text', () => {
    const cv = makeCv(); cv.experience[0].description = 'stale cvRef text';
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput({ cv, exactVisibleDescription: SOURCE }));
    expect(snapshot.manifest.exactSourceText).toBe(SOURCE);
  });

  it('14. exact live textarea is selected over stale persisted text', () => {
    const cv = makeCv(); cv.experience[0].description = 'persisted lag';
    expect(captureExperienceV3EnhanceOperationSnapshot(makeInput({ cv })).sourceAuthority.sourceText).toBe(SOURCE);
  });

  it('15. stale generatedDescription cannot override live text', () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    expect(JSON.stringify(snapshot.manifest)).not.toContain('Stale generated prose');
  });

  it('16. stale canonicalDescription cannot override live text', () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    expect(JSON.stringify(snapshot.manifest)).not.toContain('Stale canonical prose');
  });

  it('17. stale originalUserDescription cannot override live text', () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    expect(JSON.stringify(snapshot.manifest)).not.toContain('Stale original prose');
  });

  it('18. exact source bytes and hashes are frozen before request', () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    expect(snapshot.exactSourceText).toBe(SOURCE);
    expect(snapshot.rawSourceHash).not.toBe(snapshot.normalizedSourceHash);
    expect(Object.isFrozen(snapshot.sourceUnitHashes)).toBe(true);
  });

  it('19. stable entry ID is authority and index is diagnostic only', async () => {
    const run = await runHarness({ duringRequest: ({ getCv, setCv }) => setCv({ ...getCv(), experience: [...getCv().experience].reverse() }) });
    expect(run.result.kind).toBe('handled_success');
    expect(run.cv.experience.find((entry) => entry.id === 'exp-target')?.description).toContain('Supports customers');
  });

  it('20. ordered source units create stable required fact IDs', () => {
    const one = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const two = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    expect(one.requiredFactIds).toEqual(two.requiredFactIds);
    expect(one.manifest.facts.map((fact) => fact.text)).toEqual(SOURCE.split('\n'));
  });

  it('21. missing source units cannot produce an Enhance manifest', () => {
    expect(() => captureExperienceV3EnhanceOperationSnapshot(makeInput({ exactVisibleDescription: '\n  \n' }))).toThrow(/empty/);
  });

  it('22. manifest and snapshot are deeply immutable', () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    expect([Object.isFrozen(snapshot), Object.isFrozen(snapshot.manifest), Object.isFrozen(snapshot.manifest.facts)]).toEqual([true, true, true]);
  });

  it('23. role/company/dates/context are preserved in the snapshot', () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    expect(snapshot).toMatchObject({ roleTitle: 'Support Specialist', company: 'Example Company', dates: { start: { year: 2024, month: 1 }, end: null }, jobContextHash: 'job-context-m3' });
    expect(snapshot.manifest.contextHash).toBe(snapshot.targetEntryContextHash);
  });

  it('24. previous AI-visible output may be the next live source without becoming canonical/original authority', () => {
    const cv = makeCv(); cv.experience[0].generatedDescription = SOURCE; cv.experience[0].description = SOURCE;
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput({ cv }));
    expect(snapshot.sourceAuthority.provenance.detail).toBe('exact_live_experience_textarea');
    expect(snapshot.manifest.exactSourceText).toBe(SOURCE);
  });
});

describe('M3 C. writer, evaluator, and validation', () => {
  it('25. valid M3 operation makes exactly one writer call', async () => {
    const run = await runHarness(); expect(run.writerCount).toBe(1);
  });

  it('26. structurally valid candidate makes exactly one evaluator call', async () => {
    const run = await runHarness(); expect(run.evaluatorCount).toBe(1);
  });

  it('27. structurally invalid writer output makes zero evaluator calls', async () => {
    const run = await runHarness({ server: { writerRaw: '{"bad":true}' } });
    expect([run.result.kind, run.evaluatorCount]).toEqual(['handled_failure', 0]);
  });

  it('28. writer exception/timeout produces handled failure and +0', async () => {
    const run = await runHarness({ server: { writerThrows: true } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('29. malformed JSON produces handled failure and +0', async () => {
    const run = await runHarness({ server: { writerRaw: 'not-json' } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it.each([
    ['30. wrong operation ID is rejected', { operationId: 'wrong' }],
    ['31. wrong entry ID is rejected', { entryId: 'wrong' }],
    ['32. wrong snapshot hash is rejected', { snapshotHash: 'wrong' }],
    ['33. wrong locale is rejected', { locale: 'de' }],
  ])('%s', async (_name, override) => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const run = await runHarness({ server: { writerRaw: writerJson(snapshot, override) } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('34. missing required fact ID is rejected', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const run = await runHarness({ server: { writerRaw: writerJson(snapshot, { units: [IMPROVED[0]], factIds: [snapshot.requiredFactIds[0]] }) } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('35. duplicate fact ID is rejected', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const run = await runHarness({ server: { writerRaw: writerJson(snapshot, { factIds: [snapshot.requiredFactIds[0], snapshot.requiredFactIds[0]] }) } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('36. extra or foreign fact ID is rejected', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const run = await runHarness({ server: { writerRaw: writerJson(snapshot, { factIds: [snapshot.requiredFactIds[0], 'foreign'] }) } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('37. empty unit is rejected', async () => {
    const run = await runHarness({ server: { writerUnits: [IMPROVED[0], ''] } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('38. duplicate or near-duplicate units are rejected', async () => {
    const run = await runHarness({ server: { writerUnits: [IMPROVED[0], IMPROVED[0]] } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('39. heading, commentary, or markdown wrapper is rejected', async () => {
    const run = await runHarness({ server: { writerUnits: ['# Enhanced Experience', IMPROVED[1]] } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it.each([
    ['40. unsupported metric or achievement is rejected', 'invented_metric'],
    ['41. unsupported tool, certification, or leadership claim is rejected', 'invented_tool_or_leadership'],
    ['42. responsibility escalation or universal claim is rejected', 'responsibility_escalation'],
    ['43. cross-entry fact leakage is rejected', 'cross_entry_fact'],
  ])('%s', async (_name, code) => {
    const run = await runHarness({ server: { evaluator: { semanticStatus: 'failed', code } } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('44. wrong target language or script is rejected', async () => {
    const run = await runHarness({ server: { evaluator: { languageStatus: 'failed', code: 'wrong_target_script' } } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('45. wrong employment tense is rejected', async () => {
    const run = await runHarness({ server: { evaluator: { languageStatus: 'failed', code: 'wrong_employment_tense' } } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('46. wrong CV perspective or form is rejected', async () => {
    const run = await runHarness({ server: { evaluator: { languageStatus: 'failed', code: 'wrong_cv_perspective' } } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('47. language-quality failure is rejected', async () => {
    const run = await runHarness({ server: { evaluator: { languageStatus: 'failed', code: 'malformed_spanish_surface' } } });
    expect([run.result.kind, run.writeCount]).toEqual(['handled_failure', 0]);
  });

  it('48. evaluator exception is rejected', async () => {
    const run = await runHarness({ server: { evaluatorThrows: true } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('49. malformed evaluator output is rejected', async () => {
    const run = await runHarness({ server: { evaluatorRaw: '{"bad":true}' } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('50. evaluator replacement prose is rejected', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const run = await runHarness({ server: { evaluatorRaw: evaluatorJson(snapshot, { extra: { correctedUnits: IMPROVED } }) } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('51. evaluator apply or usage authority fields are rejected', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const run = await runHarness({ server: { evaluatorRaw: evaluatorJson(snapshot, { extra: { applyAuthorized: true, usageAuthorized: true } }) } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('rejects malformed fused German morphology through non-writing evaluator evidence', async () => {
    const cv = makeCv('de');
    const source = 'Prüft Unterlagen.\nDokumentiert Abweichungen.';
    const run = await runHarness({
      input: makeInput({ cv, requestedLocale: 'de', uiLocale: 'de', storedContentLocale: 'de', exactVisibleDescription: source }),
      server: { writerUnits: ['Unterlagen abprüfe.', 'Abweichungen weiterdokumentierte.'], evaluator: { languageStatus: 'failed', code: 'malformed_german_surface' } },
    });
    expect([run.result.kind, run.writeCount]).toEqual(['handled_failure', 0]);
  });

  it('rejects malformed non-German language output without replacement prose', async () => {
    const run = await runHarness({ server: { evaluator: { languageStatus: 'failed', code: 'malformed_english_surface' } } });
    expect([run.result.kind, run.writeCount]).toEqual(['handled_failure', 0]);
  });
});

describe('M3 D. no-op and materiality', () => {
  it('52. exact same text is a no-op and +0', async () => {
    const run = await runHarness({ server: { writerUnits: SOURCE.split('\n') } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('53. whitespace or bullet-only change is a no-op and +0', async () => {
    const run = await runHarness({ server: { writerUnits: ['  help customers with service questions. ', '- keep accurate records of requests.'] } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('54. punctuation-only change is a no-op and +0', async () => {
    const run = await runHarness({ server: { writerUnits: ['help customers with service questions!', 'keep accurate records of requests!'] } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('55. neutral synonym restyle without quality evidence is a no-op and +0', async () => {
    const run = await runHarness({ server: { evaluator: { materialStatus: 'no_op' } } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('56. genuine grammar correction can be accepted', async () => {
    const source = 'supports customers.\nkeeps records.';
    const cv = makeCv(); cv.experience[0].description = source;
    const run = await runHarness({ input: makeInput({ cv, exactVisibleDescription: source }), server: { writerUnits: ['Supports customers.', 'Keeps records.'], evaluator: { materialKind: 'grammar_correction' } } });
    expect(run.result.kind).toBe('handled_success');
  });

  it('57. genuine clarity or professional phrasing improvement can be accepted', async () => {
    const run = await runHarness(); expect(run.result.kind).toBe('handled_success');
  });

  it('58. safe concision can be accepted only with complete fact retention', async () => {
    const run = await runHarness({ server: { writerUnits: ['Resolves customer service questions.', 'Records customer requests accurately.'], evaluator: { materialKind: 'safe_concision' } } });
    expect(run.result.kind).toBe('handled_success');
  });

  it('59. hash difference without explicit materiality cannot be accepted', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const invalid = JSON.parse(evaluatorJson(snapshot)); invalid.materiality.kind = null;
    const run = await runHarness({ server: { evaluatorRaw: JSON.stringify(invalid) } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('explicit degradation evidence rejects the candidate and consumes zero usage', async () => {
    const run = await runHarness({ server: { evaluator: { materialStatus: 'degraded' } } });
    expect([run.result.kind, run.usageCallCount]).toEqual(['handled_failure', 0]);
  });

  it('an unspecified generic materiality kind cannot authorize apply', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const invalid = JSON.parse(evaluatorJson(snapshot)); invalid.materiality.kind = 'improved';
    const run = await runHarness({ server: { evaluatorRaw: JSON.stringify(invalid) } });
    expect([run.result.kind, run.writeCount]).toEqual(['handled_failure', 0]);
  });
});

describe('M3 E. race, apply, rollback, and usage', () => {
  it('60. entry reordering remains safe by stable ID', async () => {
    const run = await runHarness({ duringRequest: ({ getCv, setCv }) => setCv({ ...getCv(), experience: [...getCv().experience].reverse() }) });
    expect(run.cv.experience.find((entry) => entry.id === 'exp-target')?.description).toContain('Supports customers');
  });

  it('61. entry deletion before apply blocks write and +0', async () => {
    const run = await runHarness({ duringRequest: ({ getCv, setCv }) => setCv({ ...getCv(), experience: getCv().experience.filter((entry) => entry.id !== 'exp-target') }) });
    expect([run.result.kind, run.writeCount, run.usageCallCount]).toEqual(['handled_failure', 0, 0]);
  });

  it('62. user edit during request blocks write and +0', async () => {
    const run = await runHarness({ duringRequest: ({ setVisible }) => setVisible(`${SOURCE} user edit`) });
    expect([run.result.kind, run.writeCount, run.usageCallCount]).toEqual(['handled_failure', 0, 0]);
  });

  it('63. role, company, date, or employment change blocks write and +0', async () => {
    const run = await runHarness({ duringRequest: ({ getCv, setCv }) => setCv({ ...getCv(), experience: getCv().experience.map((entry) => entry.id === 'exp-target' ? { ...entry, company: 'Changed', startDate: '2023-01', isPresent: false, endDate: '2024-01' } : entry) }) });
    expect([run.result.kind, run.writeCount, run.usageCallCount]).toEqual(['handled_failure', 0, 0]);
  });

  it('64. locale or context change blocks write and +0', async () => {
    const run = await runHarness({ duringRequest: ({ setUiLocale, setJobContext }) => { setUiLocale('fr'); setJobContext('changed'); } });
    expect([run.result.kind, run.writeCount, run.usageCallCount]).toEqual(['handled_failure', 0, 0]);
  });

  it('65. successful write changes only approved target fields', async () => {
    const before = makeCv().experience[0]; const run = await runHarness();
    const after = run.cv.experience.find((entry) => entry.id === 'exp-target')!;
    expect(after).toMatchObject({ position: before.position, company: before.company, startDate: before.startDate, endDate: before.endDate, isPresent: before.isPresent });
    expect(after.description).not.toBe(before.description);
  });

  it('66. Summary and every other Experience entry remain unchanged', async () => {
    const before = makeCv(); const run = await runHarness();
    expect(run.cv.summary).toBe(before.summary);
    expect(run.cv.experience.find((entry) => entry.id === 'exp-other')).toEqual(before.experience[1]);
  });

  it('67. canonicalDescription and originalUserDescription remain unchanged', async () => {
    const before = makeCv().experience[0]; const run = await runHarness();
    const after = run.cv.experience.find((entry) => entry.id === 'exp-target')!;
    expect([after.canonicalDescription, after.originalUserDescription]).toEqual([before.canonicalDescription, before.originalUserDescription]);
  });

  it('68. readback hash mismatch rolls back and +0', async () => {
    const run = await runHarness({ corruptFirstWrite: 'candidate' });
    expect([run.result.kind, run.cv.experience[0].description, run.usageCallCount]).toEqual(['handled_failure', SOURCE, 0]);
  });

  it('state write exception restores the source and consumes zero usage', async () => {
    const run = await runHarness({ writeThrows: true });
    expect([run.result.kind, run.cv.experience[0].description, run.usageCallCount]).toEqual(['handled_failure', SOURCE, 0]);
  });

  it('a superseding operation ID blocks the stale operation before write', async () => {
    const run = await runHarness({ duringRequest: ({ setActiveOperation }) => setActiveOperation('newer-operation') });
    expect([run.result.kind, run.writeCount, run.usageCallCount]).toEqual(['handled_failure', 0, 0]);
  });

  it('an unrelated-field readback mutation rolls back the complete CV', async () => {
    const run = await runHarness({ corruptFirstWrite: 'other' });
    expect([run.result.kind, run.cv.experience[1].description, run.usageCallCount])
      .toEqual(['handled_failure', 'User-owned prior duties.', 0]);
  });

  it('69. visible fact validation failure rolls back and +0', async () => {
    const run = await runHarness({ corruptFirstWrite: 'provenance' });
    expect([run.result.kind, run.cv.experience[0].description, run.usageCallCount]).toEqual(['handled_failure', SOURCE, 0]);
  });

  it('70. visible locale, tense, or perspective failure rolls back and +0', async () => {
    const run = await runHarness({ corruptFirstWrite: 'locale' });
    expect([run.result.kind, run.cv.experience[0].description, run.usageCallCount]).toEqual(['handled_failure', SOURCE, 0]);
  });

  it('71. persistence failure rolls back and +0', async () => {
    const run = await runHarness({ persistResult: false });
    expect([run.result.kind, run.cv.experience[0].description, run.usageCallCount]).toEqual(['handled_failure', SOURCE, 0]);
  });

  it('72. successful transaction persists before usage', async () => {
    const run = await runHarness(); expect(run.events.indexOf('persist')).toBeLessThan(run.events.indexOf('usage'));
  });

  it('73. successful transaction increments exactly once', async () => {
    const run = await runHarness(); expect([run.result.kind, run.usage, run.usageCallCount]).toEqual(['handled_success', 10, 1]);
  });

  it('74. rejection, no-op, and failure never increment', async () => {
    const runs = await Promise.all([
      runHarness({ server: { evaluator: { semanticStatus: 'failed' } } }),
      runHarness({ server: { evaluator: { materialStatus: 'no_op' } } }),
      runHarness({ server: { writerThrows: true } }),
    ]);
    expect(runs.map((run) => run.usageCallCount)).toEqual([0, 0, 0]);
  });
});

expect(EXPERIENCE_V3_ENHANCE_ACTION).toBe('experience_v3_enhance');
