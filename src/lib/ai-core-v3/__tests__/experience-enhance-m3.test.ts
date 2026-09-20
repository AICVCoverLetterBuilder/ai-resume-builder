import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type { CVData } from '../../types';
import {
  EXPERIENCE_V3_ENHANCE_ACTION,
  captureExperienceV3EnhanceOperationSnapshot,
  classifyExperienceV3EnhanceRouting,
  mapExperienceV3EnhanceResultToErrorCode,
  resetAiCoreV3TestOverride,
  runExperienceV3EnhanceAdapter,
  setAiCoreV3TestOverride,
  type ExperienceV3EnhanceAdapterInput,
  type ExperienceV3EnhanceOperationSnapshot,
  type ExperienceV3EnhanceResponse,
} from '..';
import {
  executeExperienceV3EnhanceServer,
  createExperienceV3EnhanceProviderTransportError,
  createExperienceV3EnhanceWriterTransportError,
  EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME,
  EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME,
  type ExperienceV3EnhanceEvaluatorResponse,
  type ExperienceV3EnhanceWriterResponse,
} from '../experience-enhance-server';
import {
  AI_PROVIDER_CALL_TIMEOUT_MS,
  AI_SERVER_BUDGET_MS,
  EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
  EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS,
  EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS,
  EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS,
  callProviderWithDeadline,
  computeExperienceV3EnhanceDeadline,
  computeExperienceLocalizationDeadline,
  computeServerDeadline,
} from '@/lib/ai-request-timing';

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
  writerError?: unknown;
  writerDelayMs?: number;
  writerTimeoutMs?: number;
  writerTransportObserved?: (options: { timeout?: number; maxRetries?: number }) => void;
  evaluatorThrows?: boolean;
  evaluatorError?: unknown;
  evaluatorDelayMs?: number;
  evaluatorTimeoutMs?: number;
  evaluatorTransportObserved?: (options: { timeout?: number; maxRetries?: number }) => void;
  writerRaw?: string;
  evaluatorRaw?: string;
  writerResponse?: ExperienceV3EnhanceWriterResponse;
  evaluatorResponse?: ExperienceV3EnhanceEvaluatorResponse;
  writerUnits?: readonly string[];
  evaluator?: Parameters<typeof evaluatorJson>[1];
}

function toolResponse(raw: string, name: string): ExperienceV3EnhanceWriterResponse {
  try {
    return { stopReason: 'tool_use', content: [{ type: 'tool_use', name, input: JSON.parse(raw) }] };
  } catch {
    return { stopReason: 'tool_use', content: [{ type: 'text' }] };
  }
}

