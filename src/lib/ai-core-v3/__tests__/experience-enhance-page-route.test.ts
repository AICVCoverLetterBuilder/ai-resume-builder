/** @vitest-environment jsdom */
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { translations } from '../../i18n/translations';
import type { CVData } from '../../types';
import {
  buildExperienceAiOutputProvenance,
  resolveExperienceTextareaProvenance,
} from '../../cv-experience-ai-output-provenance';
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
  hashExperienceV3EnhanceValue,
  type ExperienceV3EnhanceAdapterInput,
  unavailableExperienceV3DiagnosticEvidence,
} from '..';

const pageSource = readFileSync(resolve(process.cwd(), 'src/app/cv-builder/page.tsx'), 'utf8');
const routeSource = readFileSync(resolve(process.cwd(), 'src/app/api/generate/route.ts'), 'utf8');

const pageM2AdapterMock = vi.hoisted(() => vi.fn());
const pageM3AdapterMock = vi.hoisted(() => vi.fn());
const legacyV2RequestMock = vi.hoisted(() => vi.fn());
const pageUsageIncrementMock = vi.hoisted(() => vi.fn());
const pageToastSuccessMock = vi.hoisted(() => vi.fn());
const pageToastErrorMock = vi.hoisted(() => vi.fn());
const pagePersistMock = vi.hoisted(() => vi.fn());
const pageLegacyFinalizerMock = vi.hoisted(() => vi.fn());

const PAGE_ENTRY_ID = 'route-m3-live-entry';
const PAGE_STALE_SOURCE = 'Stale state source that must not be sent.';
const PAGE_LIVE_SOURCE = 'Helps customers with service questions.\nKeeps accurate request records.';
let pageTestLocale: 'en' | 'de' = 'en';

const pageRuntimeState: {
  currentCv: CVData;
  usage: number;
  writes: CVData[];
} = {
  currentCv: undefined as unknown as CVData,
  usage: 7,
  writes: [],
};

