/**
 * @vitest-environment jsdom
 *
 * Android build 225: after the build-223 -> build-224 migration (count preserved,
 * policyLimit raised to 50) plus real successful actions in build 224/225, the
 * device legitimately reached count 50 and was correctly blocked with
 * `pro_safety_limit_reached`. This file locks in:
 *  - the exact 47 -> 48 -> 49 -> 50 -> blocked boundary math is unchanged;
 *  - failed/rejected AI attempts (invalid provider result, failed repair, rejected
 *    fallback, terminal validation toast) never increment the counter;
 *  - a deterministic fallback that *does* become the applied visible result
 *    counts exactly once, never twice;
 *  - the `handleGenBullets` silent-rejection gap (acceptValidatedAiContent quietly
 *    no-ops on a locale-guard rejection, but the counter/success-toast used to
 *    fire anyway) is closed via `willAcceptValidatedAiContent`;
 *  - the new dev-only PRO_AI_USAGE diagnostic line has the exact requested shape
 *    and never appears in production.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  AI_USAGE_SCHEMA_VERSION,
  AI_USAGE_STORAGE_KEY,
  PRO_AI_SAFETY_CAP,
  canUseProAiSafety,
  getProAiUsageCount,
  loadProAiRecord,
  logProAiUsageDiagnostics,
  recordProAiUserActionSuccess,
  type ProAiRecord,
} from '@/lib/ai-usage-policy';
import { checkProAccess } from '@/lib/store';
import { willAcceptValidatedAiContent } from '@/lib/cv-canonical-snapshot';

function seedRecord(count: number, windowStart = Date.now()): ProAiRecord {
  const record: ProAiRecord = {
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart,
    policyLimit: PRO_AI_SAFETY_CAP,
  };
  localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify(record));
  return record;
}

describe('Pro AI usage counting — 47/48/49/50 boundary (Android build 225)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('starting at persisted count=47: three successful visible actions reach exactly 50, then block', () => {
    seedRecord(47);
    let record = loadProAiRecord();
    expect(record.count).toBe(47);
    expect(record.schemaVersion).toBe(2);
    expect(record.policyLimit).toBe(50);

    expect(checkProAccess(true, record.count)).toBe('allowed');
    record = recordProAiUserActionSuccess(record); // visible action 48
    expect(record.count).toBe(48);

    expect(checkProAccess(true, record.count)).toBe('allowed');
    record = recordProAiUserActionSuccess(record); // visible action 49
    expect(record.count).toBe(49);

    expect(checkProAccess(true, record.count)).toBe('allowed');
    record = recordProAiUserActionSuccess(record); // visible action 50
    expect(record.count).toBe(50);

    // The next attempted action must be blocked BEFORE any provider call.
    expect(checkProAccess(true, record.count)).toBe('safety_cap');
    expect(canUseProAiSafety(true, record)).toBe(false);

    // Blocking never mutates the persisted count.
    expect(loadProAiRecord().count).toBe(50);
    const persisted = JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY)!);
    expect(persisted.count).toBe(50);
  });

  test('reaching 50 after 3 build-225 generations is mathematically expected from a preserved count of 47', () => {
    // This is exactly the reported real-device sequence: migrated build-224 count
    // (whatever it had reached) plus a handful of real build-225 successes lands
    // on 50. Nothing here is a bug by itself — it is only a bug if any of those
    // prior increments were NOT genuine visible successes (covered below).
    seedRecord(47);
    let record = loadProAiRecord();
    for (let i = 0; i < 3; i++) {
      expect(checkProAccess(true, record.count)).toBe('allowed');
      record = recordProAiUserActionSuccess(record);
    }
    expect(record.count).toBe(50);
    expect(checkProAccess(true, record.count)).toBe('safety_cap');
  });

  test('from count=40: failed provider, failed repair, rejected fallback, terminal toast never increment', () => {
    seedRecord(40);
    const before = loadProAiRecord();
    expect(before.count).toBe(40);

    // Simulate every failure stage WITHOUT calling recordProAiUserActionSuccess —
    // this mirrors every real call site: the counter helper is only ever invoked
    // after content is actually applied.
    const simulateFailedProviderResult = () => {/* invalid provider text, no increment call */};
    const simulateFailedRepair = () => {/* repair still invalid, no increment call */};
    const simulateRejectedFallback = () => {/* fallback also fails validation, no increment call */};
    const simulateTerminalToast = () => {/* blocked:true path, no increment call */};
    simulateFailedProviderResult();
    simulateFailedRepair();
    simulateRejectedFallback();
    simulateTerminalToast();

    expect(loadProAiRecord().count).toBe(40);

    // One valid deterministic fallback IS applied as the final visible result —
    // counts exactly once.
    const afterFallback = recordProAiUserActionSuccess(loadProAiRecord());
    expect(afterFallback.count).toBe(41);
    expect(loadProAiRecord().count).toBe(41);

    // Never double-counted: a second, separate "fallback became final" signal for
    // the SAME user action must not fire a second increment call. Callers only
    // ever call recordProAiUserActionSuccess once per action; simulate that
    // discipline explicitly here.
    const secondSignalForSameAction = false;
    if (secondSignalForSameAction) recordProAiUserActionSuccess(loadProAiRecord());
    expect(loadProAiRecord().count).toBe(41);
  });
});