function forcedResponse(
  name: string,
  input: unknown,
  options: { stopReason?: string | null; content?: ExperienceV3EnhanceWriterResponse['content'] } = {},
): ExperienceV3EnhanceWriterResponse {
  return {
    stopReason: options.stopReason === undefined ? 'tool_use' : options.stopReason,
    content: options.content ?? [{ type: 'tool_use', name, input }],
  };
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
      if (options.writerError) throw options.writerError;
      const response = options.writerResponse ?? toolResponse(options.writerRaw ?? writerJson(snapshot, { units: options.writerUnits }), EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME);
      if (options.writerDelayMs !== undefined) {
        return callProviderWithDeadline(
          async (transportOptions) => {
            options.writerTransportObserved?.(transportOptions);
          await new Promise((resolve) => setTimeout(resolve, options.writerDelayMs));
            return response;
          },
          computeExperienceLocalizationDeadline(Date.now()),
          options.writerTimeoutMs ?? EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
          'provider',
        );
      }
      return response;
    },
    evaluate: async () => {
      counts.evaluator += 1;
      if (options.evaluatorThrows) throw new Error('evaluator timeout');
      if (options.evaluatorError) throw options.evaluatorError;
      const response = options.evaluatorResponse ?? toolResponse(options.evaluatorRaw ?? evaluatorJson(snapshot, options.evaluator), EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME);
      if (options.evaluatorDelayMs !== undefined) {
        return callProviderWithDeadline(
          async (transportOptions) => {
            options.evaluatorTransportObserved?.(transportOptions);
            await new Promise((resolve) => setTimeout(resolve, options.evaluatorDelayMs));
            return response;
          },
          computeExperienceV3EnhanceDeadline(Date.now()),
          options.evaluatorTimeoutMs ?? EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
          'verifier',
        );
      }
      return response;
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
    getUsageCount: () => usage,
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

  it('6. flag reset restores the M9 V3 default', async () => {
    setAiCoreV3TestOverride(false);
    resetAiCoreV3TestOverride();
    const { isAiCoreV3Enabled } = await import('..');
    expect(isAiCoreV3Enabled()).toBe(true);
  });

  it('7. empty source is not applicable to M3', () => {
    const cv = makeCv(); cv.experience[0].description = '';
    expect(classifyExperienceV3EnhanceRouting(makeInput({ cv, exactVisibleDescription: '' }))).toBe('not_applicable');
  });

  it('8. empty source remains eligible for M2 Generate', async () => {
    const importedModule = await import('..');
    expect(importedModule.classifyExperienceV3Routing({
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
    const run = await runHarness({ server: { evaluator: { languageStatus: 'failed', code: 'malformed_surface' } } });
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
      server: { writerUnits: ['Unterlagen abprüfe.', 'Abweichungen weiterdokumentierte.'], evaluator: { languageStatus: 'failed', code: 'malformed_surface' } },
    });
    expect([run.result.kind, run.writeCount]).toEqual(['handled_failure', 0]);
  });

  it('rejects malformed non-German language output without replacement prose', async () => {
    const run = await runHarness({ server: { evaluator: { languageStatus: 'failed', code: 'malformed_surface' } } });
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

describe('M4 M3 forced-tool transport closure', () => {
  function writerInput(snapshot: ExperienceV3EnhanceOperationSnapshot): Record<string, unknown> {
    return JSON.parse(writerJson(snapshot)) as Record<string, unknown>;
  }

  function evaluatorInput(snapshot: ExperienceV3EnhanceOperationSnapshot): Record<string, unknown> {
    return JSON.parse(evaluatorJson(snapshot)) as Record<string, unknown>;
  }

  it('accepts one exact writer tool and reaches exactly one evaluator tool', async () => {
    const run = await runHarness();
    expect(run.result.kind).toBe('handled_success');
    expect([run.writerCount, run.evaluatorCount]).toEqual([1, 1]);
    if (run.result.kind === 'handled_success') {
      expect(run.result.diagnostic).toMatchObject({
        writerStopReason: 'tool_use', writerContentBlockCount: 1, writerTextBlockCount: 0,
        writerToolBlockCount: 1, writerExpectedToolCount: 1, writerToolNameMatched: true,
        writerToolInputObject: true, writerToolInputSchemaPassed: true, writerIdentityPassed: true,
        evaluatorStopReason: 'tool_use', evaluatorContentBlockCount: 1, evaluatorTextBlockCount: 0,
        evaluatorToolBlockCount: 1, evaluatorExpectedToolCount: 1, evaluatorToolNameMatched: true,
        evaluatorToolInputObject: true, evaluatorToolInputSchemaPassed: true, evaluatorIdentityPassed: true,
      });
    }
  });

  const writerRejections: readonly [string, string, (snapshot: ExperienceV3EnhanceOperationSnapshot) => ExperienceV3EnhanceWriterResponse][] = [
    ['max_tokens', 'writer_max_tokens', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, writerInput(s), { stopReason: 'max_tokens' })],
    ['missing tool', 'writer_tool_missing', () => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, {}, { content: [] })],
    ['multiple tools', 'writer_multiple_tools', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, writerInput(s), { content: [
      { type: 'tool_use', name: EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, input: writerInput(s) },
      { type: 'tool_use', name: EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, input: writerInput(s) },
    ] })],
    ['wrong tool', 'writer_wrong_tool', (s) => forcedResponse('other_tool', writerInput(s))],
    ['text only', 'writer_unexpected_text_block', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, writerInput(s), { content: [{ type: 'text', text: '{"operationId":"..."}' }] })],
    ['fenced JSON text', 'writer_unexpected_text_block', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, writerInput(s), { content: [{ type: 'text', text: '```json\\n{}\\n```' }] })],
    ['commentary plus tool', 'writer_unexpected_text_block', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, writerInput(s), { content: [
      { type: 'text', text: 'commentary' }, { type: 'tool_use', name: EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, input: writerInput(s) },
    ] })],
    ['unexpected block', 'provider_output_malformed', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, writerInput(s), { content: [{ type: 'image' }] })],
    ['malformed input', 'writer_tool_input_malformed', () => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, null)],
    ['missing required key', 'writer_tool_input_malformed', (s) => {
      const input = writerInput(s); delete input.units; return forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, input);
    }],
    ['extra authority key', 'writer_tool_input_malformed', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, { ...writerInput(s), applyAuthorized: true })],
    ['wrong operation identity', 'writer_identity_mismatch', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, { ...writerInput(s), operationId: 'foreign' })],
    ['wrong entry identity', 'writer_identity_mismatch', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, { ...writerInput(s), entryId: 'foreign' })],
    ['wrong snapshot identity', 'writer_identity_mismatch', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, { ...writerInput(s), snapshotHash: 'foreign' })],
    ['wrong locale identity', 'writer_identity_mismatch', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, { ...writerInput(s), locale: 'de' })],
    ['wrong fact ID', 'writer_tool_input_malformed', (s) => {
      const input = writerInput(s) as { units: Array<Record<string, unknown>> }; input.units[0].factId = 'foreign';
      return forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, input);
    }],
    ['wrong fact order', 'writer_tool_input_malformed', (s) => {
      const input = writerInput(s) as { units: Array<Record<string, unknown>> }; [input.units[0], input.units[1]] = [input.units[1], input.units[0]];
      return forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, input);
    }],
    ['wrong stop reason', 'provider_output_malformed', (s) => forcedResponse(EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME, writerInput(s), { stopReason: 'end_turn' })],
  ];

  it.each(writerRejections)('rejects writer $0 as $1 without evaluator, apply, usage, or V2', async (_label, reason, makeResponse) => {
    const run = await runHarness({ server: { writerResponse: makeResponse(captureExperienceV3EnhanceOperationSnapshot(makeInput())) } });
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: reason });
    expect(run.evaluatorCount).toBe(0);
    expect([run.writeCount, run.persistCount, run.usage, run.requestCount]).toEqual([0, 0, 9, 1]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false, v2FallthroughCount: 0 });
      expect(run.result.diagnostic.phases).toEqual({ structural: 'not_evaluated', semantic: 'not_evaluated', language_quality: 'not_evaluated' });
    }
  });

  it('keeps evaluator malformed transport terminal and never applies', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const malformed = forcedResponse(EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME, evaluatorInput(snapshot), { content: [{ type: 'text' }] });
    const run = await runHarness({ server: { evaluatorResponse: malformed } });
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_unexpected_text_block' });
    expect(run.evaluatorCount).toBe(1);
    expect([run.writeCount, run.persistCount, run.usage]).toEqual([0, 0, 9]);
  });

  it('keeps the AAB536 malformed-writer observation non-PII and closes the old text channel', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput({ requestedLocale: 'de', uiLocale: 'de', storedContentLocale: 'de' }));
    const run = await runHarness({ server: { writerResponse: {
      stopReason: 'end_turn', content: [{ type: 'text', text: 'malformed provider JSON' }],
    } } });
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'provider_output_malformed' });
    expect(run.evaluatorCount).toBe(0);
    expect(snapshot.manifest.exactSourceText).not.toContain('AAB');
  });
});

