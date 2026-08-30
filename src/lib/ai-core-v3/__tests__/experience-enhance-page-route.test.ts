/** @vitest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { translations } from '../../i18n/translations';
import type { CVData } from '../../types';
import { InternalExperienceAiDiagnosticsPanel } from '@/components/InternalExperienceAiDiagnosticsPanel';
import {
  clearExperienceAiDiagnosticsForTests,
  recordExperienceV3InternalRejectionAudit,
  recordExperienceV3TerminalDiagnostic,
  summarizeExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';
import type {
  ExperienceV3InternalRejectionAudit,
  ExperienceV3TerminalDiagnostic,
} from '../experience-generate';
import { M4_M3_LANGUAGE_REJECTION_DEVICE_DIAGNOSTIC_FIXTURE } from '../fixtures/m4-m3-language-rejection-device-diagnostic';
import {
  EXPERIENCE_V3_ENHANCE_ACTION,
  captureExperienceV3EnhanceOperationSnapshot,
  classifyExperienceV3EnhanceRouting,
  type ExperienceV3EnhanceAdapterInput,
} from '..';

const pageSource = readFileSync(resolve(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
const routeSource = readFileSync(resolve(process.cwd(), 'src/app/api/generate/route.ts'), 'utf8');

const pageM2AdapterMock = vi.hoisted(() => vi.fn());
const pageM3AdapterMock = vi.hoisted(() => vi.fn());
const legacyV2RequestMock = vi.hoisted(() => vi.fn());
const pageUsageIncrementMock = vi.hoisted(() => vi.fn());
const pageToastSuccessMock = vi.hoisted(() => vi.fn());
const pageToastErrorMock = vi.hoisted(() => vi.fn());

const PAGE_ENTRY_ID = 'route-m3-live-entry';
const PAGE_STALE_SOURCE = 'Stale state source that must not be sent.';
const PAGE_LIVE_SOURCE = 'Helps customers with service questions.\nKeeps accurate request records.';

const pageRuntimeState: {
  currentCv: CVData;
  usage: number;
  writes: CVData[];
} = {
  currentCv: undefined as unknown as CVData,
  usage: 7,
  writes: [],
};

function makePageCv(): CVData {
  return {
    id: 'route-m3-live-cv',
    name: 'Route M3 live CV',
    personal: {
      fullName: 'Route Candidate', email: 'route@example.com', phone: '', address: '',
      jobTitle: 'Support Specialist', gender: 'female',
    },
    summary: 'User-owned summary.',
    contentLocale: 'en',
    experience: [{
      id: PAGE_ENTRY_ID,
      company: 'Example Company',
      position: 'Support Specialist',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: PAGE_STALE_SOURCE,
      generatedDescription: 'Older provider response.',
      canonicalDescription: 'Older canonical source.',
      originalUserDescription: 'Older original source.',
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '',
    updatedAt: '',
  };
}

function installActualPageFlowMocks(): void {
  vi.doMock('@/lib/ai-core-v3', async () => {
    const actual = await vi.importActual<typeof import('..')>('@/lib/ai-core-v3');
    return {
      ...actual,
      runExperienceV3GenerateAdapter: pageM2AdapterMock,
      runExperienceV3EnhanceAdapter: pageM3AdapterMock,
    };
  });
  vi.doMock('@/lib/i18n/context', () => ({
    useI18n: () => ({ locale: 'en', t: translations.en }),
  }));
  vi.doMock('@/lib/store', () => ({
    checkProAccess: () => 'allowed',
    useApp: () => ({
      currentCv: pageRuntimeState.currentCv,
      setCurrentCv: (next: CVData) => {
        pageRuntimeState.currentCv = next;
        pageRuntimeState.writes.push(next);
      },
      persistCurrentCvTransactionally: (next: CVData) => {
        pageRuntimeState.currentCv = next;
        pageRuntimeState.writes.push(next);
        return true;
      },
      isPro: true,
      canDownload: () => true,
      incrementDownloads: vi.fn(),
      markAiRecommendUsed: vi.fn(),
      recordProAiSuccess: () => {
        pageUsageIncrementMock();
        pageRuntimeState.usage += 1;
      },
      getProAiUsageCount: () => pageRuntimeState.usage,
      lastCvSavedAt: 0,
      getAiGate: () => ({ status: 'ready', token: 'route-m3-page-token' }),
    }),
  }));
  vi.doMock('@/lib/api', async () => {
    const actual = await vi.importActual<typeof import('../../api')>('@/lib/api');
    return { ...actual, apiFetch: legacyV2RequestMock };
  });
  vi.doMock('@/components/Header', () => ({ default: () => null }));
  vi.doMock('@/components/Footer', () => ({ default: () => null }));
  vi.doMock('sonner', () => ({
    toast: { success: pageToastSuccessMock, error: pageToastErrorMock },
  }));
}

type PageM3ResultKind = 'handled_failure' | 'handled_success' | 'not_applicable';

async function executeActualPageExperienceFlow(m3Kind: PageM3ResultKind) {
  const environmentKeys = ['NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'AI_CORE_V3_ENABLED'] as const;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, {
    present: Object.prototype.hasOwnProperty.call(process.env, key),
    value: process.env[key],
  }])) as Record<(typeof environmentKeys)[number], { present: boolean; value: string | undefined }>;

  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  pageRuntimeState.currentCv = makePageCv();
  pageRuntimeState.usage = 7;
  pageRuntimeState.writes = [];
  pageM2AdapterMock.mockReset().mockResolvedValue({ kind: 'not_applicable' });
  pageM3AdapterMock.mockReset().mockResolvedValue(
    m3Kind === 'handled_failure'
      ? { kind: 'handled_failure', typedReason: 'executable_page_test_rejection' }
      : { kind: m3Kind },
  );
  legacyV2RequestMock.mockReset().mockResolvedValue({
    data: { error: 'legacy_v2_positive_control', code: 'pro_required' },
    response: { ok: false, status: 403, headers: { get: () => null } },
  });
  pageUsageIncrementMock.mockReset();
  pageToastSuccessMock.mockReset();
  pageToastErrorMock.mockReset();
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
  process.env.AI_CORE_V3_ENABLED = 'true';
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  vi.resetModules();
  installActualPageFlowMocks();

  try {
    const core = await import('..');
    core.resetAiCoreV3TestOverride();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(React.createElement(Page));
    fireEvent.click(screen.getByRole('button', { name: translations.en.cv.experience }));

    const textarea = document.querySelector(
      `[data-experience-description-id="${PAGE_ENTRY_ID}"]`,
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe(PAGE_STALE_SOURCE);
    fireEvent.change(textarea!, { target: { value: PAGE_LIVE_SOURCE } });
    await waitFor(() => expect(textarea!.value).toBe(PAGE_LIVE_SOURCE));

    fireEvent.click(screen.getByRole('button', {
      name: new RegExp(translations.en.cv.aiBullets, 'i'),
    }));
    await waitFor(() => expect(pageM2AdapterMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pageM3AdapterMock).toHaveBeenCalledTimes(1));
    if (m3Kind === 'not_applicable') {
      await waitFor(() => expect(legacyV2RequestMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(pageToastErrorMock).toHaveBeenCalledTimes(1));
    } else {
      const terminalToast = m3Kind === 'handled_success' ? pageToastSuccessMock : pageToastErrorMock;
      await waitFor(() => expect(terminalToast).toHaveBeenCalledTimes(1));
    }

    const m3Input = pageM3AdapterMock.mock.calls[0]?.[0] as ExperienceV3EnhanceAdapterInput;
    const terminalButton = screen.getByRole('button', {
      name: new RegExp(translations.en.cv.aiBullets, 'i'),
    }) as HTMLButtonElement;
    return {
      m2Calls: pageM2AdapterMock.mock.calls.length,
      m3Calls: pageM3AdapterMock.mock.calls.length,
      legacyV2Calls: legacyV2RequestMock.mock.calls.length,
      usageCalls: pageUsageIncrementMock.mock.calls.length,
      usage: pageRuntimeState.usage,
      m3Input,
      visibleText: textarea!.value,
      terminalButtonDisabled: terminalButton.disabled,
      successToastCalls: pageToastSuccessMock.mock.calls.length,
      errorToastCalls: pageToastErrorMock.mock.calls.length,
    };
  } finally {
    cleanup();
    const core = await import('..');
    core.resetAiCoreV3TestOverride();
    for (const key of environmentKeys) {
      const original = originalEnvironment[key];
      if (original.present) process.env[key] = original.value;
      else delete process.env[key];
    }
    localStorage.clear();
    sessionStorage.clear();
    vi.doUnmock('@/lib/ai-core-v3');
    vi.doUnmock('@/lib/i18n/context');
    vi.doUnmock('@/lib/store');
    vi.doUnmock('@/lib/api');
    vi.doUnmock('@/components/Header');
    vi.doUnmock('@/components/Footer');
    vi.doUnmock('sonner');
    if (originalScrollIntoView === undefined) {
      delete (HTMLElement.prototype as { scrollIntoView?: typeof HTMLElement.prototype.scrollIntoView }).scrollIntoView;
    } else {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
    vi.clearAllMocks();
    vi.resetModules();
  }
}

function validInput(operationKind = 'experience_enhance'): ExperienceV3EnhanceAdapterInput {
  const cv: CVData = {
    id: 'route-m3-cv', name: 'Route M3 CV',
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '', gender: 'female' },
    summary: '', contentLocale: 'en',
    experience: [{
      id: 'route-m3-entry', company: 'Example Company', position: 'Support Specialist',
      startDate: '2024-01', endDate: '', isPresent: true, description: 'Helps customers.',
    }],
    education: [], skills: [], certifications: [], languages: [], templateId: 'modern-minimal', region: 'EU',
    createdAt: '', updatedAt: '',
  };
  return {
    enabled: true, operationKind, operationId: 'route-m3-operation', requestId: 'route-m3-operation',
    entryId: 'route-m3-entry', entryIndexDiagnostic: 0, cv, industry: 'customer-service', level: 'mid',
    gender: 'female', requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en',
    exactVisibleDescription: 'Helps customers.', jobContextHash: 'route-m3-context', usageCountBefore: 1,
  };
}

async function invokeDisabledRoute() {
  const environmentKeys = [
    'AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN',
  ] as const;
  const originals = Object.fromEntries(environmentKeys.map((key) => [key, {
    present: Object.prototype.hasOwnProperty.call(process.env, key), value: process.env[key],
  }])) as Record<(typeof environmentKeys)[number], { present: boolean; value: string | undefined }>;
  const writerSpy = vi.fn(() => { throw new Error('M3 writer must not run while disabled'); });
  const evaluatorSpy = vi.fn(() => { throw new Error('M3 evaluator must not run while disabled'); });
  const messagesCreateSpy = vi.fn((params: { system?: unknown }) => {
    const system = String(params?.system || '');
    if (system.includes('Experience Enhance prose writer')) return writerSpy();
    if (system.includes('Experience Enhance validator')) return evaluatorSpy();
    throw new Error('Unexpected Anthropic call in disabled M3 test');
  });
  try {
    process.env.AI_CORE_V3_ENABLED = 'false';
    process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'false';
    process.env.ANTHROPIC_API_KEY = 'disabled-m3-route-key';
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    vi.resetModules();
    vi.doMock('@anthropic-ai/sdk', () => {
      class MockAnthropic { readonly messages = { create: messagesCreateSpy }; }
      return { default: MockAnthropic };
    });
    vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => ({ subject: 'route-m3' })) }));
    const core = await import('..');
    core.resetAiCoreV3TestOverride();
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(validInput());
    expect(core.parseExperienceV3EnhanceRequest({ manifest: snapshot.manifest })).not.toBeNull();
    const request = new Request('http://localhost/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: core.EXPERIENCE_V3_ENHANCE_ACTION,
        proToken: 'route-m3-pro-token', requestId: snapshot.operationId, manifest: snapshot.manifest,
      }),
    });
    const { POST } = await import('@/app/api/generate/route');
    const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), writerSpy, evaluatorSpy, messagesCreateSpy };
  } finally {
    vi.restoreAllMocks();
    vi.doUnmock('@anthropic-ai/sdk');
    vi.doUnmock('@/lib/pro-token');
    vi.resetModules();
    for (const key of environmentKeys) {
      const original = originals[key];
      if (original.present) process.env[key] = original.value;
      else delete process.env[key];
    }
  }
}

async function invokeRejectedRouteWithDefaultGate() {
  const environmentKeys = [
    'AI_CORE_V3_ENABLED', 'NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN', 'NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED',
  ] as const;
  const originals = Object.fromEntries(environmentKeys.map((key) => [key, {
    present: Object.prototype.hasOwnProperty.call(process.env, key), value: process.env[key],
  }])) as Record<(typeof environmentKeys)[number], { present: boolean; value: string | undefined }>;
  let writerInput: Record<string, unknown> | null = null;
  let evaluatorInput: Record<string, unknown> | null = null;
  const messagesCreateSpy = vi.fn(async (params: { tools?: Array<{ name?: string }> }) => {
    const toolName = params.tools?.[0]?.name;
    if (toolName === 'submit_experience_enhancement') return {
      stop_reason: 'tool_use', content: [{ type: 'tool_use', name: toolName, input: writerInput }],
    };
    if (toolName === 'submit_experience_enhancement_validation') return {
      stop_reason: 'tool_use', content: [{ type: 'tool_use', name: toolName, input: evaluatorInput }],
    };
    throw new Error('unexpected M3 tool');
  });
  try {
    process.env.AI_CORE_V3_ENABLED = 'true';
    process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
    process.env.ANTHROPIC_API_KEY = 'route-m3-test-key';
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED = 'false';
    vi.resetModules();
    vi.doMock('@anthropic-ai/sdk', () => {
      class MockAnthropic { readonly messages = { create: messagesCreateSpy }; }
      return { default: MockAnthropic };
    });
    vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => ({ subject: 'route-m3' })) }));
    const core = await import('..');
    core.resetAiCoreV3TestOverride();
    const snapshot = captureExperienceV3EnhanceOperationSnapshot(validInput());
    writerInput = {
      operationId: snapshot.manifest.operationId,
      entryId: snapshot.manifest.entryId,
      snapshotHash: snapshot.manifest.snapshotHash,
      locale: snapshot.manifest.locale,
      units: snapshot.manifest.facts.map((fact, index) => ({ factId: fact.factId, text: `Improved unit ${index + 1}` })),
    };
    evaluatorInput = {
      operationId: snapshot.manifest.operationId,
      entryId: snapshot.manifest.entryId,
      snapshotHash: snapshot.manifest.snapshotHash,
      locale: snapshot.manifest.locale,
      phases: {
        semantic: { status: 'passed', violations: [] },
        language_quality: {
          status: 'failed',
          violations: [{ code: 'malformed_surface', category: 'language_quality', detail: 'private evaluator detail', factIds: [snapshot.manifest.facts[0].factId], entryIds: [snapshot.manifest.entryId] }],
        },
      },
      materiality: { status: 'material', kind: 'clarity_improvement', sourceEquivalent: false, degradationDetected: false },
    };
    const request = new Request('http://localhost/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: EXPERIENCE_V3_ENHANCE_ACTION, proToken: 'route-m3-pro-token', requestId: snapshot.operationId, manifest: snapshot.manifest }),
    });
    const { POST } = await import('@/app/api/generate/route');
    const response = await POST(request as Parameters<typeof POST>[0]);
    return { response, body: await response.json(), messagesCreateSpy };
  } finally {
    vi.restoreAllMocks();
    vi.doUnmock('@anthropic-ai/sdk');
    vi.doUnmock('@/lib/pro-token');
    vi.resetModules();
    for (const key of environmentKeys) {
      const original = originals[key];
      if (original.present) process.env[key] = original.value;
      else delete process.env[key];
    }
  }
}

describe('M3 page and route integration', () => {
  it('renders truthful M3 evidence and the gated rejected-audit action', () => {
    if (process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED !== 'true') return;
    clearExperienceAiDiagnosticsForTests();
    const terminal = {
      ...M4_M3_LANGUAGE_REJECTION_DEVICE_DIAGNOSTIC_FIXTURE,
      schemaVersion: 1,
      marker: 'EXPERIENCE_V3_TERMINAL_DIAGNOSTIC',
      revision: 'experience-v3-terminal-diagnostic-v1',
      capturedAt: '2026-08-30T17:51:13.117Z',
      operation: 'experience_v3_enhance',
      requestIdHash: 'v3e-12345678',
      operationIdHash: 'v3e-12345678',
      stableEntryIdHash: 'v3e-12345678',
      requestedLocale: 'de', uiLocale: 'de', contentLocale: 'de', sourceWasEmpty: false,
      normalizedIndustry: 'engineering', normalizedLevel: 'mid', employmentState: 'present',
      ownershipResult: 'owned', routeHttpStatus: 422,
      writer: { attempted: true, result: 'succeeded' },
      evaluator: { attempted: true, result: 'succeeded' },
      phases: { structural: 'passed', semantic: 'passed', language_quality: 'failed' },
      rejectionReasonCodes: ['validation_rejected'], finalDecision: 'reject',
      applyAuthorized: false, applyAttempted: false, applyCommitted: false,
      v2FallthroughCount: 0, usageBefore: 0, usageAfter: 0, usageDelta: 0,
      raceGuardResult: 'not_evaluated', sourceCommitMarker: '2e2bd58', buildChannel: 'internal',
      candidatePresent: true, candidateHash: 'v3e-12345678', candidateUnitCount: 3,
      candidateUnitHashes: ['v3e-12345678', 'v3e-12345678', 'v3e-12345678'], candidateUnitLengths: [10, 11, 12],
      evaluatorStopReason: 'tool_use', evaluatorContentBlockCount: 1, evaluatorTextBlockCount: 0,
      evaluatorToolBlockCount: 1, evaluatorExpectedToolCount: 1, evaluatorToolNameMatched: true,
      evaluatorToolInputObject: true, evaluatorToolInputSchemaPassed: true, evaluatorIdentityPassed: true,
      writerStopReason: 'tool_use', writerContentBlockCount: 1, writerTextBlockCount: 0,
      writerToolBlockCount: 1, writerExpectedToolCount: 1, writerToolNameMatched: true,
      writerToolInputObject: true, writerToolInputSchemaPassed: true, writerIdentityPassed: true,
      semanticViolationCount: 0, semanticViolationCodes: [], languageQualityViolationCount: 1,
      languageQualityViolationCodes: ['malformed_german_surface'], violationFactIdHashesByCode: {},
      violationEntryIdHashesByCode: {}, primaryValidationRejectionCode: 'malformed_german_surface',
      sourceHash: 'v3e-12345678', sourceUnitCount: 3, sourceUnitHashes: ['v3e-12345678'], sourceUnitLengths: [10, 11, 12],
      materialityStatus: 'unknown', materialityKind: null, degradationResult: null, persistenceResult: 'not_attempted',
    } as ExperienceV3TerminalDiagnostic;
    const audit = {
      operationId: 'operation-m3', entryId: 'exp-target', snapshotHash: 'v3e-12345678', locale: 'de',
      sourceUnits: ['synthetic source one', 'synthetic source two', 'synthetic source three'],
      candidate: { candidateId: 'candidate-m3', units: [{ unitId: 'unit-1', entryId: 'exp-target', text: 'synthetic rejected unit' }] },
      phases: { structural: 'passed', semantic: 'passed', language_quality: 'failed' },
      evaluator: {
        evaluatorStopReason: 'tool_use', evaluatorContentBlockCount: 1, evaluatorTextBlockCount: 0,
        evaluatorToolBlockCount: 1, evaluatorExpectedToolCount: 1, evaluatorToolNameMatched: true,
        evaluatorToolInputObject: true, evaluatorToolInputSchemaPassed: true, evaluatorIdentityPassed: true,
        semanticViolations: [], languageQualityViolations: [{
          code: 'malformed_german_surface', category: 'language_quality', detail: 'synthetic detail',
          factIds: ['fact-1'], entryIds: ['exp-target'],
        }],
      },
    } as ExperienceV3InternalRejectionAudit;
    recordExperienceV3TerminalDiagnostic(terminal);
    recordExperienceV3InternalRejectionAudit(audit);
    render(React.createElement(InternalExperienceAiDiagnosticsPanel, { refreshToken: 1 }));
    expect(screen.getByText('3', { exact: true })).toBeTruthy();
    expect(screen.getByText('3/3', { exact: true })).toBeTruthy();
    expect(screen.getByText('Writer / Evaluator:')).toBeTruthy();
    expect(screen.queryByText('provider/fallback bullets:')).toBeNull();
    const toggle = screen.getByTestId('experience-ai-rejected-audit-toggle');
    expect(toggle.textContent).toContain('Show rejected AI audit');
    fireEvent.click(toggle);
    expect(screen.getByText('Warning: this copy contains CV text and must not be posted publicly.')).toBeTruthy();
    expect(screen.getByTestId('experience-ai-rejected-audit-copy').textContent)
      .toContain('Copy rejected AI audit — contains CV text');
    expect(summarizeExperienceAiDiagnostic({
      ...terminal,
      sourceUnitCount: undefined,
      phases: { structural: 'passed', semantic: 'not_evaluated', language_quality: 'not_evaluated' },
    })).toMatchObject({ sourceUnitCount: 0, requiredCovered: 'n/a' });
    cleanup();
    clearExperienceAiDiagnosticsForTests();
  });

  it('1. feature flag false bypasses the M3 page adapter', () => {
    const start = pageSource.indexOf('const experienceV3EnhanceResult = experienceV3Enabled');
    const end = pageSource.indexOf("if (experienceV3EnhanceResult.kind !== 'not_applicable')", start);
    const block = pageSource.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain('? await runExperienceV3EnhanceAdapter({');
    expect(block).toContain(": { kind: 'not_applicable' as const }");
  });

  it('3. direct M3 API request while disabled returns exact typed 409', async () => {
    const run = await invokeDisabledRoute();
    expect(run.response.status).toBe(409);
    expect(run.body).toEqual({ ok: false, action: EXPERIENCE_V3_ENHANCE_ACTION, typedReason: 'v3_feature_disabled' });
  });

  it('default M3 rejection route preserves safe evidence but omits validation prose and the internal audit', async () => {
    const run = await invokeRejectedRouteWithDefaultGate();
    expect(run.response.status).toBe(422);
    expect(run.body.diagnosticEvidence).toMatchObject({
      candidatePresent: true,
      evaluatorStopReason: 'tool_use',
      languageQualityViolationCodes: ['malformed_surface'],
    });
    expect(run.body.validation.phases.language_quality).toMatchObject({ status: 'failed', violations: [] });
    expect(run.body).not.toHaveProperty('internalRejectionAudit');
    expect(JSON.stringify(run.body)).not.toContain('private evaluator detail');
  });

  it('4. disabled direct request invokes writer zero times', async () => {
    const run = await invokeDisabledRoute();
    expect(run.messagesCreateSpy).toHaveBeenCalledTimes(0);
    expect(run.writerSpy).toHaveBeenCalledTimes(0);
  });

  it('5. disabled direct request invokes evaluator zero times', async () => {
    const run = await invokeDisabledRoute();
    expect(run.messagesCreateSpy).toHaveBeenCalledTimes(0);
    expect(run.evaluatorSpy).toHaveBeenCalledTimes(0);
  });

  it('12. Summary and unrelated actions remain outside M3', () => {
    for (const operationKind of ['summary_generate', 'summary_stronger', 'summary_shorter', 'cover_letter']) {
      expect(classifyExperienceV3EnhanceRouting(validInput(operationKind))).toBe('not_applicable');
    }
    expect(routeSource.indexOf('if (action === EXPERIENCE_V3_ENHANCE_ACTION)')).toBeLessThan(
      routeSource.indexOf("if (action === 'bullets')"),
    );
  });

  it('75. handled_failure never falls through to V2', () => {
    const start = pageSource.indexOf("if (experienceV3EnhanceResult.kind !== 'not_applicable') {");
    const end = pageSource.indexOf('// Freeze the live textarea first', start);
    const terminal = pageSource.slice(start, end);
    expect(terminal).toContain('return;');
    expect(terminal).not.toContain("action: 'bullets'");
  });

  it('76. only not_applicable may continue to V2', () => {
    const adapter = pageSource.indexOf('runExperienceV3EnhanceAdapter({');
    const v2 = pageSource.indexOf('resolveExperienceTextareaProvenance({', adapter);
    expect(adapter).toBeGreaterThan(-1);
    expect(v2).toBeGreaterThan(adapter);
    expect(pageSource.slice(adapter, v2)).toContain("kind !== 'not_applicable'");
  });

  it('M3 handled_failure terminates the actual page Experience flow before legacy V2', async () => {
    const run = await executeActualPageExperienceFlow('handled_failure');
    expect(run.m2Calls).toBe(1);
    expect(run.m3Calls).toBe(1);
    expect(run.legacyV2Calls).toBe(0);
    expect(run.usageCalls).toBe(0);
    expect(run.usage).toBe(7);
    expect(run.m3Input.entryId).toBe(PAGE_ENTRY_ID);
    expect(run.m3Input.exactVisibleDescription).toBe(PAGE_LIVE_SOURCE);
    expect(run.m3Input.requestedLocale).toBe('en');
    expect(run.m3Input.uiLocale).toBe('en');
    expect(run.m3Input.storedContentLocale).toBe('en');
    expect(run.m3Input.cv.experience.find((entry) => entry.id === PAGE_ENTRY_ID)?.isPresent).toBe(true);
    expect(run.m3Input.jobContextHash).toBeTruthy();
    expect(run.visibleText).toBe(PAGE_LIVE_SOURCE);
    expect(run.terminalButtonDisabled).toBe(false);
    expect(run.errorToastCalls).toBe(1);
  });

  it('M3 handled_success terminates the actual page Experience flow before legacy V2', async () => {
    const run = await executeActualPageExperienceFlow('handled_success');
    expect(run.m2Calls).toBe(1);
    expect(run.m3Calls).toBe(1);
    expect(run.legacyV2Calls).toBe(0);
    expect(run.usageCalls).toBe(0);
    expect(run.usage).toBe(7);
    expect(run.m3Input.entryId).toBe(PAGE_ENTRY_ID);
    expect(run.m3Input.exactVisibleDescription).toBe(PAGE_LIVE_SOURCE);
    expect(run.m3Input.requestedLocale).toBe('en');
    expect(run.m3Input.uiLocale).toBe('en');
    expect(run.m3Input.storedContentLocale).toBe('en');
    expect(run.m3Input.cv.experience.find((entry) => entry.id === PAGE_ENTRY_ID)?.isPresent).toBe(true);
    expect(run.m3Input.jobContextHash).toBeTruthy();
    expect(run.visibleText).toBe(PAGE_LIVE_SOURCE);
    expect(run.terminalButtonDisabled).toBe(false);
    expect(run.successToastCalls).toBe(1);
  });

  it('only not_applicable reaches legacy V2 exactly once in the actual page Experience flow', async () => {
    const run = await executeActualPageExperienceFlow('not_applicable');
    expect(run.m2Calls).toBe(1);
    expect(run.m3Calls).toBe(1);
    expect(run.legacyV2Calls).toBe(1);
    expect(run.m3Input.entryId).toBe(PAGE_ENTRY_ID);
    expect(run.m3Input.exactVisibleDescription).toBe(PAGE_LIVE_SOURCE);
  });
});
