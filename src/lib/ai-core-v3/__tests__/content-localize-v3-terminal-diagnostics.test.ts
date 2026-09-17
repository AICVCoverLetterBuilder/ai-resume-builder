import { describe, expect, it } from 'vitest';
import { hashExperienceSourceLocaleText } from '../../cv-experience-source-locale';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import { fingerprintText } from '../../cv-export-diagnostics';
import type { CVData } from '../../types';
import {
  assertContentLocalizeV3DiagnosticPrivacy,
  buildContentLocalizeV3TerminalDiagnostic,
  CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_MARKER,
  createEmptyContentLocalizeV3ServerDiagnostic,
  type ContentLocalizeV3DiagnosticPhase,
  type ContentLocalizeV3TerminalDiagnostic,
  type ContentLocalizeV3ServerDiagnostic,
} from '../content-localize-v3-terminal-diagnostics';
import {
  executeContentLocalizeM6Server,
  type ContentLocalizeM6EvaluatorRequest,
  type ContentLocalizeM6RepairRequest,
  type ContentLocalizeM6ServerDependencies,
  type ContentLocalizeM6WriterRequest,
} from '../content-localize-m6-server';
import type {
  ContentLocalizeM6ExperienceSnapshot,
  ContentLocalizeM6Snapshot,
  ContentLocalizeM6SummarySnapshot,
  ContentLocalizeM6TargetLocale,
} from '../content-localize-m6';
import {
  runContentLocalizeV3ClientOperation,
  runContentLocalizeV3ExperienceClientOperation,
  type ContentLocalizeV3ClientDependencies,
  type ContentLocalizeV3ExperienceClientDependencies,
  type ContentLocalizeV3ExperienceCommitReceipt,
  type ContentLocalizeV3ExperienceCommitRequest,
} from '../content-localize-v3-client';
import { readFileSync } from 'node:fs';
import type { SummaryV3CommitReceipt, SummaryV3CommitRequest } from '../summary-generate';
import {
  createContentLocalizeV3ProviderDependencies,
  readContentLocalizeV3ProviderObservation,
  CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES,
} from '../content-localize-v3-provider';

function snapshot(
  kind: 'summary' | 'experience_description' = 'summary',
  sourceText = 'Prüft Prozesse und koordiniert Termine.',
): ContentLocalizeM6Snapshot {
  const common = {
    operationId: 'operation-private-1',
    requestId: 'request-private-1',
    sourceLocale: 'de' as ContentLocalizeM6TargetLocale,
    targetLocale: 'fr' as ContentLocalizeM6TargetLocale,
    sourceText,
    sourceTextHash: kind === 'summary'
      ? hashSummarySourceLocaleText(sourceText)
      : hashExperienceSourceLocaleText(sourceText),
  };
  return kind === 'summary'
    ? Object.freeze({ ...common, kind })
    : Object.freeze({ ...common, kind, experienceEntryId: 'experience-private-1' });
}

function writerOutput(request: ContentLocalizeM6WriterRequest, translatedText = 'Traduction fidèle.') {
  return {
    operationId: request.operationId,
    requestId: request.requestId,
    kind: request.kind,
    sourceTextHash: request.sourceTextHash,
    sourceLocale: request.sourceLocale,
    targetLocale: request.targetLocale,
    ...(request.kind === 'experience_description' ? { experienceEntryId: request.experienceEntryId } : {}),
    translatedText,
  };
}

function evaluatorOutput(request: ContentLocalizeM6EvaluatorRequest, accepted = true) {
  return {
    operationId: request.operationId,
    requestId: request.requestId,
    kind: request.kind,
    sourceTextHash: request.sourceTextHash,
    candidateTextHash: request.candidateTextHash,
    sourceLocale: request.sourceLocale,
    targetLocale: request.targetLocale,
    ...(request.kind === 'experience_description' ? { experienceEntryId: request.experienceEntryId } : {}),
    accepted,
    meaningPreserved: accepted,
    noFactsAdded: accepted,
    noFactsRemoved: accepted,
    factualAnchorsPreserved: accepted,
    targetLocaleSatisfied: accepted,
    professionalCvQuality: accepted,
    noLeakage: accepted,
    reasonCodes: accepted ? [] : ['semantic_rejection'],
  };
}

function serverFixture(overrides: Partial<{
  writer: (request: ContentLocalizeM6WriterRequest) => unknown | Promise<unknown>;
  evaluator: (request: ContentLocalizeM6EvaluatorRequest) => unknown | Promise<unknown>;
  repair: (request: ContentLocalizeM6RepairRequest) => unknown | Promise<unknown>;
}> = {}): ContentLocalizeM6ServerDependencies {
  return {
    writer: async (request) => overrides.writer ? overrides.writer(request) : writerOutput(request),
    evaluator: async (request) => overrides.evaluator ? overrides.evaluator(request) : evaluatorOutput(request),
    repair: async (request) => overrides.repair ? overrides.repair(request) : writerOutput(request, 'Réparation fidèle.'),
  };
}

function summarySnapshot(sourceText = 'Prüft Prozesse und koordiniert Termine.'): ContentLocalizeM6SummarySnapshot {
  return snapshot('summary', sourceText) as ContentLocalizeM6SummarySnapshot;
}

function experienceSnapshot(): ContentLocalizeM6ExperienceSnapshot {
  return snapshot('experience_description') as ContentLocalizeM6ExperienceSnapshot;
}

function experienceCandidateReady(input: ContentLocalizeM6ExperienceSnapshot, translatedText = 'Traduction expérience fidèle.') {
  return {
    status: 'candidate_ready',
    receipt: {
      operationId: input.operationId,
      requestId: input.requestId,
      kind: 'experience_description',
      experienceEntryId: input.experienceEntryId,
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      sourceTextHash: input.sourceTextHash,
      translatedText,
      candidateTextHash: hashExperienceSourceLocaleText(translatedText),
      candidateOrigin: 'primary',
    },
    diagnostic: createEmptyContentLocalizeV3ServerDiagnostic(),
  } as const;
}

function experienceTestCv(input: ContentLocalizeM6ExperienceSnapshot, description = input.sourceText): CVData {
  return { summary: '', experience: [{ id: input.experienceEntryId, description }] } as unknown as CVData;
}

async function runExperienceTruthCase(options: {
  readonly data?: unknown;
  readonly status?: number;
  readonly cv?: CVData;
  readonly getUsageCount?: () => number;
  readonly activeOperationId?: string;
  readonly commitCandidate?: (request: ContentLocalizeV3ExperienceCommitRequest) => ContentLocalizeV3ExperienceCommitReceipt;
} = {}) {
  const input = experienceSnapshot();
  const cv = options.cv || experienceTestCv(input);
  const diagnostics: ContentLocalizeV3TerminalDiagnostic[] = [];
  let commitCalls = 0;
  const dependencies: ContentLocalizeV3ExperienceClientDependencies = {
    request: async () => ({ status: options.status ?? 200, data: options.data ?? experienceCandidateReady(input) }),
    getLiveCv: () => cv,
    getActiveOperationId: () => options.activeOperationId ?? input.operationId,
    commitCandidate: (request) => {
      commitCalls += 1;
      return options.commitCandidate ? options.commitCandidate(request) : {
        kind: 'committed',
        operationId: request.operationId,
        requestId: request.requestId,
        experienceEntryId: request.experienceEntryId,
        candidateTextHash: request.candidateTextHash,
      };
    },
    getUsageCount: options.getUsageCount,
    recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  };
  const outcome = await runContentLocalizeV3ExperienceClientOperation({ snapshot: input, cv, proToken: 'test-token', usageCountBefore: 6 }, dependencies);
  return { input, cv, outcome, diagnostic: diagnostics[0], commitCalls };
}