describe('M3 terminal observability', () => {
  it('preserves language rejection evidence and the internal audit across server, adapter, and terminal seams', async () => {
    if (process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED !== 'true') return;
    const diagnostics = await import('../../cv-experience-ai-diagnostics');
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    });
    diagnostics.clearExperienceAiDiagnosticsForTests();
    const run = await runHarness({
      server: { evaluator: { languageStatus: 'failed', code: 'malformed_surface' } },
    });
    expect(run.result.kind).toBe('handled_failure');
    if (run.result.kind !== 'handled_failure') return;
    expect(run.result.diagnostic).toMatchObject({
      candidatePresent: true,
      candidateUnitCount: 2,
      evaluatorStopReason: 'tool_use',
      evaluatorContentBlockCount: 1,
      evaluatorToolBlockCount: 1,
      evaluatorToolNameMatched: true,
      evaluatorToolInputSchemaPassed: true,
      evaluatorIdentityPassed: true,
      semanticViolationCount: 0,
      languageQualityViolationCount: 1,
      languageQualityViolationCodes: ['malformed_surface'],
      primaryValidationRejectionCode: 'malformed_surface',
      applyAuthorized: false,
      applyAttempted: false,
      applyCommitted: false,
      usageDelta: 0,
      v2FallthroughCount: 0,
      persistenceResult: 'not_attempted',
    });
    expect(run.result.internalRejectionAudit?.sourceUnits).toEqual(SOURCE.split('\n'));
    expect(run.result.internalRejectionAudit?.candidate.units.map((unit) => unit.text)).toEqual([...IMPROVED]);
    expect(run.result.internalRejectionAudit?.evaluator.evaluatorStopReason).toBe('tool_use');
    expect(run.result.internalRejectionAudit?.evaluator.languageQualityViolations.map((violation) => violation.code))
      .toEqual(['malformed_surface']);
    diagnostics.routeExperienceV3PageTerminal(run.result, { onSuccess: vi.fn(), onFailure: vi.fn() });
    expect(diagnostics.getLatestExperienceAiDiagnosticRecord()).toMatchObject({
      candidatePresent: true,
      languageQualityViolationCodes: ['malformed_surface'],
    });
    expect(diagnostics.getLatestExperienceV3InternalRejectionAudit()?.candidate.units.map((unit) => unit.text))
      .toEqual([...IMPROVED]);
    const stored = storage.get('cvpro-experience-v3-terminal-diagnostic-v1') || '';
    expect(stored).not.toContain(IMPROVED[0]);
    expect(stored).not.toContain('Independent evaluator rejected');
    diagnostics.clearExperienceAiDiagnosticsForTests();
    vi.unstubAllGlobals();
  });

  it('publishes a safe terminal diagnostic for an owned transport failure', async () => {
    const run = await runHarness({ server: { writerThrows: true } });
    expect(run.result.kind).toBe('handled_failure');
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        operation: 'experience_v3_enhance',
        sourceWasEmpty: false,
        routeHttpStatus: null,
        writer: { attempted: true, result: 'failed' },
        evaluator: { attempted: false, result: 'not_attempted' },
        applyAuthorized: false,
        applyCommitted: false,
        usageBefore: 9,
        usageAfter: 9,
        usageDelta: 0,
        v2FallthroughCount: 0,
        sourceUnitCount: 2,
      });
      expect(JSON.stringify(run.result.diagnostic)).not.toContain(SOURCE);
    }
  });

  it('publishes authoritative post-increment usage before reporting M3 success', async () => {
    const run = await runHarness();
    expect(run.result.kind).toBe('handled_success');
    if (run.result.kind === 'handled_success') {
      expect(run.result.diagnostic).toMatchObject({
        operation: 'experience_v3_enhance',
        usageBefore: 9,
        usageAfter: 10,
        usageDelta: 1,
        applyAuthorized: true,
        applyCommitted: true,
        persistenceResult: 'succeeded',
        v2FallthroughCount: 0,
      });
    }
  });

  it('persists the M3 terminal record before the failure callback and keeps CV text out of generic diagnostics', async () => {
    const diagnostics = await import('../../cv-experience-ai-diagnostics');
    diagnostics.clearExperienceAiDiagnosticsForTests();
    const run = await runHarness({ server: { writerThrows: true } });
    expect(run.result.kind).toBe('handled_failure');
    const callbacks: string[] = [];
    diagnostics.routeExperienceV3PageTerminal(run.result, {
      onSuccess: () => callbacks.push('success'),
      onFailure: () => {
        callbacks.push('failure');
        expect(diagnostics.getLatestExperienceAiDiagnosticRecord()?.operation).toBe('experience_v3_enhance');
      },
    });
    const copied = diagnostics.formatExperienceAiDiagnosticForCopy(
      diagnostics.getLatestExperienceAiDiagnosticRecord()!,
    );
    expect(callbacks).toEqual(['failure']);
    expect(copied).not.toContain(SOURCE);
    diagnostics.clearExperienceAiDiagnosticsForTests();
  });
});

