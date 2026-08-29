import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '../../types';
import {
  EXPERIENCE_V3_TERMINAL_DIAG_STORAGE_KEY,
  assertExperienceAiDiagnosticHasNoCvText,
  clearExperienceAiDiagnostics,
  clearExperienceAiDiagnosticsForTests,
  copyExperienceAiDiagnosticsToClipboard,
  getLatestExperienceAiDiagnosticRecord,
  routeExperienceV3PageTerminal,
  summarizeExperienceAiDiagnostic,
} from '../../cv-experience-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  getCvAiDiagnosticHistory,
} from '../../cv-ai-diagnostics-contract';
import {
  clearCvExportDiagnosticsForTests,
  getLatestCvExportDiagnostic,
} from '../../cv-export-diagnostics';
import {
  EXPERIENCE_V3_TERMINAL_REASON_CODES,
  captureExperienceV3OperationSnapshot,
  runExperienceV3GenerateAdapter,
  type ExperienceV3AdapterInput,
  type ExperienceV3AdapterResult,
} from '../experience-generate';
import { executeExperienceV3GenerateServer } from '../experience-generate-server';
import { M4_M2_EVALUATOR_MALFORMED_DEVICE_DIAGNOSTIC_FIXTURE } from '../fixtures/m4-m2-evaluator-malformed-device-diagnostic';

const DEVICE_ROLE = 'Servicetechniker Elektrotechnik';
const DEVICE_EMPLOYER = 'NordWerk Elektroservice Test';
const DE_BULLETS = [
  'Prüft elektrische Anlagen im Rahmen der üblichen Servicetätigkeit.',
  'Dokumentiert ausgeführte Arbeiten nach den geltenden betrieblichen Vorgaben.',
  'Stimmt laufende Serviceaufgaben mit zuständigen Kolleginnen und Kollegen ab.',
] as const;

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    get length() { return values.size; },
  };
}