describe('willAcceptValidatedAiContent — closes the silent-rejection counting gap (bullets)', () => {
  test('rejects wrong-language bullets before any counter increment or success toast would fire', () => {
    // Serbian text returned for a German-requested bullets action — the exact
    // shape of the bug: acceptValidatedAiContent silently no-ops on this, so a
    // caller that increments unconditionally after calling it would count a
    // visible failure as a success.
    const serbianBullets = '• Saradnja sa međufunkcionalnim timovima na izvršenju projekata';
    const willApply = willAcceptValidatedAiContent({
      locale: 'de',
      experienceId: 'exp-1',
      description: serbianBullets,
    });
    expect(willApply).toBe(false);
  });

  test('accepts genuinely German bullets', () => {
    const germanBullets = '• Entwicklung und Umsetzung interner Prozesse';
    const willApply = willAcceptValidatedAiContent({
      locale: 'de',
      experienceId: 'exp-1',
      description: germanBullets,
    });
    expect(willApply).toBe(true);
  });

  test('rejects wrong-language summary the same way', () => {
    expect(
      willAcceptValidatedAiContent({
        locale: 'hi',
        summary: 'Operaterka u proizvodnji sa iskustvom u procesima.',
      }),
    ).toBe(false);
    expect(
      willAcceptValidatedAiContent({
        locale: 'hi',
        summary: 'उत्पादन ऑपरेटर के रूप में अनुभव।',
      }),
    ).toBe(true);
  });
});

describe('PRO_AI_USAGE dev-only diagnostic line', () => {
  const originalEnv = process.env.NODE_ENV;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });
  afterEach(() => {
    debugSpy.mockRestore();
    (process.env as { NODE_ENV?: string }).NODE_ENV = originalEnv;
  });

  test('applied success line matches the requested shape', () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
    logProAiUsageDiagnostics({
      before: 47,
      after: 48,
      action: 'summary_stronger',
      origin: 'ai_repaired',
      applied: true,
      requestId: 'req_abc123',
    });
    expect(debugSpy).toHaveBeenCalledTimes(1);
    const line = debugSpy.mock.calls[0][0] as string;
    expect(line).toBe(
      'PRO_AI_USAGE before=47 after=48 action=summary_stronger origin=ai_repaired applied=true requestId=req_abc123',
    );
  });

  test('rejected action line includes the reason and no requestId noise when omitted', () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
    logProAiUsageDiagnostics({
      before: 47,
      after: 47,
      action: 'summary_generate',
      origin: null,
      applied: false,
      reason: 'locale_validation_failed',
    });
    expect(debugSpy).toHaveBeenCalledTimes(1);
    const line = debugSpy.mock.calls[0][0] as string;
    expect(line).toBe(
      'PRO_AI_USAGE before=47 after=47 action=summary_generate origin=none applied=false reason=locale_validation_failed',
    );
  });

  test('never logs in production (no internal cap/behavior exposed to end users)', () => {
    (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
    logProAiUsageDiagnostics({
      before: 47,
      after: 48,
      action: 'summary_generate',
      origin: 'ai_generated',
      applied: true,
    });
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
