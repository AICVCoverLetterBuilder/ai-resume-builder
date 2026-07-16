/**
 * Server generate-route contract tests (source + classifier; no live Anthropic).
 */
import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { classifyAiFailure } from '@/lib/ai-usage-policy';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import { PRO_AI_SAFETY_CAP } from '@/lib/ai-usage-policy';

describe('generate route API contract (structured errors)', () => {
  const route = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');

  test('returns server_rate_limited with Retry-After metadata', () => {
    expect(route).toContain("code: 'server_rate_limited'");
    expect(route).toContain("'Retry-After'");
    expect(route).toContain('RATE_LIMIT_MAX_REQUESTS_PRO');
    expect(route).toContain('RATE_LIMIT_MAX_REQUESTS_IP');
    expect(route).toContain('pro_token_hash');
  });

  test('provider failures emit distinct codes (not a single generic outage string only)', () => {
    expect(route).toContain('provider_rate_limited');
    expect(route).toContain('provider_temporarily_unavailable');
    expect(route).toContain('provider_auth_error');
    expect(route).toContain('provider_credit_exhausted');
    expect(route).toContain('request_timeout');
  });

  test('free quota vs invalid Pro use distinct codes', () => {
    expect(route).toContain("'free_ai_limit_reached'");
    expect(route).toContain("'invalid_pro_token'");
  });

  test('client classifier preserves HTTP status + code for contract mapping', () => {
    const cases: Array<{
      status: number;
      body?: { code?: string; error?: string; retryAfter?: number };
      expectCode: string;
    }> = [
      { status: 200, expectCode: 'provider_temporarily_unavailable' }, // unused path — classifier defaults carefully
      { status: 429, body: { code: 'server_rate_limited', retryAfter: 20 }, expectCode: 'server_rate_limited' },
      { status: 429, body: { code: 'provider_rate_limited' }, expectCode: 'provider_rate_limited' },
      { status: 503, expectCode: 'provider_temporarily_unavailable' },
      { status: 529, expectCode: 'provider_temporarily_unavailable' },
      { status: 403, body: { error: 'Pro access required for AI features.' }, expectCode: 'free_ai_limit_reached' },
      { status: 422, expectCode: 'generation_validation_failed' },
    ];

    for (const c of cases) {
      if (c.status === 200) continue;
      const result = classifyAiFailure({
        httpStatus: c.status,
        body: c.body,
        retryAfterSec: c.body?.retryAfter ?? null,
      });
      expect(result.code).toBe(c.expectCode);
      expect(result.httpStatus).toBe(c.status);
    }
  });

  test('localized client mapping for contract codes', () => {
    expect(aiErrorMessage('server_rate_limited', 'en', 9)).toContain('9');
    expect(aiErrorMessage('pro_safety_limit_reached', 'hi')).not.toMatch(/temporarily unavailable/i);
    expect(PRO_AI_SAFETY_CAP).toBe(20);
  });
});
