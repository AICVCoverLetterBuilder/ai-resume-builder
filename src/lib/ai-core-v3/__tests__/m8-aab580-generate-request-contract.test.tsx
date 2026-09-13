/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '../../types';
import { translations, type Locale } from '../../i18n/translations';
import type { SummaryV3Manifest } from '../summary-generate';
import { parseSummaryV3GenerateRequest } from '../summary-generate-server';

const duties = [
  'Wartung elektrischer Anlagen',
  'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen',
  'Unterstützung bei der Installation elektrischer Komponenten',
];
const fingerprint = 'sha256_01234567_89abcdef_01234567';
const candidate = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';
const checks = ['factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
  'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected', 'targetLanguageAndScript',
  'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense', 'grammarAndClarity',
  'duplicationAndDegradationAbsent', 'completeSummaryUsable'];

function physicalCv(locale: Locale): CVData {
  return {
    id: 'aab580-contract-fixture', name: 'Controlled fixture',
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '', gender: '' },
    summary: '', contentLocale: locale,
    experience: [{
      id: 'physical-current', company: 'NordWerk Elektroservice Test',
      position: 'Servicetechniker Elektrotechnik', positionSourceLocale: 'de', positionProvenance: 'manual',
      descriptionSourceLocale: 'de', startDate: '2023-08', endDate: '', isPresent: true,
      description: duties.join('\n'),
    }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '',
  };
}

type Wire = { action: string; manifest: SummaryV3Manifest; authTokenFingerprintAtClick?: unknown;
  requestId: string; proToken: string; [key: string]: unknown };

type MutableWireFact = {
  factId: string;
  [key: string]: unknown;
};

type MutableWireEntry = {
  facts: MutableWireFact[];
  employmentState?: string;
  [key: string]: unknown;
};

type MutableWireManifest = {
  currentRoleEntryId?: string | null;
  selectedEntries: MutableWireEntry[];
  structuredTotalDurationMonths?: number;
  requestedLocale?: string;
  targetLocale?: string;
  [key: string]: unknown;
};

type MutableWire = {
  action?: string;
  manifest?: MutableWireManifest | null;
  authTokenFingerprintAtClick?: unknown;
  requestId?: string;
  proToken?: string;
  [key: string]: unknown;
};

function requireMutableManifest(body: MutableWire): MutableWireManifest {
  if (!body.manifest) throw new Error('Expected captured M4 manifest before adversarial mutation');
  return body.manifest;
}

