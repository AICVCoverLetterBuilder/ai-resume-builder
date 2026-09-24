import { describe, expect, it } from 'vitest';
import type { CVData } from '../../types';
import {
  EXPERIENCE_V3_GENERATE_ACTION,
  captureExperienceV3OperationSnapshot,
  classifyExperienceV3Routing,
  resetAiCoreV3TestOverride,
  runExperienceV3GenerateAdapter,
  setAiCoreV3TestOverride,
  type ExperienceV3AdapterInput,
  type ExperienceV3GenerateResponse,
} from '..';
import {
  EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
  buildExperienceV3EvaluatorPrompt,
  executeExperienceV3GenerateServer,
  parseExperienceV3EvaluatorToolResponse,
  type ExperienceV3EvaluatorResponse,
} from '../experience-generate-server';
import { GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE } from '../fixtures/german-aab529-device-output';

const EN_BULLETS = [
  'Supports routine customer requests in line with the supplied role context.',
  'Coordinates daily work with colleagues and follows established workplace guidance.',
  'Maintains clear records for ordinary tasks within the assigned area of responsibility.',
] as const;

function makeCv(locale = 'en'): CVData {
  return {
    id: 'cv-m2',
    name: 'M2 CV',
    personal: {
      fullName: 'Candidate',
      email: '',
      phone: '',
      address: '',
      jobTitle: 'Support Specialist',
      gender: 'female',
    },
    summary: 'User-owned summary.',
    contentLocale: locale as CVData['contentLocale'],
    experience: [
      {
        id: 'exp-target',
        company: 'Example Company',
        position: 'Support Specialist',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: '',
      },
      {
        id: 'exp-other',
        company: 'Prior Company',
        position: 'Assistant',
        startDate: '2020-01',
        endDate: '2023-12',
        isPresent: false,
        description: 'User-owned prior duties.',
        originalUserDescription: 'User-owned prior duties.',
      },
    ],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function makeInput(overrides: Partial<ExperienceV3AdapterInput> = {}): ExperienceV3AdapterInput {
  const cv = overrides.cv ?? makeCv(overrides.requestedLocale ?? 'en');
  return {
    enabled: true,
    operationKind: 'experience_generate',
    operationId: 'operation-m2',
    entryId: 'exp-target',
    entryIndexDiagnostic: 0,
    cv,
    industry: 'customer-service',
    level: 'mid',
    gender: 'female',
    requestedLocale: 'en',
    uiLocale: 'en',
    storedContentLocale: 'en',
    exactVisibleDescription: '',
    usageCountBefore: 7,
    ...overrides,
  };
}

function writerJson(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  bullets: readonly string[] = EN_BULLETS,
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    bullets,
    ...extra,
  });
}

function evaluatorJson(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  options: {
    semanticStatus?: 'passed' | 'failed';
    languageStatus?: 'passed' | 'failed';
    semanticCode?: string;
    languageCode?: string;
    extra?: Record<string, unknown>;
  } = {},
): string {
  const semanticStatus = options.semanticStatus ?? 'passed';
  const languageStatus = options.languageStatus ?? 'passed';
  return JSON.stringify({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    phases: {
      semantic: {
        status: semanticStatus,
        violations: semanticStatus === 'passed' ? [] : [{
          code: options.semanticCode ?? 'unsupported_claim',
          category: 'semantic',
          detail: 'The evaluator found an unsupported candidate claim.',
          entryIds: [manifest.entryId],
        }],
      },
      language_quality: {
        status: languageStatus,
        violations: languageStatus === 'passed' ? [] : [{
          code: options.languageCode ?? 'grammar_error',
          category: 'language_quality',
          detail: 'The evaluator found a language-quality violation.',
          classification: 'hard_defect',
          entryIds: [manifest.entryId],
        }],
      },
    },
    ...(options.extra ?? {}),
  });
}

function evaluatorToolResponse(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  input: unknown = JSON.parse(evaluatorJson(manifest)),
): ExperienceV3EvaluatorResponse {
  return {
    stopReason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
      input,
    }],
  };
}