function summaryCandidateReady(input: ContentLocalizeM6SummarySnapshot, translatedText = 'Traduction fidèle.') {
  return {
    status: 'candidate_ready',
    receipt: {
      operationId: input.operationId,
      requestId: input.requestId,
      kind: 'summary',
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      sourceTextHash: input.sourceTextHash,
      translatedText,
      candidateTextHash: hashSummarySourceLocaleText(translatedText),
      candidateOrigin: 'primary',
    },
    diagnostic: createEmptyContentLocalizeV3ServerDiagnostic(),
  } as const;
}

function summaryTestCv(input: ContentLocalizeM6SummarySnapshot, summary = input.sourceText): CVData {
  return {
    summary,
    summaryOrigin: 'user',
    summaryGeneratedLocale: null,
    summarySourceLocale: input.sourceLocale,
    summarySourceLocaleTextHash: input.sourceTextHash,
    canonicalSummary: null,
    canonicalSnapshot: null,
    contentLocale: input.sourceLocale,
    experience: [],
  } as unknown as CVData;
}

async function runSummaryTruthCase(options: {
  readonly data?: unknown;
  readonly status?: number;
  readonly cv?: CVData;
  readonly liveCv?: CVData;
  readonly getUsageCount?: () => number;
  readonly activeOperationId?: string;
  readonly commitCandidate?: (request: SummaryV3CommitRequest) => SummaryV3CommitReceipt;
} = {}) {
  const input = summarySnapshot();
  const cv = options.cv || summaryTestCv(input);
  const liveCv = options.liveCv || cv;
  const diagnostics: ContentLocalizeV3TerminalDiagnostic[] = [];
  let commitCalls = 0;
  const dependencies: ContentLocalizeV3ClientDependencies = {
    request: async () => ({ status: options.status ?? 200, data: options.data ?? summaryCandidateReady(input) }),
    getLiveCv: () => liveCv,
    getActiveOperationId: () => options.activeOperationId ?? input.operationId,
    commitCandidate: (request) => {
      commitCalls += 1;
      return options.commitCandidate ? options.commitCandidate(request) : {
        kind: 'committed',
        operationId: request.operationId,
        requestId: request.requestId,
        previousCvHash: 'before',
        candidateHash: request.candidateHash,
        requestedLocale: request.requestedLocale,
        actualUsageAfter: request.usageCountBefore + 1,
      } as unknown as Extract<SummaryV3CommitReceipt, { kind: 'committed' }>;
    },
    getUsageCount: options.getUsageCount,
    recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  };
  const outcome = await runContentLocalizeV3ClientOperation({ snapshot: input, cv, proToken: 'test-token', usageCountBefore: 6 }, dependencies);
  return { input, cv, outcome, diagnostic: diagnostics[0], commitCalls };
}

function readServerDiagnostic(result: unknown): ContentLocalizeV3ServerDiagnostic {
  return (result as { diagnostic: ContentLocalizeV3ServerDiagnostic }).diagnostic;
}