// Run the actual rendered page, adapter, apiFetch JSON serializer, route, parser,
// writer parser, evaluator parser and apply transaction. Only external owners
// (store/auth/provider/fetch transport) are injected; the wire body is never repaired.
async function physicalFlow(options: {
  locale?: Locale; fingerprint?: unknown; mutate?: (body: MutableWire) => void;
  providerFailure?: 'writer' | 'evaluator'; missingDuty?: number; repairMissingDuty?: boolean;
} = {}) {
  cleanup(); localStorage.clear(); sessionStorage.clear();
  const locale = options.locale ?? 'en';
  let cv = physicalCv(locale);
  let usage = 6;
  let wire = '';
  let responseStatus = 0;
  let responseBody: Record<string, unknown> = {};
  let writerCalls = 0;
  let evaluatorCalls = 0;
  let repairTargetReceived = false;
  const success = vi.fn();
  const error = vi.fn();
  const fixedDate = new Date('2026-09-12T20:38:02.718Z');
  const NativeDate = Date;
  vi.stubGlobal('Date', class extends NativeDate {
    constructor(value?: string | number | Date) { super(value === undefined ? fixedDate.getTime() : value as string); }
    static now() { return fixedDate.getTime(); }
  });
  vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
  vi.stubEnv('NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'true');
  vi.stubEnv('AI_CORE_V3_ENABLED', 'true');
  vi.stubEnv('ANTHROPIC_API_KEY', 'controlled-no-network-fixture');
  vi.resetModules();
  vi.doMock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale, t: translations[locale] }) }));
  vi.doMock('@/components/Header', () => ({ default: () => null }));
  vi.doMock('@/components/Footer', () => ({ default: () => null }));
  vi.doMock('sonner', () => ({ toast: { success, error } }));
  vi.doMock('@/lib/pro-token', () => ({ verifyProToken: vi.fn(async () => ({ subject: 'controlled' })) }));
  vi.doMock('@/lib/store', () => ({
    checkProAccess: () => 'allowed',
    useApp: () => ({
      currentCv: cv, setCurrentCv: (value: CVData) => { cv = value; },
      persistCurrentCvTransactionally: (value: CVData) => { cv = value; return true; },
      isPro: true, canDownload: () => true, incrementDownloads: vi.fn(), markAiRecommendUsed: vi.fn(),
      lastCvSavedAt: 0, getProAiUsageCount: () => usage,
      getAiGate: () => ({ status: 'ready', token: 'controlled-token' }),
      getProAuthObservation: async () => ({
        authPlatformNative: true, authPlatformName: 'android', authSyncLastResult: 'success',
        authSyncSource: 'startup', authTokenRemainingLifetimeBucket: 'over_5m',
        authTokenFingerprint: fingerprint,
        authTokenFingerprintAtClick: Object.hasOwn(options, 'fingerprint') ? options.fingerprint : fingerprint,
      }),
      commitProAiSuccess: () => {
        const before = usage; usage += 1;
        return { ok: true, attempted: true, before, after: usage, delta: 1,
          forwardWriteResult: 'succeeded', verificationResult: 'passed', rollbackAttempted: false,
          rollbackResult: 'not_required', record: { count: usage, windowStart: 0, schemaVersion: 2, policyLimit: 50 } };
      },
    }),
  }));
  vi.doMock('@anthropic-ai/sdk', () => {
    class MockAnthropic {
      messages = { create: async (params: { tool_choice: { name: string }; messages: { content: string }[] }) => {
        const evaluator = params.tool_choice.name.includes('validation');
        if (evaluator) evaluatorCalls += 1; else writerCalls += 1;
        if (options.providerFailure === (evaluator ? 'evaluator' : 'writer')) throw new Error('controlled provider failure');
        const manifest = (JSON.parse(wire) as Wire).manifest;
        if (!evaluator && writerCalls === 2 && options.repairMissingDuty) {
          const repair = JSON.parse(params.messages[0].content.split('\n').at(-1)!);
          expect(repair.repairEvidence.failedCheckIds).toEqual(['factRetention']);
          expect(repair.violations[0].factIds).toEqual([manifest.selectedEntries[0].facts[options.missingDuty!].factId]);
          expect(repair.violations[0].entryIds).toEqual([manifest.currentRoleEntryId]);
          repairTargetReceived = true;
        }
        const text = options.missingDuty === undefined || repairTargetReceived ? candidate
          : candidate.replace([
            'carry out maintenance work on electrical systems, ',
            'locate and resolve faults in electrical systems, ',
            'as well as support the installation of electrical components',
          ][options.missingDuty], '');
        // Human-labelled fixture surfaces model the external semantic judge.
        // Inspect the actual evaluator request so acceptance cannot depend only
        // on call number or a canned second-pass success response.
        const evaluatedText = evaluator ? JSON.parse(params.messages[0].content.split('\n').at(-1)!).candidate.text : '';
        const rejected = options.missingDuty !== undefined && evaluatedText !== candidate;
        const input = evaluator ? {
          operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
          phases: {
            semantic: rejected ? { status: 'failed', violations: [{
              code: 'missing_fact', category: 'semantic',
              detail: 'Restore the missing material duty from its bound source fact.',
              factIds: [manifest.selectedEntries[0].facts[options.missingDuty!].factId],
              entryIds: [manifest.currentRoleEntryId],
            }] } : { status: 'passed', violations: [] },
            language_quality: { status: 'passed', violations: [] },
          },
          checks: Object.fromEntries(checks.map((key) => [key, !(rejected && key === 'factRetention')])),
        } : {
          operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
          units: [
            { slot: 'duration', entryId: null, factIds: [], text: text.slice(0, text.indexOf('.') + 1) },
            { slot: 'experience', entryId: manifest.currentRoleEntryId,
              factIds: manifest.selectedEntries[0].facts.map((f) => f.factId), text: text.slice(text.indexOf('.') + 2) },
          ],
        };
        return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: params.tool_choice.name, input }] };
      } };
    }
    return { default: MockAnthropic };
  });
  const { POST } = await import('@/app/api/generate/route');
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
    wire = String(init.body);
    if (options.mutate) {
      const body = JSON.parse(wire) as MutableWire;
      options.mutate(body);
      wire = JSON.stringify(body);
    }
    const response = await POST(new Request('http://localhost/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: wire,
    }) as Parameters<typeof POST>[0]);
    responseStatus = response.status;
    responseBody = await response.clone().json();
    return response;
  }));
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  const Page = (await import('@/app/cv-builder/page')).default;
  render(React.createElement(Page));
  fireEvent.click(screen.getByRole('button', { name: translations[locale].cv.summary }));
  fireEvent.click(screen.getByRole('button', { name: new RegExp(translations[locale].cv.generate, 'i') }));
  await waitFor(() => expect(success.mock.calls.length + error.mock.calls.length).toBeGreaterThan(0), { timeout: 15000 });
  const editor = document.querySelector('[data-summary-v3-editor]') as HTMLTextAreaElement;
  return { wire, responseStatus, responseBody, writerCalls, evaluatorCalls,
    usage, visible: editor.value, success: success.mock.calls.length, repairTargetReceived };
}