describe('M3 writer provider-failure observability', () => {
  const privateMessage = 'Synthetic private CV text must never persist.';

  function headers(requestId: string): Headers {
    return new Headers({ 'request-id': requestId });
  }

  it('retains safe invalid-request evidence without changing failure behavior', async () => {
    const rawRequestId = 'req-invalid-request-private';
    const error = new BadRequestError(
      400,
      { type: 'invalid_request_error', code: 'invalid_request', message: privateMessage },
      privateMessage,
      headers(rawRequestId),
    );
    const run = await runHarness({ server: { writerError: error } });
    expect(run.result.kind).toBe('handled_failure');
    expect([run.writerCount, run.evaluatorCount, run.writeCount, run.persistCount, run.usageCallCount, run.usage])
      .toEqual([1, 0, 0, 0, 0, 9]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.typedReason).toBe('writer_request_failed');
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'provider_response',
        providerErrorClass: 'BadRequestError',
        providerHttpStatus: 400,
        providerErrorType: 'invalid_request',
        providerErrorCode: 'invalid_request',
        providerRetryable: false,
        applyAuthorized: false,
        applyAttempted: false,
        applyCommitted: false,
        v2FallthroughCount: 0,
        usageDelta: 0,
      });
      expect(run.result.diagnostic.providerRequestIdHash).toMatch(/^v3e-[0-9a-f]{8}$/u);
      expect(run.result.diagnostic.providerMessageFingerprint).toMatch(/^v3e-[0-9a-f]{8}$/u);
      expect(run.result.diagnostic.providerRequestIdHash).not.toContain(rawRequestId);
      expect(JSON.stringify(run.result.diagnostic)).not.toContain(privateMessage);
      const diagnostics = await import('../../cv-experience-ai-diagnostics');
      diagnostics.clearExperienceAiDiagnosticsForTests();
      diagnostics.routeExperienceV3PageTerminal(run.result, { onSuccess: () => undefined, onFailure: () => undefined });
      const copied = diagnostics.formatExperienceAiDiagnosticForCopy(
        diagnostics.getLatestExperienceAiDiagnosticRecord()!,
      );
      expect(copied).toContain('providerErrorType');
      expect(copied).not.toContain(privateMessage);
      diagnostics.clearExperienceAiDiagnosticsForTests();
    }
  });

  it.each([
    ['authentication', new AuthenticationError(401, { type: 'authentication_error', code: 'invalid_api_key', message: privateMessage }, privateMessage, headers('req-auth'))],
    ['permission', new PermissionDeniedError(403, { type: 'permission_error', code: 'permission_denied', message: privateMessage }, privateMessage, headers('req-permission'))],
  ] as const)('classifies %s without changing the fail-closed path', async (expectedType, error) => {
    const run = await runHarness({ server: { writerError: error } });
    expect(run.result.kind).toBe('handled_failure');
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'provider_response',
        providerHttpStatus: expectedType === 'authentication' ? 401 : 403,
        providerErrorType: expectedType,
        providerRetryable: false,
        applyAuthorized: false,
        usageDelta: 0,
      });
      expect(JSON.stringify(run.result.diagnostic)).not.toContain(privateMessage);
    }
    expect([run.evaluatorCount, run.writeCount, run.persistCount, run.usageCallCount]).toEqual([0, 0, 0, 0]);
  });

  it('records rate-limit retryability but never retries the writer', async () => {
    const error = new RateLimitError(
      429,
      { type: 'rate_limit_error', code: 'rate_limit', message: privateMessage },
      privateMessage,
      headers('req-rate-limit'),
    );
    const run = await runHarness({ server: { writerError: error } });
    expect([run.writerCount, run.evaluatorCount, run.usageCallCount]).toEqual([1, 0, 0]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'provider_response', providerHttpStatus: 429,
        providerErrorType: 'rate_limit', providerRetryable: true,
      });
    }
  });

  it('classifies provider 5xx without retrying', async () => {
    const error = new InternalServerError(
      500,
      { type: 'internal_server_error', code: 'internal_server_error', message: privateMessage },
      privateMessage,
      headers('req-provider-5xx'),
    );
    const run = await runHarness({ server: { writerError: error } });
    expect([run.writerCount, run.evaluatorCount, run.usageCallCount]).toEqual([1, 0, 0]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'provider_response', providerHttpStatus: 500,
        providerErrorType: 'provider_5xx', providerRetryable: true,
      });
    }
  });

  it.each([
    ['timeout', new APIConnectionTimeoutError({ message: privateMessage })],
    ['connection/network', new APIConnectionError({ message: privateMessage })],
  ] as const)('classifies %s SDK failures without provider prose', async (expectedType, error) => {
    const run = await runHarness({ server: { writerError: error } });
    expect([run.writerCount, run.evaluatorCount, run.writeCount, run.usageCallCount]).toEqual([1, 0, 0, 0]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'sdk_request', providerHttpStatus: null,
        providerErrorType: expectedType, providerRetryable: expectedType === 'connection/network' ? true : false,
      });
      expect(JSON.stringify(run.result.diagnostic)).not.toContain(privateMessage);
    }
  });

  it('marks response-extraction failures separately', async () => {
    const error = createExperienceV3EnhanceWriterTransportError(new Error(privateMessage), 'response_extraction');
    const run = await runHarness({ server: { writerError: error } });
    expect([run.writerCount, run.evaluatorCount, run.usageCallCount]).toEqual([1, 0, 0]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'response_extraction',
        providerErrorType: 'response_extraction',
        providerHttpStatus: null,
        providerRetryable: false,
      });
      expect(JSON.stringify(run.result.diagnostic)).not.toContain(privateMessage);
    }
  });

  it('keeps an ordinary unknown Error unknown and fail closed', async () => {
    const run = await runHarness({ server: { writerError: new Error(privateMessage) } });
    expect([run.writerCount, run.evaluatorCount, run.writeCount, run.persistCount, run.usageCallCount]).toEqual([1, 0, 0, 0, 0]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'unknown', providerErrorClass: 'Error', providerHttpStatus: null,
        providerErrorType: null, providerErrorCode: null, providerRequestIdHash: null,
        providerRetryable: null, providerStructuralFieldPath: null,
        applyAuthorized: false, applyCommitted: false, v2FallthroughCount: 0, usageDelta: 0,
      });
      expect(JSON.stringify(run.result.diagnostic)).not.toContain(privateMessage);
    }
  });

  it('does not add provider-failure fields to a successful operation', async () => {
    const run = await runHarness();
    expect(run.result.kind).toBe('handled_success');
    if (run.result.kind === 'handled_success') {
      expect(run.result.diagnostic).not.toHaveProperty('providerFailureStage');
      expect(run.result.diagnostic).not.toHaveProperty('providerErrorType');
      expect(run.result.diagnostic.usageDelta).toBe(1);
    }
  });
});

