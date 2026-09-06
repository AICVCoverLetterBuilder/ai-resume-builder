import { describe, expect, it } from 'vitest';
import {
  hashExperienceSourceLocaleText,
} from '../../cv-experience-source-locale';
import {
  hashSummarySourceLocaleText,
} from '../../cv-summary-source-locale';
import {
  CONTENT_LOCALIZE_M6_TARGET_LOCALES,
  type ContentLocalizeM6Snapshot,
  type ContentLocalizeM6TargetKind,
  type ContentLocalizeM6TargetLocale,
} from '../content-localize-m6';
import {
  type ContentLocalizeM6EvaluationCriterion,
  executeContentLocalizeM6Server,
  type ContentLocalizeM6EvaluatorRequest,
  type ContentLocalizeM6RepairRequest,
  type ContentLocalizeM6ServerDependencies,
  type ContentLocalizeM6WriterRequest,
} from '../content-localize-m6-server';

type Calls = {
  writer: ContentLocalizeM6WriterRequest[];
  evaluator: ContentLocalizeM6EvaluatorRequest[];
  repair: ContentLocalizeM6RepairRequest[];
};

type FixtureOverrides = Partial<{
  writer: (request: ContentLocalizeM6WriterRequest) => unknown | Promise<unknown>;
  evaluator: (request: ContentLocalizeM6EvaluatorRequest) => unknown | Promise<unknown>;
  repair: (request: ContentLocalizeM6RepairRequest) => unknown | Promise<unknown>;
}>;

type FixtureObject = Record<string, unknown>;

const MANDATORY_EVALUATION_CRITERIA = [
  'meaningPreserved',
  'noFactsAdded',
  'noFactsRemoved',
  'factualAnchorsPreserved',
  'targetLocaleSatisfied',
  'professionalCvQuality',
  'noLeakage',
] as const satisfies readonly ContentLocalizeM6EvaluationCriterion[];

const EXPECTED_SUPPORTED_LOCALES = [
  'sr',
  'en',
  'hi',
  'ar',
  'ja',
  'de',
  'fr',
  'es',
  'it',
  'hr',
  'pt-BR',
  'ru',
] as const;

function snapshot(
  kind: ContentLocalizeM6TargetKind = 'summary',
  sourceLocale: ContentLocalizeM6TargetLocale = 'de',
  targetLocale: ContentLocalizeM6TargetLocale = 'fr',
  sourceText = 'Prüft Prozesse und koordiniert Termine.',
): ContentLocalizeM6Snapshot {
  const common = {
    operationId: 'm6-operation',
    requestId: 'm6-request',
    sourceLocale,
    targetLocale,
    sourceText,
    sourceTextHash: kind === 'summary'
      ? hashSummarySourceLocaleText(sourceText)
      : hashExperienceSourceLocaleText(sourceText),
  };
  return kind === 'summary'
    ? Object.freeze({ ...common, kind: 'summary' as const }) as ContentLocalizeM6Snapshot
    : Object.freeze({ ...common, kind: 'experience_description' as const, experienceEntryId: 'experience-17' }) as ContentLocalizeM6Snapshot;
}

function writerOutput(request: ContentLocalizeM6WriterRequest, translatedText = 'Texte traduit fidèle.'): FixtureObject {
  const identity = {
    operationId: request.operationId,
    requestId: request.requestId,
    kind: request.kind,
    sourceTextHash: request.sourceTextHash,
    sourceLocale: request.sourceLocale,
    targetLocale: request.targetLocale,
    ...(request.kind === 'experience_description' ? { experienceEntryId: request.experienceEntryId } : {}),
  };
  return { ...identity, translatedText };
}