afterEach(() => {
  cleanup(); localStorage.clear(); sessionStorage.clear();
  for (const moduleName of ['@/lib/i18n/context', '@/components/Header', '@/components/Footer',
    'sonner', '@/lib/pro-token', '@/lib/store', '@anthropic-ai/sdk']) vi.doUnmock(moduleName);
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules();
});

describe('AAB580 real page / serialized M4 / actual route request contract', () => {
  it.each([['maintenance', 0], ['fault diagnosis/resolution', 1], ['installation support', 2]] as const)(
    'AAB584 restores missing %s through actual route, rendered apply and usage', async (_name, missingDuty) => {
      const run = await physicalFlow({ missingDuty, repairMissingDuty: true });
      expect(run.repairTargetReceived).toBe(true);
      expect(run.writerCalls).toBe(2);
      expect(run.evaluatorCalls).toBe(2);
      expect(run.responseStatus).toBe(200);
      expect(run.responseBody).toMatchObject({ ok: true, repairAttempted: true,
        validation: { decision: 'accept', phases: { structural: { status: 'passed' },
          semantic: { status: 'passed' }, language_quality: { status: 'passed' } } } });
      expect(run.usage).toBe(7);
      expect(run.visible).toBe(candidate);
      expect(run.success).toBe(1);
    }, 30000);
  it('accepts the physical empty Summary request including internal fingerprint metadata', async () => {
    const run = await physicalFlow();
    const body = JSON.parse(run.wire) as Wire;
    expect(body.authTokenFingerprintAtClick).toBe(fingerprint);
    expect(body.action).toBe('summary_v3_generate');
    expect(body.manifest.structuredTotalDurationMonths).toBe(37);
    expect(body.manifest.selectedEntries[0].sourceUnits).toEqual(duties);
    expect(body.manifest.selectedEntries[0].roleTitle).toBe('Servicetechniker Elektrotechnik');
    expect(parseSummaryV3GenerateRequest({ manifest: body.manifest })).not.toBeNull();
    expect(run.responseStatus, JSON.stringify(run.responseBody)).toBe(200);
    expect(run.writerCalls).toBe(1);
    expect(run.evaluatorCalls).toBe(1);
    expect(run.usage).toBe(7);
    expect(run.visible).toBe(candidate);
    expect(run.success).toBe(1);
  }, 30000);

  it('accepts the same M4 request when optional fingerprint metadata is absent', async () => {
    const run = await physicalFlow({ fingerprint: undefined });
    expect(JSON.parse(run.wire)).not.toHaveProperty('authTokenFingerprintAtClick');
    expect(run.responseStatus, JSON.stringify(run.responseBody)).toBe(200);
    expect(run.writerCalls).toBe(1);
    expect(run.evaluatorCalls).toBe(1);
    expect(run.usage).toBe(7);
  }, 30000);

  it.each([
    ['arbitrary unknown key', (body: MutableWire) => { body.unexpectedM4DomainKey = 'forbidden'; }],
    ['missing manifest', (body: MutableWire) => { delete body.manifest; }],
    ['unknown current role', (body: MutableWire) => {
      requireMutableManifest(body).currentRoleEntryId = 'unknown-entry';
    }],
    ['duplicate stable entry IDs', (body: MutableWire) => {
      const manifest = requireMutableManifest(body);
      manifest.selectedEntries = [
        ...manifest.selectedEntries, manifest.selectedEntries[0],
    ]; }],
    ['duplicate fact IDs', (body: MutableWire) => {
      const manifest = requireMutableManifest(body);
      manifest.selectedEntries[0].facts[1].factId = manifest.selectedEntries[0].facts[0].factId;
    }],
    ['invalid employment enum', (body: MutableWire) => {
      requireMutableManifest(body).selectedEntries[0].employmentState = 'active';
    }],
    ['invalid duration', (body: MutableWire) => {
      requireMutableManifest(body).structuredTotalDurationMonths = -1;
    }],
    ['invalid requested/target locale relation', (body: MutableWire) => {
      requireMutableManifest(body).targetLocale = 'xx';
    }],
    ['malformed manifest', (body: MutableWire) => {
      body.manifest = null;
    }],
    ['legacy V2-only shape', (body: MutableWire) => {
      delete body.manifest;
      body.experienceEntries = [{ position: 'legacy', description: 'legacy' }];
    }],
  ] as const)('fails closed for %s without provider or usage', async (_label, mutate) => {
    const run = await physicalFlow({ mutate });
    expect(run.responseStatus).toBe(400);
    expect(run.responseBody).toMatchObject({ ok: false, typedReason: 'invalid_request_contract' });
    expect(run.writerCalls).toBe(0);
    expect(run.evaluatorCalls).toBe(0);
    expect(run.usage).toBe(6);
    expect(run.visible).toBe('');
    expect(run.success).toBe(0);
  }, 30000);

  it.each(['sr', 'en', 'hi', 'ar', 'ja', 'de', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru'] as const)(
    'accepts empty Summary plus structured cross-locale Experience for %s', async (locale) => {
      const run = await physicalFlow({ locale });
      const body = JSON.parse(run.wire) as Wire;
      expect(body.manifest.targetLocale).toBe(locale);
      expect(body.manifest.requestedLocale).toBe(locale);
      expect(body.manifest.selectedEntries[0].roleTitle).toBe('Servicetechniker Elektrotechnik');
      expect(body.manifest.selectedEntries[0]).not.toHaveProperty('rolePresentation');
      expect(run.responseStatus, JSON.stringify(run.responseBody)).toBe(200);
      expect(run.writerCalls).toBe(1);
      expect(run.evaluatorCalls).toBe(1);
    }, 30000,
  );

  it.each([
    ['writer', 1, 0],
    ['evaluator', 1, 1],
  ] as const)('keeps %s provider failure fail closed with no usage increment', async (providerFailure, writerCalls, evaluatorCalls) => {
    const run = await physicalFlow({ providerFailure });
    expect(run.responseStatus).toBe(502);
    expect(run.writerCalls).toBe(writerCalls);
    expect(run.evaluatorCalls).toBe(evaluatorCalls);
    expect(run.usage).toBe(6);
    expect(run.visible).toBe('');
    expect(run.success).toBe(0);
  }, 30000);

  it.each([
    ['maintenance', 0],
    ['fault diagnosis/resolution', 1],
    ['installation support', 2],
    ['explicit two-of-three material duties', 2],
  ] as const)('rejects generated candidate missing %s with no apply or usage', async (_label, missingDuty) => {
    const run = await physicalFlow({ missingDuty });
    expect(run.responseStatus).toBe(422);
    expect(run.writerCalls).toBe(2);
    expect(run.evaluatorCalls).toBe(2);
    expect(run.usage).toBe(6);
    expect(run.visible).toBe('');
    expect(run.success).toBe(0);
  }, 30000);
});