describe('content-localize-v3 terminal diagnostics', () => {
  it('emits only bounded hashed metadata and no source or candidate prose', () => {
    const input = snapshot('experience_description', 'PRIVATE source sentence must not be logged');
    const diagnostic = buildContentLocalizeV3TerminalDiagnostic({
      snapshot: input,
      operation: 'experience_translate',
      routeHttpStatus: 200,
      finalDecision: 'accepted',
      applyAuthorized: true,
      applyAttempted: true,
      applyCommitted: true,
      persistenceAttempted: true,
      persistenceResult: 'succeeded',
      raceGuardResult: 'passed',
      usageBefore: 4,
      usageAfter: 5,
    });
    const serialized = JSON.stringify(diagnostic);
    expect(diagnostic.marker).toBe(CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_MARKER);
    expect(diagnostic.targetEntryIdHash).toBeTruthy();
    expect(diagnostic.sourceTextLength).toBe(input.sourceText.length);
    expect(serialized).not.toContain(input.sourceText);
    expect(assertContentLocalizeV3DiagnosticPrivacy(diagnostic)).toEqual([]);
  });

  it('records accepted primary phase and evaluation evidence on the server result', async () => {
    const input = snapshot();
    const result = await executeContentLocalizeM6Server(input, serverFixture());
    expect(result.status).toBe('candidate_ready');
    const diagnostic = readServerDiagnostic(result);
    expect(diagnostic.finalDecision).toBe('accepted');
    expect(diagnostic.writer.attempted).toBe(true);
    expect(diagnostic.writer.result).toBe('succeeded');
    expect(diagnostic.primaryEvaluator.result).toBe('succeeded');
    expect(diagnostic.primaryEvaluation.accepted).toBe(true);
    expect(diagnostic.candidatePresent).toBe(true);
    expect(diagnostic.repair.attempted).toBe(false);
  });

  it('retains primary rejection and repair phase evidence without leaking prose', async () => {
    let evaluationCount = 0;
    const input = snapshot();
    const result = await executeContentLocalizeM6Server(input, serverFixture({
      evaluator: (request) => evaluatorOutput(request, ++evaluationCount > 1),
    }));
    expect(result.status).toBe('candidate_ready');
    const diagnostic = readServerDiagnostic(result);
    expect(diagnostic.primaryEvaluation.accepted).toBe(false);
    expect(diagnostic.repair.attempted).toBe(true);
    expect(diagnostic.repairEvaluator.attempted).toBe(true);
    expect(diagnostic.repairCandidatePresent).toBe(true);
    expect(assertContentLocalizeV3DiagnosticPrivacy(diagnostic)).toEqual([]);
  });

  it('classifies malformed writer and evaluator responses as typed terminal evidence', async () => {
    const malformedWriter = await executeContentLocalizeM6Server(
      snapshot(),
      serverFixture({ writer: () => ({ translatedText: 'missing identity' }) }),
    );
    expect(malformedWriter).toMatchObject({ status: 'handled_failure', reason: 'writer_identity_mismatch' });
    expect(readServerDiagnostic(malformedWriter).writer.result).toBe('malformed');

    const malformedEvaluator = await executeContentLocalizeM6Server(
      snapshot(),
      serverFixture({ evaluator: () => ({ accepted: true }) }),
    );
    expect(malformedEvaluator).toMatchObject({ status: 'handled_failure', reason: 'evaluator_identity_mismatch' });
    expect(readServerDiagnostic(malformedEvaluator).primaryEvaluator.result).toBe('malformed');
  });

  it('classifies writer and evaluator deadlines with hashed provider fingerprints', async () => {
    const deadline = () => {
      const error = new Error('provider secret-shaped detail must never cross the boundary');
      error.name = 'AbortError';
      return error;
    };
    const writerTimeout = await executeContentLocalizeM6Server(
      summarySnapshot(),
      serverFixture({ writer: async () => { throw deadline(); } }),
    );
    expect(writerTimeout).toMatchObject({ status: 'handled_failure', reason: 'deadline_exceeded' });
    expect(readServerDiagnostic(writerTimeout).providerFailureStage).toBe('writer_transport');
    expect(readServerDiagnostic(writerTimeout).providerMessageFingerprint).toBeTruthy();
    expect(assertContentLocalizeV3DiagnosticPrivacy(readServerDiagnostic(writerTimeout))).toEqual([]);

    const structuredProviderError = Object.assign(new Error('private provider detail'), {
      status: 429,
      error: { code: 'rate_limit' },
      retryable: true,
    });
    const structuredProviderFailure = await executeContentLocalizeM6Server(
      summarySnapshot(),
      serverFixture({ writer: async () => { throw structuredProviderError; } }),
    );
    expect(readServerDiagnostic(structuredProviderFailure)).toMatchObject({
      providerHttpStatus: 429,
      providerErrorCode: 'rate_limit',
      providerRetryable: true,
    });

    let evaluatorCalls = 0;
    const evaluatorTimeout = await executeContentLocalizeM6Server(
      summarySnapshot(),
      serverFixture({ evaluator: async () => { evaluatorCalls += 1; throw deadline(); } }),
    );
    expect(evaluatorTimeout).toMatchObject({ status: 'handled_failure', reason: 'deadline_exceeded' });
    expect(evaluatorCalls).toBe(1);
    expect(readServerDiagnostic(evaluatorTimeout).providerFailureStage).toBe('primary_evaluator_transport');
  });

  it('records one client terminal diagnostic with usage delta tied to the commit', async () => {
    const input = summarySnapshot();
    const cv = {
      summary: input.sourceText,
      summaryOrigin: 'user',
      summaryGeneratedLocale: null,
      summarySourceLocale: input.sourceLocale,
      summarySourceLocaleTextHash: input.sourceTextHash,
      canonicalSummary: null,
      canonicalSnapshot: null,
      contentLocale: 'de',
      experience: [],
    } as unknown as CVData;
    const translatedText = 'Traduction fidèle.';
    const diagnostics: unknown[] = [];
    let usage = 2;
    const outcome = await runContentLocalizeV3ClientOperation({
      snapshot: input,
      cv,
      proToken: 'test-token',
      usageCountBefore: usage,
    }, {
      request: async () => ({
        status: 200,
        data: {
          status: 'candidate_ready',
          receipt: {
            operationId: input.operationId,
            requestId: input.requestId,
            kind: 'summary',
            sourceLocale: input.sourceLocale,
            targetLocale: input.targetLocale,
            sourceTextHash: input.sourceTextHash,
            translatedText,
            candidateTextHash: hashSummarySourceLocaleText(translatedText),
            candidateOrigin: 'primary',
          },
          diagnostic: createEmptyContentLocalizeV3ServerDiagnostic(),
        },
      }),
      getLiveCv: () => cv,
      getActiveOperationId: () => input.operationId,
      commitCandidate: () => {
        usage += 1;
        return {
          kind: 'committed',
          operationId: input.operationId,
          requestId: input.requestId,
          previousCvHash: 'before',
          candidateHash: hashSummarySourceLocaleText(translatedText),
          requestedLocale: input.targetLocale,
          usageCountBefore: 2,
          usageCountAfter: 3,
        } as unknown as Extract<SummaryV3CommitReceipt, { kind: 'committed' }>;
      },
      getUsageCount: () => usage,
      recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(outcome.kind).toBe('committed');
    expect(diagnostics).toHaveLength(1);
    expect((diagnostics[0] as { finalDecision: string; usageDelta: number }).finalDecision).toBe('accepted');
    expect((diagnostics[0] as { usageDelta: number }).usageDelta).toBe(1);
  });

  it('records a failed race without applying or incrementing usage', async () => {
    const input = summarySnapshot();
    const diagnostics: unknown[] = [];
    const cv = { summary: input.sourceText, experience: [] } as unknown as CVData;
    const outcome = await runContentLocalizeV3ClientOperation({
      snapshot: input,
      cv,
      proToken: 'test-token',
      usageCountBefore: 7,
    }, {
      request: async () => ({ status: 200, data: { status: 'handled_failure', reason: 'operation_superseded' } }),
      getLiveCv: () => cv,
      getActiveOperationId: () => 'newer-operation',
      commitCandidate: () => { throw new Error('must not commit'); },
      recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(outcome).toEqual({ kind: 'terminal', status: 409, reason: 'operation_superseded' });
    expect(diagnostics).toHaveLength(1);
    expect((diagnostics[0] as { finalDecision: string; usageDelta: number; applyCommitted: boolean }).finalDecision).toBe('race_rejected');
    expect((diagnostics[0] as { usageDelta: number | null }).usageDelta).toBeNull();
    expect((diagnostics[0] as { applyCommitted: boolean }).applyCommitted).toBe(false);
  });

  it('keeps usage at zero for an apply or persistence failure and dispatches once', async () => {
    const input = summarySnapshot();
    const cv = { summary: input.sourceText, experience: [] } as unknown as CVData;
    const diagnostics: unknown[] = [];
    let requests = 0;
    const outcome = await runContentLocalizeV3ClientOperation({
      snapshot: input,
      cv,
      proToken: 'test-token',
      usageCountBefore: 3,
    }, {
      request: async () => {
        requests += 1;
        return { status: 200, data: { status: 'handled_failure', reason: 'repair_failed' } };
      },
      getLiveCv: () => cv,
      getActiveOperationId: () => input.operationId,
      commitCandidate: () => { throw new Error('must not commit after server failure'); },
      recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(outcome).toEqual({ kind: 'terminal', status: 200, reason: 'repair_failed' });
    expect(requests).toBe(1);
    expect((diagnostics[0] as { usageDelta: number | null }).usageDelta).toBeNull();
  });

  it('A-R focused acceptance matrix keeps every terminal class evidence-based', async () => {
    const input = summarySnapshot();
    const runServer = (overrides: Parameters<typeof serverFixture>[0] = {}) => executeContentLocalizeM6Server(input, serverFixture(overrides));

    // A/B/C/D: accepted, primary rejection, repair acceptance, repair rejection.
    const accepted = await runServer();
    expect(accepted.status).toBe('candidate_ready');
    const primaryRejected = await runServer({ evaluator: (request) => evaluatorOutput(request, false) });
    expect(readServerDiagnostic(primaryRejected).primaryEvaluation.accepted).toBe(false);
    let evaluations = 0;
    const repaired = await runServer({ evaluator: (request) => evaluatorOutput(request, ++evaluations > 1) });
    expect(repaired.status).toBe('candidate_ready');
    expect(readServerDiagnostic(repaired).repairEvaluator.result).toBe('succeeded');
    const repairRejected = await runServer({ evaluator: (request) => evaluatorOutput(request, false) });
    expect(repairRejected).toMatchObject({ status: 'handled_failure', reason: 'candidate_rejected' });
    expect(readServerDiagnostic(repairRejected).finalDecision).toBe('rejected');

    // E/F/G/H: deadlines and malformed phase outputs remain typed and distinct.
    const timeout = () => { const error = new Error('private provider detail'); error.name = 'AbortError'; return error; };
    const writerTimeout = await runServer({ writer: async () => { throw timeout(); } });
    expect(readServerDiagnostic(writerTimeout).providerFailureStage).toBe('writer_transport');
    const evaluatorTimeout = await runServer({ evaluator: async () => { throw timeout(); } });
    expect(readServerDiagnostic(evaluatorTimeout).providerFailureStage).toBe('primary_evaluator_transport');
    const malformedWriter = await runServer({ writer: () => ({ translatedText: 'bad' }) });
    expect(readServerDiagnostic(malformedWriter).writer.result).toBe('malformed');
    const malformedEvaluator = await runServer({ evaluator: () => ({ accepted: true }) });
    expect(readServerDiagnostic(malformedEvaluator).primaryEvaluator.result).toBe('malformed');
  });

  it('I/J/K: separates apply, persistence, and race terminal truth', async () => {
    const input = summarySnapshot();
    const cv = { summary: input.sourceText, experience: [] } as unknown as CVData;
    const response = {
      status: 200,
      data: {
        status: 'candidate_ready',
        receipt: {
          operationId: input.operationId, requestId: input.requestId, kind: 'summary',
          sourceLocale: input.sourceLocale, targetLocale: input.targetLocale,
          sourceTextHash: input.sourceTextHash, translatedText: 'Traduction fidèle.',
          candidateTextHash: hashSummarySourceLocaleText('Traduction fidèle.'), candidateOrigin: 'primary',
        },
        diagnostic: createEmptyContentLocalizeV3ServerDiagnostic(),
      },
    } as const;
    const run = async (commitCandidate: (request: SummaryV3CommitRequest) => SummaryV3CommitReceipt) => {
      const diagnostics: ContentLocalizeV3TerminalDiagnostic[] = [];
      const outcome = await runContentLocalizeV3ClientOperation({ snapshot: input, cv, proToken: 'test-token', usageCountBefore: 4 }, {
        request: async () => response,
        getLiveCv: () => cv,
        getActiveOperationId: () => input.operationId,
        commitCandidate,
        getUsageCount: () => 4,
        recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      });
      return { outcome, diagnostic: diagnostics[0] };
    };
    const failedBase = (extra: Record<string, unknown>): SummaryV3CommitReceipt => ({
      kind: 'failed', operationId: input.operationId, requestId: input.requestId,
      reason: 'canonical_commit_failed', canonicalAccepted: false, intendedCandidateHash: 'candidate',
      committedSummaryHash: null, committedContentLocale: null, candidateMatched: false,
      persistenceAttempted: false, persistenceResult: 'skipped', canonicalApplyAttempted: true,
      canonicalApplyResult: 'failed', usageAttempted: false, usageResult: 'skipped',
      usageForwardWriteResult: 'not_attempted', usageVerificationResult: 'not_attempted',
      usageRollbackAttempted: false, usageRollbackResult: 'not_required', actualUsageBefore: 4,
      actualUsageAfter: 4, actualUsageDelta: 0, rollbackAttempted: false, rollbackResult: 'not_required',
      ...extra,
    } as unknown as SummaryV3CommitReceipt);
    const applyFailure = await run(() => failedBase({}));
    expect(applyFailure.diagnostic).toMatchObject({ applyAttempted: true, applyCommitted: false, persistenceAttempted: false, persistenceResult: 'not_attempted' });
    const persistenceFailure = await run(() => failedBase({ reason: 'persistence_failed', persistenceAttempted: true, persistenceResult: 'failed', canonicalApplyAttempted: true }));
    expect(persistenceFailure.diagnostic).toMatchObject({ applyAttempted: true, persistenceAttempted: true, persistenceResult: 'failed' });
    const race = await run(() => failedBase({ reason: 'stale_snapshot', canonicalApplyAttempted: false, canonicalApplyResult: 'skipped' }));
    expect(race.diagnostic).toMatchObject({ finalDecision: 'race_rejected', applyAttempted: false, persistenceAttempted: false, persistenceResult: 'not_attempted' });
  });

  it('L/N: usage is read from the authoritative getter and never synthesized', async () => {
    const input = summarySnapshot();
    const cv = { summary: input.sourceText, experience: [] } as unknown as CVData;
    const diagnostics: ContentLocalizeV3TerminalDiagnostic[] = [];
    let usage = 8;
    const translatedText = 'Traduction fidèle.';
    const outcome = await runContentLocalizeV3ClientOperation({ snapshot: input, cv, proToken: 'test-token', usageCountBefore: usage }, {
      request: async () => ({ status: 200, data: { status: 'candidate_ready', receipt: {
        operationId: input.operationId, requestId: input.requestId, kind: 'summary', sourceLocale: input.sourceLocale,
        targetLocale: input.targetLocale, sourceTextHash: input.sourceTextHash, translatedText,
        candidateTextHash: hashSummarySourceLocaleText(translatedText), candidateOrigin: 'primary',
      }, diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() } }),
      getLiveCv: () => cv, getActiveOperationId: () => input.operationId,
      commitCandidate: () => { usage = 9; return { kind: 'committed', actualUsageAfter: 9 } as unknown as Extract<SummaryV3CommitReceipt, { kind: 'committed' }>; },
      getUsageCount: () => usage, recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(outcome.kind).toBe('committed');
    expect(diagnostics[0]).toMatchObject({ usageBefore: 8, usageAfter: 9, usageDelta: 1 });
    const rejected: ContentLocalizeV3TerminalDiagnostic[] = [];
    await runContentLocalizeV3ClientOperation({ snapshot: input, cv, proToken: 'test-token', usageCountBefore: 9 }, {
      request: async () => ({ status: 422, data: { status: 'handled_failure', reason: 'candidate_rejected' } }),
      getLiveCv: () => cv, getActiveOperationId: () => input.operationId,
      commitCandidate: () => { throw new Error('must not commit'); }, getUsageCount: () => usage,
      recordDiagnostic: (diagnostic) => rejected.push(diagnostic),
    });
    expect(rejected[0]).toMatchObject({ usageBefore: 9, usageAfter: 9, usageDelta: 0 });
    const timeout: ContentLocalizeV3TerminalDiagnostic[] = [];
    await runContentLocalizeV3ClientOperation({ snapshot: input, cv, proToken: 'test-token', usageCountBefore: usage }, {
      request: async () => { throw new Error('transport'); },
      getLiveCv: () => cv, getActiveOperationId: () => input.operationId,
      commitCandidate: () => { throw new Error('must not commit'); }, getUsageCount: () => usage,
      recordDiagnostic: (diagnostic) => timeout.push(diagnostic),
    });
    expect(timeout[0]).toMatchObject({ usageBefore: 9, usageAfter: 9, usageDelta: 0 });
  });

  it('O/Q: one normal confirmation path has one dispatch and preserves request correlation', async () => {
    const input = summarySnapshot();
    const cv = { summary: input.sourceText, experience: [] } as unknown as CVData;
    const diagnostics: ContentLocalizeV3TerminalDiagnostic[] = [];
    let requests = 0;
    await runContentLocalizeV3ClientOperation({ snapshot: input, cv, proToken: 'test-token', usageCountBefore: 0 }, {
      request: async () => { requests += 1; return { status: 200, data: { status: 'handled_failure', reason: 'candidate_rejected' } }; },
      getLiveCv: () => cv, getActiveOperationId: () => input.operationId,
      commitCandidate: () => { throw new Error('must not commit'); }, recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(requests).toBe(1);
    expect(diagnostics[0].requestIdHash).toBe(fingerprintText(input.requestId));
    expect(diagnostics[0].operationIdHash).toBe(fingerprintText(input.operationId));
    expect(readFileSync('src/app/cv-builder/page.tsx', 'utf8')).not.toContain('summaryTranslateConfirmingRef');
  });

  it('P: privacy review rejects no raw localization or provider payload', () => {
    const diagnostic = buildContentLocalizeV3TerminalDiagnostic({
      snapshot: snapshot('experience_description', 'PRIVATE source sentence must not be logged'), operation: 'experience_translate',
      routeHttpStatus: 500, finalDecision: 'transport_failure', applyAuthorized: false, applyAttempted: false,
      applyCommitted: false, persistenceAttempted: false, persistenceResult: 'not_attempted', raceGuardResult: 'not_evaluated',
      usageBefore: 2, usageAfter: 2,
    });
    expect(JSON.stringify(diagnostic)).not.toContain('PRIVATE source sentence');
    expect(assertContentLocalizeV3DiagnosticPrivacy(diagnostic)).toEqual([]);
  });

  it('R: internal diagnostics UI remains explicitly gated and carries the terminal marker', () => {
    const controls = readFileSync('src/components/CvExportDiagnosticsControls.tsx', 'utf8');
    const panel = readFileSync('src/components/InternalContentLocalizationDiagnosticsPanel.tsx', 'utf8');
    expect(controls).toContain('INTERNAL_AI_RESET_ENABLED && ContentLocalizationPanel');
    expect(controls).toContain('if (!INTERNAL_AI_RESET_ENABLED || !Link) return null;');
    expect(panel).toContain('CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC');
  });

  it('P1-P8: provider tool extraction remains strict while shape observation stays side-channel', async () => {
    const input = summarySnapshot();
    const request: ContentLocalizeM6WriterRequest = {
      operationId: input.operationId,
      requestId: input.requestId,
      kind: input.kind,
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      sourceTextHash: input.sourceTextHash,
      sourceText: input.sourceText,
      semanticContract: [],
    };
    const expectedName = CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer;
    const validInput = { ...writerOutput(request) };
    const run = async (response: unknown) => {
      const dependencies = createContentLocalizeV3ProviderDependencies({ invoke: async () => response });
      const parsed = await dependencies.writer(request);
      return { parsed, observation: readContentLocalizeV3ProviderObservation(parsed) };
    };

    const p1 = await run({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: expectedName, input: validInput }] });
    expect(p1.parsed).toMatchObject({ operationId: request.operationId, translatedText: validInput.translatedText });
    expect(p1.observation).toMatchObject({ stopReason: 'tool_use', contentBlockCount: 1, toolBlockCount: 1, expectedToolCount: 1, toolNameMatched: true, toolInputObject: true });

    const malformed: Array<[string, unknown, Partial<ContentLocalizeV3DiagnosticPhase>]> = [
      ['P2 wrong stop reason', { stop_reason: 'end_turn', content: [{ type: 'tool_use', name: expectedName, input: validInput }] }, { stopReason: 'end_turn', toolNameMatched: true }],
      ['P3 text plus tool', { stop_reason: 'tool_use', content: [{ type: 'text', text: 'prose' }, { type: 'tool_use', name: expectedName, input: validInput }] }, { contentBlockCount: 2, textBlockCount: 1, toolBlockCount: 1 }],
      ['P4 multiple tools', { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: expectedName, input: validInput }, { type: 'tool_use', name: expectedName, input: validInput }] }, { contentBlockCount: 2, toolBlockCount: 2 }],
      ['P5 wrong tool name', { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'wrong_tool', input: validInput }] }, { toolNameMatched: false, toolBlockCount: 1 }],
      ['P6 empty content', { stop_reason: 'tool_use', content: [] }, { contentBlockCount: 0, toolBlockCount: 0 }],
      ['P7 non-array content', { stop_reason: 'tool_use', content: { type: 'tool_use', name: expectedName, input: validInput } }, { contentBlockCount: 0, toolBlockCount: 0 }],
      ['P8 missing input', { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: expectedName }] }, { toolNameMatched: true, toolInputObject: false }],
    ];
    for (const [label, response, shape] of malformed) {
      const result = await run(response);
      expect(result.parsed, label).not.toHaveProperty('operationId');
      expect(result.observation, label).toMatchObject(shape);
    }
  });

  it('S1: malformed writer retains observation and baseline writer failure', async () => {
    const input = summarySnapshot();
    const provider = createContentLocalizeV3ProviderDependencies({
      invoke: async (invocation) => invocation.phase === 'writer'
        ? { stop_reason: 'tool_use', content: [] }
        : { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.evaluator, input: evaluatorOutput(invocation.request as ContentLocalizeM6EvaluatorRequest) }] },
    });
    const result = await executeContentLocalizeM6Server(input, provider);
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_failed' });
    expect(readServerDiagnostic(result).writer).toMatchObject({ result: 'malformed', contentBlockCount: 0, toolBlockCount: 0 });
  });

  it('S2: malformed primary evaluator retains observation and baseline evaluator failure', async () => {
    const input = summarySnapshot();
    const provider = createContentLocalizeV3ProviderDependencies({
      invoke: async (invocation) => invocation.phase === 'writer'
        ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer, input: writerOutput(invocation.request as ContentLocalizeM6WriterRequest) }] }
        : { stop_reason: 'end_turn', content: [{ type: 'text', text: 'provider prose' }] },
    });
    const result = await executeContentLocalizeM6Server(input, provider);
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_failed' });
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ result: 'malformed', stopReason: 'end_turn', textBlockCount: 1 });
  });

  it('S3: malformed repair writer retains observation and baseline repair failure', async () => {
    const input = summarySnapshot();
    const provider = createContentLocalizeV3ProviderDependencies({
      invoke: async (invocation) => invocation.phase === 'writer'
        ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer, input: writerOutput(invocation.request as ContentLocalizeM6WriterRequest) }] }
        : invocation.phase === 'evaluator'
          ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.evaluator, input: evaluatorOutput(invocation.request as ContentLocalizeM6EvaluatorRequest, false) }] }
          : { stop_reason: 'tool_use', content: [] },
    });
    const result = await executeContentLocalizeM6Server(input, provider);
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'repair_failed' });
    expect(readServerDiagnostic(result).repair).toMatchObject({ result: 'malformed', contentBlockCount: 0, toolBlockCount: 0 });
  });

  it('S4: malformed repair evaluator retains observation and baseline evaluator failure', async () => {
    const input = summarySnapshot();
    const provider = createContentLocalizeV3ProviderDependencies({
      invoke: async (invocation) => {
        if (invocation.phase === 'writer') return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer, input: writerOutput(invocation.request as ContentLocalizeM6WriterRequest) }] };
        if ((invocation.request as ContentLocalizeM6EvaluatorRequest).candidateOrigin === 'primary') return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.evaluator, input: evaluatorOutput(invocation.request as ContentLocalizeM6EvaluatorRequest, false) }] };
        if (invocation.phase === 'repair') return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.repair, input: writerOutput(invocation.request as ContentLocalizeM6RepairRequest, 'Réparation fidèle.') }] };
        return { stop_reason: 'tool_use', content: [] };
      },
    });
    const result = await executeContentLocalizeM6Server(input, provider);
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_failed' });
    expect(readServerDiagnostic(result).repairEvaluator).toMatchObject({ result: 'malformed', contentBlockCount: 0, toolBlockCount: 0 });
  });

  it('S5: repeated malformed extraction has no process-global observation owner', async () => {
    const providerSource = readFileSync('src/lib/ai-core-v3/content-localize-v3-provider.ts', 'utf8');
    expect(providerSource).not.toContain('PROVIDER_OBSERVATION_SENTINELS');
    const request = summarySnapshot();
    const dependencies = createContentLocalizeV3ProviderDependencies({ invoke: async () => ({ stop_reason: 'tool_use', content: [] }) });
    for (let i = 0; i < 32; i += 1) {
      const parsed = await dependencies.writer({ ...request, sourceText: request.sourceText, semanticContract: [] });
      expect(readContentLocalizeV3ProviderObservation(parsed)).toMatchObject({ contentBlockCount: 0, toolBlockCount: 0 });
    }
  });

  it('S6: observation side-channel is non-enumerable and absent from serialized payloads', async () => {
    const request = summarySnapshot();
    const dependencies = createContentLocalizeV3ProviderDependencies({ invoke: async () => ({ stop_reason: 'tool_use', content: [] }) });
    const malformed = await dependencies.writer({ ...request, sourceText: request.sourceText, semanticContract: [] });
    expect(Object.keys(malformed as object)).toEqual([]);
    expect(JSON.stringify(malformed)).toBe('[]');
    expect(JSON.stringify(malformed)).not.toContain('__contentLocalizeV3Observation');
    expect(readContentLocalizeV3ProviderObservation(malformed)).toBeTruthy();
  });

  it('S7: valid provider tool response remains candidate-ready', async () => {
    const input = summarySnapshot();
    const provider = createContentLocalizeV3ProviderDependencies({
      invoke: async (invocation) => invocation.phase === 'writer'
        ? { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer, input: writerOutput(invocation.request as ContentLocalizeM6WriterRequest) }] }
        : { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.evaluator, input: evaluatorOutput(invocation.request as ContentLocalizeM6EvaluatorRequest) }] },
    });
    const result = await executeContentLocalizeM6Server(input, provider);
    expect(result.status).toBe('candidate_ready');
    expect(JSON.stringify(result)).not.toContain('__contentLocalizeV3Observation');
  });

  it('S8: P1-P8 strict provider matrix remains covered', () => {
    const testSource = readFileSync('src/lib/ai-core-v3/__tests__/content-localize-v3-terminal-diagnostics.test.ts', 'utf8');
    expect(testSource).toContain("it('P1-P8: provider tool extraction remains strict while shape observation stays side-channel'");
  });

  it('S9: F1-F10 baseline reason parity matrix remains covered', () => {
    const testSource = readFileSync('src/lib/ai-core-v3/__tests__/content-localize-v3-terminal-diagnostics.test.ts', 'utf8');
    for (const label of ['F1:', 'F2:', 'F3:', 'F4:', 'F5:', 'F6:', 'F7:', 'F8:', 'F9:', 'F10:']) expect(testSource).toContain(label);
  });

  it('S10: privacy assertion remains clean for observation transport', () => {
    const providerSource = readFileSync('src/lib/ai-core-v3/content-localize-v3-provider.ts', 'utf8');
    expect(providerSource).not.toMatch(/raw provider message|raw summary text|raw experience text/i);
    expect(providerSource).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(providerSource).not.toContain('Authorization');
  });

  it('E1: Experience success uses authoritative usage getter', async () => {
    const result = await runExperienceTruthCase({ getUsageCount: () => 7 });
    expect(result.outcome.kind).toBe('committed');
    expect(result.diagnostic).toMatchObject({ applyAuthorized: true, applyAttempted: true, applyCommitted: true, persistenceAttempted: true, persistenceResult: 'succeeded', usageBefore: 6, usageAfter: 7, usageDelta: 1 });
  });

  it('E2: Experience success without usage getter remains unknown', async () => {
    const result = await runExperienceTruthCase();
    expect(result.outcome.kind).toBe('committed');
    expect(result.diagnostic).toMatchObject({ usageBefore: 6, usageAfter: null, usageDelta: null });
  });

  it('E3: Experience success with throwing usage getter remains unknown', async () => {
    const result = await runExperienceTruthCase({ getUsageCount: () => { throw new Error('usage unavailable'); } });
    expect(result.outcome.kind).toBe('committed');
    expect(result.diagnostic).toMatchObject({ usageAfter: null, usageDelta: null });
  });

  it('E4: Experience validation rejection does not apply or persist', async () => {
    const result = await runExperienceTruthCase({
      getUsageCount: () => 6,
      data: { status: 'handled_failure', reason: 'candidate_rejected', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
    });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'candidate_rejected' });
    expect(result.commitCalls).toBe(0);
    expect(result.diagnostic).toMatchObject({ applyAttempted: false, persistenceAttempted: false, persistenceResult: 'not_attempted', usageAfter: 6, usageDelta: 0 });
  });

  it('E5: Experience stale rejection is a pre-commit race', async () => {
    const input = experienceSnapshot();
    const result = await runExperienceTruthCase({ cv: experienceTestCv(input, 'changed before commit'), getUsageCount: () => 6 });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'stale_snapshot' });
    expect(result.commitCalls).toBe(0);
    expect(result.diagnostic).toMatchObject({ applyAttempted: false, persistenceAttempted: false, persistenceResult: 'not_attempted' });
  });

  it('E6: Experience explicit persistence failure is typed', async () => {
    const result = await runExperienceTruthCase({
      getUsageCount: () => 6,
      commitCandidate: () => ({ kind: 'failed', reason: 'persistence_failed' }),
    });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'persistence_failed' });
    expect(result.diagnostic).toMatchObject({ applyAttempted: true, persistenceAttempted: true, persistenceResult: 'failed' });
  });

  it('E7: Experience commit exception does not claim persistence failed', async () => {
    const result = await runExperienceTruthCase({ getUsageCount: () => 6, commitCandidate: () => { throw new Error('commit phase unavailable'); } });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'commit_operation_failed' });
    expect(result.diagnostic).toMatchObject({ applyAttempted: true, persistenceAttempted: null, persistenceResult: 'unknown' });
  });

  it('E8: Experience provider/deadline failure has no synthetic usage', async () => {
    const result = await runExperienceTruthCase({
      status: 504,
      getUsageCount: () => 6,
      data: { status: 'handled_failure', reason: 'deadline_exceeded', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
    });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'deadline_exceeded' });
    expect(result.commitCalls).toBe(0);
    expect(result.diagnostic).toMatchObject({ applyAttempted: false, persistenceAttempted: false, persistenceResult: 'not_attempted', usageAfter: 6, usageDelta: 0 });
  });

  it('E9: Experience terminal JSON remains privacy-safe', async () => {
    const result = await runExperienceTruthCase({ getUsageCount: () => 6 });
    const serialized = JSON.stringify(result.diagnostic);
    expect(serialized).not.toContain(result.input.sourceText);
    expect(serialized).not.toContain('Traduction expérience fidèle.');
    expect(serialized).not.toContain('test-token');
    expect(assertContentLocalizeV3DiagnosticPrivacy(result.diagnostic as ContentLocalizeV3TerminalDiagnostic)).toEqual([]);
  });

  it('T1: Summary candidate rejection is not apply-authorized', async () => {
    const result = await runSummaryTruthCase({
      data: { status: 'handled_failure', reason: 'candidate_rejected', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
      getUsageCount: () => 6,
    });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'candidate_rejected' });
    expect(result.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false });
  });

  it('T2: Experience candidate rejection is not apply-authorized', async () => {
    const result = await runExperienceTruthCase({
      data: { status: 'handled_failure', reason: 'candidate_rejected', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
      getUsageCount: () => 6,
    });
    expect(result.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false });
  });

  it('T3: Summary deadline/provider failure is not apply-authorized', async () => {
    const result = await runSummaryTruthCase({
      status: 504,
      data: { status: 'handled_failure', reason: 'deadline_exceeded', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
      getUsageCount: () => 6,
    });
    expect(result.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false });
  });

  it('T4: Experience deadline/provider failure is not apply-authorized', async () => {
    const result = await runExperienceTruthCase({
      status: 504,
      data: { status: 'handled_failure', reason: 'deadline_exceeded', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
      getUsageCount: () => 6,
    });
    expect(result.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false });
  });

  it('T5: invalid authorization snapshot is not apply-authorized', async () => {
    const summary = await runSummaryTruthCase({
      data: { status: 'handled_failure', reason: 'invalid_authorization_snapshot', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
    });
    const experience = await runExperienceTruthCase({
      data: { status: 'handled_failure', reason: 'invalid_authorization_snapshot', diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() },
    });
    expect(summary.diagnostic?.applyAuthorized).toBe(false);
    expect(experience.diagnostic?.applyAuthorized).toBe(false);
  });

  it('T6: validated Summary candidate followed by stale race remains authorized but is not attempted', async () => {
    const input = summarySnapshot();
    const result = await runSummaryTruthCase({ cv: summaryTestCv(input), liveCv: summaryTestCv(input, 'changed before commit'), getUsageCount: () => 6 });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'stale_snapshot' });
    expect(result.commitCalls).toBe(0);
    expect(result.diagnostic).toMatchObject({ applyAuthorized: true, applyAttempted: false, applyCommitted: false });
  });

  it('T7: validated Experience candidate followed by stale race remains authorized but is not attempted', async () => {
    const input = experienceSnapshot();
    const result = await runExperienceTruthCase({ cv: experienceTestCv(input, 'changed before commit'), getUsageCount: () => 6 });
    expect(result.outcome).toMatchObject({ kind: 'terminal', reason: 'stale_snapshot' });
    expect(result.commitCalls).toBe(0);
    expect(result.diagnostic).toMatchObject({ applyAuthorized: true, applyAttempted: false, applyCommitted: false });
  });

  it('T8: wrong stop reason rejects while raw matching tool shape remains observable', async () => {
    const input = summarySnapshot();
    const request = {
      operationId: input.operationId, requestId: input.requestId, kind: input.kind,
      sourceLocale: input.sourceLocale, targetLocale: input.targetLocale, sourceTextHash: input.sourceTextHash,
      sourceText: input.sourceText, semanticContract: [],
    } as ContentLocalizeM6WriterRequest;
    const dependencies = createContentLocalizeV3ProviderDependencies({ invoke: async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer, input: writerOutput(request) }],
    }) });
    const parsed = await dependencies.writer(request);
    expect(parsed).not.toHaveProperty('operationId');
    expect(readContentLocalizeV3ProviderObservation(parsed)).toMatchObject({ toolNameMatched: true, toolInputObject: true });
  });

  it('T9: text plus matching tool rejects while raw object input remains observable', async () => {
    const input = summarySnapshot();
    const request = {
      operationId: input.operationId, requestId: input.requestId, kind: input.kind,
      sourceLocale: input.sourceLocale, targetLocale: input.targetLocale, sourceTextHash: input.sourceTextHash,
      sourceText: input.sourceText, semanticContract: [],
    } as ContentLocalizeM6WriterRequest;
    const dependencies = createContentLocalizeV3ProviderDependencies({ invoke: async () => ({
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: 'prose' },
        { type: 'tool_use', name: CONTENT_LOCALIZE_V3_PROVIDER_TOOL_NAMES.writer, input: writerOutput(request) },
      ],
    }) });
    const parsed = await dependencies.writer(request);
    expect(parsed).not.toHaveProperty('operationId');
    expect(readContentLocalizeV3ProviderObservation(parsed)).toMatchObject({ toolNameMatched: true, toolInputObject: true, contentBlockCount: 2, textBlockCount: 1, toolBlockCount: 1 });
  });

  it('T10: writer valid schema with wrong identity reports schema true and identity false', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({
      writer: (request) => ({ ...writerOutput(request), operationId: 'wrong-operation' }),
    }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_identity_mismatch' });
    expect(readServerDiagnostic(result).writer).toMatchObject({ toolInputSchemaPassed: true, identityPassed: false });
  });

  it('T11: evaluator valid schema with wrong identity reports schema true and identity false', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({
      evaluator: (request) => ({ ...evaluatorOutput(request), requestId: 'wrong-request' }),
    }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_identity_mismatch' });
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ toolInputSchemaPassed: true, identityPassed: false });
  });

  it('T12: malformed writer schema reports schema false and identity unknown', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ writer: () => ({ translatedText: 'malformed' }) }));
    expect(readServerDiagnostic(result).writer).toMatchObject({ toolInputSchemaPassed: false, identityPassed: null });
  });

  it('T13: malformed evaluator schema reports schema false and identity unknown', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: () => ({ accepted: true }) }));
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ toolInputSchemaPassed: false, identityPassed: null });
  });

  it('T14: repair writer identity mismatch reports independent schema and identity truth', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({
      evaluator: (request) => evaluatorOutput(request, false),
      repair: (request) => ({ ...writerOutput(request, 'repaired'), requestId: 'wrong-repair-request' }),
    }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'repair_identity_mismatch' });
    expect(readServerDiagnostic(result).repair).toMatchObject({ toolInputSchemaPassed: true, identityPassed: false });
  });

  it('T15: repair evaluator identity mismatch reports independent schema and identity truth', async () => {
    let evaluationCalls = 0;
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({
      evaluator: (request) => {
        evaluationCalls += 1;
        return evaluationCalls === 1
          ? evaluatorOutput(request, false)
          : { ...evaluatorOutput(request), requestId: 'wrong-repair-evaluator-request' };
      },
    }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_identity_mismatch' });
    expect(readServerDiagnostic(result).repairEvaluator).toMatchObject({ toolInputSchemaPassed: true, identityPassed: false });
  });

  it('F1: writer valid schema with wrong operation identity preserves baseline reason', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ writer: (request) => ({ ...writerOutput(request), operationId: 'wrong' }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_identity_mismatch' });
    expect(readServerDiagnostic(result).writer).toMatchObject({ toolInputSchemaPassed: true, identityPassed: false });
  });

  it('F2: writer wrong identity plus missing field preserves identity precedence', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ writer: (request) => ({ ...writerOutput(request), operationId: 'wrong', translatedText: undefined }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_identity_mismatch' });
    expect(readServerDiagnostic(result).writer).toMatchObject({ toolInputSchemaPassed: false, identityPassed: false });
  });

  it('F3: writer wrong request identity plus unrelated extra key preserves identity precedence', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ writer: (request) => ({ ...writerOutput(request), requestId: 'wrong', unrelated: true }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_identity_mismatch' });
    expect(readServerDiagnostic(result).writer).toMatchObject({ toolInputSchemaPassed: false, identityPassed: false });
  });

  it('F4: writer valid identity plus extra identity-like key remains writer_failed', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ writer: (request) => ({ ...writerOutput(request), candidateTextHash: 'extra' }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_failed' });
    expect(readServerDiagnostic(result).writer).toMatchObject({ toolInputSchemaPassed: false, identityPassed: true });
  });

  it('F5: writer valid identity plus blank text remains writer_candidate_invalid', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ writer: (request) => ({ ...writerOutput(request), translatedText: '   ' }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_candidate_invalid' });
    expect(readServerDiagnostic(result).writer).toMatchObject({ toolInputSchemaPassed: false, identityPassed: true });
  });

  it('F6: evaluator valid schema with wrong request identity preserves baseline reason', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => ({ ...evaluatorOutput(request), requestId: 'wrong' }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_identity_mismatch' });
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ toolInputSchemaPassed: true, identityPassed: false });
  });

  it('F7: evaluator wrong identity plus missing criterion preserves identity precedence', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => {
      const value = evaluatorOutput(request);
      delete (value as Record<string, unknown>).meaningPreserved;
      return { ...value, requestId: 'wrong' };
    } }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_identity_mismatch' });
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ toolInputSchemaPassed: false, identityPassed: false });
  });

  it('F8: evaluator wrong identity plus malformed reasonCodes preserves identity precedence', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => ({ ...evaluatorOutput(request), requestId: 'wrong', reasonCodes: 'malformed' }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_identity_mismatch' });
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ toolInputSchemaPassed: false, identityPassed: false });
  });

  it('F9: evaluator valid identity plus extra identity-like key remains evaluator_failed', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => ({ ...evaluatorOutput(request), translatedText: 'extra' }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_failed' });
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ toolInputSchemaPassed: false, identityPassed: true });
  });

  it('F10: evaluator valid identity plus malformed criterion remains evaluator_failed', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => ({ ...evaluatorOutput(request), meaningPreserved: 'malformed' }) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'evaluator_failed' });
    expect(readServerDiagnostic(result).primaryEvaluator).toMatchObject({ toolInputSchemaPassed: false, identityPassed: true });
  });

  it('retains Summary server diagnostics through receipt shape and identity rejection', async () => {
    const input = summarySnapshot();
    const serverBase = createEmptyContentLocalizeV3ServerDiagnostic();
    const serverDiagnostic = {
      ...serverBase,
      writer: { ...serverBase.writer, attempted: true, result: 'malformed' as const },
      primaryEvaluator: { ...serverBase.primaryEvaluator, attempted: true, result: 'succeeded' as const },
    };
    const shapeFailure = await runSummaryTruthCase({
      data: { status: 'candidate_ready', receipt: { operationId: input.operationId }, diagnostic: serverDiagnostic },
    });
    expect(shapeFailure.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false, writer: { result: 'malformed' }, primaryEvaluator: { result: 'succeeded' } });
    const identityFailure = await runSummaryTruthCase({
      data: { ...summaryCandidateReady(input), receipt: { ...summaryCandidateReady(input).receipt, candidateTextHash: 'wrong' }, diagnostic: serverDiagnostic },
    });
    expect(identityFailure.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false, writer: { result: 'malformed' }, primaryEvaluator: { result: 'succeeded' } });
  });

  it('retains Experience server diagnostics through receipt identity rejection', async () => {
    const input = experienceSnapshot();
    const serverBase = createEmptyContentLocalizeV3ServerDiagnostic();
    const serverDiagnostic = { ...serverBase, writer: { ...serverBase.writer, attempted: true, result: 'malformed' as const } };
    const ready = experienceCandidateReady(input);
    const result = await runExperienceTruthCase({
      data: { ...ready, receipt: { ...ready.receipt, candidateTextHash: 'wrong' }, diagnostic: serverDiagnostic },
    });
    expect(result.diagnostic).toMatchObject({ applyAuthorized: false, applyAttempted: false, applyCommitted: false, writer: { result: 'malformed' } });
  });

  it('matrix A: accepted primary candidate is terminally accepted', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture());
    expect(result.status).toBe('candidate_ready');
    expect(readServerDiagnostic(result).finalDecision).toBe('accepted');
  });

  it('matrix B: primary semantic rejection is recorded before repair', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => evaluatorOutput(request, false) }));
    const diagnostic = readServerDiagnostic(result);
    expect(diagnostic.primaryEvaluation.accepted).toBe(false);
    expect(diagnostic.repair.attempted).toBe(true);
  });

  it('matrix C: primary rejection followed by repair acceptance is explicit', async () => {
    let calls = 0;
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => evaluatorOutput(request, ++calls > 1) }));
    expect(result.status).toBe('candidate_ready');
    expect(readServerDiagnostic(result).repairEvaluation.accepted).toBe(true);
  });

  it('matrix D: repair evaluator rejection remains a typed rejected terminal', async () => {
    const result = await executeContentLocalizeM6Server(summarySnapshot(), serverFixture({ evaluator: (request) => evaluatorOutput(request, false) }));
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'candidate_rejected' });
    expect(readServerDiagnostic(result).finalDecision).toBe('rejected');
  });

  it('shared diagnostics also record an Experience terminal outcome', async () => {
    const input = snapshot('experience_description') as ContentLocalizeM6ExperienceSnapshot;
    const translatedText = 'Traduction expérience fidèle.';
    const cv = { summary: '', experience: [{ id: input.experienceEntryId, description: input.sourceText }] } as unknown as CVData;
    const diagnostics: ContentLocalizeV3TerminalDiagnostic[] = [];
    const outcome = await runContentLocalizeV3ExperienceClientOperation({ snapshot: input as ContentLocalizeM6Snapshot & { kind: 'experience_description' }, cv, proToken: 'test-token', usageCountBefore: 1 }, {
      request: async () => ({ status: 200, data: { status: 'candidate_ready', receipt: {
        operationId: input.operationId, requestId: input.requestId, kind: 'experience_description', experienceEntryId: input.experienceEntryId,
        sourceLocale: input.sourceLocale, targetLocale: input.targetLocale, sourceTextHash: input.sourceTextHash, translatedText,
        candidateTextHash: hashExperienceSourceLocaleText(translatedText), candidateOrigin: 'primary',
      }, diagnostic: createEmptyContentLocalizeV3ServerDiagnostic() } }),
      getLiveCv: () => cv,
      getActiveOperationId: () => input.operationId,
      commitCandidate: (request) => ({ kind: 'committed', operationId: request.operationId, requestId: request.requestId, experienceEntryId: request.experienceEntryId, candidateTextHash: request.candidateTextHash }),
      getUsageCount: () => 2,
      recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });
    expect(outcome.kind).toBe('committed');
    expect(diagnostics[0]).toMatchObject({ operation: 'experience_translate', finalDecision: 'accepted', applyCommitted: true, persistenceAttempted: true });
  });
});