describe('M4 M3 evaluator-failure observability closure', () => {
  const privateMessage = 'Synthetic private evaluator provider text must never persist.';

  function headers(requestId: string): Headers {
    return new Headers({ 'request-id': requestId });
  }

  function expectFailClosed(run: Awaited<ReturnType<typeof runHarness>>): void {
    expect(run.result).toMatchObject({ kind: 'handled_failure' });
    expect([run.writerCount, run.evaluatorCount, run.writeCount, run.persistCount, run.usageCallCount, run.usage])
      .toEqual([1, 1, 0, 0, 0, 9]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        applyAuthorized: false,
        applyAttempted: false,
        applyCommitted: false,
        usageDelta: 0,
        v2FallthroughCount: 0,
      });
      expect(JSON.stringify(run.result.diagnostic)).not.toContain(privateMessage);
    }
  }

  it('classifies evaluator invalid-request errors without changing fail-closed behavior', async () => {
    const error = new BadRequestError(
      400,
      { type: 'invalid_request_error', code: 'invalid_request', message: privateMessage },
      privateMessage,
      headers('req-evaluator-invalid'),
    );
    const run = await runHarness({ server: { evaluatorError: error } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.typedReason).toBe('evaluator_request_failed');
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'provider_response', providerErrorClass: 'BadRequestError', providerHttpStatus: 400,
        providerErrorType: 'invalid_request', providerErrorCode: 'invalid_request', providerRetryable: false,
      });
      expect(run.result.diagnostic.providerRequestIdHash).toMatch(/^v3e-[0-9a-f]{8}$/u);
      expect(run.result.diagnostic.providerMessageFingerprint).toMatch(/^v3e-[0-9a-f]{8}$/u);
      expect(run.result.diagnostic.providerRequestIdHash).not.toContain('req-evaluator-invalid');
    }
  });

  it.each([
    ['authentication', new AuthenticationError(401, { type: 'authentication_error', code: 'invalid_api_key', message: privateMessage }, privateMessage, headers('req-evaluator-auth'))],
    ['permission', new PermissionDeniedError(403, { type: 'permission_error', code: 'permission_denied', message: privateMessage }, privateMessage, headers('req-evaluator-permission'))],
  ] as const)('classifies evaluator %s errors safely', async (_label, error) => {
    const run = await runHarness({ server: { evaluatorError: error } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'provider_response',
        providerHttpStatus: _label === 'authentication' ? 401 : 403,
        providerErrorType: _label,
        providerRetryable: false,
      });
    }
  });

  it('distinguishes evaluator 429 and never retries it', async () => {
    const error = new RateLimitError(
      429,
      { type: 'rate_limit_error', code: 'rate_limit', message: privateMessage },
      privateMessage,
      headers('req-evaluator-rate'),
    );
    const run = await runHarness({ server: { evaluatorError: error } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({ providerFailureStage: 'provider_response', providerHttpStatus: 429, providerErrorType: 'rate_limit', providerRetryable: true });
    }
  });

  it('distinguishes evaluator provider 5xx and never retries it', async () => {
    const error = new InternalServerError(
      500,
      { type: 'internal_server_error', code: 'internal_server_error', message: privateMessage },
      privateMessage,
      headers('req-evaluator-5xx'),
    );
    const run = await runHarness({ server: { evaluatorError: error } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({ providerFailureStage: 'provider_response', providerHttpStatus: 500, providerErrorType: 'provider_5xx', providerRetryable: true });
    }
  });

  it.each([
    ['timeout', new APIConnectionTimeoutError({ message: privateMessage })],
    ['connection/network', new APIConnectionError({ message: privateMessage })],
  ] as const)('classifies evaluator %s SDK failures', async (expectedType, error) => {
    const run = await runHarness({ server: { evaluatorError: error } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'sdk_request', providerHttpStatus: null, providerErrorType: expectedType,
        providerRetryable: expectedType === 'connection/network' ? true : false,
      });
    }
  });

  it('keeps evaluator response-extraction failure distinct from request failure', async () => {
    const error = createExperienceV3EnhanceProviderTransportError(new Error(privateMessage), 'response_extraction');
    const run = await runHarness({ server: { evaluatorError: error } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'response_extraction', providerHttpStatus: null,
        providerErrorType: 'response_extraction', providerRetryable: false,
      });
    }
  });

  it('keeps an ordinary evaluator Error unknown and fail closed', async () => {
    const run = await runHarness({ server: { evaluatorError: new Error(privateMessage) } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'unknown', providerErrorClass: 'Error', providerHttpStatus: null,
        providerErrorType: null, providerErrorCode: null, providerRequestIdHash: null,
        providerRetryable: null, providerStructuralFieldPath: null,
      });
    }
  });

  it('classifies the proven local verifier timeout with truthful stage and type', async () => {
    const error = Object.assign(new Error('verifier_transport_timeout after 8000ms'), {
      name: 'AbortError',
      deadlineOwner: 'verifier_transport',
    });
    const run = await runHarness({ server: { evaluatorError: error } });
    expectFailClosed(run);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        providerFailureStage: 'sdk_request',
        providerErrorClass: 'Error',
        providerHttpStatus: null,
        providerErrorType: 'timeout',
        providerRetryable: false,
        providerMessageFingerprint: 'v3e-de5a1d01',
      });
    }
  });

  it('does not add provider-failure fields to a successful evaluator operation', async () => {
    const run = await runHarness();
    expect(run.result.kind).toBe('handled_success');
    if (run.result.kind === 'handled_success') {
      expect(run.result.diagnostic).not.toHaveProperty('providerFailureStage');
      expect(run.result.diagnostic).not.toHaveProperty('providerErrorType');
    }
  });
});