function evaluatorOutput(
  request: ContentLocalizeM6EvaluatorRequest,
  overrides: Record<string, unknown> = {},
): FixtureObject {
  const identity = {
    operationId: request.operationId,
    requestId: request.requestId,
    kind: request.kind,
    sourceTextHash: request.sourceTextHash,
    candidateTextHash: request.candidateTextHash,
    sourceLocale: request.sourceLocale,
    targetLocale: request.targetLocale,
    ...(request.kind === 'experience_description' ? { experienceEntryId: request.experienceEntryId } : {}),
  };
  return {
    ...identity,
    accepted: true,
    meaningPreserved: true,
    noFactsAdded: true,
    noFactsRemoved: true,
    factualAnchorsPreserved: true,
    targetLocaleSatisfied: true,
    professionalCvQuality: true,
    noLeakage: true,
    reasonCodes: [],
    ...overrides,
  };
}

function fixture(overrides: FixtureOverrides = {}): {
  calls: Calls;
  dependencies: ContentLocalizeM6ServerDependencies;
} {
  const calls: Calls = { writer: [], evaluator: [], repair: [] };
  return {
    calls,
    dependencies: {
      writer: async (request) => {
        calls.writer.push(request);
        return overrides.writer ? overrides.writer(request) : writerOutput(request);
      },
      evaluator: async (request) => {
        calls.evaluator.push(request);
        return overrides.evaluator ? overrides.evaluator(request) : evaluatorOutput(request);
      },
      repair: async (request) => {
        calls.repair.push(request);
        return overrides.repair ? overrides.repair(request) : writerOutput(request, 'Réparation fidèle.');
      },
    },
  };
}

function expectFailure(
  result: Awaited<ReturnType<typeof executeContentLocalizeM6Server>>,
  reason: string,
): void {
  expect(result).toEqual({ status: 'handled_failure', reason });
}

function deadlineError(): Error {
  const error = new Error('deadline');
  error.name = 'AbortError';
  return error;
}