function makeDeviceCv(): CVData {
  return {
    id: 'device-cv',
    name: 'Device fixture',
    personal: {
      fullName: 'Private Device Candidate',
      email: 'private@example.test',
      phone: '+000000000',
      address: 'Private address',
      jobTitle: DEVICE_ROLE,
      gender: 'male',
    },
    summary: '',
    contentLocale: 'de',
    experience: [{
      id: 'device-entry-stable',
      company: DEVICE_EMPLOYER,
      position: DEVICE_ROLE,
      startDate: '2023-08',
      endDate: '',
      isPresent: true,
      description: '',
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  };
}

function makeDeviceInput(overrides: Partial<ExperienceV3AdapterInput> = {}): ExperienceV3AdapterInput {
  return {
    enabled: true,
    operationKind: 'experience_generate',
    operationId: 'device-operation-id',
    entryId: 'device-entry-stable',
    entryIndexDiagnostic: 0,
    cv: makeDeviceCv(),
    industry: 'engineering',
    level: 'mid',
    diagnosticIndustry: 'engineering',
    diagnosticLevel: 'mid',
    gender: 'male',
    requestedLocale: 'de',
    uiLocale: 'de',
    storedContentLocale: 'de',
    exactVisibleDescription: '',
    usageCountBefore: 0,
    ...overrides,
  };
}

function writerJson(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
): string {
  return JSON.stringify({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    bullets: DE_BULLETS,
  });
}

function evaluatorJson(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  semantic: 'passed' | 'failed' = 'passed',
): string {
  return JSON.stringify({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    phases: {
      semantic: {
        status: semantic,
        violations: semantic === 'passed' ? [] : [{
          code: 'unsupported_claim',
          category: 'semantic',
          detail: 'Unsupported claim detected.',
          entryIds: [manifest.entryId],
        }],
      },
      language_quality: { status: 'passed', violations: [] },
    },
  });
}

type RunMode = 'success' | 'writer_failure' | 'evaluator_malformed' | 'semantic_reject' | 'race_failure';

async function runDeviceFixture(mode: RunMode = 'success') {
  const input = makeDeviceInput();
  let cv = input.cv;
  let visible = '';
  let usage = input.usageCountBefore;
  let httpStatus: number | null = null;
  let writerCalls = 0;
  let evaluatorCalls = 0;
  let writeCalls = 0;
  let persistCalls = 0;
  const result = await runExperienceV3GenerateAdapter(input, {
    request: async ({ manifest }) => {
      const response = await executeExperienceV3GenerateServer({ manifest }, {
        generate: async () => {
          writerCalls += 1;
          if (mode === 'writer_failure') throw new Error('mocked writer transport failure');
          return writerJson(manifest);
        },
        evaluate: async () => {
          evaluatorCalls += 1;
          if (mode === 'evaluator_malformed') return '{"operationId":';
          return evaluatorJson(manifest, mode === 'semantic_reject' ? 'failed' : 'passed');
        },
      });
      httpStatus = response.ok
        ? 200
        : response.typedReason.includes('provider') || response.typedReason.includes('evaluator')
          ? 502
          : 422;
      if (mode === 'race_failure') visible = 'User typed while the request was active.';
      return response;
    },
    getLiveState: () => ({
      cv,
      requestedLocale: 'de',
      uiLocale: 'de',
      storedContentLocale: 'de',
      exactVisibleDescription: visible,
      industry: 'engineering',
      level: 'mid',
    }),
    writeCv: (next) => { writeCalls += 1; cv = next; },
    persistCv: () => { persistCalls += 1; return true; },
    incrementUsage: () => { usage += 1; },
    getUsageCount: () => usage,
    getRouteHttpStatus: () => httpStatus,
  });
  return { result, cv, usage, writerCalls, evaluatorCalls, writeCalls, persistCalls };
}

function routeLikePage(result: ExperienceV3AdapterResult, events: string[] = []): number {
  let legacyV2Calls = 0;
  const handled = routeExperienceV3PageTerminal(result, {
    onSuccess: () => events.push('success_toast'),
    onFailure: () => {
      events.push(getLatestExperienceAiDiagnosticRecord() ? 'diagnostic_before_toast' : 'missing');
      events.push('failure_toast');
    },
  });
  if (!handled) legacyV2Calls += 1;
  return legacyV2Calls;
}

describe('M4 device-test-1 V3 Experience terminal diagnostics', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage());
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => undefined) } });
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
    clearCvExportDiagnosticsForTests();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('1. reports no Experience attempt before any operation', () => {
    expect(getLatestExperienceAiDiagnosticRecord()).toBeNull();
    expect(summarizeExperienceAiDiagnostic(null)).toBeNull();
  });

  it('2. records exactly one terminal record for an M2 handled failure', async () => {
    const run = await runDeviceFixture('writer_failure');
    routeLikePage(run.result);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      EXPERIENCE_V3_TERMINAL_DIAG_STORAGE_KEY,
      expect.any(String),
    );
    expect(getCvAiDiagnosticHistory('experience')).toHaveLength(1);
    expect(summarizeExperienceAiDiagnostic(getLatestExperienceAiDiagnosticRecord())).toMatchObject({
      operationKind: 'experience_v3_generate',
      typedFailureReason: 'provider_request_failed',
    });
  });

  it('3. finalizes diagnostics before the failure toast callback', async () => {
    const events: string[] = [];
    routeLikePage((await runDeviceFixture('writer_failure')).result, events);
    expect(events).toEqual(['diagnostic_before_toast', 'failure_toast']);
  });

  it('4. keeps the visible German Experience description empty on failure', async () => {
    const run = await runDeviceFixture('writer_failure');
    expect(run.cv.experience[0].description).toBe('');
    expect(run.writeCalls).toBe(0);
  });

  it('5. leaves the empty Summary unchanged on failure', async () => {
    expect((await runDeviceFixture('writer_failure')).cv.summary).toBe('');
  });

  it('6. records and consumes zero usage on failure', async () => {
    const run = await runDeviceFixture('writer_failure');
    expect(run.usage).toBe(0);
    expect(run.result.kind !== 'not_applicable' && run.result.diagnostic.usageDelta).toBe(0);
  });

  it('7. invokes legacy V2 zero times for an owned failure', async () => {
    expect(routeLikePage((await runDeviceFixture('writer_failure')).result)).toBe(0);
  });

  it('8. records writer, evaluator, and phase status truthfully', async () => {
    const result = (await runDeviceFixture('writer_failure')).result;
    expect(result.kind).toBe('handled_failure');
    if (result.kind === 'handled_failure') {
      expect(result.diagnostic.writer).toEqual({ attempted: true, result: 'failed' });
      expect(result.diagnostic.evaluator).toEqual({ attempted: false, result: 'not_attempted' });
      expect(result.diagnostic.phases).toEqual({
        structural: 'not_evaluated', semantic: 'not_evaluated', language_quality: 'not_evaluated',
      });
      expect(result.diagnostic.routeHttpStatus).toBe(502);
    }
  });

  it('9. emits a non-empty finite rejection code for validation rejection', async () => {
    const result = (await runDeviceFixture('semantic_reject')).result;
    expect(result.kind).toBe('handled_failure');
    if (result.kind === 'handled_failure') {
      expect(result.diagnostic.rejectionReasonCodes).toEqual(['validation_rejected']);
      expect(EXPERIENCE_V3_TERMINAL_REASON_CODES).toContain(result.diagnostic.rejectionReasonCodes[0]);
    }
  });

  it('10. dedicated Experience copy returns the persisted V3 record', async () => {
    routeLikePage((await runDeviceFixture('writer_failure')).result);
    expect(await copyExperienceAiDiagnosticsToClipboard()).toBe(true);
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(JSON.parse(copied)).toMatchObject({ operation: 'experience_v3_generate' });
  });

  it('11. keeps generic PDF and DOCX export diagnostics separate', async () => {
    routeLikePage((await runDeviceFixture('writer_failure')).result);
    expect({
      pdf: getLatestCvExportDiagnostic('pdf'),
      docx: getLatestCvExportDiagnostic('docx'),
    }).toEqual({ pdf: null, docx: null });
    expect(getLatestExperienceAiDiagnosticRecord()).not.toBeNull();
  });

  it('12. records exactly one handled-success terminal record', async () => {
    const run = await runDeviceFixture('success');
    const events: string[] = [];
    routeLikePage(run.result, events);
    expect(events).toEqual(['success_toast']);
    expect(getCvAiDiagnosticHistory('experience')).toHaveLength(1);
    expect(getLatestExperienceAiDiagnosticRecord()).toMatchObject({ finalDecision: 'accept' });
  });

  it('13. success applies only the stable target entry', async () => {
    const run = await runDeviceFixture('success');
    expect(run.cv.experience).toHaveLength(1);
    expect(run.cv.experience[0].id).toBe('device-entry-stable');
    expect(run.cv.experience[0].description).toContain(DE_BULLETS[0]);
    expect(run.cv.summary).toBe('');
  });

  it('14. success increments usage exactly once after persistence', async () => {
    const run = await runDeviceFixture('success');
    expect(run.usage).toBe(1);
    expect(run.persistCalls).toBe(1);
    expect(run.result.kind === 'handled_success' && run.result.diagnostic.usageDelta).toBe(1);
  });

  it('15. invokes legacy V2 zero times for an owned success', async () => {
    expect(routeLikePage((await runDeviceFixture('success')).result)).toBe(0);
  });

  it('16. permits only not_applicable to continue to V2 without a false M2 record', async () => {
    const input = makeDeviceInput({ enabled: false });
    const result = await runExperienceV3GenerateAdapter(input, {
      request: vi.fn(),
      getLiveState: vi.fn(),
      writeCv: vi.fn(),
      persistCv: vi.fn(),
      incrementUsage: vi.fn(),
    });
    expect(routeLikePage(result)).toBe(1);
    expect(getLatestExperienceAiDiagnosticRecord()).toBeNull();
  });

  it('17. excludes raw CV text and PII from the V3 terminal record', async () => {
    const result = (await runDeviceFixture('writer_failure')).result;
    expect(result.kind).not.toBe('not_applicable');
    if (result.kind !== 'not_applicable') {
      const json = JSON.stringify(result.diagnostic);
      for (const forbidden of [DEVICE_ROLE, DEVICE_EMPLOYER, 'Private Device Candidate', 'private@example.test', '+000000000']) {
        expect(json).not.toContain(forbidden);
      }
      expect(assertExperienceAiDiagnosticHasNoCvText(result.diagnostic)).toEqual([]);
    }
  });

  it('18. clear diagnostics and clear history retain their existing behavior', async () => {
    routeLikePage((await runDeviceFixture('writer_failure')).result);
    expect(getCvAiDiagnosticHistory('experience')).toHaveLength(1);
    clearExperienceAiDiagnostics();
    expect(getLatestExperienceAiDiagnosticRecord()).toBeNull();
    clearCvAiDiagnosticHistory('experience');
    expect(getCvAiDiagnosticHistory('experience')).toEqual([]);
  });

  it('19. operation race failure records +0, no apply, and a failed race guard', async () => {
    const run = await runDeviceFixture('race_failure');
    expect(run.result.kind).toBe('handled_failure');
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        finalDecision: 'race_failure',
        applyAttempted: false,
        applyCommitted: false,
        usageDelta: 0,
        raceGuardResult: 'failed',
      });
    }
    expect(run.cv.experience[0].description).toBe('');
  });

  it('20. preserves explicit writer/evaluator acceptance and fail-closed phase rules', async () => {
    const accepted = (await runDeviceFixture('success')).result;
    const rejected = (await runDeviceFixture('semantic_reject')).result;
    expect(accepted.kind).toBe('handled_success');
    expect(rejected.kind).toBe('handled_failure');
    if (accepted.kind === 'handled_success') {
      expect(accepted.diagnostic.phases).toEqual({
        structural: 'passed', semantic: 'passed', language_quality: 'passed',
      });
    }
    if (rejected.kind === 'handled_failure') {
      expect(rejected.diagnostic.phases.semantic).toBe('failed');
      expect(rejected.diagnostic.applyAuthorized).toBe(false);
      expect(rejected.diagnostic.applyCommitted).toBe(false);
    }
  });

  it('21. records the immutable M4 malformed-evaluator fixture truthfully with no semantic evidence', async () => {
    const fixture = M4_M2_EVALUATOR_MALFORMED_DEVICE_DIAGNOSTIC_FIXTURE;
    expect(Object.isFrozen(fixture)).toBe(true);
    expect(Object.isFrozen(fixture.phases)).toBe(true);
    expect(fixture).toMatchObject({
      routeHttpStatus: 502,
      writer: { attempted: true, result: 'succeeded' },
      evaluator: { attempted: true, result: 'malformed' },
      phases: { structural: 'passed', semantic: 'not_evaluated', language_quality: 'not_evaluated' },
      rejectionReasonCodes: ['evaluator_output_malformed'],
      applyAuthorized: false,
      usageDelta: 0,
      v2FallthroughCount: 0,
    });
    const run = await runDeviceFixture('evaluator_malformed');
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_output_malformed' });
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        routeHttpStatus: fixture.routeHttpStatus,
        writer: fixture.writer,
        evaluator: fixture.evaluator,
        phases: fixture.phases,
        rejectionReasonCodes: fixture.rejectionReasonCodes,
        applyAuthorized: fixture.applyAuthorized,
        usageDelta: fixture.usageDelta,
        v2FallthroughCount: fixture.v2FallthroughCount,
      });
      expect(assertExperienceAiDiagnosticHasNoCvText(run.result.diagnostic)).toEqual([]);
    }
    expect([run.writeCalls, run.persistCalls, run.usage]).toEqual([0, 0, 0]);
    expect(routeLikePage(run.result)).toBe(0);
  });
});