describe('M4 M3 evaluator timeout budget', () => {
  const start = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('proves the old 8000ms verifier fixture times out before the unchanged response', async () => {
    const response = { marker: 'same-synthetic-evaluator-response' };
    const create = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, AI_PROVIDER_CALL_TIMEOUT_MS + 1));
      return response;
    });
    const pending = callProviderWithDeadline(
      create,
      computeServerDeadline(start),
      AI_PROVIDER_CALL_TIMEOUT_MS,
      'verifier',
    );
    const rejection = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      deadlineOwner: 'verifier_transport',
      configuredTimeoutMs: AI_PROVIDER_CALL_TIMEOUT_MS,
      effectiveTimeoutMs: AI_PROVIDER_CALL_TIMEOUT_MS,
    });
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 1);
    await rejection;
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('proves the production M3 evaluator uses the dedicated 15000ms authority and aligned outer budget', () => {
    const route = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    const m3Start = route.indexOf("if (action === EXPERIENCE_V3_ENHANCE_ACTION)");
    const m3End = route.indexOf("if (action === 'bullets')", m3Start);
    const m3 = route.slice(m3Start, m3End);
    expect(route).toContain("if (action === EXPERIENCE_V3_ENHANCE_ACTION)");
    expect(m3).toMatch(/deadlineAt,\s*undefined,\s*EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,\s*'verifier'/u);
    expect(m3).toMatch(/EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,\s*'provider'/u);
    expect(route).toContain('computeExperienceV3EnhanceDeadline(serverReceivedAt)');
    expect(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS).toBe(15_000);
    expect(EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS).toBe(36_000);
    expect(EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS)
      .toBeGreaterThanOrEqual(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS * 2 + 6_000);
    expect(EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS).toBeLessThan(90_000);
    expect(EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS).toBe(11_500);
    expect(EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS).toBe(27_000);
    expect(EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS)
      .toBeGreaterThan(AI_PROVIDER_CALL_TIMEOUT_MS + EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS + 3_000);
    expect(EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS).toBeGreaterThan(AI_SERVER_BUDGET_MS);
  });

  it('proves the same response after 8000ms succeeds before the new evaluator deadline', async () => {
    const response = { marker: 'same-synthetic-evaluator-response' };
    const create = vi.fn(async (options: { timeout?: number; maxRetries?: number }) => {
      expect(options.timeout).toBe(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS);
      expect(options.maxRetries).toBe(0);
      await new Promise((resolve) => setTimeout(resolve, AI_PROVIDER_CALL_TIMEOUT_MS + 1));
      return response;
    });
    const pending = callProviderWithDeadline(
      create,
      computeExperienceV3EnhanceDeadline(start),
      EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      'verifier',
    );
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 1);
    await expect(pending).resolves.toBe(response);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('still fails closed once transport exceeds the dedicated evaluator deadline', async () => {
    const create = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1));
      return { marker: 'late' };
    });
    const pending = callProviderWithDeadline(
      create,
      computeExperienceV3EnhanceDeadline(start),
      EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      'verifier',
    );
    const rejection = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
      deadlineOwner: 'verifier_transport',
      configuredTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      effectiveTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    await rejection;
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('M4 M3 writer timeout budget', () => {
  const start = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps the historical physical writer timeout fingerprint to the old 8000ms transport deadline', async () => {
    const error = Object.assign(new Error('provider_transport_timeout after 8000ms'), {
      name: 'AbortError',
      deadlineOwner: 'provider_transport',
    });
    const run = await runHarness({ server: { writerError: error } });
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_request_failed' });
    expect([run.writerCount, run.evaluatorCount, run.writeCount, run.persistCount, run.usageCallCount, run.usage])
      .toEqual([1, 0, 0, 0, 0, 9]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        candidatePresent: false,
        writer: { attempted: true, result: 'failed' },
        evaluator: { attempted: false, result: 'not_attempted' },
        providerFailureStage: 'sdk_request',
        providerErrorType: 'timeout',
        providerRetryable: false,
        providerMessageFingerprint: 'v3e-75034834',
        applyAuthorized: false,
        applyAttempted: false,
        applyCommitted: false,
        persistenceResult: 'not_attempted',
        v2FallthroughCount: 0,
        usageDelta: 0,
      });
    }
  });

  it('uses one dedicated 15000ms authority for both production M3 provider stages', () => {
    const route = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    const m3Start = route.indexOf("if (action === EXPERIENCE_V3_ENHANCE_ACTION)");
    const m3End = route.indexOf("if (action === 'bullets')", m3Start);
    const m3 = route.slice(m3Start, m3End);
    expect(route).not.toContain('EXPERIENCE_V3_ENHANCE_WRITER_TIMEOUT_MS');
    expect(m3).toMatch(/generate:[\s\S]*?EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,\s*'provider'/u);
    expect(m3).toMatch(/evaluate:[\s\S]*?EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,\s*'verifier'/u);
    expect(EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS).toBe(11_500);
    expect(EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS).toBe(27_000);
    expect(EXPERIENCE_V3_ROUTE_APPLICATION_BUDGET_MS)
      .toBeGreaterThanOrEqual(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS * 2 + 6_000);
  });

  it('false-green gate: the identical writer response at 8001ms fails old transport and succeeds on the actual new seam', async () => {
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(makeInput());
    const sharedResponse = forcedResponse(
      EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME,
      JSON.parse(writerJson(snapshot)),
    );
    const oldTransport = vi.fn();
    const newTransport = vi.fn();
    const oldPending = runHarness({
      server: {
        writerResponse: sharedResponse,
        writerDelayMs: AI_PROVIDER_CALL_TIMEOUT_MS + 1,
        writerTimeoutMs: AI_PROVIDER_CALL_TIMEOUT_MS,
        writerTransportObserved: oldTransport,
      },
    });
    const newPending = runHarness({
      server: {
        writerResponse: sharedResponse,
        writerDelayMs: AI_PROVIDER_CALL_TIMEOUT_MS + 1,
        writerTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
        writerTransportObserved: newTransport,
      },
    });
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 1);
    const [oldRun, newRun] = await Promise.all([oldPending, newPending]);

    expect(oldTransport).toHaveBeenCalledWith(expect.objectContaining({
      timeout: AI_PROVIDER_CALL_TIMEOUT_MS, maxRetries: 0,
    }));
    expect(newTransport).toHaveBeenCalledWith(expect.objectContaining({
      timeout: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS, maxRetries: 0,
    }));
    expect(oldRun.result).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_request_failed' });
    expect([oldRun.writerCount, oldRun.evaluatorCount, oldRun.writeCount, oldRun.persistCount, oldRun.usageCallCount])
      .toEqual([1, 0, 0, 0, 0]);
    expect(newRun.result.kind).toBe('handled_success');
    expect([newRun.writerCount, newRun.evaluatorCount, newRun.writeCount, newRun.persistCount, newRun.usageCallCount])
      .toEqual([1, 1, 1, 1, 1]);
  });

  it('still fails closed when the writer exceeds the dedicated 15000ms deadline', async () => {
    const pending = runHarness({
      server: {
        writerDelayMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1,
        writerTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      },
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    const run = await pending;
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_request_failed' });
    expect([run.writerCount, run.evaluatorCount, run.writeCount, run.persistCount, run.usageCallCount, run.usage])
      .toEqual([1, 0, 0, 0, 0, 9]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        candidatePresent: false,
        evaluator: { attempted: false, result: 'not_attempted' },
        providerFailureStage: 'sdk_request',
        providerErrorType: 'timeout',
        providerRetryable: false,
        applyAuthorized: false,
        applyAttempted: false,
        applyCommitted: false,
        persistenceResult: 'not_attempted',
        v2FallthroughCount: 0,
        usageDelta: 0,
      });
    }
  });
});