async function validServerResponse(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  options: {
    bullets?: readonly string[];
    semanticStatus?: 'passed' | 'failed';
    languageStatus?: 'passed' | 'failed';
    semanticCode?: string;
    languageCode?: string;
    evaluatorExtra?: Record<string, unknown>;
    evaluatorResponse?: ExperienceV3EvaluatorResponse;
    writerThrows?: boolean;
    evaluatorThrows?: boolean;
  } = {},
): Promise<ExperienceV3GenerateResponse> {
  return executeExperienceV3GenerateServer({ manifest }, {
    generate: async () => {
      if (options.writerThrows) throw new Error('writer timeout');
      return writerJson(manifest, options.bullets ?? EN_BULLETS);
    },
    evaluate: async () => {
      if (options.evaluatorThrows) throw new Error('evaluator timeout');
      if (options.evaluatorResponse !== undefined) return options.evaluatorResponse;
      return evaluatorToolResponse(manifest, JSON.parse(evaluatorJson(manifest, {
        semanticStatus: options.semanticStatus,
        languageStatus: options.languageStatus,
        semanticCode: options.semanticCode,
        languageCode: options.languageCode,
        extra: options.evaluatorExtra,
      })));
    },
  });
}

interface HarnessOptions {
  readonly input?: ExperienceV3AdapterInput;
  readonly serverOptions?: Parameters<typeof validServerResponse>[1];
  readonly mutateResponse?: (response: ExperienceV3GenerateResponse) => unknown;
  readonly duringRequest?: (control: {
    getCv: () => CVData;
    setCv: (cv: CVData) => void;
    setVisible: (value: string) => void;
    setUiLocale: (value: string) => void;
    setStoredLocale: (value: string) => void;
    setIndustry: (value: string) => void;
  }) => void;
  readonly persistResult?: boolean;
  readonly corruptFirstWrite?: boolean;
}

async function runHarness(options: HarnessOptions = {}) {
  const input = options.input ?? makeInput();
  let cv = input.cv;
  let persistedCv = input.cv;
  let visible = input.exactVisibleDescription;
  let uiLocale = input.uiLocale;
  let storedLocale = input.storedContentLocale;
  let industry = input.industry;
  let usage = input.usageCountBefore;
  let requestCount = 0;
  const requestActions: string[] = [];
  const requestManifests: unknown[] = [];
  let writeCount = 0;
  let persistCount = 0;
  let usageCallCount = 0;
  const control = {
    getCv: () => cv,
    setCv: (next: CVData) => { cv = next; },
    setVisible: (value: string) => { visible = value; },
    setUiLocale: (value: string) => { uiLocale = value; },
    setStoredLocale: (value: string) => { storedLocale = value; },
    setIndustry: (value: string) => { industry = value; },
  };
  const result = await runExperienceV3GenerateAdapter(input, {
    request: async ({ action, manifest }) => {
      requestCount += 1;
      requestActions.push(action);
      requestManifests.push(manifest);
      options.duringRequest?.(control);
      const response = await validServerResponse(manifest, options.serverOptions);
      return options.mutateResponse ? options.mutateResponse(response) : response;
    },
    getLiveState: () => ({
      cv,
      requestedLocale: input.requestedLocale,
      uiLocale,
      storedContentLocale: storedLocale,
      exactVisibleDescription: visible,
      industry,
      level: input.level,
    }),
    writeCv: (next) => {
      writeCount += 1;
      if (options.corruptFirstWrite && writeCount === 1) {
        cv = {
          ...next,
          experience: next.experience.map((entry) => entry.id === input.entryId
            ? { ...entry, description: `${entry.description} corrupted` }
            : entry),
        };
        return;
      }
      cv = next;
    },
    persistCv: (next) => {
      persistCount += 1;
      if (options.persistResult === false) return false;
      persistedCv = next;
      return true;
    },
    incrementUsage: () => {
      usageCallCount += 1;
      usage += 1;
    },
  });
  return {
    result,
    cv,
    persistedCv,
    usage,
    usageCallCount,
    requestCount,
    requestActions,
    requestManifests,
    writeCount,
    persistCount,
  };
}