describe('M6.4 cross-locale server candidate contract', () => {
  it.each([
    ['wrong source text hash', { ...snapshot(), sourceTextHash: 'tampered' }],
    ['empty source text', { ...snapshot(), sourceText: '', sourceTextHash: hashSummarySourceLocaleText('') }],
    ['unsupported source locale', { ...snapshot(), sourceLocale: 'pl' }],
    ['unsupported target locale', { ...snapshot(), targetLocale: 'pl' }],
    ['same source and target locale', { ...snapshot(), targetLocale: 'de' }],
    ['empty operation id', { ...snapshot(), operationId: '' }],
    ['empty request id', { ...snapshot(), requestId: '' }],
    ['Experience without entry id', (() => {
      const value = snapshot('experience_description');
      const { experienceEntryId: _ignored, ...withoutEntry } = value as Extract<ContentLocalizeM6Snapshot, { kind: 'experience_description' }>;
      return withoutEntry;
    })()],
    ['invalid runtime kind', { ...snapshot(), kind: 'whole_cv' }],
  ])('fails closed before every model step for %s', async (_name, tampered) => {
    const { calls, dependencies } = fixture();
    const result = await executeContentLocalizeM6Server(tampered as ContentLocalizeM6Snapshot, dependencies);

    expectFailure(result, 'invalid_authorization_snapshot');
    expect(calls.writer).toHaveLength(0);
    expect(calls.evaluator).toHaveLength(0);
    expect(calls.repair).toHaveLength(0);
  });

  it('does not mutate the authorized snapshot or fake outputs and freezes the primary receipt', async () => {
    const input = snapshot();
    const beforeInput = structuredClone(input);
    let rawWriter: unknown;
    let rawEvaluator: unknown;
    let beforeWriter: unknown;
    let beforeEvaluator: unknown;
    const { calls, dependencies } = fixture({
      writer: (request) => {
        rawWriter = writerOutput(request, 'Traduction française exacte.');
        beforeWriter = structuredClone(rawWriter);
        return rawWriter;
      },
      evaluator: (request) => {
        rawEvaluator = evaluatorOutput(request);
        beforeEvaluator = structuredClone(rawEvaluator);
        return rawEvaluator;
      },
    });
    const result = await executeContentLocalizeM6Server(input, dependencies);

    expect(result.status).toBe('candidate_ready');
    if (result.status !== 'candidate_ready') throw new Error('expected candidate_ready');
    expect(result.receipt.candidateOrigin).toBe('primary');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.receipt)).toBe(true);
    expect(Object.isFrozen(calls.writer[0])).toBe(true);
    expect(Object.isFrozen(calls.evaluator[0])).toBe(true);
    expect(input).toEqual(beforeInput);
    expect(rawWriter).toEqual(beforeWriter);
    expect(rawEvaluator).toEqual(beforeEvaluator);
    expect(calls.repair).toHaveLength(0);
  });

  it('uses the M6.3 source authority even when exact source text looks English', async () => {
    const input = snapshot('summary', 'de', 'fr', 'Reviews incoming reports and updates documentation.');
    const { calls, dependencies } = fixture();
    const result = await executeContentLocalizeM6Server(input, dependencies);

    expect(result.status).toBe('candidate_ready');
    expect(calls.writer).toHaveLength(1);
    expect(calls.writer[0].sourceLocale).toBe('de');
    expect(calls.writer[0].targetLocale).toBe('fr');
    expect(Object.keys(calls.writer[0])).not.toContain('contentLocale');
    expect(Object.keys(calls.writer[0])).not.toContain('uiLocale');
  });

  it('rejects writer identity drift before evaluation or repair', async () => {
    const { calls, dependencies } = fixture({
      writer: (request) => ({ ...writerOutput(request), requestId: 'wrong-request' }),
    });
    const result = await executeContentLocalizeM6Server(snapshot(), dependencies);

    expectFailure(result, 'writer_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(0);
    expect(calls.repair).toHaveLength(0);
  });

  it('rejects blank writer text before evaluation or repair', async () => {
    const { calls, dependencies } = fixture({
      writer: (request) => writerOutput(request, '   '),
    });
    const result = await executeContentLocalizeM6Server(snapshot(), dependencies);

    expectFailure(result, 'writer_candidate_invalid');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(0);
    expect(calls.repair).toHaveLength(0);
  });

  it('rejects evaluator identity drift without repair', async () => {
    const { calls, dependencies } = fixture({
      evaluator: (request) => ({ ...evaluatorOutput(request), candidateTextHash: 'wrong-hash' }),
    });
    const result = await executeContentLocalizeM6Server(snapshot(), dependencies);

    expectFailure(result, 'evaluator_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(1);
    expect(calls.repair).toHaveLength(0);
  });

  it.each([
    ['operationId', { operationId: 'wrong-operation' }],
    ['requestId', { requestId: 'wrong-request' }],
    ['kind', { kind: 'experience_description' }],
    ['sourceTextHash', { sourceTextHash: 'wrong-source-hash' }],
    ['sourceLocale', { sourceLocale: 'en' }],
    ['targetLocale', { targetLocale: 'en' }],
  ] as const)('rejects Summary writer identity drift for %s', async (_field, override) => {
    const { calls, dependencies } = fixture({
      writer: (request) => ({ ...writerOutput(request), ...override }),
    });
    const result = await executeContentLocalizeM6Server(snapshot('summary', 'de', 'fr'), dependencies);

    expectFailure(result, 'writer_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(0);
    expect(calls.repair).toHaveLength(0);
  });

  it('rejects Experience writer identity drift for its mandatory entry id', async () => {
    const { calls, dependencies } = fixture({
      writer: (request) => ({ ...writerOutput(request), experienceEntryId: 'wrong-entry' }),
    });
    const result = await executeContentLocalizeM6Server(
      snapshot('experience_description', 'de', 'es'),
      dependencies,
    );

    expectFailure(result, 'writer_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(0);
    expect(calls.repair).toHaveLength(0);
  });

  it('rejects Summary writer output that acquires Experience entry identity', async () => {
    const { calls, dependencies } = fixture({
      writer: (request) => ({ ...writerOutput(request), experienceEntryId: 'unexpected-entry' }),
    });
    const result = await executeContentLocalizeM6Server(snapshot('summary', 'de', 'fr'), dependencies);

      expectFailure(result, 'writer_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(0);
    expect(calls.repair).toHaveLength(0);
  });

  it.each([
    ['operationId', { operationId: 'wrong-operation' }],
    ['requestId', { requestId: 'wrong-request' }],
    ['kind', { kind: 'experience_description' }],
    ['sourceTextHash', { sourceTextHash: 'wrong-source-hash' }],
    ['sourceLocale', { sourceLocale: 'en' }],
    ['targetLocale', { targetLocale: 'en' }],
    ['candidateTextHash', { candidateTextHash: 'wrong-candidate-hash' }],
  ] as const)('rejects Summary evaluator identity drift for %s', async (_field, override) => {
    const { calls, dependencies } = fixture({
      evaluator: (request) => ({ ...evaluatorOutput(request), ...override }),
    });
    const result = await executeContentLocalizeM6Server(snapshot('summary', 'de', 'fr'), dependencies);

    expectFailure(result, 'evaluator_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(1);
    expect(calls.repair).toHaveLength(0);
  });

  it('rejects Experience evaluator identity drift for its mandatory entry id', async () => {
    const { calls, dependencies } = fixture({
      evaluator: (request) => ({ ...evaluatorOutput(request), experienceEntryId: 'wrong-entry' }),
    });
    const result = await executeContentLocalizeM6Server(
      snapshot('experience_description', 'de', 'es'),
      dependencies,
    );

    expectFailure(result, 'evaluator_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(1);
    expect(calls.repair).toHaveLength(0);
  });

  it.each([
    ['Summary operationId', snapshot('summary', 'de', 'fr'), { operationId: 'wrong-repair-operation' }],
    ['Experience entry id', snapshot('experience_description', 'de', 'es'), { experienceEntryId: 'wrong-repair-entry' }],
  ] as const)('rejects repair output identity drift for %s', async (_field, input, override) => {
    const { calls, dependencies } = fixture({
      evaluator: (request) => evaluatorOutput(request, {
        accepted: false,
        reasonCodes: ['semantic_rejection'],
      }),
      repair: (request) => ({ ...writerOutput(request, 'Repair candidate.'), ...override }),
    });
    const result = await executeContentLocalizeM6Server(input, dependencies);

    expectFailure(result, 'repair_identity_mismatch');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(1);
    expect(calls.repair).toHaveLength(1);
  });

  it.each(MANDATORY_EVALUATION_CRITERIA)('does not false-green accepted=true when %s is false', async (criterion) => {
    const { calls, dependencies } = fixture({
      evaluator: (request) => evaluatorOutput(request, {
        accepted: true,
        [criterion]: false,
        reasonCodes: [criterion],
      }),
    });
    const result = await executeContentLocalizeM6Server(snapshot(), dependencies);

    expectFailure(result, 'candidate_rejected');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(2);
    expect(calls.repair).toHaveLength(1);
    expect(calls.repair[0].failedCriteria).toEqual([criterion]);
  });

  it('keeps accepted=false as a separate rejection gate when every mandatory criterion is true', async () => {
    const { calls, dependencies } = fixture({
      evaluator: (request) => evaluatorOutput(request, {
        accepted: false,
        reasonCodes: ['evaluator_rejected'],
      }),
    });
    const result = await executeContentLocalizeM6Server(snapshot(), dependencies);

    expectFailure(result, 'candidate_rejected');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(2);
    expect(calls.repair).toHaveLength(1);
    expect(calls.repair[0].failedCriteria).toEqual([]);
  });

  it('returns the accepted primary candidate and keeps Summary cross-surface isolated', async () => {
    const sourceText = 'Koordiniert Termine und prüft Berichte.';
    const translatedText = 'Coordonne les rendez-vous et vérifie les rapports.';
    const input = snapshot('summary', 'de', 'fr', sourceText);
    const { calls, dependencies } = fixture({
      writer: (request) => writerOutput(request, translatedText),
    });
    const result = await executeContentLocalizeM6Server(input, dependencies);

    expect(result.status).toBe('candidate_ready');
    if (result.status !== 'candidate_ready') throw new Error('expected candidate_ready');
    expect(result.receipt).toEqual({
      operationId: 'm6-operation',
      requestId: 'm6-request',
      kind: 'summary',
      sourceLocale: 'de',
      targetLocale: 'fr',
      sourceTextHash: hashSummarySourceLocaleText(sourceText),
      translatedText,
      candidateTextHash: hashSummarySourceLocaleText(translatedText),
      candidateOrigin: 'primary',
    });
    expect(result.receipt).not.toHaveProperty('experienceEntryId');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.receipt)).toBe(true);
    expect(calls.writer[0]).not.toHaveProperty('experienceEntryId');
    expect(calls.evaluator[0]).not.toHaveProperty('experienceEntryId');
    expect(calls.writer[0].semanticContract.join(' ')).toContain('Do not translate Experience position/title or company.');
    expect(calls.repair).toHaveLength(0);
  });

  it('allows one semantic repair, evaluates it once, and preserves Experience entry identity', async () => {
    const sourceText = 'Prüft Kundenanfragen und aktualisiert Berichte.';
    const repairedText = 'Descripción en español corregida.';
    const input = snapshot('experience_description', 'de', 'es', sourceText);
    const beforeInput = structuredClone(input);
    let rawRepair: unknown;
    let beforeRepair: unknown;
    let rawRepairEvaluator: unknown;
    let beforeRepairEvaluator: unknown;
    const { calls, dependencies } = fixture({
      evaluator: (request) => {
        const output = request.candidateOrigin === 'primary'
          ? evaluatorOutput(request, { accepted: false, reasonCodes: ['meaning_preserved'] })
          : evaluatorOutput(request);
        if (request.candidateOrigin === 'repair') {
          rawRepairEvaluator = output;
          beforeRepairEvaluator = structuredClone(output);
        }
        return output;
      },
      repair: (request) => {
        rawRepair = writerOutput(request, repairedText);
        beforeRepair = structuredClone(rawRepair);
        return rawRepair;
      },
    });
    const result = await executeContentLocalizeM6Server(input, dependencies);

    expect(result.status).toBe('candidate_ready');
    if (result.status !== 'candidate_ready') throw new Error('expected repaired candidate');
    expect(result.receipt).toEqual({
      operationId: 'm6-operation',
      requestId: 'm6-request',
      kind: 'experience_description',
      experienceEntryId: 'experience-17',
      sourceLocale: 'de',
      targetLocale: 'es',
      sourceTextHash: hashExperienceSourceLocaleText(sourceText),
      translatedText: repairedText,
      candidateTextHash: hashExperienceSourceLocaleText(repairedText),
      candidateOrigin: 'repair',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.receipt)).toBe(true);
    expect(calls.writer[0].experienceEntryId).toBe('experience-17');
    expect(calls.evaluator[0].experienceEntryId).toBe('experience-17');
    expect(calls.repair[0].experienceEntryId).toBe('experience-17');
    expect(calls.evaluator[1].experienceEntryId).toBe('experience-17');
    expect(calls.repair[0].primaryCandidateTextHash).toBe(
      hashExperienceSourceLocaleText('Texte traduit fidèle.'),
    );
    expect(calls.repair[0].primaryTranslatedText).toBe('Texte traduit fidèle.');
    expect(Object.isFrozen(calls.repair[0])).toBe(true);
    expect(Object.isFrozen(calls.repair[0].semanticContract)).toBe(true);
    expect(Object.isFrozen(calls.repair[0].reasonCodes)).toBe(true);
    expect(Object.isFrozen(calls.repair[0].failedCriteria)).toBe(true);
    expect(Object.isFrozen(calls.evaluator[1])).toBe(true);
    expect(Object.isFrozen(calls.evaluator[1].criteria)).toBe(true);
    expect(rawRepair).toEqual(beforeRepair);
    expect(rawRepairEvaluator).toEqual(beforeRepairEvaluator);
    expect(input).toEqual(beforeInput);
    expect(Object.keys(calls.writer[0])).not.toContain('position');
    expect(Object.keys(calls.writer[0])).not.toContain('company');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(2);
    expect(calls.repair).toHaveLength(1);
  });

  it('stops after one rejected repair with no fifth model step', async () => {
    const { calls, dependencies } = fixture({
      evaluator: (request) => evaluatorOutput(request, {
        accepted: false,
        noFactsAdded: false,
        reasonCodes: ['facts_added'],
      }),
    });
    const result = await executeContentLocalizeM6Server(snapshot(), dependencies);

    expectFailure(result, 'candidate_rejected');
    expect(calls.writer).toHaveLength(1);
    expect(calls.evaluator).toHaveLength(2);
    expect(calls.repair).toHaveLength(1);
    expect(calls.writer.length + calls.evaluator.length + calls.repair.length).toBe(4);
  });

  it('stops issuing later steps after writer, evaluator, or repair deadline failure', async () => {
    const writerDeadline = fixture({ writer: () => { throw deadlineError(); } });
    expectFailure(await executeContentLocalizeM6Server(snapshot(), writerDeadline.dependencies), 'deadline_exceeded');
    expect(writerDeadline.calls).toEqual({ writer: expect.any(Array), evaluator: [], repair: [] });
    expect(writerDeadline.calls.writer).toHaveLength(1);

    const evaluatorDeadline = fixture({ evaluator: () => { throw deadlineError(); } });
    expectFailure(await executeContentLocalizeM6Server(snapshot(), evaluatorDeadline.dependencies), 'deadline_exceeded');
    expect(evaluatorDeadline.calls.writer).toHaveLength(1);
    expect(evaluatorDeadline.calls.evaluator).toHaveLength(1);
    expect(evaluatorDeadline.calls.repair).toHaveLength(0);

    const repairDeadline = fixture({
      evaluator: (request) => evaluatorOutput(request, { accepted: false, reasonCodes: ['semantic_rejection'] }),
      repair: () => { throw deadlineError(); },
    });
    expectFailure(await executeContentLocalizeM6Server(snapshot(), repairDeadline.dependencies), 'deadline_exceeded');
    expect(repairDeadline.calls.writer).toHaveLength(1);
    expect(repairDeadline.calls.evaluator).toHaveLength(1);
    expect(repairDeadline.calls.repair).toHaveLength(1);

    const repairEvaluatorDeadline = fixture({
      evaluator: (request) => request.candidateOrigin === 'primary'
        ? evaluatorOutput(request, { accepted: false, reasonCodes: ['semantic_rejection'] })
        : (() => { throw deadlineError(); })(),
    });
    expectFailure(
      await executeContentLocalizeM6Server(snapshot(), repairEvaluatorDeadline.dependencies),
      'deadline_exceeded',
    );
    expect(repairEvaluatorDeadline.calls.writer).toHaveLength(1);
    expect(repairEvaluatorDeadline.calls.evaluator).toHaveLength(2);
    expect(repairEvaluatorDeadline.calls.repair).toHaveLength(1);
  });

  it.each([
    ['German -> French Summary', 'summary', 'de', 'fr', 'Koordiniert Termine und prüft Berichte.'],
    ['German -> Spanish Experience description', 'experience_description', 'de', 'es', 'Prüft Kundenanfragen und aktualisiert Berichte.'],
    ['Serbian -> English Summary', 'summary', 'sr', 'en', 'Upravlja zahtevima i koordinira tim.'],
    ['English -> Japanese Experience description', 'experience_description', 'en', 'ja', 'Reviews customer requests and updates reports.'],
    ['Arabic -> German Summary', 'summary', 'ar', 'de', 'يدير الطلبات ويحدث التقارير.'],
    ['pt-BR -> Italian Experience description', 'experience_description', 'pt-BR', 'it', 'Coordena solicitações e atualiza relatórios.'],
  ] as const)('orchestrates mocked %s without claiming provider linguistic quality', async (
    _label,
    kind,
    sourceLocale,
    targetLocale,
    sourceText,
  ) => {
    const { calls, dependencies } = fixture();
    const result = await executeContentLocalizeM6Server(
      snapshot(kind, sourceLocale, targetLocale, sourceText),
      dependencies,
    );

    expect(result.status).toBe('candidate_ready');
    expect(calls.writer[0].sourceLocale).toBe(sourceLocale);
    expect(calls.writer[0].targetLocale).toBe(targetLocale);
  });

  it('pins the exact canonical supported locale authority without requiring array order', () => {
    const actual = new Set(CONTENT_LOCALIZE_M6_TARGET_LOCALES);
    const expected = new Set(EXPECTED_SUPPORTED_LOCALES);

    expect(CONTENT_LOCALIZE_M6_TARGET_LOCALES).toHaveLength(12);
    expect(actual.size).toBe(12);
    expect(actual).toEqual(expected);
  });

  it('accepts every one of the 132 exact already-authorized cross-locale pairs using deterministic fakes', async () => {
    const { calls, dependencies } = fixture();
    let pairCount = 0;
    for (const sourceLocale of CONTENT_LOCALIZE_M6_TARGET_LOCALES) {
      for (const targetLocale of CONTENT_LOCALIZE_M6_TARGET_LOCALES) {
        if (sourceLocale === targetLocale) continue;
        const sourceText = `Exact source for ${sourceLocale} to ${targetLocale}.`;
        const expectedSourceTextHash = hashSummarySourceLocaleText(sourceText);
        const expectedTranslatedText = 'Texte traduit fidèle.';
        const expectedCandidateTextHash = hashSummarySourceLocaleText(expectedTranslatedText);
        const writerCountBefore = calls.writer.length;
        const evaluatorCountBefore = calls.evaluator.length;
        const result = await executeContentLocalizeM6Server(
          snapshot('summary', sourceLocale, targetLocale, sourceText),
          dependencies,
        );
        expect(result.status).toBe('candidate_ready');
        if (result.status !== 'candidate_ready') throw new Error('expected candidate_ready');
        expect(sourceLocale).not.toBe(targetLocale);
        expect(calls.writer).toHaveLength(writerCountBefore + 1);
        expect(calls.evaluator).toHaveLength(evaluatorCountBefore + 1);
        const writerRequest = calls.writer[calls.writer.length - 1];
        const evaluatorRequest = calls.evaluator[calls.evaluator.length - 1];
        expect(writerRequest.sourceLocale).toBe(sourceLocale);
        expect(writerRequest.targetLocale).toBe(targetLocale);
        expect(writerRequest.sourceTextHash).toBe(expectedSourceTextHash);
        expect(evaluatorRequest.sourceLocale).toBe(sourceLocale);
        expect(evaluatorRequest.targetLocale).toBe(targetLocale);
        expect(evaluatorRequest.sourceTextHash).toBe(expectedSourceTextHash);
        expect(evaluatorRequest.candidateTextHash).toBe(expectedCandidateTextHash);
        expect(result.receipt.sourceLocale).toBe(sourceLocale);
        expect(result.receipt.targetLocale).toBe(targetLocale);
        expect(result.receipt.sourceTextHash).toBe(expectedSourceTextHash);
        expect(result.receipt.translatedText).toBe(expectedTranslatedText);
        expect(result.receipt.candidateTextHash).toBe(expectedCandidateTextHash);
        expect(result.receipt.candidateOrigin).toBe('primary');
        pairCount += 1;
      }
    }
    expect(pairCount).toBe(132);
    expect(calls.writer).toHaveLength(132);
    expect(calls.evaluator).toHaveLength(132);
    expect(calls.repair).toHaveLength(0);
  });

  it('rejects each of the 12 runtime-tampered same-locale snapshots before the writer', async () => {
    for (const locale of CONTENT_LOCALIZE_M6_TARGET_LOCALES) {
      const { calls, dependencies } = fixture();
      const value = snapshot('summary', locale, locale, `Same locale ${locale}.`);
      const result = await executeContentLocalizeM6Server(value, dependencies);
      expectFailure(result, 'invalid_authorization_snapshot');
      expect(calls.writer).toHaveLength(0);
      expect(calls.evaluator).toHaveLength(0);
      expect(calls.repair).toHaveLength(0);
    }
  });
});