describe('M8 Experience V3 provider deadline contract', () => {
  const start = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('A. accepts a writer that exceeds the retired 11500ms slice but fits the new stage budget', async () => {
    const pending = runHarness({
      server: {
        writerDelayMs: EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS + 1,
        writerTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      },
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS + 1);
    const run = await pending;
    expect(run.result.kind).toBe('handled_success');
  });

  it('B. accepts an evaluator that exceeds the retired 11500ms slice but fits the new stage budget', async () => {
    const pending = runHarness({
      server: {
        evaluatorDelayMs: EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS + 1,
        evaluatorTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      },
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS + 1);
    const run = await pending;
    expect(run.result.kind).toBe('handled_success');
  });

  it('C. still times out and fails closed when a provider exceeds the new stage budget', async () => {
    const pending = runHarness({
      server: {
        writerDelayMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1,
        writerTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      },
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    const run = await pending;
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_request_failed' });
    expect([run.writeCount, run.persistCount, run.usageCallCount, run.usage]).toEqual([0, 0, 0, 9]);
  });

  it('D. keeps a valid writer candidate unapplied when the evaluator times out', async () => {
    const pending = runHarness({
      server: {
        evaluatorDelayMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1,
        evaluatorTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      },
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    const run = await pending;
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_timeout' });
    expect([run.writeCount, run.persistCount, run.usageCallCount, run.usage]).toEqual([0, 0, 0, 9]);
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        candidatePresent: true,
        writer: { attempted: true, result: 'succeeded' },
        evaluator: { attempted: true, result: 'failed' },
        providerFailureStage: 'sdk_request',
        providerErrorType: 'timeout',
        applyAuthorized: false,
        applyAttempted: false,
        applyCommitted: false,
        persistenceResult: 'not_attempted',
        usageIncrementAttempted: false,
      });
    }
  });

  it('E. maps provider timeout diagnostics to the existing request_timeout UX code', async () => {
    const pending = runHarness({
      server: {
        writerDelayMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1,
        writerTimeoutMs: EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS,
      },
    });
    await vi.advanceTimersByTimeAsync(EXPERIENCE_V3_PROVIDER_STAGE_TIMEOUT_MS + 1);
    const run = await pending;
    expect(mapExperienceV3EnhanceResultToErrorCode(run.result)).toBe('request_timeout');
  });

  it('F. keeps genuine evaluator validation rejection on the validation-failed UX code', async () => {
    const run = await runHarness({ server: { evaluator: { semanticStatus: 'failed', code: 'unsupported_claim' } } });
    expect(run.result.kind).toBe('handled_failure');
    expect(mapExperienceV3EnhanceResultToErrorCode(run.result)).toBe('generation_validation_failed');
  });
});

expect(EXPERIENCE_V3_ENHANCE_ACTION).toBe('experience_v3_enhance');