describe('M2 A. exact routing', () => {
  it('1. flag false plus empty source is not_applicable and performs no V3 request', async () => {
    const run = await runHarness({ input: makeInput({ enabled: false }) });
    expect(run.result).toEqual({ kind: 'not_applicable' });
    expect(run.requestCount).toBe(0);
  });

  it('2. flag true plus non-empty source leaves Experience Enhance on V2', async () => {
    const cv = makeCv();
    cv.experience[0].description = 'User source';
    const run = await runHarness({ input: makeInput({ cv, exactVisibleDescription: 'User source' }) });
    expect(run.result.kind).toBe('not_applicable');
    expect(run.requestCount).toBe(0);
  });

  it('3. empty Generate ignores stale stored locale but still requires UI and requested locale to match', () => {
    expect(classifyExperienceV3Routing(makeInput({ storedContentLocale: 'de' }))).toBe('owned');
    expect(classifyExperienceV3Routing(makeInput({ requestedLocale: 'sr', uiLocale: 'en' }))).toBe('not_applicable');
  });

  it('4. flag true plus same-locale plus empty source is owned by V3', () => {
    expect(classifyExperienceV3Routing(makeInput())).toBe('owned');
  });

  it('4a. empty descriptions use Generate across locales and arbitrary roles, then apply once', async () => {
    const scenarios = [
      {
        locale: 'sr',
        storedLocale: 'en',
        role: 'Prodajni rukovodilac',
        industry: 'sales',
        level: 'leader',
        bullets: [
          'Razgovara sa kupcima o dostupnim proizvodima.',
          'Predstavlja proizvode i odgovara na pitanja kupaca.',
          'Učestvuje u svakodnevnim prodajnim aktivnostima.',
        ],
      },
      {
        locale: 'en',
        storedLocale: 'sr',
        role: 'Sales Associate',
        industry: 'sales',
        level: 'mid',
        bullets: [
          'Discusses available products with customers.',
          'Describes products and answers customer questions.',
          'Supports routine sales activities.',
        ],
      },
      {
        locale: 'en',
        storedLocale: 'de',
        role: 'Studio Coordinator',
        industry: 'general',
        level: 'mid',
        bullets: [
          'Coordinates routine activities for the assigned work area.',
          'Communicates task updates to relevant colleagues.',
          'Supports ordinary daily activities in the assigned area.',
        ],
      },
    ] as const;

    for (const scenario of scenarios) {
      const cv = makeCv(scenario.storedLocale);
      cv.experience[0] = {
        ...cv.experience[0],
        position: scenario.role,
        company: 'Synthetic Company',
        startDate: '2026-01',
        endDate: '',
        isPresent: true,
        description: '',
      };
      const input = makeInput({
        cv,
        requestedLocale: scenario.locale,
        uiLocale: scenario.locale,
        storedContentLocale: scenario.storedLocale,
        industry: scenario.industry,
        level: scenario.level,
        exactVisibleDescription: '',
      });

      expect(classifyExperienceV3Routing(input)).toBe('owned');
      const run = await runHarness({ input, serverOptions: { bullets: scenario.bullets } });
      expect(run.result.kind).toBe('handled_success');
      expect(run.requestActions).toEqual([EXPERIENCE_V3_GENERATE_ACTION]);
      expect(run.requestManifests).toHaveLength(1);
      expect(run.requestManifests[0]).toMatchObject({
        mode: 'generate',
        locale: scenario.locale,
        roleTitle: scenario.role,
        employmentState: 'present',
        exactSourceText: '',
        facts: [],
      });
      const expectedDescription = scenario.bullets.map((bullet) => `• ${bullet}`).join('\n');
      expect(run.cv.experience[0].description).toBe(expectedDescription);
      expect(run.persistedCv.experience[0].description).toBe(expectedDescription);
      expect(run.requestCount).toBe(1);
      expect(run.writeCount).toBe(1);
      expect(run.persistCount).toBe(1);
      expect(run.usage).toBe(input.usageCountBefore + 1);
      expect(run.usageCallCount).toBe(1);
      expect(scenario.bullets.every((bullet) => !/\d|%|Synthetic Company|\b(?:SAP|CRM|certified|doubled|increased)\b/iu.test(bullet))).toBe(true);
    }
  });

  it('5. eligible provider failure is terminal handled_failure with no write or usage', async () => {
    const run = await runHarness({ serverOptions: { writerThrows: true } });
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'writer_request_failed' });
    expect(run.result.kind === 'handled_failure' && run.result.diagnostic).toMatchObject({
      finalDecision: 'transport_failure',
      usageDelta: 0,
      v2FallthroughCount: 0,
    });
    expect([run.writeCount, run.usageCallCount]).toEqual([0, 0]);
  });

  it('6. eligible validation failure is terminal handled_failure with no V2 fallthrough', async () => {
    const run = await runHarness({ serverOptions: { semanticStatus: 'failed' } });
    expect(run.result.kind).toBe('handled_failure');
    expect([run.writeCount, run.usageCallCount]).toEqual([0, 0]);
  });
});