function makePageCv(locale: 'en' | 'de' = 'en'): CVData {
  return {
    id: 'route-m3-live-cv',
    name: 'Route M3 live CV',
    personal: {
      fullName: 'Route Candidate', email: 'route@example.com', phone: '', address: '',
      jobTitle: 'Support Specialist', gender: 'female',
    },
    summary: 'User-owned summary.',
    contentLocale: locale,
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

function installActualPageFlowMocks(options: { realM2?: boolean; realM3?: boolean } = {}): void {
  vi.doMock('@/lib/ai-core-v3', async () => {
    const actual = await vi.importActual<typeof import('..')>('@/lib/ai-core-v3');
    return {
      ...actual,
      runExperienceV3GenerateAdapter: options.realM2
        ? (...args: Parameters<typeof actual.runExperienceV3GenerateAdapter>) => {
          pageM2AdapterMock(...args);
          return actual.runExperienceV3GenerateAdapter(...args);
        }
        : pageM2AdapterMock,
      runExperienceV3EnhanceAdapter: options.realM3
        ? actual.runExperienceV3EnhanceAdapter
        : pageM3AdapterMock,
    };
  });
  vi.doMock('@/lib/i18n/context', () => ({
    useI18n: () => ({ locale: pageTestLocale, t: translations[pageTestLocale] }),
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
        pagePersistMock(next);
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
  vi.doMock('@/lib/cv-ai-finalize-apply', async () => {
    const actual = await vi.importActual<typeof import('../../cv-ai-finalize-apply')>('@/lib/cv-ai-finalize-apply');
    return {
      ...actual,
      finalizeCvAiFieldForApply: (...args: Parameters<typeof actual.finalizeCvAiFieldForApply>) => {
        pageLegacyFinalizerMock(...args);
        return actual.finalizeCvAiFieldForApply(...args);
      },
    };
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
  pageTestLocale = 'en';
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
  pagePersistMock.mockReset();
  pageLegacyFinalizerMock.mockReset();
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
    vi.doUnmock('@/lib/cv-ai-finalize-apply');
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

type ProductionBoundaryScenario = Readonly<{
  source: string;
  units?: readonly string[];
  locale?: 'en' | 'de';
  materialityKind?: string;
  typedFailure?: string;
  wrongIdentity?: boolean;
  rejectValidation?: boolean;
  repeatAcceptedCandidate?: boolean;
  initialCv?: CVData;
  preservePersistedTextarea?: boolean;
  realM2?: boolean;
  expectedSuccess: boolean;
}>;

function productionBoundaryResponse(
  manifest: ReturnType<typeof captureExperienceV3EnhanceOperationSnapshot>['manifest'],
  scenario: ProductionBoundaryScenario,
  requestNumber: number,
): unknown {
  if (scenario.typedFailure) {
    return { ok: false, action: EXPERIENCE_V3_ENHANCE_ACTION, typedReason: scenario.typedFailure };
  }
  const requestedUnits = scenario.repeatAcceptedCandidate && requestNumber > 1
    ? manifest.facts.map((fact) => fact.text.replace(/^\s*[•*-]\s*/u, ''))
    : (scenario.units ?? manifest.facts.map((fact) => fact.text));
  const units = manifest.facts.map((fact, index) => ({
    factId: fact.factId,
    text: requestedUnits[index] ?? requestedUnits[requestedUnits.length - 1] ?? fact.text,
  }));
  const operationId = scenario.wrongIdentity ? `${manifest.operationId}-wrong` : manifest.operationId;
  const candidateText = units.map((unit) => `• ${unit.text}`).join('\n');
  return {
    ok: true,
    action: EXPERIENCE_V3_ENHANCE_ACTION,
    providerOutput: {
      operationId,
      entryId: manifest.entryId,
      snapshotHash: manifest.snapshotHash,
      locale: manifest.locale,
      units,
    },
    candidate: {
      operationId: manifest.operationId,
      candidateId: `production-boundary-${requestNumber}`,
      operationKind: 'experience_enhance',
      targetLocale: manifest.locale,
      sourceSnapshotHash: manifest.snapshotHash,
      text: candidateText,
      units: units.map((unit, index) => ({
        unitId: `production-boundary-${requestNumber}-${index + 1}`,
        entryId: manifest.entryId,
        text: unit.text,
        factIds: [unit.factId],
      })),
    },
    validation: {
      decision: scenario.rejectValidation ? 'reject' : 'accept',
      phases: {
        structural: { status: 'passed', violations: [] },
        semantic: scenario.rejectValidation
          ? { status: 'failed', violations: [{ code: 'grounding_failed', category: 'semantic', detail: 'fixture' }] }
          : { status: 'passed', violations: [] },
        language_quality: { status: 'passed', violations: [] },
      },
    },
    materiality: {
      status: 'material',
      kind: scenario.materialityKind ?? 'professional_phrasing',
      sourceEquivalent: false,
      degradationDetected: false,
    },
    diagnosticEvidence: {
      ...unavailableExperienceV3DiagnosticEvidence(),
      candidatePresent: true,
      candidateHash: hashExperienceV3EnhanceValue(candidateText),
      candidateUnitCount: units.length,
      candidateUnitHashes: units.map((unit) => hashExperienceV3EnhanceValue(unit.text)),
      candidateUnitLengths: units.map((unit) => unit.text.length),
    },
  };
}

async function executeProductionM3PageBoundary(scenario: ProductionBoundaryScenario) {
  const environmentKeys = ['NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'AI_CORE_V3_ENABLED'] as const;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, {
    present: Object.prototype.hasOwnProperty.call(process.env, key),
    value: process.env[key],
  }])) as Record<(typeof environmentKeys)[number], { present: boolean; value: string | undefined }>;

  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  const locale = scenario.locale ?? 'en';
  pageTestLocale = locale;
  pageRuntimeState.currentCv = scenario.initialCv ?? makePageCv(locale);
  pageRuntimeState.usage = 7;
  pageRuntimeState.writes = [];
  pageM2AdapterMock.mockReset().mockResolvedValue({ kind: 'not_applicable' });
  pageM3AdapterMock.mockReset();
  pageUsageIncrementMock.mockReset();
  pageToastSuccessMock.mockReset();
  pageToastErrorMock.mockReset();
  pagePersistMock.mockReset();
  pageLegacyFinalizerMock.mockReset();
  let m3RequestCount = 0;
  const requestBodies: Array<Record<string, unknown>> = [];
  legacyV2RequestMock.mockReset().mockImplementation(async (_url: string, options: { body?: Record<string, unknown> }) => {
    const body = options.body ?? {};
    requestBodies.push(body);
    if (body.action !== EXPERIENCE_V3_ENHANCE_ACTION) {
      return { data: { error: 'unexpected_legacy_fallthrough' }, response: { ok: false, status: 422, headers: { get: () => null } } };
    }
    m3RequestCount += 1;
    const manifest = body.manifest as ReturnType<typeof captureExperienceV3EnhanceOperationSnapshot>['manifest'];
    return {
      data: productionBoundaryResponse(manifest, scenario, m3RequestCount),
      response: { ok: true, status: scenario.typedFailure ? 422 : 200, headers: { get: () => 'application/json' } },
    };
  });
  process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'true';
  process.env.AI_CORE_V3_ENABLED = 'true';
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.resetModules();
  installActualPageFlowMocks({ realM2: scenario.realM2, realM3: true });

  try {
    const core = await import('..');
    core.resetAiCoreV3TestOverride();
    const Page = (await import('@/app/cv-builder/page')).default;
    render(React.createElement(Page));
    fireEvent.click(screen.getByRole('button', { name: translations[locale].cv.experience }));
    const textarea = document.querySelector(
      `[data-experience-description-id="${PAGE_ENTRY_ID}"]`,
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    if (scenario.preservePersistedTextarea) {
      expect(textarea!.value).toBe(scenario.source);
    } else {
      fireEvent.change(textarea!, { target: { value: scenario.source } });
      await waitFor(() => expect(textarea!.value).toBe(scenario.source));
    }
    const aiButton = () => screen.getByRole('button', { name: new RegExp(translations[locale].cv.aiBullets, 'i') });
    fireEvent.click(aiButton());
    const shouldSucceed = scenario.expectedSuccess;
    if (shouldSucceed) await waitFor(() => expect(pageToastSuccessMock).toHaveBeenCalledTimes(1));
    else await waitFor(() => expect(pageToastErrorMock).toHaveBeenCalledTimes(1));

    if (scenario.repeatAcceptedCandidate) {
      fireEvent.click(aiButton());
      await waitFor(() => expect(pageToastErrorMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(m3RequestCount).toBe(2));
    }
    const currentTextarea = document.querySelector(
      `[data-experience-description-id="${PAGE_ENTRY_ID}"]`,
    ) as HTMLTextAreaElement | null;
    const diagnostics = await import('../../cv-experience-ai-diagnostics');
    const diagnostic = diagnostics.getLatestExperienceAiDiagnosticRecord();
    return {
      visibleText: currentTextarea?.value ?? '',
      usage: pageRuntimeState.usage,
      usageCalls: pageUsageIncrementMock.mock.calls.length,
      persistCalls: pagePersistMock.mock.calls.length,
      finalizerCalls: pageLegacyFinalizerMock.mock.calls.length,
      m2Calls: pageM2AdapterMock.mock.calls.length,
      m3RequestCount,
      requestBodies,
      successToastCalls: pageToastSuccessMock.mock.calls.length,
      errorToastCalls: pageToastErrorMock.mock.calls.length,
      diagnostic,
      originalUserDescription: pageRuntimeState.currentCv.experience.find((entry) => entry.id === PAGE_ENTRY_ID)?.originalUserDescription,
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
    vi.doUnmock('@/lib/cv-ai-finalize-apply');
    vi.doUnmock('@/components/Header');
    vi.doUnmock('@/components/Footer');
    vi.doUnmock('sonner');
    if (originalScrollIntoView === undefined) {
      delete (HTMLElement.prototype as { scrollIntoView?: typeof HTMLElement.prototype.scrollIntoView }).scrollIntoView;
    } else {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: originalScrollIntoView });
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

  it('A. production grammar correction crosses the real M3 boundary and commits exactly once', async () => {
    const source = 'supports customers with service questions.\nkeeps accurate request records.';
    const units = ['Supports customers with service questions.', 'Keeps accurate request records.'];
    const run = await executeProductionM3PageBoundary({
      source,
      units,
      materialityKind: 'grammar_correction',
      expectedSuccess: true,
    });
    expect(run.visibleText).toBe(units.map((unit) => `• ${unit}`).join('\n'));
    expect([run.persistCalls, run.usageCalls, run.usage, run.finalizerCalls]).toEqual([1, 1, 8, 0]);
    expect(run.requestBodies[0]).toMatchObject({ action: EXPERIENCE_V3_ENHANCE_ACTION });
    expect(run.diagnostic).toMatchObject({
      operation: EXPERIENCE_V3_ENHANCE_ACTION,
      candidatePresent: true,
      candidateHash: hashExperienceV3EnhanceValue(units.map((unit) => `• ${unit}`).join('\n')),
      finalDecision: 'accept',
      materialityKind: 'grammar_correction',
      applyAttempted: true,
      applyCommitted: true,
      persistenceResult: 'succeeded',
      usageBefore: 7,
      usageAfter: 8,
      usageDelta: 1,
    });
  });

  it('B. physical AAB586 German source echo is rejected by the real M3 transaction', async () => {
    const source = [
      'Wartung an elektrischen Anlagen machen.',
      'Störungen suchen und beheben.',
      'Bei der Installation von elektrischen Komponenten helfen.',
    ].join('\n');
    const run = await executeProductionM3PageBoundary({
      source,
      locale: 'de',
      materialityKind: 'professional_phrasing',
      expectedSuccess: false,
    });
    expect(run.visibleText).toBe(source);
    expect([run.persistCalls, run.usageCalls, run.usage, run.finalizerCalls]).toEqual([0, 0, 7, 0]);
    expect(run.diagnostic).toMatchObject({
      operation: EXPERIENCE_V3_ENHANCE_ACTION,
      candidatePresent: true,
      candidateHash: hashExperienceV3EnhanceValue(source.split('\n').map((unit) => `• ${unit}`).join('\n')),
      finalDecision: 'reject',
      finalDecisionKind: 'semantic_noop',
      sourceEquivalentToAuthoritativeSource: true,
      applyAttempted: false,
      applyCommitted: false,
      persistenceResult: 'not_attempted',
      usageBefore: 7,
      usageAfter: 7,
      usageDelta: 0,
    });
  });

  it('C. already-correct visible text remains distinct from original provenance and costs zero', async () => {
    const run = await executeProductionM3PageBoundary({
      source: PAGE_LIVE_SOURCE,
      expectedSuccess: false,
    });
    expect(run.originalUserDescription).toBe('Older original source.');
    expect(run.visibleText).toBe(PAGE_LIVE_SOURCE);
    expect([run.persistCalls, run.usageCalls, run.usage, run.finalizerCalls]).toEqual([0, 0, 7, 0]);
    expect(run.diagnostic).toMatchObject({
      candidatePresent: true,
      candidateHash: hashExperienceV3EnhanceValue(PAGE_LIVE_SOURCE.split('\n').map((unit) => `• ${unit}`).join('\n')),
      finalDecision: 'reject',
      finalDecisionKind: 'semantic_noop',
      applyAttempted: false,
      applyCommitted: false,
      persistenceResult: 'not_attempted',
      usageBefore: 7,
      usageAfter: 7,
      usageDelta: 0,
    });
  });

  it.each(['grammar_error_fixed', 'grounded_phrasing_enhancement'])(
    'D. invalid materiality provenance %s is rejected at the production parser boundary',
    async (materialityKind) => {
      const run = await executeProductionM3PageBoundary({
        source: PAGE_LIVE_SOURCE,
        units: ['Provides timely customer support.', 'Maintains accurate request records.'],
        materialityKind,
        expectedSuccess: false,
      });
      expect(run.visibleText).toBe(PAGE_LIVE_SOURCE);
      expect([run.persistCalls, run.usageCalls, run.usage, run.finalizerCalls]).toEqual([0, 0, 7, 0]);
      expect(run.diagnostic).toMatchObject({
        candidatePresent: true,
        candidateHash: hashExperienceV3EnhanceValue('Provides timely customer support.\nMaintains accurate request records.'.split('\n').map((unit) => `• ${unit}`).join('\n')),
        finalDecision: 'reject',
        applyAttempted: false,
        applyCommitted: false,
        persistenceResult: 'not_attempted',
        usageBefore: 7,
        usageAfter: 7,
        usageDelta: 0,
        rejectionReasonCodes: ['invalid_v3_enhance_response'],
      });
    },
  );

  it('E. wrong operation evidence cannot authorize a different production candidate', async () => {
    const run = await executeProductionM3PageBoundary({
      source: PAGE_LIVE_SOURCE,
      units: ['Provides timely customer support.', 'Maintains accurate request records.'],
      materialityKind: 'professional_phrasing',
      wrongIdentity: true,
      expectedSuccess: false,
    });
    expect(run.visibleText).toBe(PAGE_LIVE_SOURCE);
    expect([run.persistCalls, run.usageCalls, run.usage, run.finalizerCalls]).toEqual([0, 0, 7, 0]);
    expect(run.diagnostic).toMatchObject({
      candidatePresent: true,
      candidateHash: hashExperienceV3EnhanceValue('Provides timely customer support.\nMaintains accurate request records.'.split('\n').map((unit) => `• ${unit}`).join('\n')),
      finalDecision: 'reject',
      applyAttempted: false,
      applyCommitted: false,
      persistenceResult: 'not_attempted',
      usageBefore: 7,
      usageAfter: 7,
      usageDelta: 0,
      rejectionReasonCodes: ['candidate_or_validation_mismatch'],
    });
  });

  it('F. accepted production improvement charges once and a same-visible repeat charges zero', async () => {
    const units = [
      'Provides timely support for customer service questions.',
      'Maintains accurate records of customer requests.',
    ];
    const run = await executeProductionM3PageBoundary({
      source: PAGE_LIVE_SOURCE,
      units,
      materialityKind: 'professional_phrasing',
      repeatAcceptedCandidate: true,
      expectedSuccess: true,
    });
    expect(run.visibleText).toBe(units.map((unit) => `• ${unit}`).join('\n'));
    expect([run.m3RequestCount, run.persistCalls, run.usageCalls, run.usage]).toEqual([2, 1, 1, 8]);
    expect([run.finalizerCalls, run.successToastCalls, run.errorToastCalls]).toEqual([0, 1, 1]);
    expect(run.diagnostic).toMatchObject({
      candidatePresent: true,
      candidateHash: hashExperienceV3EnhanceValue(units.map((unit) => `• ${unit}`).join('\n')),
      finalDecision: 'reject',
      finalDecisionKind: 'semantic_noop',
      applyAttempted: false,
      applyCommitted: false,
      persistenceResult: 'not_attempted',
      usageBefore: 8,
      usageAfter: 8,
      usageDelta: 0,
    });
  });

  it('G. recognized materiality cannot override failed semantic grounding', async () => {
    const run = await executeProductionM3PageBoundary({
      source: PAGE_LIVE_SOURCE,
      units: ['Provides timely customer support.', 'Maintains accurate request records.'],
      materialityKind: 'grammar_correction',
      rejectValidation: true,
      expectedSuccess: false,
    });
    expect(run.visibleText).toBe(PAGE_LIVE_SOURCE);
    expect([run.persistCalls, run.usageCalls, run.usage, run.finalizerCalls]).toEqual([0, 0, 7, 0]);
    expect(run.diagnostic).toMatchObject({
      candidatePresent: true,
      candidateHash: hashExperienceV3EnhanceValue('Provides timely customer support.\nMaintains accurate request records.'.split('\n').map((unit) => `• ${unit}`).join('\n')),
      finalDecision: 'reject',
      applyAttempted: false,
      applyCommitted: false,
      persistenceResult: 'not_attempted',
      usageBefore: 7,
      usageAfter: 7,
      usageDelta: 0,
      rejectionReasonCodes: ['candidate_or_validation_mismatch'],
    });
  });

  it('H. persisted unedited German AI state routes through real M2/M3 without a textarea change', async () => {
    const knownPhysicalSource = [
      'Wartung an elektrischen Anlagen machen.',
      'Störungen suchen und beheben.',
      'Bei der Installation von elektrischen Komponenten helfen.',
    ].join('\n');
    // Controlled persisted-output fixture only; it is not claimed as the
    // unknown pre-click text from the historical AAB586 run.
    const syntheticPersistedAiVisible = [
      'Führt Wartungsarbeiten an elektrischen Anlagen durch.',
      'Lokalisiert und behebt Störungen in elektrischen Systemen.',
      'Unterstützt die Installation elektrischer Komponenten.',
    ].join('\n');
    const persistedCv = makePageCv('de');
    persistedCv.personal.gender = 'male';
    persistedCv.experience[0] = {
      ...persistedCv.experience[0],
      company: 'Controlled Fixture GmbH',
      position: 'Elektroservicetechniker',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: syntheticPersistedAiVisible,
      generatedDescription: syntheticPersistedAiVisible,
      generatedLocale: 'de',
      canonicalDescription: knownPhysicalSource,
      originalUserDescription: knownPhysicalSource,
      descriptionOrigin: 'ai_generated',
      aiOutputProvenance: buildExperienceAiOutputProvenance({
        experienceEntryId: PAGE_ENTRY_ID,
        appliedOutput: syntheticPersistedAiVisible,
        preAiFactText: knownPhysicalSource,
        sourceLocale: 'de',
        targetLocale: 'de',
        operationMode: 'enhance',
        sourceAuthorityKind: 'original_user',
        requestHash: 'controlled-persisted-route-fixture',
        appliedAt: '2026-09-15T00:00:00.000Z',
      }),
    };
    expect(resolveExperienceTextareaProvenance(persistedCv.experience[0]!))
      .toMatchObject({ currentTextareaProvenance: 'ai_generated_unedited' });

    const run = await executeProductionM3PageBoundary({
      source: syntheticPersistedAiVisible,
      locale: 'de',
      initialCv: persistedCv,
      preservePersistedTextarea: true,
      realM2: true,
      expectedSuccess: false,
    });

    expect(run.m2Calls).toBe(1);
    expect(run.requestBodies).toHaveLength(1);
    expect(run.requestBodies[0]).toMatchObject({ action: EXPERIENCE_V3_ENHANCE_ACTION });
    expect([run.finalizerCalls, run.persistCalls, run.usageCalls, run.usage])
      .toEqual([0, 0, 0, 7]);
    expect(run.visibleText).toBe(syntheticPersistedAiVisible);
    expect(run.diagnostic).toMatchObject({
      marker: 'EXPERIENCE_V3_TERMINAL_DIAGNOSTIC',
      operation: EXPERIENCE_V3_ENHANCE_ACTION,
      selectedEngine: 'experience_v3_enhance',
      v3EnabledForOperation: true,
      m3Applicability: 'owned',
      m3NotApplicableReason: null,
      finalDecision: 'reject',
      finalDecisionKind: 'semantic_noop',
      usageBefore: 7,
      usageAfter: 7,
      usageMeasurementStatus: 'observed',
      observedUsageAfter: 7,
      observedUsageDelta: 0,
      usageIncrementAttempted: false,
    });
    expect((run.diagnostic as ExperienceV3TerminalDiagnostic).routingRequestIdHash)
      .toBe((run.diagnostic as ExperienceV3TerminalDiagnostic).requestIdHash);
    expect((run.diagnostic as ExperienceV3TerminalDiagnostic).routingOperationIdHash)
      .toBe((run.diagnostic as ExperienceV3TerminalDiagnostic).operationIdHash);
  });

  it('I. actual M3 not-applicable reason is bound to the legacy terminal record', async () => {
    const germanSource = [
      'Wartung an elektrischen Anlagen machen.',
      'Störungen suchen und beheben.',
      'Bei der Installation von elektrischen Komponenten helfen.',
    ].join('\n');
    const invalidCompletedDateCv = makePageCv('de');
    invalidCompletedDateCv.personal.gender = 'male';
    invalidCompletedDateCv.experience[0] = {
      ...invalidCompletedDateCv.experience[0],
      position: 'Elektroservicetechniker',
      description: germanSource,
      generatedDescription: '',
      generatedLocale: 'de',
      isPresent: false,
      endDate: 'not-a-structured-date',
      canonicalDescription: germanSource,
      originalUserDescription: germanSource,
      descriptionOrigin: 'user',
      aiOutputProvenance: undefined,
    };
    const run = await executeProductionM3PageBoundary({
      source: germanSource,
      locale: 'de',
      initialCv: invalidCompletedDateCv,
      preservePersistedTextarea: true,
      realM2: true,
      expectedSuccess: false,
    });

    expect(run.m2Calls).toBe(1);
    expect(run.m3RequestCount).toBe(0);
    expect(run.requestBodies).toHaveLength(1);
    expect(run.requestBodies[0]).toMatchObject({ action: 'bullets' });
    expect(run.diagnostic).toMatchObject({
      marker: 'EXPERIENCE_AI_DIAG_V1',
      selectedEngine: 'legacy_experience',
      v3EnabledForOperation: true,
      m2Applicability: 'not_applicable',
      m3Applicability: 'not_applicable',
      m3NotApplicableReason: 'end_date_invalid',
    });
    const legacyDiagnostic = run.diagnostic as {
      requestIdHash?: string;
      routingRequestIdHash?: string;
      routingOperationIdHash?: string;
    };
    expect(legacyDiagnostic.routingRequestIdHash).toBe(legacyDiagnostic.requestIdHash);
    expect(legacyDiagnostic.routingOperationIdHash).toBe(legacyDiagnostic.requestIdHash);
  });
});
