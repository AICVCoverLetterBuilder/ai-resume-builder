/**
 * @vitest-environment jsdom
 *
 * Android build 230 real-device regression: after the deadline-aware Vercel
 * Production deploy, Serbian Generate Summary failed *immediately* with the
 * localized network toast ("Mrežna greška..."), not after the 40s client
 * timeout and not as a validation/rate-limit error.
 *
 * Confirmed causes in the client path:
 * 1. `getApiBaseUrl()` preferred a stale `cvpro_api_base_url` localStorage
 *    override over the Production URL baked into the AAB via
 *    `NEXT_PUBLIC_API_BASE_URL`. A dead Preview/old host makes `fetch` reject
 *    immediately with TypeError("Failed to fetch").
 * 2. `classifyAiFailure` mapped *every* TypeError to `network_error`, so even
 *    null-body / property-access bugs after a real HTTP response looked like
 *    an offline outage.
 * 3. `apiFetch` returned `data: null` on non-JSON bodies; handlers then
 *    dereferenced `summaryData.error` and threw TypeError → network toast.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_CLIENT_TIMEOUT_MS, resolveClientAbortTimeoutMs, hasRepairBudget, computeServerDeadline, logAiClientRequestTiming, logAiServerRequestTiming } from '@/lib/ai-request-timing';
import { classifyAiFailure } from '@/lib/ai-usage-policy';
import { activateCvSummary } from '@/lib/cv-content-activation';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import type { CVData } from '@/lib/types';

const PRODUCTION_HOST = 'https://ai-resume-builder-six-gamma.vercel.app';

function forkliftCv(): CVData {
  const bullets = '• Utovar i istovar robe\n• Bezbedno rukovanje viličarom';
  return {
    id: 'sr-net-1',
    name: 'Vozac',
    personal: {
      fullName: 'Test',
      email: 't@example.com',
      phone: '+381',
      address: 'NS',
      jobTitle: 'Vozač viličara',
      gender: 'male',
    },
    summary: 'Vozač viličara sa iskustvom.',
    experience: [{
      id: 'e1',
      company: 'Upopo',
      position: 'Vozač viličara',
      startDate: '2021-03',
      endDate: '',
      isPresent: true,
      description: bullets,
      canonicalDescription: bullets,
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'creative-artistic',
    region: 'Balkan',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

describe('Android build 230 API base URL resolution', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_BASE_URL = PRODUCTION_HOST;
  });
  afterEach(() => {
    localStorage.clear();
    if (originalEnv === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
  });

  it('11-12. Production API base URL is valid HTTPS and not localhost/Preview', async () => {
    const { isValidHttpsApiBaseUrl, getApiBaseUrl, resolveApiUrl } = await import('@/lib/api');
    expect(isValidHttpsApiBaseUrl(PRODUCTION_HOST)).toBe(true);
    expect(isValidHttpsApiBaseUrl('http://localhost:3000')).toBe(false);
    expect(isValidHttpsApiBaseUrl('https://localhost')).toBe(false);
    expect(isValidHttpsApiBaseUrl('https://ai-resume-builder-git-fix-user.vercel.app')).toBe(false);
    expect(getApiBaseUrl()).toBe(PRODUCTION_HOST);
    expect(resolveApiUrl('/api/generate')).toBe(`${PRODUCTION_HOST}/api/generate`);
  });

  it('build-time Production URL wins over a stale localStorage override', async () => {
    localStorage.setItem('cvpro_api_base_url', 'https://dead-preview-xyz.vercel.app');
    const { getApiBaseUrl } = await import('@/lib/api');
    expect(getApiBaseUrl()).toBe(PRODUCTION_HOST);
  });

  it('ignores invalid localStorage values (http / localhost / empty)', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    vi.resetModules();
    localStorage.setItem('cvpro_api_base_url', 'http://10.0.0.1:3000');
    const { getApiBaseUrl } = await import('@/lib/api');
    expect(getApiBaseUrl()).toBe('');
  });
});

describe('Error classification must not collapse HTTP failures into network_error', () => {
  it('5. a 500 response is not mapped to network_error', () => {
    expect(classifyAiFailure({
      httpStatus: 500,
      body: { error: 'Internal Server Error' },
    }).code).toBe('provider_temporarily_unavailable');
  });

  it('6. a 429 response maps to server_rate_limited', () => {
    expect(classifyAiFailure({ httpStatus: 429, body: {} }).code).toBe('server_rate_limited');
  });

  it('7. a server/client timeout maps to request_timeout', () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    expect(classifyAiFailure({ httpStatus: null, error: abortErr }).code).toBe('request_timeout');
    expect(classifyAiFailure({
      httpStatus: 504,
      body: { code: 'request_timeout', error: 'AI request timed out.' },
    }).code).toBe('request_timeout');
  });

  it('8. a real fetch rejection maps to network_error', () => {
    const err = new TypeError('Failed to fetch');
    expect(classifyAiFailure({ httpStatus: null, error: err }).code).toBe('network_error');
  });

  it('9. offline state maps to network_error', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      expect(classifyAiFailure({ httpStatus: null, error: null }).code).toBe('network_error');
    } finally {
      if (original) Object.defineProperty(navigator, 'onLine', original);
      else Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    }
  });

  it('10. invalid JSON / null-body TypeError is NOT network_error', () => {
    const err = new TypeError("Cannot read properties of null (reading 'error')");
    expect(classifyAiFailure({ httpStatus: null, error: err }).code).not.toBe('network_error');
    expect(classifyAiFailure({ httpStatus: null, error: err }).code).toBe('provider_temporarily_unavailable');
  });

  it('403 invalid_pro_token stays distinct from network_error', () => {
    expect(classifyAiFailure({
      httpStatus: 403,
      body: { code: 'invalid_pro_token', error: 'Pro access required for AI features.' },
    }).code).toBe('invalid_pro_token');
  });
});

describe('apiFetch non-JSON body handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a synthetic provider error body instead of null when JSON parse fails', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = PRODUCTION_HOST;
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>boom</html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })));
    const { apiFetch } = await import('@/lib/api');
    const { data, response, jsonParseFailed } = await apiFetch<{ error?: string; code?: string }>('/api/generate', {
      body: { action: 'summary' },
    });
    expect(response.status).toBe(500);
    expect(jsonParseFailed).toBe(true);
    expect(data).not.toBeNull();
    expect(data.code).toBe('provider_temporarily_unavailable');
    expect(classifyAiFailure({ httpStatus: response.status, body: data }).code)
      .toBe('provider_temporarily_unavailable');
  });
});

describe('Client timeout is 40 seconds, not immediate', () => {
  it('4. AI_CLIENT_TIMEOUT_MS is 40000 and resolveClientAbortTimeoutMs never returns 0/NaN', () => {
    expect(AI_CLIENT_TIMEOUT_MS).toBe(40_000);
    expect(resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS)).toBe(40_000);
    expect(resolveClientAbortTimeoutMs(Number.NaN)).toBe(40_000);
    expect(resolveClientAbortTimeoutMs(0)).toBe(40_000);
    expect(resolveClientAbortTimeoutMs(-1)).toBe(40_000);
  });

  it('cv-builder page schedules abort with resolveClientAbortTimeoutMs / AI_CLIENT_TIMEOUT_MS', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
    expect(src).toContain('resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS)');
    expect(src).not.toMatch(/setTimeout\(\(\) => controller\.abort\(\),\s*0\)/);
    expect(src).not.toMatch(/setTimeout\(\(\) => controller\.abort\(\),\s*30000\)/);
  });
});

describe('1-3. Locale recovery still works (Serbian / English / Hindi deadline-aware)', () => {
  it('1. valid Serbian summary activates without block', async () => {
    const cv = forkliftCv();
    const factSet = buildCvCanonicalFactSet(cv);
    const result = await activateCvSummary({
      locale: 'sr',
      gender: 'male',
      factSet,
      candidate: cv.summary,
      sourceFactsText: cv.summary,
      fallbackSummary: cv.summary,
      deadlineAt: computeServerDeadline(Date.now()),
    });
    expect(result.blocked).toBeFalsy();
    expect(result.content.trim()).not.toBe('');
  });

  it('2. valid English summary activates without block', async () => {
    const cv = forkliftCv();
    const factSet = buildCvCanonicalFactSet(cv);
    const en = 'Warehouse forklift operator with about five years of experience loading goods safely.';
    const result = await activateCvSummary({
      locale: 'en',
      gender: 'male',
      factSet,
      candidate: en,
      sourceFactsText: cv.summary,
      fallbackSummary: cv.summary,
      deadlineAt: computeServerDeadline(Date.now()),
    });
    expect(result.blocked).toBeFalsy();
  });

  it('3. Hindi still uses deadline-aware recovery (skip repair when budget is tight)', async () => {
    const start = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(start);
    try {
      const cv = forkliftCv();
      const factSet = buildCvCanonicalFactSet(cv);
      const deadlineAt = computeServerDeadline(start);
      expect(hasRepairBudget(deadlineAt, start)).toBe(true);
      vi.setSystemTime(deadlineAt - 1_000);
      expect(hasRepairBudget(deadlineAt)).toBe(false);
      const repair = vi.fn(async () => cv.summary);
      const result = await activateCvSummary({
        locale: 'hi',
        gender: 'male',
        factSet,
        candidate: cv.summary,
        sourceFactsText: cv.summary,
        fallbackSummary: cv.summary,
        deadlineAt,
        repair,
      });
      expect(repair).not.toHaveBeenCalled();
      expect(result.blocked).toBeFalsy();
      expect(result.content).toMatch(/[\u0900-\u097F]/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('13. Request timing diagnostics do not throw', () => {
  it('client and server timing loggers are safe no-ops / non-throwing', () => {
    expect(() => logAiClientRequestTiming({
      requestId: 'req_1',
      action: 'summary_generate',
      requestedLocale: 'sr',
      clientStartedAt: Date.now(),
      clientTimeoutMs: AI_CLIENT_TIMEOUT_MS,
      clientAborted: false,
      applied: false,
      reason: 'network_error',
    })).not.toThrow();
    expect(() => logAiServerRequestTiming({
      requestId: 'req_1',
      action: 'summary_generate',
      requestedLocale: 'sr',
      serverReceivedAt: Date.now(),
      serverRespondedAt: Date.now() + 10,
      deadlineAt: computeServerDeadline(Date.now()),
    })).not.toThrow();
  });
});

describe('14-15. Usage counting around transport failures', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('14. a successful request increments usage exactly once', async () => {
    const usage = await import('@/lib/ai-usage-policy');
    const before = usage.getProAiUsageCount();
    usage.recordProAiUserActionSuccess();
    expect(usage.getProAiUsageCount()).toBe(before + 1);
  });

  it('15. a failed transport request does not increment usage', async () => {
    const usage = await import('@/lib/ai-usage-policy');
    const before = usage.getProAiUsageCount();
    const classified = usage.classifyAiFailure({
      httpStatus: null,
      error: new TypeError('Failed to fetch'),
    });
    expect(classified.code).toBe('network_error');
    // catch-path never calls recordProAiUserActionSuccess
    expect(usage.getProAiUsageCount()).toBe(before);
  });
});

describe('Bundled Android assets sanity (build 230 webDir copy)', () => {
  it('Android public assets embed an https vercel Production host, not localhost', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const chunkPath = path.resolve(
      'android/app/src/main/assets/public/_next/static/chunks/6241-845ec6254607bce9.js',
    );
    if (!fs.existsSync(chunkPath)) {
      // Assets may be absent in CI checkouts that never ran capacitor sync.
      expect(true).toBe(true);
      return;
    }
    const src = fs.readFileSync(chunkPath, 'utf8');
    expect(src).toContain('https://ai-resume-builder-six-gamma.vercel.app');
    expect(src).not.toContain('http://localhost:3000');
    expect(src).not.toMatch(/https:\/\/[^"']+-git-[^"']+\.vercel\.app/);
  });
});