describe('M2 B. manifest and stable identity', () => {
  it('7. manifest preserves stable ID, role, company, dates, locale, state, industry, and level', () => {
    const snapshot = captureExperienceV3OperationSnapshot(makeInput());
    expect(snapshot.manifest).toMatchObject({
      entryId: 'exp-target',
      roleTitle: 'Support Specialist',
      company: 'Example Company',
      locale: 'en',
      employmentState: 'present',
      industry: 'customer-service',
      level: 'mid',
      dates: { start: { year: 2024, month: 1 }, end: null },
    });
  });

  it('8. empty source creates zero source facts and excludes stale generated text', () => {
    const cv = makeCv();
    cv.experience[0].generatedDescription = 'Stale generated text';
    const snapshot = captureExperienceV3OperationSnapshot(makeInput({ cv }));
    expect(snapshot.manifest.exactSourceText).toBe('');
    expect(snapshot.manifest.facts).toEqual([]);
    expect(JSON.stringify(snapshot.manifest)).not.toContain('Stale generated text');
  });

  it('9. manifest and operation snapshot remain deeply immutable', () => {
    const snapshot = captureExperienceV3OperationSnapshot(makeInput());
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest)).toBe(true);
    expect(Object.isFrozen(snapshot.manifest.facts)).toBe(true);
  });

  it('10. array reorder after request still applies to the stable target ID', async () => {
    const run = await runHarness({
      duringRequest: ({ getCv, setCv }) => setCv({ ...getCv(), experience: [...getCv().experience].reverse() }),
    });
    expect(run.result.kind).toBe('handled_success');
    expect(run.cv.experience.find((entry) => entry.id === 'exp-target')?.description).toContain('Supports routine');
    expect(run.cv.experience.find((entry) => entry.id === 'exp-other')?.description).toBe('User-owned prior duties.');
  });

  it('11. deleted target entry blocks apply', async () => {
    const run = await runHarness({
      duringRequest: ({ getCv, setCv }) => setCv({ ...getCv(), experience: getCv().experience.filter((entry) => entry.id !== 'exp-target') }),
    });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.writeCount).toBe(0);
  });

  it('12. changed role, company, or dates block apply', async () => {
    const run = await runHarness({
      duringRequest: ({ getCv, setCv }) => setCv({
        ...getCv(),
        experience: getCv().experience.map((entry) => entry.id === 'exp-target'
          ? { ...entry, company: 'Changed Company', startDate: '2023-01' }
          : entry),
      }),
    });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.writeCount).toBe(0);
  });

  it('13. user typing into the empty textarea during request blocks apply', async () => {
    const run = await runHarness({ duringRequest: ({ setVisible }) => setVisible('User started typing') });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.writeCount).toBe(0);
  });
});

