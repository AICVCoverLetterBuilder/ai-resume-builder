import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import {
  getInternalTestBootstrapCapability,
  isInternalTestClientCapabilityEnabled,
  isInternalTestServerCapabilityEnabled,
} from '@/lib/internal-test-pro-entitlement';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import { createEmptyContentLocalizeV3ServerDiagnostic } from '../content-localize-v3-terminal-diagnostics';
import {
  contentLocalizeV3ClientErrorCode,
  runContentLocalizeV3ClientOperation,
} from '../content-localize-v3-client';
import type { ContentLocalizeM6SummarySnapshot } from '../content-localize-m6';
import { createContentLocalizeM6HandledFailure } from '../content-localize-m6-server';

const sourceText = 'Mila builds reliable APIs at Atlas.';

function snapshot(): ContentLocalizeM6SummarySnapshot {
  return {
    operationId: 'm8-409-operation',
    requestId: 'm8-409-request',
    kind: 'summary',
    sourceLocale: 'de',
    targetLocale: 'fr',
    sourceText,
    sourceTextHash: hashSummarySourceLocaleText(sourceText),
  };
}

async function runClient(data: unknown, status = 409) {
  const diagnostics: Array<Record<string, unknown>> = [];
  const current = snapshot();
  const result = await runContentLocalizeV3ClientOperation({
    snapshot: current,
    cv: {} as CVData,
    proToken: 'test-token',
    usageCountBefore: 11,
  }, {
    request: async () => ({ data, status }),
    getLiveCv: () => ({} as CVData),
    getActiveOperationId: () => current.operationId,
    commitCandidate: () => { throw new Error('commit must not be reached'); },
    getUsageCount: () => 11,
    recordDiagnostic: (diagnostic) => diagnostics.push(diagnostic as unknown as Record<string, unknown>),
  });
  return { result, diagnostic: diagnostics[0] };
}

describe('M8 content-localize-v3 feature-gate 409 contract', () => {
  it('R409-1/R409-2: gate failure is owned before writer, evaluator, or repair', () => {
    const envelope = createContentLocalizeM6HandledFailure('v3_feature_disabled');
    expect(envelope.status).toBe('handled_failure');
    expect(envelope.reason).toBe('v3_feature_disabled');
    expect(envelope.diagnostic).toBeDefined();
  });

  it('R409-3: server uses the canonical handled-failure envelope with diagnostics', () => {
    const envelope = createContentLocalizeM6HandledFailure('v3_feature_disabled');
    expect(Object.keys(envelope)).toEqual(['status', 'reason']);
    expect(envelope.diagnostic).toEqual(createEmptyContentLocalizeV3ServerDiagnostic());
  });

  it('R409-4/R409-5: client accepts the exact 409 and preserves the typed reason', async () => {
    const run = await runClient({
      status: 'handled_failure',
      reason: 'v3_feature_disabled',
      diagnostic: createEmptyContentLocalizeV3ServerDiagnostic(),
    });
    expect(run.result).toEqual({ kind: 'terminal', status: 409, reason: 'v3_feature_disabled' });
    expect(run.result.kind).toBe('terminal');
    if (run.result.kind === 'terminal') expect(run.result.reason).not.toBe('route_result_malformed');
  });

  it('R409-6/R409-7/R409-8: gate failure cannot apply, persist, or consume usage', async () => {
    const run = await runClient({
      status: 'handled_failure',
      reason: 'v3_feature_disabled',
      diagnostic: createEmptyContentLocalizeV3ServerDiagnostic(),
    });
    expect(run.diagnostic).toMatchObject({
      applyAuthorized: false,
      applyAttempted: false,
      applyCommitted: false,
      persistenceAttempted: false,
      persistenceResult: 'not_attempted',
      usageBefore: 11,
      usageAfter: 11,
    });
  });

  it('R409-9: an arbitrary legacy 409 payload remains malformed', async () => {
    const run = await runClient({ ok: false, action: 'content-localize-v3', typedReason: 'v3_feature_disabled' });
    expect(run.result).toEqual({ kind: 'terminal', status: 409, reason: 'route_result_malformed' });
  });

  it('R409-10: status-only and incomplete gate envelopes remain fail-closed', async () => {
    const statusOnly = await runClient({ status: 409 });
    const missingDiagnostic = await runClient({ status: 'handled_failure', reason: 'v3_feature_disabled' });
    expect(statusOnly.result.kind).toBe('terminal');
    expect(missingDiagnostic.result.kind).toBe('terminal');
    if (statusOnly.result.kind === 'terminal') expect(statusOnly.result.reason).toBe('route_result_malformed');
    if (missingDiagnostic.result.kind === 'terminal') expect(missingDiagnostic.result.reason).toBe('route_result_malformed');
  });
});

describe('M8 content-localize-v3 user mapping and internal QA contract', () => {
  it('UX-1: feature-gate 409 uses an unavailable-feature category, not validation prose', () => {
    expect(contentLocalizeV3ClientErrorCode('v3_feature_disabled')).toBe('ai_feature_unavailable');
    expect(aiErrorMessage('ai_feature_unavailable', 'de')).not.toMatch(/validierung|Prüfung nicht bestanden/i);
  });

  it('UX-2: evaluator rejection retains the validation category', () => {
    expect(contentLocalizeV3ClientErrorCode('candidate_rejected')).toBe('generation_validation_failed');
    expect(aiErrorMessage('generation_validation_failed', 'en')).toMatch(/failed validation/i);
  });

  it('UX-3: provider deadline retains the timeout category', () => {
    expect(contentLocalizeV3ClientErrorCode('deadline_exceeded')).toBe('request_timeout');
    expect(aiErrorMessage('request_timeout', 'en')).toMatch(/timed out/i);
  });

  it('QA-1: internal client/server capability agreement is the only internal bootstrap success', () => {
    const env = {
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
      NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT: 'true',
      NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY: 'qa-fixture-capability',
      AI_INTERNAL_TEST_PRO_ENTITLEMENT: 'true',
      VERCEL_ENV: 'preview',
    };
    expect(getInternalTestBootstrapCapability(env)).toBe('qa-fixture-capability');
    expect(isInternalTestClientCapabilityEnabled(env)).toBe(true);
    expect(isInternalTestServerCapabilityEnabled(env)).toBe(true);
  });

  it('QA-2/QA-3: commercial or production state cannot satisfy the internal gate', () => {
    expect(isInternalTestServerCapabilityEnabled({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
      AI_INTERNAL_TEST_PRO_ENTITLEMENT: 'false',
      VERCEL_ENV: 'preview',
    })).toBe(false);
    expect(isInternalTestServerCapabilityEnabled({
      NEXT_PUBLIC_BUILD_CHANNEL: 'production',
      AI_INTERNAL_TEST_PRO_ENTITLEMENT: 'false',
      VERCEL_ENV: 'production',
    })).toBe(false);
  });
});
