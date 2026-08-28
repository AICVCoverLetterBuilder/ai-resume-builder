import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const pageSource = readFileSync(
  resolve(process.cwd(), 'src/app/cv-builder/page.tsx'),
  'utf8',
);
const routeSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/generate/route.ts'),
  'utf8',
);
const clientV3Source = readFileSync(
  resolve(process.cwd(), 'src/lib/ai-core-v3/experience-generate.ts'),
  'utf8',
);
const serverV3Source = readFileSync(
  resolve(process.cwd(), 'src/lib/ai-core-v3/experience-generate-server.ts'),
  'utf8',
);

describe('M2 focused page and route integration', () => {
  it('places the additive page adapter before the unchanged V2 provenance/finalizer body', () => {
    const adapter = pageSource.indexOf('runExperienceV3GenerateAdapter({');
    const v2Provenance = pageSource.indexOf('resolveExperienceTextareaProvenance({', adapter);
    const v2Finalizer = pageSource.indexOf('finalizeCvAiFieldForApply({', adapter);
    expect(adapter).toBeGreaterThan(-1);
    expect(adapter).toBeLessThan(v2Provenance);
    expect(adapter).toBeLessThan(v2Finalizer);
  });

  it('allows V2 continuation only for not_applicable and returns for both handled results', () => {
    expect(pageSource).toContain("if (experienceV3Result.kind !== 'not_applicable') {");
    const terminalBlock = pageSource.slice(
      pageSource.indexOf("if (experienceV3Result.kind !== 'not_applicable') {"),
      pageSource.indexOf('// Freeze the live textarea first'),
    );
    expect(terminalBlock).toContain('return;');
    expect(terminalBlock).not.toContain("action: 'bullets'");
  });

  it('routes the isolated V3 discriminator before the legacy bullets action', () => {
    const v3 = routeSource.indexOf('if (action === EXPERIENCE_V3_GENERATE_ACTION)');
    const legacy = routeSource.indexOf("if (action === 'bullets')");
    expect(v3).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(v3);
  });

  it('blocks direct V3 Experience Generate route calls before writer and evaluator when the server flag is false', async () => {
    const environmentKeys = [
      'AI_CORE_V3_ENABLED',
      'NEXT_PUBLIC_AI_CORE_V3_ENABLED',
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_AUTH_TOKEN',
    ] as const;
    const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, {
      present: Object.prototype.hasOwnProperty.call(process.env, key),
      value: process.env[key],
    }])) as Record<(typeof environmentKeys)[number], { present: boolean; value: string | undefined }>;
    const writerSpy = vi.fn(() => {
      throw new Error('V3 writer must not run while disabled');
    });
    const evaluatorSpy = vi.fn(() => {
      throw new Error('V3 evaluator must not run while disabled');
    });
    const messagesCreateSpy = vi.fn((params: { system?: unknown }) => {
      const system = String(params?.system || '');
      if (system.includes('single AI Core V3 Experience prose writer')) return writerSpy();
      if (system.includes('independent non-writing CV validator')) return evaluatorSpy();
      throw new Error('Unexpected Anthropic transport call in server-disabled route test');
    });
    let coreModule: typeof import('..') | null = null;

    try {
      process.env.AI_CORE_V3_ENABLED = 'false';
      process.env.NEXT_PUBLIC_AI_CORE_V3_ENABLED = 'false';
      process.env.ANTHROPIC_API_KEY = 'server-disabled-route-test-key';
      delete process.env.ANTHROPIC_AUTH_TOKEN;
      vi.resetModules();
      vi.doMock('@anthropic-ai/sdk', () => {
        class MockAnthropic {
          readonly messages = { create: messagesCreateSpy };
        }
        return { default: MockAnthropic };
      });
      vi.doMock('@/lib/pro-token', () => ({
        verifyProToken: vi.fn(async () => ({ subject: 'server-disabled-route-test' })),
      }));

      coreModule = await import('..');
      coreModule.resetAiCoreV3TestOverride();
      expect(coreModule.isAiCoreV3Enabled({
        AI_CORE_V3_ENABLED: process.env.AI_CORE_V3_ENABLED,
      })).toBe(false);

      const manifest = {
        operationId: 'server-disabled-operation',
        operationKind: 'experience_generate' as const,
        mode: 'generate' as const,
        entryId: 'server-disabled-entry',
        locale: 'en',
        roleTitle: 'Support Specialist',
        company: 'Example Company',
        employmentState: 'present' as const,
        dates: { start: { year: 2024, month: 1 }, end: null },
        industry: 'customer-service',
        level: 'mid',
        exactSourceText: '',
        facts: [],
        snapshotHash: 'server-disabled-snapshot',
      };
      expect(coreModule.parseExperienceV3GenerateRequest({ manifest })).not.toBeNull();

      const requestPayload = {
        action: coreModule.EXPERIENCE_V3_GENERATE_ACTION,
        proToken: 'server-disabled-pro-token',
        requestId: manifest.operationId,
        manifest,
      };
      expect(requestPayload.action).toBe('experience_v3_generate');
      const request = new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      const { POST } = await import('@/app/api/generate/route');
      const response = await POST(request as Parameters<typeof POST>[0]);
      const responseBody = await response.json();

      expect(response.status).toBe(409);
      expect(responseBody).toEqual({
        ok: false,
        action: coreModule.EXPERIENCE_V3_GENERATE_ACTION,
        typedReason: 'v3_feature_disabled',
      });
      expect(messagesCreateSpy).toHaveBeenCalledTimes(0);
      expect(writerSpy).toHaveBeenCalledTimes(0);
      expect(evaluatorSpy).toHaveBeenCalledTimes(0);
      for (const forbiddenAuthority of [
        'candidate',
        'bullets',
        'validation',
        'aggregateDecision',
        'accepted',
        'applyAuthorized',
        'allowsApply',
        'usageAuthorized',
        'allowsUsage',
        'shouldIncrementUsage',
      ]) {
        expect(responseBody).not.toHaveProperty(forbiddenAuthority);
      }
    } finally {
      coreModule?.resetAiCoreV3TestOverride();
      vi.restoreAllMocks();
      vi.doUnmock('@anthropic-ai/sdk');
      vi.doUnmock('@/lib/pro-token');
      vi.resetModules();
      for (const key of environmentKeys) {
        const original = originalEnvironment[key];
        if (original.present) process.env[key] = original.value;
        else delete process.env[key];
      }
    }

    for (const key of environmentKeys) {
      expect(Object.prototype.hasOwnProperty.call(process.env, key)).toBe(originalEnvironment[key].present);
      expect(process.env[key]).toBe(originalEnvironment[key].value);
    }
    const restoredCore = await import('..');
    restoredCore.resetAiCoreV3TestOverride();
    expect(restoredCore.isAiCoreV3Enabled()).toBe(false);
    vi.resetModules();
  });

  it('has one V3 writer path and one evaluator path, both with provider retries disabled', () => {
    const branch = routeSource.slice(
      routeSource.indexOf('if (action === EXPERIENCE_V3_GENERATE_ACTION)'),
      routeSource.indexOf("if (action === 'cover-letter'"),
    );
    expect(branch.match(/generate: async \(prompt\)/g)).toHaveLength(1);
    expect(branch.match(/evaluate: async \(prompt\)/g)).toHaveLength(1);
    expect(branch.match(/undefined, false\)\)/g)).toHaveLength(2);
  });

  it('keeps new V3 modules isolated from legacy writers, repair, fallback, and Summary dependencies', () => {
    const v3 = `${clientV3Source}\n${serverV3Source}`;
    for (const forbidden of [
      'activateCvExperienceBullets(',
      'finalizeBullets(',
      'finalizeCvAiFieldForApply(',
      'applyFinalizedBulletsToCv(',
      'buildJobContextGenerationFallback(',
      'generateBulletsOffline(',
      'deterministicLocalizedBulletsFromCanonical(',
      "from '../cv-summary-v2'",
    ]) {
      expect(v3).not.toContain(forbidden);
    }
  });

  it('increments usage only after readback and successful persistence in the V3 transaction', () => {
    const persistence = clientV3Source.indexOf('persisted = dependencies.persistCv(readback)');
    const usage = clientV3Source.indexOf('dependencies.incrementUsage()');
    const readback = clientV3Source.indexOf('const readbackPassed =');
    expect(readback).toBeLessThan(persistence);
    expect(persistence).toBeLessThan(usage);
    expect(clientV3Source.match(/dependencies\.incrementUsage\(\)/g)).toHaveLength(1);
  });
});