describe('M2 C and D. bounded transports and fail-closed validation', () => {
  it('14. exactly one generation writer request is made', async () => {
    const manifest = captureExperienceV3OperationSnapshot(makeInput()).manifest;
    let writers = 0;
    await executeExperienceV3GenerateServer({ manifest }, {
      generate: async () => { writers += 1; return writerJson(manifest); },
      evaluate: async () => evaluatorToolResponse(manifest),
    });
    expect(writers).toBe(1);
  });

  it('15. at most one independent non-writing evaluator request is made', async () => {
    const manifest = captureExperienceV3OperationSnapshot(makeInput()).manifest;
    let evaluators = 0;
    await executeExperienceV3GenerateServer({ manifest }, {
      generate: async () => writerJson(manifest),
      evaluate: async () => { evaluators += 1; return evaluatorToolResponse(manifest); },
    });
    expect(evaluators).toBe(1);
  });

  it('16. no repair writer is exposed by the V3 transport contract', () => {
    expect(Object.keys({ generate: true, evaluate: true })).not.toContain('repair');
  });

  it('17. a provider failure produces no deterministic fallback candidate', async () => {
    const manifest = captureExperienceV3OperationSnapshot(makeInput()).manifest;
    const result = await validServerResponse(manifest, { writerThrows: true });
    expect(result).toMatchObject({ ok: false, typedReason: 'writer_request_failed' });
    expect(result).not.toHaveProperty('candidate');
  });

  it('18. evaluator replacement prose is rejected and never reaches apply', async () => {
    const run = await runHarness({ serverOptions: { evaluatorExtra: { correctedBullets: EN_BULLETS } } });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.writeCount).toBe(0);
  });

  it('19. missing structural phase is not accepted or applied', async () => {
    const run = await runHarness({
      mutateResponse: (response) => {
        const copy = JSON.parse(JSON.stringify(response));
        if (copy.validation?.phases) delete copy.validation.phases.structural;
        return copy;
      },
    });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.writeCount).toBe(0);
  });

  it('20. missing semantic phase is not accepted or applied', async () => {
    const run = await runHarness({
      mutateResponse: (response) => {
        const copy = JSON.parse(JSON.stringify(response));
        if (copy.validation?.phases) delete copy.validation.phases.semantic;
        return copy;
      },
    });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('21. missing language-quality phase is not accepted or applied', async () => {
    const run = await runHarness({
      mutateResponse: (response) => {
        const copy = JSON.parse(JSON.stringify(response));
        if (copy.validation?.phases) delete copy.validation.phases.language_quality;
        return copy;
      },
    });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('22. evaluator exception fails closed with reject and no apply', async () => {
    const run = await runHarness({ serverOptions: { evaluatorThrows: true } });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.writeCount).toBe(0);
  });

  it('23. makes the evaluator forced-tool contract explicit and exposes no prose or authority channel', () => {
    const manifest = captureExperienceV3OperationSnapshot(makeInput()).manifest;
    const prompt = buildExperienceV3EvaluatorPrompt(manifest, {
      operationId: manifest.operationId,
      candidateId: 'candidate-m2',
      operationKind: 'experience_generate',
      targetLocale: manifest.locale,
      sourceSnapshotHash: manifest.snapshotHash,
      text: EN_BULLETS.map((bullet) => `• ${bullet}`).join('\n'),
      units: EN_BULLETS.map((text, index) => ({
        unitId: `${manifest.entryId}:bullet:${index + 1}`,
        entryId: manifest.entryId,
        text,
      })),
    });
    expect(prompt).toContain(`Invoke only the ${EXPERIENCE_V3_EVALUATOR_TOOL_NAME} tool.`);
    expect(prompt).toContain('Do not emit text, Markdown, code fences, commentary, explanations, headings, or reasoning.');
    expect(prompt).toContain('Echo operationId, entryId, snapshotHash, and locale exactly from the immutable manifest.');
  });

  it('24. accepts one valid forced tool response with byte-identical candidate prose and three passed phases', async () => {
    const manifest = captureExperienceV3OperationSnapshot(makeInput()).manifest;
    const valid = JSON.parse(evaluatorJson(manifest)) as Record<string, unknown>;
    const result = await executeExperienceV3GenerateServer({ manifest }, {
      generate: async () => writerJson(manifest),
      evaluate: async () => evaluatorToolResponse(manifest, valid),
    });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.candidate.text).toBe(EN_BULLETS.map((bullet) => `• ${bullet}`).join('\n'));
      expect(result.candidate.units?.map((unit) => unit.text)).toEqual(EN_BULLETS);
      expect(result.validation.phases).toMatchObject({
        structural: { status: 'passed' },
        semantic: { status: 'passed' },
        language_quality: { status: 'passed' },
      });
    }
  });

  it('25. rejects every non-tool or invalid forced-tool response as not evaluated', async () => {
    const manifest = captureExperienceV3OperationSnapshot(makeInput()).manifest;
    const valid = JSON.parse(evaluatorJson(manifest)) as Record<string, unknown>;
    const missingFields = JSON.parse(JSON.stringify(valid)) as { phases: Record<string, unknown> };
    delete missingFields.phases.language_quality;
    const unexpectedAuthority = { ...valid, accepted: true };
    const invalidEnum = JSON.parse(JSON.stringify(valid)) as { phases: { semantic: { status: string } } };
    invalidEnum.phases.semantic.status = 'pending';
    const tool = (input: unknown, name = EXPERIENCE_V3_EVALUATOR_TOOL_NAME) => ({
      type: 'tool_use' as const,
      name,
      input,
    });
    const cases: readonly { name: string; response: ExperienceV3EvaluatorResponse; typedReason: string }[] = [
      { name: 'text-only valid-looking JSON', response: { stopReason: 'tool_use', content: [{ type: 'text' }] }, typedReason: 'evaluator_unexpected_text_block' },
      { name: 'Markdown-fenced JSON', response: { stopReason: 'tool_use', content: [{ type: 'text' }] }, typedReason: 'evaluator_unexpected_text_block' },
      { name: 'commentary plus JSON', response: { stopReason: 'tool_use', content: [{ type: 'text' }] }, typedReason: 'evaluator_unexpected_text_block' },
      { name: 'zero tools', response: { stopReason: 'tool_use', content: [] }, typedReason: 'evaluator_tool_missing' },
      { name: 'two tools', response: { stopReason: 'tool_use', content: [tool(valid), tool(valid)] }, typedReason: 'evaluator_multiple_tools' },
      { name: 'wrong tool', response: { stopReason: 'tool_use', content: [tool(valid, 'wrong_tool')] }, typedReason: 'evaluator_wrong_tool' },
      { name: 'tool plus text', response: { stopReason: 'tool_use', content: [tool(valid), { type: 'text' }] }, typedReason: 'evaluator_unexpected_text_block' },
      { name: 'malformed input', response: { stopReason: 'tool_use', content: [tool(null)] }, typedReason: 'evaluator_tool_input_malformed' },
      { name: 'missing fields', response: { stopReason: 'tool_use', content: [tool(missingFields)] }, typedReason: 'evaluator_tool_input_malformed' },
      { name: 'unexpected fields', response: { stopReason: 'tool_use', content: [tool(unexpectedAuthority)] }, typedReason: 'evaluator_tool_input_malformed' },
      { name: 'invalid enums', response: { stopReason: 'tool_use', content: [tool(invalidEnum)] }, typedReason: 'evaluator_tool_input_malformed' },
      { name: 'operation mismatch', response: { stopReason: 'tool_use', content: [tool({ ...valid, operationId: 'other-operation' })] }, typedReason: 'evaluator_identity_mismatch' },
      { name: 'entry mismatch', response: { stopReason: 'tool_use', content: [tool({ ...valid, entryId: 'another-entry' })] }, typedReason: 'evaluator_identity_mismatch' },
      { name: 'snapshot mismatch', response: { stopReason: 'tool_use', content: [tool({ ...valid, snapshotHash: 'other-snapshot' })] }, typedReason: 'evaluator_identity_mismatch' },
      { name: 'locale mismatch', response: { stopReason: 'tool_use', content: [tool({ ...valid, locale: 'de' })] }, typedReason: 'evaluator_identity_mismatch' },
      { name: 'max tokens', response: { stopReason: 'max_tokens', content: [tool(valid)] }, typedReason: 'evaluator_max_tokens' },
      { name: 'unexpected stop reason', response: { stopReason: 'end_turn', content: [tool(valid)] }, typedReason: 'evaluator_output_malformed' },
      { name: 'unexpected content block', response: { stopReason: 'tool_use', content: [{ type: 'thinking' }] }, typedReason: 'evaluator_output_malformed' },
    ];
    for (const testCase of cases) {
      expect(parseExperienceV3EvaluatorToolResponse(testCase.response, manifest)).toMatchObject({
        ok: false,
        typedReason: testCase.typedReason,
      });
      const result = await executeExperienceV3GenerateServer({ manifest }, {
        generate: async () => writerJson(manifest),
        evaluate: async () => testCase.response,
      });
      expect(result).toMatchObject({ ok: false, typedReason: testCase.typedReason });
      if (!result.ok) {
        expect(result.validation?.phases).toMatchObject({
          structural: { status: 'passed' },
          semantic: { status: 'not_evaluated' },
          language_quality: { status: 'not_evaluated' },
        });
      }
    }
  });

  it('26. keeps malformed evaluator output terminal with no apply, usage, or V2 fallthrough', async () => {
    const run = await runHarness({ serverOptions: {
      evaluatorResponse: { stopReason: 'tool_use', content: [{ type: 'thinking' }] },
    } });
    expect(run.result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_output_malformed' });
    if (run.result.kind === 'handled_failure') {
      expect(run.result.diagnostic).toMatchObject({
        evaluator: { attempted: true, result: 'malformed' },
        phases: {
          structural: 'passed',
          semantic: 'not_evaluated',
          language_quality: 'not_evaluated',
        },
        usageDelta: 0,
        v2FallthroughCount: 0,
      });
    }
    expect([run.writeCount, run.usageCallCount]).toEqual([0, 0]);
  });

  it('26. wrong locale in provider output is rejected', async () => {
    const manifest = captureExperienceV3OperationSnapshot(makeInput()).manifest;
    const result = await executeExperienceV3GenerateServer({ manifest }, {
      generate: async () => JSON.stringify({
        operationId: manifest.operationId,
        entryId: manifest.entryId,
        snapshotHash: manifest.snapshotHash,
        locale: 'de',
        bullets: EN_BULLETS,
      }),
      evaluate: async () => evaluatorToolResponse(manifest),
    });
    expect(result).toMatchObject({ ok: false, typedReason: 'provider_output_malformed' });
  });

  it('24. an empty bullet is rejected before evaluator or apply', async () => {
    const run = await runHarness({ serverOptions: { bullets: [EN_BULLETS[0], '', EN_BULLETS[2]] } });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.writeCount).toBe(0);
  });

  it('25. duplicate or near-identical bullets are rejected', async () => {
    const run = await runHarness({ serverOptions: { bullets: [EN_BULLETS[0], EN_BULLETS[0], EN_BULLETS[2]] } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('26. invented metric is rejected through semantic evaluator evidence', async () => {
    const run = await runHarness({ serverOptions: { semanticStatus: 'failed', semanticCode: 'invented_metric' } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('27. invented certification, tool, or leadership claim is rejected', async () => {
    const run = await runHarness({ serverOptions: { semanticStatus: 'failed', semanticCode: 'invented_tool_or_leadership' } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('28. cross-entry fact is rejected through semantic evaluator evidence', async () => {
    const run = await runHarness({ serverOptions: { semanticStatus: 'failed', semanticCode: 'cross_entry_fact' } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('29. current-employment past-tense violation is rejected', async () => {
    const run = await runHarness({ serverOptions: { languageStatus: 'failed', languageCode: 'current_role_past_tense' } });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('30. completed-employment present-tense violation is rejected', async () => {
    const cv = makeCv();
    cv.experience[0] = { ...cv.experience[0], isPresent: false, endDate: '2024-06' };
    const run = await runHarness({
      input: makeInput({ cv }),
      serverOptions: { languageStatus: 'failed', languageCode: 'completed_role_present_tense' },
    });
    expect(run.result.kind).toBe('handled_failure');
  });

  it('31. German abprüfe/weiterdokumentierte family is rejected by evaluator contract without repair', async () => {
    const malformed = GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE.malformedSurfaceMarkers;
    const cv = makeCv('de');
    const run = await runHarness({
      input: makeInput({ cv, requestedLocale: 'de', uiLocale: 'de', storedContentLocale: 'de' }),
      serverOptions: {
        bullets: [`Unterlagen ${malformed[0]}.`, `Abweichungen ${malformed[1]}.`, 'Stimmt Arbeitsschritte im Team ab.'],
        languageStatus: 'failed',
        languageCode: 'malformed_surface',
      },
    });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.cv.experience[0].description).toBe('');
  });
});

describe('M2 E and F. narrow transaction, usage, and regression defaults', () => {
  it('32. accepted candidate writes exactly the target Experience description', async () => {
    const run = await runHarness();
    expect(run.result.kind).toBe('handled_success');
    expect(run.cv.experience.find((entry) => entry.id === 'exp-target')?.description)
      .toBe(EN_BULLETS.map((bullet) => `• ${bullet}`).join('\n'));
  });

  it('33. accepted candidate does not change Summary', async () => {
    const run = await runHarness();
    expect(run.cv.summary).toBe('User-owned summary.');
  });

  it('34. accepted candidate does not change another Experience entry', async () => {
    const before = makeCv().experience[1];
    const run = await runHarness();
    expect(run.cv.experience.find((entry) => entry.id === 'exp-other')).toEqual(before);
  });

  it('35. accepted generation does not populate original or canonical user fields', async () => {
    const run = await runHarness();
    const entry = run.cv.experience.find((item) => item.id === 'exp-target');
    expect(entry?.originalUserDescription).toBeUndefined();
    expect(entry?.canonicalDescription).toBeUndefined();
    expect(entry?.aiOutputProvenance).toMatchObject({
      generatedFromEmpty: true,
      sourceAuthorityKind: 'generated_from_empty',
      preAiFactSnapshotText: '',
    });
  });

  it('36. exact visible readback and persistence commit increments usage by exactly one', async () => {
    const run = await runHarness();
    expect(run.result.kind).toBe('handled_success');
    expect([run.persistCount, run.usage, run.usageCallCount]).toEqual([1, 8, 1]);
  });

  it('37. visible hash mismatch rolls back and increments zero', async () => {
    const run = await runHarness({ corruptFirstWrite: true });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.cv).toEqual(makeCv());
    expect([run.usage, run.usageCallCount]).toEqual([7, 0]);
  });

  it('38. persistence failure rolls back and increments zero', async () => {
    const run = await runHarness({ persistResult: false });
    expect(run.result.kind).toBe('handled_failure');
    expect(run.cv).toEqual(makeCv());
    expect([run.usage, run.usageCallCount]).toEqual([7, 0]);
  });

  it('39. one successful operation cannot increment usage twice', async () => {
    const run = await runHarness();
    expect(run.usageCallCount).toBe(1);
  });

  it('40. a failed operation cannot increment usage once', async () => {
    const run = await runHarness({ serverOptions: { evaluatorThrows: true } });
    expect(run.usageCallCount).toBe(0);
  });

  it('41. reviewed M1 feature/manifest/validator contracts remain available', async () => {
    const importedModule = await import('..');
    expect(importedModule).toMatchObject({
      createExperienceFactManifest: expect.any(Function),
      createSourceAuthoritySnapshot: expect.any(Function),
      runAiCoreV3Validation: expect.any(Function),
    });
  });

  it('42. M9 feature policy defaults to V3', async () => {
    resetAiCoreV3TestOverride();
    const { isAiCoreV3Enabled } = await import('..');
    expect(isAiCoreV3Enabled()).toBe(true);
  });

  it('43. test reset restores the V3 default', async () => {
    setAiCoreV3TestOverride(false);
    resetAiCoreV3TestOverride();
    const { isAiCoreV3Enabled } = await import('..');
    expect(isAiCoreV3Enabled()).toBe(true);
  });

  it('44. explicit false still keeps the existing V2 path available', () => {
    expect(classifyExperienceV3Routing(makeInput({ enabled: false }))).toBe('not_applicable');
  });

  it('45. no Summary operation is routed through the M2 adapter', () => {
    for (const operationKind of ['summary_generate', 'summary_stronger', 'summary_professional', 'summary_shorter']) {
      expect(classifyExperienceV3Routing(makeInput({ operationKind }))).toBe('not_applicable');
    }
    expect(EXPERIENCE_V3_GENERATE_ACTION).toBe('experience_v3_generate');
  });
});
